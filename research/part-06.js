/* 《秋风词》内置谱面。
   减字来自用户提供的《秋风词》简谱减字谱.pdf。
   重要：这里按减字谱逐字核弦，绝不再用简谱音高反推弦位。 */
(function () {
  if (new URLSearchParams(location.search).get('embed') === 'home') {
    document.documentElement.classList.add('embed-home');
  }

  const glyphBase = Array.isArray(window.GUQIN_JZP) ? window.GUQIN_JZP.length : 0;
  if (!Array.isArray(window.GUQIN_JZP)) window.GUQIN_JZP = [];
  for (let i = 1; i <= 63; i++) {
    window.GUQIN_JZP.push({
      src: 'assets/qiufengci/glyph-' + String(i).padStart(3, '0') + '.png',
      source: '《秋风词》简谱减字谱.pdf'
    });
  }
  // 第18、19张原图曾从相邻的两个谱字之间切开。文件里仍保留了左边谱字的
  // 残余宽度；若按整张图片等比缩放，真正要显示的右字只会占音珠的一半。
  // sourceRect 明确只取右侧完整字，绘制时再按单字尺寸居中铺满。
  window.GUQIN_JZP[glyphBase + 17].sourceRect = { x: 47, y: 0, width: 55, height: 74 };
  window.GUQIN_JZP[glyphBase + 18].sourceRect = { x: 45, y: 0, width: 55, height: 76 };
  // 原谱第一处连线后续字纵向排在一起，实际是两个音，必须分别飘入。
  const splitGlyphs = {
    after8First: window.GUQIN_JZP.push({
      src: 'assets/qiufengci/glyph-008-follow-1.png',
      source: '《秋风词》简谱减字谱.pdf · 二上七', scale: 1.18
    }) - 1,
    after8Second: window.GUQIN_JZP.push({
      src: 'assets/qiufengci/glyph-008-follow-2.png',
      source: '《秋风词》简谱减字谱.pdf · 后续六', scale: 1.55
    }) - 1
  };
  window.QIUFENGCI_SPLIT_GLYPHS = splitGlyphs;
  const completedGlyphs = {
    sanGou4: window.GUQIN_JZP.push({ src: 'assets/qiufengci/completed-san-gou4.png', source: '省写承前补全 · 散勾四' }) - 1,
    sanGou5: window.GUQIN_JZP.push({ src: 'assets/qiufengci/completed-san-gou5.png', source: '省写承前补全 · 散勾五' }) - 1,
    sanGou6: window.GUQIN_JZP.push({ src: 'assets/qiufengci/completed-san-gou6.png', source: '省写承前补全 · 散勾六' }) - 1,
    zhong10Gou5: window.GUQIN_JZP.push({ src: 'assets/qiufengci/completed-zhong10-gou5.png', source: '省写承前补全 · 中十勾五' }) - 1
  };

  const POS = {
    S4: { str: 4, hui: null, tech: '散', leftFinger: null, rightHand: '勾', label: '四弦散勾' },
    S5: { str: 5, hui: null, tech: '散', leftFinger: null, rightHand: '勾', label: '五弦散勾' },
    S6: { str: 6, hui: null, tech: '散', leftFinger: null, rightHand: '挑', label: '六弦散挑' },
    S7: { str: 7, hui: null, tech: '散', leftFinger: null, rightHand: '挑', label: '七弦散音' },
    A6_9: { str: 6, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '挑', label: '大指九徽挑六弦' },
    A7_9: { str: 7, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '撮', label: '七弦九徽按音' },
    A7_76: { str: 7, hui: '七徽六分', tech: '按', leftFinger: '中', rightHand: '撮', label: '七弦七徽六分按音' },
    A7_5: { str: 7, hui: '五徽', tech: '按', leftFinger: '中', rightHand: '撮', label: '七弦五徽按音' },
    A6_5: { str: 6, hui: '五徽', tech: '按', leftFinger: '中', rightHand: '撮', label: '六弦五徽按音' },
    A4_10_ZG: { str: 4, hui: '十徽', tech: '按', leftFinger: '中', rightHand: '勾', label: '中指十徽勾四弦' },
    A5_10_MG: { str: 5, hui: '十徽', tech: '按', leftFinger: '名', rightHand: '勾', label: '名指十徽勾五弦' },
    A5_10_CG: { str: 5, hui: '十徽', tech: '按', leftFinger: '名', rightHand: '勾', chuo: true,
      label: '名指十徽绰勾五弦' },
    A6_9_CT: { str: 6, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '挑', chuo: true,
      gesture: '上', slides: [{ hui: '七徽', beats: 0.7 }], label: '大指九徽绰挑六弦' },
    A5_9_ZG: { str: 5, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '勾', zhu: true,
      gesture: '撞', slides: [{ hui: '七徽六分', beats: 0.56 }, { hui: '九徽', beats: 0.56 }],
      label: '大指九徽注勾五弦' },
    Q5_10: { str: 5, hui: '十徽', tech: '掐', leftFinger: '名', rightHand: '掐起',
      gesture: '掐起', label: '名指十徽掐起五弦' },
    A4_10_CG: { str: 4, hui: '十徽', tech: '按', leftFinger: '名', rightHand: '勾', chuo: true,
      label: '名指十徽绰勾四弦' },
    A4_10_MG: { str: 4, hui: '十徽', tech: '按', leftFinger: '名', rightHand: '勾', label: '名指十徽勾四弦' },
    A2_9_G: { str: 2, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '勾', label: '大指九徽勾二弦' },
    A3_9_T: { str: 3, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '挑', label: '大指九徽挑三弦' },
    A2_9_ZG: { str: 2, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '勾', zhu: true, label: '大指九徽注勾二弦' },
    A2_10_MG: { str: 2, hui: '十徽', tech: '按', leftFinger: '名', rightHand: '勾', label: '名指十徽勾二弦' },
    A5_9_G: { str: 5, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '勾', label: '大指九徽勾五弦' },
    A1_9_G: { str: 1, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '勾', label: '大指九徽勾一弦' },
    A2_9_T: { str: 2, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '挑', label: '大指九徽挑二弦' },
    A1_9_ZG: { str: 1, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '勾', zhu: true, label: '大指九徽注勾一弦' },
    Q1_10: { str: 1, hui: '十徽', tech: '掐', leftFinger: '名', rightHand: '掐起', gesture: '掐起', label: '名指十徽掐起一弦' },
    A6_9_G: { str: 6, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '勾', label: '大指九徽勾六弦' },
    A7_9_T: { str: 7, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '挑', label: '大指九徽挑七弦' },
    A6_9_ZG: { str: 6, hui: '九徽', tech: '按', leftFinger: '大', rightHand: '勾', zhu: true, label: '大指九徽注勾六弦' },
    Q6_10: { str: 6, hui: '十徽', tech: '掐', leftFinger: '名', rightHand: '掐起', gesture: '掐起', label: '名指十徽掐起六弦' },
    S5_G: { str: 5, hui: null, tech: '散', leftFinger: null, rightHand: '勾', label: '五弦散勾' },
    S6_G: { str: 6, hui: null, tech: '散', leftFinger: null, rightHand: '勾', label: '六弦散勾' },
    A5_10_ZG: { str: 5, hui: '十徽', tech: '按', leftFinger: '中', rightHand: '勾', label: '中指十徽勾五弦' }
  };

  const notes = [];
  let inheritedInstruction = null;
  const inheritedKeys = ['str', 'hui', 'tech', 'leftFinger', 'rightHand'];
  const carryOnly = instruction => inheritedKeys.reduce((out, key) => {
    if (Object.prototype.hasOwnProperty.call(instruction, key)) out[key] = instruction[key];
    return out;
  }, {});
  const glyph = number => glyphBase + number - 1;
  function resolveInstruction(written) {
    // 减字谱省写规则：当前没写出的部分承接前一音。不能因为只剩一个弦数或
    // 一个左手字，就把它擅自解释成散音。只有 explicitOpen 才能重置为散音。
    const base = inheritedInstruction || {};
    const resolved = Object.assign({}, base, written);
    if (written.explicitOpen) {
      resolved.hui = null;
      resolved.tech = '散';
      resolved.finger = null;
    }
    // 绰、注、撞、走手路径只属于当前音，绝不能被下一枚省写字继承。
    inheritedInstruction = carryOnly(resolved);
    return resolved;
  }
  function add(code, glyphNumber, seconds, written) {
    const source = POS[code];
    const p = resolveInstruction(Object.assign({}, source, written || {}, {
      explicitOpen: source.tech === '散'
    }));
    notes.push({
      hui: p.hui, str: p.str, beats: seconds || 0.9, tech: p.tech,
      leftFinger: p.leftFinger || null, rightHand: p.rightHand || null,
      chuo: !!p.chuo, zhu: !!p.zhu, gesture: p.gesture || null,
      slides: p.slides ? p.slides.map(step => Object.assign({}, step)) : null,
      chord: null, same: false,
      jzp: Number.isInteger(p.jzpIndex) ? p.jzpIndex : glyph(glyphNumber),
      note: '秋风词 · ' + p.label
    });
  }
  function addInherited(written, glyphIndex, seconds) {
    const p = resolveInstruction(written || {});
    notes.push({
      hui: p.hui, str: p.str, beats: seconds || 0.9, tech: p.tech,
      leftFinger: p.leftFinger || null, rightHand: p.rightHand || null,
      chuo: false, zhu: false, gesture: null, slides: null,
      chord: null, same: false, jzp: glyphIndex,
      note: '秋风词 · 省写承前补全'
    });
  }
  function cuo(codes, glyphNumber, seconds, displayText, singleVisible, primaryArticulation) {
    const chordId = 'qfc-cuo-' + glyphNumber;
    const chordWord = (primaryArticulation && primaryArticulation.rightHand) || '撮';
    const resolved = codes.map(code => Object.assign({}, POS[code]));
    inheritedInstruction = carryOnly(resolved[resolved.length - 1]);
    // 开头三组撮：琴人只需要点有徽位的左手音珠；散弦是同一次右手撮出的
    // 配合声，不再另画一颗珠、也不要求再点一下。把按音排在主位，散音留作
    // 隐藏伴奏，主珠命中时由发声器同时启动两条弦。
    const order = singleVisible
      ? resolved.map((p, index) => ({ p, index })).sort((a, b) => Number(a.p.tech === '散') - Number(b.p.tech === '散'))
      : resolved.map((p, index) => ({ p, index }));
    order.forEach((entry, drawIndex) => {
      const p = entry.p;
      p.rightHand = chordWord;
      notes.push({
        hui: p.hui, str: p.str, beats: seconds || 1.25, tech: p.tech,
        leftFinger: p.leftFinger || null, rightHand: p.rightHand,
        chuo: drawIndex === 0 && !!(primaryArticulation && primaryArticulation.chuo),
        zhu: drawIndex === 0 && !!(primaryArticulation && primaryArticulation.zhu),
        gesture: null, slides: null,
        chord: chordId, same: drawIndex > 0,
        hidden: !!singleVisible && drawIndex > 0,
        singleTapChord: !!singleVisible,
        jzp: drawIndex ? null : glyph(glyphNumber),
        displayText: drawIndex ? null : (displayText || null),
        note: '秋风词 · ' + chordWord + ' · ' + codes.map(key => POS[key].str + '弦').join('、') + '同发'
      });
    });
  }

  // 已逐字确认的第 1—16 音。连线里的省写音按前字补全；撞的去、回两音
  // 都放进 slides，游戏中必须按住拖拽，不能重新拨弦。
  // 第一音与第三音都带绰：只改变起音为上滑，不把音珠归入粉红走手教学。
  add('A6_9', 1, 0.9, { chuo: true, gesture: null, label: '大指九徽绰挑六弦' });
  add('S4', 2);
  add('A6_9', 3, 1.7, { chuo: true, gesture: null, label: '大指九徽绰挑六弦' });
  // 第4音：六弦散音与七弦七徽六分的绰（上滑起音）同发；第5音：五弦
  // 散音与七弦九徽的注（下滑起音）同发；第6音：四弦散音与六弦九徽
  // 的绰同发。只画有徽位的主珠，散弦作为隐藏同发弦启动。
  cuo(['S6', 'A7_76'], 4, null, null, true, { chuo: true, rightHand: '拨' });
  cuo(['S5', 'A7_9'], 5, null, null, true, { zhu: true });
  cuo(['S4', 'A6_9'], 6, 1.7, null, true, { chuo: true });
  add('A4_10_ZG', 7, 1.45);
  add('A5_10_MG', 8, 0.9, {
    slides: [{ hui: '九徽', beats: 0.56 }, { hui: '七徽六分', beats: 0.56 }],
    gesture: '二上'
  });
  add('S7', 9);
  add('A5_10_CG', 10);
  add('S7', 11, 1.7);
  add('A6_9_CT', 12, 1.25);
  add('A5_9_ZG', 13, 1.25);
  add('Q5_10', 14);
  // 原谱在 14 与 15 之间另有一枚散挑六；旧切字清单漏掉了它，复用同形的第16字。
  add('S6', 16);
  add('A4_10_CG', 15);
  add('S6', 16, 1.7);

  // 第13—17小节：良、旬和立都是同一次发音后的走手，承接前一完整谱字。
  add('A2_9_G', 17, 0.9, { gesture: '退复', slides: [{ hui: '十徽', beats: 0.56 }, { hui: '九徽', beats: 0.56 }] });
  add('A3_9_T', 18, 0.9, { gesture: '上', slides: [{ hui: '七徽九分', beats: 0.7 }] });
  add('A2_9_ZG', 19, 0.9, { gesture: '撞', slides: [{ hui: '七徽六分', beats: 0.56 }, { hui: '九徽', beats: 0.56 }] });
  add('A2_10_MG', 21);
  add('S4', 22);
  add('A2_10_MG', 21);
  add('S4', 22, 1.7);

  // 第18—22小节。
  add('A5_9_G', 23, 0.9, { gesture: '退复', slides: [{ hui: '十徽', beats: 0.56 }, { hui: '九徽', beats: 0.56 }] });
  add('A6_9', 24, 0.9, { gesture: '上', slides: [{ hui: '七徽九分', beats: 0.56 }, { hui: '七徽', beats: 0.56 }] });
  add('A5_9_ZG', 13, 1.25);
  add('Q5_10', 14);
  add('S6', 16);
  add('A4_10_CG', 15);
  add('S6', 16, 1.7);

  // 第23—27小节：单写“勾四”“勾五”“六”都继承前面的“散”。
  add('S5', 29);
  add('S4', 2);
  add('S6', 16);
  add('A4_10_MG', 48);
  add('S6', 16);
  add('S5_G', null, 0.9, { jzpIndex: completedGlyphs.sanGou5 });
  add('S6_G', null, 0.9, { jzpIndex: completedGlyphs.sanGou6 });
  add('S7', 9);
  add('A5_10_CG', 10);
  add('S7', 11, 1.7);

  // 第28—31小节。旧数据把谱上的六弦、七弦误录成一弦、二弦，造成整句
  // 音珠和定位音源一起跑到琴面下方。徽位、指法和走手不变，只纠正弦号。
  add('A6_9_G', 38, 0.9, { gesture: '退复', slides: [{ hui: '九徽半', beats: 0.56 }, { hui: '九徽', beats: 0.56 }] });
  add('A7_9_T', 39, 0.9, { gesture: '上', slides: [{ hui: '七徽六分', beats: 0.7 }] });
  add('A6_9_ZG', 40, 0.9, { gesture: '撞', slides: [{ hui: '七徽九分', beats: 0.56 }, { hui: '九徽', beats: 0.56 }] });
  add('Q6_10', 14);
  add('S7', 9);
  add('A5_10_CG', 10);
  add('S7', 11, 1.7);

  // 第32—35小节。
  add('A5_9_G', 44, 0.9, { gesture: '退复', slides: [{ hui: '十徽', beats: 0.56 }, { hui: '九徽', beats: 0.56 }] });
  add('A6_9', 45, 0.9, { gesture: '上', slides: [{ hui: '七徽九分', beats: 0.56 }, { hui: '七徽', beats: 0.56 }] });
  add('A5_9_ZG', 13, 1.25);
  add('Q5_10', 14);

  // 第36—39小节。
  add('S6', 16);
  add('A4_10_MG', 48);
  add('S6', 16);
  // 原谱此处是“散勾四”，后一字单写“五”承前补成“散勾五”。
  // 旧版误把勾四改成四弦＋六弦九徽的“撮”，使此处多了一弦和一层撮判定。
  // 第50张切图只剩“勾四”，缺了上面的“散”；第22张实际是“散挑四”，
  // 不能再复用。这里使用由原谱“散”部和第50张“勾四”合成的专用完整字图。
  add('S4', null, 0.9, { jzpIndex: completedGlyphs.sanGou4 });
  add('S5_G', null, 0.9, { jzpIndex: completedGlyphs.sanGou5 });
  add('S7', 9);
  add('S6_G', null, 1.7, { jzpIndex: completedGlyphs.sanGou6 });

  // 第40—43小节：“下 中十勾四”之后单写“五”，补成“中十勾五”。
  add('S7', 9);
  add('A5_10_CG', 10);
  add('S7', 11, 1.7);
  // 第42小节的“下”是下句句界标记，不是“注”或下滑记号；四弦十徽干净起音。
  add('A4_10_ZG', 7, 1.25);
  add('A5_10_ZG', null, 0.9, { jzpIndex: completedGlyphs.zhong10Gou5 });
  add('A6_9', 12, 0.9, { gesture: '上', slides: [{ hui: '七徽九分', beats: 0.56 }, { hui: '七徽', beats: 0.56 }] });

  // 第44—47小节。
  add('A5_9_ZG', 13, 1.25);
  add('Q5_10', 14);
  add('S6', 16);
  add('A4_10_MG', 48);
  add('S6', 16, 1.7);

  // 第48—52小节：“从下句作”中的“下”在第40小节“中十勾四”之前，
  // 不能从后面的“大九上”才开始。旧版正好漏了开头的中十勾四、承前补全
  // 的中十勾五两个拨弦音；这里把完整下句八次拨弦全部复奏。
  // 末句“从下句作”照抄同一指法，四弦十徽同样不加下滑。
  add('A4_10_ZG', 7, 1.25);
  add('A5_10_ZG', null, 0.9, { jzpIndex: completedGlyphs.zhong10Gou5 });
  add('A6_9', 12, 0.9, { gesture: '上', slides: [{ hui: '七徽九分', beats: 0.56 }, { hui: '七徽', beats: 0.8 }] });
  add('A5_9_ZG', 13, 1.35);
  add('Q5_10', 14);
  add('S6', 16);
  add('A4_10_MG', 48);
  add('S6', 16, 2.4);

  /* 王悠荻老师示范视频逐音切分。数组是 78 个独立拨弦事件的音头时刻；撮的两弦
     共用同一个时刻，撞、上等走手仍属于前面那一次拨弦。用相邻音头之差重标整曲
     时值，再按原有“本音／走手”比例分配，保证拖拽层级不被示范音频破坏。 */
  const demoOnsets = [
    1.753107, 4.992290, 8.115374, 12.178866, 14.709841, 16.776417, 21.524898,
    24.915011, 28.746304, 30.418141, 32.298957, 35.503311, 38.928254, 41.668209,
    42.585397, 44.234014, 46.370249, 50.073832, 52.848617, 55.855601, 58.479456,
    59.396644, 61.056871, 62.717098, 65.735692, 68.638186, 71.703220, 74.431565,
    75.197823, 76.788390, 78.437007, 81.281451, 82.755918, 84.172336, 85.937052,
    87.132880, 88.642177, 89.420045, 90.221134, 91.881361, 93.808617, 96.676281,
    99.613605, 102.690249, 104.907755, 105.639184, 107.055601, 108.739048,
    111.351293, 114.184127, 117.295601, 119.594376, 120.372245, 122.473651,
    123.843628, 127.013152, 129.230658, 129.927256, 131.320454, 133.050340,
    134.524807, 136.161814, 138.890159, 140.991565, 141.990023, 145.716825,
    148.723810, 149.861587, 154.296599, 157.129433, 160.426667, 163.422041,
    165.935601, 168.449161, 170.597007, 172.547483, 174.497959, 177.435283
  ];
  const demoTail = 179.15;
  let demoEvent = 0;
  for (let i = 0; i < notes.length; i++) {
    if (notes[i].same) continue;
    const start = demoOnsets[demoEvent];
    const end = demoOnsets[demoEvent + 1] || demoTail;
    const measured = Math.max(0.2, end - start);
    const slideTotal = (notes[i].slides || []).reduce((sum, step) => sum + Number(step.beats || 0), 0);
    const oldTotal = Math.max(0.01, Number(notes[i].beats || 0) + slideTotal);
    const scale = measured / oldTotal;
    notes[i].beats = Number(notes[i].beats || 0) * scale;
    if (notes[i].slides) notes[i].slides.forEach(step => { step.beats = Number(step.beats || 0) * scale; });
    notes[i].demoCut = { event: demoEvent + 1, start, duration: measured };
    let j = i + 1;
    while (notes[j] && notes[j].same) {
      notes[j].beats = notes[i].beats;
      notes[j].demoCut = notes[i].demoCut;
      j++;
    }
    demoEvent++;
  }
  if (demoEvent !== demoOnsets.length) {
    console.warn('[秋风词] 谱字拨弦事件与录音切点数量不一致：谱字 ' + demoEvent +
                 '，录音 ' + demoOnsets.length);
  }

  const demoSources = {
    easy: 'assets/qiufengci/demo/秋风词_王悠荻老师_初级原速.m4a',
    normal: 'assets/qiufengci/demo/秋风词_王悠荻老师_中级加速.m4a',
    hard: 'assets/qiufengci/demo/秋风词_王悠荻老师_高级加速.m4a'
  };
  window.QIUFENGCI_CHART = {
    id: 'qiufengci', title: '秋风词', subtitle: '全曲', composer: '古曲', tuning: '正调',
    lead: demoOnsets[0], demoTail, demoSources,
    verified: true, verifiedThrough: 52, notes: notes
  };
  window.QIUFENGCI_DEMO_CUTS = demoOnsets.map((start, index) => ({
    event: index + 1, start, duration: (demoOnsets[index + 1] || demoTail) - start
  }));
  window.QIUFENGCI_DEMOS = demoSources;
  window.QIUFENGCI_DEMO = demoSources.easy;
  // 后续逐字录入统一走 resolveInstruction：例如前字为“名十勾五”，
  // 下一字只写“五”时，数据仍保留“名、十徽、勾”，仅按谱面明确部分覆盖。
  window.QIUFENGCI_ADD_INHERITED = addInherited;
})();
