// Get a car ready (app/carreq.py): a salesman says "customer at 4 pm for this car"; maintenance owns the job, a driver brings
// the car, maintenance marks it "Car is down and ready". #/carreq (the list: a driver's home, "My car requests" for a salesman,
// every request for the manager and the owners), #/carreq/new?for=<car id> (the form), #/carreq/<id> (one request and its thread).
// Mobile-first: big buttons, one tap per step. No row-level click handler: every card's buttons and links work on their own.
import * as api from "../api.js";
import { can, homeKind } from "../state.js";
import { badge, debounce, esc, icon, mount, nowIstStr, nowMs } from "../util.js";
import { confirmDialog, formDrawer, openMenu, pageHead, toast } from "../ui.js";

const POLL_MS = 15000;
const JOBS = [["bring", "Bring to the showroom"], ["wash", "Wash"], ["polish", "Polish"], ["fuel", "Fuel"], ["charge", "Charge the battery"], ["other", "Other"]];
const JOB_WORD = Object.fromEntries(JOBS);
const WHERE = [["showroom", "Showroom"], ["yard", "Yard"], ["workshop", "Workshop"], ["with_someone", "With someone"], ["other", "Somewhere else"]];
const WHERE_WORD = Object.fromEntries(WHERE);
const STEP_BTN = { on_way: ["On my way", "send"], picked_up: ["Picked up the car", "car"], arrived: ["Reached the showroom", "pin"] };
const EVENT_WORD = { created: "Asked for the car", accepted: "Took the job", driver: "Sent a driver", any_driver: "Left it for any driver", on_way: "On the way to the car", picked_up: "Picked up the car", arrived: "Reached the showroom", ready: "Car is down and ready", cannot: "Can't get the car", cancelled: "Cancelled the request" };
const TONE = { open: "warn", accepted: "info", moving: "info", arrived: "info", ready: "pos", cannot: "neg", cancelled: "" };

const ms = (ts) => Date.parse(String(ts || "").replace(" ", "T") + "+05:30");
const hm = (ts) => String(ts || "").slice(11, 16);
const today = () => nowIstStr().slice(0, 10);
const dayWord = (ts) => { const d = String(ts || "").slice(0, 10); if (d === today()) return "Today"; const t = new Date(Date.parse(today() + "T00:00:00Z") + 864e5).toISOString().slice(0, 10); return d === t ? "Tomorrow" : d; };
/** "Today 16:00" as markup: the day word is its own text, so Hindi and Hinglish can swap it. Never holds typed text. */
const whenHtml = (ts) => `<span>${esc(dayWord(ts))}</span> ${esc(hm(ts))}`;
function left(ts) {
  const m = Math.round((ms(ts) - nowMs()) / 60000);
  const a = Math.abs(m), h = Math.floor(a / 60), mm = a % 60;
  if (m >= 0) return { late: false, text: h ? `in ${h} h ${mm} min` : `in ${a} min` };
  return { late: true, text: h ? `late by ${h} h ${mm} min` : `late by ${a} min` };
}
const errHtml = (msg, head = "Could not load the car requests.") => `<div class="err-box" role="alert">${icon("alert", "")}<div><b>${esc(head)}</b><span class="muted">${esc(msg || "")}</span></div></div>`;
const listHome = () => (homeKind() === "driver" ? "#/home" : "#/carreq");
const isDriver = () => homeKind() === "driver";
const minute = () => Math.floor(nowMs() / 60000);        // part of each redraw's signature: the countdown moves on every minute

export async function render(ctx) {
  if (ctx.id === "new") return form(ctx);
  if (/^\d+$/.test(ctx.id || "")) return detail(ctx, +ctx.id);
  return listView(ctx);
}

