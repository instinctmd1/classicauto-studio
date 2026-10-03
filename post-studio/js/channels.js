/* Classic Auto Post Studio — channels: comment-keyword DM reply (PS-5) and one-click Repurpose (PS-4).
   Rules in the table below: Instagram crossposts to Facebook (never export Facebook twice); no TikTok (banned in India); YouTube keeps its link in the
   description; channels without DM automation get a car-page link with UTMs, and only when the car-page base URL is set in Settings. */
(function () {
  'use strict';
  const PS = window.PS;

  // "Comment PRICE and we will DM you the details", or '' when no keyword is set
  PS.kwLine = function (S) {
    const k = String((S.x && S.x.kw) || '').trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').slice(0, 16);
    return k ? PS.tx('kwLine').replace('{k}', k) : '';
  };
  PS.kwWord = (S) => String((S.x && S.x.kw) || '').trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').slice(0, 16);

  /* ---------- car-page link with UTMs. Only when the base URL is set; the car's page is cars/<id>/ on the website (website-v6 SPEC 5.5). ---------- */
  PS.utmCampaign = function (S, tplId, nn) { const stock = PS.stockPart(S, tplId || S.tpl); return `${stock}-${String(nn || PS.nextNumber(stock)).padStart(2, '0')}-${PS.concept(S, { tpl: tplId || S.tpl })}`; };
  PS.carPageUrl = function (S, source, medium, tplId, nn) {
    const base = PS.contact().siteUrl.replace(/\/+$/, ''), id = String(S.car.id || '').trim(); if (!base || !id) return '';
    const q = new URLSearchParams({ utm_source: source, utm_medium: medium, utm_campaign: PS.utmCampaign(S, tplId, nn) });
    return `${base}/cars/${encodeURIComponent(id)}/?${q.toString()}`;
  };

  // the auto-reply text for ManyChat or Meta's own auto-reply: the car, the price band, the car page, a visit line. No phone until one is set.
  PS.dmReply = function (S, tplId, nn) {
    const car = S.car, k = PS.contact(), prev = PS.lang; PS.lang = 'en';
    try {
      const n = PS.parseMoney(car.price), name = [car.year, car.make, car.model, car.variant].filter(Boolean).join(' '), band = PS.BAND_LABEL[PS.bandOf(n)] || '';
      const facts = [car.kms !== '' && car.kms != null ? PS.kmText(car.kms) : '', PS.ownerText(car.owners), [PS.fuelText(car.fuel), PS.transText(car.trans)].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      const url = PS.carPageUrl(S, 'instagram', 'comment_dm', tplId, nn);
      const lines = [`Hi, thanks for your interest in the ${name}.`, facts ? facts + '.' : '', n > 0 ? `Asking price ${PS.priceText(n, 'full')}${band ? ` (price band: ${band})` : ''}.` : 'Price on request.',
        url ? `Photos and full details: ${url}` : '', `Visit us to see it: ${PS.SITE.address_short}.`, k.hasPhone ? `Or call ${k.phone}.` : `Reply here and we will line up a time.`].filter(Boolean);
      return { text: lines.join('\n'), url, hasLink: !!url };
    } finally { PS.lang = prev; }
  };

  /* ---------- Repurpose: one car, five files, five captions, one manifest ---------- */
  PS.CHANNELS = [
    { id: 'instagram-feed', label: 'Instagram feed (also crossposts to Facebook)', tpl: 'newarrival', size: '1080x1350', dm: true, link: false },
    { id: 'instagram-reel-cover', label: 'Instagram reel cover', tpl: 'reelcover', size: '1080x1920', dm: true, link: false },
    { id: 'instagram-story', label: 'Instagram story', tpl: 'story', size: '1080x1920', dm: true, link: false },
    { id: 'status-card', label: 'Status card (reply to book)', tpl: 'wastatus', size: '1080x1920', dm: false, link: true, source: 'whatsapp', medium: 'status' },
    { id: 'web-youtube-16x9', label: 'Website and YouTube (16:9); the link goes in the description', tpl: 'newarrival', size: '1920x1080', dm: false, link: true, source: 'youtube', medium: 'description' }
  ];
  PS.REPURPOSE_NOTES = ['Facebook: crossposted from Instagram, so no separate file.', 'TikTok: not used (banned in India).', 'YouTube: the car-page link sits in the description, never on the image.'];

  PS.channelCaption = function (S, ch, nn) {
    const cl = S.lang === 'en' ? 'en' : 'hn', S2 = chState(S, ch), base = PS.caption(S2, cl).text, link = ch.link ? PS.carPageUrl(S, ch.source, ch.medium, ch.tpl, nn) : '';
    if (ch.id === 'web-youtube-16x9') { const name = [S.car.year, S.car.make, S.car.model].filter(Boolean).join(' '); return `${name} | Classic Auto, Malad West\n\n${base}${link ? '\n\nCar page: ' + link : ''}`; }
    return base + (link ? `\n\nDetails: ${link}` : '');
  };
  function chState(S, ch) {
    const t = PS.TPL[ch.tpl], S2 = Object.assign({}, S, { tpl: ch.tpl, size: ch.size, x: Object.assign({}, S.x), badges: (t.badges || []).slice(), slide: 0, photos: Object.assign({}, S.photos) });
    PS.applyTemplateDefaults(S2, t); return S2;
  }
  // returns {items:[{name,blob|text}], blockers:[]}. nn is shared by the five files so they sort together.
  PS.repurpose = async function (S) {
    const stock = PS.stockPart(S, 'newarrival'), nn = PS.nextNumber(stock), items = [], man = [], blockers = [];
    for (const ch of PS.CHANNELS) {
      const S2 = chState(S, ch), issue = PS.exportIssue(S2, ch.tpl); if (issue) { blockers.push(`${ch.label}: ${issue}`); continue; }
      const name = PS.fileName(S2, { tpl: ch.tpl, size: ch.size, nn, stock }), blob = await PS.exportBlob(S2, { tpl: ch.tpl, size: ch.size, type: 'png' });
      const cap = PS.channelCaption(S, ch, nn); items.push({ name: `${ch.id}/${name}`, blob }, { name: `${ch.id}/caption.txt`, text: cap });
      man.push(Object.assign(PS.manifestEntry(S2, { tpl: ch.tpl, size: ch.size, file: `${ch.id}/${name}` }), { channel: ch.id, caption_file: `${ch.id}/caption.txt`, link_in_caption: /utm_source=/.test(cap) }));
      if (ch.dm && PS.kwWord(S)) items.push({ name: `${ch.id}/dm-reply_${stock}.txt`, text: PS.dmReply(S, ch.tpl, nn).text });
    }
    items.push({ name: 'manifest.json', text: JSON.stringify({ made_with: 'Classic Auto Post Studio', stock, number: nn, notes: PS.REPURPOSE_NOTES, files: man }, null, 1) });
    return { items, blockers, stock, nn };
  };

  /* ---------- Guess + reveal pair: the hidden-price post and the answer post, one ZIP ---------- */
  PS.guessPair = async function (S) {
    const t = PS.TPL.guess, stock = PS.stockPart(S, 'guess'), nn = PS.nextNumber(stock), items = [], man = [], caps = [];
    if (!(PS.parseMoney(S.car.price) > 0)) return { items, blockers: ['Add the car’s price first. The reveal shows the real asking price.'], stock, nn };
    for (const mode of ['guess', 'reveal']) {
      const S2 = Object.assign({}, S, { tpl: 'guess', x: Object.assign({}, S.x, { guessMode: mode }), photos: Object.assign({}, S.photos), slide: 0 }), name = PS.fileName(S2, { tpl: 'guess', nn, stock });
      items.push({ name, blob: await PS.exportBlob(S2, { tpl: 'guess' }) }); man.push(PS.manifestEntry(S2, { tpl: 'guess', file: name }));
      caps.push(`=== ${name} (English) ===\n${PS.caption(S2, 'en').text}\n\n=== ${name} (Hinglish) ===\n${PS.caption(S2, 'hn').text}\n`);
    }
    items.push({ name: 'captions.txt', text: caps.join('\n') }, { name: 'manifest.json', text: JSON.stringify({ made_with: 'Classic Auto Post Studio', note: 'Post the guess first. Post the reveal when you promised (the story or the end of the reel).', files: man }, null, 1) });
    return { items, blockers: [], stock, nn };
  };

  /* ---------- Festival pack: the greeting in every size and language, with captions ---------- */
  PS.festivalPack = async function (S) {
    const fid = S.x.festival || 'diwali', fe = PS.FESTIVALS[fid], t = PS.TPL.festival, stock = 'CA-greeting', nn = PS.nextNumber(stock), items = [], man = [], caps = [];
    const custom = !!String(S.x.festWish || '').trim(), own = S.lang, langs = [own].concat(['en', 'hn', 'hi'].filter((l) => l !== own && !custom));     // a typed wish is in one language only
    // the car files need a real photo of our car, and details the owner has confirmed for it (the same gate a single export uses)
    const hasPhoto = !!(S.photos.main && S.photos.main.img), carS = Object.assign({}, S, { x: Object.assign({}, S.x, { festLayout: 'car' }) }), blockers = [];
    const hasCar = !!String([S.car.make, S.car.model].filter(Boolean).join('')).trim(); let carOK = !!fe.tie && hasPhoto && hasCar;
    if (fe.tie && S.x.festLayout === 'car' && !(hasPhoto && hasCar)) blockers.push('The greeting + car files were skipped: add the car’s photo and type its make and model first. The greeting-only files are in the pack.');
    if (carOK && PS.probe(carS, 'festival').samplePhoto) { carOK = false; blockers.push('The greeting + car files were skipped: the photo is a layout-test photo, not one of our cars.'); }
    else if (carOK && PS.carStale && PS.carStale()) { carOK = false; blockers.push('The greeting + car files were skipped: confirm the car details first (they still match the car that was loaded before the photo changed).'); }
    for (const L of langs) {
      const sizes = L === own ? t.sizes : ['1080x1350', '1080x1920'];
      for (const sz of sizes) {
        const S2 = Object.assign({}, S, { lang: L, size: sz, x: Object.assign({}, S.x, { festLayout: 'greeting' }), slide: 0 }), name = PS.fileName(S2, { tpl: 'festival', size: sz, nn, stock }), file = `${L}/${name}`;
        items.push({ name: file, blob: await PS.exportBlob(S2, { tpl: 'festival', size: sz }) }); man.push(Object.assign(PS.manifestEntry(S2, { tpl: 'festival', size: sz, file }), { language: L }));
      }
      if (L === own && carOK) for (const sz of ['1080x1350', '1080x1920']) {          // greeting + car, in the language the pack was made in
        const S2 = Object.assign({}, S, { lang: L, size: sz, x: Object.assign({}, S.x, { festLayout: 'car' }), slide: 0 }), name = PS.fileName(S2, { tpl: 'festival', size: sz, nn, stock }).replace(/(\.\w+)$/, '_car$1'), file = `${L}/${name}`;
        items.push({ name: file, blob: await PS.exportBlob(S2, { tpl: 'festival', size: sz }) }); man.push(Object.assign(PS.manifestEntry(S2, { tpl: 'festival', size: sz, file }), { language: L, layout: 'greeting + car' }));
      }
    }
    // captions: the wish, then the family line. No sales pitch on a greeting.
    const prev = PS.lang;
    [['en', 'English'], ['hn', 'Hinglish'], ['hi', 'Hindi']].forEach(([L, nm]) => {
      if (!langs.includes(L)) return; PS.lang = L; const wish = custom ? String(S.x.festWish).trim() : (L === 'hi' ? fe.w[2] : L === 'hn' ? fe.w[1] : fe.w[0]);
      caps.push(`=== ${nm} ===\n${wish}\n\n${PS.tx('fromFamily')}\n\n#ClassicAuto1974 #MaladWest\n`);
    }); PS.lang = prev;
    items.push({ name: 'captions.txt', text: caps.join('\n') }, { name: 'manifest.json', text: JSON.stringify({ made_with: 'Classic Auto Post Studio', festival: fid, number: nn, note: custom ? 'A custom wish line was typed, so the pack is in that one language.' : 'The Hindi and Hinglish wishes need a Hindi speaker’s check before posting.', files: man }, null, 1) });
    return { items, blockers, stock, nn };
  };

  /* ---------- One video, five posts: a planning helper. It plans; it never posts. ---------- */
  // opts: {car, hook, start:'YYYY-MM-DD', kw}. Each item: day offset, date, channel, what, template + size to open, the first line of its caption, tags.
  PS.planFromVideo = function (S, o) {
    const car = o.car || S.car, name = [car.year, car.make, car.model].filter(Boolean).join(' '), start = PS.parseDate(o.start) || PS.today(), hook = String(o.hook || '').trim() || 'First look', kw = String(o.kw || '').trim();
    const S2 = Object.assign({}, S, { car: Object.assign({}, car), x: Object.assign({}, S.x, { reelTitle: hook, kw }), slide: 0 }), at = (d) => { const x = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d); return PS.toISODate(x); };
    const first = (tpl, ver) => { const S3 = Object.assign({}, S2, { tpl }); try { return PS.caption(S3, 'en', ver).hook; } catch (e) { return ''; } };
    const trial = PS.HOOKS.some((h) => h.t.includes(hook) && ['F3', 'F4'].includes(h.fmt));
    const out = [
      { day: 0, channel: 'Instagram Reel', what: `The video: ${name}. Cover: the hook “${hook}”.`, tpl: 'reelcover', size: '1080x1920', trial, tags: ['reel'].concat(trial ? ['trial'] : []),
        note: trial ? 'Publish as a Trial Reel (non-followers only). Read it after 24 to 72 hours; share to followers only if it beats your own median.' : 'Publish to followers. Reuse the same audio and cover on YouTube Shorts, with the car-page link in the description.', hook: first('reelcover', 0) },
      { day: 1, channel: 'Instagram feed (crossposts to Facebook)', what: 'The Signature post, 4:5, so the car is in the grid.', tpl: 'newarrival', size: '1080x1350', tags: ['post'], note: 'Facebook gets it by crosspost: never upload it twice.', hook: first('newarrival', 1) },
      { day: 2, channel: 'Instagram Stories', what: 'Story frame, then a poll or question sticker ' + (kw ? `and the keyword ${kw.toUpperCase()}.` : 'about the car.'), tpl: 'story', size: '1080x1920', tags: ['story'], note: 'Three to seven frames: showroom floor, the cover, a poll.', hook: first('story', 0) },
      { day: 3, channel: 'Instagram carousel', what: 'Swipe post: this car with the rest of the stock.', tpl: 'carousel', size: '1080x1350', tags: ['carousel'], note: 'Carousels collect saves, so end on the closing slide.', hook: first('carousel', 0) },
      { day: 4, channel: 'WhatsApp Status', what: 'Status card (reply to book a visit).', tpl: 'wastatus', size: '1080x1920', tags: ['status'], note: 'Post it in the morning; the Broadcast Channel gets the same line.', hook: first('wastatus', 0) }
    ];
    out.forEach((it) => { it.date = at(it.day); });
    return out;
  };
})();
