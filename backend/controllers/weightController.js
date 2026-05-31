import weightModel from "../models/weightModel.js";
import userModel from "../models/userModel.js";

// Add a new weight entry
const addWeight = async (req, res) => {
  try {
    const { weight, date, note } = req.body;
    
    if (!weight || weight <= 0) {
      return res.json({ success: false, message: "Invalid weight value" });
    }

    const newWeight = new weightModel({
      userId: req.body.userId,
      weight,
      date: date ? new Date(date) : new Date(),
      note
    });

    await newWeight.save();

    // Update user's current weight in onboardingData
    await userModel.findByIdAndUpdate(req.body.userId, {
      'onboardingData.weight': weight
    });

    res.json({ success: true, message: "Weight recorded successfully", weight: newWeight });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error recording weight" });
  }
};

// Get weight history for user
const getWeightHistory = async (req, res) => {
  try {
    const userId = req.body.userId;
    
    const weights = await weightModel
      .find({ userId })
      .sort({ date: -1 })
      .limit(100); // Limit to last 100 entries

    res.json({ success: true, weights });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching weight history" });
  }
};

// Get latest weight
const getLatestWeight = async (req, res) => {
  try {
    const userId = req.body.userId;
    
    const latestWeight = await weightModel
      .findOne({ userId })
      .sort({ date: -1 });

    res.json({ success: true, weight: latestWeight });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching latest weight" });
  }
};

// Delete weight entry
const deleteWeight = async (req, res) => {
  try {
    const { weightId } = req.body;
    
    await weightModel.findByIdAndDelete(weightId);
    
    res.json({ success: true, message: "Weight entry deleted" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error deleting weight entry" });
  }
};

export { addWeight, getWeightHistory, getLatestWeight, deleteWeight };
