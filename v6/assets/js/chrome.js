/* =========================================================================
   Classic Auto v6: site chrome (header, mobile menu, footer, sticky CTA bar).
   Every contact detail comes from window.CA_SITE via window.CA (config.js),
   so setting `phone` / `whatsapp` there lights up CALL NOW and WhatsApp on
   every page with no other edit (rule N2).

   Loaded synchronously right after <body> opens: the header is written
   before first paint; the footer and sticky bar fill their slots once the
   DOM is parsed.
   ========================================================================= */
(function () {
  "use strict";
  var CA = window.CA, S = window.CA_SITE;
  if (!CA || !S) return;
  var script = document.currentScript;
  var page = document.body.getAttribute("data-page") || "";

  var ICON = {
    ig: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>',
    wa: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l1.9-5.6A8.4 8.4 0 1 1 21 11.5z"/></svg>',
    fb: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h-2a5 5 0 0 0-5 5v3H5v4h3v6h4v-6h3.2l.8-4H12V8a1 1 0 0 1 1-1h2z"/></svg>',
    yt: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l6 3-6 3z"/></svg>',
    phone: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .8 3a2 2 0 0 1-.5 2L8 10.1a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2-.5c1 .4 2 .7 3 .8a2 2 0 0 1 1.6 2z"/></svg>',
    pin: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    chat: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    menu: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
    close: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /* The CA mark (red C, three blue bars) on an off-white tile so the brand blue keeps its contrast on navy. */
  var MARK_SVG =
    '<svg class="brand-mark" viewBox="0 0 780 380" aria-hidden="true" focusable="false">' +
      '<path d="M 100 12 L 300 12 L 300 88 L 128 88 Q 96 88 96 120 L 96 238 Q 96 268 128 268 L 688 268 Q 722 268 722 302 L 722 310 Q 722 344 688 344 L 92 344 Q 14 344 14 266 L 14 98 Q 14 12 100 12 Z" fill="#E11B22"/>' +
      '<g fill="#2B3990"><polygon points="468,6 552,6 372,360 288,360"/><polygon points="468,6 552,6 758,360 674,360"/><polygon points="404,212 620,212 650,282 370,282"/></g>' +
    '</svg>';
  var BRAND_HTML = '<span class="brand-tile">' + MARK_SVG + '</span><span class="brand-word"><b>Classic</b> <i>Auto</i><small>Since ' + S.since + '</small></span>';

  var NAV = [
    ["index.html", "Home", "home"],
    ["stock.html", "Stock", "stock"],
    ["studio.html", "Studio", "studio"],
    ["quiz.html", "Find your car", "quiz"],
    ["sell.html", "Sell your car", "sell"],
    ["reviews.html", "Reviews", "reviews"]
  ];

  function ext(href) { return ' target="_blank" rel="noopener"'; }

  function socialLinks(cls) {
    var out = '<a data-social="instagram" href="https://instagram.com/' + S.instagram + '"' + ext() + ' aria-label="Classic Auto on Instagram">' + ICON.ig + '</a>';
    if (S.facebook) out += '<a data-social="facebook" href="' + S.facebook + '"' + ext() + ' aria-label="Classic Auto on Facebook">' + ICON.fb + '</a>';
    if (S.youtube) out += '<a data-social="youtube" href="' + S.youtube + '"' + ext() + ' aria-label="Classic Auto on YouTube">' + ICON.yt + '</a>';
    if (S.whatsapp) out += '<a data-social="whatsapp" href="' + CA.waLink() + '"' + ext() + ' aria-label="Chat with Classic Auto on WhatsApp">' + ICON.wa + '</a>';
    return out;
  }

  function navLinks(cls) {
    return NAV.map(function (n) {
      return '<a href="' + n[0] + '" data-nav="' + n[2] + '"' + (page === n[2] ? ' aria-current="page"' : "") + '>' + n[1] + '</a>';
    }).join("");
  }

  function primaryButtons() {
    var m = CA.messageCta(), call = CA.callCta();
    var html = "";
    if (call) html += '<a class="btn btn-outline header-call" href="' + call.href + '" data-cta="call" data-at="header">' + ICON.phone + 'CALL NOW</a>';
    html += '<a class="btn btn-primary header-cta" href="' + m.href + '"' + ext() + ' data-cta="message" data-at="header" data-via="' + m.via + '">' + m.label + '</a>';
    return html;
  }

  /* ---------------------------------------------------------------- header */
  var headerHtml =
    '<a class="skip-link" href="#main">Skip to main content</a>' +
    '<header class="site-header" id="siteHeader"><div class="container">' +
      '<a class="brand" href="index.html" aria-label="Classic Auto, home" id="brandMark">' + BRAND_HTML + '</a>' +
      '<nav class="nav-links" aria-label="Primary">' + navLinks() + '</nav>' +
      '<div class="header-social">' + socialLinks() + '</div>' +
      '<div class="header-actions">' + primaryButtons() + '</div>' +
      '<button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">' + ICON.menu + '</button>' +
    '</div></header>' +
    '<nav class="mobile-nav" id="mobileNav" aria-label="Mobile">' +
      navLinks() +
      '<div class="mobile-nav-cta">' + primaryButtons() + '</div>' +
    '</nav>';
  headerHtml = CA.rootify(headerHtml);
  if (script) script.insertAdjacentHTML("beforebegin", headerHtml);
  else document.body.insertAdjacentHTML("afterbegin", headerHtml);

  /* ---------------------------------------------------------------- footer */
  function footerHtml() {
    var contact = "";
    if (S.phone) contact += '<li><a href="' + CA.telLink() + '" data-cta="call" data-at="footer">' + S.phone + '</a></li>';
    if (S.whatsapp) contact += '<li><a href="' + CA.waLink() + '"' + ext() + ' data-cta="message" data-at="footer" data-via="whatsapp">WhatsApp</a></li>';
    contact += '<li><a href="' + CA.igDm() + '"' + ext() + ' data-cta="message" data-at="footer" data-via="instagram_dm">DM @' + S.instagram + '</a></li>';
    var partners = "";
    if (S.finance_partners && S.finance_partners.length) {
      partners = '<div class="footer-strip"><span>Finance partners</span>' + S.finance_partners.map(function (p) { return '<span class="fs-word">' + p + '</span>'; }).join("") + '</div>';
    }
    return '<footer class="site-footer"><div class="container">' +
      '<div class="footer-grid">' +
        '<div class="footer-brand"><a class="brand brand--foot" href="index.html" aria-label="Classic Auto, home">' + BRAND_HTML + '</a>' +
          '<p>Pre-owned car dealership in Malad West, Mumbai, since ' + S.since + '. Buy, sell, exchange and upgrade, with EMI estimates on every car.</p>' +
          '<div class="social-row">' + socialLinks() + '</div>' +
        '</div>' +
        '<div class="footer-col"><h2 class="footer-heading">Explore</h2><ul>' +
          '<li><a href="stock.html">Stock</a></li><li><a href="studio.html">3D Studio</a></li><li><a href="request.html">Request a car</a></li><li><a href="quiz.html">Find your car</a></li><li><a href="compare.html">Compare</a></li>' +
          '<li><a href="sell.html">Sell your car</a></li><li><a href="reviews.html">Reviews</a></li><li><a href="catalogue.html">Printable catalogue</a></li><li><a href="privacy.html">Privacy policy</a></li><li><a href="terms.html">Terms of service</a></li>' +
        '</ul></div>' +
        '<div class="footer-col"><h2 class="footer-heading">Contact</h2><ul>' + contact + '</ul></div>' +
        '<div class="footer-col"><h2 class="footer-heading">Showroom</h2><ul>' +
          '<li><address>' + S.address_lines.join("<br>") + '</address></li>' +
          (S.hours ? '<li>' + S.hours + '</li>' : "") +
          '<li><a href="' + CA.mapsUrl() + '"' + ext() + ' data-cta="visit" data-at="footer" data-via="maps">' + ICON.pin + 'Open in Maps</a></li>' +
        '</ul></div>' +
      '</div>' + partners +
      '<div class="footer-bottom">' +
        '<span>&copy; <span data-year>2026</span> Classic Auto. All rights reserved.</span>' +
        '<span>Since ' + S.since + ' &middot; Malad West, Mumbai</span>' +
        '<span><a href="models/LICENSE.txt">3D model, HDRI and texture credits</a></span>' +
      '</div>' +
    '</div></footer>';
  }

  /* ------------------------------------------------------------ sticky bar */
  function stickyHtml() {
    var m = CA.messageCta(), v = CA.visitCta(), c = CA.callCta();
    var btns = '<a class="sticky-btn sticky-btn--primary" id="stickyMsg" href="' + m.href + '"' + ext() + ' data-cta="message" data-at="sticky_bar" data-via="' + m.via + '">' + ICON.chat + '<span>Message</span></a>';
    if (c) btns += '<a class="sticky-btn" href="' + c.href + '" data-cta="call" data-at="sticky_bar" data-via="tel">' + ICON.phone + '<span>Call</span></a>';
    btns += '<a class="sticky-btn" href="' + v.href + '"' + ext() + ' data-cta="visit" data-at="sticky_bar" data-via="maps">' + ICON.pin + '<span>Visit</span></a>';
    return '<div class="sticky-bar" id="stickyBar" role="region" aria-label="Contact Classic Auto">' + btns + '</div>';
  }

  function mountBelow() {
    var slot = document.getElementById("siteFooter");
    var html = CA.rootify(footerHtml());
    if (slot) slot.outerHTML = html; else document.body.insertAdjacentHTML("beforeend", html);
    document.body.insertAdjacentHTML("beforeend", CA.rootify(stickyHtml()));
    if (S.features && S.features.anita && !document.getElementById("anitaRoot")) {
      document.body.insertAdjacentHTML("beforeend", '<div id="anitaRoot"></div>');
    }
    initSticky();
  }

  /* Page-specific message for the sticky Message button (car page etc.). */
  CA.setStickyMessage = function (text) {
    var a = document.getElementById("stickyMsg");
    if (!a) return;
    a.setAttribute("data-ca-msg", text);
    if (S.whatsapp) a.href = CA.waLink(text);
  };

  /* Hide on scroll down, show on scroll up. Transform-only. */
  function initSticky() {
    var bar = document.getElementById("stickyBar");
    if (!bar) return;
    var lastY = window.scrollY, ticking = false, homeGate = null;
    window.addEventListener("resize", function () { homeGate = null; });
    if (page === "home") bar.classList.add("is-pre");
    window.addEventListener("load", function () { homeGate = null; });
    // cache the page height so the scroll callback never forces a layout read
    var docH = document.documentElement.scrollHeight;
    function measure() { docH = document.documentElement.scrollHeight; }
    if (window.ResizeObserver) new ResizeObserver(measure).observe(document.body);
    window.addEventListener("load", measure); window.addEventListener("resize", measure);
    function update() {
      var y = window.scrollY, dy = y - lastY;
      var nearEnd = (window.innerHeight + y) >= (docH - 80);
      // Home: the hero already carries the CTAs, so the bar waits until the visitor has scrolled past it.
      if (page === "home") {
        if (homeGate == null) { var u = document.getElementById("unveil"); homeGate = u ? u.offsetTop + u.offsetHeight - window.innerHeight * 0.3 : window.innerHeight * 0.55; }
        bar.classList.toggle("is-pre", y < homeGate);
      }
      if (y < 160 || nearEnd || dy < -6) bar.classList.remove("is-hidden");
      else if (dy > 10) bar.classList.add("is-hidden");
      if (Math.abs(dy) > 6) lastY = y;
      ticking = false;
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    document.addEventListener("focusin", function (e) { if (bar.contains(e.target)) bar.classList.remove("is-hidden"); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountBelow);
  else mountBelow();
})();
