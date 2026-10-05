// The offline page's Retry, and an automatic retry when the phone is back online. The service worker shows this page
// at the app's own address, so a plain link to "./#/inbox" would only change the #hash and load nothing: reload instead.
// External file: the CSP forbids inline scripts.
(function () {
  function again() {
    var here = location.pathname;
    if (/offline\.html$/.test(here)) { location.replace("./#/inbox"); return; }
    try { history.replaceState(null, "", here + "#/inbox"); } catch (e) { /* keep the address as it is */ }
    location.reload();
  }
  var b = document.getElementById("retry");
  if (b) b.addEventListener("click", function (e) { e.preventDefault(); again(); });
  window.addEventListener("online", again);
})();
