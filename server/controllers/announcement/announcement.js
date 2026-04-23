import fs from "fs";
import Announcement from "../../models/announcement.model.js";
import userModel from "../../models/user.model.js";
import { deleteAnnouncementImages } from "../../utils/imageCleanup.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanupFiles(files = []) {
  files.forEach((f) => {
    try {
      fs.unlinkSync(f.path);
    } catch {}
  });
}

function buildImagePaths(files = []) {
  return files.map((f) => f.path.replace(/\\/g, "/"));
}

/**
 * Derive a single display label from the compound boolean fields.
 *
 * Priority order (highest → lowest):
 *   cancelled  — user withdrew their PENDING request (images deleted, read-only for admin)
 *   confirmed  — user found their item (images kept, read-only for admin)
 *   closed     — user gave up on ACCEPTED post without finding item
 *                (images kept, admin CAN reactivate)
 *   pending | accepted | rejected — standard admin review states
 */
function deriveDisplayStatus(a) {
  if (a.cancelledByUser) return "cancelled";
  if (a.userConfirmed) return "confirmed";
  if (a.closedByUser) return "closed";
  return a.status;
}

/**
 * Compute the live stats object — shared by REST endpoint and SSE emitter.
 *
 *   itemsReported       — every accepted, non-cancelled announcement.
 *   itemsReturned       — accepted, non-cancelled where item was recovered
 *                         (admin isReturned=true OR user confirmed).
 *   activeAnnouncements — currently visible on public feed:
 *                         accepted, not cancelled, not confirmed, not closed,
 *                         not returned.
 */
async function computeStats() {
  const baseFilter = { status: "accepted", cancelledByUser: false };

  const [itemsReported, itemsReturned, activeAnnouncements] = await Promise.all(
    [
      Announcement.countDocuments(baseFilter),
      Announcement.countDocuments({
        ...baseFilter,
        $or: [{ isReturned: true }, { userConfirmed: true }],
      }),
      Announcement.countDocuments({
        ...baseFilter,
        userConfirmed: false,
        closedByUser: false,
        isReturned: false,
      }),
    ],
  );

  return { itemsReported, itemsReturned, activeAnnouncements };
}

// ─── SSE: /api/announcements/stats/live ───────────────────────────────────────

const sseClients = new Set();

export function notifyStatsUpdate() {
  if (sseClients.size === 0) return;
  computeStats()
    .then((stats) => {
      const payload = `event: update\ndata: ${JSON.stringify(stats)}\n\n`;
      for (const client of sseClients) {
        try {
          client.write(payload);
        } catch {
          sseClients.delete(client);
        }
      }
    })
    .catch(() => {});
}

export function statsLiveSSE(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  computeStats()
    .then((stats) => {
      res.write(`event: update\ndata: ${JSON.stringify(stats)}\n\n`);
    })
    .catch(() => {});

  sseClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 30_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
}

// ─── POST /api/announcement — Create announcement ────────────────────────────

