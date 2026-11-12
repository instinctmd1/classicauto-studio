// Maintenance for the static public demo: an in-memory copy of made-up work on the demo's stock list, in the JSON shapes of
// MAINT-SPEC.md. Every car, task, bill and photo is invented: staff names are fictional ("(demo)"), the photos are drawn pictures,
// there is no phone number and no real registration anywhere. The cars are the first in-stock cars of the stock list the demo
// already shows (loaded through `load`, never their prices); a small made-up list stands in when the recording has none.
// Every action changes the in-memory copy only. get/send/upload are async (desk-mock.js clones what get/send return).
import { ApiError } from "./api.js";
import { state } from "./state.js";
import { nowMs } from "./util.js";

const IN_STOCK = ["incoming", "refurb", "available", "booked"];
const FALLBACK = [
  [1, "CA201", "Hyundai", "Creta", "SX", 2021, "petrol", "automatic", "White", 38200], [2, "CA202", "Maruti Suzuki", "Baleno", "Zeta", 2019, "petrol", "manual", "Grey", 52100],
  [3, "CA203", "Honda", "City", "VX", 2020, "diesel", "manual", "Silver", 61800], [4, "CA204", "Tata", "Nexon", "XZ+", 2022, "petrol", "automatic", "Blue", 21400],
  [5, "CA205", "Kia", "Seltos", "HTX", 2021, "diesel", "automatic", "Black", 44900], [6, "CA206", "Toyota", "Innova Crysta", "GX", 2018, "diesel", "manual", "Bronze", 88300],
  [7, "CA207", "Renault", "Kwid", "RXT", 2020, "petrol", "manual", "Red", 29800], [8, "CA208", "Skoda", "Rapid", "Style", 2019, "petrol", "automatic", "White", 47600],
].map(([id, stock_no, make, model, variant, mfg_year, fuel, transmission, colour, kms_at_intake]) => ({ id, stock_no, make, model, variant, mfg_year, fuel, transmission, colour, kms_at_intake, status: ["available", "refurb", "incoming", "booked"][id % 4], reg_no: null }));

const CHECKLIST = ["Exterior wash and detailing", "Interior deep clean", "Engine bay clean", "Tyre pressure, with a photo of the tread", "Fluids topped up (engine oil, coolant, brake, washer)", "Battery check", "All lights working", "AC cooling check",
  "Warning lights off on the cluster (photo)", "Both keys present", "Papers in the file (RC, insurance, PUC)", "Website photo set taken", "Final road test"];
const ISSUES = ["Scratch on the rear bumper, left side", "AC cooling is weak", "Driver door lock is stiff", "Front left tyre is worn", "Speaker crackles on the music system", "Small dent on the rear quarter panel", "Wiper blades are split"];
const VENDORS = ["Sample Auto Works", "Demo Tyre House", "Test Denting and Paint", "Demo Car Care"];
const STAFF = ["Imran (demo)", "Suresh (demo)"];
const MANAGER = "Demo Manager";