// ================================================================== one card (the list, the maintenance and salesman homes)
function clock(r) {
  if (r.status === "ready") return `<span class="cr-clock ok">${icon("check", "")}<span>Ready at ${esc(hm(r.ready_at))}</span></span>`;
  if (r.status === "cannot" || r.status === "cancelled") return "";
  const l = left(r.ready_by);
  return `<span class="cr-clock${l.late ? " late" : ""}">${icon("clock", "")}<span>Ready by ${esc(hm(r.ready_by))}</span> · <span>${esc(l.text)}</span></span>`;
}
function jobsHtml(r) {
  return `<ul class="cr-jobs">${r.jobs.map((j) => `<li>${esc(JOB_WORD[j] || j)}${j === "other" && r.other_text ? `: <span translate="no">${esc(r.other_text)}</span>` : ""}</li>`).join("")}</ul>`;
}
function whereHtml(r) {
  return `<span>${esc(WHERE_WORD[r.car_where] || r.car_where)}</span>${r.where_note ? ` · <span translate="no">${esc(r.where_note)}</span>` : ""}`;
}
function buttons(r, can_, big = false) {
  const list = [];                                     // [action, label, icon, step]; the first one is the loud one
  if (can_.accept) list.push(["accept", "Accept the job", "check"]);
  (can_.steps || []).slice(0, 1).forEach((s) => list.push(["step", STEP_BTN[s][0], STEP_BTN[s][1], s]));
  if (can_.assign) list.push(["assign", r.driver_name ? "Change driver" : "Send a driver", "users"]);
  if (can_.ready) list.push(["ready", "Car is down and ready", "shieldcheck"]);
  const html = list.map(([a, label, ic, s], i) => `<button class="btn cr-act${big ? " big" : ""}${i === 0 ? " primary" : ""}" type="button" data-act="${a}"${s ? ` data-step="${s}"` : ""} data-id="${r.id}">${icon(ic)}${esc(label)}</button>`);
  if (can_.cannot) html.push(`<button class="btn cr-act cr-quiet${big ? " big" : ""}" type="button" data-act="cannot" data-id="${r.id}">${icon("alert")}Can't get it</button>`);
  return html.join("");
}
function card(r, { withActions = true } = {}) {
  const who = [r.requested_by_name ? ["Asked by", r.requested_by_name] : null, r.driver_name ? ["Driver", r.driver_name] : null].filter(Boolean);
  return `<article class="cr-card s-${r.status}${r.overdue ? " late" : ""}" data-req="${r.id}">
    <div class="cr-top"><a class="cr-title" href="#/carreq/${r.id}"><b translate="no">${esc(r.car_title)}</b><span class="cr-meta" translate="no">${esc([r.stock_no, r.reg_tail, r.colour].filter(Boolean).join(" · "))}</span></a>${badge(r.overdue ? "Late" : r.status_label, r.overdue ? "neg" : TONE[r.status])}</div>
    <div class="cr-times">${clock(r)}<span class="cr-cust">${icon("user", "")}<span>Customer at ${esc(hm(r.customer_at))}</span> <span>${esc(dayWord(r.customer_at))}</span></span></div>
    ${jobsHtml(r)}
    <p class="cr-where">${icon("pin", "")}<span>${whereHtml(r)}</span></p>
    ${r.status === "cannot" && r.cannot_reason ? `<p class="cr-why">${icon("alert", "")}<span translate="no">${esc(r.cannot_reason)}</span></p>` : ""}
    ${who.length ? `<p class="cr-meta cr-who">${who.map(([l, n]) => `<span>${esc(l)}</span> <span translate="no">${esc(n)}</span>`).join(" · ")}</p>` : ""}
    <div class="cr-acts">${withActions && r.can ? buttons(r, r.can) : ""}<a class="btn cr-act cr-quiet" href="#/carreq/${r.id}">${icon("chat")}Messages</a></div>
  </article>`;
}

