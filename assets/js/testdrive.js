/* =========================================================================
   Home page — "Book a test drive": date + 30-minute slot chips (10:00–
   19:30) + At the showroom / Home test drive toggle -> shared lead
   contract (config.js), same visit_at format as car.html's visit form
   ("Sat 27 Sep, 4:00 pm").
   ========================================================================= */
(function () {
  "use strict";
  if (typeof CARS === "undefined" || !window.ClassicAuto || !window.ClassicAutoLeads) return;
  var fmt = window.ClassicAuto;
  var form = document.getElementById("homeTestDriveForm");
  if (!form) return;

  var carSel = document.getElementById("tdCar");
  if (carSel) {
    CARS.filter(function (c) { return c.status !== "SOLD"; }).forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = fmt.carLabel(c);
      carSel.appendChild(opt);
    });
  }

  var dateInput = document.getElementById("tdDate");
  var today = new Date();
  dateInput.min = today.toISOString().slice(0, 10);

  var slotsEl = document.getElementById("tdSlots");
  var selectedTime = "";

  function buildSlots() {
    slotsEl.innerHTML = "";
    selectedTime = "";
    var start = 10 * 60, end = 19 * 60 + 30; // 10:00 .. 19:30
    for (var m = start; m <= end; m += 30) {
      var h = Math.floor(m / 60), mi = m % 60;
      var ampm = h >= 12 ? "pm" : "am";
      var h12 = h % 12 === 0 ? 12 : h % 12;
      var label = h12 + ":" + (mi === 0 ? "00" : mi) + " " + ampm;
      var value = (h < 10 ? "0" + h : h) + ":" + (mi === 0 ? "00" : mi);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot-chip";
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("data-value", value);
      btn.textContent = label;
      btn.addEventListener("click", function () {
        slotsEl.querySelectorAll(".slot-chip").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        this.setAttribute("aria-pressed", "true");
        selectedTime = this.getAttribute("data-value");
      });
      slotsEl.appendChild(btn);
    }
  }
  buildSlots();

  function humanizeVisit(dateStr, timeStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr + "T00:00:00");
    var dayLabel = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    var timeLabel = "";
    if (timeStr) {
      var parts = timeStr.split(":");
      var h = parseInt(parts[0], 10), m = parts[1];
      var ampm = h >= 12 ? "pm" : "am";
      var h12 = h % 12 === 0 ? 12 : h % 12;
      timeLabel = ", " + h12 + ":" + m + " " + ampm;
    }
    return dayLabel + timeLabel;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = document.getElementById("tdName").value.trim();
    var phone = document.getElementById("tdPhone").value.trim();
    var date = dateInput.value;
    var modeInput = form.querySelector('input[name="tdMode"]:checked');
    var mode = modeInput ? modeInput.value : "showroom";
    var carId = carSel ? carSel.value : "";
    var car = carId ? CARS.filter(function (c) { return c.id === carId; })[0] : null;

    var ok = true;
    [["tdName", name], ["tdPhone", phone], ["tdDate", date]].forEach(function (pair) {
      var field = document.getElementById(pair[0]).closest(".field");
      if (!pair[1]) { field.classList.add("has-error"); ok = false; }
      else field.classList.remove("has-error");
    });
    var statusEl = document.getElementById("tdStatus");
    if (!selectedTime) ok = false;
    if (!ok) {
      statusEl.textContent = "Please fill in every field, including a time slot.";
      statusEl.className = "form-status is-error";
      return;
    }

    var visitAt = humanizeVisit(date, selectedTime);
    statusEl.textContent = "Sending your request…";
    statusEl.className = "form-status";
    window.ClassicAutoLeads.submitLead({
      name: name, phone: phone, car: car ? fmt.carFullLabel(car) : "",
      message: mode === "home"
        ? "Home test drive requested (Mumbai western suburbs)."
        : "Showroom test drive requested (Malad West).",
      budget: "", visit_at: visitAt, page: "index.html#testDriveSection"
    }).then(function () {
      statusEl.textContent = "Thanks! We'll confirm your slot on WhatsApp shortly.";
      statusEl.className = "form-status is-ok";
      form.reset();
      buildSlots();
    });
  });
})();
