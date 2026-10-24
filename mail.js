/**
 * nunu Webmail Application Client Logic
 */

let currentUser = null;
let currentBox = "inbox";
let currentFilter = "all";
let searchQuery = "";
let allMails = [];
let currentViewingMail = null;
let composeType = "mail";

// ==========================================
// 1. 초기화 및 사용자 계정 감지 (로그인 필수 차단)
// ==========================================
function initUser() {
  let user = null;
  try {
    const raw = localStorage.getItem("nunu_current_user") || localStorage.getItem("nunu_user");
    if (raw) {
      user = JSON.parse(raw);
    }
  } catch (e) {
    user = null;
  }

  // URL 파라미터로 ?user_id= 가 있는 경우
  const params = new URLSearchParams(window.location.search);
  const paramUserId = params.get("user_id");
  if (paramUserId && paramUserId !== "nunu_member") {
    user = {
      id: paramUserId,
      name: paramUserId,
      email: `${paramUserId.toLowerCase()}@nunu.com`
    };
    localStorage.setItem("nunu_current_user", JSON.stringify(user));
  }

  // 로그인되지 않은 경우: 데모 계정 제공 금지! 즉시 로그인 차단 창 표시
  if (!user || !user.id || user.id === "nunu_member") {
    currentUser = null;
    updateHeaderUserInfo();
    showMailAuthModal("login");
    return false;
  }

  currentUser = user;

  // 전용 이메일 주소 확정
  if (!currentUser.email || !currentUser.email.includes("@")) {
    currentUser.email = `${currentUser.id.toLowerCase()}@nunu.com`;
  }

  updateHeaderUserInfo();
  hideMailAuthModal();
  return true;
}

function updateHeaderUserInfo() {
  const profileBadge = document.getElementById("userProfileBadge");
  const logoutBtn = document.getElementById("btnLogoutMail");
  const nameEl = document.getElementById("headerUserName");
  const emailEl = document.getElementById("headerUserEmail");
  const avatarEl = document.getElementById("userAvatarText");
  const cardEmailEl = document.getElementById("cardUserEmail");
  const composeFromEl = document.getElementById("composeFromDisplay");

  if (!currentUser) {
    if (profileBadge) profileBadge.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";
    return;
  }

  if (profileBadge) profileBadge.style.display = "flex";
  if (logoutBtn) logoutBtn.style.display = "flex";
  if (nameEl) nameEl.textContent = currentUser.name || currentUser.id;
  if (emailEl) emailEl.textContent = currentUser.email;
  if (avatarEl) avatarEl.textContent = (currentUser.name || currentUser.id).charAt(0).toUpperCase();
  if (cardEmailEl) cardEmailEl.textContent = currentUser.email;
  if (composeFromEl) composeFromEl.textContent = currentUser.email;
}

function showMailAuthModal(initialTab = "login") {
  const modal = document.getElementById("mailAuthModalOverlay");
  if (modal) modal.style.display = "flex";
  switchMailAuthTab(initialTab);
}

function hideMailAuthModal() {
  const modal = document.getElementById("mailAuthModalOverlay");
  if (modal) modal.style.display = "none";
}

function switchMailAuthTab(tab) {
  const tabLogin = document.getElementById("tabMailLogin");
  const tabSignup = document.getElementById("tabMailSignup");
  const formLogin = document.getElementById("mailLoginForm");
  const formSignup = document.getElementById("mailSignupForm");
  const errLogin = document.getElementById("mailLoginError");
  const errSignup = document.getElementById("mailSignupError");
  const succSignup = document.getElementById("mailSignupSuccess");

  if (errLogin) errLogin.style.display = "none";
  if (errSignup) errSignup.style.display = "none";
  if (succSignup) succSignup.style.display = "none";

  if (tab === "login") {
    if (tabLogin) tabLogin.classList.add("active");
    if (tabSignup) tabSignup.classList.remove("active");
    if (formLogin) formLogin.style.display = "flex";
    if (formSignup) formSignup.style.display = "none";
    const input = document.getElementById("mailLoginId");
    if (input) setTimeout(() => input.focus(), 100);
  } else {
    if (tabSignup) tabSignup.classList.add("active");
    if (tabLogin) tabLogin.classList.remove("active");
    if (formSignup) formSignup.style.display = "flex";
    if (formLogin) formLogin.style.display = "none";
    const input = document.getElementById("mailSignupId");
    if (input) setTimeout(() => input.focus(), 100);
  }
}

