// Owner reports (APP-SPEC section 12): the daily, weekly and monthly reports the lead engine sends the owners and the
// manager, kept for the app. The text is the engine's own (counts and seat names only). The money strip on a report
// (cars delivered, turnover, net profit for the same dates) comes from the books and only for an owner login with money.
import { esc, icon, lakh, pct } from "../util.js";
import { pageHead } from "../ui.js";
import * as desk from "../desk-api.js";
import { deskTime } from "../desk.js";

const KINDS = [["", "All"], ["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"]];
const when = (ts) => {
  const t = new Date(String(ts || "").slice(0, 10) + "T12:00:00Z");
  return isNaN(t) ? "" : t.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

function failed(host, e, retry) {
  host.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>The reports could not load.</b><span class="muted">${esc(e.message || "")}</span></div><button class="btn" type="button" id="rp-retry">${icon("refresh")}Try again</button></div>`;
  host.querySelector("#rp-retry").addEventListener("click", retry);
}

export async function render(ctx) {
  if (ctx.id) return one(ctx, +ctx.id);
  const kind = KINDS.some(([k]) => k === ctx.query.get("kind")) ? ctx.query.get("kind") : "";
  ctx.root.innerHTML = `${pageHead({ title: "Owner reports", sub: "The daily report 30 minutes after closing, the weekly one on Monday morning, the monthly one on the last day of the month." })}
    <div class="seg rp-kinds" role="tablist" aria-label="Which reports">${KINDS.map(([k, l]) => `<button type="button" role="tab" data-kind="${k}" aria-selected="${k === kind}">${l}</button>`).join("")}</div>
    <div id="rp"><div class="skel card"></div></div>`;
  const host = ctx.root.querySelector("#rp");
  ctx.root.querySelector(".rp-kinds").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-kind]");
    if (b) ctx.go(`#/reports${b.dataset.kind ? "?kind=" + b.dataset.kind : ""}`);
  });
  async function load() {
    let r;
    try { r = await desk.get("owner-reports", kind ? { kind } : {}); } catch (e) { if (ctx.alive()) failed(host, e, load); return; }
    if (!ctx.alive()) return;
    if (!r.data.length) {
      host.innerHTML = `<div class="empty card">${icon("reports", "")}<b>No reports yet</b><p>They appear here as the engine sends them, with a notification. Telegram keeps getting them too until the owners switch it off.</p></div>`;
      return;
    }
    host.innerHTML = `<ul class="card flush rp-list">${r.data.map((x) => `<li><a class="rp-row" href="#/reports/${+x.id}"><span class="badge ${x.kind === "month" ? "cream" : x.kind === "week" ? "info" : ""}">${esc(x.label)}</span><span class="rp-t">${esc(x.title)}</span><span class="muted rp-when">${esc(deskTime(x.ts))}</span>${icon("right", "")}</a></li>`).join("")}</ul>`;
  }
  await load();
}

async function one(ctx, id) {
  ctx.root.innerHTML = `<a class="back-link rp-back" href="#/reports">${icon("left", "")}All reports</a><div id="rp"><div class="skel card h420"></div></div>`;
  const host = ctx.root.querySelector("#rp");
  async function load() {
    let r;
    try { r = await desk.get(`owner-reports/${id}`); } catch (e) { if (ctx.alive()) failed(host, e, load); return; }
    if (!ctx.alive()) return;
    const m = r.money;
    const money = m ? `<section class="rp-money" aria-label="Money for the same dates">
        <div><span class="eyebrow">Cars delivered</span><b>${+m.cars_sold}</b></div>
        <div><span class="eyebrow">Turnover</span><b>${esc(lakh(m.turnover))}</b></div>
        <div><span class="eyebrow">Net profit</span><b class="${m.net_profit < 0 ? "neg" : ""}">${esc(lakh(m.net_profit))}</b></div>
        <div><span class="eyebrow">Gross margin</span><b>${esc(pct(m.gross_margin_pct))}</b></div>
        <p class="muted">From the books, ${esc(when(m.from))} to ${esc(when(m.to))}. Only owner logins see this.</p></section>` : "";
    host.innerHTML = `${pageHead({ title: r.label, sub: esc(r.title) })}${money}
      <article class="card rp-text-card"><div class="card-h"><div><h2>From the lead engine</h2><p class="card-sub">Sent ${esc(deskTime(r.ts))}</p></div></div><pre class="rp-text">${esc(r.text)}</pre></article>`;
  }
  await load();
}
