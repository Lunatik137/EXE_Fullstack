import notificationSubscriptionModel from "../models/notificationSubscriptionModel.js";
import webpush from "web-push";
import "dotenv/config";

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:example@example.com";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

// Subscribe to push notifications
const subscribeUser = async (req, res) => {
  try {
    const userId = req.body.userId;
    const subscription = req.body.subscription;

    if (!userId || !subscription || !subscription.endpoint) {
      return res.json({
        success: false,
        message: "Invalid subscription data"
      });
    }

    // Check if subscription already exists
    let notificationSub = await notificationSubscriptionModel.findOne({
      endpoint: subscription.endpoint
    });

    if (!notificationSub) {
      notificationSub = new notificationSubscriptionModel({
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userAgent: req.headers["user-agent"]
      });
      await notificationSub.save();
    }

    res.json({
      success: true,
      message: "Subscribed to notifications"
    });
  } catch (error) {
    console.error("Subscription error:", error);
    res.json({
      success: false,
      message: "Error subscribing to notifications",
      error: error.message
    });
  }
};

// Unsubscribe from push notifications
const unsubscribeUser = async (req, res) => {
  try {
    const subscription = req.body.subscription;

    if (!subscription || !subscription.endpoint) {
      return res.json({
        success: false,
        message: "Invalid subscription data"
      });
    }

    await notificationSubscriptionModel.deleteOne({
      endpoint: subscription.endpoint
    });

    res.json({
      success: true,
      message: "Unsubscribed from notifications"
    });
  } catch (error) {
    console.error("Unsubscription error:", error);
    res.json({
      success: false,
      message: "Error unsubscribing from notifications"
    });
  }
};

// Send notification to user
const sendNotificationToUser = async (userId, notificationData) => {
  try {
    const subscriptions = await notificationSubscriptionModel.find({ userId });

    if (subscriptions.length === 0) {
      console.log("No subscriptions found for user:", userId);
      return false;
    }

    const payload = JSON.stringify(notificationData);

    const results = await Promise.allSettled(
      subscriptions.map(subscription =>
        webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys
          },
          payload
        )
      )
    );

    // Remove failed subscriptions
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "rejected") {
        console.log("Push failed for subscription:", subscriptions[i]._id);
        await notificationSubscriptionModel.deleteOne({
          _id: subscriptions[i]._id
        });
      }
    }

    return true;
  } catch (error) {
    console.error("Error sending notification:", error);
    return false;
  }
};

// Notify when someone comments on user's post
const notifyNewComment = async (userId, userName, postId, postContent) => {
  const notificationData = {
    title: "💬 Bình luận mới",
    body: `${userName} đã bình luận: ${postContent.substring(0, 50)}...`,
    icon: "/logo.png",
    badge: "/logo.png",
    tag: "comment-notification",
    data: {
      type: "comment",
      postId,
      userName,
      postContent
    }
  };

  return sendNotificationToUser(userId, notificationData);
};

// Notify when someone likes user's post
const notifyNewLike = async (userId, userName, postId, postContent) => {
  const notificationData = {
    title: "❤️ Có người thích bài viết",
    body: `${userName} thích: ${postContent.substring(0, 50)}...`,
    icon: "/logo.png",
    badge: "/logo.png",
    tag: "like-notification",
    data: {
      type: "like",
      postId,
      userName,
      postContent
    }
  };

  return sendNotificationToUser(userId, notificationData);
};

// Notify meal schedule
const notifyMealSchedule = async (userId, mealName, mealTime) => {
  const notificationData = {
    title: "🍽️ Nhắc nhở bữa ăn",
    body: `Đã đến lúc ${mealName} lúc ${mealTime}`,
    icon: "/logo.png",
    badge: "/logo.png",
    tag: "meal-notification",
    data: {
      type: "meal",
      mealName,
      mealTime
    }
  };

  return sendNotificationToUser(userId, notificationData);
};

export {
  subscribeUser,
  unsubscribeUser,
  sendNotificationToUser,
  notifyNewComment,
  notifyNewLike,
  notifyMealSchedule
};
