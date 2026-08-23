require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const connectDB = require("./config/db");

// ─── Firebase Admin SDK ───────────────────────────────────────────────────
// Required to verify Google and phone ID tokens on the backend.
// Set FIREBASE_SERVICE_ACCOUNT in your .env (or Render environment) to the
// full JSON content of your Firebase service account key, stringified.
// See .env.example for the exact format.
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log("Firebase Admin SDK initialised");
  } catch (err) {
    console.warn("Firebase Admin SDK init failed:", err.message);
    console.warn("Google and phone sign-in will not work until FIREBASE_SERVICE_ACCOUNT is set correctly.");
  }
} else {
  console.warn("FIREBASE_SERVICE_ACCOUNT not set — Google and phone sign-in disabled.");
}

const authRoutes = require("./routes/auth");
const masterDataRoutes = require("./routes/masterData");
const breakdownRoutes = require("./routes/breakdowns");
const alertRoutes = require("./routes/alerts");
const productionLogRoutes = require("./routes/productionLogs");
const userRoutes = require("./routes/users");

const app = express();

app.use(cors({ origin: (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim()) }));
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", time: new Date().toISOString() })
);

app.use("/api/auth", authRoutes);
app.use("/api", masterDataRoutes);
app.use("/api/breakdowns", breakdownRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/production-logs", productionLogRoutes);
app.use("/api/users", userRoutes);

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error" });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`CMMS API listening on port ${PORT}`));
});

module.exports = app;
