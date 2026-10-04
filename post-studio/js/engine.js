/* Classic Auto Post Studio — state, render pipeline, export. */
(function () {
  'use strict';
  const PS = window.PS, D = PS.D;

  PS.fontsReady = null;
  PS.loadFonts = function () {
    if (PS.fontsReady) return PS.fontsReady;
    const f = document.fonts;
    PS.fontsReady = Promise.all([
      f.load('400 100px "Bebas Neue"', '₹ABC123'), f.load('600 40px Manrope', '₹abc'), f.load('700 40px Manrope', '₹abc'), f.load('800 40px Manrope', '₹abc'),
      f.load('600 40px "Noto Sans Devanagari"', 'हिंदी ₹'), f.load('700 40px "Noto Sans Devanagari"', 'हिंदी'), f.load('800 40px "Noto Sans Devanagari"', 'हिंदी'), f.load('italic 400 60px "Instrument Serif"', 'Abc'), D.logoReady
    ]).catch(() => null);
    return PS.fontsReady;
  };

  PS.XF = PS.XF || {};
  PS.newState = function () {
    const S = {
      tpl: 'newarrival', size: '1080x1350', lang: PS.settings.lang || 'en',
      car: Object.assign({}, PS.SEED_CARS[0]), photos: { main: null, second: null, hero: null },
      badges: ['just_arrived'], ctaMap: {}, x: {}, touched: {}, garage: [], carousel: { ids: [] }, slide: 0, exporting: false
    };
    delete S.car.photo; return S;
  };
  // fill template-specific defaults (never overwrite what the user typed)
  const LI = { en: 0, hn: 1, hi: 2 };
  PS.fieldDefault = function (k, lang) { const d = PS.XF[k]; if (!d) return ''; if (d.defs) return d.defs[LI[lang || PS.lang] || 0]; return d.def === undefined ? '' : d.def; };
  PS.applyTemplateDefaults = function (S, t) {
    S.touched = S.touched || {};
    (t.x || []).forEach((k) => { if (S.x[k] === undefined && PS.XF[k]) S.x[k] = PS.fieldDefault(k, S.lang); });
  };
  // when the language changes, text fields the owner has not touched follow it (Hindi Hiring shows Hindi defaults)
  PS.followLanguage = function (S, t) {
    S.touched = S.touched || {};
    (t.x || []).forEach((k) => { if (PS.XF[k] && PS.XF[k].defs && !S.touched[k]) S.x[k] = PS.fieldDefault(k, S.lang); });
  };
  // the two garage cars whose number plate is readable start with it blurred (labelled on the post)
  PS.hydrateCar = async function (car) {
    if (car.photoObj || !car.photo) return car;
    try { car.photoObj = PS.newPhoto(await PS.loadImage(car.photo), car.photo.split('/').pop(), car.photoSrc || 'own'); if (car.plateBox) car.photoObj.plate = Object.assign({}, car.plateBox); } catch (e) { /* missing photo is allowed */ }
    // its cut-out (the car alone, transparent background, the photo's own size): assets/cutouts/<same name>.png, made by tools/make_cutouts.py
    const cp = car.cutout || (/^assets\/cars\/[\w.-]+\.(jpe?g|png|webp)$/i.test(car.photo) ? car.photo.replace('assets/cars/', 'assets/cutouts/').replace(/\.\w+$/, '.png') : '');
    if (cp && car.photoObj) try { car.photoObj.cut = await PS.loadImage(cp); } catch (e) { /* no cut-out: the photo layout is used */ }
    return car;
  };

  PS.parseSize = (s) => s.split('x').map(Number);
  // a template tells the owner when it had to shrink or hide something to make the text fit (shown under the preview; never printed on the post)
  PS.note = function (S, msg) { if (S && S._notes && !S._notes.includes(msg)) S._notes.push(msg); };

  /* draw the current template onto ctx at logical size W x H (caller sets any scale transform) */
  PS.drawTemplate = function (c, S, tplId, size) {
    const t = PS.TPL[tplId || S.tpl], [W, H] = PS.parseSize(size || S.size);
    PS.lang = S.lang; S._slots = []; S._labels = []; S._notes = []; S._adjDrawn = false; S._demo = false; S._samplePhoto = false; S._H = H; S._W = W; S._tplId = tplId || S.tpl;
    const L = PS.layout(W, H);
    c.save(); c.clearRect(0, 0, W, H);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    PS._deva = S.lang !== 'hi' && PS.hasDevaInput(S);
    try { t.render(c, L, S); } finally { PS._deva = false; }
    if (S._demo) PS.D.sampleStamp(c, W, H);       // any render that still holds the demo customer text is stamped
    else if (S._samplePhoto) PS.D.sampleStamp(c, W, H, 'SAMPLE PHOTO · NOT OUR CAR');
    if (!S.exporting && S._tplId === 'pricedrop' && !PS.validDrop(S.car)) PS.D.sampleStamp(c, W, H, 'ADD AN OLD PRICE · PREVIEW ONLY');       // a Price Drop with no old price above the price is only a draft: it says so on the preview, and the export is refused
    c.restore();
    return L;
  };
  // paint into a canvas at a display scale (scale 1 = exact export pixels)
  PS.renderTo = function (canvas, S, o) {
    o = o || {}; const [W, H] = PS.parseSize(o.size || S.size), sc = o.scale || 1;
    canvas.width = Math.round(W * sc); canvas.height = Math.round(H * sc);
    const c = canvas.getContext('2d'); c.setTransform(sc, 0, 0, sc, 0, 0);
    const prev = S.exporting; S.exporting = !!o.exporting;
    const L = PS.drawTemplate(c, S, o.tpl, o.size);
    S.exporting = prev; return L;
  };
  // one frame of the motion export at progress t (0..1). Deterministic: the same inputs always give the same pixels.
  PS.renderFrame = function (S, o) {
    const cv = document.createElement('canvas'); S._t = o.t;
    try { PS.renderTo(cv, S, { exporting: true, size: o.size, tpl: o.tpl }); } finally { S._t = null; } return cv;
  };
  PS.exportBlob = function (S, o) {
    o = o || {}; const type = o.type === 'jpg' ? 'image/jpeg' : 'image/png';
    const cv = document.createElement('canvas');
    PS.renderTo(cv, S, { exporting: true, size: o.size, tpl: o.tpl });
    return new Promise((res) => cv.toBlob(res, type, 0.93));
  };
  /* what a render would contain, without keeping it: flags set while drawing (sample photo, demo customer text) */
  PS.probe = function (S, tplId, size) {
    const id = tplId || S.tpl, t = PS.TPL[id]; if (!t) return { samplePhoto: false, labels: [] };
    const cv = PS._probeCv || (PS._probeCv = document.createElement('canvas')), prev = S.exporting, ps = [S._slots, S._labels, S._demo, S._samplePhoto, S._H, S._W, S._tplId];
    const sz = size || S.size, [W, H] = PS.parseSize(sz); cv.width = Math.max(2, Math.round(W * 0.02)); cv.height = Math.max(2, Math.round(H * 0.02));
    const c = cv.getContext('2d'); c.setTransform(0.02, 0, 0, 0.02, 0, 0); S.exporting = true;
    try { PS.drawTemplate(c, S, id, sz); } catch (e) { /* a broken render is reported by the real render */ }
    const out = { samplePhoto: !!S._samplePhoto, labels: (S._labels || []).slice() };
    S.exporting = prev; [S._slots, S._labels, S._demo, S._samplePhoto, S._H, S._W, S._tplId] = ps; return out;
  };

  /* ---------- file names: CA-<stock>-#<NN>-<concept>_<WxH>.<ext>. NN counts exports per stock id on this device. ---------- */
  const CNT_KEY = 'ca-post-studio-counters';
  const readCounters = () => { try { return JSON.parse(localStorage.getItem(CNT_KEY) || '{}'); } catch (e) { return {}; } };
  PS.stockPart = function (S, tplId) {
    const t = PS.TPL[tplId || S.tpl]; if (!t) return 'CA-brand';
    if (t.car && !t.carousel) { const id = String(S.car.id || '').trim(); if (id) return /^CA-/i.test(id) ? id.toUpperCase() : 'CA-' + PS.slug(id); return 'CA-' + (PS.slug([S.car.make, S.car.model, S.car.year].filter(Boolean).join(' ')) || 'car'); }
    return t.carousel ? 'CA-weekly' : t.fest ? 'CA-greeting' : 'CA-brand';
  };
  PS.nextNumber = (stock) => (readCounters()[stock] || 0) + 1;
  PS.commitNumber = function (stock) { const c = readCounters(); c[stock] = (c[stock] || 0) + 1; try { localStorage.setItem(CNT_KEY, JSON.stringify(c)); } catch (e) { /* private mode: numbers restart */ } return c[stock]; };
  PS.concept = function (S, o) {
    o = o || {}; const t = PS.TPL[o.tpl || S.tpl]; let mid = '';
    if (t.fest) mid = '-' + (S.x.festival || 'diwali');
    if (t.sub) { const sg = PS.slug(S.x[t.sub] || ''); if (sg) mid += '-' + sg; }
    let slide = '';
    if (t.carousel) { const n = PS.slideCount(S), i = (o.slide != null ? o.slide : S.slide || 0), sk = PS.slideKind(S, i); slide = `_${String(i + 1).padStart(2, '0')}-of-${String(n).padStart(2, '0')}_${sk.kind === 'car' ? PS.slug(sk.car.model) : sk.kind}`; }
    return `${t.file}${mid}${slide}`;
  };
  PS.fileName = function (S, o) {
    o = o || {}; const id = o.tpl || S.tpl, size = o.size || S.size, ext = o.type === 'jpg' ? 'jpg' : 'png';
    const stock = o.stock || PS.stockPart(S, id), nn = String(o.nn || PS.nextNumber(stock)).padStart(2, '0');
    const sample = PS.isDemoCustomer(S, id) || PS.probe(S, id, size).samplePhoto ? '_SAMPLE' : '';   // a demo render can never be mistaken for a postable file
    return `${stock}-#${nn}-${PS.concept(S, o)}_${size}${sample}.${ext}`;
  };
  // one line per file for a ZIP's manifest.json
  PS.contactState = () => { const k = PS.contact(); return k.hasPhone ? 'phone' : k.hasWa ? 'whatsapp' : 'dm'; };
  PS.manifestEntry = function (S, o) {
    o = o || {}; const id = o.tpl || S.tpl, t = PS.TPL[id], car = S.car || {}, pr = PS.parseMoney(car.price), pb = PS.probe(S, id, o.size || S.size);
    const P = t.heroPhoto ? S.photos.hero : t.photoKey ? S.photos[t.photoKey] : S.photos.main, src = P && P.img ? P.src : 'none';
    return { file: o.file, concept: PS.concept(S, o), template: id, language: S.lang, size: o.size || S.size, stock: PS.stockPart(S, id),
      price_shown: t.car && isFinite(pr) && pr > 0 ? PS.priceText(pr) : null, exported: PS.toISODate(PS.today()),
      photo_provenance: src, photo_provenance_label: PS.PHOTO_SRC_LABEL[src] || '', edits: pb.labels, contact_state: PS.contactState() };
  };
  PS.needsConsent = function (S, tplId) {
    const t = PS.TPL[tplId || S.tpl]; if (!t.consent) return false;
    if (t.id === 'sold' && S.x.soldKind === 'sold') return false;
    return !S.x[t.consent];
  };
  /* ---------- customer content: no invented customers ---------- */
  // Demo text the preview falls back on while the real customer fields are blank. Never postable: stamped SAMPLE and export is blocked.
  PS.DEMO = { custName: 'Rahul', tName: 'Priya S.', tQuote: 'They explained every paper and never pushed me. We drove home happy.', tCar: 'Honda City, 2020', custQuote: 'Smooth process, honest people.' };
  PS.CUSTOMER_REQ = { sold: ['custName'], testimonial: ['tName', 'tQuote'] };         // must be real
  PS.CUSTOMER_OPT = { sold: ['custQuote'], testimonial: ['tCar'] };                     // may be blank, but never the demo text
  // text for a customer field. Blank or demo text on a required field returns the demo text and marks the render as a sample.
  PS.val = function (S, key) {
    const v = String(S.x[key] || '').trim(), demo = PS.DEMO[key];
    if (!v || v === demo) { if ((v === demo && demo) || (PS.CUSTOMER_REQ[S._tplId || S.tpl] || []).includes(key)) { S._demo = true; return demo; } }
    return v;
  };
  PS.isDemoCustomer = function (S, tplId) {
    const id = tplId || S.tpl, t = PS.TPL[id]; if (!t || !t.consent) return false;
    if (id === 'sold' && S.x.soldKind === 'sold') return false;
    const val = (k) => String(S.x[k] || '').trim();
    return (PS.CUSTOMER_REQ[id] || []).some((k) => !val(k) || val(k) === PS.DEMO[k]) || (PS.CUSTOMER_OPT[id] || []).some((k) => val(k) && val(k) === PS.DEMO[k]);
  };
  // a Price Drop is only honest when the old price is really higher than the price (the same rule batch uses)
  PS.validDrop = (car) => { const o = PS.parseMoney(car.oldPrice), n = PS.parseMoney(car.price); return o > n && n > 0; };
  // why this post cannot be exported yet ('' when it can)
  PS.exportIssue = function (S, tplId) {
    const id = tplId || S.tpl, t = PS.TPL[id];
    if (PS.needsConsent(S, id)) return 'consent';
    if (PS.isDemoCustomer(S, id)) return 'demo';
    if (id === 'pricedrop' && !PS.validDrop(S.car)) return 'nodrop';
    if (id === 'finance' && !(PS.parseMoney(S.car.price) > 0)) return 'noprice';
    if (t && t.car && !t.carousel && id !== 'receipt' && id !== 'finance' && !(S.photos.main && S.photos.main.img)) return 'nophoto';      // a car post never goes out without the car's own photo (a blank car starts with none)
    if (id === 'hiring' && !String(S.x.hireRole || '').trim()) return 'norole';
    if (id === 'festival' && S.x.festLayout === 'car') {          // Greeting + car needs the car: its photo and its name
      if (!(S.photos.main && S.photos.main.img)) return 'nophoto';
      if (!String([S.car.make, S.car.model].filter(Boolean).join('')).trim()) return 'nocar';
    }
    if (t && t.issue) { const r = t.issue(S); if (r) return r; }
    if (PS.probe(S, id).samplePhoto) return 'samplephoto';
    return '';
  };
})();
