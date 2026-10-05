// Classic Auto Desk: install prompt, service worker, notifications, the live feed (SSE with a polling fallback),
// claim countdowns, tab badges and a few small helpers the Desk screens share. APP-SPEC.md sections 1, 2, 5, 6, 9.
import * as api from "./api.js";
import { DEMO } from "./api.js";
import { can, state } from "./state.js";
import { $$, esc, icon, safeStore } from "./util.js";
import { openDrawer, toast } from "./ui.js";
import * as desk from "./desk-api.js";
import { istMs } from "./desk-mock.js";

// ------------------------------------------------------------------ platform
const ua = navigator.userAgent || "";
export const isIOS = () => /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
export const isAndroid = () => /Android/.test(ua);
export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
export const pushSupported = () => "serviceWorker" in navigator && "Notification" in window && "PushManager" in window;
export function deviceLabel() {
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (isAndroid()) return "Android phone";
  if (/Windows/.test(ua)) return "Windows computer";
  if (/Macintosh/.test(ua)) return "Mac";
  return "This device";
}

// ------------------------------------------------------------------ service worker and install prompt
let installEvent = null;
export const canPromptInstall = () => !!installEvent;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
  window.dispatchEvent(new CustomEvent("desk:install"));
});
window.addEventListener("appinstalled", () => {
  installEvent = null;
  safeStore("ca.installStrip", "hidden");
  window.dispatchEvent(new CustomEvent("desk:install"));
  toast("CA Desk is on your home screen.", "ok");
});
/** Shows the browser's own install dialog (Android and desktop Chrome). Resolves true when accepted. */
export async function promptInstall() {
  if (!installEvent) return false;
  const e = installEvent;
  installEvent = null;
  e.prompt();
  const choice = await e.userChoice.catch(() => ({ outcome: "dismissed" }));
  window.dispatchEvent(new CustomEvent("desk:install"));
  return choice.outcome === "accepted";
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register("sw.js", { scope: "./" }).catch((e) => console.warn("service worker not registered", e));
  navigator.serviceWorker.addEventListener("message", (e) => {
    const d = e.data || {};
    if (d.type === "navigate" && typeof d.url === "string") {
      const hash = d.url.includes("#") ? d.url.slice(d.url.indexOf("#")) : "#/inbox";
      if (/^#\/[a-z]+(\/[A-Za-z0-9_-]+)?(\?[^#]*)?$/.test(hash)) location.hash = hash;
    }
  });
}

// ------------------------------------------------------------------ notifications and web push
/** "on" | "off" | "blocked" | "unsupported" | "install-first" (iPhone: notifications need the installed app). */
export async function notifyState() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return isIOS() && !isStandalone() ? "install-first" : "unsupported";
  if (isIOS() && !isStandalone()) return "install-first";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  if (DEMO) return "on";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && "pushManager" in reg ? await reg.pushManager.getSubscription() : null;
    return sub ? "on" : "off";
  } catch { return "off"; }
}

function keyBytes(b64url) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Must run from a tap. Asks the browser, subscribes this device and tells the server. Returns the new state. */
export async function enableNotifications() {
  if (isIOS() && !isStandalone()) { location.hash = "#/install"; return "install-first"; }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) { toast("This browser cannot show notifications. Open the link in Chrome (Android) or install the app (iPhone).", "err"); return "unsupported"; }
  const perm = await Notification.requestPermission();
  if (perm === "denied") return "blocked";
  if (perm !== "granted") return "off";
  if (DEMO) return "on";
  if (!("PushManager" in window)) return "unsupported";
  try {
    const reg = await navigator.serviceWorker.ready;
    const cfg = await desk.get("desk/config");
    if (desk.isSample("desk/") || !cfg.vapid_public_key || cfg.vapid_public_key.length < 60) {
      toast("Notifications are allowed on this phone. The server part is not switched on yet, so nothing will arrive today.", "");
      return "off";
    }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.vapid_public_key) });
    const j = sub.toJSON();
    const r = await desk.post("push/subscriptions", { endpoint: j.endpoint, keys: j.keys, device_label: deviceLabel() });
    if (r && r.id) safeStore("ca.pushSub", String(r.id));
    return "on";
  } catch (e) {
    console.warn(e);
    toast(e.message || "Could not turn on notifications. Try again.", "err");
    return "off";
  }
}

