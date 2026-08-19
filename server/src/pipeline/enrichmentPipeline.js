/**
 * enrichmentPipeline.js — CatalogIQ Enrichment Pipeline (v2)
 *
 * All enrichment is now handled by GPT AI Agents via agentOrchestrator.
 * This module is a thin wrapper that maintains the same public API
 * as before (runPipeline, enrichRow) for compatibility with upload.js.
 *
 * The Python ML service is retired from live serving.
 * The CSV dataset is used ONLY for offline ML training (ml_service/train.py).
 */

const { runAgentPipeline } = require("../agents/agentOrchestrator");

/**
 * Enrich an array of raw product rows using GPT AI agents.
 * @param {Array<Object>} rows — raw rows from CSV/Excel
 * @param {string} sessionId — MongoDB session ID to tag records
 * @param {Function} [onProgress] — optional progress callback(pct, msg)
 * @returns {Promise<Array<Object>>} — fully enriched records ready for MongoDB
 */
async function runPipeline(rows, sessionId, onProgress) {
  const enriched = await runAgentPipeline(rows, onProgress);

  // Tag each record with the session ID
  return enriched.map((record) => ({
    ...record,
    sessionId,
  }));
}

/**
 * Enrich a single row (used for individual re-processing).
 */
async function enrichRow(row, sessionId) {
  const results = await runPipeline([row], sessionId);
  return results[0];
}

module.exports = { runPipeline, enrichRow };
