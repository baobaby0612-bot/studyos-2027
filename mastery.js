/* ============================================================================
   StudyOS 2027 — Today Dashboard (Mobile-first), Topic Mastery & Exam 1-Click Submit
============================================================================ */
(function () {
  const MASTERY_LEVELS = [
    { val: 0, key: 'none',   label: 'Chưa ôn', weight: 0 },
    { val: 1, key: 'weak',   label: 'Còn yếu', weight: 0.2 },
    { val: 2, key: 'ok',     label: 'Tạm ổn',  weight: 0.6 },
    { val: 3, key: 'strong', label: 'Vững',    weight: 1.0 }
  ];

  const SUBJECT_COLORS = ['#8ab4f8', '#fdd663', '#81c995', '#f28b82', '#c58af9', '#4dd0e1', '#ffab91'];

  function getDefaultMasteryData() {
    const mk = (names) => names.map((name, i) => ({
      id: 'tp_' + Date.now().toString(36) + '_' + i + '_' + Math.random().toString(36).slice(2, 5),
      name,
      level: 0,
      note: ''
    }));
    return [
      {
        id: 'toan',
        name: 'Toán TN',
        color: '#8ab4f8',
        topics: mk([
          'Ứng dụng đạo hàm & Khảo sát hàm số',
          'Vectơ & Hệ tọa độ Oxyz',
          'Các số đặc trưng mẫu số liệu ghép nhóm',
          'Nguyên hàm & Tích phân',
          'Phương trình mặt phẳng, đường thẳng, mặt cầu',
          'Xác suất có điều kiện & Công thức Bayes',
          'Ôn tập 11: Mũ - Logarit, Tổ hợp, Khoảng cách'
        ])
      },
      {
        id: 'ly',
        name: 'Vật lí',
        color: '#fdd663',
        topics: mk([
          'Vật lí nhiệt',
          'Khí lí tưởng',
          'Từ trường & Cảm ứng điện từ',
          'Vật lí hạt nhân',
          'Ôn tập 11: Dao động, Sóng, Điện trường, Dòng điện'
        ])
      },
      {
        id: 'hoa',
        name: 'Hóa học',
        color: '#81c995',
        topics: mk([
          'Ester - Lipid',
          'Carbohydrate',
          'Hợp chất chứa Nitrogen (Amine, Amino acid, Peptide, Protein)',
          'Polymer',
          'Pin điện & Điện phân',
          'Đại cương về kim loại',
          'Nguyên tố nhóm IA & IIA',
          'Kim loại chuyển tiếp dãy thứ nhất & Phức chất',
          'Ôn tập 11: Cân bằng hóa học, Chuẩn độ, Hữu cơ'
        ])
      },
      {
        id: 'hsg',
        name: 'HSG Toán',
        color: '#f28b82',
        topics: mk([
          'Phương trình, Hệ phương trình & Đa thức',
          'Phương trình hàm',
          'Bất đẳng thức & Cực trị',
          'Dãy số & Giới hạn',
          'Giải tích & Ứng dụng đạo hàm',
          'Hình học phẳng & Hình học tọa độ',
          'Số học & Tổ hợp'
        ])
      }
    ];
  }

  let activeMasterySubId = 'toan';
  let activeMasteryLevelFilter = 'all';
  let editingTopicRef = null;
  let lastExamMaxSec = 0;

  function ensureMasteryState() {
    if (!window.state) return;
    if (!Array.isArray(state.mastery) || !state.mastery.length) {
      state.mastery = getDefaultMasteryData();
    }
    if (!state.mastery.some(s => s.id === activeMasterySubId)) {
      activeMasterySubId = state.mastery[0].id;
    }
  }

  // ================= 1. INJECT NAV ITEMS & VIEWS =================
  function injectViewsAndNav() {
    const nav = document.querySelector('.sidebar-nav');
    const main = document.querySelector('.main-content');
    if (!nav || !main) return;

    if (!nav.querySelector('[data-tab="today"]')) {
      const btnToday = document.createElement('button');
      btnToday.className = 'nav-item';
      btnToday.dataset.tab = 'today';
      btnToday.innerHTML = `<span class="nav-icon">◉</span><span>Hôm nay</span>`;
      nav.insertBefore(btnToday, nav.firstChild);
    }

    if (!nav.querySelector('[data-tab="mastery"]')) {
      const btnMastery = document.createElement('button');
      btnMastery.className = 'nav-item';
      btnMastery.dataset.tab = 'mastery';
      btnMastery.innerHTML = `<span class="nav-icon">▦</span><span>Chuyên đề</span>`;
      const analyticsBtn = nav.querySelector('[data-tab="analytics"]');
      if (analyticsBtn) nav.insertBefore(btnMastery, analyticsBtn);
      else nav.appendChild(btnMastery);
    }

    if (!document.getElementById('view-today')) {
      const secToday = document.createElement('section');
      secToday.className = 'view';
      secToday.id = 'view-today';
      secToday.innerHTML = `
        <header class="view-header">
          <div class="header-left">
            <h1 id="today-heading-date">Hôm nay</h1>
          </div>
          <div class="header-right">
            <button type="button" class="btn-ghost btn-sm" id="btn-today-goto-cal">◫ Lịch tuần</button>
            <button type="button" class="btn-ghost btn-sm" id="btn-today-goto-pomo">◎ Focus</button>
            <button type="button" class="btn-primary btn-sm" id="btn-today-add-task">+ Thêm việc</button>
          </div>
        </header>
        <div class="today-dashboard-scroll" id="today-dashboard-body"></div>
      `;
      main.appendChild(secToday);
    }

    if (!document.getElementById('view-mastery')) {
      const secMastery = document.createElement('section');
      secMastery.className = 'view';
      secMastery.id = 'view-mastery';
      secMastery.innerHTML = `
        <header class="view-header">
          <div class="header-left">
            <h1>Bản đồ làm chủ chuyên đề</h1>
          </div>
          <div class="header-right">
            <button type="button" class="btn-ghost btn-sm" id="btn-mastery-add-sub">+ Thêm môn</button>
          </div>
        </header>
        <div class="mastery-scroll-wrap">
          <div class="filter-bar" id="mastery-subject-tabs"></div>
          <div class="mastery-summary-card" id="mastery-summary-card"></div>
          <form class="mastery-add-form" id="form-mastery-add-topic">
            <input type="text" id="input-mastery-topic-name" placeholder="Nhập tên chuyên đề mới cần ôn..." required />
            <input type="text" id="input-mastery-topic-note" placeholder="Ghi chú ngắn (tùy chọn)..." />
            <button type="submit" class="btn-primary btn-sm">+ Thêm chuyên đề</button>
          </form>
          <div class="filter-bar compact" id="mastery-level-filters">
            <button type="button" class="filter-pill active" data-mlvl="all">Tất cả</button>
            <button type="button" class="filter-pill" data-mlvl="0">Chưa ôn</button>
            <button type="button" class="filter-pill" data-mlvl="1">Còn yếu</button>
            <button type="button" class="filter-pill" data-mlvl="2">Tạm ổn</button>
            <button type="button" class="filter-pill" data-mlvl="3">Vững</button>
          </div>
          <div class="mastery-topic-list" id="mastery-topic-list"></div>
        </div>
      `;
      main.appendChild(secMastery);
    }

    // Modal sửa chuyên đề
    if (!document.getElementById('modal-mastery-edit')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="modal-backdrop hidden" id="modal-mastery-edit">
          <div class="modal-box">
            <div class="modal-header">
              <h2>Chỉnh sửa chuyên đề</h2>
              <button type="button" class="btn-icon" id="btn-close-mastery-edit">✕</button>
            </div>
            <form class="modal-body" id="form-mastery-edit">
              <div class="form-group">
                <label>Tên chuyên đề *</label>
                <input type="text" id="edit-mastery-name" required />
              </div>
              <div class="form-group">
                <label>Mức độ làm chủ</label>
                <select id="edit-mastery-level">
                  <option value="0">Chưa ôn</option>
                  <option value="1">Còn yếu</option>
                  <option value="2">Tạm ổn</option>
                  <option value="3">Vững</option>
                </select>
              </div>
              <div class="form-group">
                <label>Ghi chú ôn tập (lỗi hay gặp, dạng bài cần chú ý)</label>
                <textarea id="edit-mastery-note" rows="3" placeholder="VD: Hay nhầm điều kiện cực trị, cần ôn lại bảng thế điện cực..."></textarea>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn-ghost" id="btn-cancel-mastery-edit">Hủy</button>
                <button type="submit" class="btn-primary">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>`;
      document.body.appendChild(wrap.firstElementChild);
    }

    // Modal Nộp bài 1 chạm từ Tab Thi thử
    if (!document.getElementById('modal-exam-submit-bridge')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="modal-backdrop hidden" id="modal-exam-submit-bridge">
          <div class="modal-box">
            <div class="modal-header">
              <h2>Hoàn thành bài thi thử</h2>
              <button type="button" class="btn-icon" id="btn-close-exam-bridge">✕</button>
            </div>
            <div class="modal-body">
              <p style="font-size:13px;color:var(--text-muted);margin:0;">
                Kiểm tra lại thông tin trước khi chuyển thẳng sang <strong>Bảng luyện đề</strong>:
              </p>
              <div class="form-row-2">
                <div class="form-group">
                  <label>Môn thi</label>
                  <select id="bridge-exam-subject">
                    <option value="hsg">HSG Toán</option>
                    <option value="toan">Toán TN</option>
                    <option value="ly">Vật lí</option>
                    <option value="hoa">Hóa học</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Thời gian làm thực tế (phút)</label>
                  <input type="number" id="bridge-exam-duration" min="1" max="300" value="50" />
                </div>
              </div>
              <div class="form-group">
                <label>Tên đề thi</label>
                <input type="text" id="bridge-exam-name" placeholder="VD: Đề thi thử Sở TP.HCM lần 1..." />
              </div>
              <div class="bridge-actions">
                <button type="button" class="btn-primary" id="btn-bridge-grade-now">✓ Nhập điểm ngay</button>
                <button type="button" class="btn-ghost accent-outline" id="btn-bridge-pending">⏳ Lưu Chờ chấm</button>
                <button type="button" class="btn-ghost" id="btn-bridge-cancel">Chỉ đóng</button>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrap.firstElementChild);
    }

    // Quick-pick chuyên đề bên dưới ô #exam-topics trong modal Thêm/Sửa đề thi
    const topicsInp = document.getElementById('exam-topics');
    if (topicsInp && !document.getElementById('exam-mastery-chips')) {
      const chipWrap = document.createElement('div');
      chipWrap.id = 'exam-mastery-chips';
      chipWrap.className = 'exam-mastery-chips';
      topicsInp.insertAdjacentElement('afterend', chipWrap);
    }
  }

  // ================= 2. TODAY DASHBOARD (MÀN HÌNH HÔM NAY) =================
  function renderTodayDashboard() {
    const body = document.getElementById('today-dashboard-body');
    if (!body || !window.state) return;

    const now = new Date();
    const todayISO = formatDateISO(now);
    const dow = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const heading = document.getElementById('today-heading-date');
    if (heading) {
      heading.textContent = `${DAY_NAMES_FULL[dow]}, ${formatDateVN(todayISO)}`;
    }

    // Đếm ngược
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hsgDiff = Math.ceil((new Date(2027, 0, 26) - todayMidnight) / 86400000);
    const thptDiff = Math.ceil((parseDateISO(state.settings.thptDate) - todayMidnight) / 86400000);

    // Đề chờ chấm
    const pendingExams = (state.exams || []).filter(e => Boolean(e.pending));

    // 3 mục tiêu hôm nay
    const goals = getGoalsForDate(todayISO);

    // Gom lịch trình hôm nay theo giờ
    const timeline = [];

    if (state.settings.showSchoolTkb && dow >= 1 && dow <= 5) {
      SCHOOL_PERIODS.forEach(p => {
        if (p.onlyMonday && dow !== 1) return;
        const cfg = state.schoolSchedule?.[`${dow}_${p.id}`];
        const slotTasks = state.schoolDayTasks?.[`${todayISO}_${p.id}`] || [];
        const hasSubject = cfg && cfg.name && cfg.name.trim();
        if (!hasSubject && !slotTasks.length) return;
        const st = hasSubject ? getSchoolSubjectStyle(cfg.name) : { accent: '#9aa0a6' };
        timeline.push({
          kind: 'school',
          startMin: p.startMin,
          endMin: p.endMin,
          title: hasSubject ? cfg.name : p.label,
          subLabel: p.label,
          accent: st.accent,
          slotTasks,
          meta: `${todayISO}|${dow}|${p.id}`
        });
      });
    }

    if (state.settings.showFixedTkb) {
      (state.fixedTkb || []).filter(f => Number(f.dayOfWeek) === dow).forEach(f => {
        const sub = SUBJECTS[f.subject] || SUBJECTS.other;
        timeline.push({
          kind: 'fixed',
          startMin: f.startMin,
          endMin: f.endMin,
          title: f.title,
          subLabel: 'Lịch cố định',
          accent: sub.color
        });
      });
    }

    (state.tasks || []).filter(t => t.date === todayISO).forEach(t => {
      const sub = SUBJECTS[t.subject] || SUBJECTS.other;
      timeline.push({
        kind: 'task',
        startMin: t.startMin,
        endMin: t.endMin,
        title: t.title,
        subLabel: sub.name,
        accent: sub.color,
        task: t
      });
    });

    timeline.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

    let markedUpcoming = false;
    const timelineHtml = timeline.length ? timeline.map(item => {
      const isNow = nowMin >= item.startMin && nowMin < item.endMin;
      const isPast = nowMin >= item.endMin;
      let stateBadge = '';
      if (isNow) {
        stateBadge = `<span class="today-pill-live">Đang diễn ra</span>`;
      } else if (!isPast && !markedUpcoming) {
        markedUpcoming = true;
        stateBadge = `<span class="today-pill-next">Sắp tới</span>`;
      }

      if (item.kind === 'school') {
        const pendingCnt = item.slotTasks.filter(x => !x.done).length;
        const hasKt = item.slotTasks.some(x => !x.done && x.tag === 'Kiểm tra');
        const taskTag = item.slotTasks.length
          ? (hasKt
              ? `<span class="slot-task-badge has-exam">KT (${pendingCnt})</span>`
              : (pendingCnt > 0
                  ? `<span class="slot-task-badge">${pendingCnt} việc</span>`
                  : `<span class="slot-task-badge all-done">✓ Xong</span>`))
          : '';
        return `
          <div class="today-tl-item ${isNow ? 'is-now' : ''} ${isPast ? 'is-past' : ''}"
               style="--tl-accent:${item.accent};" data-today-school="${item.meta}">
            <div class="today-tl-time">${minToTimeStr(item.startMin)}<small>${minToTimeStr(item.endMin)}</small></div>
            <div class="today-tl-body">
              <div class="today-tl-top">
                <strong class="today-tl-title">${escapeHtml(item.title)}</strong>
                <div class="today-tl-badges">${stateBadge}${taskTag}</div>
              </div>
              <div class="today-tl-sub">${escapeHtml(item.subLabel)} · TKB trường</div>
            </div>
          </div>`;
      }

      if (item.kind === 'fixed') {
        return `
          <div class="today-tl-item ${isNow ? 'is-now' : ''} ${isPast ? 'is-past' : ''}"
               style="--tl-accent:${item.accent};" data-today-fixed="true">
            <div class="today-tl-time">${minToTimeStr(item.startMin)}<small>${minToTimeStr(item.endMin)}</small></div>
            <div class="today-tl-body">
              <div class="today-tl-top">
                <strong class="today-tl-title">[TKB] ${escapeHtml(item.title)}</strong>
                <div class="today-tl-badges">${stateBadge}</div>
              </div>
              <div class="today-tl-sub">${escapeHtml(item.subLabel)}</div>
            </div>
          </div>`;
      }

      const t = item.task;
      return `
        <div class="today-tl-item status-${t.status} ${isNow ? 'is-now' : ''} ${isPast ? 'is-past' : ''}"
             style="--tl-accent:${item.accent};" data-today-task="${t.id}">
          <div class="today-tl-time">${minToTimeStr(item.startMin)}<small>${minToTimeStr(item.endMin)}</small></div>
          <div class="today-tl-body">
            <div class="today-tl-top">
              <div style="display:flex;align-items:center;gap:7px;min-width:0;">
                <span class="status-dot ${t.status}" data-today-cycle="${t.id}" title="Đổi trạng thái">${STATUS_SYMBOL[t.status] || ''}</span>
                <strong class="today-tl-title">${escapeHtml(t.title)}</strong>
              </div>
              <div class="today-tl-badges">${stateBadge}</div>
            </div>
            <div class="today-tl-sub">${escapeHtml(item.subLabel)} · ${STATUS_LABELS[t.status] || t.status}</div>
          </div>
        </div>`;
    }).join('') : `<div class="empty-state" style="padding:22px 12px;">Hôm nay chưa có lịch nào. Bấm <strong>+ Thêm việc</strong> để lên kế hoạch!</div>`;

    body.innerHTML = `
      <div class="today-cd-grid">
        <div class="today-cd-card">
          <span>HSG Toán TP.HCM</span>
          <strong>${hsgDiff > 0 ? `Còn ${hsgDiff} ngày` : (hsgDiff === 0 ? 'Hôm nay!' : 'Đã thi')}</strong>
        </div>
        <div class="today-cd-card">
          <span>TN THPT (${formatDateVN(state.settings.thptDate)})</span>
          <strong>${thptDiff > 0 ? `Còn ${thptDiff} ngày` : (thptDiff === 0 ? 'Hôm nay!' : 'Đã thi')}</strong>
        </div>
      </div>

      ${pendingExams.length ? `
        <div class="today-pending-alert" id="btn-today-open-pending">
          <span>⏳ Bạn đang có <strong>${pendingExams.length} đề Chờ chấm điểm</strong></span>
          <span class="today-alert-link">Nhập điểm →</span>
        </div>
      ` : ''}

      <div class="today-card">
        <div class="today-card-title">Mục tiêu hôm nay (tối đa 3)</div>
        <div class="today-goals-list">
          ${goals.map((g, idx) => `
            <div class="goal-item today-goal-row">
              <button type="button" class="goal-check ${g.done ? 'done' : ''}" data-today-goal-toggle="${todayISO}|${idx}">
                ${g.done ? '✓' : ''}
              </button>
              <input type="text" class="goal-input ${g.done ? 'done' : ''}"
                     data-today-goal-input="${todayISO}|${idx}"
                     value="${escapeHtml(g.text)}"
                     placeholder="Mục tiêu quan trọng ${idx + 1}..." />
            </div>
          `).join('')}
        </div>
      </div>

      <div class="today-card">
        <div class="today-card-title">Lịch trình hôm nay (${timeline.length} khung giờ)</div>
        <div class="today-tl-list">${timelineHtml}</div>
      </div>
    `;
  }

  // ================= 3. TOPIC MASTERY (BẢN ĐỒ CHUYÊN ĐỀ) =================
  function renderMastery() {
    ensureMasteryState();
    const tabsWrap = document.getElementById('mastery-subject-tabs');
    const summaryWrap = document.getElementById('mastery-summary-card');
    const listWrap = document.getElementById('mastery-topic-list');
    if (!tabsWrap || !summaryWrap || !listWrap) return;

    tabsWrap.innerHTML = state.mastery.map(sub => `
      <button type="button" class="filter-pill ${sub.id === activeMasterySubId ? 'active' : ''}" data-msub="${sub.id}">
        <span class="cat-dot" style="background:${sub.color};display:inline-block;margin-right:6px;"></span>${escapeHtml(sub.name)}
      </button>
    `).join('');

    const curSub = state.mastery.find(s => s.id === activeMasterySubId) || state.mastery[0];
    const topics = curSub.topics || [];
    const total = topics.length;
    const strongCnt = topics.filter(t => t.level === 3).length;
    const weakCnt = topics.filter(t => t.level === 1).length;
    const scoreSum = topics.reduce((acc, t) => acc + (MASTERY_LEVELS[t.level]?.weight || 0), 0);
    const pct = total ? Math.round((scoreSum / total) * 100) : 0;

    summaryWrap.innerHTML = `
      <div class="mastery-sum-top">
        <div>
          <strong style="font-size:15px;">${escapeHtml(curSub.name)}</strong>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
            Vững: <strong>${strongCnt}/${total}</strong> · Còn yếu: <strong style="color:#f28b82;">${weakCnt}</strong>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="mastery-pct-badge" style="color:${curSub.color};">${pct}%</span>
          ${state.mastery.length > 1 ? `<button type="button" class="btn-icon" id="btn-mastery-del-sub" title="Xóa môn này">✕</button>` : ''}
        </div>
      </div>
      <div class="mastery-progress-track">
        <div class="mastery-progress-fill" style="width:${pct}%;background:${curSub.color};"></div>
      </div>
    `;

    const filtered = activeMasteryLevelFilter === 'all'
      ? topics
      : topics.filter(t => String(t.level) === String(activeMasteryLevelFilter));

    if (!filtered.length) {
      listWrap.innerHTML = `<div class="empty-state" style="padding:26px 12px;">Không có chuyên đề nào ở trạng thái này.</div>`;
      return;
    }

    listWrap.innerHTML = filtered.map(t => {
      const realIdx = topics.findIndex(x => x.id === t.id);
      const lvl = MASTERY_LEVELS[t.level] || MASTERY_LEVELS[0];
      return `
        <div class="mastery-topic-row lvl-${lvl.key}">
          <div class="mastery-order-btns">
            <button type="button" class="m-ord-btn" data-m-move="${t.id}|-1" ${realIdx === 0 ? 'disabled' : ''} title="Lên">▲</button>
            <button type="button" class="m-ord-btn" data-m-move="${t.id}|1" ${realIdx === total - 1 ? 'disabled' : ''} title="Xuống">▼</button>
          </div>
          <div class="mastery-topic-info" data-m-edit="${t.id}">
            <div class="mastery-topic-name">${escapeHtml(t.name)}</div>
            ${t.note ? `<div class="mastery-topic-note">${escapeHtml(t.note)}</div>` : ''}
          </div>
          <div class="mastery-topic-actions">
            <button type="button" class="mastery-lvl-pill lvl-${lvl.key}" data-m-cycle="${t.id}" title="Chạm để đổi mức độ làm chủ">
              ${lvl.label}
            </button>
            <button type="button" class="btn-icon" data-m-edit="${t.id}" title="Sửa chuyên đề">✎</button>
            <button type="button" class="btn-icon" data-m-del="${t.id}" title="Xóa chuyên đề">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderExamTopicSuggestions() {
    const wrap = document.getElementById('exam-mastery-chips');
    const subSel = document.getElementById('exam-subject');
    if (!wrap || !subSel) return;
    ensureMasteryState();
    const subObj = state.mastery.find(s => s.id === subSel.value);
    if (!subObj || !subObj.topics?.length) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = `
      <span class="exam-chips-label">Gợi ý chuyên đề:</span>
      ${subObj.topics.map(t => `
        <button type="button" class="exam-topic-chip" data-pick-topic="${escapeHtml(t.name)}">+ ${escapeHtml(t.name)}</button>
      `).join('')}
    `;
  }

  // ================= 4. NỘP BÀI 1 CHẠM TỪ TAB THI THỬ =================
  function parseClockToSec(text = '') {
    const parts = text.trim().split(':').map(Number);
    if (parts.some(Number.isNaN)) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
  }

  function detectActiveExamSubject() {
    const metaBar = document.querySelector('.pomo-exam-meta-bar');
    if (metaBar) {
      const sel = metaBar.querySelector('select');
      if (sel && SUBJECTS[sel.value]) return sel.value;
    }
    const activeTab = document.querySelector('#view-pomodoro .pomo-mode-btn.active');
    const txt = (activeTab?.textContent || '').toLowerCase();
    if (txt.includes('hsg')) return 'hsg';
    if (txt.includes('lí') || txt.includes('lý')) return 'ly';
    if (txt.includes('hóa')) return 'hoa';
    if (txt.includes('toán')) return 'toan';
    return 'toan';
  }

  function openExamSubmitBridge() {
    // Tạm dừng đồng hồ nếu đang chạy
    const startBtn = document.querySelector('#view-pomodoro .pomo-start-btn');
    if (startBtn && /pause|tạm dừng/i.test(startBtn.textContent || '')) {
      startBtn.click();
    }

    const sub = detectActiveExamSubject();
    const defaultMins = SUBJECTS[sub]?.defaultTime || 50;
    const defaultTotalSec = defaultMins * 60;

    const clockEl = document.querySelector('#view-pomodoro .pomo-clock');
    const remSec = parseClockToSec(clockEl?.textContent || '');
    const baseTotal = Math.max(defaultTotalSec, lastExamMaxSec || defaultTotalSec);

    let elapsedMin = defaultMins;
    if (remSec !== null && remSec < baseTotal) {
      elapsedMin = Math.max(1, Math.round((baseTotal - remSec) / 60));
    }

    const nameInp = document.querySelector('#view-pomodoro .pomo-exam-name-input');
    const examName = (nameInp?.value || '').trim();

    document.getElementById('bridge-exam-subject').value = sub;
    document.getElementById('bridge-exam-duration').value = elapsedMin;
    document.getElementById('bridge-exam-name').value = examName;
    document.getElementById('modal-exam-submit-bridge').classList.remove('hidden');
  }

  function initExamSubmitButton() {
    const dock = document.querySelector('#view-pomodoro .pomo-dock');
    const metaBar = document.querySelector('#view-pomodoro .pomo-exam-meta-bar');
    if (!dock || !metaBar || document.getElementById('btn-pomo-submit-exam')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btn-pomo-submit-exam';
    btn.className = 'pomo-dock-btn pomo-submit-exam-btn hidden';
    btn.innerHTML = '✓ Nộp bài';
    btn.title = 'Chốt giờ và chuyển thẳng sang Bảng luyện đề';

    const startBtn = dock.querySelector('.pomo-start-btn');
    if (startBtn) startBtn.insertAdjacentElement('afterend', btn);
    else dock.appendChild(btn);

    btn.addEventListener('click', openExamSubmitBridge);

    const syncVisibility = () => {
      const isExamMode = !metaBar.classList.contains('hidden') &&
        window.getComputedStyle(metaBar).display !== 'none';
      btn.classList.toggle('hidden', !isExamMode);
      if (isExamMode) {
        const clockEl = document.querySelector('#view-pomodoro .pomo-clock');
        const sec = parseClockToSec(clockEl?.textContent || '');
        if (sec && sec > lastExamMaxSec) lastExamMaxSec = sec;
      } else {
        lastExamMaxSec = 0;
      }
    };

    const obs = new MutationObserver(syncVisibility);
    obs.observe(metaBar, { attributes: true, attributeFilter: ['class', 'style'] });
    document.getElementById('view-pomodoro')?.addEventListener('click', () => setTimeout(syncVisibility, 40));
    syncVisibility();
  }

  // ================= 5. HOOK SWITCHTAB & EVENTS =================
  function bindEvents() {
    // Wrap switchTab để hỗ trợ 2 tab mới + ẩn/hiện nút ☰
    const origSwitchTab = window.switchTab;
    window.switchTab = function (tabName) {
      if (typeof origSwitchTab === 'function') origSwitchTab(tabName);
      if (tabName === 'today') renderTodayDashboard();
      if (tabName === 'mastery') renderMastery();
      const fab = document.getElementById('mobile-menu-fab');
      if (fab) fab.classList.toggle('hidden', tabName === 'pomodoro');
    };

    // Gắn click cho 2 nút nav vừa thêm
    document.querySelectorAll('.sidebar-nav .nav-item[data-tab="today"], .sidebar-nav .nav-item[data-tab="mastery"]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.classList.remove('mobile-menu-open');
        window.switchTab(btn.dataset.tab);
      });
    });

    // Today Dashboard actions
    document.getElementById('btn-today-goto-cal')?.addEventListener('click', () => window.switchTab('calendar'));
    document.getElementById('btn-today-goto-pomo')?.addEventListener('click', () => window.switchTab('pomodoro'));
    document.getElementById('btn-today-add-task')?.addEventListener('click', () => {
      if (typeof openTaskModal === 'function') openTaskModal(null, formatDateISO(new Date()));
    });

    const todayBody = document.getElementById('today-dashboard-body');
    todayBody?.addEventListener('click', (e) => {
      if (e.target.closest('#btn-today-open-pending')) {
        window.switchTab('exams');
        document.getElementById('filter-pill-pending')?.click();
        return;
      }

      const gBtn = e.target.closest('[data-today-goal-toggle]');
      if (gBtn) {
        const [iso, idx] = gBtn.dataset.todayGoalToggle.split('|');
        const goals = getGoalsForDate(iso);
        goals[Number(idx)].done = !goals[Number(idx)].done;
        saveState();
        renderTodayDashboard();
        if (typeof renderCalendar === 'function') renderCalendar();
        return;
      }

      const cyc = e.target.closest('[data-today-cycle]');
      if (cyc) {
        e.stopPropagation();
        const t = state.tasks.find(x => x.id === cyc.dataset.todayCycle);
        if (t) {
          const nextIdx = (STATUS_ORDER.indexOf(t.status) + 1) % STATUS_ORDER.length;
          t.status = STATUS_ORDER[nextIdx];
          saveState();
          renderTodayDashboard();
          if (typeof renderCalendar === 'function') renderCalendar();
        }
        return;
      }

      const taskEl = e.target.closest('[data-today-task]');
      if (taskEl && typeof openTaskViewModal === 'function') {
        openTaskViewModal(taskEl.dataset.todayTask);
        return;
      }

      const schEl = e.target.closest('[data-today-school]');
      if (schEl && typeof openSchoolSlotModal === 'function') {
        const [iso, dow, pid] = schEl.dataset.todaySchool.split('|');
        openSchoolSlotModal(iso, dow, pid);
        return;
      }

      if (e.target.closest('[data-today-fixed]') && typeof openTkbModal === 'function') {
        openTkbModal();
      }
    });

    todayBody?.addEventListener('change', (e) => {
      const inp = e.target.closest('[data-today-goal-input]');
      if (!inp) return;
      const [iso, idx] = inp.dataset.todayGoalInput.split('|');
      const goals = getGoalsForDate(iso);
      goals[Number(idx)].text = inp.value.trim();
      saveState();
      if (typeof renderCalendar === 'function') renderCalendar();
    });

    // Tự cập nhật Today Dashboard sau khi đóng modal chỉnh sửa task / TKB
    const origSave = window.saveState;
    if (typeof origSave === 'function') {
      window.saveState = function () {
        origSave();
        if (document.getElementById('view-today')?.classList.contains('active')) {
          renderTodayDashboard();
        }
      };
    }

    // Topic Mastery events
    document.getElementById('mastery-subject-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-msub]');
      if (!btn) return;
      activeMasterySubId = btn.dataset.msub;
      renderMastery();
    });

    document.getElementById('mastery-level-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mlvl]');
      if (!btn) return;
      activeMasteryLevelFilter = btn.dataset.mlvl;
      document.querySelectorAll('#mastery-level-filters .filter-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      renderMastery();
    });

    document.getElementById('btn-mastery-add-sub')?.addEventListener('click', () => {
      const name = prompt('Nhập tên môn học mới muốn thêm vào Bản đồ chuyên đề (VD: Tiếng Anh, Sinh học):');
      if (!name || !name.trim()) return;
      ensureMasteryState();
      const newSub = {
        id: 'sub_' + uid(),
        name: name.trim(),
        color: SUBJECT_COLORS[state.mastery.length % SUBJECT_COLORS.length],
        topics: []
      };
      state.mastery.push(newSub);
      activeMasterySubId = newSub.id;
      saveState();
      renderMastery();
      showToast(`Đã thêm môn "${newSub.name}".`);
    });

    document.getElementById('mastery-summary-card')?.addEventListener('click', async (e) => {
      if (!e.target.closest('#btn-mastery-del-sub')) return;
      const curSub = state.mastery.find(s => s.id === activeMasterySubId);
      if (!curSub) return;
      const ok = await askConfirm({
        title: `Xóa môn "${curSub.name}"?`,
        message: 'Toàn bộ danh sách chuyên đề trong môn này sẽ bị xóa khỏi Bản đồ làm chủ.',
        confirmText: 'Xóa môn',
        danger: true
      });
      if (!ok) return;
      state.mastery = state.mastery.filter(s => s.id !== activeMasterySubId);
      activeMasterySubId = state.mastery[0]?.id || 'toan';
      saveState();
      renderMastery();
      showToast('Đã xóa môn học.');
    });

    document.getElementById('form-mastery-add-topic')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInp = document.getElementById('input-mastery-topic-name');
      const noteInp = document.getElementById('input-mastery-topic-note');
      const name = nameInp.value.trim();
      if (!name) return;
      ensureMasteryState();
      const curSub = state.mastery.find(s => s.id === activeMasterySubId);
      if (!curSub) return;
      curSub.topics.push({
        id: 'tp_' + uid(),
        name,
        level: 0,
        note: noteInp.value.trim()
      });
      nameInp.value = '';
      noteInp.value = '';
      saveState();
      renderMastery();
      showToast('Đã thêm chuyên đề mới!');
    });

    document.getElementById('mastery-topic-list')?.addEventListener('click', async (e) => {
      const curSub = state.mastery.find(s => s.id === activeMasterySubId);
      if (!curSub) return;

      const cycBtn = e.target.closest('[data-m-cycle]');
      if (cycBtn) {
        const tp = curSub.topics.find(x => x.id === cycBtn.dataset.mCycle);
        if (tp) {
          tp.level = (Number(tp.level || 0) + 1) % 4;
          saveState();
          renderMastery();
        }
        return;
      }

      const moveBtn = e.target.closest('[data-m-move]');
      if (moveBtn) {
        const [tid, dirStr] = moveBtn.dataset.mMove.split('|');
        const dir = Number(dirStr);
        const idx = curSub.topics.findIndex(x => x.id === tid);
        const target = idx + dir;
        if (idx >= 0 && target >= 0 && target < curSub.topics.length) {
          const [moved] = curSub.topics.splice(idx, 1);
          curSub.topics.splice(target, 0, moved);
          saveState();
          renderMastery();
        }
        return;
      }

      const delBtn = e.target.closest('[data-m-del]');
      if (delBtn) {
        const tp = curSub.topics.find(x => x.id === delBtn.dataset.mDel);
        const ok = await askConfirm({
          title: 'Xóa chuyên đề?',
          message: `Bạn có chắc muốn xóa chuyên đề "${tp?.name || ''}" không?`,
          confirmText: 'Xóa',
          danger: true
        });
        if (!ok) return;
        curSub.topics = curSub.topics.filter(x => x.id !== delBtn.dataset.mDel);
        saveState();
        renderMastery();
        return;
      }

      const editBtn = e.target.closest('[data-m-edit]');
      if (editBtn) {
        const tp = curSub.topics.find(x => x.id === editBtn.dataset.mEdit);
        if (!tp) return;
        editingTopicRef = { subId: curSub.id, topicId: tp.id };
        document.getElementById('edit-mastery-name').value = tp.name;
        document.getElementById('edit-mastery-level').value = String(tp.level || 0);
        document.getElementById('edit-mastery-note').value = tp.note || '';
        document.getElementById('modal-mastery-edit').classList.remove('hidden');
      }
    });

    const closeEditModal = () => document.getElementById('modal-mastery-edit')?.classList.add('hidden');
    document.getElementById('btn-close-mastery-edit')?.addEventListener('click', closeEditModal);
    document.getElementById('btn-cancel-mastery-edit')?.addEventListener('click', closeEditModal);
    document.getElementById('modal-mastery-edit')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-mastery-edit') closeEditModal();
    });

    document.getElementById('form-mastery-edit')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!editingTopicRef) return;
      const sub = state.mastery.find(s => s.id === editingTopicRef.subId);
      const tp = sub?.topics.find(x => x.id === editingTopicRef.topicId);
      if (tp) {
        tp.name = document.getElementById('edit-mastery-name').value.trim();
        tp.level = Number(document.getElementById('edit-mastery-level').value) || 0;
        tp.note = document.getElementById('edit-mastery-note').value.trim();
        saveState();
        renderMastery();
        showToast('Đã cập nhật chuyên đề.');
      }
      closeEditModal();
    });

    // Quick-pick chuyên đề trong Modal Đề thi
    document.getElementById('exam-subject')?.addEventListener('change', renderExamTopicSuggestions);
    document.getElementById('btn-open-exam-modal')?.addEventListener('click', () => setTimeout(renderExamTopicSuggestions, 30));
    document.getElementById('exam-mastery-chips')?.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-pick-topic]');
      if (!chip) return;
      const inp = document.getElementById('exam-topics');
      if (!inp) return;
      const val = chip.dataset.pickTopic;
      const parts = inp.value.split(',').map(s => s.trim()).filter(Boolean);
      if (!parts.includes(val)) {
        parts.push(val);
        inp.value = parts.join(', ');
      }
    });

    // Bridge Modal actions (Nộp bài -> Bảng luyện đề)
    const closeBridge = () => document.getElementById('modal-exam-submit-bridge')?.classList.add('hidden');
    document.getElementById('btn-close-exam-bridge')?.addEventListener('click', closeBridge);
    document.getElementById('btn-bridge-cancel')?.addEventListener('click', closeBridge);

    const launchExamFromBridge = (asPending) => {
      const subject = document.getElementById('bridge-exam-subject').value;
      const duration = Math.max(1, parseInt(document.getElementById('bridge-exam-duration').value, 10) || SUBJECTS[subject].defaultTime);
      const name = document.getElementById('bridge-exam-name').value.trim() || `Đề thi thử ${SUBJECTS[subject].name} (${formatDateVN(formatDateISO(new Date()))})`;
      closeBridge();
      window.switchTab('exams');
      if (typeof openExamModal === 'function') {
        openExamModal(null, { subject, name, duration });
        renderExamTopicSuggestions();
        if (asPending) {
          const cb = document.getElementById('exam-is-pending');
          if (cb) {
            cb.checked = true;
            if (typeof syncExamPendingUI === 'function') syncExamPendingUI();
          }
        }
      }
    };

    document.getElementById('btn-bridge-grade-now')?.addEventListener('click', () => launchExamFromBridge(false));
    document.getElementById('btn-bridge-pending')?.addEventListener('click', () => launchExamFromBridge(true));

    // Khi có dữ liệu mới đồng bộ từ Firebase về
    window.addEventListener('studyos:synced', () => {
      ensureMasteryState();
      if (document.getElementById('view-today')?.classList.contains('active')) renderTodayDashboard();
      if (document.getElementById('view-mastery')?.classList.contains('active')) renderMastery();
    });
  }

  function initMasteryAndToday() {
    ensureMasteryState();
    injectViewsAndNav();
    initExamSubmitButton();
    bindEvents();

    // Trên điện thoại tự mở thẳng màn hình "Hôm nay" cho tiện xem dọc
    if (window.innerWidth <= 960) {
      window.switchTab('today');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initMasteryAndToday, 0));
  } else {
    initMasteryAndToday();
  }
})();