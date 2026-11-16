// Maintenance: where every stock car is today, the checklist and issues on each, the proof, and the manager's check queue.
// #/maint (all cars), #/maint?tab=queue (waiting for check), #/maint/<car id> (one car).
import { ApiError, DEMO } from "../api.js";
import { state, can, hasMoney } from "../state.js";
import { applyDyn, badge, dateFmt, esc, icon, inr, mount, num, statusBadge } from "../util.js";
import { bindTabs, formDrawer, pageHead, tabsHtml } from "../ui.js";
import { openSheet } from "../desk.js";
import { kpiTile } from "./_shared.js";
import { INSPECTION_TYPES, PAY_MODES, PLACES, PLACE_WORD, TYPE_WORD, bindZoom, camBtn, errBox, evHtml, evOne, failToast, hm, io, okToast, onFiles, placeText, scoreTag, sendFile, taskChip, when } from "./_maint.js";

const FILTERS = [["all", "All"], ["not_updated", "Not updated today"], ["open_issues", "Open issues"], ["waiting_check", "Waiting for check"], ["ready", "Ready"]];
const QUICK = ["showroom", "yard", "workshop"];

export async function render(ctx) {
  if (ctx.id) return carView(ctx, +ctx.id);
  return home(ctx);
}

// ================================================================== home: tiles, filters, one card per car
async function home(ctx) {
  const verify = can("maint.verify");
  const tab = verify && ctx.query.get("tab") === "queue" ? "queue" : "cars";
  const fq = ctx.query.get("f") || ctx.query.get("filter");          // ?filter= is the evening reminder push's link
  let filter = FILTERS.some(([k]) => k === fq) ? fq : "all";
  const sum = await io.get("maint/summary");
  if (!ctx.alive()) return;
  const tabs = [{ id: "cars", label: "Cars", n: sum.in_stock }, { id: "queue", label: "Waiting for check", n: sum.waiting_check }];
  mount(ctx.root, pageHead({ title: "Maintenance", sub: "Say where each car is before you leave. Tick off work with a photo as proof." })
    + (can("carreq.work") && !DEMO ? `<div id="cr-home"></div>` : "")
    + `<div id="tiles">${tilesHtml(sum)}</div>`
    + (verify ? `<section class="card flush rise sec-gap mt-shell">${tabsHtml(tabs, tab, "Maintenance sections")}<div id="pane" class="mt-pane"></div></section>` : `<div id="pane" class="sec"></div>`));
  const pane = ctx.root.querySelector("#pane");
  const refreshTiles = async () => {
    try {
      const s = await io.get("maint/summary"); ctx.root.querySelector("#tiles").innerHTML = tilesHtml(s); applyDyn(ctx.root.querySelector("#tiles"));
      for (const [t, n] of [["cars", s.in_stock], ["queue", s.waiting_check]]) { const b = ctx.root.querySelector(`#tab-${t} .n`); if (b) b.textContent = n; }   // the tab counts too
    } catch { /* the tiles stay as they were */ }
  };
  const show = (t) => { if (t === "queue") queuePane(pane, ctx, refreshTiles); else carsPane(pane, ctx, filter, (f) => { filter = f; history.replaceState(null, "", `#/maint${f === "all" ? "" : "?f=" + f}`); }, refreshTiles); };
  if (verify) bindTabs(ctx.root, (t) => { history.replaceState(null, "", t === "queue" ? "#/maint?tab=queue" : "#/maint"); show(t); });
  bindZoom(ctx.root);
  show(tab);
  const crHost = ctx.root.querySelector("#cr-home");       // get a car ready: the salesmen's requests, soonest first
  if (crHost) import("./carreq.js").then((m) => m.section(crHost, ctx, { title: "Car requests" })).catch(() => { crHost.innerHTML = ""; });
}

function tilesHtml(s) {
  const t = [
    kpiTile({ label: "Not updated today", value: s.not_updated, neg: s.not_updated > 0, sub: "No location yet today" }),
    kpiTile({ label: "Open issues", value: s.open_issues, sub: "Still to be fixed" }),
    kpiTile({ label: "Waiting for check", value: s.waiting_check, sub: "Ticked, not yet checked" }),
    kpiTile({ label: "Ready for sale", value: s.ready, sub: `of ${num(s.in_stock)} cars in stock` }),
  ];
  return `<div class="kpis four mt-tiles">${t.join("")}</div>${s.week_spend != null ? `<p class="mt-week">${icon("wallet", "")}<span>Spent on cars this week</span><b>${inr(s.week_spend)}</b></p>` : ""}`;
}

