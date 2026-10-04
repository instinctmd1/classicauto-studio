/* Classic Auto Post Studio — layout composer + car-centred templates. */
(function () {
  'use strict';
  const PS = window.PS, D = PS.D, B = PS.B, tx = (k) => PS.tx(k);
  PS.TEMPLATES = []; PS.TPL = {};
  const FEED = ['1080x1350', '1080x1080', '1080x1920', '1920x1080'];
  PS.SIZE_LABEL = {
    '1080x1350': 'Feed 4:5 (safe for the profile grid)', '1080x1080': 'Square 1:1 (cropped in the grid)', '1080x1920': 'Story / Reel 9:16', '1920x1080': 'Landscape 16:9',
    '2400x1000': 'Website hero wide', '1280x720': 'YouTube thumbnail', '1080x608': 'Google Business cover', '820x360': 'Facebook cover'
  };
  PS.FEED = FEED;
  PS.SIZE_SHORT = { '1080x1350': '4:5 feed', '1080x1080': '1:1 square', '1080x1920': '9:16 story', '1920x1080': '16:9 wide', '2400x1000': 'Hero wide', '1280x720': 'YouTube', '1080x608': 'Google cover', '820x360': 'Facebook cover' };

  /* ---------- layout ---------- */
  PS.layout = function (W, H) {
    const r = W / H, L = { W, H, r };
    L.mode = r >= 1.6 ? 'wide' : r <= 0.62 ? 'tall' : r < 0.9 ? 'portrait' : 'square';
    if (L.mode === 'portrait') { L.m = 64; L.footer = { x: 0, y: H - 128, w: W, h: 128, style: 'bar' }; L.top = 64; L.bottom = H - 128; L.label = { x: W - 64, y: H - 128 - 6, a: 'right' }; }
    else if (L.mode === 'square') { L.m = 60; L.footer = { x: 0, y: H - 112, w: W, h: 112, style: 'bar' }; L.top = 56; L.bottom = H - 112; L.label = { x: W - 60, y: H - 112 - 6, a: 'right' }; }
    else if (L.mode === 'tall') { L.m = 64; L.footer = { x: 64, y: 262, w: W - 128, h: 112, style: 'card' }; L.top = 398; L.bottom = H - 340; L.label = { x: W - 64, y: H - 340 - 4, a: 'right' }; }
    else { L.m = 80; L.footer = { x: 0, y: H - 112, w: W, h: 112, style: 'bar', padX: 80 }; L.top = 64; L.bottom = H - 112; L.label = { x: W - 80, y: H - 112 - 12, a: 'right' }; }
    return L;
  };

  /* ---------- backgrounds ---------- */
  function slashes(c, L, color, alpha) {
    const { W, H } = L; c.save(); c.globalAlpha = alpha; c.fillStyle = color;
    const sk = H * 0.22, w = Math.max(26, W * 0.03);
    for (let i = 0; i < 3; i++) { D.para(c, W * 0.74 + i * w * 2.3, -10, w * (1 - i * 0.2), H + 20, sk); c.fill(); }
    c.restore();
  }
  function paintBg(c, L, kind) {
    const { W, H } = L;
    if (kind === 'cream') {
      c.fillStyle = B.off; c.fillRect(0, 0, W, H); slashes(c, L, B.blue, 0.05);
    } else if (kind === 'flat') {
      c.fillStyle = B.deep; c.fillRect(0, 0, W, H); slashes(c, L, '#FFFFFF', 0.045);
    } else {
      c.fillStyle = D.lin(c, 0, 0, W, H, [[0, '#10224E'], [0.55, B.deep], [1, '#071026']]); c.fillRect(0, 0, W, H);
      slashes(c, L, '#FFFFFF', 0.045);
    }
  }
  PS.paintBg = paintBg;

  /* ---------- car view-model ---------- */
  function carView(car) {
    const v = {};
    v.year = car.year ? String(car.year) : ''; v.make = car.make || ''; v.model = car.model || ''; v.variant = car.variant || '';
    v.eyebrow = [v.year, v.make.toUpperCase()].filter(Boolean).join('   ·   ');
    v.priceN = PS.parseMoney(car.price); v.oldN = PS.parseMoney(car.oldPrice);
    v.parts = PS.priceParts(v.priceN);
    v.emi = PS.emiEst(v.priceN);          // NaN (and so no EMI line and no footnote) until Settings has a lender rate
    v.km = car.kms !== '' && car.kms != null ? PS.kmText(car.kms) : '';
    v.fuel = PS.fuelText(car.fuel); v.trans = PS.transText(car.trans); v.owner = PS.ownerText(car.owners);
    v.specs = [v.km, v.fuel, v.trans, v.owner].filter(Boolean);
    { const ii = PS.insuranceInfo(car); v.ins = ii.state === 'expired' ? '' : ii.text; }          // an expired policy is never printed as a spec
    v.name = [v.year, v.make, v.model].filter(Boolean).join(' ');
    return v;
  }
  PS.carView = carView;

  /* ---------- text metrics ---------- */
  const dm = (s) => (PS.isHi() ? { h: s * 0.98, b: s * 0.78 } : { h: s * 0.72, b: s * 0.72 });
  const bm = (s) => (PS.isHi() ? { h: s * 1.12, b: s * 0.88 } : { h: s * 1.0, b: s * 0.8 });

  /* ---------- price pieces ---------- */
  function priceW(c, parts, size) {
    return D.tw(c, parts.sym + parts.num, D.dl(size)) + (parts.unit ? 10 + D.tw(c, parts.unit, PS.isHi() ? D.hd(size * 0.38) : D.dl(size * 0.52)) : 0);
  }
  function drawPrice(c, parts, x, base, size, color, align, shadow) {
    const f1 = D.dl(size), fu = PS.isHi() ? D.hd(size * 0.38) : D.dl(size * 0.52);
    const w = priceW(c, parts, size); let px = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    D.T(c, parts.sym + parts.num, px, base, { font: f1, color, shadow });
    if (parts.unit) { px += D.tw(c, parts.sym + parts.num, f1) + 10; D.T(c, parts.unit, px, base, { font: fu, color, shadow }); }
    return w;
  }
  PS.drawPrice = drawPrice; PS.priceW = priceW;
  const emiParts = (v) => (isFinite(v.emi) ? `₹${PS.inr(v.emi)}` : '');

  /* ---------- block builders: each returns {h, draw(x,y,w), gap?} ---------- */
  const K = {}; K.light = false;      // true while a Signature-chassis template (white ground) is laid out: ink on white instead of white on navy
  const FG = () => (K.light ? '#0A1A3A' : '#fff'), MU = () => (K.light ? '#3E4766' : B.mute);
  K.gap = (h) => ({ h, draw() {}, gap: 0 });
  K.eyebrow = (c, text, k, color) => { const s = Math.max(30, Math.round(34 * k)), m = bm(s); return { h: m.h, draw: (x, y) => D.T(c, text, x, y + m.b, { font: D.bl(s, 800), color: color || MU(), track: s * 0.12 }) }; };
  K.model = (c, text, w, k, color, max) => {
    const up = D.up(text), mx = Math.round((max || 172) * k);
    let s = D.fit(c, up, D.dl, w, mx, 64), lines = [up];
    if (D.tw(c, up, D.dl(s)) > w) { const r = D.fitWrap(c, up, D.dl, w, Math.round(mx * 0.82), 48, 2); s = r.size; lines = r.lines; }   // too long for one line: two lines, ellipsis if still too long
    const m = dm(s), gap = Math.round(s * 0.08);
    return { h: lines.length * m.h + (lines.length - 1) * gap, draw: (x, y) => lines.forEach((l, i) => D.T(c, l, x, y + m.b + i * (m.h + gap), { font: D.dl(s), color: color || FG() })), size: s };
  };
  // display headline: fits one or two lines (ellipsis only as a last resort) with the last word in red
  K.headline = (c, text, w, max, min, maxLines, o) => {
    o = o || {}; const up = PS.isHi() ? String(text) : D.up(text), fw = D.fitWrap(c, up, D.dt, w, max, min, maxLines), m = dm(fw.size), gap = Math.round(fw.size * 0.1), f = D.dt(fw.size);
    return { h: fw.lines.length * m.h + (fw.lines.length - 1) * gap, size: fw.size, lines: fw.lines, draw: (x, y) => fw.lines.forEach((l, i) => {
      const by = y + m.b + i * (m.h + gap), last = i === fw.lines.length - 1;
      if (!last || o.red === false) { D.T(c, l, x, by, { font: f, color: o.color || FG() }); return; }
      const ws = l.split(' '), lw = ws.length > 1 ? ws.pop() : null, pre = lw ? ws.join(' ') + ' ' : '';
      if (!lw) { D.T(c, l, x, by, { font: f, color: o.accent || B.red }); return; }
      const wp = D.T(c, pre, x, by, { font: f, color: o.color || FG() }); D.T(c, lw, x + wp, by, { font: f, color: o.accent || B.red });
    }) };
  };
  K.variant = (c, text, w, k, color) => {
    // one line, shrinking to 30 px; if it is still too long it is cut at a word boundary with an ellipsis (D.ellip), never mid-word
    const s0 = Math.max(30, Math.round(38 * k)); let s = s0, f = D.bl(s, 600);
    while (s > 30 && D.tw(c, text, f) > w) { s -= 2; f = D.bl(s, 600); }
    const t = D.ellip(c, text, f, w);
    const m = bm(s); return { h: m.h, draw: (x, y) => D.T(c, t, x, y + m.b, { font: f, color: color || MU() }) };
  };
  K.text = (c, text, w, o) => { // generic paragraph
    const lh = o.lh || Math.round(o.size * 1.38), font = o.font, lines = Math.min(D.lines(c, text, font, w), o.max || 99), m = bm(o.size);
    return { h: (lines - 1) * lh + m.h, draw: (x, y) => D.P(c, text, x, y + m.b, { font, color: o.color, w, lh, max: o.max, align: o.align, alpha: o.alpha }) };
  };
  K.specs = (c, items, w, k, color, divider) => {
    let s = Math.max(32, Math.round(36 * k)); const gap = 38;
    const total = (sz) => items.reduce((a, t) => a + D.tw(c, t, D.bt(sz, 700)), 0) + gap * (items.length - 1);
    while (s > 32 && total(s) > w) s -= 2;
    const m = bm(s); const f = D.bt(s, 700);
    // greedy wrap into rows if still too wide
    const rows = []; let cur = [], cw = 0;
    items.forEach((t) => { const tw = D.tw(c, t, f); if (cur.length && cw + gap + tw > w) { rows.push(cur); cur = []; cw = 0; } cw += (cur.length ? gap : 0) + tw; cur.push(t); });
    if (cur.length) rows.push(cur);
    const rh = Math.round(s * 1.5);
    return {
      h: (rows.length - 1) * rh + m.h, draw: (x, y) => {
        rows.forEach((r, ri) => { let px = x; r.forEach((t, i) => { px += D.T(c, t, px, y + ri * rh + m.b, { font: f, color: color || FG() }); if (i < r.length - 1) { c.fillStyle = divider || (K.light ? 'rgba(10,26,58,.3)' : 'rgba(247,245,240,.35)'); c.fillRect(px + gap / 2 - 1, y + ri * rh + 2, 2, s * 0.95); px += gap; } }); });
      }
    };
  };
  // price (left) with EMI stack (right)
  K.priceRow = (c, v, w, k, o) => {
    o = o || {}; let size = Math.round((o.size || 176) * k); const color = o.color || B.red;
    // EMI stack on the right: shrink the price (down to 62%) until both fit; if they never do, the EMI and its footnote are left out
    let emiOk = false;
    if (isFinite(v.emi) && o.emi !== false) {
      const rs = Math.max(30, Math.round(30 * Math.max(k, 1))), fs = Math.max(40, Math.round(46 * k)), amt = emiParts(v), af = D.bl(fs, 800), sf = D.bt(rs, 700), suf = tx('perMo');
      const wmax = Math.max(D.tw(c, amt, af) + D.tw(c, suf, sf) + 4, D.tw(c, tx('emiEst'), sf)), s0 = size;
      for (; size >= Math.round(s0 * 0.62); size -= 4) { if ((v.parts ? priceW(c, v.parts, size) : 0) + 30 + wmax <= w) { emiOk = true; break; } }
      if (!emiOk) size = s0;
    }
    if (v.parts) { const s1 = D.fit(c, v.parts.sym + v.parts.num, D.dl, w - (v.parts.unit ? 120 : 0), size, 60); size = Math.min(size, s1); }
    v._emiShown = emiOk; const m = dm(size);
    return {
      h: m.h, draw: (x, y) => {
        if (v.parts) drawPrice(c, v.parts, x, y + m.b, size, color, 'left', o.shadow);
        else D.T(c, D.up(tx('priceOnReq')), x, y + m.b, { font: D.dt(Math.round(size * 0.55)), color: FG() });
        if (emiOk) {
          const pw = v.parts ? priceW(c, v.parts, size) : 0, rs = Math.max(30, Math.round(30 * Math.max(k, 1))), fs = Math.max(40, Math.round(46 * k));
          const amt = emiParts(v), af = D.bl(fs, 800), sf = D.bt(rs, 700), suf = tx('perMo');
          const wAmt = D.tw(c, amt, af) + D.tw(c, suf, sf) + 4, wLab = D.tw(c, tx('emiEst'), D.bt(rs, 700));
          const wmax = Math.max(wAmt, wLab);
          if (pw + 30 + wmax <= w) {
            const rx = x + w, base = y + m.b;
            D.T(c, suf, rx, base, { font: sf, color: MU(), align: 'right' });
            D.T(c, amt, rx - D.tw(c, suf, sf) - 4, base, { font: af, color: FG(), align: 'right' });
            D.T(c, tx('emiEst'), rx, base - fs - 12, { font: sf, color: MU(), align: 'right' });
          }
        }
      }
    };
  };
  K.emiNote = (c, w, k, color, v) => (v && (!isFinite(v.emi) || v._emiShown === false) ? null : K.text(c, tx('emiNote'), w, { font: D.bt(26, 600), size: 26, lh: 34, color: color || MU(), max: 2 }));   // no EMI shown, no EMI footnote

  function badgeRow(c, S, x, y, k, onLight) {
    const ids = (S.badges || []).slice(0, 2); let px = x; const h = Math.round(56 * Math.max(0.9, k));
    ids.forEach((id, i) => {
      const e = PS.BADGES.find((b) => b[0] === id); if (!e) return;
      px += D.tag(c, tx(e[1]), px, y, { h, size: 28, bg: i ? 'rgba(10,22,51,.78)' : B.off, fg: i ? B.off : B.ink, border: i ? 'rgba(247,245,240,.7)' : null }) + 18;
    });
    return px;
  }

  /* ---------- composer ---------- */
  // o: bg, style ('full'|'top'|'none'), photo (P), blocks(w,k)->[block], anchor ('bottom'|'spread'|'center'|'top'),
  //    tags(bool), side(c,rect), photoFrac, kBase
  function compose(c, L, S, o) {
    if (o.style === 'sig') return sigCompose(c, L, S, o);
    const { W, H, mode } = L, fh = L.footer.h; const k0 = o.kBase || (mode === 'square' ? 0.86 : 1);
    if (o.bgPaint) o.bgPaint(c, L); else paintBg(c, L, o.bg || (o.style === 'full' ? 'flat' : 'deep'));
    const gapOf = (k) => Math.round(24 * k);
    const layoutBlocks = (w, availH, kStart) => {
      let k = kStart, bl;
      for (; k >= 0.6; k -= 0.04) { bl = o.blocks(w, k).filter(Boolean); const g = gapOf(k); const tot = bl.reduce((a, b, i) => a + b.h + (i < bl.length - 1 ? (b.gap != null ? b.gap : g) : 0), 0); if (tot <= availH) return { bl, k, tot, g }; }
      const g = gapOf(k); return { bl, k, tot: bl.reduce((a, b, i) => a + b.h + (i < bl.length - 1 ? (b.gap != null ? b.gap : g) : 0), 0), g };
    };
    const place = (bl, g, x, y0, w) => { let y = y0; bl.forEach((b, i) => { b.draw(x, y, w); y += b.h + (i < bl.length - 1 ? (b.gap != null ? b.gap : g) : 0); }); };
    const hasPhoto = o.style !== 'none';

    if (mode === 'wide') {
      const x0 = Math.round(W * 0.47), sk = Math.round(H * 0.07), ph = o.noFooter ? H : H - fh;
      if (hasPhoto) {
        c.save(); c.beginPath(); c.moveTo(x0 + sk, 0); c.lineTo(W, 0); c.lineTo(W, ph); c.lineTo(x0, ph); c.closePath(); c.clip();
        D.photo(c, S, 'main', o.photo, { x: x0, y: 0, w: W - x0, h: ph }, {}); c.restore();
        c.save(); c.fillStyle = B.red; c.globalAlpha = 1; D.para(c, x0 - 14, 0, 8, ph, sk); c.fill(); c.restore();
      } else if (o.side) o.side(c, { x: Math.round(W * 0.58), y: 0, w: W - Math.round(W * 0.58), h: ph });
      const colW = hasPhoto ? x0 - L.m - Math.round(sk * 0.5) - 20 : Math.round(W * 0.52) - L.m;
      const topY = o.tags ? 52 + 56 + 36 : 64, availH = ph - topY - 56;      // the badge row takes the top of the column, so the blocks get what is left
      const r = layoutBlocks(colW, availH, k0);
      const y0 = topY + Math.max(0, (availH - r.tot) / 2);
      if (o.tags) badgeRow(c, S, L.m, 52, r.k);
      place(r.bl, r.g, L.m, y0, colW);
      if (!o.noFooter) D.footer(c, S, L.footer, 'bar', { noCta: !!o.footerNoCta });
      D.adjLabel(c, S, L.label.x, L.label.y, 'right'); return;
    }

    const colW = W - 2 * L.m, BOT = o.noFooter ? H - 64 : L.bottom - 54;     // text never goes lower than this (room for the photo label above the footer)
    if (o.style === 'full') {
      const bottom = BOT, availH = Math.round((bottom - L.top) * (mode === 'tall' ? 0.62 : 0.70));
      const r = layoutBlocks(colW, availH, k0), top = bottom - r.tot;
      const photoR = { x: 0, y: 0, w: W, h: Math.round(top + 80) }, fy = mode === 'tall' ? L.top + 8 : 36;
      const fitR = { x: 0, y: fy, w: W, h: Math.max(300, top - 24 - fy) };
      D.photo(c, S, 'main', o.photo, photoR, { fit: fitR, back: photoR });
      // legibility + fade into the navy text zone
      c.fillStyle = D.lin(c, 0, 0, 0, 220, [[0, 'rgba(10,22,51,.62)'], [1, 'rgba(10,22,51,0)']]); c.fillRect(0, 0, W, 220);
      c.fillStyle = D.lin(c, 0, top - 190, 0, top + 80, [[0, 'rgba(10,22,51,0)'], [0.55, 'rgba(10,22,51,.86)'], [1, 'rgba(10,22,51,1)']]); c.fillRect(0, top - 190, W, 270);
      if (o.afterPhoto) o.afterPhoto(c, L, { top, W, H });
      if (o.tags) badgeRow(c, S, L.m, mode === 'tall' ? L.top : L.top - 8, r.k);
      place(r.bl, r.g, L.m, top, colW);
    } else if (o.style === 'top') {
      const frac = o.photoFrac || (mode === 'square' ? 0.40 : mode === 'tall' ? 0.36 : 0.43);
      const pb = Math.round(H * frac), slant = Math.round(W * 0.06);
      c.save(); c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, pb - slant); c.lineTo(0, pb); c.closePath(); c.clip();
      D.photo(c, S, 'main', o.photo, { x: 0, y: 0, w: W, h: pb }, { fit: { x: 0, y: 30, w: W, h: pb - slant - 50 }, back: { x: 0, y: 0, w: W, h: pb } });
      c.fillStyle = D.lin(c, 0, 0, 0, 200, [[0, 'rgba(10,22,51,.55)'], [1, 'rgba(10,22,51,0)']]); c.fillRect(0, 0, W, 200); c.restore();
      c.save(); c.strokeStyle = B.red; c.lineWidth = 8; c.beginPath(); c.moveTo(0, pb + 4); c.lineTo(W, pb - slant + 4); c.stroke(); c.restore();
      if (o.tags) badgeRow(c, S, L.m, mode === 'tall' ? L.top : L.top - 8, k0);
      const y0 = pb + 28, y1 = BOT;
      const r = layoutBlocks(colW, y1 - y0, k0);
      let startY = y0; const extra = (y1 - y0) - r.tot;
      if (o.anchor === 'bottom') startY = y0 + extra; else if (o.anchor === 'spread') r.g = r.g + Math.min(40, extra / Math.max(1, r.bl.length - 1) * 0.5), startY = y0 + Math.max(0, ((y1 - y0) - (r.tot + (r.g - gapOf(r.k)) * (r.bl.length - 1))) / 2);
      else startY = y0 + extra * 0.35;
      place(r.bl, r.g, L.m, startY, colW);
    } else { // 'none'
      const y0 = L.top + (o.topPad || 0), y1 = BOT, availH = y1 - y0;
      const r = layoutBlocks(colW, availH, k0), extra = availH - r.tot;
      let startY = y0 + extra * (o.anchor === 'top' ? 0 : o.anchor === 'bottom' ? 1 : 0.5);
      if (o.anchor === 'spread') { r.g = r.g + Math.min(50, extra / Math.max(1, r.bl.length - 1)); startY = y0 + Math.max(0, (availH - (r.tot + (r.g - gapOf(r.k)) * (r.bl.length - 1))) / 2); }
      if (o.pre) o.pre(c, L, { x: 0, y: 0, w: W, h: startY - 14 });
      if (o.tags) badgeRow(c, S, L.m, L.top - 8, r.k);
      place(r.bl, r.g, L.m, startY + (o.tags ? 30 : 0), colW);
    }
    if (!o.noFooter) D.footer(c, S, L.footer, L.footer.style, { noCta: !!o.footerNoCta });
    D.adjLabel(c, S, L.label.x, L.label.y, L.label.a, L.mode === 'tall' ? 0.8 : 1);      // smaller on the story, so its box stays clear of a tall price above it
  }

  /* ---------- the Signature chassis: white ground, the logo lockup top-left, a card top-right, the photo running to the edges, the headline module in ink,
     the same navy contact bar and BUY . SELL . EXCHANGE . UPGRADE strip as the Signature post. Used by Price Drop, Guess the Price, Sold / Delivered and Story. ---------- */
  function chassisCard(c, g, A, icon, l1, l2) {
    const k = g.hdr.card, hi = PS.isHi(), kh = k.h + (hi ? 8 : 0), x = g.W - g.m - k.w, y = k.y, P = PS.classicParts;
    c.save(); c.shadowColor = 'rgba(10,26,58,.18)'; c.shadowBlur = 18; c.shadowOffsetY = 5; D.fillRR(c, x, y, k.w, kh, 18, '#FFFFFF'); c.restore(); D.strokeRR(c, x, y, k.w, kh, 18, A.a, 3);
    D.icon(c, icon, x + 46, y + kh / 2, 50, A.a, 2); const tx0 = x + 90, avail = x + k.w - 14 - tx0;
    const s1 = D.fit(c, l1, (z) => P.hf(l1, z, 800), avail, Math.round(k.h * 0.4), 14, 0), s2 = D.fit(c, l2, (z) => D.bt(z, 700), avail, Math.round(k.h * 0.26), 12);
    D.T(c, l1, tx0, y + kh * 0.5, { font: P.hf(l1, s1, 800), color: A.a }); if (l2) D.T(c, l2, tx0, y + kh * 0.8 + (hi ? 4 : 0), { font: D.bt(s2, 700), color: P.INK });
    return { x, y, w: k.w, h: kh };
  }
  function sigCompose(c, L, S, o) {
    const P = PS.classicParts, { W, H } = L, g = P.geo(W, H), A = P.accentOf(S), mode = g.mode; K.light = true;
    try {
      P.background(c, g);
      let R, tx0 = g.m, tw = W - 2 * g.m, ty1, k0 = o.kBase || 1;
      if (mode === 'wide') { R = { x: 940, y: g.hdr.h, w: W - 940, h: g.foot.y - g.hdr.h - 14 }; tw = 830; ty1 = g.foot.y - 24; }
      else if (mode === 'tall') { R = { x: 0, y: g.col.y - 14, w: W, h: 560 }; ty1 = g.foot.y - 30; }
      else if (mode === 'square') { R = { x: 0, y: g.hdr.h + 6, w: W, h: 320 }; ty1 = g.foot.y - 22; k0 = o.kBaseSq || 0.74; }
      else { R = { x: 0, y: g.hdr.h + 6, w: W, h: 510 }; ty1 = g.foot.y - 26; }
      const hasP = !!(S.photos.main && S.photos.main.img), plain = !!o.plainBlock && !hasP;      // text-led posts with no photo: a plain navy block with the logo, never a drawn car
      if (plain && mode !== 'wide') R = Object.assign({}, R, { h: mode === 'tall' ? 300 : mode === 'square' ? 170 : 230 });
      // plan the headline module first: it takes the room it needs, and the photo band gives up height before any text is shrunk too far or left off
      const typedCta = o.cta === false ? '' : (PS.cta(S) || ''), gapOf = (kk) => Math.round(22 * kk);
      const attempt = (withCta) => {
        for (const cut of (mode === 'wide' ? [0] : [0, 40, 80, 120, 160])) {
          const ty0 = (mode === 'wide' ? g.hdr.h + 22 : R.y + R.h - cut + (plain ? 24 : 8)), availH = ty1 - ty0; let last = null;
          for (let k = k0; k >= 0.5; k -= 0.04) {
            const bl = o.blocks(tw, k).filter(Boolean);
            if (withCta) { const fs = Math.max(22, Math.round(30 * k)), fw = D.fitWrap(c, typedCta, (z) => D.bt(z, 800), tw - 56, fs, 20, 2, 0), lh = Math.round(fw.size * 1.25), ph = fw.lines.length * lh + 26; bl.push({ h: ph, draw: (x, y) => { D.fillRR(c, x, y, tw, ph, Math.min(32, ph / 2), A.a); fw.lines.forEach((l, i) => D.T(c, l, x + 28, y + 13 + fw.size * 0.92 + i * lh, { font: D.bt(fw.size, 800), color: '#fff' })); } }); }
            const gp = gapOf(k), tot = bl.reduce((a, b2, i) => a + b2.h + (i < bl.length - 1 ? (b2.gap != null ? b2.gap : gp) : 0), 0); last = { cut, k, bl, gp, tot, ty0, availH, fits: tot <= availH };
            if (last.fits) return last;
          }
          if (cut === 160 || mode === 'wide') return last;
        }
      };
      let plan = attempt(!!typedCta); if (!plan.fits && typedCta) { const p2 = attempt(false); if (p2.fits) { plan = p2; PS.note(S, 'The call-to-action line is too long for this post and was left off. Shorten it to about 50 characters.'); } }
      R = Object.assign({}, R, { h: mode === 'wide' ? R.h : R.h - plan.cut });
      // the photo first, so the card and the text sit on top of its soft edges
      const fd = P.frameFor(S.photos.main, R.w - 2 * g.m, R.h - 10), fr = { x: R.x + (R.w - fd.w) / 2, y: R.y + (R.h - fd.h) / 2, w: fd.w, h: fd.h };
      if (plain) {
        const bx = mode === 'wide' ? { x: R.x + 30, y: R.y + 20, w: R.w - g.m - 30, h: R.h - 40 } : { x: g.m, y: R.y + 6, w: W - 2 * g.m, h: R.h - 12 };
        c.save(); D.rr(c, bx.x, bx.y, bx.w, bx.h, 26); c.clip(); c.fillStyle = D.lin(c, bx.x, bx.y, bx.x + bx.w, bx.y + bx.h, [[0, A.mid], [1, A.b]]); c.fillRect(bx.x, bx.y, bx.w, bx.h);
        D.chequer(c, bx.x, bx.y + bx.h - 14, bx.w, 14, 7, B.red, B.off); c.restore();
        const lh2 = Math.round(Math.min(bx.h * 0.6, 150)); D.logoPlate(c, bx.x + (bx.w - D.logoW(lh2)) / 2, bx.y + (bx.h - 14 - lh2) / 2, lh2);
      } else P.bleedSlot(c, S, g, R, fr);
      if (o.afterPhoto) o.afterPhoto(c, L, { top: R.y + R.h + 6 });
      const luxury = PS.isLuxury(S.car, S.x.luxury), card = chassisCard(c, g, A, o.icon || 'carFront', o.card[0], o.card[1] || '');
      P.header(c, S, g, { luxury }, A, card);
      if (o.tags) badgeRow(c, S, mode === 'wide' ? R.x + 26 : g.m, R.y + 22, 1);
      let y = plan.ty0 + (o.anchor === 'top' ? 0 : Math.max(0, (plan.availH - plan.tot) * 0.35)); plan.bl.forEach((b2, i) => { b2.draw(tx0, y, tw); y += b2.h + (i < plan.bl.length - 1 ? (b2.gap != null ? b2.gap : plan.gp) : 0); });
      P.footerBar(c, S, g, A); P.menuStrip(c, g); if (mode === 'tall') P.bottomSlab(c, S, g, A);
      D.adjLabel(c, S, W - g.m, g.foot.y - 6, 'right');
    } finally { K.light = false; }
  }
  PS.compose = compose; PS.K = K; PS.carView = carView; PS.bm = bm; PS.dm = dm; PS.badgeRow = badgeRow;

  /* ---------- helpers for templates ---------- */
  PS.addTemplate = function (t) { PS.TEMPLATES.push(t); PS.TPL[t.id] = t; };
  const ctaOf = (S, key) => PS.cta(S) || tx(key);

  /* ---------- 1. New arrival ---------- */
  PS.addTemplate({
    id: 'newarrival', name: 'Classic Auto — Signature', group: 'Cars', family: 'photo', sizes: FEED, def: '1080x1350', file: 'newarrival',
    car: true, badges: ['just_arrived'], x: ['listStyle', 'photoStyle', 'accent', 'luxury', 'stamp', 'tagline'], cta: 'ctaArrival', classic: true,
    render(c, L, S) {
      if (S.x.listStyle !== 'navy') return PS.classicListing(c, L, S);       // the house design (classic.js). 'Dark navy' keeps the old look
      const v = carView(S.car);
      compose(c, L, S, {
        style: 'full', photo: S.photos.main, tags: true,
        blocks: (w, k) => [K.eyebrow(c, v.eyebrow, k), K.model(c, v.model || 'Model', w, k), K.variant(c, v.variant, w, k), K.specs(c, v.specs, w, k),
          { ...K.gap(2), gap: 0 }, K.priceRow(c, v, w, k), K.emiNote(c, w, k, null, v)]
      });
    }
  });

  /* ---------- 2. Price drop ---------- */
  PS.addTemplate({
    id: 'pricedrop', name: 'Price Drop', group: 'Cars', family: 'navy', sizes: FEED, def: '1080x1350', file: 'pricedrop',
    car: true, badges: [], x: ['validity', 'oldPosted', 'showSave'], cta: 'ctaDrop',
    render(c, L, S) {
      // the old price is shown (struck through) only when it really is higher AND the owner says when it was posted. "You save" is opt-in.
      const v = carView(S.car), save = v.oldN - v.priceN, pd = PS.parseDate(S.x.oldPosted), showOld = PS.validDrop(S.car) && !!pd && pd <= PS.today(), ok = showOld && !!S.x.showSave && isFinite(save) && save > 0;
      compose(c, L, S, {
        style: 'sig', tags: true, icon: 'chart', card: [D.up(tx('priceDrop')), showOld ? `${D.up(tx('wasTxt'))} ${PS.priceText(v.oldN)}` : ''], kBase: 1, kBaseSq: 0.7,
        blocks: (w, k) => {
          const bl = [];
          bl.push(K.model(c, v.name || 'Car', w, k, FG(), 118));
          if (v.variant) bl.push(K.variant(c, v.variant, w, k));
          const ps = Math.round(196 * k), pm = dm(ps), hasOld = showOld;
          const lab = D.up(tx('nowTxt')), lf = D.dt(Math.round(40 * k)), labW = hasOld ? D.tw(c, lab, lf, 3) + 22 : 0;      // NOW only sits before a price that has its old price beside it
          const os = Math.max(40, Math.round(48 * k)), pf = D.bl(os, 800), op = hasOld ? PS.priceText(v.oldN) : '', opW = hasOld ? D.tw(c, op, pf) : 0;
          // new price and struck-through old price share a row only when they really fit. Otherwise shrink the new price, then stack the old price above it.
          let size = ps, stack = false;
          if (v.parts && hasOld) {
            while (size > Math.round(ps * 0.66) && labW + priceW(c, v.parts, size) + 36 + opW > w) size -= 4;
            if (labW + priceW(c, v.parts, size) + 36 + opW > w) { size = ps; stack = true; }
          }
          const wasH = stack ? Math.round(os * 1.45) : 0, sm = dm(size);
          bl.push({ h: sm.h + wasH + (hasOld && !stack ? 0 : 0), draw: (x, y) => {
            let by = y + wasH + sm.b;
            if (stack) { // "Was ₹X" above the new price
              const base = y + os * 0.95, wt = D.up(tx('wasTxt')), wf = D.bt(30, 700);
              D.T(c, wt, x, base, { font: wf, color: MU(), track: 2 }); const ox = x + D.tw(c, wt, wf, 2) + 16;
              D.T(c, op, ox, base, { font: pf, color: MU() }); c.fillStyle = MU(); c.fillRect(ox - 4, base - os * 0.3, opW + 8, 5);
            }
            if (v.parts) {
              if (hasOld) D.T(c, lab, x, by - size * 0.5, { font: lf, color: FG(), track: 3 });
              drawPrice(c, v.parts, x + labW, by, size, B.red, 'left');
            }
            if (hasOld && !stack) { // struck-through old price, right-aligned on the price baseline
              const rx = x + w, base = by;
              D.T(c, op, rx, base, { font: pf, color: MU(), align: 'right' }); c.fillStyle = MU(); c.fillRect(rx - opW - 6, base - os * 0.3, opW + 12, 5);
              D.T(c, tx('wasTxt'), rx, base - os - 14, { font: D.bt(30, 700), color: MU(), align: 'right' });
            }
          } });
          if (ok) {
            const s = Math.max(36, Math.round(42 * k)), txt = `${tx('youSave')} ₹${PS.inr(save)}`, ph = Math.round(s * 1.9);
            bl.push({ h: ph, draw: (x, y) => { const f = D.bt(s, 800), tw = D.tw(c, txt, f); D.fillRR(c, x, y, tw + 56, ph, ph / 2, PS.classicParts.accentOf(S).a); D.T(c, txt, x + 28, y + ph / 2 + s * 0.34, { font: f, color: '#fff' }); } });
          }
          if (showOld) {
            const s = Math.max(28, Math.round(30 * k)), t = `${tx('postedOn')} ${PS.fmtDate(pd)}`, fw = D.fitWrap(c, t, (z) => D.bt(z, 600), w, s, 24, 1), m = bm(fw.size);
            bl.push({ h: m.h, draw: (x, y) => D.T(c, fw.lines[0], x, y + m.b, { font: D.bt(fw.size, 600), color: MU() }) });
          }
          const off = PS.offerStatus(S.x.validity), vt = off.status === 'ok' ? PS.fmtDate(off.date) : '';      // a deadline is printed only for a typed date that is today or later
          if (vt) {
            const s = Math.max(32, Math.round(36 * k)), f = D.bt(s, 700), fw = D.fitWrap(c, `${tx('validTill')} ${vt}`, (z) => D.bt(z, 700), w - 50, s, 28, 2), lh = Math.round(fw.size * 1.3), m = bm(fw.size);
            bl.push({ h: (fw.lines.length - 1) * lh + Math.max(m.h, 34), draw: (x, y) => { D.icon(c, 'calendar', x + 17, y + 17, 34, MU(), 2); fw.lines.forEach((l, i) => D.T(c, l, x + 50, y + 17 + fw.size * 0.34 + i * lh, { font: D.bt(fw.size, 700), color: FG() })); } });
          }
          if (isFinite(v.emi)) bl.push({ h: bm(32).h, draw: (x, y) => D.T(c, `${tx('emiEst')} ${emiParts(v)}${tx('perMo')}`, x, y + bm(32).b, { font: D.bt(32, 700), color: FG() }) });
          bl.push(K.emiNote(c, w, k, null, v));
          return bl;
        }
      });
    }
  });

  /* ---------- 3. Guess the price (growth plan format 4) ---------- */
  PS.addTemplate({
    id: 'guess', name: 'Guess the Price', group: 'Cars', family: 'photo', sizes: FEED, def: '1080x1350', file: 'guessprice', sub: 'guessMode',
    car: true, badges: [], x: ['guessMode', 'guessReveal'], cta: 'ctaGuess',
    issue: (S) => (S.x.guessMode === 'reveal' && !(PS.parseMoney(S.car.price) > 0) ? 'noprice' : ''),     // a reveal needs the real price
    render(c, L, S) {
      const v = carView(S.car), reveal = (S.x.guessReveal || '').trim() || tx('revealDef'), rev = S.x.guessMode === 'reveal';
      compose(c, L, S, {
        style: 'sig', tags: false, icon: 'chat', card: [D.up(tx(rev ? 'revealHead' : 'guessHead')), [v.year, v.make].filter(Boolean).join(' ').toUpperCase()], kBase: 1, kBaseSq: 0.62,
        blocks: (w, k) => {
          const s0 = Math.round(150 * k), hu = D.up(tx(rev ? 'revealHead' : 'guessHead')), s = D.fit(c, hu, D.dt, w, s0, 60), m = dm(s);
          const line = rev ? tx('revealLine') : tx('guessLine').replace('{r}', reveal);      // the body always says where the answer comes; a typed CTA goes in the footer only
          const head = { h: m.h, draw: (x, y) => { D.T(c, hu, x, y + m.b, { font: D.dt(s), color: B.red }); } };
          if (rev) return [K.eyebrow(c, v.eyebrow, k), K.model(c, v.model || 'Model', w, k, FG(), 120), head, K.priceRow(c, v, w, k, { size: 150 }), K.emiNote(c, w, k, null, v), K.text(c, line, w, { font: D.bt(Math.max(32, 36 * k), 700), size: Math.max(32, 36 * k), color: FG(), max: 2 })];
          return [K.eyebrow(c, v.eyebrow, k), K.model(c, v.model || 'Model', w, k, FG(), 150), K.specs(c, v.specs, w, k), head,
            K.text(c, line, w, { font: D.bt(Math.max(34, 38 * k), 700), size: Math.max(34, 38 * k), color: FG(), max: 3 })];
        }
      });
    }
  });

  /* ---------- 4. Just sold / delivered ---------- */
  PS.addTemplate({
    id: 'sold', name: 'Sold / Delivered', group: 'Cars', family: 'photo', sizes: FEED, def: '1080x1350', file: 'delivered',
    car: true, badges: ['sold'], x: ['soldKind', 'custName', 'custMonth', 'custQuote', 'consentSold'], consent: 'consentSold', cta: 'ctaArrival', photoLabel: 'Delivered car photo', photo2: 'Customer or handover photo (optional)',
    render(c, L, S) {
      const v = carView(S.car), del = S.x.soldKind !== 'sold', name = del ? PS.val(S, 'custName') : '';
      compose(c, L, S, {
        style: 'sig', tags: false, icon: 'shieldCheck', card: [D.up(tx(del ? 'delivered' : 'soldStamp')), 'CLASSIC AUTO'], kBase: 1, kBaseSq: 0.62,
        // optional second photo (customer with the car, or the key handover) as a framed inset above the text
        afterPhoto: (cc, LL, g) => {
          const P2 = S.photos.second; if (!P2 || !P2.img || !del) return;
          const iw = Math.round(LL.W * (LL.mode === 'wide' ? 0.24 : 0.32)), ih = Math.min(Math.round(iw * 1.22), g.top - 28 - LL.top - 60); if (ih < 160) return;
          const bx = LL.W - LL.m - iw, by = g.top - 28 - ih, bd = 8;
          cc.save(); D.shadowBox(cc, () => D.fillRR(cc, bx - bd, by - bd, iw + bd * 2, ih + bd * 2, 18, B.cream)); D.rr(cc, bx, by, iw, ih, 12); cc.clip();
          D.photo(cc, S, 'second', P2, { x: bx, y: by, w: iw, h: ih }, { forceMode: 'fill' }); cc.restore();
        },
        blocks: (w, k) => {
          const bl = [];
          const ss = Math.round(150 * k), sm = dm(ss), word = D.up(tx(del ? 'delivered' : 'soldStamp'));
          const sf = D.dt(ss), sw = D.tw(c, word, sf, ss * 0.04) + 70, sh = sm.h + 64;
          bl.push({ h: sh + 16, draw: (x, y) => { c.save(); c.translate(x + 8, y + 8); c.rotate(-0.07); D.fillRR(c, 0, 0, sw, sh, 10, 'rgba(10,22,51,.86)'); D.strokeRR(c, 0, 0, sw, sh, 10, B.off, 6); D.strokeRR(c, 12, 12, sw - 24, sh - 24, 4, 'rgba(247,245,240,.5)', 2); D.T(c, word, sw / 2, sh / 2 + sm.h / 2 - 2, { font: sf, color: B.red, align: 'center', track: ss * 0.04 }); c.restore(); } });
          if (del && name) { const t = `${tx('congrats')}, ${name}!`, s = D.fit(c, D.up(t), D.dt, w, Math.round(112 * k), 56), m = dm(s); bl.push({ h: m.h, draw: (x, y) => D.T(c, D.up(t), x, y + m.b, { font: D.dt(s), color: FG() }) }); }
          else if (!del) { const s = Math.round(100 * k), m = dm(s); bl.push({ h: m.h, draw: (x, y) => D.T(c, D.up(v.model || ''), x, y + m.b, { font: D.dl(D.fit(c, D.up(v.model || ''), D.dl, w, s, 56)), color: FG() }) }); }
          const line = [v.name, (S.x.custMonth || '').trim()].filter(Boolean).join('   ·   ');
          bl.push(K.text(c, line, w, { font: D.bl(Math.max(34, 40 * k), 800), size: Math.max(34, 40 * k), color: FG(), max: 2 }));
          const q = del ? PS.val(S, 'custQuote') : ''; if (q) bl.push(K.text(c, '“' + q + '”', w, { font: D.bt(Math.max(34, 36 * k), 600), size: Math.max(34, 36 * k), color: FG(), max: 3, lh: Math.max(Math.round(48 * k), Math.round(Math.max(34, 36 * k) * 1.3)) }));
          else if (del) bl.push(K.text(c, tx('deliveredLine'), w, { font: D.bt(Math.max(32, 34 * k), 600), size: Math.max(32, 34 * k), color: MU(), max: 2 }));
          return bl;
        }
      });
    }
  });

  /* ---------- 5. Stock carousel: cover (hero car) / lineup grid / one slide per car / closing slide ---------- */
  function carSlides(S) { const ids = S.carousel.ids; return ids.map((id) => S.garage.find((g) => g.id === id)).filter(Boolean).slice(0, 6); }
  PS.carSlides = carSlides;
  PS.slideCount = (S) => { const n = carSlides(S).length; return n + 2 + (n >= 2 ? 1 : 0); };
  // what slide i is: {kind:'cover'|'lineup'|'car'|'cta', car, idx, n}
  PS.slideKind = function (S, i) {
    const cars = carSlides(S), n = cars.length, lineup = n >= 2, first = lineup ? 2 : 1;
    if (i <= 0) return { kind: 'cover', n };
    if (lineup && i === 1) return { kind: 'lineup', n };
    if (i >= first && i < first + n) return { kind: 'car', car: cars[i - first], idx: i - first + 1, n };
    return { kind: 'cta', n };
  };
  PS.addTemplate({
    id: 'carousel', name: 'Signature Carousel (weekly stock)', group: 'Cars', family: 'photo', sizes: FEED, def: '1080x1350', file: 'stockcarousel', carousel: true,
    car: false, badges: [], x: ['kw', 'carStyle'], cta: 'ctaEndSub',
    render(c, L, S) {
      const cars = carSlides(S), sk = PS.slideKind(S, Math.min(S.slide || 0, PS.slideCount(S) - 1));
      if (S.x.carStyle !== 'navy') return PS.sigCarousel(c, L, S, sk);
      if (sk.kind === 'cover') return coverSlide(c, L, S, cars);
      if (sk.kind === 'lineup') return lineupSlide(c, L, S, cars);
      if (sk.kind === 'cta') return ctaSlide(c, L, S);
      return carSlide(c, L, S, sk.car, sk.idx, sk.n);
    }
  });
  // the most expensive car that has a photo carries the cover
  function heroCar(cars) {
    const withP = cars.filter((c) => c.photoObj && c.photoObj.img), pool = withP.length ? withP : cars;
    return pool.slice().sort((a, b) => (PS.parseMoney(b.price) || 0) - (PS.parseMoney(a.price) || 0))[0] || null;
  }
  PS.heroCar = heroCar;
  function coverSlide(c, L, S, cars) {
    const { W, H, mode } = L, n = cars.length, hero = heroCar(cars), v = hero ? carView(hero) : null;
    compose(c, L, S, {
      style: 'full', photo: hero ? hero.photoObj : null, tags: false,
      blocks: (w, k) => {
        const bl = [K.headline(c, tx('thisWeek'), w, Math.round(150 * k), 70, 2)];
        if (v && v.name) bl.push(K.text(c, [v.name, v.parts ? PS.priceText(v.priceN) : ''].filter(Boolean).join('   ·   '), w, { font: D.bl(Math.max(34, 40 * k), 800), size: Math.max(34, 40 * k), color: B.off, max: 2 }));
        const kl = PS.kwLine(S); if (kl) bl.push(K.text(c, kl, w, { font: D.bt(Math.max(32, 36 * k), 800), size: Math.max(32, 36 * k), color: '#FFD9DB', max: 2 }));
        return bl;
      }
    });
    // HUD brackets around the frame (PS-8): corner marks and edge ticks, decoration only
    { const ins = Math.round(L.m * 0.55), len = Math.round(Math.min(W, H) * 0.09), yb = (L.bottom || H) - ins; c.save(); c.strokeStyle = 'rgba(255,255,255,.88)'; c.lineWidth = 6; c.lineCap = 'butt';
      [[ins, ins, 1, 1], [W - ins, ins, -1, 1], [ins, yb, 1, -1], [W - ins, yb, -1, -1]].forEach(([x, y, sx, sy]) => { c.beginPath(); c.moveTo(x, y + sy * len); c.lineTo(x, y); c.lineTo(x + sx * len, y); c.stroke(); });
      c.lineWidth = 3; c.globalAlpha = 0.7; [[W / 2 - 22, ins, W / 2 + 22, ins], [W / 2 - 22, yb, W / 2 + 22, yb], [ins, H / 2 - 22, ins, H / 2 + 22], [W - ins, H / 2 - 22, W - ins, H / 2 + 22]].forEach(([x0, y0, x1, y1]) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }); c.restore(); }
    const chip = `${n} ${D.up(tx(n === 1 ? 'car1' : 'cars'))} · ${D.up(tx('swipeShort'))}`;
    D.tag(c, chip, L.m, mode === 'wide' ? 52 : mode === 'tall' ? L.top : L.top - 8, { h: 56, size: 28, bg: B.off, fg: B.ink, raw: true, shadow: true });
  }
  function lineupGrid(c, S, cars, r) {
    const n = cars.length, cols = 2, rows = Math.max(1, Math.ceil(n / cols)), g = 16, tw = (r.w - g) / cols, th = Math.min((r.h - g * (rows - 1)) / rows, tw * 1.08);
    cars.forEach((car, i) => {
      const cx = r.x + (i % cols) * (tw + g), cy = r.y + Math.floor(i / cols) * (th + g);
      c.save(); D.rr(c, cx, cy, tw, th, 22); c.clip();
      if (car.photoObj && car.photoObj.img) D.photo(c, S, 'lu' + i, car.photoObj, { x: cx, y: cy, w: tw, h: th }, { forceMode: 'fill' }); else { c.fillStyle = '#16275A'; c.fillRect(cx, cy, tw, th); }
      c.fillStyle = D.lin(c, 0, cy + th * 0.45, 0, cy + th, [[0, 'rgba(10,22,51,0)'], [1, 'rgba(10,22,51,.94)']]); c.fillRect(cx, cy + th * 0.45, tw, th * 0.55);
      const nm = D.up(car.model || ''), ns = D.fit(c, nm, D.dl, tw - 36, 56, 32), pr = PS.parseMoney(car.price) > 0 ? PS.priceText(PS.parseMoney(car.price)) : '';
      D.T(c, nm, cx + 18, cy + th - (pr ? 62 : 20), { font: D.dl(ns), color: '#fff' });
      if (pr) D.T(c, pr, cx + 18, cy + th - 20, { font: D.dl(42), color: '#fff' });
      c.restore();
    });
  }
  function lineupSlide(c, L, S, cars) {
    const { mode } = L;
    compose(c, L, S, {
      style: 'none', bg: 'deep', anchor: 'top', side: mode === 'wide' ? (cc, r) => lineupGrid(cc, S, cars, { x: r.x + 10, y: 70, w: r.w - 80, h: r.h - 140 }) : null,
      blocks: (w, k) => {
        const hb = K.headline(c, tx('lineup'), w, Math.round(130 * k), 70, 2), bl = [hb];
        bl.push(K.text(c, `${cars.length} ${tx('cars')}`, w, { font: D.bt(36, 700), size: 36, color: B.mute, max: 1 }));
        if (mode !== 'wide') { const avail = (L.bottom - 54) - L.top, gh = Math.max(280, Math.round(avail - hb.h - bl[1].h - 2 * Math.round(24 * k))); bl.push({ h: gh, draw: (x, y, ww) => lineupGrid(c, S, cars, { x, y, w: ww, h: gh }) }); }
        return bl;
      }
    });
  }
  function carSlide(c, L, S, car, idx, n) {
    const v = carView(car);
    const P = car.photoObj;
    compose(c, L, S, {
      style: 'top', photo: P, bg: 'deep', anchor: 'spread', photoFrac: L.mode === 'square' ? 0.36 : 0.40, kBase: L.mode === 'square' ? 0.72 : 1,
      blocks: (w, k) => {
        const bl = [];
        bl.push(K.model(c, v.name || 'Car', w, k, '#fff', 104));
        if (v.variant) bl.push(K.variant(c, v.variant, w, k));
        // 6-cell spec grid (2 columns on the narrow landscape column so long values like the insurance line always fit)
        const cells = [[tx('lYear'), v.year], [tx('lKms'), v.km], [tx('lFuel'), v.fuel], [tx('lTrans'), v.trans], [tx('lOwner'), v.owner], [tx('lIns'), v.ins]].map((e) => [e[0], e[1] || '—']);
        const cols = L.mode === 'wide' ? 2 : 3, nr = Math.ceil(cells.length / cols), cw = (w - (cols - 1) * 14) / cols, lh = Math.round(30 * Math.max(1, k)), vs = Math.max(32, Math.round(36 * k));
        const lay = cells.map((cell) => { const r = D.fitWrap(c, cell[1], (z) => D.bt(z, 800), cw - 32, vs, 28, 2); return { sz: r.size, f: D.bt(r.size, 800), ln: r.lines }; });
        // a row with a two-line value is as tall as label + gap + both lines need, so the value never sits on its label; the value hangs from a fixed gap under the label
        const one = []; const rh = []; for (let r = 0; r < nr; r++) {
          const ls = lay.slice(r * cols, r * cols + cols), single = Math.max(...ls.map((l) => l.ln.length)) === 1, need = Math.max(...ls.map((l) => 20 + lh * 0.72 + 18 + l.sz * 0.82 + (l.ln.length - 1) * l.sz * 1.2 + 22));
          one.push(single); rh.push(Math.round(single ? Math.max(need, lh + vs * 1.5 + 30) : need));
        }
        const total = rh.reduce((a, b) => a + b, 0) + (nr - 1) * 14;
        bl.push({ h: total, draw: (x, y) => {
          cells.forEach((cell, i) => {
            const r = Math.floor(i / cols), cx = x + (i % cols) * (cw + 14), cy = y + rh.slice(0, r).reduce((a, b) => a + b + 14, 0), ch = rh[r], l = lay[i];
            D.fillRR(c, cx, cy, cw, ch, 14, 'rgba(255,255,255,.07)'); D.strokeRR(c, cx, cy, cw, ch, 14, 'rgba(247,245,240,.13)', 2);
            D.T(c, D.up(cell[0]), cx + 18, cy + 20 + lh * 0.72, { font: D.bt(26, 700), color: B.mute, track: PS.isHi() ? 0 : 1.6 });
            l.ln.forEach((t, j) => D.T(c, t, cx + 18, one[r] ? cy + ch - 24 - (l.ln.length - 1 - j) * Math.round(l.sz * 1.2) : cy + 20 + lh * 0.72 + 18 + l.sz * 0.82 + j * Math.round(l.sz * 1.2), { font: l.f, color: '#fff' }));
          });
        } });
        bl.push(K.priceRow(c, v, w, k, { size: 150 }));
        bl.push(K.emiNote(c, w, k, null, v));
        return bl;
      },
      tags: false
    });
    // slide chip (top right of the photo; the honesty label lives at the bottom so the two never meet)
    const chip = `${idx} / ${n}`; D.tag(c, chip, L.W - L.m - 120, L.mode === 'wide' ? 52 : (L.mode === 'tall' ? L.top : L.top - 8), { h: 52, size: 28, bg: 'rgba(10,22,51,.8)', fg: '#fff', border: 'rgba(247,245,240,.6)', raw: true, font: D.bl(28, 800), track: 1 });
  }
  function ctaSlide(c, L, S) {
    const ct = PS.contact(), url = ct.waUrl;
    // one logo on this slide (no footer plate), one way to act: WhatsApp QR (only when a WhatsApp number is set), the phone, or the DM handle
    compose(c, L, S, {
      style: 'none', bg: 'deep', anchor: 'center', noFooter: true, kBase: L.mode === 'wide' ? 1 : 1.3,
      side: L.mode === 'wide' ? (cc, r) => { const sz = Math.min(r.w, r.h) * 0.62; cc.save(); cc.translate(r.x + r.w / 2 - 20, r.y + r.h / 2); cc.rotate(-0.06); D.logoPlate(cc, -sz * 0.5 * 1.0, -sz * 0.3, sz * 0.5); cc.restore(); } : null,
      blocks: (w, k) => {
        const hs = Math.round(140 * k), hm = dm(hs), ht = PS.isHi() ? tx('ctaEndHead') : D.up(tx('ctaEndHead')), hf = D.fitWrap(c, ht, D.dt, w, hs, 70, 2), hl = hf.lines, hm2 = dm(hf.size);
        const bl = []; if (L.mode !== 'wide') bl.push({ h: Math.round(120 * k), draw: (x, y) => D.logoPlate(c, x, y, Math.round(120 * k)) });
        bl.push({ h: hl.length * hm2.h + (hl.length - 1) * 10, draw: (x, y) => hl.forEach((l, i) => D.T(c, l, x, y + hm2.b + i * (hm2.h + 10), { font: D.dt(hf.size), color: i === hl.length - 1 ? B.red : '#fff' })) });
        bl.push(K.text(c, PS.kwLine(S) || ctaOf(S, 'ctaEndSub'), w, { font: D.bt(36, 600), size: 36, color: '#E6EAF5', lh: 52, max: 3 }));
        if (ct.hasWa && url && typeof window.qrcode === 'function') {
          const qs = Math.round(Math.min(w * 0.36, 280) * Math.max(0.8, k));
          bl.push({ h: qs, draw: (x, y, ww) => {
            D.qr(c, url, x, y, qs, 2);
            const tx0 = x + qs + 32, avail = ww - qs - 32, ns = D.fit(c, ct.wa, D.dl, avail, Math.round(92 * k), 40);
            D.T(c, D.up(tx('whatsapp')), tx0, y + qs / 2 - ns * 0.74, { font: D.bt(26, 800), color: B.mute, track: PS.isHi() ? 0 : 3 });
            D.T(c, ct.wa, tx0, y + qs / 2 + ns * 0.34, { font: D.dl(ns), color: '#fff' });
          } });
        } else if (ct.hasPhone) {
          const s2 = D.fit(c, ct.phone, D.dl, w - 80, Math.round(92 * k), 40), h2 = Math.round(s2 * 1.3) + 30;
          bl.push({ h: h2, draw: (x, y) => { D.icon(c, 'phone', x + 24, y + h2 * 0.5, 46, B.off, 2.6); D.T(c, D.up(tx('callNow')), x + 64, y + 22, { font: D.bt(26, 800), color: B.mute, track: PS.isHi() ? 0 : 3 }); D.T(c, ct.phone, x + 64, y + 30 + s2 * 0.9, { font: D.dl(s2), color: '#fff' }); } });
        } else {
          const hs2 = 84, s2 = D.fit(c, PS.tx('dmHandle'), D.dl, w - 80, Math.round(hs2 * k), 40), h2 = Math.round(s2 * 1.3);
          bl.push({ h: h2 + 20, draw: (x, y) => { D.icon(c, 'chat', x + 22, y + h2 * 0.5, 44, B.off, 2.6); D.T(c, PS.tx('dmHandle'), x + 62, y + h2 * 0.5 + s2 * 0.32, { font: D.dl(s2), color: '#fff' }); } });
        }
        const af = D.bt(30, 600), al = D.wrap(c, PS.SITE.address_lines.join(' '), af, w - 50).slice(0, 4);     // the one address, in Latin script in every language
        bl.push({ h: al.length * 40 + 4, draw: (x, y) => { D.icon(c, 'pin', x + 16, y + 17, 32, B.mute, 2); al.forEach((l, i) => D.T(c, l, x + 44, y + 28 + i * 40, { font: af, color: B.mute })); } });
        return bl;
      }
    });
  }

  /* ---------- 6/7/8. Tall formats: reel cover, story, WhatsApp status ---------- */
  function tallListing(c, S, kind, L) {
    const { W, H } = L, v = carView(S.car), m = 64, w = W - 2 * m, P = S.photos.main, reel = kind === 'reel', wa = kind === 'wa';
    paintBg(c, L, 'flat');
    const full = { x: 0, y: 0, w: W, h: H }, top = { x: 0, y: 0, w: W, h: 1010 };
    if (reel) {
      D.photo(c, S, 'main', P, full, {});          // full-bleed crop, no letterbox. The title sits on the gradient
      c.fillStyle = D.lin(c, 0, 0, 0, 560, [[0, 'rgba(10,22,51,.9)'], [1, 'rgba(10,22,51,0)']]); c.fillRect(0, 0, W, 560);
      c.fillStyle = D.lin(c, 0, 400, 0, 1100, [[0, 'rgba(10,22,51,0)'], [0.2, 'rgba(10,22,51,.80)'], [0.85, 'rgba(10,22,51,.80)'], [1, 'rgba(10,22,51,0)']]); c.fillRect(0, 400, W, 700);
    } else {
      D.photo(c, S, 'main', P, top, { fit: { x: 0, y: 410, w: W, h: 560 }, back: top });   // fill by default; 'show whole photo' is the owner's choice
      c.fillStyle = D.lin(c, 0, 0, 0, 520, [[0, 'rgba(10,22,51,.9)'], [1, 'rgba(10,22,51,0)']]); c.fillRect(0, 0, W, 520);
      c.fillStyle = D.lin(c, 0, 760, 0, 1015, [[0, 'rgba(10,22,51,0)'], [0.7, 'rgba(10,22,51,.9)'], [1, 'rgba(10,22,51,1)']]); c.fillRect(0, 760, W, 255);
    }
    // story and WhatsApp status draw their own call to action, so the footer card shows the number or DM handle instead of repeating it
    D.footer(c, S, { x: 64, y: 262, w: W - 128, h: 112, style: 'card' }, 'card', { noCta: !reel });
    // "Comment PRICE and we will DM you the details" (PS-5): a pill that carries the owner's own keyword. Returns its height, 0 when no keyword is set.
    const kwPill = (x, y, ww) => {
      const t = PS.kwLine(S); if (!t) return 0; const fw = D.fitWrap(c, t, (z) => D.bt(z, 800), ww - 80, 34, 24, 2), lh = Math.round(fw.size * 1.25), ph = fw.lines.length * lh + 36;
      D.shadowBox(c, () => D.fillRR(c, x, y, ww, ph, ph / 2 > 40 ? 30 : ph / 2, B.off)); fw.lines.forEach((l, i) => D.T(c, l, x + 40, y + 18 + fw.size * 0.9 + i * lh, { font: D.bt(fw.size, 800), color: B.ink })); return ph;
    };
    const note = (y) => { if (isFinite(v.emi)) D.P(c, tx('emiNote'), m, y, { font: D.bt(26, 600), color: B.mute, w, lh: 34, max: 2 }); };
    const emiRow = (rx, base) => {
      if (!isFinite(v.emi)) return; const rs = 30, fs = 44, af = D.bl(fs, 800), sf = D.bt(rs, 700), suf = tx('perMo'), amt = emiParts(v);
      D.T(c, suf, rx, base, { font: sf, color: B.mute, align: 'right' }); D.T(c, amt, rx - D.tw(c, suf, sf) - 4, base, { font: af, color: '#fff', align: 'right' }); D.T(c, tx('emiEst'), rx, base - fs - 12, { font: sf, color: B.mute, align: 'right' });
    };
    if (reel) {
      const title = (S.x.reelTitle || 'First look').trim(), up = D.up(title);
      const tfit = D.fitWrap(c, up, D.dt, w, 200, 64, 2), size = tfit.size, mm = dm(size), lines = tfit.lines;      // two lines at the biggest size that holds every word; ellipsis only past 64 px
      if (tfit.cut) PS.note(S, 'The reel title is too long for the cover and was shortened. Use 6 words or fewer.');
      let y = 500;
      lines.forEach((l, i) => {
        const last = i === lines.length - 1, ws = l.split(' '), lw = last ? ws.pop() : null, pre = last ? ws.join(' ') + (ws.length ? ' ' : '') : l, by = y + mm.b + i * (mm.h + 20), sh = ['rgba(0,0,0,.45)', 24, 4];
        const wpre = pre ? D.T(c, pre, m, by, { font: D.dt(size), color: '#fff', shadow: sh }) : 0; if (lw) D.T(c, lw, m + wpre, by, { font: D.dt(size), color: B.red, shadow: sh });
      });
      y += lines.length * (mm.h + 20) + 18;
      const nm = D.up(v.name || 'Car'), ns = D.fit(c, nm, D.dl, w, 84, 50); D.T(c, nm, m, y + dm(ns).b, { font: D.dl(ns), color: '#fff' }); y += dm(ns).h + 34;
      const rp = S.x.reelPrice || 'show';
      if (rp === 'hide') {                       // a price reveal reel: the cover teases it, the real price is shown in the reveal frame at the end
        const t = D.up(tx('priceEnd')), ps = D.fit(c, t, D.dt, w - 120, 96, 48), pw = D.tw(c, t, D.dt(ps)), bh = dm(ps).h + 50, bw = pw + 90; c.save(); D.para(c, m, y, bw, bh, 30); c.fillStyle = B.red; c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 24; c.shadowOffsetY = 8; c.fill(); c.restore();
        D.T(c, t, m + 40, y + 25 + dm(ps).b, { font: D.dt(ps), color: '#fff' }); y += bh + 22;
      } else if (rp !== 'none' && v.parts) {
       const ps = 120, pw = priceW(c, v.parts, ps), bh = dm(ps).h + 50, bw = pw + 90; c.save(); D.para(c, m, y, bw, bh, 30); c.fillStyle = B.red; c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 24; c.shadowOffsetY = 8; c.fill(); c.restore(); drawPrice(c, v.parts, m + 40, y + 25 + dm(ps).b, ps, '#fff', 'left'); emiRow(W - m, y + bh - 10); y += bh + 22;
      }
      const kh = kwPill(m, y, w); if (kh) y += kh + 14;
      if (rp === 'show') note(y + 20);
    } else {
      badgeRow(c, S, m, 396, 1);
      D.T(c, v.eyebrow, m, 948, { font: D.bl(34, 800), color: B.mute, track: 4 });
      const nm = D.up(v.model || 'Model'), ns = D.fit(c, nm, D.dl, w, 120, 70); D.T(c, nm, m, 1062, { font: D.dl(ns), color: '#fff', shadow: ['rgba(0,0,0,.4)', 20, 4] });
      const pbase = 1198;
      if (v.parts) drawPrice(c, v.parts, m, pbase, 130, B.red, 'left'); emiRow(W - m, pbase);
      if (!wa) { // link-sticker zone: prompt card (y 1250-1500). The card text follows the contact state; the sticker guide is for the editor only.
        const sy = 1250, sh = 250, ct = PS.contact(); D.shadowBox(c, () => D.fillRR(c, m, sy, w, sh, 36, 'rgba(247,245,240,.96)'));
        D.icon(c, ct.hasPhone && !ct.hasWa ? 'phone' : 'chat', m + 74, sy + 86, 64, B.ink, 3);
        const tp = PS.kwLine(S) || (ct.hasPhone && !ct.hasWa && !PS.cta(S) ? tx('tapCall') : ctaOf(S, 'tapMsg')), hi = PS.isHi(), pf = D.fitWrap(c, hi ? tp : D.up(tp), (z) => (hi ? D.bt(z, 800) : D.dl(z)), w - 170, hi ? 40 : 60, hi ? 30 : 38, 2);
        const plh = Math.round(pf.size * (hi ? 1.3 : 1)); pf.lines.forEach((l, i) => D.T(c, l, m + 130, sy + 74 + (hi ? 6 : 0) + i * plh, { font: hi ? D.bt(pf.size, 800) : D.dl(pf.size), color: B.ink }));
        D.T(c, ct.hasWa ? ct.wa : ct.hasPhone ? ct.phone : ct.handle, m + 130, sy + sh - 52, { font: D.bl(34, 700), color: B.inkMute });
        D.icon(c, 'arrowDown', W - m - 52, sy + sh - 62, 44, B.red, 3.4);
        if (!S.exporting) { c.save(); c.setLineDash([14, 10]); D.strokeRR(c, m - 10, sy - 10, w + 20, sh + 20, 44, B.red, 4); c.restore(); D.T(c, hi ? PS.COPY.linkGuide[2] : PS.COPY.linkGuide[0], m, sy - 24, { font: D.bl(26, 800), color: B.red }); }
        note(1536);
      } else {
        const sp = K.specs(c, v.specs.slice(0, 3), w, 1, '#fff'); sp.draw(m, 1290, w);
        // CTA pill: shrinks, then wraps to two lines, so it never runs off the canvas
        const cta = ctaOf(S, 'replyBook'), fw = D.fitWrap(c, cta, (z) => D.bt(z, 800), w - 150, 40, 30, 2), ph = fw.lines.length > 1 ? 150 : 110, lf = D.bt(fw.size, 800), lh = Math.round(fw.size * 1.25);
        const tw = Math.min(w, Math.max(...fw.lines.map((l) => D.tw(c, l, lf))) + 150);
        const py = fw.lines.length > 1 ? 1360 : 1376;
        D.shadowBox(c, () => D.fillRR(c, m, py, tw, ph, ph / 2 > 60 ? 46 : 55, B.off)); D.icon(c, 'chat', m + 56, py + ph / 2, 44, B.ink, 2.6);
        fw.lines.forEach((l, i) => D.T(c, l, m + 96, py + ph / 2 + fw.size * 0.34 - (fw.lines.length - 1) * lh / 2 + i * lh, { font: lf, color: B.ink }));
        note(py + ph + 40);
      }
    }
    // honesty label: reel cover at the bottom edge of the safe zone, story and status just under the footer card
    // (the story's second badge sits at y 396-452, so the label moves under it when badges are shown)
    D.adjLabel(c, S, W - 64, reel ? H - 340 - 4 : (kind === 'story' && (S.badges || []).length ? 396 + 56 + 12 + Math.round(D.adjLabelSize(S) * 1.6) : 440), 'right');
  }

  /* ---------- Reel cover (1080x1920 and 1080x1350): the hook first, the car below the words ----------
     The words are laid out first (title, car name, price or PRICE AT THE END, keyword pill, footnote) so the car can take the room that is left under them. A landscape photo (or a cut-out)
     stands in that room with its edges fading into a blurred copy of itself, so no hard seam shows and the car never sits behind the title. On the 9:16 cover the logo bar sits
     inside the profile grid's 4:5 crop (y 285 to 1635); on the 4:5 cover everything is inside the grid-safe area. The price follows the "Price on the cover" choice on both. */
  function reelCover(c, S, L) {
    const { W, H } = L, tall = L.mode === 'tall', v = carView(S.car), m = 64, w = W - 2 * m, P = D.cutProxy(S.photos.main), hasP = !!(P && P.img), iw = hasP ? (P.img.naturalWidth || P.img.width) : 1, ih = hasP ? (P.img.naturalHeight || P.img.height) : 1;
    const land = hasP && (P.alpha || iw / ih > 0.7), barY = tall ? 300 : 40, y0 = tall ? 500 : 196, carLimit = tall ? H - 340 - 28 : H - 66;
    paintBg(c, L, 'flat');
    S._slots = S._slots || []; S._labels = S._labels || [];
    // 1) the words, measured and queued
    const ops = [], title = (S.x.reelTitle || 'First look').trim(), up = D.up(title), tfit = D.fitWrap(c, up, D.dt, w, tall ? 200 : 140, 64, 2), size = tfit.size, mm = dm(size);
    if (tfit.cut) PS.note(S, 'The reel title is too long for the cover and was shortened. Use 6 words or fewer.');
    let y = y0; const sh = ['rgba(0,0,0,.45)', 24, 4], ty = y;
    ops.push(() => tfit.lines.forEach((l, i) => {
      const last = i === tfit.lines.length - 1, ws = l.split(' '), lw = last ? ws.pop() : null, pre = last ? ws.join(' ') + (ws.length ? ' ' : '') : l, by = ty + mm.b + i * (mm.h + 20);
      const wpre = pre ? D.T(c, pre, m, by, { font: D.dt(size), color: '#fff', shadow: sh }) : 0; if (lw) D.T(c, lw, m + wpre, by, { font: D.dt(size), color: B.red, shadow: sh });
    }));
    y += tfit.lines.length * (mm.h + 20) + 18;
    const nm = D.up(v.name || 'Car'), ns = D.fit(c, nm, D.dl, w, tall ? 84 : 66, 44), ny = y; ops.push(() => D.T(c, nm, m, ny + dm(ns).b, { font: D.dl(ns), color: '#fff' })); y += dm(ns).h + (tall ? 34 : 26);
    const rp = S.x.reelPrice || 'show';
    if (rp === 'hide') {                       // a price reveal reel: the cover teases it, the real price is shown in the reveal frame at the end
      const t = D.up(tx('priceEnd')), ps = D.fit(c, t, D.dt, w - 120, tall ? 96 : 72, 44), pw = D.tw(c, t, D.dt(ps)), bh = dm(ps).h + 50, bw = pw + 90, by = y;
      ops.push(() => { c.save(); D.para(c, m, by, bw, bh, 30); c.fillStyle = B.red; c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 24; c.shadowOffsetY = 8; c.fill(); c.restore(); D.T(c, t, m + 40, by + 25 + dm(ps).b, { font: D.dt(ps), color: '#fff' }); }); y += bh + 22;
    } else if (rp !== 'none' && v.parts) {
      const ps = tall ? 120 : 92, pw = priceW(c, v.parts, ps), bh = dm(ps).h + 50, bw = pw + 90, by = y;
      ops.push(() => {
        c.save(); D.para(c, m, by, bw, bh, 30); c.fillStyle = B.red; c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 24; c.shadowOffsetY = 8; c.fill(); c.restore(); drawPrice(c, v.parts, m + 40, by + 25 + dm(ps).b, ps, '#fff', 'left');
        if (isFinite(v.emi)) { const rs = 30, fs = 44, af = D.bl(fs, 800), sf = D.bt(rs, 700), suf = tx('perMo'), amt = emiParts(v), rx = W - m, base = by + bh - 10; D.T(c, suf, rx, base, { font: sf, color: B.mute, align: 'right' }); D.T(c, amt, rx - D.tw(c, suf, sf) - 4, base, { font: af, color: '#fff', align: 'right' }); D.T(c, tx('emiEst'), rx, base - fs - 12, { font: sf, color: B.mute, align: 'right' }); }
      }); y += bh + 22;
    }
    const kt = PS.kwLine(S);
    if (kt) {
      const fw = D.fitWrap(c, kt, (z) => D.bt(z, 800), w - 80, 34, 24, 2), lh = Math.round(fw.size * 1.25), ph = fw.lines.length * lh + 36, ky = y;
      ops.push(() => { D.shadowBox(c, () => D.fillRR(c, m, ky, w, ph, ph / 2 > 40 ? 30 : ph / 2, B.off)); fw.lines.forEach((l, i) => D.T(c, l, m + 40, ky + 18 + fw.size * 0.9 + i * lh, { font: D.bt(fw.size, 800), color: B.ink })); }); y += ph + 14;
    }
    if (rp === 'show' && isFinite(v.emi)) { const ny2 = y + 6; ops.push(() => D.P(c, tx('emiNote'), m, ny2, { font: D.bt(26, 600), color: B.mute, w, lh: 34, max: 2 })); y += 6 + 68; }
    const textEnd = y;
    // 2) the car, in the room under the words
    const full = { x: 0, y: 0, w: W, h: H };
    if (!hasP) D.photo(c, S, 'main', null, full, {});
    else if (!land) D.photo(c, S, 'main', P, full, { forceMode: 'fill' });          // a tall photo fills the whole cover
    else {
      if (P.alpha) { const gl = c.createRadialGradient(W / 2, H * 0.78, 40, W / 2, H * 0.78, W * 0.8); gl.addColorStop(0, 'rgba(60,90,160,.35)'); gl.addColorStop(1, 'rgba(60,90,160,0)'); c.fillStyle = gl; c.fillRect(0, 0, W, H); }
      else D.blurBack(c, P.img, full, P);
      const top = textEnd + 20; let R = { x: 0, y: top, w: W, h: carLimit - top - (P.alpha ? 56 : 0) };      // a cut-out car ends above the honesty label (its tyres are not faded out like a photo's edge)
      if (R.h < 260) { PS.note(S, 'The words fill most of the cover, so the car is small. Use a shorter title or switch the keyword off.'); R = { x: 0, y: carLimit - 260, w: W, h: 260 }; }
      const dr = D.photoPlaced(c, S, P, R, { feather: { l: 60, r: 60, t: R.h * 0.1, b: R.h * 0.1 }, radial: [0.6, 0.62, 0.62], minFrac: 0.5, anchorX: 0.5, slackY: 0.5, cut: !!P.alpha, noBackdrop: true, maxScale: P.alpha ? 0 : 1.3 });
      S._slots.push({ key: 'main', r: R, dr, mode: 'fill' });
      if (!P.alpha) S._labels.push(PS.tx('adjLabelBlur'));
    }
    if (hasP && P.src === 'stock') S._samplePhoto = true;
    // 3) the dark band under the words (it ends where the words end, so a footnote is never over the car), then the logo bar, then the words
    c.fillStyle = D.lin(c, 0, 0, 0, barY + 112 + 90, [[0, 'rgba(10,22,51,.9)'], [1, 'rgba(10,22,51,0)']]); c.fillRect(0, 0, W, barY + 112 + 90);
    if (land) { const a = y0 - 70, b = textEnd + 50; c.fillStyle = D.lin(c, 0, a, 0, b, [[0, 'rgba(10,22,51,0)'], [0.14, 'rgba(10,22,51,.84)'], [0.8, 'rgba(10,22,51,.84)'], [1, 'rgba(10,22,51,0)']]); c.fillRect(0, a, W, b - a); }
    else { const a = y0 - 100, b = textEnd + 80; c.fillStyle = D.lin(c, 0, a, 0, b, [[0, 'rgba(10,22,51,0)'], [0.2, 'rgba(10,22,51,.80)'], [0.85, 'rgba(10,22,51,.80)'], [1, 'rgba(10,22,51,0)']]); c.fillRect(0, a, W, b - a); }
    D.footer(c, S, { x: m, y: barY, w: W - 2 * m, h: 112, style: 'card' }, 'card', {});
    ops.forEach((f) => f());
    D.adjLabel(c, S, W - 64, tall ? H - 340 - 4 : H - 24, 'right', 0.85);
  }
  const TALL = ['1080x1920'];
  PS.addTemplate({ id: 'reelcover', name: 'Reel Cover', group: 'Cars', family: 'photo', sizes: ['1080x1920', '1080x1350'], def: '1080x1920', file: 'reelcover', car: true, badges: [], x: ['reelTitle', 'reelPrice', 'kw'], cta: 'ctaArrival', safe: 'reel',
    render(c, L, S) { reelCover(c, S, L); } });
  PS.addTemplate({ id: 'story', name: 'Story', group: 'Cars', family: 'photo', sizes: TALL, def: '1080x1920', file: 'story', car: true, badges: [], x: ['kw'], cta: 'tapMsg', safe: 'story',
    render(c, L, S) {
      const v = carView(S.car), ct = PS.contact(), A = PS.classicParts.accentOf(S), sv = PS.classicParts.view(S);       // the card top-right says what is true of the car: its registration month and its owner line
      compose(c, L, S, {
        style: 'sig', tags: true, icon: 'calGrid', card: [sv.reg || 'CLASSIC AUTO', sv.owner || ''], anchor: 'top',
        blocks: (w, k) => {
          const bl = [K.eyebrow(c, v.eyebrow, k), K.model(c, v.model || 'Model', w, k, null, 124)];
          if (v.parts) bl.push(K.priceRow(c, v, w, k, { size: 150 }));
          const en = K.emiNote(c, w, k, null, v); if (en) { en.gap = 52; bl.push(en); } else if (bl.length) bl[bl.length - 1].gap = 52;
          // link-sticker prompt: where the editor drops the link sticker. The number or handle is in the contact bar below, so the card only carries the prompt.
          const hi = PS.isHi(), tp = PS.kwLine(S) || (ct.hasPhone && !ct.hasWa && !PS.cta(S) ? tx('tapCall') : ctaOf(S, 'tapMsg')), pf = D.fitWrap(c, hi ? tp : D.up(tp), (z) => (hi ? D.bt(z, 800) : D.dl(z)), w - 170, hi ? 40 : 56, hi ? 28 : 34, 2), ph = Math.max(130, pf.lines.length * Math.round(pf.size * (hi ? 1.3 : 1.05)) + 58);
          bl.push({ h: ph + 8, draw: (x, y) => {
            D.shadowBox(c, () => D.fillRR(c, x, y, w, ph, 30, '#FFFFFF')); D.strokeRR(c, x, y, w, ph, 30, A.a, 4); D.icon(c, ct.hasPhone && !ct.hasWa ? 'phone' : 'chat', x + 64, y + ph / 2, 56, A.a, 3);
            const lh = Math.round(pf.size * (hi ? 1.3 : 1.05)), y0 = y + ph / 2 - (pf.lines.length * lh) / 2 + pf.size * (hi ? 0.82 : 0.86);
            pf.lines.forEach((l, i) => D.T(c, l, x + 116, y0 + i * lh, { font: hi ? D.bt(pf.size, 800) : D.dl(pf.size), color: PS.classicParts.INK })); D.icon(c, 'arrowDown', x + w - 54, y + ph / 2, 42, B.red, 3.4);
            if (!S.exporting) { c.save(); c.setLineDash([14, 10]); D.strokeRR(c, x - 10, y - 10, w + 20, ph + 20, 38, B.red, 4); c.restore(); D.T(c, hi ? PS.COPY.linkGuide[2] : PS.COPY.linkGuide[0], x, y - 18, { font: D.bl(24, 800), color: B.red }); }
          } });
          return bl;
        }
      });
    } });
  PS.addTemplate({ id: 'wastatus', name: 'WhatsApp Status', group: 'Cars', family: 'photo', sizes: TALL, def: '1080x1920', file: 'whatsappstatus', car: true, badges: [], x: [], cta: 'replyBook', safe: 'wa',
    render(c, L, S) { tallListing(c, S, 'wa', L); } });
})();
