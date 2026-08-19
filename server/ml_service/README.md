"""
CatalogIQ ML Training Service — FOR OFFLINE TRAINING ONLY
==========================================================

⚠️  IMPORTANT: This Python ML service is used ONLY for offline model training.
    Live inference is handled by GPT AI Agents (via OpenAI API) in the Node.js server.

Usage (offline training only):
  1. pip install -r requirements.txt
  2. python train.py         ← trains models from sample-input.csv
  3. (Optional) uvicorn predict:app --port 8000  ← legacy ML inference (retired)

The trained model files (models/) are for reference/research purposes only.
The CatalogIQ v2 website does NOT use this Python service for predictions.
"""
