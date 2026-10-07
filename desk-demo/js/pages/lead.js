// Lead detail (APP-SPEC 3.3 to 3.5): who the customer is, the claim clock, the conversation or call transcript, the
// timeline and the actions. Every button maps to the same engine function the Telegram buttons use; the server
// decides what is allowed (the "allowed" block) and this page only hides what is not.
import { can, state } from "../state.js";
import { esc, icon, lakh, sentence } from "../util.js";
import { confirmDialog, formDrawer, toast } from "../ui.js";
import * as desk from "../desk-api.js";
import { DEMO } from "../api.js";
import { channelLabel, clockHtml, deskAgo, deskNow, deskTime, onFeed, setServerNow, STAGE_LABEL, STAGES, startTicker } from "../desk.js";
import { BRIEF_STATE, CALL_STATUS, INTEREST_LABEL, OUTCOMES, PASS_WHY, PROOF_STATE, SOURCE, VERDICT_SHORT, WARN, briefToFill, dueChip, exotelOn, flagChip,
  fmtDur, openBrief, openProof, openReassign, outcomeLabel, shows, tickChip } from "./_acc.js";

const LOST = [["price", "Price too high"], ["finance_rejected", "Loan not approved"], ["bought_elsewhere", "Bought elsewhere"], ["car_already_sold", "Car already sold"],
  ["exchange_value", "Exchange value too low"], ["customer_unreachable", "Could not reach the customer"], ["not_serious", "Not serious"], ["location", "Too far away"], ["other", "Other reason"]];
const LOST_LABEL = Object.fromEntries(LOST);
const KIND = {
  new: ["Lead came in", "inbox"], claimed: ["Claimed", "check"], contacted: ["Contacted", "phone"], visit_booked: ["Visit booked", "calendar"],
  test_drive: ["Test drive", "car"], sold: ["Sold", "tag"], lost: ["Lost", "x"], note: ["Note", "edit"], missed: ["Missed the claim time", "clock"],
  reassigned: ["Moved to another salesman", "repeat"], escalated: ["Escalated", "flag"], replied: ["Replied", "send"], ai_call: ["AI call booked", "phone"],
  // call accountability (ACCOUNTABILITY-SPEC 11.2): the notes hold codes, ids and staff names only
  call_attempt: ["Call pressed", "phone"], call_result: ["Call result", "phone"], brief_prompt: ["Brief asked for", "edit"], brief_reminder: ["Brief reminder", "bell"],
  brief_submitted: ["Brief filled", "edit"], brief_late: ["Brief filled late", "edit"], brief_missed: ["Brief missed", "clock"],
  proof_submitted: ["Call screenshot sent", "camera"], proof_approved: ["Screenshot approved", "check"], proof_rejected: ["Screenshot rejected", "x"],
  proof_waived: ["Screenshot waived", "check"], proof_missed: ["No call screenshot", "clock"], proof_verified: ["Call verified", "check"],
  proof_ai: ["Screenshot read", "image"],
  pass: ["Passed on", "repeat"], released: ["Released", "clock"], reassigned_manual: ["Moved by hand", "repeat"], warning: ["Warning", "flag"],
  warning_excused: ["Warning excused", "check"], followup_due: ["Follow-up due", "bell"], lost_override: ["Closed by a manager", "x"],
};
const ACC_KINDS = new Set(["call_attempt", "call_result", "brief_prompt", "brief_reminder", "brief_submitted", "brief_late", "brief_missed", "proof_submitted",
  "proof_approved", "proof_rejected", "proof_waived", "proof_missed", "proof_verified", "proof_ai", "pass", "released", "reassigned_manual", "escalated", "warning",
  "warning_excused", "followup_due"]);
const TO_SEAT = new Set(["pass", "reassigned", "reassigned_manual", "escalated"]);
const PURPOSES = [["callback", "Call back the customer"], ["post_visit_followup", "Follow up after a visit"], ["feedback", "Ask for feedback"]];
const AI_CHANNELS = [["call", "Call"], ["whatsapp", "WhatsApp"]];

