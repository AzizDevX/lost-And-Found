import userModel from "../../models/user.model.js";
import StudentDetails from "../../models/studentDetails.model.js";

const DEFAULT_AVATAR = "uploads/users/default.png";

export async function getAccountData(req, res) {
  try {
    const userId = req.user.id;

    const user = await userModel.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "USER_NOT_FOUND",
        message: "User not found.",
      });
    }

    const details = await StudentDetails.findOne({ user: userId });

    return res.status(200).json({
      success: true,
      data: {
        userAvatar: user.userAvatar || DEFAULT_AVATAR,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        year: details?.year ?? null,
        specialty: details?.specialty ?? null,
        isBanned: user.isBanned ?? false,
        banExpiresAt: user.banExpiresAt ?? null,
      },
    });
  } catch (err) {
    console.error("getAccountData Error:", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}
