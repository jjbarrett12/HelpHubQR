self.addEventListener("push", function (event) {
  if (!event.data) return;
  let payload = { title: "HelpHub", body: "", url: "/app" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch (_) {
    payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "HelpHub", {
      body: payload.body,
      data: { url: payload.url || "/app" },
      tag: payload.tag || "helphub-push",
      requireInteraction: false,
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/app";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
