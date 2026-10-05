// Document checklist + upload, shared by the car drawer and the Documents page.
import * as api from "../api.js";
import { DEMO, docUrl } from "../api.js";
import { can, state } from "../state.js";
import { dateFmt, daysUntil, esc, icon, num } from "../util.js";
import { confirmDialog, formHtml, readForm, reauthDialog, save, showErrors, toast } from "../ui.js";

// ---- downloads. Bank and loan papers (and PAN or Aadhaar scans) show numbers the vault masks, so the server asks for a
// fresh password and code first. A plain link cannot do that: this fetches the file, asks once if needed, and saves it.
export async function downloadDoc(uuid) {
  let r = await fetch(docUrl(uuid), { credentials: "same-origin" });
  for (let attempt = 0; r.status === 401 && attempt < 3; attempt++) {
    const err = (await r.json().catch(() => ({})))?.error || {};
    if (err.code !== "reauth_required") break;
    const cred = await reauthDialog({ title: "Confirm it is you", text: "This paper shows a full account, loan, PAN or Aadhaar number. Enter your password and a fresh code. Opening it is logged.", confirmLabel: "Open the paper", needCode: !!state.mfa?.enrolled });
    if (!cred) return;
    try { await api.post("auth/reauth", cred); } catch (e) { toast(e.code === "reauth_failed" ? "Password or code is wrong." : e.message || "Could not confirm.", "err"); if (e.status === 429) return; continue; }
    r = await fetch(docUrl(uuid), { credentials: "same-origin" });
  }
  if (!r.ok) { const err = (await r.json().catch(() => ({})))?.error || {}; toast(r.status === 403 ? err.message || "You cannot open this paper." : r.status === 429 ? err.message || "Limit reached for now." : err.message || "Could not download this paper.", "err"); return; }
  const cd = r.headers.get("content-disposition") || "";
  const name = decodeURIComponent((/filename\*=UTF-8''([^;]+)/i.exec(cd) || [])[1] || (/filename="([^"]+)"/i.exec(cd) || [])[1] || "document");
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
if (!DEMO) document.addEventListener("click", (e) => { const a = e.target.closest?.("a[data-dl]"); if (a) { e.preventDefault(); downloadDoc(a.dataset.dl); } });

export const DOC_LABEL = {
  rc: "Registration certificate (RC)", insurance: "Insurance policy", puc: "PUC certificate", purchase_agreement: "Purchase agreement",
  form28: "Form 28 (NOC)", form29: "Form 29", form30: "Form 30", form35: "Form 35", bank_noc: "Bank NOC", form29c: "Form 29C (dealer intimation)",
  consignment_agreement: "Consignment agreement", payment_proof: "Payment proof", inspection_report: "Inspection report", car_photo: "Car photo",
  service_history: "Service history", valuation: "Valuation", bill: "Bill", other: "Other", sale_letter: "Sale letter", delivery_note: "Delivery note",
  invoice: "Invoice", booking_receipt: "Booking receipt", form60: "Form 60", pan: "PAN", aadhaar_masked: "Aadhaar (masked)", address_proof: "Address proof",
  photo_id: "Photo ID", buyer_photo: "Buyer photo",
};
export const EXPECTED = {
  invested: ["rc", "insurance", "puc", "purchase_agreement", "form29", "form30", "payment_proof", "inspection_report", "car_photo"],
  park_n_sell: ["rc", "insurance", "puc", "consignment_agreement", "form29c"],
};
const EXPIRES = new Set(["insurance", "puc", "consignment_agreement"]);
const size = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

export function docsHtml(docs = [], expected = [], { addType = "", addLabel = "Add a document" } = {}) {
  const byType = {};
  docs.forEach((d) => (byType[d.doc_type] ||= []).push(d));
  const today = state.today;
  const row = (type, d) => {
    if (!d) return `<div class="docrow"><span class="tick">${icon("x", "")}</span><div><div class="nm">${esc(DOC_LABEL[type] || type)}</div><div class="meta">Not uploaded</div></div><button class="btn sm" type="button" data-up="${esc(type)}">${icon("upload")}Upload</button></div>`;
    const left = d.valid_until ? daysUntil(d.valid_until, today) : null;
    const exp = left !== null && left < 0 ? ["exp", `Expired ${dateFmt(d.valid_until)}`, "neg"] : left !== null && left <= 30 ? ["exp", `Expires ${dateFmt(d.valid_until)} (${left} d)`, "warn"] : left !== null ? ["", `Valid to ${dateFmt(d.valid_until)}`, ""] : ["", "", ""];
    return `<div class="docrow have ${exp[0]}"><span class="tick">${icon("check", "")}</span><div><div class="nm">${esc(DOC_LABEL[type] || type)}</div><div class="meta">${esc(d.display_name)} · ${size(d.size_bytes)} · ${dateFmt(d.uploaded_at, false)}${exp[1] ? ` · <span class="badge ${exp[2]}">${esc(exp[1])}</span>` : ""}</div></div>
      <div class="pill-row"><a class="btn sm" href="${docUrl(d.uuid)}" data-dl="${esc(d.uuid)}" ${DEMO ? 'target="_blank" rel="noopener"' : "download"}>${icon("download")}Download</a>${can("documents.delete") && !DEMO ? `<button class="btn sm ghost danger" type="button" data-del="${esc(d.uuid)}" aria-label="Delete ${esc(DOC_LABEL[type] || type)}">${icon("trash")}</button>` : ""}</div></div>`;
  };
  const rows = expected.map((t) => row(t, (byType[t] || [])[0]));
  const extra = docs.filter((d) => !expected.includes(d.doc_type) || (byType[d.doc_type] || []).indexOf(d) > 0);
  extra.forEach((d) => rows.push(row(d.doc_type, d)));
  const have = expected.filter((t) => byType[t]).length;
  const head = expected.length ? `<div class="meter sm" data-w="${Math.round((have / expected.length) * 100)}" data-c="var(--pos)"><i></i></div><p class="note">${have} of ${expected.length} expected papers on file.</p>` : "";
  const empty = !rows.length ? `<p class="muted">Nothing attached yet.</p>` : "";
  return `${head}<div>${rows.join("")}${empty}</div><div class="sec"><button class="btn" type="button" data-up="${esc(addType)}">${icon("plus")}${esc(addLabel)}</button></div>`;
}

export function bindDocs(root, { entityType, entityId, onDone }) {
  root.addEventListener("click", async (e) => {
    const up = e.target.closest("[data-up]");
    if (up) { uploadDialog({ entityType, entityId, docType: up.dataset.up, onDone }); return; }
    const del = e.target.closest("[data-del]");
    if (del) {
      if (!(await confirmDialog({ title: "Delete this document?", text: "It is hidden from the vault. The file itself is only erased by an owner purge request.", confirmLabel: "Delete", danger: true }))) return;
      await save(del, () => api.del(`documents/${del.dataset.del}`), { ok: "Document deleted" }) && onDone?.();
    }
  });
}

export function uploadDialog({ entityType, entityId, docType = "", onDone }) {
  const receipt = entityType === "expense" && docType; // a receipt needs no type or expiry: just the file
  const fields = receipt ? [] : [
    { name: "doc_type", label: "Document type", type: "select", required: true, value: docType, options: Object.entries(DOC_LABEL).map(([k, v]) => [k, v]), full: true },
    { name: "valid_until", label: "Valid until", type: "date", hint: "For insurance, PUC and agreements. Drives expiry alerts." },
  ];
  const opener = document.activeElement;
  const w = document.createElement("div");
  w.className = "modal-wrap";
  w.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="ud-t" novalidate><h2 id="ud-t">${receipt ? "Attach a receipt" : "Add a document"}</h2><p>PDF, JPG, PNG, WebP or HEIC, up to 15 MB. Stored on the server only.</p><div class="sec">${formHtml(fields, { doc_type: docType })}
    <div class="field sec"><label for="ud-f">File <span class="req" aria-hidden="true">*</span></label><input class="input" id="ud-f" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/*" required><div class="err" id="f_file_e" role="alert" hidden></div></div></div>
    <div class="row"><button class="btn" type="button" data-no>Cancel</button><button class="btn primary" type="submit">Upload</button></div></form>`;
  const close = () => { document.removeEventListener("keydown", onKey, true); w.remove(); opener?.isConnected && opener.focus?.(); };
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  document.addEventListener("keydown", onKey, true);
  w.addEventListener("click", (e) => { if (e.target === w) close(); });
  w.querySelector("[data-no]").addEventListener("click", close);
  const form = w.querySelector("form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); showErrors(form, null);
    const f = form.file.files[0];
    if (!f) { const er = form.querySelector("#f_file_e"); er.textContent = "Choose a file to upload."; er.hidden = false; return; }
    const vals = receipt ? { doc_type: docType } : readForm(form, fields);
    if (!vals.doc_type) { showErrors(form, { fields: { doc_type: "required" } }); return; }
    const fd = new FormData();
    fd.append("file", f); fd.append("entity_type", entityType); fd.append("entity_id", String(entityId)); fd.append("doc_type", vals.doc_type);
    if (vals.valid_until) fd.append("valid_until", vals.valid_until);
    const btn = form.querySelector('button[type="submit"]');
    const r = await save(btn, async () => { try { return await api.upload("documents", fd); } catch (ex) { if (ex.code !== "demo") showErrors(form, ex); throw ex; } }, { ok: "Document uploaded" });
    if (r) { close(); onDone?.(); }
  });
  document.getElementById("overlay").appendChild(w);
  w.querySelector("select,input").focus();
}
export { EXPIRES, num };
