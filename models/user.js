const db = require('./db');

async function ensureColumn(columnName, definition, backfillSql = null) {
  const [columns] = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Users' AND COLUMN_NAME = ?`,
    [columnName]
  );

  if (!columns.length) {
    await db.query(`ALTER TABLE Users ADD COLUMN ${columnName} ${definition}`);
    if (backfillSql) {
      await db.query(backfillSql);
    }
  }
}

async function ensureUserProfileColumns() {
  await ensureColumn('full_name', "VARCHAR(150) NOT NULL DEFAULT '' AFTER id", "UPDATE Users SET full_name = username WHERE full_name = '' OR full_name IS NULL");
  await ensureColumn('birth_date', 'DATE NULL AFTER email');
  await ensureColumn('gender', 'VARCHAR(20) NULL AFTER birth_date');
  await ensureColumn('deleted_at', 'DATETIME NULL AFTER updated_at');
  await ensureColumn('account_deletion_otp', 'VARCHAR(6) NULL AFTER deleted_at');
  await ensureColumn('account_deletion_otp_expires_at', 'DATETIME NULL AFTER account_deletion_otp');
}

async function createUser(fullName, username, email, passwordHash, verificationOtp, verificationOtpExpiresAt) {
  await db.query(
    `INSERT INTO Users (
      full_name,
      username,
      email,
      password_hash,
      is_verified,
      verification_otp,
      verification_otp_expires_at,
      created_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?, NOW())`,
    [fullName, username, email, passwordHash, verificationOtp, verificationOtpExpiresAt]
  );
}

async function findUserByUsername(username) {
  const [rows] = await db.query('SELECT * FROM Users WHERE username = ?', [username]);
  return rows[0];
}

async function findUserByIdentifier(identifier) {
  const [rows] = await db.query(
    'SELECT * FROM Users WHERE username = ? OR email = ?',
    [identifier, identifier]
  );
  return rows[0];
}

async function findUserById(id) {
  const [rows] = await db.query(
    `SELECT id, full_name, username, email, birth_date, gender, is_verified, created_at, deleted_at
     FROM Users WHERE id = ?`,
    [id]
  );
  return rows[0];
}

async function findUserByEmail(email) {
  const [rows] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
  return rows[0];
}

async function setVerificationOtp(userId, otp, expiresAt) {
  await db.query(
    'UPDATE Users SET verification_otp = ?, verification_otp_expires_at = ?, is_verified = 0 WHERE id = ?',
    [otp, expiresAt, userId]
  );
}

async function updateUserVerification(userId, isVerified) {
  await db.query(
    'UPDATE Users SET is_verified = ?, verification_otp = NULL, verification_otp_expires_at = NULL WHERE id = ?',
    [isVerified, userId]
  );
}

async function setResetOtp(userId, otp, expiresAt) {
  await db.query(
    'UPDATE Users SET reset_otp = ?, reset_otp_expires_at = ? WHERE id = ?',
    [otp, expiresAt, userId]
  );
}

async function clearResetOtp(userId) {
  await db.query(
    'UPDATE Users SET reset_otp = NULL, reset_otp_expires_at = NULL WHERE id = ?',
    [userId]
  );
}

async function updateUserPassword(userId, passwordHash) {
  await db.query(
    'UPDATE Users SET password_hash = ?, reset_otp = NULL, reset_otp_expires_at = NULL WHERE id = ?',
    [passwordHash, userId]
  );
}

async function updateUserProfile(userId, fullName, birthDate, gender) {
  await db.query(
    `UPDATE Users
     SET full_name = ?, birth_date = ?, gender = ?
     WHERE id = ?`,
    [fullName, birthDate || null, gender || null, userId]
  );
}

async function setAccountDeletionOtp(userId, otp, expiresAt) {
  await db.query(
    `UPDATE Users
     SET account_deletion_otp = ?, account_deletion_otp_expires_at = ?
     WHERE id = ?`,
    [otp, expiresAt, userId]
  );
}

async function clearAccountDeletionOtp(userId) {
  await db.query(
    `UPDATE Users
     SET account_deletion_otp = NULL, account_deletion_otp_expires_at = NULL
     WHERE id = ?`,
    [userId]
  );
}

async function scheduleAccountDeletion(userId) {
  await db.query(
    `UPDATE Users
     SET deleted_at = NOW(), account_deletion_otp = NULL, account_deletion_otp_expires_at = NULL
     WHERE id = ?`,
    [userId]
  );
}

async function restoreDeletedAccount(userId) {
  await db.query(
    `UPDATE Users
     SET deleted_at = NULL, account_deletion_otp = NULL, account_deletion_otp_expires_at = NULL
     WHERE id = ?`,
    [userId]
  );
}

async function purgeExpiredDeletedUsers() {
  await db.query(
    `DELETE FROM Users
     WHERE deleted_at IS NOT NULL
       AND deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
  );
}

module.exports = {
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
};