// the actions, shared by the list, the homes and the request page. after(detail) redraws whatever showed it.
async function act(btn, r, drivers, after) {
  const a = btn.dataset.act, id = r.id;
  const run = async (path, body) => {
    btn.disabled = true;
    try { const res = await api.post(`carreq/${id}/${path}`, body || {}); await after(res); return res; }
    catch (e) { toast(e.message, "err"); btn.disabled = false; return null; }
  };
  if (a === "accept") { if (await run("accept")) toast("Job taken. The salesman is told.", "ok"); return; }
  if (a === "step") { const res = await run("step", { step: btn.dataset.step }); if (res) toast(btn.dataset.step === "arrived" ? "Done. Maintenance and the salesman are told." : "Done", "ok"); return; }
  if (a === "ready") {
    if (!(await confirmDialog({ title: "Car is down and ready?", text: "The salesman gets a notification that the car is ready for his customer.", confirmLabel: "Yes, it is ready" }))) return;
    if (await run("ready")) toast("The salesman is told: car is down and ready.", "ok");
    return;
  }
  if (a === "cancel") {
    if (!(await confirmDialog({ title: "Cancel this request?", text: "Maintenance and the driver stop working on it.", confirmLabel: "Cancel the request", danger: true }))) return;
    if (await run("cancel")) toast("Cancelled", "ok");
    return;
  }
  if (a === "cannot") {
    formDrawer({ title: "Can't get the car", sub: "a partner is told at once, with your reason, to sort out where the car is and when it will come.", submit: "Send", ok: "Sent to a partner",
      fields: [{ name: "reason", label: "Why can't it come?", type: "textarea", required: true, full: true, placeholder: "e.g. Workshop closed till Monday, keys with the owner, battery dead" }],
      onSubmit: async (v) => { const res = await api.post(`carreq/${id}/cannot`, { reason: v.reason || "" }); await after(res); return res; } });
    return;
  }
  if (a === "assign") {
    let list = drivers;
    if (!list) { try { list = (await api.get(`carreq/${id}`)).drivers || []; } catch (e) { toast(e.message, "err"); return; } }
    openMenu(btn, [{ heading: "Which driver?" },
      ...list.map((d) => ({ label: d.name, checked: r.driver_user_id === d.id, onClick: () => run("driver", { driver_user_id: d.id }).then((x) => x && toast("Driver told", "ok")) })),
      { label: "Any driver", checked: !r.driver_user_id, onClick: () => run("driver", { driver_user_id: null }) },
      ...(list.length ? [] : [{ heading: "No driver login yet. the owner can add one in Users and access." }])]);
  }
}

/** A box of open car requests for a home page (maintenance, salesman). opts.create: show the Get car ready button. */
export async function section(host, ctx, { title = "Car requests", create = false } = {}) {
  let res;
  try { res = await api.get("carreq", null, { background: true }); } catch { host.innerHTML = ""; return; }
  if (!ctx.alive()) return;
  let last = "";
  const draw = () => {
    const sig = minute() + JSON.stringify(res.requests); if (sig === last) return; last = sig;
    const n = res.requests.length;
    host.innerHTML = `<section class="cr-sec sec-gap"><div class="sec-h"><h2>${esc(title)}</h2>${n ? `<span class="badge ${res.requests.some((r) => r.overdue) ? "neg" : "warn"}">${n} open</span>` : ""}<span class="act"><a class="link-btn" href="#/carreq">See all</a></span></div>
      ${create ? `<a class="btn primary cr-new" href="#/carreq/new">${icon("car")}Get car ready</a>` : ""}
      ${n ? `<div class="cr-list">${res.requests.slice(0, 4).map((r) => card(r)).join("")}</div>${n > 4 ? `<a class="btn cr-more" href="#/carreq">See all ${n}</a>` : ""}` : `<p class="muted cr-none">${icon("check", "")}<span>No car requests open right now.</span></p>`}</section>`;
  };
  draw();
  host.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const r = res.requests.find((x) => x.id === +b.dataset.id); if (!r) return;
    act(b, r, null, async () => { res = await api.get("carreq"); last = ""; draw(); });
  });
  let touched = 0;
  host.addEventListener("pointerdown", () => { touched = Date.now(); }, true);
  const poll = async () => {
    if (!ctx.alive() || !host.isConnected) return;
    if (!document.hidden && Date.now() - touched > 2000) { try { res = await api.get("carreq", null, { background: true }); draw(); } catch { /* next round */ } }
    setTimeout(poll, POLL_MS);
  };
  setTimeout(poll, POLL_MS);
}

