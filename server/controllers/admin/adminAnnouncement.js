import Announcement from "../../models/announcement.model.js";
import { createAdminLog } from "../../utils/adminLogger.js";
import { notifyStatsUpdate } from "../announcement/announcement.js";
import { deleteAnnouncementImages } from "../../utils/imageCleanup.js";

function deriveDisplayStatus(a) {
  if (a.cancelledByUser) return "cancelled";
  if (a.userConfirmed) return "confirmed";
  if (a.closedWithoutMatch) return "closedWithoutMatch";
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
    } else if (status === "cancelled") {
      filter.cancelledByUser = true;
    } else if (status === "confirmed") {
      filter.userConfirmed = true;
    } else if (status === "closedWithoutMatch") {
      filter.closedWithoutMatch = true;
    } else if (["pending", "accepted", "rejected"].includes(status)) {
      filter.status = status;
      filter.cancelledByUser = false;
      filter.userConfirmed = false;
      filter.closedWithoutMatch = false;
    } else {
      filter.status = "pending";
      filter.cancelledByUser = false;
      filter.userConfirmed = false;
      filter.closedWithoutMatch = false;
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

    const [
      pendingCount,
      acceptedCount,
      rejectedCount,
      cancelledCount,
      confirmedCount,
      closedWithoutMatchCount,
    ] = await Promise.all([
      Announcement.countDocuments({
        status: "pending",
        cancelledByUser: false,
        userConfirmed: false,
        closedWithoutMatch: false,
      }),
      Announcement.countDocuments({
        status: "accepted",
        cancelledByUser: false,
        userConfirmed: false,
        closedWithoutMatch: false,
      }),
      Announcement.countDocuments({
        status: "rejected",
        cancelledByUser: false,
        userConfirmed: false,
        closedWithoutMatch: false,
      }),
      Announcement.countDocuments({ cancelledByUser: true }),
      Announcement.countDocuments({ userConfirmed: true }),
      Announcement.countDocuments({ closedWithoutMatch: true }),
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
        closedWithoutMatch: closedWithoutMatchCount,
      },
    });
  } catch (err) {
    console.error("adminListAnnouncements Error:", err);
    return res.status(500).json({
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
      return res.status(404).json({
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
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}

// ─── PATCH /api/admin/announcements/:id/review ───────────────────────────────

export async function adminReviewAnnouncement(req, res) {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
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

    if (announcement.closedWithoutMatch) {
      return res.status(400).json({
        success: false,
        error: "ANNOUNCEMENT_CLOSED_WITHOUT_MATCH",
        message:
          "This announcement was closed by the user (no match found). It is permanently locked — you can only view or delete it.",
      });
    }

    if (announcement.status === "rejected" && status === "accepted") {
      return res.status(400).json({
        success: false,
        error: "REVERSAL_NOT_ALLOWED",
        message:
          "A rejected announcement cannot be directly accepted. The user must resubmit it for review.",
      });
    }

    const previousStatus = announcement.status;
    const previousImages = [...announcement.images];

    announcement.status = status;
    announcement.reviewedBy = req.admin.id;
    announcement.reviewedAt = new Date();

    if (status === "rejected") {
      announcement.rejectionReason = rejectionReason ?? null;
      announcement.isReturned = false;
      announcement.images = [];
    } else {
      announcement.rejectionReason = null;
    }

    await announcement.save();

    if (status === "rejected" && previousImages.length > 0) {
      deleteAnnouncementImages(previousImages);
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
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}

// ─── PATCH /api/admin/announcements/:id/returned ─────────────────────────────

export async function adminMarkReturned(req, res) {
  try {
    const { id } = req.params;
    const { isReturned } = req.body;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Announcement not found.",
      });
    }

    if (announcement.cancelledByUser) {
      return res.status(400).json({
        success: false,
        error: "ANNOUNCEMENT_CANCELLED",
        message: "Cannot update a cancelled announcement.",
      });
    }

    if (announcement.closedWithoutMatch) {
      return res.status(400).json({
        success: false,
        error: "ANNOUNCEMENT_CLOSED_WITHOUT_MATCH",
        message:
          "Cannot update an announcement closed without a match. It is permanently locked.",
      });
    }

    if (announcement.userConfirmed) {
      return res.status(400).json({
        success: false,
        error: "ANNOUNCEMENT_CONFIRMED",
        message: "Cannot update a confirmed announcement.",
      });
    }

    if (announcement.status !== "accepted") {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATUS",
        message: "Only accepted announcements can be marked as returned.",
      });
    }

    const previous = announcement.isReturned;
    announcement.isReturned = isReturned;

    if (isReturned) {
      announcement.userConfirmed = true;
      announcement.userConfirmedAt = new Date();
    } else {
      announcement.userConfirmed = false;
      announcement.userConfirmedAt = null;
    }

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
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}

// ─── PATCH /api/admin/announcements/:id/admin-close ─────────────────────────

export async function adminCloseWithoutMatch(req, res) {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Announcement not found.",
      });
    }

    if (announcement.cancelledByUser) {
      return res.status(400).json({
        success: false,
        error: "ANNOUNCEMENT_CANCELLED",
        message: "Cannot close a cancelled announcement.",
      });
    }

    if (announcement.userConfirmed) {
      return res.status(400).json({
        success: false,
        error: "ANNOUNCEMENT_CONFIRMED",
        message: "Cannot close a confirmed announcement.",
      });
    }

    if (announcement.closedWithoutMatch) {
      return res.status(400).json({
        success: false,
        error: "ALREADY_CLOSED",
        message: "This announcement is already closed without a match.",
      });
    }

    if (announcement.status !== "accepted") {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATUS",
        message: "Only accepted announcements can be closed without a match.",
      });
    }

    announcement.closedWithoutMatch = true;
    announcement.closedWithoutMatchAt = new Date();
    await announcement.save();

    await createAdminLog(req, {
      action: "ANNOUNCEMENT_CLOSED_WITHOUT_MATCH",
      targetType: "Announcement",
      targetId: announcement._id,
      targetLabel: announcement.description.slice(0, 100),
      meta: { previousStatus: announcement.status },
    });

    notifyStatsUpdate();

    return res.status(200).json({
      success: true,
      message: "Announcement closed without match.",
      data: {
        id: announcement._id,
        displayStatus: "closedWithoutMatch",
      },
    });
  } catch (err) {
    console.error("adminCloseWithoutMatch Error:", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}

export async function adminDeleteAnnouncement(req, res) {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
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
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}
