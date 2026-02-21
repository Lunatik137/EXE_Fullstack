import express from "express";
import {
  getAllRecipes,
  getRecipeById,
  getPopularRecipes,
  getRecipesByCategory,
  getRecipesByCookingMethod,
  getRecipeStats,
  searchRecipes
} from "../controllers/recipeController.js";

const recipeRouter = express.Router();

// Get all recipes with filters
recipeRouter.get("/", getAllRecipes);

// Get all recipes (alternative endpoint)
recipeRouter.get("/all", getAllRecipes);

// Get recipe statistics
recipeRouter.get("/stats", getRecipeStats);

// Get popular recipes
recipeRouter.get("/popular", getPopularRecipes);

// Search recipes
recipeRouter.get("/search", searchRecipes);

// Get recipes by category
recipeRouter.get("/category/:category", getRecipesByCategory);

// Get recipes by cooking method
recipeRouter.get("/method/:method", getRecipesByCookingMethod);

// Get single recipe by ID
recipeRouter.get("/:id", getRecipeById);

export default recipeRouter;
