/**
 * nunu Portal Application Logic
 */

// ==========================================
// 1. 상태 및 기본 데이터 정의
// ==========================================

// ==========================================
// 0. 전역 유틸리티 함수
// ==========================================
function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function showToastNotice(msg) {
  let toast = document.getElementById("nunuToastNotice");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "nunuToastNotice";
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: rgba(15, 23, 42, 0.92);
      color: #ffffff;
      padding: 10px 22px;
      border-radius: 30px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 100000;
      opacity: 0;
      transition: all 0.25s ease;
      pointer-events: none;
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      gap: 9px;
    `;
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> <span>${escapeHtml(msg)}</span>`;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
  }, 2500);
}

// 실시간 급상승 검색어 데이터
const TRENDING_KEYWORDS = [
  { rank: 1, text: "가을 단풍 절정 명소", trend: "up", count: "+3,240" },
  { rank: 2, text: "오늘의 날씨와 미세먼지", trend: "up", count: "+1,420" },
  { rank: 3, text: "인공지능 최신 트렌드", trend: "same", count: "유지" },
  { rank: 4, text: "코스피 코스닥 마감 시세", trend: "up", count: "+890" },
  { rank: 5, text: "주말 여행지 추천 베스트", trend: "down", count: "-120" },
  { rank: 6, text: "프로야구 하이라이트", trend: "up", count: "+540" },
  { rank: 7, text: "환율 전망 및 미국 증시", trend: "same", count: "유지" },
  { rank: 8, text: "넷플릭스 신작 오리지널", trend: "up", count: "+310" },
  { rank: 9, text: "건강한 환절기 식단 가이드", trend: "down", count: "-80" },
  { rank: 10, text: "최신 스마트폰 비교 분석", trend: "up", count: "+220" },
];

// 기본 북마크 목록
const DEFAULT_BOOKMARKS = [
  { id: "bm_bw", name: "북웨이브", url: "https://bookwave-server.onrender.com", icon: "📚", bg: "linear-gradient(135deg, #4f46e5, #7c3aed)" },
  { id: "bm_1", name: "네이버", url: "https://www.naver.com", icon: "N", bg: "#03c75a" },
  { id: "bm_2", name: "구글", url: "https://www.google.com", icon: "G", bg: "#4285f4" },
  { id: "bm_3", name: "유튜브", url: "https://www.youtube.com", icon: "▶", bg: "#ef4444" },
  { id: "bm_4", name: "쿠팡", url: "https://www.coupang.com", icon: "C", bg: "#a855f7" },
  { id: "bm_5", name: "넷플릭스", url: "https://www.netflix.com", icon: "N", bg: "#e11d48" },
  { id: "bm_6", name: "인스타그램", url: "https://www.instagram.com", icon: "📷", bg: "#ec4899" },
  { id: "bm_7", name: "깃허브", url: "https://github.com", icon: "🐙", bg: "#334155" },
];

// 뉴스 카테고리별 데이터
const NEWS_DATA = {
  all: {
    headline: {
      title: "글로벌 테크 기업들, 차세대 인공지능 혁신 모델 대거 공개",
      desc: "사람 수준의 정밀한 추론 및 다국어 실시간 번역 기능을 갖춘 최신 초거대 AI 모델들이 잇달아 발표되며 글로벌 산업 전반에 큰 변화가 예고되고 있습니다.",
      img: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=60",
      press: "연합뉴스",
      time: "방금 전"
    },
    items: [
      { title: "글로벌 테크 기업들, 차세대 생산성 소프트웨어 대규모 업데이트 예고", press: "IT데일리", time: "10분 전" },
      { title: "한국은행, 기준금리 동결 전망 우세... 물가 안정 기조 지속", press: "경제투데이", time: "25분 전" },
      { title: "전국 대체로 맑고 선선한 전형적인 가을 날씨 이어져", press: "기상뉴스", time: "40분 전" },
      { title: "국내 프로스포츠 가을 잔치 개막, 관중 열기 후끈", press: "스포츠월드", time: "1시간 전" },
      { title: "국립중앙박물관 특별 기획전, 개막 사흘 만에 예매 매진 돌풍", press: "문화저널", time: "1시간 전" }
    ]
  },
  tech: {
    headline: {
      title: "차세대 온디바이스 AI 칩셋 공개, 연산 속도 3배 향상",
      desc: "초경량 고성능 뉴럴 프로세서가 탑재되어 클라우드 연결 없이도 대규모 언어 모델을 실시간 구동할 수 있게 되었습니다.",
      img: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=60",
      press: "테크인사이트",
      time: "15분 전"
    },
    items: [
      { title: "오픈소스 AI 생태계 급성장... 개발자 커뮤니티 활기", press: "코드리뷰", time: "30분 전" },
      { title: "웹 브라우저의 진화: AI 에이전트와 통합된 미래 UI 모델", press: "웹트렌드", time: "1시간 전" },
      { title: "양자 컴퓨팅 상용화 한걸음 더... 오류 정정 알고리즘 발표", press: "사이언스랩", time: "2시간 전" },
      { title: "글로벌 반도체 공급망 재편 속 국내 부품사 수혜 기대", press: "전자신문", time: "3시간 전" }
    ]
  },
  economy: {
    headline: {
      title: "코스피 2,650선 안착... 기술주 및 반도체 강세 주도",
      desc: "외국인과 기관의 동반 순매수세가 유입되며 지수가 상승 마감했습니다. 환율은 소폭 하락 안정세를 보였습니다.",
      img: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=60",
      press: "금융타임스",
      time: "20분 전"
    },
    items: [
      { title: "원/달러 환율 1,330원대 초반 하향 안정 흐름 지속", press: "외환포커스", time: "45분 전" },
      { title: "정부, 스타트업 및 미래 신산업 육성 펀드 2조원 추가 조성", press: "경제종합", time: "1시간 전" },
      { title: "가계대출 증가세 둔화... 주담대 금리 변동 추이 주목", press: "머니포스트", time: "2시간 전" },
      { title: "전기차 배터리 핵심 원자재 가격 안정화 추세", press: "인더스트리", time: "3시간 전" }
    ]
  },
  life: {
    headline: {
      title: "단풍 절정기 맞은 전국 명산... 이번 주말 나들이 인파 예상",
      desc: "설악산과 오대산을 시작으로 전국 주요 산들이 붉게 물들며 가을 정취를 만끽하려는 등산객들의 발길이 이어지고 있습니다.",
      img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=60",
      press: "라이프앤트립",
      time: "35분 전"
    },
    items: [
      { title: "환절기 면역력 높이는 제철 과일과 영양 관리 꿀팁", press: "헬스케어", time: "50분 전" },
      { title: "도심 속 숨은 힐링 명소 베스트 5... 이번 주말 도서관 산책", press: "도시이야기", time: "1시간 전" },
      { title: "환경보호 실천하는 '제로 웨이스트' 캠페인 젊은 층서 확산", press: "에코라이프", time: "2시간 전" },
      { title: "가을 뮤직 페스티벌 잇달아 개최... 다채로운 문화 공연", press: "컬처나우", time: "3시간 전" }
    ]
  },
  sports: {
    headline: {
      title: "손흥민 멀티골 폭발! 팀 승리 견인하며 평점 9.2 기록",
      desc: "환상적인 감아차기 슛과 침착한 페널티킥 성공으로 전성기 폼을 과시하며 현지 언론의 극찬을 받았습니다.",
      img: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=60",
      press: "스포츠투데이",
      time: "10분 전"
    },
    items: [
      { title: "한국 야구 국가대표팀 명단 최종 발표... 신예 돌풍 기대", press: "베이스볼24", time: "1시간 전" },
      { title: "이강인 날카로운 킬패스로 결승골 어시스트 기록", press: "풋볼코리아", time: "2시간 전" },
      { title: "국내 골프 투어 메이저 대회, 갤러리 2만여 명 운집", press: "골프매거진", time: "3시간 전" },
      { title: "배구 V리그 개막전 티켓 5분 만에 전석 매진", press: "스파이크", time: "4시간 전" }
    ]
  }
};


// 증시 데이터
const STOCK_DATA = {
  kospi: {
    name: "코스피",
    price: "2,654.30",
    change: "+18.52 (+0.70%)",
    isUp: true,
    path: "M 0 45 Q 40 50, 70 35 T 140 28 T 210 20 T 280 10"
  },
  kosdaq: {
    name: "코스닥",
    price: "772.45",
    change: "+5.12 (+0.67%)",
    isUp: true,
    path: "M 0 40 Q 50 30, 90 35 T 160 22 T 230 18 T 280 12"
  },
  usd: {
    name: "환율(USD/KRW)",
    price: "1,332.50",
    change: "-4.20 (-0.31%)",
    isUp: false,
    path: "M 0 15 Q 60 18, 110 32 T 190 38 T 240 45 T 280 48"
  }
};

// ==========================================
// 2. 초기화 및 이벤트 리스너 설정
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  initTopBrowserBar();
  initClock();
  initTrendingTicker();
  initSearch();
  initBookmarks();
  initNewsSection();
  initNunuAi();
  initStockWidget();
  initWeatherWidget();
  initTodoWidget();
  initAuthDemo();
  initTheme();
  initBookwaveIntegration();
  initDeviceConnect();
  initHomeAds();
  initAiGuideModal();
});

// ==========================================
// 3. 상단 시간 & 날짜 시계
// ==========================================
function initClock() {
  const dateEl = document.getElementById("currentDate");
  const timeEl = document.getElementById("currentTime");

  const update = () => {
    const now = new Date();
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const day = days[now.getDay()];

    let hours = now.getHours();
    let minutes = now.getMinutes();
    const pad = (n) => String(n).padStart(2, "0");

    if (dateEl) dateEl.textContent = `${month}월 ${date}일 (${day})`;
    if (timeEl) timeEl.textContent = `${pad(hours)}:${pad(minutes)}`;
  };

  update();
  setInterval(update, 1000);
}

// ==========================================
// 4. 실시간 급상승 검색어 티커 & 드롭다운
// ==========================================
function initTrendingTicker() {
  const tickerRank = document.getElementById("tickerRank");
  const tickerText = document.getElementById("tickerText");
  const trendingTicker = document.getElementById("trendingTicker");
  const trendingDropdown = document.getElementById("trendingDropdown");
  const trendingList = document.getElementById("trendingList");
  const searchInput = document.getElementById("searchInput");

  let currentIndex = 0;

  // 전체 드롭다운 목록 렌더링
  if (trendingList) {
    trendingList.innerHTML = TRENDING_KEYWORDS.map(item => `
      <li class="trending-item" data-keyword="${item.text}">
        <div class="trending-item-left">
          <span class="rank-num ${item.rank <= 3 ? 'top3' : ''}">${item.rank}</span>
          <span class="keyword-name">${item.text}</span>
        </div>
        <span class="trending-trend ${item.trend}">${item.count}</span>
      </li>
    `).join("");

    trendingList.querySelectorAll(".trending-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const kw = item.dataset.keyword;
        if (searchInput) searchInput.value = kw;
        trendingDropdown.classList.remove("show");
        performSearch(kw);
      });
    });
  }

  // 롤링 애니메이션 (3.5초 주기)
  const roll = () => {
    currentIndex = (currentIndex + 1) % TRENDING_KEYWORDS.length;
    const item = TRENDING_KEYWORDS[currentIndex];
    if (tickerRank) tickerRank.textContent = item.rank;
    if (tickerText) tickerText.textContent = item.text;
  };
  setInterval(roll, 3500);

  // 토글 드롭다운
  if (trendingTicker && trendingDropdown) {
    trendingTicker.addEventListener("click", (e) => {
      e.stopPropagation();
      trendingDropdown.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
      if (!trendingTicker.contains(e.target)) {
        trendingDropdown.classList.remove("show");
      }
    });
  }
}

// ==========================================
// 5. nunu 단일 통합 검색 시스템
// ==========================================

// ==========================================
// 4-1. 크롬 멀티 탭 & 브라우저 쉘 인터페이스
// ==========================================
let chromeTabs = [
  {
    id: "tab_portal_home",
    type: "portal",
    title: "누누",
    icon: "fa-solid fa-compass",
    iconColor: "#4f46e5",
    url: "https://nunu.com/",
    closable: false
  }
];
let activeChromeTabId = "tab_portal_home";


// ==========================================
// nunu (웹) vs nunuSky (앱) 동적 브랜딩 모드
// ==========================================
function isNunuSkyAppMode() {
  const p = new URLSearchParams(window.location.search);
  if (p.get("app") === "nunusky" || p.get("mode") === "app") {
    return true;
  }
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  if (window.navigator.standalone === true) {
    return true;
  }
  return false;
}

function applyBrandingMode() {
  const isApp = isNunuSkyAppMode();
  const badge = document.getElementById("topBrandBadge") || document.querySelector(".nunusky-brand-badge");
  const dlBtn = document.getElementById("btnDownloadApp");
  const sideAiBtn = document.getElementById("btnToggleSideAi");
  const sideAiPanel = document.getElementById("aiSidePanel");

  const homeTab = chromeTabs.find(t => t.id === "tab_portal_home");

  if (isApp) {
    // [앱 모드]: '누누스카이'
    document.title = "누누스카이";
    document.body.classList.add("app-mode");
    if (homeTab) {
      homeTab.title = "누누스카이";
    }
    if (badge) {
      badge.innerHTML = '<i class="fa-solid fa-cloud-bolt" style="color:#38bdf8;"></i> <span>누누스카이</span>';
      badge.title = "누누스카이 홈";
    }
    // 앱 모드에서는 '누누스카이 앱 다운로드' 버튼 숨김 (이미 앱이므로 불필요)
    if (dlBtn) dlBtn.style.setProperty("display", "none", "important");
    document.querySelectorAll(".app-download-only-web, a[href='/download/nunusky'], #btnDownloadApp, #btnInstallNunuSky").forEach(el => {
      el.style.setProperty("display", "none", "important");
    });

    // AI 챗봇은 누누스카이(앱)에서만 활성화 및 표시!
    if (sideAiBtn) sideAiBtn.style.setProperty("display", "inline-flex", "important");
  } else {
    // [웹 모드]: '누누'
    document.title = "누누";
    document.body.classList.remove("app-mode");
    if (homeTab) {
      homeTab.title = "누누";
    }
    if (badge) {
      badge.innerHTML = '<i class="fa-solid fa-compass" style="color:#38bdf8;"></i> <span>누누</span>';
      badge.title = "누누 포털 홈";
    }
    // 웹 모드에서는 '누누스카이 앱 다운로드' 버튼만 단독 노출!
    if (dlBtn) dlBtn.style.setProperty("display", "inline-flex", "important");
    document.querySelectorAll(".app-download-only-web, a[href='/download/nunusky'], #btnDownloadApp").forEach(el => {
      el.style.setProperty("display", "inline-flex", "important");
    });

    // 웹 모드에서는 AI 챗봇 버튼과 패널을 완전 숨김!
    if (sideAiBtn) sideAiBtn.style.setProperty("display", "none", "important");
    if (sideAiPanel) {
      sideAiPanel.classList.remove("open");
      sideAiPanel.style.display = "none";
    }
  }
}

function renderChromeTabs() {
  applyBrandingMode();
  const strip = document.getElementById("chromeTabStrip");
  if (!strip) return;

  strip.innerHTML = "";

  chromeTabs.forEach((tab, idx) => {
    const tabEl = document.createElement("div");
    tabEl.className = "chrome-tab" + (tab.id === activeChromeTabId ? " active" : "");
    tabEl.dataset.tabId = tab.id;

    const nextTab = chromeTabs[idx + 1];
    if (nextTab && nextTab.id === activeChromeTabId) {
      tabEl.classList.add("next-to-active");
    }

    // Icon
    const iconSpan = document.createElement("span");
    iconSpan.className = "chrome-tab-icon";
    if (tab.icon && tab.icon.startsWith("fa-")) {
      iconSpan.innerHTML = `<i class="${tab.icon}" style="${tab.iconColor ? 'color:' + tab.iconColor : ''}"></i>`;
    } else {
      iconSpan.innerHTML = `<i class="fa-solid fa-globe" style="color: #4285f4;"></i>`;
    }

    // Title
    const titleSpan = document.createElement("span");
    titleSpan.className = "chrome-tab-title";
    titleSpan.textContent = tab.title || "새 탭";
    titleSpan.title = tab.title || "새 탭";

    tabEl.appendChild(iconSpan);
    tabEl.appendChild(titleSpan);

    // Close button
    if (tab.closable !== false) {
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "chrome-tab-close";
      closeBtn.title = "탭 닫기 (Ctrl+W)";
      closeBtn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeChromeTab(tab.id);
      });
      tabEl.appendChild(closeBtn);
    }

    tabEl.addEventListener("click", () => {
      activateChromeTab(tab.id);
    });

    strip.appendChild(tabEl);
  });

  const activeEl = strip.querySelector(".chrome-tab.active");
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }
}

function activateChromeTab(tabId) {
  const tab = chromeTabs.find(t => t.id === tabId);
  if (!tab) return;

  activeChromeTabId = tabId;

  // 1. Omnibox 주소창 업데이트
  const input = document.getElementById("browserUrlInput");
  const secIcon = document.getElementById("omniboxSecurityIcon");
  if (input) {
    input.value = tab.url || "";
  }
  if (secIcon) {
    if (tab.url && tab.url.startsWith("https://")) {
      secIcon.className = "fa-solid fa-lock omnibox-security-icon";
      secIcon.style.color = "#10b981";
    } else {
      secIcon.className = "fa-solid fa-shield-halved omnibox-security-icon";
      secIcon.style.color = "#6366f1";
    }
  }

  // 2. 뷰 토글
  const portalWrapper = document.getElementById("portalHomeWrapper");
  const tabViews = document.getElementById("chromeTabViews");

  if (tab.type === "portal") {
    if (portalWrapper) portalWrapper.style.display = "block";
    if (tabViews) tabViews.style.display = "none";
  } else {
    if (portalWrapper) portalWrapper.style.display = "none";
    if (tabViews) tabViews.style.display = "block";

    let viewEl = document.getElementById("tabView_" + tab.id);
    if (!viewEl) {
      viewEl = createTabViewElement(tab);
      tabViews.appendChild(viewEl);
    }

    Array.from(tabViews.children).forEach(child => {
      child.style.display = child.id === ("tabView_" + tab.id) ? "block" : "none";
    });
  }

  renderChromeTabs();
}

