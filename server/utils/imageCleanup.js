import fs from "fs";
import path from "path";

/**
 *
 * @param {string[]} images
 */
export function deleteAnnouncementImages(images = []) {
  if (!images || images.length === 0) return;

  for (const imgPath of images) {
    try {
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    } catch (err) {
      console.warn(
        `[imageCleanup] Could not delete "${imgPath}":`,
        err.message,
      );
    }
  }

  try {
    const folder = path.dirname(images[0]);
    if (fs.existsSync(folder)) {
      const remaining = fs.readdirSync(folder);
      if (remaining.length === 0) {
        fs.rmdirSync(folder);
      }
    }
  } catch {}
}
