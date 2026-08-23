const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const User = require("../models/User");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────

function makeToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
  );
}

function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    role: user.role,
    authProvider: user.authProvider,
    assignedLineId: user.assignedLineId,
  };
}

// ─── Email + password signup ───────────────────────────────────────────────

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash,
      authProvider: "local",
      // New self-registered users start as Captain with no line assignment.
      // An Admin must assign them to a line via the Users tab.
      role: "Captain",
    });

    const token = makeToken(user);
    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Signup failed", detail: err.message });
  }
});

// ─── Email + password login ────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.authProvider !== "local" || !user.passwordHash) {
      return res.status(400).json({
        error: `This account was created with ${user.authProvider} sign-in. Please use that method instead.`,
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = makeToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Login failed", detail: err.message });
  }
});

// ─── Google OAuth + Phone OTP via Firebase ─────────────────────────────────
//
// Flow: The frontend signs the user in with Firebase (Google popup or phone
// OTP), then sends us the Firebase ID token. We verify it with the Firebase
// Admin SDK, find-or-create a local user record, and return a normal JWT.
// This means the rest of the app (role checks, line assignment, etc.) works
// identically regardless of how the user authenticated.

router.post("/firebase", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: "Firebase ID token is required" });
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired Firebase token" });
    }

    const { uid, email, name, phone_number, sign_in_provider } = decoded;

    // Determine auth provider from Firebase claim
    const provider =
      sign_in_provider === "google.com"
        ? "google"
        : sign_in_provider === "phone"
        ? "phone"
        : "google";

    // Phone users may not have an email - use a deterministic placeholder
    // so our unique email index doesn't block them.
    const resolvedEmail =
      email?.toLowerCase() || `phone_${uid}@firebase.placeholder`;

    // Find by Firebase UID first (most reliable), then by email as fallback
    let user = await User.findOne({ firebaseUid: uid });
    if (!user && email) {
      user = await User.findOne({ email: resolvedEmail });
    }

    if (!user) {
      // First time this Firebase user has signed in — create an account.
      user = await User.create({
        name: name || phone_number || "New User",
        email: resolvedEmail,
        authProvider: provider,
        firebaseUid: uid,
        phone: phone_number || null,
        role: "Captain",
      });
    } else {
      // Existing user — update UID if missing (covers email-then-google upgrade)
      if (!user.firebaseUid) {
        user.firebaseUid = uid;
        await user.save();
      }
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Account is deactivated. Contact an Admin." });
    }

    const token = makeToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Firebase auth failed", detail: err.message });
  }
});

// ─── Self-service password change (local accounts only) ────────────────────

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword and newPassword are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user.id);
    if (!user || user.authProvider !== "local") {
      return res.status(400).json({ error: "Password change is only available for email/password accounts" });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ error: "Password change failed", detail: err.message });
  }
});

// ─── Current user ──────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id)
    .select("-passwordHash")
    .populate("assignedLineId", "name code");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

module.exports = router;
