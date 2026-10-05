// "Claimed, never visited": open leads a salesman claimed N or more days ago with no showroom visit or test drive logged.
// Shared by the Salesmen page (full list, 7 / 14 / 30 days) and the manager's desk (one line per salesman).
import { bandShort, chan } from "../state.js";
import { badge, dateFmt, esc, icon, num, sentence } from "../util.js";

const short = (n) => String(n || "").replace(/\s*\(demo\)/, "");
const ACT = { claimed: "Claimed", contacted: "Contacted", visit_requested: "Asked for a visit", customer_confirmed: "Customer confirmed the call", customer_denied: "Customer said nobody called", missed: "Missed", reassigned: "Reassigned", followup: "Follow-up" };
const actLabel = (k) => ACT[k] || sentence(k || "claimed");

function emptyHtml(res) {
  if (res?.engine && !res.engine.available && !res.total) return `<div class="empty">${icon("inbox", "")}<b>No leads to check</b><p>The lead engine's figures have not reached this dashboard yet, so nothing can be listed.</p></div>`;
  return `<div class="empty">${icon("check", "")}<b>Every claimed lead has come in</b><p>No open lead claimed ${num(res?.days || 7)} or more days ago is missing a showroom visit or a test drive.</p></div>`;
}

function flagsHtml(l) {
  const f = [];
  if (l.drive_booked) f.push(badge("Test drive booked, not logged", "warn"));
  else if (l.visit_requested) f.push(badge("Asked for a visit", "info"));
  return f.join("");
}

/** One line per salesman with his count and the most recent names: for the manager's desk. */
export function neverVisitedCompact(res, rows = 5) {
  if (!res?.total) return emptyHtml(res);
  return `<ul class="list">${res.groups.slice(0, rows).map((g) => {
    const names = g.leads.slice(0, 2).map((l) => `${l.name || "No name"} (${l.days_since_claim} d)`).join(", ");
    return `<li><span class="avatar sm">${esc(short(g.name).slice(0, 2).toUpperCase())}</span><a class="grow" href="#/team?view=never"><div class="t">${esc(short(g.name))}</div><div class="s">${esc(names)}${g.count > 2 ? ` and ${num(g.count - 2)} more` : ""}</div></a><span class="badge ${g.count >= 5 ? "neg" : "warn"}">${num(g.count)}</span></li>`;
  }).join("")}</ul>`;
}

const SHOWN = 8;            // per salesman; the rest open under "Show N more"
const head = `<thead><tr><th>Customer</th><th>Car asked about</th><th>Claimed</th><th>Last activity</th><th>Flags</th></tr></thead>`;
const rowHtml = (l) => `<tr><td><b>${esc(l.name || "No name")}</b><span class="sub">${esc(chan(l.channel))}${l.band && l.band !== "unknown" ? " · " + esc(bandShort(l.band)) : ""}</span></td><td>${esc(l.car || "Not named")}</td><td>${esc(dateFmt(l.claimed_at, false))}<span class="sub">${num(l.days_since_claim)} days ago</span></td><td>${esc(actLabel(l.last_activity))}<span class="sub">${esc(dateFmt(l.last_activity_at, false))}</span></td><td>${flagsHtml(l)}</td></tr>`;

/** Every salesman's list, newest claim first: for the Salesmen page. */
export function neverVisitedFull(res) {
  if (!res?.total) return emptyHtml(res);
  return `<div class="pad-box stack-form">${res.groups.map((g) => {
    const more = g.leads.slice(SHOWN);
    return `<section class="nv-group"><div class="sec-h"><h3><span class="avatar sm">${esc(short(g.name).slice(0, 2).toUpperCase())}</span>${esc(short(g.name))}</h3><span class="badge ${g.count >= 5 ? "neg" : "warn"}">${num(g.count)} never visited</span></div>
    <div class="scroll-x"><table class="tbl left">${head}<tbody>${g.leads.slice(0, SHOWN).map(rowHtml).join("")}</tbody></table></div>
    ${more.length ? `<details class="nv-more"><summary>Show ${num(more.length)} more, claimed earlier</summary><div class="scroll-x"><table class="tbl left">${head}<tbody>${more.map(rowHtml).join("")}</tbody></table></div></details>` : ""}</section>`;
  }).join("")}</div>`;
}
