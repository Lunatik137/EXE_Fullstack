import MealPlan from "../models/mealPlanModel.js";
import userModel from "../models/userModel.js";
import recipeModel from "../models/recipeModel.js";
import geminiService from "../utils/geminiService.js";

// Generate meal plan using Gemini AI (with real recipes from database)
const generateMealPlan = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { planType, duration } = req.body;

    console.log(" Generate meal plan request:", { userId, planType, duration });

    // Get user's onboarding data
    const user = await userModel.findById(userId);
    if (!user || !user.hasCompletedOnboarding) {
      return res.json({ success: false, message: "Please complete onboarding first" });
    }

    const onboardingData = user.onboardingData;
    console.log(" User onboarding data:", onboardingData);

    // Calculate daily calorie needs based on user data
    const dailyCalories = calculateDailyCalories(
      onboardingData.weight,
      onboardingData.height,
      onboardingData.age,
      onboardingData.gender,
      onboardingData.activityLevel,
      onboardingData.goal
    );

    console.log(" Calculated daily calories:", dailyCalories);

    // Fetch all recipes from database
    const allRecipes = await recipeModel.find({});
    console.log(" Total recipes in database:", allRecipes.length);

    // Filter recipes based on user allergies and dislikes
    const filteredRecipes = allRecipes.filter(recipe => {
      // Normalize allergies and dislikes to arrays
      const userAllergies = Array.isArray(onboardingData.allergies) 
        ? onboardingData.allergies 
        : (onboardingData.allergies ? [onboardingData.allergies] : []);
      
      const userDislikes = Array.isArray(onboardingData.dislikes)
        ? onboardingData.dislikes
        : (onboardingData.dislikes ? [onboardingData.dislikes] : []);

      // Check allergies
      if (userAllergies.length > 0) {
        const hasAllergen = recipe.allergens?.some(allergen => 
          userAllergies.some(userAllergen => 
            allergen.toLowerCase().includes(userAllergen.toLowerCase()) ||
            userAllergen.toLowerCase().includes(allergen.toLowerCase())
          )
        );
        if (hasAllergen) return false;
      }

      // Check dislikes
      if (userDislikes.length > 0) {
        const hasDisliked = userDislikes.some(dislike => 
          recipe.name.toLowerCase().includes(dislike.toLowerCase()) ||
          recipe.ingredients?.some(ing => ing.toLowerCase().includes(dislike.toLowerCase()))
        );
        if (hasDisliked) return false;
      }

      return true;
    });

    console.log(" Filtered recipes (safe for user):", filteredRecipes.length);

    if (filteredRecipes.length < duration * 3) {
      return res.json({ 
        success: false, 
        message: `Not enough suitable recipes (need ${duration * 3}, have ${filteredRecipes.length}). Please adjust your dietary restrictions.` 
      });
    }

    // Build prompt for Gemini AI
    const prompt = buildGeminiPrompt(user, onboardingData, dailyCalories, duration, filteredRecipes);

    // Call Gemini AI to generate intelligent meal plan
    console.log(" Calling Gemini AI to generate personalized meal plan...");
    
    let geminiResponse;
    let usedFallback = false;
    
    try {
      geminiResponse = await geminiService.generateContent(prompt);
      console.log(" Gemini AI response received");
    } catch (error) {
      // If Gemini API fails, use fallback
      const shouldUseFallback = 
        process.env.NODE_ENV === 'development' ||
        error.message.includes('not configured') ||
        error.message.includes('No compatible Gemini model') ||
        error.message.includes('API keys exhausted') ||
        error.message.includes('API key permissions') ||
        error.message.includes('configuration error') ||
        error.message.includes('Must provide a model name');
      
      if (shouldUseFallback) {
        console.log(" Gemini API unavailable, using fallback meal selection...");
        console.log(`   Reason: ${error.message}`);
        geminiResponse = generateFallbackMealPlan(duration, filteredRecipes);
        usedFallback = true;
      } else {
        throw error;
      }
    }

    // Parse Gemini response and map to actual recipes
    const parsedDays = parseGeminiResponse(geminiResponse, filteredRecipes);

    // Calculate summary statistics
    const totalRecipes = new Set([
      ...parsedDays.map(d => d.breakfast?.name),
      ...parsedDays.map(d => d.lunch?.name),
      ...parsedDays.map(d => d.dinner?.name)
    ].filter(Boolean)).size;

    const avgCalories = Math.round(
      parsedDays.reduce((sum, day) => sum + day.totalCalories, 0) / parsedDays.length
    );

    // Create meal plan
    const mealPlan = new MealPlan({
      userId,
      planType,
      duration,
      startDate: new Date(),
      endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
      status: 'draft',
      days: parsedDays,
      totalRecipes,
      avgCalories,
      userGoal: onboardingData.goal,
      dietType: onboardingData.dietType,
      allergies: onboardingData.allergies,
      activityLevel: onboardingData.activityLevel,
    });

    await mealPlan.save();

    console.log(" Meal plan saved successfully with ID:", mealPlan._id);

    const responseMessage = usedFallback 
      ? "Meal plan generated successfully! (Note: Using random selection as AI is unavailable)"
      : "AI-powered meal plan generated successfully!";

    res.json({ 
      success: true, 
      mealPlan,
      message: responseMessage,
      usedAI: !usedFallback
    });
  } catch (error) {
    console.error(" Error generating meal plan:", error);
    res.json({ success: false, message: error.message || "Error generating meal plan" });
  }
};

