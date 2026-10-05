// Sheets: every core table as an editable grid (only the columns you are allowed to see and change), plus custom sheets.
import * as api from "../api.js";
import { get } from "../api.js";
import { can, canAll } from "../state.js";
import { debounce, dateFmt, enumLabel, esc, icon, inr, mount, num, sentence } from "../util.js";
import { formDrawer, pageHead, confirmDialog, toast } from "../ui.js";
import { columnsButton, exportButtons, makeGrid } from "../grid.js";

// who may open each grid; the server checks the same rule
const CORE = [
  ["cars", "Cars", () => canAll("stock.view", "records.all")], ["deals", "Deals", () => can("deals.manage")], ["people", "People", () => can("customers.manage")],
  ["consignments", "Park-N-Sell", () => can("stock.manage")], ["rto_cases", "RTO cases", () => can("rto.manage")], ["finance_cases", "Finance cases", () => can("deals.manage")],
  ["insurance_policies", "Insurance policies", () => can("deals.manage")], ["leads", "Leads", () => canAll("leads.view", "records.all")],
  ["payments", "Payments", () => can("accounts.view")], ["overheads", "Overheads", () => can("expenses.view")], ["marketing_spend", "Marketing spend", () => can("expenses.view")],
];
const TYPE = { text: "input", number: "number", money: "number", date: "input", checkbox: "tickCross", select: "list" };
let table = null;

