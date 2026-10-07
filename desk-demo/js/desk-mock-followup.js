// The follow-up list for the static demo (SPEC-FOLLOWUP-RESHUFFLE 9.2, 9.3 and 12): one open list, two past lists, the
// salesman's at-risk lead, and the decisions in memory (a reshuffle moves the lead to another demo salesman of its band,
// never back to the one it came from (the demo's reason lines carry no times: its clock is moved to now), and gives the old one a "Not followed up" warning). Made-up names only, no phone
// number anywhere.
import { ApiError } from "./api.js";

const D = "2026-10-05";
const at = (hm, day = D) => `${day} ${hm.length === 5 ? hm + ":00" : hm}`;
const K = "Kabir (demo)", R = "Rohan (demo)", A = "Aarav (demo)";
export const FOLLOWUP_SETTINGS = { enabled: true, cycle_days: 3, run_at: "10:30", grace_days: 1, max_days_without_contact: 3, customer_wait_hours: 4,
  heads_up: true, approve_hours: 24, warn: true };

const ev = (o) => ({ status: "contacted", assigned_at: null, claimed_at: null, last_followup: null, next_step_at: null, proof: null, customer_last_in: null,
  inbound_missed_at: null, days_without: 0, attempts_since_assign: 1, off_days: 0, times_listed: 1, ...o });
const item = (o) => ({ stage: "listed", state: "pending", times_listed: 1, own_seat: false, followed_up_after_cut: null, default_action: "reshuffle", decided: null,
  void_reason: null, lead_status: "contacted", reasons: [], evidence: ev({}), clear: ["call_brief"], ...o });
const R_ = (code, label, detail) => ({ code, label, detail });

