// Sample answers for the Desk screens, in the exact JSON shapes of APP-SPEC.md section 10, plus a small in-memory store
// that applies actions to a copy (claim, status, notes, chat, Ask Claude). Used by the static demo, and by the live app
// only for a route the server does not have yet (desk-api.js decides). Every name here is made up; no phone numbers.
import { ApiError } from "./api.js";
import { accAllowedFor, accData, createAccStore } from "./desk-mock-acc.js";

const BASE = "2026-10-05 11:20:00";              // the moment these answers describe; times are moved to "now" on load
const ME = { salesman: "Kabir (demo)", manager: "Demo Manager", owner: "Partners (demo)", staff: "Demo Staff" };
const OPEN = ["new", "claimed", "contacted", "escalated"];
export const VIEWS = { salesman: ["mine", "grabs", "closed"], other: ["unclaimed", "escalated", "open", "closed"] };

// ------------------------------------------------------------------ time helpers (IST wall clock strings)
const TS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;
export const istMs = (s) => Date.parse(String(s).replace(" ", "T") + (String(s).length === 16 ? ":00" : "") + "+05:30");
export const istStr = (ms) => new Date(ms + 5.5 * 36e5).toISOString().slice(0, 19).replace("T", " ");
const at = (hm, day = "2026-10-05") => `${day} ${hm.length === 5 ? hm + ":00" : hm}`;

/** Move every IST timestamp in an answer by the same amount, so a recorded morning reads as "just now". */
function shiftTimes(x, delta) {
  if (!delta) return x;
  if (typeof x === "string") return TS.test(x) ? istStr(istMs(x) + delta).slice(0, x.length === 16 ? 16 : 19) : x;
  if (Array.isArray(x)) return x.map((v) => shiftTimes(v, delta));
  if (x && typeof x === "object") { const o = {}; for (const [k, v] of Object.entries(x)) o[k] = k === "note" ? v : shiftTimes(v, delta); return o; }   // a booked visit time stays as booked
  return x;
}

// ------------------------------------------------------------------ the sample leads
const TIER = { luxury: "Luxury 50L+", premium: "Premium 20-50L", core: "Core under 20L" };
const L = (o) => ({ phone_display: "•••• (demo)", after_hours: 0, claim: null, ...o, tier: TIER[o.tier_key] });
const clock = (deadline) => ({ deadline_at: at(deadline), sla_minutes: 10, paused: false, paused_until: null });

