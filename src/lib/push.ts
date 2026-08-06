"use client";

import { createClient } from "@/lib/supabase/client";

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// Web Push wants the VAPID public key as a Uint8Array, but env vars are
// plain base64url strings — this is the standard conversion.
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function authHeaders() {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase client not initialized");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("No authenticated session");
  return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
}

/** Current browser subscription for this device, if any — read straight from the Push API, no network round trip. */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  // getRegistration() resolves immediately (with undefined if nothing's
  // registered yet). navigator.serviceWorker.ready, used here originally,
  // only resolves once a worker is active — before the user ever clicks
  // Enable there isn't one yet, so `ready` just hangs forever and this
  // check (and the "Enable" button waiting on it) never completes.
  const registration = await navigator.serviceWorker.getRegistration("/sw.js").catch(() => undefined);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported in this browser");
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("Push notifications are not configured (missing VAPID public key)");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const json = subscription.toJSON();
  const headers = await authHeaders();
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      userAgent: navigator.userAgent,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to save push subscription");
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  try {
    const headers = await authHeaders();
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      credentials: "include",
      headers,
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    // The browser-side unsubscribe already succeeded; a failed server
    // cleanup just leaves a dead row that the next send attempt prunes.
  }
}