// ------------------------------------------------------------------ the inspection template (the 10 sections of the plan)
const C = "condition", W = "working", T = "tread", Y = "yesno", N = "number", X = "text", D = "date";
const sec = (key, title, weight, items) => ({ key, title, weight, items: items.map(([k, label, type, extra]) => ({ key: k, label, type, ...(extra || {}) })) });
const pair = (k, l, type) => [[`${k}_l`, `${l}, left`, type], [`${k}_r`, `${l}, right`, type]];
const TEMPLATE = {
  sections: [
    sec("body_frame", "Body and frame", 2, [...pair("a_pillar", "A pillar", C), ...pair("b_pillar", "B pillar", C), ...pair("c_pillar", "C pillar", C), ...pair("apron", "Apron and leg", C),
      ["front_cross", "Front cross member", C], ["firewall", "Firewall", C], ["cowl_top", "Cowl top", C], ["radiator_support", "Radiator support", C], ["headlight_support", "Headlight support", C], ["boot_floor", "Boot floor", C],
      ["roof", "Roof", C], ["running_boards", "Running boards", C], ["chassis_frame", "Chassis frame", C], ["punches", "Robotic punches are original", C], ["waterlogged", "Signs of the car having been in water", Y, { bad_if_yes: true }]]),
    sec("exterior", "Exterior panels and glass", 1, [["bonnet", "Bonnet", C], ...pair("fender", "Fender", C), ["door_fl", "Door, front left", C], ["door_fr", "Door, front right", C], ["door_rl", "Door, rear left", C], ["door_rr", "Door, rear right", C], ["boot_door", "Boot door", C],
      ...pair("quarter", "Quarter panel", C), ["bumper_f", "Front bumper", C], ["bumper_r", "Rear bumper", C], ["windscreen_f", "Front windscreen", C], ["windscreen_r", "Rear windscreen", C], ["door_glass", "Door glasses", C], ...pair("orvm", "Mirror (fold motor)", C), ["number_plates", "Number plates", C]]),
    sec("engine", "Engine and transmission", 2, [["engine_sound", "Engine sound", C], ["smoke", "Exhaust smoke", C], ["oil", "Engine oil level and quality", C], ["coolant", "Coolant", C], ["mountings", "Engine mountings", C], ["radiator_fan", "Radiator and fan", C],
      ["sump_leak", "Sump or other leaks", C], ["blowby", "Blow-by", C], ["pickup", "Pickup", C], ["clutch", "Clutch", C], ["gear_shift", "Gear shifting", C], ["gearbox_noise", "Gearbox noise", C], ["battery", "Battery", W]]),
    sec("steering", "Steering, suspension and brakes", 1.5, [["steering", "Steering", C], ["strut_l", "Front strut, left", C], ["strut_r", "Front strut, right", C], ["shock_l", "Rear shock, left", C], ["shock_r", "Rear shock, right", C], ["brakes", "Brakes", C], ["handbrake", "Handbrake", C]]),
    sec("ac", "Air conditioning", 0.5, [["ac_cooling", "Cooling", C], ["heater", "Heater", C], ["climate", "Climate control", W], ["blower", "Blower", W]]),
    sec("electrical", "Electricals and interior", 1, [["win_fl", "Power window, front left", W], ["win_fr", "Power window, front right", W], ["win_rl", "Power window, rear left", W], ["win_rr", "Power window, rear right", W], ["music", "Music system", W], ["wheel_controls", "Steering wheel controls", W],
      ["cluster", "Warning lights on the cluster (ABS, SRS, engine, oil, battery)", W], ["starter", "Self starter", W], ["wipers", "Wipers", W], ["parking", "Parking sensors and camera", W], ["seats", "Seats and upholstery", C], ["dashboard", "Dashboard", C], ["roof_lining", "Roof lining", C], ["airbags", "Number of airbags", N]]),
    sec("lights", "Lights", 0.5, [["headlights", "Headlights", W], ["taillights", "Tail lights", W], ["fog", "Fog lights", W], ["indicators", "Indicators", W]]),
    sec("tyres", "Tyres and wheels", 1, [["tyre_fl", "Tyre, front left (tread)", T], ["tyre_fr", "Tyre, front right (tread)", T], ["tyre_rl", "Tyre, rear left (tread)", T], ["tyre_rr", "Tyre, rear right (tread)", T], ["spare", "Spare tyre (tread)", T], ["dot", "Tyre make year (DOT) of the four tyres", X], ["alloys", "Alloy wheels", C], ["toolkit", "Toolkit and jack", C]]),
    sec("papers", "Papers and identity", 0.5, [["rc", "RC is with us", Y], ["owner_no", "Owner number as per RC", N], ["insurance_type", "Insurance type", X], ["insurance_expiry", "Insurance valid till", D], ["puc", "PUC valid till", D], ["hypothecation", "Hypothecation and NOC", X], ["keys", "Number of keys", N],
      ["chassis_imprint", "Chassis imprint matches the RC", C], ["vin_plate", "VIN plate", C], ["challans", "Challans pending (₹)", N], ["service_history", "Service history", X]]),
    sec("road_test", "Road test", 1.5, [["rt_pickup", "Pickup", C], ["rt_braking", "Braking", C], ["rt_pull", "Pulls to one side", C], ["rt_noise", "Noise from the suspension or body", C], ["rt_ac", "Air conditioning under load", C]]),
  ],
  photo_slots: [["front", "Front"], ["rear", "Rear"], ["left", "Left side"], ["right", "Right side"], ["q_fl", "Front left corner"], ["q_fr", "Front right corner"], ["q_rl", "Rear left corner"], ["q_rr", "Rear right corner"],
    ["engine_1", "Engine bay, from the front"], ["engine_2", "Engine bay, from the side"], ["boot", "Boot, open and empty"], ["dashboard", "Dashboard, ignition on"], ["odometer", "Odometer close-up"],
    ["tyre_fl", "Tyre, front left"], ["tyre_fr", "Tyre, front right"], ["tyre_rl", "Tyre, rear left"], ["tyre_rr", "Tyre, rear right"], ["chassis", "Chassis imprint"], ["vin", "VIN plate"]].map(([key, label]) => ({ key, label })),
  labels: [{ min: 8.5, label: "Excellent" }, { min: 7, label: "Good" }, { min: 5, label: "Average" }, { min: 0, label: "Poor" }],
};
const ITEM = Object.fromEntries(TEMPLATE.sections.flatMap((s) => s.items.map((it) => [it.key, { ...it, section: s.key }])));
const RATED = new Set([C, W, T, Y]);
const BAD = new Set(["minor", "major", "not_working", "lt40"]);
const isBad = (it, v) => BAD.has(v) || (!!it.bad_if_yes && v === "yes");
const penalty = (it, v) => (v === "major" || (it.bad_if_yes && v === "yes") ? 3 : isBad(it, v) ? 1 : 0);
const labelOf = (o) => (TEMPLATE.labels.find((l) => o >= l.min) || { label: "Poor" }).label;

