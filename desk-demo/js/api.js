// API adapter. Live: fetch /api/* with the session cookie and the CSRF header on every mutation.
// Demo (the static snapshot in demo-static/): GETs replay recorded fictional JSON through data/manifest.json;
// every write is refused with a toast.

const mode = document.querySelector('meta[name="ca-mode"]')?.content || "live";
export const DEMO = mode === "demo";

let csrf = "";
export const setCsrf = (t) => { csrf = t || ""; };

export class ApiError extends Error {
  constructor(status, code, message, fields, body) {
    super(message || code || "Request failed");
    this.status = status; this.code = code; this.fields = fields || null; this.body = body || null;
  }
}

/** Same rule as key_for() in scripts/build_demo.py: path + sorted k=v pairs, empty values dropped. */
export function keyFor(path, params) {
  const p = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)]);
  p.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return path + (p.length ? "?" + p.map(([k, v]) => `${k}=${v}`).join("&") : "");
}

let manifest = null;
export const demoMisses = [];
if (DEMO) window.__demoMisses = demoMisses;

// The demo replays what the real server answered, role by role (scripts/build_demo.py records it from the fictional
// demo database). manifest.roles[role][key] = [http status, file under data/]. Error answers replay as errors.
const ROLE_KEY = "ca.demoRole";
let role = null;
const bodies = new Map();

async function loadManifest() {
  if (!manifest) {
    const r = await fetch("data/manifest.json");
    if (!r.ok) throw new ApiError(500, "demo_data", "Demo data is missing.");
    manifest = await r.json();
  }
  return manifest;
}
export async function demoMeta() { return (await loadManifest()).meta; }
/** The role the demo is showing: the saved choice when the bundle has it, else the bundle's default. */
export async function demoRole() {
  if (role) return role;
  const m = await loadManifest();
  let saved = null;
  try { saved = localStorage.getItem(ROLE_KEY); } catch { /* storage blocked */ }
  role = saved && m.roles[saved] ? saved : m.meta.default_role;
  return role;
}
export function setDemoRole(r) {
  role = r;
  try { localStorage.setItem(ROLE_KEY, r); } catch { /* storage blocked */ }
}

async function demoGet(path, params) {
  const m = await loadManifest();
  const key = keyFor(path, params);
  const hit = (m.roles[await demoRole()] || {})[key];
  if (!hit) {
    demoMisses.push(key);
    console.warn("demo: no bundled data for", key);
    throw new ApiError(404, "not_in_demo", "This view is not part of the demo data.");
  }
  const [status, file] = hit;
  if (!bodies.has(file)) {
    const r = await fetch("data/" + file);
    if (!r.ok) throw new ApiError(r.status, "demo_data", "Could not load demo data.");
    bodies.set(file, await r.json());
  }
  const body = structuredClone(bodies.get(file));          // pages may sort or annotate what they get: never share one copy
  if (status >= 400) {
    const e = body && body.error ? body.error : {};
    throw new ApiError(status, e.code || "error", e.message || `Request failed (${status})`, e.fields, body);
  }
  return body;
}

export let lastTouch = Date.now();
/** background: a poll the person did not ask for. It must not count as activity (the idle chip, the server's idle timer). */
async function parse(res, background = false) {
  if (!background) lastTouch = Date.now();
  let body = null;
  const ct = res.headers.get("content-type") || "";
  if (res.status !== 204 && ct.includes("json")) { try { body = await res.json(); } catch { body = null; } }
  if (res.ok) return body;
  const e = body && body.error ? body.error : {};
  if (res.status === 401 && e.code === "unauthenticated") window.dispatchEvent(new CustomEvent("ca:unauth"));
  if (res.status === 403 && e.code === "mfa_required") window.dispatchEvent(new CustomEvent("ca:mfa"));
  throw new ApiError(res.status, e.code || "error", e.message || `Request failed (${res.status})`, e.fields, body);
}

/** opts.background: send X-CA-Background so the server does not slide the idle timeout (APP-SPEC G5). */
export async function get(path, params, opts = {}) {
  if (DEMO) return demoGet(path, params);
  const q = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const headers = { Accept: "application/json" };
  if (opts.background) headers["X-CA-Background"] = "1";
  const res = await fetch(`/api/${path}${q ? "?" + q : ""}`, { credentials: "same-origin", headers });
  return parse(res, !!opts.background);
}

function blocked() {
  window.dispatchEvent(new CustomEvent("ca:toast", { detail: { msg: "Demo data: changes are not saved.", kind: "demo" } }));
  return Promise.reject(new ApiError(0, "demo", "Demo mode: changes are not saved."));
}

export async function send(method, path, body) {
  if (DEMO) return blocked();
  const res = await fetch(`/api/${path}`, {
    method, credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse(res);
}
export const post = (p, b) => send("POST", p, b ?? {});
export const patch = (p, b) => send("PATCH", p, b);
export const put = (p, b) => send("PUT", p, b);
export const del = (p) => send("DELETE", p);

export async function upload(path, formData) {
  if (DEMO) return blocked();
  const res = await fetch(`/api/${path}`, { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": csrf, Accept: "application/json" }, body: formData });
  return parse(res);
}

/** Link for a document download (a plain GET with the session cookie; audited by the server). */
export function docUrl(uuid) { return DEMO ? "sample.pdf" : `/api/documents/${uuid}/download`; }
export function exportUrl(table, fmt, params) {
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  return `/api/export/${table}.${fmt}${q}`;
}
