/**
 * brandAgent.js — GPT-powered brand resolver agent
 * Intelligently resolves brand names including trademark formatting.
 * Uses gpt-4o-mini for fast brand resolution.
 */

const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_STANDARD || "gpt-4o-mini";

const SYSTEM_PROMPT = `You are an expert at identifying product brands from industrial catalog data.

Your task: Given a product description, part number, manufacturer name, and optional explicit brand fields,
determine the correct canonical brand name with proper trademark symbols.

Rules:
1. If explicit brand fields (E1_Brand, Unilog_Brand, DIB_Brand) are provided and not placeholder values (like "--value--"), use them.
2. Otherwise, identify the brand from the product description or manufacturer name.
3. Use proper trademark formatting: BRAND® or BRAND™ as appropriate.
4. Common brands with ® symbol: DIABLO®, MILWAUKEE®, MIRKA®, HIOLIT®, MAKITA®, DEWALT®, BOSCH®, FRIGIDAIRE®, NORTON®, IRWIN®, TREX®, AZEK®, KICHLER®, FESTOOL®, KREG®, STANLEY®, RIDGID®, RYOBI®, KOHLER®, MOEN®, DELTA®, AMERICAN STANDARD®, SIMPSON STRONG-TIE®, HILTI®
5. Common brands with ™ symbol: 3M™, CUBITRON™
6. If brand cannot be determined, return the manufacturer name without trademark.
7. Source field should be: "explicit_field", "description_keyword", "manufacturer", or "ml_inferred"
8. Return ONLY valid JSON.`;

/**
 * Resolve brands for a batch of products.
 * @param {Array<{mpn, desc, manufacturer, e1Brand, unilogBrand, dibBrand}>} items
 * @returns {Promise<Array<{mpn, brand, brandSource, brandConfident}>>}
 */
async function resolveBrandBatch(items) {
  // First pass: resolve from explicit fields (no API call needed)
  const needsAI = [];
  const results = [];

  for (const item of items) {
    const explicit = resolveExplicitBrand(item);
    if (explicit) {
      results.push({ mpn: item.mpn, ...explicit, _index: item._index });
    } else {
      needsAI.push({ ...item, _origIndex: item._index });
    }
  }

  // Second pass: use GPT for items without explicit brand
  if (needsAI.length > 0) {
    const aiResults = await resolveWithAI(needsAI);
    results.push(...aiResults);
  }

  // Sort back to original order
  results.sort((a, b) => a._index - b._index);
  return results.map(({ _index, ...r }) => r);
}

function resolveExplicitBrand(item) {
  const PLACEHOLDER_RE = /^--.*--$/;
  for (const [field, value] of [
    ["E1_Brand", item.e1Brand],
    ["Unilog_Brand", item.unilogBrand],
    ["DIB_Brand", item.dibBrand],
  ]) {
    if (value && value.trim() && !PLACEHOLDER_RE.test(value.trim())) {
      return {
        brand: value.trim(),
        brandSource: field,
        brandConfident: true,
      };
    }
  }
  return null;
}

async function resolveWithAI(items) {
  const userMessage = `Resolve the brand for each product below. Return a JSON array in the same order.
Each result: "mpn", "brand" (with trademark symbol if applicable), "brandSource" (one of: "description_keyword","manufacturer","ml_inferred"), "brandConfident" (true/false).

Products:
${JSON.stringify(
  items.map((i) => ({
    mpn: i.mpn,
    desc: i.desc,
    manufacturer: i.manufacturer || "",
  })),
  null,
  2
)}

Return ONLY a JSON array.`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const raw = response.choices[0].message.content;
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : Object.values(parsed)[0];

    return items.map((item, i) => ({
      mpn: item.mpn,
      brand: arr[i]?.brand || item.manufacturer || "Unknown",
      brandSource: arr[i]?.brandSource || "manufacturer",
      brandConfident: arr[i]?.brandConfident ?? false,
      _index: item._origIndex,
    }));
  } catch (err) {
    console.error("[BrandAgent] Error:", err.message);
    return items.map((item) => ({
      mpn: item.mpn,
      brand: item.manufacturer || "Unknown",
      brandSource: "manufacturer",
      brandConfident: false,
      _index: item._origIndex,
    }));
  }
}

/**
 * Resolve brand for a single item.
 */
async function resolveBrandOne(item) {
  const results = await resolveBrandBatch([{ ...item, _index: 0 }]);
  return results[0];
}

module.exports = { resolveBrandBatch, resolveBrandOne };
