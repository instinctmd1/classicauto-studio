// Overlay components: toast, drawer, confirm dialog, menu, form helpers.
import { ApiError } from "./api.js";
import { applyDyn, esc, icon } from "./util.js";

// ------------------------------------------------------------------ toast
export function toast(msg, kind = "", action = null) {
  const host = document.getElementById("toasts");
  if (!host) return;
  const ic = kind === "err" ? "alert" : kind === "ok" ? "check" : kind === "demo" ? "lock" : "info";
  const n = document.createElement("div");
  n.className = "toast " + kind;
  n.innerHTML = `${icon(ic, "")}<span>${esc(msg)}</span>${action ? `<button class="toast-act" type="button">${esc(action.label)}</button>` : ""}`;
  if (action) n.querySelector(".toast-act").addEventListener("click", () => { n.remove(); action.onClick(); });
  host.appendChild(n);
  while (host.children.length > 3) host.firstElementChild.remove();
  setTimeout(() => { n.style.opacity = "0"; n.style.transition = "opacity .25s"; setTimeout(() => n.remove(), 260); }, kind === "err" ? 6500 : action ? 9000 : 3800);
}
window.addEventListener("ca:toast", (e) => toast(e.detail.msg, e.detail.kind));

/** Run a mutation with a busy button and consistent feedback. Returns the result, or undefined on failure. */
export async function save(btn, fn, { ok = "Saved" } = {}) {
  const label = btn ? btn.innerHTML : "";
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${btn.textContent.trim() ? " " + esc(btn.textContent.trim()) : ""}`; }
  try {
    const r = await fn();
    if (ok) toast(ok, "ok");
    return r === undefined ? true : r;
  } catch (e) {
    const inline = e instanceof ApiError && e.fields && Object.keys(e.fields).length;      // the form shows these next to the fields
    if ((!(e instanceof ApiError) || e.code !== "demo") && !inline) toast(e.message || "Something went wrong. Try again.", "err");
    return undefined;
  } finally {
    if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; }
  }
}

// ------------------------------------------------------------------ drawer
let active = null;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function closeDrawer() { if (active) active.close(); }

export function openDrawer({ title, sub = "", body = "", foot = null, wide = false, onClose } = {}) {
  if (active) active.close(true);
  const opener = document.activeElement;
  const scrim = document.getElementById("scrim");
  const d = document.createElement("aside");
  d.className = "drawer" + (wide ? " wide" : "");
  d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
  const tid = "dh" + Math.random().toString(36).slice(2, 7);
  d.setAttribute("aria-labelledby", tid);
  d.innerHTML = `<div class="drawer-head"><div><h2 id="${tid}">${esc(title)}</h2><div class="sub"></div></div><button class="icon-btn" type="button" aria-label="Close">${icon("x")}</button></div><div class="drawer-body"></div>`;
  const bodyEl = d.querySelector(".drawer-body");
  const subEl = d.querySelector(".sub");
  subEl.innerHTML = sub;
  const setBody = (h) => { if (typeof h === "string") { bodyEl.innerHTML = h; applyDyn(bodyEl); } else { bodyEl.replaceChildren(h); } };
  setBody(body);
  let footEl = null;
  const setFoot = (n) => { footEl?.remove(); footEl = null; if (n) { footEl = document.createElement("div"); footEl.className = "drawer-foot"; if (typeof n === "string") footEl.innerHTML = n; else footEl.appendChild(n); d.appendChild(footEl); } };
  setFoot(foot);
  document.getElementById("overlay").appendChild(d);
  scrim.classList.add("on");
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => d.classList.add("open"));

  const onKey = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); ctl.close(); return; }
    if (e.key !== "Tab") return;
    const f = Array.from(d.querySelectorAll(FOCUSABLE)).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const onScrim = () => ctl.close();
  document.addEventListener("keydown", onKey, true);
  scrim.addEventListener("click", onScrim);
  d.querySelector(".icon-btn").addEventListener("click", () => ctl.close());

  const ctl = {
    el: d, body: bodyEl, setBody, setFoot, setTitle: (t) => { d.querySelector("h2").textContent = t; }, setSub: (h) => { subEl.innerHTML = h; },
    close(silent) {
      if (active !== ctl) return;
      active = null;
      document.removeEventListener("keydown", onKey, true);
      scrim.removeEventListener("click", onScrim);
      d.classList.remove("open");
      if (!document.getElementById("side")?.classList.contains("open")) scrim.classList.remove("on");
      document.body.style.overflow = "";
      setTimeout(() => d.remove(), 260);
      if (!silent) { opener?.isConnected && opener.focus?.(); }
      onClose?.();
    },
  };
  active = ctl;
  setTimeout(() => (bodyEl.querySelector(FOCUSABLE) || d.querySelector(".icon-btn")).focus({ preventScroll: true }), 60);
  return ctl;
}

// ------------------------------------------------------------------ confirm
export function confirmDialog({ title, text = "", confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const w = document.createElement("div");
    w.className = "modal-wrap";
    w.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="cd-t"><h2 id="cd-t">${esc(title)}</h2><p>${esc(text)}</p><div class="row"><button class="btn" type="button" data-no>Cancel</button><button class="btn ${danger ? "danger" : "primary"}" type="button" data-yes>${esc(confirmLabel)}</button></div></div>`;
    const done = (v) => { document.removeEventListener("keydown", onKey, true); w.remove(); opener?.isConnected && opener.focus?.(); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); done(false); } };
    document.addEventListener("keydown", onKey, true);
    w.addEventListener("click", (e) => { if (e.target === w) done(false); });
    w.querySelector("[data-no]").addEventListener("click", () => done(false));
    w.querySelector("[data-yes]").addEventListener("click", () => done(true));
    document.getElementById("overlay").appendChild(w);
    w.querySelector("[data-no]").focus();
  });
}

