import mongoose from "mongoose";

const recipeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true }, // breakfast, lunch, dinner, snack
    cookingMethod: { type: String, default: "xao" }, // xao, luoc, nuong, kho, canh, tron, hap, chien
    dietType: { type: String, default: "vegan" }, // vegan, vegetarian

    // Nutrition information
    calories: { type: Number, required: true },
    protein: { type: Number, required: true }, // grams
    carbs: { type: Number, required: true }, // grams
    fat: { type: Number, required: true }, // grams
    fiber: { type: Number, default: 0 }, // grams

    // Heart health nutrition
    cholesterol: { type: Number, default: 0 }, // mg
    omega3: { type: Number, default: 0 }, // grams
    water: { type: Number, default: 0 }, // ml
    saturatedFat: { type: Number, default: 0 }, // grams
    sodium: { type: Number, default: 0 }, // mg

    // Recipe details
    ingredients: [{ type: String, required: true }],
    instructions: [{ type: String, required: true }],
    preparationTime: { type: Number, required: true }, // minutes
    cookingTime: { type: Number, required: true }, // minutes
    servings: { type: Number, default: 2 },
    difficulty: { type: String, default: "medium" }, // easy, medium, hard

    // Allergen information
    allergens: [{ type: String }], // e.g., 'nuts', 'soy', 'gluten', 'seeds'

    // Additional info
    image: { type: String, default: "" },
    tags: [{ type: String }], // e.g., 'quick', 'high-protein', 'low-carb', 'gluten-free'

    // For meal planning
    isPopular: { type: Boolean, default: false },
    isFree: { type: Boolean, default: false },
    season: [{ type: String }], // spring, summer, fall, winter, all-season
  },
  { timestamps: true },
);

const recipeModel =
  mongoose.models.recipe || mongoose.model("recipe", recipeSchema);

export default recipeModel;
