// Call accountability pieces shared by the Inbox, the lead page and the Calls, Screenshots and Call rules screens
// (classic-auto/accountability-6oct/ACCOUNTABILITY-SPEC.md sections 3, 4, 7, 8, 11.4). The engine decides what is due and
// what counts; these screens show what it says and send what the person did. While accountability is off the server
// sends no acc keys at all, and nothing here is shown.
import { state } from "../state.js";
import { esc, icon } from "../util.js";
import { formDrawer, toast } from "../ui.js";
import * as desk from "../desk-api.js";
import { clockHtml, deskNow, deskTime, openSheet, shrinkPhoto } from "../desk.js";
import { istMs } from "../desk-mock.js";

// 3.1 (the engine sends its own list in acc/settings -> brief_outcomes; this copy is the fallback)
export const OUTCOMES = [
  { code: "spoke_interested", label: "Spoke: interested", spoke: true }, { code: "spoke_visit", label: "Spoke: visit or test drive fixed", spoke: true },
  { code: "spoke_callback", label: "Spoke: call back later", spoke: true }, { code: "spoke_negotiating", label: "Spoke: price, exchange or finance talk", spoke: true },
  { code: "spoke_not_interested", label: "Spoke: not interested", spoke: true }, { code: "spoke_bought", label: "Spoke: already bought elsewhere", spoke: true },
  { code: "no_answer", label: "Rang, no answer", spoke: false }, { code: "busy", label: "Busy or cut the call", spoke: false },
  { code: "unreachable", label: "Switched off or not reachable", spoke: false }, { code: "wrong_number", label: "Wrong number", spoke: false },
];
const NO_PLAN = new Set(["spoke_not_interested", "spoke_bought"]);
const NO_NEXT = new Set(["spoke_not_interested", "spoke_bought", "wrong_number"]);
export const INTEREST = [["hot", "Hot", "buying this week"], ["warm", "Warm", "this month"], ["cold", "Cold", "just looking"], ["none", "None", "no interest"]];
export const INTEREST_LABEL = Object.fromEntries(INTEREST.map(([k, l]) => [k, l]));
export const WARN = { no_claim: "No claim", no_call: "No call", missed_brief: "Missed brief", missing_proof: "No call proof", proof_rejected: "Screenshot rejected",
  brief_mismatch: "Brief does not match the call", customer_denied: "Customer says nobody called", rollcall_missed: "Missed roll-call", manual: "From the manager" };
export const CATEGORY = { behaviour: "Behaviour", poor_handling: "Poor handling of a lead", other: "Other" };
export const PASS_WHY = { new: "New lead", night: "Night queue", transfer: "Live transfer", no_claim: "Not claimed in time", no_call: "No call in time",
  missing_proof: "No call proof", off_duty: "Off duty", manual: "Moved by hand", max_rounds: "Went round the team" };
export const CHECKS = { image: "Image", after_call_press: "After the Call press", in_window: "After the claim", on_time: "On time",
  duration_vs_brief: "Duration fits the brief", duplicate: "Not used before" };
export const SOURCE = { app_tel: "Phone (app)", app_exotel: "Business number", telegram_call: "Telegram", telegram_contacted: "Telegram", anita_transfer: "Live transfer", exotel_inbound: "Customer called back" };
export const CALL_STATUS = { logged: "Logged", pending: "Ringing", connected: "Spoke", short: "Short call", customer_no_answer: "No answer", customer_busy: "Busy",
  salesman_no_answer: "You did not pick up", failed: "Failed", unknown: "Unknown" };
export const PROOF_STATE = { due: ["Screenshot due", "warn"], submitted: ["Waiting for a check", "info"], approved: ["Approved", "pos"], approved_auto: ["Approved", "pos"],
  rejected: ["Rejected", "neg"], verified: ["Verified by call record", "pos"], waived: ["Waived", ""], missed: ["Missed", "neg"], cancelled: ["Cancelled", ""] };
export const BRIEF_STATE = { pending: ["Can fill now", "info"], open: ["Due", "warn"], submitted: ["Filled", "pos"], late: ["Filled late", "warn"], missed: ["Missed", "neg"], cancelled: ["Cancelled", ""] };

