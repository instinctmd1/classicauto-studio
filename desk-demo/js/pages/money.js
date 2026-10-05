// Profit and loss: the gross-to-net ledger, monthly profit, margin trend, per-car profit, Park-N-Sell commissions, money owed.
// Closed to everyone without money.view; the API refuses it too.
import { get } from "../api.js";
import { state, can, pnlWindow, periodLabel, compareLabel, isMonthPeriod } from "../state.js";
import { badge, dateFmt, esc, icon, inr, lakh, monthLabel, mount, num, pct, sentence, statusBadge } from "../util.js";
import { alpha, catAxis, gridBox, legendBox, mountChart, moneyAxisFmt, profitByMonthOption, tipHtml, tooltip, valAxis } from "../charts.js";
import { pageHead } from "../ui.js";
import { openDeal } from "./deals.js";
import { catLabel } from "../lists.js";
import { col, cellMain, columnsButton, exportButtons, makeGrid } from "../grid.js";
import { card, delta, kpiTile, pts } from "./_shared.js";

export async function render(ctx) {
  const p = ctx.period, win = pnlWindow(p);
  const k = await get("kpis", { period: p });
  const [pnl, deals, g2n] = await Promise.all([get("pnl", { from: win.from, to: win.to }), can("deals.view") ? get("deals", { status: "delivered", from: k.period.from, to: k.period.to, page_size: 200 }).catch(() => null) : null, can("accounts.view") ? get("accounts/pnl", { from: k.period.from.slice(0, 7), to: k.period.to.slice(0, 7) }).catch(() => null) : null]);   // the gross-to-net block is the books: it needs accounts.view as well as money.view
  if (!ctx.alive()) return;
  const K = k.kpis, B = k.breakdown || {}, months = pnl.months || [], cmp = compareLabel(k.compare);
  const gp = months.map((m) => (m.car_gp || 0) + (m.pns_gp || 0));
  const gpNow = (B.car_gp || 0) + (B.pns_gp || 0);
  const rows = deals ? deals.data : [];          // an accountant holds the books but not the deal list
  const pnsRows = rows.filter((r) => r.car?.ownership === "park_n_sell");
  const tiles = [
    kpiTile({ label: "Revenue", value: K.turnover?.value, kind: "money", delta: K.turnover?.delta_pct, spark: months.map((m) => m.turnover), sub: `${esc(cmp)}: ${esc(lakh(K.turnover?.prev))}` }),
    kpiTile({ label: "Gross profit", value: gpNow, kind: "money", delta: isMonthPeriod(p) && months.length > 1 ? delta(gp[gp.length - 1], gp[gp.length - 2]) : null, spark: gp, sub: "Cars plus commission, before overheads" }),
    kpiTile({ label: "Net profit", value: K.net_profit?.value, kind: "money", delta: K.net_profit?.delta_pct, spark: K.net_profit?.spark, neg: K.net_profit?.value < 0, sub: `After ${esc(lakh(B.overheads))} overheads and ${esc(lakh(B.marketing))} marketing` }),
    kpiTile({ label: "Gross margin", value: K.gross_margin_pct?.value, kind: "pct", delta: pts(K.gross_margin_pct?.value, K.gross_margin_pct?.prev), deltaUnit: " pts", sub: `Net margin ${pct(K.net_margin_pct?.value)}` }),
    kpiTile({ label: "Profit per car", value: K.gpu?.value, kind: "money", delta: K.gpu?.delta_pct, sub: K.gpu?.gpu_total != null ? `${esc(lakh(K.gpu.gpu_total))} with finance and insurance` : "Average gross profit" }),
    kpiTile({ label: "Commission earned", value: K.pns_commission?.value, kind: "money", delta: K.pns_commission?.delta_pct, sub: `Before costs. ${esc(lakh(B.pns_gp))} after costs and incentives${K.pns_commission?.avg_pct != null ? ` · ${pct(K.pns_commission.avg_pct)} of sale price` : ""}` }),
  ].join("");

  const money = (v) => `<span class="${v < 0 ? "neg" : ""}">${inr(v)}</span>`;
  const active = months.filter((m) => m.units || m.overheads || m.turnover);
  const stmt = `<div class="scroll-x"><table class="tbl"><thead><tr><th>Month</th><th>Cars</th><th>Turnover</th><th>Car profit</th><th>Commission after costs</th><th>Fin. and ins.</th><th>Overheads</th><th>Marketing</th><th>Net profit</th></tr></thead><tbody>${active.slice().reverse().map((m) => `<tr><td>${monthLabel(m.month)}</td><td>${num(m.units)}</td><td>${inr(m.turnover)}</td><td>${inr(m.car_gp)}</td><td>${inr(m.pns_gp)}</td><td>${inr(m.fi_income)}</td><td>${inr(m.overheads)}</td><td>${inr(m.marketing)}</td><td><b>${money(m.net_profit)}</b></td></tr>`).join("")}</tbody>
    <tfoot><tr><td>12 months</td><td>${num(active.reduce((s, m) => s + m.units, 0))}</td><td>${inr(sum(active, "turnover"))}</td><td>${inr(sum(active, "car_gp"))}</td><td>${inr(sum(active, "pns_gp"))}</td><td>${inr(sum(active, "fi_income"))}</td><td>${inr(sum(active, "overheads"))}</td><td>${inr(sum(active, "marketing"))}</td><td>${money(sum(active, "net_profit"))}</td></tr></tfoot></table></div>`;

  const owed = `<div class="kv"><span>Customers still owe us</span><b>${inr(K.receivables?.value)}</b></div><div class="kv"><span>We owe Park-N-Sell owners</span><b>${inr(K.payable_to_consignors?.value)}</b></div><div class="kv"><span>Capital locked in stock</span><b>${inr(K.capital_locked?.value)}</b></div><div class="kv"><span>Holding cost this period</span><b>${inr(K.holding_cost?.value)}</b></div>
    <div class="kv"><span>Finance attach rate</span><b>${pct(K.attach_finance_pct?.value)}</b></div><div class="kv"><span>Insurance attach rate</span><b>${pct(K.attach_insurance_pct?.value)}</b></div><div class="kv"><span>Finance and insurance income</span><b>${inr(B.fi?.total)}</b></div>`;
  const pnsList = !deals ? denied("Park-N-Sell sales are listed for people who can open Deals.") : pnsRows.length ? `<ul class="list">${pnsRows.map((r) => `<li><a class="grow" href="#/deals?deal=${r.id}"><div class="t">${esc(r.car.make)} ${esc(r.car.model)}</div><div class="s">${esc(r.car.stock_no)} · sold ${dateFmt(r.invoice_date)} for ${inr(r.sale_price)}</div></a><b>${inr(r.pns_commission)}</b></li>`).join("")}</ul>` : `<div class="empty">${icon("car", "")}<b>No Park-N-Sell sales in this period</b><p>Commission shows here when a consigned car is delivered.</p></div>`;

  mount(ctx.root, pageHead({ title: "Profit and loss", sub: `${esc(periodLabel(p))}. Profit is what is left after the car, its costs, GST on margin and the salesman's incentive.`, actions: `<button class="btn" type="button" id="print">${icon("print")}Print</button>` })
    + `<div class="kpis six">${tiles}</div>
    <div class="g">${g2n ? ledgerCard(g2n, periodLabel(p)) : ""}<div class="stack-cards ${g2n ? "c7" : "c12"}">${card({ title: "Profit by month", sub: "Gross and net profit. Turnover is the faint dashed line, on its own scale", body: `<div class="chart" id="ch-m"></div>` })}${card({ title: "Margin trend", sub: "Gross margin on invested cars and net margin on turnover", body: `<div class="chart short" id="ch-mg"></div>` })}</div></div>
    <div class="g">${deals ? card({ title: "Cars sold", sub: `${num(rows.length)} delivered in ${esc(periodLabel(p))}. Click a row for the deal.`, cls: "c12", flush: true, actions: "<span id='ga'></span>", body: `<div class="grid-wrap"><div id="grid"></div></div>` }) : card({ title: "Cars sold", cls: "c12", body: denied("The car-by-car list is for people who can open Deals. The totals above still count every delivered car.") })}</div>
    <div class="g">${card({ title: "Park-N-Sell commissions", sub: "Cars we sold for owners. The firm earns the commission only.", cls: "c5", body: pnsList })}${card({ title: "Money owed and attach rates", cls: "c7", body: owed })}</div>
    ${card({ title: "Monthly statement", sub: "Accrual basis. Finance and insurance count when the deal is delivered.", body: stmt })}`);
  ctx.root.querySelector("#print").addEventListener("click", () => window.print());

  const labels = months.map((m) => monthLabel(m.month, false)), sel = isMonthPeriod(p) ? months.findIndex((m) => m.month === p) : months.length - 1;
  mountChart(document.getElementById("ch-m"), (t, narrow) => profitByMonthOption(t, months, labels, sel, monthLabel, narrow), "Gross and net profit by month, with turnover as a dashed reference line");
  const gm = months.map((m) => m.gross_margin_pct), nm = months.map((m) => (m.turnover ? (m.net_profit / m.turnover) * 100 : null));
  mountChart(document.getElementById("ch-mg"), (t) => ({
    grid: gridBox({ top: 34 }), legend: legendBox(t),
    tooltip: tooltip(t, (ps) => tipHtml(monthLabel(months[ps[0].dataIndex].month), ps.map((s) => ({ color: s.color, label: s.seriesName, value: s.value == null ? "—" : pct(s.value) })))),
    xAxis: catAxis(t, labels), yAxis: valAxis(t, (v) => v + "%"),
    series: [{ name: "Gross margin", type: "line", smooth: 0.3, connectNulls: true, symbolSize: 7, lineStyle: { width: 3, color: t.lux }, itemStyle: { color: t.lux }, data: gm },
      { name: "Net margin", type: "line", smooth: 0.3, connectNulls: true, symbolSize: 7, lineStyle: { width: 3, color: t.navy }, itemStyle: { color: t.navy }, data: nm }],
  }), "Gross and net margin by month");

  const grid = deals && makeGrid(ctx.root.querySelector("#grid"), {
    data: rows, initialSort: [{ column: "invoice_date", dir: "desc" }], placeholder: "No cars were delivered in this period.",
    columns: [
      col.html("car", "Car", { frozen: true, minWidth: 200, sorter: (a, b) => `${a.make}${a.model}`.localeCompare(`${b.make}${b.model}`), formatter: (c) => { const v = c.getValue(); return cellMain(`${v.make} ${v.model}`, `${v.stock_no} · ${v.variant || ""}`); } }),
      col.date("invoice_date", "Delivered", { width: 118 }),
      col.html("car_seg", "Segment", { width: 120, formatter: (c) => { const o = c.getData().car.ownership; return badge(o === "invested" ? "Invested" : "Park-N-Sell", o === "invested" ? "ink" : "info"); }, sorter: (a, b, ra, rb) => ra.getData().car.ownership.localeCompare(rb.getData().car.ownership) }),
      col.text("buyer", "Buyer", { minWidth: 150 }), col.text("salesman", "Salesman", { minWidth: 130 }),
      col.money("sale_price", "Sale price", { width: 126 }),
      col.money("gross_profit", "Profit", { width: 120, formatter: (c) => `<b class="${c.getValue() < 0 ? "neg" : ""}">${inr(c.getValue())}</b>` }),
      col.pct("margin", "Margin", { width: 96, mutator: (v, d) => (d.car?.ownership === "invested" && d.sale_price ? (d.gross_profit / d.sale_price) * 100 : null), formatter: (c) => (c.getValue() == null ? '<span class="faint">—</span>' : pct(c.getValue())) }),
      col.int("days_to_sell", "Days to sell", { width: 112 }),
      col.money("pns_commission", "Commission", { width: 120, formatter: (c) => (c.getValue() == null ? '<span class="faint">—</span>' : inr(c.getValue())) }),
    ],
    onRowClick: (r) => openDeal(r.id),
  });
  if (grid) ctx.root.querySelector("#ga").replaceWith(columnsButton(() => grid), ...(can("exports.money") ? [exportButtons(() => grid, `classic-auto-sales-${p}`, "money")] : []));
  const want = ctx.query.get("deal");
  if (want) openDeal(+want);
}
const denied = (why) => `<div class="empty">${icon("lock", "")}<b>Not part of your access</b><p>${esc(why)}</p></div>`;
const sum = (a, f) => a.reduce((s, x) => s + (x[f] || 0), 0);



