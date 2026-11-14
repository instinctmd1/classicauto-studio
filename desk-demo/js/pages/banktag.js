// Bank keywords: tag every line of the bank statements. The server groups the lines by who was paid (or who paid),
// suggests a keyword for each group, and one tap accepts a whole group and saves a rule so next month's statement tags
// itself. Tabs: Review (the main work), Statements, Keywords, People, Rules (with the optional AI), Reports.
// All traffic goes through desk-api.js so the static demo answers from its in-memory store (desk-mock-bank.js).
import { ApiError, DEMO } from "../api.js";
import * as desk from "../desk-api.js";
import { onWindow } from "../desk.js";
import { applyDyn, dateFmt, debounce, el, esc, icon, inr, lakhHtml, monthLabel, mount, num, plural } from "../util.js";
import { bindTabs, closeDrawer, confirmDialog, formDrawer, openDrawer, openMenu, pageHead, save, tabsHtml, toast } from "../ui.js";

const PAGE = 50;
const TABS = [["review", "Review"], ["statements", "Statements"], ["keywords", "Keywords"], ["people", "People"], ["rules", "Rules"], ["reports", "Reports"]];
const VIEWS = [["todo", "To do"], ["high", "High confidence"], ["needs_car", "Needs a car"], ["done", "Done"], ["all", "All"]];
const LVL = { high: "High", medium: "Medium", low: "Low" };
const BOOK_PARTS = [["expense", "Expenses"], ["ledger", "Ledger entries"], ["car_cost", "Car costs"], ["deal_payment", "Payments on car deals"], ["contra", "Bank and cash moves"], ["link", "Linked to a car or person only"]];
const UPLOAD_ERR = {
  scanned_pdf: "This PDF is a scanned picture with no text in it. Download the statement as Excel or CSV from net banking instead.",
  pdf_off: "This server cannot read PDF files yet. Download the statement as Excel or CSV from net banking instead.",
  unreadable: "This file could not be read. Check that it is the statement from net banking (Excel, CSV or a PDF with text), then try again.",
  no_header: "The heading row (date, narration, debit, credit) was not found. Open the file and check it is the full statement.",
  no_rows: "The file has headings but no transactions. Check the dates you chose when you downloaded it.",
};
const V = { view: "todo", q: "", account: "", dir: "" };   // the review filters, kept while you move between tabs
let KW = null;                                               // the keyword list, loaded once per visit

// ------------------------------------------------------------------ small helpers
const MONEY = (n) => inr(n);
const dirText = (d) => (d === "in" ? "Money in" : d === "out" ? "Money out" : "Either way");
const splitLabel = (label) => { const [name, ...rest] = String(label).split(" | "); return [name, rest.join(" | ")]; };
const titleCase = (s) => String(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const rangeText = (a, b) => (a === b ? dateFmt(a) : a.slice(0, 4) === b.slice(0, 4) ? `${dateFmt(a, false)} – ${dateFmt(b)}` : `${dateFmt(a)} – ${dateFmt(b)}`);
const linesText = (n) => plural(n, "line");
const kwOf = (id) => (KW ? KW.byId.get(id) : null);
const failHtml = (e, what = "This section") => `<div class="err-box" role="alert">${icon("alert", "")}<div><b>${esc(what)} could not load.</b><span class="muted">${esc(e && e.message ? e.message : "Try again.")}</span></div><button class="btn" type="button" data-retry>${icon("refresh")}Try again</button></div>`;
const skeleton = (n = 3) => Array.from({ length: n }, () => `<div class="skel card bt-skel"></div>`).join("");
const emptyBox = (ic, head, text, extra = "") => `<div class="empty">${icon(ic, "")}<b>${esc(head)}</b>${text ? `<p>${esc(text)}</p>` : ""}${extra}</div>`;
const needsCar = (g) => (g.needs_car !== undefined ? g.needs_car : g.status !== "todo" && !!g.tagged && !g.tagged.mixed && !g.tagged.car && (kwOf(g.tagged.keyword_id) || {}).link === "car");

async function ensureKw(force = false) {
  if (!KW || force) { const r = await desk.get("banktag/keywords"); KW = { ...r, byId: new Map(r.data.map((k) => [k.id, k])) }; }
  return KW;
}
/** Run a write with a busy button. A demo refusal says so in a toast (the shared save() keeps quiet about it). */
function act(btn, fn, opts) {
  return save(btn, async () => { try { return await fn(); } catch (e) { if (e instanceof ApiError && e.code === "demo") toast(e.message, "demo"); throw e; } }, opts);
}
async function busy(btn, fn) {
  const html = window.caI18n ? window.caI18n.html(btn) : btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span> ${esc(btn.textContent.trim())}`;
  try { return await fn(); } finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = html; } }
}
const clearUndoToasts = () => document.querySelectorAll("#toasts .toast").forEach((t) => { if (t.querySelector(".toast-act")) t.remove(); });

// ------------------------------------------------------------------ the page
export async function render(ctx) {
  KW = null;
  const sum = await desk.get("banktag/summary");
  if (!ctx.alive()) return;
  const want = ctx.query.get("tab");
  const P = { ctx, sum, tab: TABS.some(([id]) => id === want) ? want : "review", token: 0, loadSeq: 0, groups: new Map(), counts: { todo: 0, high: 0, done: 0, all: 0, needs_car: 0 }, pages: 1, total: 0, cur: null, touched: [], highLines: null, busy: new Set(), el: {} };
  P.sync = debounce(() => syncSummary(P), 600);
  mount(ctx.root, `<div class="bt">${pageHead({ title: "Bank keywords", sub: "Tag every line of the bank statements. Accept a whole group in one tap, and next month's statement tags itself." })}
    <div class="rise" id="bt-tabs">${tabsHtml(tabList(P), P.tab, "Bank keyword sections")}</div><div id="bt-pane" class="bt-pane" tabindex="-1"></div></div>`);
  P.pane = ctx.root.querySelector("#bt-pane");
  bindTabs(ctx.root, (t) => { P.tab = t; history.replaceState(null, "", `#/banktag${t === "review" ? "" : "?tab=" + t}`); showTab(P); });
  onWindow("keydown", (e) => onKey(P, e));
  showTab(P);
}
const tabList = (P) => TABS.map(([id, label]) => ({ id, label, n: id === "review" && P.sum.total ? P.sum.groups.todo : undefined }));
function paintTabs(P) {
  const host = P.ctx.root.querySelector("#bt-tabs"); if (!host) return;
  const n = host.querySelector('[data-tab="review"] .n'); if (n) n.textContent = String(P.sum.groups.todo);
}
function showTab(P) {
  const tk = ++P.token;
  closeDrawer();
  P.pane.innerHTML = `<div class="bt-skel-wrap">${skeleton(2)}</div>`;
  const run = { review: reviewPane, statements: statementsPane, keywords: keywordsPane, people: peoplePane, rules: rulesPane, reports: reportsPane }[P.tab];
  run(P, P.pane, tk).catch((e) => {
    if (P.token !== tk || !P.ctx.alive()) return;
    console.error(e);
    P.pane.innerHTML = failHtml(e, TABS.find(([id]) => id === P.tab)[1]);
    P.pane.querySelector("[data-retry]").addEventListener("click", () => showTab(P));
  });
}
const goTab = (t) => { location.hash = `#/banktag${t === "review" ? "" : "?tab=" + t}`; };

async function syncSummary(P) {
  if (!P.ctx.alive()) return;
  try {
    const s = await desk.get("banktag/summary", null, { background: true });
    if (!P.ctx.alive()) return;
    Object.assign(P.sum, s);
    paintTabs(P);
    if (P.tab !== "review" || !P.el.head) return;
    if (!V.q && !V.account && !V.dir) P.counts = { todo: s.groups.todo, high: s.groups.high, done: s.groups.done, all: s.groups.total, needs_car: s.groups.needs_car };
    paintHead(P); paintChips(P);
    loadHighLines(P);
  } catch { /* the page keeps what it has */ }
}
function mergeSummary(P, s, label) {
  if (s) { Object.assign(P.sum, s); P.sum.untagged = P.sum.total - P.sum.tagged; }
  if (label) P.sum.last_action = { label };
}

// ================================================================== REVIEW
async function reviewPane(P, host, tk) {
  if (!P.sum.total) {
    host.innerHTML = emptyBox("upload", "No statements yet", "Import a bank statement first. Every line is then grouped by who was paid, with a suggested keyword for each group.",
      `<button class="btn primary" type="button" data-go="statements">${icon("upload")}Go to Statements</button>`);
    host.querySelector("[data-go]").addEventListener("click", () => goTab("statements"));
    return;
  }
  await ensureKw();
  if (P.token !== tk || !P.ctx.alive()) return;
  const accOpts = P.sum.accounts.map((a) => `<option value="${a.id}"${String(V.account) === String(a.id) ? " selected" : ""}>${esc(a.label)}</option>`).join("");
  host.innerHTML = `<div class="bt-head" id="bt-head"></div>
    <div class="bt-filters rise">
      <div class="bt-chips" id="bt-chips" role="group" aria-label="Which groups to show"></div>
      <div class="bt-tools">
        <label class="search bt-q">${icon("search", "")}<input class="input" id="bt-q" type="search" placeholder="Search names, UPI ids, narrations" aria-label="Search groups" autocomplete="off" value="${esc(V.q)}"></label>
        <select class="select" id="bt-acc" aria-label="Account"><option value="">All accounts</option>${accOpts}</select>
        <select class="select" id="bt-dir" aria-label="Money in or out"><option value="">Money in and out</option><option value="in"${V.dir === "in" ? " selected" : ""}>Money in</option><option value="out"${V.dir === "out" ? " selected" : ""}>Money out</option></select>
      </div>
      <div class="bt-legend" id="bt-legend"></div>
    </div>
    <div class="bt-list" id="bt-list" aria-label="Groups of bank lines"></div><div class="bt-more" id="bt-more"></div>`;
  P.el = { head: host.querySelector("#bt-head"), chips: host.querySelector("#bt-chips"), list: host.querySelector("#bt-list"), more: host.querySelector("#bt-more"), q: host.querySelector("#bt-q"), legend: host.querySelector("#bt-legend") };
  P.counts = V.q || V.account || V.dir ? P.counts : { todo: P.sum.groups.todo, high: P.sum.groups.high, done: P.sum.groups.done, all: P.sum.groups.total, needs_car: P.sum.groups.needs_car };
  paintHead(P); paintChips(P); paintLegend(P);
  if ("ResizeObserver" in window) new ResizeObserver(() => P.pane.style.setProperty("--bt-head-h", P.el.head.offsetHeight + "px")).observe(P.el.head);

  P.el.chips.addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]"); if (!b) return;
    V.view = b.dataset.view; fresh(P);
  });
  const onSearch = debounce(() => { V.q = P.el.q.value.trim(); fresh(P); }, 300);
  P.el.q.addEventListener("input", onSearch);
  host.querySelector("#bt-acc").addEventListener("change", (e) => { V.account = e.target.value; fresh(P); });
  host.querySelector("#bt-dir").addEventListener("change", (e) => { V.dir = e.target.value; fresh(P); });
  P.el.head.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.id === "bt-all") acceptAll(P, b); else if (b.id === "bt-undo") undoLast(P, b);
  });
  P.el.list.addEventListener("click", (e) => onListClick(P, e));
  P.el.more.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) busy(b, () => loadGroups(P, { pages: P.pages + 1, keepScroll: true })); });
  await loadGroups(P, { pages: 1, quiet: true });
  loadHighLines(P);
}

