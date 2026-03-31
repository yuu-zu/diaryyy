require('dotenv').config();

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const {
  FIREBASE_SERVICE_ACCOUNT_PATH,
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  FIREBASE_DATABASE_URL
} = process.env;

function buildCredential() {
  if (FIREBASE_SERVICE_ACCOUNT_PATH) {
    const resolvedPath = path.resolve(process.cwd(), FIREBASE_SERVICE_ACCOUNT_PATH);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(
        `Firebase service account file not found at ${resolvedPath}. Download it from Firebase Console > Project settings > Service accounts.`
      );
    }

    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  }

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
  }

  throw new Error(
    'Firebase config missing. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.'
  );
}

const serviceAccount = buildCredential();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId || FIREBASE_PROJECT_ID,
    databaseURL: FIREBASE_DATABASE_URL || 'https://diary-uuu-default-rtdb.firebaseio.com/'
  });
}

const db = admin.database();

async function nextId(sequenceName) {
  const counterRef = db.ref(`_meta/counters/${sequenceName}`);
  return counterRef.transaction((current) => {
    const value = typeof current === 'number' ? current : 0;
    return value + 1;
  }).then((result) => {
    if (!result.committed) {
      throw new Error(`Failed to increment counter for ${sequenceName}`);
    }
    return result.snapshot.val();
  });
}

function collection(name) {
  return db.ref(name);
}

function asDateString(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

module.exports = {
  admin,
  asDateString,
  collection,
  db,
  nextId
};
