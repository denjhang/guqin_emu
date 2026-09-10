/* 琴谱大厅：封面卡片墙 + 大厅阅读视图（上音符/下减字谱条，无琴面）
 * 复刻 APK「琴谱大厅」：标题/封面/作者/收藏数/编辑·播放模式 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  let corpus = [], scoresById = {}, favKey = 'h5-hall-favorites-v1';
  let hallScore = null, hallTokens = [], hallPlaying = false;

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

  /* 默认封面： deterministic 渐变 + 首字大字 */
  function coverSVG(s) {
    let h = 0; for (const c of s.title) h = (h * 33 + c.codePointAt(0)) >>> 0;
    const hue = h % 360, hue2 = (hue + 40) % 360;
    const ch = s.title.replace(/^《|》$/g, '')[0] || '琴';
    return `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g${h}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hue},38%,88%)"/><stop offset="1" stop-color="hsl(${hue2},30%,72%)"/>
      </linearGradient></defs>
      <rect width="120" height="160" fill="url(#g${h})"/>
      <text x="60" y="86" font-size="56" text-anchor="middle" fill="rgba(43,0,0,.82)" font-family="serif">${ch}</text>
      <text x="60" y="140" font-size="13" text-anchor="middle" fill="rgba(43,0,0,.6)" font-family="sans-serif">${s.title.length > 8 ? s.title.slice(0, 8) + '…' : s.title}</text>
    </svg>`;
  }

  function build() {
    scoresById = {};
    const box = $('#hallGrid');
    const list = corpus
      .map(s => { const sc = s.score_content.score; let n = 0; sc.lines.forEach(l => (l.jianziTokens || []).forEach(t => t.kind === 'jianzi' && n++)); return { s, n }; })
      .filter(x => x.n >= 20)
      .sort((a, b) => b.n - a.n);
    list.forEach(x => scoresById[x.s.id] = x.s);
    box.innerHTML = '';
    list.forEach(({ s, n }) => {
      const favs = favorites();
      const card = document.createElement('button');
      card.className = 'hall-card';
      card.innerHTML = `
        <span class="cover">${coverSVG(s)}</span>
        <span class="hc-title"></span>
        <span class="hc-meta">
          <span class="hc-author">${authorOf(s)}</span>
          <span class="hc-fav">♥ ${favCount(s) + (favs[s.id] ? 1 : 0)}</span>
        </span>`;
      card.querySelector('.hc-title').textContent = s.title.replace(/^《|》$/g, '');
      card.addEventListener('click', () => openHall(s));
      // 收藏角标
      if (favs[s.id]) { const b = document.createElement('span'); b.className = 'hc-faved'; b.textContent = '已收藏'; card.querySelector('.cover').appendChild(b); }
      box.appendChild(card);
    });
    $('#hallCount').textContent = `${list.length} 部作品`;
  }

  /* ---------- 大厅阅读视图 ---------- */
  function openHall(s) {
    hallScore = s;
    $('#hallTitle').textContent = s.title.replace(/^《|》$/g, '');
    $('#hallAuthor').textContent = authorOf(s);
    const favs = favorites();
    updateFavBtn(!!favs[s.id], favCount(s));
    $('#hallCover').innerHTML = coverSVG(s);
    $('#hallCover').style.display = '';
    buildHallStrip(s.score_content.score);
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'hallview'));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('show', p.id === 'page-hallview'));
    requestAnimationFrame(() => window.GuqinStage.resize && window.GuqinStage.resize());
  }

  /* 上音符 / 下减字 双行谱条 */
  function buildHallStrip(score) {
    const strip = $('#hallStrip');
    strip.innerHTML = '';
    hallTokens = [];
    (score.lines || []).forEach((line, li) => {
      if (li > 0) { const sep = document.createElement('div'); sep.className = 'sep'; strip.appendChild(sep); }
      const jt = (line.jianziTokens || []).filter(t => t.kind !== 'blank');
      const rt = (line.rhythmTokens || []).filter(t => t.kind !== 'blank');
      jt.forEach((tok, i) => {
        const cell = document.createElement('button');
        cell.className = 'hall-cell';
        const r = rt[i] || rt[rt.length - 1];
        const rEl = document.createElement('span');
        rEl.className = 'rhythm';
        rEl.textContent = r ? r.text : '♪';
        rEl.title = r ? (r.duration || '') : '';
        const jEl = document.createElement('span');
        jEl.className = 'jianzi';
        jEl.innerHTML = window.JianziRender.renderToken(tok, 46);
        cell.appendChild(rEl); cell.appendChild(jEl);
        cell.addEventListener('click', () => {
          window.GuqinAudio.ensureCtx();
          window.GuqinPlayer.tapToken(tok);
          const act = window.JianziSemantics.parseToken(tok);
          window.HallFire && window.HallFire(act);
          cell.classList.add('flash'); setTimeout(() => cell.classList.remove('flash'), 350);
        });
        strip.appendChild(cell);
        hallTokens.push(cell);
      });
    });
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
    const tempo = +($('#hallTempo').value) || null;
    const sc = tempo ? { lines: hallScore.score_content.score.lines.map(l => ({ ...l, sectionTempo: tempo })) } : hallScore.score_content.score;
    const wrap = $('#hallStripWrap');
    window.GuqinPlayer.play(sc, tempo, (i) => {
      hallTokens.forEach((t, k) => { t.classList.toggle('done', k < i); t.classList.toggle('playing', k === i); });
      const el = hallTokens[i];
      if (el) wrap.scrollTo({ left: el.offsetLeft - (wrap.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
    }, () => {
      hallTokens.forEach(t => t.classList.remove('playing'));
    });
  }
  function stop() { window.GuqinPlayer.stop(); hallTokens.forEach(t => t.classList.remove('playing')); }

  /* 编辑模式：载入编辑器 */
  function toEditor() {
    if (!hallScore) return;
    document.dispatchEvent(new CustomEvent('hall-edit', { detail: JSON.parse(JSON.stringify(hallScore.score_content.score)) }));
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'editor'));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('show', p.id === 'page-editor'));
  }

  window.Hall = { build, openHall, play, stop, toggleFav, toEditor, setCorpus: c => { corpus = c; }, _coverSVG: coverSVG, _authorOf: authorOf };
  window.HallFire = null; // 由 app 注入琴面联动
})();
