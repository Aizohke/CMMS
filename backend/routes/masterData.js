const express = require("express");
const Line = require("../models/Line");
const Machine = require("../models/Machine");
const Component = require("../models/Component");
const BreakdownReport = require("../models/BreakdownReport");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/roleCheck");

const router = express.Router();

// --- Lines ---
router.get("/lines", requireAuth, async (req, res) => {
  const lines = await Line.find({ isActive: true }).sort("name");
  res.json(lines);
});

router.post("/lines", requireAuth, requireRole("Admin"), async (req, res) => {
  const line = await Line.create(req.body);
  res.status(201).json(line);
});

// --- Machines (stations) ---
router.get("/lines/:lineId/machines", requireAuth, async (req, res) => {
  const machines = await Machine.find({ lineId: req.params.lineId, isActive: true }).sort("name");
  res.json(machines);
});

router.post("/machines", requireAuth, requireRole("Admin"), async (req, res) => {
  const machine = await Machine.create(req.body);
  res.status(201).json(machine);
});

router.patch("/machines/:id", requireAuth, requireRole("Admin"), async (req, res) => {
  const machine = await Machine.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!machine) return res.status(404).json({ error: "Machine not found" });
  res.json(machine);
});

// Full machine detail: profile + components + open alerts + recent history.
// This is the payload behind the QR-scan / machine-detail screen.
router.get("/machines/:id/detail", requireAuth, async (req, res) => {
  const machine = await Machine.findById(req.params.id).populate("lineId", "name code");
  if (!machine) return res.status(404).json({ error: "Machine not found" });

  const components = await Component.find({ machineId: machine._id, isActive: true }).sort("name");
  const recentReports = await BreakdownReport.find({ machineId: machine._id })
    .sort("-createdAt")
    .limit(20)
    .populate("componentId", "name")
    .populate("reportedBy", "name");

  res.json({ machine, components, recentReports });
});

// --- Components ---
router.get("/machines/:machineId/components", requireAuth, async (req, res) => {
  const components = await Component.find({ machineId: req.params.machineId, isActive: true }).sort("name");
  res.json(components);
});

router.post("/components", requireAuth, requireRole("Admin"), async (req, res) => {
  const component = await Component.create(req.body);
  res.status(201).json(component);
});

router.patch("/components/:id", requireAuth, requireRole("Admin"), async (req, res) => {
  // Primary use: adjusting alertThreshold / alertWindowDays per component
  // (Master Guideline Section 6, "configurable per component").
  const component = await Component.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!component) return res.status(404).json({ error: "Component not found" });
  res.json(component);
});

// --- Failure taxonomy (for the reporting form dropdown) ---
router.get("/failure-types", requireAuth, (req, res) => {
  res.json(BreakdownReport.FAILURE_TYPES);
});

module.exports = router;
