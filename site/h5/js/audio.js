/* 音频引擎：双音源整套切换
 * APK 音源：每弦 散/按七徽/七徽泛音 各 1 条（共 21 条），变调播放
 * 教授音源：王悠荻真实录音——散音 7、按音 105（按徽位）、泛音 49（按徽位）
 * 播放 rate = 目标频率 / 采样基准频率 */
(function () {
  'use strict';
  let ctx = null, bank = {};
  let OPEN = [65.41, 73.59, 88.40, 98.12, 110.38, 130.82, 147.17];
  let pitch = null;
  let soundSource = 'apk';   // 'apk' | 'prof'

  function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function init(pitchData) { pitch = pitchData; }
  function setSource(src) {
    soundSource = (src === 'prof') ? 'prof' : 'apk';
    try { localStorage.setItem('guqin_source', soundSource); } catch (e) {}
  }
  function getSource() { return soundSource; }
  // 徽位名 → 教授按音采样后缀：十徽→h10, 四徽六分→h4-6, 徽外→hout
  function huiToProfSuffix(hui) {
    if (!hui) return 'h7';
    if (hui === '徽外') return 'hout';
    const m = hui.match(/^([一二三四五六七八九十]+)徽([一二三四五六七八九]分|半)?$/);
    if (!m) return 'h7';
    const n = huiOrderNum(hui);
    if (n == null) return 'h7';
    if (!m[2]) return 'h' + n;
    const fenMap = { '一分': 1, '二分': 2, '三分': 3, '四分': 4, '五分': 5, '六分': 6, '七分': 7, '八分': 8, '九分': 9, '半': 10 };
    const f = fenMap[m[2]];
    return f ? 'h' + n + '-' + f : 'h' + n;
  }
  // 采样 key：apk 全用 string_N.wav；prof 散=prof_sN.m4a, 按=sN-hui.mp3, 泛=hHui_sN.mp3
  function key(kind, s, huiIdx, hui) {
    if (soundSource === 'prof') {
      if (kind === 'open') return `audio/open/prof_s${s}.m4a`;
      if (kind === 'pressed') return `audio/prof-pressed/s${s}-${huiToProfSuffix(hui)}.mp3`;
      return `audio/harmonic/h${huiIdx}_s${s}.mp3`;   // 教授泛音
    }
    return `audio/${kind}/string_${s}.wav`;   // APK 散/按/泛 全七徽
  }
  // 徽位 → 泛音采样序号 1-7（对称徽位共用：8↔6, 9↔5, 10↔4, 11↔3, 12↔2, 13↔1）
  function harmIndex(hui) {
    const n = huiOrderNum(hui);
    if (n == null) return 7;
    if (n >= 1 && n <= 7) return n;
    if (n >= 8 && n <= 13) return 14 - n;
    return 7;
  }
  const HARM_ORDER = { 1: 8, 2: 6, 3: 5, 4: 4, 5: 3, 6: 5, 7: 2 };

  async function loadSample(kind, s, huiIdx, hui) {
    const k = key(kind, s, huiIdx, hui);
    if (bank[k]) return bank[k];
    const c = ensureCtx();
    let uri = k;
    if (k === 'audio/harmonic/h1_s3.mp3') uri = 'audio/harmonic/h1_s3.wav';
    try {
      const resp = await fetch(uri);
      if (!resp.ok) throw new Error('not found');
      const ab = await resp.arrayBuffer();
      const buf = await c.decodeAudioData(ab);
      bank[k] = buf;
      return buf;
    } catch (e) {
      // 教授按音精确徽位采样不存在 → 回退整徽 → 七徽
      if (soundSource === 'prof' && kind === 'pressed') {
        const hn = huiOrderNum(hui) || 7;
        const candidates = [`audio/prof-pressed/s${s}-h${hn}.mp3`, `audio/prof-pressed/s${s}-h7.mp3`];
        for (const cand of candidates) {
          if (cand === k) continue;
          if (bank[cand]) { bank[k] = bank[cand]; return bank[cand]; }
          try {
            const r = await fetch(cand);
            if (r.ok) {
              const b = await c.decodeAudioData(await r.arrayBuffer());
              bank[cand] = b; bank[k] = b; return b;
            }
          } catch (_) {}
        }
      }
      throw e;
    }
  }
  function baseFreq(kind, s, huiIdx, hui) {
    const open = OPEN[s - 1];
    if (kind === 'open') return open;
    if (kind === 'harmonic') return open * (HARM_ORDER[huiIdx] || 2);
    if (soundSource === 'prof') return freqOf(s, hui, false);   // 教授按音录于实际徽位
    return open * 2;   // APK 按音录于七徽
  }

  /* 查音高：(弦, 徽名) → 频率
   * 按音：f = 散音 / 徽位比例（徽位比例 = 从岳山到按音点的弦长比例）
   * 泛音：f = 散音 × 谐波次数（按徽位查 harmonicOrder）
   * 徽位比例表来自 APK HuiPitchTable.ratio（15 项精确分数） */
  const HUI_RATIO = {
    '一徽': 0.125,     '二徽': 0.1667,   '三徽': 0.2,      '四徽': 0.25,
    '五徽': 0.3333,   '六徽': 0.4,      '七徽': 0.5,      '八徽': 0.6,
    '九徽': 0.6667,   '十徽': 0.75,     '十一徽': 0.8,    '十二徽': 0.8333,
    '十三徽': 0.8889, '十三徽二分': 0.9, '十三徽半': 0.9167
  };
  // 徽位 → 泛音谐波次数（APK harmonicOrder，对称徽位谐波数相同）
  const HUI_HARMONIC = {
    1: 8, 2: 6, 3: 5, 4: 4, 5: 3, 6: 5, 7: 2, 8: 5, 9: 3, 10: 4, 11: 5, 12: 6, 13: 8
  };
  function huiToRatio(hui) {
    if (!hui) return null;
    if (hui === '徽外') return 0.891;
    if (HUI_RATIO[hui]) return HUI_RATIO[hui];
    // 解析「X徽Y分」「X徽半」：徽内位置 = 徽位比例 + 分内偏移
    // APK _parseHuiDigits：一=2分位(0.1), 二=4分位(0.2), ..., 半=10分位(0.5), 十=20分位(1.0)
    // 即每徽 20 等分，每分 = 1/20 徽间距
    const m = hui.match(/^([一二三四五六七八九十]+)徽([一二三四五六七八九]分|半)?$/);
    if (!m) return null;
    const baseKey = m[1] + '徽';
    const base = HUI_RATIO[baseKey];
    if (base == null) return null;
    if (!m[2]) return base;
    // 找下一个徽（n+1）的比例
    const order = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三'];
    const idx = order.indexOf(m[1]);
    if (idx < 0) return base;
    const nextKey = (order[idx + 1] || '十三外') + '徽';
    const next = HUI_RATIO[nextKey] || (idx === order.length - 1 ? 0.9167 : base + 0.05);
    let frac = 0;
    if (m[2] === '半') frac = 0.5;
    else { frac = ('一二三四五六七八九'.indexOf(m[2][0]) + 1) / 10; }  // 一分=0.1 徽内
    return base + (next - base) * frac;
  }
  function huiOrderNum(hui) {
    const m = hui && hui.match(/^([一二三四五六七八九十]+)徽/);
    if (!m) return null;
    const order = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三'];
    const idx = order.indexOf(m[1]);
    return idx >= 0 ? idx + 1 : null;
  }
  function freqOf(string, hui, harmonic) {
    const open = OPEN[string - 1];
    if (harmonic) {
      // 泛音：f = 散音 × 谐波次数（按徽位查表，7徽=2倍八度，4/10徽=4倍，1/13徽=8倍等）
      if (hui === '徽外') return open * 1.5;  // 徽外无泛音点，用 3:2 近似
      const n = huiOrderNum(hui);
      if (n && HUI_HARMONIC[n]) return open * HUI_HARMONIC[n];
      // 未知徽位：查旧 pitch.harmonics 表兜底
      const same = pitch.harmonics.filter(p => p.s === string);
      const hit = same.find(p => p.hui === n) || same.find(p => p.hui === 7);
      return hit ? hit.f * (open / 65.406) : open * 2;
    }
    // 按音：f = 散音 / 徽位比例
    // 徽位比例 = 从岳山到按音点的弦长比例（九徽=2/3 → 散音×1.5 纯五度）
    // 验证：pitch.json 弦6九徽=196.00Hz, 130.82/(2/3)=196.22 ✓
    const ratio = huiToRatio(hui);
    if (ratio != null) return open / Math.max(0.0001, ratio);
    // 兜底：七徽
    return open / 0.5;
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
    const huiIdx = harmonic ? harmIndex(opts.hui) : null;
    const hui = opts.hui;
    const buf = await loadSample(kind, string, huiIdx, hui);
    const vkey = kind + ':' + string + (harmonic ? ':' + huiIdx : (kind === 'pressed' ? ':' + (hui || 'x') : ''));
    const t = c.currentTime + 0.01;
    // 教授音源：每条采样录于对应徽位，自然音高即正确，rate=1（参考站 SM.tuning 默认 1）
    // APK 音源：散/按/泛 全录于七徽，需按目标频率变调
    let rate = soundSource === 'prof' ? 1 : (targetFreq / baseFreq(kind, string, huiIdx, hui));
    rate *= (opts.rate || 1);
    const gain = (opts.gain || 0.85) * (open ? 0.7 : 1);

    // 同 key 重触：掐断旧音
    const prev = voices.get(vkey);
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
      const ext = window.GuqinSustain.sustained(c, vkey, buf, effective * rate);
      if (ext) useBuf = ext;
    }
    const playDur = Math.min(effective, useBuf.duration / rate);
    const tail = 0.38;                                 // HOLD_RELEASE：松手收尾

    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = useBuf;
    src.connect(g); g.connect(c.destination);
    voices.set(vkey, { s: src, g });

    if (opts.attack) { // 绰/注：线性滑入（SoLoud fadeRelativePlaySpeed 语义）
      const semi = opts.attack === '绰' ? -2 : 2;
      const glide = Math.min(0.38, Math.max(0.22, noteDur * 0.35));
      src.playbackRate.setValueAtTime(rate * Math.pow(2, semi / 12), t);
      src.playbackRate.linearRampToValueAtTime(rate, t + glide);
    } else if (opts.glideTo) {
      const baseRate = soundSource === 'prof' ? 1 : baseFreq(kind, string, huiIdx, hui);
      src.playbackRate.setValueAtTime(Math.max(0.05, rate), t);
      src.playbackRate.linearRampToValueAtTime(Math.max(0.05, opts.glideTo / baseRate), t + (opts.glideSec || 0.6));
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
    src.onended = () => { if (voices.get(vkey) && voices.get(vkey).s === src) voices.delete(vkey); };
    return { src, gain: g };
  }

  /* 预热：加载指定弦的采样 */
  function preload(strings) {
    strings = strings || [1, 2, 3, 4, 5, 6, 7];
    strings.forEach(s => {
      loadSample('open', s);
      loadSample('pressed', s, null, '七徽');
      loadSample('harmonic', s, 7);
    });
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

  // 从 localStorage 恢复音源选择
  try {
    const saved = localStorage.getItem('guqin_source');
    if (saved === 'prof' || saved === 'apk') soundSource = saved;
  } catch (e) {}

  window.GuqinAudio = { init, play, preload, freqOf, ensureCtx, damp, OPEN, setSource, getSource };
})();
