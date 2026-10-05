// Park-N-Sell register: cars we sell for owners. The owner keeps the title; the firm earns the commission.
import * as api from "../api.js";
import { get } from "../api.js";
import { state, can } from "../state.js";
import { badge, dateFmt, esc, icon, inr, lakh, mount, num, sentence } from "../util.js";
import { formDrawer, openDrawer, pageHead } from "../ui.js";
import { bankField, bankPick, card, commissionText, kpiTile } from "./_shared.js";
import { PAY_MODES } from "../lists.js";

const ST = { active: ["Active", "info"], sold: ["Sold", "pos"], withdrawn: ["Withdrawn", ""], expired: ["Expired", "neg"], closed: ["Closed", ""] };
let view = "active";

export async function render(ctx) {
  const res = await get("consignments");
  if (!ctx.alive()) return;
  const rows = res.data, money = can("money.view");
  const active = rows.filter((r) => r.status === "active");
  const soon = active.filter((r) => r.expires_in_days != null && r.expires_in_days <= (state.settings?.alert_consignment_days || 15));
  const owed = rows.filter((r) => r.status === "sold" && !r.payout_date);
  const noRc = active.filter((r) => !r.original_rc_held).length;
  view = ctx.query.get("status") || "active";
  mount(ctx.root, pageHead({ title: "Park-N-Sell", sub: "Cars the firm sells for owners. Track the agreement, who holds the RC and keys, and the payout once sold." })
    + `<div class="kpis four">${[
      kpiTile({ label: "Active agreements", value: active.length, sub: `${num(rows.length)} on the register` }),
      kpiTile({ label: "Ending soon", value: soon.length, neg: soon.length > 0, sub: `Within ${state.settings?.alert_consignment_days || 15} days` }),
      kpiTile({ label: "Owners to pay", value: owed.length, neg: owed.length > 0, sub: money ? `${lakh(owed.reduce((s, r) => s + (r.consignor_payout || 0), 0))} due` : "Sold, payout not made" }),
      kpiTile({ label: "RC not with us", value: noRc, sub: "Active cars where the owner holds the original RC" }),
    ].join("")}</div>
    <section class="card flush rise sec-gap"><div class="toolbar pad-top"><div class="seg" id="seg" role="group" aria-label="Show"></div></div><div id="tb"></div></section>`);
  const draw = () => {
    ctx.root.querySelector("#seg").innerHTML = [["active", "Active", active.length], ["sold", "Sold", rows.filter((r) => r.status === "sold").length], ["all", "All", rows.length]].map(([k, l, n]) => `<button type="button" aria-pressed="${view === k}" data-v="${k}">${l}<span class="n">${n}</span></button>`).join("");
    const list = rows.filter((r) => view === "all" || r.status === view);
    ctx.root.querySelector("#tb").innerHTML = list.length ? `<div class="scroll-x"><table class="tbl left"><thead><tr><th>Car</th><th>Owner</th><th>Agreement</th><th class="r">Reserve</th>${money ? '<th class="r">Our commission</th>' : ""}<th>Papers held</th><th>Status</th></tr></thead><tbody>${list.map((r) => `<tr class="row-btn" tabindex="0" data-k="${r.id}"><td>${esc(r.car?.make || "")} ${esc(r.car?.model || "")}<span class="sub">${esc(r.car?.stock_no || "")} · parked ${num(r.days_parked)} d</span></td><td>${esc(r.consignor || "—")}</td><td>${dateFmt(r.agreement_date, false)} to ${dateFmt(r.agreement_expiry, false)}${r.status === "active" && r.expires_in_days != null ? `<span class="sub ${r.expires_in_days < 0 ? "neg-text" : r.expires_in_days <= 15 ? "warn-text" : ""}">${r.expires_in_days < 0 ? Math.abs(r.expires_in_days) + " days past" : r.expires_in_days + " days left"}</span>` : ""}</td><td class="r">${inr(r.reserve_price)}</td>${money ? `<td class="r">${r.commission_value_inr != null ? inr(r.commission_value_inr) : "—"}</td>` : ""}<td>${r.original_rc_held ? badge("RC", "pos") : badge("No RC", "warn")} ${r.keys_held ? badge("Keys", "pos") : badge("No keys", "warn")} ${r.form29c_filed_on ? badge("29C", "pos") : badge("29C due", "neg")}</td><td>${badge(ST[r.status]?.[0] || sentence(r.status), ST[r.status]?.[1])}${r.status === "sold" && !r.payout_date ? ` <span class="pill warn">Payout due</span>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${icon("repeat", "")}<b>Nothing here</b><p>Add a Park-N-Sell car from Stock; its agreement shows up on this register.</p></div>`;
  };
  draw();
  ctx.root.addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (b) { view = b.dataset.v; draw(); } const r = e.target.closest("[data-k]"); if (r) openKon(rows.find((x) => x.id === +r.dataset.k), ctx, money); });
  ctx.root.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.closest("[data-k]")?.click(); });
}

