// Browser-side web-push helpers for <NotificationSettings />.

export type PushSupport = "supported" | "ios-install" | "ios-update" | "unsupported" | "not-configured";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function isIOS() {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but has touch.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function detectPushSupport(): PushSupport {
  const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIOS()) {
    // iOS only exposes web push to apps added to the home screen (iOS 16.4+).
    if (!isStandalone()) return "ios-install";
    if (!hasApis) return "ios-update";
  }
  if (!hasApis) return "unsupported";
  if (!VAPID_PUBLIC_KEY) return "not-configured";
  return "supported";
}

export function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array) {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

/** The service worker registration, registering /sw.js if needed (dev doesn't auto-register). */
export async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

async function post(path: string, method: "POST" | "DELETE", body: unknown) {
  const res = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
  return json;
}

export function saveSubscription(sub: PushSubscription) {
  return post("/api/push/subscribe", "POST", { subscription: sub.toJSON() });
}

/** Asks for permission, subscribes this browser and stores it. Returns the permission result. */
export async function subscribeThisDevice(): Promise<NotificationPermission> {
  const reg = await getRegistration();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe(); // made with an old server key
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await saveSubscription(sub);
  return permission;
}

export async function unsubscribeThisDevice() {
  const sub = await currentSubscription();
  if (!sub) return;
  await post("/api/push/subscribe", "DELETE", { endpoint: sub.endpoint });
  await sub.unsubscribe();
}

export function sendTestPush() {
  return post("/api/push/test", "POST", {});
}
