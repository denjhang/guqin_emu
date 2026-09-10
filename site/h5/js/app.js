/* 主应用：乐谱库 / 播放 / 点读 / 编辑 / 文字·语音输入 */
(function () {
  'use strict';
  const $ = sel => document.querySelector(sel);
  let corpus = [];           // 全部谱面（来自 all_raw.json）
  let current = null;        // 当前谱对象
  let editorScore = null;    // 编辑中的谱

  async function loadJSON(url) { const r = await fetch(url); return r.json(); }

  async function boot() {
    const [glyphPaths, glyphParts, , pitch, all] = await Promise.all([
      loadJSON('data/glyph_paths.json'),
      loadJSON('data/glyph_parts.json'),
      loadJSON('data/category_rules.json'),
      loadJSON('data/pitch.json'),
      loadJSON('scores/all_raw.json'),
    ]);
    corpus = all;
    window.JianziRender.init(glyphPaths, glyphParts);
    window.JianziSemantics.init(glyphParts);
    window.JianziInput.init(glyphParts, corpus);
    window.GuqinAudio.init(pitch);
    window.GuqinAudio.preload();
    buildLibrary('');
    $('#searchBox').addEventListener('input', e => buildLibrary(e.target.value));
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

  function openScore(s) {
    current = s;
    $('#scoreTitle').textContent = s.title;
    renderScore(s.score_content.score, '#scoreView');
    switchTab('score');
  }

  function renderScore(score, sel) {
    const box = $(sel);
    box.innerHTML = '';
    (score.lines || []).forEach(line => {
      const div = document.createElement('div');
      div.className = 'score-line';
      (line.jianziTokens || []).forEach((tok, idx) => {
        if (tok.kind === 'blank') { div.appendChild(Object.assign(document.createElement('span'), { className: 'blank', textContent: ' ' })); return; }
        const el = document.createElement('button');
        el.className = 'jz-token';
        el.dataset.idx = idx;
        el.innerHTML = window.JianziRender.renderToken(tok, 56);
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
    // 用 override 改写各行 tempo
    const sc = tempo ? { lines: score.lines.map(l => ({ ...l, sectionTempo: tempo })) } : score;
    const tokens = $(current && score === current.score_content.score ? '#scoreView' : '#editorView');
    const tks = [...tokens.querySelectorAll('.jz-token')];
    window.GuqinPlayer.play(sc, tempo,
      (i) => { clearHighlight(); const el = tks[i]; if (el) { el.classList.add('playing'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } },
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
      (line.jianziTokens || []).forEach((tok, idx) => {
        if (tok.kind === 'blank') return;
        const el = document.createElement('button');
        el.className = 'jz-token';
        el.innerHTML = window.JianziRender.renderToken(tok, 56);
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
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
