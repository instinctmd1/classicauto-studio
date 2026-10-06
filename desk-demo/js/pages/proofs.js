// Screenshots to check (classic-auto/accountability-6oct/ACCOUNTABILITY-SPEC.md 4.4). One call-history screenshot per
// screen, oldest first: the image large (tap to zoom), the lead, the salesman, the times and the simple checks, then
// Approve, Reject or Waive as large buttons, and the next one loads. The engine refuses a check of your own seat.
import { esc, icon } from "../util.js";
import { openDrawer, pageHead, toast, formDrawer } from "../ui.js";
import * as desk from "../desk-api.js";
import { deskAgo, deskTime, onFeed } from "../desk.js";
import { CHECKS, OUTCOMES, accOn, fmtDur, outcomeLabel } from "./_acc.js";

export async function render(ctx) {
  ctx.root.innerHTML = `${pageHead({ title: "Screenshots to check", sub: "Call-history proof that the salesman really called. Check the number's last digits, the time and the duration." })}<div id="pq"></div>`;
  const host = ctx.root.querySelector("#pq");
  if (!accOn()) { host.innerHTML = `<div class="empty">${icon("image", "")}<b>Call accountability is off</b><p>Screenshots to check show here once the owners switch it on.</p></div>`; return; }
  let queue = [], i = 0, outcomes = OUTCOMES;
  try { const s = await desk.get("acc/settings"); if (Array.isArray(s.brief_outcomes) && s.brief_outcomes.length) outcomes = s.brief_outcomes; } catch { /* the built-in list */ }

  async function load() {
    host.innerHTML = `<div class="skel card h420"></div>`;
    try { queue = (await desk.get("acc/review")).data || []; }
    catch (e) {
      if (!ctx.alive()) return;
      host.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>The screenshots could not load.</b><span class="muted">${esc(e.status === 503 ? "The lead engine is not answering. Try again in a minute." : e.message || "")}</span></div><button class="btn" type="button" id="pq-retry">${icon("refresh")}Try again</button></div>`;
      host.querySelector("#pq-retry").addEventListener("click", load);
      return;
    }
    if (!ctx.alive()) return;
    i = 0;
    paint();
  }

  function paint() {
    if (!queue.length) {
      host.innerHTML = `<div class="empty pq-empty">${icon("check", "")}<b>Nothing to check</b><p>New screenshots land here as the salesmen send them. You get a notification too.</p></div>`;
      return;
    }
    if (i >= queue.length) i = 0;
    const p = queue[i];
    const fails = Object.entries(p.checks || {}).filter(([, v]) => v === false).map(([k]) => k);
    const chips = Object.entries(p.checks || {}).map(([k, v]) => `<span class="badge ${v === false ? "neg" : "pos"}">${icon(v === false ? "x" : "check", "")}${esc(CHECKS[k] || k)}</span>`).join("");
    host.innerHTML = `<div class="pq-top"><span class="pq-count"><b>${i + 1}</b> of ${queue.length}</span>${queue.length > 1 ? `<button class="btn sm ghost" type="button" data-skip>${icon("right")}Skip for now</button>` : ""}</div>
      <article class="pq-card rise">
        <button class="pq-img" type="button" data-zoom aria-label="Zoom the screenshot">${p.image_url ? `<img src="${esc(p.image_url)}" alt="Call-history screenshot for lead ${+p.lead_id}">` : `<span class="pq-none">${icon("image", "")}Image not available</span>`}<span class="pq-zoom">${icon("search", "")}Tap to zoom</span></button>
        <div class="pq-info">
          <div class="pq-lead"><a href="#/lead/${+p.lead_id}">Lead #${+p.lead_id}</a><span class="badge">${esc(p.seat || "")}</span>${p.late ? `<span class="badge warn">Sent late</span>` : ""}</div>
          <h2 class="pq-name">${esc(p.customer || "Customer")}</h2>
          <p class="pq-phone">${icon("phone", "")}<span>${esc(p.phone || p.phone_last4 || "No number")}</span><small>${p.phone ? "" : "Match these last digits on the screenshot"}</small></p>
          <dl class="dl pq-dl">
            <div><dt>Call pressed</dt><dd>${p.first_call_at ? esc(deskTime(p.first_call_at)) : "Not in the app"}</dd></div>
            <div><dt>Screenshot says</dt><dd>${p.declared_call_at ? esc(deskTime(p.declared_call_at)) : "—"} · ${esc(fmtDur(p.declared_duration_s))}</dd></div>
            <div><dt>Brief</dt><dd>${esc(outcomeLabel(p.brief_outcome, outcomes) || "Not filled yet")}</dd></div>
            <div><dt>Sent</dt><dd>${esc(deskAgo(p.submitted_at))}</dd></div>
          </dl>
          ${chips ? `<div class="chips pq-checks" aria-label="Checks">${chips}</div>` : ""}
          ${fails.length ? `<p class="pq-warn">${icon("alert", "")}Look closely: ${fails.length} check${fails.length === 1 ? "" : "s"} did not pass.</p>` : ""}
          <div class="pq-acts">
            <button class="btn pos big-btn" type="button" data-dec="approve">${icon("check")}Approve</button>
            <button class="btn danger big-btn" type="button" data-dec="reject">${icon("x")}Reject</button>
            <button class="btn big-btn" type="button" data-dec="waive">${icon("info")}Waive</button>
          </div>
        </div>
      </article>`;
  }

  async function decide(decision, note = null) {
    const p = queue[i];
    const btns = host.querySelectorAll("[data-dec]");
    btns.forEach((b) => { b.disabled = true; });
    try {
      await desk.post(`acc/proofs/${+p.proof_id}/review`, { decision, note });
      desk.done(decision === "approve" ? "Approved" : decision === "reject" ? "Rejected: the salesman is told" : "Waived");
      queue.splice(i, 1);
      paint();
    } catch (e) {
      btns.forEach((b) => { b.disabled = false; });
      if (e.code === "own_seat") toast("This screenshot is from your own seat. Someone else checks it.", "err");
      else if (e.code === "already_decided") { toast("Someone already checked this one.", ""); queue.splice(i, 1); paint(); }
      else toast(e.message || "Could not save that.", "err");
    }
  }

  function reason(decision) {
    const f = formDrawer({ title: decision === "reject" ? "Reject the screenshot" : "Waive the screenshot", ok: "",
      sub: decision === "reject" ? "The salesman gets a warning and can send a clearer one." : "No screenshot needed for this call, for example the customer walked in or it was a live transfer.",
      submit: decision === "reject" ? "Reject" : "Waive", danger: decision === "reject",
      fields: [{ name: "note", label: "Reason", type: "textarea", required: true, full: true, hint: "5 to 200 letters. The salesman sees it.",
        placeholder: decision === "reject" ? "e.g. The number is cut off; send the full call log" : "e.g. Customer came to the showroom" }],
      onSubmit: async (v) => {
        const note = (v.note || "").trim();
        if (note.length < 5 || note.length > 200) { const e = new Error("5 to 200 letters."); e.fields = { note: "5 to 200 letters." }; throw e; }
        setTimeout(() => decide(decision, note), 0);
      } });
    f.el.classList.add("sheet");
  }

  host.addEventListener("click", (e) => {
    const dec = e.target.closest("[data-dec]");
    if (dec) { const k = dec.dataset.dec; if (k === "approve") decide("approve"); else reason(k); return; }
    if (e.target.closest("[data-skip]")) { i = (i + 1) % queue.length; paint(); return; }
    if (e.target.closest("[data-zoom]")) {
      const p = queue[i]; if (!p?.image_url) return;
      openDrawer({ title: `Lead #${+p.lead_id} · ${p.seat || ""}`, wide: true, body: `<div class="pq-full"><img src="${esc(p.image_url)}" alt="Call-history screenshot, full size"></div>` }).el.classList.add("sheet", "pq-sheet");
    }
  });
  onFeed((row) => { if (row.kind === "lead.changed" && /^proof_/.test(row.why || "") && !host.querySelector(".pq-card")) load(); });
  await load();
}
