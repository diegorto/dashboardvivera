self.addEventListener('install', function(event) {
  self.skipWaiting();
});
self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  var title = data.title || 'Vivera CRM';
  var options = {
    body: data.body || '',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    data: { url: data.url || '/whatsapp.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/whatsapp.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var c = clientList[i];
        if ('focus' in c) { c.focus(); c.navigate(url); return; }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
