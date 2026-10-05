// Tabulator wrapper: spreadsheet-like grids with sorting, filtering, column chooser, CSV/XLSX export.
import * as api from "./api.js";
import { DEMO } from "./api.js";
import { esc, icon, inr, dateFmt, num, pct, download } from "./util.js";
import { openMenu, toast } from "./ui.js";

const grids = new Set();
const safeCell = (v) => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
export function disposeGrids() { grids.forEach((g) => { try { g.destroy(); } catch { /* already gone */ } }); grids.clear(); }

// Columns that always stay visible when the grid is too narrow: the first (what it is), the status, and the first money or
// number column (the figure that matters). The rest fold into a "+" row, so a phone or a 1366 px laptop never clips the
// status or the price off the right edge.
const narrow = () => window.matchMedia("(max-width: 719px)").matches;
const STATUS_FIELD = /(^|_)(status|stage)$/;
function prioritise(columns) {
  let status = false, figure = false;
  // the figure that matters is the first money column; only when there is none, the first plain number
  const moneyAt = columns.findIndex((c) => c.field && c.isMoney);
  const isFigure = (c, i) => (moneyAt >= 0 ? i === moneyAt : c.hozAlign === "right" && c.sorter === "number");
  return columns.map((c, i) => {
    if (c.responsive !== undefined || !c.field) { const { isMoney, ...plain } = c; return plain; }
    let keep = i === 0;
    if (!status && STATUS_FIELD.test(c.field)) { status = true; keep = true; }
    if (!figure && isFigure(c, i)) { figure = true; keep = true; }
    const { isMoney, ...def } = c;                  // isMoney is ours: Tabulator warns about options it does not know
    // wide enough for its own header: uppercase 11px with tracking is about 9.3 px a character at 12px, plus padding and the sort arrow
    const need = Math.ceil(String(def.title || "").length * 9.3 + 50);
    if (def.width && def.width < need && !narrow()) def.width = need;
    return { ...def, responsive: keep ? 0 : i + 1, minWidth: Math.max(keep && narrow() ? 78 : c.minWidth || 96, narrow() ? 0 : need) };
  });
}

export function makeGrid(host, opts = {}) {
  if (!window.Tabulator) { host.textContent = "The grid could not load."; return null; }
  const { onRowClick, ...rest } = opts;
  if (rest.responsiveLayout === undefined && Array.isArray(rest.columns)) { rest.responsiveLayout = "collapse"; rest.responsiveLayoutCollapseStartOpen = false; rest.columns = prioritise(rest.columns); }
  else if (Array.isArray(rest.columns)) rest.columns = rest.columns.map(({ isMoney, ...c }) => c);
  // Sized to its rows so no row is cut off mid-way; long lists page instead of scrolling inside the page.
  const long = Array.isArray(rest.data) && rest.data.length > 30 && rest.responsiveLayout === "collapse";
  const t = new window.Tabulator(host, {
    ...(long ? { pagination: true, paginationSize: 25, paginationSizeSelector: [25, 50, 100], paginationCounter: "rows" } : {}),
    // on a phone the kept columns share the width (names wrap or clip) instead of pushing the figure off the right edge
    layout: window.matchMedia("(max-width: 719px)").matches ? "fitColumns" : "fitDataFill", ...(long || rest.responsiveLayout === "collapse" ? {} : { maxHeight: 640 }), placeholder: "Nothing here yet.", headerSortTristate: true,
    // exported cells starting with = + - @ are neutralised (spreadsheet formula injection), as the server export does
    columnDefaults: { headerSortTristate: true, resizable: false, accessorDownload: safeCell, titleFormatter: "plaintext" },
    resizableColumnFit: true, ...rest,
  });
  if (onRowClick) t.on("rowClick", (e, row) => { if (e.target.closest("input,select,button,a,.tabulator-editing")) return; onRowClick(row.getData(), row, e); });
  grids.add(t);
  return t;
}

// ------------------------------------------------------------------ column kinds
const base = (field, title, o = {}) => ({ field, title, ...o });
export const col = {
  text: (f, t, o) => base(f, t, { sorter: "string", ...o }),
  money: (f, t, o) => base(f, t, { isMoney: true, sorter: "number", hozAlign: "right", headerHozAlign: "right", formatter: (c) => inr(c.getValue()), ...o }),
  int: (f, t, o) => base(f, t, { sorter: "number", hozAlign: "right", headerHozAlign: "right", formatter: (c) => num(c.getValue()), ...o }),
  pct: (f, t, o) => base(f, t, { sorter: "number", hozAlign: "right", headerHozAlign: "right", formatter: (c) => pct(c.getValue()), ...o }),
  date: (f, t, o) => base(f, t, { sorter: "string", formatter: (c) => dateFmt(c.getValue()), ...o }),
  html: (f, t, o) => base(f, t, { formatter: (c) => c.getValue() ?? "", ...o }),
};
export const cellMain = (main, sub) => `<span class="cell-main"><b>${esc(main)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>`;

// ------------------------------------------------------------------ export + toolbar bits
let xlsxLoading = null;
export function ensureXlsx() {
  if (window.XLSX) return Promise.resolve();
  xlsxLoading ||= new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "vendor/xlsx.full.min.js";
    s.onload = res; s.onerror = () => rej(new Error("Excel export could not load."));
    document.head.appendChild(s);
  });
  return xlsxLoading;
}

// kind: people (phones and names) | ops | money | any. The server checks the capability and writes the audit row first.
export async function exportGrid(table, name, fmt, kind = "any") {
  try {
    await api.post("export-log", { kind, format: fmt, name, rows: table.getDataCount() });
    if (fmt === "xlsx") { await ensureXlsx(); table.download("xlsx", `${name}.xlsx`, { sheetName: name.slice(0, 28) }); }
    else table.download("csv", `${name}.csv`);
  } catch (e) { toast(e.message || "Export failed.", "err"); }
}

/** Returns a node with CSV / XLSX buttons bound to a grid getter (grid may be recreated). */
export function exportButtons(getTable, name, kind = "any") {
  const w = document.createElement("div");
  w.className = "pill-row";
  w.innerHTML = `<button class="btn sm" type="button" data-f="csv">${icon("download")}CSV</button><button class="btn sm" type="button" data-f="xlsx">${icon("download")}Excel</button>`;
  w.addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b && getTable()) exportGrid(getTable(), name, b.dataset.f, kind); });
  return w;
}

/** A "Columns" button that shows or hides columns. */
export function columnsButton(getTable) {
  const b = document.createElement("button");
  b.className = "btn sm"; b.type = "button"; b.innerHTML = `${icon("sheets")}Columns`;
  b.addEventListener("click", () => {
    const t = getTable(); if (!t) return;
    const items = t.getColumns().filter((c) => c.getDefinition().title).map((c) => ({
      label: c.getDefinition().title, checked: c.isVisible(),
      onClick: () => { c.toggle(); },
    }));
    openMenu(b, [{ heading: "Show columns" }, ...items], { align: "right" });
  });
  return b;
}

export function demoLocked() { return DEMO; }
export { download };
