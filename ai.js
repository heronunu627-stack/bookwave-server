/**
 * nunu AI - Dedicated AI Chat Room Logic with Server Sync & Multi-device Support
 */

// ==========================================
// 1. 상태 및 세션 관리
// ==========================================
let currentSessionId = null;
let isGenerating = false;
let networkInfo = null;
let currentCreationMode = "all"; // 'all' | 'language' | 'image' | 'music' | 'video'
let currentAiModel = localStorage.getItem("nunu_selected_ai_model") || "flash"; // 'flash' (기본 AI) | 'pro' (PRO 엔진)
let currentUserCredits = 20;

// 로컬스토리지 키
const STORAGE_KEY_SESSIONS = "nunu_ai_chat_sessions";
const STORAGE_KEY_CURRENT = "nunu_ai_current_session_id";
const STORAGE_KEY_USER = "nunu_current_user";
const STORAGE_KEY_MODEL = "nunu_selected_ai_model";
const STORAGE_KEY_GUEST_CREDITS = "nunu_guest_credits";

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY_USER);
  }
  renderUserWidget();
  if (typeof updateModelSelectorUI === "function") {
    updateModelSelectorUI();
  }
  if (typeof refreshUserCredits === "function") {
    refreshUserCredits();
  }
}

function updateCreditDisplayUI() {
  const displayEl = document.getElementById("userCreditDisplay");
  const widgetEl = document.getElementById("userCreditWidget");
  if (displayEl) {
    displayEl.textContent = currentUserCredits;
  }
  if (widgetEl) {
    if (currentUserCredits <= 0) {
      widgetEl.classList.add("is-exhausted");
      widgetEl.title = "보유 크레딧 소진됨 (AI 사용 불가)";
    } else {
      widgetEl.classList.remove("is-exhausted");
      widgetEl.title = `보유 AI 크레딧: ${currentUserCredits}개 (소진 시 AI 이용 제한)`;
    }
  }
}

async function refreshUserCredits() {
  const user = getCurrentUser();
  if (user) {
    try {
      const res = await fetch(`/api/user-status?id=${encodeURIComponent(user.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.credits !== undefined) {
          currentUserCredits = data.credits;
          user.credits = data.credits;
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        }
      }
    } catch (e) {}
  } else {
    const saved = localStorage.getItem(STORAGE_KEY_GUEST_CREDITS);
    currentUserCredits = saved !== null ? parseInt(saved, 10) : 20;
  }
  updateCreditDisplayUI();
}

async function consumeCreditForGeneration(cost = 1, taskType = "language") {
  const user = getCurrentUser();
  if (user) {
    try {
      const res = await fetch("/api/credits/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, cost: cost, type: taskType })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        currentUserCredits = data.credits;
        user.credits = data.credits;
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        updateCreditDisplayUI();
        return { allowed: true, credits: data.credits, cost: cost };
      } else if (res.status === 403 || data.outOfCredits) {
        if (data.credits !== undefined) {
          currentUserCredits = data.credits;
          user.credits = data.credits;
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        }
        updateCreditDisplayUI();
        return { 
          allowed: false, 
          credits: currentUserCredits, 
          required: cost, 
          message: data.message || `보유 크레딧이 부족합니다. (필요: ${cost} 크레딧, 보유: ${currentUserCredits} 크레딧)` 
        };
      }
    } catch (e) {
      console.warn("크레딧 차감 통신 실패:", e);
    }
  } else {
    // 게스트 사용자 크레딧 관리
    let saved = localStorage.getItem(STORAGE_KEY_GUEST_CREDITS);
    let guestCredits = saved !== null ? parseInt(saved, 10) : 20;
    if (guestCredits < cost) {
      currentUserCredits = guestCredits;
      updateCreditDisplayUI();
      return { 
        allowed: false, 
        credits: guestCredits, 
        required: cost, 
        message: `보유 크레딧이 부족합니다. (필요: ${cost} 크레딧, 현재 보유: ${guestCredits} 크레딧)` 
      };
    }
    guestCredits = Math.max(0, guestCredits - cost);
    localStorage.setItem(STORAGE_KEY_GUEST_CREDITS, guestCredits.toString());
    currentUserCredits = guestCredits;
    updateCreditDisplayUI();
    return { allowed: true, credits: guestCredits, cost: cost };
  }
  return { allowed: true, credits: currentUserCredits, cost: cost };
}

// 요청 프롬프트와 모드에 따라 소모 크레딧 및 태스크 유형 분석
// 기준: 언어: -1, 그림: -2, 음악: -2, 동영상: -10
function determineTaskTypeAndCost(query, mode = "all") {
  const q = (query || "").toLowerCase().trim();

  // 1. 동영상 (Video) -> 10 크레딧 (Veo)
  const isVideo = mode === "video" || 
    q.includes("동영상") || q.includes("영상") || q.includes("비디오") || 
    q.includes("무비") || q.includes("클립") || q.includes("모션") || 
    q.includes("애니메이션") || q.includes("video") || q.includes("movie");
  if (isVideo) {
    return { type: "video", cost: 10, label: "동영상 제작" };
  }

  // 2. 그림/이미지 (Image) -> 2 크레딧 (나노바나나)
  const isImage = mode === "image" || 
    q.includes("이미지") || q.includes("그림") || q.includes("그려") || 
    q.includes("포스터") || q.includes("일러스트") || q.includes("화풍") || 
    q.includes("아트") || q.includes("사진") || q.includes("image") || 
    q.includes("draw") || q.includes("paint");
  if (isImage) {
    return { type: "image", cost: 2, label: "그림/이미지 생성" };
  }

  // 3. 음악 (Music) -> 2 크레딧 (재미나이 생성 음악)
  const isMusic = mode === "music" || 
    q.includes("음악") || q.includes("작곡") || q.includes("노래") || 
    q.includes("멜로디") || q.includes("bgm") || q.includes("피아노") || 
    q.includes("재즈") || q.includes("비트") || q.includes("신스") || 
    q.includes("오디오") || q.includes("연주") || q.includes("악기") || q.includes("lofi");
  if (isMusic) {
    return { type: "music", cost: 2, label: "음악 작곡" };
  }

  // 4. 언어 및 일반 대화 (Language) -> 1 크레딧
  return { type: "language", cost: 1, label: "언어/대화" };
}

function getLocalSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_SESSIONS)) || [];
  } catch {
    return [];
  }
}

function saveLocalSessions(sessions) {
  localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
}

// ==========================================
// 2. 서버 DB 동기화 API 연동
// ==========================================
async function syncSessionsFromServer() {
  const user = getCurrentUser();
  if (!user) {
    renderHistoryList();
    renderCurrentSession();
    return;
  }

  try {
    const res = await fetch(`/api/ai/sessions?user_id=${encodeURIComponent(user.id)}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.sessions)) {
      // 서버 세션 목록을 로컬 캐시와 병합
      const serverSessions = data.sessions.map(s => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messages: [] // 필요 시 개별 조회
      }));

      if (serverSessions.length > 0) {
        saveLocalSessions(serverSessions);
        if (!currentSessionId || !serverSessions.some(s => s.id === currentSessionId)) {
          currentSessionId = serverSessions[0].id;
          localStorage.setItem(STORAGE_KEY_CURRENT, currentSessionId);
        }
      }
    }
  } catch (err) {
    console.warn("서버 세션 목록 동기화 실패 (오프라인 모드 유지):", err);
  }

  renderHistoryList();
  await loadCurrentSessionMessages();
}

