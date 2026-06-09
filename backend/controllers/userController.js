import userModel from "../models/userModel.js";
import weightModel from "../models/weightModel.js";
import emailVerificationModel from "../models/emailVerificationModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import validator from "validator";
import { notifyNewFollow } from "./notificationController.js";
import { evaluateOnboardingMealPlanFeasibility } from "./mealPlanController.js";
import geminiService from "../utils/geminiService.js";

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

const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const REGISTER_CODE_RESEND_COOLDOWN_MS = 60 * 1000;

const generateVerificationCode = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

const sendRegisterVerificationCode = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  try {
    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Email không hợp lệ" });
    }

    if (!password || password.length < 8) {
      return res.json({
        success: false,
        message: "Mật khẩu phải có ít nhất 8 ký tự",
      });
    }

    const exists = await userModel.findOne({ email });
    if (exists) {
      return res.json({ success: false, message: "Email này đã được đăng ký" });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.json({
        success: false,
        message: "Chưa cấu hình email gửi mã xác nhận",
      });
    }

    const recentVerification = await emailVerificationModel.findOne({ email, purpose: "register" });
    if (recentVerification?.updatedAt) {
      const elapsedMs = Date.now() - recentVerification.updatedAt.getTime();
      if (elapsedMs < REGISTER_CODE_RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((REGISTER_CODE_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
        return res.json({
          success: false,
          message: `Vui lòng chờ ${waitSeconds}s trước khi gửi lại mã xác nhận`,
          waitSeconds,
        });
      }
    }

    const code = generateVerificationCode();
    const salt = await bcrypt.genSalt(Number(process.env.SALT) || 10);
    const codeHash = await bcrypt.hash(code, salt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await emailVerificationModel.findOneAndUpdate(
      { email, purpose: "register" },
      { codeHash, attempts: 0, expiresAt },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const transporter = createEmailTransporter();
    await transporter.sendMail({
      from: `"GreenPath" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Mã xác nhận đăng ký GreenPath",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f9fafb; padding: 28px;">
          <div style="background: #ffffff; border-radius: 14px; padding: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <h2 style="color: #059669; margin: 0 0 12px;">GreenPath</h2>
            <p style="color: #374151; line-height: 1.6;">Nhập mã bên dưới để hoàn tất đăng ký tài khoản:</p>
            <div style="font-size: 32px; letter-spacing: 8px; font-weight: 700; color: #065f46; background: #ecfdf5; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
              ${code}
            </div>
            <p style="color: #6b7280; line-height: 1.6;">Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu đăng ký, vui lòng bỏ qua email này.</p>
          </div>
        </div>
      `,
    });

    res.json({
      success: true,
      message: "Mã xác nhận đã được gửi tới email của bạn",
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Không thể gửi mã xác nhận. Vui lòng thử lại." });
  }
};

// register user

const registerUser = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password, verificationCode } = req.body;
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
    if (!password || password.length < 8) {
      return res.json({
        success: false,
        message: "Mật khẩu phải có ít nhất 8 ký tự",
      });
    }

    const normalizedVerificationCode = String(verificationCode || "").trim();

    if (!normalizedVerificationCode) {
      return res.json({
        success: false,
        message: "Vui lòng nhập mã xác nhận email",
      });
    }

    const verification = await emailVerificationModel.findOne({
      email,
      purpose: "register",
    });

    if (!verification || verification.expiresAt.getTime() < Date.now()) {
      return res.json({
        success: false,
        message: "Mã xác nhận đã hết hạn. Vui lòng gửi lại mã mới",
      });
    }

    if (verification.attempts >= 5) {
      return res.json({
        success: false,
        message: "Bạn đã nhập sai quá nhiều lần. Vui lòng gửi lại mã mới",
      });
    }

    const isCodeValid = await bcrypt.compare(normalizedVerificationCode, verification.codeHash);
    if (!isCodeValid) {
      verification.attempts += 1;
      await verification.save();
      return res.json({
        success: false,
        message: "Mã xác nhận không đúng",
      });
    }

    // hashing user password

    const salt = await bcrypt.genSalt(Number(process.env.SALT) || 10);
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
    await emailVerificationModel.deleteOne({ email, purpose: "register" });

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

const sanitizeOnboardingData = (data = {}) => {
  const sanitized = { ...data };
  const goal = String(sanitized.goal || '').trim().toLowerCase();

  if (goal !== 'lose' && goal !== 'gain') {
    sanitized.targetWeight = '';
    sanitized.targetDuration = '';
  }

  return sanitized;
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

const extractJsonObject = (text) => {
  const raw = String(text || '').trim();
  const withoutFence = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const match = withoutFence.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const inferOnboardingWarningStep = (warning) => {
  const code = String(warning?.code || '').toUpperCase();
  const text = `${warning?.message || ''} ${warning?.detail || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const explicitStep = Number(warning?.suggestedStep || 0);

  if (explicitStep >= 1 && explicitStep <= 9) return explicitStep;

  if (code.includes('DISLIKE') || /khong thich|khong an chay|khong an do chay/.test(text)) return 6;
  if (code.includes('WEIGHT') || code.includes('CALORIE') || /can nang|muc tieu|kg|bmi|calo|calorie/.test(text)) return 3;
  if (code.includes('HEALTH') || /suc khoe|benh|tieu duong|huyet ap|da day|gout|mo mau|thai ky/.test(text)) return 4;
  if (code.includes('DIET') || code.includes('PLANT_BASED') || /che do an|an chay|thuan chay|vegan|vegetarian/.test(text)) return 5;
  if (code.includes('ALLERGY') || code.includes('MEALPLAN') || code.includes('DISLIKE') || /di ung|han che|khong thich|meal plan|nguyen lieu/.test(text)) return 6;

  return 7;
};

const normalizeAiWarnings = (warnings) => {
  if (!Array.isArray(warnings)) return [];

  return warnings
    .map((warning, index) => {
      const normalized = {
        code: String(warning?.code || `AI_ONBOARDING_WARNING_${index + 1}`).toUpperCase(),
        severity: ['high', 'medium'].includes(String(warning?.severity || '').toLowerCase())
          ? String(warning.severity).toLowerCase()
          : 'high',
        message: String(warning?.message || '').trim(),
        detail: String(warning?.detail || '').trim(),
        source: 'ai'
      };

      return {
        ...normalized,
        suggestedStep: inferOnboardingWarningStep({ ...warning, ...normalized })
      };
    })
    .filter(warning => warning.message && warning.severity === 'high');
};

const evaluateOnboardingWithAI = async (onboardingData, nutritionTargets, feasibility) => {
  const prompt = `
Bạn là AI kiểm tra hồ sơ onboarding cho ứng dụng GreenPath, một nền tảng meal plan thực vật/chay.

Nhiệm vụ:
- Đọc toàn bộ dữ liệu, bao gồm các ô nhập tự do.
- Đánh giá theo NGỮ NGHĨA, không chỉ theo từ khóa cố định.
- Chỉ trả warnings cho lỗi cần CHẶN người dùng đi tiếp. Không trả lời tư vấn dinh dưỡng mức "nên lưu ý".
- Ví dụ cần chặn: người dùng nói "bệnh gì tôi cũng bị", "tôi bị mọi bệnh", "dị ứng tất cả/mọi nguyên liệu", "cái gì cũng dị ứng", "tôi không ăn chay/không thích đồ chay" trong khi app chỉ tạo meal plan thực vật.
- Không chặn chỉ vì người dùng có 1-3 tình trạng sức khỏe phổ biến nếu dữ liệu vẫn có thể tạo meal plan hợp lý.
- Không cảnh báo chỉ vì dị ứng đậu nành/đậu phộng/gluten/sữa/trứng nếu hệ thống vẫn tạo được meal plan phù hợp. Kết quả thử tạo meal plan nằm trong "mealPlanFeasibility" bên dưới.
- Nếu mealPlanFeasibility.feasible là true, không được tạo cảnh báo kiểu "nguồn protein bị hạn chế" cho các dị ứng thông thường; chỉ chặn khi input tự do có mâu thuẫn nghiêm trọng theo ngữ nghĩa.
- Nếu cần cảnh báo/chặn, viết message tiếng Việt rõ ràng, lịch sự, hướng người dùng chỉnh lại bước phù hợp.
- Gán suggestedStep theo form: 3 cho mục tiêu cân nặng/calo, 4 cho tình trạng sức khỏe, 5 cho lựa chọn chế độ ăn, 6 cho dị ứng hoặc món không thích.

Trả về JSON thuần, không markdown:
{
  "isSuitable": true/false,
  "warnings": [
    {
      "code": "SEMANTIC_HEALTH_RISK | SEMANTIC_ALLERGY_CONFLICT | PLANT_BASED_DIET_CONFLICT | OTHER",
      "severity": "high" hoặc "medium",
      "message": "tiếng Việt",
      "detail": "tiếng Việt ngắn",
      "suggestedStep": 3|4|5|6|7
    }
  ]
}

Dữ liệu onboarding:
${JSON.stringify({ onboardingData, nutritionTargets, mealPlanFeasibility: feasibility }, null, 2)}
`;

  try {
    const response = await Promise.race([
      geminiService.generateContent(prompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI onboarding assessment timeout')), 30000))
    ]);
    const parsed = extractJsonObject(response);
    const warnings = normalizeAiWarnings(parsed?.warnings);
    if (parsed?.isSuitable === false && warnings.length === 0) {
      warnings.push({
        code: 'AI_ONBOARDING_NOT_SUITABLE',
        severity: 'high',
        message: 'AI đánh giá hồ sơ onboarding hiện tại chưa phù hợp. Vui lòng kiểm tra lại các thông tin sức khỏe, dị ứng/hạn chế và món không thích.',
        detail: '',
        suggestedStep: 6,
        source: 'ai'
      });
    }

    return {
      isAvailable: true,
      isSuitable: parsed?.isSuitable !== false,
      warnings,
      raw: response
    };
  } catch (error) {
    console.error('AI onboarding assessment failed:', error?.message || error);
    return {
      isAvailable: false,
      isSuitable: false,
      warnings: [{
        code: 'AI_ASSESSMENT_UNAVAILABLE',
        severity: 'high',
        message: 'Chưa thể đánh giá onboarding bằng AI. Vui lòng thử lại sau ít phút.',
        detail: error?.message || 'AI service unavailable',
        suggestedStep: 7,
        source: 'ai'
      }]
    };
  }
};

const evaluateOnboardingWarnings = async (onboardingData, nutritionTargets, options = {}) => {
  const warnings = [];
  const goal = String(onboardingData.goal || '').trim().toLowerCase();
  const feasibility = await evaluateOnboardingMealPlanFeasibility({
    onboardingData,
    nutritionTargets
  });

  const aiAssessment = options.skipAiAssessment
    ? { isAvailable: false, isSuitable: true, warnings: [] }
    : await evaluateOnboardingWithAI(onboardingData, nutritionTargets, feasibility);
  warnings.push(...aiAssessment.warnings);

  const durationWeeks = parseDurationToWeeks(String(onboardingData.targetDuration || ''));
  const targetWeightChange = Number(onboardingData.targetWeight || 0);
  if ((goal === 'lose' || goal === 'gain') && targetWeightChange > 0 && durationWeeks > 0) {
    const weeklyChange = targetWeightChange / durationWeeks;
    if (weeklyChange > 1.2) {
      warnings.push({
        code: 'WEIGHT_CHANGE_TOO_FAST',
        severity: 'high',
        message: `Mục tiêu ${goal === 'lose' ? 'giảm' : 'tăng'} khoảng ${weeklyChange.toFixed(2)} kg/tuần là khá cao và có thể không an toàn. Nên giảm tốc độ mục tiêu.`,
        suggestedStep: 3
      });
    } else if (weeklyChange > 0.8) {
      warnings.push({
        code: 'WEIGHT_CHANGE_AGGRESSIVE',
        severity: 'medium',
        message: `Mục tiêu ${goal === 'lose' ? 'giảm' : 'tăng'} khoảng ${weeklyChange.toFixed(2)} kg/tuần khá gắt. Nên cân nhắc kéo dài thời gian để dễ bám theo meal plan.`,
        suggestedStep: 3
      });
    }
  }

  const targetCalories = Number(nutritionTargets?.calories || 0);
  if (targetCalories > 0 && targetCalories < 1200) {
    warnings.push({
      code: 'CALORIE_TARGET_TOO_LOW',
      severity: 'high',
      message: `Mức năng lượng mục tiêu (${targetCalories} kcal/ngày) quá thấp, có thể khó đảm bảo dinh dưỡng.`,
      suggestedStep: 3
    });
  }

  if (!feasibility.feasible) {
    warnings.push({
      code: 'MEALPLAN_NOT_FEASIBLE',
      severity: 'high',
      message: 'Tổ hợp tình trạng sức khỏe, dị ứng/hạn chế và món không thích hiện tại khiến hệ thống chưa tạo được meal plan phù hợp. Vui lòng nới lỏng một số hạn chế hoặc cập nhật lại mục tiêu.',
      detail: feasibility.reason,
      suggestedStep: 6
    });
  }

  return {
    isSuitable: warnings.length === 0,
    warnings,
    feasibility,
    aiAssessment: {
      isAvailable: aiAssessment.isAvailable,
      isSuitable: aiAssessment.isSuitable,
      skipped: !!options.skipAiAssessment
    }
  };
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
    const aiCheckOnly = req.body.aiCheckOnly === true || String(req.body.aiCheckOnly || '').toLowerCase() === 'true';
    const skipAiAssessment = req.body.skipAiAssessment === true || String(req.body.skipAiAssessment || '').toLowerCase() === 'true';
    let onboardingData = req.body;
    
    // Extract name to update the user's name field
    const userName = onboardingData.name;
    
    // Remove userId from onboardingData before saving
    delete onboardingData.userId;
    delete onboardingData.aiCheckOnly;
    delete onboardingData.skipAiAssessment;
    onboardingData = sanitizeOnboardingData(onboardingData);
    
    const nutritionTargets = calculateNutritionTargets(onboardingData);
    const onboardingAssessment = await evaluateOnboardingWarnings(onboardingData, nutritionTargets, {
      skipAiAssessment: skipAiAssessment && !aiCheckOnly
    });

    if (aiCheckOnly) {
      return res.json({
        success: true,
        message: onboardingAssessment.isSuitable
          ? "Onboarding data is suitable"
          : "Onboarding data has warnings",
        onboardingAssessment,
        nutritionTargets
      });
    }

    if (!onboardingAssessment.isSuitable) {
      return res.json({
        success: false,
        message: "Thông tin onboarding chưa phù hợp. Vui lòng chỉnh lại trước khi hoàn thành.",
        onboardingAssessment
      });
    }

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

    res.json({
      success: true,
      message: onboardingAssessment.isSuitable
        ? "Onboarding completed successfully"
        : "Onboarding completed with warnings",
      onboardingAssessment
    });
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
    const aiCheckOnly = req.body.aiCheckOnly === true || String(req.body.aiCheckOnly || '').toLowerCase() === 'true';
    const skipAiAssessment = req.body.skipAiAssessment === true || String(req.body.skipAiAssessment || '').toLowerCase() === 'true';
    
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (location) updateData.location = location;
    let onboardingAssessment = null;
    if (req.body.onboardingData) {
      updateData.onboardingData = typeof req.body.onboardingData === 'string' 
        ? JSON.parse(req.body.onboardingData) 
        : req.body.onboardingData;
      updateData.onboardingData = sanitizeOnboardingData(updateData.onboardingData);

      updateData.nutritionTargets = calculateNutritionTargets(updateData.onboardingData);
      onboardingAssessment = await evaluateOnboardingWarnings(updateData.onboardingData, updateData.nutritionTargets, {
        skipAiAssessment: skipAiAssessment && !aiCheckOnly
      });

      if (aiCheckOnly) {
        return res.json({
          success: true,
          message: onboardingAssessment.isSuitable
            ? 'Profile data is suitable'
            : 'Profile data has warnings',
          onboardingAssessment,
          nutritionTargets: updateData.nutritionTargets
        });
      }

      if (!onboardingAssessment.isSuitable) {
        return res.json({
          success: false,
          message: 'Thông tin hồ sơ chưa phù hợp. Vui lòng chỉnh lại trước khi lưu.',
          onboardingAssessment,
          nutritionTargets: updateData.nutritionTargets
        });
      }

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
    res.json({ success: true, message: "Profile updated successfully", user, onboardingAssessment });
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

export { loginUser, sendRegisterVerificationCode, registerUser, saveOnboarding, getUserProfile, updateProfile, selectPlan, getCurrentPlan, confirmPremium, redeemCoupleShareCode, searchUsers, getUserPublicProfile, followUser, unfollowUser };
