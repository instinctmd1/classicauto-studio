// "Ask for a Google review": the step after every delivery (app/routers/reviews.py).
// Same ask for every buyer: no "were you happy?" first, nothing offered in return (Google's review rules). The app records that
// the salesman asked and, when the engine's link is set up, whether the buyer tapped it. It never knows whether a review was written.
import * as api from "../api.js";
import { get } from "../api.js";
import { dateTimeFmt, esc, icon } from "../util.js";
import { openDrawer, toast } from "../ui.js";

const VIA = { whatsapp: "on WhatsApp", qr: "with the QR", copy: "by sending the link", in_person: "in person" };

export function reviewStatusHtml(r) {
  if (!r) return "";
  const asked = r.asked_at ? `<span class="pill pos">${icon("check", "")}Asked ${esc(VIA[r.asked_via] || "")}, ${esc(dateTimeFmt(r.asked_at))}</span>` : `<span class="pill warn">${icon("star", "")}Not asked yet</span>`;
  const tap = r.tracked ? (r.taps ? `<span class="pill info">${icon("link", "")}Opened the review link ${r.taps}×</span>` : `<span class="pill">${icon("link", "")}Link not opened yet</span>`) : "";
  return `<div class="pill-row">${asked}${tap}</div>`;
}

/* Opens the step as a drawer. justDelivered: shown straight after "Mark delivered". onClose: what to do when it closes. */
export async function openReviewAsk(dealId, { justDelivered = false, onClose } = {}) {
  const d = openDrawer({ title: "Ask for a Google review", sub: justDelivered ? "Delivered. One more step before the buyer leaves." : "Classic Auto on Google Maps",
    body: `<div class="skel card"></div>`, onClose });
  let r;
  try { r = await get(`deals/${dealId}/review-ask`); } catch (e) { d.setBody(`<div class="err-box" role="alert">${icon("alert", "")}<div><b>Could not load the review step.</b><span class="muted">${esc(e.message)}</span></div></div>`); return d; }
  const draw = () => {
    d.setBody(`${reviewStatusHtml(r)}
      <div class="sec"><p>Ask <b>${esc(r.buyer_first_name || "the buyer")}</b> to review Classic Auto on Google. Ask every buyer the same way, happy or not. Never offer anything for a review.</p></div>
      <div class="sec"><div class="sec-h"><h3>At the counter</h3></div><p class="muted">The buyer scans this with the phone camera. Google's review box for Classic Auto opens.</p>
        <div class="qr-box sec"><img src="${esc(r.qr)}" alt="QR code that opens Google's review box for Classic Auto" width="220" height="220"></div></div>
      <div class="sec"><div class="sec-h"><h3>Or send the link</h3></div>
        ${r.do_not_message ? `<div class="callout warn">${icon("alert", "")}<div><b>This buyer asked us not to message.</b><p>Ask in person with the QR instead.</p></div></div>` : ""}
        <div class="note-card"><span>${esc(r.message).replace(/\n/g, "<br>")}</span></div>
        <div class="pill-row">
          ${r.wa_url ? `<a class="btn primary" href="${esc(r.wa_url)}" target="_blank" rel="noopener" data-via="whatsapp">${icon("wa")}Send on WhatsApp</a>` : ""}
          ${r.do_not_message ? "" : `<button class="btn" type="button" data-via="copy">${icon("copy")}Copy message</button>`}
        </div>
        ${r.tracked ? "" : `<p class="note sec">${icon("info", "")}Taps on the link are counted once the engine's public address is set (CA_REVIEW_LINK_BASE).</p>`}
      </div>`);
    d.setFoot(`<button class="btn" type="button" data-close>${r.asked_at ? "Close" : "Later"}</button><button class="btn pos" type="button" data-via="${r.do_not_message ? "in_person" : "qr"}">${icon("check")}I asked ${r.do_not_message ? "in person" : "with the QR"}</button>`);
  };
  draw();
  const mark = async (via) => {
    try { r = await api.post(`deals/${dealId}/review-ask`, { via }); draw(); toast("Noted: review asked.", "ok"); } catch (e) { toast(e.message, "err"); }
  };
  d.el.addEventListener("click", async (e) => {
    if (e.target.closest("[data-close]")) { d.close(); return; }
    const b = e.target.closest("[data-via]"); if (!b) return;
    const via = b.dataset.via;
    if (via === "copy") { try { await navigator.clipboard.writeText(r.message); } catch { toast("Select the message and copy it.", "err"); return; } }
    mark(via);                      // a WhatsApp link opens in a new tab and is recorded as asked at the same time
  });
  return d;
}
