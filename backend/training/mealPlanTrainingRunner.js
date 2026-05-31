import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { generateAndStoreMealPlanBySignals } from "../controllers/mealPlanController.js";
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

function normalizeAllergyInput(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function parseNumericCsv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map(item => Number(item.trim()))
    .filter(item => Number.isFinite(item));
}

function getCalorieCaseTargetsByDuration(duration) {
  const normalizedDuration = Number(duration || 7);

  // Profile for short 3-day plans.
  if (normalizedDuration === 3) {
    return {
      1500: 16,
      1700: 16,
      1900: 24,
      2100: 24,
      2300: 24,
      2500: 24,
      2700: 24,
      2900: 24,
      3100: 16
    };
  }

  // Requested profile for 14-day training milestone.
  if (normalizedDuration === 14) {
    return {
      1500: 20,
      1700: 20,
      1900: 40,
      2100: 40,
      2300: 40,
      2500: 40,
      2700: 40,
      2900: 40,
      3100: 20
    };
  }

  // Profile for long 30-day plans.
  if (normalizedDuration === 30) {
    return {
      1500: 24,
      1700: 24,
      1900: 48,
      2100: 48,
      2300: 48,
      2500: 48,
      2700: 48,
      2900: 48,
      3100: 24
    };
  }

  // Default profile for other durations.
  return {
    1500: 50,
    1900: 40,
    2100: 40,
    2300: 80,
    2500: 80,
    2700: 80,
    2900: 80,
    3100: 40
  };
}

function buildCases(duration) {
  const calorieCaseTargets = getCalorieCaseTargetsByDuration(duration);

  const caloriesList = Object.keys(calorieCaseTargets).map(Number);
  const dietTypes = ["vegan", "vegetarian", "balanced", "high-protein"];
  const activityLevels = ["sedentary", "light", "moderate", "active", "veryActive"];
  const allergySets = [
    [],
    ["nuts"],
    ["soy"],
    ["gluten"],
    ["soy", "nuts"],
    ["gluten", "nuts"]
  ];

  const cases = [];

  // Build a deterministic case matrix, then cut by target count per calorie.
  for (const avgCalories of caloriesList) {
    const calorieCases = [];

    for (const dietType of dietTypes) {
      for (const activityLevel of activityLevels) {
        for (const allergies of allergySets) {
          calorieCases.push({ avgCalories, dietType, activityLevel, allergies });
        }
      }
    }

    const targetCount = calorieCaseTargets[avgCalories] || calorieCases.length;
    cases.push(...calorieCases.slice(0, targetCount));
  }

  return cases;
}

