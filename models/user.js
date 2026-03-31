const { collection, nextId } = require('./db');

const USERS = 'users';

function nowIso() {
  return new Date().toISOString();
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    full_name: user.full_name || '',
    username: user.username,
    email: user.email,
    password_hash: user.password_hash,
    is_verified: Boolean(user.is_verified),
    verification_otp: user.verification_otp || null,
    verification_otp_expires_at: user.verification_otp_expires_at || null,
    reset_otp: user.reset_otp || null,
    reset_otp_expires_at: user.reset_otp_expires_at || null,
    birth_date: user.birth_date || null,
    gender: user.gender || null,
    created_at: user.created_at || nowIso(),
    updated_at: user.updated_at || user.created_at || nowIso(),
    deleted_at: user.deleted_at || null,
    account_deletion_otp: user.account_deletion_otp || null,
    account_deletion_otp_expires_at: user.account_deletion_otp_expires_at || null
  };
}

async function listUsers() {
  const snapshot = await collection(USERS).once('value');
  const data = snapshot.val() || {};
  return Object.values(data)
    .map((item) => normalizeUser(item))
    .sort((a, b) => a.id - b.id);
}

async function getUserDoc(id) {
  const snapshot = await collection(USERS).child(String(id)).once('value');
  return snapshot.exists() ? normalizeUser(snapshot.val()) : null;
}

async function saveUser(id, patch) {
  const ref = collection(USERS).child(String(id));
  const existing = await ref.once('value');
  if (!existing.exists()) return null;

  const next = {
    ...existing.val(),
    ...patch,
    updated_at: nowIso()
  };
  await ref.set(next);
  return normalizeUser(next);
}

async function ensureUserProfileColumns() {
  return true;
}

async function createUser(fullName, username, email, passwordHash, verificationOtp, verificationOtpExpiresAt) {
  const id = await nextId(USERS);
  const payload = normalizeUser({
    id,
    full_name: fullName,
    username,
    email,
    password_hash: passwordHash,
    is_verified: false,
    verification_otp: verificationOtp,
    verification_otp_expires_at: new Date(verificationOtpExpiresAt).toISOString(),
    created_at: nowIso(),
    updated_at: nowIso()
  });

  await collection(USERS).child(String(id)).set(payload);
  return payload;
}

async function findUserByUsername(username) {
  const users = await listUsers();
  return users.find((user) => user.username === username) || null;
}

async function findUserByIdentifier(identifier) {
  const users = await listUsers();
  return users.find((user) => user.username === identifier || user.email === identifier) || null;
}

async function findUserById(id) {
  const user = await getUserDoc(id);
  if (!user) return null;

  return {
    id: user.id,
    full_name: user.full_name,
    username: user.username,
    email: user.email,
    birth_date: user.birth_date,
    gender: user.gender,
    is_verified: user.is_verified,
    created_at: user.created_at,
    deleted_at: user.deleted_at
  };
}

async function findUserByEmail(email) {
  const users = await listUsers();
  return users.find((user) => user.email === email) || null;
}

async function setVerificationOtp(userId, otp, expiresAt) {
  await saveUser(userId, {
    verification_otp: otp,
    verification_otp_expires_at: new Date(expiresAt).toISOString(),
    is_verified: false
  });
}

async function updateUserVerification(userId, isVerified) {
  await saveUser(userId, {
    is_verified: isVerified,
    verification_otp: null,
    verification_otp_expires_at: null
  });
}

async function setResetOtp(userId, otp, expiresAt) {
  await saveUser(userId, {
    reset_otp: otp,
    reset_otp_expires_at: new Date(expiresAt).toISOString()
  });
}

async function clearResetOtp(userId) {
  await saveUser(userId, {
    reset_otp: null,
    reset_otp_expires_at: null
  });
}

async function updateUserPassword(userId, passwordHash) {
  await saveUser(userId, {
    password_hash: passwordHash,
    reset_otp: null,
    reset_otp_expires_at: null
  });
}

async function updateUserProfile(userId, fullName, birthDate, gender) {
  await saveUser(userId, {
    full_name: fullName,
    birth_date: birthDate || null,
    gender: gender || null
  });
}

async function setAccountDeletionOtp(userId, otp, expiresAt) {
  await saveUser(userId, {
    account_deletion_otp: otp,
    account_deletion_otp_expires_at: new Date(expiresAt).toISOString()
  });
}

async function clearAccountDeletionOtp(userId) {
  await saveUser(userId, {
    account_deletion_otp: null,
    account_deletion_otp_expires_at: null
  });
}

async function scheduleAccountDeletion(userId) {
  await saveUser(userId, {
    deleted_at: nowIso(),
    account_deletion_otp: null,
    account_deletion_otp_expires_at: null
  });
}

async function restoreDeletedAccount(userId) {
  await saveUser(userId, {
    deleted_at: null,
    account_deletion_otp: null,
    account_deletion_otp_expires_at: null
  });
}

async function purgeExpiredDeletedUsers() {
  const users = await listUsers();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const expired = users.filter((user) => user.deleted_at && new Date(user.deleted_at).getTime() < cutoff);
  await Promise.all(expired.map((user) => collection(USERS).child(String(user.id)).remove()));
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
