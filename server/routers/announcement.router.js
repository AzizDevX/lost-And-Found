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
  closeWithoutMatchAnnouncement,
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
 */
Router.patch("/announcements/:id/cancel", authMiddleware, cancelAnnouncement);

/**
 * PATCH /api/announcements/:id/close-without-match
 */
Router.patch(
  "/announcements/:id/close-without-match",
  authMiddleware,
  closeWithoutMatchAnnouncement,
);

/**
 * PATCH /api/announcements/:id/confirm
 */
Router.patch("/announcements/:id/confirm", authMiddleware, confirmAnnouncement);

/**
 * PATCH /api/announcements/:id/resubmit
 */
Router.patch(
  "/announcements/:id/resubmit",
  authMiddleware,
  announcementUpload.array("images", 5),
  handleUploadError,
  resubmitAnnouncement,
);

export default Router;
