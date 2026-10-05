// Lead detail (APP-SPEC 3.3 to 3.5): who the customer is, the claim clock, the conversation or call transcript, the
// timeline and the actions. Every button maps to the same engine function the Telegram buttons use; the server
// decides what is allowed (the "allowed" block) and this page only hides what is not.
import { can } from "../state.js";
import { esc, icon, lakh, sentence } from "../util.js";
import { formDrawer, toast } from "../ui.js";
import * as desk from "../desk-api.js";
import { DEMO } from "../api.js";
import { channelLabel, clockHtml, deskAgo, deskTime, onFeed, setServerNow, STAGE_LABEL, STAGES, startTicker } from "../desk.js";

const LOST = [["price", "Price too high"], ["finance_rejected", "Loan not approved"], ["bought_elsewhere", "Bought elsewhere"], ["car_already_sold", "Car already sold"],
  ["exchange_value", "Exchange value too low"], ["customer_unreachable", "Could not reach the customer"], ["not_serious", "Not serious"], ["location", "Too far away"], ["other", "Other reason"]];
const LOST_LABEL = Object.fromEntries(LOST);
const KIND = {
  new: ["Lead came in", "inbox"], claimed: ["Claimed", "check"], contacted: ["Contacted", "phone"], visit_booked: ["Visit booked", "calendar"],
  test_drive: ["Test drive", "car"], sold: ["Sold", "tag"], lost: ["Lost", "x"], note: ["Note", "edit"], missed: ["Missed the claim time", "clock"],
  reassigned: ["Moved to another salesman", "repeat"], escalated: ["Escalated", "flag"], replied: ["Replied", "send"], ai_call: ["AI call booked", "phone"],
};
const PURPOSES = [["callback", "Call back the customer"], ["post_visit_followup", "Follow up after a visit"], ["feedback", "Ask for feedback"]];

