// Users and access. A grid of people against capability groups: green means the person can do it, a ring means the owner gave it on
// top of the role, a dashed amber circle means it is held but waiting for two-factor. Money columns are locked unless the viewer
// may give them out. Everything here is also enforced by the API.
import * as api from "../api.js";
import { ApiError, get } from "../api.js";
import { state, can, isSuper } from "../state.js";
import { badge, dateFmt, ago, esc, icon, initials, mount, num, sentence } from "../util.js";
import { bindTabs, confirmDialog, formDrawer, openDrawer, pageHead, save, tabsHtml, toast } from "../ui.js";
import { CAP_OPENS, GROUPS, PERSONAL_DATA, ROLE_PLAIN, capName, capNote, opensGroup } from "../caps.js";
import { card } from "./_shared.js";

const SYSTEM = (u) => /^(demo-)?system$/.test(u.username);

export async function render(ctx) {
  const [users, capsRes] = await Promise.all([get("admin/users"), get("admin/capabilities")]);
  if (!ctx.alive()) return;
  const people = users.data.filter((u) => !SYSTEM(u));
  const roles = Object.fromEntries((capsRes.roles || []).map((r) => [r.key, r]));
  const grantable = new Set(capsRes.you_can_grant || []);
  const catalogue = Object.fromEntries((capsRes.capabilities || []).map((c) => [c.key, c]));
  const narrow = window.matchMedia("(max-width: 1099px)").matches;      // the matrix needs about 1,000 px: below that start on the People list
  const tab = ctx.query.get("tab") || (narrow ? "people" : "matrix");
  const tabs = [...(narrow ? [] : [{ id: "matrix", label: "Who can do what" }]), { id: "people", label: "People" }, { id: "history", label: "Grant history" }];
  const sup = isSuper();
  mount(ctx.root, pageHead({ title: "Users and access", sub: sup ? "You are the super-admin: you hold everything and decide who else gets money, accounts, expenses and the bank file." : "You can manage the operational columns. Money columns change only by the owner, or someone he allowed.",
    actions: can("users.manage") ? `<button class="btn primary" type="button" id="new-user">${icon("plus")}Add a person</button>` : "" })
    + (!sup ? `<div class="callout warn rise">${icon("lock", "")}<div><b>Money columns are locked for you.</b><p>${grantable.has("money.view") ? "You may hand on only the money access you hold yourself." : "You can look but not change them."}</p></div></div><div class="sec-gap"></div>` : "")
    + `<section class="card flush rise">${tabsHtml(tabs, tab, "Access sections")}<div id="pane"></div></section>`);
  const pane = ctx.root.querySelector("#pane");
  const show = async (t) => {
    if (t === "matrix" && !narrow) { pane.innerHTML = matrixHtml(people, roles, grantable, sup); matrixCue(pane); }
    else if (t === "people" || t === "matrix") { pane.innerHTML = peopleHtml(people, roles); }
    else { pane.innerHTML = `<div class="skel card"></div>`; const g = await get("admin/grants"); pane.innerHTML = historyHtml(g.data); }
  };
  bindTabs(ctx.root, (t) => { history.replaceState(null, "", `#/access?tab=${t}`); show(t); });
  await show(tab);
  const byId = (id) => people.find((u) => u.id === id);
  pane.addEventListener("click", (e) => {
    const c = e.target.closest("[data-cell]");
    if (c) { openPerson(byId(+c.dataset.user), roles, grantable, catalogue, c.dataset.cell, ctx); return; }
    const r = e.target.closest("[data-person]"); if (r) openPerson(byId(+r.dataset.person), roles, grantable, catalogue, null, ctx);
  });
  ctx.root.querySelector("#new-user")?.addEventListener("click", () => newUser(roles, ctx));
  const want = ctx.query.get("user"); if (want && byId(+want)) openPerson(byId(+want), roles, grantable, catalogue, null, ctx);
}

