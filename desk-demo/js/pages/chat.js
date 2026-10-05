// Team chat (APP-SPEC section 5). Rooms by role, unread counts, photos resized on the phone, @mentions, live updates
// through the Desk feed (SSE, polling fallback). The server checks membership on every call; text is always escaped.
import { state } from "../state.js";
import { $, esc, icon, initials } from "../util.js";
import { confirmDialog, openMenu, toast } from "../ui.js";
import * as desk from "../desk-api.js";
import { deskNow, deskTime, onFeed, shrinkPhoto, uuid } from "../desk.js";
import { istMs } from "../desk-mock.js";
import * as api from "../api.js";

const ROOM_ICON = { all: "users", luxury: "star", premium: "tag", core: "car", managers: "shield", owners: "key" };
const wide = () => window.matchMedia("(min-width: 1100px)").matches;
const MAX_PHOTO = 5 * 1024 * 1024;
let sampleToldOnce = false;

export async function render(ctx) {
  let key = ctx.id && /^[a-z]+$/.test(ctx.id) ? ctx.id : null;
  if (!key && wide()) key = "all";
  ctx.root.innerHTML = `<div class="chat-layout${key ? " has-room" : ""}">
    <aside class="chat-rooms" aria-label="Rooms">
      <div class="rooms-head"><h1 class="page-title">Team chat</h1><span id="ch-sample"></span></div>
      <p class="page-sub rooms-sub">Talk to the team here instead of the old WhatsApp and Telegram groups.</p>
      <nav class="room-list" id="room-list"><div class="skel room-skel"></div><div class="skel room-skel"></div><div class="skel room-skel"></div></nav>
    </aside>
    <section class="chat-room" id="chat-room" aria-label="Conversation">${key ? `<div class="skel room-skel tall"></div>` : ""}</section>
  </div>`;
  const listEl = $("#room-list"), roomEl = $("#chat-room");
  let rooms = [];

  async function loadRooms(quiet = false) {
    try {
      const r = await desk.get("chat/rooms", {}, quiet ? { background: true } : {});
      if (!ctx.alive()) return;
      rooms = r.data || [];
      $("#ch-sample").innerHTML = desk.sampleChip("chat/");
      listEl.innerHTML = rooms.length ? rooms.map((rm) => `<a class="room-item${rm.key === key ? " on" : ""}" href="#/chat/${esc(rm.key)}"${rm.key === key ? ' aria-current="page"' : ""}>
          <span class="room-ic">${icon(ROOM_ICON[rm.key] || "chat", "")}</span>
          <span class="room-txt"><b>${esc(rm.name)}</b><span class="muted">${rm.last ? `${esc(shortName(rm.last.author))}: ${esc(rm.last.preview || "")}` : "No messages yet"}</span></span>
          <span class="room-side">${rm.last ? `<time>${esc(deskTime(rm.last.ts))}</time>` : ""}${rm.unread ? `<span class="count-pill" aria-label="${rm.unread} unread">${rm.unread > 99 ? "99+" : rm.unread}</span>` : ""}</span></a>`).join("")
        : `<div class="empty small">${icon("chat", "")}<b>No rooms for you yet</b><p>Ask the owner to switch on team chat for your account.</p></div>`;
    } catch (e) {
      if (!ctx.alive() || quiet) return;
      listEl.innerHTML = `<div class="err-box" role="alert">${icon("alert", "")}<div><b>Rooms could not load.</b><span class="muted">${esc(e.message || "")}</span></div></div>`;
    }
  }

  await loadRooms();
  if (!ctx.alive()) return;
  if (!key) {
    onFeed((row) => { if (/^chat\./.test(row.kind || "")) loadRooms(true); });
    return;
  }
  if (!rooms.some((r) => r.key === key)) {
    roomEl.innerHTML = `<div class="empty">${icon("lock", "")}<b>This room is not open to you</b><p>Rooms follow your role. Pick one from the list.</p><a class="btn" href="#/chat">All rooms</a></div>`;
    return;
  }
  await openRoom(ctx, roomEl, rooms.find((r) => r.key === key), () => loadRooms(true));
}

