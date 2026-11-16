// Sample answers for the Call desk screens (CALLDESK-SPEC.md, the JSON shapes of app/calldesk.py), for the static demo only:
// calls to the showroom number, the phone inquiry form's stock search, number lookup and salesman suggestion, sending, and
// the daily view. Everything is made up and kept in memory; nothing reaches the lead engine. The numbers are one made-up
// series (99999 00101, 00102 ...) and the demo never dials them (main.js stops phone links in the demo).
import { ApiError } from "./api.js";
import { nowMs } from "./util.js";

const CONFIG = {
  script: [
    { key: "intent", ask: "Are you looking to buy a car, or to sell yours?", say: "Classic Auto, namaste! Gaadi leni hai ya bechni hai?", hint: "Tap one. It decides who gets the inquiry." },
    { key: "car", ask: "Which car are you interested in?", say: "Kaunsi gaadi dekh rahe hain?", hint: "Search our stock, or type what they said (model, year)." },
    { key: "budget", ask: "What budget do you have in mind?", say: "Budget kitna socha hai?", hint: "In lakh. Leave it empty if they would not say." },
    { key: "visit", ask: "When can you come to the showroom?", say: "Showroom kab aa sakte hain? Kaunsa din, kitne baje?", hint: "Prabhu Plaza, S.V. Road, Malad West. Open 10 am to 9 pm." },
    { key: "interest", ask: "How interested is the customer?", say: "Gaadi kab tak leni hai?", hint: "Your feel from the call. The salesman sees it on his lead." },
    { key: "name", ask: "May I have your name, please?", say: "Aapka naam?", hint: "" },
    { key: "phone", ask: "Is this the best number to call you back on?", say: "Isi number pe call karein? WhatsApp bhi yahi hai?", hint: "10-digit mobile." },
    { key: "heard_from", ask: "How did you hear about us?", say: "Humare baare mein kahan se pata chala?", hint: "" },
    { key: "notes", ask: "Anything else the salesman should know?", say: "Aur kuch? Hamare salesman aapko thodi der mein call karenge.", hint: "Exchange car, finance, colour, urgency." },
  ],
  sell_script: { car: { ask: "Which car do you want to sell? Model and year?", say: "Kaunsi gaadi bechni hai? Model aur saal?", hint: "Type the model and year, and the km if they say it." },
    interest: { ask: "How interested is the customer?", say: "Gaadi kab tak bechni hai?", hint: "Your feel from the call. The salesman sees it on his lead." } },
  heard_from: [{ key: "instagram", label: "Instagram" }, { key: "whatsapp", label: "WhatsApp" }, { key: "olx", label: "OLX" }, { key: "cartrade", label: "CarTrade" }, { key: "website", label: "Website" }, { key: "other", label: "Other" }],
  close_reasons: [{ key: "wrong_number", label: "Wrong number" }, { key: "spam", label: "Spam or sales call" }, { key: "staff", label: "Staff or a supplier" }, { key: "no_need", label: "No call back needed" }, { key: "other", label: "Other" }],
  callback_outcomes: [{ key: "reached", label: "Reached" }, { key: "no_answer", label: "No answer" }, { key: "wrong_number", label: "Wrong number" }, { key: "call_later", label: "Call later" }],
};
const TIER = { core: "Core under 20L", premium: "Premium 20-50L", luxury: "Luxury 50L+" };
const SEATS = [
  { seat: "kabir", label: "Kabir (demo)", tiers: [TIER.core, TIER.premium] },
  { seat: "aarav", label: "Aarav (demo)", tiers: [TIER.core, TIER.premium] },
  { seat: "rohan", label: "Rohan (demo)", tiers: [TIER.premium, TIER.luxury] },
  { seat: "zoya", label: "Zoya (demo)", tiers: [TIER.luxury] },
];
const SELL_DESK = "rohan";
const LIVE = ["incoming", "refurb", "available", "booked"];
const STOCK_LABEL = { incoming: "Coming in", refurb: "Getting ready", available: "Available", booked: "Booked" };
const INTEREST = { hot: "Hot", warm: "Warm", cold: "Cold" };
const HEARD = Object.fromEntries(CONFIG.heard_from.map((h) => [h.key, h.label]));
const CLOSE = Object.fromEntries(CONFIG.close_reasons.map((r) => [r.key, r.label]));
const OUTCOMES = Object.fromEntries(CONFIG.callback_outcomes.map((r) => [r.key, r.label]));
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const ist = (ms) => new Date(ms + 5.5 * 36e5).toISOString().slice(0, 19).replace("T", " ");
const ago = (min) => ist(nowMs() - min * 60000);
const tsMs = (s) => Date.parse(String(s).replace(" ", "T") + "+05:30");
const last10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
const label = (seat) => SEATS.find((s) => s.seat === seat)?.label || seat || null;
const notFound = () => new ApiError(404, "not_found", "The demo forgets what you add when the page reloads. Go back to the call desk and fill a new one.");
const num = (n) => `+9199999${String(n).padStart(5, "0")}`;
const tierOf = (budget) => (!budget ? null : budget >= 5000000 ? "luxury" : budget >= 2000000 ? "premium" : "core");
const rank = (st) => (st === "available" ? 0 : st === "booked" ? 2 : 1);

