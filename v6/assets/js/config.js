/* =========================================================================
   Classic Auto v6: shared config + lead-capture contract.
   Loaded first on every page. Everything that shows contact details reads
   window.CA_SITE; nothing else in the site hard-codes a phone number, a
   WhatsApp link or an address (rule N2).
   ========================================================================= */
window.CA_ENDPOINT = window.CA_ENDPOINT || "";
/* "" on pages at the site root; "../../" on the static car pages (cars/<id>/index.html). Every URL the scripts build goes through CA.root / CA.rootify. */
window.CA_ROOT = window.CA_ROOT || "";

window.CA_SITE = {
  name: "Classic Auto", since: 1974,
  phone: null,          // "+91XXXXXXXXXX" once the new business number lands. null => no phone, no tel:, no CALL NOW
  whatsapp: null,       // digits only "91XXXXXXXXXX". null => WhatsApp buttons become "DM @classicauto_1974"
  instagram: "classicauto_1974",
  ig_followers_label: "20K", ig_posts: 1376, ig_as_of: "2026-10-02",
  address_lines: ["135/136, 1st Floor, Prabhu Plaza, S.V. Road",
                  "Next to Shankar Mandir, near Malad Railway Station",
                  "Malad West, Mumbai"],
  maps_url: null,       // null => https://www.google.com/maps/search/?api=1&query=<url-encoded address>
  hours: "Mon-Sun 10:00-21:00",  // the showroom hours (engine config dealer.hours, set 7 Oct 2026). JSON-LD writes it as "Mo-Su 10:00-21:00"
  google_review_url: null, google_profile_url: null,
  google_rating: null,  // { value: 4.6, count: 120, as_of: "YYYY-MM-DD" }, typed from the Business Profile, never guessed
  facebook: null, youtube: null,           // only verified URLs
  inspection_points: null,                 // 150 once Dad confirms the checklist is in daily use
  finance_partners: [],                    // names only after Dad confirms
  stock_count: null,
  park_and_sell_badge: false,              // Dad decides whether consignment cars carry a visible badge
  reserve: { enabled: false, amount: null, terms_url: null, payment_link: null },
  features: { ar: false, analytics: true, anita: true, cloth_variant: "linen" },  // "red-satin" once re-rendered
  retention: { enquiries_months: 24, events_months: 13, confirmed: false },       // shown on the privacy page only once Dad confirms (confirmed: true)
  grievance_name: null,                     // the named grievance contact on the privacy page
  // what Classic Auto does: footer, About and FAQ read this list. Only services Dad has confirmed (FACTS.md + "We handle the RC transfer paperwork")
  services: ["Buy", "Sell", "Exchange", "Upgrade", "Easy finance", "Park & Sell", "RC transfer paperwork"],
  rc_transfer_fee: null,                    // rupees, once Dad sets the figure to quote. null => the car page says "We'll confirm it"
  // a slim dated bar above the header (festive greetings, a real offer). Text only once Dad approves it, no discount wording unless he confirms an offer.
  // e.g. { text: "Shubh Navratri from all of us at Classic Auto", starts: "2026-10-11", ends: "2026-10-21", link: "stock.html", link_label: "See the cars" }
  announcement: null
};
window.CA_WHATSAPP_NUMBER = window.CA_SITE.whatsapp || "";   // back-compat for v5 code paths

/* -------------------------------------------------------------------------
   Contact helpers (the only place that decides what a CTA says and links to)
   ------------------------------------------------------------------------- */
