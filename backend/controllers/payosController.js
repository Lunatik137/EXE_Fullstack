import { PayOS } from "@payos/node";
import crypto from "crypto";
import userModel from "../models/userModel.js";
import voucherModel from "../models/voucherModel.js";

// ─── Package config ───────────────────────────────────────────────────────────
const PACKAGE_PRICES = {
  "premium-1-month": 69000,
  "premium-3-month": 179000,
  "premium-12-month": 549000,
  "premium-couple": 99000,
};

const PREMIUM_PACKAGE_DURATIONS = {
  "premium-1-month": 30,
  "premium-3-month": 90,
  "premium-12-month": 365,
  "premium-couple": 30,
};

const PACKAGE_LABELS = {
  "premium-1-month": "Premium 1 tháng",
  "premium-3-month": "Premium 3 tháng",
  "premium-12-month": "Premium 1 năm",
  "premium-couple": "Gói Couple",
};

const COUPLE_CODE_LENGTH = 8;

const generateRandomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "";
  for (let i = 0; i < COUPLE_CODE_LENGTH; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
};

const generateUniqueCoupleShareCode = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateRandomCode();
    const exists = await userModel.exists({ coupleShareCode: code });
    if (!exists) return code;
  }
  return `${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
};

const buildQrImageUrl = (qrCodeValue) => {
  if (!qrCodeValue) return "";
  if (String(qrCodeValue).startsWith("http://") || String(qrCodeValue).startsWith("https://")) {
    return String(qrCodeValue);
  }
  return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(
    String(qrCodeValue)
  )}`;
};

// ─── Lazy-init PayOS (server boots without credentials, warns at runtime) ─────
let _payos = null;
const getPayOS = () => {
  if (!_payos) {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
    if (!clientId || !apiKey || !checksumKey) {
      throw new Error(
        "PayOS credentials missing. Set PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY in .env"
      );
    }
    _payos = new PayOS({ clientId, apiKey, checksumKey });
  }
  return _payos;
};

// ─── HMAC-SHA256 signature helpers (server-side, mirrors PayOS spec) ──────────

/**
 * Deep-sort an object by keys (same algorithm as PayOS SDK & the browser util
 * the user provided). Arrays maintain order; nested objects are sorted.
 */
function deepSortObj(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      const value = obj[key];
      if (Array.isArray(value)) {
        acc[key] = value.map((item) =>
          typeof item === "object" && item !== null ? deepSortObj(item) : item
        );
      } else if (typeof value === "object" && value !== null) {
        acc[key] = deepSortObj(value);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});
}

/**
 * Build the query string PayOS uses for signing:
 *   key1=value1&key2=value2  (keys sorted, values URL-encoded)
 */
function buildSignaturePayload(data) {
  const sorted = deepSortObj(data);
  return Object.keys(sorted)
    .map((key) => {
      let value = sorted[key];
      if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
        value = JSON.stringify(value);
      }
      if (value === null || value === undefined) value = "";
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    })
    .join("&");
}

/** Compute HMAC-SHA256 hex using Node crypto */
function computeHmac(secretKey, payload) {
  return crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
}

/**
 * Verify PayOS webhook signature manually (Node crypto version of the
 * browser verifySignatureBrowser provided by the user).
 * Returns true if valid.
 */
function verifyWebhookSignature(body, checksumKey) {
  const { signature, data } = body;
  if (!signature || !data) return false;
  const payload = buildSignaturePayload(data);
  const expected = computeHmac(checksumKey, payload);
  return expected.toLowerCase() === signature.toLowerCase();
}