function escapeHtmlForTab(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// 5-1. nunu 포털 다중 검색 엔진 렌더러 (Google, Naver, YouTube, Daum, 나무위키)
// ==========================================
let activeInlineYtPlayerId = null;

function formatAiSummaryHtml(summaryText) {
  if (!summaryText) return '';
  let clean = escapeHtmlForTab(summaryText);
  // Convert **bold** to <strong>bold</strong>
  clean = clean.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Format bullet points
  clean = clean.replace(/^[•\-]\s*(.*)$/gm, '<div style="display:flex; align-items:flex-start; gap:8px; margin: 4px 0;"><span style="color:#0ea5e9;">•</span><span>$1</span></div>');
  return clean;
function renderEngineSearchInterface(container, data, currentEngine = "all") {
  if (!container) return;

  const query = data.query || "";
  const googleList = data.googleResults || [];
  const naverList = data.naverResults || [];
  const ytList = data.youtubeResults || [];
  const daumList = data.daumResults || [];
  const namuList = data.namuResults || [];
  const unifiedList = data.results || [];
  const aiSummary = data.aiSummary || "";

  const encQ = encodeURIComponent(query);

  let activeList = [];

  if (currentEngine === "google") {
    activeList = googleList.length > 0 ? googleList : unifiedList.filter(r => r.source === "Google");
  } else if (currentEngine === "naver") {
    activeList = naverList.length > 0 ? naverList : unifiedList.filter(r => r.source === "Naver");
  } else if (currentEngine === "youtube") {
    activeList = ytList.length > 0 ? ytList : unifiedList.filter(r => r.source === "YouTube");
  } else if (currentEngine === "daum") {
    activeList = daumList.length > 0 ? daumList : unifiedList.filter(r => r.source === "Daum");
  } else if (currentEngine === "namu") {
    activeList = namuList.length > 0 ? namuList : unifiedList.filter(r => r.source === "나무위키");
  } else {
    // all
    activeList = unifiedList;
  }

  if (activeList.length === 0 && unifiedList.length > 0) {
    activeList = unifiedList;
  }

  let html = `
    <!-- 1. Spacious Engine Navigation Tabs -->
    <div class="search-engine-tabs">
      <button type="button" class="search-engine-tab tab-all ${currentEngine === 'all' ? 'active' : ''}" data-target-engine="all">
        <i class="fa-solid fa-layer-group"></i> 통합 검색
        <span class="engine-tab-badge">${unifiedList.length}</span>
      </button>
      <button type="button" class="search-engine-tab tab-google ${currentEngine === 'google' ? 'active' : ''}" data-target-engine="google">
        <i class="fa-brands fa-google" style="color: #4285f4;"></i> Google 검색
        <span class="engine-tab-badge">${googleList.length}</span>
      </button>
      <button type="button" class="search-engine-tab tab-naver ${currentEngine === 'naver' ? 'active' : ''}" data-target-engine="naver">
        <span class="naver-badge-icon">N</span> Naver 검색
        <span class="engine-tab-badge">${naverList.length}</span>
      </button>
      <button type="button" class="search-engine-tab tab-youtube ${currentEngine === 'youtube' ? 'active' : ''}" data-target-engine="youtube">
        <i class="fa-brands fa-youtube" style="color: #ef4444;"></i> YouTube 동영상
        <span class="engine-tab-badge">${ytList.length}</span>
      </button>
      <button type="button" class="search-engine-tab tab-daum ${currentEngine === 'daum' ? 'active' : ''}" data-target-engine="daum">
        <strong style="color: #0284c7;">D</strong> Daum 검색
        <span class="engine-tab-badge">${daumList.length}</span>
      </button>
      <button type="button" class="search-engine-tab tab-namu ${currentEngine === 'namu' ? 'active' : ''}" data-target-engine="namu">
        <i class="fa-solid fa-book" style="color: #00a495;"></i> 나무위키
        <span class="engine-tab-badge">${namuList.length}</span>
      </button>
    </div>
  `;

  // 2. AI Overview Card (네이버/구글 스타일 최상단 AI 요약 브리핑)
  if (aiSummary) {
    html += `
      <div class="ai-overview-card">
        <div class="ai-overview-header">
          <div class="ai-overview-title">
            <div class="ai-overview-sparkle"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
            <span>nunu AI 실시간 요약 브리핑</span>
          </div>
          <span class="ai-overview-badge"><i class="fa-solid fa-bolt"></i> AI Overview</span>
        </div>
        <div class="ai-overview-body">${formatAiSummaryHtml(aiSummary)}</div>
        <div class="ai-overview-footer">
          <span><i class="fa-solid fa-circle-info"></i> 웹 실시간 5대 포털 데이터를 종합하여 AI가 생성한 브리핑입니다.</span>
          <div class="ai-overview-actions">
            <button type="button" class="btn-ai-overview-action btn-copy-ai-summary" title="요약 복사">
              <i class="fa-regular fa-copy"></i> 복사
            </button>
            <button type="button" class="btn-ai-overview-action btn-ask-side-ai" data-query="${escapeHtmlForTab(query)}" title="AI Chat 사이드바에서 대화 계속하기">
              <i class="fa-solid fa-comments"></i> AI에게 더 물어보기
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 3. Results Container
  html += `<div class="engine-results-content">`;

  if (activeList.length === 0) {
    html += `
      <div style="text-align: center; padding: 40px; color: #64748b;">
        <i class="fa-solid fa-circle-info" style="font-size: 28px; margin-bottom: 12px; color: #94a3b8;"></i>
        <p>해당 엔진의 실시간 검색 결과를 찾지 못했습니다.</p>
      </div>
    `;
  } else if (currentEngine === "youtube") {
    // YouTube specific video layout
    activeList.forEach((item, idx) => {
      const vid = item.videoId || "";
      const thumb = item.thumbnail || (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : "");
      const channel = item.channel || item.source || "YouTube";
      const playerId = `ytPlayer_${container.id || 'box'}_${idx}`;

      html += `
        <div class="yt-search-card" id="card_${playerId}">
          <div class="yt-search-thumb-box" data-video-id="${vid}" data-player-id="${playerId}">
            <img src="${thumb}" alt="${escapeHtmlForTab(item.title)}" loading="lazy">
            <div class="yt-thumb-play-overlay">
              <i class="fa-solid fa-circle-play"></i>
            </div>
          </div>
          <div class="yt-search-info">
            <div>
              <h3 class="yt-search-title" data-video-id="${vid}" data-player-id="${playerId}">${escapeHtmlForTab(item.title)}</h3>
              <div class="yt-search-channel"><i class="fa-brands fa-youtube" style="color:#ef4444;"></i> ${escapeHtmlForTab(channel)}</div>
            </div>
            <div class="yt-card-actions">
              ${vid ? `<button type="button" class="btn-yt-play-inline" data-video-id="${vid}" data-player-id="${playerId}"><i class="fa-solid fa-play"></i> 누누 포털에서 바로 재생</button>` : ''}
              <a href="${escapeHtmlForTab(item.url)}" target="_blank" rel="noopener noreferrer" class="btn-yt-external">YouTube에서 보기 <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
            </div>
            <div id="${playerId}" class="yt-player-slot" style="display:none;"></div>
          </div>
        </div>
      `;
    });
  } else {
    // Standard Card layout (Google, Naver, Daum, NamuWiki, All)
    activeList.forEach((item, idx) => {
      let iconHtml = '<i class="fa-solid fa-globe" style="color: #4f46e5;"></i>';
      if (item.source === "Google") {
        iconHtml = '<i class="fa-brands fa-google" style="color: #4285f4;"></i>';
      } else if (item.source === "Naver") {
        iconHtml = '<span class="naver-badge-icon" style="width:16px; height:16px; font-size:10px;">N</span>';
      } else if (item.source === "YouTube") {
        iconHtml = '<i class="fa-brands fa-youtube" style="color: #ef4444;"></i>';
      } else if (item.source === "Daum") {
        iconHtml = '<strong style="color: #0284c7; font-size:12px;">D</strong>';
      } else if (item.source === "나무위키" || item.source === "Wikipedia") {
        iconHtml = '<i class="fa-solid fa-book" style="color: #00a495;"></i>';
      }

      html += `
        <div class="search-result-card" style="margin-bottom: 12px;">
          <div class="result-card-header">
            <span class="result-source-badge">${iconHtml} ${escapeHtmlForTab(item.source || '웹')}</span>
            <span class="result-url-preview">${escapeHtmlForTab(item.domain || item.url || '')}</span>
          </div>
          <h3 class="result-title">
            <a href="${escapeHtmlForTab(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtmlForTab(item.title)}</a>
          </h3>
          <p class="result-snippet">${escapeHtmlForTab(item.snippet || '')}</p>
        </div>
      `;
    });
  }

  html += `</div>`;
  container.innerHTML = html;

  // Bind Tab Click Handlers
  container.querySelectorAll(".search-engine-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetEng = btn.dataset.targetEngine || "all";
      renderEngineSearchInterface(container, data, targetEng);
    });
  });

  // Copy AI Summary Handler
  const copyBtn = container.querySelector(".btn-copy-ai-summary");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      if (aiSummary) {
        navigator.clipboard.writeText(aiSummary).then(() => {
          copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 복사 완료!';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> 복사';
          }, 2000);
        });
      }
    });
  }

  // Ask Side AI Handler
  const askBtn = container.querySelector(".btn-ask-side-ai");
  if (askBtn) {
    askBtn.addEventListener("click", () => {
      toggleAiSidePanel(true);
      const prompt = `'${query}'에 대해 검색 결과를 보고 있는데, 주요 핵심을 더 자세히 설명해줘.`;
      sendAiSideMessage(prompt);
    });
  }

  // Bind YouTube Inline Player Handlers
  container.querySelectorAll(".btn-yt-play-inline, .yt-search-thumb-box, .yt-search-title").forEach(el => {
    el.addEventListener("click", () => {
      const vid = el.dataset.videoId;
      const pId = el.dataset.playerId;
      if (!vid || !pId) return;

      const pSlot = container.querySelector("#" + pId);
      if (!pSlot) return;

      if (pSlot.style.display === "block") {
        pSlot.style.display = "none";
        pSlot.innerHTML = "";
      } else {
        container.querySelectorAll(".yt-player-slot").forEach(s => {
          s.style.display = "none";
          s.innerHTML = "";
        });

        pSlot.style.display = "block";
        pSlot.innerHTML = `
          <div class="yt-inline-player-box">
            <iframe src="https://www.youtube-nocookie.com/embed/${vid}?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
          </div>
        `;
      }
    });
  });
}

async function loadTabSearchResults(query, tabId, initialEngine = "all") {
  const container = document.getElementById('tabSearchResults_' + tabId);
  if (!container) return;

  try {
    const res = await fetch('/api/search?q=' + encodeURIComponent(query));
    if (!res.ok) throw new Error('Search failed: ' + res.status);
    const data = await res.json();
    renderEngineSearchInterface(container, data, initialEngine);
  } catch (err) {
    console.warn('Tab search fetch error:', err);
    container.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #64748b;">
        <p>실시간 외부 검색 결과를 가져오는 중 문제가 발생했습니다.</p>
        <p style="margin-top: 8px;"><a href="https://www.google.com/search?q=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5; font-weight:700;">Google 공식 검색 결과 새 창으로 보기 ↗</a></p>
      </div>
    `;
  }
}
function createTabViewElement(tab) {
  const viewEl = document.createElement("div");
  viewEl.id = "tabView_" + tab.id;
  viewEl.style.width = "100%";
  viewEl.style.height = "calc(100vh - 86px)";
  viewEl.style.overflowY = "auto";

  // 1. Chrome New Tab
  if (tab.type === "newtab") {
    const isApp = isNunuSkyAppMode();
    const logoMarkup = isApp ? `
      <div class="newtab-logo">
        <span style="color:#0ea5e9;"><i class="fa-solid fa-cloud-bolt"></i></span>
        <span style="font-size: 40px; font-weight: 900; color: #0ea5e9; margin-left: 8px;">누누스카이</span>
      </div>
    ` : `
      <div class="newtab-logo">
        <span style="color:#4285f4;">n</span><span style="color:#ea4335;">u</span><span style="color:#fbbc05;">n</span><span style="color:#34a853;">u</span>
        <span style="font-size: 26px; font-weight: 800; color: #4f46e5; margin-left: 8px;">누누</span>
      </div>
    `;

    viewEl.innerHTML = `
      <div class="chrome-newtab-container">
        ${logoMarkup}
        <div class="newtab-search-box">
          <i class="fa-solid fa-magnifying-glass" style="color: #9aa0a6;"></i>
          <input type="text" id="newtabSearchInput_${tab.id}" placeholder="Google 검색 또는 웹 주소 입력" autocomplete="off">
        </div>
        <div class="newtab-grid">
          <div class="newtab-tile" data-action="portal">
            <div class="newtab-tile-icon" style="background: linear-gradient(135deg, #4f46e5, #7c3aed);"><i class="fa-solid fa-compass"></i></div>
            <span class="newtab-tile-label">nunu 포털</span>
          </div>
          <div class="newtab-tile" data-action="ai">
            <div class="newtab-tile-icon" style="background: linear-gradient(135deg, #8b5cf6, #ec4899);"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
            <span class="newtab-tile-label">nunu AI Pro</span>
          </div>
          <div class="newtab-tile" data-action="mail">
            <div class="newtab-tile-icon" style="background: linear-gradient(135deg, #3b82f6, #06b6d4);"><i class="fa-solid fa-envelope"></i></div>
            <span class="newtab-tile-label">nunu 메일</span>
          </div>
          <div class="newtab-tile" data-action="diary">
            <div class="newtab-tile-icon" style="background: linear-gradient(135deg, #10b981, #059669);"><i class="fa-solid fa-pen-nib"></i></div>
            <span class="newtab-tile-label">AI 그림일기</span>
          </div>
          <div class="newtab-tile" data-action="bookwave">
            <div class="newtab-tile-icon" style="background: linear-gradient(135deg, #6366f1, #4338ca);"><i class="fa-solid fa-headphones"></i></div>
            <span class="newtab-tile-label">북웨이브</span>
          </div>
          <div class="newtab-tile" data-action="news">
            <div class="newtab-tile-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);"><i class="fa-regular fa-newspaper"></i></div>
            <span class="newtab-tile-label">뉴스·증시</span>
          </div>
          <div class="newtab-tile" data-action="google">
            <div class="newtab-tile-icon" style="background: #4285f4;"><i class="fa-brands fa-google"></i></div>
            <span class="newtab-tile-label">Google</span>
          </div>
          <div class="newtab-tile" data-action="naver">
            <div class="newtab-tile-icon" style="background: #03c75a; font-weight: 900;">N</div>
            <span class="newtab-tile-label">Naver</span>
          </div>
          <div class="newtab-tile" data-action="youtube">
            <div class="newtab-tile-icon" style="background: #ef4444;"><i class="fa-brands fa-youtube"></i></div>
            <span class="newtab-tile-label">YouTube</span>
          </div>
        </div>
      </div>
    `;

    const sInput = viewEl.querySelector(`#newtabSearchInput_${tab.id}`);
    if (sInput) {
      sInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const q = sInput.value.trim();
          if (q) navigateCurrentTab(q);
        }
      });
    }

    viewEl.querySelectorAll(".newtab-tile").forEach(tile => {
      tile.addEventListener("click", () => {
        const act = tile.dataset.action;
        if (act === "portal") {
          updateCurrentTab({
            type: "portal",
            title: "nunu 포털",
            icon: "fa-solid fa-compass",
            iconColor: "#4f46e5",
            url: "https://nunu.com/",
            closable: true
          });
        } else if (act === "ai") {
          updateCurrentTab({
            type: "ai",
            title: "nunu AI Pro",
            icon: "fa-solid fa-wand-magic-sparkles",
            iconColor: "#8b5cf6",
            url: "https://nunu.com/ai",
            src: "ai.html",
            closable: true
          });
        } else if (act === "mail") {
          updateCurrentTab({
            type: "mail",
            title: "nunu 메일",
            icon: "fa-solid fa-envelope",
            iconColor: "#3b82f6",
            url: "https://nunu.com/mail",
            src: "mail.html",
            closable: true
          });
        } else if (act === "diary") {
          updateCurrentTab({
            type: "diary",
            title: "AI 그림일기",
            icon: "fa-solid fa-pen-nib",
            iconColor: "#10b981",
            url: "https://nunu.com/diary",
            src: "diary.html",
            closable: true
          });
        } else if (act === "bookwave") {
          updateCurrentTab({
            type: "bookwave",
            title: "북웨이브",
            icon: "fa-solid fa-headphones",
            iconColor: "#6366f1",
            url: "https://bookwave-server.onrender.com",
            src: "https://bookwave-server.onrender.com",
            closable: true
          });
        } else if (act === "news") {
          updateCurrentTab({
            type: "portal",
            title: "누누",
            icon: "fa-solid fa-compass",
            iconColor: "#4f46e5",
            url: "https://nunu.com/#news",
            closable: true
          });
        } else if (act === "google") {
          window.open("https://www.google.com", "_blank");
          updateCurrentTab({
            type: "google",
            title: "Google",
            icon: "fa-brands fa-google",
            iconColor: "#4285f4",
            url: "https://www.google.com",
            closable: true
          });
        } else if (act === "naver") {
          window.open("https://www.naver.com", "_blank");
          updateCurrentTab({
            type: "naver",
            title: "NAVER",
            icon: "fa-solid fa-n",
            iconColor: "#03c75a",
            url: "https://www.naver.com",
            closable: true
          });
        } else if (act === "youtube") {
          window.open("https://www.youtube.com", "_blank");
          updateCurrentTab({
            type: "youtube",
            title: "YouTube",
            icon: "fa-brands fa-youtube",
            iconColor: "#ef4444",
            url: "https://www.youtube.com",
            closable: true
          });
        }
      });
    });
    return viewEl;
  }

  // 2. Google Portal View
  if (tab.type === "google") {
    viewEl.innerHTML = `
      <div class="chrome-portal-view">
        <div class="portal-brand-logo">
          <span style="color:#4285f4;">G</span><span style="color:#ea4335;">o</span><span style="color:#fbbc05;">o</span><span style="color:#4285f4;">g</span><span style="color:#34a853;">l</span><span style="color:#ea4335;">e</span>
        </div>
        <div class="portal-search-bar">
          <i class="fa-solid fa-magnifying-glass" style="color: #9aa0a6;"></i>
          <input type="text" id="googleTabInput_${tab.id}" placeholder="Google 검색 또는 검색어 입력" autocomplete="off">
          <button type="button" id="googleTabBtn_${tab.id}"><i class="fa-brands fa-google"></i> Google 검색</button>
        </div>
        <a href="https://www.google.com" target="_blank" rel="noopener noreferrer" class="btn-portal-hero google-hero">
          <i class="fa-brands fa-google"></i> Google 공식 사이트 새 창으로 열기 <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
        <div class="portal-security-notice">
          <i class="fa-solid fa-shield-halved" style="color: #4285f4;"></i>
          <span><strong>안내:</strong> Google은 전 세계 웹 보안 규정(X-Frame-Options)에 따라 새 창에서 가장 안전하고 원활하게 동작합니다.</span>
        </div>
        <div class="portal-shortcuts-grid">
          <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-solid fa-map-location-dot" style="color:#ea4335;"></i> Google 지도</a>
          <a href="https://translate.google.com" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-solid fa-language" style="color:#4285f4;"></i> Google 번역</a>
          <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-solid fa-hard-drive" style="color:#fbbc05;"></i> Google 드라이브</a>
          <a href="https://mail.google.com" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-solid fa-envelope" style="color:#ea4335;"></i> Gmail</a>
          <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-brands fa-youtube" style="color:#ef4444;"></i> YouTube</a>
        </div>
      </div>
    `;

    const gIn = viewEl.querySelector(`#googleTabInput_${tab.id}`);
    const gBtn = viewEl.querySelector(`#googleTabBtn_${tab.id}`);
    const doSearch = () => {
      const q = (gIn ? gIn.value : "").trim();
      if (q) {
        window.open("https://www.google.com/search?q=" + encodeURIComponent(q), "_blank");
        updateCurrentTab({
          type: "search",
          query: q,
          title: q + " - nunu 검색",
          icon: "fa-solid fa-magnifying-glass",
          iconColor: "#4f46e5",
          url: "https://www.google.com/search?q=" + encodeURIComponent(q),
          closable: true
        });
      }
    };
    if (gIn) gIn.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
    if (gBtn) gBtn.addEventListener("click", doSearch);
    return viewEl;
  }

  // 3. Naver Portal View
  if (tab.type === "naver") {
    viewEl.innerHTML = `
      <div class="chrome-portal-view">
        <div class="portal-brand-logo naver-logo">
          <span style="color:#03c75a; font-weight:900;">NAVER</span>
        </div>
        <div class="portal-search-bar">
          <i class="fa-solid fa-magnifying-glass" style="color: #03c75a;"></i>
          <input type="text" id="naverTabInput_${tab.id}" placeholder="Naver 검색 또는 검색어 입력" autocomplete="off">
          <button type="button" id="naverTabBtn_${tab.id}" style="background:#03c75a;"><span style="font-weight:900;">N</span> 검색</button>
        </div>
        <a href="https://www.naver.com" target="_blank" rel="noopener noreferrer" class="btn-portal-hero naver-hero">
          <span style="font-weight:900;">N</span> Naver 공식 사이트 새 창으로 열기 <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
        <div class="portal-security-notice">
          <i class="fa-solid fa-shield-halved" style="color: #03c75a;"></i>
          <span><strong>안내:</strong> Naver는 웹 보안 규정(X-Frame-Options)에 따라 새 창에서 가장 안전하고 원활하게 동작합니다.</span>
        </div>
        <div class="portal-shortcuts-grid">
          <a href="https://mail.naver.com" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-solid fa-envelope" style="color:#03c75a;"></i> 네이버 메일</a>
          <a href="https://blog.naver.com" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-solid fa-pen-to-square" style="color:#03c75a;"></i> 블로그</a>
          <a href="https://cafe.naver.com" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-solid fa-mug-hot" style="color:#03c75a;"></i> 카페</a>
          <a href="https://map.naver.com" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-solid fa-map-location-dot" style="color:#03c75a;"></i> 네이버 지도</a>
          <a href="https://comic.naver.com" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-solid fa-book-open" style="color:#03c75a;"></i> 웹툰</a>
        </div>
      </div>
    `;

    const nIn = viewEl.querySelector(`#naverTabInput_${tab.id}`);
    const nBtn = viewEl.querySelector(`#naverTabBtn_${tab.id}`);
    const doSearch = () => {
      const q = (nIn ? nIn.value : "").trim();
      if (q) {
        window.open("https://search.naver.com/search.naver?query=" + encodeURIComponent(q), "_blank");
        updateCurrentTab({
          type: "search",
          query: q,
          title: q + " - nunu 검색",
          icon: "fa-solid fa-magnifying-glass",
          iconColor: "#4f46e5",
          url: "https://search.naver.com/search.naver?query=" + encodeURIComponent(q),
          closable: true
        });
      }
    };
    if (nIn) nIn.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
    if (nBtn) nBtn.addEventListener("click", doSearch);
    return viewEl;
  }

  // 4. YouTube Portal View
  if (tab.type === "youtube") {
    viewEl.innerHTML = `
      <div class="chrome-portal-view">
        <div class="portal-brand-logo youtube-logo">
          <i class="fa-brands fa-youtube"></i> <span>YouTube</span>
        </div>
        <div class="portal-search-bar">
          <i class="fa-solid fa-magnifying-glass" style="color: #ef4444;"></i>
          <input type="text" id="ytTabInput_${tab.id}" placeholder="YouTube 동영상 검색" autocomplete="off">
          <button type="button" id="ytTabBtn_${tab.id}" style="background:#ef4444;"><i class="fa-brands fa-youtube"></i> 검색</button>
        </div>
        <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" class="btn-portal-hero youtube-hero">
          <i class="fa-brands fa-youtube"></i> YouTube 공식 사이트 새 창으로 열기 <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
        <div class="portal-security-notice">
          <i class="fa-solid fa-shield-halved" style="color: #ef4444;"></i>
          <span><strong>안내:</strong> YouTube는 외부 사이트 보안 규정에 따라 새 창에서 가장 안전하고 원활하게 재생됩니다.</span>
        </div>
        <div class="portal-shortcuts-grid">
          <a href="https://www.youtube.com/feed/trending" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-solid fa-fire" style="color:#ef4444;"></i> 인기 급상승</a>
          <a href="https://www.youtube.com/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-solid fa-music" style="color:#ef4444;"></i> 음악</a>
          <a href="https://www.youtube.com/gaming" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-solid fa-gamepad" style="color:#ef4444;"></i> 게임</a>
          <a href="https://www.youtube.com/channel/UCYfdidRxbB8Qhf0Nx7ioOYw" target="_blank" rel="noopener noreferrer" class="portal-shortcut-card"><i class="fa-solid fa-newspaper" style="color:#ef4444;"></i> 뉴스</a>
        </div>
      </div>
    `;

    const yIn = viewEl.querySelector(`#ytTabInput_${tab.id}`);
    const yBtn = viewEl.querySelector(`#ytTabBtn_${tab.id}`);
    const doSearch = () => {
      const q = (yIn ? yIn.value : "").trim();
      if (q) {
        window.open("https://www.youtube.com/results?search_query=" + encodeURIComponent(q), "_blank");
        updateCurrentTab({
          type: "search",
          query: q,
          title: q + " - nunu 검색",
          icon: "fa-solid fa-magnifying-glass",
          iconColor: "#4f46e5",
          url: "https://www.youtube.com/results?search_query=" + encodeURIComponent(q),
          closable: true
        });
      }
    };
    if (yIn) yIn.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
    if (yBtn) yBtn.addEventListener("click", doSearch);
    return viewEl;
  }

  // 5. Integrated Tab Search View
  if (tab.type === "search") {
    const q = tab.query || "";
    viewEl.innerHTML = `
      <div class="chrome-tab-search-container">
        <div class="tab-search-header">
          <div class="tab-search-title-row">
            <div class="tab-search-query-badge">
              <i class="fa-solid fa-magnifying-glass" style="color: #4f46e5;"></i>
              <span>'${escapeHtmlForTab(q)}' 검색 결과</span>
            </div>
            <a href="https://www.google.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer" class="btn-portal-hero google-hero" style="margin-bottom:0; padding:8px 18px; font-size:13.5px;">
              <i class="fa-brands fa-google"></i> Google에서 직접 보기 ↗
            </a>
          </div>
          <div class="search-engines-bar" style="margin-bottom:0;">
            <span class="engines-bar-label"><i class="fa-solid fa-bolt" style="color: #f59e0b;"></i> 다른 검색 엔진:</span>
            <div class="engines-buttons">
              <a href="https://www.google.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer" class="btn-engine-pill btn-engine-google">
                <i class="fa-brands fa-google"></i> <strong>Google</strong> 검색
              </a>
              <a href="https://search.naver.com/search.naver?query=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer" class="btn-engine-pill btn-engine-naver">
                <span class="naver-badge-icon">N</span> <strong>Naver</strong> 검색
              </a>
              <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer" class="btn-engine-pill btn-engine-youtube">
                <i class="fa-brands fa-youtube"></i> <strong>YouTube</strong> 동영상
              </a>
              <a href="https://search.daum.net/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer" class="btn-engine-pill btn-engine-daum">
                <strong>Daum</strong> 검색
              </a>
              <a href="https://namu.wiki/w/${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer" class="btn-engine-pill btn-engine-namu">
                <i class="fa-solid fa-book"></i> 나무위키
              </a>
            </div>
          </div>
        </div>
        <div id="tabSearchResults_${tab.id}" class="tab-search-results-list">
          <div style="text-align:center; padding:40px; color:#64748b;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:24px; margin-bottom:12px; color:#4f46e5;"></i>
            <p>실시간 검색 결과를 불러오는 중...</p>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      loadTabSearchResults(q, tab.id);
    }, 50);

    return viewEl;
  }

  // 6. External Web Viewer (No iframe error)
  if (tab.type === "external") {
    viewEl.innerHTML = `
      <div class="chrome-portal-view">
        <div class="portal-brand-logo" style="font-size:36px; color:#4f46e5;">
          <i class="fa-solid fa-globe"></i> <span style="font-size:28px; margin-left:12px;">${escapeHtmlForTab(tab.title || "외부 웹사이트")}</span>
        </div>
        <p style="font-size: 14.5px; color: #64748b; margin-bottom: 24px; max-width: 500px;">${escapeHtmlForTab(tab.url)}</p>
        <a href="${escapeHtmlForTab(tab.url)}" target="_blank" rel="noopener noreferrer" class="btn-portal-hero external-hero">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> ${escapeHtmlForTab(tab.title || "사이트")} 새 창에서 열기
        </a>
        <div class="portal-security-notice">
          <i class="fa-solid fa-shield-halved" style="color: #4f46e5;"></i>
          <span><strong>안내:</strong> 해당 외부 사이트는 웹 브라우저 보안 규정(X-Frame-Options)에 따라 안전하게 새 창에서 열리도록 보호되어 있습니다.</span>
        </div>
        <div style="margin-top:24px;">
          <button type="button" class="btn-engine-pill" style="cursor:pointer; padding: 8px 18px;" onclick="activateChromeTab('tab_portal_home')"><i class="fa-solid fa-house"></i> nunu 포털 홈으로 돌아가기</button>
        </div>
      </div>
    `;
    return viewEl;
  }

  // 7. Internal iframes (ai.html, mail.html, diary.html, admin.html, bookwave)
  const iframe = document.createElement("iframe");
  iframe.id = "tabIframe_" + tab.id;
  iframe.className = "chrome-tab-iframe";
  iframe.src = tab.src;
  iframe.setAttribute("allow", "camera; microphone; clipboard-read; clipboard-write; fullscreen; autoplay");
  viewEl.appendChild(iframe);

  return viewEl;
}

function openChromeTab(config, activateNow = true) {
  if (config.type && config.type !== "newtab" && config.type !== "web" && config.type !== "search" && config.type !== "external") {
    const existing = chromeTabs.find(t => t.type === config.type);
    if (existing) {
      activateChromeTab(existing.id);
      return existing;
    }
  }

  const newId = "tab_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const tabObj = {
    id: newId,
    type: config.type || "web",
    title: config.title || "새 탭",
    icon: config.icon || "fa-solid fa-globe",
    iconColor: config.iconColor || "",
    url: config.url || "",
    src: config.src || "",
    query: config.query || "",
    closable: config.closable !== false
  };

  chromeTabs.push(tabObj);

  if (activateNow) {
    activateChromeTab(newId);
  } else {
    renderChromeTabs();
  }

  return tabObj;
}

function updateCurrentTab(config) {
  const currentTab = chromeTabs.find(t => t.id === activeChromeTabId);
  if (!currentTab) return;

  Object.assign(currentTab, config);

  const oldView = document.getElementById("tabView_" + currentTab.id);
  if (oldView) oldView.remove();

  activateChromeTab(currentTab.id);
}

function closeChromeTab(tabId) {
  const idx = chromeTabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;

  const closingActive = tabId === activeChromeTabId;

  const viewEl = document.getElementById("tabView_" + tabId);
  if (viewEl) viewEl.remove();

  chromeTabs.splice(idx, 1);

  if (chromeTabs.length === 0) {
    const homeTab = {
      id: "tab_portal_home",
      type: "portal",
      title: "nunu 포털",
      icon: "fa-solid fa-compass",
      iconColor: "#4f46e5",
      url: "https://nunu.com/",
      closable: false
    };
    chromeTabs.push(homeTab);
    activateChromeTab("tab_portal_home");
  } else if (closingActive) {
    const nextIdx = Math.min(idx, chromeTabs.length - 1);
    activateChromeTab(chromeTabs[nextIdx].id);
  } else {
    renderChromeTabs();
  }
}

function openNewTab() {
  openChromeTab({
    type: "newtab",
    title: "새 탭",
    icon: "fa-brands fa-chrome",
    iconColor: "#4285f4",
    url: "https://nunu.com/newtab",
    closable: true
  }, true);
}

function navigateCurrentTab(inputVal) {
  let val = (inputVal || "").trim();
  if (!val) return;

  const currentTab = chromeTabs.find(t => t.id === activeChromeTabId);
  const lowerVal = val.toLowerCase();

  // 1. Google Direct
  if (lowerVal === "google" || lowerVal === "구글" || lowerVal === "google.com" || lowerVal === "www.google.com" || /^https?:\/\/(www\.)?google\.[a-z.]+/i.test(val)) {
    window.open("https://www.google.com", "_blank");
    if (currentTab && currentTab.type === "newtab") {
      updateCurrentTab({
        type: "google",
        title: "Google",
        icon: "fa-brands fa-google",
        iconColor: "#4285f4",
        url: "https://www.google.com",
        closable: true
      });
    } else {
      openChromeTab({
        type: "google",
        title: "Google",
        icon: "fa-brands fa-google",
        iconColor: "#4285f4",
        url: "https://www.google.com",
        closable: true
      }, true);
    }
    return;
  }

  // 2. Naver Direct
  if (lowerVal === "naver" || lowerVal === "네이버" || lowerVal === "naver.com" || lowerVal === "www.naver.com" || /^https?:\/\/(www\.)?naver\.com/i.test(val)) {
    window.open("https://www.naver.com", "_blank");
    if (currentTab && currentTab.type === "newtab") {
      updateCurrentTab({
        type: "naver",
        title: "NAVER",
        icon: "fa-solid fa-n",
        iconColor: "#03c75a",
        url: "https://www.naver.com",
        closable: true
      });
    } else {
      openChromeTab({
        type: "naver",
        title: "NAVER",
        icon: "fa-solid fa-n",
        iconColor: "#03c75a",
        url: "https://www.naver.com",
        closable: true
      }, true);
    }
    return;
  }

  // 3. YouTube Direct
  if (lowerVal === "youtube" || lowerVal === "유튜브" || lowerVal === "youtube.com" || lowerVal === "www.youtube.com" || /^https?:\/\/(www\.)?youtube\.com/i.test(val)) {
    window.open("https://www.youtube.com", "_blank");
    if (currentTab && currentTab.type === "newtab") {
      updateCurrentTab({
        type: "youtube",
        title: "YouTube",
        icon: "fa-brands fa-youtube",
        iconColor: "#ef4444",
        url: "https://www.youtube.com",
        closable: true
      });
    } else {
      openChromeTab({
        type: "youtube",
        title: "YouTube",
        icon: "fa-brands fa-youtube",
        iconColor: "#ef4444",
        url: "https://www.youtube.com",
        closable: true
      }, true);
    }
    return;
  }

  // 4. Other Web URLs
  let isWebUrl = false;
  let targetUrl = val;
  if (/^(https?:\/\/|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i.test(targetUrl)) {
    isWebUrl = true;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }
  }

  if (isWebUrl) {
    let title = targetUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
    window.open(targetUrl, "_blank");
    if (currentTab && currentTab.type === "newtab") {
      updateCurrentTab({
        type: "external",
        title: title,
        icon: "fa-solid fa-globe",
        iconColor: "#4285f4",
        url: targetUrl,
        closable: true
      });
    } else {
      openChromeTab({
        type: "external",
        title: title,
        icon: "fa-solid fa-globe",
        iconColor: "#4285f4",
        url: targetUrl,
        closable: true
      }, true);
    }
    return;
  }

  // 5. General Search Query (e.g. '아이유', '날씨', '축구')
  window.open("https://www.google.com/search?q=" + encodeURIComponent(val), "_blank");
  if (currentTab && currentTab.type === "newtab") {
    updateCurrentTab({
      type: "search",
      query: val,
      title: val + " - nunu 검색",
      icon: "fa-solid fa-magnifying-glass",
      iconColor: "#4f46e5",
      url: "https://www.google.com/search?q=" + encodeURIComponent(val),
      closable: true
    });
  } else {
    openChromeTab({
      type: "search",
      query: val,
      title: val + " - nunu 검색",
      icon: "fa-solid fa-magnifying-glass",
      iconColor: "#4f46e5",
      url: "https://www.google.com/search?q=" + encodeURIComponent(val),
      closable: true
    }, true);
  }
}
function initTopBrowserBar() {
  const input = document.getElementById("browserUrlInput");
  const clearBtn = document.getElementById("clearBrowserUrlBtn");
  const goBtn = document.getElementById("btnGoBrowserUrl");
  const newTabBtn = document.getElementById("chromeNewTabBtn");
  const backBtn = document.getElementById("btnBrowserBack");
  const forwardBtn = document.getElementById("btnBrowserForward");
  const reloadBtn = document.getElementById("btnBrowserReload");
  const homeBtn = document.getElementById("btnBrowserHome");

  // 1. Initial render of chrome tabs
  renderChromeTabs();

  // 1-1. Top Brand (누누 / 누누스카이) Badge Click -> 누누 포털 홈 탭 활성화
  const topBadge = document.getElementById("topBrandBadge");
  if (topBadge) {
    topBadge.addEventListener("click", () => {
      activateChromeTab("tab_portal_home");
    });
  }

  // 2. New Tab (+) Button
  if (newTabBtn) {
    newTabBtn.addEventListener("click", () => {
      openNewTab();
    });
  }

  // 3. Navigation Controls
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      activateChromeTab("tab_portal_home");
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      const currentTab = chromeTabs.find(t => t.id === activeChromeTabId);
      if (!currentTab) return;
      if (currentTab.type === "portal") {
        window.location.reload();
      } else {
        const iframe = document.getElementById("tabIframe_" + currentTab.id);
        if (iframe) iframe.src = iframe.src;
      }
    });
  }

  if (backBtn) {
    backBtn.disabled = false;
    backBtn.addEventListener("click", () => {
      const currentTab = chromeTabs.find(t => t.id === activeChromeTabId);
      if (currentTab && currentTab.type !== "portal") {
        const iframe = document.getElementById("tabIframe_" + currentTab.id);
        try { 
          if (iframe && iframe.contentWindow) iframe.contentWindow.history.back(); 
        } catch (e) {
          window.history.back();
        }
      } else {
        window.history.back();
      }
    });
  }

  if (forwardBtn) {
    forwardBtn.disabled = false;
    forwardBtn.addEventListener("click", () => {
      const currentTab = chromeTabs.find(t => t.id === activeChromeTabId);
      if (currentTab && currentTab.type !== "portal") {
        const iframe = document.getElementById("tabIframe_" + currentTab.id);
        try { 
          if (iframe && iframe.contentWindow) iframe.contentWindow.history.forward(); 
        } catch (e) {
          window.history.forward();
        }
      } else {
        window.history.forward();
      }
    });
  }

  // 4. Omnibox input
  if (input) {
    input.addEventListener("input", () => {
      if (clearBtn) {
        clearBtn.style.display = input.value.trim() ? "inline-flex" : "none";
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        navigateCurrentTab(input.value);
      }
    });
  }

  if (clearBtn && input) {
    clearBtn.addEventListener("click", () => {
      input.value = "";
      clearBtn.style.display = "none";
      input.focus();
    });
  }

  if (goBtn && input) {
    goBtn.addEventListener("click", () => {
      navigateCurrentTab(input.value);
    });
  }

  // 4-1. 크롬 액션 툴바 (⭐ 북마크, 🧩 확장프로그램, 🔵 연우 프로필, ⋮ 더보기 메뉴) 초기화
  initChromeActionToolbar();

  // 5. GNB Navigation Pills & Home Shortcuts -> Open as Chrome Tabs!
  const navBookwaveBtn = document.getElementById("btnLaunchBookwaveNav");
  if (navBookwaveBtn) {
    navBookwaveBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openChromeTab({
        type: "bookwave",
        title: "북웨이브 오디오북",
        icon: "fa-solid fa-headphones",
        iconColor: "#6366f1",
        url: "https://bookwave-server.onrender.com",
        src: "https://bookwave-server.onrender.com",
        closable: true
      }, true);
    });
  }

  const navDiaryBtn = document.querySelector(".nav-diary-pill");
  if (navDiaryBtn) {
    navDiaryBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openChromeTab({
        type: "diary",
        title: "AI 글방 (일기·독서록)",
        icon: "fa-solid fa-pen-nib",
        iconColor: "#10b981",
        url: "https://nunu.com/diary",
        src: "diary.html",
        closable: true
      }, true);
    });
  }

  const navAiBtn = document.querySelector(".nav-ai-pill");
  if (navAiBtn) {
    navAiBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openChromeTab({
        type: "ai",
        title: "nunu AI Pro",
        icon: "fa-solid fa-wand-magic-sparkles",
        iconColor: "#8b5cf6",
        url: "https://nunu.com/ai",
        src: "ai.html",
        closable: true
      }, true);
    });
  }

  const openAiBtn = document.getElementById("openNunuAiBtn");
  if (openAiBtn) {
    openAiBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openChromeTab({
        type: "ai",
        title: "nunu AI Pro",
        icon: "fa-solid fa-wand-magic-sparkles",
        iconColor: "#8b5cf6",
        url: "https://nunu.com/ai",
        src: "ai.html",
        closable: true
      }, true);
    });
  }

  const navMailBtn = document.getElementById("btnNavMail");
  if (navMailBtn) {
    navMailBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openChromeTab({
        type: "mail",
        title: "nunu 메일 & 문자",
        icon: "fa-solid fa-envelope",
        iconColor: "#3b82f6",
        url: "https://nunu.com/mail",
        src: "mail.html",
        closable: true
      }, true);
    });
  }

  const userMailStat = document.getElementById("userMailStatBox");
  if (userMailStat) {
    userMailStat.addEventListener("click", (e) => {
      e.preventDefault();
      openChromeTab({
        type: "mail",
        title: "nunu 메일",
        icon: "fa-solid fa-envelope",
        iconColor: "#3b82f6",
        url: "https://nunu.com/mail",
        src: "mail.html",
        closable: true
      }, true);
    });
  }

  const openMailBtn = document.getElementById("openNunuMailBtn");
  if (openMailBtn) {
    openMailBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openChromeTab({
        type: "mail",
        title: "nunu 메일",
        icon: "fa-solid fa-envelope",
        iconColor: "#3b82f6",
        url: "https://nunu.com/mail",
        src: "mail.html",
        closable: true
      }, true);
    });
  }

  const adminFooterLink = document.querySelector('a[href="admin.html"]');
  if (adminFooterLink) {
    adminFooterLink.addEventListener("click", (e) => {
      e.preventDefault();
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (isLocal) {
        window.open("http://localhost:8088/", "_blank");
      } else {
        alert("🔒 [보안 안내 - 관리자 센터]\n\n관리자 센터는 시스템 및 회원 정보 보안을 위해\n'관리자 전용 컴퓨터'에서만 독립 실행되도록 안전하게 격리되어 있습니다.\n\n(일반 인터넷 웹 접속이 엄격히 차단되어 있습니다.)");
      }
    });
  }

  // 6. GNB 앵커 스크롤 네비게이션 (#news, #stock, #weather)
  document.querySelectorAll('.quick-nav-links a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('href').substring(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelectorAll('.quick-nav-links a').forEach(a => a.classList.remove('active'));
        this.classList.add('active');
      }
    });
  });

  // 7. 푸터 안내 링크 클릭 활성화 (#)
  document.querySelectorAll(".footer-links a").forEach(a => {
    if (a.getAttribute("href") === "#") {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const text = a.textContent.trim();
        showToastNotice(`[${text}] 서비스 안내 페이지입니다.`);
      });
    }
  });
}

// ==========================================================================
// 4-1. 크롬 액션 툴바 (⭐ 북마크, 🧩 확장프로그램, | 구분선, 🔵 연우 프로필, ⋮ 더보기 메뉴)
// ==========================================================================
function initChromeActionToolbar() {
  const btnBookmark = document.getElementById("btnBrowserBookmark");
  const starIcon = document.getElementById("browserBookmarkStarIcon");
  const btnExtensions = document.getElementById("btnBrowserExtensions");
  const btnProfile = document.getElementById("btnBrowserProfile");
  const btnMenu = document.getElementById("btnBrowserMenu");

  const bookmarkPopup = document.getElementById("bookmarkPopup");
  const extensionsPopup = document.getElementById("extensionsPopup");
  const profilePopup = document.getElementById("profilePopup");
  const browserMenuPopup = document.getElementById("browserMenuPopup");

  const allPopups = [bookmarkPopup, extensionsPopup, profilePopup, browserMenuPopup];

  function closeAllPopups() {
    allPopups.forEach(p => {
      if (p) p.style.display = "none";
    });
  }

  function togglePopup(targetPopup) {
    if (!targetPopup) return;
    const isVisible = targetPopup.style.display === "block";
    closeAllPopups();
    if (!isVisible) {
      targetPopup.style.display = "block";
    }
  }

  // 외부 클릭 시 팝업 닫기
  document.addEventListener("click", (e) => {
    const actionsBar = document.getElementById("chromeActionsBar");
    if (actionsBar && !actionsBar.contains(e.target)) {
      closeAllPopups();
    }
  });

  // ESC 키 누르면 팝업 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllPopups();
    }
  });

  // ----------------------------------------------------
  // 1. ⭐ 북마크 (Bookmark) 토글 & 팝업
  // ----------------------------------------------------
  function updateStarState(isBookmarked) {
    if (starIcon) {
      if (isBookmarked) {
        starIcon.className = "fa-solid fa-star";
        starIcon.style.color = "#f59e0b";
      } else {
        starIcon.className = "fa-regular fa-star";
        starIcon.style.color = "";
      }
    }
    if (btnBookmark) {
      btnBookmark.classList.toggle("active-star", isBookmarked);
    }
  }

  if (btnBookmark) {
    btnBookmark.addEventListener("click", (e) => {
      e.stopPropagation();
      const currentTab = (typeof chromeTabs !== "undefined" && chromeTabs.find(t => t.id === activeChromeTabId)) || { title: "누누(nunu) - 대한민국 1등 스마트 포털", url: "https://nunu.com" };
      const titleInput = document.getElementById("popupBookmarkTitle");
      if (titleInput) {
        titleInput.value = currentTab.title || "누누(nunu) - 대한민국 1등 스마트 포털";
      }
      updateStarState(true);
      togglePopup(bookmarkPopup);
    });
  }

  const closeBookmarkBtn = document.getElementById("btnCloseBookmarkPopup");
  if (closeBookmarkBtn) {
    closeBookmarkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (bookmarkPopup) bookmarkPopup.style.display = "none";
    });
  }

  const saveBookmarkBtn = document.getElementById("btnSaveBookmarkPopup");
  if (saveBookmarkBtn) {
    saveBookmarkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const titleInput = document.getElementById("popupBookmarkTitle");
      const title = (titleInput && titleInput.value.trim()) || "누누 북마크";
      const currentTab = (typeof chromeTabs !== "undefined" && chromeTabs.find(t => t.id === activeChromeTabId)) || { url: "https://nunu.com" };
      
      try {
        let bmList = JSON.parse(localStorage.getItem("nunu_custom_bookmarks") || "[]");
        bmList = bmList.filter(b => b.url !== currentTab.url);
        bmList.unshift({
          id: Date.now(),
          title: title,
          url: currentTab.url || "https://nunu.com",
          color: "#f59e0b"
        });
        localStorage.setItem("nunu_custom_bookmarks", JSON.stringify(bmList));
      } catch (err) {}

      updateStarState(true);
      if (bookmarkPopup) bookmarkPopup.style.display = "none";
      if (typeof showToastNotice === "function") showToastNotice("⭐ 북마크에 추가되었습니다: " + title);
    });
  }

  const removeBookmarkBtn = document.getElementById("btnRemoveBookmark");
  if (removeBookmarkBtn) {
    removeBookmarkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const currentTab = (typeof chromeTabs !== "undefined" && chromeTabs.find(t => t.id === activeChromeTabId)) || { url: "https://nunu.com" };
      try {
        let bmList = JSON.parse(localStorage.getItem("nunu_custom_bookmarks") || "[]");
        bmList = bmList.filter(b => b.url !== currentTab.url);
        localStorage.setItem("nunu_custom_bookmarks", JSON.stringify(bmList));
      } catch (err) {}

      updateStarState(false);
      if (bookmarkPopup) bookmarkPopup.style.display = "none";
      if (typeof showToastNotice === "function") showToastNotice("🗑️ 북마크가 삭제되었습니다.");
    });
  }

  // ----------------------------------------------------
  // 2. 🧩 확장 프로그램 (Extensions) 팝업
  // ----------------------------------------------------
  if (btnExtensions) {
    btnExtensions.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePopup(extensionsPopup);
    });
  }

  const closeExtBtn = document.getElementById("btnCloseExtensionsPopup");
  if (closeExtBtn) {
    closeExtBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (extensionsPopup) extensionsPopup.style.display = "none";
    });
  }

  const toggleNight = document.getElementById("extToggleNightMode");
  if (toggleNight) {
    toggleNight.checked = document.body.classList.contains("theme-dark");
    toggleNight.addEventListener("change", (e) => {
      e.stopPropagation();
      if (typeof toggleTheme === "function") {
        toggleTheme();
      } else {
        const isDark = toggleNight.checked;
        document.body.classList.toggle("theme-dark", isDark);
        document.body.classList.toggle("theme-light", !isDark);
      }
      if (typeof showToastNotice === "function") {
        showToastNotice(toggleNight.checked ? "🌙 야간 다크모드가 적용되었습니다." : "☀️ 라이트 모드로 전환되었습니다.");
      }
    });
  }

  const toggleAdBlock = document.getElementById("extToggleAdBlock");
  if (toggleAdBlock) {
    toggleAdBlock.addEventListener("change", (e) => {
      e.stopPropagation();
      if (typeof showToastNotice === "function") {
        showToastNotice(toggleAdBlock.checked ? "🛡️ AdBlocker Pro 활성화: 악성 광고를 차단합니다." : "⚠️ AdBlocker Pro 비활성화: 광고가 표시됩니다.");
      }
    });
  }

  const btnTranslate = document.getElementById("btnRunTranslate");
  if (btnTranslate) {
    btnTranslate.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      const currentTab = typeof chromeTabs !== "undefined" && chromeTabs.find(t => t.id === activeChromeTabId);
      const urlToTranslate = (currentTab && currentTab.url) ? currentTab.url : "https://nunu.com";
      if (typeof openChromeTab === "function") {
        openChromeTab({
          type: "translate",
          title: "구글 번역기 - 한국어",
          icon: "fa-solid fa-language",
          iconColor: "#4f46e5",
          url: "https://translate.google.com/?sl=auto&tl=ko&op=websites&text=" + encodeURIComponent(urlToTranslate),
          src: "https://translate.google.com/?sl=auto&tl=ko&op=websites&text=" + encodeURIComponent(urlToTranslate),
          closable: true
        }, true);
      }
      if (typeof showToastNotice === "function") showToastNotice("🌐 한국어 번역 페이지를 새 탭으로 열었습니다.");
    });
  }

  const btnCapture = document.getElementById("btnRunCapture");
  if (btnCapture) {
    btnCapture.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      if (typeof showToastNotice === "function") showToastNotice("📸 화면을 캡처하여 클립보드에 복사했습니다!");
    });
  }

  const btnMemo = document.getElementById("btnRunMemo");
  if (btnMemo) {
    btnMemo.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      const memoText = prompt("📝 퀵 사이드 메모를 입력하세요:", "");
      if (memoText && memoText.trim()) {
        try {
          const memos = JSON.parse(localStorage.getItem("nunu_quick_memos") || "[]");
          memos.unshift({ time: new Date().toLocaleTimeString(), text: memoText.trim() });
          localStorage.setItem("nunu_quick_memos", JSON.stringify(memos));
          if (typeof showToastNotice === "function") showToastNotice("📝 메모가 저장되었습니다!");
        } catch (err) {}
      }
    });
  }

  const btnManageExt = document.getElementById("btnManageExtensions");
  if (btnManageExt) {
    btnManageExt.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      alert("🧩 [확장 프로그램 관리]\n\n• Night Eye (v2.1) - 활성화됨\n• nunu AdBlocker Pro (v3.0) - 활성화됨\n• 웹페이지 원클릭 번역기 (v1.5) - 정상 작동\n• 스마트 웹 화면 캡처 (v1.2) - 정상 작동\n• 퀵 사이드 메모장 (v2.0) - 정상 작동\n\n현재 5개의 확장 프로그램이 모두 정상 작동 중입니다.");
    });
  }

  // ----------------------------------------------------
  // 3. 🔵 연우 프로필 (Profile) 팝업 & 전환
  // ----------------------------------------------------
  if (btnProfile) {
    btnProfile.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePopup(profilePopup);
    });
  }

  const profileSwitchBtns = document.querySelectorAll(".btn-profile-switch");
  profileSwitchBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      profileSwitchBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const user = btn.dataset.user;
      const avatarTextEl = document.getElementById("browserProfileAvatarText");
      const popupAvatarEl = document.getElementById("popupProfileAvatar");
      const popupNameEl = document.getElementById("popupProfileName");
      const popupEmailEl = document.getElementById("popupProfileEmail");
      const popupCreditsEl = document.getElementById("popupProfileCredits");

      if (user === "김테스트") {
        if (avatarTextEl) avatarTextEl.textContent = "테스트";
        if (popupAvatarEl) { popupAvatarEl.textContent = "테스트"; popupAvatarEl.style.background = "#10b981"; }
        if (popupNameEl) popupNameEl.textContent = "김테스트";
        if (popupEmailEl) popupEmailEl.textContent = "kim@nunu.com";
        if (popupCreditsEl) popupCreditsEl.textContent = "120";
        if (btnProfile) btnProfile.style.background = "#10b981";
        if (typeof showToastNotice === "function") showToastNotice("👤 김테스트 프로필로 전환되었습니다.");
      } else if (user === "admin") {
        if (avatarTextEl) avatarTextEl.textContent = "관리";
        if (popupAvatarEl) { popupAvatarEl.textContent = "관리"; popupAvatarEl.style.background = "#6366f1"; }
        if (popupNameEl) popupNameEl.textContent = "관리자";
        if (popupEmailEl) popupEmailEl.textContent = "admin@nunu.com";
        if (popupCreditsEl) popupCreditsEl.textContent = "9,999";
        if (btnProfile) btnProfile.style.background = "#6366f1";
        if (typeof showToastNotice === "function") showToastNotice("👤 관리자 프로필로 전환되었습니다.");
      } else {
        if (avatarTextEl) avatarTextEl.textContent = "연우";
        if (popupAvatarEl) { popupAvatarEl.textContent = "연우"; popupAvatarEl.style.background = "#0288d1"; }
        if (popupNameEl) popupNameEl.textContent = "누누용 (연우)";
        if (popupEmailEl) popupEmailEl.textContent = "yeonwoo@nunu.com";
        if (popupCreditsEl) popupCreditsEl.textContent = "50";
        if (btnProfile) btnProfile.style.background = "#0288d1";
        if (typeof showToastNotice === "function") showToastNotice("👤 연우(기본) 프로필로 전환되었습니다.");
      }
    });
  });

  const btnProfileSettings = document.getElementById("btnProfileOpenSettings");
  if (btnProfileSettings) {
    btnProfileSettings.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      const loginModal = document.getElementById("loginModal");
      if (loginModal) loginModal.style.display = "flex";
    });
  }

  const btnProfileSync = document.getElementById("btnProfileSyncSettings");
  if (btnProfileSync) {
    btnProfileSync.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      if (typeof showToastNotice === "function") showToastNotice("🔄 nunu 프로필 데이터가 실시간 동기화되었습니다!");
    });
  }

  const btnProfileLogout = document.getElementById("btnProfileLogout");
  if (btnProfileLogout) {
    btnProfileLogout.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.click();
      } else {
        if (typeof showToastNotice === "function") showToastNotice("🚪 로그아웃되었습니다.");
      }
    });
  }

  // ----------------------------------------------------
  // 4. ⋮ 브라우저 풀 메뉴 (More Menu) 팝업
  // ----------------------------------------------------
  if (btnMenu) {
    btnMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePopup(browserMenuPopup);
    });
  }

  const menuNewTab = document.getElementById("menuNewTab");
  if (menuNewTab) {
    menuNewTab.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      if (typeof openNewTab === "function") openNewTab();
    });
  }

  const menuNewWindow = document.getElementById("menuNewWindow");
  if (menuNewWindow) {
    menuNewWindow.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      window.open(window.location.href, "_blank", "width=1280,height=800,menubar=no,toolbar=no");
    });
  }

  const menuIncognito = document.getElementById("menuIncognito");
  if (menuIncognito) {
    menuIncognito.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      if (typeof openChromeTab === "function") {
        openChromeTab({
          type: "incognito",
          title: "새 시크릿 창",
          icon: "fa-solid fa-user-secret",
          iconColor: "#64748b",
          url: "about:blank",
          src: "about:blank",
          closable: true
        }, true);
      }
      if (typeof showToastNotice === "function") showToastNotice("🕶️ 시크릿 모드가 켜졌습니다. 방문 기록이 저장되지 않습니다.");
    });
  }

  const menuBookmarks = document.getElementById("menuBookmarks");
  if (menuBookmarks) {
    menuBookmarks.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      const bookmarkSection = document.getElementById("bookmarkSection");
      if (bookmarkSection) {
        bookmarkSection.scrollIntoView({ behavior: "smooth" });
      } else {
        if (typeof showToastNotice === "function") showToastNotice("⭐ 즐겨찾기 목록을 확인합니다.");
      }
    });
  }

  const menuHistory = document.getElementById("menuHistory");
  if (menuHistory) {
    menuHistory.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      const historySummary = (typeof chromeTabs !== "undefined") ? chromeTabs.map(t => "• " + t.title + " (" + (t.url || "홈") + ")").join("\n") : "";
      alert("🕒 [최근 방문 기록]\n\n" + (historySummary || "방문 기록이 없습니다."));
    });
  }

  const menuDownloads = document.getElementById("menuDownloads");
  if (menuDownloads) {
    menuDownloads.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      const dlLink = document.getElementById("btnDownloadApp");
      if (dlLink) {
        dlLink.click();
      } else {
        window.location.href = "/download/nunusky";
      }
    });
  }

  let currentZoom = 100;
  const zoomValEl = document.getElementById("currentZoomLevel");
  const zoomInBtn = document.getElementById("btnZoomIn");
  const zoomOutBtn = document.getElementById("btnZoomOut");
  const fullscreenBtn = document.getElementById("btnFullscreen");

  function applyZoom(delta) {
    currentZoom = Math.min(150, Math.max(70, currentZoom + delta));
    if (zoomValEl) zoomValEl.textContent = currentZoom + "%";
    document.body.style.zoom = currentZoom + "%";
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      applyZoom(10);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      applyZoom(-10);
    });
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  const menuPrint = document.getElementById("menuPrint");
  if (menuPrint) {
    menuPrint.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      window.print();
    });
  }

  const menuSettings = document.getElementById("menuSettings");
  if (menuSettings) {
    menuSettings.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      if (typeof showToastNotice === "function") showToastNotice("⚙️ 누누스카이 설정: 최적화된 고속 브라우징 모드 동작 중");
    });
  }

  const menuAbout = document.getElementById("menuAbout");
  if (menuAbout) {
    menuAbout.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      alert("ℹ️ [누누스카이(nunuSky) 브라우저 정보]\n\n• 버전: 2.5.0 (최신 빌드)\n• 엔진: Chromium / Webkit 최적화 엔진\n• 배포: nunu Cloud Systems\n• 상태: 최신 버전 사용 중");
    });
  }
}

// ==========================================
// 5. 검색창 & nunu 통합 검색
// ==========================================
function initSearch() {
  const searchInput = document.getElementById("searchInput");
  const submitSearchBtn = document.getElementById("submitSearchBtn");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const voiceSearchBtn = document.getElementById("voiceSearchBtn");

  // 입력 내용 지우기 버튼
  if (searchInput && clearSearchBtn) {
    searchInput.addEventListener("input", () => {
      clearSearchBtn.style.display = searchInput.value.trim() ? "flex" : "none";
    });

    clearSearchBtn.addEventListener("click", () => {
      searchInput.value = "";
      clearSearchBtn.style.display = "none";
      searchInput.focus();
    });
  }

  // 검색 엔터 및 클릭
  if (submitSearchBtn && searchInput) {
    submitSearchBtn.addEventListener("click", () => {
      const q = searchInput.value.trim();
      if (!q) return;
      performSearch(q);
      searchInput.value = "";
      if (clearSearchBtn) clearSearchBtn.style.display = "none";
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = searchInput.value.trim();
        if (!q) return;
        performSearch(q);
        searchInput.value = "";
        if (clearSearchBtn) clearSearchBtn.style.display = "none";
      }
    });
  }

  // 음성 검색
  if (voiceSearchBtn && searchInput) {
    voiceSearchBtn.addEventListener("click", () => {
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRec();
        recognition.lang = 'ko-KR';
        recognition.start();
        searchInput.placeholder = "듣고 있어요... 말씀해주세요 🎙️";

        recognition.onresult = (event) => {
          const speechResult = event.results[0][0].transcript;
          searchInput.value = speechResult;
          performSearch(speechResult);
        };
        recognition.onerror = () => {
          searchInput.placeholder = "궁금한 것을 nunu에서 검색해보세요";
        };
        recognition.onend = () => {
          searchInput.placeholder = "궁금한 것을 nunu에서 검색해보세요";
        };
      } else {
        alert("이 브라우저는 음성 인식을 지원하지 않습니다. 텍스트로 검색해주세요!");
      }
    });
  }

  // 검색 결과 모달 닫기
  const searchModal = document.getElementById("searchModal");
  const closeSearchModalBtn = document.getElementById("closeSearchModalBtn");
  if (closeSearchModalBtn && searchModal) {
    closeSearchModalBtn.addEventListener("click", () => {
      searchModal.style.display = "none";
    });
    searchModal.addEventListener("click", (e) => {
      if (e.target === searchModal) searchModal.style.display = "none";
    });
  }
}

function performSearch(query) {
  if (!query) return;
  showNunuSearchResults(query);
}

async function showNunuSearchResults(query, initialEngine = "all") {
  const searchModal = document.getElementById("searchModal");
  const modalQuery = document.getElementById("modalQuery");
  const modalResultsBody = document.getElementById("modalResultsBody");

  if (!searchModal || !modalResultsBody) return;

  modalQuery.textContent = query;
  searchModal.style.display = "flex";

  modalResultsBody.innerHTML = `
    <div style="text-align:center; padding:50px 20px; color:#64748b;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:32px; color:#4f46e5; margin-bottom:16px;"></i>
      <p style="font-size:16px; font-weight:600;">5대 포털(Google, Naver, YouTube, Daum, 나무위키) 실시간 검색 중...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/search?q=' + encodeURIComponent(query));
    if (!res.ok) throw new Error("Search API error: " + res.status);
    const data = await res.json();
    renderEngineSearchInterface(modalResultsBody, data, initialEngine);
  } catch (err) {
    console.warn("Modal search error:", err);
    modalResultsBody.innerHTML = `
      <div style="text-align:center; padding:40px; color:#64748b;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:32px; color:#f59e0b; margin-bottom:14px;"></i>
        <p>실시간 검색 결과를 불러오지 못했습니다.</p>
        <div style="margin-top:16px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
          <a href="https://www.google.com/search?q=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer" class="btn-engine-pill btn-engine-google"><i class="fa-brands fa-google"></i> Google 검색</a>
          <a href="https://search.naver.com/search.naver?query=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer" class="btn-engine-pill btn-engine-naver"><span class="naver-badge-icon">N</span> Naver 검색</a>
          <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer" class="btn-engine-pill btn-engine-youtube"><i class="fa-brands fa-youtube"></i> YouTube 동영상</a>
        </div>
      </div>
    `;
  }
}

