import mongoose from "mongoose";

const mealStatusSchema = new mongoose.Schema(
  {
    confirmedAt: { type: Date },
  },
  { _id: false }
);

const mealRecordSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true },
    mealPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "MealPlan" },
    meals: {
      breakfast: { type: mealStatusSchema, default: () => ({}) },
      lunch: { type: mealStatusSchema, default: () => ({}) },
      dinner: { type: mealStatusSchema, default: () => ({}) },
    },
  },
  { _id: false }
);

const recoveryUsageSchema = new mongoose.Schema(
  {
    monthKey: { type: String, required: true },
    recoveredDateKey: { type: String, required: true },
    usedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const streakSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, unique: true },
    settings: {
      confirmationWindowMinutes: { type: Number, default: 180, min: 30, max: 720 },
    },
    mealRecords: {
      type: [mealRecordSchema],
      default: [],
    },
    recoveredDates: {
      type: [String],
      default: [],
    },
    recoveryUsage: {
      type: [recoveryUsageSchema],
      default: [],
    },
    stats: {
      currentStreak: { type: Number, default: 0 },
      longestStreak: { type: Number, default: 0 },
      lastQualifiedDateKey: { type: String, default: null },
      lastMissedDateKey: { type: String, default: null },
    },
  },
  { timestamps: true }
);

const Streak = mongoose.models.Streak || mongoose.model("Streak", streakSchema);

export default Streak;