export async function render(ctx) {
  const id = Number(ctx.id);
  if (!Number.isInteger(id) || id <= 0) { ctx.root.innerHTML = `<div class="lead-wrap">${notFound()}</div>`; return; }
  startTicker();
  let d = null, acc = null, accErr = false, autoOpened = false, briefAsked = false;
  ctx.root.innerHTML = `<div class="lead-wrap"><div class="skel lead-skel tall"></div><div class="skel lead-skel"></div></div>`;
  const wrap = ctx.root.firstElementChild;          // listeners live on this node, so they end with the page

  async function load(quiet = false) {
    try {
      d = await desk.get(`desk/leads/${id}`, null, quiet ? { background: true } : {});
    } catch (e) {
      if (!ctx.alive()) return;
      if (quiet) return;
      wrap.innerHTML = e.status === 404 ? notFound() : `<a class="back-link" href="#/inbox">${icon("left", "")}Inbox</a><div class="err-box" role="alert">${icon("alert", "")}<div><b>This lead could not load.</b><span class="muted">${esc(e.message || "")}</span></div><button class="btn" type="button" id="ld-retry">${icon("refresh")}Try again</button></div>`;
      wrap.querySelector("#ld-retry")?.addEventListener("click", () => load());
      return;
    }
    if (!ctx.alive()) return;
    setServerNow(d.server_now);
    paint();
    loadAcc();
  }

  /** Calls and briefs (ACCOUNTABILITY-SPEC 11.4): only while accountability is on and the lead is open to this person. */
  async function loadAcc() {
    const a = d?.allowed || {};
    if (!("call_attempt" in a) || (d.lead.status === "new" && !can("records.all"))) { acc = null; return; }
    try { acc = await desk.get(`desk/leads/${id}/acc`, null, { background: true }); accErr = false; }
    catch { acc = null; accErr = true; }
    if (!ctx.alive()) return;
    paintAcc();
    if (!autoOpened && acc) {
      autoOpened = true;
      if (ctx.query.get("brief") === "1" && a.brief) fillBrief();
      else if (ctx.query.get("proof") === "1" && a.proof_upload) addProof();
    } else if (briefAsked && acc && a.brief) {
      // the app asked for the brief while this lead was open (SPEC-SCREENSHOT-AI 4.2): the sheet opens straight away
      briefAsked = false;
      const b = briefToFill(acc, state.user?.engine_name || null);
      if (b && b.seat === state.user?.engine_name && !document.querySelector(".brief-sheet")) fillBrief(+b.id);
    }
  }
  function paintAcc() {
    const host = wrap.querySelector("#ld-acc"), duty = wrap.querySelector("#ld-duty");
    if (duty) duty.innerHTML = dutyPanel(d, acc, accErr);
    if (host) host.innerHTML = accCard(d, acc, accErr);
  }

  function paint() {
    const l = d.lead, a = d.allowed || {};
    const act = can("desk.leads.act");
    const locked = l.status === "new" && !can("records.all");
    const accOn = "call_attempt" in a;
    const stage = l.status === "lost" ? "lost" : l.status === "escalated" ? "escalated" : l.stage || l.status;
    const y = window.scrollY;
    wrap.innerHTML = `<div class="lead-page">
      <div class="lead-crumbs"><a class="back-link" href="#/inbox">${icon("left", "")}Inbox</a></div>
      <section class="lead-head tier-${esc(l.tier_key || "none")}">
        <div class="lh-top"><span class="lc-ch">${esc(channelLabel(l.channel))}</span><span class="lc-id">#${l.id}</span><span>${esc(deskAgo(l.first_seen_ts))}</span></div>
        <h1 class="page-title lead-name">${esc(l.name || "Customer")}</h1>
        <div class="lh-car">${esc(l.car || "No car named yet")}</div>
        <div class="lc-meta">${l.budget ? `<span class="lc-budget">${esc(lakh(l.budget))} budget</span>` : ""}${l.tier ? `<span class="tier-tag">${esc(l.tier)}</span>` : ""}<span class="lc-holder">${l.mine ? "Yours" : l.salesman ? `With ${esc(l.salesman)}` : "Not assigned"}</span></div>
        ${stepper(stage)}
      </section>
      ${a.claim && act ? claimPanel(l) : l.claim ? `<div class="ld-clock">${clockHtml(l.claim, { big: true })}<span class="muted">${l.mine ? "Claim it before the clock runs out" : `Waiting for ${esc(l.salesman || "the salesman")} to claim`}</span></div>` : ""}
      ${contactRow(l, a, locked, accOn)}
      ${accOn && !locked ? `<div id="ld-duty">${dutyPanel(d, acc, accErr)}</div>` : ""}
      ${act ? actionGrid(l, a) : can("records.all") ? `<p class="muted ld-readonly">${icon("eye", "")}You can see this lead. Only the salesman, the manager and the partners can act on it.</p>` : ""}
      ${l.status === "sold" && can("deals.create") ? `<div class="strip">${icon("tag", "")}<span><b>Sold. Book the deal next.</b><span class="muted">Price, payment and papers go on the Deals page, not here.</span></span><a class="btn sm" href="#/deals">Book the deal</a></div>` : ""}
      ${accOn && !locked ? `<section class="card ld-acc" id="ld-acc" aria-live="polite">${accCard(d, acc, accErr)}</section>` : ""}
      <div class="lead-cols">
        <section class="card ld-conv">${conversation(d, locked)}</section>
        <section class="card ld-time"><div class="card-h"><h2>Timeline</h2></div>${timeline(d)}</section>
      </div>
    </div>`;
    if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
  }

  wrap.addEventListener("click", async (e) => {
    const back = e.target.closest(".back-link");
    if (back && /^#\/inbox/.test(state.prevHash || "")) { e.preventDefault(); history.back(); return; }   // the same list, same place
    const b = e.target.closest("[data-act]"); if (!b || !d) return;
    const what = b.dataset.act, l = d.lead;
    if (what === "claim") return claim(b);
    if (what === "contacted") return statusForm("Mark as contacted", "You spoke to the customer or replied to them.", [{ name: "note", label: "Note (optional)", type: "textarea", full: true, placeholder: "Kya baat hui? e.g. wants a test drive on Sunday" }], (v) => ({ status: "contacted", note: v.note || "" }), "Marked as contacted");
    if (what === "visit_booked") return statusForm("Visit booked", "When is the customer coming to the showroom?", [
      { name: "date", label: "Date", type: "date", required: true, value: new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10) },
      { name: "time", label: "Time", type: "time", required: true, value: "17:00" },
      { name: "note", label: "Note (optional)", type: "textarea", full: true }], (v) => ({ status: "visit_booked", at: `${v.date} ${v.time}`, note: v.note || "" }), "Visit booked");
    if (what === "test_drive") return statusForm("Test drive", "Which car did the customer drive?", [
      { name: "car", label: "Car", required: true, full: true, value: l.car || "" },
      { name: "note", label: "Note (optional)", type: "textarea", full: true }], (v) => ({ status: "test_drive", car: v.car, note: v.note || "" }), "Test drive saved");
    if (what === "sold") return statusForm("Sold", "Great work. No price here: the deal is booked on the Deals page.", [
      { name: "car", label: "Car sold", required: true, full: true, value: l.car || "" },
      { name: "token", label: "Token taken?", type: "select", required: true, full: true, options: [["1", "Yes, token taken"], ["0", "Not yet"]] },
      { name: "note", label: "Note (optional)", type: "textarea", full: true }], (v) => {
      if (v.token !== "1" && v.token !== "0") { const err = new Error("Choose yes or no."); err.fields = { token: "Choose yes or no." }; throw err; }   // no default: a quick Save must not record a token
      return { status: "sold", car: v.car, token_taken: v.token === "1", note: v.note || "" };
    }, "Marked as sold", true);
    if (what === "lost") return statusForm("Lost", "Why did this lead not buy? It helps the team learn.", [
      { name: "lost_reason", label: "Reason", type: "select", required: true, full: true, options: LOST },
      { name: "note", label: "Note (optional)", type: "textarea", full: true }], (v) => ({ status: "lost", lost_reason: v.lost_reason, note: v.note || "" }), "Marked as lost", false, true);
    if (what === "note") return noteForm();
    if (what === "ai") return aiCallForm();
    if (what === "exotel") return exotel(b);
    if (what === "reply") return reply(b);
    if (what === "demo-call") { toast("Demo: calling is off.", "demo"); }
    if (what === "acc-call") return accCall(b);
    if (what === "brief") return fillBrief(b.dataset.brief ? +b.dataset.brief : undefined);
    if (what === "proof") return addProof();
    if (what === "reassign") return openReassign({ leadId: id, seats: acc?.seats || [], current: l.salesman, onDone: () => load(true) });
    if (what === "acc-retry") { accErr = false; paintAcc(); return loadAcc(); }
  });

  /** The Call button with accountability on (2.2, 2.3): the attempt is recorded first, then the phone dials. */
  async function accCall(btn, via = exotelOn() ? "exotel" : "tel") {
    const l = d.lead;
    btn.disabled = true;
    const label = btn.innerHTML;
    btn.innerHTML = `<span class="spin"></span> ${via === "exotel" ? "Connecting" : "Calling"}`;
    try {
      const r = await desk.post(`desk/leads/${id}/call-attempt`, { via });
      if (r.mode === "tel" && r.tel_url) location.href = r.tel_url;
      else if (r.mode === "exotel") toast(r.message || "Ringing your phone now. Pick up, then the customer is connected.", "ok");
      else if (DEMO) toast(`Demo: the call is recorded and no phone dials. The app asks for the brief at ${r.brief_prompt_at ? deskTime(r.brief_prompt_at) : "10 minutes from now"}.`, "demo");
      else toast("Call recorded. Your number cannot be shown here: call from the lead's card in your phone.", "");
      setTimeout(() => load(true), 600);
    } catch (e) {
      if (e.status === 503 || e.status === 0) {
        if (l.tel_url && await confirmDialog({ title: "Call not recorded", text: "The lead engine is not answering, so this call is not recorded. Calling the customer comes first. Call anyway?", confirmLabel: "Call anyway" })) location.href = l.tel_url;
        else if (!l.tel_url) toast(e.message || "The lead engine is not answering.", "err");
      } else if (e.code === "exotel_failed") {
        if (await confirmDialog({ title: "Exotel could not connect", text: "The business number could not connect this call. Use your phone this time? A screenshot will be asked for.", confirmLabel: "Use my phone" })) { btn.innerHTML = label; btn.disabled = false; return accCall(btn, "tel"); }
      } else if (e.code === "use_exotel") toast("Call through the business number: the customer's number stays hidden.", "err");
      else toast(e.message || "Could not start the call.", "err");
    }
    btn.disabled = false; btn.innerHTML = label;
  }

  function fillBrief(briefId) {
    const mine = briefToFill(acc, state.user?.engine_name || null);
    const b = briefId ? (acc?.briefs || []).find((x) => x.id === briefId) || { id: briefId } : mine;
    return openBrief({ leadId: id, briefId: b ? b.id : null, outcomes: acc?.brief_outcomes || OUTCOMES, late: b?.state === "missed",
      onDone: (r) => {
        load(true);
        if (r.suggest === "book_visit" && d.allowed?.visit_booked !== false) toast("Next: book the visit.", "", { label: "Book the visit", onClick: () => wrap.querySelector('[data-act="visit_booked"]')?.click() });
        if (r.suggest === "close_lost") toast("Close this lead as lost?", "", { label: "Close as lost", onClick: () => wrap.querySelector('[data-act="lost"]')?.click() });
      } });
  }
  function addProof() {
    return openProof({ leadId: id, firstCallAt: acc?.state?.first_call_at || (acc?.attempts || [])[0]?.ts || null, onDone: () => load(true) });
  }

  async function claim(btn) {
    btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Claiming`;
    try { await desk.post(`desk/leads/${id}/claim`, {}); desk.done(`Lead #${id} is yours. Call the customer now`); }
    catch (e) {
      if (e.code === "brief_overdue" && e.body?.detail?.lead_id) { toast("Fill your overdue brief first, then claim.", "err"); ctx.go(`#/lead/${+e.body.detail.lead_id}?brief=1`); return; }
      toast(e.code === "already_claimed" ? e.message || "Someone claimed it first." : e.message || "Could not claim. Try again.", "err");
    }
    await load(true);
  }

  function statusForm(title, sub, fields, body, okMsg, sold = false, danger = false) {
    const f = formDrawer({ title, sub: esc(sub), fields, submit: "Save", ok: "", danger,
      onSubmit: async (v) => {
        try { await desk.post(`desk/leads/${id}/status`, body(v)); }
        catch (e) {
          if (e.code === "brief_first") { f.close(); toast("Fill the call brief first.", "err"); fillBrief(e.body?.detail?.brief_id); return false; }
          if (e.code === "use_brief") { f.close(); toast("Fill the call brief instead: a \"Spoke\" brief marks the lead contacted.", "err"); fillBrief(); return false; }
          throw e;
        }
        desk.done(okMsg);
        if (sold && can("deals.create")) toast("Next: book the deal with the price and papers.", "", { label: "Book the deal", onClick: () => ctx.go("#/deals") });
        load(true);
      } });
    f.el.classList.add("sheet");
  }

  function noteForm() {
    const f = formDrawer({ title: "Add a note", sub: "Only staff see notes. Up to 500 letters.", submit: "Save note", ok: "",
      fields: [{ name: "text", label: "Note", type: "textarea", required: true, full: true, placeholder: "e.g. Customer will bring his father on Sunday" }],
      onSubmit: async (v) => {
        const text = (v.text || "").slice(0, 500);
        if (!text) { const err = new Error("Write a note first."); err.fields = { text: "required" }; throw err; }
        await desk.post(`desk/leads/${id}/notes`, { text });
        desk.done("Note saved"); load(true);
      } });
    f.el.classList.add("sheet");
    const ta = f.el.querySelector("textarea"); if (ta) ta.maxLength = 500;
  }

  function aiCallForm() {
    const f = formDrawer({ title: "Ask Anita to call or WhatsApp", sub: "Anita is the AI assistant. She calls or messages only in calling hours. You will see what she will say before anything happens.", submit: "Preview", ok: "",
      fields: [
        { name: "channel", label: "How", type: "select", required: true, full: true, options: AI_CHANNELS, value: "call" },
        { name: "purpose", label: "What for", type: "select", required: true, full: true, options: PURPOSES, value: "callback" },
        { name: "when", label: "When", required: true, full: true, placeholder: "e.g. today 5 pm, kal 11 baje" },
        { name: "note", label: "Anything she should mention (optional)", type: "textarea", full: true }],
      onSubmit: async (v, dr) => {
        const r = await desk.post(`desk/leads/${id}/ai-call`, { purpose: v.purpose, channel: v.channel || "call", when: v.when, note: v.note || "" });
        setTimeout(() => confirmAi(r, (r.channel || v.channel) === "whatsapp"), 300);   // the engine says which channel it stored
        void dr;
      } });
    f.el.classList.add("sheet");
    const how = f.form.elements.channel, what = f.form.elements.purpose; let picked = false;   // feedback is a WhatsApp survey:
    how.addEventListener("change", () => { picked = true; });                                   // it defaults to WhatsApp until
    what.addEventListener("change", () => { if (!picked) how.value = what.value === "feedback" ? "whatsapp" : "call"; });   // "How" is set by hand
  }
  function confirmAi(r, wa) {
    const f = formDrawer({ title: wa ? "Confirm the WhatsApp" : "Confirm the call", sub: r.due_at ? `Planned for ${esc(deskTime(r.due_at))}` : "",
      submit: wa ? "Yes, send the WhatsApp" : "Yes, book the call", ok: "", cancel: "Cancel",
      before: `<div class="ai-preview">${icon(wa ? "send" : "phone", "")}<p>${esc(r.preview || "")}</p></div>`, fields: [],
      onSubmit: async () => { await desk.post(`desk/ai-actions/${r.action_id}/confirm`, {}); desk.done(wa ? "AI WhatsApp booked" : "AI call booked"); load(true); } });
    f.el.classList.add("sheet");
    f.el.querySelector("[data-x]")?.addEventListener("click", () => { desk.post(`desk/ai-actions/${r.action_id}/cancel`, {}).catch(() => {}); });
  }

  async function exotel(btn) {
    btn.disabled = true;
    try { const r = await desk.post(`desk/leads/${id}/call`, {}); toast(r.message || "Ringing your phone now. Pick up, then the customer is connected.", "ok"); }
    catch (e) { toast(e.code === "feature_off" && DEMO ? "Demo: calling is off." : e.message || "Could not start the call.", e.code === "feature_off" ? "demo" : "err"); }
    btn.disabled = false;
  }
  async function reply(btn) {
    const ta = wrap.querySelector("#ld-reply"); const text = (ta?.value || "").trim();
    if (!text) { ta?.focus(); return; }
    btn.disabled = true;
    try { await desk.post(`desk/leads/${id}/reply`, { text: text.slice(0, 1000) }); ta.value = ""; desk.done("Reply sent on WhatsApp"); load(true); }
    catch (e) {
      const msg = e.code === "outside_24h" ? "WhatsApp allows free replies only within 24 hours of the customer's last message. Call instead." : e.code === "channel_not_connected" ? "WhatsApp is not connected to the app yet. Use the WhatsApp button." : e.message;
      toast(msg || "Could not send.", e.code === "feature_off" ? "demo" : "err");
    }
    btn.disabled = false;
  }

  onFeed((row) => {
    if (!/^lead\./.test(row.kind || "") || (row.lead_id && row.lead_id !== id)) return;
    if (row.why === "brief_prompt" && row.lead_id === id) briefAsked = true;
    load(true);
  });
  await load();
}

