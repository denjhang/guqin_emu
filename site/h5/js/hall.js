/* 琴谱大厅：封面卡片墙 + 大厅阅读视图（上音符/下减字谱条，无琴面）
 * 复刻 APK「琴谱大厅」：标题/封面/作者/收藏数/编辑·播放模式 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  let corpus = [], scoresById = {}, favKey = 'h5-hall-favorites-v1';
  let catalog = [];   // 服务器曲库目录（真实作者/封面/点赞）
  function setCatalog(c) { catalog = c || []; }
  let hallScore = null, hallTokens = [], hallPlaying = false, lastScrolledRow = null;
  let selStart = null, selEnd = null, playFrom = null, isDragging = false, dragMoved = false, longPressTimer = null, pressPos = null, suppressClick = false;

  function favorites() {
    try { return JSON.parse(localStorage.getItem(favKey) || '{}'); } catch (e) { return {}; }
  }
  function saveFavs(f) { localStorage.setItem(favKey, JSON.stringify(f)); }
  // 稳定的伪收藏数（快照无此数据，用标题哈希生成 3~99）
  function favCount(s) {
    let h = 7;
    for (const c of s.title) h = (h * 31 + c.codePointAt(0)) >>> 0;
    return 3 + h % 97;
  }
  function authorOf(s) {
    if (s.entity_type === 'library_item') return '服务器琴谱';
    return s.source_author_name ? s.source_author_name + ' 琴友' : '琴友分享';
  }

  /* 封面：APK 原版默认封面图（score_card_default_background.png），不生成任何图 */
  function coverHTML() {
    return `<img class="cover-img" src="img/score_card_default_background.png" alt="默认封面">`;
  }

  let hallScores = [];   // 大厅主数据：目录（真实作者/封面）+ corpus 补充
  function setHallScores(a) { hallScores = a || []; }

  function build() {
    scoresById = {};
    const box = $('#hallGrid');
    const catIds = new Set(), catPosts = new Set();
    hallScores.forEach(c => { if (c.id) catIds.add(c.id); if (c.source_post_id) catPosts.add(c.source_post_id); });
    const catTitles = new Set(hallScores.map(h => h.title));
    const extra = corpus.filter(s => !catIds.has(s.entity_id) && !catPosts.has(s.entity_id) && !catTitles.has(s.title));
    // 目录中谱面为空的条目：按标题从 corpus 回填（取字数最多的版本）
    const byTitle = {};
    corpus.forEach(s => {
      const sc = s.score_content && s.score_content.score; if (!sc || !sc.lines) return;
      let n = 0; sc.lines.forEach(l => (l.jianziTokens || []).forEach(t => t.kind === 'jianzi' && n++));
      if (!byTitle[s.title] || byTitle[s.title].n < n) byTitle[s.title] = { n, s };
    });
    const all = hallScores.map(s => {
      const copy = { ...s, entity_type: 'library_item' };
      const sc = copy.score_content && copy.score_content.score;
      let n = 0; if (sc && sc.lines) sc.lines.forEach(l => (l.jianziTokens || []).forEach(t => t.kind === 'jianzi' && n++));
      if (n === 0 && byTitle[s.title]) copy.score_content = byTitle[s.title].s.score_content;
      return copy;
    }).concat(extra.map(s => ({ ...s, entity_type: s.entity_type })));
    const list = all
      .map(s => { const sc = s.score_content && s.score_content.score; let n = 0; if (sc && sc.lines) sc.lines.forEach(l => (l.jianziTokens || []).forEach(t => t.kind === 'jianzi' && n++)); return { s, n }; })
      .filter(x => x.n >= 10)
      .sort((a, b) => b.n - a.n);
    list.forEach(x => scoresById[x.s.id] = x.s);
    box.innerHTML = '';
    const catByEntity = {};
    catalog.forEach(c => {
      if (c.id) catByEntity[c.id] = c;
      if (c.sourcePost) catByEntity['post:' + c.sourcePost] = c;
    });
    list.forEach(({ s, n }) => {
      const favs = favorites();
      const isCat = s.profile_nickname !== undefined || s.author_name !== undefined;
      const cat = isCat ? { author: s.profile_nickname || s.author_name || '琴友', cover: s.score_card_background_url ? ('community/covers/' + s.id + '.jpg') : null, likes: s.like_count || 0, desc: s.description || '', updated: (s.updated_at || s.created_at || '').slice(0, 10) } : (catByEntity[s.entity_id] || {});
      const card = document.createElement('button');
      card.className = 'hall-card';
      const cover = cat.cover
        ? `<img class="cover-img" src="${cat.cover}" alt="封面" loading="lazy">`
        : coverHTML();
      card.innerHTML = `
        <span class="cover">${cover}</span>
        <span class="hc-title"></span>
        <span class="hc-meta">
          <span class="hc-author">${cat.author || authorOf(s)}</span>
          <span class="hc-fav">♥ ${(cat.likes || 0) + (favs[s.id] ? 1 : 0)}</span>
        </span>
        <span class="hc-date">${cat.updated || (s.created_at || '').slice(0, 10)}</span>
        ${cat.desc ? '<span class="hc-desc"></span>' : ''}`;
      card.querySelector('.hc-title').textContent = s.title.replace(/^《|》$/g, '');
      if (cat.desc) card.querySelector('.hc-desc').textContent = cat.desc;
      card.addEventListener('click', () => openHall(s));
      if (favs[s.id]) { const b = document.createElement('span'); b.className = 'hc-faved'; b.textContent = '已收藏'; card.querySelector('.cover').appendChild(b); }
      box.appendChild(card);
    });
    $('#hallCount').textContent = `${list.length} 部作品`;
  }

  /* ---------- 大厅阅读视图 ---------- */
  function openHall(s, fromHash) {
    hallScore = s;
    clearSelection();
    $('#hallTitle').textContent = s.title.replace(/^《|》$/g, '');
    const isCat2 = s.profile_nickname !== undefined || s.author_name !== undefined;
    const cat = isCat2 ? { author: s.profile_nickname || s.author_name || '琴友', cover: s.score_card_background_url ? ('community/covers/' + s.id + '.jpg') : null, likes: s.like_count || 0, desc: s.description || '', updated: (s.updated_at || s.created_at || '').slice(0, 10) }
      : (catalog.find(c => c.id === s.entity_id) || {});
    $('#hallAuthor').textContent = cat.author || authorOf(s);
    const favs = favorites();
    updateFavBtn(!!favs[s.id], (cat.likes || 0) + (favs[s.id] ? 1 : 0));
    $('#hallCover').innerHTML = cat.cover ? `<img class="cover-img" src="${cat.cover}" alt="封面">` : coverHTML();
    $('#hallDesc').textContent = cat.desc || '';
    $('#hallCover').style.display = '';
    buildHallStrip(s.score_content.score);
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'hallview'));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('show', p.id === 'page-hallview'));
    requestAnimationFrame(() => window.GuqinStage.resize && window.GuqinStage.resize());
    if (!fromHash && s.id != null) {
      const slug = (window.GuqinHash && window.GuqinHash.slugOf(s.id)) || s.id;
      const hash = '#/hall/' + encodeURIComponent(slug);
      if (location.hash !== hash) location.hash = hash;
    }
  }
  function currentId() { return hallScore ? hallScore.id : null; }
  function openHallById(id, fromHash) {
    const s = scoresById[id];
    if (s) { openHall(s, fromHash); return true; }
    return false;
  }

  /* 多行谱面：上音符 / 下减字，每行 N 字自动换行（复刻 APK 查看视图） */
  const CELLS_PER_ROW = 10;
  function buildHallStrip(score) {
    const sheet = $('#hallStrip');
    sheet.innerHTML = '';
    hallTokens = [];
    // 展平为带行边界的字序列（控制符单独标记，不计入 hallTokens 序号）
    const flat = [];
    (score.lines || []).forEach((line, li) => {
      const jt = line.jianziTokens || [];
      const rt = line.rhythmTokens || [];
      let lastR = null;
      jt.forEach((tok, i) => {
        if (tok.kind === 'blank') return;
        // 节奏按位置对齐：blank 节奏沿用前一非空节奏
        const r = (rt[i] && rt[i].kind !== 'blank') ? rt[i] : lastR;
        if (rt[i] && rt[i].kind !== 'blank') lastR = rt[i];
        // 判断是否为控制符（括号/从括号再作/少息/泛起/泛止等，不占 domIdx）
        const act = window.JianziSemantics.parseToken(tok);
        const isCtrl = act.type === 'ctrl';
        flat.push({ tok, r, lineBreakAfter: false, li, isCtrl });
      });
      if (flat.length) flat[flat.length - 1].lineBreakAfter = true;
    });
    // 按 CELLS_PER_ROW 切行，源谱行边界提前断行
    const rows = [];
    let row = [];
    flat.forEach(cell => {
      row.push(cell);
      if (cell.lineBreakAfter || row.length >= CELLS_PER_ROW) { rows.push(row); row = []; }
    });
    if (row.length) rows.push(row);
    rows.forEach(cells => {
      const rowEl = document.createElement('div');
      rowEl.className = 'hall-row';
      cells.forEach(({ tok, r, isCtrl }) => {
        const cell = document.createElement('button');
        cell.className = 'hall-cell' + (isCtrl ? ' hall-ctrl' : '');
        const rEl = document.createElement('span');
        rEl.className = 'rhythm';
        rEl.textContent = r ? r.text : '♪';
        rEl.title = r ? (r.duration || '') : '';
        const bEl = document.createElement('span');
        bEl.className = 'beats';
        const beats = r ? window.GuqinPlayer.rhythmToBeats(r) : '';
        bEl.textContent = beats;
        const jEl = document.createElement('span');
        jEl.className = 'jianzi';
        jEl.innerHTML = window.JianziRender.renderToken(tok, 46);
        cell.appendChild(rEl); cell.appendChild(bEl); cell.appendChild(jEl);
        // 长按拖动选区 + 点击点读
        const cellIdx = isCtrl ? -1 : hallTokens.length;  // 控制符不参与选区
        cell.addEventListener('pointerdown', (e) => {
          if (isCtrl) return;
          pressPos = { x: e.clientX, y: e.clientY };
          longPressTimer = setTimeout(() => {
            // 长按：若已有选区且按在选区上 → 扩展/拖选；否则标记「从此播放」起点
            if (selStart !== null && selEnd !== null && cellIdx >= Math.min(selStart, selEnd) && cellIdx <= Math.max(selStart, selEnd)) {
              // 已在选区内长按 → 进入框选拖动模式
              isDragging = true;
              selStart = cellIdx;
              selEnd = cellIdx;
              updateSelection();
            } else {
              // 长按单个字：标记播放起点（点播放 → 从此处播到曲尾）
              playFrom = cellIdx;
              clearSelection();
              hallTokens.forEach(t => t.classList.remove('playfrom'));
              cell.classList.add('playfrom');
            }
            dragMoved = false;   // 是否发生拖动（区分框选 vs 单点起点）
            e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
          }, 250);
        });
        cell.addEventListener('pointermove', (e) => {
          if (longPressTimer && !isDragging && pressPos) {
            // 未进入长按模式时，移动超过 10px 取消长按
            if (Math.abs(e.clientX - pressPos.x) + Math.abs(e.clientY - pressPos.y) > 10) {
              clearTimeout(longPressTimer);
              longPressTimer = null;
            }
            return;
          }
          if (longPressTimer) return;   // 长按未触发，忽略
          // 长按后拖动：playfrom → 变成框选起点（复用原框选逻辑）
          const hit = document.elementFromPoint(e.clientX, e.clientY);
          const targetCell = hit ? hit.closest('.hall-cell') : null;
          if (targetCell) {
            const ti = hallTokens.indexOf(targetCell);
            if (ti >= 0 && ti !== cellIdx) {
              // 从「从此播放」转入框选：清除 playfrom 标记，建立选区
              if (playFrom !== null) {
                playFrom = null;
                hallTokens.forEach(t => t.classList.remove('playfrom'));
                selStart = cellIdx;
                isDragging = true;
              }
              if (isDragging) { selEnd = ti; updateSelection(); }
              dragMoved = true;
            }
          }
        });
        cell.addEventListener('pointerup', (e) => {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          pressPos = null;
          if (isDragging) {
            // 拖动结束：只拖了一个字（未动）→ 保持 playfrom 标记；拖了多个字 → 框选
            if (dragMoved) { suppressClick = true; }
            isDragging = false;
            e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId);
            e.preventDefault();
          }
        });
        // 点击点读（仅在非拖动后触发）
        cell.addEventListener('click', (e) => {
          if (suppressClick) { suppressClick = false; return; }
          window.GuqinAudio.ensureCtx();
          window.GuqinPlayer.tapToken(tok, r, +($('#hallTempo').value) || 60);
          const act = window.JianziSemantics.parseToken(tok);
          if (window.HallFire) window.HallFire(act);
          cell.classList.add('flash'); setTimeout(() => cell.classList.remove('flash'), 350);
        });
        rowEl.appendChild(cell);
        if (!isCtrl) hallTokens.push(cell);   // 控制符不计入序号，与 domIdx 对齐
      });
      sheet.appendChild(rowEl);
    });
  }

  /* 选区高亮 */
  function updateSelection() {
    if (selStart === null || selEnd === null) return;
    const lo = Math.min(selStart, selEnd), hi = Math.max(selStart, selEnd);
    hallTokens.forEach((c, k) => c.classList.toggle('selected', k >= lo && k <= hi));
  }
  function clearSelection() {
    selStart = null; selEnd = null;
    playFrom = null;
    hallTokens.forEach(c => { c.classList.remove('selected'); c.classList.remove('playfrom'); });
  }

  function updateFavBtn(liked, count) {
    const b = $('#hallFavBtn');
    b.textContent = liked ? `♥ 已收藏 ${count}` : `♡ 收藏 ${count}`;
    b.classList.toggle('liked', !!liked);
  }

  function toggleFav() {
    if (!hallScore) return;
    const favs = favorites();
    favs[hallScore.id] = !favs[hallScore.id];
    if (!favs[hallScore.id]) delete favs[hallScore.id];
    saveFavs(favs);
    updateFavBtn(!!favs[hallScore.id], favCount(hallScore) + (favs[hallScore.id] ? 1 : 0));
  }

  /* 播放（大厅谱条高亮 + 滚动，无琴面） */
  function play() {
    if (!hallScore) return;
    window.GuqinPlayer.stop();
    document.querySelectorAll('.hall-cell.playing,.hall-cell.done').forEach(e => e.classList.remove('playing', 'done'));
    lastScrolledRow = null;
    const tempo = +($('#hallTempo').value) || null;
    const sc = tempo ? { lines: hallScore.score_content.score.lines.map(l => ({ ...l, sectionTempo: tempo })) } : hallScore.score_content.score;
    const wrap = $('#hallStripWrap');
    // 选区（框选）优先；无选区但有「从此播放」起点 → 从该字播到曲尾
    let range = (selStart !== null && selEnd !== null) ? { startDom: selStart, endDom: selEnd } : null;
    if (!range && playFrom !== null) {
      range = { startDom: playFrom, endDom: hallTokens.length - 1 };
      document.querySelector('#hallPlayBtn').textContent = '▶ 播放（从标记处）';
    } else {
      document.querySelector('#hallPlayBtn').textContent = '▶ 播放模式';
    }
    window.GuqinPlayer.play(sc, tempo, (i, ev) => {
      // 跳过零时长控制事件（泛起/泛止），只高亮实际音符
      if (ev.dur === 0) return;
      const di = ev.domIdx != null ? ev.domIdx : i;
      hallTokens.forEach((t, k) => { t.classList.toggle('done', k < di); t.classList.toggle('playing', k === di); });
      const el = hallTokens[di];
      if (el) {
        // 多行纵向跟随：只在换行时滚动一次；坐标用视口相对换算（offsetTop 参照不可靠）
        const row = el.closest('.hall-row');
        if (row && row !== lastScrolledRow) {
          lastScrolledRow = row;
          const wr = wrap.getBoundingClientRect(), rr = row.getBoundingClientRect();
          const rel = rr.top - wr.top + wrap.scrollTop;   // 行相对滚动容器顶部
          const pad = 24;
          if (rel < wrap.scrollTop + pad || rel + rr.height > wrap.scrollTop + wrap.clientHeight - pad) {
            wrap.scrollTo({ top: Math.max(0, rel - wrap.clientHeight * 0.28), behavior: 'smooth' });
          }
        }
      }
    }, () => {
      hallTokens.forEach(t => t.classList.remove('playing'));
    }, range);
  }
  function stop() { window.GuqinPlayer.stop(); hallTokens.forEach(t => t.classList.remove('playing')); }

  /* 编辑模式：载入编辑器 */
  function toEditor() {
    if (!hallScore) return;
    document.dispatchEvent(new CustomEvent('hall-edit', { detail: JSON.parse(JSON.stringify(hallScore.score_content.score)) }));
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'editor'));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('show', p.id === 'page-editor'));
  }

  window.Hall = { build, openHall, openHallById, currentId, play, stop, toggleFav, toEditor, clearSelection, setCorpus: c => { corpus = c; }, setCatalog, setHallScores, _coverHTML: coverHTML, _authorOf: authorOf };
  window.HallFire = null; // 由 app 注入琴面联动
})();
