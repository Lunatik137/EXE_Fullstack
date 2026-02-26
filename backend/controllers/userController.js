import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";

// login user

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User Doesn't exist" });
    }
    const isMatch =await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid Credentials" });
    }
    const role=user.role;
    const token = createToken(user._id, role);
    res.json({ 
      success: true, 
      token,
      role,
      user: {
        hasCompletedOnboarding: user.hasCompletedOnboarding
      }
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// Create token

const createToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET);
};

// register user

const registerUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    // checking user is already exist
    const exists = await userModel.findOne({ email });
    if (exists) {
      return res.json({ success: false, message: "User already exists" });
    }

    // validating email format and strong password
    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Please enter valid email" });
    }
    if (password.length < 8) {
      return res.json({
        success: false,
        message: "Please enter strong password",
      });
    }

    // hashing user password

    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashedPassword = await bcrypt.hash(password, salt);

    // Use email prefix as temporary name (will be updated during onboarding)
    const tempName = email.split('@')[0];

    const newUser = new userModel({
      name: tempName,
      email: email,
      password: hashedPassword,
    });

    const user = await newUser.save();
    const role = user.role;
    const token = createToken(user._id, role);
    res.json({ success: true, token, role});
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// Save onboarding data
const saveOnboarding = async (req, res) => {
  try {
    const userId = req.body.userId;
    const onboardingData = req.body;
    
    // Extract name to update the user's name field
    const userName = onboardingData.name;
    
    // Remove userId from onboardingData before saving
    delete onboardingData.userId;
    
    await userModel.findByIdAndUpdate(userId, {
      name: userName, // Update the user's name from onboarding
      hasCompletedOnboarding: true,
      onboardingData: onboardingData
    }); 
    
    res.json({ success: true, message: "Onboarding completed successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error saving onboarding data" });
  }
};

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const userId = req.body.userId;
    const user = await userModel.findById(userId).select('-password');
    
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching user profile" });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { name, email, phone, location, onboardingData } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (location) updateData.location = location;
    if (onboardingData) updateData.onboardingData = onboardingData;
    
    const user = await userModel.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');
    
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }
    
    res.json({ success: true, message: "Profile updated successfully", user });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error updating profile" });
  }
};

// Select plan (Basic/Premium)
const selectPlan = async (req, res) => {
  try {
    const { planType } = req.body;
    const userId = req.body.userId;

    if (!planType || !['free', 'premium'].includes(planType)) {
      return res.json({ success: false, message: "Invalid plan type" });
    }

    const updateData = { planType };

    // If premium, set subscription dates (30 days from now)
    if (planType === 'premium') {
      updateData.subscriptionStatus = 'active';
      updateData.subscriptionStartDate = new Date();
      updateData.subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const user = await userModel.findByIdAndUpdate(userId, updateData, { new: true });

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: `Selected ${planType} plan`, user });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error selecting plan" });
  }
};

// Get user's current plan
const getCurrentPlan = async (req, res) => {
  try {
    const userId = req.body.userId;
    const user = await userModel.findById(userId).select('planType subscriptionStatus');

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    res.json({ 
      success: true, 
      planType: user.planType || 'free',
      subscriptionStatus: user.subscriptionStatus
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching plan" });
  }
};

// Confirm premium (payment completed)
const confirmPremium = async (req, res) => {
  try {
    const { planType } = req.body;
    const userId = req.body.userId;

    if (planType !== 'premium') {
      return res.json({ success: false, message: "Invalid plan type for confirmation" });
    }

    const updateData = {
      planType: 'premium',
      subscriptionStatus: 'active',
      subscriptionStartDate: new Date(),
      subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };

    const user = await userModel.findByIdAndUpdate(userId, updateData, { new: true });

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "Premium plan activated", user });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error confirming premium" });
  }
};

export { loginUser, registerUser, saveOnboarding, getUserProfile, updateProfile, selectPlan, getCurrentPlan, confirmPremium };
