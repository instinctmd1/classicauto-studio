// Inventory: every car in one spreadsheet-style grid, split by Invested and Park-N-Sell, plus the car file drawer.
import * as api from "../api.js";
import { get } from "../api.js";
import { state, can, bandLabel } from "../state.js";
import { agingBucketOf, agingColor, badge, dateFmt, debounce, esc, icon, inr, lakh, mount, num, pct, sentence, statusBadge, title } from "../util.js";
import { PAY_MODES, modeLabel } from "../lists.js";
import { confirmDialog, formHtml, openDrawer, pageHead, readForm, save, showErrors, toast } from "../ui.js";
import { col, cellMain, columnsButton, exportButtons, makeGrid } from "../grid.js";
import { bindDocs, docsHtml, EXPECTED } from "./_docs.js";
import { bankField, bankPick, commissionText, kpiTile, roleNote } from "./_shared.js";

const FUEL = ["petrol", "diesel", "cng", "petrol_cng", "hybrid", "electric", "other"];
const LOC = ["showroom", "yard", "workshop", "with_customer", "with_owner"];
const SOURCE = ["walk_in_seller", "exchange", "dealer_trade", "auction", "broker", "consignment", "other"];
const COST_CAT = ["mechanical", "denting_painting", "detailing", "tyres", "battery", "parts", "electrical", "inspection", "rto_fees", "insurance", "transport", "parking", "challan", "photography", "other"];
const PAY = ["cash", "upi", "neft_rtgs", "cheque", "card", "credit"];
const opt = (a) => a.map((x) => [x, sentence(x)]);

let view = { seg: "all", state: "stock", q: "", aged: "", band: "" };
let table = null, rows = [], ctxRef = null;