function openKon(k, ctx, money) {
  const d = openDrawer({ title: `${k.car?.make || ""} ${k.car?.model || ""}`, sub: `${esc(k.car?.stock_no || "")} · ${esc(k.consignor || "")}`, body: "" });
  const kv = (l, v) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
  d.setBody(`${kv("Agreement", `${dateFmt(k.agreement_date)} to ${dateFmt(k.agreement_expiry)}`)}${kv("Reserve price", inr(k.reserve_price))}${kv("Asking price", inr(k.car?.asking_price))}${kv("Commission", commissionText(k, true))}${money && k.commission_value_inr != null ? kv(k.status === "sold" ? "Commission earned" : "At the asking price we earn", inr(k.commission_value_inr)) : ""}${kv("Parking fee", k.parking_fee_monthly ? inr(k.parking_fee_monthly) + " a month" : "None")}${kv("Original RC with us", k.original_rc_held ? "Yes" : "No")}${kv("Keys with us", k.keys_held ? "Yes" : "No")}${kv("Form 29C filed", k.form29c_filed_on ? dateFmt(k.form29c_filed_on) : "Not yet")}${k.status === "sold" ? kv("Payout to the owner", k.payout_date ? `${inr(k.payout_amount)} on ${dateFmt(k.payout_date)}` : money && k.consignor_payout != null ? `${inr(k.consignor_payout)} due` : "Due") : ""}
    <div class="sec"><a class="btn" href="#/inventory?car=${k.car_id}">${icon("car")}Open the car file</a></div>`);
  const foot = [];
  foot.push(`<button class="btn" type="button" data-a="edit">${icon("edit")}Update papers held</button>`);
  if (k.status === "sold" && !k.payout_date && can("accounts.manage")) foot.push(`<button class="btn primary" type="button" data-a="pay">Record payout</button>`);
  d.setFoot(foot.join(""));
  d.el.addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    d.close(true);
    if (a === "edit") formDrawer({ title: "Update papers held", submit: "Save", ok: "Saved", fields: [{ name: "original_rc_held", label: "We hold the original RC", type: "checkbox", value: k.original_rc_held }, { name: "keys_held", label: "We hold the keys", type: "checkbox", value: k.keys_held }, { name: "form29c_filed_on", label: "Form 29C filed on", type: "date", value: k.form29c_filed_on || "" }, { name: "agreement_expiry", label: "Agreement ends", type: "date", value: k.agreement_expiry || "" }],
      onSubmit: async (v) => { await api.patch(`consignments/${k.id}`, v); ctx.refresh(); } });
    if (a === "pay") bankPick().then((bank) => formDrawer({ title: "Record payout to the owner", sub: `${esc(k.consignor || "")}${k.consignor_payout != null ? ` · ${inr(k.consignor_payout)} due` : ""}`, submit: "Record payout", ok: "Payout recorded", fields: [{ name: "amount", label: "Amount (₹)", type: "money", required: true, value: k.consignor_payout ?? "" }, { name: "mode", label: "Paid by", type: "select", required: true, options: PAY_MODES, value: "neft_rtgs" }, { name: "date", label: "Date", type: "date", value: state.today }, ...(bankField(bank, "bank_account_id", "Paid from", "The bank account the money left. Leave empty for cash.") ? [bankField(bank, "bank_account_id", "Paid from", "The bank account the money left. Leave empty for cash.")] : []), { name: "reference", label: "Reference", type: "text" }],
      onSubmit: async (v) => { const b = v.mode === "cash" || !v.bank_account_id ? null : +v.bank_account_id; delete v.bank_account_id; await api.post(`consignments/${k.id}/payout`, { ...v, ...(b ? { bank_account_id: b } : {}) }); ctx.refresh(); } }));
  });
}