// ------------------------------------------------------------------ what a person holds
function holds(u, roles) {
  const tmpl = new Set(u.is_super_admin ? Object.values(catalogueKeys()) : roles[u.role]?.capabilities || []);
  const grants = new Set(u.grants || []);
  return { tmpl, grants, all: new Set([...tmpl, ...grants]) };
}
let _keys = [];
const catalogueKeys = () => _keys;

function matrixHtml(people, roles, grantable, sup) {
  _keys = GROUPS.flatMap((g) => g.caps);
  const head = GROUPS.map((g) => `<th class="tone-${g.tone}" scope="col" title="${esc(g.label + ": " + g.about)}"><span class="gh">${g.tone === "money" ? icon("lock", "") : ""}<span>${esc(g.short || g.label)}</span></span></th>`).join("");
  const rows = people.map((u) => {
    const h = holds(u, roles);
    const cells = GROUPS.map((g) => {
      const have = g.caps.filter((c) => h.all.has(c)).length, total = g.caps.length;
      const viaGrant = g.caps.some((c) => h.grants.has(c) && !h.tmpl.has(c));
      const canChange = !u.is_super_admin && g.caps.some((c) => grantable.has(c));
      const waiting = g.tone === "money" && have > 0 && !u.two_factor;
      const cls = `${have === total ? "full" : have ? "part" : ""}${viaGrant ? " granted" : ""}${waiting ? " heldoff" : ""}${!canChange && g.tone === "money" ? " lockedcell" : ""}`;
      const heldNames = g.caps.filter((c) => h.all.has(c)).map(capName), missing = g.caps.filter((c) => !h.all.has(c)).map(capName);
      const label = `${u.display_name}: ${g.label}. ${have === 0 ? "None of it" : have === total ? "All of it" : `${have} of ${total}`}. ${heldNames.length ? `Can: ${heldNames.join("; ")}.` : ""} ${missing.length ? `Cannot: ${missing.join("; ")}.` : ""}${waiting ? ", waiting for two-factor" : ""}${viaGrant ? ", given by the owner on top of the role" : ""}`;
      return `<td class="tone-${g.tone}"><button class="mcell ${cls.trim()}" type="button" data-cell="${g.id}" data-user="${u.id}" aria-label="${esc(label)}" title="${esc(label)}"><span class="dotm" data-nm="${have}/${total}">${icon("check", "")}</span>${!canChange && g.tone === "money" ? icon("lock", "lk") : ""}</button></td>`;
    }).join("");
    return `<tr${u.active ? "" : ' class="inactive"'}><th scope="row"><div class="person"><span class="avatar sm">${esc(initials(u.display_name))}</span><div><span class="nm">${esc(u.display_name)}</span><div class="meta">${u.is_super_admin ? badge("Super-admin", "red") : badge(roles[u.role]?.label || sentence(u.role))}${u.two_factor ? badge("2FA on", "pos") : ""}${u.active ? "" : badge("Disabled", "neg")}</div></div></div></th>${cells}</tr>`;
  }).join("");
  return `<div class="legend-row"><span><span class="dotm full"></span>Can do it</span><span><span class="dotm part" data-nm="2/3"></span>Some of it (2/3 = two of the three things in that column)</span><span><span class="dotm full ring"></span>Given on top of the role</span><span><span class="dotm held"></span>Held, waiting for two-factor</span><span>${icon("lock", "ico-s")} You cannot change this column</span></div>
    <div class="matrix-shell"><div class="matrix-wrap"><table class="matrix"><thead><tr><th class="who" scope="col">Person</th>${head}</tr></thead><tbody>${rows}</tbody></table></div><div class="matrix-more" hidden aria-hidden="true">${icon("right", "")}<span>More columns</span></div></div>
    <div class="pad-box"><div class="mini-h">What each column means</div><dl class="dl gl">${GROUPS.map((g) => `<div><dt>${esc(g.label)}</dt><dd>${esc(g.about)}</dd></div>`).join("")}</dl></div>`;
}

