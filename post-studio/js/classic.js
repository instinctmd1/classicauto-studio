/* Classic Auto Post Studio — "Classic Listing": the house design, rebuilt from the real feed (ad-15s/assets/ig/*.jpg).
   Light showroom ground; the logo lockup (CA mark, SINCE 1974, CLASSIC AUTO, PRE OWNED CARS) top-left with the tagline; a registration card top-right;
   a make + model wordmark, variant pill, fuel | gearbox, a PRICE box; the car as the hero; a row of spec icons; a navy contact / address / brand bar;
   a BUY . SELL . EXCHANGE . UPGRADE strip.
   Differences from the real posts, on purpose: no manufacturer logos or slogans (text wordmark only), the contact block follows PS.contact()
   (no phone = DM + showroom), and the car's pixels are never repainted.
   Every text block is measured before it is drawn (plan*), and a layout that does not fit shrinks its model name, then its tagline, in steps
   (LADDER). Nothing is cut with an ellipsis and nothing is drawn over the price box or the spec row. */
(function () {
  'use strict';
  const PS = window.PS, D = PS.D, B = PS.B, tx = (k) => PS.tx(k);
  const INK = '#0A1A3A', GREY = '#3E4766', LABEL = '#38405C', RING = '#D3D9E6';
  const LATIN_H = (s, w) => `${w || 800} ${s}px Manrope`;
  // heading face for a string: Manrope for Latin, Noto Devanagari when the owner typed Hindi
  const hf = (str, s, w) => (D.hasDeva(str) ? `${w || 800} ${Math.round(s * 0.9)}px "Noto Sans Devanagari"` : LATIN_H(s, w));
  const up = (s) => (D.hasDeva(s) ? String(s) : String(s).toUpperCase());      // Latin text is upper-cased in every language; Devanagari has no case
  const DS = () => (PS.isHi() ? 1.16 : 1);                                       // Devanagari has a smaller x-height than Manrope: small labels are set 16% larger in Hindi
  const lab = (s, w) => D.bt(Math.round(s * DS()), w);                          // a label font (Noto Devanagari in Hindi, scaled)

  function accentOf(S) { const a = S.x.accent; return PS.ACCENTS[a && a !== 'auto' ? a : (S.car && S.car.accent) || 'navy'] || PS.ACCENTS.navy; }
  const textCol = (A) => (A === PS.ACCENTS.black ? '#121416' : A === PS.ACCENTS.navy ? '#0A1A3A' : A.b);

  /* ---------- geometry for the four sizes (every number is on the 1080 / 1920 canvas) ---------- */
  function geo(W, H) {
    const r = W / H, g = { W, H };
    if (r >= 1.6) {                                   // 1920 x 1080 landscape
      g.mode = 'wide'; g.m = 60; g.hdr = { h: 134, logoH: 104, tagS: 26, card: { w: 400, h: 100, y: 18 } };
      g.col = { x: 60, y: 164, w: 740 }; g.photo = { x: 800, y: 120, w: W - 800, h: 616, fl: 230, ft: 0.14, fb: 0.1, minFrac: 0.8 };
      g.spec = { y: 742, rows: 1, rh: 142, max: 6, vs: 28 }; g.foot = { y: 890, h: 98 }; g.menu = { y: 988, h: 92 }; g.k = 1.28; g.price = { w: 520, h: 136 };
      g.fcol = { w: 790 }; g.fr = { x: 900, y: 150, w: 960, h: 580 };
    } else if (r <= 0.62) {                          // 1080 x 1920 story: live area y 250 to 1580
      g.mode = 'tall'; g.m = 64; g.hdr = { h: 124, logoH: 104, tagS: 22, card: { w: 330, h: 96, y: 266 }, y: 258, tagLine: true };
      g.price = { w: 372, h: 134 }; g.col = { x: 64, y: 456, w: W - 128 - g.price.w - 26 };
      g.photo = { x: 0, y: 804, w: W, h: 566, fl: 150, ft: 0.18, fb: 0.1, minFrac: 0.74 };
      // the contact bar and the BUY strip sit 250 px up from the bottom (above Instagram's reply bar), with room for the three-line address
      g.spec = { y: 1366, rows: 1, rh: 118, max: 4, vs: 28 }; g.foot = { y: 1496, h: 116 }; g.menu = { y: 1612, h: 54 }; g.k = 1.1;
      g.fcol = { w: g.col.w }; g.fr = { x: 64, y: 806, w: 952, h: 554 };
    } else if (r < 0.9) {                             // 1080 x 1350 feed 4:5 (grid-safe: everything inside x 50 to 1030). The car is the hero.
      g.mode = 'portrait'; g.m = 50; g.hdr = { h: 156, logoH: 116, tagS: 26, card: { w: 300, h: 94, y: 40 } };
      g.col = { x: 50, y: 196, w: W - 100 }; g.photo = { x: 340, y: 300, w: W - 340, h: 690, fl: 200, ft: 0.16, fb: 0.08, minFrac: 0.9 };
      g.spec = { y: 1016, rows: 1, rh: 130, max: 5, vs: 28 }; g.foot = { y: 1186, h: 96 }; g.menu = { y: 1282, h: 68 }; g.k = 1.12; g.price = { w: 380, h: 136 };
      g.hero = { headW: 580 };
    } else {                                          // 1080 x 1080 square (the real feed's format)
      g.mode = 'square'; g.m = 34; g.hdr = { h: 150, logoH: 116, tagS: 24, card: { w: 300, h: 92, y: 38 } };
      g.col = { x: 36, y: 184, w: 456 }; g.photo = { x: 430, y: 150, w: W - 430, h: 620, fl: 170, ft: 0.16, fb: 0.1, minFrac: 0.9 };
      g.spec = { y: 752, rows: 1, rh: 126, max: 5, vs: 28 }; g.foot = { y: 898, h: 98 }; g.menu = { y: 996, h: 84 }; g.k = 1; g.price = { w: 400, h: 140 };
      g.split = { colW: 400, gap: 24 };
    }
    return g;
  }

  /* ---------- the Hindi forms of free-text values ---------- */
  const HI_COLOUR = { white: 'सफ़ेद', black: 'काला', red: 'लाल', blue: 'नीला', silver: 'सिल्वर', grey: 'ग्रे', gray: 'ग्रे', green: 'हरा', brown: 'भूरा', orange: 'नारंगी', yellow: 'पीला', maroon: 'मैरून', beige: 'बेज', gold: 'गोल्डन', golden: 'गोल्डन' };
  const HI_CHIP = { 'INDIVIDUAL': 'व्यक्तिगत', 'REGISTRATION': 'रजिस्ट्रेशन', 'TAX PAID': 'टैक्स जमा', 'ROAD TAX PAID': 'रोड टैक्स जमा', 'SERVICE HISTORY': 'सर्विस हिस्ट्री', 'NEW TYRES': 'नए टायर' };
  const HI_INS = { 'comprehensive': 'कॉम्प्रिहेंसिव', 'zero-dep': 'ज़ीरो-डेप', 'zero dep': 'ज़ीरो-डेप', 'third party': 'थर्ड पार्टी' };

  /* ---------- the view model: only facts that exist ---------- */
  function view(S) {
    const car = S.car, hi = PS.isHi();
    const own = parseInt(car.owners, 10);
    const rto = String(car.rto || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const insur = PS.insuranceInfo(car);
    const pr = PS.parseMoney(car.price), poa = PS.isPOA(car.price) || car.price_on_request === true || car.price_on_request === 'true';
    const colour = hi ? (HI_COLOUR[String(car.colour || '').trim().toLowerCase()] || car.colour || '') : (car.colour || '');
    const v = {
      make: up(car.make || ''), model: up(car.model || 'Model'), variant: up(car.variant || ''),
      fuel: car.fuel ? up(PS.fuelText(car.fuel)) : '', trans: car.trans ? up(PS.transText(car.trans)) : '', transDetail: up(car.trans_detail || ''),
      reg: car.reg_month ? up(car.reg_month) : (car.year ? String(car.year) : ''),
      owner: own === 1 ? up(tx('singleOwner')) : own > 1 ? up(PS.ownerText(own)) : up(tx('regLbl')),
      ownerShort: own === 1 ? (hi ? 'पहला' : 'SINGLE') : own > 1 ? up(PS.ownerText(own)).replace(/ OWNER| MALIK|\s*मालिक/i, '') : '',
      price: poa ? 0 : pr, poa, km: car.kms !== '' && car.kms != null && !isNaN(+car.kms) ? `${PS.inr(+car.kms)} KM` : '', rto,
      colour: up(colour), seats: car.seats ? `${car.seats} ${hi ? 'सीट' : 'STR'}` : '', insur, luxury: PS.isLuxury(car, S.x.luxury), year: car.year ? String(car.year) : ''
    };
    // Spec cells: id, priority (lower = kept first), display order, icon, value (one line), label candidates (the first that fits is drawn; none is ever cut).
    // The year, make, model and variant are not cells: they are already the registration card, the wordmark and the pill.
    const cells = [];
    const add = (id, pri, ord, icon, val, labels) => { const ls = [].concat(labels).filter(Boolean).map(String); if (val) cells.push({ id, pri, ord, icon, val: String(val), labels: ls, label: ls[0] || '' }); };
    add('owner', 1, 1, 'person', v.ownerShort, up(tx('cOwner')));
    // fuel and gearbox are printed big in the title block (DIESEL | AUTOMATIC), so the icon row does not repeat them: its room goes to larger values
    add('km', 4, 5, 'speedo', v.km, up(tx('cDriven')));
    if (v.insur.state === 'valid') {
      const ty = v.insur.type ? (hi ? (HI_INS[v.insur.type.toLowerCase()] || '') : up(v.insur.type)) : '';
      add('ins', 6, 6, 'shieldCheck', PS.fmtDate(v.insur.date, true), [ty ? `${ty} · ${up(tx('validTillShort'))}` : '', up(tx('insTill')), hi ? 'बीमा तक' : 'INSURED TILL', up(tx('validTillShort'))]);
    } else if (v.insur.state === 'text') add('ins', 6, 6, 'shieldCheck', up(v.insur.text).length <= 22 ? up(v.insur.text) : '', up(tx('cIns')));
    add('reg', 5, 4, 'pin', v.rto, [up(tx('cReg')), hi ? 'RTO' : 'REG.']);
    add('colour', 7, 7, 'palette', v.colour, up(tx('cColour')));
    add('seats', 8, 8, 'seat', v.seats, up(tx('cSeats')));
    String(car.chips || '').split(';').map((s) => s.trim()).filter(Boolean).slice(0, 2).forEach((ch, i) => {
      const p = ch.split('|').map((s) => s.trim()), a = up(p[0]), b = up(p[1] || '');
      if (hi) { const ha = HI_CHIP[a], hb = b ? HI_CHIP[b] : ''; if (!ha || (b && !hb)) return; add('chip' + i, 9 + i, 9 + i, 'doc', ha, hb); }       // a chip with no Hindi form is left out of the Hindi post: no mixed scripts in one cell
      else add('chip' + i, 9 + i, 9 + i, 'doc', a, b);
    });
    v.cells = cells; return v;
  }

  /* ---------- pieces ---------- */
  function background(c, g) {
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, g.W, g.H);
    c.fillStyle = D.lin(c, 0, 0, 0, g.H, [[0, '#EAEFF7'], [0.38, '#FFFFFF'], [1, '#EEF1F8']]); c.fillRect(0, 0, g.W, g.H);
    // soft showroom light on the car side, kept very quiet
    const R = g.photo, gr = c.createRadialGradient(R.x + R.w * 0.62, R.y + R.h * 0.42, 20, R.x + R.w * 0.62, R.y + R.h * 0.42, Math.max(R.w, R.h) * 0.8);
    gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, g.W, g.H);
  }

  // The lockup of the real posts (assets/logo.png): the CA mark, SINCE 1974 (blue and red), CLASSIC AUTO, PRE OWNED CARS. x, y = top-left; h = height. Returns its width.
  function lockup(c, x, y, h) {
    const lg = D.logo; if (!lg) return 0; const lw = h * D.logoAR(); c.drawImage(lg, x, y, lw, h); return lw;
  }

  function header(c, S, g, v, A, regCard) {
    const h = g.hdr, y0 = h.y != null ? h.y : 20, lh = Math.round(h.logoH * 1.1), lx = g.m - 2;
    const lw = lockup(c, lx, y0, lh);
    const tagX = lx + lw + 44, ruleX = lx + lw + 22;
    // the brand line stays in Latin script in every language (as on the real posts); only the second line, "TRUSTED ALWAYS", is translated
    const t1 = up(PS.COPY[v.luxury ? 'hdrTag1L' : 'hdrTag1'][0]), t2 = up(tx('hdrTag2')), cardX = regCard.x, hi = PS.isHi();
    const tr1 = (z) => z * 0.1, tr2 = (z) => (hi ? 0 : z * 0.1), f1 = (z) => D.bl(z, 600), f2 = (z) => D.bt(hi ? Math.round(z * 1.3) : z, 600);        // Devanagari is set about 30 percent larger so its cap height matches the Latin line above it
    if (!h.tagLine) {
      c.fillStyle = '#C9CFDC'; c.fillRect(ruleX, y0 + lh * 0.24, 2, lh * 0.56);
      const avail = cardX - tagX - 20; let s = Math.round(h.tagS * (hi ? 1.08 : 1)); while (s > 16 && Math.max(D.tw(c, t1, f1(s), tr1(s)), D.tw(c, t2, f2(s), tr2(s))) > avail) s -= 1;
      D.T(c, t1, tagX, y0 + lh * 0.42, { font: f1(s), color: INK, track: tr1(s) }); D.T(c, t2, tagX, y0 + lh * 0.42 + s * (hi ? 1.85 : 1.65), { font: f2(s), color: INK, track: tr2(s) });
    } else {                                          // story: one left-aligned line below the logo row, with room before the wordmark
      const t = `${t1}  ·  ${t2}`; let ss = Math.round(24 * (hi ? 1.08 : 1)); const tw = (z) => D.tw(c, t1, f1(z), tr1(z)) + D.tw(c, '  ·  ', f1(z)) + D.tw(c, t2, f2(z), tr2(z));
      while (ss > 16 && tw(ss) > g.W - 2 * g.m) ss -= 1;
      const base = y0 + lh + 44; let q = g.m; q += D.T(c, t1, q, base, { font: f1(ss), color: INK, track: tr1(ss) }); q += D.T(c, '  ·  ', q, base, { font: f1(ss), color: INK }); D.T(c, t2, q, base, { font: f2(ss), color: INK, track: tr2(ss) });
    }
  }

  // registration card (top right): calendar icon, month + year, owner line. In Hindi the card is 8 px taller, the owner line 8 percent smaller and set lower, so the shirorekha never touches the numerals
  function regCard(c, S, g, v, A) {
    const k = g.hdr.card, hi = PS.isHi(), kh = k.h + (hi ? 8 : 0), x = g.W - g.m - k.w, y = k.y;
    c.save(); c.shadowColor = 'rgba(10,26,58,.18)'; c.shadowBlur = 18; c.shadowOffsetY = 5; D.fillRR(c, x, y, k.w, kh, 18, '#FFFFFF'); c.restore();
    D.strokeRR(c, x, y, k.w, kh, 18, A.a, 3);
    D.icon(c, 'calGrid', x + 20 + 26, y + kh / 2, 52, A.a, 2);
    const tx0 = x + 20 + 52 + 16, avail = x + k.w - 16 - tx0, month = v.reg || ' ';
    const s1 = D.fit(c, month, (z) => LATIN_H(z, 800), avail, Math.round(k.h * 0.44), 22, 0);
    const line2 = v.owner, s2 = Math.round(D.fit(c, line2, (z) => lab(z, 700), avail, Math.round(k.h * 0.27), 14) * (hi ? 0.92 : 1));
    D.T(c, month, tx0, y + kh * (line2 ? (hi ? 0.46 : 0.52) : 0.64), { font: LATIN_H(s1, 800), color: A.a });
    if (line2) D.T(c, line2, tx0, y + kh * 0.82 + (hi ? 4 : 0), { font: lab(s2, 700), color: INK });
    return { x, y, w: k.w, h: kh };
  }

  // photo area (Soft edge style): contained, feathered into the white ground. Registers the drag slot. A PNG with transparency is a cut-out car.
  function photoArea(c, S, g) {
    const R = g.photo, P = S.photos.main; S._slots = S._slots || []; S._labels = S._labels || [];
    if (!P || !P.img) {
      S._slots.push({ key: 'main', r: R });
      if (!S.exporting) { c.save(); c.setLineDash([14, 10]); D.strokeRR(c, R.x + 20, R.y + R.h * 0.2, R.w - 40, R.h * 0.7, 24, '#9AA5BF', 3); c.restore(); D.T(c, 'Add the car photo first', R.x + R.w / 2, R.y + R.h * 0.55, { font: D.bl(34, 700), color: '#7C88A8', align: 'center' }); }
      return null;
    }
    if (cutOn(S)) return D.cutCar(c, S, P, { x0: R.x, x1: g.W - g.m, top: R.y + 30, ground: g.spec.y - 30, W: g.W, floorEnd: g.spec.y + 4, bleed: false });
    if (P.src === 'stock') S._samplePhoto = true;
    const dr = D.photoPlaced(c, S, P, R, { feather: { l: R.fl, t: R.h * R.ft, b: R.h * R.fb, r: 0 }, cut: !!P.alpha, minFrac: R.minFrac, maxScale: P.alpha ? 0 : 1.3 });
    S._slots.push({ key: 'main', r: R, dr, mode: 'fill' });
    return dr;
  }

  // PRICE box: accent gradient, "PRICE" label, the full price (no rounding), or "PRICE ON REQUEST". With the NEW PRICE stamp the box carries a hazard-stripe band across its
  // own top (so the stamp can never cover another line of the post) and the label is replaced by it. o: {noStamp, tint (a festival accent line round the box)}
  function priceBox(c, S, g, v, A, x, y, o) {
    o = o || {}; const k = g.price, w = k.w, h = k.h, band = !o.noStamp && S.tpl === 'newarrival' && S.x.stamp === 'new', bh = band ? Math.round(h * 0.34) : 0; D.shadowBox(c, () => D.fillRR(c, x, y, w, h, 20, A.a));
    c.save(); D.rr(c, x, y, w, h, 20); c.clip(); c.fillStyle = D.lin(c, x, y, x + w, y + h, [[0, A.mid], [1, A.b]]); c.fillRect(x, y, w, h);
    if (band) {
      c.fillStyle = '#F2C300'; c.fillRect(x, y, w, bh); c.fillStyle = '#111';
      for (let sx = x - bh; sx < x + w + bh; sx += bh * 1.1) { c.beginPath(); c.moveTo(sx, y + bh); c.lineTo(sx + bh * 0.55, y + bh); c.lineTo(sx + bh * 1.1, y); c.lineTo(sx + bh * 0.55, y); c.closePath(); c.fill(); }
      const t = up(tx('stampNew')), fs = Math.round(bh * 0.56), tr = PS.isHi() ? 0 : 2, tw = D.tw(c, t, D.bt(fs, 800), tr) + 30;
      D.fillRR(c, x + w / 2 - tw / 2, y + bh * 0.1, tw, bh * 0.8, 6, '#111'); D.T(c, t, x + w / 2, y + bh * 0.5 + fs * 0.34, { font: D.bt(fs, 800), color: '#F2C300', align: 'center', track: tr });
    }
    c.restore();
    D.strokeRR(c, x, y, w, h, 20, o.tint || 'rgba(255,255,255,.14)', o.tint ? 4 : 2);
    const ih = h - bh, lblS = Math.round(h * 0.2), lbl = up(tx('priceLbl'));
    if (!(v.price > 0)) {                             // price on request: one line, no repeated "PRICE" label
      const t = up(tx('priceOnReq')), s2 = D.fit(c, t, (z) => D.bt(z, 800), w - 40, Math.round(h * 0.3), 14); D.T(c, t, x + w / 2, y + bh + ih / 2 + s2 * 0.34, { font: D.bt(s2, 800), color: '#fff', align: 'center' }); return;
    }
    if (!band) D.T(c, lbl, x + w / 2, y + h * 0.29, { font: lab(lblS, 700), color: '#fff', align: 'center', track: PS.isHi() ? 0 : lblS * 0.12 });
    const p = PS.priceParts(v.price), txt = p.sym + p.num, unit = p.unit, avail = w - 36 - (unit ? Math.round(h * 0.32) * 2 : 0);
    const s = D.fit(c, txt, (z) => LATIN_H(z, 800), avail, Math.round(h * (band ? 0.5 : 0.52)), 20, -1), by = band ? y + bh + ih * 0.76 : y + h * 0.84;
    const fw = D.tw(c, txt, LATIN_H(s, 800)), uf = D.bt(Math.round(s * 0.4), 800), uw = unit ? D.tw(c, unit, uf) + 10 : 0, x0 = x + w / 2 - (fw + uw) / 2, mp = PS.motion.progress(S);
    const shown = mp < 1 ? (() => { const q = PS.priceParts(PS.motion.count(v.price, PS.motion.ease(mp / 0.7))); return q ? q.sym + q.num : '₹0'; })() : txt;
    D.T(c, shown, x0 + (fw - D.tw(c, shown, LATIN_H(s, 800))), by, { font: LATIN_H(s, 800), color: '#fff' }); if (unit) D.T(c, unit, x0 + fw + 10, by, { font: uf, color: '#fff' });
  }

  /* ---------- the text column: measured first (plan*), drawn second (draw*) ---------- */
  // head: make + MODEL. opts: scale (the ladder step), big (poster size when the model fits on one line), modelMax, maxLines.
  function planHead(c, g, v, w, o) {
    o = o || {}; const k = g.k, sc = o.scale || 1;
    const makeS = v.make ? D.fit(c, v.make, (z) => LATIN_H(z, 800), w, Math.round(52 * k * Math.min(1, sc + 0.2)), 26, 1.5) : 0, makeH = v.make ? makeS * 0.74 + 14 : 0;
    const maxM = Math.max(54, Math.round((o.modelMax || (g.mode === 'tall' ? 150 : 140 * k)) * sc)); let fw = null;
    if (o.big) { const big = Math.max(60, Math.round(o.big * sc)); fw = D.fitWrap(c, v.model, (z) => hf(v.model, z, 800), w, big, Math.round(big * 0.6), 1, -2); if (fw.cut) fw = null; }      // a poster-size wordmark when it fits on one line
    if (!fw) fw = D.fitWrap(c, v.model, (z) => LATIN_H(z, 800), w, maxM, 54, o.maxLines || 2, -2);
    const ms = fw.size, lhm = ms * 0.86;
    return { w, makeS, makeH, fw, ms, lhm, h: makeH + ms * 0.72 + (fw.lines.length - 1) * lhm + 20, cut: fw.cut };
  }
  function drawHead(c, S, g, v, A, P, x, y) {
    const tc = textCol(A), mp = PS.motion.progress(S);
    if (v.make) D.T(c, v.make, x, y + P.makeS * 0.74, { font: LATIN_H(P.makeS, 800), color: INK, track: 1.5 });
    const by = y + P.makeH;
    P.fw.lines.forEach((l, i) => D.T(c, mp < 1 ? PS.motion.scramble(l, PS.motion.ease(mp / 0.55), 11 + i * 7) : l, x - 3, by + P.ms * 0.72 + i * P.lhm, { font: hf(l, P.ms, 800), color: tc, track: -2 }));
    return y + P.h;
  }
  // lower: variant pill, fuel | gearbox (side by side when o.inline and they fit the width), hairline, optional tagline, accent rule
  function planLower(c, g, v, w, tag, o) {
    o = o || {}; const k = g.k, L = { w, h: 0 };
    if (v.variant) {                                  // variant pill: one line when it fits at 24 px or more, else two
      const vs = Math.round(34 * Math.min(1.2, k)), inner = w - 48; let vf = D.fitWrap(c, v.variant, (z) => hf(v.variant, z, 800), inner, vs, 24, 1, 0);
      if (vf.cut) vf = D.fitWrap(c, v.variant, (z) => hf(v.variant, z, 800), inner, vs, 22, 2, 0);
      if (vf.cut) vf = D.fitWrap(c, v.variant, (z) => hf(v.variant, z, 800), inner, vs, 20, 3, 0);       // a very long variant: three lines at 20 px before any word is cut
      L.pillCut = vf.cut; L.pill = { vf, vh: vf.lines.length * vf.size * 1.22 + 22, pw: Math.min(w, Math.max(...vf.lines.map((l) => D.tw(c, l, hf(l, vf.size, 800)))) + 48) };
    }
    const ft = [v.fuel, v.trans + (v.transDetail ? ` (${v.transDetail})` : '')].filter((s) => s.trim());
    if (ft.length) {                                  // DIESEL | AUTOMATIC
      const gap = 36, wid = (z) => ft.reduce((a, t) => a + D.tw(c, t, D.bt(z, 800)), 0) + gap * (ft.length - 1); let fs = Math.round(32 * Math.min(1.25, k)); const max0 = fs;
      while (fs > 18 && wid(fs) > w) fs -= 1;
      L.ft = { ft, fs, gap, w: wid(fs), stack: wid(fs) > w };             // too wide even at 18 px: one item per line
      if (L.ft.stack) { fs = Math.min(max0, 28); L.ft.fs = fs; L.ft.w = Math.max(...ft.map((t) => D.tw(c, t, D.bt(fs, 800)))); }
    }
    L.inline = !!(o.inline && L.pill && L.ft && !L.ft.stack && L.pill.pw + 48 + L.ft.w <= w);
    if (L.pill && L.ft && L.inline) L.h += Math.max(L.pill.vh, L.ft.fs) + 18;
    else { if (L.pill) L.h += L.pill.vh + 22; if (L.ft) L.h += (L.ft.stack ? L.ft.ft.length * (L.ft.fs * 1.25) : L.ft.fs) + 20; }
    if (!o.noRule) L.h += 18;                          // hairline
    if (tag && !o.noTag) {                             // the owner's own words (empty by default; never the manufacturer's slogan)
      const tr = PS.isHi() ? 0 : 3, tf = D.fitWrap(c, up(tag), (z) => D.bt(z, 500), w, Math.round(24 * Math.min(1.2, k)), o.tagMin || 16, o.tagLines || 2, tr); L.tag = { tf, tr }; L.h += tf.lines.length * tf.size * 1.35 + 12; L.tagCut = tf.cut;
    }
    if (!o.noRule) L.h += 28;                          // accent rule
    L.o = o; return L;
  }
  function drawLower(c, S, g, v, A, L, x, y) {
    const k = g.k, w = L.w;
    const pillAt = (px, py) => {
      const { vf, vh, pw } = L.pill; D.fillRR(c, px, py, pw, vh, 16, A.a); c.save(); D.rr(c, px, py, pw, vh, 16); c.clip(); c.fillStyle = D.lin(c, px, py, px + pw, py + vh, [[0, A.mid], [1, A.a]]); c.fillRect(px, py, pw, vh); c.restore();
      vf.lines.forEach((l, i) => D.T(c, l, px + 24, py + 11 + vf.size * 0.98 + i * vf.size * 1.22, { font: hf(l, vf.size, 800), color: '#fff' }));
    };
    const ftAt = (px, py) => {                        // py = top of the line's box
      const { ft, fs, gap, stack } = L.ft;
      if (stack) { ft.forEach((t, i) => D.T(c, t, px, py + fs * 0.8 + i * fs * 1.25, { font: D.bt(fs, 800), color: INK })); return; }
      let q = px; ft.forEach((t, i) => { q += D.T(c, t, q, py + fs * 0.8, { font: D.bt(fs, 800), color: INK }); if (i < ft.length - 1) { c.fillStyle = '#9AA3B8'; c.fillRect(q + gap / 2 - 1, py + 2, 2, fs); q += gap; } });
    };
    if (L.inline) {
      const rowH = Math.max(L.pill.vh, L.ft.fs); pillAt(x, y + (rowH - L.pill.vh) / 2); ftAt(x + L.pill.pw + 48, y + (rowH - L.ft.fs) / 2); y += rowH + 18;
    } else {
      if (L.pill) { pillAt(x, y); y += L.pill.vh + 22; }
      if (L.ft) { ftAt(x, y); y += (L.ft.stack ? L.ft.ft.length * (L.ft.fs * 1.25) : L.ft.fs) + 20; }
    }
    if (!L.o.noRule) { c.fillStyle = '#C9CFDC'; c.fillRect(x, y, w * 0.96, 2); y += 18; }
    if (L.tag) { const { tf, tr } = L.tag; tf.lines.forEach((l, i) => D.T(c, l, x, y + tf.size * 0.9 + i * tf.size * 1.35, { font: D.bt(tf.size, 500), color: GREY, track: tr })); y += tf.lines.length * tf.size * 1.35 + 12; }
    if (!L.o.noRule) { c.fillStyle = B.blue; c.fillRect(x, y, Math.round(110 * Math.min(1.2, k)), 4); y += 28; }
    return y;
  }
  // when a title block does not fit, shrink the model name in steps, then the tagline; the last step drops the tagline (and says so).
  const LADDER = [{ sc: 1 }, { sc: 0.88 }, { sc: 0.76 }, { sc: 0.66 }, { sc: 0.62, tmin: 14 }, { sc: 0.56, noTag: true }];
  // plan the head and the lower block as a stack that must end at or above endMax. a = {y0, headW, lowW, minLowY, big, inline, noRule}
  function fitStack(c, S, g, v, a) {
    const tag = String(S.x.tagline || '').trim(); let r = null;
    for (const lv of LADDER) {
      const head = planHead(c, g, v, a.headW, { scale: lv.sc, big: a.big, maxLines: 2 }), lowY = Math.max(a.y0 + head.h, a.minLowY || 0);
      const low = planLower(c, g, v, a.lowW, tag, { inline: a.inline, noRule: a.noRule, noTag: lv.noTag, tagLines: lv.tl, tagMin: lv.tmin });
      r = { head, low, lowY, end: lowY + low.h, lv, tag }; if (r.end <= a.endMax && !low.tagCut) break;
    }
    if (r.tag && r.lv.noTag) PS.note(S, 'The tagline is hidden: it is too long for this post. Shorten it to about 40 characters.');
    if (r.head.cut) PS.note(S, 'The model name is very long and was shortened. Use a shorter name.');
    if (r.low.pillCut) PS.note(S, 'The variant is very long and was shortened. Keep it under about 45 characters.');
    return r;
  }

  // the 4:5 hero layout: left column = make, MODEL, variant pill. Right column = PRICE box, fuel | gearbox under it. Then the tagline, then the car.
  function fitHero(c, S, g, v) {
    const tag = String(S.x.tagline || '').trim(), y0 = g.col.y, pw = g.price.w, carBottom = g.spec.y - 24, minCar = 400, nov = Object.assign({}, v, { variant: '' }), onlyPill = Object.assign({}, v, { fuel: '', trans: '', transDetail: '' }), onlyTag = Object.assign({}, v, { variant: '', fuel: '', trans: '', transDetail: '' });
    let r = null;
    for (const lv of LADDER) {
      const head = planHead(c, g, v, g.hero.headW, { scale: lv.sc, big: 250, maxLines: 2 }), pill = planLower(c, g, onlyPill, g.hero.headW, '', { noRule: true, noTag: true }), ft = planLower(c, g, nov, pw, '', { noRule: true, noTag: true });
      const tagP = planLower(c, g, onlyTag, g.W - 2 * g.m, lv.noTag ? '' : tag, { noRule: true, tagLines: lv.tl, tagMin: lv.tmin }), rowsH = Math.max(head.h + pill.h, 6 + g.price.h + 16 + ft.h);
      r = { head, pill, ft, tag: tagP, rowsH, lv, end: y0 + rowsH + tagP.h }; if (carBottom - 4 - r.end >= minCar && !tagP.tagCut) break;
    }
    if (tag && r.lv.noTag) PS.note(S, 'The tagline is hidden: it is too long for this post. Shorten it to about 40 characters.');
    if (r.head.cut) PS.note(S, 'The model name is very long and was shortened. Use a shorter name.');
    if (r.pill.pillCut) PS.note(S, 'The variant is very long and was shortened. Keep it under about 45 characters.');
    return r;
  }

  // spec icon cells: icon in a ring, one bold value line (26 px or more), one small label line (20 px or more). One row, never an orphan second row, never an ellipsis:
  // a cell whose value cannot fit at the minimum size is left out, and its label switches to a shorter form. Fewer than four cells sit together in the middle at a fixed width.
  function specRow(c, S, g, v) {
    const sp = g.spec, A = accentOf(S), inner = g.W - 2 * g.m, ds = DS(), floorV = 26, ls0 = Math.round(20 * (PS.isHi() ? 1.08 : 1));
    const fitVal = (cell, cw) => { let s = Math.max(floorV, Math.min(Math.round(sp.vs * (g.mode === 'wide' ? 1 : 1)), Math.round(cw * 0.2))); while (s > floorV && D.tw(c, cell.val, D.bt(s, 800)) > cw - 10) s -= 1; return D.tw(c, cell.val, D.bt(s, 800)) <= cw - 10 ? s : 0; };
    let pool = v.cells.slice().sort((a, b) => a.pri - b.pri), sel;
    for (;;) {
      sel = pool.slice(0, sp.max); if (!sel.length) return;
      const cw = inner / Math.max(sel.length, 4), bad = sel.filter((cl) => !fitVal(cl, cw)); if (!bad.length) break;
      pool = pool.filter((cl) => cl !== bad[bad.length - 1]);
    }
    const picked = sel.sort((a, b) => a.ord - b.ord), per = picked.length, cw = Math.min(inner / Math.max(per, 4), 260), rh = sp.rh, x0 = g.m + (inner - per * cw) / 2;
    picked.forEach((cell, i) => {
      c.save(); c.globalAlpha = PS.motion.clamp((PS.motion.progress(S) - 0.45 - i * 0.035) / 0.15);
      const cx = x0 + i * cw + cw / 2, top = sp.y + 4, vs = fitVal(cell, cw);
      let ls = ls0, text = cell.labels[cell.labels.length - 1] || ''; for (const t of cell.labels) if (D.tw(c, t, D.bt(ls, 600)) <= cw - 8) { text = t; break; }
      while (ls > 18 && D.tw(c, text, D.bt(ls, 600)) > cw - 6) ls -= 1;
      const rad = Math.max(18, Math.min(g.mode === 'wide' ? 40 : 34, cw * 0.3, (rh - 14 - vs - ls) / 2));
      c.save(); c.shadowColor = 'rgba(10,26,58,.14)'; c.shadowBlur = 10; c.shadowOffsetY = 3; c.beginPath(); c.arc(cx, top + rad, rad, 0, 7); c.fillStyle = '#fff'; c.fill(); c.restore();
      c.beginPath(); c.arc(cx, top + rad, rad, 0, 7); c.strokeStyle = RING; c.lineWidth = 2; c.stroke();
      D.icon(c, cell.icon, cx, top + rad, rad * 1.04, A.a, 2.1);
      const vy = top + 2 * rad + 10 + vs * 0.86;
      D.T(c, cell.val, cx, vy, { font: D.bt(vs, 800), color: INK, align: 'center' });
      if (text) D.T(c, text, cx, vy + ls + 5, { font: D.bt(ls, 600), color: LABEL, align: 'center' });
      if (i < per - 1 && per >= 4) { c.fillStyle = '#D5DAE6'; c.fillRect(x0 + (i + 1) * cw - 1, top + 4, 1.5, rh - 26); }
      c.restore();
    });
  }

  // navy bar: contact | address (the owner's address on two lines, 20 px or more; three lines on the story) | brand (landscape only, in Latin script in every language)
  function footerBar(c, S, g, A, o) {
    o = o || {}; const f = g.foot, y = f.y, h = f.h, W = g.W, ct = PS.contact(), pad = g.m + 2, mid = y + h / 2, wide = g.mode === 'wide', tall = g.mode === 'tall', k = wide ? 1.3 : tall ? 1.05 : 1, ds = DS();
    const Wi = W - 2 * pad, fr = tall ? [0.4, 0.6, 0] : wide ? [0.28, 0.5, 0.22] : [0.33, 0.67, 0], tint = o.tint;
    const c0 = pad, w0 = Wi * fr[0], c1 = c0 + w0, w1 = Wi * fr[1], c2 = c1 + w1, w2 = Wi * fr[2];
    D.zone(c, 'footer', { x: 0, y, w: W, h }, () => {
      c.save(); c.fillStyle = D.lin(c, 0, y, 0, y + h, [[0, A.a], [1, A.b]]); c.fillRect(0, y, W, h);
      if (tint) { c.fillStyle = tint; c.fillRect(0, y, W, 5); }                  // a festival accent line along the top edge of the bar
      // 1) contact, the same order as D.contactModel: phone (CALL NOW + number), else WhatsApp + its number, else DM + handle
      const icon = ct.hasPhone ? 'phone' : 'chat', cl = up(ct.hasPhone ? tx('callNow') : ct.hasWa ? tx('whatsapp') : tx('dmUs')), val = ct.hasPhone ? ct.phone : ct.hasWa ? ct.wa : ct.handle;
      D.icon(c, icon, c0 + 22 * k, mid, 40 * k, '#fff', 2.2);
      const ls = Math.round(21 * k * ds), vs = D.fit(c, val, (z) => D.bt(z, 800), w0 - 58 * k - 12, Math.round(30 * k), 10), top0 = mid - (ls + 6 + vs) / 2;
      D.T(c, cl, c0 + 56 * k, top0 + ls * 0.9, { font: D.bt(ls, 800), color: '#fff', track: PS.isHi() ? 0 : 1.4 }); D.T(c, val, c0 + 56 * k, top0 + ls + 6 + vs * 0.86, { font: D.bt(vs, 800), color: '#fff' });
      // 2) address (Latin script in every language: it is the one address)
      c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(c1 - 8, y + h * 0.2, 2, h * 0.6);
      D.icon(c, 'pin', c1 + 22 * k, mid, 34 * k, '#fff', 2.2);
      const lines = tall ? PS.SITE.address_lines3 : PS.SITE.address_lines, aw = w1 - 52 * k - 14; let as = Math.round(22 * k); while (as > 18 && Math.max(...lines.map((l) => D.tw(c, l, D.bl(as, 600)))) > aw) as -= 0.5;
      const lh = as * 1.36, top = mid - (lines.length * lh) / 2 + as * 0.95;
      lines.forEach((l, i) => D.T(c, l, c1 + 48 * k, top + i * lh, { font: D.bl(as, 600), color: '#fff' }));
      // 3) brand
      if (w2 > 0) {
        c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(c2 - 8, y + h * 0.2, 2, h * 0.6);
        const cx = c2 + (w2 - 6) / 2, tr = 4, n1 = 'CLASSIC AUTO', ns = D.fit(c, n1, (z) => D.bl(z, 700), w2 - 22, Math.round(24 * k), 12, tr), n1w = D.tw(c, n1, D.bl(ns, 700), tr);
        D.T(c, n1, cx, mid - 8 * k, { font: D.bl(ns, 700), color: '#fff', align: 'center', track: tr });
        c.fillStyle = B.red; c.fillRect(cx - n1w / 2, mid - 2 * k, n1w, 3);
        // the line under the name: one line when it fits, else two balanced lines (never one word on a line of its own)
        const t1 = up(PS.COPY[PS.isLuxury(S.car, S.x.luxury) ? 'hdrTag1L' : 'hdrTag1'][0]), ttr = 1.2, mw = w2 - 14, base = Math.round(13 * k); let tl = [t1], ts = base;
        while (ts > 10 && D.tw(c, t1, D.bl(ts, 500), ttr) > mw) ts -= 0.5;
        if (D.tw(c, t1, D.bl(ts, 500), ttr) > mw) {
          const words = t1.split(' '); let best = null;
          for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '), b = words.slice(i).join(' '), m = Math.max(D.tw(c, a, D.bl(base, 500), ttr), D.tw(c, b, D.bl(base, 500), ttr)); if (!best || m < best.m) best = { a, b, m }; }
          if (best) { tl = [best.a, best.b]; ts = base; while (ts > 10 && Math.max(D.tw(c, best.a, D.bl(ts, 500), ttr), D.tw(c, best.b, D.bl(ts, 500), ttr)) > mw) ts -= 0.5; }
        }
        tl.forEach((l, i) => D.T(c, l, cx, mid + 14 * k + i * ts * 1.3, { font: D.bl(ts, 500), color: 'rgba(255,255,255,.88)', align: 'center', track: ttr }));
      }
      c.restore();
    });
  }

  // white strip: BUY . SELL . EXCHANGE . UPGRADE (the four services Classic Auto prints on every post)
  function menuStrip(c, g) {
    const m = g.menu, y = m.y, h = m.h, items = [['handshake', 'buyW'], ['swapBold', 'sellW'], ['chart', 'exchW'], ['carFront', 'upgW']];
    D.zone(c, 'footer', { x: 0, y, w: g.W, h }, () => {
      c.fillStyle = '#FFFFFF'; c.fillRect(0, y, g.W, h); const cw = (g.W - 2 * g.m) / 4, k = g.mode === 'wide' ? 1.25 : 1, is = Math.round(Math.min(h * 0.74, 52 * k)), hi = PS.isHi();
      items.forEach((it, i) => {
        const x0 = g.m + i * cw, mid = y + h / 2, label = up(tx(it[1])); let fs = Math.min(Math.round(h * 0.4 * (hi ? 1.1 : 1)), Math.round(27 * k * (hi ? 1.1 : 1))), tr = hi ? 0 : 1;
        while (fs > 16 && D.tw(c, label, D.bt(fs, 700), tr) + is + 16 > cw - 20) fs -= 1;
        const w = D.tw(c, label, D.bt(fs, 700), tr) + is + 16, sx = x0 + cw / 2 - w / 2; D.icon(c, it[0], sx + is / 2, mid, is, INK, 2.6); D.T(c, label, sx + is + 16, mid + fs * 0.34, { font: D.bt(fs, 700), color: INK, track: tr });
        if (i < 3) { c.fillStyle = '#C9CFDC'; c.fillRect(x0 + cw - 1, y + h * 0.22, 2, h * 0.56); }
      });
    });
  }

  // stamps (PS-8): SOLD in concentric rings, BOOKED in a ring, JUST IN in repeated outlines, NEW PRICE on a hazard stripe, COMING SOON as a ribbon,
  // INSPECTED only when the owner has switched that claim on in Settings. They sit over the photo area as graphics; the car's pixels are not repainted.
  function ringStamp(c, cx, cy, r0, col, word, fill) {
    c.save(); c.translate(cx, cy); c.rotate(-0.2);
    c.beginPath(); c.arc(0, 0, r0 * 0.74, 0, 7); c.fillStyle = fill || 'rgba(255,255,255,.45)'; c.fill();
    [[1, 12], [0.86, 5], [0.74, 2.5]].forEach(([f, lw]) => { c.beginPath(); c.arc(0, 0, r0 * f, 0, 7); c.strokeStyle = col; c.lineWidth = lw; c.globalAlpha = 0.9; c.stroke(); });
    c.globalAlpha = 1; const tr = PS.isHi() ? 0 : 3, slot = r0 * 1.2; let fs = D.fit(c, word, (z) => LATIN_H(z, 800), slot, Math.round(r0 * 0.5), 12, tr);
    if (D.tw(c, word, LATIN_H(fs, 800), tr) > slot) { const w2 = word.split(' '); if (w2.length > 1) { const h2 = Math.ceil(w2.length / 2), a = w2.slice(0, h2).join(' '), b = w2.slice(h2).join(' '); fs = Math.min(D.fit(c, a, (z) => LATIN_H(z, 800), slot, Math.round(r0 * 0.34), 12, tr), D.fit(c, b, (z) => LATIN_H(z, 800), slot, Math.round(r0 * 0.34), 12, tr)); D.T(c, a, 0, -fs * 0.14, { font: LATIN_H(fs, 800), color: col, align: 'center', track: tr }); D.T(c, b, 0, fs * 0.98, { font: LATIN_H(fs, 800), color: col, align: 'center', track: tr }); c.restore(); return; } }
    D.T(c, word, 0, fs * 0.34, { font: LATIN_H(fs, 800), color: col, align: 'center', track: tr }); c.restore();
  }
  // lim: {headEnd} for the Soft edge style, where the wordmark runs over the photo area: the JUST IN stamp starts below it
  function stamp(c, S, g, card, pb, lim) {
    const key = S.x.stamp; if (!key || key === 'none') return; if (key === 'inspected' && !PS.settings.claimInspected) return;
    const R = g.photo, k = g.k, cx = R.x + R.w * 0.55, cy = R.y + R.h * 0.5;
    if (key === 'sold') ringStamp(c, cx, cy, Math.min(R.w, R.h) * 0.34, '#B91C1C', up(tx('stampSold')));
    else if (key === 'booked') ringStamp(c, cx, cy, Math.min(R.w, R.h) * 0.27, '#B45309', up(tx('stampBooked')), 'rgba(255,248,235,.55)');
    else if (key === 'just') {                       // repeated outline: the same word again and again, fading downward. Inside the photo area, right edge inside the 3:4 grid strip.
      const t = up(tx('stampJust')), right = Math.min(R.x + R.w - 24, g.W - 50), top = Math.max(R.y + 10, lim && lim.headEnd != null ? lim.headEnd + 12 : 0), leftLim = lim && lim.leftEdge != null && top < lim.lowEnd ? Math.max(R.x, lim.leftEdge) : Math.max(R.x, 30), room = Math.max(60, right - leftLim);
      const fs = D.fit(c, t, (z) => LATIN_H(z, 800), Math.min(R.w * 0.8, room), Math.round(90 * k), 26, 0);
      c.save(); c.font = LATIN_H(fs, 800); c.textAlign = 'right'; c.lineJoin = 'round'; for (let i = 3; i >= 0; i--) { c.globalAlpha = i === 0 ? 1 : 0.5 - i * 0.1; c.lineWidth = i === 0 ? 0 : 3; c.strokeStyle = '#E11B22'; if (i) c.strokeText(t, right, top + fs * 1.0 + i * fs * 0.62); else { c.fillStyle = '#E11B22'; c.fillText(t, right, top + fs * 1.0); } } c.restore();
    } else if (key === 'new') {                      // drawn inside the price box (priceBox), nothing to add here
    } else if (key === 'inspected') {
      const r = Math.round(54 * k), x = R.x + R.w - r - 24, y = R.y + r + 10; c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = '#1F8A4C'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke(); c.restore(); D.icon(c, 'shield', x, y - r * 0.12, r * 1.0, '#fff', 3);
      const t = up(PS.isHi() ? 'जाँच हुई' : 'INSPECTED'), fs = Math.round(r * 0.27); D.T(c, t, x, y + r * 0.62, { font: D.bt(fs, 800), color: '#fff', align: 'center' });
    } else if (STAMPS[key]) {                         // ribbon across the registration card
      const st = STAMPS[key], t = up(tx(st[0])), fs = Math.round(card.h * 0.34), f = D.bt(fs, 800), tr = PS.isHi() ? 0 : 3, w = D.tw(c, t, f, tr) + fs * 1.6, h = fs * 1.8;
      c.save(); c.translate(card.x + card.w / 2, card.y + card.h + 10 + h / 2); c.rotate(-0.03); c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 14; c.shadowOffsetY = 5; c.fillStyle = st[1]; c.fillRect(-w / 2, -h / 2, w, h); c.shadowColor = 'transparent';
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.5; c.strokeRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12); D.T(c, t, 0, fs * 0.36, { font: f, color: '#fff', align: 'center', track: tr }); c.restore();
    }
  }
  const STAMPS = { soon: ['stampSoon', '#2B3990'] };

  /* ---------- the Signature layout: the photo in a rounded frame, or a cut-out car on a showroom stage ---------- */
  // "3 / 7" on a carousel slide, top-right inside the photo slot
  function chip(c, S, R) {
    if (!S._chip) return; const fs = Math.round(Math.max(22, Math.min(30, R.w * 0.032))), f = D.bl(fs, 800), w = D.tw(c, S._chip, f, 1) + fs * 1.4, h = Math.round(fs * 1.9), x = R.x + R.w - w - 22, y = R.y + 22;
    D.fillRR(c, x, y, w, h, h / 2, 'rgba(10,26,58,.84)'); D.T(c, S._chip, x + fs * 0.7, y + h / 2 + fs * 0.34, { font: f, color: '#fff', track: 1 });
  }
  // The 3D cut-out look (photo style 'cut', the default) is used whenever the car has a cut-out: the photo itself is a transparent PNG, or a matching cut-out
  // PNG came with it (assets/cutouts/, "Cut-out PNG" or "Make cut-out"). Photo-forward and Framed keep the photo; a car with no cut-out keeps the photo too.
  function cutOn(S) { const P = S.photos.main, st = S.x.photoStyle || 'cut'; return !!(P && D.cutImg(P) && (st === 'cut' || (P.alpha && st !== 'frame'))); }
  function slot(c, S, R, g) {
    const P = S.photos.main;
    if (cutOn(S)) {                                    // no frame: the car stands on the post's own floor inside R, a cut side runs off the canvas edge
      D.cutCar(c, S, P, { x0: R.x, x1: R.x + R.w, top: R.y, ground: R.y + R.h - Math.round(Math.min(40, R.h * 0.07)), W: g.W, floorEnd: R.y + R.h + 6 });
      chip(c, S, R); D.adjLabel(c, S, R.x + R.w - 10, R.y + R.h + 12, 'right', 0.72); return;
    }
    if (P && P.img && P.alpha) D.stage(c, S, P, R, {}); else D.framePhoto(c, S, P, R, {});
    chip(c, S, R);
    // the honesty label (when the photo is edited) sits small in the frame's bottom-right corner: never over the title block or the spec row
    D.adjLabel(c, S, R.x + R.w - 22, R.y + R.h - 20, 'right', 0.78);
  }
  const photoAspect = (P) => (P && P.img && !P.alpha ? (P.img.naturalWidth || P.img.width) / (P.img.naturalHeight || P.img.height) : 1.5);
  // the biggest frame (white mat included) that fits maxW x maxH with the photo's own aspect, so the car is never cropped by the frame
  function frameFor(P, maxW, maxH, mat) {
    mat = mat == null ? 9 : mat; const ar = photoAspect(P), iw = Math.max(40, Math.min(maxW - 2 * mat, (maxH - 2 * mat) * ar));
    return { w: iw + 2 * mat, h: iw / ar + 2 * mat };
  }
  // The photo-forward post (4:5 and story): the car runs the full width with no frame or mat, rising a little under the title rows and fading into the white ground above
  // and below. R = the band the photo may use, fr = the frame of the Framed style. A car with a cut-out stands on the floor instead (D.cutCar). Drawn BEFORE the text so the text sits on top.
  function bleedSlot(c, S, g, R, fr, carTop, labelY) {
    const P = S.photos.main; S._slots = S._slots || []; S._labels = S._labels || [];
    if (P && P.img && cutOn(S)) {                     // the 3D cut-out: the roof may rise into the title band (carTop) and tucks behind the pill drawn after it
      const ground = R.y + R.h - 26; D.cutCar(c, S, P, { x0: g.m, x1: g.W - g.m, top: carTop != null ? carTop : R.y + 10, ground, W: g.W, floorEnd: ground + 60 });
      chip(c, S, { x: R.x, y: R.y + 24, w: R.w, h: R.h });
      if (carTop == null) D.adjLabel(c, S, g.W - g.m, labelY || R.y + 34, 'right', 0.72);        // the Signature chassis (Price Drop, Guess, Sold, Story): the label sits top-right in the photo band, clear of the text block under it (labelY: the festival layout puts it below its pennants)
      return;
    }
    if (!P || !P.img) {
      S._slots.push({ key: 'main', r: R });
      if (!S.exporting) { c.save(); c.setLineDash([14, 10]); D.strokeRR(c, R.x + 40, R.y + 56, R.w - 80, R.h - 90, 24, '#9AA5BF', 3); c.restore(); D.T(c, 'Add the car photo first', R.x + R.w / 2, R.y + R.h * 0.55, { font: D.bl(38, 700), color: '#6B7898', align: 'center' }); }
      return;
    }
    if (P.alpha) { slot(c, S, fr, g); return; }
    if (P.src === 'stock') S._samplePhoto = true;
    const iw = P.img.naturalWidth || P.img.width, ih = P.img.naturalHeight || P.img.height, ar = iw / ih;
    const minFrac = Math.max(0.6, Math.min(0.99, (1.08 * R.h * ar) / R.w));      // as wide as the band allows, never cropping more than about 8 percent of the height
    let sc = Math.min(R.w / iw, R.h / ih); if (iw * sc < R.w * minFrac) sc = (R.w * minFrac) / iw; sc = Math.min(sc, 1.3); const dw = iw * sc * (P.zoom || 1), side = dw < R.w - 2 ? 70 : 0;
    // the car stands on a surface: a light-grey floor that rises under the bottom of the photo, a faint glow behind the car and a soft contact shadow. The photo's own left and top edges stay nearly hard
    // (only a short fade), its bottom fades into the floor.
    const fy = R.y + R.h * 0.7; c.fillStyle = D.lin(c, 0, fy, 0, R.y + R.h + 6, [[0, 'rgba(206,214,229,0)'], [0.45, 'rgba(206,214,229,.62)'], [0.8, 'rgba(200,209,225,.62)'], [1, 'rgba(206,214,229,0)']]); c.fillRect(R.x, fy, R.w, R.y + R.h + 6 - fy);
    { const gl = c.createRadialGradient(R.x + R.w / 2, R.y + R.h * 0.5, 30, R.x + R.w / 2, R.y + R.h * 0.5, R.w * 0.6); gl.addColorStop(0, 'rgba(255,255,255,.9)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gl; c.fillRect(R.x, R.y, R.w, R.h); }
    { c.save(); c.translate(R.x + R.w / 2, R.y + R.h * 0.9); c.scale(1, 0.1); const sg = c.createRadialGradient(0, 0, 4, 0, 0, R.w * 0.4); sg.addColorStop(0, 'rgba(10,22,51,.34)'); sg.addColorStop(0.6, 'rgba(10,22,51,.12)'); sg.addColorStop(1, 'rgba(10,22,51,0)'); c.fillStyle = sg; c.fillRect(-R.w * 0.45, -R.w * 0.45, R.w * 0.9, R.w * 0.9); c.restore(); }
    const dr = D.photoPlaced(c, S, P, R, { feather: { l: side ? 44 : 0, r: side ? 44 : 0, t: R.h * 0.07, b: R.h * 0.14 }, minFrac, anchorX: 0.5, slackY: 0.5, maxScale: 1.3 });
    S._slots.push({ key: 'main', r: R, dr, mode: 'fill' }); chip(c, S, { x: R.x, y: R.y + 24, w: R.w, h: R.h });
  }
  function framed(c, S, g, v, A, bleed) {
    const P = S.photos.main; let fr, pbx, pby;
    if (g.mode === 'portrait') {                      // the hero layout: wordmark + pill left, PRICE + fuel | gearbox right, the owner's tagline, then the car as wide as the room allows
      const st = fitHero(c, S, g, v), y0 = g.col.y, px = g.W - g.m - g.price.w; pbx = px; pby = y0 + 6;
      const top = y0 + st.rowsH + (st.tag.tag ? st.tag.h : 0), carBottom = g.spec.y - 24, availH = Math.max(120, carBottom - top - 4), f = frameFor(P, g.W - 2 * g.m, availH);
      fr = { x: (g.W - f.w) / 2, y: top + 4 + Math.max(0, availH - f.h) * 0.4, w: f.w, h: f.h };
      if (bleed) { const R = { x: 0, y: top - 44, w: g.W, h: availH + 44 + 20 }; bleedSlot(c, S, g, R, fr, Math.min(top - 44, y0 + st.head.h + 4)); g.photo = R; }
      drawHead(c, S, g, v, A, st.head, g.col.x, y0); if (st.pill.pill) drawLower(c, S, g, v, A, st.pill, g.col.x, y0 + st.head.h);
      priceBox(c, S, g, v, A, pbx, pby, S._priceOpt); if (st.ft.ft) drawLower(c, S, g, v, A, st.ft, px, pby + g.price.h + 16);
      if (st.tag.tag) drawLower(c, S, g, v, A, st.tag, g.col.x, y0 + st.rowsH);
    } else if (g.split) {                             // square: the wordmark takes the full width, the lower block and PRICE sit left of the photo
      const sp = g.split, fx = g.col.x + sp.colW + sp.gap, fw = g.W - g.m - fx, budgetY = g.spec.y - 14 - g.price.h, y0 = g.col.y; g.price = { w: sp.colW, h: g.price.h };
      const st = fitStack(c, S, g, v, { y0, headW: g.W - 2 * g.m, lowW: sp.colW, endMax: budgetY - 4 });
      drawHead(c, S, g, v, A, st.head, g.col.x, y0); const yLow = drawLower(c, S, g, v, A, st.low, g.col.x, st.lowY), availH = g.spec.y - 26 - st.lowY, f = frameFor(P, fw, availH);
      const off = Math.min(Math.max(0, availH - f.h) * 0.5, 70); fr = { x: g.W - g.m - f.w, y: st.lowY + off, w: f.w, h: f.h };
      pbx = g.col.x; pby = Math.min(budgetY, Math.max(fr.y + fr.h - g.price.h, yLow + 4));
      priceBox(c, S, g, v, A, pbx, pby, S._priceOpt);
    } else if (g.mode === 'tall') {                   // story: the title block left, PRICE right, the car as wide as the room allows below them
      const y0 = g.col.y, carBottom = g.spec.y - 22, minCar = 380;
      const st = fitStack(c, S, g, v, { y0, headW: g.fcol.w, lowW: g.fcol.w, endMax: carBottom - 8 - minCar }), yEnd = st.lowY + st.low.h;
      pbx = g.W - g.m - g.price.w; pby = y0 + 8;
      const top = Math.max(yEnd + 6, pby + g.price.h + 22), availH = Math.max(160, carBottom - top), f = frameFor(P, g.W - 2 * g.m, availH);
      fr = { x: (g.W - f.w) / 2, y: top + Math.max(0, availH - f.h) * 0.4, w: f.w, h: f.h };
      if (bleed) { const R = { x: 0, y: top - 36, w: g.W, h: availH + 36 + 18 }; bleedSlot(c, S, g, R, fr, top - 26); g.photo = R; }
      drawHead(c, S, g, v, A, st.head, g.col.x, y0); drawLower(c, S, g, v, A, st.low, g.col.x, st.lowY); priceBox(c, S, g, v, A, pbx, pby, S._priceOpt);
    } else {                                          // 1920 x 1080: title block left, PRICE under it, the car on the right
      const y0 = g.col.y, budgetY = g.spec.y - 14 - g.price.h;
      const st = fitStack(c, S, g, v, { y0, headW: g.fcol.w, lowW: g.fcol.w, endMax: budgetY - 4 });
      drawHead(c, S, g, v, A, st.head, g.col.x, y0); const yEnd = drawLower(c, S, g, v, A, st.low, g.col.x, st.lowY);
      pbx = g.col.x; pby = Math.min(budgetY, Math.max(yEnd, g.fr.y + g.fr.h - g.price.h));
      priceBox(c, S, g, v, A, pbx, pby, S._priceOpt); const f = frameFor(P, g.fr.w, g.fr.h); fr = { x: g.fr.x + g.fr.w - f.w, y: g.fr.y + (g.fr.h - f.h) / 2, w: f.w, h: f.h };
    }
    if (!bleed) { slot(c, S, fr, g); g.photo = fr; }
    return { x: pbx, y: pby, w: g.price.w, h: g.price.h };
  }

  /* ---------- the template ---------- */
  PS.classicListing = function (c, L, S) {
    const { W, H } = L, g = geo(W, H), v = view(S), A = accentOf(S), framedStyle = S.x.photoStyle === 'frame';      // 'frame' = the rounded frame; anything else (the default) = photo-forward
    const bleedB = !framedStyle && (g.mode === 'portrait' || g.mode === 'tall'), fm = framedStyle || bleedB;       // on the square and the landscape the photo-forward look is the soft-edged photo area
    S._priceOpt = null;
    background(c, g);
    if (!fm) photoArea(c, S, g);
    const card = regCard(c, S, g, v, A);
    header(c, S, g, v, A, card);
    let pb, lim = null;
    if (fm) pb = framed(c, S, g, v, A, bleedB);
    else {                                            // Soft edge: the wordmark and the price sit over the feathered photo
      const hdW = g.col.w, budgetY = g.spec.y - 14 - g.price.h, tall = g.mode === 'tall', y0 = g.col.y;
      const st = fitStack(c, S, g, v, { y0, headW: hdW, lowW: hdW, endMax: tall ? 9999 : budgetY - 4 });
      drawHead(c, S, g, v, A, st.head, g.col.x, y0); const yEnd = drawLower(c, S, g, v, A, st.low, g.col.x, st.lowY); lim = { headEnd: y0 + st.head.h, lowEnd: yEnd, leftEdge: g.col.x + Math.max(st.low.pill ? st.low.pill.pw : 0, st.low.ft ? st.low.ft.w : 0) + 24 };
      // price box: right of the title block on the story, else straight under it (never lower than the spec row allows)
      const pbx = tall ? W - g.m - g.price.w : g.col.x, pby = tall ? g.col.y + 8 : Math.min(yEnd, budgetY); priceBox(c, S, g, v, A, pbx, pby); pb = { x: pbx, y: pby, w: g.price.w, h: g.price.h };
      chip(c, S, g.photo);
    }
    specRow(c, S, g, v);
    footerBar(c, S, g, A); menuStrip(c, g);
    if (g.mode === 'tall') bottomSlab(c, S, g, A);
    stamp(c, S, g, card, pb, lim);
    if (cutOn(S) && !framedStyle) D.adjLabel(c, S, W - g.m, g.spec.y + 2, 'right', 0.8);       // the 3D cut-out: smaller and lower, on the floor in front of the car
    else if (!framedStyle || (S.photos.main && S.photos.main.alpha)) D.adjLabel(c, S, W - g.m, g.spec.y - 6, 'right');
  };
  // story: the bottom 340 px sit under Instagram's reply bar. They carry the accent gradient, a chequer rule and the one line that is always true.
  function bottomSlab(c, S, g, A) {
    const y0 = g.menu.y + g.menu.h, W = g.W, H = g.H; c.fillStyle = D.lin(c, 0, y0, 0, H, [[0, A.a], [1, A.b]]); c.fillRect(0, y0, W, H - y0);
    D.chequer(c, 0, y0, W, 14, 7, 'rgba(255,255,255,.28)', 'rgba(0,0,0,0)');
    const t = `${up(PS.COPY.since[0])}  ·  ${up(PS.COPY.loc[0])}`; D.T(c, t, W / 2, y0 + 76, { font: D.bl(30, 700), color: 'rgba(255,255,255,.85)', align: 'center', track: 4 });
  }
  // the carousel (sigcarousel.js) builds its slides from the same parts
  PS.classicGeo = geo; PS.classicView = view;
  PS.classicParts = { geo, view, accentOf, background, header, regCard, footerBar, menuStrip, priceBox, specRow, chip, framed, slot, bleedSlot, bottomSlab, frameFor, textCol, INK, GREY, RING, LATIN_H, hf, up, lockup, cutOn };
})();
