/* ============================================================================
   StudyOS 2027 — Firebase Real-Time Sync (Firestore + Google Auth) & Mobile Shell
============================================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ================== FIREBASE CONFIG ==================
const firebaseConfig = {
  apiKey: "AIzaSyADd6iS8ls9aV4BxUnBVsZKHKUKK2u-G6U",
  authDomain: "studyos-2027-9e79b.firebaseapp.com",
  projectId: "studyos-2027-9e79b",
  storageBucket: "studyos-2027-9e79b.firebasestorage.app",
  messagingSenderId: "811390083997",
  appId: "1:811390083997:web:1edaa570c98171a8788574"
};
// =====================================================

const CLIENT_ID = 'dev_' + Math.random().toString(36).slice(2, 10);
const MAX_DOC_BYTES = 850 * 1024;

let auth = null;
let db = null;
let currentUser = null;
let unsubscribers = [];
let pushTimer = null;
let isApplyingRemote = false;

const isConfigured =
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes('DAN_API_KEY');

if (isConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

// ================= UI ĐỒNG BỘ TRÊN SIDEBAR =================
function injectSyncPanel() {
  const footer = document.querySelector('.sidebar-footer');
  if (!footer || document.getElementById('cloud-sync-box')) return;

  const box = document.createElement('div');
  box.id = 'cloud-sync-box';
  box.className = 'cloud-sync-box';
  box.innerHTML = `
    <div class="cloud-sync-head">
      <span class="footer-label" style="margin:0;">Đồng bộ đám mây</span>
      <span class="sync-status-dot" id="sync-status-text">Chưa đăng nhập</span>
    </div>
    <div id="sync-logged-out">
      <button type="button" class="btn-primary full-btn btn-sm" id="btn-google-signin">
        Đăng nhập Google để đồng bộ
      </button>
    </div>
    <div id="sync-logged-in" class="hidden">
      <div class="sync-user-row">
        <img id="sync-user-avatar" class="sync-avatar" alt="" />
        <div class="sync-user-info">
          <div id="sync-user-name" class="sync-user-name"></div>
          <div id="sync-user-email" class="sync-user-email"></div>
        </div>
      </div>
      <div class="backup-actions" style="margin-top:6px;">
        <button type="button" class="btn-ghost btn-sm" id="btn-sync-now">↻ Đồng bộ</button>
        <button type="button" class="btn-ghost btn-sm" id="btn-google-signout">Đăng xuất</button>
      </div>
    </div>`;

  footer.insertBefore(box, footer.firstChild);

  document.getElementById('btn-google-signin').addEventListener('click', handleSignIn);
  document.getElementById('btn-google-signout').addEventListener('click', handleSignOut);
  document.getElementById('btn-sync-now').addEventListener('click', () => {
    if (!currentUser) return;
    pushAllToCloud(true);
  });
}

function setSyncStatus(text, type = 'muted') {
  const el = document.getElementById('sync-status-text');
  if (!el) return;
  el.textContent = text;
  el.className = `sync-status-dot ${type}`;
}

async function handleSignIn() {
  if (!isConfigured || !auth) {
    showToast('Bạn chưa dán firebaseConfig vào đầu file sync.js!');
    return;
  }
  const provider = new GoogleAuthProvider();
  try {
    setSyncStatus('Đang đăng nhập...', 'syncing');
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
      try {
        await signInWithRedirect(auth, provider);
      } catch {
        setSyncStatus('Lỗi đăng nhập', 'error');
        showToast('Không thể đăng nhập Google. Kiểm tra lại Authorized domains trên Firebase.');
      }
    } else {
      setSyncStatus('Lỗi đăng nhập', 'error');
      showToast(`Lỗi đăng nhập: ${err.code || err.message}`);
    }
  }
}

async function handleSignOut() {
  if (!auth) return;
  const ok = await askConfirm({
    title: 'Đăng xuất tài khoản Google?',
    message: 'Dữ liệu hiện tại vẫn được giữ trên máy này nhưng sẽ tạm ngừng đồng bộ cho đến khi bạn đăng nhập lại.',
    confirmText: 'Đăng xuất'
  });
  if (!ok) return;
  stopCloudListeners();
  await signOut(auth);
  showToast('Đã đăng xuất.');
}

// ================= CHIA GÓI DỮ LIỆU & ĐỒNG BỘ 2 CHIỀU =================
function getUserDocRef(section) {
  return doc(db, 'users', currentUser.uid, 'studyos', section);
}

function buildCalendarPayload() {
  let tasksCopy = state.tasks || [];
  let payload = {
    settings: state.settings || {},
    fixedTkb: state.fixedTkb || [],
    schoolSchedule: state.schoolSchedule || {},
    schoolDayTasks: state.schoolDayTasks || {},
    tasks: tasksCopy,
    goals: state.goals || {},
    updatedAt: Date.now(),
    clientId: CLIENT_ID
  };

  if (new Blob([JSON.stringify(payload)]).size > MAX_DOC_BYTES) {
    payload.tasks = tasksCopy.map(t => ({
      ...t,
      attachments: (t.attachments || []).map(a =>
        (a.dataUrl && a.dataUrl.length > 150000) ? { ...a, dataUrl: '' } : a
      )
    }));
  }
  return payload;
}

function buildExamsPayload() {
  return {
    examCategories: state.examCategories || [],
    exams: state.exams || [],
    updatedAt: Date.now(),
    clientId: CLIENT_ID
  };
}

function buildPomoPayload() {
  return {
    pomodoro: state.pomodoro || null,
    updatedAt: Date.now(),
    clientId: CLIENT_ID
  };
}

function buildMasteryPayload() {
  return {
    mastery: state.mastery || [],
    updatedAt: Date.now(),
    clientId: CLIENT_ID
  };
}

async function pushAllToCloud(showDoneToast = false) {
  if (!currentUser || !db || isApplyingRemote) return;
  try {
    setSyncStatus('↻ Đang đồng bộ...', 'syncing');
    await Promise.all([
      setDoc(getUserDocRef('calendar'), buildCalendarPayload()),
      setDoc(getUserDocRef('exams'), buildExamsPayload()),
      setDoc(getUserDocRef('pomodoro'), buildPomoPayload()),
      setDoc(getUserDocRef('mastery'), buildMasteryPayload())
    ]);
    setSyncStatus('● Đã đồng bộ', 'ok');
    if (showDoneToast) showToast('Đã đồng bộ dữ liệu lên đám mây!');
  } catch (err) {
    console.error('Firestore push error:', err);
    setSyncStatus('Lỗi đồng bộ', 'error');
    showToast('Lỗi đồng bộ lên Firebase. Kiểm tra kết nối mạng hoặc Firestore Rules.');
  }
}

function scheduleCloudPush() {
  if (!currentUser || !db || isApplyingRemote) return;
  clearTimeout(pushTimer);
  setSyncStatus('↻ Chờ lưu...', 'syncing');
  pushTimer = setTimeout(() => pushAllToCloud(false), 700);
}

function refreshAllViewsAfterRemote() {
  try {
    if (typeof refreshCategorySelects === 'function') refreshCategorySelects();
    if (typeof renderCountdowns === 'function') renderCountdowns();
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderExamsTable === 'function') renderExamsTable();
    if (typeof renderMistakes === 'function') renderMistakes();
    if (typeof renderAnalytics === 'function') renderAnalytics();
    window.dispatchEvent(new CustomEvent('studyos:synced'));
  } catch (e) {
    console.error('Refresh UI error:', e);
  }
}

function stopCloudListeners() {
  unsubscribers.forEach(fn => { try { fn(); } catch {} });
  unsubscribers = [];
}

async function startCloudSync() {
  stopCloudListeners();
  setSyncStatus('↻ Đang kết nối...', 'syncing');

  try {
    const [calSnap, examSnap, pomoSnap, masterySnap] = await Promise.all([
      getDoc(getUserDocRef('calendar')),
      getDoc(getUserDocRef('exams')),
      getDoc(getUserDocRef('pomodoro')),
      getDoc(getUserDocRef('mastery'))
    ]);

    const hasCloudData = calSnap.exists() || examSnap.exists() || pomoSnap.exists() || masterySnap.exists();

    if (!hasCloudData) {
      await pushAllToCloud(false);
      showToast('Đã đồng bộ toàn bộ dữ liệu hiện có của bạn lên đám mây!');
    } else {
      isApplyingRemote = true;
      if (calSnap.exists()) applyRemoteCalendar(calSnap.data());
      if (examSnap.exists()) applyRemoteExams(examSnap.data());
      if (pomoSnap.exists()) applyRemotePomo(pomoSnap.data());
      if (masterySnap.exists()) applyRemoteMastery(masterySnap.data());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      isApplyingRemote = false;
      refreshAllViewsAfterRemote();
    }

    const listenDoc = (name, applyFn) => onSnapshot(getUserDocRef(name), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.clientId === CLIENT_ID) return;
      isApplyingRemote = true;
      applyFn(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      isApplyingRemote = false;
      refreshAllViewsAfterRemote();
      setSyncStatus('● Đã đồng bộ', 'ok');
    });

    unsubscribers.push(
      listenDoc('calendar', applyRemoteCalendar),
      listenDoc('exams', applyRemoteExams),
      listenDoc('pomodoro', applyRemotePomo),
      listenDoc('mastery', applyRemoteMastery)
    );

    setSyncStatus('● Đã đồng bộ', 'ok');
  } catch (err) {
    console.error('Start sync error:', err);
    setSyncStatus('Lỗi kết nối', 'error');
  }
}

function applyRemoteCalendar(data) {
  if (data.settings) state.settings = { ...state.settings, ...data.settings };
  if (Array.isArray(data.fixedTkb)) state.fixedTkb = data.fixedTkb;
  if (data.schoolSchedule) state.schoolSchedule = data.schoolSchedule;
  if (data.schoolDayTasks) state.schoolDayTasks = data.schoolDayTasks;
  if (Array.isArray(data.tasks)) state.tasks = data.tasks;
  if (data.goals) state.goals = data.goals;
}

function applyRemoteExams(data) {
  if (Array.isArray(data.examCategories) && data.examCategories.length) {
    state.examCategories = data.examCategories;
  }
  if (Array.isArray(data.exams)) state.exams = data.exams;
}

function applyRemotePomo(data) {
  if (data.pomodoro) state.pomodoro = data.pomodoro;
}

function applyRemoteMastery(data) {
  if (Array.isArray(data.mastery) && data.mastery.length) {
    state.mastery = data.mastery;
  }
}

function hookSaveState() {
  const originalSave = window.saveState;
  if (typeof originalSave !== 'function') return;
  window.saveState = function () {
    originalSave();
    if (!isApplyingRemote) scheduleCloudPush();
  };
}

// ================= GIAO DIỆN MOBILE: CHỈ DÙNG NÚT ☰ GÓC TRÊN TRÁI =================
function initMobileNavigation() {
  if (document.getElementById('mobile-menu-fab')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'mobile-sidebar-backdrop';
  backdrop.className = 'mobile-sidebar-backdrop';
  backdrop.addEventListener('click', () => {
    document.body.classList.remove('mobile-menu-open');
  });
  document.body.appendChild(backdrop);

  const menuBtn = document.createElement('button');
  menuBtn.id = 'mobile-menu-fab';
  menuBtn.className = 'mobile-menu-fab';
  menuBtn.title = 'Mở menu chức năng';
  menuBtn.innerHTML = '☰';
  menuBtn.addEventListener('click', () => {
    document.body.classList.toggle('mobile-menu-open');
  });
  document.body.appendChild(menuBtn);

  const syncMenuFabVisibility = (tabName) => {
    menuBtn.classList.toggle('hidden', tabName === 'pomodoro');
  };

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.classList.remove('mobile-menu-open');
      syncMenuFabVisibility(btn.dataset.tab);
    });
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 960 && e.target.closest('#btn-pomo-toggle-sidebar')) {
      document.body.classList.toggle('mobile-menu-open');
    }
  });
}

// ================= ĐỒNG BỘ CUỘN NGANG LỊCH TUẦN TRÊN ĐIỆN THOẠI =================
function initMobileCalendarSync() {
  const daysHeader = document.getElementById('cal-days-header');
  const goalsRow = document.getElementById('cal-goals-row');
  const gridScroll = document.getElementById('cal-grid-scroll');
  if (!daysHeader || !goalsRow || !gridScroll) return;

  const targets = [daysHeader, goalsRow, gridScroll];
  let activeSource = null;

  targets.forEach(src => {
    src.addEventListener('scroll', () => {
      if (activeSource && activeSource !== src) return;
      activeSource = src;
      const left = src.scrollLeft;
      targets.forEach(dst => {
        if (dst !== src && dst.scrollLeft !== left) {
          dst.scrollLeft = left;
        }
      });
      requestAnimationFrame(() => {
        activeSource = null;
      });
    }, { passive: true });
  });

  if (window.innerWidth <= 960) {
    setTimeout(() => {
      const todayCol = gridScroll.querySelector('.cal-col.today-col');
      if (todayCol) {
        const targetLeft = Math.max(0, todayCol.offsetLeft - 48);
        gridScroll.scrollLeft = targetLeft;
        daysHeader.scrollLeft = targetLeft;
        goalsRow.scrollLeft = targetLeft;
      }
    }, 180);
  }
}

// ================= KHỞI CHẠY =================
function initSyncModule() {
  injectSyncPanel();
  hookSaveState();
  initMobileNavigation();
  initMobileCalendarSync();

  if (!isConfigured || !auth) {
    setSyncStatus('Chưa cấu hình', 'muted');
    return;
  }

  getRedirectResult(auth).catch(() => {});

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const outBox = document.getElementById('sync-logged-out');
    const inBox = document.getElementById('sync-logged-in');

    if (user) {
      outBox?.classList.add('hidden');
      inBox?.classList.remove('hidden');
      const av = document.getElementById('sync-user-avatar');
      if (av) av.src = user.photoURL || '';
      const nm = document.getElementById('sync-user-name');
      if (nm) nm.textContent = user.displayName || 'Tài khoản Google';
      const em = document.getElementById('sync-user-email');
      if (em) em.textContent = user.email || '';
      startCloudSync();
    } else {
      stopCloudListeners();
      outBox?.classList.remove('hidden');
      inBox?.classList.add('hidden');
      setSyncStatus('Chưa đăng nhập', 'muted');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSyncModule);
} else {
  initSyncModule();
}