/** If the matrix is wider than its card, show a fade and an arrow so nobody misses the columns on the right. */
function matrixCue(pane) {
  const wrap = pane.querySelector(".matrix-wrap"), more = pane.querySelector(".matrix-more");
  if (!wrap || !more) return;
  const check = () => { more.hidden = !(wrap.scrollWidth - wrap.clientWidth > 2 && wrap.scrollLeft + wrap.clientWidth < wrap.scrollWidth - 2); };
  wrap.addEventListener("scroll", check, { passive: true }); window.addEventListener("resize", check); check();
}

/** One line for a person's card: what money access they hold, and whether two-factor still gates it. */
function moneyLine(u, roles) {
  if (u.is_super_admin) return "Money: everything";
  const h = holds(u, roles);
  const names = GROUPS.filter((g) => g.tone === "money" && g.caps.some((c) => h.all.has(c))).map((g) => g.label);
  if (!names.length) return "No money access";
  return `Money: ${names.join(", ")}${u.two_factor ? "" : " (waiting for two-factor)"}`;
}

function peopleHtml(people, roles) {
  _keys = GROUPS.flatMap((g) => g.caps);
  const cards = `<ul class="list people-cards only-narrow">${people.map((u) => `<li><button class="pcard" type="button" data-person="${u.id}"><span class="avatar sm">${esc(initials(u.display_name))}</span><span class="grow"><b>${esc(u.display_name)}</b><span class="sub">${u.is_super_admin ? "Super-admin" : esc(roles[u.role]?.label || sentence(u.role))} · ${u.two_factor ? "two-factor on" : "two-factor off"}${u.active ? "" : " · disabled"}</span><span class="sub">${esc(moneyLine(u, roles))}</span></span>${icon("right", "ico-s")}</button></li>`).join("")}</ul>`;
  return `${cards}<div class="scroll-x only-wide"><table class="tbl left"><thead><tr><th>Person</th><th>Role</th><th>Two-factor</th><th>Last sign-in</th><th>Status</th></tr></thead><tbody>${people.map((u) => `<tr class="row-btn" tabindex="0" data-person="${u.id}"><td><div class="person"><span class="avatar sm">${esc(initials(u.display_name))}</span><div><span class="nm">${esc(u.display_name)}</span><span class="sub">${esc(u.username)}</span></div></div></td><td>${u.is_super_admin ? badge("Super-admin", "red") : esc(roles[u.role]?.label || sentence(u.role))}<span class="sub">${esc(u.is_super_admin ? "Holds everything" : ROLE_PLAIN[u.role] || "")}</span></td><td>${u.two_factor ? badge("On", "pos") : badge("Off", u.grants?.length ? "warn" : "")}</td><td>${u.last_login_at ? esc(ago(u.last_login_at)) : "Never"}</td><td>${u.active ? badge("Active", "pos") : badge("Disabled", "neg")}${u.locked_until ? " " + badge("Locked", "warn") : ""}</td></tr>`).join("")}</tbody></table></div>`;
}

const nameOf = (display, username) => (display || username || "").replace(/\s*\(.*\)$/, "");

function historyHtml(list) {
  if (!list.length) return `<div class="empty">${icon("history", "")}<b>Nobody has been given extra access</b><p>When the owner gives or takes away a capability it is recorded here and cannot be edited.</p></div>`;
  return `<ul class="list pad-box hist-list">${list.map((g) => `<li><span class="grow"><div class="t">${esc(capName(g.capability))} <span class="muted">for ${esc(nameOf(g.display_name, g.username))}</span></div><div class="s">Given by ${esc(nameOf(g.granted_by_name, g.granted_by) || "—")} on ${dateFmt(g.granted_at)}${g.note ? ` · “${esc(g.note)}”` : ""}${g.revoked_at ? ` · taken away ${dateFmt(g.revoked_at)} by ${esc(nameOf(g.revoked_by_name, g.revoked_by) || "—")}` : ""}</div></span>${g.revoked_at ? badge("Revoked") : badge("Active", "pos")}</li>`).join("")}</ul>`;
}

