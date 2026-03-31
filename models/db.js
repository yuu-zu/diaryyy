require('dotenv').config();

const admin = require('firebase-admin');

const {
  FIREBASE_SERVICE_ACCOUNT,
  FIREBASE_DATABASE_URL
} = process.env;

function buildCredential() {
  if (!FIREBASE_SERVICE_ACCOUNT) {
    throw new Error(
      'Firebase config missing. Set FIREBASE_SERVICE_ACCOUNT in environment variables.'
    );
  }

  return JSON.parse(FIREBASE_SERVICE_ACCOUNT);
}

const serviceAccount = buildCredential();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || serviceAccount.projectId,
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
