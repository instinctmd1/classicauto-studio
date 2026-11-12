/* Home page "Request a test drive": showroom or home request, date, time of
   day (30-minute slots only once CA_SITE.hours is set), required 18+ licence
   box -> shared lead contract. Intent is encoded in the first line of `message`. */
(function () {
  "use strict";
  var form = document.getElementById("homeTestDriveForm");
  if (!form || typeof CARS === "undefined" || !window.ClassicAuto || !window.ClassicAutoLeads || !window.CAForms) return;
  var fmt = window.ClassicAuto, F = window.CAForms;

  form.querySelector("[data-extras]").innerHTML = F.extrasHTML("td", { licence: true });

  var carSel = document.getElementById("tdCar");
  CARS.filter(function (c) { return c.status !== "SOLD"; }).forEach(function (c) {
    var o = document.createElement("option"); o.value = c.id; o.textContent = fmt.carFullLabel(c); carSel.appendChild(o);
  });

  var dateInput = document.getElementById("tdDate");
  dateInput.min = F.todayISO();
  var slots = F.buildSlots(document.getElementById("tdSlots"), function () { F.clearError(document.getElementById("tdSlots")); });
  var note = document.getElementById("tdSlotNote");
  if (note) note.textContent = slots.note;
  var statusEl = document.getElementById("tdStatus");

  var rules = {
    tdName: F.req("Enter your name."),
    tdPhone: F.phone,
    tdDate: F.req("Pick a date."),
    tdLicence: function (el) { return el.checked ? true : "Please confirm this to request a test drive."; }
  };
  F.watch(form, rules);
  var firstFocus = true;
  form.addEventListener("focusin", function () {
    if (firstFocus) { firstFocus = false; if (window.CA_TRACK) window.CA_TRACK("form_start", { form: "test_drive" }); }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var ok = F.validateAll(form, rules);
    if (!slots.get()) { F.setError(document.getElementById("tdSlots"), "Choose a time of day."); ok = false; }
    if (!ok) { F.status(statusEl, "Check the highlighted fields and try again.", "error"); return; }

    var mode = (form.querySelector('input[name="tdMode"]:checked') || {}).value || "showroom";
    var car = carSel.value ? CARS.filter(function (c) { return c.id === carSel.value; })[0] : null;
    var slot = F.humanDate(dateInput.value) + ", " + slots.get();
    var marketing = document.getElementById("tdMarketing").checked;
    var msg = window.CA.buildMessage({
      intent: "TEST DRIVE",
      parts: [["Mode", mode === "home" ? "home request" : "showroom"], ["Slot", slot]],
      licence: true, marketing: marketing,
      text: mode === "home" ? "Home test drive requested. Please confirm if possible." : ""
    });
    F.send(form, statusEl, {
      name: document.getElementById("tdName").value.trim(), phone: document.getElementById("tdPhone").value.trim(),
      car: car ? fmt.carLeadLabel(car) : "", message: msg, budget: car && car.price ? car.price : "",
      visit_at: slot, page: "index.html#testDriveSection"
    }, "Request sent. We'll confirm your slot by message.").then(function (r) {
      if (r && r.ok) { form.reset(); slots.reset(); firstFocus = true; }
    });
  });
})();
