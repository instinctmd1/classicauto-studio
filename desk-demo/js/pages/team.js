// Salesmen: leaderboard, response speed, SLA misses, conversions, drill-down per person.
import { get } from "../api.js";
import { state, periodLabel, chan, bandShort, can } from "../state.js";
import { badge, dateFmt, dateTimeFmt, esc, icon, inr, initials, lakh, minutes, mount, num, pct, sentence } from "../util.js";
import { catAxis, gridBox, mountChart, tipHtml, tooltip, valAxis } from "../charts.js";
import { bindTabs, openDrawer, pageHead, tabsHtml } from "../ui.js";
import { card, kpiTile } from "./_shared.js";
import { neverVisitedFull } from "./_visits.js";

export async function render(ctx) {
  const p = ctx.period, owner = can("deals.profit.view", "money.view"), nvOn = can("records.all");
  const [res, nv] = await Promise.all([get("team/leaderboard", { period: p }), nvOn ? get("leads/never-visited", { days: 7 }).catch(() => null) : null]);
  if (!ctx.alive()) return;
  const all = res.data;
  const rows = all.filter((r) => r.role === "salesman" || r.assigned > 0).sort((a, b) => b.score - a.score);
  const tot = (f) => rows.reduce((s, r) => s + (r[f] || 0), 0);
  const claimMed = rows.filter((r) => r.median_claim_minutes != null).map((r) => r.median_claim_minutes).sort((a, b) => a - b);
  const med = claimMed.length ? claimMed[Math.floor(claimMed.length / 2)] : null;
  const top = rows[0];
  const tiles = [
    kpiTile({ label: "Leads assigned", value: tot("assigned"), sub: `${num(tot("claimed"))} claimed in time` }),
    kpiTile({ label: "SLA misses", value: tot("missed"), kind: "int", neg: tot("missed") > 0, sub: "Leads nobody claimed in the window" }),
    kpiTile({ label: "Median claim time", value: med, kind: "dec1", unit: "min", sub: "Across the team. Target under 10 min" }),
    kpiTile({ label: "Cars sold by team", value: tot("sold"), sub: tot("assigned") ? `${pct((tot("sold") / tot("assigned")) * 100)} of assigned leads` : "" }),
  ].join("");
  const maxScore = Math.max(1, ...rows.map((r) => r.score));
  const table = rows.length ? `<div class="scroll-x"><table class="tbl lb"><thead><tr><th>Salesman</th><th>Score</th><th>Assigned</th><th>Claimed</th><th>Missed</th><th>Claim time</th><th>Drives</th><th>Sold</th><th>Conv.</th>${owner ? "<th>Profit</th>" : ""}<th>Bad signs</th><th>Check-ins</th></tr></thead><tbody>${rows.map((r, i) => `<tr class="lb-row" tabindex="0" role="button" data-id="${r.staff_id}" aria-label="Open ${esc(r.name)}"><td><div class="who2"><span class="rank${i < 3 ? " top" : ""}">${i + 1}</span><span class="avatar sm">${esc(initials(r.name))}</span><span class="cell-main"><b>${esc(r.name)}</b><small>${r.in_rotation ? "In rotation" : "Not in rotation"}${r.active_penalty_until ? ` · penalised to ${esc(dateTimeFmt(r.active_penalty_until))}` : ""}</small></span></div></td>
      <td><div class="pbar"><span class="meter sm"><i data-w="${Math.max(0, (r.score / maxScore) * 100)}" data-c="${i === 0 ? "var(--c-lux)" : "var(--navy-bright)"}"></i></span><b>${num(r.score)}</b></div></td>
      <td>${num(r.assigned)}</td><td>${num(r.claimed)}</td><td>${r.missed ? badge(String(r.missed), "neg") : "0"}</td><td>${minutes(r.median_claim_minutes)}</td><td>${num(r.test_drives)}</td><td><b>${num(r.sold)}</b></td><td>${r.conversion_pct != null ? pct(r.conversion_pct) : "—"}</td>${owner ? `<td>${inr(r.gp)}</td>` : ""}<td>${r.bad_signals ? badge(String(r.bad_signals), "warn") : "0"}</td><td>${r.checkin_response_pct != null ? pct(r.checkin_response_pct, 0) : "—"}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${icon("team", "")}<b>No assignments in this period</b></div>`;

  mount(ctx.root, pageHead({ title: "Salesmen", sub: `${esc(periodLabel(p))}. Score is sold × 10 + claimed × 2 − missed × 3, the same formula the lead engine uses.` })
    + `<div class="kpis four">${tiles}</div>
    ${card({ title: "Leaderboard", sub: "Click a name for their month in detail.", flush: true, body: table })}
    ${nvOn ? card({ title: "Claimed, never visited", id: "never", flush: true, sub: "Open leads a salesman claimed but never brought in: no showroom visit or test drive logged, and no booking. Not tied to the month picker.",
      body: `${tabsHtml([{ id: "7", label: "7+ days", n: nv?.total ?? "—" }, { id: "14", label: "14+ days" }, { id: "30", label: "30+ days" }], "7", "Days since the lead was claimed")}<div id="nv-pane">${nv ? neverVisitedFull(nv) : `<div class="empty">${icon("alert", "")}<b>Could not load this list</b></div>`}</div>` }) : ""}
    <div class="g">${card({ title: "How fast they claim", sub: "Median minutes from lead arriving to claimed. The line is the 10-minute target.", cls: "c6", body: `<div class="chart rows" id="ch-speed"></div>` })}${card({ title: "Conversion", sub: "Share of assigned leads that became a sale", cls: "c6", body: `<div class="chart rows" id="ch-conv"></div>` })}</div>
    ${rows.some((r) => !r.in_rotation) ? `<p class="note">${icon("info", "")}Staff marked "Not in rotation" are not receiving routed leads yet.</p>` : ""}`);

  const open = (id) => openMember(+id, p, owner);
  ctx.root.querySelectorAll(".lb-row").forEach((tr) => { tr.addEventListener("click", () => open(tr.dataset.id)); tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(tr.dataset.id); } }); });
  const names = rows.map((r) => r.name.replace(/\s*\(demo\)/, ""));
  // horizontal bars: every name is shown at any width, and the target label sits inside the plot
  const nameAxis = (t) => ({ type: "category", inverse: true, data: names, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.text, fontSize: 12, width: 84, overflow: "truncate" } });
  mountChart(document.getElementById("ch-speed"), (t) => ({ grid: gridBox({ top: 24, right: 48, bottom: 4 }), tooltip: tooltip(t, (ps) => tipHtml(rows[ps[0].dataIndex].name, [{ label: "Median claim", value: minutes(rows[ps[0].dataIndex].median_claim_minutes) }])),
    xAxis: { type: "value", show: false, max: (v) => Math.max(12, v.max * 1.15) }, yAxis: nameAxis(t),
    series: [{ type: "bar", barMaxWidth: 18, data: rows.map((r) => ({ value: r.median_claim_minutes ?? 0, itemStyle: { color: (r.median_claim_minutes ?? 0) > 10 ? t.warn : t.pos, borderRadius: [0, 6, 6, 0] } })), label: { show: true, position: "right", color: t.text, fontWeight: 800, fontSize: 12, formatter: (q) => (q.value ? q.value + " m" : "") }, markLine: { silent: true, symbol: "none", lineStyle: { color: t.faint, type: "dashed" }, label: { color: t.muted, formatter: "10 min target", position: "end", rotate: 0, distance: 4 }, data: [{ xAxis: 10 }] } }] }), "Median minutes to claim a lead, by salesman");
  mountChart(document.getElementById("ch-conv"), (t) => ({ grid: gridBox({ top: 8, right: 52, bottom: 4 }), tooltip: tooltip(t, (ps) => { const r = rows[ps[0].dataIndex]; return tipHtml(r.name, [{ label: "Conversion", value: pct(r.conversion_pct) }, { label: "Sold", value: num(r.sold) }, { label: "Assigned", value: num(r.assigned) }]); }),
    xAxis: { type: "value", show: false }, yAxis: nameAxis(t),
    series: [{ type: "bar", barMaxWidth: 18, data: rows.map((r) => ({ value: r.conversion_pct ?? 0, itemStyle: { color: t.navy, borderRadius: [0, 6, 6, 0] } })), label: { show: true, position: "right", color: t.text, fontWeight: 800, fontSize: 12, formatter: (q) => (q.value ? q.value.toFixed(1) + "%" : "") } }] }), "Conversion percentage by salesman");
  const want = ctx.query.get("staff"); if (want) open(want);
  const nvCard = ctx.root.querySelector("#never");
  if (nvCard) {
    const pane = nvCard.querySelector("#nv-pane");
    bindTabs(nvCard, async (d) => {
      pane.innerHTML = `<div class="skel card"></div>`;
      try { const r = await get("leads/never-visited", { days: +d }); if (ctx.alive()) pane.innerHTML = neverVisitedFull(r); }
      catch (e) { pane.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not load this list.</b><span class="muted">${esc(e.message)}</span></div></div>`; }
    });
    if (ctx.query.get("view") === "never") nvCard.scrollIntoView({ block: "start" });
  }
}

