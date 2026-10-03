/* Classic Auto Post Studio — V2 templates: Hero with ghost name (PS-3), Receipt "what's included" and Coming Soon halftone (PS-8),
   Caption burn-in preset (PS-14). Every contact line reads PS.contact() through D.footer, so none of these prints a phone unless one is set. */
(function () {
  'use strict';
  const PS = window.PS, D = PS.D, B = PS.B, tx = (k) => PS.tx(k), carView = PS.carView, FEED = PS.FEED;
  const MH = (s, w) => `${w || 800} ${s}px Manrope`;
  const up = (s) => (PS.isHi() || D.hasDeva(s) ? String(s) : String(s).toUpperCase());
  const accentOf = (S) => { const a = S.x.accent; return PS.ACCENTS[a && a !== 'auto' ? a : (S.car && S.car.accent) || 'navy'] || PS.ACCENTS.navy; };
  function slot(c, S, P, R, o) {
    S._slots = S._slots || []; S._labels = S._labels || [];
    if (!P || !P.img) { S._slots.push({ key: 'main', r: R }); if (!S.exporting) D.T(c, 'Drop a car photo', R.x + R.w / 2, R.y + R.h / 2, { font: D.bl(34, 700), color: 'rgba(255,255,255,.5)', align: 'center' }); return null; }
    if (P.src === 'stock') S._samplePhoto = true;
    const dr = D.photoPlaced(c, S, P, R, o); S._slots.push({ key: 'main', r: R, dr, mode: 'fill' }); return dr;
  }
  PS.ISSUE_MSG = { norole: 'Type the role first (Content tab). A hiring post needs to say who you are hiring.', nocar: 'Type the car’s make and model first. The Greeting + car layout shows the car by name.', noitems: 'Add what is included first, one item per line. The Receipt only lists real items.', nophoto: 'Add the car photo first (Photo tab). A car post is not exported without its own photo.' };
  const region = (L) => { const top = L.top + (L.mode === 'tall' ? 0 : 0), bottom = L.bottom - 54; return { top, bottom, hh: bottom - top }; };

  /* ---------- PS-3: Hero with a giant tone-on-tone name behind a cut-out car ---------- */
  PS.addTemplate({
    id: 'heroghost', name: 'Hero (ghost name)', group: 'More car layouts', family: 'photo', sizes: FEED, def: '1080x1350', file: 'heroghost', ver: 'v2',
    car: true, badges: [], x: ['accent'], noCta: true, needsCut: true,
    render(c, L, S) {
      const { W, H, mode } = L, v = carView(S.car), P = S.photos.main, A = accentOf(S), m = L.m, k = mode === 'wide' ? 1.2 : mode === 'square' ? 0.9 : 1;
      c.fillStyle = D.lin(c, 0, 0, 0, H, [[0, A.mid], [0.55, A.a], [1, A.b]]); c.fillRect(0, 0, W, H);
      const gl = c.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, W * 0.7); gl.addColorStop(0, 'rgba(255,255,255,.14)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gl; c.fillRect(0, 0, W, H);
      const { top, bottom, hh } = region(L), model = up(S.car.model || 'Model'), make = up(S.car.make || '');
      const cut = !!(P && P.alpha), ps0 = Math.round(92 * k), priceBottom = top + 26 * k + ps0 * 0.95 + 18;
      let R;
      if (cut) {
        // ghost name behind the cut-out car (tone on tone)
        const fs = D.fit(c, model, (z) => MH(z, 800), W - 2 * m, Math.round(hh * 0.34), 36, -3), baseY = top + hh * 0.44 + fs * 0.34, mp = PS.motion.progress(S);
        D.T(c, mp < 1 ? PS.motion.scramble(model, PS.motion.ease(mp / 0.55), 5) : model, W / 2, baseY, { font: MH(fs, 800), color: 'rgba(255,255,255,.11)', align: 'center', track: -3, stroke: ['rgba(255,255,255,.16)', 2] });
        if (make) { const ms = Math.round(fs * 0.3); D.T(c, make, W / 2, baseY - fs * 0.78, { font: MH(ms, 800), color: 'rgba(255,255,255,.12)', align: 'center', track: ms * 0.18 }); }
        R = { x: m * 0.3, y: top + hh * 0.15, w: W - m * 0.6, h: hh * 0.6 };
      } else {
        // no cut-out: an opaque photo would hide a ghost name, so the make and model sit as a solid wordmark band above the photo
        const line = [make, model].filter(Boolean).join(' ').toUpperCase(), fs = D.fit(c, line, (z) => MH(z, 800), W - 2 * m, Math.round(hh * 0.15), 34, -2), by = priceBottom + 22 + fs * 0.8;
        D.T(c, line, m, by, { font: MH(fs, 800), color: '#fff', track: -2 });
        const y0 = by + fs * 0.2 + 14; R = { x: m * 0.3, y: y0, w: W - m * 0.6, h: Math.max(240, bottom - 96 - y0) };
      }
      slot(c, S, P, R, { cut, noBackdrop: true, minFrac: 0.82, slackY: 0.62, feather: cut ? {} : { l: R.w * 0.06, r: R.w * 0.06, t: R.h * 0.1, b: R.h * 0.1 } });
      const mp = PS.motion.progress(S);
      // price top-left, logo top-right
      const ps = Math.round(92 * k), pr = PS.priceParts(v.priceN);
      D.T(c, up(tx('priceLbl')), m, top + 26 * k, { font: D.bt(Math.round(24 * k), 800), color: 'rgba(255,255,255,.7)', track: PS.isHi() ? 0 : 4 });
      if (pr) { const t = pr.sym + pr.num + (pr.unit ? ' ' + pr.unit : ''), s2 = D.fit(c, t, (z) => MH(z, 800), W * 0.58, ps, 40, -1), q = mp < 1 ? PS.priceParts(PS.motion.count(v.priceN, PS.motion.ease(mp / 0.7))) : pr, shown = q ? q.sym + q.num + (q.unit && mp >= 1 ? ' ' + q.unit : '') : '₹0'; D.T(c, shown, m, top + 26 * k + s2 * 0.95, { font: MH(s2, 800), color: '#fff', track: -1 }); }
      else D.T(c, up(tx('priceOnReq')), m, top + 26 * k + ps * 0.7, { font: D.bt(Math.round(ps * 0.4), 800), color: '#fff' });
      const lh = Math.round(86 * k); D.logoPlate(c, W - m - D.logoW(lh), top, lh);
      // three chips bottom-right, the variant bottom-left
      const chips = [S.car.reg_month ? up(S.car.reg_month) : v.year, v.km ? up(v.km) : '', [v.fuel, v.trans].filter(Boolean).map(up).join(' · ')].filter(Boolean), cs = Math.round(26 * k), ch = Math.round(cs * 2), gap = 14;
      const fw = chips.map((t) => D.tw(c, t, D.bt(cs, 800)) + cs * 1.6); let rows = [chips.map((t, i) => [t, fw[i]])]; const total = fw.reduce((a, b) => a + b, 0) + gap * (chips.length - 1), vMin = Math.round(W * 0.2);
      if (v.variant && W - 2 * m - total - 24 < vMin) rows = chips.map((t, i) => [[t, fw[i]]]);           // the chips stack when one row would leave the variant too little room (Hindi chips are wider)
      const rowW = Math.max(0, ...rows.map((row) => row.reduce((a, r) => a + r[1], 0) + gap * (row.length - 1)));
      rows.forEach((row, ri) => { let px = W - m - (row.reduce((a, r) => a + r[1], 0) + gap * (row.length - 1)); const y = bottom - ch * (rows.length - ri) - gap * (rows.length - 1 - ri);
        row.forEach(([t, w]) => { D.fillRR(c, px, y, w, ch, ch / 2, 'rgba(255,255,255,.12)'); D.strokeRR(c, px, y, w, ch, ch / 2, 'rgba(255,255,255,.4)', 2); D.T(c, t, px + w / 2, y + ch / 2 + cs * 0.34, { font: D.bt(cs, 800), color: '#fff', align: 'center' }); px += w + gap; }); });
      if (v.variant) { const vw = Math.max(vMin * 0.8, Math.min(W * 0.34, W - 2 * m - rowW - 24)), vs = D.fitWrap(c, up(v.variant), (z) => D.bt(z, 700), vw, Math.round(28 * k), 18, 3); vs.lines.forEach((l, i) => D.T(c, l, m, bottom - (vs.lines.length - 1 - i) * vs.size * 1.3 - 6, { font: D.bt(vs.size, 700), color: 'rgba(255,255,255,.82)' })); }
      D.footer(c, S, L.footer, L.footer.style, {}); D.adjLabel(c, S, L.label.x, L.label.y, L.label.a);
    }
  });

  /* ---------- PS-8: Receipt, "what's included". Real items only: it cannot be exported while empty. ---------- */
  PS.addTemplate({
    id: 'receipt', name: 'Receipt: what’s included', group: 'More car layouts', family: 'cream', sizes: FEED, def: '1080x1350', file: 'receipt', ver: 'v2',
    car: true, carLite: true, badges: [], x: ['recTitle', 'recItems'], noCta: true,
    issue: (S) => (String(S.x.recItems || '').split('\n').some((t) => t.trim()) ? '' : 'noitems'),
    render(c, L, S) {
      const { W, H, mode } = L, v = carView(S.car), m = L.m, k = mode === 'wide' ? 1.1 : mode === 'square' ? 0.82 : mode === 'tall' ? 1.1 : 1, items = String(S.x.recItems || '').split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 9);
      c.fillStyle = D.lin(c, 0, 0, 0, H, [[0, '#E9E4DA'], [1, '#F3EFE7']]); c.fillRect(0, 0, W, H);
      const { top, bottom } = region(L), px = Math.round(W * (mode === 'wide' ? 0.28 : 0.1)), pw = W - 2 * px, z = 16, availH = bottom - top - 10, nI = Math.max(1, items.length);
      const need = Math.round(520 * k + nI * 40 * k * 1.75), ph = Math.min(availH, need), py = top + 10 + Math.max(0, (availH - ph) / 2);
      c.save(); c.shadowColor = 'rgba(40,30,10,.28)'; c.shadowBlur = 40; c.shadowOffsetY = 16; c.fillStyle = '#FFFFFF';
      c.beginPath(); c.moveTo(px, py); for (let x = px; x < px + pw; x += z * 2) { c.lineTo(x + z, py + z * 0.6); c.lineTo(x + z * 2, py); } c.lineTo(px + pw, py + ph); for (let x = px + pw; x > px; x -= z * 2) { c.lineTo(x - z, py + ph - z * 0.6); c.lineTo(x - z * 2, py + ph); } c.closePath(); c.fill(); c.restore();
      const inner = px + 44 * k, iw = pw - 88 * k; let y = py + 52 * k;
      const title = PS.isHi() ? String(S.x.recTitle || '') : D.up(S.x.recTitle || 'What’s included'), tf = D.fitWrap(c, title, D.dt, iw, Math.round(84 * k), 44, 2);
      tf.lines.forEach((l, i) => D.T(c, l, inner, y + tf.size * 0.8 + i * tf.size * 0.95, { font: D.dt(tf.size), color: B.ink })); y += tf.lines.length * tf.size * 0.95 + 14 * k;
      const nm = D.fitWrap(c, [v.name, v.variant].filter(Boolean).join(' · ') || 'Car', (zz) => MH(zz, 800), iw, Math.round(34 * k), 22, 2); nm.lines.forEach((l, i) => D.T(c, l, inner, y + nm.size * 0.9 + i * nm.size * 1.25, { font: MH(nm.size, 800), color: B.blue })); y += nm.lines.length * nm.size * 1.25 + 18 * k;
      const dash = () => { c.save(); c.strokeStyle = '#B9B2A2'; c.lineWidth = 2; c.setLineDash([10, 8]); c.beginPath(); c.moveTo(inner, y); c.lineTo(inner + iw, y); c.stroke(); c.restore(); y += 24 * k; };
      dash();
      const priceH = 150 * k, avail = (py + ph - 70 * k) - y - priceH - 24, n = Math.max(1, items.length), fs = Math.max(18, Math.min(Math.round(40 * k), Math.floor(avail / (n * 1.62))));
      if (!items.length) { if (!S.exporting) { D.T(c, 'Add what’s included, one per line.', inner, y + 40, { font: D.bl(30, 700), color: '#8A8272' }); } y += 90; }
      let used = 0, dropped = 0;      // an item that does not fit above the price is left off, never drawn over it
      items.forEach((t) => { const fw = D.fitWrap(c, t, (zz) => D.bt(zz, 700), iw - fs * 1.7, fs, 16, 2), lh = fs * 1.3, hh2 = fw.lines.length * lh + fs * 0.42; if (used + hh2 > avail + 6) { dropped++; return; } used += hh2; D.icon(c, 'check', inner + fs * 0.45, y + fs * 0.55, fs * 0.8, '#1F8A4C', 3.4);
        fw.lines.forEach((l, i) => D.T(c, l, inner + fs * 1.4, y + fs * 0.9 + i * lh, { font: D.bt(fw.size, 700), color: B.ink })); y += hh2; });
      if (dropped) PS.note(S, `${dropped} item${dropped === 1 ? '' : 's'} did not fit on the receipt and ${dropped === 1 ? 'was' : 'were'} left off. Use fewer or shorter items (6 is a good number).`);
      y += 6; dash();
      D.T(c, up(tx('priceLbl')) + (PS.isHi() ? '' : ' (ASKING)'), inner, y + 22 * k, { font: D.bt(Math.round(24 * k), 800), color: B.inkMute, track: PS.isHi() ? 0 : 3 });
      const pr = PS.priceParts(v.priceN); if (pr) { const t = pr.sym + pr.num + (pr.unit ? ' ' + pr.unit : ''), s2 = D.fit(c, t, (zz) => MH(zz, 800), iw, Math.round(88 * k), 40, -1); D.T(c, t, inner, y + 30 * k + s2 * 0.95, { font: MH(s2, 800), color: B.ink, track: -1 }); }
      else D.T(c, up(tx('priceOnReq')), inner, y + 30 * k + 56 * k, { font: D.bt(Math.round(40 * k), 800), color: B.ink });
      // a barcode drawn from the stock id: decoration with a real value behind it
      const id = String(S.car.id || 'CA').toUpperCase(), rnd = D.seeded(Array.from(id).reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7)); let bx = inner + iw * 0.55; const by = py + ph - 60 * k, bh = 26 * k;
      c.fillStyle = B.ink; while (bx < inner + iw - 4) { const w1 = 2 + Math.floor(rnd() * 4); c.fillRect(bx, by, w1, bh); bx += w1 + 2 + Math.floor(rnd() * 3); }
      D.T(c, id, inner + iw, by + bh + 18 * k, { font: D.bt(Math.round(15 * k), 700), color: B.inkMute, align: 'right', track: 2 });
      D.footer(c, S, L.footer, L.footer.style, {}); D.adjLabel(c, S, L.label.x, L.label.y, L.label.a);
    }
  });

  /* ---------- PS-8: Coming Soon, halftone ---------- */
  PS.addTemplate({
    id: 'comingsoon', name: 'Coming Soon', group: 'More car layouts', family: 'cream', sizes: FEED, def: '1080x1350', file: 'comingsoon', ver: 'v2',
    car: true, carLite: true, badges: [], x: ['accent', 'csWhen'], noCta: true,
    render(c, L, S) {
      const { W, H, mode } = L, v = carView(S.car), m = L.m, A = accentOf(S), P = S.photos.main, k = mode === 'wide' ? 1.2 : mode === 'square' ? 0.82 : 1;
      c.fillStyle = '#F6F7FB'; c.fillRect(0, 0, W, H);
      // halftone dots in the accent, biggest at the bottom-right corner, fading out toward the top-left
      c.save(); c.fillStyle = A.a; const step = Math.max(26, Math.round(W / 38)), cx = W, cy = H * 0.9, maxD = Math.hypot(W * 1.05, H * 0.95);
      for (let y = 0; y < H; y += step) for (let x = ((y / step) % 2) * step / 2; x < W; x += step) { const d = Math.hypot(x - cx, y - cy) / maxD, r = Math.max(0, (0.5 - d) * 2.4) * step * 0.52; if (r > 0.8) { c.globalAlpha = 0.9; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } }
      c.restore();
      const { top, bottom, hh } = region(L);
      const word = up(tx('comingSoon')), wd = word.split(' '), cut2 = Math.ceil(wd.length / 2), lines = PS.isHi() ? [word] : wd.length > 2 ? [wd.slice(0, cut2).join(' '), wd.slice(cut2).join(' ')] : wd;
      const colW = mode === 'wide' ? W * 0.47 - m : W - 2 * m, ws = D.fit(c, lines.reduce((a, b) => (b.length > a.length ? b : a), ''), (z) => MH(z, 800), colW, Math.min(Math.round(190 * k), Math.floor(hh * 0.34 / (0.92 * lines.length))), 40, -3);
      lines.forEach((l, i) => D.T(c, l, m, top + ws * 0.8 + i * ws * 0.92, { font: PS.isHi() ? D.hd(Math.round(ws * 0.8), 800) : MH(ws, 800), color: A.a, track: -3 }));
      let y = top + ws * 0.92 * lines.length + 34 * k; const nm = D.fitWrap(c, up([S.car.make, S.car.model].filter(Boolean).join(' ')), (z) => MH(z, 800), colW, Math.round(64 * k), 30, 2);
      nm.lines.forEach((l, i) => D.T(c, l, m, y + nm.size * 0.8 + i * nm.size * 1.05, { font: MH(nm.size, 800), color: B.ink })); y += nm.lines.length * nm.size * 1.05 + 14;
      if (v.variant) { D.T(c, D.ellip(c, up(v.variant), D.bt(Math.round(30 * k), 700), colW), m, y + 30 * k, { font: D.bt(Math.round(30 * k), 700), color: B.inkMute }); y += 46 * k; }
      // the owner's own "when" words: one line when they fit the text column, else two lines in a taller pill (the pill never runs under the car, and a cut is reported)
      const when = String(S.x.csWhen || '').trim(); let pillH = 0;
      if (when) {
        const ws = Math.round(34 * k), wl = D.fitWrap(c, when, (z) => D.bt(z, 800), colW - 56, ws, 24, 2, 0), lh = Math.round(wl.size * 1.28); pillH = wl.lines.length * lh + Math.round(26 * k);
        if (wl.cut) PS.note(S, 'The “When” words are too long for this post and were shortened. Keep them under about 60 characters.');
        const pw = Math.min(colW, Math.max(...wl.lines.map((l) => D.tw(c, l, D.bt(wl.size, 800)))) + 56);
        D.fillRR(c, m, y + 10, pw, pillH, wl.lines.length > 1 ? 28 * k : pillH / 2, A.a);
        wl.lines.forEach((l, i) => D.T(c, l, m + 28, y + 10 + Math.round(13 * k) + wl.size * 0.92 + i * lh, { font: D.bt(wl.size, 800), color: '#fff' }));
      }
      // the car sits below the words, never behind them
      const yPhoto = y + (when ? pillH + 20 : 6), R = mode === 'wide' ? { x: W * 0.5, y: top, w: W * 0.5, h: hh } : { x: W * 0.2, y: yPhoto, w: W * 0.8, h: Math.max(160, (bottom - 20) - yPhoto) };
      if (P && P.img) slot(c, S, P, R, { feather: { l: R.w * 0.18, t: R.h * 0.12, b: R.h * 0.1, r: 0 }, minFrac: 0.9 }); else S._slots = (S._slots || []).concat([{ key: 'main', r: R }]);
      D.footer(c, S, L.footer, L.footer.style, {}); D.adjLabel(c, S, L.label.x, L.label.y, L.label.a);
    }
  });

  /* ---------- PS-14: caption burn-in overlay. Transparent PNG, 2 lines at most, inside the Reels title zone. ---------- */
  PS.addTemplate({
    id: 'captions', name: 'Caption overlay (reel)', group: 'Reel tools', family: 'photo', sizes: ['1080x1920'], def: '1080x1920', file: 'caption-overlay', ver: 'v2', safe: 'reel', transparent: true,
    car: false, badges: [], x: ['capText', 'capKey'], noCta: true,
    note: 'A transparent PNG to lay over your reel in any video editor. Two short lines at most, in the reel’s title zone, clear of the bottom 320 px.',
    render(c, L, S) {
      const { W, H } = L, hi = PS.isHi(), lines = String(S.x.capText || '').split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 2), key = String(S.x.capKey || '').trim().toLowerCase();
      if (!lines.length) { if (!S.exporting) D.T(c, 'Type the caption words', W / 2, 840, { font: D.bl(40, 800), color: '#fff', align: 'center', shadow: ['#000', 12, 2] }); return; }
      // Bebas caps for line 1, an italic serif for line 2; the keyword is red on whichever line holds it
      const m = 90, maxW = W - 2 * m, size0 = 96, boxes = [];
      lines.forEach((ln, i) => {
        const serif = i === 1 && !hi && !D.hasDeva(ln), face = (z) => (hi || D.hasDeva(ln) ? `800 ${Math.round(z * 0.8)}px "Noto Sans Devanagari"` : serif ? `italic 400 ${Math.round(z * 1.05)}px "Instrument Serif"` : `400 ${z}px "Bebas Neue"`);
        let t = serif || hi ? ln : ln.toUpperCase(), s = size0; while (s > 28 && D.tw(c, t, face(s)) > maxW - 72) s -= 2;
        if (D.tw(c, t, face(s)) > maxW - 72) { t = D.ellip(c, t, face(s), maxW - 72); PS.note(S, 'A caption line is too long for the reel and was shortened. Keep each line under about 35 characters.'); }
        boxes.push({ t, face, s, w: D.tw(c, t, face(s)) });
      });
      const gap = 18, bh = (b) => Math.round(b.s * 1.5), totalH = boxes.reduce((a, b) => a + bh(b), 0) + gap * (boxes.length - 1); let y = 840 - totalH / 2;
      boxes.forEach((b) => {
        const w = b.w + 72, x = (W - w) / 2, h = bh(b); D.fillRR(c, x, y, w, h, Math.round(h * 0.28), 'rgba(0,0,0,.88)');
        const words = b.t.split(' '); let px = x + 36; const base = y + h / 2 + b.s * 0.3;
        words.forEach((wd, j) => { const isKey = key && wd.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === key; px += D.T(c, wd + (j < words.length - 1 ? ' ' : ''), px, base, { font: b.face(b.s), color: isKey ? '#FF4B52' : '#fff' }); });
        y += h + gap;
      });
    }
  });
})();
