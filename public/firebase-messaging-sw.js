/* global importScripts, firebase */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCHvsKUo-AhO3FQgW9Otm9WyPC-Dsztj1I",
  authDomain: "wazeefa-gym.firebaseapp.com",
  projectId: "wazeefa-gym",
  storageBucket: "wazeefa-gym.firebasestorage.app",
  messagingSenderId: "152647755436",
  appId: "1:152647755436:web:49f506a788ad432e56e109",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Gym notification";
  const options = {
    body: payload.notification?.body || "You have a new update.",
    icon: "/favicon.svg",
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/modules/notifications"));
});
