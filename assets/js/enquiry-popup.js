/* =========================================================================
   Classic Auto v6: first-visit enquiry pop-up ("Looking for a particular car?").
   - Shown once per visitor (localStorage, in try/catch: if storage is blocked it is not shown at all, so nobody is nagged on every page),
     about 7 seconds after a first visit to the home page or the stock page, never at once, never while the visitor is typing, a menu or
     another dialog is open, or the tab is in the background.
   - Never on a car page: the photos are the point there, and the page already has its own test-drive, offer and reserve forms.
   - A native <dialog> opened with showModal(): the page behind is inert, Tab stays inside, Esc closes, focus returns to where it was.
   - The consent box is NOT ticked and must be ticked to send (DPDP: consent is a clear action by the visitor). No marketing box:
     "Marketing consent: no" always. Nothing is tracked here beyond what the site's own lead path already records.
   - Sending uses the site's existing lead path exactly (CAForms.send -> ClassicAutoLeads.submitLead, the 7-key contract). With
     CA_ENDPOINT empty that is: copy the message, open the Instagram DM, and show the message in a box (inside this dialog).
   ========================================================================= */
(function () {
  "use strict";
  var page = document.body.getAttribute("data-page") || "";
  if (page !== "home" && page !== "stock") return;
  var KEY = "ca_enquiry_popup_seen", DELAY = 7000;
  var D = document, dlg = null, opener = null;

  function seen() { try { return window.localStorage.getItem(KEY) === "1"; } catch (e) { return true; } }
  function mark() { try { window.localStorage.setItem(KEY, "1"); return true; } catch (e) { return false; } }
  if (seen()) return;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var $ = function (id) { return D.getElementById(id); };

  var CLOSE_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function makesHtml() {
    var seenMake = {}, out = [];
    (window.CARS || []).forEach(function (c) { if (c.make && !seenMake[c.make]) { seenMake[c.make] = 1; out.push(c.make); } });
    return out.sort().map(function (m) { return '<option value="' + esc(m) + '"></option>'; }).join("");
  }

  function build() {
    var photo = "assets/photos/cars/mercedes-benz-s-class-2025/01.webp";
    dlg = D.createElement("dialog");
    dlg.className = "enq";
    dlg.id = "enquiryPopup";
    dlg.setAttribute("aria-labelledby", "enqTitle");
    dlg.setAttribute("data-lenis-prevent", "");
    dlg.innerHTML = window.CA.rootify(
      '<aside class="enq-side on-navy">' +
        '<img class="enq-photo" src="' + photo + '" width="504" height="600" alt="A white Mercedes-Benz S-Class from the Classic Auto floor" decoding="async">' +
        '<div class="enq-side-copy">' +
          '<span class="eyebrow">Looking for a particular car?</span>' +
          '<h2>Tell us. <span>We\'ll find it.</span></h2>' +
          '<p>Name the car you want, or the one you would like to sell or exchange. A real person at Classic Auto replies.</p>' +
          '<span class="enq-side-foot">Since 1974 &middot; Malad West, Mumbai</span>' +
        '</div>' +
      '</aside>' +
      '<div class="enq-main">' +
        '<button type="button" class="enq-close" id="enqClose" aria-label="Close this window">' + CLOSE_ICON + '</button>' +
        '<h3 id="enqTitle">How can we help?</h3>' +
        '<p class="enq-lead">Only your name and mobile number are needed.</p>' +
        '<form id="enqForm" novalidate>' +
          '<div class="form-grid">' +
            '<div class="field"><label for="enqName">Full name <span class="req" aria-hidden="true">*</span></label><input type="text" id="enqName" autocomplete="name" required><span class="field-error" role="alert">Enter your name.</span></div>' +
            '<div class="field"><label for="enqPhone">Mobile number <span class="req" aria-hidden="true">*</span></label><input type="tel" id="enqPhone" autocomplete="tel" inputmode="tel" required><span class="field-error" role="alert">Enter a 10-digit mobile number.</span></div>' +
            '<div class="field"><label for="enqCity">City (optional)</label><input type="text" id="enqCity" autocomplete="address-level2"></div>' +
            '<div class="field"><label for="enqWant">I want to</label><select id="enqWant"><option value="buy">Buy a car</option><option value="sell">Sell my car</option><option value="exchange">Exchange my car</option></select></div>' +
            '<div class="field"><label for="enqCar" id="enqCarLabel">Car or brand you want (optional)</label><input type="text" id="enqCar" list="enqMakes" autocomplete="off" placeholder="e.g. BMW 5 Series"><datalist id="enqMakes">' + makesHtml() + '</datalist></div>' +
          '</div>' +
          '<div class="hp" aria-hidden="true"><label>Leave this field empty<input type="text" id="enqHp" name="company" tabindex="-1" autocomplete="off"></label></div>' +
          '<div class="check-field" data-field>' +
            '<label class="check"><input type="checkbox" id="enqConsent" required><span>I agree that Classic Auto may contact me about this enquiry by phone, WhatsApp or Instagram. <a href="' + 'privacy.html' + '" target="_blank" rel="noopener">Privacy policy</a> <span class="req" aria-hidden="true">*</span></span></label>' +
            '<span class="field-error" role="alert">Tick the box so we know we may contact you.</span>' +
          '</div>' +
          '<div class="form-actions"><button class="btn btn-primary btn-lg" type="submit">Send my enquiry</button><button type="button" class="enq-skip" id="enqSkip">No thanks</button></div>' +
          '<p class="form-status" id="enqStatus" role="status"></p>' +
        '</form>' +
        '<div class="enq-done" id="enqDone" role="status" aria-live="polite"><h3>Thank you</h3><p id="enqDoneMsg"></p><div class="enq-box" id="enqBox"></div><button type="button" class="btn btn-outline" id="enqDoneClose">Close</button></div>' +
      '</div>');
    D.body.appendChild(dlg);

    var F = window.CAForms, form = $("enqForm"), status = $("enqStatus");
    var rules = {
      enqName: F.req("Enter your name."),
      enqPhone: F.phone,
      enqConsent: function (el) { return el.checked ? true : "Tick the box so we know we may contact you."; }
    };
    F.watch(form, rules);

    var want = $("enqWant"), carLabel = $("enqCarLabel"), car = $("enqCar");
    want.addEventListener("change", function () {
      var buy = want.value === "buy";
      carLabel.textContent = buy ? "Car or brand you want (optional)" : "Your car: make, model, year (optional)";
      car.placeholder = buy ? "e.g. BMW 5 Series" : "e.g. Hyundai Creta 2019";
    });

    function close() { if (dlg.open) dlg.close(); }
    $("enqClose").addEventListener("click", close);
    $("enqSkip").addEventListener("click", close);
    $("enqDoneClose").addEventListener("click", close);
    dlg.addEventListener("click", function (e) {      // a click on the dimmed area closes it, unless something has been typed
      if (e.target !== dlg) return;
      var typed = $("enqName").value || $("enqPhone").value || $("enqCity").value || $("enqCar").value;
      if (!typed) close();
    });
    dlg.addEventListener("close", function () {
      if (window.__lenis) window.__lenis.start();
      if (opener && opener.focus && D.contains(opener)) opener.focus({ preventScroll: true });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!F.validateAll(form, rules)) { F.status(status, "Check the highlighted fields and try again.", "error"); return; }
      var mode = want.value, intent = { buy: "CAR REQUEST", sell: "SELL", exchange: "EXCHANGE" }[mode];
      var what = car.value.trim(), city = $("enqCity").value.trim();
      var parts = [["Source", "Enquiry pop-up"], ["Wants to", { buy: "Buy", sell: "Sell", exchange: "Exchange" }[mode]]];
      if (what) parts.push([mode === "buy" ? "Wanted" : "Own car", what]);
      if (city) parts.push(["City", city]);
      var lead = {
        name: $("enqName").value.trim(), phone: $("enqPhone").value.trim(),
        car: (mode === "buy" ? "Wanted: " : mode === "sell" ? "Selling: " : "Exchange: ") + (what || "not said"),
        message: window.CA.buildMessage({ intent: intent, parts: parts, marketing: false }),
        budget: "", visit_at: "", page: page === "stock" ? "stock.html" : "index.html"
      };
      F.send(form, status, lead, "Thank you. We'll message you soon.", { boxHost: $("enqBox") }).then(function (r) {
        if (!r || !r.ok) return;
        $("enqDoneMsg").textContent = status.textContent;
        dlg.classList.add("is-done");
        var b = $("enqBox").querySelector("textarea") || $("enqDoneClose");
        if (b && b.focus) b.focus({ preventScroll: true });
      });
    });
  }

  function open() {
    if (seen()) return;
    if (!mark()) return;                                   // storage blocked: never show
    if (!dlg) build();
    opener = D.activeElement;
    if (window.__lenis) window.__lenis.stop();
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    var first = $("enqName"); if (first) first.focus({ preventScroll: true });
  }

  function busy() {
    var a = D.activeElement, tag = a && a.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (D.querySelector("dialog[open], .mobile-nav.is-open, .anita-panel.is-open, .ca-fallback")) return true;
    return D.body.classList.contains("nav-open");
  }
  var tries = 0;
  function attempt() {
    if (seen()) return;
    if (D.hidden) { D.addEventListener("visibilitychange", function once() { if (!D.hidden) { D.removeEventListener("visibilitychange", once); setTimeout(attempt, 2500); } }); return; }
    if (busy() && tries++ < 8) { setTimeout(attempt, 5000); return; }
    if (!window.CAForms || !window.CA || typeof CARS === "undefined") return;
    open();
  }
  setTimeout(attempt, DELAY);
})();