// ================================================================== the list
async function listView(ctx) {
  let view = ctx.query.get("view") === "done" ? "done" : "open";
  let res;
  try { res = await api.get("carreq", { view }); } catch (e) { ctx.root.innerHTML = errHtml(e.message); return; }
  if (!ctx.alive()) return;
  const head = res.driver ? pageHead({ title: "My car jobs", sub: "Cars maintenance wants at the showroom. Tap each step as you do it." })
    : res.sees_all ? pageHead({ title: "Car requests", sub: "Every car a salesman wants ready for a customer. Late ones are at the top." })
    : pageHead({ title: "My car requests", sub: "Tell maintenance when your customer comes. They bring the car down and clean it." });
  mount(ctx.root, `<div class="cr">${head}
    ${can("carreq.create") ? `<a class="btn primary cr-new" href="#/carreq/new">${icon("car")}Get car ready</a>` : ""}
    <div class="cd-chips cr-views" role="group" aria-label="Show"><button type="button" class="cd-chip" data-crview="open" aria-pressed="${view === "open"}">Open</button><button type="button" class="cd-chip" data-crview="done" aria-pressed="${view === "done"}">Done</button></div>
    <div id="cr-list" class="cr-list"></div></div>`);
  const root = ctx.root.querySelector(".cr"), list = root.querySelector("#cr-list");
  let last = "";
  const draw = () => {
    const sig = view + minute() + JSON.stringify(res.requests); if (sig === last) return; last = sig;
    list.innerHTML = res.requests.length ? res.requests.map((r) => card(r)).join("")
      : `<div class="empty">${icon("car", "")}<b>${view === "open" ? (res.driver ? "No car jobs for you right now" : "No open car requests") : "Nothing finished in the last 3 days"}</b><p>${view === "open" ? (res.driver ? "When maintenance needs a car brought down, it shows here and your phone rings." : "A request shows here as soon as a salesman sends one.") : ""}</p></div>`;
  };
  draw();
  const load = async (bg = false) => {
    const asked = view;
    const r = await api.get("carreq", { view: asked }, bg ? { background: true } : undefined);
    if (asked !== view || !ctx.alive()) return;              // the person switched Open / Done while this was on its way
    res = r; draw();
  };
  root.addEventListener("click", async (e) => {
    const v = e.target.closest("[data-crview]");
    if (v) {
      if (v.dataset.crview === view) return;
      view = v.dataset.crview;
      root.querySelectorAll("[data-crview]").forEach((x) => x.setAttribute("aria-pressed", String(x === v)));
      history.replaceState(null, "", view === "done" ? "#/carreq?view=done" : (isDriver() ? "#/home" : "#/carreq"));
      try { await load(); } catch (ex) { list.innerHTML = errHtml(ex.message); }
      return;
    }
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const r = res.requests.find((x) => x.id === +b.dataset.id); if (!r) return;
    act(b, r, null, () => load());
  });
  let touched = 0;
  root.addEventListener("pointerdown", () => { touched = Date.now(); }, true);
  const poll = async () => {
    if (!ctx.alive()) return;
    if (!document.hidden && Date.now() - touched > 2000) { try { await load(true); } catch { /* next round */ } }
    setTimeout(poll, POLL_MS);
  };
  setTimeout(poll, POLL_MS);
}

// ================================================================== one request and its thread
function eventHtml(e) {
  if (e.kind === "comment") return `<li class="cr-msg${e.mine ? " mine" : ""}"><span class="cr-by"><span>${esc(e.mine ? "You" : e.by || "")}</span> · ${whenHtml(e.ts)}</span><p translate="no">${esc(e.text)}</p></li>`;
  const extra = e.status === "driver" && e.text ? `: <span translate="no">${esc(e.text)}</span>` : "";
  return `<li class="cr-ev s-${esc(e.status)}"><span class="cr-dot"></span><span><b translate="no">${esc(e.by || "")}</b> · <span>${esc(EVENT_WORD[e.status] || e.status)}</span>${extra} · <span class="cr-meta">${whenHtml(e.ts)}</span>${e.status === "cannot" && e.text ? `<span class="cr-why-t" translate="no">${esc(e.text)}</span>` : ""}</span></li>`;
}

