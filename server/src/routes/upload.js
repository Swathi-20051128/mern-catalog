/**
 * upload.js — File upload route (v2)
 * Accepts CSV and Excel (.xlsx, .xls) files.
 * Creates a session, runs AI agent pipeline, stores results in MongoDB.
 * Processes asynchronously and updates session status in real-time.
 */

const express = require("express");
const multer  = require("multer");
const { parse } = require("csv-parse/sync");
const XLSX = require("xlsx");

const { runPipeline }   = require("../pipeline/enrichmentPipeline");
const store             = require("../store/mongoStore");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
});

// ── File parsers ──────────────────────────────────────────────────────────────

function parseCsv(buffer) {
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
}

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel file has no sheets.");
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function parseFile(buffer, mimetype, originalname) {
  const ext = originalname.split(".").pop().toLowerCase();
  if (ext === "csv" || mimetype === "text/csv" || mimetype === "application/csv") {
    return { rows: parseCsv(buffer), fileType: "csv" };
  }
  if (ext === "xlsx" || ext === "xls" ||
      mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimetype === "application/vnd.ms-excel") {
    return { rows: parseExcel(buffer), fileType: ext === "xls" ? "xls" : "xlsx" };
  }
  throw new Error(`Unsupported file type: .${ext}. Please upload a CSV or Excel file.`);
}

// ── POST /api/upload ──────────────────────────────────────────────────────────

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Expected field name 'file'." });
  }

  let rows, fileType;
  try {
    ({ rows, fileType } = parseFile(req.file.buffer, req.file.mimetype, req.file.originalname));
  } catch (parseErr) {
    return res.status(400).json({ error: parseErr.message });
  }

  if (!rows.length) {
    return res.status(400).json({ error: "File appears to be empty." });
  }

  // Create a session record immediately so client can poll/redirect
  let session;
  try {
    session = await store.createSession({
      filename:     req.file.originalname,
      originalName: req.file.originalname,
      fileType,
      rowCount:     rows.length,
      status:       "processing",
      processingStartedAt: new Date(),
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create session: " + err.message });
  }

  const sessionId = String(session._id);

  // Respond immediately with sessionId so client can navigate to the processing page
  res.json({
    message:   `Upload received. Processing ${rows.length} rows with AI agents…`,
    sessionId,
    rowCount:  rows.length,
    status:    "processing",
  });

  // Process in background (after response is sent)
  setImmediate(async () => {
    try {
      const enriched = await runPipeline(rows, sessionId, (pct, msg) => {
        console.log(`[Upload] Session ${sessionId}: ${pct}% — ${msg}`);
      });

      // Store enriched records in MongoDB
      await store.insertRecords(enriched);

      // Compute and cache stats in the session document
      const stats = await store.computeSessionStats(sessionId);

      await store.updateSession(sessionId, {
        status: "done",
        processedCount: enriched.length,
        processingCompletedAt: new Date(),
        // Cache the FULL stats object — previously only a subset of fields
        // was cached here (avgConfidence/categorized/needsReview/withAttrs/
        // categoryBreakdown/confidenceBuckets), silently dropping `total`,
        // `categorizedPct`, `withAttrsPct`, and `needsReviewPct`. Those are
        // what the dashboard's "Total records" and "% of rows" stat cards
        // read, so they rendered blank/"undefined%" on every subsequent
        // page load once the cached-stats branch in stats.js kicked in.
        stats,
      });

      console.log(`[Upload] Session ${sessionId} complete. ${enriched.length} records stored.`);
    } catch (err) {
      console.error(`[Upload] Session ${sessionId} FAILED:`, err.message);
      await store.updateSession(sessionId, {
        status: "error",
        errorMessage: err.message,
      });
    }
  });
});

// ── GET /api/upload/status/:sessionId ─────────────────────────────────────────
// Poll for processing status

router.get("/status/:sessionId", async (req, res) => {
  try {
    const session = await store.getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session not found." });

    res.json({
      sessionId:    String(session._id),
      status:       session.status,
      filename:     session.filename,
      rowCount:     session.rowCount,
      processedCount: session.processedCount,
      errorMessage: session.errorMessage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;