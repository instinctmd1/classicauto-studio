/* Classic Auto v6: "This model" facts for the car page (gap plan P1-3). Hand-kept, one entry per model generation, and only
   figures read from the maker's own pages or press releases (or the crash-test body's own site), each with its source and the
   date it was read. A car with no matching entry simply shows no "This model" block: nothing is guessed or copied from portals.

   An entry matches a car when make and model match, the car's year is inside [from, to], and every word in `variant_has`
   appears in the car's variant (case-insensitive). Add a row only with a source you can link to.

   The research behind the rows read on 2026-10-05 is the Tier A spec sheet (gap D21): every value there carries its source and a
   status, and only "confirmed" values are shown here. Values that were official but for another model year or trim, inferences
   (such as front-wheel drive) and feature lines read from brochure text are left out until they are checked on the PDF page or
   the car. */
var MODEL_SPECS = [
  {
    make: "Volkswagen", model: "Tiguan", variant_has: ["R-Line"], from: 2025, to: 2026,
    label: "Tiguan R-Line (third generation)",
    rows: [
      ["Engine", "2.0 TSI EVO petrol, 1,984 cc"], ["Power", "204 PS"], ["Torque", "320 Nm"], ["Gearbox", "7-speed DSG"],
      ["Drive", "4MOTION all-wheel drive"], ["Claimed mileage", "12.58 km/l"], ["Boot", "652 litres"], ["Ground clearance", "176 mm"],
      ["Length", "4,539 mm"], ["Width", "1,859 mm"], ["Height", "1,656 mm"], ["Wheelbase", "2,680 mm"], ["Fuel tank", "60 litres"],
      ["Airbags", "9"], ["Crash test", "Euro NCAP 5 stars (2024, European model)"]
    ],
    sources: [
      { name: "Volkswagen India, Tiguan R-Line page", url: "https://www.volkswagen.co.in/en/models/tiguan-r-line.html", as_of: "2026-10-07" },
      { name: "Volkswagen India, Tiguan R-Line brochure (April 2025)", url: "https://www.volkswagen.co.in/idhub/content/dam/onehub_pkw/importers/in/models/tiguan-r-line/tiguan-r-line-brochure.pdf", as_of: "2026-10-05" },
      { name: "Euro NCAP, VW Tiguan result", url: "https://www.euroncap.com/en/results/vw/tiguan/51445", as_of: "2026-10-07" }
    ]
  },
  {
    make: "BMW", model: "X3", variant_has: ["20d"], from: 2025, to: 2026,
    label: "X3 xDrive20d M Sport (current generation, G45)",
    rows: [
      ["Engine", "2.0 litre four-cylinder diesel, 48V mild hybrid"], ["Power", "197 hp"], ["Torque", "400 Nm at 1,500 to 2,750 rpm"], ["0 to 100 km/h", "7.7 seconds"],
      ["Gearbox", "8-speed Steptronic automatic"], ["Drive", "xDrive all-wheel drive"], ["Length", "4,755 mm"], ["Width", "1,920 mm"],
      ["Height", "1,660 mm"], ["Wheelbase", "2,865 mm"], ["Boot", "570 litres, 1,700 with the rear seats folded"], ["Airbags", "8"],
      ["Stability control", "DSC with Cornering Brake Control"]
    ],
    sources: [
      { name: "BMW Group India press release, 18 Jan 2025", url: "https://www.press.bmwgroup.com/india/article/detail/T0447563EN", as_of: "2026-10-07" },
      { name: "BMW Group press release, The new BMW X3 (2024)", url: "https://www.press.bmwgroup.com/global/article/detail/T0442377EN/the-new-bmw-x3?language=en", as_of: "2026-10-05" }
    ]
  },
  {
    make: "Tata", model: "Safari", variant_has: [], from: 2024, to: 2026, fuel: "Diesel",
    label: "Safari 2.0 diesel automatic",
    rows: [
      ["Engine", "Kryotec 2.0 litre turbo diesel, 1,956 cc"], ["Power", "170 PS at 3,750 rpm"], ["Torque", "350 Nm at 1,750 to 2,500 rpm"],
      ["Gearbox", "6-speed automatic"], ["Wheelbase", "2,741 mm"], ["Fuel tank", "50 litres"],
      ["Brakes", "ABS with EBD"], ["Stability control", "ESP with hill hold control"]
    ],
    sources: [
      { name: "Tata Motors, Safari specifications", url: "https://tata.cars/safari/ice/specifications.html", as_of: "2026-10-07" },
      { name: "Tata Motors, Safari specifications and trim walkthrough (PDF)", url: "https://www.tatamotors.com/wp-content/uploads/2024/08/new-safari-specifications-and-trim-walkthrough.pdf", as_of: "2026-10-05" }
    ]
  },
  {
    make: "Kia", model: "Seltos", variant_has: ["G1.5", "IVT"], from: 2022, to: 2022,
    label: "Seltos 1.5 petrol IVT HTX (first generation, 2022 model year)",
    rows: [
      ["Engine", "Smartstream G1.5 petrol, 1,497 cc"], ["Power", "115 PS at 6,300 rpm"], ["Torque", "144 Nm at 4,500 rpm"],
      ["Gearbox", "IVT automatic (CVT type)"], ["Seats", "5"], ["Length", "4,315 mm"], ["Width", "1,800 mm"], ["Height", "1,645 mm"],
      ["Wheelbase", "2,610 mm"], ["Boot", "433 litres"], ["Fuel tank", "50 litres"], ["Brakes", "ABS with EBD"],
      ["Stability control", "ESC with hill-start assist and Vehicle Stability Management"]
    ],
    sources: [
      { name: "Kia India, Seltos brochure (2022 model year)", url: "https://www.kia.com/content/dam/kia2/in/en/images/our-vehicles/seltos/showroom/SELTOS-Brochure-16-Page.pdf", as_of: "2026-10-05" },
      { name: "Kia India, Seltos mobile brochure (2022 model year)", url: "https://www.kia.com/content/dam/kia2/in/en/images/our-vehicles/seltos/showroom/MY-Seltos-Mobile-Brochure.pdf", as_of: "2026-10-05" }
    ]
  },
  {
    make: "Kia", model: "Carens", variant_has: ["G1.5", "DCT"], from: 2023, to: 2023,
    label: "Carens 1.5 T-GDi petrol 7DCT (2023 model year)",
    rows: [
      ["Engine", "Smartstream G1.5 T-GDi turbo petrol, 1,482 cc"], ["Power", "160 PS at 5,500 rpm"], ["Torque", "253 Nm at 1,500 to 3,500 rpm"],
      ["Gearbox", "7-speed DCT automatic"], ["Seats", "7 (this variant)"], ["Length", "4,540 mm"], ["Width", "1,800 mm"],
      ["Height", "1,708 mm (with roof rails)"], ["Wheelbase", "2,780 mm"], ["Fuel tank", "45 litres"], ["Airbags", "6, on every variant"],
      ["Brakes", "ABS, disc brakes on all four wheels"], ["Stability control", "ESC with hill-start assist"]
    ],
    sources: [
      { name: "Kia India, Carens brochure (2023)", url: "https://www.kia.com/content/dam/kia2/in/en/images/common/Kia-carens-mobile-brochure.pdf", as_of: "2026-10-05" },
      { name: "Kia India, Carens specifications", url: "https://www.kia.com/in/our-vehicles/carens/specs.html", as_of: "2026-10-05" }
    ]
  },
  {
    make: "Renault", model: "Kwid", variant_has: ["Climber", "EASY-R"], from: 2017, to: 2018,
    label: "Kwid 1.0 RXT Climber EASY-R (first generation)",
    rows: [
      ["Engine", "1.0 litre three-cylinder petrol"], ["Power", "68 PS at 5,500 rpm"], ["Torque", "91 Nm at 4,250 rpm"],
      ["Gearbox", "EASY-R 5-speed automated manual (AMT)"]
    ],
    sources: [
      { name: "Renault India press release, 1 Aug 2018", url: "https://cdn.group.renault.com/ren/in/press-and-media/press-releases/Press%20release%20New%20Kwid%20%20feature%20loaded%20range-Final.pdf.asset.pdf/3975752131.pdf", as_of: "2026-10-05" }
    ]
  },
  {
    make: "Jaguar", model: "XF", variant_has: ["2.2"], from: 2013, to: 2013, fuel: "Diesel",
    label: "XF 2.2 diesel (X250, assembled in Pune from January 2013)",
    rows: [
      ["Engine", "2.2 litre turbo diesel"], ["Gearbox", "8-speed ZF automatic"]
    ],
    sources: [
      { name: "Jaguar Land Rover India launch release, 24 Jan 2013", url: "https://media.jlr.com/corporate/news/2013/01/jaguar-land-rover-launch-locally-built-jaguar-xf-india", as_of: "2026-10-05" },
      { name: "Jaguar XF 2.2 diesel release, 28 Jun 2011", url: "https://media.jlr.com/archive-jaguar/en-gb/news/2011/06/new-jaguar-xf-22-diesel-four-countries-1313-km-one-tank-fuel", as_of: "2026-10-05" }
    ]
  }
];

if (typeof window !== "undefined") { window.MODEL_SPECS = MODEL_SPECS; }
