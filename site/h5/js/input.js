/* 打字→减字合成引擎：中文文本（"大七挑四" "散勾三" "泛起"）→ jianzi token
 * 词典来自 glyph_parts；排版：优先复用语料库同签名 slotTransforms，否则程序化布局 */
(function () {
  'use strict';
  let parts = [];            // glyph_parts
  let byLabel = {};          // label -> part
  let byPinyin = {};
  let signatures = {};       // categorySeq -> {partIds, slotTransforms, text}

  const CTRL_WORDS = ['泛起', '泛止', '少息', '曲终', '从头', '再作', '应合', '分开', '进复', '退复', '掐起', '带起', '抓起', '如一'];
  const NUMSTR = '一二三四五六七八九十半';

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

  /* 主入口：文本 → token 数组（可能多字） */
  function compose(text) {
    const units = tokenize(text);
    const tokens = [];
    let cur = [], roles = [];
    const flush = () => {
      if (!cur.length) return;
      const partIds = cur.map(u => u.id);
      const categorySlots = cur.map(u => slotOf(u));
      const sigKey = categorySlots.join(',');
      const sig = signatures[sigKey];
      tokens.push({
        code: 'input:' + cur.map(u => u.label).join(''),
        kind: 'jianzi',
        text: cur.map(u => u.label).join(''),
        partIds,
        categorySlots,
        slotTransforms: sig ? clone(sig.slotTransforms) : proceduralLayout(cur, roles)
      });
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

  window.JianziInput = { init, compose, normalize };
})();