export async function createAnnouncement(req, res) {
  try {
    const userId = req.user.id;

    const user = await userModel
      .findById(userId)
      .select("isBanned firstName lastName");
    if (!user) {
      cleanupFiles(req.files);
      return res
        .status(404)
        .json({
          success: false,
          error: "USER_NOT_FOUND",
          message: "User not found.",
        });
    }

    if (user.isBanned) {
      cleanupFiles(req.files);
      return res
        .status(403)
        .json({
          success: false,
          error: "USER_BANNED",
          message:
            "Your account has been banned. You cannot post announcements.",
        });
    }

    const files = req.files ?? [];
    if (files.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "At least one image is required.",
        });
    }
    if (files.length > 5) {
      cleanupFiles(files);
      return res
        .status(400)
        .json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "A maximum of 5 images is allowed per announcement.",
        });
    }

    const { type, category, description, contact } = req.body;
    const c = contact && typeof contact === "object" ? contact : {};
    const sanitizedContact = {
      facebook: c.facebook?.trim() || null,
      instagram: c.instagram?.trim() || null,
      phone: c.phone?.trim() || null,
      email: c.email?.trim() || null,
    };

    const announcement = await Announcement.create({
      author: userId,
      type,
      category,
      description,
      images: buildImagePaths(files),
      contact: sanitizedContact,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message:
        "Announcement submitted successfully. It will be visible after admin approval.",
      data: { id: announcement._id, status: announcement.status },
    });
  } catch (err) {
    cleanupFiles(req.files ?? []);
    console.error("createAnnouncement Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── GET /api/announcements — Public feed ────────────────────────────────────

export async function getAnnouncements(req, res) {
  try {
    const { type, category, search, page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Public feed: only active accepted posts
    const filter = {
      status: "accepted",
      cancelledByUser: false,
      userConfirmed: false,
      closedByUser: false,
      isReturned: false,
    };

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

    if (search && typeof search === "string" && search.trim().length > 0) {
      filter.$text = { $search: search.trim() };
    }

    const [announcements, total] = await Promise.all([
      Announcement.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("author", "firstName lastName userAvatar")
        .lean(),
      Announcement.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: announcements,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("getAnnouncements Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── GET /api/announcements/stats ────────────────────────────────────────────

export async function getAnnouncementStats(req, res) {
  try {
    const stats = await computeStats();
    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    console.error("getAnnouncementStats Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── GET /api/announcements/my ───────────────────────────────────────────────

export async function getMyAnnouncements(req, res) {
  try {
    const userId = req.user.id;
    const { status, page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = { author: userId };

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
        .populate("reviewedBy", "username")
        .lean(),
      Announcement.countDocuments(filter),
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
    });
  } catch (err) {
    console.error("getMyAnnouncements Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── PATCH /api/announcements/:id/cancel ─────────────────────────────────────
/**
 * User withdraws a PENDING announcement (before admin ever sees it).
 *
 * ✅ Allowed:  status = "pending" only
 * ❌ Blocked:  accepted → use /close instead
 *             rejected, confirmed, closed, already cancelled
 *
 * Images: DELETED immediately (post was never public).
 * Admin after: view or hard-delete only — cannot reactivate.
 */
export async function cancelAnnouncement(req, res) {
  try {
    const userId = req.user.id;
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

    if (announcement.author.toString() !== userId) {
      return res
        .status(403)
        .json({
          success: false,
          error: "FORBIDDEN",
          message: "You can only cancel your own announcements.",
        });
    }

    if (announcement.cancelledByUser) {
      return res
        .status(400)
        .json({
          success: false,
          error: "ALREADY_CANCELLED",
          message: "This announcement is already cancelled.",
        });
    }

    if (announcement.userConfirmed) {
      return res
        .status(400)
        .json({
          success: false,
          error: "ALREADY_CONFIRMED",
          message: "Cannot cancel a confirmed announcement.",
        });
    }

    if (announcement.closedByUser) {
      return res
        .status(400)
        .json({
          success: false,
          error: "ALREADY_CLOSED",
          message: "This announcement is already closed.",
        });
    }

    if (announcement.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message:
          announcement.status === "accepted"
            ? "Active announcements cannot be cancelled. Use /close if you want to stop searching."
            : "Only pending announcements can be cancelled.",
      });
    }

    announcement.cancelledByUser = true;
    announcement.cancelledAt = new Date();
    await announcement.save();

    // Images deleted — post was never public, no reason to keep files.
    deleteAnnouncementImages(announcement.images);

    return res.status(200).json({
      success: true,
      message: "Announcement cancelled successfully.",
      data: { id: announcement._id, displayStatus: "cancelled" },
    });
  } catch (err) {
    console.error("cancelAnnouncement Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── PATCH /api/announcements/:id/close ──────────────────────────────────────
/**
 * User closes an ACCEPTED announcement — "I gave up / didn't find it."
 *
 * ✅ Allowed:  status = "accepted", not already closed/confirmed/cancelled
 * ❌ Blocked:  pending → use /cancel instead
 *
 * Images: KEPT (post was real and public — historical record).
 * Admin after: CAN reactivate via PATCH /api/admin/announcements/:id/reactivate
 *
 * Body: { reason?: string (max 300 chars) }
 */
export async function closeAnnouncement(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

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

    if (announcement.author.toString() !== userId) {
      return res
        .status(403)
        .json({
          success: false,
          error: "FORBIDDEN",
          message: "You can only close your own announcements.",
        });
    }

    if (announcement.cancelledByUser) {
      return res
        .status(400)
        .json({
          success: false,
          error: "ALREADY_CANCELLED",
          message: "This announcement is already cancelled.",
        });
    }

    if (announcement.userConfirmed) {
      return res
        .status(400)
        .json({
          success: false,
          error: "ALREADY_CONFIRMED",
          message: "Cannot close a confirmed announcement.",
        });
    }

    if (announcement.closedByUser) {
      return res
        .status(400)
        .json({
          success: false,
          error: "ALREADY_CLOSED",
          message: "This announcement is already closed.",
        });
    }

    if (announcement.status !== "accepted") {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message:
          announcement.status === "pending"
            ? "Your post is still pending admin review. Use /cancel if you want to withdraw it."
            : "Only active (accepted) announcements can be closed.",
      });
    }

    if (reason && reason.trim().length > 300) {
      return res
        .status(400)
        .json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Reason must not exceed 300 characters.",
        });
    }

    announcement.closedByUser = true;
    announcement.closedAt = new Date();
    announcement.closedReason = reason?.trim() || null;
    await announcement.save();

    // Images KEPT — post was public and real.
    notifyStatsUpdate();

    return res.status(200).json({
      success: true,
      message:
        "Your announcement has been closed and removed from the public feed.",
      data: { id: announcement._id, displayStatus: "closed" },
    });
  } catch (err) {
    console.error("closeAnnouncement Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── PATCH /api/announcements/:id/confirm ────────────────────────────────────
/**
 * User confirms they found their item / item was returned.
 * Only on accepted, non-cancelled, non-closed announcements.
 * Images KEPT. Admin cannot reactivate after this.
 */
export async function confirmAnnouncement(req, res) {
  try {
    const userId = req.user.id;
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

    if (announcement.author.toString() !== userId) {
      return res
        .status(403)
        .json({
          success: false,
          error: "FORBIDDEN",
          message: "You can only confirm your own announcements.",
        });
    }

    if (announcement.status !== "accepted") {
      return res
        .status(400)
        .json({
          success: false,
          error: "INVALID_STATE",
          message:
            "Only accepted announcements can be confirmed. Wait for admin approval first.",
        });
    }

    if (announcement.cancelledByUser) {
      return res
        .status(400)
        .json({
          success: false,
          error: "ALREADY_CANCELLED",
          message: "Cannot confirm a cancelled announcement.",
        });
    }

    if (announcement.closedByUser) {
      return res
        .status(400)
        .json({
          success: false,
          error: "ALREADY_CLOSED",
          message: "Cannot confirm a closed announcement.",
        });
    }

    if (announcement.userConfirmed) {
      return res
        .status(400)
        .json({
          success: false,
          error: "ALREADY_CONFIRMED",
          message: "This announcement is already confirmed.",
        });
    }

    announcement.userConfirmed = true;
    announcement.userConfirmedAt = new Date();
    await announcement.save();

    notifyStatsUpdate();

    return res.status(200).json({
      success: true,
      message:
        "Thank you! Your announcement has been marked as resolved and removed from the public feed.",
      data: { id: announcement._id, displayStatus: "confirmed" },
    });
  } catch (err) {
    console.error("confirmAnnouncement Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── PATCH /api/announcements/:id/resubmit ───────────────────────────────────
/**
 * Author re-appeals a REJECTED announcement → back to pending.
 * Not allowed if cancelled, closed, or confirmed.
 */
export async function resubmitAnnouncement(req, res) {
  try {
    const userId = req.user.id;
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

    if (announcement.author.toString() !== userId) {
      return res
        .status(403)
        .json({
          success: false,
          error: "FORBIDDEN",
          message: "You can only resubmit your own announcements.",
        });
    }

    if (announcement.status !== "rejected") {
      return res
        .status(400)
        .json({
          success: false,
          error: "INVALID_STATE",
          message: "Only rejected announcements can be resubmitted for review.",
        });
    }

    if (announcement.cancelledByUser || announcement.closedByUser) {
      return res
        .status(400)
        .json({
          success: false,
          error: "INVALID_STATE",
          message: "Cancelled or closed announcements cannot be resubmitted.",
        });
    }

    announcement.status = "pending";
    announcement.rejectionReason = null;
    announcement.reviewedBy = null;
    announcement.reviewedAt = null;

    if (req.files && req.files.length > 0) {
      announcement.images = buildImagePaths(req.files);
    }

    await announcement.save();

    return res.status(200).json({
      success: true,
      message:
        "Your announcement has been resubmitted and is pending admin review.",
      data: { id: announcement._id, displayStatus: "pending" },
    });
  } catch (err) {
    console.error("resubmitAnnouncement Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}
