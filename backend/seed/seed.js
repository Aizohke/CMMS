// Seeds the database with the actual plant structure from your
// Personalization Requirements (Section 4). Run once against a fresh
// database: `npm run seed`.
//
// ASSUMPTIONS MADE WHERE YOUR ANSWER WAS BLANK OR PARTIAL - all flagged in
// the specification document's "Open Items" section too:
//   - Every line is assumed to have all 8 station types you listed. If a
//     given line doesn't actually have a Cartoner, Shrink Wrapper, etc.,
//     delete that machine via the Admin master-data screen after seeding.
//   - Nominal speed defaults are placeholders (60 units/min) since none
//     were provided per-machine - EDIT THESE before relying on OEE numbers.
//   - Criticality defaults to "Medium" throughout - adjust per your own
//     judgement of which stations matter most.
//   - Admin/Engineer accounts use placeholder emails - change passwords
//     immediately after first login in any non-local environment.

require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const Line = require("../models/Line");
const Machine = require("../models/Machine");
const Component = require("../models/Component");
const User = require("../models/User");

const LINES = [
  { name: "Albertina Line", code: "LINE-ALB" },
  { name: "Terry Line", code: "LINE-TERRY" },
  { name: "Pure Glycerine Line", code: "LINE-PGL" },
  { name: "GRT Line", code: "LINE-GRT" },
  { name: "Tube Line", code: "LINE-TUB" },
];

// Station types and their components, exactly as provided in Section 4.
const STATIONS = [
  {
    name: "Infeed & Transport",
    components: ["Infeed Turntable", "Slat Chain Conveyor", "Timing Screw", "Starwheel Assembly"],
  },
  {
    name: "Filling Hopper",
    components: ["Peristaltic Pump", "Piston Filling Nozzle", "Buffer Tank Valve", "Dosing Cylinder"],
  },
  {
    name: "Capstamping & Screwing Machine",
    components: ["Capper Chuck", "Torque Limiter", "Induction Sealer", "Tube Hot Air Jaw", "Ultrasonic Sealer"],
  },
  {
    name: "Labeling Machine",
    components: ["Label Applicator Belt", "Print Head (TIJ/CIJ)", "Web Tensioner"],
  },
  {
    name: "Coding Machine",
    components: [
      "Thermal Inkjet (TIJ) Controller",
      "Continuous Inkjet (CIJ) Nozzle Assembly",
      "Print Sensor Optical Trigger",
      "Solenoid Purge Valve",
    ],
  },
  {
    name: "Vision Camera",
    components: ["CMOS Image Sensor", "LED Ring Light Illuminator", "Vision Processor Unit", "Reject Blow-off Air Nozzle"],
  },
  {
    name: "Shrink Wrapper",
    components: ["Heat Tunnel Heating Element", "Film Feed Roller", "Sealing Bar Blade", "Tunnel Exhaust Fan"],
  },
  {
    name: "Cartoner",
    components: ["Gripper", "Conveyor", "Pushing Mechanism Arm", "Tuck-in Flap Closer"],
  },
];

const DEFAULT_NOMINAL_SPEED = 60; // units/minute - PLACEHOLDER, edit per machine

async function seed() {
  await connectDB();

  console.log("Clearing existing master data (Lines, Machines, Components)...");
  await Promise.all([Line.deleteMany({}), Machine.deleteMany({}), Component.deleteMany({})]);

  console.log("Creating lines...");
  const createdLines = await Line.insertMany(LINES.map((l) => ({ ...l, area: "UP Processing" })));

  console.log("Creating machines (stations) and components per line...");
  for (const line of createdLines) {
    for (const station of STATIONS) {
      const machine = await Machine.create({
        name: station.name,
        lineId: line._id,
        criticality: "Medium",
        defaultNominalSpeed: DEFAULT_NOMINAL_SPEED,
      });

      await Component.insertMany(
        station.components.map((componentName) => ({
          name: componentName,
          machineId: machine._id,
          criticality: "Medium",
          alertThreshold: 3, // Section 5: "3 failures within 30 days"
          alertWindowDays: 30,
        }))
      );
    }
  }

  console.log("Creating placeholder user accounts...");
  const existingUsers = await User.countDocuments();

  // Force-reseed users if RESEED_USERS=true is set, regardless of whether
  // accounts already exist. This is the fix for the "login fails after running
  // seed a second time" problem - the original guard silently skipped user
  // creation if any users existed, leaving you with lines/machines seeded but
  // no usable accounts.
  if (existingUsers === 0 || process.env.RESEED_USERS === "true") {
    if (existingUsers > 0) {
      console.log(`Removing ${existingUsers} existing user(s) and recreating...`);
      await User.deleteMany({});
    }
    const defaultPasswordHash = await bcrypt.hash("ChangeMe123!", 10);

    await User.create([
      {
        name: "Attachment Admin",
        email: "admin@loreal-ea-cmms.local",
        passwordHash: defaultPasswordHash,
        role: "Admin",
      },
      {
        name: "Attachment Supervisor",
        email: "supervisor@loreal-ea-cmms.local",
        passwordHash: defaultPasswordHash,
        role: "Admin",
      },
      ...[1, 2, 3, 4].map((n) => ({
        name: `Engineer ${n}`,
        email: `engineer${n}@loreal-ea-cmms.local`,
        passwordHash: defaultPasswordHash,
        role: "Engineer",
      })),
      ...createdLines.map((line, i) => ({
        name: `Line Captain - ${line.name}`,
        email: `captain${i + 1}@loreal-ea-cmms.local`,
        passwordHash: defaultPasswordHash,
        role: "Captain",
        assignedLineId: line._id,
        assignmentHistory: [{ lineId: line._id }],
      })),
    ]);

    console.log('Default password for all seeded accounts: "ChangeMe123!" - change immediately.');
  } else {
    console.log("Users already exist - skipped user seeding.");
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
