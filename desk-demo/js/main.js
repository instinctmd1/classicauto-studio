// Shell, router and boot for the Classic Auto owner dashboard.
// Everything the person sees is decided by /api/me capabilities: a page the API would refuse is never shown.
import * as api from "./api.js";
import { ApiError, DEMO } from "./api.js";
import { state, can, isLocked, isSuper, homeKind, initPeriod, setPeriod, periodLabel, periodMonthList, stepPeriod } from "./state.js";
import { $, $$, esc, icon, monthLabel, initials, safeStore, setClockShift } from "./util.js";
import { closeDrawer, closeMenu, confirmDialog, formHtml, openDrawer, openMenu, readForm, save, showErrors, toast } from "./ui.js";
import { disposeCharts } from "./charts.js";
import { disposeGrids } from "./grid.js";
import { forgetThisDevice, isStandalone, registerServiceWorker, resetPageScope, sendTestNotification, startBadges, startFeed, stopFeed } from "./desk.js";
import { resetDeskStore } from "./desk-api.js";

const FIN = ["money.view", "deals.profit.view", "accounts.view", "expenses.view", "bank.view"];

/** any: the capabilities that open the page (one is enough). period: show the month picker. */
const NAV = [
  { group: "Desk", items: [
    { id: "inbox", label: "Inbox", icon: "inbox", any: ["desk.inbox"], badge: "inbox" },
    { id: "chat", label: "Team chat", icon: "chat", any: ["chat.use"], badge: "chat" },
    { id: "ask", label: "Ask Claude", icon: "spark", any: ["desk.ask"], badge: "ask" },
    { id: "install", label: "Install the app", icon: "download", any: [], onlyIf: () => !isStandalone() } ] },
  { group: null, items: [
    { id: "home", label: "Home", icon: "overview", any: [], period: true },
    { id: "today", label: "Today", icon: "today", any: ["today.view"] } ] },
  { group: "Money", restricted: true, items: [
    { id: "overview", label: "Profit overview", icon: "trend", any: ["money.view"], all: ["records.all"], period: true, onlyIf: () => homeKind() !== "owner" },
    { id: "money", label: "Profit and loss", icon: "sales", any: ["money.view"], period: true },
    { id: "accounts", label: "Accounts", icon: "book", any: ["accounts.view"], period: true },
    { id: "expenses", label: "Expenses", icon: "wallet", any: ["expenses.view"], period: true },
    { id: "bank", label: "Bank and finance", icon: "bank", any: ["bank.view"] } ] },
  { group: "The lot", items: [
    { id: "inventory", label: "Stock", icon: "car", any: ["stock.view"] },
    { id: "pns", label: "Park-N-Sell", icon: "repeat", any: ["stock.manage"] },
    { id: "deals", label: "Deals", icon: "tag", any: ["deals.view"] },
    { id: "approvals", label: "Approvals", icon: "flag", any: ["approvals.manage", "approvals.request"] },
    { id: "rto", label: "RTO and papers", icon: "docs", any: ["rto.view", "documents.view"] },
    { id: "fi", label: "Finance and insurance", icon: "shield", any: ["deals.manage"] } ] },
  { group: "People", items: [
    { id: "leads", label: "Inquiries", icon: "leads", any: ["leads.view"], period: true },
    { id: "team", label: "Salesmen", icon: "team", any: ["team.view"], period: true },
    { id: "customers", label: "Customers", icon: "users", any: ["customers.view"], period: true },
    { id: "feedback", label: "Feedback", icon: "up", any: ["activity.use"] } ] },
  { group: "Grow", items: [
    { id: "marketing", label: "Marketing", icon: "megaphone", any: ["marketing.view"], period: true } ] },
  { group: "Workspace", items: [
    { id: "sheets", label: "Sheets", icon: "sheets", any: ["sheets.view"] },
    { id: "access", label: "Users and access", icon: "key", any: ["users.manage", "grants.financial"] },
    { id: "admin", label: "Settings", icon: "settings", any: ["settings.manage"] },
    { id: "audit", label: "Audit log", icon: "history", any: ["audit.view"] } ] },
];
const EXTRA = { lead: { label: "Lead", any: ["desk.inbox"] }, overview: { label: "Profit overview", any: ["money.view"], all: ["records.all"], period: true }, security: { label: "Security", any: [] }, mine: { label: "Home", any: [] }, manager: { label: "Home", any: [] } };
const ALL = Object.fromEntries([...NAV.flatMap((g) => g.items).map((p) => [p.id, p]), ...Object.entries(EXTRA).map(([k, v]) => [k, { id: k, ...v }])]);
const app = document.getElementById("app");

