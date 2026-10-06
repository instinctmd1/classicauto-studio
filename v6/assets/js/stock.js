/* Stock page: client-side filter + sort over window.CARS. Deep links:
   stock.html?band=u20|20to50|50plus &body= &fuel= &make= &trans= &sort= &maxkm=10000 &demo=1
   Every option shows how many cars it would give with the other filters as they are (live counts, gap plan P0-2), so nobody
   walks into an empty list blind. Zero options stay selectable: the empty state is a "request this car" form. */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAutoCards) return;

  var PAGE = 24, MORE = 12;          // pagination only appears once stock passes 24 cars (gap plan P2-5)
  var LOW_KM = 10000;
  var grid = document.getElementById("stockGrid");
  var empty = document.getElementById("stockEmpty");
  var countEl = document.getElementById("filterCount");
  var moreWrap = document.getElementById("stockMore"), moreBtn = document.getElementById("stockMoreBtn");
  var sel = {
    band: document.getElementById("filterBand"), body: document.getElementById("filterBody"), make: document.getElementById("filterMake"),
    fuel: document.getElementById("filterFuel"), trans: document.getElementById("filterTrans"), sort: document.getElementById("filterSort")
  };
  var FILTERS = ["band", "body", "make", "fuel", "trans"];
  var resetBtn = document.getElementById("filterReset");
  var tgElectric = document.getElementById("toggleElectric"), tgDemo = document.getElementById("toggleDemo"), tgLowKm = document.getElementById("toggleLowKm");
  var demoOnly = false, lowKm = false, shown = PAGE;
  var MOTION = function () { return window.CA_MOTION; };

  // Make options come from the stock itself.
  var makes = {};
  CARS.forEach(function (c) { makes[c.make] = true; });
  Object.keys(makes).sort().forEach(function (m) { var o = document.createElement("option"); o.value = m; o.textContent = m; sel.make.appendChild(o); });
  // each option keeps its own words; the count is added after them
  Object.keys(sel).forEach(function (k) { [].forEach.call(sel[k].options, function (o) { o.setAttribute("data-label", o.textContent); }); });

  // v5 links used ?budget=; map the old values onto the new bands.
  var LEGACY = { under10: "u20", "10to20": "u20", "20to30": "20to50", over30: "20to50" };

  function values() { var v = {}; Object.keys(sel).forEach(function (k) { v[k] = sel[k].value; }); return v; }
  /* does car c pass every filter except `skip` (and the quick toggles unless skipped too)? */
  function passes(c, v, skip) {
    for (var i = 0; i < FILTERS.length; i++) {
      var k = FILTERS[i]; if (k === skip || v[k] === "all") continue;
      if (c[k] !== v[k]) return false;
    }
    if (skip !== "demo" && demoOnly && !c.ex_demo) return false;
    if (skip !== "lowkm" && lowKm && !(c.kms != null && c.kms < LOW_KM)) return false;
    return true;
  }

  function updateCounts(v) {
    FILTERS.forEach(function (k) {
      var pool = CARS.filter(function (c) { return passes(c, v, k); });
      [].forEach.call(sel[k].options, function (o) {
        if (o.value === "all") return;            // "Any ..." needs no number: "7 of 7 cars" beside the filters says it
        var n = pool.filter(function (c) { return c[k] === o.value; }).length;
        o.textContent = o.getAttribute("data-label") + " (" + n + ")";
      });
    });
    // quick toggles: hidden while no car in stock at all has that property, otherwise they show their live count
    var elec = CARS.filter(function (c) { return c.fuel === "Electric"; }).length;
    var demo = CARS.filter(function (c) { return c.ex_demo; }).length;
    var low = CARS.filter(function (c) { return c.kms != null && c.kms < LOW_KM; }).length;
    tgElectric.hidden = !elec && sel.fuel.value !== "Electric";
    tgDemo.hidden = !demo && !demoOnly;
    tgLowKm.hidden = !low && !lowKm;
    tgElectric.querySelector("b").textContent = CARS.filter(function (c) { return c.fuel === "Electric" && passes(c, v, "fuel"); }).length;
    tgDemo.querySelector("b").textContent = CARS.filter(function (c) { return c.ex_demo && passes(c, v, "demo"); }).length;
    tgLowKm.querySelector("b").textContent = CARS.filter(function (c) { return c.kms != null && c.kms < LOW_KM && passes(c, v, "lowkm"); }).length;
  }

  function apply(track, keepPage) {
    var v = values();
    if (!keepPage) shown = PAGE;
    var list = CARS.filter(function (c) { return passes(c, v, null); });
    var sold = function (c) { return c.status === "SOLD" ? 1 : 0; };
    if (v.sort === "price-asc") list.sort(function (a, b) { return (a.price || 0) - (b.price || 0); });
    else if (v.sort === "price-desc") list.sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
    else if (v.sort === "year-desc") list.sort(function (a, b) { return b.year - a.year; });
    else if (v.sort === "km-asc") list.sort(function (a, b) { return (a.kms == null ? Infinity : a.kms) - (b.kms == null ? Infinity : b.kms); });
    else list.sort(function (a, b) { return sold(a) - sold(b) || (b.price || 0) - (a.price || 0); });

    grid.removeAttribute("data-pending");
    var page = list.slice(0, shown);
    grid.innerHTML = page.map(function (c) { return window.ClassicAutoCards.cardHTML(c); }).join("");
    var left = list.length - page.length;
    moreWrap.hidden = left <= 0;
    if (left > 0) moreBtn.textContent = "Show " + Math.min(MORE, left) + " more (" + left + " left)";
    // the URL mirrors the filters, so a filtered view can be shared or reloaded
    var u = new URLSearchParams();
    FILTERS.forEach(function (k) { if (v[k] !== "all") u.set(k, v[k]); });
    if (v.sort !== "featured") u.set("sort", v.sort);
    if (demoOnly) u.set("demo", "1");
    if (lowKm) u.set("maxkm", String(LOW_KM));
    try { history.replaceState(null, "", window.location.pathname + (u.toString() ? "?" + u.toString() : "")); } catch (e) { /* file:// or sandbox */ }
    countEl.textContent = list.length + " of " + CARS.length + " cars";
    empty.style.display = list.length ? "none" : "block";
    tgElectric.setAttribute("aria-pressed", String(sel.fuel.value === "Electric"));
    tgDemo.setAttribute("aria-pressed", String(demoOnly));
    tgLowKm.setAttribute("aria-pressed", String(lowKm));
    updateCounts(v);
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
    if (v.body !== "all") q.set("body", v.body);
    if (v.fuel !== "all") q.set("fuel", v.fuel);
    if (v.trans !== "all") q.set("trans", v.trans);
    if (demoOnly) q.set("demo", "1");
    var band = { u20: 20, "20to50": 50, "50plus": 150 }[v.band]; if (band) q.set("budget", String(band));
    document.getElementById("emptyRequest").href = "request.html" + (q.toString() ? "?" + q.toString() : "");
    document.getElementById("emptyTitle").textContent = what.length ? "No " + what.join(" or ") + " cars on the floor right now" : "No cars match those filters";
    document.getElementById("emptyText").textContent = what.length
      ? "Tell us what you're after and we'll message you about it. Your filters carry over to the request."
      : "Widen the price band or clear the body type, or tell us what you're looking for and we'll message you about it.";
  }
  function resetAll() {
    FILTERS.forEach(function (k) { sel[k].value = "all"; });
    sel.sort.value = "featured"; demoOnly = false; lowKm = false;
    apply();
  }
  tgElectric.addEventListener("click", function () {
    sel.fuel.value = sel.fuel.value === "Electric" ? "all" : "Electric";
    apply({ f: "fuel", v: sel.fuel.value });
  });
  tgDemo.addEventListener("click", function () { demoOnly = !demoOnly; apply({ f: "segment", v: demoOnly ? "ex-demo" : "all" }); });
  tgLowKm.addEventListener("click", function () {
    lowKm = !lowKm;
    if (lowKm && sel.sort.value === "featured") sel.sort.value = "km-asc";
    apply();
  });
  moreBtn.addEventListener("click", function () {
    var first = shown;
    shown += MORE; apply(null, true);
    var next = grid.children[first];
    if (next) { var a = next.querySelector("a"); if (a) a.focus({ preventScroll: true }); }
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
  ["body", "make", "fuel", "trans", "sort"].forEach(function (k) { setIfOption(sel[k], q.get(k)); });
  if (q.get("demo") === "1") demoOnly = true;
  if (+q.get("maxkm") === LOW_KM) lowKm = true;
  apply();
})();
