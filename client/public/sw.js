/* eslint-env serviceworker */
/// <reference lib="webworker" />


// Install event — activate immediately without waiting
self.addEventListener("install", () => {
    self.skipWaiting();
});

// Activate event — take control of all clients immediately
self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

// Push event — fires when backend sends a push notification
self.addEventListener("push", (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch (e) {
        // If payload is not JSON, use raw text as body
        payload = { title: "New Notification", body: event.data.text() };
    }

    const title = payload.title || "Chit Fund App";
    const options = {
        body: payload.body || "",
        icon: "/icons/icon-512.png",   // add your app icon here
        badge: "/icons/icon-192.png",    // small monochrome badge icon
        tag: payload.type || "default",  // groups similar notifications
        data: { url: payload.url || "/" }, // URL to open on click
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click event — opens the app when user taps the notification
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || "/";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true })
            .then((clients) => {
                // If app is already open, focus it
                const existingClient = clients.find(c => c.url.includes(self.location.origin));
                if (existingClient) {
                    return existingClient.focus();
                }
                // Otherwise open a new window
                return self.clients.openWindow(urlToOpen);
            })
    );
});


// Basic fetch listener for PWA requirement. 
// Without this, Chrome will not show the "Install App" prompt.
self.addEventListener("fetch", (event) => {
    // For now, just let the browser handle requests normally.
    // You can add caching logic here later if you want the app to work offline.
});