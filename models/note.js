const { collection, nextId } = require('./db');

const NOTES = 'notes';

function nowIso() {
  return new Date().toISOString();
}

function normalizeNote(note) {
  if (!note) return null;
  return {
    id: note.id,
    user_id: note.user_id,
    title: note.title,
    encrypted_content: note.encrypted_content,
    iv: note.iv,
    note_password_hash: note.note_password_hash || null,
    note_password_salt: note.note_password_salt || null,
    created_at: note.created_at || nowIso(),
    updated_at: note.updated_at || note.created_at || nowIso(),
    deleted_at: note.deleted_at || null
  };
}

async function listNotes() {
  const snapshot = await collection(NOTES).once('value');
  const data = snapshot.val() || {};
  return Object.values(data)
    .map((item) => normalizeNote(item))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

async function getNoteDoc(id) {
  const snapshot = await collection(NOTES).child(String(id)).once('value');
  return snapshot.exists() ? normalizeNote(snapshot.val()) : null;
}

async function saveNote(id, patch) {
  const ref = collection(NOTES).child(String(id));
  const existing = await ref.once('value');
  if (!existing.exists()) return null;

  const next = {
    ...existing.val(),
    ...patch,
    updated_at: nowIso()
  };
  await ref.set(next);
  return normalizeNote(next);
}

async function createNote(userId, title, encryptedContent, iv, notePasswordHash = null, notePasswordSalt = null) {
  const id = await nextId(NOTES);
  const payload = normalizeNote({
    id,
    user_id: Number(userId),
    title,
    encrypted_content: encryptedContent,
    iv,
    note_password_hash: notePasswordHash,
    note_password_salt: notePasswordSalt,
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null
  });

  await collection(NOTES).child(String(id)).set(payload);
  return payload;
}

async function getNotesByUser(userId) {
  const notes = await listNotes();
  return notes.filter((note) => note.user_id === Number(userId) && !note.deleted_at);
}

async function getRecentNotesByUser(userId, limit = 5) {
  const notes = await getNotesByUser(userId);
  return notes.slice(0, Number(limit));
}

async function searchNotesByTitle(userId, query) {
  const notes = await getNotesByUser(userId);
  const keyword = String(query || '').toLowerCase();
  return notes.filter((note) => String(note.title || '').toLowerCase().includes(keyword));
}

async function getTrashByUser(userId) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const notes = await listNotes();
  return notes.filter((note) => {
    if (note.user_id !== Number(userId) || !note.deleted_at) return false;
    return new Date(note.deleted_at).getTime() >= cutoff;
  });
}

async function getNoteById(id, userId, includeDeleted = false) {
  const note = await getNoteDoc(id);
  if (!note || note.user_id !== Number(userId)) return null;
  if (!includeDeleted && note.deleted_at) return null;
  return note;
}

async function updateNote(id, title, encryptedContent, iv, notePasswordHash = null, notePasswordSalt = null) {
  await saveNote(id, {
    title,
    encrypted_content: encryptedContent,
    iv,
    note_password_hash: notePasswordHash,
    note_password_salt: notePasswordSalt
  });
}

async function moveNoteToTrash(id, userId) {
  const note = await getNoteById(id, userId);
  if (!note) return;
  await saveNote(id, { deleted_at: nowIso() });
}

async function restoreNote(id, userId) {
  const note = await getNoteById(id, userId, true);
  if (!note || !note.deleted_at) return;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  if (new Date(note.deleted_at).getTime() < cutoff) return;
  await saveNote(id, { deleted_at: null });
}

async function permanentlyDeleteNote(id, userId) {
  const note = await getNoteById(id, userId, true);
  if (!note || !note.deleted_at) return;
  await collection(NOTES).child(String(id)).remove();
}

async function purgeExpiredTrash() {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const notes = await listNotes();
  const expired = notes.filter((note) => note.deleted_at && new Date(note.deleted_at).getTime() < cutoff);
  await Promise.all(expired.map((note) => collection(NOTES).child(String(note.id)).remove()));
}

async function ensureNoteSecurityColumns() {
  return true;
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
