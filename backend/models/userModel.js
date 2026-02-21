import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default:"user" },
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
    }
  },
  { minimize: false }
);

const userModel = mongoose.model.user || mongoose.model("user", userSchema);
export default userModel;
