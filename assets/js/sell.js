/* Sell / exchange page: validates, then submits via the shared lead contract.
   Intent SELL or EXCHANGE is encoded in the first line of `message`. */
(function () {
  "use strict";
  var form = document.getElementById("sellForm");
  if (!form || !window.ClassicAutoLeads || !window.CAForms) return;
  var F = window.CAForms, fmt = window.ClassicAuto;
  var statusEl = document.getElementById("slStatus");
  var $ = function (id) { return document.getElementById(id); };

  form.querySelector("[data-extras]").innerHTML = F.extrasHTML("sl");

  var target = $("slTarget");
  if (typeof CARS !== "undefined") CARS.filter(function (c) { return c.status !== "SOLD"; }).forEach(function (c) {
    var o = document.createElement("option"); o.value = c.id; o.textContent = fmt.carFullLabel(c); target.appendChild(o);
  });

  var mode = "sell";
  var submitBtn = $("slSubmit");
  function setMode(m) {
    mode = m;
    $("slTargetWrap").hidden = m !== "exchange";
    submitBtn.textContent = m === "exchange" ? "Send exchange details" : "Send my car details";
    submitBtn.setAttribute("data-cta", m === "exchange" ? "exchange" : "sell");
    var radio = form.querySelector('input[name="slMode"][value="' + m + '"]'); if (radio) radio.checked = true;
  }
  form.addEventListener("change", function (e) { if (e.target.name === "slMode") setMode(e.target.value); });
  var q = new URLSearchParams(window.location.search);
  if (q.get("mode") === "exchange" || window.location.hash === "#exchange") setMode("exchange");
  if (q.get("car")) { target.value = q.get("car"); if (target.value) setMode("exchange"); }

  var rules = {
    slMake: F.req("Enter the make."), slModel: F.req("Enter the model."),
    slYear: function (el) { var y = +el.value, max = new Date().getFullYear() + 1; return y >= 1990 && y <= max ? true : "Enter a year between 1990 and " + max + "."; },
    slKm: function (el) { return el.value !== "" && +el.value >= 0 ? true : "Enter the kilometres."; },
    slName: F.req("Enter your name."), slPhone: F.phone
  };
  F.watch(form, rules);
  var started = false;
  form.addEventListener("focusin", function () { if (!started) { started = true; if (window.CA_TRACK) window.CA_TRACK("form_start", { form: mode === "exchange" ? "exchange" : "sell" }); } });

  /* ---- two short steps: the car, then the person. Enter on step 1 means Next. ---- */
  var step = 1, s1 = $("slStep1"), s2 = $("slStep2"), t1 = $("slStep1Tab"), t2 = $("slStep2Tab");
  var carRules = { slMake: rules.slMake, slModel: rules.slModel, slYear: rules.slYear, slKm: rules.slKm };
  function showStep(n, focusFirst) {
    step = n; s1.hidden = n !== 1; s2.hidden = n !== 2;
    t1.classList.toggle("is-on", n === 1); t2.classList.toggle("is-on", n === 2);
    if (n === 1) t1.setAttribute("aria-current", "step"); else t1.removeAttribute("aria-current");
    if (n === 2) t2.setAttribute("aria-current", "step"); else t2.removeAttribute("aria-current");
    F.status(statusEl, "", "");
    if (focusFirst) { var f = (n === 2 ? $("slName") : $("slMake")); if (f) f.focus({ preventScroll: true }); }
    if (n === 2 && form.scrollIntoView) form.scrollIntoView({ block: "nearest" });
  }
  function next() { if (F.validateAll(form, carRules)) showStep(2, true); else F.status(statusEl, "Check the highlighted fields and try again.", "error"); }
  $("slNext").addEventListener("click", next);
  $("slBack").addEventListener("click", function () { showStep(1, true); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (step === 1) { next(); return; }
    if (!F.validateAll(form, rules)) { F.status(statusEl, "Check the highlighted fields and try again.", "error"); return; }
    var carDesc = $("slMake").value.trim() + " " + $("slModel").value.trim() + " " + $("slYear").value;
    var parts = [["Your car", carDesc], ["Driven", Number($("slKm").value).toLocaleString("en-IN") + " km"]];
    if ($("slRto").value.trim()) parts.push(["RTO", $("slRto").value.trim().toUpperCase()]);
    if ($("slPrice").value) parts.push(["Expected", "₹" + $("slPrice").value + " lakh"]);
    var tgt = target.value && typeof CARS !== "undefined" ? CARS.filter(function (c) { return c.id === target.value; })[0] : null;
    if (mode === "exchange" && tgt) parts.push(["Exchange for", fmt.carLeadLabel(tgt)]);
    var msg = window.CA.buildMessage({ intent: mode === "exchange" ? "EXCHANGE" : "SELL", parts: parts, marketing: $("slMarketing").checked, text: $("slNotes").value.trim() });
    F.send(form, statusEl, {
      name: $("slName").value.trim(), phone: $("slPhone").value.trim(), car: carDesc, message: msg,
      budget: tgt && tgt.price ? tgt.price : "", visit_at: "", page: "sell.html" + (mode === "exchange" ? "#exchange" : "")
    }, "Sent. We'll message you to arrange an inspection.").then(function (r) { if (r && r.ok) { form.reset(); setMode("sell"); started = false; var msg = statusEl.textContent, cls = statusEl.className; showStep(1, false); statusEl.textContent = msg; statusEl.className = cls; } });
  });
})();
