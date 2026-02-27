import webpush from 'web-push';
import NotificationSubscription from '../models/notificationSubscriptionModel.js';
import notificationModel from '../models/notificationModel.js';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const subscribeUser = async (req, res) => {
  try {
    console.log('📝 subscribeUser called');
    const { subscription } = req.body;
    const userId = req.body.userId.toString();
    console.log('   userId:', userId, 'type:', typeof userId);
    console.log('   endpoint:', subscription.endpoint.substring(0, 50) + '...');

    const existingSubscription = await NotificationSubscription.findOne({
      endpoint: subscription.endpoint
    });

    if (existingSubscription) {
      console.log('   ℹ️ Subscription already exists');
      console.log('   Existing userId:', existingSubscription.userId, 'type:', typeof existingSubscription.userId);
      // Update userId if different
      if (existingSubscription.userId !== userId) {
        console.log('   🔄 Updating userId');
        existingSubscription.userId = userId;
        await existingSubscription.save();
      }
      return res.json({ success: true, message: 'Already subscribed' });
    }

    const newSub = await NotificationSubscription.create({
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: req.headers['user-agent']
    });
    console.log('   ✅ Subscription saved:', newSub._id);
    console.log('   Saved userId:', newSub.userId, 'type:', typeof newSub.userId);

    res.json({ success: true, message: 'Subscribed successfully' });
  } catch (error) {
    console.error('❌ Subscribe error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const unsubscribeUser = async (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.body.userId;

    await NotificationSubscription.deleteOne({ userId, endpoint });

    res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const sendNotificationToUser = async (userId, payload) => {
  try {
    console.log('📤 sendNotificationToUser called');
    const userIdStr = userId.toString();
    console.log('   userId:', userIdStr);
    console.log('   payload:', payload);
    
    const subscriptions = await NotificationSubscription.find({ userId: userIdStr });
    console.log('   Found subscriptions:', subscriptions.length);
    if (subscriptions.length > 0) {
      console.log('   Subscription details:', subscriptions.map(s => ({ userId: s.userId, endpoint: s.endpoint.substring(0, 30) })));
    }

    if (subscriptions.length === 0) {
      console.log('   ⚠️ No subscriptions found for user');
      return;
    }

    for (const sub of subscriptions) {
      try {
        console.log('   📨 Sending to endpoint:', sub.endpoint.substring(0, 50) + '...');
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys
          },
          JSON.stringify(payload)
        );
        console.log('   ✅ Notification sent');
      } catch (error) {
        console.log('   ❌ Send error:', error.statusCode, error.message);
        if (error.statusCode === 410) {
          // Subscription expired
          console.log('   🗑️ Deleting expired subscription');
          await NotificationSubscription.deleteOne({ _id: sub._id });
        }
      }
    }
  } catch (error) {
    console.error('Send notification error:', error);
  }
};

const notifyNewComment = async (userId, commenterName, postPreview) => {
  // Ensure userId is string for consistency
  const userIdStr = userId.toString();
  
  const payload = {
    title: 'Bình luận mới',
    body: `${commenterName} đã bình luận: ${postPreview}`,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'comment-notification',
    requireInteraction: false
  };
  
  // Save to DB for in-app notifications
  await notificationModel.create({
    userId: userIdStr,
    title: payload.title,
    body: payload.body,
    type: 'comment'
  });
  
  // Send push notification
  await sendNotificationToUser(userIdStr, payload);
};

const notifyNewLike = async (userId, likerName, postPreview) => {
  // Ensure userId is string for consistency
  const userIdStr = userId.toString();
  
  const payload = {
    title: 'Lượt thích mới',
    body: `${likerName} đã thích bài viết của bạn`,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'like-notification',
    requireInteraction: false
  };
  
  // Save to DB for in-app notifications
  await notificationModel.create({
    userId: userIdStr,
    title: payload.title,
    body: payload.body,
    type: 'like'
  });
  
  // Send push notification
  await sendNotificationToUser(userIdStr, payload);
};

const notifyMealSchedule = async (userId, mealName, mealTime) => {
  const payload = {
    title: 'Nhắc nhở bữa ăn',
    body: `Đã đến lúc ăn ${mealName} lúc ${mealTime}`,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'meal-reminder',
    requireInteraction: true
  };
  
  // Save to DB for in-app notifications
  await notificationModel.create({
    userId,
    title: payload.title,
    body: payload.body,
    type: 'meal'
  });
  
  // Send push notification
  await sendNotificationToUser(userId, payload);
};

const getUserNotifications = async (req, res) => {
  try {
    console.log('📬 getUserNotifications called');
    const userId = req.body.userId.toString();
    console.log('   userId:', userId);
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;

    const notifications = await notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await notificationModel.countDocuments({ userId });
    console.log('   Found notifications:', notifications.length);

    res.json({
      success: true,
      notifications,
      total,
      unreadCount: await notificationModel.countDocuments({ userId, read: false })
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.body.userId.toString();

    const notification = await notificationModel.findById(notificationId);
    
    if (!notification || notification.userId !== userId) {
      return res.json({ success: false, message: 'Notification not found' });
    }

    notification.read = true;
    await notification.save();

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.body.userId.toString();

    const notification = await notificationModel.findById(notificationId);
    
    if (!notification || notification.userId !== userId) {
      return res.json({ success: false, message: 'Notification not found' });
    }

    await notificationModel.deleteOne({ _id: notificationId });

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  subscribeUser,
  unsubscribeUser,
  sendNotificationToUser,
  notifyNewComment,
  notifyNewLike,
  notifyMealSchedule,
  getUserNotifications,
  markNotificationAsRead,
  deleteNotification
};
