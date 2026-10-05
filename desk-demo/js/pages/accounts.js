// Accounts: cashbook and ledger, receivables and payables, bank reconciliation, GST and TCS.
// Needs accounts.view (and two-factor). Editing needs accounts.manage.
import * as api from "../api.js";
import { get } from "../api.js";
import { state, can, periodLabel } from "../state.js";
import { badge, dateFmt, esc, icon, inr, lakh, monthLabel, mount, num, pct, sentence } from "../util.js";
import { bindTabs, formDrawer, openDrawer, pageHead, save, tabsHtml, toast } from "../ui.js";
import { card } from "./_shared.js";
import { LEDGER_CATS, catLabel, modeLabel } from "../lists.js";

const SOURCE = { payment: ["Deal", "info"], expense: ["Expense", "warn"], ledger: ["Ledger", ""] };
const MODES = [["cash", "Cash"], ["bank", "Bank transfer"], ["upi", "UPI"], ["cheque", "Cheque"], ["card", "Card"]];

export async function render(ctx) {
  const p = ctx.period;
  const [cb, banks] = await Promise.all([get("accounts/cashbook", cashParams(p)), can("bank.view") ? get("bank-accounts").catch(() => ({ data: [] })) : can("accounts.manage") ? get("accounts/bank-options").catch(() => ({ data: [] })) : { data: [] }]);
  if (!ctx.alive()) return;
  const tab = ctx.query.get("tab") || "cash";
  const tabs = [{ id: "cash", label: "Cashbook" }, { id: "owed", label: "Owed and payable" }, { id: "recon", label: "Bank reconciliation" }, { id: "tax", label: "GST and TCS" }];
  mount(ctx.root, pageHead({ title: "Accounts", sub: `${esc(periodLabel(p))}. Every rupee in and out, by cash, bank, UPI and cheque.`,
    actions: can("accounts.manage") ? `<button class="btn primary" type="button" id="add-entry">${icon("plus")}Add ledger entry</button>` : "" })
    + `<section class="card flush rise">${tabsHtml(tabs, tab, "Accounts sections")}<div id="pane"></div></section>`);
  const pane = ctx.root.querySelector("#pane");
  const show = async (t) => {
    pane.innerHTML = `<div class="skel card"></div>`;
    try {
      if (t === "cash") pane.innerHTML = cashHtml(cb, p);
      else if (t === "owed") { pane.innerHTML = await owedHtml(); bindOwed(pane, ctx); }
      else if (t === "recon") { pane.innerHTML = await reconHtml(); bindRecon(pane, banks.data, ctx); }
      else pane.innerHTML = await taxHtml(p);
    } catch (e) { pane.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not load this section.</b><span class="muted">${esc(e.message)}</span></div></div>`; }
  };
  bindTabs(ctx.root, (t) => { history.replaceState(null, "", `#/accounts?tab=${t}`); show(t); });
  await show(tab);
  ctx.root.querySelector("#add-entry")?.addEventListener("click", () => entryForm(banks.data, ctx));
}

const cashParams = (p) => (/^\d{4}-\d{2}$/.test(p) ? { period: p } : { period: p });

// ------------------------------------------------------------------ cashbook
function cashHtml(cb, p) {
  const bal = cb.balances || {}, T = cb.totals || {};
  const tiles = `<div class="bal-strip pad">
    ${(bal.accounts || []).map((a) => `<div class="bal-tile"><div class="l">${esc(a.label)}</div><div class="v">${esc(lakh(a.book_balance))}</div><div class="s">Book balance</div></div>`).join("")}
    <div class="bal-tile"><div class="l">Cash in hand</div><div class="v">${esc(lakh(bal.cash_in_hand))}</div><div class="s">Cash in minus cash out</div></div>
    <div class="bal-tile"><div class="l">In · ${esc(periodLabel(p))}</div><div class="v ledger-in">${esc(lakh(T.in))}</div><div class="s">${esc(modeSplit(T.by_mode, "in"))}</div></div>
    <div class="bal-tile"><div class="l">Out · ${esc(periodLabel(p))}</div><div class="v ledger-out">${esc(lakh(T.out))}</div><div class="s">${esc(modeSplit(T.by_mode, "out"))}</div></div></div>`;
  const rows = cb.data || [];
  const table = rows.length ? `<div class="scroll-x tbl-scroll"><table class="tbl left zebra"><thead><tr><th>Date</th><th>Details</th><th>Source</th><th>Mode</th><th class="r">In</th><th class="r">Out</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${dateFmt(r.date)}</td><td>${esc(r.counterparty || r.description || "—")}<span class="sub">${esc(catLabel(r.category))}${r.reference ? " · " + esc(r.reference) : ""}${r.bank_label ? " · " + esc(r.bank_label) : ""}</span></td><td>${badge(SOURCE[r.source]?.[0] || sentence(r.source), SOURCE[r.source]?.[1] || "")}${r.cash_flag ? ` <span class="cash-flag" title="Cash receipt at or over the ₹2 lakh limit">${icon("alert", "")}Over ₹2 L</span>` : ""}${r.reconciled_line_id ? ` <span class="pill pos">${icon("check", "")}Matched</span>` : ""}</td><td>${esc(modeLabel(r.mode))}</td><td class="r ledger-in">${r.direction === "in" ? inr(r.amount) : ""}</td><td class="r ledger-out">${r.direction === "out" ? inr(r.amount) : ""}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">${icon("book", "")}<b>No entries in ${esc(periodLabel(p))}</b><p>Deal payments, paid expenses and ledger lines appear here. Pick another month or add a ledger entry.</p></div>`;
  return `<div class="pad-box">${tiles}</div>${table}`;
}
const modeSplit = (m = {}, k) => Object.entries(m).filter(([, v]) => v[k]).map(([n, v]) => `${sentence(n)} ${lakh(v[k])}`).join(" · ") || "Nothing";

const FLAG_NAME = { cash_limit: "Cash over the limit", tcs_missing: "TCS not collected", pan_missing: "PAN or Form 60 missing", form29c_missing: "Form 29C not filed", cash_expense: "Large cash expense" };
/** Repeated flags collapse into one line per kind with a count and a link to each record. */
function flagsHtml(flags) {
  if (!flags.length) return "";
  const by = new Map();
  for (const f of flags) { if (!by.has(f.kind)) by.set(f.kind, []); by.get(f.kind).push(f); }
  const link = (f) => (f.deal_id ? `<a href="#/deals?deal=${f.deal_id}">Deal ${f.deal_id}</a>` : f.car_id ? `<a href="#/inventory?car=${f.car_id}">${esc(String(f.message || "").split(":")[0] || "Car " + f.car_id)}</a>` : "");
  return `<div class="pad-box"><div class="mini-h">Compliance flags</div><ul class="list">${[...by].map(([k, items]) => `<li>${icon("alert", "")}<span class="grow"><div class="t">${esc(FLAG_NAME[k] || k.replace(/_/g, " "))}: ${items.length} ${items.length === 1 ? "record" : "records"}</div><div class="s flag-links">${items.slice(0, 14).map(link).filter(Boolean).join(" · ") || esc(items[0].message)}${items.length > 14 ? ` · and ${items.length - 14} more` : ""}</div></span></li>`).join("")}</ul></div>`;
}

function entryForm(banks, ctx) {
  formDrawer({ title: "Add ledger entry", sub: "For money that is not a deal payment or an expense: capital, drawings, EMIs, interest, GST payments, transfers.", submit: "Add entry", ok: "Ledger entry added",
    fields: [
      { name: "date", label: "Date", type: "date", required: true, value: state.today },
      { name: "direction", label: "Money", type: "select", required: true, value: "out", options: [["in", "Came in"], ["out", "Went out"]] },
      { name: "amount", label: "Amount (₹)", type: "money", required: true },
      { name: "category", label: "What for", type: "select", required: true, options: LEDGER_CATS },
      { name: "mode", label: "Paid by", type: "select", required: true, options: MODES, value: "bank" },
      { name: "bank_account_id", label: "Bank account", type: "select", allowEmpty: true, options: banks.map((b) => [b.id, b.label]) },
      { name: "counterparty", label: "Who", type: "text", full: true }, { name: "reference", label: "Reference", type: "text" }, { name: "description", label: "Note", type: "text" },
    ],
    onSubmit: async (v) => { const r = await api.post("accounts/ledger", { ...v, bank_account_id: v.bank_account_id ? +v.bank_account_id : null }); if (r.cash_limit_flag) toast("Saved, and flagged: cash receipts of ₹2 L or more need a closer look.", "err"); ctx.refresh(); } });
}

// ------------------------------------------------------------------ owed and payable
async function owedHtml() {
  const [rc, py] = await Promise.all([get("accounts/receivables"), get("accounts/payables")]);
  const cust = rc.customers || [];
  const a = `<div class="scroll-x"><table class="tbl left"><thead><tr><th>Buyer</th><th>Car</th><th class="r">Invoiced</th><th class="r">Paid</th><th class="r">Due</th><th class="r">Days</th></tr></thead><tbody>${cust.length ? cust.map((r) => `<tr class="row-btn" tabindex="0" data-deal="${r.deal_id}"><td>${esc(r.buyer)}</td><td>${esc(r.stock_no)}<span class="sub">${esc(sentence(r.status))}</span></td><td class="r">${inr(r.invoiced)}</td><td class="r">${inr(r.paid)}</td><td class="r"><b>${inr(r.due)}</b></td><td class="r">${num(r.days)}</td></tr>`).join("") : `<tr><td colspan="6">Nobody owes the firm anything.</td></tr>`}</tbody></table></div>`;
  const dsa = (rc.dsa_payouts || []).slice(0, 8).map((r) => `<li><span class="grow"><div class="t">${esc(r.lender)}</div><div class="s">Deal ${r.deal_id} · since ${dateFmt(r.since, false)}</div></span><b>${inr(r.due)}</b></li>`).join("");
  const ins = (rc.insurance_commission || []).slice(0, 8).map((r) => `<li><span class="grow"><div class="t">${esc(r.insurer)}</div><div class="s">Deal ${r.deal_id} · since ${dateFmt(r.since, false)}</div></span><b>${inr(r.due)}</b></li>`).join("");
  const T = rc.totals || {}, PT = py.totals || {};
  const co = (py.consignor_payouts || []).map((r) => `<li><span class="grow"><div class="t">${esc(r.consignor)}</div><div class="s">${esc(r.stock_no)} sold, owner to be paid</div></span><b>${inr(r.due)}</b></li>`).join("");
  const eu = (py.expenses_unpaid || []).map((r) => `<li><span class="grow"><div class="t">${esc(r.vendor || catLabel(r.category))}</div><div class="s">${esc(r.description || "")} · ${dateFmt(r.date, false)}</div></span><b>${inr(r.due)}</b>${can("expenses.manage") ? `<button class="btn sm" type="button" data-paid="${r.expense_id}">Mark paid</button>` : ""}</li>`).join("");
  const em = (py.emis_next_30_days || []).map((r) => `<li><span class="grow"><div class="t">${esc(r.lender)} EMI</div><div class="s">${esc(sentence(r.loan_type))} · due ${dateFmt(r.due_on, false)}</div></span><b>${inr(r.due)}</b></li>`).join("");
  const list = (h) => (h ? `<ul class="list">${h}</ul>` : `<p class="muted">Nothing.</p>`);
  return `<div class="pad-box"><div class="bal-strip">
    <div class="bal-tile"><div class="l">Customers owe us</div><div class="v ledger-in">${esc(lakh(T.customers))}</div></div>
    <div class="bal-tile"><div class="l">Lenders and insurers owe us</div><div class="v ledger-in">${esc(lakh((T.dsa_payouts || 0) + (T.insurance_commission || 0)))}</div></div>
    <div class="bal-tile"><div class="l">We owe owners and vendors</div><div class="v ledger-out">${esc(lakh((PT.consignor_payouts || 0) + (PT.expenses_unpaid || 0)))}</div></div>
    <div class="bal-tile"><div class="l">EMIs in 30 days</div><div class="v ledger-out">${esc(lakh(PT.emis_next_30_days))}</div></div></div></div>
    <div class="mini-h pad-h">Customers with a balance</div>${a}
    <div class="cols-2 pad-box"><div><div class="mini-h">Finance payouts due</div>${list(dsa)}</div><div><div class="mini-h">Insurance commission due</div>${list(ins)}</div>
    <div><div class="mini-h">Park-N-Sell owners to pay</div>${list(co)}</div><div><div class="mini-h">Unpaid bills and EMIs</div>${list(eu + em)}</div></div>`;
}

function bindOwed(pane, ctx) {
  pane.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-paid]"); if (!b) return;
    const ok = await save(b, () => api.post(`expenses/${b.dataset.paid}/mark-paid`, { paid_on: state.today }), { ok: "Marked as paid. It now shows in the cashbook." });
    if (ok) ctx.refresh();
  });
}

