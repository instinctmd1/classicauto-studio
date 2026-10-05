// Bank and finance vault. Numbers and contacts are masked; "Unmask" asks for the password and a fresh code, shows an audit
// notice, and hides the value again after 20 seconds. The server writes the audit row before it sends the value.
import * as api from "../api.js";
import { ApiError, get } from "../api.js";
import { state, can, isSuper } from "../state.js";
import { badge, dateFmt, esc, icon, inr, lakh, lakhHtml, mount, num, pct, sentence } from "../util.js";
import { bindTabs, formDrawer, openDrawer, pageHead, reauthDialog, tabsHtml, toast } from "../ui.js";
import { bindDocs, docsHtml } from "./_docs.js";

const ACCT_TYPE = { current: "Current account", od: "Overdraft", cc: "Cash credit", savings: "Savings" };
const LOAN_TYPES = [["inventory_funding", "Inventory funding"], ["term_loan", "Term loan"], ["overdraft", "Overdraft"], ["cash_credit", "Cash credit"], ["vehicle_loan", "Vehicle loan"], ["business_loan", "Business loan"], ["property_loan", "Property loan"], ["other", "Other"]];
const BANKER_KINDS = [["relationship_manager", "Relationship manager"], ["branch_manager", "Branch manager"], ["credit_officer", "Credit officer"], ["nbfc", "NBFC contact"], ["dsa", "DSA partner"], ["other", "Other"]];
const loanLabel = (t) => (LOAN_TYPES.find((x) => x[0] === t) || [0, sentence(t)])[1];
const kindLabel = (t) => (BANKER_KINDS.find((x) => x[0] === t) || [0, sentence(t)])[1];
const REVEAL_SECONDS = 20;

/** Ask the server to unmask one field. Tries without a password first (a recent re-check may still be valid), then prompts. */
export async function revealField(path, field, label) {
  const body = field ? { field } : {};
  try { return (await api.post(path, body)).value; }
  catch (e) {
    if (!(e instanceof ApiError) || (e.code !== "reauth_required")) { toast(e.message || "Could not unmask this.", "err"); return null; }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const cred = await reauthDialog({ title: `Unmask ${label}`, text: "Enter your password and a fresh code. This reveal is written to the audit log before the value is shown.", confirmLabel: "Unmask", needCode: !!state.mfa?.enrolled });
    if (!cred) return null;
    try { return (await api.post(path, { ...body, ...cred })).value; }
    catch (e) { toast(e.code === "reauth_failed" ? "Password or code is wrong." : e.message || "Could not unmask this.", "err"); if (e.status === 429) return null; }
  }
  return null;
}

/** Wire every [data-reveal] button under root: shows the value in the sibling [data-slot] for 20 s, then masks it again. */
function bindReveals(root) {
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-reveal]"); if (!b || b.disabled) return;
    const slot = root.querySelector(`[data-slot="${b.dataset.slot}"]`); if (!slot) return;
    const masked = slot.dataset.masked ?? slot.textContent;
    slot.dataset.masked = masked;
    b.disabled = true;
    const v = await revealField(b.dataset.reveal, b.dataset.field || null, b.dataset.label || "this value");
    b.disabled = false;
    if (v == null) return;
    slot.textContent = v; slot.classList.add("revealed"); slot.classList.remove("masked");
    const note = document.createElement("div"); note.className = "audit-note"; note.setAttribute("role", "status");
    let left = REVEAL_SECONDS; note.innerHTML = `${icon("eye", "")}<span>Shown for <b>${left}</b> s. This reveal was logged under your name.</span>`;
    slot.closest("[data-note-host]")?.appendChild(note);
    b.hidden = true;
    const t = setInterval(() => {
      left--; const s = note.querySelector("b"); if (s) s.textContent = String(left);
      if (left <= 0 || !slot.isConnected) { clearInterval(t); slot.textContent = masked; slot.classList.remove("revealed"); slot.classList.add("masked"); note.remove(); b.hidden = false; }
    }, 1000);
  });
}

