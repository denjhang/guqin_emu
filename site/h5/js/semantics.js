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

  // 数字串 → 徽位名。消歧规则照抄 alephpi/jianzipu 文法：
  // 十一/十二/十三 总是理解为十一徽/十二徽/十三徽（十徽一二三分不常用），
  // 其余两位数 X Y = X徽Y分（"十八"=十徽八分），后缀半 = 徽半
  function huiName(str) { return digitsToHui(str); }
  function digitsToHui(s) {
    if (!s) return null;
    if (s === '外' || s.includes('外')) return '徽外';
    if (s.endsWith('半')) {
      const h = s.slice(0, -1);
      const m = h.match(/^(十一|十二|十三|十|[一二三四五六七八九])$/);
      if (m) return h + '徽半';
      return null;
    }
    if (s === '十') return '十徽';
    let m = s.match(/^(十一|十二|十三)([一二三四五六七八九])?$/);   // 十二/十二三
    if (m) return m[1] + '徽' + (m[2] ? m[2] + '分' : '');
    m = s.match(/^十([一二三四五六七八九])$/);                      // 十八
    if (m) return '十徽' + m[1] + '分';
    m = s.match(/^([一二三四五六七八九])([一二三四五六七八九])?$/);   // 七 / 七九
    if (m) return m[1] + '徽' + (m[2] ? m[2] + '分' : '');
    return null;
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

    // 控制符（反复/起止等结构记号，不发声、不占时长）
    if (slots.includes('控制符') || /^(泛起|泛止|少息|曲终|从头|再作|段落|括号|从括号再作)$/.test(text)) {
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
      const pairs = groups.map(g => {
        let huiD = g.digits, string = null;
        if (g.open) { string = g.digits.length ? digitToNum(g.digits[g.digits.length - 1]) : null; huiD = []; }
        else {
          // 多数字徽位：十一/十二/十三 总是徽位（dev_guide：十徽一分等罕用，故十一=十一徽）
          const joined = g.digits.join('');
          const multi = joined.match(/^(十一|十二|十三)/);
          if (multi) {
            huiD = [multi[1]];
            const rest = joined.slice(multi[1].length);
            if (rest) string = digitToNum(rest);
          } else if (g.digits.length >= 2) { string = digitToNum(g.digits[g.digits.length - 1]); huiD = g.digits.slice(0, -1); }
          else if (g.digits.length === 1) { string = digitToNum(g.digits[0]); huiD = []; }
        }
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
    // 散历/滚拂 = 散音扫弦；带徽位前缀（如大九历七六）= 按音扫弦
    const sweepOpen = text.match(/^散[滚拂]([一二三四五六七])至([一二三四五六七])/)
      || text.match(/^散历([一二三四五六七])([一二三四五六七])/);
    if (sweepOpen) {
      const from = digitToNum(sweepOpen[1]), to = digitToNum(sweepOpen[2]);
      return { type: 'sweep', from, to, open: true, tech: text[1] || text[0], text };
    }
    const sweepClosed = text.match(/^[滚拂]([一二三四五六七])至([一二三四五六七])/)
      || text.match(/^历([一二三四五六七])([一二三四五六七])/);
    if (sweepClosed) {
      const from = digitToNum(sweepClosed[1]), to = digitToNum(sweepClosed[2]);
      return { type: 'sweep', from, to, open: false, tech: text[0], text };
    }
    // 带徽位的历：大九历七六 → 按九徽扫七、六弦
    const sweepPressed = text.match(/^(.+?)历([一二三四五六七])([一二三四五六七])$/);
    if (sweepPressed) {
      const prefix = sweepPressed[1];
      const from = digitToNum(sweepPressed[2]), to = digitToNum(sweepPressed[3]);
      const huiMatch = prefix.match(/([一二三四五六七八九十]+(?:半)?)$/);
      const hui = huiMatch ? digitsToHui(huiMatch[1]) : null;
      return { type: 'sweep', from, to, open: false, hui, tech: '历', text };
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

    // 独体装饰字（分类学对照 alephpi/jianzipu jf/mf 联袂走位类）
    // carry + open=false：左手保持按音，沿用前一音弦位徽位拨弦
    if (/^(推出|不动|分开|应合|同声|放合)$/.test(text)) {
      return { type: 'pluck', carry: true, open: false, tech: text, text };
    }
    if (/^掐撮三声/.test(text)) {
      return { type: 'pluck', carry: true, open: false, reps: 3, tech: '掐撮三声', text };
    }
    if (text === '逗' || text === '唤') {
      return { type: 'slide', dir: text === '唤' ? 'down' : 'up', toHui: null, bounce: true, text };
    }
    if (/^(伏|剌伏)$/.test(text)) {
      return { type: 'damp', text };   // 刹音：止住所有余振动
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
      // APK openStringCarryTechnique = [抓起, 带起, 推出, 放合] → 散音 carry
      // 掐起/掩/搯起/虚掩 → 按音（手指按住弦拨响，沿用徽位）
      if (/抓起|带起|推出|放合/.test(text)) {
        return { type: 'pluck', tech: text.replace(/^(名|大|食|中|跪)/, ''), carry: true, open: true, text };
      }
      if (/掐起|搯起|掩|虚掩/.test(text)) {
        // 提取徽位数字（名十掐起 → 十徽）
        const huiMatch = text.match(/([一二三四五六七八九十]+(?:半)?)/);
        return { type: 'pluck', tech: text.replace(/^(名|大|食|中|跪)/, ''), carry: true, open: false, hui: huiMatch ? digitsToHui(huiMatch[1]) : null, text };
      }
      // 落指吟/定吟/落指猱等：左手保持按音，拨弦加吟猱（carry + open=false）
      if (/吟|猱/.test(text)) {
        const vib = text.includes('猱') ? '猱' : '吟';
        return { type: 'pluck', carry: true, open: false, mods: [vib], text };
      }
      return { type: 'rest', text };
    }
    const p = info[info.length - 1];
    const mods = [];
    (token.partIds || []).forEach((pid, i) => {
      if (['绰', '注', '吟字', '猱字', '撞字'].some(c => cats[i].includes(c))) mods.push(labels[i]);
    });
    // 轮/琐/蠲：同弦快弹多触（半轮2、轮3、短琐2、琐3、长琐5、蠲2）
    let reps = 1;
    if (text.includes('半轮')) reps = 2;
    else if (text.includes('长琐')) reps = 5;
    else if (text.includes('短琐')) reps = 2;
    else if (/[轮琐]|蠲|涓/.test(text)) reps = text.includes('轮') || text.includes('琐') ? 3 : 2;
    return {
      type: 'pluck',
      string: p.string, hui: p.hui, finger: p.finger, tech: p.tech,
      open: p.open, harmonic: p.harmonic, mods,
      double: info.length > 1,        // 连弹：同弦快速两触
      reps, text
    };
  }

  /* 从 slots/pids 中提取 [位置]：识别 散|泛|左手|徽数字|技法|弦数字 */
  function extractPositions(slots, pids) {
    const out = [];
    let cur = { finger: null, hui: null, string: null, tech: null, open: false, harmonic: false };
    let huiDigits = '', numAfterTech = false;
    const TECH_CATS = ['勾剔摘', '挑托', '抹', '打', '擘', '历', '涓字', '轮字', '弹字', '琐字'];
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
    // 无左手标记、无徽位、无散音标记时：
    //   擘/托/打（拇指、中指）→ 散音（古琴中这些技法常弹散音）
    //   抹/挑/勾/剔/摘（食、名指）→ 按音，沿用前一按音徽位（APK _inferLeft 默认"按"）
    if (!cur.hui && !cur.harmonic && !cur.open && cur.string && cur.tech) {
      if (cur.tech === '擘' || cur.tech === '托' || cur.tech === '打') cur.open = true;
      // else: open=false, hui=null → player 沿用 lastHuiByString[string]
    }
    if (cur.string || cur.tech || cur.open || cur.harmonic) out.push(cur);
    return out;
  }

  window.JianziSemantics = { init, parseToken, digitsToHui, digitToNum };
})();
