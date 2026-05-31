// Service Worker for handling push notifications

const APP_ICON = '/logo.png';
const APP_BADGE = '/logo.png';
const APP_NAME = 'GreenPath';

// Build YouTube-style notification options based on notification type
function buildNotificationOptions(data) {
  const type = (data.data && data.data.type) || 'general';
  const icon = (data.data && data.data.userAvatar) ? data.data.userAvatar : (data.icon || APP_ICON);

  const base = {
    body: data.body || '',
    icon: icon,
    badge: APP_BADGE,
    tag: data.tag || 'notification',
    timestamp: Date.now(),
    vibrate: [200, 100, 200],
    silent: false,
    requireInteraction: false,
    data: data.data || {},
  };

  if (type === 'meal') {
    return {
      ...base,
      icon: APP_ICON,
      actions: [
        { action: 'view', title: '🍽️ Xem thực đơn' },
        { action: 'dismiss', title: 'Bỏ qua' }
      ]
    };
  }

  if (type === 'water') {
    return {
      ...base,
      icon: APP_ICON,
      vibrate: [100, 50, 100],
      actions: [
        { action: 'view', title: '💧 OK, nhớ rồi!' },
        { action: 'dismiss', title: 'Bỏ qua' }
      ]
    };
  }

  if (type === 'streak') {
    return {
      ...base,
      icon: APP_ICON,
      requireInteraction: true,
      actions: [
        { action: 'view', title: '🔥 Xem Streak' },
        { action: 'dismiss', title: 'Bỏ qua' }
      ]
    };
  }

  if (type === 'comment') {
    return {
      ...base,
      actions: [
        { action: 'view', title: '💬 Xem bình luận' },
        { action: 'dismiss', title: 'Bỏ qua' }
      ]
    };
  }

  if (type === 'like') {
    return {
      ...base,
      actions: [
        { action: 'view', title: '❤️ Xem bài viết' },
        { action: 'dismiss', title: 'Bỏ qua' }
      ]
    };
  }

  if (type === 'follow') {
    return {
      ...base,
      actions: [
        { action: 'view', title: '👤 Xem trang cá nhân' },
        { action: 'dismiss', title: 'Bỏ qua' }
      ]
    };
  }

  return base;
}

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    // Forward to open tabs for in-app handling
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'PUSH_RECEIVED', notificationData: data });
      });
    });

    const options = buildNotificationOptions(data);

    event.waitUntil(
      self.registration.showNotification(data.title || APP_NAME, options)
    );
  } catch (error) {
    console.error('Error handling push notification:', error);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const action = event.action;

  // User clicked "Bỏ qua" — just close
  if (action === 'dismiss') return;

  let urlToOpen = '/';

  const type = notificationData.type;
  if (type === 'comment' || type === 'like') {
    urlToOpen = `/community?post=${notificationData.postId || ''}`;
  } else if (type === 'follow') {
    urlToOpen = `/profile/${notificationData.followerId || ''}`;
  } else if (type === 'meal') {
    urlToOpen = '/home';
  } else if (type === 'water') {
    urlToOpen = '/home';
  } else if (type === 'streak') {
    urlToOpen = '/home';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag);
});
