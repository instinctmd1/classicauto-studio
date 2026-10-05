// Ask Claude (APP-SPEC section 7). The dashboard passes the request to the assistant service on the server, so no key
// ever reaches the phone. You only ever see your own tasks. Answers are shown as plain text with line breaks kept.
import { $, esc, icon, safeStore } from "../util.js";
import { toast } from "../ui.js";
import * as desk from "../desk-api.js";
import { deskTime, every, onFeed, refreshBadges } from "../desk.js";

const STATUS = { queued: ["Queued", ""], working: ["Working", "info"], done: ["Done", "pos"], needs_medhansh: ["Needs the tech admin", "warn"], failed: ["Did not work", "neg"] };
const OK_TYPES = /^(image\/(jpeg|png|webp)|application\/pdf|text\/plain|text\/csv|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)$/;
const OK_EXT = /\.(jpe?g|png|webp|pdf|txt|csv|xlsx)$/i;
const MB = 1024 * 1024;
const DOWN = "Ask Claude is resting right now. Try again in a few minutes.";

export async function render(ctx) {
  ctx.root.innerHTML = `<div class="ask-page">
    <div class="page-head rise"><div><h1 class="page-title">Ask Claude</h1><p class="page-sub">Ask for a draft reply, a list from the stock, or a quick check. Claude works on it and the tech admin looks at anything it cannot do.</p></div><div class="page-actions" id="ask-sample"></div></div>
    <div id="ask-down"></div>
    <ol class="ask-thread" id="ask-thread" role="log" aria-live="polite" aria-label="Your requests"><li class="skel lead-skel"></li><li class="skel lead-skel"></li></ol>
    <form class="composer ask-composer" id="ask-form" novalidate>
      <div class="file-chips" id="ask-files" hidden></div>
      <div class="composer-row">
        <button class="icon-btn" type="button" id="ask-clip" aria-label="Attach files (up to 3)">${icon("clip")}</button>
        <input type="file" id="ask-file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,.csv,.xlsx" hidden>
        <label class="sr" for="ask-text">Your request</label>
        <textarea class="textarea" id="ask-text" rows="1" maxlength="4000" placeholder="What should Claude do?" enterkeyhint="send"></textarea>
        <button class="btn primary send-btn" type="submit" aria-label="Send">${icon("send")}</button>
      </div>
    </form>
  </div>`;
  const thread = $("#ask-thread"), down = $("#ask-down");
  let tasks = [], files = [], first = true;

  function paint() {
    $("#ask-sample").innerHTML = desk.sampleChip("ask/");
    const list = tasks.slice().reverse();                // oldest first, like a chat
    thread.innerHTML = list.length ? list.map(row).join("") : `<li class="empty">${icon("spark", "")}<b>Ask your first question</b><p>For example: "Write a WhatsApp reply for a customer asking if the Fortuner is still available."</p></li>`;
  }
  function seen() {
    const top = tasks.filter((t) => ["done", "needs_medhansh", "failed"].includes(t.status)).reduce((a, t) => (t.updated_at > a ? t.updated_at : a), "");
    if (top && top > (safeStore("ca.askSeen") || "")) { safeStore("ca.askSeen", top); refreshBadges(); }
  }
  async function load(quiet = false) {
    try {
      const r = await desk.get("ask/tasks", {}, quiet ? { background: true } : {});
      if (!ctx.alive()) return;
      down.innerHTML = "";
      const stick = window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 160;
      tasks = r.data || [];
      paint(); seen();
      if (quiet && stick) window.scrollTo(0, document.documentElement.scrollHeight);
      if (first) { first = false; window.scrollTo(0, document.documentElement.scrollHeight); }
    } catch (e) {
      if (!ctx.alive()) return;
      down.innerHTML = `<div class="err-box" role="alert">${icon("clock", "")}<div><b>${esc(e.code === "assistant_down" ? e.message || DOWN : DOWN)}</b><span class="muted">Your earlier requests are kept.</span></div><button class="btn" type="button" id="ask-retry">${icon("refresh")}Retry</button></div>`;
      $("#ask-retry").addEventListener("click", () => load());
      if (first) { first = false; thread.innerHTML = ""; }
    }
  }

  // ------------------------------------------------------------------ attachments
  const filesEl = $("#ask-files");
  const drawFiles = () => {
    filesEl.hidden = !files.length;
    filesEl.innerHTML = files.map((f, i) => `<span class="file-chip">${icon(/^image\//.test(f.type) ? "image" : "file", "")}<span>${esc(f.name)}</span><button type="button" data-rm="${i}" aria-label="Remove ${esc(f.name)}">${icon("x", "")}</button></span>`).join("");
  };
  filesEl.addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) { files.splice(+b.dataset.rm, 1); drawFiles(); } });
  $("#ask-clip").addEventListener("click", () => $("#ask-file").click());
  $("#ask-file").addEventListener("change", (e) => {
    for (const f of e.target.files || []) {
      if (files.length >= 3) { toast("Up to 3 files per request.", "err"); break; }
      if (!OK_TYPES.test(f.type) && !OK_EXT.test(f.name)) { toast(`${f.name}: photos, PDF, text, CSV or Excel (.xlsx) only.`, "err"); continue; }
      if (f.size > 5 * MB) { toast(`${f.name} is over 5 MB.`, "err"); continue; }
      if (files.reduce((a, x) => a + x.size, 0) + f.size > 8 * MB) { toast("All files together can be up to 8 MB.", "err"); break; }
      files.push(f);
    }
    e.target.value = "";
    drawFiles();
  });

  // ------------------------------------------------------------------ send
  const ta = $("#ask-text");
  const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; };
  ta.addEventListener("input", grow);
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) { e.preventDefault(); $("#ask-form").requestSubmit(); } });
  $("#ask-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    const btn = e.currentTarget.querySelector(".send-btn");
    btn.disabled = true;
    const fd = new FormData();
    fd.append("text", text.slice(0, 4000));
    files.forEach((f) => fd.append("files", f, f.name));
    try {
      await desk.upload("ask/tasks", fd);
      ta.value = ""; grow(); files = []; drawFiles();
      desk.done("Sent to Claude", "ask/");
      await load();
      window.scrollTo(0, document.documentElement.scrollHeight);
    } catch (ex) {
      toast(ex.code === "assistant_down" ? ex.message || DOWN : ex.message || "Could not send. Try again.", "err");
    }
    btn.disabled = false;
  });

  onFeed((r) => { if (r.kind === "ask.updated") load(true); });
  every(10000, () => { if (tasks.some((t) => t.status === "queued" || t.status === "working") && document.visibilityState === "visible") load(true); });
  await load();
}