// ------------------------------------------------------------------ drawn pictures (no real photo anywhere)
const blobs = new Map();
const blobUrl = (key, svg) => { if (!blobs.has(key)) blobs.set(key, URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))); return blobs.get(key); };
const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const xml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function photo(label, seed = label) {
  const h = hue(seed), k = `p:${label}:${seed}`;
  return blobUrl(k, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${h},28%,34%)"/><stop offset="1" stop-color="hsl(${h},30%,16%)"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#g)"/><rect y="214" width="400" height="86" fill="hsl(${h},12%,12%)"/>
    <g transform="translate(70 96) scale(1.3)"><path d="M10 70 L24 70 Q30 52 52 50 L78 34 Q86 30 100 30 L132 30 Q144 30 152 38 L166 54 Q184 56 190 66 L190 76 L10 76 Z" fill="hsl(${h},10%,88%)"/><path d="M62 52 L82 38 L100 38 L100 52 Z M108 52 L108 38 L130 38 L146 52 Z" fill="hsl(${h},30%,24%)"/><circle cx="52" cy="76" r="14" fill="#111"/><circle cx="52" cy="76" r="6" fill="#999"/><circle cx="150" cy="76" r="14" fill="#111"/><circle cx="150" cy="76" r="6" fill="#999"/></g>
    <rect x="0" y="254" width="400" height="46" fill="rgba(4,9,22,.7)"/><text x="14" y="282" font-family="Arial,sans-serif" font-size="19" font-weight="700" fill="#fff">${xml(label)}</text><text x="386" y="30" text-anchor="end" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="rgba(255,255,255,.7)">DEMO PICTURE</text></svg>`);
}
function bill(vendor, amount) {
  return blobUrl(`b:${vendor}:${amount}`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect width="300" height="420" fill="#EDEAE0"/><rect x="24" y="16" width="252" height="388" fill="#fff"/>
    <text x="150" y="58" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#0A1633">${xml(vendor)}</text><text x="150" y="78" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#555">Cash memo (demo, not a real bill)</text>
    ${[110, 140, 170, 200].map((y) => `<line x1="44" x2="256" y1="${y}" y2="${y}" stroke="#ccc" stroke-dasharray="3 3"/>`).join("")}
    <text x="44" y="130" font-family="Arial,sans-serif" font-size="13" fill="#222">Parts and labour</text><text x="256" y="130" text-anchor="end" font-family="Arial,sans-serif" font-size="13" fill="#222">${xml(new Intl.NumberFormat("en-IN").format(amount))}</text>
    <text x="44" y="330" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#0A1633">TOTAL</text><text x="256" y="330" text-anchor="end" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#0A1633">Rs ${xml(new Intl.NumberFormat("en-IN").format(amount))}</text></svg>`);
}

const err = (status, code, msg, body) => new ApiError(status, code, msg, null, body || null);
const istStr = (ms) => new Date(ms + 5.5 * 36e5).toISOString().slice(0, 19).replace("T", " ");