export async function render(ctx) {
  const [acc, loans, bankers, rem] = await Promise.all([get("bank-accounts"), get("loans", { status: "all" }), get("bankers"), get("bank/reminders").catch(() => ({ data: [] }))]);
  if (!ctx.alive()) return;
  const tab = ctx.query.get("tab") || "accounts";
  const manage = can("bank.manage"), reveal = can("bank.reveal");
  const tabs = [{ id: "accounts", label: "Accounts", n: acc.data.length }, { id: "loans", label: "Loans", n: loans.data.filter((l) => l.status === "active").length }, { id: "bankers", label: "Bankers", n: bankers.data.length }];
  const remHtml = rem.data.length ? `<section class="card rise"><div class="card-h"><div><h2>Coming up</h2><div class="card-sub">EMIs, renewals and reviews that need you</div></div></div><ul class="list">${rem.data.slice(0, 6).map((r) => `<li>${icon("bell", "")}<span class="grow"><div class="t">${esc(r.message)}</div></span><span class="badge ${r.severity === "red" ? "neg" : r.severity === "amber" ? "warn" : "info"}">${dateFmt(r.due, false)}</span></li>`).join("")}</ul></section>` : "";
  mount(ctx.root, pageHead({ title: "Bank and finance", sub: `Accounts, loans and the people at the bank. Numbers stay masked${reveal ? "; unmasking asks for your password and code and is logged" : ""}.`,
    actions: manage ? `<button class="btn primary" type="button" id="add">${icon("plus")}Add</button>` : "" })
    + `<div class="callout rise">${icon("shieldcheck", "")}<div><b>Encrypted on the server.</b><p>Account numbers, loan numbers and banker contacts are stored as ciphertext. This page shows only the last digits. Nothing here is ever exported.</p></div></div>
    <div class="sec-gap">${remHtml}</div>
    <section class="card flush rise sec-gap">${tabsHtml(tabs, tab, "Bank sections")}<div id="pane"></div></section>`);
  const pane = ctx.root.querySelector("#pane");
  const show = (t) => {
    if (t === "accounts") pane.innerHTML = accountsHtml(acc, reveal);
    else if (t === "loans") pane.innerHTML = loansHtml(loans, reveal);
    else pane.innerHTML = bankersHtml(bankers, reveal, acc.data);
  };
  bindTabs(ctx.root, (t) => { history.replaceState(null, "", `#/bank?tab=${t}`); show(t); });
  show(tab);
  bindReveals(pane);
  pane.addEventListener("click", (e) => {
    if (e.target.closest("[data-reveal]")) return;
    const a = e.target.closest("[data-acct]"); if (a) openAccount(+a.dataset.acct, ctx);
    const l = e.target.closest("[data-loan]"); if (l && manage) loanForm(loans.data.find((x) => x.id === +l.dataset.loan), acc.data, ctx);
  });
  pane.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.closest("[data-acct]")?.click(); });
  ctx.root.querySelector("#add")?.addEventListener("click", (e) => {
    const t = ctx.root.querySelector('[role="tab"][aria-selected="true"]')?.dataset.tab || "accounts";
    if (t === "accounts") accountForm(null, ctx); else if (t === "loans") loanForm(null, acc.data, ctx); else bankerForm(acc.data, loans.data, ctx);
  });
}

