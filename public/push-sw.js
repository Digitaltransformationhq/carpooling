// Push handlers, pulled into the Workbox-generated service worker via
// `workbox.importScripts` in vite.config.ts.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "CACommute", {
      body: data.body || "",
      icon: "/pwa-192x192.png",
      // Same tag = the newer alert replaces the older one about the same
      // booking/ride instead of stacking up.
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/";
  const url = new URL(path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        // Let the running app route in-place (keeps its state, no reload).
        open.postMessage({ type: "cacommute:navigate", url: path });
        return;
      }
      await self.clients.openWindow(url);
    })()
  );
});
