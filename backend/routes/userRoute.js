import express from "express";
import { loginUser, sendRegisterVerificationCode, registerUser, saveOnboarding, getUserProfile, updateProfile, selectPlan, getCurrentPlan, confirmPremium, redeemCoupleShareCode, searchUsers, getUserPublicProfile, followUser, unfollowUser } from "../controllers/userController.js";
import authMiddleware from "../middleware/auth.js";
import multer from "multer";

const userRouter = express.Router();

const storage = multer.diskStorage({
  destination: "uploads",
  filename: (req, file, cb) => {
    return cb(null, `${Date.now()}${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

userRouter.post("/send-register-code", sendRegisterVerificationCode);
userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.get("/search", searchUsers);
userRouter.get("/:userId/profile", getUserPublicProfile);
userRouter.post("/onboarding", authMiddleware, saveOnboarding);
userRouter.post("/profile", authMiddleware, getUserProfile);
userRouter.post("/update-profile", authMiddleware, upload.single("avatar"), updateProfile);

// Plan selection and management
userRouter.post("/select-plan", authMiddleware, selectPlan);
userRouter.get("/current-plan", authMiddleware, getCurrentPlan);
userRouter.post("/confirm-premium", authMiddleware, confirmPremium);
userRouter.post("/redeem-couple-code", authMiddleware, redeemCoupleShareCode);
userRouter.post("/:targetId/follow", authMiddleware, followUser);
userRouter.post("/:targetId/unfollow", authMiddleware, unfollowUser);

export default userRouter;
