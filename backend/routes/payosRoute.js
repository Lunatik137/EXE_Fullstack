import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
	createPayment,
	checkPayment,
	confirmPayment,
	receiveWebhook,
	receiveTestWebhook,
} from "../controllers/payosController.js";

const payosRouter = express.Router();

// Authenticated endpoints (called by frontend)
payosRouter.post("/create-payment", authMiddleware, createPayment);
payosRouter.get("/check-payment/:orderCode", authMiddleware, checkPayment);
payosRouter.post("/confirm-payment", authMiddleware, confirmPayment);

// No-auth: called by PayOS server
payosRouter.post("/webhook", receiveWebhook);

// Legacy test
payosRouter.post("/webhook-test", receiveTestWebhook);

export default payosRouter;