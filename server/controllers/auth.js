import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import userModel from "../models/user.model.js";

function Access_Token(user) {
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

function Refresh_Token(user) {
  return jwt.sign(
    {
      id: user._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES || "7d",
    },
  );
}

export async function Register(req, res) {
  try {
    const salt = await bcrypt.genSalt(12);
    const Email = req.body.email;
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    const existingUser = await userModel.findOne({ email: Email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "EMAIL_ALREADY_EXISTS",
        message: "This email is already in use. Try logging in instead.",
      });
    }

    const user = new userModel({
      userAvatar: req.body.userAvatar,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: Email,
      password: hashedPassword,
      isBanned: false,
    });
    await user.save();
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
    });
  } catch (err) {
    console.error(`Error In Auth.js : ${err}`);
    return res.status(500).json({ message: "Internal server error" });
  }
}
