/* 主应用：乐谱库 / 播放 / 点读 / 编辑 / 文字·语音输入 */
(function () {
  'use strict';
  const $ = sel => document.querySelector(sel);
  let corpus = [];           // 全部谱面（来自 all_raw.json）
  let current = null;        // 当前谱对象
  let editorScore = null;    // 编辑中的谱
  let techDict = [];         // 技法解说词典
  let slugMap = { byId: {}, bySlug: {} }; // 拼音 slug 映射

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
    try { window.Hall.setHallScores(await loadJSON('community/hall_scores.json')); } catch (e) { console.warn('hall_scores 加载失败', e); }
    window.JianziRender.init(glyphPaths, glyphParts);
    window.JianziSemantics.init(glyphParts);
    window.JianziInput.init(glyphParts, corpus);
    window.GuqinAudio.init(pitch);
    window.GuqinAudio.preload();
    window.GuqinStage.init(document.getElementById('qinCanvas'), pitch);
    buildLibrary('');
    $('#searchBox').addEventListener('input', e => buildLibrary(e.target.value));
    window.Hall.build();
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
    $('#hallFavBtn').addEventListener('click', () => window.Hall.toggleFav());
    $('#hallEditBtn').addEventListener('click', () => window.Hall.toEditor());
    document.addEventListener('hall-edit', e => {
      editorScore = e.detail;
      $('#editTitle').value = editorScore.title || '';
      renderEditor();
      switchTab('editor');
    });
    // 大厅点读不联动琴面（该视图无琴面）
    $('#playBtn').addEventListener('click', playCurrent);
    $('#stopBtn').addEventListener('click', () => { window.GuqinPlayer.stop(); clearHighlight(); });
    $('#tempoInput').addEventListener('change', () => {});
    // 编辑器
    $('#inputBtn').addEventListener('click', submitInput);
    $('#inputBox').addEventListener('keydown', e => { if (e.key === 'Enter') submitInput(); });
    $('#micBtn').addEventListener('click', toggleMic);
    $('#saveBtn').addEventListener('click', downloadScore);
    $('#clearBtn').addEventListener('click', () => { editorScore = emptyScore(); renderEditor(); });
    $('#editPlayBtn').addEventListener('click', playEditor);
    $('#newScoreBtn').addEventListener('click', () => { switchTab('editor'); editorScore = emptyScore(); renderEditor(); });
    document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    editorScore = emptyScore();
    renderEditor();
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

  /* 顶部横向谱条（APK 演奏页样式） */
  function renderStrip(score) {
    const strip = $('#strip');
    strip.innerHTML = '';
    (score.lines || []).forEach((line, li) => {
      if (li > 0) { const sep = document.createElement('div'); sep.className = 'sep'; strip.appendChild(sep); }
      const rt = line.rhythmTokens || [];
      let lastR = null;
      (line.jianziTokens || []).forEach((tok, idx) => {
        if (tok.kind === 'blank') return;
        const r = (rt[idx] && rt[idx].kind !== 'blank') ? rt[idx] : lastR;
        if (rt[idx] && rt[idx].kind !== 'blank') lastR = rt[idx];
        const el = document.createElement('button');
        el.className = 'jz-token';
        const beats = window.GuqinPlayer.rhythmToBeats(r);
        const rtxt = r ? r.text : '';
        el.innerHTML = '<span class="jz-rhythm">' + rtxt + '</span>' +
          (beats ? '<span class="jz-beats">' + beats + '</span>' : '<span class="jz-beats"></span>') +
          '<span class="jz-glyph">' + window.JianziRender.renderToken(tok, 52) + '</span>';
        el.title = tok.text + (beats ? '（' + beats + '）' : '');
        el.addEventListener('click', () => {
          window.GuqinAudio.ensureCtx();
          const act = window.GuqinPlayer.tapToken(tok);
          fireStage(act); flash(el); showExplain(tok.text);
        });
        strip.appendChild(el);
      });
    });
    strip.scrollLeft = 0;
  }

  /* 把解析出的动作喂给琴面动画 */
  function fireStage(act) {
    const notes = [];
    if (act.type === 'pluck') notes.push(act);
    else if (act.type === 'chord') (act.positions || []).forEach(n => notes.push(n));
    else if (act.type === 'sweep') {
      const step = act.to >= act.from ? 1 : -1;
      for (let s = act.from; step > 0 ? s <= act.to : s >= act.to; s += step)
        notes.push({ string: s, open: true });
    }
    notes.forEach((n, i) => {
      if (!n.string) return;
      const fire = () => window.GuqinStage.press({ string: n.string, hui: n.hui || null, open: n.open, harmonic: n.harmonic });
      i === 0 ? fire() : setTimeout(fire, i * 80);
    });
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
        if (tok.kind === 'blank') { div.appendChild(Object.assign(document.createElement('span'), { className: 'blank', textContent: ' ' })); return; }
        const r = (rt[idx] && rt[idx].kind !== 'blank') ? rt[idx] : lastR;
        if (rt[idx] && rt[idx].kind !== 'blank') lastR = rt[idx];
        const el = document.createElement('button');
        el.className = 'jz-token';
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
    const tks = isCurrent ? [...strip.querySelectorAll('.jz-token')] : [...$('#editorView').querySelectorAll('.jz-token')];
    window.GuqinPlayer.play(sc, tempo,
      (i, ev) => {
        clearHighlight();
        const di = ev.domIdx != null ? ev.domIdx : i;
        const el = tks[di];
        if (el) {
          el.classList.add('playing');
          if (isCurrent) {
            el.classList.remove('done');
            // 手动居中：避免 scrollIntoView 连带滚动整页
            const wrap = document.getElementById('stripWrap');
            wrap.scrollTo({ left: el.offsetLeft - (wrap.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
            tks.forEach((t, k) => { if (k < di) t.classList.add('done'); });
          } else el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        fireStage(ev.action);
      },
      () => clearHighlight());
  }
  function clearHighlight() { document.querySelectorAll('.jz-token.playing').forEach(e => e.classList.remove('playing')); }

  /* ---------- 编辑器 / 输入 ---------- */
  function submitInput() {
    const text = $('#inputBox').value.trim();
    if (!text) return;
    const toks = window.JianziInput.compose(text);
    if (!toks.length) { $('#inputEcho').textContent = '未能识别，试试「大七挑四」「散勾三」「泛起」'; return; }
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
        el.className = 'jz-token';
        const beats = window.GuqinPlayer.rhythmToBeats(r);
        const rtxt = r ? r.text : '';
        el.innerHTML = '<span class="jz-rhythm">' + rtxt + '</span>' +
          (beats ? '<span class="jz-beats">' + beats + '</span>' : '<span class="jz-beats"></span>') +
          '<span class="jz-glyph">' + window.JianziRender.renderToken(tok, 56) + '</span>';
        el.title = tok.text;
        el.addEventListener('click', () => {
          window.GuqinAudio.ensureCtx();
          window.GuqinPlayer.tapToken(tok); flash(el);
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
      delLb.onclick = () => { if (editorScore.lines.length > 1) { editorScore.lines.splice(li, 1); renderEditor(); } };
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
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('show', p.id === 'page-' + name));
    if (name === 'score') requestAnimationFrame(() => window.GuqinStage.resize());
  }

  document.addEventListener('DOMContentLoaded', boot);

  // 音源切换
  document.addEventListener('DOMContentLoaded', () => {
    const sel = document.getElementById('sourceSel');
    if (!sel) return;
    sel.value = window.GuqinAudio.getSource();
    sel.addEventListener('change', () => {
      window.GuqinAudio.setSource(sel.value);
      // 清空采样缓存，下次播放重新加载新音源
      if (window.GuqinPlayer && window.GuqinPlayer.isPlaying && window.GuqinPlayer.isPlaying()) {
        window.GuqinPlayer.stop();
      }
    });
  });
})();
