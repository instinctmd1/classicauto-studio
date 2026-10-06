// Calls and warnings (classic-auto/accountability-6oct/ACCOUNTABILITY-SPEC.md 8.2, 8.3, 11.4).
// A salesman sees his call timers, his own scorecard and his own warnings, each with one Explain. The owners and the
// manager see the team: scorecards with Watch and Review, the warnings ledger (add, excuse), the night queue and leave.
// The engine computes every figure; there is never money on this page.
import { can, state } from "../state.js";
import { esc, icon, num, pct } from "../util.js";
import { bindTabs, formDrawer, pageHead, tabsHtml, toast } from "../ui.js";
import * as desk from "../desk-api.js";
import { deskNow, deskTime, every, onFeed, openSheet, startTicker } from "../desk.js";
import { CATEGORY, WARN, accOn, leaveListHtml, openLeaveAdd, todoStrip } from "./_acc.js";

const PERIODS = [["today", "Today"], ["week", "This week"], ["month", "This month"]];
const ist = () => new Date(deskNow() + 5.5 * 36e5);
function range(p) {
  const t = ist(), to = t.toISOString().slice(0, 10);
  if (p === "today") return { from: to, to };
  if (p === "week") { const d = new Date(t); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return { from: d.toISOString().slice(0, 10), to }; }
  return { from: to.slice(0, 8) + "01", to };
}
const pctOr = (v) => (v === null || v === undefined ? "—" : pct(v));
const minOr = (v) => (v === null || v === undefined ? "—" : `${num(Math.round(v * 10) / 10)} min`);
const flagChip = (f) => (f === "review" ? `<span class="badge neg">Review</span>` : f === "watch" ? `<span class="badge warn">Watch</span>` : "");
const shareText = (r) => (!r.rated ? "New, not rated yet" : r.weight ? `${(Math.round(r.weight * 100) / 100).toFixed(2)}× a normal share` : "—");

export async function render(ctx) {
  startTicker();
  const team = can("acc.team");
  ctx.root.innerHTML = `${pageHead({ title: "Calls and warnings", sub: esc(team ? "How every salesman is doing on calls, briefs and screenshots, the warnings ledger, the night queue and leave. Never money." : "Your call timers, how you are doing, and your warnings. Never money.") })}<div id="cw"></div>`;
  const host = ctx.root.querySelector("#cw");
  if (!accOn()) {
    host.innerHTML = `<div class="empty">${icon("clock", "")}<b>Call accountability is off</b><p>When the owners switch it on, your call to-dos, briefs and warnings show here.</p></div>`;
    return;
  }
  if (!team) return salesman(ctx, host);
  return teamView(ctx, host);
}

