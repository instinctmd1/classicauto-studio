// Pieces shared by several pages: KPI tiles, card shell, funnel, alert groups, link mapping.
import { get } from "../api.js";
import { can } from "../state.js";
import { bigNumber, dateFmt, deltaChip, esc, icon, inr, num, pct, sparkline, sentence } from "../util.js";

/** Bank accounts for the "Paid from / landed in" pickers (people who can book money to an account only). Cash never goes to an account. */
export async function bankPick() {
  if (!can("accounts.manage")) return null;
  try { const r = await get("accounts/bank-options"); return r.data.length ? r : null; } catch { return null; }
}
export const bankField = (b, name, label = "Bank account", hint = "Where the money landed. Leave empty for cash.") => (b ? { name, label, type: "select", allowEmpty: true, value: b.main_id || "", options: b.data.map((a) => [a.id, a.label]), hint } : null);

/** Park-N-Sell commission terms in words. A flat fee or over-reserve amount is the firm's revenue, so a viewer without money access gets the type only. */
export function commissionText(k, long = false) {
  if (k.commission_type === "percent") return long ? `${(k.commission_value * 100).toFixed(2)}% of the sale price` : pct(k.commission_value * 100);
  if (k.commission_type === "over_reserve") return "Everything above the reserve";
  return k.commission_value != null ? inr(k.commission_value) : "Flat fee";
}

export function kpiTile({ label, value, kind = "int", unit = "", delta, deltaUnit = "%", invert = false, sub = "", spark, sparkColor, big = false, neg = false, digits = 1 }) {
  const d = delta === undefined ? "" : deltaChip(delta, { invert, unit: deltaUnit, digits });
  return `<article class="kpi rise${big ? " big" : ""}"><div class="kpi-top"><span class="kpi-label">${esc(label).replace(/Park-N-Sell/g, "Park‑N‑Sell")}</span>${d}</div><div class="kpi-val${neg ? " neg-val" : ""}">${bigNumber(value, kind, unit)}</div><div class="kpi-sub">${sub}</div>${spark ? sparkline(spark, { color: sparkColor }) : ""}</article>`;
}

export function card({ title, sub = "", actions = "", body = "", cls = "", flush = false, id = "" }) {
  return `<section class="card rise ${flush ? "flush " : ""}${cls}"${id ? ` id="${id}"` : ""}><div class="card-h"><div><h2>${esc(title)}</h2>${sub ? `<div class="card-sub">${sub}</div>` : ""}</div>${actions ? `<div class="act">${actions}</div>` : ""}</div>${body}</section>`;
}

export const delta = (cur, prev) => (typeof cur === "number" && typeof prev === "number" && prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null);
export const pts = (cur, prev) => (typeof cur === "number" && typeof prev === "number" ? cur - prev : null);

// ------------------------------------------------------------------ funnel
const FN = { inquiries: "Inquiries", claimed: "Claimed", contacted: "Contacted", visit: "Visit or test drive", booked: "Booked", delivered: "Delivered" };
export function funnelHtml(stages) {
  if (!stages?.length || !stages[0].n) return `<div class="empty">${icon("inbox", "")}<b>No inquiries in this period</b><p>When leads arrive from the engine they are counted here.</p></div>`;
  const top = stages[0].n;
  const colors = ["var(--navy-bright)"];                                 // one hue: the bar length and the drop-off figure carry the meaning
  return `<div class="funnel" role="list">${stages.map((s, i) => {
    const prev = i ? stages[i - 1].n : null;
    const drop = prev ? Math.round(((prev - s.n) / prev) * 100) : null;
    return `<div class="fn-row" role="listitem"><span class="lab">${esc(FN[s.key] || sentence(s.key))}</span><div class="bar"><i data-w="${Math.max(2, (s.n / top) * 100)}" data-c="${colors[i % colors.length]}"></i></div><span class="v">${num(s.n)}<small>${i ? (drop > 0 ? `−${drop}%` : "no drop") : "100%"}</small></span></div>`;
  }).join("")}</div>`;
}