export const outcomeLabel = (code, list = OUTCOMES) => (list.find((o) => o.code === code) || {}).label || code || "";
export const fmtDur = (s) => (s === null || s === undefined || s === "" ? "—" : `${Math.floor(+s / 60)}:${String(+s % 60).padStart(2, "0")}`);
export const hm = (ts) => String(ts || "").slice(11, 16);
const uid = () => Math.random().toString(36).slice(2, 7);
const cap = (t) => String(t || "").charAt(0).toUpperCase() + String(t || "").slice(1);

/** The Desk flags (acc, acc_exotel) as /api/desk/config last said them; main.js loads them at start. */
export const accOn = () => !!state.deskFlags?.acc;
export const exotelOn = () => !!state.deskFlags?.acc_exotel;

// ------------------------------------------------------------------ due times and the To do strip
const KIND_TEXT = { claim: "Claim lead", call: "Call lead", brief: "Brief for lead", proof: "Screenshot for lead" };
const KIND_ICON = { claim: "check", call: "phone", brief: "edit", proof: "camera" };

/** A countdown for claim and call clocks, "due 11:48" for briefs and screenshots, red "overdue" when missed. */
export function dueChip(it) {
  if (it.state === "missed" || (it.due_at && istMs(it.due_at) < deskNow() - 30000 && (it.kind === "brief" || it.kind === "proof"))) {
    return `<span class="due-chip over">${icon("alert", "")}<span>overdue</span></span>`;
  }
  if (it.kind === "claim" || it.kind === "call") return clockHtml({ deadline_at: it.due_at });
  return `<span class="due-chip">${icon("clock", "")}<span>due ${esc(deskTime(it.due_at))}</span></span>`;
}

export function todoHref(it) {
  return `#/lead/${+it.lead_id}${it.kind === "brief" ? "?brief=1" : it.kind === "proof" ? "?proof=1" : ""}`;
}

/** The To do strip above the Inbox list (11.4). `t` is GET acc/todo. Up to `max` rows, then "n more". */
export function todoStrip(t, { max = 5, seatLabel = "" } = {}) {
  const items = (t?.items || []);
  const parts = [];
  if (t?.blocked_from_claiming) parts.push(`<div class="atd-block" role="alert">${icon("lock", "")}<span><b>Fill your overdue brief first.</b> You cannot claim new leads until it is in.</span></div>`);
  if (items.length) {
    const rows = items.slice(0, max).map((it) => `<a class="atd-row k-${esc(it.kind)}${it.state === "missed" ? " missed" : ""}" href="${todoHref(it)}">
      <span class="atd-ic">${icon(KIND_ICON[it.kind] || "clock", "")}</span><span class="atd-t">${esc(KIND_TEXT[it.kind] || "Lead")} <b>#${+it.lead_id}</b></span>${dueChip(it)}</a>`).join("");
    const more = items.length > max ? `<span class="atd-more">${items.length - max} more on your leads</span>` : "";
    parts.push(`<section class="atd" aria-label="To do"><div class="atd-h"><h2 class="eyebrow">To do${seatLabel ? ` · ${esc(seatLabel)}` : ""}</h2><span class="atd-n">${items.length}</span></div><div class="atd-list">${rows}</div>${more}</section>`);
  }
  if (t?.review_queue) parts.push(`<a class="strip notify atd-review" href="#/proofs">${icon("image", "")}<span><b>${+t.review_queue} screenshot${t.review_queue === 1 ? "" : "s"} to check</b><span class="muted">Call-history proof from the salesmen</span></span><span class="btn sm primary">Check</span></a>`);
  return parts.join("");
}

/** The small chip on an Inbox card for its next to-do. */
export function rowChip(a) {
  if (!a || !a.next) return "";
  const n = a.next, miss = n.state === "missed";
  const word = { call: "Call due", brief: "Brief due", proof: "Screenshot due", claim: "Claim" }[n.kind] || "To do";
  return `<span class="badge ${miss ? "neg" : "warn"} acc-chip">${icon(KIND_ICON[n.kind] || "clock", "")}${esc(miss ? word.replace(" due", "") + " overdue" : word)}${a.count > 1 ? ` +${a.count - 1}` : ""}</span>`;
}

