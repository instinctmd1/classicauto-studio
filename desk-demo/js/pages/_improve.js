// "What to improve" for people without money access. The server's insights endpoint carries rupee figures, so it is
// closed to them; these rules use only operational numbers and always say what to do next.
import { esc, num, pct } from "../util.js";
import { bandShort } from "../state.js";

/** K: kpis.kpis, aging: cars/aging, analytics: leads/analytics. Any may be missing. Returns [{severity,title,detail,link}]. */
export function improvements({ K = {}, aging, analytics, openFeedback }) {
  const out = [];
  const aged = K.aged_stock_pct;
  if (aged && aged.value > 15) {
    const oldest = (aging?.oldest || []).slice(0, 3).map((o) => `${o.stock_no} ${o.label} (${o.days} d)`).join(", ");
    out.push({ severity: "amber", title: `${num(aged.aged_count)} cars have sat for over ${aging?.aged_threshold_days || 60} days`, detail: `${oldest ? "Oldest: " + oldest + ". " : ""}Talk to the owner about a price cut, or move them to the front of the showroom this week.`, link: "#/inventory?aged_gt=60" });
  }
  const resp = analytics?.responses, tot = analytics?.totals;
  if (tot && (tot.no_response > 0 || (tot.median_claim_minutes ?? 0) > 10)) {
    const worst = (resp?.by_salesman || []).filter((s) => s.no_responses > 0).sort((a, b) => b.no_responses - a.no_responses)[0];
    out.push({ severity: tot.no_response > 10 ? "red" : "amber", title: `${num(tot.no_response)} leads got no response`, detail: `${worst ? `${worst.salesman.replace(/\s*\(demo\)/, "")} has the most (${worst.no_responses}). ` : ""}Median claim time is ${tot.median_claim_minutes ?? "—"} min against a 10 minute target. Talk to the slowest two before the next shift.`, link: "#/team" });
  }
  if (analytics?.by_tier?.length && K.aged_stock_pct?.by?.band) {
    const stockBand = K.aged_stock_pct.by.band, stockTotal = Object.values(stockBand).reduce((s, v) => s + v, 0) || 1;
    const inqTotal = analytics.by_tier.reduce((s, t) => s + t.n, 0) || 1;
    let best = null;
    for (const t of analytics.by_tier) {
      const gap = (t.n / inqTotal) * 100 - ((stockBand[t.band] || 0) / stockTotal) * 100;
      if (!best || Math.abs(gap) > Math.abs(best.gap)) best = { t, gap };
    }
    if (best && Math.abs(best.gap) > 10 && best.t.band !== "unknown") out.push({ severity: "info", title: `${bandShort(best.t.band)} cars are ${best.gap > 0 ? "under-stocked" : "over-stocked"}`, detail: `${bandShort(best.t.band)} is ${pct((best.t.n / inqTotal) * 100, 0)} of inquiries but ${pct(((stockBand[best.t.band] || 0) / stockTotal) * 100, 0)} of stock. ${best.gap > 0 ? "Look for more of these at the next auction." : "Hold off buying more of these."}`, link: "#/leads" });
  }
  const rto = K.rto_transfer_tat_days;
  if (rto && rto.overdue > 0) out.push({ severity: "amber", title: `${num(rto.overdue)} RTO transfers are past 30 days`, detail: "Call the agent for each one today. The buyer's RC is overdue.", link: "#/rto" });
  if (K.attach_finance_pct && K.attach_finance_pct.value != null && K.attach_finance_pct.value < 30) out.push({ severity: "info", title: `Only ${pct(K.attach_finance_pct.value, 0)} of buyers financed through us`, detail: "Offer finance at the token stage, not at delivery.", link: "#/fi" });
  if (openFeedback > 0) out.push({ severity: "amber", title: `${num(openFeedback)} bad-feedback items are unresolved`, detail: "Call each customer back and note what you did.", link: "#/feedback" });
  const rank = { red: 0, amber: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function improveHtml(list, max = 5) {
  if (!list.length) return `<div class="empty"><b>Nothing to fix right now</b><p>The rules found nothing to flag in this period.</p></div>`;
  const col = { red: "var(--neg)", amber: "var(--warn)", info: "var(--info)" };
  return `<div class="insights">${list.slice(0, max).map((i) => `<a class="insight ${esc(i.severity)}" href="${esc(i.link)}"><span class="body"><b>${esc(i.title)}</b><p>${esc(i.detail)}</p></span><span></span></a>`).join("")}</div>`;
}
