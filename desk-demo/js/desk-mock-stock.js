// Desk demo only (loaded by the demo bundle's index.html, never by the live app): the "Real stock" card on Home, Today and
// Stock. It counts the recorded stock list itself - Classic Auto's real cars from classicauto.net.in - so every figure
// here is a sum of real asking prices; what is not known yet (arrival dates, buying prices, costs, the line) says
// "Dad adds" instead of a number. scripts/build_desk_demo.py adds the <script> tag and the photo paths.
import { DEMO, demoMeta, demoRole, get } from "./api.js";
import { can } from "./state.js";
import { esc, lakh, num, title } from "./util.js";

const PAGES = new Set(["home", "today", "inventory"]);
const IN_STOCK = new Set(["incoming", "refurb", "available", "booked"]);
const BANDS = [["Under 20 L", 0, 2e6], ["20-50 L", 2e6, 5e6], ["50 L and above", 5e6, Infinity]];
const DAD = "Dad adds";
const CSS = `
#real-stock { margin-bottom: 16px; }
#real-stock .rs-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 4px 0 14px; }
@media (min-width: 900px) { #real-stock .rs-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
#real-stock .rs-tile { border: 1px solid var(--line, rgba(127,127,127,.25)); border-radius: 12px; padding: 10px 12px; min-width: 0; }
#real-stock .rs-tile b { display: block; font-size: 1.35rem; line-height: 1.2; overflow-wrap: anywhere; }
#real-stock .rs-tile span { display: block; font-size: .8rem; opacity: .75; }
#real-stock .rs-tile.dad b { font-size: 1rem; opacity: .85; }
#real-stock .rs-groups { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
@media (min-width: 900px) { #real-stock .rs-groups { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
#real-stock h3.rs-gap { margin-top: 12px; }
#real-stock h3 { font-size: .85rem; margin: 0 0 6px; text-transform: uppercase; letter-spacing: .04em; opacity: .8; }
#real-stock ul.rs-bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
#real-stock .rs-bars li { display: grid; grid-template-columns: minmax(0, 8.5em) minmax(0, 1fr) auto; gap: 8px; align-items: center; font-size: .85rem; }
#real-stock .rs-bars .l { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#real-stock .rs-bars .bar { height: 8px; border-radius: 4px; background: var(--navy-bright, #3b6fd8); opacity: .8; min-width: 2px; }
#real-stock .rs-bars .v { white-space: nowrap; font-variant-numeric: tabular-nums; }
#real-stock .rs-photos { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0 8px; margin-top: 14px; scroll-snap-type: x proximity; }
#real-stock .rs-photos a { flex: 0 0 auto; width: 148px; scroll-snap-align: start; color: inherit; text-decoration: none; font-size: .75rem; }
#real-stock .rs-photos img { display: block; width: 148px; height: 111px; object-fit: cover; border-radius: 8px; background: rgba(127,127,127,.15); }
#real-stock .rs-photos span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 3px; }
#real-stock .rs-note { font-size: .8rem; opacity: .75; margin: 10px 0 0; }
.demo-photos .rs-strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; }
.demo-photos .rs-strip img { flex: 0 0 auto; width: 200px; height: 150px; object-fit: cover; border-radius: 8px; background: rgba(127,127,127,.15); }
`;

let cache = { key: "", cars: null };
async function stock() {
  const key = await demoRole();
  if (cache.key !== key) {
    cache = { key, cars: null };
    try { cache.cars = ((await get("cars", { page_size: 200, scope: "all" })).data || []).filter((c) => IN_STOCK.has(c.status)); } catch { cache.cars = []; }
  }
  return cache.cars;
}

const group = (cars, by) => {
  const m = new Map();
  for (const c of cars) { const k = by(c) || "Not set"; const g = m.get(k) || { n: 0, v: 0 }; g.n += 1; g.v += c.asking_price || 0; m.set(k, g); }
  return [...m.entries()].sort((a, b) => b[1].n - a[1].n || b[1].v - a[1].v);
};
const bars = (rows) => {
  const top = Math.max(1, ...rows.map(([, g]) => g.n));
  return `<ul class="rs-bars">${rows.map(([k, g]) => `<li><span class="l" title="${esc(k)}">${esc(k)}</span><span class="bar" data-w="${(g.n / top) * 100}"></span><span class="v">${num(g.n)} · ${esc(lakh(g.v))}</span></li>`).join("")}</ul>`;
};
const tile = (label, value, dad = false) => `<div class="rs-tile${dad ? " dad" : ""}"><b>${value}</b><span>${esc(label)}</span></div>`;

