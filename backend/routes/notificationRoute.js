import express from 'express';
import { subscribeUser, unsubscribeUser, sendNotificationToUser, notifyNewComment, notifyNewLike, notifyMealSchedule, getUserNotifications, markNotificationAsRead, deleteNotification } from '../controllers/notificationController.js';
import authMiddleware from '../middleware/auth.js';
import NotificationSubscription from '../models/notificationSubscriptionModel.js';

const notificationRouter = express.Router();

// Routes without parameters first
notificationRouter.get('/vapid-key', (req, res) => {
  res.json({ vapidPublicKey: process.env.VAPID_PUBLIC_KEY });
});

notificationRouter.get('/list', authMiddleware, getUserNotifications);

// Debug routes
notificationRouter.get('/debug/subscriptions', authMiddleware, async (req, res) => {
  try {
    const userId = req.body.userId.toString();
    const subs = await NotificationSubscription.find({ userId });
    res.json({ 
      success: true, 
      userId,
      subscriptionCount: subs.length,
      subscriptions: subs.map(s => ({ 
        _id: s._id, 
        userId: s.userId,
        endpoint: s.endpoint.substring(0, 50) + '...',
        createdAt: s.createdAt 
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

notificationRouter.get('/debug/all-subscriptions', authMiddleware, async (req, res) => {
  try {
    const allSubs = await NotificationSubscription.find().limit(10);
    res.json({ 
      success: true, 
      totalCount: await NotificationSubscription.countDocuments(),
      subscriptions: allSubs.map(s => ({ 
        _id: s._id, 
        userId: s.userId,
        endpoint: s.endpoint.substring(0, 50) + '...',
        createdAt: s.createdAt 
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

notificationRouter.post('/debug/clear-all', authMiddleware, async (req, res) => {
  try {
    const result = await NotificationSubscription.deleteMany({});
    console.log('🗑️ Deleted all subscriptions:', result.deletedCount);
    res.json({ success: true, message: `Deleted ${result.deletedCount} subscriptions` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

notificationRouter.post('/debug/migrate-userid', authMiddleware, async (req, res) => {
  try {
    // Find all subscriptions and convert userId to string
    const allSubs = await NotificationSubscription.find();
    let updated = 0;
    
    for (const sub of allSubs) {
      const userIdStr = sub.userId.toString();
      if (sub.userId !== userIdStr) {
        sub.userId = userIdStr;
        await sub.save();
        updated++;
      }
    }
    
    console.log('🔄 Migrated userId format:', updated);
    res.json({ success: true, message: `Migrated ${updated} subscriptions` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Regular routes
notificationRouter.post('/subscribe', authMiddleware, subscribeUser);
notificationRouter.post('/unsubscribe', authMiddleware, unsubscribeUser);
notificationRouter.post('/unsubscribe-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.body.userId.toString();
    console.log('🗑️ Unsubscribe all for userId:', userId);
    const result = await NotificationSubscription.deleteMany({ userId });
    console.log('   Deleted:', result.deletedCount);
    res.json({ success: true, message: `Deleted ${result.deletedCount} subscriptions` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

notificationRouter.post('/test', authMiddleware, async (req, res) => {
  try {
    const userId = req.body.userId.toString();
    console.log('🧪 Test notification for userId:', userId);
    await sendNotificationToUser(userId, {
      title: 'Thông báo test',
      body: 'Đây là thông báo test từ GreenPath',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png'
    });
    res.json({ success: true, message: 'Test notification sent' });
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Routes with parameters after
notificationRouter.put('/:notificationId/read', authMiddleware, markNotificationAsRead);
notificationRouter.delete('/:notificationId', authMiddleware, deleteNotification);

export default notificationRouter;
