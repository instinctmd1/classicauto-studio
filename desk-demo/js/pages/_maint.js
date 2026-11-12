// Maintenance: words, the camera and upload helpers, and the small pieces maint.js, maint-inspect.js and maint-report.js share.
import * as api from "../api.js";
import { DEMO } from "../api.js";
import * as desk from "../desk-api.js";
import { shrinkPhoto } from "../desk.js";
import { state } from "../state.js";
import { badge, esc, icon, num1 } from "../util.js";
import { overlayClosed, overlayOpened, toast } from "../ui.js";

// The static demo answers from the in-memory sample store (desk-mock-maint.js); the live app talks to /api/maint as before.
export const io = DEMO ? { get: desk.get, post: desk.post, patch: (p, b) => desk.send("PATCH", p, b), upload: desk.upload } : api;

// ------------------------------------------------------------------ words
export const PLACES = [["showroom", "Showroom"], ["yard", "Yard"], ["workshop", "Workshop"], ["with_customer", "With a customer"], ["with_owner", "With the owner"], ["rto", "At the RTO"], ["other", "Somewhere else"]];
export const PLACE_WORD = Object.fromEntries(PLACES);
export const PAY_MODES = [["cash", "Cash"], ["upi", "UPI"], ["neft_rtgs", "NEFT or RTGS"], ["cheque", "Cheque"], ["card", "Card"], ["credit", "On credit, pay later"]];
export const INSPECTION_TYPES = [["purchase", "Buying inspection", "Before or just after we buy the car."], ["pre_sale", "Before-sale inspection", "A last look before the car is shown or sold."], ["recheck", "Re-check", "A short look again after repairs."]];
export const TYPE_WORD = { purchase: "Buying inspection", pre_sale: "Before-sale inspection", recheck: "Re-check" };

/** "Yard · Row B" / "Showroom". */
export function placeText(place, detail) {
  const p = PLACE_WORD[place] || (place ? place : "Not set");
  return detail ? `${p} · ${detail}` : p;
}