// ─── Activate premium helper ──────────────────────────────────────────────────
async function activatePremium(userId, premiumPackage) {
  const durationDays = PREMIUM_PACKAGE_DURATIONS[premiumPackage] || 30;
  const now = new Date();
  const subscriptionEndDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const coupleShareCode = premiumPackage === "premium-couple" ? await generateUniqueCoupleShareCode() : null;

  // Mark pending voucher as used (if any)
  const userBeforeActivate = await userModel.findById(userId).select("pendingVoucherCode");
  if (userBeforeActivate?.pendingVoucherCode) {
    await voucherModel.findOneAndUpdate(
      { code: userBeforeActivate.pendingVoucherCode },
      { $addToSet: { usedBy: userId } }
    );
  }

  await userModel.findByIdAndUpdate(userId, {
    planType: "premium",
    subscriptionStatus: "active",
    premiumPackage,
    subscriptionStartDate: now,
    subscriptionEndDate,
    pendingPaymentOrderCode: null,
    pendingPaymentPackage: null,
    pendingVoucherCode: null,
    coupleShareCode,
    coupleShareCodeUsed: false,
    coupleShareCodeUsedAt: null,
    coupleSharedWithUserId: null,
    coupleSharedFromUserId: null,
  });
}

// ─── API: POST /api/payos/create-payment ─────────────────────────────────────
const createPayment = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { premiumPackage, voucherCode } = req.body;

    if (!premiumPackage || !PACKAGE_PRICES[premiumPackage]) {
      return res.json({ success: false, message: "Gói premium không hợp lệ" });
    }

    let amount = PACKAGE_PRICES[premiumPackage];
    let appliedVoucherCode = null;
    let discountPercent = 0;

    // Validate and apply voucher discount
    if (voucherCode) {
      const voucher = await voucherModel.findOne({
        code: voucherCode.trim().toUpperCase(),
        isActive: true,
      });
      if (
        voucher &&
        voucher.usedBy.length < voucher.maxUses &&
        (!userId || !voucher.usedBy.some((id) => id.toString() === userId.toString()))
      ) {
        discountPercent = voucher.discountPercent;
        amount = Math.max(1000, Math.round(amount * (1 - discountPercent / 100)));
        appliedVoucherCode = voucher.code;
      }
    }

    // orderCode: positive integer, unique per request
    const orderCode = Date.now();
    const description = `GreenPath ${PACKAGE_LABELS[premiumPackage] || premiumPackage}`;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const paymentData = {
      orderCode,
      amount,
      description,
      items: [
        {
          name: PACKAGE_LABELS[premiumPackage] || premiumPackage,
          quantity: 1,
          price: amount,
        },
      ],
      returnUrl: `${frontendUrl}/payment?orderCode=${orderCode}&result=success`,
      cancelUrl: `${frontendUrl}/payment?orderCode=${orderCode}&result=cancel`,
    };

    const payos = getPayOS();
    const linkResponse = await payos.paymentRequests.create(paymentData);

    // Persist pending payment info
    await userModel.findByIdAndUpdate(userId, {
      pendingPaymentOrderCode: String(orderCode),
      pendingPaymentPackage: premiumPackage,
      pendingVoucherCode: appliedVoucherCode,
    });

    console.log(`[PayOS] Payment link created: orderCode=${orderCode} user=${userId} pkg=${premiumPackage} discount=${discountPercent}%`);

    res.json({
      success: true,
      orderCode,
      qrCode: linkResponse.qrCode,
      qrImageUrl: buildQrImageUrl(linkResponse.qrCode),
      checkoutUrl: linkResponse.checkoutUrl,
      amount,
      discountPercent,
      description,
    });
  } catch (error) {
    console.error("[PayOS] createPayment error:", error.message);
    res.json({ success: false, message: "Không thể tạo link thanh toán PayOS. Kiểm tra credentials." });
  }
};

// ─── API: GET /api/payos/check-payment/:orderCode ─────────────────────────────
const checkPayment = async (req, res) => {
  try {
    const { orderCode } = req.params;
    const payos = getPayOS();
    const info = await payos.paymentRequests.get(Number(orderCode));
    const status = info?.status || info?.data?.status || null;
    res.json({ success: true, status, data: info });
  } catch (error) {
    console.error("[PayOS] checkPayment error:", error.message);
    res.json({ success: false, message: "Không thể kiểm tra trạng thái thanh toán" });
  }
};