const LEADS = [
  L({ id: 1046, first_seen_ts: at("11:16:00"), channel: "facebook", name: "Demo Customer 0146", car: "Mercedes-Benz GLC 300 2022", budget: 6200000, tier_key: "luxury", salesman: "Zoya (demo)", status: "new", stage: "new", claim: clock("11:26:00"),
    _thread: { channel: "facebook", updated_at: at("11:15:40"), messages: [{ who: "customer", name: null, text: "Is the GLC still available? Price kya hai?" }, { who: "anita", name: "Anita", text: "Yes, the 2022 GLC 300 is available. A salesman will call you in a few minutes with the price." }] } }),
  L({ id: 1045, first_seen_ts: at("11:14:00"), channel: "website", name: "Demo Customer 0145", car: "Maruti Suzuki Baleno 2021", budget: 650000, tier_key: "core", salesman: "Aarav (demo)", status: "new", stage: "new", claim: clock("11:24:30"),
    _thread: { channel: "website", updated_at: at("11:13:50"), messages: [{ who: "customer", name: null, text: "Baleno 2021 automatic chahiye, first owner." }, { who: "anita", name: "Anita", text: "We have a 2021 Baleno, first owner. Can we call you to fix a visit?" }] } }),
  L({ id: 1044, first_seen_ts: at("11:19:00"), channel: "instagram", name: "Demo Customer 0144", car: "Hyundai Tucson 2021", budget: 2400000, tier_key: "premium", salesman: "Rohan (demo)", status: "new", stage: "new", claim: clock("11:29:00"),
    _thread: { channel: "instagram", updated_at: at("11:18:40"), messages: [{ who: "customer", name: null, text: "Tucson ka exchange hoga? Mere paas 2017 City hai." }, { who: "anita", name: "Anita", text: "Yes, exchange is possible. A salesman will message you with the next step." }] } }),
  L({ id: 1042, first_seen_ts: at("11:17:30"), channel: "whatsapp", name: "Demo Customer 0142", car: "Toyota Fortuner 2021", budget: 3000000, tier_key: "premium", salesman: ME.salesman, status: "new", stage: "new", claim: clock("11:27:30"),
    _thread: { channel: "whatsapp", updated_at: at("11:17:20"), messages: [{ who: "customer", name: null, text: "Fortuner 2021 available hai?" }, { who: "anita", name: "Anita", text: "Ji haan, ek 2021 Fortuner hai. Diesel, 4x2, single owner." }, { who: "customer", name: null, text: "Kal test drive ho sakta hai? Budget around 30 lakh." }] } }),
  L({ id: 1040, first_seen_ts: at("10:31:00"), channel: "call", name: "Demo Customer 0140", car: "BMW 5 Series 2020", budget: 4800000, tier_key: "luxury", salesman: "Partners (demo)", status: "escalated", stage: "new",
    _call: { duration_min: 2, has_recording: false, shortened: false, lines: [{ who: "agent", text: "Namaste, Classic Auto. How can I help?" }, { who: "caller", text: "5 Series 2020 dekhna hai, aaj shaam aa sakta hoon." }, { who: "agent", text: "Noted. Our team will call you back shortly to confirm a time." }] },
    _timeline: [{ ts: at("10:46:00"), who: "Rohan (demo)", kind: "pass", note: "no_claim|Zoya (demo)|Rohan (demo)|1|2" }, { ts: at("11:01:00"), who: "Zoya (demo)", kind: "pass", note: "no_claim|Rohan (demo)|Zoya (demo)|2|2" }, { ts: at("11:16:00"), who: "Partners (demo)", kind: "escalated", note: "max_rounds|2" }] }),
  L({ id: 1038, first_seen_ts: at("07:50:00"), after_hours: 1, channel: "website", name: "Demo Customer 0138", car: "Audi Q5 2021", budget: 4600000, tier_key: "luxury", salesman: "Rohan (demo)", status: "claimed", stage: "claimed",
    _thread: { channel: "website", updated_at: at("10:21:30"), messages: [{ who: "customer", name: null, text: "Q5 service history available?" }, { who: "anita", name: "Anita", text: "Yes, full service history with the authorised dealer." }] },
    _timeline: [{ ts: at("10:05:00"), who: "Rohan (demo)", kind: "claimed", note: null }, { ts: at("10:12:00"), who: "Rohan (demo)", kind: "call_attempt", note: "297|app_tel" }, { ts: at("10:24:00"), who: "Rohan (demo)", kind: "brief_submitted", note: "84|spoke_negotiating" }, { ts: at("10:36:00"), who: "Rohan (demo)", kind: "proof_missed", note: "42" }] }),
  L({ id: 1037, first_seen_ts: at("10:05:00"), channel: "call", name: "Demo Customer 0139", car: "Hyundai Creta 2022", budget: 1400000, tier_key: "core", salesman: ME.salesman, status: "contacted", stage: "visit_booked",
    _call: { duration_min: 3, has_recording: false, shortened: false, lines: [{ who: "agent", text: "Namaste, Classic Auto. How can I help?" }, { who: "caller", text: "Creta 2022 chahiye, budget around 14 lakh." }, { who: "agent", text: "We have a white 2022 Creta SX. Would you like to see it today?" }, { who: "caller", text: "Haan, shaam ko 5 baje." }] },
    _timeline: [{ ts: at("10:09:00"), who: ME.salesman, kind: "claimed", note: null }, { ts: at("10:12:00"), who: ME.salesman, kind: "call_attempt", note: "301|app_tel" }, { ts: at("10:21:00"), who: ME.salesman, kind: "brief_submitted", note: "88|spoke_visit" }, { ts: at("10:30:00"), who: ME.salesman, kind: "proof_submitted", note: "41" }, { ts: at("10:40:00"), who: ME.salesman, kind: "visit_booked", note: at("17:00") }] }),
  L({ id: 1035, first_seen_ts: at("11:08:00"), channel: "cardekho", name: "Demo Customer 0135", car: "Mahindra XUV700 AX7 2023", budget: 2250000, tier_key: "premium", salesman: ME.salesman, status: "claimed", stage: "claimed",
    _thread: { channel: "email", updated_at: at("09:47:30"), messages: [{ who: "customer", name: null, text: "Interested in the XUV700 AX7. Please share the best price." }] },
    _timeline: [{ ts: at("11:12:00"), who: ME.salesman, kind: "claimed", note: null }] }),
  L({ id: 1033, first_seen_ts: at("09:30:00"), after_hours: 1, channel: "whatsapp", name: "Demo Customer 0133", car: "Tata Nexon EV 2023", budget: 1250000, tier_key: "core", salesman: "Aarav (demo)", status: "contacted", stage: "contacted",
    _thread: { channel: "whatsapp", updated_at: at("09:29:00"), messages: [{ who: "customer", name: null, text: "Nexon EV ki battery health kitni hai?" }, { who: "anita", name: "Anita", text: "Battery health report is available. A salesman will share it." }] },
    _timeline: [{ ts: at("10:03:00"), who: "Aarav (demo)", kind: "claimed", note: null }, { ts: at("10:18:00"), who: "Aarav (demo)", kind: "call_attempt", note: "299|app_tel" }, { ts: at("10:26:00"), who: "Aarav (demo)", kind: "brief_submitted", note: "86|spoke_interested" }, { ts: at("10:31:00"), who: "Aarav (demo)", kind: "proof_submitted", note: "43" }] }),
  L({ id: 1031, first_seen_ts: at("16:10:00", "2026-10-04"), channel: "website", name: "Demo Customer 0131", car: "Toyota Innova Crysta 2021", budget: 2350000, tier_key: "premium", salesman: ME.salesman, status: "contacted", stage: "test_drive",
    _thread: { channel: "website", updated_at: at("16:09:00", "2026-10-04"), messages: [{ who: "customer", name: null, text: "Crysta 7 seater, family ke liye. Test drive possible?" }, { who: "anita", name: "Anita", text: "Yes. A salesman will call you to book a slot." }] },
    _timeline: [{ ts: at("16:14:00", "2026-10-04"), who: ME.salesman, kind: "claimed", note: null }, { ts: at("16:20:00", "2026-10-04"), who: ME.salesman, kind: "call_attempt", note: "288|app_tel" }, { ts: at("16:29:00", "2026-10-04"), who: ME.salesman, kind: "brief_submitted", note: "71|spoke_callback" }, { ts: at("16:30:00", "2026-10-04"), who: ME.salesman, kind: "contacted", note: null }, { ts: at("18:05:00", "2026-10-04"), who: ME.salesman, kind: "test_drive", note: "Innova Crysta 2021" }, { ts: at("11:05:00"), who: ME.salesman, kind: "call_attempt", note: "305|app_tel" }, { ts: at("11:15:00"), who: null, kind: "brief_prompt", note: "90" }] }),
  L({ id: 1019, first_seen_ts: at("11:40:00", "2026-10-02"), channel: "whatsapp", name: "Demo Customer 0119", car: "Maruti Suzuki Brezza 2022", budget: 1050000, tier_key: "core", salesman: ME.salesman, status: "sold", stage: "sold",
    _thread: { channel: "whatsapp", updated_at: at("11:39:00", "2026-10-02"), messages: [{ who: "customer", name: null, text: "Brezza 2022 ZXi, CNG hai kya?" }, { who: "anita", name: "Anita", text: "This one is petrol. A salesman will call you." }] },
    _timeline: [{ ts: at("11:43:00", "2026-10-02"), who: ME.salesman, kind: "claimed", note: null }, { ts: at("12:10:00", "2026-10-02"), who: ME.salesman, kind: "contacted", note: null }, { ts: at("17:20:00", "2026-10-03"), who: ME.salesman, kind: "sold", note: "Token taken" }] }),
  L({ id: 1012, first_seen_ts: at("15:05:00", "2026-09-30"), channel: "olx", name: "Demo Customer 0112", car: "Jeep Compass 2021", budget: 2050000, tier_key: "premium", salesman: ME.salesman, status: "lost", stage: "lost",
    _thread: null, _annotation: { lost_reason: "bought_elsewhere" },
    _timeline: [{ ts: at("15:09:00", "2026-09-30"), who: ME.salesman, kind: "claimed", note: null }, { ts: at("11:00:00", "2026-10-01"), who: ME.salesman, kind: "lost", note: "bought_elsewhere" }] }),
];
const KABIR_TIERS = ["core", "premium"];          // the demo salesman's seats in the tier rotations

