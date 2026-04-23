import jwt from "jsonwebtoken";

/**
 * authMiddleware — verifies the user access token.
 * Ban state is NOT checked here; it is checked per-controller
 * (e.g. createAnnouncement) to keep this middleware lean.
 * Permanent bans never auto-expire so no extra DB fetch is needed.
 */
export function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({
          success: false,
          error: "ACCESS_TOKEN_MISSING",
          message: "No access token provided. Please login.",
        });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({
            success: false,
            error: "ACCESS_TOKEN_EXPIRED",
            message: "Access token expired. Please refresh your token.",
          });
      }
      return res
        .status(401)
        .json({
          success: false,
          error: "ACCESS_TOKEN_INVALID",
          message: "Access token is invalid.",
        });
    }

    req.user = { id: decoded.id };
    next();
  } catch (err) {
    console.error("authMiddleware Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
  }
}
