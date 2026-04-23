import Joi from "joi";
import {
  ANNOUNCEMENT_TYPES,
  ANNOUNCEMENT_CATEGORIES,
} from "../models/announcement.model.js";

// ─── Tunisian phone validator ─────────────────────────────────────────────────

function isValidTunisianPhone(phone) {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  let digits = cleaned;
  if (cleaned.startsWith("+216")) digits = cleaned.slice(4);
  else if (cleaned.startsWith("00216")) digits = cleaned.slice(5);
  if (digits.length !== 8) return false;
  if (!/^[234579]/.test(digits)) return false;
  if (/^(.)\1{7}$/.test(digits)) return false;
  return /^\d{8}$/.test(digits);
}

// ─── Create Announcement schema ───────────────────────────────────────────────

const createAnnouncementSchema = Joi.object({
  type: Joi.string()
    .valid(...ANNOUNCEMENT_TYPES)
    .required()
    .messages({
      "any.only": `Type must be one of: ${ANNOUNCEMENT_TYPES.join(", ")}.`,
      "any.required": "Type is required (lost or found).",
    }),

  category: Joi.string()
    .valid(...ANNOUNCEMENT_CATEGORIES)
    .required()
    .messages({
      "any.only": `Category must be one of: ${ANNOUNCEMENT_CATEGORIES.join(", ")}.`,
      "any.required": "Category is required.",
    }),

  description: Joi.string().min(10).max(1000).trim().required().messages({
    "string.min": "Description must be at least 10 characters.",
    "string.max": "Description must not exceed 1000 characters.",
    "any.required": "Description is required.",
  }),

  contact: Joi.object({
    facebook: Joi.string().trim().max(100).allow("", null).optional(),
    instagram: Joi.string().trim().max(100).allow("", null).optional(),
    phone: Joi.string()
      .trim()
      .max(20)
      .allow("", null)
      .optional()
      .custom((value, helpers) => {
        if (value && value.trim() !== "" && !isValidTunisianPhone(value)) {
          return helpers.error("any.invalid");
        }
        return value;
      })
      .messages({
        "any.invalid":
          "Invalid phone number. Tunisian format required (e.g. 20 123 456 or +216 20 123 456).",
      }),
    email: Joi.string()
      .email()
      .trim()
      .lowercase()
      .max(100)
      .allow("", null)
      .optional()
      .messages({
        "string.email": "Contact email must be a valid email address.",
      }),
  })
    .required()
    .custom((value, helpers) => {
      // At least one contact method must be non-empty
      const hasContact = Object.values(value).some(
        (v) => v && v.toString().trim() !== "",
      );
      if (!hasContact) {
        return helpers.error("object.min");
      }
      return value;
    })
    .messages({
      "object.min":
        "At least one contact method is required (facebook, instagram, phone, or email).",
      "any.required": "Contact information is required.",
    }),
});

// ─── Admin review schema ──────────────────────────────────────────────────────

const reviewAnnouncementSchema = Joi.object({
  status: Joi.string().valid("accepted", "rejected").required().messages({
    "any.only": "Status must be 'accepted' or 'rejected'.",
    "any.required": "Status is required.",
  }),
  rejectionReason: Joi.when("status", {
    is: "rejected",
    then: Joi.string().trim().min(5).max(300).optional().messages({
      "string.min": "Rejection reason must be at least 5 characters.",
      "string.max": "Rejection reason must not exceed 300 characters.",
    }),
    otherwise: Joi.forbidden(),
  }),
  isReturned: Joi.boolean().optional(),
});

// ─── Mark returned schema (separate endpoint) ─────────────────────────────────

const markReturnedSchema = Joi.object({
  isReturned: Joi.boolean().required().messages({
    "any.required": "isReturned (true/false) is required.",
  }),
});

// ─── Middleware factories ─────────────────────────────────────────────────────

export function validateCreateAnnouncement(req, res, next) {
  // Multer delivers multipart fields as flat strings — bracket notation is NOT
  // automatically expanded into nested objects (unlike express.urlencoded with
  // extended:true).  We normalise here so Joi sees the shape it expects.
  //
  // Supports both notations the client might send:
  //   contact[facebook]  → req.body["contact[facebook]"]   (bracket string key)
  //   contact.facebook   → req.body.contact already a string (rare, ignore)
  if (!req.body.contact || typeof req.body.contact !== "object") {
    req.body.contact = {
      facebook:
        req.body["contact[facebook]"] ?? req.body.contact_facebook ?? null,
      instagram:
        req.body["contact[instagram]"] ?? req.body.contact_instagram ?? null,
      phone: req.body["contact[phone]"] ?? req.body.contact_phone ?? null,
      email: req.body["contact[email]"] ?? req.body.contact_email ?? null,
    };
  }

  // Images are validated separately (via multer + custom check in controller)
  const { error, value } = createAnnouncementSchema.validate(req.body, {
    abortEarly: true,
    stripUnknown: true,
  });

  if (error) {
    // Clean up any uploaded files if validation fails
    if (req.files?.length) {
      import("fs").then(({ default: fs }) => {
        req.files.forEach((f) => {
          try {
            fs.unlinkSync(f.path);
          } catch {}
        });
      });
    }
    return res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: error.details[0].message,
    });
  }

  req.body = value;
  next();
}

export function validateReviewAnnouncement(req, res, next) {
  const { error, value } = reviewAnnouncementSchema.validate(req.body, {
    abortEarly: true,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: error.details[0].message,
    });
  }

  req.body = value;
  next();
}

export function validateMarkReturned(req, res, next) {
  const { error, value } = markReturnedSchema.validate(req.body, {
    abortEarly: true,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: error.details[0].message,
    });
  }

  req.body = value;
  next();
}
