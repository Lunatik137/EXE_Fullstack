import mongoose from 'mongoose';

const notificationSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  endpoint: {
    type: String,
    required: true,
    unique: true
  },
  keys: {
    p256dh: String,
    auth: String
  },
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000 // 30 days TTL
  }
});

export default mongoose.model('NotificationSubscription', notificationSubscriptionSchema);
