/* =========================================================================
   Classic Auto v6 - The Studio (SPEC 5.1): the closest honest thing to seeing the car in person.

   What it shows, in this order of preference, never a different car next to the listing's price:
     Outside / Inside   the listed car's own photos, turned through like a 360 strip (studio-viewer/photos.js).
                        Inside is the car's cabin photos (studio-viewer/photo-tags.js); untagged cars show one set.
     3D model           only when a model of this make and model, or a scan of this very car, is listed in
                        assets/models/cars3d.json or on the car (studio-viewer/models.js), with its credit.
                        three.js and the model download only then (studio-viewer/studio3d.js).
     Step inside        only when that model comes with a cabin model or a 360 cabin photo (studio-viewer/inside.js).
   Full screen works the same on a phone and a laptop: the browser's own full screen where it exists, otherwise
   (iPhone) the stage fills the window. Esc or the button closes it.
   ========================================================================= */
import { createPhotoViewer } from "./studio-viewer/photos.js";
import { PHOTO_TAGS } from "./studio-viewer/photo-tags.js";
import { resolveModel, loadManifest } from "./studio-viewer/models.js";

var $ = function (id) { return document.getElementById(id); };
var track = function (n, p) { if (window.CA_TRACK) window.CA_TRACK(n, p); };

var params = new URLSearchParams(window.location.search);
var id = params.get("id");
var CARS_LIST = window.CARS || [];
var car = CARS_LIST.filter(function (c) { return c.id === id; })[0] || (!id ? CARS_LIST[0] : null);
var fmt = window.ClassicAuto;
var SITE = window.CA_SITE || {};
var reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
var mobile = !!(window.matchMedia && matchMedia("(max-width: 767px), (pointer: coarse)").matches);

/* ------------------------------------------------------------------ side panel + CTAs */
var PAINTS = [
  { name: "Signal red", hex: "#e11b22", metal: false },
  { name: "Obsidian black", hex: "#101010", metal: true },
  { name: "Silver", hex: "#c9ccd0", metal: true },
  { name: "Navy blue", hex: "#2b3990", metal: true },
  { name: "Ivory", hex: "#f5f1e8", metal: false }
];
var WHEELS = [
  { name: "Silver", hex: "#b9bcc3" },
  { name: "Graphite", hex: "#3d4048" },
  { name: "Black", hex: "#101113" }
];

function initSidePanel(car) {
  var name = car.make + " " + car.model;
  document.title = name + " in the Studio | Classic Auto";
  $("studioTitle").textContent = car.year + " " + name;
  $("studioBadge").textContent = fmt.bodyLabel(car.body) + (car.status === "SOLD" ? " · Sold" : "");
  $("studioCarName").textContent = name;
  var onReq = car.price_on_request || car.price == null;
  $("studioPrice").textContent = onReq ? "Ask for price" : fmt.rupees(car.price);
  $("studioMeta").innerHTML = [["Owner", car.owners], ["Driven", fmt.formatKm(car.kms)], ["Gearbox", fmt.transShort(car)], ["Insurance", fmt.insurance(car).short]]
    .map(function (c) { return '<div class="chip"><span>' + c[0] + '</span><b>' + c[1] + '</b></div>'; }).join("");
  $("studioEmi").textContent = onReq ? "-" : fmt.rupees(fmt.emi(car.price)) + "/mo*";
  $("backToCarLink").href = "cars/" + encodeURIComponent(car.id) + "/";

  var m = window.CA.messageCta();
  var msgText = "Hi Classic Auto, I just looked at the " + fmt.carFullLabel(car) + " in the Studio. Is it available for a visit?";
  var visitHref = "cars/" + encodeURIComponent(car.id) + "/#buy";
  [["studioVisitBtn", "studioMsgBtn"], ["barVisitBtn", "barMsgBtn"], ["endVisitBtn", "endMsgBtn"]].forEach(function (pair) {
    $(pair[0]).href = visitHref;
    var b = $(pair[1]);
    b.textContent = m.label; b.href = SITE.whatsapp ? window.CA.waLink(msgText) : m.href;
    b.target = "_blank"; b.rel = "noopener"; b.setAttribute("data-ca-msg", msgText); b.setAttribute("data-via", m.via);
  });
  if (window.CA.setStickyMessage) window.CA.setStickyMessage(msgText);

  /* paint previews (3D only): this car's own colour first, then brand colours */
  var own = { name: "This car: " + car.colour, hex: car.paint, metal: /silver|grey|gray|graphite|metallic/i.test(car.colour) };
  var list = [own].concat(PAINTS.filter(function (p) { return p.hex.toLowerCase() !== String(car.paint).toLowerCase(); }));
  list.forEach(function (p, i) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "paint-swatch"; b.style.background = p.hex;
    b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    b.setAttribute("aria-label", i === 0 ? p.name : "Preview paint: " + p.name);
    b.title = p.name; b.setAttribute("data-hex", p.hex); b.setAttribute("data-metal", p.metal ? "1" : "0");
    $("paintRow").appendChild(b);
  });
  WHEELS.forEach(function (w, i) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "paint-swatch"; b.style.background = w.hex;
    b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    b.setAttribute("aria-label", "Wheel finish: " + w.name); b.title = w.name; b.setAttribute("data-hex", w.hex);
    $("wheelRow").appendChild(b);
  });
}