const ROW_KEYS = ["id", "first_seen_ts", "channel", "name", "car", "budget", "tier", "tier_key", "salesman", "status", "stage", "mine", "claimable", "phone_display", "after_hours", "claim", "last_event"];

function rowFor(l, role) {
  const mine = role === "salesman" ? l.salesman === ME.salesman : false;
  const claimable = l.status === "new" && (role === "salesman" ? KABIR_TIERS.includes(l.tier_key) : role !== "staff");
  const tl = l._timeline || [];
  const last = tl.length ? { kind: tl[tl.length - 1].kind, ts: tl[tl.length - 1].ts } : { kind: "new", ts: l.first_seen_ts };
  const r = { ...l, mine, claimable, last_event: last };
  return Object.fromEntries(ROW_KEYS.map((k) => [k, r[k] ?? null]));
}
function visibleTo(l, role) {
  if (role === "salesman") return l.salesman === ME.salesman || (l.status === "new" && !!l.salesman && KABIR_TIERS.includes(l.tier_key));
  return true;
}
function allowedFor(row, role) {
  const act = role !== "staff";
  const open = OPEN.includes(row.status);
  const holder = role !== "salesman" || row.mine;
  const working = act && open && row.status !== "new" && holder;
  return { claim: act && row.status === "new" && row.claimable, contacted: working, visit_booked: working, test_drive: working, sold: working, lost: working,
    note: act && holder && row.status !== "new", call_tel: false, call_exotel: false, whatsapp_link: false, reply_inapp: false, ai_call: working };
}
function detailFor(l, role) {
  const lead = { ...rowFor(l, role), phone: null, tel_url: null, whatsapp_url: null };
  const locked = role === "salesman" && lead.status === "new";
  return {
    server_now: BASE, lead,
    timeline: [{ ts: l.first_seen_ts, who: null, kind: "new", note: null }, ...(l._timeline || [])],
    thread: locked ? null : l._thread || null,
    call: locked ? null : l._call || null,
    annotation: l._annotation || null,
    allowed: { ...allowedFor(lead, role), ...accAllowedFor(lead, role) },
    _unlock: { thread: l._thread || null, call: l._call || null },
  };
}

