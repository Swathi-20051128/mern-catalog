/**
 * stats.js — Session-scoped analytics route (v2)
 * All stats are tied to a specific upload session.
 */

const express = require("express");
const store   = require("../store/mongoStore");

const router = express.Router();

// GET /api/stats/:sessionId — stats for a specific upload session
router.get("/:sessionId", async (req, res) => {
  try {
    const session = await store.getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session not found." });

    // If session is done AND the cached stats look complete, return them (fast).
    // Older sessions processed before the stats-caching fix only have a
    // partial object cached (missing `total`/`categorizedPct`/etc), so guard
    // on `total` specifically rather than just categoryBreakdown — otherwise
    // this branch keeps serving that stale, incomplete cache forever.
    if (session.status === "done" && session.stats?.categoryBreakdown?.length > 0 && session.stats?.total) {
      return res.json({
        ...session.stats,
        sessionId:    String(session._id),
        filename:     session.filename,
        status:       session.status,
        rowCount:     session.rowCount,
        processedCount: session.processedCount,
        uploadedAt:   session.createdAt,
      });
    }

    // Otherwise compute live stats (session still processing, cache empty,
    // or cache is stale/incomplete from before the stats-caching fix)
    const stats = await store.computeSessionStats(String(session._id));

    // Repair the stale cache in place so this session is fast next time too.
    if (session.status === "done") {
      await store.updateSession(String(session._id), { stats });
    }

    res.json({
      ...stats,
      sessionId:    String(session._id),
      filename:     session.filename,
      status:       session.status,
      rowCount:     session.rowCount,
      processedCount: session.processedCount || stats.total,
      uploadedAt:   session.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats — aggregate stats across all sessions (summary)
router.get("/", async (_req, res) => {
  try {
    const sessions = await store.getAllSessions();
    const doneSessions = sessions.filter((s) => s.status === "done");

    if (doneSessions.length === 0) {
      return res.json({
        totalSessions: sessions.length,
        totalRecords: 0,
        message: "No processed sessions yet. Upload a CSV or Excel file to get started.",
      });
    }

    const totalRecords = doneSessions.reduce((s, sess) => s + (sess.processedCount || 0), 0);
    const avgConfidence = Math.round(
      doneSessions.reduce((s, sess) => s + (sess.stats?.avgConfidence || 0), 0) / doneSessions.length
    );

    res.json({
      totalSessions: sessions.length,
      doneSessions:  doneSessions.length,
      totalRecords,
      avgConfidence,
      latestSession: doneSessions[0] ? {
        sessionId: String(doneSessions[0]._id),
        filename:  doneSessions[0].filename,
        uploadedAt: doneSessions[0].createdAt,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;