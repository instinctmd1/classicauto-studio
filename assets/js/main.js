/* =========================================================================
   Classic Auto — website-v5 — shared behaviour (nav, formatting, footer). (logic unchanged from v4)
   Adapted from website-v3/assets/js/main.js. Content-rendering: runs
   immediately as a deferred script, never depends on GSAP. Animation is
   optional and queued onto window.__anim, drained by anim-run.js.
   ========================================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     money(n) — Indian Lakh/Crore formatting.
     Mirrors business-lab/website/build_site.py money(): whole rupees in,
     "₹X.XX Cr" above 1 crore else "₹X.XX L", with a trailing ".00"
     stripped (₹20.00 L -> ₹20 L; ₹16.85 L stays ₹16.85 L).
     --------------------------------------------------------------------- */
  function money(n) {
    n = Math.round(Number(n));
    if (n >= 10000000) {
      return ("₹" + (n / 10000000).toFixed(2) + " Cr").replace(".00", "");
    }
    return ("₹" + (n / 100000).toFixed(2) + " L").replace(".00", "");
  }

  /* ---------------------------------------------------------------------
     emi(price, downPct, rate, years) — exact reducing-balance formula from
     business-lab/website/build_site.py emi(). Defaults: 20% down, 11.5%
     p.a., 5-year tenure.
     --------------------------------------------------------------------- */
  function emi(price, downPct, rate, years) {
    downPct = downPct === undefined ? 0.20 : downPct;
    rate = rate === undefined ? 0.115 : rate;
    years = years === undefined ? 5 : years;
    var p = Math.trunc(price) * (1 - downPct);
    var r = rate / 12;
    var n = years * 12;
    if (r === 0) return Math.trunc(p / n);
    var factor = Math.pow(1 + r, n);
    return Math.trunc((p * r * factor) / (factor - 1));
  }

  /* rupees(n) — plain comma-grouped rupee figure (Indian digit grouping),
     used for EMI/month figures which read oddly in Lakh notation.
     Mirrors business-lab/website/build_site.py's own EMI display
     (f"₹{emi(...):,}/month" — plain rupees, not money()). */
  function rupees(n) {
    return "₹" + Math.round(Number(n)).toLocaleString("en-IN");
  }

  function formatKm(km) {
    return Number(km).toLocaleString("en-IN") + " km";
  }

  function waLink(message) {
    return "https://wa.me/" + window.CA_WHATSAPP_NUMBER + "?text=" + encodeURIComponent(message);
  }

  function carLabel(c) {
    return c.year + " " + c.make + " " + c.model;
  }

  function carFullLabel(c) {
    return c.year + " " + c.make + " " + c.model + " " + c.variant;
  }

  window.ClassicAuto = {
    money: money,
    rupees: rupees,
    emi: emi,
    formatKm: formatKm,
    waLink: waLink,
    carLabel: carLabel,
    carFullLabel: carFullLabel,
    WHATSAPP_NUMBER: window.CA_WHATSAPP_NUMBER
  };

  window.__anim = window.__anim || [];

  /* ---------------------------------------------------------------------
     Header scroll state
     --------------------------------------------------------------------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    if (window.scrollY > 24) header.classList.add("is-scrolled");
    else header.classList.remove("is-scrolled");
  }
  if (header) {
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------------------------------------------------------------------
     Mobile nav toggle
     --------------------------------------------------------------------- */
  var navToggle = document.querySelector(".nav-toggle");
  var mobileNav = document.querySelector(".mobile-nav");
  var mainEl = document.getElementById("main");
  var footerEl = document.querySelector(".site-footer");

  function setInert(el, isInert) {
    if (!el) return;
    if (isInert) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }

  function setMobileNavOpen(isOpen) {
    mobileNav.classList.toggle("is-open", isOpen);
    document.body.classList.toggle("nav-open", isOpen);
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    setInert(mainEl, isOpen);
    setInert(footerEl, isOpen);
  }

  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", function () {
      var isOpen = !mobileNav.classList.contains("is-open");
      setMobileNavOpen(isOpen);
      if (isOpen) {
        var firstLink = mobileNav.querySelector("a");
        if (firstLink) firstLink.focus();
      }
    });
    mobileNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setMobileNavOpen(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mobileNav.classList.contains("is-open")) {
        setMobileNavOpen(false);
        navToggle.focus();
      }
    });
  }

  /* ---------------------------------------------------------------------
     Active nav link
     --------------------------------------------------------------------- */
  var currentPage = document.body.getAttribute("data-page");
  if (currentPage) {
    document.querySelectorAll("a[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav") === currentPage) a.setAttribute("aria-current", "page");
    });
  }

  /* ---------------------------------------------------------------------
     Footer year
     --------------------------------------------------------------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------------------------------------------------------------------
     Social links — every [data-social="instagram|facebook|youtube|whatsapp"]
     anchor (header, footer, home "Follow us" strip) gets its href from the
     single window.SOCIAL config object (assets/js/config.js), so the owner
     only ever edits one place. An anchor with no matching entry is hidden.
     --------------------------------------------------------------------- */
  var social = window.SOCIAL || {};
  document.querySelectorAll("[data-social]").forEach(function (a) {
    var key = a.getAttribute("data-social");
    var url = social[key];
    if (url) {
      a.href = url;
    } else {
      a.setAttribute("hidden", "");
    }
  });

  /* ---------------------------------------------------------------------
     Motion — hero/reveal/stagger, queued for anim-run.js.
     --------------------------------------------------------------------- */
  window.__anim.push(function () {
    var gsap = window.gsap;

    var heroEls = document.querySelectorAll("[data-hero-in]");
    if (heroEls.length) {
      gsap.set(heroEls, { y: 26, opacity: 0 });
      gsap.to(heroEls, { y: 0, opacity: 1, duration: 0.7, stagger: 0.09, ease: "power3.out", delay: 0.15 });
    }

    var heroMedia = document.querySelector(".hero-media img");
    if (heroMedia && window.ScrollTrigger) {
      gsap.to(heroMedia, {
        yPercent: 10, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
      });
    }

    var reveals = document.querySelectorAll(".reveal, .reveal-up");
    reveals.forEach(function (el) {
      gsap.set(el, { y: 22, opacity: 0 });
      gsap.to(el, { y: 0, opacity: 1, duration: 0.55, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 88%" } });
    });

    document.querySelectorAll("[data-stagger-group]").forEach(function (group) {
      var items = group.querySelectorAll(".stagger-item");
      if (!items.length) return;
      gsap.set(items, { y: 24, opacity: 0, scale: 0.97 });
      gsap.to(items, {
        y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.06, ease: "back.out(1.4)",
        scrollTrigger: { trigger: group, start: "top 85%" }
      });
    });

    document.querySelectorAll("[data-count]").forEach(function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var suffix = el.getAttribute("data-suffix") || "";
      var decimals = el.getAttribute("data-decimals") ? parseInt(el.getAttribute("data-decimals"), 10) : 0;
      var obj = { val: 0 };
      el.textContent = (0).toFixed(decimals) + suffix;
      gsap.to(obj, {
        val: target, duration: 1.4, ease: "power2.out",
        onUpdate: function () { el.textContent = obj.val.toFixed(decimals) + suffix; },
        scrollTrigger: { trigger: el, start: "top 90%", once: true }
      });
    });
  });
})();
