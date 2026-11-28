/* ============================================================================
   StudyOS 2027 — Lịch Học & Theo Dõi Luyện Đề (HSG Toán & TN THPT)
   Cập nhật v5: Phân loại Loại đề tùy chỉnh & Nhiều biểu đồ phong độ độc lập
============================================================================ */

const STORAGE_KEY = 'studyos_2027_v1';
const START_MIN = 270;   // 04:30
const END_MIN = 1440;    // 24:00
const HOUR_HEIGHT = 64;  // px per hour
const MAX_FILE_SIZE_BYTES = 1.5 * 1024 * 1024; // 1.5MB / file

const SUBJECTS = {
  hsg:  { name: 'HSG Toán', short: 'HSG', defaultTime: 120, maxScore: 20, color: '#f28b82' },
  toan: { name: 'Toán TN',  short: 'Toán', defaultTime: 90,  maxScore: 10, color: '#8ab4f8' },
  ly:   { name: 'Vật lí',   short: 'Lí',   defaultTime: 50,  maxScore: 10, color: '#fdd663' },
  hoa:  { name: 'Hóa học',  short: 'Hóa',  defaultTime: 50,  maxScore: 10, color: '#81c995' },
  other:{ name: 'Khác',     short: 'Khác', defaultTime: 60,  maxScore: 10, color: '#a5b4fc' }
};

const CAT_COLORS = ['#8ab4f8', '#fdd663', '#81c995', '#f28b82', '#c58af9', '#4dd0e1', '#f48fb1', '#ffab91'];

function getDefaultExamCategories() {
  return [
    { id: 'cat_truong_so', name: 'Thi thử Trường / Sở', color: '#8ab4f8' },
    { id: 'cat_gk_ck',     name: 'Giữa kì / Cuối kì',   color: '#fdd663' },
    { id: 'cat_khoa_hoc',  name: 'Đề khóa học / Sách',  color: '#81c995' },
    { id: 'cat_hsg',       name: 'Luyện HSG / Đội tuyển', color: '#f28b82' }
  ];
}

const SCHOOL_SUBJECTS_CATALOG = [
  { name: 'HĐTN',                 code: 'HĐTN',   accent: '#f48fb1', bg: 'rgba(244, 143, 177, 0.25)', border: 'rgba(244, 143, 177, 0.58)' },
  { name: 'Toán',                 code: 'TO',     accent: '#64b5f6', bg: 'rgba(100, 181, 246, 0.26)', border: 'rgba(100, 181, 246, 0.62)' },
  { name: 'Toán Chuyên đề',       code: 'TCĐHT',  accent: '#42a5f5', bg: 'rgba(66, 165, 245, 0.30)',  border: 'rgba(66, 165, 245, 0.68)' },
  { name: 'Tiếng Anh',            code: 'NN1',    accent: '#b39ddb', bg: 'rgba(179, 157, 219, 0.26)', border: 'rgba(179, 157, 219, 0.60)' },
  { name: 'Anh văn bản ngữ',      code: 'Eng',    accent: '#ce93d8', bg: 'rgba(206, 147, 216, 0.26)', border: 'rgba(206, 147, 216, 0.60)' },
  { name: 'Tin Học',              code: 'TI',     accent: '#4dd0e1', bg: 'rgba(77, 208, 225, 0.25)',  border: 'rgba(77, 208, 225, 0.58)' },
  { name: 'Ngữ văn',              code: 'V',      accent: '#ffab91', bg: 'rgba(255, 171, 145, 0.26)', border: 'rgba(255, 171, 145, 0.60)' },
  { name: 'Sinh học',             code: 'SI',     accent: '#81c784', bg: 'rgba(129, 199, 132, 0.25)', border: 'rgba(129, 199, 132, 0.58)' },
  { name: 'Hóa học',              code: 'H',      accent: '#4db6ac', bg: 'rgba(77, 182, 172, 0.26)',  border: 'rgba(77, 182, 172, 0.60)' },
  { name: 'Hóa Chuyên đề',        code: 'HCĐHT',  accent: '#26a69a', bg: 'rgba(38, 166, 154, 0.30)',  border: 'rgba(38, 166, 154, 0.68)' },
  { name: 'Hóa Tăng cường',       code: 'H-TC',   accent: '#80cbc4', bg: 'rgba(128, 203, 196, 0.26)', border: 'rgba(128, 203, 196, 0.62)' },
  { name: 'Lý',                   code: 'L',      accent: '#ffd54f', bg: 'rgba(255, 213, 79, 0.24)',  border: 'rgba(255, 213, 79, 0.60)' },
  { name: 'Lý Chuyên đề',         code: 'LCĐHT',  accent: '#ffb74d', bg: 'rgba(255, 183, 77, 0.27)',  border: 'rgba(255, 183, 77, 0.65)' },
  { name: 'Lý Tăng cường',        code: 'L-TC',   accent: '#ffe082', bg: 'rgba(255, 224, 130, 0.24)', border: 'rgba(255, 224, 130, 0.60)' },
  { name: 'Lịch sử',              code: 'SU',     accent: '#e57373', bg: 'rgba(229, 115, 115, 0.26)', border: 'rgba(229, 115, 115, 0.60)' },
  { name: 'Stem',                 code: 'STEM',   accent: '#7986cb', bg: 'rgba(121, 134, 203, 0.28)', border: 'rgba(121, 134, 203, 0.62)' },
  { name: 'Giáo dục địa phương',  code: 'GDĐP',   accent: '#dce775', bg: 'rgba(220, 231, 117, 0.22)', border: 'rgba(220, 231, 117, 0.56)' },
  { name: 'Giáo dục thể chất',    code: 'GDTC',   accent: '#aed581', bg: 'rgba(174, 213, 129, 0.24)', border: 'rgba(174, 213, 129, 0.58)' },
  { name: 'Giáo dục quốc phòng',  code: 'QP',     accent: '#bcaaa4', bg: 'rgba(188, 170, 164, 0.25)', border: 'rgba(188, 170, 164, 0.58)' },
  { name: 'Chào cờ',              code: 'CC',     accent: '#90a4ae', bg: 'rgba(144, 164, 174, 0.26)', border: 'rgba(144, 164, 174, 0.58)' }
];

const SCHOOL_PERIODS = [
  { id: 'cc', label: 'Chào cờ',     short: 'Chào cờ', session: 'Sáng',  startMin: 6 * 60 + 45,  endMin: 7 * 60 + 5,   onlyMonday: true },
  { id: 's1', label: 'Sáng Tiết 1', short: 'S-T1',    session: 'Sáng',  startMin: 7 * 60 + 5,   endMin: 7 * 60 + 50 },
  { id: 's2', label: 'Sáng Tiết 2', short: 'S-T2',    session: 'Sáng',  startMin: 8 * 60 + 10,  endMin: 8 * 60 + 55 },
  { id: 's3', label: 'Sáng Tiết 3', short: 'S-T3',    session: 'Sáng',  startMin: 9 * 60,       endMin: 9 * 60 + 45 },
  { id: 's4', label: 'Sáng Tiết 4', short: 'S-T4',    session: 'Sáng',  startMin: 9 * 60 + 55,  endMin: 10 * 60 + 40 },
  { id: 's5', label: 'Sáng Tiết 5', short: 'S-T5',    session: 'Sáng',  startMin: 10 * 60 + 45, endMin: 11 * 60 + 30 },
  { id: 'c1', label: 'Chiều Tiết 1',short: 'C-T1',    session: 'Chiều', startMin: 13 * 60 + 35, endMin: 14 * 60 + 20 },
  { id: 'c2', label: 'Chiều Tiết 2',short: 'C-T2',    session: 'Chiều', startMin: 14 * 60 + 25, endMin: 15 * 60 + 10 },
  { id: 'c3', label: 'Chiều Tiết 3',short: 'C-T3',    session: 'Chiều', startMin: 15 * 60 + 25, endMin: 16 * 60 + 10 },
  { id: 'c4', label: 'Chiều Tiết 4',short: 'C-T4',    session: 'Chiều', startMin: 16 * 60 + 15, endMin: 17 * 60 }
];

function getDefault12A2Schedule() {
  return {
    '1_cc': { name: 'Chào cờ' },
    '1_s1': { name: 'HĐTN' },
    '1_s2': { name: 'HĐTN' },
    '1_s3': { name: 'Toán' },
    '1_s4': { name: 'Tiếng Anh' },
    '1_s5': { name: 'Tiếng Anh' },
    '1_c1': { name: 'Tin Học' },
    '1_c2': { name: 'HĐTN' },
    '1_c3': { name: 'Ngữ văn' },
    '2_s1': { name: 'Anh văn bản ngữ' },
    '2_s2': { name: 'Ngữ văn' },
    '2_s3': { name: 'Ngữ văn' },
    '2_s4': { name: 'Sinh học' },
    '2_s5': { name: 'Hóa học' },
    '2_c1': { name: 'Lý Chuyên đề' },
    '2_c2': { name: 'Hóa Chuyên đề' },
    '3_s1': { name: 'Toán' },
    '3_s2': { name: 'Toán' },
    '3_s3': { name: 'Sinh học' },
    '3_s4': { name: 'Lịch sử' },
    '3_s5': { name: 'Stem' },
    '3_c1': { name: 'Tiếng Anh' },
    '3_c2': { name: 'Toán' },
    '4_s1': { name: 'Ngữ văn' },
    '4_s2': { name: 'Giáo dục địa phương' },
    '4_s3': { name: 'Lịch sử' },
    '4_s4': { name: 'Lý' },
    '4_s5': { name: 'Lý' },
    '4_c1': { name: 'Giáo dục thể chất' },
    '4_c2': { name: 'Giáo dục thể chất' },
    '5_s1': { name: 'Anh văn bản ngữ' },
    '5_s2': { name: 'Giáo dục quốc phòng' },
    '5_s3': { name: 'Toán Chuyên đề' },
    '5_s4': { name: 'Hóa học' },
    '5_s5': { name: 'Tin Học' }
  };
}

const TN_CONFIG = {
  toan: { p1Count: 12, p1Point: 0.25, p1Max: 3.0, p2Count: 4, p2Max: 4.0, p3Count: 6, p3Point: 0.5,  p3Max: 3.0 },
  ly:   { p1Count: 18, p1Point: 0.25, p1Max: 4.5, p2Count: 4, p2Max: 4.0, p3Count: 6, p3Point: 0.25, p3Max: 1.5 },
  hoa:  { p1Count: 18, p1Point: 0.25, p1Max: 4.5, p2Count: 4, p2Max: 4.0, p3Count: 6, p3Point: 0.25, p3Max: 1.5 }
};

const TF_SCORES = { 0: 0, 1: 0.1, 2: 0.25, 3: 0.5, 4: 1.0 };

const LEVELS = [
  { key: 'NB',  label: 'NB',  full: 'Nhận biết' },
  { key: 'TH',  label: 'TH',  full: 'Thông hiểu' },
  { key: 'VDT', label: 'VDT', full: 'Vận dụng thấp' },
  { key: 'VDC', label: 'VDC', full: 'Vận dụng cao' }
];

const ERROR_REASONS_HSG = ['Tính nhầm', 'Đọc sót đề', 'Hiểu sai đề', 'Hổng kiến thức', 'Mất điểm trình bày', 'Thiếu thời gian'];
const ERROR_REASONS_TN  = ['Tính nhầm', 'Đọc sót đề', 'Hiểu sai đề', 'Thiếu thời gian', 'Hổng kiến thức', 'Bẫy lý thuyết'];
const ALL_ERROR_REASONS = ['Tính nhầm', 'Đọc sót đề', 'Hiểu sai đề', 'Hổng kiến thức', 'Mất điểm trình bày', 'Thiếu thời gian', 'Bẫy lý thuyết'];

const DURATION_PRESETS = [15, 30, 45, 50, 60, 75, 90, 120, 150, 180];
const STATUS_ORDER = ['backlog', 'todo', 'in_progress', 'done', 'canceled'];
const STATUS_SYMBOL = { backlog: '', todo: '', in_progress: '•', done: '✓', canceled: '×' };
const STATUS_LABELS = { backlog: 'Backlog', todo: 'Todo', in_progress: 'In Progress', done: 'Done', canceled: 'Canceled' };
const DAY_NAMES_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DAY_NAMES_FULL  = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

// ================= STATE =================
let state = loadState();
let currentWeekStart = getMonday(new Date());
let examFilterSubject = 'all';
let examFilterCategory = 'all';
let analyticsSubject = 'hsg';
let analyticsChartMode = 'split'; // 'split' | 'combined'
let analyticsErrSubject = 'all';
let analyticsErrCategory = 'all';
let draftScoring = null;
let draftTaskLinks = [];
let draftTaskAttachments = [];
let viewingTaskId = null;
let activeSchoolSlot = null;

let trendChartInstances = [];
let chartReasons = null;
let chartLevels = null;

function defaultState() {
  return {
    settings: {
      thptDate: '2027-06-11',
      showFixedTkb: true,
      showSchoolTkb: true,
      migrated12A2: true
    },
    fixedTkb: [],
    schoolSchedule: getDefault12A2Schedule(),
    schoolDayTasks: {},
    examCategories: getDefaultExamCategories(),
    tasks: [],
    goals: {},
    exams: []
  };
}

function getDefaultCategoryIdForSubject(sub, categories) {
  const cats = categories || state?.examCategories || getDefaultExamCategories();
  if (sub === 'hsg') {
    const hsgCat = cats.find(c => c.id === 'cat_hsg');
    if (hsgCat) return hsgCat.id;
  }
  const tsCat = cats.find(c => c.id === 'cat_truong_so');
  return tsCat ? tsCat.id : (cats[0]?.id || 'cat_truong_so');
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const def = defaultState();

    const merged = {
      ...def,
      ...parsed,
      settings: { ...def.settings, ...(parsed.settings || {}) },
      schoolSchedule: parsed.schoolSchedule || {},
      schoolDayTasks: parsed.schoolDayTasks || {},
      examCategories: (Array.isArray(parsed.examCategories) && parsed.examCategories.length)
        ? parsed.examCategories
        : getDefaultExamCategories()
    };

    if (!parsed.settings?.migrated12A2) {
      merged.fixedTkb = (merged.fixedTkb || []).filter(
        f => !(f.title || '').toLowerCase().includes('học trên trường')
      );
      merged.schoolSchedule = getDefault12A2Schedule();
      merged.settings.migrated12A2 = true;
    }

    // Tự động gán loại đề mặc định cho các đề cũ chưa có categoryId
    let changed = false;
    (merged.exams || []).forEach(ex => {
      if (!ex.categoryId) {
        ex.categoryId = getDefaultCategoryIdForSubject(ex.subject, merged.examCategories);
        changed = true;
      }
    });
    if (changed || !parsed.examCategories) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }

    return merged;
  } catch {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    showToast('Bộ nhớ trình duyệt gần đầy! Hãy gỡ bớt file đính kèm lớn hoặc dùng Link Google Drive.');
  }
}

function getExamCategoryObj(catId) {
  const found = (state.examCategories || []).find(c => c.id === catId);
  if (found) return found;
  return { id: 'uncat', name: 'Chưa phân loại', color: '#9aa0a6' };
}

