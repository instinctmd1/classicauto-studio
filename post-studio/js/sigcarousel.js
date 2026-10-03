/* Classic Auto Post Studio — the Signature carousel: the same light showroom design as the Signature post (classic.js), slide by slide.
   cover (hero car in a rounded frame) / lineup (photo tiles) / one full Signature post per car / closing slide (contact, address, services).
   Built from PS.classicParts so the header, the contact bar and the BUY . SELL . EXCHANGE . UPGRADE strip are the very same pieces. */
(function () {
  'use strict';
  const PS = window.PS, D = PS.D, B = PS.B, tx = (k) => PS.tx(k), P0 = () => PS.classicParts;

  const carNoPhoto = (c) => { const o = Object.assign({}, c); delete o.photoObj; delete o.photo; return o; };
  // a state for one slide: the same studio state with this car in it (photo shared by reference, so dragging it on a car slide still works)
  function sub(S, car, extra) {
    return Object.assign({}, S, { car: carNoPhoto(car), photos: { main: car.photoObj || null, second: null, hero: null }, _slots: [], _labels: [], _chip: null,
      x: Object.assign({}, S.x, { accent: 'auto', luxury: 'auto', stamp: 'none', tagline: '' }, extra || {}) });
  }
  const back = (S, S2) => { S._slots = S2._slots; S._labels = S2._labels; S._samplePhoto = S._samplePhoto || S2._samplePhoto; S._demo = S._demo || S2._demo; };

  function body(g) { const y0 = g.mode === 'tall' ? 452 : g.hdr.h + 14, y1 = g.foot.y - 24; return { x: g.m, y: y0, w: g.W - 2 * g.m, h: y1 - y0, b: y1 }; }

  // top-right card, like the registration card of the Signature post: a count and one short word
  const cardRect = (g) => ({ x: g.W - g.m - g.hdr.card.w, y: g.hdr.card.y, w: g.hdr.card.w, h: g.hdr.card.h });
  function chipCard(c, g, A, l1, l2) {
    const k = g.hdr.card, x = g.W - g.m - k.w, y = k.y, p = P0();
    c.save(); c.shadowColor = 'rgba(10,26,58,.18)'; c.shadowBlur = 18; c.shadowOffsetY = 5; D.fillRR(c, x, y, k.w, k.h, 18, '#FFFFFF'); c.restore(); D.strokeRR(c, x, y, k.w, k.h, 18, A.a, 3);
    D.icon(c, 'carFront', x + 46, y + k.h / 2, 52, A.a, 2); const tx0 = x + 98, avail = x + k.w - 16 - tx0;
    const s1 = D.fit(c, l1, (z) => p.LATIN_H(z, 800), avail, Math.round(k.h * 0.44), 18, 0), s2 = D.fit(c, l2, (z) => D.bt(z, 700), avail, Math.round(k.h * 0.27), 12);
    D.T(c, l1, tx0, y + k.h * 0.52, { font: p.LATIN_H(s1, 800), color: A.a }); D.T(c, l2, tx0, y + k.h * 0.82, { font: D.bt(s2, 700), color: p.INK });
    return { x, y, w: k.w, h: k.h };
  }
  // background, header, and (optionally) the navy contact bar + services strip, on the geometry of the Signature post
  function shell(c, S2, g, A, card, o) {
    const p = P0(), v = { luxury: PS.isLuxury(S2.car, S2.x.luxury) };
    p.background(c, g); p.header(c, S2, g, v, A, card);
    if (!(o && o.noBar)) p.footerBar(c, S2, g, A);
    p.menuStrip(c, g);
    if (g.mode === 'tall') { const y0 = g.menu.y + g.menu.h; c.fillStyle = D.lin(c, 0, y0, 0, g.H, [[0, A.a], [1, A.b]]); c.fillRect(0, y0, g.W, g.H - y0); }
  }
  // the keyword pill ("Comment PRICE and we will DM you the details")
  function kwPill(c, S, A, x, y, w, measure) {
    const t = PS.kwLine(S); if (!t) return 0; const fw = D.fitWrap(c, t, (z) => D.bt(z, 800), w - 60, 30, 20, 2), lh = Math.round(fw.size * 1.25), h = fw.lines.length * lh + 30;
    if (measure) return h + 16;
    D.fillRR(c, x, y, w, h, 18, A.a); fw.lines.forEach((l, i) => D.T(c, l, x + 30, y + 15 + fw.size * 0.92 + i * lh, { font: D.bt(fw.size, 800), color: '#fff' })); return h + 16;
  }
  // the first of several wordings that fits the width (size shrinks to minS); the shortest is the last resort
  function fitCand(c, cands, fontFn, w, size, minS) {
    for (const t of cands) { let z = size; while (z > minS && D.tw(c, t, fontFn(z)) > w) z -= 1; if (D.tw(c, t, fontFn(z)) <= w) return { t, z }; }
    const t = cands[cands.length - 1]; return { t, z: minS };
  }
  const heroOf = (S) => PS.heroCar(PS.carSlides(S)) || PS.carSlides(S)[0];

  /* ---------- cover ---------- */
  function cover(c, L, S) {
    const g = P0().geo(L.W, L.H), cars = PS.carSlides(S), hero = heroOf(S), n = cars.length, p = P0();
    const S2 = hero ? sub(S, hero) : sub(S, S.car), A = p.accentOf(S2), v = p.view(S2), B0 = body(g), k = g.k, wide = g.mode === 'wide';
    shell(c, S2, g, A, cardRect(g)); chipCard(c, g, A, `${n} ${D.up(tx(n === 1 ? 'car1' : 'cars'))}`, D.up(tx('swipeShort')));
    const colW = wide ? 760 : B0.w, pw = wide ? 520 : 400, ph0 = wide ? 136 : 118, infoH0 = ph0 + 28; let y = B0.y + 6, hs = Math.round((wide ? 124 : 112) * k), hf;
    const head = () => D.fitWrap(c, p.up(tx('thisWeek')), (z) => p.hf(p.up(tx('thisWeek')), z, 800), colW, hs, 54, 2, -1);
    // the headline shrinks until the photo has at least 260 px (the price box must never be pushed down into the footer)
    for (let sc = 1; sc >= 0.55; sc -= 0.15) { hs = Math.round((wide ? 124 : 112) * k * sc); hf = head(); const yy = B0.y + 6 + hf.size * 0.8 + (hf.lines.length - 1) * hf.size * 0.98 + 26 + 30 + kwPill(c, S, A, B0.x, 0, Math.min(colW, 760), true); if (wide || B0.b - infoH0 - yy - 12 >= 260) break; }
    hf.lines.forEach((l, i) => D.T(c, l, B0.x - 2, y + hf.size * 0.8 + i * hf.size * 0.98, { font: p.hf(l, hf.size, 800), color: p.textCol(A), track: -1 }));
    y += hf.size * 0.8 + (hf.lines.length - 1) * hf.size * 0.98 + 26; c.fillStyle = B.red; c.fillRect(B0.x, y, 120, 5); y += 30;
    const kh = kwPill(c, S, A, B0.x, y, Math.min(colW, 760)); y += kh;
    // info under the photo: name, variant, price
    const ph = Math.min(ph0, Math.max(90, B0.b - (y + 6 + 200) - 30)), g2 = { price: { w: pw, h: ph } };
    if (wide) {
      const fr0 = { x: 900, y: B0.y, w: g.W - g.m - 900, h: B0.h }, fd = p.frameFor(S2.photos.main, fr0.w, fr0.h), fr = { x: fr0.x + fr0.w - fd.w, y: fr0.y + (fr0.h - fd.h) / 2, w: fd.w, h: fd.h }, ib = y + 10;
      if (hero) { D.T(c, p.up([v.make, v.model].filter(Boolean).join(' ')), B0.x, ib + 44, { font: p.hf(v.model, 44, 800), color: p.INK }); if (v.variant) { const f = fitCand(c, [v.variant, v.variant.split(' ').slice(0, 3).join(' ')], (z) => D.bt(z, 700), colW, 30, 18); D.T(c, f.t, B0.x, ib + 90, { font: D.bt(f.z, 700), color: p.GREY }); } p.priceBox(c, S2, g2, v, A, B0.x, ib + 120); }
      p.slot(c, S2, fr, g); back(S, S2); return;
    }
    const infoH = ph + 28, fr = { x: B0.x, y: y + 6, w: B0.w, h: Math.max(200, B0.b - infoH - y - 12) }, fd = p.frameFor(S2.photos.main, fr.w, fr.h);
    p.slot(c, S2, { x: fr.x + (fr.w - fd.w) / 2, y: fr.y + (fr.h - fd.h) / 2, w: fd.w, h: fd.h }, g); back(S, S2);      // the whole car shows: the frame follows the photo's own shape
    if (hero) {
      const iy = fr.y + fr.h + 22, nw = B0.w - pw - 28, nm = p.up([v.make, v.model].filter(Boolean).join(' ')), ns = D.fit(c, nm, (z) => p.hf(nm, z, 800), nw, Math.round(46 * k), 24, -0.5);
      D.T(c, nm, B0.x, iy + ns * 0.9, { font: p.hf(nm, ns, 800), color: p.INK, track: -0.5 });
      const vz = Math.round(26 * Math.min(1.2, k)), vf = fitCand(c, [[v.year, v.variant].filter(Boolean).join('  ·  '), v.variant, String(v.year || '')].filter(Boolean), (z) => D.bt(z, 700), nw, vz, 18); if (vf.t) D.T(c, vf.t, B0.x, iy + ns * 0.9 + 14 + vz, { font: D.bt(vf.z, 700), color: p.GREY });      // the whole line, else the variant alone, else the year: never cut with an ellipsis
      p.priceBox(c, S2, g2, v, A, B0.x + B0.w - pw, iy - 4);
    }
  }

  /* ---------- lineup ---------- */
  function tile(c, S, car, r, A) {
    const S2 = sub(S, car), v = P0().view(S2), p = P0(), lab = Math.round(Math.max(76, r.h * 0.3));
    c.save(); c.shadowColor = 'rgba(10,26,58,.22)'; c.shadowBlur = 30; c.shadowOffsetY = 10; D.fillRR(c, r.x, r.y, r.w, r.h, 26, '#FFFFFF'); c.restore();
    c.save(); D.rr(c, r.x, r.y, r.w, r.h, 26); c.clip();
    const pr = { x: r.x, y: r.y, w: r.w, h: r.h - lab }, P = S2.photos.main;
    if (P && P.img) { if (P.alpha) D.stage(c, S2, P, { x: pr.x, y: pr.y, w: pr.w, h: pr.h }, { radius: 0 }); else D.photo(c, S2, 'lu', P, pr, { forceMode: 'fill' }); } else { c.fillStyle = '#E9EDF5'; c.fillRect(pr.x, pr.y, pr.w, pr.h); }
    c.restore();
    S._labels = (S._labels || []).concat(S2._labels); S._samplePhoto = S._samplePhoto || S2._samplePhoto;
    // the label zone is planned as one stack: the name (one line, or two smaller ones) above the price, so a long name can never reach the price under it
    const pad = 20, padY = Math.round(lab * 0.1), nm = p.up([v.make, v.model].filter(Boolean).join(' ')), pp = PS.priceParts(v.price), ps = Math.round(lab * 0.26), availName = lab - padY * 2 - ps - 6, fn = (z) => p.hf(nm, z, 800);
    let nf = D.fitWrap(c, nm, fn, r.w - 2 * pad, Math.min(Math.round(lab * 0.3), Math.floor(availName / 0.8)), Math.round(lab * 0.26), 1, -0.3);
    if (nf.cut) nf = D.fitWrap(c, nm, fn, r.w - 2 * pad, Math.max(14, Math.floor(availName / 1.9)), 12, 2, -0.3);
    nf.lines.forEach((l, i) => D.T(c, l, r.x + pad, r.y + r.h - lab + padY + nf.size * 0.8 + i * nf.size * 1.1, { font: p.hf(l, nf.size, 800), color: p.INK, track: -0.3 }));
    const pby = r.y + r.h - padY;
    if (pp) D.T(c, pp.sym + pp.num + (pp.unit ? ' ' + pp.unit : ''), r.x + pad, pby, { font: p.LATIN_H(ps, 800), color: p.textCol(p.accentOf(S2)) });
    else if (v.poa) D.T(c, p.up(tx('priceOnReq')), r.x + pad, pby, { font: D.bt(Math.round(ps * 0.8), 800), color: p.GREY });
  }
  function lineup(c, L, S) {
    const g = P0().geo(L.W, L.H), cars = PS.carSlides(S), n = cars.length, p = P0(), hero = heroOf(S), S2 = hero ? sub(S, hero) : sub(S, S.car), A = p.accentOf(S2), B0 = body(g), k = g.k, wide = g.mode === 'wide';
    shell(c, S2, g, A, cardRect(g)); chipCard(c, g, A, `${n} ${D.up(tx(n === 1 ? 'car1' : 'cars'))}`, D.up(tx('swipeShort')));
    let y = B0.y + 6; const hs = Math.round((wide ? 96 : 100) * k), ht = p.up(tx('lineup')), hf = D.fitWrap(c, ht, (z) => p.hf(ht, z, 800), wide ? 900 : B0.w, hs, 50, 1, -1);
    D.T(c, hf.lines[0], B0.x - 2, y + hf.size * 0.8, { font: p.hf(hf.lines[0], hf.size, 800), color: p.textCol(A), track: -1 }); y += hf.size * 0.8 + 22; c.fillStyle = B.red; c.fillRect(B0.x, y, 120, 5); y += 30;
    const cols = wide || g.mode === 'square' ? 3 : 2, rows = Math.ceil(n / cols), gap = 24, area = { x: B0.x, y, w: B0.w, h: B0.b - y - 4 };
    let tw = (area.w - gap * (cols - 1)) / cols, th = (area.h - gap * (rows - 1)) / rows; th = Math.min(th, tw * 0.92);
    const gh = rows * th + (rows - 1) * gap, oy = area.y + Math.max(0, (area.h - gh) / 2);
    cars.forEach((car, i) => { const r = Math.floor(i / cols), cc = i % cols, inRow = Math.min(cols, n - r * cols), rowW = inRow * tw + (inRow - 1) * gap, ox = area.x + (area.w - rowW) / 2; tile(c, S, car, { x: ox + cc * (tw + gap), y: oy + r * (th + gap), w: tw, h: th }, A); });
  }

  /* ---------- one Signature post per car ---------- */
  function carSlide(c, L, S, car, idx, n) {
    const S2 = sub(S, car); S2._chip = `${idx} / ${n}`; S2.exporting = S.exporting; PS.classicListing(c, L, S2); back(S, S2);
  }

  /* ---------- closing slide ---------- */
  function closing(c, L, S) {
    const g = P0().geo(L.W, L.H), p = P0(), cars = PS.carSlides(S), car = cars[0] || S.car, S2 = sub(S, car), A = p.accentOf(S2), B0 = body(g), k = g.k, wide = g.mode === 'wide', ct = PS.contact();
    shell(c, S2, g, A, { x: g.W - g.m }, { noBar: true });
    // slim brand bar in the footer position (the contact is the big card above)
    c.fillStyle = D.lin(c, 0, g.foot.y, 0, g.foot.y + g.foot.h, [[0, A.a], [1, A.b]]); c.fillRect(0, g.foot.y, g.W, g.foot.h);
    const bn = 'CLASSIC AUTO', bs = Math.round(30 * Math.min(1.3, k)), tr = 6, bw = D.tw(c, bn, D.bl(bs, 700), tr), cx = g.W / 2;
    D.T(c, bn, cx, g.foot.y + g.foot.h * 0.44, { font: D.bl(bs, 700), color: '#fff', align: 'center', track: tr }); c.fillStyle = B.red; c.fillRect(cx - bw / 2, g.foot.y + g.foot.h * 0.52, bw, 3);
    const sl = D.fit(c, tx('sinceLoc'), (z) => D.bt(z, 500), g.W - 2 * g.m, Math.round(20 * Math.min(1.3, k)), 12); D.T(c, tx('sinceLoc'), cx, g.foot.y + g.foot.h * 0.82, { font: D.bt(sl, 500), color: 'rgba(255,255,255,.85)', align: 'center' });
    const colW = wide ? 940 : B0.w; let y = B0.y + 6;
    const ht = p.up(tx('ctaEndHead')), hs = Math.round((wide ? 130 : 128) * k), hf = D.fitWrap(c, ht, (z) => p.hf(ht, z, 800), colW, hs, 56, 2, -1);
    hf.lines.forEach((l, i) => D.T(c, l, B0.x - 2, y + hf.size * 0.8 + i * hf.size * 0.98, { font: p.hf(l, hf.size, 800), color: i === hf.lines.length - 1 ? p.textCol(A) : p.INK, track: -1 }));
    y += hf.size * 0.8 + (hf.lines.length - 1) * hf.size * 0.98 + 26; c.fillStyle = B.red; c.fillRect(B0.x, y, 120, 5); y += 30;
    const sub1 = PS.kwLine(S) || PS.cta(S) || (ct.hasWa ? tx('ctaEndSubWa') : tx('ctaEndSub')), ss = Math.round(30 * Math.min(1.25, k)), fw = D.fitWrap(c, sub1, (z) => D.bt(z, 600), colW, ss, 22, 3, 0), lh = Math.round(fw.size * 1.4);
    fw.lines.forEach((l, i) => D.T(c, l, B0.x, y + fw.size * 0.95 + i * lh, { font: D.bt(fw.size, 600), color: p.GREY })); y += fw.lines.length * lh + 22;
    // contact card: CALL NOW + number, else DM + handle; the QR joins it only when a WhatsApp number is set
    const room = B0.b - y, ch = Math.round(Math.min(wide ? 190 : 300, Math.max(130, room * 0.42))), cw = wide ? 940 : B0.w; let cy = y;
    c.save(); c.shadowColor = 'rgba(10,26,58,.28)'; c.shadowBlur = 30; c.shadowOffsetY = 10; D.fillRR(c, B0.x, cy, cw, ch, 26, A.a); c.restore();
    c.save(); D.rr(c, B0.x, cy, cw, ch, 26); c.clip(); c.fillStyle = D.lin(c, B0.x, cy, B0.x + cw, cy + ch, [[0, A.mid], [1, A.b]]); c.fillRect(B0.x, cy, cw, ch); c.restore();
    const qr = ct.hasWa && ct.waUrl && typeof window.qrcode === 'function', qs = qr ? Math.round(ch - 40) : 0, icon = ct.hasPhone ? 'phone' : 'chat', lab = p.up(ct.hasPhone ? tx('callNow') : ct.hasWa ? tx('whatsapp') : tx('dmUs')), val = ct.hasPhone ? ct.phone : ct.hasWa ? ct.wa : ct.handle;
    D.icon(c, icon, B0.x + 64, cy + ch / 2, 56, '#fff', 2.6); const ls = Math.round(ch * 0.15), vs = D.fit(c, val, (z) => D.bt(z, 800), cw - 130 - (qr ? qs + 40 : 0), Math.round(ch * 0.34), 20);
    D.T(c, lab, B0.x + 116, cy + ch * 0.38, { font: D.bt(ls, 800), color: 'rgba(255,255,255,.85)', track: PS.isHi() ? 0 : 3 }); D.T(c, val, B0.x + 116, cy + ch * 0.38 + ls * 0.6 + vs * 0.95, { font: D.bt(vs, 800), color: '#fff' });
    if (qr) D.qr(c, ct.waUrl, B0.x + cw - qs - 20, cy + 20, qs, 2);
    y = cy + ch + 22;
    // address card
    const al = PS.SITE.address_lines, as = Math.round(Math.min(28, Math.max(18, (B0.b - y) / 5.2) * Math.min(1.2, k))), ah = Math.min(B0.b - y, al.length * as * 1.45 + 36);
    if (ah > 60) {
      D.fillRR(c, B0.x, y, cw, ah, 22, '#FFFFFF'); D.strokeRR(c, B0.x, y, cw, ah, 22, '#D5DAE6', 2); D.icon(c, 'pin', B0.x + 54, y + ah / 2, 44, A.a, 2.4);
      let aw = as; while (aw > 12 && Math.max(...al.map((l) => D.tw(c, l, D.bl(aw, 600)))) > cw - 130) aw -= 0.5;
      al.forEach((l, i) => D.T(c, l, B0.x + 100, y + ah / 2 - (al.length * aw * 1.45) / 2 + aw * 1.05 + i * aw * 1.45, { font: D.bl(aw, 600), color: p.INK }));
    }
    if (wide) {                                       // the right half of the wide slide: the hero car in a frame, when one has a photo
      const hero = heroOf(S); if (hero && hero.photoObj && hero.photoObj.img) { const S3 = sub(S, hero); p.slot(c, S3, { x: 1060, y: B0.y, w: g.W - g.m - 1060, h: Math.min(B0.h, 560) }, g); back(S, S3); S._slots = []; }
    }
  }

  PS.sigCarousel = function (c, L, S, sk) {
    if (sk.kind === 'cover') return cover(c, L, S);
    if (sk.kind === 'lineup') return lineup(c, L, S);
    if (sk.kind === 'cta') return closing(c, L, S);
    return carSlide(c, L, S, sk.car, sk.idx, sk.n);
  };
})();
