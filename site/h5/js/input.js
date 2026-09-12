/* 打字→减字合成引擎：中文文本（"大七挑四" "散勾三" "泛起"）→ jianzi token
 * 词典来自 glyph_parts；排版：优先复用语料库同签名 slotTransforms，否则程序化布局 */
(function () {
  'use strict';
  let parts = [];            // glyph_parts
  let byLabel = {};          // label -> part
  let byPinyin = {};
  let signatures = {};       // categorySeq -> {partIds, slotTransforms, text}

  const CTRL_WORDS = ['泛起', '泛止', '少息', '曲终', '从头', '再作', '应合', '分开', '进复', '退复', '掐起', '带起', '抓起', '如一'];
  // 配对控制符：end → start（结尾词必须有对应的开头词先出现）
  const PAIRS = { '泛止': '泛起', '再作': '从头', '分开': '应合' };
  const PAIR_STARTS = new Set(Object.values(PAIRS));
  const PAIR_ENDS = new Set(Object.keys(PAIRS));
  const NUMSTR = '一二三四五六七八九十半';

  // n-gram 语言模型：从语料库学习减字序列转移概率
  let ngramModel = null;
  let titlePool = [];
  // 古诗词词根库（避免 AI 曲名与曲库/大厅雷同）
  let lexicon = null;
  function setLexicon(data) { lexicon = data || null; }
  // 旋律统计特征 + LSTM 权重（由 app 注入）
  let melodyStats = null;      // 融合民歌+古琴的统计特征
  let lstm = null;             // {meta, W} LSTM 权重（Float32Array 矩阵）
  function setMelodyStats(s) { melodyStats = s || null; }
  function setLSTM(data) {
    if (!data) { lstm = null; return; }
    const meta = data.meta || {};
    const W = {};
    for (const k of Object.keys(data.weights || {})) {
      const w = data.weights[k];
      W[k] = { shape: w.shape, data: new Float32Array(w.data) };
    }
    lstm = { meta, W };
  }
  // 兜底硬编码词根（词库未注入时使用）
  const FALLBACK_PREFIXES = ['空山', '秋水', '孤鸿', '寒江', '冷月', '清风', '暮雨', '疏影', '暗香', '远岫', '平沙', '落雁', '行云', '流水', '幽兰', '白雪'];
  const FALLBACK_SUFFIXES = ['引', '操', '吟', '弄', '歌', '行', '调', '曲', '慢', '意', '谣', '叹'];
  // 古琴散音频率（正调）
  const OPEN_FREQ = [65.41, 73.59, 88.40, 98.12, 110.38, 130.82, 147.17];
  const HUI_RATIO = { 一:0.125, 二:0.1667, 三:0.2, 四:0.25, 五:0.3333, 六:0.4, 七:0.5, 八:0.6, 九:0.6667, 十:0.75 };
  const STR_NUM = { 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7 };
  // 从 token text 估算音高频率（用于音高连续性约束）
  function estimateFreq(text) {
    if (!text) return 0;
    const san = text.startsWith('散');
    const fan = text.startsWith('泛');
    const chs = [...text];
    // 提取弦号
    let string = 0;
    for (const c of chs) if (STR_NUM[c]) string = STR_NUM[c];
    if (!string) return 0;
    const openF = OPEN_FREQ[string - 1] || 0;
    if (!openF) return 0;
    if (san) return openF;
    // 提取徽位
    let hui = null;
    for (const c of chs) if (HUI_RATIO[c]) { hui = c; break; }
    if (!hui) return openF; // 缺徽位，按散音近似
    if (fan) {
      const harm = { 一:8, 二:6, 三:5, 四:4, 五:3, 六:5, 七:2, 八:5, 九:3, 十:4 }[hui] || 2;
      return openF * harm;
    }
    return openF / HUI_RATIO[hui];
  }

  function buildNgram(corpusScores) {
    const unigram = {};          // token text → count
    const bigram = {};           // prev text → { next text: count }
    const trigram = {};          // "prev1|prev2" → { next text: count }
    const tokenStore = {};       // token text → token object (cloneable)
    const freqStore = {};        // token text → estimated frequency
    const phraseStart = {};      // 乐句开头 token 分布
    const phraseEnd = {};        // 乐句结尾 token 分布
    const sectionDist = { start: {}, middle: {}, end: {} }; // 段落 unigram 分布
    (corpusScores || []).forEach(s => {
      const sc = s.score_content && s.score_content.score; if (!sc) return;
      const allLines = (sc.lines || []).filter(l => (l.jianziTokens || []).some(t => t.kind === 'jianzi' && t.text));
      const lineCount = allLines.length;
      allLines.forEach((l, li) => {
        const toks = l.jianziTokens.filter(t => t.kind === 'jianzi' && t.text);
        if (toks.length < 2) return;
        // 乐句开头/结尾
        phraseStart[toks[0].text] = (phraseStart[toks[0].text] || 0) + 1;
        phraseEnd[toks[toks.length - 1].text] = (phraseEnd[toks[toks.length - 1].text] || 0) + 1;
        // 段落分类：开头2行 / 中间 / 结尾2行
        let sec = 'middle';
        if (li < 2) sec = 'start';
        else if (li >= lineCount - 2) sec = 'end';
        for (let i = 0; i < toks.length; i++) {
          const t = toks[i].text;
          unigram[t] = (unigram[t] || 0) + 1;
          sectionDist[sec][t] = (sectionDist[sec][t] || 0) + 1;
          if (!tokenStore[t]) {
            tokenStore[t] = JSON.parse(JSON.stringify(toks[i]));
            freqStore[t] = estimateFreq(t);
          }
          if (i > 0) {
            const prev = toks[i - 1].text;
            if (!bigram[prev]) bigram[prev] = {};
            bigram[prev][t] = (bigram[prev][t] || 0) + 1;
          }
          if (i > 1) {
            const p1 = toks[i - 2].text, p2 = toks[i - 1].text;
            const key = p1 + '|' + p2;
            if (!trigram[key]) trigram[key] = {};
            trigram[key][t] = (trigram[key][t] || 0) + 1;
          }
        }
      });
    });
    return { unigram, bigram, trigram, tokenStore, freqStore, phraseStart, phraseEnd, sectionDist };
  }
  function weightedPick(dist) {
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [k, v] of Object.entries(dist)) { r -= v; if (r <= 0) return k; }
    return Object.keys(dist)[0];
  }

  function init(glyphParts, corpusScores) {
    parts = glyphParts;
    parts.forEach(p => { byLabel[p.label] = p; (p.pinyin || []).forEach(py => { byPinyin[py] = p; }); });
    // 语料签名库
    (corpusScores || []).forEach(s => {
      const sc = s.score_content && s.score_content.score; if (!sc) return;
      (sc.lines || []).forEach(l => (l.jianziTokens || []).forEach(tok => {
        if (tok.kind !== 'jianzi' || !tok.slotTransforms) return;
        const sig = (tok.categorySlots || []).join(',');
        if (!signatures[sig]) signatures[sig] = { partIds: tok.partIds, slotTransforms: tok.slotTransforms, text: tok.text };
      }));
    });
    // 构建 n-gram 模型
    ngramModel = buildNgram(corpusScores);
    // 收集语料库标题用于命名学习
    titlePool = (corpusScores || []).map(s => s.title).filter(t => t && t.length <= 10);
  }

  function normalize(text) {
    return text
      .replace(/[，,。.、;；\s]+/g, ' ')
      .replace(/[0-9０-９]/g, ch => '零一二三四五六七八九'[+ch] || ch)
      .replace(/散音|散按/g, '散')
      .replace(/泛音/g, '泛')
      .trim();
  }

  /* 文本 → token 单元序列 */
  function tokenize(text) {
    const s = normalize(text);
    const units = [];
    let i = 0;
    while (i < s.length) {
      if (s[i] === ' ') { i++; continue; }
      let matched = null, len = 0;
      for (const w of CTRL_WORDS) if (s.startsWith(w, i) && w.length > len) { matched = w; len = w.length; }
      if (matched) { units.push({ word: matched }); i += len; continue; }
      const p = byLabel[s[i]];
      if (p) { units.push({ part: p }); i++; continue; }
      i++; // 丢弃无法识别的字
    }
    return units;
  }

  function cats(p) { return p.categories || []; }
  function isTech(p) { return cats(p).some(c => ['勾剔摘', '挑托', '抹', '打', '擘', '历', '涓字', '轮字', '弹字', '拂字', '滚字', '拨字', '剌字', '掐撮三声掐', '掐撮三声撮', '撮'].includes(c)); }
  const SWEEP = new Set(['历', '滚', '拂']);      // 需要两个弦号（起弦至止弦）
  const JOIN_WORDS = new Set(['掐起', '带起', '抓起']); // 可并入前置按位
  function isNum(p) { return cats(p).includes('number') || NUMSTR.includes(p.label); }
  function isFinger(p) { return cats(p).includes('左手'); }

  /* 程序化布局：上=修饰条，中上=指/徽，下半=技法，弦号叠右下 */
  function proceduralLayout(units, roles) {
    const tr = [];
    const mods = units.map((u, i) => ({ u, r: roles[i] })).filter(x => x.r === 'mod' || x.r === 'slide');
    const finger = units.map((u, i) => ({ u, r: roles[i] })).find(x => x.r === 'finger');
    const hui = units.map((u, i) => ({ u, r: roles[i] })).filter(x => x.r === 'hui');
    const tech = units.map((u, i) => ({ u, r: roles[i] })).find(x => x.r === 'tech');
    const str = units.map((u, i) => ({ u, r: roles[i] })).find(x => x.r === 'string');
    mods.forEach((m, i) => tr.push({ x: i * (256 / mods.length), y: 0, lengthX: 256 / mods.length, lengthY: 56 }));
    if (finger && hui.length) {
      tr.push({ x: 0, y: 56, lengthX: 128, lengthY: 72 });
      hui.forEach(() => tr.push({ x: 128, y: 56, lengthX: 128, lengthY: 72 }));
    } else {
      const grp = finger ? [finger, ...hui] : hui;
      grp.forEach(() => tr.push({ x: finger && grp.length === 1 ? 0 : (finger ? (tr.length % 2) * 128 : 0), y: 56, lengthX: grp.length > 1 ? 128 : 256, lengthY: 72 }));
    }
    if (tech) tr.push({ x: 32, y: 128, lengthX: 192, lengthY: 128 });
    if (str) tr.push({ x: 140, y: 168, lengthX: 88, lengthY: 88 });
    while (tr.length < units.length) tr.push({ x: 0, y: 56, lengthX: 256, lengthY: 72 });
    return tr.slice(0, units.length);
  }

  /* 语法校验：判断当前部件组合是否构成合法减字 */
  function isValidStructure(cur, roles) {
    if (!cur.length) return false;
    const cats = cur.map(u => slotOf(u));
    // 控制符/单字：直接合法
    const hasTech = roles.includes('tech');
    const hasFinger = roles.includes('finger');
    const hasHui = roles.includes('hui');
    const hasString = roles.includes('string');
    const hasSlide = roles.includes('slide');
    const hasYan = roles.includes('yan');
    const hasSan = cats.includes('散');
    const hasFan = cats.includes('泛');
    const hasCuo = cats.includes('撮');

    // 散音：散 + 技法 + 弦号（必须无左手指/徽位）
    if (hasSan && !hasFinger && !hasHui) return hasTech && hasString;
    // 泛音：泛 + (左手指+徽位) + 技法 + 弦号
    if (hasFan && hasFinger && hasHui) return hasTech && hasString;
    // 撮：撮本身即技法，可撚按+散、按+按、散+散等组合，含数字（徽/弦）即合法
    if (hasCuo) return cur.some(u => isNum(u));
    // 掩：左手拇指击弦，只能 掩 + 单弦号（不配徽位、不配其他左手指、不多弦）
    if (hasYan) return !hasFinger && !hasHui && roles.filter(r => r === 'string').length === 1;
    // 按音：左手指 + 徽位 + 技法
    // - carry技法（掐/带/抓）可无弦号；普通右手指法必须有弦号
    // - 徽位可缺省（沿用前一徽位，默认七徽）
    const CARRY_TECHS = ['掐', '带', '抓'];
    const hasCarry = cur.some((u, i) => roles[i] === 'tech' && CARRY_TECHS.includes(u.label));
    if (hasFinger && hasTech) return hasCarry ? true : hasString;
    // 滑音：上/下 + 徽位
    if (hasSlide && hasHui && !hasTech) return true;
    // 左手独立技法（如抓起/带起已在 control 处理）
    if (hasFinger && !hasTech && !hasString && !hasHui) return false;
    // 纯技法 + 弦号（无左手无散：不合法，按音必须有指/徽）
    return false;
  }

  /* 主入口：文本 → token 数组（可能多字） */
  function compose(text) {
    const units = tokenize(text);
    const tokens = [];
    let cur = [], roles = [];
    const flush = () => {
      if (!cur.length) return;
      let parts = cur.slice(), partRoles = roles.slice();
      // 按音缺徽位：注入默认徽位（七徽），沿用前值
      const hasFinger = partRoles.includes('finger');
      const hasHui = partRoles.includes('hui');
      const hasTech = partRoles.includes('tech');
      if (hasFinger && hasTech && !hasHui) {
        const huiPart = byLabel['七'];
        if (huiPart) {
          // 徽位插入到 finger 之后、tech 之前
          const insIdx = partRoles.indexOf('finger') + 1;
          parts.splice(insIdx, 0, huiPart);
          partRoles.splice(insIdx, 0, 'hui');
        }
      }
      const partIds = parts.map(u => u.id);
      const categorySlots = parts.map(u => slotOf(u));
      const sigKey = categorySlots.join(',');
      const sig = signatures[sigKey];
      const valid = isValidStructure(parts, partRoles);
      if (valid) {
        tokens.push({
          code: 'input:' + cur.map(u => u.label).join(''),
          kind: 'jianzi',
          text: cur.map(u => u.label).join(''),
          partIds,
          categorySlots,
          slotTransforms: sig ? clone(sig.slotTransforms) : proceduralLayout(parts, partRoles)
        });
      }
      cur = []; roles = [];
    };
    let techSeen = false, sweepMode = false, cuoMode = false, strSeen = 0;
    for (const u of units) {
      if (u.word) {
        // 掐起/带起/抓起：若前面已有按位（左手/徽），并入当前字
        if (JOIN_WORDS.has(u.word) && cur.length && roles.includes('finger')) {
          const p0 = byLabel[u.word[0]], p1 = byLabel[u.word[1]];
          if (p0) cur.push(p0), roles.push('tech');
          if (p1) cur.push(p1), roles.push('mod');
          flush(); techSeen = false; sweepMode = cuoMode = false; strSeen = 0;
          continue;
        }
        flush(); techSeen = false; sweepMode = cuoMode = false; strSeen = 0;
        const ids = [...u.word].map(ch => byLabel[ch] && byLabel[ch].id).filter(Boolean);
        tokens.push({ code: 'ctrl:' + u.word, kind: 'jianzi', text: u.word, partIds: ids,
          categorySlots: ids.map(id => slotOf(byLabel[[...u.word].find(c => byLabel[c] && byLabel[c].id === id)])),
          slotTransforms: ids.length === 2 ? [{ x: 50, y: 50, lengthX: 156, lengthY: 74 }, { x: 50, y: 124, lengthX: 156, lengthY: 132 }] : proceduralLayout(ids.map(id => byLabel[id]), ids.map(id => 'mod')) });
        continue;
      }
      const p = u.part;
      let role;
      // 走手音字（上/下+徽）在遇到新的指/法/修饰时结束
      if (roles.includes('slide') && (isFinger(p) || isTech(p) || cats(p).includes('撮') || isNum(p) === false)) {
        if (!isNum(p)) flush();
      }
      if (isFinger(p)) role = 'finger';
      else if (cats(p).includes('撮')) { flush(); role = 'mod'; cuoMode = true; strSeen = 0; }
      else if (isTech(p)) {
        role = 'tech'; techSeen = true;
        sweepMode = SWEEP.has(p.label); strSeen = 0;
      }
      else if (isNum(p)) role = techSeen ? 'string' : 'hui';
      else if (p.label === '至') {
        // 滚一至六：至并入当前字，其后的数字仍按弦号处理
        cur.push(p); roles.push('mod'); sweepMode = true;
        continue;
      }
      else if (p.label === '掩') { role = 'yan'; techSeen = true; } // 掩：左手拇指击弦，后接数字为弦号
      else role = 'mod';
      // 上/下滑音：遇「上/下」先 flush
      if (cats(p).includes('上下')) { flush(); techSeen = false; role = 'slide'; }
      cur.push(p); roles.push(role);
      if (role === 'string') {
        strSeen++;
        // 撮需两个弦号；滚拂历（或带「至」）需两个弦号；普通技法一个即成字
        const needTwo = cuoMode || sweepMode;
        if (!needTwo || strSeen >= 2) { flush(); techSeen = false; sweepMode = cuoMode = false; strSeen = 0; }
      }
      if (role === 'slide') techSeen = false;
    }
    flush();
    return tokens;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function slotOf(p) {
    const c = cats(p);
    if (c.includes('左手')) return '左手';
    if (c.includes('散')) return '散';
    if (c.includes('泛')) return '泛';
    if (c.includes('number')) return 'number';
    if (c.includes('上下')) return '上下';
    for (const t of ['勾剔摘', '挑托', '抹', '打', '擘', '历', '涓字', '轮字', '弹字', '拂字', '滚字', '拨字', '剌字', '撮', '绰', '注', '吟字', '猱字', '撞字', '修饰', '控制符']) {
      if (c.includes(t)) return t;
    }
    return '单字';
  }

  /* 配对控制符校验：扫描所有控制词，确保结尾词有对应的开头词且未被关闭，且区间非空 */
  function checkPairs(text) {
    const s = normalize(text);
    if (!s) return { ok: true, open: new Set() };
    // 提取所有控制词及其位置
    const words = [];
    let i = 0;
    while (i < s.length) {
      if (s[i] === ' ') { i++; continue; }
      let matched = null, len = 0;
      for (const w of CTRL_WORDS) if (s.startsWith(w, i) && w.length > len) { matched = w; len = w.length; }
      if (matched) { words.push({ w: matched, start: i, end: i + len }); i += len; continue; }
      i++;
    }
    const open = new Set();       // 未关闭的开头词
    const openStart = {};         // 开头词在文本中的起始位置
    const hasContent = {};        // 开头词之后是否出现了非控制内容
    for (const { w, start, end } of words) {
      // 先更新所有未关闭开头词的内容标记：检查此控制词之前是否有非控制内容
      for (const sw of open) {
        const segStart = openStart[sw];
        const segEnd = start;
        if (segEnd > segStart) {
          const between = s.slice(segStart, segEnd);
          if (between.replace(/[\s]/g, '').length > 0) hasContent[sw] = true;
        }
        openStart[sw] = end; // 下一段从此控制词之后开始
      }
      if (PAIR_STARTS.has(w)) {
        open.add(w);
        openStart[w] = end;
        hasContent[w] = false;
      } else if (PAIR_ENDS.has(w)) {
        const startWord = PAIRS[w];
        if (!open.has(startWord)) return { ok: false, error: `「${w}」前缺少对应的「${startWord}」`, open };
        if (!hasContent[startWord]) return { ok: false, error: `「${startWord} ${w}」之间没有音符，空区间无意义`, open };
        open.delete(startWord);
      }
    }
    return { ok: true, open };
  }

  /* 实时语法校验：返回错误信息字符串，无错返回 null */
  function validate(text) {
    const s = normalize(text);
    if (!s) return null;
    // 配对控制符校验
    const pairCheck = checkPairs(text);
    if (!pairCheck.ok) return pairCheck.error;
    const segments = s.split(/\s+/).filter(Boolean);
    for (const seg of segments) {
      // 控制词直接合法
      if (CTRL_WORDS.includes(seg)) continue;
      const toks = compose(seg);
      // 检查整段是否被完全消费（compose 可能丢弃非法尾部）
      const consumed = toks.map(t => t.text).join('');
      if (consumed !== seg) {
        const dropped = seg.slice(consumed.length);
        return `「${seg}」中「${dropped}」无法识别`;
      }
      if (toks.length === 0) {
        // 分析具体原因
        const units = tokenize(seg);
        const labels = units.map(u => u.part ? u.part.label : u.word).join('');
        const cats = units.map(u => u.part ? slotOf(u.part) : '控制符');
        const hasSan = cats.includes('散');
        const hasFan = cats.includes('泛');
        const hasFinger = cats.includes('左手');
        const hasTech = cats.some(c => ['勾剔摘', '挑托', '抹', '打', '擘', '历'].includes(c));
        const hasNum = cats.includes('number');
        if (hasSan && hasFinger) return `「${labels}」错误：散音不能与左手指（大食中名）同用`;
        if (hasFinger && !hasTech) return `「${labels}」错误：缺少右手指法（挑勾打摘等）`;
        if (hasTech && !hasNum) return `「${labels}」错误：缺少弦号（一二三四五六七）`;
        if (!hasSan && !hasFan && !hasFinger && hasTech) return `「${labels}」错误：按音需左手指+徽位，散音需加「散」`;
        return `「${labels}」不是合法减字，应为「指+徽+技法+弦」或「散+技法+弦」`;
      }
    }
    return null;
  }

  /* 判断文本是否是某个合法减字的前缀（用于按键可用性预测） */
  function isValidPrefix(text) {
    const s = normalize(text);
    if (!s) return true;
    // 配对控制符校验：结尾词必须有对应的未关闭开头词
    const pairCheck = checkPairs(text);
    if (!pairCheck.ok) return false;
    const segments = s.split(/\s+/).filter(Boolean);
    for (const seg of segments) {
      if (CTRL_WORDS.some(w => w === seg || w.startsWith(seg))) continue;
      if (JOIN_WORDS.has(seg)) continue;
      if (!isSegmentPrefix(seg)) return false;
    }
    return true;
  }

  /* 判断结尾控制词当前是否可用（需有对应的未关闭开头词） */
  function canUseEndWord(text, endWord) {
    const start = PAIRS[endWord];
    if (!start) return true; // 非配对词
    const pairCheck = checkPairs(text);
    return pairCheck.ok && pairCheck.open.has(start);
  }

  // 分析单个减字段的角色序列，判断是否是合法模式的前缀
  function isSegmentPrefix(seg) {
    const units = tokenize(seg);
    if (!units.length) return true;
    const roles = [];
    let techSeen = false;
    for (const u of units) {
      if (u.word) {
        // JOIN_WORDS（掐起/带起/抓起）可附着在前序按音之后
        if (JOIN_WORDS.has(u.word)) {
          if (roles.includes('finger') && roles.includes('hui')) { roles.push('tech'); continue; }
          return false;
        }
        // 其他控制词单独成段，不能与其他部件混排
        return units.length === 1;
      }
      const p = u.part;
      const lab = p.label;
      let role;
      if (lab === '掩') { role = 'yan'; techSeen = true; }            // 掩：后接数字为弦号
      else if (cats(p).includes('引绰注淌浒')) role = 'preslide';   // 绰/注：前置滑音
      else if (['吟', '猱', '撞'].includes(lab)) role = 'ornament';  // 吟/猱/撞：后置装饰音
      else if (isFinger(p)) role = 'finger';
      else if (cats(p).includes('撮')) role = 'cuo';
      else if (isTech(p)) { role = 'tech'; techSeen = true; }
      else if (isNum(p)) role = techSeen ? 'string' : 'hui';
      else if (cats(p).includes('散')) role = 'san';
      else if (cats(p).includes('泛')) role = 'fan';
      else if (cats(p).includes('上下')) role = 'slide';
      else continue; // 其他修饰符忽略
      roles.push(role);
    }
    // 合法模式的角色序列（完整）
    const PATTERNS = [
      ['san', 'tech', 'string'],                       // 散音
      ['fan', 'finger', 'hui', 'tech', 'string'],       // 泛音
      ['finger', 'hui', 'tech', 'string'],              // 按音
      ['finger', 'tech', 'string'],                     // 按音 carry（缺徽位，沿用前值）
      ['finger', 'tech'],                               // 按音 carry+掐起（缺徽位）
      ['finger', 'hui', 'tech'],                        // 按音 carry（掐起等）
      ['finger', 'hui', 'ornament', 'tech', 'string'],  // 按音+吟猱撞（在技法前）
      ['finger', 'ornament', 'tech', 'string'],         // 按音+吟猱撞（缺徽位）
      ['finger', 'hui', 'ornament', 'tech'],            // 按音 carry+吟猱撞
      ['finger', 'hui', 'tech', 'string', 'ornament'],  // 按音+吟猱撞（在弦后）
      ['finger', 'tech', 'string', 'ornament'],         // 按音+吟猱撞（缺徽位，弦后）
      ['preslide', 'finger', 'hui', 'tech', 'string'],  // 绰/注+按音
      ['preslide', 'finger', 'hui', 'ornament', 'tech', 'string'], // 绰注+吟猱撞+按音
      ['slide', 'hui'],                                 // 上/下滑音
      ['yan', 'string'],                                // 掩+弦（拇指击散音，不配徽位）
    ];
    // 撮：撮开头后含任意数字组合均合法
    if (roles[0] === 'cuo') {
      return roles.slice(1).some(r => r === 'string' || r === 'hui') || roles.length === 1;
    }
    // 检查是否是某模式的前缀
    return PATTERNS.some(pat => {
      if (roles.length > pat.length) return false;
      return roles.every((r, i) => r === pat[i]);
    });
  }

  /* 基于语料库 n-gram 模型随机生成一句合法减字词组 */
  function randomPhrase() {
    if (!ngramModel || Object.keys(ngramModel.unigram).length === 0) {
      return fallbackRandom();
    }
    const { unigram, bigram } = ngramModel;
    // 排除重复标志
    const REPEAT = new Set(['从头', '再作', '应合', '分开']);
    const starts = Object.fromEntries(Object.entries(unigram).filter(([k]) => !REPEAT.has(k)));
    const count = 4 + Math.floor(Math.random() * 5);
    const tokens = [];
    let prev = weightedPick(starts);
    tokens.push(prev);
    for (let i = 1; i < count; i++) {
      const trans = bigram[prev];
      let next;
      if (trans) {
        const filtered = Object.fromEntries(Object.entries(trans).filter(([k]) => !REPEAT.has(k)));
        next = Object.keys(filtered).length ? weightedPick(filtered) : weightedPick(starts);
      } else {
        next = weightedPick(starts);
      }
      tokens.push(next);
      prev = next;
    }
    // 偶尔插入少息
    if (Math.random() < 0.3) tokens.splice(1 + Math.floor(Math.random() * (tokens.length - 1)), 0, '少息');
    return tokens.join(' ');
  }

  // 语料库节奏分布（八分52%/十六分22.4%/四分20.1%/二分4.5%/三十二分0.7%/全音0.4%）
  const RHYTHM_DIST = { eighth: 520, sixteenth: 224, quarter: 201, half: 45, thirtySecond: 7, whole: 4 };
  function pickRhythmDist(slow) {
    if (!slow || slow === 1) return weightedPick(RHYTHM_DIST);
    // 放缓：增加长音符权重，减少短音符
    const dist = {};
    for (const k of Object.keys(RHYTHM_DIST)) {
      const base = RHYTHM_DIST[k];
      if (k === 'eighth' || k === 'sixteenth' || k === 'thirtySecond') dist[k] = base / slow;
      else dist[k] = base * slow;
    }
    return weightedPick(dist);
  }

  // 语料库音程分布权重（半音数→权重，来自87首统计）
  const INTERVAL_WEIGHT = {
    0: 151, 1: 25, 2: 158, 3: 85, 4: 70, 5: 88, 6: 14, 7: 70,
    8: 31, 9: 32, 10: 35, 11: 6, 12: 51, 13: 5, 14: 37, 15: 8
  };
  function intervalWeight(semi) {
    const a = Math.abs(Math.round(semi));
    if (a <= 15) return INTERVAL_WEIGHT[a] || 1;
    return Math.max(1, 50 * Math.pow(0.85, a - 15)); // 大跳快速衰减
  }

  // 五声音阶偏好（C/D/E/G/A 为主，偏音降权）
  const PENTATONIC = new Set(['C','D','E','G','A']);
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  function freqToNoteName(f) {
    if (!f) return null;
    const midi = 69 + 12 * Math.log2(f / 440);
    return NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12];
  }

  function classifyToken(text) {
    if (!text) return 'other';
    if (text.startsWith('泛')) return 'fan';
    if (text.startsWith('散')) return 'san';
    if (text.startsWith('撮')) return 'cuo';
    if (text.startsWith('历')) return 'li';
    if (text.includes('吟')) return 'yin';
    if (text.includes('猱')) return 'nao';
    if (text.includes('撞')) return 'zhuang';
    if (text.startsWith('绰')) return 'chuo';
    if (text.startsWith('注')) return 'zhu';
    if (text.startsWith('上')) return 'shang';
    if (text.startsWith('下')) return 'xia';
    if (text === '掐起') return 'qia';
    if (text === '带起') return 'dai';
    if (text === '抓起') return 'zhua';
    if (text.startsWith('掩')) return 'yan';
    return 'an';
  }

  /* 生成带节奏的 token 序列，生成完整乐句（trigram + 乐句结构 + 拱形音高 + 音乐规律）。
   * style: 曲风参数（来自 parseStylePrompt），可选 */
  function randomPhraseTokens(targetLen, section, globalPos, style) {
    if (!ngramModel || Object.keys(ngramModel.unigram).length === 0) {
      return fallbackRandomTokens();
    }
    const { unigram, bigram, trigram, tokenStore, freqStore, phraseStart, phraseEnd, sectionDist } = ngramModel;
    const REPEAT = new Set(['从头', '再作', '应合', '分开']);
    const starts = Object.fromEntries(Object.entries(unigram).filter(([k]) => !REPEAT.has(k)));
    const count = targetLen || (8 + Math.floor(Math.random() * 9));
    const sec = section || 'middle';
    // 用 LSTM 生成旋律轮廓（MIDI 序列），作为每个音的 targetMidi
    const lstmMelody = lstm ? generateMelodyByLSTM(count, style) : null;
    const secDist = sectionDist[sec] || {};
    const gp = globalPos != null ? globalPos : 0.5;
    // 拱形目标 MIDI：开头59 → 中间低谷56.8 → 结尾回升59
    const archMidi = 59 - 2.2 * Math.sin(gp * Math.PI);
    const result = [];
    let startDist;
    if (sec === 'start' && Object.keys(phraseStart).length > 0) {
      startDist = Object.fromEntries(Object.entries(phraseStart).filter(([k]) => !REPEAT.has(k)));
    } else if (Object.keys(secDist).length > 0) {
      startDist = Object.fromEntries(Object.entries(secDist).filter(([k]) => !REPEAT.has(k)));
    } else {
      startDist = starts;
    }
    // 首音也受拱形目标约束
    const firstTarget = archMidi;
    const startWeighted = {};
    Object.keys(startDist).forEach(k => {
      let w = startDist[k];
      const f = freqStore[k] || 0;
      if (f > 0) {
        const m = 69 + 12 * Math.log2(f / 440);
        w *= Math.exp(-(Math.pow(m - firstTarget, 2)) / 12);
      }
      if (w > 0) startWeighted[k] = w;
    });
    let prev2 = null, prev1 = Object.keys(startWeighted).length ? weightedPick(startWeighted) : weightedPick(startDist);
    let prevDir = 0, prevLeap = false;
    result.push({ token: cloneToken(tokenStore[prev1]), rhythm: pickRhythmDist() });
    for (let i = 1; i < count; i++) {
      let candidates;
      const triKey = prev2 ? (prev2 + '|' + prev1) : null;
      const tri = triKey ? trigram[triKey] : null;
      if (tri) {
        const filtered = Object.fromEntries(Object.entries(tri).filter(([k]) => !REPEAT.has(k)));
        candidates = Object.keys(filtered).length ? filtered : (bigram[prev1] || starts);
      } else {
        const bi = bigram[prev1];
        candidates = bi ? Object.fromEntries(Object.entries(bi).filter(([k]) => !REPEAT.has(k))) : starts;
      }
      if (!Object.keys(candidates).length) candidates = starts;
      // 段落权重
      if (Object.keys(secDist).length > 0) {
        const mixed = {};
        Object.keys(candidates).forEach(k => { mixed[k] = candidates[k] * 0.5; });
        Object.keys(secDist).forEach(k => {
          if (!REPEAT.has(k)) mixed[k] = (mixed[k] || 0) + secDist[k] * 0.5;
        });
        candidates = mixed;
      }
      if (i >= count - 2 && Object.keys(phraseEnd).length > 0) {
        const endDist = Object.fromEntries(Object.entries(phraseEnd).filter(([k]) => !REPEAT.has(k) && candidates[k]));
        if (Object.keys(endDist).length > 0) {
          const mixed = {};
          Object.keys(candidates).forEach(k => { mixed[k] = candidates[k] * 0.4; });
          Object.keys(endDist).forEach(k => { mixed[k] = (mixed[k] || 0) + endDist[k] * 0.6; });
          candidates = mixed;
        }
      }
      // 当前音在乐句内的位置 0~1，叠加小幅局部拱形（全局拱形为主）
      const localPos = count > 1 ? i / (count - 1) : 0.5;
      // 优先用 LSTM 生成的旋律轮廓，否则用拱形
      const targetMidi = lstmMelody ? lstmMelody[i] : (archMidi - 0.8 * Math.sin(localPos * Math.PI));
      const next = pickNextMusic(prev1, candidates, freqStore, prevDir, prevLeap, targetMidi, style);
      const tok = tokenStore[next];
      // 曲风节奏放缓
      const rhythm = pickRhythmDist(style && style.rhythmSlow);
      result.push({ token: tok ? cloneToken(tok) : null, rhythm });
      const pf = freqStore[prev1] || 0, nf = freqStore[next] || 0;
      if (pf > 0 && nf > 0) {
        const semi = 12 * Math.log2(nf / pf);
        prevDir = semi > 0.5 ? 1 : semi < -0.5 ? -1 : 0;
        prevLeap = Math.abs(semi) >= 7;
      }
      prev2 = prev1;
      prev1 = next;
    }
    return result.filter(r => r.token);
  }

  /* ===== 曲风预设：关键词 → 生成参数 =====
   * 每个预设含 params（生成参数）和 synonyms（同义词/近义词组）。
   * 任意曲风词通过字符 bigram + 单字 Jaccard 相似度匹配到最接近的预设。
   * intervalBias: 音程转移偏置 {半音差: 倍率}
   * techBias: 技法类型偏置 {类名: 倍率}
   * pitchShift: 音高整体偏移（半音）
   * rhythmSlow: 节奏系数（>1 舒缓，<1 急促）
   * pentatonic: 五声音阶权重倍率 */
  const STYLE_PRESETS = [
    { name: '泛音', synonyms: ['泛音', '空灵', '清澈', '透明', '澄澈', '空明', '清冷', '泛'],
      params: { techBias: { fan: 8 }, pitchShift: 12, pentatonic: 1.3 } },
    { name: '散音', synonyms: ['散音', '浑厚', '低沉', '厚重', '沉稳', '散', '厚', '沉'],
      params: { techBias: { san: 5 }, pitchShift: 0 } },
    { name: '秋风', synonyms: ['秋风', '萧瑟', '凄凉', '悲秋', '荒凉', '冷清', '萧索', '秋', '瑟', '凄'],
      params: { intervalBias: { '-2': 1.6, '-3': 1.5, '-5': 1.4 }, rhythmSlow: 1.3, pentatonic: 1.2 } },
    { name: '春风', synonyms: ['春风', '温暖', '和煦', '明媚', '生机', '暖', '明', '柔'],
      params: { intervalBias: { '2': 1.5, '3': 1.4, '5': 1.3 }, rhythmSlow: 0.9 } },
    { name: '酒狂', synonyms: ['酒狂', '狂放', '不羁', '洒脱', '豪放', '醉', '狂', '豪'],
      params: { intervalBias: { '7': 1.5, '-7': 1.4, '12': 1.3 }, rhythmSlow: 0.8 } },
    { name: '梅花', synonyms: ['梅花', '清雅', '高洁', '孤傲', '凌寒', '清', '雅', '梅'],
      params: { pentatonic: 1.6, intervalBias: { '2': 1.2, '3': 1.2, '-2': 1.2 }, rhythmSlow: 1.1 } },
    { name: '流水', synonyms: ['流水', '潺潺', '流动', '绵延', '涓涓', '流', '水', '潺'],
      params: { intervalBias: { '2': 1.3, '-2': 1.3, '0': 1.2 }, techBias: { yin: 1.5, nao: 1.3 } } },
    { name: '高山', synonyms: ['高山', '巍峨', '雄伟', '壮阔', '磅礴', '高', '山', '巍'],
      params: { intervalBias: { '5': 1.4, '7': 1.3, '12': 1.3 }, pitchShift: 3 } },
    { name: '悲', synonyms: ['悲', '悲伤', '哀伤', '哀怨', '忧愁', '哀', '怨', '忧', '愁'],
      params: { intervalBias: { '-2': 1.5, '-3': 1.4, '-5': 1.3 }, rhythmSlow: 1.4, techBias: { yin: 1.4 } } },
    { name: '喜', synonyms: ['喜', '欢快', '喜悦', '活泼', '明朗', '欢', '乐', '快'],
      params: { intervalBias: { '2': 1.4, '3': 1.3, '5': 1.3 }, rhythmSlow: 0.85 } },
    { name: '吟猱', synonyms: ['吟猱', '余韵', '韵味', '悠长', '吟', '猱', '韵'],
      params: { techBias: { yin: 3, nao: 2.5 } } },
    { name: '绰注', synonyms: ['绰注', '滑音', '装饰', '润色', '绰', '注'],
      params: { techBias: { chuo: 3, zhu: 3 } } },
    { name: '滑音', synonyms: ['滑音', '滑动', '流畅', '连贯', '滑', '畅'],
      params: { techBias: { shang: 2, xia: 2, chuo: 1.5, zhu: 1.5 } } },
  ];

  // 字符 bigram 集合（两字一组）
  function bigrams(s) {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  }
  // 单字集合
  function unigrams(s) { return new Set(s.split('')); }
  // Jaccard 相似度
  function jaccard(a, b) {
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const union = a.size + b.size - inter;
    return union === 0 ? 0 : inter / union;
  }
  // 计算输入词与某个预设所有同义词的最大相似度（bigram 0.6 + 单字 0.4）
  function styleSimilarity(input, preset) {
    const bi = bigrams(input);
    const ui = unigrams(input);
    let maxSim = 0;
    for (const syn of preset.synonyms) {
      const sim = 0.6 * jaccard(bi, bigrams(syn)) + 0.4 * jaccard(ui, unigrams(syn));
      if (sim > maxSim) maxSim = sim;
    }
    return maxSim;
  }

  /* 解析提示词 → 合并曲风参数。
   * 策略：1) 精确/包含匹配预设名；2) 同义词相似度匹配（阈值 0.25）；
   * 取所有命中的预设，按相似度加权融合参数。 */
  function parseStylePrompt(prompt) {
    if (!prompt) return null;
    const merged = { intervalBias: {}, techBias: {}, pitchShift: 0, rhythmSlow: 1, pentatonic: 1 };
    const hits = []; // { preset, weight }
    for (const preset of STYLE_PRESETS) {
      let weight = 0;
      // 1. 包含预设名或同义词（精确匹配权重 1）
      if (prompt.includes(preset.name)) { weight = 1; }
      else {
        for (const syn of preset.synonyms) {
          if (syn.length >= 2 && prompt.includes(syn)) { weight = 1; break; }
        }
      }
      // 2. 字符相似度模糊匹配
      if (weight === 0) {
        const sim = styleSimilarity(prompt, preset);
        if (sim >= 0.25) weight = sim;
      }
      if (weight > 0) hits.push({ preset, weight });
    }
    if (hits.length === 0) return null;
    // 按权重融合参数（techBias / intervalBias 用乘积，pitchShift/rhythmSlow/pentatonic 用加权平均）
    const totalW = hits.reduce((s, h) => s + h.weight, 0);
    for (const { preset, weight } of hits) {
      const p = preset.params;
      const w = weight / totalW;
      for (const k of Object.keys(p.intervalBias || {})) {
        merged.intervalBias[k] = (merged.intervalBias[k] || 1) * Math.pow(p.intervalBias[k], w);
      }
      for (const k of Object.keys(p.techBias || {})) {
        merged.techBias[k] = (merged.techBias[k] || 1) * Math.pow(p.techBias[k], w);
      }
      merged.pitchShift += (p.pitchShift || 0) * w;
      merged.rhythmSlow *= Math.pow(p.rhythmSlow || 1, w);
      merged.pentatonic *= Math.pow(p.pentatonic || 1, w);
    }
    // 标记命中来源，供 UI 显示
    merged._matched = hits.map(h => h.preset.name);
    return merged;
  }

  /* 异步解析接口（保留兼容，实际同步返回） */
  async function parseStylePromptAsync(prompt) {
    const s = parseStylePrompt(prompt);
    return { style: s, source: s ? (s._matched.includes(prompt) ? 'local' : 'similarity') : null };
  }

  /* ===== LSTM 前向推理（网页端，纯 JS） =====
   * 输入 token 序列，输出下一个 token 的概率分布，采样得到旋律 MIDI 序列 */
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
  function tanh(x) { return Math.tanh(x); }
  function softmax(arr, temp) {
    temp = temp || 1;
    let max = -Infinity;
    for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
    let sum = 0;
    const out = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) { const e = Math.exp((arr[i] - max) / temp); out[i] = e; sum += e; }
    for (let i = 0; i < arr.length; i++) out[i] /= sum;
    return out;
  }
  function sampleCategorical(probs) {
    let r = Math.random();
    for (let i = 0; i < probs.length; i++) { r -= probs[i]; if (r <= 0) return i; }
    return probs.length - 1;
  }
  // 矩阵向量乘：out[m] = sum(W[m*n + k] * x[k])
  function matVec(W, x, out) {
    const [rows, cols] = W.shape;
    const d = W.data;
    for (let m = 0; m < rows; m++) {
      let s = 0;
      const base = m * cols;
      for (let k = 0; k < cols; k++) s += d[base + k] * x[k];
      out[m] = s;
    }
  }
  // 用 LSTM 生成 length 个 MIDI 音符（token 3..75 映射到 MIDI pitch_min..pitch_max）
  function generateMelodyByLSTM(length, style) {
    if (!lstm) return null;
    const meta = lstm.meta;
    const W = lstm.W;
    const embW = W['emb.weight'].data;
    const embDim = meta.emb_dim;
    const hidden = meta.hidden;
    const vocab = meta.vocab_size;
    const bos = meta.bos, eos = meta.eos, pad = meta.pad;
    const pitchMin = meta.pitch_min;
    const xEmb = new Float32Array(embDim);
    const h = new Float32Array(hidden);
    const c = new Float32Array(hidden);
    const gates = new Float32Array(4 * hidden); // i,f,g,o
    const wBias = W['lstm.bias_ih_l0'].data;
    const uBias = W['lstm.bias_hh_l0'].data;
    const wih = W['lstm.weight_ih_l0'];   // [4H, E]
    const whh = W['lstm.weight_hh_l0'];   // [4H, H]
    const outW = W['out.weight'];         // [V, H]
    const outB = W['out.bias'].data;
    const logits = new Float32Array(vocab);
    const intervalBias = (style && style.intervalBias) || {};
    const pitchShift = (style && style.pitchShift) || 0;
    const result = [];
    let prevMidi = 60 + pitchShift;
    let curTok = bos;
    for (let step = 0; step < length; step++) {
      // embedding
      for (let i = 0; i < embDim; i++) xEmb[i] = embW[curTok * embDim + i];
      // LSTM step: gates = W_ih * x + W_hh * h + bias_ih + bias_hh
      const tmp1 = new Float32Array(4 * hidden);
      const tmp2 = new Float32Array(4 * hidden);
      matVec(wih, xEmb, tmp1);
      matVec(whh, h, tmp2);
      for (let i = 0; i < 4 * hidden; i++) gates[i] = tmp1[i] + tmp2[i] + wBias[i] + uBias[i];
      const H = hidden;
      const iG = gates.subarray(0, H);
      const fG = gates.subarray(H, 2 * H);
      const gG = gates.subarray(2 * H, 3 * H);
      const oG = gates.subarray(3 * H, 4 * H);
      for (let i = 0; i < H; i++) {
        const ig = sigmoid(iG[i]);
        const fg = sigmoid(fG[i]);
        const gg = tanh(gG[i]);
        const og = sigmoid(oG[i]);
        c[i] = fg * c[i] + ig * gg;
        h[i] = og * tanh(c[i]);
      }
      // out logits = outW * h + outB
      matVec(outW, h, logits);
      for (let i = 0; i < vocab; i++) logits[i] += outB[i];
      // 屏蔽特殊 token
      logits[pad] = -1e9; logits[eos] = -1e9;
      // 曲风音程偏置：根据 prevMidi 调整各候选音高权重
      if (Object.keys(intervalBias).length) {
        for (let tok = 3; tok < vocab; tok++) {
          const midi = tok - 3 + pitchMin + pitchShift;
          const diff = midi - prevMidi;
          const key = String(diff);
          if (intervalBias[key]) logits[tok] += Math.log(intervalBias[key]) * 2;
        }
      }
      const probs = softmax(logits, 0.9);
      curTok = sampleCategorical(probs);
      const midi = curTok - 3 + pitchMin + pitchShift;
      result.push(midi);
      prevMidi = midi;
    }
    return result;
  }

  /* 生成完整曲目：多行，行数和每行长度模仿语料库分布，按段落学习。
   * stylePrompt: 可选提示词（如"秋风""泛音"），控制曲风/技法 */
  function generateFullScore(stylePrompt) {
    const style = parseStylePrompt(stylePrompt);
    if (!ngramModel || Object.keys(ngramModel.unigram).length === 0) {
      return [{ tokens: randomPhraseTokens() }];
    }
    const lineCount = 5 + Math.floor(Math.random() * 16);
    const lines = [];
    for (let li = 0; li < lineCount; li++) {
      let sec = 'middle';
      if (li < 2) sec = 'start';
      else if (li >= lineCount - 2) sec = 'end';
      // 全局位置 0~1，用于拱形音高轮廓
      const globalPos = lineCount > 1 ? li / (lineCount - 1) : 0.5;
      const targetLen = 5 + Math.floor(Math.random() * 6);
      const tokens = randomPhraseTokens(targetLen, sec, globalPos, style);
      if (tokens.length) lines.push({ tokens });
    }
    return lines;
  }

  /* 从词根组合生成曲名：双字前缀 + 单字后缀。
   * banned：Set 或 Array，禁止使用的标题（曲库/大厅/已有 AI 曲目）。
   * 不再从 titlePool 选取，杜绝与曲库/大厅雷同。 */
  function generateTitle(banned) {
    const ban = banned instanceof Set ? banned : new Set(banned || []);
    const prefixes = (lexicon && Array.isArray(lexicon.prefixes) && lexicon.prefixes.length) ? lexicon.prefixes : FALLBACK_PREFIXES;
    const suffixes = (lexicon && Array.isArray(lexicon.suffixes) && lexicon.suffixes.length) ? lexicon.suffixes : FALLBACK_SUFFIXES;
    const rand = a => a[Math.floor(Math.random() * a.length)];
    // 曲名长度概率分布（模拟古琴曲名：多为2-4字，偶尔1字或5-8字）
    const LEN_WEIGHTS = [
      { len: 1, w: 4 }, { len: 2, w: 20 }, { len: 3, w: 35 }, { len: 4, w: 25 },
      { len: 5, w: 10 }, { len: 6, w: 4 }, { len: 7, w: 1 }, { len: 8, w: 1 }
    ];
    function pickLen() {
      const total = LEN_WEIGHTS.reduce((s, x) => s + x.w, 0);
      let r = Math.random() * total;
      for (const x of LEN_WEIGHTS) { r -= x.w; if (r <= 0) return x.len; }
      return 3;
    }
    // 按目标长度用 prefix(2字) + suffix(1字) 作为基本块拼接
    function buildName(targetLen) {
      if (targetLen === 1) return rand(suffixes);
      if (targetLen === 2) return Math.random() < 0.7 ? rand(prefixes) : rand(prefixes).slice(0, 1) + rand(suffixes);
      let parts = [], len = 0;
      while (len < targetLen) {
        const remaining = targetLen - len;
        if (remaining >= 2 && Math.random() < 0.7) { parts.push(rand(prefixes)); len += 2; }
        else { parts.push(rand(suffixes)); len += 1; }
      }
      let t = parts.join('');
      if (t.length > targetLen) t = t.slice(0, targetLen);
      return t;
    }
    // 最多 80 次尝试：在词库组合空间中找不雷同的标题
    for (let i = 0; i < 80; i++) {
      const t = buildName(pickLen());
      if (t.length >= 1 && t.length <= 10 && !ban.has(t)) return t;
    }
    // 仍冲突：附加序号后缀强行避开
    let n = 1;
    while (true) {
      const t = rand(prefixes) + rand(suffixes) + n;
      if (!ban.has(t)) return t;
      n++;
    }
  }

  /* 批量生成 n 首完整曲目，带标题。
   * bannedTitles：跨批次去重用，应为 corpus/hallScores/已有 genBatch 的标题集合。 */
  function generateBatchScores(n, bannedTitles, stylePrompt) {
    n = n || 10;
    const results = [];
    const usedTitles = new Set(bannedTitles || []);
    for (let i = 0; i < n; i++) {
      const title = generateTitle(usedTitles);
      usedTitles.add(title);
      results.push({
        id: 'gen_' + Date.now() + '_' + i,
        title,
        lines: generateFullScore(stylePrompt),
        likes: 0,
        dislikes: 0,
        createdAt: Date.now()
      });
    }
    return results;
  }

  // 音乐学智能选音：音程权重 + 大跳回归 + 波浪轮廓 + 五声音阶
  function pickNextMusic(prev, candidates, freqStore, prevDir, prevLeap, targetMidi, style) {
    const prevF = freqStore[prev] || 0;
    const prevCls = classifyToken(prev);
    const keys = Object.keys(candidates);
    const weighted = {};
    const techBias = (style && style.techBias) || {};
    const pentaBoost = (style && style.pentatonic) || 1;
    keys.forEach(k => {
      let w = candidates[k];
      const f = freqStore[k] || 0;
      // 曲风技法偏置：如"泛音"提升 fan 类概率
      const cls = classifyToken(k);
      if (techBias[cls]) w *= techBias[cls];
      if (prevF > 0 && f > 0) {
        const semi = 12 * Math.log2(f / prevF);
        const curCls = classifyToken(k);
        // 弯音范围约束：上主要2-8半音上行，下主要-2到-5半音下行
        if (curCls === 'shang') {
          if (semi < 1 || semi > 10) w *= 0.1; // 上音应上行
          else if (semi >= 2 && semi <= 8) w *= 2.0;
        } else if (curCls === 'xia') {
          if (semi > -1 || semi < -8) w *= 0.1; // 下音应下行
          else if (semi <= -2 && semi >= -5) w *= 2.0;
        }
        w *= intervalWeight(semi);
        // 大跳后强制回归
        if (prevLeap && prevDir !== 0) {
          const curDir = semi > 0.5 ? 1 : semi < -0.5 ? -1 : 0;
          if (curDir === prevDir) w *= 0.15;
          else if (curDir === -prevDir) w *= 2.5;
        }
        // 波浪形轮廓
        if (prevDir !== 0 && !prevLeap) {
          const curDir = semi > 0.5 ? 1 : semi < -0.5 ? -1 : 0;
          if (curDir === prevDir) w *= 0.7;
        }
      }
      // 拱形目标音高权重：离 targetMidi 越近权重越高
      if (targetMidi != null && f > 0) {
        const m = 69 + 12 * Math.log2(f / 440);
        const dist = Math.abs(m - targetMidi);
        // 高斯权重：距离3半音内权重高，超过6半音快速衰减
        w *= Math.exp(-(dist * dist) / 12);
      }
      // 五声音阶偏好（pentaBoost>1 时更强偏好五声）
      const note = freqToNoteName(f);
      if (note && !PENTATONIC.has(note)) w *= (0.4 / pentaBoost);
      // 技法类型平滑（cls 已在开头声明）
      if (['fan','cuo','li','yin','nao','zhuang','shang','xia'].includes(prevCls) && prevCls === cls) {
        w *= 0.3;
      }
      if (w > 0) weighted[k] = w;
    });
    return Object.keys(weighted).length ? weightedPick(weighted) : weightedPick(candidates);
  }
  function cloneToken(t) {
    return JSON.parse(JSON.stringify(t));
  }

  // 兜底：无模型时的真随机（保证不崩溃）
  function fallbackRandom() {
    const fingers = ['大', '食', '中', '名'];
    const huis = ['七', '九', '十', '八', '六'];
    const techs = ['挑', '勾', '抹', '剔', '摘', '打'];
    const strings = ['一', '二', '三', '四', '五', '六', '七'];
    const rand = a => a[Math.floor(Math.random() * a.length)];
    const n = 4 + Math.floor(Math.random() * 5);
    const out = [];
    for (let i = 0; i < n; i++) out.push(rand(fingers) + rand(huis) + rand(techs) + rand(strings));
    return out.join(' ');
  }
  function fallbackRandomTokens() {
    const text = fallbackRandom();
    const durs = ['quarter', 'eighth', 'half', 'sixteenth'];
    const out = [];
    text.split(' ').forEach(t => {
      const toks = compose(t);
      toks.forEach(tok => out.push({ token: tok, rhythm: durs[Math.floor(Math.random() * durs.length)] }));
    });
    return out;
  }

  window.JianziInput = { init, setLexicon, setMelodyStats, setLSTM, parseStylePrompt, parseStylePromptAsync, generateMelodyByLSTM, compose, normalize, validate, isValidPrefix, canUseEndWord, randomPhrase, randomPhraseTokens, generateFullScore, generateTitle, generateBatchScores };
})();
