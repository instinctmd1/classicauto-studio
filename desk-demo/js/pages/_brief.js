// Morning brief and data-health strip. The brief is one plain line built only from numbers the dashboard has;
// the health strip says which feeds are fresh, and the tiles that depend on a stale feed grey out.
import { get } from "../api.js";
import { state } from "../state.js";
import { ago, dateFmt, esc, icon, minutesSince, nowIstStr, num, title } from "../util.js";

export function firstName() {
  const n = (state.user?.display_name || "").replace(/\s*\(.*\)$/, "").replace(/^Demo\s+/i, "").trim();
  return n.split(" ")[0] || "there";
}
export function greeting() {
  const h = +nowIstStr().slice(11, 13);
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
const addDay = (d, k) => new Date(Date.parse(d) + k * 864e5).toISOString().slice(0, 10);

/** Yesterday's figures as a sentence. Every number comes from kpis for that one day. */
export async function yesterdayLine(aging) {
  const y = addDay(state.today, -1);
  let k;
  try { k = (await get("kpis", { from: y, to: y })).kpis; } catch { return { text: "", yesterday: y }; }
  const ch = Object.entries(k.inquiries?.by_channel || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${n} ${title(c)}`).join(", ");
  const inq = k.inquiries?.value ?? 0, sold = k.cars_sold?.value ?? 0;
  const bits = [`<b>${num(inq)} ${inq === 1 ? "enquiry" : "enquiries"}</b>${ch ? ` (${esc(ch)})` : ""}`, `<b>${num(sold)} ${sold === 1 ? "car" : "cars"} sold</b>`];
  const aged = aging?.buckets ? aging.buckets.filter((b) => b.bucket === "61-90" || b.bucket === "90+").reduce((s, b) => s + b.count, 0) : null;
  if (aged != null) bits.push(`<b>${num(aged)} cars</b> past ${aging.aged_threshold_days || 60} days`);
  return { text: `Yesterday, ${dateFmt(y, false)}: ${bits.join(", ")}.`, yesterday: y, inq, sold };
}

/** Freshness of the three feeds. Missing capability means that feed is simply not shown. */
export async function loadHealth(analytics) {
  const h = { engine: null, instagram: null, web: null };
  const e = analytics?.engine;
  if (e) h.engine = { ts: e.last_sync, error: e.error, ok: e.available };
  const [mk, mt] = await Promise.allSettled([get("marketing/summary"), get("metrics")]);
  if (mk.status === "fulfilled") h.instagram = { asOf: mk.value.instagram?.as_of };
  if (mt.status === "fulfilled") {
    const w = mt.value.series?.web_visits; const last = w?.length ? w[w.length - 1][0] : null;
    h.web = { asOf: last };
  }
  return h;
}

export function isStale(h) {
  return {
    engine: !h.engine || !h.engine.ok || !!h.engine.error || minutesSince(h.engine.ts) > 15,
    instagram: h.instagram ? !h.instagram.asOf || (Date.parse(state.today) - Date.parse(h.instagram.asOf)) / 864e5 > 3 : false,
    web: h.web ? !h.web.asOf || (Date.parse(state.today) - Date.parse(h.web.asOf)) / 864e5 > 3 : false,
  };
}

export function healthHtml(h) {
  const s = isStale(h);
  const chip = (label, stale, text) => `<span class="h${stale ? " stale" : ""}"><span class="dot ${stale ? "warn" : "live"}"></span><span><span class="lab">${label}</span> ${esc(text)}</span></span>`;
  const out = [];
  if (h.engine) out.push(chip("Lead engine", s.engine, s.engine ? (h.engine.error ? "error, showing the last copy" : `stale since ${h.engine.ts ? h.engine.ts.slice(11, 16) : "—"}`) : `synced ${ago(h.engine.ts)}`));
  if (h.instagram) out.push(chip("Instagram", s.instagram, h.instagram.asOf ? (s.instagram ? `stale since ${dateFmt(h.instagram.asOf, false)}` : `as of ${dateFmt(h.instagram.asOf, false)}`) : "no figures yet"));
  if (h.web) out.push(chip("Website", s.web, h.web.asOf ? (s.web ? `stale since ${dateFmt(h.web.asOf, false)}` : `as of ${dateFmt(h.web.asOf, false)}`) : "no figures yet"));
  return out.length ? `<div class="health" role="status" aria-label="Data freshness">${icon("shieldcheck", "").replace('class=""', 'class="ico-s"')}${out.join("")}</div>` : "";
}