// ------------------------------------------------------------------ bank reconciliation
async function reconHtml() {
  const s = await get("accounts/statements");
  const manage = can("accounts.manage");
  return `<div class="pad-box">${manage ? `<div class="dz"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg><b>Import a bank statement</b><span>Download the CSV from net banking and drop it here. It is read in your browser and sent only to this server. Lines are matched to payments, expenses and ledger entries by amount, date and reference.</span><button class="btn" type="button" id="imp">${icon("upload")}Choose a CSV file</button></div>` : ""}</div>
    ${s.data.length ? `<div class="scroll-x"><table class="tbl left"><thead><tr><th>Statement</th><th>Account</th><th>Period</th><th class="r">Lines</th><th class="r">Matched</th><th class="r">Unmatched</th><th></th></tr></thead><tbody>${s.data.map((r) => `<tr class="row-btn" tabindex="0" data-st="${r.id}"><td>${esc(r.label || "Statement " + r.id)}<span class="sub">Imported ${dateFmt(r.imported_at, false)}</span></td><td>${esc(r.bank_label || "—")}</td><td>${dateFmt(r.date_from, false)} to ${dateFmt(r.date_to, false)}</td><td class="r">${num(r.lines)}</td><td class="r">${num(r.matched)}</td><td class="r">${r.unmatched ? badge(String(r.unmatched), "warn") : badge("0", "pos")}</td><td class="r">${icon("right", "")}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty">${icon("bank", "")}<b>No statement imported yet</b><p>Import last month's CSV to see which bank lines match your books and which do not.</p></div>`}`;
}
function bindRecon(pane, banks, ctx) {
  pane.querySelector("#imp")?.addEventListener("click", () => importForm(banks, ctx));
  pane.addEventListener("click", (e) => { const r = e.target.closest("[data-st]"); if (r) openStatement(+r.dataset.st, ctx); const d = e.target.closest("[data-deal]"); if (d) location.hash = `#/deals?deal=${d.dataset.deal}`; });
  pane.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.closest("[data-st],[data-deal]")?.click(); });
}
function importForm(banks, ctx) {
  const d = formDrawer({ title: "Import a bank statement", sub: "CSV with debit and credit columns, or one signed amount column.", submit: "Import and match", ok: "Statement imported",
    fields: [{ name: "bank_account_id", label: "Which account", type: "select", required: true, options: banks.map((b) => [b.id, b.label]), full: true }, { name: "label", label: "Name", type: "text", full: true, placeholder: "Sep 2026 statement" }],
    after: `<div class="field sec"><label for="csvf">CSV file <span class="req" aria-hidden="true">*</span></label><input class="input" id="csvf" type="file" accept=".csv,text/csv"><div class="hint">Nothing is sent to your bank or anyone else.</div><div class="err" id="csv-e" role="alert" hidden></div></div>`,
    onSubmit: async (v, dr) => {
      const f = dr.el.querySelector("#csvf").files[0], er = dr.el.querySelector("#csv-e");
      if (!f) { er.textContent = "Choose the CSV file."; er.hidden = false; throw Object.assign(new Error("Choose the CSV file."), { fields: {} }); }
      const text = await f.text();
      const r = await api.post("accounts/statements", { bank_account_id: +v.bank_account_id, label: v.label || f.name, csv: text });
      toast(`${r.lines} lines read. ${r.reconciliation?.matched ?? 0} matched automatically.`, "ok"); ctx.refresh();
    } });
  return d;
}
async function openStatement(id, ctx) {
  const d = openDrawer({ title: "Statement", sub: "Loading…", body: `<div class="skel card"></div>`, wide: true });
  const load = async () => {
    const r = await get(`accounts/statements/${id}`);
    d.setTitle(r.statement.label || "Statement"); d.setSub(`${esc(r.statement.bank_label || "")} · ${dateFmt(r.statement.date_from, false)} to ${dateFmt(r.statement.date_to, false)}`);
    const lines = r.lines;
    d.setBody(`<div class="scroll-x"><table class="tbl left"><thead><tr><th>Date</th><th>Narration</th><th class="r">Debit</th><th class="r">Credit</th><th>Status</th></tr></thead><tbody>${lines.map((l) => `<tr><td>${dateFmt(l.date, false)}</td><td>${esc(l.description || l.reference || "—")}${l.suggestions?.length && can("accounts.manage") ? `<span class="sub">${l.suggestions.slice(0, 2).map((x) => `<button class="btn sm" type="button" data-match="${l.id}" data-kind="${x.source}" data-mid="${x.id}">Match ${esc(x.counterparty || x.source)} ${inr(x.amount)}</button>`).join(" ")}</span>` : ""}</td><td class="r ledger-out">${l.direction === "out" ? inr(l.amount) : ""}</td><td class="r ledger-in">${l.direction === "in" ? inr(l.amount) : ""}</td><td>${l.match_status === "unmatched" ? `<span class="pill warn">Unmatched</span>${can("accounts.manage") ? ` <button class="btn sm ghost" type="button" data-ignore="${l.id}">Ignore</button>` : ""}` : `<span class="pill ${l.match_status === "ignored" ? "" : "pos"}">${esc(sentence(l.match_status))}</span>`}</td></tr>`).join("")}</tbody></table></div>`);
    if (can("accounts.manage")) d.setFoot(`<button class="btn" type="button" data-rematch>${icon("refresh")}Match again</button>`);
  };
  d.el.addEventListener("click", async (e) => {
    const m = e.target.closest("[data-match]"), ig = e.target.closest("[data-ignore]"), re = e.target.closest("[data-rematch]");
    if (m) { await save(m, () => api.patch(`accounts/statement-lines/${m.dataset.match}`, { match_kind: m.dataset.kind, match_id: +m.dataset.mid }), { ok: "Matched" }) && load(); }
    if (ig) { await save(ig, () => api.patch(`accounts/statement-lines/${ig.dataset.ignore}`, { status: "ignored" }), { ok: "Ignored" }) && load(); }
    if (re) { const r = await save(re, () => api.post(`accounts/statements/${id}/reconcile`), { ok: "" }); if (r) { toast(`${r.matched ?? 0} more matched.`, "ok"); load(); ctx.refresh(); } }
  });
  try { await load(); } catch (e) { d.setBody(`<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not open this statement.</b><span class="muted">${esc(e.message)}</span></div></div>`); }
}

