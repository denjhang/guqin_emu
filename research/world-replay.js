(function () {
  'use strict';

  let timers = [];
  let activeVoices = [];
  let activeReplayGlide = null;
  let run = 0;
  let replayState = 'idle';
  let currentPerformance = null;
  let currentOffset = 0;
  let startedMono = 0;
  let enhancedVisual = false;

  function later(fn, delay) {
    const id = window.setTimeout(fn, Math.max(0, delay));
    timers.push(id);
    return id;
  }

  function resolvePosition(raw) {
    if (!raw) return null;
    const string = Number(raw.string);
    if (raw.open) return openPos(string);
    if (raw.harm) return harmPos(string, raw.huiLabel || raw.hui);
    const pool = (D.POSITIONS || []).filter(pos => pos.string === string);
    return pool.reduce((best, pos) => !best || Math.abs(pos.x - Number(raw.x)) < Math.abs(best.x - Number(raw.x)) ? pos : best, null);
  }

  function halt(clearSession) {
    run += 1;
    timers.forEach(clearTimeout);
    timers = [];
    activeVoices.forEach(voice => {
      try { releaseVoice(voice, 0, 0.12); } catch (error) {}
    });
    activeVoices = [];
    if (activeReplayGlide && S.freeGlide === activeReplayGlide) S.freeGlide = null;
    activeReplayGlide = null;
    try { clearFreeReadout(); } catch (error) {}
    if (clearSession) {
      replayState = 'idle';
      currentPerformance = null;
      currentOffset = 0;
      enhancedVisual = false;
    }
  }

  function stop() { halt(true); if (typeof showPauseLayer === 'function') showPauseLayer(false); }

  function pause() {
    if (replayState !== 'playing' || !currentPerformance) return false;
    currentOffset = Math.min(Number(currentPerformance.durationMs) || Infinity, currentOffset + Math.max(0, performance.now() - startedMono));
    halt(false);
    replayState = 'paused';
    try { window.parent && window.parent.postMessage({ type: 'world-guqin-replay-paused', offsetMs: currentOffset }, location.origin); } catch (error) {}
    return { ok: true, offsetMs: currentOffset };
  }

  function resume() {
    if (replayState !== 'paused' || !currentPerformance) return false;
    return play(currentPerformance, currentOffset);
  }

  function prime() {
    const ctx = audio();
    if (ctx.state === 'suspended') void ctx.resume();
    return true;
  }

  function setGlideRate(voice, pos, x) {
    if (!voice || !voice.src || !voice.src.playbackRate) return;
    const targetFreq = freqAtGx(pos.string, x);
    if (!targetFreq) return;
    const target = voice.rate * (targetFreq / pos.freq);
    try {
      voice.src.playbackRate.cancelScheduledValues(audio().currentTime);
      voice.src.playbackRate.setTargetAtTime(target, audio().currentTime, GLIDE_TAU);
    } catch (error) { voice.src.playbackRate.value = target; }
  }

  function supportsModeAwareVisual(work) {
    const match = String(work && work.appVersion || '').match(/^v(\d+)\.(\d+)/i);
    return !!match && (Number(match[1]) > 2 || (Number(match[1]) === 2 && Number(match[2]) >= 5));
  }

  function eventMode(event) {
    return event && (event.soundMode === 'pressed' || event.soundMode === 'harmonic') ? event.soundMode : '';
  }

  function applySurfaceMode(value) {
    if (!enhancedVisual || !value) return;
    try { window.GuqinReplaySurface && window.GuqinReplaySurface.setMode(value); } catch (error) {}
  }

  function showLiveVisual(pos, event) {
    if (!pos) return;
    if (pos.open) S.freeStringVibes[pos.string - 1] = clock.time;
    const tapFx = {
      x: sx(pos.x),
      y: syString(pos.string - 1),
      t: clock.time - S.t0,
      kind: 'great',
      free: 1
    };
    S.fx.push(tapFx);
    const pressed = !pos.open && !pos.harm;
    freeReadout(pos, pressed ? HOME_PRESSED_TAP_TOTAL * 1000 : 3000);
    if (pressed && Array.isArray(event && event.glide) && event.glide.length) {
      const firstDelay = Math.max(0, Number(event.glide[0].t) - Number(event.t));
      activeReplayGlide = {
        string: pos.string,
        startFreq: pos.freq,
        pos,
        gx: pos.x,
        startGx: pos.x,
        startedAt: clock.time,
        moved: true,
        ended: false,
        replay: true,
        tapFx,
        moveTapFx: enhancedVisual && firstDelay <= 220
      };
      document.documentElement.dataset.guqinReplayRingMode = activeReplayGlide.moveTapFx ? 'follow-target' : 'keep-origin';
      S.freeGlide = activeReplayGlide;
    }
  }

  function showGlidePosition(pos, x) {
    if (!activeReplayGlide || activeReplayGlide.pos !== pos) return;
    activeReplayGlide.gx = Number(x);
    if (activeReplayGlide.moveTapFx && activeReplayGlide.tapFx) activeReplayGlide.tapFx.x = sx(Number(x));
    const nearest = (PRESS_BY_STR[pos.string - 1] || []).reduce((best, point) =>
      !best || Math.abs(point.x - Number(x)) < Math.abs(best.x - Number(x)) ? point : best, null);
    if (nearest) freeReadout(nearest);
  }

  function endLiveVisual(pos) {
    if (activeReplayGlide && activeReplayGlide.pos === pos) {
      activeReplayGlide.ended = true;
      if (S.freeGlide === activeReplayGlide) S.freeGlide = null;
      activeReplayGlide = null;
      clearFreeReadout();
    }
  }

  async function startEvent(event, token) {
    if (token !== run) return;
    const pos = resolvePosition(event.pos);
    if (!pos) return;
    const glides = Array.isArray(event.glide) ? event.glide : [];
    const pressed = !pos.open && !pos.harm;
    applySurfaceMode(eventMode(event));
    showLiveVisual(pos, event);
    const voiceStartedAt = audio().currentTime;
    const voice = await pluck(pos, Number(event.gain) || 0.72, false, 0, {
      homeRaw: pressed,
      homeHarmonicExtra: pos.harm ? 1 : 0,
      homePressedTapExtra: pressed ? HOME_PRESSED_TAP_EXTRA : 0,
      homeNoiseClean: pos.open || pressed,
      instantApprovedFallback: pressed,
    });
    if (token !== run || !voice) return;
    activeVoices.push(voice);

    if (glides.length && pressed) {
      const firstDelay = Math.max(40, Number(glides[0].t) - Number(event.t));
      later(async () => {
        if (token !== run) return;
        // 走手长音从同一次拨弦已经走到的时间点接入，不能从样本 0 秒再播一遍音头。
        document.documentElement.dataset.guqinReplayGlideJoinMs = String(Math.max(0, Math.round((audio().currentTime - voiceStartedAt) * 1000)));
        const body = await startFreeGlideBody(pos, voiceStartedAt);
        if (token !== run || !body) return;
        releaseVoice(voice, 0, 0.16);
        activeVoices.push(body);
        setGlideRate(body, pos, Number(glides[0].x));
        showGlidePosition(pos, Number(glides[0].x));
        glides.slice(1).forEach(point => later(() => {
          setGlideRate(body, pos, Number(point.x));
          showGlidePosition(pos, Number(point.x));
        }, Math.max(0, Number(point.t) - Number(glides[0].t))));
        const releaseAt = Math.max(180, Number(event.duration) - firstDelay);
        later(() => { releaseVoice(body, 0.2, HOLD_RELEASE); endLiveVisual(pos); }, releaseAt);
      }, firstDelay);
    } else {
      later(() => endLiveVisual(pos), Math.max(750, Number(event.duration) || 0));
    }
  }

  async function play(work, offsetMs = 0) {
    halt(false);
    prime();
    currentPerformance = work;
    enhancedVisual = supportsModeAwareVisual(work);
    currentOffset = Math.max(0, Number(offsetMs) || 0);
    startedMono = performance.now();
    replayState = 'loading';
    const token = run;
    const events = work && Array.isArray(work.events) ? work.events : [];
    if (enhancedVisual) {
      const prior = events.filter(event => Number(event.t) <= currentOffset && eventMode(event)).pop();
      const first = prior || events.find(event => eventMode(event));
      if (first) applySurfaceMode(eventMode(first));
    }
    const prepared = events.map(event => ({ event, pos: resolvePosition(event.pos) })).filter(item => item.pos);
    await Promise.all(prepared.map(item => loadSample(sampleKey(item.pos))));
    if (token !== run) return false;
    replayState = 'playing';
    if (typeof showPauseLayer === 'function') showPauseLayer(false);
    if (window.GuqinStat) window.GuqinStat.hit('replay_play');
    prepared.filter(item => Number(item.event.t) >= currentOffset).forEach(item => later(() => void startEvent(item.event, token), (Number(item.event.t) || 0) - currentOffset));
    const duration = Math.max(Number(work.durationMs) || 0,
      ...events.map(event => (Number(event.t) || 0) + Math.max(1400, Number(event.duration) || 0)));
    later(() => {
      replayState = 'idle'; currentPerformance = null; currentOffset = 0;
      if (typeof showPauseLayer === 'function') showPauseLayer(false);
      window.parent && window.parent.postMessage({ type: 'world-guqin-replay-ended' }, location.origin);
    }, Math.max(0, duration - currentOffset) + 350);
    return { ok: true, durationMs: duration, offsetMs: currentOffset };
  }

  /* ── 看别人的演奏时的操作：只有暂停和继续 ───────────────────────────
     琴面在这个模式下不发声（见 part-07 的 IS_REPLAY_SURFACE），所以点屏幕
     不会有「自己弹了一下」的歧义。行为定成这样：

       正在播放 → 点屏幕任意处：立刻暂停，屏幕正中浮出一个按钮
       已暂停   → 只有点那个按钮才继续；点别处不理

     按钮做在琴面这一层（而不是各自的父页面里），所以世界古琴地图、
     排行榜与 /p/<id> 分享页的行为一致。 */
  let pauseLayer = null, pauseButton = null;

  function ensurePauseLayer() {
    if (pauseLayer) return pauseLayer;
    const style = document.createElement('style');
    style.textContent = `
      .replay-pause-layer{position:fixed;inset:0;z-index:400;display:none;place-items:center;
        background:rgba(24,18,17,.42);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
      .replay-pause-layer.on{display:grid}
      .replay-pause-button{display:grid;place-items:center;width:96px;height:96px;padding:0;
        border:1px solid rgba(235,219,193,.55);border-radius:50%;
        color:#f6ecd9;background:rgba(116,53,45,.82);
        -webkit-appearance:none;appearance:none;cursor:pointer;
        box-shadow:0 18px 46px rgba(0,0,0,.4);transition:transform .14s,background .14s}
      .replay-pause-button::before{content:"";display:block;width:0;height:0;margin-left:6px;
        border-top:16px solid transparent;border-bottom:16px solid transparent;
        border-left:25px solid #f6ecd9}
      .replay-pause-button:hover{border-color:rgba(235,219,193,.55);background:rgba(133,62,52,.9);
        filter:none;transform:scale(1.05)}
      .replay-pause-button:focus-visible{outline:none}
      @media(max-width:520px){.replay-pause-button{width:78px;height:78px}.replay-pause-button::before{
        margin-left:5px;border-top-width:13px;border-bottom-width:13px;border-left-width:21px}}`;
    document.head.appendChild(style);

    pauseLayer = document.createElement('div');
    pauseLayer.className = 'replay-pause-layer';
    pauseLayer.setAttribute('aria-hidden', 'true');
    const english = document.documentElement.lang.toLowerCase().startsWith('en');
    pauseLayer.innerHTML = '<button class="replay-pause-button" type="button" aria-label="'
      + (english ? 'Resume' : '继续播放') + '"></button>';
    pauseButton = pauseLayer.querySelector('.replay-pause-button');
    /* 只有这个按钮能继续；点遮罩别处一概不理（他要的就是这条）。 */
    pauseButton.addEventListener('pointerdown', event => {
      event.stopPropagation(); event.preventDefault();
      resumeFromLayer();
    });
    pauseLayer.addEventListener('pointerdown', event => { event.stopPropagation(); event.preventDefault(); });
    document.body.appendChild(pauseLayer);
    return pauseLayer;
  }

  function showPauseLayer(on) {
    const layer = ensurePauseLayer();
    layer.classList.toggle('on', !!on);
    layer.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (on && pauseButton) { try { pauseButton.focus({ preventScroll: true }); } catch (error) {} }
  }

  function pauseFromSurface() {
    if (replayState !== 'playing') return;
    if (!pause()) return;
    showPauseLayer(true);
    notifyParent('world-guqin-replay-paused-by-surface');
  }

  function resumeFromLayer() {
    if (replayState !== 'paused') { showPauseLayer(false); return; }
    showPauseLayer(false);
    resume();
    notifyParent('world-guqin-replay-resumed-by-surface');
  }

  function notifyParent(type) {
    try { window.parent && window.parent.postMessage({ type, offsetMs: currentOffset }, location.origin); } catch (error) {}
  }

  document.addEventListener('pointerdown', event => {
    // “音位全览”只切换绘制层，不属于琴面暂停手势，播放时序不能因此被打断。
    if (event.target && event.target.closest && event.target.closest('#bJianpuMap')) return;
    if (replayState === 'playing') pauseFromSurface();
  }, true);

  window.GuqinWorldReplay = {
    prime, play, pause, resume, stop,
    getState: () => replayState, ready: true,
    /* 父页面自己的播放／暂停按钮改状态时，中心按钮要跟着显示或收起。 */
    setPauseOverlay: showPauseLayer,
  };
  try { window.parent && window.parent.postMessage({ type: 'world-guqin-replay-ready' }, location.origin); } catch (error) {}
})();
