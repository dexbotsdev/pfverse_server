const mongoose = require("mongoose");

// schema
const schema = new mongoose.Schema(
  {
    mint: {
      type: String,
      required: true
    },
    walletAddress: {
      type: String,
      required: true
    },
    walletAta: {
      type: String,
      required: true
    },
    secretKey: {
      type: String,
      required: true
    },
    boughtTokens: {
      type: Number,
      default: 0
    },
    soldTokens: {
      type: Number,
      default: 0
    },
    solBalance: {
      type: Number,
      default: 0
    },
    solanaSpend: {
      type: Number,
      default: 0
    },
    estimatedSupply: {
      type: Number,
      default: 0
    }
    ,
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
schema.index({ walletAddress: "text" });
schema.index({ mint: "text" });

// index for createdAt and updatedAt
schema.index({ createdAt: 1 });
schema.index({ updatedAt: 1 });

// reference model
const WalletsMeta = mongoose.model("WalletsMeta", schema);

const ModelName = "WalletsMeta";
// reference model
// const Role = mongoose.model("Role", schema);

module.exports = { Model: WalletsMeta, name: ModelName };