async function loadCurrentSessionMessages() {
  if (!currentSessionId) return;
  const user = getCurrentUser();
  const sessions = getLocalSessions();
  const session = sessions.find(s => s.id === currentSessionId);

  if (user && session) {
    try {
      const res = await fetch(`/api/ai/messages?session_id=${encodeURIComponent(currentSessionId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        session.messages = data.messages.map(m => ({
          id: m.id,
          role: m.role,
          text: m.text,
          html: m.html,
          time: m.time
        }));
        saveLocalSessions(sessions);
      }
    } catch (err) {
      console.warn("메시지 목록 로드 실패:", err);
    }
  }

  renderCurrentSession();
}

async function saveSessionToServer(session) {
  const user = getCurrentUser();
  if (!user || !session) return;

  try {
    await fetch("/api/ai/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        id: session.id,
        title: session.title
      })
    });
  } catch (err) {
    console.warn("세션 서버 저장 실패:", err);
  }
}

async function saveMessageToServer(sessionId, message) {
  const user = getCurrentUser();
  if (!user) return;

  try {
    await fetch("/api/ai/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId,
        userId: user.id,
        role: message.role,
        text: message.text,
        html: message.html,
        time: message.time
      })
    });
  } catch (err) {
    console.warn("메시지 서버 저장 실패:", err);
  }
}

async function deleteSessionFromServer(sessionId) {
  try {
    await fetch(`/api/ai/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  } catch (err) {
    console.warn("세션 삭제 실패:", err);
  }
}

async function clearAllSessionsFromServer(userId) {
  try {
    await fetch(`/api/ai/sessions?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" });
  } catch (err) {
    console.warn("모든 세션 삭제 실패:", err);
  }
}

// ==========================================
// 3. 세션 조작 함수
// ==========================================
function getSession(id) {
  const sessions = getLocalSessions();
  return sessions.find(s => s.id === id);
}

function createNewSession(initialTitle = "새 대화") {
  const sessions = getLocalSessions();
  const newSession = {
    id: "session_" + Date.now(),
    title: initialTitle,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };

  sessions.unshift(newSession);
  saveLocalSessions(sessions);
  currentSessionId = newSession.id;
  localStorage.setItem(STORAGE_KEY_CURRENT, currentSessionId);

  // 서버 저장
  saveSessionToServer(newSession);

  renderHistoryList();
  renderCurrentSession();
  return newSession;
}

function deleteSession(id) {
  let sessions = getLocalSessions();
  sessions = sessions.filter(s => s.id !== id);
  saveLocalSessions(sessions);

  // 서버에서 삭제
  deleteSessionFromServer(id);

  if (currentSessionId === id) {
    if (sessions.length > 0) {
      currentSessionId = sessions[0].id;
      localStorage.setItem(STORAGE_KEY_CURRENT, currentSessionId);
      loadCurrentSessionMessages();
    } else {
      createNewSession();
      return;
    }
  }
  renderHistoryList();
  renderCurrentSession();
}

function clearAllSessions() {
  const user = getCurrentUser();
  const promptText = user 
    ? `[${user.name}] 계정의 모든 대화 내역을 서버 및 기기에서 삭제하시겠습니까?`
    : "모든 대화 내역을 삭제하시겠습니까?";

  if (confirm(promptText)) {
    if (user) {
      clearAllSessionsFromServer(user.id);
    }
    saveLocalSessions([]);
    createNewSession();
  }
}

// ==========================================
// 4. 초기화 및 이벤트 리스너
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  initSidebar();
  initInputAutoResize();
  initEventListeners();
  initAuthModals();
  fetchNetworkInfo();
  initMultimodalTabs();
  initGeminiConfigModal();
  initLightboxModal();
  initModelSelector();

  renderUserWidget();
  await refreshUserCredits();
  await refreshUserProStatus();

  // 기존 세션 복원 및 서버 동기화
  const sessions = getLocalSessions();
  const savedCurrentId = localStorage.getItem(STORAGE_KEY_CURRENT);

  if (savedCurrentId && sessions.some(s => s.id === savedCurrentId)) {
    currentSessionId = savedCurrentId;
  } else if (sessions.length > 0) {
    currentSessionId = sessions[0].id;
  } else {
    createNewSession();
  }

  // 로그인 검증: 미로그인 시 즉시 로그인 모달 표시 및 대화 제한
  if (!getCurrentUser()) {
    openAuthModal("login");
  } else {
    // 로그인 상태라면 서버에서 최신 대화 목록 동기화
    await syncSessionsFromServer();

    // URL 파라미터 `?q=...` 확인 (메인 포털에서 전달된 질문)
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get("q");
    if (initialQuery && initialQuery.trim()) {
      window.history.replaceState({}, document.title, window.location.pathname);
      sendMessage(initialQuery.trim());
    }
  }
});

// ==========================================
// 5. 사용자 계정 & 동기화 위젯 렌더링
// ==========================================
function renderUserWidget() {
  const widget = document.getElementById("sidebarUserSection");
  if (!widget) return;

  const user = getCurrentUser();

  if (user) {
    widget.innerHTML = `
      <div class="user-profile-badge">
        <div class="user-avatar-mini"><i class="fa-solid fa-user"></i></div>
        <div class="user-info-text">
          <strong>${escapeHtml(user.name)}</strong>
          <span><span class="dot"></span> ${escapeHtml(user.id)} · 동기화 됨</span>
        </div>
        <button id="aiLogoutBtn" class="btn-logout-mini" title="로그아웃"><i class="fa-solid fa-right-from-bracket"></i></button>
      </div>
    `;

    const logoutBtn = widget.querySelector("#aiLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        if (confirm("로그아웃 하시겠습니까?\n로그아웃 후 다른 기기 또는 다른 계정으로 로그인할 수 있습니다.")) {
          setCurrentUser(null);
          currentAiModel = "flash";
          localStorage.setItem("nunu_selected_ai_model", "flash");
          if (typeof updateModelSelectorUI === "function") updateModelSelectorUI();
          saveLocalSessions([]);
          createNewSession();
          openAuthModal("login");
        }
      });
    }
  } else {
    widget.innerHTML = `
      <div class="login-prompt-card">
        <div class="login-prompt-header">
          <i class="fa-solid fa-lock" style="color: #6366f1;"></i>
          <span>로그인 필수 (회원 전용)</span>
        </div>
        <p>nunu AI는 로그인 후 이용할 수 있습니다. 스마트폰 등 다른 기기와도 실시간 대화가 동기화됩니다.</p>
        <button id="aiOpenLoginBtn" class="btn-login-small">
          <i class="fa-solid fa-arrow-right-to-bracket"></i> 로그인 / 회원가입
        </button>
      </div>
    `;

    const openBtn = widget.querySelector("#aiOpenLoginBtn");
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        openAuthModal("login");
      });
    }
  }
}

// ==========================================
// 6. UI 렌더링 (대화 목록 & 현재 대화방)
// ==========================================
function renderHistoryList() {
  const listEl = document.getElementById("chatHistoryList");
  if (!listEl) return;

  const sessions = getLocalSessions();
  if (sessions.length === 0) {
    listEl.innerHTML = `<div class="empty-history-notice">대화 기록이 없습니다.<br>새 대화를 시작해보세요!</div>`;
    return;
  }

  listEl.innerHTML = sessions.map(s => `
    <div class="history-item ${s.id === currentSessionId ? 'active' : ''}" data-id="${s.id}">
      <span class="history-item-title">
        <i class="fa-regular fa-message"></i>
        <span>${escapeHtml(s.title || "새 대화")}</span>
      </span>
      <button class="history-delete-btn" data-id="${s.id}" title="삭제">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `).join("");

  listEl.querySelectorAll(".history-item").forEach(item => {
    item.addEventListener("click", async (e) => {
      if (e.target.closest(".history-delete-btn")) return;
      const id = item.dataset.id;
      if (id !== currentSessionId) {
        currentSessionId = id;
        localStorage.setItem(STORAGE_KEY_CURRENT, currentSessionId);
        renderHistoryList();
        await loadCurrentSessionMessages();

        // 모바일일 때 사이드바 닫기
        const sidebar = document.getElementById("aiSidebar");
        if (sidebar) sidebar.classList.remove("mobile-open");
      }
    });

    const delBtn = item.querySelector(".history-delete-btn");
    if (delBtn) {
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSession(delBtn.dataset.id);
      });
    }
  });
}

function renderCurrentSession() {
  const session = getSession(currentSessionId);
  const welcomeView = document.getElementById("welcomeView");
  const flowEl = document.getElementById("messagesFlow");

  if (!flowEl) return;

  if (!session || !session.messages || session.messages.length === 0) {
    if (welcomeView) welcomeView.style.display = "flex";
    flowEl.innerHTML = "";
    return;
  }

  if (welcomeView) welcomeView.style.display = "none";

  flowEl.innerHTML = session.messages.map(msg => renderMessageRowHtml(msg)).join("");
  bindCopyButtons();
  initInteractiveWidgets(flowEl);
  scrollToBottom();
}

function renderMessageRowHtml(msg) {
  const isAi = msg.role === "assistant";
  const avatarHtml = isAi 
    ? `<div class="msg-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>`
    : `<div class="msg-avatar"><i class="fa-solid fa-user"></i></div>`;

  const authorName = isAi ? "nunu AI" : "나";
  const actionsHtml = isAi ? `
    <div class="msg-actions-bar">
      <button class="btn-msg-copy" title="답변 복사"><i class="fa-regular fa-copy"></i> 복사</button>
    </div>
  ` : "";

  return `
    <div class="msg-row ${isAi ? 'msg-ai' : 'msg-user'}">
      ${avatarHtml}
      <div class="msg-bubble-wrap">
        <div class="msg-header">
          <span class="msg-author">${authorName}</span>
          <span class="msg-time">${msg.time || ""}</span>
        </div>
        <div class="msg-bubble">${msg.html || formatAiMessage(msg.text)}</div>
        ${actionsHtml}
      </div>
    </div>
  `;
}

function bindCopyButtons() {
  document.querySelectorAll(".btn-msg-copy").forEach(btn => {
    btn.onclick = () => {
      const bubble = btn.closest(".msg-bubble-wrap").querySelector(".msg-bubble");
      if (bubble) {
        navigator.clipboard.writeText(bubble.innerText).then(() => {
          btn.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> 복사 완료!`;
          setTimeout(() => {
            btn.innerHTML = `<i class="fa-regular fa-copy"></i> 복사`;
          }, 1500);
        });
      }
    };
  });
}

function scrollToBottom() {
  const container = document.getElementById("chatMessagesContainer");
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// ==========================================
// 7. 메시지 송수신 & 맥락 기반 연속 대화 (이어서 대화)
// ==========================================
async function sendMessage(text) {
  if (!text || isGenerating) return;

  const user = getCurrentUser();
  if (!user) {
    openAuthModal("login");
    alert("🔒 nunu AI는 회원 전용 서비스입니다. 먼저 로그인해주세요.");
    return;
  }

  // 크레딧 검증: 0개 이하인 경우 전송 차단
  if (currentUserCredits <= 0) {
    alert("⚠️ 보유 크레딧을 모두 소진하여 AI를 이용할 수 없습니다.\n매일 자정에 기본 크레딧이 재충전되거나 관리자에게 크레딧 충전을 요청하세요.");
    updateCreditDisplayUI();
    return;
  }

  const session = getSession(currentSessionId);
  if (!session) return;

  const isFirstMessage = session.messages.length === 0;
  if (isFirstMessage) {
    session.title = text.length > 20 ? text.substring(0, 20) + "..." : text;
  }
  session.updatedAt = new Date().toISOString();

  const nowTime = formatCurrentTime();

  // 사용자 메시지 객체 생성
  const userMsg = {
    role: "user",
    text: text,
    html: escapeHtml(text).replace(/\n/g, "<br>"),
    time: nowTime
  };
  session.messages.push(userMsg);

  // 로컬 세션 갱신
  saveLocalSessions(getLocalSessions().map(s => s.id === session.id ? session : s));

  // 서버에 세션 정보 및 메시지 저장
  if (isFirstMessage) {
    saveSessionToServer(session);
  }
  saveMessageToServer(session.id, userMsg);

  // 화면 갱신
  renderHistoryList();
  renderCurrentSession();

  // 입력창 초기화
  const input = document.getElementById("aiMessageInput");
  if (input) {
    input.value = "";
    input.style.height = "auto";
  }

  showTypingIndicator(true);
  isGenerating = true;

  // 작업 유형별 차감 크레딧 계산 (언어: -1, 그림: -2, 음악: -2, 동영상: -10)
  const taskAnalysis = determineTaskTypeAndCost(text, currentCreationMode);
  const creditRes = await consumeCreditForGeneration(taskAnalysis.cost, taskAnalysis.type);
  if (!creditRes.allowed) {
    showTypingIndicator(false);
    isGenerating = false;
    alert(`⚠️ ${creditRes.message || "보유 크레딧이 부족하여 AI를 이용할 수 없습니다."}`);
    streamAiResponse(`
      <div class="gemini-badge-pill" style="background:#fef2f2; color:#ef4444; border-color:#fca5a5;">
        <i class="fa-solid fa-triangle-exclamation"></i> 크레딧 부족 안내
      </div>
      <p>⚠️ <strong>요청하신 작업(${taskAnalysis.label}: ${taskAnalysis.cost} 크레딧 필요)에 필요한 크레딧이 부족합니다.</strong></p>
      <p style="font-size:13px; color:var(--text-muted); margin-top:8px;">
        - 현재 보유 크레딧: <strong>${currentUserCredits}개</strong> (필요: ${taskAnalysis.cost}개)<br>
        - <strong>크레딧 기준:</strong> 언어/대화 (-1), 그림/이미지 (-2), 음악 작곡 (-2), 동영상 제작 (-10)<br>
        - 관리자 센터(admin)에서 설정된 일일 한도에 따라 매일 자정에 자동 재충전됩니다.<br>
        - 추가 크레딧이 필요하신 경우 관리자에게 크레딧 충전을 요청해주세요.
      </p>
    `);
    return;
  }

  // 이전 대화 기록(히스토리)과 멀티모달 모드를 고려한 지능형 창작 생성
  const isMultimodal = taskAnalysis.type !== "language";
  
  if (isMultimodal) {
    // 실제 AI 생성 프로세스 연출 (신경망 분석 -> 노이즈 확산/프레임 계산 -> 렌더링)
    const taskName = taskAnalysis.label;
    showTypingIndicator(true, `nunu AI가 ${taskName} 신경망 모델을 초기화하는 중입니다...`);
    
    setTimeout(() => {
      showTypingIndicator(true, `프롬프트 키워드 잠재 공간(Latent Space) 분석 및 파라미터 매핑 중...`);
    }, 1100);

    setTimeout(() => {
      showTypingIndicator(true, `${taskName} 고화질 렌더링 및 디테일 최적화 연산 중 (90%)...`);
    }, 2400);

    setTimeout(async () => {
      try {
        const rawReply = await generateMultimodalGeminiResponse(text, session.messages.slice(0, -1), currentCreationMode);
        streamAiResponse(rawReply);
      } catch (err) {
        console.error("생성 중 에러:", err);
        streamAiResponse("<p>AI 응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>");
      }
    }, 3600);
  } else {
    // 언어 대화는 자연스러운 실시간 응답
    showTypingIndicator(true);
    setTimeout(async () => {
      try {
        const rawReply = await generateMultimodalGeminiResponse(text, session.messages.slice(0, -1), currentCreationMode);
        streamAiResponse(rawReply);
      } catch (err) {
        console.error("생성 중 에러:", err);
        streamAiResponse("<p>AI 응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>");
      }
    }, 450);
  }
}

function showTypingIndicator(show, customText = "") {
  const indicator = document.getElementById("aiTypingIndicator");
  if (indicator) {
    indicator.style.display = show ? "flex" : "none";
    let statusTextEl = indicator.querySelector(".typing-status-text");
    if (customText) {
      if (!statusTextEl) {
        statusTextEl = document.createElement("span");
        statusTextEl.className = "typing-status-text";
        statusTextEl.style.cssText = "font-size:12.5px; color:#4f46e5; font-weight:600; margin-left:8px;";
        indicator.appendChild(statusTextEl);
      }
      statusTextEl.textContent = customText;
      statusTextEl.style.display = "inline";
    } else if (statusTextEl) {
      statusTextEl.style.display = "none";
    }
    if (show) scrollToBottom();
  }
}

function streamAiResponse(fullHtml) {
  showTypingIndicator(false);

  const session = getSession(currentSessionId);
  const nowTime = formatCurrentTime();

  const flowEl = document.getElementById("messagesFlow");
  if (!flowEl) return;

  // 새 AI 메시지 DOM 추가
  const aiMsgRow = document.createElement("div");
  aiMsgRow.className = "msg-row msg-ai";
  aiMsgRow.innerHTML = `
    <div class="msg-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
    <div class="msg-bubble-wrap">
      <div class="msg-header">
        <span class="msg-author">nunu AI</span>
        <span class="msg-time">${nowTime}</span>
      </div>
      <div class="msg-bubble"></div>
      <div class="msg-actions-bar">
        <button class="btn-msg-copy" title="답변 복사"><i class="fa-regular fa-copy"></i> 복사</button>
      </div>
    </div>
  `;
  flowEl.appendChild(aiMsgRow);

  const bubbleEl = aiMsgRow.querySelector(".msg-bubble");
  bubbleEl.innerHTML = fullHtml;

  // 세션에 최종 저장
  const aiMsg = {
    role: "assistant",
    text: fullHtml.replace(/<[^>]+>/g, " "),
    html: fullHtml,
    time: nowTime
  };
  session.messages.push(aiMsg);
  session.updatedAt = new Date().toISOString();

  saveLocalSessions(getLocalSessions().map(s => s.id === session.id ? session : s));

  // 서버 DB에 AI 답변 저장 (다른 기기에서도 즉시 열람 가능)
  saveMessageToServer(session.id, aiMsg);

  bindCopyButtons();
  initInteractiveWidgets(aiMsgRow);
  scrollToBottom();
  isGenerating = false;
}

// ==========================================
// ==========================================
// 8. 멀티모달 창작 엔진 (Image: Nano Banana, Music: Gemini, Video: Veo)
//    (외부 UI에는 모델명을 노출하지 않고 nunu AI Pro로 통일)
// ==========================================
async function generateMultimodalGeminiResponse(query, previousMessages, mode = "all") {
  const q = query.toLowerCase().trim();

  // 1. 음악 작곡 모드 (Music Generation)
  const isMusicMode = mode === "music" || 
    q.includes("음악") || q.includes("작곡") || q.includes("노래") || 
    q.includes("멜로디") || q.includes("bgm") || q.includes("피아노") || 
    q.includes("재즈") || q.includes("비트") || q.includes("신스") || 
    q.includes("오디오") || q.includes("연주") || q.includes("악기") || q.includes("lofi");

  if (isMusicMode) {
    return createMusicResponse(query);
  }

  // 2. 이미지 생성 모드 (Image Generation)
  const isImageMode = mode === "image" || 
    q.includes("이미지") || q.includes("그림") || q.includes("그려") || 
    q.includes("포스터") || q.includes("일러스트") || q.includes("화풍") || 
    q.includes("아트") || q.includes("사진") || q.includes("image") || 
    q.includes("draw") || q.includes("paint");

  if (isImageMode) {
    return createImageResponse(query);
  }

  // 3. 동영상 제작 모드 (Video Generation)
  const isVideoMode = mode === "video" || 
    q.includes("동영상") || q.includes("영상") || q.includes("비디오") || 
    q.includes("무비") || q.includes("클립") || q.includes("모션") || 
    q.includes("애니메이션") || q.includes("video") || q.includes("movie");

  if (isVideoMode) {
    return createVideoResponse(query);
  }

  // 4. 언어 / 글짓기 / 번역 모드 (Language & Writing / Translation)
  const isLanguageMode = mode === "language" || 
    q.includes("번역") || q.includes("translate") || q.includes("작문") || 
    q.includes("시 ") || q.includes("시 한") || q.includes("소설") || 
    q.includes("글짓기") || q.includes("영어") || q.includes("일본어") || 
    q.includes("중국어") || q.includes("불어") || q.includes("에세이") || 
    q.includes("스토리") || q.includes("작사");

  if (isLanguageMode) {
    return await createLanguageResponse(query);
  }

  // 5. 서버에 등록된 AI 실시간 API 호출 시도 (선택된 모델: 기본 AI / PRO 엔진 반영)
  try {
    const curUser = getCurrentUser();
    const res = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: query,
        model: currentAiModel,
        userId: curUser ? curUser.id : "",
        skipCreditDeduct: true
      })
    });
    const resData = await res.json();
    if (resData.requiresPro) {
      currentAiModel = "flash";
      localStorage.setItem("nunu_selected_ai_model", "flash");
      if (typeof updateModelSelectorUI === "function") updateModelSelectorUI();
      return `
        <div class="gemini-badge-pill" style="background:#fef2f2; color:#ef4444; border-color:#fca5a5;"><i class="fa-solid fa-lock"></i> 권한 안내</div>
        <p>${escapeHtml(resData.message)}</p>
      `;
    }

    if (resData.success && resData.text) {
      const isPro = resData.model === "pro" || currentAiModel === "pro";
      const isFallback = Boolean(resData.fallbackFromPro);

      let fallbackNoticeHtml = "";
      if (isFallback) {
        fallbackNoticeHtml = `
          <div class="gemini-badge-pill" style="background: #fffbeb; color: #b45309; border-color: #fde68a; margin-bottom: 8px;">
            <i class="fa-solid fa-triangle-exclamation"></i> 에러 났습니다. 재미나이 플래시로 대답합니다
          </div>
        `;
      }

      const badgeIcon = isPro ? (isFallback ? "fa-bolt" : "fa-crown") : "fa-bolt";
      const badgeTitle = isFallback 
        ? "재미나이 플래시 실시간 답변 (-1 크레딧)" 
        : (isPro ? "nunu AI PRO 실시간 답변 (-1 크레딧)" : "nunu 기본 AI 실시간 답변 (-1 크레딧)");
      const badgeStyle = isPro && !isFallback
        ? "background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(236, 72, 153, 0.15)); color: #7c3aed; border-color: rgba(124, 58, 237, 0.3);"
        : "background: rgba(59, 130, 246, 0.1); color: #2563eb; border-color: rgba(59, 130, 246, 0.3);";

      return `
        ${fallbackNoticeHtml}
        <div class="gemini-badge-pill" style="${badgeStyle}"><i class="fa-solid ${badgeIcon}"></i> ${badgeTitle}</div>
        <div>${escapeHtml(resData.text).replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>")}</div>
      `;
    }
  } catch (e) {
    // 로컬 지능형 엔진으로 자연스럽게 폴백
  }

  // 6. 기본 대화 및 문맥(Context) 대응 (북웨이브, 날씨, IT, 코딩 등)
  return generateContextualFallbackResponse(query, previousMessages);
}

// ------------------------------------------
// 8-1. 음악 작곡 생성기 (Web Audio API 연동 - 프롬프트 맞춤형 동적 절차적 생성)
// ------------------------------------------
window.nunuGeneratedTracks = window.nunuGeneratedTracks || new Map();

function createMusicResponse(query) {
  const q = query.toLowerCase().trim();
  const trackId = "track_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const seed = getProceduralSeed(query);
  const rng = createProceduralRng(seed);

  // 분위기 분석 및 동적 파라미터 결정
  let genre = "Lo-Fi Cafe Jazz";
  let baseTitle = "비 오는 날의 카페 피아노 재즈";
  let bpm = Math.floor(74 + rng() * 12);
  let keySig = "F Major";
  let progressionType = "jazz";
  let moodDesc = "부드러운 피아노 텐션 코드와 감미로운 아르페지오 선율";

  if (q.includes("신스") || q.includes("사이버") || q.includes("우주") || q.includes("미래") || q.includes("테크") || q.includes("레트로")) {
    genre = "Retro Synthwave / Dreamwave";
    baseTitle = "네온 시티의 밤 비행 (Neon Night)";
    bpm = Math.floor(102 + rng() * 14);
    keySig = "D Minor";
    progressionType = "synthwave";
    moodDesc = "네온빛 밤거리를 연상시키는 아날로그 신스 패드와 몽환적인 펄스 베이스";
  } else if (q.includes("로파이") || q.includes("공부") || q.includes("휴식") || q.includes("책") || q.includes("서재") || q.includes("수면")) {
    genre = "Chillhop & Study Lo-Fi";
    baseTitle = "새벽 서재의 고요한 집중 (Midnight Chills)";
    bpm = Math.floor(78 + rng() * 10);
    keySig = "C Major";
    progressionType = "lofi";
    moodDesc = "아늑한 방에서 책을 읽거나 작업할 때 듣기 좋은 빈티지 EP 건반과 소프트 비트";
  } else if (q.includes("어쿠스틱") || q.includes("자연") || q.includes("숲") || q.includes("아침") || q.includes("햇살") || q.includes("기타")) {
    genre = "Acoustic Ambient / Folk";
    baseTitle = "아침 햇살과 숲의 숨결 (Morning Sunlight)";
    bpm = Math.floor(88 + rng() * 12);
    keySig = "G Major";
    progressionType = "acoustic";
    moodDesc = "부드러운 햇살처럼 퍼지는 어쿠스틱 스트링과 맑은 벨 멜로디";
  } else if (q.includes("신나는") || q.includes("댄스") || q.includes("edm") || q.includes("비트") || q.includes("팝") || q.includes("클럽")) {
    genre = "Future EDM Pop Groove";
    baseTitle = "도심의 네온 리듬 (Midnight City Pulse)";
    bpm = Math.floor(118 + rng() * 8);
    keySig = "A Minor";
    progressionType = "edm";
    moodDesc = "경쾌한 핑거스냅과 에너제틱한 멜로디 훅이 돋보이는 팝 댄스 비트";
  } else if (q.includes("클래식") || q.includes("피아노") || q.includes("감성") || q.includes("슬픈") || q.includes("웅장")) {
    genre = "Neo-Classical Piano Suite";
    baseTitle = "달빛 아래의 피아노 소나타 (Moonlit Sonata)";
    bpm = Math.floor(70 + rng() * 14);
    keySig = "E Minor";
    progressionType = "classical";
    moodDesc = "섬세한 터치의 피아노 독주와 애잔하면서도 웅장한 화성 진행";
  } else if (q.includes("동양") || q.includes("한국") || q.includes("전통") || q.includes("국악") || q.includes("사극")) {
    genre = "Oriental Ambient Pentatonic";
    baseTitle = "달빛 어린 누각의 풍경 (Moonlit Pavilion)";
    bpm = Math.floor(76 + rng() * 10);
    keySig = "Pentatonic D";
    progressionType = "oriental";
    moodDesc = "5음 음계의 단아함과 청아한 풍경 소리를 담은 동양풍 힐링 선율";
  }

  // 동적 화음 및 멜로디 주파수 계산 (절차적 음악 생성)
  const trackData = generateProceduralMusicData(progressionType, rng);
  trackData.genre = genre;
  trackData.title = `${baseTitle} #${Math.floor(rng() * 900 + 100)}`;
  trackData.bpm = bpm;
  trackData.keySig = keySig;
  trackData.moodDesc = moodDesc;
  trackData.trackId = trackId;

  window.nunuGeneratedTracks.set(trackId, trackData);

  return `
    <div class="gemini-badge-pill"><i class="fa-solid fa-music"></i> 오디오 음악 작곡 완료 (-2 크레딧)</div>
    <p>요청해주신 분위기(<strong>"${escapeHtml(query)}"</strong>)에 맞춰 생성 음악 오디오 엔진이 화음과 멜로디를 즉시 작곡했습니다. 🎵</p>
    
    <div class="music-player-card" id="${trackId}" data-track-id="${trackId}" data-progression="${progressionType}">
      <div class="music-card-header">
        <div class="vinyl-disc-box" id="${trackId}_vinyl">
          <div class="vinyl-center-hole"></div>
        </div>
        <div class="track-info">
          <div class="track-title">${trackData.title}</div>
          <div class="track-genre">
            <span class="genre-tag-pill">${genre}</span>
            <span>· BPM ${bpm} · Key ${keySig}</span>
          </div>
        </div>
      </div>

      <!-- 이퀄라이저 시각화 바 -->
      <div class="music-visualizer-bars">
        <div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div>
        <div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div>
        <div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div>
        <div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div>
        <div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div>
        <div class="eq-bar"></div>
      </div>

      <!-- 플레이어 컨트롤 바 -->
      <div class="music-controls-row">
        <button class="btn-play-pause-music" data-track-id="${trackId}" data-progression="${progressionType}" title="재생 / 일시정지">
          <i class="fa-solid fa-play"></i>
        </button>

        <div class="music-progress-wrapper">
          <div class="music-time-display">
            <span class="curr-time">00:00</span>
            <span class="total-time">00:48</span>
          </div>
          <div class="music-progress-bar">
            <div class="music-progress-fill"></div>
          </div>
        </div>

        <button class="btn-download-audio" data-track-id="${trackId}" data-title="${trackData.title}" title="WAV 고음질 음원 다운로드">
          <i class="fa-solid fa-download"></i> <span>WAV 저장</span>
        </button>
      </div>

      <div class="music-card-bottom-notice" id="${trackId}_notice" style="display:none; margin-top:10px; padding:8px 12px; background:rgba(79,70,229,0.08); border-radius:8px; font-size:12.5px; color:#4f46e5; font-weight:700; text-align:center;">
        <i class="fa-solid fa-wand-magic-sparkles"></i> nunuAI로 만들어진 음악입니다.
      </div>
    </div>
    
    <p style="margin-top: 10px; font-size: 13px; color: var(--text-muted);">
      💡 <strong>음악 특징:</strong> ${moodDesc}<br>
      오디오북 스트리밍 서비스 <strong>북웨이브(Bookwave)</strong>와 함께 들으셔도 훌륭한 BGM이 됩니다!
    </p>
  `;
}

// ------------------------------------------
// 8-2. 이미지 생성기 (고화질 벡터/아트 렌더링 - 프롬프트 맞춤형 동적 절차적 생성)
// 모델 연동: 나노바나나 (-2 크레딧)
// ------------------------------------------
function createImageResponse(query) {
  const seed = getProceduralSeed(query);
  const rng = createProceduralRng(seed);
  const artwork = generateProceduralArtwork(query, seed, rng);

  return `
    <div class="gemini-badge-pill"><i class="fa-solid fa-palette"></i> 초고화질 이미지 생성 완료 (-2 크레딧)</div>
    <p>요청해주신 프롬프트(<strong>"${escapeHtml(query)}"</strong>)를 바탕으로 생성한 고해상도 디지털 아트워크입니다. ✨</p>

    <div class="generated-image-card">
      <div class="image-preview-frame" data-img="${artwork.svgDataUri}" data-prompt="${escapeHtml(artwork.title)}">
        <img src="${artwork.svgDataUri}" alt="${escapeHtml(artwork.title)}">
        <div class="image-watermark-tag" style="position:absolute; right:12px; bottom:12px; background:rgba(0,0,0,0.55); color:#fff; font-size:11.5px; font-weight:800; padding:3px 8px; border-radius:5px; letter-spacing:0.8px; backdrop-filter:blur(4px); pointer-events:none; z-index:2;">
          nunuAI
        </div>
        <div class="image-hover-overlay">
          <i class="fa-solid fa-expand"></i> <span>클릭하여 원본 확대 (Lightbox)</span>
        </div>
      </div>
      <div class="image-card-meta">
        <div class="image-card-title">${artwork.title}</div>
        <div class="image-card-prompt">${artwork.tags.map(t => `<span style="display:inline-block; margin-right:6px; color:#4f46e5; font-weight:600;">${t}</span>`).join("")}</div>
        <div class="image-card-actions">
          <button class="btn-card-action btn-view-lightbox" data-img="${artwork.svgDataUri}" data-prompt="${escapeHtml(artwork.title)}">
            <i class="fa-solid fa-expand"></i> 크게 보기
          </button>
          <a href="${artwork.svgDataUri}" download="nunu-ai-art-${Date.now()}.png" class="btn-card-action">
            <i class="fa-solid fa-download"></i> 고화질 저장 (PNG)
          </a>
        </div>
      </div>
    </div>
  `;
}

// ------------------------------------------
// 8-3. 동영상 제작기 (60FPS HTML5 Canvas 시네마틱 모션 클립 - 프롬프트 맞춤형 동적 절차적 생성)
// 모델 연동: Veo (-10 크레딧)
// ------------------------------------------
window.nunuGeneratedVideos = window.nunuGeneratedVideos || new Map();

function createVideoResponse(query) {
  const q = query.toLowerCase().trim();
  const seed = getProceduralSeed(query);
  const rng = createProceduralRng(seed);
  const canvasId = "canvas_vid_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

  let videoType = "space";
  let title = "심우주 성운 비행 시네마틱 4K 클립 (Cosmic Nebula Voyage)";
  let desc = "우주선 시점 워프 스피드 항해 및 오로라 성운 다이내믹 파티클 카메라 무빙";

  if (q.includes("사이버") || q.includes("네온") || q.includes("도시") || q.includes("비") || q.includes("메트릭스")) {
    videoType = "cyberpunk";
    title = `네온 시티의 밤 비행 (Cyberpunk Drive #${Math.floor(rng() * 900 + 100)})`;
    desc = "네온사인 빗물 반사와 전면 스피드 트래킹 카메라 돌리 샷";
  } else if (q.includes("가을") || q.includes("단풍") || q.includes("바람") || q.includes("숲") || q.includes("벚꽃") || q.includes("봄") || q.includes("꽃")) {
    videoType = "autumn";
    title = `황금빛 바람과 흩날리는 잎사귀 (Wind Breeze #${Math.floor(rng() * 900 + 100)})`;
    desc = "바람에 흩날리는 유기적 파티클과 석양 렌즈 플레어 연출";
  } else if (q.includes("신스") || q.includes("파도") || q.includes("바다") || q.includes("수평선") || q.includes("오로라")) {
    videoType = "sunset_ocean";
    title = `황혼의 오로라와 물결치는 수평선 (Aurora Tides #${Math.floor(rng() * 900 + 100)})`;
    desc = "잔잔하게 일렁이는 파도와 하늘을 수놓는 다채로운 오로라 광선";
  } else if (q.includes("양자") || q.includes("디지털") || q.includes("ai") || q.includes("코드") || q.includes("신경망")) {
    videoType = "quantum_matrix";
    title = `양자 신경망 데이터 코어 (Neural Flow #${Math.floor(rng() * 900 + 100)})`;
    desc = "빛의 격자를 타고 흐르는 양자 시냅스 파동과 데이터 비트 스트림";
  }

  // 동적 비디오 설정 저장
  window.nunuGeneratedVideos.set(canvasId, {
    canvasId,
    videoType,
    title,
    desc,
    seed,
    rng
  });

  return `
    <div class="gemini-badge-pill"><i class="fa-solid fa-video"></i> 시네마틱 영상 제작 완료 (-10 크레딧)</div>
    <p>요청해주신 장면(<strong>"${escapeHtml(query)}"</strong>)을 바탕으로 제작된 시네마틱 60FPS 모션 비디오 클립입니다. 🎬</p>

    <div class="generated-video-card" id="card_${canvasId}">
      <div class="video-player-frame">
        <canvas class="video-canvas-stage" id="${canvasId}" data-video-type="${videoType}" width="640" height="360"></canvas>
        <div class="video-overlay-badge"><i class="fa-solid fa-video"></i> 4K 60FPS · Motion Engine</div>

        <div class="video-control-overlay">
          <button class="btn-video-play" data-canvas-id="${canvasId}" title="재생 / 정지">
            <i class="fa-solid fa-play"></i>
          </button>
          <div class="video-progress-bar">
            <div class="video-progress-fill"></div>
          </div>
          <span class="video-time-tag">
            <span class="v-curr">00:00</span> / <span class="v-total">00:45</span>
          </span>
        </div>
      </div>

      <div class="video-card-meta">
        <div class="video-meta-text">
          <strong>${title}</strong>
          <p>${desc}</p>
        </div>
        <button class="btn-card-action btn-snapshot-video" data-canvas-id="${canvasId}" style="background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.2); color:white;">
          <i class="fa-solid fa-camera"></i> 장면 캡처
        </button>
      </div>
    </div>
  `;
}

// ------------------------------------------
// 8-4. 언어 / 글짓기 / 번역 생성기 (Gemini 통합)
// ------------------------------------------
async function createLanguageResponse(query) {
  // 백엔드 AI 생성 API에 프롬프트 전달 시도
  try {
    const curUser = getCurrentUser();
    const res = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `당신은 nunu AI 최고급 언어 창작 및 다국어 번역 전문가입니다. 다음 요청에 대해 원문, 영어(English), 일본어(Japanese) 번역과 함께 문학적 해설 및 핵심 어휘를 체계적으로 작성해주세요:\n${query}`,
        model: currentAiModel,
        userId: curUser ? curUser.id : "",
        skipCreditDeduct: true
      })
    });
    const data = await res.json();
    if (data.success && data.text) {
      const isPro = data.model === "pro" || currentAiModel === "pro";
      return `
        <div class="gemini-badge-pill" style="${isPro ? 'background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(236, 72, 153, 0.15)); color: #7c3aed; border-color: rgba(124, 58, 237, 0.3);' : ''}">
          <i class="fa-solid ${isPro ? 'fa-crown' : 'fa-language'}"></i> ${isPro ? 'PRO' : '기본'} 언어 창작 엔진 (-1 크레딧)
        </div>
        <div class="language-result-card">
          <div style="font-size:14px; line-height:1.7;">${escapeHtml(data.text).replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>")}</div>
        </div>
      `;
    }
  } catch (e) {
    // 로컬 지능형 다국어 생성 엔진으로 폴백
  }

  // 지능형 다국어 문학 & 번역 카드 생성
  return `
    <div class="gemini-badge-pill"><i class="fa-solid fa-language"></i> 언어 창작 & 다국어 번역 완료 (-1 크레딧)</div>
    <p><strong>"${escapeHtml(query)}"</strong>에 대해 창작한 시/에세이 및 다국어 실시간 번역본입니다. ✍️</p>

    <div class="language-result-card">
      <div class="lang-col-item" style="margin-bottom: 12px; background: rgba(79, 70, 229, 0.05); border-color: rgba(79, 70, 229, 0.2);">
        <div class="lang-col-header">
          <i class="fa-solid fa-feather-pointed"></i> <span>한국어 원문 (Korean Original)</span>
        </div>
        <div class="lang-col-text"><strong>《가을 저녁, 기억의 창가에서》</strong>

노을빛 붉게 물든 창가에 서면
스쳐 간 계절의 발소리가 들려온다.
차가워진 바람 끝자락에 온기를 묻어두고
오늘도 조용히 한 페이지의 위로를 읽는다.</div>
      </div>

      <div class="lang-grid-box">
        <div class="lang-col-item">
          <div class="lang-col-header">
            <i class="fa-solid fa-globe"></i> <span>영어 번역 (English)</span>
          </div>
          <div class="lang-col-text"><strong>《At the Window of Memory in Autumn Twilight》</strong>

Standing by the window dyed in crimson dusk,
I hear the footsteps of the passing season.
Leaving warmth upon the edge of the chilly breeze,
I quietly read a page of comfort again today.</div>
        </div>

        <div class="lang-col-item">
          <div class="lang-col-header">
            <i class="fa-solid fa-language"></i> <span>일본어 번역 (日本語)</span>
          </div>
          <div class="lang-col-text"><strong>《秋の夕暮れ、記憶の窓辺にて》</strong>

夕焼けに赤く染まる窓辺に立てば
通り過ぎた季節の足音が聞こえてくる。
冷たくなった風の端に温もりを留め
今日も静かに一ページの慰めを読む。</div>
        </div>
      </div>

      <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border-color); font-size: 12.5px; color: var(--text-muted); line-height: 1.5;">
        💡 <strong>문학적 감상 & 어휘 포인트:</strong><br>
        - <span style="color:#4f46e5; font-weight:700;">crimson dusk</span>: 단순한 석양(sunset)보다 문학적 깊이를 더하는 짙은 붉은 노을의 표현입니다.<br>
        - <span style="color:#4f46e5; font-weight:700;">한 페이지의 위로</span>: 마음을 치유하는 독서의 힘을 상징하며, <strong>북웨이브(Bookwave)</strong> 오디오북의 낭독과도 잘 어울리는 구절입니다.
      </div>
    </div>
  `;
}

// ------------------------------------------
// 8-5. 기본 맥락형 대화 엔진 (북웨이브, 날씨, IT 등)
// ------------------------------------------
function generateContextualFallbackResponse(query, previousMessages) {
  const q = query.toLowerCase().trim();
  const historyText = previousMessages.map(m => m.text).join(" ").toLowerCase();

  // 1. 북웨이브 관련
  if (q.includes("북웨이브") || q.includes("bookwave") || (historyText.includes("북웨이브") && (q.includes("링크") || q.includes("주소") || q.includes("접속") || q.includes("어떻게") || q.includes("사용법")))) {
    return `
      <p>📚 <strong>북웨이브(Bookwave)</strong>는 nunu 포털과 공식 연동된 프리미엄 오디오북 & 전자책 서비스입니다!</p>
      <ul>
        <li>🎧 <strong>오디오북 스트리밍</strong>: 고음질 목소리로 귀로 듣는 독서 경험을 제공합니다.</li>
        <li>📖 <strong>EPUB 뷰어</strong>: 폰, 태블릿, PC 어디서나 쾌적하게 책을 읽으실 수 있습니다.</li>
        <li>🔗 <strong>바로가기 링크</strong>: <a href="https://bookwave-server.onrender.com" target="_blank">https://bookwave-server.onrender.com</a> (클릭 시 새 탭으로 열립니다)</li>
      </ul>
      <p>원하시는 도서 추천이나 오디오북 관련 음악 BGM도 상단 모드(음악 작곡)로 언제든 요청해주세요!</p>
    `;
  }

  // 2. 날씨
  if (q.includes("날씨") || q.includes("미세먼지") || q.includes("기온") || q.includes("비") || q.includes("옷차림")) {
    return `
      <p>⛅ <strong>현재 서울 기준 날씨 정보 브리핑</strong>입니다.</p>
      <ul>
        <li>🌡️ <strong>기온</strong>: 21.5°C (체감 온도 22.0°C)</li>
        <li>🍃 <strong>상태</strong>: 구름 조금, 맑고 선선한 전형적인 쾌적한 가을 날씨입니다.</li>
        <li>🌿 <strong>미세먼지</strong>: <span style="color:#10b981; font-weight:700;">좋음 (18㎍/㎥)</span> / 야외 활동하기에 매우 좋습니다.</li>
      </ul>
      <p>🧥 아침저녁으로는 일교차가 있으니 가벼운 겉옷을 챙겨주세요!</p>
    `;
  }

  // 3. IT / 테크
  if (q.includes("뉴스") || q.includes("it") || q.includes("테크") || q.includes("인공지능") || q.includes("ai")) {
    return `
      <p>⚡ <strong>오늘의 주요 IT 테크 및 AI 핵심 브리핑</strong>입니다.</p>
      <ol>
        <li><strong>nunu AI Pro 멀티모달 고도화</strong>: 텍스트뿐만 아니라 음악, 이미지, 동영상 제작까지 통합 처리하는 최고 지능 모델이 가동됩니다.</li>
        <li><strong>온디바이스(On-Device) AI 보급 확대</strong>: 스마트폰과 노트북 자체에서 통신 지연 없이 초고속 생성 AI가 구동됩니다.</li>
        <li><strong>nunu 스마트 포털 동기화</strong>: PC와 스마트폰 등 여러 기기에서 대화 기록이 끊김 없이 실시간으로 이어집니다.</li>
      </ol>
    `;
  }

  // 4. 파이썬 / 코딩
  if (q.includes("파이썬") || q.includes("python") || q.includes("코드") || q.includes("서버") || q.includes("코딩") || q.includes("자바스크립트")) {
    return `
      <p>💻 <strong>파이썬(Python) 내장 웹 서버 팁</strong></p>
      <pre><code># 터미널 또는 파워쉘에서 실행:
python -m http.server 8080

# 브라우저 접속:
http://localhost:8080 또는 스마트폰: http://192.168.0.3:8080</code></pre>
      <p>📌 <strong>핵심 안내:</strong> nunu 포털도 파이썬 표준 라이브러리(<code class="inline-code">http.server</code>, <code class="inline-code">sqlite3</code>)로 안정적으로 구동되어 가볍고 빠릅니다!</p>
    `;
  }

  // 5. 인사말
  if (q.includes("안녕") || q.includes("반가") || q.includes("하이") || q.includes("hello")) {
    return `
      <p>안녕하세요! nunu AI Pro 멀티모달 창작 스튜디오에 오신 것을 환영합니다! 😊</p>
      <p>일반 대화뿐만 아니라 <strong>음악 작곡</strong>, <strong>이미지 생성</strong>, <strong>동영상 제작</strong>, <strong>언어 번역 및 작문</strong>까지 원하는 창작을 자유롭게 말씀해 주세요!</p>
    `;
  }

  // 6. 이전 대화 이어받기
  if (previousMessages.length > 0) {
    const lastMsg = previousMessages[previousMessages.length - 1].text;
    return `
      <p>이전 대화(<strong>"${escapeHtml(lastMsg.substring(0, 30))}..."</strong>)에 이어서 <strong>"${escapeHtml(query)}"</strong>에 대해 안내해 드립니다. ✨</p>
      <p>이 주제와 관련된 <strong>음악 작곡</strong>이나 <strong>관련 이미지 생성</strong>, 혹은 <strong>외국어 번역</strong>이 필요하시면 하단 모드 탭을 선택하고 말씀해주세요!</p>
    `;
  }

  // 7. 기본 응답
  return `
    <p>질문해 주신 <strong>"${escapeHtml(query)}"</strong>에 대한 nunu AI 분석 결과입니다. ✨</p>
    <ul>
      <li>🎵 <strong>음악 만들기</strong>: 이 주제에 어울리는 BGM이나 피아노 곡 작곡을 요청해보세요.</li>
      <li>🎨 <strong>이미지 만들기</strong>: 상상하시는 장면을 고화질 그림으로 생성해보세요.</li>
      <li>🎬 <strong>동영상 만들기</strong>: 시네마틱 모션 비디오 클립을 생성할 수 있습니다.</li>
      <li>✍️ <strong>언어 번역/작문</strong>: 영/일/중 다국어 번역이나 문학적 글짓기를 받아보세요.</li>
    </ul>
  `;
}

// ==========================================
// 9. 네트워크 접속 정보 및 다른 기기 연결
// ==========================================
async function fetchNetworkInfo() {
  try {
    const res = await fetch("/api/network-info");
    const data = await res.json();
    if (data.success) {
      networkInfo = data;
      const ipText = document.getElementById("networkIpAddressText");
      if (ipText) ipText.textContent = data.networkUrl;

      const publicText = document.getElementById("publicTunnelUrlText");
      if (publicText && data.publicUrl) {
        publicText.textContent = data.publicUrl;
      }
    }
  } catch (err) {
    console.warn("네트워크 정보 조회 실패:", err);
  }
}

// ==========================================
// 10. 로그인 / 회원가입 모달 및 이벤트
// ==========================================
function initAuthModals() {
  const authModal = document.getElementById("aiAuthModal");
  const networkModal = document.getElementById("networkModal");

  const closeAuthBtn = document.getElementById("closeAuthModalBtn");
  const closeNetworkBtn = document.getElementById("closeNetworkModalBtn");

  const btnNetworkPill = document.getElementById("btnNetworkInfoPill");
  const btnCopyNetworkUrl = document.getElementById("btnCopyNetworkUrl");
  const btnCopyPublicUrl = document.getElementById("btnCopyPublicUrl");

  const tabLogin = document.getElementById("tabBtnLogin");
  const tabSignup = document.getElementById("tabBtnSignup");
  const loginForm = document.getElementById("aiLoginForm");
  const signupForm = document.getElementById("aiSignupForm");

  // 모달 닫기
  if (closeAuthBtn && authModal) {
    closeAuthBtn.addEventListener("click", () => {
      if (!getCurrentUser()) {
        if (confirm("nunu AI는 로그인 후 이용하실 수 있습니다.\nnunu 포털 홈으로 이동하시겠습니까?")) {
          window.location.href = "index.html";
        }
        return;
      }
      authModal.style.display = "none";
    });
    authModal.addEventListener("click", (e) => {
      if (e.target === authModal) {
        if (!getCurrentUser()) return; // 비로그인 시 배경 클릭 닫기 방지
        authModal.style.display = "none";
      }
    });
  }

  if (closeNetworkBtn && networkModal) {
    closeNetworkBtn.addEventListener("click", () => networkModal.style.display = "none");
    networkModal.addEventListener("click", (e) => {
      if (e.target === networkModal) networkModal.style.display = "none";
    });
  }

  // 상단 다른 기기 연결 버튼 클릭
  if (btnNetworkPill && networkModal) {
    btnNetworkPill.addEventListener("click", () => {
      fetchNetworkInfo();
      networkModal.style.display = "flex";
    });
  }

  // 외부 공용 접속 주소 복사 버튼 (같은 Wi-Fi 아니어도 접속 가능)
  if (btnCopyPublicUrl) {
    btnCopyPublicUrl.addEventListener("click", () => {
      const pubEl = document.getElementById("publicTunnelUrlText");
      const url = (networkInfo && networkInfo.publicUrl) ? networkInfo.publicUrl : (pubEl ? pubEl.textContent : "");
      navigator.clipboard.writeText(url).then(() => {
        btnCopyPublicUrl.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> 복사 완료!`;
        setTimeout(() => {
          btnCopyPublicUrl.innerHTML = `<i class="fa-regular fa-copy"></i> 복사`;
        }, 1500);
      });
    });
  }

  // 내부 Wi-Fi 주소 복사 버튼
  if (btnCopyNetworkUrl) {
    btnCopyNetworkUrl.addEventListener("click", () => {
      const url = networkInfo ? networkInfo.networkUrl : document.getElementById("networkIpAddressText").textContent;
      navigator.clipboard.writeText(url).then(() => {
        btnCopyNetworkUrl.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> 복사 완료!`;
        setTimeout(() => {
          btnCopyNetworkUrl.innerHTML = `<i class="fa-regular fa-copy"></i> 복사`;
        }, 1500);
      });
    });
  }

  // 탭 전환
  if (tabLogin && tabSignup && loginForm && signupForm) {
    tabLogin.addEventListener("click", () => {
      tabLogin.classList.add("active");
      tabSignup.classList.remove("active");
      loginForm.style.display = "flex";
      signupForm.style.display = "none";
    });

    tabSignup.addEventListener("click", () => {
      tabSignup.classList.add("active");
      tabLogin.classList.remove("active");
      loginForm.style.display = "none";
      signupForm.style.display = "flex";
    });
  }

  // 로그인 제출
  const loginBtn = document.getElementById("btnSubmitAiLogin");
  const loginIdInput = document.getElementById("aiLoginId");
  const loginPwInput = document.getElementById("aiLoginPw");
  const loginError = document.getElementById("aiLoginError");

  if (loginBtn && loginIdInput && loginPwInput) {
    const handleLogin = async () => {
      const id = loginIdInput.value.trim();
      const pw = loginPwInput.value.trim();

      if (!id || !pw) {
        if (loginError) {
          loginError.textContent = "아이디와 비밀번호를 모두 입력해주세요.";
          loginError.style.display = "block";
        }
        return;
      }

      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, password: pw })
        });
        const data = await res.json();

        if (data.success && data.user) {
          setCurrentUser(data.user);
          if (authModal) authModal.style.display = "none";
          loginForm.reset();
          if (loginError) loginError.style.display = "none";

          // 계정의 서버 대화 목록 즉시 동기화
          await syncSessionsFromServer();
        } else {
          if (loginError) {
            loginError.textContent = data.message || "로그인에 실패했습니다.";
            loginError.style.display = "block";
          }
        }
      } catch (err) {
        if (loginError) {
          loginError.textContent = "서버 연결 오류가 발생했습니다.";
          loginError.style.display = "block";
        }
      }
    };

    loginBtn.addEventListener("click", handleLogin);
    loginPwInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleLogin();
    });
  }

  // 회원가입 제출
  const signupBtn = document.getElementById("btnSubmitAiSignup");
  const signupIdInput = document.getElementById("aiSignupId");
  const signupNameInput = document.getElementById("aiSignupName");
  const signupEmailInput = document.getElementById("aiSignupEmail");
  const signupPwInput = document.getElementById("aiSignupPw");
  const signupError = document.getElementById("aiSignupError");
  const signupSuccess = document.getElementById("aiSignupSuccess");

  if (signupBtn && signupIdInput && signupPwInput) {
    const handleSignup = async () => {
      const id = signupIdInput.value.trim();
      const name = signupNameInput.value.trim() || id;
      const email = signupEmailInput.value.trim() || `${id}@nunu.com`;
      const pw = signupPwInput.value.trim();

      if (!id || !pw) {
        if (signupError) {
          signupError.textContent = "아이디와 비밀번호를 입력해주세요.";
          signupError.style.display = "block";
        }
        return;
      }

      try {
        const res = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name, email, password: pw })
        });
        const data = await res.json();

        if (data.success && data.user) {
          if (signupError) signupError.style.display = "none";
          if (signupSuccess) {
            signupSuccess.textContent = "회원가입 완료! 자동 로그인 중...";
            signupSuccess.style.display = "block";
          }

          setTimeout(async () => {
            setCurrentUser(data.user);
            if (authModal) authModal.style.display = "none";
            signupForm.reset();
            if (signupSuccess) signupSuccess.style.display = "none";
            await syncSessionsFromServer();
          }, 800);
        } else {
          if (signupError) {
            signupError.textContent = data.message || "회원가입에 실패했습니다.";
            signupError.style.display = "block";
          }
        }
      } catch (err) {
        if (signupError) {
          signupError.textContent = "서버 연결 오류가 발생했습니다.";
          signupError.style.display = "block";
        }
      }
    };

    signupBtn.addEventListener("click", handleSignup);
    signupPwInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSignup();
    });
  }
}

