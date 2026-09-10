/* 语音识别：Web Speech API（Chrome/Edge，需麦克风权限；localhost 可用） */
(function () {
  'use strict';
  let rec = null, active = false;

  function supported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

  function start(onFinal, onInterim, onErr) {
    if (!supported()) { onErr && onErr('此浏览器不支持语音识别（请用 Chrome/Edge）'); return; }
    stop();
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    rec = new R();
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = e => {
      let interim = '', finals = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals.push(r[0].transcript);
        else interim += r[0].transcript;
      }
      if (finals.length) onFinal && onFinal(finals.join(''));
      if (interim) onInterim && onInterim(interim);
    };
    rec.onerror = e => { if (e.error !== 'no-speech') onErr && onErr(e.error); };
    rec.onend = () => { if (active) { try { rec.start(); } catch (e) { /* restart race */ } } };
    active = true;
    try { rec.start(); } catch (e) { onErr && onErr(String(e)); }
  }

  function stop() {
    active = false;
    if (rec) { try { rec.stop(); } catch (e) {} rec = null; }
  }
  function isActive() { return active; }

  window.GuqinSpeech = { supported, start, stop, isActive };
})();