// ==========================================
// 6. 빠른 북마크 (Quick Links)
// ==========================================
function getBookmarks() {
  try {
    const saved = localStorage.getItem("nunu_bookmarks");
    let list = saved ? JSON.parse(saved) : DEFAULT_BOOKMARKS;
    
    // 북웨이브 최신 Render URL로 업데이트
    const bwIndex = list.findIndex(b => b.id === "bm_bw" || b.name === "북웨이브");
    if (bwIndex !== -1) {
      list[bwIndex].url = "https://bookwave-server.onrender.com";
    } else {
      list.unshift({
        id: "bm_bw",
        name: "북웨이브",
        url: "https://bookwave-server.onrender.com",
        icon: "📚",
        bg: "linear-gradient(135deg, #4f46e5, #7c3aed)"
      });
    }
    saveBookmarks(list);
    return list;
  } catch {
    return DEFAULT_BOOKMARKS;
  }
}

function saveBookmarks(list) {
  localStorage.setItem("nunu_bookmarks", JSON.stringify(list));
}

function initBookmarks() {
  renderBookmarks();

  const addBookmarkBtn = document.getElementById("addBookmarkBtn");
  const modal = document.getElementById("addBookmarkModal");
  const closeBtn = document.getElementById("closeBookmarkModalBtn");
  const cancelBtn = document.getElementById("cancelBookmarkBtn");
  const saveBtn = document.getElementById("saveBookmarkBtn");
  const nameInput = document.getElementById("bmNameInput");
  const urlInput = document.getElementById("bmUrlInput");
  const colorDots = document.querySelectorAll(".color-dot");

  let selectedColor = "#4f46e5";

  colorDots.forEach(dot => {
    dot.addEventListener("click", () => {
      colorDots.forEach(d => d.classList.remove("active"));
      dot.classList.add("active");
      selectedColor = dot.dataset.color;
    });
  });

  if (addBookmarkBtn && modal) {
    addBookmarkBtn.addEventListener("click", () => {
      if (nameInput) nameInput.value = "";
      if (urlInput) urlInput.value = "https://";
      modal.style.display = "flex";
      if (nameInput) nameInput.focus();
    });

    const closeModal = () => { modal.style.display = "none"; };
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const name = nameInput.value.trim();
        let url = urlInput.value.trim();
        if (!name || !url) {
          alert("이름과 URL 주소를 모두 입력해주세요!");
          return;
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          url = "https://" + url;
        }

        const list = getBookmarks();
        list.push({
          id: "bm_" + Date.now(),
          name,
          url,
          icon: name.charAt(0).toUpperCase(),
          bg: selectedColor
        });
        saveBookmarks(list);
        renderBookmarks();
        closeModal();
      });
    }
  }
}

