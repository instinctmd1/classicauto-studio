// Approvals: price changes, discounts, test drives and holds that wait for the manager's OK.
// A salesman asks and follows his own requests; the manager (and the owners) approve or reject, oldest first.
// The margin at the asked price appears only for money viewers: the API never sends it to anyone else.
import * as api from "../api.js";
import { get } from "../api.js";
import { state, can, isSuper } from "../state.js";
import { ago, badge, dateFmt, dateTimeFmt, esc, icon, inr, mount, pct } from "../util.js";
import { bindTabs, formDrawer, pageHead, save, tabsHtml } from "../ui.js";

const KIND = { price_change: ["Price change", "tag"], discount: ["Discount", "percent"], test_drive: ["Test drive", "car"], hold: ["Hold the car", "lock"] };
const ST = { approved: ["Approved", "pos"], pending: ["Waiting", "warn"], rejected: ["Rejected", "neg"] };
const short = (n) => String(n || "").replace(/\s*\(demo\)/, "");
const carName = (a) => `${a.stock_no} · ${a.make} ${a.model}${a.variant ? " " + a.variant : ""}`;

export async function render(ctx) {
  const tab = ctx.query.get("tab") === "decided" ? "decided" : "pending";
  const res = await get("approvals");
  if (!ctx.alive()) return;
  const decide = res.can_decide, c = res.counts || {};
  const tabs = [{ id: "pending", label: decide ? "Waiting" : "My requests, waiting", n: c.pending || 0 }, { id: "decided", label: "Decided", n: (c.approved || 0) + (c.rejected || 0) }];
  mount(ctx.root, pageHead({ title: "Approvals",
    sub: decide ? "Price changes, discounts, test drives and holds that need your OK. The oldest request is on top. Approving a price change sets the new asking price straight away."
      : "Ask before you change a price, give a discount, take a car out for a test drive or hold one for a customer. The manager's answer shows here.",
    actions: can("approvals.request") ? `<button class="btn primary" type="button" id="add">${icon("plus")}New request</button>` : "" })
    + `<section class="card flush rise">${tabsHtml(tabs, tab, "Approval lists")}<div id="pane"></div></section>`);
  const pane = ctx.root.querySelector("#pane");
  const show = async (t) => {
    if (t === "pending") { pane.innerHTML = queueHtml(res.data, decide); return; }
    pane.innerHTML = `<div class="skel card"></div>`;
    try { const done = await get("approvals", { status: "decided" }); if (ctx.alive()) pane.innerHTML = decidedHtml(done.data, decide); }
    catch (e) { pane.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not load this list.</b><span class="muted">${esc(e.message)}</span></div></div>`; }
  };
  bindTabs(ctx.root, (t) => { history.replaceState(null, "", `#/approvals${t === "decided" ? "?tab=decided" : ""}`); show(t); });
  pane.addEventListener("click", async (e) => {
    const ap = e.target.closest("[data-ap]"), rj = e.target.closest("[data-rj]");
    if (ap) { const ok = await save(ap, () => api.post(`approvals/${ap.dataset.ap}/approve`, {}), { ok: "Approved" }); if (ok) ctx.refresh(); }
    if (rj) rejectForm(res.data.find((a) => a.id === +rj.dataset.rj), ctx.refresh);
  });
  await show(tab);
  ctx.root.querySelector("#add")?.addEventListener("click", () => requestForm(ctx.refresh));
}

/** "₹6,30,000 · asking ₹6,50,000, 3.1% less" for priced requests; the date for the others. */
function askLine(a) {
  if (a.kind === "test_drive") return `On ${esc(a.until.length > 10 ? dateTimeFmt(a.until) : dateFmt(a.until))}`;
  if (a.kind === "hold") return `Until ${esc(dateFmt(a.until))}`;
  const base = a.asking_at_request ?? a.asking_price;
  const diff = a.change != null && a.change !== 0 ? `, ${inr(Math.abs(a.change))} ${a.change < 0 ? "less" : "more"} (${pct(Math.abs(a.change_pct))})` : "";
  return `${a.kind === "discount" ? "Offer" : "New asking price"} <b>${inr(a.amount)}</b>${base ? ` · asking ${inr(base)}${diff}` : ""}`;
}

function flags(a) {
  const out = [];
  if (a.below_floor) out.push(badge(`Below the floor of ${inr(a.floor_price)}`, "neg"));
  if (a.expected_margin != null) out.push(badge(`Margin at this price ${inr(a.expected_margin)}`, a.expected_margin < 0 ? "neg" : "pos"));
  if (a.car_status && !["available", "booked"].includes(a.car_status)) out.push(badge(`Car is ${a.car_status}`, "info"));
  return out.length ? `<div class="pill-row">${out.join("")}</div>` : "";
}

function queueHtml(list, decide) {
  if (!list.length) return `<div class="empty">${icon("check", "")}<b>Nothing is waiting</b><p>${decide ? "When a salesman asks for a price change, a discount, a test drive or a hold, it lands here." : "Use New request to ask the manager. You will see the answer here."}</p></div>`;
  return `<div class="pad-box stack-form">${list.map((a) => {
    const own = a.requested_by === state.user.id && !isSuper();
    const who = [a.requested_by_name && `Asked by ${short(a.requested_by_name)}`, ago(a.requested_at), a.lead_name && `for ${a.lead_name}`, a.person_name && `for ${a.person_name}`].filter(Boolean).map(esc).join(" · ");
    return `<article class="queue-card"><div class="hd"><div><b class="ap-t">${icon(KIND[a.kind][1], "ico")}${esc(KIND[a.kind][0])} · ${esc(carName(a))}</b><div class="muted">${who}</div></div>${badge(ST[a.status][0], ST[a.status][1])}</div>
      <div>${askLine(a)}</div>${a.note ? `<div class="muted">“${esc(a.note)}”</div>` : ""}${flags(a)}
      <div class="pill-row">${decide && !own ? `<button class="btn sm pos" type="button" data-ap="${a.id}">${icon("check")}Approve</button><button class="btn sm danger" type="button" data-rj="${a.id}">Reject</button>` : `<span class="muted">${own ? "Your own request: another manager or an owner decides it." : "Waiting for the manager."}</span>`}<a class="btn sm" href="#/inventory?car=${a.car_id}">${icon("car")}Car file</a></div></article>`;
  }).join("")}</div>`;
}

function decidedHtml(list, decide) {
  if (!list.length) return `<div class="empty">${icon("history", "")}<b>Nothing decided yet</b><p>Approved and rejected requests are kept here with who decided and why.</p></div>`;
  return `<div class="scroll-x"><table class="tbl left zebra ap-done"><thead><tr><th>Decided</th><th>Request</th><th>Car</th>${decide ? "<th>Asked by</th>" : ""}<th>Answer</th><th>By</th><th>Note</th></tr></thead><tbody>${list.map((a) => `<tr><td>${esc(dateFmt(a.decided_at, false))}</td><td>${esc(KIND[a.kind][0])}<span class="sub">${askLine(a)}</span></td><td>${esc(carName(a))}</td>${decide ? `<td>${esc(short(a.requested_by_name || ""))}</td>` : ""}<td>${badge(ST[a.status][0], ST[a.status][1])}</td><td>${esc(short(a.decided_by_name || ""))}</td><td>${esc(a.decision_note || "")}</td></tr>`).join("")}</tbody></table></div>`;
}

function rejectForm(a, refresh) {
  if (!a) return;
  formDrawer({ title: "Reject this request", sub: `${esc(KIND[a.kind][0])} · ${esc(carName(a))}`, submit: "Reject", ok: "Rejected", danger: true,
    fields: [{ name: "reason", label: "Why", type: "textarea", required: true, full: true, hint: "The salesman sees this." }],
    onSubmit: async (v) => { await api.post(`approvals/${a.id}/reject`, v); refresh(); } });
}

async function requestForm(refresh) {
  const cars = await get("cars", { page_size: 200, scope: "all" });
  const stock = cars.data.filter((c) => ["incoming", "refurb", "available", "booked"].includes(c.status));
  const fields = [
    { name: "kind", label: "What do you need?", type: "select", required: true, full: true, value: "discount", options: Object.entries(KIND).map(([k, v]) => [k, v[0]]) },
    { name: "car_id", label: "Car", type: "select", required: true, full: true, options: stock.map((c) => [c.id, `${c.stock_no} · ${c.make} ${c.model} · ${c.asking_price ? inr(c.asking_price) : "no price"} · ${c.status}`]) },
    { name: "amount", label: "Price (₹)", type: "money", hint: "For a discount, the price you want to offer. For a price change, the new asking price." },
    { name: "when", label: "When", type: "datetime-local", hint: "When the customer wants the test drive." },
    { name: "until", label: "Hold until", type: "date", hint: "The last day the car stays off sale for this customer." },
    { name: "note", label: "Note for the manager", type: "textarea", full: true, placeholder: "Who the customer is and why" },
  ];
  const d = formDrawer({ title: "Ask the manager", sub: "The manager or an owner approves it. Every request and answer is logged.", fields, submit: "Send request", ok: "Request sent",
    onSubmit: async (v) => {
      const body = { kind: v.kind, car_id: v.car_id ? +v.car_id : null, note: v.note };
      if (v.kind === "price_change" || v.kind === "discount") body.amount = v.amount;
      else if (v.kind === "test_drive") body.until = v.when;
      else body.until = v.until;
      try { await api.post("approvals", body); }
      catch (ex) { if (ex.fields?.until && v.kind === "test_drive") ex.fields = { ...ex.fields, when: ex.fields.until }; throw ex; }
      refresh();
    } });
  const show = () => {
    const k = d.form.querySelector('[name="kind"]').value;
    const vis = { amount: k === "price_change" || k === "discount", when: k === "test_drive", until: k === "hold" };
    for (const [n, on] of Object.entries(vis)) { const f = d.form.querySelector(`[name="${n}"]`)?.closest(".field"); if (f) f.hidden = !on; }
  };
  d.form.querySelector('[name="kind"]').addEventListener("change", show);
  show();
}
