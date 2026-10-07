// Owner home. A morning brief first, then the month at a glance. Money tiles appear only for people holding money.view;
// everyone else gets the same page built from operational numbers.
import { get } from "../api.js";
import { state, can, pnlWindow, periodLabel, compareLabel, isMonthPeriod, bandLabel, bandColor, bandShort } from "../state.js";
import { ago, dateFmt, esc, icon, inr, lakh, monthLabel, mount, num, pct, title } from "../util.js";
import { alpha, bandHex, catAxis, donutOption, gridBox, legendBox, mountChart, moneyAxisFmt, profitByMonthOption, tipHtml, tooltip, valAxis } from "../charts.js";
import { pageHead } from "../ui.js";
import { activateGauges, alertsHtml, bindAlertGroups, card, delta, funnelHtml, gaugeHtml, insightsHtml, kpiTile, pts } from "./_shared.js";
import { firstName, greeting, healthHtml, isStale, loadHealth, yesterdayLine } from "./_brief.js";
import { improveHtml, improvements } from "./_improve.js";
import { chan } from "../state.js";

const settle = (p) => p.then((v) => v, () => null);

export async function render(ctx) {
  const p = ctx.period, win = pnlWindow(p);
  const money = can("money.view"), profitSeen = can("deals.profit.view", "money.view");
  const [k, pnl, ins, alerts, aging, funnel, analytics, deals, fb, waiting, asks, sc] = await Promise.all([
    get("kpis", { period: p }),
    money ? settle(get("pnl", { from: win.from, to: win.to })) : null,
    money ? settle(get("insights", { period: p })) : null,
    settle(get("alerts")), settle(get("cars/aging")), settle(get("funnel", { period: p })),
    can("leads.view") ? settle(get("leads/analytics", { period: p })) : null,
    profitSeen ? settle(get("deals", { status: "delivered", from: win.from + "-01", to: ctxEnd(p), page_size: 200 })) : null,
    can("activity.use") ? settle(get("feedback")) : null,
    can("expenses.approve") ? settle(get("expenses", { status: "pending" })) : null,
    can("approvals.manage") ? settle(get("approvals")) : null,
    can("records.all") ? settle(get("standing-context")) : null,
  ]);
  if (!ctx.alive()) return;
  const K = k.kpis, B = k.breakdown || {}, months = pnl?.months || [];
  const cmp = compareLabel(k.compare);
  const [yl, health] = await Promise.all([yesterdayLine(aging), loadHealth(analytics)]);
  if (!ctx.alive()) return;
  const stale = isStale(health);

  const series = (f) => months.map((m) => m[f] ?? 0);
  const gp = months.map((m) => (m.car_gp || 0) + (m.pns_gp || 0));
  const monthly = isMonthPeriod(p);
  const gpNow = (B.car_gp || 0) + (B.pns_gp || 0);
  const gpDelta = monthly && months.length > 1 ? delta(gp[gp.length - 1], gp[gp.length - 2]) : null;
  const ig = K.ig_followers || {};
  const goal = ig.goal || state.settings.ig_follower_goal || 50000;
  const need = ig.value != null ? Math.ceil((goal - ig.value) / 365) : null;
  const perDay = ig.prev != null && ig.value != null ? (ig.value - ig.prev) / 30 : null;
  const topChannel = Object.entries(K.inquiries?.by_channel || {}).sort((a, b) => b[1] - a[1])[0];
  const net = K.net_profit || {};
  const openFb = (fb?.data || []).filter((f) => f.sentiment === "bad" && !f.resolved_at).length;
  const alertList = alerts || [];

  // --- the brief
  const chips = [
    [alertList.filter((a) => a.severity === "red").length, "urgent alerts", "#/today"],
    [K.rto_transfer_tat_days?.overdue, "RTO overdue", "#/rto"],
    [analytics?.totals?.no_response, "leads with no response", "#/team"],
    [openFb, "bad feedback open", "#/feedback"],
  ].filter(([n]) => n !== undefined && n !== null);
  const brief = `<section class="brief rise"><div><div class="eyebrow">${esc(dateFmt(state.today))}</div><h2>${esc(greeting())}, <em>${esc(firstName())}</em>.</h2></div>
    ${yl.text ? `<p class="line">${yl.text}</p>` : ""}
    ${sc?.standing ? `<p class="line keep" id="standing-recap">Standing line for the agents: <b>${esc(sc.standing.text)}</b> <span class="muted">(${esc(String(sc.standing.set_by || "").replace(/\s*\(demo\)/, ""))}, ${esc(ago(sc.standing.set_at))})</span></p>` : ""}
    <div class="brief-todo">${chips.map(([n, l, h]) => `<a class="todo-chip${n === 0 ? " ok" : ""}" href="${h}"><b>${num(n)}</b>${esc(l)}</a>`).join("")}</div>
    ${healthHtml(health)}</section>`;

  const breakdown = [
    ["Car gross profit", B.car_gp, "+"], ["Commission after costs", B.pns_gp, "+"], ["Finance and insurance", B.fi?.total, "+"],
    ["Overheads", B.overheads, "−"], ["Marketing", B.marketing, "−"],
  ];
  const hero = money
    ? `<article class="card hero kpi big rise c7"><div class="kpi-top"><span class="kpi-label">Net profit · ${esc(periodLabel(p))}</span>${deltaOf(net.delta_pct)}</div>
    <div class="kpi-val${net.value < 0 ? " neg-val" : ""}">${bigMoney(net.value)}</div>
    <div class="kpi-sub">${net.prev != null ? `${esc(cmp)} was ${esc(lakh(net.prev))}.` : "No earlier month to compare."}${monthNote(p, state.today)}</div>
    ${sparkBig(net.spark)}
    <div class="stat-row">${breakdown.map(([l, v, s]) => `<div><b>${v == null ? "—" : s + lakh(v).replace("−", "")}</b><span>${l}</span></div>`).join("")}</div></article>`
    : stockHero(K, aging);

  const gaugeCard = `<section class="card gauge-card rise c5"><div class="card-h"><div><h2>Road to ${num(goal / 1000)}K</h2><div class="card-sub">@classicauto_1974 followers${stale.instagram ? ` · <span class="stale-note">stale</span>` : ""}</div></div>${can("marketing.view") ? `<div class="act"><a class="btn sm" href="#/marketing">Marketing ${icon("right")}</a></div>` : ""}</div>
    ${gaugeHtml({ value: ig.value || 0, goal })}
    <div class="gauge-foot"><div><b>${ig.value != null ? pct(ig.progress_pct ?? (ig.value / goal) * 100) : "—"}</b><span>of goal</span></div><div><b>${perDay != null ? `${perDay >= 0 ? "+" : "−"}${num(Math.abs(Math.round(perDay)))} a day` : "—"}</b><span>last 30 days</span></div>
    <div><b>${ig.projected_date ? esc(monthLabel(ig.projected_date)) : "Not on track"}</b><span>at this pace</span></div><div><b>${need != null ? `+${num(need)} a day` : "—"}</b><span>for ${num(goal / 1000)}K in a year</span></div></div></section>`;

  const moneyTiles = money ? [
    kpiTile({ label: "Revenue", value: K.turnover?.value, kind: "money", delta: K.turnover?.delta_pct, spark: series("turnover"), sub: K.turnover?.prev != null ? `${esc(cmp)}: ${esc(lakh(K.turnover.prev))}` : "" }),
    kpiTile({ label: "Gross profit", value: gpNow, kind: "money", delta: gpDelta, spark: gp, sub: K.gpu?.value != null ? `${esc(lakh(K.gpu.value))} per car` : "" }),
    kpiTile({ label: "Gross margin", value: K.gross_margin_pct?.value, kind: "pct", delta: pts(K.gross_margin_pct?.value, K.gross_margin_pct?.prev), deltaUnit: " pts", spark: series("gross_margin_pct"), sub: K.net_margin_pct?.value != null ? `Net margin ${pct(K.net_margin_pct.value)}` : "On invested cars" }),
    kpiTile({ label: "Capital in stock", value: K.capital_locked?.value, kind: "money", sub: K.holding_cost?.value != null ? `Holding cost ${esc(lakh(K.holding_cost.value))} this period` : "Purchase plus costs" }),
  ] : [];
  const stat = (label, node, cls = "") => node.replace('class="kpi rise', `class="kpi rise${cls}`);
  const opsTiles = [
    kpiTile({ label: "Cars sold", value: K.cars_sold?.value, kind: "int", delta: K.cars_sold?.delta_pct, spark: series("units"), sub: `${num(K.cars_sold?.invested)} invested · ${num(K.cars_sold?.pns)} Park-N-Sell` }),
    kpiTile({ label: "Days to sell", value: K.avg_days_to_sell?.value, kind: "days", delta: delta(K.avg_days_to_sell?.value, K.avg_days_to_sell?.prev), invert: true, sub: K.avg_days_to_sell?.invested != null ? `Invested ${num(Math.round(K.avg_days_to_sell.invested))} d · Park‑N‑Sell ${num(Math.round(K.avg_days_to_sell.pns ?? 0))} d` : "Average, invoice minus intake" }),
    stat("", kpiTile({ label: "Inquiries", value: K.inquiries?.value, kind: "int", delta: K.inquiries?.delta_pct, spark: K.inquiries?.spark, sub: stale.engine ? `<span class="stale-note">Stale since ${esc(health.engine?.ts?.slice(11, 16) || "—")}</span>` : topChannel ? `Most from ${esc(chan(topChannel[0]))} (${num(topChannel[1])})` : "From every channel" }), stale.engine ? " stale" : ""),
    stat("", kpiTile({ label: "Lead to sale", value: K.conversion_pct?.value, kind: "pct", delta: pts(K.conversion_pct?.value, K.conversion_pct?.prev), deltaUnit: " pts", sub: "Recent months are still maturing" }), stale.engine ? " stale" : ""),
    kpiTile({ label: "First response", value: K.median_claim_minutes?.value, kind: "dec1", unit: "min", delta: delta(K.median_claim_minutes?.value, K.median_claim_minutes?.prev), invert: true, sub: K.response_rate?.value != null ? `${pct(K.response_rate.value, 0)} answered · ${num(K.response_rate.no_response ?? 0)} no response` : "" }),
    kpiTile({ label: "Returning buyers", value: K.returning_customer_pct?.value, kind: "pct", delta: pts(K.returning_customer_pct?.value, K.returning_customer_pct?.prev), deltaUnit: " pts", sub: "Deals from people who bought before" }),
    kpiTile({ label: "Finance attach", value: K.attach_finance_pct?.value, kind: "pct", delta: pts(K.attach_finance_pct?.value, K.attach_finance_pct?.prev), deltaUnit: " pts", sub: "Buyers who financed through us" }),
    kpiTile({ label: "Insurance attach", value: K.attach_insurance_pct?.value, kind: "pct", delta: pts(K.attach_insurance_pct?.value, K.attach_insurance_pct?.prev), deltaUnit: " pts", sub: "Buyers who insured through us" }),
  ];

  const band = K.cars_sold?.by_band || {};
  const bandRows = ["low", "middle", "luxury"].map((b) => ({ b, n: band[b] || 0 }));
  const bandTotal = bandRows.reduce((s, r) => s + r.n, 0);
  const segCard = card({ title: "Cars sold by segment", sub: `${esc(periodLabel(p))}, by sale price`, cls: "c4",
    body: bandTotal ? `<div class="chart mini" id="ch-seg"></div><ul class="list">${bandRows.map((r) => `<li><span class="legend"><span><i data-c="${bandColor(r.b)}"></i>${esc(bandLabel(r.b))}</span></span><span class="grow"></span><b>${num(r.n)}</b></li>`).join("")}</ul>` : `<div class="empty">${icon("car", "")}<b>No cars delivered in ${esc(periodLabel(p))}</b><p>Segments fill in as deals are delivered. Try the previous month in the picker.</p></div>` });

  // --- channels with the reconciliation check from the reels (OD-3)
  const chRows = (analytics?.by_channel || []).slice().sort((a, b) => b.n - a.n);
  const chSum = chRows.reduce((s, r) => s + r.n, 0), total = analytics?.totals?.inquiries ?? chSum;
  const st = funnel?.stages || [];
  const stage = (key) => st.find((s) => s.key === key)?.n;
  const ordered = stage("delivered") != null && stage("booked") != null && stage("delivered") <= stage("booked") && stage("booked") <= stage("inquiries");
  const recon = chRows.length ? `<p class="note sec">${icon(chSum === total && ordered ? "check" : "alert", "")}<span>${chSum === total ? `Channels add up: ${num(chSum)} of ${num(total)} inquiries.` : `Channels add up to ${num(chSum)} but the total is ${num(total)}. ${num(Math.abs(total - chSum))} have no channel recorded.`} ${ordered ? "Delivered ≤ booked ≤ inquiries." : "The funnel order looks wrong; check the lead engine."}</span></p>` : "";
  const chCard = card({ title: "Where inquiries come from", sub: `${esc(periodLabel(p))}. Sold counts leads that turned into a delivery.`, cls: "c5",
    body: chRows.length ? `<div class="chart" id="ch-chan"></div><div class="scroll-x"><table class="tbl left"><thead><tr><th>Channel</th><th>Inquiries</th><th>Sold</th>${profitSeen ? "<th>Profit</th>" : ""}</tr></thead><tbody>${chRows.map((r) => `<tr><td>${esc(chan(r.channel))}</td><td>${num(r.n)}</td><td>${num(r.sold)}</td>${profitSeen ? `<td>${inr(r.gp)}</td>` : ""}</tr>`).join("")}</tbody></table></div>${recon}` : `<div class="empty">${icon("inbox", "")}<b>No inquiries in this period</b></div>` });

  // --- top models by gross profit (money only)
  let topCard = "";
  if (profitSeen && deals?.data?.length) {
    const g = new Map();
    for (const d of deals.data) {
      const key = `${d.car.make} ${d.car.model}`; const e = g.get(key) || { key, n: 0, gp: 0, days: 0, seg: new Set() };
      e.n++; e.gp += d.gross_profit || 0; e.days += d.days_to_sell || 0; e.seg.add(d.car.ownership === "park_n_sell" ? "Park-N-Sell" : "Invested"); g.set(key, e);
    }
    const list = [...g.values()].sort((a, b) => b.gp - a.gp).slice(0, 6);
    topCard = card({ title: "Most profitable models", sub: "Last 12 months, by total gross profit", cls: "c7", flush: true,
      body: `<div class="scroll-x"><table class="tbl left"><thead><tr><th>Model</th><th>Sold</th><th>Profit</th><th>Per car</th><th>Days to sell</th></tr></thead><tbody>${list.map((r) => `<tr><td>${esc(r.key)}<span class="sub">${[...r.seg].join(" · ")}</span></td><td>${num(r.n)}</td><td><b>${inr(r.gp)}</b></td><td>${inr(Math.round(r.gp / r.n))}</td><td>${num(Math.round(r.days / r.n))}</td></tr>`).join("")}</tbody></table></div>` });
  }

  const agingCard = card({ title: "Stock aging", sub: aging ? `${num(aging.aged_count)} of ${num(aging.invested_count)} invested cars are past ${aging.aged_threshold_days} days${money && aging.aged_capital != null ? ` (${lakh(aging.aged_capital)} tied up; ${lakh(aging.capital_locked)} in all stock)` : ""}. The bars also count ${num((aging.aged_all_count || 0) - (aging.aged_count || 0))} Park-N-Sell cars, which carry no capital.` : "", cls: "c5",
    body: aging ? `<div class="chart short" id="ch-aging"></div>${aging.oldest?.length ? `<ul class="list">${aging.oldest.slice(0, 3).map((o) => `<li><a class="grow" href="#/inventory?car=${o.id}"><div class="t">${esc(o.stock_no)} · ${esc(o.label)}</div></a><span class="badge neg">${num(o.days)} days</span></li>`).join("")}</ul>` : ""}` : `<div class="empty"><b>No stock figures</b></div>` });
  const funnelCard = card({ title: "Lead funnel", sub: `${esc(periodLabel(p))}. Each bar is a share of inquiries.`, cls: "c7", actions: can("leads.view") ? `<a class="btn sm" href="#/leads">Leads ${icon("right")}</a>` : "", body: funnelHtml(st) });
  const improve = money ? insightsHtml(ins || [], 6) : improveHtml(improvements({ K, aging, analytics, openFeedback: openFb }), 6);
  const improveCard = card({ title: "What to improve", sub: money ? "Ranked by rupees at stake: what each problem costs, or could earn if fixed (an estimate, not a booked loss). Compliance comes first." : "Each line says what to do next.", cls: "c7", body: improve });
  const alertsCard = card({ title: "Alerts", sub: `${num(alertList.length)} open`, cls: "c5", body: alertsHtml(alertList) });

  mount(ctx.root, pageHead({ title: money ? "Overview" : "Home", sub: `${esc(periodLabel(p))} for Classic Auto.${money ? " Revenue counts only what the firm earns: invested sales plus commission and finance income." : ""}` })
    + brief
    + (waiting?.data?.length ? `<a class="callout warn rise approvals-note" href="#/expenses?tab=queue">${icon("wallet", "")}<div><b>${num(waiting.data.length)} ${waiting.data.length === 1 ? "expense is" : "expenses are"} waiting for your approval.</b><p>${esc(lakh(waiting.data.reduce((t, x) => t + x.amount, 0)))} in all. Approved expenses are the only ones that reach profit.</p></div></a><div class="sec-gap"></div>` : "")
    + (asks?.data?.length ? `<a class="callout warn rise approvals-note" href="#/approvals">${icon("flag", "")}<div><b>${num(asks.data.length)} ${asks.data.length === 1 ? "request is" : "requests are"} waiting for an OK.</b><p>Price changes, discounts, test drives and holds the team has asked for. The oldest is from ${esc(dateFmt(asks.data[0].requested_at, false))}.</p></div></a><div class="sec-gap"></div>` : "")
    + `<div class="g sec-gap">${hero}${gaugeCard}</div>
    <div class="kpis four">${[...moneyTiles, ...opsTiles].join("")}</div>
    <div class="g">${money ? card({ title: "Profit by month", sub: "Gross and net profit, last 12 months. The selected month is brightest. Turnover is the faint dashed line.", cls: "c8", body: `<div class="chart" id="ch-pnl"></div>` }) : chCard.replace("c5", "c8")}${segCard}</div>
    <div class="g">${money ? chCard : agingCard.replace("c5", "c6")}${money ? topCard || agingCard.replace("c5", "c7") : funnelCard.replace("c7", "c6")}</div>
    <div class="g">${money ? agingCard : improveCard.replace("c7", "c7")}${money ? funnelCard : alertsCard}</div>
    <div class="g">${money ? improveCard : ""}${money ? alertsCard : ""}</div>`);
  bindAlertGroups(ctx.root);
  activateGauges(ctx.root);

  // charts
  if (money) {
    const labels = months.map((m) => monthLabel(m.month, false));
    const selIdx = isMonthPeriod(p) ? months.findIndex((m) => m.month === p) : months.length - 1;
    mountChart(document.getElementById("ch-pnl"), (t, narrow) => profitByMonthOption(t, months, labels, selIdx, monthLabel, narrow), "Monthly gross and net profit for the last 12 months, with turnover as a dashed reference line");
  }
  if (bandTotal) mountChart(document.getElementById("ch-seg"), (t) => donutOption(t, bandRows.map((r) => ({ name: bandShort(r.b), value: r.n, color: bandHex(t, r.b) })), { centerTop: String(bandTotal), centerBottom: "CARS SOLD" }), `Cars sold by segment: ${bandRows.map((r) => `${bandShort(r.b)} ${r.n}`).join(", ")}`);
  if (chRows.length) {
    mountChart(document.getElementById("ch-chan"), (t) => ({
      grid: gridBox({ top: 4, right: 44, bottom: 4 }),
      tooltip: tooltip(t, (ps) => { const r = chRows[ps[0].dataIndex]; return tipHtml(chan(r.channel), [{ label: "Inquiries", value: num(r.n) }, { label: "Sold", value: num(r.sold) }]); }),
      xAxis: { type: "value", show: false },
      yAxis: { type: "category", inverse: true, data: chRows.map((r) => chan(r.channel)), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.text, fontSize: 12, width: 92, overflow: "truncate" } },
      series: [{ type: "bar", barMaxWidth: 16, data: chRows.map((r) => ({ value: r.n, itemStyle: { color: t.pns, borderRadius: [0, 6, 6, 0] } })), label: { show: true, position: "right", color: t.text, fontWeight: 800, fontSize: 12 } }],
    }), `Inquiries by channel: ${chRows.map((r) => `${chan(r.channel)} ${r.n}`).join(", ")}`);
  }
  if (aging) {
    const bk = aging.buckets || [];
    const colors = (t) => [t.pos, t.lux, t.warn, t.neg];
    mountChart(document.getElementById("ch-aging"), (t) => ({
      grid: gridBox({ top: 24, bottom: 4 }), tooltip: tooltip(t, (ps) => { const b = bk[ps[0].dataIndex]; return tipHtml(`${b.bucket} days`, [{ label: "Invested", value: num(b.invested) }, { label: "Park-N-Sell", value: num(b.pns) }, ...(money && b.capital_locked != null ? [{ label: "Capital locked", value: lakh(b.capital_locked) }] : [])]); }),
      xAxis: catAxis(t, bk.map((b) => b.bucket + " d")), yAxis: valAxis(t, (v) => v, { minInterval: 1 }),
      series: [{ type: "bar", barMaxWidth: 44, label: { show: true, position: "top", color: t.text, fontWeight: 800, fontSize: 12 }, data: bk.map((b, i) => ({ value: b.count, itemStyle: { color: colors(t)[i % 4], borderRadius: [8, 8, 0, 0] } })) }],
    }), `Stock by days in stock: ${bk.map((b) => `${b.bucket} days ${b.count} cars`).join(", ")}`);
  }
}

