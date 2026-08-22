/**
 * attributeAgent.js — GPT-powered product attribute extractor
 * Extracts structured attributes from product descriptions.
 * Uses gpt-4o-mini for batch extraction.
 */

const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_STANDARD || "gpt-4o-mini";

const SYSTEM_PROMPT = `You are an expert at extracting structured product attributes from industrial catalog descriptions.

For EACH product given, extract relevant attributes based on its type.
Return up to 50 {label, value, uom} triplets per product (uom = unit of measure, empty string if none).

Rules:
1. Extract ONLY attributes that are clearly present in that product's description.
2. Label and value should be clear and concise.
3. Return ONLY valid JSON — no markdown, no explanation.
4. The response must be a single JSON object of the exact shape:
   {"results": [{"mpn": "...", "attributes": [{"label": "...", "value": "...", "uom": "..."}]}]}
   — one entry in "results" per product given, in the same order.`;

/**
 * Extract attributes for a batch of products.
 * @param {Array<{mpn: string, desc: string}>} items
 * @returns {Promise<Array<{mpn: string, attributes: Array<{label, value, uom}>}>>}
 */
async function extractAttributesBatch(items) {
  const userMessage = `Extract product attributes from each description below.

Products:
${JSON.stringify(
  items.map((i) => ({ mpn: i.mpn, desc: i.desc })),
  null,
  2
)}

Return ONLY a JSON object of the shape {"results": [{"mpn":"ABC123","attributes":[{"label": "Diameter", "value": "4.5", "uom": "in"}, {"label": "Grit", "value": "P80", "uom": ""}]}]}`;

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
    // Prefer the documented "results" key; fall back to guessing the first
    // array-valued key for resilience against minor prompt drift.
    const arr = Array.isArray(parsed.results)
      ? parsed.results
      : Array.isArray(parsed)
      ? parsed
      : Object.values(parsed).find((v) => Array.isArray(v));

    if (!Array.isArray(arr)) {
      throw new Error(`Unexpected attribute response shape: ${raw?.slice(0, 200)}`);
    }

    return items.map((item, i) => ({
      mpn: item.mpn,
      attributes: Array.isArray(arr[i]?.attributes) ? arr[i].attributes : [],
    }));
  } catch (err) {
    // Log enough to actually diagnose failures from Render logs — a bare
    // err.message (e.g. "Unexpected token") doesn't tell you WHY every row
    // fell back. err.status/err.code surface auth/rate-limit/quota issues.
    console.error(
      `[AttributeAgent] Error: ${err.message}` +
        (err.status ? ` | status=${err.status}` : "") +
        (err.code ? ` | code=${err.code}` : "")
    );
    return items.map((item) => ({ mpn: item.mpn, attributes: [] }));
  }
}

/**
 * Extract attributes for a single product.
 */
async function extractAttributesOne(item) {
  const results = await extractAttributesBatch([item]);
  return results[0];
}

module.exports = { extractAttributesBatch, extractAttributesOne };