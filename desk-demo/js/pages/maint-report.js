// Maintenance: the printable "Classic Auto Inspection Report". Print / Save as PDF uses window.print(); the A4 layout is in css/maint.css.
// #/maint-report/<inspection id>
import { can } from "../state.js";
import { applyDyn, dateFmt, esc, icon, mount, num, num1 } from "../util.js";
import { TYPE_WORD, bindZoom, errBox, io, scoreTone } from "./_maint.js";

const WORD = { good: "Good", minor: "Minor", major: "Major", na: "Not applicable", working: "Working", not_working: "Not working", gt70: "Above 70%", "40to70": "40 to 70%", lt40: "Below 40%", yes: "Yes", no: "No",
  comprehensive: "Comprehensive", zero_dep: "Zero depreciation", third_party: "Third party" };   // insurance type is pre-filled from the car record as its code
const BAD = new Set(["minor", "major", "not_working", "lt40"]);
const RATED = new Set(["condition", "working", "tread", "yesno"]);

export async function render(ctx) {
  const id = +ctx.id;
  let tpl, insp;
  try { [tpl, insp] = await Promise.all([io.get("maint/inspection-template"), io.get(`maint/inspections/${id}`).then((r) => r.inspection || r)]); }
  catch (e) { ctx.root.innerHTML = `<a class="crumbs" href="#/maint">${icon("left", "")}Maintenance</a>${errBox(e.message, "Could not open this report.")}`; return; }
  if (!ctx.alive()) return;
  const draft = insp.status !== "final";
  const secOf = (key) => tpl.sections.find((s) => s.key === key || s.title === key);
  const papers = tpl.sections.find((s) => s.key === "papers" || /^papers/i.test(s.title));
  const items = insp.items || {};
  const bad = insp.imperfect || [];
  const majors = bad.filter((b) => ["major", "not_working", "lt40"].includes(b.value)).length;
  const checked = tpl.sections.flatMap((s) => s.items.filter((it) => RATED.has(it.type))).filter((it) => items[it.key]?.value != null && items[it.key]?.value !== "").length;
  const score = insp.overall, tone = scoreTone(insp.label);
  const word = (it, v) => {
    if (v == null || v === "") return "Not recorded";
    if (it.type === "date") return dateFmt(v);
    if (it.type === "number") return num(Number(v));
    return WORD[v] || String(v);
  };
  const photoSlots = tpl.photo_slots.map((p) => ({ ...p, ph: (insp.photos || {})[p.key] }));
  const taken = photoSlots.filter((p) => p.ph).length;

  const ring = (v) => `<svg class="rp-ring ${tone}" viewBox="0 0 120 120" role="img" aria-label="Overall score ${v == null ? "not yet worked out" : num1(v) + " out of 10"}"><circle class="trk" cx="60" cy="60" r="52" pathLength="100"/><circle class="val" cx="60" cy="60" r="52" pathLength="100" stroke-dasharray="${v == null ? 0 : Math.round(v * 10)} 100" transform="rotate(-90 60 60)"/><text x="60" y="64" text-anchor="middle" class="n">${v == null ? "–" : num1(v)}</text><text x="60" y="84" text-anchor="middle" class="o">out of 10</text></svg>`;

  mount(ctx.root, `<div class="rp-actions"><a class="crumbs" href="#/maint/${insp.car_id}">${icon("left", "")}Back to ${esc(insp.stock_no || "the car")}</a>
      <div class="rp-btns">${draft && can("maint.inspect") ? `<a class="btn primary" href="#/maint-inspect/${id}">${icon("edit")}Continue the inspection</a>` : ""}<button type="button" class="btn ${draft ? "" : "primary"}" id="prn">${icon("print")}Print or save as PDF</button></div>
      <p class="rp-hint">To send it on WhatsApp: tap Print or save as PDF, choose Save as PDF, then share the PDF.</p></div>
    <article class="rp" id="rp" aria-label="Classic Auto Inspection Report">
      ${draft ? `<p class="rp-draft">${icon("alert", "")}<span><b>Draft.</b> This inspection is not finished, so the score and the report are not final.</span></p>` : ""}
      <header class="rp-head"><img class="rp-logo" src="img/logo.svg" alt="Classic Auto, since 1974" width="840" height="496"><div><p class="rp-eye">Report no. INSP-${String(id).padStart(4, "0")} · ${esc(dateFmt(insp.date))}</p><h1>Classic Auto Inspection Report</h1><p class="rp-sub">Prabhu Plaza, S.V. Road, Malad West, Mumbai</p></div></header>
      <section class="rp-sec rp-car" aria-label="The car"><div class="rp-carname"><span class="rp-stock">${esc(insp.stock_no || "")}</span><h2>${esc(insp.title || "")}</h2></div>
        <dl class="rp-dl"><div><dt>Odometer</dt><dd>${insp.odometer != null ? num(insp.odometer) + " km" : "Not recorded"}</dd></div><div><dt>Kind of inspection</dt><dd>${esc(TYPE_WORD[insp.type] || insp.type || "")}</dd></div><div><dt>Inspected by</dt><dd>${esc(insp.inspector || "—")}</dd></div><div><dt>Date</dt><dd>${esc(dateFmt(insp.date))}</dd></div></dl></section>
      <section class="rp-sec rp-score" aria-label="Score"><div class="rp-ringbox">${ring(score)}<p class="rp-label ${tone}">${esc(insp.label || (draft ? "Draft" : ""))}</p></div>
        <div class="rp-bars"><h3>Score by section</h3><ul>${tpl.sections.filter((s) => insp.section_scores && insp.section_scores[s.key] != null).map((s) => { const v = insp.section_scores[s.key]; const t = v >= 8.5 ? "pos" : v >= 7 ? "info" : v >= 5 ? "warn" : "neg"; return `<li><span class="rp-bn">${esc(s.title)}</span><span class="rp-bar ${t}"><i data-w="${Math.round(v * 10)}"></i></span><b>${num1(v)}</b></li>`; }).join("") || `<li class="rp-none">Scores appear when the inspection is finished.</li>`}</ul>
          <p class="rp-note">${checked} items checked${bad.length ? `. ${bad.length} need${bad.length === 1 ? "s" : ""} attention (${majors} major, ${bad.length - majors} minor).` : ". Nothing needs attention."}</p></div></section>
      ${papers ? `<section class="rp-sec" aria-label="Papers and identity"><h3>${esc(papers.title)}</h3><dl class="rp-dl rp-papers">${papers.items.map((it) => `<div><dt>${esc(it.label)}</dt><dd>${esc(word(it, items[it.key]?.value))}</dd></div>`).join("")}</dl></section>` : ""}
      <section class="rp-sec" aria-label="What needs attention"><h3>What needs attention</h3>${bad.length ? `<ul class="rp-bad">${bad.map((b) => `<li class="${b.value === "minor" ? "minor" : "major"}"><div class="rp-bh"><b>${esc(b.label)}</b><span class="rp-tag ${b.value === "minor" ? "minor" : "major"}">${esc(WORD[b.value] || b.value)}</span></div><p class="rp-where">${esc((secOf(b.section) || {}).title || b.section || "")}</p>${b.note ? `<p>${esc(b.note)}</p>` : ""}${(b.photos || []).length ? `<div class="rp-bp">${b.photos.map((p) => `<button type="button" class="rp-ph" data-zoom="${esc(p.url)}" data-cap="${esc(b.label)}" aria-label="Open the photo: ${esc(b.label)}"><img src="${esc(p.url)}" alt="${esc(b.label)}"></button>`).join("")}</div>` : ""}</li>`).join("")}</ul>` : `<p class="rp-none">${draft ? "Nothing has been marked yet." : "Nothing was found that needs attention."}</p>`}</section>
      <section class="rp-sec rp-photos" aria-label="Photos"><h3>Photos <span class="rp-count">${taken} of ${photoSlots.length}</span></h3><ul class="rp-grid">${photoSlots.map((p) => `<li>${p.ph ? `<button type="button" class="rp-ph" data-zoom="${esc(p.ph.url)}" data-cap="${esc(p.label)}" aria-label="Open the photo: ${esc(p.label)}"><img src="${esc(p.ph.url)}" alt="${esc(p.label)}"></button>` : `<span class="rp-ph none">Not taken</span>`}<span class="rp-cap">${esc(p.label)}</span></li>`).join("")}</ul></section>
      ${insp.remarks ? `<section class="rp-sec" aria-label="Remarks"><h3>Remarks</h3><p class="rp-rem">${esc(insp.remarks)}</p></section>` : ""}
      <footer class="rp-sec rp-foot"><div class="rp-sign"><span class="rp-line"></span><p><b>${esc(insp.inspector || "Inspector")}</b>, inspector<br>${esc(dateFmt(insp.date))}</p></div>
        <p class="rp-disc">This report records what our inspector could see and test on the day above, with the car standing in our yard. It is not a warranty, a valuation or a promise about future repairs, and parts that cannot be seen without taking the car apart were not checked. If a part matters to you, ask us and we will look at it again before you decide.</p></footer>
    </article>`);
  applyDyn(ctx.root);
  ctx.root.querySelector("#prn").addEventListener("click", () => window.print());
  bindZoom(ctx.root);
}
