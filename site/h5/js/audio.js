/* 音频引擎：双音源整套切换
 * APK 音源：每弦 散/按七徽/七徽泛音 各 1 条（共 21 条），变调播放
 * 教授音源：王悠荻真实录音——散音 7、按音 105（按徽位）、泛音 49（按徽位）
 * 播放 rate = 目标频率 / 采样基准频率 */
(function () {
  'use strict';
  let ctx = null, bank = {};
  let OPEN = [65.41, 73.59, 88.40, 98.12, 110.38, 130.82, 147.17];
  let pitch = null;
  let HARM_FREQ = null;   // "弦-徽序号" → {freq} 网页端权威泛音表
  let soundSource = 'apk';   // 'apk' | 'prof'
  // 混响节点
  let masterGain = null, reverbNode = null, wetGain = null, wetFilter = null, dryGain = null, reverbOn = false;

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      initReverb();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 轻量化混响：ConvolverNode + 合成脉冲响应（无需外部 IR 文件）
  // IR 结构：直达前 12ms 静音 + 早反射簇（模拟房间墙面离散回波）+ 低通衰减噪声尾巴
  // 纯均匀噪声尾巴能量摊在全频段，卷积后极稀，人耳几乎察觉不到——必须加早反射
  function initReverb() {
    if (!ctx || masterGain) return;
    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    dryGain = ctx.createGain();
    dryGain.gain.value = 1.0;
    wetGain = ctx.createGain();
    wetGain.gain.value = 0;
    reverbNode = ctx.createConvolver();
    reverbNode.buffer = makeImpulseResponse(ctx, 2.8, 2.2);
    // 湿声低通：混响尾音应比干声「闷」一点，营造空间距离感
    wetFilter = ctx.createBiquadFilter();
    wetFilter.type = 'lowpass';
    wetFilter.frequency.value = 3200;
    // 信号流：音符 → dry → master → destination
    //        音符 → reverb → wetFilter → wet → master
    dryGain.connect(masterGain);
    reverbNode.connect(wetFilter);
    wetFilter.connect(wetGain);
    wetGain.connect(masterGain);
    masterGain.connect(ctx.destination);
  }
  // 合成脉冲响应：早反射簇（前 80ms 离散回波，房间感的主要来源）+ 噪声尾巴
  function makeImpulseResponse(c, dur, decay) {
    const rate = c.sampleRate;
    const len = Math.floor(rate * dur);
    const buf = c.createBuffer(2, len, rate);
    // 早反射：左右声道错开的回波位置（ms）与增益
    const early = [
      [11, 0.42], [19, 0.35], [29, 0.30], [41, 0.24], [57, 0.20], [73, 0.16],
    ];
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      // 噪声尾巴：指数衰减，高频随时间衰减更快（一阶低通模拟空气吸声）
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const white = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * 0.55;
        lp += (white - lp) * (0.28 - 0.16 * t);   // 截止频率随时间下移
        data[i] = lp;
      }
      // 早反射叠加（第二声道时间偏移 ±3ms 去相关，加宽立体声）
      const off = ch === 0 ? -3 : 3;
      early.forEach(([ms, amp]) => {
        const idx = Math.floor((ms + off) / 1000 * rate);
        if (idx >= 0 && idx < len) data[idx] += amp;
      });
    }
    return buf;
  }
  function setReverb(on) {
    reverbOn = !!on;
    if (!wetGain) { ensureCtx(); }
    if (wetGain) wetGain.gain.value = reverbOn ? 0.9 : 0;
  }
  function isReverbOn() { return reverbOn; }
  function init(pitchData, harmData) {
    pitch = pitchData;
    // 网页端权威泛音表：D.HARMONICS 91 条（王悠荻实际琴面泛音频率）
    if (harmData) HARM_FREQ = harmData;
  }
  function setSource(src) {
    soundSource = (src === 'prof') ? 'prof' : 'apk';
    try { localStorage.setItem('guqin_source', soundSource); } catch (e) {}
  }
  function getSource() { return soundSource; }
  // 教授按音可用采样表（按弦分组，每项 {suffix, huiNum}）
  const PROF_PRESSED = {
    1: [['hout',13.5],['h10',10],['h10-8',10.8],['h9',9],['h7',7],['h7-9',7.9],['h7-3',7.3],['h6-4',6.4],['h5',5],['h5-9',5.9],['h5-6',5.6],['h4',4],['h4-6',4.6],['h4-2',4.2],['h3-6',3.6]],
    2: [['hout',13.5],['h12',12],['h10',10],['h9',9],['h7',7],['h7-9',7.9],['h7-6',7.6],['h6-4',6.4],['h6-2',6.2],['h5',5],['h5-6',5.6],['h4',4],['h4-6',4.6],['h4-4',4.4],['h3-6',3.6]],
    3: [['hout',13.5],['h10-8',10.8],['h9',9],['h9-5',9.5],['h7',7],['h7-9',7.9],['h7-3',7.3],['h6-4',6.4],['h5',5],['h5-9',5.9],['h5-3',5.3],['h4',4],['h4-6',4.6],['h4-2',4.2],['h3-6',3.6]],
    4: [['hout',13.5],['h10',10],['h10-8',10.8],['h9',9],['h7',7],['h7-9',7.9],['h7-6',7.6],['h6-4',6.4],['h5',5],['h5-9',5.9],['h5-6',5.6],['h4',4],['h4-6',4.6],['h4-4',4.4],['h3-6',3.6]],
    5: [['hout',13.5],['h12',12],['h10',10],['h9',9],['h8-5',8.5],['h7',7],['h7-6',7.6],['h6-4',6.4],['h6-2',6.2],['h5',5],['h5-6',5.6],['h4',4],['h4-8',4.8],['h4-4',4.4],['h3-6',3.6]],
    6: [['hout',13.5],['h10',10],['h10-8',10.8],['h9',9],['h7',7],['h7-9',7.9],['h7-3',7.3],['h6-4',6.4],['h5',5],['h5-9',5.9],['h5-6',5.6],['h4',4],['h4-6',4.6],['h4-2',4.2],['h3-6',3.6]],
    7: [['hout',13.5],['h12',12],['h10',10],['h9',9],['h7',7],['h7-9',7.9],['h7-6',7.6],['h6-4',6.4],['h6-2',6.2],['h5',5],['h5-6',5.6],['h4',4],['h4-6',4.6],['h4-4',4.4],['h3-6',3.6]]
  };
  // 徽位名 → 数值（用于距离匹配）
  function huiToNum(hui) {
    if (!hui) return 7;
    if (hui === '徽外') return 13.5;
    const m = hui.match(/^([一二三四五六七八九十]+)徽([一二三四五六七八九]分|半)?$/);
    if (!m) return 7;
    const n = huiOrderNum(hui);
    if (n == null) return 7;
    if (!m[2]) return n;
    const fenMap = { '一分':1,'二分':2,'三分':3,'四分':4,'五分':5,'六分':6,'七分':7,'八分':8,'九分':9,'半':10 };
    return n + (fenMap[m[2]] || 0) / 10;
  }
  // 找该弦最接近目标徽位的可用采样
  function nearestProfPressed(s, hui) {
    const list = PROF_PRESSED[s]; if (!list) return 'h7';
    const target = huiToNum(hui);
    let best = list[0][0], bestDist = Infinity;
    list.forEach(([suf, hn]) => { const d = Math.abs(hn - target); if (d < bestDist) { bestDist = d; best = suf; } });
    return best;
  }
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
  // 采样 key：教授音源指向 ../guqin/audio 完整采样库（王悠荻真实录音）
  // prof: 散=open/sN.m4a, 按=pressed/sN-hui.mp3, 泛=harm/hHui-sN.mp3
  // apk: 每类各 string_N.wav（已从 APK 重新解包恢复）
  function key(kind, s, huiIdx, hui) {
    if (soundSource === 'prof') {
      if (kind === 'open') return `../guqin/audio/open/s${s}.m4a`;
      if (kind === 'pressed') return `../guqin/audio/pressed/s${s}-${huiToProfSuffix(hui)}.mp3`;
      if (huiIdx === 1 && s === 3) return `../guqin/audio/harm/h1-s3-v204.wav`;
      return `../guqin/audio/harm/h${huiIdx}-s${s}.mp3`;   // 教授泛音
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

  const sampleFreq = {}; // cache key → 采样实际基准频率（教授按音回退时用）
  async function loadSample(kind, s, huiIdx, hui) {
    const k = key(kind, s, huiIdx, hui);
    if (bank[k]) return bank[k];
    const c = ensureCtx();
    // 教授按音：精确徽位采样不存在时，用最近可用采样
    if (soundSource === 'prof' && kind === 'pressed') {
      const suf = nearestProfPressed(s, hui);
      const uri = `../guqin/audio/pressed/s${s}-${suf}.mp3`;
      try {
        const r = await fetch(uri);
        if (r.ok) {
          const buf = await c.decodeAudioData(await r.arrayBuffer());
          bank[k] = buf;
          // 记录采样实际频率，供 rate 计算
          const sufNum = suf === 'hout' ? 13.5 : parseFloat(suf.replace('h','').replace('-','.'));
          sampleFreq[k] = freqOf(s, numToHui(sufNum), false);
          return buf;
        }
      } catch (_) {}
      // 兜底七徽
      const fb = `../guqin/audio/pressed/s${s}-h7.mp3`;
      try {
        const r = await fetch(fb);
        if (r.ok) {
          const buf = await c.decodeAudioData(await r.arrayBuffer());
          bank[k] = buf;
          sampleFreq[k] = freqOf(s, '七徽', false);
          return buf;
        }
      } catch (_) {}
      throw new Error('prof pressed sample not found: ' + k);
    }
    // 教授泛音：采样存在则直接用（录于实际徽位，音高天然正确）
    if (soundSource === 'prof' && kind === 'harmonic') {
      try {
        const resp = await fetch(k);
        if (resp.ok) {
          const ab = await resp.arrayBuffer();
          const buf = await c.decodeAudioData(ab);
          bank[k] = buf;
          return buf;
        }
      } catch (_) {}
      // 对称徽位共用（8↔1? 不，APK 泛音 8↔6 等）：用 harmIndex 已归一，此处回退散音变调
      const openUri = `../guqin/audio/open/s${s}.m4a`;
      try {
        const r = await fetch(openUri);
        if (r.ok) {
          const buf = await c.decodeAudioData(await r.arrayBuffer());
          bank[k] = buf;
          sampleFreq[k] = OPEN[s - 1];
          return buf;
        }
      } catch (_) {}
      throw new Error('prof harmonic sample not found: ' + k);
    }
    let uri = k;
    try {
      const resp = await fetch(uri);
      if (!resp.ok) throw new Error('not found');
      const ab = await resp.arrayBuffer();
      const buf = await c.decodeAudioData(ab);
      bank[k] = buf;
      return buf;
    } catch (e) {
      throw e;
    }
  }
  // 数值徽位 → 徽名（仅用于频率查询）
  function numToHui(n) {
    if (n >= 13) return '徽外';
    const order = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三'];
    const whole = Math.floor(n);
    const frac = n - whole;
    const name = order[whole - 1] + '徽';
    if (frac > 0.01) {
      const fenMap = ['一分','二分','三分','四分','五分','六分','七分','八分','九分'];
      const fi = Math.round(frac * 10) - 1;
      if (fi >= 0 && fi < 9) return name + fenMap[fi];
      if (frac > 0.45 && frac < 0.55) return name + '半';
    }
    return name;
  }
  function baseFreq(kind, s, huiIdx, hui) {
    const open = OPEN[s - 1];
    if (kind === 'open') return open;
    if (kind === 'harmonic') {
      // APK 泛音采样录于七徽（每弦 1 条），基准 = 七徽泛音频率，按目标徽位变调
      if (soundSource === 'apk') return freqOf(s, '七徽', true);
      return freqOf(s, hui, true);   // 教授泛音录于实际徽位（仅滑音用）
    }
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
      // 泛音：优先查网页端权威表 D.HARMONICS（王悠荻实际琴面 91 个泛音点频率）
      if (hui === '徽外') return open * 1.5;  // 徽外无泛音点，用 3:2 近似
      const n = huiOrderNum(hui);
      if (HARM_FREQ && n) {
        const hit = HARM_FREQ[string + '-' + n];
        if (hit && hit.freq) return hit.freq;
      }
      // 旧公式兜底（表未加载时）：f = 散音 × 谐波次数
      if (n && HUI_HARMONIC[n]) return open * HUI_HARMONIC[n];
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
    const k = key(kind, string, huiIdx, hui);
    // APK 按音全用同一采样(string_N.wav)，vkey 不含 hui → 同弦按音互掐
    // 教授按音每徽位独立采样，vkey 含 hui → 不同徽位可共存
    const vkey = kind + ':' + string + (harmonic ? ':' + huiIdx : (kind === 'pressed' && soundSource === 'prof' ? ':' + (hui || 'x') : ''));
    const t = c.currentTime + 0.01;
    // 教授音源：精确徽位采样自然音高正确(rate=1)；回退到散音采样时按目标频率变调
    // APK 音源：散/按/泛 全录于七徽，需按目标频率变调
    let rate;
    if (soundSource === 'prof') {
      if (sampleFreq[k]) {
        rate = targetFreq / sampleFreq[k];
      } else {
        rate = 1;
      }
    } else {
      rate = targetFreq / baseFreq(kind, string, huiIdx, hui);
    }
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
    // APK 泛音音色整形：APK 泛音采样实为变调播放，携带大量非谐波噪声与过亮高频。
    // 真实古琴泛音近纯正弦（笛质感）：只保留基频与前几阶泛音，滤除其余。
    // 教授版为真实泛音采样，不做任何处理。
    if (soundSource === 'apk' && kind === 'harmonic') {
      const f0 = Math.max(80, targetFreq || OPEN[string - 1] * 2);
      const hp = c.createBiquadFilter(), lp = c.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = f0 * 0.55; hp.Q.value = 0.7;   // 去基频以下噪声
      lp.type = 'lowpass';  lp.frequency.value = f0 * 4.5;  lp.Q.value = 0.5;   // 保留前 4 阶泛音，去毛刺
      src.connect(hp); hp.connect(lp); lp.connect(g);
    } else {
      src.connect(g);
    }
    // 经过混响链路：dry + wet
    g.connect(dryGain);
    g.connect(reverbNode);
    voices.set(vkey, { s: src, g });

    if (opts.attack) { // 绰/注：线性滑入（SoLoud fadeRelativePlaySpeed 语义）
      const semi = opts.attack === '绰' ? -2 : 2;
      const glide = Math.min(0.38, Math.max(0.22, noteDur * 0.35));
      src.playbackRate.setValueAtTime(rate * Math.pow(2, semi / 12), t);
      src.playbackRate.linearRampToValueAtTime(rate, t + glide);
    } else if (opts.glideTo) {
      // baseRate = 采样基准频率。教授音源采样录于对应徽位（baseFreq 返回该徽位频率），
      // APK 音源全录于七徽（baseFreq 返回 open*2）。
      // 目标播放速率 = 目标频率 / 采样基准频率
      const baseRate = baseFreq(kind, string, huiIdx, hui);
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

  window.GuqinAudio = { init, play, preload, freqOf, ensureCtx, damp, OPEN, setSource, getSource, setReverb, isReverbOn };
})();
