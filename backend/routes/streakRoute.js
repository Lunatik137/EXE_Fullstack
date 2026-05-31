import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  confirmMealCompletion,
  getStreakStatus,
  recoverStreak,
  updateStreakSettings,
} from "../controllers/streakController.js";

const streakRouter = express.Router();

streakRouter.post("/status", authMiddleware, getStreakStatus);
streakRouter.post("/confirm-meal", authMiddleware, confirmMealCompletion);
streakRouter.post("/settings", authMiddleware, updateStreakSettings);
streakRouter.post("/recover", authMiddleware, recoverStreak);

export default streakRouter;