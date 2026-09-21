/* =========================================================================
   Classic Auto — website-v5 — shared config + lead-capture contract. (unchanged from v4)
   Loaded first, before cars.js/main.js, on every page.
   ========================================================================= */
window.CA_ENDPOINT = window.CA_ENDPOINT || "";
window.CA_WHATSAPP_NUMBER = "919588990000";

/* -------------------------------------------------------------------------
   submitLead(lead) — the ONE lead-capture path used by both the car.html
   "Schedule a visit" form and Anita's chat hand-off, so the contract stays
   identical in both places.

   lead shape (exact JSON — do not deviate):
   { name, phone, car, message, budget, visit_at, page }

   When CA_ENDPOINT is set: POST as JSON to `${CA_ENDPOINT}/website`.
   When CA_ENDPOINT is empty (current default): never attempt the fetch —
   fall back to opening a wa.me link with the same fields prefilled into
   the message text.
   ------------------------------------------------------------------------- */
(function () {
  "use strict";

  function buildWaMessage(lead) {
    var lines = ["Hi Classic Auto,"];
    if (lead.car) lines.push("Car: " + lead.car);
    if (lead.budget) lines.push("Budget: " + lead.budget);
    if (lead.visit_at) lines.push("Preferred visit: " + lead.visit_at);
    if (lead.name) lines.push("Name: " + lead.name);
    if (lead.phone) lines.push("Phone: " + lead.phone);
    if (lead.message) lines.push(lead.message);
    return lines.join("\n");
  }

  function waLink(text) {
    return "https://wa.me/" + window.CA_WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);
  }

  function submitLead(lead) {
    var payload = {
      name: lead.name || "",
      phone: lead.phone || "",
      car: lead.car || "",
      message: lead.message || "",
      budget: lead.budget || "",
      visit_at: lead.visit_at || "",
      page: lead.page || ""
    };

    if (window.CA_ENDPOINT) {
      return fetch(window.CA_ENDPOINT + "/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return { ok: res.ok, mode: "endpoint" };
      }).catch(function () {
        // Endpoint failed — still give the lead a way through.
        window.open(waLink(buildWaMessage(payload)), "_blank", "noopener");
        return { ok: true, mode: "wa-fallback" };
      });
    }

    // No endpoint configured — wa.me is the only path, by design.
    window.open(waLink(buildWaMessage(payload)), "_blank", "noopener");
    return Promise.resolve({ ok: true, mode: "wa" });
  }

  window.ClassicAutoLeads = { submitLead: submitLead, waLink: waLink, buildWaMessage: buildWaMessage };
})();
