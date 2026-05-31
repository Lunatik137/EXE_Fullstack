import notificationSubscriptionModel from "../models/notificationSubscriptionModel.js";
import notificationModel from "../models/notificationModel.js";
import userModel from "../models/userModel.js";
import MealPlan from "../models/mealPlanModel.js";
import webpush from "web-push";
import "dotenv/config";

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_MAILTO || "mailto:example@example.com";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;
const buildAvatarUrl = (avatar) =>
  avatar ? `${BACKEND_URL}/uploads/users/${avatar}` : '/logo.png';

console.log("🔧 VAPID Configuration:", {
  hasPublicKey: !!vapidPublicKey,
  hasPrivateKey: !!vapidPrivateKey,
  subject: vapidSubject
});

let mealReminderSchedulerStarted = false;
const sentMealReminderCache = new Set();
let waterReminderSchedulerStarted = false;
const sentWaterReminderCache = new Set();
let menuPreviewSchedulerStarted = false;
const sentMenuPreviewCache = new Set();

// Subscribe to push notifications
const subscribeUser = async (req, res) => {
  try {
    const userId = req.body.userId;
    const subscription = req.body.subscription;
    
    console.log("💾 Saving subscription for userId:", userId);
    console.log("📱 Subscription endpoint:", subscription.endpoint.substring(0, 50) + '...');

    if (!userId || !subscription || !subscription.endpoint) {
      return res.json({
        success: false,
        message: "Invalid subscription data"
      });
    }

    // Upsert: update existing subscription or create new one atomically (prevents duplicate key race)
    await notificationSubscriptionModel.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        $set: {
          userId,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          userAgent: req.headers["user-agent"]
        }
      },
      { upsert: true, new: true }
    );

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
const sendNotificationToUser = async (userId, notificationData, options = {}) => {
  try {
    console.log("🔔 Sending notification to user:", userId);
    const { persistToDatabase = true } = options;

    if (persistToDatabase) {
      // Persist notification to DB for in-app notification list
      try {
        const detectedType =
          notificationData?.data?.type ||
          (notificationData?.tag?.includes('comment')
            ? 'comment'
            : notificationData?.tag?.includes('like')
              ? 'like'
              : notificationData?.tag?.includes('follow')
                ? 'follow'
                : 'meal');

        await notificationModel.create({
          userId,
          type: detectedType,
          title: notificationData.title || 'Thông báo mới',
          body: notificationData.body || '',
          data: notificationData.data || {}
        });
        console.log("💾 Notification saved to database:", detectedType);
      } catch (dbError) {
        // Continue sending push even when DB write fails
        console.error("❌ Failed to save notification to database:", dbError.message);
      }
    }
    
    // Debug: Check all subscriptions
    const allSubs = await notificationSubscriptionModel.find({});
    console.log("📋 All subscriptions in DB:", allSubs.map(s => ({ userId: s.userId, endpoint: s.endpoint.substring(0, 50) + '...' })));
    
    const subscriptions = await notificationSubscriptionModel.find({ userId });

    if (subscriptions.length === 0) {
      console.log("❌ No subscriptions found for user:", userId);
      return false;
    }

    console.log("✅ Found", subscriptions.length, "subscriptions for user:", userId);
    const payload = JSON.stringify(notificationData);
    console.log("📤 Notification payload:", payload);

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

    console.log("📊 Push results:", results.map(r => r.status));

    // Remove failed subscriptions
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "rejected") {
        console.log("❌ Push failed for subscription:", subscriptions[i]._id, results[i].reason);
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
const notifyNewComment = async (userId, userName, postId, postContent, userAvatar = "") => {
  const notificationData = {
    title: "Bình luận mới",
    body: `${userName} đã bình luận: ${postContent.substring(0, 50)}...`,
    icon: buildAvatarUrl(userAvatar),
    badge: "/logo.png",
    tag: "comment-notification",
    data: {
      type: "comment",
      postId,
      userName,
      userAvatar: buildAvatarUrl(userAvatar),
      postContent
    }
  };

  return sendNotificationToUser(userId, notificationData);
};

// Notify when someone likes user's post
const notifyNewLike = async (userId, userName, postId, postContent, userAvatar = "") => {
  const notificationData = {
    title: "Có người thích bài viết",
    body: `${userName} thích: ${postContent.substring(0, 50)}...`,
    icon: buildAvatarUrl(userAvatar),
    badge: "/logo.png",
    tag: "like-notification",
    data: {
      type: "like",
      postId,
      userName,
      userAvatar: buildAvatarUrl(userAvatar),
      postContent
    }
  };

  return sendNotificationToUser(userId, notificationData);
};

const notifyNewFollow = async (userId, followerName, followerId, followerAvatar = "") => {
  const notificationData = {
    title: "Người theo dõi mới",
    body: `${followerName} đã theo dõi bạn`,
    icon: buildAvatarUrl(followerAvatar),
    badge: "/logo.png",
    tag: "follow-notification",
    data: {
      type: "follow",
      followerId,
      userName: followerName,
      userAvatar: buildAvatarUrl(followerAvatar)
    }
  };

  return sendNotificationToUser(userId, notificationData);
};

// Helper: get today's dish name from the active meal plan
const getTodayDishName = async (userId, mealKey) => {
  try {
    const mealPlan = await MealPlan.findOne({ userId, status: 'active' })
      .select('days')
      .lean();
    if (!mealPlan) return null;

    const vnNow = getVietnamNow();
    const todayKey = getVietnamDateKey(vnNow);

    const todayDay = mealPlan.days.find(d => {
      if (!d.date) return false;
      const shifted = new Date(new Date(d.date).getTime() + 7 * 60 * 60 * 1000);
      const dayKey = `${shifted.getUTCFullYear()}-${formatTwoDigits(shifted.getUTCMonth() + 1)}-${formatTwoDigits(shifted.getUTCDate())}`;
      return dayKey === todayKey;
    });

    if (!todayDay) return null;

    if (mealKey === 'breakfast') {
      return todayDay.breakfast?.name || null;
    }

    const items = todayDay[mealKey]?.items;
    if (!Array.isArray(items) || items.length === 0) return null;
    const nonRiceItems = items.filter(i => !i.isRice && i.name);
    return nonRiceItems.length > 0 ? nonRiceItems.map(i => i.name).join(' và ') : null;
  } catch (err) {
    console.error('Error getting today dish name:', err);
    return null;
  }
};

// Notify meal schedule
const notifyMealSchedule = async (userId, mealName, mealTime, extraData = {}) => {
  const mealKey = extraData.scheduleKey?.split('-')[0] || null;
  const mealTimeLabel = mealName === 'Bữa sáng' ? 'bữa sáng' : mealName === 'Bữa trưa' ? 'bữa trưa' : 'bữa tối';

  let body = `Đã đến giờ ${mealTimeLabel} rồi!`;
  if (mealKey) {
    const dishName = await getTodayDishName(userId, mealKey);
    if (dishName) {
      body += ` Hôm nay bạn có món ${dishName} đấy 🍱`;
    }
  }

  const notificationData = {
    title: `🍽️ ${mealName}`,
    body,
    icon: "/logo.png",
    badge: "/logo.png",
    tag: "meal-notification",
    data: {
      type: "meal",
      mealName,
      mealTime,
      ...extraData
    }
  };

  return sendNotificationToUser(userId, notificationData, { persistToDatabase: false });
};

const formatTwoDigits = (value) => String(value).padStart(2, "0");

const getVietnamNow = () => {
  // Shift UTC timestamp to Vietnam timezone (UTC+7), then use UTC getters.
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
};

const getVietnamDateKey = (date) => {
  return `${date.getUTCFullYear()}-${formatTwoDigits(date.getUTCMonth() + 1)}-${formatTwoDigits(date.getUTCDate())}`;
};

const getVietnamTimeHHmm = (date) => {
  return `${formatTwoDigits(date.getUTCHours())}:${formatTwoDigits(date.getUTCMinutes())}`;
};

const dispatchScheduledMealReminders = async () => {
  try {
    const vnNow = getVietnamNow();
    const currentTime = getVietnamTimeHHmm(vnNow);
    const dateKey = getVietnamDateKey(vnNow);
    const now = new Date();

    const users = await userModel.find({
      planType: "premium",
      subscriptionStatus: "active",
      subscriptionEndDate: { $gt: now },
      "mealReminderSettings.enabled": true,
      $or: [
        { "mealReminderSettings.breakfastTime": currentTime },
        { "mealReminderSettings.lunchTime": currentTime },
        { "mealReminderSettings.dinnerTime": currentTime }
      ]
    }).select("_id mealReminderSettings");

    if (users.length === 0) return;

    for (const user of users) {
      const mealEntries = [];
      if (user.mealReminderSettings?.breakfastTime === currentTime) {
        mealEntries.push({ key: "breakfast", name: "Bữa sáng" });
      }
      if (user.mealReminderSettings?.lunchTime === currentTime) {
        mealEntries.push({ key: "lunch", name: "Bữa trưa" });
      }
      if (user.mealReminderSettings?.dinnerTime === currentTime) {
        mealEntries.push({ key: "dinner", name: "Bữa tối" });
      }

      for (const meal of mealEntries) {
        const scheduleKey = `${meal.key}-${currentTime}`;
        const cacheKey = `${user._id}-${scheduleKey}-${dateKey}`;

        if (sentMealReminderCache.has(cacheKey)) continue;

        const sent = await notifyMealSchedule(user._id, meal.name, currentTime, {
          scheduleKey,
          dateKey,
          scheduled: true
        });

        if (sent) {
          sentMealReminderCache.add(cacheKey);
          console.log(`⏰ Sent scheduled meal reminder to user ${user._id} for ${meal.name} at ${currentTime}`);
        } else {
          console.warn(`⚠️ Failed scheduled meal reminder for user ${user._id} (${meal.name} at ${currentTime})`);
        }
      }
    }

    for (const key of Array.from(sentMealReminderCache)) {
      if (!key.endsWith(`-${dateKey}`)) {
        sentMealReminderCache.delete(key);
      }
    }
  } catch (error) {
    console.error("Error dispatching scheduled meal reminders:", error);
  }
};

// --- Streak encouragement ---
const STREAK_MILESTONES = new Set([3, 7, 14, 21, 30, 60, 100]);

const notifyStreakEncouragement = async (userId, currentStreak) => {
  if (!currentStreak || currentStreak < 3) return;

  const isMilestone = STREAK_MILESTONES.has(currentStreak);
  const title = isMilestone ? '🎉 Cột mốc Streak!' : '🔥 Streak đang cháy!';
  const body = `Bạn đã duy trì thực đơn lành mạnh được ${currentStreak} ngày liên tiếp — tuyệt vời! Đừng để mất streak này nhé 🔥`;

  await sendNotificationToUser(userId, {
    title,
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'streak-notification',
    data: { type: 'streak', currentStreak }
  });

  console.log(`🔥 Sent streak encouragement to user ${userId} (streak: ${currentStreak})`);
};

// --- Water reminder scheduler (auto, sends at 20:00 VN to all subscribed users) ---
const WATER_REMINDER_TIME = '20:00';

const dispatchWaterReminders = async () => {
  try {
    const vnNow = getVietnamNow();
    const currentTime = getVietnamTimeHHmm(vnNow);
    const dateKey = getVietnamDateKey(vnNow);

    if (currentTime !== WATER_REMINDER_TIME) return;

    // Send to all users who have an active push subscription
    const allSubs = await notificationSubscriptionModel.find({}).select('userId').lean();
    const uniqueUserIds = [...new Set(allSubs.map(s => String(s.userId)))];

    for (const userId of uniqueUserIds) {
      const cacheKey = `water-${userId}-${dateKey}`;
      if (sentWaterReminderCache.has(cacheKey)) continue;

      await sendNotificationToUser(userId, {
        title: '💧 Nhắc uống nước',
        body: 'Bạn đã uống đủ 8 ly nước hôm nay chưa? Nhớ giữ cơ thể đủ nước nhé!',
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'water-reminder',
        data: { type: 'water' }
      }, { persistToDatabase: false });

      sentWaterReminderCache.add(cacheKey);
      console.log(`💧 Sent water reminder to user ${userId}`);
    }

    for (const key of Array.from(sentWaterReminderCache)) {
      if (!key.endsWith(`-${dateKey}`)) sentWaterReminderCache.delete(key);
    }
  } catch (error) {
    console.error('Error dispatching water reminders:', error);
  }
};

// --- Menu preview reminder scheduler ---
// Auto-enabled when meal reminder is on; sends 60 min before each configured meal
const MENU_PREVIEW_MINUTES_BEFORE = 60;
const MEAL_PREVIEW_MAP = [
  { key: 'breakfast', timeField: 'breakfastTime', label: 'bữa sáng', emoji: '🌅' },
  { key: 'lunch',     timeField: 'lunchTime',     label: 'bữa trưa', emoji: '🍱' },
  { key: 'dinner',    timeField: 'dinnerTime',    label: 'bữa tối',  emoji: '🥘' },
];

const dispatchMenuPreviewReminders = async () => {
  try {
    const vnNow = getVietnamNow();
    const currentTime = getVietnamTimeHHmm(vnNow);
    const dateKey = getVietnamDateKey(vnNow);
    const now = new Date();

    const users = await userModel.find({
      planType: 'premium',
      subscriptionStatus: 'active',
      subscriptionEndDate: { $gt: now },
      'mealReminderSettings.enabled': true
    }).select('_id mealReminderSettings');

    for (const user of users) {
      for (const meal of MEAL_PREVIEW_MAP) {
        const mealTime = user.mealReminderSettings?.[meal.timeField];
        if (!mealTime) continue;

        const [mh, mm] = mealTime.split(':').map(Number);
        const mealMinutes = mh * 60 + mm;
        const previewTotalMinutes = mealMinutes - MENU_PREVIEW_MINUTES_BEFORE;
        if (previewTotalMinutes < 0) continue;

        const previewTime = `${formatTwoDigits(Math.floor(previewTotalMinutes / 60))}:${formatTwoDigits(previewTotalMinutes % 60)}`;
        if (currentTime !== previewTime) continue;

        const cacheKey = `menu-preview-${user._id}-${meal.key}-${dateKey}`;
        if (sentMenuPreviewCache.has(cacheKey)) continue;

        const dishName = await getTodayDishName(user._id, meal.key);
        const body = dishName
          ? `${meal.emoji} ${meal.label.charAt(0).toUpperCase() + meal.label.slice(1)} hôm nay là ${dishName} — hãy chuẩn bị nguyên liệu nhé!`
          : `${meal.emoji} Sắp đến giờ ${meal.label} rồi! Hãy chuẩn bị bữa ăn nhé!`;

        await sendNotificationToUser(user._id, {
          title: `📋 Xem thực đơn ${meal.label}`,
          body,
          icon: '/logo.png',
          badge: '/logo.png',
          tag: `menu-preview-${meal.key}`,
          data: { type: 'meal', subtype: 'menu-preview', mealKey: meal.key }
        }, { persistToDatabase: false });

        sentMenuPreviewCache.add(cacheKey);
        console.log(`📋 Sent menu preview for ${meal.label} to user ${user._id} (${MENU_PREVIEW_MINUTES_BEFORE}min before ${mealTime})`);
      }
    }

    for (const key of Array.from(sentMenuPreviewCache)) {
      if (!key.endsWith(`-${dateKey}`)) sentMenuPreviewCache.delete(key);
    }
  } catch (error) {
    console.error('Error dispatching menu preview reminders:', error);
  }
};

const startMealReminderScheduler = () => {
  if (mealReminderSchedulerStarted) {
    return;
  }

  mealReminderSchedulerStarted = true;
  console.log("⏱️ Meal reminder scheduler started (runs every minute)");

  dispatchScheduledMealReminders();
  setInterval(dispatchScheduledMealReminders, 60 * 1000);
};

const startWaterReminderScheduler = () => {
  if (waterReminderSchedulerStarted) return;
  waterReminderSchedulerStarted = true;
  console.log("💧 Water reminder scheduler started (runs every minute)");
  dispatchWaterReminders();
  setInterval(dispatchWaterReminders, 60 * 1000);
};

const startMenuPreviewScheduler = () => {
  if (menuPreviewSchedulerStarted) return;
  menuPreviewSchedulerStarted = true;
  console.log("🥘 Menu preview scheduler started (runs every minute)");
  dispatchMenuPreviewReminders();
  setInterval(dispatchMenuPreviewReminders, 60 * 1000);
};

const startAllNotificationSchedulers = () => {
  startMealReminderScheduler();
  startWaterReminderScheduler();
  startMenuPreviewScheduler();
};

// Get user notifications from database
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.body.userId;
    const notifications = await notificationModel.find({
      userId,
      type: { $ne: "meal" }
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    console.error("Error getting notifications:", error);
    res.json({
      success: false,
      message: "Error getting notifications"
    });
  }
};

// Mark notification as read
const markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    await notificationModel.findByIdAndUpdate(notificationId, { read: true });

    res.json({
      success: true,
      message: "Notification marked as read"
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.json({
      success: false,
      message: "Error marking notification as read"
    });
  }
};

// Create notification record (for local/client-triggered notifications)
const logNotification = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { type, title, body, data } = req.body;

    if (!type || !title || !body) {
      return res.json({
        success: false,
        message: "type, title and body are required"
      });
    }

    await notificationModel.create({
      userId,
      type,
      title,
      body,
      data: data || {}
    });

    res.json({ success: true, message: "Notification logged" });
  } catch (error) {
    console.error("Error logging notification:", error);
    res.json({ success: false, message: "Error logging notification" });
  }
};

export {
  subscribeUser,
  unsubscribeUser,
  sendNotificationToUser,
  notifyNewComment,
  notifyNewLike,
  notifyNewFollow,
  notifyMealSchedule,
  notifyStreakEncouragement,
  startMealReminderScheduler,
  startAllNotificationSchedulers,
  getUserNotifications,
  markNotificationRead,
  logNotification
};
