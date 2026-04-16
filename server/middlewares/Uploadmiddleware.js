import multer from "multer";
import path from "path";
import fs from "fs";

/**
 * Creates a multer upload middleware for any destination folder.
 *
 * @param {Function} getFolderPath - (req) => string : dynamic folder path based on request
 * @param {Object} options
 * @param {number} options.maxSizeMB - max file size in MB (default: 5)
 * @param {string[]} options.allowedTypes - allowed mime types (default: images only)
 * @param {string} options.filename - custom filename without extension (default: Date.now)
 */
export function createUploader(getFolderPath, options = {}) {
  const {
    maxSizeMB = 5,
    allowedTypes = ["image/jpeg", "image/png", "image/webp"],
    filename = null,
  } = options;

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const folderPath = getFolderPath(req);
      fs.mkdirSync(folderPath, { recursive: true });
      cb(null, folderPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = filename ? filename : Date.now();
      cb(null, `${name}${ext}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(`Invalid file type. Allowed: ${allowedTypes.join(", ")}`),
        false,
      );
    }
  };

  return multer({
    storage,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter,
  });
}
