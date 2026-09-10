(function () {
  'use strict';
  const API = '../api/performances', APP_VERSION = 'v2.14', USER_KEY = 'world-guqin-user-id-v1', LOCAL_KEY = 'world-guqin-local-performances-v1', DELETE_KEY = 'world-guqin-delete-credentials-v1';
  const isZh = new URLSearchParams(location.search).get('lang') === 'zh';
  const replayOnly = new URLSearchParams(location.search).get('worldReplay') === '1';
  const localPreview = ['127.0.0.1', 'localhost', '::1'].includes(location.hostname);
  const activeNotes = new Map();
  let mode = 'idle', session = null, pending = null, clockTimer = 0, toastTimer = 0, wavCapture = null;
  const t = (zh, en) => isZh ? zh : en;

  function randomId() {
    if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  async function fetchTimed(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(url, Object.assign({}, options, { signal: controller.signal })); }
    finally { clearTimeout(timer); }
  }
  function userId() {
    let value = '';
    try { value = localStorage.getItem(USER_KEY) || ''; } catch (error) {}
    if (!/^[a-zA-Z0-9_-]{12,64}$/.test(value)) {
      value = randomId();
      try { localStorage.setItem(USER_KEY, value); } catch (error) {}
    }
    return value;
  }
  function deletionCredentials() {
    try { const value = JSON.parse(localStorage.getItem(DELETE_KEY) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    catch (error) { return {}; }
  }
  function saveDeletionCredential(id, token) {
    const values = deletionCredentials(); values[id] = token;
    const recent = Object.fromEntries(Object.entries(values).slice(-300));
    localStorage.setItem(DELETE_KEY, JSON.stringify(recent));
  }
  function ui() { return { button: document.getElementById('recordButton'), label: document.getElementById('recordLabel'), elapsed: document.getElementById('recordElapsed'), toast: document.getElementById('recordToast') }; }
  function showToast(message, ms = 3600) {
    const el = ui().toast; if (!el) return;
    clearTimeout(toastTimer); el.textContent = message; el.classList.add('on');
    toastTimer = window.setTimeout(() => el.classList.remove('on'), ms);
  }
  function elapsedText(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }
  function paintState() {
    const elements = ui(); if (!elements.button) return;
    const recording = mode === 'recording';
    const compactEnglish = !isZh && window.matchMedia('(max-width:680px) and (orientation:portrait)').matches;
    elements.button.classList.toggle('is-recording', recording);
    elements.button.disabled = mode === 'stopping' || mode === 'sharing';
    elements.button.setAttribute('aria-label', recording ? t('停止录制', 'Stop recording') : t('录制你的专属琴音', 'Record Your Guqin Sound'));
    elements.button.setAttribute('aria-pressed', recording ? 'true' : 'false');
    elements.label.textContent = recording ? t('录制中', 'Recording') : mode === 'stopping' ? t('正在完成', 'Finishing') : mode === 'sharing' ? t('正在分享', 'Sharing') : compactEnglish ? 'Record' : t('录制你的专属琴音', 'Record Your Guqin Sound');
    if (!recording) elements.elapsed.textContent = '00:00';
  }
  function startClock() {
    clearInterval(clockTimer);
    clockTimer = window.setInterval(() => { if (session && ui().elapsed) ui().elapsed.textContent = elapsedText(performance.now() - session.startedMono); }, 250);
  }
  function stopClock() { clearInterval(clockTimer); clockTimer = 0; }

  function modal(content, onDismiss) {
    const wrap = document.createElement('div');
    wrap.className = 'record-modal';
    wrap.innerHTML = '<div class="record-modal-card" role="dialog" aria-modal="true"><button class="record-modal-x" type="button" aria-label="' + t('放弃这段录音', 'Discard this recording') + '">×</button>' + content + '</div>';
    const style = document.createElement('style');
    style.textContent = `.record-modal{position:fixed;inset:0;z-index:260;display:grid;place-items:center;padding:18px;background:rgba(35,31,27,.28);backdrop-filter:blur(5px)}.record-modal-card{position:relative;width:min(520px,calc(100vw - 28px));padding:23px;border:1px solid rgba(85,67,49,.18);border-radius:15px;color:#2c2a26;background:#faf7ef;box-shadow:0 24px 75px rgba(44,42,38,.24);font:14px/1.62 system-ui,-apple-system,sans-serif}.record-modal-x{position:absolute;right:12px;top:12px;width:32px;height:32px;padding:0;border:0;border-radius:0;color:#5a554c;background:transparent;box-shadow:none;font:300 22px/1 -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer}.record-modal-x:focus-visible{outline:1px solid #74352d;outline-offset:2px}.record-modal-card h2{margin:0 38px 12px 0;font:500 20px/1.3 Georgia,"Songti SC",serif;letter-spacing:.04em}.record-modal-card>p{margin:0 0 15px;color:#685f55}.record-options{display:grid;gap:10px}.record-option{display:block;width:100%;height:auto;min-height:53px;padding:12px 14px;text-align:left;border:1px solid rgba(85,67,49,.19);border-radius:11px;color:#37312b;background:#fffdf7;cursor:pointer}.record-option:hover{border-color:rgba(116,53,45,.55);background:#fffaf0}.record-option strong{display:block;font-size:14px}.record-option.share strong{color:#7f332b}.record-preview{display:flex;align-items:center;gap:10px;margin-bottom:13px}.record-preview audio{width:100%;height:36px}.record-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:12px;flex-wrap:wrap}.record-modal-actions button,.nickname-row button{min-height:38px;padding:7px 15px;border:1px solid rgba(85,67,49,.22);border-radius:9px;color:#4b443c;background:transparent;cursor:pointer}.record-modal-actions button:disabled{opacity:.62;cursor:default}.record-modal-actions .primary{color:#fff;border-color:#74352d;background:#74352d}.nickname-label{display:block;margin:2px 0 5px;color:#685f55;font-size:12px}.nickname-row{display:flex;gap:8px;margin:0 0 14px}.nickname-row input{min-width:0;flex:1;height:40px;padding:0 11px;border:1px solid rgba(85,67,49,.24);border-radius:9px;background:#fffdf7;font:14px system-ui,-apple-system,sans-serif;outline:none}.nickname-row input:focus{border-color:#74352d}.nickname-error{min-height:20px;margin:-8px 0 5px!important;color:#8b3029!important;font-size:12px}.share-privacy{flex:1 0 100%;margin:2px 0 0!important;text-align:right;color:#857c71!important;font-size:10px;line-height:1.5}`;
    let closed = false;
    const onKey = event => { if (event.key === 'Escape' && mode !== 'sharing') dismiss(); };
    const close = () => { if (closed) return; closed = true; document.removeEventListener('keydown', onKey); wrap.remove(); style.remove(); };
    const dismiss = () => { if (mode === 'sharing') return; close(); if (typeof onDismiss === 'function') onDismiss(); };
    document.head.appendChild(style); document.body.appendChild(wrap);
    wrap.querySelector('.record-modal-x').addEventListener('click', dismiss);
    document.addEventListener('keydown', onKey);
    return { wrap, close, dismiss };
  }

  function newSession() { return { startedEpoch: Date.now(), startedMono: performance.now(), events: [], durationMs: 0 }; }
  function stopAllCurrentAudio(announce = true) {
    document.querySelectorAll('audio,video').forEach(media => { try { media.pause(); media.currentTime = 0; } catch (error) {} });
    try { window.GuqinWorldReplay && window.GuqinWorldReplay.stop(); } catch (error) {}
    try { window.GuqinStopAllAudio && window.GuqinStopAllAudio(); } catch (error) {}
    if (announce) try { const channel = new BroadcastChannel('world-guqin'); channel.postMessage({ type: 'stop-audio-for-recording' }); channel.close(); } catch (error) {}
  }
  function startWavCapture() {
    const ctx = audio(), tap = OUTPUT_TAP || BUS;
    const processor = ctx.createScriptProcessor(4096, 2, 2), silent = ctx.createGain(), chunks = [];
    silent.gain.value = 0;
    processor.onaudioprocess = event => {
      if (mode !== 'recording' && mode !== 'stopping') return;
      const input = event.inputBuffer, left = new Float32Array(input.getChannelData(0));
      const right = input.numberOfChannels > 1 ? new Float32Array(input.getChannelData(1)) : new Float32Array(left);
      chunks.push({ left, right });
    };
    tap.connect(processor); processor.connect(silent).connect(ctx.destination);
    return { ctx, tap, processor, silent, chunks };
  }
  function startRecording() {
    if (mode !== 'idle') return;
    try {
      stopAllCurrentAudio();
      session = newSession(); wavCapture = startWavCapture(); pending = null;
      mode = 'recording'; paintState(); startClock();
      if (window.GuqinStat) window.GuqinStat.hit('record_start');
      showToast(t('录制已开始，再次点击红色按钮即可结束。', 'Recording started. Click the red button again to finish.'));
    } catch (error) {
      session = null; wavCapture = null; mode = 'idle'; paintState();
      showToast(t('当前浏览器无法开始录制。', 'This browser could not start recording.'));
    }
  }
  function clonePosition(pos) { return { string: Number(pos.string), x: Number(pos.x), freq: Number(pos.freq), open: Boolean(pos.open), harm: Boolean(pos.harm), hui: String(pos.hui || ''), huiLabel: String(pos.huiLabel || ''), n: String(pos.n || ''), a: String(pos.a || ''), o: Number(pos.o || 0) }; }
  function recordPluck(pos, gain, meta = {}) {
    if (mode !== 'recording' || !session || !pos) return null;
    const now = performance.now(), id = randomId();
    const soundMode = meta.soundMode === 'pressed' ? 'pressed' : meta.soundMode === 'harmonic' ? 'harmonic' : (pos.harm ? 'harmonic' : 'pressed');
    const event = { id, type: 'pluck', t: Math.max(0, Math.round(now - session.startedMono)), pos: clonePosition(pos), soundMode, gain: Number.isFinite(gain) ? gain : 0.72, duration: 0, glide: [] };
    session.events.push(event); activeNotes.set(id, { event, started: now, lastGlideAt: 0 }); return id;
  }
  function recordGlide(id, x) {
    const note = activeNotes.get(id); if (!note || !session || mode !== 'recording') return;
    const now = performance.now(); if (now - note.lastGlideAt < 45) return;
    note.lastGlideAt = now; note.event.glide.push({ t: Math.round(now - session.startedMono), x: Number(x) });
  }
  function endNote(id) { const note = activeNotes.get(id); if (!note) return; note.event.duration = Math.max(0, Math.round(performance.now() - note.started)); activeNotes.delete(id); }
  function finishActiveNotes() { [...activeNotes.keys()].forEach(endNote); }

  function encodeWav(capture) {
    const frames = capture.chunks.reduce((sum, chunk) => sum + chunk.left.length, 0), channels = 2, bytesPerSample = 2, dataBytes = frames * channels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataBytes), view = new DataView(buffer);
    let peak = 0;
    capture.chunks.forEach(chunk => { for (let i = 0; i < chunk.left.length; i++) peak = Math.max(peak, Math.abs(chunk.left[i]), Math.abs(chunk.right[i])); });
    const exportGain = peak > 0 ? Math.min(8, 0.9 / peak) : 1;
    const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    text(0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, capture.ctx.sampleRate, true); view.setUint32(28, capture.ctx.sampleRate * channels * bytesPerSample, true);
    view.setUint16(32, channels * bytesPerSample, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, dataBytes, true);
    let offset = 44;
    capture.chunks.forEach(chunk => { for (let i = 0; i < chunk.left.length; i++) {
      const left = Math.max(-1, Math.min(1, chunk.left[i] * exportGain)), right = Math.max(-1, Math.min(1, chunk.right[i] * exportGain));
      view.setInt16(offset, Math.round(left < 0 ? left * 0x8000 : left * 0x7fff), true); offset += 2;
      view.setInt16(offset, Math.round(right < 0 ? right * 0x8000 : right * 0x7fff), true); offset += 2;
    }});
    return new Blob([buffer], { type: 'audio/wav' });
  }
  function downloadWav(blob) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-'), link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'guqin-' + stamp + '.wav'; document.body.appendChild(link); link.click();
    const url = link.href; link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function sharePayload(value, nickname, deleteToken) {
    return { consent: true, userId: userId(), nickname, deleteToken, recordedAt: new Date(value.startedEpoch).toISOString(), durationMs: value.durationMs, appVersion: APP_VERSION, events: value.events.map(event => { const copy = Object.assign({}, event); delete copy.id; return copy; }) };
  }
  function saveLocalPreview(payload) {
    const id = 'local-' + randomId(), now = new Date().toISOString();
    let rows = [];
    try { rows = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch (error) {}
    if (!Array.isArray(rows)) rows = [];
    const location = { country: 'LOCAL', region: t('本地试玩', 'Local preview'), city: t('本机位置', 'This device'), latitude: 37.4, longitude: -122.1 };
    rows.push({ id, userId: payload.userId, nickname: payload.nickname, recordedAt: payload.recordedAt, receivedAt: now, durationMs: payload.durationMs, eventCount: payload.events.length, likeCount: 0, playCount: 0, appVersion: payload.appVersion, location, events: payload.events });
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(-100))); } catch (error) { throw new Error('local_storage_unavailable'); }
    return { ok: true, id, local: true, location };
  }
  function randomNickname() {
    const first = isZh ? ['松间', '月下', '云外', '溪畔', '竹里', '听雪', '栖鹤', '远山', '清商', '墨泉'] : ['Moonlit', 'Quiet', 'Cloud', 'Pine', 'Jade', 'River', 'Autumn', 'Distant', 'Crane', 'Ink'];
    const second = isZh ? ['琴客', '知音', '散人', '听者', '旅人', '清友', '山人', '弦友'] : ['Qin Player', 'Listener', 'Wanderer', 'Friend', 'Traveler', 'Scholar', 'Hermit', 'Strings'];
    return first[Math.floor(Math.random() * first.length)] + (isZh ? '·' : ' ') + second[Math.floor(Math.random() * second.length)] + ' ' + String(Math.floor(10 + Math.random() * 90));
  }

  async function uploadPending(nickname, dialog, submit) {
    if (!pending || mode !== 'choosing') return;
    if (!pending.session.events.length) { showToast(t('没有录到音符，无法分享到地图。', 'No notes were recorded, so this cannot be shared.')); return; }
    mode = 'sharing'; paintState(); submit.disabled = true;
    try {
      const deleteToken = randomId() + randomId();
      const payload = sharePayload(pending.session, nickname, deleteToken);
      let result;
      try {
        const response = await fetchTimed(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) { let detail = {}; try { detail = await response.json(); } catch (parseError) {} throw new Error(detail.error || ('save_' + response.status)); }
        result = await response.json();
      } catch (error) {
        if (!localPreview) throw error;
        result = saveLocalPreview(payload);
      }
      saveDeletionCredential(result.id, deleteToken);
      pending.blob = null; pending = null; dialog.close();
      showToast(t('已分享到世界古琴地图。', 'Shared to the World Guqin Map.'), 5200);
      if (window.GuqinStat) window.GuqinStat.hit('share_done');
      try { const channel = new BroadcastChannel('world-guqin'); channel.postMessage({ type: 'shared', id: result.id }); channel.close(); } catch (error) {}
      window.dispatchEvent(new CustomEvent('world-guqin-saved', { detail: result }));
      mode = 'idle'; paintState();
      /* 分享成功就直接进世界古琴地图，让他在图上看见自己那一枚图章。
         （v1.87 曾在这里插一页「公开链接＋复制」——那种把裸链接摊给玩家看的
         做法被否了，整层撤掉。） */
      location.href = '../world-map.html?lang=' + (isZh ? 'zh' : 'en') + '&shared=' + encodeURIComponent(result.id);
      return;
    } catch (error) {
      mode = 'choosing'; paintState(); submit.disabled = false;
      const message = error && error.message === 'invalid_events'
        ? t('演奏数据校验失败，请刷新页面后重试。', 'The performance data could not be validated. Refresh and try again.')
        : t('分享失败，请稍后重试。', 'Sharing failed. Please try again later.');
      const errorBox = dialog.wrap.querySelector('.nickname-error');
      if (errorBox) errorBox.textContent = message; else showToast(message, 5200);
      return;
    }
    mode = 'idle'; paintState();
  }
  function showPostRecordingChoices() {
    if (!pending) { mode = 'idle'; paintState(); return; }
    mode = 'choosing'; paintState();
    if (window.GuqinStat) window.GuqinStat.hit('record_done');
    const discard = () => { pending = null; mode = 'idle'; paintState(); showToast(t('这段录音已放弃。', 'This recording was discarded.'), 2600); };
    const dialog = modal(`<h2>${t('录制完成', 'Recording complete')}</h2><label class="nickname-label" for="recordNickname">${t('为这段琴音署名', 'Name this guqin performance')}</label><div class="nickname-row"><input id="recordNickname" maxlength="30" autocomplete="nickname" placeholder="${t('输入昵称', 'Enter a nickname')}" aria-label="${t('昵称', 'Nickname')}"><button type="button" data-random="1">${t('随机生成', 'Random')}</button></div><p class="nickname-error" role="alert"></p><div class="record-modal-actions"><button type="button" data-download="1">${t('保存到本地（WAV）', 'Save locally (WAV)')}</button><button type="button" class="primary" data-share="1">${t('分享到世界古琴地图', 'Share to the World Guqin Map')}</button><p class="share-privacy">${t('点击分享即同意使用由 IP 推算的大致城市位置，仅用于世界古琴地图展示。', 'Clicking Share allows an approximate city inferred from your IP to be used only on the World Guqin Map.')}</p></div>`, discard);
    const input = dialog.wrap.querySelector('#recordNickname');
    const download = dialog.wrap.querySelector('[data-download="1"]');
    const submit = dialog.wrap.querySelector('[data-share="1"]');
    dialog.wrap.querySelector('[data-random="1"]').addEventListener('click', () => { input.value = randomNickname(); input.focus(); });
    download.addEventListener('click', () => {
      downloadWav(pending.blob);
      download.disabled = true;
      download.textContent = t('已保存到本地', 'Saved locally');
      showToast(t('WAV 已保存到本地。', 'The WAV file was saved locally.'), 4200);
    });
    submit.addEventListener('click', () => {
      const nickname = input.value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 30);
      if (!nickname) { dialog.wrap.querySelector('.nickname-error').textContent = t('请输入昵称，或点击“随机生成”。', 'Enter a nickname or choose Random.'); input.focus(); return; }
      void uploadPending(nickname, dialog, submit);
    });
    input.focus();
  }
  async function stopRecording() {
    if (mode !== 'recording' || !wavCapture || !session) return;
    finishActiveNotes(); stopClock(); session.durationMs = Math.max(0, Math.round(performance.now() - session.startedMono));
    mode = 'stopping'; paintState(); await new Promise(resolve => window.setTimeout(resolve, 1000));
    const capture = wavCapture; wavCapture = null;
    try { capture.tap.disconnect(capture.processor); } catch (error) {}
    try { capture.processor.disconnect(); capture.silent.disconnect(); } catch (error) {}
    capture.processor.onaudioprocess = null;
    const blob = encodeWav(capture), value = session; session = null;
    if (blob.size <= 44) { mode = 'idle'; paintState(); showToast(t('没有录到声音，本次未生成文件。', 'No sound was captured.')); return; }
    pending = { session: value, blob }; showPostRecordingChoices();
  }
  function buttonClick() { if (mode === 'recording') void stopRecording(); else if (mode === 'idle') startRecording(); }
  window.GuqinWorldRecorder = { recordPluck, recordGlide, endNote, startRecording, stopRecording, userId, getState: () => mode };
  try {
    const audioChannel = new BroadcastChannel('world-guqin');
    audioChannel.onmessage = event => { if (event.data && event.data.type === 'stop-audio-for-recording') stopAllCurrentAudio(false); };
  } catch (error) {}
  if (!replayOnly) { const button = ui().button; if (button) button.addEventListener('click', buttonClick); const compactQuery = window.matchMedia('(max-width:680px) and (orientation:portrait)'); if (compactQuery.addEventListener) compactQuery.addEventListener('change', paintState); else if (compactQuery.addListener) compactQuery.addListener(paintState); paintState(); }
})();
