import mongoose from "mongoose";

const referralCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    isActive: { type: Boolean, default: true },
    isUsed: { type: Boolean, default: false, index: true },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    usedAt: { type: Date, default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

const referralCodeModel =
  mongoose.model.referralCode ||
  mongoose.model("referralCode", referralCodeSchema);

export default referralCodeModel;