// ------------------------------------------------------------------ call accountability on the lead page
/** What is due on this lead now: call, brief, screenshot (with the buttons for the person who can do them). */
function dutyPanel(d, acc, accErr) {
  if (accErr) return "";
  if (!acc) return `<div class="duty skel" aria-hidden="true"></div>`;
  const a = d.allowed || {}, l = d.lead, st = acc.state || {}, me = state.user?.engine_name || null;
  const rows = [];
  if (st.call_due_at && !st.first_call_at && l.status === "claimed") {
    rows.push(`<div class="duty-row k-call"><span class="duty-ic">${icon("phone", "")}</span><span class="duty-t"><b>Call the customer</b><small>Press Call below. If nobody calls in time, the lead moves on.</small></span>${clockHtml({ deadline_at: st.call_due_at })}</div>`);
  }
  const b = briefToFill(acc, null);
  if (b) {
    const mine = b.seat === me;
    rows.push(`<div class="duty-row k-brief${b.state === "missed" ? " missed" : ""}"><span class="duty-ic">${icon("edit", "")}</span><span class="duty-t"><b>${b.state === "pending" ? "Fill the brief after the call" : "Brief for this call"}</b><small>${mine ? "Outcome, what the customer said, the plan and the next step." : `${esc(b.seat)} fills it.`}</small></span>${b.due_at ? dueChip({ kind: "brief", due_at: b.due_at, state: b.state }) : ""}${mine && a.brief ? `<button class="btn primary sm" type="button" data-act="brief" data-brief="${+b.id}">Fill brief</button>` : ""}</div>`);
  }
  const p = acc.proof;
  if (p && ["due", "missed", "rejected"].includes(p.state)) {
    rows.push(`<div class="duty-row k-proof${p.state !== "due" ? " missed" : ""}"><span class="duty-ic">${icon("camera", "")}</span><span class="duty-t"><b>${p.state === "rejected" ? "Screenshot rejected: send a clearer one" : "Call-history screenshot"}</b><small>${p.state === "rejected" && p.review_note ? esc(p.review_note) : "It shows the customer's number, the time and the duration."}</small></span>${p.state === "rejected" ? "" : dueChip({ kind: "proof", due_at: p.due_at, state: p.state })}${a.proof_upload ? `<button class="btn primary sm" type="button" data-act="proof">Add screenshot</button>` : ""}</div>`);
  }
  if (!rows.length) {
    return a.brief ? `<div class="duty quiet"><span>${icon("check", "")}Nothing due on this lead.</span><button class="btn sm ghost" type="button" data-act="brief">Add a brief</button></div>` : "";
  }
  return `<section class="duty" aria-label="Due on this lead">${rows.join("")}</section>`;
}

