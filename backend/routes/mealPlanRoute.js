import express from "express";
import { generateMealPlan, confirmMealPlan, getActiveMealPlan, getDraftMealPlan, clearDraftMealPlan } from "../controllers/mealPlanController.js";
import authMiddleware from "../middleware/auth.js";

const mealPlanRouter = express.Router();

mealPlanRouter.post("/generate", authMiddleware, generateMealPlan);
mealPlanRouter.post("/confirm", authMiddleware, confirmMealPlan);
mealPlanRouter.post("/get-active", authMiddleware, getActiveMealPlan);
mealPlanRouter.post("/get-draft", authMiddleware, getDraftMealPlan);
mealPlanRouter.post("/clear-draft", authMiddleware, clearDraftMealPlan);

export default mealPlanRouter;
