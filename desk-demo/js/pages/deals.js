// Deals: bookings and deliveries. Anyone with deals.view sees them (a salesman only his own); profit shows only with a profit capability.
import * as api from "../api.js";
import { get } from "../api.js";
import { state, can, periodLabel } from "../state.js";
import { badge, dateFmt, debounce, esc, icon, inr, mount, num, sentence, statusBadge } from "../util.js";
import { closeDrawer, confirmDialog, formDrawer, openDrawer, pageHead, toast, save } from "../ui.js";
import { col, cellMain, columnsButton, exportButtons, makeGrid } from "../grid.js";
import { bankField, bankPick, card, kpiTile, roleNote } from "./_shared.js";
import { PAY_MODES, PAY_PURPOSE_IN } from "../lists.js";
import { docsHtml, bindDocs } from "./_docs.js";

const DEAL_DOCS = ["booking_receipt", "invoice", "delivery_note", "sale_letter", "form29", "form30"];
let view = { st: "open", q: "" };

export async function render(ctx) {
  const profitSeen = can("deals.profit.view", "money.view");
  const res = await get("deals", { page_size: 200 });
  if (!ctx.alive()) return;
  const rows = res.data;
  const open = rows.filter((r) => r.status === "booked");
  const del = rows.filter((r) => r.status === "delivered");
  const balance = open.reduce((s, r) => s + (r.balance_due || 0), 0);
  const waitingRto = rows.filter((r) => r.status === "delivered" && r.rto_stage && r.rto_stage !== "closed" && r.rto_stage !== "handed_over").length;
  view = { st: ctx.query.get("status") || "open", q: "" };
  const tiles = [
    kpiTile({ label: "Open bookings", value: open.length, sub: "Booked, not yet delivered" }),
    ...(can("money.view", "accounts.view") ? [kpiTile({ label: "Balance to collect", value: balance, kind: "money", sub: "On open bookings" })] : []),
    kpiTile({ label: "Delivered", value: del.length, sub: `${num(res.total)} deals in all` }),
    kpiTile({ label: "RTO in progress", value: waitingRto, sub: "Delivered, papers not yet handed over" }),
  ].join("");
  mount(ctx.root, pageHead({ title: "Deals", sub: "Bookings and deliveries. Click a row for the whole file: payments, finance, insurance and papers.",
    actions: can("deals.create") ? `<button class="btn primary" type="button" id="book">${icon("plus")}Book a car</button>` : "" })
    + (profitSeen ? "" : roleNote("Profit, costs and the firm-wide balance are hidden for your role. Each booking still shows what the buyer owes."))
    + `<div class="kpis four">${tiles}</div>
    <section class="card flush rise"><div class="card-h"><div><h2>All deals</h2></div><div class="act" id="ga"></div></div>
    <div class="toolbar"><div class="seg" id="st" role="group" aria-label="Status"></div><label class="search"><span class="sr">Search deals</span>${icon("search", "")}<input class="input" id="q" type="search" placeholder="Search car, buyer, salesman"></label></div>
    <div class="grid-wrap"><div id="grid"></div></div></section>`);
  const drawSt = () => { ctx.root.querySelector("#st").innerHTML = [["open", "Open", open.length], ["delivered", "Delivered", del.length], ["cancelled", "Cancelled", rows.filter((r) => r.status === "cancelled").length], ["all", "All", rows.length]].map(([k, l, n]) => `<button type="button" aria-pressed="${view.st === k}" data-st="${k}">${l}<span class="n">${n}</span></button>`).join(""); };
  drawSt();
  const grid = makeGrid(ctx.root.querySelector("#grid"), {
    data: rows, index: "id", initialSort: [{ column: "booked_on", dir: "desc" }], placeholder: "No deals match.",
    columns: [
      col.html("car", "Car", { frozen: true, minWidth: 210, sorter: (a, b) => `${a.make}${a.model}`.localeCompare(`${b.make}${b.model}`), formatter: (c) => { const v = c.getValue(); return cellMain(`${v.make} ${v.model}`, `${v.stock_no} · ${v.variant || ""}`); } }),
      col.date("booked_on", "Booked", { width: 112 }),
      col.html("car_seg", "Segment", { width: 118, formatter: (c) => { const o = c.getData().car.ownership; return badge(o === "invested" ? "Invested" : "Park-N-Sell", o === "invested" ? "ink" : "info"); }, sorter: (a, b, ra, rb) => ra.getData().car.ownership.localeCompare(rb.getData().car.ownership) }),
      col.text("buyer", "Buyer", { minWidth: 150 }), col.text("salesman", "Salesman", { minWidth: 130 }),
      col.money("sale_price", "Sale price", { width: 124 }), col.money("paid", "Paid", { width: 112 }),
      col.money("balance_due", "Balance", { width: 112, formatter: (c) => `<span class="${c.getValue() > 0 ? "warn-text" : ""}">${inr(c.getValue())}</span>` }),
      col.html("status", "Status", { width: 112, formatter: (c) => statusBadge(c.getValue()) }),
      col.html("finance_status", "Finance", { width: 118, formatter: (c) => (c.getValue() ? statusBadge(c.getValue()) : '<span class="faint">None</span>') }),
      col.html("rto_stage", "RTO", { width: 130, formatter: (c) => (c.getValue() ? badge(sentence(c.getValue()), c.getValue() === "closed" ? "pos" : "") : '<span class="faint">—</span>') }),
      ...(profitSeen ? [col.money("gross_profit", "Profit", { width: 118, formatter: (c) => (c.getValue() == null ? '<span class="faint">—</span>' : `<b class="${c.getValue() < 0 ? "neg" : ""}">${inr(c.getValue())}</b>`) })] : []),
    ],
    onRowClick: (r) => openDeal(r.id, ctx),
  });
  ctx.root.querySelector("#ga").append(columnsButton(() => grid), ...(can("exports.ops", "exports.money") ? [exportButtons(() => grid, "classic-auto-deals", "any")] : []));
  const apply = () => {
    const q = view.q.toLowerCase();
    grid.setFilter((r) => (view.st === "open" ? r.status === "booked" : view.st === "all" ? true : r.status === view.st) && (!q || `${r.car.make} ${r.car.model} ${r.car.stock_no} ${r.buyer} ${r.salesman || ""}`.toLowerCase().includes(q)));
  };
  grid.on("tableBuilt", apply);
  ctx.root.addEventListener("click", (e) => { const b = e.target.closest("[data-st]"); if (b) { view.st = b.dataset.st; drawSt(); apply(); } });
  ctx.root.querySelector("#q").addEventListener("input", debounce((e) => { view.q = e.target.value; apply(); }, 150));
  ctx.root.querySelector("#book")?.addEventListener("click", () => bookForm(ctx));
  const want = ctx.query.get("deal"); if (want) openDeal(+want, ctx);
}

