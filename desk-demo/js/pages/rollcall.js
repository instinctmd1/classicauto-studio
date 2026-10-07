// Roll-call (APP-SPEC section 12). At closing time the engine asks every salesman about his open leads; here he answers
// each one with Sold, Follow-up or Lost (the same three answers as the Telegram buttons). The manager and the owners see
// every seat: sent or not, how many answered, and who is on fewer leads for missing one. Answers go to the engine through
// the server; nothing is decided here.
import { esc, icon } from "../util.js";
import { confirmDialog, pageHead, toast } from "../ui.js";
import * as desk from "../desk-api.js";
import { deskTime, every, onFeed, setServerNow } from "../desk.js";
import { ANSWER, LOST, answerBadge } from "./_rollcall.js";

const day = (ts) => {
  const d = String(ts || "").slice(0, 10), today = new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
  if (d === today) return "Tonight";
  const t = new Date(d + "T12:00:00Z");
  return isNaN(t) ? d : t.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
};
const STATE = { answered: ["All answered", "pos"], open: ["Waiting", "warn"], missed: ["Missed", "neg"], none: ["Not sent", ""] };

export async function render(ctx) {
  ctx.root.innerHTML = `${pageHead({ title: "Roll-call", sub: "Every evening at closing time: what happened with each open lead today. Answer every lead before the next roll-call, or the seat gets fewer leads for 2 days." })}<div id="rc" class="rc"><div class="skel card h420"></div></div>`;
  const host = ctx.root.querySelector("#rc");
  let data = null, lostOpen = null;
  const busy = new Set();

  async function load(quiet = false) {
    try { data = await desk.get("rollcall", {}, quiet ? { background: true } : {}); }
    catch (e) {
      if (!ctx.alive() || quiet) return;
      host.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>The roll-call could not load.</b><span class="muted">${esc(e.message || "")}</span></div><button class="btn" type="button" id="rc-retry">${icon("refresh")}Try again</button></div>`;
      host.querySelector("#rc-retry").addEventListener("click", () => load());
      return;
    }
    if (!ctx.alive()) return;
    setServerNow(data.server_now);
    paint();
  }

  function rowHtml(c, x) {
    const lead = x.mine
      ? `<a class="rc-lead" href="#/lead/${+x.id}"><b>#${+x.id}</b><span class="rc-car">${esc(x.car || "Car not noted")}</span>${x.name ? `<span class="muted">${esc(x.name)}</span>` : ""}</a>`
      : `<span class="rc-lead"><b>#${+x.id}</b><span class="muted">Now with ${esc(x.holder || "someone else")}</span></span>`;
    let act;
    if (x.answer) act = answerBadge(x.answer);
    else if (!data.can_answer || c.state !== "open") act = `<span class="badge">${c.state === "missed" ? "No answer" : "Open"}</span>`;
    else if (busy.has(x.id)) act = `<span class="rc-busy"><span class="spin"></span>Saving</span>`;
    else if (!x.mine) act = `<div class="rc-acts"><button class="btn sm" type="button" data-a="followup" data-id="${+x.id}">Mark answered</button></div>`;
    else if (lostOpen === x.id) act = `<form class="rc-lost" data-id="${+x.id}"><label class="sr" for="rc-r${+x.id}">Why was it lost?</label><select class="input" id="rc-r${+x.id}" name="reason" required><option value="">Why lost?</option>${LOST.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select><button class="btn sm danger" type="submit">Mark lost</button><button class="btn sm ghost" type="button" data-cancel>Cancel</button></form>`;
    else act = `<div class="rc-acts" role="group" aria-label="Lead #${+x.id}"><button class="btn sm" type="button" data-a="sold" data-id="${+x.id}">${icon("check", "")}Sold</button><button class="btn sm" type="button" data-a="followup" data-id="${+x.id}">${icon("repeat", "")}Follow-up</button><button class="btn sm" type="button" data-a="lost" data-id="${+x.id}">${icon("x", "")}Lost</button></div>`;
    return `<li class="rc-row${x.answer ? " done" : ""}">${lead}${act}</li>`;
  }

  function cardHtml(c) {
    const [label, kind] = STATE[c.state] || STATE.open;
    return `<section class="card rc-card" aria-label="Roll-call ${esc(day(c.ts))}">
      <div class="card-h"><div><h2>${esc(day(c.ts))}</h2><p class="card-sub">Sent ${esc(deskTime(c.ts))} · ${c.answered} of ${c.total} answered</p></div><div class="act"><span class="badge ${kind}">${label}</span></div></div>
      <progress class="rc-prog" max="${Math.max(1, c.total)}" value="${c.answered}" aria-label="${c.answered} of ${c.total} answered"></progress>
      <ol class="rc-list">${c.leads.map((x) => rowHtml(c, x)).join("")}</ol>
    </section>`;
  }

  function boardHtml(b) {
    const tonight = !b.day || day(b.day) === "Tonight";           // after midnight: last night's round, until the next one
    const seats = b.seats.map((s) => {
      const [label, kind] = s.state === "open" ? [`${s.answered} of ${s.total}`, "warn"] : STATE[s.state] || STATE.none;
      const pen = s.penalty_until ? `<span class="badge neg" title="Fewer leads until ${esc(s.penalty_until.slice(0, 10))}">Fewer leads</span>` : "";
      const leads = s.leads && s.leads.length
        ? `<div class="rc-dots">${s.leads.map((x) => `<a class="rc-dot${x.answer ? " on " + (ANSWER[x.answer] || [])[1] : ""}" href="#/lead/${+x.id}" aria-label="Lead ${+x.id}: ${esc(x.answer ? (ANSWER[x.answer] || ["Answered"])[0] : "waiting")}">#${+x.id}${x.answer ? `<span>${esc((ANSWER[x.answer] || ["Answered"])[0])}</span>` : ""}</a>`).join("")}</div>`
        : `<p class="muted rc-none">No roll-call ${tonight ? "tonight" : "that evening"}: no open leads, or nobody on this seat uses Telegram or the app yet.</p>`;
      return `<li class="rc-seat"><div class="rc-seat-h"><b>${esc(s.seat)}</b>${pen}<span class="badge ${kind}">${esc(label)}</span></div>${leads}</li>`;
    }).join("");
    return `<section class="card flush rc-board"><div class="card-h"><div><h2>${tonight ? "The team tonight" : `The team: roll-call of ${esc(day(b.day))}`}</h2><p class="card-sub">${b.sent ? `${b.answered} of ${b.sent} seat${b.sent === 1 ? "" : "s"} answered` : "The roll-call goes out at closing time"}</p></div></div><ul class="rc-seats">${seats}</ul></section>`;
  }

  function paint() {
    const mine = data.mine || [];
    let html = mine.map(cardHtml).join("");
    if (!mine.length && !data.board) html = `<div class="empty card">${icon("moon", "")}<b>No roll-call for you right now</b><p>At closing time the app asks about each of your open leads. You get a notification; answer each lead with Sold, Follow-up or Lost.</p></div>`;
    if (data.board) html += boardHtml(data.board);
    host.innerHTML = html;
  }

  async function send(id, answer, extra = {}) {
    busy.add(id); lostOpen = null; paint();
    try {
      const r = await desk.post(`rollcall/${id}/answer`, { answer, ...extra });
      data.mine = r.mine || data.mine;
      desk.done(r.answer === "moved" ? `Lead #${id} is with someone else now: counted as answered` : `Lead #${id}: ${(ANSWER[answer] || [answer])[0]}`);
    } catch (e) { toast(e.message || "That did not save. Try again.", "err"); }
    busy.delete(id);
    if (!ctx.alive()) return;
    paint();
    if (data.board) load(true);
  }

  host.addEventListener("click", async (e) => {
    const cancel = e.target.closest("[data-cancel]");
    if (cancel) { lostOpen = null; paint(); return; }
    const b = e.target.closest("button[data-a]");
    if (!b) return;
    const id = +b.dataset.id, a = b.dataset.a;
    if (a === "lost") { lostOpen = id; paint(); host.querySelector(`#rc-r${id}`)?.focus(); return; }
    if (a === "sold" && !(await confirmDialog({ title: `Mark lead #${id} sold?`, text: "The lead closes as sold. Add the token and papers on the lead's page.", confirmLabel: "Mark sold" }))) return;
    send(id, a);
  });
  host.addEventListener("submit", (e) => {
    const f = e.target.closest(".rc-lost");
    if (!f) return;
    e.preventDefault();
    const reason = f.reason.value;
    if (!reason) { f.reason.focus(); toast("Pick why it was lost.", "err"); return; }
    send(+f.dataset.id, "lost", { lost_reason: reason });
  });

  onFeed((it) => { if (it.kind === "lead.changed" && !busy.size && lostOpen === null) load(true); });
  every(60000, () => { if (!busy.size && lostOpen === null) load(true); });
  await load();
}
