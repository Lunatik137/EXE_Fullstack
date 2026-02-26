// Service Worker for handling push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let notificationData = {
    title: 'GreenPath',
    body: 'Bạn có thông báo mới!',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'notification',
    requireInteraction: false
  };

  if (event.data) {
    try {
      notificationData = {
        ...notificationData,
        ...event.data.json()
      };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data || {}
    })
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  const notificationData = event.notification.data;
  let targetUrl = '/';

  if (notificationData.type === 'comment') {
    targetUrl = notificationData.postId ? `/community?post=${notificationData.postId}` : '/community';
  } else if (notificationData.type === 'like') {
    targetUrl = notificationData.postId ? `/community?post=${notificationData.postId}` : '/community';
  } else if (notificationData.type === 'meal') {
    targetUrl = '/home';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});
