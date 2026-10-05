// Shared app state and period helpers.
import { addMonths, monthLabel, safeStore } from "./util.js";

export const state = {
  user: null, caps: new Set(), locked: [], mfa: {}, perms: [], idleMinutes: 120,
  settings: { band_labels: {}, segment_bands: {}, ig_follower_goal: 50000 },
  today: new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10),   // IST date
  period: null, months: null,   // months: demo only, the list the bundle covers
  prevHash: "",                 // the screen before this one (the lead page's "Inbox" link goes back to it)
};

/** True when the signed-in user holds ANY of the capabilities (the API refuses everything else). */
export const can = (...caps) => caps.some((c) => state.caps.has(c));
export const canAll = (...caps) => caps.every((c) => state.caps.has(c));
/** Held but switched off until the session passes two-factor. */
export const isLocked = (...caps) => caps.some((c) => state.locked.includes(c));
export const isSuper = () => !!state.user?.is_super_admin;
export const hasMoney = () => state.caps.has("money.view");
/** Which home the person lands on. Salesmen see only their own work; managers get the command centre. */
export const homeKind = () => (state.user?.role === "accountant" ? "accountant" : !can("records.all") ? "salesman" : state.user?.role === "manager" ? "manager" : "owner");
export const currentMonth = () => state.today.slice(0, 7);
export const bandLabel = (b) => state.settings.band_labels?.[b] || { low: "Budget (under 20 L)", middle: "Mid (20-50 L)", luxury: "Luxury (50 L+)", unknown: "Unknown" }[b] || b;
export const bandShort = (b) => ({ low: "Budget", middle: "Mid", luxury: "Luxury", unknown: "Unknown" }[b] || b);
export const bandColor = (b) => ({ low: "var(--c-low)", middle: "var(--c-mid)", luxury: "var(--c-lux)", unknown: "var(--faint)" }[b] || "var(--muted)");

export function initPeriod(defaultPeriod) {
  const saved = safeStore("ca.period");
  const ok = (p) => p === "quarter" || p === "fy" || (/^\d{4}-\d{2}$/.test(p || "") && (!state.months || state.months.includes(p)) && p <= currentMonth());
  state.period = ok(saved) ? saved : defaultPeriod || defaultMonth();
}
/** In the first week of a month the figures are thin, so open on the month that just closed. */
export function defaultMonth() { return +state.today.slice(8, 10) <= 5 ? addMonths(currentMonth(), -1) : currentMonth(); }
export function setPeriod(p) { state.period = p; safeStore("ca.period", p); }

export function periodLabel(p = state.period) {
  if (p === "quarter") return "Quarter to date";
  if (p === "fy") { const y = +currentMonth().slice(0, 4), m = +currentMonth().slice(5, 7); const s = m >= 4 ? y : y - 1; return `FY ${s}-${String(s + 1).slice(2)}`; }
  return monthLabel(p);
}
export function periodMonthList() {
  if (state.months) return state.months.slice();
  const out = []; let m = currentMonth();
  for (let i = 0; i < 24; i++) { out.push(m); m = addMonths(m, -1); }
  return out.reverse();
}
export function stepPeriod(dir) {
  const list = periodMonthList();
  const base = /^\d{4}-\d{2}$/.test(state.period) ? state.period : currentMonth();
  const next = addMonths(base, dir);
  return list.includes(next) ? next : null;
}
/** The month that ends the 12-month charts for the selected period. */
export function endMonth(p = state.period) { return /^\d{4}-\d{2}$/.test(p) ? p : currentMonth(); }
export function pnlWindow(p = state.period) { const to = endMonth(p); return { from: addMonths(to, -11), to }; }
export function compareLabel(c) {
  if (!c?.from) return "previous period";
  if (c.from.slice(0, 7) === c.to.slice(0, 7)) return monthLabel(c.from, false);
  return `${monthLabel(c.from, false)}–${monthLabel(c.to, false)}`;
}
export const isMonthPeriod = (p = state.period) => /^\d{4}-\d{2}$/.test(p);
export const chan = (c) => ({ olx: "OLX", cardekho: "CarDekho", carwale: "CarWale", whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", website: "Website", call: "Phone call", visit: "Walk-in", email: "Email" }[c] || (c ? c.charAt(0).toUpperCase() + c.slice(1) : "—"));
