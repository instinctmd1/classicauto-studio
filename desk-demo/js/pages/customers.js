// Customers: CRM, returning customers, cross-sell gaps, upgrade-due list, DPDP requests.
import * as api from "../api.js";
import { get } from "../api.js";
import { state, periodLabel, can } from "../state.js";
import { badge, dateFmt, debounce, esc, icon, inr, lakh, mount, num, pct, sentence, statusBadge } from "../util.js";
import { confirmDialog, formHtml, openDrawer, pageHead, readForm, save, showErrors, toast } from "../ui.js";
import { col, cellMain, columnsButton, exportButtons, makeGrid } from "../grid.js";
import { card, kpiTile } from "./_shared.js";
import { openDeal } from "./deals.js";

const ATTACH = [["finance", "Finance through us"], ["insurance", "Insurance through us"], ["extended_warranty", "Extended warranty"], ["accessories", "Accessories"], ["detailing", "Detailing"], ["rc_transfer_service", "RC transfer service"], ["exchange", "Exchange (trade-in)"]];
const GAP = { rsa: "RSA", extended_warranty: "Warranty", insurance: "Insurance", accessories: "Accessories", detailing: "Detailing", finance: "Finance", rc_transfer_service: "RC transfer", exchange: "Exchange" };

export async function render(ctx) {
  const p = ctx.period, owner = can("customers.pii"), money = can("money.view"), manage = can("customers.manage");
  // The analytics endpoints need customers.manage; a salesman gets the people register only.
  const none = Promise.resolve({ data: [], total: 0 });
  const [sum, ret, cross, upg, ppl, dpdp] = await Promise.all([
    manage ? get("customers/summary", { period: p }) : Promise.resolve({}), manage ? get("customers/returning") : none, manage ? get("customers/cross-sell") : none, manage ? get("customers/upgrade-due") : none,
    get("people", { page_size: 200 }), owner ? get("dpdp-requests") : Promise.resolve({ data: [] }),
  ]);
  if (!ctx.alive()) return;
  const tiles = [
    kpiTile({ label: "Buyers", value: sum.buyers, sub: `${esc(periodLabel(p))} deliveries` }),
    kpiTile({ label: "Returning buyers", value: sum.returning_pct, kind: "pct", sub: `${num(sum.returning)} came back to us` }),
    kpiTile({ label: "Repeat purchase", value: sum.repeat_purchase_pct, kind: "pct", sub: "Customers with 2 or more cars" }),
    kpiTile({ label: "Finance and insurance", value: sum.fi_per_car, kind: "money", sub: "Income per car delivered" }),
    kpiTile({ label: "Upgrade due", value: sum.upgrade_due, sub: "Bought 3 or more years ago. Offer buy-back" }),
    kpiTile({ label: "Referrals", value: sum.referrals, sub: "New customers sent by customers" }),
  ].join("");
  const attach = ATTACH.map(([k, l]) => { const v = sum.attach_pct?.[k]; return `<div class="hb"><span class="name">${l}</span><span class="meter"><i data-w="${v || 0}" data-c="var(--navy-bright)"></i></span><span class="val">${v == null ? "—" : pct(v, 0)}</span></div>`; }).join("");
  const retRows = ret.data;
  const crossRows = cross.data;

  mount(ctx.root, pageHead({ title: "Customers", sub: "Everyone the firm has bought from, sold to or parked a car for. Personal data stays on the server.", actions: manage ? `<button class="btn" type="button" id="new-person">${icon("plus")}Add person</button>` : "" })
    + (manage ? `<div class="kpis six">${tiles}</div>
    <div class="g">${card({ title: "Attach rates", sub: `Share of ${esc(periodLabel(p))} deliveries that also bought each extra`, cls: "c5", body: attach })}
    ${card({ title: "Cross-sell chances", sub: "Recent buyers who have not taken these yet. Call them.", cls: "c7", flush: true, body: crossList(crossRows) })}</div>` : "")
    + `<section class="card flush rise"><div class="tabs" role="tablist" id="tabs"><button role="tab" aria-selected="true" data-t="ppl">All people <span class="n faint">${ppl.total}</span></button>${manage ? `<button role="tab" aria-selected="false" data-t="ret">Returning <span class="n faint">${ret.total}</span></button><button role="tab" aria-selected="false" data-t="upg">Upgrade due <span class="n faint">${upg.total}</span></button>` : ""}${owner ? `<button role="tab" aria-selected="false" data-t="dp">DPDP requests <span class="n faint">${dpdp.data.length}</span></button>` : ""}</div>
    <div class="toolbar"><label class="search"><span class="sr">Search people</span>${icon("search", "")}<input class="input" id="q" type="search" placeholder="Search name, city or email"></label><span class="grow"></span><span id="ga"></span></div>
    <div class="grid-wrap"><div id="grid"></div></div><div id="dp" hidden></div></section>`);

  let grid, tab = "ppl";
  const person = (c) => { const r = c.getData(); return cellMain(r.full_name, [r.city, r.email].filter(Boolean).join(" · ")); };
  const defs = {
    ppl: { data: ppl.data, cols: [
      col.html("full_name", "Name", { minWidth: 240, frozen: true, formatter: person, sorter: "string" }),
      col.html("returning", "Status", { width: 130, formatter: (c) => (c.getValue() ? badge("Returning", "pos") : badge("New", "")) }),
      col.text("phone", "Phone", { width: 150, formatter: (c) => esc(c.getValue() || "—") }),
      col.text("pan_masked", "PAN", { width: 130, formatter: (c) => esc(c.getValue() || "—") }),
      col.html("marketing_consent", "Marketing OK", { width: 130, formatter: (c) => (c.getValue() ? badge("Consented", "pos") : badge("No consent", "")) }),
      col.date("created_at", "Added", { width: 120 })] },
    ret: { data: retRows, cols: [
      col.html("full_name", "Name", { minWidth: 240, frozen: true, formatter: (c) => esc(c.getValue()) }),
      col.int("relationships", "Ways we know them", { width: 170 }), col.int("deals", "Cars bought", { width: 130 }),
      ...(money ? [col.money("clv", "Lifetime profit", { width: 150 })] : [])] },
    upg: { data: upg.data, cols: [
      col.html("full_name", "Name", { minWidth: 240, frozen: true, formatter: (c) => esc(c.getValue() || "—") }),
      col.text("car", "Last car", { minWidth: 200 }), col.date("invoice_date", "Bought", { width: 130 })] },
  };
  const mk = (t) => {
    const d = defs[t];
    grid?.destroy();
    grid = makeGrid(ctx.root.querySelector("#grid"), { data: d.data, columns: d.cols, placeholder: "Nobody here yet.", index: "id",
      // a person's full history (every deal, CLV) needs customers.manage: a salesman lists his own customers, nothing more
      ...(can("customers.manage") ? { onRowClick: (r) => openPerson(r.id || r.person_id, ctx) } : {}) });
  };
  mk("ppl");
  ctx.root.querySelector("#ga").replaceWith(columnsButton(() => grid), ...(can("exports.pii") ? [exportButtons(() => grid, "classic-auto-people", "people")] : []));
  ctx.root.querySelector("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-t]"); if (!b) return; tab = b.dataset.t;
    ctx.root.querySelectorAll("#tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    const dp = tab === "dp";
    ctx.root.querySelector("#grid").parentElement.hidden = dp; ctx.root.querySelector("#dp").hidden = !dp; ctx.root.querySelector(".toolbar").hidden = dp;
    if (dp) renderDpdp(ctx.root.querySelector("#dp"), dpdp.data, ctx);
    else mk(tab);
  });
  ctx.root.querySelector("#q").addEventListener("input", debounce((e) => {
    const q = e.target.value.toLowerCase();
    grid.setFilter((r) => !q || `${r.full_name || ""} ${r.city || ""} ${r.email || ""}`.toLowerCase().includes(q));
  }, 150));
  ctx.root.querySelector("#new-person")?.addEventListener("click", () => personForm(ctx));
  if (can("customers.manage")) ctx.root.addEventListener("click", (e) => { const c = e.target.closest("[data-person]"); if (c) openPerson(+c.dataset.person, ctx); });
}

