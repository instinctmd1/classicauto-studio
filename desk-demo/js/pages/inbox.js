// Lead inbox (APP-SPEC 3.2). A salesman sees his own open leads and the unclaimed leads in his price band he may grab;
// the manager and the owners see every lead. The server decides what is in each list; this page only draws it.
import { can } from "../state.js";
import { $, debounce, esc, icon, lakh, safeStore } from "../util.js";
import { pageHead, toast } from "../ui.js";
import * as desk from "../desk-api.js";
import { blockedHelp, canPromptInstall, channelLabel, clockHtml, deskAgo, enableNotifications, every, isAndroid, isIOS, isStandalone, notifyState, onFeed, onWindow, promptInstall, setServerNow, STAGE_LABEL, startTicker, tierShort } from "../desk.js";
import { accOn, rowChip, todoStrip } from "./_acc.js";

const OWN = () => !can("records.all");
const VIEWS_OWN = [["mine", "Mine"], ["grabs", "Grab"], ["closed", "Closed"]];
const VIEWS_ALL = [["unclaimed", "Unclaimed"], ["escalated", "Escalated"], ["open", "Open"], ["closed", "Closed"]];
const COUNT = { mine: "mine_open", grabs: "grabs", unclaimed: "unclaimed", escalated: "escalated", open: "open", night: "night" };
const TIERS = [["", "All"], ["luxury", "Luxury"], ["premium", "Premium"], ["core", "Core"]];
const EMPTY = {
  mine: ["Nothing open right now", "New leads land here first, with a 10 minute clock to claim. Naya lead aate hi phone pe ping aayega."],
  grabs: ["No leads to grab", "Unclaimed leads in your price band show here. Claim one before its clock runs out."],
  closed: ["No closed leads", "Sold and lost leads from the last 30 days show here."],
  unclaimed: ["Every lead is claimed", "New leads that nobody has claimed yet show here."],
  escalated: ["Nothing escalated", "Leads nobody claimed in time show here for the managers and partners."],
  open: ["No open leads", "Claimed and contacted leads show here until they are sold or lost."],
  night: ["The night queue is empty", "Leads that come in after closing wait here with no salesman. At opening they go out in waves, by price band and performance."],
};

