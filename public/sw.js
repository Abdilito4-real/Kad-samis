// Kadsamis push service worker.
// Hand-written on purpose — the workbox-window devDependency in
// package.json isn't wired to anything, and this needs nothing beyond
// push + notificationclick + the offline-page fallback below.

const OFFLINE_CACHE = "kadsamis-offline-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  // Pre-cache the offline fallback page while we're (presumably) still
  // online, so it's actually available from cache once we're not. Best
  // effort: if this fetch itself fails (e.g. installing while offline),
  // don't block activation over it — the fetch handler below already
  // tolerates a cache miss.
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Everything except page navigations still falls straight through to the
// network untouched — this worker doesn't cache or serve stale API
// responses, JS/CSS chunks, or images, exactly as before. The one thing it
// now catches is a failed *navigation* (opening/reloading a route directly
// with no connection), which it answers with the pre-cached offline page
// instead of the browser's default "no internet" error.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((cached) => cached || Response.error())
    )
  );
});

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
