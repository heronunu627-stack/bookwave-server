// Bookwave Style Main JavaScript & Physical Two-Page Spread Reader
// Integrates Curation UI, Audio Player, Membership Tier Rules, Offline IndexedDB Engine, and Real Book Spreads

(function () {
  'use strict';

  // --- Offline Storage & Quota (IndexedDB) ---
  const OFFLINE_DB_NAME = 'BookwaveOfflineDB';
  const OFFLINE_STORE_NAME = 'offline_books';
  const OFFLINE_DB_VERSION = 2;
  const MAX_OFFLINE_DOWNLOADS = 5;
  let offlineDb = null;
  let isSimulatedOffline = false;
  let downloadedIds = new Set();

  // --- App State ---
  let libraryItems = [];
  let currentNavFilter = 'all'; // 'all', 'audiobook', 'ebook', 'offline'
  let searchQuery = '';
  let activeAudioItem = null;
  let activeBookItem = null;
  let isScrubbing = false;

  // Book Spread State
  let bookSpreads = [];
  let currentSpreadIndex = 0;
  let rawBookText = '';
  let currentBookDocxPages = null;
  let totalDocxPages = 0;
  if (!localStorage.getItem('bp_font_v2')) {
    if (localStorage.getItem('bp_book_font_size') === '18') localStorage.setItem('bp_book_font_size', '15');
    localStorage.setItem('bp_font_v2', '1');
  }
  let bookFontSize = parseInt(localStorage.getItem('bp_book_font_size') || '15', 10);
  let bookTheme = localStorage.getItem('bp_book_theme') || '';

  // DOM Elements - Navigation & Grids
  const homeBookwaveScreen = document.getElementById('homeBookwaveScreen');
  const btnGoAudiobooks = document.getElementById('btnGoAudiobooks');
  const btnGoEbooks = document.getElementById('btnGoEbooks');
  const btnGoOffline = document.getElementById('btnGoOffline');
  const btnCardNavAudio = document.getElementById('btnCardNavAudio');
  const btnCardNavEbook = document.getElementById('btnCardNavEbook');
  const btnCardNavTier = document.getElementById('btnCardNavTier');
  const btnCardNavTierText = document.getElementById('btnCardNavTierText');
  const cardTierIcon = document.getElementById('cardTierIcon');
  const cardTierTitle = document.getElementById('cardTierTitle');
  const cardTierDesc = document.getElementById('cardTierDesc');
  const cardTierHighlight = document.getElementById('cardTierHighlight');
  const bwTierStatusBanner = document.getElementById('bwTierStatusBanner');
  const bannerTierIcon = document.getElementById('bannerTierIcon');
  const bannerUserName = document.getElementById('bannerUserName');
  const bannerTierBadge = document.getElementById('bannerTierBadge');
  const bannerTierBenefit = document.getElementById('bannerTierBenefit');
  const btnBannerAction = document.getElementById('btnBannerAction');
  const logoBtn = document.getElementById('logoBtn');

  const sectionContinue = document.getElementById('sectionContinue');
  const gridContinue = document.getElementById('gridContinue');
  const sectionAudio = document.getElementById('sectionAudio');
  const gridAudiobooks = document.getElementById('gridAudiobooks');
  const sectionEbooks = document.getElementById('sectionEbooks');
  const gridEbooks = document.getElementById('gridEbooks');
  const sectionOffline = document.getElementById('sectionOffline');
  const gridOffline = document.getElementById('gridOffline');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // DOM Elements - Wi-Fi & Offline Banner
  const btnWifiToggle = document.getElementById('btnWifiToggle');
  const wifiIcon = document.getElementById('wifiIcon');
  const wifiLabel = document.getElementById('wifiLabel');
  const offlineNoticeBanner = document.getElementById('offlineNoticeBanner');
  const offlineNoticeText = document.getElementById('offlineNoticeText');
  const navOfflineTab = document.getElementById('navOfflineTab');
  const navOfflineCount = document.getElementById('navOfflineCount');

  // DOM Elements - Modals
  const freeBlockModal = document.getElementById('freeBlockModal');
  const btnCloseFreeModal = document.getElementById('btnCloseFreeModal');
  const proAdModal = document.getElementById('proAdModal');
  const adModalSponsor = document.getElementById('adModalSponsor');
  const adModalTitle = document.getElementById('adModalTitle');
  const adModalMessage = document.getElementById('adModalMessage');
  const adModalImageContainer = document.getElementById('adModalImageContainer');
  const adModalImage = document.getElementById('adModalImage');
  const adModalDefaultIcon = document.getElementById('adModalDefaultIcon');
  const adCountdownBadge = document.getElementById('adCountdownBadge');
  const btnAdSkip = document.getElementById('btnAdSkip');
  const adBtnText = document.getElementById('adBtnText');
  const downloadLimitModal = document.getElementById('downloadLimitModal');
  const btnCloseLimitModal = document.getElementById('btnCloseLimitModal');
  let activeAdTimer = null;

  // DOM Elements - Audio Player
  const audioPlayerBar = document.getElementById('audioPlayerBar');
  const audioElement = document.getElementById('audioElement');
  const playerTitle = document.getElementById('playerTitle');
  const playerSubtitle = document.getElementById('playerSubtitle');
  const playerThumb = document.getElementById('playerThumb');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const playIcon = document.getElementById('playIcon');
  const btnBackward = document.getElementById('btnBackward');
  const btnForward = document.getElementById('btnForward');
  const audioTimeline = document.getElementById('audioTimeline');
  const currentTimeLabel = document.getElementById('currentTimeLabel');
  const durationLabel = document.getElementById('durationLabel');
  const speedSelect = document.getElementById('speedSelect');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeIcon = document.getElementById('volumeIcon');
  const btnClosePlayer = document.getElementById('btnClosePlayer');

  // DOM Elements - Physical Book Spread Reader
  const readerModal = document.getElementById('readerModal');
  const readerBookTitle = document.getElementById('readerBookTitle');
  const bookStage = document.getElementById('bookStage');
  const btnPrevSpread = document.getElementById('btnPrevSpread');
  const btnNextSpread = document.getElementById('btnNextSpread');
  const spreadIndicator = document.getElementById('spreadIndicator');
  const txtControls = document.getElementById('txtControls');
  const fontSizeDisplay = document.getElementById('fontSizeDisplay');
  const btnFontSmaller = document.getElementById('btnFontSmaller');
  const btnFontLarger = document.getElementById('btnFontLarger');
  const btnThemeSepia = document.getElementById('btnThemeSepia');
  const btnThemeDark = document.getElementById('btnThemeDark');
  const btnThemeLight = document.getElementById('btnThemeLight');

  // DOM Elements - Share Modals & Buttons
  const btnOpenShareCode = document.getElementById('btnOpenShareCode');
  const shareModal = document.getElementById('shareModal');
  const btnCloseShareModal = document.getElementById('btnCloseShareModal');
  const shareItemIcon = document.getElementById('shareItemIcon');
  const shareItemTitle = document.getElementById('shareItemTitle');
  const shareItemMeta = document.getElementById('shareItemMeta');
  const shareCodeInput = document.getElementById('shareCodeInput');
  const btnCopyShareCode = document.getElementById('btnCopyShareCode');
  const shareLinkInput = document.getElementById('shareLinkInput');
  const btnCopyShareLink = document.getElementById('btnCopyShareLink');
  const shareTunnelStatus = document.getElementById('shareTunnelStatus');
  const shareQrCodeBox = document.getElementById('shareQrCodeBox');
  const btnNativeShare = document.getElementById('btnNativeShare');
  const openShareCodeModal = document.getElementById('openShareCodeModal');
  const inputOpenShareCode = document.getElementById('inputOpenShareCode');
  const openShareError = document.getElementById('openShareError');
  const btnCancelOpenShare = document.getElementById('btnCancelOpenShare');
  const btnSubmitOpenShare = document.getElementById('btnSubmitOpenShare');
  const btnReaderShare = document.getElementById('btnReaderShare');
  const btnPlayerShare = document.getElementById('btnPlayerShare');

  // Toast
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');

  // --- Server-side Reading & Audio Progress Sync Engine ---
  async function saveBookProgressToServer(item, spreadIdx) {
    const user = window.BookPlayerAuth ? window.BookPlayerAuth.getUser() : null;
    if (!user || !item) return;
    const total = (bookSpreads && bookSpreads.length) ? bookSpreads.length : 1;
    const pct = Math.round((spreadIdx / Math.max(1, total - 1)) * 100);

    try {
      await fetch('/api/user/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          itemId: item.id,
          title: item.title,
          type: item.type,
          format: item.format,
          spreadIndex: spreadIdx,
          totalSpreads: total,
          progress: pct
        })
      });
    } catch (e) {
      // offline or silent fail
    }
  }

  function saveAudioProgressToServer(item) {
    const user = window.BookPlayerAuth ? window.BookPlayerAuth.getUser() : null;
    if (!user || !item || !audioElement) return;
    const cur = audioElement.currentTime || 0;
    const dur = audioElement.duration || 0;
    const pct = dur > 0 ? Math.round((cur / dur) * 100) : 0;

    fetch('/api/user/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        itemId: item.id,
        title: item.title,
        type: 'audiobook',
        format: item.format,
        currentTime: cur,
        duration: dur,
        progress: pct
      })
    }).catch(() => {});
  }

  // --- Smart Cross-Network Sharing Engine ---
  let currentShareData = null;

  async function openShareModal(item, targetSpread = null, targetTime = null) {
    if (!item) return;
    const user = window.BookPlayerAuth ? window.BookPlayerAuth.getUser() : null;
    const isAudio = item.type === 'audiobook';

    const spreadIdx = targetSpread !== null ? targetSpread : (activeBookItem && activeBookItem.id === item.id ? currentSpreadIndex : 0);
    const audioTime = targetTime !== null ? targetTime : (activeAudioItem && activeAudioItem.id === item.id && audioElement ? audioElement.currentTime : 0);

    if (shareItemIcon) shareItemIcon.textContent = isAudio ? '🎧' : '📖';
    if (shareItemTitle) shareItemTitle.textContent = item.title;
    if (shareItemMeta) {
      if (isAudio && audioTime > 5) {
        shareItemMeta.textContent = `완독 오디오북 · ${formatTime(audioTime)}부터 이어듣기 공유`;
      } else if (!isAudio && spreadIdx > 0) {
        shareItemMeta.textContent = `양면 전자책 · ${spreadIdx * 2}쪽부터 이어보기 공유`;
      } else {
        shareItemMeta.textContent = isAudio ? '완독 오디오북 전체 공유' : '양면 전자책 전체 공유';
      }
    }

    if (shareModal) {
      shareModal.style.display = 'flex';
      shareModal.classList.add('open');
    }

    // 1. Instantly generate code and universal smart share link (works 100% on Netlify, mobile LTE, and local)
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const code = `BW-${randSuffix}`;
    const baseUrl = window.location.origin;
    const cleanItemId = encodeURIComponent(item.id || '');
    const shareLink = `${baseUrl}/?share=${code}&b=${cleanItemId}&s=${spreadIdx}&t=${Math.floor(audioTime)}`;

    const shareEntry = {
      code: code,
      itemId: item.id,
      title: item.title,
      type: item.type,
      spreadIndex: spreadIdx,
      currentTime: audioTime,
      sender: user ? user.name : '북웨이브 회원',
      createdAt: new Date().toLocaleDateString()
    };

    // Store in localStorage for instant offline / local resolution
    try {
      const storedShares = JSON.parse(localStorage.getItem('bw_shares') || '{}');
      storedShares[code] = shareEntry;
      localStorage.setItem('bw_shares', JSON.stringify(storedShares));
    } catch (e) {}

    currentShareData = { code, shareLink, share: shareEntry };

    // Fill inputs immediately!
    if (shareCodeInput) shareCodeInput.value = code;
    if (shareLinkInput) shareLinkInput.value = shareLink;

    if (shareTunnelStatus) {
      shareTunnelStatus.textContent = '● 어디서나 바로 열람 지원 (Netlify / 다른 와이파이 / LTE)';
      shareTunnelStatus.style.color = '#10b981';
    }

    // Render QR Code with multi-provider fallbacks (API 1: qrserver, API 2: quickchart, API 3: text pill)
    if (shareQrCodeBox) {
      const qrApi1 = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(shareLink)}`;
      const qrApi2 = `https://quickchart.io/qr?size=180&text=${encodeURIComponent(shareLink)}`;
      shareQrCodeBox.innerHTML = `
        <img src="${qrApi1}" alt="QR Code" style="width: 100%; height: 100%; object-fit: contain; border-radius: 6px; background: #ffffff; padding: 4px;"
             onerror="if(this.src!=='${qrApi2}'){this.src='${qrApi2}';}else{this.outerHTML='<div style=\\'font-size:0.82rem;color:#38bdf8;text-align:center;padding:12px;font-weight:700;line-height:1.4;\\'>📱 스마트폰 공유<br><span style=\\'font-size:1.15rem;color:#fff;font-family:monospace;\\'>${code}</span></div>';}">
      `;
    }

    // Background server registration (non-blocking, won't break if offline or Netlify)
    try {
      fetch('/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shareEntry)
      }).catch(() => {});
    } catch (e) {}
  }

  async function resolveAndOpenShareCode(inputVal) {
    if (!inputVal || !inputVal.trim()) {
      if (openShareError) {
        openShareError.textContent = '공유 코드 또는 링크를 입력해 주세요.';
        openShareError.style.display = 'block';
      }
      return;
    }

    let input = inputVal.trim();
    let code = input.toUpperCase();
    let targetBookId = null;
    let targetSpread = 0;
    let targetTime = 0;

    // Check if input is a full link
    if (input.includes('?') || input.includes('http://') || input.includes('https://')) {
      try {
        const u = new URL(input, window.location.origin);
        code = (u.searchParams.get('share') || code).toUpperCase();
        targetBookId = u.searchParams.get('b') || u.searchParams.get('book');
        if (u.searchParams.get('s')) targetSpread = parseInt(u.searchParams.get('s'), 10) || 0;
        if (u.searchParams.get('t')) targetTime = parseFloat(u.searchParams.get('t')) || 0;
      } catch (e) {}
    }

    if (!code.startsWith('BW-') && /^\d{4,5}$/.test(code)) {
      code = 'BW-' + code;
    }

    if (openShareError) openShareError.style.display = 'none';
    if (btnSubmitOpenShare) btnSubmitOpenShare.textContent = '도서 찾는 중...';

    // 1. If targetBookId was encoded in URL params, resolve immediately!
    let share = null;
    if (targetBookId) {
      const item = libraryItems.find(i => i.id === targetBookId);
      if (item) {
        share = {
          itemId: targetBookId,
          title: item.title,
          type: item.type,
          spreadIndex: targetSpread,
          currentTime: targetTime
        };
      }
    }

    // 2. Check localStorage
    if (!share) {
      try {
        const localShares = JSON.parse(localStorage.getItem('bw_shares') || '{}');
        if (localShares[code]) {
          share = localShares[code];
        }
      } catch (e) {}
    }

    // 3. Check server API (/api/share/resolve)
    if (!share) {
      try {
        const res = await fetch(`/api/share/resolve?code=${encodeURIComponent(code)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.share) {
            share = data.share;
          }
        }
      } catch (e) {}
    }

    // 4. Fallback: match item by id or title in libraryItems
    if (!share) {
      const matchedItem = libraryItems.find(i => i.id.toLowerCase() === input.toLowerCase() || i.title.toLowerCase().includes(input.toLowerCase()));
      if (matchedItem) {
        share = {
          itemId: matchedItem.id,
          title: matchedItem.title,
          type: matchedItem.type,
          spreadIndex: 0,
          currentTime: 0
        };
      }
    }

    if (share) {
      if (openShareCodeModal) {
        openShareCodeModal.style.display = 'none';
        openShareCodeModal.classList.remove('open');
      }

      let targetItem = libraryItems.find(i => i.id === share.itemId);
      if (!targetItem) {
        await loadLibrary();
        targetItem = libraryItems.find(i => i.id === share.itemId);
      }

      if (targetItem) {
        showToast(`✨ 공유 도서 '${share.title}'(을)를 불러왔습니다!`);
        if (targetItem.type === 'audiobook') {
          requestAccess(targetItem, (approved) => {
            playAudio(approved);
            if (share.currentTime > 2 && audioElement) {
              audioElement.currentTime = share.currentTime;
            }
          });
        } else {
          targetItem.initialSpreadIndex = share.spreadIndex || 0;
          requestAccess(targetItem, (approved) => {
            openBook(approved);
          });
        }
      } else {
        if (openShareError) {
          openShareError.textContent = '도서 파일을 찾을 수 없습니다.';
          openShareError.style.display = 'block';
        }
      }
    } else {
      if (openShareError) {
        openShareError.textContent = '유효하지 않거나 만료된 공유 코드입니다. 6자리 코드(예: BW-1234) 또는 전체 링크를 입력해 주세요.';
        openShareError.style.display = 'block';
      }
    }

    if (btnSubmitOpenShare) btnSubmitOpenShare.innerHTML = '<span>도서 바로 열기 ▶</span>';
  }

  function checkUrlShareParams() {
    const params = new URLSearchParams(window.location.search);
    const shareCode = params.get('share');
    const bookId = params.get('book') || params.get('b');
    const spread = parseInt(params.get('s') || '0', 10) || 0;
    const time = parseFloat(params.get('t') || '0') || 0;

    if (shareCode || bookId) {
      try {
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
      } catch (e) {}
    }

    if (bookId) {
      setTimeout(() => {
        const item = libraryItems.find(i => i.id === bookId);
        if (item) {
          item.initialSpreadIndex = spread;
          requestAccess(item, (approved) => {
            if (item.type === 'audiobook') {
              playAudio(approved);
              if (time > 2 && audioElement) audioElement.currentTime = time;
            } else {
              openBook(approved);
            }
          });
        } else if (shareCode) {
          resolveAndOpenShareCode(shareCode);
        }
      }, 500);
    } else if (shareCode) {
      setTimeout(() => resolveAndOpenShareCode(shareCode), 500);
    }
  }

  // --- Initialization ---
  async function init() {
    initTheme();
    bindEvents();
    await initOfflineDB();
    await loadLibrary();
    checkUrlShareParams();
  }

  function initTheme() {
    const saved = localStorage.getItem('bp_theme') || 'dark';
    document.body.setAttribute('data-theme', saved);
    if (themeToggleBtn) {
      themeToggleBtn.textContent = saved === 'dark' ? '☀️' : '🌙';
    }
  }

  function toggleTheme() {
    const cur = document.body.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('bp_theme', next);
    if (themeToggleBtn) {
      themeToggleBtn.textContent = next === 'dark' ? '☀️' : '🌙';
    }
  }

  // ==========================================================================
  // OFFLINE STORAGE ENGINE (IndexedDB)
  // User Requirement:
  // "프리미엄은 다운로드한 책은 와이파이가 없어도 들거나 볼 수 있어
  //  하지만 그 외 책들은 와이파이 없으면 다 못 보게 막아
  //  그리고 프리미엄은 딱 오디오북과 전자책 다 포함해서 5권만 다운로드 가능해"
  // ==========================================================================

  function getCurrentUserIdentifier() {
    const user = window.BookPlayerAuth ? window.BookPlayerAuth.getUser() : null;
    return (user && user.username) ? user.username : 'user';
  }

  function initOfflineDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported in this browser.');
        resolve(null);
        return;
      }

      const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Purge old store that held unmanaged ghost downloads
        if (db.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
          db.deleteObjectStore(OFFLINE_STORE_NAME);
        }
        const store = db.createObjectStore(OFFLINE_STORE_NAME, { keyPath: 'storageKey' });
        store.createIndex('username', 'username', { unique: false });
        store.createIndex('itemId', 'id', { unique: false });
      };
      req.onsuccess = async (e) => {
        offlineDb = e.target.result;
        await refreshDownloadedCache();
        resolve(offlineDb);
      };
      req.onerror = (e) => {
        console.error('Failed to open offline IndexedDB:', e);
        resolve(null);
      };
    });
  }

  async function refreshDownloadedCache() {
    const items = await getOfflineItems();
    downloadedIds = new Set(items.map(i => i.id));
    if (navOfflineCount) {
      navOfflineCount.textContent = `${items.length}/${MAX_OFFLINE_DOWNLOADS}`;
    }
  }
  window.refreshDownloadedCache = refreshDownloadedCache;

  function getOfflineItems() {
    const currentUsername = getCurrentUserIdentifier();
    return new Promise((resolve) => {
      if (!offlineDb) { resolve([]); return; }
      try {
        const tx = offlineDb.transaction(OFFLINE_STORE_NAME, 'readonly');
        const store = tx.objectStore(OFFLINE_STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          let items = req.result || [];
          if (currentUsername) {
            items = items.filter(r => !r.username || r.username === currentUsername);
          }
          resolve(items);
        };
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  function getOfflineItem(id) {
    const currentUsername = getCurrentUserIdentifier();
    const storageKey = `${currentUsername}_${id}`;
    return new Promise((resolve) => {
      if (!offlineDb) { resolve(null); return; }
      try {
        const tx = offlineDb.transaction(OFFLINE_STORE_NAME, 'readonly');
        const store = tx.objectStore(OFFLINE_STORE_NAME);
        const req = store.get(storageKey);
        req.onsuccess = () => {
          if (req.result) resolve(req.result);
          else {
            // Fallback check by id
            const reqAlt = store.get(id);
            reqAlt.onsuccess = () => resolve(reqAlt.result || null);
            reqAlt.onerror = () => resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  function saveOfflineItem(record) {
    const currentUsername = getCurrentUserIdentifier();
    record.username = currentUsername;
    record.storageKey = `${currentUsername}_${record.id}`;

    return new Promise((resolve, reject) => {
      if (!offlineDb) { reject(new Error('IndexedDB 사용 불가')); return; }
      const tx = offlineDb.transaction(OFFLINE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(OFFLINE_STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e);
    });
  }

  function deleteOfflineItem(id) {
    const currentUsername = getCurrentUserIdentifier();
    const storageKey = `${currentUsername}_${id}`;

    return new Promise((resolve) => {
      if (!offlineDb) { resolve(); return; }
      try {
        const tx = offlineDb.transaction(OFFLINE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(OFFLINE_STORE_NAME);
        store.delete(storageKey);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }

  function clearAllOfflineItems() {
    const currentUsername = getCurrentUserIdentifier();
    return new Promise((resolve) => {
      if (!offlineDb) { resolve(); return; }
      try {
        const tx = offlineDb.transaction(OFFLINE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(OFFLINE_STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const all = req.result || [];
          all.forEach(item => {
            if (!item.username || item.username === currentUsername) {
              store.delete(item.storageKey || item.id);
            }
          });
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }
  window.clearAllOfflineItems = clearAllOfflineItems;

  function isNetworkAvailable() {
    if (isSimulatedOffline) return false;
    return navigator.onLine;
  }

  async function updateNetworkStatusUI() {
    await refreshDownloadedCache();
    const online = isNetworkAvailable();

    if (wifiIcon) wifiIcon.textContent = online ? '📶' : '📵';
    if (wifiLabel) wifiLabel.textContent = online ? '와이파이 ON' : '와이파이 OFF (오프라인)';
    if (offlineNoticeBanner) offlineNoticeBanner.style.display = online ? 'none' : 'block';

    renderLibrary();
  }

  async function openDownloadLimitModal(downloads) {
    const items = downloads || await getOfflineItems();
    const countEl = document.getElementById('limitModalCount');
    const listEl = document.getElementById('limitModalBookList');

    if (countEl) countEl.textContent = items.length;
    if (listEl) {
      listEl.innerHTML = '';
      if (items.length === 0) {
        listEl.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 14px;">보관된 도서가 없습니다.</div>';
      } else {
        items.forEach(book => {
          const row = document.createElement('div');
          row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 8px; background: rgba(255,255,255,0.04); font-size: 0.82rem; gap: 8px;';
          const icon = book.type === 'audiobook' ? '🎧' : '📖';
          row.innerHTML = `
            <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary);">
              <span>${icon}</span>
              <strong style="margin-left: 4px;">${escapeHtml(book.title)}</strong>
              <span style="font-size: 0.72rem; color: var(--text-muted); margin-left: 6px;">(${formatFileSize(book.size)})</span>
            </div>
            <button class="btn btn-secondary btn-sm btn-modal-del" style="padding: 3px 8px; font-size: 0.75rem; color: #ef4444; border-color: rgba(239,68,68,0.3); border-radius: 6px;" title="이 도서 삭제">
              🗑️ 삭제
            </button>
          `;
          const delBtn = row.querySelector('.btn-modal-del');
          if (delBtn) {
            delBtn.onclick = async () => {
              await deleteOfflineItem(book.id);
              await refreshDownloadedCache();
              renderLibrary();
              const updated = await getOfflineItems();
              openDownloadLimitModal(updated);
              showToast(`'${book.title}' 삭제 완료! 1권 여유 공간이 확보되었습니다.`);
            };
          }
          listEl.appendChild(row);
        });
      }
    }

    if (downloadLimitModal) downloadLimitModal.style.display = 'flex';
  }

  // --- Download & Delete Handlers for Premium Users ---
  async function downloadBook(item, e) {
    if (e) e.stopPropagation();

    const tier = window.BookPlayerAuth ? window.BookPlayerAuth.getTier() : 'free';
    if (tier !== 'premium') {
      showToast('⚠️ 도서 다운로드는 [프리미엄 회원] 전용 혜택입니다.');
      return;
    }

    const currentDownloads = await getOfflineItems();

    // 1. If book is already downloaded, inform user and do not count toward limit
    const isAlready = currentDownloads.some(i => i.id === item.id);
    if (isAlready) {
      showToast(`ℹ️ '${item.title}'(은)는 이미 다운로드 보관함에 보관되어 있습니다.`);
      return;
    }

    // 2. 5-book quota check
    if (currentDownloads.length >= MAX_OFFLINE_DOWNLOADS) {
      openDownloadLimitModal(currentDownloads);
      return;
    }

    showToast(`⏳ '${item.title}' 다운로드 중...`);

    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error('파일 다운로드 실패');
      const blob = await res.blob();
      let textContent = null;
      
      const fmt = item.format.toLowerCase();
      let pages = null;
      if (fmt === 'docx' || fmt === 'doc') {
        try {
          let txtRes = await fetch(`/api/book-text?id=${encodeURIComponent(item.id)}`);
          if (!txtRes.ok) {
            txtRes = await fetch('/data/book_text.json');
          }
          if (txtRes.ok) {
            const txtData = await txtRes.json();
            if (txtData.success) {
              textContent = txtData.text || null;
              pages = txtData.pages || null;
            }
          }
        } catch (e) {
          console.warn('Word text extraction cache failed:', e);
        }
      } else if (fmt === 'txt') {
        textContent = await blob.text();
      }

      await saveOfflineItem({
        id: item.id,
        title: item.title,
        fileName: item.fileName,
        type: item.type,
        format: item.format,
        size: item.size,
        blob: blob,
        textContent: textContent,
        pages: pages,
        downloadedAt: new Date().toLocaleString()
      });

      await refreshDownloadedCache();
      showToast(`✅ '${item.title}' 다운로드 완료! (${downloadedIds.size}/${MAX_OFFLINE_DOWNLOADS}권) 와이파이 없이 이용 가능합니다.`);
      renderLibrary();
    } catch (err) {
      showToast(`❌ 다운로드 실패: ${err.message}`);
    }
  }

  async function removeDownloadedBook(item, e) {
    if (e) e.stopPropagation();

    if (!confirm(`'${item.title}' 오프라인 다운로드 파일을 삭제하시겠습니까?\n삭제하시면 다운로드 가능 한도(5권)가 1권 확보됩니다.`)) {
      return;
    }

    await deleteOfflineItem(item.id);
    await refreshDownloadedCache();
    showToast(`🗑️ '${item.title}' 다운로드 파일이 삭제되었습니다.`);
    renderLibrary();
  }

  // ==========================================================================
  // MEMBERSHIP TIER & AD ACCESS GATEKEEPER
  // ==========================================================================

  async function requestAccess(item, onApproved) {
    const online = isNetworkAvailable();
    const isDownloaded = downloadedIds.has(item.id);

    // Rule 1: Offline (No Wi-Fi)
    if (!online) {
      if (!isDownloaded) {
        showToast('📵 와이파이가 없습니다. 다운로드한 도서만 이용할 수 있습니다.');
        return;
      }
      // If downloaded, allow offline access!
      const offlineRecord = await getOfflineItem(item.id);
      onApproved(item, offlineRecord);
      return;
    }

    // Rule 2: Online - Check Tier
    const tier = window.BookPlayerAuth ? window.BookPlayerAuth.getTier() : 'free';

    // 2-A: Free Tier -> Completely forbidden for both ebooks and audiobooks
    if (tier === 'free') {
      if (freeBlockModal) {
        freeBlockModal.style.display = 'flex';
        freeBlockModal.classList.add('open');
      }
      showToast('🔒 무료 회원은 도서 읽기 및 오디오북 감상이 제한됩니다. PRO 또는 프리미엄 등급으로 변경해 주세요.');
      return;
    }

    // 2-B: PRO Tier -> Can read & listen, but MUST watch ad
    if (tier === 'pro') {
      showProAdModal(async () => {
        const offlineRecord = isDownloaded ? await getOfflineItem(item.id) : null;
        onApproved(item, offlineRecord);
      });
      return;
    }

    // 2-C: Premium Tier -> No ads, full access!
    const offlineRecord = isDownloaded ? await getOfflineItem(item.id) : null;
    onApproved(item, offlineRecord);
  }

  async function showProAdModal(onFinish) {
    if (!proAdModal) {
      onFinish();
      return;
    }

    let globalActive = true;
    let rotationMode = 'sequence';
    let adsList = [];

    try {
      // 1. Fetch server ad settings first if possible
      let data = null;
      let res;
      try { res = await fetch('/api/ad'); } catch (e) {}
      if (!res || !res.ok) {
        res = await fetch('/data/ad.json').catch(() => null);
      }
      if (res && res.ok) {
        data = await res.json().catch(() => null);
      }

      // 2. Check local storage static override (instant sync from Studio)
      const localMulti = localStorage.getItem('bw_static_ads');
      const localSingle = localStorage.getItem('bw_static_ad');
      if (localMulti) {
        try {
          const parsed = JSON.parse(localMulti);
          if (parsed && Array.isArray(parsed.ads) && parsed.ads.length > 0) {
            data = parsed;
          }
        } catch (e) {}
      }

      if (data) {
        if (typeof data.active === 'boolean') {
          globalActive = data.active;
        }
        if (data.rotationMode) {
          rotationMode = data.rotationMode;
        }
        if (Array.isArray(data.ads) && data.ads.length > 0) {
          adsList = data.ads;
        } else if (data.ad || data.title) {
          adsList = [data.ad || data];
        }
      } else if (localSingle) {
        try {
          const s = JSON.parse(localSingle);
          if (s && s.title) adsList = [s];
        } catch (e) {}
      }
    } catch (e) {
      console.log('Ad fetch error:', e);
    }

    // If global ads are turned off by Operator/Studio, grant immediate access
    if (globalActive === false) {
      onFinish();
      return;
    }

    // Filter only active ads
    const activeAds = adsList.filter(a => a && a.active !== false);

    // If no active ads configured, grant immediate access
    if (activeAds.length === 0) {
      onFinish();
      return;
    }

    // Select ad according to rotation mode: sequence or random
    let chosenAd = activeAds[0];
    if (activeAds.length > 1) {
      if (rotationMode === 'random') {
        const randIdx = Math.floor(Math.random() * activeAds.length);
        chosenAd = activeAds[randIdx];
      } else {
        // 'sequence': cycle sequentially on each modal trigger
        let lastIdx = parseInt(sessionStorage.getItem('bw_ad_seq_index') || '-1', 10);
        let nextIdx = (lastIdx + 1) % activeAds.length;
        sessionStorage.setItem('bw_ad_seq_index', nextIdx.toString());
        chosenAd = activeAds[nextIdx];
      }
    }

    const ad = chosenAd || {
      title: "북웨이브 프리미엄 멤버십",
      sponsor: "bookwave official",
      message: "지금 프리미엄으로 업그레이드하고 광고 없이 쾌적하게 무제한으로 감상하세요!",
      skipSeconds: 5
    };

    if (adModalSponsor) adModalSponsor.textContent = ad.sponsor || 'SPONSOR';
    if (adModalTitle) adModalTitle.textContent = ad.title || '광고 제목';
    if (adModalMessage) adModalMessage.textContent = ad.message || '광고 문구입니다.';

    // Ad Image rendering
    if (ad.imageUrl) {
      if (adModalImage) adModalImage.src = ad.imageUrl;
      if (adModalImageContainer) {
        adModalImageContainer.style.display = 'block';
        if (ad.linkUrl && ad.linkUrl !== '#') {
          adModalImageContainer.style.cursor = 'pointer';
          adModalImageContainer.title = '링크 열기';
          adModalImageContainer.onclick = () => window.open(ad.linkUrl, '_blank');
        } else {
          adModalImageContainer.style.cursor = 'default';
          adModalImageContainer.title = '';
          adModalImageContainer.onclick = null;
        }
      }
      if (adModalDefaultIcon) adModalDefaultIcon.style.display = 'none';
    } else {
      if (adModalImageContainer) adModalImageContainer.style.display = 'none';
      if (adModalDefaultIcon) adModalDefaultIcon.style.display = 'block';
    }

    let remaining = parseInt(ad.skipSeconds, 10) || 5;
    if (adCountdownBadge) adCountdownBadge.textContent = `⏱️ ${remaining}초 후 시작`;
    if (adBtnText) adBtnText.textContent = `광고 시청 중... (${remaining}초)`;
    if (btnAdSkip) {
      btnAdSkip.disabled = true;
      btnAdSkip.style.opacity = '0.6';
      btnAdSkip.style.cursor = 'not-allowed';
    }

    proAdModal.style.display = 'flex';
    proAdModal.classList.add('open');

    if (activeAdTimer) clearInterval(activeAdTimer);
    activeAdTimer = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        if (adCountdownBadge) adCountdownBadge.textContent = `⏱️ ${remaining}초 후 시작`;
        if (adBtnText) adBtnText.textContent = `광고 시청 중... (${remaining}초)`;
      } else {
        clearInterval(activeAdTimer);
        activeAdTimer = null;
        if (adCountdownBadge) adCountdownBadge.textContent = '✨ 시청 완료';
        if (adBtnText) adBtnText.textContent = '닫고 도서 시작 ▶';
        if (btnAdSkip) {
          btnAdSkip.disabled = false;
          btnAdSkip.style.opacity = '1';
          btnAdSkip.style.cursor = 'pointer';
          btnAdSkip.onclick = () => {
            proAdModal.style.display = 'none';
            proAdModal.classList.remove('open');
            onFinish();
          };
        }
      }
    }, 1000);
  }

  // --- Load Library Items from Server ---
  async function loadLibrary() {
    try {
      let res;
      try {
        res = await fetch('/api/items');
      } catch (e) {}
      if (!res || !res.ok) {
        res = await fetch('/data/items.json');
      }
      if (!res.ok) throw new Error('서버 응답 오류');
      const data = await res.json();
      libraryItems = data.items || [];
      renderLibrary();
      setupHeroBanner();
    } catch (err) {
      console.error('라이브러리 로드 실패:', err);
      // If offline, still render offline books from IndexedDB
      renderLibrary();
    }
  }

  // --- Render Home Screen Tier & Membership Info ---
  function renderHomeScreenTier() {
    const tier = window.BookPlayerAuth ? window.BookPlayerAuth.getTier() : 'free';
    const user = window.BookPlayerAuth ? window.BookPlayerAuth.getUser() : null;

    if (bannerUserName) {
      bannerUserName.textContent = user ? `${user.name || user.username}님` : '북웨이브 회원님';
    }

    if (btnGoOffline) {
      btnGoOffline.style.display = tier === 'premium' ? 'inline-flex' : 'none';
    }

    if (tier === 'premium') {
      if (cardTierIcon) cardTierIcon.textContent = '👑';
      if (cardTierTitle) cardTierTitle.textContent = '프리미엄 5권 오프라인 소장';
      if (cardTierDesc) cardTierDesc.textContent = '와이파이가 없어도 끊김 없는 독서! 도서 5권을 기기에 직접 다운로드하여 언제 어디서나 자유롭게 감상하세요.';
      if (btnCardNavTierText) btnCardNavTierText.textContent = '다운로드 보관함 가기';
      if (bannerTierIcon) bannerTierIcon.textContent = '👑';
      if (bannerTierBadge) {
        bannerTierBadge.textContent = '프리미엄';
        bannerTierBadge.style.background = 'rgba(255, 107, 0, 0.2)';
        bannerTierBadge.style.color = 'var(--welaaa-orange)';
        bannerTierBadge.style.border = '1px solid rgba(255, 107, 0, 0.4)';
      }
      if (bannerTierBenefit) {
        bannerTierBenefit.innerHTML = '✨ 모든 도서 광고 없이 즉시 열람 및 <strong>최대 5권 오프라인 다운로드</strong> 이용이 가능합니다.';
      }
    } else if (tier === 'pro') {
      if (cardTierIcon) cardTierIcon.textContent = '⚡';
      if (cardTierTitle) cardTierTitle.textContent = 'PRO 회원 무제한 스트리밍';
      if (cardTierDesc) cardTierDesc.textContent = '짧은 스폰서 광고 시청 후 모든 완독 오디오북과 양면 전자책을 무제한으로 스트리밍 감상하세요.';
      if (btnCardNavTierText) btnCardNavTierText.textContent = '오디오북 서재 가기';
      if (bannerTierIcon) bannerTierIcon.textContent = '⚡';
      if (bannerTierBadge) {
        bannerTierBadge.textContent = 'PRO';
        bannerTierBadge.style.background = 'rgba(2, 132, 199, 0.2)';
        bannerTierBadge.style.color = '#0284c7';
        bannerTierBadge.style.border = '1px solid rgba(2, 132, 199, 0.4)';
      }
      if (bannerTierBenefit) {
        bannerTierBenefit.innerHTML = '⚡ 스폰서 광고 시청 후 오디오북 및 전자책 전 도서를 무제한으로 스트리밍 감상하실 수 있습니다.';
      }
    } else {
      // free
      if (cardTierIcon) cardTierIcon.textContent = '🏷️';
      if (cardTierTitle) cardTierTitle.textContent = '북웨이브 회원 서비스 둘러보기';
      if (cardTierDesc) cardTierDesc.textContent = '북웨이브에 등록된 다채로운 오디오북과 전자책 컬렉션 목록을 자유롭게 둘러보실 수 있습니다.';
      if (btnCardNavTierText) btnCardNavTierText.textContent = '전자책 서재 가기';
      if (bannerTierIcon) bannerTierIcon.textContent = '👤';
      if (bannerTierBadge) {
        bannerTierBadge.textContent = '무료';
        bannerTierBadge.style.background = 'rgba(148, 163, 184, 0.2)';
        bannerTierBadge.style.color = '#94a3b8';
        bannerTierBadge.style.border = '1px solid rgba(148, 163, 184, 0.4)';
      }
      if (bannerTierBenefit) {
        bannerTierBenefit.innerHTML = '💡 현재 무료 회원입니다. 도서 감상을 원하시면 PRO 또는 프리미엄 등급으로 변경해 주세요.';
      }
    }
  }

  // --- Switch Navigation Tab ---
  function switchNavTab(filter) {
    currentNavFilter = filter;
    searchQuery = '';
    if (searchInput) searchInput.value = '';

    document.querySelectorAll('.welaaa-nav-item').forEach(btn => {
      const bFilter = btn.getAttribute('data-filter');
      btn.classList.toggle('active', bFilter === filter);
    });

    renderLibrary();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  window.switchNavTab = switchNavTab;
  window.showAll = () => switchNavTab('all');

  // --- Render Library Sections ---
  async function renderLibrary() {
    const isOnline = isNetworkAvailable();
    const offlineList = await getOfflineItems();
    const tier = window.BookPlayerAuth ? window.BookPlayerAuth.getTier() : 'free';

    // 1. Manage Navigation Tab Visibility: Download tab is ONLY visible to Premium
    if (navOfflineTab) {
      navOfflineTab.style.display = (tier === 'premium') ? 'inline-flex' : 'none';
    }
    if (navOfflineCount) {
      navOfflineCount.textContent = `${offlineList.length}/${MAX_OFFLINE_DOWNLOADS}`;
    }

    // 2. Offline Notice Banner Text: Free & PRO never see download explanations
    if (offlineNoticeBanner && offlineNoticeText) {
      if (tier === 'premium') {
        offlineNoticeText.textContent = '📵 현재 오프라인(와이파이 없음) 상태입니다. 다운로드한 도서(최대 5권)만 와이파이 없이 이용 가능하며, 그 외 도서는 이용이 차단됩니다.';
      } else {
        offlineNoticeText.textContent = '📵 현재 오프라인 상태입니다. 원활한 도서 이용을 위해 와이파이 또는 네트워크를 연결해 주세요.';
      }
    }

    // 3. User Requirement 1: "홈에는 북웨이브 화면을 넣고 책은 아무것도 넣지 마"
    if (currentNavFilter === 'all' && !searchQuery.trim()) {
      if (homeBookwaveScreen) homeBookwaveScreen.style.display = 'block';
      if (sectionContinue) sectionContinue.style.display = 'none';
      if (sectionAudio) sectionAudio.style.display = 'none';
      if (sectionEbooks) sectionEbooks.style.display = 'none';
      if (sectionOffline) sectionOffline.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';

      renderHomeScreenTier();
      return;
    }

    // When NOT in Home (or searching), hide the Home Screen
    if (homeBookwaveScreen) homeBookwaveScreen.style.display = 'none';
    if (sectionContinue) sectionContinue.style.display = 'none';

    // 4. Offline Downloads Tab (Premium Only)
    if (currentNavFilter === 'offline') {
      if (tier !== 'premium') {
        switchNavTab('all');
        return;
      }

      if (sectionAudio) sectionAudio.style.display = 'none';
      if (sectionEbooks) sectionEbooks.style.display = 'none';
      if (sectionOffline) sectionOffline.style.display = 'block';

      if (gridOffline) {
        gridOffline.innerHTML = '';
        if (offlineList.length === 0) {
          gridOffline.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 60px 20px; text-align: center; color: var(--text-muted);">
              <div style="font-size: 2.6rem; margin-bottom: 12px;">📥</div>
              <h4 style="color: var(--text-primary); margin-bottom: 6px;">다운로드한 도서가 없습니다</h4>
              <p style="font-size: 0.85rem;">프리미엄 회원은 최대 5권까지 도서를 다운로드하여 와이파이 없이 이용할 수 있습니다.</p>
            </div>
          `;
          if (emptyState) emptyState.style.display = 'none';
        } else {
          if (emptyState) emptyState.style.display = 'none';
          offlineList.forEach(item => {
            gridOffline.appendChild(createWelaaaCard(item, { isDownloaded: true, isOfflineView: true }));
          });
        }
      }
      return;
    }

    // 5. Standard Filter Logic for Audiobooks and eBooks
    let itemsToFilter = libraryItems;
    if (!isOnline && libraryItems.length === 0) {
      itemsToFilter = (tier === 'premium') ? offlineList : [];
    }

    const filterFn = (item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.fileName.toLowerCase().includes(q);
      }
      return true;
    };

    if (sectionOffline) sectionOffline.style.display = 'none';

    // A. Audiobooks Tab
    if (currentNavFilter === 'audiobook') {
      const audioItems = itemsToFilter.filter(i => i.type === 'audiobook' && filterFn(i));
      if (sectionAudio) sectionAudio.style.display = 'block';
      if (sectionEbooks) sectionEbooks.style.display = 'none';
      if (gridAudiobooks) {
        gridAudiobooks.innerHTML = '';
        if (audioItems.length === 0) {
          if (emptyState) emptyState.style.display = 'block';
        } else {
          if (emptyState) emptyState.style.display = 'none';
          audioItems.forEach((item, index) => {
            gridAudiobooks.appendChild(createWelaaaCard(item, { rank: index + 1 }));
          });
        }
      }
      return;
    }

    // B. eBooks Tab
    if (currentNavFilter === 'ebook') {
      const ebookItems = itemsToFilter.filter(i => i.type === 'ebook' && filterFn(i));
      if (sectionAudio) sectionAudio.style.display = 'none';
      if (sectionEbooks) sectionEbooks.style.display = 'block';
      if (gridEbooks) {
        gridEbooks.innerHTML = '';
        if (ebookItems.length === 0) {
          if (emptyState) emptyState.style.display = 'block';
        } else {
          if (emptyState) emptyState.style.display = 'none';
          ebookItems.forEach(item => {
            gridEbooks.appendChild(createWelaaaCard(item, {}));
          });
        }
      }
      return;
    }

    // C. Search Query Mode (shows both audiobooks and ebooks matching search)
    if (searchQuery.trim()) {
      const audioItems = itemsToFilter.filter(i => i.type === 'audiobook' && filterFn(i));
      const ebookItems = itemsToFilter.filter(i => i.type === 'ebook' && filterFn(i));

      if (audioItems.length > 0) {
        if (sectionAudio) sectionAudio.style.display = 'block';
        if (gridAudiobooks) {
          gridAudiobooks.innerHTML = '';
          audioItems.forEach((item, index) => {
            gridAudiobooks.appendChild(createWelaaaCard(item, { rank: index + 1 }));
          });
        }
      } else {
        if (sectionAudio) sectionAudio.style.display = 'none';
      }

      if (ebookItems.length > 0) {
        if (sectionEbooks) sectionEbooks.style.display = 'block';
        if (gridEbooks) {
          gridEbooks.innerHTML = '';
          ebookItems.forEach(item => {
            gridEbooks.appendChild(createWelaaaCard(item, {}));
          });
        }
      } else {
        if (sectionEbooks) sectionEbooks.style.display = 'none';
      }

      if (audioItems.length === 0 && ebookItems.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
      } else {
        if (emptyState) emptyState.style.display = 'none';
      }
      return;
    }
  }

  window.renderLibrary = renderLibrary;

  // --- Create Welaaa Card ---
  function createWelaaaCard(item, opts = {}) {
    const card = document.createElement('div');
    const isAudio = item.type === 'audiobook';
    const isOnline = isNetworkAvailable();
    const isDownloaded = downloadedIds.has(item.id);
    const tier = window.BookPlayerAuth ? window.BookPlayerAuth.getTier() : 'free';

    const isLockedOffline = !isOnline && !isDownloaded;

    card.className = `welaaa-card ${isAudio ? 'audio-type' : 'ebook-type'} ${isLockedOffline ? 'offline-locked' : ''}`;

    const format = (item.format || '').toUpperCase();
    const coverEmoji = isAudio ? '🎧' : (format === 'PDF' ? '📕' : (format === 'EPUB' ? '📗' : '📖'));

    // Badges
    let rankBadgeHtml = opts.rank ? `<div class="rank-badge">${opts.rank}</div>` : '';
    let typeBadgeHtml = isAudio 
      ? `<span class="welaaa-badge welaaa-audio">오디오북</span>`
      : `<span class="welaaa-badge welaaa-ebook">전자책</span>`;

    // Downloaded status pill - ONLY FOR PREMIUM!
    let downloadPillHtml = (tier === 'premium' && isDownloaded)
      ? `<span class="downloaded-pill">✓ 다운로드됨</span>` 
      : '';

    // Offline lock overlay
    let lockOverlayHtml = isLockedOffline ? `
      <div class="offline-lock-overlay">
        <span style="font-size: 1.4rem;">📵</span>
        <span>와이파이 없음</span>
        <span style="font-size: 0.7rem; font-weight: normal; opacity: 0.85;">
          ${tier === 'premium' ? '다운로드 도서만 이용 가능' : '네트워크 연결이 필요합니다'}
        </span>
      </div>
    ` : '';

    // Action buttons: Free gets Reading/Listening forbidden with Lock, PRO gets Read/Listen + Share, Premium gets Read/Listen + Share + Download!
    let actionButtonsHtml = '';
    if (tier === 'free') {
      actionButtonsHtml = `
        <div class="card-action-bar">
          <button class="btn welaaa-card-btn btn-open-act btn-locked-free" style="flex: 1.2; background: rgba(239, 68, 68, 0.12); color: #f87171; border-color: rgba(239, 68, 68, 0.3);" title="무료 회원 이용 불가 (PRO/프리미엄 전용)">
            <span>🔒 ${isAudio ? '듣기 제한' : '읽기 제한'}</span>
          </button>
          <button class="btn-card-action btn-card-share" title="도서 스마트 공유 (다른 와이파이/외부 지원)">
            <span>🔗 공유</span>
          </button>
        </div>
      `;
    } else if (tier === 'pro') {
      actionButtonsHtml = `
        <div class="card-action-bar">
          <button class="btn welaaa-card-btn btn-open-act" style="flex: 1.2;" title="${isAudio ? '광고 시청 후 오디오북 듣기' : '광고 시청 후 전자책 읽기'}">
            <span>${isAudio ? '▶ 듣기' : '📖 읽기'}</span>
          </button>
          <button class="btn-card-action btn-card-share" title="도서 스마트 공유 (다른 와이파이/외부 지원)">
            <span>🔗 공유</span>
          </button>
        </div>
      `;
    } else {
      // Premium Tier
      if (isDownloaded) {
        actionButtonsHtml = `
          <div class="card-action-bar">
            <button class="btn welaaa-card-btn btn-open-act" style="flex: 1.2;">
              <span>${isAudio ? '▶ 듣기' : '📖 읽기'}</span>
            </button>
            <button class="btn-card-action btn-card-share" title="도서 스마트 공유 (다른 와이파이/외부 지원)">
              <span>🔗 공유</span>
            </button>
            <button class="btn-card-action btn-card-delete-dl btn-del-act" title="다운로드 삭제">
              <span>🗑️</span>
            </button>
          </div>
        `;
      } else {
        actionButtonsHtml = `
          <div class="card-action-bar">
            <button class="btn welaaa-card-btn btn-open-act" style="flex: 1.2;">
              <span>${isAudio ? '▶ 듣기' : '📖 읽기'}</span>
            </button>
            <button class="btn-card-action btn-card-share" title="도서 스마트 공유 (다른 와이파이/외부 지원)">
              <span>🔗 공유</span>
            </button>
            <button class="btn-card-action btn-card-download btn-dl-act" title="오프라인 다운로드 (최대 5권)">
              <span>📥 다운</span>
            </button>
          </div>
        `;
      }
    }

    // Meta: Free & PRO never see download descriptions
    let metaSubHtml = (tier === 'premium')
      ? `<span>${isAudio ? '완독 오디오' : '양면 전자책'} · 오프라인 지원</span>`
      : `<span>${isAudio ? '전문 성우 완독' : '양면 펼침 전자책'}</span>`;

    // Progress Bar (if reading/listening progress exists)
    let progressHtml = (item.progress && item.progress > 0) ? `
      <div class="card-progress-wrap">
        <div class="card-progress-bar">
          <div class="card-progress-fill" style="width: ${Math.min(100, item.progress)}%;"></div>
        </div>
        <div class="card-progress-text">
          <span>진도율</span>
          <span>${item.progress}%</span>
        </div>
      </div>
    ` : '';

    card.innerHTML = `
      ${lockOverlayHtml}
      <div class="welaaa-card-cover">
        <div class="card-spine-shadow"></div>
        ${rankBadgeHtml}
        <div class="card-top-badges">
          ${typeBadgeHtml}
          <span class="welaaa-badge fmt">${format}</span>
        </div>
        <span class="card-emoticon">${coverEmoji}</span>
      </div>
      <div class="welaaa-card-body">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; margin-bottom: 2px;">
          <h4 class="welaaa-card-title" title="${item.title}">${item.title}</h4>
          ${downloadPillHtml}
        </div>
        <div class="welaaa-card-meta">
          ${metaSubHtml}
          <span>${formatFileSize(item.size)}</span>
        </div>
        ${progressHtml}
        ${actionButtonsHtml}
      </div>
    `;

    // Click on Card or Open Button
    const openBtn = card.querySelector('.btn-open-act');
    const handleTrigger = () => {
      requestAccess(item, (approvedItem, offlineRecord) => {
        if (isAudio) {
          playAudio(approvedItem, offlineRecord);
        } else {
          openBook(approvedItem, offlineRecord);
        }
      });
    };

    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleTrigger();
      });
    }

    card.addEventListener('click', (e) => {
      // Ignore if user clicked on specific action buttons
      if (e.target.closest('.btn-card-action') || e.target.closest('.btn-open-act')) {
        return;
      }
      handleTrigger();
    });

    // Share Listener - Only opens share modal when explicitly clicking share button
    const shareBtn = card.querySelector('.btn-card-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openShareModal(item);
      });
    }

    // Download & Delete Listeners
    const dlBtn = card.querySelector('.btn-dl-act');
    if (dlBtn) {
      dlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        downloadBook(item, e);
      });
    }

    const delDlBtn = card.querySelector('.btn-del-act');
    if (delDlBtn) {
      delDlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeDownloadedBook(item, e);
      });
    }

    const lockOverlay = card.querySelector('.offline-lock-overlay');
    if (lockOverlay) {
      lockOverlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showToast('📵 와이파이가 없습니다. 다운로드한 도서만 이용할 수 있습니다.');
      });
    }

    return card;
  }

  // ==========================================================================
  // PHYSICAL TWO-PAGE SPREAD BOOK READER ENGINE
  // ==========================================================================

  async function openBook(item, offlineRecord) {
    [shareModal, openShareCodeModal, downloadLimitModal, proAdModal, freeBlockModal].forEach(m => {
      if (m) {
        m.style.display = 'none';
        m.classList.remove('open');
      }
    });

    activeBookItem = item;
    readerBookTitle.textContent = item.title;
    readerModal.classList.add('open');
    readerModal.className = `reader-modal physical-book-reader open ${bookTheme}`;

    // Restore reading progress from server if logged in
    if (item.initialSpreadIndex === undefined) {
      const currentUser = window.BookPlayerAuth ? window.BookPlayerAuth.getUser() : null;
      if (currentUser && currentUser.username) {
        try {
          const progRes = await fetch(`/api/user/progress?username=${encodeURIComponent(currentUser.username)}&itemId=${encodeURIComponent(item.id)}`);
          if (progRes.ok) {
            const progData = await progRes.json();
            if (progData.found && progData.progress && progData.progress.spreadIndex !== undefined) {
              item._targetSpreadIndex = progData.progress.spreadIndex;
            }
          }
        } catch (e) {
          console.log('Error fetching book progress:', e);
        }
      }
    }

    const fmt = item.format.toLowerCase();

    if (fmt === 'docx' || fmt === 'doc' || fmt === 'txt') {
      txtControls.style.display = 'flex';
      fontSizeDisplay.textContent = bookFontSize;
      bookStage.innerHTML = '<div style="color: #cbd5e1; padding: 40px; font-size: 1.1rem;">책을 펼치는 중...</div>';

      try {
        currentBookDocxPages = null;
        totalDocxPages = 0;

        if (offlineRecord && offlineRecord.pages && offlineRecord.pages.length > 0) {
          currentBookDocxPages = offlineRecord.pages;
          rawBookText = offlineRecord.textContent || '';
        } else if (fmt === 'docx' || fmt === 'doc') {
          let res;
          try {
            res = await fetch(`/api/book-text?id=${encodeURIComponent(item.id)}`);
          } catch (e) {}
          if (!res || !res.ok) {
            try {
              res = await fetch('/data/book_text.json');
            } catch (e) {}
          }
          if (!res || !res.ok) throw new Error('Word 전자책 본문을 불러올 수 없습니다.');
          const data = await res.json();
          if (data.pages && Array.isArray(data.pages) && data.pages.length > 0) {
            currentBookDocxPages = data.pages;
          }
          rawBookText = data.text || '본문 내용이 비어있습니다.';
        } else {
          if (offlineRecord && offlineRecord.blob) {
            rawBookText = await offlineRecord.blob.text();
          } else {
            const res = await fetch(item.url);
            rawBookText = await res.text();
          }
        }

        if (currentBookDocxPages && currentBookDocxPages.length > 0) {
          buildDocxBookSpreads(currentBookDocxPages, item);
        } else {
          buildPhysicalBookSpreads(rawBookText, item);
        }
      } catch (e) {
        bookStage.innerHTML = `<div style="color: #ef4444; padding: 40px;">도서를 불러오지 못했습니다: ${e.message}</div>`;
      }
    } else if (fmt === 'pdf') {
      txtControls.style.display = 'none';
      btnPrevSpread.style.display = 'none';
      btnNextSpread.style.display = 'none';
      spreadIndicator.textContent = "PDF 뷰어";

      let pdfUrl = item.url;
      if (offlineRecord && offlineRecord.blob) {
        pdfUrl = URL.createObjectURL(offlineRecord.blob);
      }

      bookStage.innerHTML = `
        <div class="pdf-container">
          <iframe src="${pdfUrl}#toolbar=1" title="${item.title}"></iframe>
        </div>
      `;
    } else if (fmt === 'epub') {
      txtControls.style.display = 'none';
      btnPrevSpread.style.display = 'none';
      btnNextSpread.style.display = 'none';
      spreadIndicator.textContent = "EPUB 뷰어";
      renderEpubViewer(item, offlineRecord);
    }
  }

  // --- Construct 1:1 Word Document Spreads ---
  function buildDocxBookSpreads(pages, item, keepIndex = null) {
    btnPrevSpread.style.display = 'flex';
    btnNextSpread.style.display = 'flex';

    totalDocxPages = pages.length;
    bookSpreads = [];

    // Pair Word pages 1:1 into 2-page spreads
    for (let i = 0; i < pages.length; i += 2) {
      const leftPage = pages[i];
      const rightPage = (i + 1 < pages.length) ? pages[i + 1] : { isEnd: true };

      bookSpreads.push({
        isDocx: true,
        type: 'spread',
        left: leftPage,
        right: rightPage
      });
    }

    let targetIdx = 0;
    if (keepIndex !== null && keepIndex !== undefined) {
      targetIdx = Math.min(keepIndex, bookSpreads.length - 1);
    } else if (item && item.initialSpreadIndex !== undefined) {
      targetIdx = item.initialSpreadIndex;
    } else if (item && item._targetSpreadIndex !== undefined) {
      targetIdx = item._targetSpreadIndex;
    }

    if (targetIdx >= 0 && targetIdx < bookSpreads.length) {
      currentSpreadIndex = targetIdx;
    } else {
      currentSpreadIndex = 0;
    }
    if (item) {
      delete item.initialSpreadIndex;
      delete item._targetSpreadIndex;
    }
    renderCurrentSpread();
  }

  // --- Paginate Text & Construct Real Book Spreads ---
  function buildPhysicalBookSpreads(text, item, keepIndex = null) {
    btnPrevSpread.style.display = 'flex';
    btnNextSpread.style.display = 'flex';

    const baseCharsPerPage = Math.max(260, Math.floor(460 * (15 / bookFontSize)));
    const pages = paginateTextSmartly(text, baseCharsPerPage);

    bookSpreads = [];

    // 1. Front Cover (Spread 0)
    bookSpreads.push({
      type: 'cover',
      title: item.title,
      author: '북웨이브 도서'
    });

    // 2. Body Spreads (Left & Right pairs)
    const totalBodyPages = pages.length;
    for (let i = 0; i < totalBodyPages; i += 2) {
      const leftPageNum = i + 2;
      const rightPageNum = i + 3;
      const leftText = pages[i] || '';
      const rightText = (i + 1 < totalBodyPages) ? pages[i + 1] : '';

      bookSpreads.push({
        type: 'spread',
        left: { pageNum: leftPageNum, text: leftText },
        right: { pageNum: rightPageNum, text: rightText }
      });
    }

    // 3. Back Cover (Spread Last)
    bookSpreads.push({
      type: 'back',
      title: item.title
    });

    let targetIdx = 0;
    if (keepIndex !== null && keepIndex !== undefined) {
      targetIdx = Math.min(keepIndex, bookSpreads.length - 1);
    } else if (item && item.initialSpreadIndex !== undefined) {
      targetIdx = item.initialSpreadIndex;
    } else if (item && item._targetSpreadIndex !== undefined) {
      targetIdx = item._targetSpreadIndex;
    }

    if (targetIdx >= 0 && targetIdx < bookSpreads.length) {
      currentSpreadIndex = targetIdx;
    } else {
      currentSpreadIndex = 0;
    }
    if (item) {
      delete item.initialSpreadIndex;
      delete item._targetSpreadIndex;
    }
    renderCurrentSpread();
  }

  function paginateTextSmartly(text, targetChars) {
    const rawParagraphs = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n\n+/);
    const pages = [];
    let currentPage = '';

    rawParagraphs.forEach(para => {
      const trimmed = para.trim();
      if (!trimmed) return;

      if ((currentPage.length + trimmed.length) < targetChars) {
        currentPage += (currentPage ? '\n\n' : '') + trimmed;
      } else {
        if (currentPage) {
          pages.push(currentPage);
          currentPage = '';
        }

        if (trimmed.length > targetChars) {
          let remainder = trimmed;
          while (remainder.length > targetChars) {
            let splitIndex = remainder.lastIndexOf('.', targetChars);
            if (splitIndex === -1 || splitIndex < targetChars * 0.4) {
              splitIndex = remainder.lastIndexOf(' ', targetChars);
            }
            if (splitIndex === -1) splitIndex = targetChars;

            pages.push(remainder.substring(0, splitIndex + 1).trim());
            remainder = remainder.substring(splitIndex + 1).trim();
          }
          currentPage = remainder;
        } else {
          currentPage = trimmed;
        }
      }
    });

    if (currentPage.trim()) {
      pages.push(currentPage.trim());
    }

    return pages.length > 0 ? pages : ['내용이 비어있습니다.'];
  }

  // --- Render Spread ---
  function renderCurrentSpread() {
    if (!bookSpreads || bookSpreads.length === 0) return;
    const spread = bookSpreads[currentSpreadIndex];
    const totalSpreads = bookSpreads.length;

    bookStage.innerHTML = '';

    // 1:1 Word Document Spread Rendering
    if (spread.isDocx) {
      const leftPageNum = spread.left.pageNumber;
      const rightPageNum = spread.right && !spread.right.isEnd ? spread.right.pageNumber : null;
      const totalPages = totalDocxPages;

      if (rightPageNum) {
        spreadIndicator.textContent = `${leftPageNum} - ${rightPageNum} / ${totalPages} 쪽 (${currentSpreadIndex + 1} / ${totalSpreads} 펼침)`;
      } else {
        spreadIndicator.textContent = `${leftPageNum} / ${totalPages} 쪽 (${currentSpreadIndex + 1} / ${totalSpreads} 펼침)`;
      }

      const spreadWrap = document.createElement('div');
      spreadWrap.className = 'book-spread-two';

      // Left Page
      const leftPage = document.createElement('div');
      leftPage.className = 'book-page page-left';
      leftPage.innerHTML = `
        <div class="page-inner-content" style="font-size: ${bookFontSize}px;">
          ${spread.left.html || escapeHtml(spread.left.text).replace(/\n/g, '<br>')}
        </div>
        <div class="page-number-footer">${leftPageNum} 쪽</div>
      `;
      leftPage.onclick = () => prevSpread();

      // Center Spine Divider
      const spineDiv = document.createElement('div');
      spineDiv.className = 'book-spine-divider';

      // Right Page
      const rightPage = document.createElement('div');
      rightPage.className = 'book-page page-right';
      if (spread.right && !spread.right.isEnd) {
        rightPage.innerHTML = `
          <div class="page-inner-content" style="font-size: ${bookFontSize}px;">
            ${spread.right.html || escapeHtml(spread.right.text).replace(/\n/g, '<br>')}
          </div>
          <div class="page-number-footer">${rightPageNum} 쪽</div>
        `;
        rightPage.onclick = () => nextSpread();
      } else {
        rightPage.innerHTML = `
          <div class="page-inner-content book-end-page">
            <div style="font-size: 2.8rem; margin-bottom: 12px;">🌊</div>
            <h3 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 6px; color: inherit;">${escapeHtml(activeBookItem ? activeBookItem.title : '전자책')}</h3>
            <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 24px;">모든 본문(${totalPages}쪽)을 완독하였습니다!</p>
            <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 220px;">
              <button class="btn-open-first-page btn-restart-act" style="width: 100%; justify-content: center;">
                <span>🔄 처음부터 다시 읽기</span>
              </button>
              <button class="btn btn-secondary btn-back-act" style="width: 100%; justify-content: center; padding: 10px; border-radius: 9999px;">
                <span>← 서재로 돌아가기</span>
              </button>
            </div>
          </div>
          <div class="page-number-footer" style="justify-content: flex-end; color: #10b981; font-weight: 700;">완독</div>
        `;
        const btnRestart = rightPage.querySelector('.btn-restart-act');
        if (btnRestart) {
          btnRestart.addEventListener('click', (e) => {
            e.stopPropagation();
            currentSpreadIndex = 0;
            renderCurrentSpread();
          });
        }
        const btnBack = rightPage.querySelector('.btn-back-act');
        if (btnBack) {
          btnBack.addEventListener('click', (e) => {
            e.stopPropagation();
            window.closeReader();
          });
        }
      }

      spreadWrap.appendChild(leftPage);
      spreadWrap.appendChild(spineDiv);
      spreadWrap.appendChild(rightPage);
      bookStage.appendChild(spreadWrap);

      btnPrevSpread.disabled = (currentSpreadIndex === 0);
      btnNextSpread.disabled = (currentSpreadIndex === totalSpreads - 1);
      return;
    }

    if (spread.type === 'cover') {
      spreadIndicator.textContent = `앞표지 (1 / ${totalSpreads} 장)`;
      const coverEl = document.createElement('div');
      coverEl.className = 'book-cover-single';
      coverEl.innerHTML = `
        <div class="cover-emboss">
          <div class="cover-ornament">◆ BOOKWAVE CLASSICS ◆</div>
          <div class="cover-title-main">${escapeHtml(spread.title)}</div>
          <div class="cover-author-sub">${escapeHtml(spread.author)}</div>
          <button class="btn-open-first-page" id="btnCoverStartRead" style="margin-top: 24px;">
            <span>📖 책 펼쳐 읽기 ▶</span>
          </button>
        </div>
      `;
      coverEl.onclick = () => nextSpread();
      const startBtn = coverEl.querySelector('#btnCoverStartRead');
      if (startBtn) {
        startBtn.onclick = (e) => {
          e.stopPropagation();
          nextSpread();
        };
      }
      bookStage.appendChild(coverEl);

    } else if (spread.type === 'spread') {
      spreadIndicator.textContent = `${currentSpreadIndex * 2} - ${currentSpreadIndex * 2 + 1} 쪽 (${currentSpreadIndex + 1} / ${totalSpreads} 장)`;

      const spreadWrap = document.createElement('div');
      spreadWrap.className = 'book-spread-two';

      // Left Page
      const leftPage = document.createElement('div');
      leftPage.className = 'book-page page-left';
      leftPage.innerHTML = `
        <div class="page-inner-content" style="font-size: ${bookFontSize}px;">
          ${escapeHtml(spread.left.text).replace(/\n/g, '<br>')}
        </div>
        <div class="page-number-footer">${spread.left.pageNum}</div>
      `;
      leftPage.onclick = () => prevSpread();

      // Center Spine Divider
      const spineDiv = document.createElement('div');
      spineDiv.className = 'book-spine-divider';

      // Right Page
      const rightPage = document.createElement('div');
      rightPage.className = 'book-page page-right';
      rightPage.innerHTML = `
        <div class="page-inner-content" style="font-size: ${bookFontSize}px;">
          ${escapeHtml(spread.right.text).replace(/\n/g, '<br>')}
        </div>
        <div class="page-number-footer">${spread.right.text ? spread.right.pageNum : ''}</div>
      `;
      rightPage.onclick = () => nextSpread();

      spreadWrap.appendChild(leftPage);
      spreadWrap.appendChild(spineDiv);
      spreadWrap.appendChild(rightPage);
      bookStage.appendChild(spreadWrap);

    } else if (spread.type === 'back') {
      spreadIndicator.textContent = `뒤표지 (완독)`;
      const backEl = document.createElement('div');
      backEl.className = 'book-back-single';
      backEl.innerHTML = `
        <div class="back-single-inner">
          <div style="font-size: 2.8rem; margin-bottom: 8px;">🌊</div>
          <h3 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 6px; color: #ffffff;">${escapeHtml(spread.title)}</h3>
          <p style="font-size: 0.88rem; color: #94a3b8; margin-bottom: 22px;">완독을 축하합니다!</p>
          <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 240px;">
            <button class="btn-open-first-page btn-restart-act" style="width: 100%; justify-content: center;">
              <span>🔄 처음부터 다시 읽기</span>
            </button>
            <button class="btn btn-secondary btn-back-act" style="width: 100%; justify-content: center; padding: 10px; border-radius: 9999px;">
              <span>← 서재로 돌아가기</span>
            </button>
          </div>
        </div>
      `;
      const btnRestart = backEl.querySelector('.btn-restart-act');
      if (btnRestart) {
        btnRestart.addEventListener('click', (e) => {
          e.stopPropagation();
          currentSpreadIndex = 0;
          renderCurrentSpread();
        });
      }
      const btnBack = backEl.querySelector('.btn-back-act');
      if (btnBack) {
        btnBack.addEventListener('click', (e) => {
          e.stopPropagation();
          window.closeReader();
        });
      }
      bookStage.appendChild(backEl);
    }

    btnPrevSpread.disabled = (currentSpreadIndex === 0);
    btnNextSpread.disabled = (currentSpreadIndex === totalSpreads - 1);
  }

  function prevSpread() {
    if (currentSpreadIndex > 0) {
      currentSpreadIndex--;
      renderCurrentSpread();
      if (activeBookItem) {
        saveBookProgressToServer(activeBookItem, currentSpreadIndex);
      }
    }
  }

  function nextSpread() {
    if (currentSpreadIndex < bookSpreads.length - 1) {
      currentSpreadIndex++;
      renderCurrentSpread();
      if (activeBookItem) {
        saveBookProgressToServer(activeBookItem, currentSpreadIndex);
      }
    }
  }

  // --- EPUB Viewer ---
  function renderEpubViewer(item, offlineRecord) {
    bookStage.innerHTML = '<div id="epubViewerArea" style="width: 100%; height: 100%;"></div>';
    if (typeof ePub !== 'undefined') {
      try {
        let epubUrl = item.url;
        if (offlineRecord && offlineRecord.blob) {
          epubUrl = URL.createObjectURL(offlineRecord.blob);
        }
        const book = ePub(epubUrl);
        const rendition = book.renderTo("epubViewerArea", { width: "100%", height: "100%" });
        rendition.display();
      } catch (err) {
        bookStage.innerHTML = `<div style="padding: 40px; color: #ef4444;">EPUB 로딩 오류: ${err.message}</div>`;
      }
    }
  }

  window.closeReader = function () {
    if (activeBookItem && currentSpreadIndex !== undefined) {
      saveBookProgressToServer(activeBookItem, currentSpreadIndex);
    }
    readerModal.classList.remove('open');
    bookStage.innerHTML = '';
  };

  // ==========================================================================
  // AUDIO PLAYER
  // ==========================================================================

  async function playAudio(item, offlineRecord) {
    [shareModal, openShareCodeModal, downloadLimitModal, proAdModal, freeBlockModal].forEach(m => {
      if (m) {
        m.style.display = 'none';
        m.classList.remove('open');
      }
    });

    activeAudioItem = item;
    audioPlayerBar.classList.add('active');

    playerTitle.textContent = item.title;
    playerSubtitle.textContent = `북웨이브 완독본 • ${item.format.toUpperCase()} • ${formatFileSize(item.size)}`;

    // Check server progress if logged in
    const currentUser = window.BookPlayerAuth ? window.BookPlayerAuth.getUser() : null;
    let serverProgressTime = null;
    if (currentUser && currentUser.username) {
      try {
        const progRes = await fetch(`/api/user/progress?username=${encodeURIComponent(currentUser.username)}&itemId=${encodeURIComponent(item.id)}`);
        if (progRes.ok) {
          const progData = await progRes.json();
          if (progData.found && progData.progress && progData.progress.currentTime !== undefined) {
            serverProgressTime = progData.progress.currentTime;
          }
        }
      } catch (e) {
        console.log('Error fetching audio progress:', e);
      }
    }

    let targetSrc = item.url;
    if (offlineRecord && offlineRecord.blob) {
      targetSrc = URL.createObjectURL(offlineRecord.blob);
    }

    if (audioElement.src !== targetSrc) {
      audioElement.src = targetSrc;
      audioElement.playbackRate = parseFloat(speedSelect.value);

      audioElement.onloadedmetadata = () => {
        durationLabel.textContent = formatTime(audioElement.duration);
        audioTimeline.max = audioElement.duration || 100;

        const resumeTime = (serverProgressTime !== null && serverProgressTime > 0) ? serverProgressTime : item.progress;
        if (resumeTime && resumeTime > 0 && resumeTime < (audioElement.duration - 2)) {
          audioElement.currentTime = resumeTime;
        }
        audioElement.play().catch(e => console.log('Autoplay:', e));
      };
    } else {
      if (serverProgressTime !== null && serverProgressTime > 0 && Math.abs(audioElement.currentTime - serverProgressTime) > 3) {
        audioElement.currentTime = serverProgressTime;
      }
      audioElement.play();
    }
  }

  function togglePlayPause() {
    if (!audioElement.src) return;
    if (audioElement.paused) {
      audioElement.play();
    } else {
      audioElement.pause();
    }
  }

  function seekRelative(seconds) {
    if (!audioElement.duration) return;
    audioElement.currentTime = Math.max(0, Math.min(audioElement.duration, audioElement.currentTime + seconds));
  }

  // ==========================================================================
  // UTILITIES & EVENT BINDINGS
  // ==========================================================================
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

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  let toastTimer = null;
  function showToast(message) {
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }
  window.showToast = showToast;

  function setBookTheme(t) {
    bookTheme = t;
    localStorage.setItem('bp_book_theme', t);
    if (readerModal) {
      readerModal.className = `reader-modal physical-book-reader open ${t}`;
    }
  }

  function bindEvents() {
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

    // Logo Click -> Switch to Home
    if (logoBtn) {
      logoBtn.addEventListener('click', () => switchNavTab('all'));
    }

    // Home Screen Action Buttons & Full Card Clicks
    if (btnGoAudiobooks) btnGoAudiobooks.addEventListener('click', () => switchNavTab('audiobook'));
    if (btnGoEbooks) btnGoEbooks.addEventListener('click', () => switchNavTab('ebook'));
    if (btnGoOffline) btnGoOffline.addEventListener('click', () => switchNavTab('offline'));
    if (btnCardNavAudio) btnCardNavAudio.addEventListener('click', () => switchNavTab('audiobook'));
    if (btnCardNavEbook) btnCardNavEbook.addEventListener('click', () => switchNavTab('ebook'));

    const cardNavAudio = document.getElementById('cardNavAudio');
    if (cardNavAudio) cardNavAudio.addEventListener('click', () => switchNavTab('audiobook'));

    const cardNavEbook = document.getElementById('cardNavEbook');
    if (cardNavEbook) cardNavEbook.addEventListener('click', () => switchNavTab('ebook'));

    const cardTierHighlight = document.getElementById('cardTierHighlight');
    if (cardTierHighlight) cardTierHighlight.addEventListener('click', () => switchNavTab('audiobook'));

    if (btnCardNavTier) {
      btnCardNavTier.addEventListener('click', (e) => {
        e.stopPropagation();
        const curTier = window.BookPlayerAuth ? window.BookPlayerAuth.getTier() : 'free';
        if (curTier === 'free') {
          switchNavTab('ebook');
        } else if (curTier === 'premium') {
          switchNavTab('offline');
        } else {
          switchNavTab('audiobook');
        }
      });
    }
    if (btnBannerAction) {
      btnBannerAction.addEventListener('click', () => {
        const curTier = window.BookPlayerAuth ? window.BookPlayerAuth.getTier() : 'free';
        if (curTier === 'free') {
          switchNavTab('ebook');
        } else if (curTier === 'premium') {
          switchNavTab('offline');
        } else {
          switchNavTab('audiobook');
        }
      });
    }

    // Wi-Fi Status Simulator Toggle
    if (btnWifiToggle) {
      btnWifiToggle.addEventListener('click', () => {
        isSimulatedOffline = !isSimulatedOffline;
        showToast(isSimulatedOffline ? '📵 와이파이 연결이 차단되었습니다 (오프라인 모드).' : '📶 와이파이가 정상 연결되었습니다 (온라인 모드).');
        updateNetworkStatusUI();
      });
    }

    window.addEventListener('online', updateNetworkStatusUI);
    window.addEventListener('offline', updateNetworkStatusUI);

    // Modal Close Listeners
    if (btnCloseFreeModal) {
      btnCloseFreeModal.addEventListener('click', () => {
        if (freeBlockModal) {
          freeBlockModal.style.display = 'none';
          freeBlockModal.classList.remove('open');
        }
      });
    }

    if (btnCloseLimitModal) {
      btnCloseLimitModal.addEventListener('click', () => {
        if (downloadLimitModal) {
          downloadLimitModal.style.display = 'none';
          downloadLimitModal.classList.remove('open');
        }
      });
    }

    const btnConfirmLimitModal = document.getElementById('btnConfirmLimitModal');
    if (btnConfirmLimitModal) {
      btnConfirmLimitModal.addEventListener('click', () => {
        if (downloadLimitModal) {
          downloadLimitModal.style.display = 'none';
          downloadLimitModal.classList.remove('open');
        }
      });
    }

    const btnGoOfflineFromModal = document.getElementById('btnGoOfflineFromModal');
    if (btnGoOfflineFromModal) {
      btnGoOfflineFromModal.addEventListener('click', () => {
        if (downloadLimitModal) {
          downloadLimitModal.style.display = 'none';
          downloadLimitModal.classList.remove('open');
        }
        switchNavTab('offline');
      });
    }

    const btnClearAllDownloads = document.getElementById('btnClearAllDownloads');
    if (btnClearAllDownloads) {
      btnClearAllDownloads.addEventListener('click', async () => {
        if (!confirm('다운로드 보관함의 모든 도서를 삭제하시겠습니까?\n삭제하시면 5권 다운로드 한도가 모두 초기화됩니다.')) return;
        await clearAllOfflineItems();
        await refreshDownloadedCache();
        renderLibrary();
        if (downloadLimitModal) {
          downloadLimitModal.style.display = 'none';
          downloadLimitModal.classList.remove('open');
        }
        showToast('🧹 다운로드 보관함이 초기화되었습니다 (0/5권).');
      });
    }

    const btnSectionClearAllDownloads = document.getElementById('btnSectionClearAllDownloads');
    if (btnSectionClearAllDownloads) {
      btnSectionClearAllDownloads.addEventListener('click', async () => {
        if (!confirm('다운로드 보관함의 모든 도서를 삭제하시겠습니까?\n삭제하시면 5권 다운로드 한도가 모두 초기화됩니다.')) return;
        await clearAllOfflineItems();
        await refreshDownloadedCache();
        renderLibrary();
        showToast('🧹 다운로드 보관함이 초기화되었습니다 (0/5권).');
      });
    }

    // Backdrop Click-to-Close for Modals
    [freeBlockModal, downloadLimitModal].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.style.display = 'none';
            modal.classList.remove('open');
          }
        });
      }
    });

    // Nav Tabs
    document.querySelectorAll('.welaaa-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter');
        switchNavTab(filter);
      });
    });

    // Search
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderLibrary();
      });
    }

    // Physical Book Navigation Buttons
    if (btnPrevSpread) btnPrevSpread.addEventListener('click', prevSpread);
    if (btnNextSpread) btnNextSpread.addEventListener('click', nextSpread);

    // Reader Themes
    if (btnThemeSepia) btnThemeSepia.addEventListener('click', () => setBookTheme('theme-sepia'));
    if (btnThemeDark) btnThemeDark.addEventListener('click', () => setBookTheme('theme-night'));
    if (btnThemeLight) btnThemeLight.addEventListener('click', () => setBookTheme(''));

    // Reader Return to Library & Close
    const btnReaderBack = document.getElementById('btnReaderBack');
    if (btnReaderBack) btnReaderBack.addEventListener('click', () => window.closeReader());

    const btnReaderClose = document.getElementById('btnReaderClose');
    if (btnReaderClose) btnReaderClose.addEventListener('click', () => window.closeReader());

    document.querySelectorAll('.btn-back-library').forEach(btn => {
      btn.addEventListener('click', () => window.closeReader());
    });

    // Keyboard Arrow Keys (Left / Right)
    window.addEventListener('keydown', (e) => {
      if (!readerModal.classList.contains('open')) return;
      if (e.key === 'ArrowLeft') {
        prevSpread();
      } else if (e.key === 'ArrowRight') {
        nextSpread();
      } else if (e.key === 'Escape') {
        window.closeReader();
      }
    });

    // Font Size Adjustment in Reader (Preserves reading position & gives feedback)
    if (btnFontSmaller) {
      btnFontSmaller.addEventListener('click', () => {
        if (bookFontSize > 12) {
          bookFontSize -= 1;
          localStorage.setItem('bp_book_font_size', bookFontSize);
          fontSizeDisplay.textContent = bookFontSize;
          if (currentBookDocxPages && currentBookDocxPages.length > 0) {
            renderCurrentSpread();
          } else if (rawBookText && activeBookItem) {
            buildPhysicalBookSpreads(rawBookText, activeBookItem, currentSpreadIndex);
          }
        } else {
          showToast('최소 글자 크기(12px)입니다.');
        }
      });
    }

    if (btnFontLarger) {
      btnFontLarger.addEventListener('click', () => {
        if (bookFontSize < 24) {
          bookFontSize += 1;
          localStorage.setItem('bp_book_font_size', bookFontSize);
          fontSizeDisplay.textContent = bookFontSize;
          if (currentBookDocxPages && currentBookDocxPages.length > 0) {
            renderCurrentSpread();
          } else if (rawBookText && activeBookItem) {
            buildPhysicalBookSpreads(rawBookText, activeBookItem, currentSpreadIndex);
          }
        } else {
          showToast('최대 글자 크기(24px)입니다.');
        }
      });
    }

    // Audio Player Controls
    if (btnPlayPause) btnPlayPause.addEventListener('click', togglePlayPause);
    if (btnBackward) btnBackward.addEventListener('click', () => seekRelative(-10));
    if (btnForward) btnForward.addEventListener('click', () => seekRelative(10));

    if (volumeIcon && audioElement && volumeSlider) {
      volumeIcon.addEventListener('click', () => {
        if (audioElement.volume > 0) {
          audioElement.dataset.lastVol = audioElement.volume;
          audioElement.volume = 0;
          volumeSlider.value = 0;
          volumeIcon.textContent = '🔇';
        } else {
          const lastVol = parseFloat(audioElement.dataset.lastVol || '1');
          audioElement.volume = lastVol;
          volumeSlider.value = lastVol;
          volumeIcon.textContent = '🔊';
        }
      });
      volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        audioElement.volume = val;
        volumeIcon.textContent = val === 0 ? '🔇' : (val < 0.5 ? '🔉' : '🔊');
      });
    }

    if (audioElement) {
      audioElement.addEventListener('play', () => {
        if (playIcon) playIcon.textContent = '⏸';
      });
      audioElement.addEventListener('pause', () => {
        if (playIcon) playIcon.textContent = '▶';
        if (activeAudioItem) {
          saveAudioProgressToServer(activeAudioItem);
        }
      });

      let lastAudioSaveTime = 0;
      audioElement.addEventListener('timeupdate', () => {
        if (!isScrubbing && audioTimeline) {
          audioTimeline.value = audioElement.currentTime;
          if (currentTimeLabel) currentTimeLabel.textContent = formatTime(audioElement.currentTime);
        }
        const now = Date.now();
        if (now - lastAudioSaveTime > 5000 && activeAudioItem) {
          lastAudioSaveTime = now;
          saveAudioProgressToServer(activeAudioItem);
        }
      });
    }

    if (audioTimeline) {
      audioTimeline.addEventListener('input', () => {
        isScrubbing = true;
        if (currentTimeLabel) currentTimeLabel.textContent = formatTime(parseFloat(audioTimeline.value));
      });
      audioTimeline.addEventListener('change', () => {
        isScrubbing = false;
        audioElement.currentTime = parseFloat(audioTimeline.value);
        if (activeAudioItem) {
          saveAudioProgressToServer(activeAudioItem);
        }
      });
    }

    if (speedSelect) {
      speedSelect.addEventListener('change', () => {
        audioElement.playbackRate = parseFloat(speedSelect.value);
      });
    }

    if (btnClosePlayer) {
      btnClosePlayer.addEventListener('click', () => {
        if (activeAudioItem) {
          saveAudioProgressToServer(activeAudioItem);
        }
        audioElement.pause();
        audioPlayerBar.classList.remove('active');
      });
    }

    // Share Modal & Share Code Listeners
    if (btnOpenShareCode) {
      btnOpenShareCode.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (inputOpenShareCode) inputOpenShareCode.value = '';
        if (openShareError) openShareError.style.display = 'none';
        if (openShareCodeModal) {
          openShareCodeModal.style.display = 'flex';
          openShareCodeModal.classList.add('open');
          setTimeout(() => {
            if (inputOpenShareCode) inputOpenShareCode.focus();
          }, 100);
        }
      });
    }

    if (btnCancelOpenShare) {
      btnCancelOpenShare.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (openShareCodeModal) {
          openShareCodeModal.style.display = 'none';
          openShareCodeModal.classList.remove('open');
        }
      });
    }

    if (btnSubmitOpenShare) {
      btnSubmitOpenShare.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (inputOpenShareCode) resolveAndOpenShareCode(inputOpenShareCode.value);
      });
    }

    if (inputOpenShareCode) {
      inputOpenShareCode.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          resolveAndOpenShareCode(inputOpenShareCode.value);
        }
      });
    }

    if (btnCloseShareModal) {
      btnCloseShareModal.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (shareModal) {
          shareModal.style.display = 'none';
          shareModal.classList.remove('open');
        }
      });
    }

    [shareModal, openShareCodeModal].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.style.display = 'none';
            modal.classList.remove('open');
          }
        });
      }
    });

    if (btnCopyShareCode) {
      btnCopyShareCode.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (shareCodeInput && shareCodeInput.value) {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(shareCodeInput.value);
            } else {
              shareCodeInput.select();
              document.execCommand('copy');
            }
            showToast('📋 6자리 공유 코드가 복사되었습니다!');
          } catch (err) {
            shareCodeInput.select();
            document.execCommand('copy');
            showToast('📋 6자리 공유 코드가 복사되었습니다!');
          }
        }
      });
    }

    if (btnCopyShareLink) {
      btnCopyShareLink.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (shareLinkInput && shareLinkInput.value) {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(shareLinkInput.value);
            } else {
              shareLinkInput.select();
              document.execCommand('copy');
            }
            showToast('🔗 공유 링크가 복사되었습니다!');
          } catch (err) {
            shareLinkInput.select();
            document.execCommand('copy');
            showToast('🔗 공유 링크가 복사되었습니다!');
          }
        }
      });
    }

    if (btnNativeShare) {
      btnNativeShare.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const linkVal = (shareLinkInput && shareLinkInput.value) ? shareLinkInput.value : '';
        if (!linkVal) return;
        if (navigator.share) {
          try {
            await navigator.share({
              title: shareItemTitle ? shareItemTitle.textContent : '북웨이브 도서 공유',
              text: `${shareItemTitle ? shareItemTitle.textContent : '도서'}를 북웨이브에서 바로 감상해보세요!`,
              url: linkVal
            });
            return;
          } catch (err) {
            if (err.name === 'AbortError') return;
          }
        }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(linkVal);
          } else {
            shareLinkInput.select();
            document.execCommand('copy');
          }
          showToast('🔗 공유 링크가 복사되었습니다!');
        } catch (err) {
          shareLinkInput.select();
          document.execCommand('copy');
          showToast('🔗 공유 링크가 복사되었습니다!');
        }
      });
    }

    if (btnReaderShare) {
      btnReaderShare.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeBookItem) {
          openShareModal(activeBookItem, currentSpreadIndex, null);
        } else {
          showToast('공유할 도서 정보를 찾을 수 없습니다.');
        }
      });
    }

    if (btnPlayerShare) {
      btnPlayerShare.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeAudioItem) {
          const curTime = (audioElement && audioElement.currentTime) ? audioElement.currentTime : 0;
          openShareModal(activeAudioItem, null, curTime);
        } else {
          showToast('재생 중인 오디오북 정보를 찾을 수 없습니다.');
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