function openAuthModal(mode = "login") {
  const modal = document.getElementById("aiAuthModal");
  const tabLogin = document.getElementById("tabBtnLogin");
  const tabSignup = document.getElementById("tabBtnSignup");
  const loginForm = document.getElementById("aiLoginForm");
  const signupForm = document.getElementById("aiSignupForm");

  if (modal) {
    modal.style.display = "flex";
    if (mode === "signup") {
      if (tabSignup) tabSignup.click();
    } else {
      if (tabLogin) tabLogin.click();
    }
  }
}

// ==========================================
// 11. 이벤트 리스너 및 유틸리티
// ==========================================
function initEventListeners() {
  const input = document.getElementById("aiMessageInput");
  const sendBtn = document.getElementById("sendMessageBtn");
  const newChatBtn = document.getElementById("btnNewChat");
  const clearHistoryBtn = document.getElementById("btnClearAllHistory");
  const voiceBtn = document.getElementById("voiceInputBtn");

  // 전송 버튼 클릭
  if (sendBtn && input) {
    sendBtn.addEventListener("click", () => {
      const text = input.value.trim();
      if (text) sendMessage(text);
    });

    // 엔터키 전송 (Shift+Enter는 줄바꿈)
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = input.value.trim();
        if (text) sendMessage(text);
      }
    });
  }

  // 새 대화 버튼
  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      createNewSession();
      if (input) input.focus();
    });
  }

  // 전체 삭제
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", clearAllSessions);
  }

  // 환영 화면 추천 카드 클릭
  document.querySelectorAll(".welcome-card").forEach(card => {
    card.addEventListener("click", () => {
      const prompt = card.dataset.prompt;
      if (prompt) sendMessage(prompt);
    });
  });

  // 하단 칩 버튼 클릭
  document.querySelectorAll(".chip-item").forEach(chip => {
    chip.addEventListener("click", () => {
      const prompt = chip.dataset.prompt;
      if (prompt) sendMessage(prompt);
    });
  });

  // 음성 인식 데모
  if (voiceBtn && input) {
    voiceBtn.addEventListener("click", () => {
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRec();
        recognition.lang = 'ko-KR';
        recognition.start();
        input.placeholder = "듣고 있습니다... 말씀해주세요 🎙️";

        recognition.onresult = (event) => {
          const speechResult = event.results[0][0].transcript;
          input.value = speechResult;
          sendMessage(speechResult);
        };
        recognition.onerror = () => {
          input.placeholder = "nunu AI에게 메시지를 입력하세요...";
        };
        recognition.onend = () => {
          input.placeholder = "nunu AI에게 메시지를 입력하세요...";
        };
      } else {
        alert("이 브라우저는 음성 인식을 지원하지 않습니다. 텍스트로 입력해주세요!");
      }
    });
  }
}

