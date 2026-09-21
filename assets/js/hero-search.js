/* Homepage search bar -> deep-links into stock.html's existing filter
   query params (?budget=&body=&fuel=), read by stock.js. */
(function () {
  "use strict";
  var form = document.getElementById("heroSearchForm");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var budget = document.getElementById("searchBudget").value;
    var body = document.getElementById("searchBody").value;
    var fuel = document.getElementById("searchFuel").value;
    var params = new URLSearchParams();
    if (budget && budget !== "all") params.set("budget", budget);
    if (body && body !== "all") params.set("body", body);
    if (fuel && fuel !== "all") params.set("fuel", fuel);
    var qs = params.toString();
    window.location.href = "stock.html" + (qs ? "?" + qs : "");
  });
})();
