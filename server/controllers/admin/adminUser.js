import userModel from "../../models/user.model.js";
import Announcement from "../../models/announcement.model.js";
import { createAdminLog } from "../../utils/adminLogger.js";

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

export async function adminListUsers(req, res) {
  try {
    const { search, isBanned, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (isBanned === "true") filter.isBanned = true;
    if (isBanned === "false") filter.isBanned = false;
    if (search?.trim()) {
      const s = search.trim();
      filter.$or = [
        { firstName: { $regex: s, $options: "i" } },
        { lastName: { $regex: s, $options: "i" } },
        { email: { $regex: s, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select("-password -__v")
        .lean(),
      userModel.countDocuments(filter),
    ]);

    const userIds = users.map((u) => u._id);
    const counts = await Announcement.aggregate([
      { $match: { author: { $in: userIds } } },
      {
        $group: {
          _id: "$author",
          total: { $sum: 1 },
          accepted: {
            $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] },
          },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        },
      },
    ]);
    const countMap = Object.fromEntries(
      counts.map((c) => [c._id.toString(), c]),
    );

    return res.status(200).json({
      success: true,
      data: users.map((u) => ({
        ...u,
        announcementStats: countMap[u._id.toString()] ?? {
          total: 0,
          accepted: 0,
          pending: 0,
        },
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("adminListUsers Error:", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}

// ─── GET /api/admin/users/:id ─────────────────────────────────────────────────

export async function adminGetUser(req, res) {
  try {
    const user = await userModel
      .findById(req.params.id)
      .select("-password -__v")
      .lean();
    if (!user)
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "User not found.",
      });

    await createAdminLog(req, {
      action: "USER_HISTORY_VIEWED",
      targetType: "User",
      targetId: user._id,
      targetLabel: `${user.firstName} ${user.lastName} <${user.email}>`,
    });

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error("adminGetUser Error:", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}

// ─── GET /api/admin/users/:id/announcements ───────────────────────────────────

export async function adminGetUserAnnouncements(req, res) {
  try {
    const { id } = req.params;
    const { page = "1", limit = "20", status } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const user = await userModel
      .findById(id)
      .select("firstName lastName email")
      .lean();
    if (!user)
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "User not found.",
      });

    const filter = { author: id };
    if (status === "cancelled") filter.cancelledByUser = true;
    else if (status === "confirmed") filter.userConfirmed = true;
    else if (status === "closed") filter.closedByUser = true;
    else if (["pending", "accepted", "rejected"].includes(status))
      filter.status = status;

    const [announcements, total] = await Promise.all([
      Announcement.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select("-__v")
        .populate("author", "firstName lastName email userAvatar")
        .populate("reviewedBy", "username")
        .lean(),
      Announcement.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      data: announcements.map((a) => ({
        ...a,
        displayStatus: deriveDisplayStatus(a),
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("adminGetUserAnnouncements Error:", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}

// ─── PATCH /api/admin/users/:id/ban ───────────────────────────────────────────
/**
 * Permanent ban — only lifted by explicit PATCH /unban.
 * Body: { reason: string (5-300 chars) }
 */
export async function adminBanUser(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "A ban reason of at least 5 characters is required.",
      });
    }
    if (reason.trim().length > 300) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Ban reason must not exceed 300 characters.",
      });
    }

    const user = await userModel.findById(id);
    if (!user)
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "User not found.",
      });

    if (user.isBanned) {
      return res.status(400).json({
        success: false,
        error: "ALREADY_BANNED",
        message: "User is already banned.",
      });
    }

    user.isBanned = true;
    user.banReason = reason.trim();
    user.bannedBy = req.admin.id;
    user.bannedAt = new Date();
    await user.save();

    await createAdminLog(req, {
      action: "USER_BANNED",
      targetType: "User",
      targetId: user._id,
      targetLabel: `${user.firstName} ${user.lastName} <${user.email}>`,
      meta: { reason: reason.trim() },
    });

    return res.status(200).json({
      success: true,
      message: "User has been permanently banned.",
      data: { id: user._id, isBanned: true, banReason: user.banReason },
    });
  } catch (err) {
    console.error("adminBanUser Error:", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}

// ─── PATCH /api/admin/users/:id/unban ────────────────────────────────────────

export async function adminUnbanUser(req, res) {
  try {
    const { id } = req.params;
    const user = await userModel.findById(id);
    if (!user)
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "User not found.",
      });
    if (!user.isBanned)
      return res.status(400).json({
        success: false,
        error: "NOT_BANNED",
        message: "User is not currently banned.",
      });

    const previousReason = user.banReason;
    user.isBanned = false;
    user.banReason = null;
    user.bannedBy = null;
    user.bannedAt = null;
    await user.save();

    await createAdminLog(req, {
      action: "USER_UNBANNED",
      targetType: "User",
      targetId: user._id,
      targetLabel: `${user.firstName} ${user.lastName} <${user.email}>`,
      meta: { previousBanReason: previousReason },
    });

    return res.status(200).json({
      success: true,
      message: "User has been unbanned.",
      data: { id: user._id, isBanned: false },
    });
  } catch (err) {
    console.error("adminUnbanUser Error:", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}

// ─── Auth middleware — ban check (no auto-lift needed, bans are permanent) ────
// The authMiddleware stays lean: just verify the token, then in the controller
// fetch the user to check isBanned. No DB hit needed on every request.

function deriveDisplayStatus(a) {
  if (a.cancelledByUser) return "cancelled";
  if (a.userConfirmed) return "confirmed";
  if (a.closedByUser) return "closed";
  return a.status;
}
