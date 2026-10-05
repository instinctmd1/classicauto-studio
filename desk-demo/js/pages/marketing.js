// Marketing: Instagram followers against the 50,000 goal, website interactions, and which channels bring leads.
// Figures are typed in; nothing is fetched from Instagram or the web (the integrations are off, see the README).
import * as api from "../api.js";
import { get } from "../api.js";
import { state, can, periodLabel, chan } from "../state.js";
import { dateFmt, esc, icon, inr, lakh, mount, monthLabel, num, pct } from "../util.js";
import { alpha, catAxis, gridBox, legendBox, mountChart, tipHtml, tooltip, valAxis } from "../charts.js";
import { formDrawer, pageHead } from "../ui.js";
import { activateGauges, card, gaugeHtml, kpiTile } from "./_shared.js";

const DEVICE = { m: "Phone", t: "Tablet", d: "Computer", unknown: "Not known" };
const SOURCE = { direct: "Direct or bookmark", instagram: "Instagram", facebook: "Facebook", google: "Google", search: "Other search", whatsapp: "WhatsApp", youtube: "YouTube", cardekho: "CarDekho", carwale: "CarWale", olx: "OLX" };
const bars = (rows, key, label, color, wide = false) => {
  const v = (r) => r.visits ?? r.views;
  const top = Math.max(1, ...rows.map(v));
  return rows.map((r) => `<div class="hb${wide ? " wide" : ""}"><span class="name" title="${esc(label(r[key]) + (r.stock_no ? " · " + r.stock_no : ""))}">${esc(label(r[key]))}</span><span class="meter sm"><i data-w="${(v(r) / top) * 100}" data-c="${color}"></i></span><span class="val">${num(v(r))}</span></div>`).join("");
};

/** The website's own figures: beacons the site sends the lead engine, mirrored every minute. Honest when nothing has come in. */
function websitePanel(W, p) {
  const head = { flush: true, title: "Website: visits and enquiries", sub: `Counted by the website itself and passed on through the lead engine. A visit is one browser tab on one day. ${esc(periodLabel(p))}.` };
  if (!W) return card({ ...head, body: `<div class="empty">${icon("alert", "")}<b>The website figures could not load</b><p>Try again in a minute.</p></div>` });
  if (W.state === "no_data") return card({ ...head, body: `<div class="empty">${icon("globe", "")}<b>No website visits have come in yet</b><p>${W.engine?.available ? "The website sends each visit to the lead engine, and the engine has not received any yet. They show here within a minute of the first one." : "The lead engine's database cannot be read from this dashboard right now, so website visits cannot be counted. Inquiries already mirrored are not affected."}</p></div>` });
  const T = W.totals;
  const tile = (l, v, sub) => `<div class="bal-tile"><div class="l">${esc(l)}</div><div class="v">${num(v)}</div><div class="s">${sub}</div></div>`;
  const tiles = `<div class="web-tiles">${[
    tile("Visits", T.visits, esc(W.last_event_at ? `Last one ${dateFmt(W.last_event_at, false)}` : "")),
    tile("Pages viewed", T.page_views, T.visits ? `${(T.page_views / T.visits).toFixed(1)} a visit` : "—"),
    tile("Car pages opened", T.car_views, "Each car's own page"),
    tile("Enquiries", T.enquiries, T.enquiry_rate_pct != null ? `${pct(T.enquiry_rate_pct, 2)} of visits` : "From the website's forms"),
    tile("WhatsApp taps", T.whatsapp_taps, `${num(T.forms_sent)} forms sent`),
  ].join("")}</div>`;
  if (W.state === "quiet") return card({ ...head, body: `<div class="pad-box">${tiles}</div><div class="empty">${icon("globe", "")}<b>No website visits in ${esc(periodLabel(p))}</b><p>Visits have come in before, just none in this period. Pick another month above.</p></div>` });
  const lists = `<div class="g sec-gap">
    <div class="c4"><div class="mini-h">Most-viewed cars</div>${W.top_cars.length ? bars(W.top_cars, "label", (x) => x, "var(--navy-bright)", true) : `<p class="muted">No car page was opened.</p>`}</div>
    <div class="c4"><div class="mini-h">Where visits came from</div>${bars(W.sources, "source", (x) => SOURCE[x] || x, "var(--c-pns)")}</div>
    <div class="c4"><div class="mini-h">Device</div>${bars(W.devices, "device", (x) => DEVICE[x] || x, "var(--c-lux)")}</div></div>`;
  return card({ ...head, body: `<div class="pad-box">${tiles}<div class="sec-gap"><div class="mini-h">Visits and enquiries by day</div><div class="chart" id="ch-web"></div></div>${lists}</div>` });
}

