// Car intake (classic-auto/accountability-6oct/SPEC-CAR-INTAKE.md 3.1, 4.5, 6.6): the New car and Car sold formats as a
// step-by-step form. Phone-first: one question per row, big inputs, drafts save themselves 1.5 s after the last change.
// The same draft can be started in Ask Claude (paste the format) and finished here, and the other way round.
// Money is never in a draft or in browser storage: the owner step posts it on its own, from a money login only.
import * as api from "../api.js";
import { ApiError, DEMO } from "../api.js";
import * as desk from "../desk-api.js";
import { state, can } from "../state.js";
import { badge, dateFmt, debounce, esc, icon, safeStore } from "../util.js";
import { confirmDialog, openDrawer, pageHead, save, toast } from "../ui.js";

const MUST = [["E01", "Front three-quarter, driver's side (the hero photo)"], ["E03", "Side profile, driver's side"], ["E05", "Rear three-quarter, driver's side"],
  ["E08", "Straight rear"], ["I01", "Dashboard, wide, from the middle of the back seat, ignition on"], ["I08", "Rear seats through the rear door, driver's side"],
  ["O01", "Odometer close-up, every digit readable"], ["K01", "Boot open and empty"]];
const STEPS_NEW = [["car", "Car"], ["specs", "Specs"], ["condition", "Condition"], ["papers", "Papers"], ["seller", "Seller and line"],
  ["photos", "Photos"], ["price", "Price and website"], ["owner", "Owner"], ["check", "Check and send"]];
const STEPS_SOLD = [["car", "Car and stage"], ["buyer", "Buyer"], ["price", "Price and payments"], ["papers", "Papers and transfer"], ["check", "Check and send"]];
const PAPERS = [["rc", "RC, front and back", "rc"], ["insurance", "Insurance policy", "insurance"], ["puc", "PUC certificate", "puc"],
  ["form29", "Form 29, 2 copies signed by the seller", "form29"], ["form30", "Form 30, 2 copies signed by the seller", "form30"],
  ["form29c", "Form 29C (dealer custody intimation)", "form29c"], ["seller_kyc", "Seller KYC (PAN, masked Aadhaar, photo ID, address proof)", "pan"],
  ["purchase_agreement", "Purchase agreement or delivery receipt", "purchase_agreement"], ["consignment_agreement", "Consignment agreement (Park & Sell)", "consignment_agreement"],
  ["form35", "Form 35 (loan on the RC)", "form35"], ["bank_noc", "Bank NOC or loan closure letter", "bank_noc"], ["form28", "Form 28 (outside Maharashtra)", "form28"],
  ["rto_noc", "RTO NOC (outside Maharashtra)", "rto_noc"], ["service_history", "Service book or bills", "service_history"],
  ["original_invoice", "Original purchase invoice", "original_invoice"], ["warranty", "Warranty card", "warranty"], ["inspection_report", "Outside inspection report", "inspection_report"]];
// The static demo answers from the in-memory sample store (desk-mock-intake.js); the live app talks to /api as before.
const io = DEMO ? { get: desk.get, post: desk.post, patch: (p, b) => desk.send("PATCH", p, b), del: desk.del, upload: desk.upload } : api;
const OWNER_DOCS = new Set(["purchase_agreement", "payment_proof", "valuation", "bill"]);
const FEATURES = ["Panoramic sunroof", "Sunroof", "Alloy wheels", "360-degree camera", "Rear camera", "ADAS", "Ventilated seats", "All-wheel drive", "Four-wheel drive",
  "Cruise control", "Leather seats", "Wireless charging", "Apple CarPlay / Android Auto", "Head-up display", "Powered tailgate", "Memory seats", "Powered seats", "Air purifier"];
const CH = {
  fuel: [["petrol", "Petrol"], ["diesel", "Diesel"], ["cng", "CNG"], ["petrol_cng", "Petrol+CNG"], ["hybrid", "Hybrid"], ["electric", "Electric"]],
  transmission: [["manual", "Manual"], ["automatic", "Automatic"]], trans_detail: [["MT", "MT"], ["AT", "AT"], ["AMT", "AMT"], ["DCT", "DCT"], ["CVT", "CVT"], ["IVT", "IVT"]],
  body_type: [["hatchback", "Hatchback"], ["sedan", "Sedan"], ["suv", "SUV"], ["mpv", "MPV"], ["luxury-sedan", "Luxury sedan"], ["luxury-suv", "Luxury SUV"]],
  location: [["showroom", "Showroom"], ["yard", "Yard"], ["workshop", "Workshop"]], reg_type: [["individual", "Individual"], ["company", "Company"]],
  insurance_type: [["comprehensive", "Comprehensive"], ["zero_dep", "Zero dep"], ["third_party", "Third party"], ["none", "None"]],
  service_record: [["full", "Full"], ["partial", "Partial"], ["none", "None"], ["not_seen", "Not seen"]],
  ownership: [["invested", "Bought by us"], ["park_n_sell", "Park & Sell"]],
  source: [["walk_in_seller", "Individual"], ["dealer_trade", "Dealer"], ["exchange", "Exchange"], ["auction", "Auction"], ["broker", "Broker"]],
  list_on_site: [["now", "Now"], ["after_work", "After the work"], ["no", "No"]], stage: [["booked", "Booked (token taken)"], ["delivered", "Delivered (car has left)"]],
  buyer_type: [["individual", "Individual"], ["company", "Company"], ["dealer", "Dealer"]],
  insurance_transfer: [["not_started", "Not started"], ["applied", "Applied"], ["done", "Done"]],
  rc_transfer: [["not_started", "Not started"], ["with_agent", "Papers with agent"], ["submitted", "Submitted to RTO"], ["done", "Done"]],
  buyer_kyc: [["got", "Got"], ["follow", "To follow"]], yesno: [["yes", "Yes"], ["no", "No"]],
};
const PAY = [["cash", "Cash"], ["upi", "UPI"], ["neft_rtgs", "NEFT / RTGS"], ["imps", "IMPS"], ["cheque", "Cheque"], ["dd", "DD"], ["card", "Card"]];
const COST_CAT = ["mechanical", "denting_painting", "detailing", "tyres", "battery", "parts", "electrical", "inspection", "rto_fees", "insurance", "transport", "parking", "challan", "photography", "other"];
const STATE_LABEL = { draft: ["Draft", ""], submitted: ["Waiting for approval", "warn"], saved: ["Saved", "pos"], rejected: ["Not approved", "neg"], cancelled: ["Cancelled", ""] };
const SITE_LABEL = { live: ["On the website", "pos"], on_files: ["On the website files", "info"], waiting: ["Website: sending", "warn"], problem: ["Website: waiting for the tech admin", "neg"], not_listed: ["Not on the website", ""] };

// ------------------------------------------------------------------ money words (exact rupees only; the server checks again)
const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const two = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : ""));
const three = (n) => [Math.floor(n / 100) ? ONES[Math.floor(n / 100)] + " hundred" : "", n % 100 ? two(n % 100) : ""].filter(Boolean).join(" ");
export function inWords(n) {
  if (!Number.isInteger(n) || n <= 0) return "";
  const out = []; let r = n;
  for (const [size, name] of [[1e7, "crore"], [1e5, "lakh"], [1e3, "thousand"]]) { const q = Math.floor(r / size); r %= size; if (q) out.push((q < 1000 ? three(q) : inWords(q)) + " " + name); }
  if (r) out.push(three(r));
  return out.join(" ");
}
/** "12,45,000" / "₹12,45,000/-" -> 1245000; anything else (lakh, decimals, ranges) -> NaN */
export function rupees(v) {
  const t = String(v ?? "").trim();
  const m = /^(?:₹|rs\.?|inr)?\s*(\d{1,2}(?:,\d{2})*,\d{3}|\d{1,3}(?:,\d{3})+|\d+)\s*(?:\/-)?$/i.exec(t);
  return m ? Number(m[1].replace(/,/g, "")) : NaN;
}
const inrFmt = (n) => (Number.isFinite(n) ? "₹" + new Intl.NumberFormat("en-IN").format(n) : "");

