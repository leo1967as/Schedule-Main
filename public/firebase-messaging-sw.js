self.env = { 
  FIREBASE_API_KEY: "AIzaSyC452vdQ6_77OWElN6vvEbAzn_lA4DvPk0",
  FIREBASE_AUTH_DOMAIN: "beit67.firebaseapp.com",
  FIREBASE_PROJECT_ID: "beit67",
  FIREBASE_STORAGE_BUCKET: "beit67.appspot.com",
  FIREBASE_MESSAGING_SENDER_ID: "909474812266",
  FIREBASE_APP_ID: "1:909474812266:web:c69149ad52c43085441513",
  FIREBASE_MEASUREMENT_ID: "G-SFPMXYCJNG",
  FIREBASE_VAPID_KEY: "BDMTIb2DErhAzW9wzREcxfQb-c5vbA39q8OZqQewh-aQtshlT90koKsUVgxezcCwA91HIio1pcqqyaa6ecFOqBk"
};
// Import and initialize the Firebase SDK
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

const env = self.env;
const firebaseConfig = {
    apiKey: env.FIREBASE_API_KEY,
    authDomain: env.FIREBASE_AUTH_DOMAIN,
    projectId: env.FIREBASE_PROJECT_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
    appId: env.FIREBASE_APP_ID,
    measurementId: env.FIREBASE_MEASUREMENT_ID
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Optional: Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/android-chrome-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});