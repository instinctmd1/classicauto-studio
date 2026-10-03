/* Car page, laid out like a product page: gallery left; title, price, chips,
   "1. How you'll pay", "2. Book" and ONE dominant button right. Renders from
   window.CARS (?id=). Every submit goes through the shared lead contract with
   the intent encoded in the first line of `message` (see config.js). */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAuto || !window.CAForms) return;
  var fmt = window.ClassicAuto, F = window.CAForms, cardsApi = window.ClassicAutoCards, S = window.CA_SITE;
  var id = window.CA_CAR_ID || new URLSearchParams(window.location.search).get("id");
  var car = CARS.filter(function (c) { return c.id === id; })[0];
  var foundEl = document.getElementById("carFound"), missEl = document.getElementById("carNotFound");

  function $(sel, root) { return (root || document).querySelector(sel); }
  function f(name) { return $('[data-f="' + name + '"]'); }
  function set(name, text) { var el = f(name); if (el) el.textContent = text; }

  if (!car) {
    foundEl.hidden = true; missEl.hidden = false;
    document.title = "Car not found: Classic Auto";
    return;
  }
  missEl.hidden = true; foundEl.hidden = false;

  var onRequest = car.price_on_request || car.price == null;
  var priceText = onRequest ? "Ask for price" : fmt.money(car.price);
  var label = fmt.carFullLabel(car);
  var ins = fmt.insurance(car);
  var pageUrl = window.location.origin && window.location.origin !== "null" ? window.location.href.split("#")[0] : "car.html?id=" + car.id;

  /* ---- head / meta ---- */
  document.title = label + " · " + priceText + " · Classic Auto, Malad West";
  var md = document.querySelector('meta[name="description"]');
  if (md) md.setAttribute("content", car.year + " " + car.make + " " + car.model + ", " + fmt.formatKm(car.kms) + ", " + car.owners + " owner, " + car.fuel.toLowerCase() + " " + car.trans.toLowerCase() + ". " + priceText + " at Classic Auto, Malad West, Mumbai.");

  /* ---- sticky Message button carries the car ---- */
  var stickyMsg = "Hi Classic Auto, I'm interested in the " + label + " (" + priceText + "). " + pageUrl;
  if (window.CA.setStickyMessage) window.CA.setStickyMessage(stickyMsg);
  else document.addEventListener("DOMContentLoaded", function () { if (window.CA.setStickyMessage) window.CA.setStickyMessage(stickyMsg); });

  /* ---- heading block ---- */
  set("crumb", fmt.carLabel(car));
  set("badge", (car.status === "SOLD" ? "Sold · " : "") + fmt.bodyLabel(car.body) + (S.park_and_sell_badge && car.segment === "park_sell" ? " · Park & Sell" : ""));
  set("title", car.make + " " + car.model);
  set("variant", car.variant + " · " + car.reg_month);
  var priceEl = f("price"); priceEl.textContent = onRequest ? "Ask for price" : fmt.rupees(car.price);
  if (!onRequest) set("priceAlt", fmt.money(car.price));
  var chips = [["Owner", car.owners], ["Driven", fmt.formatKm(car.kms)], ["Registered", car.reg_month]];
  f("chips").innerHTML = chips.map(function (c) { return '<div class="chip"><span>' + c[0] + '</span><b>' + cardsApi.esc(c[1]) + '</b></div>'; }).join("");
  var emiEl = f("emiLine");
  if (onRequest) emiEl.hidden = true;
  else emiEl.innerHTML = 'EMI from <strong>' + fmt.rupees(fmt.emi(car.price)) + '</strong>/mo* <span>(20% down, 60 months, 11.5% a year assumed. Change it in step 1.)</span>';

  /* ---- gallery ---- */
  var photos = car.photos && car.photos.length ? car.photos : null;
  var img = f("image"), hero = f("hero");
  function showPhoto(i) { if (i === 0) img.setAttribute("fetchpriority", "high"); img.src = window.CA.root(photos[i]); img.alt = fmt.carLabel(car) + ", " + car.colour.toLowerCase() + ", photo " + (i + 1); }
  if (photos) {
    showPhoto(0);
    img.style.viewTransitionName = "car-" + car.id;
    var thumbs = f("thumbs");
    if (photos.length > 1) {
      thumbs.innerHTML = photos.map(function (p, i) { return '<button type="button" class="' + (i === 0 ? "is-active" : "") + '" data-i="' + i + '" aria-label="Photo ' + (i + 1) + '"><img src="' + window.CA.root(p) + '" alt="" width="76" height="52"></button>'; }).join("");
      thumbs.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        thumbs.querySelectorAll("button").forEach(function (x) { x.classList.remove("is-active"); });
        b.classList.add("is-active"); showPhoto(+b.getAttribute("data-i"));
      });
    } else { thumbs.hidden = true; $(".car-gallery").classList.add("is-solo"); }
  } else {
    hero.classList.add("is-placeholder");
    hero.innerHTML = '<div><span class="ph-label">' + cardsApi.esc(car.make) + '<br>' + cardsApi.esc(car.model) + '</span><span class="ph-note">Photos on request</span></div>';
    f("thumbs").hidden = true; $(".car-gallery").classList.add("is-solo");
  }

  /* ---- spec grid ---- */
  var specs = [
    ["Year", car.year], ["Registered", car.reg_month], ["Driven", fmt.formatKm(car.kms)], ["Fuel", car.fuel],
    ["Gearbox", car.trans + " (" + fmt.transShort(car) + ")"], ["Owner", car.owners], ["Colour", car.colour],
    ["RTO", car.rto || "On request"], ["Insurance", ins.text, ins.expired ? "warn" : ""]
  ];
  if (car.seats) specs.push(["Seats", car.seats]);
  f("specs").innerHTML = specs.map(function (s) { return '<div class="spec-item"><span class="k">' + s[0] + '</span><span class="v ' + (s[2] || "") + '">' + cardsApi.esc(s[1]) + '</span></div>'; }).join("");
  if (car.includes && car.includes.length) {
    f("includesWrap").hidden = false;
    f("includes").innerHTML = car.includes.map(function (t) { return '<li><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><span>' + cardsApi.esc(t) + '</span></li>'; }).join("");
  }

  /* ---- reserve section ---- */
  var rsv = S.reserve || {};
  if (rsv.enabled && rsv.payment_link && rsv.amount && rsv.terms_url) {
    f("payWrap").hidden = false;
    var pb = f("payBtn"); pb.href = rsv.payment_link; pb.textContent = "Pay refundable token " + fmt.rupees(rsv.amount);
    f("termsLink").href = rsv.terms_url; set("reserveNote", "A refundable token holds the car. Read the refund terms first.");
  }

  /* ---- forms: extras + licence toggling ---- */
  var carForm = $("#carForm"), reserveForm = $("#reserveForm");
  carForm.querySelector("[data-extras]").innerHTML = F.extrasHTML("bk", { licence: true });
  reserveForm.querySelector("[data-extras]").innerHTML = F.extrasHTML("rs");
  var licenceField = carForm.querySelector("[data-licence]");

  var dateEl = $("#bkDate"); dateEl.min = F.todayISO();
  var slots = F.buildSlots($("#bkSlots"), function () { F.clearError($("#bkSlots")); });
  $("#bkNote").textContent = slots.note;
  $("#exTarget").value = label;

  var state = { pay: "full", book: "test-drive" };
  var mainBtn = $("#mainBtn"), statusEl = $("#carStatus");
  var panels = { emi: $('[data-panel="emi"]'), exchange: $('[data-panel="exchange"]') };

  function syncUi() {
    panels.emi.hidden = state.pay !== "emi" || onRequest;
    panels.exchange.hidden = state.pay !== "exchange";
    var td = state.book === "test-drive";
    licenceField.hidden = !td || state.pay === "exchange";
    if (state.pay === "exchange") { mainBtn.textContent = "Send exchange details"; mainBtn.setAttribute("data-cta", "exchange"); }
    else if (td) { mainBtn.textContent = "Request a test drive"; mainBtn.setAttribute("data-cta", "book_test_drive"); }
    else { mainBtn.textContent = "Request a visit"; mainBtn.setAttribute("data-cta", "book_test_drive"); }
  }
  carForm.addEventListener("change", function (e) {
    if (e.target.name === "pay") { state.pay = e.target.value; syncUi(); if (e.target.value === "emi" && window.CA_TRACK) window.CA_TRACK("cta_click", { cta: "emi", at: "car_page" }); }
    if (e.target.name === "book") { state.book = e.target.value; syncUi(); }
  });
  if (onRequest) {
    var emiOpt = carForm.querySelector('input[value="emi"]'); if (emiOpt) emiOpt.closest("label").hidden = true;
    mainBtn.setAttribute("data-price-request", "1");
  }
  syncUi();

  /* ---- EMI calculator ---- */
  var downEl = $("#downPct"), tenEl = $("#tenure"), rateEl = $("#ratePct"), out = $("#emiResult");
  var emiUsed = false;
  function calc() {
    var dp = +downEl.value, mo = +tenEl.value, rate = parseFloat(rateEl.value);
    if (!(rate >= 0)) rate = 11.5;
    $("#downPctOut").textContent = dp + "%"; $("#tenureOut").textContent = mo + " months";
    if (!onRequest) out.textContent = fmt.rupees(fmt.emi(car.price, dp / 100, rate / 100, mo / 12)) + "/mo";
  }
  [downEl, tenEl, rateEl].forEach(function (el) {
    el.addEventListener("input", function () {
      calc();
      if (!emiUsed) { emiUsed = true; if (window.CA_TRACK) window.CA_TRACK("emi_calc_used", { tenure: +tenEl.value, down: Math.round(+downEl.value / 10) * 10 }); }
    });
  });
  calc();
  function emiSummary() { return "EMI, " + downEl.value + "% down, " + tenEl.value + " months, " + rateEl.value + "% assumed (" + out.textContent + ")"; }

  /* ---- estimates: insurance range + loan eligibility (v5's logic, restyled). Planning numbers only: never a quote, an offer or a lender's rate ---- */
  var INS = { idv: 0.9, low: 0.02, high: 0.04 };   // insured value about 90% of the asking price; comprehensive cover about 2% to 4% of it a year
  var FOIR = 0.5;                                   // about half of take-home income can go to EMIs, minus the EMIs already paid
  function approx(n) { n = Math.max(0, Math.round(n / 100) * 100); return n >= 100000 ? fmt.money(n) : fmt.rupees(n); }
  function pct(x) { return Math.round(x * 1000) / 10 + "%"; }
  if (car.status === "SOLD") $("#estimates").hidden = true;
  set("insNow", ins.text === "Not stated" ? "Current policy on this car: not stated in the listing. Ask us." : "Current policy on this car: " + ins.text + ".");
  if (onRequest) {
    f("insResult").hidden = true; f("insLines").hidden = true;
    set("insNow", f("insNow").textContent + " The price is on request, so message us for an insurance estimate.");
  } else {
    var idv = car.price * INS.idv;
    set("insRange", approx(idv * INS.low) + " to " + approx(idv * INS.high));
    set("insIdv", "About " + approx(idv) + " (" + pct(INS.idv) + " of the asking price)");
    set("insRate", pct(INS.low) + " to " + pct(INS.high) + " of that value a year");
  }

  var eIncome = $("#eligIncome"), eExisting = $("#eligExisting"), eRate = $("#eligRate"), eTenure = $("#eligTenure"), eAmt = $("#eligAmt"), eNote = $("#eligCompare");
  var defaultRate = parseFloat(eRate.getAttribute("value")) || 11.5;
  function eligCalc() {
    var income = parseFloat(eIncome.value) || 0, existing = Math.max(0, parseFloat(eExisting.value) || 0), rate = parseFloat(eRate.value), n = +eTenure.value;
    if (!(rate >= 0)) rate = defaultRate;
    if (!(income > 0)) { eAmt.textContent = "-"; eNote.textContent = "Add your monthly take-home income to see a rough figure."; return; }
    var free = Math.max(0, income * FOIR - existing), r = rate / 1200, k = Math.pow(1 + r, n);
    var loan = Math.floor((r === 0 ? free * n : free * (k - 1) / (r * k)) / 1000) * 1000;
    eAmt.textContent = approx(loan);
    if (free <= 0) { eNote.textContent = "The EMIs you already pay take up about half your income, so a lender may not offer a new loan on these numbers."; return; }
    var at = "At an EMI of about " + fmt.rupees(Math.round(free / 100) * 100) + " a month over " + n / 12 + " years. ";
    if (onRequest) eNote.textContent = at + "Ask us for this car's price to compare.";
    else if (loan >= car.price) eNote.textContent = at + "On these numbers a loan could cover this car's price of " + fmt.rupees(car.price) + ". The lender sets the final amount and down payment.";
    else eNote.textContent = at + "This car is " + fmt.rupees(car.price) + ", so the rest, about " + approx(car.price - loan) + ", would be your down payment.";
  }
  [eIncome, eExisting, eRate, eTenure].forEach(function (el) { el.addEventListener("input", eligCalc); el.addEventListener("change", eligCalc); });
  // one assumed rate on the page: the EMI calculator in step 1 and the eligibility check follow each other
  eRate.addEventListener("input", function () { rateEl.value = eRate.value; calc(); });
  rateEl.addEventListener("input", function () { eRate.value = rateEl.value; eligCalc(); });

  var estMsg = f("estMsg"), estVisit = f("estVisit"), estChat = f("estChat"), mCta = window.CA.messageCta(), vCta = window.CA.visitCta();
  var finText = "Hi Classic Auto, I'd like help with insurance and a car loan for the " + label + " (" + priceText + "). " + pageUrl;
  estMsg.textContent = mCta.label; estMsg.href = S.whatsapp ? window.CA.waLink(finText) : mCta.href;
  estMsg.setAttribute("data-ca-msg", finText); estMsg.setAttribute("data-via", mCta.via);
  estVisit.textContent = vCta.label; estVisit.href = vCta.href;
  if (!(S.features && S.features.anita)) estChat.hidden = true;
  estChat.addEventListener("click", function () {
    var l = document.getElementById("anitaLauncher");
    if (l && l.getAttribute("aria-expanded") !== "true") l.click();
  });

  /* ---- validation ---- */
  var baseRules = { bkName: F.req("Enter your name."), bkPhone: F.phone };
  var bookRules = { bkDate: F.req("Pick a date.") };
  var exRules = {
    exMake: F.req("Enter the make."), exModel: F.req("Enter the model."),
    exYear: function (el) { var y = +el.value, max = new Date().getFullYear() + 1; return y >= 1990 && y <= max ? true : "Enter a year between 1990 and " + max + "."; },
    exKm: function (el) { return el.value !== "" && +el.value >= 0 ? true : "Enter the kilometres."; }
  };
  var licRule = { bkLicence: function (el) { return el.checked ? true : "Please confirm this to request a test drive."; } };
  function activeRules() {
    var r = Object.assign({}, baseRules);
    if (state.pay !== "exchange") Object.assign(r, bookRules);
    if (state.pay === "exchange") Object.assign(r, exRules);
    if (state.book === "test-drive" && state.pay !== "exchange") Object.assign(r, licRule);
    return r;
  }
  F.watch(carForm, Object.assign({}, baseRules, bookRules, exRules, licRule));
  var started = {};
  function startTrack(formName) { if (!started[formName]) { started[formName] = true; if (window.CA_TRACK) window.CA_TRACK("form_start", { form: formName }); } }
  carForm.addEventListener("focusin", function () { startTrack(state.pay === "exchange" ? "exchange" : (state.book === "visit" ? "visit" : "test_drive")); });

  function slotString() { return dateEl.value && slots.get() ? F.humanDate(dateEl.value) + ", " + slots.get() : (dateEl.value ? F.humanDate(dateEl.value) : ""); }
  function carLead(over) {
    return Object.assign({
      name: $("#bkName").value.trim(), phone: $("#bkPhone").value.trim(), car: fmt.carLeadLabel(car),
      budget: onRequest ? "" : car.price, visit_at: slotString(), page: "car.html?id=" + car.id + "#buy"
    }, over || {});
  }

  carForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var ok = F.validateAll(carForm, activeRules());
    if (state.pay !== "exchange" && !slots.get()) { F.setError($("#bkSlots"), "Choose a time of day."); ok = false; }
    if (!ok) { F.status(statusEl, "Check the highlighted fields and try again.", "error"); return; }
    var marketing = $("#bkMarketing").checked, parts = [], intent, td = state.book === "test-drive";
    var payLabel = state.pay === "full" ? "full payment" : state.pay === "emi" ? emiSummary() : "exchange";
    if (state.pay === "exchange") {
      intent = "EXCHANGE";
      parts.push(["Exchange", $("#exMake").value.trim() + " " + $("#exModel").value.trim() + " " + $("#exYear").value + ", " + Number($("#exKm").value).toLocaleString("en-IN") + " km" + ($("#exRto").value.trim() ? ", RTO " + $("#exRto").value.trim().toUpperCase() : "")]);
    } else intent = td ? "TEST DRIVE" : "VISIT";
    parts.unshift(["Payment", payLabel]);
    if (state.pay !== "exchange") { parts.push(["Mode", "showroom"]); parts.push(["Slot", slotString()]); }
    var msg = window.CA.buildMessage({ intent: intent, parts: parts, licence: (td && state.pay !== "exchange") ? true : null, marketing: marketing });
    F.send(carForm, statusEl, carLead({ message: msg }),
      intent === "EXCHANGE" ? "Exchange details sent. We'll ask for photos by message." : "Request sent. We'll confirm by message.").then(function (r) {
      if (r && r.ok) { carForm.reset(); slots.reset(); state.pay = "full"; state.book = "test-drive"; syncUi(); rateEl.value = eRate.value; calc(); started = {}; }
    });
  });

  /* Ask for an exact EMI quote (Intent: EMI): needs only name + phone. */
  $("#emiQuoteBtn").addEventListener("click", function () {
    var ok = F.validateAll(carForm, baseRules);
    if (!ok) { F.status(statusEl, "Add your name and mobile number to get an EMI quote.", "error"); return; }
    var msg = window.CA.buildMessage({ intent: "EMI", parts: [["Payment", emiSummary()]], marketing: $("#bkMarketing").checked });
    F.send(carForm, statusEl, carLead({ message: msg, visit_at: "" }), "EMI request sent. We'll message you with an exact quote.");
    if (window.CA_TRACK) window.CA_TRACK("cta_click", { cta: "emi", at: "car_page" });
  });

  /* ---- reserve request (no payment UI unless fully configured) ---- */
  var rsRules = { rsName: F.req("Enter your name."), rsPhone: F.phone };
  F.watch(reserveForm, rsRules);
  reserveForm.addEventListener("focusin", function () { startTrack("reserve"); });
  reserveForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!F.validateAll(reserveForm, rsRules)) { F.status($("#rsStatus"), "Check the highlighted fields and try again.", "error"); return; }
    var note = $("#rsNote").value.trim();
    var msg = window.CA.buildMessage({ intent: "RESERVE", parts: [["Car", fmt.carLabel(car)]], marketing: $("#rsMarketing").checked, text: note });
    F.send(reserveForm, $("#rsStatus"), {
      name: $("#rsName").value.trim(), phone: $("#rsPhone").value.trim(), car: fmt.carLeadLabel(car), message: msg,
      budget: onRequest ? "" : car.price, visit_at: "", page: "car.html?id=" + car.id + "#reserve"
    }, "Reserve request sent. We'll message you to take it forward.").then(function (r) { if (r && r.ok) reserveForm.reset(); });
  });
  $("#reserveJump").addEventListener("click", function () {
    var t = document.getElementById("reserve");
    if (window.CA_MOTION && window.CA_MOTION.scrollTo) window.CA_MOTION.scrollTo(t); else t.scrollIntoView({ behavior: document.documentElement.classList.contains("reduce") ? "auto" : "smooth" });
  });

  /* ---- make an offer (a lead, never an auto-accept) ---- */
  (function () {
    var dlg = $("#offerDialog"), openBtn = $("#offerOpen");
    if (!dlg || !openBtn) return;
    if (onRequest) { openBtn.hidden = true; return; }
    var of = $("#offerForm"), amt = $("#ofAmount"), hintEl = $("#ofAmountHint"), st = $("#ofStatus");
    of.querySelector("[data-extras]").innerHTML = F.extrasHTML("of");
    $("#offerCar").textContent = fmt.carLabel(car); $("#offerAsk").textContent = fmt.rupees(car.price);
    dlg.setAttribute("data-lenis-prevent", "");
    var ofRules = {
      ofAmount: function (el) {
        var v = +el.value;
        if (!(v > 0)) return "Enter your offer.";
        if (v > car.price) return "That is above the asking price of " + fmt.rupees(car.price) + ". Enter an amount at or below it.";
        return true;
      },
      ofName: F.req("Enter your name."), ofPhone: F.phone
    };
    F.watch(of, ofRules);
    amt.addEventListener("input", function () {
      var v = +amt.value;
      if (!(v > 0)) { hintEl.textContent = ""; return; }
      var pct = Math.round(v / car.price * 100);
      hintEl.textContent = fmt.rupees(v) + " (" + fmt.money(v) + "), " + pct + "% of the asking price." + (pct < 70 ? " That is well below asking. We will still pass it on." : "");
    });
    openBtn.addEventListener("click", function () {
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
      if (window.__lenis) window.__lenis.stop();
      if (window.CA_TRACK) window.CA_TRACK("cta_click", { cta: "offer", at: "car_page" });
      amt.focus();
    });
    function close() { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); }
    dlg.addEventListener("close", function () { if (window.__lenis) window.__lenis.start(); openBtn.focus({ preventScroll: true }); });
    $("#offerClose").addEventListener("click", close);
    dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); });   // backdrop click
    of.addEventListener("focusin", function () { startTrack("offer"); });
    of.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!F.validateAll(of, ofRules)) { F.status(st, "Check the highlighted fields and try again.", "error"); return; }
      var v = +amt.value, pct = Math.round(v / car.price * 100);
      var parts = [["Asking", fmt.rupees(car.price)], ["Offer", fmt.rupees(v) + " (" + pct + "% of asking)"]];
      if ($("#ofPay").value) parts.push(["Payment", $("#ofPay").value]);
      var msg = window.CA.buildMessage({ intent: "OFFER", parts: parts, marketing: $("#ofMarketing").checked, text: $("#ofNote").value.trim() });
      F.send(of, st, {
        name: $("#ofName").value.trim(), phone: $("#ofPhone").value.trim(), car: fmt.carLeadLabel(car), message: msg,
        budget: car.price, visit_at: "", page: "car.html?id=" + car.id + "#offer"   /* asking price routes the lead; the offer itself is in the message line */
      }, "Offer sent. We'll review it and message you. It is not accepted until we confirm.").then(function (r) {
        if (r && r.ok) { of.reset(); hintEl.textContent = ""; }
      });
    });
  })();

  /* ---- sold cars: no booking, point at similar ones ---- */
  if (car.status === "SOLD") {
    carForm.querySelectorAll("input,button,select,textarea").forEach(function (el) { el.disabled = true; });
    var ob = $("#offerOpen"); if (ob) ob.hidden = true;
    F.status(statusEl, "This car has sold. See similar cars below, or message us.", "");
  }

  /* ---- studio link ---- */
  var studioLink = document.getElementById("studioLink");
  if (studioLink) studioLink.href = window.CA.root("studio.html?id=" + encodeURIComponent(car.id));

  /* ---- canonical: car.html?id= points at the static page that carries the raw-HTML tags ---- */
  if (!window.CA_CAR_ID) {
    try { var cl = document.createElement("link"); cl.rel = "canonical"; cl.href = new URL("cars/" + encodeURIComponent(car.id) + "/", window.location.href).href; document.head.appendChild(cl); } catch (e) { /* file:// */ }
  }

  /* ---- JSON-LD: Car (no rating or review markup, rule N6). The static page already has its own, written by the importer ---- */
  (function () {
    var ld = document.getElementById("carJsonLd");
    if (!ld || window.CA_CAR_ID) return;
    var abs = function (p) { try { return new URL(p, window.location.href).href; } catch (e) { return p; } };
    var data = {
      "@context": "https://schema.org", "@type": "Car", name: label, brand: { "@type": "Brand", name: car.make }, model: car.model, vehicleConfiguration: car.variant,
      vehicleModelDate: String(car.year), mileageFromOdometer: { "@type": "QuantitativeValue", value: car.kms, unitCode: "KMT" },
      fuelType: car.fuel, vehicleTransmission: car.trans, color: car.colour, numberOfPreviousOwners: parseInt(car.owners, 10) ? parseInt(car.owners, 10) - 1 : undefined,
      itemCondition: "https://schema.org/UsedCondition", image: photos ? photos.map(abs) : undefined
    };
    if (!onRequest) data.offers = { "@type": "Offer", price: car.price, priceCurrency: "INR", availability: car.status === "SOLD" ? "https://schema.org/SoldOut" : "https://schema.org/InStock", url: abs("car.html?id=" + car.id) };
    ld.textContent = JSON.stringify(data);
  })();

  /* ---- similar cars ---- */
  var pool = CARS.filter(function (c) { return c.id !== car.id; });
  var similar = pool.filter(function (c) { return c.body === car.body; }).slice(0, 3);
  [function (c) { return c.make === car.make; }, function () { return true; }].forEach(function (pred) {
    if (similar.length >= 3) return;
    pool.forEach(function (c) { if (similar.length < 3 && similar.indexOf(c) === -1 && pred(c)) similar.push(c); });
  });
  var grid = f("similar");
  grid.innerHTML = similar.map(function (c) { return cardsApi.cardHTML(c); }).join("");
  // car-page.js runs before the animation scripts so the photo and price paint first; motion hooks attach when it is ready
  function whenMotion(fn) {
    if (window.CA_MOTION && window.CA_MOTION.ready) fn(); else document.addEventListener("ca:motion-ready", fn, { once: true });
  }
  whenMotion(function () { if (window.CA_MOTION.revealGrid) window.CA_MOTION.revealGrid(grid); });

  if (window.CA_TRACK) window.CA_TRACK("car_view", { band: car.band, make: car.make, seg: car.segment });
  whenMotion(function () { if (window.CA_MOTION.glints) window.CA_MOTION.glints(document); });
})();
