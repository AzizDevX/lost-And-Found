import mongoose from "mongoose";

// ─── Constants (mirrors frontend) ─────────────────────────────────────────────

export const ANNOUNCEMENT_TYPES = ["lost", "found"];

export const ANNOUNCEMENT_CATEGORIES = [
  "electronics",
  "clothing",
  "bags",
  "keys",
  "documents",
  "jewelry",
  "books",
  "sports",
  "other",
];

export const ANNOUNCEMENT_STATUSES = ["pending", "accepted", "rejected"];

// ─── Schema ───────────────────────────────────────────────────────────────────

const announcementSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ANNOUNCEMENT_TYPES,
      required: true,
    },

    category: {
      type: String,
      enum: ANNOUNCEMENT_CATEGORIES,
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1000,
    },

    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 5,
        message: "A maximum of 5 images is allowed per announcement.",
      },
    },

    contact: {
      facebook: { type: String, trim: true, maxlength: 100, default: null },
      instagram: { type: String, trim: true, maxlength: 100, default: null },
      phone: { type: String, trim: true, maxlength: 20, default: null },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 100,
        default: null,
      },
    },

    status: {
      type: String,
      enum: ANNOUNCEMENT_STATUSES,
      default: "pending",
      index: true,
    },

    // ── Admin-side resolution ──────────────────────────────────────────────

    /** Admin toggled: item physically returned/claimed. Drives "Objets Rendus" stat. */
    isReturned: {
      type: Boolean,
      default: false,
      index: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    // ── User-side resolution ───────────────────────────────────────────────

    /**
     * Set by the author when the item has been found/returned to them.
     * Once confirmed, the announcement is hidden from the public feed.
     * Admin can only view or delete — cannot reactivate.
     *
     * false  → not yet confirmed by user
     * true   → user confirmed resolution → removed from public feed (permanent)
     */
    userConfirmed: {
      type: Boolean,
      default: false,
      index: true,
    },

    userConfirmedAt: {
      type: Date,
      default: null,
    },

    // ── User-side cancellation (pending only) ──────────────────────────────

    /**
     * Author withdrew their OWN PENDING announcement before admin review.
     * This is the only situation where "cancelled" applies.
     *
     * Rules:
     *   - Only allowed when status = "pending".
     *   - Images deleted immediately (announcement was never public).
     *   - Admin can only view or delete — cannot reactivate.
     *
     * For accepted announcements the user closes them via `closedByUser` below.
     */
    cancelledByUser: {
      type: Boolean,
      default: false,
      index: true,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    // ── User-side closure (accepted, gave up / no match found) ────────────

    /**
     * Author closes an ACCEPTED announcement — they didn't find their item
     * or gave up searching. "Close without match / not found."
     *
     * Key differences from cancelledByUser:
     *   - Only allowed when status = "accepted".
     *   - Images are KEPT (the post was public and real).
     *   - Admin CAN reactivate it back to accepted (unlike cancelled/confirmed).
     *
     * false  → not closed by user
     * true   → user closed without resolution → hidden from public feed,
     *          but admin can reopen it.
     */
    closedByUser: {
      type: Boolean,
      default: false,
      index: true,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    closedReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
  },
  { timestamps: true },
);

// ─── Indexes for feed queries ─────────────────────────────────────────────────

announcementSchema.index({ status: 1, createdAt: -1 });
announcementSchema.index({ status: 1, type: 1, createdAt: -1 });
announcementSchema.index({ status: 1, category: 1, createdAt: -1 });
announcementSchema.index({ status: 1, isReturned: 1 });
// Public feed: exclude user-cancelled, user-confirmed, and user-closed
announcementSchema.index({
  status: 1,
  cancelledByUser: 1,
  userConfirmed: 1,
  closedByUser: 1,
  createdAt: -1,
});
// For author's history view
announcementSchema.index({ author: 1, createdAt: -1 });

const Announcement =
  mongoose.models.Announcement ||
  mongoose.model("Announcement", announcementSchema);

export default Announcement;
