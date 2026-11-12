/* Home page: featured grid (top six by price) + the price range line. */
(function () {
  "use strict";
  var grid = document.getElementById("featuredGrid");
  if (!grid || typeof CARS === "undefined" || !window.ClassicAutoCards) return;
  var fmt = window.ClassicAuto;
  var avail = CARS.filter(function (c) { return c.status !== "SOLD"; });
  var priced = avail.filter(function (c) { return c.price != null; });
  if (priced.length) {
    var min = Math.min.apply(null, priced.map(function (c) { return c.price; }));
    var max = Math.max.apply(null, priced.map(function (c) { return c.price; }));
    var f = document.getElementById("priceFrom"), t = document.getElementById("priceTo");
    if (f) f.textContent = fmt.money(min);
    if (t) t.textContent = fmt.money(max);
  }
  /* quick picks under the search bar, each with its live count; a pick with no car is not shown */
  var quick = document.getElementById("quickLinks");
  if (quick) {
    var picks = [
      ["Under ₹20 L", "band=u20", function (c) { return c.band === "u20"; }],
      ["SUVs", "body=suv", function (c) { return c.body === "suv"; }],
      ["Under 10,000 km", "maxkm=10000&sort=km-asc", function (c) { return c.kms != null && c.kms < 10000; }],
      ["Diesel", "fuel=Diesel", function (c) { return c.fuel === "Diesel"; }],
      ["Petrol", "fuel=Petrol", function (c) { return c.fuel === "Petrol"; }]
    ];
    quick.innerHTML = '<span class="quick-label">Quick picks</span>' + picks.map(function (p) {
      var n = avail.filter(p[2]).length;
      return n ? '<a class="toggle-chip" href="stock.html?' + p[1] + '">' + p[0] + ' <b class="toggle-count">' + n + '</b></a>' : "";
    }).join("");
  }
  var list = avail.slice().sort(function (a, b) { return (b.price || 0) - (a.price || 0); }).slice(0, 6);
  grid.innerHTML = list.map(function (c) { return window.ClassicAutoCards.cardHTML(c); }).join("");
  if (window.CA_MOTION && window.CA_MOTION.revealGrid) window.CA_MOTION.revealGrid(grid);
})();
