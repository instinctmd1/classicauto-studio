/* Home: "Model range". One tile per body type / range, each with a side view of one of OUR OWN cars (the car is cut out of its own listing
   photo by tools/make_side_cutouts.py; pixels untouched, only the background is gone). A tap goes to stock.html?type=<type>, which stock.js
   turns into the type filter. Counts are live (window.CARS), so a type with no car on the floor is simply not shown. */
(function () {
  "use strict";
  var grid = document.getElementById("typeGrid");
  if (!grid || typeof CARS === "undefined" || !window.ClassicAuto) return;
  var fmt = window.ClassicAuto;
  var avail = CARS.filter(function (c) { return c.status !== "SOLD"; });
  var root = function (u) { return window.CA && window.CA.root ? window.CA.root(u) : u; };

  /* which of our cars is on each tile: the file is assets/types/<type>.webp, the words are its alt text */
  var PIC = window.CA_TYPE_PICS || {
    suv: "2022 Hyundai Creta",
    sedan: "2015 Honda City",
    hatchback: "2026 Hyundai i20",
    muv: "2023 Kia Carens",
    coupe: "2019 Mercedes-Benz CLA",
    convertible: "2017 Mini Convertible",
    luxury: "2024 Range Rover Velar",
    electric: "2026 Tesla Model Y"
  };
  var ARROW = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  var html = fmt.TYPES.map(function (t, i) {
    var n = avail.filter(function (c) { return fmt.carTypes(c).indexOf(t.v) > -1; }).length;
    if (!n) return "";
    return '<li data-reveal-item><a class="type-card" href="stock.html?type=' + t.v + '" data-cta="see_stock" data-at="model_range" data-type="' + t.v + '">' +
      '<span class="type-card-top"><span class="type-card-name">' + t.label + '</span><span class="type-card-count tnum">' + n + (n === 1 ? " car" : " cars") + '</span></span>' +
      '<span class="type-card-go" aria-hidden="true">' + ARROW + '</span>' +
      '<span class="type-card-stage"><img class="type-card-img" src="' + root("assets/types/" + t.v + ".webp") + '" alt="Side view of a ' + PIC[t.v] + ', one of our ' + t.label.toLowerCase() +
      ' cars" width="720" height="280" loading="lazy" decoding="async"></span></a></li>';
  }).join("");
  if (html) grid.innerHTML = html;
  grid.classList.add("is-ready");
  if (window.CA_MOTION && window.CA_MOTION.gsap && !window.CA_MOTION.reduced) {
    var g = window.CA_MOTION.gsap, items = grid.querySelectorAll("li");
    g.fromTo(items, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out", stagger: 0.05, clearProps: "transform",
      scrollTrigger: { trigger: grid, start: "top 88%", once: true } });
  }
})();