export function createMaintStore({ role, myName, load }) {
  const owner = role === "owner", verifier = role === "owner" || role === "manager";
  let cars = null, nextTask = 100, nextEv = 500, nextInsp = 20, nextPhoto = 900;
  const inspections = new Map(), taskCar = new Map();
  const now = () => istStr(nowMs());
  const ago = (min) => istStr(nowMs() - min * 60000);
  const today = () => state.today;
  const dayAgo = (n) => new Date(Date.parse(today()) - n * 864e5).toISOString().slice(0, 10);

  // ---------------------------------------------------------------- the made-up work on each car
  async function init() {
    if (cars) return;
    let rows = null;
    try { const r = load && await load("cars", { page_size: 200, scope: "all" }); rows = r && r.data; } catch { rows = null; }
    rows = (rows || []).filter((c) => IN_STOCK.includes(c.status)).slice(0, 12);
    if (rows.length < 6) rows = FALLBACK;
    cars = rows.map(build);
    cars.forEach((c) => c.tasks.forEach((t) => taskCar.set(t.id, c)));
  }
  const ev = (kind, label, by, minAgo, extra) => ({ id: nextEv++, kind, url: kind === "bill" ? bill(extra.vendor, extra.amount) : photo(label, label + by), by, at: ago(minAgo) });

  function build(row, i) {
    const profile = i % 5;
    const title = `${row.mfg_year} ${row.make} ${row.model}${row.variant ? " " + row.variant : ""}`;
    const c = { car_id: row.id, stock_no: row.stock_no, title, reg_tail: row.reg_no ? "··" + String(row.reg_no).replace(/[^A-Za-z0-9]/g, "").slice(-4) : null, status: row.status, kms_at_intake: row.kms_at_intake ?? null,
      fuel: row.fuel || null, transmission: row.transmission || null, colour: row.colour || null, tasks: [], locations: [], inspection_ids: [] };
    // checklist status by profile: 0 ready, 1 mostly done, 2 early, 3 one sent back, 4 just started
    const ticked = [13, 11, 6, 13, 2][profile], verified = [13, 9, 5, 12, 2][profile];
    CHECKLIST.forEach((t, k) => {
      const status = k < verified ? "verified" : k < ticked ? "done" : "open";
      const by = k % 3 === 0 ? "Vikram (demo)" : STAFF[(i + k) % 2];
      const task = { id: nextTask++, kind: "checklist", title: t, note: null, source: "standard", status, reject_reason: null, done_by: null, done_at: null, verified_by: null, verified_at: null, evidence: [], amount: null, _vendor: null, _mode: null };
      if (status !== "open") {
        task.done_by = by; task.done_at = ago(60 * (3 + k) + i * 17);
        task.evidence.push(ev("work_photo", t.split(" (")[0], by, 60 * (3 + k) + i * 17));
        if (k === 0 && (profile === 0 || profile === 1)) { task.amount = 1200 + i * 100; task._vendor = VENDORS[3]; task._mode = "upi"; task.evidence.push(ev("bill", "", by, 60 * 3, { vendor: VENDORS[3], amount: task.amount })); }
        if (k === 5 && profile === 0) { task.amount = 4800; task._vendor = VENDORS[0]; task._mode = "cash"; task.evidence.push(ev("bill", "", by, 200, { vendor: VENDORS[0], amount: 4800 })); }
      }
      if (status === "verified") { task.verified_by = MANAGER; task.verified_at = ago(40 + k * 7); }
      if (profile === 3 && k === 12) { task.status = "open"; task.reject_reason = "The photo is dark. Take it again with the doors open, in daylight."; task.done_by = null; task.done_at = null; task.evidence = []; }
      c.tasks.push(task);
    });
    const issueSpec = [[], [[1, "open"]], [[0, "done"], [3, "open"]], [], [[5, "open"]]][profile];
    issueSpec.forEach(([n, status], j) => {
      const by = STAFF[j % 2];
      const t = { id: nextTask++, kind: "issue", title: ISSUES[(n + i) % ISSUES.length], note: j === 0 && profile === 4 ? "Found at the buying inspection." : null, source: profile === 4 ? "inspection" : "manual", status, reject_reason: null, done_by: null, done_at: null, verified_by: null, verified_at: null,
        evidence: [ev("before_photo", ISSUES[(n + i) % ISSUES.length], "Vikram (demo)", 600)], amount: null, _vendor: null, _mode: null };
      if (status === "done") { t.done_by = by; t.done_at = ago(95); t.evidence.push(ev("work_photo", "Fixed", by, 95)); t.amount = 6500; t._vendor = VENDORS[2]; t._mode = "upi"; t.evidence.push(ev("bill", "", by, 95, { vendor: VENDORS[2], amount: 6500 })); }
      c.tasks.push(t);
    });
    // where it has been: the last days, and today for most cars (a few have not been updated yet)
    const seq = ["yard", "workshop", "yard", "showroom", "workshop", "showroom", "yard"];
    const detail = { workshop: "Sample Auto Works, Goregaon", yard: "Row " + "ABC"[i % 3], showroom: "", rto: "At RTO Andheri" };
    const sayToday = i % 4 !== 3;
    for (let d = sayToday ? 0 : 1; d < 5 + (i % 3); d++) {
      const place = i === 2 && d === 0 ? "with_customer" : seq[(i + d) % seq.length];
      c.locations.push({ date: dayAgo(d), place, place_detail: place === "with_customer" ? "Test drive, back in 2 hours" : detail[place] || null, note: null, by: d % 2 ? "Suresh (demo)" : "Vikram (demo)", at: `${dayAgo(d)} ${d === 0 ? ago(30 + i * 11).slice(11, 16) : "18:" + String(10 + ((i * 7 + d * 5) % 40)).padStart(2, "0")}:00` });
    }
    // inspections: ready cars have a finished one, the second car a draft that is almost done
    if (profile === 0 || (profile === 3 && i > 2)) c.inspection_ids.push(makeInspection(c, row, "final", i).id);
    if (i === 1) c.inspection_ids.push(makeInspection(c, row, "draft", i).id);
    return c;
  }

  function makeInspection(c, row, status, i) {
    const id = nextInsp++;
    const items = {}, photos = {};
    const insp = { id, car_id: c.car_id, stock_no: c.stock_no, title: c.title, type: status === "draft" ? "purchase" : i % 2 ? "pre_sale" : "purchase", status, date: dayAgo(status === "draft" ? 0 : 3 + i), inspector: "Imran (demo)", odometer: (c.kms_at_intake || 40000) + 40, remarks: "", items, photos };
    const pick = (a, n) => a[(i * 7 + n * 13) % a.length];
    TEMPLATE.sections.forEach((s) => s.items.forEach((it, n) => {
      if (it.type === C) items[it.key] = { value: (i + n) % 11 === 0 ? "minor" : (i + n * 3) % 29 === 0 ? "major" : "good", note: "", photos: [] };
      else if (it.type === W) items[it.key] = { value: (i + n) % 17 === 0 ? "not_working" : "working", note: "", photos: [] };
      else if (it.type === T) items[it.key] = { value: n % 4 === 0 && i % 2 ? "40to70" : "gt70", note: "", photos: [] };
      else if (it.type === Y) items[it.key] = { value: it.key === "rc" ? "yes" : "no", note: "", photos: [] };
      else if (it.type === N) items[it.key] = { value: { airbags: 6, owner_no: 1, keys: 2, challans: 0 }[it.key] ?? 1, note: "", photos: [] };
      else if (it.type === D) items[it.key] = { value: it.key === "puc" ? "2027-02-14" : "2027-05-30", note: "", photos: [] };
      else items[it.key] = { value: { insurance_type: "Comprehensive", hypothecation: "None, NOC not needed", service_history: "Full, at the brand's service centre", dot: "2023, 2023, 2022, 2022" }[it.key] || "", note: "", photos: [] };
    }));
    // the findings that need attention (each with a note and a picture)
    const flag = (key, value, note) => { items[key] = { value, note, photos: [{ id: nextPhoto++, url: photo(ITEM[key].label, key + c.stock_no) }] }; };
    if (status === "final") { flag(pick(["bumper_r", "door_rl", "fender_l", "quarter_r"], 1), "minor", "Light scratch about 10 cm, paint intact underneath."); flag(pick(["seats", "dashboard", "roof_lining"], 2), "minor", "Small stain, should clean with a deep wash."); flag("tyre_rl", "lt40", "Tread is below 40 percent. Change within a month."); if (i % 2) flag("rt_noise", "major", "A knock from the front left over bumps. Check the strut mount."); }
    if (status === "draft") { flag("bumper_f", "minor", "Light scratch, paint intact."); items.door_rl = { value: "minor", note: "", photos: [] }; ["rt_pickup", "rt_braking", "rt_pull", "rt_noise", "rt_ac", "win_fl", "win_fr", "music"].forEach((k) => { delete items[k].value; items[k].value = undefined; }); }
    TEMPLATE.photo_slots.forEach((p, n) => { if (status === "final" || (n < TEMPLATE.photo_slots.length - 2)) photos[p.key] = { id: nextPhoto++, url: photo(p.label, p.key + c.stock_no) }; });
    inspections.set(id, insp);
    if (status === "final") score(insp);
    return insp;
  }

  function score(insp) {
    const secs = {}; let tw = 0, ts = 0;
    TEMPLATE.sections.forEach((s) => {
      const rated = s.items.filter((it) => RATED.has(it.type) && insp.items[it.key]?.value && insp.items[it.key].value !== "na");
      if (!rated.length) return;
      secs[s.key] = Math.max(0, 10 - rated.reduce((a, it) => a + penalty(it, insp.items[it.key].value), 0));
      tw += s.weight; ts += secs[s.key] * s.weight;
    });
    insp.section_scores = secs; insp.overall = tw ? Math.round((ts / tw) * 10) / 10 : null; insp.label = insp.overall == null ? null : labelOf(insp.overall);
  }
  const imperfect = (insp) => TEMPLATE.sections.flatMap((s) => s.items.filter((it) => RATED.has(it.type) && isBad(it, insp.items[it.key]?.value)).map((it) => ({ section: s.key, item_key: it.key, label: it.label, value: insp.items[it.key].value, note: insp.items[it.key].note || "", photos: insp.items[it.key].photos || [] })));
  const inspOut = (insp) => ({ ...insp, items: Object.fromEntries(Object.entries(insp.items).map(([k, v]) => [k, { ...v, photos: v.photos || [] }])), imperfect: imperfect(insp), section_scores: insp.section_scores || {}, overall: insp.overall ?? null, label: insp.label ?? null });

  // ---------------------------------------------------------------- what each role may see
  const carRow = (c) => {
    const check = c.tasks.filter((t) => t.kind === "checklist"), issues = c.tasks.filter((t) => t.kind === "issue");
    const last = c.locations[0], today0 = !!last && last.date === today();
    const ins = c.inspection_ids.map((id) => inspections.get(id)).filter(Boolean).sort((a, b) => b.id - a.id)[0] || null;
    const ready = check.length > 0 && check.every((t) => t.status === "verified") && issues.every((t) => t.status === "verified");
    return { car_id: c.car_id, stock_no: c.stock_no, title: c.title, reg_tail: c.reg_tail, status: c.status, location: last ? last.place : null, place_detail: last ? last.place_detail : null, location_date: last ? last.date : null, updated_today: today0,
      checklist_done: check.filter((t) => t.status !== "open").length, checklist_total: check.length, open_issues: issues.filter((t) => t.status === "open").length, waiting_check: c.tasks.filter((t) => t.status === "done").length, ready,
      inspection: ins ? { id: ins.id, overall: ins.overall ?? null, label: ins.label ?? null, status: ins.status } : null };
  };
  // The store keeps names; the API answers done_by/verified_by as user ids with the names in *_name, so the sample does too.
  const uids = new Map();
  const uid = (name) => (name == null ? null : uids.get(name) || (uids.set(name, 900 + uids.size), uids.get(name)));
  const taskOut = (t) => {
    const mine = t.done_by === myName;
    const out = { id: t.id, kind: t.kind, title: t.title, note: t.note, source: t.source, status: t.status, reject_reason: t.reject_reason, done_by: uid(t.done_by), done_by_name: t.done_by, done_at: t.done_at, verified_by: uid(t.verified_by), verified_by_name: t.verified_by, verified_at: t.verified_at, needs: { photo: !t.evidence.slice(t._floor || 0).some((e) => e.kind === "work_photo"), bill: !t.evidence.slice(t._floor || 0).some((e) => e.kind === "bill") },
      evidence: t.evidence.map((e) => ({ id: e.id, kind: e.kind, url: e.kind === "bill" && !(owner || e.by === myName) ? null : e.url, at: e.at })) };
    if (t.amount != null && (owner || mine)) out.amount = t.amount;
    return out;
  };

  // ---------------------------------------------------------------- the routes
  async function get(path, params) {
    await init();
    const p = path.replace(/^maint\/?/, ""); let m;
    if (p === "summary") {
      const rows = cars.map(carRow);
      const week = cars.flatMap((c) => c.tasks).filter((t) => t.amount != null && t.done_at && t.done_at.slice(0, 10) >= dayAgo(6)).reduce((a, t) => a + t.amount, 0);
      return { not_updated: rows.filter((r) => !r.updated_today).length, open_issues: rows.reduce((a, r) => a + r.open_issues, 0), waiting_check: rows.reduce((a, r) => a + r.waiting_check, 0), ready: rows.filter((r) => r.ready).length, in_stock: rows.length, ...(owner ? { week_spend: week } : {}) };
    }
    if (p === "cars") {
      const f = (params && params.filter) || "all";
      const keep = { all: () => true, not_updated: (r) => !r.updated_today, open_issues: (r) => r.open_issues > 0, waiting_check: (r) => r.waiting_check > 0, ready: (r) => r.ready }[f] || (() => true);
      return { cars: cars.map(carRow).filter(keep), today: today() };
    }
    if ((m = p.match(/^cars\/(\d+)$/))) {
      const c = car(+m[1]); const mine = c.tasks.filter((t) => t.amount != null && t.done_by === myName).reduce((a, t) => a + t.amount, 0);
      return { car: { car_id: c.car_id, stock_no: c.stock_no, title: c.title, reg_tail: c.reg_tail, status: c.status, location: c.locations[0]?.place || null, place_detail: c.locations[0]?.place_detail || null, kms_at_intake: c.kms_at_intake, fuel: c.fuel, transmission: c.transmission, colour: c.colour },
        tasks: c.tasks.map(taskOut), locations: c.locations.map((l) => ({ ...l })), spending: { mine_total: mine, ...(owner ? { total: c.tasks.reduce((a, t) => a + (t.amount || 0), 0) } : {}) },
        inspections: c.inspection_ids.map((id) => inspections.get(id)).filter(Boolean).sort((a, b) => b.id - a.id).map((s) => ({ id: s.id, type: s.type, date: s.date, overall: s.overall ?? null, label: s.label ?? null, status: s.status, inspector: s.inspector })) };
    }
    if (p === "queue") {
      if (!verifier) throw err(403, "forbidden", "Only a manager or the owner can check work.");
      return { tasks: cars.flatMap((c) => c.tasks.filter((t) => t.status === "done").map((t) => ({ ...taskOut(t), car_id: c.car_id, stock_no: c.stock_no, car_title: c.title }))) };
    }
    if (p === "inspection-template") return TEMPLATE;
    if ((m = p.match(/^inspections\/(\d+)$/))) { const s = inspections.get(+m[1]); if (!s) throw err(404, "not_found", "That inspection was not found."); return { inspection: inspOut(s) }; }
    throw err(404, "not_found", "Not part of the sample data.");
  }
  const car = (id) => { const c = cars.find((x) => x.car_id === id); if (!c) throw err(404, "not_found", "That car was not found."); return c; };
  const task = (id) => { const c = taskCar.get(id); const t = c && c.tasks.find((x) => x.id === id); if (!t) throw err(404, "not_found", "That task was not found."); return [c, t]; };

  async function send(method, path, b = {}) {
    await init();
    const p = path.replace(/^maint\/?/, ""); let m;
    if ((m = p.match(/^cars\/(\d+)\/location$/))) {
      const c = car(+m[1]), place = b.place;
      if (!["showroom", "yard", "workshop", "with_customer", "with_owner", "rto", "other"].includes(place)) throw err(400, "validation", "Choose a place.");
      const row = { date: today(), place, place_detail: b.place_detail || null, note: b.note || null, by: myName, at: now() };
      if (c.locations[0] && c.locations[0].date === today()) c.locations[0] = row; else c.locations.unshift(row);
      return { ok: true, location: row };
    }
    if ((m = p.match(/^cars\/(\d+)\/tasks$/))) {
      const c = car(+m[1]); const title = String(b.title || "").trim();
      if (!title) throw err(400, "validation", "Say what needs fixing.");
      const t = { id: nextTask++, kind: "issue", title, note: b.note || null, source: "manual", status: "open", reject_reason: null, done_by: null, done_at: null, verified_by: null, verified_at: null, evidence: [], amount: null };
      c.tasks.push(t); taskCar.set(t.id, c); return { task: taskOut(t) };
    }
    if ((m = p.match(/^tasks\/(\d+)\/done$/))) {
      const [, t] = task(+m[1]); const amount = Math.round(Number(b.amount) || 0);
      const fresh = t.evidence.slice(t._floor || 0);                 // like the server: only evidence since the last send-back counts
      if (!fresh.some((e) => e.kind === "work_photo")) throw err(400, "validation", "Add a photo of the work first");
      if (amount > 0 && !fresh.some((e) => e.kind === "bill")) throw err(400, "validation", "Add the bill for this amount");
      Object.assign(t, { status: "done", reject_reason: null, done_by: myName, done_at: now(), amount: amount > 0 ? amount : null, _vendor: b.vendor || null, _mode: b.payment_mode || null, note: t.note || (b.note || null) });
      return { task: taskOut(t) };
    }
    if ((m = p.match(/^tasks\/(\d+)\/verify$/))) {
      if (!verifier) throw err(403, "forbidden", "Only a manager or the owner can check work.");
      const [, t] = task(+m[1]);
      if (b.ok) Object.assign(t, { status: "verified", verified_by: myName, verified_at: now(), reject_reason: null });
      else { if (!String(b.reason || "").trim()) throw err(400, "validation", "Say what is wrong, so the person can fix it."); Object.assign(t, { status: "open", reject_reason: String(b.reason).trim(), done_by: null, done_at: null, _floor: t.evidence.length }); }
      return { task: taskOut(t) };
    }
    if ((m = p.match(/^cars\/(\d+)\/inspections$/))) {
      const c = car(+m[1]);
      const s = { id: nextInsp++, car_id: c.car_id, stock_no: c.stock_no, title: c.title, type: ["purchase", "pre_sale", "recheck"].includes(b.type) ? b.type : "purchase", status: "draft", date: today(), inspector: myName, odometer: c.kms_at_intake, remarks: "", items: {}, photos: {} };
      Object.assign(s.items, { rc: { value: "yes", note: "", photos: [] }, insurance_type: { value: "Comprehensive", note: "", photos: [] }, keys: { value: 2, note: "", photos: [] } });
      inspections.set(s.id, s); c.inspection_ids.push(s.id); return { inspection: inspOut(s) };
    }
    if ((m = p.match(/^inspections\/(\d+)$/)) && method === "PATCH") {
      const s = inspections.get(+m[1]); if (!s) throw err(404, "not_found", "That inspection was not found.");
      if (s.status !== "draft") throw err(409, "locked", "This inspection is finished and can no longer be changed.");
      ["odometer", "remarks", "date"].forEach((k) => { if (b[k] !== undefined) s[k] = b[k]; });
      for (const [k, v] of Object.entries(b.items || {})) { if (!ITEM[k]) continue; const x = (s.items[k] ||= { value: undefined, note: "", photos: [] }); if (v.value !== undefined) x.value = v.value; if (v.note !== undefined) x.note = v.note; }
      return { inspection: inspOut(s) };
    }
    if ((m = p.match(/^inspections\/(\d+)\/finalise$/))) {
      const s = inspections.get(+m[1]); if (!s) throw err(404, "not_found", "That inspection was not found.");
      const miss = [];
      if (s.odometer == null || s.odometer === "") miss.push("Odometer reading");
      TEMPLATE.sections.forEach((sc) => {
        const un = sc.items.filter((it) => RATED.has(it.type) && !s.items[it.key]?.value);
        if (un.length) miss.push(`${sc.title}: ${un.map((u) => u.label).slice(0, 3).join(", ")}${un.length > 3 ? ` and ${un.length - 3} more` : ""} not rated`);
        sc.items.filter((it) => RATED.has(it.type) && isBad(it, s.items[it.key]?.value)).forEach((it) => { const x = s.items[it.key]; if (!(x.note || "").trim() || !(x.photos || []).length) miss.push(`${it.label}: needs a note and a photo`); });
      });
      const sl = TEMPLATE.photo_slots.filter((q) => !s.photos[q.key]); if (sl.length) miss.push(`Photos still to take: ${sl.map((q) => q.label).join(", ")}`);
      if (miss.length) throw err(400, "incomplete", "The inspection is not complete yet.", { missing: miss });
      s.status = "final"; score(s); const c = car(s.car_id);
      imperfect(s).forEach((f) => { const t = { id: nextTask++, kind: "issue", title: `${f.label}: ${f.value === "major" ? "major" : "needs attention"}`, note: f.note, source: "inspection", status: "open", reject_reason: null, done_by: null, done_at: null, verified_by: null, verified_at: null, evidence: [], amount: null }; c.tasks.push(t); taskCar.set(t.id, c); });
      return { inspection: inspOut(s) };
    }
    throw err(404, "not_found", "Not part of the sample data.");
  }

  async function upload(path, fd) {
    await init();
    const p = path.replace(/^maint\/?/, ""), file = fd.get("file"); let m;
    if (!file) throw err(400, "validation", "Choose a file first.");
    const url = URL.createObjectURL(file);
    if ((m = p.match(/^tasks\/(\d+)\/evidence$/))) {
      const [, t] = task(+m[1]); const kind = String(fd.get("kind") || "work_photo");
      if (!["work_photo", "bill", "before_photo"].includes(kind)) throw err(400, "validation", "Unknown kind of photo.");
      const e = { id: nextEv++, kind, url, by: myName, at: now() }; t.evidence.push(e);
      return { evidence: { id: e.id, kind, url, at: e.at } };
    }
    if ((m = p.match(/^inspections\/(\d+)\/photos$/))) {
      const s = inspections.get(+m[1]); if (!s) throw err(404, "not_found", "That inspection was not found.");
      if (s.status !== "draft") throw err(409, "locked", "This inspection is finished and can no longer be changed.");
      const ph = { id: nextPhoto++, url }, slot = fd.get("slot"), item = fd.get("item_key");
      if (slot) s.photos[slot] = ph; else if (item && ITEM[item]) { const x = (s.items[item] ||= { value: undefined, note: "", photos: [] }); (x.photos ||= []).push(ph); } else throw err(400, "validation", "Say which photo this is.");
      return { photo: ph };
    }
    throw err(404, "not_found", "Not part of the sample data.");
  }
  return { get, send, upload };
}