export async function render(ctx) {
  ctxRef = ctx;
  const [res, aging] = await Promise.all([get("cars", { page_size: 200, scope: "all" }), get("cars/aging")]);
  if (!ctx.alive()) return;
  rows = res.data;
  const seg = ctx.query.get("seg");
  view = { seg: seg === "park_n_sell" || seg === "invested" ? seg : "all", state: "stock", q: "", aged: ctx.query.get("aged_gt") ? "60" : "", band: ctx.query.get("band") || "" };
  if (ctx.query.get("status") === "refurb") view.state = "stock";
  const owner = can("money.view"), edit = can("stock.manage");
  const stock = rows.filter((r) => ["incoming", "refurb", "available", "booked"].includes(r.status));
  const inv = stock.filter((r) => r.ownership === "invested"), pns = stock.filter((r) => r.ownership === "park_n_sell");
  const avgAsk = stock.length ? stock.reduce((s, r) => s + (r.asking_price || 0), 0) / stock.length : null;
  const tiles = [
    kpiTile({ label: "Cars on the lot", value: stock.length, sub: `${inv.length} invested · ${pns.length} Park-N-Sell · ${stock.filter((r) => r.status === "booked").length} booked` }),
    owner ? kpiTile({ label: "Capital locked", value: aging.capital_locked, kind: "money", sub: "Purchase plus costs, invested cars" }) : kpiTile({ label: "Available to sell", value: stock.filter((r) => r.status === "available").length, sub: "Ready on the floor" }),
    kpiTile({ label: `Older than ${aging.aged_threshold_days} days`, value: aging.aged_pct, kind: "pct", sub: "Target: under 15% of stock", neg: aging.aged_pct > 15 }),
    kpiTile({ label: "Average asking price", value: avgAsk, kind: "money", sub: "Across cars in stock" }),
  ].join("");

  mount(ctx.root, pageHead({ title: "Stock", sub: "Every car the firm holds or sells on commission. Click a row for the car file; edit price and location right in the grid.",
    actions: edit ? `<button class="btn primary" type="button" id="add-car">${icon("plus")}Add car</button>` : "" })
    + (can("money.view") ? "" : roleNote("Purchase price, costs and profit are hidden for your role. Asking prices are shown."))
    + `<div class="kpis four">${tiles}</div>
    <section class="card flush rise"><div class="card-h"><div><h2>All cars</h2></div><div class="act" id="grid-act"></div></div>
      <div class="toolbar"><div class="seg" role="tablist" aria-label="Segment" id="seg"></div><div class="seg" aria-label="Show" id="state"></div>
        <label class="search"><span class="sr">Search cars</span>${icon("search", "")}<input class="input" id="q" type="search" placeholder="Search make, model, reg no, stock no"></label>
        <select class="select" id="aged" aria-label="Aging"><option value="">Any age</option><option value="30">Over 30 days</option><option value="60">Over 60 days</option><option value="90">Over 90 days</option></select>
        <select class="select" id="band" aria-label="Segment by price"><option value="">All price bands</option><option value="low">${esc(bandLabel("low"))}</option><option value="middle">${esc(bandLabel("middle"))}</option><option value="luxury">${esc(bandLabel("luxury"))}</option></select></div>
      <div class="grid-wrap"><div id="grid"></div></div></section>`);

  const inState = (r) => view.state === "all" || (view.state === "sold" ? r.status === "delivered" : ["incoming", "refurb", "available", "booked"].includes(r.status));
  const counts = () => { const b = rows.filter(inState); return { all: b.length, invested: b.filter((r) => r.ownership === "invested").length, park_n_sell: b.filter((r) => r.ownership === "park_n_sell").length }; };
  const drawSeg = () => {
    const c = counts();
    ctx.root.querySelector("#seg").innerHTML = [["all", "All"], ["invested", "Invested"], ["park_n_sell", "Park-N-Sell"]].map(([k, l]) => `<button type="button" role="tab" aria-selected="${view.seg === k}" data-seg="${k}">${l}<span class="n">${c[k]}</span></button>`).join("");
    ctx.root.querySelector("#state").innerHTML = [["stock", "In stock"], ["sold", "Sold"], ["all", "Everything"]].map(([k, l]) => `<button type="button" aria-pressed="${view.state === k}" data-state="${k}">${l}</button>`).join("");
  };
  drawSeg();
  ctx.root.querySelector("#aged").value = view.aged; ctx.root.querySelector("#band").value = view.band;

  const aging30 = (d) => `<span class="aging"><i data-c="${agingColor(agingBucketOf(d))}"></i>${num(d)} d</span>`;
  const cols = [
    col.html("make", "Car", { frozen: true, minWidth: 210, formatter: (c) => { const r = c.getData(); return cellMain(`${r.make} ${r.model}`, `${r.stock_no} · ${r.variant || ""}`); }, sorter: "string" }),
    col.html("ownership", "Segment", { width: 118, formatter: (c) => badge(c.getValue() === "invested" ? "Invested" : "Park-N-Sell", c.getValue() === "invested" ? "ink" : "info") }),
    col.html("status", "Status", { width: 112, formatter: (c) => statusBadge(c.getValue()) }),
    col.html("days_in_stock", "In stock", { width: 104, sorter: "number", formatter: (c) => { const h = document.createElement("span"); h.innerHTML = aging30(c.getValue() ?? 0); const el = h.firstElementChild; el.querySelector("i").style.setProperty("--c", agingColor(agingBucketOf(c.getValue() ?? 0))); return el; } }),
    col.int("mfg_year", "Year", { width: 82, hozAlign: "left", headerHozAlign: "left", formatter: (c) => c.getValue() ?? "—" }),
    col.int("kms_at_intake", "KMs", { width: 96 }),
    col.html("fuel", "Fuel / gearbox", { width: 140, formatter: (c) => { const r = c.getData(); return `${esc(title(r.fuel || ""))} · ${esc(r.transmission === "automatic" ? "Auto" : r.transmission === "manual" ? "Manual" : "—")}`; } }),
    col.text("location", "Location", { width: 130, editor: edit ? "list" : false, editorParams: { values: Object.fromEntries(LOC.map((l) => [l, sentence(l)])) }, formatter: (c) => esc(sentence(c.getValue() || "—")) }),
    col.money("asking_price", "Asking", { width: 124, editor: edit ? "number" : false, editorParams: { min: 1, step: 1000, selectContents: true } }),
    ...(owner ? [
      col.money("purchase_price", "Purchase", { width: 124, formatter: (c) => (c.getValue() == null ? '<span class="faint">—</span>' : inr(c.getValue())) }),
      col.money("total_cost", "Total cost", { width: 124, formatter: (c) => (c.getValue() == null ? '<span class="faint">—</span>' : inr(c.getValue())) }),
      col.money("expected_margin", "Exp. margin", { width: 124, formatter: (c) => { const v = c.getValue(); return v == null ? '<span class="faint">—</span>' : `<span class="${v < 0 ? "neg" : ""}">${inr(v)}</span>`; } }),
      col.money("holding_cost", "Holding cost", { width: 124, formatter: (c) => (c.getValue() == null ? '<span class="faint">—</span>' : inr(c.getValue())) }),
    ] : []),
    col.html("papers_pct", "Papers", { width: 130, sorter: "number", formatter: (c) => { const v = c.getValue() ?? 0; const d = document.createElement("div"); d.className = "pbar"; d.innerHTML = `<span class="meter"><i></i></span><b>${v}%</b>`; d.querySelector("i").style.setProperty("--w", v + "%"); d.querySelector("i").style.setProperty("--c", v >= 90 ? "var(--pos)" : v >= 60 ? "var(--warn)" : "var(--neg)"); return d; } }),
  ];
  table = makeGrid(ctx.root.querySelector("#grid"), {
    data: rows, columns: cols, initialSort: [{ column: "days_in_stock", dir: "desc" }], placeholder: "No cars match these filters.", index: "id",
    onRowClick: (r) => openCar(r.id, ctx, reload),
  });
  const act = ctx.root.querySelector("#grid-act");
  act.append(columnsButton(() => table), ...(can("exports.ops") ? [exportButtons(() => table, "classic-auto-inventory", "ops")] : []));

  const apply = () => {
    const q = view.q.toLowerCase();
    table.setFilter((r) => {
      if (view.seg !== "all" && r.ownership !== view.seg) return false;
      const inStock = ["incoming", "refurb", "available", "booked"].includes(r.status);
      if (view.state === "stock" && !inStock) return false;
      if (view.state === "sold" && r.status !== "delivered") return false;
      if (view.aged && (r.days_in_stock ?? 0) <= +view.aged) return false;
      if (view.band && r.band !== view.band) return false;
      if (q && !`${r.make} ${r.model} ${r.variant || ""} ${r.reg_no || ""} ${r.stock_no}`.toLowerCase().includes(q)) return false;
      return true;
    });
  };
  table.on("tableBuilt", apply);
  ctx.root.addEventListener("click", (e) => {
    const s = e.target.closest("[data-seg]"), st = e.target.closest("[data-state]");
    if (s) { view.seg = s.dataset.seg; drawSeg(); apply(); }
    if (st) { view.state = st.dataset.state; drawSeg(); apply(); }
  });
  ctx.root.querySelector("#q").addEventListener("input", debounce((e) => { view.q = e.target.value; apply(); }, 150));
  ctx.root.querySelector("#aged").addEventListener("change", (e) => { view.aged = e.target.value; apply(); });
  ctx.root.querySelector("#band").addEventListener("change", (e) => { view.band = e.target.value; apply(); });
  ctx.root.querySelector("#add-car")?.addEventListener("click", () => carForm(null, ctx, reload));

  // inline edits
  table.on("cellEdited", async (cell) => {
    const r = cell.getData(), f = cell.getField(), old = cell.getOldValue(), v = cell.getValue();
    if (v === old) return;
    try {
      if (f === "asking_price") { await api.post(`cars/${r.id}/price`, { new_price: Math.round(+v), reason: "Edited in grid" }); toast("Asking price updated", "ok"); }
      else { const upd = await api.patch(`cars/${r.id}`, { [f]: v, version: r.version }); cell.getRow().update({ version: upd.version }); toast("Saved", "ok"); }
    } catch (e) { cell.restoreOldValue(); if (e.code !== "demo") toast(e.message, "err"); }
  });
  const want = ctx.query.get("car");
  if (want) openCar(+want, ctx, reload);
  function reload() { ctx.refresh(); }
}