/** The starting picture; the demo store moves every time to "now" once (it is part of accData). */
export function followupData() {
  return {
    cycles: {
      12: { cycle_id: 12, cut_date: D, cut_at: at("10:30"), built_at: at("10:30"), approve_due_at: at("12:30", "2026-10-07"), state: "open", items: [
        item({ item_id: 501, lead_id: 1031, seat: K, tier: "Premium 20-50L",
          reasons: [R_("no_proof", "No proof of the first call", "Screenshot missed"), R_("next_step_overdue", "Next step date passed and not done", "Last follow-up: Spoke: call back later")],
          evidence: ev({ last_followup: { at: at("16:29", "2026-10-03"), kind: "call_brief", outcome: "spoke_callback" }, next_step_at: at("11:00", "2026-10-03"), proof: { state: "missed", late: false, verdict: null, chip: null }, days_without: 1 }),
          clear: ["proof", "call_brief"] }),
        item({ item_id: 502, lead_id: 1035, seat: K, tier: "Premium 20-50L", lead_status: "claimed", times_listed: 2,
          reasons: [R_("no_contact", "No follow-up for 4 days", "Last follow-up: Rang, no answer")],
          evidence: ev({ status: "claimed", last_followup: { at: at("12:35", "2026-10-01"), kind: "call_brief", outcome: "no_answer" }, proof: { state: "approved", late: false, verdict: "no_answer", chip: "No answer - number matches" }, days_without: 4, attempts_since_assign: 1, times_listed: 2 }) }),
        item({ item_id: 503, lead_id: 1038, seat: R, tier: "Luxury 50L+", lead_status: "claimed", followed_up_after_cut: at("11:05"), default_action: "excuse",
          reasons: [R_("customer_waiting", "Customer wrote and got no reply", "Last follow-up: Spoke: price, exchange or finance talk"), R_("next_step_overdue", "Next step date passed and not done", "Last follow-up: Spoke: price, exchange or finance talk")],
          evidence: ev({ status: "claimed", last_followup: { at: at("10:24", "2026-10-02"), kind: "call_brief", outcome: "spoke_negotiating" }, next_step_at: at("17:00", "2026-10-02"), customer_last_in: at("15:10", "2026-10-02"), days_without: 2, off_days: 1 }),
          clear: ["reply", "call_brief"] }),
        item({ item_id: 504, lead_id: 1033, seat: A, tier: "Core under 20L",
          reasons: [R_("keep_missed", "Kept with a deadline, not followed up", "Last follow-up: Spoke: interested")],
          evidence: ev({ last_followup: { at: at("10:26", "2026-10-02"), kind: "call_brief", outcome: "spoke_interested" }, next_step_at: at("15:00", "2026-10-02"), days_without: 2, times_listed: 2 }), times_listed: 2 }),
      ] },
      11: { cycle_id: 11, cut_date: "2026-10-02", cut_at: at("10:30", "2026-10-02"), built_at: at("10:30", "2026-10-02"), approve_due_at: at("12:30", "2026-10-03"), state: "done", items: [
        item({ item_id: 470, lead_id: 1033, seat: A, tier: "Core under 20L", state: "kept", default_action: null, reasons: [R_("no_contact", "No follow-up for 3 days", "Last follow-up: Rang, no answer")],
          decided: { action: "keep", by: "Demo Manager", at: at("11:40", "2026-10-02"), to_seat: null, wave_at: null, until: at("18:00", "2026-10-03"), note: "Customer travelling, visit fixed Saturday" } }),
        item({ item_id: 471, lead_id: 1035, seat: R, tier: "Premium 20-50L", state: "reshuffle", default_action: null, reasons: [R_("next_step_overdue", "Next step date passed and not done", "Last follow-up: Spoke: call back later")],
          decided: { action: "reshuffle", by: "Demo Manager", at: at("11:40", "2026-10-02"), to_seat: K, wave_at: at("11:40", "2026-10-02"), until: null, note: null } }),
      ] },
      10: { cycle_id: 10, cut_date: "2026-09-29", cut_at: at("10:30", "2026-09-29"), built_at: at("10:30", "2026-09-29"), approve_due_at: null, state: "empty", items: [] },
    },
    at_risk: { [K]: [{ item_id: 488, lead_id: 1037, lead_status: "contacted", cut_at: at("10:30", "2026-10-08"),
      reasons: [R_("next_step_overdue", "Next step date passed and not done", "Last follow-up: Spoke: visit or test drive fixed")], clear: ["call_brief"] }] },
    next: { cut_at: at("10:30", "2026-10-08"), heads_up_at: at("10:30", "2026-10-07"), heads_up_sent: false },
    preview: { would_list: 1 },
  };
}

/**
 * The in-memory follow-up list of the demo store. data() gives the time-shifted accountability picture (its "followups"
 * block); rowOf(id) the Inbox row, lead(id) the lead's accountability record, so a move shows on the Inbox at once.
 */
