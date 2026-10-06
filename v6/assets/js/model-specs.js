/* Classic Auto v6: "This model" facts for the car page (gap plan P1-3). Hand-kept, one entry per model generation, and only
   figures read from the maker's own pages or press releases (or the crash-test body's own site), each with its source and the
   date it was read. A car with no matching entry simply shows no "This model" block: nothing is guessed or copied from portals.

   An entry matches a car when make and model match, the car's year is inside [from, to], and every word in `variant_has`
   appears in the car's variant (case-insensitive). Add a row only with a source you can link to. */
var MODEL_SPECS = [
  {
    make: "Volkswagen", model: "Tiguan", variant_has: ["R-Line"], from: 2025, to: 2026,
    label: "Tiguan R-Line (third generation)",
    rows: [
      ["Engine", "2.0 TSI EVO petrol"], ["Power", "204 PS"], ["Torque", "320 Nm"], ["Gearbox", "7-speed DSG"],
      ["Drive", "4MOTION all-wheel drive"], ["Claimed mileage", "12.58 km/l"], ["Boot", "652 litres"], ["Ground clearance", "176 mm"],
      ["Airbags", "9"], ["Crash test", "Euro NCAP 5 stars (2024, European model)"]
    ],
    sources: [
      { name: "Volkswagen India, Tiguan R-Line page", url: "https://www.volkswagen.co.in/en/models/tiguan-r-line.html", as_of: "2026-10-07" },
      { name: "Euro NCAP, VW Tiguan result", url: "https://www.euroncap.com/en/results/vw/tiguan/51445", as_of: "2026-10-07" }
    ]
  },
  {
    make: "BMW", model: "X3", variant_has: ["20d"], from: 2025, to: 2026,
    label: "X3 xDrive20d M Sport (current generation, G45)",
    rows: [
      ["Engine", "2.0 litre four-cylinder diesel"], ["Power", "197 hp"], ["Torque", "400 Nm"], ["0 to 100 km/h", "7.7 seconds"],
      ["Gearbox", "8-speed Steptronic automatic"], ["Drive", "xDrive all-wheel drive"], ["Airbags", "8"]
    ],
    sources: [
      { name: "BMW Group India press release, 18 Jan 2025", url: "https://www.press.bmwgroup.com/india/article/detail/T0447563EN", as_of: "2026-10-07" }
    ]
  },
  {
    make: "Tata", model: "Safari", variant_has: [], from: 2024, to: 2026, fuel: "Diesel",
    label: "Safari 2.0 diesel automatic",
    rows: [
      ["Engine", "Kryotec 2.0 litre turbo diesel"], ["Power", "170 PS at 3,750 rpm"], ["Torque", "350 Nm at 1,750 to 2,500 rpm"],
      ["Gearbox", "Automatic"], ["Fuel tank", "50 litres"]
    ],
    sources: [
      { name: "Tata Motors, Safari specifications", url: "https://tata.cars/safari/ice/specifications.html", as_of: "2026-10-07" }
    ]
  }
];

if (typeof window !== "undefined") { window.MODEL_SPECS = MODEL_SPECS; }
