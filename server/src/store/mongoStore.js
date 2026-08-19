/**
 * mongoStore.js — MongoDB-only data access layer (v2)
 * No in-memory fallback. MongoDB is required.
 * All records are scoped to a sessionId.
 */

const mongoose = require("mongoose");
const Record  = require("../models/Record");
const Session = require("../models/Session");

let connected = false;

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set in .env. MongoDB is required in CatalogIQ v2.\n" +
      "  Local:  MONGODB_URI=mongodb://127.0.0.1:27017/catalogiq\n" +
      "  Atlas:  MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/catalogiq"
    );
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 6000 });
  connected = true;
  console.log("[db] Connected to MongoDB ✓");
  return true;
}

function isConnected() {
  return connected;
}

// ── Session operations ────────────────────────────────────────────────────────

async function createSession(data) {
  const session = await Session.create(data);
  return session.toObject();
}

async function updateSession(sessionId, update) {
  const updated = await Session.findByIdAndUpdate(sessionId, update, { new: true }).lean();
  return updated;
}

async function getAllSessions() {
  return Session.find({}).sort({ createdAt: -1 }).lean();
}

async function getSession(sessionId) {
  return Session.findById(sessionId).lean();
}

async function deleteSession(sessionId) {
  await Promise.all([
    Session.findByIdAndDelete(sessionId),
    Record.deleteMany({ sessionId }),
  ]);
}

// ── Record operations ─────────────────────────────────────────────────────────

async function insertRecords(records) {
  const docs = await Record.insertMany(records, { ordered: false });
  return docs.map(toPlain);
}

async function findRecords({ sessionId, search, category, needsReview, page = 1, limit = 50 } = {}) {
  const q = {};
  if (sessionId) q.sessionId = sessionId;
  if (category) q.category = category;
  if (needsReview === "true" || needsReview === true) q.needsReview = true;
  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    q.$or = [{ mpn: re }, { originalDescription: re }, { brand: re }, { manufacturer: re }];
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Record.find(q).sort({ confidence: -1 }).skip(skip).limit(Number(limit)).lean(),
    Record.countDocuments(q),
  ]);
  return { items: items.map(toPlain), total };
}

async function findRecordById(id) {
  const doc = await Record.findById(id).lean();
  return doc ? toPlain(doc) : null;
}

async function getAllRecordsBySession(sessionId) {
  return Record.find({ sessionId }).lean().then((docs) => docs.map(toPlain));
}

async function computeSessionStats(sessionId) {
  const rows = await getAllRecordsBySession(sessionId);
  const total = rows.length;
  if (total === 0) {
    return {
      total: 0,
      needsReview: 0,
      avgConfidence: 0,
      categorized: 0,
      categorizedPct: 0,
      withAttrs: 0,
      withAttrsPct: 0,
      needsReviewPct: 0,
      categoryBreakdown: [],
      confidenceBuckets: [],
    };
  }

  const needsReview  = rows.filter((r) => r.needsReview).length;
  const avgConfidence = Math.round(rows.reduce((s, r) => s + (r.confidence || 0), 0) / total);
  const categorized  = rows.filter((r) => r.classpath && !r.classpath.startsWith("Uncategorized")).length;
  const withAttrs    = rows.filter((r) => Object.keys(r.attributes || {}).length > 0).length;

  const byCategory = {};
  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }
  const categoryBreakdown = Object.entries(byCategory)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const confidenceBuckets = [
    { name: "High (75-100%)", count: rows.filter((r) => r.confidence >= 75).length },
    { name: "Medium (50-74%)", count: rows.filter((r) => r.confidence >= 50 && r.confidence < 75).length },
    { name: "Low (0-49%)",  count: rows.filter((r) => r.confidence < 50).length },
  ];

  return {
    total,
    needsReview,
    avgConfidence,
    categorized,
    categorizedPct: Math.round((categorized / total) * 100),
    withAttrs,
    withAttrsPct: Math.round((withAttrs / total) * 100),
    needsReviewPct: Math.round((needsReview / total) * 100),
    categoryBreakdown,
    confidenceBuckets,
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function toPlain(doc) {
  const { _id, __v, ...rest } = doc;
  return { _id: String(_id), ...rest };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  connect,
  isConnected,
  createSession,
  updateSession,
  getAllSessions,
  getSession,
  deleteSession,
  insertRecords,
  findRecords,
  findRecordById,
  getAllRecordsBySession,
  computeSessionStats,
};
