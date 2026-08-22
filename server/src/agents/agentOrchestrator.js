/**
 * agentOrchestrator.js — Coordinates all AI agents for product enrichment
 *
 * Pipeline order:
 *   1. Parse manufacturer from Part_Manuf field
 *   2. ClassifierAgent — classpath + category
 *   3. BrandAgent — brand resolution
 *   4. AttributeAgent — attribute extraction
 *   5. DescriptionAgent — generate 4 description formats
 *   6. ConfidenceAgent — score and flag for review
 *
 * Processes rows in batches of BATCH_SIZE to respect rate limits.
 * Uses gpt-4o-mini for standard items, gpt-4o for re-evaluation of
 * items that score below the review threshold.
 */

const { classifyBatch }            = require("./classifierAgent");
const { resolveBrandBatch }        = require("./brandAgent");
const { extractAttributesBatch }   = require("./attributeAgent");
const { generateDescriptionsBatch, deriveItemType } = require("./descriptionAgent");
const { scoreAll }                 = require("./confidenceAgent");
const BATCH_SIZE = 10; // rows per GPT call (balance speed vs token limit)
// ── Helpers ──────────────────────────────────────────────────────────────────

const PLACEHOLDER_RE = /^--.*--$/;

function isPlaceholder(v) {
  return !v || PLACEHOLDER_RE.test(String(v).trim());
}

function parseManufacturer(partManuf) {
  if (!partManuf) return { name: "", code: "" };
  const m = String(partManuf).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { name: m[1].trim(), code: m[2].trim() };
  return { name: String(partManuf).trim(), code: "" };
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Normalize raw CSV/Excel row to internal format ────────────────────────────

function normalizeRow(row, index) {
  const mpn  = String(row.Mfg_Part_Num || row.mpn || row["Part Number"] || "").trim();
  const desc = String(row.Part_Desc    || row.description || row.Description || row.desc || "").trim();
  const { name: manufacturer, code: manufacturerCode } = parseManufacturer(
    row.Part_Manuf || row.Manufacturer || row.manufacturer || ""
  );

  return {
    _rowIndex: index,
    mpn,
    desc,
    manufacturer,
    manufacturerCode,
    e1Brand:      String(row.E1_Brand      || "").trim(),
    unilogBrand:  String(row.Unilog_Brand  || "").trim(),
    dibBrand:     String(row.DIB_Brand     || "").trim(),
    originalDescription: desc,
  };
}

// ── Process a chunk through all agents ────────────────────────────────────────

async function processChunk(chunk, chunkIndex, totalChunks) {
  const label = `[Orchestrator] Chunk ${chunkIndex + 1}/${totalChunks}`;
  console.log(`${label} — ${chunk.length} rows — running agents...`);

  // Prepare input arrays for agents
  const classifierInput = chunk.map((r) => ({
    mpn: r.mpn,
    desc: r.desc,
    manufacturer: r.manufacturer,
    _index: r._rowIndex,
  }));

  const brandInput = chunk.map((r, i) => ({
    mpn: r.mpn,
    desc: r.desc,
    manufacturer: r.manufacturer,
    e1Brand: r.e1Brand,
    unilogBrand: r.unilogBrand,
    dibBrand: r.dibBrand,
    _index: i,
  }));

  // Run Classifier and Brand in parallel (independent)
  const [classResults, brandResults] = await Promise.all([
    classifyBatch(classifierInput),
    resolveBrandBatch(brandInput),
  ]);

  // Build intermediate enriched items for attribute & description agents
  const midItems = chunk.map((row, i) => {
    const cls   = classResults[i]  || {};
    const brand = brandResults[i]  || {};
    return {
      ...row,
      classpath:      cls.classpath    || "Uncategorized > Needs Manual Classification",
      category:       cls.category     || "Uncategorized",
      classConfidenceHint: cls.confidence_hint || "low",
      brand:          brand.brand      || row.manufacturer || "Unknown",
      brandSource:    brand.brandSource || "manufacturer",
      brandConfident: brand.brandConfident ?? false,
      itemType:       deriveItemType(row.desc, brand.brand),
    };
  });

  // Run Attribute and Description agents in parallel
  const attrInput = midItems.map((r) => ({ mpn: r.mpn, desc: r.desc }));
  const descInput = midItems.map((r) => ({
    mpn: r.mpn,
    desc: r.desc,
    brand: r.brand,
    manufacturer: r.manufacturer,
    classpath: r.classpath,
    attributes: {}, // will be filled after attrAgent
    itemType: r.itemType,
  }));

  const [attrResults, descResults] = await Promise.all([
    extractAttributesBatch(attrInput),
    generateDescriptionsBatch(descInput),
  ]);

  // Merge all agent results
  const merged = midItems.map((row, i) => ({
    mpn:                 row.mpn,
    originalDescription: row.originalDescription,
    manufacturer:        row.manufacturer,
    manufacturerCode:    row.manufacturerCode,
    e1Brand:             row.e1Brand,
    unilogBrand:         row.unilogBrand,
    dibBrand:            row.dibBrand,
    brand:               row.brand,
    brandSource:         row.brandSource,
    brandConfident:      row.brandConfident,
    classpath:           row.classpath,
    category:            row.category,
    itemType:            row.itemType,
    productAttributes:   attrResults[i]?.attributes || [],
    attributes:          {}, // Backward compat
    productName:         descResults[i]?.productName    || "",
    invoiceDesc:         descResults[i]?.invoiceDesc    || "",
    mobileDesc:          descResults[i]?.mobileDesc     || "",
    shortDesc:           descResults[i]?.shortDesc      || "",
    longDesc1:           descResults[i]?.longDesc1      || "",
    retailDesc:          descResults[i]?.retailDesc     || "",
    marketingDescription: descResults[i]?.marketingDescription || "",
    itemFeatures:        descResults[i]?.itemFeatures   || [],
    agentUsed:           true,
    mlUsed:              false,
  }));

  // Score confidence for all rows in this chunk
  const scored = scoreAll(merged);

  console.log(`${label} — done. ✓`);
  return scored;
}

// ── Main orchestrator function ─────────────────────────────────────────────────

/**
 * Run the full AI agent pipeline on an array of raw product rows.
 * @param {Array<Object>} rawRows — rows from CSV/Excel upload
 * @param {Function} [onProgress] — optional callback(percent, message)
 * @returns {Promise<Array<Object>>} — array of fully enriched records
 */
async function runAgentPipeline(rawRows, onProgress) {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your_openai_api_key_here") {
    throw new Error("OPENAI_API_KEY is not configured. Please set it in server/.env");
  }

  console.log(`[Orchestrator] Starting pipeline for ${rawRows.length} rows...`);

  // Normalize rows
  const normalized = rawRows.map(normalizeRow);

  // Split into chunks
  const chunks = chunkArray(normalized, BATCH_SIZE);
  const allResults = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkResult = await processChunk(chunks[i], i, chunks.length);
    allResults.push(...chunkResult);

    const pct = Math.round(((i + 1) / chunks.length) * 100);
    if (onProgress) onProgress(pct, `Processed ${allResults.length}/${rawRows.length} rows`);

    // Small delay between chunks to avoid rate-limit hits
    if (i < chunks.length - 1) {
      await sleep(300);
    }
  }

  console.log(`[Orchestrator] Pipeline complete. ${allResults.length} rows enriched.`);
  return allResults;
}

module.exports = { runAgentPipeline };