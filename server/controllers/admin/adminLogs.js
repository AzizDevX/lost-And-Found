import AdminLog from "../../models/adminLog.model.js";

// ─── GET /api/admin/logs ──────────────────────────────────────────────────────
/**
 * Query params:
 *   adminId    : filter by specific admin
 *   action     : filter by action type
 *   targetType : Announcement | User | Admin | Auth
 *   targetId   : filter by specific resource ID
 *   from       : ISO date string (start of range)
 *   to         : ISO date string (end of range)
 *   page, limit
 */
export async function adminListLogs(req, res) {
  try {
    const {
      adminId,
      action,
      targetType,
      targetId,
      from,
      to,
      page  = "1",
      limit = "50",
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page,  10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const filter = {};

    if (adminId)    filter.admin      = adminId;
    if (action)     filter.action     = action;
    if (targetType) filter.targetType = targetType;
    if (targetId)   filter.targetId   = targetId;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      AdminLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("admin", "username email role")
        .lean(),
      AdminLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error("adminListLogs Error:", err);
    return res.status(500).json({ success: false, error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." });
  }
}

// ─── GET /api/admin/logs/summary — Quick activity summary ────────────────────
/**
 * Returns counts per action for the last N days (default: 7).
 * Useful for a dashboard widget.
 */
export async function adminLogsSummary(req, res) {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const summary = await AdminLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$action", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const totalActions = summary.reduce((acc, s) => acc + s.count, 0);

    return res.status(200).json({
      success: true,
      data: {
        period: `last ${days} days`,
        since: since.toISOString(),
        totalActions,
        byAction: summary.map((s) => ({ action: s._id, count: s.count })),
      },
    });
  } catch (err) {
    console.error("adminLogsSummary Error:", err);
    return res.status(500).json({ success: false, error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." });
  }
}
