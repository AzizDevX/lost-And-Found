import mongoose from "mongoose";

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

    userConfirmed: {
      type: Boolean,
      default: false,
      index: true,
    },

    userConfirmedAt: {
      type: Date,
      default: null,
    },

    cancelledByUser: {
      type: Boolean,
      default: false,
      index: true,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    closedWithoutMatch: {
      type: Boolean,
      default: false,
      index: true,
    },

    closedWithoutMatchAt: {
      type: Date,
      default: null,
    },

    closedWithoutMatchReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
  },
  { timestamps: true },
);

announcementSchema.index({ status: 1, createdAt: -1 });
announcementSchema.index({ status: 1, type: 1, createdAt: -1 });
announcementSchema.index({ status: 1, category: 1, createdAt: -1 });
announcementSchema.index({ status: 1, isReturned: 1 });
announcementSchema.index({
  status: 1,
  cancelledByUser: 1,
  userConfirmed: 1,
  closedWithoutMatch: 1,
  createdAt: -1,
});
announcementSchema.index({ author: 1, createdAt: -1 });

const Announcement =
  mongoose.models.Announcement ||
  mongoose.model("Announcement", announcementSchema);

export default Announcement;
