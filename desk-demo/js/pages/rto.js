// RTO and papers: the transfer board, the expiry calendar and the document index.
import * as api from "../api.js";
import { get, docUrl } from "../api.js";
import { state, can } from "../state.js";
import { applyDyn, badge, dateFmt, daysUntil, debounce, esc, icon, mount, num, sentence } from "../util.js";
import { bindTabs, formDrawer, openDrawer, openMenu, pageHead, save, tabsHtml, toast } from "../ui.js";
import { card, kpiTile } from "./_shared.js";
import { DOC_LABEL } from "./_docs.js";

const LANES = ["collecting_docs", "docs_complete", "submitted", "fee_paid", "scrutiny", "inspection", "approved", "rc_printed", "rc_dispatched", "rc_received", "handed_over", "blocked"];
const LANE_LABEL = { collecting_docs: "Collecting papers", docs_complete: "Papers complete", submitted: "Submitted", fee_paid: "Fee paid", scrutiny: "Scrutiny", inspection: "Inspection", approved: "Approved", rc_printed: "RC printed", rc_dispatched: "RC dispatched", rc_received: "RC received", handed_over: "Handed over", blocked: "Blocked", closed: "Closed" };
const CHECK_LABEL = (i) => sentence(i);

export async function render(ctx) {
  const res = await get("rto-cases");
  if (!ctx.alive()) return;
  const tab = ctx.query.get("tab") || "board";
  const open = res.data.filter((c) => c.stage !== "closed");
  const late = open.filter((c) => c.overdue).length;
  const soon = open.filter((c) => c.form29_30_days_left != null && c.form29_30_days_left >= 0 && c.form29_30_days_left <= 7).length;
  const tabs = [{ id: "board", label: "Transfer board", n: open.length }, { id: "cal", label: "Expiry calendar" }, ...(can("documents.view") ? [{ id: "docs", label: "Document index" }] : [])];
  mount(ctx.root, pageHead({ title: "RTO and papers", sub: "Every transfer from delivery to the RC in the buyer's hands, and every paper that can expire." })
    + `<div class="kpis four">${[
      kpiTile({ label: "Open transfers", value: open.length, sub: `${res.total - open.length} closed` }),
      kpiTile({ label: "Overdue (30+ days)", value: late, neg: late > 0, sub: "Open more than 30 days. Call the agent" }),
      kpiTile({ label: "Form 29/30 due in 7 days", value: soon, sub: "The 14-day clock from delivery" }),
      kpiTile({ label: "Blocked", value: res.by_stage.blocked || 0, neg: (res.by_stage.blocked || 0) > 0, sub: "Waiting on something outside" }),
    ].join("")}</div>
    <section class="card flush rise sec-gap">${tabsHtml(tabs, tab, "RTO sections")}<div id="pane"></div></section>`);
  const pane = ctx.root.querySelector("#pane");
  const show = async (t) => {
    pane.innerHTML = `<div class="skel card"></div>`;
    try {
      if (t === "board") { pane.innerHTML = boardHtml(res); bindBoard(pane, res, ctx); }
      else if (t === "cal") await calPane(pane);
      else await docsPane(pane);
    } catch (e) { pane.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not load this section.</b><span class="muted">${esc(e.message)}</span></div></div>`; }
  };
  bindTabs(ctx.root, (t) => { history.replaceState(null, "", `#/rto?tab=${t}`); show(t); });
  await show(tab);
  const want = ctx.query.get("case"); if (want) openCase(+want, ctx);
}

// ------------------------------------------------------------------ board
async function moveTo(c, stage, ctx) {
  if (stage === c.stage) return;
  if (stage === "blocked") {
    formDrawer({ title: "Mark as blocked", sub: `${esc(c.car?.reg_no || "")}. Say what it is waiting on so the next person knows.`, submit: "Mark blocked", ok: "Marked blocked", fields: [{ name: "blocked_reason", label: "What is blocking it?", type: "textarea", required: true, full: true }],
      onSubmit: async (v) => { await api.patch(`rto-cases/${c.id}`, { stage, blocked_reason: v.blocked_reason }); ctx.refresh(); } });
    return;
  }
  const ok = await save(null, () => api.patch(`rto-cases/${c.id}`, { stage }), { ok: `Moved to ${LANE_LABEL[stage]}` });
  if (ok) ctx.refresh();
}

function boardHtml(res) {
  const by = {}; LANES.forEach((l) => (by[l] = []));
  res.data.forEach((c) => { if (by[c.stage]) by[c.stage].push(c); });
  const closed = res.data.filter((c) => c.stage === "closed").length;
  const manage = can("rto.manage");
  const rail = `<div class="stage-rail" role="group" aria-label="Jump to a stage"><button class="rail-btn" type="button" data-rail="-1" aria-label="Scroll the board left">${icon("left")}</button><div class="chips">${LANES.map((l) => `<button type="button" class="chip${l === "blocked" && by[l].length ? " hot" : ""}${by[l].length ? "" : " zero"}" data-jump="${l}">${esc(LANE_LABEL[l])}<b>${by[l].length}</b></button>`).join("")}</div><button class="rail-btn" type="button" data-rail="1" aria-label="Scroll the board right">${icon("right")}</button></div>`;
  const picker = `<select class="input stage-select" aria-label="Jump to a stage"><option value="">Jump to a stage…</option>${LANES.map((l) => `<option value="${l}">${esc(LANE_LABEL[l])} (${by[l].length})</option>`).join("")}</select>`;
  return `<div class="pad-box">${rail}${picker}<div class="kanban-wrap"><div class="kanban" role="list">${LANES.map((l) => `<section class="lane${by[l].length ? "" : " is-empty"}" role="listitem" data-lane="${l}" aria-label="${esc(LANE_LABEL[l])}, ${by[l].length} cases"><div class="lane-h"><h3>${esc(LANE_LABEL[l])}</h3><span class="n">${by[l].length}</span></div><div class="lane-body">${by[l].map((c) => card1(c, manage)).join("")}</div></section>`).join("")}</div><div class="fade fl" aria-hidden="true"></div><div class="fade fr" aria-hidden="true"></div></div>
    <p class="note sec">${icon("info", "")}<span>${manage ? "Drag a card to move it, or use its Move button. " : ""}${num(closed)} closed cases are not shown. Cards with a red edge are past 30 days.</span></p></div>`;
}
function card1(c, manage) {
  const left = c.form29_30_days_left;
  return `<article class="k-card${c.overdue ? " late" : ""}" tabindex="0" ${manage ? 'draggable="true"' : ""} data-case="${c.id}"><div class="k-top"><b>${esc(c.car?.reg_no || c.car?.stock_no)}</b><span class="muted">${num(c.days_open)} d</span></div><div class="car">${esc(c.car?.make || "")} ${esc(c.car?.model || "")}</div>
    <div class="foot"><span class="meter" role="img" aria-label="${c.papers_pct}% of papers received"><i data-w="${c.papers_pct}" data-c="${c.papers_pct >= 90 ? "var(--pos)" : c.papers_pct >= 60 ? "var(--warn)" : "var(--neg)"}"></i></span><span>${c.papers_pct}%</span>${left != null && c.stage !== "handed_over" ? `<span class="clock ${left < 0 ? "late" : left <= 7 ? "soon" : ""}">${icon("clock", "")}${left < 0 ? Math.abs(left) + " d late" : left + " d"}</span>` : ""}</div></article>`;
}
function bindBoard(pane, res, ctx) {
  applyDyn(pane);
  const kb = pane.querySelector(".kanban"), wrap = pane.querySelector(".kanban-wrap");
  const fades = () => { wrap.classList.toggle("more-l", kb.scrollLeft > 4); wrap.classList.toggle("more-r", kb.scrollLeft + kb.clientWidth < kb.scrollWidth - 4); };
  kb.addEventListener("scroll", fades, { passive: true }); window.addEventListener("resize", fades); fades();
  pane.querySelector(".stage-rail").addEventListener("click", (e) => {
    const j = e.target.closest("[data-jump]"), r = e.target.closest("[data-rail]");
    if (j) { const lane = kb.querySelector(`[data-lane="${j.dataset.jump}"]`); kb.scrollTo({ left: lane.offsetLeft - kb.offsetLeft - 4, behavior: "smooth" }); }
    if (r) kb.scrollBy({ left: +r.dataset.rail * Math.max(280, kb.clientWidth * 0.7), behavior: "smooth" });
  });
  pane.querySelector(".stage-select").addEventListener("change", (e) => { const lane = e.target.value && kb.querySelector(`[data-lane="${e.target.value}"]`); if (lane) kb.scrollTo({ left: lane.offsetLeft - kb.offsetLeft - 4, behavior: "smooth" }); });
  const byId = (id) => res.data.find((c) => c.id === id);
  pane.addEventListener("click", (e) => {
    const k = e.target.closest("[data-case]"); if (k) openCase(+k.dataset.case, ctx);
  });
  pane.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("[data-case]")) openCase(+e.target.dataset.case, ctx); });
  let dragged = null;
  pane.addEventListener("dragstart", (e) => { const k = e.target.closest("[data-case]"); if (!k) return; dragged = byId(+k.dataset.case); k.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(dragged.id)); });
  pane.addEventListener("dragend", (e) => { e.target.closest?.("[data-case]")?.classList.remove("drag"); pane.querySelectorAll(".lane.over").forEach((l) => l.classList.remove("over")); });
  pane.addEventListener("dragover", (e) => { const l = e.target.closest("[data-lane]"); if (l && dragged) { e.preventDefault(); pane.querySelectorAll(".lane.over").forEach((x) => x !== l && x.classList.remove("over")); l.classList.add("over"); } });
  pane.addEventListener("drop", (e) => { const l = e.target.closest("[data-lane]"); if (l && dragged) { e.preventDefault(); const c = dragged; dragged = null; moveTo(c, l.dataset.lane, ctx); } });
}

