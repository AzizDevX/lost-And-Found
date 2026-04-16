import mongoose from "mongoose";

const YEAR_SPECIALTIES = {
  L1: ["glsi", "bd", "isr"],
  L2: ["glsi", "bd", "isr"],
  L3: ["glsi", "bd", "isr"],
  M1: ["cloud", "cyber"],
  M2: ["cloud", "cyber"],
};

const studentDetailsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    year: {
      type: String,
      default: null,
      enum: ["L1", "L2", "L3", "M1", "M2", null],
    },

    specialty: {
      type: String,
      default: null,
      enum: ["glsi", "bd", "isr", "cloud", "cyber", null],
      validate: {
        validator: function (value) {
          if (!value || !this.year) return true;
          return YEAR_SPECIALTIES[this.year]?.includes(value);
        },
        message: function (props) {
          return `'${props.value}' is not a valid specialty for the selected year.`;
        },
      },
    },
  },
  { timestamps: true },
);

export const YEAR_SPECIALTIES_MAP = YEAR_SPECIALTIES;

const StudentDetails =
  mongoose.models.StudentDetails ||
  mongoose.model("StudentDetails", studentDetailsSchema);

export default StudentDetails;