function ctxEnd(p) { const m = /^\d{4}-\d{2}$/.test(p) ? p : state.today.slice(0, 7); const [y, mo] = m.split("-").map(Number); return `${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, "0")}`; }

function stockHero(K, aging) {
  const a = K.aged_stock_pct || {}, by = a.by || {};
  const rows = [["Invested", by.ownership?.invested], ["Park-N-Sell", by.ownership?.park_n_sell], ["Available", by.status?.available], ["In workshop", by.status?.refurb], ["Incoming", by.status?.incoming]];
  return `<article class="card hero kpi big rise c7"><div class="kpi-top"><span class="kpi-label">Cars on the lot</span><span class="badge ${a.value > 15 ? "warn" : "pos"}">${a.value != null ? pct(a.value, 0) : "—"} aged</span></div>
    <div class="kpi-val"><span class="num" data-count="${a.stock_count || 0}" data-dec="0">${num(a.stock_count)}</span><span class="unit">cars</span></div>
    <div class="kpi-sub">${num(a.aged_count)} have been here over ${aging?.aged_threshold_days || 60} days.</div>
    ${ageBar(aging)}
    <div class="stat-row">${rows.map(([l, v]) => `<div><b>${num(v ?? 0)}</b><span>${l}</span></div>`).join("")}</div></article>`;
}

