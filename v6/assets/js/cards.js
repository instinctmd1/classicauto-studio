/* =========================================================================
   Classic Auto v6: shared car-card renderer (home featured grid, stock grid,
   car page "similar cars"). Photo -> make -> model -> variant -> spec row ->
   price + EMI -> actions. Shortlist heart and Compare checkbox are SIBLINGS
   of the card link (never nested in it); compare-shortlist.js wires them.
   ========================================================================= */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAuto) return;
  var fmt = window.ClassicAuto;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function altFor(c) { return fmt.carLabel(c) + ", " + c.colour.toLowerCase() + ", front three-quarter"; }
  /* the static cars/<id>/ page is the canonical URL (SEO tags, share image): cards and every in-site link go there, so link equity and shared URLs stay on one address */
  function href(c) { return "cars/" + encodeURIComponent(c.id) + "/"; }

  function mediaHTML(c) {
    var badge = '<span class="car-badge' + (c.status === "SOLD" ? " is-sold" : "") + '">' + (c.status === "SOLD" ? "Sold" : fmt.bodyLabel(c.body)) + '</span>';
    if (c.photos && c.photos.length) {
      return '<div class="car-media">' + badge +
        '<img src="' + esc(c.photos[0]) + '" alt="' + esc(altFor(c)) + '" width="1110" height="700" loading="lazy" decoding="async" style="view-transition-name: car-' + esc(c.id) + '"></div>';
    }
    return '<div class="car-media is-placeholder">' + badge +
      '<div><span class="ph-label">' + esc(c.make) + '<br>' + esc(c.model) + '</span><span class="ph-note">Photos on request</span></div></div>';
  }

  function specRow(c) {
    var cells = [
      ["Year", c.year],
      ["Driven", Number(c.kms).toLocaleString("en-IN") + " km"],
      ["Fuel", c.fuel],
      ["Gearbox", fmt.transShort(c)],
      ["Owner", c.owners]
    ];
    return '<dl class="car-specs">' + cells.map(function (x) {
      return '<div><dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd></div>';
    }).join("") + '</dl>';
  }

  function priceBlock(c, opts) {
    if (c.price_on_request || c.price == null) {
      return '<div class="car-price-row"><span class="car-price">Ask for price</span></div>';
    }
    var emi = opts.showEmi === false ? "" : '<div class="car-emi">EMI from <strong>' + fmt.rupees(fmt.emi(c.price)) + '</strong>/mo*</div>';
    return '<div class="car-price-row"><span class="car-price" data-glint>' + fmt.money(c.price) + '</span></div>' + emi;
  }

  function cardHTML(c, opts) { return window.CA.rootify(cardMarkup(c, opts)); }
  function cardMarkup(c, opts) {
    opts = opts || {};
    var call = window.CA && window.CA.callCta();
    var callBtn = call ? '<a class="car-call-btn" href="' + call.href + '" data-cta="call" data-at="car_page" aria-label="Call Classic Auto about the ' + esc(fmt.carLabel(c)) + '">' +
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .8 3a2 2 0 0 1-.5 2L8 10.1a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2-.5c1 .4 2 .7 3 .8a2 2 0 0 1 1.6 2z"/></svg></a>' : "";
    var label = fmt.carLabel(c);
    return (
      '<article class="car-card" data-car-id="' + esc(c.id) + '">' +
        '<div class="car-card-tools">' +
          '<button type="button" class="shortlist-btn" data-shortlist="' + esc(c.id) + '" aria-pressed="false" aria-label="Shortlist ' + esc(label) + '">' +
            '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.7-9.8-9.4C.7 7.4 2.4 4 6 4c2 0 3.6 1.1 4.5 2.6C11.4 5.1 13 4 15 4c3.6 0 5.3 3.4 3.8 7.1C16.5 15.8 12 20.5 12 20.5z"/></svg>' +
          '</button>' +
          '<label class="compare-check"><input type="checkbox" name="compare" data-compare="' + esc(c.id) + '" aria-label="Compare ' + esc(label) + '"><span>Compare</span></label>' +
        '</div>' +
        '<a class="car-card-link" href="' + href(c) + '">' +
          mediaHTML(c) +
          '<div class="car-body">' +
            '<span class="car-eyebrow">' + esc(c.make) + '</span>' +
            '<h3>' + esc(c.model) + '</h3>' +
            '<p class="car-variant"><span class="colour-dot" style="background:' + esc(c.paint) + '" aria-hidden="true"></span>' + esc(c.colour) + ' &middot; ' + esc(c.variant) + '</p>' +
            specRow(c) +
            priceBlock(c, opts) +
          '</div>' +
        '</a>' +
        '<div class="car-card-cta">' +
          '<a class="btn btn-primary car-view-btn" href="' + href(c) + '">View details</a>' + callBtn +
        '</div>' +
      '</article>'
    );
  }

  window.ClassicAutoCards = { cardHTML: cardHTML, bodyLabel: fmt.bodyLabel, mediaHTML: mediaHTML, esc: esc, href: href };
})();
