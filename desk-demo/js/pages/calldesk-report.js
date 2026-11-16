// Call desk daily view (CALLDESK-SPEC.md section 7), for the owner and the manager: calls received, missed and called back;
// inquiries per call-desk person and per salesman; how long each step took. No phone numbers and no money.
import * as api from "../desk-api.js";          // the Desk screens' one door to the server (the demo answers from sample data)
import { badge, dateFmt, esc, icon, mount, nowIstStr } from "../util.js";
import { pageHead } from "../ui.js";
import { kpiTile } from "./_shared.js";

const mins = (m) => (m == null ? "—" : m < 1 ? "under 1 min" : m < 90 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`);
const INTEREST = { hot: "Hot", warm: "Warm", cold: "Cold" };      // the desk's rating, the call brief's scale
const shift = (day, k) => new Date(Date.parse(day + "T00:00:00Z") + k * 864e5).toISOString().slice(0, 10);

export async function render(ctx) {
  const today = nowIstStr().slice(0, 10);
  let day = /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.get("day") || "") ? ctx.query.get("day") : today;
  mount(ctx.root, `<div class="cd rep">${pageHead({ title: "Call desk today", sub: "Calls to the showroom number, the inquiries the desk sent, and how fast each one reached a salesman." })}
    <div class="cd-day" role="group" aria-label="Day"><button class="btn cd-step-btn" type="button" data-k="-1" aria-label="Day before">${icon("left")}</button>
      <label class="sr" for="cd-date">Day</label><input class="input cd-date" id="cd-date" type="date" max="${today}" value="${day}">
      <button class="btn cd-step-btn" type="button" data-k="1" aria-label="Next day">${icon("right")}</button><button class="btn" type="button" id="today">Today</button></div>
    <p class="cd-daylabel" id="daylabel"></p><div id="rep"><div class="skel card"></div></div></div>`);
  const root = ctx.root.querySelector(".cd");          // #main is shared by every page: bind to this render's own wrapper
  const box = root.querySelector("#rep");
  const load = async () => {
    history.replaceState(null, "", day === today ? "#/calldesk-report" : `#/calldesk-report?day=${day}`);
    ctx.root.querySelector("#cd-date").value = day;
    ctx.root.querySelector("#today").hidden = day === today;
    ctx.root.querySelector('[data-k="1"]').disabled = day >= today;
    ctx.root.querySelector("#daylabel").textContent = new Date(Date.parse(day + "T00:00:00Z")).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    box.innerHTML = `<div class="skel card"></div>`;
    let r;
    try { r = await api.get("calldesk/report", { day }); } catch (e) { box.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not load the day.</b><span class="muted">${esc(e.message)}</span></div></div>`; return; }
    if (!ctx.alive()) return;
    box.innerHTML = html(r);
    box.querySelectorAll(".cd-track i").forEach((n) => n.style.setProperty("--w", n.dataset.w));
  };
  root.addEventListener("click", (e) => {
    const k = e.target.closest("[data-k]"); if (k) { const n = shift(day, +k.dataset.k); if (n <= today) { day = n; load(); } return; }
    if (e.target.closest("#today")) { day = today; load(); }
  });
  ctx.root.querySelector("#cd-date").addEventListener("change", (e) => { if (e.target.value && e.target.value <= today) { day = e.target.value; load(); } });
  await load();
}

function timing(title, t, what) {
  const top = Math.max(t.max_min || 0, 1);
  return `<div class="cd-t"><h3>${esc(title)}</h3><p class="cd-t-big">${t.n ? mins(t.median_min) : "—"}</p>
    <p class="cd-t-l">${t.n ? `Middle of ${t.n} ${what}. Slowest <b>${mins(t.max_min)}</b>.` : `No ${what} yet.`}</p>
    <span class="cd-track" aria-hidden="true"><i data-w="${t.n ? Math.round(((t.median_min || 0) / top) * 100) : 0}%"></i></span></div>`;
}

function html(r) {
  const c = r.calls, q = r.inquiries;
  const tiles = `<div class="kpis cd-tiles">${[
    kpiTile({ label: "Calls received", value: c.received, sub: c.received ? `${c.answered} answered` : "Exotel calls, when it is on" }),
    kpiTile({ label: "Missed", value: c.missed, neg: c.missed_open > 0, sub: c.missed ? `${c.called_back} called back` : "None missed" }),
    kpiTile({ label: "Still to call back", value: c.missed_open, neg: c.missed_open > 0, sub: c.missed_open ? "Missed callers nobody has rung" : "Everyone was called back" }),
    kpiTile({ label: "Inquiries", value: q.total, sub: `${c.typed_in} typed from the office phone` }),
    kpiTile({ label: "Sent to a salesman", value: q.sent, sub: "New leads" }),
    kpiTile({ label: "Added to a lead", value: q.added, sub: q.not_sent ? `${q.not_sent} not sent yet` : "Repeat callers, no duplicate" }),
  ].join("")}</div>`;
  const hot = `<section class="sec-gap"><div class="sec-h"><h2>How interested</h2></div><div class="kpis cd-tiles three">${[
    kpiTile({ label: "Hot", value: q.hot || 0, sub: "buying or selling this week" }),
    kpiTile({ label: "Warm", value: q.warm || 0, sub: "this month" }),
    kpiTile({ label: "Cold", value: q.cold || 0, sub: "just looking" }),
  ].join("")}</div></section>`;
  const cb = r.callbacks || {};
  const backs = `<section class="sec-gap"><div class="sec-h"><h2>Call-backs</h2></div><div class="kpis cd-tiles four">${[
    kpiTile({ label: "Reached", value: cb.reached || 0, sub: "spoke to the caller" }),
    kpiTile({ label: "No answer", value: cb.no_answer || 0, neg: (cb.no_answer || 0) > 0, sub: "tries nobody answered" }),
    kpiTile({ label: "Call later", value: cb.call_later || 0, sub: "the caller asked for later" }),
    kpiTile({ label: "Wrong number", value: cb.wrong_number || 0, sub: "closed" }),
  ].join("")}</div></section>`;
  const times = `<section class="sec-gap"><div class="sec-h"><h2>How long it took</h2></div><div class="cd-timing">
    ${timing("Call to inquiry sent", r.timing.call_to_sent, "inquiries")}
    ${timing("Inquiry to salesman's claim", r.timing.sent_to_claim, "claimed leads")}
    ${timing("Missed call to call-back", r.timing.callback, "call-backs")}</div></section>`;
  const desk = r.by_desk.length ? `<div class="card flush"><table class="tbl left"><thead><tr><th>Call desk</th><th>Inquiries</th><th>New leads</th><th>Added</th><th>Not sent</th><th>Call to sent</th></tr></thead><tbody>${r.by_desk.map((d) => `<tr><td>${esc(d.name || "—")}</td><td>${d.inquiries}</td><td>${d.sent}</td><td>${d.added}</td><td>${d.not_sent}</td><td>${mins(d.median_call_to_sent_min)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="cd-none">No inquiries this day.</p>`;
  const sales = r.by_salesman.length ? `<div class="card flush"><table class="tbl left"><thead><tr><th>Salesman</th><th>Inquiries</th><th>Claimed</th><th>Waiting</th><th>Sent to claim</th></tr></thead><tbody>${r.by_salesman.map((s) => `<tr><td>${esc(s.label || s.seat)}</td><td>${s.inquiries}</td><td>${s.claimed}</td><td>${s.open}</td><td>${mins(s.median_sent_to_claim_min)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="cd-none">Nothing sent this day.</p>`;
  const list = r.rows.length ? `<div class="card flush"><table class="tbl left"><thead><tr><th>Call</th><th>Taken by</th><th>Salesman</th><th>Call to sent</th><th>Sent to claim</th><th>Now</th></tr></thead><tbody>${r.rows.map((x) => `<tr><td>${esc(String(x.at).slice(11, 16))}<span class="cd-intent">${x.intent === "sell" ? "Selling" : "Buying"}${x.typed_in ? " · office phone" : ""}</span>${INTEREST[x.interest] ? ` ${badge(INTEREST[x.interest], `int-${x.interest}`)}` : ""}</td><td>${esc(x.desk || "—")}</td><td>${esc(x.salesman_label || "—")}</td><td>${mins(x.call_to_sent_min)}</td><td>${x.state === "added" ? "Added to a lead" : mins(x.sent_to_claim_min)}</td><td>${esc(x.status_label)}</td></tr>`).join("")}</tbody></table></div>` : "";
  return `${tiles}${hot}${backs}${times}
    <section class="sec-gap"><div class="sec-h"><h2>By call-desk person</h2></div>${desk}</section>
    <section class="sec-gap"><div class="sec-h"><h2>By salesman</h2></div>${sales}</section>
    ${list ? `<section class="sec-gap"><div class="sec-h"><h2>Every inquiry</h2><span class="rp-count">${r.rows.length}</span></div>${list}</section>` : ""}
    <p class="cd-foot sec-gap">${icon("lock", "")}<span>No phone numbers and no money on this page. ${esc(dateFmt(r.day))}.</span></p>`;
}
