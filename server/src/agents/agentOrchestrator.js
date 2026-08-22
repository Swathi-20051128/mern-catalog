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
// Rows per GPT call. Fewer, larger batches means fewer total round-trips
// for the same concurrency — but each batch's JSON response gets bigger,
// so pushing this too high risks the model truncating output mid-response
// (which triggers the fallback for that whole chunk). 10→18 is a moderate
// step up; re-check your Uncategorized/blank-attribute rate after raising
// this, since silent truncation looks identical to a classification miss.
const BATCH_SIZE = Number(process.env.PIPELINE_BATCH_SIZE) || 18;

// How many chunks (10-row groups) to run concurrently. Previously this was
// implicitly 1 — chunks ran one at a time in a for-await loop, so wall time
// was ~100 sequential round-trips for a 1000-row file (1-2 min). Running
// several chunks concurrently cuts that roughly proportionally, since each
// chunk's agent calls are independent of every other chunk's.
// Tune via PIPELINE_CONCURRENCY env var if you hit rate limits — lower it
// (e.g. 2) if you start seeing 429s in the agent error logs, raise it
// (e.g. 8) if your OpenAI tier has headroom and you want it faster still.
const CONCURRENCY = Number(process.env.PIPELINE_CONCURRENCY) || 4;

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
  const allResults = new Array(chunks.length); // pre-sized so order survives concurrency
  let completedRows = 0;

  // Process chunks in bounded-size groups, CONCURRENCY at a time, instead of
  // one at a time. Each group runs in parallel via Promise.all; groups
  // themselves still run one after another so total in-flight requests to
  // OpenAI never exceeds CONCURRENCY chunks' worth. Order is preserved
  // because Promise.all resolves in the same order its inputs were given,
  // and each chunk writes to its own fixed slot in allResults.
  for (let g = 0; g < chunks.length; g += CONCURRENCY) {
    const group = chunks.slice(g, g + CONCURRENCY);

    const groupResults = await Promise.all(
      group.map((chunk, offset) => {
        const chunkIndex = g + offset;
        // Isolate failures per-chunk: if something outside the agents'
        // own try/catch throws unexpectedly, don't let it abort every
        // other chunk still in flight — fall back to unenriched rows
        // for just this chunk instead.
        return processChunk(chunk, chunkIndex, chunks.length).catch((err) => {
          console.error(`[Orchestrator] Chunk ${chunkIndex + 1}/${chunks.length} failed unexpectedly:`, err.message);
          return scoreAll(
            chunk.map((row) => ({
              ...row,
              classpath: "Uncategorized > Needs Manual Classification",
              category: "Uncategorized",
              brand: row.manufacturer || "Unknown",
              brandSource: "manufacturer",
              brandConfident: false,
              itemType: "",
              productAttributes: [],
              attributes: {},
              productName: "", invoiceDesc: "", mobileDesc: "", shortDesc: "",
              longDesc1: row.desc || "", retailDesc: "", marketingDescription: "",
              itemFeatures: [], agentUsed: false, mlUsed: false,
            }))
          );
        });
      })
    );

    groupResults.forEach((chunkResult, offset) => {
      allResults[g + offset] = chunkResult;
      completedRows += chunkResult.length;
    });

    const pct = Math.round((Math.min(g + CONCURRENCY, chunks.length) / chunks.length) * 100);
    if (onProgress) onProgress(pct, `Processed ${completedRows}/${rawRows.length} rows`);

    // Small delay between GROUPS (not every chunk) to stay well under
    // rate limits while still processing CONCURRENCY chunks at once.
    // Tune via PIPELINE_GROUP_DELAY_MS if needed — lower it once you've
    // confirmed higher concurrency isn't hitting 429s, since with fewer/
    // larger batches (BATCH_SIZE above) there are fewer groups total and
    // this delay makes up a bigger share of overall time.
    if (g + CONCURRENCY < chunks.length) {
      await sleep(Number(process.env.PIPELINE_GROUP_DELAY_MS) || 150);
    }
  }

  const flatResults = allResults.flat();
  console.log(`[Orchestrator] Pipeline complete. ${flatResults.length} rows enriched.`);
  return flatResults;
}

module.exports = { runAgentPipeline };