export async function render(ctx) {
  const own = OWN();
  const ns = await notifyState();
  const views = own ? VIEWS_OWN : accOn() ? [...VIEWS_ALL, ["night", "Night"]] : VIEWS_ALL;
  const st = {
    view: views.some(([v]) => v === ctx.query.get("view")) ? ctx.query.get("view") : views[0][0],
    tier: ctx.query.get("tier") || "", q: ctx.query.get("q") || "", page: 1, rows: [], total: 0, counts: {},
  };
  const sub = own ? "Your leads first, then leads in your price band you can grab. Claim within 10 minutes." : "Every lead from every channel. Unclaimed and escalated leads need someone now.";
  ctx.root.innerHTML = `${pageHead({ title: "Inbox", sub: esc(sub) })}
    <div id="ib-strips"></div>
    <div id="ib-todo"></div>
    <div class="ib-bar">
      <div class="seg ib-views${views.length > 4 ? " five" : ""}" role="tablist" aria-label="Which leads">${views.map(([v, label]) => `<button type="button" role="tab" data-view="${v}" aria-selected="${v === st.view}"${v === "night" ? ' title="Night queue: leads that came in after closing"' : ""}>${v === "night" ? `${icon("moon", "")}<span class="sr">Night queue</span>` : esc(label)}<span class="n" data-count="${v}"></span></button>`).join("")}</div>
      <div class="ib-tools">
        <label class="ib-search">${icon("search", "")}<span class="sr">Search leads</span><input class="input" type="search" id="ib-q" placeholder="Name, car or #id" value="${esc(st.q)}" autocomplete="off" enterkeyhint="search"></label>
        ${own ? "" : `<div class="seg ib-tiers" role="group" aria-label="Price band">${TIERS.map(([k, l]) => `<button type="button" data-tier="${k}" aria-pressed="${k === st.tier}">${esc(l)}</button>`).join("")}</div>`}
      </div>
    </div>
    <div id="ib-note"></div>
    <div class="ib-list" id="ib-list" aria-live="polite">${skeleton()}</div>
    <div class="ib-more" id="ib-more"></div>`;
  startTicker();
  strips(ctx, ns);

  // the To do strip (call accountability): calls, briefs and screenshots due, with live countdowns. Fail closed: an
  // engine that does not answer hides it.
  const todoHost = $("#ib-todo");
  async function loadTodo() {
    if (!accOn() || !can("acc.own")) { todoHost.innerHTML = ""; return; }
    try {
      const t = await desk.get("acc/todo", {}, { background: true });
      if (!ctx.alive()) return;
      todoHost.innerHTML = t && t.enabled ? todoStrip(t) : "";
    } catch { if (ctx.alive()) todoHost.innerHTML = ""; }
  }

  const list = $("#ib-list"), more = $("#ib-more");
  const syncUrl = () => {
    const q = new URLSearchParams();
    if (st.view !== views[0][0]) q.set("view", st.view);
    if (st.tier) q.set("tier", st.tier);
    if (st.q) q.set("q", st.q);
    history.replaceState(null, "", `#/inbox${q.toString() ? "?" + q : ""}`);
  };

  async function load({ append = false, quiet = false } = {}) {
    if (!quiet && !append) list.setAttribute("aria-busy", "true");
    let r;
    try {
      r = await desk.get("desk/inbox", { view: st.view, tier: st.tier, q: st.q, page: st.page }, quiet ? { background: true } : {});
    } catch (e) {
      if (!ctx.alive()) return;
      list.removeAttribute("aria-busy");
      if (quiet) return;
      list.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>Leads could not load.</b><span class="muted">${esc(e.message || "")}</span></div><button class="btn" type="button" id="ib-retry">${icon("refresh")}Try again</button></div>`;
      $("#ib-retry").addEventListener("click", () => load());
      return;
    }
    if (!ctx.alive()) return;
    list.removeAttribute("aria-busy");
    setServerNow(r.server_now);
    st.counts = r.counts || {};
    st.total = r.total || 0;
    st.rows = append ? st.rows.concat(r.data || []) : r.data || [];
    for (const [v] of views) {
      const n = st.counts[COUNT[v]];
      const node = ctx.root.querySelector(`[data-count="${v}"]`);
      if (node) node.textContent = n === undefined || n === null ? "" : String(n);
    }
    $("#ib-note").innerHTML = r.claim_unavailable ? `<div class="notice warn" role="note">${icon("clock", "")}<span><b>The claim clock is not answering.</b> Leads still arrive; the time left will show again in a minute.</span></div>` : "";
    list.innerHTML = st.rows.length ? st.rows.map((l, i) => card(l, i)).join("") : emptyState(st.view, st.q || st.tier);
    more.innerHTML = st.rows.length < st.total ? `<button class="btn" type="button" id="ib-next">Show more (${st.total - st.rows.length} left)</button>` : "";
    $("#ib-next")?.addEventListener("click", () => { st.page += 1; load({ append: true }); });
  }

  ctx.root.querySelector(".ib-views").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]"); if (!b || b.dataset.view === st.view) return;
    st.view = b.dataset.view; st.page = 1;
    ctx.root.querySelectorAll(".ib-views [data-view]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    list.innerHTML = skeleton(); syncUrl(); load();
  });
  ctx.root.querySelector(".ib-tiers")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tier]"); if (!b) return;
    st.tier = b.dataset.tier; st.page = 1;
    ctx.root.querySelectorAll(".ib-tiers [data-tier]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    syncUrl(); load();
  });
  $("#ib-q").addEventListener("input", debounce((e) => { st.q = e.target.value.trim(); st.page = 1; syncUrl(); load(); }, 300));

  list.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-claim]"); if (!b) return;
    e.preventDefault();
    const id = +b.dataset.claim;
    b.disabled = true; b.innerHTML = `<span class="spin"></span> Claiming`;
    try {
      await desk.post(`desk/leads/${id}/claim`, {});
      desk.done(`Lead #${id} is yours`);
      ctx.go(`#/lead/${id}`);
    } catch (ex) {
      if (ex.code === "brief_overdue" && ex.body?.detail?.lead_id) { toast("Fill your overdue brief first, then claim.", "err"); ctx.go(`#/lead/${+ex.body.detail.lead_id}?brief=1`); return; }
      toast(ex.code === "already_claimed" ? ex.message || "Someone claimed it first." : ex.message || "Could not claim. Try again.", "err");
      load({ quiet: true });
    }
  });

  const refresh = debounce(() => { if (ctx.alive()) { load({ quiet: true }); loadTodo(); } }, 600);
  onFeed((row) => { if (/^(lead|acc)\./.test(row.kind || "")) refresh(); });
  every(60000, () => { if (document.visibilityState === "visible") refresh(); });
  onWindow("desk:install", () => strips(ctx, ns));
  loadTodo();
  await load();
}

function skeleton() {
  return `<div class="skel lead-skel"></div><div class="skel lead-skel"></div><div class="skel lead-skel"></div>`;
}

function emptyState(view, filtered) {
  const [h, p] = filtered ? ["No leads match", "Clear the search or pick another price band."] : EMPTY[view] || ["Nothing here", ""];
  return `<div class="empty ib-empty">${icon("inbox", "")}<b>${esc(h)}</b><p>${esc(p)}</p></div>`;
}

