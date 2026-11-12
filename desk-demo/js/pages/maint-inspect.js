// Maintenance: the inspection wizard. One step per section of GET maint/inspection-template, then the photo set, then review.
// Every answer is saved as it is given (a debounced PATCH, kept on the phone until the server has it), so a bad network loses nothing.
// #/maint-inspect/<inspection id>
import { can } from "../state.js";
import { applyDyn, debounce, esc, icon, mount, safeStore } from "../util.js";
import { confirmDialog } from "../ui.js";
import { openSheet } from "../desk.js";
import { bindZoom, camBtn, errBox, failToast, io, onFiles, sendFile, thumb } from "./_maint.js";

const OPT = {
  condition: [["good", "Good"], ["minor", "Minor"], ["major", "Major"], ["na", "N/A"]],
  working: [["working", "Working"], ["not_working", "Not working"], ["na", "N/A"]],
  tread: [["gt70", "Above 70%"], ["40to70", "40 to 70%"], ["lt40", "Below 40%"], ["na", "N/A"]],
  yesno: [["yes", "Yes"], ["no", "No"]],
};
const WORD = { good: "Good", minor: "Minor", major: "Major", na: "Not applicable", working: "Working", not_working: "Not working", gt70: "Above 70%", "40to70": "40 to 70%", lt40: "Below 40%", yes: "Yes", no: "No" };
const BAD = new Set(["minor", "major", "not_working", "lt40"]);
const isBad = (it, v) => BAD.has(v) || (!!it.bad_if_yes && v === "yes");
const tone = (it, v) => (v === "na" ? "" : isBad(it, v) ? (v === "minor" ? "warn" : "neg") : v === "40to70" ? "info" : v === "yes" || v === "no" ? "pos" : "pos");
const optsOf = (it) => (Array.isArray(it.options) && it.options.length ? it.options.map((o) => (Array.isArray(o) ? o : [o, WORD[o] || String(o).replace(/_/g, " ")])) : OPT[it.type] || null);
const RATED = (it) => ["condition", "working", "tread", "yesno"].includes(it.type);

