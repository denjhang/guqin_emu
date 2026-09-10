/* 粒子余音合成（移植自 udywang.com 虚拟古琴 part-07.js makeSustainBuffer）
 * 原理：真实采样不够长时，取其尾段做基音周期对齐的随机粒子拼接，
 * 去包络拉平响度，接缝等增益 sin²/cos² 交叉淡化，拼出任意长度的自然余音。
 * 逐行对照源码移植：mixdown/detectPeriod/fitDecayDbPerSec/makeSustainBuffer。 */
(function () {
  'use strict';

  function mixdown(buffer) {
    const n = buffer.length, ch = buffer.numberOfChannels;
    const m = new Float32Array(n);
    for (let c = 0; c < ch; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < n; i++) m[i] += d[i];
    }
    if (ch > 1) for (let i = 0; i < n; i++) m[i] /= ch;
    return m;
  }
  const db = x => 20 * Math.log10(x + 1e-12);
  function rms(a, from, to) {
    let s = 0;
    for (let i = from; i < to; i++) s += a[i] * a[i];
    return Math.sqrt(s / Math.max(1, to - from));
  }
  function detectPeriod(mono, sampleRate, centerSample, fMin = 55, fMax = 1200) {
    const W = Math.round(sampleRate * 0.06);
    const s = Math.max(0, Math.min(centerSample - (W >> 1), mono.length - W));
    const seg = new Float64Array(W);
    let mean = 0;
    for (let i = 0; i < W; i++) mean += mono[s + i];
    mean /= W;
    for (let i = 0; i < W; i++) seg[i] = mono[s + i] - mean;
    const lagMin = Math.max(2, Math.floor(sampleRate / fMax));
    const lagMax = Math.min(Math.floor(sampleRate / fMin), W >> 1);
    const r = new Float64Array(lagMax + 2);
    let best = -2, bestLag = lagMin;
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let num = 0, e1 = 0, e2 = 0;
      for (let i = 0; i + lag < W; i++) {
        const a = seg[i], b = seg[i + lag];
        num += a * b; e1 += a * a; e2 += b * b;
      }
      const v = num / (Math.sqrt(e1 * e2) + 1e-20);
      r[lag] = v;
      if (v > best) { best = v; bestLag = lag; }
    }
    let p = bestLag;
    if (bestLag > lagMin && bestLag < lagMax) {
      const y0 = r[bestLag - 1], y1 = r[bestLag], y2 = r[bestLag + 1];
      const d = y0 - 2 * y1 + y2;
      if (Math.abs(d) > 1e-12) p = bestLag + 0.5 * (y0 - y2) / d;
    }
    return { period: p, confidence: best };
  }
  function fitDecayDbPerSec(mono, sampleRate, from, to) {
    const W = Math.round(sampleRate * 0.03), H = Math.round(sampleRate * 0.01);
    const ts = [], es = [];
    for (let i = from; i + W <= to; i += H) {
      ts.push((i + W / 2) / sampleRate);
      es.push(db(rms(mono, i, i + W)));
    }
    const n = ts.length;
    if (n < 3) return 0;
    let st = 0, se = 0, ste = 0, stt = 0;
    for (let i = 0; i < n; i++) { st += ts[i]; se += es[i]; ste += ts[i] * es[i]; stt += ts[i] * ts[i]; }
    const den = n * stt - st * st;
    return Math.abs(den) < 1e-12 ? 0 : (n * ste - st * se) / den;
  }

  function makeSustainBuffer(ctx, buffer, seconds, opts = {}) {
    const { tailFrom = 0.55, joinAt = 0.72, grainMs = 180, endGuard = 0.010, maxBoostDb = 12 } = opts;
    const sr = buffer.sampleRate, n = buffer.length, ch = buffer.numberOfChannels;
    const mono = mixdown(buffer);
    const { period } = detectPeriod(mono, sr, Math.round(n * 0.6));
    const T = Math.max(2, Math.round(period));
    const N = Math.round(seconds * sr);
    if (n >= N * 0.98) return null;   // 采样本身够长，不接

    let a = Math.round(n * tailFrom);
    const guard = n - Math.max(Math.round(endGuard * sr), Math.round(n * 0.05));
    const w0 = Math.round(sr * 0.03);
    const lvl0 = db(rms(mono, a, Math.min(a + w0, n)));
    let b = guard;
    for (let i = a + w0; i + w0 < guard; i += w0) {
      if (db(rms(mono, i, i + w0)) < lvl0 - 10) { b = i; break; }
    }
    if (b - a < 6 * T) {
      a = Math.max(Math.round(n * 0.40), a - 6 * T);
      b = Math.max(b, Math.min(guard, a + 8 * T));
    }
    const join = Math.min(Math.round(n * joinAt), b - 2 * T);
    if (b - a < 4 * T) return null;   // 尾段太短，放弃（不抛错，回退自然长度）

    const slope = fitDecayDbPerSec(mono, sr, a, b);
    const maxGain = Math.pow(10, maxBoostDb / 20);
    const flat = i => {
      const t = (i - a) / sr;
      return slope < 0 ? Math.min(Math.pow(10, (-slope * t) / 20), maxGain) : 1;
    };

    let G = Math.round((grainMs / 1000) * sr / T) * T;
    G = Math.max(2 * T, Math.min(G, Math.floor((b - a) * 0.6)));
    const hop = Math.max(T, Math.round(G / 2 / T) * T);
    const win = new Float32Array(G);
    for (let i = 0; i < G; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (G - 1));

    const w = Math.round(sr * 0.05);
    const lvlAt = rms(mono, Math.max(0, join - w), join);
    let lvlFlat = 0;
    { let s = 0, c = 0;
      for (let i = a; i < b; i++) { const v = mono[i] * flat(i); s += v * v; c++; }
      lvlFlat = Math.sqrt(s / Math.max(1, c)); }
    const k = lvlFlat > 1e-9 ? lvlAt / lvlFlat : 1;

    const span = Math.max(1, Math.floor((b - a - G) / T));
    let base = join - Math.round(G / 2);
    base -= (((base - a) % T) + T) % T;
    const nGrain = Math.ceil((N - base) / hop) + 2;
    const offs = new Int32Array(nGrain);
    let seed = 0x9e3779b9 ^ (T * 2654435761) ^ n, last = -1;
    const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let g = 0; g < nGrain; g++) {
      let q; do { q = Math.floor(rnd() * span); } while (span > 2 && q === last);
      last = q; offs[g] = a + q * T;
    }

    const X = Math.max(T * 2, Math.round(G / 2));
    const out = ctx.createBuffer(ch, N, sr);
    for (let c = 0; c < ch; c++) {
      const src = buffer.getChannelData(c);
      const dst = out.getChannelData(c);
      const grain = new Float32Array(N);
      for (let g = 0; g < nGrain; g++) {
        const p = base + g * hop, off = offs[g];
        for (let i = 0; i < G; i++) {
          const d = p + i, s0 = off + i;
          if (d < 0 || d >= N || s0 >= b) continue;
          grain[d] += src[s0] * flat(s0) * k * win[i];
        }
      }
      for (let i = 0; i < N; i++) {
        const o = i < n ? src[i] : 0;
        if (i <= join - X) dst[i] = o;
        else if (i >= join) dst[i] = grain[i];
        else {
          const u = (i - (join - X)) / X;
          const gi = (1 - Math.cos(Math.PI * u)) / 2;
          dst[i] = (1 - gi) * o + gi * grain[i];
        }
      }
    }
    return out;
  }

  /* 缓存与时长策略（对照源码 SUS_MAX/HOLD_CAP/susLen） */
  const SUS_MAX = 9.0, HOLD_CAP = 2.8;
  const cache = new Map();
  function susLen(sec) { return Math.min(SUS_MAX, Math.max(2.5, Math.ceil((sec + 0.6) * 2) / 2)); }

  function sustained(ctx, key, buffer, seconds) {
    const L = susLen(seconds);
    const ck = key + '|' + L;
    if (cache.has(ck)) return cache.get(ck);
    let out = null;
    try { out = makeSustainBuffer(ctx, buffer, L); } catch (e) { out = null; }
    cache.set(ck, out);   // null 也缓存（避免反复尝试失败的采样）
    return out;
  }

  window.GuqinSustain = { sustained, makeSustainBuffer, HOLD_CAP, SUS_MAX };
})();
