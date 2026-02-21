import recipeModel from "../models/recipeModel.js";

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
      limit = 12 
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

    // Search by name or description
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;
    
    const recipes = await recipeModel
      .find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ isPopular: -1, createdAt: -1 });

    const total = await recipeModel.countDocuments(filter);

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
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching recipes" });
  }
};

// Get single recipe by ID
const getRecipeById = async (req, res) => {
  try {
    const { id } = req.params;

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
    const { limit = 12 } = req.query;

    const recipes = await recipeModel
      .find({ category })
      .limit(parseInt(limit))
      .sort({ isPopular: -1, createdAt: -1 });

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
    const { limit = 50 } = req.query;

    const recipes = await recipeModel
      .find({ cookingMethod: method })
      .limit(parseInt(limit))
      .sort({ isPopular: -1, createdAt: -1 });

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
  getRecipesByCategory,
  getRecipesByCookingMethod,
  getRecipeStats,
  searchRecipes
};