function paintHead(P) {
  const s = P.sum, pct = s.total ? (s.tagged / s.total) * 100 : 0, hi = s.groups.high, hl = P.highLines;
  const sub = hi ? ` <span class="bt-all-sub">(${plural(hi, "group")}${hl && hl.lines ? `, ${linesText(hl.lines)}` : ""})</span>` : "";
  P.el.head.innerHTML = `<div class="bt-head-in">
      <div class="bt-prog"><div class="bt-prog-n"><b>${num(s.tagged)}</b><span>of ${num(s.total)} tagged</span></div><div class="bt-prog-g">${hi || s.groups.todo ? `${plural(s.groups.todo, "group")} left` : "Nothing left to tag"}</div></div>
      <div class="meter bt-meter" role="progressbar" aria-label="Lines tagged" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i data-w="${pct.toFixed(1)}"></i></div>
      <div class="bt-head-act">
        <button class="btn primary bt-all" id="bt-all" type="button"${hi ? "" : " disabled"}>${icon("bolt")}<span>Accept all high-confidence${sub}</span></button>
        <button class="btn bt-undo" id="bt-undo" type="button"${s.last_action ? ` title="Undo: ${esc(s.last_action.label)}"` : " disabled"} aria-label="Undo${s.last_action ? ": " + esc(s.last_action.label) : ""}">${icon("history")}<span>Undo</span></button>
      </div></div>`;
  applyDyn(P.el.head);
}
function paintChips(P) {
  if (!P.el.chips) return;
  P.el.chips.innerHTML = VIEWS.map(([id, label]) => `<button class="bt-chip" type="button" data-view="${id}" aria-pressed="${V.view === id}">${esc(label)}<span class="n">${num(P.counts[id] ?? 0)}</span></button>`).join("");
  P.el.chips.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
}
function paintLegend(P) {
  const q = (P.sum.quick || []).map((k) => `<span class="bt-k"><kbd>${esc(k.key)}</kbd>${esc(k.name)}</span>`).join("");
  P.el.legend.innerHTML = `<span class="bt-leg-h">Keys</span>${q ? `<span class="bt-leg-q">${q}</span>` : ""}<span class="bt-leg-s"><span class="bt-k"><kbd>J</kbd><kbd>K</kbd>move</span><span class="bt-k"><kbd>Enter</kbd>accept</span><span class="bt-k"><kbd>U</kbd>undo</span><span class="bt-k"><kbd>/</kbd>search</span></span>`;
}
async function loadHighLines(P) {
  if (typeof P.sum.high_lines === "number") {           // the server counts them (summary.high_lines)
    P.highLines = { lines: P.sum.high_lines, groups: P.sum.groups.high, partial: false };
    if (P.el.head) paintHead(P);
    return;
  }
  try {
    const r = await desk.get("banktag/groups", { view: "high", page_size: 200 }, { background: true });
    if (!P.ctx.alive() || !P.el.head) return;
    P.highLines = { lines: r.data.reduce((t, g) => t + g.n - (g.tagged_n || 0), 0), groups: r.total, partial: r.total > r.data.length };
    paintHead(P);
  } catch { /* the button then shows groups only */ }
}

/** Filters changed: start the list again from the top. */
function fresh(P) {
  P.el.list.innerHTML = skeleton(3); P.el.more.innerHTML = "";
  loadGroups(P, { pages: 1 }).catch((e) => { P.el.list.innerHTML = failHtml(e, "The groups"); P.el.list.querySelector("[data-retry]").addEventListener("click", () => fresh(P)); });
}
async function loadGroups(P, { pages = 1, keepScroll = false } = {}) {
  const tk = P.token, my = ++P.loadSeq;
  const base = { view: V.view, q: V.q, account_id: V.account, direction: V.dir, page_size: PAGE };
  const rs = await Promise.all(Array.from({ length: pages }, (_, i) => desk.get("banktag/groups", { ...base, page: i + 1 })));
  if (P.token !== tk || my !== P.loadSeq || !P.ctx.alive() || !P.el.list.isConnected) return;
  const seen = new Set(), data = [];
  rs.forEach((r) => r.data.forEach((g) => { if (!seen.has(g.id)) { seen.add(g.id); data.push(g); } }));
  const last = rs[rs.length - 1];
  Object.assign(P, { pages, total: last.total, counts: last.counts, groups: new Map(data.map((g) => [g.id, g])) });
  const y = window.scrollY;
  renderList(P);
  if (keepScroll) window.scrollTo(0, y);
}
function renderList(P) {
  const { list, more } = P.el;
  paintChips(P);
  if (!P.groups.size) {
    const plain = !V.q && !V.account && !V.dir;
    list.innerHTML = V.view === "todo" && plain && P.sum.total
      ? emptyBox("check", `All ${num(P.sum.total)} lines tagged`, "Every group has a keyword. A new statement tags itself from the rules you saved.",
        `<div class="bt-empty-act"><a class="btn primary" href="#/banktag?tab=reports">${icon("reports")}Open the reports</a><a class="btn" href="#/banktag?tab=statements">${icon("upload")}Import another statement</a></div>`)
      : emptyBox("search", "No groups here", plain ? "Nothing is in this view yet." : "Nothing matches these filters.", plain ? "" : `<button class="btn" type="button" data-clear>Clear the filters</button>`);
    list.querySelector("[data-clear]")?.addEventListener("click", () => { V.q = V.account = V.dir = ""; P.el.q.value = ""; P.ctx.root.querySelector("#bt-acc").value = ""; P.ctx.root.querySelector("#bt-dir").value = ""; fresh(P); });
    more.innerHTML = ""; P.cur = null; return;
  }
  list.innerHTML = [...P.groups.values()].map((g) => groupHtml(P, g)).join("");
  more.innerHTML = P.groups.size < P.total ? `<button class="btn" type="button">Show more groups <span class="muted">(${num(P.groups.size)} of ${num(P.total)})</span></button>` : "";
  if (!P.cur || !P.groups.has(P.cur)) P.cur = firstOpen(P);
  markCur(P);
}

// ------------------------------------------------------------------ one group
function confidence(s) {
  return `<span class="bt-conf lvl-${s.level}"><span class="bt-bars" aria-hidden="true"><i></i><i></i><i></i></span><b>${LVL[s.level]}</b><span class="bt-pct">${Math.round(s.confidence * 100)}%</span></span>`;
}
function linkChips(s) {
  const cars = s.cars || [], out = cars.slice(0, 4).map((c) => `<span class="bt-tag">${icon("car", "")}${esc(c.stock_no)}${c.n > 1 ? ` ×${c.n}` : ""}</span>`);
  if (cars.length > 4) out.push(`<span class="bt-tag">+${cars.length - 4} more</span>`);
  if (s.party) out.push(`<span class="bt-tag">${icon("people", "")}${esc(s.party.name)}</span>`);
  if (s.link === "car" && !cars.length) out.push(`<span class="bt-tag warn">${icon("alert", "")}No car found in the narration</span>`);
  return out.length ? `<div class="bt-tags">${out.join("")}</div>` : "";
}
function identityHtml(g) {
  const [name, handle] = splitLabel(g.label);
  const meta = [`<span class="bt-dir dir-${g.direction}">${g.direction === "in" ? "Money in" : "Money out"}</span>`, `<span>${linesText(g.n)}</span>`, `<span>${esc(rangeText(g.first, g.last))}</span>`];
  if (g.recurring) meta.push(`<span class="bt-rec">${icon("repeat", "")}monthly ~${esc(MONEY(g.recurring.amount))}</span>`);
  if (g.split) meta.push(`<span class="bt-rec">Split from another group</span>`);
  return `<div class="bt-id"><div class="bt-top"><h3 class="bt-label">${esc(name)}${handle ? `<span class="bt-handle">${esc(handle)}</span>` : ""}</h3><div class="bt-amt" title="${esc(MONEY(g.total))}">${lakhHtml(g.total)}</div></div>
    <div class="bt-meta">${meta.join("")}</div><p class="bt-sample" title="${esc(g.sample)}">${esc(g.sample)}</p></div>`;
}
function groupHtml(P, g) {
  if (g.status === "done") return needsCar(g) ? carRowHtml(g) : doneRowHtml(g);
  const s = g.suggestion, partial = g.status === "partial", left = g.n - g.tagged_n;
  const sug = s
    ? `<div class="bt-sug"><div class="bt-sug-h"><span class="eyebrow">Suggested keyword</span>${confidence(s)}</div><div class="bt-kw"><b>${esc(s.keyword)}</b><span class="bt-grp">${esc(s.group)}</span></div><p class="bt-why">${esc(s.reason)}</p>${linkChips(s)}</div>`
    : `<div class="bt-sug none"><div class="bt-sug-h"><span class="eyebrow">Suggested keyword</span></div><div class="bt-kw"><b>No suggestion yet</b></div><p class="bt-why">Nothing in the narration points to a keyword. Choose one.</p></div>`;
  const note = partial ? `<p class="bt-partial">${icon("info", "")}${num(g.tagged_n)} of ${num(g.n)} lines are already tagged${g.tagged ? ` as ${esc(g.tagged.keyword)}` : ""}.</p>` : "";
  const acceptLabel = partial ? `Accept the other ${linesText(left)}` : g.n === 1 ? "Accept this line" : `Accept for all ${g.n} lines`;
  const main = s ? `<button class="btn pos bt-accept" type="button" data-act="accept">${icon("check")}${esc(acceptLabel)}</button>` : `<button class="btn pos bt-accept" type="button" data-act="keyword">${icon("tag")}Choose a keyword</button>`;
  const link = (s && s.link === "car") || V.view === "needs_car" ? `<button class="btn" type="button" data-act="car">${icon("car")}Link a car</button>` : s && s.link === "person" ? `<button class="btn" type="button" data-act="person">${icon("people")}Link a person</button>` : "";
  return `<article class="bt-card dir-${g.direction} lvl-${s ? s.level : "none"}" data-id="${g.id}" tabindex="-1" aria-label="${esc(splitLabel(g.label)[0])}, ${linesText(g.n)}, ${esc(MONEY(g.total))}">
    ${identityHtml(g)}${sug}${note}
    <div class="bt-acts">${main}<div class="bt-acts2">${s ? `<button class="btn" type="button" data-act="keyword">${icon("tag")}Change keyword</button>` : ""}${link}<button class="btn" type="button" data-act="lines">${icon("sheets")}Lines</button></div></div></article>`;
}
function taggedLine(g) {
  const t = g.tagged; if (!t) return "";
  const bits = [esc(t.mixed ? "Mixed keywords" : t.keyword)];
  if (t.party) bits.push(esc(t.party.name));
  if (t.car) bits.push(esc(t.car.stock_no));
  return bits.join(" · ");
}
function doneRowHtml(g) {
  const [name] = splitLabel(g.label);
  return `<article class="bt-row dir-${g.direction}" data-id="${g.id}" tabindex="-1" aria-label="${esc(name)}, done">
    <span class="bt-ck">${icon("check", "")}</span>
    <div class="bt-row-main"><div class="bt-row-t"><b>${esc(name)}</b><span class="bt-row-n">${linesText(g.n)} · ${esc(MONEY(g.total))}</span></div><div class="bt-row-kw"><span class="bt-done-tag">Done</span>${taggedLine(g)}</div></div>
    <div class="bt-row-acts"><button class="btn sm" type="button" data-act="keyword">Change</button><button class="btn sm ghost" type="button" data-act="lines">Lines</button></div></article>`;
}
function carRowHtml(g) {
  const [name] = splitLabel(g.label);
  return `<article class="bt-row needs dir-${g.direction}" data-id="${g.id}" tabindex="-1" aria-label="${esc(name)}, needs a car">
    <span class="bt-ck warn">${icon("alert", "")}</span>
    <div class="bt-row-main"><div class="bt-row-t"><b>${esc(name)}</b><span class="bt-row-n">${linesText(g.n)} · ${esc(MONEY(g.total))}</span></div><div class="bt-row-kw"><span class="bt-done-tag warn">Needs a car</span>${taggedLine(g)}</div></div>
    <div class="bt-row-acts"><button class="btn sm pos" type="button" data-act="car">${icon("car")}Link a car</button><button class="btn sm" type="button" data-act="keyword">Change</button><button class="btn sm ghost" type="button" data-act="lines">Lines</button></div></article>`;
}

