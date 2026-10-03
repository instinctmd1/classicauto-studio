/* Classic Auto Post Studio — greeting, trust, sell, finance, hiring, testimonial and banner templates. */
(function () {
  'use strict';
  const PS = window.PS, D = PS.D, B = PS.B, K = PS.K, tx = (k) => PS.tx(k), dm = PS.dm, bm = PS.bm, carView = PS.carView, compose = PS.compose;
  const FEED = PS.FEED;
  const L3 = ['en', 'hn', 'hi'];
  const pick = (arr) => arr[L3.indexOf(PS.lang)] || arr[0];
  const ctaOf = (S, key) => PS.cta(S) || tx(key);
  // icon + one or two lines of single-purpose text (date lines, locations): wraps, then ellipsis, never runs off the canvas
  function iconLine(c, icon, text, w, size, color, iconColor) {
    const fw = D.fitWrap(c, text, (z) => D.bt(z, 700), w - 50, size, Math.max(26, size - 8), 2), lh = Math.round(fw.size * 1.3);
    return { h: (fw.lines.length - 1) * lh + Math.max(bm(fw.size).h, 34), draw: (x, y) => { D.icon(c, icon, x + 17, y + 17, 34, iconColor, 2); fw.lines.forEach((l, i) => D.T(c, l, x + 50, y + 17 + fw.size * 0.34 + i * lh, { font: D.bt(fw.size, 700), color })); } };
  }
  // Hero visual for text-led posts: the owner's own photo when one is added (Photo tab), else brand line art.
  function heroArt(c, S, x, y, ww, h) {
    const P = S.photos.hero;       // the owner's own hero photo (Photo tab). The loaded car's photo is never used here.
    c.save(); D.rr(c, x, y, ww, h, 22); c.clip();
    if (P && P.img) D.photo(c, S, 'main', P, { x, y, w: ww, h }, { forceMode: 'fill' });
    else {
      c.fillStyle = D.lin(c, x, y, x + ww, y + h, [[0, '#1B2F6E'], [1, '#0E1D40']]); c.fillRect(x, y, ww, h);      // no photo: a plain navy block with the logo (never a drawn car)
      c.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 3; i++) { D.para(c, x + ww * (0.52 + i * 0.1), y - 4, ww * (0.07 - i * 0.015), h + 8, h * 0.4); c.fill(); }
      const chq = Math.max(12, h * 0.07), lh = Math.round(Math.min(h * 0.5, 130)); D.logoPlate(c, x + (ww - D.logoW(lh)) / 2, y + (h - chq - lh) / 2, lh); D.chequer(c, x, y + h - chq, ww, chq, Math.max(6, h * 0.035), B.red, B.off);
    }
    c.restore();
    D.strokeRR(c, x, y, ww, h, 22, 'rgba(247,245,240,.18)', 2);
  }
  // a block for the stack (portrait and tall only: square has no spare height). Wide uses heroSide instead.
  function heroBand(c, S, k, L) {
    if (L.mode === 'square' || L.mode === 'wide') return null;
    const h = Math.round((L.mode === 'tall' ? 330 : 190) * k);
    return { h, draw: (x, y, ww) => heroArt(c, S, x, y, ww, h) };
  }
  // Trust and Sell use the Signature chassis; their optional photo is the owner's own hero photo, which the chassis draws as its photo band
  function withHero(S, fn) { const keep = S.photos.main, ka = S.x.accent; S.photos.main = S.photos.hero; S.x.accent = 'navy'; try { fn(); } finally { S.photos.main = keep; S.x.accent = ka; } }       // a text post is always in the house navy, whatever car is loaded
  const heroSide = (S) => (cc, r) => heroArt(cc, S, r.x + 10, r.y + Math.round(r.h * 0.2), r.w - 80, Math.round(r.h * 0.6));


  // Festival greeting + car, in the Signature design with the festival in it: a festive band under the header (the festival's colours, its motif, toran pennants), the greeting and the
  // tie line on the band, the whole car running to the edges below it, the car's name and price, and a price box and contact bar tinted to the festival's accent.
  function festCar(c, L, S, f, eb, name, wish, date) {
    const p = PS.classicParts, g = p.geo(L.W, L.H), fid = S.x.festival || 'diwali', fx = PS.festColours(fid), A = fx.A, v = p.view(S), wide = g.mode === 'wide', tall = g.mode === 'tall', sq = g.mode === 'square', k = g.k;
    const typedWish = (S.x.festWish || '').trim(), tw = wide ? 790 : g.W - 2 * g.m, x0 = g.m, tie = pick(f.tie), hi = PS.isHi();
    // 1) measure the words
    const T = [], ebs = Math.round((sq ? 26 : 32) * Math.min(k, 1.2) * (hi ? 1.25 : 1));
    if (eb) T.push({ h: bm(ebs).h + 8, draw: (x, y) => D.T(c, D.up(eb), x, y + bm(ebs).b, { font: D.bt(ebs, 800), color: fx.eb, track: hi ? 0 : ebs * 0.22 }) });
    const nm = D.up(name), ns = Math.round((wide ? 140 : tall ? 150 : sq ? 96 : 140) * Math.min(1.1, k)), from = wide ? 0.74 : 0.62, nw = Math.round((wide ? 880 : g.W) * from) - g.m - 16; let nf = D.fitWrap(c, nm, (z) => p.hf(nm, z, 800), nw, ns, 70, 1, -1); if (nf.cut) nf = D.fitWrap(c, nm, (z) => p.hf(nm, z, 800), nw, Math.round(ns * 0.8), 56, 2, -1);      // the name keeps to the left 60 percent: the festival's motif has the right side
    T.push({ h: nf.size * 0.8 + (nf.lines.length - 1) * nf.size * 0.96 + 14, draw: (x, y) => nf.lines.forEach((l, i) => D.T(c, l, x - 2, y + nf.size * 0.8 + i * nf.size * 0.96, { font: p.hf(l, nf.size, 800), color: '#FFFFFF', track: -1 })) });
    const ts = Math.round((sq ? 30 : 38) * Math.min(k, 1.15)), tf = D.fitWrap(c, tie, (z) => D.bt(z, 800), nw, ts, 22, 2, 0);
    T.push({ h: tf.lines.length * tf.size * 1.3 + 6, draw: (x, y) => tf.lines.forEach((l, i) => D.T(c, l, x, y + tf.size * 0.85 + i * tf.size * 1.3, { font: D.bt(tf.size, 800), color: fx.tie })) });
    const headH = T.reduce((a, t) => a + t.h, 0);
    if (typedWish) { const ws = Math.round(28 * Math.min(k, 1.15) * (hi ? 1.15 : 1)), wf = D.fitWrap(c, typedWish, (z) => D.bt(z, 600), tw, ws, 22, 3, 0); if (wf.cut) PS.note(S, 'The wish line is too long for this layout and was shortened. Keep it under about 120 characters.'); T.push({ h: wf.lines.length * wf.size * 1.35 + 6, draw: (x, y) => wf.lines.forEach((l, i) => D.T(c, l, x, y + wf.size * 0.9 + i * wf.size * 1.35, { font: D.bt(wf.size, 600), color: '#E6EAF5' })) }); }
    if (date) { const ds = Math.round(28 * Math.min(k, 1.15) * (hi ? 1.15 : 1)), df = D.fitWrap(c, date, (z) => D.bt(z, 700), tw - 48, ds, 22, 2, 0); if (df.cut) PS.note(S, 'The date line is too long and was shortened.'); T.push({ h: df.lines.length * df.size * 1.3 + 6, draw: (x, y) => { D.icon(c, 'calendar', x + 16, y + 20, 32, fx.tie, 2); df.lines.forEach((l, i) => D.T(c, l, x + 46, y + df.size * 0.95 + i * df.size * 1.3, { font: D.bt(df.size, 700), color: '#E6EAF5' })); } }); }
    const th = T.reduce((a, t) => a + t.h, 0), padT = sq ? 16 : 24, padB = 22;
    const ih = Math.round(wide ? 128 : tall ? 132 : sq ? 112 : 124), iy = g.foot.y - 22 - ih, pw = wide ? 460 : tall ? 372 : sq ? 340 : 380;
    const band = wide ? { x: 0, y: g.hdr.h, w: 880, h: iy - 18 - 54 - g.hdr.h } : { x: 0, y: tall ? g.col.y - 22 : g.hdr.h, w: g.W, h: padT + th + padB };
    // 2) the ground, then the car (so the band and its pennants sit on top of the photo's soft top edge)
    p.background(c, g);
    const drop = 44, top = wide ? 0 : band.y + band.h + drop, carBottom = iy - 14, availH = Math.max(120, carBottom - top);
    const fd = p.frameFor(S.photos.main, wide ? g.W - g.m - 900 : g.W - 2 * g.m, Math.max(120, wide ? g.fr.h : availH));
    const area = wide ? { x: 900, y: g.fr.y, w: g.W - g.m - 900, h: g.fr.h } : null;
    if (wide) p.slot(c, S, { x: area.x + area.w - fd.w, y: area.y + Math.max(0, area.h - fd.h) * 0.4, w: fd.w, h: fd.h }, g);
    else { const fr = { x: (g.W - fd.w) / 2, y: top + Math.max(0, availH - fd.h) * 0.4, w: fd.w, h: fd.h }; p.bleedSlot(c, S, g, { x: 0, y: top - 30, w: g.W, h: availH + 30 + 10 }, fr); }
    PS.festBand(c, band, f, fid, from, padT + headH);
    let y = band.y + padT; T.forEach((t) => { t.draw(x0, y); y += t.h; });
    // 3) header, the car's name and price, the contact bar
    p.header(c, S, g, { luxury: PS.isLuxury(S.car, S.x.luxury) }, A, { x: g.W - g.m });
    p.priceBox(c, S, Object.assign({}, g, { price: { w: pw, h: ih } }), v, A, g.W - g.m - pw, iy, { noStamp: true, tint: fx.tint });
    const nmw = g.W - 2 * g.m - pw - 28, line = [S.car.year, S.car.make, S.car.model].filter(Boolean).join(' '), ls = D.fit(c, p.up(line), (z) => p.hf(line, z, 800), nmw, Math.round(46 * Math.min(k, 1.2)), 22, -0.3);
    if (line) D.T(c, p.up(line), x0, iy + ih * 0.42, { font: p.hf(line, ls, 800), color: p.INK, track: -0.3 });
    if (S.car.variant) { const vs = D.fit(c, p.up(S.car.variant), (z) => D.bt(z, 700), nmw, Math.round(28 * Math.min(k, 1.2)), 16); D.T(c, p.up(S.car.variant), x0, iy + ih * 0.42 + vs * 1.5 + 6, { font: D.bt(vs, 700), color: p.GREY }); }
    p.footerBar(c, S, g, A, { tint: fx.tint }); p.menuStrip(c, g);
    if (tall) p.bottomSlab(c, S, g, A);
  }

  /* ---------- Festival greeting ---------- */
  PS.addTemplate({
    id: 'festival', name: 'Festival Greeting', group: 'Greetings', family: 'navy', fest: true, sizes: FEED, def: '1080x1350', file: 'festival',
    car: false, photoSlot: true, photoLabel: 'Car photo (only used by the Greeting + car layout)', badges: [], x: ['festival', 'festLayout', 'festDate', 'festWish', 'festYear'], cta: null, noCta: true,
    render(c, L, S) {
      const f = Object.assign({}, PS.FESTIVALS[S.x.festival || 'diwali'] || PS.FESTIVALS.diwali, { year: S.x.festYear || '2027' }), light = !!f.light;
      const ink = light ? B.ink : '#fff', mute = light ? B.inkMute : B.mute, accT = light ? B.blue : f.acc;
      const motif = PS.FEST_MOTIFS[f.motif];
      const name = pick(f.n), eb = f.eb ? pick(f.eb) : tx('happy'), wish = (S.x.festWish || '').trim() || pick(f.w), date = (S.x.festDate != null ? S.x.festDate : f.d || '').trim();
      // Greeting + car: the Signature design (light showroom, the logo lockup, the car as the hero) with the greeting on top and one line that ties the day to a car purchase
      if (S.x.festLayout === 'car' && f.tie) return festCar(c, L, S, f, eb, name, wish, date);
      compose(c, L, S, {
        style: 'none', anchor: 'bottom', kBase: L.mode === 'square' ? 0.78 : 1,
        bgPaint: (cc, LL) => { cc.fillStyle = D.lin(cc, 0, 0, LL.W * 0.4, LL.H, [[0, f.bg[0]], [1, f.bg[1]]]); cc.fillRect(0, 0, LL.W, LL.H); cc.fillStyle = B.red; cc.fillRect(0, 0, LL.W * 0.34, 10); cc.fillStyle = B.blue; cc.fillRect(LL.W * 0.34, 0, LL.W * 0.66, 10); },      // the brand red | blue rule along the top edge
        pre: (cc, LL, rect) => {
          const H2 = Math.max(10, Math.round(rect.h + 20)), off = document.createElement('canvas'); off.width = LL.W; off.height = H2; const oc = off.getContext('2d');
          const my = LL.mode === 'tall' ? LL.top : 0;      // tall: the footer card is at the top, keep coins and lights clear of it
          motif(oc, { x: 0, y: my, w: LL.W, h: Math.max(60, rect.h - my) }, f);
          oc.globalCompositeOperation = 'destination-in'; oc.fillStyle = D.lin(oc, 0, 0, 0, H2, [[0, '#000'], [0.82, '#000'], [1, 'rgba(0,0,0,0)']]); oc.fillRect(0, 0, LL.W, H2); cc.drawImage(off, 0, 0);
        },
        side: (cc, rect) => { cc.save(); cc.beginPath(); cc.rect(rect.x, rect.y, rect.w, rect.h); cc.clip(); motif(cc, rect, f); cc.restore(); },
        blocks: (w, k) => {
          const bl = [];
          if (eb) { const s = Math.round(54 * k * (PS.isHi() ? 1.3 : 1)), m = dm(s); bl.push({ h: m.h, draw: (x, y) => D.T(c, D.up(eb), x, y + m.b, { font: D.dt(s), color: accT, track: PS.isHi() ? 0 : 8 }) }); }
          const nm = D.up(name), s = D.fit(c, nm, D.dt, w, Math.round(190 * k), 70), m = dm(s);
          let lines = D.wrap(c, nm, D.dt(s), w); if (lines.length > 2) lines = lines.slice(0, 2);
          bl.push({ h: lines.length * m.h + (lines.length - 1) * 10, draw: (x, y) => lines.forEach((l, i) => D.T(c, l, x, y + m.b + i * (m.h + 10), { font: D.dt(s), color: ink })) });
          { const wz = Math.max(34, 40 * k) * (PS.isHi() ? 1.15 : 1); bl.push(K.text(c, wish, w, { font: D.bt(wz, 600), size: wz, color: light ? '#27345E' : '#E6EAF5', max: 3, lh: Math.round(wz * 1.45) })); }
          if (date) bl.push(iconLine(c, 'calendar', date, w, Math.max(32, Math.round(36 * k)), mute, mute));
          bl.push(K.text(c, tx('fromFamily'), w, { font: D.bt(30, 700), size: 30, color: mute, max: 1 }));
          return bl;
        }
      });
    }
  });

  /* ---------- Testimonial ---------- */
  PS.addTemplate({
    id: 'testimonial', name: 'Testimonial', group: 'Trust', family: 'cream', sizes: FEED, def: '1080x1350', file: 'testimonial',
    car: false, photoSlot: true, photoKey: 'second', photoLabel: 'Photo for this testimonial (optional). Use one only if the customer agreed.', badges: [], x: ['tQuote', 'tName', 'tCar', 'tStars', 'consentTesti'], consent: 'consentTesti', noCta: true,
    render(c, L, S) {
      // customer words are never invented: blank fields fall back to demo text, which stamps the render SAMPLE and blocks export
      const q = PS.val(S, 'tQuote'), P = S.photos.second,         // opt-in: the testimonial shows a photo only when one is added for it, never the stock car by default
         n = Math.max(1, Math.min(5, +S.x.tStars || 5)), nm = PS.val(S, 'tName'), car = PS.val(S, 'tCar');
      const side = (cc, r) => { if (!P) return; const pw = r.w - 100, ph = Math.min(r.h - 200, pw * 1.1); cc.save(); cc.translate(r.x + 20, r.y + (r.h - ph) / 2); D.shadowBox(cc, () => D.fillRR(cc, 0, 0, pw, ph, 28, B.cream)); cc.save(); D.rr(cc, 0, 0, pw, ph, 28); cc.clip(); D.photo(cc, S, 'main', P, { x: 0, y: 0, w: pw, h: ph }, { forceMode: 'fit' }); cc.restore(); cc.restore(); };
      compose(c, L, S, {
        style: 'none', bg: 'cream', anchor: 'spread', kBase: L.mode === 'square' ? 0.8 : 1, side,
        blocks: (w, k) => {
          const bl = [], ss = Math.round(54 * k);
          bl.push({ h: ss, draw: (x, y) => D.stars(c, x, y, ss, n, B.red, 10) });
          const qs = Math.max(44, Math.round(54 * k)), qf = D.bt(qs, 700), lh = Math.round(qs * 1.34);
          const mk = Math.round(190 * k);
          bl.push({ h: Math.round(mk * 0.34), draw: (x, y) => D.T(c, '“', x - 4, y + mk * 0.62, { font: D.dl(mk), color: B.red }) });
          bl.push(K.text(c, q || '…', w, { font: qf, size: qs, color: B.ink, lh, max: L.mode === 'square' ? 5 : 8 }));
          const ns = D.fit(c, D.up(nm), D.hasDeva(nm) ? (z) => D.hd(Math.round(z * 0.8), 800) : D.dl, w, Math.round(72 * k), 44), nmm = dm(ns);
          const cl = car ? D.fitWrap(c, `${tx('testiBy')} ${car}`, (z) => D.bt(z, 600), w, 36, 28, 2) : null, clh = cl ? Math.round(cl.size * 1.3) : 0;
          bl.push({ h: nmm.h + (cl ? 16 + (cl.lines.length - 1) * clh + bm(cl.size).h : 0), draw: (x, y) => {
            D.T(c, D.up(nm), x, y + nmm.b, { font: D.hasDeva(nm) ? D.hd(Math.round(ns * 0.8), 800) : D.dl(ns), color: B.blue, track: 1 });
            if (cl) cl.lines.forEach((l, i) => D.T(c, l, x, y + nmm.h + 16 + bm(cl.size).b + i * clh, { font: D.bt(cl.size, 600), color: B.inkMute }));
          } });
          if (L.mode !== 'wide' && P) { const ph = Math.round((L.mode === 'square' ? 250 : L.mode === 'tall' ? 430 : 350) * Math.max(0.75, k)); bl.push({ h: ph, draw: (x, y, ww) => { c.save(); D.rr(c, x, y, ww, ph, 22); c.clip(); D.photo(c, S, 'main', P, { x, y, w: ww, h: ph }, { forceMode: 'fit', shadowFit: false }); c.restore(); } }); }       // tall enough to frame the whole car
          bl.push(K.text(c, tx('testiNote'), w, { font: D.bt(26, 600), size: 26, color: B.inkMute, max: 1 }));
          return bl;
        }
      });
    }
  });

  /* ---------- Trust / Since 1974 ---------- */
  function rowText(S, key, defT, defS) { const v = (S.x[key] || '').trim(); if (!v) return [tx(defT), tx(defS)]; const p = v.split('|'); return [p[0].trim(), (p[1] || '').trim()]; }
  PS.addTemplate({
    id: 'trust', name: 'Trust: Since 1974', group: 'Trust', family: 'cream', sizes: FEED, def: '1080x1350', file: 'trust-since1974',
    car: false, heroPhoto: true, photoLabel: 'Optional photo: a real Classic Auto car, the showroom or your team. Without one the post shows a plain navy block with the logo.', badges: [], x: ['trustHead', 'tr1', 'tr2', 'tr3', 'tr4'], noCta: true,
    note: 'Every row on this post is a claim made in public. Edit each row so it is true for Classic Auto today. The "Every car inspected" row only appears if you switch it on in Settings.',
    render(c, L, S) {
      const insp = !!PS.settings.claimInspected;
      const head = (S.x.trustHead || '').trim() || tx('trustHead'), rows = [['calendar', ...rowText(S, 'tr1', 'trust1', 'trust1s')], [insp ? 'shield' : 'tag', ...rowText(S, 'tr2', insp ? 'trust2i' : 'trust2', insp ? 'trust2is' : 'trust2s')], ['rupee', ...rowText(S, 'tr3', 'trust3', 'trust3s')], ['swap', ...rowText(S, 'tr4', 'trust4', 'trust4s')]];
      withHero(S, () => compose(c, L, S, {
        style: 'sig', cta: false, plainBlock: true, icon: 'calendar', card: [D.up(tx('since')), 'MALAD WEST'], anchor: 'top', kBase: 1, kBaseSq: 0.8,
        blocks: (w, k) => {
          const bl = [], hs = Math.round(124 * k), hm = dm(hs);
          // headline with "1974" in red as the focal word
          const hh = head.replace(/\.\s+/g, '.\n'), lines = PS.isHi() ? D.wrap(c, hh, D.dt(hs), w) : D.wrap(c, D.up(hh), D.dl(hs), w), lh = hm.h + 10;
          bl.push({ h: lines.length * lh - 10, draw: (x, y) => lines.forEach((l, i) => { const parts = l.split(/(1974|१९७४)/); let px = x; parts.forEach((p) => { if (!p) return; px += D.T(c, p, px, y + hm.b + i * lh, { font: D.dt(hs), color: /1974|१९७४/.test(p) ? B.red : B.ink }); }); }) });
          const rs = Math.round(86 * k), ts = Math.max(36, Math.round(42 * k)), ss = Math.max(30, Math.round(32 * k)), rh0 = Math.round(rs + 22 * k);
          rows.forEach((r) => {
            const nl = r[2] ? Math.min(2, D.lines(c, r[2], D.bt(ss, 600), w - rs - 26)) : 1, rh = (nl > 1 ? Math.max(rh0, Math.ceil(rs * 0.42 + 2 * ss + 30)) : rh0) + (PS.isHi() ? Math.round(ss * 0.45) : 0);      // Devanagari lines are taller: a little more room under each row
            bl.push({ h: rh, draw: (x, y, ww) => {
              c.fillStyle = B.deep; c.beginPath(); c.arc(x + rs / 2, y + rs / 2, rs / 2, 0, 7); c.fill(); D.icon(c, r[0], x + rs / 2, y + rs / 2, rs * 0.5, B.off, 2.4);
              const tx0 = x + rs + 26, tw = ww - rs - 26;
              D.T(c, D.ellip(c, r[1], D.bt(ts, 800), tw), tx0, y + (r[2] ? rs * 0.42 : rs * 0.6), { font: D.bt(ts, 800), color: B.ink });
              if (r[2]) D.P(c, r[2], tx0, y + rs * 0.42 + ss + 10, { font: D.bt(ss, 600), color: B.inkMute, w: tw, lh: ss + 6, max: 2 });
            } });
          });
          bl.push(K.text(c, tx('trustFoot'), w, { font: D.bt(36, 800), size: 36, color: B.blue, max: 1 }));
          return bl;
        }
      }));
    }
  });

  /* ---------- Sell your car ---------- */
  PS.addTemplate({
    id: 'sell', name: 'We Buy Cars / Park-n-Sell', group: 'Trust', family: 'navy', sizes: FEED, def: '1080x1350', file: 'sellyourcar', sub: 'sellKind',
    car: false, heroPhoto: true, photoLabel: 'Optional photo: a real car, the showroom or the keys on the desk. Without one the post shows a plain navy block with the logo.', badges: [], x: ['sellKind'], cta: 'sellCta',
    render(c, L, S) {
      const park = S.x.sellKind === 'park', hd = tx(park ? 'parkHead' : 'buyHead'), sub = tx(park ? 'parkSub' : 'buySub');
      const steps = park ? [['park1', 'park1s'], ['park2', 'park2s'], ['park3', 'park3s']] : [['buy1', 'buy1s'], ['buy2', 'buy2s'], ['buy3', 'buy3s']];
      // the pill carries the call to action, so the footer shows the number / DM handle instead of repeating it
      withHero(S, () => compose(c, L, S, {
        style: 'sig', cta: false, plainBlock: true, icon: 'swapBold', card: [D.up(tx('sellW')), 'CLASSIC AUTO'], anchor: 'top', kBase: 1, kBaseSq: 0.78,
        blocks: (w, k) => {
          const A = PS.classicParts.accentOf(S), bl = [];
          bl.push(K.headline(c, hd, w, Math.round(150 * k), 76, 2, { color: B.ink }));
          bl.push(K.text(c, sub, w, { font: D.bt(Math.max(34, 38 * k), 600), size: Math.max(34, 38 * k), color: '#27345E', max: 3, lh: Math.round(Math.max(34, 38 * k) * 1.45) }));
          const bs = Math.round(76 * k), rh = Math.round(bs + 26 * k), ts = Math.max(38, Math.round(44 * k)), ss = Math.max(30, Math.round(32 * k));
          steps.forEach((st, i) => bl.push({ h: rh, draw: (x, y, ww) => {
            c.save(); D.para(c, x, y, bs, bs, bs * 0.2); c.fillStyle = A.a; c.fill(); c.restore();
            D.T(c, String(i + 1), x + bs / 2 + bs * 0.1, y + bs * 0.74, { font: D.dl(Math.round(bs * 0.9)), color: '#fff', align: 'center' });
            const tx0 = x + bs + 36;
            D.T(c, D.up(tx(st[0])), tx0, y + bs * 0.46, { font: D.dt(Math.round(52 * k)), color: B.ink, track: PS.isHi() ? 0 : 1.5 });
            D.P(c, tx(st[1]), tx0, y + bs * 0.46 + ss + 8, { font: D.bt(ss, 600), color: B.inkMute, w: ww - bs - 36, lh: ss + 6, max: 1 });
          } }));
          const hh = Math.round(86 * Math.max(0.9, k)), label = ctaOf(S, 'sellCta'), fw = D.fitWrap(c, label, (z) => D.bt(z, 800), w - hh * 1.5, Math.round(hh * 0.4), 26, 2), two = fw.lines.length > 1, ph = two ? Math.round(hh * 1.5) : hh;
          bl.push({ h: ph, draw: (x, y, ww) => {
            const f = D.bt(fw.size, 800), lh = Math.round(fw.size * 1.25), pw = Math.min(ww, Math.max(...fw.lines.map((l) => D.tw(c, l, f))) + hh * 1.5);
            D.fillRR(c, x, y, pw, ph, two ? ph * 0.34 : ph / 2, A.a); D.icon(c, 'chat', x + hh * 0.6, y + ph / 2, hh * 0.42, '#fff', 2.4);
            fw.lines.forEach((l, i) => D.T(c, l, x + hh * 1.0, y + ph / 2 + fw.size * 0.34 - (fw.lines.length - 1) * lh / 2 + i * lh, { font: f, color: '#fff' }));
          } });
          return bl;
        }
      }));
    }
  });

  /* ---------- Finance / EMI explainer ---------- */
  PS.addTemplate({
    id: 'finance', name: 'Finance / EMI Explainer', group: 'Trust', family: 'navy', sizes: FEED, def: '1080x1350', file: 'emi-explainer',
    car: true, carLite: true, badges: [], x: ['finDp', 'finTenure', 'finRate'], noCta: true,
    render(c, L, S) {
      const v = carView(S.car), dp = Math.max(0, Math.min(90, +S.x.finDp || 20)), ten = Math.max(6, +S.x.finTenure || 60), rate = Math.max(1, +S.x.finRate || 11.5);
      if (!(v.priceN > 0)) {      // no price, no worked example: never pair a made-up price with a real car name
        compose(c, L, S, { style: 'none', bg: 'deep', anchor: 'center', noFooter: false, blocks: (w, k) => { const hs = Math.round(124 * k), hm = dm(hs); return [K.eyebrow(c, D.up(tx('finSub')), k * 0.92), { h: hm.h, draw: (x, y) => D.T(c, D.up(tx('finHead')), x, y + hm.b, { font: D.dt(hs), color: '#fff' }) }, K.text(c, tx('finNoPrice'), w, { font: D.bt(Math.max(36, 42 * k), 800), size: Math.max(36, 42 * k), color: B.red, max: 2 })]; } });
        return;
      }
      const price = v.priceN, down = price * dp / 100, loan = price - down, emi = PS.emiRound(PS.emiOf(price, dp / 100, rate / 100, ten)), interest = emi * ten - loan;
      const rows = [[tx('finPrice'), PS.priceFull(price)], [`${tx('finDown')} (${dp}%)`, PS.priceFull(down)], [tx('finLoan'), PS.priceFull(loan)], [tx('finTenure'), `${ten} ${tx('finMonths')}`], [tx('finRate'), `${rate}% ${tx('finPa')}`]];
      const mkCard = (w, k) => {
        const pad = 36, fs = Math.round(150 * Math.min(1, k)), dl = D.wrap(c, tx('finDisc') + ' ' + tx('finTnc'), D.bt(28, 700), w - 2 * pad).slice(0, 4), emiTxt = '₹' + PS.inr(emi);
        const h = pad + 34 + 22 + fs * 0.72 + 30 + 34 + 24 + dl.length * 36 + pad;
        return { h, draw: (x, y) => {
          D.shadowBox(c, () => D.fillRR(c, x, y, w, h, 28, B.off));
          let yy = y + pad + 34; D.T(c, D.up(tx('finEmi')), x + pad, yy, { font: D.dt(44), color: B.inkMute, track: PS.isHi() ? 0 : 3 });
          yy += 22 + fs * 0.72; D.runs(c, [{ t: emiTxt, font: D.dl(fs), color: B.red, gap: 12 }, { t: tx('perMo').replace('*', '') + '*', font: D.bt(Math.round(fs * 0.2), 800), color: B.ink }], x + pad, yy);
          yy += 54; D.T(c, `${tx('finInterest')}: ₹${PS.inr(interest)}`, x + pad, yy, { font: D.bt(32, 700), color: B.inkMute });
          yy += 24 + 28; dl.forEach((l, i) => D.T(c, l, x + pad, yy + i * 36, { font: D.bt(28, 700), color: B.ink }));
        } };
      };
      compose(c, L, S, {
        style: 'none', bg: 'deep', anchor: 'spread', kBase: L.mode === 'square' ? 0.74 : 1,
        side: (cc, r) => { const cd = mkCard(r.w - 80, 1); cd.draw(r.x + 20, r.y + (r.h - cd.h) / 2); },
        blocks: (w, k) => {
          const bl = [], hs = Math.round(124 * k), hm = dm(hs);
          bl.push(K.eyebrow(c, D.up(tx('finSub')), k * 0.92));
          bl.push({ h: hm.h, draw: (x, y) => D.T(c, D.up(tx('finHead')), x, y + hm.b, { font: D.dt(hs), color: '#fff' }) });
          if (v.name) bl.push(K.text(c, v.name + (v.variant ? ' · ' + v.variant : ''), w, { font: D.bl(Math.max(32, 36 * k), 700), size: Math.max(32, 36 * k), color: B.mute, max: 1 }));
          const rs = Math.max(34, Math.round(38 * k)), rh = Math.round(rs * 1.75);
          bl.push({ h: rows.length * rh, draw: (x, y, ww) => rows.forEach((r, i) => { const yy = y + i * rh; c.fillStyle = 'rgba(247,245,240,.16)'; c.fillRect(x, yy, ww, 2); D.T(c, r[0], x, yy + rh * 0.66, { font: D.bt(rs, 600), color: B.mute }); D.T(c, r[1], x + ww, yy + rh * 0.66, { font: D.bl(rs, 800), color: '#fff', align: 'right' }); }) });
          if (L.mode !== 'wide') { const cd = mkCard(w, k); bl.push({ h: cd.h, draw: (x, y) => cd.draw(x, y) }); }
          return bl;
        }
      });
    }
  });

  /* ---------- Hiring ---------- */
  PS.addTemplate({
    id: 'hiring', name: 'Hiring', group: 'Trust', family: 'navy', sizes: FEED, def: '1080x1350', file: 'hiring', sub: 'hireRole',
    car: false, heroPhoto: true, photoLabel: 'Optional photo: your team or showroom. Use a real photo.', badges: [], x: ['hireRole', 'hireBullets', 'hireLoc', 'hireApply'], noCta: true,
    render(c, L, S) {
      const role = (S.x.hireRole || '').trim(), bullets = (S.x.hireBullets || '').split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 3), loc = (S.x.hireLoc || '').trim(), ap = (S.x.hireApply || '').trim() || tx('hiringMsg');
      compose(c, L, S, {
        style: 'none', bg: 'deep', anchor: 'spread', kBase: L.mode === 'square' ? 0.76 : 1,
        side: heroSide(S),
        blocks: (w, k) => {
          const bl = [], band = heroBand(c, S, k * 0.8, L); if (band) bl.push(band);
          // "WE'RE HIRING": fits the column, wraps to two lines when it has to, last word in red
          bl.push(K.headline(c, tx('hiringHead'), w, Math.round(160 * k), 84, 2));
          if (role) { const fw = D.fitWrap(c, D.up(role), D.dl, w, Math.round(112 * k), 56, 2), rm = dm(fw.size), gap = Math.round(fw.size * 0.08); bl.push({ h: fw.lines.length * rm.h + (fw.lines.length - 1) * gap, draw: (x, y) => fw.lines.forEach((l, i) => D.T(c, l, x, y + rm.b + i * (rm.h + gap), { font: D.dl(fw.size), color: B.off })) }); }
          bullets.forEach((b) => { const s = Math.max(34, Math.round(38 * k)); const t = K.text(c, b, w - 70, { font: D.bt(s, 600), size: s, color: '#E6EAF5', max: 2 }); bl.push({ h: t.h, draw: (x, y, ww) => { D.icon(c, 'check', x + 20, y + s * 0.5, 36, B.red, 4); t.draw(x + 62, y); } }); });
          if (loc) bl.push(iconLine(c, 'pin', loc, w, Math.max(32, Math.round(36 * k)), B.off, B.mute));
          const as = Math.max(32, Math.round(36 * k)), at = K.text(c, ap, w - 140, { font: D.bt(as, 800), size: as, color: B.ink, max: 2 }), ah = Math.max(at.h + 76, 130);
          bl.push({ h: ah, draw: (x, y, ww) => { D.fillRR(c, x, y, ww, ah, 24, B.off); D.icon(c, 'chat', x + 56, y + ah / 2, 52, B.ink, 2.8); D.T(c, D.up(tx('hiringApply')), x + 110, y + 40, { font: D.bt(26, 800), color: B.inkMute, track: PS.isHi() ? 0 : 2 }); at.draw(x + 110, y + 50 - 0, ww - 140); const ct = PS.contact(), wn = ct.hasPhone ? ct.phone : ct.wa; if (wn) D.T(c, wn, x + ww - 30, y + 40, { font: D.bl(30, 800), color: B.blue, align: 'right' }); } });
          return bl;
        }
      });
    }
  });

  /* ---------- Banner family: website hero, YouTube, covers ---------- */
  function slantPhoto(c, S, P, x0, W, H, sk, ph) {
    c.save(); c.beginPath(); c.moveTo(x0 + sk, 0); c.lineTo(W, 0); c.lineTo(W, ph); c.lineTo(x0, ph); c.closePath(); c.clip();
    D.photo(c, S, 'main', P, { x: x0, y: 0, w: W - x0, h: ph }, {}); c.restore();
    c.fillStyle = B.red; D.para(c, x0 - 14 * (W / 1920 + 0.3), 0, 8, ph, sk); c.fill();
  }
  const h4min = (s) => Math.round(56 * s);
  PS.addTemplate({
    id: 'hero', name: 'Website Hero Banner', group: 'Banners', family: 'navy', sizes: ['1920x1080', '2400x1000'], def: '1920x1080', file: 'website-hero',
    car: true, carLite: true, badges: [], x: ['heroHead', 'heroSub'], noCta: true,
    render(c, L, S) {
      const { W, H } = L, v = carView(S.car), s = H / 1080, m = Math.round(110 * s), fh = Math.round(72 * s), ph = H - fh;
      PS.paintBg(c, L, 'deep'); const x0 = Math.round(W * 0.5), sk = Math.round(H * 0.09);
      slantPhoto(c, S, S.photos.main, x0, W, H, sk, ph);
      c.fillStyle = D.lin(c, x0, 0, x0 + 260, 0, [[0, 'rgba(10,22,51,.55)'], [1, 'rgba(10,22,51,0)']]); c.save(); c.beginPath(); c.moveTo(x0 + sk, 0); c.lineTo(x0 + sk + 260, 0); c.lineTo(x0 + 260, ph); c.lineTo(x0, ph); c.fill(); c.restore();
      const colW = x0 - m - sk * 0.6; let y = Math.round(90 * s);
      const lp = Math.round(104 * s); D.logoPlate(c, m, y, lp); y += lp + Math.round(56 * s);
      const hd = (S.x.heroHead || '').trim() || tx('heroH1'), sub = (S.x.heroSub || '').trim() || tx('heroSub'), up = PS.isHi() ? hd : D.up(hd);
      // measure headline + sub line + button first, then shrink until everything sits above the footer bar
      const limit = ph - Math.round(44 * s), pill = Math.round(88 * s), subS = Math.round(40 * s), subLh = Math.round(58 * s), gapH = Math.round(14 * s), subTop = Math.round(56 * s), btnTop = Math.round(46 * s);
      const trial = (hs, subMax, maxL) => {
        const f = D.dt(hs), lines = D.wrap(c, up, f, colW); if (lines.length > (maxL || 3) || lines.some((l) => D.tw(c, l, f) > colW)) return null;
        const hm = dm(hs), nSub = Math.min(D.lines(c, sub, D.bt(subS, 600), colW), subMax), tot = lines.length * hm.h + (lines.length - 1) * gapH + subTop + (nSub - 1) * subLh + bm(subS).h + btnTop + pill;
        return y + tot <= limit ? { hs, lines, nSub } : null;
      };
      let pk = null; const hMax = Math.round(168 * s), hMin = Math.round(76 * s);
      for (const subMax of [4, 3, 2, 1]) { for (let hs = hMax; hs >= hMin && !pk; hs -= 4) pk = trial(hs, subMax); if (pk) break; }
      if (!pk) { const h4 = Math.round(56 * s); for (const subMax of [4, 3, 2, 1]) { for (let hs = hMin; hs >= h4 && !pk; hs -= 4) pk = trial(hs, subMax, 4); if (pk) break; } }
      if (!pk) { const fw = D.fitWrap(c, up, D.dt, colW, h4min(s), h4min(s), 4); pk = { hs: fw.size, lines: fw.lines, nSub: 1 }; }
      const hm = dm(pk.hs);
      pk.lines.forEach((l, i) => D.T(c, l, m, y + hm.b + i * (hm.h + gapH), { font: D.dt(pk.hs), color: i === pk.lines.length - 1 ? B.red : '#fff' }));
      y += pk.lines.length * hm.h + (pk.lines.length - 1) * gapH + subTop;
      const subEnd = D.P(c, sub, m, y + bm(subS).b, { font: D.bt(subS, 600), color: '#E6EAF5', w: colW, lh: subLh, max: pk.nSub });
      const by = y + (pk.nSub - 1) * subLh + bm(subS).h + btnTop;
      const f = D.bt(Math.round(38 * s), 800), t = tx('browse'), tw = D.tw(c, t, f);
      D.fillRR(c, m, by, tw + pill * 1.6, pill, pill / 2, B.off); D.T(c, t, m + pill * 0.55, by + pill / 2 + 13 * s, { font: f, color: B.ink }); D.icon(c, 'arrow', m + pill * 0.55 + tw + pill * 0.45, by + pill / 2, 36 * s, B.ink, 3);
      // slim footer
      c.fillStyle = B.deep; c.fillRect(0, ph, W, fh); D.chequer(c, 0, ph, W, Math.max(6, 8 * s), Math.max(3, 4 * s), B.red, B.off);
      D.T(c, D.up(tx('since')) + '   ·   ' + tx('loc'), m, ph + fh / 2 + 12 * s, { font: D.bt(Math.round(28 * s) < 26 ? 26 : Math.round(28 * s), 700), color: B.off, track: 2 });
      D.adjLabel(c, S, W - m, ph - Math.round(16 * s), 'right');
    }
  });

  PS.addTemplate({
    id: 'youtube', name: 'YouTube Thumbnail', group: 'Banners', family: 'photo', sizes: ['1280x720'], def: '1280x720', file: 'youtube-thumb', safe: 'yt',
    car: true, carLite: true, badges: [], x: ['ytText'], noCta: true,
    render(c, L, S) {
      const { W, H } = L, v = carView(S.car);
      PS.paintBg(c, L, 'deep');
      const photoR = { x: W * 0.3, y: 0, w: W * 0.7, h: H };
      D.photo(c, S, 'main', S.photos.main, photoR, { fit: { x: W * 0.36, y: 40, w: W * 0.64, h: H - 80 }, back: { x: 0, y: 0, w: W, h: H } });
      c.fillStyle = D.lin(c, 0, 0, W * 0.62, 0, [[0, 'rgba(10,22,51,.96)'], [0.55, 'rgba(10,22,51,.72)'], [1, 'rgba(10,22,51,0)']]); c.fillRect(0, 0, W, H);
      const words = (S.x.ytText || 'First look').trim().split(/\s+/).slice(0, 3), up = words.map((w) => D.up(w));
      // each word is set in the face of its own script and shrinks (down to 40 px) until the widest word fits the column: a long word never runs under the logo or off the edge
      const colW = W * 0.5, ff = (w) => (D.hasDeva(w) ? (z) => D.hd(Math.round(z * 0.82), 800) : D.dt), size = Math.min(150, ...up.map((w) => D.fit(c, w, ff(w), colW, 150, 40))), x = 90; let y = 70;
      const lh = dm(size).h + 12;
      up.forEach((w, i) => { D.T(c, w, x, y + dm(size).b + i * lh, { font: ff(w)(size), color: i === up.length - 1 ? B.red : '#fff', stroke: ['rgba(0,0,0,.35)', 8], shadow: ['rgba(0,0,0,.55)', 22, 5] }); });
      const by = H - 60 - 130;
      if (v.parts) { const ps = 100, pw = PS.priceW(c, v.parts, ps), bw = pw + 80, bh = 128; c.save(); D.para(c, x, by, bw, bh, 28); c.fillStyle = B.red; c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 24; c.shadowOffsetY = 8; c.fill(); c.restore(); PS.drawPrice(c, v.parts, x + 36, by + bh / 2 + dm(ps).h / 2, ps, '#fff', 'left'); }
      const ph = 66; D.logoPlate(c, W - 90 - D.logoW(ph) - 0, 50, ph);
      D.adjLabel(c, S, 90, H - 20, 'left');
    }
  });

  PS.addTemplate({
    id: 'cover', name: 'Profile Covers (Google / Facebook)', group: 'Banners', family: 'navy', sizes: ['1080x608', '820x360'], def: '1080x608', file: 'profile-cover', safe: 'cover',
    car: true, carLite: true, badges: [], x: [], noCta: true,
    render(c, L, S) {
      const { W, H } = L, s = H / 608, fb = W / H > 2;
      PS.paintBg(c, L, 'deep');
      const x0 = Math.round(W * 0.62), sk = Math.round(H * 0.12);
      slantPhoto(c, S, S.photos.main, x0, W, H, sk, H);
      // key content: centred block (Google: 560x200, Facebook: inside the centre 640)
      const bw = fb ? 520 : 560, bh = 200, bx = fb ? 100 : Math.round(W * 0.06), by = Math.round((H - bh) / 2);
      const ph = fb ? 96 : 118; D.logoPlate(c, bx, by, ph);
      const tx0 = bx + D.logoW(ph) + 26;
      D.T(c, D.up(tx('since')), tx0, by + 52, { font: D.dt(fb ? 66 : 82), color: '#fff' });
      D.P(c, fb ? PS.SITE.address_short : PS.SITE.address_lines.join(' '), tx0, by + (fb ? 92 : 108), { font: D.bt(fb ? 21 : 24, 600), color: '#E6EAF5', w: x0 - tx0 - 20, lh: fb ? 28 : 31, max: fb ? 4 : 6 });
      const chq = Math.max(10, 12 * s); D.chequer(c, 0, H - chq, W, chq, Math.max(5, 6 * s), B.red, B.off);
      D.adjLabel(c, S, W - 20, H - chq - 8, 'right');
    }
  });
})();