// ------------------------------------------------------------------ accounts
function accountsHtml(acc, reveal) {
  if (!acc.data.length) return `<div class="empty">${icon("bank", "")}<b>No bank account on file</b><p>Add the current account and any overdraft or cash credit lines. You will see book balances here once accounts are linked.</p></div>`;
  return `<div class="pad-box vault-grid">${acc.data.map((a) => `<article class="vault-card" tabindex="0" data-acct="${a.id}" aria-label="${esc(a.nickname || a.bank)} account ending ${esc(a.account_masked.slice(-4))}"><div class="bk">${icon("bank", "")}<span>${esc(a.nickname || a.bank)}<small class="muted"> · ${esc(a.bank)}${a.branch ? ", " + esc(a.branch) : ""}</small></span><span class="pill">${esc(ACCT_TYPE[a.account_type] || a.account_type)}</span></div>
    <div data-note-host><div class="acct masked" data-slot="a${a.id}">${esc(a.account_masked)}</div>${reveal ? `<button class="reveal-btn" type="button" data-reveal="bank-accounts/${a.id}/reveal" data-field="" data-slot="a${a.id}" data-label="the account number">${icon("eye", "")}Unmask number</button>` : ""}</div>
    <div class="bal"><div><span>${a.book_balance != null ? "Book balance" : "Holder"}</span><b class="${a.book_balance < 0 ? "neg-text" : ""}"${a.book_balance != null ? ` title="${esc(inr(a.book_balance))}"` : ""}>${a.book_balance != null ? lakhHtml(a.book_balance) : esc(a.holder_name)}</b></div>
    <div class="right">${a.sanctioned_limit ? `<span>Limit</span><b title="${esc(inr(a.sanctioned_limit))}">${lakhHtml(a.sanctioned_limit)}</b>` : `<span>IFSC</span><b class="mono">${esc(a.ifsc || "—")}</b>`}</div></div>
    ${a.review_date || a.renewal_date ? `<div class="muted">${a.renewal_date ? `Renews ${dateFmt(a.renewal_date, false)}` : ""}${a.renewal_date && a.review_date ? " · " : ""}${a.review_date ? `Review ${dateFmt(a.review_date, false)}` : ""}</div>` : ""}</article>`).join("")}</div>`;
}

async function openAccount(id, ctx) {
  const d = openDrawer({ title: "Bank account", sub: "Loading…", body: `<div class="skel card"></div>`, wide: false });
  let a; try { a = await get(`bank-accounts/${id}`); } catch (e) { d.setBody(`<p class="muted">${esc(e.message)}</p>`); return; }
  d.setTitle(a.nickname || a.bank); d.setSub(`${esc(a.bank)} · ${esc(ACCT_TYPE[a.account_type] || a.account_type)}`);
  const kv = (l, v) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
  d.setBody(`<div data-note-host><div class="mini-h">Account number</div><div class="acct masked vault-inline" data-slot="d">${esc(a.account_masked)}</div>${can("bank.reveal") ? `<button class="reveal-btn" type="button" data-reveal="bank-accounts/${id}/reveal" data-slot="d" data-label="the account number">${icon("eye", "")}Unmask number</button>` : ""}</div>
    <div class="sec">${kv("Holder", esc(a.holder_name))}${kv("Branch", esc(a.branch || "—"))}${kv("IFSC", `<span class="mono">${esc(a.ifsc || "—")}</span>`)}${a.book_balance != null ? kv("Book balance", inr(a.book_balance)) : ""}${a.sanctioned_limit ? kv("Sanctioned limit", inr(a.sanctioned_limit)) : ""}${a.interest_rate ? kv("Interest", pct(a.interest_rate * 100, 2)) : ""}${kv("Renewal", dateFmt(a.renewal_date))}${kv("Review", dateFmt(a.review_date))}${a.notes ? kv("Notes", esc(a.notes)) : ""}</div>
    ${(a.loans_linked || []).length ? `<div class="sec"><div class="sec-h"><h3>Loans on this account</h3></div><ul class="list">${a.loans_linked.map((l) => `<li><span class="grow"><div class="t">${esc(l.lender)} · ${esc(loanLabel(l.loan_type))}</div><div class="s">Outstanding ${inr(l.outstanding)} · EMI ${inr(l.emi)}</div></span></li>`).join("")}</ul></div>` : ""}
    ${(a.bankers || []).length ? `<div class="sec"><div class="sec-h"><h3>Contacts</h3></div><ul class="list">${a.bankers.map((b) => `<li><span class="grow"><div class="t">${esc(b.name)}</div><div class="s">${esc(kindLabel(b.kind))}</div></span></li>`).join("")}</ul></div>` : ""}
    ${can("documents.sensitive") ? `<div class="sec"><div class="sec-h"><h3>Papers</h3></div><div id="dc">${docsHtml(a.documents || [], [], { addType: "other", addLabel: "Add a paper" })}</div></div>` : ""}`);
  bindReveals(d.el);
  const dc = d.el.querySelector("#dc"); if (dc) bindDocs(dc, { entityType: "bank_account", entityId: id, onDone: () => { d.close(true); openAccount(id, ctx); } });
  if (can("bank.manage")) { d.setFoot(`<button class="btn" type="button" id="ed">${icon("edit")}Edit details</button>`); d.el.querySelector("#ed").addEventListener("click", () => { d.close(true); accountForm(a, ctx); }); }
}

