require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const masterDataRoutes = require("./routes/masterData");
const breakdownRoutes = require("./routes/breakdowns");
const alertRoutes = require("./routes/alerts");
const productionLogRoutes = require("./routes/productionLogs");
const userRoutes = require("./routes/users");

const app = express();

app.use(cors({ origin: (process.env.CORS_ORIGIN || "*").split(",") }));
app.use(express.json({ limit: "5mb" })); // generous enough for a base64 photo attachment

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api", masterDataRoutes); // /api/lines, /api/machines, /api/components, /api/failure-types
app.use("/api/breakdowns", breakdownRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/production-logs", productionLogRoutes);
app.use("/api/users", userRoutes);

// Centralized error handler as a safety net for anything not caught locally
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error" });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`CMMS API listening on port ${PORT}`));
});

module.exports = app;
