/* ============================================================================
   StudyOS 2027 — Focus & Thi Thử (Unified Pomodoro + Exam Timer)
   - Gộp 2 chế độ: Học bình thường (Focus/Break) & Thi thật (HSG/Toán/Lí/Hóa/Tùy chỉnh)
   - Tự động ẩn tab "Bấm giờ thi" cũ trên sidebar, thu gọn bảng Tasks khi vào Thi thật
   - Đồng bộ toàn bộ thời gian thi thật vào Focus Streak, Today's Challenge & Task
   - Nộp bài & Lưu điểm mở thẳng bảng nhập điểm với môn, tên đề & thời gian thực tế
============================================================================ */

(function () {
  const POMO_STATUSES = [
    { key: 'backlog',     label: 'Backlog' },
    { key: 'todo',        label: 'Todo' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'done',        label: 'Done' },
    { key: 'canceled',    label: 'Canceled' }
  ];

  const POMO_PRIORITIES = [
    { key: 'none',   label: 'None',   icon: '—',   color: '#9398a8' },
    { key: 'high',   label: 'High',   icon: '▂▄▆', color: '#f28b82' },
    { key: 'medium', label: 'Medium', icon: '▂▄',  color: '#fdd663' },
    { key: 'low',    label: 'Low',    icon: '▂',   color: '#8ab4f8' }
  ];

  const EXAM_PRESETS = [
    { key: 'hsg',    label: 'HSG Toán · 120p', name: 'HSG Toán', minutes: 120 },
    { key: 'toan',   label: 'Toán TN · 90p',   name: 'Toán TN',  minutes: 90 },
    { key: 'ly',     label: 'Vật lí · 50p',    name: 'Vật lí',   minutes: 50 },
    { key: 'hoa',    label: 'Hóa học · 50p',   name: 'Hóa học',  minutes: 50 },
    { key: 'custom', label: 'Tùy chỉnh',       name: 'Tùy chỉnh', minutes: 60 }
  ];

  const LABEL_COLORS = ['#9f85f7', '#8ab4f8', '#81c995', '#fdd663', '#f28b82', '#4dd0e1', '#f48fb1'];

  const POMO_QUOTES = [
    '“It does not matter how slowly you go as long as you do not stop.”',
    '“You can be a masterpiece and a work in progress at the same time.”',
    '“Tập trung trọn vẹn một phiên học giá trị hơn cả buổi tối phân tâm.”',
    '“Kỷ luật hôm nay tạo nên điểm số ngày 26/01/2027.”'
  ];

  const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // ================= INDEXEDDB FOR ORIGINAL-QUALITY WALLPAPER =================
  const MEDIA_DB_NAME = 'studyos_pomo_media_v1';
  const MEDIA_STORE = 'wallpapers';
  let currentBgObjectUrl = null;

  function openMediaDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(MEDIA_DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(MEDIA_STORE)) {
          req.result.createObjectStore(MEDIA_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveWallpaperBlob(file) {
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      tx.objectStore(MEDIA_STORE).put({ blob: file, type: file.type, name: file.name, size: file.size }, 'active_bg');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadWallpaperBlob() {
    try {
      const db = await openMediaDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, 'readonly');
        const req = tx.objectStore(MEDIA_STORE).get('active_bg');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async function clearWallpaperBlob() {
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      tx.objectStore(MEDIA_STORE).delete('active_bg');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ================= RUNTIME STATE =================
  const nowInit = new Date();
  let pomoRuntime = {
    appMode: 'normal', // 'normal' | 'exam'
    mode: 'focus',     // 'focus' | 'break' (khi appMode === 'normal')
    examSubject: 'hsg',
    examCustomMins: 60,
    examName: '',
    examAlert15: true,
    examAlert5: true,
    examAlert15Fired: false,
    examAlert5Fired: false,
    totalSeconds: 60 * 60,
    remainingSeconds: 60 * 60,
    running: false,
    endTimeMs: null,
    lastTickMs: null,
    unsavedSeconds: 0,
    intervalId: null,
    quoteIdx: 0,
    panelOpen: true,
    showSearch: false,
    searchQuery: '',
    filterLabel: 'all',
    composerOpen: false,
    composerDraft: { title: '', status: 'todo', priority: 'none', dueDate: '', labels: [], addMore: false },
    selectedTaskId: null,
    selectedSubtaskId: null,
    showClosedTasks: false,
    showClosedSubs: false,
    challengeDraftH: 2,
    challengeDraftM: 0,
    streakYear: nowInit.getFullYear(),
    streakMonth: nowInit.getMonth(),
    streakSelectedISO: formatDateISO(nowInit)
  };

  function ensurePomoState() {
    if (!state.pomodoro) {
      state.pomodoro = {
        settings: {
          focusMinutes: 60,
          breakMinutes: 10,
          noBreak: false,
          alarmEnabled: true,
          alarmVolume: 75,
          desktopNotifications: false,
          bgDim: 35,
          bgFit: 'cover'
        },
        focusCount: 0,
        breakCount: 0,
        activeFocus: null,
        dailyLogs: {},
        challenges: {},
        labels: [
          { id: 'lbl_hsg',  name: 'Học sinh giỏi toán', color: '#9f85f7' },
          { id: 'lbl_toan', name: 'Toán', color: '#8ab4f8' },
          { id: 'lbl_ly',   name: 'Lý', color: '#fdd663' },
          { id: 'lbl_hoa',  name: 'Hóa', color: '#81c995' }
        ],
        tasks: [
          { id: 'pt_hoa',  title: 'Hóa',      status: 'todo', priority: 'none', dueDate: '', labels: ['lbl_hoa'],  notes: '', directSeconds: 0, subtasks: [] },
          { id: 'pt_hsg',  title: 'HSG Toán', status: 'todo', priority: 'high', dueDate: '', labels: ['lbl_hsg'],  notes: '', directSeconds: 0, subtasks: [] },
          { id: 'pt_toan', title: 'Toán',     status: 'todo', priority: 'none', dueDate: '', labels: ['lbl_toan'], notes: '', directSeconds: 0, subtasks: [] },
          { id: 'pt_ly',   title: 'Lý',       status: 'todo', priority: 'none', dueDate: '', labels: ['lbl_ly'],   notes: '', directSeconds: 0, subtasks: [] }
        ]
      };
      saveState();
    }
    const p = state.pomodoro;
    if (!p.music) p.music = { library: [], currentLibId: null, currentIndex: 0, volume: 60, shuffle: false, loop: 'all' };
    if (!p.dailyLogs) p.dailyLogs = {};
    if (!p.challenges) p.challenges = {};
    if (p.settings.alarmEnabled === undefined) p.settings.alarmEnabled = true;
    if (p.settings.alarmVolume === undefined) p.settings.alarmVolume = 75;
    if (p.settings.desktopNotifications === undefined) p.settings.desktopNotifications = false;
    if (p.settings.bgDim === undefined) p.settings.bgDim = 35;
    if (!p.settings.bgFit) p.settings.bgFit = 'cover';
    return p;
  }

  // Tự động gỡ tab "Bấm giờ thi" cũ và đổi tên tab Pomodoro thành "Focus & Thi thử"
  function cleanupLegacyExamTimerTab() {
    const oldNav = document.querySelector('.nav-item[data-tab="timer"]');
    if (oldNav) oldNav.remove();
    const oldView = document.getElementById('view-timer');
    if (oldView) oldView.remove();

    const pomoNavLabel = document.querySelector('.nav-item[data-tab="pomodoro"] span:nth-child(2)');
    if (pomoNavLabel) pomoNavLabel.textContent = 'Focus & Thi thử';
  }

  // ================= SOOTHING ALARM & NOTIFICATIONS =================
  function playSoftAlarm() {
    const p = ensurePomoState();
    if (!p.settings.alarmEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const vol = Math.max(0.01, (p.settings.alarmVolume / 100) * 0.16);
      const notes = [523.25, 659.25, 783.99, 987.77];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.22;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(vol, start + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + 1.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 1.3);
      });
    } catch { /* ignore */ }
  }

  function sendDesktopNotification(title, body) {
    const p = ensurePomoState();
    if (!p.settings.desktopNotifications) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body }); } catch { /* ignore */ }
    }
  }

  function launchCelebrationConfetti() {
    const canvas = document.createElement('canvas');
    canvas.className = 'pomo-confetti-canvas';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const colors = ['#a084f8', '#f28b82', '#fdd663', '#81c995', '#8ab4f8', '#f48fb1', '#ffffff'];
    const particles = Array.from({ length: 130 }, () => ({
      x: canvas.width * (0.2 + Math.random() * 0.6),
      y: canvas.height * 0.45 + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      size: Math.random() * 7 + 4,
      rot: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1
    }));

    let frame = 0;
    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;
      let alive = false;
      particles.forEach(pt => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.32;
        pt.vx *= 0.99;
        pt.rot += pt.vRot;
        if (frame > 80) pt.alpha -= 0.018;
        if (pt.alpha > 0 && pt.y < canvas.height + 30) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, pt.alpha);
          ctx.translate(pt.x, pt.y);
          ctx.rotate((pt.rot * Math.PI) / 180);
          ctx.fillStyle = pt.color;
          ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.65);
          ctx.restore();
        }
      });
      if (alive && frame < 190) requestAnimationFrame(tick);
      else canvas.remove();
    }
    requestAnimationFrame(tick);
  }

  // ================= FORMATTERS & STREAK CALCULATION =================
  function formatDurationShort(totalSec = 0) {
    const s = Math.max(0, Math.floor(totalSec));
    if (s < 60) return `${s}s`;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  function formatCalCellTime(totalSec = 0) {
    const mins = Math.floor(totalSec / 60);
    if (mins <= 0) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
  }

  function formatPomoClock(sec) {
    const s = Math.max(0, Math.ceil(sec));
    if (s > 3600) {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const r = s % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
    }
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function getTaskTotalSeconds(task) {
    const subSum = (task.subtasks || []).reduce((acc, st) => acc + (st.seconds || 0), 0);
    return (task.directSeconds || 0) + subSum;
  }

  function getTodayISO() { return formatDateISO(new Date()); }
  function getTodayFocusedSeconds() { return ensurePomoState().dailyLogs[getTodayISO()]?.seconds || 0; }
  function isDayQualified(log) { return Boolean(log && ((log.sessions || 0) >= 1 || (log.seconds || 0) >= 900)); }

  function computeStreaks() {
    const p = ensurePomoState();
    const logs = p.dailyLogs || {};
    const qualifiedDates = Object.keys(logs).filter(iso => isDayQualified(logs[iso])).sort();

    let best = 0;
    let run = 0;
    let prevDate = null;
    qualifiedDates.forEach(iso => {
      const d = parseDateISO(iso);
      if (prevDate && Math.round((d - prevDate) / 86400000) === 1) run++;
      else run = 1;
      if (run > best) best = run;
      prevDate = d;
    });

    const today = new Date();
    const todayISO = formatDateISO(today);
    const yesterdayISO = formatDateISO(addDays(today, -1));
    let cursor = null;
    if (isDayQualified(logs[todayISO])) cursor = today;
    else if (isDayQualified(logs[yesterdayISO])) cursor = addDays(today, -1);

    let current = 0;
    while (cursor && isDayQualified(logs[formatDateISO(cursor)])) {
      current++;
      cursor = addDays(cursor, -1);
    }

    return { current, best };
  }

  function getActiveFocusLabel() {
    const p = ensurePomoState();
    if (!p.activeFocus) return 'Focus session';
    const t = p.tasks.find(x => x.id === p.activeFocus.taskId);
    if (!t) return 'Focus session';
    if (p.activeFocus.subtaskId) {
      const st = (t.subtasks || []).find(s => s.id === p.activeFocus.subtaskId);
      if (st) return `${t.title} · ${st.title}`;
    }
    return t.title;
  }

  function getCurrentExamPreset() {
    return EXAM_PRESETS.find(x => x.key === pomoRuntime.examSubject) || EXAM_PRESETS[0];
  }

  function getCurrentExamMinutes() {
    if (pomoRuntime.examSubject === 'custom') {
      return Math.max(1, Math.min(360, parseInt(pomoRuntime.examCustomMins, 10) || 60));
    }
    return getCurrentExamPreset().minutes;
  }

  function getDayChallenges(iso) {
    const p = ensurePomoState();
    const raw = p.challenges?.[iso];
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') {
      return [{
        id: raw.id || `ch_legacy_${iso}`,
        targetSeconds: raw.targetSeconds || 0,
        startSeconds: typeof raw.startSeconds === 'number' ? raw.startSeconds : 0,
        accepted: !!raw.accepted,
        completed: !!raw.completed,
        gaveUp: !!raw.gaveUp,
        createdAt: raw.createdAt || 0
      }];
    }
    return [];
  }

  function ensureDayChallengesArray(iso) {
    const p = ensurePomoState();
    const raw = p.challenges?.[iso];
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      p.challenges[iso] = getDayChallenges(iso);
      return p.challenges[iso];
    }
    p.challenges[iso] = [];
    return p.challenges[iso];
  }

  function getChallengeProgressSeconds(ch, todayFocusedSec = getTodayFocusedSeconds()) {
    const start = typeof ch.startSeconds === 'number' ? ch.startSeconds : 0;
    return Math.max(0, todayFocusedSec - start);
  }

  function getChallengeRemainingSeconds(ch, todayFocusedSec = getTodayFocusedSeconds()) {
    return Math.max(0, (ch.targetSeconds || 0) - getChallengeProgressSeconds(ch, todayFocusedSec));
  }

  function checkTodayChallengeCompletion() {
    const iso = getTodayISO();
    const list = ensureDayChallengesArray(iso);
    if (!list.length) return;

    const todaySec = getTodayFocusedSeconds();
    let newlyCompleted = 0;

    list.forEach(ch => {
      if (!ch || !ch.accepted || ch.completed || ch.gaveUp) return;
      if (getChallengeProgressSeconds(ch, todaySec) >= ch.targetSeconds) {
        ch.completed = true;
        ch.completedAt = Date.now();
        newlyCompleted++;
      }
    });

    if (newlyCompleted > 0) {
      saveState();
      playSoftAlarm();
      launchCelebrationConfetti();
      const msg = newlyCompleted > 1
        ? `🎉 Chúc mừng! Bạn vừa hoàn thành ${newlyCompleted} Today's Challenges!`
        : '🎉 Chúc mừng! Bạn đã hoàn thành Today\'s Challenge!';
      showToast(msg);
      sendDesktopNotification(
        'Hoàn thành Today\'s Challenge!',
        newlyCompleted > 1
          ? `Tuyệt vời! Bạn vừa hoàn thành ${newlyCompleted} thử thách tập trung hôm nay.`
          : 'Tuyệt vời! Bạn đã đạt đủ thời gian tập trung mục tiêu.'
      );
      updateRailBadges();
    }
  }

  function creditFocusedSeconds(secToAdd) {
    if (secToAdd <= 0) return;
    const p = ensurePomoState();
    const iso = getTodayISO();
    if (!p.dailyLogs[iso]) p.dailyLogs[iso] = { seconds: 0, sessions: 0 };
    p.dailyLogs[iso].seconds += secToAdd;

    if (p.activeFocus) {
      const t = p.tasks.find(x => x.id === p.activeFocus.taskId);
      if (t) {
        if (p.activeFocus.subtaskId) {
          const st = (t.subtasks || []).find(s => s.id === p.activeFocus.subtaskId);
          if (st) st.seconds = (st.seconds || 0) + secToAdd;
        } else {
          t.directSeconds = (t.directSeconds || 0) + secToAdd;
        }
      }
    }
    saveState();
    checkTodayChallengeCompletion();
    updateRailBadges();
  }

  function recordCompletedFocusSession(incrementPomoCounter = true) {
    const p = ensurePomoState();
    const iso = getTodayISO();
    if (!p.dailyLogs[iso]) p.dailyLogs[iso] = { seconds: 0, sessions: 0 };
    p.dailyLogs[iso].sessions += 1;
    if (incrementPomoCounter) p.focusCount += 1;
    saveState();
    checkTodayChallengeCompletion();
    updateRailBadges();
  }

  function flushUnsavedSeconds() {
    const whole = Math.floor(pomoRuntime.unsavedSeconds);
    if (whole > 0) {
      creditFocusedSeconds(whole);
      pomoRuntime.unsavedSeconds -= whole;
    }
  }

  function stopPomoInterval() {
    flushUnsavedSeconds();
    pomoRuntime.running = false;
    clearInterval(pomoRuntime.intervalId);
    pomoRuntime.intervalId = null;
    pomoRuntime.lastTickMs = null;
  }

  function resetPomoToMode(mode) {
    const p = ensurePomoState();
    stopPomoInterval();
    pomoRuntime.mode = mode;
    const mins = mode === 'focus' ? p.settings.focusMinutes : p.settings.breakMinutes;
    pomoRuntime.totalSeconds = Math.max(60, mins * 60);
    pomoRuntime.remainingSeconds = pomoRuntime.totalSeconds;
    updatePomoTimerUI();
  }

  function resetExamTimer() {
    stopPomoInterval();
    const mins = getCurrentExamMinutes();
    pomoRuntime.totalSeconds = mins * 60;
    pomoRuntime.remainingSeconds = mins * 60;
    pomoRuntime.examAlert15Fired = false;
    pomoRuntime.examAlert5Fired = false;
    updatePomoTimerUI();
  }

  function hasTimerProgress() {
    return pomoRuntime.running || (pomoRuntime.remainingSeconds < pomoRuntime.totalSeconds && pomoRuntime.remainingSeconds > 0);
  }

  // ================= LƯU / KHÔI PHỤC PHIÊN (theo thiết bị) =================
  const POMO_SESSION_KEY = 'studyos_pomo_session';
  const POMO_SESSION_MAX_AGE = 24 * 3600 * 1000;

  function liveRemainingSeconds() {
    if (pomoRuntime.running && pomoRuntime.endTimeMs) {
      return Math.max(0, (pomoRuntime.endTimeMs - Date.now()) / 1000);
    }
    return pomoRuntime.remainingSeconds;
  }

  function savePomoSession() {
    try {
      if (!hasTimerProgress()) {
        localStorage.removeItem(POMO_SESSION_KEY);
        return;
      }
      localStorage.setItem(POMO_SESSION_KEY, JSON.stringify({
        appMode: pomoRuntime.appMode,
        mode: pomoRuntime.mode,
        examSubject: pomoRuntime.examSubject,
        examCustomMins: pomoRuntime.examCustomMins,
        examName: pomoRuntime.examName,
        examAlert15: pomoRuntime.examAlert15,
        examAlert5: pomoRuntime.examAlert5,
        examAlert15Fired: pomoRuntime.examAlert15Fired,
        examAlert5Fired: pomoRuntime.examAlert5Fired,
        totalSeconds: pomoRuntime.totalSeconds,
        remainingSeconds: liveRemainingSeconds(),
        savedAt: Date.now()
      }));
    } catch (e) { /* ignore */ }
  }

  function restorePomoSession() {
    try {
      const raw = localStorage.getItem(POMO_SESSION_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s || Date.now() - (s.savedAt || 0) > POMO_SESSION_MAX_AGE) {
        localStorage.removeItem(POMO_SESSION_KEY);
        return false;
      }
      if (!(s.totalSeconds > 0) || !(s.remainingSeconds > 0) || s.remainingSeconds > s.totalSeconds + 1) return false;
      stopPomoInterval();
      pomoRuntime.appMode = s.appMode === 'exam' ? 'exam' : 'normal';
      pomoRuntime.mode = s.mode === 'break' ? 'break' : 'focus';
      pomoRuntime.examSubject = s.examSubject || 'hsg';
      pomoRuntime.examCustomMins = s.examCustomMins || 60;
      pomoRuntime.examName = s.examName || '';
      if (typeof s.examAlert15 === 'boolean') pomoRuntime.examAlert15 = s.examAlert15;
      if (typeof s.examAlert5 === 'boolean') pomoRuntime.examAlert5 = s.examAlert5;
      pomoRuntime.examAlert15Fired = !!s.examAlert15Fired;
      pomoRuntime.examAlert5Fired = !!s.examAlert5Fired;
      pomoRuntime.totalSeconds = s.totalSeconds;
      pomoRuntime.remainingSeconds = s.remainingSeconds;
      pomoRuntime.running = false;
      if (pomoRuntime.appMode === 'exam') {
        pomoRuntime.panelOpen = false;
        document.getElementById('btn-pomo-toggle-tasks')?.classList.remove('active');
        const nameInp = document.getElementById('pomo-exam-name');
        if (nameInp) nameInp.value = pomoRuntime.examName;
        const minsInp = document.getElementById('pomo-exam-custom-mins');
        if (minsInp) minsInp.value = pomoRuntime.examCustomMins;
        const a15 = document.getElementById('pomo-exam-alert15');
        const a5 = document.getElementById('pomo-exam-alert5');
        if (a15) a15.checked = pomoRuntime.examAlert15;
        if (a5) a5.checked = pomoRuntime.examAlert5;
      }
      updatePomoTimerUI();
      showToast('Đã khôi phục phiên đang dở — bấm Resume để tiếp tục.');
      return true;
    } catch (e) { return false; }
  }

  window.addEventListener('beforeunload', () => { flushUnsavedSeconds(); savePomoSession(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { flushUnsavedSeconds(); savePomoSession(); }
  });
  window.addEventListener('pagehide', () => { flushUnsavedSeconds(); savePomoSession(); });

  function updateRailBadges() {
    const { current } = computeStreaks();
    const streakEl = document.getElementById('pomo-rail-streak-num');
    if (streakEl) streakEl.textContent = String(current);

    const chBtn = document.getElementById('btn-pomo-challenge');
    const chSub = document.getElementById('pomo-rail-challenge-sub');
    if (!chBtn || !chSub) return;

    const visible = getDayChallenges(getTodayISO()).filter(c => c.accepted && !c.gaveUp);
    const activeList = visible.filter(c => !c.completed);
    const doneList = visible.filter(c => c.completed);

    chBtn.classList.remove('active', 'challenge-done');

    if (activeList.length > 0) {
      const todaySec = getTodayFocusedSeconds();
      const minLeftSec = Math.min(...activeList.map(c => getChallengeRemainingSeconds(c, todaySec)));
      const leftMins = Math.max(1, Math.ceil(minLeftSec / 60));
      const h = Math.floor(leftMins / 60);
      const m = leftMins % 60;
      const timeTxt = h > 0 ? (m > 0 ? `${h}h${m}` : `${h}h`) : `${m}m`;
      chBtn.classList.add('active');
      chSub.textContent = activeList.length > 1 ? `${activeList.length}·${timeTxt}` : timeTxt;
      chSub.classList.remove('hidden');
    } else if (doneList.length > 0) {
      chBtn.classList.add('challenge-done');
      chSub.textContent = doneList.length > 1 ? `✓${doneList.length}` : '✓';
      chSub.classList.remove('hidden');
    } else {
      chSub.textContent = '';
      chSub.classList.add('hidden');
    }
  }

  function updatePomoTimerUI() {
    const p = ensurePomoState();
    const clockEl = document.getElementById('pomo-clock-display');
    if (!clockEl) return;

    const isExam = pomoRuntime.appMode === 'exam';
    const str = formatPomoClock(pomoRuntime.remainingSeconds);
    clockEl.textContent = str;
    clockEl.classList.toggle('long-fmt', Math.ceil(pomoRuntime.remainingSeconds) > 3600);

    const badge = document.getElementById('nav-pomo-badge');
    if (badge) {
      if (pomoRuntime.running) {
        badge.textContent = str;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    // Ring progress & warning color
    const circumference = 2 * Math.PI * 162;
    const ratio = pomoRuntime.totalSeconds > 0 ? pomoRuntime.remainingSeconds / pomoRuntime.totalSeconds : 0;
    const ring = document.getElementById('pomo-ring-progress');
    if (ring) {
      ring.style.strokeDashoffset = String(circumference * (1 - ratio));
      if (isExam) {
        ring.style.stroke = pomoRuntime.remainingSeconds <= 300 ? '#f28b82' : '#b095fc';
      } else {
        ring.style.stroke = pomoRuntime.mode === 'break' ? '#81c995' : '#b095fc';
      }
    }

    // Mode switcher buttons
    document.querySelectorAll('.pomo-appmode-btn').forEach(b => {
      const act = b.dataset.appMode === pomoRuntime.appMode;
      b.classList.toggle('active', act);
      b.classList.toggle('exam-active', act && b.dataset.appMode === 'exam');
    });

    // Toggle Normal vs Exam top bars
    document.getElementById('pomo-normal-tabs')?.classList.toggle('hidden', isExam);
    document.getElementById('pomo-exam-tabs')?.classList.toggle('hidden', !isExam);

    const examMetaBar = document.getElementById('pomo-exam-meta-bar');
    if (examMetaBar) {
      examMetaBar.classList.toggle('hidden', !isExam);
      examMetaBar.classList.toggle('is-running', isExam && pomoRuntime.running);
    }

    document.getElementById('pomo-exam-custom-wrap')?.classList.toggle('hidden', !(isExam && pomoRuntime.examSubject === 'custom'));

    const focusCountEl = document.getElementById('pomo-focus-count');
    const breakCountEl = document.getElementById('pomo-break-count');
    if (focusCountEl) focusCountEl.textContent = p.focusCount;
    if (breakCountEl) breakCountEl.textContent = p.breakCount;

    document.querySelectorAll('#pomo-normal-tabs .pomo-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.pomoMode === pomoRuntime.mode);
    });
    document.querySelectorAll('#pomo-exam-tabs .pomo-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.examPreset === pomoRuntime.examSubject);
    });

    const inProgress = hasTimerProgress();
    const toggleBtn = document.getElementById('btn-pomo-toggle');
    if (toggleBtn) {
      if (pomoRuntime.running) toggleBtn.textContent = 'Pause';
      else if (inProgress) toggleBtn.textContent = 'Resume';
      else toggleBtn.textContent = 'Start';
    }

    const stopBtn = document.getElementById('btn-pomo-stop');
    if (stopBtn) stopBtn.classList.toggle('can-stop', inProgress);

    // Quick action buttons below ring
    const finishEarlyBtn = document.getElementById('btn-pomo-finish-early');
    const submitExamBtn = document.getElementById('btn-pomo-exam-submit');
    if (finishEarlyBtn) finishEarlyBtn.classList.toggle('hidden', isExam || !inProgress);
    if (submitExamBtn) submitExamBtn.classList.toggle('hidden', !isExam);

    // Session pill inside ring
    const sessionDot = document.getElementById('pomo-session-dot');
    const sessionText = document.getElementById('pomo-session-text');
    const clearBtn = document.getElementById('btn-pomo-clear-focus');
    if (sessionDot) sessionDot.classList.toggle('exam-dot', isExam);
    if (sessionText) {
      if (isExam) {
        const presetName = getCurrentExamPreset().name;
        const customTitle = pomoRuntime.examName.trim();
        sessionText.textContent = customTitle ? `Thi thật · ${customTitle}` : `Thi thật · ${presetName}`;
      } else {
        sessionText.textContent = pomoRuntime.mode === 'break' ? 'Break time' : getActiveFocusLabel();
      }
    }
    if (clearBtn) {
      clearBtn.classList.toggle('hidden', isExam || !p.activeFocus || pomoRuntime.mode === 'break');
    }

    const brandLabel = document.getElementById('pomo-brand-label');
    if (brandLabel) brandLabel.textContent = isExam ? 'Chế độ Thi thật' : 'Pomodoro Timer';

    updateRailBadges();
    savePomoSession();
  }

  async function switchAppMode(targetAppMode) {
    if (targetAppMode === pomoRuntime.appMode) return;
    if (hasTimerProgress()) {
      const ok = await askConfirm({
        title: `Chuyển sang ${targetAppMode === 'exam' ? 'Thi thật' : 'Học bình thường'}?`,
        message: 'Phiên hiện tại đang chạy dở. Chuyển chế độ sẽ lưu thời gian đã tập trung và đặt lại đồng hồ.',
        confirmText: 'Chuyển chế độ'
      });
      if (!ok) return;
    }

    stopPomoInterval();
    pomoRuntime.appMode = targetAppMode;

    if (targetAppMode === 'exam') {
      // Tự động thu gọn bảng Tasks khi vào chế độ Thi thật
      pomoRuntime.panelOpen = false;
      document.getElementById('btn-pomo-toggle-tasks')?.classList.remove('active');
      resetExamTimer();
    } else {
      resetPomoToMode('focus');
    }
    renderPomoTasksPanel();
    updatePomoTimerUI();
  }

  async function togglePomoTimer() {
    const p = ensurePomoState();
    const isExam = pomoRuntime.appMode === 'exam';

    if (pomoRuntime.running) {
      const ok = await askConfirm({
        title: isExam ? 'Tạm dừng làm bài thi?' : 'Tạm dừng Pomodoro?',
        message: 'Thời gian đã tập trung sẽ được lưu lại. Bạn có chắc muốn tạm dừng không?',
        confirmText: 'Tạm dừng'
      });
      if (!ok) return;
      stopPomoInterval();
      updatePomoTimerUI();
      renderPomoTasksPanel();
      return;
    }

    if (pomoRuntime.remainingSeconds <= 0) {
      if (isExam) {
        const mins = getCurrentExamMinutes();
        pomoRuntime.totalSeconds = mins * 60;
        pomoRuntime.remainingSeconds = mins * 60;
        pomoRuntime.examAlert15Fired = false;
        pomoRuntime.examAlert5Fired = false;
      } else {
        const mins = pomoRuntime.mode === 'focus' ? p.settings.focusMinutes : p.settings.breakMinutes;
        pomoRuntime.totalSeconds = mins * 60;
        pomoRuntime.remainingSeconds = pomoRuntime.totalSeconds;
      }
    }

    pomoRuntime.running = true;
    pomoRuntime.lastTickMs = Date.now();
    pomoRuntime.endTimeMs = Date.now() + pomoRuntime.remainingSeconds * 1000;

    pomoRuntime.intervalId = setInterval(() => {
      const now = Date.now();
      const deltaSec = (now - pomoRuntime.lastTickMs) / 1000;
      pomoRuntime.lastTickMs = now;

      // Cả Focus bình thường và Thi thật đều cộng dồn vào Focus Streak, Challenge & Task
      if (isExam || pomoRuntime.mode === 'focus') {
        pomoRuntime.unsavedSeconds += deltaSec;
        if (pomoRuntime.unsavedSeconds >= 10) {
          flushUnsavedSeconds();
          renderPomoTasksPanel();
        }
      }

      const rem = Math.max(0, (pomoRuntime.endTimeMs - now) / 1000);
      pomoRuntime.remainingSeconds = rem;

      // Cảnh báo mốc 15p & 5p cuối cho chế độ Thi thật
      if (isExam) {
        if (pomoRuntime.examAlert15 && !pomoRuntime.examAlert15Fired && pomoRuntime.totalSeconds > 15 * 60 && rem <= 15 * 60 && rem > 14 * 60) {
          pomoRuntime.examAlert15Fired = true;
          playSoftAlarm();
          showToast('⏰ Còn 15 phút cuối giờ làm bài!');
          sendDesktopNotification('Còn 15 phút cuối!', 'Kiểm tra tiến độ các câu còn lại nhé.');
        }
        if (pomoRuntime.examAlert5 && !pomoRuntime.examAlert5Fired && pomoRuntime.totalSeconds > 5 * 60 && rem <= 5 * 60 && rem > 4 * 60) {
          pomoRuntime.examAlert5Fired = true;
          playSoftAlarm();
          showToast('🔔 Còn 5 phút cuối — soát lại bài và đáp án!');
          sendDesktopNotification('Còn 5 phút cuối!', 'Soát kỹ lại bài làm trước khi hết giờ.');
        }
      }

      if (rem <= 0) {
        stopPomoInterval();
        playSoftAlarm();
        if (isExam) {
          recordCompletedFocusSession(false);
          renderPomoTasksPanel();
          updatePomoTimerUI();
          showToast('Hết giờ làm bài! Nhấn "Nộp bài & Lưu điểm" để ghi kết quả.');
          sendDesktopNotification('Hết giờ làm bài thi!', 'Nhấn "Nộp bài & Lưu điểm" để lưu kết quả đề thi.');
        } else if (pomoRuntime.mode === 'focus') {
          recordCompletedFocusSession(true);
          renderPomoTasksPanel();
          if (p.settings.noBreak) {
            showToast('Hoàn thành phiên Focus! (Chế độ không nghỉ)');
            sendDesktopNotification('Hoàn thành phiên Focus!', 'Đã lưu thời gian học. Sẵn sàng cho phiên tiếp theo.');
            resetPomoToMode('focus');
          } else {
            showToast('Hoàn thành phiên Focus! Chuyển sang Break.');
            sendDesktopNotification('Hoàn thành phiên Focus!', 'Nghỉ ngơi một chút trước phiên tiếp theo nhé.');
            resetPomoToMode('break');
          }
        } else {
          p.breakCount += 1;
          saveState();
          showToast('Hết giờ nghỉ! Sẵn sàng quay lại Focus.');
          sendDesktopNotification('Hết giờ nghỉ!', 'Quay lại tập trung thôi.');
          resetPomoToMode('focus');
        }
        return;
      }
      updatePomoTimerUI();
    }, 300);

    updatePomoTimerUI();
  }

  async function stopPomoSession() {
    if (!hasTimerProgress()) {
      showToast('Chưa có phiên nào đang chạy.');
      return;
    }
    const isExam = pomoRuntime.appMode === 'exam';
    const ok = await askConfirm({
      title: isExam ? 'Dừng phiên thi hiện tại?' : 'Dừng phiên Pomodoro hiện tại?',
      message: 'Thời gian bạn đã tập trung sẽ được lưu lại, sau đó đồng hồ sẽ dừng và đặt lại về mốc ban đầu.',
      confirmText: 'Dừng phiên',
      danger: true
    });
    if (!ok) return;
    if (isExam) resetExamTimer();
    else resetPomoToMode(pomoRuntime.mode);
    renderPomoTasksPanel();
    showToast('Đã dừng phiên và lưu thời gian tập trung.');
  }

  async function submitExamAndOpenModal() {
    const ok = await askConfirm({
      title: 'Nộp bài & Lưu điểm?',
      message: 'Đồng hồ sẽ dừng, lưu thời gian tập trung vào Streak và mở bảng nhập điểm với đúng môn & thời gian thực tế.',
      confirmText: 'Nộp bài'
    });
    if (!ok) return;

    stopPomoInterval();
    const elapsedSec = pomoRuntime.totalSeconds - pomoRuntime.remainingSeconds;
    if (elapsedSec >= 60) recordCompletedFocusSession(false);

    const elapsedMins = elapsedSec > 10
      ? Math.max(1, Math.round(elapsedSec / 60))
      : Math.round(pomoRuntime.totalSeconds / 60);

    const subForModal = pomoRuntime.examSubject === 'custom' ? 'toan' : pomoRuntime.examSubject;
    const examTitle = pomoRuntime.examName.trim();

    resetExamTimer();
    renderPomoTasksPanel();

    if (typeof openExamModal === 'function') {
      openExamModal(null, {
        subject: subForModal,
        name: examTitle,
        duration: elapsedMins
      });
    }
  }

  // ================= CUSTOM WALLPAPER RENDER =================
  async function applySavedWallpaper() {
    const p = ensurePomoState();
    const bgLayer = document.getElementById('pomo-bg-layer');
    const scrim = document.getElementById('pomo-bg-scrim');
    if (scrim) {
      const opacity = Math.min(0.88, Math.max(0, (p.settings.bgDim ?? 35) / 100));
      scrim.style.background = `rgba(10, 11, 16, ${opacity})`;
    }
    if (!bgLayer) return;
    bgLayer.classList.toggle('fit-contain', p.settings.bgFit === 'contain');

    if (currentBgObjectUrl) {
      URL.revokeObjectURL(currentBgObjectUrl);
      currentBgObjectUrl = null;
    }

    const saved = await loadWallpaperBlob();
    if (!saved || !saved.blob) {
      bgLayer.innerHTML = '';
      return;
    }

    currentBgObjectUrl = URL.createObjectURL(saved.blob);
    if ((saved.type || '').startsWith('video/')) {
      bgLayer.innerHTML = `<video src="${currentBgObjectUrl}" autoplay loop muted playsinline></video>`;
    } else {
      bgLayer.innerHTML = `<img src="${currentBgObjectUrl}" alt="Wallpaper" decoding="sync" />`;
    }
  }

  // ================= OVERLAY MANAGEMENT =================
  function closePomoOverlays() {
    document.querySelectorAll('.pomo-dynamic-overlay').forEach(el => el.remove());
  }

  // 1. TODAY'S CHALLENGE (Hỗ trợ nhiều challenge mỗi ngày, tính tiến độ từ lúc Accept)
  function openChallengeCreateModal() {
    closePomoOverlays();
    const iso = getTodayISO();
    const todayName = EN_DAYS[new Date().getDay()];
    const existingCount = getDayChallenges(iso).filter(c => c.accepted && !c.gaveUp).length;

    const backdrop = document.createElement('div');
    backdrop.className = 'pomo-overlay-backdrop pomo-dynamic-overlay';

    const card = document.createElement('div');
    card.className = 'pomo-challenge-card pomo-anim-card';
    backdrop.appendChild(card);

    const renderPicker = () => {
      card.innerHTML = `
        <div class="pomo-ch-eyebrow">
          <span>TODAY'S CHALLENGE ${existingCount > 0 ? `#${existingCount + 1}` : ''}</span>
          <button type="button" class="btn-icon" data-close-overlay>✕</button>
        </div>
        <div class="pomo-ch-heading">${existingCount > 0
          ? `Add another focus challenge for ${todayName}...`
          : `Today ${todayName}, I want to focus for...`}</div>

        <div class="pomo-ch-steppers">
          <div class="pomo-stepper-pill">
            <button type="button" class="pomo-step-btn" id="ch-h-minus">−</button>
            <div class="pomo-step-val">
              <div class="pomo-step-num">${pomoRuntime.challengeDraftH}</div>
              <div class="pomo-step-unit">Hours</div>
            </div>
            <button type="button" class="pomo-step-btn" id="ch-h-plus">+</button>
          </div>

          <div class="pomo-stepper-pill">
            <button type="button" class="pomo-step-btn" id="ch-m-minus">−</button>
            <div class="pomo-step-val">
              <div class="pomo-step-num">${String(pomoRuntime.challengeDraftM).padStart(2, '0')}</div>
              <div class="pomo-step-unit">Minutes</div>
            </div>
            <button type="button" class="pomo-step-btn" id="ch-m-plus">+</button>
          </div>
        </div>

        <div style="font-size:12.5px;color:var(--text-muted);line-height:1.45;">
          Focus & exam time earned from now will count toward this challenge. Breaks and pauses don't count.
        </div>

        <button type="button" class="pomo-ch-accept-btn" id="btn-ch-accept">
          <span>🔥</span><span>Accept challenge</span>
        </button>
      `;

      card.querySelector('[data-close-overlay]').addEventListener('click', closePomoOverlays);
      card.querySelector('#ch-h-minus').addEventListener('click', () => {
        pomoRuntime.challengeDraftH = Math.max(0, pomoRuntime.challengeDraftH - 1);
        renderPicker();
      });
      card.querySelector('#ch-h-plus').addEventListener('click', () => {
        pomoRuntime.challengeDraftH = Math.min(24, pomoRuntime.challengeDraftH + 1);
        if (pomoRuntime.challengeDraftH === 24) pomoRuntime.challengeDraftM = 0;
        renderPicker();
      });
      card.querySelector('#ch-m-minus').addEventListener('click', () => {
        pomoRuntime.challengeDraftM = pomoRuntime.challengeDraftM >= 5 ? pomoRuntime.challengeDraftM - 5 : 55;
        renderPicker();
      });
      card.querySelector('#ch-m-plus').addEventListener('click', () => {
        if (pomoRuntime.challengeDraftH === 24) return;
        pomoRuntime.challengeDraftM = (pomoRuntime.challengeDraftM + 5) % 60;
        renderPicker();
      });

      card.querySelector('#btn-ch-accept').addEventListener('click', () => {
        const totalMin = pomoRuntime.challengeDraftH * 60 + pomoRuntime.challengeDraftM;
        if (totalMin <= 0) return showToast('Hãy chọn ít nhất 5 phút cho thử thách!');
        const targetSec = totalMin * 60;
        const list = ensureDayChallengesArray(iso);
        list.push({
          id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          targetSeconds: targetSec,
          startSeconds: getTodayFocusedSeconds(),
          accepted: true,
          completed: false,
          gaveUp: false,
          createdAt: Date.now()
        });
        saveState();
        closePomoOverlays();
        updateRailBadges();
        showToast(`Đã nhận thử thách mới: ${formatDurationShort(targetSec)}!`);
      });
    };

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePomoOverlays(); });
    document.body.appendChild(backdrop);
    renderPicker();
  }

  function openChallengeUI(anchorBtn) {
    closePomoOverlays();
    const iso = getTodayISO();
    const visible = getDayChallenges(iso).filter(c => c.accepted && !c.gaveUp);

    if (!visible.length) {
      openChallengeCreateModal();
      return;
    }

    const pop = document.createElement('div');
    pop.className = 'pomo-challenge-pop pomo-dynamic-overlay';
    const rect = anchorBtn.getBoundingClientRect();
    pop.style.left = `${rect.right + 14}px`;
    pop.style.top = `${Math.max(20, rect.top - 12)}px`;

    const renderPopover = () => {
      const currentList = getDayChallenges(iso).filter(c => c.accepted && !c.gaveUp);
      if (!currentList.length) {
        closePomoOverlays();
        return;
      }
      const todaySec = getTodayFocusedSeconds();
      const doneCount = currentList.filter(c => c.completed).length;

      const itemsHtml = currentList.map((ch, idx) => {
        const progSec = ch.completed ? ch.targetSeconds : getChallengeProgressSeconds(ch, todaySec);
        const leftSec = ch.completed ? 0 : getChallengeRemainingSeconds(ch, todaySec);
        const pct = ch.targetSeconds > 0 ? Math.min(100, Math.round((progSec / ch.targetSeconds) * 100)) : 100;
        const targetTxt = formatDurationShort(ch.targetSeconds);
        const titleTxt = ch.completed
          ? `#${idx + 1} · Hoàn thành! 🎉`
          : `#${idx + 1} · Còn ${formatDurationShort(leftSec)}`;
        const subTxt = ch.completed
          ? `Mục tiêu ${targetTxt} · 100%`
          : `Đã tập trung ${formatDurationShort(progSec)} / ${targetTxt} (${pct}%)`;

        return `
          <div class="pomo-ch-item ${ch.completed ? 'is-done' : ''}">
            <div class="pomo-ch-pop-row">
              <div class="pomo-ch-pop-left">
                <span class="pomo-ch-pop-icon">${ch.completed ? '✅' : '🏆'}</span>
                <div class="pomo-ch-pop-info">
                  <div class="pomo-ch-pop-title">${titleTxt}</div>
                  <div class="pomo-ch-pop-sub">${subTxt}</div>
                </div>
              </div>
              ${ch.completed ? '' : `<button type="button" class="pomo-giveup-btn" data-giveup-ch="${ch.id}">Give up</button>`}
            </div>
            <div class="pomo-ch-bar">
              <div class="pomo-ch-bar-fill" style="width:${pct}%;"></div>
            </div>
          </div>`;
      }).join('');

      pop.innerHTML = `
        <div class="pomo-ch-eyebrow">
          <span>TODAY'S CHALLENGES (${doneCount}/${currentList.length})</span>
          <button type="button" class="btn-icon" style="width:24px;height:24px;font-size:12px;" data-close-ch-pop>✕</button>
        </div>
        <div class="pomo-ch-list">${itemsHtml}</div>
        <button type="button" class="pomo-ch-add-btn" id="btn-ch-add-more">
          <span>＋</span><span>Thêm challenge mới</span>
        </button>
      `;

      pop.querySelector('[data-close-ch-pop]').addEventListener('click', closePomoOverlays);
      pop.querySelector('#btn-ch-add-more').addEventListener('click', () => {
        openChallengeCreateModal();
      });
      pop.querySelectorAll('[data-giveup-ch]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const chId = btn.dataset.giveupCh;
          const ok = await askConfirm({
            title: 'Từ bỏ thử thách này?',
            message: 'Bạn có chắc muốn dừng thử thách này không?',
            confirmText: 'Give up',
            danger: true
          });
          if (!ok) return;
          const arr = ensureDayChallengesArray(iso);
          const target = arr.find(c => c.id === chId);
          if (target) target.gaveUp = true;
          saveState();
          updateRailBadges();
          showToast('Đã hủy thử thách.');
          renderPopover();
        });
      });
    };

    pop.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(pop);
    renderPopover();
  }

  // 2. FOCUS STREAK DRAWER
  function openStreakDrawer() {
    closePomoOverlays();
    const p = ensurePomoState();

    const backdrop = document.createElement('div');
    backdrop.className = 'pomo-drawer-backdrop pomo-dynamic-overlay';
    backdrop.addEventListener('click', closePomoOverlays);

    const drawer = document.createElement('div');
    drawer.className = 'pomo-left-drawer pomo-streak-drawer pomo-dynamic-overlay';

    function renderStreakContent() {
      const y = pomoRuntime.streakYear;
      const m = pomoRuntime.streakMonth;
      const todayISO = getTodayISO();
      const prefix = `${y}-${String(m + 1).padStart(2, '0')}-`;

      const monthSet = new Set();
      const now = new Date();
      for (let i = -6; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      Object.keys(p.dailyLogs || {}).forEach(iso => monthSet.add(iso.slice(0, 7)));
      monthSet.add(`${y}-${String(m + 1).padStart(2, '0')}`);
      const monthOptions = [...monthSet].sort().reverse();

      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const firstDow = new Date(y, m, 1).getDay();
      const leadingEmpties = firstDow === 0 ? 6 : firstDow - 1;

      let monthTotalSec = 0;
      let maxDaySec = 3600;
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${prefix}${String(d).padStart(2, '0')}`;
        const sec = p.dailyLogs[iso]?.seconds || 0;
        monthTotalSec += sec;
        if (sec > maxDaySec) maxDaySec = sec;
      }

      const mH = Math.floor(monthTotalSec / 3600);
      const mMin = Math.floor((monthTotalSec % 3600) / 60);

      let chAccepted = 0;
      let chCompleted = 0;
      Object.entries(p.challenges || {}).forEach(([iso, raw]) => {
        if (!iso.startsWith(prefix)) return;
        const items = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? [raw] : []);
        items.forEach(ch => {
          if (ch && ch.accepted) {
            chAccepted++;
            if (ch.completed) chCompleted++;
          }
        });
      });

      const { current, best } = computeStreaks();

      let cellsHtml = '';
      for (let i = 0; i < leadingEmpties; i++) cellsHtml += `<div class="pomo-day-cell empty"></div>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${prefix}${String(d).padStart(2, '0')}`;
        const sec = p.dailyLogs[iso]?.seconds || 0;
        const label = formatCalCellTime(sec);
        const barPct = sec > 0 ? Math.min(100, Math.max(8, Math.round((sec / maxDaySec) * 100))) : 0;
        const isToday = iso === todayISO;
        const isSel = iso === pomoRuntime.streakSelectedISO;

        cellsHtml += `
          <button type="button" class="pomo-day-cell ${sec > 0 ? 'has-time' : ''} ${isToday ? 'is-today' : ''} ${isSel && !isToday ? 'selected' : ''}" data-pick-day="${iso}">
            <span class="pdc-num">${isToday ? 'Today' : d}</span>
            <span class="pdc-val ${label ? '' : 'muted'}">${label || '—'}</span>
            ${sec > 0 ? `<div class="pdc-bar"><div class="pdc-bar-fill" style="width:${barPct}%;"></div></div>` : `<div style="height:3px;"></div>`}
          </button>`;
      }

      const selISO = pomoRuntime.streakSelectedISO;
      const selDate = parseDateISO(selISO);
      const selLog = p.dailyLogs[selISO] || { seconds: 0, sessions: 0 };
      const selH = Math.floor(selLog.seconds / 3600);
      const selM = Math.floor((selLog.seconds % 3600) / 60);
      const selDayLabel = `${EN_DAYS[selDate.getDay()]}, ${EN_MONTHS[selDate.getMonth()]} ${selDate.getDate()}`;
      const selShort = formatCalCellTime(selLog.seconds) || '0m';

      drawer.innerHTML = `
        <div class="pomo-drawer-head">
          <h2>Your focus</h2>
          <button type="button" class="btn-icon" data-close-overlay>✕</button>
        </div>

        <div class="pomo-month-nav">
          <button type="button" class="btn-icon" id="streak-prev-m">‹</button>
          <select class="pomo-month-select" id="streak-month-select">
            ${monthOptions.map(ym => {
              const [yy, mm] = ym.split('-').map(Number);
              const isCur = yy === y && (mm - 1) === m;
              return `<option value="${ym}" ${isCur ? 'selected' : ''}>${EN_MONTHS[mm - 1]} ${yy}</option>`;
            }).join('')}
          </select>
          <button type="button" class="btn-icon" id="streak-next-m">›</button>
        </div>

        <div class="pomo-month-total">${mH} h ${mMin} min <small>in total</small></div>

        <div class="pomo-cal-weekdays">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>

        <div class="pomo-cal-grid">${cellsHtml}</div>

        <div class="pomo-day-detail-box">
          <div class="pomo-day-detail-title">${selDayLabel} · ${selShort}</div>
          <div class="pomo-day-detail-sub">
            ${selLog.sessions} ${selLog.sessions === 1 ? 'session' : 'sessions'}, ${selH} h ${selM} min
          </div>
        </div>

        <div class="pomo-streak-stats-row">
          <div>
            <div class="pss-label">Current streak</div>
            <div class="pss-val">🔥 ${current} ${current === 1 ? 'day' : 'days'}</div>
          </div>
          <div>
            <div class="pss-label">Best streak</div>
            <div class="pss-val">${best} ${best === 1 ? 'day' : 'days'}</div>
          </div>
          <div>
            <div class="pss-label">Challenges this month</div>
            <div class="pss-val">
              <span>${chAccepted} <small>accepted</small></span>
              <span>${chCompleted} <small>completed</small></span>
            </div>
          </div>
        </div>

        <div style="font-size:12px;color:var(--text-dim);">
          One session, or 15 focused minutes, keeps your streak alive.
        </div>
      `;

      drawer.querySelector('[data-close-overlay]').addEventListener('click', closePomoOverlays);
      drawer.querySelector('#streak-prev-m').addEventListener('click', () => {
        const d = new Date(y, m - 1, 1);
        pomoRuntime.streakYear = d.getFullYear();
        pomoRuntime.streakMonth = d.getMonth();
        pomoRuntime.streakSelectedISO = formatDateISO(d);
        renderStreakContent();
      });
      drawer.querySelector('#streak-next-m').addEventListener('click', () => {
        const d = new Date(y, m + 1, 1);
        pomoRuntime.streakYear = d.getFullYear();
        pomoRuntime.streakMonth = d.getMonth();
        pomoRuntime.streakSelectedISO = formatDateISO(d);
        renderStreakContent();
      });
      drawer.querySelector('#streak-month-select').addEventListener('change', (e) => {
        const [yy, mm] = e.target.value.split('-').map(Number);
        pomoRuntime.streakYear = yy;
        pomoRuntime.streakMonth = mm - 1;
        pomoRuntime.streakSelectedISO = `${yy}-${String(mm).padStart(2, '0')}-01`;
        renderStreakContent();
      });
      drawer.querySelectorAll('[data-pick-day]').forEach(btn => {
        btn.addEventListener('click', () => {
          pomoRuntime.streakSelectedISO = btn.dataset.pickDay;
          renderStreakContent();
        });
      });
    }

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    renderStreakContent();
  }

  // 3. SETTINGS DRAWER
  function openSettingsDrawer() {
    closePomoOverlays();
    const p = ensurePomoState();
    const locked = pomoRuntime.running;

    const backdrop = document.createElement('div');
    backdrop.className = 'pomo-drawer-backdrop pomo-dynamic-overlay';
    backdrop.addEventListener('click', closePomoOverlays);

    const drawer = document.createElement('div');
    drawer.className = 'pomo-left-drawer pomo-dynamic-overlay';

    function renderDrawer() {
      drawer.innerHTML = `
        <div class="pomo-drawer-head">
          <h2>Settings</h2>
          <button type="button" class="btn-icon" id="btn-close-set-drawer">✕</button>
        </div>

        <div>
          <div class="pomo-set-section-lbl">Session lengths (chế độ Học bình thường · tối đa 1440p)</div>
          <div class="pomo-len-grid">
            <div class="pomo-len-col">
              <div class="pomo-len-col-title">Focus</div>
              <div class="pomo-len-pill ${locked ? 'locked' : ''}">
                <button type="button" class="pomo-step-btn" id="set-focus-minus">−</button>
                <div class="pomo-len-center">
                  <input type="number" class="pomo-len-input" id="set-focus-val" min="1" max="1440" value="${p.settings.focusMinutes}" />
                  <div style="font-size:10.5px;color:var(--text-dim);">min</div>
                </div>
                <button type="button" class="pomo-step-btn" id="set-focus-plus">+</button>
              </div>
            </div>

            <div class="pomo-len-col">
              <div class="pomo-len-col-title">Break</div>
              <div class="pomo-len-pill ${locked || p.settings.noBreak ? 'locked' : ''}">
                <button type="button" class="pomo-step-btn" id="set-break-minus">−</button>
                <div class="pomo-len-center">
                  <input type="number" class="pomo-len-input" id="set-break-val" min="1" max="1440" value="${p.settings.breakMinutes}" />
                  <div style="font-size:10.5px;color:var(--text-dim);">min</div>
                </div>
                <button type="button" class="pomo-step-btn" id="set-break-plus">+</button>
              </div>
            </div>
          </div>

          ${locked ? `
            <div class="pomo-lock-note">
              <span>🔒</span><span>Locked during the session. Stop the timer to change it.</span>
            </div>` : ''}
        </div>

        <div class="pomo-toggle-row">
          <span>Chế độ không nghỉ (bỏ qua Break)</span>
          <label class="pomo-switch">
            <input type="checkbox" id="set-nobreak-cb" ${p.settings.noBreak ? 'checked' : ''} />
            <span class="pomo-slider"></span>
          </label>
        </div>

        <button type="button" class="pomo-reset-counters-btn" id="btn-set-reset-counters">
          ↺ Reset current counters
        </button>

        <div style="border-top:1px solid var(--border);padding-top:14px;display:flex;flex-direction:column;gap:12px;">
          <div class="pomo-toggle-row">
            <span>🔔 Alarm (Soft Chime dịu tai)</span>
            <label class="pomo-switch">
              <input type="checkbox" id="set-alarm-cb" ${p.settings.alarmEnabled ? 'checked' : ''} />
              <span class="pomo-slider"></span>
            </label>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:5px;">
              <span>Volume</span>
              <span id="set-vol-label">${p.settings.alarmVolume}%</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="range" class="pomo-range" id="set-vol-range" min="0" max="100" value="${p.settings.alarmVolume}" />
              <button type="button" class="btn-ghost btn-sm" id="btn-test-alarm" style="white-space:nowrap;">Nghe thử</button>
            </div>
          </div>
        </div>

        <div style="border-top:1px solid var(--border);padding-top:14px;">
          <div class="pomo-toggle-row">
            <span>🖥 Desktop notifications</span>
            <label class="pomo-switch">
              <input type="checkbox" id="set-notif-cb" ${p.settings.desktopNotifications ? 'checked' : ''} />
              <span class="pomo-slider"></span>
            </label>
          </div>
        </div>
      `;

      drawer.querySelector('#btn-close-set-drawer').addEventListener('click', closePomoOverlays);

      const updateLen = (field, val) => {
        if (locked) return;
        const clamped = Math.max(1, Math.min(1440, parseInt(val, 10) || 1));
        p.settings[field] = clamped;
        saveState();
        if (pomoRuntime.appMode === 'normal') resetPomoToMode(pomoRuntime.mode);
        renderDrawer();
      };

      drawer.querySelector('#set-focus-minus').addEventListener('click', () => updateLen('focusMinutes', p.settings.focusMinutes - 5));
      drawer.querySelector('#set-focus-plus').addEventListener('click', () => updateLen('focusMinutes', p.settings.focusMinutes + 5));
      drawer.querySelector('#set-focus-val').addEventListener('change', (e) => updateLen('focusMinutes', e.target.value));

      drawer.querySelector('#set-break-minus').addEventListener('click', () => updateLen('breakMinutes', p.settings.breakMinutes - 1));
      drawer.querySelector('#set-break-plus').addEventListener('click', () => updateLen('breakMinutes', p.settings.breakMinutes + 1));
      drawer.querySelector('#set-break-val').addEventListener('change', (e) => updateLen('breakMinutes', e.target.value));

      drawer.querySelector('#set-nobreak-cb').addEventListener('change', (e) => {
        p.settings.noBreak = e.target.checked;
        saveState();
        renderDrawer();
      });

      drawer.querySelector('#btn-set-reset-counters').addEventListener('click', async () => {
        const ok = await askConfirm({
          title: 'Đặt lại bộ đếm phiên?',
          message: 'Số đếm Focus và Break trên thanh tiêu đề sẽ quay về 0 (không xóa lịch sử học).',
          confirmText: 'Đặt lại',
          danger: true
        });
        if (!ok) return;
        p.focusCount = 0;
        p.breakCount = 0;
        saveState();
        updatePomoTimerUI();
        showToast('Đã đặt lại bộ đếm phiên.');
      });

      drawer.querySelector('#set-alarm-cb').addEventListener('change', (e) => {
        p.settings.alarmEnabled = e.target.checked;
        saveState();
      });

      drawer.querySelector('#set-vol-range').addEventListener('input', (e) => {
        p.settings.alarmVolume = Number(e.target.value);
        drawer.querySelector('#set-vol-label').textContent = `${p.settings.alarmVolume}%`;
        saveState();
      });

      drawer.querySelector('#btn-test-alarm').addEventListener('click', () => playSoftAlarm());

      drawer.querySelector('#set-notif-cb').addEventListener('change', async (e) => {
        if (e.target.checked) {
          if (!('Notification' in window)) {
            e.target.checked = false;
            return showToast('Trình duyệt không hỗ trợ Desktop Notifications.');
          }
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            e.target.checked = false;
            return showToast('Bạn cần cấp quyền thông báo trên trình duyệt để bật.');
          }
          p.settings.desktopNotifications = true;
          saveState();
          showToast('Đã bật Desktop Notifications!');
        } else {
          p.settings.desktopNotifications = false;
          saveState();
        }
      });
    }

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    renderDrawer();
  }

  // 4. AESTHETICS DRAWER
  async function openAestheticsDrawer() {
    closePomoOverlays();
    const p = ensurePomoState();
    const savedBg = await loadWallpaperBlob();

    const backdrop = document.createElement('div');
    backdrop.className = 'pomo-drawer-backdrop pomo-dynamic-overlay';
    backdrop.addEventListener('click', closePomoOverlays);

    const drawer = document.createElement('div');
    drawer.className = 'pomo-left-drawer pomo-dynamic-overlay';
    drawer.innerHTML = `
      <div class="pomo-drawer-head">
        <h2>Aesthetics</h2>
        <button type="button" class="btn-icon" id="btn-close-aes-drawer">✕</button>
      </div>

      <div>
        <div class="pomo-set-section-lbl">Hình nền chất lượng gốc (Ảnh hoặc Video)</div>
        <div class="dropzone" id="pomo-bg-dropzone">
          <div class="dropzone-text">
            <strong>Kéo thả ảnh / video vào đây</strong><br/>
            hoặc <span class="dropzone-pick-link">chọn file từ máy tính</span>
          </div>
          <div class="dropzone-hint">Giữ nguyên 100% độ phân giải gốc (không nén), hỗ trợ file lớn · Khuyên dùng ảnh/video ngang 16:9 (1080p/4K).</div>
          <input type="file" id="pomo-bg-file-input" accept="image/*,video/*" hidden />
        </div>
        <div id="pomo-bg-status" style="font-size:12px;color:var(--accent-hover);margin-top:8px;">
          ${savedBg ? `Đang dùng: ${escapeHtml(savedBg.name || 'Custom background')} (${formatBytes(savedBg.size || savedBg.blob?.size || 0)})` : 'Đang dùng nền tối mặc định'}
        </div>
      </div>

      <div>
        <div class="pomo-set-section-lbl">Chế độ hiển thị hình nền</div>
        <div class="pomo-fit-pills">
          <button type="button" class="filter-pill ${p.settings.bgFit !== 'contain' ? 'active' : ''}" data-bg-fit="cover">Lấp đầy màn hình</button>
          <button type="button" class="filter-pill ${p.settings.bgFit === 'contain' ? 'active' : ''}" data-bg-fit="contain">Giữ nguyên tỉ lệ</button>
        </div>
      </div>

      <div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--text-muted);margin-bottom:6px;">
          <span>Độ tối lớp phủ nền (giúp rõ đồng hồ)</span>
          <span id="aes-dim-val">${p.settings.bgDim}%</span>
        </div>
        <input type="range" class="pomo-range" id="aes-dim-range" min="0" max="85" value="${p.settings.bgDim}" />
      </div>

      <button type="button" class="pomo-reset-counters-btn" id="btn-aes-reset-bg">
        ↺ Khôi phục nền tối mặc định
      </button>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    drawer.querySelector('#btn-close-aes-drawer').addEventListener('click', closePomoOverlays);

    const dropzone = drawer.querySelector('#pomo-bg-dropzone');
    const fileInput = drawer.querySelector('#pomo-bg-file-input');

    async function handleBgFile(file) {
      if (!file) return;
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        return showToast('Chỉ hỗ trợ file ảnh hoặc video!');
      }
      try {
        await saveWallpaperBlob(file);
        await applySavedWallpaper();
        drawer.querySelector('#pomo-bg-status').textContent = `Đang dùng: ${file.name} (${formatBytes(file.size)})`;
        showToast('Đã cập nhật hình nền chất lượng gốc!');
      } catch {
        showToast('Không thể lưu tệp nền này (có thể ổ đĩa trình duyệt đã đầy).');
      }
    }

    dropzone.addEventListener('click', () => fileInput.click());
    ['dragenter', 'dragover'].forEach(ev => {
      dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(ev => {
      dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
    });
    dropzone.addEventListener('drop', (e) => handleBgFile(e.dataTransfer?.files?.[0]));
    fileInput.addEventListener('change', (e) => { handleBgFile(e.target.files?.[0]); e.target.value = ''; });

    drawer.querySelectorAll('[data-bg-fit]').forEach(btn => {
      btn.addEventListener('click', () => {
        p.settings.bgFit = btn.dataset.bgFit;
        saveState();
        drawer.querySelectorAll('[data-bg-fit]').forEach(b => b.classList.toggle('active', b === btn));
        const bgLayer = document.getElementById('pomo-bg-layer');
        if (bgLayer) bgLayer.classList.toggle('fit-contain', p.settings.bgFit === 'contain');
      });
    });

    drawer.querySelector('#aes-dim-range').addEventListener('input', (e) => {
      p.settings.bgDim = Number(e.target.value);
      drawer.querySelector('#aes-dim-val').textContent = `${p.settings.bgDim}%`;
      saveState();
      const scrim = document.getElementById('pomo-bg-scrim');
      if (scrim) scrim.style.background = `rgba(10, 11, 16, ${p.settings.bgDim / 100})`;
    });

    drawer.querySelector('#btn-aes-reset-bg').addEventListener('click', async () => {
      const ok = await askConfirm({
        title: 'Khôi phục hình nền mặc định?',
        message: 'Ảnh hoặc video nền tùy chỉnh hiện tại sẽ được gỡ bỏ.',
        confirmText: 'Khôi phục',
        danger: true
      });
      if (!ok) return;
      await clearWallpaperBlob();
      await applySavedWallpaper();
      drawer.querySelector('#pomo-bg-status').textContent = 'Đang dùng nền tối mặc định';
      showToast('Đã khôi phục nền mặc định.');
    });
  }

  // ================= SYNC SIDEBAR IMMERSIVE MODE =================
  function setupImmersiveSidebarSync() {
    const shell = document.querySelector('.app-shell');
    const pomoView = document.getElementById('view-pomodoro');
    if (!shell || !pomoView) return;

    const syncMode = () => {
      const isPomoActive = pomoView.classList.contains('active');
      shell.classList.toggle('pomo-immersive', isPomoActive);
    };

    const observer = new MutationObserver(syncMode);
    observer.observe(pomoView, { attributes: true, attributeFilter: ['class'] });
    syncMode();
  }

  // ================= POPOVER MENUS =================
  function closeAllPopovers() {
    document.querySelectorAll('.pt-popover').forEach(el => el.remove());
  }

  function openPopover(anchorEl, html, onSelect) {
    closeAllPopovers();
    const pop = document.createElement('div');
    pop.className = 'pt-popover';
    pop.innerHTML = html;
    document.body.appendChild(pop);

    const rect = anchorEl.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + popRect.width > window.innerWidth - 10) left = window.innerWidth - popRect.width - 10;
    if (top + popRect.height > window.innerHeight - 10) top = rect.top - popRect.height - 6;
    pop.style.left = `${Math.max(8, left)}px`;
    pop.style.top = `${Math.max(8, top)}px`;

    pop.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(e, pop);
    });
  }

  function openStatusPopover(anchorEl, currentStatus, onPick) {
    const html = POMO_STATUSES.map(st => `
      <button type="button" class="pt-pop-item" data-pick-status="${st.key}">
        <span class="status-dot ${st.key}">${STATUS_SYMBOL[st.key] || ''}</span>
        <span>${st.label}</span>
        ${currentStatus === st.key ? '<span class="pt-pop-check">✓</span>' : ''}
      </button>
    `).join('');
    openPopover(anchorEl, html, (e) => {
      const btn = e.target.closest('[data-pick-status]');
      if (!btn) return;
      closeAllPopovers();
      onPick(btn.dataset.pickStatus);
    });
  }

  function openPriorityPopover(anchorEl, currentPriority, onPick) {
    const html = POMO_PRIORITIES.map(pr => `
      <button type="button" class="pt-pop-item" data-pick-prio="${pr.key}">
        <span style="color:${pr.color};font-family:'JetBrains Mono',monospace;width:24px;">${pr.icon}</span>
        <span>${pr.label}</span>
        ${currentPriority === pr.key ? '<span class="pt-pop-check">✓</span>' : ''}
      </button>
    `).join('');
    openPopover(anchorEl, html, (e) => {
      const btn = e.target.closest('[data-pick-prio]');
      if (!btn) return;
      closeAllPopovers();
      onPick(btn.dataset.pickPrio);
    });
  }

  function openLabelsPopover(anchorEl, selectedIds, onToggle) {
    const p = ensurePomoState();
    const renderItems = (q = '') => {
      const list = p.labels.filter(l => l.name.toLowerCase().includes(q.toLowerCase()));
      return list.length
        ? list.map(l => {
            const checked = selectedIds.includes(l.id);
            return `
              <button type="button" class="pt-pop-item" data-toggle-lbl="${l.id}">
                <span class="lbl-circle-check ${checked ? 'checked' : ''}">${checked ? '✓' : ''}</span>
                <span class="pt-label-dot" style="background:${l.color};width:9px;height:9px;"></span>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(l.name)}</span>
              </button>`;
          }).join('')
        : `<div style="padding:10px;text-align:center;color:var(--text-dim);font-size:12px;">Không tìm thấy nhãn nào</div>`;
    };

    const html = `
      <input type="text" class="pt-lbl-search" placeholder="Search labels..." style="margin-bottom:4px;padding:6px 9px;font-size:12.5px;" />
      <div class="pt-pop-header-lbl">LABELS</div>
      <div class="pt-lbl-items">${renderItems('')}</div>
      <div style="border-top:1px solid var(--border);margin-top:5px;padding-top:5px;">
        <button type="button" class="pt-pop-item" data-open-manage-labels="true" style="color:var(--accent-hover);">
          <span>⚙</span><span>Manage labels</span>
        </button>
      </div>`;

    openPopover(anchorEl, html, (e, pop) => {
      if (e.target.closest('[data-open-manage-labels]')) {
        closeAllPopovers();
        openManageLabelsModal();
        return;
      }
      const btn = e.target.closest('[data-toggle-lbl]');
      if (btn) {
        onToggle(btn.dataset.toggleLbl);
        const q = pop.querySelector('.pt-lbl-search').value;
        pop.querySelector('.pt-lbl-items').innerHTML = renderItems(q);
      }
    });

    const searchInp = document.querySelector('.pt-popover .pt-lbl-search');
    if (searchInp) {
      searchInp.addEventListener('input', () => {
        const pop = searchInp.closest('.pt-popover');
        pop.querySelector('.pt-lbl-items').innerHTML = renderItems(searchInp.value);
      });
      searchInp.focus();
    }
  }

  // ================= MANAGE LABELS MODAL =================
  function ensureManageLabelsModal() {
    if (document.getElementById('modal-pomo-labels')) return;
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="modal-backdrop hidden" id="modal-pomo-labels">
        <div class="modal-box">
          <div class="modal-header">
            <h2>Manage labels</h2>
            <button class="btn-icon" id="btn-close-pomo-labels">✕</button>
          </div>
          <div class="modal-body">
            <form id="form-add-pomo-label" style="display:flex;gap:8px;align-items:center;">
              <input type="text" id="input-new-pomo-label" placeholder="+ New label name..." required style="flex:1;" />
              <button type="submit" class="btn-primary btn-sm">Add</button>
            </form>
            <div id="pomo-labels-manage-list"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    document.getElementById('btn-close-pomo-labels').addEventListener('click', () => {
      document.getElementById('modal-pomo-labels').classList.add('hidden');
    });

    document.getElementById('form-add-pomo-label').addEventListener('submit', (e) => {
      e.preventDefault();
      const p = ensurePomoState();
      const inp = document.getElementById('input-new-pomo-label');
      const name = inp.value.trim();
      if (!name) return;
      const color = LABEL_COLORS[p.labels.length % LABEL_COLORS.length];
      p.labels.push({ id: 'lbl_' + uid(), name, color });
      inp.value = '';
      saveState();
      renderManageLabelsList();
      renderPomoTasksPanel();
    });

    document.getElementById('pomo-labels-manage-list').addEventListener('click', async (e) => {
      const del = e.target.closest('[data-del-pomo-lbl]');
      if (!del) return;
      const ok = await askConfirm({
        title: 'Xóa nhãn này?',
        message: 'Nhãn sẽ bị gỡ khỏi tất cả các task đang gắn nó.',
        confirmText: 'Xóa nhãn',
        danger: true
      });
      if (!ok) return;
      const p = ensurePomoState();
      const lid = del.dataset.delPomoLbl;
      p.labels = p.labels.filter(l => l.id !== lid);
      p.tasks.forEach(t => {
        t.labels = (t.labels || []).filter(x => x !== lid);
        (t.subtasks || []).forEach(st => { st.labels = (st.labels || []).filter(x => x !== lid); });
      });
      saveState();
      renderManageLabelsList();
      renderPomoTasksPanel();
    });
  }

  function renderManageLabelsList() {
    const p = ensurePomoState();
    const wrap = document.getElementById('pomo-labels-manage-list');
    if (!p.labels.length) {
      wrap.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-dim);">Chưa có nhãn nào.</div>`;
      return;
    }
    wrap.innerHTML = p.labels.map(l => {
      let count = 0;
      p.tasks.forEach(t => {
        if ((t.labels || []).includes(l.id)) count++;
        (t.subtasks || []).forEach(st => { if ((st.labels || []).includes(l.id)) count++; });
      });
      return `
        <div class="label-manage-row">
          <span class="pt-label-dot" style="background:${l.color};width:10px;height:10px;"></span>
          <span style="flex:1;font-weight:500;">${escapeHtml(l.name)}</span>
          <span style="font-size:12px;color:var(--text-dim);">${count} tasks</span>
          <button type="button" class="btn-icon danger-icon" data-del-pomo-lbl="${l.id}" title="Xóa nhãn">✕</button>
        </div>`;
    }).join('');
  }

  function openManageLabelsModal() {
    renderManageLabelsList();
    document.getElementById('modal-pomo-labels').classList.remove('hidden');
  }

  // ================= RENDER POMODORO SHELL =================
  function renderPomoShell() {
    const view = document.getElementById('view-pomodoro');
    if (!view) return;
    ensurePomoState();
    ensureManageLabelsModal();

    view.innerHTML = `
      <div class="pomo-bg-layer" id="pomo-bg-layer"></div>
      <div class="pomo-bg-scrim" id="pomo-bg-scrim"></div>

      <div class="pomo-layout">
        <div class="pomo-topbar">
          <button type="button" class="pomo-menu-toggle" id="btn-pomo-toggle-sidebar" title="Hiện / Ẩn thanh menu chính">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span class="pomo-brand-label" id="pomo-brand-label">Pomodoro Timer</span>
        </div>

        <!-- LEFT FLOATING RAIL -->
        <div class="pomo-left-rail">
          <button type="button" class="pomo-rail-btn" id="btn-pomo-challenge" title="Today's challenge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
            <span class="pomo-rail-sub hidden" id="pomo-rail-challenge-sub"></span>
          </button>

          <button type="button" class="pomo-rail-btn" id="btn-pomo-streak" title="Focus streak">
            <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
            </svg>
            <span class="pomo-rail-sub" id="pomo-rail-streak-num">0</span>
          </button>

          <div class="pomo-rail-divider"></div>

          <button type="button" class="pomo-rail-btn" id="btn-pomo-aesthetics" title="Aesthetics (Ảnh / Video nền)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
            </svg>
          </button>

          <button type="button" class="pomo-rail-btn" id="btn-pomo-settings" title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>

        <!-- CENTER TIMER STAGE -->
        <div class="pomo-stage">
          <div class="pomo-stage-top">
            <!-- 2-MODE SWITCHER -->
            <div class="pomo-appmode-switch">
              <button type="button" class="pomo-appmode-btn active" data-app-mode="normal">Học bình thường</button>
              <button type="button" class="pomo-appmode-btn" data-app-mode="exam">Thi thật</button>
            </div>

            <!-- NORMAL MODE TABS -->
            <div class="pomo-mode-tabs" id="pomo-normal-tabs">
              <button type="button" class="pomo-mode-btn active" data-pomo-mode="focus">
                <span>Focus</span>
                <span class="pomo-mode-count" id="pomo-focus-count">0</span>
              </button>
              <button type="button" class="pomo-mode-btn" data-pomo-mode="break">
                <span>Break</span>
                <span class="pomo-mode-count" id="pomo-break-count">0</span>
              </button>
            </div>

            <!-- EXAM MODE PRESETS -->
            <div class="pomo-mode-tabs hidden" id="pomo-exam-tabs">
              ${EXAM_PRESETS.map(pr => `
                <button type="button" class="pomo-mode-btn exam-preset ${pr.key === 'hsg' ? 'active' : ''}" data-exam-preset="${pr.key}">
                  <span>${pr.label}</span>
                </button>
              `).join('')}
            </div>

            <!-- EXAM META BAR -->
            <div class="pomo-exam-meta-bar hidden" id="pomo-exam-meta-bar">
              <input type="text" id="pomo-exam-name" class="pomo-exam-name-input" placeholder="Nhập tên đề đang làm (tùy chọn)..." />
              <div class="pomo-exam-custom-wrap hidden" id="pomo-exam-custom-wrap">
                <input type="number" id="pomo-exam-custom-mins" class="pomo-exam-custom-input" min="1" max="360" value="60" />
                <span>phút</span>
              </div>
              <div class="pomo-exam-alerts">
                <label class="check-inline">
                  <input type="checkbox" id="pomo-exam-alert15" checked />
                  <span>Nhắc 15p</span>
                </label>
                <label class="check-inline">
                  <input type="checkbox" id="pomo-exam-alert5" checked />
                  <span>Nhắc 5p</span>
                </label>
              </div>
            </div>
          </div>

          <div class="pomo-center-wrap">
            <div class="pomo-ring-box">
              <svg class="pomo-svg" viewBox="0 0 360 360">
                <circle class="pomo-ring-bg" cx="180" cy="180" r="162" />
                <circle class="pomo-ring-progress" id="pomo-ring-progress" cx="180" cy="180" r="162" />
              </svg>
              <div class="pomo-ring-inner">
                <div class="pomo-clock" id="pomo-clock-display">60:00</div>
                <div class="pomo-session-pill">
                  <span class="pomo-session-dot" id="pomo-session-dot"></span>
                  <span class="pomo-session-text" id="pomo-session-text">Focus session</span>
                  <button type="button" class="pomo-clear-focus hidden" id="btn-pomo-clear-focus" title="Bỏ chọn task">✕</button>
                </div>
              </div>
            </div>

            <div class="pomo-quick-actions">
              <button type="button" class="pomo-mini-action hidden" id="btn-pomo-finish-early">✓ Lưu & Xong sớm</button>
              <button type="button" class="pomo-mini-action submit-exam-btn hidden" id="btn-pomo-exam-submit">✓ Nộp bài & Lưu điểm</button>
            </div>

            <p class="pomo-quote" id="pomo-quote-text" title="Nhấn để đổi câu trích dẫn">${POMO_QUOTES[0]}</p>
          </div>

          <div class="pomo-dock">
            <button type="button" class="pomo-dock-btn" id="btn-pomo-music" title="Nhạc nền YouTube">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
              <span>Music</span>
            </button>

            <button type="button" class="pomo-dock-btn icon-only" id="btn-pomo-stop" title="Dừng phiên hiện tại">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="3"/>
              </svg>
            </button>

            <button type="button" class="pomo-start-btn" id="btn-pomo-toggle">Start</button>

            <button type="button" class="pomo-dock-btn icon-only" data-placeholder-btn="Picture-in-Picture" title="Cửa sổ nổi (sắp thêm)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="14" rx="2"/><rect x="12" y="10" width="7" height="6" rx="1"/>
              </svg>
            </button>

            <button type="button" class="pomo-dock-btn active" id="btn-pomo-toggle-tasks" title="Ẩn / Hiện bảng Tasks">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 6h10"/><path d="M10 12h10"/><path d="M10 18h10"/>
                <path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/>
              </svg>
              <span>Tasks</span>
            </button>
          </div>
        </div>

        <aside class="pomo-tasks-panel" id="pomo-tasks-panel"></aside>
      </div>

      <div class="pomo-now-playing" id="pomo-now-playing"><div class="pomo-now-track"><span id="pomo-now-text"></span></div></div>
      <div class="pomo-zen-reveal" id="pomo-zen-reveal">
        <button type="button" class="pomo-zen-arrow" id="btn-pomo-zen-reveal" title="Hiện lại menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"/></svg>
        </button>
      </div>
    `;

    bindPomoStageEvents();
    setupZenMode();
    setupImmersiveSidebarSync();
    if (hasTimerProgress()) updatePomoTimerUI();
    else if (!restorePomoSession()) resetPomoToMode('focus');
    renderPomoTasksPanel();
    applySavedWallpaper();
  }

  // ================= TASKS PANEL =================
  function renderPomoTasksPanel() {
    const panel = document.getElementById('pomo-tasks-panel');
    if (!panel) return;
    panel.classList.toggle('collapsed', !pomoRuntime.panelOpen);

    const p = ensurePomoState();

    let totalCount = 0;
    let doneCount = 0;
    p.tasks.forEach(t => {
      totalCount++;
      if (t.status === 'done') doneCount++;
      (t.subtasks || []).forEach(st => {
        totalCount++;
        if (st.status === 'done') doneCount++;
      });
    });
    const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

    const headerHtml = `
      <div class="pt-header">
        <h2>Tasks</h2>
        <div class="pt-header-actions">
          <button type="button" class="btn-icon" id="pt-btn-search" title="Tìm kiếm">🔍</button>
          <button type="button" class="btn-icon" id="pt-btn-labels" title="Quản lý nhãn">🏷</button>
          <button type="button" class="btn-icon" id="pt-btn-close" title="Thu gọn bảng">✕</button>
        </div>
      </div>
      <div class="pt-progress-wrap">
        <div class="pt-progress-track"><div class="pt-progress-fill" style="width:${pct}%;"></div></div>
        <span class="pt-progress-text">${doneCount}/${totalCount}</span>
      </div>
      ${pomoRuntime.showSearch ? `
        <div class="pt-search-bar">
          <input type="text" id="pt-search-input" value="${escapeHtml(pomoRuntime.searchQuery)}" placeholder="Tìm task / chuyên đề..." style="flex:1;" />
          <select id="pt-filter-label" style="width:105px;">
            <option value="all">Tất cả nhãn</option>
            ${p.labels.map(l => `<option value="${l.id}" ${pomoRuntime.filterLabel === l.id ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}
          </select>
        </div>` : ''}
    `;

    const bodyHtml = pomoRuntime.selectedTaskId ? buildDetailViewHtml(p) : buildListViewHtml(p);
    panel.innerHTML = `${headerHtml}<div class="pt-body">${bodyHtml}</div>`;
    bindPomoPanelEvents();
  }

  function renderLabelBadges(labelIds = [], allLabels = []) {
    return labelIds.map(id => {
      const l = allLabels.find(x => x.id === id);
      if (!l) return '';
      return `<span class="pt-label-pill"><span class="pt-label-dot" style="background:${l.color};"></span>${escapeHtml(l.name)}</span>`;
    }).join('');
  }

  function buildListViewHtml(p) {
    const q = pomoRuntime.searchQuery.trim().toLowerCase();
    const fl = pomoRuntime.filterLabel;

    let list = p.tasks.filter(t => {
      const matchQ = !q || t.title.toLowerCase().includes(q) || (t.subtasks || []).some(s => s.title.toLowerCase().includes(q));
      const matchL = fl === 'all' || (t.labels || []).includes(fl);
      return matchQ && matchL;
    });

    const openTasks = list.filter(t => t.status !== 'done' && t.status !== 'canceled');
    const closedTasks = list.filter(t => t.status === 'done' || t.status === 'canceled');

    const d = pomoRuntime.composerDraft;
    const prObj = POMO_PRIORITIES.find(x => x.key === d.priority) || POMO_PRIORITIES[0];

    const composerHtml = pomoRuntime.composerOpen ? `
      <div class="pt-composer">
        <div class="pt-composer-top">
          <input type="text" id="pt-new-title" class="pt-composer-title" value="${escapeHtml(d.title || '')}" placeholder="New task..." />
          <button type="button" class="btn-icon" id="pt-cancel-composer" style="width:24px;height:24px;font-size:12px;">✕</button>
        </div>
        <div class="pt-props-grid">
          <button type="button" class="pt-prop-btn" id="pt-comp-status">
            <span class="status-dot ${d.status}">${STATUS_SYMBOL[d.status] || ''}</span>
            <span>${STATUS_LABELS[d.status]}</span>
          </button>
          <button type="button" class="pt-prop-btn" id="pt-comp-priority">
            <span style="color:${prObj.color};font-family:'JetBrains Mono',monospace;">${prObj.icon}</span>
            <span>${prObj.key === 'none' ? 'Priority' : prObj.label}</span>
          </button>
          <label class="pt-prop-btn" style="cursor:pointer;">
            <span>📅</span>
            <input type="date" id="pt-comp-due" value="${d.dueDate || ''}" style="background:transparent;border:none;padding:0;font-size:11.5px;width:100%;" />
          </label>
          <button type="button" class="pt-prop-btn" id="pt-comp-labels">
            <span>🏷</span>
            <span>${d.labels.length ? `${d.labels.length} labels` : 'Labels'}</span>
          </button>
        </div>
        ${d.labels.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;">${renderLabelBadges(d.labels, p.labels)}</div>` : ''}
        <div class="pt-composer-footer">
          <label class="check-inline" style="font-size:12px;color:var(--text-muted);">
            <input type="checkbox" id="pt-comp-addmore" ${d.addMore ? 'checked' : ''} />
            <span>Add more</span>
          </label>
          <button type="button" class="btn-primary btn-sm" id="pt-comp-submit">Add</button>
        </div>
      </div>` : `
      <button type="button" class="pt-add-trigger" id="pt-open-composer">
        <span>+</span><span>Add task</span>
      </button>`;

    const renderRow = (t, isClosed = false) => {
      const totalSec = getTaskTotalSeconds(t);
      const subCount = (t.subtasks || []).length;
      const isFocusing = p.activeFocus?.taskId === t.id && !p.activeFocus?.subtaskId;
      return `
        <div class="pt-task-row ${isClosed ? 'is-closed' : ''} ${isFocusing ? 'is-focusing' : ''}" data-open-task="${t.id}">
          <span class="status-dot ${t.status}" data-row-status="${t.id}" title="Đổi trạng thái">${STATUS_SYMBOL[t.status] || ''}</span>
          <div class="pt-task-main">
            <div class="pt-task-name">${escapeHtml(t.title)}</div>
            <div class="pt-task-submeta">
              ${subCount ? `<span class="pt-sub-pill">${subCount} ${subCount === 1 ? 'subtask' : 'subtasks'}</span>` : ''}
              ${renderLabelBadges(t.labels || [], p.labels)}
            </div>
          </div>
          ${totalSec > 0 ? `<span class="pt-task-time">${formatDurationShort(totalSec)}</span>` : ''}
          <span class="pt-task-chevron">›</span>
        </div>`;
    };

    return `
      ${composerHtml}
      ${openTasks.map(t => renderRow(t, false)).join('')}
      ${closedTasks.length ? `
        <button type="button" class="pt-closed-toggle" id="pt-toggle-closed">
          ${pomoRuntime.showClosedTasks ? '▾' : '›'} Show closed (${closedTasks.length})
        </button>
        ${pomoRuntime.showClosedTasks ? closedTasks.map(t => renderRow(t, true)).join('') : ''}
      ` : ''}
    `;
  }

  function buildDetailViewHtml(p) {
    const task = p.tasks.find(x => x.id === pomoRuntime.selectedTaskId);
    if (!task) { pomoRuntime.selectedTaskId = null; return buildListViewHtml(p); }

    const isSub = Boolean(pomoRuntime.selectedSubtaskId);
    const sub = isSub ? (task.subtasks || []).find(s => s.id === pomoRuntime.selectedSubtaskId) : null;
    if (isSub && !sub) { pomoRuntime.selectedSubtaskId = null; return buildDetailViewHtml(p); }

    const item = isSub ? sub : task;
    const isFocusing = isSub
      ? (p.activeFocus?.taskId === task.id && p.activeFocus?.subtaskId === sub.id)
      : (p.activeFocus?.taskId === task.id && !p.activeFocus?.subtaskId);

    const prObj = POMO_PRIORITIES.find(x => x.key === (item.priority || 'none')) || POMO_PRIORITIES[0];

    let timeSummary = '';
    if (isSub) {
      timeSummary = `${formatDurationShort(sub.seconds || 0)} đã học cho mục này`;
    } else {
      const subSum = (task.subtasks || []).reduce((a, s) => a + (s.seconds || 0), 0);
      const total = (task.directSeconds || 0) + subSum;
      timeSummary = `${formatDurationShort(total)} total · ${formatDurationShort(task.directSeconds || 0)} here + ${formatDurationShort(subSum)} across ${(task.subtasks || []).length} subtasks`;
    }

    const openSubs = !isSub ? (task.subtasks || []).filter(s => s.status !== 'done' && s.status !== 'canceled') : [];
    const closedSubs = !isSub ? (task.subtasks || []).filter(s => s.status === 'done' || s.status === 'canceled') : [];

    const renderSubRow = (st, isClosed = false) => {
      const subFocusing = p.activeFocus?.taskId === task.id && p.activeFocus?.subtaskId === st.id;
      return `
        <div class="pt-task-row ${isClosed ? 'is-closed' : ''} ${subFocusing ? 'is-focusing' : ''}" data-open-sub="${st.id}">
          <span class="status-dot ${st.status}" data-sub-status="${st.id}" title="Đổi trạng thái">${STATUS_SYMBOL[st.status] || ''}</span>
          <div class="pt-task-main">
            <div class="pt-task-name">${escapeHtml(st.title)}</div>
          </div>
          ${(st.seconds || 0) > 0 ? `<span class="pt-task-time">${formatDurationShort(st.seconds)}</span>` : ''}
          <span class="pt-task-chevron">›</span>
        </div>`;
    };

    return `
      <div class="pt-detail-nav">
        <button type="button" class="pt-back-btn" id="pt-detail-back">
          ‹ Back <span style="color:var(--text-dim);font-weight:400;">${isSub ? escapeHtml(task.title) : 'Tasks'}</span>
        </button>
        <button type="button" class="btn-icon danger-icon" id="pt-detail-delete" title="Xóa">🗑</button>
      </div>

      <div class="pt-detail-card">
        <input type="text" class="pt-detail-title-input" id="pt-detail-title" value="${escapeHtml(item.title)}" />
        <button type="button" class="pt-focus-btn ${isFocusing ? 'active' : ''}" id="pt-btn-focus-this">
          ${isFocusing ? '● Đang Focus mục này' : 'Focus'}
        </button>
        <div class="pt-time-breakdown">${timeSummary}</div>

        <div class="pt-props-grid">
          <button type="button" class="pt-prop-btn" id="pt-det-status">
            <span class="status-dot ${item.status}">${STATUS_SYMBOL[item.status] || ''}</span>
            <span>${STATUS_LABELS[item.status]}</span>
          </button>
          <button type="button" class="pt-prop-btn" id="pt-det-priority">
            <span style="color:${prObj.color};font-family:'JetBrains Mono',monospace;">${prObj.icon}</span>
            <span>${prObj.key === 'none' ? 'Priority' : prObj.label}</span>
          </button>
          <label class="pt-prop-btn" style="cursor:pointer;">
            <span>📅</span>
            <input type="date" id="pt-det-due" value="${item.dueDate || ''}" style="background:transparent;border:none;padding:0;font-size:11.5px;width:100%;" />
          </label>
          <button type="button" class="pt-prop-btn" id="pt-det-labels">
            <span>🏷</span>
            <span>${(item.labels || []).length ? `${item.labels.length} labels` : 'Labels'}</span>
          </button>
        </div>
        ${(item.labels || []).length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;">${renderLabelBadges(item.labels, p.labels)}</div>` : ''}
      </div>

      <textarea class="pt-notes-box" id="pt-detail-notes" placeholder="+ Add notes">${escapeHtml(item.notes || '')}</textarea>

      ${!isSub ? `
        <div class="pt-section-divider">SUBTASKS</div>
        ${openSubs.map(st => renderSubRow(st, false)).join('')}
        ${closedSubs.length ? `
          <button type="button" class="pt-closed-toggle" id="pt-toggle-closed-subs">
            ${pomoRuntime.showClosedSubs ? '▾' : '›'} Show closed (${closedSubs.length})
          </button>
          ${pomoRuntime.showClosedSubs ? closedSubs.map(st => renderSubRow(st, true)).join('') : ''}
        ` : ''}
        <form class="pt-add-sub-form" id="pt-add-sub-form">
          <input type="text" id="pt-new-sub-title" placeholder="+ Add a subtask..." required />
          <button type="submit" class="btn-ghost btn-sm">Add</button>
        </form>
      ` : ''}
    `;
  }

  // ================= ZEN MODE (tự ẩn UI khi đang chạy timer) =================
  const ZEN_IDLE_MS = 5000;
  let zenTimerId = null;
  function setupZenMode() {
    const view = document.getElementById('view-pomodoro');
    if (!view) return;
    if (zenTimerId) clearInterval(zenTimerId);
    let lastActive = Date.now();
    let wasRunning = false;
    const updateScale = () => {
      const ring = view.querySelector('.pomo-ring-box');
      const wrap = view.querySelector('.pomo-center-wrap');
      if (!ring || !wrap) return;
      const baseH = wrap.offsetHeight || 440;
      const byH = (view.clientHeight - 110) / baseH;
      const byW = (view.clientWidth - 40) / (ring.offsetWidth || 360);
      const sc = Math.max(1, Math.min(1.3, byH, byW));
      view.style.setProperty('--zen-scale', sc.toFixed(3));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    const setZen = (on) => {
      if (on) updateScale();
      view.classList.toggle('pomo-zen', on);
      if (on) closeAllPopovers();
      if (on && window.StudyMusic) window.StudyMusic.closePanel();
      window.dispatchEvent(new CustomEvent('pomo:zen', { detail: { on } }));
    };
    const poke = () => { if (!view.classList.contains('pomo-zen')) lastActive = Date.now(); };
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'input'].forEach(ev =>
      view.addEventListener(ev, poke, { passive: true }));
    // Popover/panel nhạc nằm ngoài view -> cũng tính là hoạt động
    document.addEventListener('mousemove', (e) => {
      if (e.target.closest && e.target.closest('.music-panel')) poke();
    }, { passive: true });
    document.getElementById('btn-pomo-zen-reveal').addEventListener('click', (e) => {
      e.stopPropagation();
      lastActive = Date.now();
      setZen(false);
    });
    zenTimerId = setInterval(() => {
      const active = view.classList.contains('active');
      const running = active && pomoRuntime.running;
      if (!running) {
        if (view.classList.contains('pomo-zen')) setZen(false);
        wasRunning = false;
        return;
      }
      if (!wasRunning) { wasRunning = true; lastActive = Date.now(); }
      if (!view.classList.contains('pomo-zen') && Date.now() - lastActive >= ZEN_IDLE_MS) setZen(true);
    }, 500);
  }

  // ================= EVENT BINDINGS =================
  function bindPomoStageEvents() {
    document.getElementById('btn-pomo-toggle-sidebar').addEventListener('click', () => {
      document.querySelector('.app-shell')?.classList.toggle('pomo-immersive');
    });

    // Switch Học bình thường <-> Thi thật
    document.querySelectorAll('.pomo-appmode-btn').forEach(btn => {
      btn.addEventListener('click', () => switchAppMode(btn.dataset.appMode));
    });

    // Left rail
    document.getElementById('btn-pomo-challenge').addEventListener('click', (e) => {
      e.stopPropagation();
      openChallengeUI(e.currentTarget);
    });
    document.getElementById('btn-pomo-streak').addEventListener('click', (e) => {
      e.stopPropagation();
      openStreakDrawer();
    });
    document.getElementById('btn-pomo-aesthetics').addEventListener('click', (e) => {
      e.stopPropagation();
      openAestheticsDrawer();
    });
    document.getElementById('btn-pomo-settings').addEventListener('click', (e) => {
      e.stopPropagation();
      openSettingsDrawer();
    });

    document.getElementById('btn-pomo-music')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.StudyMusic) window.StudyMusic.toggle(e.currentTarget);
      else showToast('Trình phát nhạc chưa sẵn sàng.');
    });

    document.querySelectorAll('[data-placeholder-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        showToast(`Tính năng "${btn.dataset.placeholderBtn}" sẽ được bổ sung ở bước tiếp theo.`);
      });
    });

    // Normal mode Focus / Break tabs
    document.querySelectorAll('#pomo-normal-tabs .pomo-mode-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetMode = btn.dataset.pomoMode;
        if (targetMode === pomoRuntime.mode) return;
        if (hasTimerProgress()) {
          const ok = await askConfirm({
            title: `Chuyển sang ${targetMode === 'focus' ? 'Focus' : 'Break'}?`,
            message: 'Phiên hiện tại sẽ dừng lại (giờ đã học sẽ được lưu). Tiếp tục?',
            confirmText: 'Chuyển chế độ'
          });
          if (!ok) return;
        }
        resetPomoToMode(targetMode);
        renderPomoTasksPanel();
      });
    });

    // Exam mode presets
    document.querySelectorAll('#pomo-exam-tabs .pomo-mode-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const presetKey = btn.dataset.examPreset;
        if (presetKey === pomoRuntime.examSubject) return;
        if (hasTimerProgress()) {
          const ok = await askConfirm({
            title: 'Đổi môn thi?',
            message: 'Phiên thi hiện tại đang chạy dở. Đổi môn sẽ lưu thời gian đã làm và đặt lại đồng hồ.',
            confirmText: 'Đổi môn',
            danger: true
          });
          if (!ok) return;
        }
        pomoRuntime.examSubject = presetKey;
        resetExamTimer();
      });
    });

    // Exam meta bar inputs
    document.getElementById('pomo-exam-name').addEventListener('input', (e) => {
      pomoRuntime.examName = e.target.value;
      updatePomoTimerUI();
    });
    document.getElementById('pomo-exam-custom-mins').addEventListener('change', async (e) => {
      const val = Math.max(1, Math.min(360, parseInt(e.target.value, 10) || 60));
      e.target.value = val;
      if (pomoRuntime.running) {
        const ok = await askConfirm({
          title: 'Đổi thời gian thi?',
          message: 'Đồng hồ đang chạy. Đổi số phút sẽ đặt lại đồng hồ từ đầu.',
          confirmText: 'Đặt lại',
          danger: true
        });
        if (!ok) return;
      }
      pomoRuntime.examCustomMins = val;
      resetExamTimer();
    });
    document.getElementById('pomo-exam-alert15').addEventListener('change', (e) => {
      pomoRuntime.examAlert15 = e.target.checked;
    });
    document.getElementById('pomo-exam-alert5').addEventListener('change', (e) => {
      pomoRuntime.examAlert5 = e.target.checked;
    });

    // Bottom dock & quick actions
    document.getElementById('btn-pomo-toggle').addEventListener('click', togglePomoTimer);
    document.getElementById('btn-pomo-stop').addEventListener('click', stopPomoSession);
    document.getElementById('btn-pomo-exam-submit').addEventListener('click', submitExamAndOpenModal);

    document.getElementById('btn-pomo-finish-early').addEventListener('click', async () => {
      const ok = await askConfirm({
        title: 'Hoàn thành phiên sớm?',
        message: 'Lưu toàn bộ thời gian đã học vào Task đang chọn và tính là 1 phiên hoàn thành?',
        confirmText: 'Hoàn thành'
      });
      if (!ok) return;
      const p = ensurePomoState();
      stopPomoInterval();
      if (pomoRuntime.mode === 'focus') {
        recordCompletedFocusSession(true);
        resetPomoToMode(p.settings.noBreak ? 'focus' : 'break');
      } else {
        p.breakCount += 1;
        saveState();
        resetPomoToMode('focus');
      }
      renderPomoTasksPanel();
      showToast('Đã lưu thời gian học!');
    });

    document.getElementById('btn-pomo-clear-focus').addEventListener('click', () => {
      flushUnsavedSeconds();
      state.pomodoro.activeFocus = null;
      saveState();
      updatePomoTimerUI();
      renderPomoTasksPanel();
    });

    document.getElementById('btn-pomo-toggle-tasks').addEventListener('click', (e) => {
      pomoRuntime.panelOpen = !pomoRuntime.panelOpen;
      e.currentTarget.classList.toggle('active', pomoRuntime.panelOpen);
      renderPomoTasksPanel();
    });

    document.getElementById('pomo-quote-text').addEventListener('click', (e) => {
      pomoRuntime.quoteIdx = (pomoRuntime.quoteIdx + 1) % POMO_QUOTES.length;
      e.currentTarget.textContent = POMO_QUOTES[pomoRuntime.quoteIdx];
    });
  }

  function bindPomoPanelEvents() {
    const p = ensurePomoState();
    const panel = document.getElementById('pomo-tasks-panel');
    if (!panel) return;

    document.getElementById('pt-btn-search')?.addEventListener('click', () => {
      pomoRuntime.showSearch = !pomoRuntime.showSearch;
      renderPomoTasksPanel();
    });
    document.getElementById('pt-btn-labels')?.addEventListener('click', openManageLabelsModal);
    document.getElementById('pt-btn-close')?.addEventListener('click', () => {
      pomoRuntime.panelOpen = false;
      document.getElementById('btn-pomo-toggle-tasks')?.classList.remove('active');
      renderPomoTasksPanel();
    });

    document.getElementById('pt-search-input')?.addEventListener('input', (e) => {
      pomoRuntime.searchQuery = e.target.value;
      renderPomoTasksPanel();
      const inp = document.getElementById('pt-search-input');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    });
    document.getElementById('pt-filter-label')?.addEventListener('change', (e) => {
      pomoRuntime.filterLabel = e.target.value;
      renderPomoTasksPanel();
    });

    document.getElementById('pt-open-composer')?.addEventListener('click', () => {
      pomoRuntime.composerOpen = true;
      renderPomoTasksPanel();
      document.getElementById('pt-new-title')?.focus();
    });
    document.getElementById('pt-cancel-composer')?.addEventListener('click', () => {
      pomoRuntime.composerOpen = false;
      pomoRuntime.composerDraft = { title: '', status: 'todo', priority: 'none', dueDate: '', labels: [], addMore: false };
      renderPomoTasksPanel();
    });

    document.getElementById('pt-new-title')?.addEventListener('input', (e) => { pomoRuntime.composerDraft.title = e.target.value; });
    document.getElementById('pt-comp-addmore')?.addEventListener('change', (e) => { pomoRuntime.composerDraft.addMore = e.target.checked; });

    document.getElementById('pt-comp-status')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openStatusPopover(e.currentTarget, pomoRuntime.composerDraft.status, (st) => {
        pomoRuntime.composerDraft.status = st;
        renderPomoTasksPanel();
      });
    });
    document.getElementById('pt-comp-priority')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openPriorityPopover(e.currentTarget, pomoRuntime.composerDraft.priority, (pr) => {
        pomoRuntime.composerDraft.priority = pr;
        renderPomoTasksPanel();
      });
    });
    document.getElementById('pt-comp-due')?.addEventListener('change', (e) => { pomoRuntime.composerDraft.dueDate = e.target.value; });
    document.getElementById('pt-comp-labels')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openLabelsPopover(e.currentTarget, pomoRuntime.composerDraft.labels, (lid) => {
        const arr = pomoRuntime.composerDraft.labels;
        const idx = arr.indexOf(lid);
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push(lid);
        renderPomoTasksPanel();
      });
    });

    const submitNewTask = () => {
      const title = (pomoRuntime.composerDraft.title || '').trim();
      if (!title) return;
      const addMore = Boolean(pomoRuntime.composerDraft.addMore);
      p.tasks.push({
        id: 'pt_' + uid(),
        title,
        status: pomoRuntime.composerDraft.status,
        priority: pomoRuntime.composerDraft.priority,
        dueDate: pomoRuntime.composerDraft.dueDate,
        labels: [...pomoRuntime.composerDraft.labels],
        notes: '',
        directSeconds: 0,
        subtasks: []
      });
      saveState();
      if (addMore) pomoRuntime.composerDraft.title = '';
      else {
        pomoRuntime.composerOpen = false;
        pomoRuntime.composerDraft = { title: '', status: 'todo', priority: 'none', dueDate: '', labels: [], addMore: false };
      }
      renderPomoTasksPanel();
      if (addMore) document.getElementById('pt-new-title')?.focus();
    };

    document.getElementById('pt-comp-submit')?.addEventListener('click', submitNewTask);
    document.getElementById('pt-new-title')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submitNewTask(); }
    });

    document.getElementById('pt-toggle-closed')?.addEventListener('click', () => {
      pomoRuntime.showClosedTasks = !pomoRuntime.showClosedTasks;
      renderPomoTasksPanel();
    });

    panel.querySelectorAll('[data-row-status]').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = p.tasks.find(x => x.id === dot.dataset.rowStatus);
        if (!t) return;
        openStatusPopover(dot, t.status, (st) => {
          t.status = st;
          saveState();
          renderPomoTasksPanel();
        });
      });
    });

    panel.querySelectorAll('[data-open-task]').forEach(row => {
      row.addEventListener('click', () => {
        pomoRuntime.selectedTaskId = row.dataset.openTask;
        pomoRuntime.selectedSubtaskId = null;
        renderPomoTasksPanel();
      });
    });

    if (pomoRuntime.selectedTaskId) {
      const task = p.tasks.find(x => x.id === pomoRuntime.selectedTaskId);
      const isSub = Boolean(pomoRuntime.selectedSubtaskId);
      const sub = isSub ? (task?.subtasks || []).find(s => s.id === pomoRuntime.selectedSubtaskId) : null;
      const item = isSub ? sub : task;

      document.getElementById('pt-detail-back')?.addEventListener('click', () => {
        if (isSub) pomoRuntime.selectedSubtaskId = null;
        else pomoRuntime.selectedTaskId = null;
        renderPomoTasksPanel();
      });

      document.getElementById('pt-detail-title')?.addEventListener('input', (e) => {
        if (item) { item.title = e.target.value; saveState(); updatePomoTimerUI(); }
      });

      document.getElementById('pt-btn-focus-this')?.addEventListener('click', () => {
        flushUnsavedSeconds();
        p.activeFocus = { taskId: task.id, subtaskId: isSub ? sub.id : null };
        saveState();
        updatePomoTimerUI();
        renderPomoTasksPanel();
        showToast(`Đã chọn Focus: ${getActiveFocusLabel()}`);
      });

      document.getElementById('pt-det-status')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openStatusPopover(e.currentTarget, item.status, (st) => {
          item.status = st;
          saveState();
          renderPomoTasksPanel();
        });
      });

      document.getElementById('pt-det-priority')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openPriorityPopover(e.currentTarget, item.priority || 'none', (pr) => {
          item.priority = pr;
          saveState();
          renderPomoTasksPanel();
        });
      });

      document.getElementById('pt-det-due')?.addEventListener('change', (e) => { item.dueDate = e.target.value; saveState(); });

      document.getElementById('pt-det-labels')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!item.labels) item.labels = [];
        openLabelsPopover(e.currentTarget, item.labels, (lid) => {
          const idx = item.labels.indexOf(lid);
          if (idx >= 0) item.labels.splice(idx, 1);
          else item.labels.push(lid);
          saveState();
          renderPomoTasksPanel();
        });
      });

      document.getElementById('pt-detail-notes')?.addEventListener('input', (e) => { item.notes = e.target.value; saveState(); });

      document.getElementById('pt-detail-delete')?.addEventListener('click', async () => {
        const ok = await askConfirm({
          title: isSub ? 'Xóa subtask này?' : 'Xóa task lớn này?',
          message: `Bạn có chắc muốn xóa "${item.title}" và toàn bộ giờ học ghi nhận của nó?`,
          confirmText: 'Xóa',
          danger: true
        });
        if (!ok) return;
        if (isSub) {
          task.subtasks = task.subtasks.filter(s => s.id !== sub.id);
          if (p.activeFocus?.subtaskId === sub.id) p.activeFocus = null;
          pomoRuntime.selectedSubtaskId = null;
        } else {
          p.tasks = p.tasks.filter(x => x.id !== task.id);
          if (p.activeFocus?.taskId === task.id) p.activeFocus = null;
          pomoRuntime.selectedTaskId = null;
        }
        saveState();
        updatePomoTimerUI();
        renderPomoTasksPanel();
        showToast('Đã xóa.');
      });

      document.getElementById('pt-add-sub-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = document.getElementById('pt-new-sub-title');
        const title = inp.value.trim();
        if (!title) return;
        if (!task.subtasks) task.subtasks = [];
        task.subtasks.push({
          id: 'ps_' + uid(),
          title,
          status: 'todo',
          priority: 'none',
          dueDate: '',
          labels: [],
          notes: '',
          seconds: 0
        });
        inp.value = '';
        saveState();
        renderPomoTasksPanel();
        document.getElementById('pt-new-sub-title')?.focus();
      });

      document.getElementById('pt-toggle-closed-subs')?.addEventListener('click', () => {
        pomoRuntime.showClosedSubs = !pomoRuntime.showClosedSubs;
        renderPomoTasksPanel();
      });

      panel.querySelectorAll('[data-sub-status]').forEach(dot => {
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          const st = (task.subtasks || []).find(x => x.id === dot.dataset.subStatus);
          if (!st) return;
          openStatusPopover(dot, st.status, (newSt) => {
            st.status = newSt;
            saveState();
            renderPomoTasksPanel();
          });
        });
      });

      panel.querySelectorAll('[data-open-sub]').forEach(row => {
        row.addEventListener('click', () => {
          pomoRuntime.selectedSubtaskId = row.dataset.openSub;
          renderPomoTasksPanel();
        });
      });
    }
  }

  document.addEventListener('click', () => {
    closeAllPopovers();
    const chPop = document.querySelector('.pomo-challenge-pop');
    if (chPop) chPop.remove();
  });

  document.addEventListener('DOMContentLoaded', () => {
    cleanupLegacyExamTimerTab();
    renderPomoShell();
  });
window.addEventListener('studyos:synced', () => {
    updatePomoTimerUI();
    renderPomoTasksPanel();
  });
})();