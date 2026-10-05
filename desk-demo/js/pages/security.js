// Security: two-factor enrolment and what it protects. Also the page a locked money link lands on.
import * as api from "../api.js";
import { state, isLocked, isSuper } from "../state.js";
import { esc, groups4, icon, mount } from "../util.js";
import { pageHead, save, toast } from "../ui.js";
import { card } from "./_shared.js";
import { capName } from "../caps.js";

export async function render(ctx) {
  const m = state.mfa || {};
  const enrolled = !!m.enrolled;
  const heldOff = state.locked.slice().sort();
  const why = ctx.locked ? `<div class="callout warn rise" role="note">${icon("lock", "")}<div><b>${esc(ctx.locked)} is locked.</b><p>You have access to it, but money pages only open after you sign in with a two-factor code. ${enrolled ? "Sign out and sign in again, entering the 6 digits from your app." : "Set it up below; it takes about a minute."}</p></div></div>` : "";

  const rules = `<ul class="rules">
    <li>${icon("check", "")}<div><b>Sign-in asks for a code</b><span>After the password, a 6-digit code from your phone. Each code works once.</span></div></li>
    <li>${icon("check", "")}<div><b>Money pages lock after 30 idle minutes</b><span>Everyone else is signed out after 2 hours. The timer is in the top bar.</span></div></li>
    <li>${icon("check", "")}<div><b>Bank details stay masked</b><span>To unmask an account number you enter your password and a fresh code, and the reveal is logged first.</span></div></li>
    <li>${icon("check", "")}<div><b>Every money view and export is logged</b><span>The audit log shows who looked at what, and when.</span></div></li>
    <li>${icon("check", "")}<div><b>Lost your phone?</b><span>${isSuper() ? "You can reset anyone else's from Users and access. Yours is reset from the server shell with create_user.py --reset-totp." : "Ask the owner. He resets it from Users and access, then you set it up again."}</span></div></li>
  </ul>`;

  const held = heldOff.length ? `<div class="sec"><div class="mini-h">Waiting for your code</div><div class="chips">${heldOff.map((c) => `<span class="pill warn">${icon("lock", "")}${esc(capName(c))}</span>`).join("")}</div></div>` : "";

  let steps;
  if (enrolled) {
    steps = `<div class="callout pos">${icon("shieldcheck", "")}<div><b>Two-factor is on for ${esc(state.user.display_name.replace(/\s*\(.*\)$/, ""))}.</b><p>${m.verified ? "This session passed the code check, so your money pages are open." : "This session has not passed the code check. Sign out and sign in again with your code."}</p></div></div>${held}`;
  } else {
    steps = `<div class="steps" id="steps">
      <section class="step-card" id="s1"><div class="st"><span class="badge-n">1</span><h3>Confirm your password</h3></div>
        <p class="muted">We make a secret just for you and draw its QR code on this server. Nothing is sent anywhere else.</p>
        <form id="f1" class="stack-form" novalidate><div class="field"><label for="pw">Your password</label><input class="input" id="pw" name="password" type="password" autocomplete="current-password" required><div class="err" id="pw-e" role="alert" hidden></div></div>
        <button class="btn primary" type="submit">Show my QR code</button></form></section>
      <section class="step-card" id="s2" aria-disabled="true"><div class="st"><span class="badge-n">2</span><h3>Scan, then type a code</h3></div>
        <p class="muted" id="s2-hint">Available after step 1.</p></section></div>${held}`;
  }

  mount(ctx.root, pageHead({ title: "Security", sub: "Two-factor sign-in protects money, accounts and the bank file." }) + why
    + card({ title: enrolled ? "Two-factor" : "Turn on two-factor", sub: enrolled ? "Authenticator app, 6 digits, 30 seconds." : "Use any authenticator app: Google Authenticator, Microsoft Authenticator, Authy, 1Password.", body: steps })
    + card({ title: "What this protects", body: rules }));

  if (enrolled) return;
  const f1 = ctx.root.querySelector("#f1"), s2 = ctx.root.querySelector("#s2");
  f1.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = ctx.root.querySelector("#pw-e"); err.hidden = true;
    const btn = f1.querySelector("button");
    if (!f1.password.value) { err.textContent = "Enter your password."; err.hidden = false; return; }
    let r;
    const ok = await save(btn, async () => { try { r = await api.post("me/totp/setup", { password: f1.password.value }); } catch (ex) { err.textContent = ex.fields?.password ? "That password is wrong." : ex.message; err.hidden = false; throw ex; } }, { ok: "" });
    if (!ok || !r) return;
    ctx.root.querySelector("#s1").classList.add("done");
    f1.innerHTML = `<p class="pill pos">${icon("check", "")}Password confirmed</p>`;
    s2.removeAttribute("aria-disabled");
    s2.innerHTML = `<div class="st"><span class="badge-n">2</span><h3>Scan, then type a code</h3></div>
      <div class="qr-box"><img src="${esc(r.qr_svg)}" alt="QR code to add Classic Auto to your authenticator app" width="220" height="220"></div>
      <div><div class="mini-h">Or type this secret into the app</div><div class="secret" id="sec">${esc(groups4(r.secret))}</div></div>
      <form id="f2" class="stack-form" novalidate><div class="field"><label for="cd">6-digit code from the app</label><input class="input code-input" id="cd" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" required><div class="err" id="cd-e" role="alert" hidden></div></div>
      <button class="btn primary" type="submit">Turn on two-factor</button></form>`;
    s2.querySelector("#cd").focus();
    s2.querySelector("#f2").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f2 = ev.currentTarget, e2 = s2.querySelector("#cd-e"); e2.hidden = true;
      if (!/^\d{6}$/.test(f2.code.value.trim())) { e2.textContent = "The code is 6 digits."; e2.hidden = false; return; }
      const done = await save(f2.querySelector("button"), async () => { try { await api.post("me/totp/confirm", { code: f2.code.value.trim() }); } catch (ex) { e2.textContent = ex.message; e2.hidden = false; throw ex; } }, { ok: "Two-factor is on. Money pages are open." });
      if (done) { try { await ctx.reloadMe(); } catch { toast("Signed in, but the menu could not refresh. Reload the page.", "err"); } location.hash = "#/home"; }
    });
  });
}
