// Prints everything relevant from the database so you can confirm seed ran
// correctly and diagnose login failures without needing MongoDB Compass or
// any other tool.
//
// Usage:  npm run check-db
//
// NOTE: passwords are NOT printed - only emails and roles are shown so
// you can confirm the accounts exist without exposing secrets in your terminal.

require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../models/User");
const Line = require("../models/Line");
const Machine = require("../models/Machine");
const Component = require("../models/Component");
const BreakdownReport = require("../models/BreakdownReport");
const CriticalAlert = require("../models/CriticalAlert");

async function main() {
  await connectDB();
  console.log("=".repeat(55));
  console.log("DATABASE DIAGNOSTIC REPORT");
  console.log(`MONGO_URI points to: ${process.env.MONGO_URI?.replace(/:([^:@]+)@/, ":***@") || "(not set)"}`);
  console.log("=".repeat(55));

  // --- Users ---
  const users = await User.find().sort("role");
  console.log(`\nUSERS (${users.length} total):`);
  if (users.length === 0) {
    console.log("  *** NO USERS FOUND - run: npm run reseed ***");
  } else {
    users.forEach((u) =>
      console.log(`  [${u.role.padEnd(8)}] ${u.email}  (active: ${u.isActive})`)
    );
  }

  // --- Lines ---
  const lines = await Line.find().sort("name");
  console.log(`\nLINES (${lines.length} total):`);
  if (lines.length === 0) {
    console.log("  *** NO LINES FOUND - run: npm run seed ***");
  } else {
    for (const line of lines) {
      const machineCount = await Machine.countDocuments({ lineId: line._id });
      console.log(`  ${line.name} (${line.code}) - ${machineCount} machines`);
    }
  }

  // --- Components ---
  const componentCount = await Component.countDocuments();
  const alertComponents = await Component.find({ currentStatus: { $ne: "Normal" } });
  console.log(`\nCOMPONENTS: ${componentCount} total`);
  if (alertComponents.length > 0) {
    console.log(`  Components NOT in Normal status:`);
    alertComponents.forEach((c) =>
      console.log(`  [${c.currentStatus}] ${c._id}`)
    );
  }

  // --- Breakdown reports ---
  const reportCount = await BreakdownReport.countDocuments();
  console.log(`\nBREAKDOWN REPORTS: ${reportCount} total`);

  // --- Critical alerts ---
  const activeAlerts = await CriticalAlert.find({ status: { $in: ["Critical", "Acknowledged"] } });
  console.log(`\nACTIVE CRITICAL ALERTS: ${activeAlerts.length}`);

  // --- Verdict ---
  console.log("\n" + "=".repeat(55));
  console.log("VERDICT:");
  if (users.length === 0) {
    console.log("  PROBLEM: No user accounts found.");
    console.log("  FIX:     npm run reseed");
  } else if (!users.some((u) => u.email === "admin@loreal-ea-cmms.local")) {
    console.log("  PROBLEM: Expected seeded accounts are missing.");
    console.log("  FIX:     npm run reseed");
  } else {
    console.log("  OK: Seeded accounts are present. If login is still failing:");
    console.log("      1. Make sure you are typing the password exactly: ChangeMe123!");
    console.log("         (capital C, capital M, exclamation mark, no spaces)");
    console.log("      2. Check that CORS_ORIGIN in backend/.env includes");
    console.log("         the exact URL your frontend is running on.");
    console.log("      3. Open browser DevTools → Network tab, click Sign In,");
    console.log("         and look at the actual request and response - the");
    console.log("         error message from the server will be shown there.");
  }
  if (lines.length === 0) {
    console.log("  PROBLEM: No lines/machines found.");
    console.log("  FIX:     npm run seed (this will also run reseed for users)");
  }
  console.log("=".repeat(55));

  process.exit(0);
}

main().catch((err) => {
  console.error("\ncheck-db failed:", err.message);
  if (err.message.includes("MONGO_URI")) {
    console.error("Make sure backend/.env exists and MONGO_URI is set.");
    console.error("Copy backend/.env.example to backend/.env first.");
  }
  process.exit(1);
});