// ------------------------------------------------------------------ the focused group (J / K and clicks)
const nodes = (P) => [...P.el.list.querySelectorAll("[data-id]")];
const firstOpen = (P) => { const g = [...P.groups.values()].find((x) => x.status !== "done"); return g ? g.id : P.groups.size ? [...P.groups.keys()][0] : null; };
function markCur(P) {
  P.el.list.querySelectorAll(".is-cur").forEach((n) => n.classList.remove("is-cur"));
  const n = P.cur != null && P.el.list.querySelector(`[data-id="${P.cur}"]`);
  if (n) n.classList.add("is-cur");
  return n || null;
}
function setCur(P, id, { focus = true, scroll = true } = {}) {
  P.cur = id;
  const n = markCur(P); if (!n) return;
  if (focus) n.focus({ preventScroll: true });
  if (scroll) n.scrollIntoView({ block: "nearest" });
}
function move(P, dir) {
  const all = nodes(P); if (!all.length) return;
  const i = all.findIndex((n) => +n.dataset.id === P.cur);
  const n = all[Math.max(0, Math.min(all.length - 1, i < 0 ? 0 : i + dir))];
  setCur(P, +n.dataset.id);
}
function nextOpenAfter(node) {
  for (let n = node.nextElementSibling; n; n = n.nextElementSibling) if (n.matches(".bt-card")) return n;
  for (let n = node.previousElementSibling; n; n = n.previousElementSibling) if (n.matches(".bt-card")) return n;
  return null;
}
function onKey(P, e) {
  if (P.tab !== "review" || !P.el.list || !P.el.list.isConnected || e.defaultPrevented) return;
  const typing = e.target.closest && e.target.closest("input, textarea, select, [contenteditable='true']");
  const over = document.querySelector("#overlay .drawer, #overlay .modal-wrap, #overlay .menu");
  if (typing || over) return;
  if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") { e.preventDefault(); undoLast(P); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key, inControl = e.target.closest && e.target.closest("button, a, summary");
  if (k === "j" || k === "J") { e.preventDefault(); move(P, 1); }
  else if (k === "k" || k === "K") { e.preventDefault(); move(P, -1); }
  else if (k === "/") { e.preventDefault(); P.el.q.focus(); P.el.q.select(); }
  else if (k === "u" || k === "U") { e.preventDefault(); undoLast(P); }
  else if (k === "Enter" && !inControl && P.cur != null) {
    const g = P.groups.get(P.cur); if (!g) return;
    e.preventDefault();
    if (g.status === "done") openLines(P, g.id); else acceptGroup(P, g.id, {});
  } else if (/^[1-9]$/.test(k) && P.cur != null) {
    const q = (P.sum.quick || []).find((x) => x.key === k), g = P.groups.get(P.cur);
    if (q && g && g.status !== "done") { e.preventDefault(); acceptGroup(P, g.id, { keyword_id: q.keyword_id }); }
  }
}

function onListClick(P, e) {
  const card = e.target.closest("[data-id]"); if (!card) return;
  const id = +card.dataset.id, b = e.target.closest("[data-act]");
  if (P.cur !== id) setCur(P, id, { focus: false, scroll: false });
  if (!b) return;
  const a = b.dataset.act;
  if (a === "accept") acceptGroup(P, id, {}, b);
  else if (a === "keyword") changeKeyword(P, id);
  else if (a === "car") linkCar(P, id);
  else if (a === "person") linkPerson(P, id);
  else if (a === "lines") openLines(P, id);
}

// ------------------------------------------------------------------ actions on a group
const flags = (g) => (g ? { todo: g.status !== "done", high: g.status !== "done" && !!g.suggestion && g.suggestion.level === "high", done: g.status === "done", needs_car: needsCar(g) } : { todo: false, high: false, done: false, needs_car: false });
function bumpCounts(P, oldG, newG) {
  const a = flags(oldG), b = flags(newG);
  for (const k of ["todo", "high", "done", "needs_car"]) {
    const d = (b[k] ? 1 : 0) - (a[k] ? 1 : 0);
    P.counts[k] += d; P.sum.groups[k] += d;
  }
}
/** Swap one card for its new state in place, without redrawing the list or moving the scroll. */
function applyGroup(P, oldG, g, { advance = false } = {}) {
  bumpCounts(P, oldG, g);
  P.groups.set(g.id, g);
  const node = P.el.list.querySelector(`[data-id="${g.id}"]`);
  if (!node) { paintHead(P); paintChips(P); return; }
  const next = advance ? nextOpenAfter(node) : null;
  const n = el(groupHtml(P, g));
  node.replaceWith(n); n.classList.add("bt-flash");
  paintHead(P); paintChips(P);
  if (advance && next) setCur(P, +next.dataset.id); else if (P.cur === g.id) { markCur(P); if (document.activeElement === document.body) n.focus({ preventScroll: true }); }
}
const undoAction = (P) => ({ label: "Undo", onClick: () => undoLast(P) });

async function acceptGroup(P, id, body = {}, btn = null) {
  const old = P.groups.get(id); if (!old || P.busy.has(id)) return;
  if (!body.keyword_id && !old.suggestion) { changeKeyword(P, id); return; }
  P.busy.add(id);
  try {
    const r = await act(btn, () => desk.post(`banktag/groups/${id}/accept`, body), { ok: null });
    if (!r || P.tab !== "review") return;
    const name = body.keyword_id ? (kwOf(body.keyword_id) || {}).name : old.suggestion.keyword;
    applyGroup(P, old, r.group, { advance: true });
    mergeSummary(P, r.summary, `Accepted ${name} for ${linesText(r.lines)}`);
    paintHead(P);
    P.touched.push([id]);
    clearUndoToasts(); toast(`Accepted ${name} for ${linesText(r.lines)}`, "ok", undoAction(P));
    P.sync();
  } finally { P.busy.delete(id); }
}
async function changeKeyword(P, id) {
  const g = P.groups.get(id); if (!g) return;
  const pick = await pickKeyword({ title: "Change keyword", sub: `${splitLabel(g.label)[0]} · ${dirText(g.direction)}`, direction: g.direction, current: g.tagged ? g.tagged.keyword_id : g.suggestion ? g.suggestion.keyword_id : null, rule: true });
  if (!pick) return;
  acceptGroup(P, id, { keyword_id: pick.keyword.id, save_rule: pick.saveRule });
}
function currentKeywordId(g) { return g.tagged && !g.tagged.mixed ? g.tagged.keyword_id : g.suggestion ? g.suggestion.keyword_id : null; }
async function linkCar(P, id) {
  const g = P.groups.get(id); if (!g) return;
  const kid = currentKeywordId(g);
  if (!kid) { changeKeyword(P, id); return; }
  const car = await pickCar({ sub: splitLabel(g.label)[0] });
  if (car) acceptGroup(P, id, { keyword_id: kid, car_id: car.id });
}
async function linkPerson(P, id) {
  const g = P.groups.get(id); if (!g) return;
  const kid = currentKeywordId(g);
  if (!kid) { changeKeyword(P, id); return; }
  const person = await pickPerson({ label: g.label, keywordId: kid });
  if (person) acceptGroup(P, id, { keyword_id: kid, party_id: person.id });
}
async function acceptAll(P, btn) {
  const hi = P.sum.groups.high, hl = P.highLines;
  if (!hi) return;
  const ok = await confirmDialog({ title: "Accept all high-confidence groups?", text: `${plural(hi, "group")}${hl && hl.lines ? ` (${linesText(hl.lines)})` : ""} get the keyword we suggest. A rule is saved for each, so the next statement tags itself. You can undo this.`, confirmLabel: "Accept all" });
  if (!ok) return;
  const r = await act(btn, () => desk.post("banktag/accept-high", { min: 0.85 }), { ok: null });
  if (!r) return;
  mergeSummary(P, r.summary, `Accepted ${plural(r.groups, "group")}`);
  P.touched.push([]);
  clearUndoToasts(); toast(`Accepted ${plural(r.groups, "group")} (${linesText(r.lines)}) and saved ${plural(r.rules, "rule")}`, "ok", undoAction(P));
  if (P.tab === "review") { await loadGroups(P, { pages: P.pages, keepScroll: true }); paintHead(P); P.sync(); }
}
async function undoLast(P, btn = null) {
  if (P.undoing || !P.ctx.alive()) return;
  P.undoing = true;
  try {
    const r = await act(btn, () => desk.post("banktag/undo", {}), { ok: null });
    if (!r) { syncSummary(P); return; }
    clearUndoToasts();
    mergeSummary(P, r.summary); P.sum.last_action = null;
    toast(`Undone: ${r.undone.label}`, "ok");
    const ids = P.touched.pop() || [];
    if (P.tab === "review" && P.el.list && P.el.list.isConnected) {
      await loadGroups(P, { pages: P.pages, keepScroll: true });
      paintHead(P);
      if (ids.length && P.groups.has(ids[0])) setCur(P, ids[0]);
      if (P.lines) reloadLines(P, true);
    }
    P.sync();
  } finally { P.undoing = false; }
}

