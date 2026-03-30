const db = require('./db');

async function createNote(userId, title, encryptedContent, iv, notePasswordHash = null, notePasswordSalt = null) {
  await db.query(
    `INSERT INTO Notes (
      user_id,
      title,
      encrypted_content,
      iv,
      note_password_hash,
      note_password_salt,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [userId, title, encryptedContent, iv, notePasswordHash, notePasswordSalt]
  );
}

async function getNotesByUser(userId) {
  const [rows] = await db.query(
    `SELECT id, title, created_at, updated_at
     FROM Notes
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function getRecentNotesByUser(userId, limit = 5) {
  const [rows] = await db.query(
    `SELECT id, title, created_at, updated_at
     FROM Notes
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, Number(limit)]
  );
  return rows;
}

async function searchNotesByTitle(userId, query) {
  const [rows] = await db.query(
    `SELECT id, title, created_at, updated_at
     FROM Notes
     WHERE user_id = ? AND deleted_at IS NULL AND title LIKE ?
     ORDER BY created_at DESC`,
    [userId, `%${query}%`]
  );
  return rows;
}

async function getTrashByUser(userId) {
  const [rows] = await db.query(
    `SELECT id, title, created_at, deleted_at
     FROM Notes
     WHERE user_id = ? AND deleted_at IS NOT NULL
       AND deleted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     ORDER BY deleted_at DESC`,
    [userId]
  );
  return rows;
}

async function getNoteById(id, userId, includeDeleted = false) {
  const deletedCondition = includeDeleted ? '' : 'AND deleted_at IS NULL';
  const [rows] = await db.query(
    `SELECT * FROM Notes WHERE id = ? AND user_id = ? ${deletedCondition}`,
    [id, userId]
  );
  return rows[0];
}

async function updateNote(id, title, encryptedContent, iv, notePasswordHash = null, notePasswordSalt = null) {
  await db.query(
    `UPDATE Notes
     SET title = ?,
         encrypted_content = ?,
         iv = ?,
         note_password_hash = ?,
         note_password_salt = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [title, encryptedContent, iv, notePasswordHash, notePasswordSalt, id]
  );
}

async function moveNoteToTrash(id, userId) {
  await db.query(
    'UPDATE Notes SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [id, userId]
  );
}

async function restoreNote(id, userId) {
  await db.query(
    `UPDATE Notes
     SET deleted_at = NULL, updated_at = NOW()
     WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL
       AND deleted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    [id, userId]
  );
}

async function permanentlyDeleteNote(id, userId) {
  await db.query(
    'DELETE FROM Notes WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL',
    [id, userId]
  );
}

async function purgeExpiredTrash() {
  await db.query(
    'DELETE FROM Notes WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
  );
}

async function ensureNoteSecurityColumns() {
  const [columns] = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Notes'
       AND COLUMN_NAME IN ('note_password_hash', 'note_password_salt')`
  );

  const existingColumns = new Set(columns.map(column => column.COLUMN_NAME));

  if (!existingColumns.has('note_password_hash')) {
    await db.query('ALTER TABLE Notes ADD COLUMN note_password_hash VARCHAR(255) NULL AFTER iv');
  }

  if (!existingColumns.has('note_password_salt')) {
    await db.query('ALTER TABLE Notes ADD COLUMN note_password_salt VARCHAR(255) NULL AFTER note_password_hash');
  }
}

module.exports = {
  createNote,
  ensureNoteSecurityColumns,
  getNoteById,
  getNotesByUser,
  getRecentNotesByUser,
  getTrashByUser,
  moveNoteToTrash,
  permanentlyDeleteNote,
  purgeExpiredTrash,
  restoreNote,
  searchNotesByTitle,
  updateNote
};
