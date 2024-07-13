const mongoose = require("mongoose");

// schema
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    symbol: { type: String, required: true },
    description: { type: String },
    metadataUrl: { type: String, required: true },
    twitter: { type: String },
    telegram: { type: String },
    website: { type: String },
    showName: { type: Boolean, required: true },
    mint: { type: String, required: true },
    mintKey: { type: String, required: true },
    bondingCurve: { type: String, required: true },
    associatedBondingCurve: { type: String, required: true },
    metadata: { type: String, required: true },
    fundingwallet: { type: String, required: true },
    devwallet: { type: String, required: true },
    creatorwallet: { type: String, required: true },
    bundleStatus: { type: String, required: true, default: 'INIT' },
    reason: { type: String },
    lookupTableAdress: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      default: "000000000000",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      default: "000000000000",
    },
  },
  { timestamps: true }
);

// indices
// text index for name
schema.index({ name: "text" });
schema.index({ mint: "text" });
schema.index({ creatorwallet: "text" });

// index for createdAt and updatedAt
schema.index({ createdAt: 1 });
schema.index({ updatedAt: 1 });

// reference model
const TokenMeta = mongoose.model("TokenMeta", schema);

const ModelName = "TokenMeta";
// reference model
// const Role = mongoose.model("Role", schema);

module.exports = { Model: TokenMeta, name: ModelName };
