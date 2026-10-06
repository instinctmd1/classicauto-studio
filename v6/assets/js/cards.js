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

  var SHARE_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>';
  var WA_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l1.9-5.6A8.4 8.4 0 1 1 21 11.5z"/></svg>';
  var LINK_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';

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
          '<span class="tool-pair">' +
          '<button type="button" class="shortlist-btn share-btn" data-share="' + esc(c.id) + '" aria-label="Share the ' + esc(label) + ' with family or friends">' + SHARE_ICON + '</button>' +
          '<button type="button" class="shortlist-btn" data-shortlist="' + esc(c.id) + '" aria-pressed="false" aria-label="Shortlist ' + esc(label) + '">' +
            '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.7-9.8-9.4C.7 7.4 2.4 4 6 4c2 0 3.6 1.1 4.5 2.6C11.4 5.1 13 4 15 4c3.6 0 5.3 3.4 3.8 7.1C16.5 15.8 12 20.5 12 20.5z"/></svg>' +
          '</button>' +
          '</span>' +
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

  /* ---------------------------------------------------------------- Share with family (gap plan P0-1)
     The family decides together, so every card and car page can pass the car on. The phone's own share sheet when there is one
     (WhatsApp then shows the car's preview card: photo, name, price); otherwise a small sheet with WhatsApp and Copy link.
     The WhatsApp link carries only the text and the page link, never a phone number, and nothing is sent to us. */
  function absUrl(c) {
    var rel = window.CA.root(href(c));
    try { return new URL(rel, window.location.href).href; } catch (e) { return rel; }
  }
  function shareText(c) {
    var bits = [fmt.carFullLabel(c).trim() + (c.seats ? ", " + c.seats + " seats" : "")];
    bits.push(c.price_on_request || c.price == null ? "Ask for price" : fmt.money(c.price));
    var used = [];
    if (c.kms != null) used.push(fmt.formatKm(c.kms));
    if (c.owners) used.push(c.owners + " owner");
    if (used.length) bits.push(used.join(", "));
    bits.push("Classic Auto, Malad West");
    return bits.join(" · ");
  }
  function waShareLink(c) { return "https://api.whatsapp.com/send?text=" + encodeURIComponent(shareText(c) + "\n" + absUrl(c)); }
  function trackShare(at, via) { if (window.CA_TRACK) window.CA_TRACK("cta_click", { cta: "share", at: at || "other", via: via }); }

  var sheet = null, sheetAt = "", lastOpener = null;
  function buildSheet() {
    sheet = document.createElement("dialog");
    sheet.className = "offer-dialog share-dialog";
    sheet.id = "shareDialog";
    sheet.setAttribute("aria-labelledby", "shareTitle");
    sheet.setAttribute("data-lenis-prevent", "");
    sheet.innerHTML =
      '<div class="offer-form">' +
        '<div class="offer-head"><h2 id="shareTitle">Share this car</h2>' +
          '<button type="button" class="offer-close" data-act="close" aria-label="Close"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
        '<p class="offer-ask" id="shareWhat"></p>' +
        '<div class="share-actions">' +
          '<a class="btn btn-primary" id="shareWa" href="#" target="_blank" rel="noopener">' + WA_ICON + 'Send on WhatsApp</a>' +
          '<button type="button" class="btn btn-outline" data-act="copy">' + LINK_ICON + 'Copy link</button>' +
        '</div>' +
        '<div class="field share-link"><label for="shareUrl">Link to this car</label><input id="shareUrl" type="text" readonly></div>' +
        '<p class="offer-fine">The link opens the car\'s page with its photo and price. We never see who you share it with.</p>' +
      '</div>';
    document.body.appendChild(sheet);
    sheet.addEventListener("click", function (e) {
      if (e.target === sheet) return closeSheet();
      var act = e.target.closest && e.target.closest("[data-act]");
      if (act && act.getAttribute("data-act") === "close") closeSheet();
      if (act && act.getAttribute("data-act") === "copy") {
        var input = sheet.querySelector("#shareUrl");
        window.CA.copyText(input.value).then(function (ok) {
          if (ok) { window.CA.toast("Link copied. Paste it in WhatsApp or anywhere."); trackShare(sheetAt, "copy_link"); }
          else { input.focus(); input.select(); }
        });
      }
    });
    sheet.querySelector("#shareWa").addEventListener("click", function () { trackShare(sheetAt, "whatsapp_share"); });
    sheet.addEventListener("close", function () {
      if (window.__lenis) window.__lenis.start();
      if (lastOpener && lastOpener.focus) lastOpener.focus({ preventScroll: true });
    });
  }
  function openSheet(c, at, opener) {
    if (!sheet) buildSheet();
    sheetAt = at; lastOpener = opener || null;
    sheet.querySelector("#shareWhat").textContent = shareText(c);
    sheet.querySelector("#shareWa").href = waShareLink(c);
    sheet.querySelector("#shareUrl").value = absUrl(c);
    if (typeof sheet.showModal === "function") sheet.showModal(); else sheet.setAttribute("open", "");
    if (window.__lenis) window.__lenis.stop();
  }
  function closeSheet() { if (!sheet) return; if (sheet.close) sheet.close(); else sheet.removeAttribute("open"); }

  function share(c, at, opener) {
    var data = { title: fmt.carLabel(c) + " · Classic Auto", text: shareText(c), url: absUrl(c) };
    var native = navigator.share && (!navigator.canShare || navigator.canShare(data)) && /^https?:/.test(data.url);
    if (!native) return openSheet(c, at, opener);
    navigator.share(data).then(function () { trackShare(at, "share_sheet"); }, function (err) {
      if (!err || err.name !== "AbortError") openSheet(c, at, opener);       // cancelled by the visitor: nothing to do
    });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-share]");
    if (!b) return;
    e.preventDefault();
    var id = b.getAttribute("data-share"), c = CARS.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var page = document.body.getAttribute("data-page");
    var at = b.getAttribute("data-at") || (document.getElementById("carFound") ? "car_page" : page === "quiz" ? "quiz" : page === "request" ? "request_page" : "stock");
    share(c, at, b);
  });

  window.ClassicAutoCards = { cardHTML: cardHTML, bodyLabel: fmt.bodyLabel, mediaHTML: mediaHTML, esc: esc, href: href, share: share, shareText: shareText, absUrl: absUrl };
})();
