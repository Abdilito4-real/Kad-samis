// Kadsamis push service worker.
// Hand-written on purpose — the workbox-window devDependency in
// package.json isn't wired to anything, and this needs nothing beyond
// push + notificationclick.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A no-op handler — this worker doesn't cache or intercept anything, every
// request just falls through to the network exactly as if this listener
// didn't exist. It exists only because some browsers still gate PWA
// installability (the "Download app" button on the landing page) on the
// active service worker having a fetch handler at all.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let payload = { title: "Kadsamis", message: "You have a new notification.", url: "/notifications" };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.message = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.message,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/notifications" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
