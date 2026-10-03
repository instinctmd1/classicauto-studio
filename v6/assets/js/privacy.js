/* Privacy page: two lines that stay blank until Dad confirms them (nothing is promised before then).
   CA_SITE.retention   { enquiries_months, events_months, confirmed }  -> the retention sentence
   CA_SITE.grievance_name                                              -> the named grievance contact */
(function () {
  "use strict";
  var S = window.CA_SITE || {}, R = S.retention || {};
  var r = document.querySelector('[data-bind="retention-line"]');
  if (r && R.confirmed === true && R.enquiries_months > 0 && R.events_months > 0) {
    r.textContent = "Enquiries are kept for " + R.enquiries_months + " months and page-use events for " + R.events_months + " months, then deleted.";
  }
  var g = document.querySelector('[data-bind="grievance-line"]');
  if (g && S.grievance_name) g.textContent = S.grievance_name + ", our grievance contact";
})();
