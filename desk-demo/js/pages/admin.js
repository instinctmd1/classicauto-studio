// Settings: staff, rules and rates, the lead engine link, and live sessions. Users and access live on their own page.
import * as api from "../api.js";
import { get } from "../api.js";
import { state, can, isSuper } from "../state.js";
import { ago, badge, dateFmt, esc, icon, mount, num, sentence } from "../util.js";
import { bindTabs, confirmDialog, formDrawer, pageHead, save, tabsHtml, toast } from "../ui.js";
import { card } from "./_shared.js";

const ROLES = [["salesman", "Salesman"], ["manager", "Manager"], ["owner", "Owner"], ["rto_agent", "RTO agent"], ["driver", "Driver"], ["office", "Office"]];

// [key, label, kind, hint] kind: int | pct | money | bool
const RULES = [
  ["Leads and stock", [
    ["lead_sla_minutes", "Claim a lead within (minutes)", "int", "Leads unclaimed for longer count as missed."], ["cold_lead_days", "A lead goes cold after (days)", "int"],
    ["aged_threshold_days", "Stock is aged after (days)", "int"], ["rto_sla_days", "RTO transfer should finish within (days)", "int"], ["upgrade_cycle_years", "Upgrade offer after (years)", "int"], ["ig_follower_goal", "Instagram follower goal", "int"],
  ]],
  ["Alerts", [["alert_insurance_days", "Insurance expiry warning (days)", "int"], ["alert_puc_days", "PUC expiry warning (days)", "int"], ["alert_consignment_days", "Park-N-Sell agreement warning (days)", "int"], ["alert_dealer_auth_days", "Dealer papers warning (days)", "int"]]],
  ["Tax and money", [
    ["gst_margin_rate", "GST on margin (%)", "pct", "Confirm with your CA."], ["gst_service_rate", "GST on commission (%)", "pct"], ["tcs_rate", "TCS rate (%)", "pct"], ["tcs_rate_no_pan", "TCS rate without PAN (%)", "pct"],
    ["tcs_threshold", "TCS applies above (₹)", "money"], ["cash_receipt_limit", "Flag cash receipts from (₹)", "money"], ["cost_of_capital_annual", "Cost of capital (% a year)", "pct"],
    ["gst_margin_price_inclusive", "Sale price already includes GST on margin", "bool"], ["tcs_on_pns", "Charge TCS on Park-N-Sell sales", "bool"],
  ]],
];

