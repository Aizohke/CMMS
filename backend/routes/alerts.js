const express = require("express");
const CriticalAlert = require("../models/CriticalAlert");
const Component = require("../models/Component");
const BreakdownReport = require("../models/BreakdownReport");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/roleCheck");

const router = express.Router();

// Plant-wide Critical Alerts tab (Master Guideline Section 6.2) - the one
// screen a manager should check every morning. Sorted oldest-first so the
// longest-outstanding alert is always at the top.
router.get("/", requireAuth, requireRole("Admin", "Engineer"), async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : { status: { $in: ["Critical", "Acknowledged"] } };

  const alerts = await CriticalAlert.find(filter)
    .sort("triggeredAt")
    .populate("componentId", "name alertThreshold alertWindowDays")
    .populate("machineId", "name")
    .populate("lineId", "name code")
    .populate("acknowledgedBy", "name")
    .populate("resolvedBy", "name");

  res.json(alerts);
});

// Step 1 of 2: Acknowledge. Stops further silent escalation but does NOT
// clear the red state - this is intentional (Refined Feature Design 6.2).
router.patch("/:id/acknowledge", requireAuth, requireRole("Admin", "Engineer"), async (req, res) => {
  const alert = await CriticalAlert.findById(req.params.id);
  if (!alert) return res.status(404).json({ error: "Alert not found" });
  if (alert.status !== "Critical") {
    return res.status(400).json({ error: `Cannot acknowledge an alert in status "${alert.status}"` });
  }

  alert.status = "Acknowledged";
  alert.acknowledgedBy = req.user.id;
  alert.acknowledgedAt = new Date();
  await alert.save();

  await Component.findByIdAndUpdate(alert.componentId, { currentStatus: "Acknowledged" });

  res.json(alert);
});

// Step 2 of 2: Resolve. Requires rootCause and correctiveAction - a bare
// checkbox is explicitly rejected by design; see Refined Feature Design 2.1.
router.patch("/:id/resolve", requireAuth, requireRole("Admin", "Engineer"), async (req, res) => {
  const { rootCause, correctiveAction } = req.body;

  if (!rootCause || !rootCause.trim() || !correctiveAction || !correctiveAction.trim()) {
    return res.status(400).json({
      error: "rootCause and correctiveAction are both required to resolve a critical alert",
    });
  }

  const alert = await CriticalAlert.findById(req.params.id);
  if (!alert) return res.status(404).json({ error: "Alert not found" });
  if (alert.status === "Resolved") {
    return res.status(400).json({ error: "Alert is already resolved" });
  }

  alert.status = "Resolved";
  alert.rootCause = rootCause.trim();
  alert.correctiveAction = correctiveAction.trim();
  alert.resolvedBy = req.user.id;
  alert.resolvedAt = new Date();
  await alert.save();

  await Component.findByIdAndUpdate(alert.componentId, { currentStatus: "Normal" });

  res.json(alert);
});

// Escalation sweep: intended to run on a schedule (e.g. hourly cron / cloud
// scheduler). Flags alerts un-acknowledged past a configurable SLA. For the
// prototype this is exposed as an endpoint an admin (or a scheduled job)
// can call; a real deployment should wire this to a scheduler.
router.post("/escalation-sweep", requireAuth, requireRole("Admin"), async (req, res) => {
  const slaHours = Number(req.body.slaHours) || 4;
  const cutoff = new Date(Date.now() - slaHours * 60 * 60 * 1000);

  const overdue = await CriticalAlert.find({
    status: "Critical",
    triggeredAt: { $lte: cutoff },
    escalatedAt: null,
  });

  for (const alert of overdue) {
    alert.escalatedAt = new Date();
    await alert.save();
    // NOTE: actual email/SMS dispatch to the escalation contact goes here.
    // ESCALATION_CONTACT_EMAIL in .env is a placeholder pending a real
    // contact - see the specification document's Open Items section.
  }

  res.json({ escalatedCount: overdue.length, alerts: overdue });
});

module.exports = router;
