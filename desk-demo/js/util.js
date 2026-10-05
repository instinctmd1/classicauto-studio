// Formatting, DOM and icon helpers. Money is whole rupees; Indian grouping everywhere.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const reducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ------------------------------------------------------------------ icons
const P = {
  overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  today: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
  car: '<path d="M5 17H3v-5l2-5.5A2 2 0 0 1 6.9 5h10.2a2 2 0 0 1 1.9 1.5L21 12v5h-2"/><path d="M3 12h18"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M9.5 17h5"/>',
  docs: '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5M9 14l2 2 4-4"/>',
  sales: '<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3c6.7 0 6.7-10 0-10"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M16 13h2"/>',
  reports: '<path d="M3 3v18h18"/><path d="M8 17V9M13 17V5M18 17v-6"/>',
  leads: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 8h8M8 12h5"/>',
  team: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1.2 1.2C7.8 18.5 7 20 7 22M14 14.7V17c0 .6.5 1 1.2 1.2 1 .3 1.8 1.8 1.8 3.8M18 2H6v7a6 6 0 0 0 12 0z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  sheets: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><path d="M12 9v4M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  refresh: '<path d="M21 12a9 9 0 0 0-15-6.7L3 8M3 3v5h5M3 12a9 9 0 0 0 15 6.7L21 16M16 16h5v5"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  up: '<path d="M7 10v12M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.5l-2.3 8a2 2 0 0 1-1.9 1.5H7V10l4.3-8a3.1 3.1 0 0 1 3.7 3.9z"/>',
  thumbdown: '<path d="M17 14V2M9 18.1 10 14H4.2a2 2 0 0 1-1.9-2.5l2.3-8A2 2 0 0 1 6.5 2H17v12l-4.3 8a3.1 3.1 0 0 1-3.7-3.9z"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M16 7l3 3M14 9l2 2"/>',
  trend: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.2"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>',
  bank: '<path d="M3 21h18M5 21V10M9.7 21V10M14.3 21V10M19 21V10M12 3 3 8h18z"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M9 7h7"/>',
  scale: '<path d="M12 3v18M5 21h14M3 8h18M6 8l-3 7a4 4 0 0 0 6 0zM18 8l-3 7a4 4 0 0 0 6 0z"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  eyeoff: '<path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-6.4 0-10-7-10-7a18.5 18.5 0 0 1 5.1-5.9M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
  shieldcheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h.01M17 21h4v-4"/>',
  lockopen: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L8 14.2 3 9.3l6.9-1z"/>',
  play: '<path d="M6 4v16l14-8z"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  people: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  minus: '<path d="M5 12h14"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-5.2A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z"/><path d="M8 10h8M8 14h5"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 2l.6 1.4L7 4l-1.4.6L5 6l-.6-1.4L3 4l1.4-.6z"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  clip: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
  addsq: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/>',
  wa: '<path d="M3 21l1.6-4.7A8.6 8.6 0 1 1 7.9 19.5z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1.2-1.6-2-1-1 .8a4.5 4.5 0 0 1-2.4-2.4l.8-1-1-2z"/>',
  grip: '<circle cx="9" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
};