function accountForm(a, ctx) {
  const edit = !!a;
  const fields = [
    { name: "bank", label: "Bank", type: "text", required: true, value: a?.bank }, { name: "branch", label: "Branch", type: "text", value: a?.branch || "" },
    { name: "nickname", label: "Nickname", type: "text", value: a?.nickname || "", hint: "For example, Main current account." }, { name: "account_type", label: "Type", type: "select", required: true, value: a?.account_type || "current", options: Object.entries(ACCT_TYPE) },
    { name: "holder_name", label: "Account holder", type: "text", required: true, full: true, value: a?.holder_name },
    { name: "account_number", label: edit ? "New account number" : "Account number", type: "text", required: !edit, hint: edit ? "Leave empty to keep the stored number." : "Stored encrypted. Only the last 4 digits are ever shown.", autocomplete: "off" },
    { name: "ifsc", label: "IFSC", type: "text", value: a?.ifsc || "", placeholder: "ABCD0123456" },
    { name: "sanctioned_limit", label: "Sanctioned limit (₹)", type: "money", value: a?.sanctioned_limit ?? "" }, { name: "interest_pct", label: "Interest rate (% a year)", type: "number", step: 0.01, min: 0, max: 60, value: a?.interest_rate ? +(a.interest_rate * 100).toFixed(2) : "" },
    { name: "renewal_date", label: "Limit renewal date", type: "date", value: a?.renewal_date || "" }, { name: "review_date", label: "Review date", type: "date", value: a?.review_date || "" },
    { name: "opening_balance", label: "Opening balance (₹)", type: "number", step: 1, value: a?.opening_balance ?? "", hint: "The balance on the opening date; the cashbook builds on it." }, { name: "opening_date", label: "Opening date", type: "date", value: a?.opening_date || "" },
  ];
  formDrawer({ title: edit ? "Edit bank account" : "Add a bank account", sub: "Account numbers are encrypted before they are saved.", fields, submit: edit ? "Save changes" : "Add account", ok: edit ? "Account updated" : "Account added",
    onSubmit: async (v) => {
      const b = { ...v }; if (b.interest_pct != null) b.interest_rate = +(b.interest_pct / 100).toFixed(4); delete b.interest_pct;
      if (!b.account_number) delete b.account_number; if (b.ifsc) b.ifsc = b.ifsc.toUpperCase();
      if (b.opening_balance != null) b.opening_balance = Math.round(b.opening_balance);
      for (const k of Object.keys(b)) if (b[k] === null) delete b[k];
      if (edit) await api.patch(`bank-accounts/${a.id}`, { ...b, version: a.version }); else await api.post("bank-accounts", b);
      ctx.refresh();
    } });
}