// ------------------------------------------------------------------ alerts
const ALERT_KINDS = {
  cash_limit: ["Cash over the ₹2 L limit", "alert"], tcs_missing: ["TCS missing on a sale", "alert"], pan_missing: ["Buyer PAN or Form 60 missing", "alert"],
  company_doc_expiry: ["Dealer papers expiring", "file"], unclaimed_lead: ["Unclaimed leads", "leads"], insurance_expiry: ["Insurance expiring", "shield"],
  puc_expiry: ["PUC expiring", "clock"], form29c_missing: ["Form 29C not filed", "file"], hypothecated: ["Still hypothecated", "lock"],
  consignment_expiry: ["Park-N-Sell agreements ending", "file"], aged_stock: ["Aged stock", "car"], rto_overdue: ["RTO transfers overdue", "docs"],
  followup_overdue: ["Overdue follow-ups", "clock"],
};
export function alertLink(a) {
  const e = a.entity || {};
  if (e.type === "car") return `#/inventory?car=${e.id}`;
  if (e.type === "deal") return `#/deals?deal=${e.id}`;
  if (e.type === "rto_case") return `#/rto?case=${e.id}`;
  if (e.type === "consignment") return `#/inventory?seg=park_n_sell`;
  if (e.type === "lead") return `#/leads`;
  if (e.type === "followup") return `#/team`;
  return `#/rto`;
}
export function insightLink(link = "") {
  const [path, qs] = link.split("?");
  const q = qs ? "?" + qs : "";
  if (path.startsWith("/deals/")) return `#/deals?deal=${path.split("/")[2]}`;
  const map = { "/stock": "inventory", "/leads": "leads", "/rto": "rto", "/marketing": "marketing", "/fi": "fi", "/customers": "customers", "/money": "money" };
  const page = map[path] || "overview";
  return `#/${page}${page === "inventory" || page === "leads" ? q : ""}`;
}

/** One line telling a person why some figures are missing from the page, so "no money here" is not mistaken for "not loaded". */
export function roleNote(text = "Profit and purchase costs are hidden for your role.") {
  return `<p class="role-note">${icon("lock", "")}<span>${esc(text)}</span></p>`;
}

export function alertsHtml(alerts) {
  if (!alerts?.length) return `<div class="empty">${icon("check", "")}<b>Nothing needs attention</b><p>Expiring papers, aged stock and unclaimed leads show up here.</p></div>`;
  const groups = new Map();
  for (const a of alerts) { if (!groups.has(a.kind)) groups.set(a.kind, []); groups.get(a.kind).push(a); }
  const rank = { red: 0, amber: 1, info: 2 };
  const list = [...groups.entries()].map(([kind, items]) => ({ kind, items, sev: items.reduce((m, x) => Math.min(m, rank[x.severity] ?? 2), 2) }))
    .sort((a, b) => a.sev - b.sev || b.items.length - a.items.length);
  const sevName = ["red", "amber", "info"];
  return `<div class="alert-groups">${list.map((g, gi) => {
    const [name, ic] = ALERT_KINDS[g.kind] || [sentence(g.kind), "alert"];
    const id = `ag${gi}`;
    return `<div class="agroup"><button type="button" aria-expanded="false" aria-controls="${id}"><span class="gicon ${sevName[g.sev] === "red" ? "" : sevName[g.sev]}">${icon(ic, "")}</span><span>${esc(name)}</span><span class="badge ${g.sev === 0 ? "neg" : g.sev === 1 ? "warn" : "info"}">${g.items.length}</span>${icon("right", "chev")}</button>
      <ul id="${id}" hidden>${g.items.slice(0, 40).map((a) => `<li><a href="${alertLink(a)}">${esc(a.message)}<span class="due">${a.due ? esc(dateFmt(a.due, false)) : ""}</span></a></li>`).join("")}</ul></div>`;
  }).join("")}</div>`;
}
export function bindAlertGroups(root) {
  root.querySelectorAll(".agroup > button").forEach((b) => b.addEventListener("click", () => {
    const open = b.getAttribute("aria-expanded") === "true";
    b.setAttribute("aria-expanded", String(!open));
    document.getElementById(b.getAttribute("aria-controls")).hidden = open;
  }));
}