const firstName = (n) => String(n || "").replace(/\s*\(.*\)$/, "").split(/\s+/)[0] || n;
const shortName = (n) => String(n || "").replace(/\s*\(.*\)$/, "") || n;

async function openRoom(ctx, host, room, refreshRooms) {
  const key = room.key;
  host.innerHTML = `<header class="room-head">
      <a class="icon-btn room-back" href="#/chat" aria-label="All rooms">${icon("left")}</a>
      <span class="room-ic">${icon(ROOM_ICON[key] || "chat", "")}</span>
      <div class="room-title"><h2>${esc(room.name)}</h2><span class="muted" id="rm-members"></span></div>
    </header>
    <div class="room-older" id="rm-older"></div>
    <ol class="msgs" id="msgs" role="log" aria-live="polite" aria-label="Messages in ${esc(room.name)}"></ol>
    ${room.can_post === false ? `<p class="muted room-ro">${icon("lock", "")}Only some roles can post in this room.</p>` : composerHtml(key)}`;
  if (!wide()) document.title = `${room.name} · Classic Auto`;
  const msgsEl = $("#msgs", host);
  let msgs = [], lastRead = 0, members = [], hasMore = false;
  const mentions = new Map();       // first name -> user id, for names picked from the @ list

  const draw = (scroll) => {
    let html = "", day = "", unreadShown = false;
    for (const m of msgs) {
      const d = String(m.ts).slice(0, 10);
      if (d !== day) { day = d; html += `<li class="day-sep"><span>${esc(dayLabel(m.ts))}</span></li>`; }
      if (!unreadShown && lastRead && m.id > lastRead && !m.mine && !m.pending) { unreadShown = true; html += `<li class="unread-sep" id="unread-sep"><span>New messages</span></li>`; }
      html += bubble(m);
    }
    msgsEl.innerHTML = html || `<li class="empty small">${icon("chat", "")}<b>No messages yet</b><p>Say hello to the room.</p></li>`;
    $("#rm-older", host).innerHTML = hasMore ? `<button class="btn sm" type="button" id="rm-more">Show earlier messages</button>` : "";
    $("#rm-more", host)?.addEventListener("click", loadOlder);
    if (scroll === "unread" && $("#unread-sep", host)) $("#unread-sep", host).scrollIntoView({ block: "center" });
    else if (scroll) scrollEnd();
  };
  const scrollEnd = () => requestAnimationFrame(() => { window.scrollTo(0, document.documentElement.scrollHeight); });
  const nearEnd = () => window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 160;

  async function markRead() {
    const top = msgs.filter((m) => !m.pending).reduce((a, m) => Math.max(a, m.id), 0);
    if (!top || top <= lastRead) return;
    lastRead = top;
    try { await desk.post(`chat/rooms/${key}/read`, { last_id: top }); refreshRooms(); } catch { /* next time */ }
  }
  async function loadOlder() {
    const first = msgs.find((m) => !m.pending);
    if (!first) return;
    try {
      const r = await desk.get(`chat/rooms/${key}/messages`, { before: first.id, limit: 50 });
      hasMore = !!r.has_more;
      msgs = (r.data || []).concat(msgs);
      const h = document.documentElement.scrollHeight;
      draw(false);
      window.scrollBy(0, document.documentElement.scrollHeight - h);
    } catch (e) { toast(e.message || "Could not load earlier messages.", "err"); }
  }
  async function loadNew() {
    const top = msgs.filter((m) => !m.pending).reduce((a, m) => Math.max(a, m.id), 0);
    try {
      const r = await desk.get(`chat/rooms/${key}/messages`, top ? { after: top } : {}, { background: true });
      if (!ctx.alive()) return;
      const fresh = (r.data || []).filter((m) => !msgs.some((x) => x.id === m.id || (m.client_id && x.client_id === m.client_id)));
      if (!fresh.length) return;
      const stick = nearEnd();
      msgs = msgs.concat(fresh);
      draw(stick);
      // only when the person is actually here: a read receipt is a request that keeps the session awake (APP-SPEC G5)
      if (document.visibilityState === "visible" && stick && Date.now() - api.lastTouch < 120000) markRead();
    } catch { /* the feed will try again */ }
  }
  async function reloadAll() {
    try {
      const r = await desk.get(`chat/rooms/${key}/messages`, {}, { background: true });
      if (!ctx.alive()) return;
      msgs = (r.data || []).concat(msgs.filter((m) => m.pending));
      draw(false);
    } catch { /* keep what is shown */ }
  }

  try {
    const r = await desk.get(`chat/rooms/${key}/messages`);
    if (!ctx.alive()) return;
    msgs = r.data || []; lastRead = r.last_read_id || 0; hasMore = !!r.has_more;
    draw("unread");
    if (!$("#unread-sep", host)) scrollEnd();
    markRead();
  } catch (e) {
    msgsEl.innerHTML = `<li class="err-box" role="alert">${icon("alert", "")}<div><b>Messages could not load.</b><span class="muted">${esc(e.message || "")}</span></div></li>`;
    return;
  }
  desk.get("chat/members", { room: key }).then((list) => {
    members = Array.isArray(list) ? list : list.data || [];
    if (ctx.alive()) $("#rm-members", host).textContent = `${members.length} ${members.length === 1 ? "member" : "members"}`;
  }).catch(() => {});

  onFeed((row) => {
    if (row.kind === "chat.message" && (!row.room || row.room === key)) loadNew();
    else if (row.kind === "chat.deleted" && (!row.room || row.room === key)) reloadAll();
    if (/^chat\./.test(row.kind || "") && row.room !== key) refreshRooms();
  });

  // ------------------------------------------------------------------ delete your own message (15 minutes; the super-admin any time)
  msgsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-msg-menu]"); if (!b) return;
    const id = +b.dataset.msgMenu;
    openMenu(b, [{ label: "Delete message", icon: "trash", onClick: async () => {
      if (!(await confirmDialog({ title: "Delete this message?", text: "Everyone in the room will see \"Message removed\".", confirmLabel: "Delete", danger: true }))) return;
      try { await desk.del(`chat/messages/${id}`); const m = msgs.find((x) => x.id === id); if (m) Object.assign(m, { deleted: true, text: null, photo: null }); draw(false); }
      catch (ex) { toast(ex.status === 403 ? "Messages can be deleted only in the first 15 minutes." : ex.message || "Could not delete.", "err"); }
    } }], { align: "right" });
  });
  msgsEl.addEventListener("click", (e) => {
    const r = e.target.closest("[data-retry]"); if (!r) return;
    const m = msgs.find((x) => x.client_id === r.dataset.retry); if (m) sendText(m);
  });

  if (room.can_post === false) return;
  bindComposer();

  // ------------------------------------------------------------------ composer
  function bindComposer() {
    const form = $(".composer", host), ta = $("#cm-text", host), file = $("#cm-file", host), pick = $("#cm-pick", host), prev = $("#cm-prev", host);
    let photo = null;
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; };
    ta.addEventListener("input", () => { grow(); mentionPicker(); });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) { e.preventDefault(); form.requestSubmit(); }
      if (e.key === "Escape") pick.hidden = true;
    });
    $("#cm-photo", host).addEventListener("click", () => file.click());
    file.addEventListener("change", async () => {
      const f = file.files && file.files[0]; file.value = "";
      if (!f) return;
      if (!/^image\//.test(f.type)) { toast("Only photos can be sent here.", "err"); return; }
      try {
        const blob = await shrinkPhoto(f);
        if (blob.size > MAX_PHOTO) { toast("That photo is too large even after shrinking. Try another.", "err"); return; }
        if (photo) URL.revokeObjectURL(photo.url);
        photo = { blob, url: URL.createObjectURL(blob) };
        prev.hidden = false;
        prev.innerHTML = `<img src="${photo.url}" alt="Photo to send" width="56" height="56"><span>Photo ready. Add a caption or tap Send.</span><button class="icon-btn" type="button" id="cm-unpick" aria-label="Remove photo">${icon("x")}</button>`;
        $("#cm-unpick", host).addEventListener("click", () => { URL.revokeObjectURL(photo.url); photo = null; prev.hidden = true; prev.innerHTML = ""; });
        ta.focus();
      } catch (ex) { toast(ex.message || "Could not read that photo.", "err"); }
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text && !photo) { ta.focus(); return; }
      if (text.length > 2000) { toast("Messages can be up to 2,000 letters.", "err"); return; }
      const ids = [...mentions.entries()].filter(([n]) => new RegExp(`(^|\\s)@${n}\\b`, "i").test(text)).map(([, id]) => id);
      const m = { id: Date.now(), client_id: uuid(), ts: null, user: { id: state.user?.id, name: state.user?.display_name, initials: initials(state.user?.display_name) }, text: text || null, photo: photo ? { url: photo.url } : null, mentions: ids, mine: true, pending: true, _blob: photo?.blob };
      ta.value = ""; grow(); pick.hidden = true; mentions.clear();
      if (photo) { prev.hidden = true; prev.innerHTML = ""; photo = null; }
      msgs.push(m); draw(true);
      await sendText(m);
    });
  }

  async function sendText(m) {
    m.failed = false; m.pending = true; draw(false);
    try {
      let r;
      if (m._blob) {
        const fd = new FormData();
        fd.append("file", m._blob, "photo.jpg");
        if (m.text) fd.append("caption", m.text);
        fd.append("client_id", m.client_id);
        r = await desk.upload(`chat/rooms/${key}/photos`, fd);
      } else {
        r = await desk.post(`chat/rooms/${key}/messages`, { text: m.text, mentions: m.mentions, client_id: m.client_id });
      }
      const real = r && r.message;
      const i = msgs.indexOf(m);
      if (real && i >= 0) { if (msgs.some((x) => x.id === real.id && x !== m)) msgs.splice(i, 1); else msgs[i] = real; }
      else { m.pending = false; }
      if (desk.isSample("chat/") && !sampleToldOnce) { sampleToldOnce = true; toast("Demo: messages stay on this screen only. Nothing is saved.", "demo"); }
      draw(true); markRead();
    } catch (e) {
      m.pending = false; m.failed = true; draw(false);
      toast(e.message || "Not sent. Tap the message to try again.", "err");
    }
  }

  // ------------------------------------------------------------------ @ mentions
  function mentionPicker() {
    const ta = $("#cm-text", host), pick = $("#cm-pick", host);
    const before = ta.value.slice(0, ta.selectionStart);
    const m = before.match(/(^|\s)@([A-Za-z]*)$/);
    if (!m || !members.length) { pick.hidden = true; return; }
    const q = m[2].toLowerCase();
    const opts = members.filter((u) => u.user_id !== state.user?.id && firstName(u.name).toLowerCase().startsWith(q)).slice(0, 6);
    if (!opts.length) { pick.hidden = true; return; }
    pick.innerHTML = opts.map((u) => `<button type="button" role="option" data-uid="${u.user_id}" data-name="${esc(firstName(u.name))}"><span class="avatar sm">${esc(initials(u.name))}</span><span>${esc(u.name)}</span><span class="muted">${esc(roleWord(u.role))}</span></button>`).join("");
    pick.hidden = false;
    pick.onclick = (e) => {
      const b = e.target.closest("[data-uid]"); if (!b) return;
      const name = b.dataset.name;
      const start = before.length - m[2].length - 1;
      ta.value = ta.value.slice(0, start) + "@" + name + " " + ta.value.slice(ta.selectionStart);
      mentions.set(name, +b.dataset.uid);
      pick.hidden = true; ta.focus();
      const pos = start + name.length + 2; ta.setSelectionRange(pos, pos);
    };
  }
}