// ------------------------------------------------------------------ the car cards
async function carsPane(pane, ctx, filter, setFilter, refreshTiles) {
  const chips = () => `<div class="mt-chips" role="group" aria-label="Show cars">${FILTERS.map(([k, l]) => `<button type="button" class="mt-chip" aria-pressed="${k === filter}" data-f="${k}">${esc(l)}</button>`).join("")}</div>`;
  pane.innerHTML = `${chips()}<p class="mt-count muted" id="cnt" role="status"></p><div id="list" class="mt-list"><div class="skel card"></div></div>`;
  let cars = [];
  const list = pane.querySelector("#list"), cnt = pane.querySelector("#cnt");
  const draw = () => {
    cnt.textContent = cars.length ? `${cars.length} ${cars.length === 1 ? "car" : "cars"}${filter === "all" ? "" : ` in “${FILTERS.find(([k]) => k === filter)[1]}”`}` : "";
    list.innerHTML = cars.length ? cars.map(carCard).join("") : `<div class="empty">${icon("car", "")}<b>${filter === "all" ? "No cars in stock yet" : "No cars here"}</b><p>${{ all: "Cars show up here as soon as they are added to stock.", not_updated: "Every car has a location for today. Well done.", open_issues: "No car has an open issue.", waiting_check: "Nothing is waiting for a manager's check.", ready: "No car is fully checked yet. A car is ready when every checklist item is checked and no issue is open." }[filter]}</p></div>`;
    applyDyn(list);
  };
  const load = async () => {
    list.setAttribute("aria-busy", "true");
    try { const r = await io.get("maint/cars", { filter }); if (!ctx.alive()) return; cars = r.data || r.cars || []; draw(); }
    catch (e) { list.innerHTML = errBox(e.message, "Could not load the cars."); }
    list.removeAttribute("aria-busy");
  };
  pane.querySelector(".mt-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]"); if (!b || b.dataset.f === filter) return;
    filter = b.dataset.f; setFilter(filter);
    pane.querySelectorAll(".mt-chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    load();
  });
  const after = (c) => (u) => { Object.assign(c, u); redraw(c); refreshTiles(); };
  const redraw = (c) => { const n = list.querySelector(`[data-car="${c.car_id}"]`); if (n) { n.outerHTML = carCard(c); applyDyn(list); } };
  list.addEventListener("click", async (e) => {
    const q = e.target.closest("[data-q]"), more = e.target.closest("[data-more]"); if (!q && !more) return;
    const id = +e.target.closest("[data-car]").dataset.car, c = cars.find((x) => x.car_id === id); if (!c) return;
    if (more || (q.getAttribute("aria-pressed") === "true")) { openWhere(c, after(c)); return; }
    q.disabled = true;
    const u = await saveWhere(c, q.dataset.q, {}, after(c));
    if (u) after(c)(u); else if (q.isConnected) q.disabled = false;
  });
  await load();
}

/** POST the location. Returns the fields to merge into the card, or null when it failed. */
async function saveWhere(c, place, extra, onSaved = () => {}) {
  try {
    const body = { place, ...(extra.place_detail ? { place_detail: extra.place_detail } : {}), ...(extra.note ? { note: extra.note } : {}) };
    await io.post(`maint/cars/${c.car_id}/location`, body);
    okToast(`${c.stock_no}: ${PLACE_WORD[place]}`, extra.place_detail ? null : { label: "Add detail", onClick: () => openWhere({ ...c, location: place, updated_today: true }, onSaved) });
    return { location: place, place_detail: extra.place_detail || null, location_date: state.today, updated_today: true };
  } catch (e) { failToast(e); return null; }
}

/** The quick-set strip: three one-tap places and a fourth button for the rest. cur is only marked once it has been said today. */
export function whereStrip(c) {
  const today = c.updated_today, cur = today ? c.location : null;
  const other = cur && !QUICK.includes(cur);
  return `<div class="mt-quick" role="group" aria-label="Where is ${esc(c.stock_no)} now?"><span class="mt-q-l">Where is it now?</span><div class="mt-q-btns">${QUICK.map((p) => `<button type="button" class="mt-q" data-q="${p}" aria-pressed="${cur === p}">${PLACE_WORD[p]}</button>`).join("")}<button type="button" class="mt-q more" data-more aria-pressed="${!!other}" aria-haspopup="dialog">${other ? esc(PLACE_WORD[cur]) : "More…"}</button></div></div>`;
}

