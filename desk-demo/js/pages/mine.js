// Salesman home: his own leads, tasks and month. The server scopes every call to him; nothing here asks for more.
import { get } from "../api.js";
import { state, can, periodLabel } from "../state.js";
import { dateFmt, esc, icon, minutes, mount, num, pct, sentence, statusBadge, inr } from "../util.js";
import { pageHead } from "../ui.js";
import { card, kpiTile, delta, pts } from "./_shared.js";
import { dayBoard, bindDay } from "./today.js";
import { firstName, greeting } from "./_brief.js";

const settle = (p) => p.then((v) => v, () => null);

export async function render(ctx) {
  const p = ctx.period;
  const [T, K, deals, leads] = await Promise.all([get("today"), settle(get("kpis", { period: p })), can("deals.view") ? settle(get("deals", { page_size: 50 })) : null, can("leads.view") ? settle(get("leads", { period: p, page_size: 8 })) : null]);
  if (!ctx.alive()) return;
  const kp = K?.kpis || {}, my = T.my_stats || {};
  const b = dayBoard(T, { scoped: true });
  const open = (deals?.data || []).filter((d) => d.status === "booked");
  const tiles = [
    kpiTile({ label: "My inquiries", value: kp.inquiries?.value, delta: kp.inquiries?.delta_pct, sub: `${esc(periodLabel(p))}` }),
    kpiTile({ label: "Answered", value: kp.response_rate?.value, kind: "pct", delta: pts(kp.response_rate?.value, kp.response_rate?.prev), deltaUnit: " pts", sub: kp.response_rate?.median_claim_minutes != null ? `Median ${kp.response_rate.median_claim_minutes} min to claim` : "" }),
    kpiTile({ label: "Missed", value: kp.missed?.value, delta: delta(kp.missed?.value, kp.missed?.prev), invert: true, neg: kp.missed?.value > 0, sub: "Leads nobody claimed in time" }),
    kpiTile({ label: "Cars sold", value: kp.cars_sold?.value, delta: kp.cars_sold?.delta_pct, sub: kp.conversion_pct?.value != null ? `${pct(kp.conversion_pct.value)} of my leads` : "" }),
  ].join("");
  const lead = leads?.data?.length ? `<ul class="list">${leads.data.map((l) => `<li><span class="grow"><div class="t">${esc(l.name)} · ${esc(l.car || "No car named")}</div><div class="s">${esc(dateFmt(l.first_seen_ts, false))} · ${esc(sentence(l.channel))}</div></span>${statusBadge(l.status)}</li>`).join("")}</ul>` : `<div class="empty">${icon("inbox", "")}<b>No leads yet this month</b></div>`;
  const dl = open.length ? `<ul class="list">${open.slice(0, 6).map((d) => `<li><a class="grow" href="#/deals?deal=${d.id}"><div class="t">${esc(d.car.make)} ${esc(d.car.model)} · ${esc(d.buyer)}</div><div class="s">Booked ${dateFmt(d.booked_on, false)}${d.balance_due != null ? " · balance " + inr(d.balance_due) : ""}</div></a>${statusBadge(d.rto_stage || d.status)}</li>`).join("")}</ul>` : `<div class="empty">${icon("tag", "")}<b>No open bookings</b></div>`;
  mount(ctx.root, pageHead({ title: "My day", sub: `${esc(greeting())}, ${esc(firstName())}. ${esc(dateFmt(state.today))}. Only your own leads and deals are shown.` })
    + b.tiles
    + `<div class="g sec-gap">${card({ title: "Today, in order", sub: "Your next item is highlighted.", cls: "c7", body: b.agendaHtml })}${card({ title: "Leads for me", sub: `Claim within ${state.settings?.lead_sla_minutes || 10} minutes.`, cls: "c5", body: b.leadsHtml })}</div>
    <div class="kpis four sec-gap">${tiles}</div>
    <div class="g sec-gap">${card({ title: "My open bookings", cls: "c6", body: dl })}${card({ title: "My recent leads", sub: esc(periodLabel(p)), cls: "c6", body: lead })}</div>
    <div class="g">${card({ title: "Papers to collect", cls: "h4", body: b.papersHtml })}${card({ title: "RTO on my deals", cls: "h4", body: b.rtoHtml })}${card({ title: "Deliveries", cls: "h4", body: b.delHtml })}</div>`);
  bindDay(ctx.root, ctx.refresh);
}
