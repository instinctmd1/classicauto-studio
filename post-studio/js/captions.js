/* Classic Auto Post Studio — caption + hashtag generator (English / Hinglish), following the Instagram growth plan:
   a hook first, the facts, an estimate-labelled EMI, a call to action, local keywords, five hashtags at most.
   Every contact line reads PS.contact(): with no phone it says DM @classicauto_1974 and the showroom, never a dead "WhatsApp us". */
(function () {
  'use strict';
  const PS = window.PS;
  const camel = (s) => String(s || '').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');

  function facts(S) {
    const car = S.car, price = PS.parseMoney(car.price), emi = PS.emiEst(price), old = PS.parseMoney(car.oldPrice);
    const prevLang = PS.lang; PS.lang = 'en';
    const pd = PS.parseDate(S.x.oldPosted), showOld = PS.validDrop(car) && !!pd && pd <= PS.today();
    const f = {
      named: !![car.year, car.make, car.model].filter(Boolean).length, name: [car.year, car.make, car.model].filter(Boolean).join(' ') || 'this car', full: [car.year, car.make, car.model, car.variant].filter(Boolean).join(' '), model: car.model || 'this car', aModel: car.model ? 'a ' + car.model : 'a car', theModel: car.model ? 'the ' + car.model : 'the car',
      price: PS.isPOA(car.price) ? '' : PS.priceText(price), emi: isFinite(emi) ? '₹' + PS.inr(emi) : '', km: car.kms !== '' && car.kms != null ? PS.kmText(car.kms) : '', fuel: PS.fuelText(car.fuel), trans: PS.transText(car.trans),
      owner: PS.ownerText(car.owners), old: showOld ? PS.priceText(old) : '', oldDate: showOld ? PS.fmtDate(pd) : '', save: showOld && S.x.showSave && old > price ? '₹' + PS.inr(old - price) : '', priceN: price
    };
    f.specs = [f.km, f.fuel, f.trans, f.owner].filter(Boolean).join(' | ');
    f.thisName = f.named ? 'this ' + f.name : 'this car'; f.theName = f.named ? 'the ' + f.name : 'this car';
    PS.lang = prevLang; return f;
  }
  // how to reach the showroom, in the voice of each language. phone first, then WhatsApp, then the DM handle.
  const viaE = () => { const k = PS.contact(); return k.hasPhone ? `Call ${k.phone}` : k.hasWa ? `WhatsApp ${k.wa}` : `DM ${k.handle}`; };
  const viaH = () => { const k = PS.contact(); return k.hasPhone ? `${k.phone} par call karein` : k.hasWa ? `${k.wa} par WhatsApp karein` : `${k.handle} ko DM karein`; };
  const kwLine = (S, hn) => { const k = String((S.x && S.x.kw) || '').trim().toUpperCase(); return k ? (hn ? `Comment mein ${k} likhein, hum details DM karenge.` : `Comment ${k} and we will DM you the details.`) : ''; };
  const VISIT = 'Prabhu Plaza, S.V. Road, Malad West';
  const emiLine = (f, hn) => f.emi ? (hn ? `EMI estimate lagbhag ${f.emi}/mahina (20% down, ${PS.rateText()}% p.a., 60 mahine). Asli EMI lender aur aapki profile par depend karti hai. T&C apply, lender approval ke adheen.` : `EMI estimate from about ${f.emi} a month (20% down, ${PS.rateText()}% p.a., 60 months). Actual EMI depends on the lender and your profile. T&C apply; subject to lender approval.`) : '';
  const mk = (S) => camel(S.car.make + ' ' + S.car.model);
  const ins = () => PS.settings.claimInspected;

  // The Signature stamp changes what the caption may say: a SOLD, BOOKED or COMING SOON post never says "just arrived", "ready to see", "book a test drive" or quotes an EMI.
  const justOn = (S) => S.tpl === 'newarrival' && S.x.stamp === 'just';       // "just arrived" is only said when the post carries the Just in stamp
  const stampOf = (S) => (S.tpl === 'newarrival' && /^(sold|booked|soon)$/.test(S.x.stamp || '') ? S.x.stamp : '');
  const askLine = (S, hn) => (hn ? `Aisi hi koi gaadi chahiye? Apna budget batayein: ${viaH()}, ya ${VISIT} aayein.` : `Looking for something similar? Tell us your budget: ${viaE()}, or visit us at ${VISIT}.`);
  const STATUS = {
    sold: (f, S, hn) => ({ hook: hn ? `Bik gayi: ${f.name}.` : `Sold: ${f.name}.`, body: [hn ? 'Yeh gaadi ab available nahi hai.' : 'This car is no longer available.'], cta: askLine(S, hn), tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'MaladWest', 'Sold'] }),
    booked: (f, S, hn) => ({ hook: hn ? `Book ho gayi: ${f.name}.` : `Booked: ${f.name}.`, body: [hn ? 'Yeh gaadi kisi customer ne book kar li hai, abhi available nahi hai.' : 'A customer has booked this car, so it is not available right now.'], cta: askLine(S, hn), tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'MaladWest', 'Booked'] }),
    soon: (f, S, hn) => ({ hook: hn ? `Jald aa rahi hai: ${f.name}, Malad West showroom mein.` : `Coming soon: ${f.name}, to our Malad West showroom.`, body: [f.specs, hn ? 'Abhi showroom mein nahi hai. Aane par sabse pehle jaanne ke liye humse baat karein.' : 'It is not at the showroom yet. Message us to hear first when it arrives.'],
      cta: hn ? `Jaankari ke liye ${viaH()}.` : `${viaE()} and we will tell you when it arrives.`, tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'MaladWest', 'ComingSoon'] })
  };

  // each entry: (f, S, hn) -> {hook, body[], cta, tags[]}
  const T = {
    newarrival: (f, S, hn) => stampOf(S) ? STATUS[stampOf(S)](f, S, hn) : ({
      // the hook carries the facts (name, variant, kms, owner, price); the body only adds new information
      hook: (() => { const d = [f.named ? f.full : '', f.km, f.owner, f.price].filter(Boolean).join(', '), lead = justOn(S) ? (hn ? 'Just aayi hai' : 'Just arrived') : (hn ? 'Malad West ke Classic Auto mein available' : 'Available now at Classic Auto, Malad West'); return d ? `${lead}: ${d}.` : `${lead}.`; })(),
      body: [emiLine(f, hn), [f.fuel, f.trans].filter(Boolean).join(' | '), hn ? `Malad West showroom mein dekhne ke liye taiyaar${ins() ? ', poori jaanch ke saath' : ''}.` : `Ready to see at our Malad West showroom${ins() ? ', inspected before sale' : ''}.`],
      cta: [hn ? `Test drive ke liye ${viaH()}, ya ${VISIT} aayein.` : `${viaE()} to book a test drive, or visit us at ${VISIT}.`, kwLine(S, hn)].filter(Boolean).join(' '), tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'MaladWest', mk(S)]
    }),
    pricedrop: (f, S, hn) => ({
      hook: f.price ? (hn ? `Naya price: ${f.name} ab ${f.price} mein.` : `New price: ${f.name} is now ${f.price}.`) : (hn ? `Naya price: ${f.name}.` : `New price on ${f.theName}.`),
      body: [f.old ? (hn ? `Purana price ${f.old} (${f.oldDate} ko post kiya tha).` : `Old price ${f.old} (posted ${f.oldDate}).`) : '', f.save ? (hn ? `Aapki bachat ${f.save}.` : `You save ${f.save}.`) : '', f.specs,
        (() => { const o = PS.offerStatus(S.x.validity); return o.status === 'ok' ? (hn ? `Offer ${PS.fmtDate(o.date)} tak.` : `Offer valid till ${PS.fmtDate(o.date)}.`) : ''; })(), emiLine(f, hn)],
      cta: hn ? `Jaane se pehle ${viaH()}.` : `${viaE()} before it goes.`, tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'NewPrice', mk(S)]
    }),
    guess: (f, S, hn) => S.x.guessMode === 'reveal' ? ({
      hook: f.price ? (hn ? `Jawab: ${f.name} ki asking price ${f.price} hai.` : `The answer: ${f.theName} is ${f.price}.`) : (hn ? `Jawab: ${f.name}.` : `The answer on ${f.theName}.`),
      body: [f.specs, hn ? 'Aapka guess kitna close tha? Comments mein batayein.' : 'How close was your guess? Tell us in the comments.', emiLine(f, hn)],
      cta: hn ? `Dekhne ke liye ${viaH()}, ya ${VISIT} aayein.` : `${viaE()} to see it in person, or visit us at ${VISIT}.`, tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'PriceReveal', mk(S)]
    }) : ({
      hook: hn ? `${f.named ? 'Is ' + f.name : 'Is gaadi'} ki price kitni hogi? Guess karo.` : `Guess the price of ${f.thisName}.`,
      body: [f.specs, hn ? `Comments mein apna guess likho. Asli asking price ${(S.x.guessReveal || '').trim() || 'kal ki story'} mein.` : `Drop your guess in the comments. The real asking price is in ${(S.x.guessReveal || '').trim() || 'tomorrow’s story'}.`],
      cta: hn ? `Dekhne ke liye ${viaH()}, ya ${VISIT} aayein.` : `${viaE()} to see it in person, or visit us at ${VISIT}.`, tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'GuessThePrice', mk(S)]
    }),
    sold: (f, S, hn) => ({
      hook: hn ? `${S.x.custName || 'Hamare customer'} ko unki ${f.named ? f.name : 'gaadi'} ki chaabi mil gayi.` : `${S.x.custName || 'Our customer'} just picked up ${f.named ? 'a ' + f.name : 'a car'}.`,
      body: [hn ? 'Dher saari badhaiyan. Shukriya Classic Auto par bharosa karne ke liye.' : 'Congratulations, and thank you for trusting Classic Auto.', S.x.custQuote ? `"${S.x.custQuote}"` : '', hn ? 'Customer ki ijazat se share kiya gaya.' : 'Shared with the customer’s consent.'],
      cta: hn ? `Aapki agli gaadi? ${viaH()}.` : `Your turn next? ${viaE()}.`, tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'MaladWest', 'HappyCustomer']
    }),
    carousel: (f, S, hn) => {
      const cars = PS.carSlides(S);
      const list = cars.map((c, i) => `${i + 1}. ${[c.year, c.make, c.model].filter(Boolean).join(' ')}${PS.parseMoney(c.price) > 0 ? ' - ' + PS.priceText(PS.parseMoney(c.price)) : ''}`).join('\n');
      return {
        hook: hn ? `Is hafte ke ${cars.length} cars, Malad West showroom se.` : `This week’s ${cars.length} cars, straight from our Malad West showroom.`,
        body: [list, hn ? 'Swipe karke sab dekhein. Har car par EMI sirf estimate hai; asli EMI lender tay karta hai.' : 'Swipe for the specs. EMI on each car is an estimate only; the lender sets the actual EMI.', hn ? 'Save karein, kisi dost ko bhejein jo car dhoondh raha hai.' : 'Save this and send it to someone who is car shopping.'],
        cta: hn ? `Dekhne ke liye ${viaH()}, ya ${VISIT} aayein.` : `${viaE()} to book a viewing, or visit us at ${VISIT}.`, tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'MaladWest', 'SecondHandCars']
      };
    },
    reelcover: (f, S, hn) => ({
      hook: hn ? `${S.x.reelTitle || 'First look'}: ${f.name}. Price end tak mat chhodna.` : `${S.x.reelTitle || 'First look'}: ${f.name}. Watch for the price.`,
      body: S.x.reelPrice === 'hide' ? [f.specs, hn ? 'Price video ke end mein.' : 'The price is at the end of the video.'] : [f.specs, f.price ? `Price: ${f.price}` : '', emiLine(f, hn)],
      cta: [hn ? `Test drive ke liye ${viaH()}.` : `${viaE()} to book a test drive.`, kwLine(S, hn)].filter(Boolean).join(' '), tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'MaladWest', mk(S)]
    }),
    story: (f, S, hn) => {
      const k = PS.contact();
      return { hook: hn ? `Classic Auto mein available: ${f.name}.` : `Available now at Classic Auto: ${f.name}.`, body: [f.price ? `${f.price}. ` + (f.emi ? (hn ? `EMI estimate ${f.emi}/mahina.` : `EMI estimate ${f.emi}/mo.`) : '') : ''],
        cta: k.hasWa ? (hn ? 'Link sticker par tap karke WhatsApp karein.' : 'Tap the link sticker to WhatsApp us.') : (hn ? `Test drive ke liye ${viaH()}.` : `${viaE()} to book a test drive.`), tags: [] };
    },
    wastatus: (f, S, hn) => ({ hook: (hn ? 'Available: ' : 'Available now: ') + f.name + (f.price ? ', ' + f.price : '') + '.', body: [f.specs], cta: hn ? 'Visit book karne ke liye reply karein.' : 'Reply to book a visit.', tags: [] }),
    festival: (f, S, hn) => { const fe = PS.FESTIVALS[S.x.festival || 'diwali']; return { hook: (S.x.festWish || '').trim() || (hn ? fe.w[1] : fe.w[0]), body: [hn ? 'Classic Auto parivaar ki taraf se.' : 'From all of us at Classic Auto.'], cta: '', tags: ['ClassicAuto1974', 'MaladWest', camel(fe.n[0])] }; },
    testimonial: (f, S, hn) => {
      const q = String(S.x.tQuote || '').trim(), who = [String(S.x.tName || '').trim(), String(S.x.tCar || '').trim()].filter(Boolean).join(', ');
      return { hook: hn ? 'Hamare customer kya kehte hain.' : 'What our customers say.', body: [q ? `"${q}"` : '', who, hn ? 'Customer ki ijazat se.' : 'Shared with the customer’s permission.'], cta: hn ? `Aap bhi ${VISIT} aayein ya ${viaH()}.` : `Visit us at ${VISIT} or ${viaE().replace(/^Call/, 'call')}.`, tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'MaladWest', 'CustomerStories'] };
    },
    trust: (f, S, hn) => ({
      hook: hn ? 'Malad West mein 1974 se.' : 'In Malad West since 1974.',
      body: [hn ? `Budget hatchback se luxury SUV tak. Aasaan finance. Buy, sell, exchange aur upgrade.${ins() ? ' Har car ki jaanch.' : ''}` : `Budget hatchbacks to luxury SUVs. Easy finance. Buy, sell, exchange and upgrade.${ins() ? ' Every car inspected.' : ''}`,
        (hn ? 'Aakar khud dekhiye: ' : 'Come and see for yourself: ') + PS.SITE.address_caption],
      cta: hn ? `Aane se pehle ${viaH()}.` : `${viaE()} before you visit.`, tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'MaladWest', 'Since1974']
    }),
    sell: (f, S, hn) => {
      const park = S.x.sellKind === 'park', k = PS.contact();
      return {
        hook: park ? (hn ? 'Gaadi bechni hai? Park-n-Sell mein hum sambhalte hain.' : 'Selling your car? Park it with us and we handle the sale.') : (hn ? 'Apni gaadi ka seedha quote chahiye?' : 'Want a straight quote for your car?'),
        body: [park ? (hn ? 'Park, Dikhao, Bik gayi: teen aasaan step.' : 'Park it, we show it, we close it: three steps.') : (hn ? 'Visit, Quote, Payment: teen aasaan step.' : 'Visit, quote, get paid: three steps.'), hn ? 'Save karein, kisi aise dost ko bhejein jo apni gaadi bechne wala hai.' : 'Save this for a friend who is about to sell a car.'],
        cta: k.hasPhone ? (hn ? `Quote ke liye ${k.phone} par call karein.` : `Call ${k.phone} for a quote.`) : k.hasWa ? (hn ? `Photos, saal aur km ${k.wa} par WhatsApp karein.` : `WhatsApp ${k.wa} photos, year and km for a quote.`) : (hn ? `Photos, saal aur km ${k.handle} ko DM karein, quote paayein.` : `DM ${k.handle} photos, year and km for a quote.`), tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'SellYourCar', 'ParkNSell']
      };
    },
    finance: (f, S, hn) => ({ hook: hn ? `${f.model} ka EMI kaise banta hai: ek udaaharan.` : `How the EMI on ${f.aModel} works: a worked example.`, body: [hn ? 'Yeh sirf estimate hai. Asli EMI, rate aur approval lender aur aapki profile par depend karte hain. T&C apply, lender approval ke adheen.' : 'This is an estimate only. Actual EMI, rate and approval depend on the lender and your profile. T&C apply; subject to lender approval.', hn ? 'Save karein, budget banate waqt kaam aayega.' : 'Save it for when you are working out your budget.'], cta: hn ? `Apna budget batayein, ${viaH()}.` : `Tell us your budget: ${viaE().replace(/^Call/, 'call')}.`, tags: ['ClassicAuto1974', 'UsedCarsMumbai', 'CarLoanEMI', 'MaladWest'] }),
    hiring: (f, S, hn) => {
      const k = PS.contact(), ap = String(S.x.hireApply || '').trim() || (hn ? (k.hasWa ? 'Apna naam aur chhota note WhatsApp karein.' : 'Apna naam aur chhota note DM karein.') : (k.hasWa ? 'WhatsApp us your name and a short note.' : 'DM us your name and a short note.'));
      return { hook: (() => { const r = String(S.x.hireRole || '').trim(); return hn ? `Hum hire kar rahe hain${r ? ': ' + r : ''}, Malad West.` : `We are hiring${r ? ': ' + r : ''}, Malad West.`; })(), body: [(S.x.hireBullets || '').split('\n').filter(Boolean).map((b) => '- ' + b).join('\n')], cta: ap + (k.hasPhone ? (hn ? ` Ya ${k.phone} par call karein.` : ` Or call ${k.phone}.`) : ''), tags: ['ClassicAuto1974', 'MaladWest', 'MumbaiJobs', 'Hiring'] };
    },
    hero: () => ({ hook: 'Website banner. No caption needed.', body: ['Alt text: Classic Auto, pre-owned car dealership in Malad West, Mumbai, since 1974.'], cta: '', tags: [] }),
    youtube: (f, S, hn) => ({ hook: `${S.x.ytText || 'First look'}: ${f.name} | Classic Auto, Malad West`,
      body: [f.specs, f.price ? (hn ? `Asking price ${f.price}. ` + (f.emi ? `EMI estimate lagbhag ${f.emi}/mahina; asli EMI lender par depend karta hai.` : '') : `Asking price ${f.price}. ` + (f.emi ? `EMI estimate from about ${f.emi} a month; actual EMI depends on the lender.` : '')) : '',
        hn ? 'Classic Auto, Malad West, Mumbai mein 1974 se pre-owned cars.' : 'Classic Auto, pre-owned cars in Malad West, Mumbai, since 1974.'],
      cta: hn ? `Test drive ke liye ${viaH()}.` : `${viaE()} to book a test drive.`, tags: ['ClassicAuto1974', 'UsedCarsMumbai', mk(S)] }),
    cover: () => ({ hook: 'Cover image for the Google Business or Facebook page.', body: ['Classic Auto, ' + PS.SITE.address_caption + ' Since 1974.'], cta: '', tags: [] })
  };

  /* ---------- caption versions: A is the default hook above. B opens with a question, C is short. Only facts that are on the post; no claims. ---------- */
  const mid = (a) => a.filter(Boolean).join(', ');
  const ALT = {
    newarrival: (f, S, hn) => stampOf(S) ? [STATUS[stampOf(S)](f, S, hn).hook, STATUS[stampOf(S)](f, S, hn).hook] : [hn ? `${f.model} dhoondh rahe hain? ${f.name}${f.km ? ', ' + f.km : ''} hamare Malad West showroom mein.` : `Looking for ${f.aModel}? ${f.name}${f.km ? ', ' + f.km : ''}, at our Malad West showroom.`,
      `${f.name}. ${[f.km, f.owner, f.price].filter(Boolean).join('. ')}.`],
    pricedrop: (f, S, hn) => [hn ? `${f.model} ke baare mein soch rahe hain? Ab ${f.price || 'naye price'} mein.` : `Thinking about ${f.aModel}? ${f.price ? 'It is now ' + f.price + '.' : 'The price has changed.'}`, `${f.name}${f.price ? ': ' + f.price : ''}.`],
    guess: (f, S, hn) => [hn ? `Aap ${f.named ? 'is ' + f.name : 'is gaadi'} ke liye kitna denge? Number comment karein.` : `How much would you pay for ${f.thisName}? Comment your number.`, hn ? `${f.name}. Aapka guess?` : `${f.name}. Your guess?`],
    reelcover: (f, S, hn) => [hn ? `${f.name}: kya aap kharidenge? End tak dekhein.` : `${f.name}: would you buy it? Watch to the end.`, `${S.x.reelTitle || 'First look'}: ${f.name}.`],
    story: (f, S, hn) => [hn ? `${f.model} ke liye showroom aayein?` : `Coming to see ${f.theModel}?`, `${f.name}.`],
    wastatus: (f, S, hn) => [hn ? `${f.model} dekhna hai? Reply karein.` : `Want to see ${f.theModel}? Reply to book a visit.`, `${f.name}${f.price ? ', ' + f.price : ''}.`],
    carousel: (f, S, hn) => { const n = PS.carSlides(S).length; return [hn ? `${n} cars, har ek ke liye ek swipe.` : `${n} cars, one swipe each.`, hn ? 'Swipe karein: Classic Auto ka stock.' : 'Swipe: the stock at Classic Auto.']; },
    sell: (f, S, hn) => [hn ? 'Kya aapki gaadi ab bikne ko taiyaar hai?' : 'Is your car ready to sell?', hn ? 'Gaadi bechni hai? Hum baat karenge.' : 'Selling a car? Talk to us.'],
    finance: (f, S, hn) => [hn ? `${f.model} ke liye EMI ka andaaza lagana hai?` : `Working out the EMI on ${f.aModel}?`, hn ? `${f.model}: EMI estimate.` : `${f.model}: an EMI estimate.`],
    trust: (f, S, hn) => [hn ? 'Kisi bharose ke dealer ki talash mein?' : 'Looking for a dealer you can rely on?', hn ? 'Classic Auto. Malad West. 1974 se.' : 'Classic Auto. Malad West. Since 1974.']
  };
  PS.CAPTION_VERSIONS = [['A', 'Facts first'], ['B', 'A question'], ['C', 'Short']];
  PS.hasCaptionVersions = (S) => !!ALT[S.tpl];
  PS.caption = function (S, lang, ver) {
    const hn = lang === 'hn' || lang === 'hi', f = facts(S), fn = T[S.tpl] || T.newarrival, r = fn(f, S, hn);
    if (ver > 0 && ALT[S.tpl]) r.hook = ALT[S.tpl](f, S, hn)[ver - 1] || r.hook;
    const tags = r.tags.filter(Boolean).slice(0, 5).map((t) => '#' + t);
    const edits = (S._labels && S._labels.length) ? 'Photo note: ' + [...new Set(S._labels)].join(' + ') + (hn ? '. Gaadi bilkul waisi hi hai, usme koi badlaav nahi.' : '. The car itself is untouched.') : '';
    const parts = [r.hook, ...r.body.filter(Boolean), r.cta, edits].filter(Boolean);
    const tp = PS.TPL[S.tpl] || {}, P = tp.heroPhoto ? S.photos.hero : tp.photoKey ? S.photos[tp.photoKey] : S.photos.main, src = P && P.img ? P.src : '';
    return { text: parts.join('\n\n') + (tags.length ? '\n\n' + tags.join(' ') : ''), hook: r.hook, tags,
      hint: 'Tag the location: Classic Auto, Malad West. Keep to five hashtags or fewer.' + (src === 'ig' ? ' This photo is from our Instagram listing: say so if asked, and swap in a walk-around photo when you have one.' : '') };
  };
})();
