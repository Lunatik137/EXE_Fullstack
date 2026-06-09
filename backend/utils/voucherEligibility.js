import referralCodeModel from "../models/referralCodeModel.js";
import voucherModel from "../models/voucherModel.js";

const normalizeVoucherCode = (code) => String(code || "").trim().toUpperCase();

const hasGlobalUsesRemaining = (voucher) => {
  const maxUses = Number(voucher?.maxUses || 0);
  return maxUses <= 0 || (voucher.usedBy?.length || 0) < maxUses;
};

const hasUserUsedReferralCode = async (userId) => {
  if (!userId) return false;

  const usedReferral = await referralCodeModel.exists({
    isUsed: true,
    usedBy: userId,
  });

  return !!usedReferral;
};

const validateVoucherForUser = async ({ code, userId }) => {
  const normalizedCode = normalizeVoucherCode(code);

  if (!normalizedCode) {
    return {
      success: false,
      message: "Vui lòng nhập mã giảm giá",
    };
  }

  const voucher = await voucherModel.findOne({
    code: normalizedCode,
    isActive: true,
  });

  if (!voucher) {
    return {
      success: false,
      message: "Mã giảm giá không hợp lệ hoặc đã hết hạn",
    };
  }

  if (!hasGlobalUsesRemaining(voucher)) {
    return {
      success: false,
      message: "Mã giảm giá đã hết lượt sử dụng",
    };
  }

  if (userId && voucher.usedBy.some((id) => id.toString() === userId.toString())) {
    return {
      success: false,
      message: "Bạn đã sử dụng mã giảm giá này rồi",
    };
  }

  if (voucher.requiresReferralCode) {
    const isEligible = await hasUserUsedReferralCode(userId);
    if (!isEligible) {
      return {
        success: false,
        message: "Mã này chỉ áp dụng cho tài khoản đã dùng referral code",
      };
    }
  }

  return {
    success: true,
    voucher,
  };
};

export { hasGlobalUsesRemaining, hasUserUsedReferralCode, normalizeVoucherCode, validateVoucherForUser };
