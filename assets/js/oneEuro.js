/* One Euro filter (Casiez, Roussel, Vogel 2012): adaptive low-pass that smooths
   jitter at low speed and keeps lag small at high speed. Used for pointer and
   gyro input on the 3D cars. Defaults: minCutoff 1.0, beta 0.007, dCutoff 1.0. */
export class OneEuro {
  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
    this.x = null; this.dx = 0; this.t = null;
  }
  static alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  reset(v = null) { this.x = v; this.dx = 0; this.t = null; }
  filter(v, tMs) {
    if (this.x === null || this.t === null) { this.x = v; this.t = tMs; return v; }
    const dt = Math.max((tMs - this.t) / 1000, 1e-4);
    this.t = tMs;
    const dRaw = (v - this.x) / dt;
    const aD = OneEuro.alpha(this.dCutoff, dt);
    this.dx = aD * dRaw + (1 - aD) * this.dx;
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    const a = OneEuro.alpha(cutoff, dt);
    this.x = a * v + (1 - a) * this.x;
    return this.x;
  }
}
