// A car's photos, to send a customer on WhatsApp or keep on the phone (owner, 15 Nov 2026: "click one button and send only
// the photos on WhatsApp, or only download the photos"). Photos only: no price, note or name goes with them, and the
// server re-encodes each one without EXIF, GPS or camera data (routers/cars.py). Used in the car file, the Stock grid's
// photo button and the call desk's picked car.
// Phones open the share sheet only straight from a tap, so the full photos are fetched first and the tap that shares them
// calls navigator.share() at once. Chrome takes at most 10 files a share: more photos go out 10 at a time, one tap each.
// iPhone: Download uses the same share sheet ("Save N Images" puts them in Photos; a download would go to Files).
import { DEMO, OFFLINE_MSG, get } from "../api.js";
import { esc, icon } from "../util.js";
import { toast } from "../ui.js";
import { isIOS, openSheet } from "../desk.js";

const BATCH = 10;
const AT_ONCE = 4;              // photos fetched in parallel

function shareFiles() {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.jpg", { type: "image/jpeg" })] })); }
  catch { return false; }
}

/** The car file's Photos section body. The server says how many there are; the strip loads when the section is bound. */
export const photosHtml = () => (DEMO ? "" : `<div class="ph-share" data-ph-host><p class="muted">Loading photos…</p></div>`);

/** A bottom sheet with the same strip and buttons (the Stock grid's photo button, the call desk). */
export function openPhotos(carId, title) {
  const d = openSheet({ title: "Photos", sub: esc(title || ""), body: `<div class="ph-share" data-ph-host><p class="muted">Loading photos…</p></div>` });
  bindPhotos(d.el.querySelector("[data-ph-host]"), carId);
  return d;
}

