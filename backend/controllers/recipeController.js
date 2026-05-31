import recipeModel from "../models/recipeModel.js";
import mongoose from "mongoose";

const normalizeVietnameseText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const isWhiteRiceRecipeName = (name = "") =>
  normalizeVietnameseText(name).includes("com trang");

// Get all recipes with optional filters
const getAllRecipes = async (req, res) => {
  try {
    const { 
      category, 
      dietType, 
      difficulty, 
      search, 
      excludeAllergens,
      tags,
      page = 1, 
      limit = 12,
      all
    } = req.query;

    // Build filter object
    const filter = {};

    if (category) filter.category = category;
    if (dietType) filter.dietType = dietType;
    if (difficulty) filter.difficulty = difficulty;
    if (tags) filter.tags = { $in: tags.split(',') };
    
    // Exclude recipes with certain allergens
    if (excludeAllergens) {
      const allergensList = excludeAllergens.split(',');
      filter.allergens = { $nin: allergensList };
    }

    // Search by name, description, tags, or ingredients
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
        { ingredients: { $regex: search, $options: 'i' } }
      ];
    }

    let recipes, total;
    if (all === 'true' || parseInt(limit) === 0) {
      // Return all recipes without pagination
      recipes = await recipeModel
        .find(filter)
        .sort({ isPopular: -1, createdAt: -1 });
      total = recipes.length;
      res.json({
        success: true,
        recipes,
        pagination: {
          total,
          page: 1,
          pages: 1,
          limit: total
        }
      });
    } else {
      // Pagination
      const skip = (page - 1) * limit;
      recipes = await recipeModel
        .find(filter)
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ isPopular: -1, createdAt: -1 });
      total = await recipeModel.countDocuments(filter);
      res.json({
        success: true,
        recipes,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching recipes" });
  }
};

// Get single recipe by ID
const getRecipeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.json({ success: false, message: "Invalid recipe id" });
    }

    const recipe = await recipeModel.findById(id);

    if (!recipe) {
      return res.json({ success: false, message: "Recipe not found" });
    }

    res.json({ success: true, recipe });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching recipe" });
  }
};

// Get free recipes (10 dedicated free recipes + all white-rice recipes)
const getFreeRecipes = async (req, res) => {
  try {
    const explicitlyFreeRecipes = await recipeModel
      .find({ isFree: true })
      .sort({ isPopular: -1, createdAt: -1 });

    const nonRiceFreeRecipes = explicitlyFreeRecipes
      .filter((recipe) => !isWhiteRiceRecipeName(recipe.name));

    const whiteRiceRecipesFromFree = explicitlyFreeRecipes
      .filter((recipe) => isWhiteRiceRecipeName(recipe.name));

    const whiteRiceRecipesByName = await recipeModel
      .find({ name: { $regex: /c(ơ|o)m\s*tr(ắ|ă|a)ng/i } })
      .sort({ createdAt: -1 });

    const uniqueById = new Map();
    [...nonRiceFreeRecipes, ...whiteRiceRecipesFromFree, ...whiteRiceRecipesByName].forEach((recipe) => {
      uniqueById.set(String(recipe._id), recipe);
    });

    const recipes = [...uniqueById.values()];
    res.json({ success: true, recipes });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: 'Error fetching free recipes' });
  }
};

// Get popular recipes
const getPopularRecipes = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const recipes = await recipeModel
      .find({ isPopular: true })
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({ success: true, recipes });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching popular recipes" });
  }
};

// Get recipes by category
const getRecipesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 12, all } = req.query;

    let query = recipeModel.find({ category }).sort({ isPopular: -1, createdAt: -1 });
    if (!(all === 'true' || parseInt(limit) === 0)) {
      query = query.limit(parseInt(limit));
    }
    const recipes = await query;
    res.json({ success: true, recipes, category });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching recipes by category" });
  }
};

// Get recipes by cooking method
const getRecipesByCookingMethod = async (req, res) => {
  try {
    const { method } = req.params;
    const { limit = 50, all } = req.query;

    let query = recipeModel.find({ cookingMethod: method }).sort({ isPopular: -1, createdAt: -1 });
    if (!(all === 'true' || parseInt(limit) === 0)) {
      query = query.limit(parseInt(limit));
    }
    const recipes = await query;
    res.json({ success: true, recipes, cookingMethod: method });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching recipes by cooking method" });
  }
};

// Get recipe statistics
const getRecipeStats = async (req, res) => {
  try {
    const totalRecipes = await recipeModel.countDocuments();
    const breakfastCount = await recipeModel.countDocuments({ category: 'breakfast' });
    const lunchCount = await recipeModel.countDocuments({ category: 'lunch' });
    const dinnerCount = await recipeModel.countDocuments({ category: 'dinner' });
    const popularCount = await recipeModel.countDocuments({ isPopular: true });
    const freeCount = await recipeModel.countDocuments({ isFree: true });

    // Get all unique tags
    const allRecipes = await recipeModel.find({}, 'tags');
    const allTags = [...new Set(allRecipes.flatMap(r => r.tags))];

    res.json({
      success: true,
      stats: {
        total: totalRecipes,
        breakfast: breakfastCount,
        lunch: lunchCount,
        dinner: dinnerCount,
        popular: popularCount,
        free: freeCount,
        tags: allTags
      }
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching recipe statistics" });
  }
};

// Search recipes with advanced filters
const searchRecipes = async (req, res) => {
  try {
    const {
      query,
      category,
      maxCalories,
      minProtein,
      maxCookingTime,
      difficulty,
      excludeAllergens
    } = req.query;

    const filter = {};

    // Text search
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ];
    }

    // Filters
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (maxCalories) filter.calories = { $lte: parseInt(maxCalories) };
    if (minProtein) filter.protein = { $gte: parseInt(minProtein) };
    if (maxCookingTime) filter.cookingTime = { $lte: parseInt(maxCookingTime) };
    
    if (excludeAllergens) {
      const allergensList = excludeAllergens.split(',');
      filter.allergens = { $nin: allergensList };
    }

    const recipes = await recipeModel
      .find(filter)
      .limit(50)
      .sort({ isPopular: -1, calories: 1 });

    res.json({ success: true, recipes, count: recipes.length });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error searching recipes" });
  }
};

export {
  getAllRecipes,
  getRecipeById,
  getPopularRecipes,
  getFreeRecipes,
  getRecipesByCategory,
  getRecipesByCookingMethod,
  getRecipeStats,
  searchRecipes
};