export function createFollowupStore({ role, myName, mySeat, data, rowOf, lead, tierSeats, fire, now, plus, nextId }) {
  const forbid = () => new ApiError(403, "forbidden", "You do not have access to this.");
  const approver = () => role === "owner" || role === "manager";
  const dress = (it) => {
    const r = rowOf(it.lead_id);
    return { ...JSON.parse(JSON.stringify(it)), customer: r?.name || null, car: r?.car || null, last4: null, own_seat: !!mySeat() && it.seat === mySeat() && it.state === "pending" };
  };
  function listOut(c) {
    const counts = { pending: 0, reshuffle: 0, kept: 0, excused: 0, void: 0, expired: 0 };
    const groups = {};
    for (const it of c.items) { counts[it.state] = (counts[it.state] || 0) + 1; (groups[it.seat] ||= []).push(dress(it)); }
    const order = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length || a.localeCompare(b));
    const overdue = c.state === "open" && !!counts.pending && c.approve_due_at && c.approve_due_at < now();
    return { cycle_id: c.cycle_id, cut_date: c.cut_date, cut_at: c.cut_at, built_at: c.built_at, approve_due_at: c.approve_due_at, state: c.state, overdue, counts,
      groups: order.map((s) => ({ seat: s, items: groups[s] })) };
  }
  const rules = (f) => ({ cycle_days: f.cycle_days, run_at: f.run_at, heads_up: f.heads_up, approve_hours: f.approve_hours, warn: f.warn });

  return {
    async get(path, p = {}) {
      const db = await data(), fu = db.followups, f = db.settings.settings.followup || {};
      if (role === "staff") throw forbid();
      if (path === "acc/followups/history") {
        if (!approver()) throw forbid();
        const rows = Object.values(fu.cycles).sort((a, b) => b.cut_date.localeCompare(a.cut_date)).map((c) => {
          const n = (s) => c.items.filter((x) => x.state === s).length;
          return { cycle_id: c.cycle_id, cut_date: c.cut_date, built_at: c.built_at, state: c.state, listed: c.items.length, reshuffle: n("reshuffle"), kept: n("kept"),
            excused: n("excused"), void: n("void"), expired: n("expired"), pending: n("pending"), decided_by: [...new Set(c.items.map((x) => x.decided?.by).filter(Boolean))], last_decided_at: null };
        });
        return { data: rows, page: 1, page_size: 20, total: rows.length };
      }
      if (path !== "acc/followups") return undefined;
      const base = { enabled: f.enabled !== false, now: now(), open: true, my_seat: mySeat() };
      if (!approver()) {
        if (p.cycle_id || p.preview) throw new ApiError(403, "forbidden", "Only the approvers open older lists or the preview.");
        const open = Object.values(fu.cycles).find((c) => c.state === "open");
        return { ...base, can_decide: false, rules: { cycle_days: f.cycle_days, run_at: f.run_at, heads_up: f.heads_up }, next: { cut_at: fu.next.cut_at, heads_up_sent: true },
          at_risk: (fu.at_risk[myName] || []).map(dress), listed: open ? open.items.filter((x) => x.seat === myName).map(dress).map((x) => { if (x.decided) { x.decided.to_seat = null; delete x.decided.note; } return x; }) : [], list: null };
      }
      const c = p.cycle_id ? fu.cycles[+p.cycle_id] : Object.values(fu.cycles).find((x) => x.state === "open") || Object.values(fu.cycles).sort((a, b) => b.cut_date.localeCompare(a.cut_date))[0];
      if (p.cycle_id && !c) throw new ApiError(404, "not_found", "No such follow-up list.");
      return { ...base, can_decide: true, rules: rules(f), next: { ...fu.next }, ...(p.preview ? { preview: { ...fu.preview } } : {}), list: c ? listOut(c) : null };
    },

    async post(path, body = {}) {
      if (path !== "acc/followups/decide") return undefined;
      const db = await data(), fu = db.followups;
      if (!approver()) throw forbid();
      const c = fu.cycles[+body.cycle_id];
      if (!c || c.state !== "open") throw new ApiError(409, "cycle_closed", "This follow-up list is closed.");
      const results = [], moved = {}, given = {};
      const order = (body.decisions || []).slice().sort((a, b) => (a.action === "reshuffle") - (b.action === "reshuffle"));
      for (const d of order) {
        const it = c.items.find((x) => x.item_id === d.item_id);
        if (!it) { results.push({ item_id: d.item_id, ok: false, code: "not_found", message: "Not on this list." }); continue; }
        if (it.state !== "pending") { results.push({ item_id: it.item_id, ok: false, code: "already_decided", message: "Someone already decided this one." }); continue; }
        if (mySeat() && it.seat === mySeat()) { results.push({ item_id: it.item_id, ok: false, code: "own_seat", message: "Another approver decides this one." }); continue; }
        const by = mySeat() || "Demo Manager";
        if (d.action !== "reshuffle" && !(typeof d.reason === "string" && d.reason.trim().length >= 5 && d.reason.trim().length <= 200)) {
          results.push({ item_id: it.item_id, ok: false, code: "validation", message: "Write a reason of 5 to 200 letters.", fields: { reason: "5-200 characters" } }); continue;
        }
        if (d.action === "keep") {
          const u = String(d.until || "");
          if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(u) || `${u}:00` <= plus(59) || `${u}:00` > plus(7 * 1440)) {
            results.push({ item_id: it.item_id, ok: false, code: "validation", message: "Pick a deadline from 1 hour to 7 days ahead.", fields: { until: "1 hour to 7 days ahead" } }); continue;
          }
          Object.assign(it, { state: "kept", default_action: null, decided: { action: "keep", by, at: now(), to_seat: null, wave_at: null, until: `${u}:00`, note: d.reason.trim() } });
          results.push({ item_id: it.item_id, ok: true, state: "kept", until: `${u}:00` }); continue;
        }
        if (d.action === "excuse") {
          Object.assign(it, { state: "excused", default_action: null, decided: { action: "excuse", by, at: now(), to_seat: null, wave_at: null, until: d.until || null, note: d.reason.trim() } });
          results.push({ item_id: it.item_id, ok: true, state: "excused" }); continue;
        }
        // reshuffle: another demo salesman of the band, never the one it came from, spread in turn
        const row = rowOf(it.lead_id), L = lead(it.lead_id);
        if (!row || row.salesman !== it.seat) { it.state = "void"; it.void_reason = "moved"; results.push({ item_id: it.item_id, ok: false, code: "changed", message: "The lead moved or closed meanwhile." }); continue; }
        const away = new Set([it.seat, ...(L.passes || []).filter((x) => x.reason === "followup_cycle").map((x) => x.from)]);
        const pool = (tierSeats[row.tier_key] || []).filter((s) => !away.has(s));
        pool.sort((a, b) => (given[a] || 0) - (given[b] || 0));
        const to = pool[0] || "Partners (demo)";
        given[to] = (given[to] || 0) + 1;
        const wave = now();
        Object.assign(row, { salesman: to, status: "new", stage: "new", mine: role === "salesman" && to === myName, claim: { deadline_at: plus(15), sla_minutes: 15, paused: false, paused_until: null } });
        (L.passes ||= []).push({ ts: wave, from: it.seat, to, reason: "followup_cycle", round: 1, pass_no: 0, by });
        (L.briefs || []).forEach((x) => { if (["pending", "open"].includes(x.state)) x.state = "cancelled"; });
        if (L.proof && L.proof.state === "due") L.proof.state = "cancelled";
        if (L.state) L.state.holder = to;
        (db.claims[to] ||= []).push({ lead_id: it.lead_id, due_at: row.claim.deadline_at });
        if (fuRules(db).warn !== false) db.warnings.unshift({ id: nextId(), ts: wave, seat: it.seat, lead_id: it.lead_id, type: "no_followup", source: "auto", category: null,
          detail: `follow-up list ${c.cut_date}`, status: "active", explanation: null, excused_by: null, excused_at: null, excuse_reason: null, created_by: "system" });
        Object.assign(it, { state: "reshuffle", default_action: null, decided: { action: "reshuffle", by, at: wave, to_seat: to, wave_at: wave, until: null, note: null } });
        moved[it.seat] = (moved[it.seat] || 0) + 1;
        fire({ kind: "lead.changed", lead_id: it.lead_id, why: "pass" });
        results.push({ item_id: it.item_id, ok: true, state: "reshuffle", to_seat: to, wave_at: wave });
      }
      if (!c.items.some((x) => x.state === "pending")) c.state = "done";
      fire({ kind: "acc.changed", why: "followup_done" });
      const n = (s) => results.filter((x) => x.ok && x.state === s).length;
      return { ok: true, results, summary: { reshuffle: n("reshuffle"), kept: n("kept"), excused: n("excused"), failed: results.filter((x) => !x.ok).length } };
    },
  };
}
const fuRules = (db) => db.settings.settings.followup || {};
