/* MusicXML → 减字谱转换器
 * 解析 MusicXML 音高/节奏，通过位置求解器转为（弦, 徽, 指法），再生成减字 token
 * 复用 audio.js 的频率表和 glyph_parts.json 的部件 ID */
(function () {
  'use strict';

  // 古琴标准定弦（正调）散音频率
  const OPEN = [65.41, 73.59, 88.40, 98.12, 110.38, 130.82, 147.17];

  // 徽位 → 弦长比例（从岳山到按音点）
  const HUI_RATIO = {
    1: 0.125, 2: 0.1667, 3: 0.2, 4: 0.25, 5: 0.3333, 6: 0.4, 7: 0.5,
    8: 0.6, 9: 0.6667, 10: 0.75, 11: 0.8, 12: 0.8333, 13: 0.8889
  };

  // 徽位 → 泛音谐波次数
  const HUI_HARMONIC = { 1: 8, 2: 6, 3: 5, 4: 4, 5: 3, 6: 5, 7: 2, 8: 5, 9: 3, 10: 4, 11: 5, 12: 6, 13: 8 };

  // 徽序号 → 徽名
  const HUI_NAMES = ['一徽', '二徽', '三徽', '四徽', '五徽', '六徽', '七徽', '八徽', '九徽', '十徽', '十一徽', '十二徽', '十三徽'];

  // 部件 ID 表
  const PART = {
    左手: { 大: '001', 食: '002', 中: '003', 名: '004' },
    散: '006', 泛: '036',
    数: { '1': '007', '2': '008', '3': '009', '4': '010', '5': '011', '6': '012', '7': '013', '8': '014', '9': '015', '10': '016' },
    右手: { 打: '023', 挑: '020', 勾: '021', 剔: '022' }
  };

  // 标准 slot 布局（256×256 方块内坐标）
  // 参照 corpus 中 sandasan / dajiutiaoliu / fanshiqitiaoliu 的实测值
  const SLOTS = {
    // 散打X (3 parts): 散(上) 打(下) X(内嵌)
    sandad: [
      { x: 50, y: 0, lengthX: 156, lengthY: 85 },
      { x: 50, y: 85, lengthX: 156, lengthY: 170 },
      { x: 65.234375, y: 116.875, lengthX: 94.453125, lengthY: 90.9765625 }
    ],
    // 散泛打X (4 parts): 散(左上) 泛(右上) 打(下) X(内嵌)
    sanfand: [
      { x: 50, y: 0, lengthX: 78, lengthY: 85 },
      { x: 128, y: 0, lengthX: 78, lengthY: 85 },
      { x: 50, y: 85, lengthX: 156, lengthY: 170 },
      { x: 65.234375, y: 116.875, lengthX: 94.453125, lengthY: 90.9765625 }
    ],
    // 按音 (4 parts): 左手(左上) 徽位(右上) 右手(下) 弦号(内嵌)
    pressed: [
      { x: 50, y: 0, lengthX: 78, lengthY: 85 },
      { x: 128, y: 0, lengthX: 78, lengthY: 85 },
      { x: 50, y: 85, lengthX: 156, lengthY: 170 },
      { x: 92.046875, y: 106.9140625, lengthX: 86.53125, lengthY: 111.5625 }
    ]
  };

  // 右手指法轮换
  const RH_CYCLE = ['打', '挑', '勾', '剔'];
  // 左手指法轮换
  const LH_CYCLE = ['大', '食', '中', '名'];

  // MusicXML type → rhythm duration
  const TYPE_MAP = {
    'whole': 'whole', 'half': 'half', 'quarter': 'quarter',
    'eighth': 'eighth', '16th': 'sixteenth', '32nd': 'thirty-second'
  };

  // 音名 → MIDI 偏移
  const STEP_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  /* 音名→频率 */
  function pitchToFreq(step, octave, alter) {
    const midi = (octave + 1) * 12 + STEP_SEMI[step] + (alter || 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* 位置求解器：给定频率，找最近的（弦, 徽, 类型） */
  function freqToPosition(freq) {
    let best = null, minErr = Infinity;
    for (let s = 0; s < 7; s++) {
      const open = OPEN[s];
      // 散音
      let err = Math.abs(open - freq);
      if (err < minErr) { minErr = err; best = { string: s + 1, huiIdx: null, hui: null, kind: 'open' }; }
      // 按音 & 泛音
      for (let h = 0; h < 13; h++) {
        // 按音
        const pressedFreq = open / HUI_RATIO[h + 1];
        err = Math.abs(pressedFreq - freq);
        if (err < minErr) { minErr = err; best = { string: s + 1, huiIdx: h + 1, hui: HUI_NAMES[h], kind: 'pressed' }; }
        // 泛音
        const harmFreq = open * HUI_HARMONIC[h + 1];
        err = Math.abs(harmFreq - freq);
        if (err < minErr) { minErr = err; best = { string: s + 1, huiIdx: h + 1, hui: HUI_NAMES[h], kind: 'harmonic' }; }
      }
    }
    return best;
  }

  /* 位置→减字 token */
  function positionToToken(pos, rhIdx, lhIdx) {
    const stringId = PART.数[String(pos.string)];
    const rhName = RH_CYCLE[rhIdx % RH_CYCLE.length];
    const rhId = PART.右手[rhName];
    const strChar = ['一','二','三','四','五','六','七'][pos.string - 1];

    if (pos.kind === 'open') {
      // 散打X
      return {
        jianzi: {
          code: 'sandad' + pos.string,
          kind: 'jianzi',
          text: '散' + rhName + strChar,
          partIds: [PART.散, rhId, stringId],
          categorySlots: ['散', rhName, 'number'],
          slotTransforms: SLOTS.sandad.map(s => ({ ...s }))
        }
      };
    }
    if (pos.kind === 'harmonic') {
      // 散泛打X
      return {
        jianzi: {
          code: 'sanfand' + pos.string,
          kind: 'jianzi',
          text: '散泛' + rhName + strChar,
          partIds: [PART.散, PART.泛, rhId, stringId],
          categorySlots: ['散', '泛', rhName, 'number'],
          slotTransforms: SLOTS.sanfand.map(s => ({ ...s }))
        }
      };
    }
    // 按音：左手指 + 徽位号 + 右手指法 + 弦号
    const lhName = LH_CYCLE[lhIdx % LH_CYCLE.length];
    const lhId = PART.左手[lhName];
    const huiLabel = huiShort(pos.hui); // 如"九徽" → "9"
    const huiId = PART.数[huiLabel] || PART.数['7'];
    return {
      jianzi: {
        code: lhName + huiLabel + rhName + pos.string,
        kind: 'jianzi',
        text: lhName + pos.hui.replace('徽','') + rhName + strChar,
        partIds: [lhId, huiId, rhId, stringId],
        categorySlots: ['左手', 'number', rhName, 'number'],
        slotTransforms: SLOTS.pressed.map(s => ({ ...s }))
      }
    };
  }

  // 徽名→阿拉伯数字字（九徽→"9", 十一徽→"10"）
  function huiShort(hui) {
    if (!hui) return '7';
    const cnToAr = { '一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10' };
    const m = hui.match(/^([十一二三四五六七八九]+)徽/);
    if (m) {
      // 十一/十二/十三 → 10 (减字谱中用"十"表示)
      if (m[1].length > 1 && m[1][0] === '十') return '10';
      return cnToAr[m[1]] || '7';
    }
    return '7';
  }

  /* MusicXML type → rhythmToken */
  function makeRhythmToken(type) {
    const dur = TYPE_MAP[type] || 'quarter';
    const symbols = { whole: '𝅝', half: '𝅗𝅥', quarter: '♩', eighth: '♪', sixteenth: '𝅘𝅥𝅯', 'thirty-second': '𝅘𝅥𝅯' };
    return {
      code: 'rhythm-slot',
      kind: 'rhythm',
      text: symbols[dur] || '♪',
      duration: dur,
      rhythmComponents: [{ duration: dur }]
    };
  }

  /* 解析 MusicXML */
  function parseMusicXml(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const title = doc.querySelector('work-title')?.textContent || '未命名';

    const part = doc.querySelector('part');
    if (!part) return { title, notes: [] };

    const measures = part.querySelectorAll('measure');
    const notes = [];
    let divisions = 1;

    measures.forEach(measure => {
      const attr = measure.querySelector('attributes');
      if (attr) {
        const divEl = attr.querySelector('divisions');
        if (divEl) divisions = parseInt(divEl.textContent);
      }
      measure.querySelectorAll('note').forEach(note => {
        // 跳过休止符
        if (note.querySelector('rest')) return;
        const pitch = note.querySelector('pitch');
        if (!pitch) return;
        const step = pitch.querySelector('step')?.textContent || 'C';
        const octave = parseInt(pitch.querySelector('octave')?.textContent || '4');
        const alterEl = pitch.querySelector('alter');
        const alter = alterEl ? parseInt(alterEl.textContent) : 0;
        const dur = parseInt(note.querySelector('duration')?.textContent || 5040);
        const type = note.querySelector('type')?.textContent || 'eighth';
        const freq = pitchToFreq(step, octave, alter);
        notes.push({ step, octave, alter, freq, duration: dur, type, divisions });
      });
    });
    return { title, notes };
  }

  /* 转换主函数 */
  function convert(xmlText) {
    const { title, notes } = parseMusicXml(xmlText);
    const lines = [];
    let line = { jianziTokens: [], rhythmTokens: [], noteInfos: [], sectionTempo: 60 };
    let rhIdx = 0, lhIdx = 0;
    const TOKENS_PER_LINE = 8;

    notes.forEach((note, ni) => {
      const pos = freqToPosition(note.freq);
      if (!pos) return;
      const { jianzi } = positionToToken(pos, rhIdx++, lhIdx++);
      const rhythm = makeRhythmToken(note.type);
      const noteInfo = {
        step: note.step, octave: note.octave, alter: note.alter || 0,
        freq: note.freq, type: note.type,
        pos: { string: pos.string, hui: pos.hui, kind: pos.kind },
        text: jianzi.text
      };
      line.jianziTokens.push(jianzi);
      line.rhythmTokens.push(rhythm);
      line.noteInfos.push(noteInfo);
      if (line.jianziTokens.length >= TOKENS_PER_LINE) {
        lines.push(line);
        line = { jianziTokens: [], rhythmTokens: [], noteInfos: [], sectionTempo: 60 };
      }
    });
    if (line.jianziTokens.length) lines.push(line);

    return { title, score: { lines }, notes };
  }

  window.GuqinXmlConverter = { convert, parseMusicXml, freqToPosition, pitchToFreq };
})();
