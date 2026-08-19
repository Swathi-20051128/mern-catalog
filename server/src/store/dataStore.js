/* Data-access layer. Uses MongoDB via Mongoose when MONGODB_URI is set and
   reachable; otherwise falls back to an in-memory array so the app runs
   with zero external setup. Same interface either way. */

const mongoose = require("mongoose");
const Record = require("../models/Record");

let usingMongo = false;
let memoryStore = [];
let memoryId = 1;

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("[db] No MONGODB_URI set — using in-memory store (data resets on restart).");
    return false;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
    usingMongo = true;
    console.log("[db] Connected to MongoDB.");
    return true;
  } catch (err) {
    console.warn("[db] Could not connect to MongoDB (" + err.message + ") — falling back to in-memory store.");
    usingMongo = false;
    return false;
  }
}

async function clearAll() {
  if (usingMongo) {
    await Record.deleteMany({});
  } else {
    memoryStore = [];
    memoryId = 1;
  }
}

async function insertMany(records) {
  if (usingMongo) {
    const docs = await Record.insertMany(records);
    return docs.map(toPlain);
  }
  const inserted = records.map((r) => ({ _id: String(memoryId++), ...r }));
  memoryStore.push(...inserted);
  return inserted;
}

async function findAll({ search, category, needsReview, page = 1, limit = 50 } = {}) {
  if (usingMongo) {
    const q = {};
    if (category) q.category = category;
    if (needsReview === "true") q.needsReview = true;
    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      q.$or = [{ mpn: re }, { originalDescription: re }, { brand: re }, { manufacturer: re }];
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Record.find(q).skip(skip).limit(Number(limit)).lean(),
      Record.countDocuments(q),
    ]);
    return { items: items.map(toPlain), total };
  }

  let items = memoryStore;
  if (category) items = items.filter((r) => r.category === category);
  if (needsReview === "true") items = items.filter((r) => r.needsReview);
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(
      (r) =>
        r.mpn?.toLowerCase().includes(s) ||
        r.originalDescription?.toLowerCase().includes(s) ||
        r.brand?.toLowerCase().includes(s) ||
        r.manufacturer?.toLowerCase().includes(s)
    );
  }
  const total = items.length;
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + Number(limit));
  return { items: paged, total };
}

async function findById(id) {
  if (usingMongo) {
    const doc = await Record.findById(id).lean();
    return doc ? toPlain(doc) : null;
  }
  return memoryStore.find((r) => r._id === id) || null;
}

async function all() {
  if (usingMongo) {
    const docs = await Record.find({}).lean();
    return docs.map(toPlain);
  }
  return memoryStore;
}

function toPlain(doc) {
  const { _id, __v, ...rest } = doc;
  return { _id: String(_id), ...rest };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { connect, clearAll, insertMany, findAll, findById, all, isUsingMongo: () => usingMongo };
