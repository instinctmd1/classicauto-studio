// The one place the Desk screens talk to the server. Live: the real /api routes (APP-SPEC section 8.3).
// When a route does not exist yet (the server answers a bare 404 "Not Found" or 405), the call is answered from the
// sample data in desk-mock.js with the same JSON shape, and the screen shows a "Sample data" chip.
// Demo bundle: answers come from data/manifest.json when it has them, else from the same sample data; actions change an
// in-memory copy only. To wire a screen to the real server nothing here needs to change: ship the route.
import * as api from "./api.js";
import { ApiError, DEMO } from "./api.js";
import { state, homeKind } from "./state.js";
import { createStore } from "./desk-mock.js";
import { toast } from "./ui.js";

const sampled = new Set();                    // areas ("desk", "chat", "ask", "push") answered from sample data
const area = (path) => path.split("/")[0];

/** A route the server does not have (as opposed to a real 404 for a lead you may not see, which carries a message). */
const routeMissing = (e) => e instanceof ApiError && ((e.status === 404 && (e.code === "not_in_demo" || e.message === "Not Found")) || e.status === 405 || e.status === 501);

function personaRole() {
  const r = state.user?.role;
  if (r === "salesman" || (homeKind() === "salesman" && r !== "accountant" && r !== "admin")) return "salesman";
  if (r === "manager") return "manager";
  if (r === "owner" || state.user?.is_super_admin) return "owner";
  return "staff";
}

let store = null, storeKey = "";
async function getStore() {
  const role = DEMO ? (await api.demoRole()) : personaRole();
  const key = `${role}:${state.user?.id ?? ""}`;
  if (!store || storeKey !== key) {
    const load = DEMO ? async (path, params) => { try { return await api.get(path, params); } catch (e) { if (routeMissing(e)) return null; throw e; } } : null;
    store = createStore({ role: role === "owner" || role === "manager" || role === "salesman" ? role : "staff", me: state.user, load });
    storeKey = key;
  }
  return store;
}
/** Forget the in-memory copy (demo role switch, sign-out). */
export function resetDeskStore() { store = null; storeKey = ""; sampled.clear(); }

/** True when this area of the screen shows sample data (always in the demo). */
export const isSample = (path) => DEMO || sampled.has(area(path));

export async function get(path, params, opts = {}) {
  if (DEMO) return (await getStore()).get(path, params || {});
  try { return await api.get(path, params, opts); }
  catch (e) { if (!routeMissing(e)) throw e; sampled.add(area(path)); return (await getStore()).get(path, params || {}); }
}

export async function send(method, path, body) {
  if (DEMO || sampled.has(area(path))) return (await getStore()).send(method, path, body || {});
  try { return await api.send(method, path, body ?? {}); }
  catch (e) { if (!routeMissing(e)) throw e; sampled.add(area(path)); return (await getStore()).send(method, path, body || {}); }
}
export const post = (path, body) => send("POST", path, body ?? {});
export const del = (path) => send("DELETE", path);

export async function upload(path, formData) {
  if (DEMO || sampled.has(area(path))) return (await getStore()).upload(path, formData);
  try { return await api.upload(path, formData); }
  catch (e) { if (!routeMissing(e)) throw e; sampled.add(area(path)); return (await getStore()).upload(path, formData); }
}

/** Success toast. In the demo (or on sample data) it also says nothing was saved. */
export function done(msg, path = "desk/") {
  if (isSample(path)) toast(`${msg}. Demo: nothing is saved.`, "demo");
  else toast(msg, "ok");
}

/** A small chip for screens showing sample answers on the live server (the demo has its own banner). */
export function sampleChip(path) {
  return !DEMO && sampled.has(area(path)) ? `<span class="badge warn sample-chip" title="This part of the server is not switched on yet, so made-up sample data is shown.">Sample data</span>` : "";
}