// ------------------------------------------------------------------ the salesman's own page
async function salesman(ctx, host) {
  let period = ctx.query.get("p") || "week";
  host.innerHTML = `<div id="cw-todo"></div>
    <section class="card rise" id="cw-timers"><div class="card-h"><div><h2>My timers</h2><div class="card-sub">Set by the owners. The clocks count showroom minutes only.</div></div></div><div class="skel h70"></div></section>
    <section class="card rise"><div class="card-h"><div><h2>My scorecard</h2><div class="card-sub" id="cw-how"></div></div><div class="act"><div class="seg" role="group" aria-label="Period" id="cw-per">${PERIODS.map(([k, l]) => `<button type="button" data-p="${k}" aria-pressed="${k === period}">${l}</button>`).join("")}</div></div></div><div id="cw-score"><div class="skel h140"></div></div></section>
    <section class="card rise"><div class="card-h"><div><h2>My warnings</h2><div class="card-sub">You can add one explanation to each. Three in 30 days shows Watch; five means a talk with the manager. No effect on pay.</div></div></div><div id="cw-warn"><div class="skel h80"></div></div></section>`;
  const timers = async () => {
    const box = host.querySelector("#cw-timers");
    try {
      const s = await desk.get("acc/settings");
      const t = s.timers || {};
      box.querySelector(".skel")?.remove();
      box.insertAdjacentHTML("beforeend", `<dl class="dl dl-3 cw-timers">
        <div><dt>Showroom hours</dt><dd class="big">${esc(t.office_hours || "—")}</dd></div>
        <div><dt>Claim a lead within</dt><dd class="big">${esc(t.claim_sla_min ?? "—")} min</dd></div>
        <div><dt>First call within</dt><dd class="big">${esc(t.call_sla_min ?? "—")} min</dd></div>
        <div><dt>Brief asked for</dt><dd class="big">${esc(t.brief_prompt_min ?? "—")} min</dd><dd class="muted">after you press Call</dd></div>
        <div><dt>Screenshot and brief by</dt><dd class="big">${esc(t.proof_due_min ?? "—")} min</dd><dd class="muted">after you claim</dd></div></dl>`);
    } catch (e) { box.querySelector(".skel")?.replaceWith(unavailable(e)); }
  };
  const todo = async () => {
    try { const t = await desk.get("acc/todo", {}, { background: true }); if (ctx.alive()) host.querySelector("#cw-todo").innerHTML = t.enabled ? todoStrip(t, { max: 8 }) : ""; }
    catch { /* the strip hides: fail closed */ }
  };
  const score = async () => {
    const box = host.querySelector("#cw-score");
    try {
      const r = await desk.get("acc/scorecard", range(period));
      if (!ctx.alive()) return;
      const row = (r.data || [])[0];
      host.querySelector("#cw-how").textContent = r.how || "";
      box.innerHTML = row ? scoreBlock(row) : `<div class="empty small">${icon("team", "")}<b>Nothing in this period yet</b></div>`;
    } catch (e) { box.replaceChildren(unavailable(e)); }
  };
  const warns = async () => {
    const box = host.querySelector("#cw-warn");
    try {
      const r = await desk.get("acc/warnings", {});
      if (!ctx.alive()) return;
      box.innerHTML = warnList(r.data || [], { own: true });
    } catch (e) { box.replaceChildren(unavailable(e)); }
  };
  host.querySelector("#cw-per").addEventListener("click", (e) => {
    const b = e.target.closest("[data-p]"); if (!b) return;
    period = b.dataset.p;
    host.querySelectorAll("#cw-per [data-p]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    score();
  });
  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-explain]"); if (!b) return;
    explain(+b.dataset.explain, () => warns());
  });
  onFeed((row) => { if (/^(acc|lead)\./.test(row.kind || "")) { todo(); if (row.kind === "acc.changed") warns(); } });
  every(60000, () => { if (document.visibilityState === "visible") todo(); });
  await Promise.all([timers(), todo(), score(), warns()]);
}