export async function render(ctx) {
  const p = ctx.period;
  const [sum, met, web] = await Promise.all([get("marketing/summary", { period: p }), get("metrics", { keys: "ig_followers,web_visits,web_pageviews,web_wa_clicks" }),
    get("marketing/website", { period: p }).catch(() => null)]);
  if (!ctx.alive()) return;
  const ig = sum.instagram || {}, webm = sum.website || {};
  const goal = ig.goal || state.settings.ig_follower_goal || 50000;
  const money = can("money.view");
  const fol = met.series.ig_followers || [], vis = met.series.web_visits || [];
  const from = sum.period.from, to = sum.period.to;
  const need = ig.latest != null ? Math.ceil((goal - ig.latest) / 365) : null;
  const ch = Object.entries(sum.channels || {}).map(([k, v]) => ({ k, ...v })).sort((a, b) => b.leads - a.leads);
  const leadsTotal = Object.values(sum.leads_by_channel || {}).reduce((s, v) => s + v, 0);

  const hero = `<section class="card gauge-card rise c5"><div class="card-h"><div><h2>Road to ${num(goal / 1000)}K</h2><div class="card-sub">@classicauto_1974 · as of ${esc(dateFmt(ig.as_of, false))}</div></div></div>${gaugeHtml({ value: ig.latest || 0, goal })}
    <div class="gauge-foot"><div><b>${pct(ig.progress_pct)}</b><span>of goal</span></div><div><b>${ig.delta_30d != null ? (ig.delta_30d >= 0 ? "+" : "−") + num(Math.abs(ig.delta_30d)) : "—"}</b><span>last 30 days</span></div><div><b>${ig.per_day != null ? ig.per_day.toFixed(1) : "—"} a day</b><span>current pace</span></div><div><b>${need != null ? "+" + num(need) + " a day" : "—"}</b><span>for ${num(goal / 1000)}K in a year</span></div></div>
    <p class="note sec">${icon("info", "")}<span>${ig.projected_date ? `At this pace you reach ${num(goal / 1000)}K in ${esc(monthLabel(ig.projected_date))}.` : "The pace is too slow to project a date."} A year-end target needs about ${need != null ? num(need) : "—"} followers a day.</span></p></section>`;
  const trend = card({ title: "Followers over time", sub: `Daily snapshots, on their own scale. The goal is ${num(goal)}; the gauge shows how far along you are`, cls: "c7", body: fol.length > 1 ? `<div class="chart tall" id="ch-fol"></div>` : `<div class="empty">${icon("trend", "")}<b>No follower snapshots yet</b><p>${can("marketing.manage") ? "Type in today's count with Add figures." : "Ask whoever manages marketing to add the count."}</p></div>` });
  const tiles = `<div class="kpis four">${[
    kpiTile({ label: "Followers", value: ig.latest, sub: `${ig.delta_30d != null ? (ig.delta_30d >= 0 ? "+" : "−") + num(Math.abs(ig.delta_30d)) + " in 30 days" : ""}` }),
    kpiTile({ label: "Website visits", value: webm.visits, sub: `${num(webm.pageviews)} pages viewed · typed in` }),
    kpiTile({ label: "WhatsApp taps", value: webm.wa_clicks, sub: "From the website · typed in" }),
    kpiTile({ label: "Website inquiries", value: webm.website_leads, sub: webm.lead_rate_pct != null ? `${pct(webm.lead_rate_pct, 2)} of typed-in visits` : "" }),
  ].join("")}</div>`;
  const chTable = ch.length ? `<div class="scroll-x"><table class="tbl left"><thead><tr><th>Channel</th><th class="r">Inquiries</th><th class="r">Share</th><th class="r">Sold</th>${money ? '<th class="r">Spend</th><th class="r">Per inquiry</th><th class="r">Per sale</th>' : ""}</tr></thead><tbody>${ch.map((c) => `<tr><td>${esc(chan(c.k))}</td><td class="r">${num(c.leads)}</td><td class="r">${leadsTotal ? pct((c.leads / leadsTotal) * 100, 0) : "—"}</td><td class="r">${num(c.sales)}</td>${money ? `<td class="r">${c.spend ? inr(c.spend) : "—"}</td><td class="r">${c.cpl ? inr(c.cpl) : "—"}</td><td class="r">${c.cps ? inr(c.cps) : "—"}</td>` : ""}</tr>`).join("")}</tbody>${money && sum.spend != null ? `<tfoot><tr><td>Total</td><td class="r">${num(leadsTotal)}</td><td></td><td class="r">${num(ch.reduce((s, c) => s + c.sales, 0))}</td><td class="r">${inr(sum.spend)}</td><td></td><td></td></tr></tfoot>` : ""}</table></div>` : `<div class="empty">${icon("inbox", "")}<b>No inquiries in ${esc(periodLabel(p))}</b></div>`;
  mount(ctx.root, pageHead({ title: "Marketing", sub: `${esc(periodLabel(p))}. Followers, website interactions and the channels that bring inquiries.`,
    actions: can("marketing.manage") ? `<button class="btn primary" type="button" id="add-m">${icon("plus")}Add figures</button>` : "" })
    + `<div class="g">${hero}${trend}</div>${tiles.replace('class="kpis four"', 'class="kpis four sec-gap"')}
    <div class="sec-gap"></div>${websitePanel(web, p)}
    <div class="g sec-gap">${card({ title: "Website visits, typed in", sub: "Daily figures entered on this page, whole history", cls: "c7", body: vis.length > 1 ? `<div class="chart" id="ch-vis"></div>` : `<div class="empty">${icon("globe", "")}<b>No visit figures yet</b></div>` })}${card({ title: "Inquiries by channel", sub: `${esc(periodLabel(p))}`, cls: "c5", body: ch.length ? `<div class="chart mini" id="ch-ch"></div>` : "" })}</div>
    ${card({ title: money ? "Channels, spend and cost per sale" : "Channels", sub: money ? "Cost per inquiry is spend divided by inquiries; per sale divides by cars sold from that channel." : "Inquiries and sales by channel", flush: true, body: chTable })}
    <p class="note sec">${icon("lock", "")}<span>Followers and the "typed in" website figures are entered on this page. The website panel counts what the Classic Auto website itself reports to the lead engine; nothing is fetched from Instagram, Meta or any analytics service.</span></p>`);
  activateGauges(ctx.root);

  if (fol.length > 1) {
    mountChart(document.getElementById("ch-fol"), (t) => ({
      grid: gridBox({ top: 14 }),
      tooltip: tooltip(t, (ps) => tipHtml(dateFmt(ps[0].axisValue, false), ps.filter((s) => s.value != null).map((s) => ({ color: s.color, label: s.seriesName, value: num(Array.isArray(s.value) ? s.value[1] : s.value) })))),
      xAxis: { type: "time", axisLine: { lineStyle: { color: t.lineStrong } }, axisLabel: { color: t.axis, hideOverlap: true }, splitLine: { show: false } }, yAxis: valAxis(t, (v) => num(v), { min: (v) => Math.floor(v.min / 1000) * 1000 }),
      series: [{ name: "Followers", color: t.navy, type: "line", smooth: 0.2, showSymbol: false, lineStyle: { width: 3, color: t.navy }, areaStyle: { color: alpha(t.navy, 0.12) }, data: fol },
      ],
    }), "Instagram followers over time, on their own scale");
  }
  const ws = web?.series || [];
  if (document.getElementById("ch-web")) mountChart(document.getElementById("ch-web"), (t) => ({
    grid: gridBox({ top: 34 }), legend: legendBox(t),
    tooltip: tooltip(t, (ps) => tipHtml(dateFmt(ws[ps[0].dataIndex].date, false), [{ color: t.pns, label: "Visits", value: num(ws[ps[0].dataIndex].visits) }, { color: t.lux, label: "Enquiries", value: num(ws[ps[0].dataIndex].enquiries) }])),
    xAxis: catAxis(t, ws.map((d) => dateFmt(d.date, false))),
    yAxis: [valAxis(t, (v) => num(v), { minInterval: 1 }), valAxis(t, (v) => num(v), { minInterval: 1, position: "right", splitLine: { show: false } })],
    series: [{ name: "Visits", type: "bar", barMaxWidth: 14, itemStyle: { color: alpha(t.pns, 0.85), borderRadius: [3, 3, 0, 0] }, data: ws.map((d) => d.visits) },
      { name: "Enquiries", type: "line", yAxisIndex: 1, showSymbol: ws.length <= 31, symbolSize: 6, lineStyle: { width: 3, color: t.lux }, itemStyle: { color: t.lux }, data: ws.map((d) => d.enquiries) }],
  }), `Website visits and enquiries per day, ${periodLabel(p)}: ${num(web.totals.visits)} visits, ${num(web.totals.enquiries)} enquiries`);
  if (vis.length > 1) mountChart(document.getElementById("ch-vis"), (t) => ({
    grid: gridBox({ top: 20 }), tooltip: tooltip(t, (ps) => tipHtml(dateFmt(ps[0].axisValue, false), [{ color: t.pns, label: "Visits", value: num(ps[0].value[1]) }])),
    xAxis: { type: "time", axisLine: { lineStyle: { color: t.lineStrong } }, axisLabel: { color: t.axis, hideOverlap: true } }, yAxis: valAxis(t, (v) => num(v)),
    series: [{ name: "Visits", type: "bar", barMaxWidth: 6, itemStyle: { color: alpha(t.pns, 0.8), borderRadius: [3, 3, 0, 0] }, data: vis }],
  }), "Website visits per day");
  if (ch.length) mountChart(document.getElementById("ch-ch"), (t) => ({
    grid: gridBox({ top: 8, left: 4 }), tooltip: tooltip(t, (ps) => tipHtml(ps[0].name, [{ label: "Inquiries", value: num(ps[0].value) }])),
    xAxis: valAxis(t, (v) => v, { minInterval: 1 }), yAxis: { type: "category", inverse: true, data: ch.map((c) => chan(c.k)), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.muted, fontSize: 12 } },
    series: [{ type: "bar", barMaxWidth: 16, itemStyle: { color: t.pns, borderRadius: [0, 6, 6, 0] }, label: { show: true, position: "right", color: t.text, fontWeight: 800 }, data: ch.map((c) => c.leads) }],
  }), "Inquiries by channel");
  ctx.root.querySelector("#add-m")?.addEventListener("click", () => formDrawer({ title: "Add figures", sub: "Leave a box empty to skip it.", submit: "Save figures", ok: "Figures saved",
    fields: [{ name: "date", label: "For the day", type: "date", required: true, value: state.today }, { name: "ig_followers", label: "Instagram followers", type: "number", step: 1, min: 0 }, { name: "web_visits", label: "Website visits", type: "number", step: 1, min: 0 }, { name: "web_pageviews", label: "Pages viewed", type: "number", step: 1, min: 0 }, { name: "web_wa_clicks", label: "WhatsApp taps", type: "number", step: 1, min: 0 }],
    onSubmit: async (v) => { const items = Object.entries(v).filter(([k, x]) => k !== "date" && x != null).map(([key, value]) => ({ date: v.date, key, value })); if (!items.length) throw Object.assign(new Error("Enter at least one figure."), { fields: { ig_followers: "Enter at least one figure." } }); await api.post("metrics", { items }); ctx.refresh(); } }));
}
