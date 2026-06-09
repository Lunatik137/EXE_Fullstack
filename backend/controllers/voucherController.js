import voucherModel from "../models/voucherModel.js";
import { validateVoucherForUser } from "../utils/voucherEligibility.js";

// POST /api/voucher/apply (user)
// Validates a voucher code without consuming it.
const applyVoucher = async (req, res) => {
  try {
    const result = await validateVoucherForUser({
      code: req.body.code,
      userId: req.body.userId,
    });

    if (!result.success) {
      return res.json({ success: false, message: result.message });
    }

    const { voucher } = result;

    return res.json({
      success: true,
      discountPercent: voucher.discountPercent,
      message: `Áp dụng thành công! Giảm ${voucher.discountPercent}%`,
    });
  } catch (err) {
    console.error("[Voucher] applyVoucher error:", err);
    return res.json({ success: false, message: "Lỗi server" });
  }
};

// Admin CRUD
const listVouchers = async (req, res) => {
  try {
    const vouchers = await voucherModel.find().sort({ createdAt: -1 });
    return res.json({ success: true, vouchers });
  } catch {
    return res.json({ success: false, message: "Lỗi server" });
  }
};

const createVoucher = async (req, res) => {
  try {
    const { code, discountPercent, maxUses, note, requiresReferralCode } = req.body;
    if (!code || discountPercent === undefined || discountPercent === null) {
      return res.json({ success: false, message: "Thiếu thông tin bắt buộc (code, discountPercent)" });
    }

    const voucher = new voucherModel({
      code: code.trim().toUpperCase(),
      discountPercent: Number(discountPercent),
      maxUses: requiresReferralCode ? 0 : Number(maxUses) || 1,
      requiresReferralCode: !!requiresReferralCode,
      note: note || "",
    });
    await voucher.save();
    return res.json({ success: true, voucher });
  } catch (err) {
    if (err.code === 11000) {
      return res.json({ success: false, message: "Mã voucher đã tồn tại" });
    }
    return res.json({ success: false, message: "Lỗi server" });
  }
};

const toggleVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await voucherModel.findById(id);
    if (!voucher) return res.json({ success: false, message: "Không tìm thấy voucher" });
    voucher.isActive = !voucher.isActive;
    await voucher.save();
    return res.json({ success: true, voucher });
  } catch {
    return res.json({ success: false, message: "Lỗi server" });
  }
};

const deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    await voucherModel.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch {
    return res.json({ success: false, message: "Lỗi server" });
  }
};

export { applyVoucher, listVouchers, createVoucher, toggleVoucher, deleteVoucher };