function row(t) {
  const [label, cls] = STATUS[t.status] || [t.status, ""];
  const busy = t.status === "queued" || t.status === "working";
  const link = typeof t.result_url === "string" && t.result_url.startsWith("https://") ? `<a class="btn sm" href="${esc(t.result_url)}" target="_blank" rel="noopener noreferrer">${icon("link")}Open the result</a>` : "";
  const body = t.result_text ? `<p class="ask-result">${esc(t.result_text)}</p>`
    : t.status === "needs_medhansh" ? `<p class="muted">Claude could not finish this alone. The tech admin will take a look.</p>`
    : t.status === "failed" ? `<p class="muted">It did not work this time. Try asking in a different way.</p>`
    : busy ? `<p class="muted ask-wait"><span class="spin"></span>${t.status === "queued" ? "Waiting for its turn" : "Working on it"}</p>` : "";
  return `<li class="ask-item">
    <div class="ask-q"><p>${esc(t.text)}</p><time>${esc(deskTime(t.created_at))}</time></div>
    <div class="ask-a"><span class="ask-av" aria-hidden="true">${icon("spark", "")}</span><div><span class="badge ${cls}">${esc(label)}</span>${body}${link}${t.updated_at && !busy ? `<time>${esc(deskTime(t.updated_at))}</time>` : ""}</div></div>
  </li>`;
}
