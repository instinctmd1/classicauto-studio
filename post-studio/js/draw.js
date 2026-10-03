/* Classic Auto Post Studio — canvas drawing kit (text, photo, brand pieces, icons). */
(function () {
  'use strict';
  const PS = window.PS, B = PS.B;
  const D = (PS.D = {});
  const HI = /[ऀ-ॿ]/;
  D.hasDeva = (s) => HI.test(s);

  /* ---------- fonts (language-aware) ---------- */
  // dt: translated display copy (Bebas, or Noto Devanagari for Hindi). dl: Latin display (Bebas) for names & prices.
  D.dt = (s) => (PS.isHi() ? `800 ${Math.round(s * 0.82)}px "Noto Sans Devanagari"` : `400 ${s}px "Bebas Neue"`);
  D.dl = (s) => `400 ${s}px "Bebas Neue"`;
  D.bt = (s, w = 600) => (PS.isHi() ? `${Math.min(w, 800)} ${s}px "Noto Sans Devanagari"` : `${w} ${s}px Manrope`);
  D.bl = (s, w = 600) => `${w} ${s}px Manrope`;
  D.hd = (s, w = 800) => `${w} ${s}px "Noto Sans Devanagari"`;
  D.up = (s) => (PS.isHi() ? s : String(s).toUpperCase());

  /* ---------- text ---------- */
  D.tw = function (c, s, font, track) {
    c.save(); c.font = font; let w;
    if (track && !HI.test(s)) { w = 0; for (const ch of s) w += c.measureText(ch).width + track; w -= track; }
    else w = c.measureText(s).width;
    c.restore(); return w;
  };
  // draw one line of text. o: font,color,align,track,alpha,shadow,base. Returns width.
  D.T = function (c, s, x, y, o) {
    s = String(s); o = o || {};
    c.save();
    c.font = o.font; c.fillStyle = o.color || '#fff'; c.textAlign = 'left'; c.textBaseline = o.base || 'alphabetic';
    if (o.alpha != null) c.globalAlpha = o.alpha;
    if (o.shadow) { c.shadowColor = o.shadow[0]; c.shadowBlur = o.shadow[1]; c.shadowOffsetY = o.shadow[2] || 0; }
    const track = HI.test(s) ? 0 : (o.track || 0);
    const w = D.tw(c, s, o.font, track);
    let px = x; if (o.align === 'center') px = x - w / 2; else if (o.align === 'right') px = x - w;
    if (!track) {
      if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = o.stroke[1]; c.strokeStyle = o.stroke[0]; c.strokeText(s, px, y); }
      c.fillText(s, px, y);
    } else { for (const ch of s) { c.fillText(ch, px, y); px += c.measureText(ch).width + track; } }
    c.restore(); return w;
  };
  // sequence of differently-styled runs on one baseline
  D.runs = function (c, runs, x, y, align) {
    let total = 0; const ws = runs.map((r) => { const w = D.tw(c, r.t, r.font, r.track || 0) + (r.gap || 0); total += w; return w; });
    let px = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    runs.forEach((r, i) => { D.T(c, r.t, px, y + (r.dy || 0), { font: r.font, color: r.color, track: r.track }); px += ws[i]; });
    return total;
  };
  // brk: a single word wider than maxW (a web address, a very long name) is broken after / - . _ or, last, between characters. Off by default: a title shrinks instead.
  const graphemes = (t) => (window.Intl && Intl.Segmenter ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t), (x) => x.segment) : Array.from(t));
  D.wrap = function (c, s, font, maxW, track, brk) {
    const pieces = (wd) => {
      if (!brk || D.tw(c, wd, font, track) <= maxW) return [wd];
      const out = []; let cur = '';
      (wd.match(/[^\/\-._]*[\/\-._]?/g) || [wd]).filter(Boolean).forEach((sg) => {
        if (D.tw(c, cur + sg, font, track) <= maxW) { cur += sg; return; }
        if (cur) { out.push(cur); cur = ''; }
        if (D.tw(c, sg, font, track) <= maxW) { cur = sg; return; }
        graphemes(sg).forEach((ch) => { if (!cur || D.tw(c, cur + ch, font, track) <= maxW) cur += ch; else { out.push(cur); cur = ch; } });
      });
      if (cur) out.push(cur); return out;
    };
    const greedy = (words, w) => { const o = []; let line = ''; words.forEach((wd) => {
      const ps = pieces(wd); if (ps.length > 1) { if (line) o.push(line); ps.slice(0, -1).forEach((q) => o.push(q)); line = ps[ps.length - 1]; return; }
      const t = line ? line + ' ' + wd : wd; if (D.tw(c, t, font, track) <= w || !line) line = t; else { o.push(line); line = wd; } }); o.push(line); return o; };
    const out = []; String(s).split('\n').forEach((para) => {
      const words = para.split(/\s+/).filter(Boolean); let lines = greedy(words, maxW);
      // balance: a last line that is one short word is pulled up by narrowing the measure, with the same number of lines (the text never gets wider than maxW)
      const last = lines[lines.length - 1];
      if (lines.length > 1 && !words.some((wd) => D.tw(c, wd, font, track) > maxW) && (last.indexOf(' ') < 0 || D.tw(c, last, font, track) < maxW * 0.34)) {
        let lo = maxW * 0.55, hi = maxW; for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; if (greedy(words, mid).length <= lines.length) hi = mid; else lo = mid; }
        const b = greedy(words, hi); if (b.length === lines.length && b.every((l) => D.tw(c, l, font, track) <= maxW + 0.5)) lines = b;
      }
      lines.forEach((l) => out.push(l));
    });
    return out;
  };
  // paragraph. o: font,color,w,lh,max,align,track. Returns y after last line (baseline of next line).
  D.P = function (c, s, x, y, o) {
    let lines = D.wrap(c, s, o.font, o.w, o.track, true);
    if (o.max && lines.length > o.max) { lines = lines.slice(0, o.max); let l = lines[o.max - 1]; while (l.length > 1 && D.tw(c, l + '…', o.font, o.track) > o.w) l = l.slice(0, -1); lines[o.max - 1] = l.replace(/[ ,.;:]+$/, '') + '…'; }
    lines.forEach((l, i) => { const ax = o.align === 'center' ? x + o.w / 2 : o.align === 'right' ? x + o.w : x; D.T(c, l, ax, y + i * o.lh, { font: o.font, color: o.color, align: o.align, track: o.track, alpha: o.alpha }); });
    return y + lines.length * o.lh;
  };
  D.lines = (c, s, font, w, max) => { let l = D.wrap(c, s, font, w, 0, true); return max ? Math.min(l.length, max) : l.length; };
  // largest size <= max such that the text fits maxW
  D.fit = function (c, s, fontFn, maxW, max, min, track) {
    let sz = max; while (sz > min && D.tw(c, s, fontFn(sz), track) > maxW) sz -= 2; return sz;
  };

  // cut a line at a word boundary and add an ellipsis so it fits maxW
  D.ellip = function (c, s, font, maxW, track) {
    s = String(s); if (D.tw(c, s, font, track) <= maxW) return s;
    const words = s.split(' ');
    while (words.length > 1 && D.tw(c, words.join(' ') + '…', font, track) > maxW) words.pop();
    let t = words.join(' ');
    while (t.length > 1 && D.tw(c, t + '…', font, track) > maxW) t = t.slice(0, -1);
    return t.replace(/[ ,.;:·-]+$/, '') + '…';
  };
  // largest size in [min,max] where the text wraps to <= maxLines lines that all fit w. If none, use min and end the last line with an ellipsis.
  // Returns {size, lines, cut}
  D.fitWrap = function (c, s, fontFn, w, max, min, maxLines, track) {
    s = String(s); let sz = Math.max(min, max);
    for (; sz >= min; sz -= 2) {
      const f = fontFn(sz), lines = D.wrap(c, s, f, w, track);
      if (lines.length <= maxLines && lines.every((l) => D.tw(c, l, f, track) <= w + 0.5)) return { size: sz, lines, cut: false };
    }
    sz = min; const f = fontFn(sz); let lines = D.wrap(c, s, f, w, track, true);      // last resort: a word wider than the box is broken, not cut off
    if (lines.length > maxLines) lines = lines.slice(0, maxLines - 1).concat([lines.slice(maxLines - 1).join(' ')]);
    lines = lines.map((l, i) => (i === lines.length - 1 || D.tw(c, l, f, track) > w ? D.ellip(c, l, f, w, track) : l));
    return { size: sz, lines, cut: true };
  };

  /* ---------- shapes ---------- */
  D.rr = function (c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  };
  D.fillRR = (c, x, y, w, h, r, f) => { D.rr(c, x, y, w, h, r); c.fillStyle = f; c.fill(); };
  D.strokeRR = (c, x, y, w, h, r, s, lw) => { D.rr(c, x, y, w, h, r); c.strokeStyle = s; c.lineWidth = lw || 2; c.stroke(); };
  D.para = function (c, x, y, w, h, sk) { c.beginPath(); c.moveTo(x + sk, y); c.lineTo(x + w + sk, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); };
  D.lin = function (c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s) => g.addColorStop(s[0], s[1])); return g; };
  D.rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  D.chequer = function (c, x, y, w, h, sq, a, b) {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    const rows = Math.ceil(h / sq), cols = Math.ceil(w / sq);
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { c.fillStyle = (r + k) % 2 ? a : b; c.fillRect(x + k * sq, y + r * sq, sq, sq); }
    c.restore();
  };

  /* ---------- logo ---------- */
  D.logo = null;
  D.logoReady = PS.loadImage('assets/logo.png').then((i) => (D.logo = i));
  // assets/logo.png is the lockup the followers see on every real post (cropped from the live Instagram listings by tools/prep_logo.py): red C, blue A, SINCE 1974, CLASSIC AUTO, PRE OWNED CARS
  let LOGO_AR = 1.911;
  D.logoReady = D.logoReady.then((i) => { if (i && i.width) LOGO_AR = i.width / i.height; return i; });
  D.logoAR = () => LOGO_AR;
  // cream plate holding the real logo. h = plate height. Returns plate width.
  D.logoPlate = function (c, x, y, h) {
    const pad = h * 0.13, lh = h - pad * 2, lw = lh * LOGO_AR, w = lw + pad * 2;
    D.fillRR(c, x, y, w, h, h * 0.16, B.cream);
    if (D.logo) c.drawImage(D.logo, x + pad, y + pad, lw, lh);
    return w;
  };
  D.logoW = (h) => (h - h * 0.26) * LOGO_AR + h * 0.26;

  /* ---------- icons (stroke, 24-unit grid centred on cx,cy) ---------- */
  D.icon = function (c, name, cx, cy, size, color, lw) {
    c.save(); c.translate(cx - size / 2, cy - size / 2); c.scale(size / 24, size / 24);
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = lw || 2; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    switch (name) {
      case 'check': c.moveTo(4, 12.5); c.lineTo(9.5, 18); c.lineTo(20, 6); c.stroke(); break;
      case 'shield': c.moveTo(12, 2.5); c.lineTo(20, 5.5); c.lineTo(20, 12); c.bezierCurveTo(20, 17, 16.5, 20.5, 12, 22); c.bezierCurveTo(7.5, 20.5, 4, 17, 4, 12); c.lineTo(4, 5.5); c.closePath(); c.stroke();
        c.beginPath(); c.moveTo(8.5, 12.2); c.lineTo(11, 14.7); c.lineTo(15.8, 9.4); c.stroke(); break;
      case 'calendar': D.rr(c, 3.5, 5, 17, 15.5, 2.5); c.stroke(); c.beginPath(); c.moveTo(3.5, 10); c.lineTo(20.5, 10); c.moveTo(8, 3); c.lineTo(8, 7); c.moveTo(16, 3); c.lineTo(16, 7); c.stroke(); break;
      case 'rupee': c.moveTo(6.5, 4.5); c.lineTo(17.5, 4.5); c.moveTo(6.5, 9); c.lineTo(17.5, 9); c.moveTo(6.5, 4.5); c.bezierCurveTo(14, 4.5, 14, 14, 6.5, 14); c.lineTo(15.5, 21); c.stroke(); break;
      case 'swap': c.moveTo(4, 8); c.lineTo(19, 8); c.moveTo(15, 4); c.lineTo(19, 8); c.lineTo(15, 12); c.moveTo(20, 16); c.lineTo(5, 16); c.moveTo(9, 12); c.lineTo(5, 16); c.lineTo(9, 20); c.stroke(); break;
      case 'chat': D.rr(c, 3, 4, 18, 13, 3); c.stroke(); c.beginPath(); c.moveTo(8, 17); c.lineTo(7, 21.5); c.lineTo(13, 17); c.stroke(); break;
      case 'pin': c.moveTo(12, 21.5); c.bezierCurveTo(6, 15, 5, 12, 5, 9.5); c.arc(12, 9.5, 7, Math.PI, 0); c.bezierCurveTo(19, 12, 18, 15, 12, 21.5); c.stroke(); c.beginPath(); c.arc(12, 9.5, 2.6, 0, 7); c.stroke(); break;
      case 'arrow': c.moveTo(4, 12); c.lineTo(20, 12); c.moveTo(14, 6); c.lineTo(20, 12); c.lineTo(14, 18); c.stroke(); break;
      case 'arrowDown': c.moveTo(12, 4); c.lineTo(12, 20); c.moveTo(6, 14); c.lineTo(12, 20); c.lineTo(18, 14); c.stroke(); break;
      case 'key': c.arc(8, 12, 4.5, 0, 7); c.moveTo(12.5, 12); c.lineTo(21, 12); c.moveTo(18, 12); c.lineTo(18, 16); c.moveTo(21, 12); c.lineTo(21, 15); c.stroke(); break;
      case 'search': c.arc(10.5, 10.5, 6.5, 0, 7); c.moveTo(15.5, 15.5); c.lineTo(21, 21); c.stroke(); break;
      case 'people': c.arc(9, 8, 3.4, 0, 7); c.moveTo(2.8, 20); c.bezierCurveTo(2.8, 14, 15.2, 14, 15.2, 20); c.moveTo(16, 4.8); c.bezierCurveTo(19.5, 5, 19.5, 11, 16, 11.2); c.moveTo(17.5, 14.4); c.bezierCurveTo(20, 15, 21.2, 17, 21.2, 20); c.stroke(); break;
      case 'tag': c.moveTo(3, 4); c.lineTo(12, 4); c.lineTo(21, 13); c.lineTo(13, 21); c.lineTo(3, 11); c.closePath(); c.stroke(); c.beginPath(); c.arc(7.5, 8.5, 1.4, 0, 7); c.fill(); break;
      case 'star': { c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.8 : 11, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r); } c.closePath(); c.fill(); break; }
      case 'phone': c.moveTo(6.5, 3.2); c.lineTo(9.6, 3.2); c.lineTo(11.2, 8); c.lineTo(8.9, 9.7); c.bezierCurveTo(10, 12.3, 11.8, 14.1, 14.4, 15.2); c.lineTo(16.1, 12.9); c.lineTo(20.8, 14.4); c.lineTo(20.8, 17.6); c.bezierCurveTo(20.8, 19.6, 19.3, 20.8, 17.6, 20.8); c.bezierCurveTo(9.7, 20.8, 3.2, 14.3, 3.2, 6.4); c.bezierCurveTo(3.2, 4.7, 4.5, 3.2, 6.5, 3.2); c.closePath(); c.fill(); break;
      case 'person': c.arc(12, 7.6, 4.2, 0, 7); c.fill(); c.beginPath(); c.moveTo(3.8, 21); c.bezierCurveTo(3.8, 13.2, 20.2, 13.2, 20.2, 21); c.closePath(); c.fill(); break;
      case 'fuel': D.rr(c, 4.5, 3, 9.5, 18, 1.8); c.stroke(); c.beginPath(); D.rr(c, 6.8, 5.4, 4.9, 4.6, 0.8); c.fill(); c.beginPath(); c.moveTo(14, 9.5); c.lineTo(16.6, 9.5); c.quadraticCurveTo(19.3, 9.5, 19.3, 12.2); c.lineTo(19.3, 17.2); c.arc(20.9, 17.2, 1.6, Math.PI, 0); c.lineTo(22.5, 9); c.lineTo(20.2, 6.2); c.stroke(); c.beginPath(); c.moveTo(2.8, 21); c.lineTo(15.7, 21); c.stroke(); break;
      case 'gear': { c.arc(12, 12, 6.2, 0, 7); c.stroke(); c.beginPath(); c.arc(12, 12, 2.6, 0, 7); c.fill(); c.beginPath(); c.lineWidth = (lw || 2) * 1.5; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.moveTo(12 + Math.cos(a) * 7.4, 12 + Math.sin(a) * 7.4); c.lineTo(12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10); } c.stroke(); break; }
      case 'speedo': c.arc(12, 13.5, 9, Math.PI * 0.82, Math.PI * 2.18); c.stroke(); c.beginPath(); c.moveTo(12, 13.5); c.lineTo(16.6, 8.4); c.stroke(); c.beginPath(); c.arc(12, 13.5, 1.9, 0, 7); c.fill(); for (let i = 0; i < 5; i++) { const a = Math.PI * (1.0 + i * 0.25); c.beginPath(); c.moveTo(12 + Math.cos(a) * 6.2, 13.5 + Math.sin(a) * 6.2); c.lineTo(12 + Math.cos(a) * 7.6, 13.5 + Math.sin(a) * 7.6); c.stroke(); } break;
      case 'shieldCheck': c.moveTo(12, 2.3); c.lineTo(20.4, 5.4); c.lineTo(20.4, 12); c.bezierCurveTo(20.4, 17.2, 16.8, 20.8, 12, 22.3); c.bezierCurveTo(7.2, 20.8, 3.6, 17.2, 3.6, 12); c.lineTo(3.6, 5.4); c.closePath(); c.fill(); c.beginPath(); c.strokeStyle = '#fff'; c.lineWidth = (lw || 2) * 1.2; c.moveTo(8.2, 12.2); c.lineTo(11, 15); c.lineTo(16, 9.4); c.stroke(); break;
      case 'palette': c.arc(12, 12, 9.2, 0, 7); c.stroke(); [[8, 9], [12.5, 7.2], [16.4, 10], [7.8, 14.4]].forEach((p) => { c.beginPath(); c.arc(p[0], p[1], 1.7, 0, 7); c.fill(); }); c.beginPath(); c.arc(14, 15.2, 2.4, 0, 7); c.stroke(); break;
      case 'carFront': c.moveTo(3.2, 18.5); c.lineTo(3.2, 12.5); c.quadraticCurveTo(3.2, 11, 4.6, 10.6); c.lineTo(6.4, 5.8); c.quadraticCurveTo(6.8, 4.8, 8, 4.8); c.lineTo(16, 4.8); c.quadraticCurveTo(17.2, 4.8, 17.6, 5.8); c.lineTo(19.4, 10.6); c.quadraticCurveTo(20.8, 11, 20.8, 12.5); c.lineTo(20.8, 18.5); c.lineTo(17.8, 18.5); c.lineTo(17.8, 16.8); c.lineTo(6.2, 16.8); c.lineTo(6.2, 18.5); c.closePath(); c.fill(); c.beginPath(); c.strokeStyle = '#fff'; c.lineWidth = (lw || 2) * 0.9; c.moveTo(7.6, 10.2); c.lineTo(8.7, 7); c.lineTo(15.3, 7); c.lineTo(16.4, 10.2); c.closePath(); c.stroke(); break;
      case 'seat': c.moveTo(7.2, 3.2); c.quadraticCurveTo(10.6, 2.6, 11.4, 5.6); c.lineTo(13.4, 13.2); c.lineTo(19.4, 14.4); c.quadraticCurveTo(21, 14.8, 21, 16.4); c.lineTo(21, 18.4); c.lineTo(9.6, 18.4); c.quadraticCurveTo(7.6, 18.4, 7, 16.4); c.lineTo(5, 7); c.quadraticCurveTo(4.8, 4.2, 7.2, 3.2); c.closePath(); c.fill(); c.beginPath(); c.moveTo(10, 21.4); c.lineTo(19, 21.4); c.stroke(); break;
      case 'doc': D.rr(c, 5, 2.8, 14, 18.4, 2.2); c.stroke(); c.beginPath(); c.moveTo(8.4, 8.4); c.lineTo(15.6, 8.4); c.moveTo(8.4, 12); c.lineTo(15.6, 12); c.moveTo(8.4, 15.6); c.lineTo(13, 15.6); c.stroke(); break;
      case 'calGrid': D.rr(c, 3.2, 4.6, 17.6, 16.4, 2.4); c.stroke(); c.beginPath(); c.moveTo(3.2, 9.4); c.lineTo(20.8, 9.4); c.moveTo(8, 2.6); c.lineTo(8, 6.4); c.moveTo(16, 2.6); c.lineTo(16, 6.4); c.stroke(); for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) { c.beginPath(); c.rect(5.4 + k * 3.7, 11.2 + r * 3.2, 2.3, 2); c.fill(); } break;
      case 'handshake': ['m11 17 2 2a1 1 0 1 0 3-3', 'm14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4', 'm21 3 1 11h-2', 'M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3', 'M3 4h8'].forEach((d) => c.stroke(new Path2D(d))); break;      // outline glyph (path data after Lucide's 'handshake', ISC licence)
      case 'chart': c.moveTo(2.6, 21.2); c.lineTo(21.4, 21.2); c.stroke(); c.beginPath(); c.rect(4, 14, 3.8, 7); c.rect(10, 9.6, 3.8, 11.4); c.rect(16, 5.2, 3.8, 15.8); c.fill(); c.beginPath(); c.moveTo(3.6, 9); c.lineTo(9.6, 4.6); c.lineTo(12.8, 7); c.lineTo(20.6, 1.8); c.stroke(); break;
      case 'swapBold': c.moveTo(3.5, 9); c.bezierCurveTo(4.6, 5.4, 8, 3.4, 11.6, 3.8); c.bezierCurveTo(14, 4, 16, 5.2, 17.4, 7); c.stroke(); c.beginPath(); c.moveTo(17.8, 2.8); c.lineTo(17.8, 7.6); c.lineTo(13, 7.6); c.stroke(); c.beginPath(); c.moveTo(20.5, 15); c.bezierCurveTo(19.4, 18.6, 16, 20.6, 12.4, 20.2); c.bezierCurveTo(10, 20, 8, 18.8, 6.6, 17); c.stroke(); c.beginPath(); c.moveTo(6.2, 21.2); c.lineTo(6.2, 16.4); c.lineTo(11, 16.4); c.stroke(); break;
      case 'ribbon': c.moveTo(12, 2.5); c.lineTo(14.4, 8.6); c.lineTo(21, 9); c.lineTo(15.9, 13.3); c.lineTo(17.6, 19.8); c.lineTo(12, 16.2); c.lineTo(6.4, 19.8); c.lineTo(8.1, 13.3); c.lineTo(3, 9); c.lineTo(9.6, 8.6); c.closePath(); c.fill(); break;
      default: c.arc(12, 12, 8, 0, 7); c.stroke();
    }
    c.restore();
  };

  /* ---------- badges and tags ---------- */
  // parallelogram tag (echoes the italic A of the logo). Returns width.
  D.tag = function (c, text, x, y, o) {
    o = o || {}; const h = o.h || 60, size = o.size || 28, sk = h * 0.26, pad = h * 0.5;
    const font = o.font || D.bt(size, 800), t = o.raw ? text : D.up(text);
    const tr = o.track != null ? o.track : (PS.isHi() ? 0 : size * 0.1);
    const tw = D.tw(c, t, font, tr), w = tw + pad * 2;
    let x0 = x; if (o.align === 'right') x0 = x - w - sk;
    c.save(); D.para(c, x0, y, w, h, sk);
    if (o.shadow) { c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 18; c.shadowOffsetY = 6; }
    c.fillStyle = o.bg || B.off; c.fill(); c.restore();
    if (o.border) { c.save(); D.para(c, x0, y, w, h, sk); c.strokeStyle = o.border; c.lineWidth = 2; c.stroke(); c.restore(); }
    D.T(c, t, x0 + pad + sk / 2, y + h / 2 + size * (PS.isHi() ? 0.34 : 0.36), { font, color: o.fg || B.ink, track: tr });
    return w + sk;
  };

  /* ---------- photos ---------- */
  const adjFilterOK = (() => { try { return 'filter' in CanvasRenderingContext2D.prototype; } catch (e) { return false; } })();
  D.adjFilterOK = adjFilterOK;
  const imgDims = (img) => [img.naturalWidth || img.width, img.naturalHeight || img.height];
  function coverRect(iw, ih, r, zoom, px, py) {
    const s = Math.max(r.w / iw, r.h / ih) * zoom, dw = iw * s, dh = ih * s;
    return { x: r.x - (dw - r.w) * px, y: r.y - (dh - r.h) * py, w: dw, h: dh };
  }
  function containRect(iw, ih, r, zoom, px, py) {
    const s = Math.min(r.w / iw, r.h / ih) * zoom, dw = iw * s, dh = ih * s;
    return { x: dw <= r.w ? r.x + (r.w - dw) / 2 : r.x - (dw - r.w) * px, y: dh <= r.h ? r.y + (r.h - dh) / 2 : r.y - (dh - r.h) * py, w: dw, h: dh };
  }
  function filterStr(P) { return (P.bright || P.contrast) ? `brightness(${1 + P.bright / 100}) contrast(${1 + P.contrast / 100})` : 'none'; }
  const tmp = document.createElement('canvas');
  function blurBackdrop(c, img, r, P) {
    const [iw, ih] = imgDims(img); const cr = coverRect(iw, ih, r, 1.15, 0.5, 0.5);
    c.save(); c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
    // downscale-upscale gives a cheap, browser-independent blur
    const sc = 1 / 18; tmp.width = Math.max(8, Math.round(r.w * sc)); tmp.height = Math.max(8, Math.round(r.h * sc));
    const t = tmp.getContext('2d'); t.imageSmoothingQuality = 'high'; t.clearRect(0, 0, tmp.width, tmp.height);
    t.drawImage(img, (cr.x - r.x) * sc, (cr.y - r.y) * sc, cr.w * sc, cr.h * sc);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(tmp, r.x, r.y, r.w, r.h);
    c.fillStyle = 'rgba(10,22,51,.38)'; c.fillRect(r.x, r.y, r.w, r.h);
    c.restore();
  }
  D.blurBack = blurBackdrop;
  // The only change to the car's own pixels this tool can make: a blur over a number plate the owner marked (Settings > plate tool).
  // plate = {x,y,w,h} as fractions of the photo. The honesty label says so. Pixelate-then-smooth, so it works in every browser.
  function plateBlur(c, img, dr, pl) {
    const [iw, ih] = imgDims(img), rx = dr.x + pl.x * dr.w, ry = dr.y + pl.y * dr.h, rw = pl.w * dr.w, rh = pl.h * dr.h; if (rw < 2 || rh < 2) return;
    const t = document.createElement('canvas'), sc = Math.max(0.04, Math.min(1, 14 / Math.max(rw, rh))); t.width = Math.max(2, Math.round(rw * sc)); t.height = Math.max(2, Math.round(rh * sc));
    const tc = t.getContext('2d'); tc.imageSmoothingQuality = 'high'; tc.drawImage(img, pl.x * iw, pl.y * ih, pl.w * iw, pl.h * ih, 0, 0, t.width, t.height);
    c.save(); D.rr(c, rx, ry, rw, rh, Math.min(rw, rh) * 0.12); c.clip(); c.imageSmoothingEnabled = true; c.drawImage(t, rx, ry, rw, rh);
    c.fillStyle = 'rgba(128,128,128,.12)'; c.fillRect(rx, ry, rw, rh); c.restore();
  }
  // Placeholder when no photo has been added yet
  function placeholder(c, r, S, label) {
    c.save(); c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
    c.fillStyle = D.lin(c, r.x, r.y, r.x + r.w, r.y + r.h, [[0, '#16275A'], [1, '#0A1633']]); c.fillRect(r.x, r.y, r.w, r.h);
    c.globalAlpha = 0.07; D.chequer(c, r.x, r.y, r.w, r.h, Math.max(24, r.w / 30), '#fff', 'rgba(0,0,0,0)'); c.globalAlpha = 1;
    if (!S.exporting) {
      const s = Math.max(30, Math.min(r.w, r.h) * 0.045);
      D.T(c, label || 'Drop a car photo', r.x + r.w / 2, r.y + r.h / 2, { font: D.bl(s, 700), color: 'rgba(247,245,240,.7)', align: 'center' });
    }
    c.restore();
  }
  /* place a photo. fill: rect to cover in 'fill' mode. fit: rect to contain in 'fit' mode (defaults to fill);
     back: area to blur-fill behind a contained photo (defaults to fill). Registers a drag slot. */
  D.photo = function (c, S, key, P, fill, o) {
    o = o || {}; const fitR = o.fit || fill, back = o.back || fill;
    S._slots = S._slots || []; S._labels = S._labels || [];
    if (!P || !P.img) { placeholder(c, fill, S, o.label); S._slots.push({ key, r: fill }); return { mode: 'none' }; }
    const [iw, ih] = imgDims(P.img);
    let mode = P.fit; if (o.forceMode) mode = o.forceMode;
    if (mode === 'auto' || !mode) {                      // crop to fill by default; when that would keep less than about 62 percent of the picture (a landscape photo on a tall post), show the whole car instead
      mode = 'fill'; if (!o.forceMode) { const cr0 = coverRect(iw, ih, fill, 1, 0.5, 0.5); if (Math.min(fill.w / cr0.w, fill.h / cr0.h) < 0.62) mode = 'fit'; }
    }
    if (P.src === 'stock') S._samplePhoto = true;       // a bundled layout-test photo is not our car: the render is stamped and cannot be exported
    c.save();
    const adj = filterStr(P); const usedAdj = adj !== 'none' && adjFilterOK;
    if (mode === 'fit') {
      blurBackdrop(c, P.img, back, P);
      const dr = containRect(iw, ih, fitR, P.zoom, P.px, P.py);
      if (o.shadowFit !== false) { // soft shadow under the photo: it sits on its own blurred backdrop like a framed print, not a letterbox
        c.save(); c.beginPath(); c.rect(back.x, back.y, back.w, back.h); c.clip();
        c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 46; c.shadowOffsetY = 12; c.fillStyle = '#000';
        const sx = Math.max(dr.x, fitR.x), sy = Math.max(dr.y, fitR.y); c.fillRect(sx, sy, Math.min(dr.x + dr.w, fitR.x + fitR.w) - sx, Math.min(dr.y + dr.h, fitR.y + fitR.h) - sy); c.restore();
      }
      c.beginPath(); c.rect(fitR.x, fitR.y, fitR.w, fitR.h); c.clip();
      if (usedAdj) c.filter = adj;
      c.drawImage(P.img, dr.x, dr.y, dr.w, dr.h);
      if (P.plate) plateBlur(c, P.img, dr, P.plate);
      S._slots.push({ key, r: fitR, dr, mode });
    } else {
      c.beginPath(); c.rect(fill.x, fill.y, fill.w, fill.h); c.clip();
      const dr = coverRect(iw, ih, fill, P.zoom, P.px, P.py);
      if (usedAdj) c.filter = adj;
      c.drawImage(P.img, dr.x, dr.y, dr.w, dr.h);
      if (P.plate) plateBlur(c, P.img, dr, P.plate);
      S._slots.push({ key, r: fill, dr, mode });
    }
    c.restore();
    { const dd = S._slots[S._slots.length - 1]; if (key === 'main' && dd && dd.dr && dd.dr.w / iw > 1.35) PS.note(S, `This photo is small (${iw} px wide) for this size and will look soft. Add a larger photo if you have one.`); }
    const parts = []; if (mode === 'fit' && !(P.fit === 'auto' || !P.fit)) parts.push(PS.tx('adjLabelBlur')); else if (mode === 'fit') parts.push(PS.tx('adjLabelBlur')); if (usedAdj) parts.push(PS.tx('adjLabelBright')); if (P.plate) parts.push(PS.tx('adjLabelPlate'));
    if (parts.length) S._labels.push(parts.join(' + '));
    return { mode };
  };
  /* place a photo for the Classic Listing: scaled to cover most of rect R (never letterboxed), anchored bottom-right, feathered into the
     white ground on the left / top / bottom. A PNG with transparency (a cut-out car) sits on a drawn light backdrop with a contact shadow.
     Brightness, contrast and the labelled plate blur apply. Returns the drawn rect (for drag slots). o.feather {l,t,b,r} in px. */
  const offc = document.createElement('canvas');
  // Scales to CONTAIN in R (the whole car always shows), then up to o.minFrac of R's width when that would leave the car too small; anchored
  // to the right and low in R (the car stands on the floor line). Feathers are measured from the drawn photo's own edges, so no hard edge shows.
  D.photoPlaced = function (c, S, P, R, o) {
    o = o || {}; const f = o.feather || {}, [iw, ih] = imgDims(P.img), zoom = P.zoom || 1, minFrac = o.minFrac || 0.86;
    let sc = Math.min(R.w / iw, R.h / ih); if (iw * sc < R.w * minFrac) sc = (R.w * minFrac) / iw;
    if (o.maxScale && sc > o.maxScale) { if (sc > o.maxScale * 1.02) PS.note(S, `This photo is small (${iw} px wide) for this size, so the car is shown smaller to stay sharp. Add a larger photo for a full-width car.`); sc = o.maxScale; }      // never enlarge a photo more than about 1.3x
    sc *= zoom;
    const dw = iw * sc, dh = ih * sc;
    const x = dw >= R.w ? R.x - (dw - R.w) * P.px : R.x + (R.w - dw) * (o.anchorX != null ? o.anchorX : 1), y = dh >= R.h ? R.y - (dh - R.h) * P.py : R.y + (R.h - dh) * (o.slackY != null ? o.slackY : 0.8), dr = { x, y, w: dw, h: dh };
    offc.width = Math.ceil(R.w); offc.height = Math.ceil(R.h); const oc = offc.getContext('2d'); oc.clearRect(0, 0, offc.width, offc.height);
    oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = 'high';
    const cut = !!o.cut, lx = x - R.x, ty = y - R.y;
    if (cut) {                                       // drawn backdrop under a cut-out car: soft studio grey, floor glow, contact shadow
      if (!o.noBackdrop) { oc.fillStyle = D.lin(oc, 0, 0, 0, R.h, [[0, '#EEF1F6'], [0.62, '#F8F9FC'], [1, '#DDE2EC']]); oc.fillRect(0, 0, R.w, R.h); }
      const fy = ty + dh * 0.92, g = oc.createRadialGradient(R.w * 0.55, fy, 10, R.w * 0.55, fy, dw * 0.55); g.addColorStop(0, 'rgba(10,22,51,.30)'); g.addColorStop(1, 'rgba(10,22,51,0)');
      oc.save(); oc.translate(0, fy); oc.scale(1, 0.12); oc.translate(0, -fy); oc.fillStyle = g; oc.fillRect(0, fy - dw, R.w, dw * 2); oc.restore();
    }
    const adj = filterStr(P), usedAdj = adj !== 'none' && adjFilterOK; if (usedAdj) oc.filter = adj;
    oc.drawImage(P.img, lx, ty, dw, dh); oc.filter = 'none';
    if (P.plate) plateBlur(oc, P.img, { x: lx, y: ty, w: dw, h: dh }, P.plate);
    // feather (each destination-in multiplies the alpha)
    const ease = (a, b, c0, c1, horiz) => { const g = horiz ? oc.createLinearGradient(a, 0, b, 0) : oc.createLinearGradient(0, a, 0, b); g.addColorStop(0, `rgba(0,0,0,${c0})`); g.addColorStop(0.45, `rgba(0,0,0,${(c0 + (c1 - c0) * 0.3).toFixed(3)})`); g.addColorStop(1, `rgba(0,0,0,${c1})`); return g; };
    oc.globalCompositeOperation = 'destination-in';
    if (o.radial) {                                  // an oval mask round the car instead of a rectangle: no straight edge shows against a backdrop of a different colour
      oc.save(); oc.translate(lx + dw / 2, ty + dh * 0.54); oc.scale(dw * o.radial[0], dh * o.radial[1]); const rg = oc.createRadialGradient(0, 0, 0, 0, 0, 1);
      rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(o.radial[2], 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); oc.fillStyle = rg; oc.fillRect(-1.2, -1.2, 2.4, 2.4); oc.restore();
    }
    if (f.l > 0) { const a0 = Math.max(0, lx); oc.fillStyle = ease(a0, a0 + f.l, 0, 1, true); oc.fillRect(0, 0, R.w, R.h); }
    if (f.t > 0) { const a0 = Math.max(0, ty); oc.fillStyle = ease(a0, a0 + f.t, 0, 1, false); oc.fillRect(0, 0, R.w, R.h); }
    if (f.b > 0) { const b1 = Math.min(R.h, ty + dh); oc.fillStyle = ease(b1 - f.b, b1, 1, 0, false); oc.fillRect(0, 0, R.w, R.h); }
    if (f.r > 0) { const r1 = Math.min(R.w, lx + dw); oc.fillStyle = ease(r1, r1 - f.r, 0, 1, true); oc.fillRect(0, 0, R.w, R.h); }
    oc.globalCompositeOperation = 'source-over';
    c.drawImage(offc, R.x, R.y);
    const parts = []; if (cut) parts.push(PS.tx('adjLabelBg')); if (usedAdj) parts.push(PS.tx('adjLabelBright')); if (P.plate) parts.push(PS.tx('adjLabelPlate'));
    if (parts.length) S._labels.push(parts.join(' + '));
    return dr;
  };
  /* Signature photo slot, part 1: a normal photo in a rounded frame. White mat, soft shadow, the photo cropped to fill (or the whole photo over a blurred
     copy of itself when the owner picked "Show whole photo"). Registers the drag slot. R = {x,y,w,h}. The car's own pixels are untouched. */
  D.framePhoto = function (c, S, P, R, o) {
    o = o || {}; const rad = o.radius || 36, mat = o.mat == null ? 9 : o.mat; S._slots = S._slots || [];
    c.save(); c.shadowColor = 'rgba(10,26,58,.28)'; c.shadowBlur = 46; c.shadowOffsetY = 16; D.fillRR(c, R.x, R.y, R.w, R.h, rad, '#FFFFFF'); c.restore();
    const I = { x: R.x + mat, y: R.y + mat, w: R.w - 2 * mat, h: R.h - 2 * mat }, ir = Math.max(10, rad - mat * 0.7);
    if (!P || !P.img) {
      D.fillRR(c, I.x, I.y, I.w, I.h, ir, '#EDF1F7'); S._slots.push({ key: 'main', r: I });
      if (!S.exporting) { c.save(); c.setLineDash([14, 10]); D.strokeRR(c, I.x + 16, I.y + 16, I.w - 32, I.h - 32, ir - 6, '#9AA5BF', 3); c.restore(); D.T(c, 'Add the car photo first', I.x + I.w / 2, I.y + I.h / 2 + 10, { font: D.bl(Math.max(24, Math.min(36, I.w / 16)), 700), color: '#7C88A8', align: 'center' }); }
      return null;
    }
    c.save(); D.rr(c, I.x, I.y, I.w, I.h, ir); c.clip(); D.photo(c, S, 'main', P, I, {}); c.restore();
    D.strokeRR(c, I.x, I.y, I.w, I.h, ir, 'rgba(10,26,58,.10)', 2);
    return I;
  };
  /* Signature photo slot, part 2: a cut-out car (PNG with a transparent background, for example the listing kit's cutout.png) on a drawn showroom stage:
     a soft grey wall with panel seams and a light strip, a polished floor, a contact shadow and a faint reflection. Only the background is drawn; the car's
     pixels are placed as they are (the honesty label says "background edited, car unretouched"). Zoom and the position sliders move the car on the stage. */
  D.stage = function (c, S, P, R, o) {
    o = o || {}; const rad = o.radius || 36; S._slots = S._slots || []; S._labels = S._labels || [];
    const [iw, ih] = imgDims(P.img), zoom = P.zoom || 1, bw = R.w * 0.92, bh = R.h * 0.76;
    const sc = Math.min(bw / iw, bh / ih) * zoom, dw = iw * sc, dh = ih * sc, travX = R.w * 0.35, travY = R.h * 0.3;
    const cx = R.x + R.w / 2 + (0.5 - P.px) * travX, bottom = R.y + R.h * 0.865 + (0.55 - P.py) * travY, dr = { x: cx - dw / 2, y: bottom - dh, w: dw, h: dh };
    const floorY = Math.min(R.y + R.h * 0.8, Math.max(R.y + R.h * 0.5, bottom - dh * 0.3));
    c.save(); c.shadowColor = 'rgba(10,26,58,.28)'; c.shadowBlur = 46; c.shadowOffsetY = 16; D.fillRR(c, R.x, R.y, R.w, R.h, rad, '#DDE3EE'); c.restore();
    c.save(); D.rr(c, R.x, R.y, R.w, R.h, rad); c.clip();
    // wall
    c.fillStyle = D.lin(c, 0, R.y, 0, floorY, [[0, '#C7CFDD'], [0.55, '#E3E8F1'], [1, '#F1F4F9']]); c.fillRect(R.x, R.y, R.w, floorY - R.y + 2);
    const gl = c.createRadialGradient(cx, R.y + R.h * 0.42, 10, cx, R.y + R.h * 0.42, R.w * 0.62); gl.addColorStop(0, 'rgba(255,255,255,.85)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gl; c.fillRect(R.x, R.y, R.w, floorY - R.y);
    c.fillStyle = 'rgba(10,26,58,.05)'; for (let i = 1; i < 6; i++) c.fillRect(Math.round(R.x + R.w * i / 6) - 1, R.y, 2, floorY - R.y);
    const ls = c.createLinearGradient(R.x, 0, R.x + R.w, 0); ls.addColorStop(0, 'rgba(255,255,255,0)'); ls.addColorStop(0.5, 'rgba(255,255,255,.95)'); ls.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = ls; c.fillRect(R.x, R.y + R.h * 0.075, R.w, Math.max(5, R.h * 0.012));
    // floor
    c.fillStyle = D.lin(c, 0, floorY, 0, R.y + R.h, [[0, '#DDE2EC'], [0.5, '#E9EDF4'], [1, '#CFD6E3']]); c.fillRect(R.x, floorY, R.w, R.y + R.h - floorY + 2);
    c.fillStyle = 'rgba(10,26,58,.10)'; c.fillRect(R.x, floorY, R.w, 2);
    // reflection (the same cut-out, flipped, fading out)
    c.save(); c.beginPath(); c.rect(R.x, floorY, R.w, R.y + R.h - floorY); c.clip();
    offc.width = Math.max(2, Math.ceil(dw)); offc.height = Math.max(2, Math.ceil(dh * 0.5)); const rc = offc.getContext('2d'); rc.clearRect(0, 0, offc.width, offc.height);
    rc.save(); rc.translate(0, 0); rc.scale(1, -1); rc.drawImage(P.img, 0, -dh, dw, dh); rc.restore();
    rc.globalCompositeOperation = 'destination-in'; const rg = rc.createLinearGradient(0, 0, 0, offc.height); rg.addColorStop(0, 'rgba(0,0,0,.34)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); rc.fillStyle = rg; rc.fillRect(0, 0, offc.width, offc.height);
    c.drawImage(offc, dr.x, bottom - 2); c.restore();
    // contact shadow
    const sg = c.createRadialGradient(cx, bottom - dh * 0.012, 4, cx, bottom - dh * 0.012, dw * 0.5); sg.addColorStop(0, 'rgba(10,22,51,.46)'); sg.addColorStop(0.55, 'rgba(10,22,51,.16)'); sg.addColorStop(1, 'rgba(10,22,51,0)');
    c.save(); c.translate(0, bottom); c.scale(1, 0.1); c.translate(0, -bottom); c.fillStyle = sg; c.fillRect(cx - dw * 0.56, bottom - dw * 0.56, dw * 1.12, dw * 1.12); c.restore();
    // the car, exactly as supplied (brightness and contrast only when the owner moved those sliders)
    const adj = filterStr(P), usedAdj = adj !== 'none' && adjFilterOK; if (usedAdj) c.filter = adj;
    c.drawImage(P.img, dr.x, dr.y, dr.w, dr.h); c.filter = 'none';
    if (P.plate) plateBlur(c, P.img, dr, P.plate);
    c.restore();
    D.strokeRR(c, R.x, R.y, R.w, R.h, rad, 'rgba(10,26,58,.10)', 2);
    const parts = [PS.tx('adjLabelBg')]; if (usedAdj) parts.push(PS.tx('adjLabelBright')); if (P.plate) parts.push(PS.tx('adjLabelPlate')); S._labels.push(parts.join(' + '));
    if (P.src === 'stock') S._samplePhoto = true;
    S._slots.push({ key: 'main', r: R, dr: { x: R.x, y: R.y, w: R.w + travX, h: R.h + travY }, mode: 'cut' });
    return dr;
  };
  // QA hook: wraps a named zone ('footer') so the export harness can record where it sits. A no-op in the app.
  D.zone = function (c, name, r, fn) { return fn(); };
  // small honesty label for edited photos (toggle in settings). Scales with canvas height and is anchored by its BOTTOM edge.
  D.adjLabelSize = (S) => Math.max(13, Math.min(28, Math.round((S._H || 1350) * 0.0165)));
  D.adjLabel = function (c, S, x, yBottom, align, scale) {
    if (!S._labels || !S._labels.length || !PS.settings.showAdj || S._adjDrawn) return;        // one label per post, wherever the template asks for it first
    S._adjDrawn = true;
    const text = PS.tx('photoPrefix') + [...new Set(S._labels)].join(' + ');
    const fs = Math.max(12, Math.round(D.adjLabelSize(S) * (scale || 1))), f = D.bt(fs, 700), w = D.tw(c, text, f) + fs * 1.2, h = Math.round(fs * 1.6), y = yBottom - h;
    const x0 = align === 'right' ? x - w : x;
    D.fillRR(c, x0, y, w, h, Math.round(fs * 0.4), 'rgba(10,22,51,.78)');
    D.T(c, text, x0 + fs * 0.6, y + h / 2 + fs * 0.34, { font: f, color: '#E6EAF5' });
  };

  /* ---------- footer ---------- */
  // What the contact side of a footer says. Phone set: CALL NOW + number. Else WhatsApp set: WhatsApp + number. Else the DM handle and
  // the showroom. A template's own typed CTA replaces it. Never a dead "WhatsApp us" with no number behind it.
  D.contactModel = function (S, o) {
    o = o || {}; const k = PS.contact(), cta = o.noCta ? '' : PS.cta(S);
    if (cta) return { cta };
    if (k.hasPhone) return { icon: 'phone', tag: PS.tx('callNow'), value: k.phone };
    if (k.hasWa) return { icon: 'chat', tag: PS.tx('whatsapp'), value: k.wa };
    return { icon: 'chat', value: PS.tx('dmHandle'), sub: PS.tx('visitShort') };
  };
  // r: {x,y,w,h}. style 'bar' (full width, chequer top) or 'card' (rounded floating card).
  // o.noCta: the template already shows its own call to action, so the footer shows the contact line instead.
  D.footer = function (c, S, r, style, o) {
    o = o || {}; c.save();
    if (style === 'card') { D.fillRR(c, r.x, r.y, r.w, r.h, 18, 'rgba(10,22,51,.88)'); D.strokeRR(c, r.x, r.y, r.w, r.h, 18, 'rgba(247,245,240,.14)', 2); }
    else { c.fillStyle = B.deep; c.fillRect(r.x, r.y, r.w, r.h); D.chequer(c, r.x, r.y, r.w, Math.max(8, r.h * 0.07), Math.max(4, r.h * 0.035), B.red, B.off); }
    const top = style === 'card' ? 0 : r.h * 0.07, ph = Math.round((r.h - top) * 0.86), py = r.y + top + (r.h - top - ph) / 2;
    const pad = style === 'card' ? 18 : (r.padX != null ? r.padX : 64);
    const pw = D.logoPlate(c, r.x + pad, py, ph);
    const tx = r.x + pad + pw + 22, mid = r.y + top + (r.h - top) / 2, hi = PS.isHi();
    // brand name as live text beside the logo (the logo's own wordmark is too small to read at feed size)
    // the brand name and the line under it stay in Latin script in every language (one brand identity, as on the real posts)
    const nf = D.dl(46), n1 = PS.COPY.brandName[0], n2 = PS.COPY.sinceLoc[0], f2 = D.bl(24, 600), tr1 = 2.6;
    D.T(c, n1, tx, mid - 2, { font: nf, color: B.off, track: tr1 });
    D.T(c, n2, tx, mid + 30, { font: f2, color: B.mute });
    const leftW = Math.max(D.tw(c, n1, nf, tr1), D.tw(c, n2, f2));
    const rx = r.x + r.w - pad, m = D.contactModel(S, o), maxW = Math.max(160, rx - tx - leftW - 40 - 56);
    let lines, lf, lh, size, tag = m.tag || '', sub = style === 'bar' ? (m.sub || '') : '';
    if (m.cta) { const fw = D.fitWrap(c, m.cta, (z) => D.bt(z, 800), maxW, 28, 22, 2); lines = fw.lines; size = fw.size; lf = D.bt(size, 800); lh = Math.round(size * 1.22); }
    else { lines = [m.value]; size = m.icon === 'phone' ? 32 : 28; lf = D.bl(size, 800); lh = size < 30 ? 34 : 36; }
    let lw = Math.max(...lines.map((l) => D.tw(c, l, lf)));
    if (lw > maxW) { lines = lines.map((l) => D.ellip(c, l, lf, maxW)); lw = Math.max(...lines.map((l) => D.tw(c, l, lf))); }
    const sf = D.bt(21, 600); if (sub) sub = D.ellip(c, sub, sf, maxW);
    const tagH = tag ? 24 : 0, subH = sub ? 28 : 0, blockH = lines.length * lh + tagH + subH;
    const yTop = mid - blockH / 2, y0 = yTop + tagH + size * 0.82;
    if (tag) D.T(c, tag, rx, yTop + 17, { font: D.bt(21, 700), color: B.mute, align: 'right', track: hi ? 0 : 1.6 });
    lines.forEach((l, i) => D.T(c, l, rx, y0 + i * lh, { font: lf, color: B.off, align: 'right' }));
    if (sub) D.T(c, sub, rx, y0 + (lines.length - 1) * lh + 28, { font: sf, color: B.mute, align: 'right' });
    const icw = Math.max(lw, sub ? D.tw(c, sub, sf) : 0, tag ? D.tw(c, tag, D.bt(21, 700)) : 0);
    D.icon(c, m.icon || 'chat', rx - icw - 32, mid, m.icon === 'phone' ? 32 : 34, B.off, 2.2);
    c.restore();
  };

  /* ---------- misc ---------- */
  D.stars = function (c, x, y, size, n, color, gap) {
    for (let i = 0; i < n; i++) D.icon(c, 'star', x + i * (size + (gap || size * 0.2)) + size / 2, y + size / 2, size, color);
  };
  D.shadowBox = function (c, fn) { c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 40; c.shadowOffsetY = 14; fn(); c.restore(); };
  // 4-point sparkle
  D.sparkle = function (c, x, y, r, color) { c.save(); c.fillStyle = color; c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill(); c.restore(); };
  // generic side-profile sedan outline (line art for brand graphics only. It is never used in place of a real car photo.)
  D.carSilhouette = function (c, x, y, w, color, lw) {
    const k = w / 100; c.save(); c.translate(x, y); c.scale(k, k); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = lw || 1.5; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(5, 27); c.lineTo(4, 21.5); c.bezierCurveTo(4, 18.5, 6, 17.3, 10, 16.8); c.lineTo(27, 15.2); c.bezierCurveTo(31, 9, 36, 5.6, 44, 5.2); c.lineTo(58, 5.2); c.bezierCurveTo(66, 5.4, 72, 10, 77, 14.6); c.lineTo(90, 17.2); c.bezierCurveTo(94, 18.2, 96, 20.5, 96, 24); c.lineTo(95, 27); c.lineTo(88, 27); c.moveTo(66, 27); c.lineTo(33, 27); c.moveTo(14, 27); c.lineTo(5, 27); c.stroke();
    c.beginPath(); c.moveTo(30, 15.2); c.bezierCurveTo(33, 10.5, 37, 8, 44, 7.6); c.lineTo(57, 7.6); c.bezierCurveTo(63, 7.8, 68, 11.4, 72, 15); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(51, 7.8); c.lineTo(50.4, 15.2); c.stroke();
    [[23.5, 27], [77, 27]].forEach((p) => { c.beginPath(); c.arc(p[0], p[1], 6.4, 0, 7); c.stroke(); c.beginPath(); c.arc(p[0], p[1], 2.3, 0, 7); c.stroke(); });
    c.restore();
  };
  // QR code for a short text (client-side, qrcode-generator). Dark modules on a white card, never inverted. Returns false if the library is missing.
  D.qr = function (c, text, x, y, size, quiet) {
    if (typeof window.qrcode !== 'function') return false;
    const q = window.qrcode(0, 'M'); q.addData(String(text)); q.make();
    const n = q.getModuleCount(), qz = quiet != null ? quiet : 2, cell = size / (n + qz * 2);
    D.fillRR(c, x, y, size, size, size * 0.05, '#FFFFFF'); c.fillStyle = B.ink;
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect(Math.round(x + (k + qz) * cell), Math.round(y + (r + qz) * cell), Math.ceil(cell), Math.ceil(cell));
    return true;
  };
  // diagonal SAMPLE stamp: drawn on any render that still holds demo customer text, or a stock layout-test photo (not our car)
  D.sampleStamp = function (c, W, H, text) {
    c.save(); c.translate(W / 2, H * 0.46); c.rotate(-0.42);
    const fs = Math.round(Math.min(W, H) * 0.062), f = `800 ${fs}px Manrope`, t = text || 'SAMPLE · NOT A REAL CUSTOMER', w = D.tw(c, t, f, 3) + fs * 1.6, h = fs * 2.1;
    c.fillStyle = 'rgba(225,27,34,.92)'; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = '#fff'; c.lineWidth = Math.max(3, fs * 0.08); c.strokeRect(-w / 2 + fs * 0.25, -h / 2 + fs * 0.25, w - fs * 0.5, h - fs * 0.5);
    D.T(c, t, 0, fs * 0.36, { font: f, color: '#fff', align: 'center', track: 3 });
    c.restore();
  };
  D.seeded = function (seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
})();
