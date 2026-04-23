import mongoose from "mongoose";

/**
 * AdminLog — audit trail for every admin action.
 *
 * Covers: announcement reviews, deletions, user bans/unbans,
 *         user history views, and auth events.
 */

export const LOG_ACTIONS = [
  // Announcement
  "ANNOUNCEMENT_ACCEPTED",
  "ANNOUNCEMENT_REJECTED",
  "ANNOUNCEMENT_DELETED",
  "ANNOUNCEMENT_MARK_RETURNED_TOGGLED",
  "ANNOUNCEMENT_REACTIVATED", // admin reopened a user-closed announcement

  // User management
  "USER_BANNED",
  "USER_UNBANNED",
  "USER_HISTORY_VIEWED",

  // Auth
  "ADMIN_LOGIN",
  "ADMIN_LOGOUT",
  "ADMIN_REFRESH",
];

const adminLogSchema = new mongoose.Schema(
  {
    // Who performed the action
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

    // What happened
    action: {
      type: String,
      enum: LOG_ACTIONS,
      required: true,
      index: true,
    },

    // Context: which resource was affected
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
      // human-readable snapshot: email, description snippet, etc.
      type: String,
      maxlength: 200,
      default: null,
    },

    // Extra structured data (before/after states, ban details, etc.)
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Request context
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

// Composite indexes for dashboard queries
adminLogSchema.index({ createdAt: -1 });
adminLogSchema.index({ admin: 1, createdAt: -1 });
adminLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

// Optional: auto-expire logs after 90 days
// adminLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AdminLog =
  mongoose.models.AdminLog || mongoose.model("AdminLog", adminLogSchema);

export default AdminLog;