/** Sign-out from this device: the server forgets the subscription and the phone stops listening. */
export async function forgetThisDevice() {
  const id = safeStore("ca.pushSub");
  try { if (id) await api.del(`push/subscriptions/${id}`); } catch { /* already gone */ }
  safeStore("ca.pushSub", null);
  try { const reg = await navigator.serviceWorker?.getRegistration(); const sub = await reg?.pushManager?.getSubscription(); await sub?.unsubscribe(); } catch { /* nothing to undo */ }
}

const TEST = { title: "New lead #1042 (demo)", body: "Premium · WhatsApp · claim within 10 min", tag: "demo", url: "#/lead/1042" };
/** Demo: a local notification through the service worker. Live: the server sends a real push to this person's devices. */
export async function sendTestNotification() {
  if (isIOS() && !isStandalone()) { location.hash = "#/install"; toast("On iPhone, install the app first: Share, then Add to Home Screen.", ""); return; }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) { toast("This browser cannot show notifications.", "err"); return; }
  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm !== "granted") { toast(perm === "denied" ? "Notifications are blocked. Allow them in the phone's settings for this site." : "Notifications are still off.", "err"); return; }
  if (!DEMO && !desk.isSample("push/")) {
    try { await desk.post("push/test", {}); if (!desk.isSample("push/")) { toast("Test sent. It should arrive in a few seconds.", "ok"); return; } }
    catch (e) { toast(e.status === 429 ? "Three tests per 10 minutes. Try again a little later." : e.message || "Could not send the test.", "err"); return; }
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(TEST.title, { body: TEST.body, tag: TEST.tag, renotify: true, icon: "icons/icon-192.png", badge: "icons/badge-96.png", data: { url: TEST.url } });
    toast("Test notification sent to this phone.", "ok");
  } catch (e) {
    toast(`This phone did not show it: ${e.message || "try again in a few seconds"}.`, "err");
  }
}

// ------------------------------------------------------------------ page scope: listeners and timers that end with the page
let scope = { feed: [], timers: [], win: [] };
export function resetPageScope() {
  scope.timers.forEach((t) => clearInterval(t));
  scope.win.forEach(([type, fn]) => window.removeEventListener(type, fn));
  scope = { feed: [], timers: [], win: [] };
}
/** A window event listener that is removed when the page changes. */
export const onWindow = (type, fn) => { window.addEventListener(type, fn); scope.win.push([type, fn]); };
/** fn(row) for every feed row while the current page is open. */
export const onFeed = (fn) => { scope.feed.push(fn); };
export const every = (ms, fn) => { scope.timers.push(setInterval(fn, ms)); };

function dispatchFeed(row) {
  scope.feed.slice().forEach((fn) => { try { fn(row); } catch (e) { console.error(e); } });
  scheduleBadges();
}
window.addEventListener("desk:feed", (e) => dispatchFeed(e.detail || {}));

// ------------------------------------------------------------------ live feed: SSE, then polling after 3 errors in a minute
const KINDS = ["chat.message", "chat.deleted", "lead.new", "lead.changed", "ask.updated"];
let es = null, lastId = 0, errors = [], pollTimer = null, retryTimer = null, feedOn = false;

