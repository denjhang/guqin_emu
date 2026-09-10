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

  /* 查音高表：(弦, 徽名) → 频率。查找顺序：
   * 1. 精确命中；2. 同弦相邻 x 坐标对数插值（分数徽如七徽七分，误差≈3音分）；
   * 3. 基徽降级；4. 七徽兜底（续弦音由调用方传真实徽位，此处仅极端兜底） */
  /* HUI_MARKS 顺序为一徽→十三徽（x 从岳山侧递减）：
   * 一92.11 二87.34 三83.51 四77.78 五68.23 六60.58 七49 八37.65 九30 十20.8
   * 十一14.72 十二10.7 十三6.13；分位向下一徽（n+1，x 更小）方向插值 */
  const HUI_X = { '一': 92.11, '二': 87.34, '三': 83.51, '四': 77.78, '五': 68.23, '六': 60.58, '七': 49,
                  '八': 37.65, '九': 30, '十': 20.8, '十一': 14.72, '十二': 10.7, '十三': 6.13 };
  function huiToX(hui) {
    if (!hui) return null;
    if (hui === '徽外') return 4.1;
    const m = hui.match(/^([一二三四五六七八九十]{1,2})徽([一二三四五六七八九]分|半)?$/);
    if (!m) return null;
    let n = 0; const cn = m[1];
    if (cn === '十') n = 10;
    else if (cn.length === 2 && cn[0] === '十') n = 11 + '一二三四五六七八九'.indexOf(cn[1]);  // 十一~十九
    else n = '一二三四五六七八九'.indexOf(cn) + 1;   // 徽号一基：一=1…九=9
    if (n < 1) return null;
    const base = HUI_X[['','一','二','三','四','五','六','七','八','九','十','十一','十二','十三'][n]];
    const next = HUI_X[['','一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四'][n + 1] || '十四'] || 0;
    let frac = 0;
    if (m[2] === '半') frac = 0.05;
    else if (m[2]) frac = ('一二三四五六七八九'.indexOf(m[2][0]) + 1) / 10;
    return base + (next - base) * frac;
  }
  function freqOf(string, hui, harmonic) {
    const table = harmonic ? pitch.harmonics : pitch.positions;
    const same = table.filter(p => p.s === string);
    let hit = same.find(p => p.hui === hui);
    if (!hit && !harmonic && hui) {
      const x = huiToX(hui);
      if (x !== null) {
        const lo = same.filter(p => p.x !== undefined && p.x <= x).sort((a, b) => b.x - a.x)[0];
        const hi = same.filter(p => p.x !== undefined && p.x > x).sort((a, b) => a.x - b.x)[0];
        if (lo && hi) {
          const u = (x - lo.x) / (hi.x - lo.x);
          const f = lo.f * Math.pow(hi.f / lo.f, u);   // 对数插值
          const openWeb = [65.406, 73.416, 87.307, 97.999, 110, 130.813, 146.832][string - 1];
          return f * (OPEN[string - 1] / openWeb);
        }
      }
    }
    if (!hit) {
      const base = hui && hui.match(/^([一二三四五六七八九十]+)/);
      if (base) hit = same.find(p => p.hui === base[1] + '徽');
    }
    if (!hit) hit = same.find(p => p.hui === '七徽');
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

  /* 刹音（伏/剌伏）：80ms 内收掉所有在响声部——对应右手捂弦止振 */
  function damp() {
    const c = ensureCtx();
    const t = c.currentTime;
    voices.forEach(v => {
      try {
        v.g.gain.cancelScheduledValues(t);
        v.g.gain.setValueAtTime(v.g.gain.value, t);
        v.g.gain.linearRampToValueAtTime(0, t + 0.08);
        v.s.stop(t + 0.1);
      } catch (e) { /* 已结束 */ }
    });
    voices.clear();
  }

  window.GuqinAudio = { init, play, preload, freqOf, ensureCtx, damp, OPEN };
})();
