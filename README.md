# Secure Notes App

## Chuc nang hien co
- Dang ky bang username, email va password
- Gui OTP qua Gmail de xac thuc tai khoan
- Dang nhap bang username hoac email
- Quen mat khau, gui OTP va dat lai mat khau
- Tao, xem, sua, xoa ghi chu da ma hoa AES-256-GCM
- Ho tro thung rac 30 ngay va khoi phuc tai khoan

## Da thay doi gi
- Bo MySQL.
- Du lieu user va ghi chu duoc luu tren Firebase Realtime Database.
- Dang nhap da chuyen sang JWT stateless hop voi Vercel.
- API co the duoc rewrite qua serverless functions trong thu muc `api/`.

## Cach cau hinh Firebase
1. Mo Firebase Console va tao project.
2. Bat `Realtime Database`.
3. Vao `Project settings` > `Service accounts`.
4. Bam `Generate new private key`.
5. Luu file JSON thanh:
   - `C:\Users\ngan\Pictures\vs code\less2\serviceAccountKey.json`
6. Trong `.env`, de:
   - `FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json`
   - `FIREBASE_DATABASE_URL=https://diary-uuu-default-rtdb.firebaseio.com/`

Ban cung co the dung 3 bien:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Cai dat
```bash
npm install
npm start
```

## Bien moi truong
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
- `MAIL_FROM`
- `MAIL_ALLOW_CONSOLE_FALLBACK=true|false`
- `USE_HTTPS=true|false`
- `FIREBASE_SERVICE_ACCOUNT_PATH` hoac 3 bien Firebase
- `FIREBASE_DATABASE_URL`

## Luu y
- Backend se khong khoi dong neu chua co Firebase service account hop le.
- File `.env` dang bi ignore, va `serviceAccountKey.json` cung da duoc ignore de tranh lo key.
- Neu Gmail app password sai, dat `MAIL_ALLOW_CONSOLE_FALLBACK=true` de app van tiep tuc va in OTP ra terminal khi test local.
- Khi deploy Vercel, nho them day du env vars trong project settings va khong push file service account that.
