/* Shop by brand (home grid) and the brand strip on stock.html. Only makes with at least one car on the floor are listed, each with its live
   count, built from window.CARS, so a make appears or disappears with the stock. Logos are local full-colour WebP files in assets/brands/ (sources and
   licences: assets/brands/CREDITS.txt); a make without a logo file gets a plain wordmark tile. Every link is stock.html?brand=<slug>, which
   stock.js turns into the Make filter (and keeps in the address bar). */
(function () {
  "use strict";
  if (typeof CARS === "undefined") return;
  var LOGOS = ["audi", "bmw", "ford", "honda", "hyundai", "jaguar", "jeep", "kia", "land-rover", "mahindra", "maruti-suzuki", "maserati", "mercedes-benz", "mg", "mini", "skoda", "tata", "tesla", "toyota", "volkswagen", "volvo"];
  var root = function (u) { return window.CA && window.CA.root ? window.CA.root(u) : u; };

  function slug(make) { return String(make).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var counts = {};
  CARS.forEach(function (c) { if (c.status !== "SOLD" && c.make) counts[c.make] = (counts[c.make] || 0) + 1; });
  var list = Object.keys(counts).map(function (m) { return { make: m, slug: slug(m), n: counts[m] }; })
    .sort(function (a, b) { return b.n - a.n || a.make.localeCompare(b.make); });

  window.CA_BRANDS = { list: list, slug: slug, makeFor: function (s) { for (var i = 0; i < list.length; i++) if (list[i].slug === s) return list[i].make; for (var j = 0; j < CARS.length; j++) if (slug(CARS[j].make) === s) return CARS[j].make; return null; } };

  function logo(b, cls) {
    if (LOGOS.indexOf(b.slug) < 0) return '<span class="brand-word ' + cls + '" aria-hidden="true">' + esc(b.make) + '</span>';
    return '<img class="' + cls + '" src="' + root("assets/brands/" + b.slug + ".webp") + '" alt="" width="150" height="100" loading="lazy" decoding="async">';
  }
  function plural(n) { return n + (n === 1 ? " car" : " cars"); }

  /* ---- home: the grid ---- */
  var grid = document.getElementById("brandGrid");
  if (grid && list.length) {
    grid.innerHTML = list.map(function (b) {
      return '<li><a class="brand-card" href="stock.html?brand=' + b.slug + '" data-cta="see_stock" data-at="brands">' +
        '<span class="brand-logo">' + logo(b, "brand-img") + '</span>' +
        '<span class="brand-name">' + esc(b.make) + '</span><span class="brand-count">' + plural(b.n) + '</span></a></li>';
    }).join("");
    var more = document.getElementById("brandMore");
    if (more && list.length > 9) {
      more.hidden = false;
      more.textContent = "Show all " + list.length + " brands";
      more.addEventListener("click", function () {
        var open = grid.classList.toggle("is-open");
        more.setAttribute("aria-expanded", String(open));
        more.textContent = open ? "Show fewer brands" : "Show all " + list.length + " brands";
      });
    }
  }

  /* ---- home: body type, budget and fuel tabs next to the brands. Same counts, same stock.html filters (?body= &band= &fuel=). ---- */
  var tabs = [].slice.call(document.querySelectorAll(".browse-tab"));
  if (tabs.length && window.ClassicAuto) {
    var avail = CARS.filter(function (c) { return c.status !== "SOLD"; });
    function chips(el, param, defs, label) {
      var host = document.getElementById(el);
      if (!host) return;
      var out = defs.map(function (d) {
        var n = avail.filter(function (c) { return d.test(c); }).length;
        return n ? '<li><a class="chip-card" href="stock.html?' + param + '=' + encodeURIComponent(d.v) + '" data-cta="see_stock" data-at="browse"><b>' + esc(d.label) + '</b><span>' + plural(n) + '</span>' +
          '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></li>' : "";
      }).join("");
      host.innerHTML = out || '<li class="brand-fallback"><a class="link-arrow" href="stock.html">Browse all stock</a></li>';
    }
    var bodies = window.ClassicAuto.TYPES.map(function (t) {
      return { v: t.v, label: t.label, test: function (c) { return window.ClassicAuto.carTypes(c).indexOf(t.v) > -1; } };
    });
    chips("bodyGrid", "type", bodies);
    chips("budgetGrid", "band", [
      { v: "u20", label: "Under ₹20 L", test: function (c) { return c.band === "u20"; } },
      { v: "20to50", label: "₹20-50 L", test: function (c) { return c.band === "20to50"; } },
      { v: "50plus", label: "₹50 L and above", test: function (c) { return c.band === "50plus"; } }
    ]);
    chips("fuelGrid", "fuel", ["Petrol", "Diesel", "Electric", "Hybrid", "CNG"].map(function (v) { return { v: v, label: v, test: function (c) { return c.fuel === v; } }; }));
    function pick(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab, p = document.getElementById(t.getAttribute("aria-controls"));
        t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1;
        if (p) p.hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { pick(t); });
      t.addEventListener("keydown", function (e) {
        var k = e.key, n = k === "ArrowRight" ? i + 1 : k === "ArrowLeft" ? i - 1 : k === "Home" ? 0 : k === "End" ? tabs.length - 1 : -1;
        if (n < 0) return;
        e.preventDefault(); pick(tabs[(n + tabs.length) % tabs.length], true);
      });
    });
  }

  /* ---- stock page: the strip. stock.js owns the filtering and marks the current brand (aria-current) after every change ---- */
  var strip = document.getElementById("brandStrip");
  if (strip && list.length) {
    strip.innerHTML = '<a class="brand-chip" href="stock.html" data-brand="" aria-current="true"><span>All brands</span></a>' + list.map(function (b) {
      return '<a class="brand-chip" href="stock.html?brand=' + b.slug + '" data-brand="' + b.slug + '">' + logo(b, "brand-chip-img") + '<span>' + esc(b.make) + ' <b>' + b.n + '</b></span></a>';
    }).join("");
  }
})();