function renderBookmarks() {
  const container = document.getElementById("quickBookmarks");
  if (!container) return;

  const bookmarks = getBookmarks();
  container.innerHTML = bookmarks.map(bm => `
    <div class="bookmark-item" data-url="${bm.url}">
      <div class="bookmark-icon-box" style="background: ${bm.bg}">
        <span>${bm.icon}</span>
      </div>
      <span class="bookmark-label" title="${bm.name}">${bm.name}</span>
      <button class="bookmark-delete-btn" data-id="${bm.id}" title="삭제"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `).join("");

  container.querySelectorAll(".bookmark-item").forEach(item => {
    item.addEventListener("click", (e) => {
      if (e.target.closest(".bookmark-delete-btn")) return;
      window.open(item.dataset.url, "_blank");
    });

    const delBtn = item.querySelector(".bookmark-delete-btn");
    if (delBtn) {
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = delBtn.dataset.id;
        const list = getBookmarks().filter(b => b.id !== id);
        saveBookmarks(list);
        renderBookmarks();
      });
    }
  });
}

// ==========================================
// 7. 뉴스 스탠드 섹션
// ==========================================
function initNewsSection() {
  const tabs = document.querySelectorAll("#newsTabs .tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const cat = tab.dataset.cat;
      renderNewsCategory(cat);
    });
  });

  renderNewsCategory("all");
}

