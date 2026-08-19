const express = require("express");
const ProductionLog = require("../models/ProductionLog");
const BreakdownReport = require("../models/BreakdownReport");
const Machine = require("../models/Machine");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// Submit a production log entry (Line Captain, per shift or per batch -
// Personalization Requirements Section 3: "Per shift and per batch").
// downtimeMinutes auto-sums linked breakdown reports for this machine in
// the given period unless explicitly overridden in the request body.
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      lineId, machineId, shiftLabel, periodStart, periodEnd,
      piecesProduced, rejectedPieces, scheduledMinutes,
      nominalSpeedUsed, downtimeMinutes,
    } = req.body;

    if (!lineId || !machineId || !shiftLabel || !periodStart || !periodEnd ||
        piecesProduced === undefined || !scheduledMinutes) {
      return res.status(400).json({
        error: "lineId, machineId, shiftLabel, periodStart, periodEnd, piecesProduced, and scheduledMinutes are required",
      });
    }

    let resolvedSpeed = nominalSpeedUsed;
    if (!resolvedSpeed) {
      const machine = await Machine.findById(machineId);
      resolvedSpeed = machine ? machine.defaultNominalSpeed : 0;
    }

    let resolvedDowntime = downtimeMinutes;
    if (resolvedDowntime === undefined) {
      const linkedBreakdowns = await BreakdownReport.find({
        machineId,
        createdAt: { $gte: new Date(periodStart), $lte: new Date(periodEnd) },
      }).select("downtimeMinutes");
      resolvedDowntime = linkedBreakdowns.reduce((sum, r) => sum + (r.downtimeMinutes || 0), 0);
    }

    const log = await ProductionLog.create({
      lineId, machineId, shiftLabel,
      periodStart, periodEnd, piecesProduced,
      rejectedPieces: rejectedPieces || 0,
      scheduledMinutes,
      downtimeMinutes: resolvedDowntime,
      nominalSpeedUsed: resolvedSpeed,
      loggedBy: req.user.id,
    });

    res.status(201).json({ log, metrics: log.computeMetrics() });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit production log", detail: err.message });
  }
});

// Per-machine OEE view: recent entries plus computed metrics for each,
// used by both the Line Captain's machine screen and the Admin dashboard.
router.get("/machine/:machineId", requireAuth, async (req, res) => {
  const logs = await ProductionLog.find({ machineId: req.params.machineId })
    .sort("-periodStart")
    .limit(30);

  const withMetrics = logs.map((log) => ({ log, metrics: log.computeMetrics() }));
  res.json(withMetrics);
});

// Plant-wide OEE roll-up: latest entry per machine, for the Admin overview.
router.get("/overview", requireAuth, async (req, res) => {
  const machines = await Machine.find({ isActive: true }).populate("lineId", "name code");

  const overview = await Promise.all(
    machines.map(async (machine) => {
      const latest = await ProductionLog.findOne({ machineId: machine._id }).sort("-periodStart");
      return {
        machine,
        latestMetrics: latest ? latest.computeMetrics() : null,
        lastLoggedAt: latest ? latest.periodStart : null,
      };
    })
  );

  res.json(overview);
});

module.exports = router;
