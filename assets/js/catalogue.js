/* Catalogue page — one printable sheet per car, from window.CARS. */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAuto) return;
  var fmt = window.ClassicAuto;
  var mount = document.getElementById("catalogueList");
  if (!mount) return;

  function mediaHTML(c) {
    if (c.photos && c.photos.length) {
      return '<div class="cs-media"><img src="' + c.photos[0] + '" alt="' + fmt.carLabel(c) + '" loading="lazy"></div>';
    }
    return '<div class="cs-media" style="display:flex;align-items:center;justify-content:center;background:var(--bg-elevated-2);"><span style="font-family:var(--font-display);color:var(--text-faint);text-align:center;padding:1rem;">' + c.make + '<br>' + c.model + '</span></div>';
  }

  mount.innerHTML = CARS.map(function (c) {
    return (
      '<div class="catalogue-sheet">' +
        mediaHTML(c) +
        '<div>' +
          '<div class="eyebrow">' + c.year + ' · ' + c.body.toUpperCase() + (c.status === "SOLD" ? " · SOLD" : "") + '</div>' +
          '<h2 style="font-size:1.4rem;">' + c.make + ' ' + c.model + '</h2>' +
          '<p class="lead" style="margin-bottom:0.5rem;">' + c.variant + '</p>' +
          '<div class="detail-price" style="font-size:1.5rem;">' + fmt.money(c.price) + '</div>' +
          '<div class="car-meta" style="margin:0.4rem 0;"><span>' + fmt.formatKm(c.kms) + '</span><span>' + c.fuel + '</span><span>' + c.trans + '</span><span>' + c.owners + ' owner</span></div>' +
          '<p style="max-width:60ch;">' + c.notes + '</p>' +
          '<p class="calc-note">EMI from ' + fmt.rupees(fmt.emi(c.price)) + '/mo* · ' + c.insurance + ' · ' + c.reg_city + '</p>' +
          '<a class="btn btn-outline no-print" style="margin-top:0.5rem;" href="car.html?id=' + encodeURIComponent(c.id) + '">Full Details</a>' +
        '</div>' +
      '</div>'
    );
  }).join("");
})();
