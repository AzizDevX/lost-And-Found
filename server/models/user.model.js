import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    userAvatar: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 500,
      default: "uploads/users/default.png",
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 100,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    isBanned: { type: Boolean, default: false, required: true, index: true },

    banReason: { type: String, trim: true, maxlength: 300, default: null },
    bannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    bannedAt: { type: Date, default: null },
    banExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