// ------------------------------------------------------------------ gross-to-net ledger (the reel's layout: gross, discounts, net, costs, gross profit, overheads, net profit)
function addUp(months) {
  const t = { expenses: {}, fi: 0 };
  const keys = ["gross_sale_value", "discounts", "net_sales", "cancellations", "refunds_paid", "purchase_cost", "reconditioning_and_costs", "gst_on_margin", "salesman_incentives", "car_gp", "pns_commission", "pns_costs", "pns_incentives", "pns_gp", "gross_profit", "overheads", "marketing", "net_profit"];
  keys.forEach((k) => (t[k] = months.reduce((s, m) => s + (m[k] || 0), 0)));
  months.forEach((m) => { t.fi += m.fi?.total || 0; for (const [c, v] of Object.entries(m.expenses || {})) t.expenses[c] = (t.expenses[c] || 0) + v; });
  t.check = months.every((m) => m.check !== false);
  return t;
}
function ledgerCard(res, label) {
  const t = addUp(res.months || []);
  const ln = (cls, lab, v, small = "") => `<div class="ln ${cls}"><span class="lab">${lab}${small ? `<small>${small}</small>` : ""}</span><b>${cls === "minus" ? "−" : ""}${inr(Math.abs(v))}</b></div>`;
  const exp = Object.entries(t.expenses).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
  const body = `<div class="g2n">
    ${ln("", "Gross sale value", t.gross_sale_value, "What the buyers agreed to pay")}
    ${ln("minus", "Negotiated discounts", t.discounts)}
    ${ln("sub", "Net sales", t.net_sales)}
    ${t.cancellations || t.refunds_paid ? ln("minus", "Cancellations and refunds", t.cancellations + t.refunds_paid) : ""}
    ${ln("minus", "Purchase cost of the cars", t.purchase_cost)}
    ${ln("minus", "Workshop and reconditioning", t.reconditioning_and_costs)}
    ${ln("minus", "GST on margin", t.gst_on_margin)}
    ${ln("minus", "Salesman incentives", t.salesman_incentives)}
    ${ln("sub", "Car gross profit", t.car_gp)}
    ${ln("", "Commission after costs and incentives", t.pns_gp, `${inr(t.pns_commission)} earned, less ${inr(t.pns_costs)} of costs and ${inr(t.pns_incentives)} of incentives`)}
    ${ln("", "Finance and insurance income", t.fi)}
    ${ln("sub", "Gross profit", t.gross_profit)}
    ${exp.map(([c, v]) => ln("minus", catLabel(c), v)).join("")}
    ${ln("minus", "Marketing", t.marketing)}
    <div class="ln total${t.net_profit < 0 ? " neg" : ""}"><span class="lab">Net profit</span><b class="${t.net_profit < 0 ? "neg-text" : ""}">${t.net_profit < 0 ? "−" : ""}${inr(Math.abs(t.net_profit))}</b></div>
  </div>
  <p class="note sec">${icon(t.check ? "check" : "alert", "")}<span>${t.check ? "Ties to the deals, the approved expenses and the profit cards above." : "Does not tie to the profit cards. Check unapproved expenses and cancelled deals."}</span></p>`;
  return card({ title: "From sale to net profit", sub: `${esc(label)}. Read top to bottom, like the books.`, cls: "c5", body });
}
