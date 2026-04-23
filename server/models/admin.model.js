import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
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

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    role: {
      type: String,
      enum: ["superadmin", "moderator"],
      default: "moderator",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: String, // CLI username or "system"
      default: "system",
    },
  },
  { timestamps: true },
);

const Admin =
  mongoose.models.Admin || mongoose.model("Admin", adminSchema);

export default Admin;
