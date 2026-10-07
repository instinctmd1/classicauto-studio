// Call accountability sample answers for the static demo (ACCOUNTABILITY-SPEC.md 11.3 and 11.5 shapes), plus the
// in-memory actions: press Call, fill a brief, send a screenshot, check one, move a lead, warnings, leave, call rules.
// Every name is made up and there is no phone number anywhere: "tel_url" is always null here.
import { ApiError } from "./api.js";
import { FOLLOWUP_SETTINGS, createFollowupStore, followupData } from "./desk-mock-followup.js";

const D = "2026-10-05";
const at = (hm, day = D) => `${day} ${hm.length === 5 ? hm + ":00" : hm}`;
const K = "Kabir (demo)", R = "Rohan (demo)", Z = "Zoya (demo)", A = "Aarav (demo)", P = "Partners (demo)", M = "Demo Manager";
const SEATS = [K, R, Z, A];
const TIER_SEATS = { luxury: [Z, R], premium: [K, R], core: [K, A] };
export const OUTCOMES = [
  { code: "spoke_interested", label: "Spoke: interested", spoke: true }, { code: "spoke_visit", label: "Spoke: visit or test drive fixed", spoke: true },
  { code: "spoke_callback", label: "Spoke: call back later", spoke: true }, { code: "spoke_negotiating", label: "Spoke: price, exchange or finance talk", spoke: true },
  { code: "spoke_not_interested", label: "Spoke: not interested", spoke: true }, { code: "spoke_bought", label: "Spoke: already bought elsewhere", spoke: true },
  { code: "no_answer", label: "Rang, no answer", spoke: false }, { code: "busy", label: "Busy or cut the call", spoke: false },
  { code: "unreachable", label: "Switched off or not reachable", spoke: false }, { code: "wrong_number", label: "Wrong number", spoke: false },
];
const SPOKE = new Set(OUTCOMES.filter((o) => o.spoke).map((o) => o.code));
const RECIPIENTS = { pass: ["manager", "owner"], missed_brief: ["sales_manager", "manager"], missing_proof: ["sales_manager", "manager"], warning: ["sales_manager", "manager"],
  escalated: ["manager", "owner"], proof_review: ["sales_manager", "manager"], review_flag: ["owner"], followup_approve: ["sales_manager", "manager"] };
const TIMER_KEYS = ["office_hours", "claim_sla_min", "call_sla_min", "brief_prompt_min", "proof_due_min"];
// The AI's reading of the two demo screenshots (SPEC-SCREENSHOT-AI 2.8): the engine's exact chip words, made-up digits
const TICK_41 = { source: "ai", state: "done", verdict: "spoke", ok: true, rank: 2, chip: "✓ Spoke - number matches, 10:12, 2:14", flag: null, flag_chip: null,
  row: { date: D, time: "10:12", duration_s: 134, direction: "outgoing", call_status: "connected", last4: "0139" } };
const TICK_43 = { source: "ai", state: "done", verdict: "too_short", ok: false, rank: 0, chip: "! Too short (0:08)", flag: "brief_says_spoke", flag_chip: "! Brief says spoke",
  row: { date: D, time: "10:18", duration_s: 8, direction: "outgoing", call_status: "connected", last4: "0133" } };
const TICK_33 = { source: "ai", state: "done", verdict: "spoke", ok: true, rank: 2, chip: "✓ Spoke - number matches, 16:20, 4:11", flag: null, flag_chip: null,
  row: { date: "2026-10-04", time: "16:20", duration_s: 251, direction: "outgoing", call_status: "connected", last4: "0131" } };

const brief = (o) => ({ id: 0, attempt_id: null, seat: K, state: "submitted", prompt_at: null, due_at: null, submitted_at: null, outcome: null, customer_said: null, plan: null, next_step: null, next_step_at: null, interest: null, ...o });
const attempt = (o) => ({ id: 0, ts: null, seat: K, source: "app_tel", status: "logged", answered: null, duration_s: null, talk_s: null, verified: 0, has_recording: false, ...o });
const proof = (o) => ({ id: 0, state: "due", due_at: null, late: 0, submitted_at: null, file_id: null, image_url: null, declared_call_at: null, declared_duration_s: null, checks: null, reviewed_by: null, reviewed_at: null, review_note: null, ...o });
const state = (o) => ({ holder: K, queue: null, wave_at: null, pass_no: 0, round: 0, max_rounds: 2, claimed_at: null, call_due_at: null, first_call_at: null, proof_due_at: null, ...o });
const OK_CHECKS = { image: true, after_call_press: true, in_window: true, on_time: true, duration_vs_brief: true, duplicate: true };