// ------------------------------------------------------------------ photos: upright, JPEG 0.85, long side <= 2400, no EXIF
export async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
    return blob ? new File([blob], (file.name || "photo").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

// ------------------------------------------------------------------ router entry
export async function render(ctx) {
  if (ctx.id === "new") return startNew(ctx);
  const id = +ctx.id;
  if (!id) return list(ctx);
  return open(ctx, id);
}

async function startNew(ctx) {
  const kind = ctx.query.get("kind") === "sold" ? "sold" : "new_car";
  const body = { kind, via: "form" };
  if (ctx.query.get("car")) body.car_id = +ctx.query.get("car");
  ctx.root.innerHTML = `<div class="skel card"></div>`;
  try {
    const r = await io.post("intakes", body);
    history.replaceState(null, "", `#/intake/${r.id}`);
    ctx.id = String(r.id);
    return open(ctx, r.id);
  } catch (e) {
    ctx.root.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not start the format.</b><span class="muted">${esc(e.message)}</span></div></div>`;
  }
}

// ------------------------------------------------------------------ "Cars in and out"
async function list(ctx) {
  const tab = ["waiting", "mine", "drafts"].includes(ctx.query.get("tab")) ? ctx.query.get("tab") : can("stock.manage") ? "waiting" : "mine";
  const r = await io.get("intakes");
  if (!ctx.alive()) return;
  const all = r.data || [];
  const me = state.user.id;
  const sets = { waiting: all.filter((x) => x.waiting_for_me), mine: all.filter((x) => x.created_by === me && x.state !== "draft"), drafts: all.filter((x) => x.created_by === me && x.state === "draft") };
  const tabs = [...(can("stock.manage") ? [["waiting", "Waiting for you"]] : []), ["mine", "Mine"], ["drafts", "Drafts"]];
  ctx.root.innerHTML = pageHead({ title: "Cars in and out", sub: "Every new car and every sale goes in once, in one format. The dashboard, the papers file and the website are filled from it.",
    actions: `<button class="btn primary" type="button" data-go="#/intake/new?kind=new_car">${icon("plus")}New car</button><button class="btn" type="button" data-go="#/intake/new?kind=sold">${icon("tag")}Car sold</button><button class="btn" type="button" id="fmt">${icon("copy")}Copy the format</button>` })
    + `<section class="card flush rise"><div class="tabs" role="tablist" aria-label="Lists">${tabs.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === tab}" data-tab="${k}">${esc(l)} <span class="n">${sets[k].length}</span></button>`).join("")}</div>
      <ul class="list intake-list">${sets[tab].length ? sets[tab].map(row).join("") : `<li class="empty">Nothing here.</li>`}</ul></section>`;
  ctx.root.addEventListener("click", (e) => {
    const g = e.target.closest("[data-go]"); if (g) location.hash = g.dataset.go;
    const t = e.target.closest("[data-tab]"); if (t) { location.hash = `#/intakes?tab=${t.dataset.tab}`; }
  });
  ctx.root.querySelector("#fmt").addEventListener("click", () => copyFormat("new_car"));
}
function row(x) {
  const [l, c] = STATE_LABEL[x.state] || [x.state, ""];
  const site = x.site_state ? SITE_LABEL[x.site_state] : null;
  const miss = x.missing?.length ? `<span class="muted">${x.missing.length} thing${x.missing.length === 1 ? "" : "s"} missing</span>` : "";
  return `<li><a class="grow" href="#/intake/${x.id}"><div class="t">${esc(x.kind === "sold" ? "Sold: " : "")}${esc(x.label)} <span class="faint">#${x.id}</span></div><div class="s">${esc(x.created_by_name)} · ${esc(dateFmt(x.updated_at))} ${miss}</div></a>${badge(l, c)}${site ? badge(site[0], site[1]) : ""}${x.money_state === "pending" && can("money.view") ? badge("Buying price missing", "warn") : ""}</li>`;
}

export async function copyFormat(kind) {
  try {
    const r = await io.get("intakes/format", { kind });
    try { await navigator.clipboard.writeText(r.text); toast("Format copied. Paste it into Ask Claude or a WhatsApp note, fill it in, send it to Claude.", "ok"); }
    catch { const d = openDrawer({ title: "The format", sub: "Copy it, fill it in and send it in Ask Claude.", body: `<textarea class="textarea fmt-box" readonly>${esc(r.text)}</textarea>` }); d.el.querySelector("textarea").select(); }
  } catch (e) { toast(e.message || "Could not load the format.", "err"); }
}

