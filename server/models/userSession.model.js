import mongoose from "mongoose";

const userSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    hashedRefreshToken: {
      type: String,
      required: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

userSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const UserSession = mongoose.model("UserSession", userSessionSchema);

export default UserSession;