function scoreBlock(r) {
  const b = r.briefs || {}, p = r.proofs || {}, w = r.warnings || {};
  const tile = (label, val, sub = "") => `<div class="sc-tile"><span class="kpi-label">${esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
  return `<div class="sc-head"><div class="sc-score"><span class="kpi-label">Score</span><b>${r.score ?? "—"}</b><small>${esc(shareText(r))}</small></div>${flagChip(r.flag)}${r.off_today ? `<span class="badge">Off today</span>` : ""}</div>
    <div class="sc-grid">
      ${tile("Claimed in time", pctOr(r.claim_rate_pct), `${num(r.claimed ?? 0)} of ${num(r.received ?? 0)} leads`)}
      ${tile("Called in time", pctOr(r.called_in_time_pct), `first call ${minOr(r.median_first_call_min)} (median)`)}
      ${tile("Briefs on time", pctOr(b.on_time_pct), `${num(b.on_time ?? 0)} on time · ${num(b.late ?? 0)} late · ${num(b.missed ?? 0)} missed`)}
      ${tile("Conversion", pctOr(r.conversion_pct), `${num(r.sold ?? 0)} sold · ${num(r.visits_booked ?? 0)} visits · ${num(r.test_drives ?? 0)} drives`)}
      ${tile("Screenshots", `${num((p.approved ?? 0) + (p.approved_auto ?? 0) + (p.verified ?? 0))}`, `approved · ${num(p.pending ?? 0)} waiting · ${num((p.missed ?? 0) + (p.rejected ?? 0))} missed or rejected`)}
      ${tile("Warnings", num(w.active ?? 0), `${num(w.excused ?? 0)} excused · passed on ${num(r.passed_on ?? 0)} time${r.passed_on === 1 ? "" : "s"}`)}
    </div>`;
}

function warnList(rows, { own = false, manage = false } = {}) {
  if (!rows.length) return `<div class="empty small">${icon("check", "")}<b>${own ? "No warnings. Keep it that way." : "No warnings match"}</b></div>`;
  return `<ol class="warn-list">${rows.map((w) => `<li class="warn-item${w.status === "excused" ? " excused" : ""}">
    <div class="wi-top"><b>${esc(WARN[w.type] || w.type)}</b>${w.category ? `<span class="badge">${esc(CATEGORY[w.category] || w.category)}</span>` : ""}${w.status === "excused" ? `<span class="badge pos">Excused</span>` : `<span class="badge neg">Active</span>`}<time>${esc(deskTime(w.ts))}</time></div>
    <div class="wi-meta">${own ? "" : `<span>${icon("user", "")}${esc(w.seat)}</span>`}${w.lead_id ? `<a href="#/lead/${+w.lead_id}">Lead #${+w.lead_id}</a>` : `<span>Not about one lead</span>`}${w.detail ? `<span>${esc(w.detail)}</span>` : ""}${w.source === "auto" ? `<span class="muted">automatic</span>` : w.created_by ? `<span class="muted">by ${esc(w.created_by)}</span>` : ""}</div>
    ${w.explanation ? `<p class="wi-ex"><span class="muted">${own ? "Your explanation" : "Explanation"}:</span> ${esc(w.explanation)}</p>` : ""}
    ${w.status === "excused" ? `<p class="wi-ex"><span class="muted">Excused${w.excused_by ? ` by ${esc(w.excused_by)}` : ""}:</span> ${esc(w.excuse_reason || "")}</p>` : ""}
    <div class="wi-acts">${own && !w.explanation && w.status === "active" ? `<button class="btn sm" type="button" data-explain="${+w.id}">${icon("edit")}Explain</button>` : ""}${manage && w.status === "active" ? `<button class="btn sm" type="button" data-excuse="${+w.id}" data-seat="${esc(w.seat)}">${icon("check")}Excuse</button>` : ""}</div>
  </li>`).join("")}</ol>`;
}

function explain(wid, done) {
  const f = formDrawer({ title: "Explain this warning", sub: "One explanation per warning. The manager sees it next to the warning.", submit: "Send", ok: "",
    fields: [{ name: "text", label: "What happened", type: "textarea", required: true, full: true, placeholder: "e.g. The customer asked me to call after lunch", hint: "5 to 300 letters." }],
    onSubmit: async (v) => {
      const text = (v.text || "").trim();
      if (text.length < 5 || text.length > 300) { const e = new Error("5 to 300 letters."); e.fields = { text: "5 to 300 letters." }; throw e; }
      await desk.post(`acc/warnings/${wid}/explain`, { text });
      desk.done("Explanation sent"); done();
    } });
  f.el.classList.add("sheet");
}

function unavailable(e) {
  const n = document.createElement("div");
  n.className = "notice warn acc-unav";
  n.setAttribute("role", "note");
  n.innerHTML = `${icon("alert", "")}<span>${esc(e?.status === 503 || e?.status === 0 ? "Unavailable right now: the lead engine is not answering." : e?.message || "Could not load this.")}</span>`;
  return n;
}

// ------------------------------------------------------------------ owners and the manager
async function teamView(ctx, host) {
  const tabs = [{ id: "team", label: "Team" }, { id: "warnings", label: "Warnings" }, { id: "night", label: "Night queue" }, { id: "leave", label: "Leave" }];
  let tab = tabs.some((t) => t.id === ctx.query.get("tab")) ? ctx.query.get("tab") : "team";
  host.innerHTML = `<div id="cw-todo"></div>${tabsHtml(tabs, tab, "Calls and warnings")}<div id="cw-pane"></div>`;
  const pane = host.querySelector("#cw-pane");
  const st = { period: "week", sort: "score", dir: -1, seats: [], wf: { seat: "", type: "", status: "active", period: "month" } };
  const paneFor = { team: teamTab, warnings: warningsTab, night: nightTab, leave: leaveTab };
  const show = (t) => { tab = t; history.replaceState(null, "", `#/calls${t === "team" ? "" : "?tab=" + t}`); pane.innerHTML = `<div class="skel card h160"></div>`; paneFor[t](ctx, pane, st); };
  bindTabs(host, show);
  try { const t = await desk.get("acc/todo", {}, { background: true }); if (t.enabled && (t.items?.length || t.review_queue)) host.querySelector("#cw-todo").innerHTML = todoStrip(t); } catch { /* hidden */ }
  onFeed((row) => { if (row.kind === "acc.changed" && ctx.alive()) show(tab); });
  show(tab);
}

const COLS = [
  ["seat", "Salesman"], ["score", "Score"], ["received", "Leads"], ["claim_rate_pct", "Claimed"], ["passed_on", "Passed on"],
  ["median_first_call_min", "First call"], ["called_in_time_pct", "Called in time"], ["briefs_on_time", "Briefs on time"],
  ["proofs_open", "Screenshots"], ["warnings_active", "Warnings"], ["visits_booked", "Visits"], ["sold", "Sold"], ["conversion_pct", "Conv."],
];
const sortVal = (r, k) => (k === "briefs_on_time" ? r.briefs?.on_time_pct : k === "warnings_active" ? r.warnings?.active : k === "proofs_open" ? (r.proofs?.pending ?? 0) + (r.proofs?.missed ?? 0) : r[k]);

async function teamTab(ctx, pane, st) {
  let r;
  try { r = await desk.get("acc/scorecard", range(st.period)); }
  catch (e) { pane.replaceChildren(unavailable(e)); return; }
  if (!ctx.alive()) return;
  st.seats = (r.data || []).map((x) => x.seat);
  const draw = () => {
    const rows = (r.data || []).slice().sort((a, b) => {
      const va = sortVal(a, st.sort), vb = sortVal(b, st.sort);
      if (st.sort === "seat") return String(va).localeCompare(String(vb)) * st.dir;
      return ((va ?? -1) - (vb ?? -1)) * st.dir;
    });
    const t = r.team || {};
    pane.innerHTML = `<div class="cw-bar"><div class="seg" role="group" aria-label="Period" id="tw-per">${PERIODS.map(([k, l]) => `<button type="button" data-p="${k}" aria-pressed="${k === st.period}">${l}</button>`).join("")}</div>
      <p class="muted cw-how">${esc(r.how || "")}</p></div>
      <div class="kpis four">
        ${kpi("Leads received", num(t.received ?? 0), `${num(t.passed_on ?? 0)} passed on for no claim or no call`)}
        ${kpi("Called in time", pctOr(t.called_in_time_pct), `first call ${minOr(t.median_first_call_min)} (median)`)}
        ${kpi("Briefs on time", pctOr(t.briefs?.on_time_pct), `${num(t.briefs?.missed ?? 0)} missed`)}
        ${kpi("Warnings", num(t.warnings?.active ?? 0), `${num(t.warnings?.excused ?? 0)} excused`)}
      </div>
      <section class="card flush rise"><div class="card-h"><div><h2>Scorecards</h2><div class="card-sub">Tap a name for that salesman's to-dos and warnings. Tap a column to sort.</div></div></div>
      ${rows.length ? `<div class="scroll-x"><table class="tbl sc-tbl"><thead><tr>${COLS.map(([k, l]) => `<th scope="col"><button type="button" class="th-sort" data-sort="${k}" aria-sort="${st.sort === k ? (st.dir > 0 ? "ascending" : "descending") : "none"}">${esc(l)}${st.sort === k ? icon(st.dir > 0 ? "up" : "down", "") : ""}</button></th>`).join("")}</tr></thead>
      <tbody>${rows.map((x) => `<tr class="lb-row" tabindex="0" role="button" data-seat="${esc(x.seat)}" aria-label="Open ${esc(x.seat)}">
        <td><div class="who2"><span class="cell-main"><b>${esc(x.seat)}</b><small>${flagChip(x.flag)}${x.off_today ? `<span class="badge">Off today</span>` : ""}${!x.rated ? `<span class="muted">new, not rated</span>` : ""}</small></span></div></td>
        <td><b>${x.score ?? "—"}</b><small class="muted"> ${x.rated && x.weight ? `${x.weight.toFixed(2)}×` : ""}</small></td>
        <td>${num(x.received ?? 0)}</td><td>${pctOr(x.claim_rate_pct)}</td><td>${x.passed_on ? `<span class="badge warn">${num(x.passed_on)}</span>` : "0"}</td>
        <td>${minOr(x.median_first_call_min)}</td><td>${pctOr(x.called_in_time_pct)}</td><td>${pctOr(x.briefs?.on_time_pct)}</td>
        <td>${num((x.proofs?.approved ?? 0) + (x.proofs?.approved_auto ?? 0) + (x.proofs?.verified ?? 0))}${x.proofs?.pending ? ` <span class="badge info">${num(x.proofs.pending)} waiting</span>` : ""}${(x.proofs?.missed ?? 0) + (x.proofs?.rejected ?? 0) ? ` <span class="badge neg">${num((x.proofs.missed ?? 0) + (x.proofs.rejected ?? 0))}</span>` : ""}</td>
        <td>${x.warnings?.active ? `<span class="badge ${x.flag === "review" ? "neg" : x.flag === "watch" ? "warn" : ""}">${num(x.warnings.active)}</span>` : "0"}</td>
        <td>${num(x.visits_booked ?? 0)}</td><td><b>${num(x.sold ?? 0)}</b></td><td>${pctOr(x.conversion_pct)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${icon("team", "")}<b>No salesmen in the rotation yet</b></div>`}</section>`;
    pane.querySelector("#tw-per").addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (!b) return; st.period = b.dataset.p; teamTab(ctx, pane, st); });
    pane.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.sort; st.dir = st.sort === k ? -st.dir : k === "seat" ? 1 : -1; st.sort = k; draw(); }));
    pane.querySelectorAll(".lb-row").forEach((tr) => {
      const go = () => seatSheet(rows.find((x) => x.seat === tr.dataset.seat), st);
      tr.addEventListener("click", go);
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
  };
  draw();
}

const kpi = (label, val, sub) => `<article class="kpi rise"><div class="kpi-top"><span class="kpi-label">${esc(label)}</span></div><div class="kpi-val">${val}</div><div class="kpi-sub">${esc(sub)}</div></article>`;

async function seatSheet(row, st) {
  if (!row) return;
  const d = openSheet({ title: row.seat, sub: `${PERIODS.find(([k]) => k === st.period)?.[1] || ""} · score ${row.score ?? "—"} · ${esc(shareText(row))}`, wide: true,
    body: `${scoreBlock(row)}<div id="ss-todo" class="cw-sub"><div class="skel h60"></div></div><h3 class="eyebrow cw-sub">Warnings, last 30 days</h3><div id="ss-warn"><div class="skel h60"></div></div>` });
  try {
    const t = await desk.get("acc/todo", { seat: row.seat });
    d.el.querySelector("#ss-todo").innerHTML = t.items?.length ? todoStrip({ items: t.items }, { max: 12, seatLabel: row.seat }) : `<p class="muted">${icon("check", "")} Nothing due right now.</p>`;
  } catch (e) { d.el.querySelector("#ss-todo").replaceChildren(unavailable(e)); }
  const from = new Date(deskNow() + 5.5 * 36e5 - 30 * 864e5).toISOString().slice(0, 10);
  try {
    const w = await desk.get("acc/warnings", { seat: row.seat, from });
    d.el.querySelector("#ss-warn").innerHTML = warnList(w.data || [], { manage: can("acc.warnings.manage") });
    bindExcuse(d.el, () => seatSheet(row, st));
  } catch (e) { d.el.querySelector("#ss-warn").replaceChildren(unavailable(e)); }
}

function bindExcuse(root, after) {
  root.querySelectorAll("[data-excuse]").forEach((b) => b.addEventListener("click", () => {
    const wid = +b.dataset.excuse, seat = b.dataset.seat;
    if (seat && seat === state.user?.engine_name && !state.user?.is_super_admin) { toast("Nobody excuses a warning on his own seat. Ask another manager or the owner.", "err"); return; }
    const f = formDrawer({ title: "Excuse this warning", sub: `${esc(seat || "")}. It stays in the ledger, marked excused, and stops counting.`, submit: "Excuse", ok: "",
      fields: [{ name: "reason", label: "Reason", type: "textarea", required: true, full: true, placeholder: "e.g. The customer had switched phones", hint: "5 to 300 letters." }],
      onSubmit: async (v) => {
        const reason = (v.reason || "").trim();
        if (reason.length < 5 || reason.length > 300) { const e = new Error("5 to 300 letters."); e.fields = { reason: "5 to 300 letters." }; throw e; }
        await desk.post(`acc/warnings/${wid}/excuse`, { reason });
        desk.done("Warning excused"); after();
      } });
    f.el.classList.add("sheet");
  }));
}

async function warningsTab(ctx, pane, st) {
  const f = st.wf;
  const range30 = () => {
    const now = new Date(deskNow() + 5.5 * 36e5);
    if (f.period === "all") return {};
    if (f.period === "month") return range("month");
    if (f.period === "week") return range("week");
    return { from: new Date(now - 30 * 864e5).toISOString().slice(0, 10) };
  };
  let r;
  try { r = await desk.get("acc/warnings", { seat: f.seat, type: f.type, status: f.status === "all" ? "" : f.status, ...range30() }); }
  catch (e) { pane.replaceChildren(unavailable(e)); return; }
  if (!ctx.alive()) return;
  const seats = (await ensureSeats(st)).length ? st.seats : [...new Set((r.data || []).map((w) => w.seat))];
  const c = r.counts || {};
  const byType = Object.entries(c.by_type || {}).filter(([, n]) => n).map(([k, n]) => `<span class="badge">${esc(WARN[k] || k)} ${num(n)}</span>`).join("");
  pane.innerHTML = `<div class="cw-filters">
      <label class="field"><span class="lab">Salesman</span><select class="select" data-f="seat"><option value="">Everyone</option>${seats.map((s) => `<option${s === f.seat ? " selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
      <label class="field"><span class="lab">Type</span><select class="select" data-f="type"><option value="">Every type</option>${Object.entries(WARN).map(([k, l]) => `<option value="${k}"${k === f.type ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <label class="field"><span class="lab">Status</span><select class="select" data-f="status">${[["active", "Active"], ["excused", "Excused"], ["all", "All"]].map(([k, l]) => `<option value="${k}"${k === f.status ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field"><span class="lab">Period</span><select class="select" data-f="period">${[["week", "This week"], ["month", "This month"], ["30", "Last 30 days"], ["all", "Any time"]].map(([k, l]) => `<option value="${k}"${k === f.period ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      ${can("acc.warnings.manage") ? `<button class="btn primary" type="button" id="w-add">${icon("plus")}Add warning</button>` : ""}
    </div>
    <div class="cw-counts"><span><b>${num(c.total ?? 0)}</b> warnings</span><span><b>${num(c.active ?? 0)}</b> active</span><span><b>${num(c.excused ?? 0)}</b> excused</span>${byType ? `<span class="chips">${byType}</span>` : ""}</div>
    <section class="card rise">${warnList(r.data || [], { manage: can("acc.warnings.manage") })}${(r.total || 0) > (r.data || []).length ? `<p class="muted small-note">Showing the newest ${num((r.data || []).length)} of ${num(r.total)}.</p>` : ""}</section>`;
  pane.querySelectorAll("[data-f]").forEach((s) => s.addEventListener("change", () => { f[s.dataset.f] = s.value; warningsTab(ctx, pane, st); }));
  bindExcuse(pane, () => warningsTab(ctx, pane, st));
  pane.querySelector("#w-add")?.addEventListener("click", () => {
    const fd = formDrawer({ title: "Add a warning", sub: "It shows on the salesman's scorecard and counts for 30 days. No effect on pay.", submit: "Add warning", ok: "",
      fields: [
        { name: "seat", label: "Salesman", type: "select", required: true, full: true, options: seats, value: f.seat || "" },
        { name: "category", label: "What for", type: "select", required: true, full: true, options: Object.entries(CATEGORY) },
        { name: "reason", label: "Reason", type: "textarea", required: true, full: true, hint: "5 to 300 letters. The salesman sees it." },
        { name: "lead_id", label: "Lead number (optional)", type: "number", min: 1, full: true, placeholder: "e.g. 1042" },
      ],
      onSubmit: async (v) => {
        const reason = (v.reason || "").trim();
        if (reason.length < 5 || reason.length > 300) { const e = new Error("5 to 300 letters."); e.fields = { reason: "5 to 300 letters." }; throw e; }
        await desk.post("acc/warnings", { seat: v.seat, category: v.category, reason, ...(v.lead_id ? { lead_id: Math.round(+v.lead_id) } : {}) });
        desk.done("Warning added"); warningsTab(ctx, pane, st);
      } });
    fd.el.classList.add("sheet");
  });
}

async function nightTab(ctx, pane) {
  let r;
  try { r = await desk.get("acc/night-queue"); }
  catch (e) { pane.replaceChildren(unavailable(e)); return; }
  if (!ctx.alive()) return;
  const leads = r.leads || [];
  const waiting = leads.filter((l) => !l.seat), out = leads.filter((l) => l.seat);
  const prev = Object.entries(r.preview || {}).map(([tier, seats]) => {
    const n = Object.values(seats).reduce((a, b) => a + b, 0);
    return `<li><b>${num(n)} ${esc(tier.split(" ")[0])} lead${n === 1 ? "" : "s"}</b> → ${Object.entries(seats).map(([s, k]) => `${esc(s)} ${num(k)}`).join(", ")}</li>`;
  }).join("");
  const row = (l) => `<li><a href="#/lead/${+l.id}"><span class="nq-id">#${+l.id}</span><span class="grow"><b>${esc(l.tier || "")}</b><small>came in ${esc(deskTime(l.ts))}</small></span>${l.seat ? `<span class="nq-seat">${esc(l.seat)}<small>${l.wave_at ? `${l.announced ? "out at" : "goes out at"} ${esc(deskTime(l.wave_at))}` : ""}</small></span>` : `<span class="badge info">Waiting for opening</span>`}</a></li>`;
  pane.innerHTML = `<section class="card rise"><div class="card-h"><div><h2>Waiting now</h2><div class="card-sub">Leads that came in after closing. Nobody holds them until opening; then they go out by price band and performance, a few at a time.</div></div></div>
      ${waiting.length ? `<ul class="list nq-list">${waiting.map(row).join("")}</ul>` : `<div class="empty small">${icon("check", "")}<b>The night queue is empty</b></div>`}
      ${prev ? `<div class="nq-prev"><span class="eyebrow">At opening, the split will be</span><ul>${prev}</ul></div>` : ""}</section>
    ${out.length ? `<section class="card rise"><div class="card-h"><div><h2>Shared out this morning</h2><div class="card-sub">Each salesman's leads arrive in waves; the claim clock of a later wave starts at its time.</div></div></div><ul class="list nq-list">${out.map(row).join("")}</ul></section>` : ""}`;
}

async function leaveTab(ctx, pane, st) {
  let r;
  try { r = await desk.get("acc/off"); }
  catch (e) { pane.replaceChildren(unavailable(e)); return; }
  if (!ctx.alive()) return;
  const edit = can("acc.reassign");
  pane.innerHTML = `<section class="card rise"><div class="card-h"><div><h2>Who is on leave</h2><div class="card-sub">A salesman on leave gets no new leads and no warnings; his unclaimed leads move on. Weekly days off are in Call rules.</div></div>${edit ? `<div class="act"><button class="btn primary sm" type="button" id="lv-add">${icon("plus")}Add leave</button></div>` : ""}</div>${leaveListHtml(r.data || [], edit)}</section>`;
  pane.querySelector("#lv-add")?.addEventListener("click", async () => openLeaveAdd(await ensureSeats(st), () => leaveTab(ctx, pane, st)));
  pane.querySelectorAll("[data-off-del]").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try { await desk.post(`acc/off/${+b.dataset.offDel}/delete`, {}); desk.done("Leave removed"); leaveTab(ctx, pane, st); }
    catch (e) { b.disabled = false; toast(e.message || "Could not remove it.", "err"); }
  }));
}

/** The rotation seats for the pickers (from the scorecard), loaded once when a tab needs them first. */
async function ensureSeats(st) {
  if (st.seats.length) return st.seats;
  try { st.seats = ((await desk.get("acc/scorecard", range("week"))).data || []).map((x) => x.seat); } catch { /* the picker stays empty */ }
  return st.seats;
}