let renderToken = 0;
let route = { page: "home", query: new URLSearchParams() };

// ------------------------------------------------------------------ theme
function applyTheme(t) { document.documentElement.setAttribute("data-theme", t); safeStore("ca.theme", t); const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === "light" ? "#F3F0E9" : "#0A1633"; }
const theme = () => document.documentElement.getAttribute("data-theme") || "dark";

// ------------------------------------------------------------------ sign-in (password, then the 6-digit code)
function loginView(message = "") {
  closeDrawer(); closeMenu(); disposeCharts(); disposeGrids(); stopIdle();
  app.innerHTML = `<div class="login">
    <section class="login-art" aria-hidden="true"><div class="checker"></div><div class="big">Classic<span>Auto</span></div><p>Stock, deals, papers, accounts and the bank file in one private place. Built for the partners.</p><div class="est">Malad West since 1974</div></section>
    <main class="login-main"><div class="login-card">
      <span class="plate"><img src="img/logo.svg" alt="Classic Auto, since 1974" width="840" height="496"></span>
      <h1 id="lg-h">Sign in</h1><p class="lede" id="lg-lede">Back office. Only people the owner has given access to can open this.</p>
      <form id="login-form" novalidate>
        ${message ? `<div class="form-err" role="alert">${esc(message)}</div>` : ""}
        <div class="field"><label for="u">Username</label><input class="input" id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
        <div class="field"><label for="p">Password</label><div class="pw"><input class="input" id="p" name="password" type="password" autocomplete="current-password" required><button type="button" id="pw-show" aria-pressed="false">Show</button></div></div>
        <div class="field"><label for="t">Two-factor code <span class="faint">(if you have set it up)</span></label><input class="input code-input" id="t" name="totp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="123456"><div class="hint">The 6 digits from your authenticator app. Each code works once. Leave empty if you have not set it up yet.</div></div>
        <div class="err" id="login-err" role="alert" hidden></div>
        <button class="btn primary" type="submit" id="go">Sign in</button>
      </form>
      <p class="fine">${icon("lock", "")}<span>Private server: nothing on this page is loaded from the internet. Money pages time out after 30 idle minutes. Every sign-in, export and reveal is logged.</span></p>
    </div></main></div>`;
  const form = $("#login-form"), err = $("#login-err"), go = $("#go");
  $("#pw-show").addEventListener("click", (e) => { const i = $("#p"); const show = i.type === "password"; i.type = show ? "text" : "password"; e.currentTarget.textContent = show ? "Hide" : "Show"; e.currentTarget.setAttribute("aria-pressed", String(show)); });
  $("#u").focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = form.username.value.trim(), password = form.password.value, totp = form.totp.value.trim();
    err.hidden = true;
    if (!username || !password) { err.textContent = "Enter your username and password."; err.hidden = false; return; }
    if (totp && !/^\d{6}$/.test(totp)) { err.textContent = "The code is 6 digits."; err.hidden = false; return; }
    go.disabled = true; go.innerHTML = '<span class="spin"></span> Signing in';
    try {
      const r = await api.post("auth/login", { username, password, ...(totp ? { totp } : {}) });
      api.setCsrf(r.csrf);
      await boot();
    } catch (ex) {
      go.disabled = false; go.textContent = "Sign in";
      err.textContent = ex.status === 429 ? "Too many attempts. Wait a few minutes and try again."
        : ex.status === 401 ? "Those details do not match. Check the username, password and the current two-factor code." : (ex.message || "Could not sign in.");
      err.hidden = false;
      form.totp.value = ""; form.password.value = ""; form.password.focus();
    }
  });
}

