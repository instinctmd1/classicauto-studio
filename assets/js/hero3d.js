/* =========================================================================
   Classic Auto — website-v5 — cinematic hero: a sheet-draped car under a
   circular "DRAG TO REVEAL" handle. Dragging the handle along its arc
   lifts + fades the dust sheet, fades the car in, and once fully revealed
   starts a smooth 360° turntable and fades in the "CLASSIC AUTO — Since
   1974" display type. Inspired by Ford's "Rediscover the Classics"
   covered-car reveal.

   The sheet is a cloth-LIKE plane (displaced + slightly noisy geometry,
   matte fabric material) — not a physics cloth sim; see the build report
   for why. Reuses models/car.glb (the same Ferrari 458 body used by the
   Studio — see models/LICENSE.txt), painted Classic Auto red.

   Graceful fallback: prefers-reduced-motion, no WebGL, or a load/runtime
   error all fall back to a static hero photo + a "Tap to reveal" button
   that fades in the same headline/CTA copy without any 3D.
   ========================================================================= */
(function () {
  "use strict";

  var heroEl = document.querySelector(".hero3d");
  if (!heroEl) return;

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
  if (!stageEl || !handle || !dragWrap) { showFallback("missing markup"); return; }

  import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js").then(function (THREE) {
    return import("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js").then(function (GLTFMod) {
      return import("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/DRACOLoader.js").then(function (DracoMod) {
        boot(THREE, GLTFMod.GLTFLoader, DracoMod.DRACOLoader);
      });
    });
  }).catch(function (err) { showFallback("module load failed: " + err); });

  function boot(THREE, GLTFLoader, DRACOLoader) {
    try {
      var scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a1633);
      scene.fog = new THREE.Fog(0x0a1633, 9, 24);

      var camera = new THREE.PerspectiveCamera(32, stageEl.clientWidth / Math.max(stageEl.clientHeight, 1), 0.1, 100);
      camera.position.set(3.6, 1.7, 4.6);
      camera.lookAt(0, 0.6, 0);

      var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(stageEl.clientWidth, stageEl.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      stageEl.appendChild(renderer.domElement);

      // ---- Floor ----------------------------------------------------------
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

      // ---- Lighting ---------------------------------------------------------
      scene.add(new THREE.AmbientLight(0x445088, 0.55));
      var key = new THREE.DirectionalLight(0xfff2e0, 2.4);
      key.position.set(4, 6, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1; key.shadow.camera.far = 16;
      scene.add(key);
      var rim = new THREE.DirectionalLight(0xe11b22, 1.4);
      rim.position.set(-5, 3, -3);
      scene.add(rim);
      var blueFill = new THREE.PointLight(0x2b3990, 0.7, 16, 2);
      blueFill.position.set(-2, 2, 3);
      scene.add(blueFill);

      // ---- Car group ----------------------------------------------------------
      var carGroup = new THREE.Group();
      scene.add(carGroup);
      var bodyMaterial = null;
      var carMeshMaterials = [];
      var carLoaded = false;

      var dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/");
      var loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);

      var sheet, sheetBaseY;

      loader.load("models/car.glb", function (gltf) {
        var root = gltf.scene;
        root.traverse(function (node) {
          if (node.isMesh) {
            node.castShadow = true;
            if (node.name === "body" && node.material) bodyMaterial = node.material;
            var mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach(function (m) {
              if (!m) return;
              m.transparent = true;
              m.opacity = 0;
              m.needsUpdate = true;
              carMeshMaterials.push(m);
            });
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

        var box2 = new THREE.Box3().setFromObject(carGroup);
        buildSheet(box2);
        carLoaded = true;
      }, undefined, function (err) {
        showFallback("model failed to load: " + err);
      });

      // ---- Sheet: a cloth-LIKE draped plane (displaced geometry + noise,
      // matte fabric material) — see file header note on why this isn't a
      // physics cloth sim. ------------------------------------------------
      function buildSheet(carBox) {
        var w = (carBox.max.x - carBox.min.x) * 1.28;
        var d = (carBox.max.z - carBox.min.z) * 1.34;
        var h = (carBox.max.y - carBox.min.y) * 1.08;
        var segX = 44, segZ = 30;
        var geo = new THREE.PlaneGeometry(w, d, segX, segZ);
        geo.rotateX(-Math.PI / 2);
        var pos = geo.attributes.position;
        for (var i = 0; i < pos.count; i++) {
          var x = pos.getX(i), z = pos.getZ(i);
          var nx = x / (w / 2), nz = z / (d / 2);
          var domeFalloff = Math.max(0, 1 - (nx * nx * 0.9 + nz * nz * 0.7));
          var dome = Math.pow(domeFalloff, 1.15) * h;
          var wrinkle = Math.sin(x * 6 + z * 2.3) * 0.02 + Math.sin(z * 8 - x * 3) * 0.015;
          var edgeDrape = Math.max(0, 1 - domeFalloff) * -0.12;
          pos.setY(i, dome + wrinkle * domeFalloff + edgeDrape);
        }
        geo.computeVertexNormals();

        var sheetMat = new THREE.MeshStandardMaterial({
          color: 0xece7dc, roughness: 0.92, metalness: 0.0,
          side: THREE.DoubleSide, transparent: true, opacity: 1
        });
        sheet = new THREE.Mesh(geo, sheetMat);
        sheetBaseY = carBox.min.y + 0.02;
        sheet.position.y = sheetBaseY;
        sheet.castShadow = true;
        sheet.receiveShadow = true;
        scene.add(sheet);
      }

      // ---- Drag-to-reveal arc control ----------------------------------------
      var progress = 0;
      var revealed = false;
      var dragging = false;
      var startAngle = -155 * (Math.PI / 180);
      var endAngle = -25 * (Math.PI / 180);
      var isMobileLayout = window.matchMedia("(max-width: 780px)").matches;

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
      }
      setHandleAngle(0);

      function applyProgress(t) {
        progress = Math.max(0, Math.min(1, t));
        setHandleAngle(progress);
        if (sheet) {
          sheet.material.opacity = 1 - progress;
          sheet.position.y = sheetBaseY + progress * 1.4;
          sheet.scale.setScalar(1 + progress * 0.06);
        }
        carMeshMaterials.forEach(function (m) { m.opacity = Math.min(1, progress * 1.15); });
        carGroup.scale.setScalar(0.95 + progress * 0.05);

        if (progress > 0.94 && !revealed) {
          revealed = true;
          dragWrap.classList.add("is-done");
          revealContent();
        }
      }

      function angleFromEvent(clientX, clientY) {
        var p = pivot();
        var dx = clientX - (p.left + p.x);
        var dy = clientY - (p.top + p.y);
        return Math.atan2(dy, dx);
      }
      function progressFromAngle(angle) {
        // Normalise so the short way round the start->end sweep always
        // resolves to a value in [0,1], regardless of atan2's -PI..PI wrap.
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
        if (e.key === "ArrowRight" || e.key === "ArrowUp") { applyProgress(progress + 0.08); e.preventDefault(); }
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") { applyProgress(progress - 0.08); e.preventDefault(); }
      });
      handle.setAttribute("tabindex", "0");
      handle.setAttribute("role", "slider");
      handle.setAttribute("aria-valuemin", "0");
      handle.setAttribute("aria-valuemax", "100");
      handle.setAttribute("aria-label", "Drag to reveal the car");

      // Expose a hook the QA pass (and the "Tap to reveal" copy) can use to
      // simulate a full drag without a real pointer gesture.
      window.__heroDragTo = applyProgress;

      // ---- Resize -------------------------------------------------------------
      function onResize() {
        var w = stageEl.clientWidth, h = stageEl.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        setHandleAngle(progress);
      }
      window.addEventListener("resize", onResize);

      // ---- Render loop ----------------------------------------------------------
      function animate() {
        requestAnimationFrame(animate);
        if (revealed) carGroup.rotation.y += 0.0032;
        renderer.render(scene, camera);
      }
      requestAnimationFrame(animate);
    } catch (err) {
      showFallback("runtime error: " + err);
    }
  }
})();