// ------------------------------------------------------------------ one person
async function openPerson(u, roles, grantable, catalogue, focusGroup, ctx) {
  if (!u) return;
  const d = openDrawer({ title: u.display_name, sub: "Loading…", body: `<div class="skel card"></div>`, wide: true });
  const load = async () => {
    const a = await get(`admin/users/${u.id}/access`);
    const self = u.id === state.user.id;
    const tmpl = new Set(a.template || []), grants = new Set(a.grants || []), locked = new Set(a.locked_until_two_factor || []);
    d.setTitle(u.display_name);
    d.setSub(`${u.is_super_admin ? "Super-admin" : esc(roles[u.role]?.label || u.role)} · ${u.two_factor ? "two-factor on" : "two-factor not set up"}`);
    const refused = a.refused || {};
    const needs = (cap) => { const r = catalogue[cap]?.requires; return r && !a.holds.includes(r) ? r : null; };
    const why = (cap) => {
      if (u.is_super_admin) return "The super-admin always holds everything.";
      if (self) return "Nobody can change their own access.";
      if (tmpl.has(cap)) return `Comes with the ${roles[u.role]?.label || u.role} role. ${a.can_manage ? "Change the role above to remove it." : "Only someone who can change this role can remove it."}`;
      if (!grantable.has(cap)) return catalogue[cap]?.super_admin_only ? "Only the super-admin can give this." : catalogue[cap]?.guarded ? "Only the super-admin, or someone he allowed, can give money or personal-data access." : "You cannot give this.";
      const r = needs(cap);
      if (r && !grantable.has(r)) return `Needs ${capName(r).toLowerCase()} first, and you cannot give that.`;
      if (refused[cap] && !r) return refused[cap];
      return "";
    };
    const alsoGives = (cap) => { const r = needs(cap); return r && grantable.has(r) && !refused[r] ? `Turning this on also gives: ${capName(r).toLowerCase()}.` : ""; };
    const sections = GROUPS.map((g) => `<section class="sec" id="grp-${g.id}"><div class="sec-h"><h3>${esc(g.label)}</h3><span class="act pill ${g.tone === "money" ? "neg" : g.tone === "sensitive" ? "warn" : ""}">${g.tone === "money" ? "Money" : g.tone === "sensitive" ? "Personal data" : g.tone === "admin" ? "Admin" : "Operations"}</span></div>
      ${g.caps.map((c) => { const on = a.holds.includes(c) || (u.is_super_admin); const lock = why(c); const src = tmpl.has(c) || u.is_super_admin ? "From role" : grants.has(c) ? "Given" : "";
        return `<div class="cap-row"><div class="t">${esc(capName(c))}${src ? `<span class="src">${src}</span>` : ""}${locked.has(c) ? `<span class="pill warn">${icon("lock", "")}Waiting for two-factor</span>` : ""}</div><div class="s">${esc(capNote(c))}${lock ? `${capNote(c) ? " " : ""}<i>${esc(lock)}</i>` : !on && alsoGives(c) ? ` <i>${esc(alsoGives(c))}</i>` : ""}</div><div class="sw"><button class="switch" type="button" role="switch" aria-checked="${on}" aria-label="${esc(capName(c))} for ${esc(u.display_name)}" data-cap="${c}" ${lock && !(grants.has(c) && grantable.has(c) && !self) ? "disabled" : ""}></button></div></div>`; }).join("")}</section>`).join("");
    const hist = (a.history || []).length ? `<section class="sec"><div class="sec-h"><h3>History</h3></div><ul class="hist">${a.history.map((h) => `<li><span class="muted">${dateFmt(h.granted_at, false)}</span><span><b>${esc(capName(h.capability))}</b> given by ${esc(nameOf(h.granted_by_name, h.granted_by))}${h.note ? ` (“${esc(h.note)}”)` : ""}${h.revoked_at ? `, taken away ${dateFmt(h.revoked_at, false)} by ${esc(nameOf(h.revoked_by_name, h.revoked_by))}` : ""}</span></li>`).join("")}</ul></section>` : "";
    const heldSet = new Set(a.holds);
    const seen = GROUPS.filter((g) => u.is_super_admin || opensGroup(g, heldSet)), unseen = GROUPS.filter((g) => !seen.includes(g));
    const waitingOnly = GROUPS.filter((g) => !seen.includes(g) && g.caps.some((c) => heldSet.has(c))).map((g) => g.label);
    const summary = `<div class="now-box"><div><b>Right now can open</b><span>${seen.length ? seen.map((g) => esc(g.label)).join(", ") : "Nothing"}</span></div><div><b>Cannot open</b><span>${unseen.length ? unseen.map((g) => esc(g.label)).join(", ") : "Nothing: holds everything"}</span></div>${waitingOnly.length ? `<div><b>Holds a switch but cannot open the page</b><span>${waitingOnly.map(esc).join(", ")}: needs the view access too</span></div>` : ""}</div>`;
    const roleBox = u.is_super_admin ? "" : roleHtml(u, a, roles);
    d.setBody(`${summary}${roleBox}${u.is_super_admin ? `<div class="callout pos">${icon("shieldcheck", "")}<div><b>Holds every capability, always.</b><p>Nobody else can demote, reset or lock him out.</p></div></div>` : ``}
      ${sections}${hist}`);
    bindRole(d.el, u, a, roles, ctx, load);
    if (focusGroup) d.el.querySelector(`#grp-${focusGroup}`)?.scrollIntoView({ block: "start" });
    focusGroup = null;
    const foot = [];
    if (can("users.manage") && !u.is_super_admin && !self) foot.push(`<button class="btn" type="button" data-m="pw">Reset password</button>`, u.two_factor ? `<button class="btn" type="button" data-m="2fa">Reset two-factor</button>` : "", `<button class="btn ${u.active ? "danger" : ""}" type="button" data-m="active">${u.active ? "Disable account" : "Enable account"}</button>`);
    d.setFoot(foot.join("") || null);
  };
  d.el.addEventListener("click", async (e) => {
    const sw = e.target.closest(".switch");
    if (sw && !sw.disabled) {
      const cap = sw.dataset.cap, on = sw.getAttribute("aria-checked") === "true";
      let note = "", extra = [];
      if (!on && catalogue[cap]?.guarded) {            // money and personal data: say what they will see, and ask first
        const held = new Set(await currentHolds(u));
        const req = catalogue[cap]?.requires;
        extra = req && !held.has(req) ? [req] : [];
        const res = await confirmGrant(u, cap, catalogue[cap], held, extra);
        if (!res) return;
        note = res.note;
      }
      sw.disabled = true;
      try {
        if (on) {
          await api.del(`admin/users/${u.id}/grants/${encodeURIComponent(cap)}`);
          toast(`${capName(cap)}: taken away from ${u.display_name}.`, "ok", { label: "Undo", onClick: async () => { try { await api.post(`admin/users/${u.id}/grants`, { capability: cap }); toast(`${capName(cap)}: given back to ${u.display_name}.`, "ok"); await load(); ctx.refresh(); } catch (ex) { toast(ex.message, "err"); } } });
        }
        else {
          for (const x of extra) await api.post(`admin/users/${u.id}/grants`, { capability: x, ...(note ? { note } : {}) });
          const r = await api.post(`admin/users/${u.id}/grants`, { capability: cap, ...(note ? { note } : {}) });
          toast(r.needs_two_factor_setup ? `${capName(cap)} given. It works after ${u.display_name} sets up two-factor.` : `${capName(cap)}: given to ${u.display_name}.`, "ok");
        }
        await load(); ctx.refresh();
      } catch (ex) { toast(ex.message, "err"); sw.disabled = false; }
      return;
    }
    const m = e.target.closest("[data-m]")?.dataset.m; if (!m) return;
    if (m === "pw") {
      if (!(await confirmDialog({ title: "Reset this password?", text: `${u.display_name} will be signed out everywhere and must choose a new password at the next sign-in.`, confirmLabel: "Reset password" }))) return;
      try { const r = await api.post(`admin/users/${u.id}/reset-password`); tempShown(u.display_name, r.temp_password); } catch (ex) { toast(ex.message, "err"); }
    }
    if (m === "2fa") {
      if (!(await confirmDialog({ title: "Reset two-factor?", text: `Use this when ${u.display_name} has lost their phone. Money pages stay locked for them until they set it up again.`, confirmLabel: "Reset two-factor", danger: true }))) return;
      try { await api.post(`admin/users/${u.id}/reset-totp`); toast("Two-factor reset. They set it up again at the next sign-in.", "ok"); d.close(); ctx.refresh(); } catch (ex) { toast(ex.message, "err"); }
    }
    if (m === "active") {
      const on = u.active;
      if (!(await confirmDialog({ title: on ? "Disable this account?" : "Enable this account?", text: on ? `${u.display_name} is signed out and cannot sign in until you enable it again.` : `${u.display_name} can sign in again.`, confirmLabel: on ? "Disable" : "Enable", danger: on }))) return;
      try { await api.patch(`admin/users/${u.id}`, { active: on ? 0 : 1 }); toast(on ? "Account disabled." : "Account enabled.", "ok"); d.close(); ctx.refresh(); } catch (ex) { toast(ex.message, "err"); }
    }
  });
  try { await load(); } catch (e) { d.setBody(`<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not load this person.</b><span class="muted">${esc(e.message)}</span></div></div>`); }
}

