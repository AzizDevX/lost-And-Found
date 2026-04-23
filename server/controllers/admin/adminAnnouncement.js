import Announcement from "../../models/announcement.model.js";
import { createAdminLog } from "../../utils/adminLogger.js";
import { notifyStatsUpdate } from "../announcement/announcement.js";
import { deleteAnnouncementImages } from "../../utils/imageCleanup.js";

// ─── Shared helper ────────────────────────────────────────────────────────────

/**
 * Priority order (highest → lowest):
 *   cancelled  — user withdrew PENDING request (images deleted, read-only)
 *   confirmed  — user found item (images kept, read-only)
 *   closed     — user gave up on ACCEPTED post (images kept, admin CAN reactivate)
 *   pending | accepted | rejected — standard review states
 */
function deriveDisplayStatus(a) {
  if (a.cancelledByUser) return "cancelled";
  if (a.userConfirmed) return "confirmed";
  if (a.closedByUser) return "closed";
  return a.status;
}

// ─── GET /api/admin/announcements ─────────────────────────────────────────────

export async function adminListAnnouncements(req, res) {
  try {
    const { status, type, category, page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (status === "all") {
      // no filter — admin sees everything
    } else if (status === "cancelled") {
      filter.cancelledByUser = true;
    } else if (status === "confirmed") {
      filter.userConfirmed = true;
    } else if (status === "closed") {
      filter.closedByUser = true;
    } else if (["pending", "accepted", "rejected"].includes(status)) {
      filter.status = status;
      filter.cancelledByUser = false;
      filter.userConfirmed = false;
      filter.closedByUser = false;
    } else {
      // Default: pending review queue
      filter.status = "pending";
      filter.cancelledByUser = false;
      filter.userConfirmed = false;
      filter.closedByUser = false;
    }

    if (type && ["lost", "found"].includes(type)) filter.type = type;

    const validCategories = [
      "electronics",
      "clothing",
      "bags",
      "keys",
      "documents",
      "jewelry",
      "books",
      "sports",
      "other",
    ];
    if (category && validCategories.includes(category))
      filter.category = category;

    const [announcements, total] = await Promise.all([
      Announcement.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("author", "firstName lastName email userAvatar isBanned")
        .populate("reviewedBy", "username email")
        .lean(),
      Announcement.countDocuments(filter),
    ]);

    // Summary counts for dashboard tabs
    const [
      pendingCount,
      acceptedCount,
      rejectedCount,
      cancelledCount,
      confirmedCount,
      closedCount,
    ] = await Promise.all([
      Announcement.countDocuments({
        status: "pending",
        cancelledByUser: false,
        userConfirmed: false,
        closedByUser: false,
      }),
      Announcement.countDocuments({
        status: "accepted",
        cancelledByUser: false,
        userConfirmed: false,
        closedByUser: false,
      }),
      Announcement.countDocuments({
        status: "rejected",
        cancelledByUser: false,
        userConfirmed: false,
        closedByUser: false,
      }),
      Announcement.countDocuments({ cancelledByUser: true }),
      Announcement.countDocuments({ userConfirmed: true }),
      Announcement.countDocuments({ closedByUser: true }),
    ]);

    return res.status(200).json({
      success: true,
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
      summary: {
        pending: pendingCount,
        accepted: acceptedCount,
        rejected: rejectedCount,
        cancelled: cancelledCount,
        confirmed: confirmedCount,
        closed: closedCount,
      },
    });
  } catch (err) {
    console.error("adminListAnnouncements Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── GET /api/admin/announcements/:id ────────────────────────────────────────

export async function adminGetAnnouncement(req, res) {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate(
        "author",
        "firstName lastName email userAvatar isBanned banExpiresAt",
      )
      .populate("reviewedBy", "username email")
      .lean();

    if (!announcement) {
      return res
        .status(404)
        .json({
          success: false,
          error: "NOT_FOUND",
          message: "Announcement not found.",
        });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...announcement,
        displayStatus: deriveDisplayStatus(announcement),
      },
    });
  } catch (err) {
    console.error("adminGetAnnouncement Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── PATCH /api/admin/announcements/:id/review ───────────────────────────────
/**
 * Accept or reject an announcement.
 *
 * Allowed transitions:
 *   pending  → accepted ✓
 *   pending  → rejected ✓
 *   accepted → rejected ✓  (force-reject: removes from feed, deletes images)
 *   rejected → accepted ✓  (reverse a mistaken rejection)
 *   rejected → rejected ✓  (update rejection reason)
 *   accepted → accepted ✓  (no-op but harmless)
 *
 * NOT allowed:
 *   cancelled → anything  ✗  (user withdrew pending — read-only)
 *   confirmed → anything  ✗  (user resolved — read-only)
 *   closed    → anything  ✗  (use /reactivate to restore a closed post)
 *
 * Image policy:
 *   → rejected: images deleted (announcement leaves all feeds permanently).
 *   → accepted: images KEPT (displayed on public feed).
 */
export async function adminReviewAnnouncement(req, res) {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res
        .status(404)
        .json({
          success: false,
          error: "NOT_FOUND",
          message: "Announcement not found.",
        });
    }

    if (announcement.cancelledByUser) {
      return res.status(400).json({
        success: false,
        error: "ANNOUNCEMENT_CANCELLED",
        message:
          "This announcement was cancelled by the user and cannot be reviewed. You can only view or delete it.",
      });
    }

    if (announcement.userConfirmed) {
      return res.status(400).json({
        success: false,
        error: "ANNOUNCEMENT_CONFIRMED",
        message:
          "This announcement was confirmed resolved by the user and cannot be reviewed. You can only view or delete it.",
      });
    }

    if (announcement.closedByUser) {
      return res.status(400).json({
        success: false,
        error: "ANNOUNCEMENT_CLOSED",
        message:
          "This announcement was closed by the user (no match found). Use PATCH /reactivate to restore it to active, or delete it.",
      });
    }

    const previousStatus = announcement.status;

    announcement.status = status;
    announcement.reviewedBy = req.admin.id;
    announcement.reviewedAt = new Date();

    if (status === "rejected") {
      announcement.rejectionReason = rejectionReason ?? null;
      announcement.isReturned = false;
    } else {
      announcement.rejectionReason = null;
    }

    await announcement.save();

    if (status === "rejected") {
      deleteAnnouncementImages(announcement.images);
    }

    await createAdminLog(req, {
      action:
        status === "accepted"
          ? "ANNOUNCEMENT_ACCEPTED"
          : "ANNOUNCEMENT_REJECTED",
      targetType: "Announcement",
      targetId: announcement._id,
      targetLabel: announcement.description.slice(0, 100),
      meta: {
        previousStatus,
        newStatus: status,
        ...(rejectionReason ? { rejectionReason } : {}),
      },
    });

    notifyStatsUpdate();

    return res.status(200).json({
      success: true,
      message: `Announcement ${status} successfully.`,
      data: {
        id: announcement._id,
        status: announcement.status,
        reviewedAt: announcement.reviewedAt,
      },
    });
  } catch (err) {
    console.error("adminReviewAnnouncement Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── PATCH /api/admin/announcements/:id/reactivate ───────────────────────────
/**
 * Admin restores a CLOSED announcement back to accepted (active on feed).
 *
 * Only allowed on: closedByUser = true, status = "accepted" announcements.
 * (Cancelled and confirmed are permanently read-only for admin.)
 *
 * This is the key difference between "closed" and "cancelled"/"confirmed":
 *   - closed    → admin CAN reactivate  ✓
 *   - cancelled → admin CANNOT          ✗
 *   - confirmed → admin CANNOT          ✗
 *
 * Images are already kept when a user closes, so nothing needs to be restored.
 */
export async function adminReactivateAnnouncement(req, res) {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res
        .status(404)
        .json({
          success: false,
          error: "NOT_FOUND",
          message: "Announcement not found.",
        });
    }

    if (!announcement.closedByUser) {
      const reason = announcement.cancelledByUser
        ? "cancelled (user withdrew their pending request — permanently read-only)"
        : announcement.userConfirmed
          ? "confirmed resolved by the user — permanently read-only"
          : "not closed by the user — nothing to reactivate";

      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: `This announcement cannot be reactivated: it is ${reason}.`,
      });
    }

    // Restore to active feed
    announcement.closedByUser = false;
    announcement.closedAt = null;
    announcement.closedReason = null;
    // status stays "accepted" (it was accepted before user closed it)
    await announcement.save();

    await createAdminLog(req, {
      action: "ANNOUNCEMENT_REACTIVATED",
      targetType: "Announcement",
      targetId: announcement._id,
      targetLabel: announcement.description.slice(0, 100),
      meta: { reactivatedFrom: "closed" },
    });

    notifyStatsUpdate();

    return res.status(200).json({
      success: true,
      message:
        "Announcement reactivated. It is now visible on the public feed again.",
      data: { id: announcement._id, displayStatus: "accepted" },
    });
  } catch (err) {
    console.error("adminReactivateAnnouncement Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── PATCH /api/admin/announcements/:id/returned ─────────────────────────────
/**
 * Toggle "item physically returned" flag.
 * Only on accepted, non-cancelled, non-closed announcements.
 * Images KEPT.
 */
export async function adminMarkReturned(req, res) {
  try {
    const { id } = req.params;
    const { isReturned } = req.body;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res
        .status(404)
        .json({
          success: false,
          error: "NOT_FOUND",
          message: "Announcement not found.",
        });
    }

    if (announcement.cancelledByUser) {
      return res
        .status(400)
        .json({
          success: false,
          error: "ANNOUNCEMENT_CANCELLED",
          message: "Cannot update a cancelled announcement.",
        });
    }

    if (announcement.closedByUser) {
      return res
        .status(400)
        .json({
          success: false,
          error: "ANNOUNCEMENT_CLOSED",
          message: "Cannot update a closed announcement. Reactivate it first.",
        });
    }

    if (announcement.status !== "accepted") {
      return res
        .status(400)
        .json({
          success: false,
          error: "INVALID_STATUS",
          message: "Only accepted announcements can be marked as returned.",
        });
    }

    const previous = announcement.isReturned;
    announcement.isReturned = isReturned;
    await announcement.save();

    await createAdminLog(req, {
      action: "ANNOUNCEMENT_MARK_RETURNED_TOGGLED",
      targetType: "Announcement",
      targetId: announcement._id,
      targetLabel: announcement.description.slice(0, 100),
      meta: { from: previous, to: isReturned },
    });

    notifyStatsUpdate();

    return res.status(200).json({
      success: true,
      message: `Announcement marked as ${isReturned ? "returned" : "active"}.`,
      data: { id: announcement._id, isReturned: announcement.isReturned },
    });
  } catch (err) {
    console.error("adminMarkReturned Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── DELETE /api/admin/announcements/:id ─────────────────────────────────────
/**
 * Hard delete — any admin can delete any announcement regardless of status.
 * Always deletes images from disk.
 *
 * This is the nuclear option — use it to permanently remove spam, illegal
 * content, or any announcement that should not exist at all.
 */
export async function adminDeleteAnnouncement(req, res) {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res
        .status(404)
        .json({
          success: false,
          error: "NOT_FOUND",
          message: "Announcement not found.",
        });
    }

    const snapshot = {
      authorId: announcement.author,
      type: announcement.type,
      category: announcement.category,
      status: announcement.status,
      displayStatus: deriveDisplayStatus(announcement),
      description: announcement.description.slice(0, 100),
      imageCount: announcement.images.length,
    };

    // Always delete images on hard delete
    deleteAnnouncementImages(announcement.images);

    await announcement.deleteOne();

    await createAdminLog(req, {
      action: "ANNOUNCEMENT_DELETED",
      targetType: "Announcement",
      targetId: id,
      targetLabel: snapshot.description,
      meta: snapshot,
    });

    notifyStatsUpdate();

    return res
      .status(200)
      .json({ success: true, message: "Announcement deleted successfully." });
  } catch (err) {
    console.error("adminDeleteAnnouncement Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}
