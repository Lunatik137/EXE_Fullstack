import mongoose from "mongoose";

const emailVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    purpose: { type: String, enum: ["register"], default: "register", index: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

emailVerificationSchema.index({ email: 1, purpose: 1 }, { unique: true });

const emailVerificationModel =
  mongoose.models.emailVerification ||
  mongoose.model("emailVerification", emailVerificationSchema);

export default emailVerificationModel;
