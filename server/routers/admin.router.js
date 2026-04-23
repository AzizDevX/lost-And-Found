import express from "express";
import {
  adminMiddleware,
  requireRole,
} from "../middlewares/adminMiddleware.js";
import {
  adminLogin,
  adminRefresh,
  adminLogout,
} from "../controllers/admin/adminAuth.js";
import {
  adminListAnnouncements,
  adminGetAnnouncement,
  adminReviewAnnouncement,
  adminReactivateAnnouncement,
  adminMarkReturned,
  adminDeleteAnnouncement,
} from "../controllers/admin/adminAnnouncement.js";
import {
  adminListUsers,
  adminGetUser,
  adminGetUserAnnouncements,
  adminBanUser,
  adminUnbanUser,
} from "../controllers/admin/adminUser.js";
import {
  adminListLogs,
  adminLogsSummary,
} from "../controllers/admin/adminLogs.js";
import {
  validateReviewAnnouncement,
  validateMarkReturned,
} from "../middlewares/validateAnnouncement.js";

const Router = express.Router();

// ── Admin Auth ─────────────────────────────────────────────────────────────────

/** POST /api/admin/auth/login */
Router.post("/auth/login", adminLogin);

/** POST /api/admin/auth/refresh */
Router.post("/auth/refresh", adminRefresh);

/** POST /api/admin/auth/logout */
Router.post("/auth/logout", adminLogout);

// ── Announcement Management ────────────────────────────────────────────────────

/**
 * GET /api/admin/announcements
 * Query: status (pending|accepted|rejected|cancelled|confirmed|closed|all),
 *        type, category, page, limit
 *
 * Status meanings:
 *   pending   — awaiting admin review
 *   accepted  — live on public feed
 *   rejected  — failed review, images deleted
 *   cancelled — user withdrew their PENDING post (images deleted, read-only)
 *   confirmed — user found item (images kept, read-only)
 *   closed    — user gave up on ACCEPTED post (images kept, admin CAN reactivate)
 *   all       — everything
 */
Router.get("/announcements", adminMiddleware, adminListAnnouncements);

/** GET /api/admin/announcements/:id */
Router.get("/announcements/:id", adminMiddleware, adminGetAnnouncement);

/**
 * PATCH /api/admin/announcements/:id/review
 * Body: { status: "accepted"|"rejected", rejectionReason?: string }
 *
 * Allowed transitions:
 *   pending  → accepted  ✓
 *   pending  → rejected  ✓  (images deleted)
 *   accepted → rejected  ✓  (force-reject: images deleted)
 *   rejected → accepted  ✓  (reverse mistaken rejection)
 *
 * NOT allowed — returns 400:
 *   cancelled → any  ✗  (use DELETE to remove)
 *   confirmed → any  ✗  (use DELETE to remove)
 *   closed    → any  ✗  (use /reactivate to restore, or DELETE to remove)
 */
Router.patch(
  "/announcements/:id/review",
  adminMiddleware,
  validateReviewAnnouncement,
  adminReviewAnnouncement,
);

/**
 * PATCH /api/admin/announcements/:id/reactivate
 * Restore a CLOSED announcement back to accepted (active on feed).
 *
 * Only works on closedByUser = true announcements.
 * Images are already kept when user closes — nothing to restore.
 *
 * cancelled and confirmed are permanently read-only — cannot be reactivated.
 */
Router.patch(
  "/announcements/:id/reactivate",
  adminMiddleware,
  adminReactivateAnnouncement,
);

/**
 * PATCH /api/admin/announcements/:id/returned
 * Body: { isReturned: true|false }
 * Toggle "item physically returned" flag.
 * Only on accepted, non-cancelled, non-closed announcements.
 */
Router.patch(
  "/announcements/:id/returned",
  adminMiddleware,
  validateMarkReturned,
  adminMarkReturned,
);

/**
 * DELETE /api/admin/announcements/:id
 * Hard delete — any admin role can delete any announcement regardless of status.
 * Always deletes images from disk.
 * Use for spam, illegal content, or any post that should not exist.
 */
Router.delete("/announcements/:id", adminMiddleware, adminDeleteAnnouncement);

// ── User Management ────────────────────────────────────────────────────────────

/** GET /api/admin/users — Query: search, isBanned, page, limit */
Router.get("/users", adminMiddleware, adminListUsers);

/** GET /api/admin/users/:id */
Router.get("/users/:id", adminMiddleware, adminGetUser);

/** GET /api/admin/users/:id/announcements */
Router.get(
  "/users/:id/announcements",
  adminMiddleware,
  adminGetUserAnnouncements,
);

/** PATCH /api/admin/users/:id/ban — Body: { reason: string (5-300 chars) } */
Router.patch("/users/:id/ban", adminMiddleware, adminBanUser);

/** PATCH /api/admin/users/:id/unban */
Router.patch("/users/:id/unban", adminMiddleware, adminUnbanUser);

// ── Audit Logs — superadmin only ───────────────────────────────────────────────

/** GET /api/admin/logs — Query: adminId, action, targetType, targetId, from, to, page, limit */
Router.get("/logs", adminMiddleware, requireRole("superadmin"), adminListLogs);

/** GET /api/admin/logs/summary — Query: days (1-90, default 7) */
Router.get(
  "/logs/summary",
  adminMiddleware,
  requireRole("superadmin"),
  adminLogsSummary,
);

export default Router;
