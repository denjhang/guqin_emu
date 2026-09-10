import { OPEN_STRING_SAMPLES } from './guqin/open-string-samples.js';

const qin = document.getElementById('virtualQin');
const stringY = [33.70, 42.64, 50.60, 58.29, 66.01, 73.73, 81.45];
let context = null;
let bus = null;
let buffers = Array(7).fill(null);
let voices = new Map();
let hovered = null;
let pending = null;

async function audioContext(shouldResume = true) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!context) context = new AudioContextClass();
  if (!bus) {
    bus = context.createGain();
    const limiter = context.createDynamicsCompressor();
    bus.gain.value = 0.92;
    limiter.threshold.value = -4;
    limiter.knee.value = 7;
    limiter.ratio.value = 16;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.28;
    bus.connect(limiter).connect(context.destination);
  }
  if (shouldResume && context.state === 'suspended') {
    try { await context.resume(); } catch (_) {}
  }
  return context;
}

// v1.87：散弦录音改成 audio/open/ 下的实际文件，掠到哪根弦才取哪根弦。
// 首页因此不再为了七段录音先背 373 KB。
async function decodedSample(index, ctx) {
  if (buffers[index]) return buffers[index];
  const response = await fetch(OPEN_STRING_SAMPLES[index]);
  if (!response.ok) throw new Error('散弦录音取不到：HTTP ' + response.status);
  buffers[index] = await ctx.decodeAudioData(await response.arrayBuffer());
  return buffers[index];
}

async function playOpenString(index) {
  pending = index;
  const ctx = await audioContext();
  if (!ctx) return false;
  const sample = await decodedSample(index, ctx);
  if (ctx.state !== 'running') return false;
  const old = voices.get(index);
  if (old) {
    const now = ctx.currentTime;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setTargetAtTime(0.0001, now, 0.04);
    try { old.source.stop(now + 0.2); } catch (_) {}
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = sample;
  // 首页小琴只作轻声预听：在原 0.94 的基础上降低 30%。
  gain.gain.value = 0.658;
  source.connect(gain).connect(bus);
  voices.set(index, { source, gain });
  qin.dataset.soundingString = String(index + 1);
  source.onended = () => {
    if (voices.get(index)?.source === source) voices.delete(index);
    if (qin.dataset.soundingString === String(index + 1)) delete qin.dataset.soundingString;
  };
  source.start();
  pending = null;
  return true;
}

function stringAt(event) {
  const svg = qin.querySelector('svg');
  const rect = svg.getBoundingClientRect();
  if (!rect.height) return null;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  let nearest = 0;
  let distance = Infinity;
  stringY.forEach((value, index) => {
    const d = Math.abs(value - y);
    if (d < distance) { distance = d; nearest = index; }
  });
  return distance <= 7 ? nearest : null;
}

if (qin) {
  // 浏览器若允许自动播放，第一次掠弦即可立即响；若拦截有声自动播放，
  // 悬停时先解码当前弦，首次有效交互后便可无等待衔接。
  const hoverString = event => {
    const index = stringAt(event);
    if (index !== null && index !== hovered) void playOpenString(index);
    hovered = index;
  };
  const unlock = async event => {
    if (event?.target && qin.contains(event.target)) return;
    const ctx = await audioContext();
    const index = hovered ?? pending;
    if (ctx?.state === 'running' && index !== null) void playOpenString(index);
  };

  qin.addEventListener('pointerenter', hoverString);
  qin.addEventListener('pointermove', hoverString);
  qin.addEventListener('pointerdown', event => {
    const index = stringAt(event);
    if (index !== null) void playOpenString(index);
  });
  qin.addEventListener('pointerleave', () => { hovered = null; });
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('touchend', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}
