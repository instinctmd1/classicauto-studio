// English / Hindi / Hinglish switch for the whole app, with no reload. A classic deferred script (the CSP forbids inline scripts).
//
// How it works: the app draws English text everywhere (templates, toasts, server messages). While Hindi is on, a
// MutationObserver walks every text node and the placeholder / title / aria-label / alt / data-label attributes that appear,
// looks the exact English text up in js/i18n-hi.js (window.CA_I18N_HI, Devanagari) or js/i18n-hing.js (window.CA_I18N_HING,
// Hindi in English letters) and swaps it in. The English is kept in a
// WeakMap, so switching back puts every node back as it was. Entries with {} are patterns for text with a number or a name
// inside ("Money locks in {} min"); what stands in the {} is shown as it is (a name, a number, an amount) unless it is itself
// a known word ("Sold", "3 days"). Nothing is translated that is not in the dictionary, so typed notes, names, car models,
// registration numbers and amounts stay as people wrote them. Skipped: [translate="no"], textarea, code, pre, script, style,
// contenteditable. The choice ("en", "hi" or "hinglish") is kept in localStorage "ca.lang"; <html lang> is "hi" for Hindi, else "en".
(function () {
  "use strict";
  var KEY = "ca.lang";
  var LANGS = [["en", "English", "en"], ["hi", "\u0939\u093f\u0902\u0926\u0940", "hi"], ["hinglish", "Hinglish", "en"]];   // key, button label, language of the label
  var DICTS = { hi: "CA_I18N_HI", hinglish: "CA_I18N_HING" };
  var ATTRS = ["placeholder", "title", "aria-label", "alt", "data-label"];
  // Where people's own words appear (chat messages, notes): never translated, whatever they typed.
  var SKIP = '[translate="no"],[contenteditable=""],[contenteditable="true"],textarea,code,pre,script,style,noscript,.no-i18n,.bubble p,.thread .msg p,.mt-note,.rp-rem,.rp-text,.cd-notes p,.bt-ln-nar,.b-name,li[class^="k-"] p';
  var SKIP_EL = SKIP.replace("textarea,", "");                      // a textarea's own placeholder is translated; the text inside it never is
  var LATIN = /[A-Za-z]/;
  // Car models that are also ordinary words ("City", "Safari"): a model name is data and is never translated. These words are
  // translated only inside the places the app writes labels (label, th, button, heading ...), never in a cell or a list row.
  var MODEL_WORDS = {};
  ("city safari compass jazz polo rapid spark beat sunny cruze aspire fusion mustang ghost dawn phantom defender discovery evoque freestyle indigo nano bolt zest " +
   "sumo hexa thar punch harrier tiago kicks magnite kiger elevate civic accord brio amaze urban cruiser vitara jimny eeco grand aura venue sonet carens carnival " +
   "sportage endeavour figo optra captiva tavera ikon fiesta vento ameo tiguan superb slavia kushaq taigun virtus triber kwid duster terrano logan scala lodgy " +
   "santro accent getz elantra tucson creta verna alto celerio ritz zen esteem omni gypsy ertiga dzire baleno swift ciaz brezza fronx nexon altroz tigor indica " +
   "scorpio bolero marazzo xylo quanto verito innova fortuner etios glanza camry corolla yaris hyryder hilux vellfire alphard seltos premium luxury core mid").split(" ")
    .forEach(function (w) { MODEL_WORDS[w] = 1; });
  var LABEL_TAGS = { LABEL: 1, TH: 1, LEGEND: 1, BUTTON: 1, H1: 1, H2: 1, H3: 1, H4: 1, SUMMARY: 1 };
  var SEP_L = /^[\s·•,;|/]+/, SEP_R = /[\s·•,;|/]+$/;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    "January", "February", "March", "April", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var MON_RX = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
  var DAY_RX = "Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?";

  var lang = "en";
  try { var saved = localStorage.getItem(KEY); if (saved === "hi" || saved === "hinglish") lang = saved; } catch (e) { /* storage blocked: English */ }

  var states = {};                                                    // one compiled dictionary per language, built when first needed
  var exact = null, lower = null, pats = null, patIdx = null, patShort = null, cache = null, monthHi = null, dayHi = null;
  var texts = new WeakMap(), attrs = new WeakMap();
  var observer = null;

  // ---------------------------------------------------------------- dictionary
  function use(l) {
    var st = states[l];
    if (!st) {
      if (!window[DICTS[l]]) return null;                            // its file has not arrived (yet): nothing to translate with
      st = states[l] = { l: l };
      compile(st, window[DICTS[l]]);
    }
    exact = st.exact; lower = st.lower; pats = st.pats; patIdx = st.patIdx; patShort = st.patShort; cache = st.cache; monthHi = st.monthHi; dayHi = st.dayHi;
    return st;
  }
  function build() { if (lang !== "en") use(lang); }
  var WORD = /[A-Za-z]{3,}/g;
  function compile(st, d) {
    exact = st.exact = new Map(); lower = st.lower = new Map(); pats = st.pats = []; cache = st.cache = new Map();
    patIdx = st.patIdx = new Map(); patShort = st.patShort = [];
    var clash = {};
    Object.keys(d).forEach(function (k) {
      var v = d[k];
      if (typeof v !== "string" || !v) return;
      if (k.indexOf("{}") < 0) {
        exact.set(k, v);
        var lk = k.toLowerCase();
        if (lower.has(lk) && lower.get(lk) !== v) clash[lk] = 1; else lower.set(lk, v);
      } else {
        var parts = k.split("{}"), lit = "";
        parts.forEach(function (p) { if (p.trim().length > lit.length) lit = p.trim(); });
        var short = lit.replace(/[^A-Za-z]/g, "").length < 3;
        // a pattern whose own words are only "to", "by", "On" ... would fit any sentence, so its values must start like data (a number, an amount, a date)
        var slotRx = short ? "((?:[\\d\u20b9#+\u2212\u2014])[\\s\\S]*?|)" : "(.*?)";
        var pat = {
          re: new RegExp("^" + parts.map(function (p) { return p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join(slotRx) + "$", "s"),
          lit: lit, out: v, size: k.length - parts.length * 2 + parts.length, loose: !short,
        };
        pats.push(pat);
        var words = lit.match(WORD), best = "";
        (words || []).forEach(function (w) { if (w.length > best.length) best = w; });
        if (best) { best = best.toLowerCase(); (patIdx.get(best) || patIdx.set(best, []).get(best)).push(pat); } else patShort.push(pat);
      }
    });
    Object.keys(clash).forEach(function (k) { lower.delete(k); });
    pats.sort(function (a, b) { return b.size - a.size; });         // the most specific (longest) pattern first
    monthHi = st.monthHi = {}; dayHi = st.dayHi = {};
    MONTHS.forEach(function (m) { if (exact.get(m)) monthHi[m] = exact.get(m); });
    DAYS.forEach(function (m) { if (exact.get(m)) dayHi[m] = exact.get(m); });
  }

  // Dates the app writes ("14 Nov", "Nov 2026", "Saturday, 14 November 2026") get their month and weekday in Hindi, wherever they sit.
  var RX_DM = new RegExp("\\b(\\d{1,2})(\\s+)(" + MON_RX + ")\\b", "g");
  var RX_MY = new RegExp("\\b(" + MON_RX + ")(\\s+\\d{4})\\b", "g");
  var RX_DAY = new RegExp("\\b(" + DAY_RX + ")\\b(?=,?\\s+\\d)", "g");
  var RX_DATE_WORDS = new RegExp("\\b(" + MON_RX + "|" + DAY_RX + "|am|pm|AM|PM)\\b", "g");
  function fixDates(s) {
    if (!monthHi) return s;
    return s
      .replace(RX_DM, function (m, d, sp, mo) { return monthHi[mo] ? d + sp + monthHi[mo] : m; })
      .replace(RX_MY, function (m, mo, y) { return monthHi[mo] ? monthHi[mo] + y : m; })
      .replace(RX_DAY, function (m, dy) { return dayHi[dy] || m; });
  }
  var DATE_ONLY = /^[\d\s,:/.\-–·]*$/;
  function dateOnly(s) {
    var rest = s.replace(RX_DATE_WORDS, "");
    return DATE_ONLY.test(rest) && /\d/.test(rest) ? fixDates(s) : null;
  }

  function fill(out, m, depth) {
    var numbered = /\{\d+\}/.test(out), i = 0;
    return out.replace(/\{(\d*)\}/g, function (all, n) {
      var g = m[numbered ? +n : ++i];
      return g === undefined ? "" : slot(g, depth);
    });
  }
  /** What may stand in the {} of a pattern: a number, an amount, a # id, up to four capitalised words (a name, a car), or a text that is itself known. */
  var DATA_LIKE = /^(?:[\d\u20b9#+\u2212\u2014(@]|[A-Z][^\s]*(?: [A-Z\d][^\s]*){0,3}$)/;
  function slotOk(g, depth) {
    g = g.trim();
    return g === "" || !LATIN.test(g) || DATA_LIKE.test(g) || core(g, depth + 1) !== null;
  }
  function slot(g, depth) {
    if (!LATIN.test(g)) return g;
    var t = core(g.trim(), depth + 1);
    return t === null ? g : t;
  }

  var count = function (s, c) { return s.split(c).length - 1; };
  /** [leading, middle, trailing]: separators (· , ; | - /) and a bracket nobody closed (or opened) hang off the middle.
   *  scripts/i18n_extract.py trims the same way, so "· already added" and "already added" are one dictionary entry. */
  function edges(s) {
    var lead = "", tail = "", mid = s, x;
    for (var n = 0; n < 6; n++) {
      var before = mid.length;
      if ((x = SEP_L.exec(mid))) { lead += x[0]; mid = mid.slice(x[0].length); }
      if ((x = SEP_R.exec(mid))) { tail = x[0] + tail; mid = mid.slice(0, mid.length - x[0].length); }
      if (mid.charAt(0) === "(" && count(mid, "(") > count(mid, ")")) { lead += "("; mid = mid.slice(1); }
      if (mid.charAt(mid.length - 1) === ")" && count(mid, ")") > count(mid, "(")) { tail = ")" + tail; mid = mid.slice(0, -1); }
      if (mid.length === before) break;
    }
    return [lead, mid, tail];
  }

  function sentences(s) {
    var out = [], cur = "";
    s.split(" ").forEach(function (w) {
      cur = cur ? cur + " " + w : w;
      if (w.length > 1 && /[.!?]$/.test(w) && !/^\d/.test(w)) { out.push(cur); cur = ""; }
    });
    if (cur) out.push(cur);
    return out;
  }

  /** Translate trimmed, white-space-collapsed text; null when nothing in the dictionary fits. */
  function core(s, depth) {
    var hit = exact.get(s);
    if (hit !== undefined) return hit;
    var e = edges(s), lead = e[0], mid = e[1], tail = e[2];
    if (!mid) return null;
    if (mid !== s) { hit = exact.get(mid); if (hit !== undefined) return lead + hit + tail; }
    if (depth < 1) {                                                // two sentences glued into one text node: each must be known
      var sent = sentences(mid);
      if (sent.length > 1 && sent.length < 5) {
        var parts = sent.map(function (x) { return core(x, depth + 1); });
        if (parts.every(function (x) { return x !== null; })) return lead + parts.join(" ") + tail;
      }
    }
    if (depth < 2 && mid.length < 400) {
      var cand = patShort.slice(), toks = mid.toLowerCase().match(WORD) || [], seenTok = {};
      for (var t = 0; t < toks.length; t++) {                        // only the patterns that share a word with this text are tried
        if (seenTok[toks[t]]) continue;
        seenTok[toks[t]] = 1;
        var list = patIdx.get(toks[t]);
        if (list) cand = cand.concat(list);
      }
      cand.sort(function (a, b) { return b.size - a.size; });
      for (var i = 0; i < cand.length; i++) {
        var p = cand[i];
        if (mid.indexOf(p.lit) < 0) continue;
        var m = p.re.exec(mid);
        if (!m) continue;
        var fits = true;
        if (p.loose) for (var g = 1; g < m.length && fits; g++) fits = slotOk(m[g], depth);
        if (fits) return lead + fixDates(fill(p.out, m, depth)) + tail;
      }
    }
    hit = lower.get(mid.toLowerCase());
    if (hit !== undefined) return lead + hit + tail;
    var dot = mid.split(" · ");                                // "Petrol · Auto", "9 Nov 2026 · ₹5 L": each part on its own
    if (dot.length > 1 && depth < 2) {
      var any = false, joined = dot.map(function (x) { var r = core(x.trim(), depth + 1); if (r !== null) any = true; return r === null ? x : r; });
      if (any) return lead + joined.join(" · ") + tail;
    }
    var cnt = /^(.+?) \((\d[\d,]*)\)$/.exec(mid);                   // "Collecting papers (3)"
    if (cnt && depth < 2) { var ct = core(cnt[1], depth + 1); if (ct !== null) return lead + ct + " (" + cnt[2] + ")" + tail; }
    var dt = dateOnly(mid);
    if (dt === null) {                                              // a chart label such as "Oct: ₹0": the month leads
      var ml = new RegExp("^(" + MON_RX + ")(:|\\s·|$)").exec(mid);
      if (ml && monthHi[ml[1]]) dt = monthHi[ml[1]] + mid.slice(ml[1].length);
    }
    return dt !== null && dt !== mid ? lead + dt + tail : null;
  }

  /** English -> Hindi for one string as it is in the DOM (keeps its leading and trailing white space); null when unknown. */
  function tr(raw) {
    if (!raw || !LATIN.test(raw)) return null;
    var r = cache.get(raw);
    if (r !== undefined) return r;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
    var c = core(m[2].replace(/\s+/g, " "), 0);
    r = c === null ? null : m[1] + c + m[3];
    if (cache.size > 6000) cache.clear();
    cache.set(raw, r);
    return r;
  }

  // ---------------------------------------------------------------- the DOM
  function skipped(el) { return !!(el && el.closest && el.closest(SKIP)); }

  function doText(n) {
    var v = n.nodeValue, rec = texts.get(n);
    if (rec && v === rec.hi) return;                                 // our own write
    var t = tr(v), par = n.parentElement;
    if (t !== null && MODEL_WORDS[v.trim().toLowerCase()] && !(par && LABEL_TAGS[par.tagName])) t = null;
    if (t !== null && t !== v && !skipped(par)) { texts.set(n, { en: v, hi: t }); n.nodeValue = t; }
    else if (rec) texts.delete(n);                                   // the app wrote something else here
  }
  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) if (el.hasAttribute(ATTRS[i])) doAttr(el, ATTRS[i], true);
  }
  function doAttr(el, name, known) {
    var v = el.getAttribute(name);
    var rec = attrs.get(el), r = rec && rec[name];
    if (r && v === r.hi) return;
    if (!known && el.closest(SKIP_EL)) return;
    var t = tr(v);
    if (t !== null && t !== v) { if (!rec) { rec = {}; attrs.set(el, rec); } rec[name] = { en: v, hi: t }; el.setAttribute(name, t); }
    else if (r) delete rec[name];
  }

  function each(root, fn) {
    if (root.nodeType === 3) { fn(root, null); return; }
    if (root.nodeType !== 1 || root.matches(SKIP_EL)) return;
    var w = document.createTreeWalker(root, 5, { acceptNode: function (n) { return n.nodeType === 1 && n.matches(SKIP_EL) ? 2 : 1; } });
    fn(root, true);
    var n;
    while ((n = w.nextNode())) fn(n, n.nodeType === 1);
  }
  function walk(root) {
    if (root.nodeType !== 1 && root.nodeType !== 3) return;
    if (skipped(root.nodeType === 3 ? root.parentElement : root.parentElement)) return;
    each(root, function (n, isEl) { if (isEl === null || isEl === false) doText(n); else doAttrs(n); });
  }
  function onMutations(list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === "childList") for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      else if (m.type === "characterData") { if (!skipped(m.target.parentElement)) doText(m.target); }
      else if (m.type === "attributes") doAttr(m.target, m.attributeName, false);
    }
  }

  function undo(root) {
    each(root, function (n, isEl) {
      if (isEl) {
        var rec = attrs.get(n);
        for (var i = 0; i < ATTRS.length; i++) {
          var a = ATTRS[i], v = n.getAttribute(a);
          if (v === null) continue;
          var r = rec && rec[a];
          if (r && v === r.hi) n.setAttribute(a, r.en);                // only what this script wrote: typed text that looks like a translation stays
        }
        attrs.delete(n);
      } else {
        var t = texts.get(n);
        if (t && n.nodeValue === t.hi) n.nodeValue = t.en;
        texts.delete(n);
      }
    });
  }

  // ---------------------------------------------------------------- the switch
  function syncButtons() {
    var bs = document.querySelectorAll("[data-lang-set]");
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute("aria-pressed", String(bs[i].getAttribute("data-lang-set") === lang));
  }
  /** Brings in the dictionary file of a language the first time it is needed (English never loads one). */
  function load(l, done) {
    if (window[DICTS[l]]) { done(); return; }
    var el = document.createElement("script");
    el.src = "js/i18n-" + (l === "hi" ? "hi" : "hing") + ".js";
    el.onload = el.onerror = function () { done(); };
    document.head.appendChild(el);
  }
  function apply(from) {
    document.documentElement.setAttribute("lang", lang === "hi" ? "hi" : "en");
    document.documentElement.setAttribute("data-lang", lang);
    if (observer) { observer.takeRecords(); observer.disconnect(); }
    if (from !== "en" && states[from]) { var keep = lang; lang = from; undo(document.documentElement); lang = keep; }   // back to English first
    if (lang !== "en" && use(lang)) {
      if (!observer) observer = new MutationObserver(onMutations);
      walk(document.documentElement);
      observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }
    syncButtons();
  }
  function set(next) {
    next = next === "hi" || next === "hinglish" ? next : "en";
    if (next === lang) return;
    var from = lang;
    lang = next;
    try { localStorage.setItem(KEY, lang); } catch (e) { /* storage blocked: lasts until the page closes */ }
    syncButtons();
    var mine = lang;
    load(lang, function () {
      if (lang !== mine) return;                                      // the person tapped again while the file was coming
      apply(from);
      window.dispatchEvent(new CustomEvent("ca:lang", { detail: { lang: lang } }));
    });
  }

  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("[data-lang-set]");
    if (b) { e.preventDefault(); set(b.getAttribute("data-lang-set")); }
  });

  // ---------------------------------------------------------------- what the rest of the app can ask
  /** The English a node is made of, even while another language is showing (for code that copies text, such as the table labels). */
  function src(el) {
    if (!el) return "";
    if (lang === "en") return el.textContent || "";
    var out = [], w = document.createTreeWalker(el, 4), n;
    while ((n = w.nextNode())) { var r = texts.get(n); out.push(r && n.nodeValue === r.hi ? r.en : n.nodeValue); }
    return out.join("");
  }
  /** el.innerHTML as it would read in English: for code that saves a button's markup and puts it back later. */
  function html(el) {
    if (lang === "en") return el.innerHTML;
    var clone = el.cloneNode(true), a = document.createTreeWalker(el, 4), b = document.createTreeWalker(clone, 4), x, y;
    while ((x = a.nextNode()) && (y = b.nextNode())) { var r = texts.get(x); if (r && x.nodeValue === r.hi) y.nodeValue = r.en; }
    return clone.innerHTML;
  }
  /** A string translated now (for native dialogs and canvas text, which the observer cannot reach). */
  function t(s) {
    if (lang === "en" || typeof s !== "string") return s;
    build();
    var r = tr(s);
    return r === null ? s : r;
  }
  /** A chart option with its words translated: the keys name / text / subtext, and arrays of category names under data. */
  function deep(o, key) {
    if (lang === "en") return o;
    if (typeof o === "string") return key === "name" || key === "text" || key === "subtext" || key === "data" ? t(o) : o;
    if (Array.isArray(o)) return o.map(function (x) { return deep(x, key === "data" ? "data" : key); });
    if (o && typeof o === "object" && Object.getPrototypeOf(o) === Object.prototype) {
      var c = {};
      Object.keys(o).forEach(function (k) { c[k] = deep(o[k], k); });
      return c;
    }
    return o;
  }
  /** Text on screen with Latin letters that the dictionary has nothing for: for checking coverage in the browser. */
  function missing() {
    var out = {}, w = document.createTreeWalker(document.body, 4), n;
    build();
    while ((n = w.nextNode())) {
      var v = n.nodeValue;
      if (!LATIN.test(v) || skipped(n.parentElement)) continue;
      var rec = texts.get(n);
      if (rec && v === rec.hi) continue;
      if (lang !== "en" && tr(v) !== null) continue;                  // known, and written the same in this language
      var s = v.replace(/\s+/g, " ").trim();
      if (s) out[s] = (out[s] || 0) + 1;
    }
    var attr = {};
    document.querySelectorAll("[placeholder],[title],[aria-label],[alt],[data-label]").forEach(function (el) {
      if (el.closest(SKIP_EL)) return;
      ATTRS.forEach(function (a) {
        var v = el.getAttribute(a), rec = attrs.get(el), r = rec && rec[a];
        if (v && LATIN.test(v) && !(r && v === r.hi) && !(lang !== "en" && tr(v) !== null)) attr[a + ": " + v.trim()] = 1;
      });
    });
    return { text: Object.keys(out), attrs: Object.keys(attr) };
  }
  /** The three-way control: English, हिंदी, Hinglish. cls adds a class to the group (lang-login, lang-top, lang-strip). */
  function buttonHtml(cls) {
    return '<div class="lang-seg' + (cls ? " " + cls : "") + '" role="group" aria-label="Language" translate="no">' + LANGS.map(function (x) {
      return '<button type="button" data-lang-set="' + x[0] + '" lang="' + x[2] + '" aria-pressed="' + (x[0] === lang) + '">' + x[1] + "</button>";
    }).join("") + "</div>";
  }
  /** The same three choices for the account menu (items in the shape ui.js openMenu takes). */
  function menuItems() {
    return [{ heading: "Language" }].concat(LANGS.map(function (x) { return { label: x[1], checked: x[0] === lang, onClick: function () { set(x[0]); } }; }), [{ divider: true }]);
  }

  window.caI18n = { lang: function () { return lang; }, set: set, t: t, src: src, deep: deep, missing: missing, buttonHtml: buttonHtml, menuItems: menuItems, html: html };

  document.documentElement.setAttribute("lang", lang === "hi" ? "hi" : "en");
  document.documentElement.setAttribute("data-lang", lang);
  if (lang !== "en") load(lang, function () { apply("en"); });       // js/i18n-boot.js has usually put the file in already
}());
