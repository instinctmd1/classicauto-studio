/* =========================================================================
   Classic Auto v6: shared helpers (formatting, EMI) + nav behaviour.
   Content rendering never depends on GSAP; motion lives in motion.js.
   ========================================================================= */
(function () {
  "use strict";

  /* money(n): whole rupees in, "₹X.XX Cr" above 1 crore else "₹X.XX L" (mirrors tools/import_stock.py money_short).
     The lakh figure is cut down to two decimals, never rounded up: ₹76,99,999 reads ₹76.99 L, not ₹77 L. */
  function money(n) {
    n = Math.round(Number(n));
    if (n >= 10000000) return ("₹" + (Math.floor(n / 100000) / 100).toFixed(2) + " Cr").replace(".00", "");
    return ("₹" + (Math.floor(n / 1000) / 100).toFixed(2) + " L").replace(".00", "");
  }
  /* rupees(n): Indian digit grouping, "₹25,50,000". */
  function rupees(n) { return "₹" + Math.round(Number(n)).toLocaleString("en-IN"); }

  /* emi(price, downFraction, annualRate, years): reducing-balance, same as build_site.py. */
  function emi(price, downPct, rate, years) {
    downPct = downPct === undefined ? 0.20 : downPct;
    rate = rate === undefined ? 0.115 : rate;
    years = years === undefined ? 5 : years;
    var p = Math.trunc(price) * (1 - downPct), r = rate / 12, n = years * 12;
    if (r === 0) return Math.trunc(p / n);
    var f = Math.pow(1 + r, n);
    return Math.trunc((p * r * f) / (f - 1));
  }

  function formatKm(km) { return Number(km).toLocaleString("en-IN") + " km"; }
  function carLabel(c) { return c.year + " " + c.make + " " + c.model; }
  function carFullLabel(c) { return c.year + " " + c.make + " " + c.model + " " + c.variant; }
  function carLeadLabel(c) { return carFullLabel(c) + " [" + c.id + "]"; }

  var BODY = { hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", mpv: "MPV", "luxury-sedan": "Luxury sedan", "luxury-suv": "Luxury SUV" };
  function bodyLabel(b) { return BODY[b] || b; }
  var BAND = { u20: "Under ₹20 L", "20to50": "₹20-50 L", "50plus": "₹50 L and above" };
  function bandLabel(b) { return BAND[b] || b; }

  function fmtDate(iso) {
    var d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  /* Insurance text computed against today (kept honest as dates pass). */
  function insurance(c) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var note = c.insurance_note ? c.insurance_note + ", " : "";
    if (c.insurance_until) {
      var until = new Date(c.insurance_until + "T00:00:00");
      if (until >= today) return { text: note + "valid till " + fmtDate(c.insurance_until), expired: false, short: "Valid till " + fmtDate(c.insurance_until) };
      return { text: "Expired (" + fmtDate(c.insurance_until) + "), renewal due", expired: true, short: "Renewal due" };
    }
    if (c.insurance_status === "expired") return { text: "Expired (as posted), renewal due", expired: true, short: "Renewal due" };
    return { text: "Not stated", expired: false, short: "Not stated" };
  }

  function transShort(c) { return c.trans_detail || (c.trans === "Automatic" ? "AT" : "MT"); }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  /* Whole months from a "Nov 2025" month to this month (null when the month is missing or unreadable). */
  function monthsSince(monthYear, now) {
    var m = /^([A-Za-z]{3})\w*\s+(\d{4})$/.exec(String(monthYear || "").trim());
    if (!m) return null;
    var mi = MONTHS.indexOf(m[1].charAt(0).toUpperCase() + m[1].slice(1, 3).toLowerCase());
    if (mi < 0) return null;
    now = now || new Date();
    return (now.getFullYear() - (+m[2])) * 12 + (now.getMonth() - mi);
  }
  /* Kilometres a month (cars under a year old) or a year, from km and the registration month. Worked out on every page view so it
     never goes stale. A number only, never a "low km" label: we state the odometer reading as listed, nothing more. */
  function kmRate(c) {
    var m = monthsSince(c.reg_month);
    if (m == null || m < 0 || c.kms == null || !(c.kms > 0)) return null;
    var months = Math.max(1, m);
    if (months < 12) {
      var pm = Math.round(c.kms / months / 10) * 10;
      return { value: pm, per: "month", text: "About " + pm.toLocaleString("en-IN") + " km a month", months: months };
    }
    var py = Math.round(c.kms / months * 12 / 100) * 100;
    return { value: py, per: "year", text: "About " + py.toLocaleString("en-IN") + " km a year", months: months };
  }

  /* "You save" (gap plan P1-4, done our way), one method for every car: our price against TODAY'S NEW EQUIVALENT on the road in
     Mumbai, because a used car's price already includes its registration. `new_price` in data/cars.json names that new car
     (the same model's nearest current variant, else the nearest new car of its class, with the reason), the maker's
     ex-showroom price with its page and the date it was read, and the on-road breakdown: Maharashtra road tax for that fuel
     and price band, registration and smart-card fees, and first-year insurance estimated as a % of ex-showroom. The saving is
     rounded DOWN to the nearest Rs 10,000. Shown only when the figure is under 90 days old, the car is for sale with a price,
     and the saving is at least Rs 50,000; otherwise not at all. The sources for the tax, fees, insurance and TCS rules are
     below, with the date each was read. */
  var NEW_PRICE_MAX_DAYS = 90, NEW_PRICE_MIN_GAP = 50000;
  var ON_ROAD_SOURCES = {
    roadTax: { name: "Maharashtra one-time tax slabs from 1 Jul 2025 (PTI, The Week)", url: "https://www.theweek.in/wire-updates/business/2025/07/01/bom2-mh-vehicles-revised-tax.html", asOf: "2026-10-07" },
    registration: { name: "Central Motor Vehicles Rules, rule 81 fee table: ₹600 registration + ₹200 smart card", url: "https://himachal.gov.in/WriteReadData/l892s/3_l892s/rule81_cmvr-74305708.pdf", asOf: "2026-10-07" },
    insurance: { name: "Spinny guide: comprehensive cover is usually 3 to 4% of the car's value (we use 3%)", url: "https://www.spinny.com/blog/car-price-difference-between-ex-showroom-and-on-road-price/", asOf: "2026-10-07" },
    tcs: { name: "Income-tax Act 2025, section 394(1): 1% TCS on a car over ₹10 lakh", url: "https://cleartax.in/s/section-394-income-tax-act-2025", asOf: "2026-10-07" }
  };
  function newPrice(c) {
    var np = c && c.new_price, o = np && np.on_road;
    if (!np || !(np.ex_showroom > 0) || !/^https:\/\//.test(np.source_url || "") || !np.as_of || !np.source_name || !np.compare_name) return null;
    if (!o || !(o.total > np.ex_showroom) || o.total !== np.ex_showroom + o.road_tax + o.registration + o.insurance) return null;
    if (c.price_on_request || c.price == null || c.status === "SOLD") return null;
    var asOf = new Date(np.as_of + "T00:00:00"), today = new Date(); today.setHours(0, 0, 0, 0);
    var days = (today - asOf) / 86400000;
    if (!(days >= -1 && days <= NEW_PRICE_MAX_DAYS)) return null;
    var diff = o.total - c.price, save = Math.floor(diff / 10000) * 10000;
    if (save < NEW_PRICE_MIN_GAP) return null;
    return { exShowroom: np.ex_showroom, onRoad: o, total: o.total, diff: diff, save: save, compareName: np.compare_name, sameModel: !!np.same_model,
      basis: np.basis || "", area: np.price_area || "India", source: np.source_name, url: np.source_url, asOf: np.as_of, asOfText: fmtDate(np.as_of),
      sources: ON_ROAD_SOURCES };
  }

  /* 1% TCS on a car sold for more than Rs 10 lakh (Income-tax Act s.206C(1F)). Returns the rupee figure, or 0. */
  function tcs(c) { return c && !c.price_on_request && c.price > 1000000 ? Math.round(c.price * 0.01) : 0; }

  /* The car's own Instagram listing post, from its `source` ("ig:<code>"). */
  function igPostUrl(c) { var m = /^ig:([A-Za-z0-9_-]{5,40})$/.exec((c && c.source) || ""); return m ? "https://www.instagram.com/p/" + m[1] + "/" : ""; }

  /* Page title, the same words tools/import_stock.py car_title writes into the static page. */
  function carTitle(c) {
    var name = carFullLabel(c).trim(), price = c.price_on_request || c.price == null ? "Ask for price" : money2(c.price);
    return (c.status === "SOLD" ? "Sold: " + name : "Used " + name + " for sale in Mumbai") + " · " + price + " · Classic Auto, Malad West";
  }
  /* "₹25.50 L": the importer's two-decimal form (money() drops ".00"). */
  function money2(n) { n = Math.round(Number(n)); return n >= 10000000 ? "₹" + (Math.floor(n / 100000) / 100).toFixed(2) + " Cr" : "₹" + (Math.floor(n / 1000) / 100).toFixed(2) + " L"; }

  window.ClassicAuto = {
    money: money, rupees: rupees, emi: emi, formatKm: formatKm,
    carLabel: carLabel, carFullLabel: carFullLabel, carLeadLabel: carLeadLabel,
    bodyLabel: bodyLabel, bandLabel: bandLabel, insurance: insurance, fmtDate: fmtDate, transShort: transShort,
    monthsSince: monthsSince, kmRate: kmRate, newPrice: newPrice, tcs: tcs, igPostUrl: igPostUrl, carTitle: carTitle,
    waLink: function (text) { return window.CA.waLink(text); }
  };

  /* ---------------------------------------------------------------- nav + header */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 24); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  var navToggle = document.querySelector(".nav-toggle");
  var mobileNav = document.querySelector(".mobile-nav");
  var mainEl = document.getElementById("main");
  function setInert(el, on) { if (el) { if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert"); } }
  function setMobileNavOpen(open) {
    mobileNav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    setInert(mainEl, open);
    setInert(document.querySelector(".site-footer"), open);
    if (window.__lenis) { open ? window.__lenis.stop() : window.__lenis.start(); }
  }
  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", function () {
      var open = !mobileNav.classList.contains("is-open");
      setMobileNavOpen(open);
      if (open) { var first = mobileNav.querySelector("a"); if (first) first.focus(); }
    });
    mobileNav.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { setMobileNavOpen(false); }); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mobileNav.classList.contains("is-open")) { setMobileNavOpen(false); navToggle.focus(); }
    });
    window.matchMedia("(min-width: 1080px)").addEventListener("change", function (e) { if (e.matches) setMobileNavOpen(false); });
  }


  /* ---------------------------------------------------------------- CA_SITE binders
     Every contact surface reads window.CA_SITE (rule N2): nothing is hard-coded in markup. */
  function bindSite(root) {
    var CA = window.CA, S = window.CA_SITE;
    if (!CA || !S) return;
    (root || document).querySelectorAll("[data-bind]").forEach(function (el) {
      var kind = el.getAttribute("data-bind");
      var at = el.getAttribute("data-at") || "";
      if (kind === "message-cta") {
        var m = CA.messageCta();
        el.textContent = m.label; el.href = m.href; el.target = "_blank"; el.rel = "noopener";
        el.setAttribute("data-cta", "message"); el.setAttribute("data-via", m.via); if (at) el.setAttribute("data-at", at);
      } else if (kind === "visit-cta") {
        var v = CA.visitCta();
        el.textContent = v.label; el.href = v.href; el.target = "_blank"; el.rel = "noopener";
        el.setAttribute("data-cta", "visit"); el.setAttribute("data-via", "maps");
      } else if (kind === "call-cta") {
        var c = CA.callCta();
        if (!c) { el.hidden = true; } else { el.hidden = false; el.textContent = c.label; el.href = c.href; el.setAttribute("data-cta", "call"); el.setAttribute("data-via", "tel"); }
      } else if (kind === "stock-count") {
        if (S.stock_count) { el.textContent = " " + S.stock_count + " cars on the floor today."; el.hidden = false; } else el.hidden = true;
      } else if (kind === "inspection") {
        if (S.inspection_points) el.textContent = "Every car goes through our " + S.inspection_points + "-point check before it's listed";
      } else if (kind === "address") {
        el.innerHTML = S.address_lines.join("<br>");
      } else if (kind === "hours") {
        if (S.hours) el.textContent = "Open " + S.hours; else el.hidden = true;
      } else if (kind === "ig") {
        el.textContent = S.instagram;
      } else if (kind === "since") {
        el.textContent = S.since;
      } else if (kind === "address-inline") {
        el.textContent = S.address_lines.join(", ");
      } else if (kind === "contact-line") {
        var t = "message us on Instagram @" + S.instagram;
        if (S.whatsapp) t += ", message us on WhatsApp";
        if (S.phone) t += ", or call " + S.phone;
        el.textContent = t;
      } else if (kind === "years") {
        var yrs = new Date().getFullYear() - S.since;
        el.textContent = yrs;
        if (el.hasAttribute("data-count")) el.setAttribute("data-count", String(yrs));
      } else if (kind === "igposts") {
        el.textContent = Number(S.ig_posts).toLocaleString("en-IN");
      } else if (kind === "igdate") {
        el.textContent = new Date(S.ig_as_of + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      }
    });
  }
  window.ClassicAuto.bindSite = bindSite;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { bindSite(); }); else bindSite();

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  });
})();