// ------------------------------------------------------------------ role: what a person starts with
const roleSet = (roles, key, grants = []) => new Set([...(roles[key]?.capabilities || []), ...grants]);
/** What a role would open and not open, in the words used everywhere else on this page. */
function roleSummary(roles, key, grants = []) {
  const set = roleSet(roles, key, grants);
  const open = GROUPS.filter((g) => opensGroup(g, set)).map((g) => g.label), closed = GROUPS.filter((g) => !opensGroup(g, set)).map((g) => g.label);
  const personal = PERSONAL_DATA.filter((c) => set.has(c)).map((c) => capName(c).toLowerCase());
  return { open, closed, personal, text: `${ROLE_PLAIN[key] || ""}`.trim() };
}
const roleLines = (s) => `<div class="role-prev"><div><b>Will open</b><span>${s.open.length ? s.open.map(esc).join(", ") : "Nothing"}</span></div><div><b>Will not open</b><span>${s.closed.length ? s.closed.map(esc).join(", ") : "Nothing"}</span></div>${s.personal.length ? `<div class="warn-line">${icon("alert", "")}<span>Carries personal data: ${s.personal.map(esc).join("; ")}.</span></div>` : ""}</div>`;

function roleHtml(u, a, roles) {
  const cur = roles[u.role]?.label || sentence(u.role);
  if (!a.can_manage) return `<section class="sec role-box"><div class="sec-h"><h3>Role</h3></div><p><b>${esc(cur)}</b>. ${esc(ROLE_PLAIN[u.role] || "")}</p><p class="muted">${esc(a.manage_blocked || "You cannot change this role.")}</p></section>`;
  const opts = Object.values(roles).filter((r) => r.assignable !== false || r.key === u.role);
  return `<section class="sec role-box"><div class="sec-h"><h3>Role</h3></div><div class="role-row"><select class="input" id="role-sel" aria-label="Role for ${esc(u.display_name)}">${opts.map((r) => `<option value="${esc(r.key)}"${r.key === u.role ? " selected" : ""}>${esc(r.label)}</option>`).join("")}</select><button class="btn primary" type="button" id="role-save" disabled>Save role</button></div><p class="muted" id="role-hint">${esc(ROLE_PLAIN[u.role] || "")}</p><div id="role-prev"></div></section>`;
}
function bindRole(root, u, a, roles, ctx, reload) {
  const sel = root.querySelector("#role-sel"); if (!sel) return;
  const save_ = root.querySelector("#role-save"), hint = root.querySelector("#role-hint"), prev = root.querySelector("#role-prev");
  const grants = a.grants || [];
  sel.addEventListener("change", () => {
    const changed = sel.value !== u.role;
    save_.disabled = !changed;
    hint.textContent = ROLE_PLAIN[sel.value] || "";
    prev.innerHTML = changed ? roleLines(roleSummary(roles, sel.value, grants)) : "";
  });
  save_.addEventListener("click", async () => {
    const to = sel.value, before = roleSummary(roles, u.role, grants), after = roleSummary(roles, to, grants);
    const lost = before.open.filter((x) => !after.open.includes(x)), gained = after.open.filter((x) => !before.open.includes(x));
    const ok = await confirmDialog({ title: `Change ${u.display_name.replace(/\s*\(.*\)$/, "")} to ${roles[to]?.label || to}?`,
      text: `${gained.length ? `Can then open: ${gained.join(", ")}. ` : ""}${lost.length ? `Can no longer open: ${lost.join(", ")}. ` : ""}${!gained.length && !lost.length ? "The pages stay the same. " : ""}${after.personal.length && !before.personal.length ? `Carries personal data: ${after.personal.join("; ")}. ` : ""}They are signed out and sign in again with the new role. This is logged.`,
      confirmLabel: "Change role" });
    if (!ok) return;
    save_.disabled = true;
    try { await api.patch(`admin/users/${u.id}`, { role: to }); u.role = to; toast(`Role changed to ${roles[to]?.label || to}.`, "ok"); await reload(); ctx.refresh(); }
    catch (ex) { toast(ex.message, "err"); save_.disabled = false; }
  });
}

