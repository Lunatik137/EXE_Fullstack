import express from "express";
import { loginUser, registerUser, saveOnboarding, getUserProfile, updateProfile } from "../controllers/userController.js";
import authMiddleware from "../middleware/auth.js";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/onboarding", authMiddleware, saveOnboarding);
userRouter.post("/profile", authMiddleware, getUserProfile);
userRouter.post("/update-profile", authMiddleware, updateProfile);

export default userRouter;