(function () {
  "use strict";
  var S = window.CA_SITE;

  /* URLs for pages that live in a sub-folder (rule: assets paths use the ../../ prefix, no <base>) */
  function root(p) { return window.CA_ROOT && p && !/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(p) ? window.CA_ROOT + p : p; }
  function rootify(html) {
    var r = window.CA_ROOT;
    return r ? String(html).replace(/(\s(?:href|src)=")(?![a-z][a-z0-9+.-]*:|#|\/)([^"]*)"/gi, function (m, a, u) { return a + r + u + '"'; }) : html;
  }
  function igDm() { return "https://ig.me/m/" + S.instagram; }
  function mapsUrl() {
    return S.maps_url || ("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(S.address_lines.join(", ")));
  }
  function waLink(text) {
    if (!S.whatsapp) return igDm();
    return "https://wa.me/" + S.whatsapp + (text ? "?text=" + encodeURIComponent(text) : "");
  }
  function telLink() { return S.phone ? "tel:" + S.phone.replace(/[^\d+]/g, "") : null; }
  function addressOneLine() { return S.address_lines.join(", "); }

  /* Primary contact CTA: WhatsApp when set, otherwise a DM on Instagram. */
  function messageCta() {
    return S.whatsapp
      ? { label: "WhatsApp us", href: waLink(), via: "whatsapp", external: true }
      : { label: "DM @" + S.instagram, href: igDm(), via: "instagram_dm", external: true };
  }
  function visitCta() {
    return { label: "Visit us · Prabhu Plaza, Malad West", short: "Visit", href: mapsUrl(), via: "maps", external: true };
  }
  function callCta() {
    return S.phone ? { label: "CALL NOW", href: telLink(), via: "tel", external: false } : null;
  }

  /* Intent-encoded lead message (first line carries the structured part). */
  function buildMessage(o) {
    var head = ["Intent: " + o.intent];
    (o.parts || []).forEach(function (p) { if (p[1]) head.push(p[0] + ": " + p[1]); });
    if (o.licence != null) head.push("Licence 18+: " + (o.licence ? "yes" : "no"));
    head.push("Marketing consent: " + (o.marketing ? "yes" : "no"));
    return head.join(" | ") + (o.text ? "\n" + o.text : "");
  }

  /* Human-readable text used for wa.me / Instagram DM fallbacks. The structured first line of `message`
     ("Intent: SELL | ... | Marketing consent: no") is for the engine only: it is turned into plain words here, never pasted. */
  var INTENT_WORDS = {
    "TEST DRIVE": "I'd like to book a test drive.", VISIT: "I'd like to visit the showroom.", RESERVE: "I'd like to reserve this car.",
    EXCHANGE: "I'd like to exchange my car.", SELL: "I'd like to sell my car.", OFFER: "I'd like to make an offer.",
    EMI: "I'd like an EMI quote.", "CAR REQUEST": "I'm looking for a car."
  };
  function plainMessage(message) {
    var parts = String(message || "").split("\n"), head = parts.shift(), out = [];
    if (/^Intent: /.test(head)) {
      var segs = head.split(" | "), intent = segs.shift().slice(8).trim();
      if (INTENT_WORDS[intent]) out.push(INTENT_WORDS[intent]);
      segs.forEach(function (seg) { if (!/^(Marketing consent|Licence 18\+):/.test(seg)) out.push(seg); });
    } else if (head) out.push(head);
    return out.concat(parts).filter(Boolean);
  }
  function readableMessage(p) {
    var lines = ["Hi Classic Auto,"];
    if (p.car) lines.push("Car: " + p.car);
    if (p.budget) lines.push("Budget: " + p.budget);
    if (p.visit_at) lines.push("Preferred visit: " + p.visit_at);
    if (p.name) lines.push("Name: " + p.name);
    if (p.phone) lines.push("Phone: " + p.phone);
    return lines.concat(plainMessage(p.message)).join("\n");
  }
  function buildWaMessage(lead) { return readableMessage(lead); }

  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    } catch (e) { /* fall through */ }
    return Promise.resolve(false);
  }

  /* Selectable fallback box so the lead is never silently lost (rule: step 3). */
  function showFallbackBox(text, via) {
    var old = document.getElementById("caFallback");
    if (old) old.remove();
    var wa = via === "whatsapp";
    var box = document.createElement("div");
    box.className = "ca-fallback";
    box.id = "caFallback";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", wa ? "Send your message on WhatsApp" : "Send your message on Instagram");
    box.innerHTML =
      '<p class="ca-fallback-title">' + (wa ? "Send this on WhatsApp" : "Send this on Instagram") + '</p>' +
      '<p class="ca-fallback-sub">' + (wa ? "Tap Open WhatsApp and send the message." : "We copied your message. Open the DM and paste it, or copy it from here.") + '</p>' +
      '<textarea readonly rows="6" aria-label="Your message"></textarea>' +
      '<div class="ca-fallback-row">' +
        '<button type="button" class="btn btn-ghost" data-act="copy">Copy again</button>' +
        '<a class="btn btn-primary" href="' + (wa ? waLink(text) : igDm()) + '" target="_blank" rel="noopener">' + (wa ? "Open WhatsApp" : "Open Instagram DM") + '</a>' +
        '<button type="button" class="btn btn-ghost" data-act="close">Close</button>' +
      '</div>';
    box.querySelector("textarea").value = text;
    document.body.appendChild(box);
    box.addEventListener("click", function (e) {
      var act = e.target.getAttribute && e.target.getAttribute("data-act");
      if (act === "close") box.remove();
      if (act === "copy") { var ta = box.querySelector("textarea"); ta.select(); copyText(text); }
    });
    var ta = box.querySelector("textarea");
    ta.focus(); ta.select();
  }

  function toast(msg) {
    var t = document.getElementById("caToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "caToast"; t.className = "ca-toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove("is-on"); }, 3600);
  }

  /* -----------------------------------------------------------------------
     submitLead(lead): the ONE lead-capture path. Payload is exactly 7 keys:
     { name, phone, car, message, budget, visit_at, page }  (rule N7)
     Fallback chain:
       1. CA_ENDPOINT set  -> POST JSON to `${CA_ENDPOINT}/website`
       2. endpoint absent (the click is still the user's gesture): whatsapp set -> open wa.me prefilled;
          otherwise copy the message and open the Instagram DM, with the text in a box
       3. endpoint failed (the gesture is gone after the await, and a popup would be blocked): no window is opened.
          The box shows the message with an Open WhatsApp / Open Instagram DM link the visitor taps.
     ----------------------------------------------------------------------- */
  function submitLead(lead) {
    var payload = {
      name: lead.name || "",
      phone: lead.phone || "",
      car: lead.car || "",
      message: lead.message || "",
      budget: lead.budget === 0 || lead.budget ? lead.budget : "",
      visit_at: lead.visit_at || "",
      page: lead.page || ""
    };
    var text = readableMessage(payload);

    function fallback(canOpen) {
      var via = S.whatsapp ? "whatsapp" : "instagram";
      copyText(text);
      if (canOpen) window.open(via === "whatsapp" ? waLink(text) : igDm(), "_blank", "noopener");
      if (via === "instagram" || !canOpen) showFallbackBox(text, via);
      return { ok: true, mode: via, opened: !!canOpen };
    }

    if (window.CA_ENDPOINT) {
      return fetch(window.CA_ENDPOINT + "/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error("endpoint " + res.status);
        return res.json().catch(function () { return {}; }).then(function (j) {
          return { ok: true, mode: "endpoint", lead_id: j && j.lead_id };
        });
      }).catch(function () { return fallback(false); });
    }
    return Promise.resolve(fallback(true));
  }

  window.ClassicAutoLeads = {
    submitLead: submitLead, waLink: waLink, buildWaMessage: buildWaMessage,
    buildMessage: buildMessage, copyText: copyText, showFallbackBox: showFallbackBox
  };
  window.CA = {
    site: S, igDm: igDm, mapsUrl: mapsUrl, waLink: waLink, telLink: telLink, addressOneLine: addressOneLine,
    messageCta: messageCta, visitCta: visitCta, callCta: callCta, root: root, rootify: rootify,
    buildMessage: buildMessage, copyText: copyText, toast: toast, showFallbackBox: showFallbackBox
  };

  /* Messaging links with a prefilled text. On Instagram there is no prefill
     parameter, so copy the text first and tell the visitor to paste it. */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-ca-msg]");
    if (!a) return;
    if (S.whatsapp) return; // wa.me carries the text itself
    var msg = a.getAttribute("data-ca-msg");
    if (msg) copyText(msg).then(function (ok) { if (ok) toast("Message copied. Paste it in the DM."); });
  });
})();
