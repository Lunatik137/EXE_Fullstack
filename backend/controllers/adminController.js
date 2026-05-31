import userModel from "../models/userModel.js";
import orderModel from "../models/orderModel.js";
import foodModel from "../models/foodModel.js";
import postModel from "../models/postModel.js";
import recipeModel from "../models/recipeModel.js";
import doctorModel from "../models/doctorModel.js";
import mealPlanModel from "../models/mealPlanModel.js";
import consultationModel from "../models/consultationModel.js";
import fs from "fs";

// ─── DASHBOARD STATS ────────────────────────────────────────────────────────

const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      premiumUsers,
      totalOrders,
      pendingOrders,
      totalFoods,
      totalPosts,
      totalRecipes,
      totalDoctors,
      totalMealPlans,
      totalConsultations,
    ] = await Promise.all([
      userModel.countDocuments(),
      userModel.countDocuments({ planType: "premium" }),
      orderModel.countDocuments(),
      orderModel.countDocuments({ status: "Food Processing" }),
      foodModel.countDocuments(),
      postModel.countDocuments(),
      recipeModel.countDocuments(),
      doctorModel.countDocuments(),
      mealPlanModel.countDocuments(),
      consultationModel.countDocuments(),
    ]);

    // Revenue from paid orders
    const revenueResult = await orderModel.aggregate([
      { $match: { payment: true } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // New users last 7 days — use ObjectId timestamp (works even without timestamps: true on old docs)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsersThisWeek = await userModel.countDocuments({
      $expr: { $gte: [{ $toDate: "$_id" }, sevenDaysAgo] },
    });

    // Last 6 months window
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // User registration growth (last 6 months) using ObjectId timestamp
    const userGrowth = await userModel.aggregate([
      { $match: { $expr: { $gte: [{ $toDate: "$_id" }, sixMonthsAgo] } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: { $toDate: "$_id" } } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Premium subscription growth (paid plans only, last 6 months)
    const premiumGrowth = await userModel.aggregate([
      {
        $match: {
          planType: "premium",
          premiumPackage: { $nin: ["premium-trial-3-day", null] },
          subscriptionStartDate: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$subscriptionStartDate" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        premiumUsers,
        freeUsers: totalUsers - premiumUsers,
        totalOrders,
        pendingOrders,
        totalFoods,
        totalPosts,
        totalRecipes,
        totalDoctors,
        totalMealPlans,
        totalConsultations,
        totalRevenue,
        newUsersThisWeek,
        userGrowth,
        premiumGrowth,
      },
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching stats" });
  }
};

// ─── USER MANAGEMENT ────────────────────────────────────────────────────────

const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";
    const role = req.query.role || "";
    const planType = req.query.planType || "";

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role) filter.role = role;
    if (planType) filter.planType = planType;

    const total = await userModel.countDocuments(filter);
    const users = await userModel
      .find(filter)
      .select("-password -cartData")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, users, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching users" });
  }
};

const getUserDetail = async (req, res) => {
  try {
    const user = await userModel
      .findById(req.params.id)
      .select("-password -cartData");
    if (!user) return res.json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      return res.json({ success: false, message: "Invalid role" });
    }
    const user = await userModel.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password");
    res.json({ success: true, user, message: "Role updated" });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

const updateUserPlan = async (req, res) => {
  try {
    const { planType, subscriptionEndDate } = req.body;
    const update = { planType };
    if (subscriptionEndDate) update.subscriptionEndDate = subscriptionEndDate;
    if (planType === "premium") {
      update.subscriptionStatus = "active";
      if (!subscriptionEndDate) {
        const end = new Date();
        end.setMonth(end.getMonth() + 1);
        update.subscriptionEndDate = end;
      }
    } else {
      update.subscriptionStatus = "expired";
    }
    const user = await userModel.findByIdAndUpdate(req.params.id, update, { new: true }).select("-password");
    res.json({ success: true, user, message: "Plan updated" });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

const deleteUser = async (req, res) => {
  try {
    await userModel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "User deleted" });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

// ─── FOOD MANAGEMENT ────────────────────────────────────────────────────────

const getAllFoods = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";
    const category = req.query.category || "";

    const filter = {};
    if (search) filter.name = { $regex: search, $options: "i" };
    if (category) filter.category = category;

    const total = await foodModel.countDocuments(filter);
    const foods = await foodModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, foods, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

const addFood = async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, message: "Image required" });
    const food = new foodModel({
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
      image: req.file.filename,
    });
    await food.save();
    res.json({ success: true, food, message: "Food added" });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

const updateFood = async (req, res) => {
  try {
    const update = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
    };
    if (req.file) update.image = req.file.filename;
    const food = await foodModel.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, food, message: "Food updated" });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

const deleteFood = async (req, res) => {
  try {
    const food = await foodModel.findById(req.params.id);
    if (!food) return res.json({ success: false, message: "Not found" });
    if (food.image) fs.unlink(`uploads/${food.image}`, () => {});
    await foodModel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Food deleted" });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

// ─── ORDER MANAGEMENT ───────────────────────────────────────────────────────

const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || "";
    const payment = req.query.payment;

    const filter = {};
    if (status) filter.status = status;
    if (payment !== undefined && payment !== "") filter.payment = payment === "true";

    const total = await orderModel.countDocuments(filter);
    const orders = await orderModel
      .find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, orders, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      "Food Processing",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.json({ success: false, message: "Invalid status" });
    }
    const order = await orderModel.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json({ success: true, order, message: "Status updated" });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

// ─── POST MANAGEMENT ────────────────────────────────────────────────────────

const getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";
    const type = req.query.type || "";

    const filter = {};
    if (search) filter.content = { $regex: search, $options: "i" };
    if (type) filter.type = type;

    const total = await postModel.countDocuments(filter);
    const posts = await postModel
      .find(filter)
      .populate("userId", "name email avatar")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, posts, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

const deletePost = async (req, res) => {
  try {
    await postModel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Post deleted" });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

// ─── RECIPE MANAGEMENT ──────────────────────────────────────────────────────

const getAllRecipes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";
    const category = req.query.category || "";

    const filter = {};
    if (search) filter.name = { $regex: search, $options: "i" };
    if (category) filter.category = category;

    const total = await recipeModel.countDocuments(filter);
    const recipes = await recipeModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, recipes, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

const updateRecipe = async (req, res) => {
  try {
    const update = { ...req.body };
    if (req.file) update.image = req.file.filename;
    const recipe = await recipeModel.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, recipe, message: "Recipe updated" });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

const deleteRecipe = async (req, res) => {
  try {
    await recipeModel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Recipe deleted" });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

// ─── DOCTOR MANAGEMENT ──────────────────────────────────────────────────────

const addDoctor = async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, message: "Ảnh bác sĩ là bắt buộc" });
    const { name, title, specialty, bio, detail, order } = req.body;
    const parseLines = (val) => {
      if (!val) return [];
      try { return JSON.parse(val); } catch { return String(val).split('\n').filter(Boolean); }
    };
    const doctor = new doctorModel({
      name, title, specialty,
      bio: bio || "",
      detail: detail || "",
      image: req.file.filename,
      order: order ? Number(order) : 0,
      positions: parseLines(req.body.positions),
      education: parseLines(req.body.education),
      experience: parseLines(req.body.experience),
      expertise: parseLines(req.body.expertise),
      workplaces: parseLines(req.body.workplaces),
    });
    await doctor.save();
    res.json({ success: true, doctor, message: "Đã thêm bác sĩ" });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Lỗi thêm bác sĩ" });
  }
};

const getAllDoctors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { specialization: { $regex: search, $options: "i" } },
      ];
    }

    const total = await doctorModel.countDocuments(filter);
    const doctors = await doctorModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, doctors, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

const updateDoctor = async (req, res) => {
  try {
    const doctor = await doctorModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, doctor, message: "Doctor updated" });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

const deleteDoctor = async (req, res) => {
  try {
    await doctorModel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Doctor deleted" });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

// ─── CONSULTATION MANAGEMENT ─────────────────────────────────────────────────

const getAllConsultations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || "";

    const filter = {};
    if (status) filter.status = status;

    const total = await consultationModel.countDocuments(filter);
    const consultations = await consultationModel
      .find(filter)
      .populate("userId", "name email avatar")
      .populate("doctorId", "name specialization")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, consultations, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

export {
  getDashboardStats,
  // Users
  getAllUsers,
  getUserDetail,
  updateUserRole,
  updateUserPlan,
  deleteUser,
  // Foods
  getAllFoods,
  addFood,
  updateFood,
  deleteFood,
  // Orders
  getAllOrders,
  updateOrderStatus,
  // Posts
  getAllPosts,
  deletePost,
  // Recipes
  getAllRecipes,
  updateRecipe,
  deleteRecipe,
  // Doctors
  addDoctor,
  getAllDoctors,
  updateDoctor,
  deleteDoctor,
  // Consultations
  getAllConsultations,
};