function crossList(rows) {
  if (!rows.length) return `<div class="empty">${icon("check", "")}<b>Every recent buyer has the extras</b></div>`;
  return `<ul class="list scroll-list">${rows.slice(0, 12).map((r) => `<li><button type="button" class="grow plain" data-person="${r.person_id}"><div class="t">${esc(r.full_name)}</div><div class="s">${esc(r.car)} · delivered ${dateFmt(r.invoice_date)}</div></button><span class="chips">${r.missing.slice(0, 4).map((m) => badge(GAP[m] || sentence(m), "warn")).join("")}</span></li>`).join("")}</ul>`;
}

async function openPerson(id, ctx) {
  const d = openDrawer({ title: "Person", sub: "Loading…", body: `<div class="skel card"></div>`, wide: true });
  let r;
  try { r = await get(`people/${id}/history`); } catch (e) { d.setBody(`<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not open this person.</b><span class="muted">${esc(e.message)}</span></div></div>`); return; }
  const P = r.person, owner = can("customers.pii");
  d.setTitle(P.full_name); d.setSub(`${r.returning ? badge("Returning customer", "pos") : badge("New customer")} ${P.city ? esc(P.city) : ""}`);
  const kv = (l, v) => `<div><dt>${l}</dt><dd>${v == null || v === "" ? "—" : v}</dd></div>`;
  const sec = (t, inner) => (inner ? `<div class="sec"><div class="sec-h"><h3>${t}</h3></div>${inner}</div>` : "");
  const list = (items) => `<ul class="list">${items.join("")}</ul>`;
  d.setBody(`<dl class="dl dl-3">${kv("Phone", esc(P.phone))}${kv("Email", esc(P.email))}${kv("City", esc(P.city))}${kv("PAN", `<span id="pan">${esc(P.pan_masked || "—")}</span>${owner && P.has_pan ? ` <button class="btn sm" type="button" id="reveal">${icon("eye")}Reveal</button>` : ""}`)}${kv("Aadhaar", P.aadhaar_last4 ? "XXXX XXXX " + esc(P.aadhaar_last4) : "—")}${kv("Marketing consent", P.marketing_consent ? "Yes" : "No")}${owner ? kv("Lifetime profit", `<span class="big">${inr(r.clv)}</span>`) : ""}</dl>
    ${sec("Cars bought", r.deals.length ? list(r.deals.map((x) => `<li><button class="grow plain" type="button" data-deal="${x.id}"><div class="t">${esc(x.make)} ${esc(x.model)} · ${esc(x.stock_no)}</div><div class="s">${dateFmt(x.invoice_date || x.booked_on)} · ${inr(x.sale_price)}</div></button>${statusBadge(x.status)}${owner && x.gross_profit != null ? `<b>${inr(x.gross_profit)}</b>` : ""}</li>`)) : "")}
    ${sec("Cars they sold us", r.cars_sold_to_us.length ? list(r.cars_sold_to_us.map((x) => `<li><a class="grow" href="#/inventory?car=${x.id}"><div class="t">${esc(x.make)} ${esc(x.model)} · ${esc(x.stock_no)}</div><div class="s">${dateFmt(x.acquired_on)}</div></a>${owner ? `<span class="muted">${inr(x.purchase_price)}</span>` : ""}</li>`)) : "")}
    ${sec("Feedback", r.feedback.length ? list(r.feedback.map((x) => `<li><span class="grow"><div class="t">${esc(x.text || sentence(x.source))}</div><div class="s">${dateFmt(x.ts, false)}${x.rating ? " · " + x.rating + " of 5" : ""}</div></span>${badge(sentence(x.sentiment), x.sentiment === "good" ? "pos" : x.sentiment === "bad" ? "neg" : "")}</li>`)) : "")}`);
  d.el.querySelector("[data-deal]")?.closest(".list").addEventListener("click", (e) => { const b = e.target.closest("[data-deal]"); if (b) { d.close(true); openDeal(+b.dataset.deal); } });
  d.el.querySelector("#reveal")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    if (!(await confirmDialog({ title: "Reveal this PAN?", text: "The reveal is written to the audit log with your name.", confirmLabel: "Reveal" }))) return;
    const out = await save(btn, () => api.post(`people/${id}/reveal-pan`), { ok: "" });
    if (out?.pan) { d.el.querySelector("#pan").textContent = out.pan; btn.remove(); setTimeout(() => { const n = d.el.querySelector("#pan"); if (n) n.textContent = P.pan_masked; }, 20000); }
  });
  if (owner) d.setFoot(`<button class="btn" type="button" id="dpdp">${icon("shield")}Log a DPDP request</button>`), d.el.querySelector("#dpdp").addEventListener("click", () => dpdpForm(id, P.full_name, ctx));
}

