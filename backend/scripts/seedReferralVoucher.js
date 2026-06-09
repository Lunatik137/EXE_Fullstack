/**
 * Seed script: creates one reusable 30% voucher for users who used a referral code.
 * Run once: node backend/scripts/seedReferralVoucher.js
 * Safe to re-run - updates the existing code with the intended settings.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import voucherModel from "../models/voucherModel.js";

const REFERRAL_VOUCHER = {
  code: "REFERRAL30",
  discountPercent: 30,
  maxUses: 0,
  requiresReferralCode: true,
  note: "Giảm 30% cho tài khoản đã dùng referral code - mỗi tài khoản dùng 1 lần",
  isActive: true,
};

const seed = async () => {
  await connectDB();

  const voucher = await voucherModel.findOneAndUpdate(
    { code: REFERRAL_VOUCHER.code },
    { $set: REFERRAL_VOUCHER },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`Referral voucher ready: ${voucher.code}`);
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
