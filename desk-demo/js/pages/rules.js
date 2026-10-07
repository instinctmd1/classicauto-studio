// Call rules (classic-auto/accountability-6oct/ACCOUNTABILITY-SPEC.md 1.1-1.3): the owners, and a manager only if the owner
// grants acc.settings. One form, top to bottom: switches, office hours, timers, rounds, who is told, screenshots, the
// morning release and team availability. The save bar lists what changed and sends one save with the version that was
// loaded; the engine validates every value again and is the authority. Values are numbers, switches and names only.
import { esc, icon } from "../util.js";
import { confirmDialog, pageHead, toast } from "../ui.js";
import * as desk from "../desk-api.js";
import { leaveListHtml, openLeaveAdd } from "./_acc.js";

const EVENTS = [["pass", "A lead is passed on", "No claim, no call, off duty, or moved by hand"], ["missed_brief", "A brief is missed", "Past its time"],
  ["missing_proof", "No call screenshot", "Past its time"], ["warning", "A new warning", "Any warning"], ["escalated", "A lead went round the team", "It reached the pool"],
  ["proof_review", "A screenshot waits for a check", "Only people who check screenshots"], ["review_flag", "5 warnings in 30 days", "Time for a talk"],
  ["followup_approve", "The follow-up list", "Who approves it (owners can always open it)"]];
const ROLES = [["sales_manager", "Sales manager"], ["manager", "Manager"], ["owner", "Owner"]];
const DAYS = [["", "No weekly off"], ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];
const LABEL = { enabled: "Accountability switch", exotel: "Exotel", office_hours: "Office hours", claim_sla_min: "Claim time", claim_sla_by_tier: "Claim time per band",
  call_sla_min: "Call time", brief_prompt_min: "Brief prompt", proof_due_min: "Screenshot time", missing_proof_action: "Missing screenshot rule", max_rounds: "Rounds",
  after_max_rounds: "After the rounds", recipients: "Who is told", sales_manager: "Sales manager", block_claim_on_overdue_brief: "Overdue brief blocks claims",
  review_sample_pct: "Screenshots checked", night_distribution: "Night queue", release_wave_size: "Wave size", release_wave_every_min: "Wave gap", weekly_off: "Weekly off",
  ai_proof_check: "Read screenshots with AI", ai_proof_daily_cap: "Paid backup reads per day", proof_reader: "Who reads screenshots",
  followup: "Follow-up list" };
// the follow-up list (SPEC-FOLLOWUP-RESHUFFLE 5): the engine's ranges, repeated here so a mistake shows before the save
const FU_RANGES = { cycle_days: [1, 14], grace_days: [0, 7], max_days_without_contact: [1, 14], customer_wait_hours: [1, 48], approve_hours: [4, 72] };
const mins = (hm) => { const [h, m] = String(hm || "").split(":").map(Number); return h * 60 + m; };
const hhmm = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const fuDay = (ts) => { const s = String(ts || ""); if (s.length < 16) return ""; const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
  return `${d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })} ${d.getUTCDate()} ${d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })} ${s.slice(11, 16)}`; };
// who reads each call-history screenshot (SPEC-SCREENSHOT-AI 9): the free reader on our own server is the default
const READERS = [["local", "The app, for free", "Read on our own computer; nothing leaves the building; ₹0."],
  ["claude", "The app, and Claude for the ones it cannot read", "A paid backup, about ₹0.50 a screenshot; needs the Claude key on the server."],
  ["off", "Nobody", "A person checks every screenshot by eye."]];
// the label of a field inside the exotel group that lives on the Timers card (SPEC-SCREENSHOT-AI 2.7, 6.1)
const SPOKE_LABEL = "Shortest call that counts as spoke";
const clone = (x) => JSON.parse(JSON.stringify(x ?? null));
const hmOk = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || "");

