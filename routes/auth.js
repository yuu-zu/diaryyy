const express = require('express');
const bcrypt = require('bcrypt');
const {
  clearAccountDeletionOtp,
  clearResetOtp,
  createUser,
  ensureUserProfileColumns,
  findUserByEmail,
  findUserByIdentifier,
  findUserById,
  findUserByUsername,
  purgeExpiredDeletedUsers,
  restoreDeletedAccount,
  scheduleAccountDeletion,
  setAccountDeletionOtp,
  setResetOtp,
  setVerificationOtp,
  updateUserPassword,
  updateUserProfile,
  updateUserVerification
} = require('../models/user');
const { sendMail } = require('../utils/mailer');
const { addMinutes, generateOtp } = require('../utils/otp');
const { requireLogin } = require('../middleware/auth');
const { signToken } = require('../utils/jwt');

const router = express.Router();
const OTP_TTL_MINUTES = 10;
const ACCOUNT_DELETE_TTL_MINUTES = 10;

router.use(async (req, res, next) => {
  try {
    await ensureUserProfileColumns();
    await purgeExpiredDeletedUsers();
    next();
  } catch (error) {
    next(error);
  }
});

function isExpired(dateValue) {
  if (!dateValue) return true;
  return new Date(dateValue) < new Date();
}

async function sendVerificationEmail(email, otp) {
  await sendMail({
    to: email,
    subject: 'Ma OTP xac thuc tai khoan Secret Diary',
    text: `Ma OTP xac thuc tai khoan cua ban la ${otp}. Ma co hieu luc trong ${OTP_TTL_MINUTES} phut.`,
    html: `<p>Ma OTP xac thuc tai khoan cua ban la <strong>${otp}</strong>.</p><p>Ma co hieu luc trong ${OTP_TTL_MINUTES} phut.</p>`
  });
}

async function sendResetEmail(email, otp) {
  await sendMail({
    to: email,
    subject: 'Ma OTP dat lai mat khau Secret Diary',
    text: `Ma OTP dat lai mat khau cua ban la ${otp}. Ma co hieu luc trong ${OTP_TTL_MINUTES} phut.`,
    html: `<p>Ma OTP dat lai mat khau cua ban la <strong>${otp}</strong>.</p><p>Ma co hieu luc trong ${OTP_TTL_MINUTES} phut.</p>`
  });
}

async function sendAccountDeletionEmail(email, otp) {
  await sendMail({
    to: email,
    subject: 'Ma OTP xoa tai khoan Secret Diary',
    text: `Ma OTP xoa tai khoan cua ban la ${otp}. Ma co hieu luc trong ${ACCOUNT_DELETE_TTL_MINUTES} phut.`,
    html: `<p>Ma OTP xoa tai khoan cua ban la <strong>${otp}</strong>.</p><p>Ma co hieu luc trong ${ACCOUNT_DELETE_TTL_MINUTES} phut.</p>`
  });
}

router.post('/register', async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');

    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ message: 'Vui long nhap day du ten, username, email va password.' });
    }

    const existingByUsername = await findUserByUsername(username);
    if (existingByUsername) {
      return res.status(409).json({ message: 'Username da ton tai. Vui long chon username khac.' });
    }

    const existingByEmail = await findUserByEmail(email);
    if (existingByEmail) {
      return res.status(409).json({ message: 'Email da duoc su dung. Neu chua xac thuc, hay gui lai OTP.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const otp = generateOtp();
    const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES);

    await createUser(fullName, username, email, passwordHash, otp, expiresAt);
    await sendVerificationEmail(email, otp);

    res.json({
      message: 'Dang ky thanh cong. Vui long nhap OTP da gui ve email de kich hoat tai khoan.',
      email
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Khong the dang ky luc nay. Kiem tra lai cau hinh email va database.' });
  }
});

router.post('/verify-register-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Vui long nhap email va OTP.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'Khong tim thay tai khoan voi email nay.' });
    }

    if (user.is_verified) {
      return res.json({ message: 'Tai khoan da duoc xac thuc. Ban co the dang nhap.' });
    }

    if (user.verification_otp !== otp || isExpired(user.verification_otp_expires_at)) {
      return res.status(400).json({ message: 'OTP khong dung hoac da het han.' });
    }

    await updateUserVerification(user.id, true);
    res.json({ message: 'Xac thuc thanh cong. Dang quay ve trang dang nhap.' });
  } catch (error) {
    console.error('Verify register OTP error:', error);
    res.status(500).json({ message: 'Khong the xac thuc tai khoan luc nay.' });
  }
});

