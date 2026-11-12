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
  var list = avail.slice().sort(function (a, b) { return (b.price || 0) - (a.price || 0); }).slice(0, 6);
  grid.innerHTML = list.map(function (c) { return window.ClassicAutoCards.cardHTML(c); }).join("");
  if (window.CA_MOTION && window.CA_MOTION.revealGrid) window.CA_MOTION.revealGrid(grid);
})();