const ACR = (t) => String(t).replace(/\bPan\b/g, "PAN").replace(/\bTcs\b/g, "TCS").replace(/\bRto\b/g, "RTO");
export function insightsHtml(list, max = 6) {
  if (!list?.length) return `<div class="empty">${icon("check", "")}<b>No suggestions this month</b><p>The rules found nothing to flag. Nice.</p></div>`;
  const rank = { red: 0, amber: 1, info: 2 };
  // identical compliance flags (one per deal) collapse into one line with a count
  const merged = [];
  const seen = new Map();
  for (const i of list) {
    if (i.rule === "compliance") {
      const key = i.title;
      if (seen.has(key)) { seen.get(key).count++; continue; }
      const c = { ...i, count: 1 }; seen.set(key, c); merged.push(c);
    } else merged.push({ ...i, count: 1 });
  }
  const sorted = merged.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3) || (b.impact_inr || 0) - (a.impact_inr || 0));
  return `<div class="insights">${sorted.slice(0, max).map((i) => `<a class="insight ${esc(i.severity)}" href="${insightLink(i.link)}"><span class="body"><b>${esc(ACR(i.title))}${i.count > 1 ? ` · ${i.count} sales` : ""}</b><p>${esc(i.detail)}${i.count > 1 ? " Open the first to fix, the rest follow." : ""}</p></span>${i.impact_inr ? `<span class="impact" title="The rupees this costs you, or could earn you, if it is fixed. It is an estimate, not a loss already booked.">${esc(shortInr(i.impact_inr))}<small>at stake</small></span>` : `<span></span>`}</a>`).join("")}</div>${sorted.length > max ? `<p class="note">${icon("info", "")}${sorted.length - max} more not shown.</p>` : ""}`;
}
function shortInr(v) {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${new Intl.NumberFormat("en-IN").format(v)}`;
}

export { pct };

// ------------------------------------------------------------------ the signature: a speedometer for the road to 50K
export function gaugeHtml({ value, goal = 50000, label = "followers" }) {
  const cx = 180, cy = 190, R = 140, a0 = -120, a1 = 120;
  const pol = (deg, r) => { const t = (deg * Math.PI) / 180; return [cx + r * Math.sin(t), cy - r * Math.cos(t)]; };
  const p = Math.max(0, Math.min(1, (value || 0) / goal));
  const [x0, y0] = pol(a0, R), [x1, y1] = pol(a1, R);
  const arc = `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  let ticks = "", labels = "";
  for (let i = 0; i <= 50; i++) {
    const deg = a0 + ((a1 - a0) * i) / 50, major = i % 10 === 0, mid = i % 5 === 0;
    const [ax, ay] = pol(deg, 124), [bx, by] = pol(deg, major ? 106 : mid ? 112 : 118);
    ticks += `<line class="g-tick${major ? " major" : ""}" x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}"/>`;
    if (major) { const [lx, ly] = pol(deg, 163); const v = (i / 50) * goal; labels += `<text class="g-lab" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}">${v === 0 ? "0" : v / 1000 + "K"}</text>`; }
  }
  return `<div class="gauge" role="img" aria-label="${num(value)} ${esc(label)}, ${pct(p * 100)} of the ${num(goal)} goal"><svg viewBox="0 0 360 285">
    <path class="g-track" d="${arc}"/><path class="g-prog" pathLength="100" d="${arc}" data-off="${(100 * (1 - p)).toFixed(2)}"/>
    ${ticks}${labels}
    <g class="g-needle" data-deg="${(a0 + (a1 - a0) * p).toFixed(2)}"><path d="M176.5 192 L180 72 L183.5 192 Z"/></g><circle class="g-hub" cx="${cx}" cy="${cy}" r="11"/>
    <text class="g-num" x="${cx}" y="252" data-count="${value || 0}" data-dec="0">${num(value)}</text><text class="g-cap" x="${cx}" y="274">${esc(label)}</text></svg></div>`;
}
export function activateGauges(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => root.querySelectorAll(".gauge").forEach((g) => g.classList.add("on"))));
}

// ------------------------------------------------------------------ follow-ups
const FU_PURPOSE = { lead: "Call back", post_test_drive: "After the test drive", payment: "Payment", documents: "Papers", post_delivery: "After delivery", insurance_renewal: "Insurance renewal", upgrade_offer: "Upgrade offer", other: "Follow-up" };
/** One follow-up as a title (what, who, which car), a sub line (how, masked phone) and a link to the lead or deal. */
export function followupInfo(f) {
  const what = FU_PURPOSE[f.purpose] || sentence(f.purpose || "follow-up");
  const who = String(f.lead_name || f.person_name || "").replace(/\s*\(demo\)/, "");
  const car = f.lead_car || (f.deal_make ? `${f.deal_make} ${f.deal_model}` : "");
  const title = who || car ? `${what} · ${[who, car].filter(Boolean).join(" · ")}` : `${what} by ${sentence(f.channel || "phone")}`;
  const bits = [who || car ? sentence(f.channel || "phone") : "", f.lead_phone || "", f.deal_stock || ""].filter(Boolean);
  const href = f.deal_id ? `#/deals?deal=${f.deal_id}` : f.lead_id ? "#/leads" : "";
  return { title, sub: bits.join(" · "), href };
}
