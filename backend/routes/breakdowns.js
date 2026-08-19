const express = require("express");
const BreakdownReport = require("../models/BreakdownReport");
const Component = require("../models/Component");
const CriticalAlert = require("../models/CriticalAlert");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/roleCheck");

const router = express.Router();

// Submit a structured breakdown report (Line Captain's core action).
// Immediately checks the repeat-failure rule from the Refined Feature
// Design Section 2 and opens/updates a CriticalAlert if the threshold is met.
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      lineId, machineId, componentId, failureType,
      severity, description, photoUrl, downtimeMinutes,
    } = req.body;

    if (!lineId || !machineId || !componentId || !failureType || !severity) {
      return res.status(400).json({
        error: "lineId, machineId, componentId, failureType, and severity are required",
      });
    }

    const report = await BreakdownReport.create({
      lineId, machineId, componentId, failureType,
      severity, description, photoUrl,
      downtimeMinutes: downtimeMinutes || 0,
      reportedBy: req.user.id,
    });

    const alertResult = await checkAndTriggerCriticalAlert(componentId, report);

    res.status(201).json({ report, criticalAlert: alertResult });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit breakdown report", detail: err.message });
  }
});

// The rule itself: count this component's Open/In-Progress AND Resolved
// reports within its configured rolling window; if the count reaches
// alertThreshold, open (or refresh) a CriticalAlert. This runs on every
// submission, so it is always evaluated against current data - never a
// background/batch job that could lag behind reality.
async function checkAndTriggerCriticalAlert(componentId, latestReport) {
  const component = await Component.findById(componentId);
  if (!component) return null;

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - component.alertWindowDays);

  const recentReports = await BreakdownReport.find({
    componentId,
    createdAt: { $gte: windowStart },
  }).select("_id");

  if (recentReports.length < component.alertThreshold) {
    return null; // below threshold - logged normally, no alert
  }

  // Threshold reached. Reuse an existing open alert for this component
  // rather than spawning duplicates while one is already Critical/Acknowledged.
  let alert = await CriticalAlert.findOne({
    componentId,
    status: { $in: ["Critical", "Acknowledged"] },
  });

  if (alert) {
    alert.failureCount = recentReports.length;
    alert.triggeringReportIds.push(latestReport._id);
    await alert.save();
  } else {
    alert = await CriticalAlert.create({
      componentId,
      machineId: component.machineId,
      lineId: latestReport.lineId,
      triggeringReportIds: recentReports.map((r) => r._id),
      failureCount: recentReports.length,
      windowDays: component.alertWindowDays,
      status: "Critical",
    });
    component.currentStatus = "Critical";
    await component.save();
  }

  return alert;
}

// Live breakdown table for Admin/Engineer, filterable - backs the
// "Download as Excel" button on the frontend (Section 13, Master Guideline).
router.get("/", requireAuth, requireRole("Admin", "Engineer"), async (req, res) => {
  const { lineId, machineId, status, from, to } = req.query;
  const filter = {};
  if (lineId) filter.lineId = lineId;
  if (machineId) filter.machineId = machineId;
  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const reports = await BreakdownReport.find(filter)
    .sort("-createdAt")
    .populate("lineId", "name code")
    .populate("machineId", "name")
    .populate("componentId", "name")
    .populate("reportedBy", "name")
    .populate("resolvedBy", "name");

  res.json(reports);
});

// A line captain's own submitted reports (their "did it get fixed?" view).
router.get("/mine", requireAuth, async (req, res) => {
  const reports = await BreakdownReport.find({ reportedBy: req.user.id })
    .sort("-createdAt")
    .populate("machineId", "name")
    .populate("componentId", "name");
  res.json(reports);
});

// Tick-to-resolve: updates the one database record; every screen reading
// it (including the reporting captain's "mine" view above) reflects the
// change immediately, per the Excel-as-export-not-source-of-truth design.
router.patch("/:id/resolve", requireAuth, requireRole("Admin", "Engineer"), async (req, res) => {
  const report = await BreakdownReport.findByIdAndUpdate(
    req.params.id,
    { status: "Resolved", resolvedBy: req.user.id, resolvedAt: new Date() },
    { new: true }
  );
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json(report);
});

module.exports = router;
