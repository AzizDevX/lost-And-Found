import mongoose from "mongoose";

export const LOG_ACTIONS = [
  "ANNOUNCEMENT_ACCEPTED",
  "ANNOUNCEMENT_REJECTED",
  "ANNOUNCEMENT_DELETED",
  "ANNOUNCEMENT_MARK_RETURNED_TOGGLED",
  "ANNOUNCEMENT_REACTIVATED",
  "ANNOUNCEMENT_CLOSED_WITHOUT_MATCH",

  "USER_BANNED",
  "USER_UNBANNED",
  "USER_HISTORY_VIEWED",

  "ADMIN_LOGIN",
  "ADMIN_LOGOUT",
  "ADMIN_REFRESH",
];

const adminLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    adminUsername: {
      type: String,
      required: true,
    },
    adminRole: {
      type: String,
      enum: ["superadmin", "moderator"],
      required: true,
    },

    action: {
      type: String,
      enum: LOG_ACTIONS,
      required: true,
      index: true,
    },

    targetType: {
      type: String,
      enum: ["Announcement", "User", "Admin", "Auth"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    targetLabel: {
      type: String,
      maxlength: 200,
      default: null,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ip: {
      type: String,
      maxlength: 45,
      default: null,
    },
    userAgent: {
      type: String,
      maxlength: 300,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

adminLogSchema.index({ createdAt: -1 });
adminLogSchema.index({ admin: 1, createdAt: -1 });
adminLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

const AdminLog =
  mongoose.models.AdminLog || mongoose.model("AdminLog", adminLogSchema);

export default AdminLog;
