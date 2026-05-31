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
  skipSimilarityLookup = false,
  excludedMealPlanIds = [],
  generationSource = "user-request",
  trainingCaseKey = null,
  trainingTargetCalories = null
}) {
  const signalPayload = {
    avgCalories: Number(avgCalories || 0),
    duration: Number(duration || 0),
    userGoal: normalizeString(userGoal || onboardingData.goal || "maintain"),
    dietType: normalizeString(dietType || onboardingData.dietType || "balanced"),
    allergies: normalizeStringArray(allergies ?? onboardingData.allergies),
    activityLevel: normalizeString(activityLevel || onboardingData.activityLevel || "moderate")
  };

  if (!skipSimilarityLookup) {
    // Fetch avgCalories of previously excluded plans so we avoid recommending plans with the same calorie count
    let excludedCalories = [];
    if (excludedMealPlanIds.length > 0) {
      const excludedPlans = await MealPlan.find(
        { _id: { $in: excludedMealPlanIds } },
        { avgCalories: 1 }
      ).lean();
      excludedCalories = [...new Set(excludedPlans.map(p => Number(p.avgCalories)).filter(c => c > 0))];
      if (excludedCalories.length > 0) {
        console.log(` Excluding avgCalories from similarity lookup: [${excludedCalories.join(', ')}]`);
      }
    }

    const similar = await findSimilarMealPlanBySignals(signalPayload, duration, excludedMealPlanIds, excludedCalories);
    if (similar) {
      const userDislikes = normalizeDislikesList(onboardingData.dislikes);
      if (!isPlanSafeForUser(similar.candidate, signalPayload.allergies, userDislikes)) {
        console.log(' Similar plan contains allergens/dislikes for this user — skipping reuse, generating fresh with AI...');
      } else {
        console.log(` Reused similar meal plan from DB with score ${similar.score.toFixed(3)}`);
        return cloneSimilarMealPlanForUser(similar, {
          userId,
          planType,
          duration,
          userGoal: signalPayload.userGoal,
          dietType: signalPayload.dietType,
          allergies: signalPayload.allergies,
          activityLevel: signalPayload.activityLevel,
          generationSource,
          trainingCaseKey,
          trainingTargetCalories
        });
      }
    }
  }

  const allRecipes = await recipeModel.find({});
  console.log(" Total recipes in database:", allRecipes.length);

  const filteredRecipes = allRecipes.filter(recipe => {
    const userAllergies = signalPayload.allergies;
    const userDislikes = normalizeDislikesList(onboardingData.dislikes);

    if (recipeHasAllergen(recipe, userAllergies)) return false;

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

  const generationDuration = Math.min(duration, MAX_GENERATION_DAYS);
  console.log(` Generation duration capped at: ${generationDuration} days (requested: ${duration})`);

  if (filteredRecipes.length < generationDuration * 3) {
    throw new Error(
      `Not enough suitable recipes (need ${generationDuration * 3}, have ${filteredRecipes.length}). Please adjust dietary restrictions.`
    );
  }

  const effectiveOnboardingData = {
    age: onboardingData.age ?? 28,
    gender: onboardingData.gender ?? "Male",
    weight: onboardingData.weight ?? 65,
    goal: signalPayload.userGoal,
    allergies: signalPayload.allergies,
    dislikes: onboardingData.dislikes ?? [],
  };

  const prompt = buildGeminiPrompt(
    { _id: userId },
    effectiveOnboardingData,
    signalPayload.avgCalories,
    generationDuration,
    filteredRecipes
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
    geminiResponse = generateFallbackMealPlan(generationDuration, filteredRecipes);
    usedFallback = true;
  }

  const parsedDays = parseGeminiResponse(geminiResponse, filteredRecipes);
  const macroTargets = calculateMacroTargets(effectiveOnboardingData.weight, signalPayload.avgCalories, effectiveOnboardingData.goal);
  const balancedDays = rebalanceMealPlanNutrition(
    parsedDays,
    filteredRecipes,
    signalPayload.avgCalories,
    macroTargets
  );
  const trimmedDays = trimExcessCalories(balancedDays, signalPayload.avgCalories);
  const finalDays = extendDaysToDuration(trimmedDays, duration);
  const summary = summarizeMealPlanDays(finalDays);

  const mealPlan = new MealPlan({
    userId,
    planType,
    duration,
    startDate: new Date(),
    endDate: new Date(Date.now() + duration * DAY_IN_MS),
    status: getMealPlanStatusForSource(generationSource),
    days: finalDays,
    totalRecipes: summary.totalRecipes,
    avgCalories: summary.avgCalories,
    userGoal: signalPayload.userGoal,
    dietType: signalPayload.dietType,
    allergies: signalPayload.allergies,
    activityLevel: signalPayload.activityLevel,
    generationSource,
    trainingCaseKey,
    trainingTargetCalories,
  });

  await mealPlan.save();

  return {
    mealPlan,
    reusedFromDB: false,
    similarityScore: null,
    usedAI: !usedFallback,
    usedFallback
  };
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
      skipSimilarityLookup: Boolean(skipSimilarityLookup),
      excludedMealPlanIds: normalizeObjectIdStrings(excludeMealPlanIds)
    });

    console.log(" Meal plan saved successfully with ID:", result.mealPlan._id);

    const responseMessage = result.reusedFromDB
      ? `Meal plan loaded from similar DB data (similarity: ${result.similarityScore})`
      : (result.usedFallback
        ? "Meal plan generated successfully! (Note: Using random selection as AI is unavailable)"
        : "AI-powered meal plan generated successfully!");

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

// Helper function: Build prompt for Gemini AI
function buildGeminiPrompt(user, onboardingData, calorieTarget, duration, recipes) {
  const macros = calculateMacroTargets(onboardingData.weight, calorieTarget, onboardingData.goal);

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

MEAL STRUCTURE (targets per meal):
- Breakfast: (optional rice) + 1-3 dishes | ${bCalMin}-${bCalMax} kcal (20-30% of daily) | ~${bProtein}g protein | ~${bFat}g fat | ~${bFiber}g fiber
- Lunch:     1 rice + 2-3 dishes (max 3) | ~${Math.round(calorieTarget * 0.40)} kcal | ~${lProtein}g protein | ~${lFat}g fat | ~${lFiber}g fiber
- Dinner:    1 rice + 2-3 dishes (max 3) | ~${Math.round(calorieTarget * 0.35)} kcal | ~${dProtein}g protein | ~${dFat}g fat | ~${dFiber}g fiber

RULES:
1. Vary recipes daily -- no same dish on consecutive days.
2. BREAKFAST DIVERSITY: Each breakfast recipe must be different from ALL other days. Never repeat the same breakfast recipe within any 7-day window.
3. Fat target: prioritize [HIGH-FAT] recipes at each meal (nuts, seeds, tofu stir-fries, avocado dishes).
4. Fiber target: include at least 1 [HIGH-FIBER] dish per meal (legumes, leafy greens, root vegetables).
5. PROTEIN IS MANDATORY: Each meal MUST include at least 1 [HIGH-PROTEIN] recipe. Lunch MUST have 2 [HIGH-PROTEIN] recipes. Total daily protein MUST reach at least ${macros.protein - 8}g -- do NOT select plans that fall short.
6. Daily total within +-150 kcal of ${calorieTarget} -- do NOT sacrifice protein/fat to hit calories.
7. Breakfast must have fat AND fiber -- add more dishes (or rice) when needed to reach ${bCalMin} kcal.
8. Balance calories across meals -- lunch and dinner should each be roughly at their targets.
9. Lunch and dinner must have the SAME number of dishes (±1 at most). Do NOT load 4-5 dishes into one meal while the other only has 1-2.
10. CARB LIMIT: Total daily carbs MUST NOT exceed ${macros.carbs + 25}g. Limit rice to max 1 serving per meal. Avoid combining multiple high-carb staples (corn + rice + potato) in the same day.

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
      if (lunchDishes.length  > 1) candidates.push({ meal: 'lunch',  dish: lunchDishes.reduce((m, d)  => (d.calories || 0) > (m.calories || 0) ? d : m) });
      if (dinnerDishes.length > 1) candidates.push({ meal: 'dinner', dish: dinnerDishes.reduce((m, d) => (d.calories || 0) > (m.calories || 0) ? d : m) });

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

function rebalanceMealPlanNutrition(days, recipes, calorieTarget, macroTargets) {
  const minProtein = macroTargets.protein * 0.9;
  const minFat = macroTargets.fat * 0.92;
  const minFiber = macroTargets.fiber * 0.85;
  const dishRecipes = recipes.filter(r => !r.isRice && r.category !== 'staple');

  return days.map(day => {
    const workingDay = {
      ...day,
      lunch: normalizeComboMeal(day.lunch),
      dinner: normalizeComboMeal(day.dinner)
    };

    for (let i = 0; i < 6; i++) {
      const totals = getDayNutritionTotals(workingDay);
      const proteinDeficit = Math.max(0, minProtein - totals.protein);
      const fatDeficit = Math.max(0, minFat - totals.fat);
      const fiberDeficit = Math.max(0, minFiber - totals.fiber);

      if (proteinDeficit <= 0 && fatDeficit <= 0 && fiberDeficit <= 0) {
        break;
      }

      const usedRecipeIds = new Set([
        workingDay.breakfast?.recipeId?.toString?.(),
        ...workingDay.lunch.items.map(item => item.recipeId?.toString?.()),
        ...workingDay.dinner.items.map(item => item.recipeId?.toString?.())
      ].filter(Boolean));

      const remainingCalories = Math.max(0, (calorieTarget + 150) - totals.calories);
      let boosterRecipe = pickBestBoosterRecipe(
        dishRecipes,
        usedRecipeIds,
        { proteinDeficit, fatDeficit, fiberDeficit },
        remainingCalories,
        { allowUsedRecipes: false }
      );

      // If still fat-deficient, allow repeating a high-fat dish as a controlled fallback.
      if (!boosterRecipe && fatDeficit > 6) {
        boosterRecipe = pickBestBoosterRecipe(
          dishRecipes,
          usedRecipeIds,
          { proteinDeficit, fatDeficit, fiberDeficit },
          remainingCalories,
          { allowUsedRecipes: true, requireHighFat: true }
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
      addRecipeToComboMeal(targetCombo, boosterRecipe);
    }

    let finalTotals = getDayNutritionTotals(workingDay);

    // Last-mile rescue for fat: add up to 2 high-fat dishes even if calories are slightly over.
    let fatRescueCount = 0;
    while (finalTotals.fat < minFat && fatRescueCount < 2) {
      const usedRecipeIds = new Set([
        workingDay.breakfast?.recipeId?.toString?.(),
        ...workingDay.lunch.items.map(item => item.recipeId?.toString?.()),
        ...workingDay.dinner.items.map(item => item.recipeId?.toString?.())
      ].filter(Boolean));

      const fatOnlyBooster = pickBestBoosterRecipe(
        dishRecipes,
        usedRecipeIds,
        {
          proteinDeficit: 0,
          fatDeficit: Math.max(0, minFat - finalTotals.fat),
          fiberDeficit: 0
        },
        0,
        { allowUsedRecipes: true, requireHighFat: true }
      );

      if (!fatOnlyBooster) break;
      // Add fat rescue to whichever meal has fewer dishes to maintain balance
      const lDishes = workingDay.lunch.items.filter(i => !i.isRice).length;
      const dDishes = workingDay.dinner.items.filter(i => !i.isRice).length;
      addRecipeToComboMeal(lDishes <= dDishes ? workingDay.lunch : workingDay.dinner, fatOnlyBooster);
      finalTotals = getDayNutritionTotals(workingDay);
      fatRescueCount += 1;
    }

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
    fat:      getBreakfastMacro(day.breakfast, 'fat')     + (day.lunch?.totalFat     || 0) + (day.dinner?.totalFat     || 0),
    fiber:    getBreakfastMacro(day.breakfast, 'fiber')   + (day.lunch?.totalFiber   || 0) + (day.dinner?.totalFiber   || 0)
  };
}

function pickBestBoosterRecipe(recipes, usedRecipeIds, deficits, remainingCalories, options = {}) {
  const { allowUsedRecipes = false, requireHighFat = false } = options;
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const recipe of recipes) {
    const recipeId = recipe._id?.toString?.();
    if (!recipeId) continue;
    if (!allowUsedRecipes && usedRecipeIds.has(recipeId)) continue;

    const protein = recipe.protein || 0;
    const fat = recipe.fat || 0;
    const fiber = recipe.fiber || 0;
    const calories = recipe.calories || 0;
    if (protein <= 0 && fat <= 0 && fiber <= 0) continue;
    if (requireHighFat && fat < 10) continue;

    const fatPer100Kcal = calories > 0 ? (fat / calories) * 100 : 0;
    const needsFat = deficits.fatDeficit > 0;

    const proteinScore = deficits.proteinDeficit > 0 ? Math.min(1.5, protein / deficits.proteinDeficit) * 2.7 : 0;
    const fatScore = deficits.fatDeficit > 0 ? Math.min(2, fat / deficits.fatDeficit) * 4.6 : 0;
    const fiberScore = deficits.fiberDeficit > 0 ? Math.min(1.5, fiber / deficits.fiberDeficit) * 2.5 : 0;
    const fatDensityScore = needsFat ? fatPer100Kcal * 0.9 : 0;

    let score = proteinScore + fatScore + fiberScore + fatDensityScore;

    // In fat-deficit mode, allow slight calorie overshoot to catch up on fat.
    if (remainingCalories > 0 && calories > remainingCalories) {
      score -= needsFat ? 0.4 : 1.2;
    }
    if (calories > 550) score -= 0.6;
    if (allowUsedRecipes) score -= 0.25;

    if (score > bestScore) {
      bestScore = score;
      best = recipe;
    }
  }

  return best;
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

// Helper function: Generate fallback meal plan without AI (for development/testing)
function generateFallbackMealPlan(duration, recipes) {
  console.log('📝 Generating fallback meal plan (no AI)...');
  
  // Separate rice and dish recipes
  const riceRecipes = recipes.filter(r => r.isRice || r.category === 'staple');
  const dishRecipes = recipes.filter(r => !r.isRice && r.category !== 'staple');
  
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
    
    // Lunch combo: rice (medium) + 2-3 dishes
    const lunchRice = riceRecipes[1] || riceRecipes[0]; // Prefer 150g rice
    const lunchDishCount = 2 + Math.floor(Math.random() * 2); // 2 or 3 dishes
    const lunchDishes = shuffled.slice(1, 1 + lunchDishCount);
    
    // Dinner combo: rice (small) + 2 dishes
    const dinnerRice = riceRecipes[0]; // 100g rice (lighter dinner)
    const dinnerDishes = shuffled.slice(1 + lunchDishCount, 3 + lunchDishCount);
    
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
    tags: recipe.tags || []
  };
}

export {
  generateMealPlan,
  confirmMealPlan,
  getActiveMealPlan,
  getDraftMealPlan,
  clearDraftMealPlan,
  generateAndStoreMealPlanBySignals
};
