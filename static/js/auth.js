// Bookwave User Authentication Module
// Authenticates with backend /api/login and enforces mandatory login gate

(function () {
  'use strict';

  const STORAGE_KEY = 'bw_user_session';
  let currentUser = null;

  function decodeSafeBase64(str) {
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch (e) {
      try { return atob(str); } catch (e2) { return ''; }
    }
  }

  // Handle cross-device member registration via smart link/QR parameters
  function checkUrlUserSyncParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      let updated = false;
      let toastMsg = '';
      let targetUser = null;

      // 1. Single member sync (?reg_user=...)
      const regUserParam = params.get('reg_user');
      if (regUserParam) {
        try {
          const jsonStr = decodeSafeBase64(regUserParam);
          const u = JSON.parse(jsonStr);
          if (u && u.username) {
            let staticList = [];
            const raw = localStorage.getItem('bw_static_users');
            if (raw) {
              try { staticList = JSON.parse(raw); } catch (e) {}
            }
            if (!Array.isArray(staticList)) staticList = [];
            const idx = staticList.findIndex(x => x.username.toLowerCase() === u.username.toLowerCase());
            if (idx >= 0) {
              staticList[idx] = { ...staticList[idx], ...u };
            } else {
              staticList.push(u);
            }
            localStorage.setItem('bw_static_users', JSON.stringify(staticList));
            updated = true;
            targetUser = u;
            toastMsg = `✨ '${u.name || u.username}' 회원 계정이 이 기기에 등록되었습니다! 비밀번호를 입력하고 로그인하세요.`;
          }
        } catch (e) {}
      }

      // 2. Full members sync (?sync_users=...)
      const syncUsersParam = params.get('sync_users');
      if (syncUsersParam) {
        try {
          const jsonStr = decodeSafeBase64(syncUsersParam);
          const list = JSON.parse(jsonStr);
          if (Array.isArray(list) && list.length > 0) {
            let staticList = [];
            const raw = localStorage.getItem('bw_static_users');
            if (raw) {
              try { staticList = JSON.parse(raw); } catch (e) {}
            }
            if (!Array.isArray(staticList)) staticList = [];
            list.forEach(u => {
              if (u && u.username) {
                const idx = staticList.findIndex(x => x.username.toLowerCase() === u.username.toLowerCase());
                if (idx >= 0) staticList[idx] = { ...staticList[idx], ...u };
                else staticList.push(u);
              }
            });
            localStorage.setItem('bw_static_users', JSON.stringify(staticList));
            updated = true;
            toastMsg = `✨ 스튜디오 회원 명단(${list.length}명)이 이 기기에 성공적으로 동기화되었습니다!`;
          }
        } catch (e) {}
      }

      if (updated) {
        try {
          const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        } catch (e) {}

        setTimeout(() => {
          if (targetUser) {
            const userInput = document.getElementById('loginUsername');
            const pwInput = document.getElementById('loginPassword');
            if (userInput) userInput.value = targetUser.username;
            if (pwInput) pwInput.focus();
          }
          if (window.showToast && toastMsg) {
            window.showToast(toastMsg);
          }
        }, 350);
      }
    } catch (e) {}
  }

  // Load session from localStorage and immediately verify with server
  function loadSession() {
    checkUrlUserSyncParams();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        currentUser = JSON.parse(raw);
      }
    } catch (e) {
      currentUser = null;
    }
    updateAuthUI();
    syncUserSession();
  }

  // Real-time synchronization with server or local storage (detects tier changes and deleted accounts)
  async function syncUserSession() {
    if (!currentUser || !currentUser.username) return;

    // Check if the user session key was removed from localStorage (by Studio or another tab)
    const storedSession = localStorage.getItem(STORAGE_KEY);
    if (!storedSession) {
      logoutDueToDeletion('🔒 로그아웃되었습니다.');
      return;
    }

    let isServerTested = false;
    try {
      const res = await fetch(`/api/user/status?username=${encodeURIComponent(currentUser.username)}`);
      isServerTested = true;
      if (res.status === 404) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          try {
            const data = await res.json();
            if (data && data.success === false) {
              // Real backend confirmed account was deleted
              logoutDueToDeletion('🔒 계정이 삭제되어 로그아웃되었습니다.');
              return;
            }
          } catch (e) {}
        }
        // If not backend JSON (e.g. Netlify static 404 page), treat as static host and do not force logout
      } else if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          applyTierUpdate(data.user.tier || 'free', data.user.name || currentUser.name);
          return;
        }
      }
    } catch (e) {
      // Network failure or static host
    }

    // Static / Netlify fallback: if server test didn't succeed
    if (!isServerTested) {
      let staticList = [];
      try {
        const staticUsersRaw = localStorage.getItem('bw_static_users');
        if (staticUsersRaw) {
          const parsed = JSON.parse(staticUsersRaw);
          if (Array.isArray(parsed) && parsed.length > 0) staticList = parsed;
        }
      } catch (e) {}

      if (staticList.length === 0) {
        try {
          const dataRes = await fetch('/data/users.json').catch(() => null);
          if (dataRes && dataRes.ok) {
            const dataObj = await dataRes.json().catch(() => null);
            if (dataObj && Array.isArray(dataObj.users)) staticList = dataObj.users;
          }
        } catch (e) {}
      }

      if (staticList.length > 0) {
        const found = staticList.find(u => u && u.username && u.username.toLowerCase() === currentUser.username.toLowerCase());
        if (!found) {
          logoutDueToDeletion('🔒 스튜디오에 등록되지 않은 계정입니다.');
          return;
        }
        if (found.tier) {
          applyTierUpdate(found.tier, found.name || currentUser.name);
          return;
        }
      }
    }
  }

  function applyTierUpdate(newTier, newName) {
    if (!currentUser) return;
    const oldTier = currentUser.tier;
    const oldName = currentUser.name;
    if (newTier !== oldTier || newName !== oldName) {
      currentUser.tier = newTier;
      currentUser.name = newName;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
      updateAuthUI();
      if (window.renderLibrary) window.renderLibrary();
      const tierNames = { free: '무료', pro: 'PRO', premium: '프리미엄' };
      if (window.showToast) {
        window.showToast(`✨ 회원 등급이 [${tierNames[newTier] || newTier}](으)로 실시간 반영되었습니다!`);
      }
    }
  }

  // Save session
  function saveSession(user) {
    currentUser = user;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    updateAuthUI();
    if (window.refreshDownloadedCache) {
      window.refreshDownloadedCache().then(() => {
        if (window.renderLibrary) window.renderLibrary();
      });
    } else if (window.renderLibrary) {
      window.renderLibrary();
    }
    if (window.showToast) {
      window.showToast(`✨ 환영합니다, ${user.name}님!`);
    }
  }

  // Logout (re-triggers mandatory login gate)
  function logout() {
    currentUser = null;
    localStorage.removeItem(STORAGE_KEY);
    updateAuthUI();
    if (window.refreshDownloadedCache) {
      window.refreshDownloadedCache().then(() => {
        if (window.renderLibrary) window.renderLibrary();
      });
    } else if (window.renderLibrary) {
      window.renderLibrary();
    }
    if (window.showToast) {
      window.showToast('👋 로그아웃되었습니다.');
    }
  }

  // Immediate logout when account is deleted by Studio
  function logoutDueToDeletion(msg) {
    if (!currentUser) return;
    const deletedName = currentUser.name || currentUser.username;
    currentUser = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}

    // Stop audio playback if running
    if (window.BookwaveAudioPlayer && typeof window.BookwaveAudioPlayer.pause === 'function') {
      try { window.BookwaveAudioPlayer.pause(); } catch (e) {}
    }
    const audioEl = document.getElementById('mainAudioPlayer');
    if (audioEl && !audioEl.paused) {
      try { audioEl.pause(); } catch (e) {}
    }

    // Close reader modal if open
    const readerModal = document.getElementById('bookReaderModal');
    if (readerModal && readerModal.classList.contains('active')) {
      readerModal.classList.remove('active');
    }

    updateAuthUI();

    if (window.refreshDownloadedCache) {
      window.refreshDownloadedCache().then(() => {
        if (window.renderLibrary) window.renderLibrary();
      });
    } else if (window.renderLibrary) {
      window.renderLibrary();
    }

    if (window.showToast) {
      window.showToast(msg || `🔒 '${deletedName}' 계정이 삭제되어 로그아웃되었습니다.`);
    }
  }

  // Update UI Elements & Control Mandatory Login Gate
  function updateAuthUI() {
    const gate = document.getElementById('mandatoryLoginGate');
    const authContainer = document.getElementById('authContainer');

    if (currentUser) {
      // User is logged in: HIDE the mandatory login gate
      if (gate) gate.style.display = 'none';

      if (authContainer) {
        const tier = currentUser.tier || 'free';
        const tierBadge = tier === 'free'
          ? `<span class="user-tier-tag free" style="font-size: 0.68rem; padding: 2px 6px; border-radius: 6px; background: rgba(148,163,184,0.15); color: #94a3b8; font-weight: 700; border: 1px solid rgba(148,163,184,0.3); white-space: nowrap;">무료</span>`
          : (tier === 'premium'
            ? `<span class="user-tier-tag premium" style="font-size: 0.68rem; padding: 2px 6px; border-radius: 6px; background: rgba(255,107,0,0.15); color: #ff6b00; font-weight: 800; border: 1px solid rgba(255,107,0,0.35); white-space: nowrap;">👑 프리미엄</span>`
            : `<span class="user-tier-tag pro" style="font-size: 0.68rem; padding: 2px 6px; border-radius: 6px; background: rgba(2,132,199,0.15); color: #0284c7; font-weight: 700; border: 1px solid rgba(2,132,199,0.3); white-space: nowrap;">⚡ PRO</span>`
          );

        authContainer.innerHTML = `
          <div class="user-profile-badge">
            <div class="user-avatar" style="background: var(--welaaa-orange); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem;">
              ${(currentUser.name || 'U')[0]}
            </div>
            <div class="user-info-text">
              <span class="user-name">${currentUser.name}</span>
              <span class="user-email">(@${currentUser.username})</span>
              ${tierBadge}
            </div>
            <button class="btn btn-secondary btn-sm" id="btnLogout" title="로그아웃" style="padding: 4px 10px; font-size: 0.78rem;">
              로그아웃
            </button>
          </div>
        `;
        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) btnLogout.addEventListener('click', logout);
      }
    } else {
      // User is NOT logged in: SHOW the mandatory login gate
      if (gate) gate.style.display = 'flex';

      if (authContainer) {
        authContainer.innerHTML = `
          <button class="btn btn-primary" id="btnHeaderLogin" style="background: var(--welaaa-orange);">
            로그인
          </button>
        `;
        const btnHeaderLogin = document.getElementById('btnHeaderLogin');
        if (btnHeaderLogin) {
          btnHeaderLogin.addEventListener('click', () => {
            if (gate) gate.style.display = 'flex';
          });
        }
      }
    }
  }

  async function calculateSha256(text) {
    try {
      const enc = new TextEncoder().encode(text);
      const buf = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return '';
    }
  }

  // Handle Login Form Submission
  async function handleLoginSubmit() {
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const errorEl = document.getElementById('loginErrorMessage');
    const submitBtn = document.getElementById('btnLoginSubmit');

    if (!usernameInput || !passwordInput) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      if (errorEl) {
        errorEl.textContent = '아이디와 비밀번호를 모두 입력해 주세요.';
        errorEl.style.display = 'block';
      }
      return;
    }

    if (errorEl) errorEl.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '로그인 확인 중...';
    }

    try {
      let isStaticMode = false;
      let res = null;
      try {
        res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (res.status === 404 || res.status === 405) {
          isStaticMode = true;
        }
      } catch (netErr) {
        isStaticMode = true;
      }

      // 1. Backend Server Mode: Backend explicitly verified credentials
      if (res && !isStaticMode) {
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.success && data.user) {
            saveSession(data.user);
            usernameInput.value = '';
            passwordInput.value = '';
            return;
          }
        }
        // Backend rejected login: Stop and display message! Never allow unauthorized entry!
        const data = await res.json().catch(() => null);
        if (errorEl) {
          errorEl.textContent = (data && data.message) ? data.message : '등록되지 않은 아이디이거나 비밀번호가 일치하지 않습니다.';
          errorEl.style.display = 'block';
        }
        return;
      }

      // 2. Static / Netlify Fallback Mode: Strictly authenticate against registered users database
      if (isStaticMode) {
        let userList = [];

        // A. Load from localStorage (updated in Studio when operator manages accounts)
        try {
          const staticUsersRaw = localStorage.getItem('bw_static_users');
          if (staticUsersRaw) {
            const parsed = JSON.parse(staticUsersRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              userList = parsed;
            }
          }
        } catch (e) {}

        // B. Fetch bundled /data/users.json if available
        if (userList.length === 0) {
          try {
            const dataRes = await fetch('/data/users.json').catch(() => null);
            if (dataRes && dataRes.ok) {
              const dataObj = await dataRes.json().catch(() => null);
              if (dataObj && Array.isArray(dataObj.users)) {
                userList = dataObj.users;
                localStorage.setItem('bw_static_users', JSON.stringify(userList));
              }
            }
          } catch (e) {}
        }

        // C. Standard pre-registered users fallback
        if (userList.length === 0) {
          userList = [
            {
              username: 'reader',
              name: '김독서',
              tier: 'premium',
              password: '1234',
              passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
            },
            {
              username: 'yeonwoo',
              name: '연우',
              tier: 'premium',
              password: '1234',
              passwordHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
            }
          ];
          localStorage.setItem('bw_static_users', JSON.stringify(userList));
        }

        // D. STRICT CHECK 1: User MUST exist in registered list
        const found = userList.find(u => u && u.username && u.username.toLowerCase() === username.toLowerCase());
        if (!found) {
          if (errorEl) {
            errorEl.textContent = '스튜디오에 등록되지 않은 아이디입니다. 운영자가 등록한 계정으로만 로그인할 수 있습니다.';
            errorEl.style.display = 'block';
          }
          return;
        }

        // E. STRICT CHECK 2: Password check
        const inputHash = await calculateSha256(password);
        let pwMatched = false;

        if (found.passwordHash && (found.passwordHash === inputHash || found.passwordHash === password)) {
          pwMatched = true;
        } else if (found.password && found.password === password) {
          pwMatched = true;
        } else if (!found.password && !found.passwordHash) {
          if (password === '1234' || inputHash === '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4') {
            pwMatched = true;
          }
        }

        if (!pwMatched) {
          if (errorEl) {
            errorEl.textContent = '비밀번호가 일치하지 않습니다.';
            errorEl.style.display = 'block';
          }
          return;
        }

        // F. Successful login only when both checks pass
        saveSession({
          username: found.username,
          name: found.name || found.username,
          tier: found.tier || 'pro'
        });
        usernameInput.value = '';
        passwordInput.value = '';
        return;
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = `로그인 오류: ${err.message}`;
        errorEl.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '북웨이브 로그인 ▶';
      }
    }
  }

  function bindEvents() {
    const form = document.getElementById('userLoginForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLoginSubmit();
      });
    }
  }

  // Export auth state
  window.BookPlayerAuth = {
    getUser: () => currentUser,
    getTier: () => currentUser ? (currentUser.tier || 'free') : 'free',
    isLoggedIn: () => !!currentUser,
    logout: logout,
    syncSession: syncUserSession
  };

  // Run on load
  function startup() {
    bindEvents();
    loadSession();

    // Check with server when window gains focus or tab becomes visible
    window.addEventListener('focus', syncUserSession);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) syncUserSession();
    });

    // Cross-tab / cross-window instant synchronization via storage event
    window.addEventListener('storage', (e) => {
      // 1. Account deleted ping broadcasted from Studio
      if (e.key === 'bw_account_deleted_ping') {
        try {
          const data = JSON.parse(e.newValue);
          if (data && currentUser && data.username && data.username.toLowerCase() === currentUser.username.toLowerCase()) {
            logoutDueToDeletion('🔒 계정이 삭제되어 로그아웃되었습니다.');
            return;
          }
        } catch (err) {}
      }

      // 2. User session removed in another tab/window
      if (e.key === STORAGE_KEY && !e.newValue && currentUser) {
        logoutDueToDeletion('🔒 로그아웃되었습니다.');
        return;
      }

      // 3. Tier updates or user list updates
      if (e.key === 'bw_user_session' || e.key === 'bw_static_users' || e.key === 'bw_tier_update_ping') {
        syncUserSession();
      }
    });

    // Custom event within same window
    window.addEventListener('bw-tier-updated', (e) => {
      if (currentUser && e.detail && e.detail.username.toLowerCase() === currentUser.username.toLowerCase()) {
        applyTierUpdate(e.detail.tier, currentUser.name);
      }
    });

    window.addEventListener('bw-account-deleted', (e) => {
      if (currentUser && e.detail && e.detail.username && e.detail.username.toLowerCase() === currentUser.username.toLowerCase()) {
        logoutDueToDeletion('🔒 계정이 삭제되어 로그아웃되었습니다.');
      }
    });

    // Periodic heartbeat sync every 2 seconds to immediately reflect tier changes and account removals
    setInterval(syncUserSession, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startup);
  } else {
    startup();
  }
})();