/** The Calls and briefs card: attempts, briefs, the screenshot and the passes. */
function accCard(d, acc, accErr) {
  if (accErr) return `<div class="card-h"><h2>Calls and briefs</h2></div><div class="notice warn" role="note">${icon("alert", "")}<span>Calls and briefs are unavailable right now: the lead engine is not answering.</span><button class="btn sm" type="button" data-act="acc-retry">${icon("refresh")}Try again</button></div>`;
  if (!acc) return `<div class="card-h"><h2>Calls and briefs</h2></div><div class="skel h96"></div>`;
  const outs = acc.brief_outcomes || OUTCOMES;
  const att = (acc.attempts || []).slice().reverse(), briefs = (acc.briefs || []).slice().reverse(), passes = acc.passes || [];
  const p = acc.proof;
  const st = acc.state || {};
  const attHtml = att.length ? `<ol class="acc-list">${att.map((x) => `<li><span class="acc-ic${x.verified ? " ok" : ""}">${icon("phone", "")}</span><div><b>${esc(deskTime(x.ts))}</b> <span class="muted">${esc(SOURCE[x.source] || x.source || "")}${x.seat ? ` · ${esc(x.seat)}` : ""}</span>
      <p>${esc(CALL_STATUS[x.status] || x.status || "")}${x.talk_s ? ` · talked ${esc(fmtDur(x.talk_s))}` : x.duration_s ? ` · ${esc(fmtDur(x.duration_s))}` : ""}${x.verified ? ` · ${icon("check", "")}verified` : ""}</p>
      ${x.recording_url ? `<audio class="ld-audio" controls preload="none" src="${esc(x.recording_url)}">Your browser cannot play this recording.</audio>` : ""}</div></li>`).join("")}</ol>` : `<p class="muted small-note">${icon("phone", "")}No call recorded yet.</p>`;
  const briefHtml = briefs.length ? `<ol class="acc-list">${briefs.map((b) => {
    const [lab, cls] = BRIEF_STATE[b.state] || [b.state, ""];
    const filled = b.state === "submitted" || b.state === "late";
    return `<li><span class="acc-ic">${icon("edit", "")}</span><div><b>${filled ? esc(outcomeLabel(b.outcome, outs)) : "Brief"}</b> <span class="badge ${cls}">${esc(lab)}</span>${b.interest && b.interest !== "none" ? ` <span class="badge int-${esc(b.interest)}">${esc(INTEREST_LABEL[b.interest] || b.interest)}</span>` : ""}
      ${b.customer_said ? `<p class="acc-said">“${esc(b.customer_said)}”</p>` : ""}${b.plan ? `<p><span class="muted">Plan:</span> ${esc(b.plan)}</p>` : ""}
      ${b.next_step ? `<p><span class="muted">Next:</span> ${esc(b.next_step)}${b.next_step_at ? ` · ${esc(deskTime(b.next_step_at))}` : ""}</p>` : filled && b.next_step_at ? `<p><span class="muted">Next:</span> ${esc(deskTime(b.next_step_at))}</p>` : ""}
      <time>${filled ? `Filled ${esc(deskTime(b.submitted_at))}` : b.due_at ? `Due ${esc(deskTime(b.due_at))}` : ""} · ${esc(b.seat || "")}</time></div></li>`;
  }).join("")}</ol>` : "";
  const [plab, pcls] = p ? PROOF_STATE[p.state] || [p.state, ""] : [];
  const checks = p && p.checks && typeof p.checks === "object" ? Object.entries(p.checks).filter(([, v]) => v === false).map(([k]) => k) : [];
  // the AI's tick next to the screenshot: only sent to people who check screenshots (SPEC-SCREENSHOT-AI 2.10)
  const tick = p && p.tick ? `<div class="acc-tick">${tickChip(p.tick)}${flagChip(p.tick)}</div>${shows(p.tick) ? `<p class="muted acc-shows">${esc(shows(p.tick))}</p>` : ""}` : "";
  const proofHtml = p ? `<div class="acc-proof">${p.image_url ? `<a class="acc-thumb" href="${esc(p.image_url)}" target="_blank" rel="noopener"><img src="${esc(p.image_url)}" alt="Call-history screenshot for this lead" loading="lazy"></a>` : `<span class="acc-thumb none">${icon(p.tick?.source === "exotel" ? "phone" : "camera", "")}</span>`}
      <div><b>Call screenshot</b> <span class="badge ${pcls}">${esc(plab)}</span>${p.late ? ` <span class="badge warn">Late</span>` : ""}${tick}
      <p class="muted">${p.declared_call_at ? `Call at ${esc(deskTime(p.declared_call_at))} · ${esc(fmtDur(p.declared_duration_s))}` : p.due_at ? `Due ${esc(deskTime(p.due_at))}` : ""}</p>
      ${checks.length ? `<p class="acc-flags">${icon("alert", "")}Check: ${checks.map((k) => esc({ after_call_press: "time before the Call press", in_window: "time before the claim", on_time: "sent late", duration_vs_brief: "duration vs brief", duplicate: "screenshot used before" }[k] || k)).join(", ")}</p>` : ""}
      ${p.review_note ? `<p><span class="muted">Manager:</span> ${esc(p.review_note)}</p>` : ""}</div></div>` : "";
  const passHtml = passes.length ? `<div class="acc-passes"><span class="eyebrow">How it reached ${esc(d.lead.salesman || "this seat")}</span><ol>${passes.map((x) => `<li><span>${esc(x.from || "New")}</span>${icon("right", "")}<span>${esc(x.to || "")}</span><small>${esc(PASS_WHY[x.reason] || x.reason || "")}${x.round ? ` · round ${+x.round}` : ""}${x.by ? ` · by ${esc(x.by)}` : ""} · ${esc(deskTime(x.ts))}</small></li>`).join("")}</ol></div>` : "";
  const warns = (acc.warnings || []).filter((w) => w.status === "active");
  const warnHtml = warns.length ? `<p class="acc-warns">${icon("flag", "")}${warns.map((w) => `${esc(WARN[w.type] || w.type)}${can("acc.team") ? `: ${esc(w.seat)}` : ""}`).join(" · ")} · <a href="#/calls">see warnings</a></p>` : "";
  const sub = st.claimed_at ? `Claimed ${esc(deskTime(st.claimed_at))}${st.first_call_at ? ` · first call ${esc(deskTime(st.first_call_at))}` : ""}${st.max_rounds && st.pass_no ? ` · passed ${+st.pass_no} time${st.pass_no === 1 ? "" : "s"}` : ""}` : "";
  return `<div class="card-h"><div><h2>Calls and briefs</h2>${sub ? `<div class="card-sub">${sub}</div>` : ""}</div></div>
    <div class="acc-cols"><div><h3 class="eyebrow">Calls</h3>${attHtml}</div><div>${briefHtml ? `<h3 class="eyebrow">Briefs</h3>${briefHtml}` : ""}${proofHtml}</div></div>${passHtml}${warnHtml}`;
}

