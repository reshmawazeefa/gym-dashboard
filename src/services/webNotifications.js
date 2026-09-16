import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { app } from "../config/firebase";

export async function getWebPushToken() {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey || typeof window === "undefined" || !("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  if (!(await isSupported())) return null;

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(app);
    return await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  } catch (error) {
    console.warn("Unable to initialize web push notifications", error);
    return null;
  }
}

export async function requestWebPushPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  const permission = await Notification.requestPermission();
  return permission === "granted" ? getWebPushToken() : null;
}
