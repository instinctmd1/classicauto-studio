/* Compare page: reads up to 3 ids from localStorage (ca_compare_v1, via
   compare-shortlist.js) and renders a spec-comparison table. */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAuto) return;
  var fmt = window.ClassicAuto, esc = window.ClassicAutoCards.esc;

  function price(c) { return c.price_on_request || c.price == null ? "Ask for price" : fmt.money(c.price); }

  function render() {
    var ids = window.ClassicAutoCompare ? window.ClassicAutoCompare.getCompareIds() : [];
    var cars = ids.map(function (id) { return CARS.filter(function (c) { return c.id === id; })[0]; }).filter(Boolean);
    var emptyEl = document.getElementById("compareEmpty");
    var wrap = document.getElementById("compareTableWrap");
    if (!cars.length) { emptyEl.style.display = "block"; wrap.style.display = "none"; return; }
    emptyEl.style.display = "none"; wrap.style.display = "block";

    var rows = [
      ["Price", function (c) { return '<strong class="cmp-price">' + price(c) + '</strong>'; }],
      ["EMI from", function (c) { return c.price ? fmt.rupees(fmt.emi(c.price)) + "/mo*" : "-"; }],
      ["Year", function (c) { return esc(c.year); }],
      ["Registered", function (c) { return esc(c.reg_month + (c.rto ? " (" + c.rto + ")" : "")); }],
      ["Driven", function (c) { return fmt.formatKm(c.kms); }],
      ["Use", function (c) { var r = fmt.kmRate(c); return r ? r.text : "-"; }],
      ["Fuel", function (c) { return esc(c.fuel); }],
      ["Gearbox", function (c) { return esc(c.trans + " (" + fmt.transShort(c) + ")"); }],
      ["Owner", function (c) { return esc(c.owners); }],
      ["Colour", function (c) { return esc(c.colour); }],
      ["Body type", function (c) { return fmt.bodyLabel(c.body); }],
      ["Insurance", function (c) { return fmt.insurance(c).text; }],
      ["Status", function (c) { return c.status === "SOLD" ? "Sold" : "Available"; }]
    ];
    // the new-car comparison only when one of these cars has the maker's own figure (see main.js newPrice and the car page)
    if (cars.some(function (c) { return fmt.newPrice(c); })) {
      rows.splice(2, 0,
        ["New: approx. ex-showroom", function (c) { var n = fmt.newPrice(c); return n ? fmt.money(n.price) + '<br><small class="cmp-src">' + esc(n.source) + ", " + n.asOfText + "</small>" : "-"; }],
        ["You save approx.", function (c) { var n = fmt.newPrice(c); return n ? '<span class="cmp-save">' + fmt.money(n.save) + "</span>" : "-"; }]);
    }

    var head = '<div class="cmp-row cmp-head"><div class="cmp-label"></div>' + cars.map(function (c) {
      var img = c.photos && c.photos.length ? c.photos[0] : "";
      return '<div class="cmp-col">' +
        (img ? '<img src="' + esc(img) + '" alt="' + esc(fmt.carLabel(c)) + '" width="1110" height="700" loading="lazy">' : '<div class="cmp-noimg">' + esc(c.make) + " " + esc(c.model) + '</div>') +
        '<h3>' + esc(c.make) + " " + esc(c.model) + '</h3>' +
        '<a class="btn btn-outline" href="cars/' + encodeURIComponent(c.id) + '/" style="margin-top:8px;">View</a><br>' +
        '<button type="button" class="cmp-remove" data-remove="' + esc(c.id) + '">Remove</button></div>';
    }).join("") + "</div>";

    var body = rows.map(function (r) {
      return '<div class="cmp-row"><div class="cmp-label">' + r[0] + '</div>' +
        cars.map(function (c) { return '<div class="cmp-col cmp-val">' + r[1](c) + '</div>'; }).join("") + '</div>';
    }).join("");

    wrap.innerHTML = head + body;
    wrap.style.setProperty("--cmp-cols", String(cars.length));
    wrap.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () { window.ClassicAutoCompare.removeCompare(btn.getAttribute("data-remove")); render(); });
    });
  }
  render();
})();