function cardHtml(cars, meta) {
  const total = cars.reduce((s, c) => s + (c.asking_price || 0), 0);
  const priced = cars.filter((c) => c.asking_price);
  const booked = cars.filter((c) => c.status === "booked").length;
  const money = can("money.view");
  const lineKnown = cars.filter((c) => c.ownership).length;
  const tiles = [tile("Cars in stock", num(cars.length)), tile("Total at asking price", esc(lakh(total))),
    tile("Average asking price", esc(lakh(priced.length ? total / priced.length : null))), tile("Arrival dates (days in stock)", DAD, true)];
  if (money) {
    tiles.push(tile("Buying cost and capital locked", DAD, true), tile("Costs (workshop, transport, papers)", DAD, true),
      tile(lineKnown ? `Line known for ${lineKnown} cars` : "Bought (invested) or Park & Sell", DAD, true), tile("Sold from this stock, and profit", DAD, true));
  }
  const band = (c) => (BANDS.find(([, lo, hi]) => (c.asking_price || 0) >= lo && (c.asking_price || 0) < hi) || [""])[0];
  const photos = cars.filter((c) => (c.photos || []).length).map((c) => `<a href="#/inventory?car=${c.id}"><img src="${esc(c.photos[0])}" alt="${esc(`${c.mfg_year || ""} ${c.make} ${c.model}`.trim())}" loading="lazy" decoding="async" width="148" height="111"><span>${esc(`${c.mfg_year || ""} ${c.make} ${c.model}`.trim())} · ${esc(lakh(c.asking_price))}</span></a>`).join("");
  const read = meta?.stock?.source ? "classicauto.net.in, read 13 Oct 2026" : "classicauto.net.in";
  return `<section class="card rise" id="real-stock" aria-label="Real stock"><div class="card-h"><div><h2>Real stock</h2>
    <div class="card-sub">Classic Auto's own listings (${esc(read)}): cars, asking prices and photos are real. Leads, customers, deals and money elsewhere in this demo are made up.${booked ? ` The ${num(booked)} booked cars carry made-up demo bookings.` : ""}</div></div></div>
    <div class="rs-tiles">${tiles.join("")}</div>
    <div class="rs-groups">
      <div><h3>By make</h3>${bars(group(cars, (c) => c.make))}</div>
      <div><h3>By body</h3>${bars(group(cars, (c) => title(c.body_type || "")))}
        <h3 class="rs-gap">By fuel</h3>${bars(group(cars, (c) => title(c.fuel || "")))}
        <h3 class="rs-gap">By price band</h3>${bars(BANDS.map(([l]) => [l, group(cars, band).find(([k]) => k === l)?.[1] || { n: 0, v: 0 }]))}</div>
    </div>
    ${photos ? `<div class="rs-photos" aria-label="Photos of every car in stock">${photos}</div>` : ""}
    <p class="rs-note">Counts and sums are of the cars in stock; a figure after the dot is the total asking price. classicauto.net.in shows no listing or arrival date per car, so days in stock stay blank until Dad adds the arrival dates.</p></section>`;
}

const page = () => (location.hash.replace(/^#\/?/, "").split(/[/?]/)[0] || "home");
let busy = false;
async function place() {
  if (busy || !PAGES.has(page())) return;
  const main = document.getElementById("main");
  if (!main || main.querySelector("#real-stock") || !main.children.length) return;
  busy = true;
  try {
    const [cars, meta] = await Promise.all([stock(), demoMeta().catch(() => null)]);
    if (!cars.length || !meta?.stock?.real || !PAGES.has(page()) || main.querySelector("#real-stock")) return;
    const box = document.createElement("div");
    box.innerHTML = cardHtml(cars, meta);
    const card = box.firstElementChild;
    card.querySelectorAll("[data-w]").forEach((b) => { b.style.width = `${b.dataset.w}%`; });
    const head = main.querySelector(".page-head");
    if (head) head.after(card); else main.prepend(card);
  } finally { busy = false; }
}

if (DEMO) {
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);
  let t = 0;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(place, 120); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(place, 200));
}