function carCard(c) {
  const stripe = !c.updated_today ? "late" : c.waiting_check ? "wait" : c.ready ? "ready" : "";
  const flag = !c.updated_today ? `<span class="mt-flag late">${icon("alert", "")}Not updated today</span>` : c.ready ? `<span class="mt-flag ready">${icon("check", "")}Ready for sale</span>` : "";
  const where = c.location ? placeText(c.location, c.place_detail) : "Not set yet";
  const segs = Array.from({ length: c.checklist_total || 0 }, (_, i) => `<i${i < c.checklist_done ? ' class="on"' : ""}></i>`).join("");
  return `<article class="mt-car ${stripe}" data-car="${c.car_id}">
    <a class="mt-main" href="#/maint/${c.car_id}" aria-label="Open ${esc(c.stock_no)}, ${esc(c.title)}">
      <div class="mt-top"><span class="mt-stock">${esc(c.stock_no)}</span>${c.reg_tail ? `<span class="mt-reg">${esc(c.reg_tail)}</span>` : ""}${flag}</div>
      <h3 class="mt-title">${esc(c.title)}</h3>
      <p class="mt-where">${icon("pin", "")}<span class="mt-w"><b>${esc(where)}</b>${c.updated_today || c.location_date ? `<em>${c.updated_today ? "said today" : "last said " + esc(when(c.location_date, false))}</em>` : ""}</span></p>
      <div class="mt-prog"><span class="mt-segs" role="img" aria-label="${c.checklist_done} of ${c.checklist_total} checklist items done">${segs}</span><b>${c.checklist_done}/${c.checklist_total}</b></div>
      <div class="mt-tags">${c.open_issues ? badge(`${c.open_issues} open ${c.open_issues === 1 ? "issue" : "issues"}`, "neg") : badge("No open issues", "")}${c.waiting_check ? badge(`${c.waiting_check} waiting for check`, "warn") : ""}${c.inspection ? scoreTag(c.inspection) : ""}</div>
    </a>
    ${can("maint.work") ? whereStrip(c) : ""}
  </article>`;
}

// ------------------------------------------------------------------ "Where is it now?" in full: all seven places, a detail line, a note
export function openWhere(c, onSaved) {
  const cur = c.updated_today || c.location ? c.location : null;
  let pick = cur || "";
  const d = openSheet({ title: "Where is it now?", sub: `${esc(c.stock_no)} · ${esc(c.title)}`,
    body: `<form id="wh" novalidate><div class="mt-places" role="group" aria-label="Place">${PLACES.map(([k, l]) => `<button type="button" class="mt-place" aria-pressed="${k === pick}" data-p="${k}">${esc(l)}</button>`).join("")}</div>
      <div class="field sec"><label for="wh-d">Where exactly? <span class="faint">(optional)</span></label><input class="input" id="wh-d" name="d" autocomplete="off" maxlength="80" placeholder="Row B, or the workshop's name and area" value="${esc(c.place_detail || "")}"></div>
      <div class="field sec"><label for="wh-n">Note <span class="faint">(optional)</span></label><input class="input" id="wh-n" name="n" autocomplete="off" maxlength="160" placeholder="Anything the next person should know"></div>
      <div class="err" id="wh-e" role="alert" hidden></div></form>`,
    foot: `<button class="btn" type="button" data-x>Cancel</button><button class="btn primary" type="submit" form="wh">Save place</button>` });
  d.el.querySelector("[data-x]").addEventListener("click", () => d.close());
  const radios = () => d.el.querySelectorAll(".mt-place");
  d.el.querySelector(".mt-places").addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (!b) return; pick = b.dataset.p; radios().forEach((r) => r.setAttribute("aria-pressed", String(r === b))); d.el.querySelector("#wh-e").hidden = true; });
  d.el.querySelector("#wh").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget, err = d.el.querySelector("#wh-e");
    if (!pick) { err.textContent = "Choose a place first."; err.hidden = false; return; }
    if (pick === "other" && !f.d.value.trim()) { err.textContent = "Say where, for example the garage's name."; err.hidden = false; f.d.focus(); return; }
    const btn = d.el.querySelector('button[type="submit"]'); btn.disabled = true;
    const u = await saveWhere(c, pick, { place_detail: f.d.value.trim(), note: f.n.value.trim() });
    if (u) { d.close(); onSaved && onSaved(u); } else btn.disabled = false;
  });
}

