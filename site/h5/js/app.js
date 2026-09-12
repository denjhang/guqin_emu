/* 主应用：乐谱库 / 播放 / 点读 / 编辑 / 文字·语音输入 */
(function () {
  'use strict';
  const $ = sel => document.querySelector(sel);
  let corpus = [];           // 全部谱面（来自 all_raw.json）
  let current = null;        // 当前谱对象
  let editorScore = null;    // 编辑中的谱
  let techDict = [];         // 技法解说词典
  let slugMap = { byId: {}, bySlug: {} }; // 拼音 slug 映射
  // 兜底解析：防止 localStorage 数据损坏导致 boot 中断（历史曲目不丢失）
  let genBatch = [];
  try { genBatch = JSON.parse(localStorage.getItem('h5-gen-batch') || '[]'); } catch (e) { console.warn('genBatch 解析失败，已重置为空', e); }
  let genVotes = {};
  try { genVotes = JSON.parse(localStorage.getItem('h5-gen-votes') || '{}'); } catch (e) { console.warn('genVotes 解析失败，已重置为空', e); }
  let hallScores = [];        // 大厅主数据（用于曲名去重）
  let folkTitles = [];        // 民歌集成曲名（禁止雷同数据源，来自 data/folk_titles.json）
  let followFocus = false;  // 播放时是否自动滚动跟随当前音符

  /* 依 token 文本查技法解说（APK 内置词典） */
  function explainToken(text) {
    if (!text) return null;
    for (const t of techDict) {
      if (text.includes(t.key)) return { key: t.key, text: t.text };
    }
    // 变体吟类
    const m = text.match(/(急|注|略|绰|长|游|荡)吟/);
    if (m) return { key: m[0], text: '揉弦的一种：' + m[0] + '——' + (m[1] === '游' || m[1] === '荡' ? '连贯、柔缓且幅度较大。' : '用法似常吟而略有变化，幅度稍大。') };
    if (text.includes('吟')) return { key: '吟', text: techDict.find(t => t.key === '吟').text };
    if (text.includes('猱')) return { key: '猱', text: techDict.find(t => t.key === '猱').text };
    if (text.includes('绰')) return { key: '绰', text: '左手向下滑入本位，得声由低而上。' };
    if (text.includes('注')) return { key: '注', text: '左手向上滑入本位，得声由高而下。' };
    return null;
  }
  function showExplain(text) {
    const box = $('#explainBox');
    const e = explainToken(text);
    box.textContent = e ? `〔${e.key}〕${e.text}` : `〔${text}〕`;
    box.style.display = 'block';
  }

  async function loadJSON(url) { const r = await fetch(url); return r.json(); }

  async function boot() {
    const [glyphPaths, glyphParts, , pitch, all, techniques] = await Promise.all([
      loadJSON('data/glyph_paths.json'),
      loadJSON('data/glyph_parts.json'),
      loadJSON('data/category_rules.json'),
      loadJSON('data/pitch.json'),
      loadJSON('scores/all_raw.json'),
      loadJSON('data/techniques.json'),
    ]);
    techDict = techniques;
    corpus = all;
    // 乐谱拼音 slug 映射（id ↔ 拼音）
    try {
      const sl = await loadJSON('data/score_slugs.json');
      slugMap = sl || { byId: {}, bySlug: {} };
    } catch (e) { slugMap = { byId: {}, bySlug: {} }; console.warn('score_slugs 加载失败', e); }
    // 暴露 slug 工具给 Hall 等模块用
    window.GuqinHash = {
      slugOf: id => slugMap.byId[String(id)] || null,
      idFromSlug: slug => slugMap.bySlug[slug] || null,
    };
    window.Hall.setCorpus(corpus);
    try { window.Hall.setCatalog(await loadJSON('community/catalog.json')); } catch (e) { console.warn('catalog 加载失败', e); }
    try { hallScores = await loadJSON('community/hall_scores.json'); window.Hall.setHallScores(hallScores); } catch (e) { console.warn('hall_scores 加载失败', e); }
    // 加载民歌集成曲名集合（9260 首真实民歌，用于 AI 曲名防雷同）
    try { folkTitles = await loadJSON('data/folk_titles.json') || []; } catch (e) { console.warn('folk_titles 加载失败', e); }
    // 加载古诗词词库，供 AI 生成曲名使用
    try { window.JianziInput.setLexicon(await loadJSON('data/poem_lexicon.json')); } catch (e) { console.warn('poem_lexicon 加载失败', e); }
    // 加载旋律统计特征（民歌+古琴），融合后注入生成器
    try {
      const folk = await loadJSON('data/folk_melody_stats.json');
      const guqin = await loadJSON('data/guqin_melody_stats.json');
      // 融合：古琴权重 0.6，民歌权重 0.4（古琴风格为主）
      window.JianziInput.setMelodyStats({ folk, guqin });
    } catch (e) { console.warn('melody_stats 加载失败', e); }
    // 加载旋律 LSTM 权重（680KB，gzip 后约 200KB）
    try { window.JianziInput.setLSTM(await loadJSON('data/melody_lstm_weights.json')); } catch (e) { console.warn('melody_lstm 加载失败', e); }
    window.JianziRender.init(glyphPaths, glyphParts);
    window.JianziSemantics.init(glyphParts);
    window.JianziInput.init(glyphParts, corpus);
    // 加载网页端权威泛音表（D.HARMONICS 91 条，修复泛音音高）
    let harmFreq = null;
    try { harmFreq = await loadJSON('data/harmonics.json'); } catch (e) { console.warn('harmonics 加载失败', e); }
    window.GuqinAudio.init(pitch, harmFreq);
    window.GuqinAudio.preload();
    window.GuqinStage.init(document.getElementById('qinCanvas'), pitch);
    buildLibrary('');
    $('#searchBox').addEventListener('input', e => buildLibrary(e.target.value));
    window.Hall.build();
    // 修复历史 AI 曲目中与曲库/大厅雷同的标题（失败不影响历史数据显示）
    try { repairGenTitles(); } catch (e) { console.warn('repairGenTitles 失败：', e); }
    // 从本地文件补充 localStorage 缺失的 AI 曲目（开发阶段：Node 后端落盘数据）
    try { await loadGenFromFile(); } catch (e) { /* 后端未启动时静默忽略 */ }
    // 刷新后依 hash 还原当前谱（库 / 大厅）
    const h = parseHash();
    if (h) {
      if (h.type === 'score') openScoreById(h.id, true);
      else if (h.type === 'hall') window.Hall.openHallById(h.id, true);
    }
    window.GuqinCommunity.boot();
    // 琴谱大厅
    $('#hallPlayBtn').addEventListener('click', () => window.Hall.play());
    $('#hallStopBtn').addEventListener('click', () => window.Hall.stop());
    // 双击空白清除选区
    $('#hallStripWrap').addEventListener('dblclick', (e) => {
      if (!e.target.closest('.hall-cell')) window.Hall.clearSelection();
    });
    $('#hallFavBtn').addEventListener('click', () => window.Hall.toggleFav());
    $('#hallEditBtn').addEventListener('click', () => window.Hall.toEditor());
    document.addEventListener('hall-edit', e => {
      editorScore = e.detail;
      $('#editTitle').value = editorScore.title || '';
      renderEditor();
      switchTab('editor');
    });
    document.addEventListener('lab-open-score', e => {
      current = e.detail;
      renderScore(e.detail);
      switchTab('score');
    });
    // 大厅点读不联动琴面（该视图无琴面）
    $('#playBtn').addEventListener('click', playCurrent);
    $('#stopBtn').addEventListener('click', () => { window.GuqinPlayer.stop(); clearHighlight(); });
    const huiBtn = $('#huiLabelBtn');
    if (huiBtn) huiBtn.addEventListener('click', () => {
      const on = huiBtn.classList.toggle('active');
      window.GuqinStage.setHuiLabels(on);
    });
    $('#tempoInput').addEventListener('change', () => {});
    // 编辑器
    $('#inputBtn').addEventListener('click', submitInput);
    $('#inputBox').addEventListener('keydown', e => { if (e.key === 'Enter') submitInput(); });
    $('#micBtn').addEventListener('click', toggleMic);
    $('#saveBtn').addEventListener('click', downloadScore);
    $('#clearBtn').addEventListener('click', () => { pushUndo(); editorScore = emptyScore(); undoStack = []; redoStack = []; renderEditor(); });
    $('#editPlayBtn').addEventListener('click', playEditor);
    $('#editPauseBtn').addEventListener('click', () => {
      if (window.GuqinPlayer.isPlaying()) { window.GuqinPlayer.pause(); $('#editPauseBtn').textContent = '▶ 继续'; }
      else { window.GuqinPlayer.resume(); $('#editPauseBtn').textContent = '⏸ 暂停'; }
    });
    $('#editStopBtn').addEventListener('click', () => { window.GuqinPlayer.stop(); clearHighlight(); $('#editPauseBtn').textContent = '⏸ 暂停'; });
    $('#followBtn').addEventListener('click', () => {
      followFocus = !followFocus;
      $('#followBtn').classList.toggle('active', followFocus);
      $('#followBtn').textContent = followFocus ? '🎯 跟随中' : '🎯 焦点跟随';
    });
    $('#undoBtn').addEventListener('click', undo);
    $('#redoBtn').addEventListener('click', redo);
    $('#newScoreBtn').addEventListener('click', () => { switchTab('editor'); editorScore = emptyScore(); undoStack = []; redoStack = []; renderEditor(); });
    document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    if (window.GuqinLab) window.GuqinLab.init();
    buildKeypad();
    editorScore = emptyScore();
    renderEditor();
    // 有保存的生成曲库则显示
    if (genBatch.length > 0) { $('#genPanel').style.display = 'block'; renderGenList(); }
    // 曲库筛选器
    const gs = $('#genSearch'); if (gs) gs.addEventListener('input', renderGenList);
  }

  function emptyScore() {
    return { title: '新谱', lines: [{ jianziTokens: [], rhythmTokens: [], sectionTempo: 60 }] };
  }

  /* ---------- 乐谱库 ---------- */
  function buildLibrary(q) {
    q = (q || '').trim();
    const box = $('#scoreList');
    const list = corpus
      .map(s => {
        const sc = s.score_content.score;
        let n = 0; sc.lines.forEach(l => (l.jianziTokens || []).forEach(t => t.kind === 'jianzi' && n++));
        return { s, sc, n };
      })
      .filter(x => x.n >= 10 && (!q || x.s.title.includes(q)))
      .sort((a, b) => b.n - a.n);
    box.innerHTML = list.map(x =>
      `<button class="score-item" data-id="${x.s.id}">
        <span class="s-title"></span>
        <span class="s-meta">${x.n} 字 · ${x.sc.lines.length} 行 · ${x.s.entity_type === 'library_item' ? '曲库' : '社区'} · ${x.s.created_at.slice(0, 10)}</span>
      </button>`).join('');
    box.querySelectorAll('.s-title').forEach((el, i) => el.textContent = list[i].s.title);
    box.querySelectorAll('.score-item').forEach((el, i) =>
      el.addEventListener('click', () => openScore(list[i].s)));
    $('#libCount').textContent = `共 ${list.length} 首`;
  }

  /* URL hash：#/score/<拼音slug> 静态链接，刷新不丢页面 */
  function scoreById(id) {
    return corpus.find(x => String(x.id) === String(id));
  }
  function slugOfScore(id) {
    return (window.GuqinHash && window.GuqinHash.slugOf(id)) || id;
  }
  function openScore(s, fromHash) {
    current = s;
    $('#scoreTitle').textContent = s.title;
    renderStrip(s.score_content.score);
    renderScore(s.score_content.score, '#scoreView');
    switchTab('score');
    if (!fromHash && s.id != null) {
      const slug = slugOfScore(s.id);
      const hash = '#/score/' + encodeURIComponent(slug);
      if (location.hash !== hash) location.hash = hash;
    }
  }
  function openScoreById(id, fromHash) {
    const s = scoreById(id);
    if (s) { openScore(s, fromHash); return true; }
    return false;
  }
  /* 解析 hash → {type, id}；slug 反查不到时退化为直接当 id 用（向后兼容） */
  function parseHash() {
    const s = location.hash.match(/^#\/score\/(.+)$/);
    if (s) {
      const seg = decodeURIComponent(s[1]);
      const id = (window.GuqinHash && window.GuqinHash.idFromSlug(seg)) || seg;
      return { type: 'score', id };
    }
    const h = location.hash.match(/^#\/hall\/(.+)$/);
    if (h) {
      const seg = decodeURIComponent(h[1]);
      const id = (window.GuqinHash && window.GuqinHash.idFromSlug(seg)) || seg;
      return { type: 'hall', id };
    }
    return null;
  }
  window.addEventListener('hashchange', () => {
    const p = parseHash();
    if (!p) return;
    if (p.type === 'score' && (!current || String(current.id) !== String(p.id))) openScoreById(p.id, true);
    else if (p.type === 'hall') {
      const cur = window.Hall.currentId ? window.Hall.currentId() : null;
      if (!cur || String(cur) !== String(p.id)) window.Hall.openHallById(p.id, true);
    }
  });

  /* token 类型 className：泛音/滑音/颤音 用于颜色与动画 */
  function tokenClass(tok) {
    const t = tok && tok.text; if (!t) return '';
    let cls = '';
    if (t.startsWith('泛')) cls += ' jz-fan';
    else if (t.startsWith('散')) cls += ' jz-san';
    if (t.startsWith('上') || t.startsWith('绰')) cls += ' jz-slide-up';
    else if (t.startsWith('下') || t.startsWith('注')) cls += ' jz-slide-down';
    if (t.includes('吟')) cls += ' jz-yin';
    if (t.includes('猱')) cls += ' jz-nao';
    if (t.includes('撞')) cls += ' jz-zhuang';
    return cls;
  }

  /* 顶部横向谱条（APK 演奏页样式） */
  function renderStrip(score) {
    const strip = $('#strip');
    strip.innerHTML = '';
    // 与大厅规则一致：连续序列，不插行分隔条（sep 会显示为意外空格）
    (score.lines || []).forEach((line, li) => {
      const rt = line.rhythmTokens || [];
      let lastR = null;
      (line.jianziTokens || []).forEach((tok, idx) => {
        if (tok.kind === 'blank') return;
        const r = (rt[idx] && rt[idx].kind !== 'blank') ? rt[idx] : lastR;
        if (rt[idx] && rt[idx].kind !== 'blank') lastR = rt[idx];
        // 控制符标记 jz-ctrl（不占 domIdx），与 renderScore/大厅一致
        const act = window.JianziSemantics.parseToken(tok);
        const isCtrl = act.type === 'ctrl';
        const el = document.createElement('button');
        el.className = 'jz-token' + (isCtrl ? ' jz-ctrl' : '') + tokenClass(tok);
        const beats = window.GuqinPlayer.rhythmToBeats(r);
        const rtxt = r ? r.text : '';
        el.innerHTML = '<span class="jz-rhythm">' + rtxt + '</span>' +
          (beats ? '<span class="jz-beats">' + beats + '</span>' : '<span class="jz-beats"></span>') +
          '<span class="jz-glyph">' + window.JianziRender.renderToken(tok, 52) + '</span>';
        el.title = tok.text + (beats ? '（' + beats + '）' : '');
        el.addEventListener('click', () => {
          window.GuqinAudio.ensureCtx();
          window.GuqinPlayer.tapToken(tok, r, +($('#tempoInput').value) || 60);
          flash(el); showExplain(tok.text);
        });
        strip.appendChild(el);
      });
    });
    strip.scrollLeft = 0;
  }

  function renderScore(score, sel) {
    const box = $(sel);
    box.innerHTML = '';
    (score.lines || []).forEach(line => {
      const div = document.createElement('div');
      div.className = 'score-line';
      const rt = line.rhythmTokens || [];
      let lastR = null;
      (line.jianziTokens || []).forEach((tok, idx) => {
        // blank 与大厅一致：不渲染占位空格（避免谱面出现意外空格）
        if (tok.kind === 'blank') return;
        const r = (rt[idx] && rt[idx].kind !== 'blank') ? rt[idx] : lastR;
        if (rt[idx] && rt[idx].kind !== 'blank') lastR = rt[idx];
        // 控制符（括号/从括号再作/少息/泛起/泛止等）标记为 jz-ctrl，不占 domIdx
        const act = window.JianziSemantics.parseToken(tok);
        const isCtrl = act.type === 'ctrl';
        const el = document.createElement('button');
        el.className = 'jz-token' + (isCtrl ? ' jz-ctrl' : '');
        el.dataset.idx = idx;
        const beats = window.GuqinPlayer.rhythmToBeats(r);
        const rtxt = r ? r.text : '';
        el.innerHTML = '<span class="jz-rhythm">' + rtxt + '</span>' +
          (beats ? '<span class="jz-beats">' + beats + '</span>' : '<span class="jz-beats"></span>') +
          '<span class="jz-glyph">' + window.JianziRender.renderToken(tok, 56) + '</span>';
        el.title = tok.text;
        el.addEventListener('click', () => {
          window.GuqinAudio.ensureCtx();
          window.GuqinPlayer.tapToken(tok);
          flash(el);
        });
        div.appendChild(el);
      });
      box.appendChild(div);
    });
  }

  function flash(el) {
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  function playCurrent() {
    if (!current) return;
    playScore(current.score_content.score, $('#tempoInput').value);
  }
  function playEditor() { playScore(editorScore, $('#tempoInput').value); }

  function playScore(score, tempoOverride) {
    window.GuqinPlayer.stop(); clearHighlight();
    const tempo = tempoOverride ? +tempoOverride : null;
    const sc = tempo ? { lines: score.lines.map(l => ({ ...l, sectionTempo: tempo })) } : score;
    const isCurrent = current && score === current.score_content.score;
    const strip = $('#strip');
    const tks = isCurrent ? [...strip.querySelectorAll('.jz-token:not(.jz-ctrl)')] : [...$('#editorView').querySelectorAll('.jz-token:not(.jz-ctrl)')];
    window.GuqinPlayer.play(sc, tempo,
      (i, ev) => {
        clearHighlight();
        const di = ev.domIdx != null ? ev.domIdx : i;
        const el = tks[di];
        if (el) {
          el.classList.add('playing');
          if (isCurrent) {
            el.classList.remove('done');
            tks.forEach((t, k) => { if (k < di) t.classList.add('done'); });
            // 谱面默认自动滚动跟随
            const wrap = document.getElementById('stripWrap');
            wrap.scrollTo({ left: el.offsetLeft - (wrap.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
          } else if (followFocus) {
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
      },
      () => clearHighlight());
  }
  function clearHighlight() { document.querySelectorAll('.jz-token.playing').forEach(e => e.classList.remove('playing')); }

  /* ---------- AI 生成曲库 ---------- */
  function loadGenScore(gs) {
    if (!gs) return;
    window.GuqinPlayer.stop(); clearHighlight();
    const pb = $('#editPauseBtn'); if (pb) pb.textContent = '⏸ 暂停';
    pushUndo();
    editorScore = { title: gs.title, lines: [] };
    gs.lines.forEach(lineData => {
      const line = { jianziTokens: [], rhythmTokens: [], sectionTempo: 60 };
      lineData.tokens.forEach(item => {
        line.jianziTokens.push(item.token);
        line.rhythmTokens.push({ code: 'rhythm-slot', kind: 'rhythm', text: '♪', duration: item.rhythm });
      });
      editorScore.lines.push(line);
    });
    $('#editTitle').value = gs.title;
    renderEditor();
  }
  function renderGenList() {
    const box = $('#genList'); if (!box) return;
    box.innerHTML = '';
    // 按生成时间降序（新曲在顶端）
    const sorted = [...genBatch].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    // 筛选
    const q = ($('#genSearch') ? $('#genSearch').value : '').trim().toLowerCase();
    const list = q ? sorted.filter(g => g.title.toLowerCase().includes(q)) : sorted;
    // 标题计数
    const header = $('#genPanel b');
    if (header) header.textContent = '🎲 AI 生成曲库（' + list.length + '/' + genBatch.length + '）';
    list.forEach((gs, idx) => {
      const row = document.createElement('div');
      row.className = 'gen-row';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;cursor:pointer';
      const titleEl = document.createElement('span');
      titleEl.style.cssText = 'flex:1;font-size:14px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      titleEl.textContent = (idx+1) + '. ' + gs.title;
      titleEl.title = gs.title + '\n生成于 ' + formatDateTime(gs.createdAt);
      const dateEl = document.createElement('span');
      dateEl.style.cssText = 'font-size:11px;color:#a09478;flex-shrink:0;margin-right:4px';
      dateEl.textContent = formatDateTime(gs.createdAt);
      titleEl.addEventListener('click', () => { loadGenScore(gs); renderGenList(); });
      row.appendChild(titleEl);
      row.appendChild(dateEl);
      // 点赞
      const likeBtn = document.createElement('button');
      likeBtn.style.cssText = 'border:none;background:transparent;cursor:pointer;font-size:14px;padding:2px 4px;border-radius:4px';
      const vote = genVotes[gs.id] || 0;
      likeBtn.textContent = (vote === 1 ? '👍' : '👍') + (gs.likes || '');
      likeBtn.style.opacity = vote === 1 ? '1' : '0.5';
      likeBtn.title = '好听，点赞';
      likeBtn.addEventListener('click', e => { e.stopPropagation(); castVote(gs.id, 1); });
      // 点踩
      const disBtn = document.createElement('button');
      disBtn.style.cssText = 'border:none;background:transparent;cursor:pointer;font-size:14px;padding:2px 4px;border-radius:4px';
      disBtn.textContent = (vote === -1 ? '👎' : '👎') + (gs.dislikes || '');
      disBtn.style.opacity = vote === -1 ? '1' : '0.5';
      disBtn.title = '不好听，点踩';
      disBtn.addEventListener('click', e => { e.stopPropagation(); castVote(gs.id, -1); });
      row.appendChild(likeBtn);
      row.appendChild(disBtn);
      box.appendChild(row);
    });
  }
  function castVote(id, val) {
    const gs = genBatch.find(g => g.id === id); if (!gs) return;
    const cur = genVotes[id] || 0;
    if (cur === val) { genVotes[id] = 0; if (val === 1) gs.likes--; else gs.dislikes--; }
    else {
      if (cur === 1) gs.likes--; if (cur === -1) gs.dislikes--;
      genVotes[id] = val; if (val === 1) gs.likes++; else gs.dislikes++;
    }
    localStorage.setItem('h5-gen-votes', JSON.stringify(genVotes));
    saveGenBatch();
    renderGenList();
  }
  function saveGenBatch() {
    // 最多保留 100 首，避免 localStorage 溢出
    if (genBatch.length > 100) genBatch = genBatch.slice(0, 100);
    try { localStorage.setItem('h5-gen-batch', JSON.stringify(genBatch)); } catch (e) { /* 空间不足忽略 */ }
  }
  /* 同步当前 AI 曲库到本地文件 data/gen_scores.json（通过 Node 后端落盘） */
  async function syncGenToFile() {
    const votes = {};
    try { Object.assign(votes, JSON.parse(localStorage.getItem('h5-gen-votes') || '{}')); } catch (e) {}
    const payload = { scores: genBatch, votes, syncedAt: new Date().toISOString() };
    const echo = $('#inputEcho');
    if (echo) echo.textContent = '同步中…';
    try {
      const res = await fetch('/api/gen-scores', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const r = await res.json();
      if (echo) echo.textContent = `✅ 已同步 ${r.count} 首到本地文件 data/gen_scores.json`;
    } catch (e) {
      if (echo) echo.textContent = '⚠ 同步失败（需用 node server.js 启动后端）: ' + e.message;
    }
  }
  /* 从本地文件加载 AI 曲库（启动时调用，合并 localStorage 缺失的数据） */
  async function loadGenFromFile() {
    try {
      const res = await fetch('/api/gen-scores');
      if (!res.ok) return;
      const data = await res.json();
      const fileScores = data.scores || [];
      if (!fileScores.length) return;
      // 按 id 合并：文件中有但 localStorage 没有的，补充进来
      const localIds = new Set(genBatch.map(s => s && s.id).filter(Boolean));
      let added = 0;
      for (const s of fileScores) {
        if (s && s.id && !localIds.has(s.id)) { genBatch.push(s); added++; }
      }
      if (added > 0) {
        genBatch.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        if (genBatch.length > 100) genBatch = genBatch.slice(0, 100);
        saveGenBatch();
        if ($('#genList')) renderGenList();
        console.log(`从本地文件补充了 ${added} 首 AI 曲目，当前共 ${genBatch.length} 首`);
      }
    } catch (e) { /* 后端未启动时静默忽略 */ }
  }
  /* 收集禁止使用的曲名集合：曲库 + 大厅 + 民歌集成 + 已有 AI 曲目 */
  function collectBannedTitles() {
    const banned = new Set();
    corpus.forEach(s => s && s.title && banned.add(s.title));
    hallScores.forEach(s => s && s.title && banned.add(s.title));
    folkTitles.forEach(t => t && banned.add(t));
    genBatch.forEach(s => s && s.title && banned.add(s.title));
    return banned;
  }
  /* 启动时修复历史 AI 曲目中与曲库/大厅雷同的标题。
   * 规则：对每个雷同的标题，重新用词库生成一个不雷同的新标题。 */
  function repairGenTitles() {
    const corpusTitles = new Set((corpus || []).map(s => s && s.title).filter(Boolean));
    const hallTitles = new Set((hallScores || []).map(s => s && s.title).filter(Boolean));
    const folkSet = new Set(folkTitles || []);
    let changed = false;
    const seen = new Set();
    for (const gs of genBatch) {
      if (!gs || !gs.title) continue;
      const collide = corpusTitles.has(gs.title) || hallTitles.has(gs.title) || folkSet.has(gs.title) || seen.has(gs.title);
      if (!collide) { seen.add(gs.title); continue; }
      // 用词库重新生成：禁止集合 = 曲库+大厅+民歌+已存在
      const banned = new Set([...corpusTitles, ...hallTitles, ...folkSet, ...seen]);
      const before = gs.title;
      try {
        gs.title = window.JianziInput.generateTitle(banned);
      } catch (e) {
        console.warn('generateTitle 失败，保留原标题', e);
        seen.add(gs.title);
        continue;
      }
      seen.add(gs.title);
      changed = true;
      console.warn('[修复] AI 曲目标题雷同：', before, '→', gs.title);
    }
    if (changed) { saveGenBatch(); if ($('#genList')) renderGenList(); }
  }
  function formatDateTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* ---------- 编辑器 / 输入 ---------- */
  // 撤销/重做栈
  let undoStack = [], redoStack = [];
  function pushUndo() { undoStack.push(JSON.stringify(editorScore)); if (undoStack.length > 50) undoStack.shift(); }
  function undo() {
    if (!undoStack.length) { $('#inputEcho').textContent = '无可撤销'; return; }
    redoStack.push(JSON.stringify(editorScore));
    editorScore = JSON.parse(undoStack.pop());
    renderEditor();
    $('#inputEcho').textContent = '已撤销';
  }
  function redo() {
    if (!redoStack.length) { $('#inputEcho').textContent = '无可重做'; return; }
    undoStack.push(JSON.stringify(editorScore));
    editorScore = JSON.parse(redoStack.pop());
    renderEditor();
    $('#inputEcho').textContent = '已重做';
  }

  // 减字键盘（输入法）：分组按钮，点击追加字符到输入框
  const RHYTHMS = [
    { label: '♬ 十六分', val: 'sixteenth' },
    { label: '♪ 八分', val: 'eighth' },
    { label: '♩ 四分', val: 'quarter' },
    { label: '𝅗𝅥 二分', val: 'half' },
    { label: '𝅝 全音', val: 'whole' },
  ];
  const KEYPAD = [
    { title: '散/泛', cls: 'fn', keys: ['散', '泛起', '泛止'] },
    { title: '左手指', keys: ['大', '食', '中', '名'] },
    { title: '徽位', keys: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] },
    { title: '右手指法', keys: ['擘', '抹', '挑', '勾', '剔', '摘', '打', '历'] },
    { title: '弦号', keys: ['一', '二', '三', '四', '五', '六', '七'] },
    { title: '前置滑音', cls: 'fn', keys: ['绰', '注'] },
    { title: '装饰音', keys: ['吟', '猱', '撞'] },
    { title: '走手音', cls: 'fn', keys: ['上', '下', '进复', '退复'] },
    { title: '撮/掩/应合', cls: 'fn', keys: ['撮', '掩', '应合', '分开'] },
    { title: '掐起/带起/抓起', keys: ['掐起', '带起', '抓起'] },
    { title: '控制符', cls: 'ctrl', keys: ['少息', '曲终', '从头', '再作', '如一'] },
  ];

  function checkInputError() {
    const err = $('#inputError');
    const text = $('#inputBox').value;
    const msg = window.JianziInput.validate(text);
    err.textContent = msg || '';
    updateKeypadState();
    return !msg;
  }

  // 根据当前输入预测每个按键点击后是否仍能组成合法减字，不能则置灰禁用
  function updateKeypadState() {
    const cur = $('#inputBox').value;
    const btns = $('#keypad').querySelectorAll('.key-btn:not(.del):not(.rhythm-btn)');
    btns.forEach(btn => {
      const k = btn.textContent;
      // 按按钮实际行为计算候选文本：fn/ctrl 类前置加空格，其余直接并入
      const isCtrlOrFn = btn.classList.contains('ctrl') || btn.classList.contains('fn');
      const sep = isCtrlOrFn && cur && !cur.endsWith(' ') ? ' ' : '';
      const candidate = cur + sep + k;
      let ok = window.JianziInput.isValidPrefix(candidate);
      // 配对结尾词（泛止/再作/分开）：必须有对应的未关闭开头词
      if (ok && ['泛止', '再作', '分开'].includes(k)) {
        ok = window.JianziInput.canUseEndWord(cur, k);
      }
      btn.classList.toggle('disabled', !ok);
    });
  }

  function buildKeypad() {
    const pad = $('#keypad'); if (!pad) return;
    pad.innerHTML = '';
    $('#inputBox').addEventListener('input', checkInputError);

    // ===== 第一行：节奏 + 删除 + 清空 + 随机 =====
    const topRow = document.createElement('div');
    topRow.className = 'keypad-row keypad-toprow';
    // 节奏按钮
    RHYTHMS.forEach(rh => {
      const b = document.createElement('button');
      b.className = 'key-btn rhythm-btn' + (rh.val === $('#rhythmSel').value ? ' active' : '');
      b.textContent = rh.label;
      b.dataset.val = rh.val;
      b.addEventListener('click', () => {
        $('#rhythmSel').value = rh.val;
        topRow.querySelectorAll('.rhythm-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
      topRow.appendChild(b);
    });
    const spacer = document.createElement('span');
    spacer.style.flex = '1';
    topRow.appendChild(spacer);
    // 曲风提示词输入框（如"秋风""泛音""梅花"）
    const styleInput = document.createElement('input');
    styleInput.type = 'text';
    styleInput.id = 'stylePrompt';
    styleInput.placeholder = '曲风提示：秋风 / 泛音 / 梅花 / 流水...';
    styleInput.style.cssText = 'flex:1;min-width:140px;font-size:13px;padding:5px 8px;border:1px solid #d8c9a8;border-radius:6px';
    styleInput.title = '输入任意曲风词：秋风/萧瑟/空灵/清雅/欢快/悲凉/潺潺/巍峨...（支持同义词模糊匹配）';
    topRow.appendChild(styleInput);
    // 删除 / 清空 / 随机
    const backBtn = document.createElement('button');
    backBtn.className = 'key-btn del';
    backBtn.textContent = '⌫';
    backBtn.addEventListener('click', () => {
      const box = $('#inputBox');
      box.value = box.value.replace(/[\u4e00-\u9fff]+$/, '').trim();
      box.focus(); checkInputError();
    });
    const clrBtn = document.createElement('button');
    clrBtn.className = 'key-btn del';
    clrBtn.textContent = '清空';
    clrBtn.addEventListener('click', () => { $('#inputBox').value = ''; $('#inputError').textContent = ''; $('#inputBox').focus(); checkInputError(); });
    const rndBtn = document.createElement('button');
    rndBtn.className = 'key-btn rnd';
    rndBtn.textContent = '🎲 随机';
    rndBtn.addEventListener('click', () => {
      const prompt = (styleInput.value || '').trim();
      const newScores = window.JianziInput.generateBatchScores(10, collectBannedTitles(), prompt || null);
      genBatch = newScores.concat(genBatch);
      saveGenBatch();
      loadGenScore(genBatch[0]);
      renderGenList();
      $('#genPanel').style.display = 'block';
      // 显示匹配到的曲风
      const parsed = prompt ? window.JianziInput.parseStylePrompt(prompt) : null;
      const matched = parsed && parsed._matched ? parsed._matched.join('+') : '';
      const desc = prompt ? `（曲风：${prompt}${matched ? ' → ' + matched : ''}）` : '';
      $('#inputEcho').textContent = '已生成 10 首新曲目' + desc + '并置顶，共 ' + genBatch.length + ' 首';
    });
    // 同步到本地文件（开发阶段：通过 Node 后端落盘，突破 localStorage 端口隔离）
    const syncBtn = document.createElement('button');
    syncBtn.className = 'key-btn sync';
    syncBtn.textContent = '💾 同步';
    syncBtn.title = '把当前 AI 曲库同步到本地文件 data/gen_scores.json（需 Node 后端运行）';
    syncBtn.addEventListener('click', syncGenToFile);
    topRow.appendChild(backBtn);
    topRow.appendChild(clrBtn);
    topRow.appendChild(rndBtn);
    topRow.appendChild(syncBtn);
    pad.appendChild(topRow);

    // ===== 左右两栏 =====
    const cols = document.createElement('div');
    cols.className = 'keypad-cols';
    const leftCol = document.createElement('div');
    leftCol.className = 'keypad-col';
    const rightCol = document.createElement('div');
    rightCol.className = 'keypad-col';

    // 左栏：前 6 组（散/泛、左手指、徽位、右手指法、弦号、前置滑音）
    KEYPAD.slice(0, 6).forEach(grp => leftCol.appendChild(buildGrp(grp)));
    // 右栏：后 5 组（装饰音、走手音、撮/掩/应合、掐起/带起/抓起、控制符）
    KEYPAD.slice(6).forEach(grp => rightCol.appendChild(buildGrp(grp)));

    cols.appendChild(leftCol);
    cols.appendChild(rightCol);
    pad.appendChild(cols);

    // 初始化按键状态
    updateKeypadState();
  }

  // 构建单个按键组
  function buildGrp(grp) {
    const g = document.createElement('div');
    g.className = 'keypad-grp';
    g.innerHTML = '<div class="keypad-grp-title">' + grp.title + '</div>';
    const row = document.createElement('div');
    row.className = 'keypad-row';
    grp.keys.forEach(k => {
      const btn = document.createElement('button');
      btn.className = 'key-btn' + (grp.cls ? ' ' + grp.cls : '');
      btn.textContent = k;
      btn.addEventListener('click', () => {
        if (btn.classList.contains('disabled')) return;
        const box = $('#inputBox');
        const sep = (grp.cls === 'ctrl' || grp.cls === 'fn') && box.value && !box.value.endsWith(' ') ? ' ' : '';
        box.value += sep + k;
        box.focus(); checkInputError();
        if (grp.cls === 'ctrl') { submitInput(); $('#inputError').textContent = ''; }
      });
      row.appendChild(btn);
    });
    g.appendChild(row);
    return g;
  }

  function submitInput() {
    const text = $('#inputBox').value.trim();
    if (!text) return;
    const toks = window.JianziInput.compose(text);
    if (!toks.length) { $('#inputEcho').textContent = '⚠ 语法错误：减字需「指+徽+技法+弦」或「散+技法+弦」，如「大七挑四」「散勾三」'; return; }
    pushUndo();
    let line = editorScore.lines[editorScore.lines.length - 1];
    if (!line.jianziTokens) { line.jianziTokens = []; line.rhythmTokens = []; }
    toks.forEach(t => {
      line.jianziTokens.push(t);
      line.rhythmTokens.push({ code: 'rhythm-slot', kind: 'rhythm', text: '♪', duration: $('#rhythmSel').value });
      if (line.jianziTokens.filter(t => t.kind !== 'blank').length >= 10) {
        editorScore.lines.push({ jianziTokens: [], rhythmTokens: [], sectionTempo: line.sectionTempo || 60 });
        line = editorScore.lines[editorScore.lines.length - 1];
      }
    });
    $('#inputBox').value = '';
    $('#inputError').textContent = '';
    $('#inputEcho').textContent = '已录入：' + toks.map(t => t.text).join('、');
    renderEditor();
  }

  function renderEditor() {
    $('#editTitle').value = editorScore.title || '';
    const box = $('#editorView');
    box.innerHTML = '';
    editorScore.lines.forEach((line, li) => {
      const div = document.createElement('div');
      div.className = 'score-line edit-line';
      const rt = line.rhythmTokens || [];
      let lastR = null;
      (line.jianziTokens || []).forEach((tok, idx) => {
        if (tok.kind === 'blank') return;
        const r = (rt[idx] && rt[idx].kind !== 'blank') ? rt[idx] : lastR;
        if (rt[idx] && rt[idx].kind !== 'blank') lastR = rt[idx];
        const el = document.createElement('button');
        el.className = 'jz-token' + tokenClass(tok);
        const beats = window.GuqinPlayer.rhythmToBeats(r);
        const rtxt = r ? r.text : '';
        el.innerHTML = '<span class="jz-rhythm">' + rtxt + '</span>' +
          (beats ? '<span class="jz-beats">' + beats + '</span>' : '<span class="jz-beats"></span>') +
          '<span class="jz-glyph">' + window.JianziRender.renderToken(tok, 56) + '</span>';
        el.title = tok.text;
        el.addEventListener('click', () => {
          window.GuqinAudio.ensureCtx();
          window.GuqinPlayer.tapToken(tok, r, +($('#tempoInput').value) || 60); flash(el);
        });
        el.addEventListener('contextmenu', e => {
          e.preventDefault();
          line.jianziTokens.splice(idx, 1); line.rhythmTokens && line.rhythmTokens.splice(idx, 1);
          renderEditor();
        });
        div.appendChild(el);
      });
      const addLb = document.createElement('button');
      addLb.className = 'line-btn'; addLb.textContent = '↵';
      addLb.title = '换行'; addLb.onclick = () => { editorScore.lines.splice(li + 1, 0, { jianziTokens: [], rhythmTokens: [], sectionTempo: line.sectionTempo || 60 }); renderEditor(); };
      const delLb = document.createElement('button');
      delLb.className = 'line-btn'; delLb.textContent = '✕'; delLb.title = '删行';
      delLb.onclick = () => {
        if (editorScore.lines.length > 1) { editorScore.lines.splice(li, 1); renderEditor(); return; }
        // 最后一行：清空内容而非拒绝
        line.jianziTokens = []; line.rhythmTokens = [];
        renderEditor();
      };
      div.appendChild(addLb); div.appendChild(delLb);
      box.appendChild(div);
    });
  }

  function downloadScore() {
    const data = { title: $('#editTitle').value || editorScore.title, score_content: { score: editorScore } };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (data.title || '新谱') + '.json';
    a.click();
  }

  /* ---------- 语音 ---------- */
  function toggleMic() {
    const btn = $('#micBtn');
    if (window.GuqinSpeech.isActive()) {
      window.GuqinSpeech.stop();
      btn.classList.remove('rec'); btn.textContent = '🎤 语音';
      return;
    }
    if (!window.GuqinSpeech.supported()) { alert('此浏览器不支持语音识别，请用 Chrome/Edge 打开'); return; }
    btn.classList.add('rec'); btn.textContent = '● 录音中';
    window.GuqinSpeech.start(
      text => { $('#inputBox').value = text; submitInput(); },
      text => { $('#inputEcho').textContent = '识别中：' + text; },
      err => { $('#inputEcho').textContent = '语音错误：' + err; }
    );
  }

  function switchTab(name) {
    // 切换页面强制停止播放（单实例约束）
    window.GuqinPlayer.stop(); clearHighlight();
    const pb = $('#editPauseBtn'); if (pb) pb.textContent = '⏸ 暂停';
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('show', p.id === 'page-' + name));
    if (name === 'score') requestAnimationFrame(() => window.GuqinStage.resize());
  }

  document.addEventListener('DOMContentLoaded', boot);

  // 音源 + 混响按钮切换（左上角）
  document.addEventListener('DOMContentLoaded', () => {
    const srcBtn = document.getElementById('sourceBtn');
    if (srcBtn) {
      // 初始化音源按钮状态：点亮=教授，未点亮=APK
      const initSrc = window.GuqinAudio.getSource() || 'apk';
      const applySrc = (s) => {
        srcBtn.textContent = '音源 ' + (s === 'prof' ? '教授' : 'APK');
        srcBtn.classList.toggle('active', s === 'prof');
      };
      applySrc(initSrc);
      srcBtn.addEventListener('click', () => {
        const cur = window.GuqinAudio.getSource() || 'apk';
        const next = cur === 'apk' ? 'prof' : 'apk';
        window.GuqinAudio.setSource(next);
        applySrc(next);
        if (window.GuqinPlayer && window.GuqinPlayer.isPlaying && window.GuqinPlayer.isPlaying()) {
          window.GuqinPlayer.stop();
        }
      });
    }
    // 音效按钮：点击弹出音效调整面板（混响开关/干湿/房间大小/APK 泛音滤波）
    const fxBtn = document.getElementById('fxBtn');
    const fxPanel = document.getElementById('fxPanel');
    if (fxBtn && fxPanel) {
      const A = window.GuqinAudio;
      const $id = id => document.getElementById(id);
      const els = {
        on: $id('fxReverbOn'), wet: $id('fxWet'), wetV: $id('fxWetVal'),
        room: $id('fxRoom'), roomV: $id('fxRoomVal'),
        str: $id('fxStr'), strV: $id('fxStrVal'),
        freq: $id('fxFreq'), freqV: $id('fxFreqVal'),
        close: $id('fxClose'), reset: $id('fxReset'),
      };
      const DEFAULTS = { reverbOn: true, wet: 0.9, room: 2.8, fxStrength: 0.8, fxFreq: 4.5 };
      // 面板 UI ← 引擎状态
      const syncUI = (fx) => {
        els.on.checked = !!fx.reverbOn;
        els.wet.value = Math.round(fx.wet * 100); els.wetV.textContent = els.wet.value + '%';
        els.room.value = Math.round(fx.room * 10); els.roomV.textContent = fx.room.toFixed(1) + 's';
        els.str.value = Math.round(fx.fxStrength * 100); els.strV.textContent = els.str.value + '%';
        els.freq.value = Math.round(fx.fxFreq * 10); els.freqV.textContent = '×' + fx.fxFreq.toFixed(1);
      };
      syncUI(A.setFx());
      fxBtn.addEventListener('click', e => {
        e.stopPropagation();
        const show = fxPanel.style.display === 'none';
        fxPanel.style.display = show ? 'block' : 'none';
        if (show) syncUI(A.setFx());
      });
      els.close.addEventListener('click', () => { fxPanel.style.display = 'none'; });
      // 点击面板外关闭
      document.addEventListener('click', e => {
        if (fxPanel.style.display === 'none') return;
        if (fxPanel.contains(e.target) || fxBtn.contains(e.target)) return;
        fxPanel.style.display = 'none';
      });
      els.on.addEventListener('change', () => A.setFx({ reverbOn: els.on.checked }));
      els.wet.addEventListener('input', () => {
        A.setFx({ wet: els.wet.value / 100 });
        els.wetV.textContent = els.wet.value + '%';
      });
      els.room.addEventListener('change', () => {
        A.setFx({ room: els.room.value / 10 });
        els.roomV.textContent = (els.room.value / 10).toFixed(1) + 's';
      });
      els.str.addEventListener('input', () => {
        A.setFx({ fxStrength: els.str.value / 100 });
        els.strV.textContent = els.str.value + '%';
      });
      els.freq.addEventListener('input', () => {
        A.setFx({ fxFreq: els.freq.value / 10 });
        els.freqV.textContent = '×' + (els.freq.value / 10).toFixed(1);
      });
      els.reset.addEventListener('click', () => { syncUI(A.setFx(DEFAULTS)); });
    }
  });
})();
