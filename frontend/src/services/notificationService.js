import axios from 'axios';

class NotificationService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
    this.registration = null;
    this.subscription = null;
    this.notificationCallback = null;
  }

  setNotificationCallback(callback) {
    this.notificationCallback = callback;
  }

  async init() {
    console.log('   🔧 Checking browser support...');
    if (!('serviceWorker' in navigator)) {
      console.warn('   ❌ Service Worker not supported');
      return false;
    }
    if (!('PushManager' in window)) {
      console.warn('   ❌ PushManager not supported');
      return false;
    }

    try {
      console.log('   📝 Registering service worker from /service-worker.js');
      this.registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('   ✅ Service Worker registered:', this.registration);
      return true;
    } catch (error) {
      console.error('   ❌ Service Worker registration failed:', error);
      return false;
    }
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  async subscribe(token) {
    try {
      if (Notification.permission !== 'granted') {
        console.warn('⚠️ Notification permission not granted:', Notification.permission);
        throw new Error('Notification permission not granted');
      }

      console.log('🔐 subscribe() called');
      console.log('   apiUrl:', this.apiUrl);
      console.log('   token:', token ? 'YES' : 'NO');
      console.log('   registration:', this.registration ? 'YES' : 'NO');

      if (!this.registration) {
        throw new Error('Service Worker not registered');
      }

      const response = await axios.get(`${this.apiUrl}/api/notifications/vapid-key`);
      const vapidPublicKey = response.data.vapidPublicKey;
      console.log('   ✅ Got VAPID key:', vapidPublicKey.substring(0, 20) + '...');

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      });
      console.log('   ✅ Got push subscription');
      console.log('   endpoint:', subscription.endpoint.substring(0, 50) + '...');

      await this.saveSubscription(subscription, token);
      console.log('   ✅ Saved subscription to backend');
      this.subscription = subscription;
      return true;
    } catch (error) {
      console.error('❌ Subscribe error:', error.message);
      return false;
    }
  }

  async unsubscribe(token) {
    try {
      if (this.subscription) {
        await this.removeSubscription(this.subscription, token);
        await this.subscription.unsubscribe();
        this.subscription = null;
      }
      return true;
    } catch (error) {
      console.error('Unsubscribe error:', error);
      return false;
    }
  }

  async saveSubscription(subscription, token) {
    try {
      console.log('💾 saveSubscription() called');
      console.log('   URL:', `${this.apiUrl}/api/notifications/subscribe`);
      console.log('   token:', token ? 'YES' : 'NO');
      
      await axios.post(
        `${this.apiUrl}/api/notifications/subscribe`,
        { subscription: subscription.toJSON() },
        { headers: { token } }
      );
      console.log('   ✅ Subscription saved');
    } catch (error) {
      console.error('Save subscription error:', error);
      throw error;
    }
  }

  async removeSubscription(subscription, token) {
    try {
      await axios.post(
        `${this.apiUrl}/api/notifications/unsubscribe`,
        { endpoint: subscription.endpoint },
        { headers: { token } }
      );
    } catch (error) {
      console.error('Remove subscription error:', error);
      throw error;
    }
  }

  showNotification(title, options = {}) {
    if (this.registration) {
      this.registration.showNotification(title, {
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        ...options
      });
    }
  }

  notifyMealSchedule(mealName, mealTime) {
    const notification = {
      title: 'Nhắc nhở bữa ăn',
      body: `Đã đến lúc ăn ${mealName} lúc ${mealTime}`,
      timestamp: new Date()
    };
    if (this.notificationCallback) {
      this.notificationCallback(notification);
    }
    this.showNotification(notification.title, {
      body: notification.body,
      tag: 'meal-reminder',
      requireInteraction: true
    });
  }

  notifyNewComment(userName, postPreview) {
    const notification = {
      title: 'Bình luận mới',
      body: `${userName} đã bình luận: ${postPreview}`,
      timestamp: new Date()
    };
    if (this.notificationCallback) {
      this.notificationCallback(notification);
    }
    this.showNotification(notification.title, {
      body: notification.body,
      tag: 'comment-notification'
    });
  }

  notifyNewLike(userName, postPreview) {
    const notification = {
      title: 'Lượt thích mới',
      body: `${userName} đã thích bài viết của bạn`,
      timestamp: new Date()
    };
    if (this.notificationCallback) {
      this.notificationCallback(notification);
    }
    this.showNotification(notification.title, {
      body: notification.body,
      tag: 'like-notification'
    });
  }
}

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export default new NotificationService(apiUrl);
