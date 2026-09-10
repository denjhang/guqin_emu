/* 减字渲染引擎：token(partIds+slotTransforms) → SVG
 * 槽位坐标为 256×256 方块内的左上角 + 宽高。
 * 每个部件的路径自带 viewBox（如 0 0 4 4）与 transform，用嵌套 <svg> 装入槽位。 */
(function () {
  'use strict';
  let glyphs = {};      // label(id) -> {viewBox, paths}
  let partsById = {};   // id -> {id,label,...}

  function init(glyphPaths, glyphParts) {
    const g = glyphPaths.glyphs;
    Object.keys(g).forEach(key => { glyphs[key] = g[key]; });
    (glyphParts || []).forEach(p => {
      partsById[p.id] = p;
      if (p.svg) partsById[p.id].glyphKey = p.svg; // glyph_paths 的键
    });
  }

  function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 渲染一个 token 为 SVG 字符串。size 为显示像素。
  function renderToken(token, size) {
    if (!token || token.kind === 'blank') return '';
    const ids = token.partIds || [];
    const slots = token.slotTransforms || [];
    let inner = '';
    ids.forEach((pid, i) => {
      const part = partsById[pid];
      const g = part && part.glyphKey ? glyphs[part.glyphKey] : glyphs[pid];
      if (!g) return;
      const st = slots[i] || { x: 0, y: 128, lengthX: 256, lengthY: 128 };
      const vb = (g.viewBox || [0, 0, 4, 4]).join(' ');
      const paths = (g.paths || []).map(p =>
        `<path d="${escapeXml(p.d)}" fill="${p.fill || '#2b0000'}"` +
        (p.transform ? ` transform="${escapeXml(p.transform)}"` : '') + '/>'
      ).join('');
      inner += `<svg x="${+st.x}" y="${+st.y}" width="${+st.lengthX}" height="${+st.lengthY}" viewBox="${vb}" preserveAspectRatio="none" overflow="visible">${paths}</svg>`;
    });
    return `<svg class="jz" width="${size}" height="${size}" viewBox="0 0 256 256" role="img" aria-label="${escapeXml(token.text || '')}">${inner}</svg>`;
  }

  window.JianziRender = { init, renderToken, glyphs: () => glyphs, partsById: () => partsById };
})();