// ------------------------------------------------------------------ chat
const U = {
  owner: { id: 2, name: "Partners (demo)", initials: "PD", role: "owner" },
  manager: { id: 5, name: "Demo Manager", initials: "DM", role: "manager" },
  kabir: { id: 6, name: "Kabir (demo)", initials: "KD", role: "salesman" },
  rohan: { id: 21, name: "Rohan (demo)", initials: "RD", role: "salesman" },
  zoya: { id: 22, name: "Zoya (demo)", initials: "ZD", role: "salesman" },
  aarav: { id: 23, name: "Aarav (demo)", initials: "AD", role: "salesman" },
  accts: { id: 30, name: "Demo Accountant", initials: "DA", role: "accountant" },
};
const ROOMS = [
  { key: "all", name: "All Staff", members: ["owner", "manager", "kabir", "rohan", "zoya", "aarav", "accts"] },
  { key: "luxury", name: "Luxury", members: ["owner", "manager", "rohan", "zoya"] },
  { key: "premium", name: "Premium", members: ["owner", "manager", "kabir", "rohan"] },
  { key: "core", name: "Core", members: ["owner", "manager", "kabir", "aarav"] },
  { key: "managers", name: "Managers", members: ["owner", "manager"] },
  { key: "owners", name: "Owners", members: ["owner"] },
];
const ROOMS_FOR = { salesman: ["all", "premium", "core"], manager: ["all", "luxury", "premium", "core", "managers"], owner: ["all", "luxury", "premium", "core", "managers", "owners"], staff: ["all"] };
const M = (id, hm, who, text, extra = {}) => ({ id, ts: at(hm), who, text, photo: null, mentions: [], ...extra });
const MESSAGES = {
  all: { read: { salesman: 339, manager: 341, owner: 341, staff: 339 }, rows: [
    M(335, "09:15", "manager", "Good morning team. Showroom opens at 10 sharp. Fortuner and Creta are washed and on the floor."),
    M(337, "09:40", "aarav", "Nexon EV customer coming at 12, test drive ke liye keys ready rakhna."),
    M(340, "10:58", "owner", "Team meeting at 6 today. @Kabir please bring the test-drive list.", { mentions: ["kabir"] }),
    M(341, "11:02", "zoya", null, { photo: { url: "img/demo-chat-photo.svg" } }),
  ] },
  core: { read: { salesman: 330, manager: 330, owner: 330 }, rows: [
    M(328, "10:12", "aarav", "Baleno 2021 ka service record file mein hai?"),
    M(330, "10:41", "kabir", "Creta customer coming at 5"),
  ] },
  premium: { read: { salesman: 332, manager: 334, owner: 334 }, rows: [
    M(332, "10:20", "rohan", "Tucson ka second key mil gaya, drawer 3 mein hai."),
    M(334, "10:47", "manager", "Innova Crysta test drive feedback? @Kabir", { mentions: ["kabir"] }),
  ] },
  luxury: { read: { manager: 336, owner: 331 }, rows: [
    M(331, "10:15", "zoya", "GLC 300 photos updated on the website."),
    M(336, "10:45", "manager", "BMW 5 Series lead escalated. Partners are calling back."),
  ] },
  managers: { read: { manager: 339, owner: 333 }, rows: [
    M(333, "10:30", "owner", "Please check the price board before the weekend."),
    M(339, "10:55", "manager", "Done. Two cars need new photos."),
  ] },
  owners: { read: { owner: 338 }, rows: [M(338, "10:50", "owner", "Monthly review on Monday. Keep the evening free.")] },
};
const PERSONA = { salesman: "kabir", manager: "manager", owner: "owner", staff: "accts" };

