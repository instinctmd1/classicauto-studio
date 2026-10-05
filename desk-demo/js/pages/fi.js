// Finance and insurance: loan cases, policies, attach rates, and the deals that took neither (a cross-sell list).
// Payout and commission figures arrive only for people with money access; for everyone else the columns do not appear.
import * as api from "../api.js";
import { get } from "../api.js";
import { state, can, periodLabel } from "../state.js";
import { badge, dateFmt, esc, icon, inr, lakh, mount, num, pct, sentence } from "../util.js";
import { bindTabs, formDrawer, pageHead, tabsHtml } from "../ui.js";
import { card, kpiTile, pts } from "./_shared.js";

const FIN_ST = { applied: ["Applied", ""], login: ["Logged in", "info"], approved: ["Approved", "info"], disbursed: ["Disbursed", "pos"], rejected: ["Rejected", "neg"], withdrawn: ["Withdrawn", ""] };
const INS_KIND = { new_policy_by_firm: "New policy by us", transfer_of_existing: "Transfer of existing", renewal_by_firm: "Renewal by us" };
const COVER = { comprehensive: "Comprehensive", zero_dep: "Zero depreciation", third_party: "Third party" };

export async function render(ctx) {
  const p = ctx.period;
  const [k, fin, ins, deals] = await Promise.all([get("kpis", { period: p }), get("finance-cases"), get("insurance-policies"), get("deals", { status: "delivered", page_size: 200 })]);
  if (!ctx.alive()) return;
  const K = k.kpis, money = can("money.view");
  const tab = ctx.query.get("tab") || "fin";
  const finDeals = new Set(fin.data.filter((f) => f.status !== "rejected" && f.status !== "withdrawn").map((f) => f.deal_id));
  const insDeals = new Set(ins.data.map((i) => i.deal_id).filter(Boolean));
  const gap = deals.data.filter((d) => !finDeals.has(d.id) && !insDeals.has(d.id));
  const expected = fin.data.reduce((s, f) => s + (f.payout_expected || 0), 0), received = fin.data.reduce((s, f) => s + (f.payout_received || 0), 0);
  const tabs = [{ id: "fin", label: "Finance cases", n: fin.data.length }, { id: "ins", label: "Insurance", n: ins.data.length }, { id: "gap", label: "Cross-sell gaps", n: gap.length }];
  mount(ctx.root, pageHead({ title: "Finance and insurance", sub: `${esc(periodLabel(p))}. Loans we arranged, policies we sold, and who bought a car from us without either.`,
    actions: `<button class="btn primary" type="button" id="add-fin">${icon("plus")}Add finance case</button>` })
    + `<div class="kpis four">${[
      kpiTile({ label: "Finance attach", value: K.attach_finance_pct?.value, kind: "pct", delta: pts(K.attach_finance_pct?.value, K.attach_finance_pct?.prev), deltaUnit: " pts", sub: "Buyers who financed through us" }),
      kpiTile({ label: "Insurance attach", value: K.attach_insurance_pct?.value, kind: "pct", delta: pts(K.attach_insurance_pct?.value, K.attach_insurance_pct?.prev), deltaUnit: " pts", sub: "Buyers who insured through us" }),
      kpiTile({ label: "Loans disbursed", value: fin.data.filter((f) => f.status === "disbursed").length, sub: `${fin.data.filter((f) => ["applied", "login", "approved"].includes(f.status)).length} in progress` }),
      money ? kpiTile({ label: "Payouts still due", value: Math.max(0, expected - received), kind: "money", sub: `${lakh(received)} of ${lakh(expected)} received` }) : kpiTile({ label: "Deals with neither", value: gap.length, sub: "A chance to offer both" }),
    ].join("")}</div>
    <section class="card flush rise sec-gap">${tabsHtml(tabs, tab, "Finance sections")}<div id="pane"></div></section>`);
  const pane = ctx.root.querySelector("#pane");
  const show = (t) => {
    if (t === "fin") pane.innerHTML = fin.data.length ? `<div class="scroll-x"><table class="tbl left"><thead><tr><th>Buyer</th><th>Lender</th><th class="r">Loan</th><th class="r">Tenure</th><th>Status</th>${money ? '<th class="r">Payout due</th><th class="r">Received</th>' : ""}</tr></thead><tbody>${fin.data.map((f) => `<tr class="row-btn" tabindex="0" data-deal="${f.deal_id}"><td>${esc(f.buyer)}<span class="sub">${esc(f.stock_no)}</span></td><td>${esc(f.lender)}<span class="sub">${esc(sentence(f.lender_type || ""))}${f.roi_pct ? " · " + f.roi_pct + "%" : ""}</span></td><td class="r">${inr(f.loan_amount)}</td><td class="r">${f.tenure_months ? f.tenure_months + " m" : "—"}</td><td>${badge(FIN_ST[f.status]?.[0] || f.status, FIN_ST[f.status]?.[1])}${f.rejected_reason ? `<span class="sub">${esc(f.rejected_reason)}</span>` : ""}</td>${money ? `<td class="r">${inr(f.payout_expected)}</td><td class="r">${f.payout_received != null ? inr(f.payout_received) : '<span class="faint">Not yet</span>'}</td>` : ""}</tr>`).join("")}</tbody></table></div>` : `<div class="empty">${icon("shield", "")}<b>No finance cases yet</b><p>Record a loan application when a buyer asks for finance. It tracks the case to disbursal${money ? " and the DSA payout" : ""}.</p></div>`;
    else if (t === "ins") pane.innerHTML = ins.data.length ? `<div class="scroll-x"><table class="tbl left"><thead><tr><th>Car</th><th>Policy</th><th>Cover</th><th class="r">Premium</th><th>Valid till</th>${money ? '<th class="r">Commission</th>' : ""}</tr></thead><tbody>${ins.data.map((i) => `<tr><td>${esc(i.stock_no)}</td><td>${esc(i.insurer || "—")}<span class="sub">${esc(INS_KIND[i.kind] || sentence(i.kind))}</span></td><td>${esc(COVER[i.cover] || "—")}</td><td class="r">${i.premium ? inr(i.premium) : "—"}</td><td>${dateFmt(i.expiry_date, false)}</td>${money ? `<td class="r">${i.commission_expected != null ? inr(i.commission_expected) : "—"}${i.commission_received ? ` <span class="pill pos">${icon("check", "")}Received</span>` : ""}</td>` : ""}</tr>`).join("")}</tbody></table></div>` : `<div class="empty">${icon("shield", "")}<b>No policies yet</b></div>`;
    else pane.innerHTML = gap.length ? `<div class="pad-box"><div class="callout">${icon("info", "")}<div><b>${num(gap.length)} delivered deals have no finance and no insurance through us.</b><p>Call these buyers: renewals, extended warranty and their next car are all open conversations.</p></div></div></div><div class="scroll-x"><table class="tbl left"><thead><tr><th>Buyer</th><th>Car</th><th>Delivered</th><th>Salesman</th></tr></thead><tbody>${gap.slice(0, 40).map((d) => `<tr class="row-btn" tabindex="0" data-deal="${d.id}"><td>${esc(d.buyer)}</td><td>${esc(d.car.make)} ${esc(d.car.model)}<span class="sub">${esc(d.car.stock_no)}</span></td><td>${dateFmt(d.invoice_date, false)}</td><td>${esc(d.salesman || "—")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${icon("check", "")}<b>Every delivered deal took finance or insurance</b></div>`;
  };
  bindTabs(ctx.root, (t) => { history.replaceState(null, "", `#/fi?tab=${t}`); show(t); });
  show(tab);
  pane.addEventListener("click", (e) => { const r = e.target.closest("[data-deal]"); if (r) location.hash = `#/deals?deal=${r.dataset.deal}`; });
  pane.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.closest("[data-deal]")?.click(); });
  ctx.root.querySelector("#add-fin").addEventListener("click", () => {
    formDrawer({ title: "Add finance case", submit: "Add case", ok: "Finance case added",
      fields: [{ name: "deal_id", label: "Deal", type: "select", required: true, full: true, options: deals.data.concat([]).map((d) => [d.id, `${d.car.stock_no} · ${d.car.make} ${d.car.model} · ${d.buyer}`]) }, { name: "lender", label: "Lender", type: "text", required: true }, { name: "lender_type", label: "Lender type", type: "select", options: [["bank", "Bank"], ["nbfc", "NBFC"], ["other", "Other"]], value: "bank" },
        { name: "loan_amount", label: "Loan amount (₹)", type: "money", required: true }, { name: "tenure_months", label: "Tenure (months)", type: "number", step: 1, min: 1 }, { name: "roi_pct", label: "Interest (% a year)", type: "number", step: 0.01, min: 0 }, { name: "status", label: "Status", type: "select", required: true, options: Object.entries(FIN_ST).map(([k2, v]) => [k2, v[0]]), value: "applied" }, { name: "applied_on", label: "Applied on", type: "date", value: state.today }],
      onSubmit: async (v) => { const b = { ...v, deal_id: +v.deal_id }; for (const x of Object.keys(b)) if (b[x] === null) delete b[x]; await api.post("finance-cases", b); ctx.refresh(); } });
  });
}
