/**
 * ALSAMLAH — Service Worker
 * Handles notification display and click events for QR orders.
 * Client posts a message via sw.postMessage(); SW shows the notification.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Show a notification when the main page posts a message
self.addEventListener("message", (event) => {
  if (event.data?.type !== "SHOW_NOTIFICATION") return;
  const { title, body, tag, icon } = event.data;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: tag ?? "qr-order",
      icon: icon ?? "/logo.png",
      badge: "/logo.png",
      renotify: true,
      requireInteraction: false,
      vibrate: [200, 100, 200],
    })
  );
});

// On notification click: focus an existing client or open a new one
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow("/");
      })
  );
});
