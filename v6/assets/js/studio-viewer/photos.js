/* =========================================================================
   Classic Auto v6 - Studio photo viewer: the listed car's own photos, turned through like a 360 strip.

   Drag sideways (finger or mouse) and the photos step past as you move, wrapping round; let go fast and they keep turning
   for a moment. A vertical swipe still scrolls the page (touch-action: pan-y) unless the photo is zoomed in.
   Double-tap / double-click zooms to 2x at that point, pinch or ctrl + wheel zooms 1x to 3x, and a zoomed photo pans.
   Arrow keys step, Home / End jump. A filmstrip of thumbnails sits under the stage.
   Only this car's photos are ever shown here.
   ========================================================================= */

var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

export function createPhotoViewer(o) {
  /* o: { stage, img, blur, count, strip, prev, next, hint, label(i, n, set), reduced, onChange(i, set) } */
  var sets = o.sets, setName = o.initial || Object.keys(sets)[0], list = sets[setName], i = 0;
  var cache = {}, stage = o.stage, img = o.img, blur = o.blur;
  var zoom = { s: 1, x: 0, y: 0 };

  function load(src) {
    if (cache[src]) return cache[src];
    var im = new Image(); im.decoding = "async"; im.src = src;
    cache[src] = (im.decode ? im.decode() : new Promise(function (res, rej) { im.onload = res; im.onerror = rej; }))
      .then(function () { return im; }, function () { return null; });
    return cache[src];
  }
  function preloadAround() {
    for (var d = -2; d <= 2; d++) load(list[(i + d + list.length) % list.length]);
  }
  var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 700); };
  function preloadAll() { idle(function () { Object.keys(sets).forEach(function (k) { sets[k].forEach(load); }); }); }

  var shown = null, token = 0, blurT = 0, painted = false;
  /* the soft fill behind a photo that does not cover the stage: the photo drawn into a tiny canvas and stretched, which
     blurs it for free (a CSS blur filter repainted on every step made WebKit drop to 8 to 24 frames a second) */
  function paintBlur(im) {
    if (!im || !blur.getContext) return;
    var w = 24, h = Math.max(8, Math.round(24 * (stage.clientHeight || 3) / (stage.clientWidth || 4)));
    blur.width = w; blur.height = h;
    var g = blur.getContext("2d"), r = Math.max(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * r, dh = im.naturalHeight * r;
    g.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
    painted = true; blur.classList.add("is-on");
  }
  function show(n, how) {
    if (!list.length) return;
    i = ((n % list.length) + list.length) % list.length;
    var src = list[i], my = ++token;
    resetZoom();
    var apply = function () {
      if (my !== token) return;
      if (how === "fade" && !o.reduced && shown) {
        img.classList.remove("is-in"); void img.offsetWidth; img.classList.add("is-in");
      }
      img.src = src; shown = src;
      /* the blurred fill is costly to repaint: it follows only once the photos stop moving */
      clearTimeout(blurT); blurT = setTimeout(function () { load(shown).then(paintBlur); }, painted ? 220 : 0);
      img.alt = o.label(i, list.length, setName);
    };
    /* while scrubbing, swap at once if the photo is decoded, otherwise wait for it (no blank frame) */
    load(src).then(apply);
    o.count.textContent = (i + 1) + " / " + list.length;
    syncStrip();
    preloadAround();
    if (o.onChange) o.onChange(i, setName);
  }

  /* ---- filmstrip ---- */
  var thumbs = [];
  function buildStrip() {
    o.strip.innerHTML = ""; thumbs = [];
    list.forEach(function (src, k) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "sv-thumb";
      b.setAttribute("aria-label", "Photo " + (k + 1) + " of " + list.length);
      var t = document.createElement("img"); t.src = src; t.alt = ""; t.loading = k < 6 ? "eager" : "lazy"; t.decoding = "async"; t.draggable = false;
      b.appendChild(t);
      b.addEventListener("click", function () { stopFling(); show(k, "fade"); });
      o.strip.appendChild(b); thumbs.push(b);
    });
  }
  function syncStrip() {
    thumbs.forEach(function (b, k) { if (k === i) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
    var b = thumbs[i]; if (!b) return;
    /* scroll the strip only (scrollIntoView would also scroll the page) */
    var s = o.strip, left = b.offsetLeft - (s.clientWidth - b.offsetWidth) / 2;
    /* while the photos are turning (drag, fling) the strip jumps: a smooth scroll restarted on every step only costs frames */
    var quick = o.reduced || fling || stage.classList.contains("is-turning");
    if (s.scrollTo) s.scrollTo({ left: Math.max(0, left), behavior: quick ? "auto" : "smooth" }); else s.scrollLeft = left;
  }

  function setSet(name) {
    if (!sets[name] || !sets[name].length) return;
    setName = name; list = sets[name]; buildStrip(); show(0, "fade");
  }

  /* ---- zoom ---- */
  function applyZoom() {
    var r = stage.getBoundingClientRect(), mx = (zoom.s - 1) * r.width / 2, my = (zoom.s - 1) * r.height / 2;
    zoom.x = clamp(zoom.x, -mx, mx); zoom.y = clamp(zoom.y, -my, my);
    img.style.transform = zoom.s === 1 ? "" : "translate(" + zoom.x.toFixed(1) + "px," + zoom.y.toFixed(1) + "px) scale(" + zoom.s.toFixed(3) + ")";
    stage.classList.toggle("is-zoomed", zoom.s > 1.01);
  }
  function zoomAt(s, cx, cy) {
    var r = stage.getBoundingClientRect(), px = cx - r.left - r.width / 2, py = cy - r.top - r.height / 2, k = s / zoom.s;
    zoom.x = px - (px - zoom.x) * k; zoom.y = py - (py - zoom.y) * k; zoom.s = s;
    if (s <= 1.01) { zoom.s = 1; zoom.x = zoom.y = 0; }
    applyZoom();
  }
  function resetZoom() { if (zoom.s !== 1) { zoom.s = 1; zoom.x = zoom.y = 0; applyZoom(); } }

  /* ---- drag to turn, fling, pinch ---- */
  var pts = {}, drag = null, pinch = null, lastTap = 0, fling = 0;
  function stepPx() { return clamp(stage.clientWidth / (list.length * 0.9), 26, 80); }
  function stopFling() { if (fling) { cancelAnimationFrame(fling); fling = 0; } }
  stage.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest("button")) return;
    stopFling();
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pts);
    if (ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: zoom.s }; drag = null; return;
    }
    drag = { x: e.clientX, y: e.clientY, acc: 0, moved: false, v: 0, t: e.timeStamp, id: e.pointerId };
    try { stage.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ }
  });
  stage.addEventListener("pointermove", function (e) {
    if (!pts[e.pointerId]) return;
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pts);
    if (pinch && ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(clamp(pinch.s * d / pinch.d, 1, 3), (a.x + b.x) / 2, (a.y + b.y) / 2); return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y, dt = Math.max(1, e.timeStamp - drag.t);
    drag.x = e.clientX; drag.y = e.clientY; drag.t = e.timeStamp;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    if (zoom.s > 1) { zoom.x += dx; zoom.y += dy; applyZoom(); return; }
    drag.v = drag.v * 0.6 + (dx / dt) * 0.4;                          // px per ms, smoothed
    drag.acc += dx;
    var st = stepPx();
    while (Math.abs(drag.acc) >= st) { var dir = drag.acc > 0 ? -1 : 1; drag.acc += dir * st; show(i + dir); stage.classList.add("is-turning"); }
  });
  function end(e) {
    if (!pts[e.pointerId]) return;
    delete pts[e.pointerId];
    if (pinch) { if (Object.keys(pts).length < 2) pinch = null; drag = null; return; }
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null; stage.classList.remove("is-turning");
    if (!d.moved && e.type === "pointerup") {                          // a tap: double-tap toggles zoom
      if (e.timeStamp - lastTap < 320) { lastTap = 0; zoomAt(zoom.s > 1 ? 1 : 2, e.clientX, e.clientY); }
      else lastTap = e.timeStamp;
      return;
    }
    if (zoom.s > 1 || o.reduced || Math.abs(d.v) < 0.35) return;
    /* fling: keep stepping, slowing down */
    var v = d.v * 16, acc = d.acc, st = stepPx();
    var tick = function () {
      v *= 0.92; acc += v;
      while (Math.abs(acc) >= st) { var dir = acc > 0 ? -1 : 1; acc += dir * st; show(i + dir); }
      fling = Math.abs(v) > 0.6 ? requestAnimationFrame(tick) : 0;
    };
    fling = requestAnimationFrame(tick);
  }
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (n) { stage.addEventListener(n, end); });
  stage.addEventListener("wheel", function (e) {
    if (!e.ctrlKey && !e.metaKey) return;                           // a plain wheel scrolls the page
    e.preventDefault(); zoomAt(clamp(zoom.s * Math.exp(-e.deltaY * 0.004), 1, 3), e.clientX, e.clientY);
  }, { passive: false });
  stage.addEventListener("dblclick", function (e) { e.preventDefault(); });
  stage.addEventListener("dragstart", function (e) { e.preventDefault(); });
  stage.addEventListener("keydown", function (e) {
    var k = e.key, used = true;
    if (k === "ArrowRight") show(i + 1, "fade"); else if (k === "ArrowLeft") show(i - 1, "fade");
    else if (k === "Home") show(0, "fade"); else if (k === "End") show(list.length - 1, "fade");
    else if (k === "+" || k === "=") { var r = stage.getBoundingClientRect(); zoomAt(clamp(zoom.s * 1.4, 1, 3), r.left + r.width / 2, r.top + r.height / 2); }
    else if (k === "-") { var r2 = stage.getBoundingClientRect(); zoomAt(clamp(zoom.s / 1.4, 1, 3), r2.left + r2.width / 2, r2.top + r2.height / 2); }
    else used = false;
    if (used) { e.preventDefault(); stopFling(); }
  });
  o.prev.addEventListener("click", function () { stopFling(); show(i - 1, "fade"); });
  o.next.addEventListener("click", function () { stopFling(); show(i + 1, "fade"); });
  window.addEventListener("resize", function () { if (zoom.s > 1) applyZoom(); syncStrip(); });

  buildStrip();
  var first = load(list[0]);
  show(0);
  preloadAll();
  return {
    ready: first,
    setSet: setSet,
    get state() { return { set: setName, index: i, count: list.length, zoom: zoom.s, src: shown }; },
    go: function (n) { show(n, "fade"); },
    resetZoom: resetZoom,
    /* QA: step continuously (the fps check) */
    spin: function (on) {
      stopFling(); if (!on) return;
      var t0 = performance.now(), tick = function (t) { if (Math.floor((t - t0) / 90) !== Math.floor((t - 16 - t0) / 90)) show(i + 1); fling = requestAnimationFrame(tick); };
      fling = requestAnimationFrame(tick);
    }
  };
}
