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
  document.title = fmt.carTitle(car);
  var md = document.querySelector('meta[name="description"]');
  if (md) md.setAttribute("content", car.year + " " + car.make + " " + car.model + ", " + fmt.formatKm(car.kms) + ", " + car.owners + " owner, " + car.fuel.toLowerCase() + " " + car.trans.toLowerCase() + ". " + priceText + " at Classic Auto, Malad West, Mumbai.");

  /* ---- sticky Message button carries the car ---- */
  var stickyMsg = "Hi Classic Auto, I'm interested in the " + label + " (" + priceText + "). " + pageUrl;
  if (window.CA.setStickyMessage) window.CA.setStickyMessage(stickyMsg);
  else document.addEventListener("DOMContentLoaded", function () { if (window.CA.setStickyMessage) window.CA.setStickyMessage(stickyMsg); });

  /* ---- heading block ---- */
  var crumbMake = f("crumbMake");
  crumbMake.textContent = car.make; crumbMake.href = window.CA.root("stock.html?make=" + encodeURIComponent(car.make));
  set("crumb", car.model + " (" + car.year + ")");
  var shareBtn = f("shareBtn");
  if (car.status === "SOLD") shareBtn.hidden = true; else shareBtn.setAttribute("data-share", car.id);
  set("badge", (car.status === "SOLD" ? "Sold · " : "") + fmt.bodyLabel(car.body) + (S.park_and_sell_badge && car.segment === "park_sell" ? " · Park & Sell" : ""));
  set("title", car.make + " " + car.model);
  set("variant", car.variant + " · " + car.reg_month);
  var priceEl = f("price"); priceEl.textContent = onRequest ? "Ask for price" : fmt.rupees(car.price);
  if (!onRequest) set("priceAlt", fmt.money(car.price));

  /* ---- new-car comparison: only with the maker's own figure for the same variant, dated and sourced (main.js newPrice) ---- */
  var np = fmt.newPrice(car);
  if (np) {
    var nc = f("newCompare");
    nc.innerHTML =
      '<div class="nc-row"><span class="nc-k">New: approx. ex-showroom</span><span class="nc-v">' + fmt.money(np.price) + '</span></div>' +
      '<div class="nc-row nc-save"><span class="nc-k">You save approx.</span><span class="nc-v">' + fmt.money(np.save) + '</span></div>' +
      '<p class="nc-note">Approximate. The new figure is the maker\'s listed ex-showroom price for the same variant' + (np.variant ? " (" + cardsApi.esc(np.variant) + ")" : "") +
      ', from the <a href="' + cardsApi.esc(np.url) + '" target="_blank" rel="noopener">' + cardsApi.esc(np.source) + '</a>, read on ' + np.asOfText +
      '. A new car also needs road tax, registration and insurance on top of that price.</p>';
    nc.hidden = false;
  }
  var chips = [["Owner", car.owners], ["Driven", fmt.formatKm(car.kms)], ["Registered", car.reg_month]];
  f("chips").innerHTML = chips.map(function (c) { return '<div class="chip"><span>' + c[0] + '</span><b>' + cardsApi.esc(c[1]) + '</b></div>'; }).join("");
  var emiEl = f("emiLine");
  if (onRequest) emiEl.hidden = true;
  else emiEl.innerHTML = 'EMI from <strong>' + fmt.rupees(fmt.emi(car.price)) + '</strong>/mo* <span>(20% down, 60 months, 11.5% a year assumed. Change it in step 1.)</span>';

  /* ---- gallery ---- */
  var photos = car.photos && car.photos.length ? car.photos : null;
  var img = f("image"), hero = f("hero"), current = 0;
  function showPhoto(i) {
    current = (i + photos.length) % photos.length;
    if (current === 0) img.setAttribute("fetchpriority", "high");
    img.src = window.CA.root(photos[current]); img.alt = fmt.carLabel(car) + ", " + car.colour.toLowerCase() + ", photo " + (current + 1) + " of " + photos.length;
    var thumbsEl = f("thumbs");
    thumbsEl.querySelectorAll("button").forEach(function (x, k) { x.classList.toggle("is-active", k === current); x.setAttribute("aria-current", k === current ? "true" : "false"); });
    var cnt = hero.querySelector(".gallery-count"); if (cnt) cnt.textContent = (current + 1) + " / " + photos.length;
  }
  if (photos) {
    showPhoto(0);
    img.style.viewTransitionName = "car-" + car.id;
    var thumbs = f("thumbs");
    if (photos.length > 1) {
      thumbs.innerHTML = photos.map(function (p, i) { return '<button type="button" class="' + (i === 0 ? "is-active" : "") + '" data-i="' + i + '" aria-label="Photo ' + (i + 1) + ' of ' + photos.length + '"><img src="' + window.CA.root(p) + '" alt="" width="76" height="52" loading="lazy" decoding="async"></button>'; }).join("");
      thumbs.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) showPhoto(+b.getAttribute("data-i")); });
      /* arrows, a "1 / 18" counter, swipe and the arrow keys: built for the 15+ photo walk-around sets (gap plan P1-1) */
      hero.insertAdjacentHTML("beforeend",
        '<button type="button" class="gallery-nav gallery-prev" aria-label="Previous photo"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
        '<button type="button" class="gallery-nav gallery-next" aria-label="Next photo"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>' +
        '<span class="gallery-count" aria-live="polite">1 / ' + photos.length + '</span>');
      hero.querySelector(".gallery-prev").addEventListener("click", function () { showPhoto(current - 1); });
      hero.querySelector(".gallery-next").addEventListener("click", function () { showPhoto(current + 1); });
      hero.setAttribute("tabindex", "0"); hero.setAttribute("aria-label", "Photos: use the arrow keys to move between them");
      hero.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { e.preventDefault(); showPhoto(current - 1); }
        if (e.key === "ArrowRight") { e.preventDefault(); showPhoto(current + 1); }
      });
      var sx = null, sy = null;   // a horizontal swipe changes the photo; a vertical one still scrolls the page (N8)
      hero.addEventListener("touchstart", function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
      hero.addEventListener("touchend", function (e) {
        if (sx == null) return;
        var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) showPhoto(current + (dx < 0 ? 1 : -1));
      }, { passive: true });
    } else { thumbs.hidden = true; $(".car-gallery").classList.add("is-solo"); }
  } else {
    hero.classList.add("is-placeholder");
    hero.innerHTML = '<div><span class="ph-label">' + cardsApi.esc(car.make) + '<br>' + cardsApi.esc(car.model) + '</span><span class="ph-note">Photos on request</span></div>';
    f("thumbs").hidden = true; $(".car-gallery").classList.add("is-solo");
  }

  /* ---- walk-around video (gap plan P1-2): a poster and a play button. The player loads only on tap, so a visit makes no
     third-party request (B1-A2). YouTube plays in place (privacy-enhanced domain, phone-shaped for Shorts); an Instagram reel
     opens on Instagram, which allows no clean embed without its script. The importer only lets through a single-video link. ---- */
  var vid = car.video || "", ytm = /youtube\.com\/(?:watch\?v=|shorts\/)([A-Za-z0-9_-]{11})/.exec(vid), igv = /^https:\/\/www\.instagram\.com\/(reel|p)\/[A-Za-z0-9_-]+\/$/.test(vid);
  if (ytm || igv) {
    var slot = f("videoSlot"), vertical = /\/shorts\//.test(vid) || igv;
    var poster = photos ? '<img src="' + window.CA.root(photos[0]) + '" alt="" width="1110" height="700" loading="lazy" decoding="async">' : "";
    var play = '<span class="video-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>';
    slot.innerHTML = ytm
      ? '<button type="button" class="video-facade" data-cta="video" data-at="car_page"><span class="video-thumb">' + poster + play + '</span><span class="video-label"><b>Watch the walk-around</b><small>Plays here. Loads YouTube only when you tap.</small></span></button>'
      : '<a class="video-facade" href="' + cardsApi.esc(vid) + '" target="_blank" rel="noopener" data-cta="video" data-at="car_page"><span class="video-thumb">' + poster + play + '</span><span class="video-label"><b>Watch the walk-around</b><small>Opens the reel on Instagram.</small></span></a>';
    slot.hidden = false;
    if (ytm) slot.querySelector("button").addEventListener("click", function () {
      var src = "https://www.youtube-nocookie.com/embed/" + ytm[1] + "?autoplay=1&playsinline=1&rel=0&modestbranding=1";
      slot.innerHTML = '<div class="video-frame' + (vertical ? " is-vertical" : "") + '"><iframe src="' + src + '" title="Walk-around video: ' + cardsApi.esc(fmt.carLabel(car)) +
        '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
    });
  }

  /* ---- the honest line under the photo, plus the car's own Instagram listing post (gap plan P0-4) ---- */
  var ig = fmt.igPostUrl(car), note = f("photoNote");
  var photoLine = photos && photos.length > 1 ? "" : (car.source && /^ig:/.test(car.source) ? "Photo from our Instagram listing. " : "");
  note.innerHTML = cardsApi.esc(photoLine) +
    (ig ? '<a class="text-link" href="' + ig + '" target="_blank" rel="noopener">See this car\'s post on Instagram</a>. ' : "") +
    (ytm || igv ? "" : "Ask us for a walk-around video.");

  /* ---- "This car": what our listing and the car's papers say. Empty rows are left out, never shown as "N/A" ---- */
  var rate = fmt.kmRate(car);
  var specs = [
    ["Year", car.year], ["Registered", car.reg_month], ["Made", car.mfg_month], ["Driven", fmt.formatKm(car.kms)],
    ["Use", rate ? rate.text : ""], ["Fuel", car.fuel],
    ["Gearbox", car.trans + " (" + fmt.transShort(car) + ")"], ["Owner", car.owners], ["Colour", car.colour],
    ["RTO", car.rto || "On request"], ["Registration", car.reg_type], ["Insurance", ins.text, ins.expired ? "warn" : ""],
    ["Seats", car.seats], ["Keys", car.keys ? car.keys + (car.keys === 1 ? " key" : " keys") : ""],
    ["Last service", car.service_last ? [car.service_last.date ? fmt.fmtDate(car.service_last.date) : "", car.service_last.km ? fmt.formatKm(car.service_last.km) : ""].filter(Boolean).join(", ") : ""],
    ["Service book", car.service_book === true ? "Yes" : car.service_book === false ? "No" : ""]
  ].filter(function (s) { return s[1] !== "" && s[1] != null; });
  function specHTML(list) { return list.map(function (s) { return '<div class="spec-item"><span class="k">' + cardsApi.esc(s[0]) + '</span><span class="v ' + (s[2] || "") + '">' + cardsApi.esc(s[1]) + '</span></div>'; }).join(""); }
  f("specs").innerHTML = specHTML(specs);
  if (car.features && car.features.length) {
    f("featuresWrap").hidden = false;
    f("features").innerHTML = car.features.map(function (t) { return '<li>' + cardsApi.esc(t) + '</li>'; }).join("");
  }

  /* ---- "This model": brochure facts from the maker's own pages, each source linked and dated (assets/js/model-specs.js) ---- */
  var spec = (window.MODEL_SPECS || []).filter(function (m) {
    var v = String(car.variant || "").toLowerCase();
    return m.make === car.make && m.model === car.model && car.year >= m.from && car.year <= m.to && (!m.fuel || m.fuel === car.fuel) &&
      (m.variant_has || []).every(function (w) { return v.indexOf(String(w).toLowerCase()) > -1; });
  })[0];
  if (spec) {
    f("modelWrap").hidden = false;
    set("modelLabel", spec.label + ", as published by the maker");
    f("modelSpecs").innerHTML = specHTML(spec.rows);
    f("modelSource").innerHTML = "Source" + (spec.sources.length > 1 ? "s" : "") + ": " + spec.sources.map(function (s) {
      return '<a class="text-link" href="' + cardsApi.esc(s.url) + '" target="_blank" rel="noopener">' + cardsApi.esc(s.name) + '</a> (read ' + fmt.fmtDate(s.as_of) + ')';
    }).join("; ") + ". These are the maker's figures for the model, not measurements of this car.";
  }

  /* ---- "What you'll pay to drive away" (gap plan P1-5): every item listed, no total that hides one ---- */
  (function () {
    var lines = [], notes = [];
    function line(k, v, cls) { lines.push('<div' + (cls ? ' class="' + cls + '"' : "") + '><dt>' + k + '</dt><dd>' + v + '</dd></div>'); }
    if (onRequest) line("Price", "Ask us");
    else line("Asking price", fmt.rupees(car.price));
    var t = fmt.tcs(car);
    if (t) {
      line("TCS, 1% on cars over ₹10 lakh", "About " + fmt.rupees(t));
      notes.push("TCS (tax collected at source) is collected against your PAN and counts as income tax you have already paid.");
    }
    var fee = S.rc_transfer_fee;
    line("RC transfer fee", fee ? fmt.rupees(fee) : "We'll confirm it");
    line("Insurance", ins.expired ? "Renewal due: budget for a new policy" : ins.text === "Not stated" ? "Not stated: ask us" : cardsApi.esc(ins.text.charAt(0).toUpperCase() + ins.text.slice(1)), ins.expired ? "is-warn" : "");
    if (!ins.expired && ins.text !== "Not stated") notes.push("A valid policy is transferred to the new owner's name along with the RC.");
    if (ins.expired) notes.push("See the insurance estimate below for a rough yearly figure.");
    if (car.rto && !/^MH-/.test(car.rto)) notes.push("This car is registered outside Maharashtra (" + car.rto + "). Kept in Maharashtra, it has to be re-registered here, which has its own road tax and fees. Ask us for the figure.");
    f("payLines").innerHTML = lines.join("");
    if (!onRequest) {
      var tot = f("payTotal");
      tot.innerHTML = "Price" + (t ? " and TCS" : "") + ": <strong>" + fmt.rupees(car.price + t) + "</strong>" + (fee ? ", plus " + fmt.rupees(fee) + " RC transfer" : ", plus the RC transfer fee");
      tot.hidden = false;
    }
    set("payNote", notes.join(" ") + (notes.length ? " " : "") + "Ask us for the exact figures for this car before you decide.");
  })();
  if (car.includes && car.includes.length) {
    f("includesWrap").hidden = false;
    f("includes").innerHTML = car.includes.map(function (t) { return '<li><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><span>' + cardsApi.esc(t) + '</span></li>'; }).join("");
  }

  /* ---- sale terms (gap plan P2-6): only when the stock sheet sets them; a fixed-price car takes no offers ---- */
  var terms = car.sale_terms || [], fixed = terms.indexOf("fixed_price") > -1;
  if (terms.length) {
    var st = f("saleTerms");
    st.textContent = [terms.indexOf("as_is") > -1 ? "Sold as is: what you see on the visit is what you get." : "", fixed ? "Fixed price: this car's price is not open to offers." : ""].filter(Boolean).join(" ");
    st.hidden = false;
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
    if (onRequest || fixed) { openBtn.hidden = true; return; }
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
