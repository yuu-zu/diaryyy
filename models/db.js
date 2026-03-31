const admin = require('firebase-admin');
require('dotenv').config();

let db;

try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("Biến môi trường FIREBASE_SERVICE_ACCOUNT chưa được thiết lập!");
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // Tự động lấy URL nếu bạn có khai báo, nếu không Firestore sẽ tự nhận diện qua Project ID
      databaseURL: process.env.FIREBASE_DATABASE_URL 
    });
    console.log("🔥 Firebase Admin đã kết nối thành công!");
  }
  
  // Gán db là Firestore vì lỗi trước đó của bạn liên quan đến Firestore
  db = admin.firestore(); 

} catch (error) {
  console.error("❌ Lỗi cấu hình Firebase:", error.message);
}

// Hàm bổ trợ để tương thích với file models/user.js và các file khác
function collection(name) {
  if (!db) throw new Error("Database chưa khởi tạo thành công!");
  return db.collection(name);
}

// Hàm tạo ID tự tăng (dùng cho Firestore)
async function nextId(sequenceName) {
  const counterRef = db.collection('_meta').doc('counters');
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);
    const newVal = (doc.exists ? (doc.data()[sequenceName] || 0) : 0) + 1;
    transaction.set(counterRef, { [sequenceName]: newVal }, { merge: true });
    return newVal;
  });
}

function asDateString(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// QUAN TRỌNG: Phải export đầy đủ các hàm mà các file khác đang gọi
module.exports = {
  admin,
  db,
  collection,
  nextId,
  asDateString
};