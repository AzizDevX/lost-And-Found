import Joi from "joi";

const LICENSE_SPECIALTIES = ["glsi", "bd", "isr"];
const MASTER_SPECIALTIES = ["cloud", "cyber"];

function validateEditAccountData(req, res, next) {
  if (req.file) return next();

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      success: false,
      message: "No data provided for validation.",
    });
  }

  const schema = Joi.object({
    firstName: Joi.string().min(2).max(50).trim(),
    lastName: Joi.string().min(2).max(50).trim(),
    userAvatar: Joi.string().min(2).max(500).trim(),
    email: Joi.string()
      .pattern(/^[a-zA-Z0-9._%+-]+@ted-university\.com$/)
      .message("Email must be a valid @ted-university.com address."),
    year: Joi.valid("L1", "L2", "L3", "M1", "M2", null, ""),
    specialty: Joi.valid(
      ...LICENSE_SPECIALTIES,
      ...MASTER_SPECIALTIES,
      null,
      "",
    ),
    currentPassword: Joi.string().min(6).max(100),
    newPassword: Joi.string().min(6).max(100),
  })
    .min(1)
    .custom((value, helpers) => {
      if (value.newPassword && !value.currentPassword) {
        return helpers.error("any.invalid", {
          message: "currentPassword is required to set a new password.",
        });
      }
      if (value.currentPassword && !value.newPassword) {
        return helpers.error("any.invalid", {
          message: "newPassword is required when currentPassword is provided.",
        });
      }

      // Year + specialty combo validation
      const { year, specialty } = value;
      if (year && specialty) {
        const isLicense = ["L1", "L2", "L3"].includes(year);
        const isMaster = ["M1", "M2"].includes(year);

        if (isLicense && !LICENSE_SPECIALTIES.includes(specialty)) {
          return helpers.error("any.invalid", {
            message: `Specialty '${specialty}' is not valid for ${year}. Choose one of: ${LICENSE_SPECIALTIES.join(", ")}.`,
          });
        }

        if (isMaster && !MASTER_SPECIALTIES.includes(specialty)) {
          return helpers.error("any.invalid", {
            message: `Specialty '${specialty}' is not valid for ${year}. Choose one of: ${MASTER_SPECIALTIES.join(", ")}.`,
          });
        }
      }

      return value;
    });

  const { error } = schema.validate(req.body, { abortEarly: true });

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  next();
}

export default validateEditAccountData;
