/**
 * sessions.js — Upload sessions management route
 * Lists all sessions, gets session details, and deletes sessions.
 */

const express = require("express");
const store   = require("../store/mongoStore");

const router = express.Router();

// GET /api/sessions — list all sessions
router.get("/", async (_req, res) => {
  try {
    const sessions = await store.getAllSessions();
    res.json(
      sessions.map((s) => ({
        sessionId:      String(s._id),
        filename:       s.filename,
        fileType:       s.fileType,
        rowCount:       s.rowCount,
        processedCount: s.processedCount,
        status:         s.status,
        errorMessage:   s.errorMessage,
        uploadedAt:     s.createdAt,
        completedAt:    s.processingCompletedAt,
        stats:          s.stats || {},
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id — single session details
router.get("/:id", async (req, res) => {
  try {
    const session = await store.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found." });

    res.json({
      sessionId:      String(session._id),
      filename:       session.filename,
      fileType:       session.fileType,
      rowCount:       session.rowCount,
      processedCount: session.processedCount,
      status:         session.status,
      errorMessage:   session.errorMessage,
      uploadedAt:     session.createdAt,
      completedAt:    session.processingCompletedAt,
      stats:          session.stats || {},
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id — delete session and all its records
router.delete("/:id", async (req, res) => {
  try {
    await store.deleteSession(req.params.id);
    res.json({ message: "Session deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
