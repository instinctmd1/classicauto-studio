/* =========================================================================
   Classic Auto — website-v5 — cinematic hero: a real Verlet-integrated
   cloth dust sheet draped over the car under a circular "DRAG TO REVEAL"
   handle. The sheet is a genuine particle-and-constraint simulation (same
   family of technique as three.js's own webgl_animation_cloth example —
   position-based Verlet integration + iterative distance-constraint
   relaxation), pre-settled for ~200 substeps before the page is ever shown
   so it is already resting naturally over the car — draped folds pooling
   at the wheels, a dome over the cabin, slack at the corners — the moment
   the hero fades in. Dragging the handle pulls the rear edge of the sheet
   up and back along an arc with rising wind, sliding it off toward the
   back of the car and floating it away; the last 20% of the drag eases
   the sheet into a fade. Direct inspiration: Ford's "Rediscover the
   Classics" covered-car reveal (slow front lift -> whole sheet sliding
   rearward -> settling ripple as it clears the car).

   Collision: a single analytic car-surface height field fitted to the
   loaded car's bounding box (nose->cabin->boot profile along the length
   axis, a shoulder falloff across the width, four small wheel-arch bumps)
   approximates the body so the cloth drapes over an actual car-shaped
   silhouette without needing named body-part meshes, and without the
   instability a pile of separate overlapping collider shapes causes (see
   the surfaceHeight() comment below).

   Material: a real CC0 woven-linen PBR set from Poly Haven (rough_linen —
   diffuse/normal/roughness, see models/LICENSE.txt; the diffuse map is
   desaturated to neutral grey so it tints cleanly), MeshPhysicalMaterial
   with sheen so the weave and folds catch the rim light. A small
   embroidered "CA" roundel decal rides the fabric near the front,
   following the live surface normal.

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
  var arcFill = heroEl.querySelector("#dragArcFill");
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

      // ---- Lighting -----------------------------------------------------------
      scene.add(new THREE.AmbientLight(0x445088, 0.55));
      var key = new THREE.DirectionalLight(0xfff2e0, 2.4);
      key.position.set(4, 6, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1; key.shadow.camera.far = 16;
      scene.add(key);
      var rim = new THREE.DirectionalLight(0xe11b22, 1.7);
      rim.position.set(-5, 3, -3);
      scene.add(rim);
      // Second, cooler rim placed low and behind so folds in the fabric
      // catch a rim highlight from the far side too (Ford-reference look).
      var rim2 = new THREE.DirectionalLight(0x8fb4ff, 1.1);
      rim2.position.set(2, 2.4, -5.5);
      scene.add(rim2);
      var blueFill = new THREE.PointLight(0x2b3990, 0.7, 16, 2);
      blueFill.position.set(-2, 2, 3);
      scene.add(blueFill);

      // ---- Car group ------------------------------------------------------
      var carGroup = new THREE.Group();
      scene.add(carGroup);
      var bodyMaterial = null;
      var carMeshMaterials = [];
      var carMeshNodes = [];

      var dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/");
      var loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);

      var cloth = null; // ClothSheet instance, built once the car's box is known

      loader.load("models/car.glb", function (gltf) {
        var root = gltf.scene;
        root.traverse(function (node) {
          if (node.isMesh) {
            // Shadow maps render castShadow meshes regardless of material
            // opacity, so an invisible (opacity: 0) car would otherwise
            // still cast a solid silhouette through the dust sheet. Start
            // with shadows off and only enable them once the car has
            // actually started fading in (see renderProgress below).
            node.castShadow = false;
            carMeshNodes.push(node);
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

        var carBox = new THREE.Box3().setFromObject(carGroup);
        cloth = new ClothSheet(THREE, carBox, isMobileLayout);
        scene.add(cloth.mesh);
        if (cloth.decal) scene.add(cloth.decal);
        // Pre-settle the sheet before the user ever sees it, so it is
        // already draped naturally (folds resting, edges pooled at the
        // ground) the instant the canvas is revealed.
        cloth.presettle(220);
        applyProgress(0); // sync pin targets now that the cloth exists
      }, undefined, function (err) {
        showFallback("model failed to load: " + err);
      });

      // =====================================================================
      // ClothSheet — Verlet-integrated particle grid + iterative distance
      // constraints (PBD-style projection, same family as three.js's own
      // webgl_animation_cloth example), draped over an analytic car-surface
      // height field, with a scripted rear-edge "pull" driven by drag
      // progress for the reveal.
      // =====================================================================
      function lerp(a, b, t) { return a + (b - a) * t; }
      function profileAt(t) {
        // Height fraction 0..1 and half-width fraction 0..1 along the car,
        // t=0 nose, t=0.18 hood, t=0.42 windscreen/cabin front, t=0.5 roof
        // peak, t=0.6 cabin rear, t=0.82 boot, t=1 tail.
        var h, wf;
        if (t < 0.08) { h = 0.30; wf = 0.55; }
        else if (t < 0.22) { h = lerp(0.30, 0.55, (t - 0.08) / 0.14); wf = lerp(0.55, 0.86, (t - 0.08) / 0.14); }
        else if (t < 0.40) { h = lerp(0.55, 0.92, (t - 0.22) / 0.18); wf = lerp(0.86, 1.0, (t - 0.22) / 0.18); }
        else if (t < 0.60) { h = lerp(0.92, 0.97, Math.sin((t - 0.40) / 0.20 * Math.PI)); wf = 1.0; }
        else if (t < 0.80) { h = lerp(0.90, 0.62, (t - 0.60) / 0.20); wf = lerp(1.0, 0.84, (t - 0.60) / 0.20); }
        else if (t < 0.94) { h = lerp(0.62, 0.34, (t - 0.80) / 0.14); wf = lerp(0.84, 0.58, (t - 0.80) / 0.14); }
        else { h = 0.30; wf = 0.5; }
        return { h: h, wf: wf };
      }

      function ClothSheet(THREE, carBox, mobile) {
        var self = this;
        var size = new THREE.Vector3(); carBox.getSize(size);
        // Axis convention for THIS model (models/car.glb — confirmed against
        // studio.js's CAM_PRESETS, whose "front" camera sits at z=+4.3):
        // Z is the nose-to-tail length axis (nose at max z), X is width.
        var carWidth = size.x * 1.34;   // sheet extent across the car, local X
        var carLength = size.z * 1.3;   // sheet extent nose-to-tail, local Z
        this.cols = mobile ? 20 : 36;   // grid columns run across width (X)
        this.rows = mobile ? 14 : 26;   // grid rows run nose->tail (Z)
        this.solverIterations = mobile ? 4 : 7;
        var cols = this.cols, rows = this.rows;

        this.w = carWidth; this.d = carLength;
        this.carBox = carBox;
        this.groundY = carBox.min.y + 0.01;

        // ---- Collider: a single analytic car-surface height field, not a
        // pile of separate ellipsoids. A dozen overlapping ellipsoid
        // colliders (the first version of this) fight each other — a
        // particle near two overlapping shapes gets projected onto whichever
        // one is processed last each iteration, and that tug-of-war with the
        // distance constraints never settles, so the sheet drifts and
        // stretches instead of draping. A height field (the max "required
        // clearance" a particle at a given x,z must stay above) has no such
        // conflict: it is a single monotonic clamp per particle, exactly
        // like laying cloth over a smooth car-shaped mound. profileAt(t)
        // gives the body's height/width fraction along the nose->tail
        // spine; wheelBumps adds four small corner bulges on top of it.
        var zNose = carBox.max.z, zTail = carBox.min.z; // nose = +Z, tail = -Z
        var halfW = (carBox.max.x - carBox.min.x) / 2;
        var xMid = (carBox.max.x + carBox.min.x) / 2;
        var floorY = carBox.min.y;
        var roofY = carBox.max.y;
        var bodyH = roofY - floorY;
        this.zNose = zNose; this.zTail = zTail; this.halfW = halfW;
        this.xMid = xMid; this.floorY = floorY; this.bodyH = bodyH;
        this.wheelBumps = [[0.08, -1], [0.08, 1], [0.90, -1], [0.90, 1]].map(function (wheel) {
          return {
            x: xMid + wheel[1] * halfW * 0.92,
            z: lerp(zNose, zTail, wheel[0]),
            r: Math.max(halfW, (zNose - zTail)) * 0.16,
            h: floorY + bodyH * 0.15
          };
        });

        // ---- Particle grid (position-based Verlet) ----
        var count = (cols + 1) * (rows + 1);
        this.px = new Float32Array(count); this.py = new Float32Array(count); this.pz = new Float32Array(count);
        this.ox = new Float32Array(count); this.oy = new Float32Array(count); this.oz = new Float32Array(count); // previous position
        this.pinX = new Float32Array(count); this.pinY = new Float32Array(count); this.pinZ = new Float32Array(count);
        this.pinned = new Uint8Array(count); // 1 = kinematic (driven by the reveal script), 0 = free
        this.invMass = new Float32Array(count).fill(1);

        var zMid = (zNose + zTail) / 2;
        for (var j = 0; j <= rows; j++) {
          for (var i = 0; i <= cols; i++) {
            var idx = j * (cols + 1) + i;
            var u = i / cols - 0.5;      // -0.5 .. 0.5 across width (X)
            var v = 0.5 - j / rows;      // +0.5 (nose) .. -0.5 (tail) along length (Z)
            var x = xMid + u * carWidth;
            var z = zMid + v * carLength;
            // Start each particle just ABOVE where it will actually come to
            // rest (its support height, or the floor if it overhangs past
            // the car) rather than as a flat plane floating high above the
            // whole scene. A tiny hover + presettle relaxation is enough to
            // pick up natural sag and wrinkle; a big free-fall from high up
            // gave the whole sheet room to buckle inward on itself before
            // ever reaching the car (it settled into a small crumpled wad,
            // nowhere near the car's actual footprint).
            var support = self.surfaceHeight(x, z);
            var restY = support > -1e8 ? support : self.floorY;
            var y = restY + 0.10 + Math.random() * 0.04;
            this.px[idx] = x; this.py[idx] = y; this.pz[idx] = z;
            this.ox[idx] = x; this.oy[idx] = y; this.oz[idx] = z;
          }
        }

        // ---- Distance constraints: structural (grid) + shear (diagonal) ----
        this.constraints = [];
        function addC(a, b) {
          var dx = self.px[a] - self.px[b], dy = self.py[a] - self.py[b], dz = self.pz[a] - self.pz[b];
          self.constraints.push(a, b, Math.sqrt(dx * dx + dy * dy + dz * dz));
        }
        for (var jj = 0; jj <= rows; jj++) {
          for (var ii = 0; ii <= cols; ii++) {
            var id = jj * (cols + 1) + ii;
            if (ii < cols) addC(id, id + 1);
            if (jj < rows) addC(id, id + (cols + 1));
            if (ii < cols && jj < rows) { addC(id, id + cols + 2); addC(id + 1, id + cols + 1); }
          }
        }

        // Row 0 = nose/front edge (small "tug" cue); row = rows = tail/rear
        // edge — this is what the drag pulls up and backward off the car.
        this.rearRow = []; this.frontRow = [];
        for (var k = 0; k <= cols; k++) {
          this.rearRow.push(rows * (cols + 1) + k);
          this.frontRow.push(k);
        }

        this.wind = 0.06;
        this.time = 0;

        // ---- Render mesh ----
        var geo = new THREE.BufferGeometry();
        var positions = new Float32Array(count * 3);
        var uvs = new Float32Array(count * 2);
        var indices = [];
        for (var r = 0; r <= rows; r++) {
          for (var c = 0; c <= cols; c++) {
            var pi = r * (cols + 1) + c;
            uvs[pi * 2] = c / cols; uvs[pi * 2 + 1] = r / rows;
            if (r < rows && c < cols) {
              var a2 = pi, b2 = pi + 1, cIdx = pi + cols + 1, d2 = pi + cols + 2;
              indices.push(a2, cIdx, b2, b2, cIdx, d2);
            }
          }
        }
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        var texLoader = new THREE.TextureLoader();
        var base = "models/textures/fabric/rough_linen_";
        var diffuse = texLoader.load(base + "diff_1k.jpg");
        var normalMap = texLoader.load(base + "nor_gl_1k.jpg");
        var roughMap = texLoader.load(base + "rough_1k.jpg");
        [diffuse, normalMap, roughMap].forEach(function (t) {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(carWidth * 2.2, carLength * 2.2);
          t.anisotropy = 4;
        });
        diffuse.colorSpace = THREE.SRGBColorSpace;

        var mat = new THREE.MeshPhysicalMaterial({
          map: diffuse,
          normalMap: normalMap,
          normalScale: new THREE.Vector2(0.75, 0.75),
          roughnessMap: roughMap,
          roughness: 0.95,
          metalness: 0.0,
          sheen: 1.0,
          sheenRoughness: 0.7,
          sheenColor: new THREE.Color(0xd8cdb8),
          color: new THREE.Color(0xf1ecdf), // warm off-white dust-sheet tint
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 1
        });

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = false;

        // ---- Small embroidered "CA" decal, follows the fabric surface ----
        var dCanvas = document.createElement("canvas");
        dCanvas.width = dCanvas.height = 128;
        var dctx = dCanvas.getContext("2d");
        dctx.clearRect(0, 0, 128, 128);
        dctx.strokeStyle = "rgba(120,30,32,0.55)";
        dctx.lineWidth = 3;
        dctx.beginPath(); dctx.arc(64, 64, 46, 0, Math.PI * 2); dctx.stroke();
        dctx.fillStyle = "rgba(120,30,32,0.6)";
        dctx.font = "700 44px Georgia, serif";
        dctx.textAlign = "center"; dctx.textBaseline = "middle";
        dctx.fillText("CA", 64, 68);
        var decalTex = new THREE.CanvasTexture(dCanvas);
        decalTex.colorSpace = THREE.SRGBColorSpace;
        var decalMat = new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
        this.decal = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), decalMat);
        this.decal.renderOrder = 2;
        // Anchor near the front quarter of the grid, a few rows in from the
        // front edge so it rides the hood dome rather than the loose edge.
        this.decalRow = Math.max(2, Math.round(rows * 0.28));
        this.decalCol = Math.round(cols * 0.5);

        this._tmpA = new THREE.Vector3(); this._tmpB = new THREE.Vector3(); this._tmpC = new THREE.Vector3();
        this._tmpN = new THREE.Vector3(); this._tmpUp = new THREE.Vector3(0, 1, 0);
        this._mat4 = new THREE.Matrix4();
      }

      ClothSheet.prototype.idx = function (c, r) { return r * (this.cols + 1) + c; };

      // The required minimum clearance height at a given (x, z): the car's
      // body profile along the nose->tail spine, with a soft falloff past
      // the shoulder so the cloth doesn't hit a hard lip at the car's
      // sides, plus four small wheel-arch bumps. A single number per point
      // — no overlapping shapes to fight each other, so it can only ever
      // push a particle up, never sideways into another collider.
      ClothSheet.prototype.surfaceHeight = function (x, z) {
        var span = this.zNose - this.zTail;
        var margin = 0.07; // soft falloff, in normalised nose->tail units, past the bumpers
        var tRaw = (this.zNose - z) / span; // 0 at nose .. 1 at tail; can run outside [0,1] past the car
        var req = -1e9;
        if (tRaw >= -margin && tRaw <= 1 + margin) {
          // Beyond the real bumpers the profile must NOT keep extending —
          // that was the earlier bug: clamping t let the "car" height field
          // stretch out to infinity along Z, so the overhanging sheet was
          // propped up everywhere and never reached the floor. Past the tip
          // it now fades to zero over `margin` instead of clamping flat.
          var zFalloff = tRaw < 0 ? 1 + tRaw / margin : tRaw > 1 ? 1 - (tRaw - 1) / margin : 1;
          var t = tRaw < 0 ? 0 : tRaw > 1 ? 1 : tRaw;
          var p = profileAt(t);
          var halfWidthAtT = Math.max(0.06, p.wf * this.halfW);
          var dx = Math.abs(x - this.xMid);
          var edge = halfWidthAtT * 1.06;
          if (dx < edge) {
            var falloff = dx < halfWidthAtT ? 1 : Math.max(0, 1 - (dx - halfWidthAtT) / (edge - halfWidthAtT));
            req = this.floorY + p.h * this.bodyH * (0.22 + 0.78 * falloff * falloff) * zFalloff;
          }
        }
        var wheels = this.wheelBumps;
        for (var i = 0; i < wheels.length; i++) {
          var wb = wheels[i];
          var ddx = x - wb.x, ddz = z - wb.z;
          var dd = Math.sqrt(ddx * ddx + ddz * ddz);
          if (dd < wb.r) {
            var wf2 = 1 - dd / wb.r;
            var wh = this.floorY + (wb.h - this.floorY) * wf2 * wf2;
            if (wh > req) req = wh;
          }
        }
        return req;
      };

      ClothSheet.prototype.satisfyCollisions = function () {
        for (var n = 0; n < this.px.length; n++) {
          if (this.pinned[n]) continue;
          var x = this.px[n], y = this.py[n], z = this.pz[n];
          var reqY = this.surfaceHeight(x, z);
          if (y < reqY) y = reqY;
          if (y < this.groundY) y = this.groundY;
          this.py[n] = y;
        }
      };

      ClothSheet.prototype.satisfyConstraints = function () {
        var c = this.constraints, px = this.px, py = this.py, pz = this.pz, invMass = this.invMass, pinned = this.pinned;
        for (var pass = 0; pass < this.solverIterations; pass++) {
          for (var i = 0; i < c.length; i += 3) {
            var a = c[i], b = c[i + 1], rest = c[i + 2];
            var dx = px[b] - px[a], dy = py[b] - py[a], dz = pz[b] - pz[a];
            var dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
            var diff = (dist - rest) / dist;
            var im1 = pinned[a] ? 0 : invMass[a], im2 = pinned[b] ? 0 : invMass[b];
            var sum = im1 + im2; if (sum <= 0) continue;
            var k1 = im1 / sum, k2 = im2 / sum;
            var ox = dx * diff, oy = dy * diff, oz = dz * diff;
            if (!pinned[a]) { px[a] += ox * k1; py[a] += oy * k1; pz[a] += oz * k1; }
            if (!pinned[b]) { px[b] -= ox * k2; py[b] -= oy * k2; pz[b] -= oz * k2; }
          }
          this.satisfyCollisions();
        }
      };

      ClothSheet.prototype.step = function (dt, gravityY, windStrength) {
        this.time += dt;
        var damping = 0.985;
        var wx = Math.sin(this.time * 0.8) * windStrength;
        var wz = Math.cos(this.time * 0.63) * windStrength * 0.7;
        var n = this.px.length;
        for (var i = 0; i < n; i++) {
          if (this.pinned[i]) {
            this.px[i] = this.pinX[i]; this.py[i] = this.pinY[i]; this.pz[i] = this.pinZ[i];
            continue;
          }
          var x = this.px[i], y = this.py[i], z = this.pz[i];
          var vx = (x - this.ox[i]) * damping, vy = (y - this.oy[i]) * damping, vz = (z - this.oz[i]) * damping;
          var nx = x + vx + wx * dt * dt * 60;
          var ny = y + vy + gravityY * dt * dt;
          var nz = z + vz + wz * dt * dt * 60;
          this.ox[i] = x; this.oy[i] = y; this.oz[i] = z;
          this.px[i] = nx; this.py[i] = ny; this.pz[i] = nz;
        }
        this.satisfyConstraints();
      };

      ClothSheet.prototype.presettle = function (steps) {
        // Pin nothing yet — let the flat sheet fall onto the car under
        // gravity and settle against the colliders, exactly like laying a
        // real dust sheet over a car by hand and letting it drape.
        for (var s = 0; s < steps; s++) this.step(1 / 60, -9.8, 0);
      };

      ClothSheet.prototype.setRearPull = function (t, wobble) {
        // t: 0..1 reveal progress. The tail-edge row is pulled up and
        // backward (-Z, away from the car) along an arc; a light per-column
        // stagger + wobble adds an organic ripple instead of a rigid sheet.
        var arcT = Math.min(1, Math.max(0, (t - 0.10) / 0.80)); // main pull window
        var pulled = t > 0.08;
        this.pulling = pulled;
        for (var k = 0; k < this.rearRow.length; k++) {
          var id = this.rearRow[k];
          var stagger = (k / this.rearRow.length - 0.5) * 0.12;
          var localT = Math.max(0, Math.min(1, arcT + stagger));
          var localLift = Math.pow(localT, 0.7);
          if (pulled) {
            this.pinned[id] = 1;
            this.pinX[id] = this.baseX[id];
            this.pinY[id] = this.baseY[id] + localLift * (this.bodyH * 2.4) + Math.sin(this.time * 3 + k) * 0.02 * wobble;
            this.pinZ[id] = this.baseZ[id] - localLift * (this.d * 0.55);
          } else {
            this.pinned[id] = 0;
          }
        }
        // Small front-edge "tug" cue early in the drag (t 0..0.18), then
        // released so the rest of the pull is a natural cloth reaction.
        var tug = Math.sin(Math.min(1, t / 0.18) * Math.PI) * 0.14 * Math.max(0, 1 - t / 0.4);
        for (var f = 0; f < this.frontRow.length; f++) {
          var fid = this.frontRow[f];
          if (t < 0.4 && tug > 0.01) {
            this.pinned[fid] = 1;
            this.pinX[fid] = this.baseX[fid];
            this.pinY[fid] = this.baseY[fid] + tug;
            this.pinZ[fid] = this.baseZ[fid];
          } else {
            this.pinned[fid] = 0;
          }
        }
      };

      ClothSheet.prototype.captureRestPose = function () {
        this.baseX = this.px.slice(); this.baseY = this.py.slice(); this.baseZ = this.pz.slice();
      };

      ClothSheet.prototype.updateMesh = function () {
        var pos = this.mesh.geometry.attributes.position;
        var n = this.px.length;
        for (var i = 0; i < n; i++) {
          pos.setXYZ(i, this.px[i], this.py[i], this.pz[i]);
        }
        pos.needsUpdate = true;
        this.mesh.geometry.computeVertexNormals();

        // Track the decal to its anchor vertex + local surface normal.
        if (this.decal) {
          var c0 = this.decalCol, r0 = this.decalRow;
          var iC = Math.min(this.cols, c0 + 1), iR = Math.min(this.rows, r0 + 1);
          var a = this.idx(c0, r0), b = this.idx(iC, r0), cI = this.idx(c0, iR);
          this._tmpA.set(this.px[a], this.py[a], this.pz[a]);
          this._tmpB.set(this.px[b], this.py[b], this.pz[b]);
          this._tmpC.set(this.px[cI], this.py[cI], this.pz[cI]);
          this.decal.position.copy(this._tmpA);
          var e1 = this._tmpB.clone().sub(this._tmpA);
          var e2 = this._tmpC.clone().sub(this._tmpA);
          var normal = e1.clone().cross(e2).normalize();
          this.decal.position.addScaledVector(normal, 0.004);
          var m = new THREE.Matrix4();
          m.lookAt(new THREE.Vector3(0, 0, 0), normal, this._tmpUp);
          this.decal.quaternion.setFromRotationMatrix(m);
        }
      };

      // ---- Drag-to-reveal arc control ----------------------------------------
      var progress = 0;      // smoothed, rendered progress (what the sim/handle use)
      var targetProgress = 0; // raw pointer-driven target
      var progressVel = 0;
      var revealed = false;
      var dragging = false;
      var startAngle = -155 * (Math.PI / 180);
      var endAngle = -25 * (Math.PI / 180);
      var isMobileLayout = window.matchMedia("(max-width: 780px)").matches;
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
        // Sets the pointer-driven TARGET. The rendered `progress` eases
        // toward this every frame (see animate()) so the drag feels
        // weighty — resistance + inertia — rather than snapping 1:1.
        targetProgress = Math.max(0, Math.min(1, t));
      }

      function applyProgressImmediate(t) {
        // Used by the automated QA hook (window.__heroDragTo): sets and
        // settles the simulation synchronously so a screenshot taken right
        // after the call shows a physically caught-up pose.
        targetProgress = Math.max(0, Math.min(1, t));
        progress = targetProgress;
        progressVel = 0;
        renderProgress(progress);
        if (cloth) {
          for (var s = 0; s < 50; s++) {
            cloth.setRearPull(progress, 1);
            cloth.step(1 / 60, -9.8, cloth.wind);
          }
          cloth.updateMesh();
        }
      }

      function renderProgress(t) {
        setHandleAngle(t);
        carMeshMaterials.forEach(function (m) { m.opacity = Math.min(1, t * 1.15); });
        var carShadowsOn = t > 0.06;
        for (var cm = 0; cm < carMeshNodes.length; cm++) carMeshNodes[cm].castShadow = carShadowsOn;
        carGroup.scale.setScalar(0.95 + t * 0.05);
        if (cloth) {
          var fadeStart = 0.8;
          var fadeT = t > fadeStart ? (t - fadeStart) / (1 - fadeStart) : 0;
          var eased = fadeT * fadeT * (3 - 2 * fadeT); // smoothstep
          cloth.mesh.material.opacity = Math.max(0, 1 - eased);
          cloth.mesh.visible = cloth.mesh.material.opacity > 0.01;
          if (cloth.decal) cloth.decal.visible = cloth.mesh.visible && t < 0.35;
        }
        if (t > 0.94 && !revealed) {
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
        if (e.key === "ArrowRight" || e.key === "ArrowUp") { applyProgress(targetProgress + 0.08); e.preventDefault(); }
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") { applyProgress(targetProgress - 0.08); e.preventDefault(); }
      });
      handle.setAttribute("tabindex", "0");
      handle.setAttribute("role", "slider");
      handle.setAttribute("aria-valuemin", "0");
      handle.setAttribute("aria-valuemax", "100");
      handle.setAttribute("aria-label", "Drag to reveal the car");

      // Expose a hook the QA pass (and the "Tap to reveal" copy) can use to
      // simulate a full drag without a real pointer gesture.
      window.__heroDragTo = applyProgressImmediate;

      // ---- Resize ---------------------------------------------------------
      function onResize() {
        var w = stageEl.clientWidth, h = stageEl.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        setHandleAngle(progress);
      }
      window.addEventListener("resize", onResize);

      // ---- Render loop ----------------------------------------------------
      var lastT = performance.now();
      function animate(now) {
        requestAnimationFrame(animate);
        var dt = Math.min(0.033, (now - lastT) / 1000 || 0.016);
        lastT = now;

        // Weighty drag: a light spring-damper eases the rendered progress
        // toward the pointer's raw target instead of snapping to it.
        var accel = (targetProgress - progress) * 14 - progressVel * 6.2;
        progressVel += accel * dt;
        progress += progressVel * dt;
        if (progress < 0 && progressVel < 0) { progress = 0; progressVel = 0; }
        if (progress > 1 && progressVel > 0) { progress = 1; progressVel = 0; }

        renderProgress(progress);

        if (cloth && cloth.mesh.visible) {
          if (!cloth.baseX) cloth.captureRestPose();
          var windStrength = 0.02 + progress * 0.16; // rising wind as it lifts away
          cloth.setRearPull(progress, 1);
          cloth.step(dt, -9.8, windStrength);
          cloth.updateMesh();
        } else if (cloth && !cloth.baseX) {
          cloth.captureRestPose();
        }

        if (revealed) carGroup.rotation.y += 0.0032;
        renderer.render(scene, camera);
      }
      requestAnimationFrame(animate);

      // Subtle idle "breathing" wind before any drag starts, applied via
      // the same per-frame wind field in cloth.step above (progress===0
      // still yields a small non-zero windStrength), so the sheet is
      // never perfectly frozen even before the visitor touches the handle.
    } catch (err) {
      showFallback("runtime error: " + err);
    }
  }
})();
