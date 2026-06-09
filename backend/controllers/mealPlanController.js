import MealPlan from "../models/mealPlanModel.js";
import userModel from "../models/userModel.js";
import recipeModel from "../models/recipeModel.js";
import geminiService from "../utils/geminiService.js";

const SIMILARITY_CALORIE_WINDOW = 250;
const SIMILARITY_MIN_SCORE = 0.75;
const SIMILARITY_QUERY_LIMIT = 120;
const SIMILARITY_DURATION_WINDOW = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TRAINING_MEAL_PLAN_STATUS = "training";
const MAX_GENERATION_DAYS = 30;
const RECENT_MEAL_HISTORY_DAYS = 14;
const MIN_RECENT_MEAL_HISTORY_DAYS = 10;
const MAX_DUPLICATE_REGENERATION_ATTEMPTS = 3;

function getMealPlanStatusForSource(generationSource) {
  return generationSource === "training" ? TRAINING_MEAL_PLAN_STATUS : "draft";
}

function buildUserDraftQuery(userId) {
  return {
    userId,
    status: "draft",
    generationSource: { $ne: "training" }
  };
}

function resolveRequestUserId(req) {
  return req.userId || req.body?.userId || null;
}

function isPremiumCurrentlyActive(user) {
  if (!user) return false;

  const now = new Date();
  const subscriptionEndDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  const hasValidPremiumByDate =
    user.planType === "premium" &&
    subscriptionEndDate &&
    !Number.isNaN(subscriptionEndDate.getTime()) &&
    subscriptionEndDate >= now;

  return hasValidPremiumByDate;
}

function resolveRemainingPremiumDays(user) {
  if (!user || user.planType !== "premium") return 0;
  const subscriptionEndDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  if (!subscriptionEndDate || Number.isNaN(subscriptionEndDate.getTime())) return 0;

  const diffMs = subscriptionEndDate.getTime() - Date.now();
  if (diffMs <= 0) return 0;

  return Math.max(1, Math.ceil(diffMs / DAY_IN_MS));
}

function normalizeString(value) {
  return String(value || "").trim().toLowerCase();
}

