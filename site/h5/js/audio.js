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

  /* 播放一个音。时长语义对照网页版 part-07 pluck()：
   * - 有效发声长度 effectiveHold = max(音长, SUSTAIN_MIN=0.9s)，封顶采样自然长度
   * - 长音：采样经 rate 变调后若不够长，用粒子余音合成延长（GuqinSustain）
   * - 同 key 重触：30ms 掐断旧振动（voices 表）
   * - 散音整体增益 ×0.7（OPEN_GAIN_FACTOR）
   * opts: {gain, dur, glideTo, vibrato, attack} */
  const voices = new Map();   // 同 key 重触掐断（对照源码 voices.get(key)）
  async function play(string, harmonic, open, targetFreq, opts = {}) {
    const c = ensureCtx();
    const kind = open ? 'open' : (harmonic ? 'harmonic' : 'pressed');
    const buf = await loadSample(kind, string);
    const key = kind + ':' + string;
    const t = c.currentTime + 0.01;
    let rate = (targetFreq / baseFreq(kind, string)) * (opts.rate || 1);
    const gain = (opts.gain || 0.85) * (open ? 0.7 : 1);

    // 同 key 重触：掐断旧音
    const prev = voices.get(key);
    if (prev) {
      try {
        prev.g.gain.cancelScheduledValues(t);
        prev.g.gain.setValueAtTime(prev.g.gain.value, t);
        prev.g.gain.linearRampToValueAtTime(0, t + 0.03);
        prev.s.stop(t + 0.05);
      } catch (e) { /* 已结束 */ }
    }

    // 时长：音长(秒,播放时间域)。采样可用(原速域)=buf.duration；播放域=buf.duration/rate
    const noteDur = opts.dur || 1.2;
    const SUSTAIN_MIN = 0.9;
    const effective = Math.min(Math.max(noteDur, SUSTAIN_MIN), 6.0);
    const availPlay = buf.duration / rate;             // 变调后实际可响时长
    let useBuf = buf;
    if (effective > availPlay * 0.98 && window.GuqinSustain) {
      // 采样不够长：粒子余音合成（原速域烘 effective*rate 秒）
      const ext = window.GuqinSustain.sustained(c, key, buf, effective * rate);
      if (ext) useBuf = ext;
    }
    const playDur = Math.min(effective, useBuf.duration / rate);
    const tail = 0.38;                                 // HOLD_RELEASE：松手收尾

    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = useBuf;
    src.connect(g); g.connect(c.destination);
    voices.set(key, { s: src, g });

    if (opts.attack) { // 绰/注：线性滑入（SoLoud fadeRelativePlaySpeed 语义）
      const semi = opts.attack === '绰' ? -2 : 2;
      const glide = Math.min(0.38, Math.max(0.22, noteDur * 0.35));
      src.playbackRate.setValueAtTime(rate * Math.pow(2, semi / 12), t);
      src.playbackRate.linearRampToValueAtTime(rate, t + glide);
    } else if (opts.glideTo) {
      src.playbackRate.setValueAtTime(Math.max(0.05, rate), t);
      src.playbackRate.linearRampToValueAtTime(Math.max(0.05, opts.glideTo / baseFreq(kind, string)), t + (opts.glideSec || 0.6));
    } else if (opts.vibrato) {
      src.playbackRate.value = rate;
      const isNao = opts.vibrato === '猱';
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.type = 'triangle';
      lfo.frequency.value = isNao ? 2.4 : 4.3;
      lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + 0.22);
      lg.gain.linearRampToValueAtTime(rate * (isNao ? 0.055 : 0.032), t + 0.55);
      lfo.connect(lg); lg.connect(src.playbackRate);
      lfo.start(t); lfo.stop(t + playDur + tail);
    } else {
      src.playbackRate.value = rate;
    }
    // 包络：12ms 起音 → 保持 → 尾部自然收（采样自然结束或 noteDur 后 0.38s 收）
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.setValueAtTime(gain, t + Math.max(0.05, playDur - tail * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + playDur + tail * 0.5);
    src.start(t); src.stop(t + playDur + tail * 0.5 + 0.05);
    src.onended = () => { if (voices.get(key) && voices.get(key).s === src) voices.delete(key); };
    return { src, gain: g };
  }

  /* 预热：加载指定弦的采样 */
  function preload(strings) {
    strings = strings || [1, 2, 3, 4, 5, 6, 7];
    strings.forEach(s => { loadSample('open', s); loadSample('pressed', s); loadSample('harmonic', s); });
  }

  window.GuqinAudio = { init, play, preload, freqOf, ensureCtx, OPEN };
})();