// ------------------------------------------------------------------ menu
let openMenuEl = null;
export function closeMenu() { if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", menuKey, true); } }
function outside(e) { if (openMenuEl && !openMenuEl.contains(e.target) && !e.target.closest("[data-menu-anchor]")) closeMenu(); }
function menuKey(e) {
  if (e.key === "Escape") { const a = openMenuEl?.__anchor; closeMenu(); a?.focus(); }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const items = Array.from(openMenuEl.querySelectorAll("button,a"));
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus(); e.preventDefault();
  }
}
/** items: {label, icon?, onClick?, href?, checked?, heading?, divider?} */
export function openMenu(anchor, items, { align = "left" } = {}) {
  closeMenu();
  const m = document.createElement("div");
  m.className = "menu"; m.setAttribute("role", "menu");
  m.__anchor = anchor;
  items.forEach((it) => {
    if (it.divider) { m.appendChild(document.createElement("hr")); return; }
    if (it.heading) { const h = document.createElement("div"); h.className = "menu-h"; h.textContent = it.heading; m.appendChild(h); return; }
    const b = document.createElement(it.href ? "a" : "button");
    if (it.href) b.href = it.href; else b.type = "button";
    b.setAttribute("role", it.checked !== undefined ? "menuitemradio" : "menuitem");
    if (it.checked !== undefined) b.setAttribute("aria-checked", String(!!it.checked));
    b.innerHTML = `${it.icon ? icon(it.icon, "") : ""}<span>${esc(it.label)}</span>${it.checked ? icon("check", "") : ""}`;
    b.addEventListener("click", () => { closeMenu(); it.onClick?.(); });
    m.appendChild(b);
  });
  document.getElementById("overlay").appendChild(m);
  const r = anchor.getBoundingClientRect();
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let left = align === "right" ? r.right - mw : r.left;
  left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
  let top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  m.style.left = left + "px"; m.style.top = top + "px";
  openMenuEl = m;
  anchor.setAttribute("data-menu-anchor", "");
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("keydown", menuKey, true);
  (m.querySelector('[aria-checked="true"]') || m.querySelector("button,a"))?.focus();
  return m;
}