// ------------------------------------------------------------------ the deal file
export async function openDeal(id, ctx) {
  const d = openDrawer({ title: "Deal", sub: "Loading…", body: `<div class="skel card"></div>`, wide: true });
  let r;
  try { r = await get(`deals/${id}`); } catch (e) { d.setBody(`<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not open this deal.</b><span class="muted">${esc(e.message)}</span></div></div>`); return; }
  const x = r.deal, pr = r.profit || null, car = x.car || {};
  const reload = () => { d.close(true); openDeal(id, ctx); ctx?.refresh?.(); };
  d.setTitle(`${car.make || ""} ${car.model || ""}`);
  d.setSub(`${esc(car.stock_no || "")} · ${statusBadge(x.status)} · ${esc(x.buyer || "")}`);
  const kv = (l, v) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
  const sec = (t, inner, act = "") => (inner ? `<div class="sec"><div class="sec-h"><h3>${t}</h3>${act ? `<span class="act">${act}</span>` : ""}</div>${inner}</div>` : "");
  const profit = pr ? `${kv("Sale price", inr(pr.sale_price))}${pr.purchase_price != null ? kv("Purchase price", "−" + inr(pr.purchase_price)) : ""}${pr.pns_commission != null ? kv("Commission earned", inr(pr.pns_commission)) : ""}${pr.firm_costs != null ? kv("Firm costs", "−" + inr(pr.firm_costs)) : ""}${pr.gst_on_margin != null ? kv("GST on margin", "−" + inr(pr.gst_on_margin)) : ""}${pr.salesman_incentive != null ? kv("Salesman incentive", "−" + inr(pr.salesman_incentive)) : ""}${kv("Gross profit", `<span class="${pr.gross_profit < 0 ? "neg-text" : "pos-text"}">${inr(pr.gross_profit)}</span>`)}${pr.estimated ? `<p class="note">${icon("info", "")}Estimated until the car is delivered.</p>` : ""}` : "";
  const canPay = can("deals.create") && x.status === "booked" || can("deals.manage");
  const pay = (r.payments || []).length ? `<table class="tbl left"><thead><tr><th>Date</th><th>Purpose</th><th>Mode</th><th>Amount</th></tr></thead><tbody>${r.payments.map((q) => `<tr><td>${dateFmt(q.date, false)}</td><td>${esc(sentence(q.purpose))}${q.direction === "out" ? " (out)" : ""}</td><td>${esc(sentence(q.mode))}</td><td>${q.direction === "out" ? "−" : ""}${inr(q.amount)}</td></tr>`).join("")}</tbody><tfoot><tr><td colspan="3">Balance due</td><td>${inr(x.balance_due)}</td></tr></tfoot></table>` : `<p class="muted">No payments recorded yet.</p>`;
  const fi = [...(r.finance_cases || []).map((f) => `<li><span class="grow"><div class="t">Finance · ${esc(f.lender)}</div><div class="s">${inr(f.loan_amount)} for ${f.tenure_months} months · ${esc(sentence(f.status))}</div></span>${f.payout_expected != null ? `<b>${inr(f.payout_expected)}</b>` : ""}</li>`),
    ...(r.insurance_policies || []).map((f) => `<li><span class="grow"><div class="t">Insurance · ${esc(sentence(f.kind))}</div><div class="s">${esc(f.insurer || "")}${f.expiry_date ? " · till " + dateFmt(f.expiry_date) : ""}</div></span>${f.commission_expected != null ? `<b>${inr(f.commission_expected)}</b>` : ""}</li>`),
    ...(r.addons || []).map((f) => `<li><span class="grow"><div class="t">${esc(sentence(f.kind))}</div></span><b>${inr(f.price_charged)}</b></li>`)];
  const acts = [
    x.status === "booked" && canPay ? `<button class="btn sm" type="button" data-a="pay">${icon("plus")}Record payment</button>` : "",
  ].join("");
  d.setBody(`<dl class="dl dl-3"><div><dt>Sale price</dt><dd class="big">${inr(x.sale_price)}</dd></div><div><dt>Booked</dt><dd>${dateFmt(x.booked_on)}</dd></div><div><dt>Delivered</dt><dd>${dateFmt(x.invoice_date)}</dd></div><div><dt>Salesman</dt><dd>${esc(x.salesman || "—")}</dd></div><div><dt>Invoice</dt><dd>${esc(x.invoice_no || "—")}</dd></div><div><dt>Days to sell</dt><dd>${x.days_to_sell ?? "—"}</dd></div></dl>
    ${x.status === "cancelled" ? `<div class="callout neg sec">${icon("alert", "")}<div><b>Cancelled</b><p>${esc(x.cancel_reason || "")}</p></div></div>` : ""}
    ${sec("Profit", profit)}${sec("Payments", pay, acts)}${fi.length ? sec("Finance, insurance and add-ons", `<ul class="list">${fi.join("")}</ul>`) : ""}
    ${(r.rto_cases || []).length ? sec("RTO", `<ul class="list">${r.rto_cases.map((c) => `<li><a class="grow" href="#/rto?case=${c.id}"><div class="t">${esc(sentence(c.kind))}</div><div class="s">Opened ${dateFmt(c.opened_on)}</div></a>${statusBadge(c.stage)}</li>`).join("")}</ul>`) : ""}
    ${can("documents.view") ? `<div class="sec"><div class="sec-h"><h3>Papers</h3></div><div id="docs"><div class="skel"></div></div></div>` : ""}`);
  if (can("deals.manage") && x.status === "booked") d.setFoot(`<button class="btn danger" type="button" data-a="cancel">Cancel this deal</button><button class="btn pos" type="button" data-a="deliver">${icon("check")}Mark delivered</button>`);
  d.el.addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]"); if (!a) return;
    if (a.dataset.a === "pay") payForm(x, reload);
    if (a.dataset.a === "deliver") deliverForm(x, reload);
    if (a.dataset.a === "cancel") cancelForm(x, reload);
  });
  if (can("documents.view")) {
    try {
      const dd = await get("documents", { entity_type: "deal", entity_id: id });
      const host = d.el.querySelector("#docs"); host.innerHTML = docsHtml(dd.data, DEAL_DOCS);
      bindDocs(host, { entityType: "deal", entityId: id, onDone: reload });
    } catch (e) { const h = d.el.querySelector("#docs"); if (h) h.innerHTML = `<p class="muted">Papers could not load: ${esc(e.message)}</p>`; }
  }
}