// ================================================================== the manager's queue
async function queuePane(host, ctx, refreshTiles) {
  const pane = document.createElement("div");               // its own container: opening the tab again never stacks click listeners
  host.replaceChildren(pane);
  pane.innerHTML = `<div class="skel card"></div>`;
  let tasks = [];
  try { const r = await io.get("maint/queue"); tasks = r.tasks || r.data || []; } catch (e) { pane.innerHTML = errBox(e.message, "Could not load the queue."); return; }
  if (!ctx.alive()) return;
  const draw = () => {
    pane.innerHTML = tasks.length ? `<p class="mt-count muted" role="status">${tasks.length} ${tasks.length === 1 ? "job" : "jobs"} to look at. Open the photos, then approve or send it back.</p><ul class="mt-queue">${tasks.map((t) => `<li class="mt-q-item" data-task="${t.id}">
        <div class="mt-q-head"><a class="mt-stock" href="#/maint/${t.car_id}">${esc(t.stock_no)}</a><span>${esc(t.car_title || "")}</span></div>
        <h4>${esc(t.title)}</h4>
        <p class="mt-meta">${t.kind === "issue" ? "Issue" : "Checklist"} · ${esc(who(t, "done_by"))} · ${esc(when(t.done_at))}${t.amount != null ? ` · spent ${inr(t.amount)}` : ""}</p>
        ${t.note ? `<p class="mt-note">${esc(t.note)}</p>` : ""}${evHtml(t.evidence)}
        <div class="mt-act"><button type="button" class="btn pos mt-big" data-ok="${t.id}">${icon("check")}Approve</button><button type="button" class="btn mt-big" data-back="${t.id}">${icon("left")}Send back</button></div></li>`).join("")}</ul>`
      : `<div class="empty">${icon("shieldcheck", "")}<b>Nothing is waiting</b><p>When someone ticks a job off with a photo, it lands here for you to check.</p></div>`;
  };
  draw();
  pane.addEventListener("click", async (e) => {
    const ok = e.target.closest("[data-ok]"), back = e.target.closest("[data-back]"); if (!ok && !back) return;
    const id = +(ok || back).dataset[ok ? "ok" : "back"], t = tasks.find((x) => x.id === id); if (!t) return;
    const gone = () => { tasks = tasks.filter((x) => x.id !== id); draw(); refreshTiles(); };
    if (back) { sendBack(t, gone); return; }
    ok.disabled = true;
    try { await io.post(`maint/tasks/${id}/verify`, { ok: true }); okToast(`Approved: ${t.title}`); gone(); } catch (er) { failToast(er); ok.disabled = false; }
  });
}

/** Send a ticked job back with the reason the person will read. */
function sendBack(t, onDone) {
  formDrawer({ title: "Send it back", sub: esc(t.title), submit: "Send back", ok: false,
    fields: [{ name: "reason", label: "What is wrong or missing?", type: "textarea", required: true, full: true, placeholder: "For example: the photo is dark, or the bill is not for this car" }],
    onSubmit: async (v) => { if (!String(v.reason || "").trim()) throw fieldErr("reason", "Say what is wrong or missing, so it can be fixed.");
      await io.post(`maint/tasks/${t.id}/verify`, { ok: false, reason: v.reason }); okToast("Sent back with your reason"); onDone(); } }).el.classList.add("sheet");
}