/** The engine's own rules (1.1), so a mistake shows before the save. */
function validate(s) {
  const e = {};
  const n = (k, lo, hi) => { const v = s[k]; if (!Number.isInteger(v) || v < lo || v > hi) e[k] = `A whole number from ${lo} to ${hi}`; };
  const [open, close] = String(s.office_hours || "").split("-");
  if (!hmOk(open) || !hmOk(close)) e.office_hours = "Opening and closing, like 10:00 and 21:00";
  else if (open < "06:00" || open > "12:00") e.office_hours = "Opening between 06:00 and 12:00";
  else if (close < "17:00" || close > "23:30") e.office_hours = "Closing between 17:00 and 23:30";
  else if (close <= open) e.office_hours = "Closing must be after opening";
  n("claim_sla_min", 5, 60); n("call_sla_min", 5, 60); n("brief_prompt_min", 2, 10); n("proof_due_min", 15, 120);
  const mc = s.exotel?.min_connected_sec;
  if (mc !== undefined && (!Number.isInteger(mc) || mc < 5 || mc > 120)) e.min_connected_sec = "A whole number from 5 to 120";
  if (s.ai_proof_daily_cap !== undefined && (!Number.isInteger(s.ai_proof_daily_cap) || s.ai_proof_daily_cap < 0 || s.ai_proof_daily_cap > 1000)) e.ai_proof_daily_cap = "A whole number from 0 to 1000";
  if (!e.proof_due_min && !e.call_sla_min && !e.brief_prompt_min && s.proof_due_min < s.call_sla_min + s.brief_prompt_min + 5) {
    e.proof_due_min = `At least ${s.call_sla_min + s.brief_prompt_min + 5} (call + brief prompt + 5)`;
  }
  for (const [k, v] of Object.entries(s.claim_sla_by_tier || {})) if (v !== null && (!Number.isInteger(v) || v < 5 || v > 60)) e.claim_sla_by_tier = `${k}: a whole number from 5 to 60, or empty`;
  n("max_rounds", 1, 5); n("review_sample_pct", 10, 100); n("release_wave_size", 1, 20); n("release_wave_every_min", 5, 60);
  if (s.followup) {
    for (const [k, [lo, hi]] of Object.entries(FU_RANGES)) { const v = s.followup[k]; if (!Number.isInteger(v) || v < lo || v > hi) e[`followup.${k}`] = `A whole number from ${lo} to ${hi}`; }
    if (!e.office_hours && hmOk(open) && hmOk(close)) {
      const r = s.followup.run_at, last = hhmm(mins(close) - 60);
      if (!hmOk(r) || r < open || r > last) e["followup.run_at"] = `Pick a time from ${open} to ${last}`;
    }
  }
  return e;
}

