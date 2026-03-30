const crypto = require('crypto');

const SECRET = process.env.NOTE_SECRET || 'your_super_secret_key_32bytes!';

function encryptWithKey(content, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(content, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();

  return {
    encrypted: `${encrypted}:${tag.toString('base64')}`,
    iv: iv.toString('base64')
  };
}

function decryptWithKey(encryptedContent, iv, key) {
  const [enc, tag] = String(encryptedContent || '').split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  let decrypted = decipher.update(enc, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function getLegacyKey(userId) {
  return crypto.createHash('sha256').update(`${SECRET}${userId}`).digest();
}

function encryptLegacyNote(content, userId) {
  return encryptWithKey(content, getLegacyKey(userId));
}

function decryptLegacyNote(encryptedContent, iv, userId) {
  return decryptWithKey(encryptedContent, iv, getLegacyKey(userId));
}

function generateNoteSalt() {
  return crypto.randomBytes(16).toString('base64');
}

function deriveNoteKey(notePassword, salt) {
  return crypto.scryptSync(String(notePassword), Buffer.from(salt, 'base64'), 32);
}

function encryptProtectedNote(content, notePassword, salt = generateNoteSalt()) {
  const key = deriveNoteKey(notePassword, salt);
  const payload = encryptWithKey(content, key);
  return {
    ...payload,
    salt
  };
}

function decryptProtectedNote(encryptedContent, iv, notePassword, salt) {
  const key = deriveNoteKey(notePassword, salt);
  return decryptWithKey(encryptedContent, iv, key);
}

module.exports = {
  decryptLegacyNote,
  decryptProtectedNote,
  deriveNoteKey,
  encryptLegacyNote,
  encryptProtectedNote,
  generateNoteSalt
};
