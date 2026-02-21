import mongoose from "mongoose";

const mealPlanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    planType: { type: String, enum: ['free', 'premium'], required: true },
    duration: { type: Number, required: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    status: { type: String, enum: ['draft', 'active', 'completed', 'cancelled'], default: 'draft' },
    
    // Daily meal structure
    days: [{
      dayNumber: { type: Number, required: true },
      date: { type: Date },
      totalCalories: { type: Number },
      
      // Breakfast - single item (giữ nguyên vì bữa sáng thường 1 món)
      breakfast: {
        name: String,
        description: String,
        recipeId: { type: mongoose.Schema.Types.ObjectId, ref: "recipe" },
        calories: Number,
        protein: Number,
        carbs: Number,
        fat: Number,
        fiber: Number,
        cholesterol: Number,
        omega3: Number,
        water: Number,
        saturatedFat: Number,
        sodium: Number,
        ingredients: [String],
        instructions: [String],
        preparationTime: Number,
        cookingTime: Number,
        servings: Number,
        difficulty: String,
        image: String,
        tags: [String]
      },
      
      // Lunch - combo meal (cơm + món ăn)
      lunch: {
        items: [{  // Array of meal items (rice + dishes)
          name: String,
          description: String,
          recipeId: { type: mongoose.Schema.Types.ObjectId, ref: "recipe" },
          calories: Number,
          protein: Number,
          carbs: Number,
          fat: Number,
          fiber: Number,
          cholesterol: Number,
          omega3: Number,
          water: Number,
          saturatedFat: Number,
          sodium: Number,
          ingredients: [String],
          instructions: [String],
          preparationTime: Number,
          cookingTime: Number,
          servings: Number,
          difficulty: String,
          image: String,
          tags: [String],
          isRice: { type: Boolean, default: false },  // Flag for rice items
          riceAmount: String  // "100g", "150g", "200g" (gram gạo chưa nấu)
        }],
        totalCalories: Number,
        totalProtein: Number,
        totalCarbs: Number,
        totalFat: Number,
        totalFiber: Number,
        totalCholesterol: Number,
        totalOmega3: Number,
        totalWater: Number,
        totalSaturatedFat: Number,
        totalSodium: Number
      },
      
      // Dinner - combo meal (cơm + món ăn)
      dinner: {
        items: [{  // Array of meal items (rice + dishes)
          name: String,
          description: String,
          recipeId: { type: mongoose.Schema.Types.ObjectId, ref: "recipe" },
          calories: Number,
          protein: Number,
          carbs: Number,
          fat: Number,
          fiber: Number,
          cholesterol: Number,
          omega3: Number,
          water: Number,
          saturatedFat: Number,
          sodium: Number,
          ingredients: [String],
          instructions: [String],
          preparationTime: Number,
          cookingTime: Number,
          servings: Number,
          difficulty: String,
          image: String,
          tags: [String],
          isRice: { type: Boolean, default: false },  // Flag for rice items
          riceAmount: String  // "100g", "150g", "200g" (gram gạo chưa nấu)
        }],
        totalCalories: Number,
        totalProtein: Number,
        totalCarbs: Number,
        totalFat: Number,
        totalFiber: Number,
        totalCholesterol: Number,
        totalOmega3: Number,
        totalWater: Number,
        totalSaturatedFat: Number,
        totalSodium: Number
      },
    }],
    
    // Summary statistics
    totalRecipes: { type: Number },
    avgCalories: { type: Number },
    
    // User preferences from onboarding
    userGoal: String,
    dietType: String,
    allergies: [String],
    activityLevel: String,
  },
  { timestamps: true }
);

const MealPlan = mongoose.model.MealPlan || mongoose.model("MealPlan", mealPlanSchema);
export default MealPlan;
