"""
predict.py — CatalogIQ ML Inference Service (FastAPI)
======================================================
Loads trained models from models/ and exposes:
  POST /predict       — single product row → enriched prediction
  POST /predict/batch — list of rows → list of predictions
  GET  /health        — service status + model metadata
  POST /retrain       — re-run train.py and reload models
"""

import os
import re
import io
import sys
import json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import joblib
import subprocess
import numpy as np
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
MODELS_DIR = SCRIPT_DIR / "models"
TRAIN_SCRIPT = SCRIPT_DIR / "train.py"

app = FastAPI(
    title="CatalogIQ ML Service",
    description="Product classification, brand resolution, and confidence scoring",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global model state ────────────────────────────────────────────────────────
models: Dict[str, Any] = {}
model_meta: Dict[str, Any] = {}
models_ready = False

def load_models():
    global models, model_meta, models_ready
    try:
        models = {
            "tfidf":          joblib.load(MODELS_DIR / "tfidf.pkl"),
            "classifier":     joblib.load(MODELS_DIR / "classifier.pkl"),
            "le_class":       joblib.load(MODELS_DIR / "label_encoder_class.pkl"),
            "brand_resolver": joblib.load(MODELS_DIR / "brand_resolver.pkl"),
            "le_brand":       joblib.load(MODELS_DIR / "label_encoder_brand.pkl"),
            "conf_scorer":    joblib.load(MODELS_DIR / "confidence_scorer.pkl"),
        }
        with open(MODELS_DIR / "meta.json") as f:
            model_meta = json.load(f)
        models_ready = True
        print(f"[ML] Models loaded OK  classes={model_meta['num_classes']}  brands={model_meta['num_brands']}")
    except Exception as e:
        models_ready = False
        print(f"[ML] WARNING: Models not found - run train.py first. ({e})")

@app.on_event("startup")
def startup():
    load_models()

# ── Rule helpers (fallback / brand source annotation) ────────────────────────
PLACEHOLDER_RE = re.compile(r"^--.*--$")

def is_placeholder(v):
    return not v or bool(PLACEHOLDER_RE.match(str(v).strip()))

def brand_source_tag(row: dict, brand: str, mfr_name: str) -> str:
    for f in ["E1_Brand", "Unilog_Brand", "DIB_Brand"]:
        v = row.get(f, "")
        if not is_placeholder(v):
            return f
    if brand == mfr_name:
        return "manufacturer fallback"
    return "ML model"

def parse_manufacturer(part_manuf: str):
    if not part_manuf:
        return "", ""
    m = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", str(part_manuf))
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return str(part_manuf).strip(), ""

# ── Schemas ───────────────────────────────────────────────────────────────────
class ProductRow(BaseModel):
    Mfg_Part_Num: Optional[str] = ""
    Part_Desc: Optional[str] = ""
    E1_Brand: Optional[str] = ""
    Unilog_Brand: Optional[str] = ""
    DIB_Brand: Optional[str] = ""
    Part_Manuf: Optional[str] = ""

class PredictionResult(BaseModel):
    mpn: str
    classpath: str
    category: str
    brand: str
    brandSource: str
    confidence: int
    needsReview: bool
    mlUsed: bool

class BatchRequest(BaseModel):
    rows: List[ProductRow]

# ── Core prediction logic ─────────────────────────────────────────────────────
def predict_row(row_dict: dict) -> dict:
    mpn  = str(row_dict.get("Mfg_Part_Num", "") or "").strip()
    desc = str(row_dict.get("Part_Desc",    "") or "").strip()
    mfr_name, mfr_code = parse_manufacturer(row_dict.get("Part_Manuf", ""))

    if not models_ready:
        raise HTTPException(503, "Models not loaded — run train.py first")

    tfidf    = models["tfidf"]
    clf      = models["classifier"]
    le_class = models["le_class"]
    brand_clf = models["brand_resolver"]
    le_brand  = models["le_brand"]
    conf_reg  = models["conf_scorer"]

    # Vectorise description
    X_text = tfidf.transform([desc])

    # 1. Classify
    class_idx  = clf.predict(X_text)[0]
    classpath  = le_class.inverse_transform([class_idx])[0]
    category   = classpath.split(" > ")[0]
    classified = classpath != "Uncategorized > Needs Manual Classification"

    # 2. Brand resolution
    # Check explicit brand fields first (high priority)
    resolved_brand = None
    brand_src = "ML model"
    for f in ["E1_Brand", "Unilog_Brand", "DIB_Brand"]:
        v = row_dict.get(f, "")
        if not is_placeholder(v):
            resolved_brand = str(v).strip()
            brand_src = f
            break

    if resolved_brand is None:
        brand_idx = brand_clf.predict(X_text)[0]
        resolved_brand = le_brand.inverse_transform([brand_idx])[0]
        if resolved_brand == mfr_name:
            brand_src = "manufacturer fallback"
        else:
            brand_src = "ML model"

    # 3. Confidence scoring
    conf_raw   = float(conf_reg.predict(X_text)[0])
    confidence = int(max(0, min(100, round(conf_raw))))
    needs_review = confidence < 60

    return {
        "mpn":         mpn,
        "classpath":   classpath,
        "category":    category,
        "brand":       resolved_brand,
        "brandSource": brand_src,
        "confidence":  confidence,
        "needsReview": needs_review,
        "mlUsed":      True,
    }

# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "ok":          models_ready,
        "modelsReady": models_ready,
        "meta":        model_meta if models_ready else {},
    }

@app.post("/predict", response_model=PredictionResult)
def predict_single(row: ProductRow):
    return predict_row(row.model_dump())

@app.post("/predict/batch")
def predict_batch(request: BatchRequest):
    results = []
    for row in request.rows:
        try:
            results.append(predict_row(row.model_dump()))
        except Exception as e:
            results.append({"error": str(e)})
    return {"results": results, "count": len(results)}

def _retrain_task():
    """Background retraining — called by /retrain endpoint."""
    global models_ready
    models_ready = False
    print("[ML] Retraining started...")
    result = subprocess.run(
        [sys.executable, str(TRAIN_SCRIPT)],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        load_models()
        print("[ML] Retraining complete ✓")
    else:
        print(f"[ML] Retraining FAILED:\n{result.stderr}")

@app.post("/retrain")
def retrain(background_tasks: BackgroundTasks):
    background_tasks.add_task(_retrain_task)
    return {"ok": True, "message": "Retraining started in background"}
