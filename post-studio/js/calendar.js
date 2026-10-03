/* Classic Auto Post Studio — content calendar data (festival dates and the 30-day plan come from the Instagram growth plan). */
(function () {
  'use strict';
  const PS = window.PS;
  const iso = (m, d, y) => `${y || 2026}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  PS.CADENCE = [
    ['5 Reels a week', 'Two of the five start as Trial Reels.'],
    ['2 carousels a week', 'Spec carousels, lineups, EMI cards, park-n-sell.'],
    ['Stories every day', '3 to 7 frames: polls, showroom floor, deliveries.'],
    ['2 Instagram channel messages', 'New arrivals Monday, weekend lineup Friday.']
  ];

  // Dated events. tpl = template to open when the chip is clicked (greetings only); x = preset fields.
  PS.EVENTS = [
    [iso(10, 11), 'Navratri begins', 'festival', { festival: 'navratri' }], [iso(10, 19), 'Maha Navami'], [iso(10, 20), 'Dussehra', 'festival', { festival: 'dussehra' }],
    [iso(11, 6), 'Dhanteras', 'festival', { festival: 'dhanteras' }], [iso(11, 8), 'Diwali', 'festival', { festival: 'diwali' }],
    [iso(11, 9), 'Govardhan Puja, Bestu Varas', 'festival', { festival: 'bestuvaras' }],
    [iso(11, 11), 'Bhai Dooj'], [iso(11, 14), 'Labh Pancham'], [iso(11, 24), 'Guru Nanak Jayanti'],
    [iso(12, 16), 'Kharmas begins (buying lull)'], [iso(12, 25), 'Christmas', 'festival', { festival: 'christmas' }],
    [iso(1, 1, 2027), 'New Year', 'festival', { festival: 'newyear' }], [iso(1, 14, 2027), 'Kharmas ends (14 or 15 Jan)'], [iso(1, 15, 2027), 'Makar Sankranti', 'festival', { festival: 'sankranti' }],
    [iso(1, 26, 2027), 'Republic Day', 'festival', { festival: 'republic' }], [iso(2, 8, 2027), 'Ramadan begins (about)'], [iso(2, 11, 2027), 'Vasant Panchami'],
    [iso(3, 6, 2027), 'Maha Shivaratri'], [iso(3, 10, 2027), 'Eid (about, moon sighting)', 'festival', { festival: 'eid' }], [iso(3, 21, 2027), 'Holika Dahan'],
    [iso(3, 22, 2027), 'Holi', 'festival', { festival: 'holi' }], [iso(3, 31, 2027), 'Financial year end'], [iso(4, 7, 2027), 'Gudi Padwa']
  ];

  const R = (title, extra) => ({ reelTitle: title, ...(extra || {}) });
  // 12 Oct to 10 Nov 2026: [date, label, template, x preset, stories note]
  const PLAN = [
    [iso(10, 12), 'Reel F1: hero SUV cold-start walkaround, price and EMI estimate', 'reelcover', R('First look'), 'Navratri greeting; poll: Garba night or showroom visit?'],
    [iso(10, 13), 'Carousel: 5 cars under ₹10 L this Navratri', 'carousel', {}, 'Launch Broadcast Channel: first look at new arrivals'],
    [iso(10, 14), 'Reel F4 (trial first): guess the price of a luxury SUV', 'guess', {}, 'Reveal teaser sticker'],
    [iso(10, 15), 'Reel F2: the latest consented delivery', 'sold', {}, 'Customer thank-you frame'],
    [iso(10, 16), 'Carousel: park-n-sell in 4 steps', 'sell', { sellKind: 'park' }, 'Q&A box: ask about selling your car'],
    [iso(10, 17), 'Reel F1: weekend lineup walkaround, Hinglish voiceover', 'reelcover', R('Walkaround'), 'Showroom floor stories'],
    [iso(10, 18), 'Reel F3: Since 1974, episode 1', 'reelcover', R('Since 1974'), 'Channel: weekend lineup'],
    [iso(10, 19), 'Reel F5: five checks before buying a used car in Mumbai', 'reelcover', R('5 checks'), 'Save-this sticker'],
    [iso(10, 20), 'Dussehra greeting carousel plus Dussehra deliveries Reel (F2)', 'festival', { festival: 'dussehra' }, 'Live delivery Stories through the day'],
    [iso(10, 21), 'Reel F4: pick one at ₹8 L: hatch, sedan or compact SUV', 'guess', {}, 'Poll results'],
    [iso(10, 22), 'Reel F5: real, untouched detailing time-lapse (single take)', 'reelcover', R('Real detailing'), 'Detailing bay stories'],
    [iso(10, 23), 'Carousel: fresh arrivals this week', 'carousel', {}, 'Channel: weekend lineup'],
    [iso(10, 24), 'Reel F1: luxury walkaround with price reveal at the end', 'reelcover', R('Walkaround'), 'Test-drive stories'],
    [iso(10, 25), 'Reel F3: episode 2, behind the scenes at the showroom', 'reelcover', R('Behind the scenes'), 'Behind the scenes'],
    [iso(10, 26), 'First creator Collab post: car-spotting page at the showroom', 'newarrival', {}, 'Reshare creator stories'],
    [iso(10, 27), 'Carousel: EMI-estimate table for three popular cars (estimate only)', 'finance', {}, 'Question sticker: budget'],
    [iso(10, 28), 'Reel F4 (trial first): is this car worth ₹X L?', 'guess', {}, 'Poll'],
    [iso(10, 29), 'Reel F2: delivery', 'sold', {}, 'Customer Collab invite'],
    [iso(10, 30), 'Carousel: Dhanteras shortlist, 7 cars ready for 6 November', 'carousel', {}, 'Channel: slot booking opens'],
    [iso(10, 31), 'Reel F1: Dhanteras special walkaround', 'reelcover', R('Dhanteras special'), 'Countdown sticker to 6 Nov'],
    [iso(11, 1), 'Reel F3: meet the team', 'reelcover', R('Meet the team'), 'Team stories'],
    [iso(11, 2), 'Reel F5: flood-damage checks for a used car in Mumbai', 'reelcover', R('Flood check'), 'Save-this sticker'],
    [iso(11, 3), 'Carousel: park-n-sell versus trading in to a dealer', 'sell', { sellKind: 'park' }, 'Q&A'],
    [iso(11, 4), 'Reel F4: Diwali edition guess the price', 'guess', {}, 'Poll'],
    [iso(11, 5), 'Reel: eve of Dhanteras, cars being washed and ribboned', 'reelcover', R('Dhanteras eve'), 'Countdown'],
    [iso(11, 6), 'Dhanteras: delivery montage Reel (F2) plus greeting carousel', 'festival', { festival: 'dhanteras' }, 'Live deliveries; Channel thank-you message'],
    [iso(11, 7), 'Reel F1: Diwali-eve walkaround, last cars ready for Diwali', 'reelcover', R('Diwali eve'), 'Showroom lights stories'],
    [iso(11, 8), 'Diwali greeting from the owner and family, no sales pitch', 'festival', { festival: 'diwali' }, 'Stories only, minimal'],
    [iso(11, 9), 'Govardhan Puja, Bestu Varas: Saal Mubarak greeting carousel', 'festival', { festival: 'bestuvaras' }, 'Greeting stories'],
    [iso(11, 10), '30-day recap Reel; teaser for Labh Pancham and Bhai Dooj', 'reelcover', R('30-day recap'), 'Review gate day; Channel recap']
  ];
  PS.PLAN = {}; PLAN.forEach((p) => { PS.PLAN[p[0]] = { label: p[1], tpl: p[2], x: p[3], story: p[4] }; });

  // Weekly rhythm outside the planned window (0 = Sunday)
  const WEEK = {
    1: { label: 'Reel F1: first-look walkaround', tpl: 'reelcover', x: R('First look'), channel: 'Channel: new arrivals' },
    2: { label: 'Carousel: weekly stock', tpl: 'carousel', x: {} },
    3: { label: 'Reel F4 (trial first): guess the price', tpl: 'guess', x: {}, trial: true },
    4: { label: 'Reel F2: delivery', tpl: 'sold', x: {} },
    5: { label: 'Carousel: park-n-sell or EMI explainer', tpl: 'sell', x: { sellKind: 'park' }, channel: 'Channel: weekend lineup' },
    6: { label: 'Reel F1: weekend lineup walkaround', tpl: 'reelcover', x: R('Walkaround') },
    0: { label: 'Reel F3: Since 1974 story', tpl: 'reelcover', x: R('Since 1974') }
  };

  /* ---------- tags: what each planned item is, and whether it starts as a Trial Reel ----------
     Trial Reels go to non-followers first (Instagram, 24 to 72 hours). The growth plan says to trial the formats with the weakest evidence: F3 (the Since 1974 series,
     inferential) and F4 (price games, low), and anything the plan itself marks "(trial first)". F1 and F5 have moderate evidence and F2 needs a customer's consent. */
  PS.TRIAL_FORMATS = ['F3', 'F4'];
  // what staff see on a day card: plain names. The codes (F1 to F5) stay in the CSV only.
  const REEL_NAME = { 1: 'Walkaround reel', 2: 'Delivery-day reel', 3: 'Since 1974 reel', 4: 'Price-game reel', 5: 'Buyer-tips reel' };
  PS.plainLabel = (t) => String(t || '').replace(/Reel F(\d)( \(trial first\))?:?/g, (m, n, tr) => REEL_NAME[n] + (tr ? ' (test as a Trial Reel first)' : '') + ':').replace(/ \(F\d\)/g, '').replace(/Broadcast Channel/g, 'Instagram channel').replace(/ ?:\s*:/g, ':');
  PS.tagsOf = function (it) {
    const label = String((it && it.label) || ''), tags = [], f = (label.match(/Reel F(\d)/) || [])[1];
    const reel = /^Reel/.test(label) || (!!it && it.tpl === 'reelcover' && !/greeting/i.test(label));
    if (reel) tags.push('reel'); else if (/^Carousel/.test(label) || (it && it.tpl === 'carousel')) tags.push('carousel'); else if (it && (it.kind === 'festival' || it.tpl === 'festival')) tags.push('festival'); else tags.push('post');
    if (f) tags.push('F' + f);
    if (reel && (/trial first/i.test(label) || (f && PS.TRIAL_FORMATS.includes('F' + f)) || (it && it.trial))) tags.push('trial');
    return tags;
  };
  // returns {items:[{label,tpl,x,kind,tags}], events:[{label,tpl?,x?}], story}
  PS.dayInfo = function (date) {
    const d = new Date(date + 'T00:00:00'), plan = PS.PLAN[date], wk = WEEK[d.getDay()];
    const events = PS.EVENTS.filter((e) => e[0] === date).map((e) => ({ label: e[1], tpl: e[2], x: e[3] }));
    const items = [];
    if (plan) items.push({ label: plan.label, tpl: plan.tpl, x: plan.x, kind: 'plan' });
    else if (wk) items.push({ label: wk.label, tpl: wk.tpl, x: wk.x, kind: 'weekly', trial: !!wk.trial });
    events.filter((e) => e.tpl).forEach((e) => { if (!items.some((i) => i.tpl === e.tpl && i.x.festival === e.x.festival)) items.push({ label: e.label + ' greeting', tpl: e.tpl, x: e.x, kind: 'festival' }); });
    // a festival greeting is the matching template on a festival day
    if (events.some((e) => e.tpl) && !plan) items.unshift(items.pop());
    items.forEach((it) => { it.tags = PS.tagsOf(it); });
    return { items, events, story: plan ? plan.story : 'Daily Stories, 3 to 7 frames', channel: !plan && wk && wk.channel, trial: items.some((it) => it.tags.includes('trial')) };
  };
})();
