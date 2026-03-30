const express = require('express');
const bcrypt = require('bcrypt');
const { requireLogin } = require('../middleware/auth');
const {
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
} = require('../models/note');
const {
  decryptLegacyNote,
  decryptProtectedNote,
  encryptLegacyNote,
  encryptProtectedNote
} = require('../utils/crypto');

const router = express.Router();

router.use(requireLogin);
router.use(async (req, res, next) => {
  try {
    await ensureNoteSecurityColumns();
    next();
  } catch (error) {
    next(error);
  }
});

function isProtectedNote(note) {
  return Boolean(note?.note_password_hash && note?.note_password_salt);
}

function buildNoteResponse(note) {
  return {
    id: note.id,
    title: note.title,
    created_at: note.created_at,
    updated_at: note.updated_at,
    is_locked: isProtectedNote(note),
    is_legacy: !isProtectedNote(note)
  };
}

async function verifyNotePassword(note, notePassword) {
  if (!isProtectedNote(note)) return true;
  if (!notePassword) return false;
  return bcrypt.compare(notePassword, note.note_password_hash);
}

function decryptStoredNote(note, notePassword, userId) {
  if (isProtectedNote(note)) {
    return decryptProtectedNote(note.encrypted_content, note.iv, notePassword, note.note_password_salt);
  }

  return decryptLegacyNote(note.encrypted_content, note.iv, userId);
}

router.get('/', async (req, res) => {
  await purgeExpiredTrash();
  const query = String(req.query.q || '').trim();

  if (query) {
    const notes = await searchNotesByTitle(req.session.userId, query);
    return res.json(notes);
  }

  const notes = await getNotesByUser(req.session.userId);
  res.json(notes);
});

router.get('/recent/list', async (req, res) => {
  await purgeExpiredTrash();
  const notes = await getRecentNotesByUser(req.session.userId, 5);
  res.json(notes);
});

router.get('/trash/list', async (req, res) => {
  await purgeExpiredTrash();
  const notes = await getTrashByUser(req.session.userId);
  res.json(notes);
});

router.get('/:id', async (req, res) => {
  const note = await getNoteById(req.params.id, req.session.userId, true);
  if (!note) {
    return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y ghi chÃº.' });
  }

  if (note.deleted_at) {
    return res.status(410).json({ message: 'Ghi chÃº nÃ y Ä‘ang náº±m trong thÃ¹ng rÃ¡c.' });
  }

  res.json(buildNoteResponse(note));
});

router.post('/:id/unlock', async (req, res) => {
  const note = await getNoteById(req.params.id, req.session.userId, true);
  if (!note) {
    return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y ghi chÃº.' });
  }

  if (note.deleted_at) {
    return res.status(410).json({ message: 'Ghi chÃº nÃ y Ä‘ang náº±m trong thÃ¹ng rÃ¡c.' });
  }

  const { notePassword } = req.body || {};
  const isValid = await verifyNotePassword(note, notePassword);
  if (!isValid) {
    return res.status(401).json({ message: 'Máº­t kháº©u ghi chÃº khÃ´ng Ä‘Ãºng.' });
  }

  try {
    const content = decryptStoredNote(note, notePassword, req.session.userId);
    res.json({
      ...buildNoteResponse(note),
      content
    });
  } catch (error) {
    console.error('Unlock note error:', error);
    res.status(400).json({ message: 'KhÃ´ng thá»ƒ giáº£i mÃ£ ghi chÃº. Vui lÃ²ng kiá»ƒm tra láº¡i máº­t kháº©u.' });
  }
});

router.post('/', async (req, res) => {
  const { title, content, notePassword } = req.body;
  if (!title || !content || !notePassword) {
    return res.status(400).json({ message: 'Vui lÃ²ng nháº­p tiÃªu Ä‘á», ná»™i dung vÃ  máº­t kháº©u ghi chÃº.' });
  }

  const notePasswordHash = await bcrypt.hash(notePassword, 12);
  const { encrypted, iv, salt } = encryptProtectedNote(content, notePassword);
  await createNote(req.session.userId, title, encrypted, iv, notePasswordHash, salt);
  res.json({ message: 'Táº¡o ghi chÃº thÃ nh cÃ´ng.' });
});

