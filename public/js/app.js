function setMessage(message, isError = false, targetId = 'msg') {
  const box = document.getElementById(targetId);
  if (!box) return;
  box.textContent = message || '';
  box.classList.toggle('error', Boolean(message) && isError);
  box.classList.toggle('success', Boolean(message) && !isError);
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  return { response, data };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  return { response, data };
}

function fillEmailInputs(email) {
  ['verifyEmail', 'resendVerifyEmail', 'resetEmail'].forEach(id => {
    const input = document.getElementById(id);
    if (input && email) input.value = email;
  });
}

const params = new URLSearchParams(location.search);
const emailFromQuery = params.get('email');
if (emailFromQuery) fillEmailInputs(emailFromQuery);

if (document.getElementById('registerForm')) {
  document.getElementById('registerForm').onsubmit = async event => {
    event.preventDefault();
    const form = event.target;
    const { response, data } = await postJson('/auth/register', {
      fullName: form.fullName.value.trim(),
      username: form.username.value.trim(),
      email: form.email.value.trim(),
      password: form.password.value
    });
    setMessage(data.message, !response.ok);
    if (response.ok) {
      setTimeout(() => {
        location.href = `/verify.html?email=${encodeURIComponent(data.email)}`;
      }, 1200);
    }
  };
}

if (document.getElementById('verifyForm')) {
  document.getElementById('verifyForm').onsubmit = async event => {
    event.preventDefault();
    const form = event.target;
    const { response, data } = await postJson('/auth/verify-register-otp', {
      email: form.email.value.trim(),
      otp: form.otp.value.trim()
    });
    setMessage(data.message, !response.ok);
    if (response.ok) {
      setTimeout(() => {
        location.href = '/login.html';
      }, 1200);
    }
  };
}

if (document.getElementById('resendVerifyForm')) {
  document.getElementById('resendVerifyForm').onsubmit = async event => {
    event.preventDefault();
    const form = event.target;
    const { response, data } = await postJson('/auth/resend-verification-otp', {
      email: form.email.value.trim()
    });
    setMessage(data.message, !response.ok);
    if (response.ok) fillEmailInputs(form.email.value.trim());
  };
}

if (document.getElementById('loginForm')) {
  document.getElementById('loginForm').onsubmit = async event => {
    event.preventDefault();
    const form = event.target;
    const { response, data } = await postJson('/auth/login', {
      identifier: form.identifier.value.trim(),
      password: form.password.value
    });
    setMessage(data.message, !response.ok);
    if (response.ok) {
      if (window.setAuthToken && data.token) {
        window.setAuthToken(data.token);
      }
      setTimeout(() => {
        location.href = '/dashboard.html';
      }, 1000);
      return;
    }
    if (data.needsVerification && data.email) {
      setTimeout(() => {
        location.href = `/verify.html?email=${encodeURIComponent(data.email)}`;
      }, 1400);
    }
  };
}

if (document.getElementById('forgotForm')) {
  document.getElementById('forgotForm').onsubmit = async event => {
    event.preventDefault();
    const email = event.target.email.value.trim();
    const { response, data } = await postJson('/auth/forgot-password', { email });
    setMessage(data.message, !response.ok);
    if (response.ok) {
      setTimeout(() => {
        location.href = `/reset.html?email=${encodeURIComponent(email)}`;
      }, 1200);
    }
  };
}

if (document.getElementById('resetForm')) {
  document.getElementById('resetForm').onsubmit = async event => {
    event.preventDefault();
    const form = event.target;
    const { response, data } = await postJson('/auth/reset-password', {
      email: form.email.value.trim(),
      otp: form.otp.value.trim(),
      newPassword: form.newPassword.value
    });
    setMessage(data.message, !response.ok);
    if (response.ok) {
      setTimeout(() => {
        location.href = '/login.html';
      }, 1200);
    }
  };
}

function logout(redirectTo = '/login.html') {
  fetch('/auth/logout', { method: 'POST' }).then(() => {
    if (window.clearAuthToken) {
      window.clearAuthToken();
    }
    location.href = redirectTo;
  });
}

if (document.body.classList.contains('home-page')) {
  const homeLoginLink = document.getElementById('homeLoginLink');
  const homeHeroLoginLink = document.getElementById('homeHeroLoginLink');

  fetchJson('/auth/me')
    .then(({ response, data }) => {
      if (!response.ok || !data.user) return;

      if (homeLoginLink) {
        homeLoginLink.href = '/dashboard.html';
        homeLoginLink.textContent = data.user.full_name || data.user.username;
      }

      if (homeHeroLoginLink) {
        homeHeroLoginLink.href = '/dashboard.html';
        homeHeroLoginLink.textContent = 'M\u1edf s\u1ed5 c\u1ee7a t\u00f4i';
      }
    })
    .catch(() => {});
}

