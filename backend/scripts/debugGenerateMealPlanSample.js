import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import userModel from "../models/userModel.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const API_URL = process.argv[2] || process.env.DEBUG_API_URL || "http://localhost:4000";
const RUNS = Number(process.argv[3] || process.env.DEBUG_RUNS || 3);
const DEBUG_TARGET_CALORIES = Number(process.env.DEBUG_TARGET_CALORIES || 0);
const DEBUG_TARGET_CALORIES_TOLERANCE = Number(process.env.DEBUG_TARGET_CALORIES_TOLERANCE || 80);
const DEBUG_USER_EMAIL = String(process.argv[4] || process.env.DEBUG_USER_EMAIL || "").trim().toLowerCase();

function summarizeDay(day) {
  const breakfastItems = day?.breakfast?.items || (day?.breakfast ? [day.breakfast] : []);
  const lunchItems = day?.lunch?.items || [];
  const dinnerItems = day?.dinner?.items || [];

  const nonRice = [...breakfastItems, ...lunchItems, ...dinnerItems].filter((i) => !i?.isRice);
  const names = nonRice.map((i) => String(i?.name || "").trim()).filter(Boolean);
  const dupes = names.filter((n, idx) => names.indexOf(n) !== idx);

  const totals = {
    calories: Number(day?.totalCalories || 0),
    protein: Number((day?.breakfast?.totalProtein ?? day?.breakfast?.protein ?? 0)) + Number(day?.lunch?.totalProtein || 0) + Number(day?.dinner?.totalProtein || 0),
    fat: Number((day?.breakfast?.totalFat ?? day?.breakfast?.fat ?? 0)) + Number(day?.lunch?.totalFat || 0) + Number(day?.dinner?.totalFat || 0),
    carbs: Number((day?.breakfast?.totalCarbs ?? day?.breakfast?.carbs ?? 0)) + Number(day?.lunch?.totalCarbs || 0) + Number(day?.dinner?.totalCarbs || 0),
    fiber: Number((day?.breakfast?.totalFiber ?? day?.breakfast?.fiber ?? 0)) + Number(day?.lunch?.totalFiber || 0) + Number(day?.dinner?.totalFiber || 0)
  };

  const lunchDishCount = lunchItems.filter((i) => !i?.isRice).length;
  const dinnerDishCount = dinnerItems.filter((i) => !i?.isRice).length;

  return { totals, lunchDishCount, dinnerDishCount, duplicateNonRiceNames: [...new Set(dupes)] };
}

function evaluateNutrition(totals, target, duplicateNonRiceNames = []) {
  const caloriesTarget = Number(target?.calories || 2000);
  const proteinTarget = Number(target?.protein || 70);
  const fatTarget = Number(target?.fat || 65);
  const carbsTarget = Number(target?.carbs || 250);
  const fiberTarget = Number(target?.fiber || 30);

  const checks = {
    calories: totals.calories >= (caloriesTarget - 120) && totals.calories <= (caloriesTarget + 180),
    protein: totals.protein >= proteinTarget * 0.95 && totals.protein <= proteinTarget * 1.14,
    fat: totals.fat >= fatTarget * 0.97 && totals.fat <= fatTarget * 1.16,
    carbs: totals.carbs >= carbsTarget * 0.96 && totals.carbs <= carbsTarget * 1.12,
    fiber: totals.fiber >= fiberTarget * 0.95 && totals.fiber <= fiberTarget * 1.15,
    dedupe: duplicateNonRiceNames.length === 0
  };

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  return { checks, failed, pass: failed.length === 0 };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URL);

  const userQuery = {
    hasCompletedOnboarding: true,
    planType: "premium",
    subscriptionEndDate: { $gte: new Date() }
  };

  if (DEBUG_USER_EMAIL) {
    userQuery.email = DEBUG_USER_EMAIL;
  }

  if (DEBUG_TARGET_CALORIES > 0) {
    userQuery["nutritionTargets.calories"] = {
      $gte: DEBUG_TARGET_CALORIES - DEBUG_TARGET_CALORIES_TOLERANCE,
      $lte: DEBUG_TARGET_CALORIES + DEBUG_TARGET_CALORIES_TOLERANCE
    };
  }

  const user = await userModel.findOne(userQuery).lean();

  if (!user) {
    throw new Error(
      DEBUG_USER_EMAIL
        ? `No active premium user found for email ${DEBUG_USER_EMAIL}`
        : DEBUG_TARGET_CALORIES > 0
        ? `No active premium user found near ${DEBUG_TARGET_CALORIES} kcal target`
        : "No active premium user found for debug run"
    );
  }

  const token = jwt.sign(
    { id: String(user._id), role: user.role || "user" },
    process.env.JWT_SECRET
  );

  const targets = user.nutritionTargets || {};
  const out = [];

  for (let i = 0; i < RUNS; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    const httpRes = await fetch(`${API_URL}/api/meal-plan/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token
      },
      body: JSON.stringify({ skipSimilarityLookup: true }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await httpRes.json();

    if (!data?.success) {
      out.push({ run: i + 1, success: false, message: data?.message || "unknown" });
      continue;
    }

    const day = data.mealPlan?.days?.[0];
    const s = summarizeDay(day);

    out.push({
      run: i + 1,
      success: true,
      usedAI: data.usedAI,
      calories: s.totals.calories,
      protein: Number(s.totals.protein.toFixed(1)),
      fat: Number(s.totals.fat.toFixed(1)),
      carbs: Number(s.totals.carbs.toFixed(1)),
      fiber: Number(s.totals.fiber.toFixed(1)),
      lunchDishCount: s.lunchDishCount,
      dinnerDishCount: s.dinnerDishCount,
      duplicateNonRiceNames: s.duplicateNonRiceNames,
      nutritionCheck: evaluateNutrition(s.totals, targets, s.duplicateNonRiceNames),
      target: {
        calories: targets.calories,
        protein: targets.protein,
        fat: targets.fat,
        carbs: targets.carbs,
        fiber: targets.fiber
      }
    });
  }

  const pretty = JSON.stringify(out, null, 2);
  console.log(pretty);
  fs.writeFileSync(path.resolve(__dirname, "../debug-generate-last.json"), pretty, "utf8");
  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.connection.close(); } catch {}
  process.exit(1);
});
