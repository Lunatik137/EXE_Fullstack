import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  getManualMealPickByDate,
  saveManualMealPick
} from "../controllers/manualMealPickController.js";

const manualMealPickRouter = express.Router();

manualMealPickRouter.post("/get", authMiddleware, getManualMealPickByDate);
manualMealPickRouter.post("/save", authMiddleware, saveManualMealPick);

export default manualMealPickRouter;
