const mongoose = require("mongoose");

// Top of the asset hierarchy: Line -> Machine (station) -> Component.
// Seeded from Personalization Requirements Section 4: five lines under the
// "UP Processing" area. Area name is an assumption flagged in the
// specification document - correct it in the seed file if it differs.
const lineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    area: { type: String, default: "UP Processing" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Line", lineSchema);
