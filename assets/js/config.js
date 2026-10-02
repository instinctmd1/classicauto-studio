/* =========================================================================
   Classic Auto — website-v5 — shared config + lead-capture contract.
   Loaded first, before cars.js/main.js, on every page.
   ========================================================================= */
window.CA_ENDPOINT = window.CA_ENDPOINT || "";

/* -------------------------------------------------------------------------
   PHONE — deliberately EMPTY (owner decision, 2 Oct 2026): no phone number
   is shown anywhere until the new business number arrives. While it is
   empty there is no tel: or wa.me link on the site; every call/WhatsApp
   CTA falls back to "DM @classicauto_1974" on Instagram + the Prabhu Plaza
   address, and the forms copy the details and open Instagram instead.
   To switch calling/WhatsApp back on, set this ONE value (digits with the
   country code, no "+" or spaces, e.g. "91XXXXXXXXXX").
   ------------------------------------------------------------------------- */
window.CA_PHONE = window.CA_PHONE || "";
window.CA_WHATSAPP_NUMBER = window.CA_PHONE;
window.CA_INSTAGRAM_HANDLE = "@classicauto_1974";
window.CA_INSTAGRAM_URL = "https://instagram.com/classicauto_1974";
window.CA_ADDRESS = "135/136, 1st Floor, Prabhu Plaza, S.V. Road, next to Shankar Mandir, near Malad Railway Station, Malad West, Mumbai";

/* -------------------------------------------------------------------------
   SOCIAL — dealership social links, rendered as icons in the header (desktop,
   right of nav) and footer (every page), plus the "Follow us" strip on the
   home page. An empty entry hides its icon. Only Instagram is confirmed;
   Facebook/YouTube stay empty until Dad confirms the real handles, and
   WhatsApp follows CA_PHONE above.
   ------------------------------------------------------------------------- */
window.SOCIAL = {
  instagram: window.CA_INSTAGRAM_URL,
  facebook: "",
  youtube: "",
  whatsapp: window.CA_PHONE ? "https://wa.me/" + window.CA_PHONE : ""
};

/* -------------------------------------------------------------------------
   submitLead(lead) — the ONE lead-capture path used by both the car.html
   "Schedule a visit" form and Anita's chat hand-off, so the contract stays
   identical in both places.

   lead shape (exact JSON — do not deviate):
   { name, phone, car, message, budget, visit_at, page }

   When CA_ENDPOINT is set: POST as JSON to `${CA_ENDPOINT}/website`.
   When CA_ENDPOINT is empty (current default): never attempt the fetch —
   fall back to contact(): a wa.me link with the same fields prefilled when
   CA_PHONE is set, otherwise copy the same text to the clipboard and open
   the Instagram profile so the visitor can paste it into a DM.
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

  // No phone set -> the Instagram profile (never a number-less wa.me link).
  function waLink(text) {
    if (!window.CA_WHATSAPP_NUMBER) return window.CA_INSTAGRAM_URL;
    return "https://wa.me/" + window.CA_WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);
  }

  function copyText(text) {
    var ok = false;
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) { ok = false; }
    return ok;
  }

  // Opens the right channel for a prefilled message. Must run inside the
  // user's click/submit so the new tab isn't blocked as a popup.
  function contact(text) {
    if (window.CA_WHATSAPP_NUMBER) {
      window.open(waLink(text), "_blank", "noopener");
      return { ok: true, mode: "wa" };
    }
    var copied = copyText(text);
    window.open(window.CA_INSTAGRAM_URL, "_blank", "noopener");
    return { ok: true, mode: "instagram", copied: copied };
  }

  // Status line after a form hands off. waText is the original WhatsApp copy.
  function doneText(res, waText) {
    if (!res || res.mode !== "instagram") return waText;
    return (res.copied
      ? "Thanks! Your details are copied — paste them into a DM to "
      : "Thanks! Please send your details in a DM to ") +
      window.CA_INSTAGRAM_HANDLE + " on Instagram (it just opened in a new tab) and we'll confirm there.";
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
        return contact(buildWaMessage(payload));
      });
    }

    // No endpoint configured — WhatsApp (or Instagram while CA_PHONE is empty).
    return Promise.resolve(contact(buildWaMessage(payload)));
  }

  window.ClassicAutoLeads = { submitLead: submitLead, waLink: waLink, buildWaMessage: buildWaMessage, contact: contact, doneText: doneText };
})();