// ================================================================== pickers (a keyword, a car, a person)
/** A searchable list of keywords in a drawer. Resolves {keyword, saveRule} or null. */
function pickKeyword({ title, sub = "", direction = null, current = null, rule = null, exclude = null, clear = false }) {
  return new Promise(async (resolve) => {
    const kw = await ensureKw();
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    const d = openDrawer({ title, sub: esc(sub), onClose: () => finish(null),
      body: `<label class="search">${icon("search", "")}<input class="input" id="pk-q" type="search" placeholder="Type to find a keyword" aria-label="Find a keyword" autocomplete="off"></label><div class="bt-pick" id="pk-list"></div>`,
      foot: rule === null ? null : `<label class="check bt-rule"><input type="checkbox" id="pk-rule"${rule ? " checked" : ""}><span>Remember this for next month's statements</span></label>` });
    const list = d.el.querySelector("#pk-list"), q = d.el.querySelector("#pk-q");
    const linkText = { car: "needs a car", person: "needs a person" };
    const draw = () => {
      const t = q.value.trim().toLowerCase();
      const act_ = kw.data.filter((k) => k.active && k.id !== exclude && (!t || [k.name, k.group, k.hint, k.words].some((x) => (x || "").toLowerCase().includes(t))));
      const fits = (k) => !direction || !k.direction || k.direction === direction;
      const block = (head, ks) => {
        if (!ks.length) return "";
        const by = new Map(); ks.forEach((k) => { if (!by.has(k.group)) by.set(k.group, []); by.get(k.group).push(k); });
        return `${head ? `<h3 class="bt-pk-h">${esc(head)}</h3>` : ""}${[...by].map(([grp, items]) => `<div class="bt-pk-g">${esc(grp)}</div>${items.map((k) => `<button class="bt-pk-row" type="button" data-id="${k.id}"${k.id === current ? ' aria-current="true"' : ""}><span class="bt-pk-name">${esc(k.name)}</span><span class="bt-pk-meta">${[linkText[k.link], k.direction ? (k.direction === "in" ? "money in only" : "money out only") : ""].filter(Boolean).join(" · ")}</span>${k.id === current ? icon("check", "") : ""}</button>`).join("")}`).join("")}`;
      };
      const a = act_.filter(fits), b = act_.filter((k) => !fits(k));
      list.innerHTML = (clear ? `<button class="bt-pk-row clear" type="button" data-id="0"><span class="bt-pk-name">Clear the tag</span><span class="bt-pk-meta">Make this line untagged again</span></button>` : "")
        + (a.length || b.length ? block(direction && b.length ? `Fits ${dirText(direction).toLowerCase()}` : "", a) + block(direction && a.length ? "Other keywords" : b.length && !direction ? "" : "Other keywords", b) : `<p class="muted bt-pk-none">No keyword matches “${esc(q.value)}”. Add it on the Keywords tab.</p>`);
    };
    draw();
    q.addEventListener("input", draw);
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); list.querySelector(".bt-pk-row")?.click(); } else if (e.key === "ArrowDown") { e.preventDefault(); list.querySelector(".bt-pk-row")?.focus(); } });
    list.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const rows = [...list.querySelectorAll(".bt-pk-row")], i = rows.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault(); (e.key === "ArrowDown" ? rows[i + 1] : i === 0 ? q : rows[i - 1])?.focus();
    });
    list.addEventListener("click", (e) => {
      const b = e.target.closest("[data-id]"); if (!b) return;
      finish({ keyword: +b.dataset.id ? kw.byId.get(+b.dataset.id) : null, saveRule: d.el.querySelector("#pk-rule")?.checked });
      d.close();
    });
  });
}
function pickCar({ title = "Link a car", sub = "" } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    const d = openDrawer({ title, sub: esc(sub), onClose: () => finish(null), body: `<label class="search">${icon("search", "")}<input class="input" id="pc-q" type="search" placeholder="Stock number or car name, e.g. CA105" aria-label="Find a car" autocomplete="off"></label><div class="bt-pick" id="pc-list"></div>` });
    const list = d.el.querySelector("#pc-list"), q = d.el.querySelector("#pc-q"); let seq = 0, cars = [];
    const load = async () => {
      const my = ++seq;
      try { const r = await desk.get("banktag/cars", { q: q.value.trim() }); if (my !== seq) return; cars = r.data;
        list.innerHTML = cars.length ? cars.map((c) => `<button class="bt-pk-row" type="button" data-id="${c.id}"><span class="bt-pk-name">${esc(c.stock_no)}</span><span class="bt-pk-meta">${esc(c.name)}${c.status ? " · " + esc(c.status) : ""}</span></button>`).join("") : `<p class="muted bt-pk-none">No car matches. Check the stock number.</p>`;
      } catch (e) { list.innerHTML = `<p class="muted bt-pk-none">${esc(e.message)}</p>`; }
    };
    load();
    q.addEventListener("input", debounce(load, 200));
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); list.querySelector(".bt-pk-row")?.click(); } else if (e.key === "ArrowDown") { e.preventDefault(); list.querySelector(".bt-pk-row")?.focus(); } });
    list.addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (!b) return; finish(cars.find((c) => c.id === +b.dataset.id) || null); d.close(); });
  });
}
function pickPerson({ label = "", keywordId = null } = {}) {
  return new Promise(async (resolve) => {
    let settled = false, adding = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    let r; try { r = await desk.get("banktag/parties"); } catch (e) { toast(e.message, "err"); resolve(null); return; }
    const people = r.data.filter((p) => p.active);
    const d = openDrawer({ title: "Link a person", sub: esc(splitLabel(label)[0]), onClose: () => { if (!adding) finish(null); },
      body: `<label class="search">${icon("search", "")}<input class="input" id="pp-q" type="search" placeholder="Find a person or vendor" aria-label="Find a person" autocomplete="off"></label><div class="bt-pick" id="pp-list"></div>`,
      foot: `<button class="btn" type="button" id="pp-new">${icon("plus")}Add as a new person</button>` });
    const list = d.el.querySelector("#pp-list"), q = d.el.querySelector("#pp-q");
    const draw = () => {
      const t = q.value.trim().toLowerCase(), ps = people.filter((p) => !t || p.name.toLowerCase().includes(t) || (p.type || "").toLowerCase().includes(t));
      list.innerHTML = ps.length ? ps.map((p) => `<button class="bt-pk-row" type="button" data-id="${p.id}"><span class="bt-pk-name">${esc(p.name)}</span><span class="bt-pk-meta">${esc(p.type || "")}${p.keyword ? " · " + esc(p.keyword) : ""}</span></button>`).join("") : `<p class="muted bt-pk-none">Nobody with that name yet. Use “Add as a new person”.</p>`;
    };
    draw();
    q.addEventListener("input", draw);
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); list.querySelector(".bt-pk-row")?.click(); } else if (e.key === "ArrowDown") { e.preventDefault(); list.querySelector(".bt-pk-row")?.focus(); } });
    list.addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (!b) return; finish(people.find((p) => p.id === +b.dataset.id) || null); d.close(); });
    d.el.querySelector("#pp-new").addEventListener("click", () => {
      adding = true;
      const [name, handle] = splitLabel(label);
      formDrawer({ title: "Add a new person", sub: "They are saved in People, so next time they are matched by name.", submit: "Add and use", ok: "Person added",
        fields: [{ name: "name", label: "Name", type: "text", required: true, full: true, value: titleCase(name) }, { name: "type", label: "Who are they?", type: "select", required: true, full: true, value: "Other", options: r.types }],
        onSubmit: async (v) => { const made = await desk.post("banktag/parties", { name: v.name, type: v.type, keyword_id: keywordId, match: handle || name }); finish({ id: made.id, name: v.name }); } });
    });
  });
}