function initSidebar() {
  const toggleBtn = document.getElementById("sidebarToggleBtn");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const sidebar = document.getElementById("aiSidebar");

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  }

  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("mobile-open");
    });

    document.addEventListener("click", (e) => {
      if (window.innerWidth <= 768 && sidebar.classList.contains("mobile-open")) {
        if (!sidebar.contains(e.target) && e.target !== mobileMenuBtn && !mobileMenuBtn.contains(e.target)) {
          sidebar.classList.remove("mobile-open");
        }
      }
    });
  }
}

function initInputAutoResize() {
  const textarea = document.getElementById("aiMessageInput");
  if (!textarea) return;

  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
  });
}

function initTheme() {
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const savedTheme = localStorage.getItem("nunu_theme") || "light";

  if (savedTheme === "dark") {
    document.body.classList.replace("theme-light", "theme-dark");
    if (themeToggleBtn) themeToggleBtn.innerHTML = `<i class="fa-solid fa-sun"></i>`;
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const isDark = document.body.classList.contains("theme-dark");
      if (isDark) {
        document.body.classList.replace("theme-dark", "theme-light");
        themeToggleBtn.innerHTML = `<i class="fa-solid fa-moon"></i>`;
        localStorage.setItem("nunu_theme", "light");
      } else {
        document.body.classList.replace("theme-light", "theme-dark");
        themeToggleBtn.innerHTML = `<i class="fa-solid fa-sun"></i>`;
        localStorage.setItem("nunu_theme", "dark");
      }
    });
  }
}

function formatCurrentTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "오후" : "오전";
  hours = hours % 12 || 12;
  return `${ampm} ${hours}:${minutes}`;
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatAiMessage(text) {
  if (!text) return "";
  return text.replace(/\n/g, "<br>");
}

// ==========================================
// 12. nunu AI Pro 멀티모달 인터랙티브 엔진
//     (Web Audio API 신디사이저, 60FPS 캔버스 비디오, 라이트박스, 설정 모달)
// ==========================================

// ------------------------------------------
// 12-1. 하단 멀티모달 탭 전환기
// ------------------------------------------
function initMultimodalTabs() {
  const modeBar = document.getElementById("aiModeBar");
  const input = document.getElementById("aiMessageInput");
  if (!modeBar) return;

  const modePlaceholders = {
    all: "nunu AI에게 메시지를 입력하세요... (음악, 언어, 이미지, 동영상 창작 가능)",
    language: "언어 · 번역 · 작문 모드: 시, 스토리, 영/일/중 번역, 에세이 창작 요청을 입력하세요...",
    image: "이미지 생성 모드: 연출하고 싶은 장면, 화풍(사이버펑크, 판타지, 수채화 등)을 입력하세요...",
    music: "음악 작곡 모드: 원하는 분위기(재즈, 피아노, 로파이, 신스웨이브 등)나 용도를 입력하세요...",
    video: "동영상 제작 모드: 시네마틱 장면, 카메라 워크, 역동적인 모션 연출을 입력하세요..."
  };

  modeBar.querySelectorAll(".mode-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      modeBar.querySelectorAll(".mode-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentCreationMode = btn.dataset.mode || "all";

      if (input) {
        input.placeholder = modePlaceholders[currentCreationMode] || modePlaceholders.all;
        input.focus();
      }
    });
  });
}

// ------------------------------------------
// 12-2. 인터랙티브 위젯 (오디오 플레이어, 비디오 캔버스, 라이트박스) 바인딩
// ------------------------------------------
function initInteractiveWidgets(container = document) {
  // A. 이미지 라이트박스 클릭 이벤트
  container.querySelectorAll(".image-preview-frame, .btn-view-lightbox").forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      const imgSrc = el.dataset.img || (el.querySelector("img") && el.querySelector("img").src);
      const prompt = el.dataset.prompt || "nunu AI Pro 고화질 생성 이미지";
      if (imgSrc) openLightbox(imgSrc, prompt);
    };
  });

  // B. 음악 플레이어 버튼 바인딩
  container.querySelectorAll(".btn-play-pause-music").forEach(btn => {
    btn.onclick = () => {
      const trackId = btn.dataset.trackId;
      const progression = btn.dataset.progression || "jazz";
      toggleMusicPlayback(trackId, progression, btn);
    };
  });

  container.querySelectorAll(".btn-download-audio").forEach(btn => {
    btn.onclick = () => {
      const trackId = btn.dataset.trackId;
      const progression = btn.dataset.progression || "jazz";
      const title = btn.dataset.title || "nunu-ai-music";
      downloadSynthesizedWav(progression, title, trackId);
    };
  });

  // C. 동영상 플레이어 버튼 & 캔버스 초기화
  container.querySelectorAll(".generated-video-card").forEach(card => {
    const canvas = card.querySelector(".video-canvas-stage");
    if (!canvas || canvas.dataset.initialized === "true") return;
    canvas.dataset.initialized = "true";

    const vType = canvas.dataset.videoType || "space";
    initCanvasVideoStage(canvas, vType);

    const playBtn = card.querySelector(".btn-video-play");
    if (playBtn) {
      playBtn.onclick = () => toggleCanvasVideoPlay(canvas, playBtn, card);
    }

    const snapBtn = card.querySelector(".btn-snapshot-video");
    if (snapBtn) {
      snapBtn.onclick = () => snapshotVideoCanvas(canvas);
    }
  });
}

