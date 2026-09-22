/* =========================================================================
   Classic Auto — website-v5 — cinematic hero: a Blender-baked frame
   sequence (hero-frames/f_000.webp .. f_045.webp, transparent WebP,
   rendered from the same camera as the live three.js scene below) scrubbed
   by the circular "DRAG TO REVEAL" handle, cross-fading into the live
   three.js car + turntable over the final 10% of the drag.

   Why a frame sequence and not a live cloth sim: two earlier live-Verlet-
   cloth builds (particles + distance constraints draping over the car)
   never got the resting frame to read as convincing fabric at a glance —
   either faceted/wedge-like or a torn/hollow rag once the collider tried
   to follow the real geometry. A short pre-rendered sequence sidesteps
   that entirely: every frame is a real render, so the drape always looks
   right, and it's cheap (46 small WebP frames, ~3.7MB total, lazy-loaded
   after first paint — see preloadFrames()).

   Flow: poster_draped.webp is the very first paint (plain <img>, already
   in the DOM, no JS needed). Once WebGL + the drag markup check out, a
   canvas is layered on top and the frame sequence starts preloading after
   the first paint. Dragging maps progress 0..1 to frame 0..45 (eased so
   lift-off reads as weighty, on top of the same spring-damped handle
   inertia as before). The live three.js car loads and sits ready,
   invisible, underneath the whole time; over the drag's final 10% the
   frame canvas fades out as the live canvas fades in — a straight cross-
   fade from "last frame" to "live turntable" — and the headline fades in.

   Graceful fallback: prefers-reduced-motion, no WebGL, or a load/runtime
   error all fall back to poster_draped.webp -> poster_clean.webp (a plain
   CSS cross-fade on the same "Tap to reveal" gesture) with no 3D and no
   frame sequence at all.
   ========================================================================= */
