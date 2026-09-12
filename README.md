# guqin_emu · 古琴模拟器研究工作区

两个古琴应用的完整逆向研究 + 一个可运行的 H5 复刻引擎。

## 目录

- **site/** —— udywang.com「虚拟古琴」（王悠荻）整站本地镜像
  - `node server.js 8080` 启动，含本地 API 实现（演奏库/点赞/地图）
  - 演奏内核源码（明文 JS）、169 条真实采样、131 条社区演奏事件流快照
- **site/h5/** —— 「古琴大师」APK 的 H5 复刻引擎（自研，零依赖）
  - 减字渲染 / 语义解析 / 采样音频 / 播放调度 / 打字与语音转减字 / 作曲编辑
  - 详见 `site/h5/README.md`
- **apk/** —— 古琴大师 APK 解包与数据
  - `extracted/assets/flutter_assets/assets/data/` 减字谱引擎三件套 JSON
  - `scores/` 云端曲库全量 87 份谱面快照（含目录）
- **research/** —— 研究报告与逆向工具链
  - `研究报告.md` 网站版架构与音源体系
  - `算法研究.md` 演奏内核算法（采样代理/加谱余音/morph 滑音/音游判定）
  - `APK减字谱引擎分析.md` Flutter 侧类结构与数据格式
  - `曲库与付费体系分析.md` 商业模型与后端结构
  - `作者信息.md` 王悠荻（中国首位古琴演奏博士）履历与 AI 释谱研究脉络
  - 逆向脚本：`elf_string_refs*.py`（ELF 字串引用扫描）、`frida_hook.py` + `dump_modules.js`（运行时模块/符号导出）、`pyghidra_*.py`（Ghidra 自动化批处理）
  - 模拟器自动化：`boot_frida_app.ps1`（启动 AVD + frida-server + App）、`center_emu.ps1`（PowerShell + Win32 SetWindowPos 居中 qemu 窗口）
  - `blutter_out/`：blutter 反编译产出（**clang-cl 构建**，MSVC 14.29 不支持 Dart 3.12.2 的 `__VA_OPT__`）
    - `blutter_frida.js` 带 Dart 函数符号的 Frida hook 模板
    - `pp.txt` 对象池（含 jianzipu 引擎字符串与字面量的精确引用）
    - `objs.txt` Dart 对象/方法/字段列表
    - `ida_script/` IDA Pro 符号导入脚本

## 运行

```
cd site && node server.js 8080
# 网站镜像:  http://localhost:8080/guqin/?entry=free&lang=zh
# H5 引擎:   http://localhost:8080/h5/
# 世界地图:  http://localhost:8080/world-map?lang=zh
```

## 版本记录

- `bbbabc2` 镜像 + 逆向分析基线
- `018858e` H5 减字谱引擎（渲染/语义/音频/播放/输入/编辑全链路）
- `fc59aed` APK 式演奏 UI（谱条+琴面动画）与滑音/颤音音色修正
- blutter 反编译工具链就位（clang-cl 构建，Dart 3.12.2 libapp.so 全量符号产出）
- `aa235c5` **媒体文件大恢复**：此前会话执行数据集清理命令时作用域误写成仓库根目录，
  219 个媒体文件（`site/h5/audio` 21 个 APK 采样、`site/h5/img`、`site/h5/community/covers`
  30 个封面、`site/guqin/audio` 161 个教授采样、research 附图）被整仓扫删。
  APK 采样从 `apk/` 原包重新解包，其余从 git 索引恢复。详见下方「事故记录」。
  同批：教授音源采样路径改指 `../guqin/audio/{open,pressed,harm}`；
  AI 曲库 `/api/gen-scores` 落盘 + 💾同步按钮；曲名长度 1~8 字分布；
  曲风提示词本地模糊匹配（同义词+bigram Jaccard，无外部 API）。
- `6013f24` 随机生成引擎回退：LSTM 轮廓/曲风偏置生成的曲目质量差，
  回退为旧版 ngram + 拱形轮廓引擎。LSTM 推理代码与曲风匹配保留未删，仅不再调用。

## 事故记录（防止重演）

### 2026-09-11 · 清理脚本误删整仓媒体文件
- **起因**：为学习民歌声乐特征，写了 `download_datasets.ps1` 下载 1 万首民歌
  musicxml 数据集（约 292MB，存 `D:\temp_extract\folk\`，不进库）。脚本第 35-36 行
  有一段"清理非 xml/midi 文件"：`Get-ChildItem -Recurse -Include *.mp3,*.png,*.jpg,*.wav,*.pdf | Remove-Item -Force`
- **事故**：该清理模式实际执行时作用域是**仓库根目录**而非数据集目录，
  一次性扫删全仓 219 个媒体文件（音频采样、封面图、研究截图）。
  因从未提交删除动作，git 日志查不到"凶手"，排查了很久。
- **恢复**：APK 21 个采样从 `apk/` 原包重解；教授 161 个采样与封面从 git 恢复；
  `aa235c5` 一次性提交全部恢复结果。
- **教训**：
  1. **删除类命令必须用绝对路径**指向目标目录，禁止对仓库根递归 `Remove-Item`
  2. 清理外部数据集一律在**仓库外**的临时目录（`D:\temp_extract\`）进行
  3. 大批量删除前先 `git status` 确认，删除后立即 commit，留下恢复点
  4. 此脚本已从仓库移除，数据集留在仓库外的 `D:\temp_extract\folk\`

### 数据落地（民歌学习产物，全部小型精华文件）
- `site/h5/data/folk_titles.json`（228KB）9260 个去重民歌名 → 防雷同禁止集合
- `site/h5/data/folk_melody_stats.json` / `guqin_melody_stats.json`（各 ~2KB）音程转移/节奏型/调式统计
- `site/h5/data/melody_lstm_weights.json`（680KB）LSTM 权重（当前引擎已不使用，保留备用）
- `scripts/train_melody_lstm.py` PyTorch 训练脚本（CUDA，15 epochs，loss 2.76→1.70）
