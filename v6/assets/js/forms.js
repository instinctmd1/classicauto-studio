/* =========================================================================
   Classic Auto v6: shared form helpers. Every form gets the same consent
   line, an UNTICKED "send me new arrivals" box, a hidden honeypot, inline
   validation and a role="status" result line. Submits go through
   ClassicAutoLeads.submitLead (exactly 7 keys; the intent is encoded in the
   first line of `message`, see config.js buildMessage).
   ========================================================================= */
(function () {
  "use strict";
  var F = {};

  F.phoneOk = function (v) {
    var d = String(v || "").replace(/[\s\-().]/g, "");
    return /^(\+?91)?[6-9]\d{9}$/.test(d);
  };

  /* Honeypot + consent + marketing box (+ optional licence box). */
  F.extrasHTML = function (id, o) {
    o = o || {};
    var licence = o.licence
      ? '<div class="check-field" data-field data-licence>' +
          '<label class="check"><input type="checkbox" id="' + id + 'Licence" required><span>I am 18+ and hold a valid driving licence. <span class="req" aria-hidden="true">*</span></span></label>' +
          '<span class="field-error" role="alert">Please confirm this to request a test drive.</span>' +
        '</div>'
      : "";
    return (
      '<div class="hp" aria-hidden="true"><label>Leave this field empty<input type="text" id="' + id + 'Hp" name="company" tabindex="-1" autocomplete="off"></label></div>' +
      licence +
      '<div class="check-field">' +
        '<label class="check"><input type="checkbox" id="' + id + 'Marketing"><span>Send me new arrivals (optional)</span></label>' +
      '</div>' +
      '<p class="consent">By sending, you agree Classic Auto may contact you about this enquiry by phone, WhatsApp or Instagram. <a href="' + window.CA.root("privacy.html") + '">Privacy policy</a>.</p>'
    );
  };

  F.fieldOf = function (el) { return el.closest("[data-field], .field, .check-field"); };
  F.setError = function (el, msg) {
    var f = F.fieldOf(el); if (!f) return;
    f.classList.add("has-error");
    var err = f.querySelector(".field-error");
    if (err && msg) err.textContent = msg;
    el.setAttribute("aria-invalid", "true");
  };
  F.clearError = function (el) {
    var f = F.fieldOf(el); if (!f) return;
    f.classList.remove("has-error");
    el.removeAttribute("aria-invalid");
  };
  F.status = function (el, msg, kind) {
    el.textContent = msg;
    el.className = "form-status" + (kind ? " is-" + kind : "");
  };

  /* Inline validation: on blur, then on input once touched. */
  F.watch = function (form, rules) {
    Object.keys(rules).forEach(function (id) {
      var el = form.querySelector("#" + id);
      if (!el) return;
      var fld = F.fieldOf(el); if (fld) fld.classList.add("has-slot");     // the error line keeps its space, so showing or clearing it never moves what is under the pointer
      var check = function () {
        var res = rules[id](el);
        if (res === true) F.clearError(el); else F.setError(el, res);
        return res === true;
      };
      el.addEventListener("blur", function () { el.__touched = true; check(); });
      el.addEventListener("input", function () { if (el.__touched) check(); });
      el.__check = check;
    });
  };
  F.validateAll = function (form, rules) {
    var firstBad = null, ok = true;
    Object.keys(rules).forEach(function (id) {
      var el = form.querySelector("#" + id);
      if (!el) return;
      var res = rules[id](el);
      if (res === true) F.clearError(el);
      else { F.setError(el, res); ok = false; if (!firstBad) firstBad = el; }
    });
    if (firstBad) firstBad.focus();
    return ok;
  };
  F.req = function (msg) { return function (el) { return el.value.trim() ? true : msg; }; };
  F.phone = function (el) { return F.phoneOk(el.value) ? true : "Enter a 10-digit mobile number."; };

  /* ---- time-of-day / slot picker ------------------------------------- */
  function parseHours(h) {
    if (!h) return null;
    var m = String(h).match(/(\d{1,2}):(\d{2})\s*[\u2013\-]\s*(\d{1,2}):(\d{2})/);
    return m ? { s: +m[1] * 60 + +m[2], e: +m[3] * 60 + +m[4] } : null;
  }
  function label12(mins) {
    var h = Math.floor(mins / 60), mi = mins % 60, ap = h >= 12 ? "pm" : "am", h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ":" + (mi === 0 ? "00" : mi) + " " + ap;
  }
  F.slotOptions = function () {
    var hrs = parseHours(window.CA_SITE.hours);
    if (!hrs) return { exact: false, items: [["Morning", "Morning"], ["Afternoon", "Afternoon"], ["Evening", "Evening"]], note: "We'll confirm the exact time by message." };
    var items = [];
    for (var m = hrs.s; m <= hrs.e - 30; m += 30) items.push([label12(m), label12(m)]);
    return { exact: true, items: items, note: "" };
  };
  F.buildSlots = function (container, onPick) {
    var opts = F.slotOptions();
    container.innerHTML = "";
    var chosen = "";
    opts.items.forEach(function (it) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "slot-chip"; b.setAttribute("aria-pressed", "false"); b.textContent = it[1]; b.setAttribute("data-value", it[0]);
      b.addEventListener("click", function () {
        container.querySelectorAll(".slot-chip").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true"); chosen = it[0];
        if (onPick) onPick(chosen);
      });
      container.appendChild(b);
    });
    return { get: function () { return chosen; }, reset: function () { chosen = ""; container.querySelectorAll(".slot-chip").forEach(function (x) { x.setAttribute("aria-pressed", "false"); }); }, note: opts.note };
  };
  F.humanDate = function (iso) {
    if (!iso) return "";
    return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  };
  F.todayISO = function () { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

  /* Submit wrapper: honeypot, result line, per-mode confirmation text. */
  F.send = function (form, statusEl, lead, okMsg) {
    var hp = form.querySelector('input[name="company"]');
    if (hp && hp.value) { F.status(statusEl, "", ""); return Promise.resolve({ ok: false, blocked: true }); }
    F.status(statusEl, "Sending your request…", "");
    var btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
    return window.ClassicAutoLeads.submitLead(lead).then(function (r) {
      if (btn) btn.disabled = false;
      var msg = okMsg;
      if (r.mode === "instagram") msg = r.opened ? "Your message is copied. Paste it in the Instagram DM that just opened." : "Your message is copied. Use Open Instagram DM in the box and paste it.";
      else if (r.mode === "whatsapp") msg = r.opened ? "WhatsApp is open with your details. Tap send to finish." : "Tap Open WhatsApp in the box and send your details.";
      F.status(statusEl, msg, "ok");
      var intent = (((lead.message || "").match(/^Intent: ([A-Z ]+)/) || [])[1] || "").trim();
      var formName = { "TEST DRIVE": "test_drive", VISIT: "visit", RESERVE: "reserve", EXCHANGE: "exchange", SELL: "sell", OFFER: "offer", EMI: "emi", "CAR REQUEST": "car_request" }[intent] || "enquiry";
      if (window.CA_TRACK) window.CA_TRACK("form_submit", { form: formName, mode: r.mode, ok: true });
      return r;
    });
  };

  window.CAForms = F;
})();
