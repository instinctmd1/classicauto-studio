/* Car page: "Share photos on WhatsApp" and "Download all photos".
   Share: the Web Share API with files (level 2), so the phone's own share sheet opens with only the car's photos (no text, no link).
     Android Chrome and iPhone Safari both do this. Chrome shares up to 10 files at a time, so a car with more photos is shared in batches
     ("Share photos 11-15"). Where the browser cannot share files (most desktops), the button opens WhatsApp with the car page's link instead.
   Download: all the photos in one .zip, built in the browser (a small store-only writer, no library).
   Photos are re-saved as JPEG on the way out (the site's WebP files would reach WhatsApp as stickers and are awkward in Photos).
   Same-origin images only, nothing is uploaded, and nothing is sent to us. The photos are prepared in the background while the page is idle,
   because the share sheet must open straight from the tap: a browser refuses it if the tap had to wait for a download.
   Reads window.CA_CAR_CURRENT, set by car-page.js. */
(function () {
  "use strict";
  var car = window.CA_CAR_CURRENT, box = document.querySelector('[data-f="photoActions"]');
  if (!car || !box || !car.photos || !car.photos.length || car.status === "SOLD" || !window.ClassicAutoCards) return;
  var cards = window.ClassicAutoCards, photos = car.photos, N = photos.length;
  var MAX = 10;                                           // Chrome's limit for files in one share
  var WA_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l1.9-5.6A8.4 8.4 0 1 1 21 11.5z"/></svg>';
  var DL_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>';
  var root = function (u) { return window.CA && window.CA.root ? window.CA.root(u) : u; };
  var track = function (via) { if (window.CA_TRACK) window.CA_TRACK("cta_click", { cta: "share_photos", at: "car_page", via: via }); };

  box.innerHTML =
    '<button type="button" class="btn btn-outline" id="sharePhotos">' + WA_ICON + '<span></span></button>' +
    '<button type="button" class="btn btn-outline" id="downloadPhotos">' + DL_ICON + '<span>Download all ' + N + ' photos</span></button>' +
    '<p class="photo-help" id="photoHelp" role="status" aria-live="polite"></p>';
  box.hidden = false;
  var shareBtn = document.getElementById("sharePhotos"), dlBtn = document.getElementById("downloadPhotos"), help = document.getElementById("photoHelp");
  function say(t) { help.textContent = t || ""; }
  function label(btn, t) { btn.querySelector("span").textContent = t; }

  /* ---- one photo -> a JPEG File ---- */
  function name(i) { return car.id + "-" + (i < 9 ? "0" : "") + (i + 1) + ".jpg"; }
  function toJpeg(i) {
    return fetch(root(photos[i])).then(function (r) { if (!r.ok) throw new Error("photo " + (i + 1)); return r.blob(); }).then(function (blob) {
      return (window.createImageBitmap ? createImageBitmap(blob) : new Promise(function (ok, no) {
        var im = new Image(), u = URL.createObjectURL(blob); im.onload = function () { URL.revokeObjectURL(u); ok(im); }; im.onerror = no; im.src = u;
      }));
    }).then(function (bmp) {
      var c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
      var x = c.getContext("2d"); x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0);
      if (bmp.close) bmp.close();
      return new Promise(function (ok, no) { c.toBlob(function (b) { b ? ok(new File([b], name(i), { type: "image/jpeg" })) : no(new Error("jpeg")); }, "image/jpeg", 0.9); });
    });
  }
  var cache = {}, done = {};
  function file(i) {
    return cache[i] || (cache[i] = toJpeg(i).then(function (f) { done[i] = f; return f; }, function (e) { delete cache[i]; throw e; }));
  }
  function files(from, to) { var p = []; for (var i = from; i < to; i++) p.push(file(i)); return Promise.all(p); }
  function have(from, to) { var out = []; for (var i = from; i < to; i++) { if (!done[i]) return null; out.push(done[i]); } return out; }

  /* ---- can this browser share files? ---- */
  var canFiles = false;
  try { canFiles = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] })); } catch (e) { canFiles = false; }
  var per = Math.min(MAX, N), batch = 0, batches = Math.ceil(N / per);
  function range() { var a = batch * per; return [a, Math.min(N, a + per)]; }
  function shareLabel() {
    if (!canFiles) return "Share on WhatsApp";
    var r = range();
    return N <= per ? "Share " + N + (N === 1 ? " photo" : " photos") + " on WhatsApp" : "Share photos " + (r[0] + 1) + "-" + r[1] + " on WhatsApp";
  }
  label(shareBtn, shareLabel());
  if (canFiles && N > per) say("The share sheet takes " + per + " photos at a time. Use Download all photos to get all " + N + ".");

  function waLink() { return "https://api.whatsapp.com/send?text=" + encodeURIComponent(cards.shareText(car) + "\n" + cards.absUrl(car)); }
  function openWa(via) { track(via || "whatsapp_link"); window.open(waLink(), "_blank", "noopener"); }      // only straight from a tap
  /* after something asynchronous the tap is used up and a browser blocks a pop-up: show a real link the visitor can tap instead */
  function offerWa(msg) {
    track("whatsapp_link_offered");
    help.textContent = msg + " ";
    var a = document.createElement("a");
    a.className = "text-link"; a.href = waLink(); a.target = "_blank"; a.rel = "noopener"; a.textContent = "Open WhatsApp with the link";
    help.appendChild(a);
  }
  function busy(btn, on, text) { btn.setAttribute("aria-busy", String(on)); btn.setAttribute("aria-disabled", String(on)); if (text) label(btn, text); }   // aria-disabled keeps focus on the button
  function isBusy(btn) { return btn.getAttribute("aria-busy") === "true"; }

  /* warm the first batch once the page is idle (not on a slow or data-saving connection) */
  var conn = navigator.connection || {};
  if (canFiles && !conn.saveData && !/(^|-)2g$/.test(conn.effectiveType || "")) {
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 1500); };
    var warm = function () { idle(function () { var r = range(); files(r[0], r[1]).catch(function () { /* tried again on tap */ }); }); };
    if (document.readyState === "complete") warm(); else window.addEventListener("load", warm);
  }

  function warmNext() { if (batches > 1) { var r = range(); files(r[0], r[1]).catch(function () { /* tried again on tap */ }); } }
  function doShare(list, ready) {
    if (!navigator.canShare({ files: list })) return ready ? openWa() : offerWa("This phone cannot share the photos from here.");
    return navigator.share({ files: list }).then(function () {
      track("share_sheet_files");
      if (batches > 1) { batch = (batch + 1) % batches; label(shareBtn, shareLabel()); warmNext(); }   // the next batch is ready for the next tap
    }, function (err) {
      if (err && err.name === "AbortError") return;                            // the visitor closed the share sheet
      if (err && err.name === "NotAllowedError" && !ready) { say("The photos are ready now. Tap Share again."); return; }
      if (ready) openWa(); else offerWa("The photos could not be shared from here.");
    });
  }
  shareBtn.addEventListener("click", function () {
    if (isBusy(shareBtn)) return;
    if (!canFiles) return openWa();
    var r = range(), ready = have(r[0], r[1]);
    if (ready) return doShare(ready, true);          // straight from the tap: the browser allows the share sheet
    var text = shareLabel();
    busy(shareBtn, true, "Getting the photos ready...");
    files(r[0], r[1]).then(function (list) { busy(shareBtn, false, text); say(""); return doShare(list, false); }, function () {
      busy(shareBtn, false, text); offerWa("The photos could not be prepared.");
    });
  });

  /* ---- download all: a store-only .zip built here ---- */
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function u16(n) { return [n & 255, (n >>> 8) & 255]; }
  function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
  function zip(entries) {                            // entries: [{name, data: Uint8Array}]
    var enc = new TextEncoder(), parts = [], central = [], offset = 0, d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    entries.forEach(function (e) {
      var nm = enc.encode(e.name), crc = crc32(e.data), size = e.data.length;
      var local = new Uint8Array([0x50, 0x4b, 3, 4].concat(u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(size), u32(size), u16(nm.length), u16(0)));
      parts.push(local, nm, e.data);
      central.push(new Uint8Array([0x50, 0x4b, 1, 2].concat(u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(size), u32(size), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), nm);
      offset += local.length + nm.length + size;
    });
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new Uint8Array([0x50, 0x4b, 5, 6].concat(u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cdSize), u32(offset), u16(0)));
    return new Blob(parts.concat(central, [end]), { type: "application/zip" });
  }
  function save(blob, fname) {
    var a = document.createElement("a"), u = URL.createObjectURL(blob);
    a.href = u; a.download = fname; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  }
  dlBtn.addEventListener("click", function () {
    if (isBusy(dlBtn)) return;
    var text = "Download all " + N + " photos", got = 0;
    busy(dlBtn, true, "Preparing 0 of " + N + "...");
    var list = [];
    var chain = Promise.resolve();
    photos.forEach(function (p, i) {
      chain = chain.then(function () { return file(i); }).then(function (f) { got++; label(dlBtn, "Preparing " + got + " of " + N + "..."); return f.arrayBuffer(); }).then(function (buf) { list.push({ name: name(i), data: new Uint8Array(buf) }); });
    });
    chain.then(function () {
      save(zip(list), car.id + "-photos.zip");
      track("download_photos"); busy(dlBtn, false, text);
      say("Saved " + N + " photos in one zip file. On an iPhone, Share photos and then Save Images puts them straight into Photos.");
    }, function () { busy(dlBtn, false, text); say("The photos could not be downloaded. Check your connection and try again."); });
  });
})();
