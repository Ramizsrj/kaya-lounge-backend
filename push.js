// Sends real push notifications (lock screen / notification tray) via
// Firebase Cloud Messaging, to both the Android app and any browser tab
// that has granted notification permission.
//
// Set FIREBASE_SERVICE_ACCOUNT (on Render: Environment tab) to the full
// contents of the Firebase service account JSON file, as a single-line
// string, to enable this. Without it, push sending is skipped (logged to
// the console instead) so local dev doesn't need real credentials.
const admin = require('firebase-admin');

let app = null;
const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
if (raw) {
  try {
    const serviceAccount = JSON.parse(raw);
    app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('Firebase Admin initialized — push notifications enabled.');
  } catch (err) {
    console.error('Could not initialize Firebase Admin (check FIREBASE_SERVICE_ACCOUNT):', err.message);
  }
} else {
  console.log('No FIREBASE_SERVICE_ACCOUNT set — push notifications will be skipped (logged only).');
}

// Sends one notification to a list of device/browser tokens. Automatically
// drops tokens that have expired or been unregistered (the caller should
// remove those from storage using the returned `invalidTokens` list).
async function sendToTokens(tokens, { title, body }) {
  const list = (tokens || []).filter(Boolean);
  if (!list.length) return { sent: 0, invalidTokens: [] };
  if (!app) {
    console.log(`[push] Firebase not configured — would have sent to ${list.length} device(s): "${title}" — ${body}`);
    return { sent: 0, invalidTokens: [] };
  }
  const message = { notification: { title, body }, tokens: list };
  const res = await admin.messaging().sendEachForMulticast(message);
  const invalidTokens = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        invalidTokens.push(list[i]);
      } else {
        console.error('Push send failed for one token:', code || r.error);
      }
    }
  });
  return { sent: res.successCount, invalidTokens };
}

module.exports = { sendToTokens };