function passwordView(user) {
  app.innerHTML = `<div class="login"><main class="login-main"><div class="login-card">
    <span class="plate"><img src="img/logo.svg" alt="Classic Auto" width="840" height="496"></span>
    <h1>Set a new password</h1><p class="lede">${esc(user.display_name)}, your account needs a password only you know. Use at least 12 characters.</p>
    <form id="pw-form" novalidate>
      <div class="field"><label for="cur">Current password</label><input class="input" id="cur" name="current" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="new">New password</label><input class="input" id="new" name="new" type="password" autocomplete="new-password" minlength="12" required><div class="hint">12 or more characters, not your username.</div></div>
      <div class="err" id="pw-err" role="alert" hidden></div>
      <button class="btn primary" type="submit">Save password</button>
    </form></div></main></div>`;
  $("#cur").focus();
  $("#pw-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget, err = $("#pw-err"); err.hidden = true;
    try { await api.post("me/password", { current: f.current.value, new: f.new.value }); await boot(); }
    catch (ex) { err.textContent = ex.fields?.new ? "New password: " + [].concat(ex.fields.new).join(", ") : ex.message; err.hidden = false; }
  });
}

// ------------------------------------------------------------------ navigation model
// any: one of these opens the page; all (optional): every one of these is also needed, because the page reads data behind them.
const opens = (p) => (p.any.length === 0 || can(...p.any)) && (!p.all || p.all.every((c) => can(c)));
const heldOff = (p) => p.any.length > 0 && !can(...p.any) && isLocked(...p.any) && (!p.all || p.all.every((c) => can(c) || isLocked(c)));

function navModel() {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.onlyIf || i.onlyIf()) && (opens(i) || heldOff(i))).map((i) => ({ ...i, locked: heldOff(i) })),
  })).filter((g) => g.items.length);
}

function navHtml(groups) {
  return groups.map((g) => `${g.group ? `<div class="nav-group${g.restricted ? " restricted" : ""}">${esc(g.group)}${g.restricted ? `<span class="tag">${icon("lock", "")}Restricted</span>` : ""}</div>` : ""}${g.items.map((i) =>
    `<a href="#/${i.id}" data-page="${i.id}"${i.locked ? ' class="is-locked"' : ""}>${icon(i.icon)}<span>${esc(i.label)}</span>${i.badge ? `<span class="count" data-badge="${i.badge}" hidden></span>` : ""}${i.locked ? `<span class="lockmark" title="Locked until you sign in with your two-factor code">${icon("lock", "")}<span class="sr">Locked</span></span>` : ""}</a>`).join("")}`).join("");
}

