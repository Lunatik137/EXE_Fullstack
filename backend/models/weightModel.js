import mongoose from "mongoose";

const weightSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    weight: { type: Number, required: true }, // in kg
    date: { type: Date, default: Date.now },
    note: { type: String }
  },
  { timestamps: true }
);

// Index for faster queries
weightSchema.index({ userId: 1, date: -1 });

const weightModel = mongoose.models.weight || mongoose.model("weight", weightSchema);
export default weightModel;