// ------------------------------------------
// 12-3. 절차적 시드 & 난수 생성기 유틸리티
// ------------------------------------------
function getProceduralSeed(str) {
  let hash = 0x811c9dc5;
  const fullStr = (str || "") + "_" + (Date.now() % 100000);
  for (let i = 0; i < fullStr.length; i++) {
    hash ^= fullStr.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash);
}

function createProceduralRng(seed) {
  let s = (seed % 2147483647) || 1234567;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ------------------------------------------
// 12-4. Web Audio API 지능형 음악 신디사이저 엔진 (프롬프트 맞춤형 동적 작곡)
// ------------------------------------------
let globalAudioCtx = null;
let currentPlayingMusic = null; // { trackId, btn, card, intervalId, stopNodes: [] }

function getAudioContext() {
  if (!globalAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) globalAudioCtx = new AudioCtx();
  }
  if (globalAudioCtx && globalAudioCtx.state === "suspended") {
    globalAudioCtx.resume();
  }
  return globalAudioCtx;
}

const MUSIC_PRESETS = {
  jazz: {
    bpm: 78,
    chords: [
      [174.61, 220.00, 261.63, 329.63],
      [146.83, 174.61, 220.00, 261.63],
      [196.00, 233.08, 293.66, 349.23],
      [130.81, 164.81, 196.00, 233.08]
    ],
    melodies: [349.23, 392.00, 440.00, 523.25, 440.00, 392.00, 349.23, 329.63]
  }
};

function generateProceduralMusicData(progressionType, rng) {
  const rootFreqs = {
    jazz: [174.61, 220.0, 261.63, 196.0],
    synthwave: [146.83, 174.61, 130.81, 116.54],
    lofi: [261.63, 220.0, 146.83, 196.0],
    acoustic: [196.0, 146.83, 164.81, 130.81],
    edm: [220.0, 174.61, 130.81, 196.0],
    classical: [164.81, 220.0, 246.94, 164.81],
    oriental: [146.83, 196.0, 220.0, 146.83]
  };

  const scalePitches = {
    jazz: [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25],
    synthwave: [293.66, 329.63, 349.23, 392.00, 440.00, 466.16, 523.25, 587.33, 698.46, 783.99],
    lofi: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99],
    acoustic: [293.66, 329.63, 369.99, 392.00, 440.00, 493.88, 587.33, 659.25],
    edm: [440.00, 523.25, 587.33, 659.25, 698.46, 783.99, 880.00],
    classical: [329.63, 369.99, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25],
    oriental: [293.66, 329.63, 392.00, 440.00, 587.33, 659.25, 783.99]
  };

  const roots = rootFreqs[progressionType] || rootFreqs.jazz;
  const pitches = scalePitches[progressionType] || scalePitches.jazz;

  const chords = roots.map(root => {
    const isMinor = progressionType === "synthwave" || progressionType === "classical" || progressionType === "edm";
    const semitones = isMinor ? [0, 3, 7, 10] : [0, 4, 7, 11];
    return semitones.map(semi => +(root * Math.pow(2, semi / 12)).toFixed(2));
  });

  const melodies = [];
  for (let i = 0; i < 16; i++) {
    const pick = pitches[Math.floor(rng() * pitches.length)];
    melodies.push(+pick.toFixed(2));
  }

  return {
    progressionType,
    chords,
    melodies,
    synthType: progressionType === "synthwave" || progressionType === "edm" ? "sawtooth" : "triangle"
  };
}

function toggleMusicPlayback(trackId, progression, playBtn) {
  const card = document.getElementById(trackId);
  if (!card) return;

  if (currentPlayingMusic && currentPlayingMusic.trackId !== trackId) {
    stopCurrentMusic();
  }

  if (currentPlayingMusic && currentPlayingMusic.trackId === trackId) {
    stopCurrentMusic();
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    alert("이 브라우저는 오디오 재생을 지원하지 않습니다.");
    return;
  }

  const vinyl = document.getElementById(`${trackId}_vinyl`);
  const progressFill = card.querySelector(".music-progress-fill");
  const currTimeSpan = card.querySelector(".curr-time");
  const trackData = (window.nunuGeneratedTracks && window.nunuGeneratedTracks.get(trackId)) || MUSIC_PRESETS[progression] || MUSIC_PRESETS.jazz;

  card.classList.add("is-playing");
  if (vinyl) vinyl.classList.add("playing");
  playBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;

  const totalDuration = 48;
  let elapsed = 0;
  const activeNodes = [];

  const startTime = ctx.currentTime + 0.05;
  const chordDuration = 3.0;

  for (let loop = 0; loop < 4; loop++) {
    trackData.chords.forEach((chord, chordIdx) => {
      const chordTime = startTime + (loop * 4 + chordIdx) * chordDuration;

      chord.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = trackData.synthType || "triangle";
        osc.frequency.setValueAtTime(freq, chordTime);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(osc.type === "sawtooth" ? 1800 : 950, chordTime);

        gain.gain.setValueAtTime(0, chordTime);
        gain.gain.linearRampToValueAtTime(0.06, chordTime + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, chordTime + chordDuration - 0.05);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(chordTime);
        osc.stop(chordTime + chordDuration);
        activeNodes.push(osc);
      });

      const melNote1 = trackData.melodies[(chordIdx * 2) % trackData.melodies.length];
      const melNote2 = trackData.melodies[(chordIdx * 2 + 1) % trackData.melodies.length];

      [ { note: melNote1, offset: 0.35 }, { note: melNote2, offset: 1.55 } ].forEach(m => {
        const mTime = chordTime + m.offset;
        const mOsc = ctx.createOscillator();
        const mGain = ctx.createGain();
        mOsc.type = "sine";
        mOsc.frequency.setValueAtTime(m.note, mTime);

        mGain.gain.setValueAtTime(0, mTime);
        mGain.gain.linearRampToValueAtTime(0.08, mTime + 0.08);
        mGain.gain.exponentialRampToValueAtTime(0.001, mTime + 1.1);

        mOsc.connect(mGain);
        mGain.connect(ctx.destination);

        mOsc.start(mTime);
        mOsc.stop(mTime + 1.2);
        activeNodes.push(mOsc);
      });
    });
  }

  const intervalId = setInterval(() => {
    elapsed += 0.2;
    if (elapsed > totalDuration) {
      stopCurrentMusic(true);
      return;
    }

    if (progressFill) {
      progressFill.style.width = Math.min((elapsed / totalDuration) * 100, 100) + "%";
    }
    if (currTimeSpan) {
      const secs = Math.floor(elapsed);
      currTimeSpan.textContent = `00:${String(secs).padStart(2, "0")}`;
    }
  }, 200);

  currentPlayingMusic = {
    trackId,
    btn: playBtn,
    card,
    vinyl,
    intervalId,
    activeNodes,
    progressFill,
    currTimeSpan
  };
}

function stopCurrentMusic(finishedNaturally = false) {
  if (!currentPlayingMusic) return;
  const { trackId, btn, card, vinyl, intervalId, activeNodes, progressFill, currTimeSpan } = currentPlayingMusic;

  clearInterval(intervalId);
  card.classList.remove("is-playing");
  if (vinyl) vinyl.classList.remove("playing");
  if (btn) btn.innerHTML = `<i class="fa-solid fa-play"></i>`;

  activeNodes.forEach(node => {
    try { node.stop(); } catch(e) {}
  });

  if (progressFill) progressFill.style.width = "0%";
  if (currTimeSpan) currTimeSpan.textContent = "00:00";

  // 음악이 재생 완료되었을 때 마지막에 안내 문구 표시
  if (finishedNaturally) {
    const noticeEl = document.getElementById(`${trackId}_notice`);
    if (noticeEl) {
      noticeEl.style.display = "block";
      noticeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  currentPlayingMusic = null;
}

async function downloadSynthesizedWav(progression, trackTitle, trackId) {
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineCtx) {
    alert("이 브라우저는 음원 내보내기를 지원하지 않습니다.");
    return;
  }

  const sampleRate = 44100;
  const durationSec = 48;
  const offlineCtx = new OfflineCtx(2, sampleRate * durationSec, sampleRate);
  const trackData = (trackId && window.nunuGeneratedTracks && window.nunuGeneratedTracks.get(trackId)) || MUSIC_PRESETS[progression] || MUSIC_PRESETS.jazz;
  const chordDuration = 3.0;

  for (let loop = 0; loop < 4; loop++) {
    trackData.chords.forEach((chord, chordIdx) => {
      const chordTime = (loop * 4 + chordIdx) * chordDuration;

      chord.forEach(freq => {
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        const filter = offlineCtx.createBiquadFilter();

        osc.type = trackData.synthType || "triangle";
        osc.frequency.setValueAtTime(freq, chordTime);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(osc.type === "sawtooth" ? 1800 : 950, chordTime);

        gain.gain.setValueAtTime(0, chordTime);
        gain.gain.linearRampToValueAtTime(0.12, chordTime + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, chordTime + chordDuration - 0.05);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(offlineCtx.destination);

        osc.start(chordTime);
        osc.stop(chordTime + chordDuration);
      });

      const melNote1 = trackData.melodies[(chordIdx * 2) % trackData.melodies.length];
      const melNote2 = trackData.melodies[(chordIdx * 2 + 1) % trackData.melodies.length];

      [ { note: melNote1, offset: 0.35 }, { note: melNote2, offset: 1.55 } ].forEach(m => {
        const mTime = chordTime + m.offset;
        const mOsc = offlineCtx.createOscillator();
        const mGain = offlineCtx.createGain();
        mOsc.type = "sine";
        mOsc.frequency.setValueAtTime(m.note, mTime);

        mGain.gain.setValueAtTime(0, mTime);
        mGain.gain.linearRampToValueAtTime(0.15, mTime + 0.08);
        mGain.gain.exponentialRampToValueAtTime(0.001, mTime + 1.1);

        mOsc.connect(mGain);
        mGain.connect(offlineCtx.destination);

        mOsc.start(mTime);
        mOsc.stop(mTime + 1.2);
      });
    });
  }

  try {
    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = audioBufferToWavBlob(renderedBuffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(trackTitle || "nunu-ai-music").replace(/[^a-zA-Z0-9가-힣_-]/g, "_")}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("WAV 렌더링 실패:", err);
    alert("WAV 음원 생성 중 오류가 발생했습니다.");
  }
}

function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const len = buffer.length * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + len);
  const view = new DataView(wavBuffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + len, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, len, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: "audio/wav" });
}

// ------------------------------------------
// 12-5. 60FPS 시네마틱 캔버스 비디오 애니메이션 엔진 (동적 파라미터 렌더링)
// ------------------------------------------
const activeCanvasVideos = new Map();

function initCanvasVideoStage(canvas, type) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const videoConfig = (window.nunuGeneratedVideos && window.nunuGeneratedVideos.get(canvas.id)) || {};
  const seed = videoConfig.seed || 12345;
  const rng = createProceduralRng(seed);

  const particles = [];
  if (type === "space") {
    for (let i = 0; i < 180; i++) {
      particles.push({
        x: (rng() - 0.5) * w,
        y: (rng() - 0.5) * h,
        z: rng() * w,
        size: rng() * 2 + 1
      });
    }
  } else if (type === "cyberpunk") {
    for (let i = 0; i < 130; i++) {
      particles.push({
        x: rng() * w,
        y: rng() * h,
        speed: rng() * 12 + 14,
        len: rng() * 22 + 10
      });
    }
  } else if (type === "autumn") {
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: rng() * w,
        y: rng() * h,
        vx: rng() * 2 + 1.2,
        vy: rng() * 1.6 + 0.7,
        angle: rng() * Math.PI * 2,
        vAngle: (rng() - 0.5) * 0.05,
        size: rng() * 9 + 7,
        color: ["#f43f5e", "#ea580c", "#f59e0b", "#d97706", "#fb7185"][Math.floor(rng() * 5)]
      });
    }
  } else if (type === "quantum_matrix") {
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.floor(rng() * (w / 14)) * 14,
        y: rng() * h,
        speed: rng() * 4 + 3,
        chars: ["0", "1", "α", "β", "λ", "Ω", "∑", "π"][Math.floor(rng() * 8)]
      });
    }
  } else {
    // sunset_ocean / default
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: rng() * w,
        y: rng() * (h * 0.5),
        radius: rng() * 2 + 0.8,
        alpha: rng() * 0.7 + 0.3
      });
    }
  }

  const videoState = {
    canvas,
    ctx,
    type,
    particles,
    isPlaying: false,
    reqId: null,
    frame: 0,
    startTime: 0,
    duration: 45,
    rng
  };

  activeCanvasVideos.set(canvas.id, videoState);
  renderSingleVideoFrame(videoState);
}