// ------------------------------------------------------------------ Ask Claude
const TASKS = [
  { id: "t_demo_2", text: "Draft a WhatsApp reply for a customer asking about the Fortuner's service history", status: "done",
    result_text: "Here is a short reply you can send:\n\nNamaste! The 2021 Fortuner has its full service history with the authorised dealer. I can share the service book photos on WhatsApp, and you are welcome to see the car at the showroom today.",
    result_url: null, created_at: at("10:50:00"), updated_at: at("10:51:10") },
  { id: "t_demo_1", text: "Make a list of cars older than 60 days in stock", status: "needs_medhansh", result_text: null, result_url: null,
    created_at: at("09:30:00"), updated_at: at("09:31:00") },
];
const DEMO_ANSWER = "(demo answer) Done. Here is a first draft you can edit:\n\n1. Thank the customer for the enquiry.\n2. Confirm the car is available and invite them for a test drive today.\n3. Offer a call back at a time that suits them.\n\nNothing was sent to anyone.";

// ------------------------------------------------------------------ built-in answers by key
/** The answer a real server would give for (role, path, params), or null when this sample set has no such answer. */
export function builtin(role, path, params, personaId) {
  const p = params || {};
  const persona = { ...U[PERSONA[role]], id: personaId ?? U[PERSONA[role]].id };
  if (path === "desk/config") return { flags: { exotel_call: false, inapp_reply: false, acc: true, acc_exotel: false }, vapid_public_key: "BDemoPublicKeyBase64url", server_now: BASE };
  if (path === "acc/_db") return accData();          // call accountability: the whole starting picture (desk-mock-acc.js)
  if (path === "desk/inbox") return inboxAnswer(role, p);
  let m = path.match(/^desk\/leads\/(\d+)$/);
  if (m) { const l = LEADS.find((x) => x.id === +m[1] && visibleTo(x, role)); return l ? detailFor(l, role) : null; }
  if (path === "desk/feed") return { data: [], last_id: 0 };
  if (path === "chat/rooms") return { data: ROOMS_FOR[role].map((k) => roomSummary(k, role, persona)) };
  m = path.match(/^chat\/rooms\/([a-z]+)\/messages$/);
  if (m) { if (!ROOMS_FOR[role].includes(m[1])) return null; const box = MESSAGES[m[1]]; return { room: m[1], has_more: false, last_read_id: box.read[role] || 0, data: box.rows.map((r) => msgOut(r, role, persona)) }; }
  if (path === "chat/members") { const r = ROOMS.find((x) => x.key === p.room); if (!r || !ROOMS_FOR[role].includes(r.key)) return null; return r.members.map((k) => (k === PERSONA[role] ? persona : U[k])).map((u) => ({ user_id: u.id, name: u.name, role: u.role })); }
  if (path === "ask/tasks") return { available: true, data: TASKS.map((t) => ({ ...t })) };
  m = path.match(/^ask\/tasks\/(.+)$/);
  if (m) return TASKS.find((t) => t.id === m[1]) || null;
  return null;
}
function inboxAnswer(role, p) {
  const rows = LEADS.filter((l) => visibleTo(l, role)).map((l) => rowFor(l, role));
  return { server_now: BASE, ...listView(rows, role, p) };
}
function msgOut(r, role, persona) {
  const u = r.who === PERSONA[role] ? persona : U[r.who];
  return { id: r.id, ts: r.ts, user: { ...u }, text: r.text, photo: r.photo ? { ...r.photo } : null,
    mentions: r.mentions.map((k) => (k === PERSONA[role] ? persona.id : U[k].id)), mine: r.who === PERSONA[role], deleted: false };
}
function roomSummary(key, role, persona) {
  const room = ROOMS.find((r) => r.key === key), box = MESSAGES[key];
  const read = box.read[role] || 0;
  const last = box.rows[box.rows.length - 1];
  const lu = last.who === PERSONA[role] ? persona : U[last.who];
  return { key, name: room.name, unread: box.rows.filter((r) => r.id > read && r.who !== PERSONA[role]).length, can_post: true,
    last: { id: last.id, author: lu.name, preview: last.text || "Photo", ts: last.ts } };
}

