// Runs in the head, before first paint, like theme-init.js (the CSP forbids inline scripts). When the saved language is Hindi or
// Hinglish it sets <html lang> at once and pulls in that language's dictionary, so the page is not drawn in English first;
// English loads nothing. js/i18n.js (deferred) does the translating and loads the dictionary itself if this did not.
(function () {
  try {
    var l = localStorage.getItem("ca.lang");
    if (l === "hi" || l === "hinglish") {
      document.documentElement.setAttribute("lang", l === "hi" ? "hi" : "en");
      document.write('<script src="js/i18n-' + (l === "hi" ? "hi" : "hing") + '.js"><\/script>');
    }
  } catch (e) { /* storage blocked: English */ }
})();
