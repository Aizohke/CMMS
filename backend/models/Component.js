const mongoose = require("mongoose");

// Section 2 (Master Guideline) critical-alert rule lives here:
// a component enters CRITICAL when failureCount within alertWindowDays
// reaches alertThreshold. Defaults below come directly from Personalization
// Requirements Section 5: "3 failures within 30 days".
const componentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", required: true },
    criticality: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
    alertThreshold: { type: Number, default: 3, min: 1 },
    alertWindowDays: { type: Number, default: 30, min: 1 },
    currentStatus: {
      type: String,
      enum: ["Normal", "Critical", "Acknowledged"],
      default: "Normal",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Component", componentSchema);