function renderNewsCategory(cat) {
  const data = NEWS_DATA[cat] || NEWS_DATA.all;
  const headlineBanner = document.getElementById("newsHeadlineBanner");
  const headlineImg = document.getElementById("headlineImg");
  const headlineTitle = document.getElementById("headlineTitle");
  const headlineDesc = document.getElementById("headlineDesc");
  const newsItemList = document.getElementById("newsItemList");

  if (headlineImg) headlineImg.style.backgroundImage = `url('${data.headline.img}')`;
  if (headlineTitle) headlineTitle.textContent = data.headline.title;
  if (headlineDesc) headlineDesc.textContent = data.headline.desc;

  if (headlineBanner) {
    headlineBanner.onclick = () => {
      window.open(`https://search.naver.com/search.naver?query=${encodeURIComponent(data.headline.title)}`, "_blank");
    };
  }

  if (newsItemList) {
    newsItemList.innerHTML = data.items.map(item => `
      <li class="news-item" onclick="window.open('https://search.naver.com/search.naver?query=${encodeURIComponent(item.title)}', '_blank')">
        <span class="news-item-title">
          <i class="fa-solid fa-angle-right" style="color: var(--primary-color); font-size: 11px;"></i>
          ${item.title}
        </span>
        <div>
          <span class="news-item-press">${item.press}</span>
          <span class="news-item-time"> · ${item.time}</span>
        </div>
      </li>
    `).join("");
  }
}

// ==========================================
// 8. nunu AI 스마트 어시스턴트 연동
// ==========================================
function initNunuAi() {
  const modal = document.getElementById("nunuAiModal");
  const openHubBtn = document.getElementById("openNunuAiBtn");
  const closeBtn = document.getElementById("closeAiModalBtn");
  const chatMessages = document.getElementById("aiChatMessages");

  // 모달 입력창 & 전송 버튼
  const modalInput = document.getElementById("aiModalInput");
  const modalSendBtn = document.getElementById("aiModalSendBtn");

  // 메인 카드 퀵 입력창 & 전송 버튼
  const quickInput = document.getElementById("aiQuickInput");
  const quickSendBtn = document.getElementById("aiQuickSendBtn");

  // 모달 열기/닫기
  const openModal = () => {
    if (modal) {
      modal.style.display = "flex";
      if (modalInput) modalInput.focus();
    }
  };

  const closeModal = () => {
    if (modal) modal.style.display = "none";
  };

  if (openHubBtn) {
    openHubBtn.addEventListener("click", () => {
      window.location.href = "ai.html";
    });
  }

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // AI 응답 생성 함수
  const generateAiReply = (query) => {
    const q = query.toLowerCase();

    if (q.includes("북웨이브") || q.includes("bookwave") || q.includes("오디오북") || q.includes("전자책") || q.includes("책") || q.includes("독서")) {
      return `📚 <strong>북웨이브 (Bookwave)</strong>는 nunu 포털과 공식 연동된 프리미엄 독서 & 오디오북 플랫폼입니다!<br><br>
      • 🎧 <strong>오디오북 스트리밍</strong>: 고음질 음원으로 언제 어디서나 책을 귀로 감상할 수 있습니다.<br>
      • 📖 <strong>EPUB 전자책 뷰어</strong>: 깔끔한 인터페이스로 모바일과 PC에서 최적화된 독서를 지원합니다.<br>
      • 🚀 <a href="https://bookwave-server.onrender.com" target="_blank" style="color: #4f46e5; font-weight: 700; text-decoration: underline;">https://bookwave-server.onrender.com</a> 링크를 통해 지금 바로 북웨이브를 이용해보세요!`;
    }

    if (q.includes("날씨") || q.includes("미세먼지") || q.includes("온도")) {
      return `⛅ <strong>현재 서울 기준 날씨 정보</strong>를 브리핑해 드립니다.<br><br>
      • 현재 기온: <strong>21.5°C</strong> (체감 온도 22.0°C)<br>
      • 하늘 상태: 구름 조금, 맑고 선선한 전형적인 쾌적한 날씨입니다.<br>
      • 미세먼지: <strong>좋음 (18㎍/㎥)</strong>으로 야외 활동 및 산책하기에 최적의 상태입니다!`;
    }

    if (q.includes("뉴스") || q.includes("it") || q.includes("테크") || q.includes("인공지능") || q.includes("ai")) {
      return `⚡ <strong>오늘의 주요 IT/과학 헤드라인 요약</strong>:<br><br>
      1. <strong>차세대 초거대 AI 모델 대거 공개</strong>: 사람 수준의 정밀 추론 및 실시간 다국어 지원 엔진 발표<br>
      2. <strong>온디바이스 AI 칩셋 진화</strong>: 인터넷 연결 없이 로컬 디바이스에서 초고속 언어 모델 구동 가능<br>
      3. <strong>오픈소스 AI 생태계 활성화</strong>: 개발자 및 크리에이터 도구와의 결합이 더욱 가속화되고 있습니다.`;
    }

    if (q.includes("파이썬") || q.includes("python") || q.includes("코드") || q.includes("서버") || q.includes("코딩")) {
      return `💻 <strong>파이썬(Python) 팁: 초간단 HTTP 웹서버 띄우기</strong><br><br>
      터미널이나 명령 프롬프트에서 아래 한 줄만 입력하면 현재 폴더를 즉시 웹서버로 서비스할 수 있습니다:<br>
      <code style="background: rgba(0,0,0,0.08); padding: 3px 8px; border-radius: 4px; font-family: monospace;">python -m http.server 8080</code><br><br>
      nunu 포털도 파이썬의 초경량 고성능 표준 라이브러리 기반으로 백엔드 서버가 안정적으로 동작하고 있습니다! 🚀`;
    }

    if (q.includes("안녕") || q.includes("반가") || q.includes("누구")) {
      return `반갑습니다! 😊 저는 여러분의 스마트한 포털 생활을 돕는 <strong>nunu AI 어시스턴트</strong>입니다.<br>
      궁금한 정보 검색, 북웨이브 도서 탐색, 뉴스 브리핑, 일상 대화 등 무엇이든 편하게 물어보세요!`;
    }

    return `"${escapeHtml(query)}"에 대해 말씀해주셨군요! ✨<br><br>
    nunu AI가 분석한 결과, 해당 주제는 다양한 최신 정보와 연결되어 있습니다. 더 자세한 정보가 필요하시면 상단 <strong>nunu 통합 검색</strong>에서 검색하시거나, 책/오디오북 관련 내용이라면 nunu 추천 서비스인 <strong>북웨이브(Bookwave)</strong>에서 바로 찾아보실 수 있습니다!`;
  };

  const escapeHtml = (text) => {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  // 질문 전송 처리
  const sendQuestion = (prompt) => {
    const text = prompt.trim();
    if (!text) return;

    openModal();

    if (!chatMessages) return;

    // 사용자 메시지 추가
    const userMsg = document.createElement("div");
    userMsg.className = "ai-msg ai-msg-user";
    userMsg.innerHTML = `<div class="ai-bubble">${escapeHtml(text)}</div>`;
    chatMessages.appendChild(userMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 봇 응답 딜레이 효과
    setTimeout(() => {
      const botMsg = document.createElement("div");
      botMsg.className = "ai-msg ai-msg-bot";
      const replyHtml = generateAiReply(text);
      botMsg.innerHTML = `
        <div class="ai-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
        <div class="ai-bubble">${replyHtml}</div>
      `;
      chatMessages.appendChild(botMsg);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 400);
  };

  // 모달 전송 버튼
  if (modalSendBtn && modalInput) {
    const handleSend = () => {
      const val = modalInput.value;
      if (val.trim()) {
        sendQuestion(val);
        modalInput.value = "";
      }
    };

    modalSendBtn.addEventListener("click", handleSend);
    modalInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSend();
    });
  }

  // 메인 카드 퀵 전송: AI 채팅방(ai.html)으로 질문을 들고 즉시 연결
  if (quickSendBtn && quickInput) {
    const handleQuickSend = () => {
      const val = quickInput.value.trim();
      if (val) {
        window.location.href = `ai.html?q=${encodeURIComponent(val)}`;
      } else {
        window.location.href = "ai.html";
      }
    };

    quickSendBtn.addEventListener("click", handleQuickSend);
    quickInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleQuickSend();
    });
  }

  // 메인 카드 태그 버튼들: 클릭 시 AI 채팅방으로 즉시 연결되어 답변
  document.querySelectorAll(".ai-tag-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const prompt = pill.dataset.prompt;
      if (prompt) {
        window.location.href = `ai.html?q=${encodeURIComponent(prompt)}`;
      } else {
        window.location.href = "ai.html";
      }
    });
  });

  // 모달 칩 버튼들
  document.querySelectorAll(".ai-chip-btn").forEach(chip => {
    chip.addEventListener("click", () => {
      const prompt = chip.dataset.chat;
      if (prompt) sendQuestion(prompt);
    });
  });
}

// ==========================================
// 9. 증시 & 환율 위젯
// ==========================================
function initStockWidget() {
  const tabs = document.querySelectorAll("#stockTabs .stock-tab-btn");
  const priceEl = document.getElementById("stockPrice");
  const changeEl = document.getElementById("stockChange");
  const chartPath = document.querySelector("#miniChartSvg path");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const market = tab.dataset.market;
      const data = STOCK_DATA[market];

      if (data) {
        if (priceEl) priceEl.textContent = data.price;
        if (changeEl) {
          changeEl.textContent = data.change;
          changeEl.className = `stock-change ${data.isUp ? 'change-up' : 'change-down'}`;
        }
        if (chartPath) {
          chartPath.setAttribute("d", data.path);
          chartPath.setAttribute("stroke", data.isUp ? "#ef4444" : "#3b82f6");
        }
      }
    });
  });
}

// ==========================================
// 10. 날씨 위젯
// ==========================================
function initWeatherWidget() {
  const weeklyForecast = document.getElementById("weeklyForecast");
  if (weeklyForecast) {
    const weekDays = [
      { day: "오늘", icon: "fa-cloud-sun", temp: "22°" },
      { day: "내일", icon: "fa-sun", temp: "23°" },
      { day: "일", icon: "fa-cloud", temp: "20°" },
      { day: "월", icon: "fa-cloud-rain", temp: "18°" },
      { day: "화", icon: "fa-sun", temp: "21°" }
    ];

    weeklyForecast.innerHTML = weekDays.map(item => `
      <div class="forecast-day">
        <span>${item.day}</span>
        <i class="fa-solid ${item.icon}"></i>
        <strong>${item.temp}</strong>
      </div>
    `).join("");
  }

  // 위치 변경 버튼 클릭 시 주요 도시 순환 토글 및 실시간 갱신
  const changeBtn = document.getElementById("changeLocationBtn");
  if (changeBtn) {
    const cities = [
      { name: "서울특별시 중구", temp: "21.5°", desc: "구름 조금 · 쾌적함", feels: "22.0°", pm: "좋음 (18㎍/㎥)", wind: "45% / 1.8m/s", icon: "fa-cloud-sun" },
      { name: "부산광역시 해운대구", temp: "23.2°", desc: "맑음 · 선선함", feels: "23.5°", pm: "좋음 (14㎍/㎥)", wind: "58% / 3.2m/s", icon: "fa-sun" },
      { name: "제주특별자치도 서귀포시", temp: "24.0°", desc: "화창 · 따뜻함", feels: "24.6°", pm: "아주좋음 (9㎍/㎥)", wind: "62% / 2.5m/s", icon: "fa-sun" },
      { name: "인천광역시 연수구", temp: "20.8°", desc: "구름 많음 · 선선함", feels: "21.0°", pm: "보통 (34㎍/㎥)", wind: "50% / 2.1m/s", icon: "fa-cloud" },
      { name: "대구광역시 수성구", temp: "22.8°", desc: "맑음 · 쾌적함", feels: "23.1°", pm: "좋음 (20㎍/㎥)", wind: "42% / 1.5m/s", icon: "fa-sun" },
      { name: "대전광역시 유성구", temp: "21.7°", desc: "맑음 · 청명함", feels: "21.9°", pm: "좋음 (16㎍/㎥)", wind: "46% / 1.7m/s", icon: "fa-sun" },
      { name: "광주광역시 동구", temp: "22.3°", desc: "구름 조금 · 쾌적함", feels: "22.5°", pm: "좋음 (17㎍/㎥)", wind: "48% / 1.9m/s", icon: "fa-cloud-sun" }
    ];
    let cityIdx = 0;

    changeBtn.addEventListener("click", () => {
      cityIdx = (cityIdx + 1) % cities.length;
      const c = cities[cityIdx];
      const locEl = document.getElementById("weatherLocation");
      const tempEl = document.getElementById("currentTemp");
      const descEl = document.getElementById("weatherDesc");
      const feelsEl = document.getElementById("feelsLikeTemp");
      const pmEl = document.getElementById("pm10");
      const hwEl = document.getElementById("humidityWind");
      const iconEl = document.getElementById("weatherIcon");

      if (locEl) locEl.textContent = c.name;
      if (tempEl) tempEl.textContent = c.temp;
      if (descEl) descEl.textContent = c.desc;
      if (feelsEl) feelsEl.textContent = c.feels;
      if (pmEl) pmEl.textContent = c.pm;
      if (hwEl) hwEl.textContent = c.wind;
      if (iconEl) iconEl.innerHTML = `<i class="fa-solid ${c.icon}"></i>`;

      showToastNotice(`날씨 위치를 [${c.name}]으로 변경했습니다.`);
    });
  }
}

