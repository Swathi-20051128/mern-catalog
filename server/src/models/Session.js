const mongoose = require("mongoose");

/**
 * Session — tracks each CSV/Excel upload session.
 * Each upload creates a new session; all records belong to a session.
 */
const SessionSchema = new mongoose.Schema(
  {
    filename:     { type: String, required: true },
    originalName: { type: String, default: "" },
    fileType:     { type: String, enum: ["csv", "xlsx", "xls"], default: "csv" },
    rowCount:     { type: Number, default: 0 },
    processedCount: { type: Number, default: 0 },

    // Processing status
    status: {
      type: String,
      enum: ["uploading", "processing", "done", "error"],
      default: "uploading",
    },
    errorMessage: { type: String, default: "" },
    processingStartedAt: { type: Date },
    processingCompletedAt: { type: Date },

    // Aggregated stats (cached for fast dashboard loading)
    stats: {
      avgConfidence:   { type: Number, default: 0 },
      categorized:     { type: Number, default: 0 },
      needsReview:     { type: Number, default: 0 },
      withAttrs:       { type: Number, default: 0 },
      categoryBreakdown: { type: mongoose.Schema.Types.Mixed, default: [] },
      confidenceBuckets: { type: mongoose.Schema.Types.Mixed, default: [] },
    },
  },
  { timestamps: true }
);

SessionSchema.index({ createdAt: -1 });
SessionSchema.index({ status: 1 });

module.exports = mongoose.model("Session", SessionSchema);
