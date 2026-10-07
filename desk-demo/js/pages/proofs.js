// Screenshots to check (classic-auto/accountability-6oct/ACCOUNTABILITY-SPEC.md 4.4, SPEC-SCREENSHOT-AI.md 2.10). One
// call-history screenshot per screen, the ones that look wrong first: the image large (tap to zoom) with the AI's tick
// right under it, the lead, the salesman, the times and the simple checks, then Approve, Reject or Waive as large buttons,
// and the next one loads. The engine refuses a check of your own seat. The Checked tab lists the last proofs in any state
// with their tick and who decided (or "auto"), so the ticks of automatic approvals and Exotel calls show too.
import { esc, icon } from "../util.js";
import { bindTabs, openDrawer, pageHead, tabsHtml, toast, formDrawer } from "../ui.js";
import * as desk from "../desk-api.js";
import { deskAgo, deskTime, onFeed } from "../desk.js";
import { CHECKS, OUTCOMES, PROOF_STATE, VERDICT_SHORT, accOn, flagChip, fmtDur, outcomeLabel, shows, tickChip } from "./_acc.js";

export async function render(ctx) {
  let tab = ctx.query.get("tab") === "checked" ? "checked" : "check";
  ctx.root.innerHTML = `${pageHead({ title: "Screenshots to check", sub: "Call-history proof that the salesman really called. The app reads the number, time and duration. You decide." })}
    ${accOn() ? tabsHtml([{ id: "check", label: "To check", icon: "image" }, { id: "checked", label: "Checked", icon: "check" }], tab, "Screenshots") : ""}<div id="pq"></div>`;
  const host = ctx.root.querySelector("#pq");
  if (!accOn()) { host.innerHTML = `<div class="empty">${icon("image", "")}<b>Call accountability is off</b><p>Screenshots to check show here once the owners switch it on.</p></div>`; return; }
  let queue = [], i = 0, outcomes = OUTCOMES, done = [], filt = { seat: "", verdict: "" };
  try { const s = await desk.get("acc/settings"); if (Array.isArray(s.brief_outcomes) && s.brief_outcomes.length) outcomes = s.brief_outcomes; } catch { /* the built-in list */ }

  bindTabs(ctx.root, (t) => { tab = t; history.replaceState(null, "", `#/proofs${t === "checked" ? "?tab=checked" : ""}`); t === "checked" ? loadChecked() : load(); });

  async function load(quiet = false, keep = null) {
    if (!quiet) host.innerHTML = `<div class="skel card h420"></div>`;
    try { queue = (await desk.get("acc/review", null, quiet ? { background: true } : {})).data || []; }
    catch (e) {
      if (!ctx.alive() || tab !== "check") return;
      if (quiet) return;
      host.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>The screenshots could not load.</b><span class="muted">${esc(e.status === 503 ? "The lead engine is not answering. Try again in a minute." : e.message || "")}</span></div><button class="btn" type="button" id="pq-retry">${icon("refresh")}Try again</button></div>`;
      host.querySelector("#pq-retry").addEventListener("click", () => load());
      return;
    }
    if (!ctx.alive() || tab !== "check") return;
    const at = keep ? queue.findIndex((x) => x.proof_id === keep) : -1;
    i = at >= 0 ? at : 0;
    paint();
  }

  function paint() {
    if (!queue.length) {
      host.innerHTML = `<div class="empty pq-empty">${icon("check", "")}<b>Nothing to check</b><p>New screenshots land here as the salesmen send them. You get a notification too.</p></div>`;
      return;
    }
    if (i >= queue.length) i = 0;
    const p = queue[i], t = p.tick || null;
    const fails = Object.entries(p.checks || {}).filter(([, v]) => v === false).map(([k]) => k);
    const chips = Object.entries(p.checks || {}).map(([k, v]) => `<span class="badge ${v === false ? "neg" : "pos"}">${icon(v === false ? "x" : "check", "")}${esc(CHECKS[k] || k)}</span>`).join("");
    const first = queue.filter((x) => x.tick && x.tick.rank === 0).length;
    const line = shows(t);
    host.innerHTML = `<div class="pq-top"><span class="pq-count"><b>${i + 1}</b> of ${queue.length}${first ? ` <span class="badge neg">${first} to check first</span>` : ""}</span>${queue.length > 1 ? `<button class="btn sm ghost" type="button" data-skip>${icon("right")}Skip for now</button>` : ""}</div>
      <article class="pq-card rise${t && t.rank === 0 ? " look-first" : ""}">
        <div class="pq-media">
          <button class="pq-img" type="button" data-zoom aria-label="Zoom the screenshot">${p.image_url ? `<img src="${esc(p.image_url)}" alt="Call-history screenshot for lead ${+p.lead_id}">` : `<span class="pq-none">${icon("image", "")}Image not available</span>`}<span class="pq-zoom">${icon("search", "")}Tap to zoom</span></button>
          ${t ? `<div class="pq-tick" aria-label="What the app read">${tickChip(t, { big: true })}${flagChip(t, { big: true })}</div>${line ? `<p class="pq-shows">${esc(line)}</p>` : ""}` : ""}
        </div>
        <div class="pq-info">
          <div class="pq-lead"><a href="#/lead/${+p.lead_id}">Lead #${+p.lead_id}</a><span class="badge">${esc(p.seat || "")}</span>${p.late ? `<span class="badge warn">Sent late</span>` : ""}</div>
          <h2 class="pq-name">${esc(p.customer || "Customer")}</h2>
          <p class="pq-phone">${icon("phone", "")}<span>${esc(p.phone || p.phone_last4 || "No number")}</span><small>${p.phone ? "" : "Match these last digits on the screenshot"}</small></p>
          <dl class="dl pq-dl">
            <div><dt>Call pressed</dt><dd>${p.first_call_at ? esc(deskTime(p.first_call_at)) : "Not in the app"}</dd></div>
            <div><dt>Salesman typed</dt><dd>${p.declared_call_at ? esc(deskTime(p.declared_call_at)) : "—"} · ${esc(fmtDur(p.declared_duration_s))}</dd></div>
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

  // ---------------------------------------------------------------- the Checked tab
  async function loadChecked() {
    host.innerHTML = `<div class="skel card h160"></div>`;
    let r;
    try { r = await desk.get("acc/proofs", Object.fromEntries(Object.entries(filt).filter(([, v]) => v))); }
    catch (e) {
      if (!ctx.alive() || tab !== "checked") return;
      host.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>The checked screenshots could not load.</b><span class="muted">${esc(e.status === 503 ? "The lead engine is not answering. Try again in a minute." : e.message || "")}</span></div><button class="btn" type="button" id="pc-retry">${icon("refresh")}Try again</button></div>`;
      host.querySelector("#pc-retry").addEventListener("click", loadChecked);
      return;
    }
    if (!ctx.alive() || tab !== "checked") return;
    done = r.data || [];
    const seats = [...new Set([filt.seat, ...done.map((x) => x.seat)].filter(Boolean))].sort();
    const who = (x) => (x.reviewed_by === "auto" ? "Approved by itself" : x.reviewed_by ? `${PROOF_STATE[x.state]?.[0] || x.state} by ${x.reviewed_by}` : (PROOF_STATE[x.state] || [x.state])[0]);
    host.innerHTML = `<div class="pc-bar"><div class="field"><label for="pc-seat">Salesman</label><select class="select" id="pc-seat" data-f="seat"><option value="">Everyone</option>${seats.map((s) => `<option${s === filt.seat ? " selected" : ""}>${esc(s)}</option>`).join("")}</select></div>
        <div class="field"><label for="pc-v">What the app read</label><select class="select" id="pc-v" data-f="verdict"><option value="">Any</option>${Object.entries(VERDICT_SHORT).map(([k, l]) => `<option value="${esc(k)}"${k === filt.verdict ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div></div>
      ${done.length ? `<ol class="pc-list">${done.map((x) => `<li class="pc-row"><a class="pc-thumb" href="#/lead/${+x.lead_id}" aria-label="Lead ${+x.lead_id}">${x.image_url ? `<img src="${esc(x.image_url)}" alt="" loading="lazy">` : icon(x.tick?.source === "exotel" ? "phone" : "image", "")}</a>
          <div class="pc-main"><div class="pc-top"><a href="#/lead/${+x.lead_id}"><b>Lead #${+x.lead_id}</b></a><span class="badge">${esc(x.seat || "")}</span><time>${esc(deskTime(x.submitted_at))}</time></div>
            <div class="pc-chips">${x.tick ? tickChip(x.tick) + flagChip(x.tick) : `<span class="badge">${x.state === "missed" || x.state === "waived" ? "No screenshot" : "Read by eye"}</span>`}</div>
            <p class="muted">${esc(who(x))}${x.customer ? ` · ${esc(x.customer)}` : ""}${x.phone_last4 ? ` · ${esc(x.phone_last4)}` : ""}</p></div></li>`).join("")}</ol>${r.total > done.length ? `<p class="muted small-note">The newest ${done.length} of ${r.total}.</p>` : ""}`
        : `<div class="empty">${icon("image", "")}<b>Nothing checked yet</b><p>Screenshots show here once they are approved, rejected, waived or verified by the call record.</p></div>`}`;
    host.querySelectorAll("[data-f]").forEach((s) => s.addEventListener("change", () => { filt[s.dataset.f] = s.value; loadChecked(); }));
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
    if (tab !== "check") return;
    const dec = e.target.closest("[data-dec]");
    if (dec) { const k = dec.dataset.dec; if (k === "approve") decide("approve"); else reason(k); return; }
    if (e.target.closest("[data-skip]")) { i = (i + 1) % queue.length; paint(); return; }
    if (e.target.closest("[data-zoom]")) {
      const p = queue[i]; if (!p?.image_url) return;
      openDrawer({ title: `Lead #${+p.lead_id} · ${p.seat || ""}`, wide: true, body: `<div class="pq-full"><img src="${esc(p.image_url)}" alt="Call-history screenshot, full size"></div>` }).el.classList.add("sheet", "pq-sheet");
    }
  });
  onFeed((row) => {
    if (row.kind !== "lead.changed" || !/^proof_/.test(row.why || "")) return;
    if (tab === "checked") return;
    const cur = queue[i];
    if (!host.querySelector(".pq-card")) load();
    // the AI's verdict arrived (or the queue order changed): refresh quietly, keeping this screenshot in view
    else if (row.why === "proof_ai" || row.why === "proof_submitted") load(true, cur?.proof_id);
  });
  tab === "checked" ? await loadChecked() : await load();
}
