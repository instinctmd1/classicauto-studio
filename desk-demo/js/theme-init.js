// Runs before first paint so the saved theme never flashes. External file: the CSP forbids inline scripts.
(function () {
  try {
    var t = localStorage.getItem("ca.theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch (e) { /* storage blocked: stay dark */ }
})();
