/* Reviews page (rule N6: real and never gated).
   - Google block: a rating shows only when CA_SITE.google_rating is set (typed from the Business Profile, never guessed).
   - "Write a review on Google" is visible to EVERY visitor whenever its URL exists. It never sits behind a rating question.
   - Private feedback is a separate form (not a gate): POST ${CA_ENDPOINT}/feedback, falling back to the Instagram copy flow.
   - Deliveries and testimonials come from reviews-data.js and need written consent on every entry. */
(function () {
  "use strict";
  var S = window.CA_SITE, F = window.CAForms, $ = function (id) { return document.getElementById(id); };
  if (!S || !F) return;

  /* ---- Google ---- */
  var r = S.google_rating, hasGoogle = false;
  if (r && r.value && r.count) {
    hasGoogle = true;
    $("googleRating").hidden = false;
    $("ratingValue").textContent = Number(r.value).toFixed(1);
    var asOf = r.as_of ? new Date(r.as_of + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
    $("ratingMeta").textContent = "from " + Number(r.count).toLocaleString("en-IN") + " Google reviews" + (asOf ? ", as of " + asOf : "");
  }
  if (S.google_review_url) { hasGoogle = true; var w = $("googleWrite"); w.href = S.google_review_url; w.hidden = false; $("publicLine").hidden = false; }
  if (S.google_profile_url) { hasGoogle = true; var rd = $("googleRead"); rd.href = S.google_profile_url; rd.textContent = r ? "Read all on Google" : "Find us on Google"; rd.hidden = false; }
  $("googleBlock").hidden = !hasGoogle;

  /* ---- deliveries + testimonials (consent required) ---- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function consented(e) { return e && e.consent && e.consent.date && e.consent.method && e.consent.file && e.source && e.date; }
  var items = [];
  (typeof DELIVERIES !== "undefined" ? DELIVERIES : []).filter(consented).forEach(function (d) {
    items.push('<figure class="review-card"><img src="' + esc(d.photo) + '" alt="' + esc(d.name + " collecting a " + d.car) + '" loading="lazy" width="800" height="600"><figcaption><b>' + esc(d.name) + '</b> ' + esc(d.car) + '</figcaption></figure>');
  });
  (typeof TESTIMONIALS !== "undefined" ? TESTIMONIALS : []).filter(consented).forEach(function (t) {
    items.push('<blockquote class="review-card"><p>“' + esc(t.quote) + '”</p><footer><b>' + esc(t.name) + '</b> ' + esc(t.car || "") + ' <small>via ' + esc(t.source) + '</small></footer></blockquote>');
  });
  if (items.length) { $("deliveries").innerHTML = items.join(""); $("reviewsEmpty").hidden = true; }

  /* ---- private feedback ---- */
  var form = $("feedbackForm"), st = $("fbStatus");
  form.querySelector("[data-extras]").innerHTML = F.extrasHTML("fb");
  var rules = {
    fbText: F.req("Write a few words for the team."),
    fbPhone: function (el) { return !el.value.trim() || F.phoneOk(el.value) ? true : "Enter a 10-digit mobile number, or leave it blank."; }
  };
  F.watch(form, rules);
  var started = false;
  form.addEventListener("focusin", function () { if (!started) { started = true; if (window.CA_TRACK) window.CA_TRACK("form_start", { form: "feedback" }); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var hp = form.querySelector('input[name="company"]');
    if (hp && hp.value) return;
    if (!F.validateAll(form, rules)) { F.status(st, "Check the highlighted fields and try again.", "error"); return; }
    var rating = form.querySelector('input[name="fbRating"]:checked');
    var body = {
      name: $("fbName").value.trim(), phone: $("fbPhone").value.trim(), car: $("fbCar").value.trim(),
      rating: rating ? +rating.value : null, text: $("fbText").value.trim(), contact_ok: $("fbContactOk").checked
    };
    var btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
    F.status(st, "Sending your feedback…", "");
    /* canOpen is true only on the synchronous no-endpoint path, where the click is still the visitor's gesture.
       After the fetch fails the gesture is gone and a popup would be blocked, so the box carries an Open Instagram DM link instead. */
    function viaInstagram(canOpen) {
      var text = "Feedback for Classic Auto" + (body.rating ? " (" + body.rating + "/5)" : "") + "\n" + (body.car ? "Car: " + body.car + "\n" : "") + (body.name ? "Name: " + body.name + "\n" : "") + body.text;
      window.CA.copyText(text);
      if (canOpen) window.open(window.CA.igDm(), "_blank", "noopener");
      window.CA.showFallbackBox(text);
      F.status(st, canOpen ? "Your message is copied. Paste it in the Instagram DM that just opened." : "Your message is copied. Use Open Instagram DM in the box and paste it.", "ok");
    }
    var go = window.CA_ENDPOINT
      ? fetch(window.CA_ENDPOINT + "/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
          .then(function (res) { if (!res.ok) throw new Error("endpoint " + res.status); F.status(st, "Thank you. Your feedback went to the team.", "ok"); return "endpoint"; })
          .catch(function () { viaInstagram(false); return "instagram"; })
      : Promise.resolve((viaInstagram(true), "instagram"));
    go.then(function (mode) {
      btn.disabled = false;
      if (window.CA_TRACK) window.CA_TRACK("form_submit", { form: "feedback", mode: mode, ok: true });
      form.reset(); started = false;
    });
  });
})();
