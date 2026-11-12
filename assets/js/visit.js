/* Visit page (gap plan P2-1): the address, a map that loads only on tap, and a short "tell us you're coming" form whose
   "What's this about?" choice becomes the lead's Intent line, so the lead engine routes it (sell enquiries to the sell desk,
   buyers by price band). One future business number plus this routing replaces a phone line per department. */
/* Call and email, drawn from CA_SITE (config.js) so the numbers live in one place. Runs on its own: it does not need the form scripts. */
(function () {
  "use strict";
  var CA = window.CA, S = window.CA_SITE, list = document.getElementById("visitContact");
  if (!CA || !S || !list) return;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var html = "";
  if (S.phone && CA.telLink()) html += '<li><a href="' + CA.telLink() + '" data-cta="call" data-at="visit_page" data-via="tel"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .8 3a2 2 0 0 1-.5 2L8 10.1a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2-.5c1 .4 2 .7 3 .8a2 2 0 0 1 1.6 2z"/></svg><span><small>Call</small><b>' + esc(S.phone) + '</b></span></a></li>';
  if (S.email && CA.mailLink()) html += '<li><a href="' + CA.mailLink() + '" data-cta="email" data-at="visit_page"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg><span><small>Email</small><b>' + esc(S.email) + '</b></span></a></li>';
  if (html) { list.innerHTML = html; list.hidden = false; }
})();

(function () {
  "use strict";
  var form = document.getElementById("visitForm");
  if (!form || !window.ClassicAutoLeads || !window.CAForms) return;
  var F = window.CAForms, fmt = window.ClassicAuto, $ = function (id) { return document.getElementById(id); };

  /* ---- map: Google Maps loads only when the visitor asks for it (no third-party request on page load, B1-A2) ---- */
  $("mapLoad").addEventListener("click", function () {
    var q = encodeURIComponent((window.CA_SITE.address_lines || []).join(", "));
    $("mapSlot").innerHTML = '<div class="map-frame"><iframe src="https://www.google.com/maps?q=' + q + '&amp;output=embed" title="Map: Classic Auto, Prabhu Plaza, Malad West" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>' +
      '<p class="calc-note" style="margin-top:8px;">Map from Google Maps. <a class="text-link" href="' + window.CA.mapsUrl() + '" target="_blank" rel="noopener">Open it in Google Maps</a> for directions.</p>';
  });

  /* ---- form ---- */
  form.querySelector("[data-extras]").innerHTML = F.extrasHTML("v");
  var carSel = $("vCar");
  if (typeof CARS !== "undefined") CARS.filter(function (c) { return c.status !== "SOLD"; }).forEach(function (c) {
    var o = document.createElement("option"); o.value = c.id; o.textContent = fmt.carFullLabel(c) + (c.price ? " · " + fmt.money(c.price) : ""); carSel.appendChild(o);
  });
  var q = new URLSearchParams(window.location.search);
  if (q.get("car")) carSel.value = q.get("car");
  $("vDate").min = F.todayISO();
  var slots = F.buildSlots($("vSlots"));

  /* topic -> Intent (config.js INTENT_WORDS turns it into plain words for the WhatsApp / Instagram fallback) and the plain sentence
     the engine's text reader understands ("I want to sell my car" goes to the sell desk) */
  var TOPICS = {
    buy: { intent: "VISIT", label: "Buying a car", text: "I'd like to come and see a car." },
    sell: { intent: "SELL", label: "Selling my car", text: "I want to sell my car." },
    exchange: { intent: "EXCHANGE", label: "Exchange", text: "I want to exchange my car for one of yours." },
    finance: { intent: "EMI", label: "Finance or EMI", text: "I'd like help with a car loan." },
    paperwork: { intent: "ENQUIRY", label: "Paperwork or RC transfer", text: "I have a question about paperwork or the RC transfer." },
    other: { intent: "ENQUIRY", label: "Something else", text: "" }
  };
  function topic() { var r = form.querySelector('input[name="vTopic"]:checked'); return r ? r.value : "buy"; }
  function sync() {
    var t = topic();
    $("vCarWrap").hidden = !(t === "buy" || t === "exchange" || t === "finance");
    $("vOwnWrap").hidden = !(t === "sell" || t === "exchange");
  }
  form.addEventListener("change", function (e) { if (e.target.name === "vTopic") sync(); });
  sync();

  var rules = { vName: F.req("Enter your name."), vPhone: F.phone };
  F.watch(form, rules);
  var started = false;
  form.addEventListener("focusin", function () { if (!started) { started = true; if (window.CA_TRACK) window.CA_TRACK("form_start", { form: "visit" }); } });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!F.validateAll(form, rules)) { F.status($("vStatus"), "Check the highlighted fields and try again.", "error"); return; }
    var t = TOPICS[topic()], car = null;
    if (!$("vCarWrap").hidden && carSel.value && typeof CARS !== "undefined") car = CARS.filter(function (c) { return c.id === carSel.value; })[0] || null;
    var when = $("vDate").value ? F.humanDate($("vDate").value) + (slots.get() ? ", " + slots.get() : "") : (slots.get() || "");
    var parts = [["Topic", t.label]];
    if (!$("vOwnWrap").hidden && $("vOwn").value.trim()) parts.push(["Your car", $("vOwn").value.trim()]);
    if (when) parts.push(["Slot", when]);
    var text = [t.text, $("vNote").value.trim()].filter(Boolean).join("\n");
    var msg = window.CA.buildMessage({ intent: t.intent, parts: parts, marketing: $("vMarketing").checked, text: text });
    F.send(form, $("vStatus"), {
      name: $("vName").value.trim(), phone: $("vPhone").value.trim(), car: car ? fmt.carLeadLabel(car) : "", message: msg,
      budget: car && car.price ? car.price : "", visit_at: when, page: "visit.html"
    }, "Sent. We'll confirm by message.").then(function (r) { if (r && r.ok) { form.reset(); slots.reset(); sync(); started = false; } });
  });
})();
