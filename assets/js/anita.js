/* =========================================================================
   Anita — Classic Auto's WhatsApp-styled AI chat concierge.
   Client-side only (rule-based NLU mirroring business-lab/engine/lead_brain.py
   — no server/API needed; CA_ENDPOINT stays optional). Present on every page
   via #anitaRoot + this script.
   ========================================================================= */
(function () {
  "use strict";
  var root = document.getElementById("anitaRoot");
  if (!root || typeof CARS === "undefined" || !window.ClassicAuto) return;
  var fmt = window.ClassicAuto;

  /* ------------------------------------------------------------------
     lead_brain.py mirrors: tiers, model price hints, budget/EMI regex
     ------------------------------------------------------------------ */
  var TIERS = [
    { name: "Premium", min: 2000000, max: null, salesman: "Imran", sla: 10 },
    { name: "Mid", min: 800000, max: 2000000, salesman: "Rakesh", sla: 15 },
    { name: "Volume", min: 0, max: 800000, salesman: "Sunil", sla: 20 }
  ];

  var MODEL_PRICE_HINT = {
    "fortuner": 3000000, "endeavour": 2800000, "land cruiser": 9000000, "defender": 8000000,
    "bmw": 3500000, "mercedes": 3800000, "audi": 3200000, "jaguar": 3500000, "volvo": 3500000,
    "innova": 1800000, "crysta": 2000000, "hycross": 2200000, "harrier": 1800000, "safari": 2000000,
    "creta": 1500000, "seltos": 1500000, "grand vitara": 1500000, "compass": 2000000,
    "city": 1100000, "verna": 1200000, "slavia": 1300000, "virtus": 1300000, "ciaz": 900000,
    "nexon": 1000000, "venue": 950000, "sonet": 950000, "brezza": 1000000, "punch": 750000,
    "baleno": 750000, "i20": 800000, "altroz": 750000, "swift": 650000, "wagonr": 500000,
    "alto": 380000, "celerio": 500000, "kwid": 400000, "tiago": 550000, "santro": 450000,
    "ertiga": 1000000, "xl6": 1100000, "carens": 1200000, "triber": 650000
  };

  function guessBudget(text) {
    var t = text.toLowerCase();
    var m = t.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore)/);
    if (m) { var v = parseFloat(m[1]) * 10000000; if (v >= 100000 && v <= 500000000) return v; }
    m = t.match(/(\d+(?:\.\d+)?)\s*(?:l|lac|lakh|lakhs)\b/);
    if (m) { v = parseFloat(m[1]) * 100000; if (v >= 100000 && v <= 50000000) return v; }
    m = t.match(/\b(\d{5,8})\b/);
    if (m) { v = parseFloat(m[1]); if (v >= 100000 && v <= 50000000) return v; }
    m = t.match(/emi[^\d]{0,12}(\d{4,6})/) || t.match(/(\d{4,6})[^\d]{0,10}(?:emi|per month|monthly|mahina|mahine)/);
    if (m) {
      var emiVal = parseInt(m[1], 10);
      if (emiVal >= 3000 && emiVal <= 200000) return Math.round(emiVal * 45 * 1.2);
    }
    for (var model in MODEL_PRICE_HINT) {
      if (t.indexOf(model) !== -1) return MODEL_PRICE_HINT[model];
    }
    return null;
  }

  function tierFor(budget) {
    for (var i = 0; i < TIERS.length; i++) {
      var tr = TIERS[i];
      if (budget >= tr.min && (tr.max === null || budget < tr.max)) return tr;
    }
    return TIERS[TIERS.length - 1];
  }

  function findCarInText(text) {
    var t = text.toLowerCase();
    var hit = CARS.filter(function (c) {
      return t.indexOf(c.model.toLowerCase()) !== -1 || t.indexOf((c.make + " " + c.model).toLowerCase()) !== -1;
    });
    return hit[0] || null;
  }

  function findBodyInText(text) {
    var t = text.toLowerCase();
    if (/luxury/.test(t)) return "luxury-sedan";
    if (/hatchback|hatch\b/.test(t)) return "hatchback";
    if (/\bsedan\b/.test(t)) return "sedan";
    if (/\bsuv\b/.test(t)) return "suv";
    return null;
  }

  function carsUnderBudget(budget, excludeId) {
    return CARS.filter(function (c) { return c.status !== "SOLD" && c.price <= budget && c.id !== excludeId; })
      .sort(function (a, b) { return b.price - a.price; });
  }

  function alternativesFor(body, budget) {
    var pool = CARS.filter(function (c) { return c.status !== "SOLD"; });
    if (body) pool = pool.filter(function (c) { return c.body === body; }).concat(pool.filter(function (c) { return c.body !== body; }));
    if (budget) pool = pool.slice().sort(function (a, b) { return Math.abs(a.price - budget) - Math.abs(b.price - budget); });
    return pool.slice(0, 3);
  }

  /* ------------------------------------------------------------------
     Markup
     ------------------------------------------------------------------ */
  root.innerHTML =
    '<button class="anita-launcher" id="anitaLauncher" aria-haspopup="dialog" aria-expanded="false" aria-controls="anitaPanel" aria-label="Chat with Anita, Classic Auto\'s assistant">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
      '<span class="anita-dot" aria-hidden="true"></span>' +
    '</button>' +
    '<div class="anita-panel" id="anitaPanel" role="dialog" aria-modal="false" aria-label="Chat with Anita">' +
      '<div class="anita-head">' +
        '<div class="anita-avatar" aria-hidden="true">A</div>' +
        '<div class="anita-head-text"><div class="name">Anita · Classic Auto</div><div class="status">Typically replies in minutes</div></div>' +
        '<button class="anita-close" id="anitaClose" aria-label="Close chat">' +
          '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="anita-body" id="anitaBody" aria-live="polite"></div>' +
      '<div class="anita-chips" id="anitaChips"></div>' +
      '<form class="anita-inputrow" id="anitaForm">' +
        '<input type="text" id="anitaInput" placeholder="Type a message…" autocomplete="off" aria-label="Message Anita">' +
        '<button class="anita-send" type="submit" aria-label="Send">' +
          '<svg class="icon" style="width:18px;height:18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>' +
        '</button>' +
      '</form>' +
    '</div>';

  var launcher = document.getElementById("anitaLauncher");
  var panel = document.getElementById("anitaPanel");
  var closeBtn = document.getElementById("anitaClose");
  var body = document.getElementById("anitaBody");
  var chipsEl = document.getElementById("anitaChips");
  var formEl = document.getElementById("anitaForm");
  var inputEl = document.getElementById("anitaInput");

  var state = { budget: null, budgetLabel: "", car: null, stage: "idle", visitDraft: {} };
  var greeted = false;

  function open() {
    panel.classList.add("is-open");
    launcher.setAttribute("aria-expanded", "true");
    if (!greeted) {
      greeted = true;
      pushBot("Namaste! Main Anita, Classic Auto se. Batayein — kaunsi gaadi dhoond rahe hain, ya kis budget mein?",
        ["Hatchback", "Sedan", "SUV", "Luxury Sedan"]);
    }
    inputEl.focus();
  }
  function close() {
    panel.classList.remove("is-open");
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }
  launcher.addEventListener("click", function () { panel.classList.contains("is-open") ? close() : open(); });
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("is-open")) close();
  });

  function scrollDown() { body.scrollTop = body.scrollHeight; }

  function pushUser(text) {
    var el = document.createElement("div");
    el.className = "anita-msg from-user";
    el.textContent = text;
    body.appendChild(el);
    scrollDown();
  }

  function pushBot(text, chips, carMiniHtml) {
    var el = document.createElement("div");
    el.className = "anita-msg from-bot";
    el.innerHTML = escapeHtml(text) + (carMiniHtml || "");
    body.appendChild(el);
    renderChips(chips || []);
    scrollDown();
  }

  function pushBotHtml(html, chips) {
    var el = document.createElement("div");
    el.className = "anita-msg from-bot";
    el.innerHTML = html;
    body.appendChild(el);
    renderChips(chips || []);
    scrollDown();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; });
  }

  function renderChips(chips) {
    chipsEl.innerHTML = "";
    chips.forEach(function (label) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "anita-chip";
      b.textContent = label;
      b.addEventListener("click", function () { submit(label); });
      chipsEl.appendChild(b);
    });
  }

  var typingEl = null;
  function showTyping() {
    typingEl = document.createElement("div");
    typingEl.className = "anita-typing";
    typingEl.innerHTML = "<span></span><span></span><span></span>";
    body.appendChild(typingEl);
    scrollDown();
  }
  function hideTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }

  function carMiniHtml(c) {
    return '<div class="car-mini"><div class="cm-title">' + c.year + " " + c.make + " " + c.model + '</div>' +
      '<div class="cm-price">' + fmt.money(c.price) + " · EMI from " + fmt.rupees(fmt.emi(c.price)) + "/mo*</div></div>";
  }

  /* ------------------------------------------------------------------
     Core response logic
     ------------------------------------------------------------------ */
  function respond(raw) {
    var text = raw.trim();
    var lower = text.toLowerCase();

    // Bot/AI identity question — answer only when directly asked, warmly,
    // then fall through to normal handling of the rest of the message.
    if (/\b(are you (a |an )?(bot|ai)|ai ho|bot ho kya|real person|insaan ho|human ho)\b/.test(lower)) {
      pushBot("Main Classic Auto ki digital assistant hoon — yahin se aapki madad kar sakti hoon. Ab batayein, kaise help karoon?");
      return;
    }

    // Mid-flow slot capture takes priority over everything else.
    if (state.stage.indexOf("visit:") === 0) { handleVisitSlot(text); return; }
    if (state.stage === "salesman:budget") { handleSalesmanBudgetSlot(text); return; }

    // Discounts — never quoted, under any framing.
    if (/discount|kam (karo|karenge)|price kam|negotiat/.test(lower)) {
      pushBot("Discount main quote nahi kar sakti — par hamara salesman aapke liye best possible deal zaroor dekhega.",
        ["Talk to a salesman"]);
      return;
    }

    if (/catalogue|catalog|price list|sab dikhao|list bhejo/.test(lower)) {
      pushBotHtml('Zaroor — poora stock ek hi page par yahan hai: <a href="catalogue.html" style="color:var(--champagne); text-decoration:underline;">Open Catalogue</a>',
        ["View in Studio", "Talk to a salesman"]);
      return;
    }

    if (/test drive|schedule|visit|showroom aana|dekhna hai ghar/.test(lower)) {
      state.stage = "visit:name";
      state.visitDraft = {};
      pushBot("Bilkul — visit schedule karte hain. Sabse pehle, kis naam se book karoon?");
      return;
    }

    if (/salesman|salesperson|human se|talk to (a )?(sales|person|human)|call me|number do/.test(lower)) {
      startSalesmanHandoff();
      return;
    }

    var budgetFound = guessBudget(text);
    if (budgetFound) { state.budget = budgetFound; state.budgetLabel = fmt.money(budgetFound); }

    var carFound = findCarInText(text);
    var bodyFound = findBodyInText(text);

    if (carFound) {
      state.car = carFound;
      if (carFound.status === "SOLD") {
        var alts = alternativesFor(carFound.body, state.budget);
        pushBot("Woh " + carFound.make + " " + carFound.model + " abhi SOLD ho chuki hai. Kuch aur options dekhiye jo close hain:",
          null, alts.map(carMiniHtml).join(""));
        renderChips(["View in Studio", "Talk to a salesman"]);
      } else {
        pushBot(carFound.make + " " + carFound.model + " stock mein hai! " + carFound.year + " · " + fmt.formatKm(carFound.kms) + " · " + carFound.fuel + " · " + fmt.money(carFound.price) + ". EMI from " + fmt.rupees(fmt.emi(carFound.price)) + "/mo*.",
          ["View in Studio", "See photos", "Talk to a salesman"], carMiniHtml(carFound));
      }
      return;
    }

    // Car named but not in our stock (e.g. a brand/model we don't carry).
    var mentionsAnyCarWord = /\b(car|gaadi|suv|sedan|hatchback)\b/.test(lower) || Object.keys(MODEL_PRICE_HINT).some(function (m) { return lower.indexOf(m) !== -1 && !findCarInText(m); });
    var looksLikeUnknownModel = Object.keys(MODEL_PRICE_HINT).some(function (m) { return lower.indexOf(m) !== -1; }) && !carFound;

    if (looksLikeUnknownModel || /range rover|land rover|hilux|scorpio-n|gloster/.test(lower)) {
      var altsBody = bodyFound || null;
      var alts2 = alternativesFor(altsBody, state.budget || guessBudget(text));
      pushBot("Us model ki gaadi abhi stock mein nahi hai. Yeh kuch options hain jo close match karte hain:",
        null, alts2.map(carMiniHtml).join(""));
      renderChips(["Notify me when available", "Talk to a salesman"]);
      return;
    }

    if (budgetFound && !bodyFound) {
      var underBudget = carsUnderBudget(budgetFound);
      if (underBudget.length) {
        pushBot(fmt.money(budgetFound) + " ke andar humare paas " + underBudget.length + " gaadi hain. Top options:",
          ["View in Studio", "Talk to a salesman"], underBudget.slice(0, 3).map(carMiniHtml).join(""));
      } else {
        pushBot("Is budget mein abhi exact match nahi hai — thoda badha ke dekhein, ya salesman se baat kar lein.", ["Talk to a salesman"]);
      }
      return;
    }

    if (bodyFound) {
      var byBody = CARS.filter(function (c) { return c.body === bodyFound && c.status !== "SOLD"; });
      if (state.budget) byBody = byBody.filter(function (c) { return c.price <= state.budget * 1.15; });
      if (byBody.length) {
        pushBot("Yeh " + ({ hatchback: "hatchback", sedan: "sedan", suv: "SUV", "luxury-sedan": "luxury sedan" }[bodyFound]) + " options hain:",
          ["Talk to a salesman"], byBody.slice(0, 3).map(carMiniHtml).join(""));
      } else {
        pushBot("Abhi is body-type mein exact match nahi hai. Batao toh notify kar dein jab aa jaaye?", ["Notify me when available", "Talk to a salesman"]);
      }
      return;
    }

    // Fallback — ask a clarifying question, one at a time.
    pushBot("Samajh gayi. Ek cheez batayein — aapka budget ya body type (hatchback/sedan/SUV/luxury) kya hai, taaki sahi options dikha sakoon?",
      ["Hatchback", "Sedan", "SUV", "Luxury Sedan"]);
  }

  /* ------------------------------------------------------------------
     Visit scheduling — inline multi-turn slot filling
     ------------------------------------------------------------------ */
  function handleVisitSlot(text) {
    if (/^cancel$/i.test(text.trim())) {
      state.stage = "idle";
      pushBot("Theek hai, visit cancel kar diya. Aur kuch madad chahiye?");
      return;
    }
    // Let a clear pivot interrupt the visit flow instead of being swallowed
    // as a name/phone/date/time value — a real assistant lets you change
    // your mind mid-form.
    if (/salesman|salesperson|human se|talk to (a )?(sales|person|human)/i.test(text)) {
      state.stage = "idle";
      startSalesmanHandoff();
      return;
    }
    if (state.stage === "visit:name") {
      state.visitDraft.name = text.trim();
      state.stage = "visit:phone";
      pushBot("Shukriya, " + state.visitDraft.name + "! Aapka phone number?");
      return;
    }
    if (state.stage === "visit:phone") {
      state.visitDraft.phone = text.trim();
      state.stage = "visit:date";
      pushBot("Kaunsa din aana chahenge? (jaise Sat 27 Sep)");
      return;
    }
    if (state.stage === "visit:date") {
      state.visitDraft.date = text.trim();
      state.stage = "visit:time";
      pushBot("Aur kis time? (jaise 4:00 pm)");
      return;
    }
    if (state.stage === "visit:time") {
      state.visitDraft.time = text.trim();
      state.stage = "idle";
      var visitAt = state.visitDraft.date + ", " + state.visitDraft.time;
      // Submitted synchronously inside this user-initiated send, so the
      // wa.me fallback (when CA_ENDPOINT is empty) isn't blocked as a popup.
      window.ClassicAutoLeads.submitLead({
        name: state.visitDraft.name, phone: state.visitDraft.phone,
        car: state.car ? fmt.carFullLabel(state.car) : "",
        message: "Visit scheduled via Anita chat.",
        budget: state.budgetLabel || "", visit_at: visitAt, page: "chat"
      });
      pushBot("Perfect — " + visitAt + " ke liye visit book kar diya" + (state.car ? (" (" + state.car.make + " " + state.car.model + ")") : "") + ". Hamari team WhatsApp par confirm karegi!");
      return;
    }
  }

  function handleSalesmanBudgetSlot(text) {
    var b = guessBudget(text);
    state.stage = "idle";
    if (b) { state.budget = b; state.budgetLabel = fmt.money(b); }
    startSalesmanHandoff();
  }

  /* ------------------------------------------------------------------
     Salesman handoff — tier from captured budget, wa.me link + optional
     background POST (only when CA_ENDPOINT is set).
     ------------------------------------------------------------------ */
  function startSalesmanHandoff() {
    if (!state.budget) {
      state.stage = "salesman:budget";
      pushBot("Zaroor — pehle batayein, budget kitna soch rahe hain? Isse main sahi salesman se connect karungi.",
        ["Under 8 lakh", "8-20 lakh", "20 lakh+"]);
      return;
    }
    var tier = tierFor(state.budget);
    var summary = "Car: " + (state.car ? fmt.carFullLabel(state.car) : "not specified") +
      " | Budget: " + state.budgetLabel;
    var waText = "Hi Classic Auto, please connect me with " + tier.salesman + " (" + tier.name + " desk). " + summary;
    var link = window.ClassicAutoLeads.waLink(waText);

    if (window.CA_ENDPOINT) {
      fetch(window.CA_ENDPOINT + "/website", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "", phone: "", car: state.car ? fmt.carFullLabel(state.car) : "",
          message: "Salesman handoff from Anita chat — " + tier.name + " tier.",
          budget: state.budgetLabel, visit_at: "", page: "chat"
        })
      }).catch(function () {});
    }

    pushBotHtml(
      escapeHtml("Aapke budget (" + state.budgetLabel + ") ke hisaab se " + tier.salesman + " (" + tier.name + " desk) aapse " + tier.sla + " minute mein baat karenge.") +
      '<a href="' + link + '" target="_blank" rel="noopener" class="btn btn-primary" style="margin-top:0.6rem; min-height:40px; font-size: var(--fs-caption);">Open WhatsApp to ' + tier.salesman + '</a>'
    );
  }

  /* ------------------------------------------------------------------
     Chip label handling — some chips are direct navigation/actions.
     ------------------------------------------------------------------ */
  function handleChipShortcut(label) {
    if (label === "View in Studio" && state.car) {
      pushBotHtml('Yeh raha Studio link: <a href="studio.html?id=' + encodeURIComponent(state.car.id) + '" style="color:var(--champagne); text-decoration:underline;">Open ' + state.car.make + " " + state.car.model + " in Studio</a>");
      return true;
    }
    if (label === "See photos" && state.car) {
      pushBotHtml('Poori gallery yahan hai: <a href="car.html?id=' + encodeURIComponent(state.car.id) + '" style="color:var(--champagne); text-decoration:underline;">' + state.car.make + " " + state.car.model + " ki photos</a>");
      return true;
    }
    if (label === "Notify me when available") {
      pushBot("Zaroor, jaise hi aisi gaadi aati hai main aapko batwa dungi. Apna naam aur number bhej dijiye.");
      state.stage = "visit:name"; // reuse name/phone capture, then treat as a lead
      state.visitDraft = { notifyOnly: true };
      return true;
    }
    return false;
  }

  function submit(text) {
    if (!text) return;
    pushUser(text);
    chipsEl.innerHTML = "";
    if (handleChipShortcut(text)) return;

    var willAutoOpen = state.stage === "visit:time"; // last slot -> synchronous submit
    if (willAutoOpen) { respond(text); return; }

    showTyping();
    window.setTimeout(function () {
      hideTyping();
      respond(text);
    }, 480);
  }

  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = inputEl.value;
    inputEl.value = "";
    submit(v);
  });
})();
