/* 琴面模拟器（复刻 APK 演奏页下半屏）：
 * 七弦 + 十三徽，演奏时左手按位（蓝点）+ 右手拨弦（橙点）+ 弦振动衰减
 * 支持多点触控：和弦/扫弦时多个左右手圆点同时显示
 * 坐标系：徽位用弦长百分比（HUI_MARKS），分数徽位线性插值 */
(function () {
  'use strict';
  let cv, ctx2d, marks = [], presses = [], raf = 0;
  let showHuiLabels = false;
  const PRESS_MS = 800, VIB_MS = 900;
  const HUI_NAMES = ['一徽','二徽','三徽','四徽','五徽','六徽','七徽','八徽','九徽','十徽','十一徽','十二徽','十三徽'];

  function huiToPercent(hui) {
    if (!hui) return 49;                       // 七徽
    if (hui === '徽外') return marks[12] + (100 - marks[12]) * 0.4;
    const m = hui.match(/^([一二三四五六七八九十]+)徽(?:([一二三四五六七八九]+)分)?(半)?$/);
    if (!m) return 49;
    const c2n = s => '零一二三四五六七八九'.indexOf(s);
    let n = 0;
    const cn = m[1];
    if (cn === '十') n = 10;
    else if (cn.length === 2 && cn[0] === '十') n = 10 + c2n(cn[1]);
    else if (cn.length === 1) n = c2n(cn);
    if (!n || n < 1 || n > 13) return 49;
    let pct = marks[n - 1];
    if (m[2]) { const frac = (c2n(m[2]) + 1) / 10; pct += (marks[n] - marks[n - 1]) * frac; }
    if (m[3]) pct += (marks[n] - marks[n - 1]) * 0.05;
    return pct;
  }

  function init(canvas, pitch) {
    cv = canvas;
    ctx2d = cv.getContext('2d');
    marks = pitch.huiMarks;
    window.addEventListener('resize', resize);
    resize();
    loop();
  }
  function resize() {
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    cv.width = r.width * devicePixelRatio;
    cv.height = r.height * devicePixelRatio;
  }
  function geometry() {
    const W = cv.width, H = cv.height;
    const padL = W * 0.07, padR = W * 0.94;          // 岳山→琴尾的弦长区间
    const top = H * 0.22, gap = (H * 0.62) / 6;
    const strings = [];
    for (let i = 0; i < 7; i++) strings.push({ y: top + gap * i, w: 2.6 - i * 0.28 });
    return { W, H, padL, padR, strings };
  }

  /* 记录一次发声：{string, hui, open, harmonic}
   * 左手按位（非散音）+ 右手拨弦（总是）分开记录，可同时多点显示 */
  function playNote(note) {
    if (!note || !note.string) return;
    const t0 = performance.now();
    const huiName = note.hui || null;
    // 右手拨弦点（一徽右侧，岳山附近）
    presses.push({ hand: 'R', string: note.string, x: 97, open: !!note.open, harmonic: !!note.harmonic, t0 });
    // 左手按位点（非散音时）
    if (!note.open) {
      presses.push({ hand: 'L', string: note.string, x: huiToPercent(note.hui), harmonic: !!note.harmonic, t0, huiName });
    }
    if (presses.length > 40) presses = presses.slice(-40);
  }

  /* 播放一个 action（pluck/chord/sweep），展开所有弦
   * rhythm: 节奏 token，用于扫弦按组件时序显示圆点 */
  function playAction(action, rhythm) {
    if (!action) return;
    if (action.type === 'chord') {
      (action.positions || []).forEach(p => playNote(p));
    } else if (action.type === 'sweep') {
      const step = action.to >= action.from ? 1 : -1;
      const strings = [];
      for (let s = action.from; step > 0 ? s <= action.to : s >= action.to; s += step) strings.push(s);
      const n = strings.length;
      // 有节奏组件且数量匹配则按组件间隔；否则均分（与音频端一致）
      let gaps;
      if (rhythm && rhythm.rhythmComponents && rhythm.rhythmComponents.length === n) {
        const DUR = { whole: 4, half: 2, quarter: 1, eighth: 0.5, sixteenth: 0.25, thirtySecond: 0.125 };
        gaps = rhythm.rhythmComponents.map(c => DUR[c.duration] || 0);
      } else {
        gaps = new Array(n).fill(1 / n);
      }
      let delay = 0;
      strings.forEach((s, i) => {
        setTimeout(() => playNote({ string: s, hui: action.hui, open: action.open, harmonic: action.harmonic }), delay);
        delay += (gaps[i] || 0.25) * 200;  // 视觉用缩短的时序，保持流畅
      });
    } else if (action.type === 'pluck') {
      playNote(action);
    }
  }

  function setHuiLabels(show) { showHuiLabels = !!show; }
  function clear() { presses = []; }

  function loop() {
    if (!ctx2d) return;
    draw();
    raf = requestAnimationFrame(loop);
  }

  function draw() {
    const { W, H, padL, padR, strings } = geometry();
    const g = ctx2d;
    const now = performance.now();
    const dpr = devicePixelRatio;
    g.clearRect(0, 0, W, H);
    // 琴身
    g.fillStyle = '#241612';
    const skew = H * 0.06;
    g.beginPath();
    g.moveTo(W * 0.01, H * 0.16 + skew * 0.2);
    g.lineTo(W * 0.99, H * 0.08);
    g.lineTo(W * 0.99, H * 0.94 - skew * 0.2);
    g.lineTo(W * 0.01, H);
    g.closePath();
    g.fill();
    // 徽点
    marks.forEach((m, i) => {
      const x = padL + (padR - padL) * m / 100;
      g.beginPath();
      g.arc(x, H * 0.09, i === 6 ? 7 * dpr : 4.5 * dpr, 0, 7);
      g.fillStyle = i === 6 ? '#e8d9a8' : '#c9b98d';
      g.fill();
    });
    // 徽位名称（开关控制）
    if (showHuiLabels) {
      g.font = `${10 * dpr}px sans-serif`;
      g.fillStyle = 'rgba(201,185,141,0.7)';
      g.textAlign = 'center';
      marks.forEach((m, i) => {
        const x = padL + (padR - padL) * m / 100;
        g.fillText(HUI_NAMES[i] || '', x, H * 0.14);
      });
    }
    // 弦 + 振动
    strings.forEach((s, i) => {
      const n = i + 1;
      const pr = presses.find(p => p.string === n && now - p.t0 < VIB_MS);
      let amp = 0;
      if (pr) amp = Math.sin((now - pr.t0) / VIB_MS * Math.PI) * 3.2 * dpr;
      g.strokeStyle = pr ? '#e7c079' : '#d8cdb4';
      g.lineWidth = s.w * dpr;
      g.beginPath();
      const y = s.y;
      g.moveTo(padL, y);
      if (amp > 0.2) {
        for (let x = 0; x <= padR - padL; x += 8) {
          const ph = Math.sin(x / 30 + now / 28) * amp * (1 - x / (padR - padL)) * (x < 40 ? x / 40 : 1);
          g.lineTo(padL + x, y + ph);
        }
      } else g.lineTo(padR, y);
      g.stroke();
    });
    // 左右手圆点
    presses.forEach(p => {
      const age = now - p.t0;
      if (age > PRESS_MS) return;
      const alpha = 1 - age / PRESS_MS;
      const s = strings[p.string - 1];
      const x = padL + (padR - padL) * p.x / 100;
      if (p.hand === 'L') {
        // 左手：蓝色按位圆点
        g.beginPath();
        g.arc(x, s.y, 7 * dpr, 0, 7);
        g.fillStyle = `rgba(59,130,246,${alpha})`;
        g.fill();
        g.beginPath();
        g.arc(x, s.y, (10 + age / PRESS_MS * 14) * dpr, 0, 7);
        g.strokeStyle = `rgba(96,165,250,${alpha * 0.6})`;
        g.lineWidth = 1.5 * dpr;
        g.stroke();
        if (p.harmonic) {  // 泛音：青青光环
          g.beginPath();
          g.arc(x, s.y, 13 * dpr, 0, 7);
          g.strokeStyle = `rgba(127,212,230,${alpha * 0.8})`;
          g.lineWidth = 2 * dpr;
          g.stroke();
        }
        // 徽位名称标签（原版详细显示按音位置）
        if (p.huiName) {
          const labelY = s.y + 22 * dpr;
          g.font = `bold ${13 * dpr}px sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'top';
          const tw = g.measureText(p.huiName).width;
          g.fillStyle = `rgba(30,41,59,${alpha * 0.85})`;
          g.fillRect(x - tw / 2 - 4 * dpr, labelY - 2 * dpr, tw + 8 * dpr, 18 * dpr);
          g.fillStyle = `rgba(191,219,254,${alpha})`;
          g.fillText(p.huiName, x, labelY);
          g.textBaseline = 'alphabetic';
        }
      } else {
        // 右手：橙色拨弦点（扩散环）
        g.beginPath();
        g.arc(x, s.y, (5 + age / PRESS_MS * 12) * dpr, 0, 7);
        g.strokeStyle = `rgba(245,158,11,${alpha * 0.9})`;
        g.lineWidth = 2.5 * dpr;
        g.stroke();
        g.beginPath();
        g.arc(x, s.y, 3 * dpr, 0, 7);
        g.fillStyle = `rgba(251,191,36,${alpha})`;
        g.fill();
      }
    });
    presses = presses.filter(p => now - p.t0 < PRESS_MS);
  }

  window.GuqinStage = { init, press: playNote, playAction, setHuiLabels, clear, resize };
})();