// ------------------------------------------------------------------ the brief (3.1): a bottom sheet
/**
 * opts: leadId, briefId (null = an unprompted brief), outcomes (engine list), late (true when past due),
 * onDone(result) after a save. Only the person of the brief's seat can save it; the server says so if not.
 */
export function openBrief({ leadId, briefId = null, outcomes = OUTCOMES, late = false, onDone } = {}) {
  const id = "bf" + uid();
  const list = outcomes && outcomes.length ? outcomes : OUTCOMES;
  const chips = (spoke) => list.filter((o) => !!o.spoke === spoke).map((o) => `<label class="bf-chip"><input type="radio" name="outcome" value="${esc(o.code)}"><span>${esc(cap(o.label.replace(/^Spoke:\s*/, "")))}</span></label>`).join("");
  const today = new Date(deskNow() + 5.5 * 36e5).toISOString().slice(0, 10);
  const maxDay = new Date(deskNow() + 5.5 * 36e5 + 30 * 864e5).toISOString().slice(0, 10);
  const err = (k) => `<div class="err" data-err="${k}" role="alert" hidden></div>`;
  const body = `<form id="${id}" class="bf" novalidate>
    ${late ? `<div class="notice warn" role="note">${icon("clock", "")}<span>This brief is past its time. Fill it anyway: a late brief keeps the record honest, and the manager can excuse the warning.</span></div>` : ""}
    <fieldset class="bf-out"><legend>Call outcome <span class="req" aria-hidden="true">*</span></legend>
      <div class="bf-group"><span class="bf-gl">${icon("phone", "")}Spoke to the customer</span><div class="bf-chips">${chips(true)}</div></div>
      <div class="bf-group"><span class="bf-gl">${icon("x", "")}Did not speak</span><div class="bf-chips">${chips(false)}</div></div>
      ${err("outcome")}
    </fieldset>
    <div class="field" data-when="spoke" hidden><label for="${id}-said">What the customer said <span class="req" aria-hidden="true">*</span></label>
      <textarea class="textarea" id="${id}-said" name="customer_said" maxlength="500" rows="3" placeholder="Kya bola customer ne? Tap the mic on your keyboard to say it."></textarea>${err("customer_said")}</div>
    <div class="field" data-when="plan" hidden><label for="${id}-plan">Plan of action <span class="req" aria-hidden="true">*</span></label>
      <textarea class="textarea" id="${id}-plan" name="plan" maxlength="500" rows="2" placeholder="e.g. Keep the car ready, check the exchange value"></textarea>${err("plan")}</div>
    <div class="field" data-when="next" hidden><label for="${id}-next" data-next-label>Next step <span class="req" aria-hidden="true">*</span></label>
      <input class="input" id="${id}-next" name="next_step" maxlength="200" placeholder="e.g. Confirm the visit on Saturday">${err("next_step")}</div>
    <div class="bf-when" data-when="next" hidden>
      <div class="field"><label for="${id}-d" data-when-label>Date</label><input class="input" type="date" id="${id}-d" name="ns_date" min="${today}" max="${maxDay}"></div>
      <div class="field"><label for="${id}-t">Time</label><input class="input" type="time" id="${id}-t" name="ns_time"></div>
      ${err("next_step_at")}
    </div>
    <fieldset class="field bf-int-f" data-when="spoke" hidden><legend>Customer interest <span class="req" aria-hidden="true">*</span></legend>
      <div class="bf-int">${INTEREST.map(([k, l, s]) => `<label class="bf-chip int-${k}"><input type="radio" name="interest" value="${k}"><span><b>${esc(l)}</b><small>${esc(s)}</small></span></label>`).join("")}</div>
      ${err("interest")}</fieldset>
  </form>`;
  const d = openSheet({ title: "How did the call go?", sub: `Lead #${+leadId}. A brief cannot be changed after you save it; add a note for anything more.`, body,
    foot: `<button class="btn" type="button" data-x>Cancel</button><button class="btn primary" type="submit" form="${id}">${icon("check")}Save brief</button>` });
  d.el.classList.add("brief-sheet");
  const form = d.el.querySelector("#" + id);
  d.el.querySelector("[data-x]").addEventListener("click", () => d.close());
  const val = (n) => (form.querySelector(`[name="${n}"]:checked`) || form.querySelector(`[name="${n}"]:not([type="radio"])`))?.value?.trim() || "";
  const spokeOf = (code) => !!(list.find((o) => o.code === code) || {}).spoke;
  const show = () => {
    const code = val("outcome"), spoke = spokeOf(code);
    const on = { spoke: !!code && spoke, plan: !!code && spoke && !NO_PLAN.has(code), next: !!code && !NO_NEXT.has(code) };
    form.querySelectorAll("[data-when]").forEach((n) => { n.hidden = !on[n.dataset.when]; });
    const nl = form.querySelector("[data-next-label]");
    if (nl) nl.firstChild.textContent = spoke ? "Next step " : "When I will try again, and how ";
    const dt = form.querySelector('[name="ns_date"]'), tm = form.querySelector('[name="ns_time"]');
    if (on.next && !dt.value) {
      const at = new Date(deskNow() + 5.5 * 36e5 + (spoke ? 864e5 : 2 * 36e5));
      dt.value = at.toISOString().slice(0, 10);
      tm.value = spoke ? "11:00" : at.toISOString().slice(11, 16);
      if (!spoke && !form.querySelector('[name="next_step"]').value) form.querySelector('[name="next_step"]').value = "Call again";
    }
  };
  form.addEventListener("change", (e) => { if (e.target.name === "outcome") show(); });
  const setErr = (fields, message) => {
    form.querySelectorAll("[data-err]").forEach((n) => { n.hidden = true; n.textContent = ""; });
    form.querySelector(".form-err")?.remove();
    let first = null;
    for (const [k, m] of Object.entries(fields || {})) {
      const n = form.querySelector(`[data-err="${k}"]`); if (!n) continue;
      n.textContent = m === "required" ? "Fill this in." : String(m); n.hidden = false;
      first ||= n.closest(".field, fieldset");
    }
    if (!first && message) { const b = document.createElement("div"); b.className = "form-err"; b.setAttribute("role", "alert"); b.textContent = message; form.prepend(b); first = b; }
    first?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = val("outcome"), spoke = spokeOf(code), fields = {};
    const body = { outcome: code || null, customer_said: null, plan: null, next_step: null, next_step_at: null, interest: null };
    if (briefId) body.brief_id = briefId;
    if (!code) fields.outcome = "Choose how the call went.";
    const txt = (k, lo, hi, need) => { const v = val(k); if (!v) { if (need) fields[k] = "required"; return null; } if (v.length < lo || v.length > hi) fields[k] = `${lo} to ${hi} letters.`; return v; };
    if (code) {
      body.customer_said = spoke ? txt("customer_said", 5, 500, true) : null;
      body.plan = spoke && !NO_PLAN.has(code) ? txt("plan", 5, 500, true) : null;
      if (!NO_NEXT.has(code)) {
        body.next_step = txt("next_step", 3, 200, true);
        const dd = val("ns_date"), tt = val("ns_time");
        if (!dd || !tt) fields.next_step_at = "Pick the date and time.";
        else {
          body.next_step_at = `${dd} ${tt}`;
          const ms = istMs(body.next_step_at);
          if (ms < deskNow() - 5 * 60000 || ms > deskNow() + 30 * 864e5) fields.next_step_at = "From now to 30 days ahead.";
        }
      }
      if (spoke) { body.interest = val("interest") || null; if (!body.interest) fields.interest = "Choose one."; }
    }
    if (Object.keys(fields).length) { setErr(fields); return; }
    const btn = d.el.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const r = await desk.post(`desk/leads/${+leadId}/brief`, body);
      d.close();
      desk.done(r?.state === "late" ? "Brief saved (late)" : "Brief saved");
      onDone?.(r || {}, body);
    } catch (ex) {
      btn.disabled = false;
      if (ex.code === "already_submitted") { d.close(); toast("This brief was already filled.", "err"); onDone?.({}, body); return; }
      setErr(ex.fields, ex.message || "Could not save the brief.");
    }
  });
  return d;
}