// ------------------------------------------------------------------ GST and TCS
async function taxHtml(p) {
  const t = await get("accounts/tax", {});
  const months = (t.months || []).filter((m) => m.gst_margin.deals || m.gst_on_commission.deals || m.tcs.deals);
  const R = t.rates || {};
  const sum = (f) => months.reduce((s, m) => s + f(m), 0);
  return `<div class="pad-box"><div class="callout"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><div><b>Financial year ${dateFmt(t.period?.from, false)} to ${dateFmt(t.period?.to, false)}</b><p>GST on margin at ${pct(R.gst_margin_rate * 100, 0)} (${R.gst_margin_price_inclusive ? "price-inclusive" : "on top"}), GST on commission at ${pct(R.gst_service_rate * 100, 0)}, TCS at ${pct(R.tcs_rate * 100, 0)} above ${inr(R.tcs_threshold)} (${pct(R.tcs_rate_no_pan * 100, 0)} without PAN). Ask your CA to confirm these rates; they are settings.</p></div></div></div>
   ${months.length ? `<div class="scroll-x"><table class="tbl left"><thead><tr><th>Month</th><th class="r">Cars sold</th><th class="r">Taxable margin</th><th class="r">GST on margin</th><th class="r">GST on commission</th><th class="r">TCS collected</th></tr></thead><tbody>${months.map((m) => `<tr><td>${monthLabel(m.month)}</td><td class="r">${num(m.gst_margin.deals)}</td><td class="r">${inr(m.gst_margin.taxable_margin)}</td><td class="r">${inr(m.gst_margin.gst)}</td><td class="r">${inr(m.gst_on_commission.gst)}</td><td class="r">${inr(m.tcs.collected)}</td></tr>`).join("")}</tbody><tfoot><tr><td>Total</td><td class="r">${num(sum((m) => m.gst_margin.deals))}</td><td class="r">${inr(sum((m) => m.gst_margin.taxable_margin))}</td><td class="r">${inr(sum((m) => m.gst_margin.gst))}</td><td class="r">${inr(sum((m) => m.gst_on_commission.gst))}</td><td class="r">${inr(sum((m) => m.tcs.collected))}</td></tr></tfoot></table></div>` : `<div class="empty">${icon("percent", "")}<b>No taxable sales yet this year</b></div>`}
   ${flagsHtml(t.flags || [])}`;
}
