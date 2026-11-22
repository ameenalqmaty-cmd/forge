/* Forge phone notifications (web / installed web app). Registered by cloud.push.enable() with its own scope
   ("./forge-push/") so it never competes with an app's own service worker. Forge-managed file: do not edit. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: event.data && event.data.text() }; }
  const base = self.registration.scope.replace(/forge-push\/?$/, "");
  // an open page plays the tone itself (a push can't); see src/lib/sound.ts
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => all.forEach((c) => c.postMessage({ type: "forge-push", title: d.title || "تنبيه جديد", body: d.body || "" }))));
  event.waitUntil(self.registration.showNotification(d.title || "تنبيه جديد", {
    body: d.body || "",
    icon: base + "icons/icon-192.png",
    badge: base + "icons/badge-96.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    requireInteraction: !!d.urgent,
    dir: "rtl",
    lang: "ar",
    data: { url: new URL(d.url || "./", base).href },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope.replace(/forge-push\/?$/, "");
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = all.find((c) => c.url.startsWith(url.split("#")[0]));
    if (open) { await open.focus(); return; }
    await self.clients.openWindow(url);
  })());
});
