import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import userModel from "../models/user.model.js";
import UserSession from "../models/userSession.model.js";

export function Access_Token(user) {
  return jwt.sign(
    {
      id: user._id,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES || "15m",
    },
  );
}

export function Refresh_Token(user, sessionId) {
  return jwt.sign(
    {
      id: user._id,
      sessionId: sessionId,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES || "7d",
    },
  );
}

export async function Register(req, res) {
  try {
    const email = req.body.email?.toLowerCase().trim();

    const existingUser = await userModel.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "EMAIL_ALREADY_EXISTS",
        message: "This email is already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 12);

    const user = new userModel({
      userAvatar: req.body.userAvatar,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email,
      password: hashedPassword,
      isBanned: false,
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
    });
  } catch (err) {
    console.error(`Register Error: ${err}`);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function Login(req, res) {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const password = req.body.password;

    const user = await userModel.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "INVALID_CREDENTIALS",
        message: "Email or password is incorrect.",
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        error: "ACCOUNT_BANNED",
        message: "Your account has been banned.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(400).json({
        success: false,
        error: "INVALID_CREDENTIALS",
        message: "Email or password is incorrect.",
      });
    }

    const sessionId = uuidv4();

    const refreshToken = Refresh_Token(user, sessionId);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 12);

    const decoded = jwt.decode(refreshToken);
    const expiresAt = new Date(decoded.exp * 1000);

    const session = new UserSession({
      user: user._id,
      sessionId: sessionId,
      hashedRefreshToken: hashedRefreshToken,
      expiresAt: expiresAt,
    });

    await session.save();

    const accessToken = Access_Token(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: expiresAt,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logged in successfully.",
      accessToken,
    });
  } catch (err) {
    console.error(`Login Error: ${err}`);
    return res.status(500).json({ message: "Internal server error" });
  }
}
