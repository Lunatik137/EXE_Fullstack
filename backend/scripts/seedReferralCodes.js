/**
 * Seed script: creates 20 unique referral codes for early-bird registration.
 * Run once: node backend/scripts/seedReferralCodes.js
 * Safe to re-run - skips codes that already exist.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import referralCodeModel from "../models/referralCodeModel.js";

const REFERRAL_CODES = [
  "EARLY-AX71",
  "EARLY-BM29",
  "EARLY-CQ84",
  "EARLY-DL56",
  "EARLY-EP13",
  "EARLY-FR68",
  "EARLY-GT90",
  "EARLY-HV24",
  "EARLY-JK57",
  "EARLY-LN36",
  "EARLY-MP82",
  "EARLY-NX15",
  "EARLY-QR47",
  "EARLY-SU63",
  "EARLY-TW28",
  "EARLY-VY51",
  "EARLY-WZ76",
  "EARLY-XD39",
  "EARLY-YF64",
  "EARLY-ZH05",
];

const seed = async () => {
  await connectDB();

  let created = 0;
  let skipped = 0;

  for (const code of REFERRAL_CODES) {
    const exists = await referralCodeModel.findOne({ code });
    if (exists) {
      console.log(`  SKIP  ${code} (already exists)`);
      skipped += 1;
      continue;
    }

    await referralCodeModel.create({
      code,
      isActive: true,
      isUsed: false,
      note: "Early bird referral code - one-time registration",
    });

    console.log(`  CREATE ${code}`);
    created += 1;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped.`);
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
