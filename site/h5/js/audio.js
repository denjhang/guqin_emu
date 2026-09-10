/* 音频引擎：21 条真实采样（每弦 散/按七徽/七徽泛音）+ 变调播放
 * 采样基准音高（README，三分损益十二律正调定弦）：
 *   open = [65.41, 73.59, 88.40, 98.12, 110.38, 130.82, 147.17]
 *   pressed/harmonic 采样录于七徽（弦长 1/2）→ 基准 = 散音 × 2
 * 播放 rate = 目标频率 / 采样基准频率 */
(function () {
  'use strict';
  let ctx = null, bank = {};
  let OPEN = [65.41, 73.59, 88.40, 98.12, 110.38, 130.82, 147.17];
  let pitch = null; // {positions:[{s,hui,f}], harmonics:[...]}

  function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function init(pitchData) { pitch = pitchData; }
  const key = (kind, s) => `audio/${kind}/string_${s}.wav`;

  async function loadSample(kind, s) {
    const k = key(kind, s);
    if (bank[k]) return bank[k];
    const c = ensureCtx();
    const resp = await fetch(k);
    const ab = await resp.arrayBuffer();
    const buf = await c.decodeAudioData(ab);
    bank[k] = buf;
    return buf;
  }
  function baseFreq(kind, s) {
    const open = OPEN[s - 1];
    return kind === 'open' ? open : open * 2;   // 按音/泛音采样录于七徽
  }

  /* 查音高表：按音/泛音 (弦, 徽名) → 频率（含三分损益修正） */
  function freqOf(string, hui, harmonic) {
    const table = harmonic ? pitch.harmonics : pitch.positions;
    const huiN = hui ? hui.replace(/[徽分]/g, '') : '';
    let hit = table.find(p => p.s === string && p.hui === hui);
    if (!hit) { // 模糊：八徽半/分数徽降级
      const base = hui && hui.match(/^([一二三四五六七八九十]+)/);
      if (base) hit = table.find(p => p.s === string && p.hui === base[1] + '徽');
    }
    if (!hit) {
      hit = table.find(p => p.s === string && p.hui === '七徽');
    }
    // 三分损益修正：网页表为 12-TET（C2 基），按弦比例平移到 sanfen 基准
    const openWeb = [65.406, 73.416, 87.307, 97.999, 110, 130.813, 146.832][string - 1];
    return hit.f * (OPEN[string - 1] / openWeb);
  }

  /* 播放一个音
   * opts: {gain, dur(秒), rate 额外倍率, glideTo(频率,滑向), vibrato, attack} */
  async function play(string, harmonic, open, targetFreq, opts = {}) {
    const c = ensureCtx();
    const kind = open ? 'open' : (harmonic ? 'harmonic' : 'pressed');
    const buf = await loadSample(kind, string);
    const src = c.createBufferSource();
    const g = c.createGain();
    src.buffer = buf;
    src.connect(g); g.connect(c.destination);
    const t = c.currentTime + 0.01;
    let rate = (targetFreq / baseFreq(kind, string)) * (opts.rate || 1);

    if (opts.attack) { // 绰/注：±大二度滑入
      const semi = opts.attack === '绰' ? -2 : 2;
      src.playbackRate.setValueAtTime(rate * Math.pow(2, semi / 12), t);
      src.playbackRate.exponentialRampToValueAtTime(rate, t + 0.5);
    } else if (opts.glideTo) { // 走手音滑向目标频率
      src.playbackRate.setValueAtTime(rate, t);
      src.playbackRate.linearRampToValueAtTime(opts.glideTo / baseFreq(kind, string), t + (opts.glideSec || 0.6));
    } else if (opts.vibrato) { // 吟/猱：轻微音高摆动
      src.playbackRate.value = rate;
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = opts.vibrato === '猱' ? 3.2 : 5.0;
      lg.gain.value = rate * (opts.vibrato === '猱' ? 0.028 : 0.014);
      lfo.connect(lg); lg.connect(src.playbackRate);
      lfo.start(t); lfo.stop(t + (opts.dur || 2));
    } else {
      src.playbackRate.value = rate;
    }
    const gain = opts.gain || 0.8;
    const dur = opts.dur || Math.min(buf.duration, 3.2);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.setValueAtTime(gain, t + Math.max(0.05, dur - 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t); src.stop(t + dur + 0.05);
    return { src, gain: g };
  }

  /* 预热：加载指定弦的采样 */
  function preload(strings) {
    strings = strings || [1, 2, 3, 4, 5, 6, 7];
    strings.forEach(s => { loadSample('open', s); loadSample('pressed', s); loadSample('harmonic', s); });
  }

  window.GuqinAudio = { init, play, preload, freqOf, ensureCtx, OPEN };
})();
