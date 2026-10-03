/* =========================================================================
   Anita: Classic Auto's scripted chat assistant (rule-based, no AI, no
   server). v6 audit: every reply works from the 7 real cars in cars.js, quotes
   no discounts, names no staff, promises no response times, and never prints a
   phone number or wa.me link while CA_SITE.phone / whatsapp are null (N2, N3).
   Leads go through ClassicAutoLeads.submitLead (7 keys, intent in `message`).
   Disabled by setting CA_SITE.features.anita = false.
   ========================================================================= */
(function () {
  "use strict";
  /* chrome.js creates #anitaRoot on DOMContentLoaded, and deferred scripts such as this one run before that event:
     start once the root exists. */
  function boot() {
  var root = document.getElementById("anitaRoot");
  if (!root || typeof CARS === "undefined" || !window.ClassicAuto || !window.CA) return;
  var fmt = window.ClassicAuto, CA = window.CA;

  /* ------------------------------------------------------------------
     Budget / car / body understanding (rule-based)
     ------------------------------------------------------------------ */
  function guessBudget(text) {
    var t = text.toLowerCase(), m, v;
    m = t.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore)/);
    if (m) { v = parseFloat(m[1]) * 10000000; if (v >= 100000 && v <= 500000000) return v; }
    m = t.match(/(\d+(?:\.\d+)?)\s*(?:l|lac|lakh|lakhs)\b/);
    if (m) { v = parseFloat(m[1]) * 100000; if (v >= 100000 && v <= 50000000) return v; }
    m = t.match(/\b(\d{5,8})\b/);
    if (m) { v = parseFloat(m[1]); if (v >= 100000 && v <= 100000000) return v; }
    m = t.match(/emi[^\d]{0,12}(\d{4,6})/) || t.match(/(\d{4,6})[^\d]{0,10}(?:emi|per month|monthly|mahina|mahine)/);
    if (m) { var e = parseInt(m[1], 10); if (e >= 3000 && e <= 200000) return Math.round(e * 45 * 1.2); }
    return null;
  }

  function findCarInText(text) {
    var t = text.toLowerCase();
    return CARS.filter(function (c) {
      return t.indexOf(c.model.toLowerCase()) !== -1 || t.indexOf((c.make + " " + c.model).toLowerCase()) !== -1;
    })[0] || null;
  }
  function findBodyInText(text) {
    var t = text.toLowerCase();
    if (/luxury\s*suv/.test(t)) return "luxury-suv";
    if (/luxury/.test(t)) return "luxury-sedan";
    if (/hatchback|hatch\b/.test(t)) return "hatchback";
    if (/\bmpv\b|7[\s-]?seat|seven seat/.test(t)) return "mpv";
    if (/\bsedan\b/.test(t)) return "sedan";
    if (/\bsuv\b/.test(t)) return "suv";
    return null;
  }
  function available() { return CARS.filter(function (c) { return c.status !== "SOLD"; }); }
  function carsUnderBudget(budget) {
    return available().filter(function (c) { return c.price != null && c.price <= budget; }).sort(function (a, b) { return b.price - a.price; });
  }
  function alternativesFor(body, budget) {
    var pool = available();
    if (body) pool = pool.filter(function (c) { return c.body === body; }).concat(pool.filter(function (c) { return c.body !== body; }));
    if (budget) pool = pool.slice().sort(function (a, b) { return Math.abs((a.price || 0) - budget) - Math.abs((b.price || 0) - budget); });
    return pool.slice(0, 3);
  }
  function priceOf(c) { return c.price == null ? "ask for price" : fmt.money(c.price); }
  function emiOf(c) { return c.price == null ? "" : " · EMI from " + fmt.rupees(fmt.emi(c.price)) + "/mo*"; }

  /* ------------------------------------------------------------------
     Markup
     ------------------------------------------------------------------ */
  root.innerHTML =
    '<button class="anita-launcher" id="anitaLauncher" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="anitaPanel" aria-label="Chat with Anita, the Classic Auto assistant">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l1.9-5.6A8.4 8.4 0 1 1 21 11.5z"/></svg>' +
      '<span class="anita-dot" aria-hidden="true"></span>' +
    '</button>' +
    '<div class="anita-panel" id="anitaPanel" role="dialog" aria-modal="false" aria-label="Chat with Anita">' +
      '<div class="anita-head">' +
        '<div class="anita-avatar" aria-hidden="true">A</div>' +
        '<div class="anita-head-text"><div class="name">Anita</div><div class="status">Classic Auto assistant</div></div>' +
        '<button class="anita-close" id="anitaClose" type="button" aria-label="Close chat"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '</div>' +
      '<div class="anita-body" id="anitaBody" aria-live="polite"></div>' +
      '<div class="anita-chips" id="anitaChips"></div>' +
      '<form class="anita-inputrow" id="anitaForm">' +
        '<input type="text" id="anitaInput" placeholder="Type a message" autocomplete="off" aria-label="Message Anita">' +
        '<button class="anita-send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>' +
      '</form>' +
    '</div>';

  var launcher = document.getElementById("anitaLauncher");
  var panel = document.getElementById("anitaPanel");
  var closeBtn = document.getElementById("anitaClose");
  var body = document.getElementById("anitaBody");
  var chipsEl = document.getElementById("anitaChips");
  var formEl = document.getElementById("anitaForm");
  var inputEl = document.getElementById("anitaInput");

  var state = { budget: null, budgetLabel: "", car: null, stage: "idle", draft: {} };
  var greeted = false;
  var BODY_CHIPS = ["Under ₹20 L", "₹20-50 L", "₹50 L and above", "SUV"];

  /* On phones and tablets the launcher lives inside the sticky contact bar, so it never covers a button, a spec row or a link.
     From 900px up the bar is a floating pill and the launcher floats above it. */
  var dockQuery = window.matchMedia ? window.matchMedia("(max-width: 899px)") : null;
  function dock() {
    var bar = document.getElementById("stickyBar");
    if (!bar || !dockQuery) return;
    if (dockQuery.matches) { bar.appendChild(launcher); launcher.classList.add("is-docked"); }
    else { root.insertBefore(launcher, root.firstChild); launcher.classList.remove("is-docked"); }
  }
  dock();
  if (dockQuery) { if (dockQuery.addEventListener) dockQuery.addEventListener("change", dock); else dockQuery.addListener(dock); }

  function open() {
    panel.classList.add("is-open");
    launcher.setAttribute("aria-expanded", "true");
    if (!greeted) {
      greeted = true;
      pushBot("Namaste! Main Anita, Classic Auto ki assistant. Batayein, kaunsi gaadi dhoond rahe hain, ya kis budget mein?", BODY_CHIPS);
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
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("is-open")) close(); });

  function scrollDown() { body.scrollTop = body.scrollHeight; }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function pushUser(text) {
    var el = document.createElement("div"); el.className = "anita-msg from-user"; el.textContent = text;
    body.appendChild(el); scrollDown();
  }
  function pushBot(text, chips, extraHtml) {
    var el = document.createElement("div"); el.className = "anita-msg from-bot";
    el.innerHTML = esc(text) + (extraHtml ? window.CA.rootify(extraHtml) : "");   // car-mini links resolve from cars/<id>/ pages too
    body.appendChild(el); renderChips(chips || []); scrollDown();
  }
  function pushBotHtml(html, chips) {
    var el = document.createElement("div"); el.className = "anita-msg from-bot"; el.innerHTML = window.CA.rootify(html);
    body.appendChild(el); renderChips(chips || []); scrollDown();
  }
  function renderChips(chips) {
    chipsEl.innerHTML = "";
    chips.forEach(function (label) {
      var b = document.createElement("button"); b.type = "button"; b.className = "anita-chip"; b.textContent = label;
      b.addEventListener("click", function () { submit(label); });
      chipsEl.appendChild(b);
    });
  }
  var typingEl = null;
  function showTyping() { typingEl = document.createElement("div"); typingEl.className = "anita-typing"; typingEl.innerHTML = "<span></span><span></span><span></span>"; body.appendChild(typingEl); scrollDown(); }
  function hideTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }

  function miniHtml(c) {
    return '<a class="car-mini" href="cars/' + encodeURIComponent(c.id) + '/"><span class="cm-title">' + fmt.carLabel(c) + '</span><span class="cm-price">' + priceOf(c) + emiOf(c) + '</span></a>';
  }
  function minis(list) { return list.map(miniHtml).join(""); }

  /* ------------------------------------------------------------------
     Core response logic
     ------------------------------------------------------------------ */
  function respond(raw) {
    var text = raw.trim(), lower = text.toLowerCase();

    if (/\b(are you (a |an )?(bot|ai)|ai ho|bot ho kya|real person|insaan ho|human ho)\b/.test(lower)) {
      pushBot("Main Classic Auto ki scripted assistant hoon. Stock, EMI aur visit ke baare mein yahin madad kar sakti hoon. Aage ki baat hamari team karegi.");
      return;
    }
    if (state.stage.indexOf("lead:") === 0) { handleLeadSlot(text); return; }

    if (/discount|kam (karo|karenge)|price kam|negotiat/.test(lower)) {
      pushBot("Discount main quote nahi kar sakti. Price par baat hamari team aapse seedhe karegi.", ["Talk to the team"]);
      return;
    }
    if (/catalogue|catalog|price list|sab dikhao|list bhejo/.test(lower)) {
      pushBotHtml('Poora stock ek page par: <a href="catalogue.html">Open the catalogue</a>', ["Talk to the team"]);
      return;
    }
    // 3D / Studio: link straight to the Studio for the car being talked about (named now, earlier in the chat, or the car page open), else the Studio
    if (/\b3\s?-?d\b|three[\s-]?d|\bstudio\b|\b360\b|virtual (tour|view|showroom)/.test(lower)) {
      var pageId = window.CA_CAR_ID || new URLSearchParams(window.location.search).get("id");   // cars/<id>/ pages set CA_CAR_ID; car.html and studio.html use ?id=
      var sc = findCarInText(text) || state.car || (pageId ? CARS.filter(function (c) { return c.id === pageId; })[0] : null);
      if (sc) {
        state.car = sc;
        pushBotHtml(esc(sc.make + " " + sc.model) + " ko 3D Studio mein dekhiye: " +
          '<a href="studio.html?id=' + encodeURIComponent(sc.id) + '" data-cta="studio" data-at="anita">Open the ' + esc(sc.make + " " + sc.model) + ' in the 3D Studio</a>' +
          (sc.scan ? "" : "\nStudio ka 3D model illustrative hai, yeh exact gaadi nahi. Asli gaadi ke photos car page par hain."), ["Book a visit", "Talk to the team"]);
      } else {
        pushBotHtml('Hamara 3D Studio yahan hai: <a href="studio.html" data-cta="studio" data-at="anita">Open the 3D Studio</a>\nKisi gaadi ka naam batayein toh seedha uska Studio link de doongi.', BODY_CHIPS);
      }
      return;
    }
    if (/test drive|schedule|visit|showroom aana|dekhna hai/.test(lower)) {
      state.stage = "lead:name"; state.draft = { intent: "VISIT" };
      pushBot("Bilkul, visit request bhej dete hain. Sabse pehle, kis naam se likhoon?");
      return;
    }
    if (/team|salesman|salesperson|human se|talk to|call me|number do/.test(lower)) { startHandoff(); return; }

    var budgetFound = guessBudget(text);
    if (budgetFound) { state.budget = budgetFound; state.budgetLabel = fmt.money(budgetFound); }
    var carFound = findCarInText(text), bodyFound = findBodyInText(text);

    if (carFound) {
      state.car = carFound;
      if (carFound.status === "SOLD") {
        pushBot("Woh " + carFound.make + " " + carFound.model + " sold ho chuki hai. Yeh kuch close options hain:", ["Talk to the team"], minis(alternativesFor(carFound.body, state.budget)));
      } else {
        pushBot(carFound.make + " " + carFound.model + " stock mein hai. " + carFound.year + " · " + fmt.formatKm(carFound.kms) + " · " + carFound.fuel + " · " + priceOf(carFound) + ".",
          ["Book a visit", "Talk to the team"], miniHtml(carFound));
      }
      return;
    }

    // Looks like a car we don't have (any "car"-ish talk with no stock match).
    if (/\b(fortuner|innova|creta|swift|baleno|nexon|thar|xuv|verna|city|brezza|ertiga|scorpio|i20|punch|venue|sonet|c-class|a4)\b/.test(lower)) {
      pushBot("Woh model abhi hamare stock mein nahi hai. Yeh kuch options hain jo close hain:", ["Notify me when available", "Talk to the team"], minis(alternativesFor(bodyFound, state.budget)));
      return;
    }

    if (budgetFound && !bodyFound) {
      var under = carsUnderBudget(budgetFound);
      if (under.length) pushBot(fmt.money(budgetFound) + " ke andar hamare paas " + under.length + " gaadi hain. Top options:", ["Talk to the team"], minis(under.slice(0, 3)));
      else pushBot("Is budget mein abhi exact match nahi hai. Thoda badha ke dekhein, ya team se baat kar lein.", ["Talk to the team"]);
      return;
    }
    if (bodyFound) {
      var byBody = available().filter(function (c) { return c.body === bodyFound; });
      if (state.budget) byBody = byBody.filter(function (c) { return c.price != null && c.price <= state.budget * 1.15; });
      if (byBody.length) pushBot("Yeh " + fmt.bodyLabel(bodyFound).toLowerCase() + " options hain:", ["Talk to the team"], minis(byBody.slice(0, 3)));
      else pushBot("Abhi is body type mein exact match nahi hai. Batayein toh jaise hi aaye, hum aapko batayein?", ["Notify me when available", "Talk to the team"]);
      return;
    }
    pushBot("Samajh gayi. Aapka budget ya body type (hatchback, sedan, SUV, luxury) kya hai, taaki sahi options dikha sakoon?", BODY_CHIPS);
  }

  /* ------------------------------------------------------------------
     Lead capture: name -> phone -> (date -> time of day) -> submitLead
     ------------------------------------------------------------------ */
  function handleLeadSlot(text) {
    if (/^cancel$/i.test(text.trim())) { state.stage = "idle"; pushBot("Theek hai, cancel kar diya. Aur kuch madad chahiye?"); return; }
    if (/team|salesman|talk to/i.test(text)) { state.stage = "idle"; startHandoff(); return; }
    var d = state.draft;
    if (state.stage === "lead:name") { d.name = text.trim(); state.stage = "lead:phone"; pushBot("Shukriya, " + d.name + ". Aapka mobile number?"); return; }
    if (state.stage === "lead:phone") {
      if (!window.CAForms || !window.CAForms.phoneOk(text)) { pushBot("Yeh number sahi nahi lag raha. 10 digit ka mobile number bhejiye."); return; }
      d.phone = text.trim();
      if (d.intent === "ENQUIRY") { finishLead(); return; }
      state.stage = "lead:date"; pushBot("Kaunsa din aana chahenge? (jaise Sat 4 Oct)"); return;
    }
    if (state.stage === "lead:date") { d.date = text.trim(); state.stage = "lead:time"; pushBot("Din ka kaunsa time? Morning, Afternoon ya Evening?", ["Morning", "Afternoon", "Evening"]); return; }
    if (state.stage === "lead:time") { d.time = text.trim(); finishLead(); }
  }
  function finishLead() {
    var d = state.draft, slot = d.date ? d.date + ", " + d.time : "";
    state.stage = "idle";
    var msg = CA.buildMessage({
      intent: d.intent, parts: slot ? [["Mode", "showroom"], ["Slot", slot]] : [], marketing: false,
      text: d.intent === "ENQUIRY" ? "Asked Anita to be notified when a matching car is available." : "Sent through Anita chat."
    });
    // Called straight from the visitor's send for the visit flow (so a DM / WhatsApp window is not popup-blocked); the
    // ENQUIRY flow arrives from the 420 ms typing pause and may be blocked, in which case the box's link is the way in.
    window.ClassicAutoLeads.submitLead({
      name: d.name, phone: d.phone, car: state.car ? fmt.carLeadLabel(state.car) : "", message: msg,
      budget: state.car && state.car.price ? state.car.price : (state.budget || ""), visit_at: slot, page: "chat"
    }).then(function (r) {
      if (window.CA_TRACK) window.CA_TRACK("form_submit", { form: "enquiry", mode: r.mode, ok: true });
    });
    pushBot(slot ? "Request bhej di: " + slot + (state.car ? " (" + state.car.make + " " + state.car.model + ")" : "") + ". Hamari team message karke confirm karegi." : "Note kar liya. Hamari team message karegi.");
  }

  /* ------------------------------------------------------------------
     Hand-off to the team: the contact link comes from CA_SITE only
     ------------------------------------------------------------------ */
  function startHandoff() {
    var summary = "Hi Classic Auto, please get in touch. Car: " + (state.car ? fmt.carLabel(state.car) : "not decided") + ". Budget: " + (state.budgetLabel || "not shared") + ".";
    var m = CA.messageCta();
    var href = CA_SITE.whatsapp ? CA.waLink(summary) : m.href;
    pushBotHtml("Hamari team se seedhe baat karne ke liye yahan message kijiye." +
      '<a href="' + href + '" target="_blank" rel="noopener" class="btn btn-primary" data-ca-msg="' + esc(summary).replace(/"/g, "&quot;") + '" data-cta="message" data-at="anita" data-via="' + m.via + '" style="margin-top:10px; min-height:44px; display:flex;">' + esc(m.label) + '</a>');
  }

  function handleChipShortcut(label) {
    if (label === "Under ₹20 L") { respond("under 20 lakh"); return "alt"; }
    if (label === "₹20-50 L") { respond("around 35 lakh"); return "alt"; }
    if (label === "₹50 L and above") { respond("60 lakh"); return "alt"; }
    if (label === "Book a visit") {
      state.stage = "lead:name"; state.draft = { intent: "VISIT" };
      pushBot("Bilkul. Sabse pehle, kis naam se likhoon?");
      return true;
    }
    if (label === "Talk to the team") { startHandoff(); return true; }
    if (label === "Notify me when available") {
      state.stage = "lead:name"; state.draft = { intent: "ENQUIRY" };
      pushBot("Zaroor. Apna naam batayein, phir mobile number.");
      return true;
    }
    return false;
  }

  function submit(text) {
    if (!text) return;
    pushUser(text);
    chipsEl.innerHTML = "";
    var h = handleChipShortcut(text);
    if (h === true) return;
    if (h === "alt") return;
    if (state.stage === "lead:time") { respond(text); return; }
    showTyping();
    window.setTimeout(function () { hideTyping(); respond(text); }, 420);
  }

  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = inputEl.value; inputEl.value = "";
    submit(v);
  });
  }
  if (document.readyState === "complete" || document.getElementById("anitaRoot")) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
