// Service Worker for handling push notifications

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push notification received but no data');
    return;
  }

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'You have a new notification',
      icon: '/food-icon.png',
      badge: '/food-badge.png',
      tag: data.tag || 'notification',
      requireInteraction: true,
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Food Delivery', options)
    );
  } catch (error) {
    console.error('Error handling push notification:', error);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  let urlToOpen = '/';

  // Route to different pages based on notification type
  if (notificationData.type === 'comment' || notificationData.type === 'like') {
    // Route to community page with post ID
    urlToOpen = `/community?post=${notificationData.postId || ''}`;
  } else if (notificationData.type === 'meal') {
    // Route to home page for meal reminders
    urlToOpen = '/home';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag);
});
