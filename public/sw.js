// ORBIT service worker: offline fallback + push notifications.
const CACHE = "orbit-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([OFFLINE_URL, "/icons/icon-192.png", "/brand/orbit-mark.png"]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Pages always come from the network; show the offline screen if that fails.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});

// ─── Push ───────────────────────────────────────────────────────────────────
// Payload (from src/lib/notifications): { title, body, url, tag?, actions?: [{ action, title, url }] }

function readPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}

/** Only same-origin paths, so a payload can never send someone off-site. */
function safePath(url) {
  try {
    const u = new URL(url || "/", self.location.origin);
    return u.origin === self.location.origin ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}

self.addEventListener("push", (event) => {
  const data = readPayload(event);
  const actions = Array.isArray(data.actions) ? data.actions.slice(0, 2) : [];
  const urls = { default: safePath(data.url) };
  for (const a of actions) urls[a.action] = safePath(a.url);

  event.waitUntil(
    self.registration.showNotification(data.title || "ORBIT", {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Same tag replaces the older notification instead of stacking duplicates.
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      timestamp: Date.now(),
      actions: actions.map((a) => ({ action: a.action, title: a.title })),
      data: { urls },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urls = event.notification.data?.urls ?? { default: event.notification.data?.url ?? "/" };
  const path = urls[event.action] ?? urls.default ?? "/";
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const exact = windows.find((w) => w.url === target);
      if (exact) return exact.focus();
      // Reuse an open ORBIT window rather than opening another one.
      const any = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (any && "navigate" in any) {
        await any.focus();
        return any.navigate(target).catch(() => self.clients.openWindow(target));
      }
      return self.clients.openWindow(target);
    }),
  );
});

// The browser rotated the push subscription: subscribe again and tell the server.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      const sub =
        event.newSubscription ||
        (old?.options?.applicationServerKey
          ? await self.registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: old.options.applicationServerKey,
            })
          : null);
      if (!sub) return;
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), oldEndpoint: old?.endpoint }),
      });
    })().catch(() => {}),
  );
});
