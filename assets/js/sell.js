/* Sell page — validates then submits via the shared lead contract. */
(function () {
  "use strict";
  var form = document.getElementById("sellForm");
  if (!form || !window.ClassicAutoLeads) return;
  var statusEl = document.getElementById("sellStatus");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var fields = ["sellMake", "sellYear", "sellKm", "sellPrice", "sellName", "sellPhone"];
    var ok = true;
    var values = {};
    fields.forEach(function (id) {
      var input = document.getElementById(id);
      values[id] = input.value.trim();
      var fieldWrap = input.closest(".field");
      if (!values[id]) { fieldWrap.classList.add("has-error"); ok = false; }
      else fieldWrap.classList.remove("has-error");
    });
    if (!ok) {
      statusEl.textContent = "Please fill in every required field.";
      statusEl.className = "form-status is-error";
      return;
    }

    var notes = document.getElementById("sellNotes").value.trim();
    statusEl.textContent = "Sending your details…";
    statusEl.className = "form-status";

    window.ClassicAutoLeads.submitLead({
      name: values.sellName, phone: values.sellPhone,
      car: values.sellMake + " (" + values.sellYear + ")",
      message: "Sell/exchange enquiry — KM: " + values.sellKm + ", Expected price: ₹" + values.sellPrice + " Lakh." + (notes ? (" Notes: " + notes) : ""),
      budget: "", visit_at: "", page: "sell.html"
    }).then(function () {
      statusEl.textContent = "Thanks! We'll review your car and reply on WhatsApp, usually within a day.";
      statusEl.className = "form-status is-ok";
      form.reset();
    });
  });
})();