function normalizeString(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStringArray(values) {
  if (!values) return [];
  const list = Array.isArray(values) ? values : [values];
  return [...new Set(list.map(normalizeString).filter(Boolean))].sort();
}

function buildTrainingCaseKey({ duration, avgCalories, userGoal, dietType, activityLevel, allergies }) {
  const normalizedAllergies = normalizeStringArray(allergies);
  return [
    `duration=${Number(duration || 0)}`,
    `calories=${Number(avgCalories || 0)}`,
    `goal=${normalizeString(userGoal || "maintain")}`,
    `diet=${normalizeString(dietType)}`,
    `activity=${normalizeString(activityLevel)}`,
    `allergies=${normalizedAllergies.join("|") || "none"}`
  ].join(";");
}

async function getExistingTrainingSampleCount(trainingCaseKey) {
  return MealPlan.countDocuments({
    generationSource: "training",
    trainingCaseKey
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function splitIntoBatches(items, batchSize) {
  const normalizedBatchSize = Math.max(1, Number(batchSize || items.length || 1));
  const batches = [];

  for (let index = 0; index < items.length; index += normalizedBatchSize) {
    batches.push(items.slice(index, index + normalizedBatchSize));
  }

  return batches;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  const userId = args.userId;
  if (!userId) {
    console.error("Missing required argument: --userId=<mongodb_user_id>");
    process.exit(1);
  }

  const duration = Number(args.duration || 7);
  const planType = String(args.planType || "premium");
  const limit = Number(args.limit || 0);
  const delayMs = Number(args.delayMs || 400);
  const batchSize = Number(args.batchSize || 20);
  const interBatchDelayMs = Number(args.interBatchDelayMs || 15000);
  const startBatch = Math.max(1, Number(args.startBatch || 1));
  const maxBatches = Number(args.maxBatches || 0);
  const targetSamplesPerCase = Math.max(1, Number(args.targetSamplesPerCase || 1));
  const forceAIGenerate = String(args.forceAIGenerate || "true") === "true";

  const customAllergies = normalizeAllergyInput(args.allergies);
  const skipCaloriesList = parseNumericCsv(args.skipCalories);

  await connectDB();

  let trainingCases = buildCases(duration);

  if (args.calories) {
    const selectedCalories = Number(args.calories);
    trainingCases = trainingCases.filter(c => c.avgCalories === selectedCalories);
  }

  if (skipCaloriesList.length > 0) {
    const skipSet = new Set(skipCaloriesList);
    trainingCases = trainingCases.filter(c => !skipSet.has(Number(c.avgCalories)));
  }

  if (args.dietType) {
    trainingCases = trainingCases.filter(c => c.dietType === String(args.dietType));
  }

  if (args.activityLevel) {
    trainingCases = trainingCases.filter(c => c.activityLevel === String(args.activityLevel));
  }

  if (customAllergies.length > 0) {
    trainingCases = trainingCases.filter(c =>
      c.allergies.length === customAllergies.length &&
      customAllergies.every(item => c.allergies.includes(item))
    );
  }

  if (limit > 0) {
    trainingCases = trainingCases.slice(0, limit);
  }

  const allBatches = splitIntoBatches(trainingCases, batchSize);
  const selectedBatches = allBatches.slice(
    startBatch - 1,
    maxBatches > 0 ? (startBatch - 1) + maxBatches : undefined
  );

  console.log(`Training started. Total cases: ${trainingCases.length}`);
  console.log(
    `Settings: duration=${duration}, planType=${planType}, delayMs=${delayMs}, ` +
    `batchSize=${batchSize}, interBatchDelayMs=${interBatchDelayMs}, startBatch=${startBatch}, ` +
    `maxBatches=${maxBatches || "all"}, targetSamplesPerCase=${targetSamplesPerCase}, ` +
    `forceAIGenerate=${forceAIGenerate}, skipCalories=${skipCaloriesList.join("|") || "none"}`
  );
  console.log(`Total batches selected: ${selectedBatches.length}/${allBatches.length}`);

  let successCount = 0;
  let errorCount = 0;
  let reusedCount = 0;
  let skippedCount = 0;
  let globalCaseIndex = (startBatch - 1) * Math.max(1, batchSize);

  for (let batchIndex = 0; batchIndex < selectedBatches.length; batchIndex++) {
    const batchCases = selectedBatches[batchIndex];
    const currentBatchNumber = startBatch + batchIndex;

    console.log("============================================================");
    console.log(`Starting batch ${currentBatchNumber}/${allBatches.length} with ${batchCases.length} cases`);

    for (let i = 0; i < batchCases.length; i++) {
      const c = batchCases[i];
      globalCaseIndex += 1;

      console.log("------------------------------------------------------------");
      console.log(`Case ${globalCaseIndex}/${trainingCases.length} | Batch ${currentBatchNumber} item ${i + 1}/${batchCases.length}`);
      console.log(`avgCalories=${c.avgCalories}, dietType=${c.dietType}, activityLevel=${c.activityLevel}, allergies=[${c.allergies.join(", ")}]`);

      const trainingCaseKey = buildTrainingCaseKey({
        duration,
        avgCalories: c.avgCalories,
        userGoal: "maintain",
        dietType: c.dietType,
        activityLevel: c.activityLevel,
        allergies: c.allergies
      });

      const existingSamples = await getExistingTrainingSampleCount(trainingCaseKey);
      if (existingSamples >= targetSamplesPerCase) {
        skippedCount += 1;
        console.log(
          `Skipped case ${globalCaseIndex}: already has ${existingSamples}/${targetSamplesPerCase} training samples for this signature`
        );
        continue;
      }

      try {
        const result = await generateAndStoreMealPlanBySignals({
          userId,
          planType,
          duration,
          avgCalories: c.avgCalories,
          userGoal: "maintain",
          dietType: c.dietType,
          allergies: c.allergies,
          activityLevel: c.activityLevel,
          onboardingData: {
            age: 28,
            gender: "Male",
            weight: 65,
            goal: "maintain",
            allergies: c.allergies,
            dislikes: []
          },
          skipSimilarityLookup: forceAIGenerate,
          generationSource: "training",
          trainingCaseKey,
          trainingTargetCalories: c.avgCalories
        });

        if (result.reusedFromDB) {
          reusedCount += 1;
        }

        successCount += 1;
        console.log(`Saved meal plan: ${result.mealPlan._id} | reusedFromDB=${result.reusedFromDB} | usedAI=${result.usedAI}`);
      } catch (error) {
        errorCount += 1;
        console.error(`Failed case ${globalCaseIndex}: ${error.message}`);
      }

      if (delayMs > 0 && i < batchCases.length - 1) {
        await sleep(delayMs);
      }
    }

    console.log(
      `Finished batch ${currentBatchNumber}. Current totals: ` +
      `success=${successCount}, errors=${errorCount}, reused=${reusedCount}, skipped=${skippedCount}`
    );

    if (interBatchDelayMs > 0 && batchIndex < selectedBatches.length - 1) {
      console.log(`Sleeping ${interBatchDelayMs}ms before next batch to reduce Gemini quota pressure...`);
      await sleep(interBatchDelayMs);
    }
  }

  console.log("============================================================");
  console.log("Training completed");
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Reused from DB: ${reusedCount}`);
  console.log(`Skipped existing cases: ${skippedCount}`);

  await mongoose.connection.close();
  process.exit(errorCount > 0 ? 1 : 0);
}

run().catch(async error => {
  console.error("Training runner crashed:", error);
  try {
    await mongoose.connection.close();
  } catch {
    // Ignore close errors in crash path.
  }
  process.exit(1);
});