async function detail(ctx, id) {
  let d;
  try { d = await api.get(`carreq/${id}`); } catch (e) { ctx.root.innerHTML = `<a class="cd-back" href="${listHome()}">${icon("left")}Car requests</a>${errHtml(e.message, "Could not open this car request.")}`; return; }
  if (!ctx.alive()) return;
  mount(ctx.root, `<div class="cr one" id="cr-one"><div id="cr-body"></div>
    <section class="card cr-thread-c"><div class="sec-h"><h2>Messages</h2></div><ol class="cr-thread" id="cr-thread"></ol>
      <form id="cr-say" class="cr-say" novalidate><label class="sr" for="cr-text">Message</label><textarea class="textarea" id="cr-text" maxlength="500" rows="2" placeholder="Write to maintenance, the driver or the salesman"></textarea><button class="btn primary" type="submit" id="cr-send">${icon("send")}Send</button></form></section></div>`);
  const root = ctx.root.querySelector("#cr-one"), body = root.querySelector("#cr-body"), thread = root.querySelector("#cr-thread");
  let last = "", lastEv = "";
  const draw = () => {
    const r = d.request;
    const sig = minute() + JSON.stringify([r, d.can]);
    if (sig !== last) {
      last = sig;
      const kv = (l, v) => (v ? `<div><dt>${esc(l)}</dt><dd>${v}</dd></div>` : "");
      body.innerHTML = `<a class="cd-back" href="${listHome()}">${icon("left")}${isDriver() ? "My car jobs" : "Car requests"}</a>
        <div class="page-head rise"><div><h1 class="page-title" translate="no">${esc(r.car_title)}</h1><p class="page-sub" translate="no">${esc([r.stock_no, r.reg_tail, r.colour].filter(Boolean).join(" · "))}</p></div></div>
        <section class="card cr-head s-${r.status}${r.overdue ? " late" : ""}">
          <div class="cr-top">${badge(r.overdue ? "Late" : r.status_label, r.overdue ? "neg" : TONE[r.status])}${r.overdue ? `<b class="cr-late-t">${esc(r.status_label)}</b>` : ""}</div>
          <div class="cr-times big">${clock(r)}<span class="cr-cust">${icon("user", "")}<span>Customer at ${esc(hm(r.customer_at))}</span> <span>${esc(dayWord(r.customer_at))}</span></span></div>
          ${r.status === "cannot" ? `<p class="cr-why">${icon("alert", "")}<span><b>${esc(r.cannot_by_name || "")}</b>: <span translate="no">${esc(r.cannot_reason || "")}</span></span></p>` : ""}
          <div class="cr-acts big">${buttons(r, d.can, true)}${d.can.cancel ? `<button class="btn cr-act cr-quiet" type="button" data-act="cancel" data-id="${r.id}">${icon("x")}Cancel the request</button>` : ""}</div>
          <dl class="dl cr-dl">
            ${kv("Jobs", jobsHtml(r))}
            ${kv("Where the car is", whereHtml(r))}
            ${kv("Note", r.note ? `<span translate="no">${esc(r.note)}</span>` : "")}
            ${kv("Asked by", esc(r.requested_by_name || ""))}
            ${kv("Maintenance", esc(r.accepted_by_name || ""))}
            ${kv("Driver", r.jobs.includes("bring") ? esc(r.driver_name || "Any driver") : "")}
            ${kv("Asked at", whenHtml(r.created_at))}
          </dl>
        </section>`;
    }
    const evSig = JSON.stringify(d.events);
    if (evSig !== lastEv) {
      lastEv = evSig;
      const near = window.innerHeight + window.scrollY >= document.body.scrollHeight - 120;
      thread.innerHTML = d.events.map(eventHtml).join("");
      if (near && evSig.length) thread.lastElementChild?.scrollIntoView({ block: "nearest" });
    }
  };
  draw();
  const after = async (res) => { d = res && res.request ? res : await api.get(`carreq/${id}`); draw(); };
  body.addEventListener("click", (e) => { const b = e.target.closest("button[data-act]"); if (b) act(b, d.request, d.drivers || [], after); });
  const say = root.querySelector("#cr-say"), text = root.querySelector("#cr-text"), send = root.querySelector("#cr-send");
  say.addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = text.value.trim(); if (!t) { text.focus(); return; }
    send.disabled = true;
    try { await after(await api.post(`carreq/${id}/comment`, { text: t })); text.value = ""; }
    catch (ex) { toast(ex.message, "err"); }
    send.disabled = false;
  });
  let touched = 0;
  root.addEventListener("pointerdown", () => { touched = Date.now(); }, true);
  const poll = async () => {
    if (!ctx.alive()) return;
    if (!document.hidden && Date.now() - touched > 2000) { try { d = await api.get(`carreq/${id}`, null, { background: true }); if (ctx.alive()) draw(); } catch { /* next round */ } }
    setTimeout(poll, 10000);
  };
  setTimeout(poll, 10000);
}

