/**
 * attributeAgent.js — GPT-powered product attribute extractor
 * Extracts structured attributes from product descriptions.
 * Uses gpt-4o-mini for batch extraction.
 */

const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_STANDARD || "gpt-4o-mini";

const SYSTEM_PROMPT = `You are an expert at extracting structured product attributes from industrial catalog descriptions.

Extract relevant attributes based on the product type.
Return an array of up to 50 triplets containing {label, value, uom} (unit of measure).

Rules:
1. Extract ONLY attributes that are clearly present in the description.
2. Put the unit (if any) in the 'uom' field. If no unit, use an empty string.
3. Label and value should be clear and concise.
4. Return ONLY valid JSON — no markdown, no explanation.
5. The response must be an object with an "attributes" array.`;

/**
 * Extract attributes for a batch of products.
 * @param {Array<{mpn: string, desc: string}>} items
 * @returns {Promise<Array<{mpn: string, attributes: Array<{label, value, uom}>}>>}
 */
async function extractAttributesBatch(items) {
  const userMessage = `Extract product attributes from each description below.
Return a JSON array in the same order. Each item: "mpn" and "attributes" (array of {label, value, uom}).

Products:
${JSON.stringify(
  items.map((i) => ({ mpn: i.mpn, desc: i.desc })),
  null,
  2
)}

Example response:
[
  {"mpn":"ABC123","attributes":[{"label": "Diameter", "value": "4.5", "uom": "in"}, {"label": "Grit", "value": "P80", "uom": ""}]}
]

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

    if (!Array.isArray(arr)) {
      throw new Error("Unexpected attribute response shape");
    }

    return items.map((item, i) => ({
      mpn: item.mpn,
      attributes: Array.isArray(arr[i]?.attributes) ? arr[i].attributes : [],
    }));
  } catch (err) {
    console.error("[AttributeAgent] Error:", err.message);
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
