const mongoose = require("mongoose");

// Section 6 of the Personalization Requirements: Line Captains rotate across
// the five lines rather than sitting permanently on one, so assignment is
// tracked as a history, not just a single current field.
const assignmentHistorySchema = new mongoose.Schema(
  {
    lineId: { type: mongoose.Schema.Types.ObjectId, ref: "Line", required: true },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    endedAt: { type: Date, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["Captain", "Engineer", "Admin"],
      required: true,
      default: "Captain",
    },
    // Current line assignment (null for Engineers/Admins who aren't tied to one line)
    assignedLineId: { type: mongoose.Schema.Types.ObjectId, ref: "Line", default: null },
    assignmentHistory: { type: [assignmentHistorySchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
