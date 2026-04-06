/**
 * push.ts — Browser notification helpers for ALSAMLAH
 *
 * Strategy: uses the Service Worker Notification API (no backend required).
 * The Realtime subscription detects new QR orders; when one arrives,
 * we post a message to the SW and it shows a notification — even when the
 * tab is in the background or minimised.
 */

/** Register the service worker (call once on app load). */
export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch {
    return null;
  }
}

/** Current notification permission status. */
export function notifPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Request permission; resolves to the new permission string. */
export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return await Notification.requestPermission();
}

/** Show a notification via the service worker (works even if tab is hidden). */
export async function showOrderNotification(opts: {
  title: string;
  body: string;
  tag?: string;
  logo?: string | null;
}) {
  if (notifPermission() !== "granted") return;

  // Prefer service worker (works in background)
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (reg?.active) {
      reg.active.postMessage({
        type: "SHOW_NOTIFICATION",
        title: opts.title,
        body: opts.body,
        tag: opts.tag ?? "qr-order",
        icon: opts.logo ?? "/logo.png",
      });
      return;
    }
  }

  // Fallback: direct Notification (only works when tab is visible)
  try {
    new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag ?? "qr-order",
      icon: "/logo.png",
    });
  } catch (_) {
    // ignore
  }
}
