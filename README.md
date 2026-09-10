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
- 本提交：blutter 反编译工具链就位（clang-cl 构建，Dart 3.12.2 libapp.so 全量符号产出）