// ─── API: POST /api/payos/confirm-payment (client-side fallback) ───────────────
// Called by frontend after polling shows PAID, as a safety double-check
const confirmPayment = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { orderCode } = req.body;

    if (!orderCode) {
      return res.json({ success: false, message: "Thiếu orderCode" });
    }

    // Verify with PayOS that the order is actually PAID
    const payos = getPayOS();
    const info = await payos.paymentRequests.get(Number(orderCode));

    const status = info?.status || info?.data?.status;
    if (status !== "PAID") {
      return res.json({ success: false, message: `Trạng thái thanh toán: ${status}` });
    }

    // Find user and their pending package
    const user = await userModel.findById(userId);
    if (!user) {
      return res.json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Idempotent: skip if already activated for this orderCode
    if (user.planType === "premium" && user.pendingPaymentOrderCode === null) {
      return res.json({
        success: true,
        message: "Đã kích hoạt Premium trước đó",
        premiumPackage: user.premiumPackage || null,
        coupleShareCode: user.premiumPackage === "premium-couple" ? user.coupleShareCode || null : null,
      });
    }

    const premiumPackage = user.pendingPaymentPackage || "premium-3-month";
    await activatePremium(userId, premiumPackage);

    const activatedUser = await userModel
      .findById(userId)
      .select("premiumPackage coupleShareCode");
    const responsePremiumPackage = activatedUser?.premiumPackage || premiumPackage;
    const responseCoupleShareCode = responsePremiumPackage === "premium-couple"
      ? activatedUser?.coupleShareCode || null
      : null;

    console.log(`[PayOS] Premium confirmed via polling: user=${userId} pkg=${premiumPackage}`);
    res.json({
      success: true,
      message: `Kích hoạt ${PACKAGE_LABELS[premiumPackage]} thành công!`,
      premiumPackage: responsePremiumPackage,
      coupleShareCode: responseCoupleShareCode,
    });
  } catch (error) {
    console.error("[PayOS] confirmPayment error:", error.message);
    res.json({ success: false, message: "Lỗi xác nhận thanh toán" });
  }
};

// ─── API: POST /api/payos/webhook (called by PayOS server, NO auth) ───────────
const receiveWebhook = async (req, res) => {
  try {
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
    if (!checksumKey) {
      console.error("[PayOS Webhook] PAYOS_CHECKSUM_KEY not set");
      return res.status(500).json({ success: false, message: "Server config error" });
    }

    // ── Signature verification (HMAC-SHA256) ──────────────────────────────────
    const isValid = verifyWebhookSignature(req.body, checksumKey);
    if (!isValid) {
      console.warn("[PayOS Webhook] Invalid signature — possible forgery attempt");
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const { code, data } = req.body;
    console.log("[PayOS Webhook] Verified payload:", { code, orderCode: data?.orderCode });

    // Only process successful payment events
    if (code === "00" && data?.orderCode) {
      const orderCode = String(data.orderCode);
      const user = await userModel.findOne({ pendingPaymentOrderCode: orderCode });

      if (user) {
        const premiumPackage = user.pendingPaymentPackage || "premium-3-month";
        await activatePremium(user._id, premiumPackage);
        console.log(`[PayOS Webhook] Premium activated: user=${user._id} pkg=${premiumPackage}`);
      } else {
        console.warn(`[PayOS Webhook] No pending user found for orderCode=${orderCode}`);
      }
    }

    // Always return 200 so PayOS stops retrying
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[PayOS Webhook] Error:", error.message);
    res.status(500).json({ success: false, message: "Webhook processing error" });
  }
};

// ─── Legacy test endpoint ─────────────────────────────────────────────────────
const receiveTestWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-payos-signature"] || "";
    const webhookId = req.headers["x-payos-webhook-id"] || "";
    console.log("[PayOS Test Webhook] Received payload", {
      signature,
      webhookId,
      payload: req.body,
    });
    res.status(200).json({
      success: true,
      message: "PayOS webhook received",
      receivedAt: new Date().toISOString(),
      signature,
      webhookId,
      data: req.body,
    });
  } catch (error) {
    console.log("[PayOS Test Webhook] Error:", error);
    res.status(500).json({ success: false, message: "Failed to process PayOS webhook" });
  }
};

export { createPayment, checkPayment, confirmPayment, receiveWebhook, receiveTestWebhook };