// ==========================================
// 11. 할 일 & 빠른 메모 위젯
// ==========================================
function getTodoList() {
  try {
    const saved = localStorage.getItem("nunu_todo_list");
    if (!saved) return [];
    const list = JSON.parse(saved);
    // 이전 테스트용 더미 항목 필터링
    const cleaned = list.filter(item => !item.id.startsWith("todo_1") && !item.id.startsWith("todo_2") && !item.id.startsWith("todo_3"));
    if (cleaned.length !== list.length) {
      saveTodoList(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

function saveTodoList(list) {
  localStorage.setItem("nunu_todo_list", JSON.stringify(list));
}

function initTodoWidget() {
  const newTodoInput = document.getElementById("newTodoInput");
  const addTodoBtn = document.getElementById("addTodoBtn");

  const addTodo = () => {
    const text = newTodoInput.value.trim();
    if (!text) return;
    const list = getTodoList();
    list.unshift({
      id: "item_" + Date.now(),
      text,
      done: false
    });
    saveTodoList(list);
    renderTodoList();
    newTodoInput.value = "";
  };

  if (addTodoBtn && newTodoInput) {
    addTodoBtn.addEventListener("click", addTodo);
    newTodoInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addTodo();
    });
  }

  renderTodoList();
}

function renderTodoList() {
  const todoList = document.getElementById("todoList");
  const todoCounter = document.getElementById("todoCounter");
  if (!todoList) return;

  const list = getTodoList();
  const completed = list.filter(t => t.done).length;
  if (todoCounter) todoCounter.textContent = `${completed}/${list.length}`;

  if (list.length === 0) {
    todoList.innerHTML = `
      <li style="padding: 18px 10px; text-align: center; color: var(--text-muted); font-size: 13px; list-style: none;">
        <i class="fa-regular fa-clipboard" style="font-size: 20px; display: block; margin-bottom: 6px; opacity: 0.6;"></i>
        등록된 할 일이 없습니다.<br>새로운 메모를 작성해보세요!
      </li>
    `;
    return;
  }

  todoList.innerHTML = list.map(item => `
    <li class="todo-item ${item.done ? 'done' : ''}">
      <div class="todo-item-left" data-id="${item.id}">
        <i class="fa-${item.done ? 'solid fa-circle-check' : 'regular fa-circle'}" style="color: ${item.done ? '#10b981' : 'var(--text-muted)'};"></i>
        <span>${item.text}</span>
      </div>
      <button class="todo-del-btn" data-id="${item.id}" title="삭제"><i class="fa-solid fa-xmark"></i></button>
    </li>
  `).join("");

  todoList.querySelectorAll(".todo-item-left").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      const updated = list.map(t => t.id === id ? { ...t, done: !t.done } : t);
      saveTodoList(updated);
      renderTodoList();
    });
  });

  todoList.querySelectorAll(".todo-del-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const filtered = list.filter(t => t.id !== id);
      saveTodoList(filtered);
      renderTodoList();
    });
  });
}

// ==========================================
// 12. 회원가입 및 가입자 전용 로그인 시스템
// ==========================================

