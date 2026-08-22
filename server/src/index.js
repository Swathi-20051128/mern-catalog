/**
 * CatalogIQ API Server — v2
 * AI Agent-powered product catalog enrichment.
 *
 * Architecture:
 *   - GPT AI Agents handle all classification, brand resolution, attribute
 *     extraction, and description generation (via OpenAI gpt-4o-mini / gpt-4o)
 *   - MongoDB stores all session data and enriched records
 *   - The bundled CSV dataset is for ML training only (not loaded at startup)
 */

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const store    = require("./store/mongoStore");

const recordsRouter  = require("./routes/records");
const uploadRouter   = require("./routes/upload");
const statsRouter    = require("./routes/stats");
const sessionsRouter = require("./routes/sessions");

const app  = express();
const PORT = process.env.PORT || 5000;

// CORS configuration.
// - If CORS_ORIGIN env var is set (comma-separated list of allowed origins),
//   only those origins are permitted.
// - If CORS_ORIGIN is NOT set, all origins are allowed (safe default for
//   initial deploys; lock it down once your Vercel URL is known).
//
// Set in Render dashboard:  CORS_ORIGIN=https://mern-catalog.vercel.app
const rawOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: rawOrigins.length
    ? (origin, cb) => {
        const allowed = [
          ...rawOrigins,
          "http://localhost:5173",
          "http://localhost:3000",
        ];
        if (!origin || allowed.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
      }
    : true, // allow all origins when CORS_ORIGIN is not configured
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
// Respond to all OPTIONS preflight requests (required for multipart uploads)
app.options("*", cors(corsOptions));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({
    ok:           true,
    version:      "2.0.0",
    mongoConnected: store.isConnected(),
    openaiConfigured: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key_here"),
    models: {
      standard: process.env.OPENAI_MODEL_STANDARD || "gpt-4o-mini",
      advanced: process.env.OPENAI_MODEL_ADVANCED  || "gpt-4o",
    },
  })
);

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api/sessions", sessionsRouter);
app.use("/api/records",  recordsRouter);
app.use("/api/upload",   uploadRouter);
app.use("/api/stats",    statsRouter);

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  // Validate required environment variables
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your_openai_api_key_here") {
    console.error("\n[ERROR] OPENAI_API_KEY is not set in server/.env");
    console.error("  Get your key at: https://platform.openai.com/api-keys");
    console.error("  Then set: OPENAI_API_KEY=sk-...\n");
    process.exit(1);
  }

  // Connect to MongoDB (required — no fallback)
  try {
    await store.connect();
  } catch (err) {
    console.error("\n[ERROR] Could not connect to MongoDB:", err.message);
    console.error("  Set MONGODB_URI in server/.env and ensure MongoDB is running.");
    console.error("  Local example: MONGODB_URI=mongodb://127.0.0.1:27017/catalogiq\n");
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════════╗`);
    console.log(`║  CatalogIQ API v2.0 — AI Agent Edition    ║`);
    console.log(`╠════════════════════════════════════════════╣`);
    console.log(`║  Server  : http://localhost:${PORT}           ║`);
    console.log(`║  MongoDB : Connected ✓                     ║`);
    console.log(`║  OpenAI  : ${process.env.OPENAI_MODEL_STANDARD || "gpt-4o-mini"} / ${process.env.OPENAI_MODEL_ADVANCED || "gpt-4o"}          ║`);
    console.log(`║  Note    : Upload a CSV or Excel file to   ║`);
    console.log(`║           start enrichment analysis        ║`);
    console.log(`╚════════════════════════════════════════════╝\n`);
  });
}

start();