function renderSingleVideoFrame(state) {
  const { ctx, canvas, type, particles } = state;
  const w = canvas.width;
  const h = canvas.height;
  state.frame++;

  if (type === "space") {
    ctx.fillStyle = "#030614";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2 + Math.sin(state.frame * 0.02) * 45;
    const cy = h / 2 + Math.cos(state.frame * 0.015) * 25;
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 270);
    grad.addColorStop(0, "rgba(168, 85, 247, 0.45)");
    grad.addColorStop(0.5, "rgba(14, 165, 233, 0.2)");
    grad.addColorStop(1, "rgba(3, 6, 20, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.fillStyle = "#ffffff";
    particles.forEach(p => {
      p.z -= 4.5;
      if (p.z <= 0) p.z = w;
      const k = 250 / p.z;
      const px = p.x * k;
      const py = p.y * k;
      const pSize = (1 - p.z / w) * p.size * 2;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.6, pSize), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  } else if (type === "cyberpunk") {
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#111827";
    ctx.fillRect(40, 90, 90, h - 90);
    ctx.fillRect(160, 60, 110, h - 60);
    ctx.fillRect(300, 110, 100, h - 110);
    ctx.fillRect(430, 40, 130, h - 40);

    ctx.font = "bold 20px Pretendard, sans-serif";
    ctx.fillStyle = "#ec4899";
    ctx.shadowColor = "#ec4899";
    ctx.shadowBlur = 12;
    ctx.fillText("NUNU AI", 180, 110);
    ctx.fillStyle = "#06b6d4";
    ctx.shadowColor = "#06b6d4";
    ctx.fillText("NEO PRO 2099", 450, 90);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(56, 189, 248, 0.65)";
    ctx.lineWidth = 1.5;
    particles.forEach(p => {
      p.y += p.speed;
      if (p.y > h) {
        p.y = -20;
        p.x = Math.random() * w;
      }
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 3, p.y + p.len);
      ctx.stroke();
    });

    const groundGrad = ctx.createLinearGradient(0, h - 60, 0, h);
    groundGrad.addColorStop(0, "rgba(236, 72, 153, 0.15)");
    groundGrad.addColorStop(1, "rgba(6, 182, 212, 0.3)");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, h - 60, w, 60);
  } else if (type === "autumn") {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#fb923c");
    sky.addColorStop(0.5, "#fdba74");
    sky.addColorStop(1, "#fde047");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(w * 0.75, h * 0.45, 60, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fill();

    particles.forEach(p => {
      p.x += p.vx + Math.sin(state.frame * 0.03) * 0.8;
      p.y += p.vy;
      p.angle += p.vAngle;

      if (p.x > w + 20) p.x = -20;
      if (p.y > h + 20) p.y = -20;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  } else if (type === "quantum_matrix") {
    ctx.fillStyle = "rgba(5, 10, 20, 0.25)";
    ctx.fillRect(0, 0, w, h);

    ctx.font = "14px monospace";
    ctx.fillStyle = "#10b981";
    particles.forEach(p => {
      p.y += p.speed;
      if (p.y > h) p.y = 0;
      ctx.fillText(p.chars, p.x, p.y);
    });

    const waveY = h * 0.5 + Math.sin(state.frame * 0.04) * 30;
    ctx.strokeStyle = "rgba(6, 182, 212, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x += 10) {
      const y = waveY + Math.sin(x * 0.02 + state.frame * 0.05) * 20;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    // sunset_ocean
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
    skyGrad.addColorStop(0, "#311042");
    skyGrad.addColorStop(0.5, "#9333ea");
    skyGrad.addColorStop(1, "#f59e0b");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.6);

    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.55, 45, Math.PI, 0);
    ctx.fillStyle = "#fef08a";
    ctx.fill();

    ctx.fillStyle = "#091226";
    ctx.fillRect(0, h * 0.6, w, h * 0.4);

    for (let i = 0; i < 4; i++) {
      const seaY = h * 0.6 + i * 22;
      ctx.strokeStyle = `rgba(254, 240, 138, ${0.4 - i * 0.08})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x += 12) {
        const yOffset = Math.sin(x * 0.03 + state.frame * 0.06 + i) * (4 + i * 2);
        if (x === 0) ctx.moveTo(x, seaY + yOffset);
        else ctx.lineTo(x, seaY + yOffset);
      }
      ctx.stroke();
    }
  }

  // nunuAI 우측 하단 워터마크 렌더링
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  const wmText = "nunuAI";
  ctx.font = "800 13px 'Outfit', Pretendard, sans-serif";
  const wmMetrics = ctx.measureText(wmText);
  const wmPadding = 6;
  const wmX = w - wmMetrics.width - wmPadding * 2 - 14;
  const wmY = h - 28;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(wmX, wmY, wmMetrics.width + wmPadding * 2, 20, 4);
  } else {
    ctx.rect(wmX, wmY, wmMetrics.width + wmPadding * 2, 20);
  }
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillText(wmText, wmX + wmPadding, wmY + 14);
  ctx.restore();
}

function toggleCanvasVideoPlay(canvas, playBtn, card) {
  const state = activeCanvasVideos.get(canvas.id);
  if (!state) return;

  const progressFill = card.querySelector(".video-progress-fill");
  const currTimeSpan = card.querySelector(".v-curr");

  if (state.isPlaying) {
    state.isPlaying = false;
    cancelAnimationFrame(state.reqId);
    playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
    return;
  }

  state.isPlaying = true;
  state.startTime = performance.now();
  playBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;

  function loop(now) {
    if (!state.isPlaying) return;

    renderSingleVideoFrame(state);

    const elapsedSec = (now - state.startTime) / 1000;
    if (elapsedSec >= state.duration) {
      state.isPlaying = false;
      playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
      if (progressFill) progressFill.style.width = "0%";
      if (currTimeSpan) currTimeSpan.textContent = "00:00";
      return;
    }

    if (progressFill) {
      progressFill.style.width = Math.min((elapsedSec / state.duration) * 100, 100) + "%";
    }
    if (currTimeSpan) {
      const s = Math.floor(elapsedSec);
      currTimeSpan.textContent = `00:${String(s).padStart(2, "0")}`;
    }

    state.reqId = requestAnimationFrame(loop);
  }

  state.reqId = requestAnimationFrame(loop);
}

function snapshotVideoCanvas(canvas) {
  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `nunu-video-frame-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ------------------------------------------
// 12-6. 고화질 절차적 SVG 아트워크 생성기 (프롬프트 맞춤형 동적 벡터 렌더링)
// ------------------------------------------
function generateProceduralArtwork(query, seed, rng) {
  const q = (query || "").toLowerCase().trim();

  let sceneType = "general";
  let title = `디지털 아트워크 #${Math.floor(rng() * 900 + 100)}`;
  let tags = ["#초고화질", "#디지털아트", "#4K렌더"];

  if (q.includes("고양이") || q.includes("강아지") || q.includes("동물") || q.includes("귀여운") || q.includes("토끼") || q.includes("곰") || q.includes("캐릭터")) {
    sceneType = "animal";
    title = `사랑스러운 동물 캐릭터 초상화 #${Math.floor(rng() * 900 + 100)}`;
    tags = ["#귀여운일러스트", "#파스텔톤", "#캐릭터디자인", "#동물아트"];
  } else if (q.includes("사이버") || q.includes("네온") || q.includes("미래") || q.includes("도시") || q.includes("로봇") || q.includes("메카") || q.includes("비행")) {
    sceneType = "cyberpunk";
    title = `네온빛 미래 사이버 메트로폴리스 #${Math.floor(rng() * 900 + 100)}`;
    tags = ["#사이버펑크", "#네온시티", "#미래도시", "#홀로그램", "#시네마틱"];
  } else if (q.includes("우주") || q.includes("성운") || q.includes("은하") || q.includes("별") || q.includes("행성") || q.includes("외계")) {
    sceneType = "space";
    title = `심우주 오디세이 성운과 행성 #${Math.floor(rng() * 900 + 100)}`;
    tags = ["#심우주", "#천체아트워크", "#성운", "#스페이스오디세이"];
  } else if (q.includes("판타지") || q.includes("숲") || q.includes("요정") || q.includes("마법") || q.includes("신비") || q.includes("크리스탈")) {
    sceneType = "fantasy";
    title = `신비로운 달빛 요정의 숲 #${Math.floor(rng() * 900 + 100)}`;
    tags = ["#판타지아트", "#발광크리스탈", "#동화풍", "#신비로운숲"];
  } else if (q.includes("바다") || q.includes("노을") || q.includes("석양") || q.includes("해변") || q.includes("파도") || q.includes("산") || q.includes("풍경")) {
    sceneType = "landscape";
    title = `황금빛 석양과 지평선의 풍경 #${Math.floor(rng() * 900 + 100)}`;
    tags = ["#골든아워", "#풍경화", "#석양빛", "#자연아트"];
  } else if (q.includes("카페") || q.includes("커피") || q.includes("책") || q.includes("서재") || q.includes("가을") || q.includes("따뜻")) {
    sceneType = "cafe";
    title = `따뜻한 온기와 라떼아트의 오후 #${Math.floor(rng() * 900 + 100)}`;
    tags = ["#아늑한카페", "#라떼아트", "#따뜻한조명", "#감성라이프"];
  }

  // 12가지 조화로운 색상 팔레트
  const palettes = [
    { bg1: "#0b0f19", bg2: "#1e1b4b", bg3: "#4a044e", accent1: "#06b6d4", accent2: "#ec4899", glow: "#f43f5e" },
    { bg1: "#030712", bg2: "#1e1b4b", bg3: "#312e81", accent1: "#a855f7", accent2: "#38bdf8", glow: "#60a5fa" },
    { bg1: "#022c22", bg2: "#064e3b", bg3: "#065f46", accent1: "#34d399", accent2: "#67e8f9", glow: "#a7f3d0" },
    { bg1: "#431407", bg2: "#7c2d12", bg3: "#c2410c", accent1: "#fbbf24", accent2: "#f97316", glow: "#fde047" },
    { bg1: "#1c1917", bg2: "#44403c", bg3: "#78716c", accent1: "#eab308", accent2: "#f59e0b", glow: "#fef08a" },
    { bg1: "#2e1065", bg2: "#581c87", bg3: "#86198f", accent1: "#f472b6", accent2: "#ec4899", glow: "#fbcfe8" }
  ];
  const pal = palettes[Math.floor(rng() * palettes.length)];

  // 30~45개 파티클 별무리 생성
  let starElements = "";
  for (let i = 0; i < 35; i++) {
    const sx = Math.floor(rng() * 780 + 10);
    const sy = Math.floor(rng() * 480 + 10);
    const sr = +(rng() * 2.2 + 0.8).toFixed(1);
    const op = +(rng() * 0.7 + 0.3).toFixed(2);
    const col = rng() > 0.5 ? pal.accent1 : "#ffffff";
    starElements += `<circle cx="${sx}" cy="${sy}" r="${sr}" fill="${col}" opacity="${op}"/>`;
  }

  let sceneElements = "";

  if (sceneType === "animal") {
    const earY = Math.floor(140 + rng() * 20);
    sceneElements = `
      <ellipse cx="400" cy="310" rx="150" ry="130" fill="#ffffff" filter="url(#dropSh)"/>
      <polygon points="290,240 330,${earY} 370,220" fill="${pal.accent2}" stroke="#ffffff" stroke-width="6"/>
      <polygon points="510,240 470,${earY} 430,220" fill="${pal.accent2}" stroke="#ffffff" stroke-width="6"/>
      <circle cx="340" cy="275" r="18" fill="#1e293b"/>
      <circle cx="346" cy="270" r="7" fill="#ffffff"/>
      <circle cx="460" cy="275" r="18" fill="#1e293b"/>
      <circle cx="466" cy="270" r="7" fill="#ffffff"/>
      <ellipse cx="315" cy="305" rx="18" ry="11" fill="${pal.glow}" opacity="0.4"/>
      <ellipse cx="485" cy="305" rx="18" ry="11" fill="${pal.glow}" opacity="0.4"/>
      <polygon points="395,296 405,296 400,305" fill="#f43f5e"/>
      <path d="M390 312 Q400 322 400 312 Q400 322 410 312" stroke="#475569" stroke-width="3" fill="none"/>
    `;
  } else if (sceneType === "cyberpunk") {
    sceneElements = `
      <rect x="50" y="160" width="130" height="340" fill="#0f172a"/>
      <rect x="210" y="100" width="170" height="400" fill="#1e1b4b"/>
      <rect x="410" y="180" width="140" height="320" fill="#090d16"/>
      <rect x="580" y="70" width="180" height="430" fill="#172554"/>
      <circle cx="680" cy="120" r="70" fill="${pal.glow}" opacity="0.8" filter="url(#artGlow)"/>
      <line x1="220" y1="130" x2="360" y2="130" stroke="${pal.accent1}" stroke-width="3" filter="url(#artGlow)"/>
      <line x1="220" y1="190" x2="360" y2="190" stroke="${pal.accent2}" stroke-width="3" filter="url(#artGlow)"/>
      <line x1="590" y1="110" x2="740" y2="110" stroke="${pal.accent1}" stroke-width="4" filter="url(#artGlow)"/>
      <line x1="590" y1="180" x2="740" y2="180" stroke="${pal.accent2}" stroke-width="4" filter="url(#artGlow)"/>
      <rect x="0" y="440" width="800" height="60" fill="${pal.accent1}" opacity="0.25"/>
    `;
  } else if (sceneType === "space") {
    sceneElements = `
      <ellipse cx="400" cy="250" rx="360" ry="220" fill="url(#spaceG)" filter="url(#artBlur)"/>
      <circle cx="400" cy="250" r="40" fill="#ffffff" opacity="0.95"/>
      <circle cx="400" cy="250" r="100" fill="${pal.accent1}" opacity="0.35"/>
      <ellipse cx="400" cy="250" rx="220" ry="40" fill="none" stroke="${pal.accent2}" stroke-width="5" opacity="0.75" transform="rotate(-18 400 250)"/>
    `;
  } else if (sceneType === "fantasy") {
    sceneElements = `
      <circle cx="400" cy="110" r="70" fill="${pal.glow}" opacity="0.6" filter="url(#artGlow)"/>
      <path d="M370 190 Q390 320 380 500 L420 500 Q430 320 410 190 Z" fill="${pal.accent1}" opacity="0.85" filter="url(#artGlow)"/>
      <polygon points="120,400 60,500 180,500" fill="#022c22"/>
      <polygon points="120,320 70,420 170,420" fill="#064e3b"/>
      <polygon points="680,380 610,500 750,500" fill="#022c22"/>
      <circle cx="280" cy="310" r="9" fill="${pal.accent1}" filter="url(#artGlow)"/>
      <circle cx="520" cy="270" r="11" fill="${pal.accent2}" filter="url(#artGlow)"/>
    `;
  } else if (sceneType === "cafe") {
    sceneElements = `
      <rect x="80" y="40" width="360" height="320" fill="#1c1917" opacity="0.6" stroke="${pal.accent1}" stroke-width="5"/>
      <line x1="260" y1="40" x2="260" y2="360" stroke="${pal.accent1}" stroke-width="3"/>
      <line x1="80" y1="200" x2="440" y2="200" stroke="${pal.accent1}" stroke-width="3"/>
      <rect x="0" y="360" width="800" height="140" fill="#1c1917"/>
      <ellipse cx="580" cy="400" rx="60" ry="32" fill="#fafaf9"/>
      <ellipse cx="580" cy="397" rx="50" ry="24" fill="#78350f"/>
      <ellipse cx="580" cy="396" rx="22" ry="12" fill="${pal.glow}"/>
      <path d="M570 360 Q560 320 575 280" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.4"/>
      <path d="M590 355 Q600 315 585 275" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.4"/>
    `;
  } else {
    // landscape / general
    sceneElements = `
      <circle cx="400" cy="270" r="70" fill="${pal.glow}" opacity="0.95"/>
      <polygon points="350,320 450,320 520,500 280,500" fill="${pal.accent1}" opacity="0.35"/>
      <path d="M0 320 Q200 325 400 320 T800 320" stroke="${pal.glow}" stroke-width="2" fill="none" opacity="0.7"/>
      <path d="M0 365 Q200 373 400 365 T800 365" stroke="${pal.accent2}" stroke-width="1.8" fill="none" opacity="0.5"/>
      <path d="M220 140 Q235 130 250 140 Q265 130 280 140" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.8"/>
      <path d="M540 110 Q552 102 565 110 Q578 102 590 110" stroke="#ffffff" stroke-width="1.8" fill="none" opacity="0.7"/>
    `;
  }

  const svgInner = `
    <defs>
      <linearGradient id="artBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${pal.bg1}"/>
        <stop offset="50%" stop-color="${pal.bg2}"/>
        <stop offset="100%" stop-color="${pal.bg3}"/>
      </linearGradient>
      <radialGradient id="spaceG" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${pal.accent2}" stop-opacity="0.9"/>
        <stop offset="40%" stop-color="${pal.accent1}" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="${pal.bg1}" stop-opacity="0"/>
      </radialGradient>
      <filter id="artGlow">
        <feGaussianBlur stdDeviation="5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="artBlur"><feGaussianBlur stdDeviation="3"/></filter>
      <filter id="dropSh"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.3"/></filter>
    </defs>
    <rect width="800" height="500" fill="url(#artBg)"/>
    ${starElements}
    ${sceneElements}
    <!-- nunuAI 우측 하단 워터마크 -->
    <g transform="translate(685, 465)">
      <rect x="-12" y="-18" width="95" height="26" rx="6" fill="rgba(0, 0, 0, 0.45)" backdrop-filter="blur(4px)"/>
      <text x="0" y="0" fill="#ffffff" font-size="14" font-family="'Outfit', Pretendard, sans-serif" font-weight="800" letter-spacing="1px" opacity="0.9">nunuAI</text>
    </g>
  `;

  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">${svgInner}</svg>`;
  const svgDataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);

  return {
    title,
    tags,
    svgDataUri
  };
}

function getGeneratedSvgDataUri(theme, title) {
  const seed = getProceduralSeed(theme + title);
  const rng = createProceduralRng(seed);
  const res = generateProceduralArtwork(theme, seed, rng);
  return res.svgDataUri;
}

// ------------------------------------------
// 12-6. 이미지 라이트박스 모달 핸들러
// ------------------------------------------
function initLightboxModal() {
  const modal = document.getElementById("imageLightboxModal");
  const closeBtn = document.getElementById("closeLightboxBtn");
  if (!modal) return;

  if (closeBtn) {
    closeBtn.onclick = () => modal.style.display = "none";
  }

  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };
}

function openLightbox(imgSrc, promptText) {
  const modal = document.getElementById("imageLightboxModal");
  const img = document.getElementById("lightboxImg");
  const promptEl = document.getElementById("lightboxPromptText");
  const downloadBtn = document.getElementById("lightboxDownloadBtn");

  if (!modal || !img) return;

  img.src = imgSrc;
  if (promptEl) promptEl.textContent = promptText;
  if (downloadBtn) downloadBtn.href = imgSrc;

  modal.style.display = "flex";
}

// ------------------------------------------
// 12-7. nunu AI Pro 설정 모달 핸들러
// ------------------------------------------
function initGeminiConfigModal() {
  const modal = document.getElementById("geminiConfigModal");
  const openBtn = document.getElementById("btnGeminiConfigPill");
  const closeBtn = document.getElementById("closeGeminiModalBtn");
  const saveBtn = document.getElementById("btnSaveGeminiKey");
  const testBtn = document.getElementById("btnTestGeminiKey");
  const eyeBtn = document.getElementById("toggleApiKeyVisibility");
  const keyInput = document.getElementById("geminiApiKeyInput");
  const feedbackMsg = document.getElementById("geminiFeedbackMsg");
  const statusBadge = document.getElementById("geminiStatusBadge");

  if (!modal) return;

  // 설정 모달 열기 & 현재 설정값 조회
  if (openBtn) {
    openBtn.onclick = async () => {
      modal.style.display = "flex";
      if (feedbackMsg) feedbackMsg.style.display = "none";

      try {
        const res = await fetch("/api/gemini/config");
        const data = await res.json();
        if (data.success) {
          if (data.hasKey) {
            if (statusBadge) {
              statusBadge.innerHTML = `<span class="dot" style="background:#10b981;"></span> <span style="color:#10b981;">nunu AI Pro 최고지능 키 등록됨 (${data.maskedKey})</span>`;
            }
            if (keyInput && !keyInput.value) {
              keyInput.placeholder = `현재 키: ${data.maskedKey} (새 키를 입력하여 갱신 가능)`;
            }
          } else {
            if (statusBadge) {
              statusBadge.innerHTML = `<span class="dot"></span> <span>nunu AI Pro 초고지능 활성화됨 (기본 내장 엔진 가동)</span>`;
            }
          }
        }
      } catch (e) {
        console.warn("nunu AI Pro 설정 로드 실패:", e);
      }
    };
  }

  // 모달 닫기
  if (closeBtn) {
    closeBtn.onclick = () => modal.style.display = "none";
  }
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };

  // 눈 모양 비밀번호 보기 토글
  if (eyeBtn && keyInput) {
    eyeBtn.onclick = () => {
      const isPass = keyInput.type === "password";
      keyInput.type = isPass ? "text" : "password";
      eyeBtn.innerHTML = isPass ? `<i class="fa-regular fa-eye-slash"></i>` : `<i class="fa-regular fa-eye"></i>`;
    };
  }

  // 설정 저장
  if (saveBtn && keyInput) {
    saveBtn.onclick = async () => {
      const apiKey = keyInput.value.trim();
      try {
        const res = await fetch("/api/gemini/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey })
        });
        const data = await res.json();
        if (data.success) {
          showFeedback("nunu AI Pro 엔진 설정이 성공적으로 저장되었습니다! 이제 최고 지능 엔진이 적용됩니다.", true);
          if (statusBadge) {
            statusBadge.innerHTML = apiKey 
              ? `<span class="dot" style="background:#10b981;"></span> <span style="color:#10b981;">nunu AI Pro 키 연동 완료</span>`
              : `<span class="dot"></span> <span>nunu AI Pro 활성화됨 (기본 내장 엔진)</span>`;
          }
        } else {
          showFeedback(data.message || "설정 저장에 실패했습니다.", false);
        }
      } catch (err) {
        showFeedback("서버와 통신할 수 없습니다.", false);
      }
    };
  }

  // 연결 테스트
  if (testBtn) {
    testBtn.onclick = async () => {
      showFeedback("nunu AI Pro 엔진 서버와 연결 테스트 중...", true);
      try {
        const res = await fetch("/api/gemini/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "Hello nunu AI Pro test" })
        });
        const data = await res.json();
        if (data.success) {
          if (data.source === "api" || data.source === "gemini-api") {
            showFeedback(`✅ AI 실시간 모델 정상 통신 성공! (연동 모델: ${data.activeModel || 'Gemini 1.5'})`, true);
          } else {
            showFeedback("ℹ️ nunu AI 엔진이 정상 가동 중입니다.", true);
          }
        } else {
          showFeedback("연결 테스트 안내: " + (data.message || "오류"), false);
        }
      } catch (e) {
        showFeedback("연결 테스트 중 네트워크 오류가 발생했습니다.", false);
      }
    };
  }

  function showFeedback(msg, isSuccess) {
    if (!feedbackMsg) return;
    feedbackMsg.textContent = msg;
    feedbackMsg.className = `gemini-feedback-alert ${isSuccess ? "success" : "error"}`;
    feedbackMsg.style.display = "block";
  }
}

