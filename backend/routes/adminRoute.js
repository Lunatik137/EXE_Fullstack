import express from "express";
import multer from "multer";
import adminAuth from "../middleware/adminAuth.js";
import {
  getDashboardStats,
  getAllUsers,
  getUserDetail,
  updateUserRole,
  updateUserPlan,
  deleteUser,
  getAllFoods,
  addFood,
  updateFood,
  deleteFood,
  getAllOrders,
  updateOrderStatus,
  getAllPosts,
  deletePost,
  getAllRecipes,
  updateRecipe,
  deleteRecipe,
  addDoctor,
  getAllDoctors,
  updateDoctor,
  deleteDoctor,
  getAllConsultations,
} from "../controllers/adminController.js";
import { listVouchers, createVoucher, toggleVoucher, deleteVoucher } from "../controllers/voucherController.js";

const adminRouter = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/foods",
  filename: (req, file, cb) => cb(null, `${Date.now()}${file.originalname}`),
});
const upload = multer({ storage });

const doctorStorage = multer.diskStorage({
  destination: "uploads/doctors",
  filename: (req, file, cb) => cb(null, `${Date.now()}${file.originalname}`),
});
const uploadDoctor = multer({ storage: doctorStorage });

const recipeStorage = multer.diskStorage({
  destination: "uploads/recipes",
  filename: (req, file, cb) => cb(null, `${Date.now()}${file.originalname}`),
});
const uploadRecipe = multer({ storage: recipeStorage });

// All routes require admin auth
adminRouter.use(adminAuth);

// Dashboard
adminRouter.get("/stats", getDashboardStats);

// Users
adminRouter.get("/users", getAllUsers);
adminRouter.get("/users/:id", getUserDetail);
adminRouter.patch("/users/:id/role", updateUserRole);
adminRouter.patch("/users/:id/plan", updateUserPlan);
adminRouter.delete("/users/:id", deleteUser);

// Foods
adminRouter.get("/foods", getAllFoods);
adminRouter.post("/foods", upload.single("image"), addFood);
adminRouter.put("/foods/:id", upload.single("image"), updateFood);
adminRouter.delete("/foods/:id", deleteFood);

// Orders
adminRouter.get("/orders", getAllOrders);
adminRouter.patch("/orders/:id/status", updateOrderStatus);

// Posts
adminRouter.get("/posts", getAllPosts);
adminRouter.delete("/posts/:id", deletePost);

// Recipes
adminRouter.get("/recipes", getAllRecipes);
adminRouter.put("/recipes/:id", uploadRecipe.single("image"), updateRecipe);
adminRouter.delete("/recipes/:id", deleteRecipe);

// Doctors
adminRouter.get("/doctors", getAllDoctors);
adminRouter.post("/doctors", uploadDoctor.single("image"), addDoctor);
adminRouter.put("/doctors/:id", updateDoctor);
adminRouter.delete("/doctors/:id", deleteDoctor);

// Consultations
adminRouter.get("/consultations", getAllConsultations);

// Vouchers
adminRouter.get("/vouchers", listVouchers);
adminRouter.post("/vouchers", createVoucher);
adminRouter.patch("/vouchers/:id/toggle", toggleVoucher);
adminRouter.delete("/vouchers/:id", deleteVoucher);

export default adminRouter;
