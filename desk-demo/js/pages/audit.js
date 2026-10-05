// Audit log viewer: who did what, when, from where. Rows are append-only on the server.
// Without money access the detail of money, bank and export rows arrives blank from the API.
import { get } from "../api.js";
import { can } from "../state.js";
import { actionText } from "../caps.js";
import { dateFmt, debounce, esc, icon, mount, num, ago } from "../util.js";
import { pageHead } from "../ui.js";
import { card } from "./_shared.js";

const KINDS = [
  ["all", "Everything", () => true],
  ["money", "Money and bank", (r) => /^(view\.(money|accounts|expenses|bank)|bank\.|expense\.|export)/.test(r.action) || ["bank_account", "loan", "banker", "expense", "ledger_entry", "bank_statement"].includes(r.entity)],
  ["reveal", "Bank reveals", (r) => r.action === "bank.reveal"],
  ["access", "Access changes", (r) => /^(access\.|user\.|session\.)/.test(r.action)],
  ["signin", "Sign-ins", (r) => r.action.startsWith("auth.")],
  ["docs", "Documents", (r) => r.action.startsWith("doc.")],
];
const moneyRow = (r) => KINDS[1][2](r);
const PAGE = 500;

export async function render(ctx) {
  const res = await get("admin/audit", { page_size: PAGE });
  if (!ctx.alive()) return;
  let kind = "all", q = "";
  const rows = res.data;
  mount(ctx.root, pageHead({ title: "Audit log", sub: `${num(res.total)} entries in all. Every sign-in, money view, export, unmask and change of access is written here, and nobody can edit it.` })
    + card({ title: "Activity", sub: `Showing the latest ${num(rows.length)}.`, cls: "c12", flush: true, body: `<div class="toolbar"><div class="seg" id="kinds" role="group" aria-label="Kind of entry"></div><label class="search"><span class="sr">Search the log</span>${icon("search", "")}<input class="input" id="q" type="search" placeholder="Search person, action or detail"></label></div><div id="list" class="pad-box"></div>`}));
  const list = ctx.root.querySelector("#list"), kinds = ctx.root.querySelector("#kinds");
  const draw = () => {
    kinds.innerHTML = KINDS.map(([k, l, f]) => `<button type="button" aria-pressed="${kind === k}" data-k="${k}">${l}<span class="n">${num(rows.filter(f).length)}</span></button>`).join("");
    const f = KINDS.find((x) => x[0] === kind)[2], needle = q.toLowerCase();
    const shown = rows.filter(f).filter((r) => !needle || `${r.username} ${r.action} ${actionText(r.action)} ${r.entity || ""} ${r.detail || ""}`.toLowerCase().includes(needle));
    const lines = collapse(shown.slice(0, 200));
    list.innerHTML = lines.length ? lines.map(({ r, n }) => `<div class="audit-row${hot(r) ? " hot" : ""}"><div class="when">${esc(when(r.ts))}<br><span class="faint">${esc(ago(r.ts))}</span></div>
      <div class="what"><b>${esc(plain(r))}</b>${n > 1 ? ` <span class="badge">${n} times</span>` : ""}<div class="muted">${esc(detail(r))}</div><div class="faint">${esc(r.ip || "")}</div></div></div>`).join("") : `<div class="empty">${icon("history", "")}<b>No entries match</b><p>Try another kind of entry or clear the search.</p></div>`;
  };
  draw();
  kinds.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) { kind = b.dataset.k; draw(); } });
  ctx.root.querySelector("#q").addEventListener("input", debounce((e) => { q = e.target.value; draw(); }, 150));
}

// ---- plain sentences instead of developer terms. Red is kept for reveals, access changes, failed sign-ins and exports.
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const when = (ts) => { const [y, m, d] = ts.slice(0, 10).split("-").map(Number); let h = +ts.slice(11, 13); const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return `${d} ${MON[m - 1]}, ${h}:${ts.slice(14, 16)} ${ap}`; };
const hot = (r) => r.action === "bank.reveal" || r.action === "pii.reveal_pan_limit" || /^(access\.|export|auth\.(login_failed|locked|csrf_fail))/.test(r.action) || r.action === "user.reset_password";
const PLACES = [[/^(pnl|kpis|insights|financials|overheads|export\/pnl)/, "Profit and loss"], [/^(accounts|payments|ledger)/, "Accounts"], [/^(expenses|vendors|recurring|expense-budgets|expense-categories)/, "Expenses"], [/^(bank|loans|bankers)/, "Bank and finance"]];
function place(r) {
  let path = ""; try { path = (JSON.parse(r.detail || "{}").path || "").replace(/^\/api\//, ""); } catch { /* none */ }
  const hit = PLACES.find(([re]) => re.test(path));
  if (hit) return hit[1];
  return { "view.money": "Profit and loss", "view.accounts": "Accounts", "view.expenses": "Expenses", "view.bank": "Bank and finance" }[r.action] || null;
}
function plain(r) {
  const who = (r.username || "Someone").replace(/^demo-/, "");
  const name = who.charAt(0).toUpperCase() + who.slice(1);
  if (r.action.startsWith("view.")) { const pl = place(r); if (pl) return `${name} looked at ${pl}`; }
  if (r.action === "bank.reveal") { let f = ""; try { f = (JSON.parse(r.detail || "{}").field || "").replace(/_/g, " "); } catch { /* none */ } return `${name} unmasked a bank ${f || "detail"}`; }
  return `${actionText(r.action)} by ${name}`;
}
/** Repeats of the same line by the same person (one page load fires several requests) fold into one row. */
function collapse(list) {
  const out = [];
  for (const r of list) {
    const key = `${r.username}|${plain(r)}|${r.ts.slice(0, 13)}`;
    const last = out[out.length - 1];
    if (last && last.key === key && !hot(r)) last.n += 1; else out.push({ r, n: 1, key });
  }
  return out;
}

function detail(r) {
  if (!r.detail) return can("money.view") ? "" : moneyRow(r) ? "Details hidden without money access." : "";
  try {
    const d = JSON.parse(r.detail);
    const iso = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? dateFmt(v) : v);
    const val = (v) => v == null ? "none" : Array.isArray(v) ? v.map(val).join(", ") : typeof v === "object" ? Object.values(v).filter((x) => x != null && x !== "").map(val).join(" to ") : String(iso(v));
    return Object.entries(d).filter(([k]) => k !== "path").map(([k, v]) => `${k.replace(/_/g, " ")}: ${val(v)}`).join(" · ");
  } catch { return String(r.detail); }
}
