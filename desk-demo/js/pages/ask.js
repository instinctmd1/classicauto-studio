// Ask Claude (classic-auto/accountability-6oct/SPEC-ASK-CLAUDE-CHAT.md 9): the one place staff talk to Claude.
// A private thread: questions get short answers; the New car, Car sold and Edit car formats (with photos and paper scans)
// and plain-word changes give a card, and nothing changes until the person taps Yes. Every card comes rendered from the
// server for this viewer; text is always escaped (nothing Claude writes is ever HTML).
import { $, esc, icon, inr, safeStore } from "../util.js";
import { toast } from "../ui.js";
import * as desk from "../desk-api.js";
import { deskTime, every, onFeed, onWindow, refreshBadges } from "../desk.js";
import { can } from "../state.js";
import * as api from "../api.js";
import { DEMO } from "../api.js";
import { shrink } from "./intake.js";

const MB = 1024 * 1024;
const PAPERS = [["rc", "RC"], ["insurance", "Insurance"], ["puc", "PUC"], ["form29", "Form 29"], ["form30", "Form 30"], ["form35", "Form 35"],
  ["bank_noc", "Bank NOC"], ["form29c", "Form 29C"], ["service_history", "Service book"], ["original_invoice", "Original invoice"],
  ["warranty", "Warranty card"], ["pan", "Seller KYC"], ["purchase_agreement", "Purchase agreement"], ["payment_proof", "Payment proof"]];
const OWNER_DOCS = new Set(["purchase_agreement", "payment_proof"]);
const MONEY_LINE = /\b(purchase\s+price|bought\s+for|buying\s+price|kharid\w*|investors?|lowest\s+price|floor\s+price|margin|profit|broker\s+fee|costs?|paid)\b/i;
const DRAFT_KEY = "ca.askDraft";
const SITE_CLS = { live: "pos", on_files: "info", waiting: "warn", problem: "neg", not_listed: "", website_only: "info" };
const STATE_TXT = { done: ["Done", "pos"], waiting_approval: ["Waiting for the manager's OK", "warn"], cancelled: ["Cancelled", ""], replaced: ["Replaced by a newer card", ""],
  expired: ["Expired: ask again", ""], rejected: ["Not approved", "neg"], failed: ["Did not work", "neg"] };