function notFound() {
  return `<a class="back-link" href="#/inbox">${icon("left", "")}Inbox</a><div class="empty">${icon("inbox", "")}<b>This lead is not in your inbox</b><p>It may belong to another salesman, or the link is old.</p><a class="btn" href="#/inbox">Back to the inbox</a></div>`;
}

function stepper(stage) {
  if (stage === "lost") return `<div class="stepper lost"><span class="badge neg">Lost</span></div>`;
  const at = STAGES.indexOf(stage === "escalated" ? "new" : stage);
  return `<ol class="stepper" aria-label="Progress">${STAGES.map((s, i) => `<li class="${i < at ? "done" : i === at ? "now" : ""}"${i === at ? ' aria-current="step"' : ""}><span class="dot"></span><span class="lab">${esc(STAGE_LABEL[s])}</span></li>`).join("")}</ol>${stage === "escalated" ? `<span class="badge warn">Escalated</span>` : ""}`;
}

function claimPanel(l) {
  return `<section class="claim-panel">
    ${l.claim ? clockHtml(l.claim, { big: true }) : ""}
    <button class="btn primary claim-btn" type="button" data-act="claim">${icon("check")}Claim this lead</button>
    <p class="muted">${l.mine ? "This lead is yours if you claim it in time. Otherwise it moves to the next salesman." : `Assigned to ${esc(l.salesman || "another salesman")}, but anyone in this price band may claim it first.`}</p>
  </section>`;
}