function canonicalizeDishName(value) {
  return normalizeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStringArray(values) {
  if (!values) return [];
  const list = Array.isArray(values) ? values : [values];
  return [...new Set(list.map(normalizeString).filter(Boolean))].sort();
}

// Split a comma-separated dislikes string into a normalized array of keywords
function normalizeDislikesList(raw) {
  if (!raw) return [];
  const items = Array.isArray(raw)
    ? raw
    : String(raw).split(/[,،、]+/);
  return [...new Set(items.map(normalizeString).filter(Boolean))];
}

// Onboarding allergen values → recipe.allergens/ingredient keywords
// Each entry lists ALL keywords (English + Vietnamese) that appear in recipe.allergens
// OR recipe.ingredients / recipe.name to identify that allergen.
const ALLERGEN_KEYWORD_MAP = {
  peanut:    ['peanut', 'đậu phộng', 'đậu lạc', 'lạc rang', 'đậu phụng'],
  soy:       ['soy', 'đậu nành', 'đậu hũ', 'đậu hủ', 'đậu phụ', 'đậu hủ non', 'đậu hũ non',
               'nước tương', 'tương hoisin', 'tương đậu', 'tàu hủ', 'tàu hũ', 'miso', 'tempeh', 'edamame'],
  gluten:    ['gluten', 'wheat', 'flour', 'mì căn', 'bột mì', 'bánh mì', 'mì ống', 'lúa mì', 'mì căn'],
  dairy:     ['dairy', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'lactose',
               'sữa tươi', 'sữa bò', 'sữa đặc', 'phô mai', 'bơ sữa', 'kem tươi', 'sữa chua', 'whey'],
  egg:       ['egg', 'trứng'],
  seafood:   ['seafood', 'fish', 'shrimp', 'crab', 'squid', 'shellfish', 'prawn',
               'hải sản', 'cá ', 'tôm', 'cua', 'mực', 'nghêu', 'sò', 'hàu', 'bạch tuộc', 'ốc'],
  sesame:    ['sesame', 'mè', 'vừng', 'dầu mè', 'dầu vừng'],
  tree_nuts: ['cashew', 'almond', 'walnut', 'hazelnut', 'pistachio', 'pecan', 'macadamia', 'tree_nut',
               'hạt điều', 'hạnh nhân', 'óc chó', 'hạt dẻ', 'hạt phỉ', 'hạt macadamia', 'hạt hồ đào']
};

// Returns true if a recipe is unsafe for the given allergen list
function recipeHasAllergen(recipe, userAllergies) {
  if (userAllergies.length === 0) return false;

  for (const allergen of userAllergies) {
    const keywords = ALLERGEN_KEYWORD_MAP[allergen] || [allergen];

    // Check declared allergens field first
    const inAllergenField = (recipe.allergens || []).some(a =>
      keywords.some(kw => a.toLowerCase().includes(kw) || kw.includes(a.toLowerCase()))
    );
    if (inAllergenField) return true;

    // Fallback: check recipe name + ingredients for Vietnamese/English keywords
    const nameAndIngredients = [
      (recipe.name || '').toLowerCase(),
      ...((recipe.ingredients || []).map(i => i.toLowerCase()))
    ];
    const inText = nameAndIngredients.some(text =>
      keywords.some(kw => text.includes(kw))
    );
    if (inText) return true;
  }

  return false;
}

function normalizeObjectIdStrings(values) {
  if (!values) return [];
  const list = Array.isArray(values) ? values : [values];
  return [...new Set(list.map(value => String(value || '').trim()).filter(Boolean))];
}

function getDayMealItems(day) {
  if (!day) return [];

  const items = [];

  if (day.breakfast?.items && Array.isArray(day.breakfast.items)) {
    items.push(...day.breakfast.items);
  } else if (day.breakfast) {
    items.push(day.breakfast);
  }

  if (Array.isArray(day.lunch?.items)) {
    items.push(...day.lunch.items);
  } else if (day.lunch) {
    items.push(day.lunch);
  }

  if (Array.isArray(day.dinner?.items)) {
    items.push(...day.dinner.items);
  } else if (day.dinner) {
    items.push(day.dinner);
  }

  return items.filter(Boolean);
}

function collectHistoricalRecipeSignals(days = []) {
  const usedRecipeIds = new Set();
  const usedRecipeNames = new Set();

  for (const day of days) {
    const items = getDayMealItems(day);
    for (const item of items) {
      const recipeId = item?.recipeId ? String(item.recipeId) : null;
      if (recipeId) usedRecipeIds.add(recipeId);

      const recipeName = canonicalizeDishName(item?.name);
      if (recipeName) usedRecipeNames.add(recipeName);
    }
  }

  return { usedRecipeIds, usedRecipeNames };
}

function getDaySignature(day) {
  const items = getDayMealItems(day);
  const names = items
    .map(item => canonicalizeDishName(item?.name || ""))
    .filter(Boolean)
    .sort();

  return names.join("|");
}

function getDayNutritionProfile(day) {
  const totals = getDayNutritionTotals(day);
  return {
    calories: Number(totals.calories || day?.totalCalories || 0),
    protein: Number(totals.protein || 0),
    fat: Number(totals.fat || 0),
    carbs: Number(totals.carbs || 0),
    fiber: Number(totals.fiber || 0)
  };
}

function getPlanDayTimestamp(plan, day) {
  const dayDate = day?.date ? new Date(day.date) : null;
  if (dayDate && !Number.isNaN(dayDate.getTime())) return dayDate.getTime();

  const startDate = plan?.startDate ? new Date(plan.startDate) : null;
  const dayNumber = Number(day?.dayNumber || day?.day || 1);
  if (startDate && !Number.isNaN(startDate.getTime())) {
    return startDate.getTime() + Math.max(0, dayNumber - 1) * DAY_IN_MS;
  }

  const updatedAt = plan?.updatedAt ? new Date(plan.updatedAt) : null;
  if (updatedAt && !Number.isNaN(updatedAt.getTime())) return updatedAt.getTime();

  const createdAt = plan?.createdAt ? new Date(plan.createdAt) : null;
  if (createdAt && !Number.isNaN(createdAt.getTime())) return createdAt.getTime();

  return 0;
}

function getRecentHistoricalDaysFromPlans(plans = [], limitDays = RECENT_MEAL_HISTORY_DAYS) {
  const allDays = [];

  for (const plan of plans) {
    for (const day of (plan?.days || [])) {
      const signature = getDaySignature(day);
      if (!signature) continue;

      allDays.push({
        ...day,
        _historyPlanId: plan?._id,
        _historyPlanStatus: plan?.status,
        _historyTimestamp: getPlanDayTimestamp(plan, day)
      });
    }
  }

  return allDays
    .sort((a, b) => Number(b._historyTimestamp || 0) - Number(a._historyTimestamp || 0))
    .slice(0, Math.max(MIN_RECENT_MEAL_HISTORY_DAYS, limitDays));
}

async function getRecentMealPlanHistory(userId, limitDays = RECENT_MEAL_HISTORY_DAYS) {
  if (!userId) return [];

  const recentPlans = await MealPlan.find({
    userId,
    generationSource: { $ne: "training" },
    status: { $in: ["draft", "active", "completed"] },
    days: { $exists: true, $ne: [] }
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(12)
    .lean();

  return getRecentHistoricalDaysFromPlans(recentPlans, limitDays);
}

function hasDuplicateRecentDay(days = [], historicalDays = []) {
  const historicalSignatures = new Set(
    historicalDays.map(getDaySignature).filter(Boolean)
  );

  return days.some(day => historicalSignatures.has(getDaySignature(day)));
}

function resolveBalancedNutritionTargets(calorieTarget, macroTargets, historicalDays = []) {
  const recentNutritionDays = historicalDays
    .slice(0, Math.max(1, Math.min(3, historicalDays.length)))
    .map(getDayNutritionProfile)
    .filter(totals => totals.calories > 0);

  if (recentNutritionDays.length === 0) {
    return { calorieTarget, macroTargets, adjusted: false };
  }

  const averageRecentCalories =
    recentNutritionDays.reduce((sum, totals) => sum + totals.calories, 0) / recentNutritionDays.length;
  const calorieSurplus = averageRecentCalories - calorieTarget;

  if (calorieSurplus <= 120) {
    return { calorieTarget, macroTargets, adjusted: false };
  }

  const calorieReduction = Math.min(180, Math.round(calorieSurplus * 0.55));
  const balancedCalories = Math.max(1200, calorieTarget - calorieReduction);
  const carbReduction = Math.round(calorieReduction / 4);

  return {
    calorieTarget: balancedCalories,
    macroTargets: {
      protein: macroTargets.protein,
      fat: macroTargets.fat,
      carbs: Math.max(1, macroTargets.carbs - carbReduction),
      fiber: macroTargets.fiber
    },
    adjusted: true,
    recentAverageCalories: Math.round(averageRecentCalories)
  };
}

function calculateAllergySimilarity(currentAllergies, candidateAllergies) {
  const current = new Set(normalizeStringArray(currentAllergies));
  const candidate = new Set(normalizeStringArray(candidateAllergies));

  if (current.size === 0 && candidate.size === 0) return 1;

  const union = new Set([...current, ...candidate]);
  if (union.size === 0) return 1;

  let intersectionCount = 0;
  for (const value of current) {
    if (candidate.has(value)) intersectionCount += 1;
  }

  return intersectionCount / union.size;
}

/**
 * Check that every meal item in a cloned candidate plan is safe for the user —
 * i.e. none of its ingredients match the user's allergies or dislikes.
 * Returns true only when the plan is completely safe.
 */
function isPlanSafeForUser(candidate, userAllergies, userDislikes) {
  if (userAllergies.length === 0 && userDislikes.length === 0) return true;

  const allItems = [];
  for (const day of (candidate.days || [])) {
    // Support both new combo breakfast (items array) and legacy single-recipe breakfast
    if (day.breakfast?.items) {
      for (const item of day.breakfast.items) allItems.push(item);
    } else if (day.breakfast) {
      allItems.push(day.breakfast);
    }
    for (const item of (day.lunch?.items || [])) allItems.push(item);
    for (const item of (day.dinner?.items || [])) allItems.push(item);
  }

  for (const item of allItems) {
    if (recipeHasAllergen(item, userAllergies)) return false;

    if (userDislikes.length > 0) {
      const name = (item.name || '').toLowerCase();
      const ingredients = (item.ingredients || []).map(i => i.toLowerCase());
      const hasDisliked = userDislikes.some(dislike =>
        name.includes(dislike) ||
        ingredients.some(ing => ing.includes(dislike))
      );
      if (hasDisliked) return false;
    }
  }

  return true;
}

function calculateMealPlanSimilarityScore(target, candidate) {
  const targetCalories = Number(target.avgCalories || 0);
  const candidateCalories = Number(candidate.avgCalories || 0);
  const calorieDiff = Math.abs(targetCalories - candidateCalories);
  const calorieScore = Math.max(0, 1 - calorieDiff / SIMILARITY_CALORIE_WINDOW);

  const dietScore = normalizeString(target.dietType) === normalizeString(candidate.dietType) ? 1 : 0;
  const activityScore = normalizeString(target.activityLevel) === normalizeString(candidate.activityLevel) ? 1 : 0;
  const allergyScore = calculateAllergySimilarity(target.allergies, candidate.allergies);
  const goalScore = normalizeString(target.userGoal) === normalizeString(candidate.userGoal) ? 1 : 0;

  const targetDuration = Number(target.duration || 0);
  const candidateDuration = Number(candidate.duration || 0);
  const durationDelta = Math.max(0, candidateDuration - targetDuration);
  const durationScore = candidateDuration < targetDuration
    ? 0
    : Math.max(0.5, 1 - (durationDelta / Math.max(1, SIMILARITY_DURATION_WINDOW)) * 0.5);

  return (
    (calorieScore * 0.42) +
    (dietScore * 0.16) +
    (activityScore * 0.14) +
    (allergyScore * 0.08) +
    (goalScore * 0.12) +
    (durationScore * 0.08)
  );
}

async function findSimilarMealPlanBySignals(signals, duration, excludedMealPlanIds = [], excludedCalories = []) {
  const avgCalories = Number(signals.avgCalories || 0);
  const excludedCaloriesSet = excludedCalories.map(Number).filter(c => c > 0);

  // Build calorie query: combine range filter and $nin exclusion via $and to avoid key overwrite
  const calorieConditions = [];
  if (avgCalories > 0) {
    calorieConditions.push({ avgCalories: { $gte: avgCalories - SIMILARITY_CALORIE_WINDOW, $lte: avgCalories + SIMILARITY_CALORIE_WINDOW } });
  }
  if (excludedCaloriesSet.length > 0) {
    calorieConditions.push({ avgCalories: { $nin: excludedCaloriesSet } });
  }
  const calorieRangeQuery = calorieConditions.length === 0 ? {} :
    calorieConditions.length === 1 ? calorieConditions[0] :
    { $and: calorieConditions };

  const numericDuration = Number(duration || 0);
  const exactDurationQuery = numericDuration > 0 ? { duration: numericDuration } : {};
  const flexibleDurationQuery = numericDuration > 0
    ? { duration: { $gte: numericDuration, $lte: numericDuration + SIMILARITY_DURATION_WINDOW } }
    : {};

  const exactDietType = normalizeString(signals.dietType);
  const exactActivityLevel = normalizeString(signals.activityLevel);
  const exactGoal = normalizeString(signals.userGoal);
  const normalizedAllergies = normalizeStringArray(signals.allergies);
  const excludedIds = normalizeObjectIdStrings(excludedMealPlanIds);
  const exclusionQuery = excludedIds.length > 0 ? { _id: { $nin: excludedIds } } : {};

  const queryTiers = [
    {
      ...exclusionQuery,
      ...exactDurationQuery,
      ...calorieRangeQuery,
      ...(exactGoal ? { userGoal: exactGoal } : {}),
      ...(exactDietType ? { dietType: exactDietType } : {}),
      ...(exactActivityLevel ? { activityLevel: exactActivityLevel } : {}),
      ...(normalizedAllergies.length > 0 ? { allergies: { $all: normalizedAllergies } } : {}),
      days: { $exists: true, $ne: [] }
    },
    {
      ...exclusionQuery,
      ...exactDurationQuery,
      ...calorieRangeQuery,
      ...(exactGoal ? { userGoal: exactGoal } : {}),
      ...(exactDietType ? { dietType: exactDietType } : {}),
      ...(exactActivityLevel ? { activityLevel: exactActivityLevel } : {}),
      days: { $exists: true, $ne: [] }
    },
    {
      ...exclusionQuery,
      ...exactDurationQuery,
      ...calorieRangeQuery,
      ...(exactDietType ? { dietType: exactDietType } : {}),
      days: { $exists: true, $ne: [] }
    },
    {
      ...exclusionQuery,
      ...flexibleDurationQuery,
      ...calorieRangeQuery,
      ...(exactGoal ? { userGoal: exactGoal } : {}),
      ...(exactDietType ? { dietType: exactDietType } : {}),
      ...(exactActivityLevel ? { activityLevel: exactActivityLevel } : {}),
      days: { $exists: true, $ne: [] }
    },
    {
      ...exclusionQuery,
      ...flexibleDurationQuery,
      ...calorieRangeQuery,
      ...(exactDietType ? { dietType: exactDietType } : {}),
      days: { $exists: true, $ne: [] }
    },
    {
      ...exclusionQuery,
      ...flexibleDurationQuery,
      ...calorieRangeQuery,
      days: { $exists: true, $ne: [] }
    }
  ];

  const candidateMap = new Map();

  for (const query of queryTiers) {
    const tierCandidates = await MealPlan.find(query)
      .sort({ createdAt: -1 })
      .limit(SIMILARITY_QUERY_LIMIT)
      .lean();

    for (const candidate of tierCandidates) {
      candidateMap.set(String(candidate._id), candidate);
    }

    if (candidateMap.size >= SIMILARITY_QUERY_LIMIT * 2) {
      break;
    }
  }

  const rawCandidates = [...candidateMap.values()];

  let bestCandidate = null;
  let bestScore = 0;

  for (const candidate of rawCandidates) {
    const score = calculateMealPlanSimilarityScore(signals, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate || bestScore < SIMILARITY_MIN_SCORE) {
    return null;
  }

  return { candidate: bestCandidate, score: bestScore };
}

function extendDaysToDuration(baseDays, targetDuration) {
  if (baseDays.length >= targetDuration) {
    return baseDays.slice(0, targetDuration).map((day, index) => ({
      ...day,
      dayNumber: index + 1,
      date: new Date(Date.now() + index * DAY_IN_MS)
    }));
  }
  const extended = [];
  for (let i = 0; i < targetDuration; i++) {
    const sourceDay = baseDays[i % baseDays.length];
    extended.push({
      ...sourceDay,
      dayNumber: i + 1,
      date: new Date(Date.now() + i * DAY_IN_MS)
    });
  }
  return extended;
}

function cloneDaysForDuration(days, requestedDuration) {
  if (!Array.isArray(days) || days.length < requestedDuration) {
    return null;
  }

  return days.slice(0, requestedDuration).map((day, index) => ({
    ...day,
    dayNumber: index + 1,
    date: new Date(Date.now() + index * 24 * 60 * 60 * 1000)
  }));
}

function summarizeMealPlanDays(days) {
  const totalRecipes = new Set([
    ...days.flatMap(day => day.breakfast?.items?.map(i => i.name) || (day.breakfast?.name ? [day.breakfast.name] : [])),
    ...days.flatMap(day => day.lunch?.items?.map(item => item.name) || []),
    ...days.flatMap(day => day.dinner?.items?.map(item => item.name) || [])
  ].filter(Boolean)).size;

  const avgCalories = Math.round(
    days.reduce((sum, day) => sum + Number(day.totalCalories || 0), 0) / Math.max(1, days.length)
  );

  return { totalRecipes, avgCalories };
}

function isMealPlanCompleted(mealPlan) {
  if (!mealPlan) return false;

  const duration = Number(mealPlan.duration || 0);
  if (!duration || duration < 1) return false;

  const startDate = mealPlan.startDate ? new Date(mealPlan.startDate) : null;
  const now = new Date();

  if (mealPlan.endDate) {
    const endDate = new Date(mealPlan.endDate);
    if (!Number.isNaN(endDate.getTime()) && now > endDate) {
      return true;
    }
  }

  if (!startDate || Number.isNaN(startDate.getTime())) {
    return false;
  }

  const daysPassed = Math.floor((now - startDate) / DAY_IN_MS) + 1;
  return daysPassed > duration;
}

async function cloneSimilarMealPlanForUser(similarResult, payload) {
  const { candidate, score } = similarResult;
  const clonedDays = cloneDaysForDuration(candidate.days, payload.duration);

  if (!clonedDays) {
    throw new Error("Similar meal plan does not have enough days to reuse");
  }

  const summary = summarizeMealPlanDays(clonedDays);

  const clonedPlan = new MealPlan({
    userId: payload.userId,
    planType: payload.planType,
    duration: payload.duration,
    startDate: new Date(),
    endDate: new Date(Date.now() + payload.duration * 24 * 60 * 60 * 1000),
    status: getMealPlanStatusForSource(payload.generationSource),
    days: clonedDays,
    totalRecipes: summary.totalRecipes,
    avgCalories: summary.avgCalories,
    userGoal: normalizeString(payload.userGoal),
    dietType: normalizeString(payload.dietType),
    allergies: payload.allergies,
    activityLevel: normalizeString(payload.activityLevel),
    similarSourcePlanId: candidate._id,
    generationSource: payload.generationSource,
    trainingCaseKey: payload.trainingCaseKey,
    trainingTargetCalories: payload.trainingTargetCalories,
  });

  await clonedPlan.save();

  return {
    mealPlan: clonedPlan,
    reusedFromDB: true,
    similarityScore: Number(score.toFixed(3)),
    usedAI: false,
    usedFallback: false
  };
}

async function generateMealPlanDaysBySignals({
  avgCalories,
  duration,
  userGoal,
  dietType,
  allergies,
  activityLevel,
  onboardingData = {},
  nutritionTargets = null,
  generationDuration = 1,
  historicalDays = []
}) {
  const signalPayload = {
    avgCalories: Number(avgCalories || 0),
    duration: Number(duration || 0),
    userGoal: normalizeString(userGoal || onboardingData.goal || "maintain"),
    dietType: normalizeString(dietType || onboardingData.dietType || "balanced"),
    allergies: normalizeStringArray(allergies ?? onboardingData.allergies),
    activityLevel: normalizeString(activityLevel || onboardingData.activityLevel || "moderate")
  };

  const allRecipes = await recipeModel.find({});
  console.log(" Total recipes in database:", allRecipes.length);

  const userDislikes = normalizeDislikesList(onboardingData.dislikes);
  const filteredRecipes = allRecipes.filter(recipe => {
    if (recipeHasAllergen(recipe, signalPayload.allergies)) return false;

    if (userDislikes.length > 0) {
      const hasDisliked = userDislikes.some(dislike =>
        recipe.name.toLowerCase().includes(dislike) ||
        recipe.ingredients?.some(ing => ing.toLowerCase().includes(dislike))
      );
      if (hasDisliked) return false;
    }

    return true;
  });

  console.log(" Filtered recipes (safe for user):", filteredRecipes.length);

  const cappedGenerationDuration = Math.max(1, Math.min(Number(generationDuration || 1), MAX_GENERATION_DAYS));
  const { usedRecipeIds, usedRecipeNames } = collectHistoricalRecipeSignals(historicalDays);
  const minimumNeededRecipes = cappedGenerationDuration * 3;

  let candidateRecipes = filteredRecipes;

  if (candidateRecipes.length < minimumNeededRecipes) {
    console.log(
      ` Not enough unique recipes after dedupe (${candidateRecipes.length}/${minimumNeededRecipes}), allowing limited reuse.`
    );
    candidateRecipes = filteredRecipes;
  }

  if (candidateRecipes.length < minimumNeededRecipes) {
    throw new Error(
      `Not enough suitable recipes (need ${minimumNeededRecipes}, have ${candidateRecipes.length}). Please adjust dietary restrictions.`
    );
  }

  // Keep rice options small for single-person plans to prevent carb overload.
  candidateRecipes = constrainRiceOptionsForSinglePerson(candidateRecipes, signalPayload.avgCalories);

  const effectiveOnboardingData = {
    age: onboardingData.age ?? 28,
    gender: onboardingData.gender ?? "Male",
    weight: onboardingData.weight ?? 65,
    goal: signalPayload.userGoal,
    allergies: signalPayload.allergies,
    dislikes: onboardingData.dislikes ?? [],
  };

  const baseMacroTargets = resolveMacroTargets(
    nutritionTargets,
    effectiveOnboardingData.weight,
    signalPayload.avgCalories,
    effectiveOnboardingData.goal
  );
  const balancedTargets = resolveBalancedNutritionTargets(
    signalPayload.avgCalories,
    baseMacroTargets,
    historicalDays
  );

  if (balancedTargets.adjusted) {
    console.log(
      ` Balanced next-day targets from recent history: ` +
      `${signalPayload.avgCalories} -> ${balancedTargets.calorieTarget} kcal ` +
      `(recent avg ${balancedTargets.recentAverageCalories} kcal)`
    );
  }

  const prompt = buildGeminiPrompt(
    {},
    effectiveOnboardingData,
    balancedTargets.calorieTarget,
    cappedGenerationDuration,
    candidateRecipes,
    {
      bannedRecipeNames: [...usedRecipeNames],
      macroTargets: balancedTargets.macroTargets
    }
  );

  let geminiResponse;
  let usedFallback = false;

  try {
    geminiResponse = await geminiService.generateContent(prompt);
    console.log(" Gemini AI response received");
  } catch (error) {
    const errorMessage = error.message || '';
    const shouldUseFallback =
      process.env.NODE_ENV === 'development' ||
      errorMessage.includes('not configured') ||
      errorMessage.includes('No compatible Gemini model') ||
      errorMessage.includes('API keys exhausted') ||
      errorMessage.includes('API key permissions') ||
      errorMessage.includes('configuration error') ||
      errorMessage.includes('Must provide a model name') ||
      errorMessage.includes('503') ||
      errorMessage.includes('UNAVAILABLE') ||
      errorMessage.includes('high demand') ||
      errorMessage.includes('quota') ||
      errorMessage.includes('429');

    if (!shouldUseFallback) {
      throw error;
    }

    console.log(" Gemini API unavailable, using fallback meal selection...");
    console.log(`   Reason: ${error.message}`);
    geminiResponse = generateFallbackMealPlan(cappedGenerationDuration, candidateRecipes);
    usedFallback = true;
  }

  const parsedDays = parseGeminiResponse(geminiResponse, candidateRecipes);
  const macroTargets = balancedTargets.macroTargets;

  const balancedDays = rebalanceMealPlanNutrition(
    parsedDays,
    candidateRecipes,
    balancedTargets.calorieTarget,
    macroTargets,
    new Set()
  );

  const trimmedDays = trimExcessCalories(balancedDays, balancedTargets.calorieTarget);
  const sanitizedDays = trimmedDays.map(day => {
    const workingDay = {
      ...day,
      lunch: normalizeComboMeal(day.lunch),
      dinner: normalizeComboMeal(day.dinner)
    };

    dedupeNonRiceDishesInDay(workingDay);
    enforceMealDishCaps(workingDay, 4, 5);
    workingDay.totalCalories = Math.round(getDayNutritionTotals(workingDay).calories);
    return workingDay;
  });

  const macroOptimizedDays = sanitizedDays.map(day =>
    optimizeHighCarbMacroDayIfNeeded(
      day,
      candidateRecipes,
      balancedTargets.calorieTarget,
      macroTargets,
      historicalDays
    )
  );

  return {
    days: macroOptimizedDays,
    signalPayload: {
      ...signalPayload,
      generationCalories: balancedTargets.calorieTarget,
      generationMacroTargets: macroTargets
    },
    usedAI: !usedFallback,
    usedFallback
  };
}

async function generateAndStoreMealPlanBySignals({
  userId,
  planType,
  duration,
  avgCalories,
  userGoal,
  dietType,
  allergies,
  activityLevel,
  onboardingData = {},
  nutritionTargets = null,
  skipSimilarityLookup = false,
  excludedMealPlanIds = [],
  generationSource = "user-request",
  trainingCaseKey = null,
  trainingTargetCalories = null,
  existingMealPlan = null,
  targetDayNumber = 1,
  additionalHistoricalDays = []
}) {
  if (!skipSimilarityLookup || excludedMealPlanIds.length > 0) {
    console.log(" Similarity-based meal plan reuse is disabled; always generating fresh days.");
  }

  const isTrainingGeneration = generationSource === "training";
  const generationDuration = isTrainingGeneration ? Math.min(Number(duration || 1), MAX_GENERATION_DAYS) : 1;
  const currentTargetDay = Math.max(1, Number(targetDayNumber || 1));

  const previousDays = Array.isArray(existingMealPlan?.days)
    ? existingMealPlan.days.filter(day => Number(day.dayNumber || 0) < currentTargetDay)
    : [];

  const baseHistoricalDays = [
    ...additionalHistoricalDays,
    ...previousDays
  ];

  let generated = null;
  let generationHistory = baseHistoricalDays;

  for (let attempt = 1; attempt <= MAX_DUPLICATE_REGENERATION_ATTEMPTS; attempt++) {
    generated = await generateMealPlanDaysBySignals({
      avgCalories,
      duration,
      userGoal,
      dietType,
      allergies,
      activityLevel,
      onboardingData,
      nutritionTargets,
      generationDuration,
      historicalDays: generationHistory
    });

    if (!hasDuplicateRecentDay(generated.days, baseHistoricalDays)) {
      break;
    }

    console.log(
      ` Generated meal day duplicates recent history; retrying ` +
      `${attempt}/${MAX_DUPLICATE_REGENERATION_ATTEMPTS}`
    );

    generationHistory = [...generationHistory, ...generated.days];
  }

  const startDate = existingMealPlan?.startDate
    ? new Date(existingMealPlan.startDate)
    : new Date();

  const generatedDays = generated.days.map((day, index) => ({
    ...day,
    dayNumber: currentTargetDay + index,
    date: new Date(startDate.getTime() + (currentTargetDay - 1 + index) * DAY_IN_MS)
  }));

  if (existingMealPlan) {
    const mergedMap = new Map((existingMealPlan.days || []).map(day => [Number(day.dayNumber || 0), day]));
    for (const day of generatedDays) {
      mergedMap.set(Number(day.dayNumber || 0), day);
    }

    existingMealPlan.days = [...mergedMap.values()].sort((a, b) => Number(a.dayNumber || 0) - Number(b.dayNumber || 0));

    const mergedSummary = summarizeMealPlanDays(existingMealPlan.days);
    existingMealPlan.totalRecipes = mergedSummary.totalRecipes;
    existingMealPlan.avgCalories = mergedSummary.avgCalories;
    await existingMealPlan.save();

    return {
      mealPlan: existingMealPlan,
      reusedFromDB: false,
      similarityScore: null,
      usedAI: generated.usedAI,
      usedFallback: generated.usedFallback
    };
  }

  const summary = summarizeMealPlanDays(generatedDays);
  const mealPlan = new MealPlan({
    userId,
    planType,
    duration,
    startDate,
    endDate: new Date(startDate.getTime() + Number(duration || 0) * DAY_IN_MS),
    status: getMealPlanStatusForSource(generationSource),
    days: generatedDays,
    totalRecipes: summary.totalRecipes,
    avgCalories: summary.avgCalories,
    userGoal: generated.signalPayload.userGoal,
    dietType: generated.signalPayload.dietType,
    allergies: generated.signalPayload.allergies,
    activityLevel: generated.signalPayload.activityLevel,
    generationSource,
    trainingCaseKey,
    trainingTargetCalories,
  });

  await mealPlan.save();

  return {
    mealPlan,
    reusedFromDB: false,
    similarityScore: null,
    usedAI: generated.usedAI,
    usedFallback: generated.usedFallback
  };
}

async function evaluateOnboardingMealPlanFeasibility({ onboardingData = {}, nutritionTargets = null }) {
  const dailyCalories = calculateDailyCalories(
    Number(onboardingData.weight || 0),
    Number(onboardingData.height || 0),
    Number(onboardingData.age || 0),
    onboardingData.gender,
    onboardingData.activityLevel,
    onboardingData.goal,
    onboardingData.targetWeight,
    onboardingData.targetDuration
  );

  try {
    const generated = await generateMealPlanDaysBySignals({
      avgCalories: dailyCalories,
      duration: 1,
      userGoal: onboardingData.goal,
      dietType: onboardingData.dietType,
      allergies: onboardingData.allergies,
      activityLevel: onboardingData.activityLevel,
      onboardingData,
      nutritionTargets,
      generationDuration: 1,
      historicalDays: []
    });

    return {
      feasible: true,
      dailyCalories,
      usedAI: generated.usedAI,
      usedFallback: generated.usedFallback,
      reason: null
    };
  } catch (error) {
    return {
      feasible: false,
      dailyCalories,
      usedAI: false,
      usedFallback: false,
      reason: error?.message || 'Unable to generate a valid meal plan for this onboarding profile.'
    };
  }
}

// Generate meal plan using Gemini AI (with real recipes from database)
const generateMealPlan = async (req, res) => {
  try {
    const userId = resolveRequestUserId(req);
    const { skipSimilarityLookup = false, excludeMealPlanIds = [] } = req.body;

    if (!userId) {
      return res.json({ success: false, message: "Unauthorized - no userId" });
    }

    console.log(" Generate meal plan request:", { userId });

    // Get user's onboarding data
    const user = await userModel.findById(userId);
    if (!user || !user.hasCompletedOnboarding) {
      return res.json({ success: false, message: "Please complete onboarding first" });
    }

    const isPremiumActive = isPremiumCurrentlyActive(user);
    if (!isPremiumActive) {
      return res.json({
        success: false,
        message: "Tính năng tạo lộ trình bằng AI chỉ dành cho tài khoản Premium còn hạn"
      });
    }

    const duration = resolveRemainingPremiumDays(user);
    if (!duration) {
      return res.json({
        success: false,
        message: "Không thể tạo lộ trình vì gói Premium đã hết hạn"
      });
    }

    let activeMealPlan = await MealPlan.findOne({ userId, status: 'active' })
      .sort({ startDate: -1, createdAt: -1 });

    while (activeMealPlan && isMealPlanCompleted(activeMealPlan)) {
      activeMealPlan.status = 'completed';
      await activeMealPlan.save();

      activeMealPlan = await MealPlan.findOne({ userId, status: 'active' })
        .sort({ startDate: -1, createdAt: -1 });
    }

    if (activeMealPlan && !isPremiumActive) {
      return res.json({
        success: false,
        message: "Bạn đang có lộ trình đang diễn ra. Hãy hoàn thành lộ trình hiện tại hoặc nâng cấp Premium để tạo lộ trình mới."
      });
    }

    const onboardingData = user.onboardingData;
    console.log(" User onboarding data:", onboardingData);

    const recentHistoricalDays = await getRecentMealPlanHistory(userId, RECENT_MEAL_HISTORY_DAYS);
    console.log(
      ` Recent meal history loaded for duplicate checks: ${recentHistoricalDays.length} days`
    );

    // Regenerate flow should replace old drafts to avoid reopening stale plans.
    await MealPlan.deleteMany(buildUserDraftQuery(userId));

    // Calculate daily calorie needs based on user data
    const dailyCalories = calculateDailyCalories(
      onboardingData.weight,
      onboardingData.height,
      onboardingData.age,
      onboardingData.gender,
      onboardingData.activityLevel,
      onboardingData.goal,
      onboardingData.targetWeight,
      onboardingData.targetDuration
    );

    console.log(" Calculated daily calories:", dailyCalories);

    const result = await generateAndStoreMealPlanBySignals({
      userId,
      planType: user.planType,
      duration,
      avgCalories: dailyCalories,
      userGoal: onboardingData.goal,
      dietType: onboardingData.dietType,
      allergies: onboardingData.allergies,
      activityLevel: onboardingData.activityLevel,
      onboardingData,
      nutritionTargets: user.nutritionTargets,
      skipSimilarityLookup: Boolean(skipSimilarityLookup),
      excludedMealPlanIds: normalizeObjectIdStrings(excludeMealPlanIds),
      additionalHistoricalDays: recentHistoricalDays
    });

    console.log(" Meal plan saved successfully with ID:", result.mealPlan._id);

    const responseMessage = result.usedFallback
      ? "Meal plan day generated successfully! (Note: Using random selection as AI is unavailable)"
      : "AI-powered meal plan day generated successfully!";

    res.json({ 
      success: true, 
      mealPlan: result.mealPlan,
      message: responseMessage,
      duration,
      usedAI: result.usedAI,
      reusedFromDB: result.reusedFromDB,
      similarityScore: result.similarityScore
    });
  } catch (error) {
    console.error(" Error generating meal plan:", error);
    
    // Extract message from various error formats
    let errorMessage = "Error generating meal plan";
    if (error.message) {
      errorMessage = typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }
    
    res.json({ success: false, message: errorMessage });
  }
};

// Confirm and activate meal plan
const confirmMealPlan = async (req, res) => {
  try {
    const userId = resolveRequestUserId(req);
    const { mealPlanId } = req.body;

    if (!userId) {
      return res.json({ success: false, message: "Unauthorized - no userId" });
    }

    console.log('🔵 confirmMealPlan called:');
    console.log('   userId:', userId);
    console.log('   mealPlanId:', mealPlanId);

    if (!mealPlanId) {
      console.log('❌ ERROR: mealPlanId is missing!');
      return res.json({ success: false, message: "mealPlanId is required" });
    }

    // Deactivate all other active meal plans for this user
    await MealPlan.updateMany(
      { userId, status: 'active' },
      { status: 'completed' }
    );

    // Activate the new meal plan
    const mealPlanToActivate = await MealPlan.findOne({ _id: mealPlanId, userId });

    if (!mealPlanToActivate) {
      console.log('❌ ERROR: Meal plan not found by ID');
      return res.json({ success: false, message: "Meal plan not found" });
    }

    const activatedAt = new Date();
    const computedEndDate = new Date(activatedAt.getTime() + Number(mealPlanToActivate.duration || 0) * DAY_IN_MS);

    mealPlanToActivate.status = 'active';
    mealPlanToActivate.startDate = activatedAt;
    mealPlanToActivate.endDate = computedEndDate;
    const updateResult = await mealPlanToActivate.save();

    // Safety cleanup: ensure there are no leftover drafts after confirmation.
  await MealPlan.deleteMany(buildUserDraftQuery(userId));

    console.log('🔵 Update result:', updateResult);

    res.json({ success: true, message: "Meal plan activated successfully" });
  } catch (error) {
    console.error('❌ Error in confirmMealPlan:', error);
    res.json({ success: false, message: "Error confirming meal plan" });
  }
};

// Get active meal plan for user
const getActiveMealPlan = async (req, res) => {
  try {
    const userId = resolveRequestUserId(req);

    if (!userId) {
      return res.json({ success: false, message: "Unauthorized - no userId" });
    }

    let mealPlan = await MealPlan.findOne({ userId, status: 'active' })
      .sort({ startDate: -1, createdAt: -1 });

    // Auto-complete plans that have already finished so the user can create a new one.
    while (mealPlan && isMealPlanCompleted(mealPlan)) {
      mealPlan.status = 'completed';
      await mealPlan.save();

      mealPlan = await MealPlan.findOne({ userId, status: 'active' })
        .sort({ startDate: -1, createdAt: -1 });
    }

    if (!mealPlan) {
      return res.json({ success: false, message: "No active meal plan found" });
    }

    const onboardingUser = await userModel.findById(userId);
    const onboardingData = onboardingUser?.onboardingData || null;
    const canAutoGenerateDay = Boolean(onboardingData && onboardingUser?.hasCompletedOnboarding);

    if (canAutoGenerateDay) {
      const today = new Date();
      const startDate = mealPlan.startDate ? new Date(mealPlan.startDate) : null;

      if (startDate && !Number.isNaN(startDate.getTime())) {
        const currentDayNumber = Math.floor((today - startDate) / DAY_IN_MS) + 1;
        const boundedCurrentDay = Math.min(Math.max(1, currentDayNumber), Number(mealPlan.duration || 1));
        const hasTodayMeal = (mealPlan.days || []).some(day => Number(day.dayNumber) === boundedCurrentDay);

        if (!hasTodayMeal) {
          const dailyCalories = calculateDailyCalories(
            onboardingData.weight,
            onboardingData.height,
            onboardingData.age,
            onboardingData.gender,
            onboardingData.activityLevel,
            onboardingData.goal,
            onboardingData.targetWeight,
            onboardingData.targetDuration
          );

          const generated = await generateAndStoreMealPlanBySignals({
            userId,
            planType: mealPlan.planType,
            duration: mealPlan.duration,
            avgCalories: dailyCalories,
            userGoal: onboardingData.goal,
            dietType: onboardingData.dietType,
            allergies: onboardingData.allergies,
            activityLevel: onboardingData.activityLevel,
            onboardingData,
            nutritionTargets: onboardingUser?.nutritionTargets,
            skipSimilarityLookup: true,
            excludedMealPlanIds: [],
            existingMealPlan: mealPlan,
            targetDayNumber: boundedCurrentDay,
            additionalHistoricalDays: await getRecentMealPlanHistory(userId, RECENT_MEAL_HISTORY_DAYS)
          });

          mealPlan = generated.mealPlan;
        }
      }
    }

    res.json({ success: true, mealPlan });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching meal plan" });
  }
};

// Get draft meal plan for user (for preview page refresh)
const getDraftMealPlan = async (req, res) => {
  try {
    const userId = resolveRequestUserId(req);
    console.log('\n📥 [getDraftMealPlan] Request received');
    console.log('   userId from middleware:', userId);
    console.log('   token from headers:', req.headers.token ? `Present (${req.headers.token.substring(0, 20)}...)` : 'MISSING');

    if (!userId) {
      console.log('   ❌ userId is undefined!');
      return res.json({ success: false, message: "Unauthorized - no userId" });
    }

    const mealPlan = await MealPlan.findOne(buildUserDraftQuery(userId))
      .sort({ updatedAt: -1, createdAt: -1 });
    console.log('   🔍 Query: user draft meal plan excluding training data');
    console.log('   📊 Meal plans found:', mealPlan ? 1 : 0);
    
    if (!mealPlan) {
      console.log('   ❌ No draft meal plan exists');
      return res.json({ success: false, message: "No draft meal plan found" });
    }

    console.log('   ✅ Draft meal plan found');
    console.log('      - ID:', mealPlan._id);
    console.log('      - Duration:', mealPlan.duration);
    console.log('      - Days:', mealPlan.days.length);
    res.json({ success: true, mealPlan });
  } catch (error) {
    console.log('   ❌ Error in getDraftMealPlan:', error.message);
    res.json({ success: false, message: "Error fetching draft meal plan" });
  }
};

// Delete draft meal plans for user (used when user cancels plan creation)
const clearDraftMealPlan = async (req, res) => {
  try {
    const userId = resolveRequestUserId(req);

    if (!userId) {
      return res.json({ success: false, message: "Unauthorized - no userId" });
    }

    const deleteResult = await MealPlan.deleteMany(buildUserDraftQuery(userId));

    return res.json({
      success: true,
      message: 'Draft meal plan cleared',
      deletedCount: deleteResult.deletedCount || 0
    });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: 'Error clearing draft meal plan' });
  }
};

// Helper: parse duration string ('1m','3m','6m','1y') to weeks
function parseDurationToWeeks(duration) {
  if (!duration) return 12; // default ~3 months
  const val = parseFloat(duration);
  if (isNaN(val) || val <= 0) return 12;
  if (duration.endsWith('y')) return val * 52;
  if (duration.endsWith('m')) return val * 4.33;
  if (duration.endsWith('w')) return val;
  return 12;
}

// Helper function: Calculate daily calories using Mifflin-St Jeor equation
function calculateDailyCalories(weight, height, age, gender, activityLevel, goal, targetWeight, targetDuration) {
  // BMR calculation (Mifflin-St Jeor)
  let bmr;
  if (gender === 'Male' || gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  // Activity multiplier
  const activityMultipliers = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'veryActive': 1.9,
    'very_active': 1.9
  };

  const tdee = bmr * (activityMultipliers[activityLevel] || 1.375);

  // Adjust for goal — use targetWeight/targetDuration if available for precise deficit
  let dailyCalories = tdee;
  if (goal === 'lose' || goal === 'Lose') {
    if (targetWeight && targetDuration) {
      const weeks = parseDurationToWeeks(targetDuration);
      const weeklyLoss = parseFloat(targetWeight) / weeks;
      const dailyDeficit = Math.round((weeklyLoss * 7700) / 7);
      dailyCalories = Math.max(1200, tdee - dailyDeficit);
    } else {
      dailyCalories = tdee - 500; // default ~0.5 kg/week
    }
  } else if (goal === 'gain' || goal === 'Gain') {
    if (targetWeight && targetDuration) {
      const weeks = parseDurationToWeeks(targetDuration);
      const weeklyGain = parseFloat(targetWeight) / weeks;
      const dailySurplus = Math.round((weeklyGain * 7700) / 7);
      dailyCalories = tdee + dailySurplus;
    } else {
      dailyCalories = tdee + 300; // default ~0.27 kg/week
    }
  }

  return Math.round(dailyCalories);
}

// Helper function: Safely convert array or string to comma-separated string
function toCommaSeparated(value) {
  if (!value) return 'None';
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : 'None';
  }
  if (typeof value === 'string') {
    return value.trim() || 'None';
  }
  return 'None';
}

// Helper function: Calculate daily macro targets
function calculateMacroTargets(weight, calories, goal) {
  const goalLower = (goal || '').toLowerCase();
  const proteinFactor = goalLower === 'lose' ? 1.4 : goalLower === 'gain' ? 1.4 : 1.2;
  const protein = Math.round(weight * proteinFactor);
  const fat = Math.round(calories * 0.27 / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  const fiber = Math.max(25, Math.round(calories / 1000 * 14));
  return { protein, fat, carbs, fiber };
}

function resolveMacroTargets(nutritionTargets, weight, calories, goal) {
  const fallback = calculateMacroTargets(weight, calories, goal);
  if (!nutritionTargets || typeof nutritionTargets !== 'object') return fallback;

  const protein = Number(nutritionTargets.protein || 0);
  const fat = Number(nutritionTargets.fat || 0);
  const carbs = Number(nutritionTargets.carbs || 0);
  const fiber = Number(nutritionTargets.fiber || 0);

  if (protein > 0 && fat > 0 && carbs > 0 && fiber > 0) {
    return {
      protein: Math.round(protein),
      fat: Math.round(fat),
      carbs: Math.round(carbs),
      fiber: Math.round(fiber)
    };
  }

  return fallback;
}

// Helper function: Build prompt for Gemini AI
function buildGeminiPrompt(user, onboardingData, calorieTarget, duration, recipes, options = {}) {
  const bannedRecipeNames = Array.isArray(options.bannedRecipeNames)
    ? [...new Set(options.bannedRecipeNames.map(normalizeString).filter(Boolean))]
    : [];

  const macros = options.macroTargets || calculateMacroTargets(onboardingData.weight, calorieTarget, onboardingData.goal);

  // Per-meal macro distribution (breakfast 20-30% midpoint 25%, lunch 40%, dinner 35%)
  const bCalMin  = Math.round(calorieTarget * 0.20);
  const bCalMax  = Math.round(calorieTarget * 0.30);
  const bProtein = Math.round(macros.protein * 0.25);
  const bFat     = Math.round(macros.fat     * 0.25);
  const bFiber   = Math.round(macros.fiber   * 0.25);
  const lProtein = Math.round(macros.protein * 0.40);
  const lFat     = Math.round(macros.fat     * 0.40);
  const lFiber   = Math.round(macros.fiber   * 0.40);
  const dProtein = Math.round(macros.protein * 0.35);
  const dFat     = Math.round(macros.fat     * 0.35);
  const dFiber   = Math.round(macros.fiber   * 0.35);

  // Build recipe list with all relevant macros and helpful tags
  const recipeList = recipes.map((r, idx) => {
    const tags = [];
    if (r.isRice || r.category === 'staple') tags.push('RICE');
    if ((r.fat   || 0) >= 10) tags.push('HIGH-FAT');
    if ((r.fiber || 0) >= 5)  tags.push('HIGH-FIBER');
    if ((r.protein || 0) >= 8) tags.push('HIGH-PROTEIN');
    const tagStr = tags.length ? ` [${tags.join(', ')}]` : '';
    return `${idx + 1}. ${r.name} - ${r.calories}kcal | P:${r.protein}g F:${r.fat}g Fb:${r.fiber || 0}g${tagStr}`;
  }).join('\n');

  const bannedSection = bannedRecipeNames.length > 0
    ? `\nAVOID_REPEATING_PREVIOUS_DAYS:
- Do NOT use any recipe whose name appears in this list from previous days: ${bannedRecipeNames.join(', ')}
- This restriction is mandatory unless absolutely impossible due to constraints.\n`
    : '';

  return `Create a ${duration}-day vegan meal plan.

USER: Age ${onboardingData.age}, ${onboardingData.gender}, ${onboardingData.weight}kg, Goal: ${onboardingData.goal}
Allergies: ${toCommaSeparated(onboardingData.allergies)} | Dislikes: ${toCommaSeparated(onboardingData.dislikes)}

DAILY NUTRITION TARGETS:
- Calories: ${calorieTarget} kcal (+-150)
- Protein:  ${macros.protein}g (+-10g) -- achieve via tofu, tempeh, legumes, seeds
- Fat:      ${macros.fat}g (+-8g)  -- include nuts, seeds, avocado, sesame, coconut
- Carbs:    ${macros.carbs}g (+-20g)
- Fiber:    ${macros.fiber}g minimum -- legumes, vegetables, whole grains required

RECIPES (index | name | kcal | Protein | Fat | Fiber | tags):
${recipeList}
${bannedSection}

MEAL STRUCTURE (targets per meal):
- Breakfast: (optional rice) + 1-3 dishes | ${bCalMin}-${bCalMax} kcal (20-30% of daily) | ~${bProtein}g protein | ~${bFat}g fat | ~${bFiber}g fiber
- Lunch:     1 rice + dishes (flexible 1-4) | ~${Math.round(calorieTarget * 0.40)} kcal | ~${lProtein}g protein | ~${lFat}g fat | ~${lFiber}g fiber
- Dinner:    1 rice + dishes (flexible 1-4) | ~${Math.round(calorieTarget * 0.35)} kcal | ~${dProtein}g protein | ~${dFat}g fat | ~${dFiber}g fiber

RULES:
1. Vary recipes daily -- no same dish on consecutive days.
2. BREAKFAST DIVERSITY: Each breakfast recipe must be different from ALL other days. Never repeat the same breakfast recipe within any 7-day window.
3. Fat target: prioritize [HIGH-FAT] recipes at each meal (nuts, seeds, tofu stir-fries, avocado dishes).
4. Fiber target: include at least 1 [HIGH-FIBER] dish per meal (legumes, leafy greens, root vegetables).
5. PROTEIN IS MANDATORY: Each meal MUST include at least 1 [HIGH-PROTEIN] recipe. Lunch MUST have 2 [HIGH-PROTEIN] recipes. Total daily protein MUST reach at least ${Math.max(0, macros.protein - 3)}g -- do NOT select plans that fall short.
6. FAT IS MANDATORY: Total daily fat MUST reach at least ${Math.max(0, macros.fat - 4)}g. The day MUST include at least 2 [HIGH-FAT] dishes across lunch+dinner. Reject low-fat plans.
7. Daily total within +-150 kcal of ${calorieTarget} -- do NOT sacrifice protein/fat to hit calories.
8. Breakfast must have fat AND fiber -- add more dishes (or rice) when needed to reach ${bCalMin} kcal.
9. Balance calories across meals -- lunch and dinner should each be roughly at their targets.
10. Dish-count balance: dinner dishes MUST be equal to lunch OR exactly 1 more. Never make lunch have more dishes than dinner.
11. CARB LIMIT: Total daily carbs MUST NOT exceed ${macros.carbs + 15}g. Limit rice to max 1 serving per meal. Avoid combining multiple high-carb staples (corn + rice + potato) in the same day.
12. For rice selection, prioritize smaller portions first (50g/75g), use 100g only when needed for calories.
13. If carbs are near the limit, prefer low-carb side dishes and use high-fat protein dishes (tofu/tempeh/nuts/seeds) instead of extra starchy dishes.

CRITICAL FORMAT RULES:
- Breakfast field: use {"dishes": [...]} for no-rice breakfast, OR {"rice": {"recipeIndex": N}, "dishes": [...]} when rice is included.
- Lunch and Dinner MUST use: {"rice": {"recipeIndex": N}, "dishes": [{"recipeIndex": N}, ...]}

JSON format (strict, no markdown, recipeIndex = number from list above):
{
  "days": [
    {"day": 1, "breakfast": {"rice": {"recipeIndex": 1}, "dishes": [{"recipeIndex": 5}, {"recipeIndex": 10}]}, "lunch": {"rice": {"recipeIndex": 2}, "dishes": [{"recipeIndex": 12}, {"recipeIndex": 14}]}, "dinner": {"rice": {"recipeIndex": 2}, "dishes": [{"recipeIndex": 8}, {"recipeIndex": 15}]}},
    {"day": 2, "breakfast": {"dishes": [{"recipeIndex": 7}, {"recipeIndex": 11}]}, "lunch": {"rice": {"recipeIndex": 3}, "dishes": [{"recipeIndex": 13}, {"recipeIndex": 16}]}, "dinner": {"rice": {"recipeIndex": 2}, "dishes": [{"recipeIndex": 9}, {"recipeIndex": 17}]}}
  ]
}

Generate the ${duration}-day plan as JSON only:`;
}

// Helper function: Parse Gemini AI response
function parseGeminiResponse(response, recipes) {
  try {
    if (!response || typeof response !== 'string') {
      throw new Error(`Gemini returned empty or invalid response (type: ${typeof response})`);
    }

    // Remove markdown code blocks if present
    let cleanedResponse = response.trim();
    cleanedResponse = cleanedResponse.replace(/```json\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    cleanedResponse = cleanedResponse.trim();

    // Try to extract JSON object
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!parsed.days || !Array.isArray(parsed.days)) {
      throw new Error('Invalid meal plan structure from Gemini');
    }

    // Map recipe indices to actual recipe data
    const days = parsed.days.map(day => {
      // BREAKFAST: Parse as combo meal (optional rice + 1-3 dishes)
      let breakfastCombo;
      if (day.breakfast?.dishes && Array.isArray(day.breakfast.dishes)) {
        // New format: {dishes: [...]} or {rice: {...}, dishes: [...]}
        breakfastCombo = parseBreakfastMeal(day.breakfast, recipes, day.day);
      } else {
        // Legacy fallback: {recipeIndex: N} or bare index
        const breakfastIndex = extractFirstRecipeIndex(day.breakfast, day.day, 'breakfast');
        if (!breakfastIndex) throw new Error(`Missing breakfast recipe index in day ${day.day}`);
        const breakfastRecipe = recipes[breakfastIndex - 1];
        if (!breakfastRecipe) throw new Error(`Invalid breakfast index ${breakfastIndex} (max: ${recipes.length})`);
        breakfastCombo = {
          items: [recipeToMealObject(breakfastRecipe)],
          totalCalories: breakfastRecipe.calories || 0,
          totalProtein:  Math.round((breakfastRecipe.protein  || 0) * 10) / 10,
          totalCarbs:    Math.round((breakfastRecipe.carbs    || 0) * 10) / 10,
          totalFat:      Math.round((breakfastRecipe.fat      || 0) * 10) / 10,
          totalFiber:    Math.round((breakfastRecipe.fiber    || 0) * 10) / 10,
        };
      }

      // LUNCH: Combo meal (rice + dishes)
      let lunchCombo;
      if (day.lunch.rice && day.lunch.dishes) {
        // New format: combo meal
        lunchCombo = parseComboMeal(day.lunch, recipes, day.day, 'lunch');
      } else {
        // Old format fallback: single recipe converted to combo
        console.log(` Day ${day.day} lunch: old format detected, converting to combo`);
        const lunchData = Array.isArray(day.lunch) ? day.lunch[0] : day.lunch;
        const lunchIndex = lunchData?.recipeIndex;
        if (!lunchIndex) throw new Error(`Missing lunch recipe index in day ${day.day}`);
        const lunchRecipe = recipes[lunchIndex - 1];
        if (!lunchRecipe) throw new Error(`Invalid lunch index ${lunchIndex}`);
        
        lunchCombo = {
          items: [recipeToMealObject(lunchRecipe)],
          totalCalories: lunchRecipe.calories,
          totalProtein: lunchRecipe.protein,
          totalCarbs: lunchRecipe.carbs,
          totalFat: lunchRecipe.fat,
          totalFiber: lunchRecipe.fiber || 0
        };
      }

      // DINNER: Combo meal (rice + dishes)
      let dinnerCombo;
      if (day.dinner.rice && day.dinner.dishes) {
        // New format: combo meal
        dinnerCombo = parseComboMeal(day.dinner, recipes, day.day, 'dinner');
      } else {
        // Old format fallback: single recipe converted to combo
        console.log(` Day ${day.day} dinner: old format detected, converting to combo`);
        const dinnerData = Array.isArray(day.dinner) ? day.dinner[0] : day.dinner;
        const dinnerIndex = dinnerData?.recipeIndex;
        if (!dinnerIndex) throw new Error(`Missing dinner recipe index in day ${day.day}`);
        const dinnerRecipe = recipes[dinnerIndex - 1];
        if (!dinnerRecipe) throw new Error(`Invalid dinner index ${dinnerIndex}`);
        
        dinnerCombo = {
          items: [recipeToMealObject(dinnerRecipe)],
          totalCalories: dinnerRecipe.calories,
          totalProtein: dinnerRecipe.protein,
          totalCarbs: dinnerRecipe.carbs,
          totalFat: dinnerRecipe.fat,
          totalFiber: dinnerRecipe.fiber || 0
        };
      }

      const totalCalories =
        (breakfastCombo?.totalCalories || 0) +
        (lunchCombo?.totalCalories    || 0) +
        (dinnerCombo?.totalCalories   || 0);

      return {
        dayNumber: day.day,
        date: new Date(Date.now() + (day.day - 1) * 24 * 60 * 60 * 1000),
        totalCalories,
        breakfast: breakfastCombo,
        lunch: lunchCombo,
        dinner: dinnerCombo
      };
    });

    return days;
  } catch (error) {
    console.error(' Error parsing Gemini response:', error.message);
    console.error('Response was:', typeof response === 'string' ? response.slice(0, 500) : response);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}

// Helper function: Extract first recipe index from flexible AI meal formats
function extractFirstRecipeIndex(mealData, dayNumber, mealType) {
  if (!mealData) return null;

  // Format: { recipeIndex: n }
  if (typeof mealData.recipeIndex === 'number') {
    return mealData.recipeIndex;
  }

  // Format: [{ recipeIndex: n }, ...]
  if (Array.isArray(mealData)) {
    const first = mealData.find(item => typeof item?.recipeIndex === 'number');
    if (first) return first.recipeIndex;
  }

  // Format: { dishes: [{ recipeIndex: n }, ...] }
  if (Array.isArray(mealData.dishes)) {
    const firstDish = mealData.dishes.find(item => typeof item?.recipeIndex === 'number');
    if (firstDish) {
      console.log(` Day ${dayNumber} ${mealType}: using first dish as main item (index ${firstDish.recipeIndex})`);
      return firstDish.recipeIndex;
    }
  }

  // Format: { items: [{ recipeIndex: n }, ...] }
  if (Array.isArray(mealData.items)) {
    const firstItem = mealData.items.find(item => typeof item?.recipeIndex === 'number');
    if (firstItem) return firstItem.recipeIndex;
  }

  return null;
}

// Helper function: Parse breakfast combo (optional rice + 1-3 dishes)
function parseBreakfastMeal(mealData, recipes, dayNumber) {
  const items = [];

  // Optional rice
  if (mealData.rice?.recipeIndex) {
    const riceRecipe = recipes[mealData.rice.recipeIndex - 1];
    if (!riceRecipe) throw new Error(`Invalid breakfast rice index ${mealData.rice.recipeIndex} in day ${dayNumber}`);
    const riceItem = recipeToMealObject(riceRecipe);
    riceItem.isRice = true;
    riceItem.riceAmount = riceRecipe.riceAmount;
    items.push(riceItem);
  }

  // Dishes
  for (const dish of (mealData.dishes || [])) {
    const idx = dish.recipeIndex;
    if (!idx) throw new Error(`Missing dish index in day ${dayNumber} breakfast`);
    const recipe = recipes[idx - 1];
    if (!recipe) throw new Error(`Invalid breakfast index ${idx} in day ${dayNumber}`);
    items.push(recipeToMealObject(recipe));
  }

  if (items.length === 0) throw new Error(`Empty breakfast in day ${dayNumber}`);
  return recomputeComboMealTotals({ items });
}

// Helper function: Parse combo meal (rice + dishes)
function parseComboMeal(mealData, recipes, dayNumber, mealType) {
  const items = [];
  
  // Add rice
  const riceIndex = mealData.rice?.recipeIndex;
  if (!riceIndex) {
    throw new Error(`Missing rice index in day ${dayNumber} ${mealType}`);
  }
  if (riceIndex < 1 || riceIndex > recipes.length) {
    throw new Error(`Rice index ${riceIndex} out of range [1-${recipes.length}] in day ${dayNumber} ${mealType}`);
  }
  const riceRecipe = recipes[riceIndex - 1];
  if (!riceRecipe) {
    throw new Error(`Invalid rice index ${riceIndex} in day ${dayNumber} ${mealType}`);
  }
  
  const riceItem = recipeToMealObject(riceRecipe);
  riceItem.isRice = true;
  riceItem.riceAmount = riceRecipe.riceAmount;
  items.push(riceItem);
  
  // Add dishes  
  if (!mealData.dishes || !Array.isArray(mealData.dishes)) {
    throw new Error(`Missing dishes array in day ${dayNumber} ${mealType}`);
  }
  
  for (const dish of mealData.dishes) {
    const dishIndex = dish.recipeIndex;
    if (!dishIndex) {
      throw new Error(`Missing dish index in day ${dayNumber} ${mealType}`);
    }
    if (dishIndex < 1 || dishIndex > recipes.length) {
      throw new Error(`Dish index ${dishIndex} out of range [1-${recipes.length}] in day ${dayNumber} ${mealType}`);
    }
    const dishRecipe = recipes[dishIndex - 1];
    if (!dishRecipe) {
      throw new Error(`Invalid dish index ${dishIndex} in day ${dayNumber} ${mealType}`);
    }
    items.push(recipeToMealObject(dishRecipe));
  }
  
  // Calculate totals
  const totalCalories = items.reduce((sum, item) => sum + (item.calories || 0), 0);
  const totalProtein = items.reduce((sum, item) => sum + (item.protein || 0), 0);
  const totalCarbs = items.reduce((sum, item) => sum + (item.carbs || 0), 0);
  const totalFat = items.reduce((sum, item) => sum + (item.fat || 0), 0);
  const totalFiber = items.reduce((sum, item) => sum + (item.fiber || 0), 0);
  const totalCholesterol = items.reduce((sum, item) => sum + (item.cholesterol || 0), 0);
  const totalOmega3 = items.reduce((sum, item) => sum + (item.omega3 || 0), 0);
  const totalWater = items.reduce((sum, item) => sum + (item.water || 0), 0);
  const totalSaturatedFat = items.reduce((sum, item) => sum + (item.saturatedFat || 0), 0);
  const totalSodium = items.reduce((sum, item) => sum + (item.sodium || 0), 0);
  
  return {
    items,
    totalCalories: Math.round(totalCalories),
    totalProtein: Math.round(totalProtein * 10) / 10,
    totalCarbs: Math.round(totalCarbs * 10) / 10,
    totalFat: Math.round(totalFat * 10) / 10,
    totalFiber: Math.round(totalFiber * 10) / 10,
    totalCholesterol: Math.round(totalCholesterol),
    totalOmega3: Math.round(totalOmega3 * 10) / 10,
    totalWater: Math.round(totalWater),
    totalSaturatedFat: Math.round(totalSaturatedFat * 10) / 10,
    totalSodium: Math.round(totalSodium)
  };
}

// Helper function: Improve day nutrition after AI generation
function recomputeComboMealTotals(comboMeal) {
  const items = comboMeal.items || [];
  return {
    ...comboMeal,
    totalCalories:     Math.round(items.reduce((s, i) => s + (i.calories     || 0), 0)),
    totalProtein:      Math.round(items.reduce((s, i) => s + (i.protein      || 0), 0) * 10) / 10,
    totalCarbs:        Math.round(items.reduce((s, i) => s + (i.carbs        || 0), 0) * 10) / 10,
    totalFat:          Math.round(items.reduce((s, i) => s + (i.fat          || 0), 0) * 10) / 10,
    totalFiber:        Math.round(items.reduce((s, i) => s + (i.fiber        || 0), 0) * 10) / 10,
    totalCholesterol:  Math.round(items.reduce((s, i) => s + (i.cholesterol  || 0), 0)),
    totalOmega3:       Math.round(items.reduce((s, i) => s + (i.omega3       || 0), 0) * 10) / 10,
    totalWater:        Math.round(items.reduce((s, i) => s + (i.water        || 0), 0)),
    totalSaturatedFat: Math.round(items.reduce((s, i) => s + (i.saturatedFat || 0), 0) * 10) / 10,
    totalSodium:       Math.round(items.reduce((s, i) => s + (i.sodium       || 0), 0)),
  };
}

// Trim per-day calorie excess by removing highest-calorie non-rice dishes
function trimExcessCalories(days, calorieTarget) {
  const maxAllowed = calorieTarget + 150;

  return days.map(day => {
    const workingDay = {
      ...day,
      lunch:  { ...day.lunch,  items: [...(day.lunch?.items  || [])] },
      dinner: { ...day.dinner, items: [...(day.dinner?.items || [])] },
    };

    for (let round = 0; round < 8; round++) {
      const totals = getDayNutritionTotals(workingDay);
      if (totals.calories <= maxAllowed) break;

      const lunchDishes  = workingDay.lunch.items.filter(i => !i.isRice);
      const dinnerDishes = workingDay.dinner.items.filter(i => !i.isRice);

      const candidates = [];
      const lunchDishCount = lunchDishes.length;
      const dinnerDishCount = dinnerDishes.length;

      if (
        lunchDishCount > 1 &&
        isDishBalanceValidAfterRemoval('lunch', lunchDishCount, dinnerDishCount)
      ) {
        candidates.push({
          meal: 'lunch',
          dish: lunchDishes.reduce((m, d) => (d.calories || 0) > (m.calories || 0) ? d : m)
        });
      }
      if (
        dinnerDishCount > 1 &&
        isDishBalanceValidAfterRemoval('dinner', lunchDishCount, dinnerDishCount)
      ) {
        candidates.push({
          meal: 'dinner',
          dish: dinnerDishes.reduce((m, d) => (d.calories || 0) > (m.calories || 0) ? d : m)
        });
      }

      if (candidates.length === 0) break;

      const toRemove = candidates.reduce((m, c) => (c.dish.calories || 0) > (m.dish.calories || 0) ? c : m);

      if (toRemove.meal === 'lunch') {
        workingDay.lunch.items = workingDay.lunch.items.filter(i => i !== toRemove.dish);
        workingDay.lunch = recomputeComboMealTotals(workingDay.lunch);
      } else {
        workingDay.dinner.items = workingDay.dinner.items.filter(i => i !== toRemove.dish);
        workingDay.dinner = recomputeComboMealTotals(workingDay.dinner);
      }

      console.log(` Day ${workingDay.dayNumber}: trimmed "${toRemove.dish.name}" (${toRemove.dish.calories}kcal) from ${toRemove.meal}`);
    }

    workingDay.totalCalories = Math.round(getDayNutritionTotals(workingDay).calories);
    return workingDay;
  });
}

function rebalanceMealPlanNutrition(days, recipes, calorieTarget, macroTargets, blockedRecipeIds = new Set()) {
  const MAX_LUNCH_DISHES = 4;
  const MAX_DINNER_DISHES = 5;
  const minProtein = macroTargets.protein * 0.98;
  const minFat = macroTargets.fat * 0.97;
  const maxProtein = macroTargets.protein * 1.14;
  const maxFat = macroTargets.fat * 1.16;
  const minCarbs = macroTargets.carbs * 0.96;
  const minFiber = macroTargets.fiber * 0.95;
  const maxFiber = macroTargets.fiber;
  const maxCarbs = macroTargets.carbs * 1.08;
  const minCalories = Math.max(1200, calorieTarget * 0.97);
  const dishRecipes = recipes.filter(r => !r.isRice && r.category !== 'staple');
  const riceRecipes = recipes.filter(r => r.isRice || r.category === 'staple');

  return days.map(day => {
    const workingDay = {
      ...day,
      lunch: normalizeComboMeal(day.lunch),
      dinner: normalizeComboMeal(day.dinner)
    };

    dedupeNonRiceDishesInDay(workingDay);
    enforceMealDishCaps(workingDay, MAX_LUNCH_DISHES, MAX_DINNER_DISHES);

    for (let i = 0; i < 6; i++) {
      const totals = getDayNutritionTotals(workingDay);
      const proteinDeficit = Math.max(0, minProtein - totals.protein);
      const fatDeficit = Math.max(0, minFat - totals.fat);
      const fiberDeficit = Math.max(0, minFiber - totals.fiber);
      const fiberExcess = Math.max(0, totals.fiber - maxFiber);
      const carbExcess = Math.max(0, totals.carbs - maxCarbs);
      const carbDeficit = Math.max(0, minCarbs - totals.carbs);
      const proteinExcess = Math.max(0, totals.protein - maxProtein);
      const fatExcess = Math.max(0, totals.fat - maxFat);

      if (
        proteinDeficit <= 0 && fatDeficit <= 0 && fiberDeficit <= 0 &&
        fiberExcess <= 0 && carbExcess <= 0 && carbDeficit <= 0 &&
        proteinExcess <= 0 && fatExcess <= 0
      ) {
        break;
      }

      const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
      const usedRecipeIds = new Set([...dayUsedRecipeIds]);
      for (const blockedId of blockedRecipeIds) {
        usedRecipeIds.add(String(blockedId));
      }

      const remainingCalories = Math.max(0, (calorieTarget + 150) - totals.calories);
      let boosterRecipe = pickBestBoosterRecipe(
        dishRecipes,
        usedRecipeIds,
        {
          proteinDeficit,
          fatDeficit,
          fiberDeficit,
          fiberExcess,
          carbExcess,
          carbDeficit,
          proteinExcess,
          fatExcess
        },
        remainingCalories,
        { allowUsedRecipes: false, avoidRecipeIds: dayUsedRecipeIds, avoidRecipeNames: dayUsedRecipeNames }
      );

      // If still fat-deficient, allow repeating a high-fat dish as a controlled fallback.
      if (!boosterRecipe && fatDeficit > 6) {
        boosterRecipe = pickBestBoosterRecipe(
          dishRecipes,
          usedRecipeIds,
          {
            proteinDeficit,
            fatDeficit,
            fiberDeficit,
            fiberExcess,
            carbExcess,
            carbDeficit,
            proteinExcess,
            fatExcess
          },
          remainingCalories,
          { allowUsedRecipes: true, requireHighFat: true, avoidRecipeIds: dayUsedRecipeIds, avoidRecipeNames: dayUsedRecipeNames }
        );
      }

      if (!boosterRecipe) {
        break;
      }

      // Add booster to the meal proportionally furthest below its calorie target,
      // but also respect dish-count balance (max 1 dish difference between lunch and dinner).
      const lunchTarget  = calorieTarget * 0.40;
      const dinnerTarget = calorieTarget * 0.35;
      const lunchRatio   = (workingDay.lunch.totalCalories  || 0) / lunchTarget;
      const dinnerRatio  = (workingDay.dinner.totalCalories || 0) / dinnerTarget;
      const lunchDishCount  = workingDay.lunch.items.filter(i => !i.isRice).length;
      const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;
      let targetCombo;
      if (lunchDishCount > dinnerDishCount + 1) {
        targetCombo = workingDay.dinner;  // lunch already has more — balance toward dinner
      } else if (dinnerDishCount > lunchDishCount + 1) {
        targetCombo = workingDay.lunch;   // dinner already has more — balance toward lunch
      } else {
        targetCombo = lunchRatio <= dinnerRatio ? workingDay.lunch : workingDay.dinner;
      }

      if (targetCombo === workingDay.lunch && lunchDishCount >= MAX_LUNCH_DISHES) {
        if (dinnerDishCount < MAX_DINNER_DISHES) targetCombo = workingDay.dinner;
        else break;
      }
      if (targetCombo === workingDay.dinner && dinnerDishCount >= MAX_DINNER_DISHES) {
        if (lunchDishCount < MAX_LUNCH_DISHES) targetCombo = workingDay.lunch;
        else break;
      }
      addRecipeToComboMeal(targetCombo, boosterRecipe);
    }

    let finalTotals = getDayNutritionTotals(workingDay);

    // Last-mile rescue for fat: add up to 3 high-fat dishes even if calories are slightly over.
    let fatRescueCount = 0;
    while (finalTotals.fat < minFat && fatRescueCount < 3) {
      const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
      const usedRecipeIds = new Set([...dayUsedRecipeIds]);
      for (const blockedId of blockedRecipeIds) {
        usedRecipeIds.add(String(blockedId));
      }

      const fatOnlyBooster = pickBestBoosterRecipe(
        dishRecipes,
        usedRecipeIds,
        {
          proteinDeficit: 0,
          fatDeficit: Math.max(0, minFat - finalTotals.fat),
          fiberDeficit: 0,
          fiberExcess: Math.max(0, finalTotals.fiber - maxFiber),
          carbExcess: Math.max(0, finalTotals.carbs - maxCarbs),
          carbDeficit: Math.max(0, minCarbs - finalTotals.carbs),
          proteinExcess: Math.max(0, finalTotals.protein - maxProtein),
          fatExcess: Math.max(0, finalTotals.fat - maxFat)
        },
        0,
        {
          allowUsedRecipes: true,
          requireHighFat: true,
          maxCarbs: 16,
          maxCarbDensity: 7,
          avoidRecipeIds: dayUsedRecipeIds,
          avoidRecipeNames: dayUsedRecipeNames
        }
      );

      if (!fatOnlyBooster) break;
      // Add fat rescue to whichever meal has fewer dishes to maintain balance
      const lDishes = workingDay.lunch.items.filter(i => !i.isRice).length;
      const dDishes = workingDay.dinner.items.filter(i => !i.isRice).length;
      if (lDishes >= MAX_LUNCH_DISHES && dDishes >= MAX_DINNER_DISHES) break;
      const targetMeal = lDishes <= dDishes ? workingDay.lunch : workingDay.dinner;
      if (targetMeal === workingDay.lunch && lDishes >= MAX_LUNCH_DISHES) {
        addRecipeToComboMeal(workingDay.dinner, fatOnlyBooster);
      } else if (targetMeal === workingDay.dinner && dDishes >= MAX_DINNER_DISHES) {
        addRecipeToComboMeal(workingDay.lunch, fatOnlyBooster);
      } else {
        addRecipeToComboMeal(targetMeal, fatOnlyBooster);
      }
      finalTotals = getDayNutritionTotals(workingDay);
      fatRescueCount += 1;
    }

    // Last-mile rescue for protein with carb-aware selection.
    let proteinRescueCount = 0;
    while (finalTotals.protein < minProtein && proteinRescueCount < 3) {
      const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
      const usedRecipeIds = new Set([...dayUsedRecipeIds]);
      for (const blockedId of blockedRecipeIds) {
        usedRecipeIds.add(String(blockedId));
      }

      const proteinOnlyBooster = pickBestBoosterRecipe(
        dishRecipes,
        usedRecipeIds,
        {
          proteinDeficit: Math.max(0, minProtein - finalTotals.protein),
          fatDeficit: 0,
          fiberDeficit: 0,
          fiberExcess: Math.max(0, finalTotals.fiber - maxFiber),
          carbExcess: Math.max(0, finalTotals.carbs - maxCarbs),
          carbDeficit: Math.max(0, minCarbs - finalTotals.carbs),
          proteinExcess: Math.max(0, finalTotals.protein - maxProtein),
          fatExcess: Math.max(0, finalTotals.fat - maxFat)
        },
        Math.max(0, (calorieTarget + 180) - finalTotals.calories),
        {
          allowUsedRecipes: true,
          requireHighProtein: true,
          maxCarbDensity: 8,
          avoidRecipeIds: dayUsedRecipeIds,
          avoidRecipeNames: dayUsedRecipeNames
        }
      );

      if (!proteinOnlyBooster) break;
      const lDishes = workingDay.lunch.items.filter(i => !i.isRice).length;
      const dDishes = workingDay.dinner.items.filter(i => !i.isRice).length;
      if (lDishes >= MAX_LUNCH_DISHES && dDishes >= MAX_DINNER_DISHES) break;
      const targetMeal = lDishes <= dDishes ? workingDay.lunch : workingDay.dinner;
      if (targetMeal === workingDay.lunch && lDishes >= MAX_LUNCH_DISHES) {
        addRecipeToComboMeal(workingDay.dinner, proteinOnlyBooster);
      } else if (targetMeal === workingDay.dinner && dDishes >= MAX_DINNER_DISHES) {
        addRecipeToComboMeal(workingDay.lunch, proteinOnlyBooster);
      } else {
        addRecipeToComboMeal(targetMeal, proteinOnlyBooster);
      }
      finalTotals = getDayNutritionTotals(workingDay);
      proteinRescueCount += 1;
    }

    applyCarbFatCorrection(
      workingDay,
      dishRecipes,
      blockedRecipeIds,
      { minProtein, minFat, maxFiber, maxCarbs, minCalories },
      calorieTarget
    );

    enforceDinnerDishPreference(
      workingDay,
      dishRecipes,
      blockedRecipeIds,
      { minProtein, minFat, maxFiber, maxCarbs },
      calorieTarget
    );

    enforceMacroFloor(
      workingDay,
      dishRecipes,
      blockedRecipeIds,
      {
        minCalories,
        minProtein,
        minFat,
        maxFiber,
        maxCarbs,
        maxLunchDishes: MAX_LUNCH_DISHES,
        maxDinnerDishes: MAX_DINNER_DISHES
      },
      calorieTarget
    );

    enforceMacroBalanceTargets(
      workingDay,
      dishRecipes,
      riceRecipes,
      blockedRecipeIds,
      {
        minCalories,
        minProtein,
        minFat,
        minCarbs,
        maxProtein,
        maxFat,
        maxFiber,
        maxCarbs,
        maxLunchDishes: MAX_LUNCH_DISHES,
        maxDinnerDishes: MAX_DINNER_DISHES
      },
      calorieTarget
    );

    enforceUpperMacroCaps(
      workingDay,
      dishRecipes,
      riceRecipes,
      blockedRecipeIds,
      {
        minCalories,
        minCarbs,
        maxProtein,
        maxFat,
        maxLunchDishes: MAX_LUNCH_DISHES,
        maxDinnerDishes: MAX_DINNER_DISHES
      },
      calorieTarget
    );

    enforceProteinFatQuality(
      workingDay,
      dishRecipes,
      blockedRecipeIds,
      {
        minProtein,
        minFat,
        maxFiber,
        maxCarbs,
        maxLunchDishes: MAX_LUNCH_DISHES,
        maxDinnerDishes: MAX_DINNER_DISHES
      },
      calorieTarget
    );

    enforceCalorieFloor(
      workingDay,
      dishRecipes,
      blockedRecipeIds,
      {
        minCalories,
        minFat,
        maxFiber,
        maxCarbs,
        maxLunchDishes: MAX_LUNCH_DISHES,
        maxDinnerDishes: MAX_DINNER_DISHES
      },
      calorieTarget
    );

    enforceFiberCap(
      workingDay,
      dishRecipes,
      blockedRecipeIds,
      {
        minCalories,
        minProtein,
        minFat,
        maxFiber,
        maxCarbs,
        maxLunchDishes: MAX_LUNCH_DISHES,
        maxDinnerDishes: MAX_DINNER_DISHES
      },
      calorieTarget
    );

    enforceMacroFloor(
      workingDay,
      dishRecipes,
      blockedRecipeIds,
      {
        minCalories,
        minProtein,
        minFat,
        maxFiber,
        maxCarbs,
        maxLunchDishes: MAX_LUNCH_DISHES,
        maxDinnerDishes: MAX_DINNER_DISHES
      },
      calorieTarget
    );

    enforceFinalMacroFloors(
      workingDay,
      dishRecipes,
      riceRecipes,
      blockedRecipeIds,
      {
        minCalories,
        minCarbs,
        minFat,
        minFiber,
        maxProtein,
        maxFat,
        maxFiber,
        maxLunchDishes: MAX_LUNCH_DISHES,
        maxDinnerDishes: MAX_DINNER_DISHES
      },
      calorieTarget
    );

    dedupeNonRiceDishesInDay(workingDay);
    enforceMealDishCaps(workingDay, MAX_LUNCH_DISHES, MAX_DINNER_DISHES);

    // Dish-cap and dedupe can remove boosters, so run one more floor recovery pass.
    enforceFinalMacroFloors(
      workingDay,
      dishRecipes,
      riceRecipes,
      blockedRecipeIds,
      {
        minCalories,
        minCarbs,
        minFat,
        minFiber,
        maxProtein,
        maxFat,
        maxFiber,
        maxLunchDishes: MAX_LUNCH_DISHES,
        maxDinnerDishes: MAX_DINNER_DISHES
      },
      calorieTarget
    );

    enforceMinimumMealStructure(
      workingDay,
      dishRecipes,
      blockedRecipeIds,
      {
        minCalories,
        minCarbs,
        minFat,
        minFiber,
        maxProtein,
        maxFat,
        maxFiber,
        maxLunchDishes: MAX_LUNCH_DISHES,
        maxDinnerDishes: MAX_DINNER_DISHES,
        minLunchDishes: 4,
        minDinnerDishes: 4
      },
      calorieTarget
    );

    enforceHardMacroClamp(
      workingDay,
      dishRecipes,
      riceRecipes,
      blockedRecipeIds,
      {
        minCalories,
        minCarbs,
        minFat,
        minFiber,
        maxProtein,
        maxFat,
        maxFiber,
        maxLunchDishes: MAX_LUNCH_DISHES,
        maxDinnerDishes: MAX_DINNER_DISHES
      },
      calorieTarget
    );

    dedupeNonRiceDishesInDay(workingDay);
    enforceMealDishCaps(workingDay, MAX_LUNCH_DISHES, MAX_DINNER_DISHES);

    finalTotals = getDayNutritionTotals(workingDay);

    const stillShort =
      finalTotals.protein < minProtein ||
      finalTotals.fat < minFat ||
      finalTotals.fiber < minFiber;

    if (stillShort) {
      console.log(
        ` Day ${workingDay.dayNumber}: still slightly below macro targets after rebalance ` +
        `(P:${finalTotals.protein.toFixed(1)} F:${finalTotals.fat.toFixed(1)} Fb:${finalTotals.fiber.toFixed(1)})`
      );
    }

    workingDay.totalCalories = Math.round(finalTotals.calories);
    return workingDay;
  });
}

function normalizeComboMeal(meal) {
  if (meal?.items && Array.isArray(meal.items)) return { ...meal, items: [...meal.items] };
  return {
    items: meal ? [meal] : [],
    totalCalories: meal?.calories || 0,
    totalProtein: meal?.protein || 0,
    totalCarbs: meal?.carbs || 0,
    totalFat: meal?.fat || 0,
    totalFiber: meal?.fiber || 0,
    totalCholesterol: meal?.cholesterol || 0,
    totalOmega3: meal?.omega3 || 0,
    totalWater: meal?.water || 0,
    totalSaturatedFat: meal?.saturatedFat || 0,
    totalSodium: meal?.sodium || 0
  };
}

function getBreakfastCalories(breakfast) {
  if (!breakfast) return 0;
  // New combo format
  if (breakfast.totalCalories != null) return breakfast.totalCalories;
  // Legacy single-recipe format
  return breakfast.calories || 0;
}
function getBreakfastMacro(breakfast, field) {
  if (!breakfast) return 0;
  if (breakfast[`total${field.charAt(0).toUpperCase()}${field.slice(1)}`] != null)
    return breakfast[`total${field.charAt(0).toUpperCase()}${field.slice(1)}`];
  return breakfast[field] || 0;
}

function getDayNutritionTotals(day) {
  return {
    calories: getBreakfastCalories(day.breakfast) + (day.lunch?.totalCalories || 0) + (day.dinner?.totalCalories || 0),
    protein:  getBreakfastMacro(day.breakfast, 'protein') + (day.lunch?.totalProtein || 0) + (day.dinner?.totalProtein || 0),
    carbs:    getBreakfastMacro(day.breakfast, 'carbs')   + (day.lunch?.totalCarbs   || 0) + (day.dinner?.totalCarbs   || 0),
    fat:      getBreakfastMacro(day.breakfast, 'fat')     + (day.lunch?.totalFat     || 0) + (day.dinner?.totalFat     || 0),
    fiber:    getBreakfastMacro(day.breakfast, 'fiber')   + (day.lunch?.totalFiber   || 0) + (day.dinner?.totalFiber   || 0),
    cholesterol: getBreakfastMacro(day.breakfast, 'cholesterol') + (day.lunch?.totalCholesterol || 0) + (day.dinner?.totalCholesterol || 0),
    omega3:      getBreakfastMacro(day.breakfast, 'omega3')      + (day.lunch?.totalOmega3      || 0) + (day.dinner?.totalOmega3      || 0),
    water:       getBreakfastMacro(day.breakfast, 'water')       + (day.lunch?.totalWater       || 0) + (day.dinner?.totalWater       || 0),
    saturatedFat:getBreakfastMacro(day.breakfast, 'saturatedFat')+ (day.lunch?.totalSaturatedFat|| 0) + (day.dinner?.totalSaturatedFat|| 0),
    sodium:      getBreakfastMacro(day.breakfast, 'sodium')      + (day.lunch?.totalSodium      || 0) + (day.dinner?.totalSodium      || 0)
  };
}

function isDayWithinDebugNutritionTargets(totals, calorieTarget, macroTargets) {
  return (
    totals.calories >= calorieTarget - 120 &&
    totals.calories <= calorieTarget + 180 &&
    totals.protein >= macroTargets.protein * 0.95 &&
    totals.protein <= macroTargets.protein * 1.14 &&
    totals.fat >= macroTargets.fat * 0.97 &&
    totals.fat <= macroTargets.fat * 1.16 &&
    totals.carbs >= macroTargets.carbs * 0.96 &&
    totals.carbs <= macroTargets.carbs * 1.12 &&
    totals.fiber >= macroTargets.fiber * 0.95 &&
    totals.fiber <= macroTargets.fiber * 1.15
  );
}

function scoreNutritionDistance(totals, calorieTarget, macroTargets) {
  return (
    Math.abs(totals.calories - calorieTarget) / 10 +
    Math.abs(totals.protein - macroTargets.protein) * 4 +
    Math.abs(totals.fat - macroTargets.fat) * 4 +
    Math.abs(totals.carbs - macroTargets.carbs) * 2 +
    Math.abs(totals.fiber - macroTargets.fiber) * 6
  );
}

function createSeededRandom(seedValue) {
  let seed = 2166136261;
  const text = String(seedValue || "meal-plan");
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(items, random) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function isRiceRecipe(recipe) {
  return Boolean(recipe?.isRice || recipe?.category === 'staple');
}

function buildOptimizedDayFromRecipes(sourceDay, riceChoices, nonRiceChoices) {
  const breakfastItems = [
    riceChoices[0],
    ...nonRiceChoices.slice(0, 2)
  ].filter(Boolean).map(recipeToMealObject);

  const lunchItems = [
    riceChoices[1],
    ...nonRiceChoices.slice(2, 6)
  ].filter(Boolean).map(recipeToMealObject);

  const dinnerItems = [
    riceChoices[2],
    ...nonRiceChoices.slice(6, 11)
  ].filter(Boolean).map(recipeToMealObject);

  const optimizedDay = {
    ...sourceDay,
    breakfast: recomputeComboMealTotals({ items: breakfastItems }),
    lunch: recomputeComboMealTotals({ items: lunchItems }),
    dinner: recomputeComboMealTotals({ items: dinnerItems })
  };

  optimizedDay.totalCalories = Math.round(getDayNutritionTotals(optimizedDay).calories);
  return optimizedDay;
}

function optimizeHighCarbMacroDayIfNeeded(day, recipes, calorieTarget, macroTargets, historicalDays = []) {
  const historicalSignatures = new Set(historicalDays.map(getDaySignature).filter(Boolean));
  const currentSignature = getDaySignature(day);
  const currentTotals = getDayNutritionTotals(day);
  if (
    isDayWithinDebugNutritionTargets(currentTotals, calorieTarget, macroTargets) &&
    !historicalSignatures.has(currentSignature)
  ) {
    return day;
  }

  const isHighCarbProfile = macroTargets.carbs >= calorieTarget * 0.14;
  if (!isHighCarbProfile) {
    return day;
  }

  const riceRecipes = recipes
    .filter(isRiceRecipe)
    .filter(recipe => Number(recipe.calories || 0) > 0 && Number(recipe.carbs || 0) > 0)
    .sort((a, b) => {
      const carbDiff = Number(b.carbs || 0) - Number(a.carbs || 0);
      if (carbDiff !== 0) return carbDiff;
      return Number(b.calories || 0) - Number(a.calories || 0);
    });

  const nonRiceRecipes = recipes
    .filter(recipe => !isRiceRecipe(recipe))
    .filter(recipe => Number(recipe.calories || 0) > 0);

  if (riceRecipes.length < 2 || nonRiceRecipes.length < 7) {
    return day;
  }

  const currentScore = scoreNutritionDistance(currentTotals, calorieTarget, macroTargets);
  let bestDay = day;
  let bestScore = currentScore;

  const riceSets = [];
  for (const breakfastRice of riceRecipes) {
    for (const lunchRice of riceRecipes) {
      for (const dinnerRice of riceRecipes) {
        riceSets.push([breakfastRice, lunchRice, dinnerRice]);
      }
    }
  }

  const historySeed = [...historicalSignatures].slice(0, 6).join(";");
  const random = createSeededRandom(`${day.dayNumber || 1}-${calorieTarget}-${macroTargets.carbs}-${historySeed}`);
  const searchPool = [...nonRiceRecipes].sort((a, b) => {
    const aScore =
      Number(a.carbs || 0) * 2 +
      Number(a.fat || 0) * 1.7 +
      Number(a.fiber || 0) * 1.2 -
      Number(a.protein || 0) * 1.1;
    const bScore =
      Number(b.carbs || 0) * 2 +
      Number(b.fat || 0) * 1.7 +
      Number(b.fiber || 0) * 1.2 -
      Number(b.protein || 0) * 1.1;
    return bScore - aScore;
  });

  const attempts = Math.min(25000, Math.max(5000, searchPool.length * 220));
  for (let attempt = 0; attempt < attempts; attempt++) {
    const riceChoices = riceSets[Math.floor(random() * riceSets.length)];
    const shuffledNonRice = seededShuffle(searchPool, random);
    const pickedNonRice = shuffledNonRice.slice(0, 11);

    const candidateDay = buildOptimizedDayFromRecipes(day, riceChoices, pickedNonRice);
    dedupeNonRiceDishesInDay(candidateDay);
    enforceMealDishCaps(candidateDay, 4, 5);
    candidateDay.totalCalories = Math.round(getDayNutritionTotals(candidateDay).calories);

    const candidateSignature = getDaySignature(candidateDay);
    if (historicalSignatures.has(candidateSignature)) {
      continue;
    }

    const totals = getDayNutritionTotals(candidateDay);
    const score = scoreNutritionDistance(totals, calorieTarget, macroTargets);

    if (score < bestScore) {
      bestDay = candidateDay;
      bestScore = score;
    }

    if (isDayWithinDebugNutritionTargets(totals, calorieTarget, macroTargets)) {
      console.log(
        ` High-carb macro optimizer recovered day ${day.dayNumber || 1}: ` +
        `Cal:${totals.calories} P:${totals.protein.toFixed(1)} F:${totals.fat.toFixed(1)} ` +
        `C:${totals.carbs.toFixed(1)} Fb:${totals.fiber.toFixed(1)}`
      );
      return candidateDay;
    }
  }

  if (bestScore < currentScore) {
    const totals = getDayNutritionTotals(bestDay);
    console.log(
      ` High-carb macro optimizer improved day ${day.dayNumber || 1}: ` +
      `Cal:${totals.calories} P:${totals.protein.toFixed(1)} F:${totals.fat.toFixed(1)} ` +
      `C:${totals.carbs.toFixed(1)} Fb:${totals.fiber.toFixed(1)}`
    );
  }

  return bestDay;
}

function getDayUsedRecipeSignals(workingDay) {
  const allItems = [
    ...(workingDay.breakfast?.items || (workingDay.breakfast ? [workingDay.breakfast] : [])),
    ...(workingDay.lunch?.items || []),
    ...(workingDay.dinner?.items || [])
  ];

  const ids = new Set(
    allItems
      .map(item => item?.recipeId?.toString?.())
      .filter(Boolean)
  );

  const names = new Set(
    allItems
      .map(item => canonicalizeDishName(item?.name || ''))
      .filter(Boolean)
  );

  return { ids, names };
}

function applyCarbFatCorrection(workingDay, dishRecipes, blockedRecipeIds, thresholds, calorieTarget) {
  const {
    minProtein,
    minFat,
    maxFiber,
    maxCarbs,
    minCalories = 0
  } = thresholds;

  for (let round = 0; round < 6; round++) {
    let totals = getDayNutritionTotals(workingDay);
    const carbExcess = Math.max(0, totals.carbs - maxCarbs);
    const fiberExcess = Math.max(0, totals.fiber - maxFiber);
    const fatDeficit = Math.max(0, minFat - totals.fat);
    const proteinDeficit = Math.max(0, minProtein - totals.protein);
    if (carbExcess <= 0 && fiberExcess <= 0 && fatDeficit <= 0 && proteinDeficit <= 0) break;

    if ((carbExcess > 0 || fiberExcess > 0) && totals.calories >= (minCalories - 250)) {
      const removal = pickHighCarbRemovalCandidate(
        workingDay,
        totals,
        minProtein,
        Math.max(0, totals.fiber - maxFiber)
      );
      if (removal) {
        const combo = workingDay[removal.mealKey];
        combo.items = combo.items.filter(item => item !== removal.dish);
        workingDay[removal.mealKey] = recomputeComboMealTotals(combo);
        totals = getDayNutritionTotals(workingDay);
      }
    }

    const updatedFatDeficit = Math.max(0, minFat - totals.fat);
    const updatedProteinDeficit = Math.max(0, minProtein - totals.protein);
    if (updatedFatDeficit > 0 || updatedProteinDeficit > 0) {
      const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
      const usedRecipeIds = new Set([...dayUsedRecipeIds]);
      for (const blockedId of blockedRecipeIds) {
        usedRecipeIds.add(String(blockedId));
      }

      const remainingCalories = Math.max(0, (calorieTarget + 180) - totals.calories);
      const fatBooster = pickBestBoosterRecipe(
        dishRecipes,
        usedRecipeIds,
        {
          proteinDeficit: updatedProteinDeficit,
          fatDeficit: updatedFatDeficit,
          fiberDeficit: 0,
          fiberExcess: Math.max(0, totals.fiber - maxFiber),
          carbExcess: Math.max(0, totals.carbs - maxCarbs)
        },
        remainingCalories,
        {
          allowUsedRecipes: true,
          requireHighFat: updatedFatDeficit > 0,
          requireHighProtein: updatedProteinDeficit > 0,
          maxCarbs: 14,
          maxCarbDensity: 6.5,
          avoidRecipeIds: dayUsedRecipeIds,
          avoidRecipeNames: dayUsedRecipeNames
        }
      );

      if (fatBooster) {
        const lunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
        const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;
        addRecipeToComboMeal(lunchDishCount <= dinnerDishCount ? workingDay.lunch : workingDay.dinner, fatBooster);
      }
    }
  }
}

function pickHighCarbRemovalCandidate(workingDay, totals, minProtein, fiberExcess = 0) {
  const candidates = [];
  const proteinBuffer = (totals?.protein || 0) - (minProtein || 0);
  for (const mealKey of ['lunch', 'dinner']) {
    const combo = workingDay[mealKey];
    const nonRiceDishes = (combo?.items || []).filter(item => !item.isRice);
    if (nonRiceDishes.length <= 1) continue;

    for (const dish of nonRiceDishes) {
      const carbs = Number(dish.carbs || 0);
      const fat = Number(dish.fat || 0);
      const protein = Number(dish.protein || 0);
      const fiber = Number(dish.fiber || 0);
      if (proteinBuffer < 6 && protein >= 10) continue;
      const score = (carbs * 1.8) + (fiberExcess > 0 ? fiber * 3.2 : 0) - (fat * 0.9) - (protein * 0.35);
      candidates.push({ mealKey, dish, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function pickBestBoosterRecipe(recipes, usedRecipeIds, deficits, remainingCalories, options = {}) {
  const {
    allowUsedRecipes = false,
    requireHighFat = false,
    requireHighProtein = false,
    maxCarbs = null,
    maxCarbDensity = null,
    maxFiber = null,
    avoidRecipeIds = null,
    avoidRecipeNames = null
  } = options;
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const recipe of recipes) {
    const recipeId = recipe._id?.toString?.();
    if (!recipeId) continue;
    if (avoidRecipeIds && avoidRecipeIds.has(recipeId)) continue;
    const recipeNameKey = canonicalizeDishName(recipe.name || '');
    if (avoidRecipeNames && recipeNameKey && avoidRecipeNames.has(recipeNameKey)) continue;
    if (!allowUsedRecipes && usedRecipeIds.has(recipeId)) continue;

    const protein = recipe.protein || 0;
    const fat = recipe.fat || 0;
    const carbs = recipe.carbs || 0;
    const fiber = recipe.fiber || 0;
    const calories = recipe.calories || 0;
    const currentFiberExcess = deficits.fiberExcess || 0;
    if (protein <= 0 && fat <= 0 && fiber <= 0) continue;
    if (requireHighFat && fat < 8) continue;
    if (requireHighProtein && protein < 10) continue;
    if (maxCarbs != null && carbs > maxCarbs) continue;
    if (maxFiber != null && fiber > maxFiber) continue;
    if (currentFiberExcess > 0 && fiber > 4) continue;

    const fatPer100Kcal = calories > 0 ? (fat / calories) * 100 : 0;
    const proteinPer100Kcal = calories > 0 ? (protein / calories) * 100 : 0;
    const carbPer100Kcal = calories > 0 ? (carbs / calories) * 100 : 0;
    if (maxCarbDensity != null && carbPer100Kcal > maxCarbDensity) continue;

    const needsFat = deficits.fatDeficit > 0;
    const needsProtein = deficits.proteinDeficit > 0;
    const needsCarbs = (deficits.carbDeficit || 0) > 0;
    const fiberExcess = currentFiberExcess;
    const carbExcess = deficits.carbExcess || 0;
    const carbDeficit = deficits.carbDeficit || 0;
    const proteinExcess = deficits.proteinExcess || 0;
    const fatExcess = deficits.fatExcess || 0;

    const proteinScore = deficits.proteinDeficit > 0 ? Math.min(1.5, protein / deficits.proteinDeficit) * 2.7 : 0;
    const fatScore = deficits.fatDeficit > 0 ? Math.min(2, fat / deficits.fatDeficit) * 5.2 : 0;
    const carbScore = needsCarbs ? Math.min(1.8, carbs / Math.max(carbDeficit, 1)) * 3.2 : 0;
    const fiberScore = deficits.fiberDeficit > 0 ? Math.min(1.5, fiber / deficits.fiberDeficit) * 2.5 : 0;
    const fatDensityScore = needsFat ? fatPer100Kcal * 1.1 : 0;
    const proteinDensityScore = needsProtein ? proteinPer100Kcal * 1.2 : 0;
    const fiberPenalty = fiberExcess > 0 ? Math.min(2.2, fiber / Math.max(fiberExcess, 1)) * 5 : 0;
    const carbPenalty = carbExcess > 0 ? Math.min(2, carbs / Math.max(carbExcess, 1)) * 2.4 : 0;
    const proteinPenalty = proteinExcess > 0 ? Math.min(2.2, protein / Math.max(proteinExcess, 1)) * 3.2 : 0;
    const fatPenalty = fatExcess > 0 ? Math.min(2, fat / Math.max(fatExcess, 1)) * 2.4 : 0;

    let score = proteinScore + fatScore + carbScore + fiberScore + fatDensityScore + proteinDensityScore - fiberPenalty - carbPenalty - proteinPenalty - fatPenalty;

    // In fat-deficit mode, allow slight calorie overshoot to catch up on fat.
    if (remainingCalories > 0 && calories > remainingCalories) {
      score -= needsFat ? 0.2 : 1.2;
    }
    if (carbExcess > 0 && carbs > 18) score -= 0.8;
    if (calories > 550) score -= 0.6;
    if (allowUsedRecipes) score -= 0.25;

    if (score > bestScore) {
      bestScore = score;
      best = recipe;
    }
  }

  return best;
}

function pickProteinFatHeavyRemovalCandidate(workingDay, maxProtein, maxFat, minCarbs) {
  const totals = getDayNutritionTotals(workingDay);
  const proteinExcess = Math.max(0, totals.protein - maxProtein);
  const fatExcess = Math.max(0, totals.fat - maxFat);
  const carbDeficit = Math.max(0, minCarbs - totals.carbs);
  const candidates = [];

  for (const mealKey of ['lunch', 'dinner']) {
    const combo = workingDay[mealKey];
    const nonRice = (combo?.items || []).filter(item => !item.isRice);
    if (nonRice.length <= 1) continue;

    for (const dish of nonRice) {
      const protein = Number(dish.protein || 0);
      const fat = Number(dish.fat || 0);
      const carbs = Number(dish.carbs || 0);
      const fiber = Number(dish.fiber || 0);
      const score =
        (proteinExcess > 0 ? protein * 2.1 : 0) +
        (fatExcess > 0 ? fat * 2.3 : 0) -
        (carbDeficit > 0 ? carbs * 1.1 : carbs * 0.3) +
        fiber * 0.6;
      candidates.push({ mealKey, dish, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function pickCarbRecoveryBooster(recipes, usedRecipeIds, avoidRecipeIds, avoidRecipeNames) {
  const normalizedAvoidIds = avoidRecipeIds || new Set();
  const normalizedAvoidNames = avoidRecipeNames || new Set();

  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const recipe of recipes) {
    const recipeId = recipe._id?.toString?.();
    if (!recipeId) continue;
    if (usedRecipeIds.has(recipeId)) continue;
    if (normalizedAvoidIds.has(recipeId)) continue;
    const nameKey = canonicalizeDishName(recipe.name || '');
    if (nameKey && normalizedAvoidNames.has(nameKey)) continue;

    const carbs = Number(recipe.carbs || 0);
    const protein = Number(recipe.protein || 0);
    const fat = Number(recipe.fat || 0);
    const fiber = Number(recipe.fiber || 0);
    const calories = Number(recipe.calories || 0);

    if (carbs < 12) continue;
    if (protein > 6.5) continue;
    if (fat > 4.5) continue;
    if (fiber > 4.8) continue;

    const score = (carbs * 2.2) + (calories * 0.18) - (protein * 0.75) - (fat * 0.95) - (fiber * 0.8);
    if (score > bestScore) {
      bestScore = score;
      best = recipe;
    }
  }

  return best;
}

function getBestRiceRecoveryRecipe(riceRecipes) {
  if (!riceRecipes || riceRecipes.length === 0) return null;
  return [...riceRecipes].sort((a, b) => {
    const carbDiff = Number(b.carbs || 0) - Number(a.carbs || 0);
    if (carbDiff !== 0) return carbDiff;
    return Number(b.calories || 0) - Number(a.calories || 0);
  })[0] || null;
}

function tryUpgradeRiceInMeal(workingDay, mealKey, riceRecipe) {
  const combo = workingDay[mealKey];
  if (!combo?.items || !riceRecipe) return false;

  const riceItems = combo.items.filter(item => item?.isRice);
  if (riceItems.length === 0) {
    addRecipeToComboMeal(combo, riceRecipe);
    return true;
  }

  const lowestRice = riceItems.reduce((min, item) => (
    Number(item?.carbs || 0) < Number(min?.carbs || 0) ? item : min
  ), riceItems[0]);

  if (Number(riceRecipe.carbs || 0) <= Number(lowestRice?.carbs || 0) + 0.1) return false;

  combo.items = combo.items.filter(item => item !== lowestRice);
  workingDay[mealKey] = recomputeComboMealTotals(combo);
  addRecipeToComboMeal(workingDay[mealKey], riceRecipe);
  return true;
}

function tryRecoverCarbsWithRice(workingDay, riceRecipes) {
  const riceRecipe = getBestRiceRecoveryRecipe(riceRecipes);
  if (!riceRecipe) return false;

  const lunchCarbs = Number(workingDay?.lunch?.totalCarbs || 0);
  const dinnerCarbs = Number(workingDay?.dinner?.totalCarbs || 0);
  const firstMeal = lunchCarbs <= dinnerCarbs ? 'lunch' : 'dinner';
  const secondMeal = firstMeal === 'lunch' ? 'dinner' : 'lunch';

  if (tryUpgradeRiceInMeal(workingDay, firstMeal, riceRecipe)) return true;
  if (tryUpgradeRiceInMeal(workingDay, secondMeal, riceRecipe)) return true;

  // If both meals already at same rice size, allow one additional rice side in lower-carb meal.
  const targetMeal = firstMeal === 'lunch' ? workingDay.lunch : workingDay.dinner;
  if (targetMeal?.items) {
    addRecipeToComboMeal(targetMeal, riceRecipe);
    return true;
  }

  return false;
}

function enforceMacroBalanceTargets(workingDay, dishRecipes, riceRecipes, blockedRecipeIds, thresholds, calorieTarget) {
  const {
    minCalories,
    minProtein,
    minFat,
    minCarbs,
    maxProtein,
    maxFat,
    maxFiber,
    maxCarbs,
    maxLunchDishes = 4,
    maxDinnerDishes = 5
  } = thresholds;

  for (let round = 0; round < 8; round++) {
    const totals = getDayNutritionTotals(workingDay);
    const proteinExcess = Math.max(0, totals.protein - maxProtein);
    const fatExcess = Math.max(0, totals.fat - maxFat);
    const carbDeficit = Math.max(0, minCarbs - totals.carbs);
    const caloriesTooLow = totals.calories < minCalories;

    if (proteinExcess <= 0 && fatExcess <= 0 && carbDeficit <= 0 && !caloriesTooLow) {
      break;
    }

    if (proteinExcess > 0 || fatExcess > 0) {
      const removal = pickProteinFatHeavyRemovalCandidate(workingDay, maxProtein, maxFat, minCarbs);
      if (removal) {
        const combo = workingDay[removal.mealKey];
        combo.items = combo.items.filter(item => item !== removal.dish);
        workingDay[removal.mealKey] = recomputeComboMealTotals(combo);
      }
    }

    const afterTotals = getDayNutritionTotals(workingDay);
    const needsCarbRecovery = afterTotals.carbs < minCarbs;
    const needsMacroRecovery = afterTotals.protein < minProtein || afterTotals.fat < minFat || afterTotals.calories < minCalories;

    if (!needsCarbRecovery && !needsMacroRecovery) continue;

    const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
    const usedRecipeIds = new Set([...dayUsedRecipeIds]);
    for (const blockedId of blockedRecipeIds) usedRecipeIds.add(String(blockedId));

    let booster = null;
    if (needsCarbRecovery) {
      if (tryRecoverCarbsWithRice(workingDay, riceRecipes)) {
        continue;
      }
      booster = pickCarbRecoveryBooster(dishRecipes, usedRecipeIds, dayUsedRecipeIds, dayUsedRecipeNames);
    }

    if (!booster && needsMacroRecovery) {
      booster = pickBestBoosterRecipe(
        dishRecipes,
        usedRecipeIds,
        {
          proteinDeficit: Math.max(0, minProtein - afterTotals.protein),
          fatDeficit: Math.max(0, minFat - afterTotals.fat),
          fiberDeficit: 0,
          fiberExcess: Math.max(0, afterTotals.fiber - maxFiber),
          carbExcess: Math.max(0, afterTotals.carbs - maxCarbs),
          carbDeficit: Math.max(0, minCarbs - afterTotals.carbs),
          proteinExcess: Math.max(0, afterTotals.protein - maxProtein),
          fatExcess: Math.max(0, afterTotals.fat - maxFat)
        },
        Math.max(0, (calorieTarget + 240) - afterTotals.calories),
        {
          allowUsedRecipes: false,
          avoidRecipeIds: dayUsedRecipeIds,
          avoidRecipeNames: dayUsedRecipeNames,
          maxCarbDensity: 11
        }
      );
    }

    if (!booster) continue;

    const lunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;
    if (lunchDishCount >= maxLunchDishes && dinnerDishCount >= maxDinnerDishes) continue;

    let targetMeal = dinnerDishCount <= lunchDishCount ? workingDay.dinner : workingDay.lunch;
    if (targetMeal === workingDay.lunch && lunchDishCount >= maxLunchDishes) targetMeal = workingDay.dinner;
    if (targetMeal === workingDay.dinner && dinnerDishCount >= maxDinnerDishes) targetMeal = workingDay.lunch;

    addRecipeToComboMeal(targetMeal, booster);
  }
}

function pickHighestMacroDishForCapTrim(workingDay, macro = 'protein') {
  const candidates = [];

  for (const mealKey of ['lunch', 'dinner']) {
    const combo = workingDay[mealKey];
    const nonRice = (combo?.items || []).filter(item => !item.isRice);
    if (nonRice.length <= 1) continue;

    for (const dish of nonRice) {
      const protein = Number(dish.protein || 0);
      const fat = Number(dish.fat || 0);
      const carbs = Number(dish.carbs || 0);
      const value = macro === 'fat' ? fat : protein;
      const score = (value * 2.2) + (macro === 'protein' ? fat * 0.4 : protein * 0.4) - (carbs * 0.45);
      candidates.push({ mealKey, dish, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function enforceUpperMacroCaps(workingDay, dishRecipes, riceRecipes, blockedRecipeIds, thresholds, calorieTarget) {
  const {
    minCarbs,
    maxProtein,
    maxFat,
    maxLunchDishes = 4,
    maxDinnerDishes = 5
  } = thresholds;

  for (let round = 0; round < 6; round++) {
    const totals = getDayNutritionTotals(workingDay);
    const proteinExcess = Math.max(0, totals.protein - maxProtein);
    const fatExcess = Math.max(0, totals.fat - maxFat);
    if (proteinExcess <= 0 && fatExcess <= 0) break;

    const macroToTrim = proteinExcess >= fatExcess ? 'protein' : 'fat';
    const removal = pickHighestMacroDishForCapTrim(workingDay, macroToTrim);
    if (!removal) break;

    const combo = workingDay[removal.mealKey];
    combo.items = combo.items.filter(item => item !== removal.dish);
    workingDay[removal.mealKey] = recomputeComboMealTotals(combo);

    const afterTotals = getDayNutritionTotals(workingDay);
    const needsCarbRecovery = afterTotals.carbs < minCarbs;
    if (!needsCarbRecovery) continue;

    const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
    const usedRecipeIds = new Set([...dayUsedRecipeIds]);
    for (const blockedId of blockedRecipeIds) usedRecipeIds.add(String(blockedId));

    if (tryRecoverCarbsWithRice(workingDay, riceRecipes)) {
      continue;
    }

    const booster = pickCarbRecoveryBooster(dishRecipes, usedRecipeIds, dayUsedRecipeIds, dayUsedRecipeNames);
    if (!booster) continue;

    const lunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;
    if (lunchDishCount >= maxLunchDishes && dinnerDishCount >= maxDinnerDishes) continue;

    let targetMeal = dinnerDishCount <= lunchDishCount ? workingDay.dinner : workingDay.lunch;
    if (targetMeal === workingDay.lunch && lunchDishCount >= maxLunchDishes) targetMeal = workingDay.dinner;
    if (targetMeal === workingDay.dinner && dinnerDishCount >= maxDinnerDishes) targetMeal = workingDay.lunch;

    if (afterTotals.calories + Number(booster.calories || 0) <= calorieTarget + 180) {
      addRecipeToComboMeal(targetMeal, booster);
    }
  }
}

function enforceCarbTargetBySwappingProtein(workingDay, riceRecipes, thresholds) {
  const {
    minCarbs,
    maxProtein,
    maxFat,
    maxLunchDishes = 4,
    maxDinnerDishes = 5
  } = thresholds;

  const bestRice = getBestRiceRecoveryRecipe(riceRecipes);
  if (!bestRice) return;

  for (let round = 0; round < 5; round++) {
    const totals = getDayNutritionTotals(workingDay);
    const carbDeficit = Math.max(0, minCarbs - totals.carbs);
    const proteinExcess = Math.max(0, totals.protein - maxProtein);
    const fatExcess = Math.max(0, totals.fat - maxFat);

    if (carbDeficit <= 0 && proteinExcess <= 0 && fatExcess <= 0) break;

    const removal = pickHighestMacroDishForCapTrim(workingDay, proteinExcess > 0 ? 'protein' : 'fat');
    if (!removal) break;

    const combo = workingDay[removal.mealKey];
    combo.items = combo.items.filter(item => item !== removal.dish);
    workingDay[removal.mealKey] = recomputeComboMealTotals(combo);

    const lunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;
    let targetMeal = removal.mealKey === 'lunch' ? workingDay.lunch : workingDay.dinner;
    if (targetMeal === workingDay.lunch && lunchDishCount > maxLunchDishes) targetMeal = workingDay.dinner;
    if (targetMeal === workingDay.dinner && dinnerDishCount > maxDinnerDishes) targetMeal = workingDay.lunch;

    addRecipeToComboMeal(targetMeal, bestRice);
  }
}

function pickFloorRecoveryBooster(recipes, usedRecipeIds, avoidRecipeIds, avoidRecipeNames, deficits, calorieTarget) {
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const recipe of recipes) {
    const recipeId = recipe._id?.toString?.();
    if (!recipeId) continue;
    if (usedRecipeIds.has(recipeId)) continue;
    if (avoidRecipeIds && avoidRecipeIds.has(recipeId)) continue;
    const nameKey = canonicalizeDishName(recipe.name || '');
    if (avoidRecipeNames && nameKey && avoidRecipeNames.has(nameKey)) continue;

    const calories = Number(recipe.calories || 0);
    const protein = Number(recipe.protein || 0);
    const fat = Number(recipe.fat || 0);
    const carbs = Number(recipe.carbs || 0);
    const fiber = Number(recipe.fiber || 0);

    if (calories <= 0) continue;
    if (deficits.proteinExcess > 0 && protein > 9) continue;
    if (deficits.proteinExcess <= 0 && protein > 18) continue;
    if (deficits.fatDeficit > 4 && fat < 6) continue;

    const score =
      (deficits.calorieDeficit > 0 ? (calories / Math.max(calorieTarget, 1)) * 180 : 0) +
      (deficits.carbDeficit > 0 ? Math.min(2.2, carbs / Math.max(deficits.carbDeficit, 1)) * 4.2 : carbs * 0.25) +
      (deficits.fatDeficit > 0 ? Math.min(2.4, fat / Math.max(deficits.fatDeficit, 1)) * 5.4 : fat * 0.3) +
      (deficits.fiberDeficit > 0 ? Math.min(2, fiber / Math.max(deficits.fiberDeficit, 1)) * 2.4 : fiber * 0.2) -
      (deficits.proteinExcess > 0 ? protein * 1.8 : protein * 0.6) -
      (deficits.fatExcess > 0 ? fat * 1.1 : 0);

    if (score > bestScore) {
      bestScore = score;
      best = recipe;
    }
  }

  return best;
}

function enforceFinalMacroFloors(workingDay, dishRecipes, riceRecipes, blockedRecipeIds, thresholds, calorieTarget) {
  const {
    minCalories,
    minCarbs,
    minFat,
    minFiber,
    maxProtein,
    maxFat,
    maxFiber,
    maxLunchDishes = 4,
    maxDinnerDishes = 5
  } = thresholds;

  for (let round = 0; round < 8; round++) {
    const totals = getDayNutritionTotals(workingDay);
    const deficits = {
      calorieDeficit: Math.max(0, minCalories - totals.calories),
      carbDeficit: Math.max(0, minCarbs - totals.carbs),
      fatDeficit: Math.max(0, minFat - totals.fat),
      fiberDeficit: Math.max(0, minFiber - totals.fiber),
      proteinExcess: Math.max(0, totals.protein - maxProtein),
      fatExcess: Math.max(0, totals.fat - maxFat)
    };

    if (
      deficits.calorieDeficit <= 0 &&
      deficits.carbDeficit <= 0 &&
      deficits.fatDeficit <= 0 &&
      deficits.fiberDeficit <= 0
    ) {
      break;
    }

    // Carb shortage should be fixed via rice first, but still allow fat/calorie recovery after that.
    if (deficits.carbDeficit > 0 && tryRecoverCarbsWithRice(workingDay, riceRecipes)) {
      const afterRice = getDayNutritionTotals(workingDay);
      const afterRiceDone =
        afterRice.calories >= minCalories &&
        afterRice.carbs >= minCarbs &&
        afterRice.fat >= minFat &&
        afterRice.fiber >= minFiber;

      if (afterRiceDone) {
        continue;
      }
    }

    const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
    const usedRecipeIds = new Set([...dayUsedRecipeIds]);
    for (const blockedId of blockedRecipeIds) usedRecipeIds.add(String(blockedId));

    let booster = pickFloorRecoveryBooster(
      dishRecipes,
      usedRecipeIds,
      dayUsedRecipeIds,
      dayUsedRecipeNames,
      deficits,
      calorieTarget
    );

    if (!booster && (deficits.fatDeficit > 2 || deficits.calorieDeficit > 120)) {
      booster = pickFloorRecoveryBooster(
        dishRecipes,
        new Set(),
        null,
        null,
        deficits,
        calorieTarget
      );
    }

    if (!booster) break;

    const lunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;

    if (lunchDishCount >= maxLunchDishes && dinnerDishCount >= maxDinnerDishes) {
      const removal = pickLowQualityDishForReplacement(workingDay);
      if (!removal) break;
      const combo = workingDay[removal.mealKey];
      combo.items = combo.items.filter(item => item !== removal.dish);
      workingDay[removal.mealKey] = recomputeComboMealTotals(combo);
    }

    const updatedLunchCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const updatedDinnerCount = workingDay.dinner.items.filter(i => !i.isRice).length;

    let targetMeal = updatedDinnerCount <= updatedLunchCount ? workingDay.dinner : workingDay.lunch;
    if (targetMeal === workingDay.lunch && updatedLunchCount >= maxLunchDishes) targetMeal = workingDay.dinner;
    if (targetMeal === workingDay.dinner && updatedDinnerCount >= maxDinnerDishes) targetMeal = workingDay.lunch;

    addRecipeToComboMeal(targetMeal, booster);

    // Keep fiber from drifting too high while recovering other floors.
    const afterAdd = getDayNutritionTotals(workingDay);
    if (afterAdd.fiber > maxFiber * 1.12) {
      const highFiberRemoval = pickHighFiberRemovalCandidate(workingDay, 0, 0);
      if (highFiberRemoval) {
        const combo = workingDay[highFiberRemoval.mealKey];
        combo.items = combo.items.filter(item => item !== highFiberRemoval.dish);
        workingDay[highFiberRemoval.mealKey] = recomputeComboMealTotals(combo);
      }
    }
  }
}

function pickFatCalorieBooster(recipes, usedRecipeIds, avoidRecipeIds, avoidRecipeNames, totals, thresholds, calorieTarget) {
  const { minFat, minCarbs, maxProtein, maxFiber } = thresholds;
  const fatDeficit = Math.max(0, minFat - totals.fat);
  const carbDeficit = Math.max(0, minCarbs - totals.carbs);
  const proteinNearCap = totals.protein >= maxProtein * 0.98;
  const fiberNearCap = totals.fiber >= maxFiber * 1.02;

  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const recipe of recipes) {
    const recipeId = recipe._id?.toString?.();
    if (!recipeId) continue;
    if (usedRecipeIds.has(recipeId)) continue;
    if (avoidRecipeIds && avoidRecipeIds.has(recipeId)) continue;
    const nameKey = canonicalizeDishName(recipe.name || '');
    if (avoidRecipeNames && nameKey && avoidRecipeNames.has(nameKey)) continue;

    const calories = Number(recipe.calories || 0);
    const protein = Number(recipe.protein || 0);
    const fat = Number(recipe.fat || 0);
    const carbs = Number(recipe.carbs || 0);
    const fiber = Number(recipe.fiber || 0);

    if (calories <= 0) continue;
    if (fatDeficit > 2 && fat < 7) continue;
    if (proteinNearCap && protein > 12) continue;
    if (!proteinNearCap && protein > 16) continue;
    if (fiberNearCap && fiber > 5) continue;

    const fatPer100Kcal = calories > 0 ? (fat / calories) * 100 : 0;

    const score =
      (fat * 4.4) +
      (fatDeficit > 0 ? Math.min(2.6, fat / Math.max(fatDeficit, 1)) * 6.1 : 0) +
      (calories / Math.max(200, calorieTarget)) * 130 +
      (carbDeficit > 0 ? Math.min(2, carbs / Math.max(carbDeficit, 1)) * 3.1 : carbs * 0.2) +
      (fatPer100Kcal * 1.6) -
      (proteinNearCap ? protein * 1.25 : protein * 0.42) -
      (fiberNearCap ? fiber * 1.35 : fiber * 0.35);

    if (score > bestScore) {
      bestScore = score;
      best = recipe;
    }
  }

  return best;
}

function enforceFatCalorieRecovery(workingDay, dishRecipes, blockedRecipeIds, thresholds, calorieTarget) {
  const {
    minCalories,
    minFat,
    minCarbs,
    minFiber,
    maxProtein,
    maxFat,
    maxFiber,
    maxLunchDishes = 4,
    maxDinnerDishes = 5
  } = thresholds;

  for (let round = 0; round < 8; round++) {
    const totals = getDayNutritionTotals(workingDay);
    const calorieDeficit = Math.max(0, minCalories - totals.calories);
    const fatDeficit = Math.max(0, minFat - totals.fat);

    if (calorieDeficit <= 0 && fatDeficit <= 0) break;

    const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
    const usedRecipeIds = new Set([...dayUsedRecipeIds]);
    for (const blockedId of blockedRecipeIds) usedRecipeIds.add(String(blockedId));

    let booster = pickFatCalorieBooster(
      dishRecipes,
      usedRecipeIds,
      dayUsedRecipeIds,
      dayUsedRecipeNames,
      totals,
      { minFat, minCarbs, maxProtein, maxFiber },
      calorieTarget
    );

    if (!booster && (fatDeficit > 2 || calorieDeficit > 120)) {
      booster = pickFatCalorieBooster(
        dishRecipes,
        new Set(),
        null,
        null,
        totals,
        { minFat, minCarbs, maxProtein, maxFiber },
        calorieTarget
      );
    }

    if (!booster) break;

    const lunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;

    if (lunchDishCount >= maxLunchDishes && dinnerDishCount >= maxDinnerDishes) {
      const removal = pickLowQualityDishForReplacement(workingDay);
      if (!removal) break;
      const combo = workingDay[removal.mealKey];
      combo.items = combo.items.filter(item => item !== removal.dish);
      workingDay[removal.mealKey] = recomputeComboMealTotals(combo);
    }

    const updatedLunchCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const updatedDinnerCount = workingDay.dinner.items.filter(i => !i.isRice).length;

    let targetMeal = updatedDinnerCount <= updatedLunchCount ? workingDay.dinner : workingDay.lunch;
    if (targetMeal === workingDay.lunch && updatedLunchCount >= maxLunchDishes) targetMeal = workingDay.dinner;
    if (targetMeal === workingDay.dinner && updatedDinnerCount >= maxDinnerDishes) targetMeal = workingDay.lunch;

    addRecipeToComboMeal(targetMeal, booster);

    const after = getDayNutritionTotals(workingDay);
    if (after.protein > maxProtein * 1.15 || after.fat > maxFat * 1.18 || after.fiber > maxFiber * 1.2) {
      const removal = pickProteinFatHeavyRemovalCandidate(workingDay, maxProtein, maxFat, minCarbs);
      if (removal) {
        const combo = workingDay[removal.mealKey];
        combo.items = combo.items.filter(item => item !== removal.dish);
        workingDay[removal.mealKey] = recomputeComboMealTotals(combo);
      }
    }

    const now = getDayNutritionTotals(workingDay);
    if (now.fiber < minFiber && now.fat >= minFat && now.calories >= minCalories) {
      const gentleFiberBooster = pickFloorRecoveryBooster(
        dishRecipes,
        new Set(),
        null,
        null,
        {
          calorieDeficit: 0,
          carbDeficit: Math.max(0, minCarbs - now.carbs),
          fatDeficit: 0,
          fiberDeficit: Math.max(0, minFiber - now.fiber),
          proteinExcess: Math.max(0, now.protein - maxProtein),
          fatExcess: Math.max(0, now.fat - maxFat)
        },
        calorieTarget
      );
      if (gentleFiberBooster) {
        addRecipeToComboMeal(updatedDinnerCount <= updatedLunchCount ? workingDay.dinner : workingDay.lunch, gentleFiberBooster);
      }
    }
  }
}

function pickHighProteinLowFatRemovalCandidate(workingDay) {
  const candidates = [];

  for (const mealKey of ['lunch', 'dinner']) {
    const combo = workingDay[mealKey];
    const nonRice = (combo?.items || []).filter(item => !item.isRice);
    if (nonRice.length <= 1) continue;

    for (const dish of nonRice) {
      const protein = Number(dish.protein || 0);
      const fat = Number(dish.fat || 0);
      const carbs = Number(dish.carbs || 0);
      const calories = Number(dish.calories || 0);
      const fatPer100Kcal = calories > 0 ? (fat / calories) * 100 : 0;

      const score = (protein * 2.2) - (fat * 1.4) - (fatPer100Kcal * 1.8) - (carbs * 0.15);
      candidates.push({ mealKey, dish, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function enforceFatTargetBySwappingProtein(workingDay, dishRecipes, thresholds, calorieTarget) {
  const {
    minFat,
    minCarbs,
    maxProtein,
    maxFiber,
    maxLunchDishes = 4,
    maxDinnerDishes = 5
  } = thresholds;

  for (let round = 0; round < 6; round++) {
    const totals = getDayNutritionTotals(workingDay);
    const fatDeficit = Math.max(0, minFat - totals.fat);
    if (fatDeficit <= 0) break;

    const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
    const usedRecipeIds = new Set([...dayUsedRecipeIds]);

    const booster = pickFatCalorieBooster(
      dishRecipes,
      usedRecipeIds,
      dayUsedRecipeIds,
      dayUsedRecipeNames,
      totals,
      { minFat, minCarbs, maxProtein, maxFiber },
      calorieTarget
    );

    if (!booster) break;

    const lunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;

    if (lunchDishCount >= maxLunchDishes && dinnerDishCount >= maxDinnerDishes) {
      const removal = pickHighProteinLowFatRemovalCandidate(workingDay);
      if (!removal) break;
      const combo = workingDay[removal.mealKey];
      combo.items = combo.items.filter(item => item !== removal.dish);
      workingDay[removal.mealKey] = recomputeComboMealTotals(combo);
    }

    const updatedLunchCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const updatedDinnerCount = workingDay.dinner.items.filter(i => !i.isRice).length;
    let targetMeal = updatedDinnerCount <= updatedLunchCount ? workingDay.dinner : workingDay.lunch;
    if (targetMeal === workingDay.lunch && updatedLunchCount >= maxLunchDishes) targetMeal = workingDay.dinner;
    if (targetMeal === workingDay.dinner && updatedDinnerCount >= maxDinnerDishes) targetMeal = workingDay.lunch;

    addRecipeToComboMeal(targetMeal, booster);
  }
}

function enforceHardMacroClamp(workingDay, dishRecipes, riceRecipes, blockedRecipeIds, thresholds, calorieTarget) {
  const {
    minCalories,
    minCarbs,
    minFat,
    minFiber,
    maxProtein,
    maxFat,
    maxFiber,
    maxLunchDishes = 4,
    maxDinnerDishes = 5
  } = thresholds;

  for (let round = 0; round < 12; round++) {
    const totals = getDayNutritionTotals(workingDay);
    const calorieDeficit = Math.max(0, minCalories - totals.calories);
    const carbDeficit = Math.max(0, minCarbs - totals.carbs);
    const fatDeficit = Math.max(0, minFat - totals.fat);
    const fiberDeficit = Math.max(0, minFiber - totals.fiber);
    const proteinExcess = Math.max(0, totals.protein - maxProtein);
    const fatExcess = Math.max(0, totals.fat - maxFat);
    const fiberExcess = Math.max(0, totals.fiber - (maxFiber * 1.15));

    if (
      calorieDeficit <= 0 &&
      carbDeficit <= 0 &&
      fatDeficit <= 0 &&
      fiberDeficit <= 0 &&
      proteinExcess <= 0 &&
      fatExcess <= 0 &&
      fiberExcess <= 0
    ) {
      break;
    }

    let acted = false;

    if (fiberExcess > 0) {
      const removal = pickHighFiberRemovalCandidate(workingDay, minCalories > 0 ? minCalories * 0 : 0, minFat);
      if (removal) {
        const combo = workingDay[removal.mealKey];
        combo.items = combo.items.filter(item => item !== removal.dish);
        workingDay[removal.mealKey] = recomputeComboMealTotals(combo);
        acted = true;
      }
    }

    if (!acted && (proteinExcess > 0 || fatExcess > 0)) {
      const macroToTrim = proteinExcess >= fatExcess ? 'protein' : 'fat';
      const removal = pickHighestMacroDishForCapTrim(workingDay, macroToTrim);
      if (removal) {
        const combo = workingDay[removal.mealKey];
        combo.items = combo.items.filter(item => item !== removal.dish);
        workingDay[removal.mealKey] = recomputeComboMealTotals(combo);
        acted = true;
      }
    }

    if (!acted && carbDeficit > 0 && tryRecoverCarbsWithRice(workingDay, riceRecipes)) {
      acted = true;
    }

    if (!acted && (calorieDeficit > 0 || fatDeficit > 0 || fiberDeficit > 0 || carbDeficit > 0)) {
      const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
      const usedRecipeIds = new Set([...dayUsedRecipeIds]);
      for (const blockedId of blockedRecipeIds) usedRecipeIds.add(String(blockedId));

      let booster = null;

      if (fatDeficit > 1 || calorieDeficit > 100) {
        booster = pickFatCalorieBooster(
          dishRecipes,
          usedRecipeIds,
          dayUsedRecipeIds,
          dayUsedRecipeNames,
          totals,
          { minFat, minCarbs, maxProtein, maxFiber },
          calorieTarget
        );
      }

      if (!booster) {
        booster = pickFloorRecoveryBooster(
          dishRecipes,
          usedRecipeIds,
          dayUsedRecipeIds,
          dayUsedRecipeNames,
          {
            calorieDeficit,
            carbDeficit,
            fatDeficit,
            fiberDeficit,
            proteinExcess,
            fatExcess
          },
          calorieTarget
        );
      }

      if (!booster && (fatDeficit > 2 || calorieDeficit > 120 || carbDeficit > 20)) {
        booster =
          pickFatCalorieBooster(
            dishRecipes,
            new Set(),
            null,
            null,
            totals,
            { minFat, minCarbs, maxProtein, maxFiber },
            calorieTarget
          ) ||
          pickFloorRecoveryBooster(
            dishRecipes,
            new Set(),
            null,
            null,
            {
              calorieDeficit,
              carbDeficit,
              fatDeficit,
              fiberDeficit,
              proteinExcess,
              fatExcess
            },
            calorieTarget
          );
      }

      if (booster) {
        const lunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
        const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;

        if (lunchDishCount >= maxLunchDishes && dinnerDishCount >= maxDinnerDishes) {
          const removal = pickLowQualityDishForReplacement(workingDay);
          if (removal) {
            const combo = workingDay[removal.mealKey];
            combo.items = combo.items.filter(item => item !== removal.dish);
            workingDay[removal.mealKey] = recomputeComboMealTotals(combo);
          }
        }

        const updatedLunchCount = workingDay.lunch.items.filter(i => !i.isRice).length;
        const updatedDinnerCount = workingDay.dinner.items.filter(i => !i.isRice).length;
        let targetMeal = updatedDinnerCount <= updatedLunchCount ? workingDay.dinner : workingDay.lunch;
        if (targetMeal === workingDay.lunch && updatedLunchCount >= maxLunchDishes) targetMeal = workingDay.dinner;
        if (targetMeal === workingDay.dinner && updatedDinnerCount >= maxDinnerDishes) targetMeal = workingDay.lunch;

        addRecipeToComboMeal(targetMeal, booster);
        acted = true;
      }
    }

    dedupeNonRiceDishesInDay(workingDay);
    enforceMealDishCaps(workingDay, maxLunchDishes, maxDinnerDishes);

    if (!acted) break;
  }
}

function enforceMinimumMealStructure(workingDay, dishRecipes, blockedRecipeIds, thresholds, calorieTarget) {
  const {
    minCalories,
    minCarbs,
    minFat,
    minFiber,
    maxProtein,
    maxFat,
    maxLunchDishes = 4,
    maxDinnerDishes = 5,
    minLunchDishes = 4,
    minDinnerDishes = 4
  } = thresholds;

  for (let round = 0; round < 6; round++) {
    const lunchCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const dinnerCount = workingDay.dinner.items.filter(i => !i.isRice).length;
    if (lunchCount >= minLunchDishes && dinnerCount >= minDinnerDishes) break;

    const totals = getDayNutritionTotals(workingDay);
    const deficits = {
      calorieDeficit: Math.max(0, minCalories - totals.calories),
      carbDeficit: Math.max(0, minCarbs - totals.carbs),
      fatDeficit: Math.max(0, minFat - totals.fat),
      fiberDeficit: Math.max(0, minFiber - totals.fiber),
      proteinExcess: Math.max(0, totals.protein - maxProtein),
      fatExcess: Math.max(0, totals.fat - maxFat)
    };

    const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
    const usedRecipeIds = new Set([...dayUsedRecipeIds]);
    for (const blockedId of blockedRecipeIds) usedRecipeIds.add(String(blockedId));

    let booster = pickFloorRecoveryBooster(
      dishRecipes,
      usedRecipeIds,
      dayUsedRecipeIds,
      dayUsedRecipeNames,
      deficits,
      calorieTarget
    );

    if (!booster) {
      booster = pickFloorRecoveryBooster(
        dishRecipes,
        new Set(),
        null,
        null,
        deficits,
        calorieTarget
      );
    }

    if (!booster) break;

    if (lunchCount < minLunchDishes && lunchCount < maxLunchDishes) {
      addRecipeToComboMeal(workingDay.lunch, booster);
      continue;
    }

    if (dinnerCount < minDinnerDishes && dinnerCount < maxDinnerDishes) {
      addRecipeToComboMeal(workingDay.dinner, booster);
      continue;
    }

    break;
  }
}

function addRecipeToComboMeal(comboMeal, recipe) {
  const item = recipeToMealObject(recipe);
  comboMeal.items.push(item);

  comboMeal.totalCalories = Math.round((comboMeal.totalCalories || 0) + (item.calories || 0));
  comboMeal.totalProtein = Math.round(((comboMeal.totalProtein || 0) + (item.protein || 0)) * 10) / 10;
  comboMeal.totalCarbs = Math.round(((comboMeal.totalCarbs || 0) + (item.carbs || 0)) * 10) / 10;
  comboMeal.totalFat = Math.round(((comboMeal.totalFat || 0) + (item.fat || 0)) * 10) / 10;
  comboMeal.totalFiber = Math.round(((comboMeal.totalFiber || 0) + (item.fiber || 0)) * 10) / 10;
  comboMeal.totalCholesterol = Math.round((comboMeal.totalCholesterol || 0) + (item.cholesterol || 0));
  comboMeal.totalOmega3 = Math.round(((comboMeal.totalOmega3 || 0) + (item.omega3 || 0)) * 10) / 10;
  comboMeal.totalWater = Math.round((comboMeal.totalWater || 0) + (item.water || 0));
  comboMeal.totalSaturatedFat = Math.round(((comboMeal.totalSaturatedFat || 0) + (item.saturatedFat || 0)) * 10) / 10;
  comboMeal.totalSodium = Math.round((comboMeal.totalSodium || 0) + (item.sodium || 0));
}

function getRiceAmountInGrams(recipe) {
  const fromAmount = Number(String(recipe?.riceAmount || '').replace(/[^0-9.]/g, ''));
  if (!Number.isNaN(fromAmount) && fromAmount > 0) return fromAmount;

  const fromName = Number(String(recipe?.name || '').match(/(\d+(?:\.\d+)?)\s*g/i)?.[1] || 0);
  if (!Number.isNaN(fromName) && fromName > 0) return fromName;

  return 0;
}

function constrainRiceOptionsForSinglePerson(recipes, calorieTarget = 2000) {
  const nonRice = recipes.filter(r => !(r.isRice || r.category === 'staple'));
  const rice = recipes.filter(r => r.isRice || r.category === 'staple');

  if (rice.length === 0) return recipes;

  let maxRiceGrams = 100;
  if (calorieTarget >= 2800) maxRiceGrams = 200;
  else if (calorieTarget >= 2400) maxRiceGrams = 150;

  const smallRice = rice
    .filter(r => {
      const grams = getRiceAmountInGrams(r);
      if (grams > 0) return grams <= maxRiceGrams;
      return Number(r.calories || 0) <= (maxRiceGrams <= 100 ? 260 : 390);
    })
    .sort((a, b) => Number(a.calories || 0) - Number(b.calories || 0));

  const ricePool = (smallRice.length > 0 ? smallRice : rice);

  let selectedRice;
  if (calorieTarget >= 2800) {
    // High-calorie users need larger rice portions to avoid chronic calorie deficits.
    selectedRice = [...ricePool]
      .sort((a, b) => Number(b.calories || 0) - Number(a.calories || 0))
      .slice(0, 3);
  } else if (calorieTarget >= 2400) {
    // Keep all moderate rice portions available; high-carb users often need
    // a 75g/100g/150g mix rather than only the smallest or largest options.
    selectedRice = [...ricePool]
      .sort((a, b) => Number(b.calories || 0) - Number(a.calories || 0));
  } else {
    selectedRice = [...ricePool]
      .sort((a, b) => Number(a.calories || 0) - Number(b.calories || 0))
      .slice(0, 3);
  }

  // Ensure uniqueness in case pools overlap.
  const riceSeen = new Set();
  selectedRice = selectedRice.filter(r => {
    const id = r?._id?.toString?.() || `${r.name}-${r.calories}`;
    if (riceSeen.has(id)) return false;
    riceSeen.add(id);
    return true;
  });

  return [...nonRice, ...selectedRice];
}

function isDishBalanceValidAfterRemoval(removeMeal, lunchDishCount, dinnerDishCount) {
  const nextLunch = removeMeal === 'lunch' ? lunchDishCount - 1 : lunchDishCount;
  const nextDinner = removeMeal === 'dinner' ? dinnerDishCount - 1 : dinnerDishCount;

  // Policy: dinner should be >= lunch and difference should not exceed 1.
  if (nextDinner < nextLunch) return false;
  if (Math.abs(nextDinner - nextLunch) > 1) return false;
  return true;
}

function enforceDinnerDishPreference(workingDay, dishRecipes, blockedRecipeIds, thresholds, calorieTarget) {
  const { minProtein, minFat, maxFiber, maxCarbs } = thresholds;

  for (let round = 0; round < 6; round++) {
    const lunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;

    // Desired policy reached.
    if (dinnerDishCount >= lunchDishCount && (dinnerDishCount - lunchDishCount) <= 1) {
      break;
    }

    // If lunch has too many dishes, move balance toward dinner.
    if (lunchDishCount > dinnerDishCount) {
      const totals = getDayNutritionTotals(workingDay);
      const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
      const usedRecipeIds = new Set([...dayUsedRecipeIds]);
      for (const blockedId of blockedRecipeIds) usedRecipeIds.add(String(blockedId));

      const dinnerBooster = pickBestBoosterRecipe(
        dishRecipes,
        usedRecipeIds,
        {
          proteinDeficit: Math.max(0, minProtein - totals.protein),
          fatDeficit: Math.max(0, minFat - totals.fat),
          fiberDeficit: 0,
          fiberExcess: Math.max(0, totals.fiber - maxFiber),
          carbExcess: Math.max(0, totals.carbs - maxCarbs)
        },
        Math.max(0, (calorieTarget + 180) - totals.calories),
        { allowUsedRecipes: true, maxCarbDensity: 8, avoidRecipeIds: dayUsedRecipeIds, avoidRecipeNames: dayUsedRecipeNames }
      );

      if (dinnerBooster) {
        addRecipeToComboMeal(workingDay.dinner, dinnerBooster);
      } else {
        // Fallback: trim a high-carb/low-protein dish from lunch when dinner cannot be boosted.
        const removableLunch = pickHighCarbRemovalCandidate(
          { ...workingDay, lunch: workingDay.lunch, dinner: { ...workingDay.dinner, items: [] } },
          totals,
          minProtein,
          Math.max(0, totals.fiber - maxFiber)
        );
        if (removableLunch && removableLunch.mealKey === 'lunch' && lunchDishCount > 1) {
          workingDay.lunch.items = workingDay.lunch.items.filter(item => item !== removableLunch.dish);
          workingDay.lunch = recomputeComboMealTotals(workingDay.lunch);
        } else {
          break;
        }
      }
      continue;
    }

    // If dinner exceeds by >1, trim one dinner dish while keeping at least one non-rice dish.
    if (dinnerDishCount > lunchDishCount + 1) {
      const totals = getDayNutritionTotals(workingDay);
      const removableDinner = pickHighCarbRemovalCandidate(
        { ...workingDay, lunch: { ...workingDay.lunch, items: [] }, dinner: workingDay.dinner },
        totals,
        minProtein,
        Math.max(0, totals.fiber - maxFiber)
      );
      if (removableDinner && removableDinner.mealKey === 'dinner' && dinnerDishCount > 1) {
        workingDay.dinner.items = workingDay.dinner.items.filter(item => item !== removableDinner.dish);
        workingDay.dinner = recomputeComboMealTotals(workingDay.dinner);
      } else {
        break;
      }
    }
  }
}

function enforceMacroFloor(workingDay, dishRecipes, blockedRecipeIds, thresholds, calorieTarget) {
  const {
    minCalories,
    minProtein,
    minFat,
    maxFiber,
    maxCarbs,
    maxLunchDishes = 4,
    maxDinnerDishes = 5
  } = thresholds;

  for (let round = 0; round < 8; round++) {
    const totals = getDayNutritionTotals(workingDay);
    const calorieDeficit = Math.max(0, minCalories - totals.calories);
    const proteinDeficit = Math.max(0, minProtein - totals.protein);
    const fatDeficit = Math.max(0, minFat - totals.fat);
    if (calorieDeficit <= 0 && proteinDeficit <= 0 && fatDeficit <= 0) break;

    const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
    const usedRecipeIds = new Set([...dayUsedRecipeIds]);
    for (const blockedId of blockedRecipeIds) {
      usedRecipeIds.add(String(blockedId));
    }

    const hardCarbCap = calorieDeficit > 220 ? null : 18;
    const hardDensityCap = calorieDeficit > 220 ? null : 10;

    let booster = pickBestBoosterRecipe(
      dishRecipes,
      usedRecipeIds,
      {
        proteinDeficit,
        fatDeficit,
        fiberDeficit: 0,
        fiberExcess: Math.max(0, totals.fiber - maxFiber),
        carbExcess: Math.max(0, totals.carbs - maxCarbs)
      },
      Math.max(0, (calorieTarget + 220) - totals.calories),
      {
        allowUsedRecipes: false,
        requireHighProtein: proteinDeficit > 8,
        requireHighFat: fatDeficit > 8,
        maxCarbs: hardCarbCap,
        maxCarbDensity: hardDensityCap,
        avoidRecipeIds: dayUsedRecipeIds,
        avoidRecipeNames: dayUsedRecipeNames
      }
    );

    if (!booster && calorieDeficit > 140) {
      booster = pickBestBoosterRecipe(
        dishRecipes,
        usedRecipeIds,
        {
          proteinDeficit,
          fatDeficit,
          fiberDeficit: 0,
          fiberExcess: Math.max(0, totals.fiber - maxFiber),
          carbExcess: Math.max(0, totals.carbs - maxCarbs)
        },
        Math.max(0, (calorieTarget + 280) - totals.calories),
        {
          allowUsedRecipes: true,
          requireHighProtein: proteinDeficit > 8,
          requireHighFat: fatDeficit > 8,
          maxCarbs: null,
          maxCarbDensity: 12,
          avoidRecipeIds: dayUsedRecipeIds,
          avoidRecipeNames: dayUsedRecipeNames
        }
      );
    }

    // Final relaxed fallback for heavily constrained profiles: prioritize reaching floors.
    if (!booster && (calorieDeficit > 220 || proteinDeficit > 12 || fatDeficit > 10)) {
      booster = pickBestBoosterRecipe(
        dishRecipes,
        usedRecipeIds,
        {
          proteinDeficit,
          fatDeficit,
          fiberDeficit: 0,
          fiberExcess: Math.max(0, totals.fiber - maxFiber),
          carbExcess: Math.max(0, totals.carbs - maxCarbs)
        },
        Math.max(0, (calorieTarget + 360) - totals.calories),
        {
          allowUsedRecipes: false,
          requireHighProtein: false,
          requireHighFat: false,
          maxCarbs: null,
          maxCarbDensity: null,
          avoidRecipeIds: dayUsedRecipeIds,
          avoidRecipeNames: dayUsedRecipeNames
        }
      );
    }

    if (!booster) break;

    const lunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;

    if (lunchDishCount >= maxLunchDishes && dinnerDishCount >= maxDinnerDishes) {
      // Both meals are full: drop one low-calorie non-rice dish to make room for a denser booster.
      const removable = [];
      const lunchNonRice = workingDay.lunch.items.filter(i => !i.isRice);
      const dinnerNonRice = workingDay.dinner.items.filter(i => !i.isRice);

      if (lunchNonRice.length > 1) {
        const lowestLunch = lunchNonRice.reduce((min, d) => (
          Number(d.calories || 0) < Number(min.calories || 0) ? d : min
        ), lunchNonRice[0]);
        removable.push({ mealKey: 'lunch', dish: lowestLunch });
      }

      if (dinnerNonRice.length > 1) {
        const lowestDinner = dinnerNonRice.reduce((min, d) => (
          Number(d.calories || 0) < Number(min.calories || 0) ? d : min
        ), dinnerNonRice[0]);
        removable.push({ mealKey: 'dinner', dish: lowestDinner });
      }

      if (removable.length === 0) break;

      const picked = removable.reduce((min, c) => (
        Number(c.dish.calories || 0) < Number(min.dish.calories || 0) ? c : min
      ), removable[0]);

      const combo = workingDay[picked.mealKey];
      combo.items = combo.items.filter(item => item !== picked.dish);
      workingDay[picked.mealKey] = recomputeComboMealTotals(combo);
    }

    const updatedLunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const updatedDinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;

    let targetMeal = updatedDinnerDishCount <= updatedLunchDishCount ? workingDay.dinner : workingDay.lunch;
    if (targetMeal === workingDay.lunch && updatedLunchDishCount >= maxLunchDishes) targetMeal = workingDay.dinner;
    if (targetMeal === workingDay.dinner && updatedDinnerDishCount >= maxDinnerDishes) targetMeal = workingDay.lunch;

    addRecipeToComboMeal(targetMeal, booster);
  }
}

function enforceCalorieFloor(workingDay, dishRecipes, blockedRecipeIds, thresholds, calorieTarget) {
  const {
    minCalories,
    minFat,
    maxFiber,
    maxCarbs,
    maxLunchDishes = 4,
    maxDinnerDishes = 5
  } = thresholds;

  for (let round = 0; round < 10; round++) {
    const totals = getDayNutritionTotals(workingDay);
    const calorieDeficit = Math.max(0, minCalories - totals.calories);
    if (calorieDeficit <= 0) break;

    const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
    const usedRecipeIds = new Set([...dayUsedRecipeIds]);
    for (const blockedId of blockedRecipeIds) usedRecipeIds.add(String(blockedId));

    const booster = pickBestBoosterRecipe(
      dishRecipes,
      usedRecipeIds,
      {
        proteinDeficit: 0,
        fatDeficit: Math.max(0, minFat - totals.fat),
        fiberDeficit: 0,
        fiberExcess: Math.max(0, totals.fiber - maxFiber),
        carbExcess: Math.max(0, totals.carbs - maxCarbs)
      },
      Math.max(0, (calorieTarget + 320) - totals.calories),
      {
        allowUsedRecipes: true,
        requireHighFat: calorieDeficit > 120,
        maxCarbs: null,
        maxCarbDensity: calorieDeficit > 200 ? 14 : 11,
        avoidRecipeIds: dayUsedRecipeIds,
        avoidRecipeNames: dayUsedRecipeNames
      }
    );

    let selectedBooster = booster;

    if (!selectedBooster && calorieDeficit > 180) {
      selectedBooster = pickBestBoosterRecipe(
        dishRecipes,
        usedRecipeIds,
        {
          proteinDeficit: 0,
          fatDeficit: Math.max(0, minFat - totals.fat),
          fiberDeficit: 0,
          fiberExcess: Math.max(0, totals.fiber - maxFiber),
          carbExcess: Math.max(0, totals.carbs - maxCarbs)
        },
        Math.max(0, (calorieTarget + 420) - totals.calories),
        {
          allowUsedRecipes: false,
          requireHighFat: false,
          maxCarbs: null,
          maxCarbDensity: null,
          avoidRecipeIds: dayUsedRecipeIds,
          avoidRecipeNames: dayUsedRecipeNames
        }
      );
    }

    if (!selectedBooster) break;

    const lunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;

    if (lunchDishCount >= maxLunchDishes && dinnerDishCount >= maxDinnerDishes) {
      const removable = [];
      const lunchNonRice = workingDay.lunch.items.filter(i => !i.isRice);
      const dinnerNonRice = workingDay.dinner.items.filter(i => !i.isRice);

      if (lunchNonRice.length > 1) {
        const lowestLunch = lunchNonRice.reduce((min, d) => (
          Number(d.calories || 0) < Number(min.calories || 0) ? d : min
        ), lunchNonRice[0]);
        removable.push({ mealKey: 'lunch', dish: lowestLunch });
      }

      if (dinnerNonRice.length > 1) {
        const lowestDinner = dinnerNonRice.reduce((min, d) => (
          Number(d.calories || 0) < Number(min.calories || 0) ? d : min
        ), dinnerNonRice[0]);
        removable.push({ mealKey: 'dinner', dish: lowestDinner });
      }

      if (removable.length === 0) break;

      const picked = removable.reduce((min, c) => (
        Number(c.dish.calories || 0) < Number(min.dish.calories || 0) ? c : min
      ), removable[0]);

      const combo = workingDay[picked.mealKey];
      combo.items = combo.items.filter(item => item !== picked.dish);
      workingDay[picked.mealKey] = recomputeComboMealTotals(combo);
    }

    const updatedLunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const updatedDinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;

    let targetMeal = updatedDinnerDishCount <= updatedLunchDishCount ? workingDay.dinner : workingDay.lunch;
    if (targetMeal === workingDay.lunch && updatedLunchDishCount >= maxLunchDishes) targetMeal = workingDay.dinner;
    if (targetMeal === workingDay.dinner && updatedDinnerDishCount >= maxDinnerDishes) targetMeal = workingDay.lunch;

    addRecipeToComboMeal(targetMeal, selectedBooster);
  }
}

function pickHighFiberRemovalCandidate(workingDay, minProtein, minFat) {
  const totals = getDayNutritionTotals(workingDay);
  const proteinBuffer = (totals.protein || 0) - minProtein;
  const fatBuffer = (totals.fat || 0) - minFat;
  const candidates = [];

  for (const mealKey of ['lunch', 'dinner']) {
    const combo = workingDay[mealKey];
    const nonRice = (combo?.items || []).filter(item => !item.isRice);
    if (nonRice.length <= 1) continue;

    for (const dish of nonRice) {
      const fiber = Number(dish.fiber || 0);
      const calories = Number(dish.calories || 0);
      const protein = Number(dish.protein || 0);
      const fat = Number(dish.fat || 0);

      if (proteinBuffer < 8 && protein >= 10) continue;
      if (fatBuffer < 6 && fat >= 8) continue;

      const score = (fiber * 3.5) + (calories * 0.15) - (protein * 0.8) - (fat * 0.55);
      candidates.push({ mealKey, dish, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function enforceFiberCap(workingDay, dishRecipes, blockedRecipeIds, thresholds, calorieTarget) {
  const {
    minCalories,
    minProtein,
    minFat,
    maxFiber,
    maxCarbs,
    maxLunchDishes = 4,
    maxDinnerDishes = 5
  } = thresholds;

  const passFiberCap = maxFiber * 1.15;

  for (let round = 0; round < 8; round++) {
    const totals = getDayNutritionTotals(workingDay);
    if (totals.fiber <= passFiberCap) break;

    const removal = pickHighFiberRemovalCandidate(workingDay, minProtein, minFat);
    if (!removal) break;

    const combo = workingDay[removal.mealKey];
    combo.items = combo.items.filter(item => item !== removal.dish);
    workingDay[removal.mealKey] = recomputeComboMealTotals(combo);

    const afterRemovalTotals = getDayNutritionTotals(workingDay);
    const calorieDeficit = Math.max(0, minCalories - afterRemovalTotals.calories);
    const proteinDeficit = Math.max(0, minProtein - afterRemovalTotals.protein);
    const fatDeficit = Math.max(0, minFat - afterRemovalTotals.fat);

    if (calorieDeficit <= 0 && proteinDeficit <= 0 && fatDeficit <= 0) continue;

    const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
    const usedRecipeIds = new Set([...dayUsedRecipeIds]);
    for (const blockedId of blockedRecipeIds) usedRecipeIds.add(String(blockedId));

    const booster = pickBestBoosterRecipe(
      dishRecipes,
      usedRecipeIds,
      {
        proteinDeficit,
        fatDeficit,
        fiberDeficit: 0,
        fiberExcess: Math.max(0, afterRemovalTotals.fiber - maxFiber),
        carbExcess: Math.max(0, afterRemovalTotals.carbs - maxCarbs)
      },
      Math.max(0, (calorieTarget + 260) - afterRemovalTotals.calories),
      {
        allowUsedRecipes: false,
        requireHighProtein: proteinDeficit > 8,
        requireHighFat: fatDeficit > 6,
        maxCarbs: null,
        maxCarbDensity: 10,
        avoidRecipeIds: dayUsedRecipeIds,
        avoidRecipeNames: dayUsedRecipeNames
      }
    );

    if (!booster) continue;

    const lunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;
    if (lunchDishCount >= maxLunchDishes && dinnerDishCount >= maxDinnerDishes) continue;

    let targetMeal = dinnerDishCount <= lunchDishCount ? workingDay.dinner : workingDay.lunch;
    if (targetMeal === workingDay.lunch && lunchDishCount >= maxLunchDishes) targetMeal = workingDay.dinner;
    if (targetMeal === workingDay.dinner && dinnerDishCount >= maxDinnerDishes) targetMeal = workingDay.lunch;

    addRecipeToComboMeal(targetMeal, booster);
  }
}

function pickLowQualityDishForReplacement(workingDay) {
  const candidates = [];

  for (const mealKey of ['lunch', 'dinner']) {
    const combo = workingDay[mealKey];
    const nonRice = (combo?.items || []).filter(item => !item.isRice);
    if (nonRice.length <= 1) continue;

    for (const dish of nonRice) {
      const protein = Number(dish.protein || 0);
      const fat = Number(dish.fat || 0);
      const carbs = Number(dish.carbs || 0);
      const fiber = Number(dish.fiber || 0);
      const calories = Number(dish.calories || 0);

      const quality = (protein * 1.5) + (fat * 1.2) - (fiber * 2.1) - (carbs * 0.4) + (calories * 0.02);
      candidates.push({ mealKey, dish, quality });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.quality - b.quality);
  return candidates[0];
}

function enforceProteinFatQuality(workingDay, dishRecipes, blockedRecipeIds, thresholds, calorieTarget) {
  const {
    minProtein,
    minFat,
    maxFiber,
    maxCarbs,
    maxLunchDishes = 4,
    maxDinnerDishes = 5
  } = thresholds;

  for (let round = 0; round < 8; round++) {
    const totals = getDayNutritionTotals(workingDay);
    const proteinDeficit = Math.max(0, minProtein - totals.protein);
    const fatDeficit = Math.max(0, minFat - totals.fat);

    if (proteinDeficit <= 0 && fatDeficit <= 0) break;

    const replacement = pickLowQualityDishForReplacement(workingDay);
    if (replacement) {
      const combo = workingDay[replacement.mealKey];
      combo.items = combo.items.filter(item => item !== replacement.dish);
      workingDay[replacement.mealKey] = recomputeComboMealTotals(combo);
    }

    const afterRemovalTotals = getDayNutritionTotals(workingDay);
    const { ids: dayUsedRecipeIds, names: dayUsedRecipeNames } = getDayUsedRecipeSignals(workingDay);
    const usedRecipeIds = new Set([...dayUsedRecipeIds]);
    for (const blockedId of blockedRecipeIds) usedRecipeIds.add(String(blockedId));

    const booster = pickBestBoosterRecipe(
      dishRecipes,
      usedRecipeIds,
      {
        proteinDeficit: Math.max(0, minProtein - afterRemovalTotals.protein),
        fatDeficit: Math.max(0, minFat - afterRemovalTotals.fat),
        fiberDeficit: 0,
        fiberExcess: Math.max(0, afterRemovalTotals.fiber - maxFiber),
        carbExcess: Math.max(0, afterRemovalTotals.carbs - maxCarbs)
      },
      Math.max(0, (calorieTarget + 280) - afterRemovalTotals.calories),
      {
        allowUsedRecipes: false,
        requireHighProtein: true,
        requireHighFat: true,
        maxCarbs: null,
        maxCarbDensity: 10,
        maxFiber: 4,
        avoidRecipeIds: dayUsedRecipeIds,
        avoidRecipeNames: dayUsedRecipeNames
      }
    );

    if (!booster) break;

    const lunchDishCount = workingDay.lunch.items.filter(i => !i.isRice).length;
    const dinnerDishCount = workingDay.dinner.items.filter(i => !i.isRice).length;
    if (lunchDishCount >= maxLunchDishes && dinnerDishCount >= maxDinnerDishes) break;

    let targetMeal = dinnerDishCount <= lunchDishCount ? workingDay.dinner : workingDay.lunch;
    if (targetMeal === workingDay.lunch && lunchDishCount >= maxLunchDishes) targetMeal = workingDay.dinner;
    if (targetMeal === workingDay.dinner && dinnerDishCount >= maxDinnerDishes) targetMeal = workingDay.lunch;

    addRecipeToComboMeal(targetMeal, booster);
  }
}

function getDishIdentity(item) {
  if (!item || item.isRice) return null;
  const normalizedName = canonicalizeDishName(item.name || '');
  if (normalizedName) return normalizedName;
  const id = item.recipeId?.toString?.();
  if (id) return id;
  return null;
}

function dedupeNonRiceDishesInDay(workingDay) {
  const seen = new Set();

  // Reserve breakfast dish identity to avoid reusing it in lunch/dinner.
  if (workingDay.breakfast?.items && Array.isArray(workingDay.breakfast.items)) {
    for (const item of workingDay.breakfast.items) {
      const identity = getDishIdentity(item);
      if (identity) seen.add(identity);
    }
  } else {
    const identity = getDishIdentity(workingDay.breakfast);
    if (identity) seen.add(identity);
  }

  for (const mealKey of ['lunch', 'dinner']) {
    const combo = workingDay[mealKey];
    const items = [...(combo?.items || [])];
    let nonRiceCount = items.filter(i => !i.isRice).length;
    let changed = false;

    combo.items = items.filter(item => {
      if (item.isRice) return true;

      const identity = getDishIdentity(item);
      if (!identity) return true;

      if (seen.has(identity) && nonRiceCount > 1) {
        nonRiceCount -= 1;
        changed = true;
        return false;
      }

      seen.add(identity);
      return true;
    });

    if (changed) {
      workingDay[mealKey] = recomputeComboMealTotals(combo);
    }
  }
}

function enforceMealDishCaps(workingDay, maxLunchDishes = 4, maxDinnerDishes = 5) {
  const trimToCap = (mealKey, maxCount) => {
    const combo = workingDay[mealKey];
    if (!combo?.items) return;

    while (combo.items.filter(i => !i.isRice).length > maxCount) {
      const nonRice = combo.items.filter(i => !i.isRice);
      if (nonRice.length <= maxCount) break;

      // Remove the least useful dish for macro quality first.
      const toRemove = nonRice
        .map(dish => {
          const protein = Number(dish.protein || 0);
          const fat = Number(dish.fat || 0);
          const carbs = Number(dish.carbs || 0);
          const fiber = Number(dish.fiber || 0);
          const score = (protein * 1.5) + (fat * 1.2) - (carbs * 0.5) - (fiber * 0.15);
          return { dish, score };
        })
        .sort((a, b) => a.score - b.score)[0]?.dish;

      if (!toRemove) break;
      combo.items = combo.items.filter(item => item !== toRemove);
      workingDay[mealKey] = recomputeComboMealTotals(combo);
    }
  };

  trimToCap('lunch', maxLunchDishes);
  trimToCap('dinner', maxDinnerDishes);
}

// Helper function: Generate fallback meal plan without AI (for development/testing)
function generateFallbackMealPlan(duration, recipes, blockedRecipeIds = new Set()) {
  console.log('📝 Generating fallback meal plan (no AI)...');
  
  // Separate rice and dish recipes
  const normalizedBlockedIds = new Set([...blockedRecipeIds].map(id => String(id)));

  const riceRecipes = recipes.filter(r => {
    const recipeId = r?._id ? String(r._id) : null;
    if (recipeId && normalizedBlockedIds.has(recipeId)) return false;
    return r.isRice || r.category === 'staple';
  });

  const dishRecipes = recipes.filter(r => {
    const recipeId = r?._id ? String(r._id) : null;
    if (recipeId && normalizedBlockedIds.has(recipeId)) return false;
    return !r.isRice && r.category !== 'staple';
  });
  
  const days = [];
  const usedDishIds = new Set();
  
  for (let i = 1; i <= duration; i++) {
    // Filter available dishes (not used recently)
    const availableDishes = dishRecipes.filter(r => !usedDishIds.has(r._id.toString()));
    
    if (availableDishes.length < 7) {
      usedDishIds.clear(); // Reset if running out
    }
    
    // Shuffle dishes
    const shuffled = [...(availableDishes.length > 0 ? availableDishes : dishRecipes)]
      .sort(() => Math.random() - 0.5);
    
    // Breakfast: pick 1 random dish
    const breakfastRecipe = shuffled[0];
    
    // Lunch combo: 1 rice + flexible dishes, balanced with dinner
    const fallbackRice = recipes.filter(r => r.isRice || r.category === 'staple');
    const sortRiceBySize = (items) => [...items].sort((a, b) => {
      const aCalories = Number(a?.calories || 0);
      const bCalories = Number(b?.calories || 0);
      return aCalories - bCalories;
    });
    const sortedRice = sortRiceBySize(riceRecipes.length ? riceRecipes : fallbackRice);
    const lunchRice = sortedRice[0] || sortedRice[1] || fallbackRice[0];

    const lunchDishCount = 1 + Math.floor(Math.random() * 3); // 1..3 dishes
    const lunchDishes = shuffled.slice(1, 1 + lunchDishCount);
    
    // Dinner combo: 1 rice + dishes, keep dish count balanced with lunch (difference <= 1)
    const dinnerRice = sortedRice[0] || fallbackRice[0];
    const dinnerDishCount = Math.max(1, Math.min(4, lunchDishCount + (Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1))));
    const dinnerDishes = shuffled.slice(1 + lunchDishCount, 1 + lunchDishCount + dinnerDishCount);
    
    days.push({
      day: i,
      breakfast: { recipeIndex: recipes.indexOf(breakfastRecipe) + 1 },
      lunch: {
        rice: { recipeIndex: recipes.indexOf(lunchRice) + 1 },
        dishes: lunchDishes.map(d => ({ recipeIndex: recipes.indexOf(d) + 1 }))
      },
      dinner: {
        rice: { recipeIndex: recipes.indexOf(dinnerRice) + 1 },
        dishes: dinnerDishes.map(d => ({ recipeIndex: recipes.indexOf(d) + 1 }))
      }
    });
    
    // Mark dishes as used
    [breakfastRecipe, ...lunchDishes, ...dinnerDishes].forEach(r => {
      if (r) usedDishIds.add(r._id.toString());
    });
  }
  
  // Format like Gemini response
  return JSON.stringify({ days });
}

// Helper function: Convert recipe to meal object
function recipeToMealObject(recipe) {
  if (!recipe) return null;
  
  return {
    recipeId: recipe._id,
    name: recipe.name,
    description: recipe.description,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
    fiber: recipe.fiber,
    cholesterol: recipe.cholesterol || 0,
    omega3: recipe.omega3 || 0,
    water: recipe.water || 0,
    saturatedFat: recipe.saturatedFat || 0,
    sodium: recipe.sodium || 0,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    preparationTime: recipe.preparationTime,
    cookingTime: recipe.cookingTime,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    image: recipe.image,
    tags: recipe.tags || [],
    isRice: Boolean(recipe.isRice || recipe.category === 'staple'),
    riceAmount: recipe.riceAmount
  };
}

export {
  generateMealPlan,
  confirmMealPlan,
  getActiveMealPlan,
  getDraftMealPlan,
  clearDraftMealPlan,
  generateAndStoreMealPlanBySignals,
  evaluateOnboardingMealPlanFeasibility
};
