self.addEventListener("push", (event) => {
    if (!event.data) return;
    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = { title: "imshare", body: event.data.text() };
    }
    const title = payload.title || "imshare";
    const options = {
        body: payload.body || "You have a new notification.",
        tag: payload.tag,
        data: { url: payload.url || "/" },
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data?.url || "/";
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            const existing = clients.find((client) => "focus" in client);
            if (existing) {
                void existing.navigate(url);
                return existing.focus();
            }
            return self.clients.openWindow(url);
        }),
    );
});
