import express from "express";
import {
  subscribeUser,
  unsubscribeUser,
  getUserNotifications,
  markNotificationRead,
  logNotification
} from "../controllers/notificationController.js";
import authMiddleware from "../middleware/auth.js";

const notificationRouter = express.Router();

notificationRouter.post("/subscribe", (req, res, next) => {
  console.log("🔔 Notification subscribe route hit");
  next();
}, authMiddleware, subscribeUser);

notificationRouter.post("/unsubscribe", authMiddleware, unsubscribeUser);
notificationRouter.post("/log", authMiddleware, logNotification);

notificationRouter.get("/list", authMiddleware, getUserNotifications);
notificationRouter.put("/:notificationId/read", authMiddleware, markNotificationRead);

export default notificationRouter;