async function openMember(id, p, owner) {
  const d = openDrawer({ title: "Salesman", sub: "Loading…", body: `<div class="skel card"></div>`, wide: true });
  let r;
  try { r = await get(`team/${id}`, { period: p }); } catch (e) { d.setBody(`<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not open this person.</b><span class="muted">${esc(e.message)}</span></div></div>`); return; }
  const s = r.stats, L = r.leads, F = r.feedback;
  d.setTitle(s.name.replace(/\s*\(demo\)/, "")); d.setSub(`${esc(sentence(s.role))} · ${esc(periodLabel(p))} · ${s.in_rotation ? "In rotation" : "Not in rotation"}`);
  const kv = (l, v) => `<div><dt>${l}</dt><dd>${v}</dd></div>`;
  const chRows = Object.entries(L.by_channel || {}).sort((a, b) => b[1].n - a[1].n);
  const sec = (t, inner) => (inner ? `<div class="sec"><div class="sec-h"><h3>${t}</h3></div>${inner}</div>` : "");
  d.setBody(`<dl class="dl dl-3">${kv("Assigned", `<span class="big">${num(s.assigned)}</span>`)}${kv("Claimed", num(s.claimed))}${kv("Missed", s.missed ? badge(String(s.missed), "neg") : "0")}${kv("Median claim", minutes(s.median_claim_minutes))}${kv("Contacted", num(s.contacted))}${kv("Test drives", num(s.test_drives))}${kv("Sold", num(s.sold))}${kv("Conversion", pct(s.conversion_pct))}${owner ? kv("Profit made", inr(s.gp)) : ""}${kv("Callbacks confirmed", `${num(s.customer_confirmed)} of ${num(s.customer_confirmed + s.customer_denied)}`)}${kv("Check-in answers", s.checkin_response_pct != null ? pct(s.checkin_response_pct, 0) : "—")}${kv("Score", num(s.score))}</dl>
    ${sec("Customer feedback", `<div class="stat-row"><div><b>${num(F.good)}</b><span>good</span></div><div><b>${num(F.bad)}</b><span>bad</span></div><div><b>${F.satisfaction_pct != null ? pct(F.satisfaction_pct, 0) : "—"}</b><span>satisfied</span></div><div><b>${num(F.open_complaints)}</b><span>open complaints</span></div></div>`)}
    ${chRows.length ? sec("By channel", `<table class="tbl"><thead><tr><th>Channel</th><th>Inquiries</th><th>Sold</th><th>Lost</th></tr></thead><tbody>${chRows.map(([c, v]) => `<tr><td>${esc(chan(c))}</td><td>${num(v.n)}</td><td>${num(v.sold)}</td><td>${num(v.lost)}</td></tr>`).join("")}</tbody></table>`) : ""}
    ${(r.overdue_followups || []).length ? sec("Overdue follow-ups", `<ul class="list">${r.overdue_followups.map((f) => `<li><span class="grow"><div class="t">${esc(sentence(f.purpose || "follow-up"))}</div><div class="s">Due ${esc(dateTimeFmt(f.due_at))}</div></span>${badge("Overdue", "warn")}</li>`).join("")}</ul>`) : ""}
    ${(r.penalties || []).length ? sec("Penalties", `<ul class="list">${r.penalties.map((x) => `<li><span class="grow"><div class="t">${esc(x.reason || "Penalty")}</div><div class="s">Until ${esc(dateTimeFmt(x.until))}</div></span></li>`).join("")}</ul>`) : ""}`);
}
