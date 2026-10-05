// Leads & enquiries: funnel, channels, segments, lost reasons, response vs no-response, feedback.
import { get } from "../api.js";
import { state, periodLabel, compareLabel, bandLabel, bandShort, bandColor, chan, can } from "../state.js";
import { badge, dateFmt, dateTimeFmt, esc, icon, inr, lakh, minutes, mount, num, pct, sentence, statusBadge, title } from "../util.js";
import { alpha, bandHex, catAxis, donutOption, gridBox, legendBox, mountChart, tipHtml, tooltip, valAxis } from "../charts.js";
import { pageHead } from "../ui.js";
import { col, cellMain, columnsButton, exportButtons, makeGrid } from "./../grid.js";
import { card, funnelHtml, kpiTile, delta, pts } from "./_shared.js";

export async function render(ctx) {
  const p = ctx.period, owner = can("records.all");
  const [k, a, fn, fb, lost, noresp] = await Promise.all([
    get("kpis", { period: p }), get("leads/analytics", { period: p }), owner ? get("funnel", { period: p }) : Promise.resolve(null), get("feedback"),
    get("leads", { period: p, lost: 1, page_size: 200 }), get("leads", { period: p, no_response: 1, page_size: 200 }),
  ]);
  if (!ctx.alive()) return;
  const T = a.totals, K = k.kpis, cmp = compareLabel(k.compare);
  const tiles = [
    kpiTile({ label: "Inquiries", value: T.inquiries, delta: K.inquiries?.delta_pct, spark: K.inquiries?.spark, sub: `${num(T.spam)} spam blocked` }),
    kpiTile({ label: "Response rate", value: T.response_rate, kind: "pct", delta: pts(K.response_rate?.value, K.response_rate?.prev), deltaUnit: " pts", sub: `${num(T.no_response)} leads got no response` }),
    kpiTile({ label: "First response", value: T.median_claim_minutes, kind: "dec1", unit: "min", delta: delta(K.median_claim_minutes?.value, K.median_claim_minutes?.prev), invert: true, sub: "Median time to claim. Target under 10 min" }),
    kpiTile({ label: "Lost inquiries", value: T.lost, delta: K.lost_inquiries?.delta_pct, invert: true, sub: `${num(a.lost.status_lost)} marked lost · ${num(a.lost.gone_cold)} gone cold` }),
    kpiTile({ label: "Lead to sale", value: T.conversion_pct, kind: "pct", delta: pts(K.conversion_pct?.value, K.conversion_pct?.prev), deltaUnit: " pts", sub: `${num(T.sold)} sold · ${num(T.profitable)} profitable` }),
    kpiTile({ label: "After hours", value: T.after_hours_pct, kind: "pct", sub: `${num(T.after_hours)} arrived outside showroom hours` }),
  ].join("");

  const seg = (a.by_tier || []).filter((x) => x.band !== "unknown" || x.n);
  const segTotal = seg.reduce((s, x) => s + x.n, 0);
  const segCard = card({ title: "Luxury, mid and budget", sub: "Inquiries by what the customer wants to spend", cls: "c5", body: segTotal ? `<div class="chart mini" id="ch-seg"></div><div class="scroll-x"><table class="tbl"><thead><tr><th>Segment</th><th>Inquiries</th><th>Sold</th><th>Lost</th>${owner && a.by_tier?.[0]?.gp != null ? "<th>Profit</th>" : ""}</tr></thead><tbody>${seg.map((x) => `<tr><td><span class="legend"><span><i data-c="${bandColor(x.band)}"></i>${esc(bandShort(x.band))}</span></span></td><td>${num(x.n)}</td><td>${num(x.sold)}</td><td>${num(x.lost)}</td>${x.gp != null ? `<td>${inr(x.gp)}</td>` : ""}</tr>`).join("")}</tbody></table></div>` : emptyBox("leads", "No inquiries yet") });

  const reasons = Object.entries(a.lost.reasons || {}).sort((x, y) => y[1] - x[1]);
  const rTotal = reasons.reduce((s, r) => s + r[1], 0);
  const lostCard = card({ title: "Why we lose them", sub: `${num(a.lost.count)} lost or gone cold`, cls: "c5", body: `<div class="stack" role="img" aria-label="${num(a.lost.status_lost)} marked lost, ${num(a.lost.gone_cold)} gone cold"><i data-g="${a.lost.status_lost || 0.001}" data-c="var(--neg)"></i><i data-g="${a.lost.gone_cold || 0.001}" data-c="var(--warn)"></i></div>
    <div class="legend"><span><i data-c="var(--neg)"></i>Marked lost ${num(a.lost.status_lost)}</span><span><i data-c="var(--warn)"></i>Gone cold ${num(a.lost.gone_cold)}</span></div>
    ${rTotal ? `<div class="sec">${reasons.slice(0, 6).map(([r, n]) => `<div class="hb"><span class="name">${esc(sentence(r))}</span><span class="meter"><i data-w="${(n / rTotal) * 100}" data-c="var(--neg)"></i></span><span class="val">${num(n)}</span></div>`).join("")}</div>` : `<p class="note sec">${icon("info", "")}No lost reasons recorded yet. Open a lost lead below and tag why, so this chart can show where the money leaks.</p>`}` });

  const sm = a.responses?.by_salesman || [];
  const respCard = card({ title: "Response by salesman", sub: "Leads answered against leads missed", cls: "c7", body: sm.length ? `<div class="chart" id="ch-resp"></div>` : emptyBox("team", "No assignments yet") });
  const fbk = a.feedback;
  const bad = (fb?.data || []).filter((f) => f.sentiment === "bad").slice(0, 5);
  const fbCard = card({ title: "Customer feedback", sub: "From callback checks and post-delivery ratings", cls: "c7", body: `<div class="stat-row"><div><b>${fbk.satisfaction_pct != null ? pct(fbk.satisfaction_pct, 0) : "—"}</b><span>satisfied</span></div><div><b>${num(fbk.good)}</b><span>good</span></div><div><b>${num(fbk.bad)}</b><span>bad</span></div><div><b>${num(fbk.open_complaints)}</b><span>open complaints</span></div></div>
    <div class="stack sec" role="img" aria-label="${fbk.good} good, ${fbk.bad} bad"><i data-g="${fbk.good || 0.001}" data-c="var(--pos)"></i><i data-g="${fbk.bad || 0.001}" data-c="var(--neg)"></i></div>
    ${bad.length ? `<ul class="list sec">${bad.map((f) => `<li>${icon("thumbdown", "")}<span class="grow"><div class="t">${esc(f.text || "Bad feedback")}</div><div class="s">${dateFmt(f.ts, false)} · ${esc(f.staff_name || "Unassigned")} · ${esc(sentence(f.source))}</div></span>${f.resolved_at ? badge("Resolved", "pos") : badge("Open", "neg")}</li>`).join("")}</ul>` : ""}` });

  const funnelCard = fn ? card({ title: "Funnel", sub: "From first inquiry to delivered car. Recent months are still maturing.", cls: "c7", body: funnelHtml(fn.stages) }) : "";
  const chanCard = card({ title: "Where inquiries come from", sub: "By channel, with sold and lost", cls: fn ? "c5" : "c12", body: `<div class="chart" id="ch-chan"></div>` });
  mount(ctx.root, pageHead({ title: "Inquiries", sub: can("settings.manage") ? `${esc(periodLabel(p))}. Mirrored from the lead engine every minute. The engine is never written to.` : can("records.all") ? `${esc(periodLabel(p))}. Updated every minute.` : `${esc(periodLabel(p))}. Your inquiries this period.` })
    + `<div class="kpis six">${tiles}</div>`
    + `<div class="g">${funnelCard}${chanCard}</div><div class="g">${segCard}${respCard}</div><div class="g">${lostCard}${fbCard}</div>
    ${card({ title: "Lead list", sub: "Open a tab to see who slipped through.", flush: true, actions: `<span id="ga"></span>`, body: `<div class="toolbar"><div class="seg" id="lt"><button type="button" aria-pressed="true" data-t="lost">Lost or cold <span class="n">${lost.total}</span></button><button type="button" aria-pressed="false" data-t="noresp">No response <span class="n">${noresp.total}</span></button></div></div><div class="grid-wrap"><div id="grid"></div></div>` })}`);

  mountChart(document.getElementById("ch-chan"), (t) => {
    const ch = (a.by_channel || []).slice().sort((x, y) => x.n - y.n);
    return { grid: gridBox({ top: 30, left: 4 }), legend: legendBox(t),
      tooltip: tooltip(t, (ps) => { const c = ch[ps[0].dataIndex]; return tipHtml(chan(c.channel), [{ label: "Inquiries", value: num(c.n) }, { color: t.pos, label: "Sold", value: num(c.sold) }, { color: t.neg, label: "Lost", value: num(c.lost) }, ...(c.gp != null ? [{ label: "Profit", value: lakh(c.gp) }] : [])]); }),
      yAxis: catAxis(t, ch.map((c) => chan(c.channel))), xAxis: valAxis(t, (v) => v),
      series: [{ name: "Sold", type: "bar", stack: "a", barMaxWidth: 18, itemStyle: { color: t.pos }, label: segLabel("#06231a"), data: ch.map((c) => c.sold) },
        { name: "Lost", type: "bar", stack: "a", itemStyle: { color: t.neg }, label: segLabel("#2b0a0a"), data: ch.map((c) => c.lost) },
        { name: "Still open", type: "bar", stack: "a", itemStyle: { color: alpha(t.pns, 0.7), borderRadius: [0, 6, 6, 0] }, label: segLabel("#fff"), data: ch.map((c) => Math.max(0, c.n - c.sold - c.lost)) }] };
  }, `Inquiries by channel: ${(a.by_channel || []).map((c) => `${chan(c.channel)} ${c.n}`).join(", ")}`);
  if (segTotal) mountChart(document.getElementById("ch-seg"), (t) => donutOption(t, seg.map((x) => ({ name: bandShort(x.band), value: x.n, color: bandHex(t, x.band) })), { centerTop: String(segTotal), centerBottom: "INQUIRIES" }), "Inquiries by segment");
  if (sm.length) mountChart(document.getElementById("ch-resp"), (t) => {
    const s = sm.slice().sort((x, y) => (x.responses + x.no_responses) - (y.responses + y.no_responses));
    return { grid: gridBox({ top: 30, left: 4 }), legend: legendBox(t),
      tooltip: tooltip(t, (ps) => { const r = s[ps[0].dataIndex]; return tipHtml(r.salesman, [{ color: t.pos, label: "Responded", value: num(r.responses) }, { color: t.neg, label: "No response", value: num(r.no_responses) }, { label: "Response rate", value: pct(r.response_pct) }]); }),
      yAxis: catAxis(t, s.map((r) => r.salesman)), xAxis: valAxis(t, (v) => v),
      series: [{ name: "Responded", type: "bar", stack: "r", barMaxWidth: 20, itemStyle: { color: t.pos }, label: { show: true, color: "#06231a", fontWeight: 800, formatter: (q) => (q.value > 2 ? q.value : "") }, data: s.map((r) => r.responses) },
        { name: "No response", type: "bar", stack: "r", itemStyle: { color: t.neg, borderRadius: [0, 6, 6, 0] }, label: { show: true, color: "#2b0a0a", fontWeight: 800, formatter: (q) => (q.value > 2 ? q.value : "") }, data: s.map((r) => r.no_responses) }] };
  }, "Responses and missed leads by salesman");

  let grid, tab = "lost";
  const cols = [
    col.date("first_seen_ts", "Arrived", { width: 118, frozen: true, formatter: (c) => dateTimeFmt(c.getValue()) }),
    col.html("name", "Lead", { minWidth: 190, formatter: (c) => { const r = c.getData(); return cellMain(r.name || `Lead #${r.engine_id}`, r.car || "Car not given"); } }),
    col.html("channel", "Channel", { width: 120, formatter: (c) => esc(chan(c.getValue())) }),
    col.money("budget", "Budget", { width: 118, formatter: (c) => (c.getValue() ? inr(c.getValue()) : '<span class="faint">—</span>') }),
    col.html("band", "Segment", { width: 110, formatter: (c) => badge(bandShort(c.getValue()), c.getValue() === "luxury" ? "cream" : c.getValue() === "middle" ? "info" : "") }),
    col.text("salesman", "Salesman", { minWidth: 130, formatter: (c) => esc(c.getValue() || "Unassigned") }),
    col.html("status", "Status", { width: 116, formatter: (c) => statusBadge(c.getValue()) }),
    ...(can("exports.pii", "records.all") ? [col.text("phone", "Phone", { width: 150, formatter: (c) => esc(c.getValue() || "—") })] : []),
    col.int("events", "Events", { width: 90 }),
  ];
  grid = makeGrid(ctx.root.querySelector("#grid"), { data: lost.data, columns: cols, initialSort: [{ column: "first_seen_ts", dir: "desc" }], placeholder: "Nothing here. That is good news." });
  ctx.root.querySelector("#ga").replaceWith(columnsButton(() => grid), ...(can("exports.ops") ? [exportButtons(() => grid, `classic-auto-leads-${p}`, "ops")] : []));
  ctx.root.querySelector("#lt").addEventListener("click", (e) => {
    const b = e.target.closest("[data-t]"); if (!b) return; tab = b.dataset.t;
    ctx.root.querySelectorAll("#lt button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    grid.setData(tab === "lost" ? lost.data : noresp.data);
  });
}
const segLabel = (color) => ({ show: true, color, fontWeight: 800, fontSize: 11, formatter: (q) => (q.value > 0 ? q.value : "") });   // a number on every segment: colour alone is not the cue
const emptyBox = (ic, t) => `<div class="empty">${icon(ic, "")}<b>${t}</b></div>`;
