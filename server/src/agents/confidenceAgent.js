/**
 * confidenceAgent.js — Deterministic confidence scoring
 * Computes a 0-100 confidence score based on enrichment quality signals.
 * No API call needed — pure algorithmic scoring.
 */

/**
 * Score confidence for an enriched product record.
 * @param {Object} params
 * @param {boolean} params.hasManufacturer
 * @param {boolean} params.brandConfident
 * @param {boolean} params.classConfident - true if not "Uncategorized"
 * @param {number}  params.attrCount - number of extracted attributes
 * @param {boolean} params.hasAllDescriptions
 * @param {string}  params.brandSource
 * @returns {{ confidence: number, needsReview: boolean, scoreBreakdown: Object }}
 */
function scoreConfidence({
  hasManufacturer = false,
  brandConfident = false,
  classConfident = false,
  attrCount = 0,
  hasAllDescriptions = false,
  brandSource = "",
}) {
  let score = 0;
  const breakdown = {};

  // Manufacturer presence: 20 pts
  if (hasManufacturer) {
    score += 20;
    breakdown.manufacturer = 20;
  } else {
    breakdown.manufacturer = 0;
  }

  // Brand confidence: 25 pts
  if (brandConfident) {
    score += 25;
    breakdown.brand = 25;
  } else if (brandSource === "ml_inferred") {
    score += 10;
    breakdown.brand = 10;
  } else {
    breakdown.brand = 0;
  }

  // Classification: 25 pts (full) or partial
  if (classConfident) {
    score += 25;
    breakdown.classification = 25;
  } else {
    breakdown.classification = 0;
  }

  // Attributes: up to 20 pts (5 pts per attribute, max 4)
  const attrScore = Math.min(20, attrCount * 5);
  score += attrScore;
  breakdown.attributes = attrScore;

  // Descriptions generated: 10 pts
  if (hasAllDescriptions) {
    score += 10;
    breakdown.descriptions = 10;
  } else {
    breakdown.descriptions = 0;
  }

  const confidence = Math.round(Math.min(100, Math.max(0, score)));
  const needsReview = confidence < 60;

  return { confidence, needsReview, scoreBreakdown: breakdown };
}

/**
 * Score an array of enriched records.
 * @param {Array} enrichedItems
 * @returns {Array} — items with confidence and needsReview added
 */
function scoreAll(enrichedItems) {
  return enrichedItems.map((item) => {
    const { confidence, needsReview, scoreBreakdown } = scoreConfidence({
      hasManufacturer: !!item.manufacturer,
      brandConfident: item.brandConfident || false,
      classConfident: item.classpath && !item.classpath.startsWith("Uncategorized"),
      attrCount: Object.keys(item.attributes || {}).length,
      hasAllDescriptions: !!(item.invoiceDesc && item.mobileDesc && item.productTitle && item.longDescription),
      brandSource: item.brandSource || "",
    });
    return { ...item, confidence, needsReview, scoreBreakdown };
  });
}

module.exports = { scoreConfidence, scoreAll };