async function openCase(id, ctx) {
  const d = openDrawer({ title: "RTO case", sub: "Loading…", body: `<div class="skel card"></div>`, wide: true });
  let c; try { c = await get(`rto-cases/${id}`); } catch (e) { d.setBody(`<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not open this case.</b><span class="muted">${esc(e.message)}</span></div></div>`); return; }
  d.setTitle(c.car?.reg_no || c.car?.stock_no || "RTO case"); d.setSub(`${esc(c.car?.make || "")} ${esc(c.car?.model || "")} · ${esc(sentence(c.kind))} · ${badge(LANE_LABEL[c.stage] || sentence(c.stage), c.stage === "blocked" ? "neg" : c.stage === "closed" ? "pos" : "")}`);
  const kv = (l, v) => `<div><dt>${l}</dt><dd>${v}</dd></div>`;
  const manage = can("rto.manage");
  const items = c.checklist || [];
  d.setBody(`<dl class="dl dl-3">${kv("Opened", dateFmt(c.opened_on))}${kv("Days open", num(c.days_open))}${kv("Form 29/30 clock", c.form29_30_days_left == null ? "—" : c.form29_30_days_left < 0 ? `${Math.abs(c.form29_30_days_left)} days late` : `${c.form29_30_days_left} days left`)}${c.rto_office ? kv("RTO office", esc(c.rto_office)) : ""}${c.vahan_application_no ? kv("Vahan application", `<span class="mono">${esc(c.vahan_application_no)}</span>`) : ""}${c.submitted_on ? kv("Submitted", dateFmt(c.submitted_on)) : ""}${c.rc_received_on ? kv("RC received", dateFmt(c.rc_received_on)) : ""}${c.handed_over_on ? kv("Handed over", dateFmt(c.handed_over_on)) : ""}</dl>
    ${c.blocked_reason ? `<div class="callout neg sec">${icon("alert", "")}<div><b>Blocked</b><p>${esc(c.blocked_reason)}</p></div></div>` : ""}
    ${items.length ? `<div class="sec"><div class="sec-h"><h3>Papers checklist</h3><span class="act muted">${c.papers_pct}% received</span></div>${items.map((i) => `<div class="chk"><span>${esc(CHECK_LABEL(i.item))}${i.required ? "" : ' <span class="faint">(optional)</span>'}</span>${manage ? `<div class="seg" role="group" aria-label="${esc(CHECK_LABEL(i.item))}">${[["pending", "Pending"], ["received", "Received"], ["na", "Not needed"]].map(([v, l]) => `<button type="button" aria-pressed="${i.status === v}" data-item="${esc(i.item)}" data-v="${v}">${l}</button>`).join("")}</div>` : badge(sentence(i.status), i.status === "received" ? "pos" : "")}</div>`).join("")}</div>` : ""}
    ${(c.stage_history || []).length ? `<div class="sec"><div class="sec-h"><h3>History</h3></div><ul class="timeline">${c.stage_history.map((h) => `<li><b>${esc(LANE_LABEL[h.to_stage] || sentence(h.to_stage))}</b><span class="when">${esc(h.ts.slice(0, 16))}${h.note ? " · " + esc(h.note) : ""}</span></li>`).join("")}</ul></div>` : ""}
    ${c.deal_id && can("deals.view") ? `<div class="sec"><a class="btn" href="#/deals?deal=${c.deal_id}">${icon("tag")}Open the deal</a></div>` : ""}`);
  if (manage) { d.setFoot(`<button class="btn" type="button" id="mv">${icon("repeat")}Move to another stage</button>`); d.el.querySelector("#mv").addEventListener("click", (e) => openMenu(e.currentTarget, [{ heading: "Move to" }, ...[...LANES.filter((l) => l !== "blocked"), "closed", "blocked"].map((l) => ({ label: LANE_LABEL[l], checked: l === c.stage, onClick: () => { d.close(true); moveTo(c, l, ctx); } }))], { align: "right" })); }
  d.el.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-item]"); if (!b) return;
    const ok = await save(null, () => api.patch(`rto-cases/${id}/checklist/${encodeURIComponent(b.dataset.item)}`, { status: b.dataset.v }), { ok: "Saved" });
    if (ok) { d.close(true); openCase(id, ctx); ctx.refresh(); }
  });
}