function onEvent(e) {
  const id = +e.lastEventId || 0;
  if (id && id <= lastId) return;
  if (id) lastId = id;
  let data = {};
  try { data = JSON.parse(e.data || "{}"); } catch { /* ids only */ }
  dispatchFeed({ id, kind: e.type, ...data });
}
function connect() {
  if (!feedOn) return;
  try { es = new EventSource(`/api/stream?after=${lastId}`); } catch { startPolling(); return; }
  KINDS.forEach((k) => es.addEventListener(k, onEvent));
  es.addEventListener("bye", () => { stopFeed(); api.get("me", null, { background: true }).catch(() => {}); });
  es.onerror = () => {
    const now = Date.now();
    errors = errors.filter((t) => now - t < 60000);
    errors.push(now);
    if (errors.length >= 3) { es.close(); es = null; startPolling(); return; }
    if (es.readyState === EventSource.CLOSED) { es = null; clearTimeout(retryTimer); retryTimer = setTimeout(connect, 3000); }
  };
}
function startPolling() {
  clearInterval(pollTimer);
  const poll = async () => {
    try {
      const r = await api.get("desk/feed", { after: lastId }, { background: true });
      for (const row of r.data || []) { if (row.id > lastId) { lastId = row.id; dispatchFeed(row); } }
      if (r.last_id > lastId) lastId = r.last_id;
    } catch (e) {
      if (e.status === 404 || e.status === 405 || e.status === 401) { clearInterval(pollTimer); pollTimer = null; }   // no feed on this server yet, or signed out
    }
  };
  poll();
  pollTimer = setInterval(poll, 10000);
}
export function startFeed() {
  if (DEMO || feedOn) return;
  feedOn = true; errors = [];
  connect();
}
export function stopFeed() {
  feedOn = false;
  es?.close(); es = null;
  clearInterval(pollTimer); pollTimer = null;
  clearTimeout(retryTimer);
}

