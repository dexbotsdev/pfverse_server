const mongoose = require("mongoose");

// schema
const schema = new mongoose.Schema(
  {
    schedule: { type: Date, required: true }, 
    mint: { type: String, required: false }, 
    bundlerStatus: { type: String, required: true ,default:'NOTSTARTED'},
    reason: { type: String},
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
schema.index({ mint: "text" }); 

// index for createdAt and updatedAt
schema.index({ createdAt: 1 });
schema.index({ updatedAt: 1 });

// reference model
const JobMeta = mongoose.model("JobMeta", schema);

const ModelName = "JobMeta";
// reference model
// const Role = mongoose.model("Role", schema);

module.exports = { Model: JobMeta, name: ModelName };
