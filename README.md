# CatalogIQ — MERN Product Intelligence Dashboard

A full MERN-stack rebuild of the UniHack catalog enrichment pipeline: **M**ongoDB (optional,
falls back to in-memory), **E**xpress API, **R**eact dashboard, **N**ode.js.

Takes raw, messy distributor catalog rows and produces standardized, search-ready product
records — resolved manufacturer & brand, classpath, extracted attributes, unit-normalized
values, four description formats (Invoice/Mobile/Title/Long), and a per-row confidence score
with a "needs review" flag — then serves it all through a real API and a proper dashboard UI.

## Project structure

```
mern-catalogiq/
├── server/     Express API + enrichment pipeline (Node.js)
└── client/     React dashboard (Vite + Tailwind)
```

## Requirements

- Node.js 18+ and npm (check with `node -v` and `npm -v`)
- MongoDB is **optional** — the app runs immediately with a built-in in-memory store if you
  don't configure one. Set `MONGODB_URI` in `server/.env` to persist data instead.

## Run it — two terminals

**Terminal 1 — backend**
```bash
cd server
npm install
npm run dev
```
This starts the API on `http://localhost:5000`, and on first boot automatically enriches and
seeds the bundled 1,000-row UniHack sample dataset — nothing to upload manually to see it
working.

**Terminal 2 — frontend**
```bash
cd client
npm install
npm run dev
```
This starts the dashboard on `http://localhost:5173`. It proxies `/api/*` requests to the
backend on port 5000, so open **http://localhost:5173** in your browser.

That's it — you should see the dashboard populated with 1,000 enriched records immediately.

## Optional: connect MongoDB

By default the app uses an in-memory store (data resets each time the server restarts). To
persist data in MongoDB instead:

```bash
cd server
cp .env.example .env
```
Then edit `.env` and set `MONGODB_URI`, e.g.:
```
MONGODB_URI=mongodb://127.0.0.1:27017/catalogiq
```
or an Atlas connection string:
```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/catalogiq
```
Restart the server — it will detect the URI, connect, and seed the sample data into MongoDB
on first boot. The dashboard's top-right badge shows which storage mode is active ("MongoDB"
vs "In-memory store").

## What the dashboard gives you

- **Dashboard** — total records, average confidence, % classified, % with extracted
  attributes, % flagged for review, a category breakdown chart, and a confidence distribution
  chart.
- **Catalog** — full searchable, filterable (by category), paginated table of every enriched
  record. Click any row to open a detail drawer with the original input side-by-side with all
  four generated description formats, resolved manufacturer/brand, classpath, and extracted
  attributes.
- **Review Queue** — the same table pre-filtered to rows the pipeline flagged below the
  confidence threshold, so a human reviewer can work through exactly what needs attention.
- **Upload / Ingest** — drag-and-drop a new CSV (same 6-column shape as the UniHack sample:
  `Mfg_Part_Num, Part_Desc, E1_Brand, Unilog_Brand, DIB_Brand, Part_Manuf`) to replace the
  current dataset, running the full enrichment pipeline server-side. A "Reset to sample" button
  reloads the original 1,000-row demo dataset at any time.
- **Export CSV** — downloads the full enriched dataset (all rows, not just the current page).

## API reference

| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | Health check + storage mode |
| GET | `/api/stats` | Dashboard aggregate metrics |
| GET | `/api/records` | List records — query params: `search`, `category`, `needsReview`, `page`, `limit` |
| GET | `/api/records/:id` | Single record detail |
| GET | `/api/records/export/csv` | Download full enriched dataset as CSV |
| POST | `/api/upload` | Upload a CSV (`multipart/form-data`, field `file`) — replaces the dataset |
| POST | `/api/upload/reset-sample` | Reload the bundled 1,000-row sample dataset |

## The enrichment pipeline (`server/src/pipeline/enrichmentPipeline.js`)

Same rules-engine approach as the earlier zero-install prototype, expanded with a few more
categories (decking/Trex/Azek, lighting/Kichler, appliances, safety gloves) since that's what
dominates the sample data:

1. **Placeholder cleaning** — strips `-- Unbranded --` / `-- No Unilog Brand --` / `-- No DIB
   Brand --`.
2. **Manufacturer parsing** — splits `"Freud Inc (2435)"` into name + code.
3. **Brand resolution** — brand fields in priority order → description keyword match →
   manufacturer-name fallback (per the content-guideline rule).
4. **Classification** — keyword rules mapping description text to a classpath.
5. **Attribute extraction** — regex-based grit, pack quantity, dimension chains, material,
   voltage/amperage, length.
6. **Unit normalization** — approved abbreviation table + decimal↔fraction lookup.
7. **Description generation** — Invoice (≤40 char, CAPS), Mobile (~60–80 char), Product Title,
   Long Description.
8. **Confidence scoring** — weighted across manufacturer/brand/classification/attribute yield;
   rows under 60% are flagged `needsReview`.

### Honest scope note

The classification/material/brand dictionaries here are a curated subset standing in for the
full reference files from the challenge brief (27k-row manufacturer/brand list, 161k-row LOV,
~500-row UOM table). Run the dashboard and you'll see roughly a third of the sample lands
outside the demo category set and is flagged `Uncategorized` — visible directly in the stats,
not hidden. To widen coverage, extend `BRAND_KEYWORDS`, `CLASSIFICATION_RULES`,
`MATERIAL_MAP`, `UOM_MAP`, or `FRACTIONS` at the top of `enrichmentPipeline.js`, ideally backed
by the real manufacturer/brand list and LOV spreadsheets (parse them to JSON the same way
`server/src/data/sample-input.json` was generated from the input CSV).

No field-level accuracy scoring against the labeled ground truth is wired up yet — the
Delivery Format CSV provided so far only contains 1 worked example row, not the full 200. Once
you have the full ground-truth sheet, add an evaluation route that joins on `Mfg_Part_Num` and
diffs each generated field against the corresponding ground-truth column.

## Production build

```bash
cd client
npm run build
```
Outputs a static bundle to `client/dist/` — serve it with any static host, or add an
`express.static` line in `server/src/index.js` pointing at `client/dist` to serve the frontend
from the same Express server in production.

## Team split suggestion (4 members)

- **Backend/pipeline owner** — extend `pipeline/enrichmentPipeline.js` with the real
  LOV/manufacturer files.
- **Frontend owner** — polish `client/src/pages` and `components`, add more chart views.
- **Evaluation owner** — build the ground-truth diff/scoring route once the full 200-row sheet
  is available.
- **Data/DB owner** — wire up MongoDB Atlas, seed scripts, and any additional collections
  (e.g. audit log of manual review decisions).
"# mern-catalog" 
