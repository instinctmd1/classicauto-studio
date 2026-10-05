// Feedback: bad feedback to resolve first (with a response timer), then the full feed of good and bad.
import * as api from "../api.js";
import { get } from "../api.js";
import { state, can, periodLabel } from "../state.js";
import { badge, dateTimeFmt, duration, esc, icon, minutesSince, mount, num, pct, sentence } from "../util.js";
import { formDrawer, pageHead } from "../ui.js";
import { card, kpiTile } from "./_shared.js";

const SRC = { engine_confirmed: "Customer confirmed a callback", engine_denied: "Customer said nobody called", post_delivery: "After delivery", google_review: "Google review", walk_in: "Walk-in", complaint: "Complaint", other: "Other" };
const SLA_HOURS = 48;
const short = (n) => String(n || "").replace(/\s*\(demo\)/, "");
let view = "todo", sent = "all";

export async function render(ctx) {
  const p = ctx.period;
  const res = await get("feedback", { period: p });
  const all = await get("feedback");
  if (!ctx.alive()) return;
  const stats = res.stats || {};
  const manage = can("feedback.manage");
  const open = all.data.filter((f) => f.sentiment === "bad" && !f.resolved_at).sort((a, b) => a.ts.localeCompare(b.ts));
  const over = open.filter((f) => minutesSince(f.ts) > SLA_HOURS * 60).length;
  const good = res.data.filter((f) => f.sentiment === "good").length, bad = res.data.filter((f) => f.sentiment === "bad").length;
  view = ctx.query.get("view") || "todo"; sent = "all";
  mount(ctx.root, pageHead({ title: "Feedback", sub: `${esc(periodLabel(p))}. Bad feedback sits on top until someone resolves it. Aim to answer within ${SLA_HOURS} hours.`,
    actions: manage ? `<button class="btn primary" type="button" id="add-fb">${icon("plus")}Add feedback</button>` : "" })
    + `<div class="kpis four">${[
      kpiTile({ label: "Good", value: stats.good ?? good, sub: "In this period" }),
      kpiTile({ label: "Bad", value: stats.bad ?? bad, neg: (stats.bad ?? bad) > 0, sub: "In this period" }),
      kpiTile({ label: "Satisfied", value: stats.satisfaction_pct ?? (good + bad ? (good / (good + bad)) * 100 : null), kind: "pct", sub: "Good out of good plus bad" }),
      kpiTile({ label: "To resolve", value: open.length, neg: open.length > 0, sub: over ? `${over} past ${SLA_HOURS} hours` : "None past the response time" }),
    ].join("")}</div>
    <section class="card flush rise sec-gap"><div class="toolbar pad-top"><div class="seg" id="seg" role="group" aria-label="Show"></div><div class="seg" id="sent" role="group" aria-label="Sentiment" hidden></div></div><div id="tb" class="pad-box"></div></section>`);
  const draw = () => {
    ctx.root.querySelector("#seg").innerHTML = [["todo", "To resolve", open.length], ["feed", "Everything", res.data.length]].map(([k, l, n]) => `<button type="button" aria-pressed="${view === k}" data-v="${k}">${l}<span class="n">${n}</span></button>`).join("");
    const sg = ctx.root.querySelector("#sent"); sg.hidden = view !== "feed";
    sg.innerHTML = [["all", "All"], ["good", "Good"], ["bad", "Bad"]].map(([k, l]) => `<button type="button" aria-pressed="${sent === k}" data-s="${k}">${l}</button>`).join("");
    const list = view === "todo" ? open : res.data.filter((f) => sent === "all" || f.sentiment === sent);
    ctx.root.querySelector("#tb").innerHTML = list.length ? `<div class="stack-form">${list.slice(0, 80).map((f) => card1(f, manage)).join("")}</div>${list.length > 80 ? `<p class="note sec">${icon("info", "")}Showing 80 of ${num(list.length)}.</p>` : ""}` : `<div class="empty">${icon("check", "")}<b>${view === "todo" ? "Nothing to resolve" : "No feedback in this period"}</b><p>${view === "todo" ? "Every bad item has been answered." : "Try another month in the period picker."}</p></div>`;
  };
  draw();
  ctx.root.addEventListener("click", (e) => {
    const v = e.target.closest("[data-v]"), s = e.target.closest("[data-s]"), r = e.target.closest("[data-resolve]");
    if (v) { view = v.dataset.v; draw(); } if (s) { sent = s.dataset.s; draw(); }
    if (r) { const f = all.data.find((x) => x.id === +r.dataset.resolve); formDrawer({ title: "Resolve this feedback", sub: esc(f.text || ""), submit: "Mark resolved", ok: "Resolved", fields: [{ name: "resolution", label: "What did you do?", type: "textarea", required: true, full: true, placeholder: "Called the customer, apologised, booked a new test drive" }], onSubmit: async (vals) => { await api.patch(`feedback/${f.id}`, { resolve: true, resolution: vals.resolution }); ctx.refresh(); } }); }
  });
  ctx.root.querySelector("#add-fb")?.addEventListener("click", () => formDrawer({ title: "Add feedback", submit: "Save", ok: "Feedback saved", fields: [
    { name: "sentiment", label: "How was it", type: "select", required: true, options: [["good", "Good"], ["neutral", "Neutral"], ["bad", "Bad"]] }, { name: "source", label: "Where from", type: "select", required: true, options: [["post_delivery", "After delivery"], ["google_review", "Google review"], ["walk_in", "Walk-in"], ["complaint", "Complaint"], ["other", "Other"]] },
    { name: "rating", label: "Rating (1 to 5)", type: "number", step: 1, min: 1, max: 5 }, { name: "text", label: "What they said", type: "textarea", full: true }],
    onSubmit: async (v) => { const b = { ...v }; for (const k of Object.keys(b)) if (b[k] === null) delete b[k]; await api.post("feedback", b); ctx.refresh(); } }));
}

function card1(f, manage) {
  const hrs = Math.floor(minutesSince(f.ts) / 60), pending = f.sentiment === "bad" && !f.resolved_at, late = pending && hrs > SLA_HOURS;
  return `<article class="fb-card ${f.sentiment}"><div class="hd"><span class="pill ${f.sentiment === "bad" ? "neg" : f.sentiment === "good" ? "pos" : ""}">${icon(f.sentiment === "bad" ? "thumbdown" : "up", "")}${esc(sentence(f.sentiment))}</span><span>${esc(SRC[f.source] || sentence(f.source))}</span>${f.staff_name ? `<span>${esc(short(f.staff_name))}</span>` : ""}<span>${esc(dateTimeFmt(f.ts))}</span>${pending ? `<span class="sla ${late ? "timer" : ""}">waiting ${duration(hrs * 60, { short: true })}</span>` : ""}</div>
    <div class="tx">${esc(f.text || "No note.")}</div>${f.resolved_at ? `<div class="muted">Resolved ${esc(dateTimeFmt(f.resolved_at))}${f.resolution ? `: ${esc(f.resolution)}` : ""}</div>` : ""}
    ${pending && manage ? `<div><button class="btn sm" type="button" data-resolve="${f.id}">${icon("check")}Resolve</button></div>` : ""}</article>`;
}
