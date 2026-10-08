/* ==========================================================================
   웨이브봇 (WaveBot) - 북웨이브 안내 챗봇 + Gmail 문의 버튼
   ========================================================================== */
(function () {
  'use strict';

  const CONTACT_EMAIL = 'yeonu8683@gmail.com';

  // --- Knowledge base: keywords -> answer ---
  const KB = [
    {
      keys: ['공유', '코드', 'bw-', '링크', 'qr', '친구', '보내'],
      answer:
        '🔗 <b>공유 도서</b>는 내가 보고 있는 책을 다른 사람에게 보내는 기능이에요.<br><br>' +
        '1️⃣ 책 카드의 <b>🔗</b> 버튼(또는 책 화면 위쪽 <b>🔗 공유</b>)을 누르면<br>' +
        '2️⃣ <b>BW-1234</b> 같은 6자리 코드, 링크, QR코드가 만들어져요.<br>' +
        '3️⃣ 받은 사람은 맨 위 <b>🔗 공유 도서 열기</b>를 눌러 코드를 입력하면 같은 책이 바로 열려요.<br><br>' +
        '📌 읽던 쪽 / 듣던 시간까지 함께 전달돼요. 받는 사람의 회원 등급 규칙(무료·PRO·프리미엄)은 그대로 적용돼요.'
    },
    {
      keys: ['등급', '회원', '멤버십', '무료', 'pro', '프로', '프리미엄', '요금', '차이'],
      answer:
        '👑 <b>북웨이브 회원 등급</b><br><br>' +
        '• <b>무료</b>: 도서 목록만 둘러볼 수 있어요 (전자책·오디오북 감상 불가)<br>' +
        '• <b>⚡ PRO</b>: 짧은 광고를 본 뒤 전자책·오디오북을 모두 감상해요<br>' +
        '• <b>👑 프리미엄</b>: 광고 없이 감상 + 최대 <b>5권 다운로드</b> (와이파이 없이도 이용)<br><br>' +
        '등급 변경을 원하시면 옆의 <b>＋</b> 버튼으로 문의해 주세요.'
    },
    {
      keys: ['다운', '오프라인', '저장', '5권', '보관함'],
      answer:
        '📥 <b>다운로드</b>는 <b>프리미엄 회원만</b> 이용할 수 있어요.<br><br>' +
        '• 전자책 + 오디오북 합쳐서 <b>최대 5권</b><br>' +
        '• 다운로드한 책은 와이파이가 없어도 읽고 들을 수 있어요<br>' +
        '• 5권이 다 차면 보관함에서 🗑️ 삭제 후 새로 받으면 돼요'
    },
    {
      keys: ['와이파이', 'wifi', '인터넷', '네트워크', 'lte'],
      answer:
        '📶 와이파이(인터넷)가 없으면 <b>다운로드한 책만</b> 볼 수 있어요.<br>' +
        '다운로드는 프리미엄 회원 전용이라, 무료·PRO 회원은 인터넷 연결이 꼭 필요해요.'
    },
    {
      keys: ['광고'],
      answer:
        '📢 <b>PRO 회원</b>은 책을 열 때 짧은 광고(몇 초)를 본 뒤 감상할 수 있어요.<br>' +
        '<b>프리미엄 회원</b>은 광고가 전혀 나오지 않아요.'
    },
    {
      keys: ['전자책', '읽기', '책 펼', '페이지', '쪽', '넘기', 'word', '워드', 'docx'],
      answer:
        '📖 <b>전자책</b>은 실제 종이책처럼 <b>양면</b>으로 펼쳐져요.<br><br>' +
        '• 넘기기: ◀ ▶ 버튼, 키보드 방향키, 또는 왼쪽/오른쪽 페이지 클릭<br>' +
        '• 글자 크기: 위쪽 <b>A- / A+</b><br>' +
        '• 배경: 📖 종이 / 🌙 야간 / ☀️ 흰색<br>' +
        '• 읽던 쪽은 자동 저장되어 다음에 이어서 읽을 수 있어요'
    },
    {
      keys: ['오디오', '듣기', '음성', '재생', '성우', '소리'],
      answer:
        '🎧 <b>오디오북</b>은 아래쪽 플레이어로 재생돼요.<br><br>' +
        '• -10초 / +10초 이동, 재생 속도 조절, 볼륨 조절 가능<br>' +
        '• 듣던 시간은 자동 저장되어 다음에 이어서 들을 수 있어요'
    },
    {
      keys: ['이어', '저장', '진도', '기록'],
      answer:
        '⏱️ 읽던 쪽과 듣던 시간은 <b>서버에 자동 저장</b>돼요.<br>' +
        '다른 기기에서 같은 아이디로 로그인해도 이어서 볼 수 있어요.'
    },
    {
      keys: ['로그인', '로그아웃', '아이디', '비밀번호', '계정'],
      answer:
        '🔐 북웨이브는 로그인 후 이용할 수 있어요.<br>' +
        '오른쪽 위 프로필 옆 <b>로그아웃</b> 버튼으로 로그아웃할 수 있고, 계정 문제는 <b>＋</b> 버튼으로 문의해 주세요.'
    },
    {
      keys: ['문의', '연락', '메일', '이메일', '고객', '도움', '신고', '오류', '버그'],
      answer:
        '✉️ 문의는 옆에 있는 <b>＋</b> 버튼을 누르면 Gmail이 열리고,<br>' +
        '받는 사람이 <b>' + CONTACT_EMAIL + '</b>로 자동 입력돼요.'
    },
    {
      keys: ['북웨이브', 'bookwave', '뭐야', '소개', '무엇', '어떤'],
      answer:
        '🌊 <b>북웨이브(bookwave)</b>는 <b>오디오북</b>과 <b>양면 전자책</b>을 함께 즐기는 독서 플랫폼이에요.<br><br>' +
        '• 🎧 전문 성우 완독 오디오북<br>' +
        '• 📖 종이책처럼 펼쳐지는 양면 전자책<br>' +
        '• 🔗 다른 사람에게 책 공유<br>' +
        '• 📥 프리미엄 오프라인 다운로드 (최대 5권)'
    },
    {
      keys: ['안녕', '하이', 'hello', 'hi', '반가'],
      answer: '안녕하세요! 🌊 저는 북웨이브 안내 도우미 <b>웨이브봇</b>이에요. 무엇이 궁금하세요?'
    }
  ];

  const QUICK = ['북웨이브란?', '회원 등급', '공유 도서', '다운로드', '전자책 읽기', '문의하기'];

  const FALLBACK =
    '음… 그 질문은 아직 잘 모르겠어요 😅<br>아래 버튼에서 골라보시거나, <b>＋</b> 버튼으로 직접 문의해 주세요!';

  function findAnswer(text) {
    const q = (text || '').toLowerCase().replace(/\s+/g, ' ');
    let best = null;
    let bestScore = 0;
    KB.forEach(entry => {
      let score = 0;
      entry.keys.forEach(k => { if (q.includes(k)) score += k.length; });
      if (score > bestScore) { bestScore = score; best = entry; }
    });
    return best ? best.answer : FALLBACK;
  }

  function escapeText(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function openGmail() {
    const url = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(CONTACT_EMAIL) +
      '&su=' + encodeURIComponent('[북웨이브 문의]');
    const win = window.open(url, '_blank', 'noopener');
    if (!win) {
      // Popup blocked -> fall back to mailto
      window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent('[북웨이브 문의]');
    }
  }

  function build() {
    if (document.getElementById('waveBotDock')) return;

    const dock = document.createElement('div');
    dock.id = 'waveBotDock';
    dock.className = 'wavebot-dock';
    dock.innerHTML = `
      <div class="wavebot-panel" id="waveBotPanel" aria-hidden="true">
        <div class="wavebot-header">
          <div class="wavebot-header-left">
            <span class="wavebot-avatar">🌊</span>
            <div>
              <div class="wavebot-title">웨이브봇</div>
              <div class="wavebot-sub">북웨이브 안내 도우미</div>
            </div>
          </div>
          <button type="button" class="wavebot-close" id="waveBotClose" title="닫기">✕</button>
        </div>
        <div class="wavebot-messages" id="waveBotMessages"></div>
        <div class="wavebot-quick" id="waveBotQuick"></div>
        <form class="wavebot-input-row" id="waveBotForm" autocomplete="off">
          <input type="text" id="waveBotInput" class="wavebot-input" placeholder="궁금한 것을 물어보세요 (예: 공유 도서)" maxlength="200">
          <button type="submit" class="wavebot-send" title="보내기">➤</button>
        </form>
      </div>
      <div class="wavebot-buttons">
        <button type="button" class="wavebot-fab wavebot-fab-mail" id="waveBotMail" title="Gmail로 문의하기 (${CONTACT_EMAIL})">＋</button>
        <button type="button" class="wavebot-fab wavebot-fab-main" id="waveBotToggle" title="웨이브봇 열기">
          <span class="wavebot-fab-icon">🌊</span>
          <span class="wavebot-fab-label">웨이브봇</span>
        </button>
      </div>
    `;
    document.body.appendChild(dock);

    const panel = dock.querySelector('#waveBotPanel');
    const msgs = dock.querySelector('#waveBotMessages');
    const quick = dock.querySelector('#waveBotQuick');
    const form = dock.querySelector('#waveBotForm');
    const input = dock.querySelector('#waveBotInput');
    let greeted = false;

    function addMsg(html, who) {
      const row = document.createElement('div');
      row.className = 'wavebot-msg ' + (who === 'user' ? 'from-user' : 'from-bot');
      row.innerHTML = html;
      msgs.appendChild(row);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function ask(text) {
      if (!text || !text.trim()) return;
      addMsg(escapeText(text.trim()), 'user');
      const answer = /문의하기/.test(text) ? findAnswer('문의') : findAnswer(text);
      setTimeout(() => addMsg(answer, 'bot'), 250);
    }

    QUICK.forEach(label => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'wavebot-chip';
      chip.textContent = label;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        ask(label);
      });
      quick.appendChild(chip);
    });

    function openPanel() {
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
      if (!greeted) {
        greeted = true;
        addMsg('안녕하세요! 🌊 저는 <b>웨이브봇</b>이에요.<br>북웨이브에 대해 궁금한 걸 물어보세요!', 'bot');
      }
      setTimeout(() => input.focus(), 150);
    }
    function closePanel() {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    }

    dock.querySelector('#waveBotToggle').addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.contains('open') ? closePanel() : openPanel();
    });
    dock.querySelector('#waveBotClose').addEventListener('click', (e) => {
      e.stopPropagation();
      closePanel();
    });
    dock.querySelector('#waveBotMail').addEventListener('click', (e) => {
      e.stopPropagation();
      openGmail();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ask(input.value);
      input.value = '';
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('open')) closePanel();
    });

    // Lift the dock above the audio player bar when it is visible
    const playerBar = document.getElementById('audioPlayerBar');
    const syncPlayer = () => {
      document.body.classList.toggle('player-open', !!(playerBar && playerBar.classList.contains('active')));
    };
    if (playerBar) {
      new MutationObserver(syncPlayer).observe(playerBar, { attributes: true, attributeFilter: ['class'] });
      syncPlayer();
    }
  }

  window.WaveBot = { answer: findAnswer, openGmail: openGmail, email: CONTACT_EMAIL };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
