/**
 * descriptionAgent.js — GPT-powered product description generator
 * Generates description fields and features for each product.
 * Uses gpt-4o-mini for batch generation.
 */

const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_STANDARD || "gpt-4o-mini";

const SYSTEM_PROMPT = `You are an expert industrial product copywriter specializing in catalog descriptions.
Generate the following fields for each product:

- "productName": Clean product name
- "invoiceDesc": SHORT invoice label, MAX 40 characters, ALL CAPS, key specs only
- "mobileDesc": Mobile/search-friendly description, MAX 80 characters, Title Case, include brand and model
- "shortDesc": Short description, 100-120 characters
- "longDesc1": Full marketing description, 2-3 sentence paragraph
- "retailDesc": Retail description, 80-100 characters
- "marketingDescription": 1-2 sentences of marketing copy
- "itemFeatures": Array of at least 5-10 feature bullets (max 20). Short phrases like '5 Wash Cycles', '120V', 'Stainless Steel'.

Rules:
- Keep each description within its character limit.
- Be accurate — only describe what's in the product data.
- Return ONLY valid JSON — no markdown, no explanation.`;

/**
 * Generate descriptions for a batch of enriched products.
 * @param {Array<{mpn, desc, brand, manufacturer, classpath, attributes, itemType}>} items
 * @returns {Promise<Array<{mpn, productName, invoiceDesc, mobileDesc, shortDesc, longDesc1, retailDesc, marketingDescription, itemFeatures}>>}
 */
async function generateDescriptionsBatch(items) {
  const userMessage = `Generate the fields for each product below.
Return a JSON array in the same order with: "mpn", "productName", "invoiceDesc", "mobileDesc", "shortDesc", "longDesc1", "retailDesc", "marketingDescription", "itemFeatures".

Products:
${JSON.stringify(
  items.map((i) => ({
    mpn: i.mpn,
    originalDesc: i.desc,
    brand: i.brand,
    manufacturer: i.manufacturer,
    classpath: i.classpath,
    attributes: i.attributes,
    itemType: i.itemType,
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
      temperature: 0.3,
    });

    const raw = response.choices[0].message.content;
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : Object.values(parsed)[0];

    if (!Array.isArray(arr)) {
      throw new Error("Unexpected description response shape");
    }

    return items.map((item, i) => ({
      mpn: item.mpn,
      productName: arr[i]?.productName || "",
      invoiceDesc: arr[i]?.invoiceDesc || item.desc?.slice(0, 40).toUpperCase() || "",
      mobileDesc: arr[i]?.mobileDesc || item.desc?.slice(0, 80) || "",
      shortDesc: arr[i]?.shortDesc || item.desc?.slice(0, 120) || "",
      longDesc1: arr[i]?.longDesc1 || item.desc || "",
      retailDesc: arr[i]?.retailDesc || item.desc?.slice(0, 100) || "",
      marketingDescription: arr[i]?.marketingDescription || item.desc || "",
      itemFeatures: Array.isArray(arr[i]?.itemFeatures) ? arr[i].itemFeatures : [],
    }));
  } catch (err) {
    console.error("[DescriptionAgent] Error:", err.message);
    return items.map((item) => ({
      mpn: item.mpn,
      productName: "",
      invoiceDesc: (item.desc || "").slice(0, 40).toUpperCase(),
      mobileDesc: (item.desc || "").slice(0, 80),
      shortDesc: (item.desc || "").slice(0, 120),
      longDesc1: item.desc || "",
      retailDesc: (item.desc || "").slice(0, 100),
      marketingDescription: item.desc || "",
      itemFeatures: [],
    }));
  }
}

/**
 * Generate descriptions for a single product.
 */
async function generateDescriptionsOne(item) {
  const results = await generateDescriptionsBatch([item]);
  return results[0];
}

/**
 * Derive a simple item type from description (no API call).
 */
function deriveItemType(desc, brand) {
  if (!desc) return "Item";
  let t = desc;
  t = t.replace(/^[A-Z0-9.\-/]+\s+/, "");
  if (brand) t = t.replace(new RegExp(brand.replace(/[®™]/g, "").trim(), "gi"), "");
  t = t.replace(/\d+(?:-\d+\/\d+|\.\d+|\/\d+)?\s*[""]?\s*x\s*\d+(?:-\d+\/\d+|\.\d+|\/\d+)?\s*(mm|[""])?/gi, "");
  t = t.replace(/\bP\d{2,4}\b/gi, "");
  t = t.replace(/\b\d+\s?pc\b/gi, "");
  t = t.replace(/[-#]+/g, " ").replace(/\s{2,}/g, " ").trim();
  t = t.replace(/^[\s,-]+|[\s,-]+$/g, "");
  return t || "Item";
}

module.exports = { generateDescriptionsBatch, generateDescriptionsOne, deriveItemType };