function personForm(ctx) {
  const fields = [{ name: "full_name", label: "Full name", type: "text", required: true, full: true }, { name: "phone", label: "Phone", type: "tel" }, { name: "email", label: "Email", type: "email" }, { name: "city", label: "City", type: "text" }, { name: "marketing_consent", label: "They agreed to marketing messages", type: "checkbox", full: true }];
  const d = openDrawer({ title: "Add a person", body: `<form id="pf" novalidate>${formHtml(fields)}</form>`, foot: `<button class="btn" type="button" data-x>Cancel</button><button class="btn primary" type="submit" form="pf">Add person</button>` });
  d.el.querySelector("[data-x]").addEventListener("click", () => d.close());
  d.el.querySelector("#pf").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.currentTarget; showErrors(f, null);
    const r = await save(d.el.querySelector('button[type="submit"]'), async () => { try { return await api.post("people", readForm(f, fields)); } catch (ex) { if (ex.code !== "demo") showErrors(f, ex); throw ex; } }, { ok: "Person added" });
    if (r) { d.close(); ctx.refresh(); }
  });
}
function dpdpForm(id, name, ctx) {
  const fields = [{ name: "kind", label: "Request type", type: "select", required: true, full: true, options: [["access", "Access to their data"], ["correction", "Correction"], ["erasure", "Erasure"], ["grievance", "Grievance"], ["consent_withdrawal", "Consent withdrawal"]] }, { name: "note", label: "Note", type: "textarea", full: true }];
  const d = openDrawer({ title: "Log a DPDP request", sub: esc(name), body: `<form id="df" novalidate>${formHtml(fields)}</form>`, foot: `<button class="btn" type="button" data-x>Cancel</button><button class="btn primary" type="submit" form="df">Log request</button>` });
  d.el.querySelector("[data-x]").addEventListener("click", () => d.close());
  d.el.querySelector("#df").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.currentTarget; showErrors(f, null);
    const r = await save(d.el.querySelector('button[type="submit"]'), async () => { try { return await api.post(`people/${id}/dpdp-requests`, readForm(f, fields)); } catch (ex) { if (ex.code !== "demo") showErrors(f, ex); throw ex; } }, { ok: "Request logged" });
    if (r) { d.close(); ctx.refresh(); }
  });
}
function renderDpdp(host, list, ctx) {
  host.innerHTML = list.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Received</th><th>Type</th><th>Status</th><th>Due</th><th>Note</th></tr></thead><tbody>${list.map((x) => `<tr><td>${dateFmt(x.received_at || x.created_at)}</td><td>${esc(sentence(x.kind))}</td><td>${statusBadge(x.status || "open")}</td><td>${dateFmt(x.due_at)}</td><td>${esc(x.note || "")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${icon("shield", "")}<b>No data requests logged</b><p>Access, correction, erasure and grievance requests from customers are tracked here, with the DPDP deadline.</p></div>`;
}
