/* =========================================================================
   Classic Auto — website-v5 — Compare (up to 3) + Shortlist (heart).
   Kept light on purpose: only 15 cars in stock, so this is a convenience,
   not a heavyweight feature. Client-side only, localStorage-backed, works
   the same on every page that renders cards (index/stock/car). Present on
   every page via a fixed bottom-left bar, mirroring Anita's bottom-right
   launcher.
   ========================================================================= */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAuto) return;
  var fmt = window.ClassicAuto;

  var LS_COMPARE = "ca_compare_v1";
  var LS_SHORTLIST = "ca_shortlist_v1";
  var MAX_COMPARE = 3;

  function readList(key) {
    try {
      var v = JSON.parse(window.localStorage.getItem(key) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function writeList(key, list) {
    try { window.localStorage.setItem(key, JSON.stringify(list)); } catch (e) { /* private mode etc. */ }
  }

  var compareIds = readList(LS_COMPARE);
  var shortlistIds = readList(LS_SHORTLIST);

  /* ------------------------------------------------------------------
     Floating bar — count-driven, shared for both lists.
     ------------------------------------------------------------------ */
  var bar = document.createElement("div");
  bar.className = "cs-bar";
  bar.innerHTML =
    '<a class="cs-pill" id="csComparePill" href="compare.html" hidden>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4v16M4 8h6M4 14h10M20 4v16M20 10h-6"/></svg>' +
      '<span>Compare <b id="csCompareCount">0</b></span>' +
    '</a>' +
    '<button type="button" class="cs-pill" id="csShortlistPill" hidden>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20.5s-7.5-4.7-9.8-9.4C.7 7.4 2.4 4 6 4c2 0 3.6 1.1 4.5 2.6C11.4 5.1 13 4 15 4c3.6 0 5.3 3.4 3.8 7.1C16.5 15.8 12 20.5 12 20.5z"/></svg>' +
      '<span>Shortlist <b id="csShortlistCount">0</b></span>' +
    '</button>';
  document.body.appendChild(bar);

  var comparePill = document.getElementById("csComparePill");
  var compareCountEl = document.getElementById("csCompareCount");
  var shortlistPill = document.getElementById("csShortlistPill");
  var shortlistCountEl = document.getElementById("csShortlistCount");

  function updateBar() {
    compareCountEl.textContent = String(compareIds.length);
    comparePill.hidden = compareIds.length === 0;
    shortlistCountEl.textContent = String(shortlistIds.length);
    shortlistPill.hidden = shortlistIds.length === 0;
  }

  /* ------------------------------------------------------------------
     Sync any card controls currently in the DOM to match stored state —
     re-run after every card re-render (filters, featured grid, etc.) via
     a light MutationObserver, so cards.js never has to know this exists.
     ------------------------------------------------------------------ */
  function syncControls() {
    document.querySelectorAll("[data-compare]").forEach(function (el) {
      el.checked = compareIds.indexOf(el.getAttribute("data-compare")) !== -1;
    });
    document.querySelectorAll("[data-shortlist]").forEach(function (btn) {
      var on = shortlistIds.indexOf(btn.getAttribute("data-shortlist")) !== -1;
      btn.setAttribute("aria-pressed", String(on));
    });
  }

  document.addEventListener("change", function (e) {
    var el = e.target.closest && e.target.closest("[data-compare]");
    if (!el) return;
    var id = el.getAttribute("data-compare");
    if (el.checked) {
      if (compareIds.length >= MAX_COMPARE) {
        el.checked = false;
        window.alert("You can compare up to " + MAX_COMPARE + " cars at a time. Remove one first.");
        return;
      }
      if (compareIds.indexOf(id) === -1) compareIds.push(id);
    } else {
      compareIds = compareIds.filter(function (x) { return x !== id; });
    }
    writeList(LS_COMPARE, compareIds);
    updateBar();
  });

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-shortlist]");
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute("data-shortlist");
    var on = shortlistIds.indexOf(id) !== -1;
    if (on) shortlistIds = shortlistIds.filter(function (x) { return x !== id; });
    else shortlistIds.push(id);
    writeList(LS_SHORTLIST, shortlistIds);
    btn.setAttribute("aria-pressed", String(!on));
    updateBar();
  });

  shortlistPill.addEventListener("click", function () {
    var cars = CARS.filter(function (c) { return shortlistIds.indexOf(c.id) !== -1; });
    if (!cars.length) return;
    var lines = ["Hi Classic Auto, I've shortlisted these cars on your site:"];
    cars.forEach(function (c) { lines.push("• " + fmt.carFullLabel(c) + " — " + fmt.money(c.price)); });
    lines.push("Could someone help me take this further?");
    window.open(fmt.waLink(lines.join("\n")), "_blank", "noopener");
  });

  // Cards render asynchronously (filters, featured grid) after this script
  // runs — observe the whole document body and re-sync on any change,
  // cheaply, instead of coupling to every rendering script individually.
  var mo = new MutationObserver(function () { syncControls(); });
  mo.observe(document.body, { childList: true, subtree: true });

  updateBar();
  syncControls();

  window.ClassicAutoCompare = {
    getCompareIds: function () { return compareIds.slice(); },
    getShortlistIds: function () { return shortlistIds.slice(); },
    removeCompare: function (id) {
      compareIds = compareIds.filter(function (x) { return x !== id; });
      writeList(LS_COMPARE, compareIds);
      updateBar();
      syncControls();
    }
  };
})();
