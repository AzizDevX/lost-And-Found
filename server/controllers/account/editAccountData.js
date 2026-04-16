import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import userModel from "../../models/user.model.js";
import StudentDetails from "../../models/Studentdetails.model.js";

export async function editAccountData(req, res) {
  try {
    const userId = req.user.id;

    const {
      firstName,
      lastName,
      year,
      specialty,
      currentPassword,
      newPassword,
    } = req.body;

    const user = await userModel.findById(userId).select("+password");

    if (!user) {
      if (req.file) fs.unlinkSync(req.file.path);

      return res.status(404).json({
        success: false,
        error: "USER_NOT_FOUND",
        message: "User not found.",
      });
    }

    if (currentPassword !== undefined && newPassword !== undefined) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        if (req.file) fs.unlinkSync(req.file.path);

        return res.status(400).json({
          success: false,
          error: "INVALID_PASSWORD",
          message: "Current password is incorrect.",
        });
      }

      user.password = await bcrypt.hash(newPassword, 12);
    }

    if (req.file) {
      if (user.userAvatar) {
        const oldImagePath = path.join(process.cwd(), user.userAvatar);
        const isDefault = user.userAvatar.includes("default.png");

        if (!isDefault && fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      user.userAvatar = req.file.path.replace(/\\/g, "/");
    }

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;

    await user.save();

    if (year !== undefined || specialty !== undefined) {
      const normalizedYear = year === "" || year === null ? null : year;
      const normalizedSpecialty =
        specialty === "" || specialty === null ? null : specialty;

      let details = await StudentDetails.findOne({ user: userId });

      if (details) {
        const updatedYear = year !== undefined ? normalizedYear : details.year;
        const updatedSpecialty =
          specialty !== undefined ? normalizedSpecialty : details.specialty;

        await StudentDetails.findOneAndUpdate(
          { user: userId },
          { year: updatedYear, specialty: updatedSpecialty },
          { returnDocument: "after", runValidators: true, context: "query" },
        );
      } else {
        await StudentDetails.create({
          user: userId,
          year: normalizedYear ?? null,
          specialty: normalizedSpecialty ?? null,
        });
      }
    }

    const updatedDetails = await StudentDetails.findOne({ user: userId });

    return res.status(200).json({
      success: true,
      message: "Account updated successfully.",
      data: {
        userAvatar: user.userAvatar,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        year: updatedDetails?.year ?? null,
        specialty: updatedDetails?.specialty ?? null,
      },
    });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error("editAccountData Error:", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
}
