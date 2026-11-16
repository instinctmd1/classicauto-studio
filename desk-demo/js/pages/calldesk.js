// Call desk (CALLDESK-SPEC.md): every call to the showroom number, the phone inquiry form with the call script, and the
// inquiries the desk sent. #/calldesk (home), #/calldesk/new?call=<sid>&from=<inquiry id> (the form), #/calldesk/<id> (one inquiry).
// Mobile-first, one hand, during a live call: big targets, the script's questions are the loudest type, the send bar stays down.
import * as api from "../desk-api.js";          // the Desk screens' one door to the server (the demo answers from sample data)
import { homeKind } from "../state.js";
import { badge, dateFmt, debounce, esc, icon, mount, nowIstStr } from "../util.js";
import { confirmDialog, openMenu, pageHead, toast } from "../ui.js";
import { onWindow } from "../desk.js";
import { DEMO } from "../api.js";
import { openPhotos } from "./_photos.js";

const POLL_MS = 5000;
const home = () => (homeKind() === "calldesk" ? "#/home" : "#/calldesk");
const phoneText = (p) => { const d = String(p || "").replace(/\D/g, "").slice(-10); return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : String(p || "Number withheld"); };
const hm = (ts) => String(ts || "").slice(11, 16);
const dayHm = (ts) => (String(ts || "").slice(0, 10) === nowIstStr().slice(0, 10) ? hm(ts) : `${dateFmt(String(ts).slice(0, 10), false)} ${hm(ts)}`);
const mmss = (s) => (s == null ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const lakhText = (r) => (r ? `${(r / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} L` : "");
const errHtml = (msg, head = "Could not load the call desk.") => `<div class="err-box" role="alert">${icon("alert", "")}<div><b>${esc(head)}</b><span class="muted">${esc(msg || "")}</span></div></div>`;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
// how interested the customer is: the salesman's call-brief scale (_acc.js INTEREST, same chips); the desk rates hot, warm or cold
const INTEREST = {
  buy: [["hot", "Hot", "buying this week / visit fixed"], ["warm", "Warm", "this month"], ["cold", "Cold", "just looking"]],
  sell: [["hot", "Hot", "selling this week / visit fixed"], ["warm", "Warm", "this month"], ["cold", "Cold", "just asking the price"]],
};
const intTag = (k, label) => (k && label ? badge(label, `int-${k}`) : "");
let cfgCache = null;
const config = async (fresh = false) => (fresh || !cfgCache ? (cfgCache = await api.get("calldesk/config")) : cfgCache);
// A finger on the screen, or the page scrolled a moment ago: the person is about to tap. A redraw now slides another button under
// the finger (a new call or inquiry moves the list down, "Send again" goes away once it is sent), so the polls wait. true: redraw now.
// A call-back: Call back opens the dialer and the card then asks how the call went. Only that answer counts (reached marks the
// call called back, wrong number closes it, no answer and call later keep it at the top). The open questions are kept for this
// tab, so they come back if the phone reloads the app while the dialer is in front.
const CB_KEY = "ca.cd.callbacks";
const OUTCOME = [["reached", "Reached", "check"], ["no_answer", "No answer", "x"], ["call_later", "Call later", "clock"], ["wrong_number", "Wrong number", "alert"]];
const outcomeLabel = (k) => (OUTCOME.find((o) => o[0] === k) || [k, k])[1];
const loadOpen = () => {
  try { return new Map(Object.entries(JSON.parse(sessionStorage.getItem(CB_KEY) || "{}")).filter(([, o]) => o && Date.now() - (o.t || 0) < 12 * 3600e3)); }
  catch { return new Map(); }
};
const saveOpen = (m) => { try { sessionStorage.setItem(CB_KEY, JSON.stringify(Object.fromEntries([...m].map(([k, o]) => [k, { ...o, busy: false }])))); } catch { /* storage blocked: lasts while the page is open */ } };
let handoff = null;                                    // reached a buyer or a seller: the note goes on to the inquiry form

function quietFor(root, ms = 2500) {
  let at = 0;
  const mark = () => { at = Date.now(); };
  root.addEventListener("pointerdown", mark, true);
  onWindow("scroll", mark);                            // removed with the page
  return () => Date.now() - at > ms;
}

export async function render(ctx) {
  if (ctx.id === "new") return form(ctx);
  if (/^\d+$/.test(ctx.id || "")) return detail(ctx, +ctx.id);
  return homeView(ctx);
}

// ================================================================== home: calls, the big button, my inquiries
function knownLine(k) {
  if (!k) return "";
  const lead = k.lead_id ? `lead #${k.lead_id}` : "";
  const bits = [k.kind === "inquiry" ? `Called before: inquiry #${k.inquiry_id}` : `Already ${lead}`, k.kind === "inquiry" && lead ? lead : "", k.channel_label, k.salesman_label, k.status_label].filter(Boolean);
  return bits.join(" · ");
}

function outcomePanel(c, o) {
  const sid = esc(c.call_sid);
  const body = o.stage === "want"
    ? `<p class="cd-cb-q">Reached. What does the caller want?</p>
      <div class="cd-cb-btns"><button type="button" class="cd-pick" data-cbwant="buy">${icon("car")}Buying</button><button type="button" class="cd-pick" data-cbwant="sell">${icon("tag")}Selling</button>
        <button type="button" class="cd-pick wide" data-cbwant="other">Something else</button></div>
      <p class="cd-cb-sub">Buying or selling opens the inquiry form with this number filled in.</p>`
    : `<p class="cd-cb-q">How did the call go?</p>
      <div class="cd-cb-btns">${OUTCOME.map(([k, l, ic]) => `<button type="button" class="cd-pick" data-cbout="${k}">${icon(ic)}${esc(l)}</button>`).join("")}</div>`;
  return `<div class="cd-cb" data-cbpanel="${sid}">${body}
    <label class="sr" for="cbn-${sid}">Note</label><input class="input cd-cb-note" id="cbn-${sid}" data-cbnote="${sid}" enterkeyhint="done" maxlength="200" autocomplete="off" placeholder="Note (optional): when to call, what he wants" value="${esc(o.note || "")}">
    <div class="cd-cb-foot">${o.stage === "want" ? `<button type="button" class="cd-link" data-cbback="${sid}">Back</button>` : `<button type="button" class="cd-link" data-cbcancel="${sid}">Not now</button>`}</div></div>`;
}

function tryLine(c) {
  const t = c.tries?.[0];
  if (!t) return "";
  const ic = t.outcome === "reached" ? "check" : t.outcome === "call_later" ? "clock" : t.outcome === "wrong_number" ? "alert" : "x";
  return `<p class="cd-try">${icon(ic, "")}<span><b>${esc(outcomeLabel(t.outcome))}</b> · ${esc([t.by_name, dayHm(t.at)].filter(Boolean).join(", "))}${c.tries.length > 1 ? ` · ${c.tries.length} tries` : ""}${t.note ? ` · <span class="no-i18n">${esc(t.note)}</span>` : ""}</span></p>`;
}

function callCard(c, o) {
  const k = c.known;
  const cls = c.needs_callback ? "back" : c.state === "live" ? "live" : "done";
  const later = c.tries?.[0]?.outcome === "call_later";
  const state = c.needs_callback ? (later ? badge("Call later", "warn") : badge("Call back", "neg")) : c.state === "live" ? `<span class="cd-live"><i></i>On the line</span>`
    : c.state === "answered" ? badge(c.answered_by ? `Answered by ${c.answered_by}` : "Answered", "pos")
    : c.callback_at ? badge(c.callback_by_name ? `Called back by ${c.callback_by_name}` : "Called back", "info") : c.closed_label ? badge(c.closed_label) : badge("Missed");
  const tel = c.phone && /^\+91\d{10}$/.test(c.phone) ? c.phone : null;
  const fill = `#/calldesk/new?call=${encodeURIComponent(c.call_sid)}`;
  const acts = [];
  if (c.inquiry_id) acts.push(`<a class="btn primary cd-act" href="#/calldesk/${c.inquiry_id}">${icon("file")}Open the inquiry</a>`);
  else if (k?.inquiry_id) acts.push(`<a class="btn primary cd-act" href="#/calldesk/${k.inquiry_id}">${icon("file")}Open his inquiry</a>`, `<a class="btn cd-act" href="${fill}&from=${k.inquiry_id}">${icon("plus")}Add this call</a>`);
  if (c.needs_callback) {
    if (tel) acts.unshift(`<a class="btn primary cd-act" href="tel:${tel}" data-cb="${esc(c.call_sid)}">${icon("phone")}Call back</a>`);
    if (!c.inquiry_id && !k?.inquiry_id) acts.push(`<a class="btn cd-act" href="${fill}">${icon("edit")}Fill the inquiry</a>`);
    acts.push(`<button class="btn cd-act cd-quiet" type="button" data-close="${esc(c.call_sid)}">Not needed</button>`);
  } else if (!c.inquiry_id && !k?.inquiry_id && !c.closed_label) acts.push(`<a class="btn ${c.state === "live" ? "primary " : ""}cd-act" href="${fill}">${icon("edit")}Fill the inquiry</a>`);
  return `<article class="cd-call ${cls}" data-sid="${esc(c.call_sid)}">
    <div class="cd-call-top"><span class="cd-num">${esc(phoneText(c.phone))}</span>${state}</div>
    <p class="cd-meta">${esc(dayHm(c.at))}${c.duration_s ? ` · ${mmss(c.duration_s)} on the line` : ""}</p>
    ${k ? `<p class="cd-known">${icon("info", "")}<span>${esc(knownLine(k))}</span></p>` : ""}${tryLine(c)}
    ${o?.shown ? outcomePanel(c, o) : `<div class="cd-acts">${acts.join("")}</div>`}</article>`;
}

function inqItem(i) {
  const cls = i.state === "not_sent" ? (i.error_code && i.error_code !== "bridge_down" ? "bad" : "wait") : i.state === "added" ? "added" : "ok";
  const what = [i.intent === "sell" ? "Selling" : "Buying", i.car_title || i.car_text, i.intent === "buy" && i.budget ? lakhText(i.budget) : ""].filter(Boolean).join(" · ");
  return `<li class="cd-inq ${cls}"><a class="cd-inq-main" href="#/calldesk/${i.id}">
      <span class="cd-inq-top"><b>${esc(i.name || phoneText(i.phone))}</b>${i.name ? `<span class="cd-meta">${esc(phoneText(i.phone))}</span>` : ""}${intTag(i.interest, i.interest_label)}</span>
      <span class="cd-inq-what">${esc(what)}</span>
      <span class="cd-meta">${esc(i.status_label)} · ${esc(dayHm(i.created_at))}</span>
      ${i.state === "not_sent" && i.error && i.error_code !== "bridge_down" ? `<span class="cd-warnline">${esc(i.error)}</span>` : ""}
    </a>${i.state === "not_sent" ? `<button class="btn cd-resend" type="button" data-resend="${i.id}">${icon("send")}Send again</button>` : ""}</li>`;
}

async function homeView(ctx) {
  let cfg, calls, inqs;
  try { [cfg, calls, inqs] = await Promise.all([config(true), api.get("calldesk/calls"), api.get("calldesk/inquiries")]); }
  catch (e) { ctx.root.innerHTML = errHtml(e.message); return; }
  if (!ctx.alive()) return;
  mount(ctx.root, `<div class="cd">${pageHead({ title: "Call desk", sub: "Every call to the showroom number shows here by itself. Missed calls wait at the top until someone calls back." })}
    <a class="btn primary cd-new" href="#/calldesk/new">${icon("plus")}New phone inquiry</a>
    <div id="calls-box"></div>
    <section class="sec-gap"><div class="sec-h"><h2>My inquiries</h2></div><div id="inq-box"></div></section></div>`);
  const root = ctx.root.querySelector(".cd");          // #main is shared by every page: bind to this render's own wrapper
  const callsBox = root.querySelector("#calls-box"), inqBox = root.querySelector("#inq-box");
  let lastCalls = "", lastInqs = "", callsNow = calls;
  const open = loadOpen();
  open.forEach((o) => { o.shown = true; });             // back from the dialer after the app was reloaded: ask now
  // an open question whose call is no longer listed (closed by someone else, or past the list's days) goes: none on screen to answer it
  const prune = (r) => { let gone = false; open.forEach((o, sid) => { if (!r.calls.some((c) => c.call_sid === sid)) { open.delete(sid); gone = true; } }); if (gone) saveOpen(open); };
  const drawCalls = (r) => {
    prune(r);
    const sig = JSON.stringify(r.calls); if (sig === lastCalls) return; lastCalls = sig; callsNow = r;
    const n = r.counts;
    const noExotel = !r.calls.length && !cfg.exotel?.seen;
    callsBox.innerHTML = noExotel
      ? `<p class="note cd-note">${icon("info", "")}<span>${cfg.exotel?.live ? "No calls yet today. They show here as soon as the showroom number rings." : "Exotel calls are not switched on. Take calls on the office phone and type each one in with New phone inquiry."}</span></p>`
      : `<div class="sec-h"><h2>Calls</h2></div>
        <p class="cd-sum" role="status">${[n.callback ? `${n.callback} to call back` : "", n.live ? `${n.live} on the line` : "", `${n.today} today`, `${n.answered} answered`, `${n.missed} missed`].filter(Boolean).join(" · ")}</p>
        ${n.callback ? "" : `<p class="cd-clear">${icon("check", "")}Nobody is waiting for a call back.</p>`}
        <div class="cd-calls${r.calls.length > 1 ? " two" : ""}">${r.calls.map((c) => callCard(c, open.get(c.call_sid))).join("") || `<p class="muted">No calls yet today.</p>`}</div>`;
  };
  const repaint = () => { lastCalls = ""; drawCalls(callsNow); };
  const drawInqs = (r) => {
    const sig = JSON.stringify(r.inquiries); if (sig === lastInqs) return; lastInqs = sig;
    inqBox.innerHTML = r.inquiries.length ? `<ul class="cd-inqs">${r.inquiries.map(inqItem).join("")}</ul>`
      : `<div class="empty">${icon("phone", "")}<b>No inquiries yet</b><p>Each call you fill in shows here with what the salesman did with it.</p></div>`;
  };
  drawCalls(calls); drawInqs(inqs);
  const quiet = quietFor(root);
  const poll = async () => {
    if (!ctx.alive()) return;
    if (!document.hidden && quiet()) {
      // an open call-back question is never redrawn under the finger: the calls wait until it is answered (the list below may move)
      try { const [c, i] = await Promise.all([api.get("calldesk/calls", null, { background: true }), api.get("calldesk/inquiries", null, { background: true })]); if (!ctx.alive()) return; if (quiet()) { prune(c); if (!open.size) drawCalls(c); drawInqs(i); } }
      catch { /* the next round tries again */ }
    }
    setTimeout(poll, POLL_MS);
  };
  setTimeout(poll, POLL_MS);
  // ---- call-backs. Call back lets the dialer open; the question shows a moment later (or when the app is back in front), and the
  // first thing in its place is the question, not a button, so a second tap on the same spot records nothing.
  const showPending = () => { let any = false; open.forEach((o) => { if (!o.shown) { o.shown = any = true; } }); if (any && ctx.alive()) { saveOpen(open); repaint(); } };
  onWindow("visibilitychange", () => { if (!document.hidden) setTimeout(showPending, 400); });
  onWindow("focus", () => setTimeout(showPending, 400));
  root.addEventListener("input", (e) => { const n = e.target.closest("[data-cbnote]"); const o = n && open.get(n.dataset.cbnote); if (o) { o.note = n.value; saveOpen(open); } });
  root.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing && e.target.matches("[data-cbnote]")) { e.preventDefault(); e.target.blur(); } });
  const record = async (sid, body) => {
    const o = open.get(sid);
    if (!o || o.busy) return null;
    o.busy = true;
    const btns = [...root.querySelectorAll("[data-cbpanel] button")].filter((b) => b.closest("[data-cbpanel]").dataset.cbpanel === sid);
    btns.forEach((b) => { b.disabled = true; });
    try {
      const r = await api.post(`calldesk/calls/${encodeURIComponent(sid)}/callback`, { client_id: `${o.key}-${body.outcome}${body.intent ? "-" + body.intent : ""}`, dialed_at: o.dialed_at, note: o.note?.trim() || null, ...body });
      open.delete(sid); saveOpen(open);
      return r;
    } catch (ex) {
      o.busy = false; btns.forEach((b) => { b.disabled = false; });
      toast(ex.status === 0 ? `${api.OFFLINE_MSG} Nothing is lost: tap it again.` : ex.message, "err");
      return null;
    }
  };
  const refreshCalls = async () => { try { lastCalls = ""; drawCalls(await api.get("calldesk/calls")); } catch { repaint(); } };
  // a half-typed note asks before a link takes the person away (the call stays in Call back either way)
  root.addEventListener("click", async (e) => {
    const a = e.target.closest('a[href^="#/"]');
    if (!a || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || ![...open.values()].some((o) => o.shown && o.note?.trim())) return;
    e.preventDefault();
    if (await confirmDialog({ title: "Leave without saying how the call went?", text: "The call stays in Call back, and your note is kept for when you come back.", confirmLabel: "Leave for now" }) && ctx.alive()) ctx.go(a.getAttribute("href"));
  }, true);
  root.addEventListener("click", async (e) => {
    const cb = e.target.closest("[data-cb]"), cl = e.target.closest("[data-close]"), rs = e.target.closest("[data-resend]");
    const out = e.target.closest("[data-cbout]"), want = e.target.closest("[data-cbwant]"), panel = e.target.closest("[data-cbpanel]");
    if (cb) {                                            // the dialer opens (the link's own tel:); nothing is marked yet
      const sid = cb.dataset.cb;
      if (!open.has(sid)) open.set(sid, { key: newId(), dialed_at: nowIstStr(), t: Date.now(), stage: "how", note: "", shown: false });
      saveOpen(open);
      setTimeout(showPending, 1500);
      return;
    }
    if (panel && e.target.closest("[data-cbcancel]")) { open.delete(panel.dataset.cbpanel); saveOpen(open); repaint(); return; }
    if (panel && e.target.closest("[data-cbback]")) { const o = open.get(panel.dataset.cbpanel); if (o) { o.stage = "how"; saveOpen(open); repaint(); } return; }
    if (out) {
      const sid = panel.dataset.cbpanel, o = open.get(sid);
      if (!o) return;
      if (out.dataset.cbout === "reached") { o.stage = "want"; saveOpen(open); repaint(); return; }
      if (await record(sid, { outcome: out.dataset.cbout })) { toast(`Saved: ${outcomeLabel(out.dataset.cbout)}`, "ok"); refreshCalls(); }
      return;
    }
    if (want) {
      const sid = panel.dataset.cbpanel, o = open.get(sid), intent = want.dataset.cbwant;
      if (!o) return;
      const note = o.note?.trim() || "";
      const r = await record(sid, { outcome: "reached", intent });
      if (!r || !ctx.alive()) return;
      if (intent === "other") { toast(`Saved: ${outcomeLabel("reached")}`, "ok"); refreshCalls(); return; }
      const from = r.call?.known?.inquiry_id;
      handoff = { sid, note };
      ctx.go(`#/calldesk/new?call=${encodeURIComponent(sid)}&intent=${intent}${from ? `&from=${from}` : ""}`);
      return;
    }
    if (cl) {
      openMenu(cl, [{ heading: "Why no call back?" }, ...cfg.close_reasons.map((r) => ({ label: r.label, onClick: async () => {
        try { await api.post(`calldesk/calls/${encodeURIComponent(cl.dataset.close)}/close`, { reason: r.key }); lastCalls = ""; drawCalls(await api.get("calldesk/calls")); toast(`Marked: ${r.label}`, "ok"); }
        catch (ex) { toast(ex.message, "err"); }
      } }))]);
      return;
    }
    if (rs) {
      rs.disabled = true;
      try { const r = await api.post(`calldesk/inquiries/${rs.dataset.resend}/send`, {}); toast(r.message, r.inquiry.state === "not_sent" ? "err" : "ok"); lastInqs = ""; drawInqs(await api.get("calldesk/inquiries")); }
      catch (ex) { toast(ex.message, "err"); rs.disabled = false; }
    }
  });
}