async function payForm(x, done) {
  const bank = await bankPick();
  formDrawer({ title: "Record payment", sub: `${esc(x.buyer || "")}. Balance due ${inr(x.balance_due)}.`, submit: "Save payment", ok: "Payment recorded",
    fields: [
      { name: "amount", label: "Amount (₹)", type: "money", required: true },
      { name: "mode", label: "Mode", type: "select", required: true, options: PAY_MODES, value: "upi" },
      { name: "purpose", label: "For", type: "select", options: can("deals.manage") ? PAY_PURPOSE_IN : [["token", "Token"]], value: can("deals.manage") ? "part_payment" : "token" },
      { name: "date", label: "Date", type: "date", value: state.today },
      ...(bankField(bank, "bank_account_id") ? [bankField(bank, "bank_account_id")] : []),
      { name: "reference", label: "Reference or cheque number", type: "text", full: true },
    ],
    onSubmit: async (v) => { const b = v.mode === "cash" || !v.bank_account_id ? null : +v.bank_account_id; delete v.bank_account_id; const r = await api.post(`deals/${x.id}/payments`, { ...v, direction: "in", ...(b ? { bank_account_id: b } : {}) }); if (r.cash_flag || r.over_limit) toast("Cash over the ₹2 L limit was recorded and flagged.", "err"); done(); } });
}
function deliverForm(x, done) {
  formDrawer({ title: "Mark delivered", sub: "This opens the RTO transfer case and schedules a follow-up call.", submit: "Mark delivered", ok: "Delivered. RTO case opened",
    fields: [{ name: "invoice_no", label: "Invoice number", type: "text" }, { name: "invoice_date", label: "Invoice date", type: "date", value: state.today }, { name: "odometer", label: "Odometer at delivery (km)", type: "number", step: 1, min: 0 }],
    onSubmit: async (v) => { await api.post(`deals/${x.id}/deliver`, v); done(); } });
}
function cancelForm(x, done) {
  formDrawer({ title: "Cancel this deal", sub: "The car goes back to available. A refund can be recorded now.", submit: "Cancel the deal", ok: "Deal cancelled", danger: true, cancel: "Keep the deal",
    fields: [{ name: "reason", label: "Reason", type: "textarea", required: true, full: true }, { name: "refund_amount", label: "Refund to the buyer (₹)", type: "money", hint: "Leave empty when nothing is refunded." }, { name: "refund_mode", label: "Refund mode", type: "select", options: PAY_MODES, value: "neft_rtgs" }],
    onSubmit: async (v) => { if (!v.refund_amount) { delete v.refund_amount; delete v.refund_mode; } await api.post(`deals/${x.id}/cancel`, v); done(); } });
}

