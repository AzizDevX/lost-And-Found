import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  announcementUpload,
  handleUploadError,
} from "../middlewares/announcementUpload.js";
import { validateCreateAnnouncement } from "../middlewares/validateAnnouncement.js";
import {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementStats,
  statsLiveSSE,
  getMyAnnouncements,
  cancelAnnouncement,
  closeAnnouncement,
  confirmAnnouncement,
  resubmitAnnouncement,
} from "../controllers/announcement/announcement.js";

const Router = express.Router();

// ── Public routes ──────────────────────────────────────────────────────────────

/** GET /api/announcements — Public feed (accepted, active, not closed/confirmed) */
Router.get("/announcements", getAnnouncements);

/** GET /api/announcements/stats — REST snapshot of home-page stats */
Router.get("/announcements/stats", getAnnouncementStats);

/**
 * GET /api/announcements/stats/live
 * Server-Sent Events stream — pushes a fresh stats snapshot on every change.
 */
Router.get("/announcements/stats/live", statsLiveSSE);

// ── Authenticated routes ───────────────────────────────────────────────────────

/**
 * POST /api/announcement
 * Create a new announcement (status: pending by default).
 * multipart/form-data — field "images" (1–5 files, JPEG/PNG/WEBP, ≤5 MB each).
 */
Router.post(
  "/announcement",
  authMiddleware,
  announcementUpload.array("images", 5),
  handleUploadError,
  validateCreateAnnouncement,
  createAnnouncement,
);

/** GET /api/announcements/my — Author's full history */
Router.get("/announcements/my", authMiddleware, getMyAnnouncements);

/**
 * PATCH /api/announcements/:id/cancel
 * Author withdraws a PENDING announcement before admin reviews it.
 * ✅ pending only.  ❌ accepted → use /close instead.
 * Images deleted.  Admin: view or delete only (cannot reactivate).
 */
Router.patch("/announcements/:id/cancel", authMiddleware, cancelAnnouncement);

/**
 * PATCH /api/announcements/:id/close
 * Author closes an ACCEPTED announcement — "I gave up / didn't find it."
 * ✅ accepted only.  ❌ pending → use /cancel instead.
 * Images KEPT.  Admin CAN reactivate via admin /reactivate route.
 * Body: { reason?: string (max 300 chars) }
 */
Router.patch("/announcements/:id/close", authMiddleware, closeAnnouncement);

/**
 * PATCH /api/announcements/:id/confirm
 * Author confirms item was found / returned to them.
 * ✅ accepted only.
 * Images KEPT.  Admin: view or delete only (cannot reactivate).
 */
Router.patch("/announcements/:id/confirm", authMiddleware, confirmAnnouncement);

/**
 * PATCH /api/announcements/:id/resubmit
 * Author re-appeals a REJECTED announcement — puts it back to "pending".
 * Optionally accepts new images (multipart/form-data, field "images").
 * ❌ cancelled, closed, confirmed cannot be resubmitted.
 */
Router.patch(
  "/announcements/:id/resubmit",
  authMiddleware,
  announcementUpload.array("images", 5),
  handleUploadError,
  resubmitAnnouncement,
);

export default Router;
