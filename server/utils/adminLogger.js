import AdminLog from "../models/adminLog.model.js";

/**
 * createAdminLog — fire-and-forget admin audit logger.
 *
 * Usage (inside any controller that has req.admin):
 *
 *   await createAdminLog(req, {
 *     action:       "ANNOUNCEMENT_ACCEPTED",
 *     targetType:   "Announcement",
 *     targetId:     announcement._id,
 *     targetLabel:  announcement.description.slice(0, 80),
 *     meta:         { previousStatus: "pending" },
 *   });
 *
 * Never throws — a logging failure must never break the main response.
 */
export async function createAdminLog(req, {
  action,
  targetType,
  targetId   = null,
  targetLabel = null,
  meta        = {},
} = {}) {
  try {
    const ip        = req.ip || req.socket?.remoteAddress || null;
    const userAgent = (req.headers["user-agent"] || "").slice(0, 300) || null;

    await AdminLog.create({
      admin:         req.admin.id,
      adminUsername: req.admin.username,   // set by adminMiddleware (see updated middleware)
      adminRole:     req.admin.role,
      action,
      targetType,
      targetId,
      targetLabel,
      meta,
      ip,
      userAgent,
    });
  } catch (err) {
    // Log failure → console only, never re-throw
    console.error("[AdminLog] Failed to write log entry:", err.message);
  }
}