let escMenu = () => {};
function buildShell() {
  const groups = navModel();
  // Phone tabs (APP-SPEC section 2): a fixed set, each shown only when the capability is held. More opens the full menu.
  const tabs = [
    can("desk.inbox") && { id: "inbox", label: "Inbox", icon: "inbox", badge: "inbox" },
    can("chat.use") && { id: "chat", label: "Chat", icon: "chat", badge: "chat" },
    { id: "home", label: "Dashboard", icon: "overview" },
    can("desk.ask") && { id: "ask", label: "Ask Claude", icon: "spark", badge: "ask" },
  ].filter(Boolean);
  const roleLabel = state.user.is_super_admin ? "Owner, full access" : (state.user.role_label || state.user.role);
  app.innerHTML = `${DEMO ? demoBannerHtml() : ""}<div class="shell">
    <aside class="side" id="side" aria-label="Main">
      <a class="plate" href="#/home" aria-label="Classic Auto home"><img src="img/logo.svg" alt="Classic Auto, since 1974" width="840" height="496"></a>
      <div class="side-tag">Back office</div>
      <nav class="nav" aria-label="Pages">${navHtml(groups.filter((g) => g.group !== "Workspace"))}</nav>
      <nav class="nav nav-pin" aria-label="Workspace and admin">${navHtml(groups.filter((g) => g.group === "Workspace"))}</nav>
      <div class="side-foot"><div class="lock">${icon("shieldcheck", "")}<span>Private server. Nothing leaves it. Activity is logged.</span></div><div>Prabhu Plaza, S.V. Road, Malad West</div></div>
    </aside>
    <div class="main-col">
      <header class="top">
        <button class="icon-btn burger" id="burger" type="button" aria-label="Open menu" aria-controls="side" aria-expanded="false">${icon("menu")}</button>
        <div class="crumb" id="crumb"></div>
        <div class="grow"></div>
        <div class="sync" id="sync" hidden></div>
        <div class="session-chip" id="session-chip" hidden></div>
        <div class="period" id="period" role="group" aria-label="Reporting period">
          <button class="step" id="p-prev" type="button" aria-label="Previous month">${icon("left")}</button>
          <button class="label" id="p-label" type="button" aria-haspopup="menu"></button>
          <button class="step" id="p-next" type="button" aria-label="Next month">${icon("right")}</button>
        </div>
        <button class="icon-btn" id="theme" type="button" aria-label="Switch theme"></button>
        <button class="user-btn" id="user" type="button" aria-haspopup="menu" aria-label="Account menu"><span class="avatar">${esc(initials(state.user.display_name))}</span><span class="who"><b>${esc(state.user.display_name.replace(/\s*\(.*\)$/, ""))}</b><span>${esc(roleLabel)}</span></span></button>
      </header>
      <div id="notice"></div>
      <main id="main" class="page" tabindex="-1" aria-live="polite"></main>
    </div>
    <nav class="bottom n${tabs.length + 1}" aria-label="Main tabs">${tabs.map((t) => `<a href="#/${t.id}" data-page="${t.id}"><span class="tab-ic">${icon(t.icon)}${t.badge ? `<span class="tab-badge" data-badge="${t.badge}" hidden></span>` : ""}</span><span class="tab-l">${esc(t.label)}</span></a>`).join("")}<button type="button" id="more" aria-controls="side"><span class="tab-ic">${icon("menu")}</span><span class="tab-l">More</span></button></nav>
  </div>`;
  $("#theme").innerHTML = icon(theme() === "dark" ? "sun" : "moon");
  $("#theme").addEventListener("click", () => { applyTheme(theme() === "dark" ? "light" : "dark"); $("#theme").innerHTML = icon(theme() === "dark" ? "sun" : "moon"); render(true); });
  const side = $("#side"), scrim = $("#scrim");
  let opener = null;
  const setSide = (open, from) => {
    side.classList.toggle("open", open); scrim.classList.toggle("on", open); $("#burger").setAttribute("aria-expanded", String(open)); document.body.style.overflow = open ? "hidden" : "";
    if (open) { opener = from || document.activeElement; side.querySelector("a")?.focus(); } else if (opener) { opener.focus?.(); opener = null; }
  };
  document.removeEventListener("keydown", escMenu);
  escMenu = (e) => { if (e.key === "Escape" && side.classList.contains("open")) { e.preventDefault(); setSide(false); } };
  document.addEventListener("keydown", escMenu);
  $("#burger").addEventListener("click", (e) => setSide(!side.classList.contains("open"), e.currentTarget));
  $("#more").addEventListener("click", (e) => setSide(true, e.currentTarget));
  scrim.onclick = () => { if (side.classList.contains("open")) setSide(false); };
  side.addEventListener("click", (e) => { if (e.target.closest("a")) setSide(false); });
  $("#p-prev").addEventListener("click", () => { const p = stepPeriod(-1); if (p) changePeriod(p); });
  $("#p-next").addEventListener("click", () => { const p = stepPeriod(1); if (p) changePeriod(p); });
  $("#p-label").addEventListener("click", (e) => openPeriodMenu(e.currentTarget));
  $("#user").addEventListener("click", (e) => openUserMenu(e.currentTarget));
  renderNotice();
  startBadges();
  if (DEMO) { bindDemoBanner(); return; }               // a snapshot: no live sync chip, no idle sign-out
  refreshSync();
  startIdle();
  startFeed();
}