export async function render(ctx) {
  const tab = ctx.query.get("tab") || "staff";
  const tabs = [{ id: "staff", label: "Staff" }, { id: "rules", label: "Rules and rates" }, { id: "engine", label: "Lead engine" }, { id: "sessions", label: "Signed-in now" }];
  if (isSuper()) tabs.push({ id: "ask", label: "Ask Claude answers" });          // SPEC-ASK-CLAUDE-CHAT 5.3: the super-admin only
  mount(ctx.root, pageHead({ title: "Settings", sub: "Staff, the rules the dashboard uses, and the link to the lead engine." }) + `<section class="card flush rise">${tabsHtml(tabs, tab, "Settings sections")}<div id="pane"></div></section>`);
  const pane = ctx.root.querySelector("#pane");
  const show = async (t) => {
    pane.innerHTML = `<div class="skel card"></div>`;
    try {
      if (t === "staff") await staffPane(pane, ctx);
      else if (t === "rules") await rulesPane(pane, ctx);
      else if (t === "engine") await enginePane(pane, ctx);
      else if (t === "ask") await askPane(pane, ctx);
      else await sessionsPane(pane, ctx);
    } catch (e) { pane.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not load this section.</b><span class="muted">${esc(e.message)}</span></div></div>`; }
  };
  bindTabs(ctx.root, (t) => { history.replaceState(null, "", `#/admin?tab=${t}`); show(t); });
  await show(tab);
}

async function staffPane(pane, ctx) {
  const s = await get("admin/staff");
  const manage = can("users.manage");
  pane.innerHTML = `<div class="pad-box pill-row">${manage ? `<button class="btn" type="button" id="add-s">${icon("plus")}Add staff</button>` : ""}<span class="muted">The engine name must match the name the lead engine uses, letter for letter.</span></div>
    <div class="scroll-x"><table class="tbl left"><thead><tr><th>Name</th><th>Role</th><th>Engine name</th><th>Rotation</th><th>Status</th></tr></thead><tbody>${s.data.map((x) => `<tr class="row-btn" tabindex="0" data-s="${x.id}"><td>${esc(x.name)}</td><td>${esc((ROLES.find((r) => r[0] === x.role) || [0, sentence(x.role)])[1])}</td><td class="mono">${esc(x.engine_name || "—")}</td><td>${x.in_rotation ? badge("In rotation", "pos") : badge("Not in rotation", "warn")}</td><td>${x.active ? badge("Active", "pos") : badge("Left")}</td></tr>`).join("")}</tbody></table></div>`;
  const form = (x) => formDrawer({ title: x ? "Edit staff" : "Add staff", submit: x ? "Save changes" : "Add", ok: "Saved",
    fields: [{ name: "name", label: "Name", type: "text", required: true, value: x?.name }, { name: "role", label: "Role", type: "select", required: true, value: x?.role || "salesman", options: ROLES }, { name: "engine_name", label: "Engine name", type: "text", value: x?.engine_name || "", hint: "Exactly as the lead engine spells it." },
      { name: "engine_person", label: "Engine person (shared seat only)", type: "text", value: x?.engine_person || "", hint: "Only when two people share one engine seat (the partners): this person's own name in the engine's staff list. The Desk app acts as this name. Leave empty otherwise." },
      { name: "rotation_weight", label: "Rotation weight", type: "number", step: 1, min: 0, value: x?.rotation_weight ?? 1 }, { name: "in_rotation", label: "Receives routed leads", type: "checkbox", value: x ? x.in_rotation : 1 }, { name: "active", label: "Still works here", type: "checkbox", value: x ? x.active : 1 }],
    onSubmit: async (v) => { const b = { ...v }; if (!b.engine_name) delete b.engine_name; if (!b.engine_person) { if (x?.engine_person) b.engine_person = null; else delete b.engine_person; } if (x) await api.patch(`admin/staff/${x.id}`, b); else await api.post("admin/staff", b); ctx.refresh(); } });
  pane.querySelector("#add-s")?.addEventListener("click", () => form(null));
  if (manage) pane.addEventListener("click", (e) => { const r = e.target.closest("[data-s]"); if (r) form(s.data.find((x) => x.id === +r.dataset.s)); });
}

async function rulesPane(pane, ctx) {
  const r = await get("admin/settings");
  const S = r.settings;
  const bands = S.segment_bands || {};
  const field = ([k, label, kind, hint]) => {
    const v = S[k];
    if (kind === "bool") return `<label class="check full"><input type="checkbox" name="${k}"${v ? " checked" : ""}> <span>${esc(label)}</span></label>`;
    const shown = kind === "pct" ? +(v * 100).toFixed(2) : v;
    return `<div class="field"><label for="s_${k}">${esc(label)}</label><input class="input" id="s_${k}" name="${k}" type="number" step="${kind === "pct" ? "0.01" : "1"}" min="0" value="${esc(shown)}" inputmode="decimal">${hint ? `<div class="hint">${esc(hint)}</div>` : ""}</div>`;
  };
  pane.innerHTML = `<form id="rf" class="pad-box stack-form" novalidate>${RULES.map(([h, fs]) => `<section><div class="mini-h">${esc(h)}</div><div class="form-grid">${fs.map(field).join("")}</div></section>`).join("")}
    <section><div class="mini-h">Price bands for luxury, mid and budget</div><div class="form-grid"><div class="field"><label for="b1">Budget up to (₹)</label><input class="input" id="b1" name="low_max" type="number" min="0" step="1" value="${bands.low_max}"></div><div class="field"><label for="b2">Mid up to (₹)</label><input class="input" id="b2" name="middle_max" type="number" min="0" step="1" value="${bands.middle_max}"><div class="hint">Above this is Luxury.</div></div></div></section>
    <div class="err" id="rf-e" role="alert" hidden></div><div><button class="btn primary" type="submit">Save settings</button></div></form>`;
  const f = pane.querySelector("#rf");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {};
    for (const [, fs] of RULES) for (const [k, , kind] of fs) { const el = f.elements[k]; if (!el) continue; body[k] = kind === "bool" ? el.checked : kind === "pct" ? +(+el.value / 100).toFixed(4) : Math.round(+el.value); }
    body.segment_bands = { low_max: Math.round(+f.low_max.value), middle_max: Math.round(+f.middle_max.value) };
    for (const k of Object.keys(body)) if (JSON.stringify(body[k]) === JSON.stringify(S[k])) delete body[k];   // tax and cash-limit rules are owner-only: send only what changed
    if (!Object.keys(body).length) { toast("Nothing changed.", "ok"); return; }
    const ok = await save(f.querySelector("button"), () => api.put("admin/settings", body), { ok: "Settings saved" });
    if (ok) ctx.refresh();
  });
}