/** Everything the demo's accountability screens start from (the store moves the times to "now" once). */
export function accData() {
  return {
    server_now: at("11:20"),
    followups: followupData(),                       // the follow-up list (desk-mock-followup.js)
    settings: { settings: { enabled: true, office_hours: "10:00-21:00", claim_sla_min: 15, claim_sla_by_tier: {}, call_sla_min: 15, brief_prompt_min: 3, proof_due_min: 30,
      missing_proof_action: "escalate", max_rounds: 2, after_max_rounds: "owners", recipients: RECIPIENTS, sales_manager: null, block_claim_on_overdue_brief: true,
      review_sample_pct: 100, night_distribution: true, release_wave_size: 3, release_wave_every_min: 20, weekly_off: { [R]: "tue" },
      exotel: { enabled: false, hide_number: true, record: false, min_connected_sec: 20 }, ai_proof_check: false, ai_proof_daily_cap: 200, proof_reader: "local", followup: { ...FOLLOWUP_SETTINGS } },
    advanced: { brief_reminder_every_min: 5, brief_max_reminders: 3, warning_window_days: 30, ai_proof_model: "claude-haiku-4-5", ai_proof_escalate_model: "claude-sonnet-5-5" },
    ai_today: { read: 3, claude: 0, last_at: at("10:31") }, brief_outcomes: OUTCOMES, interest: ["hot", "warm", "cold", "none"], version: "demo-1",
    live: { exotel_keys: false, hours_by_day: null, closed_dates: [], tiers: [{ name: "Luxury 50L+", key: "luxury", claim_sla_min: 15 }, { name: "Premium 20-50L", key: "premium", claim_sla_min: 15 }, { name: "Core under 20L", key: "core", claim_sla_min: 15 }],
      staff: [{ name: K, role: "sales" }, { name: R, role: "sales" }, { name: Z, role: "sales" }, { name: A, role: "sales" }, { name: M, role: "manager" }, { name: P, role: "owner" }] } },
    todo: {
      [K]: [{ lead_id: 1035, seat: K, kind: "call", due_at: at("11:27"), state: "due" }, { lead_id: 1031, seat: K, kind: "brief", brief_id: 90, due_at: at("11:30"), state: "open" },
        { lead_id: 1035, seat: K, kind: "proof", proof_id: 44, due_at: at("11:42"), state: "due" },
        { lead_id: 1037, seat: K, kind: "followup", item_id: 488, due_at: at("10:30", "2026-10-08"), state: "at_risk", reasons: ["next_step_overdue"] }],
      [R]: [{ lead_id: 1038, seat: R, kind: "proof", proof_id: 42, due_at: at("10:35"), state: "missed" }],
      [Z]: [], [A]: [],
    },
    claims: { [K]: [{ lead_id: 1042, due_at: at("11:27:30") }], [R]: [{ lead_id: 1044, due_at: at("11:29") }], [Z]: [{ lead_id: 1046, due_at: at("11:26") }], [A]: [{ lead_id: 1045, due_at: at("11:24:30") }] },
    lead: {
      1035: { state: state({ claimed_at: at("11:12"), call_due_at: at("11:27"), proof_due_at: at("11:42") }), attempts: [], briefs: [],
        proof: proof({ id: 44, due_at: at("11:42") }), passes: [{ ts: at("11:08"), from: null, to: K, reason: "new", round: 0, pass_no: 0, by: null }], warnings: [] },
      1037: { state: state({ claimed_at: at("10:09"), call_due_at: at("10:24"), first_call_at: at("10:12"), proof_due_at: at("10:39") }),
        attempts: [attempt({ id: 301, ts: at("10:12") })],
        briefs: [brief({ id: 88, attempt_id: 301, prompt_at: at("10:22"), due_at: at("10:39"), submitted_at: at("10:21"), outcome: "spoke_visit", customer_said: "Wants the white Creta, coming this evening at 5 with family",
          plan: "Keep the car washed and ready, check the exchange value of his old i20", next_step: "Confirm the visit an hour before", next_step_at: at("16:00"), interest: "hot" })],
        proof: proof({ id: 41, state: "submitted", due_at: at("10:39"), submitted_at: at("10:30"), file_id: "demo1", image_url: "img/demo-proof-1.svg", declared_call_at: at("10:12"), declared_duration_s: 134, checks: OK_CHECKS, tick: TICK_41 }),
        passes: [{ ts: at("10:05"), from: null, to: K, reason: "new", round: 0, pass_no: 0, by: null }], warnings: [] },
      1031: { state: state({ claimed_at: at("16:14", "2026-10-04"), call_due_at: at("16:29", "2026-10-04"), first_call_at: at("16:20", "2026-10-04"), proof_due_at: at("16:44", "2026-10-04") }),
        attempts: [attempt({ id: 288, ts: at("16:20", "2026-10-04") }), attempt({ id: 305, ts: at("11:05") })],
        briefs: [brief({ id: 71, attempt_id: 288, submitted_at: at("16:29", "2026-10-04"), outcome: "spoke_callback", customer_said: "Wants a 7-seater for the family, will bring his father for a drive", plan: "Book a test drive slot for Sunday", next_step: "Call back after the test drive", next_step_at: at("11:00"), interest: "warm" }),
          brief({ id: 90, attempt_id: 305, state: "open", prompt_at: at("11:15"), due_at: at("11:30") })],
        proof: proof({ id: 33, state: "approved", due_at: at("16:44", "2026-10-04"), submitted_at: at("16:31", "2026-10-04"), declared_call_at: at("16:20", "2026-10-04"), declared_duration_s: 251, checks: OK_CHECKS, reviewed_by: M, reviewed_at: at("17:02", "2026-10-04"), tick: TICK_33 }),
        passes: [{ ts: at("16:10", "2026-10-04"), from: null, to: K, reason: "new", round: 0, pass_no: 0, by: null }], warnings: [] },
      1033: { state: state({ holder: A, claimed_at: at("10:03"), call_due_at: at("10:18"), first_call_at: at("10:18"), proof_due_at: at("10:33") }),
        attempts: [attempt({ id: 299, ts: at("10:18"), seat: A })],
        briefs: [brief({ id: 86, attempt_id: 299, seat: A, submitted_at: at("10:26"), outcome: "spoke_interested", customer_said: "Asked for the battery health report and the charging cable", plan: "Send the battery report on WhatsApp", next_step: "Follow up on the report", next_step_at: at("15:00"), interest: "warm" })],
        proof: proof({ id: 43, state: "submitted", due_at: at("10:33"), submitted_at: at("10:31"), file_id: "demo2", image_url: "img/demo-proof-2.svg", declared_call_at: at("10:18"), declared_duration_s: 8, checks: { ...OK_CHECKS, duration_vs_brief: false }, tick: TICK_43 }),
        passes: [{ ts: at("10:00"), from: null, to: A, reason: "night", round: 0, pass_no: 0, by: null }], warnings: [] },
      1038: { state: state({ holder: R, claimed_at: at("10:05"), call_due_at: at("10:20"), first_call_at: at("10:12"), proof_due_at: at("10:35") }),
        attempts: [attempt({ id: 297, ts: at("10:12"), seat: R })],
        briefs: [brief({ id: 84, attempt_id: 297, seat: R, submitted_at: at("10:24"), outcome: "spoke_negotiating", customer_said: "Liked the Q5, wants a better price with his old car in exchange", plan: "Get the exchange value from the workshop", next_step: "Call back with the exchange offer", next_step_at: at("17:00"), interest: "hot" })],
        proof: proof({ id: 42, state: "missed", due_at: at("10:35") }), passes: [{ ts: at("10:00"), from: null, to: R, reason: "night", round: 0, pass_no: 0, by: null }],
        warnings: [{ id: 105, type: "missing_proof", seat: R, status: "active" }] },
      1040: { state: state({ holder: P, pass_no: 3, round: 2, escalated_at: at("10:41") }), attempts: [], briefs: [], proof: null,
        passes: [{ ts: at("10:31"), from: null, to: Z, reason: "new", round: 0, pass_no: 0, by: null }, { ts: at("10:46"), from: Z, to: R, reason: "no_claim", round: 1, pass_no: 1, by: null },
          { ts: at("11:01"), from: R, to: Z, reason: "no_claim", round: 2, pass_no: 2, by: null }, { ts: at("11:16"), from: Z, to: P, reason: "max_rounds", round: 2, pass_no: 3, by: null }],
        warnings: [{ id: 113, type: "no_claim", seat: Z, status: "active" }, { id: 114, type: "no_claim", seat: R, status: "active" }] },
      1019: { state: state({ claimed_at: at("11:43", "2026-10-02"), first_call_at: at("11:50", "2026-10-02") }), attempts: [attempt({ id: 201, ts: at("11:50", "2026-10-02") })],
        briefs: [brief({ id: 52, attempt_id: 201, submitted_at: at("12:02", "2026-10-02"), outcome: "spoke_visit", customer_said: "Coming tomorrow evening to see the Brezza", plan: "Keep the papers ready", next_step: "Meet at the showroom", next_step_at: at("17:00", "2026-10-03"), interest: "hot" })],
        proof: proof({ id: 21, state: "approved", due_at: at("12:13", "2026-10-02"), submitted_at: at("12:05", "2026-10-02"), declared_call_at: at("11:50", "2026-10-02"), declared_duration_s: 312, checks: OK_CHECKS, reviewed_by: M }),
        passes: [{ ts: at("11:40", "2026-10-02"), from: null, to: K, reason: "new", round: 0, pass_no: 0, by: null }], warnings: [] },
    },
    queue: [            // the engine's order: the one that looks wrong first (rank 0), then oldest
      { proof_id: 43, lead_id: 1033, seat: A, submitted_at: at("10:31"), due_at: at("10:33"), late: 0, file_id: "demo2", image_url: "img/demo-proof-2.svg", declared_call_at: at("10:18"), declared_duration_s: 8,
        first_call_at: at("10:18"), brief_outcome: "spoke_interested", checks: { ...OK_CHECKS, duration_vs_brief: false }, customer: "Demo Customer 0133", car: "Tata Nexon EV 2023", tier: "Core under 20L", phone_last4: "•••• 0133", phone: null, tick: TICK_43 },
      { proof_id: 41, lead_id: 1037, seat: K, submitted_at: at("10:30"), due_at: at("10:39"), late: 0, file_id: "demo1", image_url: "img/demo-proof-1.svg", declared_call_at: at("10:12"), declared_duration_s: 134,
        first_call_at: at("10:12"), brief_outcome: "spoke_visit", checks: OK_CHECKS, customer: "Demo Customer 0139", car: "Hyundai Creta 2022", tier: "Core under 20L", phone_last4: "•••• 0139", phone: null, tick: TICK_41 },
    ],
    warnings: [
      w(114, at("11:01"), R, 1040, "no_claim", { detail: "round 1 of 2" }), w(113, at("11:16"), Z, 1040, "no_claim", { detail: "round 2 of 2" }),
      w(105, at("10:36"), R, 1038, "missing_proof"), w(104, at("12:40", "2026-10-04"), R, 1030, "no_call", { explanation: "The customer said to call after lunch" }),
      w(103, at("20:35", "2026-10-04"), K, 0, "rollcall_missed"), w(106, at("15:10", "2026-10-03"), R, 1027, "no_claim"),
      w(101, at("12:40", "2026-10-03"), K, 1024, "no_call", { explanation: "Was with a walk-in customer, called at 12:52" }),
      w(107, at("18:20", "2026-10-03"), Z, 0, "manual", { source: "manual", category: "behaviour", detail: "Left the floor without telling the manager", created_by: M }),
      w(102, at("12:30", "2026-10-02"), K, 1019, "missed_brief", { status: "excused", excused_by: M, excused_at: at("13:00", "2026-10-02"), excuse_reason: "The app was down at the time; brief written on paper" }),
      w(108, at("11:30", "2026-10-04"), A, 1028, "no_claim"), w(109, at("14:10", "2026-10-04"), A, 1029, "no_call"), w(110, at("16:45", "2026-10-03"), A, 1026, "missed_brief"),
      w(111, at("17:20", "2026-10-03"), A, 1026, "missing_proof"), w(112, at("19:05", "2026-10-02"), A, 1021, "customer_denied"),
    ],
    scorecard: {
      how: "Your share of new leads goes up with sales, fast first calls and few warnings; it never drops below half a normal share. Score: 50% sales, 30% speed to the first call, 20% warnings.",
      data: [
        sc(K, { received: 18, claimed: 17, claim_rate_pct: 94.4, passed_on: 1, median_claim_min: 3.5, calls: 26, called_in_time_pct: 94.1, median_first_call_min: 3.0,
          proofs: { approved: 14, approved_auto: 0, rejected: 0, pending: 1, missed: 0, verified: 0, waived: 1, spoke_ticks: 13, ai_mismatch: 0, ai_look: 1 }, briefs: { due: 26, on_time: 25, late: 0, missed: 1, on_time_pct: 96.2 },
          visits_booked: 5, test_drives: 3, sold: 2, lost: 3, conversion_pct: 11.8, warnings: { active: 2, excused: 1, by_type: { no_call: 1, rollcall_missed: 1, missed_brief: 1 } }, score: 71, weight: 1.18 }),
        sc(R, { received: 16, claimed: 13, claim_rate_pct: 81.3, passed_on: 3, median_claim_min: 7.0, calls: 19, called_in_time_pct: 84.6, median_first_call_min: 6.5,
          proofs: { approved: 10, approved_auto: 0, rejected: 1, pending: 0, missed: 2, verified: 0, waived: 0, spoke_ticks: 8, ai_mismatch: 2, ai_look: 1 }, briefs: { due: 19, on_time: 16, late: 2, missed: 1, on_time_pct: 84.2 },
          visits_booked: 4, test_drives: 2, sold: 1, lost: 4, conversion_pct: 7.7, warnings: { active: 4, excused: 0, by_type: { no_claim: 2, missing_proof: 1, no_call: 1 } }, score: 54, weight: 0.9, flag: "watch" }),
        sc(Z, { received: 14, claimed: 13, claim_rate_pct: 92.9, passed_on: 1, median_claim_min: 4.5, calls: 17, called_in_time_pct: 92.3, median_first_call_min: 4.0,
          proofs: { approved: 11, approved_auto: 0, rejected: 0, pending: 0, missed: 0, verified: 0, waived: 1, spoke_ticks: 11, ai_mismatch: 0, ai_look: 0 }, briefs: { due: 17, on_time: 16, late: 1, missed: 0, on_time_pct: 94.1 },
          visits_booked: 4, test_drives: 3, sold: 2, lost: 2, conversion_pct: 15.4, warnings: { active: 2, excused: 0, by_type: { no_claim: 1, manual: 1 } }, score: 66, weight: 1.1, off_today: false }),
        sc(A, { received: 15, claimed: 11, claim_rate_pct: 73.3, passed_on: 4, median_claim_min: 9.5, calls: 14, called_in_time_pct: 72.7, median_first_call_min: 11.0,
          proofs: { approved: 7, approved_auto: 0, rejected: 1, pending: 1, missed: 2, verified: 0, waived: 0, spoke_ticks: 5, ai_mismatch: 3, ai_look: 1 }, briefs: { due: 14, on_time: 10, late: 2, missed: 2, on_time_pct: 71.4 },
          visits_booked: 2, test_drives: 1, sold: 0, lost: 5, conversion_pct: 0, warnings: { active: 5, excused: 0, by_type: { no_claim: 1, no_call: 1, missed_brief: 1, missing_proof: 1, customer_denied: 1 } }, score: 41, weight: 0.68, flag: "review" }),
      ],
    },
    night: { open: true, leads: [{ id: 1038, ts: at("07:50"), tier: "Luxury 50L+", seat: R, wave_at: at("10:00"), announced: true }, { id: 1033, ts: at("09:30"), tier: "Core under 20L", seat: A, wave_at: at("10:00"), announced: true }], preview: {} },
    off: [{ id: 1, seat: Z, date_from: "2026-10-08", date_to: "2026-10-09", reason: "Family function" }],
  };
}
function w(id, ts, seat, lead_id, type, o = {}) {
  return { id, ts, seat, lead_id, type, source: "auto", category: null, detail: null, status: "active", explanation: null, excused_by: null, excused_at: null, excuse_reason: null, created_by: "system", ...o };
}
function sc(seat, o) {
  return { seat, received: 0, claimed: 0, claim_rate_pct: null, passed_on: 0, median_claim_min: null, calls: 0, called_in_time_pct: null, median_first_call_min: null,
    verified_calls: 0, connected_calls: 0, talk_min: 0, proofs: {}, briefs: {}, visits_booked: 0, test_drives: 0, sold: 0, lost: 0, conversion_pct: null,
    warnings: { active: 0, excused: 0, by_type: {} }, score: null, weight: 1, rated: true, flag: null, off_today: false, ...o };
}

