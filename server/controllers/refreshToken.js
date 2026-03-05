import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Access_Token, Refresh_Token } from "../controllers/auth.js";
import userModel from "../models/user.model.js";
import UserSession from "../models/userSession.model.js";

export async function Refresh(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: "REFRESH_TOKEN_MISSING",
        message: "No refresh token provided. Please login again.",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: "INVALID_REFRESH_TOKEN",
        message: "Refresh token is invalid or expired.",
      });
    }

    const session = await UserSession.findOne({
      sessionId: decoded.sessionId,
    }).select("+hashedRefreshToken");

    if (!session) {
      return res.status(401).json({
        success: false,
        error: "SESSION_NOT_FOUND",
        message: "Session no longer exists. Please login again.",
      });
    }

    if (session.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        error: "SESSION_EXPIRED",
        message: "Session expired. Please login again.",
      });
    }

    const valid = await bcrypt.compare(
      refreshToken,
      session.hashedRefreshToken,
    );

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: "REFRESH_TOKEN_MISMATCH",
        message: "Refresh token does not match session.",
      });
    }

    const user = await userModel.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "USER_NOT_FOUND",
        message: "User associated with this session was not found.",
      });
    }

    const accessToken = Access_Token(user);
    const newRefreshToken = Refresh_Token(user, session.sessionId);

    const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 12);

    const refreshDecoded = jwt.decode(newRefreshToken);
    const expiresAt = new Date(refreshDecoded.exp * 1000);

    session.hashedRefreshToken = hashedRefreshToken;
    session.expiresAt = expiresAt;

    await session.save();

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: expiresAt,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully.",
      accessToken,
    });
  } catch (err) {
    console.error("Refresh Error:", err);

    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}