/** "4:12 pm" from an IST timestamp. */
export function hm(ts) {
  const m = /(\d{2}):(\d{2})/.exec(String(ts || "").slice(11, 16)); if (!m) return "";
  const h = +m[1];
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "pm" : "am"}`;
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "today, 4:12 pm" / "yesterday" / "9 Nov, 4:12 pm". */
export function when(ts, withTime = true) {
  if (!ts) return "";
  const d = String(ts).slice(0, 10), t = withTime ? hm(ts) : "";
  const day = d === state.today ? "today" : d === new Date(Date.parse(state.today) - 864e5).toISOString().slice(0, 10) ? "yesterday" : `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]}`;
  return t ? `${day}, ${t}` : day;
}

export function scoreTone(label) { return { Excellent: "pos", Good: "info", Average: "warn", Poor: "neg" }[label] || ""; }
/** The inspection score as a small tag: 8.4 / 10 Good. */
export function scoreTag(i) {
  if (!i) return "";
  if (i.overall == null) return `<span class="mt-score">${i.status === "draft" ? "Draft inspection" : "Not scored"}</span>`;
  return `<span class="mt-score ${scoreTone(i.label)}"><b>${num1(i.overall)}</b><small>/10</small><span>${esc(i.label || "")}</span></span>`;
}

export function taskChip(t) {
  if (t.status === "verified") return badge("Checked", "pos");
  if (t.status === "done") return badge("Done, waiting for check", "warn");
  if (t.reject_reason) return badge("Sent back", "neg");
  return badge("To do", "");
}

export const errBox = (msg, head = "Could not load this.") => `<div class="err-box" role="alert">${icon("alert", "")}<div><b>${esc(head)}</b><span class="muted">${esc(msg || "")}</span></div></div>`;

// ------------------------------------------------------------------ evidence thumbnails
const EV_WORD = { work_photo: "Work", before_photo: "Before", bill: "Bill" };
export function evOne(e) {
  if (e.kind === "bill") {
    return e.url
      ? `<a class="mt-ev bill" href="${esc(e.url)}" target="_blank" rel="noopener">${icon("receipt", "")}<b>Bill</b></a>`
      : `<span class="mt-ev bill locked" title="Bills are shown to whoever added them and to the owner">${icon("lock", "")}<b>Bill</b></span>`;
  }
  return thumb(e.url, EV_WORD[e.kind] || "Photo");
}
export function thumb(url, word = "Photo") {
  return `<button type="button" class="mt-ev" data-zoom="${esc(url)}" data-cap="${esc(word)}" aria-label="Open the ${esc(word.toLowerCase())} photo"><img src="${esc(url)}" alt="" width="96" height="72"><b>${esc(word)}</b></button>`;
}
export const evHtml = (list) => (list && list.length ? `<div class="mt-evs">${list.map(evOne).join("")}</div>` : "");

/** A photo full screen. The phone's Back closes it. */
export function zoomPhoto(url, caption = "") {
  const opener = document.activeElement;
  const w = document.createElement("div");
  w.className = "mt-zoom"; w.setAttribute("role", "dialog"); w.setAttribute("aria-modal", "true"); w.setAttribute("aria-label", caption || "Photo");
  w.innerHTML = `<button type="button" class="icon-btn mt-zoom-x" aria-label="Close the photo">${icon("x")}</button><img src="${esc(url)}" alt="${esc(caption)}">${caption ? `<p>${esc(caption)}</p>` : ""}`;
  const done = () => { document.removeEventListener("keydown", onKey, true); w.remove(); overlayClosed("zoom"); opener?.isConnected && opener.focus?.(); };
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); done(); } };
  document.addEventListener("keydown", onKey, true);
  w.addEventListener("click", (e) => { if (e.target === w || e.target.closest(".mt-zoom-x")) done(); });
  document.getElementById("overlay").appendChild(w);
  overlayOpened("zoom", () => { document.removeEventListener("keydown", onKey, true); w.remove(); opener?.isConnected && opener.focus?.(); });
  w.querySelector(".mt-zoom-x").focus();
}
/** One delegated listener: any [data-zoom] inside root opens the photo. */
export function bindZoom(root) {
  root.addEventListener("click", (e) => { const z = e.target.closest("[data-zoom]"); if (z) { e.preventDefault(); zoomPhoto(z.dataset.zoom, z.dataset.cap || ""); } });
}

// ------------------------------------------------------------------ camera and upload
/** The markup of a camera button. The file input sits inside the label so it works on every phone without a script click. */
export function camBtn({ label = "Take photo", attrs = "", cls = "", gallery = false, pdf = false } = {}) {
  const accept = pdf ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp";
  return `<label class="btn mt-cam ${cls}">${icon("camera")}<span>${esc(label)}</span><input type="file" accept="${accept}" capture="environment" class="sr" ${attrs}></label>`
    + (gallery ? `<label class="btn ghost sm mt-pick">${icon("image")}<span>${pdf ? "Choose a file or PDF" : "Choose from gallery"}</span><input type="file" accept="${accept}" class="sr" ${attrs}></label>` : "");
}

/** Shrink on the phone (cheap data plans, slow workshop Wi-Fi). A PDF goes as it is. */
export async function prep(file) {
  if (file.type === "application/pdf") return file;
  if (!/^image\//.test(file.type)) throw new Error("Choose a photo (JPEG, PNG or WebP). A bill may also be a PDF.");
  try {
    const blob = await shrinkPhoto(file);
    return new File([blob], (file.name || "photo").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}

/** Upload one file with the extra form fields. Resolves the server's answer; rejects with a message fit to show. */
export async function sendFile(path, file, fields = {}) {
  const small = await prep(file);
  const fd = new FormData();
  fd.append("file", small, small.name || "photo.jpg");
  Object.entries(fields).forEach(([k, v]) => v != null && fd.append(k, v));
  return io.upload(path, fd);
}

/** Wire every file input under root: on choose, call handler(file, input), which returns a promise. Clears the input so the same photo can be retaken. */
export function onFiles(root, sel, handler) {
  root.addEventListener("change", async (e) => {
    const inp = e.target.closest(sel); if (!inp || inp.type !== "file") return;
    const files = [...inp.files]; inp.value = "";
    for (const f of files) await handler(f, inp);
  });
}

/** Success toast. In the demo it also says nothing was saved (same wording as desk.done). */
export const okToast = (m, action = null) => toast(DEMO ? `${m.replace(/\.$/, "")}. Demo: nothing is saved.` : m, DEMO ? "demo" : "ok", action);
export const failToast = (e) => toast((e && e.message) || "Something went wrong. Try again.", "err");