// ------------------------------------------------------------------ expiry calendar
async function calPane(pane) {
  const [cars, cons, rto] = await Promise.all([can("stock.view") ? get("cars", { page_size: 200, scope: "all" }).catch(() => ({ data: [] })) : { data: [] }, can("stock.manage") ? get("consignments").catch(() => ({ data: [] })) : { data: [] }, can("rto.view") ? get("rto-cases").catch(() => ({ data: [] })) : { data: [] }]);
  const live = cars.data.filter((c) => ["incoming", "refurb", "available", "booked"].includes(c.status));
  const ev = [];
  live.forEach((c) => { if (c.insurance_expiry) ev.push({ d: c.insurance_expiry, t: `Insurance · ${c.stock_no}`, k: "ins", href: `#/inventory?car=${c.id}` }); if (c.puc_expiry) ev.push({ d: c.puc_expiry, t: `PUC · ${c.stock_no}`, k: "puc", href: `#/inventory?car=${c.id}` }); });
  cons.data.filter((k) => k.status === "active" && k.agreement_expiry).forEach((k) => ev.push({ d: k.agreement_expiry, t: `Park-N-Sell ends · ${k.car?.stock_no || ""}`, k: "pns", href: `#/pns` }));
  rto.data.filter((r) => r.stage !== "closed" && r.invoice_date && r.stage !== "handed_over").forEach((r) => { const due = new Date(Date.parse(r.invoice_date.slice(0, 10)) + 14 * 864e5).toISOString().slice(0, 10); ev.push({ d: due, t: `Form 29/30 · ${r.car?.stock_no || ""}`, k: "rto", href: `#/rto?case=${r.id}` }); });
  let ym = state.today.slice(0, 7);
  const draw = () => {
    const [y, m] = ym.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)), lead = (first.getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = []; for (let i = 0; i < lead; i++) cells.push(null); for (let d = 1; d <= days; d++) cells.push(d); while (cells.length % 7) cells.push(null);
    const by = {}; ev.forEach((e) => { if (e.d.startsWith(ym)) (by[+e.d.slice(8, 10)] ||= []).push(e); });
    const cls = (e) => { const left = daysUntil(e.d, state.today); return left < 0 ? "neg" : left <= 15 ? "warn" : ""; };
    pane.innerHTML = `<div class="pad-box"><div class="cal-nav"><button class="icon-btn" type="button" id="cp" aria-label="Previous month">${icon("left")}</button><div class="cal-title" role="status">${new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</div><button class="icon-btn" type="button" id="cn" aria-label="Next month">${icon("right")}</button><span class="muted grow right">${num(ev.length)} dates tracked</span></div>
      <div class="cal sec" role="grid">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="dow" role="columnheader">${d}</div>`).join("")}${cells.map((d) => d == null ? `<div class="day out"></div>` : `<div class="day${`${ym}-${String(d).padStart(2, "0")}` === state.today ? " today" : ""}" role="gridcell"><span class="d">${d}</span>${(by[d] || []).slice(0, 3).map((e) => `<a class="ev ${cls(e)}" href="${e.href}" title="${esc(e.t)}">${esc(e.t)}</a>`).join("")}${(by[d] || []).length > 3 ? `<span class="faint">+${by[d].length - 3} more</span>` : ""}</div>`).join("")}</div>
      <div class="legend sec"><span><i data-c="var(--neg)"></i>Already expired</span><span><i data-c="var(--warn)"></i>Within 15 days</span><span><i data-c="var(--info)"></i>Later</span></div></div>`;
    applyDyn(pane);
    pane.querySelector("#cp").addEventListener("click", () => { const [yy, mm] = ym.split("-").map(Number); ym = mm === 1 ? `${yy - 1}-12` : `${yy}-${String(mm - 1).padStart(2, "0")}`; draw(); });
    pane.querySelector("#cn").addEventListener("click", () => { const [yy, mm] = ym.split("-").map(Number); ym = mm === 12 ? `${yy + 1}-01` : `${yy}-${String(mm + 1).padStart(2, "0")}`; draw(); });
  };
  draw();
}

// ------------------------------------------------------------------ document index
async function docsPane(pane) {
  const [docs, cars] = await Promise.all([get("documents", { page_size: 500 }), can("stock.view") ? get("cars", { page_size: 200, scope: "all" }).catch(() => ({ data: [] })) : { data: [] }]);
  const carNo = Object.fromEntries(cars.data.map((c) => [c.id, `${c.stock_no} ${c.make} ${c.model}`]));
  let q = "", ent = "all";
  const types = [...new Set(docs.data.map((d) => d.entity_type))];
  pane.innerHTML = `<div class="toolbar pad-top"><div class="seg" id="ents" role="group" aria-label="Papers for"></div><label class="search"><span class="sr">Search papers</span>${icon("search", "")}<input class="input" id="q" type="search" placeholder="Search car, paper type or file name"></label></div><div id="tb"></div>`;
  const draw = () => {
    pane.querySelector("#ents").innerHTML = [["all", "All", docs.data.length], ...types.map((t) => [t, sentence(t), docs.data.filter((d) => d.entity_type === t).length])].map(([k, l, n]) => `<button type="button" aria-pressed="${ent === k}" data-e="${k}">${esc(l)}<span class="n">${n}</span></button>`).join("");
    const needle = q.toLowerCase();
    const list = docs.data.filter((d) => (ent === "all" || d.entity_type === ent) && (!needle || `${DOC_LABEL[d.doc_type] || d.doc_type} ${d.display_name} ${carNo[d.entity_id] || ""}`.toLowerCase().includes(needle)));
    pane.querySelector("#tb").innerHTML = list.length ? `<div class="scroll-x"><table class="tbl left"><thead><tr><th>Paper</th><th>Belongs to</th><th>Valid until</th><th>Added</th><th></th></tr></thead><tbody>${list.slice(0, 200).map((d) => { const left = d.valid_until ? daysUntil(d.valid_until, state.today) : null; return `<tr><td>${esc(DOC_LABEL[d.doc_type] || sentence(d.doc_type))}<span class="sub">${esc(d.display_name)}</span></td><td>${d.entity_type === "car" ? `<a href="#/inventory?car=${d.entity_id}">${esc(carNo[d.entity_id] || "Car " + d.entity_id)}</a>` : d.entity_type === "deal" && can("deals.view") ? `<a href="#/deals?deal=${d.entity_id}">Deal ${d.entity_id}</a>` : `${esc(sentence(d.entity_type))} ${d.entity_id}`}</td><td>${d.valid_until ? `${dateFmt(d.valid_until, false)} ${left < 0 ? badge("Expired", "neg") : left <= 30 ? badge(left + " d", "warn") : ""}` : "—"}</td><td>${dateFmt(d.uploaded_at, false)}</td><td class="r"><a class="btn sm" href="${docUrl(d.uuid)}" data-dl="${esc(d.uuid)}" download>${icon("download")}Download</a></td></tr>`; }).join("")}</tbody></table></div>${list.length > 200 ? `<p class="note pad-box">${icon("info", "")}Showing 200 of ${num(list.length)}. Search to narrow it down.</p>` : ""}` : `<div class="empty">${icon("docs", "")}<b>No papers match</b></div>`;
  };
  draw();
  pane.addEventListener("click", (e) => { const b = e.target.closest("[data-e]"); if (b) { ent = b.dataset.e; draw(); } });
  pane.querySelector("#q").addEventListener("input", debounce((e) => { q = e.target.value; draw(); }, 150));
}
