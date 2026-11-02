// Kadsamis push service worker. It caches the offline fallback and static
// app files only; navigations and API responses always use the network.

const APP_CACHE = "kadsamis-app-v2";
const OFFLINE_URL = "/offline";
const STATIC_ASSETS = ["/manifest.json", "/icon-192.png", "/icon-512.png", "/icon-maskable.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then(async (cache) => {
        await cache.add(OFFLINE_URL);
        await Promise.all(STATIC_ASSETS.map((asset) => cache.add(asset).catch(() => undefined)));
      })
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.match(OFFLINE_URL))
      .then((offlinePage) => {
        if (!offlinePage) return;
        return caches.keys().then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("kadsamis-app-") && key !== APP_CACHE)
              .map((key) => caches.delete(key))
          )
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((cached) => cached || Response.error())
      )
    );
    return;
  }

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/images/") ||
    STATIC_ASSETS.includes(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.put(request, copy)));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || Response.error())
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