router.put('/:id', async (req, res) => {
  const note = await getNoteById(req.params.id, req.session.userId);
  if (!note) {
    return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y ghi chÃº Ä‘á»ƒ cáº­p nháº­t.' });
  }

  const { title, content, currentNotePassword, newNotePassword } = req.body;
  if (!title || !content) {
    return res.status(400).json({ message: 'Vui lÃ²ng nháº­p tiÃªu Ä‘á» vÃ  ná»™i dung.' });
  }

  if (isProtectedNote(note)) {
    const isValid = await verifyNotePassword(note, currentNotePassword);
    if (!isValid) {
      return res.status(401).json({ message: 'Máº­t kháº©u ghi chÃº hiá»‡n táº¡i khÃ´ng Ä‘Ãºng.' });
    }

    const passwordForEncryption = newNotePassword || currentNotePassword;
    const passwordHash = newNotePassword ? await bcrypt.hash(newNotePassword, 12) : note.note_password_hash;
    const { encrypted, iv, salt } = encryptProtectedNote(content, passwordForEncryption);

    await updateNote(req.params.id, title, encrypted, iv, passwordHash, salt);
    return res.json({
      message: newNotePassword ? 'Cáº­p nháº­t ghi chÃº vÃ  Ä‘á»•i máº­t kháº©u thÃ nh cÃ´ng.' : 'Cáº­p nháº­t thÃ nh cÃ´ng.'
    });
  }

  const passwordToSet = newNotePassword || currentNotePassword;
  if (passwordToSet) {
    const notePasswordHash = await bcrypt.hash(passwordToSet, 12);
    const { encrypted, iv, salt } = encryptProtectedNote(content, passwordToSet);
    await updateNote(req.params.id, title, encrypted, iv, notePasswordHash, salt);
    return res.json({ message: 'Cáº­p nháº­t thÃ nh cÃ´ng. Ghi chÃº Ä‘Ã£ Ä‘Æ°á»£c báº­t khÃ³a máº­t kháº©u.' });
  }

  const { encrypted, iv } = encryptLegacyNote(content, req.session.userId);
  await updateNote(req.params.id, title, encrypted, iv, null, null);
  res.json({ message: 'Cáº­p nháº­t thÃ nh cÃ´ng.' });
});

router.delete('/:id', async (req, res) => {
  const note = await getNoteById(req.params.id, req.session.userId);
  if (!note) {
    return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y ghi chÃº Ä‘á»ƒ xÃ³a.' });
  }

  await moveNoteToTrash(req.params.id, req.session.userId);
  res.json({ message: 'ÄÃ£ chuyá»ƒn ghi chÃº vÃ o thÃ¹ng rÃ¡c. Ghi chÃº sáº½ Ä‘Æ°á»£c giá»¯ trong 30 ngÃ y.' });
});

router.post('/:id/restore', async (req, res) => {
  const note = await getNoteById(req.params.id, req.session.userId, true);
  if (!note || !note.deleted_at) {
    return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y ghi chÃº trong thÃ¹ng rÃ¡c.' });
  }

  await restoreNote(req.params.id, req.session.userId);
  res.json({ message: 'ÄÃ£ khÃ´i phá»¥c ghi chÃº.' });
});

router.delete('/:id/permanent', async (req, res) => {
  const note = await getNoteById(req.params.id, req.session.userId, true);
  if (!note || !note.deleted_at) {
    return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y ghi chÃº trong thÃ¹ng rÃ¡c.' });
  }

  await permanentlyDeleteNote(req.params.id, req.session.userId);
  res.json({ message: 'ÄÃ£ xÃ³a vÄ©nh viá»…n ghi chÃº.' });
});

module.exports = router;
