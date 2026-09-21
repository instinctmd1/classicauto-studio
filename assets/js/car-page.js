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
    car.insurance,
    "Multi-point inspection completed before listing"
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
     Schedule-a-visit form -> shared lead contract (config.js)
     ------------------------------------------------------------------ */
  var visitForm = document.getElementById("visitForm");
  var visitStatus = document.getElementById("visitStatus");
  if (visitForm) {
    visitForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("vName").value.trim();
      var phone = document.getElementById("vPhone").value.trim();
      var date = document.getElementById("vDate").value;
      var time = document.getElementById("vTime").value;
      var ok = true;
      [["vName", name], ["vPhone", phone], ["vDate", date], ["vTime", time]].forEach(function (pair) {
        var field = document.getElementById(pair[0]).closest(".field");
        if (!pair[1]) { field.classList.add("has-error"); ok = false; }
        else field.classList.remove("has-error");
      });
      if (!ok) { visitStatus.textContent = "Please fill in every field."; visitStatus.className = "form-status is-error"; return; }

      var visitAt = humanizeVisit(date, time);
      visitStatus.textContent = "Sending your request…";
      visitStatus.className = "form-status";
      window.ClassicAutoLeads.submitLead({
        name: name, phone: phone, car: fmt.carFullLabel(car),
        message: "Schedule a visit request from the car detail page.",
        budget: "", visit_at: visitAt, page: "car.html?id=" + car.id
      }).then(function () {
        visitStatus.textContent = "Thanks! We'll confirm your visit on WhatsApp shortly.";
        visitStatus.className = "form-status is-ok";
        visitForm.reset();
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
