const mongoose = require("mongoose");

// A "Machine" here represents a station on a line (Infeed & Transport, Filling
// Hopper, Capstamping & Screwing, Labeling, Coding, Vision Camera, Shrink
// Wrapper, Cartoner - per Personalization Requirements Section 4).
//
// defaultNominalSpeed is the machine's rated speed (units/minute). Per your
// answer in Section 2.2, actual speed varies by batch/product, so this is
// only ever used as a pre-filled default - the authoritative speed for any
// given OEE calculation is whatever was recorded on the ProductionLog entry
// (see ProductionLog.js), which can be overridden per batch.
const machineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    lineId: { type: mongoose.Schema.Types.ObjectId, ref: "Line", required: true },
    // Criticality was left blank in the Personalization Requirements -
    // defaults to "Medium"; change per machine via the Admin master-data
    // screen. Drives the default critical-alert threshold on components.
    criticality: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
    defaultNominalSpeed: { type: Number, required: true, min: 0 }, // units per minute
    qrCode: { type: String, unique: true, sparse: true }, // set after generation
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Machine", machineSchema);
