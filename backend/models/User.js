const mongoose = require("mongoose");

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
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // passwordHash is optional — Google and phone-auth users have no password.
    // The authProvider field records which method was used.
    passwordHash: { type: String, default: null },

    // "local" = email+password signup
    // "google" = Firebase Google OAuth
    // "phone" = Firebase phone OTP
    authProvider: {
      type: String,
      enum: ["local", "google", "phone"],
      default: "local",
    },

    // Firebase UID, used to verify Firebase ID tokens for Google/phone users.
    // Null for local-auth users.
    firebaseUid: { type: String, default: null, sparse: true },

    // Phone number stored for phone-auth users
    phone: { type: String, default: null },

    role: {
      type: String,
      enum: ["Captain", "Engineer", "Admin"],
      required: true,
      default: "Captain",
    },

    assignedLineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Line",
      default: null,
    },
    assignmentHistory: { type: [assignmentHistorySchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