// ------------------------------------------------------------------ desk clock: the server's IST time, moving on locally
let clockBase = { server: Date.now(), local: Date.now() };
export function setServerNow(s) { if (s) clockBase = { server: istMs(s), local: Date.now() }; }
export const deskNow = () => clockBase.server + (Date.now() - clockBase.local);
export function deskAgo(ts) {
  if (!ts) return "";
  const m = Math.max(0, Math.round((deskNow() - istMs(ts)) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  const d = Math.round(m / 1440);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "11:17" today, "Yesterday 16:10", "2 Oct 11:40". */
export function deskTime(ts) {
  if (!ts) return "";
  const s = String(ts), day = s.slice(0, 10), hm = s.slice(11, 16);
  const today = new Date(deskNow() + 5.5 * 36e5).toISOString().slice(0, 10);
  const yest = new Date(deskNow() + 5.5 * 36e5 - 864e5).toISOString().slice(0, 10);
  if (day === today) return hm;
  if (day === yest) return `Yesterday ${hm}`;
  return `${+day.slice(8, 10)} ${MON[+day.slice(5, 7) - 1]} ${hm}`;
}

// ------------------------------------------------------------------ claim countdown
/** Markup for a claim clock. Ticks every second through tickClocks(); turns red under 2 minutes. */
export function clockHtml(claim, { big = false } = {}) {
  if (!claim) return "";
  if (claim.paused) {
    const t = claim.paused_until ? String(claim.paused_until).slice(11, 16) : "10:00";
    return `<span class="claim-clock paused${big ? " big" : ""}">${icon("clock", "")}<span>Clock starts at ${esc(t)}</span></span>`;
  }
  const due = istMs(claim.deadline_at) - deskNow() + Date.now();     // in this phone's clock
  return `<span class="claim-clock${big ? " big" : ""}" data-due="${due}" role="timer" aria-live="off">${icon("clock", "")}<span class="t">${fmtLeft(due - Date.now())}</span></span>`;
}
function fmtLeft(ms) {
  if (ms <= 0) return "Time up, reassigning";
  const s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")} left`;
}
let ticker = null;
function tickClocks() {
  const nodes = $$(".claim-clock[data-due]");
  if (!nodes.length) return;
  const now = Date.now();
  for (const n of nodes) {
    const left = +n.dataset.due - now;
    const t = n.querySelector(".t"); if (t) t.textContent = fmtLeft(left);
    n.classList.toggle("hot", left > 0 && left < 120000);
    n.classList.toggle("over", left <= 0);
    if (left <= 0 && !n.dataset.fired) {
      n.dataset.fired = "1";
      setTimeout(() => dispatchFeed({ kind: "lead.changed", why: "clock" }), 30000);
    }
  }
}
export function startTicker() { if (!ticker) ticker = setInterval(tickClocks, 1000); }

// ------------------------------------------------------------------ badges on the tabs and in the sidebar
let badgeTimer = null;
function scheduleBadges() { clearTimeout(badgeTimer); badgeTimer = setTimeout(refreshBadges, 800); }
function paint(name, n, title) {
  $$(`[data-badge="${name}"]`).forEach((b) => { b.hidden = !n; b.textContent = n > 99 ? "99+" : String(n || ""); if (title) b.title = title; });
}
export async function refreshBadges() {
  if (!state.user) return;
  const bg = { background: true };
  let total = 0;
  const jobs = [];
  if (can("desk.inbox")) jobs.push(desk.get("desk/inbox", {}, bg).then((r) => {
    const c = r.counts || {};
    const n = "mine_new" in c ? (c.mine_new || 0) + (c.grabs || 0) : (c.unclaimed || 0) + (c.escalated || 0);
    total += n; paint("inbox", n, "mine_new" in c ? "New leads for you and leads you can grab" : "Unclaimed and escalated leads");
  }).catch(() => {}));
  if (can("chat.use")) jobs.push(desk.get("chat/rooms", {}, bg).then((r) => {
    const n = (r.data || []).reduce((a, x) => a + (x.unread || 0), 0);
    total += n; paint("chat", n, "Unread messages");
  }).catch(() => {}));
  if (can("desk.ask")) jobs.push(desk.get("ask/tasks", {}, bg).then((r) => {
    const seen = safeStore("ca.askSeen") || "";
    const n = (r.data || []).filter((t) => ["done", "needs_medhansh", "failed"].includes(t.status) && (t.updated_at || "") > seen).length;
    paint("ask", n, "Answers since you last looked");
  }).catch(() => {}));
  await Promise.all(jobs);
  try { if ("setAppBadge" in navigator && isStandalone()) total ? navigator.setAppBadge(total) : navigator.clearAppBadge(); } catch { /* not supported */ }
}
let badgeLoop = null;
export function startBadges() {
  refreshBadges();
  clearInterval(badgeLoop);
  badgeLoop = setInterval(() => { if (document.visibilityState === "visible") refreshBadges(); }, 60000);
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && state.user) scheduleBadges(); });

// ------------------------------------------------------------------ bottom sheet (phone) / side drawer (desktop)
export function openSheet(opts) {
  const d = openDrawer(opts);
  d.el.classList.add("sheet");
  return d;
}

// ------------------------------------------------------------------ photos: resize on the phone, drop EXIF and location
export async function shrinkPhoto(file, maxEdge = 1600, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file is not a photo this phone can read.")); i.src = url; });
    const k = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", quality));
    if (!blob) throw new Error("Could not prepare the photo.");
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ------------------------------------------------------------------ shared words
export const CHANNEL = { whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", website: "Website", call: "Phone call", email: "Email", olx: "OLX", cardekho: "CarDekho", carwale: "CarWale", visit: "Walk-in", portal: "Portal" };
export const channelLabel = (c) => CHANNEL[c] || (c ? c.charAt(0).toUpperCase() + c.slice(1) : "");
export const STAGES = ["new", "claimed", "contacted", "visit_booked", "test_drive", "sold"];
export const STAGE_LABEL = { new: "New", claimed: "Claimed", contacted: "Contacted", visit_booked: "Visit booked", test_drive: "Test drive", sold: "Sold", lost: "Lost", escalated: "Escalated" };
export const tierShort = (k) => ({ luxury: "Luxury", premium: "Premium", core: "Core" }[k] || "");