// ------------------------------------------------------------------ the call-history screenshot (4.2)
export function openProof({ leadId, firstCallAt = null, onDone } = {}) {
  const id = "pf" + uid();
  const body = `<form id="${id}" class="pf" novalidate>
    <p class="pf-help">${icon("info", "")}<span>Open your phone's call history, take a screenshot that shows this customer's number, the time and the duration, and add it here.</span></p>
    <label class="pf-drop"><input type="file" name="file" accept="image/*" class="sr">
      <span class="pf-ph">${icon("camera", "")}<b>Choose the screenshot</b><small>PNG or JPEG from your gallery</small></span>
      <img class="pf-img" alt="The chosen screenshot" hidden></label>
    <div class="err" data-err="file" role="alert" hidden></div>
    <div class="form-grid pf-grid">
      <div class="field"><label for="${id}-t">Call time <span class="req" aria-hidden="true">*</span></label><input class="input" type="time" id="${id}-t" name="call_time" value="${esc(hm(firstCallAt))}"><div class="err" data-err="call_time" role="alert" hidden></div></div>
      <div class="field"><label for="${id}-d">Duration shown <span class="req" aria-hidden="true">*</span></label><input class="input" id="${id}-d" name="duration" inputmode="numeric" placeholder="2:14" autocomplete="off"><div class="hint">Minutes:seconds. 0:00 if nobody picked up.</div><div class="err" data-err="duration" role="alert" hidden></div></div>
    </div>
  </form>`;
  const d = openSheet({ title: "Call screenshot", sub: `Lead #${+leadId}. A manager checks it.`, body,
    foot: `<button class="btn" type="button" data-x>Cancel</button><button class="btn primary" type="submit" form="${id}">${icon("upload")}Send screenshot</button>` });
  const form = d.el.querySelector("#" + id), input = form.querySelector('[name="file"]'), img = form.querySelector(".pf-img");
  d.el.querySelector("[data-x]").addEventListener("click", () => d.close());
  let file = null, url = null;
  input.addEventListener("change", () => {
    file = input.files && input.files[0] || null;
    if (url) URL.revokeObjectURL(url);
    url = file ? URL.createObjectURL(file) : null;
    img.hidden = !url; if (url) img.src = url;
    form.querySelector(".pf-ph").hidden = !!url;
  });
  const setErr = (fields, message) => {
    form.querySelectorAll("[data-err]").forEach((n) => { n.hidden = true; n.textContent = ""; });
    form.querySelector(".form-err")?.remove();
    let any = false;
    for (const [k, m] of Object.entries(fields || {})) { const n = form.querySelector(`[data-err="${k}"]`); if (n) { n.textContent = String(m); n.hidden = false; any = true; } }
    if (!any && message) { const b = document.createElement("div"); b.className = "form-err"; b.setAttribute("role", "alert"); b.textContent = message; form.prepend(b); }
  };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = form.querySelector('[name="call_time"]').value.trim(), dur = form.querySelector('[name="duration"]').value.trim();
    const fields = {};
    if (!file) fields.file = "Choose the screenshot first.";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) fields.call_time = "The time of the call.";
    if (!/^\d{1,3}:[0-5]\d$/.test(dur)) fields.duration = "Like 2:14 (0:00 if nobody picked up).";
    if (Object.keys(fields).length) { setErr(fields); return; }
    const btn = d.el.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Sending`;
    try {
      let send = file, name = file.name || "screenshot.png";
      if (file.size > 5 * 1024 * 1024 || !/^image\/(png|jpe?g|webp)$/i.test(file.type || "")) {   // too big, or HEIC: a readable JPEG
        send = await shrinkPhoto(file, 2400, 0.9); name = "screenshot.jpg";
      }
      const fd = new FormData();
      fd.append("file", send, name); fd.append("call_time", t); fd.append("duration", dur);
      const r = await desk.upload(`desk/leads/${+leadId}/proof`, fd);
      d.close();
      desk.done(r?.state === "approved_auto" ? "Screenshot accepted" : "Screenshot sent for a check");
      onDone?.(r || {});
    } catch (ex) {
      btn.disabled = false; btn.innerHTML = `${icon("upload")}Send screenshot`;
      setErr(ex.fields, ex.message || "Could not send the screenshot.");
    }
  });
  return d;
}

// ------------------------------------------------------------------ reassign (7.1)
export function openReassign({ leadId, seats = [], current = null, onDone } = {}) {
  const opts = seats.filter((s) => s.seat !== current).map((s) => [s.seat, s.band ? s.seat : `${s.seat} (other band)`]);
  const f = formDrawer({ title: "Move this lead", sub: `Lead #${+leadId}${current ? ` is with ${esc(current)} now` : ""}. The new salesman gets a fresh claim clock.`, submit: "Move lead", ok: "",
    fields: [
      { name: "to_seat", label: "Move to", type: "select", required: true, full: true, options: opts },
      { name: "reason", label: "Reason", type: "textarea", required: true, full: true, placeholder: "e.g. He is out on a delivery all afternoon", hint: "5 to 200 letters. The salesmen and the log keep it." },
      { name: "warn_previous", label: "Add a warning for the previous salesman (same reason)", type: "checkbox", full: true },
    ],
    onSubmit: async (v) => {
      const reason = (v.reason || "").trim();
      if (reason.length < 5 || reason.length > 200) { const e = new Error("5 to 200 letters."); e.fields = { reason: "5 to 200 letters." }; throw e; }
      const r = await desk.post(`desk/leads/${+leadId}/reassign`, { to_seat: v.to_seat, reason, warn_previous: !!v.warn_previous });
      desk.done(`Lead #${+leadId} moved to ${v.to_seat}`);
      onDone?.(r);
    } });
  f.el.classList.add("sheet");
  const ta = f.el.querySelector("textarea"); if (ta) ta.maxLength = 200;
  return f;
}