/** The accountability keys of a lead's "allowed" block, as the server adds them while accountability is on. */
export function accAllowedFor(row, role) {
  const act = role !== "staff", open = ["new", "claimed", "contacted", "escalated"].includes(row.status);
  const holder = role !== "salesman" || row.mine;
  return {
    call_attempt: act && open && holder && (role !== "salesman" || ["claimed", "contacted"].includes(row.status)),
    brief: act && row.status !== "new" && holder,
    proof_upload: role === "salesman" && row.mine && ["claimed", "contacted", "escalated"].includes(row.status),
    reassign: (role === "owner" || role === "manager") && open,
    ...(role === "salesman" ? { contacted: false } : {}),
  };
}

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const istMs = (s) => Date.parse(String(s).replace(" ", "T") + (String(s).length === 16 ? ":00" : "") + "+05:30");
const istStr = (ms) => new Date(ms + 5.5 * 36e5).toISOString().slice(0, 19).replace("T", " ");

/**
 * The in-memory accountability side of the demo store. src(path) gives the time-shifted starting data; leads and fire
 * come from the main store so a brief or a move shows on the Inbox at once.
 */
export function createAccStore({ role, myName, src, leads, fire, stamp }) {
  let db = null, nextId = 900;
  const now = () => istStr(Date.now());
  const plus = (min) => istStr(Date.now() + min * 60000);
  async function data() { if (!db) db = await src("acc/_db"); return db; }
  const mySeat = () => (role === "salesman" ? myName : role === "owner" ? P : null);
  const lead = (id) => {
    if (!db.lead[id]) db.lead[id] = { state: state({ holder: leads.get(id)?.salesman || null }), attempts: [], briefs: [], proof: null, passes: [], warnings: [] };
    return db.lead[id];
  };
  const rowOf = (id) => leads.get(id);
  const visibleTo = (id) => { const r = rowOf(id); return r && (role !== "salesman" || (r.salesman === myName && r.status !== "new")); };
  function todoFor(seat) {
    const items = clone(db.todo[seat] || []);
    for (const c of db.claims[seat] || []) { const r = rowOf(c.lead_id); if (r && r.status === "new" && r.salesman === seat) items.push({ lead_id: c.lead_id, seat, kind: "claim", due_at: r.claim?.deadline_at || c.due_at, state: "due" }); }
    for (const it of items) if (it.state === "open" && istMs(it.due_at) < Date.now()) it.state = "missed";
    items.sort((a, b) => (a.state === "missed" ? 0 : 1) - (b.state === "missed" ? 0 : 1) || istMs(a.due_at) - istMs(b.due_at));
    return items;
  }
  const dropTodo = (seat, id, kind) => { db.todo[seat] = (db.todo[seat] || []).filter((x) => !(x.lead_id === id && x.kind === kind)); };
  const bump = (id, why) => fire({ kind: "lead.changed", lead_id: id, why });
  const notFound = () => new ApiError(404, "not_found", "Not part of the sample data.");
  const fu = createFollowupStore({ role, myName, mySeat, data, rowOf, lead, tierSeats: TIER_SEATS, fire, now, plus, nextId: () => nextId++ });

  return {
    async rowBadges(rows) {
      await data();
      const seat = mySeat();
      const items = seat ? todoFor(seat).filter((x) => x.kind !== "claim") : [];
      for (const r of rows) {
        const mine = items.filter((x) => x.lead_id === r.id);
        mine.sort((a, b) => (a.state === "missed" ? 0 : 1) - (b.state === "missed" ? 0 : 1) || istMs(a.due_at) - istMs(b.due_at));
        r.acc = mine.length ? { next: { kind: mine[0].kind, due_at: mine[0].due_at, state: mine[0].state }, count: mine.length } : null;
      }
      return items.length;
    },
    async get(path, p = {}) {
      if (path.startsWith("acc/followups")) return fu.get(path, p);
      if (path === "acc/settings") {
        const d = await data();
        if (role === "owner") return clone(d.settings);
        const s = d.settings.settings;
        return { timers: { ...Object.fromEntries(TIMER_KEYS.map((k) => [k, s[k]])), followup: s.followup }, enabled: s.enabled, exotel: { enabled: !!s.exotel.enabled }, brief_outcomes: OUTCOMES, interest: ["hot", "warm", "cold", "none"] };
      }
      if (path === "acc/todo") {
        await data();
        if (role === "staff") throw new ApiError(403, "forbidden", "You do not have access to this.");
        const seat = p.seat && role !== "salesman" ? p.seat : mySeat();
        const items = seat && seat !== P ? todoFor(seat) : [];
        return { server_now: now(), open: true, enabled: true, blocked_from_claiming: false, seat, items, ...(role !== "salesman" ? { review_queue: db.queue.length } : {}) };
      }
      let m = path.match(/^desk\/leads\/(\d+)\/acc$/);
      if (m) {
        await data();
        const id = +m[1];
        if (role === "staff" || !visibleTo(id)) throw notFound();
        const a = clone(lead(id));
        a.enabled = true; a.brief_outcomes = OUTCOMES;
        if (role === "salesman") {
          a.warnings = a.warnings.filter((x) => x.seat === myName);
          if (a.proof) delete a.proof.tick;          // the AI's verdict is for reviewers only
        } else {
          const tier = rowOf(id)?.tier_key, band = TIER_SEATS[tier] || [];
          a.seats = [...SEATS, P].map((s) => ({ seat: s, band: band.includes(s) }));
        }
        for (const x of a.attempts) x.recording_url = null;
        return a;
      }
      if (path === "acc/review") { await data(); if (role === "salesman" || role === "staff") throw new ApiError(403, "forbidden", "You do not have access to this."); return { data: clone(db.queue) }; }
      if (path === "acc/proofs") {                    // the Checked tab: every proof that is not waiting, newest first
        await data();
        if (role === "salesman" || role === "staff") throw new ApiError(403, "forbidden", "You do not have access to this.");
        const rows = Object.entries(db.lead).map(([lid, L]) => ({ lid: +lid, L })).filter(({ L }) => L.proof && !["due", "cancelled"].includes(L.proof.state))
          .map(({ lid, L }) => ({ proof_id: L.proof.id, lead_id: lid, seat: L.state?.holder || K, state: L.proof.state, submitted_at: L.proof.submitted_at, file_id: L.proof.file_id,
            image_url: L.proof.image_url, reviewed_by: L.proof.reviewed_by, reviewed_at: L.proof.reviewed_at, tick: L.proof.tick || null, phone_last4: null, customer: null }))
          .filter((x) => (!p.seat || x.seat === p.seat) && (!p.verdict || x.tick?.verdict === p.verdict))
          .sort((a, b) => String(b.submitted_at || "").localeCompare(String(a.submitted_at || "")));
        return { data: clone(rows), page: 1, page_size: 100, total: rows.length };
      }
      if (path === "acc/warnings") {
        await data();
        let rows = db.warnings.slice();
        const seat = role === "salesman" ? myName : p.seat;
        if (seat) rows = rows.filter((x) => x.seat === seat);
        if (p.type) rows = rows.filter((x) => x.type === p.type);
        if (p.status) rows = rows.filter((x) => x.status === p.status);
        if (p.from) rows = rows.filter((x) => x.ts.slice(0, 10) >= p.from);
        if (p.to) rows = rows.filter((x) => x.ts.slice(0, 10) <= p.to);
        rows.sort((a, b) => istMs(b.ts) - istMs(a.ts));
        const by = {};
        rows.forEach((x) => { if (x.status === "active") by[x.type] = (by[x.type] || 0) + 1; });
        const active = rows.filter((x) => x.status === "active").length;
        return { data: clone(rows), counts: { total: rows.length, active, excused: rows.length - active, by_type: by }, page: 1, page_size: 50, total: rows.length };
      }
      if (path === "acc/scorecard") {
        await data();
        const rows = role === "salesman"
          ? clone(db.scorecard.data.filter((x) => x.seat === myName)).map((x) => { ["spoke_ticks", "ai_mismatch", "ai_look"].forEach((k) => delete x.proofs[k]); return x; })
          : db.scorecard.data;
        const sum = (f) => db.scorecard.data.reduce((a, x) => a + (x[f] || 0), 0);
        const team = role === "salesman" ? null : { seat: null, received: sum("received"), claimed: sum("claimed"), passed_on: sum("passed_on"), called_in_time_pct: 86.6, median_first_call_min: 4.5,
          briefs: { on_time_pct: 87.9, missed: 4 }, warnings: { active: db.warnings.filter((x) => x.status === "active").length, excused: db.warnings.filter((x) => x.status === "excused").length }, sold: sum("sold") };
        return { period: { from: p.from || null, to: p.to || null }, team, data: clone(rows), how: db.scorecard.how };
      }
      if (path === "acc/night-queue") { await data(); return clone(db.night); }
      if (path === "acc/off") { await data(); return { data: clone(role === "salesman" ? db.off.filter((x) => x.seat === myName) : db.off) }; }
      return undefined;
    },

    async send(method, path, body = {}) {
      if (path.startsWith("acc/followups")) return fu.post(path, body);
      let m = path.match(/^desk\/leads\/(\d+)\/(call-attempt|brief|reassign)$/);
      if (m) {
        await data();
        const id = +m[1], row = rowOf(id), L = lead(id), seat = row?.salesman || myName;
        if (!row) throw notFound();
        if (m[2] === "call-attempt") {
          if (role === "salesman" && !(row.mine && ["claimed", "contacted"].includes(row.status))) throw new ApiError(409, "not_allowed", "Claim the lead first.");
          const aid = nextId++, ts = now();
          L.attempts.push(attempt({ id: aid, ts, seat: mySeat() || seat }));
          if (!L.state.first_call_at) L.state.first_call_at = ts;
          let b = L.briefs.find((x) => ["pending", "open"].includes(x.state));
          if (!b) {
            const first = !L.briefs.length;
            b = brief({ id: nextId++, attempt_id: aid, seat: mySeat() || seat, state: "pending", prompt_at: plus(10), due_at: first && L.proof?.due_at && istMs(L.proof.due_at) > Date.now() + 15 * 60000 ? L.proof.due_at : plus(25), submitted_at: null });
            L.briefs.push(b);
          }
          dropTodo(seat, id, "call");
          if (!(db.todo[seat] || []).some((x) => x.lead_id === id && x.kind === "brief")) (db.todo[seat] ||= []).push({ lead_id: id, seat, kind: "brief", brief_id: b.id, due_at: b.due_at, state: "pending" });
          stamp(id, "call_attempt", `${aid}|app_tel`);
          return { ok: true, attempt_id: aid, mode: "tel", brief_id: b.id, brief_prompt_at: b.prompt_at, message: "Call recorded", tel_url: null };
        }
        if (m[2] === "brief") {
          if (role !== "salesman" && seat !== mySeat()) throw new ApiError(403, "not_your_brief", "Only the salesman holding this lead fills its brief.");
          let b = body.brief_id ? L.briefs.find((x) => x.id === body.brief_id) : null;
          if (b && ["submitted", "late"].includes(b.state)) throw new ApiError(409, "already_submitted", "This brief was already filled.");
          if (!b) { b = brief({ id: nextId++, seat, state: "pending" }); L.briefs.push(b); }
          const late = b.state === "missed" || (b.due_at && istMs(b.due_at) < Date.now());
          Object.assign(b, { state: late ? "late" : "submitted", submitted_at: now(), outcome: body.outcome, customer_said: body.customer_said, plan: body.plan, next_step: body.next_step, next_step_at: body.next_step_at, interest: body.interest });
          dropTodo(seat, id, "brief");
          if (SPOKE.has(body.outcome) && ["new", "claimed"].includes(row.status)) Object.assign(row, { status: "contacted", stage: row.stage === "claimed" || row.stage === "new" ? "contacted" : row.stage });
          stamp(id, b.state === "late" ? "brief_late" : "brief_submitted", `${b.id}|${body.outcome}`);
          const suggest = body.outcome === "spoke_visit" ? "book_visit" : ["spoke_not_interested", "spoke_bought", "wrong_number"].includes(body.outcome) ? "close_lost" : null;
          return { ok: true, brief_id: b.id, state: b.state, lead_status: row.status, suggest };
        }
        // reassign
        if (role !== "owner" && role !== "manager") throw new ApiError(403, "forbidden", "You do not have access to this.");
        const from = row.salesman;
        dropTodo(from, id, "call"); dropTodo(from, id, "brief"); dropTodo(from, id, "proof");
        Object.assign(row, { salesman: body.to_seat, status: "new", stage: "new", mine: role === "salesman" && body.to_seat === myName, claim: { deadline_at: plus(15), sla_minutes: 15, paused: false, paused_until: null } });
        L.passes.push({ ts: now(), from, to: body.to_seat, reason: "manual", round: 0, pass_no: L.state.pass_no, by: mySeat() || M });
        L.briefs.forEach((x) => { if (["pending", "open"].includes(x.state)) x.state = "cancelled"; });
        if (L.proof && L.proof.state === "due") L.proof.state = "cancelled";
        (db.claims[body.to_seat] ||= []).push({ lead_id: id, due_at: row.claim.deadline_at });
        stamp(id, "reassigned_manual", `${mySeat() || M}|${from || ""}|${body.to_seat}`);
        return { ok: true, salesman: body.to_seat, status: "new", lead: clone(row) };
      }
      m = path.match(/^acc\/proofs\/(\d+)\/review$/);
      if (m) {
        await data();
        const q = db.queue.find((x) => x.proof_id === +m[1]);
        if (!q) throw new ApiError(409, "already_decided", "Someone already checked this one.");
        db.queue = db.queue.filter((x) => x !== q);
        const st = { approve: "approved", reject: "rejected", waive: "waived" }[body.decision];
        const L = db.lead[q.lead_id];
        if (L?.proof) Object.assign(L.proof, { state: st, reviewed_by: mySeat() || M, reviewed_at: now(), review_note: body.note || null });
        if (body.decision === "reject") db.warnings.unshift(w(nextId++, now(), q.seat, q.lead_id, "proof_rejected", { detail: body.note || null }));
        bump(q.lead_id, `proof_${st}`);
        return { ok: true, state: st };
      }
      if (path === "acc/settings") {
        await data();
        if (role !== "owner") throw new ApiError(403, "forbidden", "You do not have access to this.");
        if (body.version !== db.settings.version) throw new ApiError(409, "version_conflict", "Someone else changed the rules.");
        for (const [k, v] of Object.entries(body.changes || {})) db.settings.settings[k] = clone(v);
        db.settings.version = "demo-" + (+db.settings.version.split("-")[1] + 1);
        return clone(db.settings);
      }
      if (path === "acc/warnings") {
        await data();
        const id = nextId++;
        db.warnings.unshift(w(id, now(), body.seat, body.lead_id || 0, "manual", { source: "manual", category: body.category, detail: body.reason, created_by: mySeat() || M }));
        fire({ kind: "acc.changed", why: "warning" });
        return { ok: true, id };
      }
      m = path.match(/^acc\/warnings\/(\d+)\/(excuse|explain)$/);
      if (m) {
        await data();
        const x = db.warnings.find((y) => y.id === +m[1]);
        if (!x) throw notFound();
        if (m[2] === "excuse") Object.assign(x, { status: "excused", excused_by: mySeat() || M, excused_at: now(), excuse_reason: body.reason });
        else { if (x.explanation) throw new ApiError(409, "already_explained", "You already explained this one."); Object.assign(x, { explanation: body.text, explained_at: now() }); }
        return { ok: true };
      }
      if (path === "acc/off") { await data(); const id = nextId++; db.off.push({ id, seat: body.seat, date_from: body.from, date_to: body.to, reason: body.reason || null }); return { ok: true, id }; }
      m = path.match(/^acc\/off\/(\d+)\/delete$/);
      if (m) { await data(); db.off = db.off.filter((x) => x.id !== +m[1]); return { ok: true }; }
      return undefined;
    },

    async upload(path, fd) {
      const m = path.match(/^desk\/leads\/(\d+)\/proof$/);
      if (!m) return undefined;
      await data();
      const id = +m[1], row = rowOf(id), L = lead(id);
      if (!row || role !== "salesman" || !row.mine) throw new ApiError(409, "not_allowed", "Only the salesman holding this lead adds its call screenshot.");
      const file = fd.get("file");
      const [mm, ss] = String(fd.get("duration") || "0:00").split(":");
      const late = L.proof?.due_at && istMs(L.proof.due_at) < Date.now() ? 1 : 0;
      L.proof = proof({ ...(L.proof || {}), id: L.proof?.id || nextId++, state: "submitted", late, submitted_at: now(), image_url: file ? URL.createObjectURL(file) : null,
        declared_call_at: `${now().slice(0, 10)} ${fd.get("call_time")}:00`, declared_duration_s: (+mm || 0) * 60 + (+ss || 0), checks: OK_CHECKS });
      dropTodo(row.salesman, id, "proof");
      stamp(id, "proof_submitted", String(L.proof.id));
      return { ok: true, proof_id: L.proof.id, state: "submitted", checks: OK_CHECKS, image_url: L.proof.image_url };
    },
  };
}