// ================================================================== the form
const pad = (n) => String(n).padStart(2, "0");
const istParts = (msv) => { const d = new Date(msv + 5.5 * 36e5); return { day: d.toISOString().slice(0, 10), time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }; };
const dayPlus = (n) => new Date(Date.parse(today() + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
/** The server's rule (app/carreq.py ready_by_for): an hour before the customer, never later than 3 h from now; under an hour away, the customer's time. */
function readyBy(custMs) {
  const t = nowMs();
  if (custMs - t < 36e5) return custMs;
  return Math.min(custMs - 36e5, t + 3 * 36e5);
}

async function form(ctx) {
  const carId = ctx.query.get("for");             // not "car": the car file drawer strips ?car= from the address when it closes
  let picked = null;
  if (carId && /^\d+$/.test(carId)) {
    try { picked = (await api.get(`carreq/car/${carId}`)).car; } catch (e) { toast(e.message, "err"); }
  }
  if (!ctx.alive()) return;
  const v = { car: picked, day: today(), time: "", jobs: new Set(["bring", "wash"]), other: "", where: picked?.car_where || null, where_note: picked?.where_note || "", note: "" };
  if (v.where === "showroom") v.jobs.delete("bring");
  let sending = false;
  mount(ctx.root, `<div class="cd form cr-form"><a class="cd-back" href="#/carreq">${icon("left")}Car requests</a>
    ${pageHead({ title: "Get car ready", sub: "Maintenance and the drivers get a notification. Fetching the car is their job, not yours." })}
    <form id="cr-f" novalidate autocomplete="off"><ol class="cd-steps">
      <li class="cd-step" id="st-car"><p class="cd-ask">Which car?</p><div id="car-box"></div><div class="err" id="err-car" hidden></div></li>
      <li class="cd-step" id="st-time"><p class="cd-ask">What time is the customer coming?</p>
        <div class="cd-chips" role="group" aria-label="In how long" data-chips="in">${[1, 2, 3, 4].map((h) => `<button type="button" class="cd-chip" data-in="${h}" aria-pressed="false">${h === 1 ? "In 1 hour" : `In ${h} hours`}</button>`).join("")}</div>
        <p class="cd-sub">Or pick the day and time</p>
        <div class="cd-chips" role="group" aria-label="Day" data-chips="day"><button type="button" class="cd-chip" data-day="${dayPlus(0)}" aria-pressed="true">Today</button><button type="button" class="cd-chip" data-day="${dayPlus(1)}" aria-pressed="false">Tomorrow</button></div>
        <div class="cd-field"><label class="sr" for="cr-time">Time</label><input class="input cr-time-in" id="cr-time" type="time" enterkeyhint="done"></div>
        <p class="cr-preview" id="cr-preview" aria-live="polite"></p><div class="err" id="err-time" hidden></div></li>
      <li class="cd-step" id="st-jobs"><p class="cd-ask">What should be done?</p>
        <div class="cd-chips" role="group" aria-label="Jobs" id="jobs">${JOBS.map(([k, l]) => `<button type="button" class="cd-chip cr-job" data-job="${k}" aria-pressed="${v.jobs.has(k)}">${esc(l)}</button>`).join("")}</div>
        <div class="cd-field" id="other-box" hidden><label class="sr" for="cr-other">What else?</label><input class="input" id="cr-other" maxlength="80" enterkeyhint="done" placeholder="What else? e.g. fit the floor mats"></div>
        <p class="cr-hint" id="bring-hint" hidden>${icon("info", "")}<span>The car is not at the showroom, so it is always brought down.</span></p><div class="err" id="err-jobs" hidden></div></li>
      <li class="cd-step" id="st-where"><p class="cd-ask">Where is the car now?</p>
        <div class="cd-chips" role="group" aria-label="Where the car is" id="where">${WHERE.map(([k, l]) => `<button type="button" class="cd-chip" data-where="${k}" aria-pressed="${v.where === k}">${esc(l)}</button>`).join("")}</div>
        <div class="cd-field"><label class="sr" for="cr-wnote">Where exactly</label><input class="input" id="cr-wnote" maxlength="120" enterkeyhint="done" placeholder="e.g. Sai Motors, Goregaon or 2 km, near Malad station" value="${esc(v.where_note)}"></div>
        <p class="cr-hint" id="where-from" ${picked?.car_where ? "" : "hidden"}>${icon("info", "")}<span>Filled in from the maintenance location. Change it if you know better.</span></p><div class="err" id="err-where" hidden></div></li>
      <li class="cd-step" id="st-note"><p class="cd-ask">Anything else?</p><textarea class="textarea" id="cr-note" maxlength="300" placeholder="For maintenance. No customer name or number."></textarea></li>
    </ol>
    <div class="cd-bar"><div class="err" id="f-err" role="alert" hidden></div>
      <button class="btn primary cd-send" type="submit" id="send">${icon("send")}<span>Send to maintenance</span></button></div>
    </form></div>`);
  const root = ctx.root.querySelector(".cr-form");
  const $ = (s) => root.querySelector(s);
  const f = $("#cr-f");
  // Enter on the phone's keyboard closes it; only the Send button sends (the call-desk form's rule)
  f.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing && e.target.matches("input")) { e.preventDefault(); e.target.blur(); } });
  const showErr = (sel, msg) => { const n = $(sel); if (!n) return; n.textContent = msg || ""; n.hidden = !msg; };
  const setPressed = (sel, attr, val) => root.querySelectorAll(sel).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === String(val))));

  // ---- the car
  const carBox = $("#car-box");
  const drawCar = () => {
    if (v.car) {
      carBox.innerHTML = `<div class="cd-picked">${icon("check", "")}<div><b translate="no">${esc(v.car.title)}</b><span translate="no">${esc([v.car.stock_no, v.car.reg_tail, v.car.colour].filter(Boolean).join(" · "))}</span></div><button type="button" class="cd-link" id="car-change">Change</button></div>`;
      return;
    }
    carBox.innerHTML = `<label class="sr" for="car-q">Search our stock</label><input class="input" id="car-q" type="search" enterkeyhint="done" maxlength="40" placeholder="Search stock: City, Creta, 2021, white…"><ul class="cd-cars" id="cars"></ul><p class="muted" id="car-note"></p>`;
    const qbox = $("#car-q");
    const search = debounce(async () => {
      try {
        const r = await api.get("carreq/stock", { q: qbox.value }, { background: true });
        if (!ctx.alive() || v.car) return;
        carBox.__cars = r.cars;
        $("#cars").innerHTML = r.cars.slice(0, qbox.value.trim() ? 8 : 5).map((c) => `<li><button type="button" class="cd-car" data-car="${c.car_id}"><b translate="no">${esc(c.title)}</b><span><span translate="no">${esc([c.stock_no, c.reg_tail, c.colour].filter(Boolean).join(" · "))}</span> · ${esc(WHERE_WORD[c.car_where] || "")}</span></button></li>`).join("");
        $("#car-note").textContent = qbox.value.trim() && !r.cars.length ? "Not in our stock." : "";
      } catch { $("#car-note").textContent = ""; }
    }, 220);
    qbox.addEventListener("input", search);
    qbox.addEventListener("focus", search, { once: true });
  };
  carBox.addEventListener("click", (e) => {
    const c = e.target.closest("[data-car]");
    if (c) {
      const car = (carBox.__cars || []).find((x) => x.car_id === +c.dataset.car); if (!car) return;
      v.car = { ...car };
      v.where = car.car_where; v.where_note = car.where_note || ""; $("#cr-wnote").value = v.where_note;
      $("#where-from").hidden = false;
      if (v.where === "showroom") v.jobs.delete("bring");
      setPressed("[data-where]", "where", v.where); drawCar(); fixJobs(); mark(); showErr("#err-car", "");
      return;
    }
    if (e.target.closest("#car-change")) { v.car = null; drawCar(); mark(); $("#car-q")?.focus(); }
  });

  // ---- the time
  const custMs = () => (v.time ? ms(`${v.day} ${v.time}:00`) : null);
  const preview = () => {
    const c = custMs(), p = $("#cr-preview");
    if (!c) { p.textContent = ""; return; }
    const r = istParts(readyBy(c));
    p.innerHTML = `${icon("clock", "")}<span><span>Customer comes</span> <b><span>${esc(dayWord(`${v.day} `))}</span> ${esc(v.time)}</b> · <span>car ready by</span> <b>${esc(r.time)}</b></span>`;
  };
  root.querySelector("[data-chips=in]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-in]"); if (!b) return;
    const t = Math.ceil((nowMs() + +b.dataset.in * 36e5) / 3e5) * 3e5;            // to the next 5 minutes
    const p = istParts(t); v.day = p.day; v.time = p.time;
    $("#cr-time").value = v.time; setPressed("[data-day]", "day", v.day); setPressed("[data-in]", "in", b.dataset.in);
    preview(); mark(); showErr("#err-time", "");
  });
  root.querySelector("[data-chips=day]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-day]"); if (!b) return;
    v.day = b.dataset.day; setPressed("[data-day]", "day", v.day); setPressed("[data-in]", "in", ""); preview(); mark();
  });
  $("#cr-time").addEventListener("change", (e) => { v.time = e.target.value || ""; setPressed("[data-in]", "in", ""); preview(); mark(); showErr("#err-time", ""); });

  // ---- the jobs and where the car is
  const fixJobs = () => {
    const away = v.where && v.where !== "showroom";
    if (away) v.jobs.add("bring");
    const bring = $("[data-job=bring]");
    bring.setAttribute("aria-pressed", String(v.jobs.has("bring")));
    bring.disabled = !!away;
    $("#bring-hint").hidden = !away;
    $("#other-box").hidden = !v.jobs.has("other");
  };
  $("#jobs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-job]"); if (!b || b.disabled) return;
    const k = b.dataset.job;
    if (v.jobs.has(k)) v.jobs.delete(k); else v.jobs.add(k);
    b.setAttribute("aria-pressed", String(v.jobs.has(k)));
    fixJobs(); mark(); showErr("#err-jobs", "");
    if (k === "other" && v.jobs.has("other")) $("#cr-other").focus();
  });
  $("#cr-other").addEventListener("input", (e) => { v.other = e.target.value; });
  $("#where").addEventListener("click", (e) => {
    const b = e.target.closest("[data-where]"); if (!b) return;
    v.where = b.dataset.where; if (v.where === "showroom") v.jobs.delete("bring");
    setPressed("[data-where]", "where", v.where); fixJobs(); mark(); showErr("#err-where", "");
  });
  $("#cr-wnote").addEventListener("input", (e) => { v.where_note = e.target.value; });
  $("#cr-note").addEventListener("input", (e) => { v.note = e.target.value; mark(); });

  const mark = () => {
    const done = { car: !!v.car, time: !!v.time, jobs: v.jobs.size > 0, where: !!v.where, note: !!v.note.trim() };
    Object.entries(done).forEach(([k, d]) => $(`#st-${k}`)?.classList.toggle("done", d));
  };

  // ---- send
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    ["#err-car", "#err-time", "#err-jobs", "#err-where", "#f-err"].forEach((s) => showErr(s, ""));
    const bad = [];
    if (!v.car) { showErr("#err-car", "Pick the car."); bad.push("car"); }
    if (!v.time) { showErr("#err-time", "Pick when the customer comes."); bad.push("time"); }
    if (!v.jobs.size) { showErr("#err-jobs", "Tick at least one job."); bad.push("jobs"); }
    if (v.jobs.has("other") && !v.other.trim()) { showErr("#err-jobs", "Say what the other job is."); bad.push("jobs"); }
    if (!v.where) { showErr("#err-where", "Say where the car is now."); bad.push("where"); }
    if (bad.length) { $(`#st-${bad[0]}`).scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    sending = true;
    const btn = $("#send"); btn.disabled = true; const was = btn.innerHTML; btn.innerHTML = `<span class="spin"></span> Sending`;
    try {
      const r = await api.post("carreq", { car_id: v.car.car_id, customer_at: `${v.day} ${v.time}`, jobs: [...v.jobs], other_text: v.other, car_where: v.where, where_note: v.where_note, note: v.note });
      toast("Sent. Maintenance and the drivers are told.", "ok");
      if (ctx.alive()) ctx.go(`#/carreq/${r.request.id}`);      // left the form while it was sending: stay where the person went
    } catch (ex) {
      sending = false; btn.disabled = false; btn.innerHTML = was;
      if (ex.body?.request_id) { toast(ex.message, "err"); ctx.go(`#/carreq/${ex.body.request_id}`); return; }
      const fl = ex.fields || {};
      if (fl.customer_at) showErr("#err-time", ex.message);
      else if (fl.jobs || fl.other_text) showErr("#err-jobs", ex.message);
      else if (fl.car_id) showErr("#err-car", ex.message);
      else showErr("#f-err", ex.status === 0 ? api.OFFLINE_MSG : ex.message || "Could not send.");
    }
  });
  drawCar(); fixJobs(); mark();
}
