import mongoose from "mongoose";

const notificationSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true
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
      default: Date.now
    }
  },
  { timestamps: true }
);

const notificationSubscriptionModel = mongoose.model(
  "notificationSubscription",
  notificationSubscriptionSchema
);

export default notificationSubscriptionModel;
