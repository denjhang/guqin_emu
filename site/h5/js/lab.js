/* 实验室：MusicXML 转减字谱
 * 左右分栏：左侧简谱/XML音符，右侧减字谱
 * 鼠标悬停高亮对应音符；内置曲谱列表单击选择 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const BUILTIN = ['酒狂', '梅花三弄', '秋风词', '阳关三叠', '良宵引', '关山月'];
  let convertedScore = null;
  let convertedNotes = null;
  let activeName = null;

  function init() {
    // 构建内置曲谱列表（带滚动条）
    const list = $('#labList');
    list.innerHTML = BUILTIN.map(n =>
      `<div class="lab-list-item" data-name="${n}"><span>${n}</span><span class="li-meta">.xml</span></div>`
    ).join('');
    list.addEventListener('click', e => {
      const item = e.target.closest('.lab-list-item');
      if (!item) return;
      const name = item.dataset.name;
      list.querySelectorAll('.lab-list-item').forEach(el => el.classList.toggle('active', el.dataset.name === name));
      activeName = name;
      loadBuiltin(name);
    });

    // 文件上传
    const fileInput = $('#labFile');
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => convertAndPreview(r.result, f.name.replace(/\.xml$/i, ''));
      r.readAsText(f);
    });

    // 拖拽
    const drop = $('#labDrop');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('over');
      const f = e.dataTransfer.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => convertAndPreview(r.result, f.name.replace(/\.xml$/i, ''));
      r.readAsText(f);
    });

    $('#labToEditorBtn').addEventListener('click', sendToEditor);
    $('#labToScoreBtn').addEventListener('click', sendToScore);
  }

  async function loadBuiltin(name) {
    try {
      const res = await fetch(`data/musicxml/${name}.xml`);
      if (!res.ok) { showStatus('未找到曲谱文件'); return; }
      const text = await res.text();
      convertAndPreview(text, name);
    } catch (e) { showStatus('加载失败: ' + e.message); }
  }

  function convertAndPreview(xmlText, name) {
    showStatus('转换中…');
    try {
      const result = window.GuqinXmlConverter.convert(xmlText);
      const title = result.title && result.title !== '未命名' ? result.title : name;
      convertedScore = { title, score_content: { score: result.score } };
      convertedNotes = result.notes || [];
      renderSplit(result.score, convertedNotes, title);
      showStatus(`转换完成：${title}，共 ${result.score.lines.length} 行，${convertedNotes.length} 个音符`);
    } catch (e) {
      showStatus('转换失败: ' + e.message);
      console.error(e);
    }
  }

  // 音名+八度 → 简谱唱名
  const SOLFEGE = { C: 'do', D: 're', E: 'mi', F: 'fa', G: 'sol', A: 'la', B: 'si' };
  const RHYTHM_SYMBOL = { whole: '𝅝', half: '𝅗𝅥', quarter: '♩', eighth: '♪', sixteenth: '𝅘𝅥𝅯', 'thirty-second': '𝅘𝅥𝅯' };

  function noteLabel(info) {
    const acc = info.alter > 0 ? '♯' : info.alter < 0 ? '♭' : '';
    const sol = SOLFEGE[info.step] || info.step;
    return `${sol}${acc}${info.octave}`;
  }

  function renderSplit(score, notes, title) {
    const left = $('#labLeft');
    const right = $('#labRight');
    left.innerHTML = '<h3>简谱 / XML 音符</h3>';
    right.innerHTML = '<h3>减字谱</h3>';

    let globalIdx = 0; // 全局音符索引，用于左右联动高亮

    score.lines.forEach((line, li) => {
      // 左侧：简谱音符行
      const lRow = document.createElement('div');
      lRow.className = 'score-line';
      lRow.style.minHeight = '50px';

      // 右侧：减字行
      const rRow = document.createElement('div');
      rRow.className = 'score-line';

      const rt = line.rhythmTokens || [];
      const ni = line.noteInfos || [];
      let lastR = null;

      (line.jianziTokens || []).forEach((tok, idx) => {
        if (tok.kind === 'blank') { return; }
        const r = (rt[idx] && rt[idx].kind !== 'blank') ? rt[idx] : lastR;
        if (rt[idx] && rt[idx].kind !== 'blank') lastR = rt[idx];
        const info = ni[idx];
        const myIdx = globalIdx++;

        // 左侧音符
        const lEl = document.createElement('span');
        lEl.className = 'lab-note';
        lEl.dataset.idx = myIdx;
        const sym = r ? (RHYTHM_SYMBOL[r.duration] || '♪') : '♪';
        lEl.innerHTML = `<span class="nn">${info ? noteLabel(info) : '·'}</span>` +
          `<span class="nt">${sym}</span>` +
          (info ? `<span class="nf">${info.step}${info.octave}</span>` : '');
        if (info) {
          lEl.title = `${info.step}${info.alter > 0 ? '♯' : info.alter < 0 ? '♭' : ''}${info.octave} (${info.freq.toFixed(1)}Hz) → ${tok.text}`;
        }
        lRow.appendChild(lEl);

        // 右侧减字
        const rEl = document.createElement('button');
        rEl.className = 'lab-jz';
        rEl.dataset.idx = myIdx;
        const beats = window.GuqinPlayer.rhythmToBeats(r);
        rEl.innerHTML = '<span class="jz-rhythm">' + (r ? r.text : '') + '</span>' +
          (beats ? '<span class="jz-beats">' + beats + '</span>' : '<span class="jz-beats"></span>') +
          '<span class="jz-glyph">' + window.JianziRender.renderToken(tok, 48) + '</span>';
        rEl.title = tok.text;
        rEl.addEventListener('click', () => {
          window.GuqinAudio.ensureCtx();
          window.GuqinPlayer.tapToken(tok, r, 60);
        });
        rRow.appendChild(rEl);
      });

      left.appendChild(lRow);
      right.appendChild(rRow);
    });

    // 绑定鼠标悬停联动高亮
    bindHoverHighlight(left, right);
    $('#labActions').style.display = 'flex';
  }

  function bindHoverHighlight(left, right) {
    function highlight(idx, on) {
      left.querySelectorAll(`.lab-note[data-idx="${idx}"]`).forEach(el => el.classList.toggle('hl', on));
      right.querySelectorAll(`.lab-jz[data-idx="${idx}"]`).forEach(el => el.classList.toggle('hl', on));
    }
    left.addEventListener('mouseover', e => {
      const el = e.target.closest('.lab-note[data-idx]');
      if (el) highlight(+el.dataset.idx, true);
    });
    left.addEventListener('mouseout', e => {
      const el = e.target.closest('.lab-note[data-idx]');
      if (el) highlight(+el.dataset.idx, false);
    });
    right.addEventListener('mouseover', e => {
      const el = e.target.closest('.lab-jz[data-idx]');
      if (el) highlight(+el.dataset.idx, true);
    });
    right.addEventListener('mouseout', e => {
      const el = e.target.closest('.lab-jz[data-idx]');
      if (el) highlight(+el.dataset.idx, false);
    });
  }

  function sendToEditor() {
    if (!convertedScore) return;
    document.dispatchEvent(new CustomEvent('hall-edit', { detail: JSON.parse(JSON.stringify(convertedScore.score_content.score)) }));
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'editor'));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('show', p.id === 'page-editor'));
  }

  function sendToScore() {
    if (!convertedScore) return;
    const scoreData = {
      id: 'lab-' + Date.now(),
      title: convertedScore.title,
      score_content: convertedScore.score_content,
      entity_type: 'post',
      created_at: new Date().toISOString()
    };
    if (typeof window.openScore === 'function') {
      window.openScore(scoreData);
    } else {
      document.dispatchEvent(new CustomEvent('lab-open-score', { detail: scoreData }));
    }
  }

  function showStatus(msg) {
    const el = $('#labStatus'); if (el) el.textContent = msg;
  }

  window.GuqinLab = { init };
})();