// ================= AUTO-INJECT UI (PENDING + EXAM CATEGORIES + MULTI-CHARTS) =================
function injectDynamicControls() {
  // 1. Bảng luyện đề: nút "Chờ chấm" + dropdown lọc Loại đề
  const filterBar = document.getElementById('exam-subject-filters');
  if (filterBar && !document.getElementById('filter-pill-pending')) {
    const btn = document.createElement('button');
    btn.className = 'filter-pill pending-filter-pill';
    btn.dataset.subject = 'pending';
    btn.id = 'filter-pill-pending';
    btn.textContent = 'Chờ chấm (0)';
    filterBar.appendChild(btn);
  }

  const examsHeaderRight = document.querySelector('#view-exams .header-right');
  if (examsHeaderRight && !document.getElementById('exam-filter-category')) {
    const sel = document.createElement('select');
    sel.id = 'exam-filter-category';
    sel.className = 'select-control';
    sel.style.maxWidth = '195px';
    const addBtn = document.getElementById('btn-open-exam-modal');
    examsHeaderRight.insertBefore(sel, addBtn);
  }

  // 2. Modal Thêm / Sửa đề thi: Loại đề + Chờ chấm
  const topGrid = document.querySelector('#form-exam .exam-top-grid');
  if (topGrid && !document.getElementById('exam-category-group')) {
    const catGroup = document.createElement('div');
    catGroup.id = 'exam-category-group';
    catGroup.className = 'form-group';
    catGroup.innerHTML = `
      <label>Loại đề (dùng để tách riêng biểu đồ phong độ)</label>
      <div class="exam-cat-row">
        <select id="exam-category"></select>
        <button type="button" class="btn-ghost btn-sm" id="btn-open-exam-cats">+ Quản lý loại đề</button>
      </div>`;
    topGrid.insertAdjacentElement('afterend', catGroup);
  }

  const scoreBanner = document.querySelector('#form-exam .score-banner');
  if (scoreBanner) {
    scoreBanner.id = 'exam-score-banner';
    const bannerLabel = scoreBanner.querySelector('.score-banner-label');
    if (bannerLabel && !document.getElementById('exam-est-compare-hint')) {
      const tag = document.createElement('span');
      tag.id = 'exam-est-compare-hint';
      tag.className = 'est-compare-tag hidden';
      bannerLabel.appendChild(tag);
    }

    if (!document.getElementById('pending-exam-bar')) {
      const bar = document.createElement('div');
      bar.id = 'pending-exam-bar';
      bar.className = 'pending-exam-bar';
      bar.innerHTML = `
        <label class="switch-label pending-switch-label">
          <input type="checkbox" id="exam-is-pending" />
          <span>⏳ Chưa có điểm (Chờ thầy sửa / Chưa có đáp án)</span>
        </label>
        <div class="est-score-wrap hidden" id="exam-est-score-wrap">
          <label for="exam-est-score">Tự ước lượng (tùy chọn):</label>
          <input type="number" step="0.1" min="0" max="20" id="exam-est-score" placeholder="VD: 8.5" />
        </div>`;
      scoreBanner.parentNode.insertBefore(bar, scoreBanner);
    }
  }

  // 3. Modal Quản lý Loại đề
  if (!document.getElementById('modal-exam-cats')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-backdrop hidden" id="modal-exam-cats">
        <div class="modal-box">
          <div class="modal-header">
            <h2>Quản lý Loại đề thi</h2>
            <button class="btn-icon" id="btn-close-exam-cats">✕</button>
          </div>
          <div class="modal-body">
            <form id="form-add-exam-cat" style="display:flex;gap:8px;align-items:center;">
              <input type="text" id="input-new-exam-cat" placeholder="VD: Đề thầy Đức, Sách thực chiến Hóa..." required style="flex:1;" />
              <button type="submit" class="btn-primary btn-sm">+ Thêm</button>
            </form>
            <div id="exam-cats-manage-list"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap.firstElementChild);
  }

  // 4. Nâng cấp khu vực Biểu đồ phong độ (Tab Analytics)
  const chartsLayout = document.querySelector('#view-analytics .charts-layout');
  const oldTrendCard = document.querySelector('#view-analytics .chart-card.full-width');
  if (chartsLayout && oldTrendCard && !document.getElementById('analytics-trend-grid')) {
    const topBar = document.createElement('div');
    topBar.className = 'analytics-top-bar';
    topBar.style.gridColumn = '1 / -1';
    topBar.innerHTML = `
      <div class="filter-bar compact" id="analytics-subject-pills">
        <button class="filter-pill active" data-subject="hsg">HSG Toán (/20)</button>
        <button class="filter-pill" data-subject="toan">Toán TN (/10)</button>
        <button class="filter-pill" data-subject="ly">Vật lí (/10)</button>
        <button class="filter-pill" data-subject="hoa">Hóa học (/10)</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <div class="analytics-mode-switch" id="analytics-mode-switch">
          <button type="button" class="analytics-mode-btn active" data-chart-mode="split">Tách riêng từng loại đề</button>
          <button type="button" class="analytics-mode-btn" data-chart-mode="combined">Gộp so sánh</button>
        </div>
        <button type="button" class="btn-ghost btn-sm" id="btn-analytics-manage-cats">⚙ Loại đề</button>
      </div>`;

    const trendGrid = document.createElement('div');
    trendGrid.id = 'analytics-trend-grid';
    trendGrid.className = 'analytics-trend-grid';

    const errToolbar = document.createElement('div');
    errToolbar.className = 'analytics-err-toolbar';
    errToolbar.innerHTML = `
      <h3>Phân tích nguyên nhân & mức độ lỗi sai</h3>
      <div class="analytics-err-filters">
        <select id="analytics-err-sub-filter" class="select-control">
          <option value="all">Tất cả môn</option>
          <option value="hsg">HSG Toán</option>
          <option value="toan">Toán TN</option>
          <option value="ly">Vật lí</option>
          <option value="hoa">Hóa học</option>
        </select>
        <select id="analytics-err-cat-filter" class="select-control"></select>
      </div>`;

    chartsLayout.insertBefore(topBar, oldTrendCard);
    chartsLayout.insertBefore(trendGrid, oldTrendCard);
    chartsLayout.insertBefore(errToolbar, oldTrendCard);
    oldTrendCard.remove();
  }

  refreshCategorySelects();
}

function refreshCategorySelects() {
  const cats = state.examCategories || [];

  // 1. Dropdown trong Modal Đề thi
  const modalSel = document.getElementById('exam-category');
  if (modalSel) {
    const prev = modalSel.value;
    modalSel.innerHTML = cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if (prev && cats.some(c => c.id === prev)) modalSel.value = prev;
  }

  // 2. Dropdown lọc ở Bảng luyện đề
  const tblSel = document.getElementById('exam-filter-category');
  if (tblSel) {
    tblSel.innerHTML = `<option value="all">Tất cả loại đề</option>` +
      cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    tblSel.value = cats.some(c => c.id === examFilterCategory) ? examFilterCategory : 'all';
    examFilterCategory = tblSel.value;
  }

  // 3. Dropdown lọc lỗi sai ở Tab Analytics
  const errCatSel = document.getElementById('analytics-err-cat-filter');
  if (errCatSel) {
    errCatSel.innerHTML = `<option value="all">Tất cả loại đề</option>` +
      cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    errCatSel.value = cats.some(c => c.id === analyticsErrCategory) ? analyticsErrCategory : 'all';
    analyticsErrCategory = errCatSel.value;
  }
}

function renderManageExamCatsList() {
  const wrap = document.getElementById('exam-cats-manage-list');
  if (!wrap) return;
  const cats = state.examCategories || [];
  if (!cats.length) {
    wrap.innerHTML = `<div style="padding:14px;text-align:center;color:var(--text-dim);">Chưa có loại đề nào.</div>`;
    return;
  }
  wrap.innerHTML = cats.map(c => {
    const count = state.exams.filter(e => e.categoryId === c.id).length;
    return `
      <div class="cat-manage-row">
        <span class="cat-dot" style="background:${c.color};width:10px;height:10px;"></span>
        <span style="flex:1;font-weight:500;">${escapeHtml(c.name)}</span>
        <span style="font-size:12px;color:var(--text-dim);">${count} đề</span>
        ${cats.length > 1 ? `<button type="button" class="btn-icon danger-icon" data-del-exam-cat="${c.id}" title="Xóa loại đề">✕</button>` : ''}
      </div>`;
  }).join('');
}

function openManageExamCatsModal() {
  renderManageExamCatsList();
  document.getElementById('modal-exam-cats').classList.remove('hidden');
}

// ================= CUSTOM CONFIRM DIALOG =================
let confirmResolver = null;

function askConfirm({ title = 'Xác nhận thao tác', message = 'Bạn có chắc chắn muốn thực hiện?', confirmText = 'Xác nhận', danger = false } = {}) {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const okBtn = document.getElementById('btn-confirm-ok');
    okBtn.textContent = confirmText;
    okBtn.classList.toggle('danger-solid', Boolean(danger));
    document.getElementById('modal-confirm').classList.remove('hidden');
  });
}

function closeConfirm(result) {
  document.getElementById('modal-confirm').classList.add('hidden');
  if (confirmResolver) {
    const fn = confirmResolver;
    confirmResolver = null;
    fn(result);
  }
}

