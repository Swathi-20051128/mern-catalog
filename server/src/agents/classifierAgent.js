/**
 * classifierAgent.js — GPT-powered product classification agent
 * Uses gpt-4o-mini for fast batch classification.
 * Returns classpath and top-level category for each product.
 */

const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_STANDARD || "gpt-4o-mini";

const SYSTEM_PROMPT = `You are an expert industrial product catalog classifier. 
Your task is to classify product descriptions into a hierarchical category path.

Use this taxonomy (choose the most specific match):
- Abrasives > Coated Abrasives > Sanding Discs
- Abrasives > Coated Abrasives > Sanding Belts
- Abrasives > Coated Abrasives > Sanding Sheets
- Abrasives > Bonded Abrasives > Cut-Off Wheels
- Abrasives > Bonded Abrasives > Grinding Wheels
- Appliances & Consumer Electronics > Kitchen Appliances > Built-In Dishwashers
- Appliances & Consumer Electronics > Kitchen Appliances > Refrigerators
- Appliances & Consumer Electronics > Kitchen Appliances > Ranges
- Appliances & Consumer Electronics > Laundry > Dryers
- Appliances & Consumer Electronics > Laundry > Washing Machines
- Building Materials > Decking > Composite Decking Boards
- Building Materials > Decking > Fascia Boards
- Building Materials > Decking > Railing
- Building Materials > Decking > Balusters
- Building Materials > Lumber & Boards
- Building Materials > Roofing
- Electrical > Wiring & Cable
- Electrical > Switches & Outlets
- Fasteners > Bolts & Screws
- Fasteners > Nuts & Washers
- Fasteners > Anchors
- Hand Tools > Measuring & Layout
- Hand Tools > Cutting
- Hand Tools > Striking
- Hardware > Door Hardware > Locks
- Hardware > Door Hardware > Hinges
- Kitchen & Bath > Fixtures > Sink Faucets
- Kitchen & Bath > Fixtures > Shower Fixtures
- Kitchen & Bath > Sinks
- Lighting > Fixtures > Interior Lighting
- Lighting > Fixtures > Exterior Lighting
- Lighting > Bulbs & Lamps
- Paint & Coatings > Paints > Interior Paint
- Paint & Coatings > Primers
- Plumbing > Fittings > Couplings
- Plumbing > Fittings > Elbows
- Plumbing > Fittings > Tees
- Plumbing > Valves
- Plumbing > Pipes & Tubing
- Power Tool Accessories > Drilling > Drill Bits
- Power Tool Accessories > Cutting > Blades
- Power Tool Accessories > Cutting > Saw Blades
- Safety & PPE > Hand Protection > Gloves
- Safety & PPE > Eye & Face Protection
- Safety & PPE > Respiratory Protection
- HVAC > Filters
- HVAC > Ductwork
- Uncategorized > Needs Manual Classification

Rules:
- Return ONLY valid JSON, no markdown, no explanation.
- If unsure, use "Uncategorized > Needs Manual Classification".
- Be consistent and precise.`;

/**
 * Classify a batch of product descriptions.
 * @param {Array<{mpn: string, desc: string, manufacturer: string}>} items
 * @returns {Promise<Array<{mpn: string, classpath: string, category: string, confidence_hint: string}>>}
 */
async function classifyBatch(items) {
  const userMessage = `Classify each of the following products. Return a JSON array with the same order as input.
Each item should have: "mpn", "classpath", "category" (first segment of classpath), "confidence_hint" ("high"|"medium"|"low").

Products to classify:
${JSON.stringify(
  items.map((i) => ({ mpn: i.mpn, desc: i.desc, manufacturer: i.manufacturer || "" })),
  null,
  2
)}

Return ONLY a JSON array, example:
[{"mpn":"ABC123","classpath":"Abrasives > Coated Abrasives > Sanding Discs","category":"Abrasives","confidence_hint":"high"}]`;

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

    // Handle both array response and {results: [...]} response
    const results = Array.isArray(parsed) ? parsed : parsed.results || parsed.classifications || Object.values(parsed)[0];

    if (!Array.isArray(results)) {
      throw new Error("Unexpected response shape from classifier");
    }

    return results;
  } catch (err) {
    console.error("[ClassifierAgent] Error:", err.message);
    // Return fallback for all items
    return items.map((i) => ({
      mpn: i.mpn,
      classpath: "Uncategorized > Needs Manual Classification",
      category: "Uncategorized",
      confidence_hint: "low",
    }));
  }
}

/**
 * Classify a single product item.
 */
async function classifyOne(item) {
  const results = await classifyBatch([item]);
  return results[0];
}

module.exports = { classifyBatch, classifyOne };
