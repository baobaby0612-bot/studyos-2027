/* ============================================================
   music.js — Nhạc nền YouTube cho Pomodoro (không cần API key)
   - Dán link video hoặc playlist (playlist phải Công khai / Không công khai)
   - Trình phát YouTube IFrame ẩn, chỉ phát âm thanh
   - Hiển thị tên bài chạy ở đáy khi giao diện Pomodoro đang ẩn (zen mode)
   Dữ liệu lưu tại state.pomodoro.music (đồng bộ qua saveState/Firebase)
   ============================================================ */
(function () {
  'use strict';

  let player = null;
  let playerReady = null;       // Promise
  let panelEl = null;
  let anchorBtn = null;
  let msg = { text: '', ok: false };
  let isPlaying = false;
  let nowTitle = '';
  let lastShownTitle = null;
  let lastShownPlaying = null;

  // ---------- state ----------
  function music() {
    if (typeof state === 'undefined' || !state) return null;
    if (!state.pomodoro) state.pomodoro = {};
    const p = state.pomodoro;
    if (!p.music) p.music = { library: [], currentLibId: null, currentIndex: 0, volume: 60, shuffle: false, loop: 'all' };
    const m = p.music;
    if (!Array.isArray(m.library)) m.library = [];
    if (typeof m.volume !== 'number') m.volume = 60;
    if (!m.loop) m.loop = 'all';
    return m;
  }
  function persist() { try { saveState(); } catch (e) { /* ignore */ } }
  function currentItem() {
    const m = music();
    return m ? m.library.find(x => x.id === m.currentLibId) || null : null;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'mu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------- parse link ----------
  function parseLink(raw) {
    const text = (raw || '').trim();
    if (!text) return null;
    if (/^[\w-]{11}$/.test(text)) return { type: 'video', ytId: text };
    let url;
    try { url = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text); } catch (e) { return null; }
    const host = url.hostname.replace(/^www\.|^m\.|^music\./, '');
    if (!['youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return null;
    const list = url.searchParams.get('list');
    let vid = url.searchParams.get('v');
    if (host === 'youtu.be') vid = url.pathname.slice(1).split('/')[0];
    else if (!vid) {
      const m = url.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/);
      if (m) vid = m[1];
    }
    if (list && !/^RD/i.test(list)) return { type: 'playlist', ytId: list };
    if (vid && /^[\w-]{11}$/.test(vid)) return { type: 'video', ytId: vid };
    if (list) return { type: 'mix' };
    return null;
  }

  async function fetchTitle(parsed) {
    const target = parsed.type === 'playlist'
      ? `https://www.youtube.com/playlist?list=${parsed.ytId}`
      : `https://www.youtube.com/watch?v=${parsed.ytId}`;
    const res = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(target));
    if (!res.ok) throw new Error('http' + res.status);
    const j = await res.json();
    return j.title || '';
  }

  // ---------- YouTube player ----------
  let apiPromise = null;
  function loadApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => reject(new Error('api'));
      document.head.appendChild(s);
    });
    apiPromise.catch(() => { apiPromise = null; });
    return apiPromise;
  }

  function ensurePlayer() {
    if (playerReady) return playerReady;
    playerReady = loadApi().then(() => new Promise((resolve) => {
      let host = document.getElementById('yt-player-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'yt-player-host';
        host.innerHTML = '<div id="yt-player"></div>';
        document.body.appendChild(host);
      }
      player = new YT.Player('yt-player', {
        height: '1', width: '1',
        playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0 },
        events: {
          onReady: () => { player.setVolume(music().volume); resolve(player); },
          onStateChange: onPlayerState,
          onError: onPlayerError
        }
      });
    }));
    playerReady.catch(() => { playerReady = null; });
    return playerReady;
  }

  function onPlayerState(e) {
    const S = YT.PlayerState;
    isPlaying = e.data === S.PLAYING || e.data === S.BUFFERING;
    if (e.data === S.PLAYING) {
      try {
        const t = player.getVideoData().title;
        if (t) nowTitle = t;
      } catch (err) { /* ignore */ }
    }
    if (e.data === S.ENDED) onEnded();
    refreshNowPlaying();
    renderPanel();
  }

  function onPlayerError() {
    // Video không phát được (bị chặn nhúng / đã xóa) -> bỏ qua
    const it = currentItem();
    if (!it) return;
    if (it.type === 'playlist') { try { player.nextVideo(); } catch (e) { /* ignore */ } }
    else step(1, true);
  }

  function onEnded() {
    const it = currentItem();
    const m = music();
    if (!it || it.type === 'playlist') return; // playlist tự chuyển bài
    if (m.loop === 'one') { player.seekTo(0); player.playVideo(); return; }
    step(1, true);
  }

  // ---------- danh sách bài trong playlist ----------
  let metaPlayer = null;
  let metaQueue = [];
  let metaBusy = false;
  const loadingTitles = new Set();
  const expanded = new Set();
  const scrollMem = {};
  let renderTimer = null;
  const renderSoon = () => { clearTimeout(renderTimer); renderTimer = setTimeout(renderPanel, 250); };

  function ensureMetaPlayer() {
    return loadApi().then(() => new Promise((resolve) => {
      if (metaPlayer) return resolve(metaPlayer);
      let host = document.getElementById('yt-meta-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'yt-meta-host';
        host.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;top:-10px;opacity:0;pointer-events:none;overflow:hidden';
        host.innerHTML = '<div id="yt-meta"></div>';
        document.body.appendChild(host);
      }
      metaPlayer = new YT.Player('yt-meta', {
        height: '1', width: '1',
        playerVars: { playsinline: 1, controls: 0 },
        events: {
          onReady: () => { metaPlayer.mute(); resolve(metaPlayer); },
          onStateChange: onMetaState
        }
      });
    }));
  }

  let metaCurrent = null;
  let metaTimeout = null;
  function onMetaState(e) {
    if (!metaCurrent) return;
    if (e.data === YT.PlayerState.CUED || e.data === YT.PlayerState.PLAYING) {
      const ids = (metaPlayer.getPlaylist && metaPlayer.getPlaylist()) || [];
      if (ids.length) finishMeta(ids);
    }
  }
  function finishMeta(ids) {
    clearTimeout(metaTimeout);
    const it = metaCurrent;
    metaCurrent = null;
    if (it) {
      const old = new Map((it.items || []).map(x => [x.vid, x.title]));
      it.items = ids.map(v => ({ vid: v, title: old.get(v) || '' }));
      persist();
      fetchTrackTitles(it);
      renderSoon();
    }
    try { metaPlayer.stopVideo(); } catch (e) { /* ignore */ }
    metaBusy = false;
    nextMeta();
  }
  function nextMeta() {
    if (metaBusy || !metaQueue.length) return;
    const it = metaQueue.shift();
    if (it.items && it.items.length) return nextMeta();
    metaBusy = true;
    metaCurrent = it;
    ensureMetaPlayer().then(() => {
      metaPlayer.cuePlaylist({ list: it.ytId, listType: 'playlist', index: 0 });
      metaTimeout = setTimeout(() => {
        // quá hạn: bỏ qua
        metaCurrent = null; metaBusy = false; nextMeta();
      }, 12000);
    }).catch(() => { metaCurrent = null; metaBusy = false; });
  }
  function ensureTracks(it) {
    if (it.type !== 'playlist') return;
    if (it.items && it.items.length) { fetchTrackTitles(it); return; }
    if (!metaQueue.includes(it) && metaCurrent !== it) metaQueue.push(it);
    nextMeta();
  }
  async function fetchTrackTitles(it) {
    const todo = (it.items || []).filter(x => !x.title && !loadingTitles.has(x.vid));
    if (!todo.length) return;
    todo.forEach(x => loadingTitles.add(x.vid));
    let idx = 0;
    const worker = async () => {
      while (idx < todo.length) {
        const x = todo[idx++];
        try { x.title = await fetchTitle({ type: 'video', ytId: x.vid }); }
        catch (e) { x.title = 'Video không khả dụng'; }
        loadingTitles.delete(x.vid);
        renderSoon();
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    persist();
  }
  function currentVideoId() {
    try { return player && player.getVideoData ? player.getVideoData().video_id : ''; } catch (e) { return ''; }
  }

  // ---------- phát ----------
  async function playItem(id, index) {
    const m = music();
    const it = m.library.find(x => x.id === id);
    if (!it) return;
    m.currentLibId = id;
    nowTitle = it.title || '';
    persist();
    setMsg('Đang tải...', true);
    renderPanel();
    try {
      await ensurePlayer();
    } catch (e) {
      setMsg('Không tải được trình phát YouTube. Kiểm tra kết nối mạng hoặc trình chặn quảng cáo.', false);
      return;
    }
    if (it.type === 'playlist') {
      player.loadPlaylist({ list: it.ytId, listType: 'playlist', index: index || 0 });
      player.setShuffle(!!m.shuffle);
      player.setLoop(m.loop !== 'off');
    } else {
      player.loadVideoById(it.ytId);
    }
    player.setVolume(m.volume);
    setMsg('', true);
  }

  function step(dir, auto) {
    const m = music();
    const it = currentItem();
    if (!m.library.length) return;
    if (it && it.type === 'playlist' && player && typeof player.nextVideo === 'function') {
      dir > 0 ? player.nextVideo() : player.previousVideo();
      return;
    }
    let idx = m.library.findIndex(x => x.id === m.currentLibId);
    if (m.shuffle && m.library.length > 1) {
      let n; do { n = Math.floor(Math.random() * m.library.length); } while (n === idx);
      idx = n;
    } else {
      idx += dir;
      if (idx >= m.library.length || idx < 0) {
        if (auto && m.loop === 'off') { isPlaying = false; try { player.stopVideo(); } catch (e) { /* ignore */ } refreshNowPlaying(); renderPanel(); return; }
        idx = (idx + m.library.length) % m.library.length;
      }
    }
    playItem(m.library[idx].id);
  }

  function togglePlay() {
    const m = music();
    if (!m.library.length) { setMsg('Hãy dán một link YouTube để thêm nhạc trước.', false); renderPanel(); return; }
    if (!player || !currentItem()) { playItem(m.currentLibId && currentItem() ? m.currentLibId : m.library[0].id); return; }
    if (isPlaying) player.pauseVideo(); else player.playVideo();
  }

  // ---------- thêm / xóa ----------
  async function addLink(raw) {
    const m = music();
    const parsed = parseLink(raw);
    if (!parsed) { setMsg('Link không hợp lệ. Hãy dán link video hoặc playlist YouTube.', false); renderPanel(); return; }
    if (parsed.type === 'mix') { setMsg('Đây là danh sách "Mix" tự động của YouTube nên không phát được. Hãy dùng playlist của bạn.', false); renderPanel(); return; }
    if (m.library.some(x => x.ytId === parsed.ytId)) { setMsg('Mục này đã có trong danh sách.', false); renderPanel(); return; }
    setMsg('Đang kiểm tra link...', true);
    renderPanel();
    let title = '';
    try {
      title = await fetchTitle(parsed);
    } catch (e) {
      if (e && /^http/.test(e.message)) {
        setMsg(parsed.type === 'playlist'
          ? 'Không đọc được playlist. Hãy đặt playlist ở chế độ "Công khai" hoặc "Không công khai" rồi thử lại.'
          : 'Không đọc được video này (có thể bị riêng tư, đã xóa hoặc cấm nhúng).', false);
        renderPanel();
        return;
      }
      // lỗi mạng/CORS: vẫn cho thêm, tên sẽ cập nhật khi phát
    }
    const item = { id: uid(), type: parsed.type, ytId: parsed.ytId, title: title || (parsed.type === 'playlist' ? 'Playlist YouTube' : 'Video YouTube') };
    m.library.push(item);
    persist();
    setMsg('Đã thêm: ' + item.title, true);
    renderPanel();
    if (item.type === 'playlist') ensureTracks(item);
    if (!isPlaying) playItem(item.id);
  }

  function removeItem(id) {
    const m = music();
    const wasCurrent = m.currentLibId === id;
    m.library = m.library.filter(x => x.id !== id);
    if (wasCurrent) {
      m.currentLibId = null;
      nowTitle = '';
      isPlaying = false;
      try { player && player.stopVideo(); } catch (e) { /* ignore */ }
    }
    persist();
    refreshNowPlaying();
    renderPanel();
  }

  // ---------- giao diện ----------
  function setMsg(text, ok) { msg = { text, ok }; }

  const IC = {
    shuffle: '<svg viewBox="0 0 24 24"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><polygon points="19 20 9 12 19 4 19 20" fill="currentColor"/><line x1="5" y1="19" x2="5" y2="5"/></svg>',
    next: '<svg viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20 5 4" fill="currentColor"/><line x1="19" y1="5" x2="19" y2="19"/></svg>',
    play: '<svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>',
    loop: '<svg viewBox="0 0 24 24"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
    loopOne: '<svg viewBox="0 0 24 24"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>'
  };

  function trackListHtml(x, curVid) {
    if (!expanded.has(x.id)) return '';
    if (!x.items || !x.items.length) return '<div class="music-tracks"><div class="music-empty">Đang tải danh sách bài...</div></div>';
    const rows = x.items.map((t, i) => `
      <div class="music-track ${t.vid === curVid && x.id === music().currentLibId ? 'active' : ''}" data-track="${x.id}" data-idx="${i}">
        <span class="n">${i + 1}</span>
        <span class="t">${esc(t.title || 'Đang tải tên...')}</span>
      </div>`).join('');
    return `<div class="music-tracks" data-tracks="${x.id}">${rows}</div>`;
  }

  function renderPanel() {
    if (!panelEl) return;
    const m = music();
    const it = currentItem();
    const typedValue = panelEl.querySelector('#music-url')?.value || '';
    const libScroll = panelEl.querySelector('.music-lib')?.scrollTop || 0;
    const curVid = currentVideoId();

    const lib = m.library.length
      ? m.library.map(x => `
          <div class="music-group">
            <div class="music-item ${x.id === m.currentLibId ? 'active' : ''}" data-play="${x.id}">
              <span class="t" title="${esc(x.title)}">${esc(x.title)}</span>
              <span class="k">${x.type === 'playlist' ? (x.items && x.items.length ? x.items.length + ' bài' : 'Playlist') : 'Video'}</span>
              ${x.type === 'playlist' ? `<button class="x chev ${expanded.has(x.id) ? 'open' : ''}" data-expand="${x.id}" title="Xem danh sách bài">${IC.chevron}</button>` : ''}
              <button class="x" data-del="${x.id}" title="Xóa">✕</button>
            </div>
            ${x.type === 'playlist' ? trackListHtml(x, curVid) : ''}
          </div>`).join('')
      : '<div class="music-empty">Chưa có nhạc. Dán link YouTube ở trên để thêm.</div>';

    let pos = '';
    if (it && it.type === 'playlist' && it.items && it.items.length) {
      const i = it.items.findIndex(t => t.vid === curVid);
      if (i >= 0) pos = ` · ${i + 1}/${it.items.length}`;
    }

    panelEl.innerHTML = `
      <h3><span>Nhạc nền</span><span style="cursor:pointer;color:#9ca3b8" data-close>✕</span></h3>
      <div class="music-add">
        <input id="music-url" type="text" placeholder="Dán link video / playlist YouTube..." value="${esc(typedValue)}" />
        <button id="music-add-btn">Thêm</button>
      </div>
      <div class="music-msg ${msg.ok ? 'ok' : ''}">${esc(msg.text)}</div>
      <div class="music-now">${it ? esc(nowTitle || it.title) : 'Chưa chọn bài nào'}
        <small>${it ? (isPlaying ? 'Đang phát' : 'Tạm dừng') + esc(pos) : ''}</small></div>
      <div class="music-bar">
        <button id="music-shuffle" class="${m.shuffle ? 'on' : ''}" title="Phát ngẫu nhiên">${IC.shuffle}</button>
        <button id="music-prev" title="Bài trước">${IC.prev}</button>
        <button id="music-play" class="main" title="Phát / Tạm dừng">${isPlaying ? IC.pause : IC.play}</button>
        <button id="music-next" title="Bài sau">${IC.next}</button>
        <button id="music-loop" class="${m.loop !== 'off' ? 'on' : ''}" title="Lặp lại">${m.loop === 'one' ? IC.loopOne : IC.loop}</button>
      </div>
      <div class="music-vol"><input id="music-volume" type="range" min="0" max="100" value="${m.volume}" /></div>
      <div class="music-lib">${lib}</div>
    `;
    const libEl = panelEl.querySelector('.music-lib');
    if (libEl) libEl.scrollTop = libScroll;
    bindPanel();
  }

  function bindPanel() {
    const m = music();
    const q = (s) => panelEl.querySelector(s);
    const input = q('#music-url');
    const doAdd = () => { const v = input.value; input.value = ''; addLink(v); };
    q('#music-add-btn').onclick = doAdd;
    input.onkeydown = (e) => { if (e.key === 'Enter') doAdd(); e.stopPropagation(); };
    q('[data-close]').onclick = closePanel;
    q('#music-play').onclick = togglePlay;
    q('#music-next').onclick = () => step(1, false);
    q('#music-prev').onclick = () => step(-1, false);
    q('#music-shuffle').onclick = () => {
      m.shuffle = !m.shuffle; persist();
      try { const it = currentItem(); if (player && it && it.type === 'playlist') player.setShuffle(m.shuffle); } catch (e) { /* ignore */ }
      renderPanel();
    };
    q('#music-loop').onclick = () => {
      m.loop = m.loop === 'all' ? 'one' : m.loop === 'one' ? 'off' : 'all';
      persist();
      try { const it = currentItem(); if (player && it && it.type === 'playlist') player.setLoop(m.loop !== 'off'); } catch (e) { /* ignore */ }
      renderPanel();
    };
    q('#music-volume').oninput = (e) => {
      m.volume = Number(e.target.value);
      if (player && player.setVolume) player.setVolume(m.volume);
      persist();
    };
    panelEl.querySelectorAll('[data-play]').forEach(el => {
      el.onclick = (e) => {
        if (e.target.closest('[data-del]') || e.target.closest('[data-expand]')) return;
        playItem(el.dataset.play);
      };
    });
    panelEl.querySelectorAll('[data-del]').forEach(el => {
      el.onclick = (e) => { e.stopPropagation(); removeItem(el.dataset.del); };
    });
    panelEl.querySelectorAll('[data-expand]').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const id = el.dataset.expand;
        if (expanded.has(id)) expanded.delete(id);
        else {
          expanded.add(id);
          const it = m.library.find(x => x.id === id);
          if (it) ensureTracks(it);
        }
        renderPanel();
      };
    });
    panelEl.querySelectorAll('[data-track]').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.track;
        const idx = Number(el.dataset.idx);
        const it = m.library.find(x => x.id === id);
        if (!it) return;
        if (m.currentLibId === id && player && player.playVideoAt && it.items) {
          // đang ở đúng playlist: phát bài này (index theo thứ tự hiện tại của player)
          const ids = (player.getPlaylist && player.getPlaylist()) || [];
          const pi = ids.indexOf(it.items[idx].vid);
          if (pi >= 0) { player.playVideoAt(pi); return; }
        }
        playItem(id, idx);
      };
    });
  }

  function positionPanel() {
    if (!panelEl || !anchorBtn) return;
    const r = anchorBtn.getBoundingClientRect();
    const w = panelEl.offsetWidth || 400;
    let left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    panelEl.style.left = left + 'px';
    panelEl.style.bottom = Math.max(8, window.innerHeight - r.top + 10) + 'px';
  }

  function onDocClick(e) {
    if (!panelEl) return;
    // phần tử vừa bị render lại (đã gỡ khỏi DOM) thì không tính là click ra ngoài
    if (!e.target.isConnected) return;
    if (panelEl.contains(e.target) || (anchorBtn && anchorBtn.contains(e.target))) return;
    closePanel();
  }

  function openPanel(btn) {
    anchorBtn = btn;
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.className = 'music-panel';
      panelEl.addEventListener('click', (e) => e.stopPropagation());
      document.body.appendChild(panelEl);
      setTimeout(() => document.addEventListener('click', onDocClick), 0);
      window.addEventListener('resize', positionPanel);
    }
    music().library.forEach(x => { if (x.type === 'playlist' && x.items && x.items.some(t => !t.title)) fetchTrackTitles(x); });
    renderPanel();
    positionPanel();
  }

  function closePanel() {
    if (!panelEl) return;
    panelEl.remove();
    panelEl = null;
    document.removeEventListener('click', onDocClick);
    window.removeEventListener('resize', positionPanel);
  }

  function toggle(btn) { panelEl ? closePanel() : openPanel(btn); }

  // ---------- dòng chữ chạy ở đáy ----------
  function refreshNowPlaying() {
    const box = document.getElementById('pomo-now-playing');
    const txt = document.getElementById('pomo-now-text');
    if (!box || !txt) return;
    const it = currentItem();
    const title = nowTitle || (it && it.title) || '';
    const shown = title ? '♪  ' + title + '      ♪  ' + title : '';
    if (txt.dataset.shown !== shown) { txt.textContent = shown; txt.dataset.shown = shown; }
    box.classList.toggle('playing', isPlaying && !!title);
  }

  setInterval(refreshNowPlaying, 1000);
  window.addEventListener('pomo:zen', refreshNowPlaying);

  window.StudyMusic = {
    toggle,
    closePanel,
    isPlaying: () => isPlaying,
    nowTitle: () => nowTitle
  };
})();
