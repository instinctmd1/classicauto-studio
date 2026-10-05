// Runs before first paint so the saved theme never flashes. External file: the CSP forbids inline scripts.
(function () {
  try {
    var t = localStorage.getItem("ca.theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    var m = document.querySelector('meta[name="theme-color"]');      // the phone's status bar matches the theme
    if (m && t === "light") m.setAttribute("content", "#F3F0E9");
  } catch (e) { /* storage blocked: stay dark */ }
})();
