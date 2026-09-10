// 七条散弦的真实录音（王悠荻演奏）。
// 处理链：原始 48kHz/24bit 单声道 → 按弦切分 → 裁到 4 秒
// → 末段 1.6 秒升余弦高次幂淡出（起点斜率为 0，像声音自己衰下去）
// → 按 A 加权感知响度归一（峰值一致时七弦感知响度仍差 4.6dB，听着会递减）
// → 四弦再单独补 2dB（它的中高频能量比平均低约 4dB，而中高频最影响「响不响」的判断）
// → AAC 80kbps。
// 各弦峰值刻意不一致：为了听起来一样响，低频弦本就需要更大振幅。
// 音准实测七条弦全部在 ±8 音分以内。顺序与 OPEN_STRING_MIDI 一致。
//
// v1.87：这七段录音原先以 base64 内联在本文件里（373 KB），首页光是加载它
// 就得等 373 KB 下载完才可能出声。现在指向 audio/open/ 下的实际文件，
// 掠到哪根弦取哪根弦。URL 相对本模块自身位置解析，因此从站内任何页面
// 导入都能取到，不受页面所在目录影响。
export const OPEN_STRING_SAMPLES = [
  new URL('./audio/open/s1.m4a', import.meta.url).href, // 一弦 · 倍低音1 C2
  new URL('./audio/open/s2.m4a', import.meta.url).href, // 二弦 · 倍低音2 D2
  new URL('./audio/open/s3.m4a', import.meta.url).href, // 三弦 · 倍低音4 F2
  new URL('./audio/open/s4.m4a', import.meta.url).href, // 四弦 · 倍低音5 G2
  new URL('./audio/open/s5.m4a', import.meta.url).href, // 五弦 · 倍低音6 A2
  new URL('./audio/open/s6.m4a', import.meta.url).href, // 六弦 · 低音1 C3
  new URL('./audio/open/s7.m4a', import.meta.url).href, // 七弦 · 低音2 D3
];