// ================================================================== the form
function chips(name, items, cur) {
  return `<div class="cd-chips" role="group" data-chips="${name}">${items.map(([v, l]) => `<button type="button" class="cd-chip" data-v="${esc(v)}" aria-pressed="${String(v) === String(cur ?? "")}">${esc(l)}</button>`).join("")}</div>`;
}
const isoDay = (plus) => { const d = new Date(Date.parse(nowIstStr().slice(0, 10) + "T00:00:00Z") + plus * 864e5); return d.toISOString().slice(0, 10); };

async function form(ctx) {
  let cfg, call = null, from = null;
  try {
    cfg = await config();
    const sid = ctx.query.get("call"), fid = ctx.query.get("from");
    if (sid) call = (await api.get("calldesk/calls")).calls.find((c) => c.call_sid === sid) || null;
    if (fid && /^\d+$/.test(fid)) from = (await api.get(`calldesk/inquiries/${fid}`)).inquiry;
  } catch (e) { ctx.root.innerHTML = `<a class="cd-back" href="${home()}">${icon("left")}Call desk</a>${errHtml(e.message, "Could not open the form.")}`; return; }
  if (!ctx.alive()) return;
  const opened = Date.now();
  const pre = handoff && handoff.sid === call?.call_sid ? handoff : null;
  handoff = null;
  const qIntent = ["buy", "sell"].includes(ctx.query.get("intent")) ? ctx.query.get("intent") : null;
  const v = {
    // an answered or live call is timed from its start; a call-back of a missed call (or the office phone) from now
    client_id: newId(), call_sid: call?.call_sid || null, call_at: call && call.state !== "missed" ? call.at : nowIstStr(),
    intent: qIntent || from?.intent || null, car_id: from?.car_id || null, car_title: from?.car_title || null, car_text: from?.car_text || "",
    budget: from?.budget || null, visit_day: null, visit_time: null, interest: null, name: from?.name || "", phone: (call?.phone || from?.phone || "").replace(/^\+91/, ""),
    heard_from: from?.heard_from || null, notes: pre?.note || "", salesman: null,
  };
  let suggestion = null, suggestDown = false, known = null, sending = false;
  const say = (key) => {
    const base = cfg.script.find((s) => s.key === key) || {};
    const sell = v.intent === "sell" && cfg.sell_script?.[key];
    return { ...base, ...(sell || {}) };
  };
  const step = (key, body) => { const s = say(key); return `<li class="cd-step" data-step="${key}" id="st-${key}"><p class="cd-ask"><span class="cd-say">Ask</span>${esc(s.ask)}</p><p class="cd-hint">“${esc(s.say)}”${s.hint ? ` · ${esc(s.hint)}` : ""}</p>${body}</li>`; };
  const strip = call ? `${icon("phone")}<span class="cd-strip-t">Call from <b>${esc(phoneText(call.phone))}</b> at ${esc(hm(call.at))}${call.answered_by ? ` · answered by ${esc(call.answered_by)}` : ""}</span>`
    : `${icon("phone")}<span class="cd-strip-t">Typed from the office phone</span>`;
  mount(ctx.root, `<div class="cd form"><a class="cd-back" href="${home()}">${icon("left")}Call desk</a>
    ${pageHead({ title: "New phone inquiry" })}
    <div class="cd-strip">${strip}<span class="cd-clock-w"><span class="cd-clock-l">On the call</span><span class="cd-clock" id="clock">0:00</span></span></div>
    <div id="known-top"></div>
    ${from ? `<p class="note cd-banner">${icon("info", "")}<span>Filled in from inquiry #${from.id}. Change what is different this time.</span></p>` : ""}
    <form id="cd-f" novalidate autocomplete="off"><ol class="cd-steps">
      ${step("intent", `<div class="cd-two" role="group" aria-label="Buying or selling"><button type="button" class="cd-pick" data-intent="buy" aria-pressed="${v.intent === "buy"}">${icon("car")}Buying</button><button type="button" class="cd-pick" data-intent="sell" aria-pressed="${v.intent === "sell"}">${icon("tag")}Selling</button></div><div class="err" id="err-intent" hidden></div>`)}
      ${step("car", `<div id="car-box"></div>`)}
      <li class="cd-step" data-step="budget" id="st-budget"></li>
      ${step("visit", `<p class="cd-sub">Day</p>${chips("visit_day", [[isoDay(0), "Today"], [isoDay(1), "Tomorrow"], [isoDay(2), new Date(Date.parse(isoDay(2))).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })]], v.visit_day)}
        <div class="cd-field"><label class="sr" for="visit-day">Another day</label><input class="input" id="visit-day" type="date" min="${isoDay(0)}" max="${isoDay(60)}"></div>
        <p class="cd-sub">Time</p>${chips("visit_time", [["11:00", "11 am"], ["13:00", "1 pm"], ["16:00", "4 pm"], ["18:00", "6 pm"]], v.visit_time)}
        <div class="cd-field"><label class="sr" for="visit-time">Another time</label><input class="input" id="visit-time" type="time" min="09:00" max="21:00"></div><div class="err" id="err-visit" hidden></div>`)}
      ${step("interest", `<div id="int-box"></div><div class="err" id="err-interest" hidden></div>`)}
      ${step("name", `<input class="input" id="f-name" enterkeyhint="done" maxlength="60" autocomplete="off" autocapitalize="words" placeholder="Customer's name" value="${esc(v.name)}">`)}
      ${step("phone", `<input class="input" id="f-phone" enterkeyhint="done" type="tel" inputmode="numeric" maxlength="14" placeholder="98xxxxxxxx" value="${esc(v.phone)}"><div class="err" id="err-phone" hidden></div><div id="known-ph"></div>`)}
      ${step("heard_from", chips("heard_from", cfg.heard_from.map((h) => [h.key, h.label]), v.heard_from))}
      ${step("notes", `<textarea class="textarea" id="f-notes" maxlength="400" placeholder="Exchange car, finance, colour, how soon">${esc(v.notes)}</textarea>`)}
    </ol>
    <div class="cd-bar"><div class="cd-goes" id="goes" aria-live="polite"></div><div class="err" id="f-err" role="alert" hidden></div>
      <button class="btn primary cd-send" type="button" id="send">${icon("send")}<span id="send-l">Send to the salesman</span></button></div>
    </form></div>`);
  const root = ctx.root.querySelector(".cd");          // #main is shared by every page: bind to this render's own wrapper
  const $ = (s) => root.querySelector(s);
  const f = $("#cd-f");
  // Enter on the phone's keyboard (Go / Search / Done) used to send the half-filled form and open the inquiry page. It now just closes the keyboard.
  // Send is a plain button and the form never submits: nothing on any keyboard (a Hindi one too) can send; only a tap on Send does.
  f.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing && e.target.matches("input")) { e.preventDefault(); e.target.blur(); } });
  f.addEventListener("submit", (e) => e.preventDefault());
  // ---- the call clock: how long this call has been going (the report times call to inquiry sent)
  const t0 = call?.state === "live" ? Math.min(opened, Date.parse(call.at.replace(" ", "T") + "+05:30") || opened) : opened;   // a call-back starts now
  const tick = () => { if (!ctx.alive()) return; const s = Math.max(0, Math.round((Date.now() - t0) / 1000)); $("#clock").textContent = s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : mmss(s); setTimeout(tick, 1000); };
  tick();

  // ---- the car: live stock with a search box, or free text
  const carBox = $("#car-box");
  const drawCar = () => {
    if (v.car_id) { carBox.innerHTML = `<div class="cd-picked">${icon("check", "")}<div><b>${esc(v.car_title)}</b><span>From our stock</span></div>${DEMO ? "" : `<button type="button" class="cd-link" id="car-photos" aria-label="Photos of this car: send on WhatsApp or download">Photos</button>`}<button type="button" class="cd-link" id="car-change">Change</button></div>`; return; }
    carBox.innerHTML = `<label class="sr" for="car-q">Search our stock or type the car</label><input class="input" id="car-q" type="search" enterkeyhint="done" maxlength="80" placeholder="${v.intent === "sell" ? "e.g. Creta 2019, 40,000 km" : "Search stock: City, Creta, 2021, white…"}" value="${esc(v.car_text)}">
      <ul class="cd-cars" id="cars"></ul><p class="muted" id="car-note"></p>`;
    const qbox = $("#car-q");
    const search = debounce(async () => {
      if (v.intent === "sell" || !ctx.alive()) { $("#cars").innerHTML = ""; return; }
      try {
        const r = await api.get("calldesk/stock", { q: qbox.value }, { background: true });
        if (!ctx.alive() || v.car_id) return;
        $("#cars").innerHTML = r.cars.slice(0, qbox.value.trim() ? 8 : 5).map((c) => `<li><button type="button" class="cd-car" data-car="${c.car_id}" data-title="${esc(c.title)}"><b>${esc(c.title)}</b><span>${esc([c.stock_no, c.colour, c.fuel, c.transmission, c.status_label].filter(Boolean).join(" · "))}</span></button></li>`).join("");
        $("#car-note").textContent = qbox.value.trim() ? (r.cars.length ? "Tap a car, or leave it: we send what you typed." : "Not in our stock. We send what you typed.") : "";
      } catch { $("#car-note").textContent = ""; }
    }, 220);
    qbox.addEventListener("input", () => { v.car_text = qbox.value; mark(); search(); refreshSuggest(); });
    qbox.addEventListener("focus", search, { once: true });
  };
  carBox.addEventListener("click", (e) => {
    const c = e.target.closest("[data-car]");
    if (c) { v.car_id = +c.dataset.car; v.car_title = c.dataset.title; drawCar(); mark(); refreshSuggest(); return; }
    if (e.target.closest("#car-photos")) { openPhotos(v.car_id, v.car_title); return; }        // a caller asks for photos: WhatsApp them
    if (e.target.closest("#car-change")) { v.car_id = null; v.car_title = null; drawCar(); mark(); refreshSuggest(); $("#car-q")?.focus(); }
  });

  // ---- the budget (buying only)
  const drawBudget = () => {
    const li = $("#st-budget");
    li.hidden = v.intent === "sell";
    if (li.hidden) return;
    const s = say("budget");
    const lakh = v.budget ? String(+(v.budget / 100000).toFixed(2)) : "";
    li.innerHTML = `<p class="cd-ask"><span class="cd-say">Ask</span>${esc(s.ask)}</p><p class="cd-hint">“${esc(s.say)}”${s.hint ? ` · ${esc(s.hint)}` : ""}</p>
      ${chips("budget", [[500000, "5 L"], [1000000, "10 L"], [1500000, "15 L"], [2000000, "20 L"], [3000000, "30 L"], [5000000, "50 L"], [8000000, "80 L+"]], v.budget)}
      <div class="cd-lakh"><label class="sr" for="f-lakh">Budget in lakh</label><input class="input" id="f-lakh" enterkeyhint="done" type="number" inputmode="decimal" min="0.5" max="1000" step="0.5" placeholder="e.g. 12.5" value="${lakh}"><span>lakh</span></div><div class="err" id="err-budget" hidden></div>`;
    $("#f-lakh").addEventListener("input", (e) => { const n = parseFloat(e.target.value); v.budget = n > 0 ? Math.round(n * 100000) : null; setChips("budget", v.budget); mark(); refreshSuggest(); });
  };
  // ---- how interested (buying and selling): the brief's chips, required
  const drawInterest = () => {
    $("#int-box").innerHTML = `<div class="bf-int cd-int" role="radiogroup" aria-label="How interested">${INTEREST[v.intent === "sell" ? "sell" : "buy"].map(([k, l, h]) => `<label class="bf-chip int-${k}"><input type="radio" name="interest" value="${k}"${v.interest === k ? " checked" : ""}><span><b>${esc(l)}</b><small>${esc(h)}</small></span></label>`).join("")}</div>`;
  };
  $("#int-box").addEventListener("change", (e) => { if (e.target.name !== "interest") return; v.interest = e.target.value; showErr("#err-interest", ""); mark(); });
  const setChips = (name, cur) => root.querySelectorAll(`[data-chips="${name}"] .cd-chip`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === String(cur ?? ""))));
  root.addEventListener("click", (e) => {
    const p = e.target.closest("[data-intent]");
    if (p) {
      v.intent = p.dataset.intent;
      root.querySelectorAll("[data-intent]").forEach((b) => b.setAttribute("aria-pressed", String(b === p)));
      const s = say("car"); const li = $("#st-car"); li.querySelector(".cd-ask").innerHTML = `<span class="cd-say">Ask</span>${esc(s.ask)}`; li.querySelector(".cd-hint").textContent = `“${s.say}”${s.hint ? ` · ${s.hint}` : ""}`;
      if (v.intent === "sell") { v.car_id = null; v.car_title = null; }
      const si = say("interest"); const il = $("#st-interest"); il.querySelector(".cd-hint").textContent = `“${si.say}”${si.hint ? ` · ${si.hint}` : ""}`;
      drawCar(); drawBudget(); drawInterest(); mark(); refreshSuggest();
      return;
    }
    const ch = e.target.closest(".cd-chip"); if (!ch) return;
    const name = ch.closest("[data-chips]").dataset.chips;
    const val = ch.getAttribute("aria-pressed") === "true" ? null : ch.dataset.v;          // a second tap clears it
    if (name === "budget") { v.budget = val ? +val : null; const l = $("#f-lakh"); if (l) l.value = v.budget ? String(v.budget / 100000) : ""; refreshSuggest(); }
    else v[name] = val;
    if (name === "visit_day") $("#visit-day").value = "";
    if (name === "visit_time") $("#visit-time").value = "";
    setChips(name, v[name]); mark();
  });
  $("#visit-day").addEventListener("change", (e) => { v.visit_day = e.target.value || null; setChips("visit_day", v.visit_day); mark(); });
  $("#visit-time").addEventListener("change", (e) => { v.visit_time = e.target.value || null; setChips("visit_time", v.visit_time); mark(); });
  $("#f-name").addEventListener("input", (e) => { v.name = e.target.value; mark(); });
  $("#f-notes").addEventListener("input", (e) => { v.notes = e.target.value; mark(); });

  // ---- the number: as soon as it is valid, say if it is already a lead
  const digits = () => { let d = v.phone.replace(/\D/g, ""); if (d.length === 12 && d.startsWith("91")) d = d.slice(2); if (d.length === 11 && d.startsWith("0")) d = d.slice(1); return d; };
  const validPhone = () => /^[6-9]\d{9}$/.test(digits());
  const lookup = debounce(async () => {
    const box = $("#known-ph"), top = $("#known-top");      // the top copy: an Exotel call fills the number, far down the form
    if (!validPhone()) { known = null; box.innerHTML = top.innerHTML = ""; drawGoes(); return; }
    try {
      const asked = digits();
      const r = await api.get("calldesk/lookup", { phone: asked }, { background: true });
      if (!ctx.alive() || asked !== digits()) return;          // the number changed while this was asked
      known = r.known;
      box.innerHTML = known ? `<p class="note cd-banner">${icon("info", "")}<span><b>${esc(knownLine(known))}.</b> ${known.adds_to ? `Sending adds this call to lead #${known.adds_to}, no second lead.` : known.lead_id ? "That lead is closed: this makes a new lead." : "That inquiry has no lead yet: this one is sent on its own."}${known.inquiry_id ? ` <a href="#/calldesk/${known.inquiry_id}">Open inquiry #${known.inquiry_id}</a>` : ""}</span></p>` : "";
      top.innerHTML = call && digits() === call.phone?.replace(/\D/g, "").slice(-10) ? box.innerHTML : "";
      drawGoes();
    } catch { /* the banner is a help, not a gate */ }
  }, 250);
  $("#f-phone").addEventListener("input", (e) => { v.phone = e.target.value; mark(); lookup(); });

  // ---- who it goes to: the rotation's suggestion, or someone else
  const refreshSuggest = debounce(async () => {
    if (!v.intent || !ctx.alive()) { drawGoes(); return; }
    try {
      suggestion = await api.get("calldesk/suggest", { intent: v.intent, budget: v.budget || "", car_id: v.car_id || "", car_text: v.car_id ? "" : v.car_text }, { background: true });
      suggestDown = false;
      if (v.salesman && !suggestion.salesmen.some((s) => s.seat === v.salesman)) v.salesman = null;
    } catch { suggestion = null; suggestDown = true; }
    drawGoes();
  }, 300);
  const seatLabel = (seat) => suggestion?.salesmen.find((s) => s.seat === seat)?.label || seat;
  const drawGoes = () => {
    const g = $("#goes"), lbl = $("#send-l");
    if (known?.adds_to) { g.innerHTML = `<div class="cd-goes-t">${icon("info", "")}<span>Goes to <b>${esc(known.salesman_label || "the salesman")}</b>, on his lead #${known.adds_to}.</span></div>`; lbl.textContent = `Add to lead #${known.adds_to}`; return; }
    if (!v.intent) { g.innerHTML = `<span class="muted">Tap Buying or Selling first.</span>`; lbl.textContent = "Send to the salesman"; return; }
    if (suggestDown) { g.innerHTML = `<div class="cd-goes-t">${icon("alert", "")}<span>The lead engine is not answering. Send still saves it, and it goes to whoever's turn it is as soon as the engine is back.</span></div>`; lbl.textContent = "Save and send"; return; }
    if (!suggestion) { g.innerHTML = `<span class="muted">Finding whose turn it is…</span>`; return; }
    const pick = v.salesman, turn = suggestion.suggested;
    const name = pick ? seatLabel(pick) : turn?.label || "the salesman";
    g.innerHTML = `<span>Goes to <b>${esc(name)}</b></span><span class="muted">${pick && pick !== turn?.seat ? "your pick" : v.intent === "sell" ? "the sell desk" : `whose turn it is${suggestion.tier ? ", " + esc(suggestion.tier) : ""}`}</span><button type="button" class="cd-link" id="pick">${pick ? "Change" : "Pick someone else"}</button>`;
    lbl.textContent = `Send to ${name.replace(/\s*\(.*\)$/, "")}`;
  };
  $("#goes").addEventListener("click", (e) => {
    const b = e.target.closest("#pick"); if (!b || !suggestion) return;
    openMenu(b, [{ heading: "Send to" }, { label: `Whose turn it is (${suggestion.suggested?.label || "the rotation"})`, checked: !v.salesman, onClick: () => { v.salesman = null; drawGoes(); } },
      ...suggestion.salesmen.map((s) => ({ label: s.label + (s.tiers.length ? ` · ${s.tiers.map((t) => t.split(" ")[0]).join(", ")}` : ""), checked: v.salesman === s.seat, onClick: () => { v.salesman = s.seat; drawGoes(); } }))], { align: "right" });
  });

  // ---- each step turns green when it has an answer
  const mark = () => {
    const done = { intent: !!v.intent, car: !!(v.car_id || v.car_text.trim()), budget: !!v.budget, visit: !!(v.visit_day || v.visit_time), interest: !!v.interest, name: !!v.name.trim(), phone: validPhone(), heard_from: !!v.heard_from, notes: !!v.notes.trim() };
    Object.entries(done).forEach(([k, d]) => $(`#st-${k}`)?.classList.toggle("done", d));
  };

  // ---- send: one tap. The same key on every retry, so a lost answer never makes a second lead.
  const showErr = (id, msg) => { const n = $(id); if (!n) return; n.textContent = msg || ""; n.hidden = !msg; };
  $("#send").addEventListener("click", async () => {
    if (sending) return;
    ["#err-intent", "#err-phone", "#err-budget", "#err-visit", "#err-interest", "#f-err"].forEach((id) => showErr(id, ""));
    const bad = [];
    if (!v.intent) { showErr("#err-intent", "Tap Buying or Selling."); bad.push("intent"); }
    if (!v.interest) { showErr("#err-interest", "Tap Hot, Warm or Cold: how interested is the customer?"); bad.push("interest"); }
    if (!validPhone()) { showErr("#err-phone", "A 10-digit mobile number."); bad.push("phone"); }
    if (bad.length) { $(`#st-${bad[0]}`).scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    sending = true;
    const btn = $("#send"); btn.disabled = true; const was = btn.innerHTML; btn.innerHTML = `<span class="spin"></span> Sending`;
    const body = { client_id: v.client_id, call_sid: v.call_sid, call_at: v.call_at, name: v.name, phone: digits(), intent: v.intent, car_id: v.car_id, car_text: v.car_id ? null : v.car_text,
      budget: v.intent === "buy" ? v.budget : null, visit_day: v.visit_day, visit_time: v.visit_time, interest: v.interest, heard_from: v.heard_from, notes: v.notes, salesman: known?.adds_to ? null : v.salesman };
    try {
      const r = await api.post("calldesk/inquiries", body);
      toast(r.message, r.inquiry.state === "not_sent" ? "" : "ok");
      if (ctx.alive()) ctx.go(`#/calldesk/${r.inquiry.id}`);      // left the form while it was sending: stay where the person went
    } catch (ex) {
      sending = false; btn.disabled = false; btn.innerHTML = was;
      const fl = ex.fields || {};
      if (fl.phone) showErr("#err-phone", fl.phone);
      if (fl.intent) showErr("#err-intent", fl.intent);
      if (fl.budget) showErr("#err-budget", fl.budget);
      if (fl.visit_day || fl.visit_time) showErr("#err-visit", fl.visit_day || fl.visit_time);
      if (fl.interest) showErr("#err-interest", "Tap Hot, Warm or Cold: how interested is the customer?");
      showErr("#f-err", ex.status === 0 ? `${api.OFFLINE_MSG} Nothing is lost: tap Send again.` : ex.message || "Could not send.");
    }
  });
  drawCar(); drawBudget(); drawInterest(); mark(); drawGoes();
  if (v.intent) refreshSuggest();
  if (v.phone) lookup();
  // A link in the form (the Back link, "Open inquiry #N" that appears under the number a moment after it is typed and pushes the
  // next step down) used to throw away a half-filled inquiry at one tap. Once something is filled in, it asks first.
  const start = JSON.stringify(v);
  root.addEventListener("click", async (e) => {
    const a = e.target.closest('a[href^="#/"]');
    if (!a || sending || JSON.stringify(v) === start) return;
    e.preventDefault();
    if (await confirmDialog({ title: "Leave this inquiry?", text: "It is not sent yet. What you filled in is lost if you leave now.", confirmLabel: "Leave without sending" }) && ctx.alive()) ctx.go(a.getAttribute("href"));
  }, true);
}

// ================================================================== one inquiry
async function detail(ctx, id) {
  let r;
  try { r = await api.get(`calldesk/inquiries/${id}`); } catch (e) { ctx.root.innerHTML = `<a class="cd-back" href="${home()}">${icon("left")}Call desk</a>${errHtml(e.message, "Could not open this inquiry.")}`; return; }
  if (!ctx.alive()) return;
  let i = r.inquiry, last = "";
  mount(ctx.root, `<div class="cd" id="cd-one"></div>`);
  const root = ctx.root.querySelector("#cd-one");      // redrawn inside; the click listener stays on this wrapper
  const draw = () => {
    const sig = JSON.stringify(i); if (sig === last) return; last = sig;
    const kv = (l, val) => (val ? `<div><dt>${esc(l)}</dt><dd>${val}</dd></div>` : "");
    const tone = i.state === "not_sent" ? (i.error_code && i.error_code !== "bridge_down" ? "neg" : "warn") : i.state === "added" ? "info" : "pos";
    const stateWord = i.state === "not_sent" ? "Not sent yet" : i.state === "added" ? "Added to a lead" : "Sent";
    root.innerHTML = `<a class="cd-back" href="${home()}">${icon("left")}Call desk</a>
      ${pageHead({ title: i.name || phoneText(i.phone), sub: `Inquiry #${i.id} · taken by ${esc(i.created_by_name || "the call desk")} · ${esc(dayHm(i.created_at))}` })}
      <section class="card rise cd-detail">
        <div class="cd-d-head">${badge(stateWord, tone)}<b>${esc(i.status_label)}</b></div>
        ${i.state === "not_sent" ? `<p class="note">${icon(i.error_code && i.error_code !== "bridge_down" ? "alert" : "clock", "")}<span>${i.error_code && i.error_code !== "bridge_down" ? esc(i.error || "The lead engine refused it.") + " Pick another salesman and send again." : "Saved. The lead engine is not answering, so it is sent by itself as soon as it is back. You can also tap Send again."}</span></p>` : ""}
        <dl class="dl cd-dl">
          ${kv("Phone", `<a class="cd-tel" href="tel:${esc(i.phone)}">${esc(phoneText(i.phone))}</a>`)}
          ${kv("Wants to", i.intent === "sell" ? "Sell his car" : "Buy a car")}
          ${kv(i.intent === "sell" ? "His car" : "Car", esc(i.car_title ? `${i.car_title}${i.stock_no ? ` (${i.stock_no})` : ""}` : i.car_text || "Not decided"))}
          ${i.intent === "buy" ? kv("Budget", esc(i.budget ? lakhText(i.budget) : "Not said")) : ""}
          ${kv("Visit", esc(i.visit_label || "Not fixed"))}
          ${kv("Customer interest", intTag(i.interest, i.interest_label))}
          ${kv("Found us on", esc(i.heard_label || ""))}
          ${kv("Salesman", esc(i.salesman_label || (i.pick_label ? `${i.pick_label} (your pick)` : "Whose turn it is")))}
          ${kv("Lead", i.lead_id ? `#${i.lead_id}` : "")}
          ${kv("Call", esc(dayHm(i.call_at)) + (i.call_sid ? " · Exotel" : " · office phone"))}
          ${kv("Sent", i.sent_at ? esc(dayHm(i.sent_at)) : "")}
        </dl>
        ${i.notes ? `<div class="cd-notes"><h3>Notes</h3><p>${esc(i.notes)}</p></div>` : ""}
        <div class="cd-acts">${i.state === "not_sent" ? `<button class="btn primary cd-act" type="button" id="again">${icon("send")}Send again</button><button class="btn cd-act cd-quiet" type="button" id="who">${icon("users")}Pick a salesman</button>` : ""}
          <a class="btn cd-act" href="#/calldesk/new?from=${i.id}">${icon("plus")}He called again: new inquiry</a></div>
        <p class="cd-foot">${icon("lock", "")}<span>The salesman's conversation with the customer stays with him. Here you see what happened to the inquiry.</span></p>
      </section>`;
  };
  draw();
  let pick;
  const sendAgain = async (b) => {
    b.disabled = true;
    try { const res = await api.post(`calldesk/inquiries/${id}/send`, pick === undefined ? {} : { salesman: pick }); toast(res.message, res.inquiry.state === "not_sent" ? "err" : "ok"); i = res.inquiry; last = ""; draw(); }
    catch (ex) { toast(ex.message, "err"); b.disabled = false; }
  };
  root.addEventListener("click", async (e) => {
    if (e.target.closest("#again")) { sendAgain(e.target.closest("#again")); return; }
    const w = e.target.closest("#who"); if (!w) return;
    let s;
    try { s = await api.get("calldesk/suggest", { intent: i.intent, budget: i.budget || "", car_id: i.car_id || "", car_text: i.car_text || "" }); }
    catch (ex) { toast(ex.message, "err"); return; }
    openMenu(w, [{ heading: "Send to" }, { label: `Whose turn it is (${s.suggested?.label || "the rotation"})`, onClick: () => { pick = null; sendAgain(w); } },
      ...s.salesmen.map((x) => ({ label: x.label, onClick: () => { pick = x.seat; sendAgain(w); } }))]);
  });
  const quiet = quietFor(root);                        // once it is sent, Send again goes and "He called again" moves up under the finger
  const poll = async () => {
    if (!ctx.alive()) return;
    if (!document.hidden && quiet()) { try { i = (await api.get(`calldesk/inquiries/${id}`, null, { background: true })).inquiry; if (ctx.alive() && quiet()) draw(); } catch { /* next round */ } }
    setTimeout(poll, 10000);
  };
  setTimeout(poll, 10000);
}
