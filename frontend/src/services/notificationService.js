// Notification service for managing push notifications
class NotificationService {
  constructor() {
    this.serviceWorkerReady = false;
    this.isSubscribed = false;
    this.vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  }

  // Initialize service worker and notification support
  async init() {
    try {
      if (!('serviceWorker' in navigator)) {
        console.warn('Service Workers not supported');
        return false;
      }

      if (!('PushManager' in window)) {
        console.warn('Push Notifications not supported');
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      console.log('Service Worker registered:', registration);
      this.serviceWorkerReady = true;

      // Check if already subscribed
      const subscription = await registration.pushManager.getSubscription();
      this.isSubscribed = !!subscription;

      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  // Request notification permission
  async requestPermission() {
    try {
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
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  // Subscribe to push notifications
  async subscribe() {
    try {
      if (!this.serviceWorkerReady) {
        await this.init();
      }

      if (!this.vapidPublicKey) {
        console.warn('VAPID public key not configured');
        return false;
      }

      const permission = await this.requestPermission();
      if (!permission) {
        console.warn('Notification permission denied');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      this.isSubscribed = true;
      console.log('Subscribed to push notifications:', subscription);
      
      // Save subscription to backend
      await this.saveSubscription(subscription);

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        this.isSubscribed = false;
        
        // Remove subscription from backend
        await this.removeSubscription(subscription);
        
        console.log('Unsubscribed from push notifications');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      return false;
    }
  }

  // Save subscription to backend
  async saveSubscription(subscription) {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      
      const response = await fetch(`${apiUrl}/api/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription');
      }

      console.log('Subscription saved to backend');
      return true;
    } catch (error) {
      console.error('Failed to save subscription to backend:', error);
      return false;
    }
  }

  // Remove subscription from backend
  async removeSubscription(subscription) {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      
      const response = await fetch(`${apiUrl}/api/notifications/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to remove subscription');
      }

      console.log('Subscription removed from backend');
      return true;
    } catch (error) {
      console.error('Failed to remove subscription from backend:', error);
      return false;
    }
  }

  // Show local notification (for testing or when user is active)
  showNotification(title, options = {}) {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    const registration = navigator.serviceWorker.controller;
    if (registration) {
      registration.postMessage({
        type: 'SHOW_NOTIFICATION',
        payload: { title, options }
      });
    } else {
      new Notification(title, options);
    }
  }

  // Helper: Convert VAPID key from base64
  urlBase64ToUint8Array(base64String) {
    if (!base64String) {
      throw new Error('VAPID public key is empty');
    }

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

  // Send different types of notifications
  async notifyMealSchedule(mealName, time) {
    const title = '🍽️ Nhắc nhở bữa ăn';
    const options = {
      body: `Đã đến lúc ${mealName} lúc ${time}`,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'meal-notification',
      data: {
        type: 'meal',
        mealName,
        time
      }
    };
    
    this.showNotification(title, options);
  }

  async notifyNewComment(userName, postTitle) {
    const title = '💬 Bình luận mới';
    const options = {
      body: `${userName} đã bình luận: ${postTitle}`,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'comment-notification',
      data: {
        type: 'comment',
        userName,
        postTitle
      }
    };
    
    this.showNotification(title, options);
  }

  async notifyNewLike(userName, postTitle) {
    const title = '❤️ Có người thích bài viết';
    const options = {
      body: `${userName} thích: ${postTitle}`,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'like-notification',
      data: {
        type: 'like',
        userName,
        postTitle
      }
    };
    
    this.showNotification(title, options);
  }
}

export default new NotificationService();
