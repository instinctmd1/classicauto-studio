// Market stock (app/market.py): our cars and the partner and nearby dealers' cars in one grid, each in the Classic Auto
// website's stock card (photo, make, model, colour and variant, year · km · fuel · gearbox, price), with a dot top-right for
// whose car it is. #/market. Staff only (market.view: owners, the manager, salesmen); never on the public website.
// The photos stay on the dealers' own hosts: lazy, no referrer, and a photo that does not load shows the card's placeholder.
// Filters and search run in the browser on the one answer of GET /api/market. No money: asking prices only, never a cost.
import * as api from "../api.js";
import { can } from "../state.js";
import { ago, applyDyn, debounce, esc, icon, mount, num, safeStore } from "../util.js";
import { openDrawer, pageHead } from "../ui.js";

const PAGE = 48;
const BODY_WORD = { hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", mpv: "MPV / MUV", "luxury-sedan": "Luxury sedan", "luxury-suv": "Luxury SUV", coupe: "Coupe / sports", other: "Other" };
const BUDGETS = [["", "Any budget"], ["0-500000", "Under ₹5 L"], ["500000-1000000", "₹5 L to ₹10 L"], ["1000000-2000000", "₹10 L to ₹20 L"], ["2000000-3500000", "₹20 L to ₹35 L"], ["3500000-5000000", "₹35 L to ₹50 L"], ["5000000-10000000", "₹50 L to ₹1 Cr"], ["10000000-", "Over ₹1 Cr"]];
const SORTS = [["new", "Newest listed"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["year_desc", "Year: newest first"], ["km_asc", "Km: lowest first"]];
const YEARS = [2024, 2022, 2020, 2018, 2015];
const STATE_WORD = { needs_feed: "Needs their stock sheet", never: "Not read yet", partial: "Partly read", blocked: "The site refused the reader", error: "Could not read", not_allowed: "Not allowed" };
const FILTER_KEY = "ca.market.filters";

/** ₹21.75 L, ₹1.25 Cr: the website's way, two decimals, no trailing zeros. */
function priceText(v) {
  if (typeof v !== "number" || !(v > 0)) return null;
  const f = (x) => x.toFixed(2).replace(/\.?0+$/, "");
  return v >= 1e7 ? `₹${f(v / 1e7)} Cr` : v >= 1e5 ? `₹${f(v / 1e5)} L` : `₹${num(v)}`;
}
const dotHtml = (d, cls = "") => `<span class="mk-dot${d.ring ? " two" : ""}${cls}" data-c="${esc(d.colour)}"${d.ring ? ` data-g="${esc(d.ring)}"` : ""} aria-hidden="true"></span>`;

export async function render(ctx) {
  const data = await api.get("market");
  if (!ctx.alive()) return;
  const dealers = Object.fromEntries(data.dealers.map((d) => [d.key, d]));
  const cars = data.cars.filter((c) => dealers[c.dealer]);
  let saved = {};
  try { saved = JSON.parse(safeStore(FILTER_KEY) || "{}") || {}; } catch { saved = {}; }
  const f = { q: "", src: new Set(Array.isArray(saved.src) ? saved.src.filter((k) => dealers[k]) : []), brand: saved.brand || "", body: saved.body || "", budget: saved.budget || "", year: saved.year || "", sort: saved.sort || "new" };
  let shown = PAGE;
  const brands = [...new Set(cars.map((c) => c.make).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  if (f.brand && !brands.includes(f.brand)) f.brand = "";
  if (!data.bodies.includes(f.body)) f.body = "";                         // a filter kept from an older visit must still exist
  if (!BUDGETS.some(([v]) => v === f.budget)) f.budget = "";
  if (f.year && !YEARS.some((y) => String(y) + "-" === f.year) && f.year !== "-2014") f.year = "";
  if (!SORTS.some(([v]) => v === f.sort)) f.sort = "new";

  const legend = data.dealers.map((d) => {
    const live = d.kind !== "feed";
    const when = d.last_ok_at ? `<span class="mk-when">Updated ${esc(ago(d.last_ok_at))}</span>` : "";
    const state = d.state === "ok" ? when : `<span class="mk-state s-${esc(d.state)}">${esc(STATE_WORD[d.state] || d.state)}</span>${when}`;
    return `<button type="button" class="mk-chip${live ? "" : " off"}" data-src="${esc(d.key)}" aria-pressed="false"${live ? "" : ` title="${esc(d.state_text || "")}"`}>${dotHtml(d)}<span class="mk-chip-t"><b translate="no">${esc(d.name)}</b><span class="mk-chip-s"><span class="n">${esc(num(d.cars))}</span>${state}</span></span></button>`;
  }).join("");

  mount(ctx.root, `<div class="mk">${pageHead({ title: "Market stock", sub: "Our cars and nearby dealers' cars in one place, to find the right car for a customer." })}
    <p class="mk-note">${icon("lock", "")}<span>Staff only. Other dealers' photos and listings are for finding a car for a customer: never post, print or forward them. Prices are what each dealer asks.</span></p>
    <section class="mk-legend" aria-label="Whose car: tap to show one dealer">${legend}</section>
    <div class="mk-bar">
      <label class="search mk-q"><span class="sr">Search cars</span>${icon("search", "")}<input class="input" id="mk-q" type="search" placeholder="Search make, model, variant" autocomplete="off"></label>
      <select class="select" id="mk-brand" aria-label="Brand"><option value="">All brands</option>${brands.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join("")}</select>
      <select class="select" id="mk-body" aria-label="Body type"><option value="">Any body type</option>${data.bodies.map((b) => `<option value="${esc(b)}">${esc(BODY_WORD[b] || b)}</option>`).join("")}</select>
      <select class="select" id="mk-budget" aria-label="Budget">${BUDGETS.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}</select>
      <select class="select" id="mk-year" aria-label="Year"><option value="">Any year</option>${YEARS.map((y) => `<option value="${y}-">${y} or newer</option>`).join("")}<option value="-2014">Before 2015</option></select>
      <select class="select" id="mk-sort" aria-label="Sort">${SORTS.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}</select>
    </div>
    <div class="mk-count" id="mk-count" aria-live="polite"></div>
    <div class="mk-grid" id="mk-grid"></div>
    <div class="mk-more" id="mk-more"></div>
  </div>`);

  const root = ctx.root;
  const $ = (s) => root.querySelector(s);
  $("#mk-brand").value = f.brand; $("#mk-body").value = f.body; $("#mk-budget").value = f.budget; $("#mk-year").value = f.year; $("#mk-sort").value = f.sort;
  const keep = () => safeStore(FILTER_KEY, JSON.stringify({ src: [...f.src], brand: f.brand, body: f.body, budget: f.budget, year: f.year, sort: f.sort }));

  function matches(c) {
    if (f.src.size && !f.src.has(c.dealer)) return false;
    if (f.brand && c.make !== f.brand) return false;
    if (f.body && c.body !== f.body) return false;
    if (f.budget) {
      const [lo, hi] = f.budget.split("-").map((x) => (x === "" ? null : +x));
      if (typeof c.price !== "number") return false;
      if (lo !== null && c.price < lo) return false;
      if (hi !== null && c.price >= hi) return false;
    }
    if (f.year) {
      const [lo, hi] = f.year.split("-").map((x) => (x === "" ? null : +x));
      if (!c.year || (lo !== null && c.year < lo) || (hi !== null && c.year > hi)) return false;
    }
    if (f.q) {
      const hay = [c.make, c.model, c.variant, c.colour, c.fuel, c.transmission, dealers[c.dealer].name, c.year, c.stock_no].filter(Boolean).join(" ").toLowerCase();
      if (!f.q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }
  const by = {
    new: (a, b) => String(b.first_seen || "").localeCompare(String(a.first_seen || "")),
    price_asc: (a, b) => (a.price ?? 9e12) - (b.price ?? 9e12),
    price_desc: (a, b) => (b.price ?? -1) - (a.price ?? -1),
    year_desc: (a, b) => (b.year || 0) - (a.year || 0),
    km_asc: (a, b) => (a.kms ?? 9e12) - (b.kms ?? 9e12),
  };

  function draw() {
    const list = cars.filter(matches).sort(by[f.sort] || by.new);
    root.querySelectorAll(".mk-chip").forEach((b) => b.setAttribute("aria-pressed", String(f.src.has(b.dataset.src))));
    const any = f.src.size || f.brand || f.body || f.budget || f.year || f.q;
    $("#mk-count").innerHTML = `<span>${esc(num(list.length))} cars</span>${any ? ` <button class="link-btn" type="button" id="mk-clear">Clear filters</button>` : ""}`;
    const grid = $("#mk-grid");
    grid.innerHTML = list.length ? list.slice(0, shown).map(cardHtml).join("")
      : `<div class="mk-empty">${icon("search", "")}<b>No car matches these filters.</b><span class="muted">Clear a filter or search for less.</span></div>`;
    applyDyn(grid);
    const left = list.length - shown;
    $("#mk-more").innerHTML = left > 0 ? `<button class="btn" type="button" id="mk-more-btn">${icon("plus")}<span>Show ${esc(num(Math.min(left, PAGE)))} more</span></button>` : "";
  }

  function cardHtml(c) {
    const d = dealers[c.dealer];
    const own = c.dealer === "classic";
    const label = [c.make, c.model].filter(Boolean).join(" ");
    const badge = c.booked ? `<span class="mk-badge sold">Booked</span>` : `<span class="mk-badge">${esc(BODY_WORD[c.body] || BODY_WORD.other)}</span>`;
    const media = c.photo
      ? `<img src="${esc(c.photo)}" alt="${esc(label)}" width="600" height="400" loading="lazy" decoding="async" referrerpolicy="no-referrer">${c.photo_count > 1 ? `<span class="mk-pics">${icon("image", "")}<span>${esc(num(c.photo_count))}</span></span>` : ""}`
      : "";
    const ph = `<span class="mk-ph"><span class="mk-ph-t">${esc(c.make || "")}<br>${esc(c.model || "")}</span><span class="mk-ph-n">Photos on request</span></span>`;
    const mediaTag = c.photo ? `<button type="button" class="mk-media" data-photos="${esc(c.id)}" aria-label="All photos">${badge}${media}${ph}</button>` : `<div class="mk-media is-ph">${badge}${ph}</div>`;
    const specs = [["Year", c.year || "—"], ["Driven", typeof c.kms === "number" ? `${num(c.kms)} km` : "km: ask"], ["Fuel", c.fuel || "—"], ["Gearbox", c.transmission || "—"]];
    const price = priceText(c.price);
    const links = [];
    if (own && c.desk_id && can("stock.view")) links.push(`<a class="btn sm" href="#/inventory?car=${esc(c.desk_id)}">${icon("car")}<span>Car file</span></a>`);
    if (c.url) links.push(`<a class="btn sm${own ? "" : " primary"}" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${icon("link")}<span>${own ? "Website" : "Open listing"}</span></a>`);
    return `<article class="mk-card">
      <span class="mk-dot-wrap" title="${esc(d.name)}">${dotHtml(d)}<span class="sr">${esc(d.name)}</span></span>
      ${mediaTag}
      <div class="mk-body">
        <span class="mk-eyebrow" translate="no">${esc(c.make || "")}</span>
        <h3 translate="no">${esc(c.model || "")}</h3>
        <p class="mk-variant"><span translate="no">${esc([c.colour, c.variant].filter(Boolean).join(" · ") || " ")}</span></p>
        <dl class="mk-specs">${specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
        <p class="mk-where">${dotHtml(d, " sm")}<span translate="no">${esc(d.name)}</span>${c.location ? ` · <span translate="no">${esc(c.location)}</span>` : ""}${c.owners ? ` · <span>${esc(c.owners)} owner</span>` : ""}</p>
        <div class="mk-price-row">${price ? `<span class="mk-price">${esc(price)}</span>` : `<span class="mk-price ask">Ask for price</span>`}<span class="mk-links">${links.join("")}</span></div>
      </div>
    </article>`;
  }

  async function gallery(id) {
    const c = cars.find((x) => x.id === id);
    if (!c) return;
    const d = dealers[c.dealer];
    const dr = openDrawer({ title: [c.make, c.model].filter(Boolean).join(" "), sub: `<span translate="no">${esc(d.name)}</span>`, wide: true, body: `<div class="mk-gal"><div class="skel mk-gal-sk"></div></div>` });
    let r;
    try { r = await api.get(`market/${encodeURIComponent(id)}/photos`); } catch (e) { r = { photos: c.photo ? [c.photo] : [], url: c.url, err: e.message }; }
    const body = r.photos.length
      ? `<div class="mk-gal">${r.photos.map((p, i) => `<img src="${esc(p)}" alt="${esc(`${c.make} ${c.model}`)}" loading="${i < 2 ? "eager" : "lazy"}" decoding="async" referrerpolicy="no-referrer">`).join("")}</div>`
      : `<div class="mk-empty">${icon("image", "")}<b>No photos on the listing.</b></div>`;
    const link = r.url ? `<p class="mk-gal-link"><a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${icon("link")}<span>Open the dealer's listing</span></a></p>` : "";
    if (!dr.el.isConnected) return;
    dr.el.addEventListener("error", (e) => { if (e.target instanceof HTMLImageElement) e.target.remove(); }, true);
    dr.setBody(body + link);
  }

  // a photo that does not load (the dealer took it down or blocks it): the card's placeholder instead
  root.addEventListener("error", (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const m = img.closest(".mk-media");
    if (m) { m.classList.add("is-ph"); img.remove(); m.querySelector(".mk-pics")?.remove(); }
  }, true);

  root.addEventListener("click", (e) => {
    const chip = e.target.closest(".mk-chip");
    if (chip) { const k = chip.dataset.src; if (f.src.has(k)) f.src.delete(k); else f.src.add(k); shown = PAGE; keep(); draw(); return; }
    const pic = e.target.closest("[data-photos]");
    if (pic) { gallery(pic.dataset.photos); return; }
    if (e.target.closest("#mk-more-btn")) { shown += PAGE; draw(); return; }
    if (e.target.closest("#mk-clear")) {
      f.src.clear(); f.brand = f.body = f.budget = f.year = f.q = ""; $("#mk-q").value = "";
      ["#mk-brand", "#mk-body", "#mk-budget", "#mk-year"].forEach((s) => { $(s).value = ""; });
      shown = PAGE; keep(); draw();
    }
  });
  const sel = { "#mk-brand": "brand", "#mk-body": "body", "#mk-budget": "budget", "#mk-year": "year", "#mk-sort": "sort" };
  Object.entries(sel).forEach(([s, k]) => $(s).addEventListener("change", (e) => { f[k] = e.target.value; shown = PAGE; keep(); draw(); }));
  $("#mk-q").addEventListener("input", debounce((e) => { f.q = e.target.value.trim().toLowerCase(); shown = PAGE; draw(); }, 150));
  draw();
}
