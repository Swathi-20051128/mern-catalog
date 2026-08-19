const mongoose = require("mongoose");

const RecordSchema = new mongoose.Schema(
  {
    // Session association
    sessionId: { type: String, required: true, index: true },

    // Core product fields
    mpn:                 { type: String, default: "" },
    originalDescription: { type: String, default: "" },
    manufacturer:        { type: String, default: "" },
    manufacturerCode:    { type: String, default: "" },

    // AI-resolved brand and related new fields
    brand:          { type: String, default: "" },
    brandSource:    { type: String, default: "" },
    brandConfident: { type: Boolean, default: false },
    manufacturerName: { type: String, default: "" },
    brandName:        { type: String, default: "" },
    tradeName:        { type: String, default: "" },
    alternatePartNumber: { type: String, default: "" },

    // AI-classified category
    classpath: { type: String, default: "Uncategorized > Needs Manual Classification" },
    category:  { type: String, default: "Uncategorized" },
    itemType:  { type: String, default: "" },

    // AI-extracted attributes (Triplets)
    productAttributes: { type: [{ label: String, value: String, uom: String }], default: [] },
    attributes: { type: mongoose.Schema.Types.Mixed, default: {} }, // Kept for backwards compatibility if needed

    // AI-generated descriptions
    invoiceDesc:     { type: String, default: "" },
    mobileDesc:      { type: String, default: "" },
    productTitle:    { type: String, default: "" },
    shortDesc:       { type: String, default: "" },
    longDesc1:       { type: String, default: "" },
    retailDesc:      { type: String, default: "" },
    marketingDescription: { type: String, default: "" },
    longDescription: { type: String, default: "" }, // Kept for backwards compatibility
    
    // AI-generated features
    itemFeatures:    { type: [String], default: [] },

    // Additional standard fields
    withField:         { type: String, default: "" },
    standardApprovals: { type: String, default: "" },
    prop65:            { type: String, default: "" },
    application:       { type: String, default: "" },
    includes:          { type: String, default: "" },
    productName:       { type: String, default: "" },

    // Codes and specs
    upc:               { type: String, default: "" },
    ean:               { type: String, default: "" },
    gtin:              { type: String, default: "" },
    unspsc:            { type: String, default: "" },
    warranty:          { type: String, default: "" },
    listPrice:         { type: String, default: "" },
    sellingQty:        { type: String, default: "" },
    sellingUom:        { type: String, default: "" },
    series:            { type: String, default: "" },
    model:             { type: String, default: "" },

    // Dimensions
    dimensions: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        length: "", lengthUom: "",
        height: "", heightUom: "",
        width: "", widthUom: "",
        weight: "", weightUom: "",
      }
    },

    // Confidence scoring
    confidence:     { type: Number, default: 0 },
    needsReview:    { type: Boolean, default: true },
    scoreBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Processing flags
    agentUsed: { type: Boolean, default: true },
    mlUsed:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

RecordSchema.index({ sessionId: 1, mpn: 1 });
RecordSchema.index({ sessionId: 1, category: 1 });
RecordSchema.index({ sessionId: 1, needsReview: 1 });
RecordSchema.index({ sessionId: 1, confidence: 1 });

module.exports = mongoose.model("Record", RecordSchema);
