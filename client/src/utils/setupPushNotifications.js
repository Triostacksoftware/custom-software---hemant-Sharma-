// ─────────────────────────────────────────────────────────────────────────────
// setupPushNotifications.js
// Place in your React src/utils/ folder.
//
// Call this once after login for all three portals (member, employee, admin).
// It registers the service worker, requests notification permission, subscribes
// the browser to web push, and sends the subscription to the backend.
//
// Usage in your login success handler:
//   import { setupPushNotifications } from "../utils/setupPushNotifications";
//   await setupPushNotifications(api.savePushSubscription);
//
// The `saveSubscriptionFn` argument is the API call that saves the subscription.
// Pass the appropriate one per portal:
//   Member:   userApi.savePushSubscription
//   Employee: employeeApi.savePushSubscription
//   Admin:    adminApi.savePushSubscription
// ─────────────────────────────────────────────────────────────────────────────

export async function setupPushNotifications(saveSubscriptionFn) {

    // Check browser support
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.log("Push notifications not supported in this browser");
        return;
    }

    try {
        // Register service worker
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("Service worker registered");

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            console.log("Notification permission denied");
            return;
        }

        // Check if already subscribed
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
            // Already subscribed — re-send to backend in case it was cleared
            await saveSubscriptionFn({ subscription: existingSubscription });
            return;
        }

        // Subscribe to push
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
                process.env.REACT_APP_VAPID_PUBLIC_KEY
            )
        });

        // Save subscription to backend
        await saveSubscriptionFn({ subscription });
        console.log("Push subscription saved");

    } catch (err) {
        console.error("Push notification setup failed:", err);
    }
}


// Helper: converts VAPID public key from base64 string to Uint8Array
// Required by the PushManager.subscribe() call
function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}