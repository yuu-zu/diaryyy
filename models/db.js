const admin = require('firebase-admin');
require('dotenv').config();

let db;

try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('Bien moi truong FIREBASE_SERVICE_ACCOUNT chua duoc thiet lap!');
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    console.log('Firebase Admin da ket noi thanh cong!');
  }

  db = admin.database();
} catch (error) {
  console.error('Loi cau hinh Firebase:', error.message);
}

function collection(name) {
  if (!db) throw new Error('Database chua khoi tao thanh cong!');
  return db.ref(name);
}

async function nextId(sequenceName) {
  const counterRef = db.ref(`_meta/counters/${sequenceName}`);
  return new Promise((resolve, reject) => {
    counterRef.transaction(
      (currentValue) => (Number(currentValue) || 0) + 1,
      (error, committed, snapshot) => {
        if (error) return reject(error);
        if (!committed) return reject(new Error(`Khong the tao sequence cho ${sequenceName}`));
        resolve(snapshot.val());
      }
    );
  });
}

function asDateString(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

module.exports = {
  admin,
  db,
  collection,
  nextId,
  asDateString
};