export async function render(ctx) {
  const id = Number(ctx.id);
  if (!Number.isInteger(id) || id <= 0) { ctx.root.innerHTML = `<div class="lead-wrap">${notFound()}</div>`; return; }
  startTicker();
  let d = null;
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
  }

  function paint() {
    const l = d.lead, a = d.allowed || {};
    const act = can("desk.leads.act");
    const locked = l.status === "new" && !can("records.all");
    const stage = l.status === "lost" ? "lost" : l.status === "escalated" ? "escalated" : l.stage || l.status;
    const y = window.scrollY;
    wrap.innerHTML = `<div class="lead-page">
      <div class="lead-crumbs"><a class="back-link" href="#/inbox">${icon("left", "")}Inbox</a>${desk.sampleChip("desk/")}</div>
      <section class="lead-head tier-${esc(l.tier_key || "none")}">
        <div class="lh-top"><span class="lc-ch">${esc(channelLabel(l.channel))}</span><span class="lc-id">#${l.id}</span><span>${esc(deskAgo(l.first_seen_ts))}</span></div>
        <h1 class="page-title lead-name">${esc(l.name || "Customer")}</h1>
        <div class="lh-car">${esc(l.car || "No car named yet")}</div>
        <div class="lc-meta">${l.budget ? `<span class="lc-budget">${esc(lakh(l.budget))} budget</span>` : ""}${l.tier ? `<span class="tier-tag">${esc(l.tier)}</span>` : ""}<span class="lc-holder">${l.mine ? "Yours" : l.salesman ? `With ${esc(l.salesman)}` : "Not assigned"}</span></div>
        ${stepper(stage)}
      </section>
      ${a.claim && act ? claimPanel(l) : l.claim ? `<div class="ld-clock">${clockHtml(l.claim, { big: true })}<span class="muted">${l.mine ? "Claim it before the clock runs out" : `Waiting for ${esc(l.salesman || "the salesman")} to claim`}</span></div>` : ""}
      ${contactRow(l, a, locked)}
      ${act ? actionGrid(l, a) : can("records.all") ? `<p class="muted ld-readonly">${icon("eye", "")}You can see this lead. Only the salesman, the manager and the partners can act on it.</p>` : ""}
      ${l.status === "sold" && can("deals.create") ? `<div class="strip">${icon("tag", "")}<span><b>Sold. Book the deal next.</b><span class="muted">Price, payment and papers go on the Deals page, not here.</span></span><a class="btn sm" href="#/deals">Book the deal</a></div>` : ""}
      <div class="lead-cols">
        <section class="card ld-conv">${conversation(d, locked)}</section>
        <section class="card ld-time"><div class="card-h"><h2>Timeline</h2></div>${timeline(d)}</section>
      </div>
    </div>`;
    if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
  }

  wrap.addEventListener("click", async (e) => {
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
      { name: "token", label: "Token taken?", type: "select", required: true, full: true, options: [["1", "Yes, token taken"], ["0", "Not yet"]], value: "1" },
      { name: "note", label: "Note (optional)", type: "textarea", full: true }], (v) => ({ status: "sold", car: v.car, token_taken: v.token === "1", note: v.note || "" }), "Marked as sold", true);
    if (what === "lost") return statusForm("Lost", "Why did this lead not buy? It helps the team learn.", [
      { name: "lost_reason", label: "Reason", type: "select", required: true, full: true, options: LOST },
      { name: "note", label: "Note (optional)", type: "textarea", full: true }], (v) => ({ status: "lost", lost_reason: v.lost_reason, note: v.note || "" }), "Marked as lost", false, true);
    if (what === "note") return noteForm();
    if (what === "ai") return aiCallForm();
    if (what === "exotel") return exotel(b);
    if (what === "reply") return reply(b);
    if (what === "demo-call") { toast("Demo: calling is off.", "demo"); }
  });

  async function claim(btn) {
    btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Claiming`;
    try { await desk.post(`desk/leads/${id}/claim`, {}); desk.done(`Lead #${id} is yours. Call the customer now`); }
    catch (e) { toast(e.code === "already_claimed" ? e.message || "Someone claimed it first." : e.message || "Could not claim. Try again.", "err"); }
    await load(true);
  }

  function statusForm(title, sub, fields, body, okMsg, sold = false, danger = false) {
    const f = formDrawer({ title, sub: esc(sub), fields, submit: "Save", ok: "", danger,
      onSubmit: async (v) => {
        await desk.post(`desk/leads/${id}/status`, body(v));
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
    const f = formDrawer({ title: "Ask Anita to call", sub: "Anita is the AI caller. You will see what she will say before anything happens.", submit: "Preview", ok: "",
      fields: [
        { name: "purpose", label: "What for", type: "select", required: true, full: true, options: PURPOSES, value: "callback" },
        { name: "when", label: "When", required: true, full: true, placeholder: "e.g. today 5 pm, kal 11 baje" },
        { name: "note", label: "Anything she should mention (optional)", type: "textarea", full: true }],
      onSubmit: async (v, dr) => {
        const r = await desk.post(`desk/leads/${id}/ai-call`, { purpose: v.purpose, when: v.when, note: v.note || "" });
        setTimeout(() => confirmAi(r), 300);
        void dr;
      } });
    f.el.classList.add("sheet");
  }
  function confirmAi(r) {
    const f = formDrawer({ title: "Confirm the call", sub: r.due_at ? `Planned for ${esc(deskTime(r.due_at))}` : "", submit: "Yes, book the call", ok: "", cancel: "Cancel",
      before: `<div class="ai-preview">${icon("phone", "")}<p>${esc(r.preview || "")}</p></div>`, fields: [],
      onSubmit: async () => { await desk.post(`desk/ai-actions/${r.action_id}/confirm`, {}); desk.done("AI call booked"); load(true); } });
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

  onFeed((row) => { if (/^lead\./.test(row.kind || "") && (!row.lead_id || row.lead_id === id)) load(true); });
  await load();
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

function contactRow(l, a, locked) {
  if (locked) return `<div class="ld-locked">${icon("lock", "")}<span>Phone, chat and recording open after you claim.</span></div>`;
  const btns = [];
  if (a.call_tel && l.tel_url) btns.push(`<a class="btn pos big-btn" href="${esc(l.tel_url)}">${icon("phone")}Call</a>`);
  if (a.whatsapp_link && l.whatsapp_url) btns.push(`<a class="btn big-btn wa-btn" href="${esc(l.whatsapp_url)}" target="_blank" rel="noopener noreferrer">${icon("wa")}WhatsApp</a>`);
  if (a.call_exotel) btns.push(`<button class="btn big-btn" type="button" data-act="exotel">${icon("phone")}Call via business number</button>`);
  if (!btns.length && can("desk.leads.act") && l.status !== "new") {
    if (DEMO) btns.push(`<button class="btn pos big-btn" type="button" data-act="demo-call">${icon("phone")}Call</button>`, `<button class="btn big-btn wa-btn" type="button" data-act="demo-call">${icon("wa")}WhatsApp</button>`);
  }
  const phone = l.phone_display ? `<span class="ld-phone">${icon("phone", "")}${esc(l.phone_display)}</span>` : "";
  if (!btns.length && !phone) return "";
  return `<div class="ld-contact">${phone}<div class="ld-contact-btns">${btns.join("")}</div></div>`;
}

function actionGrid(l, a) {
  const B = (k, label, ic, cls = "") => (a[k] ? `<button class="btn act-btn ${cls}" type="button" data-act="${k === "ai_call" ? "ai" : k}">${icon(ic)}<span>${esc(label)}</span></button>` : "");
  const list = [B("contacted", "Contacted", "phone"), B("visit_booked", "Visit booked", "calendar"), B("test_drive", "Test drive", "car"),
    B("sold", "Sold", "tag", "good"), B("lost", "Lost", "x", "bad"), B("note", "Add note", "edit"), B("ai_call", "Ask Anita to call", "spark")].filter(Boolean);
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

function timeline(d) {
  const rows = (d.timeline || []).slice().reverse();
  if (!rows.length) return `<p class="muted">Nothing yet.</p>`;
  return `<ol class="ld-timeline">${rows.map((r) => {
    const [label, ic] = KIND[r.kind] || [sentence(r.kind || "update"), "info"];
    let note = r.note;
    if (r.kind === "lost" && LOST_LABEL[note]) note = LOST_LABEL[note];
    if (r.kind === "visit_booked" && note && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(note)) note = `For ${deskTime(note)}`;
    return `<li class="k-${esc(r.kind)}"><span class="ic">${icon(ic, "")}</span><div><b>${esc(label)}</b>${r.who ? ` <span class="muted">by ${esc(r.who)}</span>` : ""}${note ? `<p>${esc(note)}</p>` : ""}<time>${esc(deskTime(r.ts))}</time></div></li>`;
  }).join("")}</ol>${d.annotation?.lost_reason ? `<p class="muted small-note">Lost because: ${esc(LOST_LABEL[d.annotation.lost_reason] || d.annotation.lost_reason)}</p>` : ""}`;
}
