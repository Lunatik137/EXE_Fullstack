import userModel from "../models/userModel.js";
import weightModel from "../models/weightModel.js";
import referralCodeModel from "../models/referralCodeModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import { notifyNewFollow } from "./notificationController.js";

// login user

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "Email không tồn tại" });
    }
    const isMatch =await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Mật khẩu không đúng" });
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
  const { email, password, referralCode } = req.body;
  try {
    // checking user is already exist
    const exists = await userModel.findOne({ email });
    if (exists) {
      return res.json({ success: false, message: "Email này đã được đăng ký" });
    }

    // validating email format and strong password
    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Email không hợp lệ" });
    }
    if (password.length < 8) {
      return res.json({
        success: false,
        message: "Mật khẩu phải có ít nhất 8 ký tự",
      });
    }

    const normalizedReferralCode = String(referralCode || "")
      .trim()
      .toUpperCase();

    if (!normalizedReferralCode) {
      return res.json({
        success: false,
        message: "Vui lòng nhập mã giới thiệu",
      });
    }

    const referralExists = await referralCodeModel.findOne({
      code: normalizedReferralCode,
      isActive: true,
      isUsed: false,
    });

    if (!referralExists) {
      return res.json({
        success: false,
        message: "Mã giới thiệu không hợp lệ hoặc đã được sử dụng",
      });
    }

    // hashing user password

    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashedPassword = await bcrypt.hash(password, salt);

    // Use email prefix as temporary name (will be updated during onboarding)
    const tempName = email.split('@')[0];
    const now = new Date();
    const trialDurationDays = 7;
    const trialEndDate = new Date(now.getTime() + trialDurationDays * 24 * 60 * 60 * 1000);

    const newUser = new userModel({
      name: tempName,
      email: email,
      password: hashedPassword,
      planType: 'premium',
      premiumPackage: 'premium-trial-7-day',
      subscriptionStatus: 'active',
      subscriptionStartDate: now,
      subscriptionEndDate: trialEndDate,
    });

    const user = await newUser.save();

    const referralUpdated = await referralCodeModel.findOneAndUpdate(
      {
        code: normalizedReferralCode,
        isActive: true,
        isUsed: false,
      },
      {
        $set: {
          isUsed: true,
          usedBy: user._id,
          usedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!referralUpdated) {
      await userModel.deleteOne({ _id: user._id });
      return res.json({
        success: false,
        message: "Mã giới thiệu không hợp lệ hoặc đã được sử dụng",
      });
    }

    const role = user.role;
    const token = createToken(user._id, role);
    res.json({ success: true, token, role});
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// Calculate personalized nutrition targets — Mifflin-St Jeor, matches mealPlanController
const parseDurationToWeeks = (duration) => {
  if (!duration) return 12;
  const val = parseFloat(duration);
  if (isNaN(val) || val <= 0) return 12;
  if (duration.endsWith('y')) return val * 52;
  if (duration.endsWith('m')) return val * 4.33;
  if (duration.endsWith('w')) return val;
  return 12;
};

const calculateNutritionTargets = ({ age, gender, height, weight, activityLevel, goal, targetWeight, targetDuration }) => {
  const w = parseFloat(weight) || 70;
  const h = parseFloat(height) || 170;
  const a = parseFloat(age) || 25;
  const normalizedGender = String(gender || '').trim().toLowerCase();
  const normalizedGoal = String(goal || '').trim().toLowerCase();

  let bmr;
  if (normalizedGender === 'male') {
    bmr = 10 * w + 6.25 * h - 5 * a + 5;
  } else if (normalizedGender === 'female') {
    bmr = 10 * w + 6.25 * h - 5 * a - 161;
  } else {
    bmr = 10 * w + 6.25 * h - 5 * a - 78;
  }

  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9, veryActive: 1.9 };
  const tdee = Math.round(bmr * (multipliers[activityLevel] || 1.375));
  let calories = tdee;

  if (normalizedGoal === 'lose') {
    if (targetWeight && targetDuration) {
      const weeks = parseDurationToWeeks(targetDuration);
      const dailyDeficit = Math.round((parseFloat(targetWeight) / weeks * 7700) / 7);
      calories = Math.max(1200, tdee - dailyDeficit);
    } else {
      calories = Math.max(1200, tdee - 500);
    }
  } else if (normalizedGoal === 'gain') {
    if (targetWeight && targetDuration) {
      const weeks = parseDurationToWeeks(targetDuration);
      const dailySurplus = Math.round((parseFloat(targetWeight) / weeks * 7700) / 7);
      calories = tdee + dailySurplus;
    } else {
      calories = tdee + 300;
    }
  }

  const proteinFactor = normalizedGoal === 'lose' ? 1.4 : normalizedGoal === 'gain' ? 1.4 : 1.2;
  const protein = Math.round(w * proteinFactor);
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.round(Math.max(calories - protein * 4 - fat * 9, 0) / 4);
  const fiber = Math.max(25, Math.round((calories / 1000) * 14));

  return { tdee, calories, protein, fat, carbs, fiber };
};

const PREMIUM_PACKAGE_DURATIONS = {
  'premium-trial-3-day': 3,
  'premium-trial-7-day': 7,
  'premium-1-month': 30,
  'premium-3-month': 90,
  'premium-12-month': 365,
  'premium-couple': 30,
};

const COUPLE_CODE_LENGTH = 8;

const generateRandomCoupleCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < COUPLE_CODE_LENGTH; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const generateUniqueCoupleShareCode = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateRandomCoupleCode();
    const exists = await userModel.exists({ coupleShareCode: code });
    if (!exists) return code;
  }
  return `${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
};

const resolvePremiumDurationDays = (premiumPackage) => {
  if (!premiumPackage) {
    return 30;
  }

  return PREMIUM_PACKAGE_DURATIONS[premiumPackage] || null;
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
    
    const nutritionTargets = calculateNutritionTargets(onboardingData);
    await userModel.findByIdAndUpdate(userId, {
      name: userName, // Update the user's name from onboarding
      hasCompletedOnboarding: true,
      onboardingData: onboardingData,
      nutritionTargets,
    });

    // Save initial weight entry to weights collection
    if (onboardingData.weight && parseFloat(onboardingData.weight) > 0) {
      await new weightModel({
        userId,
        weight: parseFloat(onboardingData.weight),
        date: new Date(),
        note: 'Cân nặng ban đầu (onboarding)',
      }).save();
    }

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
    console.log('📝 [UPDATE PROFILE]');
    console.log('   req.userId:', req.userId);
    console.log('   req.body.userId:', req.body.userId);
    console.log('   req.body:', req.body);
    console.log('   req.file:', req.file);
    
    const userId = req.userId || req.body.userId;
    console.log('   Final userId:', userId);
    
    if (!userId) {
      return res.json({ success: false, message: "User ID not found" });
    }
    
    const { name, email, phone, location } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (location) updateData.location = location;
    if (req.body.onboardingData) {
      updateData.onboardingData = typeof req.body.onboardingData === 'string' 
        ? JSON.parse(req.body.onboardingData) 
        : req.body.onboardingData;

      updateData.nutritionTargets = calculateNutritionTargets(updateData.onboardingData);

      // Save new weight entry if weight changed
      const newWeight = parseFloat(updateData.onboardingData.weight);
      if (newWeight > 0) {
        await new weightModel({
          userId,
          weight: newWeight,
          date: new Date(),
          note: 'Cập nhật từ hồ sơ',
        }).save();
      }
    }
    if (req.body.mealReminderSettings) {
      const currentUser = await userModel.findById(userId).select('planType subscriptionStatus subscriptionEndDate');
      if (!currentUser) {
        return res.json({ success: false, message: 'User not found' });
      }

      const now = new Date();
      const isPremiumActive =
        currentUser.planType === 'premium' &&
        currentUser.subscriptionStatus === 'active' &&
        currentUser.subscriptionEndDate &&
        new Date(currentUser.subscriptionEndDate) > now;

      if (!isPremiumActive) {
        return res.json({
          success: false,
          message: 'Tính năng nhắc bữa ăn chỉ áp dụng cho tài khoản Premium còn hạn'
        });
      }

      const parsedReminderSettings = typeof req.body.mealReminderSettings === 'string'
        ? JSON.parse(req.body.mealReminderSettings)
        : req.body.mealReminderSettings;

      const normalizedReminderSettings = {
        enabled: !!parsedReminderSettings?.enabled,
        breakfastTime: parsedReminderSettings?.breakfastTime || '',
        lunchTime: parsedReminderSettings?.lunchTime || '',
        dinnerTime: parsedReminderSettings?.dinnerTime || ''
      };

      if (
        normalizedReminderSettings.enabled &&
        !normalizedReminderSettings.breakfastTime &&
        !normalizedReminderSettings.lunchTime &&
        !normalizedReminderSettings.dinnerTime
      ) {
        return res.json({
          success: false,
          message: 'Vui lòng chọn ít nhất 1 khung giờ cho nhắc bữa ăn'
        });
      }

      updateData.mealReminderSettings = normalizedReminderSettings;
    }

    if (req.file) updateData.avatar = req.file.filename;
    
    console.log('   Update data:', updateData);
    
    const user = await userModel.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');
    
    if (!user) {
      console.log('   ❌ User not found in DB');
      return res.json({ success: false, message: "User not found" });
    }
    
    console.log('   ✅ Profile updated successfully');
    res.json({ success: true, message: "Profile updated successfully", user });
  } catch (error) {
    console.log('   ❌ Error:', error);
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

    if (planType === 'premium') {
      return res.json({
        success: true,
        requiresPayment: true,
        message: 'Premium plan selected. Payment confirmation is required.'
      });
    }

    const updateData = {
      planType,
      mealReminderSettings: {
        enabled: false,
        breakfastTime: '',
        lunchTime: '',
        dinnerTime: ''
      }
    };

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
    const user = await userModel.findById(userId).select('planType subscriptionStatus subscriptionEndDate');

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const now = Date.now();
    const subscriptionEndMs = user.subscriptionEndDate ? new Date(user.subscriptionEndDate).getTime() : null;
    const isPremiumExpired =
      user.planType === 'premium' &&
      (!subscriptionEndMs || Number.isNaN(subscriptionEndMs) || subscriptionEndMs <= now);

    if (isPremiumExpired) {
      await userModel.findByIdAndUpdate(userId, {
        planType: 'free',
        subscriptionStatus: 'expired',
        mealReminderSettings: {
          enabled: false,
          breakfastTime: '',
          lunchTime: '',
          dinnerTime: ''
        }
      });

      return res.json({
        success: true,
        planType: 'free',
        subscriptionStatus: 'expired',
        remainingPremiumDays: 0
      });
    }

    const remainingPremiumDays =
      user.planType === 'premium' && subscriptionEndMs && !Number.isNaN(subscriptionEndMs) && subscriptionEndMs > now
        ? Math.max(1, Math.ceil((subscriptionEndMs - now) / (24 * 60 * 60 * 1000)))
        : 0;

    res.json({ 
      success: true, 
      planType: user.planType || 'free',
      subscriptionStatus: user.subscriptionStatus,
      remainingPremiumDays
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error fetching plan" });
  }
};

// Confirm premium (payment completed)
const confirmPremium = async (req, res) => {
  try {
    const { planType, premiumPackage } = req.body;
    const userId = req.body.userId;

    if (planType !== 'premium') {
      return res.json({ success: false, message: "Invalid plan type for confirmation" });
    }

    const durationDays = resolvePremiumDurationDays(premiumPackage);

    if (!durationDays) {
      return res.json({ success: false, message: 'Invalid premium package' });
    }

    const now = new Date();
    const subscriptionEndDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const coupleShareCode = premiumPackage === 'premium-couple'
      ? await generateUniqueCoupleShareCode()
      : null;

    const updateData = {
      planType: 'premium',
      subscriptionStatus: 'active',
      premiumPackage,
      subscriptionStartDate: now,
      subscriptionEndDate,
      coupleShareCode,
      coupleShareCodeUsed: false,
      coupleShareCodeUsedAt: null,
      coupleSharedWithUserId: null,
      coupleSharedFromUserId: null,
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

// Redeem one-time couple share code from another user
const redeemCoupleShareCode = async (req, res) => {
  try {
    const userId = req.body.userId;
    const rawCode = String(req.body.code || '').trim().toUpperCase();

    if (!rawCode) {
      return res.json({ success: false, message: 'Vui lòng nhập mã chia sẻ' });
    }

    const currentUser = await userModel.findById(userId).select('planType');
    if (!currentUser) {
      return res.json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    const now = new Date();
    const owner = await userModel.findOneAndUpdate(
      {
        _id: { $ne: userId },
        coupleShareCode: rawCode,
        premiumPackage: 'premium-couple',
        planType: 'premium',
        subscriptionStatus: 'active',
        subscriptionEndDate: { $gt: now },
        coupleShareCodeUsed: { $ne: true }
      },
      {
        $set: {
          coupleShareCodeUsed: true,
          coupleShareCodeUsedAt: now,
          coupleSharedWithUserId: userId
        }
      },
      { new: true }
    ).select('subscriptionStartDate subscriptionEndDate');

    if (!owner) {
      return res.json({ success: false, message: 'Mã chia sẻ không hợp lệ, đã dùng hoặc đã hết hạn' });
    }

    const updateData = {
      planType: 'premium',
      subscriptionStatus: 'active',
      premiumPackage: 'premium-couple-member',
      subscriptionStartDate: owner.subscriptionStartDate || now,
      subscriptionEndDate: owner.subscriptionEndDate,
      coupleSharedFromUserId: owner._id,
      pendingPaymentOrderCode: null,
      pendingPaymentPackage: null,
    };

    await userModel.findByIdAndUpdate(userId, updateData);

    res.json({
      success: true,
      message: 'Đã kích hoạt Premium từ mã couple thành công',
      subscriptionEndDate: owner.subscriptionEndDate,
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Không thể sử dụng mã chia sẻ' });
  }
};

// Search users by name (public)
const searchUsers = async (req, res) => {
  try {
    const { q, limit } = req.query;
    if (!q?.trim()) return res.json({ success: true, users: [], totalUsers: 0 });

    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const parsedLimit = Number(limit);
    const shouldLimit = Number.isFinite(parsedLimit) && parsedLimit > 0;

    const matchedUsers = await userModel
      .find({ name: regex })
      .select('_id name avatar followers')
      .sort({ followers: -1, name: 1 });

    const userIds = matchedUsers.map((user) => user._id);
    const postCounts = await userModel.db.collection('posts').aggregate([
      {
        $match: {
          userId: { $in: userIds },
          isPublished: true
        }
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const postCountMap = new Map(postCounts.map((item) => [String(item._id), item.count]));
    const formattedUsers = matchedUsers.map((user) => ({
      _id: user._id,
      name: user.name,
      avatar: user.avatar,
      followersCount: user.followers?.length || 0,
      postsCount: postCountMap.get(String(user._id)) || 0
    }));

    res.json({
      success: true,
      users: shouldLimit ? formattedUsers.slice(0, parsedLimit) : formattedUsers,
      totalUsers: formattedUsers.length
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Error searching users' });
  }
};

// Get public profile of a user (name, avatar, follower count)
const getUserPublicProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await userModel.findById(userId).select('_id name avatar followers following');
    if (!user) return res.json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Error fetching user profile' });
  }
};

// Follow a user
const followUser = async (req, res) => {
  try {
    const currentUserId = req.body.userId; // from auth middleware
    const { targetId } = req.params;
    if (currentUserId === targetId) return res.json({ success: false, message: 'Cannot follow yourself' });

    const [current, target] = await Promise.all([
      userModel.findById(currentUserId),
      userModel.findById(targetId)
    ]);
    if (!current || !target) return res.json({ success: false, message: 'User not found' });

    if (current.following.map(String).includes(targetId)) {
      return res.json({ success: false, message: 'Already following' });
    }

    current.following.push(targetId);
    target.followers.push(currentUserId);
    await Promise.all([current.save(), target.save()]);

    await notifyNewFollow(
      targetId,
      current.name || "Người dùng",
      currentUserId,
      current.avatar || ""
    );

    res.json({ success: true, message: 'Followed', followersCount: target.followers.length });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Error following user' });
  }
};

// Unfollow a user
const unfollowUser = async (req, res) => {
  try {
    const currentUserId = req.body.userId;
    const { targetId } = req.params;

    await Promise.all([
      userModel.findByIdAndUpdate(currentUserId, { $pull: { following: targetId } }),
      userModel.findByIdAndUpdate(targetId, { $pull: { followers: currentUserId } })
    ]);

    const target = await userModel.findById(targetId).select('followers');
    res.json({ success: true, message: 'Unfollowed', followersCount: target?.followers?.length ?? 0 });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Error unfollowing user' });
  }
};

export { loginUser, registerUser, saveOnboarding, getUserProfile, updateProfile, selectPlan, getCurrentPlan, confirmPremium, redeemCoupleShareCode, searchUsers, getUserPublicProfile, followUser, unfollowUser };