async function bookForm(ctx) {
  const bank = await bankPick();
  const [cars, ppl, lb] = await Promise.all([get("cars", { page_size: 200, scope: "all" }), can("customers.view") ? get("people", { page_size: 200 }).catch(() => ({ data: [] })) : { data: [] }, can("records.all") && can("team.view") ? get("team/leaderboard", { period: state.period }).catch(() => ({ data: [] })) : { data: [] }]);
  const avail = cars.data.filter((c) => c.status === "available");
  const reps = (lb.data || []).filter((s) => s.role === "salesman");
  const fields = [
    { name: "car_id", label: "Car", type: "select", required: true, full: true, options: avail.map((c) => [c.id, `${c.stock_no} · ${c.make} ${c.model} · ${inr(c.asking_price)}`]) },
    { name: "buyer_person_id", label: "Buyer", type: "select", full: true, allowEmpty: true, options: ppl.data.map((p) => [p.id, p.full_name]), hint: ppl.data.length ? "Pick an existing person, or leave empty and type a new name below." : "" },
    { name: "buyer_name", label: "New buyer's name", type: "text" }, { name: "buyer_phone", label: "New buyer's phone", type: "tel" },
    { name: "sale_price", label: "Agreed sale price (₹)", type: "money", required: true }, { name: "token_amount", label: "Token received (₹)", type: "money" },
    { name: "token_mode", label: "Token paid by", type: "select", options: PAY_MODES, value: "upi" },
    ...(bankField(bank, "token_bank_account_id") ? [{ ...bankField(bank, "token_bank_account_id"), label: "Token landed in" }] : []), { name: "booked_on", label: "Booked on", type: "date", value: state.today },
    ...(reps.length ? [{ name: "salesman_staff_id", label: "Salesman", type: "select", allowEmpty: true, options: reps.map((s) => [s.staff_id, s.name]), full: true }] : []),
  ];
  formDrawer({ title: "Book a car", sub: "Records the buyer, the agreed price and the token.", fields, submit: "Book the car", ok: "Car booked",
    onSubmit: async (v) => {
      const body = { car_id: +v.car_id, sale_price: v.sale_price, token_amount: v.token_amount || 0, token_mode: v.token_mode, booked_on: v.booked_on };
      if (v.token_bank_account_id && v.token_mode !== "cash" && v.token_amount) body.token_bank_account_id = +v.token_bank_account_id;
      if (v.salesman_staff_id) body.salesman_staff_id = +v.salesman_staff_id;
      if (v.buyer_person_id) body.buyer_person_id = +v.buyer_person_id; else if (v.buyer_name) body.buyer = { full_name: v.buyer_name, phone: v.buyer_phone };
      else throw Object.assign(new Error("Pick a buyer or type a new name."), { fields: { buyer_person_id: "Pick a buyer or type a new name." } });
      const r = await api.post("deals", body); ctx.refresh(); return r;
    } });
}
export { closeDrawer };
