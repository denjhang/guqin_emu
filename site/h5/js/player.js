/* 谱面播放器：score JSON → 时间轴 → 调度发声
 * 节奏：rhythmTokens 与 jianziTokens 按位置对齐（控制字无节奏，取前值） */
(function () {
  'use strict';
  const DUR = { whole: 4, half: 2, quarter: 1, eighth: 0.5, sixteenth: 0.25, thirtySecond: 0.125 };
  let timers = [], playing = false, runId = 0, onTokenCb = null, onEndCb = null;
  let lastFreq = 0, lastString = 1, lastHui = null, harmonicCtx = false;
  const lastHuiByString = {};   // 每弦最后徽位：续弹/换指法时左手保持原位

  function later(fn, ms) { const id = setTimeout(fn, Math.max(0, ms)); timers.push(id); return id; }

  /* 展开谱面为事件列表（带秒时间），供播放与进度条
   * - 节奏按位置对齐：jt[i] 对应 rt[i]，blank 节奏沿用前值
   * - 括号/从括号再作：结构记号，零时长；从括号再作展开括号后的反复段
   * - ctrl 类（泛起/泛止/少息等）零时长 */
  function buildTimeline(score, defaultTempo) {
    const events = [];
    let t = 0.4;
    let tempo = defaultTempo || 60;
    let bracketIdx = -1;   // 最近一个「括号」在 events 中的位置（反复段起点）
    for (const line of score.lines || []) {
      if (line.sectionTempo) tempo = line.sectionTempo;
      const jt = (line.jianziTokens || []);
      const rt = (line.rhythmTokens || []);
      let lastDur = { duration: 'quarter' };
      for (let i = 0; i < jt.length; i++) {
        const tok = jt[i];
        if (tok.kind === 'blank') continue;
        const r = rt[i];
        // 节奏按位置对齐：blank 节奏沿用前一非空节奏
        const rhythm = (r && r.kind !== 'blank' && r.duration) ? r : lastDur;
        if (r && r.kind !== 'blank' && r.duration) lastDur = r;
        const beat = (DUR[rhythm.duration] || 1);
        const sec = beat * 60 / tempo;
        const act = window.JianziSemantics.parseToken(tok);

        // 「至X」延续前一散音滚拂/涓扫弦：散涓二 至三 → 扫二至三
        const zhiMatch = (tok.text || '').match(/^至([一二三四五六七])$/);
        if (zhiMatch && events.length) {
          const prev = events[events.length - 1];
          const toNum = '零一二三四五六七'.indexOf(zhiMatch[1]);
          if (prev.action.type === 'pluck' && prev.action.open && /[滚拂涓]/.test(prev.action.tech || '')) {
            prev.action = { type: 'sweep', from: prev.action.string, to: toNum, open: true, tech: prev.action.tech, text: prev.token.text + tok.text };
          } else if (prev.action.type === 'sweep' && prev.action.open) {
            prev.action.to = toNum;
            prev.action.text = (prev.action.text || '') + tok.text;
          }
          continue;  // 「至」本身不占时长，合并到前一事件
        }

        if (act.type === 'ctrl') {
          if (act.ctrl === '括号') {
            bracketIdx = events.length;   // 反复段从括号后的第一个事件开始
          } else if (act.ctrl === '从括号再作' && bracketIdx >= 0) {
            // 展开反复段：复制括号后到再作前的所有事件
            const repeat = events.slice(bracketIdx);
            for (const ev of repeat) {
              events.push({ ...ev, t, token: ev.token, action: ev.action });
              t += ev.dur;
            }
          }
          // 结构记号本身不占时长
          continue;
        }
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
      if (act.bounce) {
        // 逗/唤：半音急滑即回（逗=急上复下，唤=急下复上）
        const peak = from * (act.dir === 'up' ? 1.0595 : 1 / 1.0595);
        A.play(s, false, false, from, { glideTo: peak, glideSec: 0.12, dur: 0.3, gain: 0.5 });
        later(() => A.play(s, false, false, peak, { glideTo: from, glideSec: 0.12, dur: 0.3, gain: 0.45 }), 130);
        return;
      }
      A.play(s, false, false, from, { glideTo: target, glideSec: Math.max(0.4, dur * 0.7), dur, gain: 0.55 });
      lastFreq = target; lastHui = toHui || lastHui;
      if (toHui) lastHuiByString[s] = toHui;       // 走手音后左手在新徽位
      return;
    }
    if (act.type === 'damp') {
      // 伏/剌伏：刹音，止住所有余振动
      if (A.damp) A.damp();
      return;
    }
    if (act.type === 'chord') {
      (act.positions || []).forEach(p => pluckOne(p, dur, act.mods));
      return;
    }
    if (act.type === 'sweep') {
      // 滚/拂/历：连刷多弦，间隔 80ms
      // open=true 散音扫弦；open=false 按音扫弦（用 act.hui）
      const step = act.to >= act.from ? 1 : -1;
      const A = window.GuqinAudio;
      for (let s = act.from; step > 0 ? s <= act.to : s >= act.to; s += step) {
        const del = Math.abs(s - act.from) * 80;
        const freq = act.open ? A.OPEN[s - 1] : A.freqOf(s, act.hui || '七徽', false);
        const f = () => A.play(s, false, act.open, freq, { dur: 0.7, gain: 0.6 });
        del === 0 ? f() : later(f, del);
      }
      // 记录最后一根弦的状态，供后续 carry 技法沿用
      lastString = act.to;
      lastFreq = act.open ? A.OPEN[act.to - 1] : A.freqOf(act.to, act.hui || '七徽', false);
      if (!act.open && act.hui) lastHuiByString[act.to] = act.hui;
      return;
    }
    if (act.type === 'pluck') {
      const reps = Math.max(1, act.reps || 1);
      pluckOne(act, dur / reps * 1.5, act.mods);
      if (act.double && reps === 1) {
        // 连弹（抹挑七/勾剔二）：同弦两触，第二触约 90ms 后（同弦重触自然掐断前音）
        later(() => pluckOne(act, Math.max(0.4, dur * 0.6), act.mods), 90);
      }
      for (let k = 1; k < reps; k++) {
        // 轮/琐：同弦快弹，75ms 间隔（同弦重触自然形成斩截感）
        later(() => pluckOne(act, 0.45, act.mods), k * 75);
      }
    }
  }

  function pluckOne(p, dur, mods) {
    const A = window.GuqinAudio;
    const harm = p.harmonic || harmonicCtx && !p.open;
    const allMods = (mods || []).concat(p.mods || []);
    // 抓起/掐起/带起/掩：左手松开按弦 → 弦长恢复全弦 → 散音
    // 弦号沿用 lastString（扫弦/连弹后的末弦），不按指回查
    if (p.carry && p.open) {
      const s = p.string || lastString || 1;
      const f = A.OPEN[s - 1];
      if (f) A.play(s, false, true, f, { dur, gain: 0.6 });
      lastFreq = f; lastString = s;
      return;
    }
    // 落指吟/定吟/推出等：左手保持按音，沿用前一音弦位+徽位拨弦
    if (p.carry) {
      const s = p.string || lastString || 1;
      const hui = p.hui || lastHuiByString[s] || lastHui || '七徽';
      const freq = A.freqOf(s, hui, harm);
      const opts = { dur: Math.max(0.8, dur * 0.95), gain: 0.85 };
      if (allMods.includes('吟')) opts.vibrato = '吟';
      else if (allMods.includes('猱')) opts.vibrato = '猱';
      A.play(s, harm, false, freq, opts);
      lastFreq = freq; lastString = s; lastHui = hui;
      lastHuiByString[s] = hui;
      return;
    }
    if (p.string == null) {
      const s = lastString || 1;
      const f = A.OPEN[s - 1];
      if (f) A.play(s, false, true, f, { dur, gain: 0.6 });
      lastFreq = f; lastString = s;
      return;
    }
    // 徽位解析：本字 > 该弦最后徽位（续弹只写弦号时左手保持原位）> 七徽
    const hui = p.hui || lastHuiByString[p.string] || '七徽';
    const freq = p.open ? A.OPEN[p.string - 1] : A.freqOf(p.string, hui, harm);
    const opts = { dur: Math.max(0.8, dur * 0.95), gain: 0.85 };
    if (allMods.length) {
      if (allMods.includes('绰')) opts.attack = '绰';
      else if (allMods.includes('注')) opts.attack = '注';
      else if (allMods.includes('吟')) opts.vibrato = '吟';
      else if (allMods.includes('猱')) opts.vibrato = '猱';
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
