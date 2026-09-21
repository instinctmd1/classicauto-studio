/* Photo-360 spin component. Mounts only for car ids listed in
   window.CA_FRAMES_AVAILABLE (empty by default — no frames ship with this
   build, see frames/README.md). v4 used a HEAD-request probe instead, but
   that guarantees a logged 404 on every car page with no frames on disk;
   this explicit allow-list gets the same "stays hidden when absent"
   behaviour with zero failed network requests. To add real 360 frames
   for a car later: drop frames/<car-id>/001.jpg..024.jpg in place and add
   the id to CA_FRAMES_AVAILABLE below. */
(function () {
  "use strict";
  var mount = document.getElementById("spinMount");
  if (!mount || typeof CARS === "undefined") return;

  var CA_FRAMES_AVAILABLE = window.CA_FRAMES_AVAILABLE || [];

  var params = new URLSearchParams(window.location.search);
  var id = params.get("id");
  var car = CARS.filter(function (c) { return c.id === id; })[0];
  if (!car) return;
  if (CA_FRAMES_AVAILABLE.indexOf(car.id) === -1) return;

  var FRAME_COUNT = 24;
  var base = "frames/" + car.id + "/";

  mountSpin();

  function frameUrl(n) {
    var s = String(n);
    while (s.length < 3) s = "0" + s;
    return base + s + ".jpg";
  }

  function mountSpin() {
    mount.innerHTML =
      '<div class="spin-viewer" id="spinCanvas" role="img" aria-label="360-degree spin view of ' + car.make + ' ' + car.model + '">' +
      '<img id="spinImg" src="' + frameUrl(1) + '" alt="' + car.make + ' ' + car.model + ' — 360 spin, frame 1 of ' + FRAME_COUNT + '">' +
      '<span class="spin-hint">Drag to rotate</span></div>';

    var viewer = document.getElementById("spinCanvas");
    var imgEl = document.getElementById("spinImg");
    var frame = 0;
    var dragging = false;
    var lastX = 0;

    function setFrame(n) {
      frame = ((n % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
      imgEl.src = frameUrl(frame + 1);
      imgEl.alt = car.make + " " + car.model + " — 360 spin, frame " + (frame + 1) + " of " + FRAME_COUNT;
    }

    function start(x) { dragging = true; lastX = x; }
    function move(x) {
      if (!dragging) return;
      var dx = x - lastX;
      if (Math.abs(dx) > 6) {
        setFrame(frame + (dx > 0 ? -1 : 1));
        lastX = x;
      }
    }
    function end() { dragging = false; }

    viewer.addEventListener("mousedown", function (e) { start(e.clientX); });
    window.addEventListener("mousemove", function (e) { move(e.clientX); });
    window.addEventListener("mouseup", end);
    viewer.addEventListener("touchstart", function (e) { start(e.touches[0].clientX); }, { passive: true });
    viewer.addEventListener("touchmove", function (e) { move(e.touches[0].clientX); }, { passive: true });
    viewer.addEventListener("touchend", end);

    viewer.setAttribute("tabindex", "0");
    viewer.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { setFrame(frame - 1); e.preventDefault(); }
      if (e.key === "ArrowRight") { setFrame(frame + 1); e.preventDefault(); }
    });
  }
})();