async function enginePane(pane, ctx) {
  const s = await get("admin/sync-status");
  const stale = s.last_error || !s.last_ok_at;
  pane.innerHTML = `<div class="pad-box"><div class="callout ${stale ? "warn" : "pos"}">${icon(stale ? "alert" : "check", "")}<div><b>${stale ? "The last sync had a problem." : "Leads are in sync."}</b><p>Last run ${esc(ago(s.last_run_at))}${s.last_ok_at ? `, last success ${esc(ago(s.last_ok_at))}` : ""}. ${s.last_error ? "Error: " + esc(s.last_error) : ""}</p></div></div>
    <div class="bal-strip sec"><div class="bal-tile"><div class="l">Leads copied</div><div class="v">${num(s.leads_in_mirror)}</div></div><div class="bal-tile"><div class="l">Events copied</div><div class="v">${num(s.events_in_mirror)}</div></div><div class="bal-tile"><div class="l">Engine database</div><div class="v">${s.engine_db_present ? "Found" : "Missing"}</div><div class="s">Opened read-only</div></div></div>
    <p class="note sec">${icon("info", "")}<span>The dashboard only reads the lead engine's database. It never writes to it, and nothing leaves this server.</span></p>
    <div class="sec"><button class="btn" type="button" id="sync">${icon("refresh")}Sync now</button></div></div>`;
  pane.querySelector("#sync").addEventListener("click", async (e) => { const r = await save(e.currentTarget, () => api.post("admin/sync-now"), { ok: "Synced" }); if (r) ctx.refresh(); });
}

async function sessionsPane(pane, ctx) {
  const s = await get("admin/sessions");
  pane.innerHTML = s.data.length ? `<div class="scroll-x"><table class="tbl left"><thead><tr><th>Person</th><th>Last active</th><th>Two-factor</th><th>From</th><th></th></tr></thead><tbody>${s.data.map((x) => `<tr><td>${esc(x.username)}</td><td>${esc(ago(x.last_seen_at))}</td><td>${x.two_factor ? badge("Yes", "pos") : badge("No")}</td><td class="mono">${esc(x.ip || "—")}<span class="sub">${esc((x.user_agent || "").slice(0, 60))}</span></td><td class="r"><button class="btn sm danger" type="button" data-end="${esc(x.id_hash)}">End session</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${icon("users", "")}<b>Nobody is signed in</b></div>`;
  pane.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-end]"); if (!b) return;
    if (!(await confirmDialog({ title: "End this session?", text: "They are signed out on their next click.", confirmLabel: "End session", danger: true }))) return;
    await save(b, () => api.del(`admin/sessions/${b.dataset.end}`), { ok: "Session ended" }) && ctx.refresh();
  });
}


// ------------------------------------------------------------------ Ask Claude answers (SPEC-ASK-CLAUDE-CHAT 5.3, 3.6)
async function askPane(pane, ctx) {
  const r = await get("ask/settings");
  if (!ctx.alive()) return;
  const c = r.caps || {};
  pane.innerHTML = `<form id="askf" class="pad-box stack-form ask-set" novalidate>
    <section><div class="mini-h">The switch</div>
      <label class="radio"><input type="checkbox" name="ask_ai_chat"${r.ask_ai_chat ? " checked" : ""}> Ask Claude answers free questions and free car messages</label>
      <p class="hint">Off: the three formats, the cards, Yes, approvals and the website jobs still work. Today: ${num(r.today?.turns || 0)} answers, US$${Number(r.today?.cost_usd || 0).toFixed(2)}.</p></section>
    <section><div class="mini-h">Daily caps</div><div class="form-grid">
      <div class="field"><label for="ac1">Questions a person a day</label><input class="input" id="ac1" name="ask_ai_turns_per_user_day" type="number" min="0" max="5000" step="1" value="${+c.ask_ai_turns_per_user_day || 0}"></div>
      <div class="field"><label for="ac2">Questions in all a day</label><input class="input" id="ac2" name="ask_ai_turns_day" type="number" min="0" max="5000" step="1" value="${+c.ask_ai_turns_day || 0}"></div>
      <div class="field"><label for="ac3">Spend a day (US$)</label><input class="input" id="ac3" name="ask_ai_usd_day" type="number" min="0" max="100" step="0.5" value="${Number(c.ask_ai_usd_day || 0)}"></div></div></section>
    <section><div class="mini-h">What is sent to Anthropic, and only while the switch is on</div><ul class="plain-list">${(r.sent || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>
    <div class="form-actions"><button class="btn primary" type="submit">Save</button></div></form>`;
  pane.querySelector("#askf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const body = { ask_ai_chat: f.ask_ai_chat.checked, ask_ai_turns_per_user_day: Math.round(+f.ask_ai_turns_per_user_day.value),
      ask_ai_turns_day: Math.round(+f.ask_ai_turns_day.value), ask_ai_usd_day: +f.ask_ai_usd_day.value };
    const ok = await save(f.querySelector("[type=submit]"), () => api.post("ask/settings", body));
    if (ok) askPane(pane, ctx);
  });
}
