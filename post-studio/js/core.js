/* Classic Auto Post Studio — core: brand tokens, site facts, contact model, copy (EN / Hinglish / Hindi), money + EMI helpers, state. */
(function () {
  'use strict';
  const PS = (window.PS = window.PS || {});

  PS.B = {
    red: '#E11B22', blue: '#0A5AA8', deep: '#0A1633', card: '#0E1D40', card2: '#16275A',
    off: '#F7F5F0', cream: '#F5F2EC', white: '#FFFFFF', mute: '#B9C2DA', ink: '#0A1633', inkMute: '#4A5576',
    line: 'rgba(247,245,240,.16)'
  };
  // accent colours of the Classic Listing (sampled from the real feed: navy, racing green for the XF, maroon for the Carens, black for the Seltos)
  PS.ACCENTS = {
    navy: { n: 'Navy', a: '#0B2147', b: '#04152D', mid: '#143463' },
    green: { n: 'Racing green', a: '#0B3A2A', b: '#052818', mid: '#145040' },
    maroon: { n: 'Maroon', a: '#7A0F12', b: '#5A0A0C', mid: '#8F1A1E' },
    black: { n: 'Black', a: '#16181B', b: '#090A0B', mid: '#2A2D31' }
  };

  /* ---------- site facts. One source for the address, handle and Instagram numbers (FACTS.md is binding).
     TODO: read the same JSON as website-v6 `CA_SITE` once that file exists, so the site and the studio never drift. ---------- */
  PS.SITE = {
    name: 'Classic Auto', since: 1974, instagram: 'classicauto_1974', handle: '@classicauto_1974',
    ig_followers_label: '20K', ig_posts: 1376, ig_as_of: '2026-10-02',
    address_lines: ['135/136, 1st Floor, Prabhu Plaza, S.V. Road,', 'near Malad Railway Station, Malad West, Mumbai.'],         // what a post prints (the owner's address)
    address_lines3: ['135/136, 1st Floor, Prabhu Plaza,', 'S.V. Road, near Malad Railway Station,', 'Malad West, Mumbai.'],       // the same address on three lines, for narrow bars
    address_caption: '135/136, 1st Floor, Prabhu Plaza, S.V. Road, next to Shankar Mandir, near Malad Railway Station, Malad West, Mumbai.',      // captions may name the landmark (FACTS.md)
    address_short: 'Prabhu Plaza, S.V. Road, Malad West',
    luxuryFrom: 3500000                     // price at which the "luxury" header turns on by default (owner can override per car)
  };

  /* ---------- copy: [English, Hinglish, Hindi]. A key with a "Wa" twin uses the twin once a WhatsApp number is set. ---------- */
  const C = {
    justArrived: ['Just Arrived', 'Just Aayi Hai', 'अभी आई है'],
    priceDrop: ['New Price', 'Naya Price', 'नई कीमत'],
    sold: ['Sold', 'Bik Gayi', 'बिक गई'],
    booked: ['Booked', 'Book Ho Gayi', 'बुक हो गई'],
    comingSoon: ['Coming Soon', 'Jald Aa Rahi Hai', 'जल्द आ रही है'],
    certified: ['Certified', 'Certified', 'प्रमाणित'],
    lowKms: ['Low KMs', 'Kam KMs', 'कम किलोमीटर'],
    firstOwner: ['1st Owner', 'Pehla Owner', 'पहला मालिक'],
    since: ['Since 1974', 'Since 1974', '1974 से'],
    loc: ['Malad West, Mumbai', 'Malad West, Mumbai', 'मलाड वेस्ट, मुंबई'],
    whatsapp: ['WhatsApp', 'WhatsApp', 'व्हाट्सऐप'],
    callNow: ['CALL NOW', 'CALL NOW', 'अभी कॉल करें'],
    dmUs: ['DM US', 'DM KAREIN', 'डीएम करें'],
    brandName: ['CLASSIC AUTO', 'CLASSIC AUTO', 'क्लासिक ऑटो'],
    sinceLoc: ['Since 1974 · Malad West', 'Since 1974 · Malad West', '1974 से · मलाड वेस्ट'],
    emiEst: ['Est. EMI', 'Est. EMI', 'अनुमानित EMI'],
    perMo: ['/mo*', '/mah*', '/माह*'],
    emiNote: ['*Estimate: 20% down, {rate}% p.a., 60 months. Actual EMI is set by the lender.',
      '*Estimate: 20% down, {rate}% p.a., 60 mahine. Asli EMI lender tay karta hai.',
      '*अनुमान: 20% डाउन, {rate}% वार्षिक, 60 माह। असली EMI बैंक तय करता है।'],
    emiFrom: ['EMI from', 'EMI shuru', 'EMI शुरू'],
    km: ['km', 'km', 'किमी'],
    lakh: ['L', 'L', 'लाख'],
    crore: ['Cr', 'Cr', 'करोड़'],
    // spec labels
    lYear: ['Year', 'Saal', 'वर्ष'], lKms: ['Kms driven', 'KMs chali', 'चली दूरी'], lFuel: ['Fuel', 'Fuel', 'ईंधन'],
    lTrans: ['Gearbox', 'Gearbox', 'गियरबॉक्स'], lOwner: ['Owner', 'Owner', 'मालिक'], lIns: ['Insurance', 'Insurance', 'बीमा'],
    petrol: ['Petrol', 'Petrol', 'पेट्रोल'], diesel: ['Diesel', 'Diesel', 'डीज़ल'], cng: ['CNG', 'CNG', 'सीएनजी'],
    electric: ['Electric', 'Electric', 'इलेक्ट्रिक'], hybrid: ['Hybrid', 'Hybrid', 'हाइब्रिड'],
    manual: ['Manual', 'Manual', 'मैनुअल'], automatic: ['Automatic', 'Automatic', 'ऑटोमैटिक'],
    // CTAs. Neutral by default (DM / visit). The "Wa" twin is used only when a WhatsApp number is set.
    ctaArrival: ['DM us to book a test drive', 'Test drive ke liye DM karein', 'टेस्ट ड्राइव के लिए डीएम करें'],
    ctaArrivalWa: ['WhatsApp us to book a test drive', 'Test drive ke liye WhatsApp karein', 'टेस्ट ड्राइव के लिए व्हाट्सऐप करें'],
    ctaDrop: ['Message us before it goes', 'Jaane se pehle message karein', 'बिकने से पहले संदेश करें'],
    ctaGuess: ['Guess the price in the comments. Answer in tomorrow’s story.', 'Price comments mein guess karo. Jawab kal ki story mein.', 'कीमत कमेंट में बताइए। जवाब कल की स्टोरी में।'],
    guessLine: ['Guess the price in the comments. Answer in {r}.', 'Price comments mein guess karo. Jawab {r} mein.', 'कीमत कमेंट में बताइए। जवाब: {r}।'],
    // new price
    nowTxt: ['Now', 'Ab', 'अब'], wasTxt: ['Was', 'Pehle', 'पहले'], youSave: ['You save', 'Aapki bachat', 'आपकी बचत'],
    validTill: ['Offer valid till', 'Offer valid till', 'ऑफ़र मान्य'],
    dropHead: ['NEW PRICE', 'NAYA PRICE', 'नई कीमत'],
    postedOn: ['Old price posted on', 'Purana price post hua', 'पुरानी कीमत पोस्ट हुई'],
    // sold
    delivered: ['Delivered', 'Delivered', 'डिलीवर्ड'], soldStamp: ['Sold', 'Sold', 'बिक गई'],
    congrats: ['Congratulations', 'Mubarak ho', 'बधाई हो'],
    deliveredLine: ['Delivered with thanks from all of us at Classic Auto.', 'Classic Auto parivaar ki taraf se dher saara shukriya.', 'क्लासिक ऑटो परिवार की ओर से धन्यवाद।'],
    consentNote: ['Shared with the customer’s consent.', 'Customer ki ijazat se share kiya.', 'ग्राहक की अनुमति से साझा।'],
    // carousel
    thisWeek: ['This week’s stock', 'Is hafte ka stock', 'इस हफ़्ते का स्टॉक'],
    cars: ['cars', 'gaadiyan', 'गाड़ियाँ'], car1: ['car', 'gaadi', 'गाड़ी'],
    swipe: ['Swipe to see them all', 'Sab dekhne ke liye swipe karein', 'सब देखने के लिए स्वाइप करें'],
    ctaEndHead: ['Which one is yours?', 'Kaun si aapki?', 'कौन सी आपकी?'],
    ctaEndSub: ['Book a viewing at the showroom or DM us. We will line up the car and the paperwork.',
      'Showroom aakar dekhein ya DM karein. Gaadi aur paperwork hum taiyar rakhenge.',
      'शोरूम आकर देखें या डीएम करें। गाड़ी और कागज़ात हम तैयार रखेंगे।'],
    ctaEndSubWa: ['Book a viewing at the showroom or message us on WhatsApp. We will line up the car and the paperwork.',
      'Showroom aakar dekhein ya WhatsApp karein. Gaadi aur paperwork hum taiyar rakhenge.',
      'शोरूम आकर देखें या व्हाट्सऐप करें। गाड़ी और कागज़ात हम तैयार रखेंगे।'],
    visitUs: ['Visit the showroom', 'Showroom aayein', 'शोरूम आइए'],
    visitShort: ['Visit us · Prabhu Plaza, Malad West', 'Showroom: Prabhu Plaza, Malad West', 'Showroom: Prabhu Plaza, Malad West'],
    // reel / story / wa
    tapMsg: ['DM us to book a test drive', 'Test drive ke liye DM karein', 'टेस्ट ड्राइव के लिए डीएम करें'],
    tapMsgWa: ['Tap the link to WhatsApp us', 'WhatsApp karne ke liye link par tap karein', 'व्हाट्सऐप के लिए लिंक पर टैप करें'],
    tapCall: ['Call us to book a visit', 'Visit book karne ke liye call karein', 'विज़िट बुक करने के लिए कॉल करें'],
    linkGuide: ['Place the link sticker here', 'Link sticker yahan lagayein', 'लिंक स्टिकर यहाँ लगाएँ'],
    replyBook: ['Reply to book a visit', 'Visit book karne ke liye reply karein', 'विज़िट बुक करने के लिए जवाब दें'],
    liveNow: ['In the showroom now', 'Abhi showroom mein', 'अभी शोरूम में'],
    kwLine: ['Comment {k} and we will DM you the details', 'Comment mein {k} likhein, hum details DM karenge', 'कमेंट में {k} लिखें, हम विवरण डीएम करेंगे'],
    // guess
    guessHead: ['GUESS THE PRICE', 'PRICE GUESS KARO', 'कीमत बताइए'],
    // trust (every line traces to FACTS.md)
    trustHead: ['Trusted always. Since 1974.', 'Hamesha bharosa. 1974 se.', 'हमेशा भरोसा। 1974 से।'],
    trust1: ['Since 1974', '1974 se', '1974 से'],
    trust1s: ['{yrs} years of buying and selling cars.', '{yrs} saal se gaadiyon ki khareed-bikri.', '{yrs} साल से गाड़ियों की खरीद-बिक्री।'],
    trust2: ['Budget to luxury', 'Budget se luxury tak', 'बजट से लक्ज़री तक'],
    trust2s: ['Budget hatchbacks to luxury SUVs.', 'Budget hatchback se luxury SUV tak.', 'बजट हैचबैक से लक्ज़री SUV तक।'],
    trust2i: ['Every car inspected', 'Har gaadi ki jaanch', 'हर गाड़ी की जाँच'],
    trust2is: ['Checked before it goes on the lot.', 'Lot par aane se pehle check hoti hai.', 'बिक्री से पहले पूरी जाँच।'],
    trust3: ['Easy finance', 'Aasaan finance', 'आसान फ़ाइनेंस'],
    trust3s: ['Ask us how car finance works.', 'Car finance kaise hota hai, humse poochiye.', 'कार फ़ाइनेंस कैसे होता है, हमसे पूछिए।'],
    trust4: ['Buy · Sell · Exchange · Upgrade', 'Buy · Sell · Exchange · Upgrade', 'खरीदें · बेचें · एक्सचेंज · अपग्रेड'],
    trust4s: ['Trade in your old car with us.', 'Apni purani gaadi humein dein.', 'अपनी पुरानी गाड़ी हमें दें।'],
    trustFoot: ['Come and see for yourself.', 'Aakar khud dekhiye.', 'आकर खुद देखिए।'],
    // sell
    buyHead: ['WE BUY CARS', 'HUM GAADI KHARIDTE HAIN', 'हम गाड़ी खरीदते हैं'],
    buySub: ['Sell your car to a dealer who has been doing this since 1974.', 'Apni gaadi 1974 se chal rahe dealer ko bechiye.', 'अपनी गाड़ी 1974 से चल रहे डीलर को बेचिए।'],
    parkHead: ['PARK-N-SELL', 'PARK-N-SELL', 'पार्क-एन-सेल'],
    parkSub: ['Park it with us. We show it to buyers and handle the deal.', 'Gaadi humare paas park karein. Hum buyers ko dikhate hain aur deal sambhalte hain.', 'गाड़ी हमारे पास खड़ी करें। हम खरीदार दिखाते हैं और सौदा संभालते हैं।'],
    step: ['Step', 'Step', 'चरण'],
    buy1: ['Visit', 'Visit', 'मिलें'], buy1s: ['Bring your car to the showroom.', 'Gaadi showroom le aayein.', 'गाड़ी शोरूम लाइए।'],
    buy2: ['Quote', 'Quote', 'कीमत'], buy2s: ['A clear price for your car.', 'Aapki gaadi ka saaf price.', 'आपकी गाड़ी की साफ़ कीमत।'],
    buy3: ['Get paid', 'Payment', 'भुगतान'], buy3s: ['Paperwork handled by us.', 'Paperwork hum sambhalte hain.', 'कागज़ात हम संभालते हैं।'],
    park1: ['Park', 'Park', 'पार्क'], park1s: ['Leave the car in our showroom.', 'Gaadi showroom mein chhodiye.', 'गाड़ी हमारे शोरूम में छोड़िए।'],
    park2: ['Show', 'Dikhao', 'दिखाएँ'], park2s: ['We list it and meet buyers.', 'Hum list karte hain, buyers se milte hain.', 'हम सूचीबद्ध कर खरीदारों से मिलते हैं।'],
    park3: ['Sold', 'Bik gayi', 'बिक्री'], park3s: ['You agree the price, we close it.', 'Aap price tay karein, hum deal close karte hain.', 'आप कीमत तय करें, हम सौदा पूरा करते हैं।'],
    sellCta: ['DM us photos, year and km for a quote', 'Photos, saal aur km DM karein, quote paayein', 'कोट के लिए फोटो, वर्ष और किमी डीएम करें'],
    sellCtaWa: ['WhatsApp photos, year and km for a quote', 'Photos, saal aur km WhatsApp karein, quote paayein', 'कोट के लिए फोटो, वर्ष और किमी व्हाट्सऐप करें'],
    // finance
    finHead: ['EMI, worked out', 'EMI ka hisaab', 'EMI का हिसाब'],
    finSub: ['A worked example on one of our cars', 'Hamari ek gaadi par ek udaaharan', 'हमारी एक गाड़ी पर उदाहरण'],
    finPrice: ['Car price', 'Gaadi ki price', 'गाड़ी की कीमत'], finDown: ['Down payment', 'Down payment', 'डाउन पेमेंट'],
    finLoan: ['Loan amount', 'Loan amount', 'लोन राशि'], finTenure: ['Tenure', 'Tenure', 'अवधि'], finRate: ['Interest rate', 'Interest rate', 'ब्याज दर'],
    finMonths: ['months', 'mahine', 'माह'], finPa: ['p.a.', 'p.a.', 'वार्षिक'],
    finEmi: ['Estimated EMI', 'Anumaanit EMI', 'अनुमानित EMI'],
    finDisc: ['Estimate only. Actual EMI, rate and approval depend on the lender and your profile.',
      'Sirf estimate. Asli EMI, rate aur approval lender aur aapki profile par depend karte hain.',
      'केवल अनुमान। असली EMI, दर और मंज़ूरी बैंक और आपकी प्रोफ़ाइल पर निर्भर है।'],
    finTnc: ['T&C apply. Subject to lender approval.', 'T&C apply. Lender approval ke adheen.', 'शर्तें लागू। बैंक की मंज़ूरी पर निर्भर।'],
    finInterest: ['Total interest', 'Total byaaj', 'कुल ब्याज'],
    finNoPrice: ['Add the car’s price', 'Gaadi ka price daalein', 'गाड़ी की कीमत जोड़ें'],
    // hiring
    hiringHead: ['WE’RE HIRING', 'HUM HIRE KAR RAHE HAIN', 'हमें चाहिए'],
    hiringApply: ['How to apply', 'Apply kaise karein', 'आवेदन कैसे करें'],
    hiringMsg: ['DM us your name and a short note', 'Apna naam aur chhota note DM karein', 'अपना नाम और छोटा संदेश डीएम करें'],
    hiringMsgWa: ['WhatsApp us your name and a short note', 'Apna naam aur chhota note WhatsApp karein', 'अपना नाम और छोटा संदेश व्हाट्सऐप करें'],
    // testimonial
    testiBy: ['Bought a', 'Kharidi', 'खरीदी'],
    testiNote: ['Shared with the customer’s permission.', 'Customer ki ijazat se.', 'ग्राहक की अनुमति से।'],
    // misc
    fromFamily: ['From all of us at Classic Auto', 'Classic Auto parivaar ki taraf se', 'क्लासिक ऑटो परिवार की ओर से'],
    happy: ['Happy', 'Shubh', 'शुभ'],
    heroH1: ['Pre-owned cars you can trust.', 'Bharose ki pre-owned gaadiyan.', 'भरोसेमंद पुरानी गाड़ियाँ।'],
    heroSub: ['Budget hatchbacks to luxury SUVs. Malad West, since 1974.', 'Budget hatchback se luxury SUV tak. Malad West mein 1974 se.', 'बजट हैचबैक से लक्ज़री SUV तक। मलाड वेस्ट में 1974 से।'],
    browse: ['Browse the stock', 'Stock dekhein', 'स्टॉक देखें'],
    ytWalk: ['WALKAROUND', 'WALKAROUND', 'वॉकअराउंड'],
    adjLabelBlur: ['blurred background', 'blurred background', 'बैकग्राउंड ब्लर'],
    photoPrefix: ['Photo: ', 'Photo: ', 'फ़ोटो: '],
    adjLabelBright: ['brightness adjusted', 'brightness adjusted', 'ब्राइटनेस एडजस्ट'],
    adjLabelPlate: ['number plate blurred', 'number plate blurred', 'नंबर प्लेट ब्लर'],
    adjLabelBg: ['background edited, car unretouched', 'background edited, car unretouched', 'बैकग्राउंड एडिटेड, गाड़ी अनछुई'],
    priceOnReq: ['Price on request', 'Price poochiye', 'कीमत पूछें'],
    dmHandle: ['DM @classicauto_1974', 'DM @classicauto_1974', 'DM @classicauto_1974'],
    swipeShort: ['Swipe', 'Swipe karein', 'स्वाइप करें'],
    lineup: ['The lineup', 'Is hafte ki line-up', 'इस हफ़्ते की लाइनअप'],
    revealDef: ['tomorrow’s story', 'kal ki story', 'कल की स्टोरी'],
    revealHead: ['THE ANSWER', 'YEH HAI JAWAB', 'यह रहा जवाब'],
    revealLine: ['The real asking price. Thanks for guessing.', 'Asli asking price. Guess karne ka shukriya.', 'असली एस्किंग प्राइस। अंदाज़ा लगाने का शुक्रिया।'],
    priceEnd: ['PRICE AT THE END', 'PRICE END MEIN', 'कीमत अंत में'],
    // Classic Listing
    hdrTag1: ['PRE - OWNED CARS', 'PRE - OWNED CARS', 'प्री - ओन्ड कारें'],
    hdrTag1L: ['PRE - OWNED LUXURY CARS', 'PRE - OWNED LUXURY CARS', 'प्री - ओन्ड लक्ज़री कारें'],
    hdrTag2: ['TRUSTED ALWAYS', 'TRUSTED ALWAYS', 'भरोसा हमेशा'],
    priceLbl: ['PRICE', 'PRICE', 'कीमत'],
    singleOwner: ['SINGLE OWNER', 'SINGLE OWNER', 'पहला मालिक'], regLbl: ['REGISTRATION', 'REGISTRATION', 'रजिस्ट्रेशन'],
    cYear: ['YEAR', 'YEAR', 'वर्ष'], cBrand: ['BRAND', 'BRAND', 'ब्रांड'], cModel: ['MODEL', 'MODEL', 'मॉडल'], cVariant: ['VARIANT', 'VARIANT', 'वेरिएंट'],
    cFuel: ['FUEL TYPE', 'FUEL TYPE', 'ईंधन'], cTrans: ['TRANSMISSION', 'TRANSMISSION', 'गियरबॉक्स'], cOwner: ['OWNER', 'OWNER', 'मालिक'],
    cDriven: ['DRIVEN', 'DRIVEN', 'चली'], cIns: ['INSURANCE', 'INSURANCE', 'बीमा'], cReg: ['REGISTRATION', 'REGISTRATION', 'रजिस्ट्रेशन'],
    cColour: ['COLOUR', 'COLOUR', 'रंग'], cSeats: ['SEATS', 'SEATS', 'सीटें'],
    validTillShort: ['VALID TILL', 'VALID TILL', 'वैध'], expired: ['EXPIRED', 'EXPIRED', 'समाप्त'], insTill: ['INSURANCE TILL', 'INSURANCE TILL', 'बीमा तक'],
    buyW: ['BUY', 'BUY', 'खरीदें'], sellW: ['SELL', 'SELL', 'बेचें'], exchW: ['EXCHANGE', 'EXCHANGE', 'एक्सचेंज'], upgW: ['UPGRADE', 'UPGRADE', 'अपग्रेड'],
    stampNew: ['NEW PRICE', 'NAYA PRICE', 'नई कीमत'], stampJust: ['JUST ARRIVED', 'JUST AAYI', 'अभी आई'], stampSold: ['SOLD', 'BIK GAYI', 'बिक गई'],
    stampBooked: ['BOOKED', 'BOOKED', 'बुक'], stampSoon: ['COMING SOON', 'JALD AA RAHI', 'जल्द आ रही']
  };
  PS.COPY = C;
  // hook-first reel covers: the first words on screen. fmt = the reel format of the growth plan (F1 walkaround, F3 Since 1974, F4 price games, F5 buyer trust).
  // price: what the cover does with the price ('show', or 'hide' for a reveal at the end of the video: a real price is shown only in the reveal frame).
  PS.HOOKS = [
    { id: 'first', fmt: 'F1', t: ['First look', 'First look', 'पहली झलक'], price: 'show' },
    { id: 'price', fmt: 'F1', t: ['Watch for the price', 'Price end tak dekhein', 'कीमत अंत तक देखें'], price: 'hide' },
    { id: 'guess', fmt: 'F4', t: ['Guess the price', 'Price guess karo', 'कीमत बताइए'], price: 'hide' },
    { id: 'worth', fmt: 'F4', t: ['Would you buy it?', 'Aap kharidenge?', 'क्या आप खरीदेंगे?'], price: 'hide' },
    { id: 'walk', fmt: 'F1', t: ['Walkaround', 'Walkaround', 'वॉकअराउंड'], price: 'show' },
    { id: 'checks', fmt: 'F5', t: ['5 checks before you buy', 'Kharidne se pehle 5 checks', 'खरीदने से पहले 5 जाँचें'], price: 'none' },
    { id: 'since', fmt: 'F3', t: ['Since 1974', 'Since 1974', '1974 से'], price: 'none' }
  ];
  PS.lang = 'en';
  const LI = { en: 0, hn: 1, hi: 2 };
  PS.tx = function (key) {
    const k = PS.contact && PS.contact().hasWa && C[key + 'Wa'] ? key + 'Wa' : key, e = C[k]; if (!e) return key;
    let s = e[LI[PS.lang] || 0] || e[0];
    if (s.indexOf('{rate}') >= 0) s = s.replace('{rate}', PS.emiOn() ? PS.rateText() : '');
    if (s.indexOf('{yrs}') >= 0) s = s.replace('{yrs}', String(new Date().getFullYear() - PS.SITE.since));
    return s;
  };
  // isHi() decides fonts and line metrics. Devanagari typed into a post whose language is English or Hinglish needs the Devanagari face and its taller lines too
  // (set per render by PS.drawTemplate), or the matras of one line run into the line above.
  PS.isHi = () => PS.lang === 'hi' || !!PS._deva;
  const DEVA = /[ऀ-ॿ]/;
  PS.hasDevaInput = function (S) {
    const hit = (o) => Object.keys(o || {}).some((k) => typeof o[k] === 'string' && DEVA.test(o[k]));
    return hit(S.x) || hit(S.car) || hit(S.ctaMap);
  };

  /* ---------- motion helpers (PS-7). A template reads S._t (0..1) when a frame is being made; S._t unset means the finished post. ---------- */
  const mc = (x) => Math.max(0, Math.min(1, x));
  PS.motion = {
    ease: (x) => 1 - Math.pow(1 - mc(x), 3), clamp: mc,
    progress: (S) => (S && S._t != null ? mc(S._t) : 1),
    // letters resolve left to right; the rest show seeded random glyphs. Same text, progress and seed always give the same string.
    scramble(text, p, seed) {
      if (p >= 1) return text; const s = String(text), n = s.length, G = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789', f = Math.round(mc(p) * 30); let r = (seed * 9301 + f * 49297) >>> 0, out = '';
      for (let i = 0; i < n; i++) { const ch = s[i]; if (ch === ' ' || i / n < p * 1.15 - 0.15) { out += ch; continue; } r = (r * 1664525 + 1013904223) >>> 0; out += G[r % G.length]; } return out;
    },
    // counts up and lands exactly on n (never past it)
    count: (n, p) => (p >= 1 ? n : Math.floor(n * mc(p) / 1000) * 1000)
  };

  /* ---------- today (local date; tests can pin it) ---------- */
  PS.today = function () { if (PS._today) return PS._today(); const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  // "31 Oct 2026", "31 October 2026", "31/10/2026", "2026-10-31", "Oct 31 2026" -> local Date, or null when the text is not a date
  PS.parseDate = function (v) {
    const s = String(v == null ? '' : v).trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/,/g, ' ').replace(/\s+/g, ' ');
    if (!s) return null; let m, d, mo, y;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +m[1]; mo = +m[2] - 1; d = +m[3]; }
    else if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) { d = +m[1]; mo = +m[2] - 1; y = +m[3]; }
    else if ((m = s.match(/^(\d{1,2}) ([a-z]{3,9}) (\d{4})$/))) { d = +m[1]; mo = MONTHS.indexOf(m[2].slice(0, 3)); y = +m[3]; }
    else if ((m = s.match(/^([a-z]{3,9}) (\d{1,2}) (\d{4})$/))) { mo = MONTHS.indexOf(m[1].slice(0, 3)); d = +m[2]; y = +m[3]; }
    else return null;
    if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;
    const dt = new Date(y, mo, d); return dt.getMonth() === mo ? dt : null;
  };
  PS.fmtDate = (dt, upper) => { const t = `${String(dt.getDate()).padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getMonth()]} ${dt.getFullYear()}`; return upper ? t.toUpperCase() : t; };
  // an offer line is printed only for a typed date that is today or later. status: '' (nothing typed), 'ok', 'past', 'unreadable'
  PS.offerStatus = function (text) {
    const t = String(text || '').trim(); if (!t) return { status: '', date: null };
    const d = PS.parseDate(t); if (!d) return { status: 'unreadable', date: null };
    return { status: d >= PS.today() ? 'ok' : 'past', date: d };
  };

  /* ---------- contact model. Every template, caption and toast reads only this. ---------- */
  // one number only: a field typed as "+91 98200 00000 / 022 2880 0000" prints the first number (a phone is never cut mid-number)
  const firstNumber = (v) => { const parts = String(v || '').split(/\s*(?:[\/,;|&]|\bor\b|\band\b)\s*/i).map((x) => x.trim()).filter((x) => x.replace(/\D/g, '').length >= 6); return parts[0] || ''; };
  PS.firstNumber = firstNumber; PS.hasManyNumbers = (v) => String(v || '').split(/\s*(?:[\/,;|&]|\bor\b|\band\b)\s*/i).filter((x) => x.replace(/\D/g, '').length >= 6).length > 1;
  const cleanPhone = (v) => firstNumber(v);
  PS.contact = function () {
    const s = PS.settings || {}, phone = cleanPhone(s.phone), wa = s.waSame ? phone : cleanPhone(s.whatsapp);
    let d = wa.replace(/\D/g, '').replace(/^0+/, ''); if (d.length === 10) d = '91' + d;
    return { phone, wa, hasPhone: !!phone, hasWa: !!wa, waUrl: d.length >= 6 ? 'https://wa.me/' + d : '', dm: C.dmHandle[0], handle: PS.SITE.handle, siteUrl: String(s.siteUrl || '').trim() };
  };

  /* ---------- money, EMI, formatting ---------- */
  PS.inr = (n) => Math.round(n).toLocaleString('en-IN');
  PS.isPOA = (v) => /^\s*(poa|price on request|on request|ask( for)? price|ask)\s*$/i.test(String(v == null ? '' : v));
  PS.PRICE_MIN = 50000; PS.PRICE_MAX = 50000000;                         // importer range check: ₹50,000 to ₹5 Cr
  PS.parseMoney = function (v) {
    if (v == null || v === '') return NaN;
    if (typeof v === 'number') return v < 1000 ? v * 1e5 : v;
    let s = String(v).toLowerCase().replace(/[₹,\s]|rs\.?|inr/g, '');
    let m = s.match(/^([\d.]+)(cr|crore)/); if (m) return parseFloat(m[1]) * 1e7;
    m = s.match(/^([\d.]+)(l|lac|lakh|lakhs)/); if (m) return parseFloat(m[1]) * 1e5;
    const n = parseFloat(s); if (isNaN(n)) return NaN;
    return n < 1000 ? n * 1e5 : n;           // "15.5" means 15.5 lakh
  };
  // when a typed price falls outside ₹50,000 to ₹5 Cr: the readings that would be in range ("850" -> 8,50,000)
  PS.priceGuess = function (v) {
    const n = PS.parseMoney(v); if (!isFinite(n) || (n >= PS.PRICE_MIN && n <= PS.PRICE_MAX)) return null;
    const raw = parseFloat(String(v).replace(/[^\d.]/g, '')); const c = [];
    if (isFinite(raw)) [raw, raw * 1e3, raw * 1e5].forEach((x) => { x = Math.round(x); if (x >= PS.PRICE_MIN && x <= PS.PRICE_MAX && !c.includes(x)) c.push(x); });
    return { n, options: c };
  };
  // Full style ("₹76,99,999") is the house style on the real feed. Short style ("₹76.99 L") TRUNCATES, never rounds.
  PS.priceStyle = () => (PS.settings && PS.settings.priceStyle === 'short' ? 'short' : 'full');
  PS.priceFull = function (n) { return isFinite(n) && n > 0 ? '₹' + PS.inr(n) : ''; };
  PS.priceParts = function (rupees, style) {
    if (!isFinite(rupees) || rupees <= 0) return null;
    if ((style || PS.priceStyle()) === 'full') return { sym: '₹', num: PS.inr(rupees), unit: '' };
    if (rupees >= 1e7) return { sym: '₹', num: (Math.floor(rupees / 1e5) / 100).toFixed(2), unit: PS.tx('crore') };
    return { sym: '₹', num: (Math.floor(rupees / 1e3) / 100).toFixed(2), unit: PS.tx('lakh') };
  };
  PS.priceText = function (rupees, style) { const p = PS.priceParts(rupees, style); return p ? `${p.sym}${p.num}${p.unit ? ' ' + p.unit : ''}` : ''; };
  PS.emiOf = function (price, dp = 0.20, rate = 0.115, months = 60) {
    const P = price * (1 - dp), r = rate / 12;
    if (!isFinite(P) || P <= 0) return NaN;
    return (P * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  };
  PS.emiRound = (e) => Math.round(e / 10) * 10;      // quote to the nearest ₹10 so it reads like an estimate
  // EMI is shown only after the owner types a lender-confirmed rate in Settings (no rate, no EMI line anywhere). The estimate is always 20% down over 60 months.
  PS.emiRate = () => { const r = parseFloat(String((PS.settings || {}).emiRate || '').replace(',', '.')); return r >= 5 && r <= 30 ? r : NaN; };
  PS.emiOn = () => isFinite(PS.emiRate());
  PS.emiEst = (price) => (PS.emiOn() && isFinite(price) && price > 0 ? PS.emiRound(PS.emiOf(price, 0.20, PS.emiRate() / 100, 60)) : NaN);
  PS.rateText = () => String(+PS.emiRate().toFixed(2));
  PS.kmText = (n) => (n || n === 0) && n !== '' ? `${PS.inr(+n)} ${PS.tx('km')}` : '';
  const FUEL_KEY = { petrol: 'petrol', diesel: 'diesel', cng: 'cng', electric: 'electric', ev: 'electric', hybrid: 'hybrid' };
  PS.fuelText = (f) => { const k = FUEL_KEY[String(f || '').toLowerCase()]; return k ? PS.tx(k) : (f || ''); };
  PS.transText = (t) => {
    const s = String(t || '').toLowerCase();
    if (!s) return '';
    if (s.startsWith('man') || s === 'mt') return PS.tx('manual');
    if (s.startsWith('auto') || ['at', 'amt', 'dct', 'cvt', 'ivt'].includes(s)) return PS.tx('automatic');
    return t;
  };
  PS.ownerText = (n) => {
    n = parseInt(n, 10); if (!n) return '';
    if (PS.lang === 'hi') return ['', 'पहला मालिक', 'दूसरा मालिक', 'तीसरा मालिक'][n] || `${n}वाँ मालिक`;
    if (PS.lang === 'hn') return ['', 'Pehla owner', 'Doosra owner', 'Teesra owner'][n] || `${n}th owner`;
    return ['', '1st Owner', '2nd Owner', '3rd Owner'][n] || `${n}th Owner`;
  };
  // owner text as typed in a sheet: "single", "1", "1st" all mean first owner
  PS.ownersNum = (v) => { const s = String(v == null ? '' : v).trim().toLowerCase(); if (!s) return ''; if (/^(single|first|1st|one)/.test(s)) return 1; if (/^(second|2nd|two)/.test(s)) return 2; if (/^(third|3rd|three)/.test(s)) return 3; const n = parseInt(s, 10); return n > 0 ? n : ''; };
  // "DCT", "CVT", "AMT", "IVT", "AT", "MT" -> {trans, detail}
  PS.splitTrans = function (t) { const s = String(t || '').trim(); const u = s.toUpperCase(); if (['DCT', 'CVT', 'AMT', 'IVT', 'AT'].includes(u)) return { trans: 'Automatic', detail: u === 'AT' ? '' : u }; if (u === 'MT') return { trans: 'Manual', detail: '' }; return { trans: s, detail: '' }; };
  PS.slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  PS.bandOf = (n) => (!isFinite(n) || n <= 0 ? '' : n < 2000000 ? 'u20' : n < 5000000 ? '20to50' : '50plus');
  PS.BAND_LABEL = { u20: 'Under ₹20 L', '20to50': '₹20 to 50 L', '50plus': '₹50 L+' };

  // badge ids -> copy keys. "Certified" stays out of the list: it is a claim nobody has confirmed for Classic Auto.
  PS.BADGES = [
    ['just_arrived', 'justArrived'], ['price_drop', 'priceDrop'], ['sold', 'sold'],
    ['low_kms', 'lowKms'], ['first_owner', 'firstOwner']
  ];

  /* ---------- the stock the studio opens with: the 7 priced cars on the real Instagram feed (website-v6 SPEC 3.3).
     Photos are crops from the listing posts (tools/prep_ig_crops.py), labelled "Photo from our Instagram listing" until real walk-around photos exist. ---------- */
  const car = (o) => Object.assign({ status: 'available', notes: '', segment: 'owned', reg_city: '', seats: '', trans_detail: '', insurance_type: '', insurance_until: '', insurance: '', oldPrice: '', tagline: '', chips: '', luxury: '', accent: '', photoSrc: 'ig', plateBox: null }, o);
  PS.SEED_CARS = [
    car({ id: 'tata-safari-2025', make: 'Tata', model: 'Safari', variant: 'Accomplished Plus (BS6)', year: 2025, reg_month: 'Apr 2025', rto: 'MH43', kms: 24400, fuel: 'Diesel', trans: 'Automatic', owners: 1, price: 2550000, colour: 'White', insurance_until: '2028-04-22', chips: 'INDIVIDUAL|REGISTRATION', source: 'ig:Dd8sy5EkR1T', photo: 'assets/cars/tata-safari-2025.jpg' }),
    car({ id: 'bmw-x3-2025', make: 'BMW', model: 'X3', variant: 'xDrive20d M Sport', year: 2025, reg_month: 'Nov 2025', rto: 'MH09', kms: 17900, fuel: 'Diesel', trans: 'Automatic', owners: 1, price: 7699999, colour: 'White', insurance_until: '2028-11-05', source: 'ig:Ddv_dDqDj09', plateBox: { x: 0.612, y: 0.605, w: 0.232, h: 0.125 }, photo: 'assets/cars/bmw-x3-2025.jpg' }),
    car({ id: 'vw-tiguan-2025', make: 'Volkswagen', model: 'Tiguan', variant: 'R-Line', year: 2025, reg_month: 'Feb 2025', rto: 'MH14', kms: 8077, fuel: 'Petrol', trans: 'Automatic', owners: 1, price: 3995000, colour: 'Blue', insurance_until: '2029-02-22', insurance_type: 'Zero-dep', source: 'ig:DdyL0O9jluc', plateBox: { x: 0.636, y: 0.700, w: 0.222, h: 0.130 }, photo: 'assets/cars/vw-tiguan-2025.jpg' }),
    car({ id: 'kia-carens-2023', make: 'Kia', model: 'Carens', variant: 'G1.5 DCT Luxury Plus 7-seater', year: 2023, reg_month: 'Sep 2023', rto: 'MH01', kms: 32392, fuel: 'Petrol', trans: 'Automatic', trans_detail: 'DCT', owners: 1, price: 1495000, colour: 'Intens Red', seats: 7, insurance_until: '', accent: 'maroon', source: 'ig:Dd8bnN7EaF8', photo: 'assets/cars/kia-carens-2023.jpg' }),
    car({ id: 'kia-seltos-2022', make: 'Kia', model: 'Seltos', variant: 'G1.5 IVT HTX', year: 2022, reg_month: 'Dec 2022', rto: 'MH01', kms: 23000, fuel: 'Petrol', trans: 'Automatic', trans_detail: 'IVT', owners: 1, price: 1385000, colour: 'White', insurance_until: '2027-01-07', insurance_type: 'Comprehensive', accent: 'black', source: 'ig:Dd0VMs1DkmD', photo: 'assets/cars/kia-seltos-2022.jpg' }),
    car({ id: 'jaguar-xf-2013', make: 'Jaguar', model: 'XF', variant: '2.2L Diesel', year: 2013, reg_month: 'Nov 2013', rto: 'DD03', kms: 53700, fuel: 'Diesel', trans: 'Automatic', owners: 1, price: 985000, colour: 'Green', seats: 5, chips: 'INDIVIDUAL|TAX PAID', accent: 'green', source: 'ig:Dd8YvM0Eerj', photo: 'assets/cars/jaguar-xf-2013.jpg' }),
    car({ id: 'renault-kwid-2017', make: 'Renault', model: 'Kwid', variant: 'RXT Climber EASY-R', year: 2017, reg_month: 'Jul 2017', rto: 'MH02', kms: 7879, fuel: 'Petrol', trans: 'Automatic', trans_detail: 'AMT', owners: 1, price: 285000, colour: 'Blue', insurance: '', source: 'ig:DdxwV6OjvXh', photo: 'assets/cars/renault-kwid-2017.jpg' })
  ];
  PS.DEMO_CARS = PS.SEED_CARS;      // old name kept so nothing that still says DEMO_CARS breaks

  // photo provenance: 'own' (owner's shoot or upload), 'ig' (cropped from our Instagram listing), 'stock' (bundled layout-test photo, NOT our car)
  PS.PHOTO_SRC_LABEL = { own: 'our own photo', ig: 'Photo from our Instagram listing', stock: 'stock layout-test photo (not our car)' };
  PS.newPhoto = (img, name, src) => ({ img, name: name || '', px: 0.5, py: 0.55, zoom: 1, fit: 'auto', bright: 0, contrast: 0, src: src || 'own', plate: null });
  // does this image carry real transparency (a cut-out car)? Samples a 64 px copy.
  PS.hasAlpha = function (img) {
    try { const w = 64, h = Math.max(8, Math.round(64 * (img.naturalHeight || img.height) / (img.naturalWidth || img.width))), cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data; let t = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 200) t++; return t > w * h * 0.04; } catch (e) { return false; }
  };
  PS.loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  PS.fileToImage = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = r.result; };
    r.onerror = rej; r.readAsDataURL(file);       // data URL keeps the canvas untainted
  });

  /* ---------- settings (localStorage, guarded) ---------- */
  PS.settings = { phone: '', whatsapp: '', waSame: false, siteUrl: '', priceStyle: 'full', emiRate: '', lang: 'en', showAdj: true, claimInspected: false, platesTool: false, approvals: {} };
  PS._migrated = false;
  try {
    const saved = JSON.parse(localStorage.getItem('ca-post-studio-settings') || '{}');
    // V1 kept one WhatsApp number in `wa`. It becomes the WhatsApp field (never the phone, so no CALL NOW appears by surprise).
    if (saved.wa && !saved.whatsapp) { saved.whatsapp = saved.wa; PS._migrated = true; } delete saved.wa;
    Object.assign(PS.settings, saved);
  } catch (e) { /* private mode */ }
  PS.saveSettings = () => { try { localStorage.setItem('ca-post-studio-settings', JSON.stringify(PS.settings)); } catch (e) { /* ignore */ } };
  // CTA text typed for one template only (never shared between templates). Templates flagged noCta ignore it.
  PS.cta = (S) => { const id = S._tplId || S.tpl, t = PS.TPL && PS.TPL[id]; if (!t || t.noCta) return ''; return String((S.ctaMap || {})[id] || '').trim(); };

  /* ---------- insurance and luxury, computed the way the website does ---------- */
  // {state:'valid'|'expired'|'text'|'none', date, type, text}. The date comes from insurance_until (ISO); an old free-text value still works.
  PS.insuranceInfo = function (car) {
    car = car || {}; const u = car.insurance_until ? PS.parseDate(car.insurance_until) : null, ty = String(car.insurance_type || '').trim();
    if (u) { const ok = u >= PS.today(), d = PS.fmtDate(u); return { state: ok ? 'valid' : 'expired', date: u, type: ty, text: ok ? (ty ? `${ty}, valid till ${d}` : `Valid till ${d}`) : `Expired (${d})` }; }
    const t = String(car.insurance || '').trim();
    if (!t) return { state: 'none', date: null, type: ty, text: '' };
    return { state: /expired/i.test(t) ? 'expired' : 'text', date: null, type: ty, text: t };
  };
  // luxury header: automatic from the price, with a per-car override (x.luxury 'yes' / 'no')
  PS.isLuxury = function (car, override) {
    if (override === 'yes') return true; if (override === 'no') return false;
    const l = String((car && car.luxury) || '').toLowerCase(); if (l === 'yes' || l === 'true' || l === '1') return true; if (l === 'no' || l === 'false' || l === '0') return false;
    return PS.parseMoney(car && car.price) >= PS.SITE.luxuryFrom;
  };
})();
