/* =========================================================================
   Classic Auto — website-v5 — shared car-card renderer ("JDM showroom" card).
   Used by index.html (featured), stock.html (grid) and car.html (similar).
   Image → eyebrow (make) → model name → colour dot → spec table
   (year · kms · fuel · trans · owners) → bold price → red "View details" +
   call icon. Shortlist heart + Compare checkbox sit above the media, as
   SIBLINGS of the card's <a> (never nested inside it) so they stay valid,
   independently clickable controls — assets/js/compare-shortlist.js wires
   their behaviour via event delegation.
   ========================================================================= */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAuto) return;
  var fmt = window.ClassicAuto;

  function bodyLabel(body) {
    if (body === "suv") return "SUV";
    if (body === "luxury-sedan") return "Luxury Sedan";
    if (body === "sedan") return "Sedan";
    if (body === "hatchback") return "Hatchback";
    return body;
  }

  function mediaHTML(c) {
    var badge = '<span class="car-badge' + (c.status === "SOLD" ? " is-sold" : "") + '">' + (c.status === "SOLD" ? "Sold" : bodyLabel(c.body)) + '</span>';

    if (c.photos && c.photos.length) {
      return '<div class="car-media">' + badge +
        '<img src="' + c.photos[0] + '" alt="' + fmt.carLabel(c) + '" width="1260" height="840" loading="lazy"></div>';
    }

    var previews = window.CA_STUDIO_PREVIEWS && window.CA_STUDIO_PREVIEWS[c.id];
    if (previews && previews.length) {
      return '<div class="car-media has-studio-preview">' + badge +
        '<span class="studio-preview-tag">Studio preview</span>' +
        '<img src="' + previews[0] + '" alt="' + fmt.carLabel(c) + ' — studio preview render" width="1260" height="840" loading="lazy"></div>';
    }

    return '<div class="car-media is-placeholder">' + badge +
      '<div><span class="ph-label">' + c.make + '<br>' + c.model + '</span><span class="ph-note">Photo on request</span></div></div>';
  }

  function specTable(c) {
    var cells = [
      ["Year", c.year],
      ["KM", fmt.formatKm(c.kms).replace(" km", "")],
      ["Fuel", c.fuel],
      ["Trans", c.trans === "Automatic" ? "Auto" : "Manual"],
      ["Owners", c.owners]
    ];
    return '<div class="car-spec-table" role="table" aria-label="Key specifications">' +
      cells.map(function (cell) {
        return '<div class="cst-cell" role="cell"><span class="cst-k">' + cell[0] + '</span><span class="cst-v">' + cell[1] + '</span></div>';
      }).join("") +
      '</div>';
  }

  function cardHTML(c, opts) {
    opts = opts || {};
    var emiLine = opts.showEmi === false ? "" :
      '<div class="car-emi-line">EMI from <strong>' + fmt.rupees(fmt.emi(c.price)) + '</strong>/mo*</div>';

    var tools =
      '<div class="car-card-tools">' +
        '<button type="button" class="shortlist-btn" data-shortlist="' + c.id + '" aria-pressed="false" aria-label="Add ' + fmt.carLabel(c) + ' to shortlist">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20.5s-7.5-4.7-9.8-9.4C.7 7.4 2.4 4 6 4c2 0 3.6 1.1 4.5 2.6C11.4 5.1 13 4 15 4c3.6 0 5.3 3.4 3.8 7.1C16.5 15.8 12 20.5 12 20.5z"/></svg>' +
        '</button>' +
        '<label class="compare-check">' +
          '<input type="checkbox" data-compare="' + c.id + '" aria-label="Add ' + fmt.carLabel(c) + ' to compare">' +
          '<span>Compare</span>' +
        '</label>' +
      '</div>';

    return (
      '<div class="car-card stagger-item" data-car-id="' + c.id + '">' +
        tools +
        '<a class="car-card-link" href="car.html?id=' + encodeURIComponent(c.id) + '">' +
          mediaHTML(c) +
          '<div class="car-body">' +
            '<span class="car-eyebrow">' + c.make + '</span>' +
            '<h3>' + c.model + '</h3>' +
            '<div class="car-colour-row">' +
              '<span class="colour-dot" style="background:' + c.paint + '" aria-hidden="true"></span>' +
              '<span>' + c.colour + ' · ' + c.variant + '</span>' +
            '</div>' +
            specTable(c) +
            '<div class="car-price-row">' +
              '<span class="car-price">' + fmt.money(c.price) + '</span>' +
            '</div>' +
            emiLine +
          '</div>' +
        '</a>' +
        '<div class="car-card-cta-row">' +
          '<a class="btn btn-primary car-view-btn" href="car.html?id=' + encodeURIComponent(c.id) + '">View details' +
            '<svg class="icon" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>' +
          '<a class="car-call-btn" href="tel:+919588990000" aria-label="Call Classic Auto about the ' + fmt.carLabel(c) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .8 3a2 2 0 0 1-.5 2L8 10.1a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2-.5c1 .4 2 .7 3 .8a2 2 0 0 1 1.6 2z"/></svg>' +
          '</a>' +
        '</div>' +
      '</div>'
    );
  }

  window.ClassicAutoCards = { cardHTML: cardHTML, bodyLabel: bodyLabel, mediaHTML: mediaHTML };
})();