// ================================================================== the lines of one group
async function openLines(P, id, keep = new Set()) {
  const g = P.groups.get(id);
  const d = openDrawer({ title: g ? splitLabel(g.label)[0] : "Lines", sub: g ? `${linesText(g.n)} · ${esc(MONEY(g.total))}` : "", body: `<div class="skel card"></div>`, wide: true, onClose: () => { if (P.lines && P.lines.d === d) P.lines = null; } });
  P.lines = { id, d, sel: keep, data: [] };
  await reloadLines(P);
}
async function reloadLines(P, quiet = false) {
  const L = P.lines; if (!L) return;
  let r;
  try { r = await desk.get(`banktag/groups/${L.id}/lines`); }
  catch (e) { if (e instanceof ApiError && e.status === 404) { L.d.close(true); P.lines = null; return; } L.d.setBody(`<p class="muted">${esc(e.message)}</p>`); return; }
  if (P.lines !== L) return;
  L.data = r.data; L.sel = new Set([...L.sel].filter((x) => r.data.some((l) => l.id === x)));
  const old = P.groups.get(r.group.id);
  if (P.tab === "review" && P.el.list && P.el.list.isConnected && old && JSON.stringify(old) !== JSON.stringify(r.group)) applyGroup(P, old, r.group);
  paintLines(P, r.group);
}
function paintLines(P, g) {
  const L = P.lines, d = L.d;
  d.setTitle(splitLabel(g.label)[0]); d.setSub(`${linesText(g.n)} · ${esc(MONEY(g.total))} · ${esc(rangeText(g.first, g.last))}`);
  const one = (l) => {
    const sg = l.suggestion;
    const tag = l.keyword_id
      ? `<span class="badge pos">${esc(l.keyword)}</span>${l.party ? `<span class="bt-tag">${icon("people", "")}${esc(l.party.name)}</span>` : ""}${l.car ? `<span class="bt-tag">${icon("car", "")}${esc(l.car.stock_no)}</span>` : ""}${l.posted ? `<span class="badge info">In the books: ${esc(l.posted.replace("_", " "))}</span>` : ""}`
      : sg ? `<span class="bt-ln-sug">Suggested: <b>${esc(sg.keyword)}</b> · ${LVL[sg.level].toLowerCase()} confidence${sg.car ? ` · ${esc(sg.car.stock_no)}` : ""}</span>` : `<span class="bt-ln-sug">No suggestion</span>`;
    return `<li class="bt-line" data-id="${l.id}"><label class="bt-ln-ck"><input type="checkbox" data-sel${L.sel.has(l.id) ? " checked" : ""} aria-label="Select the line of ${esc(dateFmt(l.date, false))}, ${esc(MONEY(l.amount))}"></label>
      <div class="bt-ln-main"><div class="bt-ln-top"><span class="bt-ln-date">${esc(dateFmt(l.date))}</span><span class="bt-ln-amt ${l.direction}">${l.direction === "in" ? "+" : "−"}${esc(MONEY(l.amount))}</span></div>
        <p class="bt-ln-nar">${esc(l.narration)}</p><div class="bt-ln-tag">${tag}</div>
        <div class="bt-ln-acts"><button class="btn sm" type="button" data-ln="tag">Tag this line differently</button>${l.keyword_id ? `<button class="btn sm ghost" type="button" data-ln="clear">Clear tag</button>` : ""}${l.posted ? `<button class="btn sm ghost" type="button" data-ln="unpost">Take out of the books</button>` : ""}</div></div></li>`;
  };
  d.setBody(`<div class="bt-lines-bar"><label class="check"><input type="checkbox" id="ln-all"><span>Select all</span></label><span class="muted" id="ln-n"></span></div><ul class="bt-lines">${L.data.map(one).join("")}</ul>`);
  d.setFoot(`<span class="bt-ln-hint grow" id="ln-hint"></span><button class="btn" type="button" id="ln-split" disabled>${icon("plus")}Split these into a new group</button>`);
  const body = d.el, sync = () => {
    const n = L.sel.size, all = L.data.length;
    body.querySelector("#ln-n").textContent = n ? `${n} selected` : "";
    body.querySelector("#ln-all").checked = n > 0 && n === all; body.querySelector("#ln-all").indeterminate = n > 0 && n < all;
    const can = n > 0 && n < all;
    body.querySelector("#ln-split").disabled = !can;
    body.querySelector("#ln-hint").textContent = n === all && all ? "Leave at least one line in this group." : n ? "" : "Tick the lines that belong to someone else, then split them off.";
  };
  sync();
  body.querySelector("#ln-all").addEventListener("change", (e) => { L.sel = e.target.checked ? new Set(L.data.map((l) => l.id)) : new Set(); body.querySelectorAll("[data-sel]").forEach((c) => { c.checked = e.target.checked; }); sync(); });
  body.querySelector(".bt-lines").addEventListener("change", (e) => { const c = e.target.closest("[data-sel]"); if (!c) return; const id = +c.closest("[data-id]").dataset.id; if (c.checked) L.sel.add(id); else L.sel.delete(id); sync(); });
  body.querySelector(".bt-lines").addEventListener("click", (e) => { const b = e.target.closest("[data-ln]"); if (b) lineAction(P, +b.closest("[data-id]").dataset.id, b.dataset.ln, b); });
  body.querySelector("#ln-split").addEventListener("click", (e) => splitLines(P, e.currentTarget));
}
async function lineAction(P, lineId, what, btn) {
  const l = P.lines.data.find((x) => x.id === lineId); if (!l) return;
  let body, msg;
  const gid = P.lines.id, keep = P.lines.sel, back = () => { if (P.ctx.alive() && P.tab === "review") openLines(P, gid, keep); };   // a picker replaces the drawer: open it again after
  if (what === "unpost") {
    const r = await act(btn, () => desk.post(`banktag/lines/${lineId}/unpost`, {}), { ok: "Taken out of the books" });
    if (r) reloadLines(P); return;
  }
  if (what === "clear") { body = { keyword_id: null, car_id: null, party_id: null }; msg = "Tag cleared"; }
  else {
    const pick = await pickKeyword({ title: "Tag this line", sub: `${dateFmt(l.date)} · ${MONEY(l.amount)} · ${dirText(l.direction)}`, direction: l.direction, current: l.keyword_id, rule: null });
    if (!pick || !pick.keyword) { back(); return; }
    const k = pick.keyword, same = l.suggestion && l.suggestion.keyword_id === k.id;
    let car = same && l.suggestion.car ? l.suggestion.car.id : null;
    if (k.link === "car" && !car) { const c = await pickCar({ sub: `${dateFmt(l.date)} · ${MONEY(l.amount)}` }); if (c) car = c.id; }
    body = { keyword_id: k.id, car_id: car, party_id: same && l.suggestion.party ? l.suggestion.party.id : null }; msg = `Tagged as ${k.name}`;
  }
  const r = await act(null, () => desk.post(`banktag/lines/${lineId}`, body), { ok: null });
  if (!r) { if (what === "tag") back(); return; }
  mergeSummary(P, r.summary, msg); P.touched.push([]);
  clearUndoToasts(); toast(msg, "ok", undoAction(P));
  paintHead(P); P.sync();
  if (what === "tag") back(); else reloadLines(P);
}
async function splitLines(P, btn) {
  const L = P.lines, ids = [...L.sel];
  const r = await act(btn, () => desk.post(`banktag/groups/${L.id}/split`, { line_ids: ids }), { ok: null });
  if (!r) return;
  L.sel = new Set();
  const msg = `Split ${linesText(ids.length)} into a new group`;
  mergeSummary(P, null, msg); P.touched.push([r.group.id]);
  if (P.tab === "review" && P.el.list.isConnected) {
    const oldFrom = P.groups.get(r.from.id);
    bumpCounts(P, null, r.group);
    P.groups.set(r.group.id, r.group);
    const host = P.el.list.querySelector(`[data-id="${r.from.id}"]`);
    if (host) { const n = el(groupHtml(P, r.group)); n.classList.add("bt-flash"); host.after(n); }
    applyGroup(P, oldFrom, r.from);
    P.total++;
  }
  clearUndoToasts(); toast(msg, "ok", undoAction(P));
  P.sync();
  reloadLines(P);
}