// ------------------------------------------------------------------ static demo: banner and role switch
let demoInfo = null;
const ROLE_ORDER = ["salesman", "manager", "owner"];
const roleRank = (id) => { const i = ROLE_ORDER.indexOf(id); return i < 0 ? 9 : i; };
function demoBannerHtml() {
  const m = demoInfo;
  const roles = m.roles.slice().sort((a, b) => roleRank(a.id) - roleRank(b.id));
  return `<div class="demo-banner" role="region" aria-label="Demo snapshot">
    <span class="demo-say"><b>Demo,</b> made-up data. Nothing here is real or saved.</span>
    <div class="demo-acts">
      <div class="demo-roles" role="group" aria-label="View the app as">${roles.map((r) => `<button type="button" data-demo-role="${esc(r.id)}" aria-pressed="${r.id === m.current}" title="${esc(r.hint || "")}">${esc(r.label)}</button>`).join("")}</div>
      <button type="button" class="demo-test" id="demo-test" title="Send me a test notification">${icon("bell", "")}<span class="long">Send me a test notification</span><span class="short">Test alert</span></button>
    </div>
  </div>`;
}
function bindDemoBanner() {
  document.querySelectorAll("[data-demo-role]").forEach((b) => b.addEventListener("click", () => switchDemoRole(b.dataset.demoRole)));
  document.getElementById("demo-test")?.addEventListener("click", () => sendTestNotification());
}
async function switchDemoRole(id) {
  if (!demoInfo || id === demoInfo.current) return;
  api.setDemoRole(id);
  demoInfo.current = id;
  resetDeskStore();
  closeDrawer(); closeMenu();
  const me = await api.get("me");
  applyMe(me);
  buildShell();
  history.replaceState(null, "", can("desk.inbox") ? "#/inbox" : "#/home");
  onRoute();
  const r = demoInfo.roles.find((x) => x.id === id);
  toast(`Now viewing as ${r ? r.label.toLowerCase() : id}${r?.hint ? `: ${r.hint}` : ""}`, "ok");
}

/** A slim strip above the page when two-factor stands between the person and money pages. */
function renderNotice() {
  const n = $("#notice"); if (!n) return;
  const needs = state.mfa?.setup_required && (isLocked(...FIN) || state.locked.length);
  n.innerHTML = needs ? `<div class="notice warn" role="note">${icon("lock", "")}<span><b>Money pages are locked.</b> Set up two-factor so profit, accounts, expenses and the bank file can open for you.</span><a class="btn sm" href="#/security">Set up two-factor</a></div>` : "";
}

function changePeriod(p) { setPeriod(p); updatePeriodUi(); render(); }
function updatePeriodUi() {
  const lab = $("#p-label"); if (!lab) return;
  lab.innerHTML = `${esc(periodLabel())}${icon("down", "")}`;
  const isM = /^\d{4}-\d{2}$/.test(state.period);
  $("#p-prev").disabled = !isM || !stepPeriod(-1);
  $("#p-next").disabled = !isM || !stepPeriod(1);
}
function openPeriodMenu(anchor) {
  const months = periodMonthList().slice().reverse().slice(0, 12);
  openMenu(anchor, [
    { heading: "Month" },
    ...months.map((m) => ({ label: monthLabel(m), checked: state.period === m, onClick: () => changePeriod(m) })),
    { divider: true },
    { label: "Quarter to date", checked: state.period === "quarter", onClick: () => changePeriod("quarter") },
    { label: "Financial year · " + periodLabel("fy"), checked: state.period === "fy", onClick: () => changePeriod("fy") },
  ]);
}

function openUserMenu(anchor) {
  openMenu(anchor, [
    { heading: `${state.user.display_name.replace(/\s*\(.*\)$/, "")} · ${state.user.role_label || state.user.role}` },
    { label: "Dark theme", icon: "moon", checked: theme() === "dark", onClick: () => { applyTheme("dark"); $("#theme").innerHTML = icon("sun"); render(true); } },
    { label: "Light theme", icon: "sun", checked: theme() === "light", onClick: () => { applyTheme("light"); $("#theme").innerHTML = icon("moon"); render(true); } },
    { divider: true },
    { label: "Security and two-factor", icon: "shieldcheck", onClick: () => { location.hash = "#/security"; } },
    { label: "Change password", icon: "key", onClick: changePasswordDrawer },
    { label: "Sign out", icon: "logout", onClick: signOut },
  ], { align: "right" });
}

function changePasswordDrawer() {
  const fields = [
    { name: "current", label: "Current password", type: "password", required: true, full: true, autocomplete: "current-password" },
    { name: "new", label: "New password", type: "password", required: true, full: true, hint: "12 or more characters, not your username.", autocomplete: "new-password" },
  ];
  const d = openDrawer({ title: "Change password", sub: "Other devices will be signed out.", body: `<form id="cp">${formHtml(fields)}</form>`, foot: `<button class="btn" type="button" data-x>Cancel</button><button class="btn primary" type="submit" form="cp">Change password</button>` });
  d.el.querySelector("[data-x]").addEventListener("click", () => d.close());
  d.el.querySelector("#cp").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget; showErrors(f, null);
    const btn = d.el.querySelector('button[type="submit"]');
    try { await save(btn, async () => { try { await api.post("me/password", readForm(f, fields)); } catch (ex) { showErrors(f, ex); throw ex; } }, { ok: "Password changed" }) && d.close(); } catch { /* shown in form */ }
  });
}