function contactRow(l, a, locked, accOn = false) {
  if (locked) return `<div class="ld-locked">${icon("lock", "")}<span>Phone, chat and recording open after you claim.</span></div>`;
  const btns = [];
  if (accOn) {                 // the call is recorded first, then the phone dials (or Exotel rings his phone)
    if (a.call_attempt) btns.push(`<button class="btn pos big-btn" type="button" data-act="acc-call">${icon("phone")}${exotelOn() ? "Call via business number" : "Call"}</button>`);
  } else if (a.call_tel && l.tel_url) btns.push(`<a class="btn pos big-btn" href="${esc(l.tel_url)}">${icon("phone")}Call</a>`);
  if (a.whatsapp_link && l.whatsapp_url) btns.push(`<a class="btn big-btn wa-btn" href="${esc(l.whatsapp_url)}" target="_blank" rel="noopener noreferrer">${icon("wa")}WhatsApp</a>`);
  if (a.call_exotel && !accOn) btns.push(`<button class="btn big-btn" type="button" data-act="exotel">${icon("phone")}Call via business number</button>`);
  if (!btns.length && can("desk.leads.act") && l.status !== "new") {
    if (DEMO) btns.push(`<button class="btn pos big-btn" type="button" data-act="demo-call">${icon("phone")}Call</button>`, `<button class="btn big-btn wa-btn" type="button" data-act="demo-call">${icon("wa")}WhatsApp</button>`);
  } else if (DEMO && accOn && !(a.whatsapp_link && l.whatsapp_url) && l.status !== "new") {
    btns.push(`<button class="btn big-btn wa-btn" type="button" data-act="demo-call">${icon("wa")}WhatsApp</button>`);   // the demo has no numbers
  }
  const phone = l.phone_display ? `<span class="ld-phone">${icon("phone", "")}${esc(l.phone_display)}</span>` : "";
  if (!btns.length && !phone) return "";
  return `<div class="ld-contact">${phone}<div class="ld-contact-btns">${btns.join("")}</div></div>`;
}