// ------------------------------------------------------------------ list logic shared by the built-in answers and the store
const inView = {
  mine: (r) => r.mine && OPEN.includes(r.status),
  grabs: (r) => !r.mine && r.claimable && r.status === "new",
  closed: (r) => ["sold", "lost"].includes(r.status),
  unclaimed: (r) => r.status === "new",
  escalated: (r) => r.status === "escalated",
  open: (r) => OPEN.includes(r.status),
};
function listView(all, role, p) {
  const salesman = role === "salesman";
  const view = (salesman ? VIEWS.salesman : VIEWS.other).includes(p.view) ? p.view : salesman ? "mine" : "unclaimed";
  const pred = view === "closed" && salesman ? (r) => r.mine && ["sold", "lost"].includes(r.status) : inView[view];
  const q = String(p.q || "").trim().toLowerCase();
  let rows = all.filter(pred)
    .filter((r) => !p.tier || r.tier_key === p.tier)
    .filter((r) => !p.channel || r.channel === p.channel)
    .filter((r) => !p.salesman || r.salesman === p.salesman)
    .filter((r) => !q || (q.startsWith("#") ? String(r.id) === q.slice(1) : `${r.name} ${r.car} ${r.id}`.toLowerCase().includes(q)));
  rows.sort((a, b) => {
    const da = a.claim ? istMs(a.claim.deadline_at) : Infinity, db = b.claim ? istMs(b.claim.deadline_at) : Infinity;
    return da !== db ? da - db : istMs(b.first_seen_ts) - istMs(a.first_seen_ts);
  });
  const page = Math.max(1, +p.page || 1), size = 50;
  const counts = salesman
    ? { mine_open: all.filter(inView.mine).length, mine_new: all.filter((r) => r.mine && r.status === "new").length, grabs: all.filter(inView.grabs).length }
    : { unclaimed: all.filter(inView.unclaimed).length, escalated: all.filter(inView.escalated).length, open: all.filter(inView.open).length };
  return { view, counts, page, page_size: size, total: rows.length, claim_unavailable: false, data: rows.slice((page - 1) * size, page * size) };
}

// ------------------------------------------------------------------ the in-memory store
const STAGE_LABEL = { callback: "call back", post_visit_followup: "follow up after the visit", feedback: "ask for feedback" };
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const fire = (detail) => window.dispatchEvent(new CustomEvent("desk:feed", { detail: { local: true, ...detail } }));

/**
 * role: salesman | manager | owner | staff. me: the signed-in user ({id, display_name, engine_name}).
 * load(path, params): optional source of recorded answers (the demo bundle); null or undefined means "use the built-in one".
 */
