import path from "path";
import fs from "fs";
import multer from "multer";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 5;
const MAX_FILES = 5;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = path.join("uploads", "announcements", req.user.id);
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, and WEBP images are allowed.",
      ),
      false,
    );
  }
};

export const announcementUpload = multer({
  storage,
  limits: {
    fileSize: MAX_SIZE_MB * 1024 * 1024,
    files: MAX_FILES,
  },
  fileFilter,
});

/**
 * Express error handler for multer errors.
 * Attach after the upload middleware in routes.
 */
export function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "FILE_TOO_LARGE",
        message: `Each image must be under ${MAX_SIZE_MB} MB.`,
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        error: "TOO_MANY_FILES",
        message: `You can upload a maximum of ${MAX_FILES} images.`,
      });
    }
    return res.status(400).json({
      success: false,
      error: "UPLOAD_ERROR",
      message: err.message,
    });
  }

  if (err && err.message?.includes("Invalid file type")) {
    return res.status(400).json({
      success: false,
      error: "INVALID_FILE_TYPE",
      message: err.message,
    });
  }

  next(err);
}
