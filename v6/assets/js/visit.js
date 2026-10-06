/* Visit page (gap plan P2-1): the address, a map that loads only on tap, and a short "tell us you're coming" form whose
   "What's this about?" choice becomes the lead's Intent line, so the lead engine routes it (sell enquiries to the sell desk,
   buyers by price band). One future business number plus this routing replaces a phone line per department. */
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