function getUsers() {
  try {
    const data = localStorage.getItem("nunu_users");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem("nunu_users", JSON.stringify(users));
}

function getCurrentUser() {
  try {
    const data = localStorage.getItem("nunu_current_user");
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem("nunu_current_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("nunu_current_user");
  }
}

function initAuthDemo() {
  // 모달 요소들
  const loginModal = document.getElementById("loginModal");
  const signupModal = document.getElementById("signupModal");
  const closeLoginModalBtn = document.getElementById("closeLoginModalBtn");
  const closeSignupModalBtn = document.getElementById("closeSignupModalBtn");
  const switchToSignupBtn = document.getElementById("switchToSignupBtn");
  const switchToLoginBtn = document.getElementById("switchToLoginBtn");

  // 버튼 요소들
  const topLoginBtn = document.getElementById("userLoginBtn");
  const widgetLoginBtn = document.getElementById("widgetLoginBtn");
  const signUpBtn = document.getElementById("signUpBtn");
  const doLoginBtn = document.getElementById("doLoginBtn");
  const doSignupBtn = document.getElementById("doSignupBtn");
  const checkIdDupBtn = document.getElementById("checkIdDupBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // 인풋 & 메시지 요소들
  const loginIdInput = document.getElementById("loginIdInput");
  const loginPwInput = document.getElementById("loginPwInput");
  const loginErrorMsg = document.getElementById("loginErrorMsg");

  const signupIdInput = document.getElementById("signupIdInput");
  const signupNameInput = document.getElementById("signupNameInput");
  const signupEmailInput = document.getElementById("signupEmailInput");
  const signupPwInput = document.getElementById("signupPwInput");
  const signupPwConfirmInput = document.getElementById("signupPwConfirmInput");
  const idCheckHint = document.getElementById("idCheckHint");
  const signupErrorMsg = document.getElementById("signupErrorMsg");
  const signupSuccessMsg = document.getElementById("signupSuccessMsg");

  // 뷰 요소들
  const loggedOutView = document.getElementById("loggedOutView");
  const loggedInView = document.getElementById("loggedInView");
  const userName = document.getElementById("userName");
  const userEmail = document.getElementById("userEmail");

  // 모달 열고 닫기 헬퍼
  const openLoginModal = () => {
    hideAuthMessages();
    if (loginModal) loginModal.style.display = "flex";
    if (signupModal) signupModal.style.display = "none";
    if (loginIdInput) loginIdInput.focus();
  };

  const openSignupModal = () => {
    hideAuthMessages();
    if (signupModal) signupModal.style.display = "flex";
    if (loginModal) loginModal.style.display = "none";
    if (signupIdInput) signupIdInput.focus();
  };

  const closeAllAuthModals = () => {
    if (loginModal) loginModal.style.display = "none";
    if (signupModal) signupModal.style.display = "none";
    hideAuthMessages();
  };

  const hideAuthMessages = () => {
    if (loginErrorMsg) loginErrorMsg.style.display = "none";
    if (signupErrorMsg) signupErrorMsg.style.display = "none";
    if (signupSuccessMsg) signupSuccessMsg.style.display = "none";
    if (idCheckHint) {
      idCheckHint.textContent = "";
      idCheckHint.className = "input-hint";
    }
  };

  // 모달 토글 이벤트
  if (topLoginBtn) topLoginBtn.addEventListener("click", () => {
    if (getCurrentUser()) {
      alert(`안녕하세요, ${getCurrentUser().name} 님!\n현재 nunu 회원으로 정상 로그인되어 있습니다.`);
    } else {
      openLoginModal();
    }
  });

  if (widgetLoginBtn) widgetLoginBtn.addEventListener("click", openLoginModal);
  if (signUpBtn) signUpBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openSignupModal();
  });

  if (switchToSignupBtn) switchToSignupBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openSignupModal();
  });

  if (switchToLoginBtn) switchToLoginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openLoginModal();
  });

  if (closeLoginModalBtn) closeLoginModalBtn.addEventListener("click", closeAllAuthModals);
  if (closeSignupModalBtn) closeSignupModalBtn.addEventListener("click", closeAllAuthModals);

  // 모달 바깥 배경 클릭 시 닫기
  if (loginModal) {
    loginModal.addEventListener("click", (e) => {
      if (e.target === loginModal) closeAllAuthModals();
    });
  }
  if (signupModal) {
    signupModal.addEventListener("click", (e) => {
      if (e.target === signupModal) closeAllAuthModals();
    });
  }

  // 계정 찾기 (아이디 찾기 / 비밀번호 찾기) 모달
  const findAccountModal = document.getElementById("findAccountModal");
  const findIdBtn = document.getElementById("findIdBtn");
  const findPwBtn = document.getElementById("findPwBtn");
  const closeFindAccountModalBtn = document.getElementById("closeFindAccountModalBtn");
  const doFindAccountBtn = document.getElementById("doFindAccountBtn");
  const findAccountTitle = document.getElementById("findAccountTitle");
  const findAccountDesc = document.getElementById("findAccountDesc");
  const findAccountLabel = document.getElementById("findAccountLabel");
  const findAccountInput = document.getElementById("findAccountInput");
  const findAccountSuccessMsg = document.getElementById("findAccountSuccessMsg");
  const findAccountErrorMsg = document.getElementById("findAccountErrorMsg");

  let currentFindMode = "id";

  const openFindAccount = (mode = "id") => {
    currentFindMode = mode;
    if (findAccountSuccessMsg) findAccountSuccessMsg.style.display = "none";
    if (findAccountErrorMsg) findAccountErrorMsg.style.display = "none";
    if (findAccountInput) findAccountInput.value = "";

    if (mode === "id") {
      if (findAccountTitle) findAccountTitle.textContent = "아이디 찾기";
      if (findAccountDesc) findAccountDesc.textContent = "가입 시 등록하신 이메일 주소를 입력하시면 해당 계정의 아이디를 안내해 드립니다.";
      if (findAccountLabel) findAccountLabel.textContent = "가입 이메일";
      if (findAccountInput) findAccountInput.placeholder = "example@nunu.com";
    } else {
      if (findAccountTitle) findAccountTitle.textContent = "비밀번호 찾기 / 재설정";
      if (findAccountDesc) findAccountDesc.textContent = "가입하신 아이디 또는 등록된 이메일을 입력하시면 임시 비밀번호를 발송해 드립니다.";
      if (findAccountLabel) findAccountLabel.textContent = "아이디 또는 이메일";
      if (findAccountInput) findAccountInput.placeholder = "아이디 또는 example@nunu.com";
    }

    if (findAccountModal) findAccountModal.style.display = "flex";
    if (findAccountInput) findAccountInput.focus();
  };

  if (findIdBtn) {
    findIdBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openFindAccount("id");
    });
  }
  if (findPwBtn) {
    findPwBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openFindAccount("pw");
    });
  }
  if (closeFindAccountModalBtn) {
    closeFindAccountModalBtn.addEventListener("click", () => {
      if (findAccountModal) findAccountModal.style.display = "none";
    });
  }
  if (findAccountModal) {
    findAccountModal.addEventListener("click", (e) => {
      if (e.target === findAccountModal) findAccountModal.style.display = "none";
    });
  }
  if (doFindAccountBtn && findAccountInput) {
    doFindAccountBtn.addEventListener("click", () => {
      const val = findAccountInput.value.trim();
      if (!val) {
        if (findAccountErrorMsg) {
          findAccountErrorMsg.textContent = "입력란을 작성해주세요.";
          findAccountErrorMsg.style.display = "block";
        }
        return;
      }
      if (findAccountErrorMsg) findAccountErrorMsg.style.display = "none";
      if (findAccountSuccessMsg) {
        if (currentFindMode === "id") {
          findAccountSuccessMsg.textContent = `확인 완료: 입력하신 정보(${val})로 가입된 아이디 안내 메일을 전송했습니다.`;
        } else {
          findAccountSuccessMsg.textContent = `임시 비밀번호 안내: 입력하신 계정(${val})으로 안전한 인증 코드가 발송되었습니다.`;
        }
        findAccountSuccessMsg.style.display = "block";
      }
    });
  }

  // 푸터 안내 모달 (회사소개, 이용약관, 개인정보처리방침, 고객센터, 제휴제안)
  const infoNoticeModal = document.getElementById("infoNoticeModal");
  const infoNoticeModalTitle = document.getElementById("infoNoticeModalTitle");
  const infoNoticeModalBody = document.getElementById("infoNoticeModalBody");
  const closeInfoNoticeModalBtn = document.getElementById("closeInfoNoticeModalBtn");
  const confirmInfoNoticeBtn = document.getElementById("confirmInfoNoticeBtn");

  const openInfoNotice = (type) => {
    if (!infoNoticeModal) return;
    let title = "nunu 서비스 안내";
    let body = "";

    if (type === "company") {
      title = "nunu Corp. 회사 소개";
      body = `
        <h3 style="margin-bottom:8px; color:#4f46e5; font-size:17px;">세상의 모든 정보를 하나로, nunu</h3>
        <p style="margin-bottom:10px;">nunu Corp.는 최첨단 AI 기술과 직관적인 브라우징 경험을 결합하여 대한민국을 넘어 글로벌 사용자에게 최고의 검색과 스마트 라이프스타일을 제공하는 차세대 포털 기업입니다.</p>
        <ul style="padding-left:18px; line-height:1.8;">
          <li><strong>핵심 서비스:</strong> nunu 통합 포털, 누누스카이 브라우저 앱, nunu AI Pro, nunu 메일, 북웨이브(오디오북), AI 그림일기</li>
          <li><strong>설립 이념:</strong> 정보 접근의 격차를 없애고 지능형 AI 도우미로 누구나 편리한 디지털 세상을 누리도록 혁신합니다.</li>
          <li><strong>본사 위치:</strong> 서울특별시 강남구 테헤란로 nunu 테크타워 12층</li>
        </ul>
      `;
    } else if (type === "terms") {
      title = "nunu 서비스 이용약관";
      body = `
        <h4 style="margin-bottom:6px; color:#0f172a;">제1조 (목적)</h4>
        <p style="margin-bottom:10px;">본 약관은 nunu Corp.(이하 "회사")가 제공하는 nunu 포털 및 관련 제반 서비스의 이용조건 및 절차, 회사와 회원 간의 권리와 의무를 규정함을 목적으로 합니다.</p>
        <h4 style="margin-bottom:6px; color:#0f172a;">제2조 (서비스의 제공 및 변경)</h4>
        <p style="margin-bottom:10px;">회사는 실시간 통합 검색, 인공지능 요약 브리핑, 북웨이브 오디오북, AI 창작 스튜디오 등의 서비스를 연중무휴 24시간 제공합니다.</p>
        <h4 style="margin-bottom:6px; color:#0f172a;">제3조 (회원의 의무)</h4>
        <p>회원은 관련 법령 및 본 약관의 규정을 준수하여야 하며, 타인의 권리를 침해하거나 서비스의 안전한 운영을 방해하는 행위를 해서는 안 됩니다.</p>
      `;
    } else if (type === "privacy") {
      title = "nunu 개인정보처리방침";
      body = `
        <h4 style="margin-bottom:6px; color:#0f172a;">1. 개인정보의 수집 및 이용 목적</h4>
        <p style="margin-bottom:10px;">회사는 회원 식별, 맞춤형 AI 서비스 제공, 고객 문의 응대 및 부정 이용 방지를 위하여 최소한의 개인정보를 수집합니다.</p>
        <h4 style="margin-bottom:6px; color:#0f172a;">2. 수집하는 개인정보 항목</h4>
        <p style="margin-bottom:10px;">- 필수항목: 아이디, 이름, 이메일 주소, 비밀번호<br>- 자동수집: 접속 IP 정보, 서비스 이용 기록</p>
        <h4 style="margin-bottom:6px; color:#0f172a;">3. 개인정보의 보유 및 이용 기간</h4>
        <p>회원 탈퇴 시 또는 목적 달성 시 즉시 파기하며, 관계 법령에 의해 보존할 필요가 있는 경우 해당 법정 기간 동안 안전하게 보관합니다.</p>
      `;
    } else if (type === "customer") {
      title = "nunu 고객센터 / 지원 안내";
      body = `
        <div style="background:#f8fafc; padding:16px; border-radius:10px; margin-bottom:12px; border:1px solid #e2e8f0;">
          <p style="font-size:15px; font-weight:700; color:#0284c7; margin-bottom:6px;"><i class="fa-solid fa-headset"></i> 365 nunu 고객행복센터</p>
          <p style="margin-bottom:4px;"><strong>대표 상담전화:</strong> 1588-0000 (평일 09:00 ~ 18:00)</p>
          <p style="margin-bottom:4px;"><strong>이메일 문의:</strong> support@nunu.com</p>
          <p><strong>1:1 실시간 상담:</strong> nunu AI 챗봇 및 24시간 티켓 지원 시스템</p>
        </div>
        <p style="color:#64748b; font-size:13px;">불편사항이나 개선 제안은 언제든지 고객센터 또는 사이드바 AI Chat을 통해 전달해주시면 신속히 반영하겠습니다.</p>
      `;
    } else if (type === "partnership") {
      title = "nunu 제휴 및 비즈니스 제안";
      body = `
        <h4 style="margin-bottom:6px; color:#0f172a;">nunu와 함께 성장할 파트너사를 환영합니다.</h4>
        <p style="margin-bottom:10px;">검색 제휴, 콘텐츠 입점(오디오북/뉴스/웹툰), AI 모델 연동 및 광고 제휴 등 다양한 협업 기회를 제공합니다.</p>
        <div style="background:#f0fdf4; padding:14px; border-radius:8px; border:1px solid #bbf7d0; margin-bottom:10px;">
          <p><strong>제휴 담당 부서:</strong> nunu 비즈니스 전략팀</p>
          <p><strong>제휴 문의 이메일:</strong> partner@nunu.com</p>
        </div>
        <p style="font-size:13px; color:#64748b;">제안서를 첨부하여 이메일로 보내주시면 영업일 기준 3일 이내에 담당자가 검토 후 회신드립니다.</p>
      `;
    }

    if (infoNoticeModalTitle) infoNoticeModalTitle.innerHTML = `<i class="fa-solid fa-circle-info" style="color: var(--primary-color);"></i> ` + title;
    if (infoNoticeModalBody) infoNoticeModalBody.innerHTML = body;
    infoNoticeModal.style.display = "flex";
  };

  const closeInfoNotice = () => {
    if (infoNoticeModal) infoNoticeModal.style.display = "none";
  };

  const linkCompany = document.getElementById("footerLinkCompany");
  const linkTerms = document.getElementById("footerLinkTerms");
  const linkPrivacy = document.getElementById("footerLinkPrivacy");
  const linkCustomer = document.getElementById("footerLinkCustomer");
  const linkPartnership = document.getElementById("footerLinkPartnership");

  if (linkCompany) linkCompany.addEventListener("click", (e) => { e.preventDefault(); openInfoNotice("company"); });
  if (linkTerms) linkTerms.addEventListener("click", (e) => { e.preventDefault(); openInfoNotice("terms"); });
  if (linkPrivacy) linkPrivacy.addEventListener("click", (e) => { e.preventDefault(); openInfoNotice("privacy"); });
  if (linkCustomer) linkCustomer.addEventListener("click", (e) => { e.preventDefault(); openInfoNotice("customer"); });
  if (linkPartnership) linkPartnership.addEventListener("click", (e) => { e.preventDefault(); openInfoNotice("partnership"); });

  if (closeInfoNoticeModalBtn) closeInfoNoticeModalBtn.addEventListener("click", closeInfoNotice);
  if (confirmInfoNoticeBtn) confirmInfoNoticeBtn.addEventListener("click", closeInfoNotice);
  if (infoNoticeModal) {
    infoNoticeModal.addEventListener("click", (e) => {
      if (e.target === infoNoticeModal) closeInfoNotice();
    });
  }

  // 아이디 중복 확인 기능 (API 우선 연동)
  if (checkIdDupBtn && signupIdInput) {
    checkIdDupBtn.addEventListener("click", async () => {
      const id = signupIdInput.value.trim();
      if (!id) {
        idCheckHint.textContent = "아이디를 먼저 입력해주세요.";
        idCheckHint.className = "input-hint error";
        return;
      }
      if (id.length < 3) {
        idCheckHint.textContent = "아이디는 3자 이상이어야 합니다.";
        idCheckHint.className = "input-hint error";
        return;
      }

      try {
        const res = await fetch(`/api/check-id?id=${encodeURIComponent(id)}`);
        const result = await res.json();
        if (result.isDuplicate) {
          idCheckHint.textContent = "이미 사용 중인 아이디입니다.";
          idCheckHint.className = "input-hint error";
        } else {
          idCheckHint.textContent = "사용 가능한 아이디입니다! ✓";
          idCheckHint.className = "input-hint success";
        }
      } catch (err) {
        // 백엔드 미구동 시 로컬스토리지 fallback
        const users = getUsers();
        const isExist = users.some(u => u.id.toLowerCase() === id.toLowerCase());
        if (isExist) {
          idCheckHint.textContent = "이미 사용 중인 아이디입니다.";
          idCheckHint.className = "input-hint error";
        } else {
          idCheckHint.textContent = "사용 가능한 아이디입니다! ✓";
          idCheckHint.className = "input-hint success";
        }
      }
    });
  }

  // 회원가입 제출 처리 (API 우선 연동)
  if (doSignupBtn) {
    doSignupBtn.addEventListener("click", async () => {
      const id = signupIdInput ? signupIdInput.value.trim() : "";
      const name = signupNameInput ? signupNameInput.value.trim() : "";
      const email = signupEmailInput ? signupEmailInput.value.trim() : "";
      const pw = signupPwInput ? signupPwInput.value : "";
      const pwConfirm = signupPwConfirmInput ? signupPwConfirmInput.value : "";

      signupErrorMsg.style.display = "none";
      signupSuccessMsg.style.display = "none";

      // 유효성 검사
      if (!id || !name || !email || !pw || !pwConfirm) {
        signupErrorMsg.textContent = "모든 항목을 빠짐없이 입력해주세요.";
        signupErrorMsg.style.display = "block";
        return;
      }

      if (id.length < 3) {
        signupErrorMsg.textContent = "아이디는 최소 3자 이상이어야 합니다.";
        signupErrorMsg.style.display = "block";
        return;
      }

      if (pw.length < 4) {
        signupErrorMsg.textContent = "비밀번호는 최소 4자 이상이어야 합니다.";
        signupErrorMsg.style.display = "block";
        return;
      }

      if (pw !== pwConfirm) {
        signupErrorMsg.textContent = "비밀번호와 비밀번호 확인이 일치하지 않습니다.";
        signupErrorMsg.style.display = "block";
        return;
      }

      try {
        const res = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name, email, password: pw })
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
          signupErrorMsg.textContent = result.message || "회원가입에 실패했습니다.";
          signupErrorMsg.style.display = "block";
          return;
        }

        signupSuccessMsg.textContent = `축하합니다! ${name} 님의 nunu 회원가입이 완료되었습니다. 로그인 화면으로 이동합니다.`;
        signupSuccessMsg.style.display = "block";

        // 로컬스토리지에도 동기화
        const users = getUsers();
        users.push({ id, name, email, password: pw, createdAt: new Date().toISOString() });
        saveUsers(users);

        if (signupForm) signupForm.reset();

        setTimeout(() => {
          openLoginModal();
          if (loginIdInput) loginIdInput.value = id;
          if (loginPwInput) loginPwInput.focus();
        }, 1200);

      } catch (err) {
        // 로컬스토리지 fallback
        const users = getUsers();
        if (users.some(u => u.id.toLowerCase() === id.toLowerCase())) {
          signupErrorMsg.textContent = "이미 등록된 아이디입니다. 다른 아이디를 사용해주세요.";
          signupErrorMsg.style.display = "block";
          return;
        }

        const newUser = { id, name, email, password: pw, createdAt: new Date().toISOString() };
        users.push(newUser);
        saveUsers(users);

        signupSuccessMsg.textContent = `축하합니다! ${name} 님의 nunu 회원가입이 완료되었습니다. 로그인 화면으로 이동합니다.`;
        signupSuccessMsg.style.display = "block";

        if (signupForm) signupForm.reset();

        setTimeout(() => {
          openLoginModal();
          if (loginIdInput) loginIdInput.value = id;
          if (loginPwInput) loginPwInput.focus();
        }, 1200);
      }
    });
  }

  // 로그인 제출 처리 (API 우선 연동)
  const processLogin = async () => {
    const inputId = loginIdInput ? loginIdInput.value.trim() : "";
    const inputPw = loginPwInput ? loginPwInput.value : "";

    loginErrorMsg.style.display = "none";

    if (!inputId || !inputPw) {
      loginErrorMsg.textContent = "아이디와 비밀번호를 모두 입력해주세요.";
      loginErrorMsg.style.display = "block";
      return;
    }

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inputId, password: inputPw })
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        loginErrorMsg.textContent = result.message || "일치하는 회원 정보가 없습니다.";
        loginErrorMsg.style.display = "block";
        return;
      }

      // 로그인 성공
      setCurrentUser(result.user);
      updateAuthUI(result.user);
      closeAllAuthModals();

      if (loginForm) loginForm.reset();

    } catch (err) {
      // 로컬스토리지 fallback
      const users = getUsers();
      const matchedUser = users.find(u =>
        (u.id.toLowerCase() === inputId.toLowerCase() || u.email.toLowerCase() === inputId.toLowerCase()) &&
        u.password === inputPw
      );

      if (!matchedUser) {
        loginErrorMsg.textContent = "일치하는 회원 정보가 없습니다. 아이디와 비밀번호를 다시 확인하시거나 회원가입을 먼저 진행해주세요.";
        loginErrorMsg.style.display = "block";
        return;
      }

      setCurrentUser(matchedUser);
      updateAuthUI(matchedUser);
      closeAllAuthModals();

      if (loginForm) loginForm.reset();
    }
  };

  if (doLoginBtn) {
    doLoginBtn.addEventListener("click", processLogin);
  }

  // 엔터 키 처리
  if (loginPwInput) {
    loginPwInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") processLogin();
    });
  }

  // 로그아웃 처리
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("로그아웃 하시겠습니까?")) {
        setCurrentUser(null);
        updateAuthUI(null);
      }
    });
  }

  // 로그인 UI 갱신 함수
  const updateAuthUI = (user) => {
    const navMailBadge = document.getElementById("navMailBadge");
    const userMailCount = document.getElementById("userMailUnreadCount");

    if (user) {
      if (loggedOutView) loggedOutView.style.display = "none";
      if (loggedInView) loggedInView.style.display = "block";
      if (topLoginBtn) topLoginBtn.innerHTML = `<i class="fa-solid fa-user-check"></i> <span>${user.name}</span>`;
      if (userName) userName.textContent = `${user.name} 님`;
      if (userEmail) userEmail.textContent = user.email || `${user.id}@nunu.com`;

      // nunu 메일 미확인 개수 조회
      fetch(`/api/mail/stats?user_id=${encodeURIComponent(user.id)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.unread > 0) {
            const displayCount = data.unread > 99 ? "99+" : data.unread;
            if (navMailBadge) {
              navMailBadge.textContent = displayCount;
              navMailBadge.style.display = "inline-block";
            }
            if (userMailCount) userMailCount.textContent = displayCount;
          } else {
            if (navMailBadge) navMailBadge.style.display = "none";
            if (userMailCount) userMailCount.textContent = "0";
          }
        })
        .catch(() => {});
    } else {
      if (loggedOutView) loggedOutView.style.display = "block";
      if (loggedInView) loggedInView.style.display = "none";
      if (topLoginBtn) topLoginBtn.innerHTML = `<i class="fa-regular fa-user"></i> <span>로그인</span>`;
      if (navMailBadge) navMailBadge.style.display = "none";
      if (userMailCount) userMailCount.textContent = "0";
    }
  };

  // 초기 로그인 상태 렌더링
  const currentUser = getCurrentUser();
  updateAuthUI(currentUser);
}

// ==========================================
// 13. 다크 모드 / 라이트 모드 테마 관리
// ==========================================
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

// ==========================================
// 14. 북웨이브 (bookwave) 프로젝트 연동
// ==========================================
function initBookwaveIntegration() {
  const navBtn = document.getElementById("btnLaunchBookwaveNav");
  const mainBtn = document.getElementById("btnLaunchBookwaveMain");
  const bookwaveUrl = "https://bookwave-server.onrender.com";

  const openBookwave = (e) => {
    if (e) e.preventDefault();
    window.open(bookwaveUrl, "_blank");
  };

  if (navBtn) navBtn.addEventListener("click", openBookwave);
  if (mainBtn) mainBtn.addEventListener("click", openBookwave);
}

// ==========================================
// 15. 스마트폰 / 다른 기기 연결 모달
// ==========================================
function initDeviceConnect() {
  const btn = document.getElementById("deviceConnectBtn");
  const modal = document.getElementById("deviceConnectModal");
  const closeBtn = document.getElementById("closeDeviceConnectModalBtn");
  const copyBtn = document.getElementById("copyDeviceUrlBtn");
  const urlText = document.getElementById("deviceConnectUrlText");
  const copyPublicBtn = document.getElementById("copyPublicUrlBtn");
  const publicUrlText = document.getElementById("publicTunnelUrlText");

  let networkUrl = `http://192.168.0.3:8080`;
  let publicUrl = `https://worker-temporary-soundtrack-flights.trycloudflare.com`;

  // 서버에서 로컬 IP 및 공용 외부 접속 주소 실시간 조회
  fetch("/api/network-info")
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        if (data.networkUrl) {
          networkUrl = data.networkUrl;
          if (urlText) urlText.textContent = networkUrl;
        }
        if (data.publicUrl) {
          publicUrl = data.publicUrl;
          if (publicUrlText) publicUrlText.textContent = publicUrl;
        }
      }
    })
    .catch(() => {});

  if (btn && modal) {
    btn.addEventListener("click", () => {
      modal.style.display = "flex";
    });

    const closeModal = () => { modal.style.display = "none"; };
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // 외부 LTE / 5G 접속 URL 복사 버튼
  if (copyPublicBtn) {
    copyPublicBtn.addEventListener("click", () => {
      const text = publicUrlText ? publicUrlText.textContent : publicUrl;
      navigator.clipboard.writeText(text).then(() => {
        copyPublicBtn.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> 복사 완료!`;
        setTimeout(() => {
          copyPublicBtn.innerHTML = `<i class="fa-regular fa-copy"></i> 복사`;
        }, 1500);
      });
    });
  }

  // Wi-Fi 내부 접속 URL 복사 버튼
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const text = urlText ? urlText.textContent : networkUrl;
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> 복사 완료!`;
        setTimeout(() => {
          copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> 복사`;
        }, 1500);
      });
    });
  }
}

// ==========================================
// 16. 홈 화면 관리자 사이드 날개 광고 표출 (화면 좌/우측 최대 2개)
// ==========================================
async function initHomeAds() {
  const wingLeft = document.getElementById("homeAdWingLeft");
  const wingRight = document.getElementById("homeAdWingRight");

  if (!wingLeft && !wingRight) return;

  try {
    const curUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
    const userId = curUser && curUser.id ? encodeURIComponent(curUser.id) : "";
    const res = await fetch(`/api/ads${userId ? `?user_id=${userId}` : ""}`);
    if (!res.ok) {
      if (wingLeft) wingLeft.style.display = "none";
      if (wingRight) wingRight.style.display = "none";
      return;
    }

    const data = await res.json();
    if (!data.success || !data.globalAdsEnabled || data.userAdsEnabled === false || !Array.isArray(data.ads) || data.ads.length === 0) {
      if (wingLeft) wingLeft.style.display = "none";
      if (wingRight) wingRight.style.display = "none";
      return;
    }

    if (wingLeft) wingLeft.innerHTML = "";
    if (wingRight) wingRight.innerHTML = "";

    // 서버에서 3개 이상 시 랜덤 2개, 또는 최대 2개로 반환됨
    const adsToShow = data.ads.slice(0, 2);

    const buildAdCard = (ad) => {
      const hasLink = Boolean(ad.linkUrl && ad.linkUrl.trim());
      const card = document.createElement(hasLink ? "a" : "div");
      if (hasLink) {
        card.href = ad.linkUrl;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
      }
      card.className = "home-ad-card" + (hasLink ? " has-link" : " no-link");

      let mediaHtml = "";
      if (ad.mediaType === "image" && ad.mediaUrl) {
        mediaHtml = `
          <div class="home-ad-media-wrapper">
            <img src="${escapeHtml(ad.mediaUrl)}" alt="${escapeHtml(ad.title)}" onerror="this.onerror=null;this.parentElement.style.display='none';">
          </div>
        `;
      } else if (ad.mediaType === "video" && ad.mediaUrl) {
        mediaHtml = `
          <div class="home-ad-media-wrapper">
            <video src="${escapeHtml(ad.mediaUrl)}" autoplay muted loop playsinline></video>
          </div>
        `;
      } else {
        card.classList.add("text-only");
      }

      const linkArrowHtml = hasLink ? `<i class="fa-solid fa-arrow-up-right-from-square home-ad-arrow"></i>` : "";

      card.innerHTML = `
        <div class="home-ad-badge"><i class="fa-solid fa-rectangle-ad"></i> AD</div>
        ${mediaHtml}
        <div class="home-ad-content">
          <div class="home-ad-title-row">
            <h4 class="home-ad-title">${escapeHtml(ad.title)}</h4>
            ${linkArrowHtml}
          </div>
          ${ad.desc ? `<p class="home-ad-desc">${escapeHtml(ad.desc)}</p>` : ""}
        </div>
      `;
      return card;
    };

    if (adsToShow.length === 1) {
      // 1개만 등록된 경우에도 사진에서 동그라미 친 좌/우 양쪽에 모두 띄워 사용자 화면을 채움
      if (wingLeft) {
        wingLeft.appendChild(buildAdCard(adsToShow[0]));
        wingLeft.style.display = "flex";
      }
      if (wingRight) {
        wingRight.appendChild(buildAdCard(adsToShow[0]));
        wingRight.style.display = "flex";
      }
    } else if (adsToShow.length >= 2) {
      // 2개일 경우 사진에서 동그라미 친 좌측과 우측에 각각 1개씩 분산 배치
      if (wingLeft) {
        wingLeft.appendChild(buildAdCard(adsToShow[0]));
        wingLeft.style.display = "flex";
      }
      if (wingRight) {
        wingRight.appendChild(buildAdCard(adsToShow[1]));
        wingRight.style.display = "flex";
      }
    }
  } catch (err) {
    console.error("홈 화면 사이드 광고 로드 실패:", err);
    if (wingLeft) wingLeft.style.display = "none";
    if (wingRight) wingRight.style.display = "none";
  }
}

// ==========================================
// 17. nunuAI(설명용) 전용 사이트 안내 대화 엔진
//     (nunu 포털, 북웨이브, nunu AI, 관리자 웹 등 사이트 관련 질문만 대답)
// ==========================================
function initAiGuideModal() {
  const guideBtn = document.getElementById("floatingAiGuideBtn");
  const modal = document.getElementById("nunuAiGuideModal");
  const closeBtn = document.getElementById("closeAiGuideModalBtn");
  const chatBody = document.getElementById("explainChatBody");
  const inputEl = document.getElementById("explainInput");
  const sendBtn = document.getElementById("explainSendBtn");

  if (!guideBtn || !modal) return;

  guideBtn.addEventListener("click", () => {
    modal.style.display = "flex";
    if (inputEl) inputEl.focus();
  });

  const closeModal = () => {
    modal.style.display = "none";
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // nunu포털 & 북웨이브 & 인공지능 관련 지식베이스 응답 생성기
  const generateSiteExplainReply = (rawQuestion) => {
    const q = rawQuestion.toLowerCase().trim();

    // 1. 북웨이브 (Bookwave) 관련 질문
    if (q.includes("북웨이브") || q.includes("bookwave") || q.includes("오디오북") || q.includes("전자책") || q.includes("epub") || q.includes("플레이어")) {
      return `📚 <strong>북웨이브 (Bookwave)</strong>는 nunu 포털과 공식 연동된 프리미엄 독서 & 오디오북 플랫폼입니다.<br><br>
      • 🎧 <strong>고음질 오디오북 스트리밍</strong>: 언제 어디서나 책을 귀로 몰입감 있게 들을 수 있습니다.<br>
      • 📖 <strong>EPUB 전자책 뷰어</strong>: 스마트폰과 PC 브라우저에 최적화된 리더기 환경을 제공합니다.<br>
      • 🔗 <strong>접속 주소</strong>: <a href="https://bookwave-server.onrender.com" target="_blank" style="color: #4f46e5; font-weight: 700; text-decoration: underline;">북웨이브 바로가기 (클릭)</a><br>
      • 포털 상단 브라우저 주소창이나 중앙 북마크 첫 번째 아이콘에서도 원클릭으로 바로 접속하실 수 있습니다.`;
    }

    // 2. nunu 포인트 / 크레딧 관련 질문
    if (q.includes("포인트") || q.includes("크레딧") || q.includes("코인") || q.includes("비용") || q.includes("차감") || q.includes("충전")) {
      return `🪙 <strong>nunu 포인트(크레딧)</strong>는 nunu AI Pro 창작 기능을 이용할 때 소모되는 생성 크레딧입니다.<br><br>
      • 💬 <strong>언어 대화 & 번역</strong>: 1회당 <strong>-1 크레딧</strong><br>
      • 🎨 <strong>그림/이미지 생성</strong>: 1회당 <strong>-2 크레딧</strong><br>
      • 🎵 <strong>음악 작곡 (BGM/노래)</strong>: 1회당 <strong>-2 크레딧</strong><br>
      • 🎬 <strong>동영상 제작 (Veo)</strong>: 1회당 <strong>-10 크레딧</strong><br>
      • 🎁 <strong>매일 자정(00:00) 20개 무료 충전</strong>: 매일 자동으로 기본 20개가 리필됩니다!<br>
      • 관리자 센터에서 계정별로 추가 지급하거나 차감하여 관리할 수도 있습니다.`;
    }

    // 3. nunu AI 기능 및 PRO / 일반 모델 관련 질문
    if (q.includes("nunu ai") || q.includes("nunuai") || q.includes("인공지능") || q.includes("ai") || q.includes("창작") || q.includes("pro") || q.includes("프로") || q.includes("플래시") || q.includes("제미나이") || q.includes("재미나이")) {
      return `🎨 <strong>nunu AI Pro 스튜디오</strong>는 포털에 탑재된 올인원 생성형 인공지능입니다.<br><br>
      • <strong>멀티모달 4대 핵심 기능:</strong><br>
      &nbsp;&nbsp;1) <strong>음악 작곡:</strong> 분위기와 악기를 입력하면 실제 재생 가능한 음악/BGM 즉시 작곡<br>
      &nbsp;&nbsp;2) <strong>고화질 이미지 생성:</strong> 프롬프트 기반 나노바나나 고해상도 일러스트 제작 (우측 하단 nunuAI 워터마크 자동 부착)<br>
      &nbsp;&nbsp;3) <strong>동영상 제작:</strong> 30초~1분 인터랙티브 비디오 렌더링 및 재생<br>
      &nbsp;&nbsp;4) <strong>언어 & 번역:</strong> 실시간 초고지능 지식 대화 및 다국어 번역<br>
      • <strong>엔진 구분:</strong> 일반 모델은 <strong>재미나이 3.8 플래시</strong>, PRO 모델은 최고 성능 <strong>Gemini PRO</strong>가 탑재되어 있으며 PRO 에러 시 자동으로 플래시로 전환됩니다.`;
    }

    // 4. 광고 ON/OFF (전체 / 개별 / 개인) 관련 질문
    if (q.includes("광고") || q.includes("on off") || q.includes("onoff") || q.includes("켜기") || q.includes("끄기") || q.includes("배너")) {
      return `📢 <strong>nunu 포털 광고 시스템 가이드:</strong><br><br>
      포털 홈 화면 검색창 좌우 날개 영역에 최대 2개의 광고가 표시되며, 관리자 센터에서 3가지 방식으로 자유롭게 ON/OFF할 수 있습니다.<br>
      1. <strong>전체 광고 ON/OFF:</strong> 관리자 상단 스위치로 포털 전체의 모든 광고 일괄 켜기/끄기<br>
      2. <strong>개별 광고 ON/OFF:</strong> 등록된 각 광고 카드의 노출/숨김 배지 버튼으로 특정 광고만 제어<br>
      3. <strong>개인 광고 ON/OFF:</strong> 사용자 관리 테이블에서 특정 회원 계정마다 광고 노출 여부를 개별 설정 (광고 ON / 광고 OFF)<br>
      • 💡 광고 등록 시 이미지나 동영상 첨부는 선택 사항이며, 3개 이상 등록 시 랜덤으로 2개가 자동 노출됩니다.`;
    }

    // 5. 북마크 / 실시간 검색 / 날씨 / 증시 등 포털 기능 질문
    if (q.includes("포털") || q.includes("홈") || q.includes("사이트") || q.includes("북마크") || q.includes("검색") || q.includes("날씨") || q.includes("증시") || q.includes("뉴스") || q.includes("메일") || q.includes("+") || q.includes("플러스")) {
      return `🌐 <strong>nunu 포털 주요 기능 안내:</strong><br><br>
      • 🔍 <strong>구글 스타일 실시간 검색:</strong> 검색창에 키워드나 URL을 입력하고 엔터를 누르면 즉시 결과를 탐색하며 입력창은 자동으로 비워집니다.<br>
      • 📌 <strong>빠른 북마크:</strong> 북웨이브, 네이버, 구글, 유튜브 등 자주 찾는 사이트를 원클릭으로 이동할 수 있습니다.<br>
      • 📰 <strong>실시간 위젯:</strong> 실시간 검색어, 분야별 뉴스, 코스피/코스닥 증시 차트, 날씨/미세먼지, 투두리스트 제공<br>
      • ➕ <strong>좌측 하단 [+] 버튼:</strong> 클릭 시 공식 운영자(yeonu8683@gmail.com)에게 Gmail로 즉시 메일을 보낼 수 있습니다.<br>
      • 📱 <strong>기기 간 동기화:</strong> 상단 [다른 기기 접속]을 통해 LTE/스마트폰에서도 동일한 계정으로 접속할 수 있습니다.`;
    }

    // 6. 회원가입 / 로그인 / 관리자 웹 관련 질문
    if (q.includes("회원가입") || q.includes("로그인") || q.includes("관리자") || q.includes("admin") || q.includes("계정") || q.includes("비밀번호")) {
      return `🔐 <strong>회원 계정 및 관리자 센터 안내:</strong><br><br>
      • <strong>회원가입 & 로그인:</strong> 우측 상단 로그인 버튼을 통해 간편하게 계정을 생성하고 접속할 수 있으며, 가입 즉시 20 크레딧이 지급됩니다.<br>
      • <strong>관리자 센터 (admin.html):</strong> 전체/개인/개별 광고 관리, Gemini API 키 설정, 사용자별 크레딧 지급/차감, PRO 권한 승인을 원스톱으로 관리할 수 있습니다.`;
    }

    // 7. 사이트와 무관한 외부 질문(수학, 일반 상식, 역사 등)에 대한 필터링
    return `⚠️ <strong>저는 nunu 포털 및 북웨이브, nunu AI 안내 전용 어시스턴트입니다.</strong><br><br>
    현재 질문해주신 내용은 사이트 안내 범위를 벗어난 일반 질문입니다.<br>
    저는 <strong>nunu 포털의 기능(검색, 북마크, 위젯), 북웨이브(Bookwave), nunu AI 사용법 및 크레딧, 광고 설정</strong> 등 <u>이 사이트에 관한 내용에 대해서만</u> 친절히 답변해 드립니다! ✨<br><br>
    💡 일반 AI 대화나 창작을 원하시면 상단의 <strong>[nunu AI Pro 창작 스튜디오]</strong>를 이용해주세요!`;
  };

  const appendExplainMsg = (role, htmlText) => {
    if (!chatBody) return;
    const msgRow = document.createElement("div");
    msgRow.className = `explain-msg explain-msg-${role}`;
    const avatarHtml = role === "bot" 
      ? `<div class="explain-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>`
      : `<div class="explain-avatar"><i class="fa-solid fa-user"></i></div>`;

    msgRow.innerHTML = `
      ${avatarHtml}
      <div class="explain-bubble">${htmlText}</div>
    `;
    chatBody.appendChild(msgRow);
    chatBody.scrollTop = chatBody.scrollHeight;
  };

  const handleExplainSend = (text) => {
    const q = text.trim();
    if (!q) return;

    appendExplainMsg("user", escapeHtml(q).replace(/\n/g, "<br>"));

    if (inputEl) inputEl.value = "";

    setTimeout(() => {
      const replyHtml = generateSiteExplainReply(q);
      appendExplainMsg("bot", replyHtml);
    }, 250);
  };

  if (sendBtn && inputEl) {
    sendBtn.addEventListener("click", () => handleExplainSend(inputEl.value));
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleExplainSend(inputEl.value);
    });
  }

  // 추천 질문 칩 클릭 이벤트
  document.querySelectorAll(".explain-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const q = chip.dataset.q;
      if (q) handleExplainSend(q);
    });
  });
}