export async function bindPhotos(host, carId) {
  if (!host) return;
  let list;
  try { list = (await get(`cars/${carId}/photos`)).photos || []; }
  catch (e) { host.innerHTML = `<p class="muted">${esc(e.message || "The photos could not load.")}</p>`; return; }
  if (!host.isConnected) return;
  if (!list.length) { host.innerHTML = `<p class="muted">No photos of this car in the app yet.</p>`; return; }
  const canShare = shareFiles(), ios = isIOS();
  const picked = new Set(list.map((_, i) => i));
  const files = new Map();                   // index -> File, fetched once
  const next = { send: 0, save: 0 };         // how many of the picked photos went out in this round
  let busy = false;

  host.innerHTML = `<ul class="ph-strip" aria-label="Photos of this car">${list.map((p, i) => `<li><button type="button" class="ph-t" data-i="${i}" aria-pressed="true" aria-label="Photo ${i + 1}"><img src="${esc(p.thumb)}" alt="" loading="lazy" decoding="async" width="120" height="90"><span class="ph-tick" aria-hidden="true">${icon("check", "")}</span></button></li>`).join("")}</ul>
    <p class="ph-count muted" aria-live="polite"></p>
    <div class="ph-btns"><button type="button" class="btn primary" data-ph="send">${icon("wa")}<span></span></button><button type="button" class="btn" data-ph="save">${icon(ios && canShare ? "image" : "download")}<span></span></button></div>
    <p class="ph-status muted" role="status"></p>`;
  const $ = (s) => host.querySelector(s);
  const status = (t) => { $(".ph-status").textContent = t; };
  const order = () => list.map((_, i) => i).filter((i) => picked.has(i));
  const label = () => {
    const n = order().length;
    $(".ph-count").textContent = n === list.length ? `${n} ${n === 1 ? "photo" : "photos"}. Tap a photo to leave it out.` : `${n} of ${list.length} photos picked`;
    const from = (k) => next[k] + 1, to = (k) => Math.min(n, next[k] + BATCH), many = n > BATCH && canShare;
    $('[data-ph="send"] span').textContent = many ? `Send photos ${from("send")} to ${to("send")} on WhatsApp` : "Send on WhatsApp";
    $('[data-ph="save"] span').textContent = !(ios && canShare) ? "Download photos" : many ? `Save photos ${from("save")} to ${to("save")}` : "Save to Photos";
    host.querySelectorAll("[data-ph]").forEach((b) => { b.disabled = busy || !n; });
  };
  label();

  // a photo the server cannot use (unreadable, far too big) is left out with a note; no internet or a limit stops the lot
  async function fetchOne(i, skipped) {
    let r;
    try { r = await fetch(list[i].url, { credentials: "same-origin" }); } catch { throw new Error(OFFLINE_MSG); }
    if (r.status === 413 || r.status === 415) { skipped.push(i); return; }
    if (!r.ok) { let m = ""; try { m = (await r.json()).error.message; } catch { /* not JSON */ } throw new Error(m || "A photo did not load. Try again."); }
    files.set(i, new File([await r.blob()], list[i].name, { type: "image/jpeg" }));
  }
  function leaveOut(skipped) {
    skipped.forEach((i) => { picked.delete(i); host.querySelector(`.ph-t[data-i="${i}"]`)?.setAttribute("aria-pressed", "false"); });
    if (skipped.length) toast(skipped.length === 1 ? "One photo could not be used and was left out." : `${skipped.length} photos could not be used and were left out.`, "err");
  }
  async function prepare(want) {
    const todo = want.filter((i) => !files.has(i));
    if (!todo.length) return true;
    busy = true; label();
    let done = want.length - todo.length;
    status(`Getting the photos ready: ${done} of ${want.length}`);
    const skipped = [];
    try {
      const queue = [...todo];
      await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, async () => {
        while (queue.length) { await fetchOne(queue.shift(), skipped); done += 1; if (host.isConnected) status(`Getting the photos ready: ${done} of ${want.length}`); }
      }));
      return true;
    } catch (e) { status(""); toast(e.message, "err"); return false; }
    finally { leaveOut(skipped); busy = false; if (host.isConnected) label(); }
  }
  function download(fs) {
    fs.forEach((f, k) => setTimeout(() => {
      const url = URL.createObjectURL(f), a = document.createElement("a");
      a.href = url; a.download = f.name; a.hidden = true; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }, k * 350));
  }
  async function share(kind, want) {
    const all = want.map((i) => files.get(i));
    const part = all.slice(next[kind], next[kind] + BATCH);
    const open = navigator.share({ files: part });          // photos only: a text or title makes iPhone WhatsApp drop the photos
    busy = true; label();                                    // one share sheet at a time
    try { await open; }
    catch (e) {
      if (e.name === "AbortError") return;                   // closed the share sheet
      status(e.name === "NotAllowedError" ? `Ready. Tap ${kind === "send" ? "Send on WhatsApp" : "Save to Photos"} again.` : e.message || "The share sheet did not open.");
      return;
    } finally { busy = false; if (host.isConnected) label(); }
    next[kind] += part.length;
    if (next[kind] >= all.length) { next[kind] = 0; status(kind === "send" ? "Done: pick WhatsApp and the customer in the share sheet." : "Done: tap Save Images in the share sheet."); }
    else status(`${next[kind]} of ${all.length} sent. Tap again for the next ${Math.min(BATCH, all.length - next[kind])}.`);
    label();
  }
  async function act(kind) {
    let want = order();
    if (!want.length || busy) return;
    const ready = want.every((i) => files.has(i));
    if (!ready && !(await prepare(want))) return;
    if (!host.isConnected) return;
    want = order();                                          // without any photo that could not be used
    if (!want.length) return;
    const viaSheet = canShare && (kind === "send" || ios);
    // fetched just now: the tap may have run out (about 5 seconds), and the share sheet needs a fresh one
    if (!ready && viaSheet && !(navigator.userActivation?.isActive)) { status(`Ready. Tap ${kind === "send" ? "Send on WhatsApp" : "Save to Photos"} again.`); return; }
    if (viaSheet) { await share(kind, want); return; }
    download(want.map((i) => files.get(i)));
    status(kind === "send"
      ? "This browser cannot hand photos to WhatsApp, so they are downloading. Attach them in WhatsApp from your photos or Downloads."
      : `Downloading ${want.length} ${want.length === 1 ? "photo" : "photos"}. If the phone asks, allow more than one download.`);
  }

  host.addEventListener("click", (e) => {
    const t = e.target.closest(".ph-t");
    if (t) {
      if (busy) return;                                      // the picked photos are being fetched or shared: they stay as they are
      const i = +t.dataset.i;
      if (picked.has(i)) picked.delete(i); else picked.add(i);
      t.setAttribute("aria-pressed", String(picked.has(i)));
      next.send = 0; next.save = 0; status(""); label();
      return;
    }
    const b = e.target.closest("[data-ph]");
    if (b) act(b.dataset.ph);
  });
}