function composerHtml(key) {
  return `<form class="composer" novalidate>
    <div class="mention-pick" id="cm-pick" role="listbox" aria-label="People in this room" hidden></div>
    <div class="photo-prev" id="cm-prev" hidden></div>
    <div class="composer-row">
      <button class="icon-btn" type="button" id="cm-photo" aria-label="Send a photo">${icon("image")}</button>
      <input type="file" id="cm-file" accept="image/jpeg,image/png,image/webp,image/heic,image/*" hidden>
      <label class="sr" for="cm-text">Message</label>
      <textarea class="textarea" id="cm-text" rows="1" maxlength="2000" placeholder="Message · @ to mention" enterkeyhint="send"></textarea>
      <button class="btn primary send-btn" type="submit" aria-label="Send">${icon("send")}</button>
    </div>
  </form>`;
}

const roleWord = (r) => ({ owner: "Partner", manager: "Manager", salesman: "Sales", accountant: "Accounts", admin: "Tech" }[r] || "");
function dayLabel(ts) {
  if (!ts) return "Today";
  const t = deskTime(ts);
  if (/^\d{2}:\d{2}$/.test(t)) return "Today";
  if (t.startsWith("Yesterday")) return "Yesterday";
  return t.replace(/ \d{2}:\d{2}$/, "");
}
function textHtml(text, mentionsMe) {
  return esc(text).replace(/(^|\s)@([A-Za-z]+)/g, (_, sp, n) => `${sp}<span class="mention${mentionsMe ? " me" : ""}">@${n}</span>`).replace(/\n/g, "<br>");
}
function bubble(m) {
  const me = m.mentions && state.user && m.mentions.includes(state.user.id);
  const fresh = m.ts && deskNow() - istMs(m.ts) < 15 * 60000;
  const canDelete = !m.pending && !m.failed && !m.deleted && ((m.mine && fresh) || state.user?.is_super_admin);
  const head = m.mine ? "" : `<span class="b-name">${esc(m.user?.name || "Someone")}</span>`;
  const time = m.pending ? "Sending…" : m.failed ? "Not sent" : deskTime(m.ts);
  if (m.deleted) return `<li class="bubble-row${m.mine ? " mine" : ""}"><div class="bubble removed"><em>Message removed</em></div></li>`;
  return `<li class="bubble-row${m.mine ? " mine" : ""}${me ? " mentions-me" : ""}${m.pending ? " pending" : ""}${m.failed ? " failed" : ""}">
    ${m.mine ? "" : `<span class="avatar sm" aria-hidden="true">${esc(m.user?.initials || initials(m.user?.name))}</span>`}
    <div class="bubble">${head}
      ${m.photo ? `<a class="b-photo" href="${esc(m.photo.url)}" target="_blank" rel="noopener"><img src="${esc(m.photo.url)}" alt="Photo from ${esc(m.user?.name || "a colleague")}" loading="lazy" decoding="async"></a>` : ""}
      ${m.text ? `<p>${textHtml(m.text, me)}</p>` : ""}
      <span class="b-meta"><time>${esc(time)}</time>${m.failed ? `<button class="link-btn" type="button" data-retry="${esc(m.client_id)}">Try again</button>` : ""}${canDelete ? `<button class="b-menu" type="button" data-msg-menu="${m.id}" aria-label="Message options">${icon("more", "")}</button>` : ""}</span>
    </div></li>`;
}
