import dotenv from "dotenv";
import mongoose from "mongoose";
import MealPlan from "../models/mealPlanModel.js";

dotenv.config();

function names(items = []) {
  return items.filter((i) => !i?.isRice).map((i) => i?.name);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URL);
  const plan = await MealPlan.findOne({ status: "draft" }).sort({ createdAt: -1 }).lean();
  if (!plan) {
    console.log("No draft plan found");
    return;
  }
  const d = plan.days?.[0];
  const b = d?.breakfast?.items || (d?.breakfast ? [d.breakfast] : []);
  const l = d?.lunch?.items || [];
  const dn = d?.dinner?.items || [];

  const all = [...names(b), ...names(l), ...names(dn)].filter(Boolean);
  const dup = [...new Set(all.filter((n, i) => all.indexOf(n) !== i))];

  console.log(JSON.stringify({
    mealPlanId: String(plan._id),
    breakfast: names(b),
    lunch: names(l),
    dinner: names(dn),
    duplicates: dup
  }, null, 2));

  await mongoose.connection.close();
}

main().catch(async (e) => {
  console.error(e);
  try { await mongoose.connection.close(); } catch {}
  process.exit(1);
});
