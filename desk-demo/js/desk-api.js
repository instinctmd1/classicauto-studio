// The one place the Desk screens talk to the server.
// Live: the real /api routes (APP-SPEC section 8.3), errors and all: a missing route or a refusal shows as an error on
// the screen, never as made-up data.
// Demo bundle (meta ca-mode = demo): answers come from data/manifest.json when it has them, else from the sample data in
// desk-mock.js with the same JSON shapes; actions change an in-memory copy only and toast "Demo: nothing is saved".
import * as api from "./api.js";
import { ApiError, DEMO } from "./api.js";
import { state } from "./state.js";
import { createStore } from "./desk-mock.js";
import { toast } from "./ui.js";

/** A view the demo bundle has no recording for (the sample data answers it instead). */
const notBundled = (e) => e instanceof ApiError && ((e.status === 404 && e.code === "not_in_demo") || e.status === 405 || e.status === 501);

let store = null, storeKey = "";
async function getStore() {
  const role = await api.demoRole();
  const key = `${role}:${state.user?.id ?? ""}`;
  if (!store || storeKey !== key) {
    const load = async (path, params) => { try { return await api.get(path, params); } catch (e) { if (notBundled(e)) return null; throw e; } };
    store = createStore({ role: ["owner", "manager", "salesman"].includes(role) ? role : "staff", me: state.user, load });
    storeKey = key;
  }
  return store;
}
/** Forget the in-memory demo copy (demo role switch, sign-out). */
export function resetDeskStore() { store = null; storeKey = ""; }

/** True when the screen shows sample data: only in the demo bundle. */
export const isSample = () => DEMO;

export async function get(path, params, opts = {}) {
  if (DEMO) return (await getStore()).get(path, params || {});
  return api.get(path, params, opts);
}

export async function send(method, path, body, opts = {}) {
  if (DEMO) return (await getStore()).send(method, path, body || {});
  return api.send(method, path, body ?? {}, opts);
}
/** opts.background: a write the person did not make (a read receipt): it does not keep the session awake. */
export const post = (path, body, opts) => send("POST", path, body ?? {}, opts);
export const del = (path) => send("DELETE", path);

export async function upload(path, formData) {
  if (DEMO) return (await getStore()).upload(path, formData);
  return api.upload(path, formData);
}

/** Success toast. In the demo it also says nothing was saved. */
export function done(msg) {
  if (DEMO) toast(`${msg}. Demo: nothing is saved.`, "demo");
  else toast(msg, "ok");
}

