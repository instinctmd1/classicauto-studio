// Manager command centre: the floor, today. No rupee figure appears anywhere on this page; the API strips them anyway.
import { get } from "../api.js";
import { state, can, periodLabel, chan, bandShort } from "../state.js";
import { ago, dateFmt, duration, esc, icon, minutes, minutesSince, mount, nowIstStr, num, pct, sentence, title } from "../util.js";
import { catAxis, gridBox, legendBox, mountChart, tipHtml, tooltip, valAxis } from "../charts.js";
import { pageHead } from "../ui.js";
import { card, followupInfo } from "./_shared.js";
import { firstName, greeting, healthHtml, loadHealth } from "./_brief.js";
import { improveHtml, improvements } from "./_improve.js";
import { neverVisitedCompact } from "./_visits.js";

const settle = (p) => p.then((v) => v, () => null);
const short = (n) => String(n || "").replace(/\s*\(demo\)/, "");
const hhmm = (ts) => String(ts || "").slice(11, 16);

export async function render(ctx) {
  const p = ctx.period;
  const [today, lb, analytics, aging, K, fbRes, rto, appr, nv] = await Promise.all([
    settle(get("today")), can("team.view") ? settle(get("team/leaderboard", { period: p })) : null,
    can("leads.view") ? settle(get("leads/analytics", { period: p })) : null,
    settle(get("cars/aging")), settle(get("kpis", { period: p })),
    can("activity.use") ? settle(get("feedback")) : null, can("rto.view") ? settle(get("rto-cases")) : null,
    can("approvals.manage") ? settle(get("approvals")) : null,
    can("team.view") && can("records.all") ? settle(get("leads/never-visited", { days: 7 })) : null,
  ]);
  if (!ctx.alive()) return;
  const T = today || {};
  const kp = K?.kpis || {};
  const health = await loadHealth(analytics);
  if (!ctx.alive()) return;
  const slaMin = state.settings?.lead_sla_minutes || 10;

  const unclaimed = (T.new_leads || []).map((l) => ({ ...l, wait: Math.max(0, Math.round(minutesSince(l.first_seen_ts))) }));
  const breaching = unclaimed.filter((l) => l.status === "new" && l.wait > slaMin);
  const followups = T.followups || [];
  const overdueFu = followups.filter((f) => f.due_at.slice(0, 10) < state.today);
  const drives = (T.test_drives || []).filter((d) => !d.outcome);
  const deliveries = T.deliveries || [];
  const feedbackOpen = (fbRes?.data || []).filter((f) => f.sentiment === "bad" && !f.resolved_at).sort((a, b) => a.ts.localeCompare(b.ts));
  const openRto = (rto?.data || []).filter((c) => c.stage !== "closed");
  const rtoLate = openRto.filter((c) => c.overdue || (c.form29_30_days_left != null && c.form29_30_days_left <= 7)).sort((a, b) => (a.form29_30_days_left ?? 99) - (b.form29_30_days_left ?? 99));

  // --- day strip
  const tile = (n, label, sub, href, hot, ic) => `<a class="day-tile rise${hot ? " hot" : ""}" href="${href}">${icon(ic, "bg")}<span class="l">${esc(label)}</span><span class="n">${num(n)}</span><span class="s">${esc(sub)}</span></a>`;
  const strip = `<div class="day-strip">
    ${tile(drives.length, "Test drives today", drives.length ? `Next at ${hhmm(drives.slice().sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0].scheduled_at)}` : "None booked", "#/today", false, "car")}
    ${tile(deliveries.length, "Deliveries due", deliveries.length ? "Booked cars waiting to go out" : "Nothing waiting", "#/deals", false, "check")}
    ${tile(unclaimed.length, "Unclaimed leads", breaching.length ? `${breaching.length} past the ${slaMin} min target` : "All inside the target", "#/leads", breaching.length > 0, "leads")}
    ${tile(followups.length, "Follow-ups due", overdueFu.length ? `${overdueFu.length} overdue` : "On time", "#/today", overdueFu.length > 0, "clock")}</div>`;

  // --- the month so far (no rupee figures)
  const visit = analytics?.totals?.visit_rate;
  const monthStrip = `<div class="mini-h sec-gap">${esc(periodLabel(p))}</div><div class="bal-strip rise">
    <div class="bal-tile"><div class="l">Cars sold</div><div class="v">${num(kp.cars_sold?.value ?? 0)}</div><div class="s">${esc(kp.cars_sold?.prev != null ? `${num(kp.cars_sold.prev)} the month before` : "")}</div></div>
    <div class="bal-tile"><div class="l">Cars unsold, not booked</div><div class="v">${num(kp.aged_stock_pct?.stock_count ?? 0)}</div><div class="s">${num(kp.aged_stock_pct?.aged_all_count ?? 0)} past ${esc(String(aging?.aged_threshold_days || 60))} days</div></div>
    <div class="bal-tile"><div class="l">Inquiries</div><div class="v">${num(kp.inquiries?.value ?? 0)}</div><div class="s">${kp.response_rate?.value != null ? pct(kp.response_rate.value, 0) + " answered" : ""}</div></div>
    <div class="bal-tile"><div class="l">Test-drive rate</div><div class="v">${visit != null ? pct(visit, 0) : "—"}</div><div class="s">Inquiries that asked for a visit</div></div></div>`;

  // --- leads waiting
  const bySalesman = new Map();
  for (const r of lb?.data || []) if (r.role === "salesman" || r.assigned > 0) bySalesman.set(r.name, { name: r.name, assigned: r.assigned, missed: r.missed, median: r.median_claim_minutes, claimed: r.claimed, sold: r.sold, conv: r.conversion_pct, waiting: [] });
  for (const l of unclaimed) { const e = bySalesman.get(l.salesman) || bySalesman.set(l.salesman, { name: l.salesman, assigned: 0, missed: 0, waiting: [] }).get(l.salesman); e.waiting.push(l); }
  const people = [...bySalesman.values()].sort((a, b) => b.waiting.length - a.waiting.length || b.missed - a.missed);
  const waitingList = unclaimed.length
    ? `<ul class="list">${unclaimed.sort((a, b) => b.wait - a.wait).map((l) => `<li><span class="grow"><div class="t">${esc(l.name)} · ${esc(l.car || "No car named")}</div><div class="s">${esc(chan(l.channel))} · ${esc(short(l.salesman))} · arrived ${hhmm(l.first_seen_ts)}${l.band && l.band !== "unknown" ? " · " + esc(bandShort(l.band)) : ""}</div></span>${l.wait > slaMin ? `<span class="timer" title="Waiting past the ${slaMin} minute target">${duration(l.wait)}</span>` : `<span class="pill pos">${duration(l.wait)}</span>`}</li>`).join("")}</ul>`
    : `<div class="empty">${icon("check", "")}<b>No lead is waiting</b><p>Every lead that came in has been claimed.</p></div>`;
  const smRows = people.length ? `<div class="salesman-grid">${people.map((s) => `<div class="sm-row"><div class="nm"><span class="avatar sm">${esc(short(s.name).slice(0, 2).toUpperCase())}</span><span>${esc(short(s.name))}<small>${s.waiting.length ? `${s.waiting.length} waiting now` : "Nothing waiting"}</small></span></div>
      <div class="m${s.missed > 3 ? " bad" : ""}"><b>${num(s.missed)}</b><span>Missed</span></div><div class="m"><b>${s.median != null ? s.median : "—"}</b><span>Median min</span></div><div class="m${s.conv >= 10 ? " ok" : s.conv === 0 && s.assigned >= 5 ? " bad" : ""}"><b>${s.conv != null ? pct(s.conv, 0) : "—"}</b><span>Converted</span></div></div>`).join("")}</div>` : "";

  // --- today's schedule as a track with a NOW playhead (MD-11)
  const events = [...(T.test_drives || []).map((d) => ({ at: d.scheduled_at, c: "var(--info)", label: `Test drive · ${d.make} ${d.model}`, who: d.staff, done: !!d.outcome })),
    ...followups.filter((f) => f.due_at.slice(0, 10) === state.today).map((f) => ({ at: f.due_at, c: "var(--warn)", label: `Follow-up · ${sentence(f.purpose)}`, who: f.staff }))].sort((a, b) => a.at.localeCompare(b.at));
  const nowStr = nowIstStr();
  const items = [...(T.test_drives || []).map((d) => ({ at: d.scheduled_at, label: `Test drive · ${d.make} ${d.model}`, who: d.staff, done: !!d.outcome })),
    ...followups.map((f) => ({ at: f.due_at, ...followupInfo(f), label: followupInfo(f).title, who: f.staff, late: f.due_at.slice(0, 10) < state.today, fu: true }))]
    .sort((a, b) => a.at.localeCompare(b.at)).slice(0, 8);
  const nextAt = items.findIndex((e) => !e.done && !e.late && e.at >= nowStr);
  const scheduleList = items.length ? `<ul class="list agenda">${items.map((e, i) => `<li${i === nextAt ? ' class="is-next"' : ""}><span class="when mono">${e.late ? dateFmt(e.at, false) : hhmm(e.at)}</span><span class="grow"><div class="t">${e.href ? `<a href="${esc(e.href)}">${esc(e.label)}</a>` : esc(e.label)}</div><div class="s">${esc(e.sub || "")}${e.fu && e.who ? `${e.sub ? " · " : ""}<span class="pill">${esc(short(e.who))}</span>` : esc(short(e.who || ""))}${e.late ? ' · <span class="neg-text">Overdue</span>' : e.done ? " · done" : ""}</div></span></li>`).join("")}</ul>` : `<div class="empty">${icon("check", "")}<b>Nothing scheduled</b><p>Test drives and follow-ups with a time show here, in order.</p></div>`;

  // --- response chart rows
  const resp = analytics?.responses?.by_salesman || [];
  const stockCol = (t) => [t.pos, t.lux, t.warn, t.neg];
  const rtoList = rtoLate.length ? `<ul class="list">${rtoLate.slice(0, 6).map((c) => `<li><a class="grow" href="#/rto?case=${c.id}"><div class="t">${esc(c.car?.reg_no || "")} · ${esc(c.car?.make || "")} ${esc(c.car?.model || "")}</div><div class="s">${esc(sentence(c.stage))} · open ${num(c.days_open)} days</div></a><span class="clock ${c.overdue || c.form29_30_days_left < 0 ? "late" : "soon"}">${icon("clock", "")}${c.form29_30_days_left < 0 ? `${Math.abs(c.form29_30_days_left)} d late` : `${c.form29_30_days_left} d left`}</span></li>`).join("")}</ul>` : `<div class="empty">${icon("check", "")}<b>No RTO deadline is close</b><p>Cases that pass 30 days or have a Form 29/30 clock under a week show here.</p></div>`;
  const fbList = feedbackOpen.length ? `<div class="stack-form">${feedbackOpen.slice(0, 4).map((f) => { const age = Math.max(0, Math.floor(minutesSince(f.ts) / 1440)); return `<article class="fb-card bad"><div class="hd"><span class="pill neg">${icon("thumbdown", "")}Bad</span><span>${esc(short(f.staff_name || "Unassigned"))}</span><span>${age} d waiting</span></div><div class="tx">${esc(f.text || "No note")}</div></article>`; }).join("")}</div>` : `<div class="empty">${icon("check", "")}<b>No bad feedback is waiting</b></div>`;

  const next = improvements({ K: kp, aging, analytics, openFeedback: feedbackOpen.length });

  // --- requests waiting for the manager's OK, and leads claimed but never brought in
  const KIND = { price_change: "Price change", discount: "Discount", test_drive: "Test drive", hold: "Hold" };
  const waitingAppr = appr?.data || [];
  const apprList = waitingAppr.length ? `<ul class="list">${waitingAppr.slice(0, 5).map((a) => `<li><a class="grow" href="#/approvals"><div class="t">${esc(KIND[a.kind] || sentence(a.kind))} · ${esc(a.stock_no)} ${esc(a.make)} ${esc(a.model)}</div><div class="s">${esc(short(a.requested_by_name || ""))} · ${esc(ago(a.requested_at))}${a.until ? ` · for ${esc(dateFmt(a.until, false))}` : a.change_pct != null ? ` · ${esc(pct(Math.abs(a.change_pct)))} ${a.change_pct < 0 ? "below" : "above"} asking` : ""}</div></a>${a.below_floor ? `<span class="badge neg">Below floor</span>` : `<span class="badge warn">Waiting</span>`}</li>`).join("")}</ul>`
    : `<div class="empty">${icon("check", "")}<b>Nothing is waiting for your OK</b><p>Price changes, discounts, test drives and holds that salesmen ask for land here.</p></div>`;

  mount(ctx.root, pageHead({ title: "Manager desk", sub: `${esc(greeting())}, ${esc(firstName())}. ${esc(dateFmt(state.today))}. Everything the floor needs today, in the order to do it.` })
    + (healthHtml(health) ? `<div class="health-bar rise">${healthHtml(health)}</div>` : "")
    + strip + monthStrip
    + `<div class="cmd sec-gap">
      ${card({ title: "What to do next", sub: "Each line says what to do", cls: "c7", body: improveHtml(next, 5) })}
      ${card({ title: "Leads waiting", sub: `${unclaimed.length} unclaimed. The target is ${slaMin} minutes.`, cls: "c5", body: waitingList })}
      ${nv ? card({ title: "Claimed, never visited", sub: `${num(nv.total)} open ${nv.total === 1 ? "lead" : "leads"} claimed 7 or more days ago with no showroom visit or test drive logged.`, cls: "c7", actions: `<a class="btn sm" href="#/team?view=never">See all ${icon("right")}</a>`, body: neverVisitedCompact(nv) }) : ""}
      ${appr ? card({ title: "Waiting for your OK", sub: `${num(waitingAppr.length)} ${waitingAppr.length === 1 ? "request" : "requests"}, oldest first`, cls: "c5", actions: `<a class="btn sm" href="#/approvals">Approvals ${icon("right")}</a>`, body: apprList }) : ""}
      ${card({ title: "Today's schedule", sub: "Test drives and follow-ups in time order. The highlighted one is next.", cls: "c5", body: scheduleList })}
      ${card({ title: "By salesman", sub: `${esc(periodLabel(p))}. Missed means a lead nobody claimed in ${slaMin} minutes.`, cls: "c7", body: smRows || `<div class="empty">${icon("team", "")}<b>No assignments yet</b></div>` })}
      ${card({ title: "Response and no response", sub: "Leads each salesman answered or let go", cls: "c5", body: resp.length ? `<div class="chart" id="ch-resp"></div>` : `<div class="empty">${icon("inbox", "")}<b>No lead activity</b></div>` })}
      ${card({ title: "Stock aging", sub: aging ? `${num(kp.aged_stock_pct?.aged_count)} of ${num(kp.aged_stock_pct?.invested_count)} invested cars are past ${aging.aged_threshold_days} days (${num(kp.aged_stock_pct?.aged_all_count)} of ${num(kp.aged_stock_pct?.stock_count)} cars in all).` : "", cls: "c7", body: aging ? `<div class="chart short" id="ch-aging"></div><ul class="list">${(aging.oldest || []).slice(0, 3).map((o) => `<li><a class="grow" href="#/inventory?car=${o.id}"><div class="t">${esc(o.stock_no)} · ${esc(o.label)}</div></a><span class="badge neg">${num(o.days)} days</span></li>`).join("")}</ul>` : "" })}
      ${card({ title: "RTO deadlines", sub: "Overdue, or a Form 29/30 clock under a week", cls: "c7", actions: `<a class="btn sm" href="#/rto">Open board ${icon("right")}</a>`, body: rtoList })}
      ${card({ title: "Feedback to resolve", sub: `${feedbackOpen.length} unresolved, oldest first`, cls: "c5", actions: `<a class="btn sm" href="#/feedback">All feedback ${icon("right")}</a>`, body: fbList })}
    </div>`);
  ctx.root.querySelectorAll("[data-at]").forEach((n) => n.style.setProperty("--at", n.dataset.at + "%"));

  if (resp.length) {
    const names = resp.map((r) => short(r.salesman));
    mountChart(document.getElementById("ch-resp"), (t) => ({
      grid: gridBox({ top: 34 }), legend: legendBox(t),
      tooltip: tooltip(t, (ps) => tipHtml(resp[ps[0].dataIndex].salesman, [{ color: t.pos, label: "Answered", value: num(resp[ps[0].dataIndex].responses) }, { color: t.neg, label: "No response", value: num(resp[ps[0].dataIndex].no_responses) }])),
      yAxis: catAxis(t, names, { inverse: true, axisLabel: { color: t.axis, fontSize: 11, interval: 0 } }), xAxis: valAxis(t, (v) => v, { minInterval: 1 }),
      series: [{ name: "Answered", type: "bar", stack: "r", barMaxWidth: 20, itemStyle: { color: t.pos }, label: { show: true, color: "#06231a", fontWeight: 800, fontSize: 11, formatter: (q) => (q.value > 0 ? q.value : "") }, data: resp.map((r) => r.responses) },
        { name: "No response", type: "bar", stack: "r", barMaxWidth: 20, itemStyle: { color: t.neg, borderRadius: [0, 6, 6, 0] }, label: { show: true, color: "#2b0a0a", fontWeight: 800, fontSize: 11, formatter: (q) => (q.value > 0 ? q.value : "") }, data: resp.map((r) => r.no_responses) }],
    }), "Answered and unanswered leads by salesman");
  }
  if (aging) {
    const bk = aging.buckets || [];
    mountChart(document.getElementById("ch-aging"), (t) => ({
      grid: gridBox({ top: 24, bottom: 4 }), tooltip: tooltip(t, (ps) => { const b = bk[ps[0].dataIndex]; return tipHtml(`${b.bucket} days`, [{ label: "Invested", value: num(b.invested) }, { label: "Park-N-Sell", value: num(b.pns) }]); }),
      xAxis: catAxis(t, bk.map((b) => b.bucket + " d")), yAxis: valAxis(t, (v) => v, { minInterval: 1 }),
      series: [{ type: "bar", barMaxWidth: 44, label: { show: true, position: "top", color: t.text, fontWeight: 800, fontSize: 12 }, data: bk.map((b, i) => ({ value: b.count, itemStyle: { color: stockCol(t)[i % 4], borderRadius: [8, 8, 0, 0] } })) }],
    }), `Stock by days in stock: ${bk.map((b) => `${b.bucket} days ${b.count} cars`).join(", ")}`);
  }
}
