// Today: the day board. One page for everyone; a salesman's view is scoped to his own work by the server.
import * as api from "../api.js";
import { get } from "../api.js";
import { state, can, chan, bandShort } from "../state.js";
import { dateFmt, duration, esc, icon, minutesSince, mount, nowIstStr, num, sentence } from "../util.js";
import { openMenu, pageHead, save } from "../ui.js";
import { alertsHtml, bindAlertGroups, card, followupInfo } from "./_shared.js";

const short = (n) => String(n || "").replace(/\s*\(demo\)/, "");
const hhmm = (ts) => String(ts || "").slice(11, 16);
const hourOf = (ts) => +String(ts).slice(11, 13) + +String(ts).slice(14, 16) / 60;
const OUTCOMES = [["interested", "Interested"], ["negotiating", "Negotiating"], ["not_interested", "Not interested"], ["no_show", "Did not come"]];

export function dayBoard(T, { scoped = false } = {}) {
  const slaMin = state.settings?.lead_sla_minutes || 10;
  const leads = (T.new_leads || []).map((l) => ({ ...l, wait: Math.max(0, Math.round(minutesSince(l.first_seen_ts))) })).sort((a, b) => b.wait - a.wait);
  const drives = T.test_drives || [], fu = (T.followups || []).slice().sort((a, b) => a.due_at.localeCompare(b.due_at));
  const dels = T.deliveries || [], rto = T.rto_tasks || [], papers = T.papers_pending || [];
  const nowIst = nowIstStr();

  // the agenda: everything with a time, in order, with the next one marked
  const agenda = [
    ...drives.map((d) => ({ at: d.scheduled_at, kind: "drive", id: d.id, title: `Test drive · ${d.make} ${d.model}`, sub: `${d.stock_no}${d.staff ? " · " + short(d.staff) : ""}`, done: !!d.outcome, outcome: d.outcome })),
    ...fu.filter((f) => f.due_at.slice(0, 10) <= state.today).map((f) => ({ at: f.due_at, kind: "fu", id: f.id, ...followupInfo(f), who: f.staff ? short(f.staff) : "", late: f.due_at.slice(0, 10) < state.today })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const nextIdx = agenda.findIndex((a) => !a.done && a.at >= nowIst);
  const agendaHtml = agenda.length ? `<ul class="list agenda">${agenda.map((a, i) => `<li${i === nextIdx ? ' class="is-next"' : ""}><span class="when mono">${a.late ? dateFmt(a.at, false) : hhmm(a.at)}</span><span class="grow"><div class="t">${a.href ? `<a href="${esc(a.href)}">${esc(a.title)}</a>` : esc(a.title)}</div><div class="s">${esc(a.sub)}${a.who && !scoped && a.kind === "fu" ? `${a.sub ? " · " : ""}<span class="pill">${esc(a.who)}</span>` : ""}${a.late ? ' · <span class="neg-text">Overdue</span>' : ""}</div></span>
      ${a.kind === "fu" ? `<button class="btn sm" type="button" data-fu="${a.id}">${icon("check")}Done</button>` : a.done ? `<span class="pill pos">${esc(sentence(a.outcome))}</span>` : `<button class="btn sm" type="button" data-trip="${a.id}">Outcome</button>`}</li>`).join("")}</ul>`
    : `<div class="empty">${icon("calendar", "")}<b>Nothing is scheduled</b><p>Test drives and follow-ups with a time show here, in order.</p></div>`;

  const leadsHtml = leads.length ? `<ul class="list">${leads.map((l) => `<li><span class="grow"><div class="t">${esc(l.name)} · ${esc(l.car || "No car named")}</div><div class="s">${esc(chan(l.channel))}${scoped ? "" : " · " + esc(short(l.salesman))} · arrived ${hhmm(l.first_seen_ts)}${l.band && l.band !== "unknown" ? " · " + esc(bandShort(l.band)) : ""}</div></span>${l.status === "new" && l.wait > slaMin ? `<span class="timer" title="Past the ${slaMin} minute target">${duration(l.wait)}</span>` : `<span class="pill ${l.status === "new" ? "warn" : "pos"}">${esc(sentence(l.status))}</span>`}</li>`).join("")}</ul>`
    : `<div class="empty">${icon("check", "")}<b>No new leads waiting</b><p>New leads that nobody has claimed yet show here with a timer.</p></div>`;
  const delHtml = dels.length ? `<ul class="list">${dels.map((d) => `<li><a class="grow" href="#/deals?deal=${d.id}"><div class="t">${esc(d.make)} ${esc(d.model)} · ${esc(d.stock_no)}</div><div class="s">${esc(d.buyer)} · booked ${dateFmt(d.booked_on, false)}</div></a><span class="pill info">${esc(sentence(d.status))}</span></li>`).join("")}</ul>` : `<div class="empty">${icon("check", "")}<b>No deliveries waiting</b></div>`;
  const rtoHtml = rto.length ? `<ul class="list">${rto.slice(0, 8).map((r) => `<li><a class="grow" href="#/rto?case=${r.id}"><div class="t">${esc(r.reg_no || r.stock_no)}</div><div class="s">${esc(sentence(r.stage))}${r.days_open != null ? ` · open ${num(r.days_open)} days` : ""}</div></a>${r.filing_due_in != null ? `<span class="clock ${r.filing_due_in < 0 ? "late" : "soon"}">${icon("clock", "")}${r.filing_due_in < 0 ? Math.abs(r.filing_due_in) + " d late" : r.filing_due_in + " d left"}</span>` : `<span class="pill">${r.days_open > 30 ? "Overdue" : "Open"}</span>`}</li>`).join("")}</ul>` : `<div class="empty">${icon("check", "")}<b>No RTO work due</b></div>`;
  const papersHtml = papers.length ? `<ul class="list">${papers.slice(0, 8).map((p) => `<li><a class="grow" href="#/deals?deal=${p.deal_id}"><div class="t">${esc(p.stock_no)} · ${esc(p.buyer)}</div><div class="s">Missing: ${esc(p.missing.join(", "))}</div></a>${icon("right", "")}</li>`).join("")}</ul>` : `<div class="empty">${icon("check", "")}<b>All papers are in</b></div>`;

  const tiles = `<div class="day-strip">
    <a class="day-tile rise${leads.some((l) => l.wait > slaMin && l.status === "new") ? " hot" : ""}" href="#/leads">${icon("leads", "bg")}<span class="l">New leads</span><span class="n">${num(leads.length)}</span><span class="s">${leads.filter((l) => l.wait > slaMin && l.status === "new").length} past the ${slaMin} min target</span></a>
    <a class="day-tile rise" href="#/today">${icon("car", "bg")}<span class="l">Test drives</span><span class="n">${num(drives.length)}</span><span class="s">${drives.filter((d) => !d.outcome).length} still to go</span></a>
    <a class="day-tile rise${fu.some((f) => f.due_at.slice(0, 10) < state.today) ? " hot" : ""}" href="#/today">${icon("clock", "bg")}<span class="l">Follow-ups</span><span class="n">${num(fu.length)}</span><span class="s">${fu.filter((f) => f.due_at.slice(0, 10) < state.today).length} overdue</span></a>
    <a class="day-tile rise" href="#/deals">${icon("check", "bg")}<span class="l">Deliveries</span><span class="n">${num(dels.length)}</span><span class="s">${num(papers.length)} with papers missing</span></a></div>`;
  return { tiles, leadsHtml, agendaHtml, delHtml, rtoHtml, papersHtml, counts: { leads: leads.length, drives: drives.length, fu: fu.length, dels: dels.length } };
}

export function bindDay(root, refresh) {
  root.addEventListener("click", async (e) => {
    const fu = e.target.closest("[data-fu]");
    if (fu) { await save(fu, () => api.patch(`followups/${fu.dataset.fu}`, { done: true, outcome: "done" }), { ok: "Follow-up marked done" }) && refresh(); return; }
    const tr = e.target.closest("[data-trip]");
    if (tr) {
      openMenu(tr, [{ heading: "How did it go?" }, ...OUTCOMES.map(([v, l]) => ({ label: l, onClick: async () => { await save(null, () => api.patch(`trips/${tr.dataset.trip}`, { outcome: v }), { ok: "Test drive outcome saved" }) && refresh(); } }))], { align: "right" });
    }
  });
}

export async function render(ctx) {
  const [T, alerts] = await Promise.all([get("today"), can("today.view") ? get("alerts").catch(() => []) : []]);
  if (!ctx.alive()) return;
  const scoped = !can("records.all");
  const b = dayBoard(T, { scoped });
  mount(ctx.root, pageHead({ title: "Today", sub: `${esc(dateFmt(state.today))}. ${scoped ? "Your leads, drives, follow-ups and deliveries." : "The whole floor, in the order to do it."}` })
    + b.tiles
    + `<div class="g sec-gap">${card({ title: "Today, in order", sub: "The next item is highlighted.", cls: "c7", body: b.agendaHtml })}${card({ title: "New leads", sub: `Claim within ${state.settings?.lead_sla_minutes || 10} minutes.`, cls: "c5", body: b.leadsHtml })}</div>
    <div class="g">${card({ title: "Deliveries", cls: "h4", body: b.delHtml })}${card({ title: "RTO work", cls: "h4", body: b.rtoHtml })}${card({ title: "Papers to collect", cls: "h4", body: b.papersHtml })}</div>
    ${scoped || !alerts.length ? "" : `<div class="g">${card({ title: "Alerts", sub: `${num(alerts.length)} open`, cls: "c12", body: alertsHtml(alerts) })}</div>`}`);
  bindAlertGroups(ctx.root);
  bindDay(ctx.root, ctx.refresh);
}