// ------------------------------------------------------------------ one intake
async function open(ctx, id) {
  let it;
  try { it = await io.get(`intakes/${id}`); } catch (e) {
    ctx.root.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not open this intake.</b><span class="muted">${esc(e.message)}</span></div></div>`; return;
  }
  if (!ctx.alive()) return;
  const steps = it.kind === "sold" ? STEPS_SOLD : STEPS_NEW;
  let step = steps.some(([k]) => k === ctx.query.get("step")) ? ctx.query.get("step") : it.state === "draft" ? steps[0][0] : "check";
  let pending = {}, saving = false;
  const key = `ca.intake.${id}`;
  try { const off = JSON.parse(safeStore(key) || "null"); if (off && typeof off === "object") pending = off; } catch { /* none kept */ }

  const editable = () => it.can.edit;
  const val = (k) => (k in pending ? pending[k] : it.data[k]);

  function head() {
    const [l, c] = STATE_LABEL[it.state] || [it.state, ""];
    const title = it.kind === "sold" ? "Car sold" : "New car";
    return pageHead({ title: `${title} · #${it.id}`, sub: `${esc(it.created_by_name)} · ${badge(l, c)}${it.stock_no ? " · " + esc(it.stock_no) : ""}${it.via === "ask" ? " · from Ask Claude" : ""}`,
      actions: it.can.cancel ? `<button class="btn" type="button" id="cancel">${icon("x")}Cancel this</button>` : "" });
  }
  function rail() {
    const miss = {}; (it.checks.missing || []).forEach((m) => { miss[m.step] = (miss[m.step] || 0) + 1; });
    return `<nav class="step-rail" aria-label="Steps">${steps.filter(([k]) => k !== "owner" || it.kind !== "new_car" || true).map(([k, l], i) => `<button type="button" data-step="${k}" aria-current="${k === step ? "step" : "false"}"><span class="n">${i + 1}</span>${esc(l)}${miss[k] ? `<span class="dot" aria-label="${miss[k]} missing"></span>` : ""}</button>`).join("")}</nav>`;
  }
  function paint() {
    ctx.root.innerHTML = head() + rail() + `<div id="save-state" class="save-state" aria-live="polite"></div><section class="card intake-step rise" id="body"></section>
      <div class="step-nav"><button class="btn" type="button" id="prev">${icon("left")}Back</button><span class="grow"></span><button class="btn primary" type="button" id="next">Next${icon("right")}</button></div>`;
    renderStep();
    ctx.root.querySelector("#cancel")?.addEventListener("click", cancel);
  }
  function go(k) { step = k; history.replaceState(null, "", `#/intake/${id}?step=${k}`); paint(); window.scrollTo(0, 0); }
  ctx.root.addEventListener("click", (e) => {
    const s = e.target.closest("[data-step]"); if (s) go(s.dataset.step);
    const i = steps.findIndex(([k]) => k === step);
    if (e.target.closest("#prev") && i > 0) go(steps[i - 1][0]);
    if (e.target.closest("#next") && i < steps.length - 1) go(steps[i + 1][0]);
    const j = e.target.closest("[data-jump]"); if (j) go(j.dataset.jump);
  });

  // ---------------------------------------------------------------- autosave
  const flush = debounce(async () => {
    if (saving || !Object.keys(pending).length || !editable()) return;
    saving = true;
    const send = pending; pending = {};
    setSave("Saving…");
    try {
      it = await io.patch(`intakes/${id}`, { version: it.version, data: send });
      try { localStorage.removeItem(key); } catch { /* storage blocked */ }
      setSave("Saved");
      refreshChecks();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.code === "version_conflict") {
        toast("Someone else changed this draft; check and carry on.", "err");
        it = await io.get(`intakes/${id}`); paint();
      } else if (e instanceof ApiError && e.status === 0) {
        pending = { ...send, ...pending };
        safeStore(key, JSON.stringify(pending));             // non-money fields only: money never goes through here
        setSave("Offline: kept on this phone, sends when you are back online");
      } else {
        pending = {};
        setSave("");
        toast(e.message || "Could not save.", "err");
        if (e.fields) markErrors(e.fields);
      }
    }
    saving = false;
    if (Object.keys(pending).length) flush();
  }, 1500);
  window.addEventListener("online", () => { if (ctx.alive() && Object.keys(pending).length) flush(); });
  function setSave(t) { const el = ctx.root.querySelector("#save-state"); if (el) el.textContent = t; }
  function setVal(k, v) { pending[k] = v; flush(); }
  function refreshChecks() {
    const r = ctx.root.querySelector(".step-rail"); if (r) r.outerHTML = rail();
    const p = it.checks.problems || {};
    ctx.root.querySelectorAll("[data-err]").forEach((el) => { const m = p[el.dataset.err]; el.textContent = m || ""; el.hidden = !m; });
    if (step === "check" || step === "photos") renderStep();
  }
  function markErrors(fields) { for (const [k, m] of Object.entries(fields)) { const el = ctx.root.querySelector(`[data-err="${k}"]`); if (el) { el.textContent = m; el.hidden = false; } } }

  // ---------------------------------------------------------------- field builders
  const dis = () => (editable() ? "" : " disabled");
  const err = (k) => `<div class="err" data-err="${k}"${(it.checks.problems || {})[k] ? "" : " hidden"}>${esc((it.checks.problems || {})[k] || "")}</div>`;
  const req = (r) => (r ? ' <span class="req" aria-hidden="true">*</span>' : "");
  const text = (k, label, o = {}) => `<div class="field full"><label for="i_${k}">${esc(label)}${req(o.req)}</label><input class="input big" id="i_${k}" data-k="${k}" type="${o.type || "text"}"${o.mode ? ` inputmode="${o.mode}"` : ""}${o.ph ? ` placeholder="${esc(o.ph)}"` : ""} value="${esc(val(k) ?? "")}"${dis()}>${o.hint ? `<div class="hint">${esc(o.hint)}</div>` : ""}${err(k)}</div>`;
  const area = (k, label, o = {}) => `<div class="field full"><label for="i_${k}">${esc(label)}${req(o.req)}</label><textarea class="textarea" id="i_${k}" data-k="${k}" rows="${o.rows || 3}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ""}${dis()}>${esc(val(k) ?? "")}</textarea>${o.hint ? `<div class="hint">${esc(o.hint)}</div>` : ""}${err(k)}</div>`;
  const chips = (k, label, opts, o = {}) => `<div class="field full"><span class="lbl">${esc(label)}${req(o.req)}</span><div class="chip-row" role="group" aria-label="${esc(label)}">${opts.map(([v, l]) => `<button type="button" class="chip-btn" data-chip="${k}" data-v="${esc(v)}" aria-pressed="${String(val(k)) === String(v)}"${dis()}>${esc(l)}</button>`).join("")}</div>${o.hint ? `<div class="hint">${esc(o.hint)}</div>` : ""}${err(k)}</div>`;
  const yesno = (k, label, o = {}) => `<div class="field full"><span class="lbl">${esc(label)}${req(o.req)}</span><div class="chip-row">${[[true, "Yes"], [false, "No"]].map(([v, l]) => `<button type="button" class="chip-btn" data-yn="${k}" data-v="${v}" aria-pressed="${val(k) === v}"${dis()}>${l}</button>`).join("")}</div>${err(k)}</div>`;
  const money = (k, label, o = {}) => { const v = val(k); return `<div class="field full"><label for="i_${k}">${esc(label)}${req(o.req)}</label><input class="input big num" id="i_${k}" data-money="${k}" inputmode="numeric" placeholder="12,45,000" value="${esc(Number.isFinite(v) ? new Intl.NumberFormat("en-IN").format(v) : v ?? "")}"${dis()}><div class="hint words" data-words="${k}">${Number.isFinite(v) ? esc(inWords(v)) : esc(o.hint || "Full rupees, like 12,45,000. Not lakh.")}</div>${err(k)}</div>`; };

  function bindFields(root) {
    root.querySelectorAll("[data-k]").forEach((el) => el.addEventListener("input", () => {
      let v = el.value.trim();
      if (el.type === "number") v = v === "" ? null : Number(v);
      if (el.dataset.k === "kms" || el.dataset.k === "service_last_km" || el.dataset.k === "odometer") v = v === "" || v == null ? null : Number(String(v).replace(/,/g, ""));
      if (["seats", "keys_count", "owner_serial", "lead_id"].includes(el.dataset.k)) v = v === "" || v == null ? null : Number(v);
      if (el.dataset.k === "reg_no") { el.value = el.value.toUpperCase(); v = el.value.replace(/[\s.-]/g, ""); }
      if (el.dataset.k === "chassis_no" || el.dataset.k === "engine_no") { el.value = el.value.toUpperCase(); v = el.value.replace(/[\s-]/g, ""); }
      setVal(el.dataset.k, v === "" ? null : v);
    }));
    root.querySelectorAll("[data-money]").forEach((el) => el.addEventListener("input", () => {
      const k = el.dataset.money, n = rupees(el.value), w = root.querySelector(`[data-words="${k}"]`);
      if (el.value.trim() === "") { w.textContent = "Full rupees, like 12,45,000. Not lakh."; setVal(k, null); return; }
      if (Number.isNaN(n)) { w.textContent = "Write the full rupees, like 12,45,000"; w.classList.add("neg"); return; }
      w.classList.remove("neg"); w.textContent = inWords(n);
      if (!el.dataset.local) setVal(k, el.value.trim());
    }));
    root.querySelectorAll("[data-chip]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.chip;
      root.querySelectorAll(`[data-chip="${k}"]`).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      setVal(k, b.dataset.v);
      if (["ownership", "insurance_type", "stage", "service_record"].includes(k)) setTimeout(renderStep, 0);
    }));
    root.querySelectorAll("[data-yn]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.yn;
      root.querySelectorAll(`[data-yn="${k}"]`).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      setVal(k, b.dataset.v === "true");
      if (k === "loan") setTimeout(renderStep, 0);
    }));
  }

  // ---------------------------------------------------------------- steps
  function renderStep() {
    const body = ctx.root.querySelector("#body"); if (!body) return;
    const f = (it.kind === "sold" ? SOLD : NEW)[step];
    body.innerHTML = f();
    bindFields(body);
    after[step]?.(body);
    const i = steps.findIndex(([k]) => k === step);
    ctx.root.querySelector("#prev").hidden = i === 0;
    ctx.root.querySelector("#next").hidden = i === steps.length - 1;
  }
  const h = (t, sub = "") => `<div class="step-h"><h2>${esc(t)}</h2>${sub ? `<p class="muted">${sub}</p>` : ""}</div>`;
  const NEW = {
    car: () => h("Car, from the RC", "Copy it exactly as the RC shows it.") + (it.state === "draft" ? pasteBox() : "") + `<div id="site-pick" class="site-pick"></div><div class="form-stack">
      ${text("make", "Make", { req: 1, ph: "Hyundai" })}${text("model", "Model", { req: 1, ph: "Creta" })}${text("variant", "Variant", { req: 1, ph: "SX(O) 1.5 Diesel" })}
      ${text("mfg_month", "Made (month and year)", { req: 1, type: "month" })}${text("reg_month", "Registered (month and year)", { req: 1, type: "month" })}
      ${text("reg_no", "Registration number", { req: 1, ph: "MH02AB1234", hint: "The website shows only the RTO code (like MH-02)." })}${chips("reg_type", "Registration type", CH.reg_type)}
      ${text("chassis_no", "Chassis number", { req: 1, hint: it.data.chassis_no ? "" : "17 letters and digits. Only the owner sees the full number later." })}
      <div class="field full"><label class="check"><input type="checkbox" id="chassis_old"${it.data.chassis_old ? " checked" : ""}${dis()}> <span>Older format (6-20 characters)</span></label></div>
      ${text("engine_no", "Engine number", { req: 1 })}</div>`,
    specs: () => h("Specs") + `<div class="form-stack">${chips("fuel", "Fuel", CH.fuel, { req: 1 })}${chips("transmission", "Gearbox", CH.transmission, { req: 1 })}${chips("trans_detail", "Gearbox type", CH.trans_detail)}
      ${text("kms", "Km, exactly what the odometer photo shows", { req: 1, mode: "numeric", ph: "45200" })}${text("colour", "Colour", { req: 1, ph: "Polar White" })}
      ${text("owner_serial", "Owners as per RC", { req: 1, mode: "numeric", ph: "1" })}${chips("body_type", "Body", CH.body_type, { req: 1 })}
      ${text("seats", "Seats", { mode: "numeric" })}${text("keys_count", "Keys: only the keys really there", { req: 1, mode: "numeric" })}
      <div class="field full"><span class="lbl">Features</span><div class="chip-row">${FEATURES.map((x) => `<button type="button" class="chip-btn" data-feat="${esc(x)}" aria-pressed="${(val("features") || []).includes(x)}"${dis()}>${esc(x)}</button>`).join("")}</div>${err("features")}</div>
      ${chips("location", "Where is it", CH.location, { req: 1 })}</div>`,
    condition: () => h("Condition and inspection", "Only what you saw and tested. Didn't check it? Write \"Not checked\".") + `<div class="form-stack">
      ${text("checked_by", "Checked by", { req: 1, ph: "Your name" })}${text("warning_lights", "Warning lights with the engine running", { req: 1, ph: "None" })}
      <div class="field full"><span class="lbl">Marks (each needs 2 photos)</span><ul class="mark-list">${(val("marks") || []).map((m, i) => `<li><b>${esc(m.id)}</b><input class="input" data-mark="${i}" value="${esc(m.text)}"${dis()}><button type="button" class="icon-btn" data-mark-rm="${i}" aria-label="Remove ${esc(m.id)}"${dis()}>${icon("x")}</button></li>`).join("")}</ul>${editable() ? `<button type="button" class="btn sm" id="mark-add">${icon("plus")}Add a mark</button>` : ""}</div>
      ${text("repainted", "Repainted panels", { ph: "None seen, checked by eye" })}${text("tyres", "Tyres FL FR RL RR", { ph: "half, half, good, good" })}${text("noises", "Noises, smoke, leaks")}
      ${chips("service_record", "Service record", CH.service_record, { req: 1 })}${val("service_record") === "partial" ? text("service_upto_km", "Partial up to (km)", { mode: "numeric" }) : ""}
      ${text("service_last_date", "Last service date", { type: "date" })}${text("service_last_km", "Last service km", { mode: "numeric" })}
      ${text("accident", "Accident or repair: what we know and how", { req: 1 })}${text("claim_history", "Insurance claim history", { req: 1 })}${text("water_damage", "Water damage", { req: 1 })}
      ${text("challans_checked_on", "E-challans checked on (date)", { req: 1, type: "date", hint: "Not checked? Leave it and say so in the summary." })}</div>`,
    papers: () => h("Papers", "Scan each paper in the office. Not here yet? Tap To follow and give a date. Scans go only to the papers file, never to the website.") + `<div class="form-stack">
      ${chips("insurance_type", "Insurance", CH.insurance_type, { req: 1 })}${val("insurance_type") && val("insurance_type") !== "none" ? text("insurer", "Insurer") + text("insurance_expiry", "Insurance valid till", { type: "date" }) + text("policy_no", "Policy number") : ""}
      ${text("puc_expiry", "PUC valid till", { type: "date" })}${yesno("loan", "Loan on the RC?")}${val("loan") ? text("hypothecated_to", "Bank name (never on the website)") : ""}${text("warranty_till", "Warranty till (never on the website)", { type: "date" })}</div>
      <ul class="paper-list">${PAPERS.map(paperRow).join("")}</ul>`,
    seller: () => h("Seller and line") + `<div class="form-stack">${chips("ownership", "Line", CH.ownership, { req: 1 })}${text("acquired_on", val("ownership") === "park_n_sell" ? "Parked on" : "Bought on", { req: 1, type: "date" })}
      ${val("ownership") === "park_n_sell" ? "" : chips("source", "Seller type", CH.source, { req: 1 })}
      ${text("seller_name", "Seller name, as on the RC or ID", { req: 1 })}${text("seller_phone", "Seller mobile", { req: 1, type: "tel", mode: "tel" })}
      ${val("ownership") === "park_n_sell" ? pnsBlock() : ""}</div>`,
    photos: () => photosStep(),
    price: () => h("Price and website") + `<div class="form-stack">${money("asking_price", "Asking price", { req: 1 })}
      <div class="field full"><label class="check"><input type="checkbox" id="por"${val("price_on_request") ? " checked" : ""}${dis()}> <span>Price on request</span></label></div>
      ${chips("list_on_site", "List on the website", CH.list_on_site, { req: 1 })}<div class="field full"><label for="i_refurb_what">Needs work first? What and which workshop (leave empty if not)</label><input class="input big" id="i_refurb_what" placeholder="Denting at Example Motors" value="${esc(val("refurb")?.what || "")}"${dis()}></div>
      ${text("headline", "Headline (10-90 characters)", { ph: "1st owner Creta SX(O) diesel automatic" })}
      ${area("summary", "Summary: 2-4 honest sentences (40-400 characters)", { req: 1, rows: 4, hint: "No phone number, no warranty, no 'certified', no number of checks." })}
      ${text("video", "Video link (one YouTube video or Instagram reel, plate blurred)", { type: "url" })}${area("notes", "Internal notes (staff only)")}</div>`,
    owner: () => ownerStep(),
    check: () => checkStep(),
  };
  const SOLD = {
    car: () => h("Car and stage") + `<div class="form-stack">${text("stock_no", "Stock number", { req: 1, ph: "CA123", hint: "A car only on the website? Link it first with \"Already on the website?\" in New car." })}${err("car_id")}${chips("stage", "Stage", CH.stage, { req: 1 })}${text("date", val("stage") === "delivered" ? "Delivered on" : "Booked on", { req: 1, type: "date" })}</div>`,
    buyer: () => h("Buyer") + `<div class="form-stack">${chips("buyer_type", "Buyer type", CH.buyer_type, { req: 1 })}${text("buyer_name", "Buyer name", { req: 1 })}${text("buyer_phone", "Buyer mobile", { req: 1, type: "tel", mode: "tel" })}
      ${can("records.all") ? text("sold_by", "Sold by (salesman's name)") : ""}${text("lead_id", "Lead number (optional)", { mode: "numeric" })}</div>`,
    price: () => h("Price and payments", "Full rupees only.") + `<div class="form-stack">${money("sale_price", "Final price", { req: 1 })}
      <div class="field full"><span class="lbl">Token</span><div class="pay-row"><input class="input num" data-pay="token" data-f="amount" inputmode="numeric" placeholder="50,000" value="${esc(val("token")?.amount ?? "")}"${dis()}><input class="input" type="date" data-pay="token" data-f="date" value="${esc(val("token")?.date ?? "")}"${dis()}><select class="select" data-pay="token" data-f="mode"${dis()}>${PAY.map(([v, l]) => `<option value="${v}"${val("token")?.mode === v ? " selected" : ""}>${l}</option>`).join("")}</select></div>${err("token")}</div>
      ${text("invoice_no", "Invoice number (at delivery)")}</div>`,
    papers: () => h("Papers and transfer") + `<div class="form-stack">${yesno("form29", "Form 29 signed, 2 copies")}${yesno("form30", "Form 30 signed, 2 copies")}${yesno("original_rc", "Original RC with us")}
      ${chips("insurance_transfer", "Insurance transfer", CH.insurance_transfer)}${chips("rc_transfer", "RC transfer", CH.rc_transfer)}${chips("buyer_kyc", "Buyer KYC", CH.buyer_kyc)}
      ${yesno("delivery_note", "Delivery note signed")}${text("odometer", "Odometer at delivery (km)", { mode: "numeric" })}</div>
      <ul class="paper-list">${[["buyer_pan", "Buyer PAN", "pan"], ["buyer_id", "Buyer photo ID", "photo_id"], ["delivery_note", "Delivery note", "delivery_note"]].map(([k, l, dt]) => uploadRow(k, l, dt)).join("")}</ul>`,
    check: () => checkStep(),
  };
  const after = {
    car: (b) => {
      b.querySelector("#chassis_old")?.addEventListener("change", (e) => setVal("chassis_old", e.target.checked));
      b.querySelector("#paste-go")?.addEventListener("click", pasteFormat);
      if (it.kind === "new_car") sitePick(b);
    },
    specs: (b) => b.querySelectorAll("[data-feat]").forEach((x) => x.addEventListener("click", () => {
      const cur = new Set(val("features") || []); const on = x.getAttribute("aria-pressed") !== "true";
      on ? cur.add(x.dataset.feat) : cur.delete(x.dataset.feat); x.setAttribute("aria-pressed", String(on)); setVal("features", [...cur]);
    })),
    condition: (b) => {
      const marks = () => (val("marks") || []).map((m) => ({ ...m }));
      b.querySelector("#mark-add")?.addEventListener("click", () => { const m = marks(); m.push({ id: "M" + String(m.length + 1).padStart(2, "0"), text: "" }); setVal("marks", m); renderStep(); });
      b.querySelectorAll("[data-mark]").forEach((el) => el.addEventListener("input", () => { const m = marks(); m[+el.dataset.mark].text = el.value; setVal("marks", m.filter((x) => x.text.trim() || true)); }));
      b.querySelectorAll("[data-mark-rm]").forEach((el) => el.addEventListener("click", () => { const m = marks(); m.splice(+el.dataset.markRm, 1); m.forEach((x, i) => { x.id = "M" + String(i + 1).padStart(2, "0"); }); setVal("marks", m); renderStep(); }));
    },
    papers: (b) => bindPapers(b),
    seller: (b) => b.querySelectorAll("[data-pns]").forEach((el) => el.addEventListener("input", () => {
      const p = { ...(val("pns") || {}) }; const k = el.dataset.pns;
      if (k === "reserve_price") { const n = rupees(el.value); if (!Number.isNaN(n)) p[k] = n; }
      else if (k === "commission_value") p[k] = p.commission_type === "percent" ? Number(el.value) / 100 : rupees(el.value);
      else if (k === "parking_fee_monthly") p[k] = Number(String(el.value).replace(/,/g, "")) || 0;
      else p[k] = el.value || null;
      setVal("pns", p);
    })),
    photos: (b) => bindPhotos(b),
    price: (b) => {
      b.querySelector("#por")?.addEventListener("change", (e) => { setVal("price_on_request", e.target.checked); if (e.target.checked) setVal("asking_price", null); });
      const rw = b.querySelector("#i_refurb_what");
      if (rw) { rw.addEventListener("input", () => setVal("refurb", rw.value.trim() ? { job_type: guessJob(rw.value), what: rw.value.trim(), workshop: (/\bat\s+(.+)$/i.exec(rw.value) || [])[1] || null } : null)); }
    },
    owner: (b) => bindOwner(b),
    check: (b) => bindCheck(b),
  };
  SOLD.price.after = null;
  after.price_sold = (b) => b.querySelectorAll("[data-pay]").forEach((el) => el.addEventListener("input", () => {
    const t = { ...(val("token") || {}) }; const f = el.dataset.f;
    t[f] = f === "amount" ? rupees(el.value) : el.value; if (Number.isNaN(t.amount)) return; setVal("token", t);
  }));
  const guessJob = (s) => { const t = s.toLowerCase(); return /dent|paint/.test(t) ? "denting_painting" : /detail|polish/.test(t) ? "detailing" : /tyre/.test(t) ? "tyres" : /electric/.test(t) ? "electrical" : /engine|service|mechanic/.test(t) ? "mechanical" : /\bac\b/.test(t) ? "ac" : /seat|interior/.test(t) ? "interior" : "other"; };

  // ---------------------------------------------------------------- "Already on the website?" (P1, 4.6): link, never list twice
  let siteCars = null;
  async function sitePick(b) {
    const box = b.querySelector("#site-pick"); if (!box) return;
    const wid = val("website_id");
    if (wid) {
      const line = (it.readback || []).find((x) => x.label === "Already on the website");
      box.innerHTML = `<div class="note-card">${icon("globe", "")}<p><b>Already on the website.</b> ${esc(line ? line.value : wid)}</p>${editable() ? `<button type="button" class="btn sm" id="site-unlink">Not this car</button>` : ""}</div>${err("website_id")}`;
      box.querySelector("#site-unlink")?.addEventListener("click", () => linkTo(null));
      return;
    }
    if (!editable()) return;
    if (!siteCars) { try { siteCars = (await io.get("intakes/site-cars")).data || []; } catch { siteCars = []; } }
    if (!ctx.alive() || step !== "car" || !siteCars.length || !box.isConnected) return;
    const facts = (c) => [Number.isFinite(c.kms) ? `${new Intl.NumberFormat("en-IN").format(c.kms)} km` : "", c.colour, c.price_on_request ? "Price on request" : inrFmt(c.price)].filter(Boolean).join(" · ");
    box.innerHTML = `<details class="paste"><summary>${icon("globe", "")}Already on the website? (${siteCars.length})</summary><p class="muted">These cars are on the website but not in the Desk yet. If this car is one of them, pick it: it is linked, not listed twice, and its website details fill in here.</p>
      <ul class="list">${siteCars.map((c) => `<li><span class="grow"><div class="t">${esc(c.label)}</div><div class="s">${esc(facts(c))}</div></span><button type="button" class="btn sm" data-site="${esc(c.website_id)}">This car</button></li>`).join("")}</ul></details>${err("website_id")}`;
    box.querySelectorAll("[data-site]").forEach((x) => x.addEventListener("click", () => linkTo(x.dataset.site)));
  }
  async function linkTo(wid) {
    const send = { ...pending, website_id: wid };
    pending = {};
    try {
      it = await io.patch(`intakes/${id}`, { version: it.version, data: send });
      try { localStorage.removeItem(key); } catch { /* storage blocked */ }
      siteCars = null;
      toast(wid ? "Linked to the website car. Its details are filled in: check each step." : "Not linked. This car goes on the website as a new listing.", "ok");
      paint();
    } catch (e) {
      delete send.website_id; pending = { ...send, ...pending };
      toast(e.message || "Could not link it.", "err");
    }
  }

  function pasteBox() {
    return `<details class="paste"><summary>${icon("copy", "")}Paste the format</summary><p class="muted">Paste a filled NEW CAR format (from WhatsApp or Ask Claude). Lines it cannot place are shown back, never guessed.</p>
      <textarea class="textarea" id="paste-text" rows="6" placeholder="NEW CAR&#10;Make: …"></textarea><button type="button" class="btn sm" id="paste-go">Read it into this draft</button><div id="paste-out"></div></details>`;
  }
  async function pasteFormat() {
    const t = ctx.root.querySelector("#paste-text").value;
    if (!t.trim()) return;
    try {
      const r = await io.post("intakes/parse", { kind: it.kind, text: t, intake_id: id });
      it = r.intake;
      const out = [];
      if (r.unknown_lines?.length) out.push(`Not understood: ${r.unknown_lines.map((u) => `"${esc(u.line)}"${u.hint ? ` (did you mean "${esc(u.hint)}"?)` : ""}`).join(", ")}`);
      if (r.dropped_owner_lines) out.push(`Kept out: ${r.dropped_owner_lines} owner-only line${r.dropped_owner_lines === 1 ? "" : "s"}. Dad adds it from his login.`);
      paint();
      toast("Read into the draft. Check each step.", "ok");
      if (out.length) toast(out.join(" "), "err");
    } catch (e) { toast(e.message, "err"); }
  }

  // ---------------------------------------------------------------- papers
  function paperRow([k, label, dt]) {
    const p = (val("papers") || {})[k] || {};
    const files = it.files.filter((f) => f.slot === "paper" && (f.doc_type === dt || (k === "seller_kyc" && ["pan", "aadhaar_masked", "photo_id", "address_proof"].includes(f.doc_type))));
    return `<li class="paper" data-paper="${k}"><div class="paper-h"><b>${esc(label)}</b>${OWNER_DOCS.has(dt) ? badge("Owner only", "info") : ""}</div>
      <div class="chip-row">${[["got", "Got it"], ["follow", "To follow"], ["na", "Not needed"]].map(([v, l]) => `<button type="button" class="chip-btn" data-pst="${k}" data-v="${v}" aria-pressed="${p.state === v}"${dis()}>${l}</button>`).join("")}</div>
      ${p.state === "follow" ? `<input class="input" type="date" data-pdue="${k}" value="${esc(p.due || "")}"${dis()}>` : ""}
      ${p.state === "got" || files.length ? `<div class="file-chips">${files.map((f) => `<span class="file-chip">${icon("file", "")}<span>${esc(f.doc_type.replace(/_/g, " "))}${f.can_open ? "" : " · Uploaded. Only the owner can open it."}</span>${it.state === "draft" || it.state === "submitted" ? `<button type="button" data-rmf="${f.uuid}" aria-label="Remove">${icon("x", "")}</button>` : ""}</span>`).join("")}
        ${editable() || it.state === "submitted" ? `<label class="btn sm upl">${icon("camera")}Scan or choose${k === "seller_kyc" ? `<select class="select sm" data-kyc>${[["pan", "PAN"], ["aadhaar_masked", "Masked Aadhaar"], ["photo_id", "Photo ID"], ["address_proof", "Address proof"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>` : ""}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic" data-pup="${dt}" hidden></label>` : ""}</div>` : ""}</li>`;
  }
  function uploadRow(k, label, dt) {
    const files = it.files.filter((f) => f.slot === "paper" && f.doc_type === dt);
    return `<li class="paper"><div class="paper-h"><b>${esc(label)}</b></div><div class="file-chips">${files.map((f) => `<span class="file-chip">${icon("file", "")}<span>${esc(label)}</span></span>`).join("")}${editable() ? `<label class="btn sm upl">${icon("camera")}Scan or choose<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic" data-pup="${dt}" hidden></label>` : ""}</div></li>`;
  }
  function bindPapers(b) {
    b.querySelectorAll("[data-pst]").forEach((x) => x.addEventListener("click", () => { const k = x.dataset.pst; setVal("papers", { [k]: { state: x.dataset.v, ...(x.dataset.v === "follow" ? { due: null } : {}) } }); it.data.papers = { ...(it.data.papers || {}), [k]: { state: x.dataset.v } }; renderStep(); }));
    b.querySelectorAll("[data-pdue]").forEach((x) => x.addEventListener("change", () => setVal("papers", { [x.dataset.pdue]: { state: "follow", due: x.value } })));
    bindUploads(b);
  }
  function bindUploads(b) {
    b.querySelectorAll("[data-pup]").forEach((inp) => inp.addEventListener("change", async () => {
      const file = inp.files[0]; if (!file) return;
      let dt = inp.dataset.pup; const kyc = inp.closest("label")?.querySelector("[data-kyc]"); if (kyc) dt = kyc.value;
      const fd = new FormData(); fd.append("file", file, file.name); fd.append("slot", "paper"); fd.append("doc_type", dt);
      if (dt === "insurance" && it.data.insurance_expiry) fd.append("valid_until", it.data.insurance_expiry);
      if (dt === "puc" && it.data.puc_expiry) fd.append("valid_until", it.data.puc_expiry);
      try { await io.upload(`intakes/${id}/files`, fd); toast(OWNER_DOCS.has(dt) ? "Uploaded. Only the owner can open it." : "Paper uploaded", "ok"); it = await io.get(`intakes/${id}`); renderStep(); refreshChecks(); }
      catch (e) { toast(e.message || "Upload failed. Try again.", "err"); }
    }));
    b.querySelectorAll("[data-rmf]").forEach((x) => x.addEventListener("click", async () => { try { await io.del(`intakes/${id}/files/${x.dataset.rmf}`); it = await io.get(`intakes/${id}`); renderStep(); refreshChecks(); } catch (e) { toast(e.message, "err"); } }));
  }

  // ---------------------------------------------------------------- Park & Sell
  function pnsBlock() {
    const p = val("pns") || {};
    const ct = p.commission_type || "percent";
    return `<div class="sub-block"><h3>Park &amp; Sell terms</h3>
      <div class="field full"><label for="pn_ad">Agreement date</label><input class="input big" id="pn_ad" type="date" data-pns="agreement_date" value="${esc(p.agreement_date || "")}"${dis()}></div>
      <div class="field full"><label for="pn_ae">Agreement till</label><input class="input big" id="pn_ae" type="date" data-pns="agreement_expiry" value="${esc(p.agreement_expiry || "")}"${dis()}></div>
      <div class="field full"><label for="pn_rp">Reserve price</label><input class="input big num" id="pn_rp" inputmode="numeric" data-pns="reserve_price" value="${esc(p.reserve_price ? new Intl.NumberFormat("en-IN").format(p.reserve_price) : "")}"${dis()}></div>
      <div class="field full"><label for="pn_ct">Commission</label><select class="select" id="pn_ct" data-pns="commission_type"${dis()}>${[["percent", "Percent of the sale"], ["flat", "Flat rupees"], ["over_reserve", "Everything above the reserve"]].map(([v, l]) => `<option value="${v}"${ct === v ? " selected" : ""}>${l}</option>`).join("")}</select>
        ${ct !== "over_reserve" ? `<input class="input" inputmode="decimal" data-pns="commission_value" placeholder="${ct === "percent" ? "2" : "25,000"}" value="${esc(p.commission_value != null ? (ct === "percent" ? p.commission_value * 100 : p.commission_value) : "")}"${dis()}>` : ""}</div>
      <div class="field full"><label for="pn_pf">Parking fee a month (₹)</label><input class="input" id="pn_pf" inputmode="numeric" data-pns="parking_fee_monthly" value="${esc(p.parking_fee_monthly ?? "")}"${dis()}></div>
      <div class="field full"><label for="pn_rb">Refurb paid by</label><select class="select" id="pn_rb" data-pns="refurb_paid_by"${dis()}><option value="">Choose…</option>${[["consignor", "Car owner"], ["firm", "Us"], ["deduct_from_payout", "Deduct from payout"]].map(([v, l]) => `<option value="${v}"${p.refurb_paid_by === v ? " selected" : ""}>${l}</option>`).join("")}</select></div></div>`;
  }

  // ---------------------------------------------------------------- photos (2.10)
  function photosStep() {
    const ph = it.photos || { must_in: 0, must: 8, have: 0 };
    const by = Object.fromEntries(it.files.filter((f) => f.slot === "photo").map((f) => [f.angle, f]));
    const marks = (it.data.marks || []).flatMap((m) => [[`${m.id}-far`, `${m.id} far: ${m.text}`], [`${m.id}-close`, `${m.id} close: ${m.text}`]]);
    const extras = it.files.filter((f) => f.slot === "photo" && !MUST.some(([a]) => a === f.angle) && !marks.some(([a]) => a === f.angle));
    const pctW = Math.round((ph.must_in / Math.max(1, ph.must)) * 100);
    const slot = ([a, label]) => { const f = by[a]; return `<li class="slot${f ? " has" : ""}"><span class="slot-id">${esc(a)}</span>${f ? (DEMO ? `<span class="slot-ph" role="img" aria-label="${esc(a)} photo (demo)">${icon("image")}</span>` : `<img alt="${esc(a)} photo" src="/api/intakes/${id}/files/${f.uuid}" loading="lazy">`) : `<span class="slot-ph">${icon("camera")}</span>`}<span class="slot-l">${esc(label)}</span>
      ${canPhoto() ? (f ? `<button type="button" class="btn sm" data-rmf="${f.uuid}">Remove</button>` : `<label class="btn sm">${icon("camera")}Take or choose<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" data-angle="${esc(a)}" hidden></label>`) : ""}</li>`; };
    return h("Photos", "The 8 must-haves first, then 2 for every mark, then the rest in shot order. At most 40 here; the full shoot goes to the Drive folder. Never photograph a paper, a screen with a name, or a chassis number.")
      + `<div class="ph-progress"><span class="meter"><i data-w="${pctW}"></i></span><b>${ph.must_in} of ${ph.must} must-haves</b><span class="muted">${ph.have} photos in all</span></div>
      <h3 class="ph-h">Must-haves</h3><ul class="slots">${MUST.map(slot).join("")}</ul>
      ${marks.length ? `<h3 class="ph-h">Marks</h3><ul class="slots">${marks.map(slot).join("")}</ul>` : ""}
      <h3 class="ph-h">More photos</h3><ul class="slots">${extras.map((f) => slot([f.angle, f.label || "More"])).join("")}</ul>
      ${canPhoto() ? `<label class="btn">${icon("image")}Add more photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-more hidden></label>` : ""}<div id="ph-queue" class="ph-queue"></div>`;
  }
  const canPhoto = () => it.state === "draft" || it.state === "submitted" || (it.state === "saved" && it.kind === "new_car" && !(it.site_jobs || []).some((j) => j.kind === "add_car" && j.state !== "waiting"));
  function bindPhotos(b) {
    b.querySelectorAll(".meter i[data-w]").forEach((i) => i.style.setProperty("--w", i.dataset.w + "%"));
    const queue = b.querySelector("#ph-queue");
    const up = async (file, angle) => {
      const tag = document.createElement("div"); tag.className = "q-item"; tag.textContent = `${angle || file.name}: uploading…`; queue.append(tag);
      try {
        const small = await shrink(file);
        const fd = new FormData(); fd.append("file", small, angle ? `${angle}.jpg` : small.name); fd.append("slot", "photo"); if (angle) fd.append("angle", angle);
        await io.upload(`intakes/${id}/files`, fd);
        tag.remove();
        return true;
      } catch (e) {
        tag.innerHTML = `${esc(angle || file.name)}: ${esc(e.message || "did not upload")} <button type="button" class="btn sm">Try again</button>`;
        tag.querySelector("button").addEventListener("click", () => { tag.remove(); up(file, angle).then((ok) => ok && reload()); });
        return false;
      }
    };
    const reload = async () => { it = await io.get(`intakes/${id}`); renderStep(); refreshChecks(); };
    b.querySelectorAll("[data-angle]").forEach((inp) => inp.addEventListener("change", async () => { if (inp.files[0] && await up(inp.files[0], inp.dataset.angle)) reload(); }));
    b.querySelector("[data-more]")?.addEventListener("change", async (e) => { let ok = false; for (const f of e.target.files) ok = (await up(f, null)) || ok; if (ok) reload(); });
    b.querySelectorAll("[data-rmf]").forEach((x) => x.addEventListener("click", async () => { try { await io.del(`intakes/${id}/files/${x.dataset.rmf}`); reload(); } catch (er) { toast(er.message, "err"); } }));
  }
  window.addEventListener("beforeunload", (e) => { if (ctx.alive() && ctx.root.querySelector(".q-item")) { e.preventDefault(); e.returnValue = "Photos not uploaded yet"; } });

  // ---------------------------------------------------------------- owner step (2.6, 2.7): money logins only, never autosaved
  function ownerStep() {
    if (!(it.can.money)) return h("Owner") + `<div class="note-card">${icon("lock", "")}<p>Dad adds the buying price and costs from his own login. The website does not wait for it.</p></div>`;
    const m = it.money || {};
    return h("Owner only", "Typed here, seen only in money logins. Never kept on this phone.") + `<form id="money" class="form-stack" novalidate>
      ${moneyIn("purchase_price", "Purchase price (includes any seller loan we paid off)", m.purchase_price)}${moneyIn("broker_fee", "Broker fee", m.broker_fee)}
      <div class="field full"><label for="m_mode">Paid by</label><select class="select" id="m_mode" name="purchase_mode"><option value="">Choose… (needed with the price)</option>${PAY.map(([v, l]) => `<option value="${v}"${m.purchase_mode === v ? " selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="field full"><label for="m_fund">Funding</label><select class="select" id="m_fund" name="funding"><option value="">Choose…</option><option value="own"${m.funding === "own" ? " selected" : ""}>Own money</option><option value="investor"${m.funding === "investor" ? " selected" : ""}>With an investor</option></select></div>
      <div class="field full"><span class="lbl">Investor (if any)</span><div class="pay-row"><input class="input" name="inv_label" placeholder="Name as you write it"><input class="input num" name="inv_amount" inputmode="numeric" placeholder="Amount put in"><input class="input" name="inv_share" inputmode="decimal" placeholder="Profit share %"></div></div>
      ${moneyIn("floor_price", "Lowest price (not above the asking price)", m.floor_price)}
      <div class="field full"><span class="lbl">A cost so far (optional)</span><div class="pay-row"><select class="select" name="cost_cat"><option value="">Category…</option>${COST_CAT.map((c) => `<option value="${c}">${c.replace(/_/g, " ")}</option>`).join("")}</select><input class="input" name="cost_vendor" placeholder="Vendor"><input class="input num" name="cost_amount" inputmode="numeric" placeholder="Amount"></div></div>
      <div class="err" id="money-err" hidden></div><button class="btn primary" type="submit">Save money</button></form>`;
  }
  const moneyIn = (k, label, v) => `<div class="field full"><label for="m_${k}">${esc(label)}</label><input class="input big num" id="m_${k}" name="${k}" inputmode="numeric" value="${esc(Number.isFinite(v) ? new Intl.NumberFormat("en-IN").format(v) : "")}"><div class="hint" data-mw="${k}">${Number.isFinite(v) ? esc(inWords(v)) : "Full rupees"}</div></div>`;
  function bindOwner(b) {
    const f = b.querySelector("#money"); if (!f) return;
    f.querySelectorAll(".num").forEach((el) => el.addEventListener("input", () => { const w = f.querySelector(`[data-mw="${el.name}"]`); if (w) { const n = rupees(el.value); w.textContent = el.value.trim() === "" ? "Full rupees" : Number.isNaN(n) ? "Write the full rupees, like 12,45,000" : inWords(n); } }));
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const g = (n) => f.elements[n]?.value.trim() || "";
      const body = {};
      for (const k of ["purchase_price", "broker_fee", "floor_price"]) if (g(k)) { const n = rupees(g(k)); if (Number.isNaN(n)) { showMoneyErr(`${k.replace(/_/g, " ")}: write the full rupees`); return; } body[k] = n; }
      if (g("purchase_mode")) body.purchase_mode = g("purchase_mode"); if (g("funding")) body.funding = g("funding");
      if (g("inv_label") && g("inv_amount")) body.investors = [{ label: g("inv_label"), amount: rupees(g("inv_amount")), profit_share_pct: g("inv_share") ? Number(g("inv_share")) : null }];
      if (g("cost_cat") && g("cost_amount")) body.costs = [{ category: g("cost_cat"), vendor: g("cost_vendor"), amount: rupees(g("cost_amount")) }];
      const btn = f.querySelector('button[type="submit"]');
      const r = await save(btn, async () => { try { return await io.post(`intakes/${id}/money`, body); } catch (ex) { showMoneyErr(ex.message); throw ex; } }, { ok: "Money saved" });
      if (r) { it = await io.get(`intakes/${id}`); renderStep(); }
    });
    function showMoneyErr(m) { const el = f.querySelector("#money-err"); el.textContent = m; el.hidden = false; }
  }

  // ---------------------------------------------------------------- check and send
  function checkStep() {
    const lines = it.readback || [];
    const miss = it.checks.missing || [];
    const site = (it.site_jobs || []).slice(-1)[0];
    const salesman = !can("stock.manage") && it.kind === "new_car" || (it.kind === "sold" && it.data.stage === "delivered" && !can("deals.manage"));
    return h(it.state === "draft" ? "Check it, then send" : "The read-back") + `<ul class="readback">${lines.map((x) => `<li class="${x.flag ? "rb-" + x.flag : ""}"><span class="rb-l">${esc(x.label)}</span><span class="rb-v">${esc(x.value)}</span></li>`).join("")}</ul>
      ${miss.length && it.state === "draft" ? `<div class="miss"><b>Still needed to send</b><ul>${miss.map((m) => `<li><button type="button" class="link-btn" data-jump="${esc(m.step)}">${esc(m.text)}</button></li>`).join("")}</ul></div>` : ""}
      ${site ? `<p>${badge((SITE_LABEL[site.state === "live" ? "live" : site.state === "on_files" ? "on_files" : ["needs_medhansh", "failed"].includes(site.state) ? "problem" : "waiting"] || ["", ""])[0], "info")} ${esc(site.note || "")}</p>` : ""}
      ${it.decision_note && it.state === "rejected" ? `<div class="err-box">${icon("alert", "")}<div><b>Not approved</b><span>${esc(it.decision_note)}</span></div></div>` : ""}
      <div class="send-row">${it.can.submit ? `<button class="btn primary big" type="button" id="send"${miss.length || Object.keys(it.checks.problems || {}).length ? " disabled" : ""}>${salesman ? "Send for approval" : "Send"}</button>` : ""}
      ${it.can.decide ? `<button class="btn primary" type="button" id="approve">${icon("check")}Approve</button><button class="btn" type="button" id="reject">Reject</button>` : ""}</div>`;
  }
  function bindCheck(b) {
    b.querySelector("#send")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      await new Promise((r) => setTimeout(r, Object.keys(pending).length || saving ? 1900 : 0));      // the last change saves first
      const r = await save(btn, () => io.post(`intakes/${id}/submit`, { version: it.version }), { ok: "Sent" });
      if (r) { (r.next || []).forEach((n) => toast(n, "ok")); it = await io.get(`intakes/${id}`); paint(); }
    });
    b.querySelector("#approve")?.addEventListener("click", async (e) => {
      const r = await save(e.currentTarget, () => io.post(`intakes/${id}/decision`, { decision: "approve" }), { ok: "Approved and saved" });
      if (r) { it = await io.get(`intakes/${id}`); paint(); }
    });
    b.querySelector("#reject")?.addEventListener("click", () => {
      const d = openDrawer({ title: "Reject this intake", sub: "The sender sees your reason. Nothing is created and the photos are deleted.",
        body: `<form id="rj" novalidate><div class="field full"><label for="rj_n">Reason (5-200 characters)</label><textarea class="textarea" id="rj_n" maxlength="200"></textarea></div></form>`,
        foot: `<button class="btn" type="button" data-x>Cancel</button><button class="btn primary" type="submit" form="rj">Reject</button>` });
      d.el.querySelector("[data-x]").addEventListener("click", () => d.close());
      d.el.querySelector("#rj").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const r = await save(d.el.querySelector('button[type="submit"]'), () => io.post(`intakes/${id}/decision`, { decision: "reject", note: d.el.querySelector("#rj_n").value }), { ok: "Rejected" });
        if (r) { d.close(); it = await io.get(`intakes/${id}`); paint(); }
      });
    });
  }
  async function cancel() {
    if (!(await confirmDialog({ title: "Cancel this intake?", text: "The draft and its photos and scans are deleted.", confirmLabel: "Cancel it", danger: true }))) return;
    try { await io.post(`intakes/${id}/cancel`, { reason: "cancelled in the form" }); toast("Cancelled", "ok"); location.hash = "#/intakes"; } catch (e) { toast(e.message, "err"); }
  }

  // the Sold token row binds through the price step
  const orig = after.price;
  after.price = (b) => { if (it.kind === "sold") after.price_sold(b); else orig(b); };
  if (it.kind === "sold") after.papers = (b) => bindUploads(b);
  paint();
  if (Object.keys(pending).length) { setSave("Sending what was kept on this phone…"); flush(); }
}
