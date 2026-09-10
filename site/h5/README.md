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
js/hall.js        琴谱大厅：封面墙 + 阅读/播放视图
data/             glyph_parts / glyph_paths / category_rules / pitch / score_slugs（APK 原始数据 + 音高表 + 拼音 slug 表）
audio/            21 条 WAV 采样（APK 提取）
scores/           谱面快照 + 索引
scripts/          gen_slugs.py：从 corpus + hall_scores 生成拼音 slug 映射
```

## URL 静态链接

刷新不丢页面、可直接分享/收藏。URL 形如：

- `#/score/<拼音>` — 乐谱库中的谱（如 `#/score/jiukuang` = 酒狂）
- `#/hall/<拼音>`   — 琴谱大厅中的谱（如 `#/hall/gaoshanliushui` = 高山流水）

同名谱自动加 `-2` / `-3` 后缀。点击库/大厅中任意乐谱 → URL 自动更新；
手动改 URL → 切换乐谱（双向同步）。拼音 slug 由 `scripts/gen_slugs.py` 预生成
到 `data/score_slugs.json`，运行时只读取，无依赖。

## 更新：演奏 UI 与音色（fc59aed）

- 演奏页改为 APK 式布局：顶部横向滚动谱条（自动居中跟随、已读淡出、点读），
  下方琴面模拟器（按位朱砂点、泛音青环、散音拨弦光环、弦振动衰减动画）——`js/qin.js`
- 音色修正：滑音指数坡（弦长物理）、绰注 0.22~0.38s 滑入、
  吟 4.3Hz±0.6 半音 / 猱 2.4Hz±1 半音且音头 0.22s 干净后摆入
- 字形按槽位拉伸填充（preserveAspectRatio=none），与 APK 渲染一致
- 无弦号音符（掐起/带起/掩等）兜底沿用上一音弦位发声

## 待深挖（源码线索）

- APK「正在计算全曲弦徽」——GuqinPositionResolver 全曲位置求解（同音择弦逻辑）
- 「按弦音准偏差较大」——aubio 音高检测 + 逐字练评分算法
- `.gqp` 谱文件格式（APK 内出现「琴谱.gqp」）
- 技法解说词典（每个技法一句文言释义，libapp.so 内 utf16 字符串）

## 逆向成果对照（blutter 反编译 libapp.so · Dart 3.12.2）

jianzipu 引擎完整还原（详见 `research/project_memory.md`），关键差距：

### 已修复
- **抓起**：左手松开按弦 → 散音，`open=true`，用 `OPEN[s-1]`
- **掐起/带起**：手指按住弦拨响 → 按音，`open=false`，沿用 token 中的徽位（如名十掐起 = 十徽按弦）
- **按音音高公式**：`f = 散音 / 徽位比例`（APK `HuiPitchTable` 物理公式），非平均律
- **泛音音高公式**：APK `harmonicOrder` 按徽位查谐波次数
- **无徽位单字**（如擘六）：有弦号无徽位 → 散音
- **撮字弦号识别**：有散组时按音组末位数字是弦号；全按音时每组末位是弦号
- **十徽解析**：`digitsToHui('十')` 补全，原返回 null 兜底到七徽
- **历扫弦**：带徽位前缀（如大九历七六）→ 按音扫弦，逐弦按徽位算音高
- **落指吟/定吟**：识别为 carry 按音 + 吟猱揉弦，不吞音
- **反复展开**：`括号`/`从括号再作` 为零时长控制符，自动展开反复段
- **节奏对齐**：按位置对齐减字与节奏，blank 节奏沿用前一非空节奏（非过滤后索引对齐）

### 待对照修复（APK `JianziSemanticParser` 行为）
- **走手音徽位推断**：APK `_inferHui` 用中文数字 1/20 细分系统，H5 `digitsToHui` 是十分制
- **三分损益 12 律**：APK 完整 12 律比例，H5 只有黄钟基频
- **104 种复合指法**：APK 有完整释义字典，H5 只识别基础指法 + 少量复合
- **同音择弦**：APK `GuqinPositionResolver` 全曲位置求解，H5 无
