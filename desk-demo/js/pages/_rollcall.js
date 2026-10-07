// Evening roll-call (APP-SPEC section 12): the shared bits of #/rollcall and the strip on top of the Inbox.
// The engine sends the roll-call at closing time; the app shows it from the dashboard's mirror and answers through the
// bridge. Lead numbers, cars and names only for the salesman's own leads; never a phone.
import { DEMO } from "../api.js";
import { esc, icon } from "../util.js";
import * as desk from "../desk-api.js";

export const LOST = [["price", "Price too high"], ["finance_rejected", "Loan not approved"], ["bought_elsewhere", "Bought elsewhere"], ["car_already_sold", "Car already sold"],
  ["exchange_value", "Exchange value too low"], ["customer_unreachable", "Could not reach the customer"], ["not_serious", "Not serious"], ["location", "Too far away"], ["other", "Other reason"]];
export const ANSWER = { sold: ["Sold", "pos"], followup: ["Follow-up", "info"], lost: ["Lost", "neg"], moved: ["Moved on", ""] };

/** The roll-call pages only exist on the live app: the demo bundle has no engine to answer them. */
export const rollcallLive = () => !DEMO;

export function answerBadge(a) {
  const [label, kind] = ANSWER[a] || ["Answered", ""];
  return `<span class="badge ${kind}">${icon(a === "lost" ? "x" : a === "moved" ? "right" : "check", "")}${esc(label)}</span>`;
}

/** Inbox strip: a salesman's open roll-call ("3 leads to answer"), or tonight's team count for the manager and owners. */
export async function rollcallStrip(host, alive = () => true) {
  if (!host || !rollcallLive()) return;
  let r;
  try { r = await desk.get("rollcall", {}, { background: true }); } catch { if (alive()) host.innerHTML = ""; return; }
  if (!alive()) return;
  const open = (r.mine || []).filter((c) => c.state === "open");
  const left = open.reduce((n, c) => n + (c.total - c.answered), 0);
  if (left > 0) {
    host.innerHTML = `<a class="strip rc-strip" href="#/rollcall">${icon("moon", "")}<span><b>Evening roll-call: ${left} lead${left === 1 ? "" : "s"} to answer</b><span class="muted">Sold, Follow-up or Lost for each one. No answer by the next roll-call means 2 days of fewer leads.</span></span><span class="btn sm primary">Answer</span></a>`;
    return;
  }
  const b = r.board;
  if (b && b.sent) {
    host.innerHTML = `<a class="strip notify rc-strip" href="#/rollcall">${icon("moon", "")}<span><b>Roll-call: ${b.answered} of ${b.sent} seat${b.sent === 1 ? "" : "s"} answered</b><span class="muted">${String(b.day || "") < new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10) ? "The last roll-call's status from every salesman" : "Tonight's status from every salesman"}</span></span><span class="btn sm">See</span></a>`;
    return;
  }
  host.innerHTML = "";
}
