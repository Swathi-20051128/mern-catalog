/**
 * records.js — Session-scoped records route (v2)
 * All record queries require a sessionId.
 */

const express = require("express");
const store   = require("../store/mongoStore");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { sessionId, search, category, needsReview, page = 1, limit = 50 } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId query parameter is required." });
    }

    const { items, total } = await store.findRecords({
      sessionId,
      search,
      category,
      needsReview,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/export/csv", async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId query parameter is required." });
    }

    const rows = await store.getAllRecordsBySession(sessionId);
    const session = await store.getSession(sessionId);

    // Exact output columns requested in exact order
    const cols = [
      "MFR URL", "Ref URL 1", "PART_NUMBER", "Dept", "Class", "Fine", 
      "SKU - MY_PART_NUMBER", "Mfg_Part_Num", "Part_Desc", "E1_Brand", "Unilog_Brand", "DIB_Brand", "Part_Manuf",
      "MANUFACTURER_NAME", "BRAND_NAME", "TRADE_NAME", "MANUFACTURER_PART_NUMBER", "ALTERNATE_PART_NUMBER",
      "Classpath", "MOBILE_DESC", "INVOICE_DESC", "SHORT_DESC", "LONG_DESC1", "RETAIL_DESC", "MARKETING_DESCRIPTION"
    ];

    for (let i = 1; i <= 20; i++) {
      cols.push(`ITEM_FEATURES_${i}`);
    }

    cols.push("With", "Standard/Approvals", "Prop 65", "Application", "Includes", "Product Name");

    for (let i = 1; i <= 50; i++) {
      cols.push(`ATTRIBUTE_LABEL ${i}`, `ATTRIBUTE_VALUE ${i}`, `ATTRIBUTE_UOM ${i}`);
    }

    cols.push(
      "UPC", "EAN", "GTIN", "UNSPSC", "Warranty", "List Price", "Selling Qty", "Selling UOM",
      "LENGTH", "LENGTH_UOM", "HEIGHT", "HEIGHT_UOM", "WIDTH", "WIDTH_UOM", 
      "WEIGHT", "WEIGHT_UOM", "VOLUME", "VOLUME_UOM", "Country Of Origin", "Discontinued", "Actual Image (Yes/No)"
    );

    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    const lines = [cols.join(",")];
    for (const r of rows) {
      const rowMap = {
        "Mfg_Part_Num": r.mpn,
        "Part_Desc": r.originalDescription,
        "Part_Manuf": r.manufacturer,
        "MANUFACTURER_NAME": r.manufacturerName || r.manufacturer,
        "BRAND_NAME": r.brandName || r.brand,
        "TRADE_NAME": r.tradeName,
        "MANUFACTURER_PART_NUMBER": r.mpn,
        "ALTERNATE_PART_NUMBER": r.alternatePartNumber,
        "Classpath": r.classpath,
        "MOBILE_DESC": r.mobileDesc,
        "INVOICE_DESC": r.invoiceDesc,
        "SHORT_DESC": r.shortDesc,
        "LONG_DESC1": r.longDesc1,
        "RETAIL_DESC": r.retailDesc,
        "MARKETING_DESCRIPTION": r.marketingDescription,
        "With": r.withField,
        "Standard/Approvals": r.standardApprovals,
        "Prop 65": r.prop65,
        "Application": r.application,
        "Includes": r.includes,
        "Product Name": r.productName,
        "UPC": r.upc, "EAN": r.ean, "GTIN": r.gtin, "UNSPSC": r.unspsc,
        "Warranty": r.warranty, "List Price": r.listPrice,
        "Selling Qty": r.sellingQty, "Selling UOM": r.sellingUom,
        "LENGTH": r.dimensions?.length, "LENGTH_UOM": r.dimensions?.lengthUom,
        "HEIGHT": r.dimensions?.height, "HEIGHT_UOM": r.dimensions?.heightUom,
        "WIDTH": r.dimensions?.width, "WIDTH_UOM": r.dimensions?.widthUom,
        "WEIGHT": r.dimensions?.weight, "WEIGHT_UOM": r.dimensions?.weightUom,
        "VOLUME": r.dimensions?.volume, "VOLUME_UOM": r.dimensions?.volumeUom,
      };

      // Fill in features
      for (let i = 1; i <= 20; i++) {
        rowMap[`ITEM_FEATURES_${i}`] = r.itemFeatures && r.itemFeatures[i - 1] ? r.itemFeatures[i - 1] : "";
      }

      // Fill in attributes
      for (let i = 1; i <= 50; i++) {
        const attr = r.productAttributes && r.productAttributes[i - 1] ? r.productAttributes[i - 1] : null;
        rowMap[`ATTRIBUTE_LABEL ${i}`] = attr ? attr.label : "";
        rowMap[`ATTRIBUTE_VALUE ${i}`] = attr ? attr.value : "";
        rowMap[`ATTRIBUTE_UOM ${i}`] = attr ? attr.uom : "";
      }

      const line = cols.map(c => esc(rowMap[c] || ""));
      lines.push(line.join(","));
    }

    const filename = session?.filename?.replace(/\.[^.]+$/, "") || "export";
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}_enriched.csv"`);
    res.send(lines.join("\n"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const record = await store.findRecordById(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found." });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