// ================================================================== STATEMENTS
async function statementsPane(P, host, tk) {
  const [acc, st] = await Promise.all([desk.get("banktag/accounts"), desk.get("banktag/statements")]);
  if (P.token !== tk || !P.ctx.alive()) return;
  const X = { file: null, checked: null };
  const noAcc = !acc.data.length;
  host.innerHTML = `<section class="card rise bt-up"><div class="card-h"><div><h2>Add a statement</h2><div class="card-sub">Download it from net banking as Excel or CSV. A PDF works only if you can select the text in it.</div></div></div>
    ${noAcc ? `<div class="callout warn">${icon("alert", "")}<div><b>No bank account to import into</b><p>Add the bank account first in <a href="#/bank">Bank and finance</a>, or import the keywords workbook on the Keywords tab.</p></div></div>` : `
    <div class="bt-up-grid"><div class="field"><label for="st-acc">Which account is it from?</label><select class="select" id="st-acc">${acc.data.map((a) => `<option value="${a.id}">${esc(a.label)}</option>`).join("")}</select></div>
      <div class="field"><span class="lab">Statement file</span><input class="bt-file" type="file" id="st-file" accept=".xlsx,.xls,.csv,.pdf"><label class="bt-drop" for="st-file">${icon("upload", "")}<span><b id="st-name">Choose a file</b><small>.xlsx .xls .csv .pdf, up to 15 MB</small></span></label></div></div>
    <div class="bt-up-btns"><button class="btn" type="button" id="st-check" disabled>${icon("search")}Check the file</button><button class="btn primary" type="button" id="st-import" disabled>${icon("download")}Import</button></div>`}
    <div id="st-res" aria-live="polite"></div></section>
    <section class="card flush rise sec-gap"><div class="card-h"><div><h2>Imported statements</h2><div class="card-sub">${plural(st.data.length, "statement")}</div></div></div>${st.data.length ? `<ul class="list bt-stlist">${st.data.map((s) => `<li><span class="grow"><div class="t">${esc(s.label)}</div><div class="s">${esc(s.account)} · ${esc(dateFmt(s.date_from))} to ${esc(dateFmt(s.date_to))}</div></span><span class="bt-st-r"><b>${num(s.lines)}</b> lines<small>${esc(s.imported_by || "")} · ${esc(dateFmt(s.imported_at))}</small></span>${s.removable ? `<button class="btn sm ghost" type="button" data-st-del="${s.id}" title="Take this import back: possible while none of its lines is tagged">${icon("trash")}Remove</button>` : ""}</li>`).join("")}</ul>` : emptyBox("file", "Nothing imported yet", "Your first statement will be listed here.")}</section>`;
  host.querySelectorAll("[data-st-del]").forEach((b) => b.addEventListener("click", async () => {
    const s = st.data.find((x) => x.id === +b.dataset.stDel);
    if (!(await confirmDialog({ title: `Remove ${s ? s.label : "this statement"}?`, text: `Its ${s ? num(s.lines) : ""} lines are taken out again. Nothing of it is tagged yet. You can import the file again later.`, confirmLabel: "Remove", danger: true }))) return;
    try { await desk.del(`banktag/statements/${b.dataset.stDel}`); toast("Statement removed", "ok"); syncSummary(P); statementsPane(P, host, tk); }
    catch (e) { toast(e.message || "Could not remove it.", e.code === "demo" ? "demo" : "err"); }
  }));
  if (noAcc) return;
  const res = host.querySelector("#st-res"), fileEl = host.querySelector("#st-file"), accEl = host.querySelector("#st-acc"), bCheck = host.querySelector("#st-check"), bImport = host.querySelector("#st-import");
  const reset = () => { X.checked = null; bImport.disabled = true; bCheck.disabled = !X.file; res.innerHTML = ""; };
  fileEl.addEventListener("change", () => { X.file = fileEl.files[0] || null; host.querySelector("#st-name").textContent = X.file ? X.file.name : "Choose a file"; reset(); });
  accEl.addEventListener("change", reset);
  const send = async (dry, confirmed = false) => {
    const fd = new FormData(); fd.append("file", X.file); fd.append("bank_account_id", accEl.value); if (dry) fd.append("dry_run", "1");
    if (confirmed) fd.append("confirm_mismatch", "1");             // the person saw the wrong-account warning and chose to go on
    return desk.upload("banktag/statements", fd);
  };
  const oops = (e) => {
    const text = UPLOAD_ERR[e.code] || e.message || "The file could not be read.";
    res.innerHTML = `<div class="callout neg bt-res" role="alert">${icon("alert", "")}<div><b>${e.code === "scanned_pdf" ? "This PDF is a scanned picture" : "This file was not imported"}</b><p>${esc(text)}</p></div></div>`;
  };
  bCheck.addEventListener("click", async () => {
    try { const r = await busy(bCheck, () => send(true)); if (P.token !== tk) return; X.checked = r; bImport.disabled = false; res.innerHTML = checkHtml(r, acc.data.find((a) => a.id === +accEl.value)); }
    catch (e) { if (e instanceof ApiError && e.code === "demo") return toast(e.message, "demo"); oops(e); }
  });
  bImport.addEventListener("click", async () => {
    if (X.checked && X.checked.account_mismatch) {
      const go = await confirmDialog({ title: "Import into a different account?", text: `The file looks like it belongs to the account ending ${X.checked.account_hint}, but you chose ${acc.data.find((a) => a.id === +accEl.value).label}. Lines would be filed under the wrong account.`, confirmLabel: "Import anyway", danger: true });
      if (!go) return;
    }
    try {
      const r = await busy(bImport, () => send(false, !!(X.checked && X.checked.account_mismatch))); if (P.token !== tk) return;
      res.innerHTML = doneHtml(r); toast("Statement imported", "ok");
      bImport.disabled = true; bCheck.disabled = true;
      res.querySelector("[data-review]")?.addEventListener("click", () => goTab("review"));
      syncSummary(P);
    } catch (e) { if (e instanceof ApiError && e.code === "demo") return toast(e.message, "demo"); oops(e); }
  });
}
function checkHtml(r, acct) {
  const cols = Object.entries(r.columns || {}).map(([k, v]) => `<div><dt>${esc({ date: "Date", narration: "Narration", reference: "Reference", debit: "Money out", credit: "Money in", balance: "Balance" }[k] || k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  return `${r.demo_note ? `<div class="callout bt-res">${icon("info", "")}<div>${esc(r.demo_note)}</div></div>` : ""}
    ${r.account_mismatch ? `<div class="callout warn bt-res" role="alert">${icon("alert", "")}<div><b>This may be the wrong account</b><p>The file mentions an account ending ${esc(r.account_hint)}, but you chose ${esc(acct ? acct.label : "another account")}. Check before you import.</p></div></div>` : ""}
    <div class="bt-res"><h3 class="bt-h">What we found</h3><div class="bt-facts"><div><b>${esc(r.bank || "Bank")}</b><span>${esc(String(r.format || "").toUpperCase())} file</span></div><div><b>${num(r.lines)}</b><span>lines read from ${num(r.rows)} rows</span></div><div><b>${num(r.new)}</b><span>new${r.duplicates ? `, ${num(r.duplicates)} seen before` : ""}</span></div><div><b>${esc(dateFmt(r.date_from, false))} – ${esc(dateFmt(r.date_to))}</b><span>${r.skipped ? `${num(r.skipped)} rows skipped (headers, totals)` : "date range"}</span></div></div>
    <h3 class="bt-h">Columns found</h3><dl class="bt-cols">${cols}</dl>
    <h3 class="bt-h">First lines</h3><div class="scroll-x"><table class="tbl keep left"><thead><tr><th>Date</th><th>Narration</th><th>Money</th></tr></thead><tbody>${(r.preview || []).map((p) => `<tr><td>${esc(dateFmt(p.date))}</td><td class="bt-nar-cell">${esc(p.narration)}</td><td class="${p.direction === "in" ? "pos" : ""}">${p.direction === "in" ? "+" : "−"}${esc(MONEY(p.amount))}</td></tr>`).join("")}</tbody></table></div>
    <p class="muted bt-res-note">Looks right? Press Import. Lines already imported before are skipped, so a second import is safe.</p></div>`;
}
function doneHtml(r) {
  return `${r.demo_note ? `<div class="callout bt-res">${icon("info", "")}<div>${esc(r.demo_note)}</div></div>` : ""}
    <div class="callout pos bt-res">${icon("check", "")}<div><b>${esc(r.file)} is imported</b><p>${num(r.new)} new lines${r.duplicates ? `, ${num(r.duplicates)} were already there` : ""}.</p></div></div>
    <div class="bt-facts bt-res"><div><b>${num(r.auto_tagged)}</b><span>tagged by your saved rules</span></div><div><b>${num(r.suggested)}</b><span>have a suggestion</span></div><div><b>${num(r.groups)}</b><span>groups to review</span></div><div><b>${num(r.skipped || 0)}</b><span>rows skipped</span></div></div>
    <div class="bt-res"><button class="btn primary" type="button" data-review>${icon("tag")}Review the groups</button></div>`;
}

// ================================================================== KEYWORDS
async function keywordsPane(P, host, tk) {
  const kw = await ensureKw(true);
  if (P.token !== tk || !P.ctx.alive()) return;
  let term = "";
  host.innerHTML = `<section class="card flush rise"><div class="bt-bar"><label class="search">${icon("search", "")}<input class="input" id="kw-q" type="search" placeholder="Find a keyword" aria-label="Find a keyword" autocomplete="off"></label>
      <div class="bt-bar-act"><button class="btn primary" type="button" id="kw-add">${icon("plus")}Add a keyword</button><button class="btn" type="button" id="kw-wb">${icon("upload")}Import the filled workbook</button><input class="bt-file" type="file" id="kw-wbf" accept=".xlsx" aria-label="Keywords workbook"><button class="btn ghost" type="button" id="kw-re" title="Work out suggestions again for the lines that are still untagged">${icon("refresh")}Suggest again</button></div></div>
      <div id="kw-res" aria-live="polite"></div><div id="kw-list"></div></section>`;
  const listEl = host.querySelector("#kw-list");
  const draw = () => {
    const t = term.toLowerCase(), rows = kw.data.filter((k) => !t || [k.name, k.group, k.books_label].some((x) => (x || "").toLowerCase().includes(t)));
    const by = new Map(); kw.groups.forEach((g) => by.set(g, [])); rows.forEach((k) => { if (!by.has(k.group)) by.set(k.group, []); by.get(k.group).push(k); });
    listEl.innerHTML = [...by].filter(([, ks]) => ks.length).map(([g, ks]) => `<div class="bt-kg"><h3 class="bt-kg-h">${esc(g)}<span>${ks.length}</span></h3>${ks.map((k) => `<div class="bt-kwrow${k.active ? "" : " off"}" data-id="${k.id}"><button class="bt-kw-main" type="button" data-edit aria-label="Edit ${esc(k.name)}"><span class="bt-kw-name">${esc(k.name)}${k.active ? "" : `<span class="badge">Off</span>`}</span>
        <span class="bt-kw-sub">${esc({ car: "Links a car", person: "Links a person", none: "Tag only" }[k.link] || k.link)}${k.direction ? ` · ${k.direction === "in" ? "money in" : "money out"}` : ""} · ${esc(k.books_label)}</span></button>
        <span class="bt-kw-n"><b>${num(k.lines)}</b> lines · <b>${num(k.rules)}</b> rules</span><button class="icon-btn" type="button" data-more aria-label="More for ${esc(k.name)}">${icon("more")}</button></div>`).join("")}</div>`).join("") || emptyBox("search", "No keyword matches", "Try another word, or add the keyword.");
  };
  draw();
  host.querySelector("#kw-q").addEventListener("input", debounce((e) => { term = e.target.value.trim(); draw(); }, 150));
  const reload = () => { KW = null; showTab(P); };
  host.querySelector("#kw-add").addEventListener("click", () => keywordForm(kw, null, reload));
  listEl.addEventListener("click", (e) => {
    const row = e.target.closest("[data-id]"); if (!row) return;
    const k = kw.byId.get(+row.dataset.id);
    if (e.target.closest("[data-edit]")) keywordForm(kw, k, reload);
    else if (e.target.closest("[data-more]")) openMenu(e.target.closest("[data-more]"), [{ label: "Edit", icon: "edit", onClick: () => keywordForm(kw, k, reload) }, { label: "Merge into another keyword", icon: "repeat", onClick: () => mergeKeyword(k, reload) }, { divider: true }, { label: "Delete", icon: "trash", onClick: () => deleteKeyword(k, reload) }], { align: "right" });
  });
  const wb = host.querySelector("#kw-wbf");
  host.querySelector("#kw-wb").addEventListener("click", () => wb.click());
  wb.addEventListener("change", async () => {
    const f = wb.files[0]; if (!f) return;
    const fd = new FormData(); fd.append("file", f); wb.value = "";
    try {
      const r = await busy(host.querySelector("#kw-wb"), () => desk.upload("banktag/workbook", fd));
      const a = r.accounts || {};
      host.querySelector("#kw-res").innerHTML = `<div class="callout pos bt-res">${icon("check", "")}<div><b>Workbook imported</b><p>Keywords: ${num(r.keywords.added)} added, ${num(r.keywords.updated)} updated. People and vendors: ${num(r.parties.added)} added, ${num(r.parties.updated)} updated. Bank accounts: ${num(a.matched || 0)} matched${a.added ? `, ${num(a.added)} added` : ""}. ${num(r.resuggested)} lines got new suggestions.${(a.need_adding || []).length ? ` Add these accounts in Bank and finance first: ${esc(a.need_adding.join(", "))}.` : ""}${r.demo_note ? ` ${esc(r.demo_note)}` : ""}</p></div></div>`;
      KW = null; syncSummary(P);
    } catch (e) { if (e instanceof ApiError && e.code === "demo") toast(e.message, "demo"); else host.querySelector("#kw-res").innerHTML = `<div class="callout neg bt-res" role="alert">${icon("alert", "")}<div><b>The workbook was not imported</b><p>${esc(UPLOAD_ERR[e.code] || e.message)}</p></div></div>`; }
  });
  host.querySelector("#kw-re").addEventListener("click", async (e) => {
    const r = await act(e.currentTarget, () => desk.post("banktag/resuggest", {}), { ok: null });
    if (r) { toast(`Suggestions worked out again for ${linesText(r.lines)}`, "ok"); syncSummary(P); }
  });
}
function keywordForm(kw, k, reload) {
  const edit = !!k;
  const fields = [
    { name: "name", label: "Keyword", type: "text", required: true, full: true, value: k ? k.name : "", placeholder: "For example, Car wash" },
    { name: "group", label: "Group", type: "select", required: true, value: k ? k.group : kw.groups[0], options: kw.groups },
    { name: "link", label: "Links to", type: "select", required: true, value: k ? k.link : "none", options: [["none", "Nothing (tag only)"], ["car", "A car"], ["person", "A person"]] },
    { name: "direction", label: "Money", type: "select", value: k ? k.direction || "" : "", options: [["", "In or out"], ["in", "Money in only"], ["out", "Money out only"]] },
    { name: "tally_ledger", label: "Tally ledger name", type: "text", value: k ? k.tally_ledger || "" : "" },
    { name: "books", label: "Goes to the books as", type: "select", full: true, value: k ? k.books : "", options: kw.books_options, hint: "Tag only keeps it as a label: nothing is posted." },
    { name: "words", label: "Words often seen in the narration", type: "text", full: true, value: k ? k.words || "" : "", hint: "Separate with commas. They help suggest this keyword." },
    { name: "hint", label: "When to use it", type: "text", full: true, value: k ? k.hint || "" : "" },
    ...(edit ? [{ name: "active", label: "Use this keyword", type: "checkbox", full: true, value: k.active }] : []),
  ];
  formDrawer({ title: edit ? "Edit keyword" : "Add a keyword", sub: edit ? `${plural(k.lines, "line")} and ${plural(k.rules, "rule")} use it.` : "", fields, submit: edit ? "Save changes" : "Add keyword", ok: edit ? "Keyword saved" : "Keyword added",
    onSubmit: async (v) => {
      const b = { ...v }; if ("active" in b) b.active = !!b.active;
      for (const f of ["tally_ledger", "words", "hint"]) if (b[f] === null) b[f] = "";
      if (edit) await desk.patch(`banktag/keywords/${k.id}`, b); else await desk.post("banktag/keywords", b);
      reload();
    } });
}
async function mergeKeyword(k, reload) {
  const pick = await pickKeyword({ title: `Merge “${k.name}” into`, sub: "Choose the keyword that stays.", exclude: k.id });
  if (!pick || !pick.keyword) return;
  const into = pick.keyword;
  const ok = await confirmDialog({ title: `Merge into ${into.name}?`, text: `${plural(k.lines, "line")} and ${plural(k.rules, "rule")} move to ${into.name}. “${k.name}” is then removed. This cannot be undone.`, confirmLabel: "Merge", danger: true });
  if (!ok) return;
  try { const r = await desk.post(`banktag/keywords/${k.id}/merge`, { into: into.id }); toast(`Moved ${linesText(r.moved_lines)} and ${plural(r.moved_rules, "rule")} into ${into.name}`, "ok"); reload(); }
  catch (e) { toast(e.message || "Could not merge.", "err"); }
}
async function deleteKeyword(k, reload) {
  const ok = await confirmDialog({ title: `Delete “${k.name}”?`, text: "It is removed from the list. A keyword that is in use cannot be deleted: merge it into another one instead.", confirmLabel: "Delete", danger: true });
  if (!ok) return;
  try { await desk.del(`banktag/keywords/${k.id}`); toast("Keyword deleted", "ok"); reload(); }
  catch (e) {
    if (e instanceof ApiError && e.code === "in_use") {
      const go = await confirmDialog({ title: "This keyword is in use", text: `${e.message}`, confirmLabel: "Merge it instead" });
      if (go) mergeKeyword(k, reload);
    } else toast(e.message || "Could not delete.", "err");
  }
}

// ================================================================== PEOPLE
async function peoplePane(P, host, tk) {
  const [r, kw] = await Promise.all([desk.get("banktag/parties"), ensureKw()]);
  if (P.token !== tk || !P.ctx.alive()) return;
  let term = "";
  host.innerHTML = `<section class="card flush rise"><div class="bt-bar"><label class="search">${icon("search", "")}<input class="input" id="pp-find" type="search" placeholder="Find a person or vendor" aria-label="Find a person or vendor" autocomplete="off"></label>
      <div class="bt-bar-act"><button class="btn primary" type="button" id="pp-add">${icon("plus")}Add a person</button></div></div><p class="bt-lead">People and vendors are matched by name or UPI id, so their payments get the right keyword and person.</p><div id="pp-list"></div></section>`;
  const listEl = host.querySelector("#pp-list");
  const draw = () => {
    const t = term.toLowerCase(), rows = r.data.filter((p) => !t || [p.name, p.type, p.match, p.keyword].some((x) => (x || "").toLowerCase().includes(t)));
    listEl.innerHTML = rows.length ? `<ul class="bt-people">${rows.map((p) => `<li class="bt-person${p.active ? "" : " off"}" data-id="${p.id}"><button class="bt-kw-main" type="button" data-edit aria-label="Edit ${esc(p.name)}"><span class="bt-kw-name">${esc(p.name)}${p.active ? "" : `<span class="badge">Hidden</span>`}</span><span class="bt-kw-sub">${esc(p.type || "Other")}${p.keyword ? ` · ${esc(p.keyword)}` : ""}${p.match ? ` · matches ${esc(p.match)}` : ""}</span></button>
      <span class="bt-kw-n">${p.lines ? `<b>${num(p.lines)}</b> lines${p.total_out ? ` · paid ${esc(MONEY(p.total_out))}` : ""}${p.total_in ? ` · received ${esc(MONEY(p.total_in))}` : ""}` : "No lines yet"}</span><button class="icon-btn" type="button" data-more aria-label="More for ${esc(p.name)}">${icon("more")}</button></li>`).join("")}</ul>` : emptyBox("people", "Nobody here yet", term ? "No one matches that search." : "Add the people and firms you pay or get paid by.");
  };
  draw();
  const reload = () => showTab(P);
  host.querySelector("#pp-find").addEventListener("input", debounce((e) => { term = e.target.value.trim(); draw(); }, 150));
  host.querySelector("#pp-add").addEventListener("click", () => personForm(r, kw, null, reload));
  listEl.addEventListener("click", (e) => {
    const row = e.target.closest("[data-id]"); if (!row) return;
    const p = r.data.find((x) => x.id === +row.dataset.id);
    if (e.target.closest("[data-edit]")) personForm(r, kw, p, reload);
    else if (e.target.closest("[data-more]")) openMenu(e.target.closest("[data-more]"), [{ label: "Edit", icon: "edit", onClick: () => personForm(r, kw, p, reload) }, p.active
      ? { label: "Hide from the lists", icon: "eyeoff", onClick: async () => { if (await confirmDialog({ title: `Hide ${p.name}?`, text: "They are kept for history, but no longer matched or offered in the lists. You can show them again.", confirmLabel: "Hide" })) { try { await desk.del(`banktag/parties/${p.id}`); toast(`${p.name} is hidden`, "ok"); reload(); } catch (x) { toast(x.message, "err"); } } } }
      : { label: "Show again", icon: "eye", onClick: async () => { try { await desk.patch(`banktag/parties/${p.id}`, { active: true }); toast(`${p.name} is back`, "ok"); reload(); } catch (x) { toast(x.message, "err"); } } }], { align: "right" });
  });
}
function personForm(r, kw, p, reload) {
  const edit = !!p;
  const fields = [
    { name: "name", label: "Name", type: "text", required: true, full: true, value: p ? p.name : "" },
    { name: "type", label: "Who are they?", type: "select", required: true, value: p ? p.type : "Other", options: r.types },
    { name: "keyword_id", label: "Usual keyword", type: "select", value: p ? p.keyword_id || "" : "", options: [["", "None"], ...kw.data.filter((k) => k.active).map((k) => [k.id, k.name])] },
    { name: "match", label: "Words in the narration", type: "text", full: true, value: p ? p.match || "" : "", hint: "Names or UPI ids as they appear, separated by commas." },
    { name: "usual_amount", label: "Usual amount (₹)", type: "money", value: p ? p.usual_amount ?? "" : "" },
    { name: "usual_day", label: "Usual day of the month", type: "text", value: p ? p.usual_day || "" : "", placeholder: "For example 1st-5th" },
    { name: "notes", label: "Notes", type: "textarea", full: true, value: p ? p.notes || "" : "" },
    ...(edit ? [{ name: "active", label: "Show in the lists", type: "checkbox", full: true, value: p.active }] : []),
  ];
  formDrawer({ title: edit ? "Edit person" : "Add a person", sub: edit ? "" : "", fields, submit: edit ? "Save changes" : "Add person", ok: edit ? "Saved" : "Person added",
    onSubmit: async (v) => {
      const b = { ...v }; b.keyword_id = b.keyword_id ? +b.keyword_id : null; if ("active" in b) b.active = !!b.active;
      if (edit) await desk.patch(`banktag/parties/${p.id}`, b); else await desk.post("banktag/parties", b);
      reload();
    } });
}

// ================================================================== RULES (and the optional AI)
async function rulesPane(P, host, tk) {
  const r = await desk.get("banktag/rules");
  if (P.token !== tk || !P.ctx.alive()) return;
  host.innerHTML = `<section class="card flush rise"><div class="card-h"><div><h2>Saved rules</h2><div class="card-sub">Accepting a group saves a rule. When a new statement has the same name or UPI id, its lines are tagged for you.</div></div></div>
    ${r.data.length ? `<ul class="bt-rules">${r.data.map((x) => `<li data-id="${x.id}"><div class="bt-rule-main"><b class="bt-rule-m">${esc(x.match)}</b><span class="bt-rule-s">${x.direction === "in" ? "Money in" : x.direction === "out" ? "Money out" : "Either way"} → <b>${esc(x.keyword)}</b>${x.party ? ` · ${esc(x.party.name)}` : ""}</span></div>
      <span class="bt-rule-h"><b>${num(x.hits)}</b> lines${x.last_hit_at ? `<small>last ${esc(dateFmt(x.last_hit_at, false))}</small>` : ""}</span><button class="icon-btn" type="button" data-del aria-label="Delete the rule for ${esc(x.match)}">${icon("trash")}</button></li>`).join("")}</ul>` : emptyBox("repeat", "No rules yet", "Accept a group on the Review tab and its rule is saved here.")}</section>
    <div id="ai" class="sec-gap"></div>`;
  host.querySelector(".bt-rules")?.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    const li = b.closest("[data-id]"), x = r.data.find((y) => y.id === +li.dataset.id);
    const ok = await confirmDialog({ title: "Delete this rule?", text: `Future statements will no longer tag “${x.match}” by themselves. Lines already tagged stay tagged.`, confirmLabel: "Delete rule", danger: true });
    if (!ok) return;
    const done = await act(b, () => desk.del(`banktag/rules/${x.id}`), { ok: "Rule deleted" });
    if (done) showTab(P);
  });
  await aiPanel(P, host.querySelector("#ai"), tk);
}
async function aiPanel(P, host, tk) {
  let set, jobs;
  try { [set, jobs] = await Promise.all([desk.get("banktag/settings"), desk.get("banktag/ai")]); } catch (e) { host.innerHTML = ""; return; }
  if (P.token !== tk || !P.ctx.alive()) return;
  const paint = () => {
    host.innerHTML = `<section class="card rise"><div class="card-h"><div><h2>Ask Claude (optional)</h2><div class="card-sub">The page works fully without this. It is off until the owner switches it on.</div></div>
      <div class="act">${set.can_switch ? `<button class="bt-switch" type="button" role="switch" id="ai-sw" aria-checked="${set.ai}" aria-label="Let Claude suggest keywords for the leftover groups"><i></i><span>${set.ai ? "On" : "Off"}</span></button>` : `<span class="badge">${set.ai ? "On" : "Off"}</span>`}</div></div>
      ${set.ai ? "" : `<p class="bt-ai-note">${esc(set.ai_note)}</p>`}
      ${set.can_switch ? "" : `<p class="muted">Only the main owner login can change this.</p>`}
      <div class="bt-ai-act"><button class="btn" type="button" id="ai-ask"${set.ai ? "" : " disabled"}>${icon("spark")}Ask Claude about the leftover groups</button><span class="muted">${num(jobs.used_today)} of ${num(jobs.cap)} groups used today${set.ai ? "" : ". Turn it on first."}</span></div>
      ${jobs.jobs.length ? `<h3 class="bt-h">Requests</h3><ul class="list bt-jobs">${jobs.jobs.map((j) => `<li><span class="grow"><div class="t">${plural(j.groups, "group")} sent</div><div class="s">${esc(dateFmt(j.created_at))}${j.error ? ` · ${esc(j.error)}` : ""}</div></span><span class="badge ${j.status === "done" ? "pos" : j.status === "failed" ? "neg" : "info"}">${esc({ queued: "Waiting", running: "Working", done: j.suggested != null ? `${j.suggested} suggested` : "Done", failed: "Failed" }[j.status] || j.status)}</span></li>`).join("")}</ul>` : ""}</section>`;
    host.querySelector("#ai-sw")?.addEventListener("click", toggle);
    host.querySelector("#ai-ask")?.addEventListener("click", ask);
  };
  const reloadJobs = async () => { try { jobs = await desk.get("banktag/ai"); } catch { return; } if (P.token === tk && P.ctx.alive() && host.isConnected) { paint(); poll(); } };
  const poll = () => { if (jobs.jobs.some((j) => j.status === "queued" || j.status === "running")) setTimeout(() => { if (P.token === tk && P.ctx.alive() && host.isConnected) reloadJobs(); }, 4000); };
  async function toggle(e) {
    if (!set.ai) {
      const ok = await confirmDialog({ title: "Send bank narrations to Claude?", text: set.ai_note, confirmLabel: "Turn it on" });
      if (!ok) return;
    }
    const r = await act(e.currentTarget, () => desk.patch("banktag/settings", { ai: !set.ai }), { ok: null });
    if (r) { set = { ...set, ai: !set.ai }; paint(); toast(set.ai ? "Claude suggestions are on" : "Claude suggestions are off", "ok"); }
  }
  async function ask(e) {
    const r = await act(e.currentTarget, () => desk.post("banktag/ai", {}), { ok: null });
    if (r) { toast(`Asked Claude about ${plural(r.groups, "group")}`, "ok"); reloadJobs(); }
  }
  paint(); poll();
}

// ================================================================== REPORTS
async function reportsPane(P, host, tk) {
  const R = { from: (P.sum.date_from || "").slice(0, 7), to: (P.sum.date_to || "").slice(0, 7), account: "" };
  host.innerHTML = `<section class="card rise bt-rp-bar"><div class="bt-rp-f"><div class="field"><label for="rp-from">From month</label><input class="input" id="rp-from" type="month" value="${esc(R.from)}"></div><div class="field"><label for="rp-to">To month</label><input class="input" id="rp-to" type="month" value="${esc(R.to)}"></div>
      <div class="field"><label for="rp-acc">Account</label><select class="select" id="rp-acc"><option value="">All accounts</option>${P.sum.accounts.map((a) => `<option value="${a.id}">${esc(a.label)}</option>`).join("")}</select></div></div>
      <div class="bt-rp-dl" id="rp-dl"></div></section><div id="rp-body">${skeleton(2)}</div><div id="rp-books" class="sec-gap"></div>`;
  const body = host.querySelector("#rp-body");
  const qs = () => new URLSearchParams(Object.fromEntries(Object.entries({ from: R.from, to: R.to, account_id: R.account }).filter(([, v]) => v))).toString();
  const paintDl = () => {
    const q = qs(), mk = (href, label, ic) => DEMO ? `<button class="btn" type="button" data-demo>${icon(ic)}${label}</button>` : `<a class="btn" href="${href}?${q}" download>${icon(ic)}${label}</a>`;
    host.querySelector("#rp-dl").innerHTML = mk("/api/banktag/export.xlsx", "Download Excel", "download") + mk("/api/banktag/export-tally.csv", "Download for Tally (CSV)", "download");
  };
  host.querySelector("#rp-dl").addEventListener("click", (e) => { if (e.target.closest("[data-demo]")) toast("Demo: downloads are off.", "demo"); });
  const load = async () => {
    paintDl();
    body.setAttribute("aria-busy", "true");
    try { const r = await desk.get("banktag/reports", { from: R.from, to: R.to, account_id: R.account }); if (P.token !== tk || !P.ctx.alive()) return; body.innerHTML = reportHtml(r); }
    catch (e) { body.innerHTML = failHtml(e, "The report"); body.querySelector("[data-retry]").addEventListener("click", load); }
    body.removeAttribute("aria-busy");
  };
  const again = debounce(load, 250);
  host.querySelector("#rp-from").addEventListener("change", (e) => { R.from = e.target.value; again(); });
  host.querySelector("#rp-to").addEventListener("change", (e) => { R.to = e.target.value; again(); });
  host.querySelector("#rp-acc").addEventListener("change", (e) => { R.account = e.target.value; again(); });
  await load();
  if (P.sum.can && P.sum.can.post) booksPanel(P, host.querySelector("#rp-books"), tk);
}
const cell = (v) => (v ? num(v) : `<span class="bt-nil">–</span>`);
function reportHtml(r) {
  const M = r.months, head = M.map((m) => `<th>${esc(monthLabel(m, false))}</th>`).join("");
  const grouped = []; let lastG = null;
  r.by_keyword.forEach((k) => { if (k.group !== lastG) { grouped.push(`<tr class="bt-grow"><th colspan="${M.length + 4}">${esc(k.group)}</th></tr>`); lastG = k.group; }
    grouped.push(`<tr><td>${esc(k.keyword)}</td>${M.map((m) => { const i = k.in[m] || 0, o = k.out[m] || 0; return `<td>${i && o ? `<span class="pos">+${num(i)}</span><br>${num(o)}` : i ? `<span class="pos">+${num(i)}</span>` : cell(o)}</td>`; }).join("")}<td class="pos">${k.total_in ? "+" + num(k.total_in) : "–"}</td><td>${cell(k.total_out)}</td><td>${num(k.lines)}</td></tr>`); });
  const u = r.untagged;
  return `<div class="bt-kpis rise"><div class="bt-kpi"><span>Money in</span><b>${lakhHtml(r.totals.in)}</b></div><div class="bt-kpi"><span>Money out</span><b>${lakhHtml(r.totals.out)}</b></div>
      <a class="bt-kpi${u.lines ? " warn" : ""}" href="#/banktag"><span>Not tagged yet</span><b>${num(u.lines)}<small>lines</small></b><em>${u.lines ? `${esc(MONEY(u.in))} in, ${esc(MONEY(u.out))} out` : "Everything is tagged"}</em></a></div>
    <section class="card flush rise sec-gap"><div class="card-h"><div><h2>By keyword and month</h2><div class="card-sub">Rupees. Money in is shown with a plus sign.</div></div></div>${r.by_keyword.length ? `<div class="scroll-x"><table class="tbl keep bt-tbl"><thead><tr><th>Keyword</th>${head}<th>Total in</th><th>Total out</th><th>Lines</th></tr></thead><tbody>${grouped.join("")}</tbody></table></div>` : emptyBox("reports", "Nothing tagged in these months", "Tag some groups on the Review tab, then come back.")}</section>
    <section class="card flush rise sec-gap"><div class="card-h"><div><h2>Per car</h2><div class="card-sub">Purchase and costs against the sale, from lines linked to a car.</div></div></div>${r.cars.length ? `<div class="scroll-x"><table class="tbl keep bt-tbl"><thead><tr><th>Car</th><th>Bought for</th><th>Costs</th><th>Sold for</th><th>Net</th><th>Lines</th></tr></thead><tbody>${r.cars.map((c) => `<tr><td><b>${esc(c.stock_no)}</b><span class="sub">${esc(c.name)}</span></td><td>${cell(c.purchase)}</td><td>${cell(c.costs)}</td><td>${cell(c.sale)}</td><td class="${c.sale ? (c.net < 0 ? "neg" : "pos") : ""}">${c.sale ? esc(MONEY(c.net)) : `<span class="bt-nil">not sold</span>`}</td><td>${num(c.lines)}</td></tr>`).join("")}</tbody></table></div>` : emptyBox("car", "No car-linked lines yet", "Link purchases, sales and costs to a car on the Review tab.")}</section>
    <section class="card flush rise sec-gap"><div class="card-h"><div><h2>Salary, per person</h2></div></div>${r.salary.length ? `<div class="scroll-x"><table class="tbl keep bt-tbl"><thead><tr><th>Person</th>${head}<th>Total</th></tr></thead><tbody>${r.salary.map((s) => `<tr><td>${esc(s.name)}</td>${M.map((m) => `<td>${cell(s.months[m])}</td>`).join("")}<td><b>${num(s.total)}</b></td></tr>`).join("")}</tbody></table></div>` : emptyBox("users", "No salary lines tagged yet")}</section>
    <section class="card flush rise sec-gap"><div class="card-h"><div><h2>Investors, in and out</h2></div></div>${r.investors.length ? `<div class="scroll-x"><table class="tbl keep bt-tbl"><thead><tr><th>Investor</th><th>Put in</th><th>Paid back</th><th>Net with us</th></tr></thead><tbody>${r.investors.map((i) => `<tr><td>${esc(i.name)}<span class="sub">${esc(i.type || "")}</span></td><td>${cell(i.in)}</td><td>${cell(i.out)}</td><td><b>${esc(MONEY(i.net))}</b></td></tr>`).join("")}</tbody></table></div>` : emptyBox("wallet", "No investor lines tagged yet")}</section>`;
}
async function booksPanel(P, host, tk) {
  let pv;
  try { pv = await desk.get("banktag/post-preview"); } catch { return; }
  if (P.token !== tk || !P.ctx.alive()) return;
  const eligible = BOOK_PARTS.reduce((t, [k]) => t + ((pv[k] || {}).lines || 0), 0), amount = BOOK_PARTS.reduce((t, [k]) => t + ((pv[k] || {}).amount || 0), 0);
  const row = (label, p, extra = "") => (p && p.lines ? `<li><span class="grow"><div class="t">${esc(label)}</div>${extra ? `<div class="s">${esc(extra)}</div>` : ""}</span><span class="bt-bk-n"><b>${num(p.lines)}</b> lines<small>${esc(MONEY(p.amount))}</small></span></li>` : "");
  host.innerHTML = `<section class="card rise"><div class="card-h"><div><h2>Send to the books</h2><div class="card-sub">Tagged lines become expenses, ledger entries, car costs and deal payments. A line goes in once, and you can take it out again from the Lines view.</div></div></div>
    ${eligible || pv.blocked.lines || (pv.already && pv.already.lines) ? `<ul class="list bt-bk">${BOOK_PARTS.map(([k, label]) => row(label, pv[k])).join("")}${row("Only tagged (nothing to post)", pv.tags_only)}${row("Already in the books", pv.already)}${row("Held back", pv.blocked, pv.blocked.why)}</ul>` : emptyBox("book", "Nothing to send yet", "Tag some groups first.")}
    <div class="bt-bk-act"><button class="btn primary" type="button" id="bk-send"${eligible ? "" : " disabled"}>${icon("send")}Send ${eligible ? plural(eligible, "line") : "to the books"}</button><span id="bk-res" class="muted"></span></div></section>`;
  host.querySelector("#bk-send").addEventListener("click", async (e) => {
    const ok = await confirmDialog({ title: "Send to the books?", text: `${plural(eligible, "line")} worth ${MONEY(amount)} will be written to the books. Lines held back stay as they are.`, confirmLabel: "Send to the books" });
    if (!ok) return;
    const r = await act(e.currentTarget, () => desk.post("banktag/post", {}), { ok: null });
    if (!r) return;
    const sent = BOOK_PARTS.reduce((t, [k]) => t + (r[k] || 0), 0);
    toast(`${plural(sent, "line")} sent to the books${r.skipped ? `, ${r.skipped} held back` : ""}`, "ok");
    booksPanel(P, host, tk);
  });
}
