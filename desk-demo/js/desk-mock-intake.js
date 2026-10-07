// Car intake sample answers for the static demo (SPEC-CAR-INTAKE.md 6.1 shapes): the "Cars in and out" list, the New car
// and Car sold forms, the pasted format read-back, photos, papers, the owner's money step, send, approve and reject.
// Everything lives in memory and is made up: no phone number, no real registration, chassis or price anywhere.
import { ApiError } from "./api.js";

const MUST = ["E01", "E03", "E05", "E08", "I01", "I08", "O01", "K01"];
const ANGLE = { E01: "Front three-quarter, driver's side", E03: "Side profile, driver's side", E05: "Rear three-quarter, driver's side", E08: "Straight rear",
  I01: "Dashboard, wide, from the back seat", I08: "Rear seats, driver's side", O01: "Odometer close-up", K01: "Boot open and empty" };
const STAFF_FMT = "NEW CAR\nMake:\nModel:\nVariant:\nMade (month year):\nRegistered (month year):\nReg number:\nReg type: Individual / Company\nChassis number:\nEngine number:\nFuel: Petrol / Diesel / CNG / Petrol+CNG / Hybrid / Electric\nGearbox: Manual / Automatic, and MT / AT / AMT / DCT / CVT / IVT\nKm:\nColour:\nOwners as per RC:\nBody: Hatchback / Sedan / SUV / MPV / Luxury sedan / Luxury SUV\nSeats:\nKeys:\nFeatures:\nWhere is it: Showroom / Yard / Workshop\nInsurance: Comprehensive / Zero dep / Third party / None\nInsurer:\nInsurance valid till:\nPolicy number:\nPUC valid till:\nLoan on RC: No / Yes, bank name, NOC got or to follow\nService record: Full / Partial up to ___ km / None / Not seen\nLast service: date, km\nWarranty till:\nWarning lights: None / what shows\nMarks: M01 where and what; M02 where and what\nRepainted panels:\nTyres FL FR RL RR: good / half / replace\nAccident or repair: what we know and how, or Not checked\nClaim history: the result, or Not checked\nWater damage: None found / Found ___ / Not checked\nChallans checked: Yes, date / No\nChecked by:\nLine: Bought / Park & Sell\nBought on:\nSeller type: Individual / Dealer / Exchange / Auction / Broker\nSeller name:\nSeller mobile:\nAsking price:\nNeeds work first: No / Yes, what and which workshop\nList on website: Now / After the work / No\nHeadline:\nSummary:\nVideo link:\nPapers in hand: RC, Insurance, PUC, Form 29, Form 30, Form 35, Bank NOC, Form 29C, Service book, Original invoice, Warranty card, Seller KYC, Purchase agreement\nPapers to follow: paper name and date, one per line\n\nPARK & SELL\nAgreement date:\nAgreement till:\nReserve price:\nCommission: percent / flat / above reserve, and the figure\nParking fee a month:\nRefurb paid by: Car owner / Us / Deduct from payout\n";
const OWNER_FMT = "\nOWNER ONLY\nPurchase price:\nBroker fee:\nPaid by: Cash / UPI / NEFT-RTGS / IMPS / Cheque / DD / Card, and which account\nFunding: Own money / With an investor\nInvestor: name, amount put in, profit share %\nLowest price:\nCosts so far: category, vendor, what, amount, paid by; one per line\n";
const SOLD_FMT = "CAR SOLD\nStock no:\nStage: Booked / Delivered\nDate:\nBuyer type: Individual / Company / Dealer\nBuyer name:\nBuyer mobile:\nSold by:\nLead number:\nFinal price:\nToken: amount, date, paid by\nReceived so far: amount, date, paid by; one per line\nLoan: No / Yes, lender, loan amount\nExchange car: No / Yes (send a NEW CAR for it)\nForm 29 signed (2 copies): Yes / No\nForm 30 signed (2 copies): Yes / No\nOriginal RC with us: Yes / No\nInsurance transfer: Not started / Applied / Done\nRC transfer: Not started / Papers with agent / Submitted to RTO / Done\nBuyer KYC: Got / To follow\nDelivery note signed: Yes / No\nInvoice number:\nOdometer at delivery:\n";
export function intakeFormat(kind, role) {
  return kind === "sold" ? SOLD_FMT + (role === "owner" ? "\nOWNER ONLY\nExchange value:\n" : "") : STAFF_FMT + (role === "owner" ? OWNER_FMT : "");
}

