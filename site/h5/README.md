# 减字谱引擎 H5

逆向「古琴大师」Android 版（Flutter）实现的纯前端复刻，零依赖、零构建。

## 运行

```
cd site && node server.js 8080
# 打开 http://localhost:8080/h5/
```

## 功能

- **乐谱库**：内置 62 首有效谱面（曲库 10 + 社区 52，来自云端快照 `scores/all_raw.json`），按字数排序、可搜索
- **谱面渲染**：141 部件 × SVG 路径 + 槽位排版（复刻 APK 的 glyph_parts/glyph_paths/category_rules 三件套）
- **点读**：点击任意减字即时发声
- **整谱播放**：按节奏 token（全/半/四/八/十六/三十二分）与段落速度调度，逐字高亮
- **音频引擎**：APK 内置 21 条真实采样（每弦 散/按七徽/七徽泛音），playbackRate 变调；
  按音/泛音频率表来自弦长徽位物理位置，定弦按三分损益十二律（黄钟 65.41Hz 正调）
- **演奏语义**：散音/按音/泛音、撮（双音）、滚拂历（连刷）、上下滑音（走手音）、
  绰/注（滑音起手）、吟/猱（揉弦）、掐起/带起/抓起（左手发声）等
- **打字转减字**：输入「大七挑四 散勾三 泛起 撮大九四散七」→ 合成减字并录入编辑器，
  排版优先复用语料库同签名布局
- **语音识别**：Web Speech API（Chrome/Edge），说「大七挑四」自动录入
- **作曲编辑器**：录入/删除字（右键）、换行、调节奏、改速度、导出 JSON（格式与 APK 兼容）

## 逆向要点

- 谱面 token = `{code, text, partIds[], categorySlots[], slotTransforms[]}`，
  语义全部在 categorySlots 序列里（如 `左手,number,挑托,number` = 指徽技法弦）
- 槽位坐标是 256×256 方块内的左上角 + 宽高，弦号与技法字允许重叠（传统减字写法）
- 撮的数字歧义：有「散」组时按音组全数字是徽位；全按音时组末数字是弦号
- 节奏与减字按非空位置对齐；控制字（泛起/泛止/少息）无声

## 文件

```
js/render.js      渲染：token → SVG（嵌套 <svg> 装槽位）
js/semantics.js   语义：token → 演奏动作
js/audio.js       音频：采样库 + 变调播放 + 音高表
js/player.js      播放：时间轴 + 调度 + 点读
js/input.js       输入：文本 → 减字合成
js/speech.js      语音识别
data/             glyph_parts / glyph_paths / category_rules / pitch（APK 原始数据 + 音高表）
audio/            21 条 WAV 采样（APK 提取）
scores/           谱面快照 + 索引
```
