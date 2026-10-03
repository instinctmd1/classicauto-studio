/* Catalogue page: one printable sheet per car, from window.CARS. */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAuto) return;
  var fmt = window.ClassicAuto, esc = window.ClassicAutoCards.esc;
  var mount = document.getElementById("catalogueList");
  if (!mount) return;

  function media(c, i) {
    var load = i === 0 ? 'fetchpriority="high"' : 'loading="lazy"';     // the first sheet is the LCP image: never lazy
    if (c.photos && c.photos.length) return '<div class="cs-media"><img src="' + esc(c.photos[0]) + '" alt="' + esc(fmt.carLabel(c) + ", " + c.colour.toLowerCase()) + '" width="1110" height="700" ' + load + ' decoding="async"></div>';
    return '<div class="cs-media car-media is-placeholder"><div><span class="ph-label">' + esc(c.make) + '<br>' + esc(c.model) + '</span><span class="ph-note">Photos on request</span></div></div>';
  }

  mount.innerHTML = CARS.map(function (c, i) {
    var price = c.price_on_request || c.price == null ? "Ask for price" : fmt.money(c.price);
    var emi = c.price ? '<p class="calc-note">EMI from ' + fmt.rupees(fmt.emi(c.price)) + '/mo* (20% down, 60 months, 11.5% a year assumed)</p>' : "";
    return '<article class="catalogue-sheet">' + media(c, i) +
      '<div>' +
        '<span class="eyebrow">' + c.year + ' &middot; ' + fmt.bodyLabel(c.body) + (c.status === "SOLD" ? " &middot; Sold" : "") + '</span>' +
        '<h2>' + esc(c.make) + ' ' + esc(c.model) + '</h2>' +
        '<p class="lead" style="margin-bottom:4px;">' + esc(c.variant) + '</p>' +
        '<div class="price">' + price + '</div>' +
        '<div class="meta"><span>' + fmt.formatKm(c.kms) + '</span><span>' + esc(c.fuel) + '</span><span>' + esc(c.trans + ' (' + fmt.transShort(c) + ')') + '</span><span>' + esc(c.owners) + ' owner</span><span>Registered ' + esc(c.reg_month + (c.rto ? " (" + c.rto + ")" : "")) + '</span></div>' +
        '<p>Insurance: ' + fmt.insurance(c).text + '.</p>' + emi +
        '<a class="btn btn-outline no-print" style="margin-top:12px;" href="cars/' + encodeURIComponent(c.id) + '/">Full details</a>' +
      '</div></article>';
  }).join("");
  if (window.CA_MOTION && window.CA_MOTION.glints) window.CA_MOTION.glints(mount);
})();