async function handleMailLogin(e) {
  if (e) e.preventDefault();
  const idInput = document.getElementById("mailLoginId");
  const pwInput = document.getElementById("mailLoginPw");
  const errEl = document.getElementById("mailLoginError");
  const btn = document.getElementById("btnSubmitMailLogin");

  const id = idInput ? idInput.value.trim() : "";
  const pw = pwInput ? pwInput.value.trim() : "";

  if (!id || !pw) {
    if (errEl) {
      errEl.textContent = "아이디와 비밀번호를 모두 입력해주세요.";
      errEl.style.display = "block";
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 로그인 확인 중...`;
  }

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password: pw })
    });
    const data = await res.json();

    if (data.success && data.user) {
      localStorage.setItem("nunu_current_user", JSON.stringify(data.user));
      currentUser = data.user;
      if (!currentUser.email || !currentUser.email.includes("@")) {
        currentUser.email = `${currentUser.id.toLowerCase()}@nunu.com`;
      }
      hideMailAuthModal();
      updateHeaderUserInfo();
      await loadMailbox("inbox");
    } else {
      if (errEl) {
        errEl.textContent = data.message || "일치하는 회원 정보가 없습니다. 다시 확인해주세요.";
        errEl.style.display = "block";
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.textContent = "서버 연결에 실패했습니다. 네트워크 상태를 확인해주세요.";
      errEl.style.display = "block";
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-arrow-right-to-bracket"></i> 로그인 및 메일함 열기`;
    }
  }
}

async function handleMailSignup(e) {
  if (e) e.preventDefault();
  const idInput = document.getElementById("mailSignupId");
  const nameInput = document.getElementById("mailSignupName");
  const pwInput = document.getElementById("mailSignupPw");
  const errEl = document.getElementById("mailSignupError");
  const succEl = document.getElementById("mailSignupSuccess");
  const btn = document.getElementById("btnSubmitMailSignup");

  const id = idInput ? idInput.value.trim() : "";
  const name = nameInput ? nameInput.value.trim() || id : id;
  const pw = pwInput ? pwInput.value.trim() : "";
  const email = `${id.toLowerCase()}@nunu.com`;

  if (!id || !pw) {
    if (errEl) {
      errEl.textContent = "아이디와 비밀번호를 모두 입력해주세요.";
      errEl.style.display = "block";
    }
    return;
  }

  if (id.length < 3) {
    if (errEl) {
      errEl.textContent = "아이디는 3자 이상이어야 합니다.";
      errEl.style.display = "block";
    }
    return;
  }

  if (pw.length < 4) {
    if (errEl) {
      errEl.textContent = "비밀번호는 4자 이상이어야 합니다.";
      errEl.style.display = "block";
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 계정 생성 중...`;
  }

  try {
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, email, password: pw })
    });
    const data = await res.json();

    if (data.success && data.user) {
      if (errEl) errEl.style.display = "none";
      if (succEl) {
        succEl.textContent = `🎉 환영합니다! 전용 메일(${data.user.email})이 생성되었습니다. 메일함으로 이동합니다...`;
        succEl.style.display = "block";
      }
      localStorage.setItem("nunu_current_user", JSON.stringify(data.user));
      currentUser = data.user;
      setTimeout(async () => {
        hideMailAuthModal();
        updateHeaderUserInfo();
        await loadMailbox("inbox");
      }, 700);
    } else {
      if (errEl) {
        errEl.textContent = data.message || "회원가입에 실패했습니다.";
        errEl.style.display = "block";
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.textContent = "서버 연결에 실패했습니다. 네트워크 상태를 확인해주세요.";
      errEl.style.display = "block";
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> 회원가입 및 메일 주소 개설`;
    }
  }
}

function handleLogout() {
  if (confirm("로그아웃 하시겠습니까?\n로그아웃 후 다른 기기 또는 다른 계정으로 로그인할 수 있습니다.")) {
    localStorage.removeItem("nunu_current_user");
    localStorage.removeItem("nunu_user");
    currentUser = null;
    allMails = [];
    currentViewingMail = null;
    updateHeaderUserInfo();
    closeMailReader();
    const listEl = document.getElementById("mailList");
    if (listEl) listEl.innerHTML = "";
    showMailAuthModal("login");
  }
}

