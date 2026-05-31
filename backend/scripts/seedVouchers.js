/**
 * Seed script: creates 30 unique 30%-discount voucher codes.
 * Run once: node backend/scripts/seedVouchers.js
 * Safe to re-run – skips codes that already exist.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import voucherModel from "../models/voucherModel.js";

const VOUCHER_CODES = [
  "GP30-K7M2", "GP30-X9B4", "GP30-P3N8", "GP30-Q5T1", "GP30-W2R6",
  "GP30-Y4H9", "GP30-J8V3", "GP30-L1C7", "GP30-Z5F2", "GP30-A9G4",
  "GP30-D3S8", "GP30-E6U1", "GP30-G7W5", "GP30-H2Y9", "GP30-M4Z3",
  "GP30-N6A7", "GP30-R8B2", "GP30-T1D5", "GP30-V3E9", "GP30-C5J1",
  "GP30-F7K4", "GP30-B9L6", "GP30-U2M8", "GP30-S4N3", "GP30-Q6P7",
  "GP30-X8R2", "GP30-Y1T5", "GP30-Z3V9", "GP30-W5H4", "GP30-K9X7",
];

const seed = async () => {
  await connectDB();

  let created = 0;
  let skipped = 0;

  for (const code of VOUCHER_CODES) {
    const exists = await voucherModel.findOne({ code });
    if (exists) {
      console.log(`  SKIP  ${code} (already exists)`);
      skipped++;
      continue;
    }
    await voucherModel.create({
      code,
      discountPercent: 30,
      maxUses: 1,
      note: "Mã khuyến mãi khai trương – giảm 30%",
      isActive: true,
    });
    console.log(`  CREATE ${code}`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped.`);
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