const currentHolds = async (u) => (await get(`admin/users/${u.id}/access`)).holds || [];

/** "Give a partner access?" as a short plain list: what opens, what stays closed, the two-factor rule, and a note for the record. */
function confirmGrant(u, cap, meta, holds, extra = []) {
  return new Promise((resolve) => {
    const first = u.display_name.replace(/\s*\(.*\)$/, "").split(" ")[0];
    const w = document.createElement("div"); w.className = "modal-wrap";
    const will = [], needTwo = meta.needs_two_factor || extra.length > 0;
    for (const c of [...extra, cap]) { const o = CAP_OPENS[c] || {}; will.push(...(o.opens?.length ? [`open ${o.opens.join(" and ")}`] : []), ...(o.sees?.length ? [`see ${o.sees.join(", ")}`] : []), ...(o.does || [])); }
    const after = new Set([...holds, cap, ...extra]);
    const closed = GROUPS.filter((g) => g.tone === "money" && g.id !== "pass" && !opensGroup(g, after)).map((g) => g.label.toLowerCase());
    w.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="gg-t"><h2 id="gg-t">Give ${esc(first)} this access?</h2>
      <p class="gg-what"><b>${esc(capName(cap))}</b></p>
      <ul class="gg-list"><li>${esc(first)} will be able to ${will.length ? will.map(esc).join("; ") : esc(capName(cap).toLowerCase())}.</li>
      ${extra.length ? `<li>This needs ${extra.map((c) => esc(capName(c).toLowerCase())).join(" and ")} first, so that is given too.</li>` : ""}
      ${closed.length ? `<li>${esc(first)} still cannot see: ${closed.map(esc).join(", ")}.</li>` : ""}
      ${needTwo ? `<li>${esc(first)} must set up two-factor before it works.</li>` : ""}
      <li>This is logged and shows in the grant history.</li></ul>
      <div class="field gg-note"><label for="gg-n">Note for the record (optional)</label><input class="input" id="gg-n" type="text" maxlength="200" placeholder="For example, helping with vendor bills this month"></div>
      <div class="row"><button class="btn" type="button" data-no>Cancel</button><button class="btn primary" type="button" data-yes>Give access</button></div></div>`;
    const done = (v) => { document.removeEventListener("keydown", onKey, true); w.remove(); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); done(null); } };
    document.addEventListener("keydown", onKey, true);
    w.addEventListener("click", (e) => { if (e.target === w) done(null); });
    w.querySelector("[data-no]").addEventListener("click", () => done(null));
    w.querySelector("[data-yes]").addEventListener("click", () => done({ note: w.querySelector("#gg-n").value.trim() }));
    document.getElementById("overlay").appendChild(w);
    w.querySelector("[data-no]").focus();
  });
}

function tempShown(name, pw) {
  const w = document.createElement("div"); w.className = "modal-wrap";
  w.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="tp-t"><h2 id="tp-t">Temporary password</h2><p>Give this to ${esc(name)} in person or on a call. It is shown once. They must choose their own at first sign-in.</p><div class="secret sec" id="tp">${esc(pw)}</div><div class="row"><button class="btn" type="button" id="cp">${icon("copy")}Copy</button><button class="btn primary" type="button" id="ok">Done</button></div></div>`;
  document.getElementById("overlay").appendChild(w);
  w.querySelector("#cp").addEventListener("click", async () => { try { await navigator.clipboard.writeText(pw); toast("Copied.", "ok"); } catch { toast("Select the password and copy it.", "err"); } });
  w.querySelector("#ok").addEventListener("click", () => w.remove());
  w.querySelector("#ok").focus();
}

async function newUser(roles, ctx) {
  const staff = await get("admin/staff").catch(() => ({ data: [] }));
  const assignable = Object.values(roles).filter((r) => r.assignable !== false);
  const d = formDrawer({ title: "Add a person", sub: "They get a one-time password and must change it at first sign-in. Nobody starts with money access.", submit: "Create account", ok: "",
    fields: [
      { name: "display_name", label: "Full name", type: "text", required: true, full: true }, { name: "username", label: "Username", type: "text", required: true, autocomplete: "off" },
      { name: "role", label: "Role", type: "select", required: true, options: assignable.map((r) => [r.key, r.label]), hint: "A role is only a starting point. Pick one to see what it opens." },
      { name: "staff_id", label: "Matches this staff member", type: "select", allowEmpty: true, options: staff.data.filter((s) => s.active).map((s) => [s.id, s.name]), hint: "Required for salesmen, so the lead engine knows whose leads are theirs." }, { name: "access_email", label: "Sign-in email (Cloudflare Access)", type: "email" },
    ],
    after: `<div id="nu-prev" class="sec" aria-live="polite"></div>`,
    onSubmit: async (v) => {
      const b = { ...v }; for (const k of Object.keys(b)) if (b[k] === null) delete b[k]; if (b.staff_id) b.staff_id = +b.staff_id;
      const r = await api.post("admin/users", b); ctx.refresh(); tempShown(b.display_name, r.temp_password);
    } });
  const sel = d.form.querySelector("[name=role]"), prev = d.el.querySelector("#nu-prev");
  const upd = () => { prev.innerHTML = sel.value ? `<p class="muted">${esc(ROLE_PLAIN[sel.value] || "")}</p>${roleLines(roleSummary(roles, sel.value))}` : ""; };
  sel.addEventListener("change", upd); upd();
}
export { num, ApiError };
