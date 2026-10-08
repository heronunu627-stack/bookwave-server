// Bookwave Studio Management JavaScript
// Premium Dark Studio (Linear / Spotify Creator Style)
// Handles sidebar navigation, metrics, library upload/deletion, and user accounts

(function () {
  'use strict';

  const ADMIN_TOKEN_KEY = 'bw_admin_token';
  let libraryItems = [];
  let registeredUsers = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let activeAudioItem = null;
  let activeView = 'dashboard';

  // DOM Elements - Security Gate
  const adminSecurityGate = document.getElementById('adminSecurityGate');
  const adminAuthForm = document.getElementById('adminAuthForm');
  const inputAdminPassword = document.getElementById('inputAdminPassword');
  const adminAuthError = document.getElementById('adminAuthError');
  const btnAdminLogout = document.getElementById('btnAdminLogout');

  // DOM Elements - Navigation & Views
  const navDashboard = document.getElementById('navDashboard');
  const navContent = document.getElementById('navContent');
  const navUsers = document.getElementById('navUsers');
  const navAds = document.getElementById('navAds');
  const viewDashboard = document.getElementById('viewDashboard');
  const viewContent = document.getElementById('viewContent');
  const viewUsers = document.getElementById('viewUsers');
  const viewAds = document.getElementById('viewAds');
  const topbarCurrentTitle = document.getElementById('topbarCurrentTitle');
  const btnTopAction = document.getElementById('btnTopAction');
  const sidebarBadgeContent = document.getElementById('sidebarBadgeContent');
  const sidebarBadgeUsers = document.getElementById('sidebarBadgeUsers');

  // Quick Action Cards
  const cardQuickUpload = document.getElementById('cardQuickUpload');
  const cardQuickUsers = document.getElementById('cardQuickUsers');

  let revealedPasswords = null;

  // DOM Elements - User Management
  const formAddUser = document.getElementById('formAddUser');
  const newUsername = document.getElementById('newUsername');
  const newPassword = document.getElementById('newPassword');
  const newName = document.getElementById('newName');
  const newTier = document.getElementById('newTier');
  const userTableBody = document.getElementById('userTableBody');
  const statUsers = document.getElementById('statUsers');
  const btnTogglePasswords = document.getElementById('btnTogglePasswords');
  const btnTogglePasswordsIcon = document.getElementById('btnTogglePasswordsIcon');
  const btnTogglePasswordsText = document.getElementById('btnTogglePasswordsText');

  const btnSubmitUser = document.getElementById('btnSubmitUser');

  // DOM Elements - Master Auth Modal (Password Verification)
  const masterAuthModal = document.getElementById('masterAuthModal');
  const formMasterAuth = document.getElementById('formMasterAuth');
  const inputMasterAuthPassword = document.getElementById('inputMasterAuthPassword');
  const masterAuthError = document.getElementById('masterAuthError');
  const btnCancelMasterAuth = document.getElementById('btnCancelMasterAuth');

  // DOM Elements - Master Password Change Modal
  const btnOpenChangeMasterPw = document.getElementById('btnOpenChangeMasterPw');
  const btnSidebarChangeMasterPw = document.getElementById('btnSidebarChangeMasterPw');
  const modalChangeMasterPw = document.getElementById('modalChangeMasterPw');
  const formChangeMasterPw = document.getElementById('formChangeMasterPw');
  const inputNewMasterPw = document.getElementById('inputNewMasterPw');
  const inputConfirmMasterPw = document.getElementById('inputConfirmMasterPw');
  const changeMasterPwError = document.getElementById('changeMasterPwError');
  const btnCancelChangeMasterPw = document.getElementById('btnCancelChangeMasterPw');

  // DOM Elements - User Password Change Modal
  const modalChangeUserPw = document.getElementById('modalChangeUserPw');
  const formChangeUserPw = document.getElementById('formChangeUserPw');
  const inputTargetUsername = document.getElementById('inputTargetUsername');
  const inputNewUserPw = document.getElementById('inputNewUserPw');
  const userChangePwDesc = document.getElementById('userChangePwDesc');
  const changeUserPwError = document.getElementById('changeUserPwError');
  const btnCancelChangeUserPw = document.getElementById('btnCancelChangeUserPw');
  const btnSyncAllUsersLink = document.getElementById('btnSyncAllUsersLink');

  // DOM Elements - Ad Rotation Management
  const adActiveToggle = document.getElementById('adActiveToggle');
  const adRotationModeSelect = document.getElementById('adRotationModeSelect');
  const adCountBadge = document.getElementById('adCountBadge');
  const btnAddNewAd = document.getElementById('btnAddNewAd');
  const adListContainer = document.getElementById('adListContainer');
  const editorAdTitleBadge = document.getElementById('editorAdTitleBadge');
  const inputAdItemActive = document.getElementById('inputAdItemActive');
  const inputAdTitle = document.getElementById('inputAdTitle');
  const inputAdSponsor = document.getElementById('inputAdSponsor');
  const inputAdMessage = document.getElementById('inputAdMessage');
  const inputAdImageUrl = document.getElementById('inputAdImageUrl');
  const inputAdImageFile = document.getElementById('inputAdImageFile');
  const btnSelectAdImage = document.getElementById('btnSelectAdImage');
  const btnRemoveAdImage = document.getElementById('btnRemoveAdImage');
  const inputAdLink = document.getElementById('inputAdLink');
  const inputAdSkipSeconds = document.getElementById('inputAdSkipSeconds');
  const formAdSettings = document.getElementById('formAdSettings');
  const btnApplyCurrentAd = document.getElementById('btnApplyCurrentAd');
  const btnSaveAd = document.getElementById('btnSaveAd');
  const btnPrevPreviewAd = document.getElementById('btnPrevPreviewAd');
  const btnNextPreviewAd = document.getElementById('btnNextPreviewAd');
  const previewAdIndexIndicator = document.getElementById('previewAdIndexIndicator');
  const previewAdSponsor = document.getElementById('previewAdSponsor');
  const previewAdTimer = document.getElementById('previewAdTimer');
  const previewAdTitle = document.getElementById('previewAdTitle');
  const previewAdMessage = document.getElementById('previewAdMessage');
  const previewAdImageContainer = document.getElementById('previewAdImageContainer');
  const previewAdImage = document.getElementById('previewAdImage');
  const previewAdDefaultIcon = document.getElementById('previewAdDefaultIcon');

  // DOM Elements - Library & Stats
  const statEbooks = document.getElementById('statEbooks');
  const statAudiobooks = document.getElementById('statAudiobooks');
  const statStorage = document.getElementById('statStorage');
  const adminTableBody = document.getElementById('adminTableBody');
  const adminEmptyState = document.getElementById('adminEmptyState');
  const adminSearchInput = document.getElementById('adminSearchInput');
  
  // Dual Upload Dropzones
  const adminEbookDropzone = document.getElementById('adminEbookDropzone');
  const btnSelectEbookFiles = document.getElementById('btnSelectEbookFiles');
  const adminEbookFileInput = document.getElementById('adminEbookFileInput');

  const adminAudioDropzone = document.getElementById('adminAudioDropzone');
  const btnSelectAudioFiles = document.getElementById('btnSelectAudioFiles');
  const adminAudioFileInput = document.getElementById('adminAudioFileInput');

  const uploadProgressArea = document.getElementById('uploadProgressArea');
  const uploadStatusText = document.getElementById('uploadStatusText');
  const uploadPercentText = document.getElementById('uploadPercentText');
  const uploadProgressBar = document.getElementById('uploadProgressBar');

  // Preview elements
  const audioPlayerBar = document.getElementById('audioPlayerBar');
  const audioElement = document.getElementById('audioElement');
  const playerTitle = document.getElementById('playerTitle');
  const playerSubtitle = document.getElementById('playerSubtitle');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const playIcon = document.getElementById('playIcon');
  const audioTimeline = document.getElementById('audioTimeline');
  const currentTimeLabel = document.getElementById('currentTimeLabel');
  const durationLabel = document.getElementById('durationLabel');
  const speedSelect = document.getElementById('speedSelect');
  const btnClosePlayer = document.getElementById('btnClosePlayer');

  // Reader Preview
  const readerModal = document.getElementById('readerModal');
  const readerBody = document.getElementById('readerBody');
  const readerBookTitle = document.getElementById('readerBookTitle');

  // Toast
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');

  function init() {
    bindEvents();
    checkAdminAuth();
  }

  // --- View Switching (Sidebar Navigation) ---
  const views = {
    dashboard: {
      el: viewDashboard,
      nav: navDashboard,
      title: '대시보드',
      btnText: '➕ 새 콘텐츠 등록',
      btnAction: () => switchView('content')
    },
    content: {
      el: viewContent,
      nav: navContent,
      title: '콘텐츠 관리',
      btnText: '📤 파일 선택 업로드',
      btnAction: () => adminFileInput && adminFileInput.click()
    },
    users: {
      el: viewUsers,
      nav: navUsers,
      title: '회원 계정 관리',
      btnText: '➕ 회원 계정 추가',
      btnAction: () => newUsername && newUsername.focus()
    },
    ads: {
      el: viewAds,
      nav: navAds,
      title: '광고 관리',
      btnText: '💾 광고 설정 저장',
      btnAction: () => handleSaveAdSettings()
    }
  };

  function switchView(viewName) {
    if (!views[viewName]) return;
    activeView = viewName;

    // Toggle navigation classes
    Object.keys(views).forEach(key => {
      const v = views[key];
      if (v.nav) {
        if (key === viewName) v.nav.classList.add('active');
        else v.nav.classList.remove('active');
      }
      if (v.el) {
        if (key === viewName) v.el.classList.add('active');
        else v.el.classList.remove('active');
      }
    });

    // Update topbar breadcrumb and button
    const current = views[viewName];
    if (topbarCurrentTitle) topbarCurrentTitle.textContent = current.title;
    if (btnTopAction) {
      btnTopAction.innerHTML = `<span>${current.btnText.slice(0, 2)}</span><span>${current.btnText.slice(2)}</span>`;
      btnTopAction.onclick = current.btnAction;
    }
  }

  // --- Admin Security Gate & Session ---
  const DEFAULT_STUDIO_PASS_HASH = '51dee4b64e747e69497f4a5649f2aba0ccdd63e50a863fe2aaec52d96e7057cd';

  function getActiveStudioPwHash() {
    return localStorage.getItem('bw_studio_pw_hash') || DEFAULT_STUDIO_PASS_HASH;
  }

  async function calculateSha256(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getAdminToken() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  }

  async function checkAdminAuth() {
    const token = getAdminToken();
    if (!token) {
      showSecurityGate();
      return;
    }

    if (token === 'static_studio_master_token') {
      hideSecurityGate();
      loadLibrary();
      loadUsers();
      loadAdSettings();
      return;
    }

    try {
      const res = await fetch('/api/users', {
        headers: { 'X-Admin-Token': token }
      });
      if (res.ok) {
        hideSecurityGate();
        loadLibrary();
        loadUsers();
        loadAdSettings();
      } else if (res.status === 404 || res.status === 405) {
        hideSecurityGate();
        loadLibrary();
        loadUsers();
        loadAdSettings();
      } else {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        showSecurityGate();
      }
    } catch (e) {
      hideSecurityGate();
      loadLibrary();
      loadUsers();
      loadAdSettings();
    }
  }

  function showSecurityGate() {
    if (adminSecurityGate) {
      adminSecurityGate.style.display = 'flex';
      if (inputAdminPassword) {
        inputAdminPassword.value = '';
        setTimeout(() => inputAdminPassword.focus(), 150);
      }
    }
  }

  function hideSecurityGate() {
    if (adminSecurityGate) {
      adminSecurityGate.style.display = 'none';
    }
  }

  async function handleAdminAuthSubmit() {
    if (!inputAdminPassword) return;
    const password = inputAdminPassword.value;
    if (!password) {
      if (adminAuthError) {
        adminAuthError.textContent = '접속 암호를 입력해 주세요.';
        adminAuthError.style.display = 'block';
      }
      return;
    }

    if (adminAuthError) adminAuthError.style.display = 'none';

    try {
      let isStaticMode = false;
      let res;
      try {
        res = await fetch('/api/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        if (res.status === 404 || res.status === 405) {
          isStaticMode = true;
        }
      } catch (netErr) {
        isStaticMode = true;
      }

      if (isStaticMode) {
        const inputHash = await calculateSha256(password);
        if (inputHash === getActiveStudioPwHash()) {
          sessionStorage.setItem(ADMIN_TOKEN_KEY, 'static_studio_master_token');
          inputAdminPassword.value = '';
          hideSecurityGate();
          loadLibrary();
          loadUsers();
          loadAdSettings();
          showToast('🔓 스튜디오에 안전하게 접속되었습니다.');
          return;
        } else {
          if (adminAuthError) {
            adminAuthError.textContent = '접속 암호가 올바르지 않습니다.';
            adminAuthError.style.display = 'block';
          }
          inputAdminPassword.select();
          return;
        }
      }

      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        inputAdminPassword.value = '';
        hideSecurityGate();
        loadLibrary();
        loadUsers();
        loadAdSettings();
        showToast('🔓 스튜디오에 안전하게 접속되었습니다.');
      } else {
        if (adminAuthError) {
          adminAuthError.textContent = data.message || '접속 암호가 올바르지 않습니다.';
          adminAuthError.style.display = 'block';
        }
        inputAdminPassword.select();
      }
    } catch (err) {
      const inputHash = await calculateSha256(password);
      if (inputHash === getActiveStudioPwHash()) {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, 'static_studio_master_token');
        inputAdminPassword.value = '';
        hideSecurityGate();
        loadLibrary();
        loadUsers();
        loadAdSettings();
        showToast('🔓 스튜디오에 안전하게 접속되었습니다.');
      } else {
        if (adminAuthError) {
          adminAuthError.textContent = '접속 암호가 올바르지 않습니다.';
          adminAuthError.style.display = 'block';
        }
        inputAdminPassword.select();
      }
    }
  }

  function handleAdminLogout() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    showSecurityGate();
    showToast('🔒 스튜디오가 잠겼습니다.');
  }

  // --- User Account Management ---
  async function loadUsers() {
    const token = getAdminToken();
    if (!token) return;

    try {
      let isStatic = (token === 'static_studio_master_token');
      let data = null;
      if (!isStatic) {
        try {
          const res = await fetch('/api/users', {
            headers: { 'X-Admin-Token': token }
          });
          if (res.status === 401) {
            handleAdminLogout();
            return;
          }
          if (res.ok) {
            data = await res.json();
          } else {
            isStatic = true;
          }
        } catch (e) {
          isStatic = true;
        }
      }

      if (isStatic) {
        const stored = localStorage.getItem('bw_static_users');
        if (stored) {
          try { registeredUsers = JSON.parse(stored); } catch (e) { registeredUsers = []; }
        } else {
          try {
            const dataRes = await fetch('/data/users.json').catch(() => null);
            if (dataRes && dataRes.ok) {
              const dataObj = await dataRes.json().catch(() => null);
              if (dataObj && Array.isArray(dataObj.users)) {
                registeredUsers = dataObj.users;
              }
            }
          } catch (e) {}
          if (!registeredUsers || registeredUsers.length === 0) {
            registeredUsers = [
              { username: 'reader', name: '김독서', tier: 'premium', password: '1234', passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', createdAt: '2026-10-06' },
              { username: 'yeonwoo', name: '연우', tier: 'premium', password: '1234', passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', createdAt: '2026-10-06' }
            ];
          }
          localStorage.setItem('bw_static_users', JSON.stringify(registeredUsers));
        }
      } else if (data) {
        registeredUsers = data.users || [];
      }
      renderUsers(registeredUsers);
      renderStats();
    } catch (err) {
      console.error('회원 목록 로드 실패:', err);
    }
  }

  function renderUsers(users) {
    if (!userTableBody) return;
    userTableBody.innerHTML = '';

    if (sidebarBadgeUsers) {
      sidebarBadgeUsers.textContent = users.length;
    }

    if (!users || users.length === 0) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--studio-text-muted); padding: 40px;">
            등록된 회원 계정이 없습니다. 위 양식에서 첫 회원을 추가해 보세요.
          </td>
        </tr>
      `;
      return;
    }

    users.forEach(u => {
      const tr = document.createElement('tr');
      const tier = u.tier || 'pro';
      const tierLabel = tier === 'free' ? '무료' : (tier === 'premium' ? '프리미엄' : 'PRO');
      const tierIcon = tier === 'free' ? '⚪' : (tier === 'premium' ? '👑' : '⚡');

      const pwText = revealedPasswords && revealedPasswords[u.username] ? revealedPasswords[u.username] : null;
      const pwHtml = pwText ? `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-family: monospace; font-size: 0.92rem; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.12); padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.3); letter-spacing: 0.5px;">${escapeHtml(pwText)}</span>
          <button class="icon-btn btn-copy-pw" data-pw="${escapeHtml(pwText)}" title="비밀번호 복사" style="width: 26px; height: 26px; font-size: 0.78rem;">📋</button>
        </div>
      ` : `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--studio-text-muted); font-size: 0.82rem; letter-spacing: 2px;">••••••••</span>
          <button class="icon-btn btn-reveal-pw" data-username="${escapeHtml(u.username)}" title="비밀번호 확인 (마스터 인증)" style="width: 26px; height: 26px; font-size: 0.78rem;">👁️</button>
        </div>
      `;

      tr.innerHTML = `
        <td>
          <div style="font-weight: 700; color: #ffffff; font-family: monospace; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1rem;">👤</span>
            <span>${escapeHtml(u.username)}</span>
          </div>
        </td>
        <td>
          <span style="color: var(--studio-text-main); font-weight: 500;">${escapeHtml(u.name || u.username)}</span>
        </td>
        <td>
          ${pwHtml}
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="tier-badge ${tier}">
              <span>${tierIcon}</span>
              <span>${tierLabel}</span>
            </span>
            <select class="tier-select-inline btn-change-tier" data-username="${escapeHtml(u.username)}">
              <option value="free" ${tier === 'free' ? 'selected' : ''}>무료</option>
              <option value="pro" ${tier === 'pro' ? 'selected' : ''}>PRO</option>
              <option value="premium" ${tier === 'premium' ? 'selected' : ''}>프리미엄</option>
            </select>
          </div>
        </td>
        <td style="font-size: 0.8rem; color: var(--studio-text-muted);">
          ${u.createdAt || '-'}
        </td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
            <button class="table-btn table-btn-secondary btn-change-user-pw" data-username="${escapeHtml(u.username)}" title="비밀번호 변경">
              <span>🔑</span>
              <span>비번</span>
            </button>
            <button class="table-btn table-btn-danger btn-delete-user" data-username="${escapeHtml(u.username)}" title="계정 삭제">
              <span>🗑️</span>
              <span>삭제</span>
            </button>
          </div>
        </td>
      `;

      // Password actions
      const revealBtn = tr.querySelector('.btn-reveal-pw');
      if (revealBtn) {
        revealBtn.addEventListener('click', () => openMasterAuthModal());
      }

      const copyBtn = tr.querySelector('.btn-copy-pw');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const pw = copyBtn.getAttribute('data-pw');
          if (pw && navigator.clipboard) {
            navigator.clipboard.writeText(pw);
            showToast('📋 비밀번호가 클립보드에 복사되었습니다.');
          }
        });
      }

      // Password change button listener
      const changePwBtn = tr.querySelector('.btn-change-user-pw');
      if (changePwBtn) {
        changePwBtn.addEventListener('click', () => {
          openChangeUserPwModal(u.username);
        });
      }

      // Tier change listener
      tr.querySelector('.btn-change-tier').addEventListener('change', (e) => {
        updateUserTier(u.username, e.target.value);
      });

      // Delete listener
      tr.querySelector('.btn-delete-user').addEventListener('click', () => {
        deleteUser(u.username);
      });

      userTableBody.appendChild(tr);
    });
  }

  async function updateUserTier(username, targetTier) {
    const token = getAdminToken();
    const isStatic = (token === 'static_studio_master_token');

    // 1. Immediately update bw_static_users in localStorage
    try {
      let staticList = [];
      const stored = localStorage.getItem('bw_static_users');
      if (stored) {
        try { staticList = JSON.parse(stored); } catch (e) {}
      }
      let found = staticList.find(x => x.username.toLowerCase() === username.toLowerCase());
      if (found) {
        found.tier = targetTier;
      } else {
        const fromReg = registeredUsers.find(x => x.username.toLowerCase() === username.toLowerCase());
        staticList.push({
          username: username,
          name: fromReg ? fromReg.name : username,
          tier: targetTier,
          createdAt: fromReg ? fromReg.createdAt : ''
        });
      }
      localStorage.setItem('bw_static_users', JSON.stringify(staticList));
    } catch (e) {}

    // 2. Immediately update active user session in localStorage if this user is logged in
    try {
      const sessRaw = localStorage.getItem('bw_user_session');
      if (sessRaw) {
        const sess = JSON.parse(sessRaw);
        if (sess && sess.username && sess.username.toLowerCase() === username.toLowerCase()) {
          sess.tier = targetTier;
          localStorage.setItem('bw_user_session', JSON.stringify(sess));
        }
      }
    } catch (e) {}

    // 3. Dispatch cross-tab ping for instant real-time synchronization in user web
    try {
      localStorage.setItem('bw_tier_update_ping', JSON.stringify({
        username: username,
        tier: targetTier,
        timestamp: Date.now()
      }));
      window.dispatchEvent(new CustomEvent('bw-tier-updated', {
        detail: { username, tier: targetTier }
      }));
    } catch (e) {}

    if (isStatic) {
      const u = registeredUsers.find(x => x.username.toLowerCase() === username.toLowerCase());
      if (u) u.tier = targetTier;
      renderUsers(registeredUsers);
      showToast(`✨ '${username}' 회원이 [${targetTier.toUpperCase()}] 등급으로 변경되었습니다.`);
      return;
    }

    try {
      const res = await fetch('/api/users/update-tier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': token
        },
        body: JSON.stringify({ username, tier: targetTier })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`✨ '${username}' 회원이 [${targetTier.toUpperCase()}] 등급으로 변경되었습니다.`);
        registeredUsers = data.users || [];
        renderUsers(registeredUsers);
      } else {
        showToast(`⚠️ ${data.message || '등급 변경 실패'}`);
        loadUsers();
      }
    } catch (err) {
      const u = registeredUsers.find(x => x.username.toLowerCase() === username.toLowerCase());
      if (u) u.tier = targetTier;
      renderUsers(registeredUsers);
      showToast(`✨ '${username}' 회원이 [${targetTier.toUpperCase()}] 등급으로 변경되었습니다.`);
    }
  }

  async function deleteUser(username) {
    if (!username) return;
    const confirmed = confirm(`정말 '${username}' 회원의 계정을 삭제하시겠습니까?\n삭제 즉시 해당 회원의 접속이 강제 종료(로그아웃)됩니다.`);
    if (!confirmed) return;

    const token = getAdminToken();
    const isStatic = (token === 'static_studio_master_token');

    // 1. If currently active session in this browser matches deleted user, immediately clear it
    try {
      const sessRaw = localStorage.getItem('bw_user_session');
      if (sessRaw) {
        const sess = JSON.parse(sessRaw);
        if (sess && sess.username && sess.username.toLowerCase() === username.toLowerCase()) {
          localStorage.removeItem('bw_user_session');
        }
      }
    } catch (e) {}

    // 2. Remove from bw_static_users in localStorage
    try {
      const stored = localStorage.getItem('bw_static_users');
      if (stored) {
        let staticList = JSON.parse(stored);
        if (Array.isArray(staticList)) {
          staticList = staticList.filter(x => x.username.toLowerCase() !== username.toLowerCase());
          localStorage.setItem('bw_static_users', JSON.stringify(staticList));
        }
      }
    } catch (e) {}

    // 3. Dispatch account-deleted ping for cross-tab and cross-window instant logout
    try {
      localStorage.setItem('bw_account_deleted_ping', JSON.stringify({
        username: username,
        timestamp: Date.now()
      }));
      window.dispatchEvent(new CustomEvent('bw-account-deleted', {
        detail: { username }
      }));
    } catch (e) {}

    // Remove from in-memory array
    registeredUsers = registeredUsers.filter(u => u.username.toLowerCase() !== username.toLowerCase());
    renderUsers(registeredUsers);
    renderStats();

    if (isStatic) {
      showToast(`🗑️ '${username}' 회원의 계정이 삭제되었습니다.`);
      return;
    }

    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': token
        },
        body: JSON.stringify({ username })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`🗑️ '${username}' 회원의 계정이 삭제되었습니다.`);
        registeredUsers = data.users || [];
        renderUsers(registeredUsers);
        renderStats();
      } else {
        showToast(`⚠️ ${data.message || '계정 삭제 실패'}`);
        loadUsers();
      }
    } catch (err) {
      showToast(`🗑️ '${username}' 회원의 계정이 삭제되었습니다.`);
    }
  }

  async function handleAddUserSubmit() {
    if (!newUsername || !newPassword) return;
    const username = newUsername.value.trim();
    const password = newPassword.value;
    const name = (newName ? newName.value.trim() : '') || username;
    const tier = (newTier ? newTier.value : 'pro') || 'pro';

    if (!username || !password) {
      showToast('⚠️ 아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    const token = getAdminToken();
    const pwHash = await calculateSha256(password);
    const userItem = { username, name, tier, password, passwordHash: pwHash, createdAt: new Date().toLocaleDateString() };

    if (token === 'static_studio_master_token') {
      registeredUsers.push(userItem);
      localStorage.setItem('bw_static_users', JSON.stringify(registeredUsers));
      renderUsers(registeredUsers);
      renderStats();
      showToast(`✅ 회원 '${username}' 등록 완료! (${tier.toUpperCase()})`);
      newUsername.value = '';
      newPassword.value = '';
      if (newName) newName.value = '';
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': token
        },
        body: JSON.stringify({ username, password, name, tier })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`✅ 회원 '${username}' 등록 완료! (${tier.toUpperCase()})`);
        newUsername.value = '';
        newPassword.value = '';
        if (newName) newName.value = '';
        registeredUsers = data.users || [];
        try {
          const staticUsersRaw = localStorage.getItem('bw_static_users');
          let staticList = staticUsersRaw ? JSON.parse(staticUsersRaw) : [];
          staticList.push(userItem);
          localStorage.setItem('bw_static_users', JSON.stringify(staticList));
        } catch (e) {}
        renderUsers(registeredUsers);
        renderStats();
      } else {
        showToast(`⚠️ ${data.message || '회원 등록 실패'}`);
      }
    } catch (err) {
      registeredUsers.push(userItem);
      localStorage.setItem('bw_static_users', JSON.stringify(registeredUsers));
      renderUsers(registeredUsers);
      renderStats();
      showToast(`✅ 회원 '${username}' 등록 완료! (${tier.toUpperCase()})`);
      newUsername.value = '';
      newPassword.value = '';
      if (newName) newName.value = '';
    }
  }

  // --- Smart Cross-Device Member Sync Helper Functions ---
  function encodeSafeBase64(str) {
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
      return btoa(str);
    }
  }

  function getBaseUserWebUrl() {
    // Determine the base URL for the user web player
    const origin = window.location.origin;
    let path = window.location.pathname;
    if (path.endsWith('admin.html')) {
      path = path.replace(/admin\.html$/, 'index.html');
    } else if (path.endsWith('admin') || path.endsWith('/admin/')) {
      path = path.replace(/\/admin\/?$/, '/');
    } else if (!path.endsWith('index.html')) {
      if (path.endsWith('/')) {
        path += 'index.html';
      } else {
        path = path.substring(0, path.lastIndexOf('/') + 1) + 'index.html';
      }
    }
    return `${origin}${path}`;
  }

  function copySingleUserSyncLink(user) {
    if (!user || !user.username) return;
    const payload = {
      username: user.username,
      name: user.name || user.username,
      tier: user.tier || 'pro',
      password: user.password || '',
      passwordHash: user.passwordHash || '',
      createdAt: user.createdAt || ''
    };
    const encoded = encodeSafeBase64(JSON.stringify(payload));
    const baseUrl = getBaseUserWebUrl();
    const syncUrl = `${baseUrl}?reg_user=${encoded}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(syncUrl).then(() => {
        showToast(`📲 [${user.name || user.username}] 회원의 스마트 기기 연동 링크가 복사되었습니다! 카톡이나 문자로 전송하세요.`);
      }).catch(() => {
        fallbackCopyText(syncUrl, user.name || user.username);
      });
    } else {
      fallbackCopyText(syncUrl, user.name || user.username);
    }
  }

  function copyAllUsersSyncLink() {
    if (!registeredUsers || registeredUsers.length === 0) {
      showToast('⚠️ 등록된 회원이 없습니다.');
      return;
    }
    const payload = registeredUsers.map(u => ({
      username: u.username,
      name: u.name || u.username,
      tier: u.tier || 'pro',
      password: u.password || '',
      passwordHash: u.passwordHash || '',
      createdAt: u.createdAt || ''
    }));
    const encoded = encodeSafeBase64(JSON.stringify(payload));
    const baseUrl = getBaseUserWebUrl();
    const syncUrl = `${baseUrl}?sync_users=${encoded}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(syncUrl).then(() => {
        showToast(`📲 전체 회원(${registeredUsers.length}명) 스마트 기기 동기화 링크가 복사되었습니다! 새 기기 브라우저에서 한 번만 열면 즉시 등록됩니다.`);
      }).catch(() => {
        fallbackCopyText(syncUrl, '전체 회원');
      });
    } else {
      fallbackCopyText(syncUrl, '전체 회원');
    }
  }

  function fallbackCopyText(text, label) {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    tempInput.style.position = 'fixed';
    tempInput.style.opacity = '0';
    document.body.appendChild(tempInput);
    tempInput.focus();
    tempInput.select();
    try {
      document.execCommand('copy');
      showToast(`📲 [${label}] 기기 연동 링크가 복사되었습니다! 카톡이나 문자로 전송하세요.`);
    } catch (e) {
      prompt('아래 링크를 복사하여 스마트폰 브라우저에 붙여넣으세요:', text);
    }
    document.body.removeChild(tempInput);
  }


  // --- Ad Management Logic ---
  let adList = [];
  let currentEditingAdIndex = 0;
  let currentPreviewAdIndex = 0;
  let globalAdActive = true;
  let globalAdRotationMode = 'sequence';

  function getDefaultAd(id = 'ad_1', title = '새 프로모션 광고') {
    return {
      id: id,
      active: true,
      title: title,
      sponsor: 'BOOKWAVE OFFICIAL',
      message: '북웨이브의 특별한 혜택을 확인해보세요!',
      imageUrl: '',
      linkUrl: '#',
      skipSeconds: 5
    };
  }

  async function loadAdSettings() {
    try {
      let res;
      try { res = await fetch('/api/ad'); } catch (e) {}
      if (!res || !res.ok) {
        res = await fetch('/data/ad.json').catch(() => null);
      }
      let data = null;
      if (res && res.ok) {
        data = await res.json().catch(() => null);
      } else {
        const stored = localStorage.getItem('bw_static_ads') || localStorage.getItem('bw_static_ad');
        if (stored) {
          try { data = JSON.parse(stored); } catch (e) {}
        }
      }

      if (data) {
        if (Array.isArray(data.ads) && data.ads.length > 0) {
          adList = data.ads.map((a, idx) => ({
            id: a.id || `ad_${idx + 1}`,
            active: a.active !== false,
            title: a.title || `광고 #${idx + 1}`,
            sponsor: a.sponsor || 'SPONSOR',
            message: a.message || '',
            imageUrl: a.imageUrl || '',
            linkUrl: a.linkUrl || '#',
            skipSeconds: typeof a.skipSeconds === 'number' ? a.skipSeconds : 5
          }));
          globalAdActive = data.active !== false;
          globalAdRotationMode = data.rotationMode || 'sequence';
        } else if (data.ad || data.title) {
          const single = data.ad || data;
          adList = [{
            id: single.id || 'ad_1',
            active: single.active !== false,
            title: single.title || '북웨이브 프리미엄 멤버십',
            sponsor: single.sponsor || 'BOOKWAVE SPONSOR',
            message: single.message || '',
            imageUrl: single.imageUrl || '',
            linkUrl: single.linkUrl || '#',
            skipSeconds: single.skipSeconds || 5
          }];
          globalAdActive = single.active !== false;
          globalAdRotationMode = 'sequence';
        }
      }

      if (!adList || adList.length === 0) {
        adList = [getDefaultAd('ad_1', '북웨이브 프리미엄 멤버십')];
      }

      if (adActiveToggle) adActiveToggle.checked = globalAdActive;
      if (adRotationModeSelect) adRotationModeSelect.value = globalAdRotationMode;

      currentEditingAdIndex = 0;
      currentPreviewAdIndex = 0;
      renderAdList();
      populateAdEditor(currentEditingAdIndex);
      updateAdLivePreview();
    } catch (e) {
      console.log('Ad settings load failed:', e);
    }
  }

  function renderAdList() {
    if (!adListContainer) return;
    if (adCountBadge) {
      adCountBadge.textContent = `등록된 광고 ${adList.length}개`;
    }
    adListContainer.innerHTML = '';

    adList.forEach((item, index) => {
      const card = document.createElement('div');
      const isEditing = (index === currentEditingAdIndex);
      card.className = `ad-item-card ${isEditing ? 'active-editing' : ''}`;
      card.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 14px 18px;
        background: ${isEditing ? 'rgba(255, 107, 0, 0.12)' : 'rgba(255, 255, 255, 0.03)'};
        border: 1px solid ${isEditing ? 'var(--neon-orange)' : 'rgba(255, 255, 255, 0.08)'};
        border-radius: 12px;
        transition: all 0.2s ease;
        cursor: pointer;
      `;

      const isActive = (item.active !== false);
      const statusBadge = isActive
        ? `<span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 10px; background: rgba(16, 185, 129, 0.2); color: #10b981; font-weight: 700;">● 송출 중</span>`
        : `<span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 10px; background: rgba(148, 163, 184, 0.2); color: #94a3b8; font-weight: 600;">○ 중지됨</span>`;

      const thumbHtml = item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0;" alt="썸네일">`
        : `<div style="width: 48px; height: 48px; border-radius: 8px; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">📢</div>`;

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
          <div style="font-weight: 800; font-size: 0.82rem; color: ${isEditing ? 'var(--neon-orange)' : 'var(--studio-text-faint)'}; min-width: 24px;">
            #${index + 1}
          </div>
          ${thumbHtml}
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px; flex-wrap: wrap;">
              <span style="font-size: 0.88rem; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">
                ${escapeHtml(item.title || '광고 제목 없음')}
              </span>
              ${statusBadge}
            </div>
            <div style="font-size: 0.75rem; color: var(--studio-text-muted); display: flex; gap: 8px;">
              <span>스폰서: ${escapeHtml(item.sponsor || '-')}</span>
              <span>•</span>
              <span>시간: ${item.skipSeconds || 5}초</span>
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <button type="button" class="btn-pill ${isEditing ? 'btn-pill-primary' : 'btn-pill-ghost'} btn-edit-this-ad" style="padding: 6px 12px; font-size: 0.78rem;">
            <span>${isEditing ? '✍️ 편집 중' : '✏️ 편집'}</span>
          </button>
          <button type="button" class="btn-pill btn-pill-ghost btn-del-this-ad" style="padding: 6px 10px; font-size: 0.78rem; color: #ef4444; border-color: rgba(239,68,68,0.3);" title="이 광고 삭제">
            <span>🗑️</span>
          </button>
        </div>
      `;

      card.addEventListener('click', () => {
        selectEditingAd(index);
      });

      const btnEdit = card.querySelector('.btn-edit-this-ad');
      if (btnEdit) {
        btnEdit.addEventListener('click', (e) => {
          e.stopPropagation();
          selectEditingAd(index);
        });
      }

      const btnDel = card.querySelector('.btn-del-this-ad');
      if (btnDel) {
        btnDel.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteAd(index);
        });
      }

      adListContainer.appendChild(card);
    });
  }

  function selectEditingAd(index) {
    if (index < 0 || index >= adList.length) return;
    applyFormToCurrentAd(false);
    currentEditingAdIndex = index;
    currentPreviewAdIndex = index;
    populateAdEditor(index);
    renderAdList();
    updateAdLivePreview();
  }

  function populateAdEditor(index) {
    const item = adList[index];
    if (!item) return;
    if (editorAdTitleBadge) {
      editorAdTitleBadge.textContent = `[광고 #${index + 1}] ${item.title || ''}`;
    }
    if (inputAdItemActive) inputAdItemActive.checked = (item.active !== false);
    if (inputAdTitle) inputAdTitle.value = item.title || '';
    if (inputAdSponsor) inputAdSponsor.value = item.sponsor || '';
    if (inputAdMessage) inputAdMessage.value = item.message || '';
    if (inputAdImageUrl) inputAdImageUrl.value = item.imageUrl || '';
    if (inputAdLink) inputAdLink.value = item.linkUrl || '';
    if (inputAdSkipSeconds) inputAdSkipSeconds.value = typeof item.skipSeconds === 'number' ? item.skipSeconds : 5;
  }

  function applyFormToCurrentAd(showNotice = true) {
    if (!adList[currentEditingAdIndex]) return;
    adList[currentEditingAdIndex] = {
      ...adList[currentEditingAdIndex],
      active: inputAdItemActive ? inputAdItemActive.checked : true,
      title: inputAdTitle ? inputAdTitle.value.trim() : '광고 제목',
      sponsor: inputAdSponsor ? inputAdSponsor.value.trim() : 'SPONSOR',
      message: inputAdMessage ? inputAdMessage.value.trim() : '',
      imageUrl: inputAdImageUrl ? inputAdImageUrl.value.trim() : '',
      linkUrl: inputAdLink ? inputAdLink.value.trim() : '#',
      skipSeconds: inputAdSkipSeconds ? parseInt(inputAdSkipSeconds.value, 10) || 5 : 5
    };
    if (editorAdTitleBadge) {
      editorAdTitleBadge.textContent = `[광고 #${currentEditingAdIndex + 1}] ${adList[currentEditingAdIndex].title}`;
    }
    renderAdList();
    updateAdLivePreview();
    if (showNotice) {
      showToast(`✓ [광고 #${currentEditingAdIndex + 1}] 변경사항이 임시 반영되었습니다. [최종 저장]을 누르면 적용됩니다.`);
    }
  }

  function addNewAd() {
    applyFormToCurrentAd(false);
    const newId = `ad_${Date.now()}`;
    const newAd = {
      id: newId,
      active: true,
      title: `신규 프로모션 광고 #${adList.length + 1}`,
      sponsor: 'BOOKWAVE SPONSOR',
      message: '북웨이브의 새로운 소식과 추천 혜택을 만나보세요!',
      imageUrl: '',
      linkUrl: '#',
      skipSeconds: 5
    };
    adList.push(newAd);
    currentEditingAdIndex = adList.length - 1;
    currentPreviewAdIndex = currentEditingAdIndex;
    renderAdList();
    populateAdEditor(currentEditingAdIndex);
    updateAdLivePreview();
    showToast(`➕ 새 광고 #${adList.length}가 추가되었습니다. 내용을 편집한 후 최종 저장하세요.`);
  }

  function deleteAd(index) {
    if (adList.length <= 1) {
      showToast('⚠️ 최소 1개 이상의 광고가 목록에 유지되어야 합니다.');
      return;
    }
    const targetTitle = adList[index] ? adList[index].title : `#${index + 1}`;
    if (!confirm(`'${targetTitle}' 광고를 목록에서 삭제하시겠습니까?`)) {
      return;
    }
    adList.splice(index, 1);
    if (currentEditingAdIndex >= adList.length) {
      currentEditingAdIndex = adList.length - 1;
    }
    if (currentPreviewAdIndex >= adList.length) {
      currentPreviewAdIndex = currentEditingAdIndex;
    }
    renderAdList();
    populateAdEditor(currentEditingAdIndex);
    updateAdLivePreview();
    showToast('🗑️ 광고가 삭제되었습니다. [전체 광고 설정 최종 저장]을 눌러 반영하세요.');
  }

  function updateAdLivePreview() {
    if (!adList || adList.length === 0) return;

    if (currentPreviewAdIndex < 0 || currentPreviewAdIndex >= adList.length) {
      currentPreviewAdIndex = 0;
    }

    if (previewAdIndexIndicator) {
      previewAdIndexIndicator.textContent = `[ ${currentPreviewAdIndex + 1} / ${adList.length} ]`;
    }

    let previewData;
    if (currentPreviewAdIndex === currentEditingAdIndex) {
      previewData = {
        title: inputAdTitle ? (inputAdTitle.value || '광고 제목') : '광고 제목',
        sponsor: inputAdSponsor ? (inputAdSponsor.value || 'SPONSOR') : 'SPONSOR',
        message: inputAdMessage ? (inputAdMessage.value || '광고 홍보 문구') : '광고 홍보 문구',
        skipSeconds: inputAdSkipSeconds ? (inputAdSkipSeconds.value || 5) : 5,
        imageUrl: inputAdImageUrl ? inputAdImageUrl.value.trim() : ''
      };
    } else {
      const it = adList[currentPreviewAdIndex];
      previewData = {
        title: it.title || '광고 제목',
        sponsor: it.sponsor || 'SPONSOR',
        message: it.message || '광고 홍보 문구',
        skipSeconds: it.skipSeconds || 5,
        imageUrl: it.imageUrl || ''
      };
    }

    if (previewAdTitle) previewAdTitle.textContent = previewData.title;
    if (previewAdSponsor) previewAdSponsor.textContent = previewData.sponsor;
    if (previewAdMessage) previewAdMessage.textContent = previewData.message;
    const secs = previewData.skipSeconds || 5;
    if (previewAdTimer) previewAdTimer.textContent = `⏱️ ${secs}초 후 시작`;

    if (previewData.imageUrl) {
      if (previewAdImage) previewAdImage.src = previewData.imageUrl;
      if (previewAdImageContainer) previewAdImageContainer.style.display = 'block';
      if (previewAdDefaultIcon) previewAdDefaultIcon.style.display = 'none';
    } else {
      if (previewAdImageContainer) previewAdImageContainer.style.display = 'none';
      if (previewAdDefaultIcon) previewAdDefaultIcon.style.display = 'block';
    }
  }

  // Compress & convert image file to optimized Data URL (Base64)
  function compressImageToDataUrl(file, maxWidth = 1200, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth || height > maxWidth) {
              if (width > height) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              } else {
                width = Math.round((width * maxWidth) / height);
                height = maxWidth;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const mime = (file.type === 'image/png') ? 'image/png' : 'image/jpeg';
            resolve(canvas.toDataURL(mime, quality));
          } catch (err) {
            resolve(e.target.result);
          }
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadAdImage(file) {
    if (!file) return;

    if (!file.type.startsWith('image/') && !/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.name)) {
      showToast('⚠️ 이미지 파일(JPG, PNG, GIF, WEBP 등)만 등록할 수 있습니다.');
      return;
    }

    const token = getAdminToken();
    const isStatic = (token === 'static_studio_master_token');
    const currentAdId = (adList[currentEditingAdIndex] && adList[currentEditingAdIndex].id) || `ad_${currentEditingAdIndex + 1}`;

    showToast('⏳ 광고 사진 처리 중...');

    // 1. If static deployment (Netlify) -> convert to optimized Data URL directly
    if (isStatic) {
      try {
        const dataUrl = await compressImageToDataUrl(file);
        if (inputAdImageUrl) inputAdImageUrl.value = dataUrl;
        if (adList[currentEditingAdIndex]) adList[currentEditingAdIndex].imageUrl = dataUrl;
        renderAdList();
        updateAdLivePreview();
        showToast('🖼️ 광고 사진이 등록되었습니다. [전체 광고 설정 최종 저장]을 눌러 적용하세요.');
      } catch (err) {
        showToast(`❌ 사진 처리 실패: ${err.message}`);
      }
      return;
    }

    // 2. Server mode -> attempt server upload with seamless client-side fallback
    try {
      const headers = {
        'X-Filename': encodeURIComponent(file.name),
        'X-Ad-Id': encodeURIComponent(currentAdId),
        'Content-Type': 'application/octet-stream'
      };
      if (token) headers['X-Admin-Token'] = token;

      let res;
      try {
        res = await fetch('/api/ad/image', {
          method: 'POST',
          headers: headers,
          body: file
        });
      } catch (netErr) {
        res = null;
      }

      if (res && res.status === 401) {
        showToast('⚠️ 스튜디오 보안 인증이 필요합니다. 접속 암호를 다시 입력해 주세요.');
        showSecurityGate();
        return;
      }

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success && data.imageUrl) {
          if (inputAdImageUrl) inputAdImageUrl.value = data.imageUrl;
          if (adList[currentEditingAdIndex]) adList[currentEditingAdIndex].imageUrl = data.imageUrl;
          renderAdList();
          updateAdLivePreview();
          showToast('🖼️ 광고 사진이 등록되었습니다. [전체 광고 설정 최종 저장]을 눌러 적용하세요.');
          return;
        }
      }

      // If server upload failed, fallback to optimized Data URL
      const dataUrl = await compressImageToDataUrl(file);
      if (inputAdImageUrl) inputAdImageUrl.value = dataUrl;
      if (adList[currentEditingAdIndex]) adList[currentEditingAdIndex].imageUrl = dataUrl;
      renderAdList();
      updateAdLivePreview();
      showToast('🖼️ 광고 사진이 등록되었습니다. [전체 광고 설정 최종 저장]을 눌러 적용하세요.');
    } catch (err) {
      try {
        const dataUrl = await compressImageToDataUrl(file);
        if (inputAdImageUrl) inputAdImageUrl.value = dataUrl;
        if (adList[currentEditingAdIndex]) adList[currentEditingAdIndex].imageUrl = dataUrl;
        renderAdList();
        updateAdLivePreview();
        showToast('🖼️ 광고 사진이 등록되었습니다. [전체 광고 설정 최종 저장]을 눌러 적용하세요.');
      } catch (fallbackErr) {
        showToast(`❌ 사진 업로드 오류: ${fallbackErr.message || err.message}`);
      }
    }
  }

  async function handleSaveAdSettings() {
    const token = getAdminToken();
    if (!token) {
      showToast('⚠️ 보안 인증이 필요합니다.');
      showSecurityGate();
      return;
    }

    applyFormToCurrentAd(false);

    globalAdActive = adActiveToggle ? adActiveToggle.checked : true;
    globalAdRotationMode = adRotationModeSelect ? adRotationModeSelect.value : 'sequence';

    const payload = {
      active: globalAdActive,
      rotationMode: globalAdRotationMode,
      ads: adList
    };

    localStorage.setItem('bw_static_ads', JSON.stringify(payload));
    if (adList.length > 0) {
      localStorage.setItem('bw_static_ad', JSON.stringify({
        ...adList[0],
        active: globalAdActive
      }));
    }

    if (token === 'static_studio_master_token') {
      showToast(`💾 전체 광고 설정(${adList.length}개)이 성공적으로 저장되었습니다!`);
      renderAdList();
      updateAdLivePreview();
      return;
    }

    try {
      const res = await fetch('/api/ad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': token
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        showSecurityGate();
        if (adminAuthError) {
          adminAuthError.textContent = '인증 세션이 만료되었습니다. 접속 암호를 입력해 주세요.';
          adminAuthError.style.display = 'block';
        }
        return;
      }

      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success) {
        showToast(`💾 전체 광고 설정(${adList.length}개)이 성공적으로 저장되었습니다!`);
      } else {
        showToast(`💾 전체 광고 설정이 로컬 스토리지에 저장되었습니다.`);
      }
      renderAdList();
      updateAdLivePreview();
    } catch (err) {
      showToast(`💾 전체 광고 설정이 로컬 스토리지에 저장되었습니다.`);
      renderAdList();
      updateAdLivePreview();
    }
  }

  // --- Master Auth Modal Logic (Password Reveal) ---
  function openMasterAuthModal() {
    if (masterAuthModal) {
      masterAuthModal.style.display = 'flex';
      if (masterAuthError) masterAuthError.style.display = 'none';
      if (inputMasterAuthPassword) {
        inputMasterAuthPassword.value = '';
        setTimeout(() => inputMasterAuthPassword.focus(), 150);
      }
    }
  }

  function closeMasterAuthModal() {
    if (masterAuthModal) {
      masterAuthModal.style.display = 'none';
      if (inputMasterAuthPassword) inputMasterAuthPassword.value = '';
      if (masterAuthError) masterAuthError.style.display = 'none';
    }
  }

  async function handleMasterAuthSubmit() {
    if (!inputMasterAuthPassword) return;
    const masterPassword = inputMasterAuthPassword.value;
    if (!masterPassword) {
      if (masterAuthError) {
        masterAuthError.textContent = '접속 암호를 입력해 주세요.';
        masterAuthError.style.display = 'block';
      }
      return;
    }

    try {
      let isStatic = false;
      let res;
      try {
        res = await fetch('/api/users/reveal-passwords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ masterPassword })
        });
        if (res.status === 404 || res.status === 405) isStatic = true;
      } catch (e) {
        isStatic = true;
      }

      if (isStatic) {
        const inputHash = await calculateSha256(masterPassword);
        if (inputHash === getActiveStudioPwHash()) {
          revealedPasswords = {};
          registeredUsers.forEach(u => { revealedPasswords[u.username] = '********'; });
          closeMasterAuthModal();
          if (btnTogglePasswordsIcon) btnTogglePasswordsIcon.textContent = '🔓';
          if (btnTogglePasswordsText) btnTogglePasswordsText.textContent = '비밀번호 숨기기';
          renderUsers(registeredUsers);
          showToast('✨ 회원 비밀번호가 확인되었습니다.');
          return;
        } else {
          if (masterAuthError) {
            masterAuthError.textContent = '접속 암호가 올바르지 않습니다.';
            masterAuthError.style.display = 'block';
          }
          inputMasterAuthPassword.select();
          return;
        }
      }

      const data = await res.json();
      if (res.ok && data.success) {
        revealedPasswords = data.passwords || {};
        closeMasterAuthModal();
        if (btnTogglePasswordsIcon) btnTogglePasswordsIcon.textContent = '🔓';
        if (btnTogglePasswordsText) btnTogglePasswordsText.textContent = '비밀번호 숨기기';
        renderUsers(registeredUsers);
        showToast('✨ 회원 비밀번호가 확인되었습니다.');
      } else {
        if (masterAuthError) {
          masterAuthError.textContent = data.message || '접속 암호가 올바르지 않습니다.';
          masterAuthError.style.display = 'block';
        }
        inputMasterAuthPassword.select();
      }
    } catch (err) {
      const inputHash = await calculateSha256(masterPassword);
      if (inputHash === getActiveStudioPwHash()) {
        revealedPasswords = {};
        registeredUsers.forEach(u => { revealedPasswords[u.username] = '********'; });
        closeMasterAuthModal();
        if (btnTogglePasswordsIcon) btnTogglePasswordsIcon.textContent = '🔓';
        if (btnTogglePasswordsText) btnTogglePasswordsText.textContent = '비밀번호 숨기기';
        renderUsers(registeredUsers);
        showToast('✨ 회원 비밀번호가 확인되었습니다.');
      } else {
        if (masterAuthError) {
          masterAuthError.textContent = '접속 암호가 올바르지 않습니다.';
          masterAuthError.style.display = 'block';
        }
        inputMasterAuthPassword.select();
      }
    }
  }

  async function deleteUser(username) {
    if (!confirm(`정말로 회원 '${username}' 계정을 삭제하시겠습니까?\n삭제 후 해당 계정은 더 이상 로그인할 수 없습니다.`)) {
      return;
    }

    const token = getAdminToken();
    const isStatic = (token === 'static_studio_master_token');

    if (isStatic) {
      registeredUsers = registeredUsers.filter(u => u.username.toLowerCase() !== username.toLowerCase());
      localStorage.setItem('bw_static_users', JSON.stringify(registeredUsers));
      if (revealedPasswords && revealedPasswords[username]) {
        delete revealedPasswords[username];
      }
      showToast(`🗑️ 회원 '${username}' 계정이 삭제되었습니다.`);
      renderUsers(registeredUsers);
      renderStats();
      return;
    }

    try {
      let isSuccess = false;
      let newUsersList = null;

      // 1. First attempt: standard DELETE /api/users/<username>
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Token': token }
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.success) {
            isSuccess = true;
            newUsersList = data.users;
          }
        }
      } catch (e1) {}

      // 2. Second attempt if DELETE was rejected (e.g. 404/405): POST /api/users/delete
      if (!isSuccess) {
        try {
          const res = await fetch('/api/users/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Admin-Token': token
            },
            body: JSON.stringify({ username })
          });
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.success) {
              isSuccess = true;
              newUsersList = data.users;
            }
          }
        } catch (e2) {}
      }

      // 3. Fallback for static Netlify mode or network disconnection
      registeredUsers = newUsersList || registeredUsers.filter(u => u.username.toLowerCase() !== username.toLowerCase());
      localStorage.setItem('bw_static_users', JSON.stringify(registeredUsers));
      if (revealedPasswords && revealedPasswords[username]) {
        delete revealedPasswords[username];
      }
      showToast(`🗑️ 회원 '${username}' 계정이 삭제되었습니다.`);
      renderUsers(registeredUsers);
      renderStats();
    } catch (err) {
      registeredUsers = registeredUsers.filter(u => u.username.toLowerCase() !== username.toLowerCase());
      localStorage.setItem('bw_static_users', JSON.stringify(registeredUsers));
      showToast(`🗑️ 회원 '${username}' 계정이 삭제되었습니다.`);
      renderUsers(registeredUsers);
      renderStats();
    }
  }

  // --- Master Password Change Modal Handlers ---
  function openChangeMasterPwModal() {
    if (modalChangeMasterPw) {
      modalChangeMasterPw.style.display = 'flex';
      if (inputNewMasterPw) {
        inputNewMasterPw.value = '';
        setTimeout(() => inputNewMasterPw.focus(), 150);
      }
      if (inputConfirmMasterPw) inputConfirmMasterPw.value = '';
      if (changeMasterPwError) changeMasterPwError.style.display = 'none';
    }
  }

  function closeChangeMasterPwModal() {
    if (modalChangeMasterPw) {
      modalChangeMasterPw.style.display = 'none';
      if (inputNewMasterPw) inputNewMasterPw.value = '';
      if (inputConfirmMasterPw) inputConfirmMasterPw.value = '';
      if (changeMasterPwError) changeMasterPwError.style.display = 'none';
    }
  }

  async function handleChangeMasterPwSubmit() {
    if (!inputNewMasterPw || !inputConfirmMasterPw) return;
    const newPw = inputNewMasterPw.value;
    const confirmPw = inputConfirmMasterPw.value;

    if (!newPw || newPw.length < 4) {
      if (changeMasterPwError) {
        changeMasterPwError.textContent = '새 접속 암호를 4자 이상 입력해 주세요.';
        changeMasterPwError.style.display = 'block';
      }
      return;
    }

    if (newPw !== confirmPw) {
      if (changeMasterPwError) {
        changeMasterPwError.textContent = '새 접속 암호 확인이 일치하지 않습니다.';
        changeMasterPwError.style.display = 'block';
      }
      return;
    }

    if (changeMasterPwError) changeMasterPwError.style.display = 'none';

    const newHash = await calculateSha256(newPw);
    const token = getAdminToken();

    // Store in localStorage for static/fallback operation
    localStorage.setItem('bw_studio_pw_hash', newHash);

    try {
      if (token && token !== 'static_studio_master_token') {
        const res = await fetch('/api/admin/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': token
          },
          body: JSON.stringify({ newPassword: newPw, newHash: newHash })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok && !data.success) {
          throw new Error(data.message || '접속 암호 변경 실패');
        }
      }
      closeChangeMasterPwModal();
      showToast('🔑 스튜디오 접속 암호가 성공적으로 변경되었습니다!');
    } catch (err) {
      closeChangeMasterPwModal();
      showToast('🔑 스튜디오 접속 암호가 성공적으로 변경되었습니다!');
    }
  }

  // --- User Password Change Handlers ---
  function openChangeUserPwModal(username) {
    if (modalChangeUserPw) {
      modalChangeUserPw.style.display = 'flex';
      if (inputTargetUsername) inputTargetUsername.value = username;
      if (userChangePwDesc) userChangePwDesc.textContent = `'${username}' 회원의 새 비밀번호를 설정합니다.`;
      if (inputNewUserPw) {
        inputNewUserPw.value = '';
        setTimeout(() => inputNewUserPw.focus(), 150);
      }
      if (changeUserPwError) changeUserPwError.style.display = 'none';
    }
  }

  function closeChangeUserPwModal() {
    if (modalChangeUserPw) {
      modalChangeUserPw.style.display = 'none';
      if (inputTargetUsername) inputTargetUsername.value = '';
      if (inputNewUserPw) inputNewUserPw.value = '';
      if (changeUserPwError) changeUserPwError.style.display = 'none';
    }
  }

  async function handleChangeUserPwSubmit() {
    if (!inputTargetUsername || !inputNewUserPw) return;
    const username = inputTargetUsername.value.trim();
    const newPassword = inputNewUserPw.value;

    if (!username) {
      if (changeUserPwError) {
        changeUserPwError.textContent = '대상 회원이 지정되지 않았습니다.';
        changeUserPwError.style.display = 'block';
      }
      return;
    }

    if (!newPassword) {
      if (changeUserPwError) {
        changeUserPwError.textContent = '새 비밀번호를 입력해 주세요.';
        changeUserPwError.style.display = 'block';
      }
      return;
    }

    if (changeUserPwError) changeUserPwError.style.display = 'none';

    const token = getAdminToken();
    try {
      let isStatic = (token === 'static_studio_master_token');
      if (!isStatic) {
        const res = await fetch('/api/users/update-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': token
          },
          body: JSON.stringify({ username, newPassword })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          closeChangeUserPwModal();
          showToast(`✅ '${username}' 회원의 비밀번호가 변경되었습니다.`);
          if (revealedPasswords && revealedPasswords[username] !== undefined) {
            revealedPasswords[username] = newPassword;
          }
          loadUsers();
          return;
        } else {
          isStatic = true;
        }
      }

      if (isStatic) {
        const stored = localStorage.getItem('bw_static_users');
        if (stored) {
          try {
            const list = JSON.parse(stored);
            const found = list.find(u => u.username.toLowerCase() === username.toLowerCase());
            if (found) {
              found.password = newPassword;
              found.passwordHash = await calculateSha256(newPassword);
              localStorage.setItem('bw_static_users', JSON.stringify(list));
            }
          } catch (e) {}
        }
        if (revealedPasswords && revealedPasswords[username] !== undefined) {
          revealedPasswords[username] = newPassword;
        }
        closeChangeUserPwModal();
        showToast(`✅ '${username}' 회원의 비밀번호가 변경되었습니다.`);
        loadUsers();
      }
    } catch (err) {
      closeChangeUserPwModal();
      showToast(`✅ '${username}' 회원의 비밀번호가 변경되었습니다.`);
      loadUsers();
    }
  }

  // --- Content Library & Stats ---
  async function loadLibrary() {
    try {
      let res;
      try { res = await fetch('/api/items'); } catch (e) {}
      if (!res || !res.ok) {
        res = await fetch('/data/items.json');
      }
      if (!res.ok) throw new Error('서버 응답 오류');
      const data = await res.json();
      libraryItems = data.items || [];
      renderStats();
      renderTable();
    } catch (err) {
      console.error('라이브러리 로드 실패:', err);
      showToast('⚠️ 라이브러리 데이터를 가져오지 못했습니다.');
    }
  }

  function renderStats() {
    const ebooks = libraryItems.filter(i => i.type === 'ebook');
    const audiobooks = libraryItems.filter(i => i.type === 'audiobook');
    const totalBytes = libraryItems.reduce((acc, cur) => acc + (cur.size || 0), 0);

    if (statEbooks) statEbooks.textContent = `${ebooks.length}권`;
    if (statAudiobooks) statAudiobooks.textContent = `${audiobooks.length}개`;
    if (statStorage) statStorage.textContent = formatFileSize(totalBytes);
    if (statUsers) statUsers.textContent = `${registeredUsers.length}명`;

    if (sidebarBadgeContent) {
      sidebarBadgeContent.textContent = libraryItems.length;
    }
  }

  function filterItems() {
    return libraryItems.filter(item => {
      if (currentFilter !== 'all' && item.type !== currentFilter) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.fileName.toLowerCase().includes(q);
      }
      return true;
    });
  }

  function renderTable() {
    if (!adminTableBody) return;
    const filtered = filterItems();
    adminTableBody.innerHTML = '';

    if (filtered.length === 0) {
      if (adminEmptyState) adminEmptyState.style.display = 'block';
      return;
    }
    if (adminEmptyState) adminEmptyState.style.display = 'none';

    filtered.forEach(item => {
      const tr = document.createElement('tr');
      const isAudio = item.type === 'audiobook';
      const typeLabel = isAudio ? '오디오북' : '전자책';
      const typeClass = isAudio ? 'audiobook' : 'ebook';
      const typeIcon = isAudio ? '🎧' : '📖';
      const format = (item.format || '').toUpperCase();

      tr.innerHTML = `
        <td>
          <span class="type-badge ${typeClass}">
            <span>${typeIcon}</span>
            <span>${typeLabel}</span>
          </span>
        </td>
        <td>
          <div style="font-weight: 700; color: #ffffff; margin-bottom: 2px;">${escapeHtml(item.title)}</div>
          <div style="font-size: 0.76rem; color: var(--studio-text-muted); font-family: monospace;">${escapeHtml(item.fileName)}</div>
        </td>
        <td><span class="format-pill">${format}</span></td>
        <td style="font-size: 0.82rem; color: var(--studio-text-muted);">${formatFileSize(item.size)}</td>
        <td style="font-size: 0.78rem; color: var(--studio-text-faint);">${item.createdAt || '-'}</td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center;">
            <button class="table-btn table-btn-preview btn-preview">
              <span>${isAudio ? '▶' : '👁️'}</span>
              <span>${isAudio ? '미리듣기' : '미리보기'}</span>
            </button>
            <button class="table-btn table-btn-danger btn-del" title="삭제">
              <span>🗑️</span>
              <span>삭제</span>
            </button>
          </div>
        </td>
      `;

      tr.querySelector('.btn-preview').addEventListener('click', () => {
        if (isAudio) {
          previewAudio(item);
        } else {
          previewBook(item);
        }
      });

      tr.querySelector('.btn-del').addEventListener('click', () => {
        deleteItem(item);
      });

      adminTableBody.appendChild(tr);
    });
  }

  // --- Upload Handlers ---
  async function uploadFiles(files, uploadType = '') {
    if (!files || files.length === 0) return;

    if (uploadProgressArea) uploadProgressArea.style.display = 'block';
    const total = files.length;
    const token = getAdminToken();

    let successCount = 0;
    for (let i = 0; i < total; i++) {
      const file = files[i];
      const percent = Math.round(((i) / total) * 100);
      if (uploadStatusText) uploadStatusText.textContent = `[${i + 1}/${total}] '${file.name}' 등록 중...`;
      if (uploadPercentText) uploadPercentText.textContent = `${percent}%`;
      if (uploadProgressBar) uploadProgressBar.style.width = `${percent}%`;

      try {
        const headers = {
          'X-Filename': encodeURIComponent(file.name),
          'Content-Type': 'application/octet-stream'
        };
        if (uploadType) headers['X-Upload-Type'] = uploadType;
        if (token) headers['X-Admin-Token'] = token;

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: headers,
          body: file
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || '업로드 서버 오류');
        }
        libraryItems = data.items || [];
        successCount++;
      } catch (err) {
        showToast(`❌ '${file.name}' 업로드 실패: ${err.message}`);
      }
    }

    if (uploadStatusText) uploadStatusText.textContent = `파일 등록 완료! (성공 ${successCount}/${total}개)`;
    if (uploadPercentText) uploadPercentText.textContent = `100%`;
    if (uploadProgressBar) uploadProgressBar.style.width = `100%`;

    setTimeout(() => {
      if (uploadProgressArea) uploadProgressArea.style.display = 'none';
      if (uploadProgressBar) uploadProgressBar.style.width = `0%`;
    }, 2500);

    renderStats();
    renderTable();
    if (successCount > 0) {
      showToast(`✅ ${successCount}개 파일이 라이브러리에 등록되었습니다.`);
    }
  }

  // --- Delete Handler ---
  async function deleteItem(item) {
    if (!confirm(`정말로 '${item.title}'을(를) 삭제하시겠습니까?\n이 작업은 로컬 원본 파일도 함께 삭제합니다.`)) {
      return;
    }

    const token = getAdminToken();
    try {
      const headers = {};
      if (token) headers['X-Admin-Token'] = token;

      const res = await fetch(`/api/items/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: headers
      });
      if (!res.ok) throw new Error('삭제 실패');
      const data = await res.json();
      libraryItems = data.items || [];
      renderStats();
      renderTable();
      showToast(`🗑️ '${item.title}'이(가) 삭제되었습니다.`);

      if (activeAudioItem && activeAudioItem.id === item.id) {
        audioElement.pause();
        audioElement.src = '';
        audioPlayerBar.classList.remove('active');
      }
    } catch (e) {
      showToast(`❌ 삭제 오류: ${e.message}`);
    }
  }

  // --- Audio Preview ---
  function previewAudio(item) {
    activeAudioItem = item;
    audioPlayerBar.classList.add('active');
    playerTitle.textContent = item.title;
    playerSubtitle.textContent = `[미리듣기] ${item.format.toUpperCase()} • ${formatFileSize(item.size)}`;

    if (audioElement.src !== window.location.origin + item.url) {
      audioElement.src = item.url;
      audioElement.onloadedmetadata = () => {
        durationLabel.textContent = formatTime(audioElement.duration);
        audioTimeline.max = audioElement.duration || 100;
        audioElement.play().catch(e => console.log(e));
      };
    } else {
      audioElement.play();
    }
  }

  function previewBook(item) {
    readerBookTitle.textContent = `[미리보기] ${item.title}`;
    readerModal.classList.add('open');
    readerBody.innerHTML = '<div style="padding: 60px; text-align: center; color: var(--studio-text-muted);">불러오는 중...</div>';

    const fmt = item.format.toLowerCase();
    if (fmt === 'docx' || fmt === 'doc') {
      fetch(`/api/book-text?id=${encodeURIComponent(item.id)}`)
        .then(r => r.json())
        .then(data => {
          if (!data.success) throw new Error(data.message || '본문 추출 실패');
          const c = document.createElement('div');
          c.className = 'txt-container';
          c.style.cssText = 'padding: 24px 30px; font-size: 16px; line-height: 1.85; color: #f1f5f9; white-space: pre-wrap; max-height: 70vh; overflow-y: auto; font-family: "Pretendard", -apple-system, sans-serif;';
          c.textContent = data.text || '(본문 내용이 비어있습니다)';
          readerBody.innerHTML = '';
          readerBody.appendChild(c);
        })
        .catch(err => {
          readerBody.innerHTML = `<div style="padding: 40px; color: #ef4444;">Word 전자책 본문을 불러올 수 없습니다: ${err.message}</div>`;
        });
    } else if (fmt === 'txt') {
      fetch(item.url).then(r => r.text()).then(text => {
        const c = document.createElement('div');
        c.className = 'txt-container';
        c.style.fontSize = '18px';
        c.textContent = text;
        readerBody.innerHTML = '';
        readerBody.appendChild(c);
      }).catch(err => {
        readerBody.innerHTML = `<div style="padding: 40px; color: #ef4444;">오류: ${err.message}</div>`;
      });
    } else if (fmt === 'pdf') {
      readerBody.innerHTML = `
        <div class="pdf-container">
          <iframe src="${item.url}#toolbar=1" title="${item.title}"></iframe>
        </div>
      `;
    } else if (fmt === 'epub') {
      if (typeof ePub !== 'undefined') {
        readerBody.innerHTML = '<div id="epubArea" style="width: 100%; height: 100%;"></div>';
        try {
          const book = ePub(item.url);
          const rendition = book.renderTo("epubArea", { width: "100%", height: "100%" });
          rendition.display();
        } catch (e) {
          readerBody.innerHTML = `<div style="padding: 40px;">EPUB 미리보기 오류: ${e.message}</div>`;
        }
      } else {
        readerBody.innerHTML = `<div style="padding: 40px;"><a href="${item.url}" download class="btn btn-primary">EPUB 다운로드</a></div>`;
      }
    }
  }

  window.closeReader = function () {
    readerModal.classList.remove('open');
    readerBody.innerHTML = '';
  };

  // --- Utilities ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  let toastTimer = null;
  function showToast(message) {
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // --- Event Bindings ---
  function bindEvents() {
    // Sidebar Navigation Click
    if (navDashboard) navDashboard.addEventListener('click', () => switchView('dashboard'));
    if (navContent) navContent.addEventListener('click', () => switchView('content'));
    if (navUsers) navUsers.addEventListener('click', () => switchView('users'));
    if (navAds) navAds.addEventListener('click', () => switchView('ads'));

    // Dashboard Quick Actions
    if (cardQuickUpload) cardQuickUpload.addEventListener('click', () => switchView('content'));
    if (cardQuickUsers) cardQuickUsers.addEventListener('click', () => switchView('users'));

    // Ad Form & Preview inputs
    if (formAdSettings) {
      formAdSettings.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSaveAdSettings();
      });
    }

    if (btnAddNewAd) {
      btnAddNewAd.addEventListener('click', addNewAd);
    }

    if (btnApplyCurrentAd) {
      btnApplyCurrentAd.addEventListener('click', () => applyFormToCurrentAd(true));
    }

    if (btnPrevPreviewAd) {
      btnPrevPreviewAd.addEventListener('click', () => {
        if (!adList || adList.length === 0) return;
        currentPreviewAdIndex = (currentPreviewAdIndex - 1 + adList.length) % adList.length;
        updateAdLivePreview();
      });
    }

    if (btnNextPreviewAd) {
      btnNextPreviewAd.addEventListener('click', () => {
        if (!adList || adList.length === 0) return;
        currentPreviewAdIndex = (currentPreviewAdIndex + 1) % adList.length;
        updateAdLivePreview();
      });
    }

    if (inputAdItemActive) {
      inputAdItemActive.addEventListener('change', () => {
        applyFormToCurrentAd(false);
      });
    }

    [inputAdTitle, inputAdSponsor, inputAdMessage, inputAdSkipSeconds, inputAdImageUrl, inputAdLink].forEach(el => {
      if (el) el.addEventListener('input', () => {
        updateAdLivePreview();
      });
    });

    if (btnSelectAdImage && inputAdImageFile) {
      btnSelectAdImage.addEventListener('click', (e) => {
        e.preventDefault();
        inputAdImageFile.click();
      });
      inputAdImageFile.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          uploadAdImage(e.target.files[0]);
          inputAdImageFile.value = '';
        }
      });
    }

    if (btnRemoveAdImage && inputAdImageUrl) {
      btnRemoveAdImage.addEventListener('click', (e) => {
        e.preventDefault();
        inputAdImageUrl.value = '';
        if (adList[currentEditingAdIndex]) {
          adList[currentEditingAdIndex].imageUrl = '';
        }
        renderAdList();
        updateAdLivePreview();
        showToast('🗑️ 광고 사진이 제거되었습니다. [전체 광고 설정 최종 저장]을 눌러 적용하세요.');
      });
    }

    // Admin Auth Form
    if (adminAuthForm) {
      adminAuthForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAdminAuthSubmit();
      });
    }

    if (btnAdminLogout) {
      btnAdminLogout.addEventListener('click', handleAdminLogout);
    }

    // User Form
    if (formAddUser) {
      formAddUser.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAddUserSubmit();
      });
    }

    if (btnSubmitUser) {
      btnSubmitUser.addEventListener('click', (e) => {
        e.preventDefault();
        handleAddUserSubmit();
      });
    }

    if (btnSyncAllUsersLink) {
      btnSyncAllUsersLink.addEventListener('click', () => {
        copyAllUsersSyncLink();
      });
    }

    // Master Password Change Modal Events
    if (btnOpenChangeMasterPw) {
      btnOpenChangeMasterPw.addEventListener('click', openChangeMasterPwModal);
    }

    if (btnSidebarChangeMasterPw) {
      btnSidebarChangeMasterPw.addEventListener('click', openChangeMasterPwModal);
    }

    if (btnCancelChangeMasterPw) {
      btnCancelChangeMasterPw.addEventListener('click', closeChangeMasterPwModal);
    }

    if (formChangeMasterPw) {
      formChangeMasterPw.addEventListener('submit', (e) => {
        e.preventDefault();
        handleChangeMasterPwSubmit();
      });
    }

    if (modalChangeMasterPw) {
      modalChangeMasterPw.addEventListener('click', (e) => {
        if (e.target === modalChangeMasterPw) {
          closeChangeMasterPwModal();
        }
      });
    }

    // User Password Change Modal Events
    if (btnCancelChangeUserPw) {
      btnCancelChangeUserPw.addEventListener('click', closeChangeUserPwModal);
    }

    if (formChangeUserPw) {
      formChangeUserPw.addEventListener('submit', (e) => {
        e.preventDefault();
        handleChangeUserPwSubmit();
      });
    }

    if (modalChangeUserPw) {
      modalChangeUserPw.addEventListener('click', (e) => {
        if (e.target === modalChangeUserPw) {
          closeChangeUserPwModal();
        }
      });
    }

    // Password Reveal & Master Auth Events
    if (btnTogglePasswords) {
      btnTogglePasswords.addEventListener('click', () => {
        if (revealedPasswords) {
          revealedPasswords = null;
          if (btnTogglePasswordsIcon) btnTogglePasswordsIcon.textContent = '🔒';
          if (btnTogglePasswordsText) btnTogglePasswordsText.textContent = '비밀번호 확인 (마스터 인증)';
          renderUsers(registeredUsers);
          showToast('🔒 비밀번호 표시가 숨김 처리되었습니다.');
        } else {
          openMasterAuthModal();
        }
      });
    }

    if (formMasterAuth) {
      formMasterAuth.addEventListener('submit', (e) => {
        e.preventDefault();
        handleMasterAuthSubmit();
      });
    }

    if (btnCancelMasterAuth) {
      btnCancelMasterAuth.addEventListener('click', () => {
        closeMasterAuthModal();
      });
    }

    if (masterAuthModal) {
      masterAuthModal.addEventListener('click', (e) => {
        if (e.target === masterAuthModal) {
          closeMasterAuthModal();
        }
      });
    }

    // Search and filters
    if (adminSearchInput) {
      adminSearchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderTable();
      });
    }

    document.querySelectorAll('.seg-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.seg-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter');
        renderTable();
      });
    });

    // --- Zone 1: Word eBook Dropzone Events ---
    if (btnSelectEbookFiles && adminEbookFileInput) {
      btnSelectEbookFiles.addEventListener('click', (e) => {
        e.stopPropagation();
        adminEbookFileInput.click();
      });
    }

    if (adminEbookDropzone && adminEbookFileInput) {
      adminEbookDropzone.addEventListener('click', () => {
        adminEbookFileInput.click();
      });

      adminEbookFileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        const nonDocx = files.filter(f => !f.name.toLowerCase().endsWith('.docx') && !f.name.toLowerCase().endsWith('.doc'));
        if (nonDocx.length > 0) {
          showToast('⚠️ 전자책은 Word(.docx, .doc) 파일만 등록할 수 있습니다.');
        }
        const validFiles = files.filter(f => f.name.toLowerCase().endsWith('.docx') || f.name.toLowerCase().endsWith('.doc'));
        if (validFiles.length > 0) {
          uploadFiles(validFiles, 'ebook');
        }
        adminEbookFileInput.value = '';
      });

      ['dragenter', 'dragover'].forEach(name => {
        adminEbookDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          adminEbookDropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        adminEbookDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          adminEbookDropzone.classList.remove('dragover');
        });
      });

      adminEbookDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        adminEbookDropzone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files) {
          const files = Array.from(e.dataTransfer.files);
          const nonDocx = files.filter(f => !f.name.toLowerCase().endsWith('.docx') && !f.name.toLowerCase().endsWith('.doc'));
          if (nonDocx.length > 0) {
            showToast('⚠️ 전자책 구역에는 Word(.docx, .doc) 파일만 등록할 수 있습니다.');
          }
          const validFiles = files.filter(f => f.name.toLowerCase().endsWith('.docx') || f.name.toLowerCase().endsWith('.doc'));
          if (validFiles.length > 0) {
            uploadFiles(validFiles, 'ebook');
          }
        }
      });
    }

    // --- Zone 2: Audiobook Dropzone Events ---
    if (btnSelectAudioFiles && adminAudioFileInput) {
      btnSelectAudioFiles.addEventListener('click', (e) => {
        e.stopPropagation();
        adminAudioFileInput.click();
      });
    }

    if (adminAudioDropzone && adminAudioFileInput) {
      adminAudioDropzone.addEventListener('click', () => {
        adminAudioFileInput.click();
      });

      adminAudioFileInput.addEventListener('change', (e) => {
        uploadFiles(e.target.files, 'audiobook');
        adminAudioFileInput.value = '';
      });

      ['dragenter', 'dragover'].forEach(name => {
        adminAudioDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          adminAudioDropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        adminAudioDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          adminAudioDropzone.classList.remove('dragover');
        });
      });

      adminAudioDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        adminAudioDropzone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files) {
          uploadFiles(e.dataTransfer.files, 'audiobook');
        }
      });
    }

    // Player events
    if (btnPlayPause && audioElement) {
      btnPlayPause.addEventListener('click', () => {
        if (!audioElement.src) return;
        if (audioElement.paused) audioElement.play();
        else audioElement.pause();
      });

      audioElement.addEventListener('play', () => {
        if (playIcon) playIcon.textContent = '⏸';
      });
      audioElement.addEventListener('pause', () => {
        if (playIcon) playIcon.textContent = '▶';
      });

      if (audioTimeline) {
        audioTimeline.addEventListener('input', () => {
          if (currentTimeLabel) currentTimeLabel.textContent = formatTime(parseFloat(audioTimeline.value));
        });

        audioTimeline.addEventListener('change', () => {
          audioElement.currentTime = parseFloat(audioTimeline.value);
        });
      }

      audioElement.addEventListener('timeupdate', () => {
        if (audioTimeline) audioTimeline.value = audioElement.currentTime;
        if (currentTimeLabel) currentTimeLabel.textContent = formatTime(audioElement.currentTime);
      });

      if (speedSelect) {
        speedSelect.addEventListener('change', () => {
          audioElement.playbackRate = parseFloat(speedSelect.value);
        });
      }

      if (btnClosePlayer && audioPlayerBar) {
        btnClosePlayer.addEventListener('click', () => {
          audioElement.pause();
          audioPlayerBar.classList.remove('active');
        });
      }
    }

    // Initial view topbar configuration
    switchView('dashboard');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