// ================= UTILITIES =================
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateISO(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateVN(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function getMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

function minToTimeStr(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeUrl(raw = '') {
  const s = raw.trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

function getTaskLinks(task) {
  if (!task) return [];
  if (Array.isArray(task.lessonLinks) && task.lessonLinks.length) return task.lessonLinks;
  if (task.lessonLink && task.lessonLink.trim()) {
    return [{ id: 'legacy', title: '', url: task.lessonLink.trim() }];
  }
  return [];
}

function openAttachmentInNewTab(att) {
  try {
    const [meta, b64] = (att.dataUrl || '').split(',');
    if (!b64) return showToast('Không thể mở tệp này.');
    const mime = att.type || (meta.match(/:(.*?);/) || [])[1] || 'application/octet-stream';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch {
    showToast('Không thể mở xem trực tiếp file này.');
  }
}

function parseFlexibleTime(str) {
  if (!str) return null;
  let s = String(str).trim().toLowerCase().replace(/\s+/g, '');
  const isPM = s.endsWith('pm');
  const isAM = s.endsWith('am');
  s = s.replace(/(am|pm)$/i, '');

  let h = null;
  let m = 0;

  if (/^\d{1,2}[:hg.]\d{1,2}$/.test(s)) {
    const parts = s.split(/[:hg.]/);
    h = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
  } else if (/^\d{3,4}$/.test(s)) {
    const num = s.padStart(4, '0');
    h = parseInt(num.slice(0, 2), 10);
    m = parseInt(num.slice(2, 4), 10);
  } else if (/^\d{1,2}[hg]?$/.test(s)) {
    h = parseInt(s.replace(/[hg]/g, ''), 10);
    m = 0;
  } else {
    return null;
  }

  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;

  if (Number.isNaN(h) || Number.isNaN(m) || m < 0 || m > 59 || h < 0 || h > 24) return null;
  if (h === 24 && m > 0) return null;

  const total = h * 60 + m;
  if (total < START_MIN || total > END_MIN) return null;
  return total;
}

function getSchoolSubjectStyle(name = '') {
  const clean = name.trim().toLowerCase();
  const found = SCHOOL_SUBJECTS_CATALOG.find(
    s => s.name.toLowerCase() === clean || s.code.toLowerCase() === clean
  );
  if (found) return found;
  const partial = SCHOOL_SUBJECTS_CATALOG.find(s => clean.includes(s.name.toLowerCase()));
  if (partial) return partial;
  return { accent: '#78dce8', bg: 'rgba(120, 220, 232, 0.24)', border: 'rgba(120, 220, 232, 0.56)' };
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 2800);
}

// ================= COMBOBOXES =================
function initTimeCombos() {
  document.querySelectorAll('[data-time-combo]').forEach(wrapper => {
    const kind = wrapper.dataset.timeCombo;
    const input = wrapper.querySelector('.time-combo-input');
    const dropdown = wrapper.querySelector('.time-combo-dropdown');

    const times = [];
    for (let m = START_MIN; m <= END_MIN; m += 15) {
      if (kind === 'start' && m === END_MIN) continue;
      if (kind === 'end' && m === START_MIN) continue;
      times.push(m);
    }

    function openDropdown() {
      const currentMin = parseFlexibleTime(input.value);
      dropdown.innerHTML = times.map(m => {
        const str = minToTimeStr(m);
        const isSel = currentMin !== null && Math.abs(currentMin - m) < 8;
        return `<div class="time-combo-opt ${isSel ? 'selected' : ''}" data-val="${str}">${str}</div>`;
      }).join('');
      dropdown.classList.remove('hidden');
      const selEl = dropdown.querySelector('.selected');
      if (selEl) dropdown.scrollTop = Math.max(0, selEl.offsetTop - 75);
    }

    input.addEventListener('focus', () => { input.select(); openDropdown(); });
    input.addEventListener('click', () => { if (dropdown.classList.contains('hidden')) openDropdown(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const parsed = parseFlexibleTime(input.value);
        if (parsed !== null) {
          input.value = minToTimeStr(parsed);
          dropdown.classList.add('hidden');
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.add('hidden');
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.classList.add('hidden');
        const parsed = parseFlexibleTime(input.value);
        if (parsed !== null) input.value = minToTimeStr(parsed);
      }, 130);
    });
    dropdown.addEventListener('mousedown', (e) => {
      const opt = e.target.closest('.time-combo-opt');
      if (!opt) return;
      e.preventDefault();
      input.value = opt.dataset.val;
      dropdown.classList.add('hidden');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  document.querySelectorAll('[data-duration-combo]').forEach(wrapper => {
    const input = wrapper.querySelector('.time-combo-input');
    const dropdown = wrapper.querySelector('.time-combo-dropdown');

    function openDurationDropdown() {
      const cur = parseInt(input.value, 10);
      dropdown.innerHTML = DURATION_PRESETS.map(mins => `
        <div class="time-combo-opt ${cur === mins ? 'selected' : ''}" data-val="${mins}">${mins} phút</div>
      `).join('');
      dropdown.classList.remove('hidden');
      const selEl = dropdown.querySelector('.selected');
      if (selEl) dropdown.scrollTop = Math.max(0, selEl.offsetTop - 60);
    }

    input.addEventListener('focus', () => { input.select(); openDurationDropdown(); });
    input.addEventListener('click', () => { if (dropdown.classList.contains('hidden')) openDurationDropdown(); });
    input.addEventListener('blur', () => { setTimeout(() => dropdown.classList.add('hidden'), 130); });
    dropdown.addEventListener('mousedown', (e) => {
      const opt = e.target.closest('.time-combo-opt');
      if (!opt) return;
      e.preventDefault();
      input.value = opt.dataset.val;
      dropdown.classList.add('hidden');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}

function initSchoolSubjectPicker() {
  const dl = document.getElementById('school-subjects-datalist');
  dl.innerHTML = SCHOOL_SUBJECTS_CATALOG
    .map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.code)}</option>`)
    .join('');

  const input = document.getElementById('school-slot-subject-name');
  const dropdown = document.getElementById('school-subject-dropdown');

  function renderDropdown(filter = '') {
    const q = filter.trim().toLowerCase();
    const matched = SCHOOL_SUBJECTS_CATALOG.filter(s =>
      !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
    if (!matched.length) {
      dropdown.classList.add('hidden');
      return;
    }
    dropdown.innerHTML = matched.map(s => `
      <div class="subject-combo-opt" data-sub-pick="${escapeHtml(s.name)}">
        <span class="subject-combo-swatch" style="background:${s.accent};"></span>
        <span>${escapeHtml(s.name)}</span>
        <span class="subject-combo-code">${escapeHtml(s.code)}</span>
      </div>
    `).join('');
    dropdown.classList.remove('hidden');
  }

  input.addEventListener('focus', () => renderDropdown(''));
  input.addEventListener('click', () => renderDropdown(''));
  input.addEventListener('input', () => renderDropdown(input.value));
  input.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 140));

  dropdown.addEventListener('mousedown', (e) => {
    const opt = e.target.closest('[data-sub-pick]');
    if (!opt) return;
    e.preventDefault();
    input.value = opt.dataset.subPick;
    dropdown.classList.add('hidden');
  });
}

// ================= COUNTDOWNS & NAVIGATION =================
function renderCountdowns() {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const hsgTarget = new Date(2027, 0, 26);
  const hsgDiff = Math.ceil((hsgTarget - todayMidnight) / 86400000);
  document.getElementById('cd-hsg-days').textContent =
    hsgDiff > 0 ? `${hsgDiff} ngày` : (hsgDiff === 0 ? 'Hôm nay!' : 'Đã thi');

  const thptTarget = parseDateISO(state.settings.thptDate);
  const thptDiff = Math.ceil((thptTarget - todayMidnight) / 86400000);
  document.getElementById('cd-thpt-date-label').textContent = formatDateVN(state.settings.thptDate);
  document.getElementById('cd-thpt-days').textContent =
    thptDiff > 0 ? `${thptDiff} ngày` : (thptDiff === 0 ? 'Hôm nay!' : 'Đã thi');
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.id === `view-${tabName}`);
  });
  if (tabName === 'calendar') renderCalendar();
  if (tabName === 'exams') renderExamsTable();
  if (tabName === 'mistakes') renderMistakes();
  if (tabName === 'analytics') renderAnalytics();
}

// ================= TAB 1: CALENDAR =================
function renderTimeLabels() {
  const wrap = document.getElementById('cal-time-labels');
  const labels = [`<div class="time-label" style="top: 8px;">04:30</div>`];
  for (let h = 5; h <= 24; h++) {
    const minsFromStart = h * 60 - START_MIN;
    const topPx = (minsFromStart / 60) * HOUR_HEIGHT;
    const adjustedTop = h === 24 ? topPx - 8 : topPx;
    labels.push(`<div class="time-label" style="top: ${adjustedTop}px;">${String(h).padStart(2, '0')}:00</div>`);
  }
  wrap.innerHTML = labels.join('');
}

function getGoalsForDate(isoDate) {
  if (!state.goals[isoDate]) {
    state.goals[isoDate] = [
      { text: '', done: false },
      { text: '', done: false },
      { text: '', done: false }
    ];
  }
  while (state.goals[isoDate].length < 3) {
    state.goals[isoDate].push({ text: '', done: false });
  }
  return state.goals[isoDate];
}

function renderCalendar() {
  const daysHeader = document.getElementById('cal-days-header');
  const goalsRow = document.getElementById('cal-goals-row');
  const colsContainer = document.getElementById('cal-columns-container');
  const todayISO = formatDateISO(new Date());

  const weekDates = [];
  for (let i = 0; i < 7; i++) weekDates.push(addDays(currentWeekStart, i));

  const first = weekDates[0];
  const last = weekDates[6];
  document.getElementById('cal-week-label').textContent =
    `${String(first.getDate()).padStart(2, '0')}/${String(first.getMonth() + 1).padStart(2, '0')} – ${String(last.getDate()).padStart(2, '0')}/${String(last.getMonth() + 1).padStart(2, '0')}/${last.getFullYear()}`;

  document.getElementById('toggle-fixed-tkb').checked = state.settings.showFixedTkb;
  document.getElementById('toggle-school-tkb').checked = state.settings.showSchoolTkb;

  let headHtml = '';
  let goalsHtml = '';
  let colsHtml = '';

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  weekDates.forEach(d => {
    const iso = formatDateISO(d);
    const dow = d.getDay();
    const isToday = iso === todayISO;

    headHtml += `
      <div class="cal-day-head ${isToday ? 'today' : ''}">
        <div class="cal-day-name">${DAY_NAMES_SHORT[dow]}</div>
        <div class="cal-day-num">${d.getDate()}/${d.getMonth() + 1}</div>
      </div>`;

    const dayGoals = getGoalsForDate(iso);
    goalsHtml += `<div class="cal-goal-cell">
      ${dayGoals.map((g, idx) => `
        <div class="goal-item">
          <button type="button" class="goal-check ${g.done ? 'done' : ''}" data-goal-toggle="${iso}|${idx}">
            ${g.done ? '✓' : ''}
          </button>
          <input type="text" class="goal-input ${g.done ? 'done' : ''}"
                 data-goal-input="${iso}|${idx}"
                 value="${escapeHtml(g.text)}"
                 placeholder="Mục tiêu ${idx + 1}..." />
        </div>
      `).join('')}
    </div>`;

    let eventsHtml = '';

    if (state.settings.showFixedTkb) {
      const fixedItems = state.fixedTkb.filter(f => Number(f.dayOfWeek) === dow);
      fixedItems.forEach(f => {
        const top = ((Math.max(f.startMin, START_MIN) - START_MIN) / 60) * HOUR_HEIGHT;
        const height = Math.max(22, ((Math.min(f.endMin, END_MIN) - Math.max(f.startMin, START_MIN)) / 60) * HOUR_HEIGHT);
        eventsHtml += `
          <div class="cal-event fixed-tkb sub-${f.subject}" data-open-tkb="true"
               style="top:${top}px; height:${height}px;" title="TKB cố định: ${escapeHtml(f.title)}">
            <div class="ev-title">[TKB] ${escapeHtml(f.title)}</div>
            <div class="ev-time">${minToTimeStr(f.startMin)}–${minToTimeStr(f.endMin)}</div>
          </div>`;
      });
    }

    if (state.settings.showSchoolTkb && dow >= 1 && dow <= 5) {
      SCHOOL_PERIODS.forEach(p => {
        if (p.onlyMonday && dow !== 1) return;
        const schedKey = `${dow}_${p.id}`;
        const slotCfg = state.schoolSchedule[schedKey];
        const hasSubject = slotCfg && slotCfg.name && slotCfg.name.trim().length > 0;

        const dayTaskKey = `${iso}_${p.id}`;
        const slotTasks = state.schoolDayTasks[dayTaskKey] || [];
        const pendingTasks = slotTasks.filter(t => !t.done);
        const hasPendingExam = pendingTasks.some(t => t.tag === 'Kiểm tra');

        const top = ((p.startMin - START_MIN) / 60) * HOUR_HEIGHT;
        const height = Math.max(20, ((p.endMin - p.startMin) / 60) * HOUR_HEIGHT - 1);

        let badgeHtml = '';
        if (slotTasks.length > 0) {
          if (hasPendingExam) {
            badgeHtml = `<span class="slot-task-badge has-exam" title="Có lịch kiểm tra!">KT (${pendingTasks.length})</span>`;
          } else if (pendingTasks.length > 0) {
            badgeHtml = `<span class="slot-task-badge" title="${pendingTasks.length} việc chưa xong">${pendingTasks.length} việc</span>`;
          } else {
            badgeHtml = `<span class="slot-task-badge all-done" title="Đã hoàn thành hết">✓</span>`;
          }
        }

        const styleVars = hasSubject
          ? (() => {
              const st = getSchoolSubjectStyle(slotCfg.name);
              return `--slot-accent:${st.accent};--slot-bg:${st.bg};--slot-border:${st.border};`;
            })()
          : '';

        const displayTitle = hasSubject ? escapeHtml(slotCfg.name) : `${p.short} · + Điền môn`;
        const tooltipLines = [
          `${p.label} (${minToTimeStr(p.startMin)}–${minToTimeStr(p.endMin)})`,
          hasSubject ? `Môn: ${slotCfg.name}` : 'Nhấn để điền môn & thêm BTVN/Kiểm tra',
          ...slotTasks.map(t => `${t.done ? '✓' : '○'} [${t.tag}] ${t.text}`)
        ];

        eventsHtml += `
          <div class="cal-event school-slot ${hasSubject ? 'filled-slot' : 'empty-slot'}"
               data-school-slot="${iso}|${dow}|${p.id}"
               style="top:${top}px; height:${height}px; ${styleVars}"
               title="${escapeHtml(tooltipLines.join('\n'))}">
            <div class="school-slot-top">
              <span class="school-slot-name">${displayTitle}</span>
              ${badgeHtml}
            </div>
            ${height >= 34 ? `<div class="school-slot-time">${minToTimeStr(p.startMin)}–${minToTimeStr(p.endMin)}</div>` : ''}
          </div>`;
      });
    }

    const dayTasks = state.tasks.filter(t => t.date === iso);
    dayTasks.forEach(t => {
      const s = Math.max(t.startMin, START_MIN);
      const e = Math.min(t.endMin, END_MIN);
      const top = ((s - START_MIN) / 60) * HOUR_HEIGHT;
      const height = Math.max(24, ((e - s) / 60) * HOUR_HEIGHT);
      const linksCount = getTaskLinks(t).length;
      const filesCount = (t.attachments || []).length;
      const extraIcons = `${linksCount ? '🔗' : ''}${filesCount ? '📎' : ''}`;
      eventsHtml += `
        <div class="cal-event sub-${t.subject} status-${t.status}" data-task-id="${t.id}"
             style="top:${top}px; height:${height}px;" title="Nhấn để xem chi tiết">
          <div class="ev-header">
            <span class="status-dot ${t.status}" data-cycle-status="${t.id}" title="Nhấn để đổi trạng thái">${STATUS_SYMBOL[t.status] || ''}</span>
            <span class="ev-title">${escapeHtml(t.title)}</span>
          </div>
          ${height >= 36 ? `
            <div class="ev-meta-row">
              <span class="ev-time">${minToTimeStr(t.startMin)}–${minToTimeStr(t.endMin)}</span>
              ${extraIcons ? `<span class="ev-extra-icons">${extraIcons}</span>` : ''}
            </div>` : ''}
        </div>`;
    });

    if (isToday && nowMin >= START_MIN && nowMin <= END_MIN) {
      const nowTop = ((nowMin - START_MIN) / 60) * HOUR_HEIGHT;
      eventsHtml += `<div class="now-line" style="top:${nowTop}px;"></div>`;
    }

    colsHtml += `<div class="cal-col ${isToday ? 'today-col' : ''}" data-col-date="${iso}">${eventsHtml}</div>`;
  });

  daysHeader.innerHTML = headHtml;
  goalsRow.innerHTML = goalsHtml;
  colsContainer.innerHTML = colsHtml;
}

// ================= TASK DETAIL PREVIEW MODAL =================
function openTaskViewModal(taskId) {
  const t = state.tasks.find(x => x.id === taskId);
  if (!t) return;
  viewingTaskId = taskId;

  const sub = SUBJECTS[t.subject] || SUBJECTS.other;
  const dObj = parseDateISO(t.date);
  const fullDateStr = `${DAY_NAMES_FULL[dObj.getDay()]}, ${formatDateVN(t.date)}`;
  const links = getTaskLinks(t);
  const files = t.attachments || [];

  const content = document.getElementById('task-view-content');
  content.innerHTML = `
    <div class="tv-head-row">
      <div class="tv-swatch" style="background:${sub.color};"></div>
      <div style="flex:1;min-width:0;">
        <div class="tv-title">${escapeHtml(t.title)}</div>
        <div class="tv-datetime">${fullDateStr} · ${minToTimeStr(t.startMin)} – ${minToTimeStr(t.endMin)}</div>
      </div>
    </div>

    <div class="tv-row">
      <div class="tv-icon">◈</div>
      <div class="tv-body" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span class="subject-badge ${t.subject}">${sub.name}</span>
        <select class="tv-status-select" id="tv-inline-status">
          ${STATUS_ORDER.map(st => `<option value="${st}" ${t.status === st ? 'selected' : ''}>${STATUS_LABELS[st]}</option>`).join('')}
        </select>
      </div>
    </div>

    ${t.notes ? `
      <div class="tv-row">
        <div class="tv-icon">☰</div>
        <div class="tv-body">
          <div class="tv-note-text">${escapeHtml(t.notes)}</div>
        </div>
      </div>
    ` : ''}

    ${links.length ? `
      <div class="tv-row">
        <div class="tv-icon">🔗</div>
        <div class="tv-body">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:5px;">Link bài học (${links.length})</div>
          <div class="tv-list">
            ${links.map(l => `
              <div class="tv-link-item">
                <a class="tv-link-a" href="${escapeHtml(normalizeUrl(l.url))}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(l.url)}">
                  ${escapeHtml(l.title || l.url)}
                </a>
                <span style="font-size:11px;color:var(--text-dim);">↗</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    ` : ''}

    ${files.length ? `
      <div class="tv-row">
        <div class="tv-icon">📎</div>
        <div class="tv-body">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:5px;">Tài liệu đính kèm (${files.length}) · Nhấn để xem trực tiếp</div>
          <div class="tv-list">
            ${files.map((f, idx) => `
              <div class="tv-file-item">
                <button type="button" class="tv-file-btn" data-open-view-file="${idx}" title="Mở xem trực tiếp trên tab mới">
                  ${escapeHtml(f.name)}
                </button>
                <span class="attachment-size">${formatBytes(f.size)}</span>
                <a class="btn-icon" style="width:24px;height:24px;font-size:11px;" href="${f.dataUrl}" download="${escapeHtml(f.name)}" title="Tải bản sao về máy">⬇</a>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    ` : ''}
  `;

  document.getElementById('modal-task-view').classList.remove('hidden');
}

// ================= DRAG-TO-CREATE TASK ON CALENDAR =================
function initCalendarDragToCreate() {
  const colsContainer = document.getElementById('cal-columns-container');
  let drag = null;

  function yToSnappedMin(clientY, colRect) {
    const y = Math.max(0, Math.min(colRect.height, clientY - colRect.top));
    const rawMin = START_MIN + (y / HOUR_HEIGHT) * 60;
    const snapped = Math.round(rawMin / 15) * 15;
    return Math.max(START_MIN, Math.min(END_MIN, snapped));
  }

  colsContainer.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.cal-event')) return;
    const col = e.target.closest('[data-col-date]');
    if (!col) return;

    e.preventDefault();
    const rect = col.getBoundingClientRect();
    const startMin = Math.min(END_MIN - 15, yToSnappedMin(e.clientY, rect));

    const preview = document.createElement('div');
    preview.className = 'cal-drag-preview';
    col.appendChild(preview);

    drag = {
      col,
      rect,
      date: col.dataset.colDate,
      startClientY: e.clientY,
      startMin,
      moved: false,
      preview
    };

    const updatePreview = (sMin, eMin) => {
      const top = ((sMin - START_MIN) / 60) * HOUR_HEIGHT;
      const height = Math.max(18, ((eMin - sMin) / 60) * HOUR_HEIGHT);
      preview.style.top = `${top}px`;
      preview.style.height = `${height}px`;
      preview.innerHTML = `
        <div class="cal-drag-preview-title">Nhiệm vụ mới</div>
        <div class="cal-drag-preview-time">${minToTimeStr(sMin)} – ${minToTimeStr(eMin)}</div>`;
    };

    updatePreview(startMin, Math.min(END_MIN, startMin + 60));

    function onMouseMove(ev) {
      if (!drag) return;
      if (Math.abs(ev.clientY - drag.startClientY) > 6) drag.moved = true;
      const cur = yToSnappedMin(ev.clientY, drag.rect);
      let sMin = Math.min(drag.startMin, cur);
      let eMin = Math.max(drag.startMin, cur);
      if (eMin - sMin < 15) eMin = Math.min(END_MIN, sMin + 15);
      drag.sMin = sMin;
      drag.eMin = eMin;
      updatePreview(sMin, eMin);
    }

    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!drag) return;
      const finished = drag;
      drag = null;
      finished.preview.remove();

      const finalStart = finished.moved ? finished.sMin : finished.startMin;
      const finalEnd = finished.moved ? finished.eMin : Math.min(END_MIN, finished.startMin + 60);
      openTaskModal(null, finished.date, finalStart, finalEnd);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

// ================= TASK ADD / EDIT MODAL =================
function renderTaskLinksEditor() {
  const wrap = document.getElementById('task-links-list');
  if (!draftTaskLinks.length) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = draftTaskLinks.map(l => `
    <div class="attachment-item">
      <a class="attachment-name" href="${escapeHtml(normalizeUrl(l.url))}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(l.url)}">
        🔗 ${escapeHtml(l.title || l.url)}
      </a>
      <button type="button" class="btn-icon" style="width:24px;height:24px;font-size:12px;" data-del-link="${l.id}" title="Xóa link">✕</button>
    </div>
  `).join('');
}

function renderTaskAttachmentsEditor() {
  const wrap = document.getElementById('task-attachments-list');
  if (!draftTaskAttachments.length) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = draftTaskAttachments.map((att, idx) => `
    <div class="attachment-item">
      <button type="button" class="attachment-name" data-open-draft-file="${idx}" title="Nhấn để xem trực tiếp trên tab mới">
        📎 ${escapeHtml(att.name)}
      </button>
      <span class="attachment-size">${formatBytes(att.size)}</span>
      <button type="button" class="btn-icon" style="width:24px;height:24px;font-size:12px;" data-del-att="${att.id}" title="Gỡ file">✕</button>
    </div>
  `).join('');
}

function addFilesToDraft(fileList) {
  const files = Array.from(fileList || []);
  files.forEach(file => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showToast(`File "${file.name}" vượt 1.5MB. Nên dán link Google Drive vào mục Link bài học!`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      draftTaskAttachments.push({
        id: uid(),
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: reader.result
      });
      renderTaskAttachmentsEditor();
    };
    reader.readAsDataURL(file);
  });
}

function openTaskModal(task = null, presetDate = null, presetStartMin = null, presetEndMin = null) {
  const modal = document.getElementById('modal-task');
  document.getElementById('modal-task-title').textContent = task ? 'Chỉnh sửa nhiệm vụ' : 'Thêm nhiệm vụ học tập';
  document.getElementById('btn-delete-task').classList.toggle('hidden', !task);

  document.getElementById('task-id').value = task ? task.id : '';
  document.getElementById('task-title').value = task ? task.title : '';
  document.getElementById('task-date').value = task ? task.date : (presetDate || formatDateISO(new Date()));

  const sMin = task ? task.startMin : (presetStartMin ?? 19 * 60);
  const eMin = task ? task.endMin : (presetEndMin ?? Math.min(END_MIN, sMin + 90));
  document.getElementById('task-start').value = minToTimeStr(sMin);
  document.getElementById('task-end').value = minToTimeStr(eMin);
  document.getElementById('task-subject').value = task ? task.subject : 'toan';
  document.getElementById('task-status').value = task ? task.status : 'todo';
  document.getElementById('task-notes').value = task ? (task.notes || '') : '';

  document.getElementById('task-new-link-title').value = '';
  document.getElementById('task-new-link-url').value = '';

  draftTaskLinks = JSON.parse(JSON.stringify(getTaskLinks(task)));
  draftTaskAttachments = task && Array.isArray(task.attachments)
    ? JSON.parse(JSON.stringify(task.attachments))
    : [];

  renderTaskLinksEditor();
  renderTaskAttachmentsEditor();
  modal.classList.remove('hidden');
  document.getElementById('task-title').focus();
}

function openTkbModal() {
  document.getElementById('tkb-start').value = '19:30';
  document.getElementById('tkb-end').value = '21:30';
  renderTkbList();
  document.getElementById('modal-tkb').classList.remove('hidden');
}

function renderTkbList() {
  const list = document.getElementById('tkb-list');
  if (!state.fixedTkb.length) {
    list.innerHTML = `<div style="color:var(--text-dim);font-size:13px;">Chưa có khung giờ cố định nào.</div>`;
    return;
  }
  const sorted = [...state.fixedTkb].sort((a, b) => {
    const da = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
    const db = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
    return da !== db ? da - db : a.startMin - b.startMin;
  });
  list.innerHTML = sorted.map(item => `
    <div class="tkb-row">
      <div>
        <span class="subject-badge ${item.subject}">${DAY_NAMES_SHORT[item.dayOfWeek]}</span>
        <strong style="margin:0 8px;">${escapeHtml(item.title)}</strong>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-muted);">
          ${minToTimeStr(item.startMin)} – ${minToTimeStr(item.endMin)}
        </span>
      </div>
      <button type="button" class="btn-icon" data-del-tkb="${item.id}" title="Xóa">✕</button>
    </div>
  `).join('');
}

// ================= SCHOOL SLOT DETAIL & MATRIX =================
function openSchoolSlotModal(isoDate, dayOfWeek, periodId) {
  const period = SCHOOL_PERIODS.find(p => p.id === periodId);
  if (!period) return;
  activeSchoolSlot = { isoDate, dayOfWeek: Number(dayOfWeek), periodId };

  const schedKey = `${dayOfWeek}_${periodId}`;
  const slotCfg = state.schoolSchedule[schedKey] || { name: '' };

  document.getElementById('school-slot-modal-title').textContent =
    `${period.label} · ${DAY_NAMES_SHORT[dayOfWeek]}, ${formatDateVN(isoDate)}`;
  document.getElementById('school-slot-modal-sub').textContent =
    `Khung giờ cố định: ${minToTimeStr(period.startMin)} – ${minToTimeStr(period.endMin)}`;

  document.getElementById('school-slot-subject-name').value = slotCfg.name || '';
  document.getElementById('school-slot-tasks-heading').textContent =
    `Việc cần làm (BTVN, Kiểm tra...) ngày ${formatDateVN(isoDate)}`;

  renderSchoolSlotTasks();
  document.getElementById('modal-school-slot').classList.remove('hidden');
}

function tagToClass(tag) {
  if (tag === 'BTVN') return 'BTVN';
  if (tag === 'Kiểm tra') return 'KT';
  if (tag === 'Chuẩn bị') return 'CB';
  return 'Khac';
}

function renderSchoolSlotTasks() {
  if (!activeSchoolSlot) return;
  const listEl = document.getElementById('school-slot-tasks-list');
  const key = `${activeSchoolSlot.isoDate}_${activeSchoolSlot.periodId}`;
  const tasks = state.schoolDayTasks[key] || [];

  if (!tasks.length) {
    listEl.innerHTML = `<div style="font-size:12.5px;color:var(--text-dim);padding:10px 0;">Chưa có BTVN hoặc lịch kiểm tra nào cho tiết này trong ngày ${formatDateVN(activeSchoolSlot.isoDate)}.</div>`;
    return;
  }

  listEl.innerHTML = tasks.map(t => `
    <div class="school-task-row ${t.done ? 'done' : ''}">
      <button type="button" class="goal-check ${t.done ? 'done' : ''}" data-st-toggle="${t.id}">
        ${t.done ? '✓' : ''}
      </button>
      <span class="st-tag ${tagToClass(t.tag)}">${escapeHtml(t.tag)}</span>
      <span class="st-text">${escapeHtml(t.text)}</span>
      <button type="button" class="btn-icon" data-st-del="${t.id}" title="Xóa">✕</button>
    </div>
  `).join('');
}

function openSchoolMatrixModal() {
  const table = document.getElementById('school-matrix-table');
  const days = [1, 2, 3, 4, 5];

  let html = `
    <thead>
      <tr>
        <th>Tiết học</th>
        <th>Thứ 2</th>
        <th>Thứ 3</th>
        <th>Thứ 4</th>
        <th>Thứ 5</th>
        <th>Thứ 6</th>
      </tr>
    </thead>
    <tbody>`;

  let lastSession = '';
  SCHOOL_PERIODS.forEach(p => {
    if (p.session !== lastSession) {
      lastSession = p.session;
      html += `<tr class="matrix-divider"><td colspan="6">BUỔI ${p.session.toUpperCase()} ${p.session === 'Sáng' ? '(Có mặt 07:00 · Thứ 2 chào cờ 06:45)' : '(Có mặt 13:30)'}</td></tr>`;
    }
    html += `<tr>
      <td class="matrix-period-cell">
        <strong>${p.label}</strong>
        <small>${minToTimeStr(p.startMin)} – ${minToTimeStr(p.endMin)}</small>
      </td>
      ${days.map(dow => {
        if (p.onlyMonday && dow !== 1) {
          return `<td style="background:rgba(255,255,255,0.02);text-align:center;color:var(--text-dim);font-size:11px;">—</td>`;
        }
        const cfg = state.schoolSchedule[`${dow}_${p.id}`];
        const val = cfg?.name || '';
        return `<td>
          <input type="text" class="matrix-input" list="school-subjects-datalist" data-matrix-cell="${dow}_${p.id}" value="${escapeHtml(val)}" placeholder="Chọn môn..." />
        </td>`;
      }).join('')}
    </tr>`;
  });

  html += `</tbody>`;
  table.innerHTML = html;
  document.getElementById('modal-school-matrix').classList.remove('hidden');
}

// ================= TAB 2: EXAMS, PENDING GRADING & SMART SCORING =================
function createEmptyScoring(subject) {
  if (subject === 'hsg') {
    const defaultMaxes = [4, 4, 3, 3, 3, 3];
    return {
      mode: 'hsg',
      questions: defaultMaxes.map((mx, i) => ({ num: i + 1, max: mx, score: mx, note: '' }))
    };
  }
  const cfg = TN_CONFIG[subject];
  const p2Details = {};
  for (let i = 1; i <= cfg.p2Count; i++) {
    p2Details[i] = { correctItems: 4, level: 'VDT', note: '' };
  }
  return {
    mode: 'tn',
    parts: {
      p1: { score: cfg.p1Max, auto: false, open: false, wrongs: {} },
      p2: { score: cfg.p2Max, auto: false, open: false, questions: p2Details },
      p3: { score: cfg.p3Max, auto: false, open: false, wrongs: {} }
    }
  };
}

function calcDraftTotal(subject, scoring) {
  if (subject === 'hsg') {
    const sum = scoring.questions.reduce((acc, q) => acc + (Number(q.score) || 0), 0);
    const max = scoring.questions.reduce((acc, q) => acc + (Number(q.max) || 0), 0);
    return { total: round2(sum), max: round2(max || 20) };
  }
  const { p1, p2, p3 } = scoring.parts;
  const total = round2((Number(p1.score) || 0) + (Number(p2.score) || 0) + (Number(p3.score) || 0));
  return { total, max: 10 };
}

function updateExamTotalBanner() {
  const subject = document.getElementById('exam-subject').value;
  const { total, max } = calcDraftTotal(subject, draftScoring);
  document.getElementById('exam-total-display').textContent = total.toFixed(2);
  document.getElementById('exam-total-max').textContent = `/ ${max}`;
  document.getElementById('exam-banner-sub').textContent = subject === 'hsg'
    ? 'Mặc định 6 câu tự luận (4-4-3-3-3-3 = 20đ). Ghi chú trực tiếp lỗi mất điểm ở các câu chưa tối đa.'
    : 'Mặc định nhập điểm từng phần, hoặc mở chi tiết để chọn câu sai (tự động đồng bộ điểm).';
}

function syncExamPendingUI() {
  const cb = document.getElementById('exam-is-pending');
  if (!cb) return;
  const isPending = cb.checked;
  const subject = document.getElementById('exam-subject').value;
  const maxScore = SUBJECTS[subject]?.maxScore || 10;

  document.getElementById('pending-exam-bar')?.classList.toggle('is-pending-on', isPending);
  document.getElementById('exam-est-score-wrap')?.classList.toggle('hidden', !isPending);
  const estInput = document.getElementById('exam-est-score');
  if (estInput) estInput.max = String(maxScore);

  document.getElementById('exam-score-banner')?.classList.toggle('hidden', isPending);
  document.getElementById('exam-scoring-container')?.classList.toggle('hidden', isPending);

  const reasonsGroup = document.getElementById('exam-reasons-container')?.closest('.form-group');
  if (reasonsGroup) reasonsGroup.classList.toggle('hidden', isPending);

  const mistakesInp = document.getElementById('exam-mistakes');
  const mistakesLbl = mistakesInp?.previousElementSibling;
  const commentInp = document.getElementById('exam-comment');
  const commentLbl = commentInp?.previousElementSibling;
  const submitBtn = document.querySelector('#form-exam button[type="submit"]');

  if (isPending) {
    if (mistakesLbl) mistakesLbl.textContent = 'Câu đang phân vân / Chỗ kẹt cần lưu ý khi sửa bài';
    if (mistakesInp) mistakesInp.placeholder = 'VD: Phân vân ý d câu 4 Phần II, chưa chắc hướng biến đổi câu 5...';
    if (commentLbl) commentLbl.textContent = 'Cảm nhận chung về đề & Nhịp làm bài';
    if (commentInp) commentInp.placeholder = 'VD: Làm xong sớm 5 phút, đề hơi dài ở phần Hình...';
    if (submitBtn) submitBtn.textContent = 'Lưu đề (Chờ chấm)';
  } else {
    if (mistakesLbl) mistakesLbl.textContent = 'Những lỗi sai cần lưu ý (tự đồng bộ vào Sổ tay lỗi sai)';
    if (mistakesInp) mistakesInp.placeholder = 'VD: Quên kiểm tra điều kiện xác định của logarit, bấm nhầm Rad/Deg...';
    if (commentLbl) commentLbl.textContent = 'Nhận xét chung về đề & Ghi chú';
    if (commentInp) commentInp.placeholder = 'VD: Đề phân hóa tốt ở Phần III, cần tăng tốc Phần I trong 20 phút...';
    if (submitBtn) submitBtn.textContent = 'Lưu kết quả';
  }
}

function recalcTnPartScore(subject, partKey) {
  const cfg = TN_CONFIG[subject];
  const part = draftScoring.parts[partKey];
  part.auto = true;

  if (partKey === 'p1') {
    const wrongCount = Object.keys(part.wrongs).length;
    part.score = round2(Math.max(0, (cfg.p1Count - wrongCount) * cfg.p1Point));
  } else if (partKey === 'p3') {
    const wrongCount = Object.keys(part.wrongs).length;
    part.score = round2(Math.max(0, (cfg.p3Count - wrongCount) * cfg.p3Point));
  } else if (partKey === 'p2') {
    let sum = 0;
    for (let i = 1; i <= cfg.p2Count; i++) {
      const c = part.questions[i]?.correctItems ?? 4;
      sum += TF_SCORES[c] || 0;
    }
    part.score = round2(sum);
  }
}

function renderScoringEditor() {
  const subject = document.getElementById('exam-subject').value;
  const container = document.getElementById('exam-scoring-container');

  if (subject === 'hsg') {
    container.innerHTML = `
      <div class="part-card">
        <div class="part-card-header">
          <div>
            <div class="part-title">Điểm chi tiết 6 câu tự luận (HSG Toán · Thang 4-4-3-3-3-3)</div>
            <div class="part-sub">Nhập điểm từng câu và ghi lại lỗi mất điểm (có thể sửa điểm tối đa hoặc thêm/bớt câu).</div>
          </div>
          <button type="button" class="btn-ghost btn-sm" id="btn-hsg-add-q">+ Thêm câu</button>
        </div>
        <div class="part-detail-body">
          ${draftScoring.questions.map((q, idx) => {
            const lost = Number(q.score) < Number(q.max);
            return `
              <div class="hsg-q-row">
                <strong style="min-width:52px;">Câu ${q.num}</strong>
                <input type="number" step="0.25" min="0" max="${q.max}" class="hsg-score-input" data-hsg-score="${idx}" value="${q.score}" />
                <span style="color:var(--text-dim);">/</span>
                <input type="number" step="0.5" min="0.5" max="20" class="hsg-score-input" data-hsg-max="${idx}" value="${q.max}" title="Điểm tối đa câu ${q.num}" />
                <span style="color:var(--text-dim);font-size:12px;">đ</span>
                ${lost ? `
                  <input type="text" class="wrong-note-input" data-hsg-note="${idx}" value="${escapeHtml(q.note || '')}" placeholder="Ghi lỗi mất điểm câu ${q.num}..." />
                ` : `<span style="font-size:12px;color:var(--sub-hoa);margin-left:6px;">Đạt tối đa</span>`}
                ${draftScoring.questions.length > 1 ? `<button type="button" class="btn-icon" style="margin-left:auto;" data-hsg-del="${idx}" title="Xóa câu">✕</button>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`;
    updateExamTotalBanner();
    return;
  }

  const cfg = TN_CONFIG[subject];
  const partsMeta = [
    { key: 'p1', title: `Phần I: Trắc nghiệm nhiều lựa chọn (${cfg.p1Count} câu × ${cfg.p1Point}đ)`, max: cfg.p1Max, count: cfg.p1Count },
    { key: 'p2', title: `Phần II: Trắc nghiệm Đúng/Sai (${cfg.p2Count} câu · 0.1–0.25–0.5–1.0đ)`, max: cfg.p2Max, count: cfg.p2Count },
    { key: 'p3', title: `Phần III: Trả lời ngắn (${cfg.p3Count} câu × ${cfg.p3Point}đ)`, max: cfg.p3Max, count: cfg.p3Count }
  ];

  container.innerHTML = partsMeta.map(meta => {
    const p = draftScoring.parts[meta.key];
    let detailHtml = '';

    if (p.open) {
      if (meta.key === 'p1' || meta.key === 'p3') {
        const nums = Array.from({ length: meta.count }, (_, i) => i + 1);
        const wrongKeys = Object.keys(p.wrongs).map(Number).sort((a, b) => a - b);
        detailHtml = `
          <div class="part-detail-body">
            <div style="font-size:12px;color:var(--text-muted);">Nhấn vào số câu bạn làm <strong>SAI / BỎ TRỐNG</strong> (điểm phần sẽ tự tính lại):</div>
            <div class="q-grid">
              ${nums.map(n => `
                <button type="button" class="q-btn ${p.wrongs[n] ? 'wrong' : ''}" data-toggle-wrong="${meta.key}|${n}">${n}</button>
              `).join('')}
            </div>
            ${wrongKeys.length ? `
              <div class="wrong-editor-list">
                ${wrongKeys.map(n => {
                  const w = p.wrongs[n];
                  return `
                    <div class="wrong-editor-row">
                      <span class="wrong-q-label">Câu ${n}</span>
                      <div class="level-selector">
                        ${LEVELS.map(l => `
                          <button type="button" class="lvl-btn ${w.level === l.key ? 'active ' + l.key : ''}" data-wrong-lvl="${meta.key}|${n}|${l.key}" title="${l.full}">${l.label}</button>
                        `).join('')}
                      </div>
                      <input type="text" class="wrong-note-input" data-wrong-note="${meta.key}|${n}" value="${escapeHtml(w.note || '')}" placeholder="Ghi chú ngắn cho câu ${n}..." />
                    </div>`;
                }).join('')}
              </div>
            ` : `<div style="font-size:12px;color:var(--sub-hoa);">Chưa đánh dấu câu sai nào ở phần này.</div>`}
          </div>`;
      } else {
        const nums = [1, 2, 3, 4];
        detailHtml = `
          <div class="part-detail-body">
            <div style="font-size:12px;color:var(--text-muted);">Chọn số ý đúng cho từng câu (điểm lũy tiến tự động cộng):</div>
            ${nums.map(n => {
              const q = p.questions[n] || { correctItems: 4, level: 'VDT', note: '' };
              const missed = q.correctItems < 4;
              return `
                <div class="tf-row">
                  <div class="tf-top">
                    <strong style="font-size:13px;">Câu ${n}</strong>
                    <div class="tf-options">
                      ${[4, 3, 2, 1, 0].map(c => `
                        <button type="button" class="tf-opt-btn ${q.correctItems === c ? (c < 4 ? 'active missed' : 'active') : ''}"
                                data-tf-set="${n}|${c}">${c} ý (${TF_SCORES[c]}đ)</button>
                      `).join('')}
                    </div>
                  </div>
                  ${missed ? `
                    <div class="wrong-editor-row" style="padding:5px 8px;">
                      <span style="font-size:11.5px;color:var(--text-muted);">Mức độ ý sai:</span>
                      <div class="level-selector">
                        ${LEVELS.map(l => `
                          <button type="button" class="lvl-btn ${q.level === l.key ? 'active ' + l.key : ''}" data-tf-lvl="${n}|${l.key}" title="${l.full}">${l.label}</button>
                        `).join('')}
                      </div>
                      <input type="text" class="wrong-note-input" data-tf-note="${n}" value="${escapeHtml(q.note || '')}" placeholder="Sai ý nào (a/b/c/d) & lý do..." />
                    </div>
                  ` : ''}
                </div>`;
            }).join('')}
          </div>`;
      }
    }

    return `
      <div class="part-card">
        <div class="part-card-header">
          <div>
            <div class="part-title">${meta.title}</div>
            <div class="part-sub">Tối đa ${meta.max} điểm</div>
          </div>
          <div class="part-controls">
            <span class="sync-badge ${p.auto ? 'auto' : ''}">${p.auto ? 'Tự động' : 'Nhập tay'}</span>
            <input type="number" step="0.05" min="0" max="${meta.max}" class="part-score-input" data-part-manual="${meta.key}" value="${p.score}" />
            <button type="button" class="btn-ghost btn-sm" data-toggle-part="${meta.key}">
              ${p.open ? 'Thu gọn ▴' : 'Chi tiết từng câu ▾'}
            </button>
          </div>
        </div>
        ${detailHtml}
      </div>`;
  }).join('');

  updateExamTotalBanner();
}

function renderReasonChips(subject, selectedReasons = []) {
  const wrap = document.getElementById('exam-reasons-container');
  const pool = subject === 'hsg' ? ERROR_REASONS_HSG : ERROR_REASONS_TN;
  wrap.innerHTML = pool.map(r => `
    <button type="button" class="reason-chip-btn ${selectedReasons.includes(r) ? 'active' : ''}" data-reason="${r}">${r}</button>
  `).join('');
}

function openExamModal(exam = null, preset = null) {
  const modal = document.getElementById('modal-exam');
  const isGradingPending = Boolean(preset?.autoGrade);
  refreshCategorySelects();

  document.getElementById('modal-exam-title').textContent = isGradingPending
    ? 'Nhập điểm & Chữa đề thi'
    : (exam ? 'Chi tiết & Chỉnh sửa đề thi' : 'Thêm kết quả đề thi thử');
  document.getElementById('btn-delete-exam').classList.toggle('hidden', !exam);

  const sub = exam ? exam.subject : (preset?.subject || 'hsg');
  document.getElementById('exam-id').value = exam ? exam.id : '';
  document.getElementById('exam-subject').value = sub;
  document.getElementById('exam-name').value = exam ? exam.name : (preset?.name || '');
  document.getElementById('exam-date').value = exam ? exam.date : formatDateISO(new Date());
  document.getElementById('exam-duration').value = exam ? exam.duration : (preset?.duration || SUBJECTS[sub].defaultTime);
  document.getElementById('exam-default-time-hint').textContent = `(mặc định ${SUBJECTS[sub].defaultTime}p)`;

  const catSel = document.getElementById('exam-category');
  if (catSel) {
    const targetCat = exam?.categoryId || getDefaultCategoryIdForSubject(sub);
    if ((state.examCategories || []).some(c => c.id === targetCat)) catSel.value = targetCat;
  }

  const isPending = isGradingPending ? false : Boolean(exam?.pending);
  const pendingCb = document.getElementById('exam-is-pending');
  if (pendingCb) pendingCb.checked = isPending;

  const hasEst = exam && exam.estimatedScore !== null && exam.estimatedScore !== undefined;
  const estInp = document.getElementById('exam-est-score');
  if (estInp) estInp.value = hasEst ? exam.estimatedScore : '';

  const estCompareEl = document.getElementById('exam-est-compare-hint');
  if (estCompareEl) {
    if (hasEst && !isPending) {
      estCompareEl.textContent = `Bạn từng ước lượng: ${Number(exam.estimatedScore).toFixed(2)}đ`;
      estCompareEl.classList.remove('hidden');
    } else {
      estCompareEl.classList.add('hidden');
    }
  }

  document.getElementById('exam-topics').value = exam ? (exam.topics || '') : '';
  document.getElementById('exam-mistakes').value = exam ? (exam.mistakes || '') : '';
  document.getElementById('exam-comment').value = exam ? (exam.comment || '') : '';

  renderReasonChips(sub, exam ? (exam.reasons || []) : []);

  draftScoring = exam && exam.scoring
    ? JSON.parse(JSON.stringify(exam.scoring))
    : createEmptyScoring(sub);

  renderScoringEditor();
  syncExamPendingUI();
  modal.classList.remove('hidden');
}

function extractWrongItemsFromExam(exam) {
  const list = [];
  if (!exam.scoring || exam.pending) return list;

  if (exam.subject === 'hsg') {
    (exam.scoring.questions || []).forEach(q => {
      if (Number(q.score) < Number(q.max)) {
        list.push({ label: `Câu ${q.num} (${q.score}/${q.max}đ)`, level: null, note: q.note || '' });
      }
    });
  } else if (exam.scoring.parts) {
    const { p1, p2, p3 } = exam.scoring.parts;
    Object.entries(p1.wrongs || {}).forEach(([n, w]) => {
      list.push({ label: `Phần I - Câu ${n}`, level: w.level || 'TH', note: w.note || '' });
    });
    Object.entries(p2.questions || {}).forEach(([n, q]) => {
      if (q.correctItems < 4) {
        list.push({ label: `Phần II - Câu ${n} (${q.correctItems}/4 ý)`, level: q.level || 'VDT', note: q.note || '' });
      }
    });
    Object.entries(p3.wrongs || {}).forEach(([n, w]) => {
      list.push({ label: `Phần III - Câu ${n}`, level: w.level || 'VDT', note: w.note || '' });
    });
  }
  return list;
}

function renderExamsTable() {
  const tbody = document.getElementById('exams-table-body');
  const emptyEl = document.getElementById('exams-empty-state');
  const q = document.getElementById('exam-search-input').value.trim().toLowerCase();

  const pendingCount = state.exams.filter(e => Boolean(e.pending)).length;
  const pendingPill = document.getElementById('filter-pill-pending');
  if (pendingPill) pendingPill.textContent = `Chờ chấm (${pendingCount})`;

  let list = [...state.exams].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  if (examFilterSubject === 'pending') {
    list = list.filter(e => Boolean(e.pending));
  } else if (examFilterSubject !== 'all') {
    list = list.filter(e => e.subject === examFilterSubject);
  }

  if (examFilterCategory !== 'all') {
    list = list.filter(e => e.categoryId === examFilterCategory);
  }

  if (q) {
    list = list.filter(e =>
      (e.name || '').toLowerCase().includes(q) ||
      (e.topics || '').toLowerCase().includes(q) ||
      (e.mistakes || '').toLowerCase().includes(q) ||
      (e.comment || '').toLowerCase().includes(q)
    );
  }

  if (!list.length) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  const buildNotesHtml = (reasons = [], mistakeLabel, mistakes = '', comment = '') => {
    const reasonsHtml = reasons.length
      ? `<div class="reason-tags-wrap">${reasons.map(r => `<span class="reason-tag-sm">${escapeHtml(r)}</span>`).join('')}</div>`
      : '';
    const textParts = [];
    if (mistakes) textParts.push(`<strong>${mistakeLabel}:</strong> ${escapeHtml(mistakes)}`);
    if (comment) textParts.push(`<span style="color:var(--text-muted);">${escapeHtml(comment)}</span>`);
    const combinedText = textParts.join('<br/>');
    const isLong = (mistakes.length + comment.length) > 95;

    return `
      ${reasonsHtml}
      ${combinedText ? `<div class="exam-note-clamp" data-toggle-note>${combinedText}</div>` : ''}
      ${isLong ? `<button type="button" class="btn-expand-note" data-toggle-note>Xem thêm ▾</button>` : ''}`;
  };

  tbody.innerHTML = list.map((e, idx) => {
    const sub = SUBJECTS[e.subject] || SUBJECTS.toan;
    const cat = getExamCategoryObj(e.categoryId);
    const catHtml = `
      <div class="cat-inline-wrap" title="Nhấn để đổi nhanh loại đề">
        <span class="cat-dot" style="background:${cat.color};"></span>
        <select class="cat-inline-select" data-quick-cat="${e.id}">
          ${(state.examCategories || []).map(c => `<option value="${c.id}" ${c.id === e.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>`;
    const isPending = Boolean(e.pending);

    if (isPending) {
      const hasEst = e.estimatedScore !== null && e.estimatedScore !== undefined;
      return `
        <tr>
          <td style="color:var(--text-dim);font-family:'JetBrains Mono',monospace;">${idx + 1}</td>
          <td>
            <div style="font-weight:600;">${escapeHtml(e.name)}</div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">
              ${formatDateVN(e.date)} ${e.topics ? `· ${escapeHtml(e.topics)}` : ''}
            </div>
            ${catHtml}
          </td>
          <td><span class="subject-badge ${e.subject}">${sub.name}</span></td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:12.5px;">${e.duration}p</td>
          <td>
            <span class="pending-badge">⏳ Chờ chấm</span>
            ${hasEst ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;font-family:'JetBrains Mono',monospace;">Ước lượng: ${Number(e.estimatedScore).toFixed(2)}</div>` : ''}
          </td>
          <td>
            <span style="font-size:12px;color:var(--text-dim);font-style:italic;">Chưa vào điểm chi tiết</span>
          </td>
          <td class="exam-notes-cell">
            ${buildNotesHtml([], 'Phân vân', e.mistakes, e.comment)}
          </td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn-ghost btn-sm accent-outline" data-grade-exam="${e.id}">Nhập điểm</button>
              <button class="btn-icon" data-del-exam="${e.id}" title="Xóa">✕</button>
            </div>
          </td>
        </tr>`;
    }

    const wrongs = extractWrongItemsFromExam(e);

    let partsSummary = '';
    if (e.subject === 'hsg' && e.scoring?.questions) {
      partsSummary = e.scoring.questions
        .map(item => `<span class="mini-chip">C${item.num}: ${item.score}/${item.max}</span>`)
        .join('');
    } else if (e.scoring?.parts) {
      const p = e.scoring.parts;
      partsSummary = `
        <span class="mini-chip">PI: ${p.p1.score}</span>
        <span class="mini-chip">PII: ${p.p2.score}</span>
        <span class="mini-chip">PIII: ${p.p3.score}</span>`;
    }

    const levelCounts = {};
    wrongs.forEach(w => { if (w.level) levelCounts[w.level] = (levelCounts[w.level] || 0) + 1; });
    const levelSummary = Object.entries(levelCounts)
      .map(([lvl, cnt]) => `<span class="level-badge ${lvl}">Sai ${cnt} ${lvl}</span>`)
      .join(' ');

    return `
      <tr>
        <td style="color:var(--text-dim);font-family:'JetBrains Mono',monospace;">${idx + 1}</td>
        <td>
          <div style="font-weight:600;">${escapeHtml(e.name)}</div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">
            ${formatDateVN(e.date)} ${e.topics ? `· ${escapeHtml(e.topics)}` : ''}
          </div>
          ${catHtml}
        </td>
        <td><span class="subject-badge ${e.subject}">${sub.name}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:12.5px;">${e.duration}p</td>
        <td><div class="score-pill">${Number(e.totalScore).toFixed(2)} <small>/ ${e.maxScore}</small></div></td>
        <td>
          <div class="part-mini-list">${partsSummary}</div>
          ${levelSummary ? `<div style="margin-top:4px;">${levelSummary}</div>` : ''}
        </td>
        <td class="exam-notes-cell">
          ${buildNotesHtml(e.reasons || [], 'Lỗi', e.mistakes, e.comment)}
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn-ghost btn-sm" data-edit-exam="${e.id}">Sửa</button>
            <button class="btn-icon" data-del-exam="${e.id}" title="Xóa">✕</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ================= TAB 4: MISTAKE NOTEBOOK =================
function renderMistakes() {
  const wrap = document.getElementById('mistakes-list');
  const emptyEl = document.getElementById('mistakes-empty-state');

  const fSub = document.getElementById('mistake-filter-subject').value;
  const fReason = document.getElementById('mistake-filter-reason').value;
  const fLevel = document.getElementById('mistake-filter-level').value;
  const q = document.getElementById('mistake-search-input').value.trim().toLowerCase();

  let cards = state.exams
    .filter(e => !e.pending)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(exam => ({ exam, wrongs: extractWrongItemsFromExam(exam) }))
    .filter(({ exam, wrongs }) => (exam.mistakes && exam.mistakes.trim()) || (exam.reasons && exam.reasons.length) || wrongs.length);

  if (fSub !== 'all') cards = cards.filter(c => c.exam.subject === fSub);
  if (fReason !== 'all') cards = cards.filter(c => (c.exam.reasons || []).includes(fReason));
  if (fLevel !== 'all') cards = cards.filter(c => c.wrongs.some(w => w.level === fLevel));
  if (q) {
    cards = cards.filter(({ exam, wrongs }) =>
      (exam.name || '').toLowerCase().includes(q) ||
      (exam.topics || '').toLowerCase().includes(q) ||
      (exam.mistakes || '').toLowerCase().includes(q) ||
      wrongs.some(w => (w.note || '').toLowerCase().includes(q))
    );
  }

  if (!cards.length) {
    wrap.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  wrap.innerHTML = cards.map(({ exam, wrongs }) => {
    const sub = SUBJECTS[exam.subject];
    const cat = getExamCategoryObj(exam.categoryId);
    const filteredWrongs = fLevel === 'all' ? wrongs : wrongs.filter(w => w.level === fLevel);

    return `
      <div class="mistake-card">
        <div class="mistake-card-head">
          <div>
            <span class="subject-badge ${exam.subject}">${sub.name}</span>
            <span class="cat-badge-sm" style="margin-top:0;margin-left:4px;"><span class="cat-dot" style="background:${cat.color};"></span>${escapeHtml(cat.name)}</span>
            <span style="font-size:11.5px;color:var(--text-dim);margin-left:6px;">${formatDateVN(exam.date)}</span>
            <div class="mistake-exam-title">${escapeHtml(exam.name)}</div>
          </div>
          <div class="score-pill">${Number(exam.totalScore).toFixed(2)}<small>/${exam.maxScore}</small></div>
        </div>

        ${exam.topics ? `<div style="font-size:12px;color:var(--accent-hover);">Chuyên đề: ${escapeHtml(exam.topics)}</div>` : ''}
        ${(exam.reasons && exam.reasons.length) ? `<div>${exam.reasons.map(r => `<span class="reason-tag-sm">${escapeHtml(r)}</span>`).join('')}</div>` : ''}
        ${exam.mistakes ? `<div class="mistake-note-box">${escapeHtml(exam.mistakes)}</div>` : ''}

        ${filteredWrongs.length ? `
          <div class="wrong-q-list">
            ${filteredWrongs.map(w => `
              <div class="wrong-q-item">
                ${w.level ? `<span class="level-badge ${w.level}">${w.level}</span>` : `<span class="level-badge HSG">HSG</span>`}
                <strong>${escapeHtml(w.label)}</strong>
                ${w.note ? `<span style="color:var(--text-muted);">— ${escapeHtml(w.note)}</span>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>`;
  }).join('');
}

// ================= TAB 5: ANALYTICS (MULTI-CHART BY EXAM CATEGORY) =================
function renderAnalytics() {
  const allExams = state.exams;
  const gradedExams = allExams.filter(e => !e.pending && e.totalScore !== null && e.totalScore !== undefined);

  document.getElementById('kpi-total-exams').textContent = allExams.length;

  const avgBy = (sub) => {
    const arr = gradedExams.filter(e => e.subject === sub);
    if (!arr.length) return '—';
    return (arr.reduce((s, e) => s + Number(e.totalScore), 0) / arr.length).toFixed(2);
  };

  document.getElementById('kpi-avg-tn').textContent = `${avgBy('toan')} / ${avgBy('ly')} / ${avgBy('hoa')}`;
  document.getElementById('kpi-avg-hsg').textContent = avgBy('hsg') === '—' ? '—' : `${avgBy('hsg')} / 20`;

  const totalMins = allExams.reduce((s, e) => s + (Number(e.duration) || 0), 0);
  document.getElementById('kpi-total-time').textContent = `${Math.floor(totalMins / 60)}g ${totalMins % 60}p`;

  // Dọn các biểu đồ đường cũ
  trendChartInstances.forEach(c => c.destroy());
  trendChartInstances = [];

  const trendGrid = document.getElementById('analytics-trend-grid');
  const subInfo = SUBJECTS[analyticsSubject];
  const subExams = gradedExams
    .filter(e => e.subject === analyticsSubject)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  if (!subExams.length) {
    trendGrid.classList.add('single-col');
    trendGrid.innerHTML = `
      <div class="chart-card">
        <div class="empty-state" style="padding:36px 16px;">
          Chưa có đề <strong>${subInfo.name}</strong> nào đã chấm điểm để vẽ biểu đồ.
        </div>
      </div>`;
  } else {
    // Gom nhóm theo categoryId
    const groupsMap = new Map();
    subExams.forEach(ex => {
      const cat = getExamCategoryObj(ex.categoryId);
      if (!groupsMap.has(cat.id)) groupsMap.set(cat.id, { cat, exams: [] });
      groupsMap.get(cat.id).exams.push(ex);
    });
    const groups = [...groupsMap.values()];

    // Plugin vẽ trực tiếp số điểm trên đỉnh mỗi cột
    const barValueLabelPlugin = {
      id: 'barValueLabelPlugin',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        ctx.save();
        ctx.font = "600 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = '#eef0f6';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        chart.data.datasets.forEach((ds, dsIdx) => {
          const meta = chart.getDatasetMeta(dsIdx);
          if (meta.hidden) return;
          meta.data.forEach((barEl, idx) => {
            const val = ds.data[idx];
            if (val === null || val === undefined || Number.isNaN(Number(val))) return;
            ctx.fillText(Number(val).toFixed(2), barEl.x, barEl.y - 5);
          });
        });
        ctx.restore();
      }
    };

    if (analyticsChartMode === 'split') {
      trendGrid.classList.toggle('single-col', groups.length === 1);
      trendGrid.innerHTML = groups.map((g, i) => {
        const scores = g.exams.map(e => Number(e.totalScore));
        const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
        const maxVal = Math.max(...scores).toFixed(2);
        return `
          <div class="chart-card">
            <div class="chart-header">
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="cat-dot" style="background:${g.cat.color};width:10px;height:10px;"></span>
                <h3>${subInfo.name} · ${escapeHtml(g.cat.name)}</h3>
              </div>
              <div class="trend-stats-row">
                <span class="trend-stat-chip"><strong>${g.exams.length}</strong> đề</span>
                <span class="trend-stat-chip">TB: <strong>${avg}</strong></span>
                <span class="trend-stat-chip">Cao nhất: <strong>${maxVal}</strong></span>
              </div>
            </div>
            <div class="chart-canvas-wrap">
              <canvas id="trend-canvas-${i}"></canvas>
            </div>
          </div>`;
      }).join('');

      groups.forEach((g, i) => {
        const ctx = document.getElementById(`trend-canvas-${i}`);
        if (!ctx) return;
        const chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: g.exams.map((e, idx) => `#${idx + 1} (${e.date.slice(5)})`),
            datasets: [{
              label: g.cat.name,
              data: g.exams.map(e => Number(e.totalScore)),
              backgroundColor: g.cat.color + 'cc',
              hoverBackgroundColor: g.cat.color,
              borderColor: g.cat.color,
              borderWidth: 1.5,
              borderRadius: { topLeft: 6, topRight: 6 },
              borderSkipped: 'bottom',
              maxBarThickness: 46,
              barPercentage: 0.65,
              categoryPercentage: 0.72
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 20 } },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title: (items) => g.exams[items[0]?.dataIndex]?.name || '',
                  label: (item) => `Điểm: ${Number(item.raw).toFixed(2)} / ${subInfo.maxScore}`
                }
              }
            },
            scales: {
              x: { ticks: { color: '#9398a8' }, grid: { display: false } },
              y: { min: 0, max: subInfo.maxScore, ticks: { color: '#9398a8' }, grid: { color: '#242632' } }
            }
          },
          plugins: [barValueLabelPlugin]
        });
        trendChartInstances.push(chart);
      });
    } else {
      // Combined comparison mode (grouped bar chart)
      trendGrid.classList.add('single-col');
      const maxLen = Math.max(...groups.map(g => g.exams.length));
      const labels = Array.from({ length: maxLen }, (_, i) => `Đề #${i + 1}`);

      trendGrid.innerHTML = `
        <div class="chart-card">
          <div class="chart-header">
            <h3>So sánh phong độ ${subInfo.name} giữa các loại đề</h3>
            <div class="trend-stats-row">
              <span class="trend-stat-chip"><strong>${groups.length}</strong> loại đề</span>
              <span class="trend-stat-chip">Tổng <strong>${subExams.length}</strong> đề đã chấm</span>
            </div>
          </div>
          <div class="chart-canvas-wrap tall">
            <canvas id="trend-canvas-combined"></canvas>
          </div>
        </div>`;

      const ctx = document.getElementById('trend-canvas-combined');
      if (ctx) {
        const chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: groups.map(g => ({
              label: `${g.cat.name} (${g.exams.length})`,
              data: g.exams.map(e => Number(e.totalScore)),
              backgroundColor: g.cat.color + 'cc',
              hoverBackgroundColor: g.cat.color,
              borderColor: g.cat.color,
              borderWidth: 1.5,
              borderRadius: { topLeft: 5, topRight: 5 },
              borderSkipped: 'bottom',
              maxBarThickness: 38
            }))
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 20 } },
            plugins: {
              legend: { labels: { color: '#eef0f6' } },
              tooltip: {
                callbacks: {
                  title: (items) => {
                    const dsIdx = items[0]?.datasetIndex;
                    const ptIdx = items[0]?.dataIndex;
                    return groups[dsIdx]?.exams[ptIdx]?.name || '';
                  },
                  label: (item) => `${item.dataset.label}: ${Number(item.raw).toFixed(2)} / ${subInfo.maxScore}`
                }
              }
            },
            scales: {
              x: { ticks: { color: '#9398a8' }, grid: { display: false } },
              y: { min: 0, max: subInfo.maxScore, ticks: { color: '#9398a8' }, grid: { color: '#242632' } }
            }
          },
          plugins: [barValueLabelPlugin]
        });
        trendChartInstances.push(chart);
      }
    }
  }

  // Lọc 2 biểu đồ lỗi sai theo Môn & Loại đề
  let errExams = gradedExams;
  if (analyticsErrSubject !== 'all') errExams = errExams.filter(e => e.subject === analyticsErrSubject);
  if (analyticsErrCategory !== 'all') errExams = errExams.filter(e => e.categoryId === analyticsErrCategory);

  const reasonCounts = {};
  ALL_ERROR_REASONS.forEach(r => { reasonCounts[r] = 0; });
  errExams.forEach(e => (e.reasons || []).forEach(r => {
    if (reasonCounts[r] !== undefined) reasonCounts[r]++;
  }));

  const ctxReasons = document.getElementById('chart-error-reasons');
  if (chartReasons) chartReasons.destroy();

  chartReasons = new Chart(ctxReasons, {
    type: 'bar',
    data: {
      labels: ALL_ERROR_REASONS,
      datasets: [{
        label: 'Số lần mắc phải',
        data: ALL_ERROR_REASONS.map(r => reasonCounts[r]),
        backgroundColor: '#9f85f799',
        borderColor: '#9f85f7',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1, color: '#9398a8' }, grid: { color: '#242632' } },
        y: { ticks: { color: '#eef0f6' }, grid: { display: false } }
      }
    }
  });

  const lvlCounts = { NB: 0, TH: 0, VDT: 0, VDC: 0 };
  errExams.forEach(e => {
    extractWrongItemsFromExam(e).forEach(w => {
      if (w.level && lvlCounts[w.level] !== undefined) lvlCounts[w.level]++;
    });
  });

  const ctxLevels = document.getElementById('chart-error-levels');
  if (chartLevels) chartLevels.destroy();

  chartLevels = new Chart(ctxLevels, {
    type: 'bar',
    data: {
      labels: ['Nhận biết', 'Thông hiểu', 'Vận dụng thấp', 'Vận dụng cao'],
      datasets: [{
        label: 'Số câu sai',
        data: [lvlCounts.NB, lvlCounts.TH, lvlCounts.VDT, lvlCounts.VDC],
        backgroundColor: ['#81c995aa', '#8ab4f8aa', '#fdd663aa', '#f28b82aa'],
        borderColor: ['#81c995', '#8ab4f8', '#fdd663', '#f28b82'],
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#eef0f6' }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { stepSize: 1, color: '#9398a8' }, grid: { color: '#242632' } }
      }
    }
  });
}

// ================= DEMO DATA =================
async function loadDemoData() {
  const ok = await askConfirm({
    title: 'Nạp dữ liệu mẫu?',
    message: 'Thao tác này sẽ thêm 1 lịch ôn mẫu và 1 đề HSG mẫu vào dữ liệu hiện tại của bạn.',
    confirmText: 'Nạp mẫu'
  });
  if (!ok) return;

  const today = new Date();
  const monISO = formatDateISO(getMonday(today));

  state.schoolDayTasks[`${monISO}_s3`] = [
    { id: uid(), tag: 'Kiểm tra', text: 'Kiểm tra 15p Hình Oxyz', done: false },
    { id: uid(), tag: 'BTVN', text: 'Hoàn thành phiếu bài tập số 2', done: true }
  ];

  const hsgScoring = createEmptyScoring('hsg');
  hsgScoring.questions[2].score = 2.5;
  hsgScoring.questions[2].note = 'Thiếu trường hợp dấu bằng biên';
  hsgScoring.questions[5].score = 2.25;
  hsgScoring.questions[5].note = 'Chưa chứng minh bổ đề hình học đủ chặt';

  state.exams.push({
    id: uid(),
    subject: 'hsg',
    categoryId: getDefaultCategoryIdForSubject('hsg'),
    name: 'Đề luyện HSG TP.HCM — Bộ đề #04',
    date: formatDateISO(today),
    duration: 120,
    pending: false,
    estimatedScore: null,
    totalScore: 18.75,
    maxScore: 20,
    scoring: hsgScoring,
    topics: 'Bất đẳng thức, Hình học phẳng, Tổ hợp',
    reasons: ['Mất điểm trình bày', 'Thiếu thời gian'],
    mistakes: 'Kiểm tra kỹ dấu bằng và chứng minh đầy đủ bổ đề phụ.',
    comment: 'Đạt mục tiêu > 18/20.',
    createdAt: Date.now()
  });

  saveState();
  renderCalendar();
  renderExamsTable();
  renderMistakes();
  renderAnalytics();
  showToast('Đã nạp dữ liệu mẫu thành công!');
}

// ================= EVENT LISTENERS =================
function bindEvents() {
  document.getElementById('btn-confirm-ok').addEventListener('click', () => closeConfirm(true));
  document.getElementById('btn-confirm-cancel').addEventListener('click', () => closeConfirm(false));
  document.getElementById('btn-confirm-close').addEventListener('click', () => closeConfirm(false));
  document.getElementById('modal-confirm').addEventListener('click', (e) => {
    if (e.target.id === 'modal-confirm') closeConfirm(false);
  });

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('btn-edit-thpt-date').addEventListener('click', () => {
    const val = prompt('Nhập ngày thi TN THPT 2027 (định dạng YYYY-MM-DD):', state.settings.thptDate);
    if (val && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
      state.settings.thptDate = val.trim();
      saveState();
      renderCountdowns();
      showToast('Đã cập nhật ngày đếm ngược TN THPT.');
    }
  });

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.closeModal).classList.add('hidden');
    });
  });
  document.querySelectorAll('.modal-backdrop:not(.confirm-backdrop)').forEach(bg => {
    bg.addEventListener('click', (e) => {
      if (e.target === bg) bg.classList.add('hidden');
    });
  });

  // Manage Exam Categories Modal
  document.getElementById('btn-open-exam-cats')?.addEventListener('click', openManageExamCatsModal);
  document.getElementById('btn-analytics-manage-cats')?.addEventListener('click', openManageExamCatsModal);
  document.getElementById('btn-close-exam-cats')?.addEventListener('click', () => {
    document.getElementById('modal-exam-cats').classList.add('hidden');
  });

  document.getElementById('form-add-exam-cat')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = document.getElementById('input-new-exam-cat');
    const name = inp.value.trim();
    if (!name) return;
    const color = CAT_COLORS[state.examCategories.length % CAT_COLORS.length];
    const newCat = { id: 'cat_' + uid(), name, color };
    state.examCategories.push(newCat);
    inp.value = '';
    saveState();
    refreshCategorySelects();
    const modalSel = document.getElementById('exam-category');
    if (modalSel) modalSel.value = newCat.id;
    renderManageExamCatsList();
    renderExamsTable();
    renderAnalytics();
    showToast(`Đã thêm loại đề "${name}".`);
  });

  document.getElementById('exam-cats-manage-list')?.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('[data-del-exam-cat]');
    if (!delBtn) return;
    const catId = delBtn.dataset.delExamCat;
    const cat = getExamCategoryObj(catId);
    const ok = await askConfirm({
      title: `Xóa loại đề "${cat.name}"?`,
      message: 'Các đề thuộc loại này sẽ tự chuyển sang loại mặc định đầu tiên.',
      confirmText: 'Xóa loại đề',
      danger: true
    });
    if (!ok) return;
    state.examCategories = state.examCategories.filter(c => c.id !== catId);
    const fallbackId = state.examCategories[0]?.id || '';
    state.exams.forEach(ex => { if (ex.categoryId === catId) ex.categoryId = fallbackId; });
    saveState();
    refreshCategorySelects();
    renderManageExamCatsList();
    renderExamsTable();
    renderAnalytics();
  });

  // Calendar controls
  document.getElementById('btn-prev-week').addEventListener('click', () => { currentWeekStart = addDays(currentWeekStart, -7); renderCalendar(); });
  document.getElementById('btn-next-week').addEventListener('click', () => { currentWeekStart = addDays(currentWeekStart, 7); renderCalendar(); });
  document.getElementById('btn-today-week').addEventListener('click', () => { currentWeekStart = getMonday(new Date()); renderCalendar(); });
  document.getElementById('toggle-fixed-tkb').addEventListener('change', (e) => { state.settings.showFixedTkb = e.target.checked; saveState(); renderCalendar(); });
  document.getElementById('toggle-school-tkb').addEventListener('change', (e) => { state.settings.showSchoolTkb = e.target.checked; saveState(); renderCalendar(); });
  document.getElementById('btn-open-task-modal').addEventListener('click', () => openTaskModal());
  document.getElementById('btn-open-tkb-modal').addEventListener('click', () => openTkbModal());
  document.getElementById('btn-open-school-matrix').addEventListener('click', () => openSchoolMatrixModal());

  // Goals interactions
  const goalsRow = document.getElementById('cal-goals-row');
  goalsRow.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goal-toggle]');
    if (!btn) return;
    const [iso, idx] = btn.dataset.goalToggle.split('|');
    const goals = getGoalsForDate(iso);
    goals[Number(idx)].done = !goals[Number(idx)].done;
    saveState();
    renderCalendar();
  });
  goalsRow.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-goal-input]');
    if (!inp) return;
    const [iso, idx] = inp.dataset.goalInput.split('|');
    const goals = getGoalsForDate(iso);
    goals[Number(idx)].text = inp.value.trim();
    saveState();
  });

  // Calendar cards click
  const colsContainer = document.getElementById('cal-columns-container');
  colsContainer.addEventListener('click', (e) => {
    const statusBtn = e.target.closest('[data-cycle-status]');
    if (statusBtn) {
      e.stopPropagation();
      const t = state.tasks.find(x => x.id === statusBtn.dataset.cycleStatus);
      if (t) {
        const nextIdx = (STATUS_ORDER.indexOf(t.status) + 1) % STATUS_ORDER.length;
        t.status = STATUS_ORDER[nextIdx];
        saveState();
        renderCalendar();
      }
      return;
    }

    const taskCard = e.target.closest('[data-task-id]');
    if (taskCard) {
      e.stopPropagation();
      openTaskViewModal(taskCard.dataset.taskId);
      return;
    }

    const schoolSlot = e.target.closest('[data-school-slot]');
    if (schoolSlot) {
      e.stopPropagation();
      const [iso, dow, pid] = schoolSlot.dataset.schoolSlot.split('|');
      openSchoolSlotModal(iso, dow, pid);
      return;
    }

    if (e.target.closest('[data-open-tkb]')) {
      e.stopPropagation();
      openTkbModal();
    }
  });

  // Task Preview Modal actions
  document.getElementById('btn-view-edit-task').addEventListener('click', () => {
    const t = state.tasks.find(x => x.id === viewingTaskId);
    if (!t) return;
    document.getElementById('modal-task-view').classList.add('hidden');
    openTaskModal(t);
  });

  document.getElementById('btn-view-delete-task').addEventListener('click', async () => {
    const t = state.tasks.find(x => x.id === viewingTaskId);
    if (!t) return;
    const ok = await askConfirm({
      title: 'Xóa nhiệm vụ này?',
      message: `Bạn có chắc chắn muốn xóa nhiệm vụ "${t.title}" không? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa nhiệm vụ',
      danger: true
    });
    if (!ok) return;
    state.tasks = state.tasks.filter(x => x.id !== t.id);
    saveState();
    document.getElementById('modal-task-view').classList.add('hidden');
    renderCalendar();
    showToast('Đã xóa nhiệm vụ.');
  });

  document.getElementById('task-view-content').addEventListener('change', (e) => {
    if (e.target.id === 'tv-inline-status') {
      const t = state.tasks.find(x => x.id === viewingTaskId);
      if (t) {
        t.status = e.target.value;
        saveState();
        renderCalendar();
      }
    }
  });

  document.getElementById('task-view-content').addEventListener('click', (e) => {
    const fileBtn = e.target.closest('[data-open-view-file]');
    if (!fileBtn) return;
    const t = state.tasks.find(x => x.id === viewingTaskId);
    const att = t?.attachments?.[Number(fileBtn.dataset.openViewFile)];
    if (att) openAttachmentInNewTab(att);
  });

  // Task Modal: Multiple Links
  function addLinkFromInputs() {
    const titleInp = document.getElementById('task-new-link-title');
    const urlInp = document.getElementById('task-new-link-url');
    const url = urlInp.value.trim();
    if (!url) return false;
    draftTaskLinks.push({ id: uid(), title: titleInp.value.trim(), url });
    titleInp.value = '';
    urlInp.value = '';
    renderTaskLinksEditor();
    return true;
  }

  document.getElementById('btn-add-task-link').addEventListener('click', () => {
    if (!addLinkFromInputs()) showToast('Hãy dán đường link vào ô URL trước khi thêm!');
  });

  document.getElementById('task-new-link-url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLinkFromInputs();
    }
  });

  document.getElementById('task-links-list').addEventListener('click', async (e) => {
    const delBtn = e.target.closest('[data-del-link]');
    if (!delBtn) return;
    const ok = await askConfirm({
      title: 'Xóa link bài học?',
      message: 'Bạn có chắc muốn gỡ đường link này khỏi nhiệm vụ?',
      confirmText: 'Xóa link',
      danger: true
    });
    if (!ok) return;
    draftTaskLinks = draftTaskLinks.filter(l => l.id !== delBtn.dataset.delLink);
    renderTaskLinksEditor();
  });

  // Task Modal: Drag & Drop + File Picker
  const dropzone = document.getElementById('task-dropzone');
  const fileInput = document.getElementById('task-files-input');

  dropzone.addEventListener('click', () => fileInput.click());
  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover'); });
  });
  dropzone.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) addFilesToDraft(e.dataTransfer.files); });
  fileInput.addEventListener('change', (e) => { addFilesToDraft(e.target.files); e.target.value = ''; });

  document.getElementById('task-attachments-list').addEventListener('click', async (e) => {
    const openBtn = e.target.closest('[data-open-draft-file]');
    if (openBtn) {
      const att = draftTaskAttachments[Number(openBtn.dataset.openDraftFile)];
      if (att) openAttachmentInNewTab(att);
      return;
    }

    const delBtn = e.target.closest('[data-del-att]');
    if (delBtn) {
      const ok = await askConfirm({
        title: 'Gỡ tài liệu đính kèm?',
        message: 'Bạn có chắc muốn gỡ file này khỏi nhiệm vụ?',
        confirmText: 'Gỡ file',
        danger: true
      });
      if (!ok) return;
      draftTaskAttachments = draftTaskAttachments.filter(a => a.id !== delBtn.dataset.delAtt);
      renderTaskAttachmentsEditor();
    }
  });

  // Save / Delete Task
  document.getElementById('form-task').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const startMin = parseFlexibleTime(document.getElementById('task-start').value);
    const endMin = parseFlexibleTime(document.getElementById('task-end').value);

    if (startMin === null || endMin === null) {
      showToast('Giờ nhập không hợp lệ! Nhập dạng HH:MM trong khoảng 04:30 – 24:00.');
      return;
    }
    if (endMin <= startMin) {
      showToast('Giờ kết thúc phải lớn hơn giờ bắt đầu!');
      return;
    }

    addLinkFromInputs();

    const payload = {
      id: id || uid(),
      title: document.getElementById('task-title').value.trim(),
      date: document.getElementById('task-date').value,
      startMin,
      endMin,
      subject: document.getElementById('task-subject').value,
      status: document.getElementById('task-status').value,
      notes: document.getElementById('task-notes').value.trim(),
      lessonLinks: draftTaskLinks,
      attachments: draftTaskAttachments
    };
    if (id) {
      const idx = state.tasks.findIndex(x => x.id === id);
      if (idx !== -1) state.tasks[idx] = payload;
    } else {
      state.tasks.push(payload);
    }
    saveState();
    document.getElementById('modal-task').classList.add('hidden');
    renderCalendar();
    showToast('Đã lưu nhiệm vụ.');
  });

  document.getElementById('btn-delete-task').addEventListener('click', async () => {
    const id = document.getElementById('task-id').value;
    if (!id) return;
    const ok = await askConfirm({
      title: 'Xóa nhiệm vụ?',
      message: 'Bạn có chắc chắn muốn xóa nhiệm vụ học tập này không?',
      confirmText: 'Xóa nhiệm vụ',
      danger: true
    });
    if (!ok) return;
    state.tasks = state.tasks.filter(x => x.id !== id);
    saveState();
    document.getElementById('modal-task').classList.add('hidden');
    renderCalendar();
    showToast('Đã xóa nhiệm vụ.');
  });

  // School Slot Modal events
  document.getElementById('btn-save-school-slot').addEventListener('click', () => {
    if (!activeSchoolSlot) return;
    const schedKey = `${activeSchoolSlot.dayOfWeek}_${activeSchoolSlot.periodId}`;
    const name = document.getElementById('school-slot-subject-name').value.trim();
    if (name) state.schoolSchedule[schedKey] = { name };
    else delete state.schoolSchedule[schedKey];
    saveState();
    renderCalendar();
    showToast('Đã lưu môn học vào TKB trường.');
  });

  document.getElementById('btn-clear-school-slot').addEventListener('click', async () => {
    if (!activeSchoolSlot) return;
    const ok = await askConfirm({
      title: 'Xóa môn của tiết học này?',
      message: 'Tiết học này sẽ trở về trạng thái trống cho mọi tuần.',
      confirmText: 'Xóa môn',
      danger: true
    });
    if (!ok) return;
    const schedKey = `${activeSchoolSlot.dayOfWeek}_${activeSchoolSlot.periodId}`;
    delete state.schoolSchedule[schedKey];
    document.getElementById('school-slot-subject-name').value = '';
    saveState();
    renderCalendar();
    showToast('Đã xóa môn của tiết này.');
  });

  document.getElementById('form-school-day-task').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!activeSchoolSlot) return;
    const textInp = document.getElementById('school-day-task-text');
    const text = textInp.value.trim();
    if (!text) return;
    const tag = document.getElementById('school-day-task-tag').value;
    const key = `${activeSchoolSlot.isoDate}_${activeSchoolSlot.periodId}`;
    if (!state.schoolDayTasks[key]) state.schoolDayTasks[key] = [];
    state.schoolDayTasks[key].push({ id: uid(), tag, text, done: false });
    textInp.value = '';
    saveState();
    renderSchoolSlotTasks();
    renderCalendar();
  });

  document.getElementById('school-slot-tasks-list').addEventListener('click', async (e) => {
    if (!activeSchoolSlot) return;
    const key = `${activeSchoolSlot.isoDate}_${activeSchoolSlot.periodId}`;
    const tasks = state.schoolDayTasks[key] || [];

    const tog = e.target.closest('[data-st-toggle]');
    if (tog) {
      const item = tasks.find(x => x.id === tog.dataset.stToggle);
      if (item) {
        item.done = !item.done;
        saveState();
        renderSchoolSlotTasks();
        renderCalendar();
      }
      return;
    }

    const del = e.target.closest('[data-st-del]');
    if (del) {
      const ok = await askConfirm({
        title: 'Xóa việc cần làm?',
        message: 'Bạn có chắc muốn xóa mục BTVN / Kiểm tra này?',
        confirmText: 'Xóa',
        danger: true
      });
      if (!ok) return;
      state.schoolDayTasks[key] = tasks.filter(x => x.id !== del.dataset.stDel);
      if (!state.schoolDayTasks[key].length) delete state.schoolDayTasks[key];
      saveState();
      renderSchoolSlotTasks();
      renderCalendar();
    }
  });

  // Save / Reset School Matrix Modal
  document.getElementById('btn-save-school-matrix').addEventListener('click', () => {
    document.querySelectorAll('[data-matrix-cell]').forEach(inp => {
      const key = inp.dataset.matrixCell;
      const val = inp.value.trim();
      if (val) state.schoolSchedule[key] = { name: val };
      else delete state.schoolSchedule[key];
    });
    saveState();
    document.getElementById('modal-school-matrix').classList.add('hidden');
    renderCalendar();
    showToast('Đã lưu Thời khóa biểu lớp 12A2!');
  });

  document.getElementById('btn-reset-12a2-default').addEventListener('click', async () => {
    const ok = await askConfirm({
      title: 'Khôi phục TKB 12A2 mặc định?',
      message: 'Toàn bộ chỉnh sửa TKB trường hiện tại sẽ được đặt lại theo lịch lớp 12A2 ban đầu.',
      confirmText: 'Khôi phục',
      danger: true
    });
    if (!ok) return;
    state.schoolSchedule = getDefault12A2Schedule();
    saveState();
    openSchoolMatrixModal();
    renderCalendar();
    showToast('Đã khôi phục TKB lớp 12A2 mặc định!');
  });

  // Fixed TKB add / delete
  document.getElementById('form-tkb').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('tkb-title').value.trim();
    const startMin = parseFlexibleTime(document.getElementById('tkb-start').value);
    const endMin = parseFlexibleTime(document.getElementById('tkb-end').value);
    const subject = document.getElementById('tkb-subject').value;
    const days = [...document.querySelectorAll('.tkb-day-cb:checked')].map(cb => Number(cb.value));

    if (!days.length) return showToast('Hãy chọn ít nhất 1 thứ trong tuần!');
    if (startMin === null || endMin === null) return showToast('Giờ nhập không hợp lệ (04:30 – 24:00)!');
    if (endMin <= startMin) return showToast('Giờ kết thúc phải sau giờ bắt đầu!');

    days.forEach(d => {
      state.fixedTkb.push({ id: uid(), dayOfWeek: d, startMin, endMin, title, subject });
    });
    document.getElementById('tkb-title').value = '';
    saveState();
    renderTkbList();
    renderCalendar();
    showToast('Đã thêm vào TKB cố định.');
  });

  document.getElementById('tkb-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-del-tkb]');
    if (!btn) return;
    const ok = await askConfirm({
      title: 'Xóa khung giờ cố định?',
      message: 'Khung giờ lặp hàng tuần này sẽ bị xóa khỏi lịch.',
      confirmText: 'Xóa',
      danger: true
    });
    if (!ok) return;
    state.fixedTkb = state.fixedTkb.filter(x => x.id !== btn.dataset.delTkb);
    saveState();
    renderTkbList();
    renderCalendar();
  });

  // Exams Tab filters & modal
  document.getElementById('exam-subject-filters').addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    examFilterSubject = pill.dataset.subject;
    examFilterCategory = 'all';
    const catSel = document.getElementById('exam-filter-category');
    if (catSel) catSel.value = 'all';
    document.querySelectorAll('#exam-subject-filters .filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    renderExamsTable();
  });

  document.getElementById('exams-table-body').addEventListener('change', (e) => {
    const sel = e.target.closest('[data-quick-cat]');
    if (!sel) return;
    const ex = state.exams.find(x => x.id === sel.dataset.quickCat);
    if (!ex) return;
    ex.categoryId = sel.value;
    saveState();
    renderExamsTable();
    renderMistakes();
    renderAnalytics();
    showToast(`Đã chuyển loại đề sang: ${getExamCategoryObj(ex.categoryId).name}`);
  });

  document.getElementById('exam-filter-category')?.addEventListener('change', (e) => {
    examFilterCategory = e.target.value;
    renderExamsTable();
  });

  document.getElementById('exam-search-input').addEventListener('input', renderExamsTable);
  document.getElementById('btn-open-exam-modal').addEventListener('click', () => openExamModal());

  document.getElementById('exams-table-body').addEventListener('click', async (e) => {
    const toggleNote = e.target.closest('[data-toggle-note]');
    if (toggleNote) {
      const cell = toggleNote.closest('.exam-notes-cell');
      const box = cell?.querySelector('.exam-note-clamp');
      const btn = cell?.querySelector('.btn-expand-note');
      if (box) {
        const expanded = box.classList.toggle('expanded');
        if (btn) btn.textContent = expanded ? 'Thu gọn ▴' : 'Xem thêm ▾';
      }
      return;
    }
    const gradeBtn = e.target.closest('[data-grade-exam]');
    if (gradeBtn) {
      const ex = state.exams.find(x => x.id === gradeBtn.dataset.gradeExam);
      if (ex) openExamModal(ex, { autoGrade: true });
      return;
    }

    const editBtn = e.target.closest('[data-edit-exam]');
    if (editBtn) {
      const ex = state.exams.find(x => x.id === editBtn.dataset.editExam);
      if (ex) openExamModal(ex);
      return;
    }

    const delBtn = e.target.closest('[data-del-exam]');
    if (delBtn) {
      const ex = state.exams.find(x => x.id === delBtn.dataset.delExam);
      const ok = await askConfirm({
        title: 'Xóa kết quả đề thi?',
        message: `Bạn có chắc chắn muốn xóa đề "${ex?.name || ''}" không?`,
        confirmText: 'Xóa đề',
        danger: true
      });
      if (!ok) return;
      state.exams = state.exams.filter(x => x.id !== delBtn.dataset.delExam);
      saveState();
      renderExamsTable();
      showToast('Đã xóa đề thi.');
    }
  });

  document.getElementById('exam-is-pending')?.addEventListener('change', syncExamPendingUI);

  document.getElementById('exam-subject').addEventListener('change', (e) => {
    const sub = e.target.value;
    document.getElementById('exam-duration').value = SUBJECTS[sub].defaultTime;
    document.getElementById('exam-default-time-hint').textContent = `(mặc định ${SUBJECTS[sub].defaultTime}p)`;
    const catSel = document.getElementById('exam-category');
    if (catSel && !document.getElementById('exam-id').value) {
      catSel.value = getDefaultCategoryIdForSubject(sub);
    }
    draftScoring = createEmptyScoring(sub);
    renderReasonChips(sub, []);
    renderScoringEditor();
    syncExamPendingUI();
  });

  document.getElementById('exam-reasons-container').addEventListener('click', (e) => {
    const btn = e.target.closest('.reason-chip-btn');
    if (btn) btn.classList.toggle('active');
  });

  // Dynamic Scoring Container events
  const scoringWrap = document.getElementById('exam-scoring-container');
  scoringWrap.addEventListener('click', async (e) => {
    const subject = document.getElementById('exam-subject').value;

    const togglePart = e.target.closest('[data-toggle-part]');
    if (togglePart) {
      const key = togglePart.dataset.togglePart;
      draftScoring.parts[key].open = !draftScoring.parts[key].open;
      renderScoringEditor();
      return;
    }

    const toggleWrong = e.target.closest('[data-toggle-wrong]');
    if (toggleWrong) {
      const [partKey, qNum] = toggleWrong.dataset.toggleWrong.split('|');
      const wrongs = draftScoring.parts[partKey].wrongs;
      if (wrongs[qNum]) delete wrongs[qNum];
      else wrongs[qNum] = { level: partKey === 'p3' ? 'VDT' : 'TH', note: '' };
      recalcTnPartScore(subject, partKey);
      renderScoringEditor();
      return;
    }

    const wrongLvl = e.target.closest('[data-wrong-lvl]');
    if (wrongLvl) {
      const [partKey, qNum, lvl] = wrongLvl.dataset.wrongLvl.split('|');
      if (draftScoring.parts[partKey].wrongs[qNum]) {
        draftScoring.parts[partKey].wrongs[qNum].level = lvl;
        renderScoringEditor();
      }
      return;
    }

    const tfSet = e.target.closest('[data-tf-set]');
    if (tfSet) {
      const [qNum, countStr] = tfSet.dataset.tfSet.split('|');
      const q = draftScoring.parts.p2.questions[qNum] || { correctItems: 4, level: 'VDT', note: '' };
      q.correctItems = Number(countStr);
      draftScoring.parts.p2.questions[qNum] = q;
      recalcTnPartScore(subject, 'p2');
      renderScoringEditor();
      return;
    }

    const tfLvl = e.target.closest('[data-tf-lvl]');
    if (tfLvl) {
      const [qNum, lvl] = tfLvl.dataset.tfLvl.split('|');
      draftScoring.parts.p2.questions[qNum].level = lvl;
      renderScoringEditor();
      return;
    }

    if (e.target.id === 'btn-hsg-add-q') {
      const nextNum = draftScoring.questions.length + 1;
      draftScoring.questions.push({ num: nextNum, max: 3, score: 3, note: '' });
      renderScoringEditor();
      return;
    }

    const hsgDel = e.target.closest('[data-hsg-del]');
    if (hsgDel) {
      const idx = Number(hsgDel.dataset.hsgDel);
      const ok = await askConfirm({
        title: `Xóa Câu ${idx + 1}?`,
        message: 'Câu này sẽ bị xóa khỏi bảng điểm tự luận của đề.',
        confirmText: 'Xóa câu',
        danger: true
      });
      if (!ok) return;
      draftScoring.questions.splice(idx, 1);
      draftScoring.questions.forEach((q, i) => { q.num = i + 1; });
      renderScoringEditor();
    }
  });

  scoringWrap.addEventListener('input', (e) => {
    const manualInp = e.target.closest('[data-part-manual]');
    if (manualInp) {
      const key = manualInp.dataset.partManual;
      draftScoring.parts[key].score = round2(manualInp.value);
      draftScoring.parts[key].auto = false;
      updateExamTotalBanner();
      return;
    }

    const wrongNote = e.target.closest('[data-wrong-note]');
    if (wrongNote) {
      const [partKey, qNum] = wrongNote.dataset.wrongNote.split('|');
      if (draftScoring.parts[partKey].wrongs[qNum]) draftScoring.parts[partKey].wrongs[qNum].note = wrongNote.value;
      return;
    }

    const tfNote = e.target.closest('[data-tf-note]');
    if (tfNote) {
      draftScoring.parts.p2.questions[tfNote.dataset.tfNote].note = tfNote.value;
      return;
    }

    const hsgScore = e.target.closest('[data-hsg-score]');
    if (hsgScore) {
      const idx = Number(hsgScore.dataset.hsgScore);
      const q = draftScoring.questions[idx];
      const wasLost = Number(q.score) < Number(q.max);
      q.score = round2(hsgScore.value);
      const nowLost = Number(q.score) < Number(q.max);
      updateExamTotalBanner();
      if (wasLost !== nowLost) renderScoringEditor();
      return;
    }

    const hsgMax = e.target.closest('[data-hsg-max]');
    if (hsgMax) {
      draftScoring.questions[Number(hsgMax.dataset.hsgMax)].max = round2(hsgMax.value);
      updateExamTotalBanner();
      return;
    }

    const hsgNote = e.target.closest('[data-hsg-note]');
    if (hsgNote) draftScoring.questions[Number(hsgNote.dataset.hsgNote)].note = hsgNote.value;
  });

  // Save / Delete Exam
  document.getElementById('form-exam').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('exam-id').value;
    const subject = document.getElementById('exam-subject').value;
    const categoryId = document.getElementById('exam-category')?.value || getDefaultCategoryIdForSubject(subject);
    const isPending = Boolean(document.getElementById('exam-is-pending')?.checked);

    const parsedDur = parseInt(document.getElementById('exam-duration').value, 10);
    const duration = (!Number.isNaN(parsedDur) && parsedDur > 0) ? parsedDur : SUBJECTS[subject].defaultTime;

    const estRaw = (document.getElementById('exam-est-score')?.value || '').trim();
    const existingExam = id ? state.exams.find(x => x.id === id) : null;
    const estimatedScore = isPending
      ? (estRaw !== '' && !Number.isNaN(Number(estRaw)) ? round2(Number(estRaw)) : null)
      : (existingExam?.estimatedScore ?? null);

    const { total, max } = calcDraftTotal(subject, draftScoring);
    const selectedReasons = isPending
      ? []
      : [...document.querySelectorAll('#exam-reasons-container .reason-chip-btn.active')].map(b => b.dataset.reason);

    const cleanScoring = JSON.parse(JSON.stringify(draftScoring));
    if (cleanScoring.parts) ['p1', 'p2', 'p3'].forEach(k => { cleanScoring.parts[k].open = false; });

    const payload = {
      id: id || uid(),
      subject,
      categoryId,
      name: document.getElementById('exam-name').value.trim(),
      date: document.getElementById('exam-date').value,
      duration,
      pending: isPending,
      estimatedScore,
      totalScore: isPending ? null : total,
      maxScore: isPending ? SUBJECTS[subject].maxScore : max,
      scoring: cleanScoring,
      topics: document.getElementById('exam-topics').value.trim(),
      reasons: selectedReasons,
      mistakes: document.getElementById('exam-mistakes').value.trim(),
      comment: document.getElementById('exam-comment').value.trim(),
      createdAt: existingExam?.createdAt || Date.now()
    };

    if (id) {
      const idx = state.exams.findIndex(x => x.id === id);
      if (idx !== -1) state.exams[idx] = payload;
    } else {
      state.exams.push(payload);
    }

    saveState();
    document.getElementById('modal-exam').classList.add('hidden');
    renderExamsTable();
    renderMistakes();
    renderAnalytics();
    showToast(isPending
      ? 'Đã lưu đề ở trạng thái Chờ chấm!'
      : `Đã lưu kết quả: ${payload.totalScore}/${payload.maxScore} điểm!`
    );
  });

  document.getElementById('btn-delete-exam').addEventListener('click', async () => {
    const id = document.getElementById('exam-id').value;
    if (!id) return;
    const ok = await askConfirm({
      title: 'Xóa kết quả đề thi?',
      message: 'Đề thi này và toàn bộ chi tiết liên quan sẽ bị xóa vĩnh viễn.',
      confirmText: 'Xóa đề',
      danger: true
    });
    if (!ok) return;
    state.exams = state.exams.filter(x => x.id !== id);
    saveState();
    document.getElementById('modal-exam').classList.add('hidden');
    renderExamsTable();
    renderAnalytics();
    showToast('Đã xóa đề thi.');
  });

  // Mistake notebook filters
  ['mistake-filter-subject', 'mistake-filter-reason', 'mistake-filter-level'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderMistakes);
  });
  document.getElementById('mistake-search-input').addEventListener('input', renderMistakes);

  // Analytics controls (Subject, Split/Combined Mode, Error Filters)
  document.getElementById('analytics-subject-pills')?.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    analyticsSubject = pill.dataset.subject;
    document.querySelectorAll('#analytics-subject-pills .filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    renderAnalytics();
  });

  document.getElementById('analytics-mode-switch')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.analytics-mode-btn');
    if (!btn) return;
    analyticsChartMode = btn.dataset.chartMode;
    document.querySelectorAll('#analytics-mode-switch .analytics-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderAnalytics();
  });

  document.getElementById('analytics-err-sub-filter')?.addEventListener('change', (e) => {
    analyticsErrSubject = e.target.value;
    renderAnalytics();
  });

  document.getElementById('analytics-err-cat-filter')?.addEventListener('change', (e) => {
    analyticsErrCategory = e.target.value;
    renderAnalytics();
  });

  // Export / Import JSON Backup
  document.getElementById('btn-export-json').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studyos_backup_${formatDateISO(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống file sao lưu .json!');
  });

  document.getElementById('btn-import-json').addEventListener('click', () => {
    document.getElementById('input-import-json').click();
  });

  document.getElementById('input-import-json').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!imported || typeof imported !== 'object' || !Array.isArray(imported.exams)) {
          throw new Error('Invalid format');
        }
        const ok = await askConfirm({
          title: 'Khôi phục dữ liệu từ file .json?',
          message: 'Dữ liệu hiện tại trên trình duyệt sẽ bị ghi đè hoàn toàn bởi file sao lưu này.',
          confirmText: 'Khôi phục',
          danger: true
        });
        if (ok) {
          const def = defaultState();
          const cats = (Array.isArray(imported.examCategories) && imported.examCategories.length)
            ? imported.examCategories
            : getDefaultExamCategories();
          state = {
            ...def,
            ...imported,
            settings: { ...def.settings, ...(imported.settings || {}), migrated12A2: true },
            schoolSchedule: imported.schoolSchedule || getDefault12A2Schedule(),
            schoolDayTasks: imported.schoolDayTasks || {},
            examCategories: cats
          };
          state.exams.forEach(ex => {
            if (!ex.categoryId) ex.categoryId = getDefaultCategoryIdForSubject(ex.subject, cats);
          });
          saveState();
          refreshCategorySelects();
          renderCountdowns();
          renderCalendar();
          renderExamsTable();
          renderMistakes();
          renderAnalytics();
          showToast('Khôi phục dữ liệu thành công!');
        }
      } catch {
        showToast('File sao lưu không hợp lệ!');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  document.getElementById('btn-load-demo').addEventListener('click', loadDemoData);
}

// ================= INIT =================
function init() {
  injectDynamicControls();
  initTimeCombos();
  initSchoolSubjectPicker();
  initCalendarDragToCreate();
  renderTimeLabels();
  renderCountdowns();
  renderCalendar();
  renderExamsTable();
  bindEvents();

  const scrollWrap = document.getElementById('cal-grid-scroll');
  if (scrollWrap) scrollWrap.scrollTop = 120;
}

document.addEventListener('DOMContentLoaded', init);