const admin = require('firebase-admin');

try {
  // 1. Kiểm tra xem biến môi trường có tồn tại không để tránh crash app sớm
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("Biến môi trường FIREBASE_SERVICE_ACCOUNT chưa được thiết lập!");
  }

  // 2. Parse chuỗi JSON
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  // 3. Khởi tạo (chỉ khởi tạo nếu chưa có app nào chạy)
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("🔥 Firebase Admin đã kết nối thành công!");
  }
} catch (error) {
  console.error("❌ Lỗi cấu hình Firebase:", error.message);
  // Trong môi trường production, bạn có thể muốn xử lý lỗi này kỹ hơn
}

// 4. Xuất database để các file khác sử dụng
// Lưu ý: Đổi .firestore() thành .database() nếu bạn dùng Realtime DB
const db = admin.firestore(); 
module.exports = db;