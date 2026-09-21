/* =========================================================================
   Classic Auto — website-v4 — shared car-card renderer.
   Used by index.html (featured), stock.html (grid) and car.html (similar).
   ========================================================================= */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAuto) return;
  var fmt = window.ClassicAuto;

  function mediaHTML(c) {
    var badge = '<span class="car-badge' + (c.status === "SOLD" ? " is-sold" : "") + '">' + (c.status === "SOLD" ? "Sold" : bodyLabel(c.body)) + '</span>';
    if (c.photos && c.photos.length) {
      return '<div class="car-media">' + badge +
        '<img src="' + c.photos[0] + '" alt="' + fmt.carLabel(c) + '" width="1260" height="840" loading="lazy"></div>';
    }
    return '<div class="car-media is-placeholder">' + badge +
      '<div><span class="ph-label">' + c.make + '<br>' + c.model + '</span><span class="ph-note">Photo on request</span></div></div>';
  }

  function bodyLabel(body) {
    if (body === "suv") return "SUV";
    if (body === "luxury-sedan") return "Luxury Sedan";
    if (body === "sedan") return "Sedan";
    if (body === "hatchback") return "Hatchback";
    return body;
  }

  function cardHTML(c, opts) {
    opts = opts || {};
    var emiLine = opts.showEmi === false ? "" :
      '<div class="car-meta"><span>EMI from ' + fmt.rupees(fmt.emi(c.price)) + '/mo*</span></div>';
    return (
      '<div class="car-card stagger-item">' +
        '<a class="car-card-link" href="car.html?id=' + encodeURIComponent(c.id) + '">' +
          mediaHTML(c) +
          '<div class="car-body">' +
            '<h3>' + c.make + ' ' + c.model + '</h3>' +
            '<div class="car-meta"><span>' + c.year + '</span><span>' + fmt.formatKm(c.kms) + '</span><span>' + c.fuel + '</span></div>' +
            '<div class="car-price">' + fmt.money(c.price) + '</div>' +
            emiLine +
            '<div class="car-foot"><span class="car-link-cta">View Details' +
              '<svg class="icon" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></div>' +
          '</div>' +
        '</a>' +
      '</div>'
    );
  }

  window.ClassicAutoCards = { cardHTML: cardHTML, bodyLabel: bodyLabel, mediaHTML: mediaHTML };
})();
