/* Classic Auto v6: "Bought from us? Review Classic Auto on Google".
   Loaded on every page by chrome.js (one line). Everything reads window.CA_SITE:
     google_review_url   Google's own review box for our listing. A website cannot post a review into Google: the button opens Google.
     google_rating       { value, count, as_of } typed from the listing, shown with its date. Never guessed.
     google_live         { enabled, api_key }: live rating from the Places API (New). Off until Dad sets it up (tools/README.md).
   Where the ask shows (no markup needed on most pages):
     [data-review-ask="<variant>"]   any placeholder (variants: page, card, strip, qr)
     home      after the Reviews teaser            car pages  a strip above the footer
     finder    under the shortlist (#fdResults, #quizResults)   review.html  the full page block
     returning visitors: one small dismissible card (second visit day on; "Not now" hides it for 45 days, tapping the button for good).
   Policy (Google's review rules + India's CCPA 2022 guidelines): the same ask goes to everyone. Nothing here asks how the
   visit went first, filters unhappy buyers away, or offers anything in return for a review. */
(function () {
  "use strict";
  var S = window.CA_SITE, CA = window.CA;
  if (!S || !CA || !S.google_review_url) return;
  var D = document, KEY = "ca_review_ask", DAY = 864e5;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }
  function write(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* storage blocked: the prompt just shows less cleverly */ } }

  /* stylesheet next to this script (works on the root pages and on cars/<id>/ alike) */
  if (!D.getElementById("raCss")) {
    var l = D.createElement("link"); l.id = "raCss"; l.rel = "stylesheet"; l.href = CA.root("assets/css/review-ask.css"); D.head.appendChild(l);
  }

  var QR = CA.root("assets/brand/google-review-qr.svg");
  var STAR = '<svg class="ra-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z"/></svg>';

  /* the rating line: "4.2 on Google from 208 reviews, as of 15 Oct 2026" (live: "... right now, from Google") */
  var rating = S.google_rating && S.google_rating.value && S.google_rating.count ? { value: +S.google_rating.value, count: +S.google_rating.count, as_of: S.google_rating.as_of, live: false } : null;
  function ratingText(r) {
    if (!r) return "";
    var when = r.live ? "live from Google" : (r.as_of ? "as of " + new Date(r.as_of + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
    return r.value.toFixed(1) + " on Google from " + r.count.toLocaleString("en-IN") + " reviews" + (when ? ", " + when : "");
  }
  function ratingHtml() { return '<p class="ra-rating" data-ra-rating' + (rating ? "" : " hidden") + '>' + STAR + '<span>' + esc(ratingText(rating)) + '</span></p>'; }

  function button(at, cls) {
    return '<a class="btn btn-primary ra-btn' + (cls ? " " + cls : "") + '" href="' + esc(S.google_review_url) + '" target="_blank" rel="noopener" ' +
      'data-cta="write_google_review" data-at="' + at + '" data-ra-go>Review Classic Auto on Google</a>';
  }
  function qrFigure(cls) {
    return '<figure class="ra-qr' + (cls ? " " + cls : "") + '"><img src="' + QR + '" width="148" height="148" alt="QR code that opens Google\'s review box for Classic Auto" loading="lazy">' +
      '<figcaption>Scan with the phone camera</figcaption></figure>';
  }

  var BLOCKS = {
    /* the /review page: big, with the three steps */
    page: function () {
      return '<div class="ra ra--page"><div class="ra-main">' +
        '<p class="ra-kicker">Bought a car from us?</p>' +
        '<h2 class="ra-title">Review Classic Auto on Google</h2>' +
        '<p class="ra-copy">Your words help the next family choosing a car. Write it the way it happened: good, bad or in between. It takes about a minute.</p>' +
        '<div class="ra-actions">' + button("reviews") + '</div>' + ratingHtml() +      // the button first: on a phone it sits above the fold
        '<ol class="ra-steps"><li>Tap the button. Google opens its review box for Classic Auto, Malad West.</li><li>Sign in to Google if it asks.</li><li>Pick the stars, write a few lines in your own words, tap Post.</li></ol>' +
        '</div>' + qrFigure() + '</div>';
    },
    /* home + reviews areas: a card */
    card: function (at) {
      return '<div class="ra ra--card"><div class="ra-main">' +
        '<p class="ra-kicker">Bought from us?</p>' +
        '<h2 class="ra-title">Review Classic Auto on Google</h2>' +
        '<p class="ra-copy">One tap opens Google\'s review box for our Malad West showroom. Honest words, good or bad, help the next buyer.</p>' +
        '<div class="ra-actions">' + button(at || "reviews") + '</div>' + ratingHtml() +
        '</div>' + qrFigure("ra-qr--sm") + '</div>';
    },
    /* car pages + finder: one slim line */
    strip: function (at) {
      return '<div class="ra ra--strip"><p class="ra-copy"><b>Bought from us?</b> Tell other buyers how it went on Google.</p>' + button(at || "other", "btn-sm") + '</div>';
    },
    /* the reviews page already has its own Google buttons: only the QR */
    qr: function () { return '<div class="ra ra--qronly">' + qrFigure("ra-qr--sm") + '</div>'; }
  };

  function mount(el, variant, at) {
    if (!el || el.getAttribute("data-ra-done")) return;
    el.setAttribute("data-ra-done", "1");
    el.innerHTML = (BLOCKS[variant] || BLOCKS.card)(at);
  }
  function insertAfter(ref, variant, at, cls) {
    var box = D.createElement("section");
    box.className = "ra-slot" + (cls ? " " + cls : "");
    box.setAttribute("aria-label", "Review Classic Auto on Google");
    ref.parentNode.insertBefore(box, ref.nextSibling);
    mount(box, variant, at);
    return box;
  }

  /* 1. explicit placeholders */
  var AT = { page: "reviews", card: "reviews", qr: "reviews", strip: "other" };
  Array.prototype.forEach.call(D.querySelectorAll("[data-review-ask]"), function (el) {
    var v = el.getAttribute("data-review-ask") || "card";
    mount(el, v, el.getAttribute("data-at") || AT[v]);
  });

  /* 2. home: after the Reviews teaser */
  var teaser = D.querySelector('[data-page="home"] .review-teaser');
  if (teaser && !D.querySelector("[data-review-ask]")) insertAfter(teaser, "card", "reviews", "ra-slot--home");

  /* 3. car pages: a strip above the footer */
  var footer = D.querySelector(".site-footer");
  if (D.getElementById("carFound") && footer && !D.querySelector(".ra-slot--car")) {
    var c = D.createElement("div"); c.className = "container ra-slot ra-slot--car";
    footer.parentNode.insertBefore(c, footer);
    mount(c, "strip", "car_page");
  }

  /* 4. finder (finder.html #fdResults, the older quiz.html #quizResults): under the shortlist, once it shows */
  var results = D.getElementById("fdResults") || D.getElementById("quizResults");
  if (results && !results.querySelector("[data-review-ask]")) {
    var placeFinder = function () {
      if (results.hidden || results.querySelector(".ra-slot--finder")) return;
      var f = D.createElement("div"); f.className = "ra-slot ra-slot--finder"; results.appendChild(f); mount(f, "strip", "quiz");
    };
    placeFinder();
    if (window.MutationObserver) new MutationObserver(placeFinder).observe(results, { attributes: true, attributeFilter: ["hidden"] });
  }

  /* 5. a gentle prompt for returning visitors. Not on the review pages, never twice in one visit, never over a form being filled. */
  var st = read(), today = new Date().toISOString().slice(0, 10);
  if (st.last !== today) { st.days = (st.days || 0) + 1; st.last = today; write(st); }
  var page = D.body.getAttribute("data-page") || "";
  function promptAllowed() {
    var s = read();
    if (s.done || page === "reviews" || page === "review") return false;
    if (s.until && Date.now() < s.until) return false;
    if ((s.days || 0) < 2) return false;
    try { if (sessionStorage.getItem(KEY)) return false; } catch (e) { /* fine */ }
    return true;
  }
  function showPrompt() {
    if (!promptAllowed() || D.getElementById("raPrompt")) return;
    var a = D.activeElement;
    var busy = (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || D.querySelector("dialog[open], [aria-modal='true']:not([hidden])") ||
      D.body.classList.contains("nav-open");
    if (busy) { setTimeout(showPrompt, 15000); return; }           // a form, a dialog (the finder's choice) or the menu is open: later
    try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* fine */ }
    var p = D.createElement("aside");
    p.id = "raPrompt"; p.className = "ra-prompt"; p.setAttribute("aria-label", "Review Classic Auto on Google");
    p.innerHTML = '<button type="button" class="ra-x" data-ra-close aria-label="Close">&times;</button>' +
      '<p class="ra-kicker">Bought a car from us?</p><p class="ra-copy">A short Google review helps the next buyer. Tell it as it was.</p>' +
      '<div class="ra-prompt-row">' + button("other", "btn-sm") + '<button type="button" class="btn btn-ghost btn-sm" data-ra-close>Not now</button></div>';
    D.body.appendChild(p);
    requestAnimationFrame(function () { p.classList.add("is-on"); });
    function close() {
      var s = read(); s.until = Date.now() + 45 * DAY; write(s);
      p.classList.remove("is-on"); setTimeout(function () { p.remove(); }, 300);
      D.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    p.addEventListener("click", function (e) { if (e.target.closest("[data-ra-close]")) close(); });
    D.addEventListener("keydown", onKey);
  }
  if (promptAllowed()) setTimeout(showPrompt, 9000);

  /* tapping any review button: the visitor went to Google, so the prompt never shows again on this browser */
  D.addEventListener("click", function (e) {
    if (!e.target.closest || !e.target.closest("[data-ra-go], #googleWrite")) return;
    var s = read(); s.done = Date.now(); write(s);
    var pr = D.getElementById("raPrompt"); if (pr) pr.remove();
  });

  /* 6. live rating (Places API New, Place Details with only rating + userRatingCount). Off by default; when on, nothing is stored. */
  var L = S.google_live;
  if (L && L.enabled && L.api_key && S.google_place_id && window.fetch) {
    fetch("https://places.googleapis.com/v1/places/" + encodeURIComponent(S.google_place_id), {
      headers: { "X-Goog-Api-Key": L.api_key, "X-Goog-FieldMask": "rating,userRatingCount" }
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.rating || !j.userRatingCount) return;
      rating = { value: +j.rating, count: +j.userRatingCount, live: true };
      Array.prototype.forEach.call(D.querySelectorAll("[data-ra-rating]"), function (el) {
        el.hidden = false; el.querySelector("span").textContent = ratingText(rating);
      });
      var rv = D.getElementById("ratingValue"), rm = D.getElementById("ratingMeta"), gr = D.getElementById("googleRating");
      if (rv && rm && gr) { gr.hidden = false; rv.textContent = rating.value.toFixed(1); rm.textContent = "from " + rating.count.toLocaleString("en-IN") + " Google reviews, live from Google"; }
    }).catch(function () { /* keep the dated figure */ });
  }

  window.CA_REVIEW_ASK = { blocks: BLOCKS, mount: mount, ratingText: ratingText };
})();
