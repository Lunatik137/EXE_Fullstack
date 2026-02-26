import express from "express";
import {
  subscribeUser,
  unsubscribeUser
} from "../controllers/notificationController.js";
import authMiddleware from "../middleware/auth.js";

const notificationRouter = express.Router();

notificationRouter.post("/subscribe", authMiddleware, subscribeUser);

notificationRouter.post("/unsubscribe", authMiddleware, unsubscribeUser);

export default notificationRouter;
