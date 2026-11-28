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
  function loadApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => reject(new Error('api'));
      document.head.appendChild(s);
    });
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

  // ---------- phát ----------
  async function playItem(id) {
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
      player.loadPlaylist({ list: it.ytId, listType: 'playlist', index: 0 });
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
    if (it && it.type === 'playlist' && player) {
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

  function renderPanel() {
    if (!panelEl) return;
    const m = music();
    const it = currentItem();
    const typedValue = panelEl.querySelector('#music-url')?.value || '';
    const lib = m.library.length
      ? m.library.map(x => `
          <div class="music-item ${x.id === m.currentLibId ? 'active' : ''}" data-play="${x.id}">
            <span>${x.type === 'playlist' ? '📃' : '🎵'}</span>
            <span class="t" title="${esc(x.title)}">${esc(x.title)}</span>
            <span class="k">${x.type === 'playlist' ? 'Playlist' : 'Video'}</span>
            <button class="x" data-del="${x.id}" title="Xóa">✕</button>
          </div>`).join('')
      : '<div class="music-empty">Chưa có nhạc. Dán link YouTube ở trên để thêm.</div>';
    panelEl.innerHTML = `
      <h3><span>🎧 Nhạc nền</span><span style="cursor:pointer;color:#9ca3b8" data-close>✕</span></h3>
      <div class="music-add">
        <input id="music-url" type="text" placeholder="Dán link video / playlist YouTube..." value="${esc(typedValue)}" />
        <button id="music-add-btn">Thêm</button>
      </div>
      <div class="music-msg ${msg.ok ? 'ok' : ''}">${esc(msg.text)}</div>
      <div class="music-now">${it ? esc(nowTitle || it.title) : 'Chưa chọn bài nào'}
        <small>${it ? (isPlaying ? 'Đang phát' : 'Tạm dừng') : ''}</small></div>
      <div class="music-ctrl">
        <button id="music-shuffle" class="${m.shuffle ? 'on' : ''}" title="Phát ngẫu nhiên">🔀</button>
        <button id="music-prev" title="Bài trước">⏮</button>
        <button id="music-play" class="main" title="Phát / Tạm dừng">${isPlaying ? '⏸' : '▶'}</button>
        <button id="music-next" title="Bài sau">⏭</button>
        <button id="music-loop" class="${m.loop !== 'off' ? 'on' : ''}" title="Lặp lại">${m.loop === 'one' ? '🔂' : '🔁'}</button>
      </div>
      <div class="music-vol"><span>🔈</span><input id="music-volume" type="range" min="0" max="100" value="${m.volume}" /><span>🔊</span></div>
      <div class="music-lib">${lib}</div>
    `;
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
        if (e.target.closest('[data-del]')) return;
        playItem(el.dataset.play);
      };
    });
    panelEl.querySelectorAll('[data-del]').forEach(el => {
      el.onclick = (e) => { e.stopPropagation(); removeItem(el.dataset.del); };
    });
  }

  function positionPanel() {
    if (!panelEl || !anchorBtn) return;
    const r = anchorBtn.getBoundingClientRect();
    const w = panelEl.offsetWidth || 330;
    let left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    panelEl.style.left = left + 'px';
    panelEl.style.bottom = Math.max(8, window.innerHeight - r.top + 10) + 'px';
  }

  function onDocClick(e) {
    if (!panelEl) return;
    if (panelEl.contains(e.target) || (anchorBtn && anchorBtn.contains(e.target))) return;
    closePanel();
  }

  function openPanel(btn) {
    anchorBtn = btn;
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.className = 'music-panel';
      document.body.appendChild(panelEl);
      setTimeout(() => document.addEventListener('click', onDocClick), 0);
      window.addEventListener('resize', positionPanel);
    }
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
