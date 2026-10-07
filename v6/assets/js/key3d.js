/* =========================================================================
   Classic Auto v6: the key handover (home chapter 05 / THE KEYS).

   A small three.js scene built from code (no download): a car key with the
   Classic Auto mark arcs in from the side as the chapter scrolls up, turns,
   and comes to rest on a leather presentation tray. Kept light for phones:
   a fixed pixel ratio (1.5x at most on phones, never changed after the first
   frame: changing it blanked WebKit canvases, see live3d.js), no shadow pass
   (a painted contact shadow instead), and frames only while the chapter is
   on screen. handover.js creates it when the chapter comes near and calls
   destroy() when it is far away, so the page holds one live WebGL context
   most of the time. Reduced motion: the key is drawn once, already resting.
   ========================================================================= */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

var C_PATH = "M 100 12 L 300 12 L 300 88 L 128 88 Q 96 88 96 120 L 96 238 Q 96 268 128 268 L 688 268 Q 722 268 722 302 L 722 310 Q 722 344 688 344 L 92 344 Q 14 344 14 266 L 14 98 Q 14 12 100 12 Z";
var A_BARS = [[468, 6, 552, 6, 372, 360, 288, 360], [468, 6, 552, 6, 758, 360, 674, 360], [404, 212, 620, 212, 650, 282, 370, 282]];

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function roundedRect(w, h, r) {
  var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* The Classic Auto mark on a transparent square (red C, brand-blue A lifted for a black key). */
function markTexture() {
  var c = document.createElement("canvas"); c.width = c.height = 256;
  var g = c.getContext("2d");
  g.translate(128, 128); g.scale(0.28, 0.28); g.translate(-386, -183);
  g.fillStyle = "#e11b22";
  if (window.Path2D) g.fill(new Path2D(C_PATH));
  g.fillStyle = "#8e9cf2";
  A_BARS.forEach(function (p) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[2], p[3]); g.lineTo(p[4], p[5]); g.lineTo(p[6], p[7]); g.closePath(); g.fill(); });
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/* The tray's leather top: a stitched ring and "CLASSIC AUTO · SINCE 1974" set round the edge. */
function trayTexture() {
  var S = 1024, c = document.createElement("canvas"); c.width = c.height = S;
  var g = c.getContext("2d"), m = S / 2;
  var grd = g.createRadialGradient(m, m, 40, m, m, m);
  grd.addColorStop(0, "#1d3266"); grd.addColorStop(1, "#0e1a3c");
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  g.strokeStyle = "rgba(225,27,34,0.9)"; g.lineWidth = 5; g.setLineDash([16, 12]);
  g.beginPath(); g.arc(m, m, m * 0.9, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]); g.strokeStyle = "rgba(245,242,236,0.16)"; g.lineWidth = 2;
  g.beginPath(); g.arc(m, m, m * 0.62, 0, Math.PI * 2); g.stroke();
  var text = "CLASSIC AUTO · SINCE 1974 · CLASSIC AUTO · SINCE 1974 · ";
  g.fillStyle = "rgba(245,242,236,0.55)";
  g.font = '44px "Bebas Neue", "Arial Narrow", sans-serif';
  g.textAlign = "center"; g.textBaseline = "middle";
  var step = (Math.PI * 2) / text.length;
  for (var i = 0; i < text.length; i++) {
    var a = i * step - Math.PI / 2;
    g.save(); g.translate(m + Math.cos(a) * m * 0.76, m + Math.sin(a) * m * 0.76); g.rotate(a + Math.PI / 2);
    g.fillText(text[i], 0, 0); g.restore();
  }
  var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function shadowTexture() {
  var c = document.createElement("canvas"); c.width = c.height = 128;
  var g = c.getContext("2d"), grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,0.75)"); grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function buildKey(mats) {
  var key = new THREE.Group();
  var W = 0.42, H = 0.8, D = 0.1;
  var body = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(W, H, 0.17), { depth: D, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 18 }), mats.gloss);
  body.geometry.center(); key.add(body);
  var band = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(W + 0.075, H + 0.075, 0.2), { depth: 0.035, bevelEnabled: false, curveSegments: 18 }), mats.chrome);
  band.geometry.center(); key.add(band);
  var face = D / 2 + 0.031;
  var mark = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), new THREE.MeshBasicMaterial({ map: markTexture(), transparent: true, toneMapped: false }));
  mark.position.set(0, 0.2, face + 0.002); key.add(mark);
  var btnGeo = new THREE.CylinderGeometry(0.06, 0.064, 0.025, 32);
  [[0, 0.0, mats.rubber], [0, -0.15, mats.rubber], [0, -0.29, mats.red]].forEach(function (b) {
    var m = new THREE.Mesh(btnGeo, b[2]); m.rotation.x = Math.PI / 2; m.position.set(b[0], b[1], face); key.add(m);
  });
  var loop = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 12, 32), mats.chrome);
  loop.rotation.y = Math.PI / 2; loop.position.set(0, H / 2 + 0.07, 0); key.add(loop);
  var ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 12, 64), mats.chrome);   // in the key's own plane, so it lies flat on the tray
  ring.position.set(0, H / 2 + 0.07 + 0.06 + 0.18, 0); key.add(ring);
  return key;
}

