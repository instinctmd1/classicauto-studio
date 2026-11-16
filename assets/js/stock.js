/* Stock page: client-side filter + sort over window.CARS. The whole stock is shown at once (no "show more": photos load natively lazy).
   Deep links:
   stock.html?brand=bmw (or &make=BMW) &band=u20|20to50|50plus &type=suv,luxury &fuel= &trans= &sort= &maxkm=10000 &demo=1
   &type is a body type (suv sedan hatchback muv coupe convertible), optionally with luxury and/or electric: ?type=suv,luxury is the luxury SUVs.
   The old &body=luxury-suv links still work. Brand, body type, range, budget, fuel and gearbox all combine.
   Every option shows how many cars it would give with the other filters as they are (live counts), so nobody walks into an empty list blind.
   Zero options stay selectable: the empty state is a "request this car" form. */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAutoCards || !window.ClassicAuto) return;
  var fmt = window.ClassicAuto;

  var LOW_KM = 10000, EAGER = 2;     // the first two cards load at once (the first is the page's LCP image); every other photo is natively lazy
  var grid = document.getElementById("stockGrid");
  var empty = document.getElementById("stockEmpty");
  var countEl = document.getElementById("filterCount");
  var sel = {
    band: document.getElementById("filterBand"), make: document.getElementById("filterMake"),
    fuel: document.getElementById("filterFuel"), trans: document.getElementById("filterTrans"), sort: document.getElementById("filterSort")
  };
  var FILTERS = ["band", "make", "fuel", "trans"];
  var typeStrip = document.getElementById("typeStrip");
  /* body type (one of the body types, or "all") and the Luxury range; Electric is the Fuel filter, so the two never disagree */
  var types = { body: "all", luxury: false };
  CARS.forEach(function (c) { c._t = fmt.carTypes(c); });

  /* Brand deep link: ?brand=land-rover is the Make filter. The address bar always shows brand=<slug> (never make=) so a shared link reads the same everywhere. */
  function slug(make) { return String(make).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  var strip = document.getElementById("brandStrip");
  function markBrand() {
    if (!strip) return;
    var cur = sel.make.value === "all" ? "" : slug(sel.make.value), on = null;
    [].forEach.call(strip.querySelectorAll(".brand-chip"), function (a) {
      var is = a.getAttribute("data-brand") === cur;
      if (is) { a.setAttribute("aria-current", "true"); on = a; } else a.removeAttribute("aria-current");
    });
    if (on && cur && strip.scrollWidth > strip.clientWidth) { try { strip.scrollTo({ left: on.offsetLeft - 16, behavior: "auto" }); } catch (e) { /* old browser */ } }
  }
  if (strip) strip.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".brand-chip");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    var b = a.getAttribute("data-brand"), make = "all";
    if (b) { [].forEach.call(sel.make.options, function (o) { if (o.value !== "all" && slug(o.value) === b) make = o.value; }); }
    sel.make.value = make;
    apply({ f: "make", v: make });
  });
  var resetBtn = document.getElementById("filterReset");
  var tgDemo = document.getElementById("toggleDemo"), tgLowKm = document.getElementById("toggleLowKm");
  var demoOnly = false, lowKm = false;
  var MOTION = function () { return window.CA_MOTION; };

  // Make options come from the stock itself.
  var makes = {};
  CARS.forEach(function (c) { makes[c.make] = true; });
  Object.keys(makes).sort().forEach(function (m) { var o = document.createElement("option"); o.value = m; o.textContent = m; sel.make.appendChild(o); });
  // each option keeps its own words; the count is added after them
  Object.keys(sel).forEach(function (k) { [].forEach.call(sel[k].options, function (o) { o.setAttribute("data-label", o.textContent); }); });

  /* ---- the body type strip: one tile per type, with a line drawing of its shape and a live count ---- */
  var S = 'viewBox="0 0 64 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var W = '<circle cx="17" cy="24" r="4.2"/><circle cx="47" cy="24" r="4.2"/>';
  var ICONS = {
    all: '<svg ' + S + '><rect x="9" y="6" width="18" height="8" rx="2"/><rect x="37" y="6" width="18" height="8" rx="2"/><rect x="9" y="19" width="18" height="8" rx="2"/><rect x="37" y="19" width="18" height="8" rx="2"/></svg>',
    suv: '<svg ' + S + '><path d="M5 24v-8l4-3 5-7h25l6 7 8 2.5c2 .6 3 1.6 3 3.5v5h-4M13 24H5M43 24H21"/>' + W + '<path d="M17 13h9V9h-6zM30 13V9h8l4 4z"/></svg>',
    sedan: '<svg ' + S + '><path d="M4 24v-5c0-1.8 1-3 3-3.6l10-2.6 8-5.8h14l9 6.2 7 1.6c1.5.4 2 1.4 2 3v6.2h-5M13 24H4M43 24H21"/>' + W + '<path d="M26 12.2h13l5 4"/></svg>',
    hatchback: '<svg ' + S + '><path d="M5 24v-6c0-1.8 1-3 3-3.4l8-1.8 7-6.8h16l6 8 7 2c1.4.5 2 1.4 2 3v5h-4M13 24H5M43 24H21"/>' + W + '<path d="M24 14.6V8.8M24 8.8h11l5 5.8"/></svg>',
    muv: '<svg ' + S + '><path d="M4 24V14c0-1.5.8-2.6 2.4-3L14 8.6 20 4h27c2 0 3.2 1 4 3l5 8 4 2c1.4.6 2 1.6 2 3v4h-4M13 24H4M43 24H21"/>' + W + '<path d="M22 12h9M36 12h9M25 12v-5"/></svg>',
    coupe: '<svg ' + S + '><path d="M4 24v-4c0-1.8 1-3 3-3.4l11-2.4 8-5h12.5c1.5 0 2.7.5 3.8 1.4l5 4.4 8 1.4c1.6.3 2.7 1.3 2.7 3V24h-4M13 24H4M43 24H21"/>' + W + '<path d="M27 12.6h11l5 3.4"/></svg>',
    convertible: '<svg ' + S + '><path d="M4 24v-5c0-1.8 1-3 3-3.4l12-2.6 7-5.4 3 5.4 14 1 7 1.6c1.5.4 2 1.4 2 3.4V24h-4M13 24H4M43 24H21"/>' + W + '<path d="M29 14h9"/></svg>',
    luxury: '<svg ' + S + '><path d="M32 4l6 8-6 16-6-16z"/><path d="M26 12h12M32 4v8M20 12l6-8M44 12l-6-8M20 12l12 16M44 12L32 28"/></svg>',
    electric: '<svg ' + S + '><path d="M36 3L18 18h10l-4 11 18-15H32z"/></svg>'
  };
  function typeTile(v, label) {
    var pic = v === "all" ? ICONS[v] : '<img class="type-ico-img" src="' + (window.CA && window.CA.root ? window.CA.root("assets/types/" + v + ".webp") : "assets/types/" + v + ".webp") + '" alt="" width="80" height="34" loading="lazy" decoding="async">';
    return '<button type="button" class="type-tile' + (v === "all" ? " type-tile--all" : "") + '" data-type="' + v + '" aria-pressed="false"><span class="type-ico">' + pic + '</span>' +
      '<span class="type-name">' + label + '</span><b class="type-count"></b></button>';
  }
  if (typeStrip) {
    typeStrip.innerHTML = typeTile("all", "All types") + fmt.TYPES.map(function (t) { return typeTile(t.v, t.label); }).join("");
    typeStrip.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".type-tile");
      if (!b) return;
      var v = b.getAttribute("data-type");
      if (v === "all") { types.body = "all"; types.luxury = false; if (sel.fuel.value === "Electric") sel.fuel.value = "all"; }
      else if (v === "luxury") types.luxury = !types.luxury;
      else if (v === "electric") sel.fuel.value = sel.fuel.value === "Electric" ? "all" : "Electric";
      else types.body = types.body === v ? "all" : v;
      apply({ f: "type", v: v });
    });
  }

  // v5 links used ?budget=; map the old values onto the new bands.
  var LEGACY = { under10: "u20", "10to20": "u20", "20to30": "20to50", over30: "20to50" };

  function values() { var v = {}; Object.keys(sel).forEach(function (k) { v[k] = sel[k].value; }); return v; }
  /* does car c pass every filter except those named in `skip`, a "|"-joined list of: band make fuel trans body luxury demo lowkm */
  function passes(c, v, skip) {
    var sk = "|" + (skip || "") + "|";
    for (var i = 0; i < FILTERS.length; i++) {
      var k = FILTERS[i]; if (sk.indexOf("|" + k + "|") > -1 || v[k] === "all") continue;
      if (c[k] !== v[k]) return false;
    }
    if (sk.indexOf("|body|") < 0 && types.body !== "all" && c._t.indexOf(types.body) < 0) return false;
    if (sk.indexOf("|luxury|") < 0 && types.luxury && c._t.indexOf("luxury") < 0) return false;
    if (sk.indexOf("|demo|") < 0 && demoOnly && !c.ex_demo) return false;
    if (sk.indexOf("|lowkm|") < 0 && lowKm && !(c.kms != null && c.kms < LOW_KM)) return false;
    return true;
  }
  function n(pool, test) { var k = 0; for (var i = 0; i < pool.length; i++) if (test(pool[i])) k++; return k; }

  function updateCounts(v) {
    FILTERS.forEach(function (k) {
      var pool = CARS.filter(function (c) { return passes(c, v, k); });
      [].forEach.call(sel[k].options, function (o) {
        if (o.value === "all") return;            // "Any ..." needs no number: "7 of 7 cars" beside the filters says it
        o.textContent = o.getAttribute("data-label") + " (" + n(pool, function (c) { return c[k] === o.value; }) + ")";
      });
    });
    // body type strip: each tile counts the cars it would give with every other filter as they are
    if (typeStrip) {
      var bodyPool = CARS.filter(function (c) { return passes(c, v, "body"); });
      var luxPool = CARS.filter(function (c) { return passes(c, v, "luxury"); });
      var fuelPool = CARS.filter(function (c) { return passes(c, v, "fuel"); });
      var allPool = CARS.filter(function (c) { return passes(c, v, "body|luxury" + (sel.fuel.value === "Electric" ? "|fuel" : "")); });
      [].forEach.call(typeStrip.querySelectorAll(".type-tile"), function (t) {
        var k = t.getAttribute("data-type"), count, on, total;
        if (k === "all") { count = allPool.length; on = types.body === "all" && !types.luxury && sel.fuel.value !== "Electric"; total = CARS.length; }
        else if (k === "luxury") { count = n(luxPool, function (c) { return c._t.indexOf("luxury") > -1; }); on = types.luxury; total = n(CARS, function (c) { return c._t.indexOf("luxury") > -1; }); }
        else if (k === "electric") { count = n(fuelPool, function (c) { return c.fuel === "Electric"; }); on = sel.fuel.value === "Electric"; total = n(CARS, function (c) { return c.fuel === "Electric"; }); }
        else { count = n(bodyPool, function (c) { return c._t.indexOf(k) > -1; }); on = types.body === k; total = n(CARS, function (c) { return c._t.indexOf(k) > -1; }); }
        t.querySelector(".type-count").textContent = count;
        t.hidden = !total && !on;                 // a type no car in stock has stays out of the way
        t.classList.toggle("is-zero", !count && !on);
        t.setAttribute("aria-pressed", String(!!on));
      });
    }
    // brand chips count with the other filters as they are, so Brand and Body type can be combined from either side
    if (strip) {
      var brandPool = CARS.filter(function (c) { return passes(c, v, "make"); });
      [].forEach.call(strip.querySelectorAll(".brand-chip[data-brand]"), function (a) {
        var b = a.getAttribute("data-brand"); if (!b) return;
        var k = n(brandPool, function (c) { return slug(c.make) === b; }), el = a.querySelector("b");
        if (el) el.textContent = k;
        a.classList.toggle("is-zero", !k && a.getAttribute("aria-current") !== "true");
      });
    }
    // quick toggles: hidden while no car in stock at all has that property, otherwise they show their live count
    var demo = CARS.filter(function (c) { return c.ex_demo; }).length;
    var low = CARS.filter(function (c) { return c.kms != null && c.kms < LOW_KM; }).length;
    tgDemo.hidden = !demo && !demoOnly;
    tgLowKm.hidden = !low && !lowKm;
    tgDemo.querySelector("b").textContent = CARS.filter(function (c) { return c.ex_demo && passes(c, v, "demo"); }).length;
    tgLowKm.querySelector("b").textContent = CARS.filter(function (c) { return c.kms != null && c.kms < LOW_KM && passes(c, v, "lowkm"); }).length;
  }

  function typeParam() {
    var t = [];
    if (types.body !== "all") t.push(types.body);
    if (types.luxury) t.push("luxury");
    if (sel.fuel.value === "Electric") t.push("electric");
    return t;
  }

  function apply(track) {
    var v = values();
    var list = CARS.filter(function (c) { return passes(c, v, null); });
    var sold = function (c) { return c.status === "SOLD" ? 1 : 0; };
    if (v.sort === "price-asc") list.sort(function (a, b) { return (a.price || 0) - (b.price || 0); });
    else if (v.sort === "price-desc") list.sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
    else if (v.sort === "year-desc") list.sort(function (a, b) { return b.year - a.year; });
    else if (v.sort === "km-asc") list.sort(function (a, b) { return (a.kms == null ? Infinity : a.kms) - (b.kms == null ? Infinity : b.kms); });
    else list.sort(function (a, b) { return sold(a) - sold(b) || (b.price || 0) - (a.price || 0); });

    grid.removeAttribute("data-pending");
    grid.innerHTML = list.map(function (c, i) { return window.ClassicAutoCards.cardHTML(c, { eager: i < EAGER ? (i === 0 ? 1 : 2) : 0 }); }).join("");
    window.ClassicAutoCards.fit(grid);
    // the URL mirrors the filters, so a filtered view can be shared or reloaded
    var u = new URLSearchParams();
    ["band", "fuel", "trans"].forEach(function (k) { if (v[k] !== "all" && !(k === "fuel" && v[k] === "Electric")) u.set(k, v[k]); });
    if (v.make !== "all") u.set("brand", slug(v.make));
    var tp = typeParam(); if (tp.length) u.set("type", tp.join(","));
    if (v.sort !== "featured") u.set("sort", v.sort);
    if (demoOnly) u.set("demo", "1");
    if (lowKm) u.set("maxkm", String(LOW_KM));
    try { history.replaceState(null, "", window.location.pathname + (u.toString() ? "?" + u.toString().replace(/%2C/g, ",") : "")); } catch (e) { /* file:// or sandbox */ }
    countEl.textContent = list.length + " of " + CARS.length + " cars";
    var sum = document.getElementById("filterSum"); if (sum) sum.textContent = countEl.textContent;
    empty.style.display = list.length ? "none" : "block";
    tgDemo.setAttribute("aria-pressed", String(demoOnly));
    tgLowKm.setAttribute("aria-pressed", String(lowKm));
    updateCounts(v);
    markBrand();
    if (!list.length) emptyState(v);
    if (MOTION() && MOTION().revealGrid) MOTION().revealGrid(grid); else if (MOTION() && MOTION().glints) MOTION().glints(grid);
    if (track && window.CA_TRACK) window.CA_TRACK("filter_used", track);
  }

  function emptyState(v) {
    var what = [];
    if (sel.fuel.value === "Electric") what.push("electric");
    if (demoOnly) what.push("ex-demo");
    if (sel.trans.value === "Manual") what.push("manual");
    var q = new URLSearchParams();
    if (v.make !== "all") q.set("make", v.make);
    /* the request form's body list is hatchback / sedan / suv / mpv / luxury sedan / luxury SUV: pass what it has */
    var b = types.body === "muv" ? "mpv" : types.body;
    if (types.luxury && (b === "suv" || b === "sedan")) b = "luxury-" + b;
    if (b !== "all" && ["hatchback", "sedan", "suv", "mpv", "luxury-sedan", "luxury-suv"].indexOf(b) > -1) q.set("body", b);
    if (v.fuel !== "all") q.set("fuel", v.fuel);
    if (v.trans !== "all") q.set("trans", v.trans);
    if (demoOnly) q.set("demo", "1");
    var band = { u20: 20, "20to50": 50, "50plus": 150 }[v.band]; if (band) q.set("budget", String(band));
    document.getElementById("emptyRequest").href = "request.html" + (q.toString() ? "?" + q.toString() : "");
    var onlyThat = what.length && v.make === "all" && v.band === "all" && types.body === "all" && !types.luxury && !lowKm;   // nothing else narrows the list
    document.getElementById("emptyTitle").textContent = onlyThat ? "No " + what.join(" or ") + " cars on the floor right now" : "No cars match those filters";
    document.getElementById("emptyText").textContent = onlyThat
      ? "Tell us what you're after and we'll message you about it. Your filters carry over to the request."
      : "Widen the budget or clear the body type, or tell us what you're looking for and we'll message you about it.";
  }
  function resetAll() {
    FILTERS.forEach(function (k) { sel[k].value = "all"; });
    sel.sort.value = "featured"; demoOnly = false; lowKm = false; types.body = "all"; types.luxury = false;
    apply();
  }
  tgDemo.addEventListener("click", function () { demoOnly = !demoOnly; apply({ f: "segment", v: demoOnly ? "ex-demo" : "all" }); });
  tgLowKm.addEventListener("click", function () {
    lowKm = !lowKm;
    if (lowKm && sel.sort.value === "featured") sel.sort.value = "km-asc";
    apply();
  });
  document.getElementById("emptyReset").addEventListener("click", resetAll);

  Object.keys(sel).forEach(function (k) {
    sel[k].addEventListener("change", function () { apply(k === "sort" ? null : { f: k, v: sel[k].value }); });
  });
  resetBtn.addEventListener("click", resetAll);

  var q = new URLSearchParams(window.location.search);
  var band = q.get("band") || LEGACY[q.get("budget")];
  /* A deep-link value is applied only when the select has that option: ?fuel=Foo must not blank the list. */
  function setIfOption(select, value) {
    if (!value) return;
    for (var i = 0; i < select.options.length; i++) if (select.options[i].value === value) { select.value = value; return; }
  }
  setIfOption(sel.band, band);
  ["make", "fuel", "trans", "sort"].forEach(function (k) { setIfOption(sel[k], q.get(k)); });
  if (q.get("brand") && sel.make.value === "all") [].forEach.call(sel.make.options, function (o) { if (o.value !== "all" && slug(o.value) === q.get("brand").toLowerCase()) sel.make.value = o.value; });
  var wanted = (q.get("type") || "").toLowerCase().split(",").concat(fmt.LEGACY_BODY[q.get("body")] || []);
  wanted.forEach(function (t) {
    if (t === "luxury") types.luxury = true;
    else if (t === "electric") setIfOption(sel.fuel, "Electric");
    else if (t && fmt.TYPES.some(function (x) { return x.v === t && x.group === "body"; })) types.body = t;
  });
  if (q.get("demo") === "1") demoOnly = true;
  if (+q.get("maxkm") === LOW_KM) lowKm = true;
  /* phones: the extra filters start folded, so the cars are near the top; wider screens always show them */
  var disc = document.getElementById("filterDisc");
  if (disc) { var mq = window.matchMedia("(max-width: 768px)"); var fold = function () { disc.open = !mq.matches; }; fold(); if (mq.addEventListener) mq.addEventListener("change", fold); }
  apply();
})();
