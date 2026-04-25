import multer from "multer";
import path from "path";
import fs from "fs";

/**
 *
 * @param {Function} getFolderPath
 * @param {Object} options
 * @param {number} options.maxSizeMB
 * @param {string[]} options.allowedTypes
 * @param {string} options.filename
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
