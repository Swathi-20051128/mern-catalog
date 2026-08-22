/**
 * specLookupAgent.js — Real web-research agent (NEW)
 *
 * Everything else in server/src/agents/* works from the input row's text
 * alone (GPT-4o-mini reasoning over Part_Desc/Part_Manuf/etc). That's why
 * rows like the PDSH4816AF dishwasher sample can never match the reference
 * Delivery Format exactly — "Frigidaire", the real dimensions, the real
 * spec-sheet URL, none of it appears anywhere in the input row's text, so
 * no amount of prompting the existing agents will produce it.
 *
 * This agent is different: it uses OpenAI's Responses API with the hosted
 * `web_search_preview` tool, so the model can actually search the web for
 * "<Mfg_Part_Num> <manufacturer> specifications" and read real product/spec
 * pages before answering — the same kind of lookup a human researcher would
 * do by hand.
 *
 * REQUIREMENTS:
 *   - `openai` npm package >= 4.70.0 (your package.json currently pins
 *     ^4.52.0, which predates Responses API tool support — bump it and
 *     run `npm install`).
 *   - An OpenAI account with the Responses API + web_search_preview tool
 *     enabled (check your OpenAI dashboard — this is a hosted tool, billed
 *     per search in addition to normal token cost).
 *   - Tool/parameter names for hosted web search have changed across SDK
 *     versions — re-check https://platform.openai.com/docs/guides/tools
 *     against whatever `openai` version you install, since this may have
 *     moved since this file was written.
 *
 * COST NOTE: This is a real web search per unique part number, which is
 * slower and far more expensive than the other agents. It dedupes by
 * Mfg_Part_Num (many catalogs have duplicate/variant rows for the same
 * product) so a 1000-row file with, say, 400 unique MPNs only does 400
 * lookups, not 1000 — but 400 live web searches is still a real cost and
 * will take real wall-clock time. Consider running this only for rows
 * flagged `needsReview` after the normal pipeline, rather than every row.
 */

const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_SPEC_LOOKUP || "gpt-4o";

const SYSTEM_PROMPT = `You are a product research assistant. You will be given a
manufacturer part number and a short description from a distributor catalog.
Search the web to find the REAL manufacturer/brand and REAL product specifications
for this exact part number. Only report facts you actually found via search —
never guess or fill in plausible-sounding values.

Return ONLY valid JSON with this shape:
{
  "manufacturerName": "",   // the actual company that makes it, e.g. "Whirlpool Corporation"
  "brandName": "",          // consumer-facing brand with trademark symbol, e.g. "Whirlpool®"
  "mfrUrl": "",             // a real URL to the manufacturer's product/support page
  "specSheetUrl": "",       // real spec sheet / owner's manual PDF URL, if found
  "dimensions": "",         // e.g. "24 in W x 24-1/4 in D x 33-3/4 in H"
  "certifications": "",     // pipe-separated, e.g. "ENERGY STAR Certified|UL Listed"
  "keyFeatures": [],        // array of short feature strings actually found
  "found": true             // false if you could not find reliable data for this part number
}`;

/**
 * Look up real spec data for a batch of unique part numbers.
 * @param {Array<{mpn: string, desc: string, manufacturer: string}>} uniqueItems
 * @returns {Promise<Map<string, object>>} keyed by mpn
 */
async function lookupSpecsForUniqueMpns(uniqueItems) {
  const results = new Map();

  // Sequential, not Promise.all — hosted web-search tool calls are slow and
  // rate-limited; parallelizing 100s of these will just trip rate limits.
  for (const item of uniqueItems) {
    try {
      const response = await client.responses.create({
        model: MODEL,
        tools: [{ type: "web_search_preview" }],
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Part number: ${item.mpn}\nCatalog description: ${item.desc}\nDistributor-listed manufacturer: ${item.manufacturer || "(unknown)"}\n\nFind the real manufacturer, brand, and specs for this part.`,
          },
        ],
      });

      const text = response.output_text || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      results.set(item.mpn, parsed);
    } catch (err) {
      console.error(`[SpecLookupAgent] Failed for ${item.mpn}:`, err.message);
      results.set(item.mpn, { found: false, error: err.message });
    }
  }

  return results;
}

module.exports = { lookupSpecsForUniqueMpns };