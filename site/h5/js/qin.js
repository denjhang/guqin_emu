/* 琴面模拟器（复刻 APK 演奏页下半屏）：
 * 七弦 + 十三徽，演奏时左手按位动画（徽位按压点）+ 右手拨弦区闪光 + 弦振动衰减
 * 坐标系：徽位用弦长百分比（HUI_MARKS），分数徽位线性插值 */
(function () {
  'use strict';
  let cv, ctx2d, marks = [], presses = [], raf = 0;
  const PRESS_MS = 700, VIB_MS = 900;

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
    if (m[2]) { const frac = c2n(m[2]) / 10; pct += (marks[n] - marks[n - 1]) * frac; }
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

  /* 记录一次发声：{string, hui, open, harmonic} */
  function press(note) {
    if (!note || !note.string) return;
    presses.push({
      string: note.string,
      x: note.open ? null : huiToPercent(note.hui),
      open: !!note.open, harmonic: !!note.harmonic,
      t0: performance.now()
    });
    if (presses.length > 24) presses = presses.slice(-24);
  }

  function loop() {
    if (!ctx2d) return;
    draw();
    raf = requestAnimationFrame(loop);
  }

  function draw() {
    const { W, H, padL, padR, strings } = geometry();
    const g = ctx2d;
    const now = performance.now();
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
      g.arc(x, H * 0.09, i === 6 ? 7 * devicePixelRatio : 4.5 * devicePixelRatio, 0, 7);
      g.fillStyle = i === 6 ? '#e8d9a8' : '#c9b98d';
      g.fill();
    });
    // 弦 + 振动
    strings.forEach((s, i) => {
      const n = i + 1;
      const pr = presses.find(p => p.string === n && now - p.t0 < VIB_MS);
      let amp = 0;
      if (pr) amp = Math.sin((now - pr.t0) / VIB_MS * Math.PI) * 3.2 * devicePixelRatio;
      g.strokeStyle = pr ? '#e7c079' : '#d8cdb4';
      g.lineWidth = s.w * devicePixelRatio;
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
    // 按位 / 拨弦指示
    presses.forEach(p => {
      const age = now - p.t0;
      if (age > PRESS_MS) return;
      const alpha = 1 - age / PRESS_MS;
      const s = strings[p.string - 1];
      if (p.open) {
        // 右手拨弦区（一徽右侧）
        const x = padL + (padR - padL) * 0.97;
        g.beginPath();
        g.arc(x, s.y, (6 + age / PRESS_MS * 14) * devicePixelRatio, 0, 7);
        g.strokeStyle = `rgba(231,192,121,${alpha * 0.9})`;
        g.lineWidth = 2 * devicePixelRatio;
        g.stroke();
      } else {
        const x = padL + (padR - padL) * p.x / 100;
        // 按压点：朱砂圆点 + 收缩光环
        g.beginPath();
        g.arc(x, s.y, 7 * devicePixelRatio, 0, 7);
        g.fillStyle = `rgba(214,69,69,${alpha})`;
        g.fill();
        g.beginPath();
        g.arc(x, s.y, (10 + age / PRESS_MS * 16) * devicePixelRatio, 0, 7);
        g.strokeStyle = `rgba(230,120,120,${alpha * 0.6})`;
        g.lineWidth = 1.5 * devicePixelRatio;
        g.stroke();
        if (p.harmonic) {  // 泛音：青青光环
          g.beginPath();
          g.arc(x, s.y, 13 * devicePixelRatio, 0, 7);
          g.strokeStyle = `rgba(127,212,230,${alpha * 0.8})`;
          g.stroke();
        }
      }
    });
    presses = presses.filter(p => now - p.t0 < PRESS_MS);
  }

  window.GuqinStage = { init, press, resize };
})();
