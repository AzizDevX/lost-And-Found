import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    userAvatar: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 500,
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

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    isBanned: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
