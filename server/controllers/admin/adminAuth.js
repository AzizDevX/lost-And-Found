import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Joi from "joi";
import Admin from "../../models/admin.model.js";
import AdminLog from "../../models/adminLog.model.js";

// ─── Validation schema ────────────────────────────────────────────────────────

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    "string.email": "Please provide a valid email address.",
    "any.required": "Email is required.",
  }),
  password: Joi.string().min(8).max(100).required().messages({
    "string.min": "Password must be at least 8 characters.",
    "any.required": "Password is required.",
  }),
});

// ─── Internal: write auth log (doesn't use req.admin — not set at login time) ─

async function writeAuthLog(req, admin, action) {
  try {
    await AdminLog.create({
      admin: admin._id,
      adminUsername: admin.username,
      adminRole: admin.role,
      action,
      targetType: "Auth",
      targetId: admin._id,
      targetLabel: admin.email,
      meta: {},
      ip: req.ip || req.socket?.remoteAddress || null,
      userAgent: (req.headers["user-agent"] || "").slice(0, 300) || null,
    });
  } catch (err) {
    console.error("[AdminLog] Auth log failed:", err.message);
  }
}

// ─── Admin Login ──────────────────────────────────────────────────────────────

export async function adminLogin(req, res) {
  try {
    const { error, value } = loginSchema.validate(req.body, {
      abortEarly: true,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: error.details[0].message,
      });
    }

    const { email, password } = value;
    const admin = await Admin.findOne({ email }).select("+password");

    if (!admin) {
      return res
        .status(401)
        .json({
          success: false,
          error: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        });
    }

    if (!admin.isActive) {
      return res
        .status(403)
        .json({
          success: false,
          error: "ACCOUNT_DISABLED",
          message: "This admin account has been disabled.",
        });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({
          success: false,
          error: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        });
    }

    const accessToken = jwt.sign(
      { id: admin._id, role: admin.role, isAdmin: true },
      process.env.ADMIN_ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      { id: admin._id, isAdmin: true },
      process.env.ADMIN_REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" },
    );

    res.cookie("adminRefreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await writeAuthLog(req, admin, "ADMIN_LOGIN");

    return res.status(200).json({
      success: true,
      message: "Admin login successful.",
      data: {
        accessToken,
        admin: {
          id: admin._id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
        },
      },
    });
  } catch (err) {
    console.error("adminLogin Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── Admin Refresh Token ──────────────────────────────────────────────────────

export async function adminRefresh(req, res) {
  try {
    const token = req.cookies?.adminRefreshToken;

    if (!token) {
      return res
        .status(401)
        .json({
          success: false,
          error: "REFRESH_TOKEN_MISSING",
          message: "No refresh token provided.",
        });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ADMIN_REFRESH_TOKEN_SECRET);
    } catch {
      return res
        .status(401)
        .json({
          success: false,
          error: "REFRESH_TOKEN_INVALID",
          message: "Refresh token is invalid or expired.",
        });
    }

    if (!decoded.isAdmin) {
      return res
        .status(403)
        .json({
          success: false,
          error: "FORBIDDEN",
          message: "Token is not an admin token.",
        });
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      return res
        .status(403)
        .json({
          success: false,
          error: "ACCOUNT_DISABLED",
          message: "Admin account not found or disabled.",
        });
    }

    const newAccessToken = jwt.sign(
      { id: admin._id, role: admin.role, isAdmin: true },
      process.env.ADMIN_ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" },
    );

    return res
      .status(200)
      .json({ success: true, data: { accessToken: newAccessToken } });
  } catch (err) {
    console.error("adminRefresh Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}

// ─── Admin Logout ─────────────────────────────────────────────────────────────

export async function adminLogout(req, res) {
  // Try to log even though req.admin might not be set (middleware not applied to logout)
  try {
    const token = req.cookies?.adminRefreshToken;
    if (token) {
      const decoded = jwt.verify(token, process.env.ADMIN_REFRESH_TOKEN_SECRET);
      const admin = await Admin.findById(decoded.id)
        .select("username email role")
        .lean();
      if (admin) await writeAuthLog(req, admin, "ADMIN_LOGOUT");
    }
  } catch {
    /* best-effort */
  }

  res.clearCookie("adminRefreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res
    .status(200)
    .json({ success: true, message: "Admin logged out successfully." });
}