// Confirm and activate meal plan
const confirmMealPlan = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { mealPlanId } = req.body;

    // Deactivate all other active meal plans for this user
    await MealPlan.updateMany(
      { userId, status: 'active' },
      { status: 'completed' }
    );

    // Activate the new meal plan
    await MealPlan.findByIdAndUpdate(mealPlanId, {
      status: 'active',
      startDate: new Date()
    });

    res.json({ success: true, message: "Meal plan activated successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error confirming meal plan" });
  }
};

// Get active meal plan for user
const getActiveMealPlan = async (req, res) => {
  try {
    const userId = req.body.userId;

    const mealPlan = await MealPlan.findOne({ userId, status: 'active' });

    if (!mealPlan) {
      return res.json({ success: false, message: "No active meal plan found" });
    }

    res.json({ success: true, mealPlan });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching meal plan" });
  }
};

// Helper function: Calculate daily calories using Mifflin-St Jeor equation
function calculateDailyCalories(weight, height, age, gender, activityLevel, goal) {
  // BMR calculation
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

  // Adjust for goal
  let dailyCalories = tdee;
  if (goal === 'lose' || goal === 'Lose') {
    dailyCalories = tdee - 500; // 500 calorie deficit
  } else if (goal === 'gain' || goal === 'Gain') {
    dailyCalories = tdee + 300; // 300 calorie surplus
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

// Helper function: Build prompt for Gemini AI
function buildGeminiPrompt(user, onboardingData, calorieTarget, duration, recipes) {
  // Separate rice and dish recipes
  const riceRecipes = recipes.filter(r => r.isRice || r.category === 'staple');
  const dishRecipes = recipes.filter(r => !r.isRice && r.category !== 'staple');
  
  const riceList = riceRecipes.map((r, idx) => {
    return `${idx + 1}. ${r.name} - ${r.calories}kcal | ${r.riceAmount} gạo chưa nấu`;
  }).join('\n');

  const recipeList = recipes.map((r, idx) => {
    const cookingTimeline = (r.preparationTime || 0) + (r.cookingTime || 0);
    const riceInfo = r.isRice ? ` | ${r.riceAmount} gạo` : '';
    return `${idx + 1}. ${r.name} - ${r.calories}kcal | Cooking: ${r.cookingMethod} | Protein: ${r.protein}g${riceInfo}`;
  }).join('\n');

  return `You are a professional Vietnamese nutritionist creating a ${duration}-day personalized meal plan for a vegan client.

USER PROFILE:
- Age: ${onboardingData.age}, Gender: ${onboardingData.gender}
- Current Weight: ${onboardingData.weight}kg, Height: ${onboardingData.height}cm
- Goal: ${onboardingData.goal}${onboardingData.targetWeight ? ` (target ${onboardingData.targetWeight}kg)` : ''}
- Activity Level: ${onboardingData.activityLevel}
- Daily Calorie Target: ${calorieTarget} calories/day
- Health Conditions: ${toCommaSeparated(onboardingData.healthConditions)}
- Diet Type: ${onboardingData.dietType || 'Vegan'}
- Allergies: ${toCommaSeparated(onboardingData.allergies)}
- Dislikes: ${toCommaSeparated(onboardingData.dislikes)}

AVAILABLE RECIPES:
${recipeList}

MEAL STRUCTURE REQUIREMENTS:
1. **BREAKFAST**: Choose 1 single recipe (light, easy-to-digest)
   - Target: ~${Math.round(calorieTarget * 0.3)} cal

2. **LUNCH** (COMBO MEAL): Choose 1 rice portion + 2-3 dishes
   - Rice options (indices 1-${riceRecipes.length}): Choose based on calorie needs
     ${riceList}
   - Dishes: Choose 2-3 complementary dishes (mix cooking methods)
   - Total target: ~${Math.round(calorieTarget * 0.4)} cal (40% of daily intake)
   - Balance: Ensure adequate protein (15-20g) and variety

3. **DINNER** (COMBO MEAL): Choose 1 rice portion + 2-3 dishes
   - Rice options: Same as lunch (choose appropriate portion)
   - Dishes: Choose 2-3 different dishes (lighter than lunch)
   - Total target: ~${Math.round(calorieTarget * 0.3)} cal (30% of daily intake)
   - Prefer: Include soup (canh) or steamed dish (hấp) for easier digestion

IMPORTANT GUIDELINES:
- Total daily calories: ${calorieTarget}±100 calories
- Provide VARIETY: Don't repeat dishes within same day or consecutive days
- Balance cooking methods: xào, luộc, nướng, kho, canh, trộn, hấp, chiên
- Mix difficulty levels for busy/relaxed days
- Use recipe INDEX numbers (1-${recipes.length}) from the list above

RESPONSE FORMAT (strict JSON, no markdown):
{
  "days": [
    {
      "day": 1,
      "breakfast": { "recipeIndex": 85 },
      "lunch": {
        "rice": { "recipeIndex": 2 },
        "dishes": [
          { "recipeIndex": 45 },
          { "recipeIndex": 67 },
          { "recipeIndex": 23 }
        ]
      },
      "dinner": {
        "rice": { "recipeIndex": 1 },
        "dishes": [
          { "recipeIndex": 34 },
          { "recipeIndex": 78 }
        ]
      }
    }
  ]
}

Generate the ${duration}-day meal plan in pure JSON format now:`;
}

// Helper function: Parse Gemini AI response
function parseGeminiResponse(response, recipes) {
  try {
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
      // BREAKFAST: Single recipe (simple format)
      const breakfastData = Array.isArray(day.breakfast) ? day.breakfast[0] : day.breakfast;
      const breakfastIndex = breakfastData?.recipeIndex;
      
      if (!breakfastIndex) {
        throw new Error(`Missing breakfast recipe index in day ${day.day}`);
      }
      
      const breakfastRecipe = recipes[breakfastIndex - 1];
      if (!breakfastRecipe) {
        throw new Error(`Invalid breakfast index ${breakfastIndex} (max: ${recipes.length})`);
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
        (breakfastRecipe?.calories || 0) + 
        (lunchCombo?.totalCalories || 0) + 
        (dinnerCombo?.totalCalories || 0);

      return {
        dayNumber: day.day,
        date: new Date(Date.now() + (day.day - 1) * 24 * 60 * 60 * 1000),
        totalCalories,
        breakfast: recipeToMealObject(breakfastRecipe),
        lunch: lunchCombo,
        dinner: dinnerCombo
      };
    });

    return days;
  } catch (error) {
    console.error(' Error parsing Gemini response:', error);
    console.error('Response was:', response);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}

// Helper function: Parse combo meal (rice + dishes)
function parseComboMeal(mealData, recipes, dayNumber, mealType) {
  const items = [];
  
  // Add rice
  const riceIndex = mealData.rice?.recipeIndex;
  if (!riceIndex) {
    throw new Error(`Missing rice index in day ${dayNumber} ${mealType}`);
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

export { generateMealPlan, confirmMealPlan, getActiveMealPlan };
