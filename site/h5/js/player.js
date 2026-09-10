/* 谱面播放器：score JSON → 时间轴 → 调度发声
 * 节奏：rhythmTokens 与 jianziTokens 按位置对齐（控制字无节奏，取前值） */
(function () {
  'use strict';
  const DUR = { whole: 4, half: 2, quarter: 1, eighth: 0.5, sixteenth: 0.25, thirtySecond: 0.125 };
  let timers = [], playing = false, runId = 0, onTokenCb = null, onEndCb = null;
  let lastFreq = 0, lastString = 1, lastHui = null, harmonicCtx = false;
  const lastHuiByString = {};   // 每弦最后徽位：续弹/换指法时左手保持原位

  function later(fn, ms) { const id = setTimeout(fn, Math.max(0, ms)); timers.push(id); return id; }

  /* 展开谱面为事件列表（带秒时间），供播放与进度条 */
  function buildTimeline(score, defaultTempo) {
    const events = [];
    let t = 0.4;
    let tempo = defaultTempo || 60;
    let pendingHui = null;      // 上一个按音徽位（走手音基准）
    for (const line of score.lines || []) {
      if (line.sectionTempo) tempo = line.sectionTempo;
      const jt = (line.jianziTokens || []);
      const rt = (line.rhythmTokens || []).filter(r => r.kind !== 'blank');
      const sound = jt.filter(tok => tok.kind !== 'blank');
      // 节奏与发声字按非空位置对齐；对不齐时从后往前以节奏为准
      let ri = 0;
      for (const tok of sound) {
        const rhythm = rt[ri++] || rt[rt.length - 1] || { duration: 'quarter' };
        const beat = (DUR[rhythm.duration] || 1);
        const sec = beat * 60 / tempo;
        const act = window.JianziSemantics.parseToken(tok);
        events.push({ t, dur: sec, token: tok, action: act, tempo });
        t += sec;
      }
    }
    return { events, total: t };
  }

  /* 单事件发声（也是点读器的入口） */
  function fireAction(act, dur) {
    const A = window.GuqinAudio;
    dur = dur || 1.2;
    if (act.type === 'ctrl') {
      if (act.ctrl === '泛起') harmonicCtx = true;
      if (act.ctrl === '泛止') harmonicCtx = false;
      return;
    }
    if (act.type === 'slide') {
      // 走手音：从上一音滑向目标徽
      const s = lastString || 1;
      const from = lastFreq || A.OPEN[s - 1];
      const toHui = act.toHui;
      let target = toHui ? A.freqOf(s, toHui, false) : from * (act.dir === 'up' ? 1.122 : 1 / 1.122);
      A.play(s, false, false, from, { glideTo: target, glideSec: Math.max(0.4, dur * 0.7), dur, gain: 0.55 });
      lastFreq = target; lastHui = toHui || lastHui;
      if (toHui) lastHuiByString[s] = toHui;       // 走手音后左手在新徽位
      return;
    }
    if (act.type === 'chord') {
      (act.positions || []).forEach(p => pluckOne(p, dur, act.mods));
      return;
    }
    if (act.type === 'sweep') {
      // 滚/拂/历：连刷散弦，间隔 80ms
      const step = act.to >= act.from ? 1 : -1;
      for (let s = act.from; step > 0 ? s <= act.to : s >= act.to; s += step) {
        const del = Math.abs(s - act.from) * 80;
        const f = () => window.GuqinAudio.play(s, false, true, window.GuqinAudio.OPEN[s - 1], { dur: 0.7, gain: 0.6 });
        del === 0 ? f() : later(f, del);
      }
      return;
    }
    if (act.type === 'pluck') {
      pluckOne(act, dur, act.mods);
      // 连弹（抹挑七/勾剔二）：同弦两触，第二触约 90ms 后（同弦重触自然掐断前音）
      if (act.double) later(() => pluckOne(act, Math.max(0.4, dur * 0.6), act.mods), 90);
    }
  }

  function pluckOne(p, dur, mods) {
    const A = window.GuqinAudio;
    const harm = p.harmonic || harmonicCtx && !p.open;
    // 掐起/掩等左手发声：沿用上一音；完全没有上文时落到 1 弦七徽
    if (p.carry || p.string == null) {
      const s = lastString || 1;
      const h = p.hui || lastHuiByString[s] || '七徽';
      const f = lastFreq || A.freqOf(s, h, harm);
      if (f) A.play(s, false, false, f, { dur, gain: 0.6 });
      return;
    }
    // 徽位解析：本字 > 该弦最后徽位（续弹只写弦号时左手保持原位）> 七徽
    const hui = p.hui || lastHuiByString[p.string] || '七徽';
    const freq = p.open ? A.OPEN[p.string - 1] : A.freqOf(p.string, hui, harm);
    const opts = { dur: Math.max(0.8, dur * 0.95), gain: 0.85 };
    if (mods) {
      if (mods.includes('绰')) opts.attack = '绰';
      else if (mods.includes('注')) opts.attack = '注';
      else if (mods.includes('吟')) opts.vibrato = '吟';
      else if (mods.includes('猱')) opts.vibrato = '猱';
    }
    A.play(p.string, harm, p.open, freq, opts);
    lastFreq = freq; lastString = p.string; lastHui = p.hui;
    if (p.hui) lastHuiByString[p.string] = p.hui;   // 按音记录徽位，续弹继承
  }

  /* 播放整谱 */
  function play(score, defaultTempo, onToken, onEnd) {
    stop();
    const tl = buildTimeline(score, defaultTempo);
    playing = true; onTokenCb = onToken; onEndCb = onEnd;
    const myRun = ++runId;
    window.GuqinAudio.ensureCtx();
    const t0 = performance.now();
    tl.events.forEach((ev, i) => {
      later(() => {
        if (!playing || myRun !== runId) return;
        fireAction(ev.action, ev.dur);
        if (onTokenCb) onTokenCb(i, ev);
      }, ev.t * 1000);
    });
    later(() => {
      if (!playing || myRun !== runId) return;
      playing = false;
      if (onEndCb) onEndCb();
    }, tl.total * 1000 + 500);
    return tl;
  }

  /* 点读：单个 token 即时发声 */
  function tapToken(token) {
    const act = window.JianziSemantics.parseToken(token);
    fireAction(act, 1.2);
    return act;
  }

  function stop() {
    playing = false; runId++;
    timers.forEach(clearTimeout); timers = [];
    lastFreq = 0; lastString = 1; lastHui = null; harmonicCtx = false;
    Object.keys(lastHuiByString).forEach(k => delete lastHuiByString[k]);
  }
  function isPlaying() { return playing; }

  window.GuqinPlayer = { buildTimeline, play, stop, tapToken, isPlaying };
})();
