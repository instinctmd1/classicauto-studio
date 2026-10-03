/* Classic Auto Post Studio — logo sting (PS-6): the lockup of the real posts (assets/logo.png, cropped from the live Instagram listings) revealed on a canvas and recorded
   to WebM. 1.9 s: the red C and blue A wipe in from the left, CLASSIC AUTO rises, SINCE 1974 fades in, PRE OWNED CARS follows, then a 0.6 s hold on the finished logo.
   Nothing is redrawn or recoloured: every frame is a slice of assets/logo.png. */
(function () {
  'use strict';
  const PS = window.PS, D = PS.D;
  const DUR = 1.9;
  const clamp = (x) => Math.max(0, Math.min(1, x)), ease = (x) => 1 - Math.pow(1 - clamp(x), 3), ph = (t, a, b) => clamp((t - a) / (b - a));
  // slices of logo.png (858 x 449): [sx, sy, sw, sh]
  const MARK_LOW = [0, 95, 858, 204], MARK_TOP = [0, 0, 520, 95], SINCE = [520, 0, 338, 95], NAME = [0, 295, 858, 70], TAG = [0, 380, 858, 69];

  // t in seconds, 0..DUR. Deterministic: the same t always draws the same frame.
  function frame(c, W, H, t) {
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
    const img = D.logo; if (!img) { c.restore(); return; }
    const k = img.width / 858, VB = [858, 449], s = Math.min((W * 0.78) / VB[0], (H * 0.5) / VB[1]); c.translate((W - VB[0] * s) / 2, (H - VB[1] * s) / 2); c.scale(s, s);
    const piece = (r, dy, alpha, clipW) => { c.save(); c.globalAlpha = alpha; if (clipW != null) { c.beginPath(); c.rect(0, 0, clipW, VB[1]); c.clip(); } c.drawImage(img, r[0] * k, r[1] * k, r[2] * k, r[3] * k, r[0], r[1] + dy, r[2], r[3]); c.restore(); };
    const pm = ease(ph(t, 0.05, 0.75)); if (pm > 0) { piece(MARK_LOW, 0, 1, VB[0] * pm); piece(MARK_TOP, 0, 1, VB[0] * pm); }
    const pn = ease(ph(t, 0.7, 1.05)); if (pn > 0) piece(NAME, (1 - pn) * 18, pn);
    const ps = ease(ph(t, 0.95, 1.25)); if (ps > 0) piece(SINCE, 0, ps);
    const pt = ease(ph(t, 1.15, 1.45)); if (pt > 0) piece(TAG, (1 - pt) * 10, pt);
    c.restore();
  }

  // records one size to WebM in real time. Resolves to a Blob.
  function record(W, H, onFrame) {
    return new Promise((resolve, reject) => {
      if (!window.MediaRecorder) { reject(new Error('This browser cannot record video. Use Chrome or Edge.')); return; }
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), stream = cv.captureStream(30);
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)), rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 }), chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); }; rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })); rec.onerror = (e) => reject(e.error || e);
      let t0 = 0; const step = (now) => { if (!t0) t0 = now; const t = (now - t0) / 1000; frame(c, W, H, Math.min(t, DUR)); if (onFrame) onFrame(t / DUR); if (t < DUR + 0.15) requestAnimationFrame(step); else rec.stop(); };
      rec.start(); frame(c, W, H, 0); requestAnimationFrame(step);
    });
  }
  PS.sting = { DUR, frame, record, SIZES: ['1080x1920', '1080x1080', '1920x1080'] };
})();
