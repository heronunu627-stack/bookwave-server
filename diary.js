/**
 * nunu AI 스캐너 (Camera Scan Coach & Test Grader)
 * - 카메라 장치 선택 및 실시간 뷰파인더 스캔 (손글씨 OCR 판독)
 * - [검사] 모드: 일기·독서록 맞춤법/띄어쓰기 교정 & 다정한 AI 피드백
 * - [시험] 모드: 시험지·답안지 스캔 및 문항별 AI 자동 채점
 * - Web Speech API (TTS) & 로컬 보관함
 */

(function() {
  'use strict';

  // 상태 관리 객체
  const state = {
    mainMode: 'inspect', // 'inspect' (검사) | 'test' (시험)
    subMode: 'diary',    // 'diary' | 'book' (검사 모드 하위)
    weather: '맑음',
    mood: '행복·뿌듯',
    style: 'mentor',     // 'mentor' | 'coach' | 'editor'
    currentStream: null,
    currentDeviceId: '',
    facingMode: 'environment', // 모바일 기본 후면 카메라
    capturedImage: null, // Base64 data URL
    currentResult: null,
    history: []
  };

  // DOM 요소 캐싱
  const els = {
    // 테마
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    headerAppBadge: document.getElementById('headerAppBadge'),
    // 메인 모드 스위처
    btnMainModeInspect: document.getElementById('btnMainModeInspect'),
    btnMainModeTest: document.getElementById('btnMainModeTest'),
    testModeNoticeBanner: document.getElementById('testModeNoticeBanner'),
    // 카메라 스캐너 요소
    cameraDeviceSelect: document.getElementById('cameraDeviceSelect'),
    btnRefreshCameras: document.getElementById('btnRefreshCameras'),
    btnToggleCameraPower: document.getElementById('btnToggleCameraPower'),
    cameraPowerText: document.getElementById('cameraPowerText'),
    btnSwitchCamera: document.getElementById('btnSwitchCamera'),
    fileUploadInput: document.getElementById('fileUploadInput'),
    cameraVideo: document.getElementById('cameraVideo'),
    cameraPlaceholder: document.getElementById('cameraPlaceholder'),
    btnStartCameraPlaceholder: document.getElementById('btnStartCameraPlaceholder'),
    scannerOverlay: document.getElementById('scannerOverlay'),
    scanGuideText: document.getElementById('scanGuideText'),
    captureCanvas: document.getElementById('captureCanvas'),
    capturedPreviewOverlay: document.getElementById('capturedPreviewOverlay'),
    capturedImagePreview: document.getElementById('capturedImagePreview'),
    scannerStatusHint: document.getElementById('scannerStatusHint'),
    scannerStatusText: document.getElementById('scannerStatusText'),
    btnCapturePhoto: document.getElementById('btnCapturePhoto'),
    btnCaptureLabel: document.getElementById('btnCaptureLabel'),
    btnRetakePhoto: document.getElementById('btnRetakePhoto'),
    // 옵션 서브패널
    inspectOptionsPanel: document.getElementById('inspectOptionsPanel'),
    testOptionsPanel: document.getElementById('testOptionsPanel'),
    subModeDiaryBtn: document.getElementById('subModeDiaryBtn'),
    subModeBookBtn: document.getElementById('subModeBookBtn'),
    metaDiaryRow: document.getElementById('metaDiaryRow'),
    metaBookRow: document.getElementById('metaBookRow'),
    diaryDate: document.getElementById('diaryDate'),
    bookDate: document.getElementById('bookDate'),
    weatherSelector: document.getElementById('weatherSelector'),
    moodSelector: document.getElementById('moodSelector'),
    bookTitleInput: document.getElementById('bookTitleInput'),
    bookAuthorInput: document.getElementById('bookAuthorInput'),
    testSubjectInput: document.getElementById('testSubjectInput'),
    talosExamSelect: document.getElementById('talosExamSelect'),
    talosAuthCodeInput: document.getElementById('talosAuthCodeInput'),
    styleChips: document.getElementById('styleChips'),
    // 수동 텍스트 토글
    btnToggleManualText: document.getElementById('btnToggleManualText'),
    chevronManualIcon: document.getElementById('chevronManualIcon'),
    manualTextBody: document.getElementById('manualTextBody'),
    postTitleInput: document.getElementById('postTitleInput'),
    postContentInput: document.getElementById('postContentInput'),
    charCount: document.getElementById('charCount'),
    charNoSpaceCount: document.getElementById('charNoSpaceCount'),
    wordCount: document.getElementById('wordCount'),
    btnFillDiaryExample: document.getElementById('btnFillDiaryExample'),
    btnFillBookExample: document.getElementById('btnFillBookExample'),
    btnResetForm: document.getElementById('btnResetForm'),
    // 제출 버튼
    btnSubmitAnalyze: document.getElementById('btnSubmitAnalyze'),
    btnAnalyzeText: document.getElementById('btnAnalyzeText'),
    analyzeSpinner: document.getElementById('analyzeSpinner'),
    // 결과 영역
    resultSection: document.getElementById('resultSection'),
    resultInspectWrap: document.getElementById('resultInspectWrap'),
    resultTestWrap: document.getElementById('resultTestWrap'),
    // 탈로스 인증 및 거절 요소
    talosRejectedCard: document.getElementById('talosRejectedCard'),
    talosRejectedTitle: document.getElementById('talosRejectedTitle'),
    talosRejectedReason: document.getElementById('talosRejectedReason'),
    talosRejectedExplanation: document.getElementById('talosRejectedExplanation'),
    btnRetryScanAfterReject: document.getElementById('btnRetryScanAfterReject'),
    talosGradingSuccessWrap: document.getElementById('talosGradingSuccessWrap'),
    talosVerifiedBadge: document.getElementById('talosVerifiedBadge'),
    talosExamCode: document.getElementById('talosExamCode'),
    talosExamTitle: document.getElementById('talosExamTitle'),
    testMaxScore: document.getElementById('testMaxScore'),
    // 검사 결과
    resultTypeBadge: document.getElementById('resultTypeBadge'),
    resultPostTitle: document.getElementById('resultPostTitle'),
    resultMetaTags: document.getElementById('resultMetaTags'),
    resultSummaryTitle: document.getElementById('resultSummaryTitle'),
    resultSummaryDesc: document.getElementById('resultSummaryDesc'),
    summaryCountBadge: document.getElementById('summaryCountBadge'),
    tabSpellBtn: document.getElementById('tabSpellBtn'),
    tabFeedbackBtn: document.getElementById('tabFeedbackBtn'),
    tabOcrBtn: document.getElementById('tabOcrBtn'),
    tabSpellBadge: document.getElementById('tabSpellBadge'),
    panelSpell: document.getElementById('panelSpell'),
    panelFeedback: document.getElementById('panelFeedback'),
    panelOcr: document.getElementById('panelOcr'),
    correctedTextBody: document.getElementById('correctedTextBody'),
    correctionsContainer: document.getElementById('correctionsContainer'),
    correctionsTotalHint: document.getElementById('correctionsTotalHint'),
    fbPraiseContent: document.getElementById('fbPraiseContent'),
    fbQuestionsContent: document.getElementById('fbQuestionsContent'),
    fbTipsContent: document.getElementById('fbTipsContent'),
    ocrExtractedTextBody: document.getElementById('ocrExtractedTextBody'),
    btnCopyOcrText: document.getElementById('btnCopyOcrText'),
    btnCopyCorrected: document.getElementById('btnCopyCorrected'),
    btnApplyToEditor: document.getElementById('btnApplyToEditor'),
    // 시험 결과
    testScoreNumber: document.getElementById('testScoreNumber'),
    testTotalCount: document.getElementById('testTotalCount'),
    testCorrectCount: document.getElementById('testCorrectCount'),
    testWrongCount: document.getElementById('testWrongCount'),
    testGradingSummaryHint: document.getElementById('testGradingSummaryHint'),
    testQuestionsList: document.getElementById('testQuestionsList'),
    testFbSummary: document.getElementById('testFbSummary'),
    testFbTips: document.getElementById('testFbTips'),

    // 공통 액션
    btnTtsSpeak: document.getElementById('btnTtsSpeak'),
    btnTtsStop: document.getElementById('btnTtsStop'),
    ttsBtnText: document.getElementById('ttsBtnText'),
    btnSaveToHistory: document.getElementById('btnSaveToHistory'),
    btnPrintReport: document.getElementById('btnPrintReport'),
    btnCopyFullReport: document.getElementById('btnCopyFullReport'),
    // 보관함 모달
    btnOpenHistory: document.getElementById('btnOpenHistory'),
    historyCountBadge: document.getElementById('historyCountBadge'),
    historyModal: document.getElementById('historyModal'),
    btnCloseHistory: document.getElementById('btnCloseHistory'),
    btnModalCloseDone: document.getElementById('btnModalCloseDone'),
    btnClearHistory: document.getElementById('btnClearHistory'),
    historyListContainer: document.getElementById('historyListContainer'),
    modalCount: document.getElementById('modalCount'),
    toastContainer: document.getElementById('toastContainer')
  };

  // 초기화 실행
  init();

  function init() {
    loadTheme();
    initDates();
    bindEvents();
    loadHistoryFromStorage();
    loadTalosExams();
    updateCharCount();

    // 카메라 장치 탐색 및 자동 초기화 시도
    initCameras();
  }

  function initDates() {
    const today = new Date().toISOString().split('T')[0];
    if (els.diaryDate) els.diaryDate.value = today;
    if (els.bookDate) els.bookDate.value = today;
  }

  function loadTheme() {
    const saved = localStorage.getItem('nunu_theme') || 'theme-light';
    document.body.className = saved;
    updateThemeIcon(saved);
  }

  function toggleTheme() {
    const isDark = document.body.classList.contains('theme-dark');
    const newTheme = isDark ? 'theme-light' : 'theme-dark';
    document.body.className = newTheme;
    localStorage.setItem('nunu_theme', newTheme);
    updateThemeIcon(newTheme);
  }

  function updateThemeIcon(theme) {
    if (!els.themeToggleBtn) return;
    const icon = els.themeToggleBtn.querySelector('i');
    if (icon) {
      icon.className = theme === 'theme-dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }

  // ========================================================
  // 카메라 장치 탐색 및 스트림 관리
  // ========================================================
  async function initCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      updateScannerStatus('이 브라우저는 카메라 스트림을 지원하지 않습니다. 사진 업로드를 이용해주세요.', 'yellow');
      showCameraPlaceholder();
      return;
    }

    try {
      // 권한 요청 및 첫 카메라 활성화
      await startCamera(null, state.facingMode);
      await refreshCameraList();
    } catch (err) {
      console.warn('Camera auto-start failed:', err);
      updateScannerStatus('카메라 접근 권한이 필요합니다. [카메라 켜기]를 누르거나 권한을 허용해주세요.', 'yellow');
      showCameraPlaceholder();
      await refreshCameraList();
    }
  }

  // 연결된 카메라 장치 목록 조회 및 select에 채우기
  async function refreshCameraList() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');

      if (!els.cameraDeviceSelect) return;
      els.cameraDeviceSelect.innerHTML = '';

      if (videoDevices.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '인식된 카메라 없음';
        els.cameraDeviceSelect.appendChild(opt);
        return;
      }

      videoDevices.forEach((device, index) => {
        const opt = document.createElement('option');
        opt.value = device.deviceId;
        const label = device.label || `카메라 ${index + 1}`;
        opt.textContent = label;
        if (state.currentDeviceId && device.deviceId === state.currentDeviceId) {
          opt.selected = true;
        }
        els.cameraDeviceSelect.appendChild(opt);
      });

      // 만약 선택된 것이 없으면 첫 번째 선택
      if (!state.currentDeviceId && videoDevices[0]) {
        state.currentDeviceId = videoDevices[0].deviceId;
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  }

  // 지정 카메라 스트림 시작
  async function startCamera(deviceId, facingMode = null) {
    stopCameraStream();

    const constraints = {
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    if (deviceId) {
      constraints.video.deviceId = { exact: deviceId };
    } else if (facingMode) {
      constraints.video.facingMode = { ideal: facingMode };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      state.currentStream = stream;
      if (els.cameraVideo) {
        els.cameraVideo.srcObject = stream;
        els.cameraVideo.style.display = 'block';
        await els.cameraVideo.play();
      }

      // 실제 사용 중인 deviceId 파악
      const track = stream.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings();
        if (settings.deviceId) state.currentDeviceId = settings.deviceId;
      }

      hideCameraPlaceholder();
      updateScannerStatus('🟢 카메라 준비 완료 • 스캔할 공책이나 시험지를 비춘 후 촬영하세요.', 'green');
      updateCameraPowerBtn(true);
      if (els.cameraDeviceSelect && state.currentDeviceId) {
        els.cameraDeviceSelect.value = state.currentDeviceId;
      }
    } catch (err) {
      console.error('Camera start error:', err);
      showCameraPlaceholder();
      updateScannerStatus('카메라를 열 수 없습니다. 권한 허용 또는 다른 카메라를 선택해주세요.', 'yellow');
      updateCameraPowerBtn(false);
      throw err;
    }
  }

  function stopCameraStream() {
    if (state.currentStream) {
      state.currentStream.getTracks().forEach(track => track.stop());
      state.currentStream = null;
    }
    if (els.cameraVideo) {
      els.cameraVideo.srcObject = null;
    }
  }

  function toggleCameraPower() {
    if (state.currentStream) {
      stopCameraStream();
      showCameraPlaceholder();
      updateScannerStatus('카메라가 꺼졌습니다. [카메라 켜기]를 눌러 다시 시작하세요.', 'yellow');
      updateCameraPowerBtn(false);
    } else {
      startCamera(state.currentDeviceId || null, state.facingMode);
    }
  }

  function updateCameraPowerBtn(isOn) {
    if (!els.btnToggleCameraPower || !els.cameraPowerText) return;
    if (isOn) {
      els.btnToggleCameraPower.classList.add('active');
      els.cameraPowerText.textContent = '카메라 끄기';
    } else {
      els.btnToggleCameraPower.classList.remove('active');
      els.cameraPowerText.textContent = '카메라 켜기';
    }
  }

  function switchCameraFacing() {
    state.facingMode = (state.facingMode === 'user') ? 'environment' : 'user';
    startCamera(null, state.facingMode).then(() => {
      refreshCameraList();
      showToast(state.facingMode === 'environment' ? '📷 후면 카메라로 전환되었습니다.' : '🤳 전면 카메라로 전환되었습니다.');
    }).catch(err => {
      showToast('⚠️ 카메라 전환 실패: 지원하지 않는 환경입니다.');
    });
  }

  function showCameraPlaceholder() {
    if (els.cameraPlaceholder) els.cameraPlaceholder.style.display = 'flex';
    if (els.cameraVideo) els.cameraVideo.style.display = 'none';
  }

  function hideCameraPlaceholder() {
    if (els.cameraPlaceholder) els.cameraPlaceholder.style.display = 'none';
    if (els.cameraVideo) els.cameraVideo.style.display = 'block';
  }

  function updateScannerStatus(text, color = 'green') {
    if (els.scannerStatusText) els.scannerStatusText.textContent = text;
    if (els.scannerStatusHint) {
      const dot = els.scannerStatusHint.querySelector('.status-dot');
      if (dot) dot.className = `status-dot ${color}`;
    }
  }

  // ========================================================
  // 사진 캡처 & 파일 업로드 처리
  // ========================================================
  function capturePhoto() {
    if (!els.cameraVideo || !els.captureCanvas) return;

    // 만약 카메라 스트림이 켜져있지 않다면
    if (!state.currentStream || els.cameraVideo.videoWidth === 0) {
      alert('카메라 화면이 준비되지 않았습니다. 카메라를 켜거나 사진 파일을 올려주세요.');
      return;
    }

    const video = els.cameraVideo;
    const canvas = els.captureCanvas;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 고품질 JPEG Data URL 생성
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);

    showToast('📸 스캔 사진이 촬영되었습니다!');
  }

  function setCapturedImage(dataUrl) {
    state.capturedImage = dataUrl;

    if (els.capturedImagePreview) els.capturedImagePreview.src = dataUrl;
    if (els.capturedPreviewOverlay) els.capturedPreviewOverlay.style.display = 'flex';
    if (els.btnRetakePhoto) els.btnRetakePhoto.style.display = 'inline-flex';
    if (els.btnCaptureLabel) {
      els.btnCaptureLabel.textContent = state.mainMode === 'test' ? '✨ 촬영 완료 (시험 채점 준비)' : '✨ 촬영 완료 (검사 준비)';
    }

    updateScannerStatus('📸 사진 촬영 완료 • [스캔 분석 시작] 버튼을 누르세요.', 'green');
  }

  function retakePhoto() {
    state.capturedImage = null;
    if (els.capturedPreviewOverlay) els.capturedPreviewOverlay.style.display = 'none';
    if (els.btnRetakePhoto) els.btnRetakePhoto.style.display = 'none';
    if (els.btnCaptureLabel) {
      els.btnCaptureLabel.textContent = '📸 사진 촬영 및 스캔';
    }
    updateScannerStatus('🟢 실시간 뷰파인더 작동 중 • 사각형 프레임에 맞춰 촬영하세요.', 'green');
    showToast('🔄 다시 촬영 모드로 돌아왔습니다.');
  }

  // 사진 파일 업로드 핸들러
  function handleFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일(JPG, PNG 등)만 업로드할 수 있습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
      setCapturedImage(evt.target.result);
      showToast('📁 사진 파일이 등록되었습니다!');
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // 재선택 가능하도록 리셋
  }

  // ========================================================
  // 모드 전환 ([검사] 모드 vs [시험] 모드)
  // ========================================================
  function setMainMode(mode) {
    state.mainMode = mode;

    if (mode === 'inspect') {
      els.btnMainModeInspect.classList.add('active');
      els.btnMainModeTest.classList.remove('active');
      els.inspectOptionsPanel.style.display = 'block';
      els.testOptionsPanel.style.display = 'none';
      els.testModeNoticeBanner.style.display = 'none';
      if (els.headerAppBadge) els.headerAppBadge.textContent = 'AI 글방 & 스캐너';
      if (els.btnAnalyzeText) {
        els.btnAnalyzeText.textContent = 'AI 스캔 분석 & 맞춤법 검사';
      }
      if (els.scanGuideText) {
        els.scanGuideText.innerHTML = '<i class="fa-solid fa-expand"></i> <span>일기장이나 독서록을 프레임 안에 비춰주세요</span>';
      }
    } else {
      els.btnMainModeTest.classList.add('active');
      els.btnMainModeInspect.classList.remove('active');
      els.testOptionsPanel.style.display = 'block';
      els.inspectOptionsPanel.style.display = 'none';
      els.testModeNoticeBanner.style.display = 'flex';
      if (els.headerAppBadge) els.headerAppBadge.textContent = 'AI 시험 채점관';
      if (els.btnAnalyzeText) {
        els.btnAnalyzeText.textContent = 'AI 시험지 스캔 & 자동 채점';
      }
      if (els.scanGuideText) {
        els.scanGuideText.innerHTML = '<i class="fa-solid fa-expand"></i> <span>시험지나 답안지를 프레임 안에 비춰주세요</span>';
      }
    }

    // 결과 창 초기화
    if (els.resultSection) els.resultSection.style.display = 'none';
  }

  function setSubMode(sub) {
    state.subMode = sub;
    if (sub === 'diary') {
      els.subModeDiaryBtn.classList.add('active');
      els.subModeBookBtn.classList.remove('active');
      els.metaDiaryRow.style.display = 'flex';
      els.metaBookRow.style.display = 'none';
    } else {
      els.subModeBookBtn.classList.add('active');
      els.subModeDiaryBtn.classList.remove('active');
      els.metaBookRow.style.display = 'flex';
      els.metaDiaryRow.style.display = 'none';
    }
  }

  // ========================================================
  // 이벤트 바인딩
  // ========================================================
  function bindEvents() {
    if (els.themeToggleBtn) els.themeToggleBtn.addEventListener('click', toggleTheme);

    // 메인 모드 탭
    if (els.btnMainModeInspect) els.btnMainModeInspect.addEventListener('click', () => setMainMode('inspect'));
    if (els.btnMainModeTest) els.btnMainModeTest.addEventListener('click', () => setMainMode('test'));

    // 하위 모드 탭
    if (els.subModeDiaryBtn) els.subModeDiaryBtn.addEventListener('click', () => setSubMode('diary'));
    if (els.subModeBookBtn) els.subModeBookBtn.addEventListener('click', () => setSubMode('book'));

    // 카메라 컨트롤
    if (els.cameraDeviceSelect) {
      els.cameraDeviceSelect.addEventListener('change', (e) => {
        state.currentDeviceId = e.target.value;
        startCamera(state.currentDeviceId);
      });
    }
    if (els.btnRefreshCameras) els.btnRefreshCameras.addEventListener('click', refreshCameraList);
    if (els.btnToggleCameraPower) els.btnToggleCameraPower.addEventListener('click', toggleCameraPower);
    if (els.btnStartCameraPlaceholder) els.btnStartCameraPlaceholder.addEventListener('click', () => startCamera(state.currentDeviceId));
    if (els.btnSwitchCamera) els.btnSwitchCamera.addEventListener('click', switchCameraFacing);

    // 캡처 및 사진 관리
    if (els.btnCapturePhoto) els.btnCapturePhoto.addEventListener('click', capturePhoto);
    if (els.btnRetakePhoto) els.btnRetakePhoto.addEventListener('click', retakePhoto);
    if (els.fileUploadInput) els.fileUploadInput.addEventListener('change', handleFileUpload);

    // 날씨 / 기분 / 스타일
    if (els.weatherSelector) {
      els.weatherSelector.addEventListener('click', (e) => {
        const chip = e.target.closest('.weather-chip');
        if (!chip) return;
        els.weatherSelector.querySelectorAll('.weather-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.weather = chip.dataset.weather || '맑음';
      });
    }

    if (els.moodSelector) {
      els.moodSelector.addEventListener('click', (e) => {
        const chip = e.target.closest('.mood-chip');
        if (!chip) return;
        els.moodSelector.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.mood = chip.dataset.mood || '행복·뿌듯';
      });
    }

    if (els.styleChips) {
      els.styleChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.style-chip');
        if (!chip) return;
        els.styleChips.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.style = chip.dataset.style || 'mentor';
      });
    }

    // 수동 텍스트 토글 아코디언
    if (els.btnToggleManualText) {
      els.btnToggleManualText.addEventListener('click', () => {
        const isHidden = els.manualTextBody.style.display === 'none';
        els.manualTextBody.style.display = isHidden ? 'block' : 'none';
        if (els.chevronManualIcon) els.chevronManualIcon.classList.toggle('open', isHidden);
      });
    }

    if (els.postContentInput) {
      els.postContentInput.addEventListener('input', updateCharCount);
    }

    // 예시 불러오기
    if (els.btnFillDiaryExample) els.btnFillDiaryExample.addEventListener('click', fillDiaryExample);
    if (els.btnFillBookExample) els.btnFillBookExample.addEventListener('click', fillBookExample);
    if (els.btnResetForm) els.btnResetForm.addEventListener('click', resetForm);

    // 제출 분석
    if (els.btnSubmitAnalyze) els.btnSubmitAnalyze.addEventListener('click', submitAnalyze);

    // 결과 탭
    if (els.tabSpellBtn) els.tabSpellBtn.addEventListener('click', () => switchInspectTab('spell'));
    if (els.tabFeedbackBtn) els.tabFeedbackBtn.addEventListener('click', () => switchInspectTab('feedback'));
    if (els.tabOcrBtn) els.tabOcrBtn.addEventListener('click', () => switchInspectTab('ocr'));

    // 복사 및 적용
    if (els.btnCopyCorrected) els.btnCopyCorrected.addEventListener('click', copyCorrectedText);
    if (els.btnApplyToEditor) els.btnApplyToEditor.addEventListener('click', applyCorrectedToEditor);
    if (els.btnCopyOcrText) els.btnCopyOcrText.addEventListener('click', copyOcrText);

    // 액션 도구
    if (els.btnTtsSpeak) els.btnTtsSpeak.addEventListener('click', handleTtsSpeak);
    if (els.btnTtsStop) els.btnTtsStop.addEventListener('click', handleTtsStop);
    if (els.btnSaveToHistory) els.btnSaveToHistory.addEventListener('click', saveCurrentToHistory);
    if (els.btnPrintReport) els.btnPrintReport.addEventListener('click', () => window.print());
    if (els.btnCopyFullReport) els.btnCopyFullReport.addEventListener('click', copyFullReport);

    // 탈로스 거절 후 재촬영 버튼
    if (els.btnRetryScanAfterReject) {
      els.btnRetryScanAfterReject.addEventListener('click', () => {
        if (els.resultSection) els.resultSection.style.display = 'none';
        retakePhoto();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // 보관함 모달
    if (els.btnOpenHistory) els.btnOpenHistory.addEventListener('click', openHistoryModal);
    if (els.btnCloseHistory) els.btnCloseHistory.addEventListener('click', closeHistoryModal);
    if (els.btnModalCloseDone) els.btnModalCloseDone.addEventListener('click', closeHistoryModal);
    if (els.btnClearHistory) els.btnClearHistory.addEventListener('click', clearAllHistory);
    if (els.historyModal) {
      els.historyModal.addEventListener('click', (e) => {
        if (e.target === els.historyModal) closeHistoryModal();
      });
    }
  }

  // 탈로스 활성 시험지 목록 불러오기
  async function loadTalosExams() {
    if (!els.talosExamSelect) return;
    try {
      const res = await fetch('/api/talos-tests');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.tests)) {
        let optionsHtml = '<option value="">🔍 자동 감지 (카메라 스캔 시 시험지 코드 자동 인식)</option>';
        data.tests.forEach(t => {
          optionsHtml += `<option value="${escapeHtml(t.testCode)}">[${escapeHtml(t.testCode)}] ${escapeHtml(t.title)} (${escapeHtml(t.subject || '공통')} • ${t.questionCount || 0}문항)</option>`;
        });
        els.talosExamSelect.innerHTML = optionsHtml;
      }
    } catch (err) {
      console.warn('Failed to load Talos tests:', err);
    }
  }


  // 글자 수 업데이트
  function updateCharCount() {
    const text = els.postContentInput ? els.postContentInput.value : '';
    const totalChars = text.length;
    const noSpaceChars = text.replace(/\s/g, '').length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;

    if (els.charCount) els.charCount.textContent = `공백 포함 ${totalChars.toLocaleString()}자`;
    if (els.charNoSpaceCount) els.charNoSpaceCount.textContent = `공백 제외 ${noSpaceChars.toLocaleString()}자`;
    if (els.wordCount) els.wordCount.textContent = `${words.toLocaleString()}단어`;
  }

  function fillDiaryExample() {
    setMainMode('inspect');
    setSubMode('diary');
    els.postTitleInput.value = '친구와 떡볶이 먹은 즐거운 날';
    els.postContentInput.value = '어제 친구랑 떡복이를 먹어로 갓다. 정말 맛잇엇고 다음에도 또 갈꺼다. 바람이 많이 불어서 추웟지만 잼있었다.';
    if (els.manualTextBody) els.manualTextBody.style.display = 'block';
    if (els.chevronManualIcon) els.chevronManualIcon.classList.add('open');
    updateCharCount();
    showToast('📝 일기 예시가 입력되었습니다.');
  }

  function fillBookExample() {
    setMainMode('inspect');
    setSubMode('book');
    if (els.bookTitleInput) els.bookTitleInput.value = '어린 왕자';
    if (els.bookAuthorInput) els.bookAuthorInput.value = '생텍쥐페리';
    els.postTitleInput.value = '눈에 보이지 않는 소중한 것';
    els.postContentInput.value = '어린왕자를 일것다. 장미꽃을 두고 별을 떠난 어린왕자가 슬퍼보엿다. 여우가 한 말이 제일 기억에 남는다. "가장 중요한 건 눈에 보이지 안아." 나도 내 친구들을 더 소중이 대해야 겟다.';
    if (els.manualTextBody) els.manualTextBody.style.display = 'block';
    if (els.chevronManualIcon) els.chevronManualIcon.classList.add('open');
    updateCharCount();
    showToast('📖 독서록 예시가 입력되었습니다.');
  }

  function resetForm() {
    if (!confirm('작성 중인 내용을 모두 지우시겠습니까?')) return;
    if (els.postTitleInput) els.postTitleInput.value = '';
    if (els.postContentInput) els.postContentInput.value = '';
    updateCharCount();
    showToast('🧹 내용이 지워졌습니다.');
  }

  // ========================================================
  // AI 분석 & 채점 요청 (/api/diary/analyze)
  // ========================================================
  async function submitAnalyze() {
    const content = (els.postContentInput ? els.postContentInput.value : '').trim();
    const hasImage = !!state.capturedImage;

    if (!content && !hasImage) {
      alert('카메라로 공책/시험지 사진을 촬영하거나, 키보드로 내용을 입력해주세요!');
      return;
    }

    const title = (els.postTitleInput ? els.postTitleInput.value : '').trim() || (state.mainMode === 'test' ? '탈로스 시험 채점' : '글쓰기 검사');
    const selectedTestCode = (els.talosExamSelect ? els.talosExamSelect.value : '').trim();
    const enteredAuthCode = (els.talosAuthCodeInput ? els.talosAuthCodeInput.value : '').trim();

    if (state.mainMode === 'test' && !enteredAuthCode) {
      alert('🔒 탈로스 시험지 채점을 진행하려면 해당 시험지의 [인증코드]를 입력해야 합니다.\n(nunu 관리자 콘솔에서 설정한 시험지 인증코드를 입력해주세요.)');
      if (els.talosAuthCodeInput) {
        els.talosAuthCodeInput.focus();
        els.talosAuthCodeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const testSubject = (els.testSubjectInput ? els.testSubjectInput.value : '').trim();
    const bookTitle = (els.bookTitleInput ? els.bookTitleInput.value : '').trim();
    const bookAuthor = (els.bookAuthorInput ? els.bookAuthorInput.value : '').trim();
    const dateVal = state.subMode === 'diary' ? (els.diaryDate.value || '') : (els.bookDate.value || '');

    setLoading(true);

    const payload = {
      mode: state.mainMode,
      type: state.mainMode === 'test' ? 'test' : state.subMode,
      title: title,
      content: content,
      date: dateVal,
      weather: state.weather,
      mood: state.mood,
      bookTitle: bookTitle,
      bookAuthor: bookAuthor,
      subject: testSubject,
      testCode: selectedTestCode,
      authCode: enteredAuthCode,
      style: state.style,
      image: state.capturedImage || ''
    };

    try {
      const res = await fetch('/api/diary/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`서버 응답 오류 (HTTP ${res.status})`);
      }

      const resJson = await res.json();
      if (!resJson.success || !resJson.data) {
        throw new Error(resJson.message || 'AI 분석에 실패했습니다.');
      }

      state.currentResult = {
        meta: {
          mainMode: state.mainMode,
          subMode: state.subMode,
          title: title,
          subject: testSubject,
          date: dateVal,
          weather: state.weather,
          mood: state.mood,
          bookTitle: bookTitle,
          bookAuthor: bookAuthor,
          hasImage: hasImage,
          timestamp: new Date().toISOString()
        },
        data: resJson.data
      };

      renderResult(state.currentResult);
      showToast(state.mainMode === 'test' ? '💯 시험 채점이 완료되었습니다!' : '✨ 맞춤법 검사 및 코칭이 완료되었습니다!');

      // 결과 영역으로 부드럽게 스크롤
      setTimeout(() => {
        if (els.resultSection) {
          els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

    } catch (err) {
      console.error('Analyze error:', err);
      alert('오류가 발생했습니다: ' + (err.message || '네트워크를 확인해주세요.'));
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    if (!els.btnSubmitAnalyze) return;
    els.btnSubmitAnalyze.disabled = isLoading;
    if (els.analyzeSpinner) els.analyzeSpinner.style.display = isLoading ? 'inline-block' : 'none';
    if (els.btnAnalyzeText) {
      if (isLoading) {
        els.btnAnalyzeText.textContent = state.mainMode === 'test'
          ? 'AI가 시험지를 판독하고 채점하는 중...'
          : 'AI가 손글씨를 판독하고 맞춤법을 검사하는 중...';
      } else {
        els.btnAnalyzeText.textContent = state.mainMode === 'test'
          ? 'AI 시험지 스캔 & 자동 채점'
          : 'AI 스캔 분석 & 맞춤법 검사';
      }
    }
  }

  // ========================================================
  // 결과 화면 렌더링 (검사 vs 시험 분기)
  // ========================================================
  function renderResult(resultObj) {
    const meta = resultObj.meta;
    const data = resultObj.data;

    if (!els.resultSection) return;
    els.resultSection.style.display = 'block';

    if (meta.mainMode === 'test') {
      // [시험 모드 렌더링]
      els.resultInspectWrap.style.display = 'none';
      els.resultTestWrap.style.display = 'block';

      renderTestResult(meta, data);
    } else {
      // [검사 모드 렌더링]
      els.resultInspectWrap.style.display = 'block';
      els.resultTestWrap.style.display = 'none';

      renderInspectResult(meta, data);
    }
  }

  // [검사 모드] 렌더링
  function renderInspectResult(meta, data) {
    if (els.resultTypeBadge) {
      els.resultTypeBadge.innerHTML = meta.subMode === 'book'
        ? '<i class="fa-solid fa-book-bookmark"></i> 독서록 검사'
        : '<i class="fa-solid fa-book-open"></i> 일기 검사';
    }
    if (els.resultPostTitle) els.resultPostTitle.textContent = meta.title;

    if (els.resultMetaTags) {
      let tagsHtml = '';
      if (meta.date) tagsHtml += `<span class="result-meta-pill"><i class="fa-regular fa-calendar"></i> ${meta.date}</span>`;
      if (meta.subMode === 'diary') {
        if (meta.weather) tagsHtml += `<span class="result-meta-pill"><i class="fa-solid fa-cloud-sun"></i> ${meta.weather}</span>`;
        if (meta.mood) tagsHtml += `<span class="result-meta-pill"><i class="fa-solid fa-face-smile"></i> ${meta.mood}</span>`;
      } else {
        if (meta.bookTitle) tagsHtml += `<span class="result-meta-pill"><i class="fa-solid fa-book"></i> 책: ${escapeHtml(meta.bookTitle)}</span>`;
        if (meta.bookAuthor) tagsHtml += `<span class="result-meta-pill"><i class="fa-solid fa-user-pen"></i> ${escapeHtml(meta.bookAuthor)}</span>`;
      }
      if (meta.hasImage) tagsHtml += `<span class="result-meta-pill"><i class="fa-solid fa-camera"></i> 사진 스캔</span>`;
      els.resultMetaTags.innerHTML = tagsHtml;
    }

    const count = data.correctionCount || (data.corrections ? data.corrections.length : 0);
    if (els.summaryCountBadge) els.summaryCountBadge.innerHTML = `교정 <strong>${count}</strong>곳`;
    if (els.tabSpellBadge) els.tabSpellBadge.textContent = count;

    if (els.resultSummaryTitle) {
      els.resultSummaryTitle.textContent = (data.feedback && data.feedback.summary)
        ? data.feedback.summary
        : (count === 0 ? '완벽한 맞춤법이에요! ✨' : `총 ${count}곳의 맞춤법을 다듬었어요.`);
    }

    // 교정본 & 원문
    if (els.correctedTextBody) {
      els.correctedTextBody.textContent = data.correctedText || data.extractedText || '';
    }
    if (els.ocrExtractedTextBody) {
      els.ocrExtractedTextBody.textContent = data.extractedText || '(원문 없음)';
    }

    // 교정 상세 리스트
    if (els.correctionsContainer) {
      const list = data.corrections || [];
      if (list.length === 0) {
        els.correctionsContainer.innerHTML = `
          <div class="no-errors-card">
            <i class="fa-regular fa-circle-check"></i>
            <h5>맞춤법과 띄어쓰기가 완벽합니다!</h5>
            <p>틀린 부분이 하나도 없어요. 멋진 글입니다! 🎉</p>
          </div>
        `;
      } else {
        let html = '';
        list.forEach(item => {
          html += `
            <div class="correction-item">
              <div class="correction-item-header">
                <span class="orig-word">${escapeHtml(item.original)}</span>
                <span class="arrow-icon"><i class="fa-solid fa-arrow-right"></i></span>
                <span class="corr-word">${escapeHtml(item.corrected)}</span>
              </div>
              <div class="correction-reason">
                <i class="fa-solid fa-lightbulb"></i>
                <span>${escapeHtml(item.reason)}</span>
              </div>
            </div>
          `;
        });
        els.correctionsContainer.innerHTML = html;
      }
    }

    if (els.correctionsTotalHint) els.correctionsTotalHint.textContent = `총 ${count}건 개선`;

    // 피드백
    const fb = data.feedback || {};
    if (els.fbPraiseContent) els.fbPraiseContent.textContent = fb.praise || '-';
    if (els.fbQuestionsContent) {
      const qList = Array.isArray(fb.questions) ? fb.questions : (fb.questions ? [fb.questions] : []);
      els.fbQuestionsContent.innerHTML = qList.map(q => `
        <div class="question-item"><i class="fa-regular fa-comment-dots text-primary"></i> ${escapeHtml(q)}</div>
      `).join('') || '<p class="text-muted">다음에 더 깊은 이야기를 기대할게요!</p>';
    }
    if (els.fbTipsContent) els.fbTipsContent.textContent = fb.tips || '-';

    switchInspectTab('spell');
  }

  // [시험 모드] 렌더링
  function renderTestResult(meta, data) {
    // 1. 탈로스 미인증/거절 시험지인 경우
    if (data.isTalosVerified === false || data.rejected === true) {
      if (els.talosRejectedCard) els.talosRejectedCard.style.display = 'flex';
      if (els.talosGradingSuccessWrap) els.talosGradingSuccessWrap.style.display = 'none';

      if (els.talosRejectedTitle) els.talosRejectedTitle.textContent = data.reason || '탈로스(내 회사) 공식 시험지가 아닙니다.';
      if (els.talosRejectedReason) {
        els.talosRejectedReason.textContent = '스캔하신 시험지는 탈로스에서 공식 발행한 시험지가 아니거나, nunu 관리자에 등록되지 않은 시험지입니다. 탈로스 공식 시험지만 자동 채점이 지원됩니다.';
      }
      if (els.talosRejectedExplanation) {
        els.talosRejectedExplanation.innerHTML = `
          <strong><i class="fa-solid fa-circle-exclamation"></i> AI 판독 사유:</strong><br>
          ${escapeHtml(data.explanation || data.reason || '탈로스 공식 시험지 고유 코드(TALOS-...) 및 지정 문항을 확인할 수 없습니다.')}
        `;
      }
      return;
    }

    // 2. 탈로스 공식 인증 시험지 채점 성공
    if (els.talosRejectedCard) els.talosRejectedCard.style.display = 'none';
    if (els.talosGradingSuccessWrap) els.talosGradingSuccessWrap.style.display = 'block';

    if (els.talosExamCode) els.talosExamCode.textContent = data.testCode || 'TALOS-OFFICIAL';
    if (els.talosExamTitle) els.talosExamTitle.textContent = data.testTitle || '탈로스 공식 시험지';
    if (els.testScoreNumber) els.testScoreNumber.textContent = data.score !== undefined ? data.score : 0;
    if (els.testMaxScore) els.testMaxScore.textContent = `/ ${data.totalPoints || 100}점`;
    if (els.testTotalCount) els.testTotalCount.textContent = data.totalQuestions || (data.grading ? data.grading.length : 0);
    if (els.testCorrectCount) els.testCorrectCount.textContent = data.correctCount || 0;
    if (els.testWrongCount) els.testWrongCount.textContent = data.wrongCount || 0;

    // 문항별 채점 목록
    if (els.testQuestionsList) {
      const gradings = data.grading || [];
      if (gradings.length === 0) {
        els.testQuestionsList.innerHTML = `
          <div class="no-errors-card">
            <p>문항 정보가 판독되지 않았습니다. 사진이 선명한지 확인해주세요.</p>
          </div>
        `;
      } else {
        let html = '';
        gradings.forEach(g => {
          const isCorrect = !!g.isCorrect;
          html += `
            <div class="test-q-item">
              <div class="test-q-header">
                <div class="q-badge-wrap">
                  <span class="q-num-pill">${g.questionNumber || '문제'}</span>
                  <span class="grade-badge ${isCorrect ? 'correct' : 'wrong'}">
                    ${isCorrect ? '⭕ 정답' : '❌ 오답'}
                  </span>
                </div>
                <span class="q-points">${g.points ? `+${g.points}점` : ''}</span>
              </div>
              <div class="q-text-body">${escapeHtml(g.questionText || '')}</div>
              <div class="q-answers-row">
                <span class="student-ans">학생 답: <strong>${escapeHtml(g.studentAnswer || '(미응답)')}</strong></span>
                <span class="correct-ans">공식 정답: <strong>${escapeHtml(g.correctAnswer || '')}</strong></span>
              </div>
              <div class="q-explanation">
                <i class="fa-solid fa-lightbulb"></i> <strong>해설:</strong> ${escapeHtml(g.explanation || '공식 해설')}
              </div>
            </div>
          `;
        });
        els.testQuestionsList.innerHTML = html;
      }
    }

    const fb = data.feedback || {};
    if (els.testFbSummary) els.testFbSummary.textContent = fb.summary || '탈로스 공식 시험지 채점이 완료되었습니다.';
    if (els.testFbTips) els.testFbTips.textContent = fb.reviewTips || fb.strengths || '틀린 문제를 다시 한번 복습해보세요!';
  }

  function switchInspectTab(tab) {
    els.tabSpellBtn.classList.toggle('active', tab === 'spell');
    els.tabFeedbackBtn.classList.toggle('active', tab === 'feedback');
    els.tabOcrBtn.classList.toggle('active', tab === 'ocr');

    els.panelSpell.classList.toggle('active', tab === 'spell');
    els.panelFeedback.classList.toggle('active', tab === 'feedback');
    els.panelOcr.classList.toggle('active', tab === 'ocr');
  }

  // ========================================================
  // 복사 및 적용 도구
  // ========================================================
  function copyCorrectedText() {
    if (!state.currentResult) return;
    const text = state.currentResult.data.correctedText || '';
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 교정본이 클립보드에 복사되었습니다!');
    });
  }

  function copyOcrText() {
    if (!state.currentResult) return;
    const text = state.currentResult.data.extractedText || '';
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 판독된 원문이 복사되었습니다!');
    });
  }

  function applyCorrectedToEditor() {
    if (!state.currentResult) return;
    const text = state.currentResult.data.correctedText || '';
    if (els.postContentInput) {
      els.postContentInput.value = text;
      updateCharCount();
      if (els.manualTextBody) els.manualTextBody.style.display = 'block';
      if (els.chevronManualIcon) els.chevronManualIcon.classList.add('open');
      showToast('✏️ 에디터에 교정본이 적용되었습니다!');
    }
  }

  function copyFullReport() {
    if (!state.currentResult) return;
    const meta = state.currentResult.meta;
    const d = state.currentResult.data;

    let report = '';
    if (meta.mainMode === 'test') {
      report = `[nunu AI 스캐너 - 시험 채점 리포트]\n`;
      report += `시험/과목: ${meta.subject || meta.title}\n`;
      report += `총점: ${d.score || 0}점 / 총 ${d.totalQuestions || 0}문항 (정답: ${d.correctCount || 0}, 오답: ${d.wrongCount || 0})\n\n`;
      (d.grading || []).forEach(g => {
        report += `[문항 ${g.questionNumber}] ${g.isCorrect ? 'O 정답' : 'X 오답'} | 학생 답: ${g.studentAnswer} (정답: ${g.correctAnswer})\n`;
        report += `  - 해설: ${g.explanation}\n`;
      });
      report += `\n총평: ${d.feedback ? d.feedback.summary : ''}\n`;
    } else {
      report = `[nunu AI 스캐너 - ${meta.subMode === 'book' ? '독서록' : '일기'} 검사 리포트]\n`;
      report += `제목: ${meta.title}\n\n`;
      report += `■ 판독 원문:\n${d.extractedText || ''}\n\n`;
      report += `■ 교정 완성본:\n${d.correctedText || ''}\n\n`;
      report += `■ 맞춤법 내역 (${d.correctionCount || 0}건):\n`;
      (d.corrections || []).forEach((c, idx) => {
        report += `${idx + 1}. [${c.original}] ➔ [${c.corrected}] : ${c.reason}\n`;
      });
      report += `\n■ 피드백:\n• 총평: ${d.feedback ? d.feedback.summary : ''}\n• 칭찬: ${d.feedback ? d.feedback.praise : ''}\n`;
    }

    navigator.clipboard.writeText(report).then(() => {
      showToast('📋 전체 리포트가 복사되었습니다!');
    });
  }

  // TTS 음성 읽기
  function handleTtsSpeak() {
    if (!('speechSynthesis' in window)) {
      alert('이 브라우저는 음성 읽기(TTS)를 지원하지 않습니다.');
      return;
    }
    if (!state.currentResult) return;

    window.speechSynthesis.cancel();
    const d = state.currentResult.data;
    const meta = state.currentResult.meta;

    let speakText = '';
    if (meta.mainMode === 'test') {
      speakText = `시험 채점 결과 총점 ${d.score || 0}점입니다. ${d.feedback ? d.feedback.summary : ''}`;
    } else {
      const fb = d.feedback || {};
      speakText = `AI 코칭 피드백입니다. ${fb.summary || ''}. ${fb.praise || ''}. `;
      if (Array.isArray(fb.questions)) speakText += `${fb.questions.join('. ')}.`;
    }

    const utter = new SpeechSynthesisUtterance(speakText);
    utter.lang = 'ko-KR';
    utter.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const koVoice = voices.find(v => v.lang.includes('ko') || v.lang.includes('KO'));
    if (koVoice) utter.voice = koVoice;

    utter.onstart = () => {
      if (els.btnTtsSpeak) els.btnTtsSpeak.style.display = 'none';
      if (els.btnTtsStop) els.btnTtsStop.style.display = 'inline-flex';
    };
    utter.onend = () => {
      if (els.btnTtsSpeak) els.btnTtsSpeak.style.display = 'inline-flex';
      if (els.btnTtsStop) els.btnTtsStop.style.display = 'none';
    };
    utter.onerror = utter.onend;

    window.speechSynthesis.speak(utter);
  }

  function handleTtsStop() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (els.btnTtsSpeak) els.btnTtsSpeak.style.display = 'inline-flex';
    if (els.btnTtsStop) els.btnTtsStop.style.display = 'none';
  }

  // ========================================================
  // 보관함 (LocalStorage)
  // ========================================================
  const STORAGE_KEY = 'nunu_scanner_history_v2';

  function loadHistoryFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state.history = raw ? JSON.parse(raw) : [];
    } catch (e) {
      state.history = [];
    }
    updateHistoryBadge();
  }

  function saveCurrentToHistory() {
    if (!state.currentResult) return;
    const newItem = {
      id: 'scan_' + Date.now(),
      savedAt: new Date().toISOString(),
      ...state.currentResult
    };

    state.history.unshift(newItem);
    if (state.history.length > 50) state.history.pop();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    updateHistoryBadge();
    showToast('💾 보관함에 안전하게 저장되었습니다!');
  }

  function updateHistoryBadge() {
    if (els.historyCountBadge) els.historyCountBadge.textContent = state.history.length;
    if (els.modalCount) els.modalCount.textContent = `${state.history.length}건 저장됨`;
  }

  function openHistoryModal() {
    renderHistoryList();
    if (els.historyModal) els.historyModal.style.display = 'flex';
  }

  function closeHistoryModal() {
    if (els.historyModal) els.historyModal.style.display = 'none';
  }

  function renderHistoryList() {
    if (!els.historyListContainer) return;
    if (state.history.length === 0) {
      els.historyListContainer.innerHTML = `
        <div class="empty-history">
          <i class="fa-regular fa-folder-open"></i>
          <p>아직 저장된 스캔 기록이 없습니다.<br>촬영 및 검사 후 '보관함에 저장'을 눌러보세요!</p>
        </div>
      `;
      return;
    }

    let html = '';
    state.history.forEach(item => {
      const isTest = item.meta.mainMode === 'test';
      const label = isTest ? '시험 채점' : (item.meta.subMode === 'book' ? '독서록' : '일기');
      const title = item.meta.title || item.meta.subject || '스캔 항목';
      const dateStr = item.savedAt.split('T')[0];

      html += `
        <div class="history-item">
          <div class="history-info" onclick="window.nunuLoadHistory('${item.id}')">
            <div class="history-info-top">
              <span class="history-badge ${isTest ? 'test' : 'diary'}">${label}</span>
              <span class="history-date">${dateStr}</span>
            </div>
            <div class="history-title">${escapeHtml(title)}</div>
          </div>
          <div class="history-actions">
            <button type="button" class="btn-icon-sm" title="삭제" onclick="window.nunuDeleteHistory('${item.id}')">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
    });
    els.historyListContainer.innerHTML = html;
  }

  window.nunuLoadHistory = function(id) {
    const item = state.history.find(h => h.id === id);
    if (!item) return;

    setMainMode(item.meta.mainMode || 'inspect');
    if (item.meta.subMode) setSubMode(item.meta.subMode);

    state.currentResult = {
      meta: item.meta,
      data: item.data
    };
    renderResult(state.currentResult);
    closeHistoryModal();
    showToast('📂 저장된 기록을 불러왔습니다.');
  };

  window.nunuDeleteHistory = function(id) {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    state.history = state.history.filter(h => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    updateHistoryBadge();
    renderHistoryList();
    showToast('🗑️ 기록이 삭제되었습니다.');
  };

  function clearAllHistory() {
    if (state.history.length === 0) return;
    if (!confirm('모든 기록을 삭제하시겠습니까?')) return;
    state.history = [];
    localStorage.removeItem(STORAGE_KEY);
    updateHistoryBadge();
    renderHistoryList();
    showToast('🗑️ 모든 기록이 삭제되었습니다.');
  }

  function showToast(msg) {
    if (!els.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${msg}</span>`;
    els.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
