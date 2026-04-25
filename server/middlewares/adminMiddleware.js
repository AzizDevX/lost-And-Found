import jwt from "jsonwebtoken";
import Admin from "../models/admin.model.js";

/**
 * adminMiddleware
 *
 * Verifies the admin access token.
 * Populates req.admin = { id, role, username } for downstream use
 * (controllers + audit logger need username).
 *
 * We load the admin record once here so we don't repeat the DB call
 * in every controller. The record is lean — only non-sensitive fields.
 */
export async function adminMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "ACCESS_TOKEN_MISSING",
        message: "No access token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ADMIN_ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          error: "ACCESS_TOKEN_EXPIRED",
          message: "Access token expired. Please refresh your token.",
        });
      }
      return res.status(401).json({
        success: false,
        error: "ACCESS_TOKEN_INVALID",
        message: "Access token is invalid.",
      });
    }

    if (!decoded.isAdmin) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "This route is restricted to admins.",
      });
    }

    const admin = await Admin.findById(decoded.id)
      .select("username role isActive")
      .lean();

    if (!admin || !admin.isActive) {
      return res.status(403).json({
        success: false,
        error: "ACCOUNT_DISABLED",
        message: "Admin account not found or has been disabled.",
      });
    }

    req.admin = {
      id: admin._id.toString(),
      role: admin.role,
      username: admin.username,
    };

    next();
  } catch (err) {
    console.error("adminMiddleware Error:", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.admin?.role !== role) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: `This action requires the '${role}' role.`,
      });
    }
    next();
  };
}
