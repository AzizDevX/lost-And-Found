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
  adminMarkReturned,
  adminDeleteAnnouncement,
  adminCloseWithoutMatch,
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

Router.get("/announcements", adminMiddleware, adminListAnnouncements);

/** GET /api/admin/announcements/:id */
Router.get("/announcements/:id", adminMiddleware, adminGetAnnouncement);

/**
 * PATCH /api/admin/announcements/:id/review

 */
Router.patch(
  "/announcements/:id/review",
  adminMiddleware,
  validateReviewAnnouncement,
  adminReviewAnnouncement,
);

/**
 * PATCH /api/admin/announcements/:id/returned

 */
Router.patch(
  "/announcements/:id/returned",
  adminMiddleware,
  validateMarkReturned,
  adminMarkReturned,
);

/**
 * PATCH /api/admin/announcements/:id/admin-close

 */
Router.patch(
  "/announcements/:id/admin-close",
  adminMiddleware,
  adminCloseWithoutMatch,
);

/**
 * DELETE /api/admin/announcements/:id

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