/** How long the cars on the lot have been sitting, as one bar: the thing a stock owner checks first. */
function ageBar(aging) {
  const bk = aging?.buckets || [];
  if (!bk.length) return "";
  const cols = ["var(--pos)", "var(--c-lux)", "var(--warn)", "var(--neg)"];
  return `<div class="age-bar"><div class="mini-h">Days on the lot</div><div class="stack" role="img" aria-label="${bk.map((b) => `${b.count} cars at ${b.bucket} days`).join(", ")}">${bk.map((b, i) => `<i data-g="${b.count || 0.001}" data-c="${cols[i % 4]}"></i>`).join("")}</div>
    <div class="legend">${bk.map((b, i) => `<span><i data-c="${cols[i % 4]}"></i>${esc(b.bucket)} d <b>${num(b.count)}</b></span>`).join("")}</div></div>`;
}

function deltaOf(d) {
  if (d == null) return "";
  const up = d > 0.05, down = d < -0.05;
  return `<span class="delta ${up ? "up" : down ? "down" : "flat"}">${up ? "▲" : down ? "▼" : ""} ${Math.abs(d).toFixed(1)}%</span>`;
}
function bigMoney(v) {
  if (typeof v !== "number") return "—";
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  if (a >= 1e7) return `${s}<span class="cur">₹</span><span class="num" data-count="${a / 1e7}" data-dec="2" data-group="0">${(a / 1e7).toFixed(2)}</span><span class="unit">Cr</span>`;
  if (a >= 1e5) return `${s}<span class="cur">₹</span><span class="num" data-count="${a / 1e5}" data-dec="1" data-group="0">${(a / 1e5).toFixed(1)}</span><span class="unit">L</span>`;
  return `${s}<span class="cur">₹</span><span class="num" data-count="${a}" data-dec="0">${num(a)}</span>`;
}
function sparkBig(v) {
  const vals = (v || []).filter((x) => typeof x === "number");
  if (vals.length < 2) return "";
  const w = 200, h = 80, min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const pts = vals.map((y, i) => [(i / (vals.length - 1)) * w, h - 6 - ((y - min) / rng) * (h - 14)]);
  const d = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
  return `<svg class="spark" data-c="var(--navy-bright)" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="${d} L${w} ${h} L0 ${h}Z"/><path class="line" pathLength="1" vector-effect="non-scaling-stroke" d="${d}"/></svg>`;
}
function monthNote(p, today) {
  if (/^\d{4}-\d{2}$/.test(p) && p === today.slice(0, 7)) return ` Month in progress, day ${+today.slice(8, 10)}.`;
  return "";
}
