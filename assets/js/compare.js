/* Compare page — reads up to 3 ids from localStorage (ca_compare_v1, via
   compare-shortlist.js) and renders a spec-comparison table. */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAuto) return;
  var fmt = window.ClassicAuto;

  function render() {
    var ids = window.ClassicAutoCompare ? window.ClassicAutoCompare.getCompareIds() : [];
    var cars = ids.map(function (id) { return CARS.filter(function (c) { return c.id === id; })[0]; }).filter(Boolean);

    var emptyEl = document.getElementById("compareEmpty");
    var tableWrap = document.getElementById("compareTableWrap");

    if (!cars.length) {
      emptyEl.style.display = "block";
      tableWrap.style.display = "none";
      return;
    }
    emptyEl.style.display = "none";
    tableWrap.style.display = "block";

    var rows = [
      ["Price", function (c) { return '<strong class="cmp-price">' + fmt.money(c.price) + '</strong>'; }],
      ["EMI from", function (c) { return fmt.rupees(fmt.emi(c.price)) + "/mo*"; }],
      ["Year", function (c) { return c.year; }],
      ["KM driven", function (c) { return fmt.formatKm(c.kms); }],
      ["Fuel", function (c) { return c.fuel; }],
      ["Transmission", function (c) { return c.trans; }],
      ["Owners", function (c) { return c.owners; }],
      ["Colour", function (c) { return c.colour; }],
      ["Body type", function (c) { return window.ClassicAutoCards.bodyLabel(c.body); }],
      ["Registered", function (c) { return c.reg_city; }],
      ["Insurance", function (c) { return c.insurance; }],
      ["Status", function (c) { return c.status === "SOLD" ? "Sold" : "Available"; }]
    ];

    var head = '<div class="cmp-row cmp-head"><div class="cmp-label"></div>' + cars.map(function (c) {
      var img = c.photos && c.photos.length ? c.photos[0] : (window.CA_STUDIO_PREVIEWS && window.CA_STUDIO_PREVIEWS[c.id] ? window.CA_STUDIO_PREVIEWS[c.id][0] : "");
      return '<div class="cmp-col">' +
        (img ? '<img src="' + img + '" alt="' + fmt.carLabel(c) + '">' : '<div class="cmp-noimg">' + c.make + " " + c.model + '</div>') +
        '<h3>' + c.make + " " + c.model + '</h3>' +
        '<a class="btn btn-outline" href="car.html?id=' + encodeURIComponent(c.id) + '" style="margin-top:0.5rem;">View</a>' +
        '<button type="button" class="btn-ghost cmp-remove" data-remove="' + c.id + '">Remove</button>' +
        '</div>';
    }).join("") + "</div>";

    var body = rows.map(function (r) {
      return '<div class="cmp-row"><div class="cmp-label">' + r[0] + '</div>' +
        cars.map(function (c) { return '<div class="cmp-col cmp-val">' + r[1](c) + '</div>'; }).join("") +
        '</div>';
    }).join("");

    tableWrap.innerHTML = head + body;
    tableWrap.style.setProperty("--cmp-cols", String(cars.length));

    tableWrap.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.ClassicAutoCompare.removeCompare(btn.getAttribute("data-remove"));
        render();
      });
    });
  }

  render();
})();
