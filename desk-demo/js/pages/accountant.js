// Accountant home: what needs doing in the books today. Pending expenses, bank lines that match nothing yet, bills still owed.
// Every call is guarded by the money capabilities; a locked (no two-factor yet) session sees only the banner.
import { get } from "../api.js";
import { state, can } from "../state.js";
import { esc, icon, inr, lakh, mount, num } from "../util.js";
import { pageHead } from "../ui.js";
import { firstName, greeting } from "./_brief.js";

const settle = (p) => p.then((v) => v, () => null);

export async function render(ctx) {
  const [pending, stmts, pay] = await Promise.all([
    can("expenses.view") ? settle(get("expenses", { status: "pending" })) : null,
    can("accounts.view") ? settle(get("accounts/statements")) : null,
    can("accounts.view") ? settle(get("accounts/payables")) : null,
  ]);
  if (!ctx.alive()) return;
  const waiting = pending?.data || [], waitingSum = waiting.reduce((s, x) => s + x.amount, 0);
  const unmatched = (stmts?.data || []).reduce((s, x) => s + (x.unmatched || 0), 0);
  const owed = pay?.totals?.expenses_unpaid || 0, owedN = (pay?.expenses_unpaid || []).length;
  const tile = (href, label, value, sub, hot) => `<a class="bal-tile${hot ? " hot" : ""}" href="${href}"><div class="l">${esc(label)}</div><div class="v">${value}</div><div class="s">${esc(sub)}</div></a>`;
  const banner = state.locked.length ? `<div class="callout warn rise">${icon("lock", "")}<div><b>Your books are locked until you enter your two-factor code.</b><p>Set it up or enter it on the <a href="#/security">Security page</a>. Nothing below shows until then.</p></div></div><div class="sec-gap"></div>` : "";
  mount(ctx.root, pageHead({ title: "Books desk", sub: `${esc(greeting())}, ${esc(firstName())}. What needs doing in the books.` }) + banner
    + `<div class="bal-strip rise">${can("expenses.view") ? tile("#/expenses?tab=queue", "Expenses waiting", num(waiting.length), `${lakh(waitingSum)} to approve`, waiting.length > 0) : ""}
      ${can("accounts.view") ? tile("#/accounts?tab=recon", "Bank lines to match", num(unmatched), unmatched ? "Open the statement and match them" : "Everything is matched", unmatched > 0) : ""}
      ${can("accounts.view") ? tile("#/accounts?tab=owed", "Bills still owed", num(owedN), `${lakh(owed)} unpaid`, owedN > 0) : ""}</div>`);
}
