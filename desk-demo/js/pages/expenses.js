// Expenses: enter with a receipt, approve, budget against actual, recurring bills and vendors.
// Only approved expenses reach the profit figure.
import * as api from "../api.js";
import { get } from "../api.js";
import { state, can, isMonthPeriod, currentMonth, periodLabel } from "../state.js";
import { applyDyn, badge, dateFmt, esc, icon, inr, lakh, monthLabel, mount, num, pct, sentence } from "../util.js";
import { bindTabs, confirmDialog, formDrawer, openDrawer, pageHead, save, tabsHtml, toast } from "../ui.js";
import { card } from "./_shared.js";
import { EXPENSE_CATS, catLabel, modeLabel } from "../lists.js";
import { bindDocs, docsHtml } from "./_docs.js";

const MODES = [["cash", "Cash"], ["bank", "Bank transfer"], ["upi", "UPI"], ["cheque", "Cheque"], ["card", "Card"]];
const ST = { approved: ["Approved", "pos"], pending: ["Waiting", "warn"], rejected: ["Rejected", "neg"] };

export async function render(ctx) {
  const month = isMonthPeriod(ctx.period) ? ctx.period : currentMonth();
  // The approval queue is every pending expense, whatever month it is dated: nothing waiting may fall out of view.
  const [ex, queue, banks, vendors] = await Promise.all([get("expenses", { month }), get("expenses", { status: "pending" }), can("bank.view") ? get("bank-accounts").catch(() => ({ data: [] })) : can("accounts.manage") ? get("accounts/bank-options").catch(() => ({ data: [] })) : { data: [] }, get("vendors")]);
  if (!ctx.alive()) return;
  const tab = ctx.query.get("tab") || "list";
  const pending = queue.data;
  const tabs = [{ id: "list", label: "All expenses" }, { id: "queue", label: "Approvals", n: pending.length }, { id: "budget", label: "Budget vs actual" }, { id: "rec", label: "Recurring" }, { id: "vendors", label: "Vendors" }];
  mount(ctx.root, pageHead({ title: "Expenses", sub: `${esc(monthLabel(month))}${isMonthPeriod(ctx.period) ? "" : ` (the period picker shows ${esc(periodLabel(ctx.period))}; expenses are kept by month)`}. Only approved expenses count towards profit.`,
    actions: can("expenses.manage") ? `<button class="btn primary" type="button" id="add-exp">${icon("plus")}Add expense</button>` : "" })
    + `<section class="card flush rise">${tabsHtml(tabs, tab, "Expense sections")}<div id="pane"></div></section>`);
  const pane = ctx.root.querySelector("#pane");
  const refresh = ctx.refresh;
  const show = async (t) => {
    pane.innerHTML = `<div class="skel card"></div>`;
    try {
      if (t === "list") { pane.innerHTML = listHtml(ex, month, pending); bindList(pane, ex, banks.data, vendors.data, refresh); }
      else if (t === "queue") { pane.innerHTML = queueHtml(pending); bindQueue(pane, pending, banks.data, vendors.data, refresh); }
      else if (t === "budget") { await budgetPane(pane, month, refresh); }
      else if (t === "rec") { await recPane(pane, banks.data, vendors.data, month, refresh); }
      else { pane.innerHTML = vendorHtml(vendors.data); bindVendors(pane, refresh); }
    } catch (e) { pane.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not load this section.</b><span class="muted">${esc(e.message)}</span></div></div>`; }
  };
  bindTabs(ctx.root, (t) => { history.replaceState(null, "", `#/expenses?tab=${t}`); show(t); });
  await show(tab);
  ctx.root.querySelector("#add-exp")?.addEventListener("click", () => expenseForm(null, banks.data, vendors.data, refresh));
}

// ------------------------------------------------------------------ list
function listHtml(ex, month, pending = []) {
  const cat = ex.approved_by_category || {}, tot = Object.values(cat).reduce((s, v) => s + v, 0), by = ex.by_status || {};
  const top = Object.entries(cat).sort((a, b) => b[1] - a[1]);
  const bars = top.length ? `<div class="pad-box"><div class="mini-h">Approved, by category</div>${top.map(([c, v]) => `<div class="hb"><span class="name">${esc(catLabel(c))}</span><span class="meter"><i data-w="${(v / top[0][1]) * 100}" data-c="var(--navy-bright)"></i></span><span class="val">${esc(lakh(v))}</span></div>`).join("")}</div>` : "";
  const strip = `<div class="bal-strip pad"><div class="bal-tile"><div class="l">Approved</div><div class="v">${esc(lakh(by.approved || 0))}</div><div class="s">${pct(tot ? 100 : 0, 0).replace("100%", "Counts towards profit")}</div></div>
    <a class="bal-tile" href="#/expenses?tab=queue" title="Open the approval queue"><div class="l">Waiting for approval</div><div class="v warn-text">${esc(lakh(pending.reduce((t, x) => t + x.amount, 0)))}</div><div class="s">${num(pending.length)} items · all months</div></a>
    <div class="bal-tile"><div class="l">Rejected</div><div class="v">${esc(lakh(by.rejected || 0))}</div><div class="s">Not counted</div></div>
    <div class="bal-tile"><div class="l">Entries</div><div class="v">${num(ex.data.length)}</div><div class="s">${esc(monthLabel(month))}</div></div></div>`;
  const table = ex.data.length ? `<div class="scroll-x"><table class="tbl left zebra"><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Paid by</th><th class="r">Amount</th><th>Status</th></tr></thead><tbody>${ex.data.map((x) => `<tr class="row-btn" tabindex="0" data-x="${x.id}"><td>${dateFmt(x.date, false)}</td><td>${esc(x.vendor || x.description || "—")}<span class="sub">${esc(x.vendor ? x.description || "" : "")}${x.recurring_id ? " · recurring" : ""}</span></td><td>${esc(catLabel(x.category))}</td><td>${esc(modeLabel(x.mode))}</td><td class="r"><b>${inr(x.amount)}</b></td><td>${badge(ST[x.status]?.[0] || x.status, ST[x.status]?.[1] || "")}${x.rejected_reason ? `<span class="sub">${esc(x.rejected_reason)}</span>` : ""}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">${icon("wallet", "")}<b>No expenses in ${esc(monthLabel(month))}</b><p>Add rent, salaries, bills and workshop invoices here. Attach the receipt so the books stand up to an audit.</p></div>`;
  return strip + bars + table;
}
function bindList(pane, ex, banks, vendors, refresh) {
  const open = (id) => openExpense(ex.data.find((x) => x.id === id), banks, vendors, refresh);
  pane.addEventListener("click", (e) => { const r = e.target.closest("[data-x]"); if (r) open(+r.dataset.x); });
  pane.addEventListener("keydown", (e) => { if (e.key === "Enter") { const r = e.target.closest("[data-x]"); if (r) open(+r.dataset.x); } });
  applyDyn(pane);
}

async function openExpense(x, banks, vendors, refresh) {
  const d = openDrawer({ title: x.vendor || catLabel(x.category), sub: `${badge(ST[x.status]?.[0], ST[x.status]?.[1])} · ${esc(dateFmt(x.date))}`, body: `<div class="skel card"></div>`, wide: false });
  let full; try { full = await get(`expenses/${x.id}`); } catch (e) { d.setBody(`<p class="muted">${esc(e.message)}</p>`); return; }
  const kv = (l, v) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
  d.setBody(`${kv("Amount", inr(full.amount))}${kv("Category", esc(catLabel(full.category)))}${kv("Vendor", esc(full.vendor || "—"))}${kv("Paid by", esc(modeLabel(full.mode)) + (full.bank_label ? " · " + esc(full.bank_label) : ""))}${kv("Reference", esc(full.reference || "—"))}${kv("Paid on", full.paid_on ? esc(dateFmt(full.paid_on)) : `<span class="warn-text">Not paid yet</span>`)}${kv("Note", esc(full.description || "—"))}${full.rejected_reason ? kv("Rejected because", esc(full.rejected_reason)) : ""}
    <div class="sec"><div class="sec-h"><h3>Receipts</h3></div><div id="rc">${docsHtml(full.receipts || [], [], { addType: "bill", addLabel: "Attach a receipt" })}</div></div>`);
  bindDocs(d.el.querySelector("#rc"), { entityType: "expense", entityId: x.id, onDone: () => { d.close(true); openExpense(x, banks, vendors, refresh); } });
  const foot = [];
  if (can("expenses.manage")) foot.push(`<button class="btn" type="button" data-a="edit">${icon("edit")}Edit</button>`);
  if (can("expenses.manage") && !full.paid_on && full.status !== "rejected") foot.push(`<button class="btn" type="button" data-a="paid">${icon("check")}Mark paid</button>`);
  if (can("expenses.approve") && full.status === "pending") foot.push(`<button class="btn danger" type="button" data-a="reject">Reject</button><button class="btn pos" type="button" data-a="approve">${icon("check")}Approve</button>`);
  if (foot.length) d.setFoot(foot.join(""));
  d.el.addEventListener("click", async (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    if (a === "edit") { d.close(true); expenseForm(full, banks, vendors, refresh); }
    if (a === "paid") { const ok = await save(e.target.closest("button"), () => api.post(`expenses/${x.id}/mark-paid`, { paid_on: state.today }), { ok: "Marked as paid" }); if (ok) { d.close(); refresh(); } }
    if (a === "approve") { const ok = await save(e.target.closest("button"), () => api.post(`expenses/${x.id}/approve`), { ok: "Approved" }); if (ok) { d.close(); refresh(); } }
    if (a === "reject") { d.close(true); rejectForm(x, refresh); }
  });
}
function rejectForm(x, refresh) {
  formDrawer({ title: "Reject this expense", sub: `${inr(x.amount)} · ${esc(x.vendor || catLabel(x.category))}`, submit: "Reject", ok: "Rejected", danger: true, fields: [{ name: "reason", label: "Why", type: "textarea", required: true, full: true }], onSubmit: async (v) => { await api.post(`expenses/${x.id}/reject`, v); refresh(); } });
}

function expenseForm(x, banks, vendors, refresh) {
  const edit = !!x;
  const fields = [
    { name: "date", label: "Date", type: "date", required: true, value: x?.date || state.today },
    { name: "category", label: "Category", type: "select", required: true, value: x?.category, options: EXPENSE_CATS.map((c) => [c, catLabel(c)]) },
    { name: "vendor", label: "Paid to", type: "text", full: true, value: x?.vendor || "", hint: vendors.length ? "Type a name. A new vendor is created the first time you use it." : "A new vendor is created the first time you use it." },
    { name: "description", label: "What for", type: "text", full: true, value: x?.description || "" },
    { name: "amount", label: "Amount (₹)", type: "money", required: true, value: x?.amount },
    { name: "mode", label: "Paid by", type: "select", options: MODES, value: x?.mode || "bank" },
    { name: "bank_account_id", label: "Bank account", type: "select", allowEmpty: true, value: x?.bank_account_id || "", options: banks.map((b) => [b.id, b.label]) },
    { name: "reference", label: "Reference or cheque number", type: "text", value: x?.reference || "" },
    { name: "paid_on", label: "Paid on", type: "date", value: edit ? x?.paid_on || "" : state.today, hint: "The day the money left. Leave it empty if you still owe it: it then waits under Payables instead of reaching the cashbook." },
    ...(!edit && can("expenses.approve") ? [{ name: "approve", label: "Approve it now", type: "checkbox", full: true }] : []),
  ];
  const note = edit ? "" : `<div class="callout sec">${icon("info", "")}<div><b>${can("expenses.approve") ? "You can approve as you save." : "It goes to the approval queue."}</b><p>Add the receipt after saving. PDF or a photo.</p></div></div>`;
  // Read a bill photo (free, read on the office computer): it fills the form for the person to check. Nothing is kept
  // until the expense is saved; the photo then becomes its receipt.
  const reader = edit ? "" : `<div class="callout" id="rb">${icon("camera", "")}<div><b>Have the bill?</b><p>Read a bill photo and the form fills itself. Check every figure before you save: anything the reader is not sure of is left blank.</p>
    <div class="pill-row"><button class="btn" type="button" id="rb-btn">${icon("camera")}Read a bill photo</button><input type="file" id="rb-file" accept="image/jpeg,image/png,image/webp" hidden></div><div id="rb-out" class="sec" role="status" aria-live="polite" hidden></div></div></div><div class="sec" aria-hidden="true"></div>`;
  let bill = null; // { file, vendor, gstin } once a photo was read
  const d = formDrawer({ title: edit ? "Edit expense" : "Add expense", sub: edit ? "An approved expense that changes goes back to the queue unless you are an approver." : "", fields, before: reader, after: note, submit: edit ? "Save changes" : "Save expense", ok: edit ? "Expense updated" : "Expense saved",
    onSubmit: async (v) => {
      const body = { ...v, bank_account_id: v.bank_account_id ? +v.bank_account_id : null, paid_on: v.paid_on || null };
      if (!body.vendor) delete body.vendor; if (!body.approve) delete body.approve; else body.approve = true;
      if (bill?.gstin && body.vendor && body.vendor === bill.vendor) body.vendor_gstin = bill.gstin;
      if (edit) { await api.patch(`expenses/${x.id}`, { ...body, version: x.version }); } else { const r = await api.post("expenses", body); if (r?.id) {
        if (bill?.file) await attachBill(r.id, bill.file);
        refresh(); openExpense({ id: r.id, status: body.approve ? "approved" : "pending", date: body.date, category: body.category, vendor: body.vendor }, banks, vendors, refresh); return; } }
      refresh();
    } });
  if (!edit) bindBillReader(d, (b) => { bill = b; });
}

async function attachBill(id, file) {
  const fd = new FormData();
  fd.append("file", file); fd.append("entity_type", "expense"); fd.append("entity_id", String(id)); fd.append("doc_type", "bill");
  try { await api.upload("documents", fd); } catch (e) { if (e.code !== "demo") toast(`Expense saved, but the bill photo did not attach: ${e.message} Attach it from the expense.`, "err"); }
}

const BILL_LABEL = { amount: "Amount", date: "Date", vendor: "Paid to", invoice_no: "Invoice number", gstin: "GSTIN" };
function bindBillReader(d, onRead) {
  const root = d.el, form = d.form, btn = root.querySelector("#rb-btn"), inp = root.querySelector("#rb-file"), out = root.querySelector("#rb-out");
  if (!btn) return;
  btn.addEventListener("click", () => inp.click());
  inp.addEventListener("change", async () => {
    const file = inp.files[0]; inp.value = "";
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    const r = await save(btn, () => api.upload("expenses/read-bill", fd), { ok: "" });
    if (!r || !r.draft) return;
    const v = r.draft, set = (name, val) => { const c = form.querySelector(`[name="${name}"]`); if (c) { c.value = val ?? ""; c.dispatchEvent(new Event("input", { bubbles: true })); } };
    set("amount", v.amount); set("date", v.date); set("vendor", v.vendor); set("reference", v.invoice_no);
    onRead({ file, vendor: v.vendor || "", gstin: v.gstin || "" });
    const got = Object.keys(BILL_LABEL).filter((k) => v[k] != null);
    const blank = Object.keys(BILL_LABEL).filter((k) => v[k] == null);
    const shown = { amount: v.amount != null ? inr(v.amount) : "", date: v.date ? dateFmt(v.date) : "", vendor: v.vendor, invoice_no: v.invoice_no, gstin: v.gstin };
    out.hidden = false;
    out.innerHTML = got.length
      ? `<div class="mini-h">Read from the bill: check each one</div><div>${got.map((k) => `<div class="kv"><span>${BILL_LABEL[k]}</span><b${k === "gstin" || k === "invoice_no" ? ' class="mono"' : ""}>${esc(shown[k])}</b></div>`).join("")}</div>${blank.length ? `<p class="muted">Left blank, fill by hand: ${esc(blank.map((k) => BILL_LABEL[k]).join(", "))}.</p>` : ""}<p class="muted">The photo is attached as the receipt when you save.</p>`
      : `<p class="warn-text"><b>Could not read this bill.</b> Fill the form by hand, or try a sharper photo taken straight on in good light.</p><p class="muted">The photo is still attached as the receipt when you save.</p>`;
    form.querySelector(got.length ? '[name="category"]' : '[name="amount"]')?.focus();
  });
}

// ------------------------------------------------------------------ approvals
function queueHtml(pending) {
  if (!pending.length) return `<div class="empty">${icon("check", "")}<b>Nothing is waiting</b><p>New expenses from the team land here until someone with approval rights signs them off.</p></div>`;
  return `<div class="pad-box stack-form">${pending.map((x) => `<article class="queue-card"><div class="hd"><div><b>${esc(x.vendor || catLabel(x.category))}</b><div class="muted">${[x.vendor && catLabel(x.category) !== x.vendor ? catLabel(x.category) : "", dateFmt(x.date), monthLabel(x.month) !== monthLabel(String(x.date).slice(0, 7)) ? monthLabel(x.month) : "", modeLabel(x.mode)].filter(Boolean).map(esc).join(" · ")}</div></div><span class="amt">${inr(x.amount)}</span></div>
    ${x.description ? `<div>${esc(x.description)}</div>` : ""}
    <div class="pill-row"><button class="btn sm" type="button" data-open="${x.id}">${icon("receipt")}Receipts</button>${can("expenses.approve") ? `<button class="btn sm pos" type="button" data-ap="${x.id}">${icon("check")}Approve</button><button class="btn sm danger" type="button" data-rj="${x.id}">Reject</button>` : `<span class="muted">Waiting for an approver.</span>`}</div></article>`).join("")}</div>`;
}
function bindQueue(pane, pending, banks, vendors, refresh) {
  pane.addEventListener("click", async (e) => {
    const ap = e.target.closest("[data-ap]"), rj = e.target.closest("[data-rj]"), op = e.target.closest("[data-open]");
    if (ap) { await save(ap, () => api.post(`expenses/${ap.dataset.ap}/approve`), { ok: "Approved" }) && refresh(); }
    if (rj) { const x = pending.find((q) => q.id === +rj.dataset.rj); rejectForm(x || { id: +rj.dataset.rj, amount: 0 }, refresh); }
    if (op) { const x = pending.find((q) => q.id === +op.dataset.open); if (x) openExpense(x, banks, vendors, refresh); }
  });
}

// ------------------------------------------------------------------ budget vs actual
async function budgetPane(pane, month, refresh) {
  const b = await get("expense-budgets", { month });
  const lines = b.lines || [];
  const T = b.totals || {};
  const usedAll = T.budget ? (T.actual / T.budget) * 100 : null;
  pane.innerHTML = `<div class="pad-box">${T.budget ? `<div class="bal-strip"><div class="bal-tile"><div class="l">Budget</div><div class="v">${esc(lakh(T.budget))}</div></div><div class="bal-tile"><div class="l">Actual</div><div class="v ${T.actual > T.budget ? "neg-text" : ""}">${esc(lakh(T.actual))}</div><div class="s">${usedAll != null ? pct(usedAll, 0) + " of budget" : ""}</div></div><div class="bal-tile"><div class="l">Waiting for approval</div><div class="v warn-text">${esc(lakh(T.pending))}</div></div><div class="bal-tile"><div class="l">Left</div><div class="v ${T.budget - T.actual < 0 ? "neg-text" : "pos-text"}">${esc(lakh(T.budget - T.actual))}</div></div></div>` : `<div class="callout">${icon("info", "")}<div><b>No budget set for ${esc(monthLabel(month))}.</b><p>${can("expenses.approve") ? "Set a figure per category. Bars turn red when approved spending passes it." : "An approver sets the budget."}</p></div></div>`}
    <div class="sec">${lines.map((l) => `<div class="budget-row"><span class="nm">${esc(catLabel(l.category))}</span><span class="meter${l.over ? " over" : ""}" role="img" aria-label="${esc(catLabel(l.category))}: ${l.used_pct != null ? pct(l.used_pct, 0) + " used" : "no budget"}"><i data-w="${Math.min(100, l.used_pct ?? (l.actual ? 100 : 0))}" data-c="${l.over ? "var(--neg)" : l.budget ? "var(--pos)" : "var(--faint)"}"></i></span><span class="nums">${inr(l.actual)} <small>${l.budget != null ? "of " + inr(l.budget) : "no budget"}</small>${l.pending ? ` <small class="warn-text">+${inr(l.pending)} waiting</small>` : ""}</span></div>`).join("")}</div>
    ${can("expenses.approve") ? `<div class="pill-row sec"><button class="btn" type="button" id="set-b">${icon("edit")}Set the budget</button>${b.previous_month_has_budget && !T.budget ? `<button class="btn" type="button" id="copy-b">Copy last month</button>` : ""}</div>` : ""}</div>`;
  applyDyn(pane);
  pane.querySelector("#set-b")?.addEventListener("click", () => {
    formDrawer({ title: `Budget for ${monthLabel(month)}`, sub: "Leave a category empty for no budget.", submit: "Save budget", ok: "Budget saved",
      fields: lines.map((l) => ({ name: l.category, label: catLabel(l.category), type: "money", value: l.budget ?? "" })),
      onSubmit: async (v) => { const items = {}; for (const [k, val] of Object.entries(v)) items[k] = val; await api.put("expense-budgets", { month, items }); refresh(); } });
  });
  pane.querySelector("#copy-b")?.addEventListener("click", async (e) => {
    const [y, m] = month.split("-").map(Number); const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    const pb = await get("expense-budgets", { month: prev }); const items = {}; pb.lines.forEach((l) => { if (l.budget != null) items[l.category] = l.budget; });
    await save(e.currentTarget, () => api.put("expense-budgets", { month, items }), { ok: "Last month's budget copied" }) && refresh();
  });
}

// ------------------------------------------------------------------ recurring
async function recPane(pane, banks, vendors, month, refresh) {
  const r = await get("recurring-expenses");
  const list = r.data;
  pane.innerHTML = `<div class="pad-box pill-row">${can("expenses.manage") ? `<button class="btn" type="button" id="gen">${icon("repeat")}Create ${esc(monthLabel(month))}'s expenses</button><button class="btn" type="button" id="add-rec">${icon("plus")}Add a recurring bill</button>` : ""}</div>
    ${list.length ? `<div class="scroll-x"><table class="tbl left"><thead><tr><th>Bill</th><th>Category</th><th>Day</th><th class="r">Amount</th><th>Approval</th><th>Status</th></tr></thead><tbody>${list.map((x) => `<tr><td>${esc(x.description)}<span class="sub">${esc(x.vendor || "")}</span></td><td>${esc(catLabel(x.category))}</td><td>${x.day_of_month}</td><td class="r">${inr(x.amount)}</td><td>${x.auto_approve ? badge("Automatic", "info") : badge("Needs approval", "warn")}</td><td>${x.active ? badge("Active", "pos") : badge("Stopped")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${icon("repeat", "")}<b>No recurring bills</b><p>Rent, salaries and the internet bill repeat every month. Add them once and create the month's entries with one click.</p></div>`}`;
  pane.querySelector("#gen")?.addEventListener("click", async (e) => { const res = await save(e.currentTarget, () => api.post("recurring-expenses/generate", { month }), { ok: "" }); if (res) { toast(`${res.created.length} created, ${res.already_there} were already there.`, "ok"); refresh(); } });
  pane.querySelector("#add-rec")?.addEventListener("click", () => formDrawer({ title: "Add a recurring bill", submit: "Add", ok: "Recurring bill added",
    fields: [{ name: "description", label: "What", type: "text", required: true, full: true }, { name: "category", label: "Category", type: "select", required: true, options: EXPENSE_CATS.map((c) => [c, catLabel(c)]) }, { name: "amount", label: "Amount (₹)", type: "money", required: true },
      { name: "vendor", label: "Paid to", type: "text" }, { name: "day_of_month", label: "Day of month (1 to 28)", type: "number", step: 1, min: 1, max: 28, value: 1 }, { name: "mode", label: "Paid by", type: "select", options: MODES, value: "bank" },
      { name: "bank_account_id", label: "Bank account", type: "select", allowEmpty: true, options: banks.map((b) => [b.id, b.label]), hint: "Which account the bill is paid from. Leave empty for cash." },
      ...(can("expenses.approve") ? [{ name: "auto_approve", label: "Approve each month automatically", type: "checkbox", full: true }] : [])],
    onSubmit: async (v) => { const b = { ...v }; if (!b.vendor) delete b.vendor; b.auto_approve = !!b.auto_approve; b.bank_account_id = b.bank_account_id && b.mode !== "cash" ? +b.bank_account_id : null; await api.post("recurring-expenses", b); refresh(); } }));
}

// ------------------------------------------------------------------ vendors
function vendorHtml(vendors) {
  return `<div class="pad-box pill-row">${can("expenses.manage") ? `<button class="btn" type="button" id="add-v">${icon("plus")}Add a vendor</button>` : ""}</div>${vendors.length ? `<div class="scroll-x"><table class="tbl left"><thead><tr><th>Vendor</th><th>Usually</th><th>GSTIN</th><th class="r">Approved to date</th></tr></thead><tbody>${vendors.map((v) => `<tr><td>${esc(v.name)}${v.active ? "" : badge("Inactive")}</td><td>${esc(v.category ? catLabel(v.category) : "—")}</td><td class="mono">${esc(v.gstin || "—")}</td><td class="r">${inr(v.approved_total)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${icon("building", "")}<b>No vendors yet</b><p>Vendors are created when you type a name on an expense.</p></div>`}`;
}
function bindVendors(pane, refresh) {
  pane.querySelector("#add-v")?.addEventListener("click", () => formDrawer({ title: "Add a vendor", submit: "Add vendor", ok: "Vendor added", fields: [{ name: "name", label: "Name", type: "text", required: true, full: true }, { name: "category", label: "Usually", type: "select", allowEmpty: true, options: EXPENSE_CATS.map((c) => [c, catLabel(c)]) }, { name: "gstin", label: "GSTIN", type: "text" }], onSubmit: async (v) => { await api.post("vendors", v); refresh(); } }));
}
