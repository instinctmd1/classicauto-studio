/* Questions and answers page (gap plan P1-6): search, topic chips and an accordion over the answers in faq.html, plus FAQPage
   JSON-LD built from those same answers, so the markup and the page can never disagree. Answers that depend on settings
   (contact line, hours, reserve token, finance partners) read window.CA_SITE like the rest of the site. */
(function () {
  "use strict";
  var list = document.getElementById("faqList");
  if (!list) return;
  var S = window.CA_SITE || {};
  var items = [].slice.call(list.querySelectorAll(".faq-item"));
  var search = document.getElementById("faqSearch"), chips = [].slice.call(document.querySelectorAll("[data-topic]")).filter(function (b) { return b.tagName === "BUTTON"; });
  var countEl = document.getElementById("faqCount"), emptyEl = document.getElementById("faqEmpty");
  var topic = "all";

  /* settings-driven lines */
  var rsv = S.reserve || {};
  if (rsv.enabled && rsv.payment_link && rsv.amount && rsv.terms_url) {
    var r = list.querySelector('[data-faq="reserve"]');
    if (r) r.textContent = "Where a car's page shows a refundable token, read its refund terms first; otherwise no payment is taken on the website.";
  }
  if (S.finance_partners && S.finance_partners.length) {
    var fp = list.querySelector('[data-faq="partners"]');
    if (fp) { fp.textContent = "We work with: " + S.finance_partners.join(", ") + "."; fp.hidden = false; }
  }

  function norm(s) { return String(s || "").toLowerCase().replace(/\s+/g, " "); }
  function apply() {
    var q = norm(search.value).trim(), shown = 0;
    items.forEach(function (it) {
      var okTopic = topic === "all" || it.getAttribute("data-topic") === topic;
      var okText = !q || norm(it.textContent).indexOf(q) > -1;
      it.hidden = !(okTopic && okText);
      if (!it.hidden) shown++;
      if (q && !it.hidden) it.open = true;
    });
    emptyEl.hidden = shown > 0;
    countEl.textContent = shown === items.length ? items.length + " answers" : shown + " of " + items.length + " answers";
  }
  chips.forEach(function (b) {
    b.addEventListener("click", function () {
      topic = b.getAttribute("data-topic");
      chips.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      apply();
    });
  });
  var t = null;
  search.addEventListener("input", function () { clearTimeout(t); t = setTimeout(apply, 120); });
  document.getElementById("faqClear").addEventListener("click", function () {
    search.value = ""; topic = "all"; chips.forEach(function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-topic") === "all")); }); apply(); search.focus();
  });
  // a link straight to one answer (faq.html#tcs style ids are not needed: ?q= works) opens it
  var q0 = new URLSearchParams(window.location.search).get("q");
  if (q0) search.value = q0.slice(0, 60);

  function buildJsonLd() {
    var ld = document.getElementById("faqJsonLd");
    if (!ld) return;
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: items.map(function (it) {
        return { "@type": "Question", name: it.querySelector(".faq-q").textContent.trim(),
          acceptedAnswer: { "@type": "Answer", text: it.querySelector(".faq-a").textContent.replace(/\s+/g, " ").trim() } };
      })
    });
  }
  // bindSite (main.js) fills the address, hours and contact line first; build the JSON-LD from the finished text
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { apply(); buildJsonLd(); });
  else { apply(); buildJsonLd(); }
})();
