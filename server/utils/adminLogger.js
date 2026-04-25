import AdminLog from "../models/adminLog.model.js";

export async function createAdminLog(
  req,
  { action, targetType, targetId = null, targetLabel = null, meta = {} } = {},
) {
  try {
    const ip = req.ip || req.socket?.remoteAddress || null;
    const userAgent = (req.headers["user-agent"] || "").slice(0, 300) || null;

    await AdminLog.create({
      admin: req.admin.id,
      adminUsername: req.admin.username,
      adminRole: req.admin.role,
      action,
      targetType,
      targetId,
      targetLabel,
      meta,
      ip,
      userAgent,
    });
  } catch (err) {
    console.error("[AdminLog] Failed to write log entry:", err.message);
  }
}