export function icon(name, cls = "ico") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || P.info}</svg>`;
}

// ------------------------------------------------------------------ numbers and dates
const NF = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const NF2 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const isNum = (n) => typeof n === "number" && Number.isFinite(n);

export const num = (n) => (isNum(n) ? NF.format(n) : "—");
export const num1 = (n) => (isNum(n) ? NF1.format(n) : "—");
export const inr = (n) => (isNum(n) ? (n < 0 ? "−₹" : "₹") + NF.format(Math.abs(n)) : "—");
export const pct = (n, d = 1) => (isNum(n) ? (d === 0 ? NF.format(n) : NF1.format(n)) + "%" : "—");

/** Compact Indian money split into parts so the UI can set the symbol and unit small: {sym, n, unit, dec}. */
export function lakhParts(v) {
  if (!isNum(v)) return { sym: "", n: null, unit: "", dec: 0, neg: false };
  const a = Math.abs(v), neg = v < 0;
  if (a >= 1e7) return { sym: "₹", n: a / 1e7, unit: "Cr", dec: 2, neg };
  if (a >= 1e5) return { sym: "₹", n: a / 1e5, unit: "L", dec: 1, neg };
  return { sym: "₹", n: a, unit: "", dec: 0, neg };
}
export function lakh(v) {
  const p = lakhParts(v);
  if (p.n === null) return "—";
  const body = p.dec ? p.n.toFixed(p.dec).replace(/\.0+$/, "") : NF.format(p.n);
  return `${p.neg ? "−" : ""}₹${body}${p.unit ? " " + p.unit : ""}`;
}

/** lakh() as markup with the unit in the body font, for the headline faces (Bebas has capitals only and would print CR). */
export function lakhHtml(v) {
  const p = lakhParts(v);
  if (p.n === null) return "—";
  const body = p.dec ? p.n.toFixed(p.dec).replace(/\.0+$/, "") : NF.format(p.n);
  return `${p.neg ? "−" : ""}₹${body}${p.unit ? `<span class="unit">${p.unit}</span>` : ""}`;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthName = (m) => MON[m - 1];
export function monthLabel(ym, long = true) {
  if (!ym || ym.length < 7) return "—";
  return `${MON[+ym.slice(5, 7) - 1]}${long ? " " + ym.slice(0, 4) : ""}`;
}
export function dateFmt(s, withYear = true) {
  if (!s) return "—";
  const d = String(s).slice(0, 10);
  const [y, m, dd] = d.split("-").map(Number);
  if (!y) return "—";
  return `${dd} ${MON[m - 1]}${withYear ? " " + y : ""}`;
}
export function dateTimeFmt(s) {
  if (!s) return "—";
  return `${dateFmt(s, false)}, ${String(s).slice(11, 16)}`;
}
// Trade acronyms keep their casing whatever the helper does to the rest of the words.
const ACRONYMS = { pan: "PAN", rc: "RC", upi: "UPI", nbfc: "NBFC", rto: "RTO", gst: "GST", tcs: "TCS", emi: "EMI", od: "OD", dsa: "DSA", kyc: "KYC", puc: "PUC", whatsapp: "WhatsApp", cc: "CC", neft: "NEFT", rtgs: "RTGS", imps: "IMPS", dd: "DD", cng: "CNG", lpg: "LPG", ev: "EV", suv: "SUV", mpv: "MPV" };
const acronyms = (t) => t.replace(/\b[A-Za-z]+\b/g, (w) => ACRONYMS[w.toLowerCase()] || w);
export const title = (s) => acronyms(String(s ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
export const sentence = (s) => { const t = String(s ?? "").replace(/_/g, " "); return acronyms(t.charAt(0).toUpperCase() + t.slice(1)); };

/** A stored code as the rest of the app words it: park_n_sell becomes Park-N-Sell, cng becomes CNG, delivered becomes Delivered. */
export const enumLabel = (v) => (v === "park_n_sell" ? "Park-N-Sell" : v === "neft_rtgs" ? "NEFT or RTGS" : sentence(v));

export function addMonths(ym, k) {
  let y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + k;
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}
export function monthsBetween(a, b) { const out = []; for (let m = a; m <= b; m = addMonths(m, 1)) out.push(m); return out; }
export function daysUntil(dateStr, todayStr) {
  if (!dateStr) return null;
  return Math.round((Date.parse(dateStr.slice(0, 10)) - Date.parse(todayStr.slice(0, 10))) / 864e5);
}
export function minutes(m) {
  if (!isNum(m)) return "—";
  if (m < 60) return `${NF1.format(m).replace(".0", "")} min`;
  return `${NF1.format(m / 60).replace(".0", "")} h`;
}
/** A wait as people say it: "35 min", "10 h 17 m", "152 days". short drops the minutes once past an hour ("10 h"). */
export function duration(mins, { short = false } = {}) {
  if (!isNum(mins)) return "—";
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m} min`;
  if (m < 1440) { const h = Math.floor(m / 60), r = m % 60; return short || !r ? `${h} h` : `${h} h ${r} m`; }
  const d = Math.floor(m / 1440);
  return `${d} ${d === 1 ? "day" : "days"}`;
}
export const initials = (name) => String(name || "?").replace(/\(.*?\)/g, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

// ------------------------------------------------------------------ DOM
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Apply dynamic values (CSP forbids style attributes): data-w, data-c, data-i, data-deg, data-off, data-len. */
export function applyDyn(root) {
  const map = { w: "--w", c: "--c", i: "--i", deg: "--deg", off: "--off", len: "--len", g: "--g" };
  const nodes = root.querySelectorAll("[data-w],[data-c],[data-i],[data-deg],[data-off],[data-len],[data-g]");
  const late = [];
  nodes.forEach((n) => {
    for (const k in map) {
      const v = n.dataset[k];
      if (v === undefined) continue;
      if (k === "w") late.push([n, v]);
      else n.style.setProperty(map[k], k === "w" ? v + "%" : k === "deg" ? v + "deg" : v);
    }
  });
  if (late.length) {
    if (reducedMotion()) late.forEach(([n, v]) => n.style.setProperty("--w", v + "%"));
    else requestAnimationFrame(() => requestAnimationFrame(() => late.forEach(([n, v]) => n.style.setProperty("--w", v + "%"))));
  }
}

export function mount(node, html) {
  node.innerHTML = html;
  applyDyn(node);
  stagger(node);
  runCounts(node);
  return node;
}

export function stagger(root) {
  root.querySelectorAll(".rise").forEach((n, i) => { if (!n.style.getPropertyValue("--i")) n.style.setProperty("--i", String(Math.min(i, 14))); });
}

// ------------------------------------------------------------------ count-up
function fmtCount(v, dec, group) {
  if (group) return (dec ? (dec === 1 ? NF1 : NF2) : NF).format(v);
  return v.toFixed(dec);
}
// A tile counts up once per session. Coming back to a page, or a refresh after saving, shows the real figure at once:
// a number that restarts from zero looks wrong for a second and a screenshot can catch it half way.
const counted = new Set();
export function runCounts(root) {
  root.querySelectorAll("[data-count]").forEach((n) => {
    const to = parseFloat(n.dataset.count);
    const dec = parseInt(n.dataset.dec || "0", 10);
    const group = n.dataset.group !== "0";
    if (!Number.isFinite(to)) return;
    const key = `${location.hash.split("?")[0]}|${n.closest(".kpi, .day-tile, .bal-tile")?.querySelector(".kpi-label, .l")?.textContent || ""}|${n.closest(".kpi, .day-tile, .bal-tile") ? [...n.closest(".kpi, .day-tile, .bal-tile").querySelectorAll("[data-count]")].indexOf(n) : 0}`;
    if (reducedMotion() || counted.has(key)) { n.textContent = fmtCount(to, dec, group); return; }
    counted.add(key);
    const t0 = performance.now(), dur = 400;
    n.textContent = fmtCount(0, dec, group);
    const tick = (t) => {
      if (!n.isConnected) return;
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      n.textContent = fmtCount(to * e, dec, group);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Big number markup: money compact (₹ small, unit small), counts, percents. kind: money | int | dec1 | pct | days */
export function bigNumber(value, kind = "int", unit = "") {
  if (!isNum(value)) return `<span class="num">—</span>`;
  if (kind === "money") {
    const p = lakhParts(value);
    const dec = p.dec;
    return `${p.neg ? "−" : ""}<span class="cur">₹</span><span class="num" data-count="${p.n}" data-dec="${dec}" data-group="${p.unit ? 0 : 1}">${p.unit ? p.n.toFixed(dec) : NF.format(p.n)}</span>${p.unit ? `<span class="unit">${p.unit}</span>` : ""}`;
  }
  if (kind === "pct") return `<span class="num" data-count="${value}" data-dec="1">${value.toFixed(1)}</span><span class="unit">%</span>`;
  if (kind === "dec1") return `<span class="num" data-count="${value}" data-dec="1">${value.toFixed(1)}</span>${unit ? `<span class="unit">${unit}</span>` : ""}`;
  if (kind === "days") return `<span class="num" data-count="${value}" data-dec="0">${NF.format(value)}</span><span class="unit">days</span>`;
  return `<span class="num" data-count="${value}" data-dec="0">${NF.format(value)}</span>${unit ? `<span class="unit">${unit}</span>` : ""}`;
}

// ------------------------------------------------------------------ small components
export function deltaChip(delta, { invert = false, unit = "%", digits = 1 } = {}) {
  if (!isNum(delta)) return `<span class="delta flat">—</span>`;
  const rounded = Math.abs(delta) < 0.05 ? 0 : delta;
  const good = invert ? rounded < 0 : rounded > 0;
  const cls = rounded === 0 ? "flat" : good ? "up" : "down";
  const tri = rounded === 0 ? "" : `<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="${rounded > 0 ? "M6 1 11 10H1z" : "M6 11 1 2h10z"}"/></svg>`;
  const txt = `${Math.abs(rounded).toFixed(digits)}${unit}`;
  return `<span class="delta ${cls}" title="${rounded > 0 ? "Up" : rounded < 0 ? "Down" : "No change"} ${txt}">${tri}<span class="sr">${rounded > 0 ? "Up " : rounded < 0 ? "Down " : "No change "}</span>${txt}</span>`;
}

export function sparkline(values, { color = "var(--navy-bright)" } = {}) {
  const v = (values || []).filter(isNum);
  if (v.length < 2 || v.every((x) => x === 0)) return "";
  const w = 120, h = 44, pad = 4;
  const min = Math.min(...v), max = Math.max(...v), rng = max - min || 1;
  const pts = v.map((y, i) => [(i / (v.length - 1)) * w, h - pad - ((y - min) / rng) * (h - pad * 2)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return `<svg class="spark" data-c="${color}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="${d} L${w} ${h} L0 ${h}Z"/><path class="line" pathLength="1" vector-effect="non-scaling-stroke" d="${d}"/></svg>`;
}

export function badge(text, kind = "") { return `<span class="badge ${kind}">${esc(text)}</span>`; }
export function statusBadge(status) {
  const k = { available: "pos", booked: "info", delivered: "pos", incoming: "", refurb: "warn", withdrawn: "", returned_to_owner: "", written_off: "neg",
    cancelled: "neg", new: "info", claimed: "info", contacted: "info", sold: "pos", lost: "neg", escalated: "warn", spam: "", active: "info", closed: "",
    blocked: "neg", paid: "pos", pending: "warn" }[status] || "";
  return badge(sentence(status), k);
}
export function empty(iconName, head, text = "", action = "") {
  return `<div class="empty">${icon(iconName, "")}<b>${esc(head)}</b>${text ? `<p>${esc(text)}</p>` : ""}${action}</div>`;
}
export const agingColor = (bucket) => ({ "0-30": "var(--pos)", "31-60": "var(--c-lux)", "61-90": "var(--warn)", "90+": "var(--neg)" }[bucket] || "var(--muted)");
export const agingBucketOf = (days) => (days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+");

/** The app clock. Live it is the real time; the static demo shifts it to the moment its data was recorded, so
 *  "due today", "3 min ago" and the greeting read as they did then, and time moves on normally from there. */
let clockShift = 0;
export const setClockShift = (ms) => { clockShift = ms || 0; };
export const nowMs = () => Date.now() + clockShift;
/** IST wall clock as "YYYY-MM-DD HH:MM:SS". */
export const nowIstStr = () => new Date(nowMs() + 5.5 * 36e5).toISOString().slice(0, 19).replace("T", " ");

export function debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export function safeStore(key, val) {
  try { if (val === undefined) return localStorage.getItem(key); if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch { /* storage blocked */ }
  return null;
}
export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}


/** "3 min ago", "2 h ago", "4 d ago" from an engine/server timestamp (IST wall clock, "YYYY-MM-DD HH:MM:SS"). */
export function ago(ts) {
  if (!ts) return "never";
  const t = Date.parse(String(ts).replace(" ", "T").slice(0, 19) + "+05:30");
  if (!Number.isFinite(t)) return "never";
  const m = Math.max(0, Math.round((nowMs() - t) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}
export function minutesSince(ts) {
  if (!ts) return Infinity;
  const t = Date.parse(String(ts).replace(" ", "T").slice(0, 19) + "+05:30");
  return Number.isFinite(t) ? (nowMs() - t) / 60000 : Infinity;
}
/** Group digits of a secret in fours so it can be typed from the screen. */
export const groups4 = (s) => String(s || "").replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
export const plural = (n, one, many) => `${NF.format(n)} ${n === 1 ? one : many || one + "s"}`;
