import mongoose from "mongoose";

const manualMealPickSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    dateKey: { type: String, required: true },
    date: { type: Date, required: true },
    source: {
      type: String,
      enum: ["free-tier", "premium-future-manual"],
      default: "free-tier"
    },
    picks: {
      breakfast: { type: mongoose.Schema.Types.ObjectId, ref: "recipe", default: null },
      lunch: [{ type: mongoose.Schema.Types.ObjectId, ref: "recipe" }],
      dinner: [{ type: mongoose.Schema.Types.ObjectId, ref: "recipe" }]
    }
  },
  { timestamps: true }
);

manualMealPickSchema.index({ userId: 1, dateKey: 1 }, { unique: true });

const manualMealPickModel =
  mongoose.models.manualMealPick || mongoose.model("manualMealPick", manualMealPickSchema);

export default manualMealPickModel;
