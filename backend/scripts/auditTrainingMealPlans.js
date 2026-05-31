import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import MealPlan from "../models/mealPlanModel.js";

dotenv.config();

function parseArgs(argv) {
  const args = {};

  for (const item of argv) {
    if (!item.startsWith("--")) continue;
    const [key, value] = item.slice(2).split("=");
    args[key] = value === undefined ? true : value;
  }

  return args;
}

function toBoolean(value) {
  return String(value || "false").toLowerCase() === "true";
}

async function getStatusSummary(match) {
  return MealPlan.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const apply = toBoolean(args.apply);
  const match = { generationSource: "training" };

  if (args.userId) {
    match.userId = new mongoose.Types.ObjectId(String(args.userId));
  }

  await connectDB();

  const before = await getStatusSummary(match);
  const draftCount = await MealPlan.countDocuments({
    ...match,
    status: "draft"
  });

  let modifiedCount = 0;
  if (apply && draftCount > 0) {
    const result = await MealPlan.updateMany(
      {
        ...match,
        status: "draft"
      },
      {
        $set: { status: "training" }
      }
    );
    modifiedCount = result.modifiedCount || 0;
  }

  const after = await getStatusSummary(match);
  const recent = await MealPlan.find(match)
    .sort({ createdAt: -1 })
    .limit(5)
    .select("_id userId status generationSource trainingCaseKey createdAt")
    .lean();

  console.log(JSON.stringify({
    apply,
    modifiedCount,
    before,
    after,
    recent
  }, null, 2));

  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error("Training meal plan audit failed:", error);
  try {
    await mongoose.connection.close();
  } catch {
    // Ignore close errors in crash path.
  }
  process.exit(1);
});