export async function render(ctx) {
  const sheets = await get("sheets");
  if (!ctx.alive()) return;
  const core = CORE.filter(([, , ok]) => ok());
  const sel = ctx.query.get("t") || (core[0] ? "core:" + core[0][0] : sheets.data[0] ? "sheet:" + sheets.data[0].id : "");
  if (!core.length && !sheets.data.length && !can("sheets.manage")) {           // nothing to open: say why and what to do, instead of an empty panel
    mount(ctx.root, pageHead({ title: "Sheets", sub: "Spreadsheets over the firm's records." }) + `<div class="card rise"><div class="empty">${icon("sheets", "")}<b>No sheets are shared with you yet</b><p>Your role has no record grids, and no custom sheet has been shared with you. Ask the owner to share a sheet with you.</p></div></div>`);
    return;
  }
  mount(ctx.root, pageHead({ title: "Sheets", sub: "Spreadsheets over the firm's records. Double-click a cell to edit. Select cells and copy to paste into Excel. Export to CSV or Excel when you need a file.",
    actions: can("sheets.manage") ? `<button class="btn primary" type="button" id="new-sheet">${icon("plus")}New sheet</button>` : "" })
    + `<div class="sheet-side rise"><aside class="card" aria-label="Sheets"><div class="sheet-list" id="sl"></div></aside><section class="card flush"><div class="card-h"><div><h2 id="sh-t">Sheet</h2><div class="card-sub" id="sh-s"></div></div><div class="act" id="sh-a"></div></div><div id="body"></div></section></div>`);
  const sl = ctx.root.querySelector("#sl");
  sl.innerHTML = `${core.length ? `<h4>Records</h4>${core.map(([k, l]) => `<button type="button" data-t="core:${k}" aria-current="${sel === "core:" + k}">${icon("sheets", "")}${esc(l)}</button>`).join("")}` : ""}<h4>Custom sheets</h4>${sheets.data.length ? sheets.data.map((s) => `<button type="button" data-t="sheet:${s.id}" aria-current="${sel === "sheet:" + s.id}">${icon("file", "")}${esc(s.name)}<span class="n">${num(s.row_count)}</span></button>`).join("") : `<p class="note pad-box">${icon("info", "")}No custom sheets yet.</p>`}`;
  const open = async (key) => {
    sl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.t === key)));
    history.replaceState(null, "", `#/sheets?t=${encodeURIComponent(key)}`);
    const body = ctx.root.querySelector("#body"); body.innerHTML = `<div class="skel card"></div>`;
    try { table?.destroy(); } catch { /* gone */ } table = null;
    try { key.startsWith("core:") ? await coreGrid(ctx, key.slice(5), core) : await sheetGrid(ctx, +key.slice(6), sheets.data); }
    catch (e) { body.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>This sheet could not open.</b><span class="muted">${esc(e.message)}</span></div></div>`; }
  };
  sl.addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (b) open(b.dataset.t); });
  ctx.root.querySelector("#new-sheet")?.addEventListener("click", () => newSheet(ctx));
  if (sel) await open(sel); else ctx.root.querySelector("#body").innerHTML = `<div class="empty">${icon("sheets", "")}<b>Nothing to open</b></div>`;
}

const gridOpts = { responsiveLayout: false, headerSortClickElement: "icon", rowHeader: { headerSort: false, resizable: false, frozen: true, width: 44, hozAlign: "center", formatter: "rownum" }, selectableRange: true, selectableRangeColumns: true, selectableRangeRows: true, clipboard: true, clipboardCopyStyled: false, clipboardCopyConfig: { rowHeaders: false, columnHeaders: false }, maxHeight: "68vh", height: "68vh" };

const ENUMISH = /^(ownership|status|stage|fuel|transmission|mode|payment_mode|purpose|kind|source|channel|band|direction|category|loan_type|doc_type|sentiment|outcome|role)$/;

function colDef(c, edit) {
  const t = c.type, d = { field: c.field ?? c.key, title: c.title, sorter: t === "number" || t === "money" ? "number" : "string", headerFilter: false, minWidth: Math.max(90, c.width || 0) };
  if (t === "money") Object.assign(d, { hozAlign: "right", headerHozAlign: "right", formatter: (x) => (x.getValue() == null ? "" : inr(x.getValue())) });
  if (t === "number") Object.assign(d, { hozAlign: "right", headerHozAlign: "right" });
  if (t === "date") d.formatter = (x) => (x.getValue() ? dateFmt(x.getValue()) : "");
  if (t === "checkbox") { d.formatter = "tickCross"; d.hozAlign = "center"; }
  else if (t === "select" || ENUMISH.test(String(d.field))) d.formatter = (x) => { const v = x.getValue(); return v == null || v === "" ? "" : esc(enumLabel(v)); };
  if (edit) {
    d.editor = t === "checkbox" ? "tickCross" : t === "money" || t === "number" ? "number" : t === "select" ? "list" : t === "date" ? "date" : "input";
    if (t === "select") d.editorParams = { values: c.options || [], clearable: true };
    if (t === "date") d.editorParams = { format: "yyyy-MM-dd" };
  }
  return d;
}

/** The range-select grid focuses its first cell when it builds, which scrolls the page down under the top bar. Put the page back. */
function settleScroll(t) {
  const top = () => { const a = document.activeElement; if (a && a.closest?.(".tabulator")) a.blur(); window.scrollTo(0, 0); };
  t.on("tableBuilt", top); setTimeout(top, 120);
}

async function coreGrid(ctx, name, core) {
  const g = await get(`grid/${name}`);
  const label = core.find((x) => x[0] === name)?.[1] || name;
  ctx.root.querySelector("#sh-t").textContent = label;
  ctx.root.querySelector("#sh-s").textContent = `${num(g.rows.length)} rows. ${g.columns.some((c) => c.editable) ? "Edit the white-text columns; the rest are read-only." : "Read-only for you."}`;
  const body = ctx.root.querySelector("#body"); body.innerHTML = `<div class="toolbar pad-top"><label class="search"><span class="sr">Filter rows</span>${icon("search", "")}<input class="input" id="gq" type="search" placeholder="Filter rows"></label></div><div class="grid-wrap"><div id="g"></div></div>`;
  table = makeGrid(body.querySelector("#g"), {
    ...gridOpts, data: g.rows, index: g.pk, placeholder: "No rows.",
    columns: g.columns.map((c, i) => ({ ...colDef(c, c.editable), })),
  });
  settleScroll(table);
  const act = ctx.root.querySelector("#sh-a"); act.replaceChildren(columnsButton(() => table), ...(can("exports.ops", "exports.money") ? [exportButtons(() => table, `classic-auto-${name}`, "any")] : []));
  body.querySelector("#gq").addEventListener("input", debounce((e) => { const q = e.target.value.toLowerCase(); table.setFilter((r) => !q || Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q))); }, 150));
  table.on("cellEdited", async (cell) => {
    const f = cell.getField(), r = cell.getData(); if (cell.getValue() === cell.getOldValue()) return;
    try { const upd = await api.patch(`grid/${name}/${r[g.pk]}`, { [f]: cell.getValue(), ...(g.versioned ? { version: r.version } : {}) }); cell.getRow().update(upd); toast("Saved", "ok"); }
    catch (e) { cell.restoreOldValue(); toast(e.message, "err"); }
  });
}

async function sheetGrid(ctx, id, list) {
  const r = await get(`sheets/${id}`);
  const s = r.sheet, edit = s.can_edit;
  ctx.root.querySelector("#sh-t").textContent = s.name;
  ctx.root.querySelector("#sh-s").textContent = `${num(r.rows.length)} rows · visible to ${({ private: "only you", owners: "owners", managers: "managers and owners", everyone: "everyone with sheets" })[s.visibility] || s.visibility}. ${edit ? "You can edit." : "Read-only for you."}`;
  const body = ctx.root.querySelector("#body");
  body.innerHTML = `<div class="grid-wrap"><div id="g"></div></div>`;
  const rows = r.rows.map((x) => ({ _id: x.id, _v: x.version, _pos: x.position, ...x.data }));
  const save1 = async (row) => {
    const data = {}; s.columns.forEach((c) => { data[c.key] = row[c.key] ?? null; });
    const res = await api.put(`sheets/${id}/rows`, { upserts: [{ id: row._id, version: row._v, position: row._pos, data }] });
    if (res.conflicts?.length) throw new Error("Someone else changed this row. Reload the sheet.");
    return res;
  };
  table = makeGrid(body.querySelector("#g"), { ...gridOpts, data: rows, index: "_id", placeholder: "No rows yet. Use Add row.", columns: s.columns.map((c, i) => ({ ...colDef(c, edit), })).concat(edit ? [{ title: "", field: "_x", width: 56, hozAlign: "center", headerSort: false, formatter: () => `<span class="faint" title="Delete this row">${icon("trash", "")}</span>`, cellClick: async (e, cell) => { if (!(await confirmDialog({ title: "Delete this row?", text: "This cannot be undone.", confirmLabel: "Delete row", danger: true }))) return; try { await api.put(`sheets/${id}/rows`, { deletes: [cell.getData()._id] }); cell.getRow().delete(); toast("Row deleted", "ok"); } catch (er) { toast(er.message, "err"); } } }] : []) });
  settleScroll(table);
  const act = ctx.root.querySelector("#sh-a");
  const nodes = [columnsButton(() => table), ...(can("exports.ops", "exports.money") ? [exportButtons(() => table, `classic-auto-${s.name.replace(/\W+/g, "-").toLowerCase()}`, "any")] : [])];
  if (edit) { const b = document.createElement("button"); b.className = "btn sm primary"; b.type = "button"; b.innerHTML = `${icon("plus")}Add row`; b.addEventListener("click", async () => { try { const res = await api.put(`sheets/${id}/rows`, { upserts: [{ position: (rows.length + 1) * 10, data: {} }] }); const added = res.rows[res.rows.length - 1]; table.addRow({ _id: added.id, _v: added.version, _pos: added.position, ...added.data }, false); toast("Row added", "ok"); } catch (e) { toast(e.message, "err"); } }); nodes.unshift(b); }
  if (can("sheets.manage")) { const d = document.createElement("button"); d.className = "btn sm ghost danger"; d.type = "button"; d.setAttribute("aria-label", "Delete this sheet"); d.innerHTML = icon("trash"); d.addEventListener("click", async () => { if (await confirmDialog({ title: `Delete “${s.name}”?`, text: "The sheet and all its rows are removed.", confirmLabel: "Delete sheet", danger: true })) { await api.del(`sheets/${id}`); toast("Sheet deleted", "ok"); ctx.go("#/sheets"); ctx.refresh(); } }); nodes.push(d); }
  act.replaceChildren(...nodes);
  table.on("cellEdited", async (cell) => {
    if (cell.getField() === "_x" || cell.getValue() === cell.getOldValue()) return;
    const row = cell.getRow().getData();
    try { const res = await save1(row); const upd = res.rows.find((x) => x.id === row._id); if (upd) cell.getRow().update({ _v: upd.version }); toast("Saved", "ok"); }
    catch (e) { cell.restoreOldValue(); toast(e.message, "err"); }
  });
}

function newSheet(ctx) {
  formDrawer({ title: "New sheet", sub: "A free-form table, for example a car mela list.", submit: "Create sheet", ok: "Sheet created",
    fields: [{ name: "name", label: "Name", type: "text", required: true, full: true }, { name: "visibility", label: "Who can see it", type: "select", value: "owners", options: [["private", "Only me"], ["owners", "Owners"], ["managers", "Managers and owners"], ["everyone", "Everyone with sheets"]] },
      { name: "cols", label: "Columns", type: "textarea", required: true, full: true, value: "Name | text\nPhone | text\nBudget | money", hint: "One column per line as Title | type. Types: text, number, money, date, checkbox." }],
    onSubmit: async (v) => {
      const cols = v.cols.split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => { const [t, ty] = l.split("|").map((x) => x.trim()); return { key: (t || "col").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "c$1") || `col_${i + 1}`, title: t, type: ["text", "number", "money", "date", "checkbox"].includes(ty) ? ty : "text" }; });
      const seen = new Set(); cols.forEach((c, i) => { while (seen.has(c.key)) c.key += "_" + (i + 1); seen.add(c.key); });
      const r = await api.post("sheets", { name: v.name, visibility: v.visibility, columns: cols }); location.hash = `#/sheets?t=${encodeURIComponent("sheet:" + r.id)}`; ctx.refresh();
    } });
}
export { sentence };