// ------------------------------------------------------------------ car file
export async function openCar(id, ctx, reload) {
  const d = openDrawer({ title: "Car file", sub: "Loading…", body: `<div class="skel card"></div>`, wide: true, onClose: () => { if (ctx?.query?.get("car")) history.replaceState(null, "", location.hash.replace(/[?&]car=\d+/, "")); } });
  let data;
  try { data = await get(`cars/${id}`); } catch (e) { d.setBody(`<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not open this car.</b><span class="muted">${esc(e.message)}</span></div></div>`); return; }
  const c = data.car, owner = can("money.view"), edit = can("stock.manage");
  const pns = c.ownership === "park_n_sell";
  d.setTitle(`${c.make} ${c.model}`);
  d.setSub(`${esc(c.stock_no)} · ${esc(c.variant || "")} · ${statusBadge(c.status)} ${badge(pns ? "Park-N-Sell" : "Invested", pns ? "info" : "ink")}`);
  const kv = (l, v) => `<div><dt>${l}</dt><dd>${v == null || v === "" ? "—" : v}</dd></div>`;
  const price = `<dl class="dl dl-3">${kv("Asking", `<span class="big">${inr(c.asking_price)}</span>`)}${can("stock.manage") ? kv("Floor", inr(c.floor_price)) : ""}${owner && !pns ? kv("Purchase", inr(c.purchase_price)) : ""}${owner && !pns ? kv("Firm costs", inr(c.firm_costs)) : ""}${owner && !pns ? kv("Expected margin", `<span class="${(c.expected_margin ?? 0) < 0 ? "neg" : ""}">${inr(c.expected_margin)}</span>`) : ""}${owner && !pns ? kv("Holding cost", inr(c.holding_cost)) : ""}${kv("Days in stock", `${aging(c)}`)}</dl>`;
  const spec = `<dl class="dl dl-3">${kv("Year", c.mfg_year)}${kv("Registered", c.reg_year)}${kv("Reg no", esc(c.reg_no))}${kv("Fuel", esc(title(c.fuel || "")))}${kv("Gearbox", esc(sentence(c.transmission || "")))}${kv("KMs", num(c.kms_at_intake))}${kv("Owner no.", c.owner_serial)}${kv("Colour", esc(c.colour))}${kv("Location", esc(sentence(c.location || "")))}${kv("Insurance till", dateFmt(c.insurance_expiry))}${kv("PUC till", dateFmt(c.puc_expiry))}${kv("Form 29C", c.form29c_filed_on ? dateFmt(c.form29c_filed_on) : '<span class="badge warn">Not filed</span>')}${kv("Hypothecated", c.hypothecated_to ? esc(c.hypothecated_to) + (c.hypothecation_cleared_on ? " (cleared)" : "") : "No")}${kv("Acquired", dateFmt(c.acquired_on))}${kv("Band", esc(bandLabel(c.band)))}</dl>`;
  const cons = data.consignment ? `<dl class="dl dl-3">${kv("Reserve", inr(data.consignment.reserve_price))}${kv("Agreement", dateFmt(data.consignment.agreement_date))}${kv("Expires", dateFmt(data.consignment.agreement_expiry))}${kv("Commission", commissionText(data.consignment))}${kv("RC held", data.consignment.original_rc_held ? "Yes" : "No")}${kv("Keys held", data.consignment.keys_held ? "Yes" : "No")}</dl>` : "";
  const costs = data.costs ? `<table class="tbl"><thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Paid by</th><th>Amount</th></tr></thead><tbody>${data.costs.map((k) => `<tr><td>${dateFmt(k.date, false)}</td><td>${esc(sentence(k.category))}${k.recover_from_consignor ? ' <span class="badge info">Owner pays</span>' : ""}</td><td>${esc(k.vendor || "—")}</td><td>${k.payment_mode === "credit" ? "On credit" : k.payment_mode ? esc(modeLabel(k.payment_mode)) : "—"}</td><td>${inr(k.amount)}</td></tr>`).join("")}${c.broker_fee > 0 ? `<tr><td>${dateFmt(c.acquired_on, false)}</td><td>Broker fee</td><td>—</td><td>${data.purchase_payment ? esc(modeLabel(data.purchase_payment.mode)) : "—"}</td><td>${inr(c.broker_fee)}</td></tr>` : ""}</tbody><tfoot><tr><td colspan="4">Firm cost</td><td>${inr(c.firm_costs)}</td></tr></tfoot></table>` : "";
  const refurb = (data.refurb_jobs || []).length ? `<ul class="list">${data.refurb_jobs.map((j) => `<li><span class="grow"><div class="t">${esc(sentence(j.job_type))}</div><div class="s">${esc(j.workshop || "Workshop not set")} · sent ${dateFmt(j.sent_on, false)} · promised ${dateFmt(j.promised_on, false)}${j.returned_on ? " · back " + dateFmt(j.returned_on, false) : ""}</div></span>${j.estimate ? `<span class="muted">${inr(j.estimate)}</span>` : ""}${statusBadge(j.status)}</li>`).join("")}</ul>` : `<p class="muted">No workshop jobs yet.</p>`;
  const timeline = `<ol class="timeline">${[...data.status_history].reverse().map((s) => `<li><span class="when">${dateFmt(s.ts)}</span>${s.from_status ? `${esc(sentence(s.from_status))} → ` : ""}<b>${esc(sentence(s.to_status))}</b>${s.note ? ` <span class="muted">· ${esc(s.note)}</span>` : ""}</li>`).join("")}</ol>`;
  const prices = data.price_history.length ? `<ol class="timeline">${[...data.price_history].reverse().map((s) => `<li><span class="when">${dateFmt(s.ts)}${s.reason ? " · " + esc(s.reason) : ""}</span>${s.old_price ? `${inr(s.old_price)} → ` : ""}<b>${inr(s.new_price)}</b></li>`).join("")}</ol>` : "";
  const deals = data.deals.length ? `<ul class="list">${data.deals.map((x) => `<li><a class="grow" href="#/deals?deal=${x.id}"><div class="t">${esc(x.buyer || "Buyer")}</div><div class="s">${dateFmt(x.invoice_date || x.booked_on)} · ${inr(x.sale_price)}</div></a>${statusBadge(x.status)}</li>`).join("")}</ul>` : "";
  const sec = (t, inner, act = "") => (inner ? `<div class="sec"><div class="sec-h"><h3>${t}</h3>${act ? `<span class="act">${act}</span>` : ""}</div>${inner}</div>` : "");
  d.setBody(`${sec("Price", price, edit ? `<button class="btn sm" type="button" data-act="price">${icon("tag")}Change price</button>` : "")}${sec("Details", spec)}${sec("Consignment terms", cons)}
    <div class="sec"><div class="sec-h"><h3>Papers</h3><span class="badge ${c.papers_pct >= 90 ? "pos" : c.papers_pct >= 60 ? "warn" : "neg"}">${c.papers_pct}% complete</span></div><div id="docs">${data.documents ? docsHtml(data.documents, pns ? EXPECTED.park_n_sell : EXPECTED.invested) : '<p class="muted">Papers are managed by the office.</p>'}</div></div>
    ${owner ? sec("Cost ledger", costs || `<p class="muted">No costs recorded.</p>`, `<button class="btn sm" type="button" data-act="cost">${icon("plus")}Add cost</button>`) : ""}${sec("Workshop", edit ? refurb : "")}${sec("Deals", deals)}${sec("Where it has been", timeline, edit && !["delivered", "booked", "returned_to_owner", "written_off"].includes(c.status) ? `<button class="btn sm" type="button" data-act="status">Move to…</button>` : "")}${sec("Price history", prices)}`);
  d.setFoot(edit ? `<button class="btn" type="button" data-act="edit">${icon("edit")}Edit details</button>` : null);
  const done = () => { d.close(); reload?.(); setTimeout(() => ctxRef && openCar(id, ctx, reload), 300); };
  const reopen = () => { reload?.(); openCar(id, ctx, reload); };
  const docs = d.el.querySelector("#docs");
  if (docs) bindDocs(docs, { entityType: "car", entityId: id, onDone: reopen });
  d.el.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]")?.dataset.act;
    if (a === "edit") carForm(c, ctx, reload, data.purchase_payment);
    if (a === "price") priceForm(c, reopen);
    if (a === "cost") costForm(c, reopen);
    if (a === "status") statusForm(c, reopen);
  });
}
const aging = (c) => `<span class="aging"><i data-c="${agingColor(agingBucketOf(c.days_in_stock ?? 0))}"></i>${num(c.days_in_stock)} days</span>`;

