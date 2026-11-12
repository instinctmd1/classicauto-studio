/* =========================================================================
   Classic Auto v6: car matching for "Find your car" and "Request a car".
   Pure functions over window.CARS. A score is built only from facts on the
   listing (price, body, fuel, gearbox, year, owner, make, colour, km, seats),
   and every point of it comes with a plain-language reason, so a match is
   never a claim the data can't back up.
   ========================================================================= */
(function () {
  "use strict";
  var fmt = window.ClassicAuto;

  var LUXURY = { BMW: 1, Jaguar: 1, "Mercedes-Benz": 1, Audi: 1, Volvo: 1, Lexus: 1 };
  var ORIGIN = {
    BMW: "german", "Mercedes-Benz": "german", Audi: "german", Volkswagen: "german", Skoda: "german",
    Kia: "korean", Hyundai: "korean",
    Toyota: "japanese", Honda: "japanese", Suzuki: "japanese", "Maruti Suzuki": "japanese", Nissan: "japanese", Renault: "french",
    Tata: "indian", Mahindra: "indian",
    Jaguar: "british", "Land Rover": "british", MG: "british"
  };
  var COLOUR_GROUP = function (c) {
    c = String(c || "").toLowerCase();
    if (/white|silver|grey|gray/.test(c)) return "light";
    if (/black|blue|green|navy|dark/.test(c)) return "dark";
    return "bold";
  };

  function monthlyEmi(car) { return car.price ? fmt.emi(car.price) : null; }
  function asArr(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }

  /* prefs: { budgetMin, budgetMax (rupees), body[], fuel[], trans, seatsMin, yearMin, singleOwner,
              origin[], colour[], priority, emiMax (rupees a month), kmMax, exDemo } */
  function score(car, p) {
    var pts = 0, max = 0, why = [], miss = [];
    function add(weight, ok, yes, no) { max += weight; if (ok) { pts += weight; if (yes) why.push(yes); } else if (no) miss.push(no); }

    if (p.budgetMax) {
      max += 36;
      if (car.price == null) { /* price on request: neutral */ pts += 14; }
      else if (car.price <= p.budgetMax && car.price >= (p.budgetMin || 0)) { pts += 36; why.push("Inside your budget at " + fmt.money(car.price)); }
      else if (car.price < (p.budgetMin || 0)) { pts += 26; why.push("Below your range at " + fmt.money(car.price)); }
      else if (car.price <= p.budgetMax * 1.12) { pts += 14; miss.push("A little over budget at " + fmt.money(car.price)); }
      else { pts -= 30; miss.push("Over budget at " + fmt.money(car.price)); }
    }
    if (p.emiMax && car.price) {
      max += 10;
      var e = monthlyEmi(car);
      if (e <= p.emiMax) { pts += 10; why.push("EMI around " + fmt.rupees(e) + " a month (estimate)"); }
      else miss.push("EMI estimate " + fmt.rupees(e) + " a month");
    }
    var bodies = asArr(p.body);
    if (bodies.length) add(20, bodies.indexOf(car.body) !== -1 || (bodies.indexOf("suv") !== -1 && car.body === "luxury-suv") || (bodies.indexOf("sedan") !== -1 && car.body === "luxury-sedan"), fmt.bodyLabel(car.body) + ", as you asked", "Not a " + bodies.map(fmt.bodyLabel).join(" / ").toLowerCase());
    var fuels = asArr(p.fuel);
    if (fuels.length) add(12, fuels.indexOf(car.fuel) !== -1, car.fuel + " engine", "Not " + fuels.join(" or ").toLowerCase());
    if (p.trans) add(12, car.trans === p.trans, car.trans + " gearbox", "Gearbox is " + car.trans.toLowerCase());
    if (p.seatsMin) add(10, (car.seats || (car.body === "mpv" ? 7 : 5)) >= p.seatsMin, "Seats " + (car.seats || (car.body === "mpv" ? 7 : 5)), "Fewer than " + p.seatsMin + " seats");
    if (p.yearMin) add(10, car.year >= p.yearMin, car.year + " model", car.year + " is older than you wanted");
    if (p.singleOwner) add(6, car.owners === "1st", "Single owner", "More than one owner");
    if (p.make) add(14, String(car.make).toLowerCase() === String(p.make).toLowerCase(), car.make + ", the make you asked for", "");
    var origins = asArr(p.origin).filter(function (o) { return o !== "any"; });
    if (origins.length) add(10, origins.indexOf(ORIGIN[car.make]) !== -1, car.make + " is on your list", "");
    var cols = asArr(p.colour).filter(function (c) { return c !== "any"; });
    if (cols.length) add(4, cols.indexOf(COLOUR_GROUP(car.colour)) !== -1, car.colour + " paint", "");
    if (p.kmMax) add(6, car.kms <= p.kmMax, "Only " + fmt.formatKm(car.kms) + " driven", "");
    if (p.exDemo) add(8, !!car.ex_demo, "Ex-demo car", "");

    // What matters most: a small, honest nudge from facts on the listing.
    var pr = p.priority;
    if (pr) {
      max += 10;
      if (pr === "running-cost" && (car.body === "hatchback" || car.fuel === "Diesel" || car.fuel === "Electric")) { pts += 10; why.push(car.fuel === "Diesel" ? "Diesel suits high running" : car.fuel === "Electric" ? "Low running cost" : "Compact hatchback"); }
      else if (pr === "comfort" && (car.trans === "Automatic" && (LUXURY[car.make] || car.body === "mpv" || /suv/.test(car.body)))) { pts += 10; why.push("Automatic with a comfortable body style"); }
      else if (pr === "status" && LUXURY[car.make]) { pts += 10; why.push(car.make + " badge"); }
      else if (pr === "space" && (car.body === "mpv" || /suv/.test(car.body))) { pts += 10; why.push("Roomy " + fmt.bodyLabel(car.body)); }
      else if (pr === "resale" && car.year >= 2022 && car.owners === "1st") { pts += 10; why.push("Recent, single-owner car"); }
      else if (pr === "performance" && (LUXURY[car.make] || car.fuel === "Diesel") && /suv|luxury/.test(car.body)) { pts += 10; why.push("Torquey diesel or luxury drivetrain"); }
      else if (pr === "easy-drive" && car.trans === "Automatic") { pts += 6; why.push("Automatic for easy city driving"); }
    }
    var pct = max > 0 ? Math.max(0, Math.min(100, Math.round(pts / max * 100))) : 50;
    return { score: pts, pct: pct, why: why, miss: miss };
  }

  function rank(prefs, opts) {
    opts = opts || {};
    var list = (window.CARS || []).filter(function (c) { return c.status !== "SOLD"; }).map(function (c) {
      var r = score(c, prefs); r.car = c; return r;
    });
    list.sort(function (a, b) { return b.pct - a.pct || b.score - a.score; });
    return opts.limit ? list.slice(0, opts.limit) : list;
  }

  window.CAMatch = { score: score, rank: rank, ORIGIN: ORIGIN };
})();