/* ------------------------------------------------------------------ photos */
function photoSets(car) {
  var all = (car.photos || []).slice();
  var tag = PHOTO_TAGS[car.id];
  if (!tag || tag.n !== all.length) return { outside: all };
  var inside = all.filter(function (p) { return tag.inside.indexOf(p.split("/").pop()) >= 0; });
  var outside = all.filter(function (p) { return inside.indexOf(p) < 0; });
  return inside.length && outside.length ? { outside: outside, inside: inside } : { outside: all };
}

/* ------------------------------------------------------------------ the Studio */
function initStudio(car) {
  var bay = $("studioBay"), frame = $("studioFrame");
  var sets = photoSets(car), hasInside = !!sets.inside;
  var view = "outside", three = null, cabin = null, model = null;
  var label = function (i, n, set) { return car.make + " " + car.model + ", " + (set === "inside" ? "inside" : hasInside ? "outside" : "photo") + ", " + (i + 1) + " of " + n + " (this car)"; };

  window.__studio = { ready: false, get state() { return studioState(); } };

  if (!sets.outside.length) {                                               // no photos yet: say so, keep the price panel
    $("svPhotos").innerHTML = '<p class="sv-empty">Photos of this car are on their way. Message us and we will send a walk-around video.</p>';
    ["svPrev", "svNext", "svHint", "svStrip"].forEach(function (k) { $(k).hidden = true; });
    $("svViews").hidden = true; window.__studio.ready = true;
    return;
  }

  $("svOutN").textContent = sets.outside.length;
  if (hasInside) { $("svInN").textContent = sets.inside.length; document.querySelector('.sv-view[data-view="inside"]').hidden = false; }
  else document.querySelector('.sv-view[data-view="outside"]').firstChild.textContent = "Photos ";

  var photos = createPhotoViewer({
    sets: sets, initial: "outside", stage: $("svPhotos"), img: $("svImg"), blur: $("svBlur"), count: $("svCount"), strip: $("svStrip"),
    prev: $("svPrev"), next: $("svNext"), reduced: reduced, label: label,
    onChange: function () { hideHint(); }
  });
  photos.ready.then(function () {
    bay.classList.add("is-ready");
    window.__studio.ready = true;
    track("studio_open", { mode: "photos", model: "photos" });
  });
  var hintShown = false;
  function hideHint() { if (hintShown) $("svHint").classList.add("is-gone"); }
  setTimeout(function () { hintShown = true; }, 400);

  /* ---- views ---- */
  var viewBtns = document.querySelectorAll(".sv-view");
  /* how many view tabs show (the CSS sets four of them two by two on a phone) */
  function countTabs() { $("svViews").setAttribute("data-n", String([].filter.call(viewBtns, function (b) { return !b.hidden; }).length)); }
  countTabs();
  function setView(v) {
    if (v === view) return;
    view = v;
    viewBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === v)); });
    var isPhotos = v === "outside" || v === "inside", is3d = v === "3d", isCabin = v === "cabin";
    bay.setAttribute("data-view", isPhotos ? "photos" : v);
    $("svPhotos").hidden = !isPhotos; $("svPrev").hidden = !isPhotos; $("svNext").hidden = !isPhotos; $("svStrip").hidden = !isPhotos;
    $("svCount").hidden = !isPhotos;
    $("studioCanvas").hidden = !is3d; $("studioHotspots").hidden = !is3d; $("sv3d").hidden = !is3d; $("studioActions").hidden = !is3d;
    $("insideCanvas").hidden = !isCabin;
    if (!is3d) { $("studioCard").hidden = true; $("studioReticle").hidden = true; $("tourEnd").hidden = true; }
    if (isPhotos) photos.setSet(v);
    if (three) three.setActive(is3d);
    if (cabin) cabin.setActive(isCabin);
    if (isCabin && !cabin) openCabin();
    paintUi(is3d);
    badge();
    $("studioHelp").textContent = isPhotos
      ? "Drag sideways to turn through the photos, or use the arrows. Double-tap to zoom in. Every photo here is of this car."
      : is3d ? "Drag to turn the model. Pinch to zoom. Pick a view below, or tap a red dot for details of the listed car."
      : "Drag to look around the cabin. Pinch to zoom.";
    track("studio_view", { view: v });
  }
  viewBtns.forEach(function (b) { b.addEventListener("click", function () { setView(b.getAttribute("data-view")); }); });

  function badge() {
    var b = $("studioModelBadge");
    if (view === "3d" || view === "cabin") b.textContent = model.kind === "scan" ? "3D scan of this car" : "3D model: same model, not this car";
    else b.textContent = view === "inside" ? "Inside this car" : "Photos of this car";
    b.classList.toggle("is-model", view === "3d" || view === "cabin");
  }
  var paintOk = false, wheelsOk = false;
  function paintUi(is3d) {
    $("paintPanel").hidden = !(is3d && paintOk); $("finishPanel").hidden = !(is3d && paintOk);
    $("wheelBlock").hidden = !wheelsOk;
    $("scanNote").hidden = !(is3d && model && model.kind === "scan");
  }

  /* ---- 3D model, when one exists for this car ---- */
  function credit() {
    var el = $("studioCredit");
    if (!model) { el.textContent = "Every photo in the Studio is of this car, from Classic Auto's own listing."; return; }
    var lines = model.kind === "scan"
      ? "The 3D view is a scan of this very car. The photos are of this car too."
      : "The photos are of this car. The 3D model shows the same make and model (" + model.name + "), not this car: colour, trim and condition can differ. Details beside it are for the listed car. Classic Auto is an independent pre-owned dealer, not affiliated with " + car.make + ".";
    el.textContent = lines + " ";
    if (model.credit) {
      var a = document.createElement(model.creditUrl ? "a" : "span");
      a.textContent = "3D model: " + model.credit;
      if (model.creditUrl) { a.href = model.creditUrl; a.target = "_blank"; a.rel = "noopener"; }
      el.appendChild(a); el.appendChild(document.createTextNode(" ("));
      /* CC BY asks for a link to the licence and a note of any changes: resized, relit, optional paint previews */
      var lic = document.createElement(model.licence === "CC-BY-4.0" ? "a" : "span");
      lic.textContent = model.licenceLabel;
      if (model.licence === "CC-BY-4.0") { lic.href = "https://creativecommons.org/licenses/by/4.0/"; lic.target = "_blank"; lic.rel = "noopener license"; }
      el.appendChild(lic);
      el.appendChild(document.createTextNode(model.licence === "CC-BY-4.0" ? "; resized and relit here, paint previews are ours)." : ")."));
    }
  }
  function open3d() {
    if (three) return;
    $("studioLoading").hidden = false;
    import("./studio-viewer/studio3d.js").then(function (mod) {
      three = mod.initStudio3D(car, model, {
        $: $, bay: bay, canvas: $("studioCanvas"), loadingEl: $("studioLoading"), reduced: reduced, mobile: mobile, fmt: fmt, track: track, SITE: SITE,
        setPaintUi: function (p, w) { paintOk = p; wheelsOk = w; paintUi(view === "3d"); },
        onReady: function () { window.__studio.ready3d = true; },
        onFail: function () { drop3d(); }
      });
      if (!three) return;
      three.setActive(view === "3d");
      Object.assign(window.__studio, { preset: three.preset, select: three.select, setMode: three.setMode, startTour: three.startTour, render: three.render, cameraPosition: three.cameraPosition, skip: three.skip });
    }, function () { drop3d(); });
  }
  /* the model could not load: go back to the photos and take the 3D tabs away (never an empty box) */
  function drop3d() {
    model = null; three = null;
    $("studioLoading").hidden = true;
    document.querySelectorAll('.sv-view[data-view="3d"], .sv-view[data-view="cabin"]').forEach(function (b) { b.hidden = true; });
    credit();
    countTabs();
    if (view === "3d" || view === "cabin") setView("outside");
    window.__studio.ready3d = false;
  }
  function openCabin() {
    import("./studio-viewer/inside.js").then(function (mod) {
      cabin = mod.initInside($("insideCanvas"), bay, model, mobile);
      cabin.setActive(view === "cabin");
      cabin.ready.catch(function () { document.querySelector('.sv-view[data-view="cabin"]').hidden = true; countTabs(); if (view === "cabin") setView("inside" in sets ? "inside" : "outside"); });
    }, function () {});
  }
  var glOk = false;
  try { var probe = document.createElement("canvas"); glOk = !!(window.WebGLRenderingContext && (probe.getContext("webgl2") || probe.getContext("webgl"))); } catch (e) { glOk = false; }
  loadManifest().then(function (manifest) {
    model = resolveModel(car, manifest);
    if (!model || !glOk) { model = null; credit(); return; }
    document.querySelector('.sv-view[data-view="3d"]').hidden = false;
    if (model.interior) document.querySelector('.sv-view[data-view="cabin"]').hidden = false;
    countTabs();
    credit();
    /* start the model download now, so it is ready (or known to fail) by the time someone taps "3D model" */
    open3d();
    if (params.get("view") === "3d") setView("3d");
  });

  /* ---- full screen: the browser's own where it has one, otherwise the frame fills the window (iPhone) ---- */
  var fullBtn = $("svFull"), cssFull = false;
  function isFull() { return frame.classList.contains("is-full"); }
  function enterFull() {
    frame.classList.add("is-full"); document.documentElement.classList.add("sv-lock");
    fullBtn.setAttribute("aria-pressed", "true"); fullBtn.setAttribute("aria-label", "Exit full screen");
    var req = frame.requestFullscreen || frame.webkitRequestFullscreen;
    cssFull = true;
    if (req) { try { var p = req.call(frame); if (p && p.catch) p.catch(function () {}); } catch (e) { /* stays CSS full */ } }
    track("studio_fullscreen", { view: view });
    refresh();
  }
  function exitFull(fromEvent) {
    if (!isFull()) return;
    frame.classList.remove("is-full"); document.documentElement.classList.remove("sv-lock");
    fullBtn.setAttribute("aria-pressed", "false"); fullBtn.setAttribute("aria-label", "Full screen");
    cssFull = false;
    var fe = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fromEvent && fe) { var ex = document.exitFullscreen || document.webkitExitFullscreen; try { var p = ex.call(document); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ } }
    refresh();
  }
  function refresh() { requestAnimationFrame(function () { if (three) three.resize(); window.dispatchEvent(new Event("resize")); }); }
  fullBtn.addEventListener("click", function () { if (isFull()) exitFull(false); else enterFull(); });
  ["fullscreenchange", "webkitfullscreenchange"].forEach(function (n) {
    document.addEventListener(n, function () { if (!(document.fullscreenElement || document.webkitFullscreenElement) && isFull()) exitFull(true); });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && cssFull) exitFull(false); });

  function studioState() {
    var s = three ? three.state : {};
    return Object.assign({}, s, { view: view, photos: photos ? photos.state : null, model: model ? model.kind : "photos", hasInside: hasInside, full: isFull() });
  }
  Object.assign(window.__studio, {
    setView: setView,
    spin: function (on) { if (view === "3d" && three) three.spin(on); else if (view === "cabin" && cabin) cabin.spin(on); else photos.spin(on); },
    go: function (n) { photos.go(n); }
  });
  if (params.get("view") === "inside" && hasInside) setView("inside");
}

/* start */
if (!car) {
  $("studioShell").hidden = true;
  $("studioNotFound").hidden = false;
} else {
  initSidePanel(car);
  initStudio(car);
}