// ==========================================
// 2. 메일함 데이터 로드 및 렌더링
// ==========================================
async function loadMailbox(box = currentBox) {
  if (!currentUser || !currentUser.id) {
    showMailAuthModal("login");
    return;
  }
  currentBox = box;
  const listEl = document.getElementById("mailList");
  const loadingEl = document.getElementById("mailLoading");
  const emptyEl = document.getElementById("mailEmpty");
  const boxTitleEl = document.getElementById("currentBoxTitle");
  const boxStatsEl = document.getElementById("boxStatsText");
  const navInboxBadge = document.getElementById("navInboxBadge");

  // 박스 타이틀 변경
  const boxTitles = {
    inbox: '<i class="fa-solid fa-inbox"></i> 받은 편지함',
    sent: '<i class="fa-regular fa-paper-plane"></i> 보낸 편지함',
    starred: '<i class="fa-regular fa-star"></i> 중요 편지함',
    trash: '<i class="fa-regular fa-trash-can"></i> 휴지통'
  };
  if (boxTitleEl) boxTitleEl.innerHTML = boxTitles[box] || "메일함";

  // 상세 읽기 뷰 닫기
  closeMailReader();

  if (loadingEl) loadingEl.style.display = "flex";
  if (listEl) listEl.innerHTML = "";
  if (emptyEl) emptyEl.style.display = "none";

  try {
    const url = `/api/mail/list?user_id=${encodeURIComponent(currentUser.id)}&box=${encodeURIComponent(box)}&q=${encodeURIComponent(searchQuery)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (loadingEl) loadingEl.style.display = "none";

    if (data && data.success) {
      allMails = data.mails || [];
      const unreadCount = data.unreadInbox || 0;

      if (navInboxBadge) {
        if (unreadCount > 0) {
          navInboxBadge.textContent = unreadCount > 99 ? "99+" : unreadCount;
          navInboxBadge.style.display = "inline-block";
        } else {
          navInboxBadge.style.display = "none";
        }
      }

      renderFilteredMails();
    } else {
      if (listEl) listEl.innerHTML = `<li style="padding: 30px; text-align: center; color: var(--danger); font-size: 13.5px;">메일을 불러오지 못했습니다.</li>`;
    }
  } catch (err) {
    if (loadingEl) loadingEl.style.display = "none";
    if (listEl) listEl.innerHTML = `<li style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 13.5px;">네트워크 연결을 확인해주세요.</li>`;
  }
}

