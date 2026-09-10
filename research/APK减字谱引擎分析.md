# guqin-master-android-v1.0.0.apk 分析笔记

APK 已解包到 `apk/extracted/`。来源标识：guqindashi.cn（古琴大师），应用内部包名
`lingling`（玲玲），Flutter 编写。

## 一、技术形态

- **Flutter (Dart AOT)**：逻辑全在 `lib/arm64-v8a/libapp.so`（11MB，release AOT 快照，
  未混淆——所有类名/方法名/`package:lingling/src/...` 路径可由 strings 直接提取）。
- **音频**：`flutter_soloud`（libflutter_soloud_plugin.so，低延迟混音引擎）播放
  内置 21 条真实录音（assets/audio/guqin/{open,pressed,harmonic}/string_1~7.wav，
  README 注明 48kHz 单声道、保留自然余音、录音规范：按音录七徽、泛音录七徽）。
- **`liblingling_aubio.so`**：移植了 aubio 库做**实时音高检测**（调音器 tuner /
  AI 听弹功能的底层）。
- 后端 Supabase（auth/realtime/postgrest），另有微信 SDK、支付、会员、AI 助手。

## 二、减字谱引擎（核心亮点）

引擎 = 三份数据文件 + 一组 Dart 类，纯数据驱动，无硬编码字形：

### 1. glyph_parts.json —— 141 个减字部件
每个部件：`{id, label(字), pinyin, svg 路径, categories(语法角色)}`。
角色如「左手」「息前字」「上部/下部」——即减字谱合成字的语法槽位。

### 2. glyph_paths.json —— 141 套矢量字形（191KB）
每个字的完整 SVG path（viewBox + paths + fill + transform），**App 内直接用
Canvas 按 path 绘制减字**，不依赖字体文件（fonts 里另有 Bravura 音乐字体用于别处）。

### 3. category_rules.json —— 99 条合成规则（42 模板 + 57 具名规则）
描述如何把多个部件**拼进一个 256×256 的方块**（减字谱「一字一音」的合成字）：
- 槽位式排版：`{slot: 上部/下部/涓字/number/…, x, y, lengthX, lengthY}`，
  即把部件放进指定象限/分区。
- 例：「涓（蠲）+数字」= 涓占上半、弦号占下半；「叠反半连+涓+数字」把上半
  再均分成 64 高的两条——正是传统减字谱的上下分层结构。
- 语法类别涵盖：撮、拨剌、滚拂、就、旁字、控制符、组合数字（含「十徽八分」
  双数字模板、「十三徽八分」三数字模板）等指法。

### 4. Dart 侧引擎类（符号可见）
- `JianziSemanticParser`：减字谱语义解析（把合成字/部件流解析成动作），
  产出 `ParsedJianziAction`。
- `JianziCandidateEngine` + `JianziCandidate/Bar`：**输入候选引擎**（打谱时给
  用户推荐下一个可能的减字组合，带词频服务 WordFrequencyService 持久化）。
- `MusicXmlJianziCandidateService/Selector`：从 MusicXML 乐谱生成减字候选。
- `PlayableJianziGlyph`：可播放的减字（连接到演奏引擎）。
- 排版/导出：`JianpuScore/Measure/Note/BeamValue/...`（简谱对象模型）、
  `JianpuParser`、`JianpuMusicXmlExporter`、`ScorePdfExportService`（PDF 导出）、
  `ScorePdfNotation`。

## 三、演奏内核（与网页版虚拟古琴对比）

| 模块 | 类（符号名） | 思路 |
|---|---|---|
| 定弦 | `GuqinTuning.fromSanfenSunyi` / `.standard` | **三分损益十二律**推导标准音高（黄钟/太簇/仲吕/林钟/南吕…），不是直接写死频率 |
| 徽位音高 | `HuiPitchTable` / `frequencyForHarmonicPosition` | 徽位→频率查找表 |
| 位置求解 | `GuqinPositionResolver` + `GuqinPositionCandidate` + `PentatonicHuiResolver` | 给定目标音高，求所有可行（弦，徽位）组合，五声音阶约束筛选 |
| 事件 | `GuqinNoteEvent` / `GuqinScheduledMusicEvent` / `GuqinGesture(Type)` / `GuqinTechnique` | 与网页版事件流同构：音+指法+时值 |
| 播放 | `GuqinSampleBank` / `GuqinSamplePlaybackEngine` / `GuqinSoloudAudioEngine` | 21 条采样 + soloud 低延迟播放（网页版 169 条采样 + Web Audio） |
| 演奏 | `GuqinPerformanceEngine` / `GuqinStage` / `GuqinSimulatorPage` | 谱面调度与琴面舞台 |
| 录制 | `GuqinAppRecorder` | 同网页版事件录制思路 |

差异要点：网页版音色库深得多（105 按音全音位真实录音 + morph 滑音 + 加谱余音合成）；
APK 版只录了 21 条基础采样（每弦散/按/泛各一），靠 playbackRate 变调铺满全音域，
但补上了**三分损益律学推导**、**位置求解器（一个音该用哪根弦哪个徽）**和完整的
**减字谱解析/合成/导出**——后者正是网页版没有的。

## 四、应用全貌（package:lingling/src/features/）

admin、ai_assist（AI 陪练）、auth、export（PDF/简谱导出）、fingering_animation
（指法动画）、guqin_simulator、import_musicxml（五线谱/简谱转减字谱）、
jianpu_musicxml、membership、ocr（**谱面 OCR 录入**）、playback、practice、
practice_calendar、practice_recording、profile、score_drafts、score_editor、
score_library、social、tanba、tipping、tuner（调音器，aubio 底层）、vr。

## 五、反编译边界

- Dart AOT release **不可还原为源码**（无中间字节码），但本包未混淆，
  类名/方法名/文件路径/字符串字面量全部可提取，配合数据 JSON 已足以完整理解架构。
- 可进一步：用 `strings`/Ghidra 看 libapp.so 具体函数实现；数据层 JSON 已经
  100% 可读可用。
- 数据文件可独立复用：glyph_paths.json（字形）+ category_rules.json（排版规则）
  + glyph_parts.json（部件语法）即可在任意平台重建减字谱渲染引擎。
