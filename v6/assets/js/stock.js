/* Stock page: client-side filter + sort over window.CARS. Deep links:
   stock.html?band=u20|20to50|50plus &body= &fuel= &make= &trans= */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAutoCards) return;

  var grid = document.getElementById("stockGrid");
  var empty = document.getElementById("stockEmpty");
  var countEl = document.getElementById("filterCount");
  var sel = {
    band: document.getElementById("filterBand"), body: document.getElementById("filterBody"), make: document.getElementById("filterMake"),
    fuel: document.getElementById("filterFuel"), trans: document.getElementById("filterTrans"), sort: document.getElementById("filterSort")
  };
  var resetBtn = document.getElementById("filterReset");
  var tgElectric = document.getElementById("toggleElectric"), tgDemo = document.getElementById("toggleDemo");
  var demoOnly = false;
  var MOTION = function () { return window.CA_MOTION; };

  // Make options come from the stock itself.
  var makes = {};
  CARS.forEach(function (c) { makes[c.make] = true; });
  Object.keys(makes).sort().forEach(function (m) { var o = document.createElement("option"); o.value = m; o.textContent = m; sel.make.appendChild(o); });

  // v5 links used ?budget=; map the old values onto the new bands.
  var LEGACY = { under10: "u20", "10to20": "u20", "20to30": "20to50", over30: "20to50" };

  function apply(track) {
    var v = {}; Object.keys(sel).forEach(function (k) { v[k] = sel[k].value; });
    var list = CARS.filter(function (c) {
      if (v.band !== "all" && c.band !== v.band) return false;
      if (v.body !== "all" && c.body !== v.body) return false;
      if (v.make !== "all" && c.make !== v.make) return false;
      if (v.fuel !== "all" && c.fuel !== v.fuel) return false;
      if (v.trans !== "all" && c.trans !== v.trans) return false;
      if (demoOnly && !c.ex_demo) return false;
      return true;
    });
    var sold = function (c) { return c.status === "SOLD" ? 1 : 0; };
    if (v.sort === "price-asc") list.sort(function (a, b) { return (a.price || 0) - (b.price || 0); });
    else if (v.sort === "price-desc") list.sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
    else if (v.sort === "year-desc") list.sort(function (a, b) { return b.year - a.year; });
    else list.sort(function (a, b) { return sold(a) - sold(b) || (b.price || 0) - (a.price || 0); });

    grid.removeAttribute("data-pending");
    grid.innerHTML = list.map(function (c) { return window.ClassicAutoCards.cardHTML(c); }).join("");
    // the URL mirrors the filters, so a filtered view can be shared or reloaded
    var u = new URLSearchParams();
    ["band", "body", "make", "fuel", "trans"].forEach(function (k) { if (v[k] !== "all") u.set(k, v[k]); });
    if (v.sort !== "featured") u.set("sort", v.sort);
    if (demoOnly) u.set("demo", "1");
    try { history.replaceState(null, "", window.location.pathname + (u.toString() ? "?" + u.toString() : "")); } catch (e) { /* file:// or sandbox */ }
    countEl.textContent = list.length + " of " + CARS.length + " cars";
    empty.style.display = list.length ? "none" : "block";
    tgElectric.setAttribute("aria-pressed", String(sel.fuel.value === "Electric"));
    tgDemo.setAttribute("aria-pressed", String(demoOnly));
    if (!list.length) emptyState(v);
    if (MOTION() && MOTION().revealGrid) MOTION().revealGrid(grid); else if (MOTION() && MOTION().glints) MOTION().glints(grid);
    if (track && window.CA_TRACK) window.CA_TRACK("filter_used", track);
  }

  function emptyState(v) {
    var what = [];
    if (sel.fuel.value === "Electric") what.push("electric");
    if (demoOnly) what.push("ex-demo");
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
    ["band", "body", "make", "fuel", "trans"].forEach(function (k) { sel[k].value = "all"; });
    sel.sort.value = "featured"; demoOnly = false;
    apply();
  }
  tgElectric.addEventListener("click", function () {
    sel.fuel.value = sel.fuel.value === "Electric" ? "all" : "Electric";
    apply({ f: "fuel", v: sel.fuel.value });
  });
  tgDemo.addEventListener("click", function () { demoOnly = !demoOnly; apply({ f: "segment", v: demoOnly ? "ex-demo" : "all" }); });
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
  apply();
})();