function renderFilteredMails() {
  const listEl = document.getElementById("mailList");
  const emptyEl = document.getElementById("mailEmpty");
  const boxStatsEl = document.getElementById("boxStatsText");
  if (!listEl) return;

  let filtered = allMails;

  if (currentFilter === "unread") {
    filtered = allMails.filter(m => !m.isRead);
  } else if (currentFilter === "sms") {
    filtered = allMails.filter(m => m.mailType === "sms");
  }

  if (boxStatsEl) {
    boxStatsEl.textContent = `총 ${filtered.length}개`;
  }

  if (filtered.length === 0) {
    listEl.innerHTML = "";
    if (emptyEl) emptyEl.style.display = "flex";
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";

  listEl.innerHTML = filtered.map(mail => {
    const unreadClass = !mail.isRead ? "unread" : "";
    const isStarred = mail.isStarred;
    const mailType = mail.mailType || "mail";

    let avatarIcon = '<i class="fa-solid fa-envelope"></i>';
    let providerClass = 'provider-nunu';
    let tagBadge = '<span class="mail-tag-badge tag-nunu">nunu</span>';

    if (mailType === "sms") {
      avatarIcon = '<i class="fa-solid fa-comment-sms"></i>';
      tagBadge = '<span class="mail-tag-badge tag-sms">문자</span>';
    }

    const dateFormatted = formatDate(mail.createdAt);

    return `
      <li class="mail-item ${unreadClass}" data-mail-id="${mail.id}" onclick="openMailDetail(${mail.id})">
        <button type="button" class="mail-star-btn ${isStarred ? 'starred' : ''}" onclick="event.stopPropagation(); toggleMailStar(${mail.id}, ${isStarred})">
          <i class="${isStarred ? 'fa-solid' : 'fa-regular'} fa-star"></i>
        </button>

        <div class="mail-provider-avatar ${providerClass}">
          ${avatarIcon}
        </div>

        <div class="mail-sender-wrap">
          <strong class="mail-sender-name">${escapeHtml(mail.fromName || mail.fromEmail)}</strong>
          <span class="mail-sender-email">${escapeHtml(mail.fromEmail)}</span>
        </div>

        <div class="mail-content-wrap">
          <span class="mail-subject">${escapeHtml(mail.subject || '(제목 없음)')}</span>
          <span class="mail-snippet">- ${escapeHtml(mail.body.replace(/\n/g, ' '))}</span>
        </div>

        <div class="mail-meta-wrap">
          ${tagBadge}
          <span class="mail-date">${dateFormatted}</span>
          <div class="mail-item-actions">
            <button type="button" class="btn-item-action delete-hover" title="삭제" onclick="event.stopPropagation(); trashMailItem(${mail.id})">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      </li>
    `;
  }).join("");
}

// ==========================================
// 3. 메일 상세 읽기
// ==========================================
async function openMailDetail(mailId) {
  const mail = allMails.find(m => m.id === mailId);
  const readerView = document.getElementById("mailReaderView");
  const listContainer = document.getElementById("mailListContainer");
  const toolbarEl = document.querySelector(".mail-toolbar");

  if (!readerView) return;
  currentViewingMail = mail;

  // UI 필드 채우기
  document.getElementById("readerSubject").textContent = mail ? (mail.subject || "(제목 없음)") : "";
  document.getElementById("readerSenderName").textContent = mail ? (mail.fromName || mail.fromEmail) : "";
  document.getElementById("readerSenderEmail").textContent = mail ? mail.fromEmail : "";
  document.getElementById("readerToEmail").textContent = mail ? mail.toEmail : "";
  document.getElementById("readerDate").textContent = mail ? formatFullDate(mail.createdAt) : "";
  document.getElementById("readerBody").textContent = mail ? mail.body : "";

  // 아바타 & 뱃지
  const avatarEl = document.getElementById("readerSenderAvatar");
  const badgeEl = document.getElementById("readerProviderBadge");
  const starBtn = document.getElementById("btnReaderStar");

  if (avatarEl) {
    avatarEl.textContent = (mail.fromName || mail.fromEmail).charAt(0).toUpperCase();
  }
  if (badgeEl) {
    const mailType = mail ? mail.mailType : "mail";
    badgeEl.textContent = mailType === "sms" ? "nunu 문자" : "nunu 메일";
    badgeEl.className = "provider-pill tag-nunu";
  }
  if (starBtn) {
    starBtn.innerHTML = mail.isStarred ? '<i class="fa-solid fa-star" style="color: #f59e0b;"></i>' : '<i class="fa-regular fa-star"></i>';
  }

  // 읽음 처리 API 호출
  try {
    await fetch(`/api/mail/detail?id=${mailId}`);
    mail.isRead = true;
    // 목록 UI에서 읽음 처리 스타일 즉시 반영
    const itemEl = document.querySelector(`.mail-item[data-mail-id="${mailId}"]`);
    if (itemEl) itemEl.classList.remove("unread");
  } catch (e) {}

  // 뷰 전환
  if (listContainer) listContainer.style.display = "none";
  if (toolbarEl) toolbarEl.style.display = "none";
  readerView.style.display = "flex";
}

function closeMailReader() {
  const readerView = document.getElementById("mailReaderView");
  const listContainer = document.getElementById("mailListContainer");
  const toolbarEl = document.querySelector(".mail-toolbar");

  currentViewingMail = null;
  if (readerView) readerView.style.display = "none";
  if (listContainer) listContainer.style.display = "block";
  if (toolbarEl) toolbarEl.style.display = "flex";
}

// ==========================================
// 4. 메일 작성 모달
// ==========================================
function openComposeModal(replyTo = null) {
  if (!currentUser || !currentUser.id) {
    showMailAuthModal("login");
    return;
  }
  const modal = document.getElementById("composeModalOverlay");
  const toInput = document.getElementById("composeToInput");
  const subjectInput = document.getElementById("composeSubjectInput");
  const bodyInput = document.getElementById("composeBodyInput");
  const submitBtn = document.getElementById("btnSubmitSend");

  if (!modal) return;
  modal.style.display = "flex";

  if (replyTo) {
    // 답장 모드
    if (toInput) toInput.value = replyTo.fromEmail;
    const reSubject = replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`;
    if (subjectInput) subjectInput.value = reSubject;
    if (bodyInput) {
      bodyInput.value = `\n\n--- 원본 메시지 (${replyTo.fromEmail}) ---\n${replyTo.body}`;
      bodyInput.focus();
      bodyInput.setSelectionRange(0, 0);
    }
  } else {
    // 신규 작성 모드
    if (toInput) {
      toInput.value = "";
      toInput.focus();
    }
    if (subjectInput) subjectInput.value = "";
    if (bodyInput) bodyInput.value = "";
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>${composeType === 'sms' ? '문자 전송' : '메일 전송'}</span>`;
  }
}

function closeComposeModal() {
  const modal = document.getElementById("composeModalOverlay");
  if (modal) modal.style.display = "none";
}

async function handleSendMail(e) {
  if (e && e.preventDefault) e.preventDefault();
  const toInput = document.getElementById("composeToInput");
  const subjectInput = document.getElementById("composeSubjectInput");
  const bodyInput = document.getElementById("composeBodyInput");
  const submitBtn = document.getElementById("btnSubmitSend");

  const to = (toInput ? toInput.value : "").trim();
  const subject = (subjectInput ? subjectInput.value : "").trim();
  const body = (bodyInput ? bodyInput.value : "").trim();

  if (!to || !body) {
    alert("받는 사람과 메시지 내용을 입력해주세요.");
    return;
  }

  const cleanTo = to.toLowerCase().trim();
  if (cleanTo.includes("@") && !cleanTo.endsWith("@nunu.com")) {
    alert("nunu 메일은 nunu 회원(@nunu.com)에게만 전송할 수 있습니다.\n외부 메일(Gmail, Naver 등)로는 전송할 수 없습니다.");
    if (toInput) toInput.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 전송 중...`;
  }

  try {
    const res = await fetch("/api/mail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_id: currentUser.id,
        from_name: currentUser.name || currentUser.id,
        to: to,
        subject: subject,
        body: body,
        mail_type: composeType
      })
    });
    const data = await res.json();

    if (data && data.success) {
      alert(`성공: ${data.message}`);
      closeComposeModal();
      if (currentBox === "sent") {
        loadMailbox("sent");
      }
    } else {
      alert(`전송 실패: ${(data && data.message) ? data.message : '알 수 없는 오류'}`);
    }
  } catch (err) {
    alert("서버 통신 오류가 발생했습니다. 다시 시도해주세요.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>메일 전송</span>`;
    }
  }
}