export function createStore({ role, me, load }) {
  const personaId = me?.id;
  const persona = { ...U[PERSONA[role]], id: personaId ?? U[PERSONA[role]].id };
  const myName = role === "salesman" ? (me?.engine_name || ME.salesman) : persona.name;
  let delta = null;                                  // shift from the answers' clock to now
  const leads = new Map(), details = new Map(), rooms = { list: null }, msgs = new Map(), members = new Map();
  let tasks = null, config = null, loadedViews = false, nextMsg = 900, nextTask = 3, nextAction = 55;

  const now = () => istStr(Date.now());
  async function source(path, params) {
    let a = null;
    if (load && !/^acc\//.test(path)) a = await load(path, params);     // the recordings predate call accountability
    if (a == null) a = builtin(role, path, params, personaId);
    if (a == null) throw new ApiError(404, "not_found", "Not found in the sample data.");
    a = clone(a);
    if (delta === null) {
      const sn = a.server_now || (path === "desk/inbox" || path === "desk/config" ? BASE : null);
      delta = sn ? Date.now() - istMs(sn) : Date.now() - istMs(BASE);
      delta = Math.round(delta / 60000) * 60000;      // whole minutes keep the clock faces tidy
    }
    return shiftTimes(a, delta);
  }

  async function loadViews() {
    if (loadedViews) return;
    for (const v of role === "salesman" ? VIEWS.salesman : VIEWS.other) {
      const a = await source("desk/inbox", { view: v });
      for (const r of a.data || []) if (!leads.has(r.id)) leads.set(r.id, r);
    }
    loadedViews = true;
  }
  /** A missed claim clock in the demo starts again, as if the lead moved to the next salesman and back. */
  function rollClocks() {
    for (const r of leads.values()) {
      if (r.claim && istMs(r.claim.deadline_at) < Date.now() - 30000) r.claim = { ...r.claim, deadline_at: istStr(Date.now() + 10 * 60000) };
    }
  }
  async function detail(id) {
    if (!details.has(id)) {
      const d = await source(`desk/leads/${id}`);
      d._unlock = d._unlock || { thread: d.thread, call: d.call };
      details.set(id, d);
      if (!leads.has(id)) { const row = {}; for (const k of ROW_KEYS) row[k] = d.lead[k] ?? null; leads.set(id, row); }
    }
    const d = details.get(id), row = leads.get(id);
    Object.assign(d.lead, row);
    d.allowed = { ...d.allowed, ...allowedFor(row, role), ...accAllowedFor(row, role) };
    d.server_now = now();
    const out = clone(d); delete out._unlock;
    return out;
  }
  async function roomMsgs(key) {
    if (!msgs.has(key)) msgs.set(key, await source(`chat/rooms/${key}/messages`));
    return msgs.get(key);
  }
  async function roomList() {
    if (!rooms.list) rooms.list = (await source("chat/rooms")).data;
    return rooms.list;
  }
  async function taskList() {
    if (!tasks) tasks = (await source("ask/tasks")).data;
    return tasks;
  }

  function stamp(id, kind, note = null) {
    const ts = now();
    const row = leads.get(id);
    if (row) row.last_event = { kind, ts };
    const d = details.get(id);
    if (d) d.timeline.push({ ts, who: myName, kind, note });
    fire({ kind: "lead.changed", lead_id: id, why: kind });
  }
  const acc = createAccStore({ role, myName, src: (p) => source(p), leads, fire, stamp });

  const api = {
    async get(path, params = {}) {
      if (path === "desk/config") { if (!config) config = await source("desk/config"); return { ...clone(config), server_now: now() }; }
      if (path === "desk/inbox") {
        await loadViews(); rollClocks();
        const out = clone({ server_now: now(), ...listView([...leads.values()], role, params) });
        const todo = await acc.rowBadges(out.data);                  // call accountability: the next to-do on each row
        if (role === "salesman") out.counts.todo = todo;
        else out.counts.night = [...leads.values()].filter((r) => r.status === "new" && !r.salesman).length;
        return out;
      }
      if (/^acc\/|^desk\/leads\/\d+\/acc$/.test(path)) { await loadViews(); const a = await acc.get(path, params); if (a !== undefined) return a; }
      let m = path.match(/^desk\/leads\/(\d+)$/);
      if (m) { await loadViews(); rollClocks(); return detail(+m[1]); }
      if (path === "desk/feed") return { data: [], last_id: 0 };
      if (path === "chat/rooms") return { data: clone(await roomList()) };
      m = path.match(/^chat\/rooms\/([a-z]+)\/messages$/);
      if (m) {
        const box = clone(await roomMsgs(m[1]));
        if (params.after) box.data = box.data.filter((x) => x.id > +params.after);
        if (params.before) box.data = box.data.filter((x) => x.id < +params.before);
        return box;
      }
      if (path === "chat/members") { if (!members.has(params.room)) members.set(params.room, await source("chat/members", { room: params.room })); return clone(members.get(params.room)); }
      if (path === "ask/tasks") return { available: true, data: clone(await taskList()) };
      m = path.match(/^ask\/tasks\/(.+)$/);
      if (m) { const t = (await taskList()).find((x) => x.id === m[1]); if (!t) throw new ApiError(404, "not_found", "Task not found"); return clone(t); }
      return clone(await source(path, params));
    },

    async send(method, path, body = {}) {
      if (/^acc\/|^desk\/leads\/\d+\/(call-attempt|brief|reassign)$/.test(path)) {
        await loadViews();
        const lid = +((path.match(/^desk\/leads\/(\d+)\//) || [])[1] || 0);
        if (lid) await detail(lid);
        const a = await acc.send(method, path, body);
        if (a !== undefined) return a;
      }
      let m = path.match(/^desk\/leads\/(\d+)\/(claim|status|notes|call|reply|ai-call)$/);
      if (m) {
        const id = +m[1], what = m[2];
        await loadViews(); await detail(id);
        const row = leads.get(id), d = details.get(id);
        if (what === "call") throw new ApiError(403, "feature_off", "Demo: calling is off.");
        if (what === "reply") throw new ApiError(403, "feature_off", "Demo: replying from the app is off.");
        if (what === "claim") {
          if (row.status !== "new") throw new ApiError(409, "already_claimed", `${row.salesman || "Someone"} claimed it first.`);
          Object.assign(row, { status: "claimed", stage: "claimed", mine: true, claimable: false, claim: null, salesman: myName });
          if (d._unlock) { d.thread = d._unlock.thread; d.call = d._unlock.call; }
          stamp(id, "claimed");
          return { ok: true, lead: clone(row) };
        }
        if (what === "notes") {
          const text = String(body.text || "").trim();
          if (!text) throw new ApiError(400, "validation", "Write a note first.", { text: "required" });
          stamp(id, "note", text.slice(0, 500));
          return { ok: true };
        }
        if (what === "ai-call") {
          const aid = nextAction++;
          return { ok: true, action_id: aid, preview: `Anita will call ${row.name} ${body.when || "soon"} to ${STAGE_LABEL[body.purpose] || "call back"}${body.note ? `, and mention: ${body.note}` : ""}.`, due_at: istStr(Date.now() + 60 * 60000) };
        }
        // status
        const s = body.status;
        if (s === "contacted") { Object.assign(row, { status: "contacted", stage: "contacted" }); stamp(id, "contacted", body.note || null); }
        else if (s === "visit_booked") { if (OPEN.includes(row.status)) row.status = "contacted"; row.stage = "visit_booked"; stamp(id, "visit_booked", body.at || null); }
        else if (s === "test_drive") { if (OPEN.includes(row.status)) row.status = "contacted"; row.stage = "test_drive"; stamp(id, "test_drive", body.car || null); }
        else if (s === "sold") { Object.assign(row, { status: "sold", stage: "sold" }); stamp(id, "sold", body.token_taken ? "Token taken" : body.note || null); }
        else if (s === "lost") { Object.assign(row, { status: "lost", stage: "lost" }); d.annotation = { lost_reason: body.lost_reason || "other" }; stamp(id, "lost", body.lost_reason || "other"); }
        else throw new ApiError(400, "validation", "Unknown status.");
        if (body.note && s !== "contacted") stamp(id, "note", body.note);
        return { ok: true, status: row.status, stage: row.stage };
      }
      m = path.match(/^desk\/ai-actions\/(\d+)\/(confirm|cancel)$/);
      if (m) { return { ok: true }; }
      m = path.match(/^chat\/rooms\/([a-z]+)\/(messages|read)$/);
      if (m) {
        const key = m[1], box = await roomMsgs(key), list = await roomList();
        const room = list.find((r) => r.key === key);
        if (m[2] === "read") { box.last_read_id = Math.max(box.last_read_id || 0, +body.last_id || 0); if (room) room.unread = 0; fire({ kind: "chat.read", room: key }); return { ok: true }; }
        const text = String(body.text || "").trim();
        if (!text) throw new ApiError(400, "validation", "Write a message first.");
        const dup = box.data.find((x) => body.client_id && x.client_id === body.client_id);
        if (dup) return { ok: true, message: clone(dup) };
        const msg = { id: nextMsg++, ts: now(), user: { ...persona }, text: text.slice(0, 2000), photo: null, mentions: body.mentions || [], mine: true, deleted: false, client_id: body.client_id };
        box.data.push(msg); box.last_read_id = msg.id;
        if (room) room.last = { id: msg.id, author: persona.name, preview: text.slice(0, 80), ts: msg.ts };
        fire({ kind: "chat.message", room: key, message_id: msg.id });
        return { ok: true, message: clone(msg) };
      }
      m = path.match(/^chat\/messages\/(\d+)$/);
      if (m && method === "DELETE") {
        for (const box of msgs.values()) { const x = box.data.find((y) => y.id === +m[1]); if (x) { Object.assign(x, { deleted: true, text: null, photo: null }); fire({ kind: "chat.deleted", room: box.room, message_id: x.id }); } }
        return { ok: true };
      }
      if (path === "push/subscriptions") return { ok: true, id: 1 };
      if (path === "push/test") return { ok: true, sent: 0 };
      if (/^push\/subscriptions\/\d+$/.test(path)) return { ok: true };
      throw new ApiError(404, "not_found", "Not part of the sample data.");
    },

    async upload(path, fd) {
      if (/^desk\/leads\/\d+\/proof$/.test(path)) { await loadViews(); await detail(+path.split("/")[2]); const a = await acc.upload(path, fd); if (a !== undefined) return a; }
      let m = path.match(/^chat\/rooms\/([a-z]+)\/photos$/);
      if (m) {
        const key = m[1], box = await roomMsgs(key), list = await roomList(), room = list.find((r) => r.key === key);
        const file = fd.get("file");
        const msg = { id: nextMsg++, ts: now(), user: { ...persona }, text: (fd.get("caption") || "").toString().trim() || null,
          photo: { url: URL.createObjectURL(file) }, mentions: [], mine: true, deleted: false, client_id: fd.get("client_id") };
        box.data.push(msg); box.last_read_id = msg.id;
        if (room) room.last = { id: msg.id, author: persona.name, preview: msg.text || "Photo", ts: msg.ts };
        fire({ kind: "chat.message", room: key, message_id: msg.id });
        return { ok: true, message: clone(msg) };
      }
      if (path === "ask/tasks") {
        const list = await taskList();
        const t = { id: `t_demo_${nextTask++}`, text: String(fd.get("text") || "").slice(0, 4000), status: "queued", result_text: null, result_url: null, created_at: now(), updated_at: now() };
        list.unshift(t);
        setTimeout(() => { t.status = "working"; t.updated_at = now(); fire({ kind: "ask.updated", task_id: t.id }); }, 1500);
        setTimeout(() => { t.status = "done"; t.result_text = DEMO_ANSWER; t.updated_at = now(); fire({ kind: "ask.updated", task_id: t.id, done: true }); }, 4200);
        return { id: t.id, status: "queued" };
      }
      throw new ApiError(404, "not_found", "Not part of the sample data.");
    },
  };
  return api;
}
