/* =========================================================================
   Classic Auto v6: car finder ("Find my car in 2 minutes", finder.html).
   18 short questions, one per screen, every one skippable. Then a shortlist
   of 3 to 8 cars from window.CARS with plain "why it fits" lines.

   Scoring is in the open (the results page prints the rules):
   - Three must-haves are hard filters: budget (up to 10% over is still
     shown and said), seats, fuel. A car that fails one is never in the
     shortlist; it can only appear under "Close, but ..." with the reason.
   - Everything else is a weighted preference (W below). Fit % = points
     won / points possible for the questions that were answered.
   - Only facts on the listing are scored. A fact the listing does not have
     (seats on most cars, airbag count, features on some cars) is never
     guessed: it is said as "ask us" and left out of the sum.
   Nothing personal is stored. The answers stay in sessionStorage for this
   tab (so Back from a car page returns to the shortlist); the visitor's
   "finder or all cars" choice on the stock page is one word in
   localStorage. Name and phone only leave through the enquiry form.
   The pure part (questions, score, rank, shortlist) also runs under Node
   for tools/tests/finder_scoring.test.js.
   ========================================================================= */
(function (root) {
  "use strict";
  var LAKH = 100000;

  /* ---- facts that are not on the listing -------------------------------
     Seats: a car's own listing wins (`seats`, or "7 STR" in the variant).
     For these models the maker sells only a three-row layout in India, read
     on the page named, 15 Oct 2026. A car of another generation is not
     covered (the 2013 and 2016 Audi Q7, the 2011 Fortuner): its seats stay
     "ask us". */
  var THREE_ROW = [
    { make: "Toyota", model: "Fortuner", from: 2021, seats: 7, src: "CarTrade, Fortuner facelift seating (7 seater only)", url: "https://www.cartrade.com/toyota-cars/fortuner-facelift/faqs/what-is-the-seating-capacity-of-toyota-fortuner-facelift/" },
    { make: "Ford", model: "Endeavour", from: 2016, seats: 7, src: "Autocar India, third-generation Endeavour launch (seven seats standard)", url: "https://www.autocarindia.com/car-news/new-endeavour-399481" },
    { make: "Skoda", model: "Kodiaq", from: 2017, seats: 7, src: "Autocar Professional, Kodiaq India launch, 4 Oct 2017", url: "https://www.autocarpro.in/news-national/skoda-auto-india-launches-seven-seater-kodiaq-rs-3449-lakh-26471" },
    { make: "Mahindra", model: "XUV500", from: 2011, to: 2021, seats: 7, src: "CarDekho, XUV500 W8 specifications (seating 7)", url: "https://www.cardekho.com/mahindra/xuv500" },
    { make: "Mercedes-Benz", model: "GLS", from: 2020, seats: 7, src: "Autocar India, Mercedes-Benz GLS (seats up to seven)", url: "https://www.autocarindia.com/cars/mercedes-benz/gls" },
    { make: "Land Rover", model: "Defender", variant_has: "130", from: 2023, seats: 8, src: "Autocar India, Defender 130 India launch, 1 Mar 2023 (eight seats, 2-3-3)", url: "https://www.autocarindia.com/stories/defender-130-launched-price-422" }
  ];
  /* Size words for the parking question. A plain size class, not a measurement: "large" = a full-size SUV, MPV or limousine. */
  var LARGE = /^(Fortuner|Endeavour|Gloster|Defender|GLS|Maybach GLS|GLE|GLE Coupe|Q7|Kodiaq|XUV700|XUV500|Safari|Innova|Innova Crysta|Hector Plus|S-Class|7 Series|XJ|Range Rover Velar|Model Y|Harrier)$/;
  var COMPACT = /^(Tiago|Altroz|i20|Grand i10 Nios|Punch EV|Tigor EV)$/;

  function seatsOf(car) {
    if (car.seats) return { n: +car.seats, how: "listing" };
    var m = /\b(\d)\s*STR\b/i.exec(car.variant || "");
    if (m) return { n: +m[1], how: "listing" };
    for (var i = 0; i < THREE_ROW.length; i++) {
      var t = THREE_ROW[i];
      if (t.make === car.make && t.model === car.model && car.year >= t.from && (!t.to || car.year <= t.to) &&
          (!t.variant_has || String(car.variant).indexOf(t.variant_has) !== -1)) return { n: t.seats, how: "model", src: t.src, url: t.url };
    }
    return null;
  }
  function sizeOf(car) {
    if (LARGE.test(car.model)) return "large";
    if (car.body === "hatchback" || COMPACT.test(car.model)) return "compact";
    return "mid";
  }

  /* ---- formatting (mirrors main.js, so this file also runs under Node) ---- */
  function money(n) {
    n = Math.round(Number(n));
    if (n >= 10000000) return ("₹" + (Math.floor(n / 100000) / 100).toFixed(2) + " Cr").replace(".00", "");
    return ("₹" + (Math.floor(n / 1000) / 100).toFixed(2) + " L").replace(".00", "");
  }
  function km(n) { return Number(n).toLocaleString("en-IN") + " km"; }
  var BODY = { hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", mpv: "MPV", "luxury-sedan": "Luxury sedan", "luxury-suv": "Luxury SUV" };
  function bodyLabel(b) { return BODY[b] || b; }
  function ownerN(car) { var m = /^(\d)/.exec(car.owners || ""); return m ? +m[1] : null; }

  /* ---- the questions ------------------------------------------------------ */
  var BUDGET = { u5: [0, 5], "5-10": [5, 10], "10-15": [10, 15], "15-25": [15, 25], "25-50": [25, 50], "50-100": [50, 100], "100+": [100, Infinity] };
  var FEATURES = {
    sunroof: { label: "Sunroof", name: "sunroof", has: function (f) { return f.indexOf("Sunroof") !== -1 || f.indexOf("Panoramic sunroof") !== -1; }, word: function (f) { return f.indexOf("Panoramic sunroof") !== -1 ? "Panoramic sunroof" : "Sunroof"; } },
    adas: { label: "ADAS (driver assist)", name: "ADAS", has: function (f) { return f.indexOf("ADAS") !== -1; }, word: function () { return "ADAS"; } },
    carplay: { label: "Apple CarPlay / Android Auto", name: "CarPlay / Android Auto", has: function (f) { return f.indexOf("Apple CarPlay / Android Auto") !== -1; }, word: function () { return "CarPlay / Android Auto"; } },
    camera360: { label: "360-degree camera", name: "360-degree camera", has: function (f) { return f.indexOf("360-degree camera") !== -1; }, word: function () { return "360-degree camera"; } },
    ventilated: { label: "Ventilated seats", name: "ventilated seats", has: function (f) { return f.indexOf("Ventilated seats") !== -1; }, word: function () { return "Ventilated seats"; } },
    airbags: { label: "6 or more airbags", unknown: true }
  };
  var COLOURS = {
    white: [/white/i, "White"], black: [/black/i, "Black"], greysilver: [/grey|gray|silver/i, "Grey or silver"], blue: [/blue/i, "Blue"],
    red: [/red|maroon/i, "Red or maroon"], green: [/green/i, "Green"], other: [/brown|gold|bronze|orange|purple|beige/i, "Brown, gold or other"]
  };

  function questions(cars) {
    var makes = {};
    (cars || []).forEach(function (c) { if (c.status !== "SOLD") makes[c.make] = (makes[c.make] || 0) + 1; });
    var brandOpts = Object.keys(makes).sort().map(function (m) { return [m, m, makes[m] + (makes[m] === 1 ? " car" : " cars")]; });
    return [
      { id: "budget", must: true, title: "What is your budget?", hint: "The car's price, not the EMI. We also show cars up to 10% over and say so.",
        opts: [["u5", "Under ₹5 lakh"], ["5-10", "₹5 to 10 lakh"], ["10-15", "₹10 to 15 lakh"], ["15-25", "₹15 to 25 lakh"], ["25-50", "₹25 to 50 lakh"], ["50-100", "₹50 lakh to ₹1 crore"], ["100+", "Over ₹1 crore"]] },
      { id: "for", title: "Who are you buying for?", opts: [["self", "Myself"], ["family", "My family"], ["business", "My business"]] },
      { id: "seats", must: true, title: "How many seats do you need?", hint: "Most listings don't state seats yet. For 6 or more we only shortlist cars we know have them.",
        opts: [["4", "Up to 4"], ["5", "5"], ["7", "6 or 7", "Three rows"], ["8", "8"]] },
      { id: "body", multi: true, title: "Which body types do you like?", opts: [["hatchback", "Hatchback"], ["sedan", "Sedan"], ["suv", "SUV"], ["mpv", "MPV"], ["luxury-sedan", "Luxury sedan"], ["luxury-suv", "Luxury SUV"], ["any", "Any"]] },
      { id: "fuel", must: true, multi: true, title: "Which fuel?", hint: "Pick every fuel you'd accept.", opts: [["Petrol", "Petrol"], ["Diesel", "Diesel"], ["Electric", "Electric"], ["Hybrid", "Hybrid", "Petrol hybrid"], ["CNG", "CNG"], ["any", "Any"]] },
      { id: "gear", title: "Manual or automatic?", opts: [["Automatic", "Automatic"], ["Manual", "Manual"], ["any", "Either"]] },
      { id: "use", title: "City or highway?", opts: [["city", "Mostly city", "Mumbai traffic"], ["mix", "A mix"], ["highway", "Mostly highway", "Outstation runs"]] },
      { id: "daily", title: "How far do you drive in a day?", opts: [["lt20", "Under 20 km"], ["20-50", "20 to 50 km"], ["50-100", "50 to 100 km"], ["100+", "Over 100 km"]] },
      { id: "parking", title: "How big is your parking?", opts: [["tight", "Tight", "Society slot or street"], ["normal", "Normal"], ["big", "Plenty of room"]] },
      { id: "age", title: "How new should it be?", opts: [["2023", "2023 or newer", "Nearly new"], ["2020", "2020 or newer"], ["2016", "2016 or newer"], ["any", "Any year", "If the price is right"]] },
      { id: "brand", multi: true, title: "Any brands you like?", hint: "Pick as many as you like. The number is how many we have.", opts: brandOpts.concat([["any", "No preference"]]) },
      { id: "features", multi: true, title: "Any must-have features?", hint: "We match the feature list on each listing. Airbag counts are not on the listings yet: we confirm them on the car.",
        opts: [["sunroof", "Sunroof"], ["adas", "ADAS", "Driver assist"], ["airbags", "6+ airbags"], ["carplay", "CarPlay / Android Auto"], ["camera360", "360° camera"], ["ventilated", "Ventilated seats"], ["any", "None needed"]] },
      { id: "colour", multi: true, title: "Colours you like?", opts: [["white", "White"], ["black", "Black"], ["greysilver", "Grey or silver"], ["blue", "Blue"], ["red", "Red or maroon"], ["green", "Green"], ["other", "Brown, gold, other"], ["any", "Any colour"]] },
      { id: "owners", title: "How many previous owners is fine?", opts: [["1", "First owner only"], ["2", "Up to two"], ["any", "Doesn't matter"]] },
      { id: "kms", title: "How many km on the clock is fine?", opts: [["30000", "Under 30,000 km"], ["60000", "Under 60,000 km"], ["100000", "Under 1,00,000 km"], ["any", "Doesn't matter"]] },
      { id: "pay", title: "How would you pay?", hint: "EMI figures on the site are estimates, not a loan offer.", opts: [["full", "Full payment"], ["emi", "Car loan (EMI)"], ["part", "Part down, part loan"], ["undecided", "Not sure yet"]] },
      { id: "exchange", title: "Do you have a car to exchange?", opts: [["yes", "Yes", "We'll value it"], ["no", "No"]] },
      { id: "when", title: "When do you want to buy?", opts: [["week", "This week"], ["month", "This month"], ["quarter", "In 3 months"], ["browsing", "Just looking"]] }
    ];
  }

  /* Weights for the preferences. Printed on the results page as they are here. */
  var W = { budget: 20, for: 6, body: 14, gear: 14, use: 6, daily: 6, parking: 8, age: 10, brand: 12, features: 5, colour: 4, owners: 12, kms: 8 };

  function list(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]).filter(function (x) { return x !== "any"; }); }

  /* Must-haves. Returns the reasons a car fails, [] when it passes. */
  function hardFails(car, a) {
    var out = [];
    var b = BUDGET[a.budget];
    if (b && !car.price_on_request && car.price != null && car.price > b[1] * LAKH * 1.10) out.push("Over your budget at " + money(car.price));
    var need = { "5": 5, "7": 6, "8": 8 }[a.seats];
    if (need) {
      var s = seatsOf(car);
      if (s && s.n < need) out.push(s.n + " seats");
      else if (!s && need >= 6) out.push("Seats not on the listing");
    }
    var fuels = list(a.fuel);
    if (fuels.length && fuels.indexOf(car.fuel) === -1) out.push("Runs on " + String(car.fuel).toLowerCase());
    return out;
  }

  function score(car, a) {
    a = a || {};
    var pts = 0, max = 0, why = [], miss = [], ask = [];
    function add(w, frac, yes, no) { max += w; pts += w * frac; if (frac >= 0.6 && yes) why.push(yes); if (frac < 0.6 && no) miss.push(no); }

    var b = BUDGET[a.budget];
    if (b) {
      var lo = b[0] * LAKH, hi = b[1] * LAKH;
      if (car.price_on_request || car.price == null) { max += W.budget; pts += W.budget * 0.5; ask.push("Price on request"); }
      else if (car.price <= hi && car.price >= lo) add(W.budget, 1, "Inside your budget at " + money(car.price));
      else if (car.price < lo) add(W.budget, car.price >= lo * 0.6 ? 0.7 : 0.35, "Under your budget at " + money(car.price), "Well under your budget at " + money(car.price));
      else add(W.budget, 0.4, "", "A little over your budget at " + money(car.price));
    }
    var s = seatsOf(car), need = { "5": 5, "7": 6, "8": 8 }[a.seats];
    if (need && s && s.n >= need) why.push(s.n + " seats" + (s.how === "model" ? " (this model's layout; we confirm on the car)" : ""));
    else if (need && !s) ask.push("Seats: ask us");

    var lux = /^luxury/.test(car.body), roomy = /suv|mpv/.test(car.body) || (s && s.n >= 6);
    if (a["for"] === "family") add(W["for"], roomy ? 1 : car.body === "sedan" || car.body === "luxury-sedan" ? 0.6 : 0.3, "Room for the family: " + bodyLabel(car.body), "A " + bodyLabel(car.body).toLowerCase() + ": smaller for a family");
    else if (a["for"] === "business") add(W["for"], lux ? 1 : 0.4, "A " + car.make + " for client visits", "");

    var bodies = list(a.body);
    if (bodies.length) {
      var near = { suv: "luxury-suv", "luxury-suv": "suv", sedan: "luxury-sedan", "luxury-sedan": "sedan" };
      if (bodies.indexOf(car.body) !== -1) add(W.body, 1, bodyLabel(car.body) + ", as you asked");
      else if (bodies.indexOf(near[car.body]) !== -1) add(W.body, 0.6, bodyLabel(car.body) + ", close to the " + bodyLabel(near[car.body]).toLowerCase() + " you picked");
      else add(W.body, 0, "", "A " + bodyLabel(car.body).toLowerCase() + ", not a body type you picked");
    }
    if (a.gear && a.gear !== "any") add(W.gear, car.trans === a.gear ? 1 : 0, car.trans + " gearbox", car.trans + " gearbox");

    var size = sizeOf(car);
    if (a.use === "city") add(W.use, (car.trans === "Automatic" ? 0.6 : 0) + (size !== "large" ? 0.4 : 0), car.trans === "Automatic" ? "Automatic: easier in stop-go traffic" : "Easy size for the city", "A big car for city traffic");
    else if (a.use === "highway") add(W.use, (/Diesel|Hybrid/.test(car.fuel) ? 0.5 : 0) + (/suv|luxury/.test(car.body) ? 0.5 : 0), /Diesel|Hybrid/.test(car.fuel) ? car.fuel + " for long highway runs" : bodyLabel(car.body) + " for long highway runs", "");

    if (a.daily === "50-100" || a.daily === "100+") add(W.daily, /Diesel|Hybrid|CNG|Electric/.test(car.fuel) ? 1 : 0.3, car.fuel + ": usually cheaper per km than petrol on long daily drives", "");

    if (a.parking === "tight") add(W.parking, size === "compact" ? 1 : size === "mid" ? 0.6 : 0, size === "compact" ? "Compact " + bodyLabel(car.body).toLowerCase() + ", easy to park" : "", "A big car: check it fits your parking");
    else if (a.parking === "normal") add(W.parking, size === "large" ? 0.4 : 1, "", "A big car: check it fits your parking");

    if (a.age && a.age !== "any") { var y = +a.age; add(W.age, car.year >= y ? 1 : car.year >= y - 2 ? 0.5 : 0, car.year + " model", car.year + " model, older than you asked"); }

    var brands = list(a.brand);
    if (brands.length) add(W.brand, brands.indexOf(car.make) !== -1 ? 1 : 0, car.make + ", a brand you picked", "");

    var feats = list(a.features), have = car.features || [];
    feats.forEach(function (f) {
      var F = FEATURES[f]; if (!F) return;
      if (F.unknown) { ask.push("Airbags: we confirm the count on the car"); return; }
      if (!have.length) return;                                   // no feature list on this listing: not scored
      add(W.features, F.has(have) ? 1 : 0, F.has(have) ? F.word(have) + " listed" : "", "No " + F.name + " on the listing");
    });
    if (feats.some(function (f) { return !FEATURES[f].unknown; }) && !have.length) ask.push("Features not listed yet: ask us");

    var cols = list(a.colour);
    if (cols.length) {
      var hit = cols.some(function (k) { return k === "other" ? !Object.keys(COLOURS).some(function (j) { return j !== "other" && COLOURS[j][0].test(car.colour); }) : COLOURS[k][0].test(car.colour); });
      add(W.colour, hit ? 1 : 0, car.colour + " paint", "");
    }
    if (a.owners && a.owners !== "any") {
      var n = ownerN(car), lim = +a.owners;
      if (n == null) { max += W.owners; pts += W.owners * 0.5; ask.push("Owner count: ask us"); }
      else add(W.owners, n <= lim ? 1 : n === lim + 1 ? 0.3 : 0, n === 1 ? "First owner" : car.owners + " owner", car.owners + " owner");
    }
    if (a.kms && a.kms !== "any" && car.kms != null) {
      var k = +a.kms;
      add(W.kms, car.kms <= k ? 1 : car.kms <= k * 1.25 ? 0.4 : 0, km(car.kms) + " driven", km(car.kms) + " driven, more than you asked");
    }
    return { pts: pts, max: max, pct: max ? Math.round(pts / max * 100) : null, why: why, miss: miss, ask: ask };
  }

  function rank(cars, a) {
    return (cars || []).filter(function (c) { return c.status !== "SOLD"; }).map(function (c) {
      var r = score(c, a); r.car = c; r.fails = hardFails(c, a); r.pass = !r.fails.length; return r;
    }).sort(function (x, y) {
      return (y.pass - x.pass) || ((y.pct || 0) - (x.pct || 0)) || (y.pts - x.pts) || (y.car.year - x.car.year) || ((x.car.kms || 0) - (y.car.kms || 0));
    });
  }

  /* 3 to 8 cars. Strong fits (50% or more) when at least 3 pass; otherwise the best 3 that pass.
     When fewer than 3 pass the must-haves, "near" tops the page up to 3 with the cars that miss the fewest must-haves,
     each shown with what it misses. */
  function shortlist(ranked) {
    var pass = ranked.filter(function (r) { return r.pass; });
    var strong = pass.filter(function (r) { return r.pct == null || r.pct >= 50; });
    var picks = (strong.length >= 3 ? strong : pass).slice(0, 8);
    if (pass.length >= 3 && picks.length < 3) picks = pass.slice(0, 3);
    var near = [];
    if (pass.length < 3) {
      var out = ranked.filter(function (r) { return !r.pass; });
      var fewest = Math.min.apply(null, out.map(function (r) { return r.fails.length; }));
      near = out.filter(function (r) { return r.fails.length === fewest; })
        .sort(function (x, y) { return ((y.pct || 0) - (x.pct || 0)) || (y.pts - x.pts); }).slice(0, 3 - pass.length);
    }
    return { picks: picks, all: pass, near: near };
  }

  var API = { questions: questions, score: score, hardFails: hardFails, rank: rank, shortlist: shortlist, seatsOf: seatsOf, sizeOf: sizeOf, W: W, BUDGET: BUDGET, THREE_ROW: THREE_ROW };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }
  root.CAFinder = API;

  /* =======================================================================
     Browser part
     ======================================================================= */
  var doc = root.document;
  if (!doc || typeof CARS === "undefined") return;
  var CHOICE_KEY = "ca_finder_choice", STATE_KEY = "ca_finder_state";
  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* blocked: fine */ } }
  function ssGet(k) { try { return JSON.parse(root.sessionStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function ssSet(k, v) { try { if (v == null) root.sessionStorage.removeItem(k); else root.sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* blocked: fine */ } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function track(name, props) { if (root.CA_TRACK) root.CA_TRACK(name, props); }
  var available = CARS.filter(function (c) { return c.status !== "SOLD"; });
  var ARROW = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  /* ---- stock page: offer the finder first, never force it ---- */
  if (doc.body.getAttribute("data-page") === "stock") {
    var head = doc.querySelector(".page-head .container");
    if (head) {
      var strip = doc.createElement("a");
      strip.className = "fd-strip"; strip.href = "finder.html"; strip.setAttribute("data-cta", "see_stock"); strip.setAttribute("data-at", "stock");
      strip.innerHTML = '<span>Not sure what fits?</span><b>Find my car in 2 minutes</b>' + ARROW;
      head.appendChild(strip);
    }
    var deep = root.location.search.length > 1 || root.location.hash.length > 1;
    if (!deep && !lsGet(CHOICE_KEY) && typeof doc.createElement("dialog").showModal === "function") {
      var dlg = doc.createElement("dialog");
      dlg.className = "fd-choice"; dlg.id = "finderChoice";
      dlg.setAttribute("aria-labelledby", "fdChoiceTitle"); dlg.setAttribute("data-lenis-prevent", "");
      dlg.innerHTML =
        '<div class="fd-choice-card">' +
          '<span class="eyebrow">' + available.length + ' cars on the floor</span>' +
          '<h2 id="fdChoiceTitle">Where would you like to start?</h2>' +
          '<p>Answer 18 quick taps and we shortlist the cars that fit you, with the reasons. Or browse everything.</p>' +
          '<div class="fd-choice-actions">' +
            '<a class="btn btn-primary btn-lg" href="finder.html" data-pick="finder" data-cta="see_stock" data-at="stock">Find my car in 2 minutes</a>' +
            '<button type="button" class="btn btn-outline btn-lg" data-pick="stock">See all cars</button>' +
          '</div>' +
          '<p class="fd-choice-note">We remember this choice on this device only. You can switch any time.</p>' +
        '</div>';
      doc.body.appendChild(dlg);
      dlg.addEventListener("click", function (e) {
        var p = e.target.closest && e.target.closest("[data-pick]");
        if (p) { lsSet(CHOICE_KEY, p.getAttribute("data-pick")); dlg.close(); return; }   // the finder link still navigates by itself
        if (e.target === dlg) { lsSet(CHOICE_KEY, "stock"); dlg.close(); }     // a tap on the backdrop = see all cars
      });
      dlg.addEventListener("cancel", function () { lsSet(CHOICE_KEY, "stock"); });  // Esc
      dlg.showModal();
      var first = dlg.querySelector(".btn-primary"); if (first) first.focus({ preventScroll: true });
    }
    return;
  }

  var app = doc.getElementById("finderApp");
  if (!app) return;
  var Q = questions(CARS), N = Q.length;
  var fmt = root.ClassicAuto, Cards = root.ClassicAutoCards, F = root.CAForms;
  var $ = function (id) { return doc.getElementById(id); };
  var stage = $("fdStage"), intro = $("fdIntro"), results = $("fdResults");
  var answers = {}, idx = 0, started = false;
  var reduce = doc.documentElement.classList.contains("reduce");

  $("fdTotal").textContent = available.length;
  [].forEach.call(doc.querySelectorAll("[data-fd-n]"), function (el) { el.textContent = N; });
  [].forEach.call(doc.querySelectorAll('a[href="stock.html"]'), function (a) { a.addEventListener("click", function () { lsSet(CHOICE_KEY, "stock"); }); });

  function save(done) { ssSet(STATE_KEY, { answers: answers, idx: idx, done: !!done }); }
  function show(which) {
    intro.hidden = which !== "intro"; stage.hidden = which !== "stage"; results.hidden = which !== "results";
    doc.body.classList.toggle("fd-in-stage", which === "stage");   // finder.css hides the phone's Message / Call bar while Back / Skip / Next need the space
  }
  function picked(q) { var v = answers[q.id]; return v == null ? [] : (Array.isArray(v) ? v : [v]); }
  function passCount() { return available.filter(function (c) { return !hardFails(c, answers).length; }).length; }

  function render(dir) {
    var q = Q[idx], cur = picked(q);
    $("fdCount").textContent = "Question " + (idx + 1) + " of " + N;
    $("fdBar").style.transform = "scaleX(" + (idx / N) + ")";
    $("fdTitle").textContent = q.title;
    var hint = q.hint || (q.multi ? "Pick as many as you like." : "");
    $("fdHint").textContent = hint; $("fdHint").hidden = !hint;
    $("fdMust").hidden = !q.must;
    var opts = $("fdOpts");
    opts.className = "fd-opts" + (q.opts.length > 6 ? " is-dense" : "");
    opts.setAttribute("aria-label", q.title);
    opts.innerHTML = q.opts.map(function (o) {
      return '<button type="button" class="fd-opt" data-v="' + esc(o[0]) + '" aria-pressed="' + (cur.indexOf(o[0]) !== -1) + '">' +
        '<span>' + esc(o[1]) + '</span>' + (o[2] ? '<small>' + esc(o[2]) + '</small>' : "") + '</button>';
    }).join("");
    $("fdBack").disabled = idx === 0;
    $("fdNext").textContent = idx === N - 1 ? "See my shortlist" : "Next";
    $("fdNext").hidden = !q.multi && !cur.length && idx !== N - 1;
    $("fdSkip").textContent = idx === N - 1 ? "Skip and see my shortlist" : "Skip";
    var n = passCount();
    $("fdLive").textContent = n + (n === 1 ? " car passes" : " cars pass") + " your must-haves so far";
    $("fdEarly").hidden = idx < 4;
    if (dir) {
      var box = $("fdQ");
      if (!reduce && box.animate) box.animate([{ opacity: 0, transform: "translateX(" + (dir * 20) + "px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
      $("fdTitle").focus({ preventScroll: true });
    }
  }
  function go(to) {
    var dir = to > idx ? 1 : -1;
    if (to >= N) return finish();
    idx = Math.max(0, to); save(false); render(dir);
    if (root.scrollY > 0) root.scrollTo(0, 0);   // the questions are the first thing on the page: each one starts at the top, counter clear of the header
  }

  $("fdOpts").addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".fd-opt"); if (!b) return;
    var q = Q[idx], v = b.getAttribute("data-v");
    if (!started) { started = true; track("form_start", { form: "quiz" }); }
    if (q.multi) {
      var cur = picked(q).slice();
      if (v === "any") cur = cur.indexOf("any") !== -1 ? [] : ["any"];
      else { cur = cur.filter(function (x) { return x !== "any"; }); var i = cur.indexOf(v); if (i === -1) cur.push(v); else cur.splice(i, 1); }
      if (cur.length) answers[q.id] = cur; else delete answers[q.id];
      [].forEach.call($("fdOpts").children, function (el) { el.setAttribute("aria-pressed", String(cur.indexOf(el.getAttribute("data-v")) !== -1)); });
      $("fdNext").hidden = false;
      var n = passCount(); $("fdLive").textContent = n + (n === 1 ? " car passes" : " cars pass") + " your must-haves so far";
      save(false);
    } else {
      answers[q.id] = v;
      [].forEach.call($("fdOpts").children, function (el) { el.setAttribute("aria-pressed", String(el === b)); });
      save(false);
      setTimeout(function () { go(idx + 1); }, reduce ? 0 : 180);
    }
  });
  $("fdNext").addEventListener("click", function () { go(idx + 1); });
  $("fdSkip").addEventListener("click", function () { delete answers[Q[idx].id]; go(idx + 1); });
  $("fdBack").addEventListener("click", function () { if (idx > 0) go(idx - 1); });
  $("fdEarlyBtn").addEventListener("click", finish);
  $("fdStart").addEventListener("click", function () { show("stage"); render(1); });
  $("fdRestart").addEventListener("click", function () { answers = {}; idx = 0; ssSet(STATE_KEY, null); show("stage"); render(1); root.scrollTo(0, 0); });
  $("fdEdit").addEventListener("click", function () { idx = 0; show("stage"); render(1); root.scrollTo(0, 0); });

  /* ---- results ---- */
  var lastPicks = [];
  function labelOf(q, v) { var o = q.opts.filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : v; }
  function summary() {
    return Q.map(function (q) { var v = picked(q); return v.length ? q.title.replace(/\?$/, "") + ": " + v.map(function (x) { return labelOf(q, x); }).join(", ") : ""; }).filter(Boolean);
  }
  function itemHTML(r, i, near) {
    var c = r.car, tick = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>', dash = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';
    var lines = (near ? r.fails.map(function (f) { return '<li class="is-fail">' + dash + 'Misses a must-have: ' + esc(f.charAt(0).toLowerCase() + f.slice(1)) + '</li>'; }) : [])
      .concat(r.why.slice(0, 5).map(function (w) { return '<li>' + tick + esc(w) + '</li>'; }))
      .concat(r.miss.slice(0, 2).map(function (w) { return '<li class="is-miss">' + dash + esc(w) + '</li>'; }))
      .concat(r.ask.slice(0, 2).map(function (w) { return '<li class="is-ask">' + dash + esc(w) + '</li>'; }));
    var href = root.CA.root("cars/" + encodeURIComponent(c.id) + "/");
    return '<li class="fd-item">' +
      '<div class="fd-item-head">' +
        '<p class="fd-fit">' + (r.pct == null ? '<b>Fits</b> your must-haves' : '<b class="tnum">' + r.pct + '%</b> fit') + (r.best ? '<span>Best fit</span>' : "") + '</p>' +
        '<h3>' + esc(c.year + " " + c.make + " " + c.model) + '</h3>' +
      '</div>' +
      '<ul class="fd-why">' + lines.join("") + '</ul>' +
      '<div class="fd-item-card">' + Cards.cardHTML(c, { showEmi: true }) + '</div>' +
      '<div class="fd-item-cta"><a class="btn btn-primary" href="' + href + '#carForm" data-cta="book_test_drive" data-at="quiz">Book a test drive</a>' +
        '<button type="button" class="btn btn-outline" data-ask="' + esc(c.id) + '" data-cta="message" data-at="quiz">Ask about this car</button></div>' +
      '</li>';
  }

  function finish() {
    save(true);
    var ranked = rank(CARS, answers), sl = shortlist(ranked);
    lastPicks = sl.picks;
    sl.picks.forEach(function (r) { r.best = false; });
    if (sl.picks[0] && sl.picks[0].pct != null && (!sl.picks[1] || sl.picks[0].pct > sl.picks[1].pct)) sl.picks[0].best = true;   // only a clear winner is called "Best fit"
    show("results");
    $("fdBar").style.transform = "scaleX(1)";
    var nPass = sl.all.length;
    $("fdResTitle").textContent = sl.picks.length ? (sl.picks.length === 1 ? "One car fits you" : "Your " + sl.picks.length + " best fits") : "Nothing passes all your must-haves";
    $("fdResLead").textContent = nPass
      ? nPass + " of " + available.length + " cars pass your must-haves. These score highest on everything else you told us."
      : "No car on the floor passes all your must-haves right now. The closest ones are below with what they miss, or tell us what you want and we'll look for it.";
    $("fdList").innerHTML = sl.picks.map(function (r, i) { return itemHTML(r, i, false); }).join("");
    $("fdNearWrap").hidden = !sl.near.length;
    $("fdNear").innerHTML = sl.near.map(function (r, i) { return itemHTML(r, i, true); }).join("");
    var rest = sl.all.slice(sl.picks.length);
    $("fdMore").hidden = !rest.length;
    $("fdMoreBtn").textContent = "See all " + nPass + " matches";
    $("fdMoreBtn").onclick = function () {
      $("fdList").insertAdjacentHTML("beforeend", rest.map(function (r, i) { return itemHTML(r, sl.picks.length + i, false); }).join(""));
      $("fdMore").hidden = true;
    };
    var sum = summary();
    $("fdAnswers").innerHTML = sum.length ? sum.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") : "<li>You skipped every question, so this is everything on the floor, newest first.</li>";
    fillCarSelect();
    if (root.CA_MOTION && root.CA_MOTION.glints) root.CA_MOTION.glints(results);
    root.scrollTo(0, 0);
    $("fdResTitle").focus({ preventScroll: true });
  }
  $("fdList").addEventListener("click", askClick); $("fdNear").addEventListener("click", askClick);
  function askClick(e) {
    var b = e.target.closest && e.target.closest("[data-ask]"); if (!b) return;
    $("fdCar").value = b.getAttribute("data-ask"); setMode("ask");
    $("fdTalk").scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    setTimeout(function () { $("fdName").focus({ preventScroll: true }); }, reduce ? 0 : 400);
  }

  /* ---- the "How we picked these" table: printed from W, so it can't drift ---- */
  var WNAME = { budget: "Budget fit", "for": "Who it's for", body: "Body type", gear: "Gearbox", use: "City or highway", daily: "Daily distance", parking: "Parking size", age: "Year", brand: "Brand", features: "Each must-have feature", colour: "Colour", owners: "Previous owners", kms: "Km on the clock" };
  $("fdWeights").innerHTML = Object.keys(W).map(function (k) { return "<li><span>" + WNAME[k] + "</span><b class=\"tnum\">" + W[k] + "</b></li>"; }).join("");
  $("fdSeatSrc").innerHTML = THREE_ROW.map(function (t) { return '<li>' + esc(t.make + " " + t.model + (t.variant_has ? " " + t.variant_has : "") + " (" + t.from + (t.to ? "-" + t.to : " on") + "): " + t.seats + " seats") + ' · <a href="' + esc(t.url) + '" target="_blank" rel="noopener">' + esc(t.src) + '</a>, read 15 Oct 2026</li>'; }).join("");

  /* ---- talk to us ---- */
  var call = root.CA.callCta(), msg = root.CA.messageCta();
  var talkBtns = $("fdTalkBtns");
  if (call) talkBtns.insertAdjacentHTML("beforeend", '<a class="btn btn-outline btn-lg" href="' + esc(call.href) + '" data-cta="call" data-at="quiz">Call ' + esc(root.CA_SITE.phone) + '</a>');
  talkBtns.insertAdjacentHTML("beforeend", '<a class="btn btn-outline btn-lg" href="' + esc(msg.href) + '" target="_blank" rel="noopener" data-cta="message" data-at="quiz">' + esc(msg.label) + '</a>');

  var form = $("fdForm"), mode = "td";
  form.querySelector("[data-extras]").innerHTML = F.extrasHTML("fd", { licence: true });
  var licField = form.querySelector("[data-licence]");
  function setMode(m) {
    mode = m;
    [].forEach.call(form.querySelectorAll("[data-mode]"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === m)); });
    licField.hidden = m !== "td";
    $("fdSend").textContent = m === "td" ? "Request a test drive" : "Send my question";
    $("fdSend").setAttribute("data-cta", m === "td" ? "book_test_drive" : "message");
    $("fdMsgField").hidden = m === "td";
  }
  form.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-mode]"); if (b) setMode(b.getAttribute("data-mode")); });
  function fillCarSelect() {
    var sel = $("fdCar"), keep = sel.value; sel.innerHTML = "";
    lastPicks.forEach(function (r) { var o = doc.createElement("option"); o.value = r.car.id; o.textContent = fmt.carFullLabel(r.car); sel.appendChild(o); });
    var none = doc.createElement("option"); none.value = ""; none.textContent = "Not sure yet: suggest one"; sel.appendChild(none);
    if (keep && sel.querySelector('option[value="' + keep + '"]')) sel.value = keep;
  }
  var rules = { fdName: F.req("Enter your name."), fdPhone: F.phone };
  F.watch(form, rules);
  form.addEventListener("focusin", function () { if (!form.__fs) { form.__fs = true; track("form_start", { form: mode === "td" ? "test_drive" : "enquiry" }); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var status = $("fdStatus");
    var r2 = Object.assign({}, rules);
    if (mode === "td") r2.fdLicence = function (el) { return el.checked ? true : "Please confirm this to request a test drive."; };
    if (!F.validateAll(form, r2)) { F.status(status, "Check the highlighted fields and try again.", "error"); return; }
    var car = CARS.filter(function (c) { return c.id === $("fdCar").value; })[0] || null;
    var fit = null; if (car) { var sc = score(car, answers); fit = sc.pct; }
    var parts = [["Source", "Car finder"]];
    if (car) parts.push(["Interested in", fmt.carLeadLabel(car)]);
    if (fit != null) parts.push(["Fit", fit + "%"]);
    if (answers.pay) parts.push(["Pay", labelOf(Q.filter(function (q) { return q.id === "pay"; })[0], answers.pay)]);
    if (answers.exchange === "yes") parts.push(["Exchange", "yes"]);
    if (answers.when) parts.push(["Buying", labelOf(Q.filter(function (q) { return q.id === "when"; })[0], answers.when)]);
    var note = mode === "ask" ? $("fdMsg").value.trim() : "";
    var text = (note ? "Question: " + note + "\n" : "") + "Finder answers: " + (summary().join("; ") || "none") +
      (lastPicks.length ? "\nShortlist: " + lastPicks.map(function (r) { return r.car.id + (r.pct != null ? " (" + r.pct + "%)" : ""); }).join(", ") : "");
    var message = root.CA.buildMessage({ intent: mode === "td" ? "TEST DRIVE" : "ENQUIRY", parts: parts, licence: mode === "td" ? $("fdLicence").checked : null, marketing: $("fdMarketing").checked, text: text });
    var b = BUDGET[answers.budget];
    F.send(form, status, {
      name: $("fdName").value.trim(), phone: $("fdPhone").value.trim(),
      car: car ? fmt.carLeadLabel(car) : "Car finder: not sure yet",
      message: message, budget: car && car.price ? car.price : (b && isFinite(b[1]) ? b[1] * LAKH : ""), visit_at: "", page: "finder.html"
    }, mode === "td" ? "Sent. We'll message you to fix a time." : "Sent. We'll message you back.").then(function (r) { if (r && r.ok) { form.reset(); form.__fs = false; setMode(mode); } });
  });
  setMode("td");

  /* ---- start: restore this tab's answers (Back from a car page lands on the shortlist) ---- */
  var st = ssGet(STATE_KEY);
  if (st && st.answers) { answers = st.answers; idx = Math.min(st.idx || 0, N - 1); }
  if (st && st.done) finish();
  else if (st && Object.keys(answers).length) { show("stage"); render(0); }
  else show("intro");
})(typeof window !== "undefined" ? window : this);