function actionGrid(l, a) {
  const B = (k, label, ic, cls = "") => (a[k] ? `<button class="btn act-btn ${cls}" type="button" data-act="${k === "ai_call" ? "ai" : k}">${icon(ic)}<span>${esc(label)}</span></button>` : "");
  const list = [B("contacted", "Contacted", "phone"), B("visit_booked", "Visit booked", "calendar"), B("test_drive", "Test drive", "car"),
    B("sold", "Sold", "tag", "good"), B("lost", "Lost", "x", "bad"), B("note", "Add note", "edit"), B("ai_call", "Ask Anita (call or WhatsApp)", "spark"),
    B("reassign", "Move to another salesman", "repeat")].filter(Boolean);
  if (!list.length) return l.status === "new" ? "" : `<p class="muted ld-readonly">${icon("check", "")}Nothing more to do on this lead.</p>`;
  return `<section class="ld-actions" aria-label="Update this lead"><h2 class="eyebrow">Update the lead</h2><div class="act-grid">${list.join("")}</div></section>`;
}

function conversation(d, locked) {
  if (locked) return `<div class="card-h"><h2>Conversation</h2></div><div class="empty small">${icon("lock", "")}<b>Opens after you claim</b><p>The chat with Anita and any call recording show here once the lead is yours.</p></div>`;
  const parts = [];
  const t = d.thread;
  if (t && t.unavailable || d.call && d.call.unavailable) parts.push(`<div class="notice warn" role="note">${icon("alert", "")}<span>The lead engine is not answering, so the conversation cannot show right now. Try again in a minute.</span></div>`);
  if (t && t.messages) {
    parts.push(`<div class="card-h"><h2>${esc(channelLabel(t.channel))} chat</h2>${t.updated_at ? `<span class="card-sub">Last message ${esc(deskTime(t.updated_at))}</span>` : ""}</div>
      <ol class="thread">${t.messages.map((m) => `<li class="msg ${m.who === "customer" ? "them" : m.who === "staff" ? "us" : "bot"}"><span class="who">${esc(m.who === "customer" ? "Customer" : m.who === "anita" ? `${m.name || "Anita"} (AI)` : m.name || "Staff")}</span><p>${esc(m.text)}</p></li>`).join("")}</ol>
      ${d.allowed?.reply_inapp ? `<div class="ld-reply"><label class="sr" for="ld-reply">Reply on WhatsApp</label><textarea class="textarea" id="ld-reply" rows="2" maxlength="1000" placeholder="Reply on WhatsApp"></textarea><button class="btn primary" type="button" data-act="reply">${icon("send")}Send</button></div>` : ""}`);
  }
  const c = d.call;
  if (c && c.lines) {
    parts.push(`<div class="card-h"><h2>Phone call</h2>${c.duration_min ? `<span class="card-sub">${esc(c.duration_min)} min</span>` : ""}</div>
      ${c.has_recording ? `<audio class="ld-audio" controls preload="none" src="/api/desk/leads/${d.lead.id}/recording">Your browser cannot play this recording.</audio>` : `<p class="muted small-note">${icon("mic", "")}No recording for this call.</p>`}
      <ol class="thread">${c.lines.map((m) => `<li class="msg ${m.who === "caller" ? "them" : "bot"}"><span class="who">${m.who === "caller" ? "Customer" : "Anita (AI)"}</span><p>${esc(m.text)}</p></li>`).join("")}</ol>
      ${c.shortened ? `<p class="muted small-note">Transcript shortened.</p>` : ""}`);
  }
  if (!parts.length) return `<div class="card-h"><h2>Conversation</h2></div><div class="empty small">${icon("leads", "")}<b>No conversation saved</b><p>Leads from portals and walk-ins may not have one.</p></div>`;
  return parts.join("");
}