// what "Send" needs (the server's check(), shortened for the demo)
const REQ_NEW = [["make", "Make", "car"], ["model", "Model", "car"], ["variant", "Variant", "car"], ["mfg_month", "Made", "car"], ["reg_month", "Registered", "car"],
  ["reg_no", "Registration number", "car"], ["chassis_no", "Chassis number", "car"], ["engine_no", "Engine number", "car"], ["fuel", "Fuel", "specs"],
  ["transmission", "Gearbox", "specs"], ["kms", "Km", "specs"], ["colour", "Colour", "specs"], ["owner_serial", "Owners as per RC", "specs"], ["body_type", "Body", "specs"],
  ["keys_count", "Keys", "specs"], ["location", "Where is it", "specs"], ["checked_by", "Checked by", "condition"], ["warning_lights", "Warning lights", "condition"],
  ["service_record", "Service record", "condition"], ["accident", "Accident or repair", "condition"], ["claim_history", "Claim history", "condition"],
  ["water_damage", "Water damage", "condition"], ["insurance_type", "Insurance", "papers"], ["ownership", "Line (bought or Park & Sell)", "seller"],
  ["acquired_on", "Bought on", "seller"], ["seller_name", "Seller name", "seller"], ["list_on_site", "List on website", "price"], ["summary", "Summary", "price"]];
const REQ_SOLD = [["stock_no", "Stock number", "car"], ["stage", "Stage", "car"], ["date", "Date", "car"], ["buyer_type", "Buyer type", "buyer"],
  ["buyer_name", "Buyer name", "buyer"], ["sale_price", "Final price", "price"]];
const PAPER_NAMES = { rc: "RC", form29: "Form 29", form30: "Form 30" };
const W = { petrol: "Petrol", diesel: "Diesel", cng: "CNG", hybrid: "Hybrid", electric: "Electric", manual: "Manual", automatic: "Automatic", suv: "SUV", sedan: "Sedan",
  hatchback: "Hatchback", mpv: "MPV", comprehensive: "Comprehensive", zero_dep: "Zero dep", third_party: "Third party", individual: "Individual", company: "Company",
  walk_in_seller: "an individual", dealer_trade: "a dealer", now: "Now", after_work: "After the work", no: "No", full: "Full", partial: "Partial", showroom: "Showroom", yard: "Yard", workshop: "Workshop" };
const w = (v) => W[v] || (v ? String(v).replace(/_/g, " ") : "");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (m) => (/^\d{4}-\d{2}$/.test(m || "") ? `${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}` : m || "");
const inr = (n) => (Number.isFinite(n) ? "₹" + new Intl.NumberFormat("en-IN").format(n) : "");
const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;
const STOCK_LABEL = { CA101: "2021 Hyundai Creta SX", CA104: "2020 Renault Kwid" };
const soldLabel = (no) => (no ? `${no}${STOCK_LABEL[String(no).toUpperCase()] ? " · " + STOCK_LABEL[String(no).toUpperCase()] : ""}` : "");
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

const photo = (id, a) => ({ uuid: `demo-${id}-${a.toLowerCase()}`, slot: "photo", doc_type: null, entity: null, angle: a, bytes: 410000, sort: 0, valid_until: null, mime: "image/jpeg", label: ANGLE[a] || "", owner_only: false, can_open: true });
const paper = (id, dt) => ({ uuid: `demo-${id}-${dt}`, slot: "paper", doc_type: dt, entity: null, angle: null, bytes: 220000, sort: 0, valid_until: null, mime: "application/pdf", label: "", owner_only: dt === "purchase_agreement", can_open: true });

// the made-up cars ("Demo" in every name, no real registration digits: the reg number reads as the RTO code only)
const SELTOS = { make: "Kia", model: "Seltos", variant: "HTX 1.5 Petrol IVT", mfg_month: "2022-03", reg_month: "2022-04", reg_no: "MH02DEMO", reg_type: "individual",
  chassis_no: "DEMOCHASSIS0000A1", engine_no: "DEMOENGINE01", fuel: "petrol", transmission: "automatic", trans_detail: "IVT", kms: 31800, colour: "Glacier White",
  owner_serial: 1, body_type: "suv", seats: 5, keys_count: 2, features: ["Sunroof", "Rear camera", "Apple CarPlay / Android Auto"], location: "showroom",
  insurance_type: "comprehensive", insurer: "Demo Insurance Co", insurance_expiry: "2027-03-31", puc_expiry: "2027-01-15", loan: false, service_record: "full",
  warning_lights: "None", marks: [], tyres: "good, good, half, half", accident: "None known, checked by eye", claim_history: "Not checked", water_damage: "None found",
  checked_by: "Kabir (demo)", ownership: "invested", acquired_on: "2026-10-04", source: "walk_in_seller", seller_name: "Demo Seller 0301", asking_price: 1395000,
  list_on_site: "now", headline: "1st owner Seltos HTX automatic, full service history",
  summary: "Single-owner Seltos with the full service history at the authorised workshop. New front tyres, two keys, clean interior.",
  papers: { rc: { state: "got" }, insurance: { state: "got" }, puc: { state: "got" }, form29: { state: "got" }, form30: { state: "got" } } };
