/* 谱面播放器：score JSON → 时间轴 → 调度发声
 * 节奏：rhythmTokens 与 jianziTokens 按位置对齐（控制字无节奏，取前值） */
(function () {
  'use strict';
  const DUR = { whole: 4, half: 2, quarter: 1, eighth: 0.5, sixteenth: 0.25, thirtySecond: 0.125 };
  // 节奏 token → 总拍数（数值）。多组件时值求和，附点递增
  function rhythmBeats(rhythm) {
    if (!rhythm || rhythm.kind === 'blank' || !rhythm.duration) return 0;
    const comps = rhythm.rhythmComponents || [{ duration: rhythm.duration }];
    let total = 0;
    for (const c of comps) total += (DUR[c.duration] || 0);
    const dots = rhythm.dotCount || 0;
    if (dots > 0 && comps.length) {
      const base = DUR[comps[comps.length - 1].duration] || 0;
      total += base * (1 - Math.pow(0.5, dots));
    }
    return total;
  }
  // 节奏 token → 拍数字符串（统一用小数，如 0.5、0.25、1.25）
  function rhythmToBeats(rhythm) {
    const total = rhythmBeats(rhythm);
    if (total <= 0) return '';
    return total.toFixed(3).replace(/\.?0+$/, '') + '拍';
  }
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
    let domIdx = 0;        // 可见 token（非控制符）的全局序号，与 DOM 渲染顺序一致
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
        const beat = rhythmBeats(rhythm) || 1;
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
          if (act.ctrl === '少息') {
            t += sec;   // 休止记号占时长（按当前节奏），不发声
            continue;
          }
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
          // 泛起/泛止：零时长事件入队，播放时切换 harmonicCtx
          if (act.ctrl === '泛起' || act.ctrl === '泛止') {
            events.push({ t, dur: 0, token: tok, action: act, tempo, domIdx: domIdx - 1 });
          }
          continue;   // 控制符不分配 domIdx
        }
        const myDom = domIdx++;      // 可见 token（音符/滑音等）分配 DOM 位
        events.push({ t, dur: sec, token: tok, action: act, tempo, domIdx: myDom, rhythm });
        t += sec;
      }
    }
    return { events, total: t };
  }

  /* 单事件发声（也是点读器的入口） */
  function fireAction(act, dur, rhythm, tempo) {
    const A = window.GuqinAudio;
    const Stage = window.GuqinStage;
    dur = dur || 1.2;
    tempo = tempo || 60;
    // 从节奏 token 取出各组件拍数（扫弦/和弦按组件分配时值）
    const compBeats = rhythm && rhythm.rhythmComponents
      ? rhythm.rhythmComponents.map(c => DUR[c.duration] || 0)
      : null;
    if (act.type === 'ctrl') {
      if (act.ctrl === '泛起') harmonicCtx = true;
      if (act.ctrl === '泛止') harmonicCtx = false;
      return;
    }
    if (act.type === 'slide') {
      // 走手音：从上一音滑向目标徽
      const s = lastString || 1;
      const from = lastFreq || A.OPEN[s - 1];
      const fromHui = lastHui || lastHuiByString[s] || '七徽';
      const toHui = act.toHui;
      let target = toHui ? A.freqOf(s, toHui, false) : from * (act.dir === 'up' ? 1.122 : 1 / 1.122);
      if (Stage) Stage.press({ string: s, hui: toHui || lastHui, open: false });
      if (act.bounce) {
        // 逗/唤：半音急滑即回（逗=急上复下，唤=急下复上）
        const peak = from * (act.dir === 'up' ? 1.0595 : 1 / 1.0595);
        A.play(s, false, false, from, { glideTo: peak, glideSec: 0.12, dur: 0.3, gain: 0.5, hui: fromHui });
        later(() => A.play(s, false, false, peak, { glideTo: from, glideSec: 0.12, dur: 0.3, gain: 0.45, hui: fromHui }), 130);
        return;
      }
      // 走手音：右手不再拨弦——延续该弦正在振动的余音滑向目标徽
      // （无在响余音时才回退拨弦：点读/区间起点等场景）
      const glideSec = Math.max(0.4, dur * 0.7);
      const glided = A.glide ? A.glide(s, target, glideSec) : false;
      if (!glided) {
        A.play(s, false, false, from, { glideTo: target, glideSec, dur, gain: 0.55, hui: fromHui });
      }
      lastFreq = target; lastHui = toHui || lastHui;
      if (toHui) lastHuiByString[s] = toHui;       // 走手音后左手在新徽位
      return;
    }
    if (act.type === 'damp') {
      // 伏/剌伏：刹音，止住所有余振动
      if (A.damp) A.damp();
      return;
    }
    // 琴面舞台：左手按位(蓝) + 右手拨弦(橙) 圆点
    if (Stage) Stage.playAction(act, rhythm);
    if (act.type === 'chord') {
      (act.positions || []).forEach(p => pluckOne(p, dur, act.mods));
      return;
    }
    if (act.type === 'sweep') {
      // 滚/拂/历：连刷多弦。按节奏组件分配每根弦的间隔；无组件则均分总时长
      const step = act.to >= act.from ? 1 : -1;
      const strings = [];
      for (let s = act.from; step > 0 ? s <= act.to : s >= act.to; s += step) strings.push(s);
      const n = strings.length;
      const A = window.GuqinAudio;
      const isHarm = harmonicCtx && !act.open;
      const swHui = act.hui || lastHui || '七徽';
      // 每根弦的间隔拍数：有组件且数量匹配则用组件；否则总时长均分
      let gapBeats;
      if (compBeats && compBeats.length === n) {
        gapBeats = compBeats.slice();
      } else {
        const totalBeats = rhythmBeats(rhythm) || 1;
        const each = totalBeats / n;
        gapBeats = new Array(n).fill(each);
      }
      let cumMs = 0;
      strings.forEach((s, i) => {
        const freq = act.open ? A.OPEN[s - 1] : A.freqOf(s, swHui, isHarm);
        const noteDur = Math.max(0.4, (gapBeats[i] || 0.25) * 60 / tempo);
        const f = () => A.play(s, isHarm, act.open, freq, { dur: noteDur, gain: 0.6, hui: swHui });
        cumMs === 0 ? f() : later(f, cumMs);
        cumMs += (gapBeats[i] || 0.25) * 60 / tempo * 1000;
      });
      lastString = act.to;
      lastFreq = act.open ? A.OPEN[act.to - 1] : A.freqOf(act.to, swHui, isHarm);
      if (!act.open) { lastHui = swHui; lastHuiByString[act.to] = swHui; }
      return;
    }
    if (act.type === 'pluck') {
      const reps = Math.max(1, act.reps || 1);
      pluckOne(act, dur / reps * 1.5, act.mods);
      if (act.double && reps === 1) {
        // 连弹（抹挑七/勾剔二/打摘五）：同弦两触，按节奏组件分配间隔
        // 有组件时第一音占 compBeats[0] 拍，第二音延迟 compBeats[0] 拍后触发
        let gapMs;
        if (compBeats && compBeats.length >= 2) {
          gapMs = compBeats[0] * 60 / tempo * 1000;
        } else {
          gapMs = 90;  // 无组件信息时默认 90ms
        }
        const secondDur = compBeats && compBeats.length >= 2
          ? Math.max(0.3, compBeats[1] * 60 / tempo)
          : Math.max(0.4, dur * 0.6);
        later(() => pluckOne(act, secondDur, act.mods), gapMs);
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
      // 落指吟/定吟：揉的是正在振动的弦（吟猱=左手揉弦，右手不弹）。
      // 余音在响 → 直接加颤音；不在响（点读等）→ 回退拨弦。
      const vibMod = allMods.includes('吟') ? '吟' : (allMods.includes('猱') ? '猱' : null);
      if (vibMod && A.vibrato && A.vibrato(s, vibMod, Math.max(0.8, dur))) {
        lastFreq = freq; lastString = s; lastHui = hui;
        lastHuiByString[s] = hui;
        return;
      }
      const opts = { dur: Math.max(0.8, dur * 0.95), gain: 0.85, hui };
      if (vibMod) opts.vibrato = vibMod;
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
    // 徽位解析：本字 > 该弦最后徽位 > 全局最后徽位（续弹只写弦号时左手保持原位）> 七徽
    const hui = p.hui || lastHuiByString[p.string] || lastHui || '七徽';
    const freq = p.open ? A.OPEN[p.string - 1] : A.freqOf(p.string, hui, harm);
    const opts = { dur: Math.max(0.8, dur * 0.95), gain: 0.85, hui };
    if (allMods.length) {
      if (allMods.includes('绰')) opts.attack = '绰';
      else if (allMods.includes('注')) opts.attack = '注';
      else if (allMods.includes('吟')) opts.vibrato = '吟';
      else if (allMods.includes('猱')) opts.vibrato = '猱';
    }
    A.play(p.string, harm, p.open, freq, opts);
    lastFreq = freq; lastString = p.string;
    if (p.hui) { lastHui = p.hui; lastHuiByString[p.string] = p.hui; }   // 按音记录徽位，续弹继承
  }

  /* 播放整谱 */
  let currentEvents = [];
  let currentOnToken = null, currentOnEnd = null;
  let playStartPerf = 0;   // performance.now() at play start
  let pausedOffset = 0;     // seconds elapsed when paused

  function play(score, defaultTempo, onToken, onEnd, range) {
    stop();
    const tl = buildTimeline(score, defaultTempo);
    let events = tl.events;
    if (range) {
      const lo = Math.min(range.startDom, range.endDom);
      const hi = Math.max(range.startDom, range.endDom);
      events = events.filter(ev => ev.domIdx != null && ev.domIdx >= lo && ev.domIdx <= hi);
      let tOff = 0.2;
      events = events.map(ev => {
        const nev = { ...ev, t: tOff };
        tOff += ev.dur;
        return nev;
      });
    }
    currentEvents = events; currentOnToken = onToken; currentOnEnd = onEnd;
    playing = true; pausedOffset = 0;
    const myRun = ++runId;
    window.GuqinAudio.ensureCtx();
    playStartPerf = performance.now();
    scheduleEvents(events, myRun, 0);
    const total = events.length ? events[events.length - 1].t + events[events.length - 1].dur : 0.5;
    later(() => {
      if (!playing || myRun !== runId) return;
      playing = false;
      if (currentOnEnd) currentOnEnd();
    }, total * 1000 + 500);
    return { events, total };
  }

  // 调度事件，支持从 offset 秒处开始（用于暂停恢复）
  function scheduleEvents(events, myRun, offsetSec) {
    events.forEach((ev, i) => {
      if (ev.t < offsetSec - 0.01) return; // 已播放过的跳过
      later(() => {
        if (!playing || myRun !== runId) return;
        fireAction(ev.action, ev.dur, ev.rhythm, ev.tempo);
        if (currentOnToken) currentOnToken(i, ev);
      }, (ev.t - offsetSec) * 1000);
    });
  }

  function pause() {
    if (!playing) return;
    playing = false;
    pausedOffset = (performance.now() - playStartPerf) / 1000;
    timers.forEach(clearTimeout); timers = [];
  }

  function resume() {
    if (playing || !currentEvents.length) return;
    playing = true;
    const myRun = ++runId;
    playStartPerf = performance.now() - pausedOffset * 1000;
    scheduleEvents(currentEvents, myRun, pausedOffset);
    const total = currentEvents.length ? currentEvents[currentEvents.length - 1].t + currentEvents[currentEvents.length - 1].dur : 0.5;
    later(() => {
      if (!playing || myRun !== runId) return;
      playing = false;
      if (currentOnEnd) currentOnEnd();
    }, (total - pausedOffset) * 1000 + 500);
  }

  /* 点读：单个 token 即时发声（每次独立，不残留播放/上一点读的上下文） */
  function tapToken(token, rhythm, tempo) {
    // 重置泛音与位置上下文：点读不应受之前"泛起"或上一音位置影响
    harmonicCtx = false;
    lastFreq = 0; lastString = 1; lastHui = null;
    Object.keys(lastHuiByString).forEach(k => delete lastHuiByString[k]);
    const act = window.JianziSemantics.parseToken(token);
    fireAction(act, 1.2, rhythm, tempo || 60);
    // 点读后清除泛音状态，避免影响下次点读
    harmonicCtx = false;
    return act;
  }

  function stop() {
    playing = false; runId++;
    timers.forEach(clearTimeout); timers = [];
    currentEvents = []; pausedOffset = 0;
    lastFreq = 0; lastString = 1; lastHui = null; harmonicCtx = false;
    Object.keys(lastHuiByString).forEach(k => delete lastHuiByString[k]);
    if (window.GuqinStage && window.GuqinStage.clear) window.GuqinStage.clear();
  }
  function isPlaying() { return playing; }

  window.GuqinPlayer = { buildTimeline, play, stop, pause, resume, tapToken, isPlaying, rhythmToBeats };
})();
