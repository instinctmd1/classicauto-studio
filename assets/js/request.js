/* Request a car: a car the customer wants that is not in stock becomes a lead.
   Intent "CAR REQUEST" is encoded in the first line of `message` (7-key contract).
   After sending, the closest cars already on the floor are shown. */
(function () {
  "use strict";
  var form = document.getElementById("requestForm");
  if (!form || !window.ClassicAutoLeads || !window.CAForms) return;
  var F = window.CAForms, fmt = window.ClassicAuto, $ = function (id) { return document.getElementById(id); };
  var statusEl = $("rqStatus");
  form.querySelector("[data-extras]").innerHTML = F.extrasHTML("rq");

  // Deep links from stock filters and the quiz: ?make= &model= &body= &fuel= &trans= &budget= (lakh)
  var q = new URLSearchParams(window.location.search);
  [["make", "rqMake"], ["model", "rqModel"], ["body", "rqBody"], ["fuel", "rqFuel"], ["trans", "rqTrans"], ["budget", "rqBudget"]].forEach(function (m) {
    var v = q.get(m[0]); if (v) $(m[1]).value = v;
  });
  if (q.get("demo") === "1") $("rqDemo").checked = true;
  // Anything a deep link filled in the optional block must be visible to the visitor
  var more = $("rqMore");
  function openIfFilled() { if (more && ["rqBody", "rqTrans"].some(function (id) { return $(id).value; })) more.open = true; }
  openIfFilled();

  var rules = {
    rqBudget: function (el) { return +el.value >= 1 ? true : "Enter your budget in lakh."; },
    rqName: F.req("Enter your name."), rqPhone: F.phone
  };
  F.watch(form, rules);
  var started = false;
  form.addEventListener("focusin", function () { if (!started) { started = true; if (window.CA_TRACK) window.CA_TRACK("form_start", { form: "car_request" }); } });

  function wanted() {
    var bits = [$("rqMake").value.trim(), $("rqModel").value.trim()].filter(Boolean).join(" ");
    var body = $("rqBody").value ? fmt.bodyLabel($("rqBody").value) : "";
    var fuel = $("rqFuel").value;
    return [bits, body, fuel].filter(Boolean).join(" ") || "Any car";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var ok = F.validateAll(form, rules);
    var need = $("rqNeedCar");
    var hasCar = $("rqMake").value.trim() || $("rqModel").value.trim() || $("rqBody").value || $("rqFuel").value;
    need.style.display = hasCar ? "none" : "block";
    if (!hasCar) { ok = false; if (document.activeElement === document.body || !form.contains(document.activeElement)) $("rqMake").focus(); }
    if (!ok) { F.status(statusEl, "Check the highlighted fields and try again.", "error"); return; }

    var parts = [["Wanted", wanted()]];
    if ($("rqTrans").value) parts.push(["Gearbox", $("rqTrans").value]);
    if ($("rqYear").value) parts.push(["Year from", $("rqYear").value]);
    if ($("rqKm").value) parts.push(["Max km", Number($("rqKm").value).toLocaleString("en-IN")]);
    if ($("rqColour").value.trim()) parts.push(["Colour", $("rqColour").value.trim()]);
    parts.push(["Budget", "up to ₹" + $("rqBudget").value + " lakh"]);
    parts.push(["Ex-demo OK", $("rqDemo").checked ? "yes" : "no"]);
    if ($("rqWhen").value) parts.push(["Timeline", $("rqWhen").value]);
    var msg = window.CA.buildMessage({ intent: "CAR REQUEST", parts: parts, marketing: $("rqMarketing").checked, text: $("rqNotes").value.trim() });
    var budget = Math.round(+$("rqBudget").value * 100000);

    F.send(form, statusEl, {
      name: $("rqName").value.trim(), phone: $("rqPhone").value.trim(), car: "Wanted: " + wanted(), message: msg, budget: budget, visit_at: "", page: "request.html"
    }, "Request sent. We'll message you to talk it through.").then(function (r) {
      if (!r || !r.ok) return;
      showClose({ budgetMax: budget, body: $("rqBody").value ? [$("rqBody").value] : null, fuel: $("rqFuel").value ? [$("rqFuel").value] : null, trans: $("rqTrans").value || null, yearMin: +$("rqYear").value || 0, exDemo: $("rqDemo").checked, make: $("rqMake").value.trim() });
      form.reset(); started = false;
    });
  });

  function showClose(p) {
    var Match = window.CAMatch, Cards = window.ClassicAutoCards;
    if (!Match || !Cards) return;
    var make = (p.make || "").toLowerCase();
    var ranked = Match.rank(p).filter(function (r) { return r.pct >= 45; }).slice(0, 3);
    var section = $("closeMatches"), lead = $("closeLead");
    section.hidden = false;
    if (!ranked.length) {
      lead.textContent = "Nothing on the floor is close to this right now. Your request is with us, and you can browse everything we have in the meantime.";
      $("closeGrid").innerHTML = '<a class="btn btn-outline" href="stock.html" data-cta="see_stock" data-at="request_page">See all stock</a>';
    } else {
      lead.textContent = "These are the nearest matches to what you described. Tap one to see details or book a test drive.";
      $("closeGrid").innerHTML = ranked.map(function (r) { return Cards.cardHTML(r.car); }).join("");
      if (window.CA_MOTION && window.CA_MOTION.revealGrid) window.CA_MOTION.revealGrid($("closeGrid"));
      if (window.CA_MOTION && window.CA_MOTION.glints) window.CA_MOTION.glints($("closeGrid"));
    }
    section.scrollIntoView({ behavior: document.documentElement.classList.contains("reduce") ? "auto" : "smooth", block: "start" });
  }
})();