function mini(titleText, sub, fields, values, submit, label = "Save") {
  const d = openDrawer({ title: titleText, sub, body: `<form id="mf" novalidate>${formHtml(fields, values)}</form>`, foot: `<button class="btn" type="button" data-x>Cancel</button><button class="btn primary" type="submit" form="mf">${label}</button>` });
  d.el.querySelector("[data-x]").addEventListener("click", () => d.close());
  d.el.querySelector("#mf").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.currentTarget; showErrors(f, null);
    const btn = d.el.querySelector('button[type="submit"]');
    const r = await save(btn, async () => { try { return await submit(readForm(f, fields)); } catch (ex) { if (ex.code !== "demo") showErrors(f, ex); throw ex; } });
    if (r) d.close();
  });
  return d;
}

function priceForm(c, after) {
  mini("Change asking price", `${c.stock_no} · now ${inr(c.asking_price)}`, [
    { name: "new_price", label: "New asking price", type: "money", required: true, value: c.asking_price, full: true },
    { name: "reason", label: "Reason", type: "text", full: true, placeholder: "For example, price cut after 60 days" }], {}, async (v) => { await api.post(`cars/${c.id}/price`, v); after(); });
}
async function costForm(c, after) {
  const bank = await bankPick();
  mini("Add a cost", `${c.stock_no} · ${c.make} ${c.model}`, [
    { name: "date", label: "Date", type: "date", required: true, value: state.today }, { name: "category", label: "Category", type: "select", required: true, options: opt(COST_CAT) },
    { name: "amount", label: "Amount (₹)", type: "money", required: true }, { name: "payment_mode", label: "Paid by", type: "select", options: opt(PAY), allowEmpty: true },
    ...(bankField(bank, "cost_bank_account_id", "Paid from", "The bank account it was paid from. Leave empty for cash or on credit.") ? [bankField(bank, "cost_bank_account_id", "Paid from", "The bank account it was paid from. Leave empty for cash or on credit.")] : []),
    { name: "vendor", label: "Vendor", type: "text" }, { name: "description", label: "Note", type: "text" },
    ...(c.ownership === "park_n_sell" ? [{ name: "recover_from_consignor", label: "Deduct from the owner's payout", type: "checkbox", full: true }] : [])], {}, async (v) => { const b = v.cost_bank_account_id && v.payment_mode && !["cash", "credit"].includes(v.payment_mode) ? +v.cost_bank_account_id : null; delete v.cost_bank_account_id; await api.post(`cars/${c.id}/costs`, { ...v, ...(b ? { cost_bank_account_id: b } : {}) }); after(); });
}
function statusForm(c, after) {
  const next = { incoming: ["refurb", "available"], refurb: ["available"], available: ["refurb"], withdrawn: ["available", "refurb"] }[c.status] || [];
  const extra = c.ownership === "park_n_sell" ? ["withdrawn", "returned_to_owner"] : ["withdrawn", "written_off"];
  mini("Move car", `${c.stock_no} is ${sentence(c.status)}`, [
    { name: "to", label: "New status", type: "select", required: true, options: opt([...new Set([...next, ...extra])]), full: true }, { name: "note", label: "Note", type: "text", full: true }], {}, async (v) => { await api.post(`cars/${c.id}/status`, v); after(); }, "Move car");
}