(function () {
  "use strict";

  var heroEl = document.querySelector(".hero3d");
  if (!heroEl) return;

  var FRAMES_BASE = "hero-frames/";
  var CROSSFADE_START = 0.90; // last 10% of the drag hands off to the live scene

  var prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function hasWebGL() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) { return false; }
  }

  function revealContent() {
    heroEl.classList.add("is-revealed");
  }

  function showFallback(reason) {
    heroEl.classList.add("hero3d-is-fallback");
    var stage = heroEl.querySelector(".hero3d-stage");
    if (stage) stage.remove();
    var dragUi = heroEl.querySelector(".drag-reveal");
    if (dragUi) dragUi.remove();
    var tapBtn = heroEl.querySelector(".hero3d-tap-fallback button");
    if (tapBtn) tapBtn.addEventListener("click", revealContent);
    if (prefersReducedMotion) revealContent(); // reduced motion: show immediately, no gesture required
    if (window.console && reason) console.info("[hero3d] using static fallback:", reason);
  }

  if (prefersReducedMotion || !hasWebGL()) {
    showFallback(prefersReducedMotion ? "prefers-reduced-motion" : "WebGL unavailable");
    return;
  }

  var stageEl = heroEl.querySelector(".hero3d-stage");
  var handle = heroEl.querySelector(".drag-reveal-handle");
  var dragWrap = heroEl.querySelector(".drag-reveal");
  var arcFill = heroEl.querySelector("#dragArcFill");
  var framesCanvas = heroEl.querySelector(".hero3d-frames-canvas");
  if (!stageEl || !handle || !dragWrap || !framesCanvas) { showFallback("missing markup"); return; }

  var isMobileLayout = window.matchMedia("(max-width: 768px)").matches;

  // =========================================================================
  // Frame sequence: preload + draw ("cover", centred, DPR-aware)
  // =========================================================================
  var ctx = framesCanvas.getContext("2d");
  var frameMeta = { count: 46, width: 1280, height: 720, pattern: "f_{index:03d}.webp" }; // overwritten by index.json once fetched
  var frameImages = [];
  var framesLoaded = 0;
  var drawnIndex = -1;
  var targetFrame = 0;

  function frameUrl(i) {
    var n = String(i);
    while (n.length < 3) n = "0" + n;
    return FRAMES_BASE + "f_" + n + ".webp";
  }

  function resizeFramesCanvas() {
    var w = stageEl.clientWidth, h = stageEl.clientHeight;
    if (!w || !h) return;
    // Mobile: same frames (they're light — ~1.6KB/frame avg), but the
    // canvas's own backing resolution is capped so a high-DPR phone isn't
    // rasterising a 1280px-wide source image at 3x for no visual gain.
    var dpr = Math.min(window.devicePixelRatio || 1, isMobileLayout ? 1.5 : 2);
    var maxBackingWidth = isMobileLayout ? 900 : 2400;
    var bw = Math.min(Math.round(w * dpr), maxBackingWidth);
    var effectiveDpr = bw / w;
    var bh = Math.round(h * effectiveDpr);
    framesCanvas.width = bw;
    framesCanvas.height = bh;
    framesCanvas.style.width = w + "px";
    framesCanvas.style.height = h + "px";
    drawnIndex = -1; // force a redraw at the new resolution
    drawCurrentFrame();
  }

  function drawImageCover(img, naturalW, naturalH) {
    var cw = framesCanvas.width, ch = framesCanvas.height;
    if (!cw || !ch) return;
    var scale = Math.max(cw / naturalW, ch / naturalH);
    var dw = naturalW * scale, dh = naturalH * scale;
    var dx = (cw - dw) / 2, dy = (ch - dh) / 2;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function bestLoadedIndex(target) {
    if (target < 0) target = 0;
    if (target > frameMeta.count - 1) target = frameMeta.count - 1;
    for (var i = target; i >= 0; i--) if (frameImages[i] && frameImages[i].__loaded) return i;
    for (var j = target; j < frameMeta.count; j++) if (frameImages[j] && frameImages[j].__loaded) return j;
    return -1;
  }

  function drawCurrentFrame() {
    var idx = bestLoadedIndex(targetFrame);
    if (idx < 0) return; // nothing loaded yet — poster_draped shows through the transparent canvas
    if (idx === drawnIndex) return;
    drawnIndex = idx;
    drawImageCover(frameImages[idx], frameMeta.width, frameMeta.height);
  }

  function preloadFrames() {
    fetch(FRAMES_BASE + "index.json").then(function (r) { return r.json(); }).catch(function () { return null; }).then(function (meta) {
      if (meta && meta.count) frameMeta = meta;
      resizeFramesCanvas();
      for (var i = 0; i < frameMeta.count; i++) {
        (function (i) {
          var img = new Image();
          img.decoding = "async";
          img.onload = function () {
            img.__loaded = true;
            framesLoaded++;
            drawCurrentFrame();
          };
          img.onerror = function () {
            if (window.console) console.error("[hero3d] frame failed to load:", frameUrl(i));
          };
          img.src = frameUrl(i);
          frameImages[i] = img;
        })(i);
      }
    });
  }

  // Size the canvas immediately (independent of the index.json fetch below)
  // so the very first drawn frame doesn't wait on a network round trip.
  resizeFramesCanvas();

  // Preload only AFTER first paint — double rAF guarantees at least one
  // frame has been painted before the 46 requests go out, so they never
  // compete with the hero's own critical render.
  requestAnimationFrame(function () {
    requestAnimationFrame(preloadFrames);
  });

  // =========================================================================
  // Live three.js car — loaded in parallel, kept invisible (CSS opacity 0
  // on its own canvas) until the drag's final-10% cross-fade.
  // =========================================================================
  var carReady = false;
  var carMeshNodes = [];
  var bodyMaterial = null;
  var carGroup, scene, camera, renderer;

  import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js").then(function (THREE) {
    return import("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js").then(function (GLTFMod) {
      return import("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/DRACOLoader.js").then(function (DracoMod) {
        boot(THREE, GLTFMod.GLTFLoader, DracoMod.DRACOLoader);
      });
    });
  }).catch(function (err) {
    // The frame sequence + fallback still work fine without the live
    // scene — this just means the final cross-fade never triggers, so
    // clamp the crossfade so the last frame simply stays on screen.
    if (window.console) console.error("[hero3d] three.js failed to load:", err);
  });

  function boot(THREE, GLTFLoader, DRACOLoader) {
    try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a1633);
      scene.fog = new THREE.Fog(0x0a1633, 9, 24);

      // Same camera as the Blender render (rear three-quarter) so the
      // cross-fade from the last frame to the live canvas doesn't jump.
      camera = new THREE.PerspectiveCamera(32, stageEl.clientWidth / Math.max(stageEl.clientHeight, 1), 0.1, 100);
      camera.position.set(3.6, 1.7, 4.6);
      camera.lookAt(0, 0.6, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobileLayout ? 1.5 : 2));
      renderer.setSize(stageEl.clientWidth, stageEl.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.opacity = "0"; // hidden until the final-10% cross-fade
      stageEl.insertBefore(renderer.domElement, framesCanvas); // stays underneath (see z-index)

      // ---- Floor ------------------------------------------------------------
      var floor = new THREE.Mesh(
        new THREE.CircleGeometry(11, 64),
        new THREE.MeshStandardMaterial({ color: 0x0b1730, roughness: 0.55, metalness: 0.3 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      var redRing = new THREE.Mesh(
        new THREE.RingGeometry(3.4, 3.44, 64),
        new THREE.MeshBasicMaterial({ color: 0xe11b22, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
      );
      redRing.rotation.x = -Math.PI / 2;
      redRing.position.y = 0.002;
      scene.add(redRing);

      // ---- Studio lighting (kept from the earlier live-cloth build) --------
      scene.add(new THREE.AmbientLight(0x445088, 0.55));
      var key = new THREE.DirectionalLight(0xfff2e0, 2.7);
      key.position.set(4, 6, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1; key.shadow.camera.far = 16;
      scene.add(key);
      var rim = new THREE.DirectionalLight(0xe11b22, 1.9);
      rim.position.set(-5, 3, -3);
      scene.add(rim);
      var rim2 = new THREE.DirectionalLight(0x8fb4ff, 1.1);
      rim2.position.set(2, 2.4, -5.5);
      scene.add(rim2);
      var blueFill = new THREE.PointLight(0x2b3990, 0.7, 16, 2);
      blueFill.position.set(-2, 2, 3);
      scene.add(blueFill);
      var softFill = new THREE.PointLight(0xfff6ea, 0.4, 12, 2);
      softFill.position.set(1.5, 2.2, 4.5);
      scene.add(softFill);

      // ---- Car ---------------------------------------------------------------
      carGroup = new THREE.Group();
      scene.add(carGroup);

      var dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/");
      var loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);

      loader.load("models/car.glb", function (gltf) {
        var root = gltf.scene;
        root.traverse(function (node) {
          if (node.isMesh) {
            node.castShadow = true;
            carMeshNodes.push(node);
            if (node.name === "body" && node.material) bodyMaterial = node.material;
          }
        });

        var box = new THREE.Box3().setFromObject(root);
        var size = new THREE.Vector3(); box.getSize(size);
        var scale = 3.1 / (Math.max(size.x, size.y, size.z) || 1);
        root.scale.setScalar(scale);
        box.setFromObject(root);
        var center = new THREE.Vector3(); box.getCenter(center);
        root.position.x -= center.x;
        root.position.z -= center.z;
        root.position.y -= box.min.y;
        carGroup.add(root);

        if (bodyMaterial) bodyMaterial.color.set("#e11b22"); // Classic Auto red for the hero car
        carReady = true;
      }, undefined, function (err) {
        if (window.console) console.error("[hero3d] car model failed to load:", err);
      });

      // ---- Render loop ----------------------------------------------------
      function animate() {
        requestAnimationFrame(animate);
        if (revealed) carGroup.rotation.y += 0.0032;
        renderer.render(scene, camera);
      }
      requestAnimationFrame(animate);
    } catch (err) {
      if (window.console) console.error("[hero3d] live scene runtime error:", err);
    }
  }

  // =========================================================================
  // Drag-to-reveal arc control — unchanged from the earlier build: a light
  // spring-damper eases the rendered progress toward the pointer's raw
  // target so the handle has real inertia/resistance ("weighty").
  // =========================================================================
  var progress = 0;
  var targetProgress = 0;
  var progressVel = 0;
  var revealed = false;
  var dragging = false;
  var startAngle = -155 * (Math.PI / 180);
  var endAngle = -25 * (Math.PI / 180);
  var ARC_CIRCUMFERENCE = arcFill ? (2 * Math.PI * parseFloat(arcFill.getAttribute("r") || 82)) : 0;

  function pivot() {
    var r = dragWrap.getBoundingClientRect();
    return { x: r.width / 2, y: r.height / 2, w: r.width, h: r.height, left: r.left, top: r.top };
  }
  function radiusFor(p) { return Math.min(p.w, p.h) / 2 - 24; }

  function setHandleAngle(t) {
    var p = pivot();
    var r = radiusFor(p);
    var a = startAngle + (endAngle - startAngle) * t;
    var x = p.x + r * Math.cos(a);
    var y = p.y + r * Math.sin(a);
    handle.style.left = x + "px";
    handle.style.top = y + "px";
    if (arcFill && ARC_CIRCUMFERENCE) {
      arcFill.setAttribute("stroke-dashoffset", String(ARC_CIRCUMFERENCE * (1 - t)));
    }
  }
  setHandleAngle(0);

  function applyProgress(t) {
    targetProgress = Math.max(0, Math.min(1, t));
  }

  // Ease the progress->frame mapping so the "lift-off" reads as weighty:
  // a slow start (peeling a heavy cover off takes some effort before it
  // visibly moves), then catching up through the rest of the drag.
  function easeFrameT(t) { return Math.pow(t, 1.35); }

  function renderProgress(t) {
    setHandleAngle(t);

    var framePortion = Math.min(1, t / CROSSFADE_START);
    targetFrame = Math.round(easeFrameT(framePortion) * (frameMeta.count - 1));
    drawCurrentFrame();

    var crossfadeT = (carReady && t > CROSSFADE_START) ? (t - CROSSFADE_START) / (1 - CROSSFADE_START) : 0;
    var eased = crossfadeT * crossfadeT * (3 - 2 * crossfadeT); // smoothstep
    framesCanvas.style.opacity = String(1 - eased);
    if (renderer) renderer.domElement.style.opacity = String(eased);

    if (t > CROSSFADE_START && !revealed) {
      revealed = true;
      dragWrap.classList.add("is-done");
      revealContent();
    }

    // QA introspection (mirrors the drag hook below) — cheap, always up to
    // date, useful for confirming the frame-index mapping without adding a
    // one-off debug branch.
    window.__heroFrameState = { targetFrame: targetFrame, drawnIndex: drawnIndex, framesLoaded: framesLoaded, count: frameMeta.count, progress: t, crossfade: eased };
  }

  function angleFromEvent(clientX, clientY) {
    var p = pivot();
    var dx = clientX - (p.left + p.x);
    var dy = clientY - (p.top + p.y);
    return Math.atan2(dy, dx);
  }
  function progressFromAngle(angle) {
    var span = endAngle - startAngle;
    var t = (angle - startAngle) / span;
    if (t < -0.5) t += (2 * Math.PI) / span;
    if (t > 1.5) t -= (2 * Math.PI) / span;
    return t;
  }

  function onPointerMove(e) {
    if (!dragging) return;
    var t = progressFromAngle(angleFromEvent(e.clientX, e.clientY));
    applyProgress(t);
  }
  function onPointerUp(e) {
    dragging = false;
    handle.releasePointerCapture && e && e.pointerId != null && handle.releasePointerCapture(e.pointerId);
  }
  handle.addEventListener("pointerdown", function (e) {
    dragging = true;
    handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
    onPointerMove(e);
  });
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", onPointerUp);
  handle.addEventListener("pointercancel", onPointerUp);
  handle.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { applyProgress(targetProgress + 0.08); e.preventDefault(); }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { applyProgress(targetProgress - 0.08); e.preventDefault(); }
  });
  handle.setAttribute("tabindex", "0");
  handle.setAttribute("role", "slider");
  handle.setAttribute("aria-valuemin", "0");
  handle.setAttribute("aria-valuemax", "100");
  handle.setAttribute("aria-label", "Drag to reveal the car");

  function waitForFrame(i, timeoutMs) {
    if (frameImages[i] && frameImages[i].__loaded) return Promise.resolve();
    return new Promise(function (resolve) {
      var elapsed = 0, step = 30;
      var iv = setInterval(function () {
        elapsed += step;
        if ((frameImages[i] && frameImages[i].__loaded) || elapsed >= timeoutMs) {
          clearInterval(iv);
          resolve();
        }
      }, step);
    });
  }

  function applyProgressImmediate(t) {
    // QA hook (window.__heroDragTo): sets progress synchronously and
    // returns a Promise that resolves once the needed frame has actually
    // loaded and been drawn, so an automated screenshot taken right after
    // await is deterministic instead of racing the lazy frame preload.
    targetProgress = Math.max(0, Math.min(1, t));
    progress = targetProgress;
    progressVel = 0;
    renderProgress(progress);
    var framePortion = Math.min(1, progress / CROSSFADE_START);
    var neededIndex = Math.round(easeFrameT(framePortion) * (frameMeta.count - 1));
    return waitForFrame(neededIndex, 5000).then(function () {
      drawnIndex = -1; // force redraw even if bestLoadedIndex resolves to the same idx as a stale draw
      drawCurrentFrame();
    });
  }
  window.__heroDragTo = applyProgressImmediate;

  // ---- Progress spring loop (runs independently of the live scene, so the
  // frame scrubber works even before three.js/the car have loaded) --------
  var lastT = performance.now();
  function progressLoop(now) {
    requestAnimationFrame(progressLoop);
    var dt = Math.min(0.033, (now - lastT) / 1000 || 0.016);
    lastT = now;

    var accel = (targetProgress - progress) * 14 - progressVel * 6.2;
    progressVel += accel * dt;
    progress += progressVel * dt;
    if (progress < 0 && progressVel < 0) { progress = 0; progressVel = 0; }
    if (progress > 1 && progressVel > 0) { progress = 1; progressVel = 0; }

    renderProgress(progress);
  }
  requestAnimationFrame(progressLoop);

  window.addEventListener("resize", function () {
    var w = stageEl.clientWidth, h = stageEl.clientHeight;
    if (camera && renderer && w && h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    resizeFramesCanvas();
    setHandleAngle(progress);
  });
})();
