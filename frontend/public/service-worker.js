console.log('🔧 Service Worker loaded');

self.addEventListener('push', (event) => {
  console.log('📨 Push event received:', event);
  const data = event.data ? event.data.json() : {};
  console.log('   Data:', data);
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Thông báo', {
      body: data.body || 'Bạn có thông báo mới',
      icon: data.icon || '/icon-192x192.png',
      badge: data.badge || '/badge-72x72.png',
      tag: data.tag || 'notification',
      requireInteraction: data.requireInteraction || false,
      data: {
        url: data.url || '/'
      }
    }).then(() => {
      console.log('   ✅ Notification shown');
    }).catch(err => {
      console.error('   ❌ Error showing notification:', err);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Notification clicked:', event.notification.tag);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});

self.addEventListener('install', (event) => {
  console.log('📦 Service Worker installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  event.waitUntil(clients.claim());
});