async function signOut() {
  if (DEMO) { toast("The demo has no sign-in. Use the buttons at the top to switch between owner, manager and salesman.", "demo"); return; }
  stopFeed();
  await forgetThisDevice();                             // this phone stops getting pushes for this person
  try { await api.post("auth/logout"); } catch { /* session may already be gone */ }
  api.setCsrf(""); state.user = null; resetDeskStore(); loginView();
}

// ------------------------------------------------------------------ lead engine health chip
async function refreshSync() {
  const node = $("#sync"); if (!node || !can("settings.manage")) return;
  try {
    const s = await api.get("admin/sync-status");
    const last = s.last_ok_at || s.last_run_at; if (!last) return;
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(last.replace(" ", "T") + "+05:30")) / 60000));
    const stale = mins > 5 || s.last_error;
    node.hidden = false;
    node.innerHTML = `<span class="dot ${stale ? "warn" : "live"}"></span><span>${stale ? `Leads last synced ${mins} min ago` : "Leads in sync"}</span>`;
    node.title = `Mirror of the lead engine. ${s.leads_in_mirror ?? ""} leads, ${s.events_in_mirror ?? ""} events.`;
  } catch { /* chip is optional */ }
}

// ------------------------------------------------------------------ idle timer (the server ends money sessions after 30 idle minutes)
let idleTimer = null, warned = false;
function stopIdle() { clearInterval(idleTimer); idleTimer = null; warned = false; }
function startIdle() {
  stopIdle();
  const chip = $("#session-chip");
  const money = can(...FIN) || isSuper() || state.locked.length > 0;
  if (!chip || !money) return;
  chip.hidden = false;
  const tick = async () => {
    if (!state.user) return;
    const left = Math.max(0, state.idleMinutes - (Date.now() - api.lastTouch) / 60000);
    const warn = left <= 5;
    chip.className = "session-chip" + (warn ? " warn" : "");
    chip.innerHTML = `${icon("lock", "")}<span>Locks in ${Math.ceil(left)} min</span>`;
    chip.title = `Money pages sign you out after ${state.idleMinutes} idle minutes. Any click that loads data keeps the session alive.`;
    if (left <= 2 && !warned) {
      warned = true;
      const stay = await confirmDialog({ title: "Still there?", text: `For safety, this session ends in about ${Math.ceil(left)} minutes of no activity.`, confirmLabel: "Stay signed in" });
      if (stay) { try { await api.get("me"); } catch { /* the 401 handler shows the sign-in page */ } }
      warned = false;
    }
    if (left <= 0) { try { await api.get("me"); } catch { /* signed out by the server */ } }
  };
  tick();
  idleTimer = setInterval(tick, 20000);
}
window.addEventListener("ca:mfa", () => { if (state.user && route.page !== "security") { toast("That page needs your two-factor code first.", "err"); location.hash = "#/security"; } });

// ------------------------------------------------------------------ router
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  const [page = "", id = ""] = (path || "").split("/");     // #/lead/1042, #/chat/luxury
  return { page, id: decodeURIComponent(id), query: new URLSearchParams(qs || "") };
}
export function go(hash) { location.hash = hash; }

const HOME_MODULE = { owner: "overview", manager: "manager", salesman: "mine", accountant: "accountant" };

