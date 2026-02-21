import express from "express";
import { generateMealPlan, confirmMealPlan, getActiveMealPlan } from "../controllers/mealPlanController.js";
import authMiddleware from "../middleware/auth.js";

const mealPlanRouter = express.Router();

mealPlanRouter.post("/generate", authMiddleware, generateMealPlan);
mealPlanRouter.post("/confirm", authMiddleware, confirmMealPlan);
mealPlanRouter.post("/get-active", authMiddleware, getActiveMealPlan);

export default mealPlanRouter;
