const mongoose = require("mongoose");

// Implements the OEE data capture exactly as clarified in your answers:
//
// - piecesProduced: entered manually by the Line Captain (Section 3).
//     NOTE: you did not explicitly confirm whether this should be total
//     units or good units only (Section 2.1, "Pieces Produced" Option A vs
//     B). Defaulted here to TOTAL units, with an optional rejectedPieces
//     field so Quality loss can be tracked separately without forcing you
//     to decide right now. This is flagged as an open item in the
//     specification document - confirm before this becomes load-bearing
//     for a management-facing OEE figure.
//
// - scheduledMinutes / downtimeMinutes: scheduled shift time is entered (or
//     defaulted from the shift length), and downtime is pulled automatically
//     from linked BreakdownReport.downtimeMinutes for the same machine and
//     period, exactly as you described ("if the operator can write the time
//     wasted into the system, it should automatically generate"). This
//     makes runningMinutes = scheduledMinutes - downtimeMinutes, i.e. your
//     "Hours of Operation" is running time only (Option B), NOT scheduled
//     time - see the specification document for what this means for what
//     the resulting ratio actually measures.
//
// - nominalSpeedUsed: defaults to the machine's defaultNominalSpeed but is
//     editable per entry, per your instruction that speed varies by batch.
const productionLogSchema = new mongoose.Schema(
  {
    lineId: { type: mongoose.Schema.Types.ObjectId, ref: "Line", required: true },
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", required: true },
    shiftLabel: { type: String, required: true }, // e.g. "Day Shift", "Batch 14032026-A"
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    piecesProduced: { type: Number, required: true, min: 0 },
    rejectedPieces: { type: Number, default: 0, min: 0 }, // optional, for Quality loss

    scheduledMinutes: { type: Number, required: true, min: 0 },
    downtimeMinutes: { type: Number, default: 0, min: 0 }, // auto-summed from breakdown reports in this period, editable

    nominalSpeedUsed: { type: Number, required: true, min: 0 }, // units/minute for THIS batch

    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Derived, on-demand calculations - never stored, so they can never go stale.
productionLogSchema.methods.computeMetrics = function () {
  const runningMinutes = Math.max(this.scheduledMinutes - this.downtimeMinutes, 0);
  const goodPieces = Math.max(this.piecesProduced - this.rejectedPieces, 0);

  // Your requested formula, applied literally with runningMinutes as
  // "Hours of Operation" converted to minutes already (no extra *60 needed
  // since scheduledMinutes/downtimeMinutes are already stored in minutes).
  const performanceRate =
    runningMinutes > 0 && this.nominalSpeedUsed > 0
      ? this.piecesProduced / (runningMinutes * this.nominalSpeedUsed)
      : 0;

  // Full three-factor OEE, computed alongside since downtime is already
  // captured - shown as a separate, clearly labeled figure per the
  // specification document's recommendation.
  const availability = this.scheduledMinutes > 0 ? runningMinutes / this.scheduledMinutes : 0;
  const idealOutput = runningMinutes * this.nominalSpeedUsed;
  const performance = idealOutput > 0 ? this.piecesProduced / idealOutput : 0;
  const quality = this.piecesProduced > 0 ? goodPieces / this.piecesProduced : 0;
  const oee = availability * performance * quality;

  return {
    runningMinutes,
    performanceRate: round(performanceRate),
    availability: round(availability),
    performance: round(performance),
    quality: round(quality),
    oee: round(oee),
  };
};

function round(n) {
  return Math.round(n * 10000) / 10000;
}

module.exports = mongoose.model("ProductionLog", productionLogSchema);