export async function render(ctx) {
  const intakeOk = can("stock.intake"), editOk = can("stock.intake") || can("stock.manage") || can("approvals.request");
  ctx.root.innerHTML = `<div class="ask-page">
    <div class="page-head rise"><div><h1 class="page-title">Ask Claude</h1><p class="page-sub">Ask about stock, your leads, calls and the rules.${intakeOk || editOk ? " Send a car, a sale or a change with Formats: you get a card to check, and nothing changes until you tap Yes." : ""}</p></div>
      <div class="page-actions"><button class="btn sm" type="button" id="ask-new">${icon("plus")}New chat</button></div></div>
    <div id="ask-off"></div>
    <ol class="ask-thread" id="ask-thread" role="log" aria-live="polite" aria-label="Your chat with Claude"><li class="skel lead-skel"></li></ol>
    <form class="composer ask-composer" id="ask-form" novalidate>
      <div class="file-chips ask-chips" id="ask-files" hidden></div>
      <div class="fmt-menu" id="ask-fmt-menu" role="menu" aria-label="Formats" hidden>
        ${intakeOk ? `<button type="button" role="menuitem" data-fmt="new_car">${icon("plus")}New car</button><button type="button" role="menuitem" data-fmt="sold">${icon("tag")}Car sold</button>` : ""}
        ${editOk ? `<button type="button" role="menuitem" data-fmt="edit_car">${icon("edit")}Edit car</button>` : ""}
      </div>
      <div class="composer-row">
        ${intakeOk ? `<button class="icon-btn" type="button" id="ask-clip" aria-label="Attach photos or paper scans">${icon("clip")}</button>
        <input type="file" id="ask-file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" hidden>` : ""}
        ${intakeOk || editOk ? `<button class="btn sm fmt-btn" type="button" id="ask-fmt" aria-haspopup="menu" aria-expanded="false" aria-controls="ask-fmt-menu">Formats</button>` : ""}
        <label class="sr" for="ask-text">Your message</label>
        <textarea class="textarea" id="ask-text" rows="1" maxlength="8000" placeholder="Ask Claude"></textarea>
        <button class="btn primary send-btn" type="submit" aria-label="Send">${icon("send")}</button>
      </div>
    </form>
  </div>`;
  const thread = $("#ask-thread"), offEl = $("#ask-off"), ta = $("#ask-text"), filesEl = $("#ask-files");
  let data = null, files = [], first = true, busy = false, sure = {};

  // ------------------------------------------------------------------ the thread
  function paint() {
    const msgs = data?.messages || [];
    const pending = data?.pending_turn;
    thread.innerHTML = msgs.length || pending ? msgs.map(msgHtml).join("") + (pending ? `<li class="ask-item"><div class="ask-a"><span class="ask-av" aria-hidden="true">${icon("spark", "")}</span><div><p class="muted ask-wait"><span class="spin"></span>Thinking…</p></div></div></li>` : "")
      : `<li class="empty">${icon("spark", "")}<b>Ask your first question</b><p>For example: "Which white cars do we have under 15 lakh?" or "What is due for me today?"</p></li>`;
    offEl.innerHTML = data && !data.ai?.on ? `<div class="strip notify" role="status">${icon("info", "")}<div><b>Ask Claude answers are off right now.</b> <span class="muted">Formats and cards still work.</span></div></div>` : "";
  }
  function msgHtml(m) {
    if (m.role === "user") {
      const ups = (m.uploads || []).map((u) => `<span class="file-chip">${icon(u.slot === "photo" ? "image" : "file", "")}<span>${esc(u.slot === "photo" ? (u.angle || "Photo") : paperName(u.doc_type))}${u.owner_only ? " · only the owner can open it" : ""}</span></span>`).join("");
      return `<li class="ask-item"><div class="ask-q"><p>${esc(m.text || "")}</p>${ups ? `<div class="file-chips">${ups}</div>` : ""}<time>${esc(deskTime(m.created_at))}</time></div></li>`;
    }
    if (m.role === "assistant") return `<li class="ask-item"><div class="ask-a"><span class="ask-av" aria-hidden="true">${icon("spark", "")}</span><div><p class="ask-result">${esc(m.text || "")}</p><time>${esc(deskTime(m.created_at))}</time></div></div></li>`;
    const c = m.card || { type: "notice" };
    return `<li class="ask-item"><div class="ask-a ask-card-row"><span class="ask-av" aria-hidden="true">${icon(cardIcon(c), "")}</span><div class="ask-card ${esc("c-" + c.type)}">${m.text ? `<p class="ask-result">${esc(m.text)}</p>` : ""}${cardHtml(c)}<time>${esc(deskTime(m.created_at))}</time></div></div></li>`;
  }
  async function load(quiet = false) {
    try {
      const r = await desk.get("ask/thread", {}, quiet ? { background: true } : {});
      if (!ctx.alive()) return;
      const stick = window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 160;
      data = r; paint(); seen();
      if (first || (quiet && stick)) window.scrollTo(0, document.documentElement.scrollHeight);
      first = false;
    } catch (e) {
      if (!ctx.alive()) return;
      thread.innerHTML = `<li><div class="err-box" role="alert">${icon("clock", "")}<div><b>${esc(e.message || "Could not load the chat.")}</b></div><button class="btn" type="button" id="ask-retry">${icon("refresh")}Retry</button></div></li>`;
      $("#ask-retry").addEventListener("click", () => load());
    }
  }
  function seen() {
    const top = (data?.messages || []).reduce((a, m) => (m.role !== "user" && m.id > a ? m.id : a), 0);
    if (top > Number(safeStore("ca.askSeenId") || 0)) { safeStore("ca.askSeenId", String(top)); refreshBadges(); }
  }

  // ------------------------------------------------------------------ cards
  function stateBadge(c) {
    if (c.state === "proposed") return "";
    const [t, k] = STATE_TXT[c.state] || [c.state, ""];
    return `<span class="badge st-badge ${k}">${c.state === "done" ? icon("check", "") : ""}${esc(t)}</span>`;
  }
  function siteChip(s) {
    if (!s) return "";
    return `<span class="badge ${SITE_CLS[s.state] || ""}" title="${esc(s.note || "")}">${icon("globe", "")}Website: ${esc(s.label)}</span>${s.state === "problem" && s.note ? `<p class="muted small">${esc(s.note)}</p>` : ""}`;
  }
  function yesButtons(c, label = "Yes") {
    if (!c.can_yes || !c.mine) return "";
    const s = sure[c.action_id];
    return `<div class="ask-acts">${s ? `<p class="neg-text">${esc(s)}</p><button class="btn sm primary" type="button" data-yes="${+c.action_id}" data-v="${+c.version}" data-sure="1">${icon("check")}Yes, I'm sure</button>`
      : `<button class="btn sm primary" type="button" data-yes="${+c.action_id}" data-v="${+c.version}">${icon("check")}${esc(label)}</button>`}
      ${c.href ? `<a class="btn sm" href="${esc(safeHash(c.href))}">${icon("edit")}Change</a>` : ""}<button class="btn sm ghost" type="button" data-no="${+c.action_id}">Cancel</button></div>`;
  }
  function cardHtml(c) {
    switch (c.type) {
      case "readback": {
        const lines = (c.lines || []).filter((l) => l.value).map((l) => `<div class="rb-line ${esc(l.flag || "")}"><span>${esc(l.label)}</span><b>${esc(l.value)}</b></div>`).join("");
        const ph = c.photos ? `<div class="rb-photos"><div class="rb-ph-head"><b>Photos ${+c.photos.must_in} of ${+c.photos.must} must-haves</b><span class="muted">${+c.photos.have} in all</span>${c.photos.have && c.mine && c.state === "proposed" ? `<a class="link-btn" href="${esc(safeHash(c.photos.fix_href))}">Fix slots</a>` : ""}</div>
          ${c.photos.grid?.length ? `<div class="rb-grid">${c.photos.grid.slice(0, 12).map((g) => `<figure>${DEMO ? "" : `<img src="${esc(g.thumb)}" alt="" loading="lazy">`}<figcaption>${esc((g.angle || "") + " " + (g.label || ""))}</figcaption></figure>`).join("")}</div>` : ""}</div>` : "";
        const papers = c.papers?.length ? `<p class="small muted">Papers attached: ${c.papers.map((p) => esc(paperName(p.doc_type) + (p.owner_only ? " (owner only)" : ""))).join(", ")}</p>` : "";
        const fix = c.state === "proposed" && c.missing?.length ? `<div class="ask-acts"><button class="btn sm" type="button" disabled>Fix ${c.missing.length} thing${c.missing.length === 1 ? "" : "s"}</button>${c.href ? `<a class="btn sm" href="${esc(safeHash(c.href))}">${icon("edit")}Change</a>` : ""}<button class="btn sm ghost" type="button" data-no="${+c.action_id}">Cancel</button></div><ul class="rb-miss">${c.missing.slice(0, 8).map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : "";
        return `<div class="card-head">${stateBadge(c)}${c.owner_line ? `<span class="badge info">${esc(c.owner_line)}</span>` : ""}</div><div class="rb">${lines}</div>${ph}${papers}${fix || yesButtons(c, "Yes, looks right")}${siteChip(c.site)}${c.car_href ? `<a class="link-btn" href="${esc(safeHash(c.car_href))}">Open car file${c.stock_no ? " " + esc(c.stock_no) : ""}</a>` : ""}`;
      }
      case "edit":
        return `<div class="card-head"><b>${esc(c.label || "")} ${c.stock_no ? `<span class="muted">(${esc(c.stock_no)})</span>` : ""}</b>${stateBadge(c)}</div>
          <table class="ed-rows"><tbody>${(c.rows || []).map((r) => `<tr><th scope="row">${esc(r.label)}</th><td><s class="muted">${esc(r.old)}</s> <span aria-hidden="true">→</span><span class="sr">changes to</span> <b>${esc(r.new)}</b></td></tr>`).join("")}</tbody></table>
          ${(c.warnings || []).map((w) => `<p class="neg-text">${icon("alert", "")}${esc(w)}</p>`).join("")}
          ${c.approval ? `<span class="badge ${c.approval.status === "approved" ? "pos" : c.approval.status === "rejected" ? "neg" : "warn"}">Price: ${esc({ pending: "waiting for the manager's OK", approved: "approved", rejected: "not approved" }[c.approval.status] || c.approval.status)}</span>` : ""}
          ${c.decision_note ? `<p class="muted small">${esc(c.decision_note)}</p>` : ""}${yesButtons(c)}${siteChip(c.site)}`;
      case "status":
        return `<div class="card-head"><b>${esc(c.label || "")} ${c.stock_no ? `<span class="muted">(${esc(c.stock_no)})</span>` : ""}</b>${stateBadge(c)}</div>
          ${c.text ? `<p>${esc(c.text)}</p>` : `<p>${esc(c.back ? "Put it back on the website (available)." : "Take it off the website:")}</p>`}
          ${c.choices?.length > 1 && c.state === "proposed" ? `<fieldset class="st-choices"><legend class="sr">How it leaves</legend>${c.choices.map((x, i) => `<label class="radio"><input type="radio" name="st-${+c.action_id}" value="${esc(x.value)}"${i === 0 ? " checked" : ""}> ${esc(x.label)}</label>`).join("")}</fieldset>` : (!c.back && c.to_label ? `<p><b>${esc(c.to_label)}</b></p>` : "")}
          ${yesButtons(c)}${siteChip(c.site)}`;
      case "website_only":
        return `<div class="card-head"><b>${esc(c.label || "")}</b>${stateBadge(c)}</div><p class="muted small">This car is only on the website. Yes sends your words to the website assistant.</p><blockquote class="ask-quote">${esc(c.words || "")}</blockquote>${c.task ? `<span class="badge">Website assistant: ${esc(c.task)}</span>` : ""}${yesButtons(c)}`;
      case "sold_format":
        return `<p>${esc(c.note || "")}</p><pre class="fmt-pre">${esc(c.text || "")}</pre><div class="ask-acts"><button class="btn sm" type="button" data-usefmt="1">${icon("edit")}Use this format</button></div>`;
      case "car":
        return `<div class="car-card">${c.photo && !DEMO ? `<img src="${esc(c.photo)}" alt="" loading="lazy">` : ""}<div><b>${esc(c.label || "")}</b>${c.stock_no ? ` <span class="muted">(${esc(c.stock_no)})</span>` : ""}
          <p class="small">${c.price_on_request ? "Price on request" : c.price ? esc(inr(c.price)) : ""}${c.kms != null ? " · " + esc(new Intl.NumberFormat("en-IN").format(c.kms)) + " km" : ""}${c.status ? " · " + esc(String(c.status).replace(/_/g, " ")) : ""}</p>
          ${siteChip(c.site)}<div class="ask-acts">${c.href ? `<a class="btn sm" href="${esc(safeHash(c.href))}">Open car file</a>` : ""}${c.site_url && /^https:\/\//.test(c.site_url) ? `<a class="btn sm" href="${esc(c.site_url)}" target="_blank" rel="noopener noreferrer">${icon("link")}Open on website</a>` : ""}</div></div></div>`;
      case "money":
        if (c.hidden) return `<p class="muted">${esc(c.text || "Only on the owner's login.")}</p>`;
        return `<div class="card-head"><b>${esc(c.label || "")} <span class="muted">(${esc(c.stock_no || "")})</span></b><span class="badge">${icon("lock", "")}Owner only</span></div>
          ${c.buying_price_missing ? `<p class="neg-text">Buying price missing</p><a class="btn sm" href="${esc(safeHash(c.add_href || "#/inventory"))}">Add it</a>` : ""}
          <dl class="money-dl">${money("Buying price", c.purchase_price)}${money("Broker fee", c.broker_fee)}${money("Costs", c.costs_total)}${money("Total cost", c.total_cost)}${money("Asking price", c.asking_price)}${money("Lowest price", c.floor_price)}${money("Margin at asking", c.expected_margin)}${money("Holding cost", c.holding_cost)}${c.profit != null ? money("Profit", c.profit) : ""}</dl>
          ${(c.costs || []).length ? `<p class="small muted">${c.costs.map((k) => esc(`${String(k.category || "").replace(/_/g, " ")} ${inr(k.amount)}`)).join(" · ")}</p>` : ""}
          ${(c.investors || []).length ? `<p class="small">Investors: ${c.investors.map((i) => esc(`${i.label} ${inr(i.amount)}${i.profit_share_pct ? ` (${i.profit_share_pct}%)` : ""}`)).join(", ")}</p>` : ""}`;
      case "deal_money":
        if (c.hidden) return `<p class="muted">${esc(c.text || "")}</p>`;
        return `<dl class="money-dl">${money("Sale price", c.sale_price)}${money("Token", c.token)}${money("Paid so far", c.paid)}${money("Balance due", c.balance_due)}${c.gross_profit != null ? money("Profit", c.gross_profit) : ""}</dl>`;
      case "contact":
        return `<div><b>${esc(c.name || "Customer")}</b> <span class="muted">#${+c.lead_id}</span><p class="ph-num">${esc(c.number || "No number")}</p>
          <div class="ask-acts">${c.tel_url ? `<a class="btn sm primary" href="${esc(safeHash(c.lead_href))}">${icon("phone")}Call from the lead</a>` : ""}${c.whatsapp_url && /^https:\/\/wa\.me\//.test(c.whatsapp_url) ? `<a class="btn sm" href="${esc(c.whatsapp_url)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}<a class="btn sm ghost" href="${esc(safeHash(c.lead_href))}">Open lead</a></div></div>`;
      case "ids":
        return `<dl class="money-dl">${c.reg ? dl("Registration", c.reg) : ""}${c.chassis ? dl("Chassis", c.chassis) : ""}${c.engine ? dl("Engine", c.engine) : ""}</dl>${c.full ? "" : `<p class="small muted">Full numbers need the IDs access.</p>`}`;
      case "notice":
        return (c.buttons || []).length ? `<div class="ask-acts">${c.buttons.includes("formats") ? `<button class="btn sm" type="button" data-openfmt="1">Formats</button>` : ""}${c.buttons.includes("stock") ? `<a class="btn sm" href="#/inventory">Stock</a>` : ""}${c.buttons.includes("calls") ? `<a class="btn sm" href="#/calls">Calls</a>` : ""}</div>` : "";
      case "gone":
        return `<p class="muted">${esc(c.text || "This is no longer available.")}</p>`;
      default:
        return "";
    }
  }
  const money = (k, v) => (v == null ? "" : dl(k, inr(v)));
  const dl = (k, v) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`;

  // ------------------------------------------------------------------ actions on cards
  thread.addEventListener("click", async (e) => {
    const yes = e.target.closest("[data-yes]"), no = e.target.closest("[data-no]");
    if (e.target.closest("[data-openfmt]")) { openMenu(); return; }
    const use = e.target.closest("[data-usefmt]");
    if (use) { const pre = use.closest(".ask-card")?.querySelector(".fmt-pre"); if (pre) insert(pre.textContent); return; }
    if (!yes && !no) return;
    const b = yes || no;
    b.disabled = true;
    try {
      if (yes) {
        const id = +yes.dataset.yes;
        const pick = thread.querySelector(`input[name="st-${id}"]:checked`);
        const r = await desk.post(`ask/actions/${id}/confirm`, { version: +yes.dataset.v, sure: !!yes.dataset.sure, ...(pick ? { choice: pick.value } : {}) });
        delete sure[id];
        desk.done(r.state === "waiting_approval" ? "Sent for the manager's OK" : r.approval_id ? "Price change sent for approval" : "Done");
      } else {
        await desk.post(`ask/actions/${+no.dataset.no}/cancel`, {});
        desk.done("Cancelled");
      }
    } catch (ex) {
      if (ex.code === "sure_needed") { sure[+yes.dataset.yes] = ex.message; paint(); return; }
      const miss = ex.body?.error?.checks?.missing;
      toast(miss?.length ? `Still needed: ${miss.map((m) => m.text).slice(0, 4).join(", ")}` : ex.message || "That did not work. Try again.", "err");
    }
    await load();
  });

  // ------------------------------------------------------------------ the Formats menu
  const fmtBtn = $("#ask-fmt"), menu = $("#ask-fmt-menu");
  function openMenu() {
    if (!menu || !fmtBtn) return;
    menu.hidden = false; fmtBtn.setAttribute("aria-expanded", "true");
    menu.querySelector("button")?.focus();
  }
  function closeMenu() { if (menu) { menu.hidden = true; fmtBtn?.setAttribute("aria-expanded", "false"); } }
  fmtBtn?.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu()));
  menu?.addEventListener("keydown", (e) => {
    const items = [...menu.querySelectorAll("button")], i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    if (e.key === "Escape") { closeMenu(); fmtBtn.focus(); }
  });
  menu?.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-fmt]");
    if (!b) return;
    closeMenu();
    try { const r = await desk.get("intakes/format", { kind: b.dataset.fmt }); insert(r.text); } catch (ex) { toast(ex.message || "Could not load the format.", "err"); }
  });
  onWindow("click", (e) => { if (menu && !menu.hidden && !e.target.closest("#ask-fmt-menu") && !e.target.closest("#ask-fmt")) closeMenu(); });
  function insert(t) {
    ta.value = t; grow(); ta.focus();
    const at = t.indexOf(":", t.indexOf("\n")) + 2;
    try { ta.setSelectionRange(at, at); } catch { /* some inputs refuse */ }
    saveDraft();
  }

  // ------------------------------------------------------------------ photos and paper scans
  function drawFiles() {
    filesEl.hidden = !files.length;
    filesEl.innerHTML = files.map((f, i) => `<span class="file-chip up-chip ${f.state}">
      ${f.thumb ? `<img src="${esc(f.thumb)}" alt="">` : icon(f.slot === "photo" ? "image" : "file", "")}
      <span>${esc(f.name)}</span>
      ${f.mime === "application/pdf" ? "" : `<button type="button" class="seg" data-slot="${i}" aria-label="Switch photo or paper">${f.slot === "photo" ? "Photo" : "Paper"}</button>`}
      ${f.slot === "paper" ? `<label class="sr" for="pp-${i}">Which paper</label><select id="pp-${i}" data-paper="${i}">${PAPERS.map(([k, n]) => `<option value="${k}"${f.doc_type === k ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>` : ""}
      ${f.state === "up" ? `<span class="ring" data-p="${Math.round((f.p || 0) * 100)}" role="progressbar" aria-valuenow="${Math.round((f.p || 0) * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Uploading"></span>` : ""}
      ${f.state === "err" ? `<button type="button" class="link-btn" data-retry="${i}">Retry</button>` : ""}
      ${f.state === "done" && OWNER_DOCS.has(f.doc_type) ? `<span class="small muted">Only the owner can open it</span>` : ""}
      <button type="button" data-rm="${i}" aria-label="Remove ${esc(f.name)}">${icon("x", "")}</button></span>`).join("");
    filesEl.querySelectorAll(".ring[data-p]").forEach((r) => r.style.setProperty("--p", r.dataset.p));   // CSP: no style attributes
  }
  async function uploadOne(f) {
    if (f.uuid) { try { await desk.del(`ask/uploads/${f.uuid}`); } catch { /* already gone */ } f.uuid = null; }
    f.state = "up"; f.p = 0; drawFiles();
    const fd = new FormData();
    fd.append("file", f.blob, f.name); fd.append("slot", f.slot);
    if (f.slot === "paper") fd.append("doc_type", f.doc_type);
    try {
      const r = DEMO ? await desk.upload("ask/uploads", fd) : await api.uploadWithProgress("ask/uploads", fd, (p) => { f.p = p; drawFiles(); });
      f.uuid = r.uuid; f.state = "done";
    } catch (ex) { f.state = "err"; toast(`${f.name}: ${ex.message || "upload failed"}`, "err"); }
    drawFiles();
  }
  filesEl.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rm]"), sw = e.target.closest("[data-slot]"), rt = e.target.closest("[data-retry]");
    if (rm) { const f = files.splice(+rm.dataset.rm, 1)[0]; if (f?.uuid) desk.del(`ask/uploads/${f.uuid}`).catch(() => {}); drawFiles(); }
    if (sw) { const f = files[+sw.dataset.slot]; f.slot = f.slot === "photo" ? "paper" : "photo"; f.doc_type = f.doc_type || "rc"; uploadOne(f); }
    if (rt) uploadOne(files[+rt.dataset.retry]);
  });
  filesEl.addEventListener("change", (e) => { const s = e.target.closest("[data-paper]"); if (s) { const f = files[+s.dataset.paper]; f.doc_type = s.value; uploadOne(f); } });
  $("#ask-clip")?.addEventListener("click", () => $("#ask-file").click());
  $("#ask-file")?.addEventListener("change", async (e) => {
    for (const raw of e.target.files || []) {
      const isPdf = raw.type === "application/pdf" || /\.pdf$/i.test(raw.name);
      if (!isPdf && !/^image\/(jpeg|png|webp)$/.test(raw.type)) { toast(`${raw.name}: photos (JPEG, PNG, WebP) or PDF papers only. HEIC: set the camera to Most Compatible.`, "err"); continue; }
      const blob = isPdf ? raw : await shrink(raw);
      if (blob.size > 15 * MB) { toast(`${raw.name} is too big.`, "err"); continue; }
      const f = { name: raw.name, blob, mime: isPdf ? "application/pdf" : "image/jpeg", slot: isPdf ? "paper" : "photo", doc_type: isPdf ? "rc" : null,
        thumb: isPdf ? null : URL.createObjectURL(blob), state: "up" };
      files.push(f); drawFiles(); uploadOne(f);
    }
    e.target.value = "";
  });
  onWindow("beforeunload", (e) => { if (files.some((f) => f.state === "up")) { e.preventDefault(); e.returnValue = ""; } });

  // ------------------------------------------------------------------ sending
  function grow() { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, /^\s*(new car|car sold|sold car|edit car)\b/i.test(ta.value) ? 8 * 22 + 24 : 160) + "px"; }
  function saveDraft() { safeStore(DRAFT_KEY, ta.value.split("\n").filter((l) => !MONEY_LINE.test(l)).join("\n").slice(0, 8000)); }
  ta.addEventListener("input", () => { grow(); saveDraft(); });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches && !/^\s*(new car|car sold|sold car|edit car)\b/i.test(ta.value)) { e.preventDefault(); $("#ask-form").requestSubmit(); } });
  $("#ask-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const text = ta.value.trim();
    if (files.some((f) => f.state === "up")) { toast("Wait for the photos to finish.", "err"); return; }
    const ups = files.filter((f) => f.state === "done").map((f) => f.uuid);
    if (!text && !ups.length) { ta.focus(); return; }
    busy = true;
    const btn = e.currentTarget.querySelector(".send-btn");
    btn.disabled = true;
    try {
      await desk.post("ask/messages", { text, client_id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, upload_uuids: ups });
      ta.value = ""; grow(); safeStore(DRAFT_KEY, ""); files = []; drawFiles();
      await load();
      window.scrollTo(0, document.documentElement.scrollHeight);
    } catch (ex) { toast(ex.message || "Could not send. Try again.", "err"); }
    btn.disabled = false; busy = false;
  });
  $("#ask-new").addEventListener("click", async () => {
    try { await desk.post("ask/threads", {}); data = null; first = true; await load(); } catch (ex) { toast(ex.message || "Could not start a new chat.", "err"); }
  });

  const draft = safeStore(DRAFT_KEY);
  if (draft) { ta.value = draft; grow(); }
  onFeed((r) => { if (r.kind === "ask.updated") load(true); });
  every(1500, () => { if (data?.pending_turn && document.visibilityState === "visible") load(true); });
  every(15000, () => { if (!data?.pending_turn && document.visibilityState === "visible") load(true); });
  await load();
}

function paperName(k) { return (PAPERS.find(([x]) => x === k) || [k, String(k || "Paper").replace(/_/g, " ")])[1]; }
function cardIcon(c) { return { readback: "car", edit: "edit", status: "flag", website_only: "globe", sold_format: "tag", car: "car", money: "lock", deal_money: "wallet", contact: "phone", ids: "key", notice: "info" }[c.type] || "spark"; }
/** Only the app's own hash routes are followed from a card. */
function safeHash(h) { return /^#\/[\w/?=&.-]*$/.test(h || "") ? h : "#/ask"; }