// ------------------------------------------------------------------ forms
/** field: {name, label, type: text|number|money|date|month|select|textarea|checkbox|email|tel, options, required, hint, full, placeholder, min, max} */
export function formHtml(fields, values = {}) {
  const cells = fields.map((f) => {
    const id = "f_" + f.name;
    const v = values[f.name] ?? f.value ?? "";
    const req = f.required ? ' <span class="req" aria-hidden="true">*</span>' : "";
    const hint = f.hint ? `<div class="hint" id="${id}_h">${esc(f.hint)}</div>` : "";
    const err = `<div class="err" id="${id}_e" role="alert" hidden></div>`;
    const desc = `aria-describedby="${id}_e${f.hint ? " " + id + "_h" : ""}"`;
    let ctl;
    if (f.type === "select") {
      const opts = (f.options || []).map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}"${String(v) === String(val) ? " selected" : ""}>${esc(lab)}</option>`; }).join("");
      ctl = `<select class="select" id="${id}" name="${f.name}" ${desc}${f.required ? " required" : ""}>${f.required && !v ? '<option value="" disabled selected>Choose…</option>' : f.allowEmpty ? '<option value="">None</option>' : ""}${opts}</select>`;
    } else if (f.type === "textarea") {
      ctl = `<textarea class="textarea" id="${id}" name="${f.name}" ${desc}${f.required ? " required" : ""}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""}>${esc(v)}</textarea>`;
    } else if (f.type === "checkbox") {
      return `<div class="field${f.full ? " full" : ""}"><label class="check"><input type="checkbox" id="${id}" name="${f.name}"${v ? " checked" : ""}> <span>${esc(f.label)}</span></label>${hint}${err}</div>`;
    } else {
      const t = f.type === "money" ? "number" : f.type || "text";
      const extra = f.type === "money" ? ' inputmode="numeric" step="1" min="0"' : f.type === "number" ? ` step="${f.step || "any"}"${f.min !== undefined ? ` min="${f.min}"` : ""}${f.max !== undefined ? ` max="${f.max}"` : ""}` : "";
      ctl = `<input class="input" id="${id}" name="${f.name}" type="${t}"${extra} value="${esc(v)}" ${desc}${f.required ? " required" : ""}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""}${f.autocomplete ? ` autocomplete="${f.autocomplete}"` : ""}>`;
    }
    return `<div class="field${f.full ? " full" : ""}"><label for="${id}">${esc(f.label)}${req}</label>${ctl}${hint}${err}</div>`;
  });
  return `<div class="form-grid">${cells.join("")}</div>`;
}

