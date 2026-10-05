/* Classic Auto Post Studio — UI: library, stage, inspector, grid preview, export, batch, calendar, brand kit. */
(function () {
  'use strict';
  const PS = window.PS, B = PS.B;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((k) => { if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k)); });
    return e;
  };
  let S, rafId = 0, thumbTimer = 0, varMode = false, varSets = [], gridMode = false, safeOn = false, activeTab = 'content', plateMode = false;
  const FIELDS = ['make', 'model', 'variant', 'year', 'kms', 'fuel', 'trans', 'owners', 'price', 'oldPrice', 'colour', 'insurance'];
  const BADGE_TPLS = ['newarrival', 'pricedrop', 'story'];

  /* ---------- toast + download ---------- */
  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); }
  function download(blob, name) { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }

  /* ---------- state helpers ---------- */
  const tpl = () => PS.TPL[S.tpl];
  function carSansPhoto(c) { const o = Object.assign({}, c); delete o.photoObj; delete o.photo; return o; }
  // the details a stock car was loaded with. After the photo is swapped, any of these still unchanged may belong to the OLD car.
  const IDENT = ['make', 'model', 'variant', 'year', 'price', 'kms', 'owners', 'fuel', 'trans', 'trans_detail', 'colour', 'reg_month', 'rto', 'seats', 'insurance_until', 'insurance_type', 'insurance'];
  const IDENT_LABEL = { make: 'make', model: 'model', variant: 'variant', year: 'year', price: 'price', kms: 'kms', owners: 'owners', fuel: 'fuel', trans: 'transmission', trans_detail: 'gearbox type', colour: 'colour', reg_month: 'registration month', rto: 'RTO code', seats: 'seats', insurance_until: 'insurance date', insurance_type: 'insurance type', insurance: 'insurance' };
  function loadCar(car) {
    dropConsents();      // a tick belongs to one customer and one photo: a different car or photo is a new post
    S.car = carSansPhoto(car); S.photos.main = car.photoObj ? Object.assign({}, car.photoObj) : null; S.photoReplaced = false; S.demoAck = false; S.specAck = false;
    S.loadedFrom = {}; IDENT.forEach((k) => { S.loadedFrom[k] = String(S.car[k] == null ? '' : S.car[k]); });
  }
  // a post that prints the loaded car's details: every car template, and the Festival greeting when its layout is 'Greeting + car'
  const carPost = () => !!tpl().car || (S.tpl === 'festival' && S.x.festLayout === 'car');
  // fields that still hold the loaded car's values after its photo was replaced
  function staleFields() {
    if (!S.photoReplaced || S.demoAck || !carPost() || !S.loadedFrom) return [];
    return IDENT.filter((k) => S.loadedFrom[k] !== '' && String(S.car[k] == null ? '' : S.car[k]) === S.loadedFrom[k]);
  }
  // a blank car has no photo yet: the old car's photo must never stay under a new car's details
  function blankCar() { dropConsents(); S.photos.main = null; S.photos.second = null; const keep = { status: 'available', notes: '', segment: 'owned' }; S.car = Object.assign({ id: '' }, keep); IDENT.forEach((k) => { S.car[k] = ''; }); S.car.reg_city = ''; S.demoAck = true; S.specAck = false; S.photoReplaced = false; S.loadedFrom = null; }
  function targetPhoto(create) {
    const t = tpl();
    if (t.carousel) { const sk = PS.slideKind(S, S.slide); if (sk.kind === 'car') { const car = sk.car; return car.photoObj || (create ? (car.photoObj = PS.newPhoto(null)) : null); } return null; }
    if (t.heroPhoto) return S.photos.hero || (create ? (S.photos.hero = PS.newPhoto(null)) : null);
    if (t.photoKey) return S.photos[t.photoKey] || (create ? (S.photos[t.photoKey] = PS.newPhoto(null)) : null);
    return S.photos.main || (create ? (S.photos.main = PS.newPhoto(null)) : null);
  }

  /* ---------- consent belongs to one customer: any change of the customer's photo, name or words clears it ---------- */
  // each customer post has its own consent: editing the Testimonial never clears the Delivered tick, and the other way round (F-17)
  const CONSENT_OF = { custName: 'consentSold', custQuote: 'consentSold', second: 'consentSold', tName: 'consentTesti', tQuote: 'consentTesti', tCar: 'consentTesti' };
  const CUSTOMER_KEYS = Object.keys(CONSENT_OF).filter((k) => k !== 'second');
  // clears the Sold and the Testimonial consent ticks whatever template is open (the car or the shared photo changed)
  function dropConsents() {
    if (!S) return; let n = 0; ['consentSold', 'consentTesti'].forEach((ck) => { if (S.x[ck]) { S.x[ck] = false; n++; } });
    $$('input[data-consent]').forEach((i) => { i.checked = false; }); if (n) { toast('Consent cleared. Tick it again for this customer.'); syncNotes(); }
  }
  function resetConsent(key) {
    const ck = key === 'photo' ? (S.tpl === 'testimonial' ? 'consentTesti' : S.tpl === 'sold' ? 'consentSold' : null) : CONSENT_OF[key];      // the Sold tick is about the delivered-car photo too
    if (ck && S.x[ck]) { S.x[ck] = false; $$(`input[data-consent="${ck}"]`).forEach((i) => { i.checked = false; }); toast('Consent cleared. Tick it again for this customer.'); }
    syncNotes();
  }
  const demoCarPending = () => staleFields().length > 0;
  // the stock row this post's car came from (same id in the Garage). The post's price must match it.
  const stockRow = () => { const id = String(S.car.id || '').trim(); return id ? S.garage.find((g) => g.id === id) : null; };
  const priceMismatch = () => { const r = stockRow(); if (!r || !tpl().car || S.priceAck === S.car.price) return null; const a = PS.parseMoney(S.car.price), b = PS.parseMoney(r.price); return isFinite(a) && isFinite(b) && Math.round(a) !== Math.round(b) ? { post: a, stock: b, row: r } : null; };

  /* ---------- library ---------- */
  function buildLibrary() {
    const list = $('#libList'); list.innerHTML = ''; let group = '';
    const GROUPS = ['Cars', 'More car layouts', 'Greetings', 'Trust', 'Banners', 'Reel tools'], gi = (t) => { const i = GROUPS.indexOf(t.group); return i < 0 ? 99 : i; };
    PS.TEMPLATES.map((t, i) => [t, i]).sort((a, b) => gi(a[0]) - gi(b[0]) || a[1] - b[1]).map((e) => e[0]).forEach((t) => {
      if (t.group !== group) { group = t.group; list.append(h('div', { class: 'lib-group', text: group })); }
      const cv = h('canvas', { width: 124, height: 124, 'aria-hidden': 'true' });
      const b = h('button', { class: 'tpl', type: 'button', 'data-id': t.id, 'aria-pressed': 'false', onclick: () => setTemplate(t.id) },
        h('span', { class: 'th' }, cv), h('span', {}, h('b', { text: t.name }), h('small', { text: t.def.replace('x', ' × ') })));
      list.append(b);
    });
  }
  function thumbState(t) {
    const T = Object.assign({}, S, { tpl: t.id, x: Object.assign({}, S.x), badges: (t.badges || []).slice(), slide: 0, exporting: true });
    PS.applyTemplateDefaults(T, t);
    if (t.id === 'festival') { T.x.festival = S.tpl === 'festival' ? S.x.festival : 'diwali'; }
    if (t.id === 'sold') { T.x.soldKind = 'delivered'; }
    return T;
  }
  function renderThumbs() {
    const items = PS.TEMPLATES.slice(); let i = 0;
    const step = () => {
      const t = items[i++]; if (!t) return;
      const cv = $(`.tpl[data-id="${t.id}"] canvas`);
      if (cv) { const [W, H] = PS.parseSize(t.def); try { PS.renderTo(cv, thumbState(t), { size: t.def, scale: 124 / Math.max(W, H), exporting: true }); } catch (e) { console.error(e); } }
      setTimeout(step, 0);
    };
    step();
  }
  function scheduleThumbs() { clearTimeout(thumbTimer); thumbTimer = setTimeout(() => { const lang = S.lang; renderThumbs(); }, 700); }

  /* ---------- template switching ---------- */
  // the Festival greeting is greeting-only until the owner chooses to add a car. A festival that does not take a car always falls back to the greeting.
  function autoFestLayout() { if (S.tpl !== 'festival') return; const fe = PS.FESTIVALS[S.x.festival || 'diwali']; if (!fe || !fe.tie) S.x.festLayout = 'greeting'; }
  function setTemplate(id, keepSize) {
    const t = PS.TPL[id]; S.tpl = id;
    S.size = keepSize && t.sizes.includes(S.size) ? S.size : t.def;
    PS.applyTemplateDefaults(S, t); autoFestLayout();
    S.slide = 0; capVer = 0;
    if (!S.badgesTouched) S.badges = (t.badges || []).slice();
    $$('.tpl').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
    $('#libCur').textContent = t.name; $('.lib').classList.remove('open'); $('#libBtn').setAttribute('aria-expanded', 'false');
    buildSizeSeg(); buildContent(); buildPhoto(); buildCaption(); buildGarage(); buildSlidebar();
    render(); updateNotices(); updateApprove(); updateExportButtons();
  }
  function setSize(sz) { S.size = sz; $$('#sizeSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === sz))); const sel = $('#sizeSel'); if (sel) sel.value = sz; render(); }
  function buildSizeSeg() {
    const seg = $('#sizeSeg'); seg.innerHTML = '';
    tpl().sizes.forEach((sz) => seg.append(h('button', { type: 'button', 'data-size': sz, 'aria-pressed': String(sz === S.size), title: PS.SIZE_LABEL[sz] || '', onclick: () => setSize(sz) }, sz.replace('x', '×'), sz === '1080x1350' ? h('small', { class: 'safe-tag', text: ' · grid-safe' }) : null)));
    const sel = $('#sizeSel'); if (sel) { sel.innerHTML = ''; tpl().sizes.forEach((sz) => sel.append(h('option', { value: sz, selected: sz === S.size, text: `${PS.SIZE_SHORT[sz] || ''} · ${sz.replace('x', '×')}`.replace(/^ · /, '') }))); }
  }

  /* ---------- inspector: content ---------- */
  function inp(label, get, set, o) {
    o = o || {}; const id = 'f_' + Math.random().toString(36).slice(2, 8);
    let el;
    if (o.type === 'select') el = h('select', { id }, o.options.map((p) => h('option', { value: p[0], text: p[1], selected: String(get()) === String(p[0]) })));
    else if (o.type === 'textarea') el = h('textarea', { id, rows: o.rows || 3, placeholder: o.ph || '' }, get() || '');
    else el = h('input', { id, type: o.type === 'number' ? 'number' : o.type === 'tel' ? 'tel' : 'text', value: get() == null ? '' : get(), placeholder: o.ph || '', min: o.min, max: o.max, step: o.step, inputmode: o.type === 'number' ? 'decimal' : null, autocomplete: 'off', list: o.list ? id + 'l' : null });
    el.addEventListener(o.type === 'select' ? 'change' : 'input', () => { set(o.type === 'number' && !o.text ? (el.value === '' ? '' : +el.value) : el.value); changed(); });
    const wrap = h('label', { class: 'f' + (o.full ? ' full' : ''), for: id }, h('span', { class: 'lbl', text: label }), el);
    if (o.list) wrap.append(h('datalist', { id: id + 'l' }, o.list.map((v) => h('option', { value: v }))));
    return wrap;
  }
  function chk(label, get, set, attrs) {
    const el = h('input', Object.assign({ type: 'checkbox' }, attrs || {})); el.checked = !!get();
    el.addEventListener('change', () => { set(el.checked); changed(); });
    return h('label', { class: 'chk' }, el, h('span', { text: label }));
  }
  // the look controls (style, frame, accent, header line) stay out of the way of the daily fields
  const ADVANCED_X = ['listStyle', 'carStyle', 'photoStyle', 'accent', 'luxury'];
  const MORE_KEY = 'ca-post-studio-more';
  // a collapsed group. It remembers whether the person keeps it open (per browser).
  function disclose(title, body) {
    let open = false; try { open = localStorage.getItem(MORE_KEY) === '1'; } catch (e) { /* private mode */ }
    const d = h('details', { class: 'more' }, h('summary', { text: title }), body); if (open) d.open = true;
    d.addEventListener('toggle', () => { try { localStorage.setItem(MORE_KEY, d.open ? '1' : '0'); } catch (e) { /* ignore */ } });
    return d;
  }
  // the cars of the garage as pictures: tap one to put it on the post. "Add a new car" starts a blank one.
  function carPicker() {
    const row = h('div', { class: 'picker', role: 'group', 'aria-label': 'Choose a car' });
    S.garage.forEach((car) => {
      const on = S.car && S.car.id === car.id, name = [car.year, car.make, car.model].filter(Boolean).join(' ');
      const img = h('img', { alt: '', src: car.photoObj && car.photoObj.img ? car.photoObj.img.src : 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' });
      row.append(h('button', { type: 'button', class: 'pick', 'aria-pressed': String(on), title: name, onclick: () => { loadCar(car); buildContent(); buildPhoto(); changed(); toast(name + ' is on the post'); } }, img, h('span', { text: [car.make, car.model].filter(Boolean).join(' ') || 'Car' })));
    });
    return h('div', { class: 'group' }, h('h3', { text: 'Which car is this post for?' }), row,
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { blankCar(); buildContent(); changed(); toast('A blank car. Type its details, then add its photo.'); } }, 'Add a new car')));
  }
  function buildContent() {
    const p = $('#p-content'); p.innerHTML = ''; const t = tpl();
    if (t.consent) {
      p.append(h('div', { class: 'note', id: 'consentNote', text: 'This post shows a customer. Tick the consent box below before you export.', hidden: !PS.needsConsent(S) }));
      p.append(h('div', { class: 'note', id: 'demoNote', text: 'The name and words on the preview are sample text, so the post is stamped SAMPLE and cannot be exported. Type the real customer’s details below.', hidden: !PS.isDemoCustomer(S) }));
    }
    if (t.note) p.append(h('div', { class: 'note', text: t.note }));
    if (t.id === 'reelcover') {
      const li = { en: 0, hn: 1, hi: 2 }[S.lang] || 0, chips = h('div', { class: 'chips' });
      PS.HOOKS.forEach((k) => chips.append(h('button', { class: 'chip', type: 'button', title: `Reel format ${k.fmt}`, 'aria-pressed': String((S.x.reelTitle || '') === k.t[li]), onclick: () => { S.x.reelTitle = k.t[li]; S.x.reelPrice = k.price; S.touched = S.touched || {}; S.touched.reelTitle = true; buildContent(); changed(); } }, k.t[li])));
      p.append(h('div', { class: 'group' }, h('h3', { text: 'Hook ideas (first 3 seconds)' }), chips, h('p', { class: 'help', text: 'Hook first: the cover opens on the words that make people stay. Price games hide the price on the cover; show it in the last frame of the video. Real prices only.' })));
    }
    if (t.car && !t.carousel) {
      p.append(carPicker());
      const lite = t.carLite, g = h('div', { class: 'g2' }), gm = h('div', { class: 'g2' });
      const C = S.car, add = (k, label, o, to) => (to || g).append(inp(label, () => C[k], (v) => { C[k] = v; }, o));
      add('make', 'Make', { ph: 'e.g. Hyundai' }); add('model', 'Model', { ph: 'e.g. Creta' });
      add('variant', 'Variant', { ph: 'e.g. SX (O) 1.5 Diesel AT', full: true }); add('year', 'Year', { type: 'number', min: 1980, max: 2030, ph: 'e.g. 2022' });
      add('price', 'Price', { type: 'text', ph: 'e.g. 15.5L or 1550000' });
      g.append(h('div', { class: 'full pricepv', id: 'pricepv' }));
      if (!lite) {
        add('kms', 'Kms driven', { type: 'number', min: 0, ph: 'e.g. 24400' }); add('owners', 'Owners', { type: 'number', min: 1, max: 9, ph: 'e.g. 1' });
        add('fuel', 'Fuel', { type: 'select', options: [['', 'Select'], ['Petrol', 'Petrol'], ['Diesel', 'Diesel'], ['CNG', 'CNG'], ['Electric', 'Electric'], ['Hybrid', 'Hybrid']] });
        add('trans', 'Gearbox', { type: 'select', options: [['', 'Select'], ['Manual', 'Manual'], ['Automatic', 'Automatic']] });
        if (t.id === 'pricedrop') { add('oldPrice', 'Old price', { type: 'text', ph: 'e.g. 16.25L' }); g.append(h('div', { class: 'full help', id: 'dropNote', style: 'margin:0' })); }
        add('colour', 'Colour', { ph: 'e.g. White' }, gm); add('seats', 'Seats', { type: 'number', min: 2, max: 9, ph: 'e.g. 5' }, gm);
        add('reg_month', 'Registered in (month and year)', { ph: 'e.g. Apr 2025' }, gm); add('rto', 'Registration code (state and RTO)', { ph: 'e.g. MH43' }, gm);
        add('insurance_until', 'Insurance valid till', { ph: 'e.g. 22 Apr 2028' }, gm); add('insurance_type', 'Insurance type', { ph: 'e.g. Zero-dep or Comprehensive' }, gm);
        add('insurance', 'Insurance note (only if there is no date)', { ph: 'e.g. Expired', full: true }, gm);
      }
      g.append(h('p', { class: 'full help', id: 'specHint', style: 'margin:0', hidden: true }));
      p.append(h('div', { class: 'group' }, h('h3', { text: 'Car' }), g));
      if (!lite) p.append(disclose('More details: colour, registration, insurance', gm));
      if (BADGE_TPLS.includes(t.id) && !(t.id === 'newarrival' && S.x.listStyle !== 'navy')) {
        const chips = h('div', { class: 'chips' });
        PS.BADGES.forEach(([id, key]) => chips.append(h('button', { class: 'chip', type: 'button', 'aria-pressed': String(S.badges.includes(id)), onclick: (e) => {
          const on = !S.badges.includes(id); S.badges = on ? [...S.badges, id].slice(-2) : S.badges.filter((b) => b !== id); S.badgesTouched = true;
          $$('.chip', chips).forEach((c, i) => c.setAttribute('aria-pressed', String(S.badges.includes(PS.BADGES[i][0])))); changed();
        } }, PS.COPY[key][0])));
        p.append(h('div', { class: 'group' }, h('h3', { text: 'Chips' }), chips, h('p', { class: 'help', text: 'Up to two small tags on the post, such as Just arrived or Low KMs.' })));
      }
    }
    if (t.carousel) {
      const n = PS.carSlides(S).length;
      p.append(h('div', { class: 'group' }, h('h3', { text: 'Slides' }), h('p', { class: 'help', text: `${n} car${n === 1 ? '' : 's'} in this carousel, plus the cover and the closing slide. Choose cars in the Garage tab.` }), h('button', { class: 'btn', type: 'button', onclick: () => selectTab('garage') }, 'Choose cars')));
    }
    if ((t.x || []).length) {
      const g = h('div', { class: 'g2' }), ga = h('div', { class: 'g2' });
      t.x.forEach((k) => {
        const d = PS.XF[k]; if (!d) return;
        const dest = ADVANCED_X.includes(k) ? ga : g;
        if (k === 'festYear' && S.x.festival !== 'newyear') return;                 // the year only means something on the New Year greeting
        if (k === 'festLayout') {                                                    // an explicit choice, never a default: the greeting, or the greeting with a car under it
          const fe = PS.FESTIVALS[S.x.festival || 'diwali'];
          const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Layout' }, [['greeting', 'Greeting only'], ['car', 'Greeting + car']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String((S.x.festLayout || 'greeting') === v), disabled: v === 'car' && !fe.tie, onclick: () => { S.x.festLayout = v; S.touched = S.touched || {}; S.touched.festLayout = true; buildContent(); changed(); } }, l)));
          g.append(h('div', { class: 'f full' }, h('span', { class: 'lbl', text: 'Layout' }), seg)); return;
        }
        if (d.type === 'check') { const c = chk(d.label, () => S.x[k], (v) => { S.x[k] = v; syncNotes(); }, { 'data-consent': k }); c.classList.add('full'); dest.append(c); return; }
        const o = { type: d.type, ph: k === 'festDate' ? 'Optional. Leave blank to print no date.' : d.ph, options: d.options, min: d.min, max: d.max, step: d.step, list: d.list, full: d.type === 'textarea' || d.type === 'text' };
        const f = inp(d.label, () => S.x[k], (v) => {
          S.x[k] = v;
          S.touched = S.touched || {}; S.touched[k] = true;
          if (CUSTOMER_KEYS.includes(k)) resetConsent(k);
          if (k === 'festival') { S.x.festDate = PS.FESTIVALS[v].d; S.x.festWish = ''; autoFestLayout(); buildContent(); }
          if (k === 'listStyle') buildContent();
        }, o);
        dest.append(f);
      });
      if (t.id === 'festival') {
        const fe = PS.FESTIVALS[S.x.festival || 'diwali'];
        g.append(h('p', { class: 'full help', style: 'margin:0', text: (fe.tie ? 'Greeting + car adds a real car photo (Photo tab) and a line that ties the day to a car purchase.' : 'This festival keeps the greeting layout only. Selling on it would feel out of place.') + (fe.hint ? ` Planner date, not printed: ${fe.hint}.` : '') }));
      }
      p.append(h('div', { class: 'group' }, h('h3', { text: t.name }), g));
      if (ga.children.length) p.append(disclose('Advanced: look, photo style, header line', ga));
    }
    if (!t.noCta && !(t.classic && S.x.listStyle !== 'navy')) {
      const cnt = h('p', { class: 'help', id: 'ctaCount' }), upd = () => { const n = ((S.ctaMap || {})[S.tpl] || '').length; cnt.textContent = n ? `${n} characters. The footer fits about 60 over two lines; longer text is shortened with …. Applies to this template only.` : 'Applies to this template only. Leave blank for the default.'; };
      S.ctaMap = S.ctaMap || {};
      p.append(h('div', { class: 'group' }, h('h3', { text: 'Call to action' }), inp(['sell', 'wastatus', 'story', 'carousel', 'pricedrop', 'guess', 'sold'].includes(S.tpl) ? 'CTA text on the post' : 'CTA line (replaces the contact line in the footer)', () => S.ctaMap[S.tpl] || '', (v) => { S.ctaMap[S.tpl] = v; upd(); }, { ph: PS.COPY[t.cta] ? PS.COPY[t.cta][0] : 'DM us', full: true }), cnt)); upd();
    }
    p.append(h('p', { class: 'help', text: 'Text on the post follows the language switch above the preview. Names, prices and numbers stay as typed.' }));
    updatePricePv(); syncNotes();
  }
  // the seven details the Signature spec row and title block draw on. Fewer than four makes a thin row.
  const isSig = () => S.tpl === 'newarrival' && S.x.listStyle !== 'navy';
  function specInfo() {
    const c = S.car, ins = PS.insuranceInfo(c), own = parseInt(c.owners, 10);
    const d = [['owners', own > 0], ['kms', c.kms !== '' && c.kms != null && !isNaN(+c.kms)], ['fuel', !!c.fuel], ['gearbox', !!c.trans], ['registration code', !!String(c.rto || '').trim()], ['insurance', ins.state === 'valid' || ins.state === 'text'], ['colour', !!String(c.colour || '').trim()]];
    return { n: d.filter((e) => e[1]).length, missing: d.filter((e) => !e[1]).map((e) => e[0]) };
  }
  const specShort = () => isSig() && specInfo().n < 4 && !S.specAck;
  function updatePricePv() {
    const el = $('#pricepv'); if (!el) return; const raw = S.car.price, prev = PS.lang; PS.lang = 'en';
    const say = (...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null).map((k) => (k.nodeType ? k : document.createTextNode(k))));
    try {
      if (PS.isPOA(raw)) { say('Shown as ', h('b', { text: 'Price on request' }), '.'); return; }
      const n = PS.parseMoney(raw);
      if (!isFinite(n)) { say('Type a price. 15.5L, 1550000 and 15,50,000 all work. Type POA for price on request.'); return; }
      const parts = PS.priceParts(n, 'full');
      if (!parts) { say('Shown as ', h('b', { text: 'Price on request' }), '. Type a price above zero to show one.'); return; }
      const emi = PS.emiEst(n), kids = ['Shown as ', h('b', { text: PS.priceText(n, 'full') }), ` (short style: ${PS.priceText(n, 'short')})`];
      if (isFinite(emi)) kids.push(' · est. EMI ', h('b', { text: '₹' + PS.inr(emi) + '/mo*' }), h('br'), `*20% down, ${PS.rateText()}% p.a., 60 months. An estimate, not an offer.`);
      const g = PS.priceGuess(raw);
      if (g) {
        kids.push(h('br'), h('b', { class: 'bad', text: 'That is outside ₹50,000 to ₹5 Cr. ' }), g.options.length ? 'Did you mean ' : 'Check the digits. ');
        g.options.forEach((o, i) => kids.push(h('button', { class: 'btn sm', type: 'button', style: 'min-height:44px;margin:2px 6px 2px 0', onclick: () => { S.car.price = o; buildContent(); changed(); } }, '₹' + PS.inr(o))));
      }
      say(...kids);
    } finally { PS.lang = prev; }
  }
  // notes that depend on the current state: consent, sample customer text, price-drop sanity
  function syncNotes() {
    const cn = $('#consentNote'); if (cn) cn.hidden = !PS.needsConsent(S);
    const dn = $('#demoNote'); if (dn) dn.hidden = !PS.isDemoCustomer(S);
    const sh = $('#specHint'); if (sh) { const si = specInfo(); sh.hidden = !isSig() || si.n >= 5; sh.textContent = si.n >= 5 ? '' : `Add ${si.missing.slice(0, 3).join(', ')} to fill the spec row (${si.n} of 7 details so far).`; }
    const pn = $('#dropNote'); if (pn) { const bad = !PS.validDrop(S.car); pn.textContent = bad ? 'Add an old price that is higher than the price. Without it this post is not a price drop and cannot be exported.' : ''; pn.hidden = !bad; }
  }
  // strip under the preview: things to fix before posting. The no-phone state is information, never a warning.
  function updateNotices() {
    const box = $('#notices'); if (!box) return; box.innerHTML = '';
    const add = (cls, text, ...btns) => box.append(h('div', { class: 'notice ' + cls }, h('span', { text }), btns.filter(Boolean).map(([label, fn]) => h('button', { class: 'btn sm', type: 'button', onclick: fn }, label))));
    const k = PS.contact(), t = tpl();
    const st = staleFields();
    if (st.length) add('warn', `Photo changed. Check: ${st.map((f) => IDENT_LABEL[f]).join(', ')}.`,
      ['These details match this car', () => { S.demoAck = true; updateNotices(); toast('Details confirmed'); }], ['Start a blank car', () => { blankCar(); buildContent(); changed(); toast('Blank car. Type the new details.'); }]);
    const pm = priceMismatch();
    if (pm) add('warn', `This post says ${PS.priceText(pm.post, 'full')} but the stock sheet says ${PS.priceText(pm.stock, 'full')} for ${[pm.row.year, pm.row.make, pm.row.model].filter(Boolean).join(' ')}. Posts must carry the stock price.`,
      ['Use the stock price', () => { S.car.price = pm.row.price; buildContent(); changed(); }], ['Update the stock sheet', () => { pm.row.price = S.car.price; S.priceAck = S.car.price; buildGarage(); updateNotices(); toast('Stock sheet updated'); }]);
    if (t.car && PS.insuranceInfo(S.car).state === 'expired') add('info', 'The insurance date has passed, so the insurance cell is left off the post. Type the new date (More details) when the policy is renewed.');
    if (isSig()) {
      const si = specInfo();
      if (si.n < 4) add('warn', `Only ${si.n} of 7 details are filled, so the spec row is short. Add ${si.missing.slice(0, 3).join(', ')}.`, S.specAck ? null : ['Export anyway', () => { S.specAck = true; updateNotices(); toast('Short spec row accepted for this car'); }]);
      if (S.size === '1080x1080') add('info', 'Instagram’s profile grid shows the centre 3:4 of a square post, so the left of the wordmark and the price can be cut there. 4:5 is safe for the grid.', ['Use 4:5', () => setSize('1080x1350')]);
    }
    const g = t.car && PS.priceGuess(S.car.price); if (g) add('warn', `The price ${S.car.price} is outside ₹50,000 to ₹5 Cr. Check it before exporting.`);
    if (S.tpl === 'pricedrop') {
      if (!PS.validDrop(S.car)) add('warn', 'A Price Drop needs an old price that is higher than the price. Add one, or use New Arrival.');
      else if (!PS.parseDate(S.x.oldPosted)) add('info', 'Add the date the old price was posted to show it struck through. Without it the post only says NEW PRICE.');
      const o = PS.offerStatus(S.x.validity);
      if (o.status === 'past') add('warn', 'The offer date has passed, so no deadline is printed. Clear it or type a future date.');
      if (o.status === 'unreadable') add('warn', 'That offer date could not be read. Try 31 Dec 2026.');
    }
    if (t.needsCut && !PS.D.cutImg(S.photos.main)) add('info', 'This layout is built for a cut-out car (a PNG with a transparent background). Until you add one the photo shows as a soft-edged band.');
    if (S.tpl === 'receipt' && PS.exportIssue(S) === 'noitems') add('warn', 'Add what is included, one item per line. The Receipt only lists real items and will not export while it is empty.');
    if (S.tpl === 'finance' && !(PS.parseMoney(S.car.price) > 0)) add('warn', 'Add the car’s price. The Finance post needs a real price and will not export without one.');
    { const ei = PS.exportIssue(S); if (ei === 'norole' || ei === 'nocar') add('warn', PS.ISSUE_MSG[ei]); }
    if (PS.exportIssue(S) === 'nophoto') add('warn', 'This car has no photo yet. Add it in the Photo tab: a car post is not exported without its own photo.', ['Add the photo', () => selectTab('photo')]);
    if (PS.probe(S).samplePhoto) add('warn', 'This is a bundled layout-test photo, not one of our cars. The post is stamped SAMPLE PHOTO and cannot be exported. Add the real photo in the Photo tab.');
    if (S.x.kw && !k.siteUrl && ['reelcover', 'story', 'carousel'].includes(S.tpl)) add('info', 'Comment keyword set. The DM reply file has no car-page link until you add the car-page base URL in Settings.');
    (S._notes || []).forEach((m) => add('info', m));
    const btn = $('#btnSettings'); if (btn) btn.classList.remove('attn');
  }

  /* ---------- inspector: photo ---------- */
  function buildPhoto() {
    const p = $('#p-photo'); p.innerHTML = ''; const t = tpl(), P = targetPhoto(false);
    let who = t.photoLabel || 'Car photo';
    const sk = t.carousel ? PS.slideKind(S, S.slide) : null;
    if (t.carousel) who = sk.kind === 'car' ? `Photo for slide ${S.slide + 1}: ${sk.car.model}` : 'The cover and lineup slides use the photos of the cars you chose.';
    if (t.carousel && sk.kind !== 'car') { p.append(h('p', { class: 'help', text: who })); return; }
    const mkDrop = (id, title, has, onFile) => {
      const input = h('input', { type: 'file', accept: 'image/*', hidden: true, id, onchange: (e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ''; } });
      const drop = h('label', { class: 'drop', for: id }, h('b', { text: has ? 'Replace photo' : 'Drop the photo here' }), h('span', { text: 'or tap to choose. It stays on this device.' }));
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) onFile(f); });
      return h('div', { class: 'group' }, h('h3', { text: title }), input, drop);
    };
    p.append(mkDrop('photoIn', who, P && P.img, (f) => setPhotoFile(f)));
    p.append(h('p', { class: 'help', id: 'shootTip', text: 'Shooting tip: park the car against a plain wall, with no people, cars or clutter behind it and all four tyres in frame. A plain background gives a clean cut-out (training/car-photo-guide.md).' }));
    if (t.photo2) {
      const P2 = S.photos.second, g2 = mkDrop('photoIn2', t.photo2, P2 && P2.img, (f) => setPhotoFile(f, 'second'));
      if (P2 && P2.img) g2.append(h('div', { class: 'row' }, h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { S.photos.second = null; resetConsent('second'); buildPhoto(); changed(); } }, 'Remove this photo')));
      p.append(g2);
    }
    if (P && P.img) {
      const sl = (label, key, min, max, step, fmt) => { const out = h('span', { text: fmt(P[key]) }); const r = h('input', { type: 'range', min, max, step, value: P[key], 'aria-label': label }); r.addEventListener('input', () => { P[key] = +r.value; out.textContent = fmt(P[key]); changed(); }); return h('div', { class: 'slider' }, h('span', { class: 'lbl' }, label, out), r); };
      p.append(h('div', { class: 'group' }, h('h3', { text: 'Crop and position' }),
        inp('Fit', () => P.fit, (v) => { P.fit = v; }, { type: 'select', options: [['auto', 'Auto (fill the frame, crop)'], ['fill', 'Fill the frame (crop)'], ['fit', 'Show whole photo (blurred backdrop)']] }),
        sl('Zoom', 'zoom', 1, 3, 0.01, (v) => v.toFixed(2) + '×'), sl('Left to right', 'px', 0, 1, 0.01, (v) => Math.round(v * 100) + '%'), sl('Up to down', 'py', 0, 1, 0.01, (v) => Math.round(v * 100) + '%'),
        h('p', { class: 'help', text: 'You can also drag the photo in the preview and scroll to zoom.' })));
      p.append(h('div', { class: 'group' }, h('h3', { text: 'Light (whole photo)' }), PS.D.adjFilterOK ? h('div', {}, sl('Brightness', 'bright', -40, 40, 1, (v) => (v > 0 ? '+' : '') + v), sl('Contrast', 'contrast', -40, 40, 1, (v) => (v > 0 ? '+' : '') + v)) : h('p', { class: 'help', text: 'This browser cannot adjust brightness. Use Chrome, Edge or Firefox.' }),
        chk('Label edited photos on the post', () => PS.settings.showAdj, (v) => { PS.settings.showAdj = v; PS.saveSettings(); }),
        h('p', { class: 'help', text: 'Only crop, position, zoom, brightness, contrast and a blurred copy of the same photo behind it are offered. The car itself is never altered' + ', except a number-plate blur you mark below.' }),
        h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onclick: () => { Object.assign(P, { px: .5, py: .58, zoom: 1, fit: 'auto', bright: 0, contrast: 0 }); buildPhoto(); changed(); } }, 'Reset'),
          h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { const t2 = tpl(); if (t2.carousel) targetPhoto(false).img = null; else if (t2.heroPhoto) S.photos.hero = null; else if (t2.photoKey) S.photos[t2.photoKey] = null; else S.photos.main = null; if (!t2.carousel) dropConsents(); buildPhoto(); changed(); } }, 'Remove photo'))));
      {
        p.append(h('div', { class: 'group' }, h('h3', { text: 'Number plate' }),
          h('p', { class: 'help', text: P.plate ? 'A plate blur is on. The post and the caption say “number plate blurred”. This is the only change to the car’s pixels.' : 'Some photos show a readable number plate. Hide it with one drag over the plate. The post and the caption will say so.' }),
          h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', 'aria-pressed': String(plateMode), onclick: () => { plateMode = !plateMode; $('#frame').classList.toggle('plate', plateMode); buildPhoto(); if (plateMode) toast('Drag a box over the number plate on the preview.'); } }, plateMode ? 'Drag on the preview…' : (P.plate ? 'Mark the plate again' : 'Hide number plate')),
            P.plate ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { P.plate = null; plateMode = false; buildPhoto(); changed(); } }, 'Remove plate blur') : null)));
      }
      p.append(h('p', { class: 'help', text: 'Photo source: ' + (PS.PHOTO_SRC_LABEL[P.src] || PS.PHOTO_SRC_LABEL.own) + (P.src === 'ig' ? '. Swap in a walk-around photo when you have one.' : '.') }));
      p.append(cutGroup(P));
    }
    // the layout-test photos are not Classic Auto's own pictures and are not published with the studio: the button only appears where the files exist (a local copy)
    if (PS.hasLayoutPhotos) p.append(h('div', { class: 'row' }, h('button', { class: 'btn sm ghost', type: 'button', onclick: loadLayoutPhoto }, 'Load a layout-test photo (not our car)')),
      h('p', { class: 'help', text: 'For trying layouts only. Posts that use it are stamped SAMPLE PHOTO and cannot be exported.' }));
  }
  PS.hasLayoutPhotos = false;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) try { fetch('assets/samples/showroom.jpg', { method: 'HEAD' }).then((r) => { if (r.ok) { PS.hasLayoutPhotos = true; try { buildPhoto(); } catch (e) { /* the studio is not built yet */ } } }).catch(() => {}); } catch (e) { /* offline or file:// */ }
  const LAYOUT_PHOTOS = ['honda-city', 'maruti-swift', 'hyundai-creta', 'bmw-3-series', 'toyota-fortuner', 'showroom']; let layoutIdx = 0;
  async function loadLayoutPhoto() {
    try {
      const n = LAYOUT_PHOTOS[layoutIdx++ % LAYOUT_PHOTOS.length], img = await PS.loadImage(`assets/samples/${n}.jpg`), P = targetPhoto(true); Object.assign(P, PS.newPhoto(img, n + '.jpg', 'stock'));
      buildPhoto(); changed(); toast('Layout-test photo loaded. It is not one of our cars.');
    } catch (e) { toast('Could not load the layout-test photo.'); }
  }
  /* ---------- the cut-out (3D look): the car alone on a transparent background, drawn on the post's showroom floor ---------- */
  const KIT = 'http://localhost:8766';
  function cutGroup(P) {
    const has = !!PS.D.cutImg(P), own = P.alpha, st = (S.x.photoStyle || 'cut');
    const msg = own ? 'This photo is a cut-out already (transparent PNG): the car stands on the showroom floor.'
      : has ? (st === 'cut' || !tpl().x || !tpl().x.includes('photoStyle') ? 'This car has a cut-out: the Signature layouts show it in 3D on the showroom floor, with no frame.' : 'This car has a cut-out. Pick “3D cut-out” under Photo style to use it.')
      : P.cut && P.plate ? 'The cut-out is not the photo’s own size, so the plate blur would miss. The photo is used. Make the cut-out from this photo with “Make cut-out”.'
      : 'No cut-out yet, so the post uses the photo. Add one for the 3D look: a PNG with a transparent background, or press “Make cut-out”.';
    const fin = h('input', { type: 'file', accept: 'image/png,image/webp', hidden: true, 'aria-label': 'Choose a cut-out PNG' });
    fin.addEventListener('change', () => { const f = fin.files && fin.files[0]; fin.value = ''; if (f) setCutFile(f); });
    return h('div', { class: 'group', id: 'cutGroup' }, h('h3', { text: 'Cut-out (3D look)' }), h('p', { class: 'help', id: 'cutMsg', text: msg }),
      own ? null : h('div', { class: 'row' },
        h('button', { class: 'btn sm', type: 'button', id: 'btnCutFile', onclick: () => fin.click() }, P.cut ? 'Replace cut-out PNG' : 'Add cut-out PNG'),
        h('button', { class: 'btn sm', type: 'button', id: 'btnCutMake', onclick: makeCut }, 'Make cut-out'),
        P.cut ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { P.cut = null; buildPhoto(); changed(); toast('Cut-out removed. The post uses the photo.'); } }, 'Remove cut-out') : null, fin),
      own ? null : h('p', { class: 'help', text: '“Make cut-out” uses the listing kit on this computer: start it once with  python kit.py serve  in classic-auto/listing-kit. Many cars at once: python tools/make_cutouts.py <folder>. Only the background is removed; the car is never retouched.' }));
  }
  async function setCutFile(file) {
    const P = targetPhoto(false); if (!P || !P.img) { toast('Add the car photo first, then its cut-out.'); return; }
    try {
      const img = await PS.fileToImage(file);
      if (!PS.hasAlpha(img)) { toast('That PNG has no transparent background, so it is not a cut-out.'); return; }
      const a = [P.img.naturalWidth || P.img.width, P.img.naturalHeight || P.img.height], b = [img.naturalWidth, img.naturalHeight];
      P.cut = img; buildPhoto(); changed();
      toast(P.plate && (a[0] !== b[0] || a[1] !== b[1]) ? 'Cut-out added, but it is not the photo’s size, so with the plate blur on the photo is used.' : 'Cut-out added: the car now stands on the showroom floor.');
    } catch (e) { toast('Could not read that cut-out.'); }
  }
  let cutBusy = false;
  async function makeCut() {
    const P = targetPhoto(false); if (!P || !P.img || cutBusy) return; const btn = $('#btnCutMake'), msg = $('#cutMsg'), say = (t) => { if (msg) msg.textContent = t; };
    cutBusy = true; if (btn) btn.disabled = true; say('Making the cut-out on this computer… (about 10 to 30 seconds)');
    try {
      const photo = await (await fetch(P.img.src)).blob(), fd = new FormData(); fd.append('photo', photo, (P.name || 'photo').replace(/\.[^.]+$/, '') + '.png');
      let r; try { r = await fetch(KIT + '/api/cutout', { method: 'POST', body: fd }); } catch (e) { throw new Error('Could not reach the listing kit on this computer. Start it with  python kit.py serve  (in classic-auto/listing-kit) and press again. If it is already running, allow this page to reach apps on this device when the browser asks (Chrome: the icon left of the address > Site settings > Local network access > Allow).'); }
      const j0 = await r.json(); if (!r.ok || !j0.job) throw new Error(j0.error || 'The listing kit refused the photo.');
      for (let i = 0; i < 300; i++) {
        await new Promise((res) => setTimeout(res, 1500)); const j = await (await fetch(`${KIT}/api/cutout/${j0.job}`)).json();
        if (j.status === 'error') throw new Error(j.error || 'The cut-out did not work for this photo.');
        if (j.status === 'done') {
          const blob = await (await fetch(`${KIT}/api/cutout/${j0.job}/png`)).blob();
          const img = await PS.fileToImage(new File([blob], 'cutout.png', { type: 'image/png' }));      // a data URL: the canvas stays exportable
          if (targetPhoto(false) === P) { P.cut = img; buildPhoto(); changed(); toast('Cut-out made: the car now stands on the showroom floor. Check its edges before posting.'); }
          return;
        }
      }
      throw new Error('The cut-out is taking too long. Try tools/make_cutouts.py instead.');
    } catch (e) { say(e.message); toast(e.message); }
    finally { cutBusy = false; if (btn) btn.disabled = false; }
  }
  async function setPhotoFile(file, which) {
    if (!/^image\//.test(file.type)) { toast('That file is not an image.'); return; }
    try {
      const img = await PS.fileToImage(file), np = PS.newPhoto(img, file.name); np.alpha = /png|webp/.test(file.type) && PS.hasAlpha(img);
      if (which === 'second') S.photos.second = np; else { const P = targetPhoto(true); Object.assign(P, np); if (carPost() || tpl().car) S.photoReplaced = true; S.demoAck = false; }
      if (!tpl().carousel) dropConsents();      // a new photo is a new customer: every consent tick starts again, whichever template is open
      autoFestLayout(); if (S.tpl === 'festival') buildContent(); buildPhoto(); changed(); toast('Photo added');
    } catch (e) { toast('Could not read that photo.'); }
  }

  /* ---------- inspector: caption ---------- */
  let capLang = 'en', capVer = 0;
  function buildCaption() {
    const p = $('#p-caption'); p.innerHTML = '';
    p.append(h('div', { class: 'group' }, h('h3', { text: 'Caption' }),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Caption language', id: 'capSeg' }, ['en', 'hn'].map((l) => h('button', { type: 'button', 'data-l': l, 'aria-pressed': String(capLang === l), onclick: () => { capLang = l; $$('#capSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.l === l))); updateCaption(); } }, l === 'en' ? 'English' : 'Hinglish'))),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Caption version', id: 'capVerSeg', hidden: !PS.hasCaptionVersions(S) }, PS.CAPTION_VERSIONS.map((v, i) => h('button', { type: 'button', 'data-v': i, 'aria-pressed': String(capVer === i), title: v[1], onclick: () => { capVer = i; $$('#capVerSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.v === i))); updateCaption(); } }, `${v[0]} · ${v[1]}`))),
      h('p', { class: 'help', id: 'capVerHelp', hidden: !PS.hasCaptionVersions(S), text: 'A leads with the facts, B with a question, C is short. Same facts, same call to action. Post one, and try another next time to see which gets more sends.' }),
      h('div', { class: 'hook', id: 'capHook' }), h('textarea', { class: 'cap-box', id: 'capText', rows: 12, 'aria-label': 'Caption text' }),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', id: 'capCopy', onclick: copyCaption }, 'Copy caption'), h('span', { class: 'help', id: 'capCount' })),
      h('p', { class: 'help', id: 'capHint' })));
    updateCaption();
  }
  function updateCaption() {
    const ta = $('#capText'); if (!ta) return; const prev = ta.dataset.edited === '1';
    const hasV = PS.hasCaptionVersions(S); if (!hasV) capVer = 0; const sg = $('#capVerSeg'); if (sg) { sg.hidden = !hasV; $('#capVerHelp').hidden = !hasV; $$('#capVerSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.v === capVer))); }
    const c = PS.caption(S, capLang, capVer);
    if (!prev || ta.dataset.key !== S.tpl + capLang + capVer) { ta.value = c.text; ta.dataset.edited = '0'; ta.dataset.key = S.tpl + capLang + capVer; }
    else ta.value = c.text;
    $('#capHook').innerHTML = `<b>First 125 characters show before “more”:</b><br>${c.text.slice(0, 125).replace(/</g, '&lt;')}`;
    $('#capCount').textContent = `${ta.value.length} characters · ${c.tags.length} hashtag${c.tags.length === 1 ? '' : 's'}`;
    $('#capHint').textContent = c.hint;
  }
  async function copyCaption() {
    const ta = $('#capText');
    try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand('copy'); }
    toast('Caption copied');
  }

  /* ---------- inspector: garage ---------- */
  function buildGarage() {
    const p = $('#p-garage'); p.innerHTML = '';
    p.append(h('p', { class: 'help', text: 'Your stock list: the 7 priced cars on our Instagram feed until you paste your own sheet in Batch. Tick up to six cars for the weekly carousel, or open one in the studio.' }));
    S.garage.forEach((car) => {
      const on = S.carousel.ids.includes(car.id);
      const thumb = car.photoObj && car.photoObj.img ? h('img', { src: car.photoObj.img.src, alt: '' }) : h('img', { alt: '', src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' });
      p.append(h('div', { class: 'garage-item' }, thumb,
        h('div', {}, h('b', { text: [car.year, car.make, car.model].filter(Boolean).join(' ') }), h('small', { text: (PS.priceText(PS.parseMoney(car.price)) || 'No price') + (car.status && car.status !== 'available' ? ' · ' + car.status : '') })),
        h('div', { class: 'acts' },
          h('button', { class: 'btn sm', type: 'button', onclick: () => { loadCar(car); if (tpl().carousel) setTemplate('newarrival'); else { buildContent(); buildPhoto(); render(); } toast('Loaded into the studio'); } }, 'Edit'),
          (() => { const c = h('input', { type: 'checkbox' }); c.checked = on; c.addEventListener('change', () => { if (c.checked) { if (S.carousel.ids.length >= 6) { c.checked = false; toast('A carousel holds up to six cars.'); return; } S.carousel.ids.push(car.id); } else S.carousel.ids = S.carousel.ids.filter((i) => i !== car.id); S.slide = 0; changed(); if (tpl().carousel) { buildContent(); buildSlidebar(); } }); return h('label', { class: 'chk' }, c, 'In carousel'); })())));
    });
    p.append(h('div', { class: 'group' }, h('h3', { text: 'From the listing kit' }),
      h('p', { class: 'help', text: 'Choose a kit output folder (a car’s folder, or the whole out folder). Its cutout.png becomes the photo and listing.json the details. A cut-out car sits on the Signature showroom stage.' }),
      h('input', { type: 'file', id: 'garageKit', hidden: true, multiple: true, webkitdirectory: true, onchange: async (e) => { const fs = [...e.target.files]; e.target.value = ''; await kitToGarage(fileItems(fs)); } }),
      h('label', { class: 'btn', for: 'garageKit' }, 'Add cars from a kit folder')));
    p.append(h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: addCurrentToGarage }, 'Add current car'),
      h('button', { class: 'btn ghost', type: 'button', onclick: async () => { S.garage = PS.SEED_CARS.map((c) => Object.assign({}, c)); await Promise.all(S.garage.map((c) => { delete c.photoObj; return PS.hydrateCar(c); })); S.carousel.ids = S.garage.slice(0, 4).map((c) => c.id); buildGarage(); changed(); } }, 'Reset to the 7 stock cars')));
  }
  async function kitToGarage(items) {
    const kit = await PS.readKit(items); if (!kit.rows.length) { toast('No listing.json or cars-entry.csv found in that folder.'); return; }
    const cars = kit.rows.map((r) => { const car = PS.rowToCar(r), m = PS.matchPhoto(r, kit.photos, kit.rows); if (!car.id) car.id = 'CA-' + Math.random().toString(36).slice(2, 6); car.photoObj = m ? (() => { const np = PS.newPhoto(kit.photos[m], m.split('/').pop()); np.alpha = !!kit.photos[m]._alpha; return np; })() : null; return car; });
    cars.forEach((car) => { const i = S.garage.findIndex((g) => g.id === car.id); if (i >= 0) S.garage[i] = car; else S.garage.push(car); });
    loadCar(cars[0]); if (tpl().carousel || !tpl().car) setTemplate('newarrival'); else { buildContent(); buildPhoto(); }
    buildGarage(); changed(); const ph = kit.rows.filter(PS.isPlaceholderRow).length;
    toast(`${cars.length} car${cars.length === 1 ? '' : 's'} added from the kit` + (ph ? `. ${ph} marked sample or placeholder: check the details before posting.` : '.'));
  }
  function addCurrentToGarage() {
    const car = carSansPhoto(S.car); car.id = car.id && !S.garage.some((g) => g.id === car.id) ? car.id : 'CA-' + (300 + S.garage.length + 1);
    car.photoObj = S.photos.main ? Object.assign({}, S.photos.main) : null; S.garage.push(car); buildGarage(); toast('Added to the Garage');
  }

  /* ---------- tabs ---------- */
  function selectTab(name) {
    activeTab = name;
    $$('.tabs [role=tab]').forEach((b) => { const on = b.id === 'tab-' + name; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $$('.panel').forEach((pn) => { pn.hidden = pn.id !== 'p-' + name; });
    if (name === 'caption') updateCaption(); if (name === 'photo') buildPhoto(); if (name === 'garage') buildGarage();
  }

  /* ---------- carousel slide bar ---------- */
  function buildSlidebar() {
    const bar = $('#slidebar'); const t = tpl(); bar.hidden = !t.carousel; $('#btnZipSlides').hidden = !t.carousel; if (!t.carousel) return;
    const n = PS.slideCount(S); bar.innerHTML = '';
    const go = (i) => { S.slide = Math.max(0, Math.min(n - 1, i)); buildSlidebar(); buildPhoto(); render(); };
    bar.append(h('button', { class: 'btn sm', type: 'button', onclick: () => go(S.slide - 1), 'aria-label': 'Previous slide' }, '←'));
    for (let i = 0; i < n; i++) bar.append(h('button', { class: 'dot', type: 'button', 'aria-label': `Slide ${i + 1}`, 'aria-current': String(i === S.slide), onclick: () => go(i) }, h('i')));
    bar.append(h('span', { class: 'cnt', text: `${S.slide + 1} / ${n}` }), h('button', { class: 'btn sm', type: 'button', onclick: () => go(S.slide + 1), 'aria-label': 'Next slide' }, '→'));
  }

  /* ---------- stage ---------- */
  function fitFrame(W, H) {
    const wrap = $('#canvasWrap'), fr = $('#frame'); const cs = getComputedStyle(wrap), padX = parseFloat(cs.paddingLeft) * 2, padY = parseFloat(cs.paddingTop) * 2;
    let aw = wrap.clientWidth - padX, ah = wrap.clientHeight - padY;
    if (window.innerWidth <= 1060) ah = Math.max(300, window.innerHeight * 0.68);
    const w = Math.max(120, Math.min(aw, ah * W / H)); fr.style.width = Math.floor(w) + 'px'; fr.style.height = Math.floor(w * H / W) + 'px';
    return w;
  }
  function render() { if (rafId) return; rafId = requestAnimationFrame(() => { rafId = 0; renderStage(); }); }
  function changed() { render(); scheduleThumbs(); updatePricePv(); syncNotes(); updateNotices(); updateExportButtons(); if (activeTab === 'caption') updateCaption(); if (gridMode) renderGrid(); }
  const isPhone = () => window.matchMedia('(max-width: 760px)').matches;
  let lastNotes = '';
  function renderStage() {
    if (gridMode) { renderGrid(); return; }
    if (varMode) { renderVariants(); if (!isPhone()) return; }      // on a phone the variants are a sheet at the bottom and the post stays in view
    const [W, H] = PS.parseSize(S.size), cssW = fitFrame(W, H), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sc = Math.min(1, (cssW * dpr) / W);
    PS.renderTo($('#cv'), S, { scale: sc });
    const nk = (S._notes || []).join('|'); if (nk !== lastNotes) { lastNotes = nk; updateNotices(); }      // what the layout had to shrink or hide (tagline, long title) shows as a notice
    $('#frame').style.background = tpl().transparent ? 'repeating-conic-gradient(#4a4f5c 0 25%, #6b7180 0 50%) 0 0 / 24px 24px' : '';
    const veil = $('#veil'), issue = PS.exportIssue(S); veil.hidden = !(issue === 'consent' || issue === 'demo');       // customer posts are veiled; every other problem is a notice, so the layout stays visible
    if (issue === 'consent') veil.textContent = 'Preview only. Tick the customer consent box to export this post.';
    if (issue === 'demo') veil.textContent = 'Sample text. Add the real customer’s name and words to export this post.';
    $('#fileName').textContent = PS.fileName(S);
    drawSafe(W, H);
    if (activeTab === 'caption') updateCaption();
  }

  /* ---------- safe zones ---------- */
  function safeShapes(t, W, H) {
    const out = [], dim = (x, y, w, h2, text) => out.push({ k: 'dim', x, y, w, h: h2, text }), box = (x, y, w, h2, text) => out.push({ k: 'box', x, y, w, h: h2, text });
    if (t.id === 'youtube') { box((W - 1100) / 2, (H - 620) / 2, 1100, 620, 'Keep content here'); dim(W * 0.85, H * 0.85, W * 0.15, H * 0.15, 'Timestamp'); return out; }
    if (t.id === 'cover') { if (W === 820) { dim(0, 0, 90, H, 'Trimmed on mobile'); dim(W - 90, 0, 90, H, ''); box(90, 0, 640, H, 'Mobile-safe 640'); } else { box(W * 0.1, H * 0.1, W * 0.8, H * 0.8, 'Centre the key content'); box((W - 560) / 2, (H - 200) / 2, 560, 200, '560×200 text block'); } return out; }
    if (t.id === 'hero') { const mw = H * 0.8; box((W - mw) / 2, 0, mw, H, 'Mobile crop (4:5)'); box(W * 0.05, H * 0.08, W * 0.9, H * 0.84, ''); return out; }
    if (W === 1080 && H === 1350) { dim(0, 0, 34, H, ''); dim(W - 34, 0, 34, H, ''); box(50, 50, W - 100, H - 100, 'Grid shows the centre 3:4 (1012 wide). Keep text 50 px in.'); return out; }
    if (W === 1080 && H === 1080) { dim(0, 0, 135, H, 'Grid crops to 810'); dim(W - 135, 0, 135, H, ''); box(155, 50, W - 310, H - 100, ''); return out; }
    if (W === 1080 && H === 1920) {
      if (t.id === 'reelcover') { dim(0, 0, W, 285, 'Hidden in the 4:5 grid crop'); dim(0, H - 285, W, 285, 'Hidden in the 4:5 grid crop'); box(60, 285, W - 180, H - 285 - 320, 'Reel UI-safe'); }
      else { dim(0, 0, W, 250, 'Story UI (top 250)'); dim(0, H - 340, W, 340, 'Story UI (bottom 340)'); if (t.id === 'story') box(64, 1250, W - 128, 250, 'Link sticker 1250–1500'); }
      return out;
    }
    if (W === 1920 && H === 1080) { box(96, 64, W - 192, H - 128, 'Title-safe'); return out; }
    return out;
  }
  function drawSafe(W, H) {
    const svg = $('#safeSvg'); svg.innerHTML = ''; svg.style.display = safeOn && !gridMode ? '' : 'none'; if (!safeOn) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); const sw = Math.max(2, W / 360), fs = Math.max(14, W / 46); let html = '';
    safeShapes(tpl(), W, H).forEach((s) => {
      if (s.k === 'dim') html += `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="rgba(225,27,34,.34)"/>`;
      else html += `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="none" stroke="#fff" stroke-width="${sw}" stroke-dasharray="${sw * 4} ${sw * 3}"/>`;
      if (s.text) html += `<text x="${s.x + fs * 0.5}" y="${s.y + fs * 1.4}" fill="#fff" font-size="${fs}" font-weight="800" font-family="Manrope,sans-serif" paint-order="stroke" stroke="#000" stroke-width="${fs * 0.22}">${s.text}</text>`;
    });
    svg.innerHTML = html;
  }

  /* ---------- pointer: drag to pan, wheel to zoom ---------- */
  function initPointer() {
    const fr = $('#frame'); let drag = null;
    const slotAt = (ev) => {
      const r = fr.getBoundingClientRect(), [W, H] = PS.parseSize(S.size), x = (ev.clientX - r.left) * W / r.width, y = (ev.clientY - r.top) * H / r.height;
      return (S._slots || []).slice().reverse().find((s) => s.key === 'main' && x >= s.r.x && x <= s.r.x + s.r.w && y >= s.r.y && y <= s.r.y + s.r.h);
    };
    // plate tool: drag a box over the number plate. Stored as fractions of the photo so it survives crop, zoom and every size.
    let pbox = null; const pel = h('div', { class: 'plate-box', hidden: true }); fr.append(pel);
    const toCanvas = (ev) => { const r = fr.getBoundingClientRect(), [W, H] = PS.parseSize(S.size); return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height, k: r.width / W }; };
    fr.addEventListener('pointerdown', (ev) => {
      if (plateMode) { const P = targetPhoto(false), s = slotAt(ev); if (!P || !P.img || !s || !s.dr) { toast('Click on the photo to mark the plate.'); return; } const c = toCanvas(ev); pbox = { x0: c.x, y0: c.y, x1: c.x, y1: c.y, s, P, k: c.k }; fr.setPointerCapture(ev.pointerId); return; }
      const P = targetPhoto(false); if (!P || !P.img || !slotAt(ev)) return; drag = { x: ev.clientX, y: ev.clientY, px: P.px, py: P.py, P, slot: slotAt(ev) }; fr.setPointerCapture(ev.pointerId); fr.classList.add('drag'); });
    fr.addEventListener('pointermove', (ev) => {
      if (pbox) { const c = toCanvas(ev); pbox.x1 = c.x; pbox.y1 = c.y; const x = Math.min(pbox.x0, pbox.x1) * pbox.k, y = Math.min(pbox.y0, pbox.y1) * pbox.k, w = Math.abs(pbox.x1 - pbox.x0) * pbox.k, hh = Math.abs(pbox.y1 - pbox.y0) * pbox.k; Object.assign(pel.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' }); pel.hidden = false; return; }
      if (!drag) return; const r = fr.getBoundingClientRect(), [W] = PS.parseSize(S.size), k = W / r.width, s = drag.slot, dr = s.dr || { w: s.r.w, h: s.r.h };
      const ox = s.travel ? s.travel.x : Math.max(1, dr.w - s.r.w), oy = s.travel ? s.travel.y : Math.max(1, dr.h - s.r.h);
      drag.P.px = Math.min(1, Math.max(0, drag.px - ((ev.clientX - drag.x) * k) / ox)); drag.P.py = Math.min(1, Math.max(0, drag.py - ((ev.clientY - drag.y) * k) / oy)); render();
    });
    const endPlate = () => {
      if (!pbox) return; const b = pbox, dr = b.s.dr; pbox = null; pel.hidden = true;
      const x = (Math.min(b.x0, b.x1) - dr.x) / dr.w, y = (Math.min(b.y0, b.y1) - dr.y) / dr.h, w = Math.abs(b.x1 - b.x0) / dr.w, hh = Math.abs(b.y1 - b.y0) / dr.h;
      if (w * dr.w < 24 || hh * dr.h < 12) { toast('Drag a box over the plate: a small click is ignored.'); return; }
      const cl = (v) => Math.max(0, Math.min(1, v)); const x0 = cl(x), y0 = cl(y);
      b.P.plate = { x: x0, y: y0, w: cl(x + w) - x0, h: cl(y + hh) - y0 }; plateMode = false; fr.classList.remove('plate'); buildPhoto(); changed(); toast('Plate blur added. The post will say so.');
    };
    fr.addEventListener('pointerup', endPlate); fr.addEventListener('pointercancel', () => { pbox = null; pel.hidden = true; });
    const end = () => { if (drag) { drag = null; fr.classList.remove('drag'); buildPhotoSoft(); scheduleThumbs(); } };
    fr.addEventListener('pointerup', end); fr.addEventListener('pointercancel', end);
    fr.addEventListener('wheel', (ev) => { const P = targetPhoto(false); if (!P || !P.img || !slotAt(ev)) return; ev.preventDefault(); P.zoom = Math.min(3, Math.max(1, P.zoom * (ev.deltaY < 0 ? 1.06 : 0.94))); render(); buildPhotoSoft(); }, { passive: false });
    fr.addEventListener('keydown', (ev) => { const P = targetPhoto(false); if (!P || !P.img) return; const d = 0.03; let used = true; if (ev.key === 'ArrowLeft') P.px = Math.min(1, P.px + d); else if (ev.key === 'ArrowRight') P.px = Math.max(0, P.px - d); else if (ev.key === 'ArrowUp') P.py = Math.min(1, P.py + d); else if (ev.key === 'ArrowDown') P.py = Math.max(0, P.py - d); else if (ev.key === '+' || ev.key === '=') P.zoom = Math.min(3, P.zoom + 0.05); else if (ev.key === '-') P.zoom = Math.max(1, P.zoom - 0.05); else used = false; if (used) { ev.preventDefault(); render(); buildPhotoSoft(); } });
    // drop anywhere on the stage
    const cw = $('#canvasWrap');
    ['dragenter', 'dragover'].forEach((e) => cw.addEventListener(e, (ev) => { if (ev.dataTransfer && [...ev.dataTransfer.types].includes('Files')) { ev.preventDefault(); $('#dropHint').hidden = false; } }));
    ['dragleave', 'drop'].forEach((e) => cw.addEventListener(e, (ev) => { ev.preventDefault(); $('#dropHint').hidden = true; }));
    cw.addEventListener('drop', (ev) => { const f = ev.dataTransfer.files[0]; if (f) setPhotoFile(f); });
  }
  let softT = 0; function buildPhotoSoft() { clearTimeout(softT); softT = setTimeout(() => { if (activeTab === 'photo') { const y = $('#p-photo').scrollTop; buildPhoto(); $('#p-photo').scrollTop = y; } }, 250); }

  /* ---------- grid preview ---------- */
  let gridQueue = [];
  const FILL = [['newarrival', 1], ['newarrival', 2], ['trust', 0], ['reelcover', 3], ['sell', 0], ['newarrival', 4], ['placeholder', 0], ['newarrival', 5]];
  function tileState(t, carIdx) {
    const car = S.garage[carIdx % S.garage.length] || S.car;
    const T = Object.assign({}, S, { tpl: t.id, size: t.sizes.includes('1080x1350') ? '1080x1350' : t.def, car: carSansPhoto(car), photos: { main: car.photoObj || S.photos.main, second: null }, x: {}, badges: (t.badges || []).slice(), slide: 0, exporting: true });
    PS.applyTemplateDefaults(T, t); if (t.id === 'sold') T.x.consentSold = true; if (t.id === 'testimonial') T.x.consentTesti = true; if (t.id === 'sold') T.x.soldKind = 'delivered'; return T;
  }
  function drawTile(cv, T) {
    if (T.placeholder) { const tw = 270, th = 360, c = cv.getContext('2d'); cv.width = tw * 2; cv.height = th * 2; c.fillStyle = '#16275A'; c.fillRect(0, 0, cv.width, cv.height); c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([14, 10]); c.lineWidth = 3; c.strokeRect(24, 24, cv.width - 48, cv.height - 48); c.fillStyle = '#B9C2DA'; c.font = '700 34px Manrope'; c.textAlign = 'center'; c.fillText('Your next', cv.width / 2, cv.height / 2 - 10); c.fillText('real post', cv.width / 2, cv.height / 2 + 36); return; }
    const [W, H] = PS.parseSize(T.size), off = document.createElement('canvas'); PS.renderTo(off, T, { scale: Math.min(1, 640 / Math.max(W, H)), exporting: true });
    const tw = 270, th = 360, dpr = 2; cv.width = tw * dpr; cv.height = th * dpr; const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high';
    const ar = 3 / 4, sw = Math.min(off.width, off.height * ar), sh = sw / ar; c.drawImage(off, (off.width - sw) / 2, (off.height - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
  }
  function renderGrid() {
    const gv = $('#gridView'); gv.innerHTML = '';
    const cells = [{ T: Object.assign({}, S, { exporting: true }), tag: 'This post', cur: true }];
    gridQueue.slice(0, 8).forEach((q) => cells.push({ T: q, tag: 'Pinned' }));
    let fi = 0; while (cells.length < 9) { const [id, ci] = FILL[fi % FILL.length]; fi++; if (id === 'placeholder') { cells.push({ T: { tpl: 'newarrival', placeholder: true }, tag: 'Suggested' }); continue; } const t = PS.TPL[id]; cells.push({ T: tileState(t, ci), tag: 'Suggested' }); }
    const grid = h('div', { class: 'ig-grid' });
    cells.forEach((c) => { const cv = h('canvas'); const cell = h('div', { class: 'ig-cell' + (c.cur ? ' cur' : '') }, cv, h('span', { class: 'tag', text: c.tag })); grid.append(cell); try { drawTile(cv, c.T); } catch (e) { console.error(e); } });
    let clash = '';
    const noPhoto = (c) => ['festival', 'testimonial', 'trust', 'sell', 'finance', 'hiring'].includes(c.T.tpl) && !(c.T.tpl === 'festival' && c.T.x.festLayout === 'car');
    for (let i = 0; i + 2 < cells.length; i++) if (!clash && noPhoto(cells[i]) && noPhoto(cells[i + 1]) && noPhoto(cells[i + 2])) clash = 'Three text-only posts in a row. Put a photo post in the middle so the grid keeps its rhythm.';
    const stat = (c) => ['finance'].includes(c.T.tpl); for (let i = 0; i < 9; i++) { const r = i % 3; if (r < 2 && i + 1 < 9 && stat(cells[i]) && stat(cells[i + 1])) clash = 'Two stats cards sit side by side. Put a photo post between them.'; if (i + 3 < 9 && stat(cells[i]) && stat(cells[i + 3])) clash = 'Two stats cards are stacked. Put a photo post between them.'; }
    gv.append(h('div', { class: 'ig-head' }, h('div', { class: 'ig-av' }, h('img', { src: 'assets/logo.png', alt: '' })), h('div', {}, h('b', { text: 'classicauto_1974' }), h('span', { text: 'Quality Used Cars | VERIFIED Inventory | Easy Finance | Visit Us in Mumbai | DM to Book Test Drive' }), h('div', { class: 'ig-stats' }, h('span', {}, h('b', { text: PS.SITE.ig_posts.toLocaleString('en-IN') }), ' posts'), h('span', {}, h('b', { text: PS.SITE.ig_followers_label }), ' followers')))), grid,
      h('div', { class: 'ig-foot' }, h('div', { text: 'Rhythm: the real feed is a run of Classic Listing cards. Break up any three listings in a row with a reel cover or a festival post.' }), clash ? h('div', { class: 'bad', text: clash }) : null,
        S.size === '1080x1080' ? h('div', { class: 'bad', text: 'Square posts lose the left of the wordmark and the price in the profile grid (Instagram shows the centre 3:4). Use the 4:5 version for the grid.' }) : null,
        h('div', { text: 'The grid shows the centre 3:4 of each 4:5 post. On older posts use Instagram’s Adjust preview.' }),
        h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onclick: () => { gridQueue.unshift(Object.assign({}, S, { x: Object.assign({}, S.x), car: Object.assign({}, S.car), badges: S.badges.slice(), size: tpl().sizes.includes('1080x1350') ? '1080x1350' : S.size, exporting: true })); gridQueue = gridQueue.slice(0, 8); renderGrid(); toast('Pinned to the grid'); } }, 'Pin this post'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { gridQueue = []; renderGrid(); } }, 'Clear pins'))));
  }
  /* ---------- variants (PS-9): a 3 x 2 set of looks for this post; Generate more adds a set and keeps the first ---------- */
  const flipLux = () => (PS.isLuxury(S.car, S.x.luxury) ? 'no' : 'yes');
  const VARIANT_SETS = [
    () => [{ label: 'Navy', x: { accent: 'navy' } }, { label: 'Racing green', x: { accent: 'green' } }, { label: 'Maroon', x: { accent: 'maroon' } }, { label: 'Black', x: { accent: 'black' } },
      { label: 'Other header line', x: { luxury: flipLux() } }, { label: 'Just in stamp', x: { stamp: 'just' } }],
    () => [{ label: 'Green, new price stripe', x: { accent: 'green', stamp: 'new' } }, { label: 'Maroon, other header', x: { accent: 'maroon', luxury: flipLux() } }, { label: 'Black, booked ring', x: { accent: 'black', stamp: 'booked' } },
      { label: 'Car to the left', x: {}, photo: { px: 0.15 } }, { label: 'Car zoomed in', x: {}, photo: { zoom: 1.18, py: 0.62 } }, { label: 'Navy, sold rings', x: { accent: 'navy', stamp: 'sold' } }],
    () => [{ label: 'Black, just in', x: { accent: 'black', stamp: 'just' } }, { label: 'Green, car right', x: { accent: 'green' }, photo: { px: 0.9 } }, { label: 'Maroon, zoomed', x: { accent: 'maroon' }, photo: { zoom: 1.12 } },
      { label: 'Navy, coming soon', x: { accent: 'navy', stamp: 'soon' } }, { label: 'Green, booked', x: { accent: 'green', stamp: 'booked' } }, { label: 'Black, new price', x: { accent: 'black', stamp: 'new' } }]
  ];
  function variantPost(p) { const P = S.photos.main; return Object.assign({}, S, { x: Object.assign({}, S.x, p.x), photos: Object.assign({}, S.photos, { main: P && p.photo ? Object.assign({}, P, p.photo) : P }), exporting: true }); }
  function applyVariant(p) { Object.assign(S.x, p.x); if (p.photo && S.photos.main) Object.assign(S.photos.main, p.photo); setVar(false); buildContent(); buildPhoto(); changed(); toast('Variant applied: ' + p.label); }
  function renderVariants() {
    const vv = $('#varView'); vv.innerHTML = ''; if (!varSets.length) varSets.push(VARIANT_SETS[0]());
    vv.append(h('p', { class: 'help', text: 'Pick a look to apply it to this post. Generate more adds another set and keeps the first.' }));
    const [W] = PS.parseSize(S.size);
    varSets.forEach((set, si) => {
      const grid = h('div', { class: 'var-grid' });
      set.forEach((p) => { const cv = h('canvas'), b = h('button', { class: 'var-tile', type: 'button', 'aria-label': 'Use this variant: ' + p.label, onclick: () => applyVariant(p) }, cv, h('span', { text: p.label })); grid.append(b); try { PS.renderTo(cv, variantPost(p), { scale: 300 / W, exporting: true }); } catch (e) { console.error(e); } });
      vv.append(h('h3', { text: 'Set ' + (si + 1) }), grid);
    });
    vv.append(h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { varSets.push(VARIANT_SETS[varSets.length % VARIANT_SETS.length]()); renderVariants(); } }, 'Generate more'), h('button', { class: 'btn ghost', type: 'button', onclick: () => setVar(false) }, 'Back to the post')));
  }
  function setVar(on) { varMode = on; if (on) { gridMode = false; $('#tgGrid').setAttribute('aria-pressed', 'false'); $('#gridView').hidden = true; } $('#tgVar').setAttribute('aria-pressed', String(on)); $('#varView').hidden = !on; $('#frame').hidden = (on && !isPhone()) || gridMode; $('#safeSvg').style.display = 'none'; if (on) varSets = []; render(); }
  function setGrid(on) { if (on && varMode) setVar(false); gridMode = on; $('#tgGrid').setAttribute('aria-pressed', String(on)); $('#gridView').hidden = !on; $('#frame').hidden = on || varMode; $('#safeSvg').style.display = 'none'; render(); }

  /* ---------- export ---------- */
  // everything that must be true before a single post can leave the studio. Returns true when it can.
  function exportGate() {
    const issue = PS.exportIssue(S), say = (m) => { toast(m); return false; };
    if (issue === 'consent') { selectTab('content'); const n = $('#consentNote'); if (n) n.scrollIntoView({ block: 'center' }); return say('Tick the customer consent box first.'); }
    if (issue === 'demo') { selectTab('content'); const n = $('#demoNote'); if (n) n.scrollIntoView({ block: 'center' }); return say('Type the real customer’s name and words first. Sample text cannot be exported.'); }
    if (issue === 'nodrop') { updateNotices(); return say('A Price Drop needs an old price that is higher than the price.'); }
    if (issue === 'noprice') { updateNotices(); return say('Add the car’s price first. This post needs a real price.'); }
    if (issue === 'samplephoto') { updateNotices(); return say('This post uses a layout-test photo, not one of our cars. Add the real photo first.'); }
    if (issue) { updateNotices(); return say((PS.ISSUE_MSG && PS.ISSUE_MSG[issue]) || 'This post cannot be exported yet.'); }
    if (specShort()) { updateNotices(); return say('The spec row would be short. Add more details, or tap Export anyway under the preview.'); }
    if (demoCarPending()) { updateNotices(); return say('Update the details that still belong to the old car, or confirm they are right.'); }
    if (priceMismatch()) { updateNotices(); return say('The price on this post differs from the stock sheet. Use the stock price or update the sheet.'); }
    if (PS.priceGuess(S.car.price) && tpl().car) { updateNotices(); return say('The price looks wrong (outside ₹50,000 to ₹5 Cr). Check it first.'); }
    return true;
  }
  async function exportCurrent(type) {
    if (!exportGate()) return;
    const prevSlide = S.slide, stock = PS.stockPart(S, S.tpl), name = PS.fileName(S, { type });
    const blob = await PS.exportBlob(S, { type }); S.slide = prevSlide; download(blob, name); PS.commitNumber(stock); renderStage();
    toast(`Exported ${name}`);
  }
  async function exportDm() {
    if (!exportGate()) return; const stock = PS.stockPart(S, S.tpl), r = PS.dmReply(S, S.tpl);
    download(new Blob([r.text], { type: 'text/plain;charset=utf-8' }), `dm-reply_${stock}.txt`);
    toast(r.hasLink ? 'DM reply saved. Paste it into your auto-reply tool.' : 'DM reply saved without a car-page link. Add the car-page base URL in Settings to include one.');
  }
  async function repurpose() {
    if (!exportGate()) return; $('#btnRepurpose').disabled = true; toast('Making five files and five captions…');
    try {
      const r = await PS.repurpose(S); if (!r.items.length || r.blockers.length === PS.CHANNELS.length) { toast('Nothing could be made: ' + r.blockers[0]); return; }
      const zip = await PS.makeZip(r.items); download(zip, `${r.stock}-#${String(r.nn).padStart(2, '0')}-repurpose.zip`); PS.commitNumber(r.stock);
      toast(`Repurposed into ${r.items.filter((i) => i.blob).length} files.` + (r.blockers.length ? ` Skipped: ${r.blockers.join('; ')}` : ''));
    } finally { $('#btnRepurpose').disabled = false; renderStage(); }
  }
  async function exportPair() {
    if (!exportGate()) return; $('#btnPair').disabled = true; toast('Making the guess post and the reveal…');
    try { const r = await PS.guessPair(S); if (r.blockers.length) { toast(r.blockers[0]); return; } download(await PS.makeZip(r.items), `${r.stock}-#${String(r.nn).padStart(2, '0')}-guess-and-reveal.zip`); PS.commitNumber(r.stock); toast('Saved the guess and the reveal. Post the reveal when you promised it.'); }
    finally { $('#btnPair').disabled = false; renderStage(); }
  }
  async function exportFestPack() {
    $('#btnFest').disabled = true; toast('Making the festival pack…');
    try { const r = await PS.festivalPack(S); download(await PS.makeZip(r.items), `${r.stock}-#${String(r.nn).padStart(2, '0')}-festival-${S.x.festival || 'diwali'}-pack.zip`); PS.commitNumber(r.stock); toast(`Festival pack saved: ${r.items.filter((i) => i.blob).length} images and captions.` + (r.blockers.length ? ' ' + r.blockers[0] : '')); }
    finally { $('#btnFest').disabled = false; renderStage(); }
  }
  function updateExportButtons() {
    const t = tpl(); $('#tgVar').hidden = !(t.x || []).includes('accent'); if ($('#tgVar').hidden && varMode) setVar(false);
    $('#btnDm').hidden = !(PS.kwWord(S) && ['reelcover', 'story', 'carousel'].includes(S.tpl));
    $('#btnRepurpose').hidden = !(t.car && !t.carLite && !t.carousel && !t.consent);
    $('#btnPair').hidden = S.tpl !== 'guess'; $('#btnFest').hidden = S.tpl !== 'festival';
  }
  async function exportSlides() {
    if (!exportGate()) return;
    const n = PS.slideCount(S), items = [], prev = S.slide, stock = PS.stockPart(S, 'carousel'), nn = PS.nextNumber(stock), man = [];
    for (let i = 0; i < n; i++) { S.slide = i; const blob = await PS.exportBlob(S, { type: 'png' }), name = PS.fileName(S, { slide: i, nn }); items.push({ name, blob }); man.push(PS.manifestEntry(S, { slide: i, file: name })); }
    S.slide = prev; items.push({ name: 'manifest.json', text: JSON.stringify({ made_with: 'Classic Auto Post Studio', files: man }, null, 1) });
    const zip = await PS.makeZip(items); download(zip, `${stock}-#${String(nn).padStart(2, '0')}-stockcarousel_${S.size}.zip`); PS.commitNumber(stock); renderStage(); toast(`Exported ${n} slides`);
  }

  /* ---------- batch ---------- */
  const batch = { rows: [], photos: {}, };
  function batchTable() {
    const t = $('#batchTable'); t.innerHTML = ''; t.append(h('caption', { class: 'sr', text: 'Cars found in the sheet' })); photoCount();
    if (!batch.rows.length) { t.append(h('tbody', {}, h('tr', {}, h('td', { text: 'Paste a sheet or load the sample stock to see the cars here.' })))); return; }
    t.append(h('thead', {}, h('tr', {}, ['', 'Id', 'Car', 'Year', 'Price', 'Old price', 'Km', 'Status', 'Photo'].map((x) => h('th', { text: x })))));
    t.append(h('tbody', {}, batch.rows.map((r, i) => { const m = PS.matchPhoto(r, batch.photos, batch.rows); const p = PS.parseMoney(r.price);
      return h('tr', {}, h('td', { text: i + 1 }), h('td', { text: r.id }), h('td', { text: [r.make, r.model, r.variant].filter(Boolean).join(' ') }), h('td', { text: r.year }), h('td', PS.priceGuess(r.price) ? { class: 'bad', title: 'Outside ₹50,000 to ₹5 Cr. This car is held back from the ZIP until the price is fixed.', text: (isFinite(p) ? PS.priceText(p) : r.price) + ' (check)' } : { text: isFinite(p) ? PS.priceText(p) : 'No price' }), h('td', { text: PS.parseMoney(r.old_price) > 0 ? PS.priceText(PS.parseMoney(r.old_price)) : '' }), h('td', { text: r.kms }), h('td', { class: PS.isPlaceholderRow(r) ? 'bad' : '', text: PS.isPlaceholderRow(r) ? 'Sample or placeholder' : (r.status || 'available') }),
        h('td', { class: m ? 'ok' : 'bad', text: m ? m : 'No photo found' })); })));
  }
  function photoCount() { const n = Object.keys(batch.photos).length; $('#photoCount').textContent = n ? `${n} photo${n === 1 ? '' : 's'} added.` : 'No photos added yet.'; }
  function parseBatch() { batch.rows = PS.parseCSV($('#csvText').value); batchTable(); }
  // photos, listing-kit folders (cutout.png + listing.json / cars-entry.csv) and CSV files all arrive here. items: [{file, path}]
  async function ingestBatch(items) {
    const kit = await PS.readKit(items.filter((it) => !/\.csv$/i.test(it.file.name) || /cars-entry\.csv$/i.test(it.file.name)));
    const csv = items.filter((it) => /\.csv$/i.test(it.file.name) && !/cars-entry\.csv$/i.test(it.file.name));
    Object.assign(batch.photos, kit.photos);
    let added = 0; const rows = PS.parseCSV($('#csvText').value || '');
    if (kit.rows.length) { kit.rows.forEach((r) => { const i = rows.findIndex((x) => x.id && x.id === r.id); if (i >= 0) rows[i] = Object.assign(rows[i], r); else rows.push(r); added++; }); $('#csvText').value = PS.rowsToCsv(rows); }
    if (csv.length) { $('#csvText').value = await csv[0].file.text(); added = -1; }
    parseBatch();
    const cut = Object.values(kit.photos).filter((i) => i._alpha).length;
    if (kit.rows.length || cut) toast(`Listing kit: ${kit.rows.length} car${kit.rows.length === 1 ? '' : 's'}, ${cut} cut-out${cut === 1 ? '' : 's'} added.`);
  }
  const fileItems = (files) => [...files].map((f) => ({ file: f, path: f.webkitRelativePath || f.name }));
  async function addBatchPhotos(files) { await ingestBatch(fileItems(files)); }
  // a folder dropped on the page: walk it with the entries API
  async function dropItems(dt) {
    const out = [], walk = async (en, path) => {
      if (en.isFile) await new Promise((res) => en.file((f) => { out.push({ file: f, path: path + f.name }); res(); }, res));
      else if (en.isDirectory) { const rd = en.createReader(); let batchR; do { batchR = await new Promise((res) => rd.readEntries(res, () => res([]))); for (const e of batchR) await walk(e, path + en.name + '/'); } while (batchR.length); }
    };
    const its = [...(dt.items || [])].map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)); if (its.some(Boolean)) { for (const en of its) if (en) await walk(en, ''); } else out.push(...fileItems(dt.files));
    return out;
  }
  // the photo for a sheet row: kit cut-outs keep their transparency, so the Signature post puts them on the showroom stage
  const batchPhoto = (key) => { const np = PS.newPhoto(batch.photos[key], key.split('/').pop()); np.alpha = !!batch.photos[key]._alpha; return np; };
  function batchEligible() { const sold = $('#bSold').checked, smp = $('#bSample').checked; return batch.rows.filter((r) => (sold || !/^(sold|booked)/i.test(r.status || '')) && (smp || !PS.isPlaceholderRow(r))); }
  // trust ramp (PS-11): a template runs in batch only after two different posts made with it were approved by a person
  const verKey = (id) => id + '@' + ((PS.TPL[id] && PS.TPL[id].ver) || 'v2');
  const approvedList = (id) => ((PS.settings.approvals || {})[verKey(id)] || []);
  function approveCurrent() {
    if (!exportGate()) return; const id = S.tpl, name = PS.fileName(S, { type: 'png' }).replace(/-#\d+-/, '-'), key = verKey(id);
    PS.settings.approvals = PS.settings.approvals || {}; const list = PS.settings.approvals[key] || (PS.settings.approvals[key] = []);
    if (list.includes(name)) { toast('You already approved this exact post.'); return; }
    list.push(name); PS.saveSettings(); updateApprove(); toast(`Approved. ${tpl().name} has ${list.length} of 2 approvals for batch.`);
  }
  function updateApprove() { const b = $('#btnApprove'); if (!b) return; const n = approvedList(S.tpl).length; b.textContent = n >= 2 ? 'Approved' : `Approve ${n}/2`; b.setAttribute('aria-label', `Approve this post for batch. ${n} of 2 approvals for ${tpl().name}`); }
  async function runZip() {
    if (!batch.rows.length) { toast('Add a stock sheet first.'); return; }
    const rows = batchEligible(), tId = $('#bTpl').value, size = $('#bSize').value, type = $('#bType').value, lang = $('#bLang').value, wantCaps = $('#bCaps').checked;
    // posts that show a customer need one person's consent each, so they are never made in bulk
    if (PS.TPL[tId].consent) { toast('Posts that show a customer cannot be made in batch. Make them one at a time in the Studio.'); return; }
    if (approvedList(tId).length < 2) { const n = approvedList(tId).length; $('#progTxt').textContent = `Batch for ${PS.TPL[tId].name} needs 2 posts you have approved in the Studio first (${n} so far). Make one post with this template, check it, press Approve, and do it twice.`; $('#prog').hidden = false; toast('Approve 2 single posts with this template first.'); return; }
    const mkBase = (id, sz) => { const b0 = Object.assign(PS.newState(), { tpl: id, size: sz, lang, garage: S.garage, carousel: S.carousel }); PS.applyTemplateDefaults(b0, PS.TPL[id]); b0.badges = (PS.TPL[id].badges || []).slice(); return b0; };
    const prog = $('#prog'), bar = $('#progBar'), txt = $('#progTxt'); prog.hidden = false; $('#btnZip').disabled = true;
    const items = [], caps = [], man = [], skipped = [], noDrop = [], badPrice = []; let i = 0;
    for (const r of rows) {
      txt.textContent = `Rendering ${++i} of ${rows.length}: ${r.make} ${r.model}`; bar.style.width = (i / rows.length * 90) + '%';
      const sold = /^(sold|booked)/i.test(r.status || ''), useId = sold ? 'newarrival' : tId;     // sold and booked cars get the SOLD / BOOKED stamp, never "Just Arrived" (F-14)
      const useSize = sold && !PS.TPL.newarrival.sizes.includes(size) ? PS.TPL.newarrival.def : size;
      // a price outside ₹50,000 to ₹5 Cr is a typo (1500 for 15 lakh): the Studio refuses it, so the batch holds the row back and says so
      if (PS.rowToCar(r).priceFlag) { badPrice.push(`${r.id || r.model} (${r.price})`); continue; }
      // a Price Drop post is only honest when the sheet gives an old price that is higher than the price
      if (useId === 'pricedrop') { const o = PS.parseMoney(r.old_price), n = PS.parseMoney(r.price); if (!(o > n && n > 0)) { noDrop.push(r.id || r.model); continue; } }
      const m = PS.matchPhoto(r, batch.photos, batch.rows); if (!m) { skipped.push(r.id || r.model); continue; }
      const car = PS.rowToCar(r), b0 = mkBase(useId, useSize), S2 = Object.assign({}, b0, { tpl: useId, size: useSize, car, photos: { main: batchPhoto(m), second: null, hero: null }, x: Object.assign({}, b0.x), badges: b0.badges.slice(), slide: 0 });
      if (sold) { S2.badges = []; S2.x.stamp = /^book/i.test(r.status) ? 'booked' : 'sold'; }
      if (useId === 'pricedrop') { S2.x.oldPosted = car.oldPostedOn || ''; S2.x.validity = car.offerUntil || ''; }
      if (PS.TPL[useId].x.includes('tagline') && car.tagline) S2.x.tagline = car.tagline;
      if (PS.exportIssue(S2, useId) === 'samplephoto') { skipped.push(r.id || r.model); continue; }
      const stock = PS.stockPart(S2, useId); let name = PS.fileName(S2, { tpl: useId, size: useSize, type });
      const blob = await PS.exportBlob(S2, { tpl: useId, size: useSize, type }); PS.commitNumber(stock);
      if (items.some((x) => x.name === name)) name = name.replace(/(\.\w+)$/, `_${PS.slug(car.id)}$1`);
      items.push({ name, blob }); man.push(PS.manifestEntry(S2, { tpl: useId, size: useSize, file: name }));
      if (wantCaps) { PS.lang = lang; caps.push(`=== ${name} ===\n${PS.caption(S2, lang === 'en' ? 'en' : 'hn').text}\n`); }
      await new Promise((res) => setTimeout(res, 0));
    }
    if (!items.length) { txt.textContent = badPrice.length && badPrice.length === rows.length ? `Every price is outside ₹50,000 to ₹5 Cr (${badPrice.join(', ')}). Fix the price column and run again.` : useIdNoDrop(tId, noDrop, rows) ? 'No car has an old price higher than its price, so there is no price drop to show. Add an old_price column.' : 'No cars had a matching photo. Add photos named like the photos column or the car id.'; $('#btnZip').disabled = false; return; }
    items.push({ name: 'manifest.json', text: JSON.stringify({ made_with: 'Classic Auto Post Studio', template: tId, size, language: lang, files: man }, null, 1) });
    if (wantCaps) items.push({ name: 'captions.txt', text: caps.join('\n') });
    txt.textContent = 'Zipping…'; const zip = await PS.makeZip(items, (p) => { bar.style.width = (90 + p / 10) + '%'; });
    download(zip, `classicauto_${PS.TPL[tId].file}_${size}_batch.zip`); bar.style.width = '100%';
    const hid = batch.rows.filter(PS.isPlaceholderRow).length;
    txt.textContent = `Done. ${items.filter((x) => x.blob).length} posts in the ZIP.` + (hid && !$('#bSample').checked ? ` Left out ${hid} sample or placeholder row${hid === 1 ? '' : 's'} (tick the box to include).` : '') + (skipped.length ? ` Skipped without a photo: ${skipped.join(', ')}.` : '') + (noDrop.length ? ` Skipped, no old price above the price: ${noDrop.join(', ')}.` : '') + (badPrice.length ? ` Held back, price outside ₹50,000 to ₹5 Cr (check the digits): ${badPrice.join(', ')}.` : '');
    $('#btnZip').disabled = false; PS.lang = S.lang;
  }
  const useIdNoDrop = (tId, noDrop, rows) => tId === 'pricedrop' && noDrop.length === rows.length;
  async function useAsGarage() {
    const rows = batchEligible(); if (!rows.length) { toast('Add a stock sheet first.'); return; }
    S.garage = rows.map((r) => { const car = PS.rowToCar(r); const m = PS.matchPhoto(r, batch.photos, batch.rows); car.photoObj = m ? batchPhoto(m) : null; if (!car.id) car.id = 'CA-' + Math.random().toString(36).slice(2, 6); return car; });
    S.carousel.ids = S.garage.slice(0, 4).map((c) => c.id); buildGarage(); toast(`${S.garage.length} cars are now in the Garage.`);
  }
  function initBatch() {
    $('#csvCols').textContent = PS.CSV_COLUMNS.join(', ');
    const carTpls = PS.TEMPLATES.filter((t) => t.car && !t.carLite && !t.carousel && !t.consent);   // customer posts are one at a time
    $('#bTpl').append(...carTpls.map((t) => h('option', { value: t.id, text: t.name })));
    const fillSizes = () => { const t = PS.TPL[$('#bTpl').value]; $('#bSize').innerHTML = ''; $('#bSize').append(...t.sizes.map((s) => h('option', { value: s, text: s.replace('x', ' × ') + ' ' + (PS.SIZE_LABEL[s] || '') }))); $('#bSize').value = t.def; };
    $('#bTpl').addEventListener('change', fillSizes); fillSizes();
    let tm = 0; $('#csvText').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(parseBatch, 300); });
    $('#csvFile').addEventListener('change', async (e) => { const f = e.target.files[0]; if (f) { $('#csvText').value = await f.text(); parseBatch(); } e.target.value = ''; });
    // copy the FileList first: clearing the input empties the live list while the async loop is still reading it
    $('#batchPhotos').addEventListener('change', (e) => { const fs = [...e.target.files]; e.target.value = ''; addBatchPhotos(fs); });
    const bd = $('#batchDrop'); ['dragenter', 'dragover'].forEach((ev) => bd.addEventListener(ev, (e) => { e.preventDefault(); bd.classList.add('over'); })); ['dragleave', 'drop'].forEach((ev) => bd.addEventListener(ev, (e) => { e.preventDefault(); bd.classList.remove('over'); }));
    bd.addEventListener('drop', async (e) => { const its = await dropItems(e.dataTransfer); ingestBatch(its); });
    $('#kitFolder').addEventListener('change', (e) => { const fs = [...e.target.files]; e.target.value = ''; addBatchPhotos(fs); });
    $('#btnTemplate').addEventListener('click', () => { const head = PS.CSV_COLUMNS.join(','), ex = PS.CSV_COLUMNS.map((k) => ({ id: 'CA-201', make: 'Hyundai', model: 'Creta', variant: 'SX 1.5 Diesel', year: 2022, price: '15.5L', kms: 31000, owners: 1, fuel: 'Diesel', trans: 'Automatic', colour: 'White', photos: 'CA-201.jpg', status: 'available' }[k] || '')).join(','); download(new Blob([head + '\n' + ex + '\n'], { type: 'text/csv' }), 'classic-auto-stock-template.csv'); toast('Template saved. Replace the example row with your cars.'); });
    $('#btnOneByOne').addEventListener('click', () => { location.hash = '#studio'; selectTab('garage'); toast('Open a car in the Studio, or press Add a new car.'); });
    $('#btnSample').addEventListener('click', async () => {
      $('#csvText').value = PS.sampleCsv();
      for (const c of PS.SEED_CARS) { try { batch.photos[c.id + '.jpg'] = await PS.loadImage(c.photo); } catch (e) { /* missing crop: that car is reported as having no photo */ } }
      parseBatch(); toast('The 7 stock cars and their photos are loaded');
    });
    $('#btnZip').addEventListener('click', runZip); $('#btnGarage').addEventListener('click', useAsGarage); batchTable();
  }

  /* ---------- calendar ---------- */
  const CAL_START = [2026, 9];
  // the calendar opens on the month of today (when today is inside the planned range), and scrolls to today once
  let calFilter = 'all', calScrolled = false, calIdx = (() => { const n = new Date(), i = (n.getFullYear() - CAL_START[0]) * 12 + n.getMonth() - CAL_START[1]; return Math.max(0, Math.min(6, i)); })();
  const TAG_LABEL = { reel: 'REEL', trial: 'TEST FIRST', carousel: 'CAROUSEL', festival: 'GREETING', story: 'STORY', status: 'STATUS', F1: 'WALKAROUND', F2: 'DELIVERY DAY', F3: 'SINCE 1974', F4: 'PRICE GAME', F5: 'BUYER TIPS' };
  const TAG_TITLE = { trial: 'Publish this one as a Trial Reel first: it is shown to non-followers only', F1: 'A walkaround of a car', F2: 'A delivery day (needs the customer’s consent)', F3: 'The Since 1974 series', F4: 'A price game', F5: 'Tips that build buyer trust' };
  function renderCal() {
    const y = CAL_START[0] + Math.floor((CAL_START[1] + calIdx) / 12), m = (CAL_START[1] + calIdx) % 12, first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
    $('#calTitle').textContent = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    $('#calPrev').disabled = calIdx <= 0; $('#calNext').disabled = calIdx >= 6;
    const mon = { reel: 0, trial: 0, carousel: 0, festival: 0 };
    const cal = $('#cal'); cal.innerHTML = ''; ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d) => cal.append(h('div', { class: 'dow', text: d })));
    const lead = (first.getDay() + 6) % 7; for (let i = 0; i < lead; i++) cal.append(h('div', { class: 'day out', 'aria-hidden': 'true' }));
    const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;   // local date, not UTC
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, info = PS.dayInfo(iso), dow = new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
      const prim = info.items[0], planned = !!PS.PLAN[iso], tg = [...new Set(info.items.flatMap((it) => it.tags || []).concat(info.events.some((e) => e.tpl) ? ['festival'] : []))];
      mon.reel += tg.includes('reel') ? 1 : 0; mon.trial += tg.includes('trial') ? 1 : 0; mon.carousel += tg.includes('carousel') ? 1 : 0; mon.festival += info.events.some((e) => e.tpl) ? 1 : 0;
      const hit = calFilter === 'all' || tg.includes(calFilter);
      const past = iso < today, cell = h('div', { class: 'day' + (iso === today ? ' today' : '') + (past ? ' past' : '') + (prim && prim.kind !== 'weekly' ? '' : ' wk') + (hit ? '' : ' dim') }, h('div', { class: 'n' }, h('span', { text: d }), h('small', { text: iso === today ? 'Today' : dow })));
      if (iso === today) cell.id = 'calToday';
      info.events.forEach((e) => { if (e.tpl) cell.append(h('button', { class: 'ev', type: 'button', onclick: (ev) => { ev.stopPropagation(); openItem({ tpl: e.tpl, x: e.x, label: e.label }); } }, e.label)); else cell.append(h('span', { class: 'ev info', text: e.label })); });
      if (tg.length) cell.append(h('div', { class: 'tgs' }, tg.filter((t2) => t2 !== 'post').map((t2) => h('span', { class: 'tg ' + t2, text: TAG_LABEL[t2] || t2, title: TAG_TITLE[t2] || '' }))));
      if (prim) { cell.append(h('div', { class: 'pl' }, h('em', { text: planned ? 'Planned' : 'Weekly rhythm' + (prim.tags && prim.tags.includes('trial') ? ' · test first' : '') }), PS.plainLabel(prim.label)));
        if (!past) cell.append(h('button', { class: 'go', type: 'button', 'aria-label': `Open ${PS.TPL[prim.tpl].name} for ${dow} ${d}`, onclick: (ev) => { ev.stopPropagation(); openItem(prim); } }, 'Open ' + PS.TPL[prim.tpl].name));
        if (info.story) cell.append(h('div', { class: 'pl' }, h('em', { text: 'Stories' }), PS.plainLabel(info.story)));
        cell.addEventListener('click', () => openItem(prim)); }
      cal.append(cell);
    }
    $('#calSummary').textContent = `${first.toLocaleDateString('en-IN', { month: 'long' })}: ${mon.reel} reel day${mon.reel === 1 ? '' : 's'}, ${mon.trial} to test as Trial Reels first, ${mon.carousel} carousel${mon.carousel === 1 ? '' : 's'}, ${mon.festival} festival greeting${mon.festival === 1 ? '' : 's'}.`;
    calMonth = { y, m };
    const td = $('#calToday'); if (td && !calScrolled) { calScrolled = true; setTimeout(() => td.scrollIntoView({ block: 'center' }), 50); }
  }
  let calMonth = null;
  // the visible month as a CSV (date, weekday, tags, plan, template, stories, events)
  function calCsv() {
    const { y, m } = calMonth, days = new Date(y, m + 1, 0).getDate(), cell = (v) => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }, rows = [['date', 'weekday', 'tags', 'plan', 'template', 'stories', 'events']];
    for (let d = 1; d <= days; d++) { const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, info = PS.dayInfo(iso), it = info.items[0];
      rows.push([iso, new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' }), [...new Set(info.items.flatMap((x) => x.tags || []))].filter((t2) => t2 !== 'post').join(' '), it ? it.label : '', it ? PS.TPL[it.tpl].name : '', info.story || '', info.events.map((e) => e.label).join('; ')]); }
    return rows.map((r) => r.map(cell).join(',')).join('\n');
  }
  function openItem(it) {
    const t = PS.TPL[it.tpl]; S.x = Object.assign({}, S.x, it.x || {});
    if (it.car) { loadCar(it.car); if (t.carousel && !S.carousel.ids.includes(it.car.id)) S.carousel.ids = [it.car.id].concat(S.carousel.ids).slice(0, 6); }
    if (it.x && it.x.festival) { if (it.x.festDate === undefined) S.x.festDate = PS.FESTIVALS[it.x.festival].d; if (it.x.festWish === undefined) S.x.festWish = ''; }      // a preset's own wish line (Saal Mubarak) is kept
    S.badgesTouched = false; location.hash = '#studio'; setTemplate(it.tpl); if (it.size && t.sizes.includes(it.size)) setSize(it.size); toast(`Opened ${t.name}${it.label ? ': ' + it.label : ''}`);
  }
  function initCal() {
    $('#cadence').append(...PS.CADENCE.map((c) => h('li', {}, h('b', { text: c[0] }), h('span', { text: c[1] }))));
    $('#calPrev').addEventListener('click', () => { calIdx = Math.max(0, calIdx - 1); renderCal(); }); $('#calNext').addEventListener('click', () => { calIdx = Math.min(6, calIdx + 1); renderCal(); });
    $$('#calFilter button').forEach((b) => b.addEventListener('click', () => { calFilter = b.dataset.f; $$('#calFilter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); renderCal(); }));
    $('#calCsv').addEventListener('click', () => { download(new Blob(['\ufeff' + calCsv()], { type: 'text/csv;charset=utf-8' }), `classicauto-plan-${calMonth.y}-${String(calMonth.m + 1).padStart(2, '0')}.csv`); toast('Plan saved as a CSV'); });
    renderCal(); initPlan();
  }
  /* ---------- one video, five posts ---------- */
  let planRes = null;
  function planText() {
    if (!planRes) return ''; const r = planRes;
    return [`One video, five posts: ${r.name}. Hook: ${r.hook}`, ''].concat(r.items.map((it, i) => `${i + 1}. ${it.date} (day ${it.day}) · ${it.channel}${it.trial ? ' · TEST AS A TRIAL REEL FIRST' : ''}\n   ${it.what}\n   Open: ${PS.TPL[it.tpl].name}, ${it.size.replace('x', '×')}\n   Caption starts: ${it.hook}\n   ${it.note}`)).concat(['', 'Facebook comes by crosspost from Instagram. YouTube Shorts: same video, car-page link in the description. No TikTok (banned in India).']).join('\n');
  }
  function renderPlan() {
    const out = $('#planOut'); out.innerHTML = ''; if (!planRes) return; const r = planRes;
    out.append(h('ol', { class: 'plan-list' }, r.items.map((it) => h('li', {},
      h('div', { class: 'pl-top' }, h('b', { text: new Date(it.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) }), h('span', { class: 'pl-day', text: it.day === 0 ? 'Day 0' : `Day ${it.day}` }), it.tags.map((t2) => h('span', { class: 'tg ' + t2, text: TAG_LABEL[t2] || t2.toUpperCase() }))),
      h('div', { class: 'pl-ch', text: it.channel }), h('p', { text: it.what }), h('p', { class: 'help', text: 'Caption starts: ' + it.hook }), h('p', { class: 'help', text: it.note }),
      h('button', { class: 'btn sm', type: 'button', onclick: () => openItem({ tpl: it.tpl, x: Object.assign({ reelTitle: r.hook, kw: r.kw }, it.tpl === 'reelcover' ? { reelPrice: r.price } : {}), car: r.car, size: it.size, label: r.name }) }, `Open ${PS.TPL[it.tpl].name}`)))));
    out.append(h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(planText()); } catch (e) { /* ignore */ } toast('Plan copied'); } }, 'Copy the plan'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { download(new Blob([planText()], { type: 'text/plain;charset=utf-8' }), `classicauto-one-video-plan_${PS.slug(r.name)}.txt`); toast('Plan saved'); } }, 'Download (.txt)')));
  }
  // the car list follows the Garage: it is rebuilt every time the calendar opens, and a car is chosen by its id (not by its position in the list)
  const planKey = (c, i) => c.id || '#' + i;
  function fillPlanCars() {
    const sel = $('#planCar'), keep = sel.value; sel.innerHTML = ''; sel.append(...S.garage.map((c, i) => h('option', { value: planKey(c, i), text: [c.year, c.make, c.model].filter(Boolean).join(' ') })));
    if (keep && [...sel.options].some((o) => o.value === keep)) sel.value = keep;
  }
  function initPlan() {
    const sel = $('#planCar'); fillPlanCars();
    $('#planHooks').innerHTML = ''; $('#planHooks').append(...PS.HOOKS.map((k) => h('option', { value: k.t[0] }))); $('#planDate').value = PS.toISODate(PS.today());
    $('#planGo').addEventListener('click', () => {
      const car = S.garage.find((c, i) => planKey(c, i) === sel.value) || S.car, hook = $('#planHook').value.trim() || 'First look', kw = $('#planKw').value.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 16), hk = PS.HOOKS.find((k) => k.t.includes(hook));
      const items = PS.planFromVideo(S, { car, hook, start: $('#planDate').value, kw }); planRes = { items, car, hook, kw, price: hk ? hk.price : 'show', name: [car.year, car.make, car.model].filter(Boolean).join(' ') }; renderPlan();
    });
  }

  /* ---------- brand kit ---------- */
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16), f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return ((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(1); };
  function renderBrand() {
    const root = $('#brandRoot');
    const sw = [['CA Red', B.red, 'Price and one focal word only', '#fff'], ['CA Blue', B.blue, 'The logo’s blue: rules and names on cream', '#fff'], ['Deep navy', B.deep, 'Canvas for dark posts', '#fff'], ['Card navy', B.card, 'Cards on the canvas', '#fff'], ['Off-white', B.off, 'Cream posts, text on navy', B.deep], ['Cream plate', B.cream, 'The logo plate, always', B.deep]];
    root.innerHTML = `
    <header class="pg-head"><h1>Brand kit</h1><p>The rules every template already follows. Use them when you make something by hand.</p></header>
    <section class="b-sec"><h2>Logo</h2>
      <div class="b-grid">
        <figure class="lg" style="background:${B.cream};margin:0"><img src="assets/logo.png" alt="Classic Auto logo on the cream plate"><figcaption style="color:${B.deep}">On the cream plate. The default.</figcaption></figure>
        <figure class="lg" style="background:${B.deep};margin:0"><span class="plate" style="padding:14px 18px"><img src="assets/logo.png" alt="Classic Auto logo on a plate over navy" style="width:200px;height:auto"></span><figcaption>On navy, always on the plate.</figcaption></figure>
        <figure class="lg" style="background:#fff;margin:0"><img src="assets/logo.png" alt="Classic Auto logo on white"><figcaption style="color:${B.deep}">On white. Print and documents.</figcaption></figure>
      </div>
      <div class="dd">
        <div class="do"><h3>Do</h3><ul>
          <li>Use the logo file as supplied. Never redraw it or retype “Classic-Auto”.</li>
          <li>Use “PRE - OWNED LUXURY CARS” in the header from ₹35 L (a per-car override exists).</li>
          <li>Keep clear space around the plate equal to the height of the “A” in the logo.</li>
          <li>Classic Listing (the house post): the logo sits top-left on the white header, no plate needed on white, with “PRE - OWNED CARS · TRUSTED ALWAYS” beside it.</li>
          <li>Dark and photo posts: the logo goes on the cream plate (#F5F2EC). Stories and reel covers: below the top 250 px.</li></ul></div>
        <div class="dont"><h3>Don’t</h3><ul>
          <li>Stretch, squash, rotate or recolour the logo.</li>
          <li>Place the logo straight on a photo or on a red background.</li>
          <li>Add shadows, outlines or effects to the logo.</li>
          <li>Crop the logo, or let it touch the edge of the post.</li>
          <li>Write “1975”. The year is 1974.</li></ul></div>
      </div>
      <div class="dont-vis">
        <div class="dv"><img src="assets/logo.png" alt="" style="transform:scaleX(1.7)"><span>Stretched</span></div>
        <div class="dv"><img src="assets/logo.png" alt="" style="filter:hue-rotate(120deg) saturate(1.5)"><span>Recoloured</span></div>
        <div class="dv" style="background:${B.red}"><img src="assets/logo.png" alt=""><span style="color:#fff">On red</span></div>
        <div class="dv"><img src="assets/logo.png" alt="" style="transform:rotate(-14deg);filter:drop-shadow(6px 8px 6px rgba(0,0,0,.5))"><span>Tilted, shadowed</span></div>
      </div>
      <div class="row"><a class="btn" href="assets/logo.png" download>Download logo.png</a></div>
    </section>
    <section class="b-sec"><h2>Logo sting</h2>
      <p class="help">A 1.9 second animation of the real logo (the C and A wipe in, then the name, SINCE 1974 and PRE OWNED CARS, then a short hold). Use it at the start or end of a reel. It records in your browser and nothing is uploaded.</p>
      <div class="row" id="stingBtns"></div><p class="help" id="stingMsg" role="status"></p></section>
    <section class="b-sec"><h2>The house post: Classic Auto — Signature (the Classic Listing)</h2>
      <div class="zone">
        <div><b>Layout</b>White showroom ground. Header with logo and tagline, registration card top-right, make and MODEL as a text wordmark, variant pill, fuel and gearbox, PRICE box, the car on the right, a spec icon row, a navy contact · address · brand bar, then BUY · SELL · EXCHANGE · UPGRADE.</div>
        <div><b>Accent</b>Navy by default. Racing green, maroon or black per post (it drives the model, pill, price box and footer).</div>
        <div><b>Spec row (up to 5 cells, values 26 px or more, labels 20 px or more)</b>Owner · Driven · Registration (RTO code only) · Insurance (valid till, or EXPIRED) · Colour · Seats, plus up to two chips you type. Fuel and gearbox are printed big under the model name, so the row does not repeat them. Fewer than four cells sit together in the middle.</div>
        <div><b>Contact bar</b>No phone set: “DM US @classicauto_1974” and the address. Phone set: “CALL NOW” and the number. Nothing else to edit.</div>
        <div><b>Address</b>135/136, 1st Floor, Prabhu Plaza, S.V. Road, near Malad Railway Station, Malad West, Mumbai, on two lines of 20 px or more. In Latin script in every language (captions may add “next to Shankar Mandir”). The GST address is never printed.</div>
        <div><b>Photo</b>Photo-forward by default: the car runs to the edges of the post and fades into the white (no frame). The older rounded frame is one choice away (Photo style). A cut-out car (a PNG with a transparent background, such as the listing kit’s cutout.png) sits on a drawn showroom stage and the post says “background edited, car unretouched”. Soft edge is the old look.</div>
        <div><b>Carousel</b>The Signature carousel uses the same parts: a cover with the hero car, lineup tiles, one Signature post per car and a closing slide.</div>
        <div><b>Sizes</b>1080×1350 is the default: it is safe for the profile grid. 1080×1080 is cropped to the centre 3:4 in the grid, so the left of the wordmark and the price can be cut. Story 1080×1920 and 1920×1080 are available.</div>
      </div></section>
    <section class="b-sec"><h2>Colour</h2><div class="b-grid">${sw.map((s) => `<div class="sw"><i style="background:${s[1]}"></i><div><b>${s[0]}</b><code>${s[1]}</code><br>${s[2]}<br><small>${s[3] === '#fff' ? 'White' : 'Navy'} text: ${ratio(s[1], s[3] === '#fff' ? '#FFFFFF' : B.deep)}:1</small></div></div>`).join('')}</div>
      <p class="help">Red is for the price and one focal word per post. On navy, red text is for large type only (3.7:1 against deep navy). Body copy stays off-white or navy for 4.5:1 or better.</p></section>
    <section class="b-sec"><h2>Type</h2><div class="b-grid">
      <div class="type-s"><div class="big">₹76,99,999</div><b>Manrope 800 · Bebas Neue</b><small>Prices print in full rupees (₹76,99,999), never rounded up. The short style (₹76.99 L) cuts, it does not round. Bebas Neue for headlines on the dark templates.</small></div>
      <div class="type-s"><div class="mid">42,000 km · Diesel</div><b>Manrope 600 to 800</b><small>Specs at 34 to 40 px, never below 30. Footer 28 px.</small></div>
      <div class="type-s"><div class="hi">दिवाली की शुभकामनाएँ</div><b>Noto Sans Devanagari</b><small>Used automatically when the text language is Hindi.</small></div></div></section>
    <section class="b-sec"><h2>Sizes and safe zones</h2><div class="zone">
      <div><b>Feed 1080×1350</b>The grid shows the centre 1012 px. Keep text and the car’s key edges 50 px from the sides.</div>
      <div><b>Story 1080×1920</b>Keep 250 px clear at the top and 340 px at the bottom. Link sticker sits at y 1250 to 1500.</div>
      <div><b>Reel cover 1080×1920</b>The grid shows the centre 1440 px. Title goes between y 480 and 1200.</div>
      <div><b>YouTube 1280×720</b>Content in the centre 1100×620. Leave the bottom-right 15% for the timestamp. Three words at most.</div>
      <div><b>Google cover 1080×608</b>Centre the key content in a 560×200 block.</div>
      <div><b>Facebook cover 820×360</b>Mobile trims about 90 px each side. Keep text inside the centre 640.</div></div></section>
    <section class="b-sec"><h2>Rules for every post</h2><div class="dd">
      <div class="do"><h3>Always</h3><ul>
        <li>Prices as ₹25,50,000 (Indian format, rupee sign). Short style truncates: 76,99,999 is ₹76.99 L, never ₹77.00 L.</li>
        <li>EMI as “Est. EMI ₹X/mo*” with the estimate footnote.</li>
        <li>Crop, position, zoom, brightness and contrast only. Label edited photos.</li>
        <li>Get the customer’s consent before you post their photo or words, and use their real name and words.</li>
        <li>Number plates: the tool never paints over a car unless you switch on the plate-blur tool in Settings. That blur is the only change to a car’s pixels and the post says “number plate blurred”.</li>
        <li>Say where a photo came from. Photos cropped from our Instagram listing are labelled until a walk-around photo replaces them.</li>
        <li>Break up runs of listing cards with a reel cover or a festival post.</li></ul></div>
      <div class="dont"><h3>Never</h3><ul>
        <li>Remove dents, change a car’s colour or generate a car.</li>
        <li>Print a phone number that is not the one in Settings. The two numbers on the old posts are not used. With none set, posts say DM @classicauto_1974.</li>
        <li>Use a manufacturer’s logo, roundel or slogan. The make is set as text. The optional tagline is your own words.</li>
        <li>Invent a deadline, a price, a stat or an inspection claim. No “Offer valid till” unless you type a future date.</li>
        <li>Post a sample customer, name or quote. Anything stamped SAMPLE is only a layout preview.</li>
        <li>Show EMI as a promise, or say “discount” or “You save” unless the old price really was posted earlier and you switch it on.</li>
        <li>Print the GST registration address. The showroom is Prabhu Plaza.</li>
        <li>Upload photos anywhere. This tool never leaves your browser.</li></ul></div></div></section>`;
    const sb = $('#stingBtns'), sm = $('#stingMsg');
    PS.sting.SIZES.forEach((sz) => sb.append(h('button', { class: 'btn', type: 'button', onclick: async (e) => {
      const btn = e.currentTarget; btn.disabled = true; sm.textContent = `Recording ${sz.replace('x', '×')}… about 2 seconds.`; const [W, H] = PS.parseSize(sz);
      try { await PS.loadFonts(); const blob = await PS.sting.record(W, H), stock = 'CA-brand', nn = PS.nextNumber(stock); download(blob, `${stock}-#${String(nn).padStart(2, '0')}-logo-sting_${sz}.webm`); PS.commitNumber(stock); sm.textContent = `Saved ${sz.replace('x', '×')} (WebM).`; }
      catch (err) { sm.textContent = err.message || 'Could not record the sting.'; } finally { btn.disabled = false; }
    } }, `Record ${sz.replace('x', '×')}`)));
  }

  /* ---------- settings dialog ---------- */
  let openSettings = () => {};
  function initSettings() {
    const dlg = $('#dlgSettings'), upd = () => { const k = PS.contact(); $('#waState').textContent = k.hasPhone ? k.phone : 'Phone: not set'; $('#btnSettings').setAttribute('aria-label', k.hasPhone ? `Settings. Business phone ${k.phone}` : 'Settings. Business phone is not set yet'); };
    const sync = () => { $('#setWaRow').hidden = $('#setWaSame').checked; };
    const open = () => {
      const st = PS.settings; $('#setPhone').value = st.phone || ''; $('#setWaSame').checked = !!st.waSame; $('#setWa').value = st.whatsapp || ''; $('#setSite').value = st.siteUrl || ''; $('#setPrice').value = st.priceStyle === 'short' ? 'short' : 'full'; $('#setEmi').value = st.emiRate || '';
      $('#setAdj').checked = !!st.showAdj; $('#setInsp').checked = !!st.claimInspected; sync(); dlg.showModal();
    };
    openSettings = open; upd(); $('#btnSettings').addEventListener('click', open); $('#setWaSame').addEventListener('change', sync);
    dlg.addEventListener('close', () => {
      if (dlg.returnValue !== 'ok') return; const st = PS.settings;
      const one = (v) => (PS.hasManyNumbers(v) ? PS.firstNumber(v) : v.trim()), many = PS.hasManyNumbers($('#setPhone').value) || PS.hasManyNumbers($('#setWa').value);      // one number per field: a second number would be cut mid-number on the post
      st.phone = one($('#setPhone').value); st.waSame = $('#setWaSame').checked; st.whatsapp = one($('#setWa').value); st.siteUrl = $('#setSite').value.trim(); st.priceStyle = $('#setPrice').value; st.emiRate = $('#setEmi').value.trim();
      st.showAdj = $('#setAdj').checked; st.claimInspected = $('#setInsp').checked; PS.saveSettings(); upd(); changed(); scheduleThumbs(); buildContent(); buildPhoto(); toast(st.emiRate && !PS.emiOn() ? 'Settings saved, but the EMI rate must be between 5 and 30 percent a year. EMI lines stay off until it is.' : many ? 'Settings saved. A post prints one number, so only the first one was kept.' : 'Settings saved');
    });
    if (PS._migrated) setTimeout(() => toast('Your old WhatsApp number is now the WhatsApp field. Add the business phone to show CALL NOW.'), 600);
  }

  /* ---------- routing ---------- */
  function route() {
    const v = (location.hash || '#studio').slice(1); const view = ['studio', 'batch', 'calendar', 'brand'].includes(v) ? v : 'studio';
    $$('.view').forEach((s) => { s.hidden = s.id !== 'view-' + view; });
    $$('#nav a').forEach((a) => { if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (view === 'studio') render(); if (view === 'calendar') { renderCal(); fillPlanCars(); } if (view === 'brand' && !$('#brandRoot').children.length) renderBrand();
    window.scrollTo(0, 0);
  }

  /* ---------- init ---------- */
  async function init() {
    await PS.loadFonts();
    S = PS.newState(); PS.S = S; S.lang = PS.settings.lang || 'en';
    S.garage = PS.SEED_CARS.map((c) => Object.assign({}, c)); await Promise.all(S.garage.map(PS.hydrateCar));
    S.carousel.ids = S.garage.slice(0, 4).map((c) => c.id); loadCar(S.garage[0]);
    buildLibrary(); initPointer(); initBatch(); initCal(); initSettings();
    $$('.tabs [role=tab]').forEach((b) => b.addEventListener('click', () => selectTab(b.id.replace('tab-', ''))));
    $('.tabs').addEventListener('keydown', (e) => { const tabs = $$('.tabs [role=tab]'), i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'); if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); selectTab(n.id.replace('tab-', '')); } });
    $('#sizeSel').addEventListener('change', (e) => setSize(e.target.value));
    { const lib = $('.lib'), tog = (on) => { lib.classList.toggle('open', on); $('#libBtn').setAttribute('aria-expanded', String(on)); }; $('#libBtn').addEventListener('click', () => tog(!lib.classList.contains('open'))); $('#libClose').addEventListener('click', () => { tog(false); $('#libBtn').focus(); }); document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lib.classList.contains('open')) { tog(false); $('#libBtn').focus(); } }); lib.addEventListener('click', (e) => { if (e.target === lib) tog(false); }); }
    $('#langSel').value = S.lang; $('#langSel').addEventListener('change', (e) => { const b = $(`#langSeg button[data-lang="${e.target.value}"]`); if (b) b.click(); });
    $('#btnFull').addEventListener('click', () => { const d = $('#dlgFull'), cv = $('#cvFull'), [W, H] = PS.parseSize(S.size), sc = Math.min(1, Math.min(window.innerWidth * 0.94 / W, window.innerHeight * 0.84 / H)); PS.renderTo(cv, S, { scale: sc }); cv.style.width = Math.round(W * sc) + 'px'; cv.style.height = Math.round(H * sc) + 'px'; d.showModal(); });
    $$('#langSeg button').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)); b.addEventListener('click', () => { S.lang = b.dataset.lang; $('#langSel').value = S.lang; PS.settings.lang = S.lang; PS.saveSettings(); $$('#langSeg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); PS.followLanguage(S, tpl()); buildContent(); changed(); }); });
    $('#tgSafe').addEventListener('click', (e) => { safeOn = !safeOn; e.currentTarget.setAttribute('aria-pressed', String(safeOn)); if (gridMode) setGrid(false); render(); });
    $('#tgGrid').addEventListener('click', () => setGrid(!gridMode)); $('#tgVar').addEventListener('click', () => setVar(!varMode));
    $('#btnPair').addEventListener('click', exportPair); $('#btnFest').addEventListener('click', exportFestPack); $('#btnApprove').addEventListener('click', approveCurrent); $('#btnDm').addEventListener('click', exportDm); $('#btnRepurpose').addEventListener('click', repurpose);
    $('#btnMore').addEventListener('click', (e) => { const on = !$('#exMore').classList.contains('open'); $('#exMore').classList.toggle('open', on); e.currentTarget.setAttribute('aria-expanded', String(on)); });
    $('#exMore').addEventListener('click', (e) => { if (e.target.closest('button')) { $('#exMore').classList.remove('open'); $('#btnMore').setAttribute('aria-expanded', 'false'); } });
    $('#btnPng').addEventListener('click', () => exportCurrent('png')); $('#btnJpg').addEventListener('click', () => exportCurrent('jpg')); $('#btnZipSlides').addEventListener('click', exportSlides);
    window.addEventListener('hashchange', route); new ResizeObserver(() => render()).observe($('#canvasWrap'));
    PS.carStale = () => staleFields().length > 0;       // the festival pack asks this before it prints a car's name
    PS.app = { setTemplate, setSize, render: renderStage, S: () => S, openItem, setGrid, selectTab };
    setTemplate('newarrival'); renderThumbs(); route(); updateNotices(); window.PS_READY = true;
  }
  init().catch((e) => { console.error(e); document.body.prepend(h('pre', { style: 'color:#fff;padding:20px', text: 'Could not start: ' + e.message })); });
})();