router.post('/resend-verification-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Vui long nhap email.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'Khong tim thay tai khoan voi email nay.' });
    }

    if (user.is_verified) {
      return res.status(400).json({ message: 'Tai khoan nay da xac thuc.' });
    }

    const otp = generateOtp();
    const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES);
    await setVerificationOtp(user.id, otp, expiresAt);
    await sendVerificationEmail(email, otp);

    res.json({ message: 'Da gui lai OTP xac thuc. Vui long kiem tra email.' });
  } catch (error) {
    console.error('Resend verification OTP error:', error);
    res.status(500).json({ message: 'Khong the gui lai OTP luc nay.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Vui long nhap username/email va password.' });
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) return res.status(401).json({ message: 'Sai thong tin dang nhap.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Sai thong tin dang nhap.' });

    if (!user.is_verified) {
      return res.status(403).json({
        message: 'Tai khoan chua xac thuc email. Vui long nhap OTP truoc khi dang nhap.',
        email: user.email,
        needsVerification: true
      });
    }

    let restoredAccount = false;
    if (user.deleted_at) {
      const deletedAt = new Date(user.deleted_at);
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (deletedAt < cutoff) {
        return res.status(403).json({ message: 'Tai khoan nay da het thoi gian khoi phuc.' });
      }
      await restoreDeletedAccount(user.id);
      restoredAccount = true;
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      username: user.username
    });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name || user.username
      },
      message: restoredAccount
        ? 'Dang nhap thanh cong. Tai khoan cua ban da duoc khoi phuc do dang nhap lai trong 30 ngay.'
        : 'Dang nhap thanh cong.'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Khong the dang nhap luc nay.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Vui long nhap email.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.json({ message: 'Neu email ton tai, ma OTP dat lai mat khau da duoc gui.' });
    }

    const otp = generateOtp();
    const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES);
    await setResetOtp(user.id, otp, expiresAt);
    await sendResetEmail(email, otp);

    res.json({ message: 'Da gui OTP dat lai mat khau. Vui long kiem tra email.', email });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Khong the gui OTP dat lai mat khau luc nay.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Vui long nhap email, OTP va mat khau moi.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'Khong tim thay tai khoan voi email nay.' });
    }

    if (user.reset_otp !== otp || isExpired(user.reset_otp_expires_at)) {
      return res.status(400).json({ message: 'OTP dat lai mat khau khong dung hoac da het han.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await updateUserPassword(user.id, passwordHash);
    await clearResetOtp(user.id);

    res.json({ message: 'Doi mat khau thanh cong. Dang quay ve trang dang nhap.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Khong the doi mat khau luc nay.' });
  }
});

router.post('/profile', requireLogin, async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const birthDate = String(req.body.birthDate || '').trim();
    const gender = String(req.body.gender || '').trim();

    if (!fullName) {
      return res.status(400).json({ message: 'Ten hien thi khong duoc de trong.' });
    }

    await updateUserProfile(req.user.id, fullName, birthDate, gender);
    res.json({ message: 'Da cap nhat thong tin ca nhan.' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Khong the cap nhat thong tin luc nay.' });
  }
});

router.post('/request-account-deletion', requireLogin, async (req, res) => {
  try {
    const password = String(req.body.password || '');
    const confirmDelete = Boolean(req.body.confirmDelete);

    if (!confirmDelete) {
      return res.status(400).json({ message: 'Ban can xac nhan muon xoa tai khoan.' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Vui long nhap mat khau tai khoan.' });
    }

    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Khong tim thay tai khoan.' });
    }

    const rawUser = await findUserByEmail(user.email);
    const match = await bcrypt.compare(password, rawUser.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Mat khau khong dung.' });
    }

    const otp = generateOtp();
    const expiresAt = addMinutes(new Date(), ACCOUNT_DELETE_TTL_MINUTES);
    await setAccountDeletionOtp(req.user.id, otp, expiresAt);
    await sendAccountDeletionEmail(user.email, otp);

    res.json({ message: 'Da gui OTP xoa tai khoan ve email cua ban.' });
  } catch (error) {
    console.error('Request account deletion error:', error);
    res.status(500).json({ message: 'Khong the bat dau quy trinh xoa tai khoan luc nay.' });
  }
});

router.post('/confirm-account-deletion', requireLogin, async (req, res) => {
  try {
    const otp = String(req.body.otp || '').trim();
    if (!otp) {
      return res.status(400).json({ message: 'Vui long nhap OTP xoa tai khoan.' });
    }

    const currentUser = await findUserById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'Khong tim thay tai khoan.' });
    }

    const fullUser = await findUserByEmail(currentUser.email);

    if (!fullUser) {
      return res.status(404).json({ message: 'Khong tim thay tai khoan.' });
    }

    if (fullUser.account_deletion_otp !== otp || isExpired(fullUser.account_deletion_otp_expires_at)) {
      return res.status(400).json({ message: 'OTP xoa tai khoan khong dung hoac da het han.' });
    }

    await scheduleAccountDeletion(req.user.id);
    res.json({ message: 'Tai khoan da duoc danh dau xoa. Neu dang nhap lai trong 30 ngay, tai khoan se duoc khoi phuc.' });
  } catch (error) {
    console.error('Confirm account deletion error:', error);
    res.status(500).json({ message: 'Khong the xac nhan xoa tai khoan luc nay.' });
  }
});

router.post('/cancel-account-deletion', requireLogin, async (req, res) => {
  try {
    await restoreDeletedAccount(req.user.id);
    res.json({ message: 'Da huy trang thai cho xoa tai khoan.' });
  } catch (error) {
    console.error('Cancel account deletion error:', error);
    res.status(500).json({ message: 'Khong the huy xoa tai khoan luc nay.' });
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Da dang xuat.' });
});

router.get('/me', requireLogin, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Khong tim thay nguoi dung.' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Khong the tai thong tin nguoi dung.' });
  }
});

module.exports = router;