function card(l, i) {
  const own = OWN();
  const holder = l.salesman && !l.mine ? `With ${l.salesman}` : l.mine ? "Yours" : accOn() && l.status === "new" ? "Night queue" : "Not assigned";
  const stage = l.status === "escalated" ? "escalated" : l.status === "lost" ? "lost" : l.stage || l.status;
  const stageCls = { sold: "pos", lost: "neg", escalated: "warn", new: "info" }[stage] || "";
  const canClaim = l.claimable && l.status === "new" && can("desk.leads.act");
  const fresh = l.status === "new";
  const showHolder = !own || !l.mine;
  return `<article class="lead-card tier-${esc(l.tier_key || "none")}${fresh ? " is-new" : ""} rise" data-i="${i}">
    <a class="lead-hit" href="#/lead/${l.id}" aria-label="Open lead ${l.id}: ${esc(l.name || "Customer")}, ${esc(l.car || "no car named")}"></a>
    <div class="lc-top"><span class="lc-ch">${chanIcon(l.channel)}${esc(channelLabel(l.channel))}</span><span class="lc-id">#${l.id}</span><span class="lc-ago">${esc(deskAgo(l.first_seen_ts))}</span></div>
    <div class="lc-name">${esc(l.name || "Customer")}</div>
    <div class="lc-car">${esc(l.car || "No car named yet")}</div>
    <div class="lc-meta">${l.budget ? `<span class="lc-budget">${esc(lakh(l.budget))}</span>` : ""}${l.tier_key ? `<span class="tier-tag">${esc(tierShort(l.tier_key))}</span>` : ""}${showHolder ? `<span class="lc-holder">${esc(holder)}</span>` : ""}${l.after_hours ? `<span class="lc-holder">After hours</span>` : ""}</div>
    <div class="lc-foot">
      <span class="badge ${stageCls}">${esc(STAGE_LABEL[stage] || stage)}</span>
      ${l.claim ? clockHtml(l.claim) : ""}${rowChip(l.acc)}
      ${canClaim ? `<button class="btn primary lc-claim" type="button" data-claim="${l.id}">${icon("check")}Claim</button>` : `<span class="lc-open" aria-hidden="true">${icon("right", "")}</span>`}
    </div>
  </article>`;
}

function chanIcon(c) {
  return icon(c === "call" ? "phone" : c === "whatsapp" ? "wa" : c === "instagram" ? "camera" : c === "facebook" ? "people" : c === "website" ? "globe" : "leads", "");
}

/** The install strip and the lead-alert card. Both appear only until they are done or dismissed. */
function strips(ctx, ns) {
  const host = $("#ib-strips"); if (!host) return;
  const out = [];
  const phone = isIOS() || isAndroid() || canPromptInstall();
  if (!isStandalone() && phone && safeStore("ca.installStrip") !== "hidden") {
    out.push(`<div class="strip" role="note">${icon("download", "")}<span><b>Add CA Desk to your home screen</b><span class="muted">Opens like an app and can ping you for new leads.</span></span>
      ${canPromptInstall() ? `<button class="btn sm primary" type="button" id="st-install">Install</button>` : `<a class="btn sm" href="#/install">How</a>`}
      <button class="icon-btn" type="button" id="st-x" aria-label="Hide this">${icon("x")}</button></div>`);
  }
  if (ns === "off" && safeStore("ca.notifyCard") !== "hidden" && can("desk.inbox")) {
    out.push(`<div class="strip notify" role="note">${icon("bell", "")}<span><b>Get a ping for every new lead</b><span class="muted">You get 10 minutes to claim a lead. A notification tells you the moment it is yours. It never shows the customer's name or number.</span></span>
      <button class="btn sm primary" type="button" id="st-notify">Turn on</button>
      <button class="icon-btn" type="button" id="st-nx" aria-label="Not now">${icon("x")}</button></div>`);
  }
  if (ns === "blocked" && safeStore("ca.blockedCard") !== "hidden" && can("desk.inbox")) {
    out.push(`<div class="strip notify" role="note">${icon("bell", "")}<span><b>Lead alerts are blocked on this phone</b><span class="muted">${esc(blockedHelp())}</span></span>
      <a class="btn sm" href="#/install">How to fix</a>
      <button class="icon-btn" type="button" id="st-bx" aria-label="Hide this">${icon("x")}</button></div>`);
  }
  host.innerHTML = out.join("");
  $("#st-bx")?.addEventListener("click", () => { safeStore("ca.blockedCard", "hidden"); strips(ctx, ns); });
  $("#st-x")?.addEventListener("click", () => { safeStore("ca.installStrip", "hidden"); strips(ctx, ns); });
  $("#st-nx")?.addEventListener("click", () => { safeStore("ca.notifyCard", "hidden"); strips(ctx, ns); });
  $("#st-install")?.addEventListener("click", async () => { await promptInstall(); strips(ctx, ns); });
  $("#st-notify")?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    const s = await enableNotifications();
    if (s === "on") desk.done("Lead alerts are on for this phone");
    else if (s === "blocked") toast(`Notifications are blocked. ${blockedHelp()}`, "err");
    if (ctx.alive()) strips(ctx, s);
  });
}
