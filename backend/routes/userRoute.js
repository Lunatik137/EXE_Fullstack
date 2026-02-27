import express from "express";
import { loginUser, registerUser, saveOnboarding, getUserProfile, updateProfile, selectPlan, getCurrentPlan, confirmPremium } from "../controllers/userController.js";
import authMiddleware from "../middleware/auth.js";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/onboarding", authMiddleware, saveOnboarding);
userRouter.get("/profile", authMiddleware, getUserProfile);
userRouter.post("/profile", authMiddleware, getUserProfile);
userRouter.post("/update-profile", authMiddleware, updateProfile);

// Plan selection and management
userRouter.post("/select-plan", authMiddleware, selectPlan);
userRouter.get("/current-plan", authMiddleware, getCurrentPlan);
userRouter.post("/confirm-premium", authMiddleware, confirmPremium);

export default userRouter;