/** "today 17:00", "tomorrow 11:30", "6 Oct 17:00". */
function visitWhen(ts) {
  const day = String(ts).slice(0, 10), hm = String(ts).slice(11, 16);
  const ist = (ms) => new Date(ms + 5.5 * 36e5).toISOString().slice(0, 10);
  if (day === ist(deskNow())) return `today ${hm}`;
  if (day === ist(deskNow() + 864e5)) return `tomorrow ${hm}`;
  return deskTime(ts);
}

/** A short line for an accountability event's note (codes, ids and staff names only). */
function accNote(kind, note) {
  const p = String(note || "").split("|").map((x) => x.trim());
  if (kind === "pass") return `${p[1] || "?"} → ${p[2] || "?"} · ${PASS_WHY[p[0]] || p[0]}${p[3] ? ` · round ${p[3]} of ${p[4] || "?"}` : ""}`;
  if (kind === "reassigned_manual") return `${p[1] || "?"} → ${p[2] || "?"} · by ${p[0] || "a manager"}`;
  if (kind === "released") return p[0] === "missing_proof" ? "No call screenshot in time: moved on" : "No call in time: moved on";
  if (kind === "escalated") return p[0] === "max_rounds" ? `Went round the team ${p[1] || ""} times: now with the partners or manager` : note;
  if (kind === "call_attempt") return SOURCE[p[1]] || null;
  if (kind === "call_result") return `${CALL_STATUS[p[1]] || p[1] || ""}${+p[2] ? ` · talked ${fmtDur(+p[2])}` : ""}`;
  if (kind === "brief_prompt") return p[1] && p[1].length >= 16 ? `Due ${deskTime(p[1])}` : null;
  if (kind === "brief_reminder") return p[1] ? `Reminder ${p[1]}` : null;
  if (kind === "brief_submitted" || kind === "brief_late") return outcomeLabel(p[1]) || null;
  if (kind === "warning") return WARN[p[0]] || p[0] || null;
  if (kind === "proof_ai") return VERDICT_SHORT[p[1]] || null;          // the verdict's words, no time or duration
  return null;
}

function timeline(d) {
  const rows = (d.timeline || []).slice().reverse();
  if (!rows.length) return `<p class="muted">Nothing yet.</p>`;
  return `<ol class="ld-timeline">${rows.map((r) => {
    const [label, ic] = KIND[r.kind] || [sentence(r.kind || "update"), "info"];
    let note = r.note;
    if (ACC_KINDS.has(r.kind)) note = accNote(r.kind, note);
    if (r.kind === "lost" && LOST_LABEL[note]) note = LOST_LABEL[note];
    if (r.kind === "visit_booked" && note && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(note)) note = `For ${visitWhen(note)}`;
    // the engine writes these on the seat that RECEIVED the lead: "→ Bhavin", never "by Bhavin"
    const rel = TO_SEAT.has(r.kind) ? "→" : r.kind === "released" ? "from" : r.kind === "warning" || r.kind === "warning_excused" ? "for" : "by";
    const who = r.who ? ` <span class="muted">${rel} ${esc(r.who)}</span>` : "";
    return `<li class="k-${esc(r.kind)}"><span class="ic">${icon(ic, "")}</span><div><b>${esc(label)}</b>${who}${note ? `<p>${esc(note)}</p>` : ""}<time>${esc(deskTime(r.ts))}</time></div></li>`;
  }).join("")}</ol>${d.annotation?.lost_reason ? `<p class="muted small-note">Lost because: ${esc(LOST_LABEL[d.annotation.lost_reason] || d.annotation.lost_reason)}</p>` : ""}`;
}