const CITY = { make: "Honda", model: "City", variant: "VX CVT", mfg_month: "2020-08", fuel: "petrol", transmission: "automatic", kms: 42500, colour: "Lunar Silver", owner_serial: 1, body_type: "sedan", location: "yard" };
const SOLD_KWID = { stock_no: "CA104", stage: "booked", date: "2026-10-05", buyer_type: "individual", buyer_name: "Demo Buyer 0203", sale_price: 395000,
  token: { amount: 25000, date: "2026-10-05", mode: "upi" }, sold_by: "Aarav (demo)" };

// "Already on the website?" (P1): made-up website cars that no Desk car is linked to yet, and what picking one fills in
const SITE_CARS = [
  { website_id: "toyota-innova-2019", label: "2019 Toyota Innova Crysta 2.4 VX", make: "Toyota", model: "Innova Crysta", variant: "2.4 VX", year: 2019, colour: "Silver (demo)",
    kms: 78500, fuel: "Diesel", trans: "Manual", status: "available", price: 1450000, price_on_request: false,
    fill: { make: "Toyota", model: "Innova Crysta", variant: "2.4 VX", reg_month: "2019-06", fuel: "diesel", transmission: "manual", trans_detail: "MT", kms: 78500,
      colour: "Silver (demo)", owner_serial: 1, body_type: "mpv", seats: 7, asking_price: 1450000, ownership: "invested" } },
  { website_id: "maruti-baleno-2020", label: "2020 Maruti Baleno Alpha", make: "Maruti", model: "Baleno", variant: "Alpha", year: 2020, colour: "Blue (demo)",
    kms: 61000, fuel: "Petrol", trans: "Manual", status: "available", price: 545000, price_on_request: false,
    fill: { make: "Maruti", model: "Baleno", variant: "Alpha", reg_month: "2020-01", fuel: "petrol", transmission: "manual", trans_detail: "MT", kms: 61000,
      colour: "Blue (demo)", owner_serial: 2, body_type: "hatchback", seats: 5, asking_price: 545000, ownership: "invested" } },
];
const brief = ({ fill, ...c }) => c;