function visitLabel(day, at) {
  if (!day && !at) return null;
  const out = [];
  if (day) {
    const today = ist(nowMs()).slice(0, 10), tmr = ist(nowMs() + 864e5).slice(0, 10);
    out.push(day === today ? "Today" : day === tmr ? "Tomorrow" : new Date(Date.parse(day + "T00:00:00Z")).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", ""));
  }
  if (at) out.push(at);
  return out.join(", ");
}
function statusLabel(st, lbl) {
  return { new: `Waiting for ${lbl} to claim it`, claimed: `Claimed by ${lbl}`, contacted: `${lbl} has called the customer`, sold: "Sold", lost: "Closed" }[st] || (lbl ? `Sent to ${lbl}` : "Sent");
}

export function createCalldeskStore({ myName, load }) {
  let calls = null, inqs = null, stock = null, nextInq = 505, nextLead = 1051, turn = 0;
  const me = myName || "Neha (demo)";

  async function cars() {
    if (stock) return stock;
    let r = null;
    try { r = await load("cars", { page_size: 200, scope: "all" }); } catch { r = null; }
    stock = (r?.data || []).filter((c) => LIVE.includes(c.status)).map((c) => ({ car_id: c.id, stock_no: c.stock_no, status: c.status,
      title: [c.mfg_year, c.make, c.model, c.variant].filter(Boolean).join(" "), colour: c.colour || null, fuel: c.fuel || null,
      transmission: c.transmission || null, price: c.asking_price || null }));
    return stock;
  }

  function seed() {
    if (calls) return;
    const I = (o) => ({ client_id: `demo-${o.id}`, created_by_name: me, mine: true, call_sid: null, sent_at: null, name: "", car_id: null, car_title: null,
      stock_no: null, car_text: "", budget: null, visit_day: null, visit_time: null, interest: null, heard_from: null, notes: "", pick_seat: null,
      suggested_seat: null, salesman_seat: null, lead_id: null, state: "sent", error: null, error_code: null, attempts: 1, lead_status: "new", claimed_at: null, ...o });
    const today = ist(nowMs()).slice(0, 10), tmr = ist(nowMs() + 864e5).slice(0, 10);
    inqs = [
      I({ id: 504, call_sid: "demo-call-4", call_at: ago(82), created_at: ago(78), sent_at: ago(78), name: "Demo Caller 04", phone: num(104), intent: "buy",
        car_text: "Honda City 2021 automatic", budget: 1100000, visit_day: tmr, visit_time: "11:00", interest: "hot", heard_from: "instagram", notes: "Wants white or grey. Has a 2015 Swift for exchange.",
        salesman_seat: "kabir", suggested_seat: "kabir", lead_id: 1047, lead_status: "claimed", claimed_at: ago(74) }),
      I({ id: 503, call_sid: "demo-call-5", call_at: ago(128), created_at: ago(124), sent_at: ago(124), name: "Demo Caller 05", phone: num(105), intent: "buy",
        car_text: "Hyundai Creta 2022", budget: 1400000, interest: "warm", heard_from: "website", notes: "Called again about the Creta he saw on Sunday.",
        salesman_seat: "kabir", lead_id: 1037, state: "added", lead_status: "contacted" }),
      I({ id: 502, call_at: ago(170), created_at: ago(166), name: "Demo Caller 06", phone: num(106), intent: "sell", car_text: "Maruti Suzuki Ciaz 2018, 52,000 km",
        interest: "cold", heard_from: "olx", notes: "Wants a price this week.", state: "not_sent", attempts: 2, error: "The lead engine is not answering.", error_code: "bridge_down", lead_status: null }),
      I({ id: 501, call_at: ago(26 * 60), created_at: ago(26 * 60 - 3), sent_at: ago(26 * 60 - 3), name: "Demo Caller 07", phone: num(107), intent: "buy",
        car_text: "Mercedes-Benz GLC", budget: 5500000, visit_day: today, visit_time: "16:00", interest: "hot", heard_from: "whatsapp", salesman_seat: "zoya", suggested_seat: "zoya",
        lead_id: 1043, lead_status: "contacted", claimed_at: ago(26 * 60 - 9) }),
    ];
    const C = (o) => ({ answered_by: null, duration_s: null, needs_callback: false, callback_at: null, callback_by_name: null, closed_reason: null, closed_label: null, inquiry_id: null, known: null, tries: [], ...o });
    const T = (outcome, min, note = null, intent = null) => ({ outcome, label: OUTCOMES[outcome], intent, note, at: ago(min), dialed_at: ago(min + 1), by_name: me });
    calls = [
      C({ call_sid: "demo-call-1", phone: num(101), at: ago(1), state: "live" }),
      C({ call_sid: "demo-call-2", phone: num(102), at: ago(18), state: "missed", needs_callback: true }),
      C({ call_sid: "demo-call-3", phone: num(103), at: ago(44), state: "missed", needs_callback: true, tries: [T("no_answer", 30)], known: { kind: "lead", inquiry_id: null, lead_id: 1044, channel: "instagram",
        channel_label: "Instagram", since: ago(60).slice(0, 10), salesman_label: "Rohan (demo)", status: "new", status_label: "Waiting for Rohan (demo) to claim it", adds_to: 1044 } }),
      C({ call_sid: "demo-call-4", phone: num(104), at: ago(82), state: "answered", answered_by: me, duration_s: 214, inquiry_id: 504 }),
      C({ call_sid: "demo-call-5", phone: num(105), at: ago(128), state: "answered", answered_by: me, duration_s: 151, inquiry_id: 503 }),
      C({ call_sid: "demo-call-8", phone: num(108), at: ago(150), state: "missed", callback_at: ago(141), callback_by_name: me, tries: [T("reached", 141, "Only asked the showroom timings.", "other")] }),
      C({ call_sid: "demo-call-9", phone: num(109), at: ago(205), state: "missed", closed_reason: "spam", closed_label: CLOSE.spam }),
      C({ call_sid: "demo-call-10", phone: num(110), at: ago(240), state: "answered", answered_by: "Demo Manager", duration_s: 48, closed_reason: "staff", closed_label: CLOSE.staff }),
    ];
  }

  /** A sent inquiry is claimed by its salesman about 20 seconds later, so the screen shows the next step by itself. */
  function roll() {
    for (const i of inqs) if (i.state === "sent" && i.lead_status === "new" && i.sent_at && nowMs() - tsMs(i.sent_at) > 20000) { i.lead_status = "claimed"; i.claimed_at = ist(nowMs()); }
  }
  function out(i) {
    const lbl = label(i.salesman_seat);
    const st = i.state === "not_sent" ? (i.error_code && i.error_code !== "bridge_down" ? "Not sent. Press Send again" : "Waiting for the lead engine")
      : i.state === "added" ? `Added to lead #${i.lead_id} · ${statusLabel(i.lead_status, lbl)}` : statusLabel(i.lead_status, lbl);
    return { ...clone(i), visit_label: visitLabel(i.visit_day, i.visit_time), heard_label: HEARD[i.heard_from] || null, interest_label: INTEREST[i.interest] || null, pick_label: label(i.pick_seat), salesman_label: lbl,
      added: i.state === "added", status_label: st };
  }
  function known(phone, except) {
    const p = last10(phone);
    if (p.length !== 10) return null;
    const inq = inqs.slice().reverse().find((i) => last10(i.phone) === p && i.id !== except);
    if (inq) {
      const open = inq.lead_id && !["sold", "lost"].includes(inq.lead_status);
      return { kind: "inquiry", inquiry_id: inq.id, lead_id: inq.lead_id, channel: "desk", channel_label: "Call desk", since: inq.created_at.slice(0, 10), salesman_label: label(inq.salesman_seat),
        status: inq.lead_status, status_label: inq.lead_id ? statusLabel(inq.lead_status, label(inq.salesman_seat)) : "Inquiry not sent yet", adds_to: open ? inq.lead_id : null };
    }
    const c = calls.find((x) => last10(x.phone) === p && x.known);
    return c ? clone(c.known) : null;
  }
  async function suggest(q) {
    const intent = q.intent === "sell" ? "sell" : "buy";
    if (intent === "sell") return { intent, tier: null, banded_by: null, suggested: { seat: SELL_DESK, label: label(SELL_DESK) }, salesmen: clone(SEATS) };
    let budget = +q.budget || null;
    if (!budget && q.car_id) budget = (await cars()).find((c) => c.car_id === +q.car_id)?.price || null;
    const t = tierOf(budget) || "core";
    const seats = SEATS.filter((s) => s.tiers.includes(TIER[t]));
    const pick = seats[turn % seats.length];
    return { intent, tier: TIER[t], banded_by: q.budget ? "budget" : q.car_id ? "car" : null, suggested: { seat: pick.seat, label: pick.label }, salesmen: clone(SEATS) };
  }
  function listCalls() {
    for (const c of calls) if (c.state === "live" && nowMs() - tsMs(c.at) > 6 * 60000) { c.state = "answered"; c.answered_by = me; c.duration_s = 300; }
    const today = ist(nowMs()).slice(0, 10), t = calls.filter((c) => c.at.slice(0, 10) === today);
    const order = (c) => (c.needs_callback ? 0 : c.state === "live" ? 1 : 2);
    const list = calls.slice().sort((a, b) => (a.at < b.at ? 1 : -1)).sort((a, b) => order(a) - order(b));
    return { calls: clone(list), synced_at: ist(nowMs()), counts: { callback: calls.filter((c) => c.needs_callback).length, live: calls.filter((c) => c.state === "live").length,
      today: t.length, answered: t.filter((c) => c.state === "answered").length, missed: t.filter((c) => c.state === "missed").length } };
  }
  const mins = (a, b) => (a && b ? Math.max(0, (tsMs(b) - tsMs(a)) / 60000) : null);
  const stat = (vals) => { const v = vals.filter((x) => x != null).sort((a, b) => a - b); return { n: v.length, median_min: v.length ? v[Math.floor((v.length - 1) / 2)] : null, max_min: v.length ? v[v.length - 1] : null }; };
  function report(day) {
    const today = ist(nowMs()).slice(0, 10);
    if (day !== today) {                                   // an earlier day: a made-up day of about the same size
      const k = (+day.slice(8, 10) % 5) + 9;
      return { day, calls: { received: k + 6, answered: k, missed: 6, called_back: 5, missed_open: 1, live: 0, typed_in: 2 },
        inquiries: { total: k - 1, sent: k - 3, added: 2, not_sent: 0, hot: 3, warm: k - 6, cold: 2 },
        by_desk: [{ user_id: 41, name: me, inquiries: k - 1, sent: k - 3, added: 2, not_sent: 0, median_call_to_sent_min: 4 }],
        by_salesman: SEATS.map((s, n) => ({ seat: s.seat, label: s.label, inquiries: [4, 3, 2, 2][n], claimed: [4, 2, 2, 1][n], open: [0, 1, 0, 1][n], median_sent_to_claim_min: [3, 6, 4, 9][n] })),
        callbacks: { reached: 5, no_answer: 2, wrong_number: 0, call_later: 1 },
        timing: { call_to_sent: { n: k - 1, median_min: 4, max_min: 11 }, sent_to_claim: { n: k - 3, median_min: 5, max_min: 14 }, callback: { n: 5, median_min: 12, max_min: 38 } }, rows: [] };
    }
    const cs = calls.filter((c) => c.at.slice(0, 10) === today), missed = cs.filter((c) => c.state === "missed");
    const done = missed.filter((c) => !c.needs_callback);
    const rs = inqs.filter((i) => i.created_at.slice(0, 10) === today).sort((a, b) => a.id - b.id);
    const bySeat = {};
    const rows = rs.map((i) => {
      const s2c = i.state === "sent" ? mins(i.sent_at, i.claimed_at) : null;
      if (i.state !== "not_sent" && i.salesman_seat) {
        const s = bySeat[i.salesman_seat] || (bySeat[i.salesman_seat] = { seat: i.salesman_seat, label: label(i.salesman_seat), inquiries: 0, claimed: 0, open: 0, s2c: [] });
        s.inquiries++;
        if (i.state === "sent") { if (i.claimed_at) s.claimed++; else s.open++; s.s2c.push(s2c); }
      }
      return { id: i.id, at: i.call_at, desk: i.created_by_name, salesman_label: label(i.salesman_seat), intent: i.intent, interest: i.interest, state: i.state, typed_in: !i.call_sid,
        call_to_sent_min: mins(i.call_at, i.sent_at), sent_to_claim_min: s2c, status_label: out(i).status_label };
    });
    const n = (st) => rs.filter((i) => i.state === st).length;
    const tried = calls.flatMap((c) => c.tries || []).filter((t) => t.at.slice(0, 10) === today);
    return { day, callbacks: Object.fromEntries(Object.keys(OUTCOMES).map((k) => [k, tried.filter((t) => t.outcome === k).length])), calls: { received: cs.length, answered: cs.filter((c) => c.state === "answered").length, missed: missed.length, called_back: done.length,
        missed_open: missed.length - done.length, live: cs.filter((c) => c.state === "live").length, typed_in: rs.filter((i) => !i.call_sid).length },
      inquiries: { total: rs.length, sent: n("sent"), added: n("added"), not_sent: n("not_sent"), ...Object.fromEntries(Object.keys(INTEREST).map((k) => [k, rs.filter((i) => i.interest === k).length])) },
      by_desk: rs.length ? [{ user_id: 41, name: me, inquiries: rs.length, sent: n("sent"), added: n("added"), not_sent: n("not_sent"), median_call_to_sent_min: stat(rows.map((r) => r.call_to_sent_min)).median_min }] : [],
      by_salesman: Object.values(bySeat).map(({ s2c, ...s }) => ({ ...s, median_sent_to_claim_min: stat(s2c).median_min })),
      timing: { call_to_sent: stat(rows.map((r) => r.call_to_sent_min)), sent_to_claim: stat(rows.map((r) => r.sent_to_claim_min)),
        callback: stat(done.filter((c) => c.callback_at).map((c) => mins(c.at, c.callback_at))) },
      rows: rows.reverse() };
  }
  async function deliver(i, pick) {
    const k = known(i.phone, i.id);
    if (k?.adds_to) {
      i.state = "added"; i.lead_id = k.adds_to; i.lead_status = k.status || "claimed";
      i.salesman_seat = SEATS.find((s) => s.label === k.salesman_label)?.seat || "kabir";
    } else {
      const s = await suggest({ intent: i.intent, budget: i.budget, car_id: i.car_id });
      turn++;
      i.suggested_seat = s.suggested.seat;
      i.salesman_seat = pick || s.suggested.seat;
      i.state = "sent"; i.lead_id = nextLead++; i.lead_status = "new";
    }
    i.sent_at = ist(nowMs()); i.attempts++; i.error = null; i.error_code = null;
    const lbl = label(i.salesman_seat);
    return i.state === "added" ? `Added to lead #${i.lead_id} (${lbl}). No second lead was made.` : `Sent to ${lbl}. Lead #${i.lead_id}.`;
  }

  return {
    async get(path, params = {}) {
      seed(); roll();
      if (path === "calldesk/config") return { ...clone(CONFIG), exotel: { live: true, seen: true }, me: { name: me } };
      if (path === "calldesk/calls") return listCalls();
      if (path === "calldesk/inquiries") return { inquiries: inqs.slice().sort((a, b) => b.id - a.id).map(out) };
      const m = path.match(/^calldesk\/inquiries\/(\d+)$/);
      if (m) { const i = inqs.find((x) => x.id === +m[1]); if (!i) throw notFound(); return { inquiry: out(i) }; }
      if (path === "calldesk/stock") {
        const words = String(params.q || "").toLowerCase().split(/\s+/).filter(Boolean);
        const list = (await cars()).filter((c) => words.every((w) => `${c.title} ${c.colour || ""} ${c.stock_no}`.toLowerCase().includes(w)));
        list.sort((a, b) => rank(a.status) - rank(b.status) || a.title.localeCompare(b.title));
        return { cars: list.slice(0, 30).map(({ price, ...c }) => ({ ...c, status_label: STOCK_LABEL[c.status] })) };
      }
      if (path === "calldesk/lookup") { const p = last10(params.phone); return { phone: p.length === 10 ? "+91" + p : null, valid: p.length === 10, known: known(params.phone) }; }
      if (path === "calldesk/suggest") return suggest(params);
      if (path === "calldesk/report") return report(/^\d{4}-\d{2}-\d{2}$/.test(params.day || "") ? params.day : ist(nowMs()).slice(0, 10));
      throw notFound();
    },
    async send(method, path, body = {}) {
      seed();
      let m = path.match(/^calldesk\/calls\/([^/]+)\/(callback|close)$/);
      if (m) {
        const c = calls.find((x) => x.call_sid === decodeURIComponent(m[1])); if (!c) throw notFound();
        if (m[2] === "callback") {                       // how the call-back went (app/calldesk.py callback): only reached and wrong number clear it
          if (!OUTCOMES[body.outcome]) throw new ApiError(400, "bad_request", "Tap how the call went.", { outcome: "one of " + Object.keys(OUTCOMES).join(", ") });
          if (!c.tries.some((t) => t.key === body.client_id)) {
            c.tries.unshift({ key: body.client_id, outcome: body.outcome, label: OUTCOMES[body.outcome], intent: body.outcome === "reached" ? body.intent || null : null,
              note: String(body.note || "").trim().slice(0, 200) || null, at: ist(nowMs()), dialed_at: body.dialed_at || null, by_name: me });
            if (body.outcome === "reached") { c.callback_at = c.callback_at || ist(nowMs()); c.callback_by_name = c.callback_by_name || me; c.needs_callback = false; }
            if (body.outcome === "wrong_number") { c.closed_reason = "wrong_number"; c.closed_label = CLOSE.wrong_number; c.needs_callback = false; }
          }
          return { call: clone(c) };
        }
        if (!CLOSE[body.reason]) throw new ApiError(400, "bad_request", "Pick a reason.", { reason: "one of " + Object.keys(CLOSE).join(", ") });
        c.closed_reason = body.reason; c.closed_label = CLOSE[body.reason];
        c.needs_callback = false;
        return { call: clone(c) };
      }
      if (method === "POST" && path === "calldesk/inquiries") {
        const old = inqs.find((i) => i.client_id === body.client_id);
        if (old) return { inquiry: out(old), message: `Already sent. Lead #${old.lead_id}.` };
        const errs = {};
        if (!["buy", "sell"].includes(body.intent)) errs.intent = "Tap Buying or Selling.";
        if (last10(body.phone).length !== 10) errs.phone = "A 10-digit mobile number.";
        if (!INTEREST[body.interest]) errs.interest = "tap Hot, Warm or Cold";
        if (Object.keys(errs).length) throw new ApiError(400, "bad_request", "Check the marked answers.", errs);
        const car = body.car_id ? (await cars()).find((c) => c.car_id === +body.car_id) : null;
        const i = { id: nextInq++, client_id: body.client_id, created_by_name: me, mine: true, call_sid: body.call_sid || null, call_at: body.call_at || ist(nowMs()), created_at: ist(nowMs()),
          sent_at: null, name: String(body.name || "").trim().slice(0, 60), phone: "+91" + last10(body.phone), intent: body.intent, car_id: car ? car.car_id : null,
          car_title: car ? car.title : null, stock_no: car ? car.stock_no : null, car_text: car ? null : String(body.car_text || "").trim(), budget: body.intent === "buy" ? body.budget || null : null,
          visit_day: body.visit_day || null, visit_time: body.visit_time || null, interest: body.interest, heard_from: body.heard_from || null, notes: String(body.notes || "").trim(),
          pick_seat: body.salesman || null, suggested_seat: null, salesman_seat: null, lead_id: null, state: "not_sent", error: null, error_code: null, attempts: 0, lead_status: null, claimed_at: null };
        if (i.call_sid) { const c = calls.find((x) => x.call_sid === i.call_sid); if (c) { c.inquiry_id = i.id; c.needs_callback = false; } }
        for (const c of calls) if (c.needs_callback && last10(c.phone) === last10(i.phone)) c.needs_callback = false;
        const message = await deliver(i, i.pick_seat);
        inqs.push(i);
        return { inquiry: out(i), message };
      }
      m = path.match(/^calldesk\/inquiries\/(\d+)\/send$/);
      if (m) {
        const i = inqs.find((x) => x.id === +m[1]); if (!i) throw notFound();
        if (i.state !== "not_sent") return { inquiry: out(i), message: i.state === "added" ? `Already added to lead #${i.lead_id}.` : `Already sent. Lead #${i.lead_id}.` };
        if ("salesman" in body) i.pick_seat = body.salesman || null;
        const message = await deliver(i, i.pick_seat);
        return { inquiry: out(i), message };
      }
      throw notFound();
    },
  };
}
