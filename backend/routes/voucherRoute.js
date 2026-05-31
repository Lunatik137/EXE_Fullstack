import express from "express";
import authMiddleware from "../middleware/auth.js";
import { applyVoucher } from "../controllers/voucherController.js";

const voucherRouter = express.Router();

// User: validate a voucher code (no side-effects, just checks validity)
voucherRouter.post("/apply", authMiddleware, applyVoucher);

export default voucherRouter;
