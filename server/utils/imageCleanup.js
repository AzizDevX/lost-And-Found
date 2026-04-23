import fs from "fs";
import path from "path";

/**
 * Deletes all image files for an announcement from disk.
 *
 * @param {string[]} images - Array of file paths stored in announcement.images
 */
export function deleteAnnouncementImages(images = []) {
  if (!images || images.length === 0) return;

  for (const imgPath of images) {
    try {
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    } catch (err) {
      // Non-fatal: log but never crash the request
      console.warn(`[imageCleanup] Could not delete "${imgPath}":`, err.message);
    }
  }

  // Best-effort: remove the user's upload folder if it is now empty
  // e.g. uploads/announcements/<userId>/
  try {
    const folder = path.dirname(images[0]);
    if (fs.existsSync(folder)) {
      const remaining = fs.readdirSync(folder);
      if (remaining.length === 0) {
        fs.rmdirSync(folder);
      }
    }
  } catch {
    // ignore — folder cleanup is cosmetic
  }
}
