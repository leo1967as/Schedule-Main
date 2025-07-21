const fs = require('fs');
const path = require('path');
const envVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID',
  'FIREBASE_VAPID_KEY'
];
const env = {};
envVars.forEach(key => {
  env[key] = process.env[key] || '';
});
const outDir = path.join(__dirname, '../public/scripts');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'env.js'), `window.env = ${JSON.stringify(env)};`); 