// ------------------------------------------------------------------ loans
function loansHtml(loans, reveal) {
  const list = loans.data;
  if (!list.length) return `<div class="empty">${icon("book", "")}<b>No loans on file</b><p>Add inventory funding, overdraft and term loans to see EMIs coming due and what is still outstanding.</p></div>`;
  const T = loans.totals || {};
  return `<div class="pad-box"><div class="bal-strip"><div class="bal-tile"><div class="l">Outstanding</div><div class="v">${esc(lakh(T.outstanding))}</div><div class="s">Active loans</div></div><div class="bal-tile"><div class="l">EMIs each month</div><div class="v">${esc(lakh(T.monthly_emi))}</div></div></div></div>
  <div class="pad-box vault-grid">${list.map((l) => { const used = l.sanctioned ? Math.min(100, ((l.outstanding || 0) / l.sanctioned) * 100) : 0; return `<article class="vault-card" ${can("bank.manage") ? `tabindex="0" data-loan="${l.id}"` : ""}><div class="bk">${icon("book", "")}<span>${esc(l.lender)}</span><span class="pill ${l.status === "active" ? "info" : ""}">${esc(loanLabel(l.loan_type))}${l.status === "closed" ? " · closed" : ""}</span></div>
    <div data-note-host><div class="acct masked" data-slot="l${l.id}">${esc(l.loan_account_masked || "No number")}</div>${reveal && l.loan_account_masked ? `<button class="reveal-btn" type="button" data-reveal="loans/${l.id}/reveal" data-slot="l${l.id}" data-label="the loan account number">${icon("eye", "")}Unmask number</button>` : ""}</div>
    <div class="emi-bar"><span>Repaid</span><span class="meter" role="img" aria-label="${pct(used, 0)} of the sanction outstanding"><i data-w="${100 - used}" data-c="var(--pos)"></i></span><span>${pct(100 - used, 0)}</span></div>
    <div class="bal"><div><span>Outstanding</span><b>${lakhHtml(l.outstanding)}</b></div><div class="right"><span>EMI${l.due_day ? ` on the ${l.due_day}${ord(l.due_day)}` : ""}</span><b>${lakhHtml(l.emi)}</b></div></div>
    <div class="muted">${l.interest_rate ? pct(l.interest_rate * 100, 2) + " a year · " : ""}${l.next_due ? `Next EMI ${dateFmt(l.next_due, false)}` : ""}${l.end_date ? ` · ends ${dateFmt(l.end_date, false)}` : ""}${l.collateral ? `<br>${esc(l.collateral)}` : ""}</div></article>`; }).join("")}</div>`;
}
const ord = (n) => (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");

function loanForm(l, banks, ctx) {
  const edit = !!l;
  const fields = [
    { name: "lender", label: "Lender", type: "text", required: true, value: l?.lender }, { name: "loan_type", label: "Type", type: "select", required: true, value: l?.loan_type || "inventory_funding", options: LOAN_TYPES },
    { name: "loan_account", label: edit ? "New loan account number" : "Loan account number", type: "text", autocomplete: "off", hint: "Stored encrypted." }, { name: "bank_account_id", label: "Repaid from account", type: "select", allowEmpty: true, value: l?.bank_account_id || "", options: banks.map((b) => [b.id, b.label]) },
    { name: "sanctioned", label: "Sanctioned (₹)", type: "money", value: l?.sanctioned ?? "" }, { name: "outstanding", label: "Outstanding (₹)", type: "money", value: l?.outstanding ?? "" },
    { name: "emi", label: "EMI (₹)", type: "money", value: l?.emi ?? "" }, { name: "due_day", label: "EMI day of month", type: "number", step: 1, min: 1, max: 31, value: l?.due_day ?? "" },
    { name: "interest_pct", label: "Interest (% a year)", type: "number", step: 0.01, min: 0, max: 60, value: l?.interest_rate ? +(l.interest_rate * 100).toFixed(2) : "" }, { name: "reminder_days", label: "Remind me (days before)", type: "number", step: 1, min: 0, max: 30, value: l?.reminder_days ?? 3 },
    { name: "start_date", label: "Start", type: "date", value: l?.start_date || "" }, { name: "end_date", label: "End", type: "date", value: l?.end_date || "" },
    { name: "collateral", label: "Collateral", type: "text", full: true, value: l?.collateral || "" },
    ...(edit ? [{ name: "status", label: "Status", type: "select", value: l.status, options: [["active", "Active"], ["closed", "Closed"]] }] : []),
  ];
  formDrawer({ title: edit ? "Edit loan" : "Add a loan", fields, submit: edit ? "Save changes" : "Add loan", ok: edit ? "Loan updated" : "Loan added",
    onSubmit: async (v) => {
      const b = { ...v }; if (b.interest_pct != null) b.interest_rate = +(b.interest_pct / 100).toFixed(4); delete b.interest_pct;
      if (!b.loan_account) delete b.loan_account; if (b.bank_account_id) b.bank_account_id = +b.bank_account_id;
      for (const k of Object.keys(b)) if (b[k] === null || b[k] === "") delete b[k];
      if (b.due_day) b.due_day = Math.round(b.due_day); if (b.reminder_days != null) b.reminder_days = Math.round(b.reminder_days);
      if (edit) await api.patch(`loans/${l.id}`, { ...b, version: l.version }); else await api.post("loans", b);
      ctx.refresh();
    } });
}

// ------------------------------------------------------------------ bankers
function bankersHtml(bankers, reveal, accounts) {
  if (!bankers.data.length) return `<div class="empty">${icon("people", "")}<b>No bank contacts yet</b><p>Keep the relationship manager, branch manager and DSA contacts here, encrypted, so the numbers are there when you need them.</p></div>`;
  return `<div class="scroll-x"><table class="tbl left"><thead><tr><th>Person</th><th>Organisation</th><th>Phone</th><th>Email</th></tr></thead><tbody>${bankers.data.map((b) => `<tr><td>${esc(b.name)}<span class="sub">${esc(kindLabel(b.kind))}</span></td><td>${esc(b.organisation)}</td>
    <td data-note-host><span class="masked" data-slot="p${b.id}">${esc(b.phone_masked || "—")}</span> ${reveal && b.phone_masked ? `<button class="reveal-btn" type="button" data-reveal="bankers/${b.id}/reveal" data-field="phone" data-slot="p${b.id}" data-label="the phone number">${icon("eye", "")}Unmask</button>` : ""}</td>
    <td data-note-host><span class="masked" data-slot="e${b.id}">${esc(b.email_masked || "—")}</span> ${reveal && b.email_masked ? `<button class="reveal-btn" type="button" data-reveal="bankers/${b.id}/reveal" data-field="email" data-slot="e${b.id}" data-label="the email address">${icon("eye", "")}Unmask</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
}
function bankerForm(accounts, loans, ctx) {
  formDrawer({ title: "Add a bank contact", sub: "Name, phone and email are stored encrypted.", submit: "Add contact", ok: "Contact added",
    fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "kind", label: "Role", type: "select", required: true, options: BANKER_KINDS }, { name: "organisation", label: "Bank or company", type: "text", required: true, full: true },
      { name: "phone", label: "Phone", type: "tel" }, { name: "email", label: "Email", type: "email" }, { name: "bank_account_id", label: "Linked account", type: "select", allowEmpty: true, options: accounts.map((b) => [b.id, b.label]) }, { name: "loan_id", label: "Linked loan", type: "select", allowEmpty: true, options: loans.map((l) => [l.id, `${l.lender} · ${loanLabel(l.loan_type)}`]) },
      { name: "notes", label: "Notes", type: "textarea", full: true }],
    onSubmit: async (v) => { const b = { ...v }; for (const k of Object.keys(b)) if (b[k] === null) delete b[k]; if (b.bank_account_id) b.bank_account_id = +b.bank_account_id; if (b.loan_id) b.loan_id = +b.loan_id; await api.post("bankers", b); ctx.refresh(); } });
}
export { isSuper, num };