export function createKeyScene(host, opts) {
  opts = opts || {};
  var mobile = !!opts.mobile, reduced = !!opts.reducedMotion;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));   // fixed for the session (WebKit)
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  var canvas = renderer.domElement;
  canvas.className = "handover-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.touchAction = "pan-y";

  var scene = new THREE.Scene();
  var pmrem = new THREE.PMREMGenerator(renderer);
  var envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();
  var keyLight = new THREE.DirectionalLight(0xffffff, 1.6); keyLight.position.set(2, 4, 3); scene.add(keyLight);
  var rim = new THREE.DirectionalLight(0xff3b30, 1.2); rim.position.set(-3, 1.5, -2); scene.add(rim);

  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 2.5, 4.3);
  camera.lookAt(0, 0.35, 0);

  var mats = {
    gloss: new THREE.MeshPhysicalMaterial({ color: 0x0b0d12, roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe8e8ee, roughness: 0.16, metalness: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.6, metalness: 0.1 }),
    red: new THREE.MeshStandardMaterial({ color: 0xe11b22, roughness: 0.4, metalness: 0.1 })
  };
  var textures = [];

  var turntable = new THREE.Group(); scene.add(turntable);
  var trayTop = trayTexture(); textures.push(trayTop);
  var leather = new THREE.MeshStandardMaterial({ color: 0x13224a, roughness: 0.85, metalness: 0 });
  var tray = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.03, 0.09, 96), [leather, new THREE.MeshStandardMaterial({ map: trayTop, roughness: 0.8, metalness: 0 }), leather]);
  tray.position.y = -0.045; turntable.add(tray);
  var rimRing = new THREE.Mesh(new THREE.TorusGeometry(1.015, 0.022, 12, 128), mats.chrome);
  rimRing.rotation.x = Math.PI / 2; rimRing.position.y = 0.002; turntable.add(rimRing);
  var shTex = shadowTexture(); textures.push(shTex);
  var shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.004; turntable.add(shadow);

  var key = buildKey(mats); scene.add(key);
  textures.push(key.children[2].material.map);

  /* Path: in from the top left, over the tray, down to rest. p is the chapter's scroll progress (0 entering, 1 leaving). */
  var P0 = new THREE.Vector3(-2.6, 2.4, 0.9), P1 = new THREE.Vector3(0.6, 2.2, 0.6), P2 = new THREE.Vector3(0.05, 0.11, 0.05);
  var pos = new THREE.Vector3();
  var target = reduced ? 1 : 0, cur = target, pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  var raf = 0, visible = false, t0 = performance.now(), settled = false;

  function pose(k, time) {
    var e = easeInOut(clamp(k, 0, 1));
    var a = 1 - e;
    pos.set(0, 0, 0).addScaledVector(P0, a * a).addScaledVector(P1, 2 * a * e).addScaledVector(P2, e * e);
    var swing = reduced ? 0 : Math.sin(time * 1.6) * 0.12 * a;
    key.position.copy(pos);
    key.rotation.set(-Math.PI / 2 * e + 0.25 * a, a * Math.PI * 2.4, swing + 0.35 * e);   // y ends at 0 so the key lies flat
    shadow.material.opacity = 0.15 + 0.6 * e * e;
    shadow.scale.setScalar(1.6 - 0.8 * e);
    var nowSettled = e > 0.98;
    if (nowSettled !== settled) { settled = nowSettled; if (opts.onSettle) opts.onSettle(settled); }
  }

  function progress() {
    /* 0 when the stage's top edge enters at the bottom, 1 (resting) once its middle is 55% of the way down the screen */
    var r = host.getBoundingClientRect(), vh = window.innerHeight || 800;
    return clamp((vh - r.top) / (vh * 0.45 + r.height * 0.5), 0, 1);
  }

  var last = 0;
  function render(now) {
    var time = (now - t0) / 1000, dt = last ? Math.min((now - last) / 1000, 0.1) : 0.016;
    last = now;
    if (!reduced) {
      target = progress();
      var k = 1 - Math.exp(-dt * 4.5), kp = 1 - Math.exp(-dt * 3.5);   // by time, not by frame, so a slow phone lands the key as fast
      cur += (target - cur) * k;
      if (Math.abs(target - cur) < 0.002) cur = target;
      pointer.sx += (pointer.x - pointer.sx) * kp; pointer.sy += (pointer.y - pointer.sy) * kp;
      turntable.rotation.y = time * 0.12;
      scene.rotation.x = pointer.sy * 0.06; scene.rotation.z = -pointer.sx * 0.05;
    }
    pose(cur, time);
    renderer.render(scene, camera);
  }
  function frame(now) { render(now); raf = visible ? requestAnimationFrame(frame) : 0; if (!raf) last = 0; }

  function resize() {
    var w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 36 : 30;
    camera.updateProjectionMatrix();
    if (!raf) render(performance.now());
  }
  var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(host); else window.addEventListener("resize", resize);

  function onPointer(e) {
    var r = host.getBoundingClientRect();
    pointer.x = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
    pointer.y = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
  }
  if (!mobile && !reduced) host.addEventListener("pointermove", onPointer, { passive: true });

  host.appendChild(canvas);
  resize();

  return {
    canvas: canvas,
    setVisible: function (on) {
      visible = !!on && !reduced;
      if (visible && !raf) raf = requestAnimationFrame(frame);
      if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
      if (on && reduced) render(performance.now());
    },
    destroy: function () {
      visible = false; if (raf) cancelAnimationFrame(raf); raf = 0;
      if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
      host.removeEventListener("pointermove", onPointer);
      scene.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach(function (m) { m.dispose(); });
      });
      textures.forEach(function (t) { t && t.dispose(); });
      envTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  };
}
