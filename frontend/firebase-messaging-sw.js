// Handles push notifications that arrive while no tab of the app is open
// or focused (the "background" case) — this is what makes a notification
// show up on the lock screen / notification tray for the web version.
// Must be served at the site root as exactly this filename.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCgkCYOnlmSeVkzcfBkcUnOjKnZ0FV5OLw",
  authDomain: "kaya-lounge.firebaseapp.com",
  projectId: "kaya-lounge",
  storageBucket: "kaya-lounge.firebasestorage.app",
  messagingSenderId: "636522772592",
  appId: "1:636522772592:web:a9bd6dd7451dec22f9dcb5"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'The Kaya Lounge';
  const body = (payload.notification && payload.notification.body) || '';
  self.registration.showNotification(title, { body, icon: '/icons/icon-192.png' });
});
