/* Home search bar -> deep-links into stock.html's filter query params (?band=&body=&fuel=), read by stock.js. */
(function () {
  "use strict";
  var form = document.getElementById("heroSearchForm");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var p = new URLSearchParams();
    [["searchBudget", "band"], ["searchBody", "body"], ["searchFuel", "fuel"]].forEach(function (x) {
      var v = document.getElementById(x[0]).value;
      if (v && v !== "all") p.set(x[1], v);
    });
    var qs = p.toString();
    window.location.href = "stock.html" + (qs ? "?" + qs : "");
  });
})();