export async function render(ctx) {
  const id = +ctx.id;
  let tpl, insp;
  try { [tpl, insp] = await Promise.all([io.get("maint/inspection-template"), io.get(`maint/inspections/${id}`).then((r) => r.inspection || r)]); }
  catch (e) { ctx.root.innerHTML = errBox(e.message, "Could not open this inspection."); return; }
  if (!ctx.alive()) return;
  if (insp.status === "final" || !can("maint.inspect")) { location.replace(`#/maint-report/${id}`); return; }

  insp.items ||= {}; insp.photos ||= {};
  const steps = [{ k: "basics", t: "The car" }, ...tpl.sections.map((s) => ({ k: "section", t: s.title, s })), { k: "photos", t: "Photos" }, { k: "review", t: "Review and finish" }];
  let step = Math.min(steps.length - 1, Math.max(0, +ctx.query.get("s") || 0));
  const failed = [];                                         // photos that did not go: {key, file, slot?, item?, error}

  // ---------------------------------------------------------------- autosave
  const PKEY = `ca.maint.p.${id}`;
  let pend = {}, inflight = false, again = false, retryT = null, status = "saved";
  try { const old = JSON.parse(safeStore(PKEY) || "null"); if (old && typeof old === "object") pend = old; } catch { pend = {}; }
  const merge = (a, b) => { // b over a
    const o = { ...a, ...b };
    if (a.items || b.items) { o.items = { ...(a.items || {}) }; for (const [k, v] of Object.entries(b.items || {})) o.items[k] = { ...(o.items[k] || {}), ...v }; }
    return o;
  };
  const apply = (p) => { // show pending answers on the screen state as well
    ["odometer", "remarks", "date"].forEach((k) => { if (p[k] !== undefined) insp[k] = p[k]; });
    for (const [k, v] of Object.entries(p.items || {})) insp.items[k] = { photos: [], ...(insp.items[k] || {}), ...v };
  };
  apply(pend);
  const empty = () => !Object.keys(pend).length;
  const persist = () => safeStore(PKEY, empty() ? null : JSON.stringify(pend));
  const setStatus = (s) => { status = s; const n = ctx.root.querySelector("#save-st"); if (n) { n.className = "mt-save " + s; n.innerHTML = s === "saved" ? `${icon("check", "")}Saved` : s === "saving" ? `<span class="spin"></span>Saving…` : `${icon("alert", "")}Not saved yet. Trying again…`; } };
  async function flush() {
    if (inflight) { again = true; return; }
    if (empty()) { setStatus("saved"); return; }
    clearTimeout(retryT);
    const snap = pend; pend = {}; persist(); inflight = true; setStatus("saving");
    try { await io.patch(`maint/inspections/${id}`, snap); setStatus(empty() ? "saved" : "saving"); }
    catch (e) {
      pend = merge(snap, pend); persist(); setStatus("error");
      if (e.status && e.status < 500 && e.status !== 0 && e.status !== 408 && e.status !== 429) failToast(e);           // a refusal will not get better by retrying
      else retryT = setTimeout(flush, 6000);
    } finally { inflight = false; if (again || (!empty() && status !== "error")) { again = false; flushSoon(); } }
  }
  const flushSoon = debounce(flush, 600);
  const queue = (p) => { pend = merge(pend, p); apply(p); persist(); setStatus("saving"); flushSoon(); };
  const live = () => ctx.alive();
  const onOnline = () => { if (!live()) return window.removeEventListener("online", onOnline); flush(); };
  const onHide = () => { if (!live()) return document.removeEventListener("visibilitychange", onHide); if (document.visibilityState === "hidden") flush(); };
  const onLeave = (e) => { if (!live()) return window.removeEventListener("beforeunload", onLeave); if (!empty() || inflight) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("online", onOnline); document.addEventListener("visibilitychange", onHide); window.addEventListener("beforeunload", onLeave);
  if (!empty()) flushSoon();

  // ---------------------------------------------------------------- counts
  const allItems = () => tpl.sections.flatMap((s) => s.items.filter(RATED).map((it) => ({ s, it })));
  const val = (k) => insp.items[k]?.value;
  const rated = (s) => s.items.filter(RATED).filter((it) => val(it.key) != null && val(it.key) !== "").length;
  const ratedTotal = (s) => s.items.filter(RATED).length;
  const bads = () => allItems().filter(({ it }) => isBad(it, val(it.key)));
  const slotsDone = () => tpl.photo_slots.filter((p) => insp.photos[p.key]).length;
  const missing = () => {
    const m = [];
    if (insp.odometer == null || insp.odometer === "") m.push({ s: 0, text: "Odometer reading" });
    tpl.sections.forEach((s, i) => {
      const un = s.items.filter(RATED).filter((it) => val(it.key) == null || val(it.key) === "");
      if (un.length) m.push({ s: i + 1, text: `${s.title}: ${un.length} not rated` });
      s.items.filter(RATED).filter((it) => isBad(it, val(it.key))).forEach((it) => {
        const x = insp.items[it.key] || {};
        if (!(x.note || "").trim() || !(x.photos || []).length) m.push({ s: i + 1, text: `${it.label}: add ${!(x.note || "").trim() && !(x.photos || []).length ? "a note and a photo" : !(x.note || "").trim() ? "a note" : "a photo"}` });
      });
    });
    const sl = tpl.photo_slots.filter((p) => !insp.photos[p.key]);
    if (sl.length) m.push({ s: tpl.sections.length + 1, text: `${sl.length} required ${sl.length === 1 ? "photo" : "photos"} still to take` });
    return m;
  };

  // ---------------------------------------------------------------- the shell: header, step, footer
  const shell = () => mount(ctx.root, `<div class="mt-wiz">
    <div class="mt-wiz-t"><a class="crumbs mt-back" href="#/maint/${insp.car_id}">${icon("left", "")}Save and leave</a><b>${esc(insp.stock_no || "")}</b><span>${esc(insp.title || "")}</span></div>
    <header class="mt-wiz-h"><div class="mt-wiz-p"><span class="mt-step-l" id="step-l"></span><span id="save-st" class="mt-save saved" role="status" aria-live="polite"></span><button type="button" class="btn sm" id="steps-btn" aria-haspopup="dialog">All steps</button></div>
      <div class="meter mt-wiz-m" role="progressbar" aria-valuemin="0" aria-valuemax="${steps.length}" id="wiz-m"><i></i></div></header>
    <main class="mt-wiz-b" id="body" tabindex="-1"></main>
    <footer class="mt-wiz-f"><button type="button" class="btn mt-big" id="prev">${icon("left")}Back</button><button type="button" class="btn primary mt-big" id="next">Next${icon("right")}</button></footer></div>`);
  shell();
  setStatus(empty() ? "saved" : "saving");
  const body = ctx.root.querySelector("#body"), prev = ctx.root.querySelector("#prev"), next = ctx.root.querySelector("#next");

  const chrome = () => {
    const s = steps[step];
    ctx.root.querySelector("#step-l").textContent = `Step ${step + 1} of ${steps.length}`;
    const m = ctx.root.querySelector("#wiz-m"); m.setAttribute("aria-valuenow", String(step + 1)); m.querySelector("i").dataset.w = Math.round(((step + 1) / steps.length) * 100); applyDyn(m);
    prev.disabled = step === 0;
    const last = step === steps.length - 1;
    next.hidden = last;
    if (!last) next.innerHTML = `${esc(steps[step + 1].k === "review" ? "Review" : steps[step + 1].t)}${icon("right")}`;
    next.setAttribute("aria-label", last ? "" : `Next step: ${steps[step + 1].t}`);
    history.replaceState(history.state, "", `#/maint-inspect/${id}?s=${step}`);
    document.title = `${s.t} · Inspection · Classic Auto`;
  };

  // ---- step: the car
  const basics = () => `<h1 class="mt-h">The car</h1><p class="hint">Check the details, then go section by section. Answers are saved as you go.</p>
    <div class="form-grid mt-basics"><div class="field"><label for="odo">Odometer (km)</label><input class="input big num" id="odo" inputmode="numeric" autocomplete="off" value="${esc(insp.odometer ?? "")}" placeholder="For example 48200"></div>
      <div class="field"><label for="dt">Date of inspection</label><input class="input big" id="dt" type="date" value="${esc((insp.date || "").slice(0, 10))}"></div></div>
    <p class="mt-tip">${icon("info", "")}<span>Have the RC, insurance and PUC in hand. Stand the car on level ground, bonnet and boot unlocked, with the keys.</span></p>`;

  // ---- step: one section
  const itemHtml = (it) => {
    const x = insp.items[it.key] || {}, v = x.value, o = optsOf(it);
    let ctl;
    if (o) ctl = `<div class="mt-rate n${o.length}${o.some(([, l]) => l.length > 8) ? " long" : ""}" role="group" aria-label="${esc(it.label)}">${o.map(([k, l]) => `<button type="button" class="mt-opt ${tone(it, k)}" aria-pressed="${v === k}" data-v="${esc(k)}">${v === k ? icon("check", "") : ""}${esc(l)}</button>`).join("")}</div>`;
    else if (it.type === "number") ctl = `<input class="input big num" inputmode="decimal" data-f="${esc(it.key)}" aria-label="${esc(it.label)}" value="${esc(v ?? "")}" autocomplete="off">`;
    else if (it.type === "date") ctl = `<input class="input big" type="date" data-f="${esc(it.key)}" aria-label="${esc(it.label)}" value="${esc(v ?? "")}">`;
    else ctl = `<input class="input big" data-f="${esc(it.key)}" aria-label="${esc(it.label)}" value="${esc(v ?? "")}" autocomplete="off" maxlength="120">`;
    const bad = RATED(it) && isBad(it, v);
    const photos = x.photos || [];
    const fail = failed.filter((f) => f.item === it.key);
    return `<fieldset class="mt-item${bad ? " bad" : ""}" data-item="${esc(it.key)}"><legend>${esc(it.label)}</legend>${ctl}
      ${bad ? `<div class="mt-bad"><div class="field"><label for="n-${esc(it.key)}">What is wrong? <span class="req" aria-hidden="true">*</span></label><textarea class="textarea" id="n-${esc(it.key)}" data-note="${esc(it.key)}" rows="2" placeholder="Say it in a few words, for example: scratch about 10 cm on the left door">${esc(x.note || "")}</textarea></div>
        <div class="mt-evs">${photos.map((p) => thumb(p.url, "Photo")).join("")}${fail.map((f) => `<div class="mt-ev wait bad"><span>${esc(f.error)}</span><button type="button" class="btn sm" data-retry="${f.key}">Try again</button></div>`).join("")}</div>
        ${camBtn({ label: photos.length ? "Add another photo" : "Photo of the problem", attrs: `data-item-photo="${esc(it.key)}"`, cls: photos.length ? "sm" : "" })}</div>` : ""}</fieldset>`;
  };
  const sectionStep = (s, i) => {
    const r = rated(s), t = ratedTotal(s), quick = s.items.some((it) => it.type === "condition" || it.type === "working");
    return `<h1 class="mt-h">${esc(s.title)}</h1>
      <div class="mt-sec-bar"><span class="mt-rcount" id="rc">${t ? `${r} of ${t} rated` : "Fill in the details"}</span>${quick && r < t ? `<button type="button" class="btn sm" data-allgood>${icon("check")}Mark unrated items Good</button>` : ""}</div>
      ${s.items.map(itemHtml).join("")}`;
  };

  // ---- step: photos
  const photosStep = () => {
    const slotLi = (p) => {
      const ph = insp.photos[p.key], fail = failed.find((f) => f.slot === p.key);
      return `<li class="slot${ph ? " has" : ""}">${ph ? `<button type="button" class="mt-slot-img" data-zoom="${esc(ph.url)}" data-cap="${esc(p.label)}" aria-label="Open the photo: ${esc(p.label)}"><img src="${esc(ph.url)}" alt="" loading="lazy"></button>` : `<span class="slot-ph">${icon("camera")}</span>`}
        <span class="slot-l">${esc(p.label)}</span>${fail ? `<span class="err">${esc(fail.error)}</span><button type="button" class="btn sm" data-retry="${fail.key}">Try again</button>` : camBtn({ label: ph ? "Retake" : "Take photo", attrs: `data-slot="${esc(p.key)}"`, cls: "sm" })}</li>`;
    };
    const n = slotsDone(), tot = tpl.photo_slots.length;
    return `<h1 class="mt-h">Photos</h1><p class="hint">Take each photo as the label says. Stand back so the whole part is in the frame.</p>
      <div class="ph-progress"><span class="meter"><i data-w="${Math.round((n / Math.max(1, tot)) * 100)}"></i></span><b>${n} of ${tot} photos</b></div>
      <ul class="slots mt-slots">${tpl.photo_slots.map(slotLi).join("")}</ul>`;
  };

  // ---- step: review
  const reviewStep = (serverMissing) => {
    const m = missing(), b = bads(), n = slotsDone();
    const list = serverMissing && serverMissing.length ? serverMissing : null;
    return `<h1 class="mt-h">Review and finish</h1>
      <dl class="dl dl-3 mt-sum"><div><dt>Rated</dt><dd class="big">${allItems().filter(({ it }) => val(it.key) != null && val(it.key) !== "").length}/${allItems().length}</dd></div><div><dt>Need attention</dt><dd class="big">${b.length}</dd></div><div><dt>Photos</dt><dd class="big">${n}/${tpl.photo_slots.length}</dd></div></dl>
      ${b.length ? `<div class="sec"><div class="sec-h"><h3>Will become open issues</h3></div><ul class="mt-flist">${b.map(({ s, it }) => `<li><b>${esc(it.label)}</b><span>${esc(WORD[val(it.key)] || val(it.key))} · ${esc(s.title)}</span></li>`).join("")}</ul></div>` : ""}
      <div class="field sec"><label for="rem">Remarks <span class="faint">(optional)</span></label><textarea class="textarea" id="rem" rows="3" placeholder="Anything a buyer or the owner should know about this car">${esc(insp.remarks || "")}</textarea></div>
      <div id="miss" class="sec">${list ? missingBox(list, "Still to do") : m.length ? missingBox(m.map((x) => x), "Still to do") : `<p class="mt-ok">${icon("check", "")}<span>Everything is filled in. Finish to get the score and the report.</span></p>`}</div>
      <button type="button" class="btn primary mt-big mt-fin" id="fin">${icon("shieldcheck")}Finish inspection</button>
      <p class="hint">Finishing works out the score, turns every item that needs attention into an open issue on the car, and locks the answers.</p>`;
  };
  // A line from the server is matched to the step it belongs to by its first words, so it can be a jump link too.
  const stepFor = (t) => { const i = tpl.sections.findIndex((s) => t.startsWith(s.title)); return i >= 0 ? i + 1 : /^odometer/i.test(t) ? 0 : /^photos?|required photos?/i.test(t) ? tpl.sections.length + 1 : null; };
  const missingBox = (list, head) => `<div class="callout warn mt-miss">${icon("alert", "")}<div><b>${esc(head)}</b><ul>${list.map((x) => { const o = typeof x === "string" ? { text: x, s: stepFor(x) } : x; return `<li>${o.s != null ? `<button type="button" class="link-btn" data-go="${o.s}">${esc(o.text || o.label || "")}</button>` : esc(o.text || o.label || "")}</li>`; }).join("")}</ul></div></div>`;

  // ---------------------------------------------------------------- draw a step
  const draw = (focus = true) => {
    const s = steps[step];
    body.innerHTML = s.k === "basics" ? basics() : s.k === "section" ? sectionStep(s.s, step - 1) : s.k === "photos" ? photosStep() : reviewStep();
    applyDyn(body);
    chrome();
    if (focus) { window.scrollTo(0, 0); body.focus({ preventScroll: true }); }
  };
  const go = (n) => { flush(); step = Math.max(0, Math.min(steps.length - 1, n)); draw(); };
  prev.addEventListener("click", () => go(step - 1));
  next.addEventListener("click", () => go(step + 1));
  ctx.root.querySelector("#steps-btn").addEventListener("click", () => {
    const dd = openSheet({ title: "All steps", sub: `${esc(insp.stock_no || "")} · tap a step to jump to it`,
      body: `<ul class="mt-steps">${steps.map((s, i) => {
        const note = s.k === "section" ? `${rated(s.s)} of ${ratedTotal(s.s)} rated` : s.k === "photos" ? `${slotsDone()} of ${tpl.photo_slots.length}` : s.k === "basics" ? (insp.odometer ? "Odometer set" : "Odometer missing") : "";
        const done = s.k === "section" ? ratedTotal(s.s) > 0 && rated(s.s) === ratedTotal(s.s) : s.k === "photos" ? slotsDone() === tpl.photo_slots.length : s.k === "basics" ? !!insp.odometer : false;
        return `<li><button type="button" data-step="${i}"${i === step ? ' aria-current="step"' : ""}><span class="mt-sd${done ? " on" : ""}">${done ? icon("check", "") : i + 1}</span><span>${esc(s.t)}</span><em>${esc(note)}</em></button></li>`;
      }).join("")}</ul>` });
    // Jump only once the sheet's history entry is gone: go() rewrites the URL (?s=), and the Back that drops the sheet's
    // entry would otherwise land on the old ?s= and the router would redraw the step we came from.
    dd.el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-step]"); if (!b) return;
      let done = false; const jump = () => { if (!done && live()) { done = true; go(+b.dataset.step); } };
      window.addEventListener("popstate", jump, { once: true }); setTimeout(jump, 500);
      dd.close();
    });
  });

  // ---------------------------------------------------------------- answers
  body.addEventListener("click", async (e) => {
    const opt = e.target.closest(".mt-opt");
    if (opt) {
      const fs = opt.closest("[data-item]"), key = fs.dataset.item;
      queue({ items: { [key]: { value: opt.dataset.v } } });
      const sec = steps[step].s; reDrawItem(key); const rc = body.querySelector("#rc"); if (rc) rc.textContent = `${rated(sec)} of ${ratedTotal(sec)} rated`;
      body.querySelector(`[data-item="${CSS.escape(key)}"] .mt-bad textarea`)?.focus({ preventScroll: true });
      return;
    }
    if (e.target.closest("[data-allgood]")) {
      const s = steps[step].s, upd = {};
      s.items.filter((it) => (it.type === "condition" || it.type === "working") && (val(it.key) == null || val(it.key) === "")).forEach((it) => { upd[it.key] = { value: it.type === "working" ? "working" : "good" }; });
      queue({ items: upd }); draw(false); return;
    }
    const r = e.target.closest("[data-retry]"); if (r) { const f = failed.find((x) => x.key === r.dataset.retry); if (f) upload(f); return; }
    const g = e.target.closest("[data-go]"); if (g) { go(+g.dataset.go); return; }
    if (e.target.closest("#fin")) finish(e.target.closest("#fin"));
  });
  const reDrawItem = (key) => { const n = body.querySelector(`[data-item="${CSS.escape(key)}"]`); if (!n) return; const it = steps[step].s.items.find((x) => x.key === key); const t = document.createElement("template"); t.innerHTML = itemHtml(it).trim(); n.replaceWith(t.content.firstElementChild); };
  body.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "odo") { const v = t.value.replace(/[^\d]/g, ""); if (v !== t.value) t.value = v; queue({ odometer: v === "" ? null : Number(v) }); }
    else if (t.id === "dt") queue({ date: t.value });
    else if (t.id === "rem") queue({ remarks: t.value });
    else if (t.dataset.note) queue({ items: { [t.dataset.note]: { note: t.value } } });
    else if (t.dataset.f) { const it = steps[step].s.items.find((x) => x.key === t.dataset.f); queue({ items: { [t.dataset.f]: { value: it.type === "number" && t.value.trim() !== "" && !isNaN(Number(t.value)) ? Number(t.value) : t.value } } }); }
  });

  // ---------------------------------------------------------------- photos
  async function upload(f) {
    f.error = null;
    try {
      const fields = f.slot ? { slot: f.slot } : { item_key: f.item };
      const r = await sendFile(`maint/inspections/${id}/photos`, f.file, fields), ph = r.photo || r;
      failed.splice(failed.indexOf(f), 1);
      if (f.slot) insp.photos[f.slot] = ph; else { const x = (insp.items[f.item] ||= { photos: [] }); (x.photos ||= []).push(ph); }
    } catch (e) { f.error = e.message || "Did not send"; if (!failed.includes(f)) failed.push(f); }
    if (live()) draw(false);
  }
  onFiles(body, "input[data-slot], input[data-item-photo]", async (file, inp) => {
    const f = { key: "p" + Math.random().toString(36).slice(2, 7), file, slot: inp.dataset.slot || null, item: inp.dataset.itemPhoto || null };
    const li = inp.closest(".slot, .mt-bad"); li?.classList.add("sending");
    await upload(f);
  });
  bindZoom(ctx.root);

  // ---------------------------------------------------------------- finish
  async function finish(btn) {
    await flush();
    if (!empty()) { failToast({ message: "Your latest answers are not saved yet. Check the connection and try again." }); return; }
    if (!(await confirmDialog({ title: "Finish this inspection?", text: "The score is worked out, items that need attention become open issues on the car, and the answers are locked.", confirmLabel: "Finish inspection" }))) return;
    btn.disabled = true;
    try { await io.post(`maint/inspections/${id}/finalise`, {}); safeStore(PKEY, null); location.hash = `#/maint-report/${id}`; }
    catch (e) {
      btn.disabled = false;
      const raw = e.body?.missing || e.body?.error?.missing || e.fields?.missing || (Array.isArray(e.fields) ? e.fields : null);
      const list = Array.isArray(raw) ? raw.map((x) => (typeof x === "string" ? { text: x } : { s: stepOf(x), text: [x.section, x.label || x.item, x.reason].filter(Boolean).join(": ") })) : null;
      const box = body.querySelector("#miss");
      if (box) { box.innerHTML = list ? missingBox(list, "Still to do before it can be finished") : errBox(e.message, "Could not finish the inspection."); box.scrollIntoView({ block: "center", behavior: "smooth" }); } else failToast(e);
    }
  }
  const stepOf = (x) => {
    if (x.slot) return tpl.sections.length + 1;                              // photo slots: section "Photos", no section_key
    const i = tpl.sections.findIndex((s) => s.key === x.section_key || s.key === x.section || s.title === x.section); return i >= 0 ? i + 1 : null;
  };

  draw(false);
}
