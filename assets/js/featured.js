/* Home page — featured cars grid. Content-rendering: runs immediately. */
(function () {
  "use strict";
  var FEATURED_IDS = ["hyundai-creta-2021", "toyota-fortuner-2021", "honda-city-2020", "bmw-3-series-2019", "mahindra-xuv700-2023", "mercedes-c-class-2020"];
  var grid = document.getElementById("featuredGrid");
  if (!grid || typeof CARS === "undefined" || !window.ClassicAutoCards) return;
  var html = FEATURED_IDS.map(function (id) {
    var c = CARS.filter(function (x) { return x.id === id; })[0];
    return c ? window.ClassicAutoCards.cardHTML(c) : "";
  }).join("");
  grid.innerHTML = html;
})();