async function render(keepScroll = false) {
  const meta = ALL[route.page] || ALL.home;
  const main = $("#main"); if (!main) return;
  const token = ++renderToken;
  disposeCharts(); disposeGrids(); resetPageScope();
  document.body.dataset.view = route.page;
  document.body.dataset.sub = route.id ? "1" : "";
  const tabPage = route.page === "lead" ? "inbox" : route.page;
  $$("[data-page]").forEach((a) => { if (a.dataset.page === tabPage) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  document.title = `${meta.label} · Classic Auto`;
  $("#crumb").textContent = meta.label;
  $("#period").hidden = !meta.period;
  updatePeriodUi();
  if (!keepScroll) window.scrollTo(0, 0);
  main.innerHTML = `<div class="g"><div class="skel card c12"></div></div><div class="kpis"><div class="skel kpi"></div><div class="skel kpi"></div><div class="skel kpi"></div></div>`;
  try {
    let file = route.page;
    let locked = false;
    if (route.page === "home") file = HOME_MODULE[homeKind()];
    else if (meta.any && !opens(meta) && heldOff(meta)) { file = "security"; locked = meta.label; }
    const mod = await import(`./pages/${file}.js`);
    if (token !== renderToken) return;
    const ctx = { root: main, id: route.id, query: route.query, period: state.period, locked, alive: () => token === renderToken && main.isConnected, refresh: () => render(true), go, reloadMe };
    main.innerHTML = "";
    await mod.render(ctx);
    if (token === renderToken) {                      // the top bar and the page heading say the same thing
      const h1 = main.querySelector(".page-title")?.textContent?.trim();
      if (h1) { $("#crumb").textContent = h1; document.title = `${h1} · Classic Auto`; }
    }
    main.focus({ preventScroll: true });
  } catch (e) {
    if (token !== renderToken) return;
    console.error(e);
    const denied = e instanceof ApiError && e.status === 403;
    if (denied) syncMe();
    main.innerHTML = denied
      ? `<div class="err-box" role="alert">${icon("lock", "")}<div><b>This page is not part of your access.</b><span class="muted">${state.user?.is_super_admin ? "Sign in again with your two-factor code." : "Ask the owner if you need it."}</span></div></div>`
      : `<div class="err-box" role="alert">${icon("alert", "")}<div><b>This page could not load.</b><span class="muted">${esc(e.message || "")}</span></div><button class="btn" type="button" id="retry">${icon("refresh")}Try again</button></div>`;
    $("#retry")?.addEventListener("click", () => render());
  }
}

function onRoute() {
  closeDrawer(); closeMenu();
  const r = parseHash();
  const meta = ALL[r.page];
  if (!r.page || !meta || (!opens(meta) && !heldOff(meta))) { location.replace("#/home"); return; }
  route = r;
  render();
}

// ------------------------------------------------------------------ boot
// The demo recordings predate the Desk capabilities: the demo adds the role defaults (APP-SPEC 8.2) when they are missing.
const DESK_DEMO_CAPS = { owner: ["desk.inbox", "desk.leads.act", "desk.ai_call", "chat.use", "desk.ask"], manager: ["desk.inbox", "desk.leads.act", "desk.ai_call", "chat.use", "desk.ask"], salesman: ["desk.inbox", "desk.leads.act", "desk.ai_call", "chat.use"] };
function applyMe(me) {
  if (DEMO && !(me.capabilities || []).some((c) => c.startsWith("desk.") || c === "chat.use")) me.capabilities = [...(me.capabilities || []), ...(DESK_DEMO_CAPS[me.user.role] || [])];
  state.user = me.user;
  state.caps = new Set(me.capabilities || []);
  state.locked = me.capabilities_locked || [];
  state.mfa = me.mfa || {};
  state.perms = me.permissions || [];
  state.idleMinutes = me.idle_timeout_minutes || 120;
  state.settings = me.settings_public || state.settings;
  state.capSig = JSON.stringify([me.user.role, me.capabilities, me.capabilities_locked]);
}

/** Someone may have changed this person's access while the page was open: re-read /api/me on every route change and rebuild
 *  the menu when it differs, so a revoked page does not linger in the nav. */
async function syncMe() {
  if (!state.user) return;
  try {
    const me = await api.get("me");
    if (!state.user || JSON.stringify([me.user.role, me.capabilities, me.capabilities_locked]) === state.capSig) return;
    api.setCsrf(me.csrf);
    applyMe(me);
    buildShell();
    onRoute();
  } catch { /* a 401 shows the sign-in page through ca:unauth */ }
}
const onHash = () => { onRoute(); syncMe(); };

/** Re-read /api/me (after two-factor is set up, or a grant changes) and rebuild the menu. */
export async function reloadMe() {
  const me = await api.get("me");
  api.setCsrf(me.csrf);
  applyMe(me);
  buildShell();
  onRoute();
}

/** The static demo starts signed in: the clock and the month list come from the recording, the person from the role picker. */
async function bootDemo() {
  registerServiceWorker();
  const meta = await api.demoMeta();
  document.documentElement.setAttribute("data-demo", "");
  state.today = meta.today;
  state.months = meta.months;
  setClockShift(meta.recorded_ms - Date.now());
  demoInfo = { ...meta, current: await api.demoRole() };
  const me = await api.get("me");
  initPeriod(null);
  applyMe(me);
  buildShell();
  window.removeEventListener("hashchange", onHash);
  window.addEventListener("hashchange", onHash);
  if (!parseHash().page) location.replace(can("desk.inbox") ? "#/inbox" : "#/home");
  else onRoute();
}

async function boot() {
  if (DEMO) return bootDemo();
  registerServiceWorker();
  let me;
  // The readable CSRF cookie only exists while signed in; skipping /api/me otherwise avoids a pointless 401 on every first visit.
  if (!/(^|;\s*)(__Host-)?ca_csrf=/.test(document.cookie)) { loginView(); return; }
  try { me = await api.get("me"); } catch (e) { if (e.status === 401) { loginView(); return; } throw e; }
  initPeriod(null);
  api.setCsrf(me.csrf);
  applyMe(me);
  if (me.user.must_change_password) { passwordView(me.user); return; }
  buildShell();
  window.removeEventListener("hashchange", onHash);
  window.addEventListener("hashchange", onHash);
  // A person who holds money access but has not set up two-factor lands on the setup page first.
  if (state.mfa.setup_required && state.locked.length && !parseHash().page) location.replace("#/security");
  else if (!parseHash().page) location.replace("#/home");
  else onRoute();
}

window.addEventListener("ca:unauth", () => { if (state.user) { stopFeed(); state.user = null; api.setCsrf(""); resetDeskStore(); loginView("Your session ended. Sign in again."); } });

boot().catch((e) => {
  console.error(e);
  app.innerHTML = `<div class="login-main"><div class="err-box" role="alert">${icon("alert", "")}<div><b>The dashboard could not start.</b><span class="muted">${esc(e.message || "")}</span></div></div></div>`;
});

// ------------------------------------------------------------------ small layout helpers
/** Label every table cell with its column title, so the phone layout (one card per row) can show what each figure is. */
function labelTables() {
  document.querySelectorAll("table.tbl:not([data-labelled])").forEach((t) => {
    const heads = [...t.querySelectorAll("thead th")].map((h) => h.textContent.trim());
    if (!heads.length) return;
    t.querySelectorAll("tbody tr, tfoot tr").forEach((tr) => [...tr.children].forEach((td, i) => { if (!td.dataset.label && heads[i]) td.dataset.label = heads[i]; if (!td.textContent.trim() && !td.querySelector("svg,img,button,input")) td.classList.add("blank"); }));
    t.dataset.labelled = "1";
  });
}
let labelQueued = false;
new MutationObserver(() => { if (!labelQueued) { labelQueued = true; requestAnimationFrame(() => { labelQueued = false; labelTables(); cueScrollers(); }); } }).observe(document.body, { childList: true, subtree: true });

/** Anything that scrolls sideways (wide tables, tab strips) fades at the edge where there is more to see. */
function cueScrollers() {
  document.querySelectorAll(".scroll-x:not([data-cue]), .tabs:not([data-cue])").forEach((el) => {
    el.dataset.cue = "1"; el.classList.add("cue");
    const upd = () => { el.classList.toggle("more-l", el.scrollLeft > 4); el.classList.toggle("more-r", el.scrollLeft + el.clientWidth < el.scrollWidth - 4); };
    el.addEventListener("scroll", upd, { passive: true });
    new ResizeObserver(upd).observe(el);
    upd();
  });
}

/** A fade at the foot of the sidebar while there is more menu to scroll to. */
function sideScrollCue() {
  const side = document.getElementById("side"); if (!side) return;
  const update = () => side.classList.toggle("more", side.scrollHeight - side.scrollTop - side.clientHeight > 8);
  side.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}
new MutationObserver(() => sideScrollCue()).observe(document.getElementById("app") || document.body, { childList: true });
