const mongoose = require("mongoose");

// The centerpiece feature (Refined CMMS Feature Design, Section 2/6).
// A single record per critical-alert episode on a component, carrying the
// full audit trail from trigger through to a Resolved state that requires a
// real root cause - not just a checkbox.
const criticalAlertSchema = new mongoose.Schema(
  {
    componentId: { type: mongoose.Schema.Types.ObjectId, ref: "Component", required: true },
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", required: true },
    lineId: { type: mongoose.Schema.Types.ObjectId, ref: "Line", required: true },
    triggeringReportIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "BreakdownReport" }],
    failureCount: { type: Number, required: true },
    windowDays: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Critical", "Acknowledged", "Resolved"],
      default: "Critical",
    },
    triggeredAt: { type: Date, default: Date.now },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    acknowledgedAt: { type: Date, default: null },
    // Root cause must reuse the same failure taxonomy so it stays queryable
    // for Pareto/FMEA analysis later, per the Refined Feature Design.
    rootCause: { type: String, default: null },
    correctiveAction: { type: String, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    // Escalation SLA - contact is a placeholder pending Section 6's blank answer
    escalatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CriticalAlert", criticalAlertSchema);