async function carForm(car, ctx, reload, pay) {
  const bank = can("money.view") ? await bankPick() : null;
  const isNew = !car, v = { ...(car || { ownership: "invested", acquired_on: state.today, location: "showroom" }), purchase_mode: pay?.mode || "neft_rtgs", purchase_bank_account_id: pay?.bank_account_id || bank?.main_id || "" };
  const f = (o) => o;
  const fields = [
    ...(isNew ? [f({ name: "ownership", label: "Segment", type: "select", required: true, options: [["invested", "Invested (the firm buys it)"], ["park_n_sell", "Park-N-Sell (owner keeps title)"]], full: true })] : []),
    { name: "make", label: "Make", type: "text", required: true }, { name: "model", label: "Model", type: "text", required: true },
    { name: "variant", label: "Variant", type: "text" }, { name: "colour", label: "Colour", type: "text" },
    { name: "mfg_year", label: "Manufacture year", type: "number", step: 1, min: 1990 }, { name: "reg_year", label: "Registration year", type: "number", step: 1, min: 1990 },
    { name: "reg_no", label: "Registration no", type: "text" }, { name: "kms_at_intake", label: "KMs driven", type: "number", step: 1, min: 0 },
    { name: "fuel", label: "Fuel", type: "select", options: opt(FUEL), allowEmpty: true }, { name: "transmission", label: "Gearbox", type: "select", options: [["manual", "Manual"], ["automatic", "Automatic"]], allowEmpty: true },
    { name: "owner_serial", label: "Owner number", type: "number", step: 1, min: 1 }, { name: "location", label: "Location", type: "select", options: opt(LOC) },
    ...(can("money.view") ? [{ name: "purchase_price", label: "Purchase price (₹)", type: "money", hint: "Invested cars only." }, { name: "broker_fee", label: "Broker fee (₹)", type: "money" },
      { name: "purchase_mode", label: "Paid by", type: "select", options: PAY_MODES.filter((m) => m[0] !== "loan"), hint: "How the purchase price and broker fee were paid. It goes straight into the cashbook." },
      ...(bankField(bank, "purchase_bank_account_id", "Paid from", "The bank account the money left. Leave empty for cash.") ? [bankField(bank, "purchase_bank_account_id", "Paid from", "The bank account the money left. Leave empty for cash.")] : [])] : []),
    { name: "asking_price", label: "Asking price (₹)", type: "money" }, { name: "floor_price", label: "Floor price (₹)", type: "money" },
    { name: "acquired_on", label: "Acquired on", type: "date" }, { name: "source", label: "Source", type: "select", options: opt(SOURCE), allowEmpty: true },
    { name: "insurance_expiry", label: "Insurance valid till", type: "date" }, { name: "puc_expiry", label: "PUC valid till", type: "date" },
    { name: "hypothecated_to", label: "Hypothecated to", type: "text" }, { name: "notes", label: "Notes", type: "textarea", full: true },
  ];
  const pnsFields = [
    { name: "consignor_name", label: "Owner's name", type: "text", required: true }, { name: "consignor_phone", label: "Owner's phone", type: "tel" },
    { name: "reserve_price", label: "Reserve price (₹)", type: "money", required: true }, { name: "commission_percent", label: "Commission (%)", type: "number", step: 0.1, value: 2 },
    { name: "agreement_expiry", label: "Agreement ends", type: "date" },
  ];
  const d = openDrawer({ title: isNew ? "Add a car" : `Edit ${car.stock_no}`, sub: isNew ? "Enter what you know now. Papers and costs can follow." : `${car.make} ${car.model}`, wide: true,
    body: `<form id="cf" novalidate>${formHtml(fields, v)}<div id="pns" class="sec" hidden><div class="sec-h"><h3>Park-N-Sell terms</h3></div>${formHtml(pnsFields, {})}</div></form>`,
    foot: `<button class="btn" type="button" data-x>Cancel</button><button class="btn primary" type="submit" form="cf">${isNew ? "Add car" : "Save changes"}</button>` });
  const form = d.el.querySelector("#cf");
  const sync = () => { const p = form.ownership?.value === "park_n_sell"; d.el.querySelector("#pns").hidden = !p; ["purchase_price", "broker_fee", "purchase_mode", "purchase_bank_account_id"].forEach((n) => { const e = form.querySelector(`[name=${n}]`); if (e) e.closest(".field").hidden = p; }); };
  form.ownership?.addEventListener("change", sync); sync();
  d.el.querySelector("[data-x]").addEventListener("click", () => d.close());
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); showErrors(form, null);
    const vals = readForm(form, fields), pv = readForm(form, pnsFields);
    if ("purchase_mode" in vals) vals.purchase_bank_account_id = vals.purchase_mode === "cash" || !vals.purchase_bank_account_id ? null : +vals.purchase_bank_account_id;
    const btn = d.el.querySelector('button[type="submit"]');
    const r = await save(btn, async () => {
      try {
        if (!isNew) { await api.patch(`cars/${car.id}`, { ...vals, version: car.version }); return true; }
        let personId = null;
        if (vals.ownership === "park_n_sell") {
          if (!pv.consignor_name) throw Object.assign(new Error("Enter the owner's name."), { fields: { consignor_name: "required" } });
          if (!pv.reserve_price) throw Object.assign(new Error("Enter the reserve price."), { fields: { reserve_price: "required" } });
          personId = (await api.post("people", { full_name: pv.consignor_name, phone: pv.consignor_phone })).id;
          delete vals.purchase_price; delete vals.broker_fee; delete vals.purchase_mode; delete vals.purchase_bank_account_id;
        }
        const car = await api.post("cars", vals);
        if (personId) await api.post("consignments", { car_id: car.id, consignor_person_id: personId, agreement_date: state.today, agreement_expiry: pv.agreement_expiry, reserve_price: pv.reserve_price, commission_type: "percent", commission_value: (pv.commission_percent ?? 2) / 100 });
        return car;
      } catch (ex) { if (ex.code !== "demo") showErrors(form, ex); throw ex; }
    }, { ok: isNew ? "Car added" : "Changes saved" });
    if (r) { d.close(); reload?.(); }
  });
}
