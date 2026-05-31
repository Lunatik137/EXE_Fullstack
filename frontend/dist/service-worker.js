// Service Worker for handling push notifications

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('🔔 Service Worker: Push event received!', event);
  
  // Also log to main console via postMessage
  self.clients.matchAll().then(clients => {
    const data = event.data ? event.data.json() : {};
    console.log('📱 Service Worker: Notification data:', data);
    
    clients.forEach(client => {
      client.postMessage({
        type: 'PUSH_RECEIVED',
        message: '🔔 Push notification received in service worker!',
        notificationData: data
      });
    });
  });
  
  console.log('🔔 Push event received:', event);
  
  if (!event.data) {
    console.log('Push notification received but no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('📱 Push notification data:', data);
    
    const options = {
      body: data.body || 'You have a new notification',
      icon: data.icon || '/logo.png',
      badge: data.badge || '/logo.png',
      tag: data.tag || 'notification',
      requireInteraction: true,
      data: data.data || {}
    };

    console.log('📢 Showing notification with options:', options);

    event.waitUntil(
      self.registration.showNotification(data.title || 'GreenPath', options)
        .then(() => console.log('✅ Notification shown successfully'))
        .catch(error => console.error('❌ Failed to show notification:', error))
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
