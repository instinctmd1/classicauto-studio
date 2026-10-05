// Install help (APP-SPEC section 1): put CA Desk on the home screen, then switch on notifications with a tap.
// Android and desktop Chrome get the browser's own install button; iPhone gets the Share, Add to Home Screen steps.
import { esc, icon } from "../util.js";
import { toast } from "../ui.js";
import * as desk from "../desk-api.js";
import { blockedHelp, canPromptInstall, enableNotifications, isIOS, isStandalone, notifyState, onWindow, promptInstall, sendTestNotification } from "../desk.js";

// Small drawings of the buttons people look for on screen.
const GLYPH = {
  share: `<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>`,
  add: `<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>`,
  dots: `<svg class="glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>`,
  safari: `<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>`,
  app: `<img class="glyph app" src="icons/icon-192.png" alt="" width="24" height="24">`,
  bell: `<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>`,
};
const IOS_STEPS = [
  [GLYPH.safari, "Open this link in <b>Safari</b>.", "Safari is the surest way. Some other iPhone browsers do not offer Add to Home Screen."],
  [GLYPH.share, "Tap <b>Share</b>, the square with an arrow pointing up.", "It is at the bottom of the screen, or at the top on iPad."],
  [GLYPH.add, "Scroll down, tap <b>Add to Home Screen</b>, then <b>Add</b>.", ""],
  [GLYPH.app, "Open <b>CA Desk</b> from your home screen.", "Sign in once inside the app."],
  [GLYPH.bell, "Tap <b>Turn on notifications</b> on this page.", "Then tap Allow."],
];
const ANDROID_STEPS = [
  [GLYPH.dots, "Open this link in <b>Chrome</b> and tap the <b>three dots</b> at the top right.", ""],
  [GLYPH.add, "Tap <b>Install app</b> or <b>Add to Home screen</b>, then <b>Install</b>.", ""],
  [GLYPH.app, "Open <b>CA Desk</b> from your home screen.", "Sign in once inside the app."],
  [GLYPH.bell, "Tap <b>Turn on notifications</b> on this page, then <b>Allow</b>.", ""],
];
const STATE = {
  on: ["pos", "Notifications are on for this phone"],
  off: ["", "Notifications are off"],
  blocked: ["neg", "Notifications are blocked"],
  unsupported: ["", "This browser cannot show notifications"],
  "install-first": ["warn", "Install the app first"],
};

export async function render(ctx) {
  let tab = isIOS() ? "ios" : "android";
  ctx.root.innerHTML = `<div class="install-page">
    <div class="page-head rise"><div><h1 class="page-title">Install the app</h1><p class="page-sub">CA Desk on your phone: your leads, team chat and alerts in one place. It takes a minute.</p></div></div>
    <div id="in-done"></div>
    <section class="card in-card">
      <div class="card-h"><h2>1. Add to home screen</h2></div>
      <div class="seg in-tabs" role="tablist" aria-label="Your phone">
        <button type="button" role="tab" data-tab="ios" aria-selected="${tab === "ios"}">iPhone or iPad</button>
        <button type="button" role="tab" data-tab="android" aria-selected="${tab === "android"}">Android or computer</button>
      </div>
      <div id="in-steps"></div>
    </section>
    <section class="card in-card">
      <div class="card-h"><h2>2. Turn on notifications</h2></div>
      <p class="in-why">When a lead becomes yours you get <b>10 minutes</b> to claim it. A notification tells you at once, even when the phone is locked. It shows only the lead number and the price band, never the customer's name or number.</p>
      <p class="hinglish">Naya lead aate hi phone pe ping aayega, phone lock ho tab bhi.</p>
      <div class="in-state" id="in-state"></div>
      <div class="in-btns">
        <button class="btn primary big-btn" type="button" id="in-notify">${icon("bell")}Turn on notifications</button>
        <button class="btn big-btn" type="button" id="in-test">${icon("send")}Send me a test notification</button>
      </div>
      <p class="muted small-note">${icon("info", "")}On iPhone, notifications work only from the installed app (iOS 16.4 or newer).</p>
    </section>
  </div>`;

  const steps = () => {
    const list = tab === "ios" ? IOS_STEPS : ANDROID_STEPS;
    const button = tab === "android" && canPromptInstall() ? `<button class="btn primary big-btn in-install" type="button" id="in-install">${icon("download")}Install CA Desk</button><p class="muted small-note">Or follow the steps below.</p>` : "";
    ctx.root.querySelector("#in-steps").innerHTML = `${button}<ol class="in-steps">${list.map(([g, t, s], i) => `<li><span class="in-n">${i + 1}</span>${g}<div><p>${t}</p>${s ? `<span class="muted">${esc(s)}</span>` : ""}</div></li>`).join("")}</ol>`;
    ctx.root.querySelector("#in-install")?.addEventListener("click", async () => { const ok = await promptInstall(); if (ok) toast("Installing. Open CA Desk from your home screen.", "ok"); steps(); });
  };
  ctx.root.querySelector(".in-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    tab = b.dataset.tab;
    ctx.root.querySelectorAll(".in-tabs [data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    steps();
  });

  async function paintState() {
    const s = await notifyState();
    if (!ctx.alive()) return;
    const [cls, label] = STATE[s] || STATE.off;
    const hint = s === "blocked" ? blockedHelp()
      : s === "install-first" ? "On iPhone, add CA Desk to the home screen (step 1), open it from there, then come back to this page."
      : s === "unsupported" ? "Open this link in Chrome on Android, or install the app on iPhone." : s === "on" ? "You will get a ping for new leads, mentions and answers from Ask Claude." : "Tap the red button and then Allow.";
    ctx.root.querySelector("#in-state").innerHTML = `<span class="badge ${cls}"><i></i>${esc(label)}</span><p class="muted">${esc(hint)}</p>`;
    const nb = ctx.root.querySelector("#in-notify");
    nb.hidden = s === "on" || s === "unsupported";
    nb.lastChild.textContent = s === "blocked" ? "Check again" : "Turn on notifications";
    nb.disabled = s === "install-first";
    ctx.root.querySelector("#in-done").innerHTML = isStandalone()
      ? `<div class="strip ok-strip" role="status">${icon("check", "")}<span><b>CA Desk is installed</b><span class="muted">You are using the app. ${s === "on" ? "Notifications are on." : "Turn on notifications below."}</span></span></div>` : "";
  }
  const notifyBtn = ctx.root.querySelector("#in-notify"), testBtn = ctx.root.querySelector("#in-test");
  notifyBtn.addEventListener("click", async () => {
    notifyBtn.disabled = true;
    const s = await enableNotifications();
    if (s === "on") desk.done("Notifications are on");
    else if (s === "blocked") toast("Notifications are blocked. See the steps on this page to allow them.", "err");
    notifyBtn.disabled = false;
    paintState();
  });
  testBtn.addEventListener("click", async () => { testBtn.disabled = true; await sendTestNotification(); testBtn.disabled = false; paintState(); });
  onWindow("desk:install", () => { steps(); paintState(); });
  steps();
  await paintState();
}
