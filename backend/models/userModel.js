import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "user" },
    avatar: { type: String, default: "" },
    cartData: { type: Object, default: {} },

    // Onboarding fields
    hasCompletedOnboarding: { type: Boolean, default: false },
    onboardingData: {
      age: { type: Number },
      gender: { type: String },
      height: { type: Number },
      weight: { type: Number },
      goal: { type: String },
      targetWeight: { type: Number },
      targetDuration: { type: String },
      healthConditions: [{ type: String }],
      healthConditionsOther: { type: String },
      dietType: { type: String },
      dietTypeOther: { type: String },
      allergies: [{ type: String }],
      allergiesOther: { type: String },
      dislikes: { type: String },
      activityLevel: { type: String },
    },
    // Nutrition Targets (calculated during onboarding)
    nutritionTargets: {
      tdee: { type: Number },
      calories: { type: Number },
      protein: { type: Number },
      fat: { type: Number },
      carbs: { type: Number },
      fiber: { type: Number },
    },
    mealReminderSettings: {
      enabled: { type: Boolean, default: false },
      breakfastTime: { type: String, default: "" },
      lunchTime: { type: String, default: "" },
      dinnerTime: { type: String, default: "" },
    },

    // Plan/Subscription fields
    planType: { type: String, enum: ["free", "premium"], default: "free" },
    subscriptionStatus: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },
    subscriptionStartDate: { type: Date },
    subscriptionEndDate: { type: Date },
     // PayOS pending payment tracking
     pendingPaymentOrderCode: { type: String, default: null },
     pendingPaymentPackage: { type: String, default: null },
     pendingVoucherCode: { type: String, default: null },
     premiumPackage: { type: String, default: null },
    coupleShareCode: { type: String, default: null },
    coupleShareCodeUsed: { type: Boolean, default: false },
    coupleShareCodeUsedAt: { type: Date, default: null },
    coupleSharedWithUserId: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    coupleSharedFromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  },
  { minimize: false, timestamps: true },
);

const userModel = mongoose.model.user || mongoose.model("user", userSchema);
export default userModel;
