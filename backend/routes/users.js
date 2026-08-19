const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/roleCheck");

const router = express.Router();

router.get("/", requireAuth, requireRole("Admin"), async (req, res) => {
  const users = await User.find().select("-passwordHash").populate("assignedLineId", "name code");
  res.json(users);
});

router.post("/", requireAuth, requireRole("Admin"), async (req, res) => {
  const { name, email, password, role, assignedLineId } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name, email: email.toLowerCase(), passwordHash,
    role: role || "Captain", assignedLineId: assignedLineId || null,
  });
  const safeUser = user.toObject();
  delete safeUser.passwordHash;
  res.status(201).json(safeUser);
});

// Promote/demote between roles. Blocks removing the very last Admin,
// per Master Guideline Section 6.1's refinement of your original idea.
router.patch("/:id/role", requireAuth, requireRole("Admin"), async (req, res) => {
  const { role } = req.body;
  if (!["Captain", "Engineer", "Admin"].includes(role)) {
    return res.status(400).json({ error: "role must be Captain, Engineer, or Admin" });
  }

  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ error: "User not found" });

  if (target.role === "Admin" && role !== "Admin") {
    const adminCount = await User.countDocuments({ role: "Admin", isActive: true });
    if (adminCount <= 1) {
      return res.status(400).json({ error: "Cannot demote the last remaining Admin account" });
    }
  }

  target.role = role;
  await target.save();
  res.json(target);
});

// Reassign a Line Captain to a different line, retaining assignment
// history (Master Guideline Section 6.1 - your rotational-captain detail).
router.patch("/:id/reassign-line", requireAuth, requireRole("Admin"), async (req, res) => {
  const { lineId } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  // Close out the current assignment period, if any
  const openEntry = user.assignmentHistory.find((a) => a.endedAt === null);
  if (openEntry) openEntry.endedAt = new Date();

  user.assignmentHistory.push({ lineId, assignedBy: req.user.id });
  user.assignedLineId = lineId;
  await user.save();

  res.json(user);
});

router.patch("/:id/deactivate", requireAuth, requireRole("Admin"), async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

module.exports = router;