// ==========================================
// 5. 메일 액션 (별표, 삭제 등)
// ==========================================
async function toggleMailStar(mailId, currentStarred) {
  const action = currentStarred ? "unstar" : "star";
  try {
    await fetch("/api/mail/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mail_id: mailId, action: action })
    });
    const target = allMails.find(m => m.id === mailId);
    if (target) target.isStarred = !currentStarred;
    renderFilteredMails();
  } catch (e) {}
}

async function trashMailItem(mailId) {
  if (currentBox === "trash") {
    if (!confirm("이 메일을 휴지통에서 완전히 영구 삭제하시겠습니까?")) return;
    try {
      await fetch("/api/mail/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mail_id: mailId, action: "delete" })
      });
      allMails = allMails.filter(m => m.id !== mailId);
      renderFilteredMails();
    } catch (e) {}
  } else {
    try {
      await fetch("/api/mail/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mail_id: mailId, action: "trash" })
      });
      allMails = allMails.filter(m => m.id !== mailId);
      renderFilteredMails();
    } catch (e) {}
  }
}

// ==========================================
// 6. 헬퍼 유틸리티
// ==========================================
function formatDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  if (isToday) {
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${mins}`;
  } else {
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${month}-${day}`;
  }
}

function formatFullDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// 9. 이벤트 리스너 바인딩
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initUser();
  loadMailbox("inbox");

  // 사이드바 토글 (모바일)
  const sidebarBtn = document.getElementById("btnSidebarToggle");
  const sidebar = document.getElementById("mailSidebar");
  if (sidebarBtn && sidebar) {
    sidebarBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }

  // 메일함 네비게이션 클릭
  document.querySelectorAll(".mailbox-nav .nav-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelectorAll(".mailbox-nav .nav-item").forEach(el => el.classList.remove("active"));
      item.classList.add("active");
      const box = item.getAttribute("data-box");
      loadMailbox(box);
      if (sidebar) sidebar.classList.remove("open");
    });
  });

  // 필터 탭 클릭
  document.querySelectorAll(".filter-pills .filter-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".filter-pills .filter-pill").forEach(el => el.classList.remove("active"));
      pill.classList.add("active");
      currentFilter = pill.getAttribute("data-filter");
      renderFilteredMails();
    });
  });

  // 검색
  const searchInput = document.getElementById("mailSearchInput");
  const clearBtn = document.getElementById("btnClearSearch");
  if (searchInput) {
    let timer = null;
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      if (clearBtn) clearBtn.style.display = searchQuery ? "flex" : "none";
      clearTimeout(timer);
      timer = setTimeout(() => {
        loadMailbox(currentBox);
      }, 300);
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      searchQuery = "";
      clearBtn.style.display = "none";
      loadMailbox(currentBox);
    });
  }

  // 새로고침 버튼
  const refreshBtn = document.getElementById("btnRefreshMail");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadMailbox(currentBox);
    });
  }

  // 모달 버튼들
  const openComposeBtn = document.getElementById("btnOpenCompose");
  const closeComposeBtn = document.getElementById("btnCloseCompose");
  const cancelComposeBtn = document.getElementById("btnCancelCompose");
  if (openComposeBtn) openComposeBtn.addEventListener("click", () => openComposeModal());
  if (closeComposeBtn) closeComposeBtn.addEventListener("click", closeComposeModal);
  if (cancelComposeBtn) cancelComposeBtn.addEventListener("click", closeComposeModal);

  // 메시지 유형 탭 (메일 vs 문자)
  document.querySelectorAll(".compose-type-tabs .type-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".compose-type-tabs .type-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      composeType = tab.getAttribute("data-type");
      const subRow = document.getElementById("composeSubjectRow");
      const subInput = document.getElementById("composeSubjectInput");
      const sendBtnText = document.querySelector("#btnSubmitSend span");

      if (composeType === "sms") {
        if (subRow) subRow.style.display = "none";
        if (subInput) subInput.required = false;
        if (sendBtnText) sendBtnText.textContent = "문자 전송";
      } else {
        if (subRow) subRow.style.display = "flex";
        if (subInput) subInput.required = true;
        if (sendBtnText) sendBtnText.textContent = "메일 전송";
      }
    });
  });

  // 상세 읽기 뷰 버튼들
  const readerBackBtn = document.getElementById("btnReaderBack");
  if (readerBackBtn) readerBackBtn.addEventListener("click", closeMailReader);

  const readerReplyBtn = document.getElementById("btnReaderReply");
  const readerReplyBottom = document.getElementById("btnReaderReplyBottom");
  if (readerReplyBtn) readerReplyBtn.addEventListener("click", () => openComposeModal(currentViewingMail));
  if (readerReplyBottom) readerReplyBottom.addEventListener("click", () => openComposeModal(currentViewingMail));

  const readerStarBtn = document.getElementById("btnReaderStar");
  if (readerStarBtn) {
    readerStarBtn.addEventListener("click", () => {
      if (currentViewingMail) {
        toggleMailStar(currentViewingMail.id, currentViewingMail.isStarred);
        currentViewingMail.isStarred = !currentViewingMail.isStarred;
        readerStarBtn.innerHTML = currentViewingMail.isStarred ? '<i class="fa-solid fa-star" style="color: #f59e0b;"></i>' : '<i class="fa-regular fa-star"></i>';
      }
    });
  }

  const readerDeleteBtn = document.getElementById("btnReaderDelete");
  if (readerDeleteBtn) {
    readerDeleteBtn.addEventListener("click", () => {
      if (currentViewingMail) {
        trashMailItem(currentViewingMail.id);
        closeMailReader();
      }
    });
  }

  // 상단 로그아웃 버튼 (계정 전환)
  const logoutBtn = document.getElementById("btnLogoutMail");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  // 로그인 필수 모달 탭 전환 버튼
  const tabLogin = document.getElementById("tabMailLogin");
  const tabSignup = document.getElementById("tabMailSignup");
  if (tabLogin) {
    tabLogin.addEventListener("click", () => switchMailAuthTab("login"));
  }
  if (tabSignup) {
    tabSignup.addEventListener("click", () => switchMailAuthTab("signup"));
  }

  // 자동 백그라운드 폴링 (30초마다 받은 편지함 미확인 메일 갱신)
  setInterval(() => {
    if (currentUser && currentUser.id && currentBox === "inbox" && !currentViewingMail) {
      loadMailbox("inbox");
    }
  }, 30000);
});
