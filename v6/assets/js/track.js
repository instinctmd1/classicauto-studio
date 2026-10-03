/* Classic Auto v6: privacy-friendly analytics (SPEC 5.3), under 3 KB gzip. No cookies; `sid` is random per tab.
   Silent under Global Privacy Control / Do Not Track, features.analytics false, or an empty CA_ENDPOINT.
   Only whitelisted props leave the browser; the server checks them again. API: window.CA_TRACK(name, props). */
(function () {
  "use strict";
  var S = window.CA_SITE || {}, N = navigator, D = document;
  var ON = !(S.features && S.features.analytics === false) && N.globalPrivacyControl !== true && N.doNotTrack !== "1" && window.doNotTrack !== "1";
  window.CA_TRACK = function () {};
  if (!ON) return;

  var CTA = ["message", "call", "visit", "book_test_drive", "reserve", "exchange", "emi", "write_google_review", "see_stock", "offer", "sell", "request_car", "reviews", "studio", "other"];
  var AT = ["hero", "header", "sticky_bar", "car_page", "studio", "footer", "reviews", "anita", "quiz", "stock", "request_page", "sell_page", "other"];
  var FORM = ["test_drive", "visit", "reserve", "exchange", "sell", "enquiry", "feedback", "offer", "emi", "quiz", "car_request"];
  var PT = ["home", "stock", "catalogue", "car", "studio", "compare", "sell", "reviews", "other"];
  /* allowed props per event: an array of values, "n" number, "b" boolean or "s" short slug */
  var SPEC = {
    page_view: { pt: PT }, car_view: { band: "s", make: "s", seg: "s" },
    cta_click: { cta: CTA, at: AT, via: ["whatsapp", "instagram_dm", "tel", "maps"] },
    form_start: { form: FORM }, form_submit: { form: FORM, mode: ["endpoint", "whatsapp", "instagram"], ok: "b" },
    emi_calc_used: { tenure: "n", down: "n" }, filter_used: { f: ["band", "body", "fuel", "make", "segment", "trans"], v: "s" },
    hero_reveal: { stage: ["start", "half", "done"], "in": ["scroll", "drag", "key", "tap"] }, intro_skip: {},
    studio_open: { mode: ["studio", "daylight", "evening"], model: ["scan", "illustrative"] },
    studio_preset: { preset: ["front34", "rear34", "side", "top", "wheel", "headlight", "interior"] },
    studio_hotspot: { hotspot: ["wheels", "headlights", "interior", "engine", "boot"] },
    studio_tour: { done: "b" }, outbound: { host: "s" }
  };
  var PRIVATE = /@|\d{10,}/;

  function ok(rule, v) {
    if (rule === "b") return typeof v === "boolean";
    if (rule === "n") return typeof v === "number" && isFinite(v);
    if (typeof v !== "string") return false;
    return rule === "s" ? /^[\w .\-+&\/]{1,40}$/.test(v) && !PRIVATE.test(v) : rule.indexOf(v) > -1;
  }

  var mem = {};
  function ss(k, v) {
    try { if (v === undefined) return sessionStorage.getItem(k) || mem[k] || ""; sessionStorage.setItem(k, v); } catch (e) { /* blocked */ }
    if (v === undefined) return mem[k] || ""; mem[k] = v;
  }
  var sid = ss("ca_sid");
  if (!sid) { for (var i = 0; i < 16; i++) sid += "abcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(Math.random() * 36)); ss("ca_sid", sid); }
  if (!ss("ca_first")) {                                  // first page of the visit: referrer host and UTM, kept for the tab
    ss("ca_first", "1");
    var host = ""; try { host = new URL(D.referrer).hostname.replace(/^www\./, ""); } catch (e) { /* none */ }
    ss("ca_ref", host === location.hostname ? "" : host.slice(0, 60));
    var q = new URLSearchParams(location.search), u = {};
    [["s", "source"], ["m", "medium"], ["c", "campaign"], ["n", "content"]].forEach(function (p) {
      var v = (q.get("utm_" + p[1]) || "").slice(0, 40); if (/^[\w .\-+]{1,40}$/.test(v) && !PRIVATE.test(v)) u[p[0]] = v;
    });
    ss("ca_utm", JSON.stringify(u));
  }
  var UTM = {}; try { UTM = JSON.parse(ss("ca_utm") || "{}"); } catch (e) { /* ignore */ }
  var REF = ss("ca_ref"), W = window.innerWidth, DEV = W < 768 ? "m" : W < 1024 ? "t" : "d";

  var path = location.pathname.replace(/\/index\.html$/, "/");
  var pt = /\/cars\/[^\/]+\/$/.test(path) ? "car" : (/\/([a-z]+)\.html$/.exec(path) || [])[1] || (/\/$/.test(path) ? "home" : "other");
  pt = PT.indexOf(pt) > -1 ? pt : "other";
  var car = window.CA_CAR_ID || new URLSearchParams(location.search).get("id") || "";
  car = (pt === "car" || pt === "studio") && /^[a-z0-9-]{1,64}$/.test(car) ? car : "";

  var queue = [], sent = 0, timer = null;
  function stamp() {
    var d = new Date(), z = -d.getTimezoneOffset(), a = Math.abs(z), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()) +
      "." + ("00" + d.getMilliseconds()).slice(-3) + (z >= 0 ? "+" : "-") + p(Math.floor(a / 60)) + ":" + p(a % 60);
  }
  function flush() {
    clearTimeout(timer); timer = null;
    var url = window.CA_ENDPOINT && window.CA_ENDPOINT + "/event";
    if (!url) { queue = []; return; }
    while (queue.length) {                                // text/plain: no CORS preflight
      var json = queue.shift(), done = false;
      try { done = N.sendBeacon && N.sendBeacon(url, new Blob([json], { type: "text/plain" })); } catch (e) { /* fall back */ }
      if (!done) try { fetch(url, { method: "POST", body: json, headers: { "Content-Type": "text/plain" }, keepalive: true }).catch(function () {}); } catch (e) { /* offline */ }
    }
  }
  function track(name, props) {
    var rules = SPEC[name], x = {}, k;
    if (!rules || sent > 150) return;
    for (k in props || {}) if (rules[k] && ok(rules[k], props[k])) x[k] = props[k];
    var env = { v: 1, e: name, t: stamp(), sid: sid, p: path, ref: REF, utm: UTM, d: DEV, x: x };
    if (car) env.car = car;
    var json = JSON.stringify(env);
    if (json.length > 1000) return;
    sent++; queue.push(json);
    if (!timer) timer = setTimeout(flush, 1500);
  }
  window.CA_TRACK = track;
  D.addEventListener("visibilitychange", function () { if (D.visibilityState === "hidden") flush(); });
  window.addEventListener("pagehide", flush);

  track("page_view", { pt: pt });
  D.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a,button");
    if (!a) return;
    var cta = a.getAttribute("data-cta"), at = a.getAttribute("data-at"), href = a.getAttribute("href") || "";
    if (cta) {
      track("cta_click", { cta: CTA.indexOf(cta) > -1 ? cta : "other", at: AT.indexOf(at) > -1 ? at : "other", via: a.getAttribute("data-via") ||
        (/^tel:/.test(href) ? "tel" : /wa\.me/.test(href) ? "whatsapp" : /ig\.me|instagram\.com/.test(href) ? "instagram_dm" : /google\.[a-z.]+\/maps|maps\.app/.test(href) ? "maps" : "") });
    }
    if (/^https?:\/\//i.test(href)) { try { var o = new URL(href).hostname.replace(/^www\./, ""); if (o !== location.hostname) track("outbound", { host: o }); } catch (x) { /* bad url */ } }
  }, true);
})();
