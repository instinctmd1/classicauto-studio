// The follow-up list (classic-auto/accountability-6oct/SPEC-FOLLOWUP-RESHUFFLE.md 11). Every few days the engine lists
// the open leads whose salesman did not prove he called the customer back. The approvers see them grouped by salesman,
// choose Reshuffle (the default), Keep with a new deadline or Excuse for each, and press one button; nothing moves
// without that. A salesman sees "My follow-ups": the leads that go on the next list unless he follows up, with the one
// thing that clears each, and his leads on the open list. The engine decides who may decide and checks every value.
import { can } from "../state.js";
import { esc, icon } from "../util.js";
import { bindTabs, confirmDialog, pageHead, tabsHtml, toast } from "../ui.js";
import * as desk from "../desk-api.js";
import { deskNow, deskTime, every, onFeed, openSheet, setServerNow, STAGE_LABEL } from "../desk.js";
import { PROOF_STATE, accOn, outcomeLabel } from "./_acc.js";

const ACT = [["reshuffle", "Reshuffle"], ["keep", "Keep"], ["excuse", "Excuse"]];
const CLEAR = { call_brief: ["phone", "Call", ""], proof: ["camera", "Add the screenshot", "?proof=1"], reply: ["chat", "Reply", ""] };
const VOID = { closed: "Already closed", moved: "Already moved", changed: "Already moved" };
const DOWN = "The lead engine is not answering. Nothing was moved.";
const istMs = (s) => Date.parse(String(s).replace(" ", "T").slice(0, 19) + "+05:30");
/** "Sat 10 Oct" or "Sat 10 Oct 10:30" from an IST "YYYY-MM-DD HH:MM:SS". */
function day(ts, withTime = true) {
  const s = String(ts || "");
  if (s.length < 10) return "";
  const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
  const t = `${d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })} ${d.getUTCDate()} ${d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}`;
  return withTime && s.length >= 16 ? `${t} ${s.slice(11, 16)}` : t;
}
function left(ts) {
  const m = Math.round((istMs(ts) - deskNow()) / 60000);
  if (!Number.isFinite(m)) return "";
  if (m <= 0) return "overdue";
  return m < 60 ? `${m} min left` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min left` : `${Math.round(m / 1440)} day${Math.round(m / 1440) === 1 ? "" : "s"} left`;
}
const band = (tier) => String(tier || "").split(/\s+/)[0] || "";
const nth = (n) => (n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const ok = (r) => typeof r === "string" && r.trim().length >= 5 && r.trim().length <= 200;
const errText = (e) => (e && e.status === 503 ? DOWN : (e && e.message) || "Something went wrong.");

/** The plain lines under the reasons: last follow-up, next step, screenshot, the customer's message, leave. */
function evidence(it) {
  const ev = it.evidence || {}, out = [];
  const lf = ev.last_followup;
  out.push(["Last follow-up", lf ? `${deskTime(lf.at)} · ${lf.kind === "reply" ? "reply from the app" : outcomeLabel(lf.outcome) || "call with brief"}` : "None since it was given"]);
  if (ev.next_step_at) out.push(["Next step", deskTime(ev.next_step_at)]);
  if (ev.proof) {
    const st = (PROOF_STATE[ev.proof.state] || [ev.proof.state])[0];
    out.push(["Screenshot", `${st}${ev.proof.late ? " (late)" : ""}${ev.proof.chip ? ` · ${ev.proof.chip}` : ""}`]);
  }
  if (ev.customer_last_in) out.push(["Customer wrote", `${deskTime(ev.customer_last_in)} · no reply`]);
  if (ev.inbound_missed_at) out.push(["Customer rang", `${deskTime(ev.inbound_missed_at)} · nobody answered`]);
  if (Number.isInteger(ev.attempts_since_assign)) out.push(["Calls since it was given", String(ev.attempts_since_assign)]);
  if (ev.off_days) out.push(["On leave", `${plural(ev.off_days, "open day")} in this window: no warning`]);
  return `<dl class="fu-ev">${out.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;
}
function reasonsHtml(it) {
  return `<ul class="fu-why">${(it.reasons || []).map((r) => `<li><span class="badge neg">${icon("alert", "")}${esc(r.label || r.code)}</span>${r.detail ? `<small>${esc(r.detail)}</small>` : ""}</li>`).join("")}</ul>`;
}
function head(it) {
  const st = STAGE_LABEL[it.lead_status] || it.lead_status || "";
  return `<div class="fu-top"><a class="fu-id" href="#/lead/${+it.lead_id}" aria-label="Open lead ${+it.lead_id}">#${+it.lead_id}</a>
    <span class="fu-name">${esc(it.customer || "Customer")}</span>${it.tier ? `<span class="tier-tag">${esc(band(it.tier))}</span>` : ""}${st ? `<span class="badge">${esc(st)}</span>` : ""}${it.times_listed > 1 ? `<span class="badge warn">${nth(it.times_listed)} time on the list</span>` : ""}</div>
    ${it.car || it.last4 ? `<p class="fu-car muted">${esc([it.car, it.last4].filter(Boolean).join(" · "))}</p>` : ""}`;
}
/** What happened to a decided (or void, or expired) item, in one line. */
function outcome(it) {
  const d = it.decided;
  if (it.state === "void") return `<p class="fu-out muted">${icon("x", "")}${esc(VOID[it.void_reason] || "Already closed or moved")}</p>`;
  if (it.state === "expired") return `<p class="fu-out muted">${icon("clock", "")}Not decided in time: it is judged again on the next list</p>`;
  if (!d) return "";
  if (d.action === "reshuffle") return `<p class="fu-out">${icon("repeat", "")}${d.to_seat ? `Moved to ${esc(d.to_seat)}${d.wave_at ? ` · clock starts ${esc(deskTime(d.wave_at))}` : ""}` : "Moved to another salesman"}${d.by ? ` · by ${esc(d.by)}` : ""}</p>`;
  if (d.action === "keep") return `<p class="fu-out">${icon("check", "")}Stays with ${esc(it.seat)} until ${esc(deskTime(d.until))}${d.by ? ` · by ${esc(d.by)}` : ""}${d.note ? `<small>${esc(d.note)}</small>` : ""}</p>`;
  return `<p class="fu-out">${icon("info", "")}Excused${d.until ? ` until ${esc(day(d.until, false))}` : ""}${d.by ? ` · by ${esc(d.by)}` : ""}${d.note ? `<small>${esc(d.note)}</small>` : ""}</p>`;
}

export async function render(ctx) {
  const approverCaps = can("acc.followup") || can("acc.team");
  let tab = ctx.query.get("tab") === "past" && approverCaps ? "past" : "now";
  ctx.root.innerHTML = `<div class="fu-page">${pageHead({ title: approverCaps ? "Follow-up list" : "My follow-ups", sub: approverCaps
      ? "Leads whose salesman did not prove he called the customer back. Move each one to another salesman, keep it with a new deadline, or excuse it. Nothing moves until you approve."
      : "Leads that go on the follow-up list unless you follow up. A call counts once its brief is filled." })}
    ${approverCaps && accOn() ? tabsHtml([{ id: "now", label: "To decide", icon: "flag" }, { id: "past", label: "Past lists", icon: "history" }], tab, "Follow-up list") : ""}<div id="fu"></div></div>`;
  const host = ctx.root.querySelector("#fu");
  if (!accOn()) { host.innerHTML = `<div class="empty">${icon("flag", "")}<b>Call accountability is off</b><p>The follow-up list starts once the owners switch it on.</p></div>`; return; }

  let res = null, choice = {}, viewing = null, busy = false;
  bindTabs(ctx.root, (t) => { tab = t; viewing = null; history.replaceState(null, "", `#/followups${t === "past" ? "?tab=past" : ""}`); t === "past" ? loadPast() : load(); });

  function failBox(e, retry) {
    host.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>The follow-up list could not load.</b><span class="muted">${esc(errText(e))}</span></div><button class="btn" type="button" data-retry>${icon("refresh")}Try again</button></div>`;
    host.querySelector("[data-retry]").addEventListener("click", retry);
  }

  async function load(quiet = false) {
    if (!quiet) host.innerHTML = `<div class="skel card h420"></div>`;
    let r;
    try { r = await desk.get("acc/followups", viewing ? { cycle_id: viewing } : null, quiet ? { background: true } : {}); }
    catch (e) { if (!ctx.alive() || quiet) return; failBox(e, () => load()); return; }
    if (!ctx.alive() || (tab !== "now" && !viewing)) return;
    setServerNow(r.now);
    res = r;
    const keep = choice; choice = {};
    for (const g of (r.list?.groups || [])) for (const it of g.items) {
      if (it.state !== "pending") continue;
      const was = keep[it.item_id];
      choice[it.item_id] = was || { action: it.default_action || "reshuffle", reason: it.followed_up_after_cut ? `Followed up after the list was made (${day(it.followed_up_after_cut)})` : "", date: "", time: "", sel: !it.own_seat };
    }
    "at_risk" in r ? paintMine() : paintList();
  }

  // ---------------------------------------------------------------- the salesman's view (11.3)
  function paintMine() {
    const r = res;
    if (!r.enabled) { host.innerHTML = `<div class="empty">${icon("flag", "")}<b>The follow-up list is off</b><p>Nothing is listed while the owners keep it switched off.</p></div>`; return; }
    const cut = r.next?.cut_at, risk = r.at_risk || [], listed = r.listed || [];
    const card = (it, actions) => `<article class="fu-card rise${it.state && it.state !== "pending" ? " done" : ""}">${head(it)}${reasonsHtml(it)}${actions}</article>`;
    const acts = (it) => `<div class="fu-acts">${(it.clear || ["call_brief"]).map((c) => CLEAR[c]).filter(Boolean).map(([ic, label, q]) => `<a class="btn primary" href="#/lead/${+it.lead_id}${q}">${icon(ic)}${esc(label)}</a>`).join("")}</div>`;
    const state = (it) => (it.state === "pending" ? `<p class="fu-out">${icon("clock", "")}The manager is deciding</p>` : it.decided?.action === "reshuffle" ? `<p class="fu-out">${icon("repeat", "")}Moved to another salesman</p>` : outcome(it));
    host.innerHTML = `
      ${risk.length ? `<section class="fu-sec"><div class="fu-alert" role="status">${icon("alert", "")}<span><b>${risk.length === 1 ? "This lead goes" : `These ${risk.length} leads go`} on the follow-up list on ${esc(day(risk[0].cut_at || cut))} unless you follow up.</b> The manager may then move ${risk.length === 1 ? "it" : "them"} to another salesman.</span></div>
        <div class="fu-items">${risk.map((it) => card(it, acts(it))).join("")}</div>
        <p class="muted small-note fu-help">${icon("info", "")}A call counts once its brief is filled. A WhatsApp from your own phone cannot be seen by the app: reply from the app, or call.</p></section>` : ""}
      ${listed.length ? `<section class="fu-sec"><h2 class="eyebrow">On the list now</h2><div class="fu-items">${listed.map((it) => card(it, state(it))).join("")}</div></section>` : ""}
      ${!risk.length && !listed.length ? `<div class="empty">${icon("check", "")}<b>Nothing at risk</b><p>${cut ? `Next list ${esc(day(cut))}. ` : ""}${r.rules?.heads_up ? "You are told the day before if a lead is about to go on it." : ""}</p></div>` : ""}`;
  }

  // ---------------------------------------------------------------- the approver's view (11.1, 11.2)
  function paintList() {
    const r = res, L = r.list;
    if (!r.enabled) { host.innerHTML = `<div class="empty">${icon("flag", "")}<b>The follow-up list is off</b><p>Switch it on in Call rules.</p></div>`; return; }
    const next = r.next?.cut_at ? `Next list ${day(r.next.cut_at)}` : "";
    const decide = !!r.can_decide && L && L.state === "open" && !viewing;
    const back = viewing ? `<button class="btn sm ghost fu-back" type="button" data-back>${icon("left")}Past lists</button>` : "";
    if (!L) { host.innerHTML = `${back}<div class="empty">${icon("check", "")}<b>No list yet</b><p>${esc(next)}${r.preview ? ` · ${plural(+r.preview.would_list || 0, "lead")} would be on it now` : ""}</p></div>`; return; }
    const total = Object.values(L.counts || {}).reduce((a, n) => a + n, 0);
    const pend = L.counts?.pending || 0;
    const sub = [`List of ${day(L.built_at || L.cut_date, false)}`, plural(total, "lead"), L.state === "open" && pend ? `decide by ${day(L.approve_due_at)}` : L.state === "open" ? "all decided" : L.state === "expired" ? "expired" : L.state === "empty" ? "nobody listed" : "decided"].join(" · ");
    const headHtml = `${back}<div class="fu-head card rise"><div><b>${esc(sub)}</b>${L.state === "open" && pend ? ` <span class="badge ${L.overdue ? "neg" : "warn"}" data-left>${esc(L.overdue ? "Overdue" : left(L.approve_due_at))}</span>` : ""}</div>${next && !viewing ? `<span class="muted">${esc(next)}</span>` : ""}
      ${!decide && L.state === "open" && pend ? `<p class="muted small-note">${icon("lock", "")}Only the approvers decide this list.</p>` : ""}</div>`;
    if (!total) { host.innerHTML = `${headHtml}<div class="empty">${icon("check", "")}<b>Everyone followed up</b><p>${esc(next || "")}.</p></div>`; return; }
    const groups = (L.groups || []).map((g) => {
      const open = g.items.filter((x) => x.state === "pending" && !x.own_seat);
      return `<section class="fu-group"><div class="fu-gh"><h2>${esc(g.seat)} <span class="muted">· ${plural(g.items.length, "lead")}</span></h2>${decide && open.length > 1 ? `<button class="btn sm" type="button" data-all="${esc(g.seat)}">${icon("repeat")}Reshuffle all ${open.length}</button>` : ""}</div>
        <div class="fu-items">${g.items.map((it) => itemCard(it, decide)).join("")}</div></section>`;
    }).join("");
    host.innerHTML = `${headHtml}${groups}${decide && pend ? `<div class="rl-save fu-bar" role="region" aria-label="Approve"><span data-split></span><button class="btn primary" type="button" data-approve>${icon("check")}<span data-label>Approve</span></button></div>` : ""}`;
    refreshBar();
  }

  function itemCard(it, decide) {
    const c = choice[it.item_id];
    const after = it.followed_up_after_cut ? `<p class="fu-after">${icon("check", "")}Followed up after the list: ${esc(deskTime(it.followed_up_after_cut))}</p>` : "";
    let ctl = "";
    if (it.state !== "pending") ctl = outcome(it);
    else if (it.own_seat) ctl = `<p class="fu-out muted">${icon("lock", "")}Another approver decides this one</p>`;
    else if (decide && c) {
      const until = c.action === "keep" ? `<div class="fu-until"><div class="field"><label for="fu-d-${it.item_id}">Follow up by</label><input class="input" type="date" id="fu-d-${it.item_id}" data-f="date" value="${esc(c.date)}"></div><div class="field"><label for="fu-t-${it.item_id}">At</label><input class="input" type="time" id="fu-t-${it.item_id}" data-f="time" value="${esc(c.time)}"></div></div>`
        : c.action === "excuse" ? `<div class="field"><label for="fu-d-${it.item_id}">Until (optional)</label><input class="input" type="date" id="fu-d-${it.item_id}" data-f="date" value="${esc(c.date)}"></div>` : "";
      ctl = `<div class="seg fu-seg" role="group" aria-label="Decision for lead ${+it.lead_id}">${ACT.map(([k, l]) => `<button type="button" data-act="${k}" aria-pressed="${c.action === k}">${esc(l)}</button>`).join("")}</div>
        ${c.action !== "reshuffle" ? `<div class="fu-more"><div class="field"><label for="fu-r-${it.item_id}">Reason</label><textarea class="textarea" id="fu-r-${it.item_id}" data-f="reason" rows="2" maxlength="200" placeholder="${c.action === "keep" ? "e.g. Customer travelling, visit fixed Monday" : "e.g. Customer abroad till the 20th"}">${esc(c.reason)}</textarea><div class="hint">5 to 200 letters</div></div>${until}</div>` : ""}
        <label class="fu-sel"><input type="checkbox" data-sel${c.sel ? " checked" : ""}><span>Include in this approval</span></label>`;
    }
    return `<article class="fu-card rise${it.state !== "pending" ? " done" : ""}${it.own_seat ? " own" : ""}" data-item="${+it.item_id}">${head(it)}${reasonsHtml(it)}${evidence(it)}${after}${ctl}</article>`;
  }

  function selected() { return Object.entries(choice).filter(([, c]) => c.sel); }
  function incomplete(c) {
    if (c.action === "reshuffle") return false;
    if (!ok(c.reason)) return true;
    return c.action === "keep" && !(c.date && c.time);
  }
  function refreshBar() {
    const bar = host.querySelector(".fu-bar");
    if (!bar) return;
    const sel = selected(), n = { reshuffle: 0, keep: 0, excuse: 0 };
    sel.forEach(([, c]) => { n[c.action] += 1; });
    const bad = sel.filter(([, c]) => incomplete(c)).length;
    bar.querySelector("[data-split]").textContent = bad ? `Add the reason${bad === 1 ? "" : "s"} (and the Keep date) to ${plural(bad, "lead")}` : sel.length ? [n.reshuffle && `${n.reshuffle} reshuffle`, n.keep && `${n.keep} keep`, n.excuse && `${n.excuse} excuse`].filter(Boolean).join(" · ") : "Nothing selected";
    bar.querySelector("[data-label]").textContent = `Approve ${sel.length} selected`;
    bar.querySelector("[data-approve]").disabled = busy || !sel.length || bad > 0;
  }

  async function approve() {
    const sel = selected();
    if (!sel.length || sel.some(([, c]) => incomplete(c))) return;
    const moves = sel.filter(([, c]) => c.action === "reshuffle").length;
    if (moves) {
      const yes = await confirmDialog({ title: `Move ${plural(moves, "lead")} to other salesmen?`, confirmLabel: "Approve",
        text: res.rules?.warn === false ? "Each one goes to another salesman of its band, inside office hours." : `Each one gives its salesman a "Not followed up" warning.` });
      if (!yes) return;
    }
    const decisions = sel.map(([id, c]) => ({ item_id: +id, action: c.action,
      ...(c.action !== "reshuffle" ? { reason: c.reason.trim() } : {}),
      ...(c.action === "keep" ? { until: `${c.date} ${c.time}` } : c.action === "excuse" && c.date ? { until: c.date } : {}) }));
    busy = true; refreshBar();
    let out;
    try { out = await desk.post("acc/followups/decide", { cycle_id: res.list.cycle_id, decisions }); }
    catch (e) {
      busy = false; refreshBar();
      if (e.status === 409 && e.code === "cycle_closed") { toast("This list is closed. Showing the latest one.", ""); load(); return; }
      toast(e.fields ? "Check the decisions: " + Object.values(e.fields)[0] : errText(e), "err");
      return;
    }
    busy = false;
    const items = {};
    for (const g of res.list.groups || []) for (const it of g.items) items[it.item_id] = it;
    const line = (x) => {
      const it = items[x.item_id] || {}, id = `#${+it.lead_id}`;
      if (!x.ok) return `<li class="neg">${icon("alert", "")}<span><b>${esc(id)}</b> ${esc(x.message || x.code || "not saved")}</span></li>`;
      if (x.state === "reshuffle") return `<li>${icon("repeat", "")}<span><b>${esc(id)}</b> ${esc(it.seat || "")} → ${esc(x.to_seat || "the owners")}${x.wave_at ? ` · clock starts ${esc(deskTime(x.wave_at))}` : ""}</span></li>`;
      if (x.state === "kept") return `<li>${icon("check", "")}<span><b>${esc(id)}</b> kept with ${esc(it.seat || "")} until ${esc(deskTime(x.until))}</span></li>`;
      return `<li>${icon("info", "")}<span><b>${esc(id)}</b> excused</span></li>`;
    };
    const s = out.summary || {};
    desk.done([s.reshuffle && `${s.reshuffle} moved`, s.kept && `${s.kept} kept`, s.excused && `${s.excused} excused`].filter(Boolean).join(", ") || "Saved");
    openSheet({ title: "Follow-up list decided", sub: esc([s.reshuffle ? `${s.reshuffle} moved` : "", s.kept ? `${s.kept} kept` : "", s.excused ? `${s.excused} excused` : "", s.failed ? `${s.failed} not saved` : ""].filter(Boolean).join(" · ")),
      body: `<ul class="fu-result">${(out.results || []).map(line).join("")}</ul>` });
    choice = {};
    load(true);
  }

  // ---------------------------------------------------------------- past lists
  async function loadPast() {
    host.innerHTML = `<div class="skel card h160"></div>`;
    let r;
    try { r = await desk.get("acc/followups/history"); }
    catch (e) { if (!ctx.alive() || tab !== "past") return; failBox(e, loadPast); return; }
    if (!ctx.alive() || tab !== "past") return;
    const rows = r.data || [];
    const word = { open: ["Open", "warn"], done: ["Decided", "pos"], expired: ["Expired", "neg"], empty: ["Nobody listed", ""] };
    host.innerHTML = rows.length ? `<ol class="fu-past card">${rows.map((x) => `<li><button type="button" class="fu-prow" data-cycle="${+x.cycle_id}">
        <span class="fu-pd"><b>${esc(day(x.built_at || x.cut_date, false))}</b><span class="badge ${(word[x.state] || ["", ""])[1]}">${esc((word[x.state] || [x.state])[0])}</span></span>
        <span class="fu-pn muted">${esc([plural(x.listed, "lead") + " listed", x.reshuffle && `${x.reshuffle} moved`, x.kept && `${x.kept} kept`, x.excused && `${x.excused} excused`, x.expired && `${x.expired} expired`].filter(Boolean).join(" · "))}${(x.decided_by || []).length ? ` · by ${esc(x.decided_by.join(", "))}` : ""}</span>${icon("right", "")}</button></li>`).join("")}</ol>`
      : `<div class="empty">${icon("history", "")}<b>No lists yet</b><p>Each list shows here once it is made.</p></div>`;
  }

  host.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-back]")) { viewing = null; tab = "past"; loadPast(); return; }
    const pr = t.closest("[data-cycle]");
    if (pr) { viewing = +pr.dataset.cycle; load(); return; }
    if (t.closest("[data-approve]")) { approve(); return; }
    const all = t.closest("[data-all]");
    if (all) {
      const g = (res.list?.groups || []).find((x) => x.seat === all.dataset.all);
      for (const it of g?.items || []) if (choice[it.item_id] && !it.own_seat) Object.assign(choice[it.item_id], { action: "reshuffle", sel: true });
      paintList(); return;
    }
    const card = t.closest("[data-item]"), act = t.closest("[data-act]");
    if (card && act) {
      const c = choice[+card.dataset.item];
      if (!c) return;
      c.action = act.dataset.act; c.sel = true;
      const fresh = document.createElement("div");
      const it = (res.list?.groups || []).flatMap((g) => g.items).find((x) => x.item_id === +card.dataset.item);
      fresh.innerHTML = itemCard(it, true);
      const n = fresh.firstElementChild; n.classList.remove("rise");
      card.replaceWith(n);
      n.querySelector("[data-f='reason']")?.focus();
      refreshBar();
    }
  });
  host.addEventListener("input", (e) => {
    const card = e.target.closest("[data-item]"), f = e.target.dataset.f;
    if (!card) return;
    const c = choice[+card.dataset.item];
    if (!c) return;
    if (f) c[f] = e.target.value;
    if (e.target.matches("[data-sel]")) c.sel = e.target.checked;
    refreshBar();
  });
  host.addEventListener("change", (e) => {
    if (!e.target.matches("[data-sel]")) return;
    const c = choice[+e.target.closest("[data-item]").dataset.item];
    if (c) { c.sel = e.target.checked; refreshBar(); }
  });
  onFeed((row) => {
    if (busy || tab !== "now" || viewing) return;
    if ((row.kind === "acc.changed" && /^followup_/.test(row.why || "")) || (row.kind === "lead.changed" && /^(followup_|pass|brief_|proof_|replied)/.test(row.why || ""))) {
      if (!host.querySelector(":focus") || !host.querySelector(".fu-bar")) load(true);
    }
  });
  every(30000, () => {
    const b = host.querySelector("[data-left]");
    if (b && res?.list?.approve_due_at) b.textContent = res.list.overdue ? "Overdue" : left(res.list.approve_due_at);
  });
  tab === "past" ? await loadPast() : await load();
}