// ================================================================== one car
async function carView(ctx, id) {
  let d;
  try { d = await io.get(`maint/cars/${id}`); } catch (e) { ctx.root.innerHTML = `<a class="crumbs" href="#/maint">${icon("left", "")}All cars</a>${errBox(e.message, "Could not open this car.")}`; return; }
  if (!ctx.alive()) return;
  const tab = ["checklist", "issues", "inspections", "spend"].includes(ctx.query.get("tab")) ? ctx.query.get("tab") : "checklist";
  const work = can("maint.work"), verify = can("maint.verify"), inspect = can("maint.inspect");
  const car = d.car;

  const draw = (cur) => {
    const check = d.tasks.filter((t) => t.kind === "checklist"), issues = d.tasks.filter((t) => t.kind === "issue");
    const done = check.filter((t) => t.status === "verified").length;
    const openIssues = issues.filter((t) => t.status !== "verified").length;
    const ready = check.length > 0 && done === check.length && !openIssues;
    const here = d.locations[0], saidToday = here && here.date === state.today;
    const c = { ...car, car_id: car.car_id, updated_today: !!saidToday, location: here ? here.place : car.location, place_detail: here ? here.place_detail : car.place_detail };
    const tabs = [{ id: "checklist", label: "Checklist", n: `${check.filter((t) => t.status !== "open").length}/${check.length}` }, { id: "issues", label: "Issues", n: openIssues }, { id: "inspections", label: "Inspections", n: d.inspections.length }, { id: "spend", label: "Places and spend" }];
    mount(ctx.root, `<a class="crumbs mt-back" href="#/maint">${icon("left", "")}All cars</a>`
      + pageHead({ title: car.stock_no })
      + `<section class="card rise mt-now" id="now"><p class="mt-carline"><b>${esc(car.title)}</b>${car.reg_tail ? `<span class="mt-reg">${esc(car.reg_tail)}</span>` : ""}${statusBadge(car.status)}${ready ? badge("Ready for sale", "pos") : ""}</p><p class="mt-where big">${icon("pin", "")}<span class="mt-w"><b>${esc(c.location ? placeText(c.location, c.place_detail) : "Not set yet")}</b>${here ? `<em>${saidToday ? "said today, " + esc(hm(here.at)) + (here.by ? " by " + esc(here.by) : "") : "last said " + esc(when(here.date, false))}</em>` : ""}</span></p>
        ${work ? whereStrip(c) : ""}
        <dl class="dl mt-specs">${car.kms_at_intake != null ? `<div><dt>Kms</dt><dd>${num(car.kms_at_intake)}</dd></div>` : ""}${car.fuel ? `<div><dt>Fuel</dt><dd>${esc(cap(car.fuel))}</dd></div>` : ""}${car.transmission ? `<div><dt>Gearbox</dt><dd>${esc(cap(car.transmission))}</dd></div>` : ""}${car.colour ? `<div><dt>Colour</dt><dd>${esc(car.colour)}</dd></div>` : ""}</dl></section>`
      + reportHtml(check)
      + `<section class="card flush rise sec-gap mt-shell">${tabsHtml(tabs, cur, "Car sections")}<div id="pane" class="mt-pane"></div></section>`);
    ctx.root.querySelector("[data-rep-start]")?.addEventListener("click", () => startInspection(id, check.length && check.every((t) => t.status !== "open") ? "pre_sale" : "purchase"));
    const pane = ctx.root.querySelector("#pane");
    const show = (t) => {
      pane.innerHTML = t === "checklist" ? tasksHtml(check, "checklist") : t === "issues" ? issuesHtml(issues) : t === "inspections" ? inspectionsHtml() : spendHtml();
      applyDyn(pane);
    };
    bindTabs(ctx.root, (t) => { cur = t; history.replaceState(null, "", `#/maint/${id}${t === "checklist" ? "" : "?tab=" + t}`); show(t); });
    show(cur);
    ctx.root.querySelector('.tabs [aria-selected="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
    const strip = ctx.root.querySelector("#now");
    strip.addEventListener("click", async (e) => {
      const q = e.target.closest("[data-q]"), more = e.target.closest("[data-more]"); if (!q && !more) return;
      const after = async () => { d = await io.get(`maint/cars/${id}`); if (ctx.alive()) draw(cur); };
      if (more || q.getAttribute("aria-pressed") === "true") { openWhere(c, after); return; }
      q.disabled = true;
      const u = await saveWhere(c, q.dataset.q, {}, after);
      if (u) after(); else q.disabled = false;
    });
    pane.addEventListener("click", (e) => paneClick(e, cur));
  };

  // the Classic Auto inspection report, on top where maintenance sees it (owner, 15 Nov 2026: "once the entire thing is done,
  // they should have an option to make the report"): made from here, continued while it is a draft, opened once final
  const reportHtml = (check) => {
    const draft = d.inspections.find((i) => i.status === "draft"), last = d.inspections.find((i) => i.status === "final");
    if (!inspect && !last) return "";
    const ticked = check.length > 0 && check.every((t) => t.status !== "open");
    const make = ticked && !draft && !last;            // the checklist is done and there is no report yet: that is the next step
    const go = draft && inspect ? `<a class="btn primary mt-big" href="#/maint-inspect/${draft.id}">${icon("edit")}Continue the inspection report</a>`
      : inspect ? `<button type="button" class="btn ${make ? "primary" : ""} mt-big" data-rep-start>${icon("docs")}Make the inspection report</button>` : "";
    const view = last ? `<a class="btn ${draft ? "" : "primary"} mt-big" href="#/maint-report/${last.id}">${icon("print")}View, print or share the report</a>` : "";
    const say = draft && inspect ? "The inspection report is started. Finish it to get the score and the report you can print."
      : last ? `Last report: ${TYPE_WORD[last.type] || last.type}, ${dateFmt(last.date)}.`
      : ticked && inspect ? "Every checklist item is ticked. Now make the Classic Auto inspection report of the whole car."
      : "When the work is done, make the Classic Auto inspection report: the whole car checked, a score out of 10 and a report you can print.";
    return `<section class="card rise sec-gap mt-rep${make && inspect ? " on" : ""}" aria-label="Inspection report"><div class="mt-rep-h">${icon("docs", "")}<p>${esc(say)}</p>${last ? scoreTag(last) : ""}</div><div class="mt-rep-btns">${last && !draft ? view + go : go + view}</div></section>`;
  };

  const tasksHtml = (list, kind) => `<div class="mt-pad">${kind === "checklist" ? `<div class="mt-prog wide"><span class="mt-segs" role="img" aria-label="${list.filter((t) => t.status === "verified").length} of ${list.length} items checked">${list.map((t) => `<i class="${t.status === "verified" ? "on" : t.status === "done" ? "mid" : ""}"></i>`).join("")}</span><b>${list.filter((t) => t.status !== "open").length}/${list.length} ticked</b></div>` : ""}
    ${list.length ? `<ul class="mt-tasks">${list.map(taskRow).join("")}</ul>` : `<div class="empty">${icon("check", "")}<b>Nothing here</b></div>`}</div>`;
  const issuesHtml = (list) => `<div class="mt-pad">${work ? `<button type="button" class="btn mt-big mt-add" data-addissue>${icon("plus")}Add an issue</button>` : ""}
    ${list.length ? `<ul class="mt-tasks">${list.map(taskRow).join("")}</ul>` : `<div class="empty">${icon("shieldcheck", "")}<b>No issues on this car</b><p>Add one when you see something that needs fixing. An inspection adds its findings here too.</p></div>`}</div>`;

  const taskRow = (t) => {
    const sent = t.status === "open" && t.reject_reason;
    const src = t.source === "inspection" ? "From the inspection" : t.source === "manual" ? "Added by hand" : "";
    return `<li class="mt-task ${t.status}${sent ? " back" : ""}" data-task="${t.id}">
      <div class="mt-task-h"><span class="mt-st ${t.status}" aria-hidden="true">${t.status === "open" ? "" : icon(t.status === "done" ? "clock" : "check", "")}</span>
        <div><h4>${esc(t.title)}</h4>${t.note ? `<p class="mt-note">${esc(t.note)}</p>` : ""}<p class="mt-meta">${taskChip(t)}${src ? `<span>${src}</span>` : ""}${t.amount != null ? `<span>Spent ${inr(t.amount)}</span>` : ""}</p></div></div>
      ${sent ? `<div class="callout warn mt-sent">${icon("alert", "")}<div><b>Sent back</b><p>${esc(t.reject_reason)}</p></div></div>` : ""}
      ${t.status !== "open" ? `<p class="mt-meta mt-by">${t.status === "verified" ? `Checked by ${esc(who(t, "verified_by"))}, ${esc(when(t.verified_at))}. ` : ""}Ticked by ${esc(who(t, "done_by"))}, ${esc(when(t.done_at))}.</p>` : ""}
      ${evHtml(t.evidence)}
      <div class="mt-act">${t.status === "open" && work ? `<button type="button" class="btn primary mt-big mt-tick" data-tick="${t.id}">${icon("check")}${sent ? "Tick again" : "Tick"}</button>` : ""}
        ${t.status === "done" && verify ? `<button type="button" class="btn pos mt-big" data-ok="${t.id}">${icon("check")}Approve</button><button type="button" class="btn mt-big" data-back="${t.id}">${icon("left")}Send back</button>` : ""}
        ${t.status === "done" && !verify ? `<span class="mt-wait">Waiting for the manager's check</span>` : ""}</div></li>`;
  };

  const inspectionsHtml = () => `<div class="mt-pad">${inspect ? `<button type="button" class="btn primary mt-big mt-add" data-start>${icon("plus")}Start an inspection</button>` : ""}
    ${d.inspections.length ? `<ul class="mt-insp">${d.inspections.map((i) => `<li><div><b>${esc(TYPE_WORD[i.type] || i.type)}</b><span class="mt-meta">${esc(dateFmt(i.date))}${i.inspector ? " · " + esc(i.inspector) : ""}</span></div>${scoreTag(i)}
        <a class="btn ${i.status === "draft" ? "primary" : ""}" href="#/${i.status === "draft" ? "maint-inspect" : "maint-report"}/${i.id}">${icon(i.status === "draft" ? "edit" : "docs")}${i.status === "draft" ? (inspect ? "Continue" : "See draft") : "Open report"}</a></li>`).join("")}</ul>`
      : `<div class="empty">${icon("docs", "")}<b>No inspection yet</b><p>An inspection checks the whole car, gives it a score out of 10 and makes a report you can print.</p></div>`}</div>`;

  const spendHtml = () => {
    const paid = d.tasks.filter((t) => t.amount != null).sort((a, b) => String(b.done_at).localeCompare(String(a.done_at)));
    return `<div class="mt-pad"><dl class="dl mt-sp"><div><dt>${hasMoney() ? "Entered by you" : "You entered"}</dt><dd class="big">${inr(d.spending.mine_total)}</dd></div>${d.spending.total != null ? `<div><dt>All costs on this car</dt><dd class="big">${inr(d.spending.total)}</dd></div>` : ""}</dl>
      ${paid.length ? `<div class="sec"><div class="sec-h"><h3>Where the money went</h3></div><ul class="mt-spend">${paid.map((t) => `<li><span>${esc(t.title)}<small>${esc(when(t.done_at, false))} · ${esc(who(t, "done_by"))}</small></span><b>${inr(t.amount)}</b></li>`).join("")}</ul></div>` : ""}
      <div class="sec"><div class="sec-h"><h3>Where it has been</h3></div>${d.locations.length ? `<ul class="timeline">${d.locations.map((l) => `<li><b>${esc(placeText(l.place, l.place_detail))}</b><span class="when">${esc(when(l.at || l.date))}${l.by ? " · " + esc(l.by) : ""}${l.note ? " · " + esc(l.note) : ""}</span></li>`).join("")}</ul>` : `<p class="muted">No place has been said for this car yet.</p>`}</div></div>`;
  };

  const reload = async (cur) => { d = await io.get(`maint/cars/${id}`); if (ctx.alive()) draw(cur); };
  function paneClick(e, cur) {
    const tick = e.target.closest("[data-tick]"), ok = e.target.closest("[data-ok]"), back = e.target.closest("[data-back]");
    if (tick) { const t = d.tasks.find((x) => x.id === +tick.dataset.tick); if (t) openTick(t, car, () => reload(cur)); return; }
    if (ok) {
      const t = d.tasks.find((x) => x.id === +ok.dataset.ok); ok.disabled = true;
      io.post(`maint/tasks/${t.id}/verify`, { ok: true }).then(() => { okToast(`Approved: ${t.title}`); reload(cur); }, (er) => { failToast(er); ok.disabled = false; });
      return;
    }
    if (back) { const t = d.tasks.find((x) => x.id === +back.dataset.back); if (t) sendBack(t, () => reload(cur)); return; }
    if (e.target.closest("[data-addissue]")) { addIssue(id, () => reload("issues")); return; }
    if (e.target.closest("[data-start]")) startInspection(id);
  }
  bindZoom(ctx.root);
  draw(tab);
}
/** The person's name: done_by/verified_by are user ids; the names come in done_by_name/verified_by_name. */
const who = (t, k) => t[`${k}_name`] || "";
/** A form error shown under one field (the shared form says "Enter a <label>" for a bare "required", which reads oddly here). */
const fieldErr = (name, msg) => new ApiError(400, "validation", msg, { [name]: msg });
const cap = (s) => String(s).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function addIssue(carId, done) {
  formDrawer({ title: "Add an issue", sub: "Something on this car that needs fixing.", submit: "Add issue", ok: false,
    fields: [{ name: "title", label: "What needs fixing?", required: true, full: true, placeholder: "For example: scratch on the rear bumper" }, { name: "note", label: "More detail (optional)", type: "textarea", full: true }],
    onSubmit: async (v) => { if (!String(v.title || "").trim()) throw fieldErr("title", "Say what needs fixing.");
      await io.post(`maint/cars/${carId}/tasks`, { title: v.title, ...(v.note ? { note: v.note } : {}) }); okToast("Issue added"); done(); } }).el.classList.add("sheet");
}

function startInspection(carId, first = "purchase") {
  let type = first;
  const d = openSheet({ title: "Start an inspection", sub: "You can stop at any time. Your answers are saved as you go.",
    body: `<div class="mt-types" role="group" aria-label="Kind of inspection">${INSPECTION_TYPES.map(([k, l, h]) => `<button type="button" class="mt-type" aria-pressed="${k === type}" data-t="${k}"><b>${esc(l)}</b><span>${esc(h)}</span></button>`).join("")}</div><div class="err" id="si-e" role="alert" hidden></div>`,
    foot: `<button class="btn" type="button" data-x>Cancel</button><button class="btn primary" type="button" id="si-go">Start</button>` });
  d.el.querySelector("[data-x]").addEventListener("click", () => d.close());
  d.el.querySelector(".mt-types").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; type = b.dataset.t; d.el.querySelectorAll(".mt-type").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); });
  d.el.querySelector("#si-go").addEventListener("click", async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    try { const r = await io.post(`maint/cars/${carId}/inspections`, { type }); d.close(true); location.hash = `#/maint-inspect/${(r.inspection || r).id}`; }
    catch (er) { const x = d.el.querySelector("#si-e"); x.textContent = er.message; x.hidden = false; btn.disabled = false; }
  });
}

