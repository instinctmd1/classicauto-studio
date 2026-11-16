// Classic Auto Desk service worker. Scope "./" so the same file works at / (live) and inside the demo folder.
// Caches only the app shell (styles, scripts, fonts, icons). Never caches /api, the demo's data/ answers, non-GET or
// cross-origin requests, and never serves a cached index.html: a sign-in redirect (Cloudflare Access) must reach the browser.
const VERSION = "desk-2026-11-16.8";   // 16 Nov: .8 call desk call-backs say how the call went (reached / no answer / wrong number / call later), the call script in Hindi and Hinglish; .4 sales follow-up calls (brief + screenshot after every call, when will you call next, reminders); .3 market stock (css/market.css); .2 car photos send / download, inspection report from the maintenance car page. 15 Nov: .2 taps stay put; .1 call desk Hot / Warm / Cold. 14 Nov: .7 get car ready; .6 taps stay on the page; .5 Hindi / Hinglish / English switch
const CACHE = `ca-desk-${VERSION}`;
const SHELL = [
  "offline.html", "js/theme-init.js", "js/offline.js", "js/i18n-boot.js", "js/i18n.js", "js/i18n-hi.js", "js/i18n-hing.js", "icons/icon-192.png", "icons/badge-96.png",
  "css/tokens.css", "css/app.css", "css/pages.css", "css/desk.css", "css/maint.css", "css/calldesk.css", "css/carreq.css", "css/market.css",
  "fonts/bebas-neue-latin-400.woff2", "fonts/manrope-latin.woff2", "fonts/manrope-latin-ext.woff2",
  "img/logo.svg",
];
const ASSET_DIRS = /^(css|js|fonts|img|icons|vendor)\//;

const scopePath = () => new URL(self.registration.scope).pathname;

self.addEventListener("install", (e) => {
  // cache "reload": a phone's own HTTP cache must not hand the new version a stale stylesheet or script
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ca-desk-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Serve the cached copy at once and refresh it in the background. Only plain same-origin 200s are stored. */
async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fresh = fetch(req, { cache: "no-cache" }).then((res) => {      // revalidate (a 304 is cheap) instead of trusting the HTTP cache's guess
    if (res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  });
  if (hit) { event.waitUntil(fresh.catch(() => null)); return hit; }
  return fresh;
}

async function networkFirstNavigation(req) {
  try {
    return await fetch(req, { cache: "no-cache" });      // index.html is always revalidated: a phone's HTTP cache must not keep an old page
  } catch {
    const off = await caches.match(new URL("offline.html", self.registration.scope).href);
    return off || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  const base = scopePath();
  const rel = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname.replace(/^\//, "");
  if (rel.startsWith("api/") || rel.startsWith("data/")) return;
  if (req.mode === "navigate") { e.respondWith(networkFirstNavigation(req)); return; }
  if (ASSET_DIRS.test(rel)) e.respondWith(staleWhileRevalidate(req, e));
});

// ------------------------------------------------------------------ notifications
function show(d) {
  return self.registration.showNotification(d.title || "Classic Auto Desk", {
    body: d.body || "",
    tag: d.tag || undefined,
    renotify: !!d.tag && !d.silent,
    silent: !!d.silent,                         // a night lead: on the lock screen, no sound (it rings when the clock starts)
    icon: "icons/icon-192.png",
    badge: "icons/badge-96.png",
    data: { url: d.url || "#/inbox" },
  });
}

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(show(d));                       // always show one: iOS withdraws push from apps that stay silent
});

// The browser replaced this phone's push subscription (it expired or was rotated): make the new one with the same server
// key and tell any open window, which sends it to the server. A closed app re-sends it the next time it opens.
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil((async () => {
    const key = e.oldSubscription && e.oldSubscription.options && e.oldSubscription.options.applicationServerKey;
    if (key && !e.newSubscription) {
      try { await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); } catch { /* the app does it */ }
    }
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    wins.forEach((w) => w.postMessage({ type: "push-renewed" }));
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "#/inbox";
  const target = new URL(url, self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const win = wins.find((w) => w.url.startsWith(self.registration.scope)) || wins[0];
    if (win) {
      win.postMessage({ type: "navigate", url });
      return win.focus();
    }
    return self.clients.openWindow(target);
  })());
});

self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "test") {
    e.waitUntil(show({ title: d.title || "Test notification", body: d.body || "Notifications are working on this phone", tag: d.tag || "test", url: d.url || "#/inbox" }));
  }
});