export async function render(ctx) {
  ctx.root.innerHTML = `${pageHead({ title: "Call rules", sub: "How fast a lead must be claimed and called, what proof is needed, who is told, and how night leads are shared out. Changes apply within a minute." })}<div id="rl"><div class="skel card h420"></div></div>`;
  const host = ctx.root.querySelector("#rl");
  let res, orig, cur, preview = null, leave = [], fu = null;

  async function load() {
    try { res = await desk.get("acc/settings"); }
    catch (e) {
      if (!ctx.alive()) return;
      host.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>The call rules could not load.</b><span class="muted">${esc(e.status === 503 ? "The lead engine is not answering. Try again in a minute." : e.message || "")}</span></div><button class="btn" type="button" id="rl-retry">${icon("refresh")}Try again</button></div>`;
      host.querySelector("#rl-retry").addEventListener("click", load);
      return;
    }
    if (!ctx.alive()) return;
    if (!res.settings) { host.innerHTML = `<div class="empty">${icon("lock", "")}<b>You can see the timers but not change the rules</b><p>Ask the owner if you need to.</p></div>`; return; }
    orig = clone(res.settings); cur = clone(res.settings);
    cur.exotel = cur.exotel || {}; orig.exotel = orig.exotel || {};
    try { const q = await desk.get("acc/night-queue", {}, { background: true }); preview = q.preview && Object.keys(q.preview).length ? q.preview : null; } catch { preview = null; }
    try { leave = (await desk.get("acc/off", {}, { background: true })).data || []; } catch { leave = null; }
    fu = null;
    if (cur.followup) try { fu = await desk.get("acc/followups", { preview: 1 }, { background: true }); } catch { fu = null; }
    paint();
  }

  const staff = () => (res.live?.staff || []);
  const seats = () => [...new Set([...staff().filter((s) => s.role === "sales").map((s) => s.name), ...Object.keys(cur.weekly_off || {})])];

  function paint() {
    const live = res.live || {}, s = cur;
    const [open, close] = String(s.office_hours || "10:00-21:00").split("-");
    const tiers = live.tiers || [];
    const num = (k, lo, hi, unit, hint = "") => `<div class="field" data-field="${k}"><label for="r-${k}">${esc(LABEL[k])}</label><div class="rl-num"><input class="input" type="number" inputmode="numeric" id="r-${k}" data-k="${k}" min="${lo}" max="${hi}" step="1" value="${esc(s[k] ?? "")}"><span>${esc(unit)}</span></div>${hint ? `<div class="hint">${esc(hint)}</div>` : ""}<div class="err" data-err="${k}" hidden></div></div>`;
    const sw = (k, label, sub, disabled = false, checked = !!s[k]) => `<label class="rl-switch${disabled ? " off" : ""}"><span><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span><input type="checkbox" role="switch" data-k="${k}"${checked ? " checked" : ""}${disabled ? " disabled" : ""}><i aria-hidden="true"></i></label>`;
    host.innerHTML = `<form id="rl-form" class="rl" novalidate>
      <section class="card rise rl-sec"><div class="card-h"><div><h2>Switches</h2><div class="card-sub">While accountability is off, leads work exactly as they do today.</div></div></div>
        ${sw("enabled", "Call accountability", "Claim clock, call clock, briefs, screenshots, passes and warnings")}
        ${sw("exotel.enabled", "Exotel business numbers", live.exotel_keys ? "Calls go through each salesman's business number and are verified by the call record" : "Exotel keys are not on the engine yet", !live.exotel_keys && !s.exotel?.enabled, !!s.exotel?.enabled)}
        ${sw("exotel.hide_number", "Hide customer numbers from salesmen", "With Exotel on, a salesman sees only the last 4 digits", !live.exotel_keys, s.exotel?.hide_number !== false)}
        ${sw("exotel.record", "Record calls", "Only after a 'this call may be recorded' greeting is set", !live.exotel_keys, !!s.exotel?.record)}
      </section>
      <section class="card rise rl-sec"><div class="card-h"><div><h2>Office hours</h2><div class="card-sub">The clocks run only while the showroom is open. This also moves the evening roll-call, the night queue and the call-back time customers are told.</div></div></div>
        <div class="rl-hours" data-field="office_hours"><div class="field"><label for="r-open">Opening</label><input class="input" type="time" id="r-open" data-hours="open" value="${esc(open)}"></div><div class="field"><label for="r-close">Closing</label><input class="input" type="time" id="r-close" data-hours="close" value="${esc(close)}"></div><div class="err" data-err="office_hours" hidden></div></div>
        ${live.hours_by_day || (live.closed_dates || []).length ? `<p class="muted small-note">${icon("info", "")}Set in the engine file, not here: ${live.hours_by_day ? "hours by day" : ""}${live.hours_by_day && (live.closed_dates || []).length ? " and " : ""}${(live.closed_dates || []).length ? `${(live.closed_dates || []).length} closed dates` : ""}.</p>` : ""}
      </section>
      <section class="card rise rl-sec"><div class="card-h"><div><h2>Timers</h2><div class="card-sub">Showroom minutes. A lead not claimed or not called in time moves to the next salesman.</div></div></div>
        <div class="rl-grid">${num("claim_sla_min", 5, 60, "min to claim", "From the moment a lead is his")}${num("call_sla_min", 5, 60, "min to call", "From the claim to the first Call press")}${num("brief_prompt_min", 2, 10, "min after Call", "Ask how the call went after 2-10 minutes (showroom minutes: the clock pauses at closing)")}${num("proof_due_min", 15, 120, "min after claim", "Screenshot and first brief due")}
          <div class="field" data-field="min_connected_sec"><label for="r-mcs">${esc(SPOKE_LABEL)}</label><div class="rl-num"><input class="input" type="number" inputmode="numeric" id="r-mcs" data-k="exotel.min_connected_sec" min="5" max="120" step="1" value="${esc(s.exotel?.min_connected_sec ?? 20)}"><span>seconds</span></div><div class="hint">For an Exotel call record and for the app's reading of a screenshot alike</div><div class="err" data-err="min_connected_sec" hidden></div></div></div>
        <details class="rl-fold"${Object.values(s.claim_sla_by_tier || {}).some((v) => v !== null && v !== undefined) ? " open" : ""}><summary>Different claim time per price band</summary>
          <div class="rl-grid" data-field="claim_sla_by_tier">${tiers.map((t) => `<div class="field"><label for="r-t-${esc(t.key)}">${esc(t.name)}</label><div class="rl-num"><input class="input" type="number" inputmode="numeric" min="5" max="60" id="r-t-${esc(t.key)}" data-tier="${esc(t.key)}" value="${esc((s.claim_sla_by_tier || {})[t.key] ?? "")}" placeholder="${esc(s.claim_sla_min)}"><span>min</span></div></div>`).join("") || `<p class="muted">The engine has not listed the bands.</p>`}<div class="err" data-err="claim_sla_by_tier" hidden></div></div>
          <p class="hint">Empty means the claim time above. Luxury and Premium ran on 10 minutes before this.</p></details>
      </section>
      <section class="card rise rl-sec"><div class="card-h"><div><h2>Rounds</h2><div class="card-sub">A missed lead goes round the band's salesmen in order. After the last round it goes to the pool.</div></div></div>
        <div class="rl-grid">${num("max_rounds", 1, 5, "rounds")}
          <div class="field"><label for="r-amr">After the last round</label><select class="select" id="r-amr" data-k="after_max_rounds"><option value="owners"${s.after_max_rounds !== "manager" ? " selected" : ""}>The owners</option><option value="manager"${s.after_max_rounds === "manager" ? " selected" : ""}>The manager</option></select></div></div>
        <fieldset class="rl-radio"><legend>When a call screenshot is missing</legend>
          <label class="check"><input type="radio" name="mpa" data-k="missing_proof_action" value="escalate"${s.missing_proof_action !== "reassign" ? " checked" : ""}> <span>Tell the people below (the salesman may have called and forgot)</span></label>
          <label class="check"><input type="radio" name="mpa" data-k="missing_proof_action" value="reassign"${s.missing_proof_action === "reassign" ? " checked" : ""}> <span>Pass the lead to the next salesman</span></label></fieldset>
      </section>
      <section class="card rise rl-sec"><div class="card-h"><div><h2>Who is told</h2><div class="card-sub">A notification on their phone. If nobody is ticked for something, the owners are told.</div></div></div>
        <div class="scroll-x"><table class="tbl keep rl-who"><thead><tr><th>When</th>${ROLES.map(([, l]) => `<th>${esc(l)}</th>`).join("")}</tr></thead><tbody>
          ${EVENTS.map(([k, l, sub]) => `<tr><td><b>${esc(l)}</b><small>${esc(sub)}</small></td>${ROLES.map(([r, rl]) => `<td><input type="checkbox" aria-label="${esc(l)}: ${esc(rl)}" data-ev="${k}" data-role="${r}"${(s.recipients?.[k] || []).includes(r) ? " checked" : ""}></td>`).join("")}</tr>`).join("")}
        </tbody></table></div>
        <div class="field rl-sm"><label for="r-sm">Who is the sales manager?</label><select class="select" id="r-sm" data-k="sales_manager"><option value="">Nobody yet</option>${staff().filter((x) => x.role === "sales" || x.role === "manager").map((x) => `<option${x.name === s.sales_manager ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
      </section>
      <section class="card rise rl-sec"><div class="card-h"><div><h2>Screenshots</h2><div class="card-sub">Until Exotel is on, a call-history screenshot is the proof that a call happened.</div></div></div>
        <div class="rl-grid">${num("review_sample_pct", 10, 100, "% checked by a person", "The rest of the clean ones are approved by themselves. 100 = check every one.")}</div>
        ${s.proof_reader !== undefined ? `<fieldset class="rl-radio"><legend>${esc(LABEL.proof_reader)} (the number, time and duration; a tick for the reviewers. A mismatch only moves it to the top, it never warns anyone)</legend>
          ${READERS.map(([v, l, sub]) => `<label class="check"><input type="radio" name="prd" data-k="proof_reader" value="${v}"${s.proof_reader === v ? " checked" : ""}> <span><b>${esc(l)}.</b> ${esc(sub)}</span></label>`).join("")}</fieldset>
        ${s.proof_reader === "claude" ? `<div class="rl-grid">${num("ai_proof_daily_cap", 0, 1000, "a day", "0 = none. Past it, a screenshot the app could not read shows \u201c? Couldn't read - check by eye\u201d.")}</div>` : ""}
        <p class="muted small-note rl-ai-line">${icon("image", "")}${res.ai_today && res.ai_today.read ? `Last read ${esc(String(res.ai_today.last_at || "").slice(11, 16))} · ${+res.ai_today.read} today${res.ai_today.claude ? ` · ${+res.ai_today.claude} by Claude` : ""}` : "No screenshot read today"}</p>` : ""}
        ${sw("block_claim_on_overdue_brief", "Block new claims while a brief is overdue", "The salesman fills the missed brief first")}
      </section>
      <section class="card rise rl-sec"><div class="card-h"><div><h2>Morning release</h2><div class="card-sub">Leads that come in after closing wait with no salesman, then go out at opening by price band and performance.</div></div></div>
        ${sw("night_distribution", "Night queue", "Off: night leads are given a salesman when they arrive, as before")}
        <div class="rl-grid">${num("release_wave_size", 1, 20, "leads per wave")}${num("release_wave_every_min", 5, 60, "min between waves")}</div>
        ${preview ? `<p class="rl-prev">${icon("leads", "")}<span>${Object.entries(preview).map(([tier, ss]) => `${Object.values(ss).reduce((a, b) => a + b, 0)} ${esc(tier.split(" ")[0])} leads → ${Object.entries(ss).map(([n, k]) => `${esc(n)} ${k}`).join(", ")}`).join("; ")}</span></p>` : ""}
      </section>
      ${s.followup ? fuCard(s, sw) : ""}
      <section class="card rise rl-sec"><div class="card-h"><div><h2>Team availability</h2><div class="card-sub">Someone off gets no new leads and no warnings that day.</div></div></div>
        <div class="rl-grid">${seats().map((n) => `<div class="field"><label>${esc(n)}</label><select class="select" data-off="${esc(n)}">${DAYS.map(([v, l]) => `<option value="${v}"${(s.weekly_off || {})[n] === v || (!v && !(s.weekly_off || {})[n]) ? " selected" : ""}>${l}</option>`).join("")}</select></div>`).join("") || `<p class="muted">The engine has not listed the salesmen.</p>`}</div>
        <div class="rl-leave"><div class="sec-h"><h3>Leave</h3><div class="act"><button class="btn sm" type="button" id="rl-leave-add">${icon("plus")}Add leave</button></div></div><div id="rl-leave">${leave === null ? `<p class="muted">Leave could not load.</p>` : leaveListHtml(leave, true)}</div></div>
      </section>
      <div class="rl-save" id="rl-save" hidden><span id="rl-changed"></span><button class="btn" type="button" id="rl-undo">Undo</button><button class="btn primary" type="submit">${icon("check")}Save</button></div>
    </form>`;
    bind();
  }

  /** The Follow-up list card (5.3): every 3 days the leads nobody followed up go to the approvers, who move, keep or excuse them. */
  function fuCard(s, sw) {
    const f = s.followup || {};
    const fnum = (k, lo, hi, unit, label, hint = "") => `<div class="field" data-field="followup.${k}"><label for="r-fu-${k}">${esc(label)}</label><div class="rl-num"><input class="input" type="number" inputmode="numeric" id="r-fu-${k}" data-k="followup.${k}" min="${lo}" max="${hi}" step="1" value="${esc(f[k] ?? "")}"><span>${esc(unit)}</span></div>${hint ? `<div class="hint">${esc(hint)}</div>` : ""}<div class="err" data-err="followup.${k}" hidden></div></div>`;
    const nx = fu && fu.enabled && fu.next ? fu.next : null;
    const line = nx ? [`Next list ${fuDay(nx.cut_at)}`, nx.heads_up_at ? `heads-up ${fuDay(nx.heads_up_at)}` : "", fu.preview ? `${+fu.preview.would_list} lead${fu.preview.would_list === 1 ? "" : "s"} would be on it now` : ""].filter(Boolean).join(" · ") : "";
    return `<section class="card rise rl-sec rl-fu" id="rl-fu"><div class="card-h"><div><h2>Follow-up list</h2><div class="card-sub">Leads nobody followed up go on a list for the approvers, who move them to another salesman, keep them or excuse them. Nothing moves without their OK.</div></div></div>
        ${sw("followup.enabled", "Make a follow-up list", "Runs only while call accountability is on", false, f.enabled !== false)}
        <div class="rl-grid">
          ${fnum("cycle_days", 1, 14, "days", "Every")}
          <div class="field" data-field="followup.run_at"><label for="r-fu-run">At</label><input class="input" type="time" id="r-fu-run" data-k="followup.run_at" value="${esc(f.run_at || "10:30")}"><div class="hint">While the showroom is open, at least an hour before closing</div><div class="err" data-err="followup.run_at" hidden></div></div>
          ${fnum("grace_days", 0, 7, "days", "A next-step date may slip by", "Whole open days")}
          ${fnum("max_days_without_contact", 1, 14, "days", "No follow-up for more than", "A call with its brief, or a reply from the app, counts")}
          ${fnum("customer_wait_hours", 1, 48, "office hours", "A customer's message may wait")}
          ${fnum("approve_hours", 4, 72, "office hours", "The approver has", "Then the owners are told")}
        </div>
        ${sw("followup.heads_up", "Warn each salesman the day before", "Only leads he was warned about can go on the list", false, f.heads_up !== false)}
        ${sw("followup.warn", "A 'Not followed up' warning for each lead moved", "A manager can excuse it; it never touches pay", false, f.warn !== false)}
        ${line ? `<p class="rl-prev">${icon("flag", "")}<span>${esc(line)}</span></p>` : ""}
      </section>`;
  }

  function changes() {
    const out = {};
    for (const k of Object.keys(LABEL)) if (JSON.stringify(cur[k] ?? null) !== JSON.stringify(orig[k] ?? null)) out[k] = clone(cur[k]);
    return out;
  }
  function refreshBar() {
    const c = changes(), keys = Object.keys(c);
    const bar = host.querySelector("#rl-save");
    bar.hidden = !keys.length;
    host.querySelector("#rl-changed").innerHTML = keys.length ? `<b>${keys.length} change${keys.length === 1 ? "" : "s"}:</b> ${esc(keys.map((k) => LABEL[k]).join(", "))}` : "";
    showErrors(validate(cur));
  }
  function showErrors(errs, force = false) {
    host.querySelectorAll("[data-err]").forEach((n) => { const m = errs[n.dataset.err]; n.hidden = !m; n.textContent = m || ""; });
    host.querySelectorAll("[data-field]").forEach((f) => f.classList.toggle("bad", !!errs[f.dataset.field]));
    if (force) host.querySelector("[data-field].bad")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function bind() {
    const form = host.querySelector("#rl-form");
    form.addEventListener("input", onEdit);
    form.addEventListener("change", onEdit);
    host.querySelector("#rl-undo").addEventListener("click", () => { cur = clone(orig); paint(); });
    host.querySelector("#rl-leave-add").addEventListener("click", () => openLeaveAdd(seats(), async () => { try { leave = (await desk.get("acc/off")).data || []; } catch { /* keep */ } host.querySelector("#rl-leave").innerHTML = leaveListHtml(leave || [], true); bindLeave(); }));
    bindLeave();
    form.addEventListener("submit", (e) => { e.preventDefault(); save(); });
  }
  function bindLeave() {
    host.querySelectorAll("[data-off-del]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      try { await desk.post(`acc/off/${+b.dataset.offDel}/delete`, {}); desk.done("Leave removed"); leave = leave.filter((x) => x.id !== +b.dataset.offDel); host.querySelector("#rl-leave").innerHTML = leaveListHtml(leave, true); bindLeave(); }
      catch (ex) { b.disabled = false; toast(ex.message || "Could not remove it.", "err"); }
    }));
  }
  function onEdit(e) {
    const t = e.target;
    if (t.dataset.k) {
      const k = t.dataset.k;
      let v = t.type === "checkbox" ? t.checked : t.type === "number" ? (t.value === "" ? null : Number(t.value)) : t.value;
      if (k === "sales_manager" && v === "") v = null;
      if (t.type === "radio" && !t.checked) return;
      if (k.startsWith("exotel.")) cur.exotel = { ...(cur.exotel || {}), [k.slice(7)]: v };
      else if (k.startsWith("followup.")) cur.followup = { ...(cur.followup || {}), [k.slice(9)]: v };
      else cur[k] = v;
      if (k === "proof_reader") { paint(); refreshBar(); return; }     // the paid backup's daily cap shows only for "claude"
    } else if (t.dataset.hours) {
      const o = host.querySelector('[data-hours="open"]').value, c = host.querySelector('[data-hours="close"]').value;
      cur.office_hours = `${o}-${c}`;
    } else if (t.dataset.tier) {
      cur.claim_sla_by_tier = { ...(cur.claim_sla_by_tier || {}), [t.dataset.tier]: t.value === "" ? null : Number(t.value) };
    } else if (t.dataset.ev) {
      const list = new Set(cur.recipients?.[t.dataset.ev] || []);
      if (t.checked) list.add(t.dataset.role); else list.delete(t.dataset.role);
      cur.recipients = { ...(cur.recipients || {}), [t.dataset.ev]: ROLES.map(([r]) => r).filter((r) => list.has(r)) };
    } else if (t.dataset.off !== undefined) {
      cur.weekly_off = { ...(cur.weekly_off || {}), [t.dataset.off]: t.value || null };
    } else return;
    refreshBar();
  }

  async function save() {
    const errs = validate(cur);
    if (Object.keys(errs).length) { showErrors(errs, true); toast("Check the highlighted rules first.", "err"); return; }
    const c = changes();
    if (!Object.keys(c).length) return;
    if (c.office_hours && !(await confirmDialog({ title: "Change the office hours?", text: "This also moves the evening roll-call, the night queue and the call-back time customers are told. The tech admin refreshes Anita after this.", confirmLabel: "Change the hours" }))) return;
    const btn = host.querySelector('#rl-save [type="submit"]');
    btn.disabled = true;
    try {
      res = await desk.post("acc/settings", { version: res.version, changes: c });
      orig = clone(res.settings); cur = clone(res.settings); cur.exotel = cur.exotel || {}; orig.exotel = orig.exotel || {};
      desk.done("Call rules saved");
      paint();
    } catch (ex) {
      btn.disabled = false;
      if (ex.code === "version_conflict") { toast("Someone else changed the rules; check and save again.", "err"); await load(); return; }
      if (ex.code === "exotel_keys_missing") { toast("Exotel keys are not on the engine yet.", "err"); return; }
      if (ex.fields || ex.body?.detail?.fields) { showErrors(ex.fields || ex.body.detail.fields, true); toast(ex.message || "Check the highlighted rules.", "err"); return; }
      toast(ex.message || "Could not save the rules.", "err");
    }
  }

  await load();
}
