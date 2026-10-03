/* =========================================================================
   Find your car: 17 questions -> matching real cars -> a lead.
   Matches are shown BEFORE any contact detail is asked for. The lead goes
   through the shared contract (7 keys); the answers ride in `message` as
   "Intent: ENQUIRY | Source: Find your car quiz | ...".
   ========================================================================= */
(function () {
  "use strict";
  var form = document.getElementById("quizForm");
  if (!form || typeof CARS === "undefined" || !window.CAMatch || !window.CAForms) return;
  var F = window.CAForms, fmt = window.ClassicAuto, M = window.CAMatch, Cards = window.ClassicAutoCards;
  var $ = function (id) { return document.getElementById(id); };
  var LAKH = 100000;

  /* Each question: id, title, hint, multi, options [value,label,sub], apply(prefs, picked[]). */
  var Q = [
    { id: "who", title: "Who is the car mainly for?", opts: [["me", "Mostly me"], ["couple", "Me and my partner"], ["family", "A family with kids"], ["parents", "Parents or grandparents ride often"], ["business", "Work and clients"]],
      apply: function (p, v) { if (v === "business") p.priority = p.priority || "status"; if (v === "parents") p.priority = p.priority || "comfort"; if (v === "family") p.priority = p.priority || "space"; } },
    { id: "people", title: "How many people ride along on a normal day?", opts: [["2", "One or two"], ["4", "Three or four"], ["5", "Five"], ["7", "Six or seven"]],
      apply: function (p, v) { p.seatsMin = v === "2" ? 0 : +v; if (v === "7") p.body = (p.body || []).concat(["mpv", "suv"]); } },
    { id: "where", title: "Where will you drive most?", opts: [["city", "Mumbai city traffic", "Stop and go"], ["mix", "A mix of city and highway"], ["highway", "Highways and outstation"], ["trips", "Long family trips", "Luggage and comfort"]],
      apply: function (p, v) { if (v === "city") p.priority = p.priority || "easy-drive"; if (v === "highway" || v === "trips") p.fuelHint = "Diesel"; } },
    { id: "km", title: "How far do you drive in a month?", opts: [["500", "Under 500 km"], ["1500", "500 to 1,500 km"], ["3000", "1,500 to 3,000 km"], ["3001", "More than 3,000 km"]],
      apply: function (p, v) { if (+v >= 1500) p.fuelHint = "Diesel"; if (+v >= 3000) p.priority = "running-cost"; } },
    { id: "budget", title: "What is your budget?", hint: "Roughly is fine. We'll show cars a little above it too.", opts: [["0-5", "Under ₹5 lakh"], ["5-15", "₹5 to 15 lakh"], ["15-25", "₹15 to 25 lakh"], ["25-50", "₹25 to 50 lakh"], ["50-300", "₹50 lakh and above"]],
      apply: function (p, v) { var r = v.split("-"); p.budgetMin = +r[0] * LAKH * (+r[0] > 0 ? 0.9 : 0); p.budgetMax = +r[1] * LAKH; } },
    { id: "pay", title: "How do you plan to pay?", opts: [["full", "Full payment"], ["emi", "A car loan (EMI)"], ["mix", "Part down payment, part loan"], ["undecided", "Not decided"]],
      apply: function (p, v) { p.pay = v; } },
    { id: "emi", title: "What monthly EMI would feel comfortable?", hint: "Skip ahead if you are paying in full. Our EMI figures are estimates, not offers.", opts: [["0", "Not relevant for me"], ["15000", "Up to ₹15,000"], ["30000", "Up to ₹30,000"], ["60000", "Up to ₹60,000"], ["200000", "More than ₹60,000"]],
      apply: function (p, v) { if (+v > 0 && p.pay !== "full") p.emiMax = +v; } },
    { id: "tradein", title: "Do you have a car to exchange?", opts: [["yes", "Yes, I'd exchange my current car"], ["no", "No"]],
      apply: function (p, v) { p.tradeIn = v === "yes"; } },
    { id: "body", title: "Which body styles do you like?", hint: "Pick as many as you like.", multi: true, opts: [["hatchback", "Hatchback"], ["sedan", "Sedan"], ["suv", "SUV"], ["mpv", "MPV / people carrier"], ["luxury", "Luxury sedan or SUV"], ["any", "I don't mind"]],
      apply: function (p, vs) {
        if (vs.indexOf("any") !== -1) return;
        var b = [];
        vs.forEach(function (v) { if (v === "luxury") b.push("luxury-sedan", "luxury-suv"); else b.push(v); });
        p.body = (p.body || []).concat(b);
      } },
    { id: "fuel", title: "Which fuel would you go for?", multi: true, opts: [["Petrol", "Petrol"], ["Diesel", "Diesel"], ["Electric", "Electric"], ["any", "I don't mind"]],
      apply: function (p, vs) { if (vs.indexOf("any") === -1) p.fuel = vs; } },
    { id: "gear", title: "Manual or automatic?", opts: [["Automatic", "Automatic"], ["Manual", "Manual"], ["any", "I don't mind"]],
      apply: function (p, v) { if (v !== "any") p.trans = v; } },
    { id: "age", title: "How new should the car be?", opts: [["2023", "2023 or newer"], ["2020", "2020 or newer"], ["2016", "2016 or newer"], ["1990", "Any year if the price is right"]],
      apply: function (p, v) { p.yearMin = +v > 1990 ? +v : 0; } },
    { id: "owner", title: "Does it have to be a single-owner car?", opts: [["yes", "Yes, single owner only"], ["no", "Not fussy"]],
      apply: function (p, v) { p.singleOwner = v === "yes"; } },
    { id: "brand", title: "Any brands you lean towards?", hint: "Pick as many as you like.", multi: true, opts: [["german", "German"], ["korean", "Korean"], ["japanese", "Japanese"], ["indian", "Indian"], ["british", "British"], ["any", "No preference"]],
      apply: function (p, vs) { if (vs.indexOf("any") === -1) p.origin = vs; } },
    { id: "priority", title: "What matters most to you?", opts: [["running-cost", "Low running cost"], ["comfort", "Comfort"], ["status", "A premium badge"], ["space", "Space"], ["resale", "Resale value"], ["performance", "Power and performance"], ["easy-drive", "Easy city driving"]],
      apply: function (p, v) { p.priority = v; } },
    { id: "colour", title: "Which colours do you like?", multi: true, opts: [["light", "White or silver"], ["dark", "Dark shades"], ["bold", "Something bold"], ["any", "No preference"]],
      apply: function (p, vs) { if (vs.indexOf("any") === -1) p.colour = vs; } },
    { id: "when", title: "When would you like to buy?", opts: [["week", "This week"], ["month", "This month"], ["quarter", "In the next three months"], ["browsing", "Just browsing"]],
      apply: function (p, v) { p.when = v; } }
  ];

  var answers = {}, idx = 0, started = false;
  var optionsEl = $("quizOptions"), legend = $("quizLegend"), hint = $("quizHint"), errEl = $("quizErr");
  var nextBtn = $("quizNext"), backBtn = $("quizBack"), bar = $("quizBar"), countEl = $("quizCount");
  var motionOn = !document.documentElement.classList.contains("reduce");

  function labelOf(q, v) { var o = q.opts.filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : v; }
  function picked(q) { var a = answers[q.id]; return a == null ? [] : (Array.isArray(a) ? a : [a]); }

  function render(dir) {
    var q = Q[idx];
    var hadFocus = form.contains(document.activeElement);   // read before the options are replaced: Enter on a radio removes the focused element
    countEl.textContent = "Question " + (idx + 1) + " of " + Q.length;
    legend.textContent = q.title;
    hint.textContent = q.hint || (q.multi ? "Pick as many as you like." : "");
    hint.hidden = !hint.textContent;
    errEl.hidden = true;
    bar.style.transform = "scaleX(" + ((idx) / Q.length) + ")";
    var type = q.multi ? "checkbox" : "radio", cur = picked(q);
    optionsEl.innerHTML = q.opts.map(function (o, i) {
      var id = "qo-" + q.id + "-" + i;
      return '<div class="quiz-opt"><input type="' + type + '" name="' + q.id + '" id="' + id + '" value="' + o[0] + '"' + (cur.indexOf(o[0]) !== -1 ? " checked" : "") + '>' +
        '<label for="' + id + '"><span>' + o[1] + '</span>' + (o[2] ? '<small>' + o[2] + '</small>' : "") + '</label></div>';
    }).join("");
    backBtn.hidden = idx === 0;
    nextBtn.textContent = idx === Q.length - 1 ? "See my matches" : "Next";
    // Animate the new question in (opacity + translate only; instant under reduced motion).
    var stage = $("quizQ");
    if (motionOn && window.gsap && dir) gsap.fromTo(stage, { opacity: 0, x: dir * 24 }, { opacity: 1, x: 0, duration: 0.32, ease: "power3.out", clearProps: "transform" });
    if (dir) { var first = optionsEl.querySelector("input:checked") || optionsEl.querySelector("input"); if (first && hadFocus && document.activeElement !== first) first.focus({ preventScroll: true }); }
  }

  function read(q) {
    var inputs = optionsEl.querySelectorAll("input:checked"), vals = [];
    inputs.forEach(function (i) { vals.push(i.value); });
    answers[q.id] = q.multi ? vals : (vals[0] || null);
    return vals.length > 0;
  }

  function advance() {
    var q = Q[idx];
    if (!read(q)) { errEl.hidden = false; return; }
    if (!started) { started = true; if (window.CA_TRACK) window.CA_TRACK("form_start", { form: "quiz" }); }
    if (idx < Q.length - 1) { idx++; render(1); }
    else showResults();
  }
  form.addEventListener("submit", function (e) { e.preventDefault(); advance(); });
  backBtn.addEventListener("click", function () { read(Q[idx]); if (idx > 0) { idx--; render(-1); } });

  // "Any" is exclusive in multi questions; a mouse/touch tap on a single-choice option moves on by itself.
  optionsEl.addEventListener("change", function (e) {
    var q = Q[idx], t = e.target;
    errEl.hidden = true;
    if (q.multi) {
      var any = optionsEl.querySelector('input[value="any"]');
      if (t.value === "any" && t.checked) optionsEl.querySelectorAll("input").forEach(function (i) { if (i !== t) i.checked = false; });
      else if (any && t.checked) any.checked = false;
    }
  });
  optionsEl.addEventListener("click", function (e) {
    var q = Q[idx];
    if (q.multi || !e.target.matches('input[type="radio"]') || e.detail === 0) return;   // detail 0 = keyboard
    setTimeout(advance, 240);
  });

  /* ---- results ---- */
  function buildPrefs() {
    var p = {};
    Q.forEach(function (q) { var a = answers[q.id]; if (a == null || (Array.isArray(a) && !a.length)) return; q.apply(p, a); });
    if (p.fuelHint && !p.fuel) p.fuelPref = p.fuelHint;
    if (p.body) { var seen = {}; p.body = p.body.filter(function (b) { return seen[b] ? false : (seen[b] = true); }); }
    return p;
  }
  function answerSummary() {
    return Q.map(function (q) { var v = picked(q); return v.length ? q.title.replace(/\?$/, "") + ": " + v.map(function (x) { return labelOf(q, x); }).join("/") : ""; }).filter(Boolean).join("; ");
  }
  var top = null, prefsCache = null;

  function showResults() {
    var prefs = buildPrefs(); prefsCache = prefs;
    var ranked = M.rank(prefs);
    // A diesel-friendly nudge from driving pattern: reorder ties only.
    if (prefs.fuelPref) ranked.sort(function (a, b) { return (b.pct - a.pct) || ((b.car.fuel === prefs.fuelPref) - (a.car.fuel === prefs.fuelPref)); });
    var strong = ranked.filter(function (r) { return r.pct >= 55; }).slice(0, 3);
    var list = strong.length ? strong : [];
    top = list[0] || ranked[0] || null;

    $("quizStage").hidden = true;
    $("quizResults").hidden = false;
    bar.style.transform = "scaleX(1)";
    $("quizResultsLead").textContent = list.length
      ? (list.length === 1 ? "One car on the floor fits your answers well." : list.length + " cars on the floor fit your answers well.") + " Fit is worked out from the facts on each listing."
      : "Nothing on the floor is a close fit right now.";
    $("matchList").innerHTML = list.map(function (r, i) {
      return '<li class="match"><div class="match-rank"><span class="match-pct tnum">' + r.pct + '<small>%</small></span><span class="match-fit">fit</span></div>' +
        '<div class="match-card">' + Cards.cardHTML(r.car, { showEmi: true }) + '</div>' +
        '<div class="match-why"><h3>' + (i === 0 ? "Best fit" : "Also fits") + '</h3><ul>' +
        r.why.slice(0, 5).map(function (w) { return '<li><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' + Cards.esc(w) + '</li>'; }).join("") +
        r.miss.slice(0, 2).map(function (w) { return '<li class="is-miss"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>' + Cards.esc(w) + '</li>'; }).join("") +
        '</ul></div></li>';
    }).join("");
    var none = !list.length;
    $("matchNone").hidden = !none;
    $("quizLeadForm").querySelector("h3").textContent = none ? "Or leave your number and we'll look for you" : "Want to see your top match in person?";
    // lead form car list: matches first, then everything else on the floor
    var sel = $("qlCar"); sel.innerHTML = "";
    var seen = {};
    list.concat(ranked).forEach(function (r) {
      if (seen[r.car.id]) return; seen[r.car.id] = 1;
      var o = document.createElement("option"); o.value = r.car.id; o.textContent = fmt.carFullLabel(r.car); sel.appendChild(o);
    });
    var noneOpt = document.createElement("option"); noneOpt.value = ""; noneOpt.textContent = "Not sure yet, suggest something"; sel.appendChild(noneOpt);
    if (none) sel.value = "";
    // request-a-car link carries the answers
    $("matchRequestLink").href = "request.html?" + requestQuery(prefs);
    if (window.CA_MOTION && window.CA_MOTION.revealGrid) { /* cards sit in a list; reveal simply */ }
    if (window.gsap && motionOn) gsap.from("#quizResults .match", { opacity: 0, y: 24, duration: 0.6, ease: "expo.out", stagger: 0.08, clearProps: "transform,opacity" });
    if (window.CA_MOTION && window.CA_MOTION.glints) window.CA_MOTION.glints(document);
    $("quizResults").scrollIntoView({ behavior: motionOn ? "smooth" : "auto", block: "start" });
    $("quizResultsTitle").setAttribute("tabindex", "-1"); $("quizResultsTitle").focus({ preventScroll: true });
  }

  function requestQuery(p) {
    var q = new URLSearchParams();
    if (p.body && p.body.length) q.set("body", p.body[0]);
    if (p.fuel && p.fuel.length) q.set("fuel", p.fuel[0]);
    if (p.trans) q.set("trans", p.trans);
    if (p.budgetMax) q.set("budget", String(Math.round(p.budgetMax / LAKH)));
    return q.toString();
  }

  $("quizRestart").addEventListener("click", function () {
    answers = {}; idx = 0; started = false;
    $("quizResults").hidden = true; $("quizStage").hidden = false; render(0);
    $("quizStage").scrollIntoView({ behavior: "auto", block: "start" });
  });

  /* ---- lead ---- */
  var lead = $("quizLeadForm");
  lead.querySelector("[data-extras]").innerHTML = F.extrasHTML("ql");
  var rules = { qlName: F.req("Enter your name."), qlPhone: F.phone };
  F.watch(lead, rules);
  /* the see_stock metric counts visitors who open a matched car, not every time results are drawn */
  $("matchList").addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest(".car-card-link, .car-view-btn") && window.CA_TRACK) window.CA_TRACK("cta_click", { cta: "see_stock", at: "quiz" });
  });
  lead.addEventListener("focusin", function () { if (!lead.__fs) { lead.__fs = true; if (window.CA_TRACK) window.CA_TRACK("form_start", { form: "enquiry" }); } });
  lead.addEventListener("submit", function (e) {
    e.preventDefault();
    var status = $("qlStatus");
    if (!F.validateAll(lead, rules)) { F.status(status, "Check the highlighted fields and try again.", "error"); return; }
    var car = CARS.filter(function (c) { return c.id === $("qlCar").value; })[0] || null;
    var fit = null;
    if (car && prefsCache) fit = M.score(car, prefsCache).pct;
    var parts = [["Source", "Find your car quiz"]];
    if (car) parts.push(["Interested in", fmt.carLeadLabel(car)]);
    if (fit != null) parts.push(["Fit", fit + "%"]);
    parts.push(["Buying", labelOf(Q[16], answers.when)]);
    if (answers.tradein === "yes") parts.push(["Exchange", "yes"]);
    var msg = window.CA.buildMessage({ intent: "ENQUIRY", parts: parts, marketing: $("qlMarketing").checked, text: "Quiz answers: " + answerSummary() });
    var budgetMax = prefsCache && prefsCache.budgetMax ? prefsCache.budgetMax : "";
    F.send(lead, status, {
      name: $("qlName").value.trim(), phone: $("qlPhone").value.trim(), car: car ? fmt.carLeadLabel(car) : "Quiz: " + (prefsCache && prefsCache.body ? prefsCache.body.join("/") : "open"),
      message: msg, budget: car && car.price ? car.price : budgetMax, visit_at: "", page: "quiz.html"
    }, "Sent. We'll message you to fix a time.").then(function (r) { if (r && r.ok) { lead.reset(); lead.__fs = false; } });
  });

  render(0);
})();