// ================================================================== the Tick sheet: photo of the work, money (optional), bill
function openTick(task, car, onDone) {
  const ev = (task.evidence || []).filter((e) => e.url || e.kind !== "bill").map((e) => ({ ...e }));
  // needs = what the server still wants: after a send-back the old photo and bill no longer count, so only new ones do.
  const needs = task.needs || { photo: !ev.some((e) => e.kind === "work_photo"), bill: !ev.some((e) => e.kind === "bill") };
  const added = [];
  const pending = [];                                      // uploads in flight or failed: {key, kind, name, error, file}
  let money = false;
  const d = openSheet({ title: `Tick: ${task.title}`, sub: `${esc(car.stock_no)} · ${esc(car.title)}`,
    body: `<form id="tk" novalidate>
      <section class="mt-step"><h3><span class="mt-n">1</span>Photo of the work</h3><p class="hint">Take it after the work is done. One clear photo is enough.</p>
        <div id="tk-work"></div><div class="mt-cam-row">${camBtn({ label: "Take a photo", attrs: 'data-kind="work_photo"', cls: "mt-big", gallery: true })}${task.kind === "issue" ? camBtn({ label: "Add a ‘before’ photo", attrs: 'data-kind="before_photo"', cls: "ghost sm" }) : ""}</div></section>
      <section class="mt-step"><h3><span class="mt-n">2</span>Did you spend money on this?</h3>
        <div class="seg" role="group" aria-label="Money spent"><button type="button" aria-pressed="true" data-money="0">No</button><button type="button" aria-pressed="false" data-money="1">Yes</button></div>
        <div id="tk-money" class="mt-money" hidden>
          <div class="field"><label for="tk-amt">Amount (₹)</label><input class="input big num" id="tk-amt" name="amount" inputmode="numeric" autocomplete="off" placeholder="0"><div class="hint" id="tk-amt-h" aria-live="polite"></div></div>
          <div class="field"><label for="tk-ven">Paid to <span class="faint">(optional)</span></label><input class="input" id="tk-ven" name="vendor" autocomplete="off" placeholder="Shop or person"></div>
          <div class="field"><label for="tk-pay">Paid by</label><select class="select" id="tk-pay" name="payment_mode">${PAY_MODES.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></div>
          <div class="field"><span class="lab">Photo or PDF of the bill</span><div id="tk-bill"></div><div class="mt-cam-row">${camBtn({ label: "Photograph the bill", attrs: 'data-kind="bill"', gallery: true, pdf: true })}</div></div></div></section>
      <div class="field"><label for="tk-note">Note <span class="faint">(optional)</span></label><input class="input" id="tk-note" name="note" autocomplete="off" maxlength="200" placeholder="Anything the manager should know"></div>
      <p class="mt-need" id="tk-need" role="status"></p><div class="form-err" id="tk-err" role="alert" hidden></div></form>`,
    foot: `<button class="btn" type="button" data-x>Cancel</button><button class="btn primary" type="submit" form="tk" id="tk-go">${icon("check")}Mark done</button>` });
  const q = (s) => d.el.querySelector(s);
  d.el.querySelector("[data-x]").addEventListener("click", () => d.close());
  bindZoom(d.el);

  const draw = () => {
    for (const [slot, kinds] of [["#tk-work", ["work_photo", "before_photo"]], ["#tk-bill", ["bill"]]]) {
      const box = q(slot); if (!box) continue;
      const have = ev.filter((e) => kinds.includes(e.kind)), wait = pending.filter((p) => kinds.includes(p.kind));
      box.innerHTML = (have.length || wait.length) ? `<div class="mt-evs">${have.map(evOne).join("")}${wait.map((p) => `<div class="mt-ev wait${p.error ? " bad" : ""}">${p.error ? `<span>${esc(p.error)}</span><button type="button" class="btn sm" data-retry="${p.key}">Try again</button>` : `<span class="spin"></span><span>Sending…</span>`}</div>`).join("")}</div>` : "";
    }
    const amt = Math.round(Number(q("#tk-amt")?.value || 0));
    const hasWork = !needs.photo || added.some((e) => e.kind === "work_photo"), hasBill = !needs.bill || added.some((e) => e.kind === "bill");
    const busy = pending.some((p) => !p.error);
    let need = "";
    if (!hasWork) need = "Take a photo of the work to finish.";
    else if (money && !(amt > 0)) need = "Enter the amount you spent, or choose No.";
    else if (money && !hasBill) need = "Add the bill to finish.";
    else if (busy) need = "Sending the photo…";
    q("#tk-need").textContent = need; q("#tk-need").hidden = !need;
    q("#tk-go").disabled = !!need;
    q("#tk-amt-h").textContent = amt > 0 ? `₹${new Intl.NumberFormat("en-IN").format(amt)}` : "";
  };
  const send = async (p) => {
    p.error = null; draw();
    try {
      const r = await sendFile(`maint/tasks/${task.id}/evidence`, p.file, { kind: p.kind });
      pending.splice(pending.indexOf(p), 1);
      ev.push(r.evidence || r); added.push(r.evidence || r);
    } catch (e) { p.error = e.message || "Did not send"; }
    draw();
  };
  onFiles(d.el, "input[data-kind]", async (file, inp) => { const p = { key: "u" + Math.random().toString(36).slice(2, 7), kind: inp.dataset.kind, file }; pending.push(p); await send(p); });
  d.el.addEventListener("click", (e) => {
    const r = e.target.closest("[data-retry]"); if (r) { const p = pending.find((x) => x.key === r.dataset.retry); if (p) send(p); return; }
    const m = e.target.closest("[data-money]"); if (m) {
      money = m.dataset.money === "1";
      d.el.querySelectorAll("[data-money]").forEach((b) => b.setAttribute("aria-pressed", String(b === m)));
      q("#tk-money").hidden = !money; if (money) q("#tk-amt").focus(); draw();
    }
  });
  q("#tk-amt").addEventListener("input", draw);
  q("#tk").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget, err = q("#tk-err"), btn = q("#tk-go"); err.hidden = true;
    const body = {};
    if (money) { body.amount = Math.round(Number(f.amount.value)); if (f.vendor.value.trim()) body.vendor = f.vendor.value.trim(); body.payment_mode = f.payment_mode.value; }
    if (f.note.value.trim()) body.note = f.note.value.trim();
    btn.disabled = true;
    try { await io.post(`maint/tasks/${task.id}/done`, body); okToast(can("maint.verify") ? "Ticked. It is in the check queue." : "Ticked. The manager will check it."); d.close(true); onDone(); }
    catch (er) { err.textContent = er.message || "Could not tick it. Try again."; err.hidden = false; btn.disabled = false; }
  });
  draw();
}