/** The intake part of the demo store: one copy per demo role, changed in memory only. */
export function createIntakeStore({ role, me, myName, now }) {
  const meId = me?.id ?? 1, other = 9001, mgr = 9002;
  const salesman = role === "salesman";
  let next = 310, nextFile = 1, nextStock = 120;
  const list = [
    { id: 301, kind: "new_car", state: "submitted", via: "ask", version: 3, data: clone(SELTOS), files: [...MUST.map((a) => photo(301, a)), ...["rc", "insurance", "puc", "form29", "form30"].map((d) => paper(301, d))],
      money: { purchase_price: 1210000, purchase_mode: "neft_rtgs", funding: "own", floor_price: 1350000 }, money_state: "entered", created_by: salesman ? meId : other,
      created_by_name: "Kabir (demo)", created_at: ago(95), updated_at: ago(40), decision_note: null, car_id: null, stock_no: null, site_jobs: [] },
    { id: 302, kind: "new_car", state: "draft", via: "form", version: 2, data: clone(CITY), files: [photo(302, "E01"), photo(302, "E03")], money: {}, money_state: "pending",
      created_by: meId, created_by_name: myName, created_at: ago(30), updated_at: ago(12), decision_note: null, car_id: null, stock_no: null, site_jobs: [] },
    { id: 299, kind: "sold", state: "saved", via: "form", version: 4, data: clone(SOLD_KWID), files: [], money: {}, money_state: null,
      created_by: salesman ? other : mgr, created_by_name: "Demo Manager", created_at: ago(26 * 60), updated_at: ago(25 * 60), decision_note: null, car_id: 104, stock_no: "CA104", site_jobs: [] },
  ].filter((x) => !salesman || x.created_by === meId);
  const linkedIds = new Set();
  const siteCar = (wid) => SITE_CARS.find((c) => c.website_id === String(wid || "").toLowerCase()) || null;
  const unlinked = () => SITE_CARS.filter((c) => !linkedIds.has(c.website_id));
  function ago(min) { return now(-min); }
  const find = (id) => { const it = list.find((x) => x.id === +id); if (!it) throw new ApiError(404, "not_found", "This intake is not in the demo."); return it; };

  function photosOf(it) {
    const ph = it.files.filter((f) => f.slot === "photo");
    const have = new Set(ph.map((f) => f.angle));
    return { must_in: MUST.filter((a) => have.has(a)).length, must: MUST.length, have: ph.length, missing_must: MUST.filter((a) => !have.has(a)) };
  }
  function checks(it) {
    const d = it.data, missing = [], site = [], problems = {};
    const empty = (v) => v == null || v === "" || (Array.isArray(v) && !v.length);
    if (it.kind === "new_car") {
      for (const [k, t, s] of REQ_NEW) if (empty(d[k])) missing.push({ field: k, text: t, step: s });
      if (empty(d.asking_price) && !d.price_on_request) missing.push({ field: "asking_price", text: "Asking price (or on request)", step: "price" });
      for (const k of Object.keys(PAPER_NAMES)) if (!(d.papers || {})[k]?.state) missing.push({ field: "papers", text: `${PAPER_NAMES[k]} (upload it or mark it to follow)`, step: "papers" });
      const ph = photosOf(it);
      if (d.website_id) { /* linked to a car already on the website: its photos are there */ }
      else if (ph.missing_must.length) { missing.push({ field: "photos", text: `${ph.missing_must.length} must-have photo${ph.missing_must.length === 1 ? "" : "s"}`, step: "photos" }); site.push("the 8 must-have photos"); }
      if (empty(d.summary)) site.push("a summary");
    } else {
      for (const [k, t, s] of REQ_SOLD) if (empty(d[k])) missing.push({ field: k, text: t, step: s });
      const sc = d.stock_no ? siteCar(d.stock_no) : null;
      if (sc && !linkedIds.has(sc.website_id)) problems.car_id = `${sc.website_id} is only on the website, not in the Desk yet. Link it first with "Already on the website?" in New car (step 1), then send this again.`;
    }
    return { missing, problems, warnings: [], site_missing: site };
  }
  function readback(it) {
    const d = it.data, out = [], add = (label, value, flag = null) => { if (value) out.push({ label, value, flag }); };
    const ph = photosOf(it), chk = checks(it);
    add(it.kind === "new_car" ? "NEW CAR" : "CAR SOLD", it.state === "draft" ? `draft #${it.id} · please check` : `#${it.id} · ${it.state}`);
    if (it.kind === "new_car") {
      add("Car", [(d.mfg_month || "").slice(0, 4), d.make, d.model, d.variant].filter(Boolean).join(" ") + (d.transmission ? ` · ${w(d.transmission)}${d.trans_detail ? ` (${d.trans_detail})` : ""}` : ""));
      add("Dates", [d.mfg_month && `Made ${month(d.mfg_month)}`, d.reg_month && `Registered ${month(d.reg_month)}`, d.reg_type && w(d.reg_type)].filter(Boolean).join(" · "));
      if (d.reg_no) add("Reg", `${d.reg_no} → the website shows ${d.reg_no.slice(0, 4)} only`);
      add("Numbers", [d.chassis_no && `Chassis ends ${d.chassis_no.slice(-4)}`, d.engine_no && `Engine ends ${d.engine_no.slice(-4)}`].filter(Boolean).join(" · "));
      add("Specs", [w(d.fuel), d.kms != null && `${new Intl.NumberFormat("en-IN").format(d.kms)} km`, d.colour, d.owner_serial && `${ordinal(d.owner_serial)} owner`, w(d.body_type), d.seats && `${d.seats} seats`, d.keys_count && `${d.keys_count} keys`].filter(Boolean).join(" · "));
      if (d.features?.length) add("Features", d.features.join(", "));
      add("Papers", [d.insurance_type && `Insurance: ${w(d.insurance_type)}`, d.puc_expiry && `PUC till ${d.puc_expiry}`, d.loan === false ? "No loan" : d.loan ? "Loan on the RC" : ""].filter(Boolean).join(" · "));
      add("Condition", [d.warning_lights && (String(d.warning_lights).toLowerCase() === "none" ? "no warning lights" : `warning lights: ${d.warning_lights}`), `${(d.marks || []).length} marks`, d.tyres && `tyres ${d.tyres}`].filter(Boolean).join(" · "));
      if (d.ownership) add("Seller", `${d.ownership === "park_n_sell" ? "Park & Sell" : "Bought by us"}${d.acquired_on ? ` on ${d.acquired_on}` : ""}${d.source ? ` from ${w(d.source)}` : ""}`);
      if (d.price_on_request) add("Asking price", "on request"); else if (d.asking_price) add("Asking price", inr(d.asking_price));
      const words = [d.headline, d.summary].filter(Boolean).map((x) => x.trim().replace(/\.$/, "") + ".").join(" ");
      if (words) add("Website words", `"${words.slice(0, 160)}${words.length > 160 ? "..." : ""}"`);
      if (d.website_id) add("Already on the website", `${siteCar(d.website_id)?.label || d.website_id} (${d.website_id}): linked, not listed again. The website copy gets these details.`);
      else {
        add("List on website", w(d.list_on_site || "now"));
        const same = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();
        const show = ["draft", "submitted"].includes(it.state) ? unlinked().filter((c) => !d.make || (same(c.make, d.make) && (!d.model || same(c.model, d.model)))) : [];
        if (show.length) add("Already on the website?", `${show.slice(0, 3).map((c) => `${c.label} (${c.website_id})`).join("; ")}. If it is this car, pick it in step 1 of the form so it is linked, not listed twice.`, "warn");
      }
      add("Photos", `${ph.must_in} of ${ph.must} must-haves · ${ph.have} in all`, ph.missing_must.length ? "warn" : null);
      if (role === "owner" && it.money?.purchase_price) add("Buying price", inr(it.money.purchase_price), "owner");
      if (role === "owner" && it.money?.floor_price) add("Lowest price", inr(it.money.floor_price), "owner");
    } else {
      add("Car", soldLabel(d.stock_no));
      add("Stage", { booked: "Booked (token taken)", delivered: "Delivered (the car has left)" }[d.stage] || "");
      add("Date", d.date);
      add("Buyer", d.buyer_name ? `${d.buyer_name}${d.buyer_type ? " · " + w(d.buyer_type) : ""}` : "");
      add("Sold by", d.sold_by);
      add("Final price", d.sale_price ? inr(d.sale_price) : "");
      if (d.token?.amount) add("Token", `${inr(d.token.amount)}${d.token.date ? " on " + d.token.date : ""}${d.token.mode ? " · " + d.token.mode.toUpperCase() : ""}`);
    }
    for (const u of it.unknown_lines || []) add("Not understood", `"${u.line}"`, "warn");
    if (it.dropped_owner_lines) add("Kept out", `${it.dropped_owner_lines} owner-only line${it.dropped_owner_lines === 1 ? "" : "s"}. The owner adds ${it.dropped_owner_lines === 1 ? "it" : "them"} from his login.`, "warn");
    if (it.state === "draft" && chk.missing.length) add("Still needed to send", chk.missing.map((m) => m.text).slice(0, 12).join(", "), "neg");
    if (it.kind === "new_car" && chk.site_missing.length) add("Still needed before the website", chk.site_missing.join(", "), "warn");
    return out;
  }
  function out(it) {
    const mine = it.created_by === meId, chk = checks(it);
    const o = { id: it.id, kind: it.kind, state: it.state, via: it.via, version: it.version, data: clone(it.data), files: clone(it.files), checks: chk,
      photos: photosOf(it), money_state: it.money_state, list_on_site: it.data.list_on_site || null, car_id: it.car_id, deal_id: null, site_jobs: clone(it.site_jobs),
      readback: readback(it), created_by: it.created_by, created_by_name: it.created_by_name, created_at: it.created_at, updated_at: it.updated_at,
      decision_note: it.decision_note, unknown_lines: it.unknown_lines || [], dropped_owner_lines: it.dropped_owner_lines || 0,
      can: { edit: (it.state === "draft" && mine) || (it.state === "submitted" && !salesman), submit: it.state === "draft" && mine, decide: it.state === "submitted" && !mine && !salesman,
        money: role === "owner" && it.kind === "new_car" && ["draft", "submitted", "saved"].includes(it.state), cancel: ["draft", "submitted"].includes(it.state) && (mine || !salesman) } };
    if (it.stock_no) o.stock_no = it.stock_no;
    if (role === "owner") o.money = clone(it.money || {});
    return o;
  }
  const label = (it) => (it.kind === "new_car" ? [(it.data.mfg_month || "").slice(0, 4), it.data.make, it.data.model, it.data.variant].filter(Boolean).join(" ") || "New car" : soldLabel(it.data.stock_no) || "Car sold");
  function row(it) {
    const chk = checks(it);
    return { id: it.id, kind: it.kind, state: it.state, via: it.via, label: label(it), created_by: it.created_by, created_by_name: it.created_by_name, updated_at: it.updated_at,
      missing: ["draft", "submitted"].includes(it.state) ? chk.missing.map((m) => m.text) : [], site_missing: chk.site_missing, money_state: it.money_state, car_id: it.car_id,
      site_state: it.car_id && it.kind === "new_car" ? (it.site_jobs.length ? "waiting" : "not_listed") : null, waiting_for_me: it.state === "submitted" && it.created_by !== meId && !salesman };
  }
  const touch = (it) => { it.version += 1; it.updated_at = now(); };

  // ---------------------------------------------------------------- the format reader (the demo's short version of parse())
  const KEYS = { make: "make", brand: "make", model: "model", variant: "variant", made: "mfg_month", mfg: "mfg_month", registered: "reg_month", regnumber: "reg_no", regno: "reg_no",
    regtype: "reg_type", chassisnumber: "chassis_no", chassis: "chassis_no", enginenumber: "engine_no", fuel: "fuel", gearbox: "gearbox", transmission: "gearbox", km: "kms", kms: "kms",
    colour: "colour", color: "colour", owners: "owner_serial", ownersasperrc: "owner_serial", body: "body_type", seats: "seats", keys: "keys_count", features: "features",
    whereisit: "location", insurance: "insurance_type", insurer: "insurer", servicerecord: "service_record", warninglights: "warning_lights", accidentorrepair: "accident",
    claimhistory: "claim_history", waterdamage: "water_damage", checkedby: "checked_by", line: "ownership", boughton: "acquired_on", sellertype: "source", sellername: "seller_name",
    askingprice: "asking_price", price: "asking_price", listonwebsite: "list_on_site", headline: "headline", summary: "summary", tyres: "tyres", tyresflfrrlrr: "tyres",
    papersinhand: "papers_in_hand", stockno: "stock_no", stage: "stage", date: "date", buyertype: "buyer_type", buyername: "buyer_name", soldby: "sold_by", finalprice: "sale_price" };
  const OWNER_KEYS = new Set(["purchaseprice", "boughtfor", "buyingprice", "brokerfee", "paidby", "funding", "investor", "lowestprice", "costssofar", "exchangevalue"]);
  const SKIP = new Set(["sellermobile", "buyermobile", "insurancevalidtill", "policynumber", "pucvalidtill", "loanonrc", "lastservice", "warrantytill", "marks", "repaintedpanels",
    "challanschecked", "needsworkfirst", "videolink", "paperstofollow", "agreementdate", "agreementtill", "reserveprice", "commission", "parkingfeeamonth", "refurbpaidby",
    "leadnumber", "token", "receivedsofar", "loan", "exchangecar", "form29signed2copies", "form30signed2copies", "originalrcwithus", "insurancetransfer", "rctransfer",
    "buyerkyc", "deliverynotesigned", "invoicenumber", "odometeratdelivery"]);
  const rupees = (v) => { const t = String(v).replace(/[₹,\s]|rs\.?|\/-/gi, ""); return /^\d{4,9}$/.test(t) ? +t : null; };
  function monthOf(v) {
    const t = String(v).trim(); let m = /^(\d{1,2})[/-](\d{4})$/.exec(t); if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
    m = /^([a-z]{3})[a-z]*\s+(\d{4})$/i.exec(t); if (m) { const i = MONTHS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase()); if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, "0")}`; }
    m = /^(\d{4})$/.exec(t); return m ? `${m[1]}-01` : null;
  }
  function parse(kind, text) {
    const data = {}, unknown = []; let dropped = 0;
    for (const line of String(text).split(/\r?\n/).slice(1)) {
      const m = /^\s*([^:]{1,60}?)\s*:\s*(.*)$/.exec(line);
      if (!m) { if (line.trim() && !/^(park & sell|owner only)$/i.test(line.trim())) unknown.push({ line: line.trim().slice(0, 80), hint: null }); continue; }
      const k = m[1].replace(/\(.*?\)/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""), v = m[2].trim();
      if (!v || /\s\/\s/.test(v)) continue;                       // left as the format wrote it
      if (OWNER_KEYS.has(k)) { if (role !== "owner") dropped += 1; continue; }
      if (SKIP.has(k)) continue;
      const key = KEYS[k];
      if (!key) { unknown.push({ line: line.trim().slice(0, 80), hint: null }); continue; }
      if (["mfg_month", "reg_month"].includes(key)) { const mo = monthOf(v); if (mo) data[key] = mo; else unknown.push({ line: line.trim(), hint: "month and year, like Mar 2022" }); }
      else if (["kms", "seats", "keys_count", "owner_serial"].includes(key)) { const n = +v.replace(/[^\d]/g, ""); if (n) data[key] = n; }
      else if (["asking_price", "sale_price"].includes(key)) { const n = rupees(v); if (n) data[key] = n; else unknown.push({ line: line.trim(), hint: "full rupees, like 12,45,000" }); }
      else if (key === "gearbox") { data.transmission = /auto|at|cvt|ivt|dct|amt/i.test(v) ? "automatic" : "manual"; const t = /\b(MT|AT|AMT|DCT|CVT|IVT)\b/i.exec(v); if (t) data.trans_detail = t[1].toUpperCase(); }
      else if (key === "features") data.features = v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
      else if (key === "ownership") data.ownership = /park/i.test(v) ? "park_n_sell" : "invested";
      else if (key === "reg_no") data.reg_no = v.toUpperCase().replace(/[\s.-]/g, "");
      else if (key === "papers_in_hand") { data.papers = {}; for (const p of v.split(",").map((x) => x.trim().toLowerCase())) { const pk = { rc: "rc", insurance: "insurance", puc: "puc", "form 29": "form29", "form 30": "form30" }[p]; if (pk) data.papers[pk] = { state: "got" }; } }
      else data[key] = ["fuel", "body_type", "location", "insurance_type", "service_record", "list_on_site", "reg_type", "stage", "buyer_type"].includes(key) ? v.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "") : v;
    }
    if (data.source) data.source = { individual: "walk_in_seller", dealer: "dealer_trade" }[data.source.toLowerCase()] || data.source.toLowerCase();
    return { data, unknown_lines: unknown.slice(0, 8), dropped_owner_lines: dropped };
  }
  function create(kind, via) {
    const it = { id: next++, kind, state: "draft", via, version: 1, data: {}, files: [], money: {}, money_state: kind === "new_car" ? "pending" : null, created_by: meId,
      created_by_name: myName, created_at: now(), updated_at: now(), decision_note: null, car_id: null, stock_no: null, site_jobs: [] };
    list.unshift(it);
    return it;
  }
  function submit(it) {
    const chk = checks(it);
    if (chk.missing.length || Object.keys(chk.problems).length) throw new ApiError(400, "validation", Object.values(chk.problems)[0] || "Some things are still needed.", { checks: { missing: chk.missing, problems: chk.problems } });
    touch(it);
    if (salesman && it.kind === "new_car") { it.state = "submitted"; return { state: "submitted", next: ["Sent to the manager for approval."] }; }
    return save(it);
  }
  function save(it) {
    it.state = "saved"; touch(it);
    if (it.kind === "new_car") {
      it.car_id = 900 + it.id; it.stock_no = `CA${nextStock++}`;
      if (it.data.website_id) {
        linkedIds.add(it.data.website_id);
        it.site_jobs = [{ id: it.id, kind: "edit_car", state: "waiting", note: "Demo: in the real app the website car is linked to this Desk car now.", created_at: now(), updated_at: now() }];
        return { state: "saved", next: [`Saved as ${it.stock_no} in Stock.`, `Linked to the website car ${it.data.website_id}: no new listing.`] };
      }
      it.site_jobs = [{ id: it.id, kind: "add_car", state: "waiting", note: "Demo: in the real app the website job starts now.", created_at: now(), updated_at: now() }];
      return { state: "saved", next: [`Saved as ${it.stock_no} in Stock.`, "Website: sending."] };
    }
    return { state: "saved", next: ["The deal and the car are updated."] };
  }

  /** A NEW CAR or CAR SOLD pasted in Ask Claude: the draft it makes, and the read-back card the chat shows. */
  function fromText(text, photoCount = 0) {
    const kind = /^\s*(car sold|sold car)/i.test(text) ? "sold" : "new_car";
    const it = create(kind, "ask");
    const p = parse(kind, text);
    Object.assign(it.data, p.data); it.unknown_lines = p.unknown_lines; it.dropped_owner_lines = p.dropped_owner_lines;
    const have = new Set();
    for (let i = 0; i < photoCount; i += 1) { const a = MUST.find((x) => !have.has(x)); if (!a) break; have.add(a); it.files.push(photo(it.id, a)); }
    return it;
  }
  function card(it, actionId, state = "proposed") {
    const chk = checks(it), ph = photosOf(it);
    const c = { type: "readback", action_id: actionId, kind: it.kind === "sold" ? "sale" : "new_car", state, version: it.version, mine: true, decision_note: null,
      intake_id: it.id, intake_state: it.state, intake_version: it.version, lines: readback(it).filter((l) => it.state === "draft" || l.label !== "Still needed to send"),
      missing: it.state === "draft" ? chk.missing.map((m) => m.text) : [], href: `#/intake/${it.id}` };
    if (it.kind === "new_car") {
      c.photos = { must_in: ph.must_in, must: ph.must, have: ph.have, grid: it.files.filter((f) => f.slot === "photo").map((f) => ({ angle: f.angle, label: f.label, thumb: "" })), fix_href: `#/intake/${it.id}?step=photos` };
      c.papers = it.files.filter((f) => f.slot === "paper").map((f) => ({ doc_type: f.doc_type, owner_only: f.owner_only }));
    }
    if (it.stock_no) { c.stock_no = it.stock_no; c.car_href = "#/inventory"; c.site = { state: "waiting", label: "Waiting" }; }
    if (it.state === "submitted") c.state = "waiting_approval";
    c.can_yes = c.state === "proposed" && !c.missing.length;
    return c;
  }

  return {
    fromText, card, submit, find,
    get(path, params = {}) {
      if (path === "intakes/format") return params.kind === "edit_car" ? undefined : { text: intakeFormat(params.kind, role) };
      if (path === "intakes") return { data: list.map(row) };
      if (path === "intakes/site-cars") return { data: unlinked().map(brief) };
      const m = path.match(/^intakes\/(\d+)$/);
      if (m) return out(find(m[1]));
      return undefined;
    },
    send(method, path, body = {}) {
      if (path === "intakes" && method === "POST") { const it = create(body.kind === "sold" ? "sold" : "new_car", body.via || "form"); return { id: it.id, state: it.state, version: it.version }; }
      if (path === "intakes/parse") {
        const p = parse(body.kind || "new_car", body.text || "");
        if (body.intake_id) { const it = find(body.intake_id); Object.assign(it.data, p.data); it.unknown_lines = p.unknown_lines; it.dropped_owner_lines = p.dropped_owner_lines; touch(it); return { intake: out(it), unknown_lines: p.unknown_lines, dropped_owner_lines: p.dropped_owner_lines, problems: {} }; }
        return { data: p.data, unknown_lines: p.unknown_lines, dropped_owner_lines: p.dropped_owner_lines, problems: {} };
      }
      let m = path.match(/^intakes\/(\d+)$/);
      if (m && method === "PATCH") {
        const it = find(m[1]);
        if (body.version !== it.version) throw new ApiError(409, "version_conflict", "Someone else changed this draft.");
        const wid = (body.data || {}).website_id;
        if (wid && wid !== it.data.website_id) {
          const sc = siteCar(wid);
          if (!sc || linkedIds.has(sc.website_id)) throw new ApiError(409, "website_linked", "That website car is already linked (demo).");
          for (const [k, v] of Object.entries(sc.fill)) if (it.data[k] == null || it.data[k] === "") it.data[k] = v;
        }
        for (const [k, v] of Object.entries(body.data || {})) { if (v == null) delete it.data[k]; else it.data[k] = ["asking_price", "sale_price"].includes(k) && typeof v === "string" ? rupees(v) ?? v : v; }
        touch(it);
        return out(it);
      }
      m = path.match(/^intakes\/(\d+)\/files\/([\w-]+)$/);
      if (m && method === "DELETE") { const it = find(m[1]); it.files = it.files.filter((f) => f.uuid !== m[2]); touch(it); return { ok: true }; }
      m = path.match(/^intakes\/(\d+)\/(money|submit|decision|cancel)$/);
      if (m) {
        const it = find(m[1]);
        if (m[2] === "money") { if (role !== "owner") throw new ApiError(403, "forbidden", "Only the owner's login adds money."); Object.assign(it.money, body); it.money_state = "entered"; touch(it); return { ok: true }; }
        if (m[2] === "submit") return submit(it);
        if (m[2] === "cancel") { it.state = "cancelled"; touch(it); return { ok: true }; }
        if (body.decision === "reject") { it.state = "rejected"; it.decision_note = String(body.note || "").slice(0, 300) || "Not approved."; touch(it); return { state: "rejected" }; }
        return save(it);
      }
      return undefined;
    },
    upload(path, fd) {
      const m = path.match(/^intakes\/(\d+)\/files$/);
      if (!m) return undefined;
      const it = find(m[1]), slot = String(fd.get("slot") || "paper");
      const f = slot === "photo" ? photo(it.id, String(fd.get("angle") || `X${String(nextFile).padStart(2, "0")}`)) : paper(it.id, String(fd.get("doc_type") || "rc"));
      f.uuid = `${f.uuid}-${nextFile++}`;
      it.files.push(f); touch(it);
      return { uuid: f.uuid, slot: f.slot };
    },
  };
}
