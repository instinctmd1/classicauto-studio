/* Car detail page — reads ?id= from the URL, renders from window.CARS,
   drives the EMI calculator, insurance estimate, JSON-LD and visit form. */
(function () {
  "use strict";
  if (typeof CARS === "undefined") return;
  var fmt = window.ClassicAuto;
  var cardsApi = window.ClassicAutoCards;

  var params = new URLSearchParams(window.location.search);
  var id = params.get("id");
  var car = CARS.filter(function (c) { return c.id === id; })[0];

  var foundEl = document.getElementById("carFound");
  var notFoundEl = document.getElementById("carNotFound");

  if (!car) {
    if (foundEl) foundEl.style.display = "none";
    if (notFoundEl) notFoundEl.style.display = "block";
    document.title = "Car Not Found — Classic Auto";
    return;
  }

  document.title = fmt.carLabel(car) + " — Classic Auto";
  if (notFoundEl) notFoundEl.style.display = "none";
  if (foundEl) foundEl.style.display = "block";

  var setText = function (sel, val) { var el = document.querySelector(sel); if (el) el.textContent = val; };
  var setAttr = function (sel, attr, val) { var el = document.querySelector(sel); if (el) el.setAttribute(attr, val); };

  var photos = car.photos && car.photos.length ? car.photos : null;

  setText("[data-f=badge]", (car.status === "SOLD" ? "SOLD · " : "") + cardsApi.bodyLabel(car.body));
  setText("[data-f=title]", car.make + " " + car.model);
  setText("[data-f=variant]", car.variant + " · " + car.year);
  setText("[data-f=price]", fmt.money(car.price));
  setText("[data-f=desc]", car.notes);

  var img = document.querySelector("[data-f=image]");
  function showPhoto(idx) {
    if (photos) {
      img.src = photos[idx];
      img.alt = fmt.carFullLabel(car);
      img.style.display = "";
    }
  }
  if (photos) {
    showPhoto(0);
    var thumbsEl = document.querySelector("[data-f=thumbs]");
    if (thumbsEl && photos.length > 1) {
      thumbsEl.innerHTML = photos.map(function (p, i) {
        return '<button type="button" class="' + (i === 0 ? "is-active" : "") + '" data-idx="' + i + '"><img src="' + p + '" alt=""></button>';
      }).join("");
      thumbsEl.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          thumbsEl.querySelectorAll("button").forEach(function (x) { x.classList.remove("is-active"); });
          b.classList.add("is-active");
          showPhoto(parseInt(b.getAttribute("data-idx"), 10));
        });
      });
    }
  } else {
    // No real photo on file — swap the hero media for the same gradient
    // placeholder treatment used on the cards, never a fabricated photo.
    var mediaBox = img.closest(".detail-media");
    if (mediaBox) {
      mediaBox.classList.add("is-placeholder");
      mediaBox.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;text-align:center;">' +
        '<div><span class="ph-label" style="font-size:1.6rem;">' + car.make + '<br>' + car.model + '</span>' +
        '<span class="ph-note">Real photos available on request / at the showroom</span></div></div>';
    }
  }

  var specs = [
    ["Year", car.year],
    ["KM Driven", fmt.formatKm(car.kms)],
    ["Fuel", car.fuel],
    ["Transmission", car.trans],
    ["Owners", car.owners],
    ["Colour", car.colour],
    ["Registered", car.reg_city],
    ["Insurance", car.insurance]
  ];
  var specGrid = document.querySelector("[data-f=specs]");
  if (specGrid) {
    specGrid.innerHTML = specs.map(function (s) {
      return '<div class="spec-item"><span class="k">' + s[0] + '</span><span class="v">' + s[1] + '</span></div>';
    }).join("");
  }

  var highlights = [
    car.trans + " · " + car.fuel,
    car.owners + " owner, registered " + car.reg_city,
    car.insurance
  ];
  var highlightsEl = document.querySelector("[data-f=highlights]");
  if (highlightsEl) {
    highlightsEl.innerHTML = highlights.map(function (h) {
      return '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6 9 17l-5-5"/></svg><span>' + h + '</span></li>';
    }).join("");
  }

  var waMsg = "Hi, I'm interested in the " + fmt.carFullLabel(car) + " (" + fmt.money(car.price) + ") listed on your website. Is it still available?";
  var waBtn = document.getElementById("enquireWhatsapp");
  if (waBtn) waBtn.href = fmt.waLink(waMsg);
  var studioBtn = document.getElementById("studioBtn");
  if (studioBtn) studioBtn.href = "studio.html?id=" + encodeURIComponent(car.id);
  if (car.status === "SOLD") {
    if (waBtn) { waBtn.textContent = "Ask About Similar Cars"; waBtn.href = fmt.waLink("Hi, the " + fmt.carFullLabel(car) + " shows as sold — do you have anything similar available?"); }
  }

  /* ------------------------------------------------------------------
     Hero stat chips (year / km / fuel / EMI from) — Audi-style hero.
     ------------------------------------------------------------------ */
  var chipsEl = document.querySelector("[data-f=chips]");
  if (chipsEl) {
    var chips = [
      ["Year", car.year],
      ["KM", fmt.formatKm(car.kms)],
      ["Fuel", car.fuel],
      ["EMI from", fmt.rupees(fmt.emi(car.price)) + "/mo*"]
    ];
    chipsEl.innerHTML = chips.map(function (c) {
      return '<div class="hero-chip"><span class="k">' + c[0] + '</span><span class="v">' + c[1] + '</span></div>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Share (distinct from the enquiry button — this one is for forwarding
     the listing to someone else). Native share sheet where available,
     otherwise copy the link. Never routes through the dealer's number.
     ------------------------------------------------------------------ */
  var shareBtn = document.getElementById("shareWhatsapp");
  if (shareBtn) {
    shareBtn.addEventListener("click", function () {
      var shareText = "Check out this " + fmt.carFullLabel(car) + " (" + fmt.money(car.price) + ") on Classic Auto";
      var label = shareBtn.querySelector(".cta-label");
      if (navigator.share) {
        navigator.share({ title: document.title, text: shareText, url: window.location.href }).catch(function () {});
        return;
      }
      function done(ok) {
        if (!label) return;
        label.textContent = ok ? "Link copied" : "Copy the page link";
        window.setTimeout(function () { label.textContent = "Share"; }, 2200);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(window.location.href).then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
  }

  /* 120-point inspection report removed (2 Oct 2026): the inspection
     standard and accident/service claims are unconfirmed — to confirm
     with Dad before anything like it goes back on the site. */

  /* ------------------------------------------------------------------
     EMI eligibility quick check — income + existing EMI -> rough
     eligible loan amount. Estimate only, same 11.5%/5yr assumption as
     the EMI calculator above.
     ------------------------------------------------------------------ */
  var eligBtn = document.getElementById("eligCheckBtn");
  if (eligBtn) {
    eligBtn.addEventListener("click", function () {
      var income = parseFloat(document.getElementById("eligIncome").value) || 0;
      var existing = parseFloat(document.getElementById("eligExisting").value) || 0;
      var freeEmi = Math.max(0, income * 0.5 - existing);
      var rate = 0.115 / 12, n = 60;
      var factor = Math.pow(1 + rate, n);
      var eligibleLoan = freeEmi * (factor - 1) / (rate * factor);
      var resultEl = document.getElementById("eligResult");
      var amtEl = document.getElementById("eligAmt");
      resultEl.hidden = false;
      amtEl.textContent = fmt.money(eligibleLoan);
      amtEl.title = "At an estimated " + fmt.rupees(Math.round(freeEmi)) + "/mo";
    });
  }

  /* ------------------------------------------------------------------
     EMI calculator
     ------------------------------------------------------------------ */
  var downPct = document.getElementById("downPct");
  var tenure = document.getElementById("tenure");
  var downPctOut = document.getElementById("downPctOut");
  var tenureOut = document.getElementById("tenureOut");
  var emiResult = document.getElementById("emiResult");
  function recalc() {
    var dp = parseInt(downPct.value, 10);
    var months = parseInt(tenure.value, 10);
    downPctOut.textContent = dp + "%";
    tenureOut.textContent = months + " months";
    var e = fmt.emi(car.price, dp / 100, 0.115, months / 12);
    emiResult.textContent = fmt.rupees(e) + "/mo";
  }
  if (downPct && tenure) {
    downPct.addEventListener("input", recalc);
    tenure.addEventListener("input", recalc);
    recalc();
  }

  /* ------------------------------------------------------------------
     Insurance estimate — IDV ~= 90% of asking price, comprehensive
     ~= 3% of IDV/yr. Third-party shown as a fixed reference slab, not
     computed from this car.
     ------------------------------------------------------------------ */
  var idv = Math.round(car.price * 0.9);
  var comp = Math.round(idv * 0.03);
  var idvEl = document.getElementById("insIdv");
  var compEl = document.getElementById("insComp");
  if (idvEl) idvEl.textContent = fmt.money(idv);
  if (compEl) compEl.textContent = fmt.rupees(comp) + " / yr";

  /* ------------------------------------------------------------------
     schema.org Car/Offer JSON-LD
     ------------------------------------------------------------------ */
  var ldEl = document.getElementById("carJsonLd");
  if (ldEl) {
    ldEl.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Car",
      "name": fmt.carFullLabel(car),
      "brand": car.make,
      "model": car.model,
      "vehicleModelDate": String(car.year),
      "mileageFromOdometer": { "@type": "QuantitativeValue", "value": car.kms, "unitCode": "KMT" },
      "fuelType": car.fuel,
      "vehicleTransmission": car.trans,
      "color": car.colour,
      "offers": {
        "@type": "Offer",
        "priceCurrency": "INR",
        "price": car.price,
        "availability": car.status === "SOLD" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        "url": window.location.href,
        "seller": { "@type": "AutoDealer", "name": "Classic Auto", "areaServed": "Mumbai" }
      }
    });
  }

  /* ------------------------------------------------------------------
     Schedule-a-visit form -> shared lead contract (config.js). Date +
     30-minute slot chips (10:00–19:30), plus an At the showroom / Home
     test drive toggle — mirrors the home page "Book a test drive"
     widget in assets/js/testdrive.js.
     ------------------------------------------------------------------ */
  var visitForm = document.getElementById("visitForm");
  var visitStatus = document.getElementById("visitStatus");
  var vSlotsEl = document.getElementById("vSlots");
  var vSelectedTime = "";
  if (vSlotsEl) {
    var vStart = 10 * 60, vEnd = 19 * 60 + 30;
    for (var vm = vStart; vm <= vEnd; vm += 30) {
      (function (m) {
        var h = Math.floor(m / 60), mi = m % 60;
        var ampm = h >= 12 ? "pm" : "am";
        var h12 = h % 12 === 0 ? 12 : h % 12;
        var label = h12 + ":" + (mi === 0 ? "00" : mi) + " " + ampm;
        var value = (h < 10 ? "0" + h : h) + ":" + (mi === 0 ? "00" : mi);
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slot-chip";
        btn.setAttribute("aria-pressed", "false");
        btn.setAttribute("data-value", value);
        btn.textContent = label;
        btn.addEventListener("click", function () {
          vSlotsEl.querySelectorAll(".slot-chip").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
          btn.setAttribute("aria-pressed", "true");
          vSelectedTime = value;
        });
        vSlotsEl.appendChild(btn);
      })(vm);
    }
  }
  var vDateInput = document.getElementById("vDate");
  if (vDateInput) vDateInput.min = new Date().toISOString().slice(0, 10);

  if (visitForm) {
    visitForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("vName").value.trim();
      var phone = document.getElementById("vPhone").value.trim();
      var date = document.getElementById("vDate").value;
      var modeInput = visitForm.querySelector('input[name="vMode"]:checked');
      var mode = modeInput ? modeInput.value : "showroom";
      var ok = true;
      [["vName", name], ["vPhone", phone], ["vDate", date]].forEach(function (pair) {
        var field = document.getElementById(pair[0]).closest(".field");
        if (!pair[1]) { field.classList.add("has-error"); ok = false; }
        else field.classList.remove("has-error");
      });
      if (!vSelectedTime) ok = false;
      if (!ok) { visitStatus.textContent = "Please fill in every field, including a time slot."; visitStatus.className = "form-status is-error"; return; }

      var visitAt = humanizeVisit(date, vSelectedTime);
      visitStatus.textContent = "Sending your request…";
      visitStatus.className = "form-status";
      window.ClassicAutoLeads.submitLead({
        name: name, phone: phone, car: fmt.carFullLabel(car),
        message: mode === "home"
          ? "Home test drive requested (Mumbai western suburbs)."
          : "Showroom visit requested (Malad West).",
        budget: "", visit_at: visitAt, page: "car.html?id=" + car.id
      }).then(function (res) {
        visitStatus.textContent = window.ClassicAutoLeads.doneText(res, "Thanks! We'll confirm your visit on WhatsApp shortly.");
        visitStatus.className = "form-status is-ok";
        visitForm.reset();
        vSlotsEl.querySelectorAll(".slot-chip").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        vSelectedTime = "";
      });
    });
  }

  function humanizeVisit(dateStr, timeStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr + "T00:00:00");
    var dayLabel = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    var timeLabel = "";
    if (timeStr) {
      var parts = timeStr.split(":");
      var h = parseInt(parts[0], 10), m = parts[1];
      var ampm = h >= 12 ? "pm" : "am";
      var h12 = h % 12 === 0 ? 12 : h % 12;
      timeLabel = ", " + h12 + ":" + m + " " + ampm;
    }
    return dayLabel + timeLabel;
  }

  /* ------------------------------------------------------------------
     Similar cars
     ------------------------------------------------------------------ */
  var pool = CARS.filter(function (c) { return c.id !== car.id; });
  var sameType = pool.filter(function (c) { return c.body === car.body; });
  var similar = sameType.slice(0, 3);
  if (similar.length < 3) {
    var sameMake = pool.filter(function (c) { return c.make === car.make && similar.indexOf(c) === -1; });
    similar = similar.concat(sameMake).slice(0, 3);
  }
  if (similar.length < 3) {
    var rest = pool.filter(function (c) { return similar.indexOf(c) === -1; });
    similar = similar.concat(rest).slice(0, 3);
  }
  var similarGrid = document.querySelector("[data-f=similar]");
  if (similarGrid) similarGrid.innerHTML = similar.map(function (c) { return cardsApi.cardHTML(c); }).join("");
})();
