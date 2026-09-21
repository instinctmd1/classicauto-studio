/* Stock page — client-side filter + sort over window.CARS. */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAutoCards) return;

  var grid = document.getElementById("stockGrid");
  var emptyState = document.getElementById("stockEmpty");
  var countEl = document.getElementById("filterCount");
  var budgetSel = document.getElementById("filterBudget");
  var bodySel = document.getElementById("filterBody");
  var fuelSel = document.getElementById("filterFuel");
  var transSel = document.getElementById("filterTrans");
  var sortSel = document.getElementById("filterSort");
  var resetBtn = document.getElementById("filterReset");

  function inBudget(c, band) {
    var lakh = c.price / 100000;
    if (band === "under10") return lakh < 10;
    if (band === "10to20") return lakh >= 10 && lakh <= 20;
    if (band === "20to30") return lakh > 20 && lakh <= 30;
    if (band === "over30") return lakh > 30;
    return true;
  }

  function apply() {
    var budget = budgetSel.value, body = bodySel.value, fuel = fuelSel.value, trans = transSel.value, sort = sortSel.value;

    var list = CARS.filter(function (c) {
      if (budget !== "all" && !inBudget(c, budget)) return false;
      if (body !== "all" && c.body !== body) return false;
      if (fuel !== "all" && c.fuel !== fuel) return false;
      if (trans !== "all" && c.trans !== trans) return false;
      return true;
    });

    // Featured/default order: available cars first, then SOLD.
    if (sort === "price-asc") list.sort(function (a, b) { return a.price - b.price; });
    else if (sort === "price-desc") list.sort(function (a, b) { return b.price - a.price; });
    else if (sort === "year-desc") list.sort(function (a, b) { return b.year - a.year; });
    else list.sort(function (a, b) { return (a.status === "SOLD" ? 1 : 0) - (b.status === "SOLD" ? 1 : 0); });

    grid.innerHTML = list.map(function (c) { return window.ClassicAutoCards.cardHTML(c); }).join("");
    countEl.textContent = list.length + " of " + CARS.length + " cars";
    emptyState.style.display = list.length ? "none" : "block";

    if (window.gsap && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      var items = grid.querySelectorAll(".stagger-item");
      window.gsap.set(items, { y: 24, opacity: 0, scale: 0.97 });
      window.gsap.to(items, { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.06, ease: "back.out(1.4)" });
    }
  }

  [budgetSel, bodySel, fuelSel, transSel, sortSel].forEach(function (el) { el.addEventListener("change", apply); });
  resetBtn.addEventListener("click", function () {
    budgetSel.value = "all"; bodySel.value = "all"; fuelSel.value = "all"; transSel.value = "all"; sortSel.value = "featured";
    apply();
  });

  // Deep link support: stock.html?body=suv or ?budget=under10 from Anita chat.
  var params = new URLSearchParams(window.location.search);
  if (params.get("body")) bodySel.value = params.get("body");
  if (params.get("budget")) budgetSel.value = params.get("budget");

  apply();
})();