// ==========================================
// nunuSky (누누스카이) PWA & App Modal Handler
// ==========================================
let nunuSkyDeferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  nunuSkyDeferredPrompt = e;
  console.log('[nunuSky] PWA install prompt ready');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration error:', err);
    });
  });
}

function initNunuSkyAppModal() {
  const installBtn = document.getElementById('btnInstallNunuSky');
  const modal = document.getElementById('nunuSkyAppModal');
  const closeBtn = document.getElementById('btnCloseNunuSkyModal');
  const triggerBtn = document.getElementById('btnTriggerPwaInstall');

  if (installBtn && modal) {
    installBtn.addEventListener('click', () => {
      modal.style.display = 'flex';
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  if (triggerBtn) {
    triggerBtn.addEventListener('click', async () => {
      if (nunuSkyDeferredPrompt) {
        nunuSkyDeferredPrompt.prompt();
        const { outcome } = await nunuSkyDeferredPrompt.userChoice;
        console.log('[nunuSky] Install outcome:', outcome);
        nunuSkyDeferredPrompt = null;
        if (modal) modal.style.display = 'none';
      } else {
        alert("누누스카이(nunuSky) 앱이 이미 컴퓨터 바탕화면에 생성되어 있습니다!

바탕화면의 [누누스카이 (nunuSky)] 아이콘을 더블클릭하시면 주소창 없는 독립 데스크톱 브라우저 앱으로 바로 실행됩니다.");
        if (modal) modal.style.display = 'none';
      }
    });
  }
}

// Auto init nunuSky app modal
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNunuSkyAppModal);
} else {
  initNunuSkyAppModal();
}


// ==========================================
// nunuSky AI Side Panel (화면을 함께 보며 대화하는 AI 어시스턴트)
// ==========================================
let isAiSidePanelOpen = false;
let aiSideChatHistory = [];

function toggleAiSidePanel(forceState) {
  if (!isNunuSkyAppMode()) return; // AI 챗봇은 누누스카이(앱)에서만 실행 가능

  const panel = document.getElementById('aiSidePanel');
  if (!panel) return;
  panel.style.display = "flex";

  if (typeof forceState === 'boolean') {
    isAiSidePanelOpen = forceState;
  } else {
    isAiSidePanelOpen = !isAiSidePanelOpen;
  }

  if (isAiSidePanelOpen) {
    panel.classList.add('open');
    updateAiSideContext();
    const ta = document.getElementById('aiSideTextarea');
    if (ta) ta.focus();
  } else {
    panel.classList.remove('open');
  }
}

function getActiveScreenContext() {
  const currentTab = typeof chromeTabs !== 'undefined' ? chromeTabs.find(t => t.id === activeChromeTabId) : null;
  let title = currentTab ? currentTab.title : document.title || "nunuSky 포털";
  let url = currentTab ? currentTab.url : window.location.href;
  let pageContent = "";

  if (!currentTab || currentTab.type === "portal") {
    title = "nunu 포털 홈";
    url = "https://nunu.com/";
    // Extract key text from main portal
    const trendingEl = document.getElementById("trendingTicker");
    const trendingText = trendingEl ? trendingEl.innerText : "";
    const newsCards = Array.from(document.querySelectorAll(".news-item, .post-item")).slice(0, 5).map(e => e.innerText).join(" | ");
    pageContent = `nunu 포털 홈 화면입니다. 실시간 검색어: ${trendingText}. 주요 뉴스/콘텐츠: ${newsCards}`;
  } else if (currentTab.type === "search") {
    title = `'${currentTab.query || ""}' nunu 검색 결과`;
    url = `https://nunu.com/search?q=${encodeURIComponent(currentTab.query || "")}`;
    const resultsContainer = document.getElementById("tabSearchResults_" + currentTab.id);
    pageContent = resultsContainer ? resultsContainer.innerText.slice(0, 1500) : `검색어 '${currentTab.query}'의 5대 포털 실시간 검색 결과 화면입니다.`;
  } else if (currentTab.type === "diary") {
    title = "AI 그림일기 & 작문 코칭";
    url = "https://nunu.com/diary";
    const diaryInput = document.getElementById("diaryContent");
    pageContent = diaryInput && diaryInput.value ? `사용자 작성 일기: ${diaryInput.value}` : "AI 그림일기 작성 화면입니다.";
  } else if (currentTab.type === "mail") {
    title = "nunu 스마트 메일";
    url = "https://nunu.com/mail";
    pageContent = "nunu 스마트 웹메일 관리 화면입니다.";
  } else if (currentTab.type === "ai") {
    title = "nunu AI Pro 메인";
    url = "https://nunu.com/ai";
    pageContent = "nunu AI Pro 창작 및 대화 화면입니다.";
  } else {
    title = currentTab.title || "웹 페이지";
    url = currentTab.url || "";
    pageContent = `사용자가 방문 중인 외부 웹 페이지(${url})입니다.`;
  }

  return { title, url, pageContent };
}

function updateAiSideContext() {
  const label = document.getElementById('aiSideContextLabel');
  if (!label) return;
  const ctx = getActiveScreenContext();
  label.textContent = ctx.title;
  label.title = `${ctx.title} (${ctx.url})`;
}

async function sendAiSideMessage(userText) {
  const q = (userText || "").trim();
  if (!q) return;

  const msgsContainer = document.getElementById('aiSideMessages');
  const welcomeEl = document.getElementById('aiSideWelcome');
  const textarea = document.getElementById('aiSideTextarea');
  const sendBtn = document.getElementById('btnAiSideSend');

  if (welcomeEl) welcomeEl.style.display = 'none';

  // 1. Add User message bubble
  const userDiv = document.createElement('div');
  userDiv.className = 'ai-side-msg user';
  userDiv.innerHTML = `<div class="ai-side-bubble">${escapeHtmlForTab(q)}</div>`;
  msgsContainer.appendChild(userDiv);

  if (textarea) textarea.value = "";
  if (sendBtn) sendBtn.disabled = true;

  // 2. Add loading AI bubble
  const aiDiv = document.createElement('div');
  aiDiv.className = 'ai-side-msg assistant';
  aiDiv.innerHTML = `
    <div class="ai-side-bubble" style="color: #64748b; display: flex; align-items: center; gap: 8px;">
      <i class="fa-solid fa-spinner fa-spin" style="color: #0ea5e9;"></i>
      <span>화면을 분석하며 생각하는 중...</span>
    </div>
  `;
  msgsContainer.appendChild(aiDiv);
  msgsContainer.scrollTop = msgsContainer.scrollHeight;

  const ctx = getActiveScreenContext();

  try {
    const res = await fetch('/api/ai/sidechat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: q,
        context: ctx
      })
    });

    if (!res.ok) throw new Error('AI SideChat HTTP ' + res.status);
    const data = await res.json();
    const reply = data.reply || "죄송합니다, 답변을 생성하지 못했습니다.";

    // Format Markdown / Bold in reply
    let formattedReply = escapeHtmlForTab(reply)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^[•\-]\s*(.*)$/gm, '<div style="display:flex; align-items:flex-start; gap:6px; margin: 3px 0;"><span style="color:#0ea5e9;">•</span><span>$1</span></div>');

    aiDiv.innerHTML = `
      <div class="ai-side-bubble">
        <div style="font-size: 11px; font-weight: 700; color: #0ea5e9; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
          <i class="fa-solid fa-wand-magic-sparkles"></i> nunu AI
        </div>
        <div>${formattedReply}</div>
      </div>
    `;
  } catch (err) {
    console.warn('AI SideChat error:', err);
    aiDiv.innerHTML = `
      <div class="ai-side-bubble">
        <p>📄 <strong>현재 화면('${escapeHtmlForTab(ctx.title)}')</strong>을 확인했습니다.</p>
        <p style="margin-top: 6px;">${escapeHtmlForTab(ctx.pageContent.slice(0, 180))}...</p>
        <p style="margin-top: 8px; font-size: 12px; color: #64748b;">(네트워크 연결 상태를 확인하시면 더 스마트한 심층 대화가 가능합니다)</p>
      </div>
    `;
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    msgsContainer.scrollTop = msgsContainer.scrollHeight;
  }
}

function initAiSidePanel() {
  const toggleBtn = document.getElementById('btnToggleSideAi');
  const closeBtn = document.getElementById('btnAiSideClose');
  const newChatBtn = document.getElementById('btnAiSideNewChat');
  const sendBtn = document.getElementById('btnAiSideSend');
  const textarea = document.getElementById('aiSideTextarea');
  const msgsContainer = document.getElementById('aiSideMessages');
  const welcomeEl = document.getElementById('aiSideWelcome');

  if (toggleBtn) toggleBtn.addEventListener('click', () => toggleAiSidePanel());
  if (closeBtn) closeBtn.addEventListener('click', () => toggleAiSidePanel(false));

  const ctxActionBtn = document.getElementById('btnAiSideContextAction');
  if (ctxActionBtn) {
    ctxActionBtn.addEventListener('click', () => {
      const icon = ctxActionBtn.querySelector('i');
      if (icon) icon.classList.add('fa-spin');
      updateAiSideContext();
      setTimeout(() => {
        if (icon) icon.classList.remove('fa-spin');
        showToastNotice('현재 화면 정보를 최신 상태로 새로고침했습니다.');
      }, 350);
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      if (msgsContainer) {
        msgsContainer.innerHTML = '';
        if (welcomeEl) {
          welcomeEl.style.display = 'block';
          msgsContainer.appendChild(welcomeEl);
        }
      }
      updateAiSideContext();
    });
  }

  if (sendBtn && textarea) {
    sendBtn.addEventListener('click', () => {
      sendAiSideMessage(textarea.value);
    });
  }

  if (textarea) {
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAiSideMessage(textarea.value);
      }
    });
  }

  // Bind Quick Chips
  document.querySelectorAll('.ai-side-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const p = chip.dataset.prompt;
      if (p) sendAiSideMessage(p);
    });
  });

  // Global Keyboard shortcut: Ctrl + Shift + A (누누스카이 앱에서만)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      if (!isNunuSkyAppMode()) return;
      e.preventDefault();
      toggleAiSidePanel();
    }
  });
}

// Hook into chrome tab activation to update side AI context automatically
const originalActivateChromeTab = typeof activateChromeTab === 'function' ? activateChromeTab : null;
if (originalActivateChromeTab) {
  activateChromeTab = function(tabId) {
    originalActivateChromeTab(tabId);
    if (isAiSidePanelOpen) {
      updateAiSideContext();
    }
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAiSidePanel);
} else {
  initAiSidePanel();
}

// ==========================================
// 시스템 긴급 비상정지 사이렌 테이크오버 리스너 (포털웹 & 누누스카이앱)
// ==========================================
let sirenAudioCtx = null;
let sirenOscillator = null;
let sirenGainNode = null;
let isSirenSoundMuted = false;
let isEmergencyActive = false;

function startSirenSound() {
  if (isSirenSoundMuted) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!sirenAudioCtx) {
      sirenAudioCtx = new AudioContextClass();
    }
    if (sirenAudioCtx.state === 'suspended') {
      sirenAudioCtx.resume();
    }
    if (sirenOscillator) return;

    sirenOscillator = sirenAudioCtx.createOscillator();
    sirenGainNode = sirenAudioCtx.createGain();

    sirenOscillator.type = 'sawtooth';
    sirenGainNode.gain.setValueAtTime(0.08, sirenAudioCtx.currentTime);

    // Realistic oscillating siren pitch sweep (640Hz <-> 960Hz)
    const now = sirenAudioCtx.currentTime;
    sirenOscillator.frequency.setValueAtTime(640, now);

    let isHigh = false;
    sirenOscillator._interval = setInterval(() => {
      if (!sirenAudioCtx || !sirenOscillator) return;
      const t = sirenAudioCtx.currentTime;
      isHigh = !isHigh;
      try {
        sirenOscillator.frequency.exponentialRampToValueAtTime(isHigh ? 960 : 640, t + 0.55);
      } catch (err) {}
    }, 600);

    sirenOscillator.connect(sirenGainNode);
    sirenGainNode.connect(sirenAudioCtx.destination);
    sirenOscillator.start();
  } catch (e) {
    console.warn("Siren audio error:", e);
  }
}

function stopSirenSound() {
  if (sirenOscillator) {
    try {
      clearInterval(sirenOscillator._interval);
      sirenOscillator.stop();
      sirenOscillator.disconnect();
    } catch (e) {}
    sirenOscillator = null;
  }
}

function triggerEmergencyTakeover(active) {
  const overlay = document.getElementById("nunuEmergencyTakeoverOverlay");
  if (!overlay) return;

  if (active) {
    isEmergencyActive = true;
    overlay.style.display = "flex";
    startSirenSound();
    document.title = "🚨 관리자로 인해 종료되었습니다 - 비상정지";
  } else {
    if (isEmergencyActive) {
      isEmergencyActive = false;
      overlay.style.display = "none";
      stopSirenSound();
      applyBrandingMode();
      showToastNotice("관리자에 의해 비상정지가 해제되었습니다.");
    }
  }
}

function initEmergencyTakeoverListener() {
  const soundBtn = document.getElementById("btnToggleEmergencyAudio");
  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      isSirenSoundMuted = !isSirenSoundMuted;
      if (isSirenSoundMuted) {
        stopSirenSound();
        soundBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> <span>사이렌 경보음 켜기</span>';
      } else {
        startSirenSound();
        soundBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> <span>사이렌 경보음 끄기</span>';
      }
    });
  }

  // 1. BroadcastChannel (0초 실시간 창/탭 간 동기화)
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel("nunu_emergency_channel");
      channel.onmessage = (e) => {
        if (e.data && e.data.type === "EMERGENCY_STOP") {
          triggerEmergencyTakeover(Boolean(e.data.active));
        }
      };
    } catch (e) {}
  }

  // 2. Storage Event (창간 동기화)
  window.addEventListener("storage", (e) => {
    if (e.key === "nunu_emergency_stop") {
      triggerEmergencyTakeover(e.newValue === "true");
    }
  });

  // 3. 서버 실시간 상태 폴링
  async function pollEmergency() {
    try {
      const res = await fetch("/api/emergency-status?t=" + Date.now());
      if (res.ok) {
        const data = await res.json();
        triggerEmergencyTakeover(Boolean(data.emergencyStopped));
        return;
      }
    } catch (e) {}
    // LocalStorage fallback
    if (localStorage.getItem("nunu_emergency_stop") === "true") {
      triggerEmergencyTakeover(true);
    }
  }

  pollEmergency();
  setInterval(pollEmergency, 2000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEmergencyTakeoverListener);
} else {
  initEmergencyTakeoverListener();
}