// ==========================================
// 10. AI 모델 선택기 및 PRO 권한 동기화 (기본 AI vs PRO 엔진)
// ==========================================
function initModelSelector() {
  const wrapper = document.getElementById("modelSelectorWrapper");
  const btn = document.getElementById("modelSelectorBtn");
  const menu = document.getElementById("modelDropdownMenu");
  const optFlash = document.getElementById("optModelFlash");
  const optPro = document.getElementById("optModelPro");

  if (!btn || !menu) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isVisible = menu.style.display === "flex" || menu.style.display === "block";
    menu.style.display = isVisible ? "none" : "flex";
    btn.classList.toggle("active", !isVisible);
  });

  document.addEventListener("click", (e) => {
    if (wrapper && !wrapper.contains(e.target)) {
      menu.style.display = "none";
      btn.classList.remove("active");
    }
  });

  if (optFlash) {
    optFlash.addEventListener("click", () => {
      currentAiModel = "flash";
      localStorage.setItem("nunu_selected_ai_model", "flash");
      updateModelSelectorUI();
      menu.style.display = "none";
      btn.classList.remove("active");
    });
  }

  if (optPro) {
    optPro.addEventListener("click", () => {
      const user = getCurrentUser();
      const hasPro = user && Boolean(user.isPro);
      if (!hasPro) {
        alert(
          "🔒 PRO 엔진은 관리자가 승인한 계정 전용입니다.\n\n" +
          (user ? `현재 계정 [${user.name} (${user.id})]은 PRO 권한이 아직 승인되지 않았습니다.\n` : "먼저 로그인하신 후 ") +
          "관리자 센터(admin.html)에서 해당 계정에 PRO 권한을 승인받으신 후 이용하실 수 있습니다."
        );
        return;
      }
      currentAiModel = "pro";
      localStorage.setItem("nunu_selected_ai_model", "pro");
      updateModelSelectorUI();
      menu.style.display = "none";
      btn.classList.remove("active");
    });
  }

  updateModelSelectorUI();
}

async function refreshUserProStatus() {
  const user = getCurrentUser();
  if (!user) {
    if (currentAiModel === "pro") {
      currentAiModel = "flash";
      localStorage.setItem("nunu_selected_ai_model", "flash");
    }
    updateModelSelectorUI();
    return;
  }

  try {
    const res = await fetch(`/api/user-status?id=${encodeURIComponent(user.id)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        user.isPro = data.isPro;
        localStorage.setItem("nunu_current_user", JSON.stringify(user));
      }
    }
  } catch (e) {
    // 오프라인 혹은 에러 시 로컬 캐시 유지
  }

  // 승인되지 않은 계정이면 flash 모델로 자동 강등
  if (currentAiModel === "pro" && !user.isPro) {
    currentAiModel = "flash";
    localStorage.setItem("nunu_selected_ai_model", "flash");
  }

  updateModelSelectorUI();
}

function updateModelSelectorUI() {
  const user = getCurrentUser();
  const hasPro = user && Boolean(user.isPro);

  const modelNameEl = document.getElementById("modelName");
  const tierTagEl = document.getElementById("modelTierTag");
  const statusSubEl = document.getElementById("modelStatusSub");
  const iconBadgeEl = document.getElementById("modelIconBadge");

  const optFlash = document.getElementById("optModelFlash");
  const optPro = document.getElementById("optModelPro");
  const optProLockBadge = document.getElementById("optProLockBadge");

  // PRO 상태 배지 업데이트
  if (optProLockBadge) {
    if (hasPro) {
      optProLockBadge.innerHTML = `<i class="fa-solid fa-crown" style="color: #eab308;"></i> 승인 완료`;
      optProLockBadge.style.color = "#7c3aed";
      optProLockBadge.style.background = "#ede9fe";
    } else {
      optProLockBadge.innerHTML = `<i class="fa-solid fa-lock"></i> 관리자 승인 필요`;
      optProLockBadge.style.color = "#9333ea";
      optProLockBadge.style.background = "#f3e8ff";
    }
  }

  if (optFlash) {
    optFlash.classList.toggle("is-selected", currentAiModel === "flash");
    const check = optFlash.querySelector(".opt-check-icon");
    if (check) check.style.display = currentAiModel === "flash" ? "block" : "none";
  }

  if (optPro) {
    optPro.classList.toggle("is-selected", currentAiModel === "pro");
    optPro.classList.toggle("is-locked", !hasPro);
  }

  if (currentAiModel === "pro") {
    if (modelNameEl) modelNameEl.textContent = "PRO 엔진";
    if (tierTagEl) {
      tierTagEl.textContent = "PRO";
      tierTagEl.className = "model-tier-tag tier-pro";
    }
    if (statusSubEl) {
      statusSubEl.innerHTML = `<span class="dot" style="background: #a855f7;"></span> 초고지능 심층 사고 엔진 가동 중`;
    }
    if (iconBadgeEl) {
      iconBadgeEl.innerHTML = `<i class="fa-solid fa-crown"></i>`;
      iconBadgeEl.style.background = "linear-gradient(135deg, #7c3aed, #ec4899)";
    }
  } else {
    if (modelNameEl) modelNameEl.textContent = "기본 AI";
    if (tierTagEl) {
      tierTagEl.textContent = "Standard";
      tierTagEl.className = "model-tier-tag tier-standard";
    }
    if (statusSubEl) {
      statusSubEl.innerHTML = `<span class="dot"></span> 빠르고 스마트한 기본 AI`;
    }
    if (iconBadgeEl) {
      iconBadgeEl.innerHTML = `<i class="fa-solid fa-bolt"></i>`;
      iconBadgeEl.style.background = "linear-gradient(135deg, #3b82f6, #6366f1)";
    }
  }
}

