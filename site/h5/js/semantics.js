/* 减字语义解析器：token(categorySlots+partIds) → 演奏动作
 * 模式来自全谱统计，如：
 *   散,勾剔摘,number              → 散音：技法+弦
 *   左手,number,挑托,number       → 按音：指+徽+技法+弦
 *   左手,number,number,勾剔摘,number → 指徽分+技法+弦
 *   泛,左手,number,挑托,number    → 泛音
 *   撮,左手,number,number,散,number → 双音撮
 *   上下,number[,number]          → 走手音（上滑/下滑至徽）
 */
(function () {
  'use strict';
  let partsById = {};
  const NUM = '一二三四五六七八九十半外';

  function init(glyphParts) {
    (glyphParts || []).forEach(p => { partsById[p.id] = p; });
  }
  function label(pid) { return partsById[pid] ? partsById[pid].label : ''; }
  function cat(pid) { return partsById[pid] ? (partsById[pid].categories || []) : []; }

  // 数字串("七十" "十八" "八半") → 徽位名（"七徽" "十徽八分" "八徽半"）
  function huiName(str) {
    if (!str) return null;
    if (str === '徽外' || str === '外') return '徽外';
    const m = str.match(/^(十)?([一二三四五六七八九]?)半?$/);
    if (str === '半') return null;
    if (str.endsWith('半')) {
      const head = str.slice(0, -1);
      return (head.length === 2 ? head[0] + '徽' + head[1] + '分' : head + '徽半').replace('徽半', '徽半');
    }
    if (str.length === 1) return str + '徽';
    if (str.length === 2) {
      if (str[0] === '十') return '十徽' + (str[1] === '' ? '' : ''); // "十八"→十徽八分
      return str[0] + '徽' + str[1] + '分';
    }
    return null;
  }
  // 兼容写法：两字数字统一映射（"十八"=十徽八分，"八半"=八徽半）
  function digitsToHui(s) {
    if (!s) return null;
    if (s === '外') return '徽外';
    if (s.includes('半')) {
      const h = s.replace('半', '');
      return (h.length === 2) ? h[0] + '徽' + h[1] + '分' : h + '徽半';
    }
    if (s.length === 1) return s + '徽';
    if (s[0] === '十') return '十徽' + s[1] + '分';
    return s[0] + '徽' + s[1] + '分';
  }
  function digitToNum(ch) {
    return '零一二三四五六七八九'.indexOf(ch) >= 0 ? '零一二三四五六七八九'.indexOf(ch) : (ch === '十' ? 10 : NaN);
  }

  /* 主入口：token → 动作对象数组
   * 动作: {type:'pluck'|'chord'|'slide'|'rest'|'ctrl', strings:[n], hui, finger,
   *        tech, harmonic, open, glide:{toHui,dir}, mods:[绰,注,吟,猱...], text} */
  function parseToken(token) {
    if (!token || token.kind !== 'jianzi') return { type: 'rest', text: token ? token.text : '' };
    const slots = token.categorySlots || [];
    const labels = (token.partIds || []).map(label);
    const text = token.text || labels.join('');
    const cats = (token.partIds || []).map(cat);

    const isCat = (i, c) => slots[i] === c || cats[i].includes(c);
    const findSlot = c => slots.findIndex((s, i) => s === c);

    // 控制符
    if (slots.includes('控制符') || /^(泛起|泛止|少息|曲终|从头|再作|段落)/.test(text)) {
      return { type: 'ctrl', text, ctrl: text };
    }

    // 上下滑音（走手音）：上下[,number[,number]]
    if (slots[0] === '上下' || cats[0].includes('上下')) {
      const nums = labels.filter((_, i) => slots[i] === 'number' || NUM.includes(_));
      const dir = labels[0] === '上' ? 'up' : 'down';
      const to = nums.length ? digitsToHui(nums.join('')) : null;
      return { type: 'slide', dir, toHui: to, text };
    }
    if (slots[0] === '引绰注淌浒') {
      const rest = labels.slice(1).join('');
      const m = rest.match(/^[上下]/);
      const nums = rest.replace(/^[上下]/, '');
      return { type: 'slide', dir: m && m[0] === '上' ? 'up' : 'down',
               toHui: nums ? digitsToHui(nums) : null, mods: [labels[0]], text };
    }

    // 撮/拨（双音）：[修饰*] 撮|拨[剌] + 两组位置
    // 有「散」组时：按音组的全部数字是徽位（弦号由散弦相邻推导），如 撮大九四散七
    // 全按音时：每组末位数字是弦号，如 撮食七一大七二
    if (slots.includes('撮') || slots.includes('拨字')) {
      const idx = slots.findIndex(s => s === '撮' || s === '拨字');
      const groups = [];
      let cur = null;
      const push = () => { if (cur) groups.push(cur); cur = null; };
      slots.slice(idx + 1).forEach((s, i) => {
        const pid = token.partIds[idx + 1 + i];
        const l = label(pid), c = cat(pid);
        if (s === '左手') { push(); cur = { finger: l, open: false, digits: [] }; return; }
        if (s === '散') { push(); cur = { finger: null, open: true, digits: [] }; return; }
        if (s === 'number' || c.includes('十后')) {
          if (!cur) cur = { finger: null, open: false, digits: [] };
          cur.digits.push(l);
        }
      });
      push();
      const hasOpen = groups.some(g => g.open && g.digits.length);
      const pairs = groups.map(g => {
        let huiD = g.digits, string = null;
        if (g.open) { string = g.digits.length ? digitToNum(g.digits[g.digits.length - 1]) : null; huiD = []; }
        else if (hasOpen) { /* 全部数字当徽位 */ }
        else if (g.digits.length >= 2) { string = digitToNum(g.digits[g.digits.length - 1]); huiD = g.digits.slice(0, -1); }
        if (!(string >= 1 && string <= 7)) string = null;   // 八/九等非弦号
        return { finger: g.finger, open: g.open, harmonic: false,
                 hui: huiD.length ? digitsToHui(huiD.join('')) : null, string };
      });
      pairs.forEach((p, i) => {
        if (p.string == null) {
          const nb = pairs.find((q, j) => j !== i && q.string != null);
          if (nb) p.string = Math.min(7, Math.max(1, nb.string - 1));
        }
      });
      return { type: 'chord', positions: pairs, mods: labels.slice(0, idx), text };
    }

    // 滚/拂[散] X [至 Y]、历 XY：连刷多根弦；单弦滚/拂=散音单弹
    const sweep = text.match(/^(?:散)?[滚拂]([一二三四五六七])至([一二三四五六七])/)
      || text.match(/^(?:散)?历([一二三四五六七])([一二三四五六七])/);
    if (sweep) {
      const from = digitToNum(sweep[1]), to = digitToNum(sweep[2]);
      return { type: 'sweep', from, to, tech: text.replace(/^散/, '')[0], text };
    }
    const roll1 = text.match(/^(?:散)?[滚拂]([一二三四五六七])$/);
    if (roll1) {
      return { type: 'pluck', string: digitToNum(roll1[1]), open: true, text };
    }
    // 散X如一：「如一」为齐鸣记号，配对弦在上下文（前一撮），此处至少弹出本弦散音
    const ru = text.match(/^散([一二三四五六七])如一$/);
    if (ru) {
      return { type: 'chord', positions: [
        { finger: null, open: true, harmonic: false, hui: null, string: digitToNum(ru[1]) }
      ], text };
    }

    // 纯数字字（"四"，单部件单字）：续弹——只写弦号，指法沿用前字
    if ((token.partIds || []).length === 1 && /^[一二三四五六七]$/.test(text)) {
      return { type: 'pluck', string: digitToNum(text), carryTech: true, carry: false, text };
    }

    // 常规单音：散 / 泛 / 按音
    const info = extractPositions(slots, token.partIds);
    // 连弹（抹挑七/勾剔二）：拆出的前段没有弦号，从后面带弦号的位置回填
    const strHaver = info.find(p => p.string != null);
    if (strHaver) info.forEach(p => { if (p.string == null) p.string = strHaver.string; });
    if (!info.length) {
      // 掐起/掩/带起等左手发声技法：沿用本弦
      if (/起|掩/.test(text)) return { type: 'pluck', tech: text.replace(/^(名|大|食|中|跪)/, ''), carry: true, text };
      return { type: 'rest', text };
    }
    const p = info[info.length - 1];
    const mods = [];
    (token.partIds || []).forEach((pid, i) => {
      if (['绰', '注', '吟字', '猱字', '撞字'].some(c => cats[i].includes(c))) mods.push(labels[i]);
    });
    return {
      type: 'pluck',
      string: p.string, hui: p.hui, finger: p.finger, tech: p.tech,
      open: p.open, harmonic: p.harmonic, mods,
      double: info.length > 1,        // 连弹：同弦快速两触
      text
    };
  }

  /* 从 slots/pids 中提取 [位置]：识别 散|泛|左手|徽数字|技法|弦数字 */
  function extractPositions(slots, pids) {
    const out = [];
    let cur = { finger: null, hui: null, string: null, tech: null, open: false, harmonic: false };
    let huiDigits = '', numAfterTech = false;
    const TECH_CATS = ['勾剔摘', '挑托', '抹', '打', '擘', '历', '涓字', '轮字', '弹字'];
    slots.forEach((s, i) => {
      const c = cat(pids[i]); const l = label(pids[i]);
      if (s === '散') { cur.open = true; return; }
      if (s === '泛') { cur.harmonic = true; return; }
      if (s === '左手') { cur.finger = l; return; }
      if (s === 'number' || c.includes('十后')) {
        if ((numAfterTech || cur.tech) && /^[一二三四五六七]$/.test(l)) { cur.string = digitToNum(l); }
        else huiDigits += l;   // 八/九/十等只可能是徽分数字
        return;
      }
      if (s === '外') { huiDigits += '外'; return; }
      if (TECH_CATS.includes(s) || TECH_CATS.some(t => c.includes(t))) {
        if (cur.tech) { // 第二个技法（如抹挑连）：先收一个位置
          if (huiDigits) cur.hui = digitsToHui(huiDigits), huiDigits = '';
          out.push(cur); cur = { ...cur, tech: null };
        }
        cur.tech = l; numAfterTech = true; return;
      }
    });
    if (huiDigits) cur.hui = digitsToHui(huiDigits);
    if (cur.string || cur.tech || cur.open || cur.harmonic) out.push(cur);
    return out;
  }

  window.JianziSemantics = { init, parseToken, digitsToHui, digitToNum };
})();