/** "Choose a category" / "Enter an amount" instead of a generic "This field is required." */
function requiredText(control, root) {
  const label = (root.querySelector(`label[for="${control.id}"]`)?.textContent || "").replace(/[*(].*$/, "").trim().toLowerCase();
  if (!label) return "This field is required.";
  return `${control.tagName === "SELECT" ? "Choose" : "Enter"} ${/^[aeiou]/.test(label) ? "an" : "a"} ${label}`.replace(/ (an?) (the|your) /, " $2 ");
}

export function readForm(root, fields) {
  const out = {};
  for (const f of fields) {
    const c = root.querySelector(`[name="${f.name}"]`);
    if (!c) continue;
    if (f.type === "checkbox") { out[f.name] = c.checked ? 1 : 0; continue; }
    let v = c.value.trim();
    if (v === "") { out[f.name] = null; continue; }
    if (f.type === "money") v = Math.round(Number(v));
    else if (f.type === "number") v = Number(v);
    out[f.name] = v;
  }
  return out;
}

export function showErrors(root, err) {
  root.querySelectorAll(".err").forEach((e) => { e.hidden = true; e.textContent = ""; });
  root.querySelectorAll("[aria-invalid]").forEach((e) => e.removeAttribute("aria-invalid"));
  root.querySelector(".form-err")?.remove();
  if (!err) return;
  const fields = err.fields || {};
  let first = null;
  for (const [k, msg] of Object.entries(fields)) {
    const c = root.querySelector(`[name="${k}"]`); const e = root.querySelector(`#f_${k}_e`);
    if (c && e) { c.setAttribute("aria-invalid", "true"); e.textContent = Array.isArray(msg) ? msg.join(", ") : msg === "required" ? requiredText(c, root) : String(msg); e.hidden = false; first ||= c; }
  }
  if (!first || !Object.keys(fields).length) {
    const b = document.createElement("div"); b.className = "form-err"; b.setAttribute("role", "alert"); b.textContent = err.message || "Could not save.";
    root.prepend(b);
  }
  first?.focus();
}

// ------------------------------------------------------------------ page head
export function pageHead({ title, sub = "", actions = "" }) {
  return `<div class="page-head rise"><div><h1 class="page-title">${esc(title)}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ""}</div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</div>`;
}

// ------------------------------------------------------------------ step-up prompt
/** Asks for the password (and the 6-digit code when two-factor is on). Resolves {password, totp} or null. */
export function reauthDialog({ title = "Confirm it is you", text = "", confirmLabel = "Confirm", needCode = true } = {}) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const w = document.createElement("div");
    w.className = "modal-wrap";
    w.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="ra-t" novalidate>
      <h2 id="ra-t">${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ""}
      <div class="stack-form sec">
        <div class="field"><label for="ra-p">Password</label><input class="input" id="ra-p" name="password" type="password" autocomplete="current-password" required></div>
        ${needCode ? `<div class="field"><label for="ra-c">Two-factor code</label><input class="input code-input" id="ra-c" name="totp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="123456" required><div class="hint">The 6 digits from your authenticator app. Each code works once.</div></div>` : ""}
        <div class="err" id="ra-e" role="alert" hidden></div>
      </div>
      <div class="row"><button class="btn" type="button" data-no>Cancel</button><button class="btn primary" type="submit">${esc(confirmLabel)}</button></div></form>`;
    const done = (v) => { document.removeEventListener("keydown", onKey, true); w.remove(); opener?.isConnected && opener.focus?.(); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); done(null); } };
    document.addEventListener("keydown", onKey, true);
    w.addEventListener("click", (e) => { if (e.target === w) done(null); });
    w.querySelector("[data-no]").addEventListener("click", () => done(null));
    const form = w.querySelector("form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const password = form.password.value, totp = form.totp ? form.totp.value.trim() : undefined;
      const err = w.querySelector("#ra-e");
      if (!password || (needCode && !/^\d{6}$/.test(totp || ""))) { err.textContent = needCode ? "Enter your password and the 6-digit code." : "Enter your password."; err.hidden = false; return; }
      done({ password, ...(needCode ? { totp } : {}) });
    });
    document.getElementById("overlay").appendChild(w);
    form.password.focus();
  });
}

// ------------------------------------------------------------------ tabs
/** Tab strip markup. tabs: [{id,label,n?,icon?}]. Pair with bindTabs. */
export function tabsHtml(tabs, active, label = "Sections") {
  return `<div class="tabs" role="tablist" aria-label="${esc(label)}">${tabs.map((t) => `<button type="button" role="tab" id="tab-${esc(t.id)}" aria-selected="${t.id === active}" data-tab="${esc(t.id)}">${t.icon ? icon(t.icon, "") : ""}${esc(t.label)}${t.n !== undefined && t.n !== null ? `<span class="n">${esc(t.n)}</span>` : ""}</button>`).join("")}</div>`;
}
export function bindTabs(root, onSelect) {
  const strip = root.querySelector('[role="tablist"]');
  if (!strip) return;
  strip.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    strip.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    onSelect(b.dataset.tab);
  });
  strip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tabs = Array.from(strip.querySelectorAll("[data-tab]")); const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const n = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]; n.focus(); n.click(); e.preventDefault();
  });
}

// ------------------------------------------------------------------ one-step form drawer
/** A drawer with a form. onSubmit(values) may throw an ApiError, whose field messages are shown beside the fields.
 *  Returns the drawer controller; ctl.form is the <form>. */
export function formDrawer({ title, sub = "", fields, values = {}, submit = "Save", ok = "Saved", onSubmit, wide = false, before = "", after = "", cancel = "Cancel", danger = false }) {
  const fid = "fd" + Math.random().toString(36).slice(2, 7);
  const d = openDrawer({ title, sub, wide, body: `${before}<form id="${fid}" novalidate>${formHtml(fields, values)}</form>${after}`,
    foot: `<button class="btn" type="button" data-x>${esc(cancel)}</button><button class="btn ${danger ? "danger" : "primary"}" type="submit" form="${fid}">${esc(submit)}</button>` });
  const form = d.el.querySelector("#" + fid);
  d.form = form;
  d.el.querySelector("[data-x]").addEventListener("click", () => d.close());
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); showErrors(form, null);
    const btn = d.el.querySelector('button[type="submit"]');
    const vals = readForm(form, fields);
    const r = await save(btn, async () => { try { return (await onSubmit(vals, d)) ?? true; } catch (ex) { if (ex instanceof ApiError || ex.fields) showErrors(form, ex); throw ex; } }, { ok });
    if (r) d.close();
  });
  return d;
}