if (document.body.classList.contains('dashboard-page')) {
  const state = {
    mode: 'notes',
    selectedNoteId: null,
    sidebarNotes: [],
    sidebarExpanded: false,
    gridNotes: [],
    viewingNote: null,
    drafts: {},
    unlockedPasswords: {},
    currentUser: null
  };

  const usernameEl = document.getElementById('currentUsername');
  const notesGrid = document.getElementById('notesGrid');
  const sidebarNotesList = document.getElementById('sidebarNotesList');
  const toggleSidebarNotesBtn = document.getElementById('toggleSidebarNotesBtn');
  const mainSectionTitle = document.getElementById('mainSectionTitle');
  const dashboardHint = document.getElementById('dashboardHint');
  const noteViewer = document.getElementById('noteViewer');
  const noteSearchInput = document.getElementById('noteSearchInput');
  const noteModal = document.getElementById('noteModal');
  const noteModalTitle = document.getElementById('noteModalTitle');
  const editingNoteId = document.getElementById('editingNoteId');
  const noteTitleInput = document.getElementById('noteTitleInput');
  const noteContentInput = document.getElementById('noteContentInput');
  const noteTextColorInput = document.getElementById('noteTextColorInput');
  const noteFontSizeSelect = document.getElementById('noteFontSizeSelect');
  const notePasswordInput = document.getElementById('notePasswordInput');
  const notePasswordConfirmInput = document.getElementById('notePasswordConfirmInput');
  const notePasswordPanelTitle = document.getElementById('notePasswordPanelTitle');
  const notePasswordPanelHint = document.getElementById('notePasswordPanelHint');
  const notePasswordInputLabel = document.getElementById('notePasswordInputLabel');
  const notePasswordConfirmLabel = document.getElementById('notePasswordConfirmLabel');
  const noteViewModal = document.getElementById('noteViewModal');
  const noteViewSectionTag = document.getElementById('noteViewSectionTag');
  const noteViewTitle = document.getElementById('noteViewTitle');
  const noteViewMeta = document.getElementById('noteViewMeta');
  const noteViewContent = document.getElementById('noteViewContent');
  const noteViewEditBtn = document.getElementById('noteViewEditBtn');
  const noteViewTrashBtn = document.getElementById('noteViewTrashBtn');
  const noteUnlockPanel = document.getElementById('noteUnlockPanel');
  const noteUnlockPasswordInput = document.getElementById('noteUnlockPasswordInput');
  const noteUnlockBtn = document.getElementById('noteUnlockBtn');
  const showMyNotesBtn = document.getElementById('showMyNotesBtn');
  const showTrashBtn = document.getElementById('showTrashBtn');
  const dashboardUserToggle = document.getElementById('dashboardUserToggle');
  const dashboardUserDropdown = document.getElementById('dashboardUserDropdown');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const dashboardLogoutBtn = document.getElementById('dashboardLogoutBtn');
  const switchAccountBtn = document.getElementById('switchAccountBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
  const settingsForm = document.getElementById('settingsForm');
  const settingsFullNameInput = document.getElementById('settingsFullNameInput');
  const settingsUsernameInput = document.getElementById('settingsUsernameInput');
  const settingsEmailInput = document.getElementById('settingsEmailInput');
  const settingsBirthDateInput = document.getElementById('settingsBirthDateInput');
  const settingsGenderInput = document.getElementById('settingsGenderInput');
  const requestDeleteAccountForm = document.getElementById('requestDeleteAccountForm');
  const confirmDeleteAccountForm = document.getElementById('confirmDeleteAccountForm');
  const deleteAccountConfirmInput = document.getElementById('deleteAccountConfirmInput');
  const deleteAccountPasswordInput = document.getElementById('deleteAccountPasswordInput');
  const deleteAccountOtpInput = document.getElementById('deleteAccountOtpInput');

  function setActiveMode(mode) {
    const isTrash = mode === 'trash';
    showMyNotesBtn.classList.toggle('active', !isTrash);
    showTrashBtn.classList.toggle('active', isTrash);
  }

  function formatDate(value) {
    return new Date(value).toLocaleString('vi-VN');
  }

  function escapeHtml(value = '') {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function looksLikeHtml(content = '') {
    return /<\/?[a-z][\s\S]*>/i.test(content);
  }

  function formatStoredContent(content = '') {
    if (looksLikeHtml(content)) return content;
    return escapeHtml(content).replace(/\n/g, '<br>');
  }

  function getEditorContentHtml() {
    const html = noteContentInput.innerHTML.trim();
    const text = noteContentInput.textContent.replace(/\u00a0/g, ' ').trim();
    return text ? html : '';
  }

  function fillEditorContent(content = '') {
    noteContentInput.innerHTML = formatStoredContent(content);
  }

  function setNoteViewerVisible(visible) {
    noteViewer.classList.toggle('hidden', !visible);
  }

  function resetViewer(title, text, visible = false) {
    noteViewer.className = 'note-viewer empty';
    noteViewer.innerHTML = `
      <div class="note-viewer-placeholder">
        <h2>${title}</h2>
        <p>${text}</p>
      </div>
    `;
    setNoteViewerVisible(visible);
  }

  function getDraftKey(noteId = editingNoteId.value) {
    return noteId ? `note-${noteId}` : 'new-note';
  }

  function saveCurrentDraft() {
    if (noteModal.classList.contains('hidden')) return;
    const title = noteTitleInput.value.trim();
    const content = getEditorContentHtml();
    const key = getDraftKey();

    if (!title && !content) {
      delete state.drafts[key];
      return;
    }

    state.drafts[key] = { title, content };
  }

  function clearDraft(noteId = editingNoteId.value) {
    delete state.drafts[getDraftKey(noteId)];
  }

  function resetEditorSecurityFields(note = null) {
    notePasswordInput.value = '';
    notePasswordConfirmInput.value = '';

    if (!note) {
      notePasswordPanelTitle.textContent = 'M\u1eadt kh\u1ea9u c\u1ee7a trang nh\u1eadt k\u00fd';
      notePasswordPanelHint.textContent = 'M\u1ed7i trang nh\u1eadt k\u00fd m\u1edbi c\u1ea7n m\u1ed9t m\u1eadt kh\u1ea9u ri\u00eang \u0111\u1ec3 m\u1edf kh\u00f3a khi xem.';
      notePasswordInputLabel.textContent = 'M\u1eadt kh\u1ea9u trang nh\u1eadt k\u00fd';
      notePasswordConfirmLabel.textContent = 'Nh\u1eadp l\u1ea1i m\u1eadt kh\u1ea9u';
      notePasswordInput.placeholder = 'Nh\u1eadp m\u1eadt kh\u1ea9u \u0111\u1ec3 b\u1ea3o v\u1ec7 trang n\u00e0y';
      notePasswordConfirmInput.placeholder = 'Nh\u1eadp l\u1ea1i \u0111\u1ec3 x\u00e1c nh\u1eadn';
      return;
    }

    if (note.is_locked) {
      notePasswordPanelTitle.textContent = '\u0110\u1ed5i m\u1eadt kh\u1ea9u trang nh\u1eadt k\u00fd';
      notePasswordPanelHint.textContent = '\u0110\u1ec3 tr\u1ed1ng n\u1ebfu mu\u1ed1n gi\u1eef nguy\u00ean m\u1eadt kh\u1ea9u c\u0169. N\u1ebfu nh\u1eadp m\u1edbi, b\u1ea1n s\u1ebd d\u00f9ng m\u1eadt kh\u1ea9u m\u1edbi \u0111\u1ec3 m\u1edf kh\u00f3a trang n\u00e0y t\u1eeb l\u1ea7n sau.';
      notePasswordInputLabel.textContent = 'M\u1eadt kh\u1ea9u m\u1edbi';
      notePasswordConfirmLabel.textContent = 'Nh\u1eadp l\u1ea1i m\u1eadt kh\u1ea9u m\u1edbi';
      notePasswordInput.placeholder = '\u0110\u1ec3 tr\u1ed1ng n\u1ebfu kh\u00f4ng \u0111\u1ed5i';
      notePasswordConfirmInput.placeholder = 'Nh\u1eadp l\u1ea1i m\u1eadt kh\u1ea9u m\u1edbi';
      return;
    }

    notePasswordPanelTitle.textContent = 'B\u1eadt kh\u00f3a m\u1eadt kh\u1ea9u cho trang nh\u1eadt k\u00fd';
    notePasswordPanelHint.textContent = 'Trang c\u0169 n\u00e0y ch\u01b0a c\u00f3 l\u1edbp kh\u00f3a th\u1ee9 hai. \u0110\u1eb7t m\u1eadt kh\u1ea9u m\u1edbi \u0111\u1ec3 b\u1ea3o v\u1ec7 t\u1eeb b\u00e2y gi\u1edd.';
    notePasswordInputLabel.textContent = 'M\u1eadt kh\u1ea9u m\u1edbi';
    notePasswordConfirmLabel.textContent = 'Nh\u1eadp l\u1ea1i m\u1eadt kh\u1ea9u m\u1edbi';
    notePasswordInput.placeholder = 'Nh\u1eadp m\u1eadt kh\u1ea9u m\u1edbi n\u1ebfu mu\u1ed1n b\u1eadt kh\u00f3a';
    notePasswordConfirmInput.placeholder = 'Nh\u1eadp l\u1ea1i m\u1eadt kh\u1ea9u m\u1edbi';
  }

  function openNoteModal(note = null) {
    noteModal.classList.remove('hidden');
    const noteId = note?.id || '';
    const draft = state.drafts[getDraftKey(noteId)];

    if (note) {
      noteModalTitle.textContent = 'Ch\u1ec9nh s\u1eeda trang nh\u1eadt k\u00fd';
      editingNoteId.value = noteId;
      noteTitleInput.value = draft?.title ?? note.title;
      fillEditorContent(draft?.content ?? note.content);
      resetEditorSecurityFields(note);
    } else {
      noteModalTitle.textContent = 'Vi\u1ebft nh\u1eadt k\u00fd m\u1edbi';
      editingNoteId.value = '';
      noteTitleInput.value = draft?.title ?? '';
      fillEditorContent(draft?.content ?? '');
      resetEditorSecurityFields();
    }

    setMessage('');
    setTimeout(() => noteContentInput.focus(), 0);
  }

  function closeNoteModal(preserveDraft = true) {
    if (preserveDraft) saveCurrentDraft();
    noteModal.classList.add('hidden');
    editingNoteId.value = '';
    noteTitleInput.value = '';
    fillEditorContent('');
    resetEditorSecurityFields();
    setMessage('');
  }

  function clearViewMessage() {
    setMessage('', false, 'noteViewMsg');
  }

  function closeNoteViewModal() {
    noteViewModal.classList.add('hidden');
    noteUnlockPasswordInput.value = '';
    clearViewMessage();
    state.viewingNote = null;
  }

  function openSettingsModal() {
    if (!state.currentUser) return;
    settingsFullNameInput.value = state.currentUser.full_name || '';
    settingsUsernameInput.value = state.currentUser.username || '';
    settingsEmailInput.value = state.currentUser.email || '';
    settingsBirthDateInput.value = state.currentUser.birth_date ? String(state.currentUser.birth_date).slice(0, 10) : '';
    settingsGenderInput.value = state.currentUser.gender || '';
    deleteAccountConfirmInput.value = '';
    deleteAccountPasswordInput.value = '';
    deleteAccountOtpInput.value = '';
    setMessage('', false, 'settingsMsg');
    settingsModal.classList.remove('hidden');
  }

  function closeSettingsModal() {
    settingsModal.classList.add('hidden');
  }

  function renderSidebarNotes() {
    sidebarNotesList.innerHTML = '';
    if (!state.sidebarNotes.length) {
      const message = state.mode === 'trash'
        ? 'Ch\u01b0a c\u00f3 trang nh\u1eadt k\u00fd n\u00e0o trong th\u00f9ng r\u00e1c.'
        : state.mode === 'search'
          ? 'Kh\u00f4ng t\u00ecm th\u1ea5y trang nh\u1eadt k\u00fd ph\u00f9 h\u1ee3p n\u00e0o.'
          : 'Ch\u01b0a c\u00f3 trang nh\u1eadt k\u00fd n\u00e0o.';
      sidebarNotesList.innerHTML = `<li class="sidebar-empty">${message}</li>`;
      toggleSidebarNotesBtn.classList.add('hidden');
      return;
    }

    const visibleNotes = state.sidebarNotes.slice(0, state.sidebarExpanded ? state.sidebarNotes.length : 4);

    visibleNotes.forEach(note => {
      const item = document.createElement('li');
      item.className = `sidebar-note-item${note.id === state.selectedNoteId ? ' selected' : ''}`;
      item.innerHTML = `
        <button type="button">
          <strong>${escapeHtml(note.title)}</strong>
          <span>${state.mode === 'trash' ? '\u0110\u00e3 x\u00f3a: ' : 'Vi\u1ebft l\u00fac: '}${formatDate(note.deleted_at || note.created_at)}</span>
        </button>
      `;
      item.querySelector('button').onclick = () => {
        if (state.mode === 'trash') {
          state.selectedNoteId = note.id;
          renderSidebarNotes();
          renderTrashPreview(note);
        } else {
          loadNoteDetail(note.id);
        }
      };
      sidebarNotesList.appendChild(item);
    });

    if (state.sidebarNotes.length > 4) {
      toggleSidebarNotesBtn.classList.remove('hidden');
      toggleSidebarNotesBtn.textContent = state.sidebarExpanded ? 'R\u00fat g\u1ecdn' : 'Xem th\u00eam';
    } else {
      toggleSidebarNotesBtn.classList.add('hidden');
    }
  }

  function renderNotesGrid() {
    notesGrid.innerHTML = '';
    if (!state.gridNotes.length) {
      const message = state.mode === 'trash'
        ? 'Ch\u01b0a c\u00f3 trang nh\u1eadt k\u00fd n\u00e0o trong th\u00f9ng r\u00e1c.'
        : state.mode === 'search'
          ? 'Kh\u00f4ng t\u00ecm th\u1ea5y trang nh\u1eadt k\u00fd ph\u00f9 h\u1ee3p n\u00e0o.'
          : 'Ch\u01b0a c\u00f3 trang nh\u1eadt k\u00fd n\u00e0o.';
      notesGrid.innerHTML = `<article class="note-card empty-card"><p>${message}</p></article>`;
      return;
    }

    state.gridNotes.forEach(note => {
      const card = document.createElement('article');
      card.className = 'note-card';
      card.innerHTML = `
        <div class="note-card-icon"></div>
        <h3>${escapeHtml(note.title)}</h3>
        <p>${state.mode === 'trash' ? '\u0110\u00e3 x\u00f3a l\u00fac ' : 'C\u1eadp nh\u1eadt l\u00fac '}${formatDate(note.deleted_at || note.updated_at || note.created_at)}</p>
      `;
      card.onclick = () => {
        if (state.mode === 'trash') {
          state.selectedNoteId = note.id;
          renderSidebarNotes();
          renderTrashPreview(note);
        } else {
          loadNoteDetail(note.id);
        }
      };
      notesGrid.appendChild(card);
    });
  }

  function renderTrashPreview(note) {
    noteViewer.className = 'note-viewer';
    setNoteViewerVisible(true);
    noteViewer.innerHTML = `
      <div class="note-viewer-head">
        <div>
          <p class="section-tag">Th\u00f9ng r\u00e1c</p>
          <h2>${escapeHtml(note.title)}</h2>
          <p class="note-meta">\u0110\u00e3 x\u00f3a l\u00fac ${formatDate(note.deleted_at)}</p>
        </div>
      </div>
      <div class="note-viewer-body">
        <p>Trang nh\u1eadt k\u00fd n\u00e0y \u0111ang n\u1eb1m trong th\u00f9ng r\u00e1c v\u00e0 s\u1ebd b\u1ecb x\u00f3a t\u1ef1 \u0111\u1ed9ng sau 30 ng\u00e0y n\u1ebfu b\u1ea1n kh\u00f4ng kh\u00f4i ph\u1ee5c.</p>
      </div>
      <div class="note-viewer-actions">
        <button type="button" id="restoreNoteBtn">Kh\u00f4i ph\u1ee5c</button>
        <button type="button" class="danger-btn" id="deleteForeverBtn">X\u00f3a v\u0129nh vi\u1ec5n</button>
      </div>
    `;


    document.getElementById('restoreNoteBtn').onclick = async () => {
      const { response, data } = await postJson(`/notes/${note.id}/restore`, {});
      setMessage(data.message, !response.ok);
      if (response.ok) loadMyNotes();
    };

    document.getElementById('deleteForeverBtn').onclick = async () => {
      const { response, data } = await fetchJson(`/notes/${note.id}/permanent`, { method: 'DELETE' });
      setMessage(data.message, !response.ok);
      if (response.ok) loadTrashNotes();
    };
  }

  function setViewLockedState(note) {
    state.viewingNote = note;
    noteViewSectionTag.textContent = note.is_locked ? 'Trang nh\u1eadt k\u00fd \u0111\u01b0\u1ee3c b\u1ea3o v\u1ec7' : 'Chi ti\u1ebft trang nh\u1eadt k\u00fd';
    noteViewTitle.textContent = note.title;
    noteViewMeta.textContent = `Vi\u1ebft l\u00fac ${formatDate(note.created_at)} \u2022 C\u1eadp nh\u1eadt ${formatDate(note.updated_at)}`;
    noteUnlockPanel.classList.toggle('hidden', !note.is_locked);
    noteViewContent.innerHTML = note.is_locked
      ? '<p>Trang nh\u1eadt k\u00fd n\u00e0y \u0111ang \u0111\u01b0\u1ee3c m\u00e3 h\u00f3a. Nh\u1eadp \u0111\u00fang m\u1eadt kh\u1ea9u \u0111\u1ec3 gi\u1ea3i m\u00e3 n\u1ed9i dung.</p>'
      : '<p>\u0110ang t\u1ea3i n\u1ed9i dung...</p>';
    noteViewEditBtn.disabled = true;
    noteViewTrashBtn.disabled = note.is_locked;
    noteViewModal.classList.remove('hidden');
    clearViewMessage();
  }

  function setViewUnlockedState(note) {
    state.viewingNote = note;
    noteViewSectionTag.textContent = note.is_legacy ? 'Chi ti\u1ebft trang nh\u1eadt k\u00fd' : 'Trang nh\u1eadt k\u00fd \u0111\u00e3 m\u1edf kh\u00f3a';
    noteViewTitle.textContent = note.title;
    noteViewMeta.textContent = `Vi\u1ebft l\u00fac ${formatDate(note.created_at)} \u2022 C\u1eadp nh\u1eadt ${formatDate(note.updated_at)}`;
    noteUnlockPanel.classList.add('hidden');
    noteViewContent.innerHTML = formatStoredContent(note.content);
    noteViewEditBtn.disabled = false;
    noteViewTrashBtn.disabled = false;
    noteViewModal.classList.remove('hidden');
    clearViewMessage();
  }

  async function unlockCurrentNote(notePassword = '', silent = false) {
    if (!state.viewingNote?.id) return false;

    const { response, data } = await postJson(`/notes/${state.viewingNote.id}/unlock`, { notePassword });
    if (!response.ok) {
      if (state.viewingNote?.id) delete state.unlockedPasswords[state.viewingNote.id];
      if (!silent) setMessage(data.message, true, 'noteViewMsg');
      return false;
    }

    if (data.is_locked) {
      state.unlockedPasswords[data.id] = notePassword;
    }
    setViewUnlockedState(data);
    noteUnlockPasswordInput.value = '';
    return true;
  }

  async function loadNoteDetail(noteId) {
    const { response, data } = await fetchJson(`/notes/${noteId}`);
    if (!response.ok) {
      setMessage(data.message, true);
      return;
    }

    state.selectedNoteId = noteId;
    renderSidebarNotes();
    resetViewer(
      escapeHtml(data.title),
      'Trang nh\u1eadt k\u00fd n\u00e0y \u0111ang m\u1edf trong c\u1eeda s\u1ed5 ri\u00eang. B\u1ea1n c\u1ea7n m\u1edf kh\u00f3a \u0111\u00fang m\u1eadt kh\u1ea9u m\u1edbi xem \u0111\u01b0\u1ee3c n\u1ed9i dung th\u1eadt.',
      false
    );

    setViewLockedState(data);

    if (!data.is_locked) {
      await unlockCurrentNote('', true);
      return;
    }

    const cachedPassword = state.unlockedPasswords[noteId];
    if (cachedPassword) {
      const unlocked = await unlockCurrentNote(cachedPassword, true);
      if (!unlocked) setViewLockedState(data);
    }
  }

  async function loadCurrentUser() {
    const { response, data } = await fetchJson('/auth/me');
    if (response.ok) {
      state.currentUser = data.user;
      usernameEl.textContent = data.user.full_name || data.user.username;
      return;
    }

    if (response.status === 401) {
      if (window.clearAuthToken) {
        window.clearAuthToken();
      }
      location.href = '/login.html';
    }
  }

  async function loadMyNotes() {
    state.mode = 'notes';
    state.selectedNoteId = null;
    state.sidebarExpanded = false;
    noteSearchInput.value = '';
    setActiveMode('notes');
    mainSectionTitle.textContent = 'Trang nh\u1eadt k\u00fd c\u1ee7a t\u00f4i';
    dashboardHint.textContent = 'Ch\u1ecdn m\u1ed9t trang \u0111\u1ec3 m\u1edf ri\u00eang, ho\u1eb7c nh\u1ea5n d\u1ea5u c\u1ed9ng \u0111\u1ec3 vi\u1ebft th\u00eam m\u1ed9t ng\u00e0y m\u1edbi.';
    const { data } = await fetchJson('/notes');
    state.sidebarNotes = data;
    state.gridNotes = data;
    renderSidebarNotes();
    renderNotesGrid();
    resetViewer('Ch\u01b0a m\u1edf trang nh\u1eadt k\u00fd n\u00e0o', 'Nh\u1ea5n v\u00e0o m\u1ed9t trang \u1edf menu b\u00ean tr\u00e1i ho\u1eb7c trong l\u01b0\u1edbi \u0111\u1ec3 m\u1edf c\u1eeda s\u1ed5 n\u1ed9i dung ri\u00eang.', false);
  }

  async function loadTrashNotes() {
    state.mode = 'trash';
    state.selectedNoteId = null;
    state.sidebarExpanded = false;
    closeNoteViewModal();
    noteSearchInput.value = '';
    setActiveMode('trash');
    mainSectionTitle.textContent = 'Th\u00f9ng r\u00e1c';
    dashboardHint.textContent = 'C\u00e1c trang nh\u1eadt k\u00fd \u0111\u00e3 x\u00f3a s\u1ebd \u0111\u01b0\u1ee3c l\u01b0u trong th\u00f9ng r\u00e1c t\u1ed1i \u0111a 30 ng\u00e0y.';
    const { data } = await fetchJson('/notes/trash/list');
    state.sidebarNotes = data;
    state.gridNotes = data;
    renderSidebarNotes();
    renderNotesGrid();
    if (!data.length) {
      resetViewer('Th\u00f9ng r\u00e1c', 'Ch\u01b0a c\u00f3 trang nh\u1eadt k\u00fd n\u00e0o trong th\u00f9ng r\u00e1c.', true);
    } else {
      resetViewer('Th\u00f9ng r\u00e1c', 'Ch\u1ecdn m\u1ed9t trang nh\u1eadt k\u00fd \u0111\u00e3 x\u00f3a \u0111\u1ec3 kh\u00f4i ph\u1ee5c ho\u1eb7c x\u00f3a v\u0129nh vi\u1ec5n.', true);
    }
  }

  async function runSearch() {
    const query = noteSearchInput.value.trim();
    if (!query) {
      loadMyNotes();
      return;
    }

    state.mode = 'search';
    state.selectedNoteId = null;
    state.sidebarExpanded = false;
    closeNoteViewModal();
    setActiveMode('notes');
    mainSectionTitle.textContent = 'Trang nh\u1eadt k\u00fd c\u1ee7a t\u00f4i';
    dashboardHint.textContent = `\u0110ang t\u00ecm theo ti\u00eau \u0111\u1ec1: "${query}"`;
    const { data } = await fetchJson(`/notes?q=${encodeURIComponent(query)}`);
    state.sidebarNotes = data;
    state.gridNotes = data;
    renderSidebarNotes();
    renderNotesGrid();
    if (!data.length) {
      resetViewer('Trang nh\u1eadt k\u00fd c\u1ee7a t\u00f4i', 'Kh\u00f4ng t\u00ecm th\u1ea5y trang nh\u1eadt k\u00fd ph\u00f9 h\u1ee3p n\u00e0o.', false);
    } else {
      resetViewer('Trang nh\u1eadt k\u00fd c\u1ee7a t\u00f4i', 'Nh\u1ea5n v\u00e0o m\u1ed9t trang \u0111\u1ec3 m\u1edf c\u1eeda s\u1ed5 n\u1ed9i dung ri\u00eang.', false);
    }
  }

  function focusEditor() {
    noteContentInput.focus();
  }

  function getEditorSecurityPayload(noteId) {
    const password = notePasswordInput.value;
    const passwordConfirm = notePasswordConfirmInput.value;

    if (!noteId) {
      if (!password || !passwordConfirm) {
        return { error: 'Vui l\u00f2ng nh\u1eadp v\u00e0 x\u00e1c nh\u1eadn m\u1eadt kh\u1ea9u cho trang nh\u1eadt k\u00fd m\u1edbi.' };
      }
      if (password !== passwordConfirm) {
        return { error: 'M\u1eadt kh\u1ea9u trang nh\u1eadt k\u00fd nh\u1eadp l\u1ea1i ch\u01b0a kh\u1edbp.' };
      }
      return { notePassword: password };
    }

    const note = state.viewingNote;
    const currentPassword = state.unlockedPasswords[noteId];

    if (password || passwordConfirm) {
      if (password !== passwordConfirm) {
        return { error: 'M\u1eadt kh\u1ea9u m\u1edbi c\u1ee7a trang nh\u1eadt k\u00fd nh\u1eadp l\u1ea1i ch\u01b0a kh\u1edbp.' };
      }
      if (note?.is_locked) {
        if (!currentPassword) {
          return { error: 'B\u1ea1n c\u1ea7n m\u1edf kh\u00f3a trang nh\u1eadt k\u00fd tr\u01b0\u1edbc khi \u0111\u1ed5i m\u1eadt kh\u1ea9u.' };
        }
        return {
          currentNotePassword: currentPassword,
          newNotePassword: password
        };
      }
      return { newNotePassword: password };
    }

    if (note?.is_locked) {
      if (!currentPassword) {
        return { error: 'B\u1ea1n c\u1ea7n m\u1edf kh\u00f3a trang nh\u1eadt k\u00fd tr\u01b0\u1edbc khi l\u01b0u thay \u0111\u1ed5i.' };
      }
      return { currentNotePassword: currentPassword };
    }

    return {};
  }

  noteTitleInput.oninput = saveCurrentDraft;
  noteContentInput.oninput = saveCurrentDraft;

  document.querySelectorAll('.toolbar-btn[data-command]').forEach(button => {
    button.onclick = () => {
      focusEditor();
      document.execCommand(button.dataset.command, false, null);
      saveCurrentDraft();
    };
  });

  noteTextColorInput.oninput = event => {
    focusEditor();
    document.execCommand('foreColor', false, event.target.value);
    saveCurrentDraft();
  };

  noteFontSizeSelect.onchange = event => {
    focusEditor();
    document.execCommand('fontSize', false, event.target.value);
    saveCurrentDraft();
  };

  dashboardUserToggle.onclick = event => {
    event.stopPropagation();
    dashboardUserDropdown.classList.toggle('hidden');
  };

  openSettingsBtn.onclick = () => {
    dashboardUserDropdown.classList.add('hidden');
    openSettingsModal();
  };

  dashboardLogoutBtn.onclick = () => logout('/');
  switchAccountBtn.onclick = () => logout('/login.html');

  settingsForm.onsubmit = async event => {
    event.preventDefault();
    const { response, data } = await postJson('/auth/profile', {
      fullName: settingsFullNameInput.value.trim(),
      birthDate: settingsBirthDateInput.value,
      gender: settingsGenderInput.value
    });
    setMessage(data.message, !response.ok, 'settingsMsg');
    if (response.ok) {
      await loadCurrentUser();
    }
  };

  requestDeleteAccountForm.onsubmit = async event => {
    event.preventDefault();
    const { response, data } = await postJson('/auth/request-account-deletion', {
      confirmDelete: deleteAccountConfirmInput.value === 'yes',
      password: deleteAccountPasswordInput.value
    });
    setMessage(data.message, !response.ok, 'settingsMsg');
  };

  confirmDeleteAccountForm.onsubmit = async event => {
    event.preventDefault();
    const { response, data } = await postJson('/auth/confirm-account-deletion', {
      otp: deleteAccountOtpInput.value.trim()
    });
    setMessage(data.message, !response.ok, 'settingsMsg');
    if (response.ok) {
      setTimeout(() => {
        location.href = '/login.html';
      }, 1200);
    }
  };

  document.getElementById('openCreateNoteBtn').onclick = () => openNoteModal();
  document.getElementById('closeNoteModalBtn').onclick = () => closeNoteModal(true);
  document.getElementById('closeNoteViewModalBtn').onclick = closeNoteViewModal;
  closeSettingsModalBtn.onclick = closeSettingsModal;
  toggleSidebarNotesBtn.onclick = () => {
    state.sidebarExpanded = !state.sidebarExpanded;
    renderSidebarNotes();
  };
  showMyNotesBtn.onclick = () => loadMyNotes();
  showTrashBtn.onclick = () => loadTrashNotes();
  document.getElementById('noteSearchBtn').onclick = runSearch;
  noteSearchInput.onkeydown = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
  };

  noteUnlockBtn.onclick = () => unlockCurrentNote(noteUnlockPasswordInput.value);
  noteUnlockPasswordInput.onkeydown = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      unlockCurrentNote(noteUnlockPasswordInput.value);
    }
  };

  noteViewEditBtn.onclick = () => {
    if (!state.viewingNote?.content) {
      setMessage('H\u00e3y m\u1edf kh\u00f3a trang nh\u1eadt k\u00fd tr\u01b0\u1edbc khi ch\u1ec9nh s\u1eeda.', true, 'noteViewMsg');
      return;
    }
    closeNoteViewModal();
    openNoteModal(state.viewingNote);
  };

  noteViewTrashBtn.onclick = async () => {
    if (!state.viewingNote?.id) return;
    const noteId = state.viewingNote.id;
    const { response, data } = await fetchJson(`/notes/${noteId}`, { method: 'DELETE' });
    setMessage(data.message, !response.ok);
    if (response.ok) {
      delete state.unlockedPasswords[noteId];
      closeNoteViewModal();
      loadMyNotes();
    }
  };

  document.getElementById('noteEditorForm').onsubmit = async event => {
    event.preventDefault();
    const noteId = editingNoteId.value;
    const payload = {
      title: noteTitleInput.value.trim(),
      content: getEditorContentHtml()
    };

    if (!payload.title || !payload.content) {
      setMessage('Vui l\u00f2ng nh\u1eadp ti\u00eau \u0111\u1ec1 v\u00e0 n\u1ed9i dung.', true);
      return;
    }

    const securityPayload = getEditorSecurityPayload(noteId);
    if (securityPayload.error) {
      setMessage(securityPayload.error, true);
      return;
    }

    const url = noteId ? `/notes/${noteId}` : '/notes';
    const method = noteId ? 'PUT' : 'POST';
    const { response, data } = await fetchJson(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, ...securityPayload })
    });

    setMessage(data.message, !response.ok);
    if (response.ok) {
      if (noteId && securityPayload.newNotePassword) {
        state.unlockedPasswords[noteId] = securityPayload.newNotePassword;
      }
      clearDraft(noteId);
      closeNoteModal(false);
      loadMyNotes();
    }
  };

  noteModal.onclick = event => {
    if (event.target === noteModal) closeNoteModal(true);
  };

  noteViewModal.onclick = event => {
    if (event.target === noteViewModal) closeNoteViewModal();
  };

  settingsModal.onclick = event => {
    if (event.target === settingsModal) closeSettingsModal();
  };

  document.addEventListener('click', event => {
    if (!dashboardUserDropdown.classList.contains('hidden') && !event.target.closest('.dashboard-user-menu')) {
      dashboardUserDropdown.classList.add('hidden');
    }
  });

  loadCurrentUser();
  loadMyNotes();
}
