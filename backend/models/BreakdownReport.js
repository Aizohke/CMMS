const mongoose = require("mongoose");

// Structured failure taxonomy from Personalization Requirements Section 5 -
// used as the dropdown on the reporting form. Add/remove via the Admin
// master-data screen without touching code.
const FAILURE_TYPES = [
  "Mechanical breakdown",
  "Electrical breakdown",
  "Setting",
  "Batch coder",
  "Steam / compressed air",
  "Cooling",
];

const breakdownReportSchema = new mongoose.Schema(
  {
    lineId: { type: mongoose.Schema.Types.ObjectId, ref: "Line", required: true },
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", required: true },
    componentId: { type: mongoose.Schema.Types.ObjectId, ref: "Component", required: true },
    failureType: { type: String, enum: FAILURE_TYPES, required: true },
    // Numeric 1-10 severity scale, per Personalization Requirements Section 5
    severity: { type: Number, min: 1, max: 10, required: true },
    description: { type: String, trim: true, default: "" },
    photoUrl: { type: String, default: null },
    status: { type: String, enum: ["Open", "In Progress", "Resolved"], default: "Open" },
    // Downtime minutes attributable to this breakdown - feeds both MTTR and
    // the auto-computed "Hours of Operation" for OEE (Section 2.2)
    downtimeMinutes: { type: Number, default: 0, min: 0 },
    laborMinutes: { type: Number, default: 0, min: 0 },
    partsUsed: [
      {
        partName: { type: String },
        quantity: { type: Number, min: 0 },
      },
    ],
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

breakdownReportSchema.statics.FAILURE_TYPES = FAILURE_TYPES;

module.exports = mongoose.model("BreakdownReport", breakdownReportSchema);