/** The brief to open on a lead: the open, pending or missed one of this person's seat, else null (an unprompted brief). */
export function briefToFill(acc, seat) {
  const list = (acc?.briefs || []).filter((b) => ["open", "pending", "missed"].includes(b.state) && (!seat || b.seat === seat));
  list.sort((a, b) => (a.state === "missed" ? -1 : 0) - (b.state === "missed" ? -1 : 0) || String(a.due_at || "").localeCompare(String(b.due_at || "")));
  return list[0] || null;
}

// ------------------------------------------------------------------ leave (7.2): the list and the add sheet
export function leaveListHtml(rows, edit) {
  if (!rows.length) return `<div class="empty small">${icon("calendar", "")}<b>Nobody is on leave</b></div>`;
  const day = (s) => { const d = String(s || ""); return d ? `${+d.slice(8, 10)} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+d.slice(5, 7) - 1]}` : ""; };
  return `<ul class="list lv-list">${rows.map((r) => `<li><span class="lv-ic">${icon("calendar", "")}</span><span class="grow"><span class="t">${esc(r.seat)}</span><span class="s">${esc(day(r.date_from))}${r.date_to && r.date_to !== r.date_from ? ` to ${esc(day(r.date_to))}` : ""}${r.reason ? ` · ${esc(r.reason)}` : ""}</span></span>${edit ? `<button class="btn sm ghost" type="button" data-off-del="${+r.id}" aria-label="Remove leave for ${esc(r.seat)}">${icon("trash")}Remove</button>` : ""}</li>`).join("")}</ul>`;
}

export function openLeaveAdd(seats, onDone) {
  const today = new Date(deskNow() + 5.5 * 36e5).toISOString().slice(0, 10);
  const f = formDrawer({ title: "Add leave", sub: "No new leads and no warnings on these days. His unclaimed leads move to the next salesman.", submit: "Add leave", ok: "",
    fields: [
      { name: "seat", label: "Salesman", type: "select", required: true, full: true, options: seats || [] },
      { name: "from", label: "From", type: "date", required: true, value: today },
      { name: "to", label: "To", type: "date", required: true, value: today },
      { name: "reason", label: "Reason (optional)", full: true, placeholder: "e.g. Family wedding" },
    ],
    onSubmit: async (v) => {
      if (!v.from || !v.to || v.to < v.from) { const e = new Error("The last day is on or after the first."); e.fields = { to: "On or after the first day." }; throw e; }
      await desk.post("acc/off", { seat: v.seat, from: v.from, to: v.to, reason: v.reason || null });
      desk.done("Leave added"); onDone?.();
    } });
  f.el.classList.add("sheet");
  return f;
}
