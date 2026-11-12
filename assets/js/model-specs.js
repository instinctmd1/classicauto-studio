/* Classic Auto v6: "This model" facts for the car page (gap plan P1-3). Hand-kept, one entry per model generation, and only
   figures read from the maker's own pages or press releases (or the crash-test body's own site), each with its source and the
   date it was read. A car with no matching entry simply shows no "This model" block: nothing is guessed or copied from portals.

   An entry matches a car when make and model match, the car's year is inside [from, to], and every word in `variant_has`
   appears in the car's variant (case-insensitive). Add a row only with a source you can link to.

   The research behind the rows read on 2026-10-05 is the Tier A spec sheet (gap D21): every value there carries its source and a
   status, and only "confirmed" values are shown here. Values that were official but for another model year or trim, inferences
   (such as front-wheel drive) and feature lines read from brochure text are left out until they are checked on the PDF page or
   the car.

   The researched entries at the end (15 Oct 2026, one per car generation still in stock) are written by tools/merge_carinfo.py.
   Where the maker's own pages for an older model are gone, they use named spec sites and launch reports instead; such an entry
   carries `maker: false`, and the car page then says "from the published sources below", never "as published by the maker". */
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
    make: "Kia", model: "Seltos", variant_has: ["HTX", "IVT"], from: 2022, to: 2022, fuel: "Petrol",
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
    make: "Kia", model: "Carens", variant_has: ["Turbo", "DCT"], from: 2023, to: 2023, fuel: "Petrol",
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
  },
  /* ---- researched entries: written by tools/merge_carinfo.py from the per-car research files; change those files and re-run, not these lines ---- */
  {
    make: "Audi", model: "A4", variant_has: ["2.0 TDI", "143"], from: 2012, to: 2013, fuel: "Diesel", maker: false,
    label: "A4 2.0 TDI 143 PS (B8 facelift, 2012 to 2013)",
    rows: [
      ["Engine", "2.0 litre four-cylinder turbo-diesel (TDI), 1,968 cc"], ["Power", "143 PS (141 bhp) at 4,200 rpm"], ["Torque", "320 Nm at 1,750 to 2,500 rpm"],
      ["Gearbox", "Multitronic automatic (CVT)"], ["Drive", "Front-wheel drive"], ["Length", "4,701 mm"],
      ["Width", "1,826 mm"], ["Height", "1,427 mm"], ["Wheelbase", "2,808 mm"],
      ["Boot", "480 litres"], ["Fuel tank", "63 litres"]
    ],
    sources: [
      { name: "CarWale, A4 [2013-2016] 2.0 TDI (143bhp) specifications (spec database; Audi India's pages for this car are gone)", url: "https://www.carwale.com/audi-cars/a4-2013-2016/20-tdi-143bhp/", as_of: "2026-10-15" },
      { name: "MotorBeam, 2012 Audi A4 launched in India", url: "https://www.motorbeam.com/2012-audi-a4-launched-in-india/amp/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Audi", model: "A6", variant_has: ["45 TFSI"], from: 2020, to: 2020, fuel: "Petrol", maker: false,
    label: "A6 45 TFSI (eighth generation, C8)",
    rows: [
      ["Engine", "2.0 litre four-cylinder turbo-petrol (45 TFSI), 1,984 cc"], ["Power", "245 hp (2019 launch figure; Audi rates today's A6 at 265 hp)"], ["Torque", "370 Nm at 1,600 to 4,500 rpm"],
      ["Gearbox", "7-speed S tronic dual-clutch automatic"], ["Drive", "Front-wheel drive"], ["Top speed", "250 km/h"],
      ["Length", "4,939 mm"], ["Width", "1,886 mm"], ["Height", "1,470 mm"],
      ["Wheelbase", "2,930 mm"], ["Fuel tank", "73 litres"]
    ],
    sources: [
      { name: "Audi India, A6 Sedan brochure (technical details)", url: "https://delivery-p123727-e1214567.adobeaemcloud.com/adobe/assets/urn:aaid:aem:c0e9cbbc-aa14-47db-9a21-d737ee2b036f/original/as/AudiA6SedanBrochurerevisedcompressedNew.pdf", as_of: "2026-10-15" },
      { name: "Autocar India, 2019 Audi A6 launched at Rs 54.20 lakh (24 Oct 2019)", url: "https://www.autocarindia.com/car-news-amp/2019-audi-a6-launched-at-rs-5420-lakh-414632", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Audi", model: "Q3", variant_has: ["40 TFSI"], from: 2022, to: 2026, fuel: "Petrol", maker: false,
    label: "Q3 40 TFSI quattro (second generation, 2022 to 2026)",
    rows: [
      ["Engine", "2.0 litre four-cylinder turbo-petrol (40 TFSI), 1,984 cc"], ["Power", "190 PS (140 kW)"], ["Torque", "320 Nm at 1,500 to 4,100 rpm"],
      ["0 to 100 km/h", "7.3 seconds"], ["Gearbox", "7-speed dual-clutch automatic"], ["Drive", "quattro all-wheel drive"],
      ["Boot", "530 litres"], ["Airbags", "6"]
    ],
    sources: [
      { name: "Audi India online store (myAudi), Q3 versions and prices", url: "https://myaudi.in/en/vehicleSales/models/32/configure?uid=q3&year=2025", as_of: "2026-10-15" },
      { name: "Autocar India, new Audi Q3 launched at Rs 44.89 lakh (30 Aug 2022)", url: "https://www.autocarindia.com/car-news/new-audi-q3-launched-in-india-at-rs-4489-lakh-425557", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Audi", model: "Q7", variant_has: ["3.0 TDI"], from: 2010, to: 2015, fuel: "Diesel", maker: false,
    label: "Q7 3.0 TDI quattro (first generation, 2010 to 2015)",
    rows: [
      ["Engine", "3.0 litre V6 turbo-diesel, 2,967 cc"], ["Power", "241 bhp at 3,800 rpm"], ["Torque", "550 Nm at 1,750 rpm"],
      ["Gearbox", "8-speed Tiptronic automatic"], ["Drive", "quattro all-wheel drive"], ["Seats", "7, in three rows"],
      ["Length", "5,089 mm"], ["Height", "1,737 mm"], ["Wheelbase", "3,002 mm"],
      ["Fuel tank", "100 litres"], ["Suspension", "Adaptive air suspension"]
    ],
    sources: [
      { name: "CarWale, Q7 [2010-2015] 3.0 TDI quattro Premium Plus specifications (spec database; Audi India's pages for this car are gone)", url: "https://www.carwale.com/audi-cars/q7-2010-2015/30-tdi-quattro-premium-plus/", as_of: "2026-10-15" },
      { name: "CarDekho, Audi Q7 2006-2020 3.0 TDI Quattro Premium Plus specifications", url: "https://cardekho.com/overview/Audi_Q7/Audi_Q7_3.0_TDI_Quattro_Premium_Plus.htm", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Audi", model: "Q7", variant_has: ["45 TDI"], from: 2016, to: 2020, fuel: "Diesel", maker: false,
    label: "Q7 45 TDI (second generation, 2015 to 2020)",
    rows: [
      ["Engine", "3.0 litre V6 turbo-diesel (45 TDI), 2,967 cc"], ["Power", "249 PS (245 bhp)"], ["Torque", "600 Nm"],
      ["Gearbox", "8-speed automatic with paddle shifters"], ["Drive", "quattro all-wheel drive"], ["Seats", "7"],
      ["Length", "5,052 mm"], ["Width", "1,968 mm"], ["Height", "1,740 mm"],
      ["Wheelbase", "2,994 mm"], ["Suspension", "Adaptive air suspension"]
    ],
    sources: [
      { name: "CarTrade, Audi Q7 2015 45 TDI Technology Pack specifications (spec database; Audi India's pages for this car are gone)", url: "https://www.cartrade.com/audi-cars/q7/45-tdi-quattro-technology-pack", as_of: "2026-10-15" },
      { name: "Autocar India, Audi Q7 facelift launched at Rs 79.99 lakh (3 Feb 2022): the outgoing 45 TDI was a 249hp 3.0 V6 diesel", url: "https://www.autocarindia.com/car-news-amp/audi-q7-facelift-launched-at-rs-7999-lakh-423405", as_of: "2026-10-15" },
      { name: "Autocar India, new Audi Q7 launched at Rs 72 lakh (10 Dec 2015)", url: "https://www.autocarindia.com/car-news-amp/q7-launched-399082", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Audi", model: "RS5", variant_has: ["Sportback"], from: 2021, to: 2024, fuel: "Petrol", maker: false,
    label: "RS 5 Sportback (sold in India 2021 to 2025)",
    rows: [
      ["Engine", "2.9 litre twin-turbo V6 petrol (TFSI), 2,894 cc"], ["Power", "450 hp"], ["Torque", "600 Nm"],
      ["0 to 100 km/h", "3.9 seconds"], ["Gearbox", "8-speed automatic"], ["Drive", "quattro all-wheel drive with a self-locking centre differential"],
      ["Airbags", "6"]
    ],
    sources: [
      { name: "Autocar Professional, Audi India launches RS 5 Sportback at Rs 1.04 crore (9 Aug 2021)", url: "https://autocarpro.in/news-national/audi-india-launches-rs-5-sportback-at-rs-104-crore-79796", as_of: "2026-10-15" },
      { name: "CarDekho, Audi RS5 (discontinued) model page: engine size and gearbox", url: "https://www.cardekho.com/carmodels/Audi/Audi_RS5", as_of: "2026-10-15" }
    ]
  },
  {
    make: "BMW", model: "5 Series", variant_has: ["520d"], from: 2014, to: 2016, fuel: "Diesel",
    label: "5 Series 520d (sixth generation, F10, 2013 facelift)",
    rows: [
      ["Engine", "2.0 litre four-cylinder TwinPower Turbo diesel"], ["Power", "184 hp (135 kW)"], ["Torque", "380 Nm"],
      ["0 to 100 km/h", "7.9 seconds"], ["Top speed", "231 km/h"], ["Gearbox", "8-speed automatic"],
      ["Sunroof", "Electric glass roof, standard on every version"], ["Built at", "BMW Plant Chennai"]
    ],
    sources: [
      { name: "BMW Group India media information, the new 5 Series arrives in India (10 Oct 2013)", url: "https://www.press.bmwgroup.com/india/article/attachment/T0365503EN/521815", as_of: "2026-10-15" }
    ]
  },
  {
    make: "BMW", model: "7 Series", variant_has: ["740d"], from: 2023, to: 2025, fuel: "Diesel",
    label: "7 Series 740d M Sport (seventh generation, G70, before the 2026 facelift)",
    rows: [
      ["Engine", "3.0 litre six-cylinder TwinPower Turbo diesel"], ["Power", "286 hp (210 kW)"], ["Torque", "650 Nm at 1,500 to 2,500 rpm"],
      ["0 to 100 km/h", "6.0 seconds"], ["Top speed", "250 km/h"], ["Gearbox", "8-speed Steptronic automatic"],
      ["Airbags", "6"], ["Built at", "BMW Group Plant Chennai"]
    ],
    sources: [
      { name: "BMW Group India press release, i7 M70 xDrive and 740d M Sport launched (19 Oct 2023)", url: "https://www.press.bmwgroup.com/india/article/detail/T0437827EN", as_of: "2026-10-15" }
    ]
  },
  {
    make: "BMW", model: "X1", variant_has: ["sDrive20d"], from: 2016, to: 2019, fuel: "Diesel",
    label: "X1 sDrive20d (second generation, F48, before the 2020 facelift)",
    rows: [
      ["Engine", "2.0 litre four-cylinder TwinPower Turbo diesel"], ["Power", "190 hp (140 kW)"], ["Torque", "400 Nm at 1,750 to 2,500 rpm"],
      ["0 to 100 km/h", "7.8 seconds"], ["Top speed", "222 km/h"], ["Gearbox", "8-speed Steptronic automatic"],
      ["Boot", "Up to 505 litres"], ["Airbags", "6"], ["Built at", "BMW Plant Chennai"]
    ],
    sources: [
      { name: "BMW Group India media information, the all-new X1 launched (3 Feb 2016)", url: "https://www.press.bmwgroup.com/india/article/attachment/T0368217EN/523795", as_of: "2026-10-15" }
    ]
  },
  {
    make: "BMW", model: "X1", variant_has: ["sDrive18i"], from: 2023, to: 2026, fuel: "Petrol",
    label: "X1 sDrive18i M Sport (third generation, U11)",
    rows: [
      ["Engine", "1.5 litre three-cylinder TwinPower Turbo petrol"], ["Power", "134 hp"], ["Torque", "230 Nm"],
      ["0 to 100 km/h", "9.2 seconds"], ["Gearbox", "7-speed Steptronic dual-clutch automatic"], ["Boot", "540 litres, up to 1,600 with the rear seats folded"],
      ["Airbags", "6"], ["Built at", "BMW Group Plant Chennai"]
    ],
    sources: [
      { name: "BMW Group India press release, X1 sDrive18i M Sport launched (4 May 2023)", url: "https://www.press.bmwgroup.com/india/article/detail/T0415330EN", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Ford", model: "Endeavour", variant_has: ["2.2"], from: 2016, to: 2019, fuel: "Diesel", maker: false,
    label: "Endeavour 2.2 TDCi automatic (2016 to 2019)",
    rows: [
      ["Engine", "2.2 litre TDCi four-cylinder diesel, 2,198 cc"], ["Power", "158 bhp at 3,200 rpm"], ["Torque", "385 Nm at 1,600 rpm"],
      ["Gearbox", "6-speed automatic"], ["Drive", "Rear-wheel drive (4x2)"], ["Seats", "7, in three rows"],
      ["Length", "4,892 mm"], ["Width", "1,860 mm"], ["Height", "1,837 mm"],
      ["Wheelbase", "2,850 mm"], ["Ground clearance", "225 mm (unladen)"], ["Fuel tank", "80 litres"],
      ["Tyres", "265/60 R18"]
    ],
    sources: [
      { name: "CarWale, Endeavour [2016-2019] Titanium 2.2 4x2 AT specifications", url: "https://www.carwale.com/ford-cars/endeavour-2016-2019/titanium-22-4x2-at/", as_of: "2026-10-15" },
      { name: "CarTrade, Endeavour 2016-2019 variants", url: "https://www.cartrade.com/ford-cars/endeavour-2016-2019/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Ford", model: "Endeavour", variant_has: ["3.2"], from: 2016, to: 2019, fuel: "Diesel", maker: false,
    label: "Endeavour 3.2 TDCi 4x4 automatic (2016 to 2019)",
    rows: [
      ["Engine", "3.2 litre TDCi diesel, 3,198 cc"], ["Gearbox", "6-speed automatic"], ["Drive", "Four-wheel drive (4x4)"],
      ["Seats", "7, in three rows"], ["Length", "4,892 mm"], ["Width", "1,860 mm"],
      ["Height", "1,837 mm"], ["Wheelbase", "2,850 mm"], ["Ground clearance", "225 mm (unladen)"],
      ["Fuel tank", "80 litres"], ["Tyres", "265/60 R18"]
    ],
    sources: [
      { name: "CarTrade, Endeavour 2016-2019 variants", url: "https://www.cartrade.com/ford-cars/endeavour-2016-2019/", as_of: "2026-10-15" },
      { name: "CarWale, Endeavour [2016-2019] Titanium 2.2 4x2 AT specifications", url: "https://www.carwale.com/ford-cars/endeavour-2016-2019/titanium-22-4x2-at/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Ford", model: "Endeavour", variant_has: ["2.0"], from: 2020, to: 2021, fuel: "Diesel", maker: false,
    label: "Endeavour 2.0 EcoBlue 10-speed automatic (BS6, 2020 to 2021)",
    rows: [
      ["Engine", "2.0 litre EcoBlue diesel, 1,996 cc"], ["Power", "167.6 bhp (about 170 PS) at 3,500 rpm"], ["Torque", "420 Nm at 2,000 to 2,500 rpm"],
      ["Gearbox", "10-speed automatic with paddle shifters"], ["Drive", "Four-wheel drive (4x4)"], ["Seats", "7"],
      ["Length", "4,903 mm"], ["Width", "1,869 mm"], ["Height", "1,837 mm"],
      ["Wheelbase", "2,850 mm"], ["Fuel tank", "80 litres"], ["Tyres", "265/60 R18"],
      ["Airbags", "7"]
    ],
    sources: [
      { name: "CarDekho, Endeavour 2020-2022 Titanium Plus 4X4 AT", url: "https://www.cardekho.com/overview/Ford_Endeavour_2020-2022/Ford_Endeavour_2020-2022_Titanium_Plus_4X4_AT.htm", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Honda", model: "City", variant_has: ["i-DTEC"], from: 2014, to: 2016, fuel: "Diesel", maker: false,
    label: "City 1.5 i-DTEC diesel (Honda India's fourth-generation City, before the 2017 facelift)",
    rows: [
      ["Engine", "1.5 i-DTEC diesel, four cylinders, DOHC"], ["Power", "100 PS"], ["Gearbox", "6-speed manual"],
      ["Drive", "Front-wheel drive"], ["Seats", "5"], ["Length", "4,440 mm"],
      ["Width", "1,695 mm"], ["Height", "1,495 mm"], ["Wheelbase", "2,600 mm"]
    ],
    sources: [
      { name: "Honda Cars India press release, fourth-generation City unveiled (25 Nov 2013)", url: "https://www.hondacarindia.com/pressreleaseattachment/press%20release%20-%20honda%20unveils%20all%20new%204th%20generation%20honda%20city%20-final.pdf", as_of: "2026-10-15" },
      { name: "Autocar Professional, new City launch (7 Jan 2014)", url: "https://www.autocarpro.in/feature/city-rolls-petrol-version-mid-feb-4896", as_of: "2026-10-15" },
      { name: "Rushlane, Honda City facelift launch (2 Mar 2017)", url: "https://www.rushlane.com/new-honda-city-facelift-india-launch-price-specs-12194700.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Honda", model: "City", variant_has: ["CVT", "Petrol"], from: 2014, to: 2016, fuel: "Petrol", maker: false,
    label: "City 1.5 i-VTEC petrol CVT (Honda India's fourth-generation City, before the 2017 facelift)",
    rows: [
      ["Engine", "1.5 i-VTEC petrol, four cylinders, SOHC"], ["Power", "118 PS"], ["Gearbox", "CVT automatic"],
      ["Drive", "Front-wheel drive"], ["Seats", "5"], ["Length", "4,440 mm"],
      ["Width", "1,695 mm"], ["Height", "1,495 mm"], ["Wheelbase", "2,600 mm"]
    ],
    sources: [
      { name: "Honda Cars India press release, fourth-generation City unveiled (25 Nov 2013)", url: "https://www.hondacarindia.com/pressreleaseattachment/press%20release%20-%20honda%20unveils%20all%20new%204th%20generation%20honda%20city%20-final.pdf", as_of: "2026-10-15" },
      { name: "Autocar Professional, new City launch (7 Jan 2014)", url: "https://www.autocarpro.in/feature/city-rolls-petrol-version-mid-feb-4896", as_of: "2026-10-15" },
      { name: "Rushlane, Honda City facelift launch (2 Mar 2017)", url: "https://www.rushlane.com/new-honda-city-facelift-india-launch-price-specs-12194700.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Hyundai", model: "Creta", variant_has: ["1.6"], from: 2015, to: 2020, fuel: "Petrol", maker: false,
    label: "Creta 1.6 Dual VTVT petrol (first generation, 2015 to 2020)",
    rows: [
      ["Engine", "1.6 Dual VTVT petrol, 1,591 cc"], ["Power", "122 bhp at 6,400 rpm"], ["Gearbox", "6-speed manual or 6-speed automatic"],
      ["Drive", "Front-wheel drive"], ["Seats", "5"], ["Length", "4,270 mm"],
      ["Width", "1,780 mm"], ["Wheelbase", "2,590 mm"], ["Ground clearance", "190 mm"]
    ],
    sources: [
      { name: "CarWale, Creta 2015-2017 1.6 SX Plus petrol specifications (spec database; Hyundai's pages for this car are gone)", url: "https://www.carwale.com/hyundai-cars/creta-2015-2017/16-sx-plus-petrol/", as_of: "2026-10-15" },
      { name: "CarWale, Creta 2017-2018 SX Plus 1.6 petrol specifications (spec database)", url: "https://www.carwale.com/hyundai-cars/creta-2017-2018/sxplus16atpetrol/", as_of: "2026-10-15" },
      { name: "CarWale, Creta 2018-2019 SX 1.6 petrol specifications (spec database)", url: "https://www.carwale.com/hyundai-cars/creta-2018-2019/sx-16-at-petrol/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Hyundai", model: "Creta", variant_has: ["1.5", "Petrol", "CVT"], from: 2020, to: 2023, fuel: "Petrol",
    label: "Creta 1.5 MPi petrol IVT (second generation, 2020 to 2023)",
    rows: [
      ["Engine", "1.5 MPi petrol, 1,497 cc"], ["Power", "115 PS at 6,300 rpm"], ["Torque", "143.8 Nm at 4,500 rpm"],
      ["Gearbox", "IVT automatic (CVT type)"], ["Drive", "Front-wheel drive"], ["Seats", "5"],
      ["Length", "4,300 mm"], ["Width", "1,790 mm"], ["Height", "1,635 mm (with roof rails)"],
      ["Wheelbase", "2,610 mm"], ["Fuel tank", "50 litres"], ["Tyres", "215/60 R17 alloys (SX and SX(O))"],
      ["Brakes", "Discs front and rear (SX and SX(O))"]
    ],
    sources: [
      { name: "Hyundai India, Creta brochure (2022; copy hosted by CarWale)", url: "https://stc.aeplcdn.com/f/brochure/8/1285/dsdfgie.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Hyundai", model: "Creta", variant_has: ["1.4", "Turbo", "DCT"], from: 2020, to: 2023, fuel: "Petrol",
    label: "Creta 1.4 T-GDi turbo petrol 7DCT (second generation, 2020 to 2023)",
    rows: [
      ["Engine", "1.4 T-GDi turbo petrol, 1,353 cc"], ["Power", "140 PS at 6,000 rpm"], ["Torque", "242 Nm at 1,500 to 3,200 rpm"],
      ["Gearbox", "7-speed DCT automatic"], ["Drive", "Front-wheel drive"], ["Seats", "5"],
      ["Length", "4,300 mm"], ["Width", "1,790 mm"], ["Height", "1,635 mm (with roof rails)"],
      ["Wheelbase", "2,610 mm"], ["Fuel tank", "50 litres"], ["Tyres", "215/60 R17 alloys"],
      ["Airbags", "6 on the SX(O)"], ["Brakes", "Discs front and rear"]
    ],
    sources: [
      { name: "Hyundai India, Creta brochure (2022; copy hosted by CarWale)", url: "https://stc.aeplcdn.com/f/brochure/8/1285/dsdfgie.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Hyundai", model: "Creta", variant_has: ["Diesel", "Automatic"], from: 2020, to: 2023, fuel: "Diesel",
    label: "Creta 1.5 CRDi diesel 6-speed automatic (second generation, 2020 to 2023)",
    rows: [
      ["Engine", "1.5 U2 CRDi diesel, 1,493 cc"], ["Power", "115 PS at 4,000 rpm"], ["Torque", "250 Nm at 1,500 to 2,750 rpm"],
      ["Gearbox", "6-speed automatic"], ["Drive", "Front-wheel drive"], ["Seats", "5"],
      ["Length", "4,300 mm"], ["Width", "1,790 mm"], ["Height", "1,635 mm (with roof rails)"],
      ["Wheelbase", "2,610 mm"], ["Fuel tank", "50 litres"], ["Tyres", "215/60 R17 alloys"],
      ["Airbags", "6 on the SX(O)"], ["Brakes", "Discs front and rear"]
    ],
    sources: [
      { name: "Hyundai India, Creta brochure (2022; copy hosted by CarWale)", url: "https://stc.aeplcdn.com/f/brochure/8/1285/dsdfgie.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Hyundai", model: "Creta", variant_has: ["Diesel", "AT"], from: 2024, to: 2026, fuel: "Diesel",
    label: "Creta 1.5 CRDi diesel 6-speed automatic (second generation after the January 2024 facelift)",
    rows: [
      ["Engine", "1.5 U2 CRDi diesel, 1,493 cc"], ["Power", "116 PS at 4,000 rpm"], ["Torque", "250 Nm at 1,500 to 2,750 rpm"],
      ["Gearbox", "6-speed automatic"], ["Drive", "Front-wheel drive"], ["Seats", "5"],
      ["Length", "4,330 mm"], ["Width", "1,790 mm"], ["Height", "1,635 mm (with roof rails)"],
      ["Wheelbase", "2,610 mm"], ["Fuel tank", "50 litres"], ["Airbags", "6, on every version"],
      ["Brakes", "Discs front and rear, every version"], ["Stability control", "ESC with Vehicle Stability Management and hill-start assist"]
    ],
    sources: [
      { name: "Hyundai India, Creta brochure (June 2026)", url: "https://www.hyundai.com/content/dam/hyundai/in/en/data/brochure/creta.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Hyundai", model: "Grand i10 Nios", variant_has: ["AT", "Kappa"], from: 2019, to: 2022, fuel: "Petrol",
    label: "Grand i10 Nios 1.2 Kappa petrol AMT (before the January 2023 facelift)",
    rows: [
      ["Engine", "1.2 Kappa petrol, 1,197 cc"], ["Power", "83 PS at 6,000 rpm"], ["Torque", "113.8 Nm at 4,000 rpm"],
      ["Gearbox", "5-speed AMT (automated manual)"], ["Drive", "Front-wheel drive"], ["Seats", "5"],
      ["Length", "3,805 mm"], ["Width", "1,680 mm"], ["Height", "1,520 mm"],
      ["Wheelbase", "2,450 mm"], ["Fuel tank", "37 litres"], ["Tyres", "165/70 R14 alloys (Sportz)"],
      ["Brakes", "Discs at the front, drums at the rear; ABS with EBD"], ["Airbags", "2 (driver and passenger)"]
    ],
    sources: [
      { name: "Hyundai India, Grand i10 Nios brochure (Aug-Sep 2020; copy hosted by CarWale)", url: "https://stc.aeplcdn.com/f/brochure/8/1196/pmdaq0e.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Hyundai", model: "i20", variant_has: ["IVT"], from: 2024, to: 2026, fuel: "Petrol",
    label: "i20 1.2 Kappa petrol IVT (third generation, after the 2023 facelift)",
    rows: [
      ["Engine", "1.2 Kappa petrol, 1,197 cc"], ["Power", "88 PS at 6,000 rpm (IVT)"], ["Torque", "114.7 Nm at 4,200 rpm"],
      ["Gearbox", "IVT automatic (CVT type)"], ["Drive", "Front-wheel drive"], ["Seats", "5"],
      ["Length", "3,995 mm"], ["Width", "1,775 mm"], ["Height", "1,505 mm"],
      ["Wheelbase", "2,580 mm"], ["Fuel tank", "37 litres"], ["Tyres", "195/55 R16 diamond-cut alloys (Asta and Asta (O))"],
      ["Airbags", "6, on every version"], ["Stability control", "ESC with hill-start assist and Vehicle Stability Management, every version"]
    ],
    sources: [
      { name: "Hyundai India, i20 brochure (June 2026)", url: "https://www.hyundai.com/content/dam/hyundai/in/en/data/brochure/i20.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Hyundai", model: "Ioniq 5", variant_has: [], from: 2023, to: 2025, fuel: "Electric", maker: false,
    label: "Ioniq 5 72.6 kWh rear-wheel drive (2023 to 2025, before the 2026 update)",
    rows: [
      ["Battery", "72.6 kWh"], ["Claimed range", "631 km (ARAI)"], ["Power", "217 hp"],
      ["Torque", "350 Nm"], ["Drive", "Rear-wheel drive, single motor"], ["Fast charging", "10 to 80% in 18 minutes on an 800V fast charger"],
      ["Vehicle-to-load", "Up to 3.6 kW"]
    ],
    sources: [
      { name: "Autocar Professional, Ioniq 5 launch at Auto Expo (11 Jan 2023)", url: "https://autocarpro.in/news-national/hyundai-motor-india-launches-ioniq-5-ev-at-rs-4495-lakh-at-auto-expo-113843", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Hyundai", model: "Verna", variant_has: ["1.6", "AT"], from: 2017, to: 2020, fuel: "Petrol", maker: false,
    label: "Verna 1.6 VTVT petrol (fifth generation, 2017 to 2020)",
    rows: [
      ["Engine", "1.6 VTVT petrol, 1,591 cc"], ["Power", "121 bhp at 6,400 rpm"], ["Torque", "151 Nm at 4,850 rpm"],
      ["Drive", "Front-wheel drive"], ["Seats", "5"], ["Length", "4,440 mm"],
      ["Width", "1,729 mm"], ["Height", "1,475 mm"], ["Wheelbase", "2,600 mm"],
      ["Boot", "465 litres"], ["Fuel tank", "45 litres"], ["Tyres", "195/55 R16 alloys"]
    ],
    sources: [
      { name: "CarWale, Verna 2017-2020 SX (O) 1.6 VTVT specifications (spec database; Hyundai's pages for this car are gone)", url: "https://www.carwale.com/hyundai-cars/verna-2017-2020/sx-o-16-vtvt-at/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Jaguar", model: "XJ", variant_has: ["50"], from: 2018, to: 2019, fuel: "Diesel", maker: false,
    label: "XJ50 3.0 diesel, long wheelbase (50th-anniversary edition)",
    rows: [
      ["Engine", "3.0 litre V6 turbo-diesel"], ["Power", "300 PS"], ["Torque", "700 Nm"],
      ["Gearbox", "8-speed ZF automatic"], ["Drive", "Rear-wheel drive"], ["0 to 100 km/h", "6.2 seconds"],
      ["Top speed", "250 km/h (limited)"], ["Body", "Long wheelbase (XJ L) only, in India"]
    ],
    sources: [
      { name: "JLR media, XJ50 celebrates five decades of Jaguar's saloon (25 Apr 2018)", url: "https://media.jlr.com/corporate/news/2018/04/xj50-celebrates-five-decades-jaguars-legendary-saloon", as_of: "2026-10-15" },
      { name: "Rushlane, Jaguar XJ50 launch at Rs 1.11 crore (3 Dec 2018)", url: "https://www.rushlane.com/jaguar-xj-50-launch-price-rs-1-11-cr-12289621.html", as_of: "2026-10-15" },
      { name: "Rushlane, 2016 Jaguar XJ launched in India (28 Jan 2016)", url: "https://www.rushlane.com/2016-jaguar-xj-launched-in-india-12181123.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Jeep", model: "Compass", variant_has: ["Limited", "1.4", "Petrol"], from: 2017, to: 2020, fuel: "Petrol", maker: false,
    label: "Compass 1.4 petrol automatic, Limited (first generation, 2017 to 2020)",
    rows: [
      ["Engine", "1.4 litre MultiAir turbo-petrol, 1,368 cc"], ["Power", "160 bhp at 5,500 rpm"], ["Torque", "250 Nm at 2,500 rpm"],
      ["Gearbox", "7-speed dual-clutch automatic"], ["Drive", "Front-wheel drive"], ["Length", "4,395 mm"],
      ["Width", "1,818 mm"], ["Height", "1,640 mm"], ["Wheelbase", "2,636 mm"],
      ["Fuel tank", "60 litres"], ["Airbags", "2 (front)"], ["Brakes", "Disc brakes on all four wheels, ABS with EBD"],
      ["Stability control", "Electronic stability and traction control"]
    ],
    sources: [
      { name: "CarWale, Compass [2017-2021] Limited 1.4 Petrol AT [2017-2020] specifications (spec database; Jeep India's pages for this car are gone)", url: "https://www.carwale.com/jeep-cars/compass-2017-2021/limited-14-petrol-at-2017-2020/", as_of: "2026-10-15" },
      { name: "Autocar India, 2017 Jeep Compass launched (31 Jul 2017)", url: "https://www.autocarindia.com/car-news/2017-jeep-compass-launched-405565", as_of: "2026-10-15" },
      { name: "Autocar India, 2017 Jeep Compass variants explained (31 Jul 2017)", url: "https://www.autocarindia.com/car-news/jeep-compass-405138", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Kia", model: "Carens", variant_has: ["Prestige", "1.5 Petrol"], from: 2023, to: 2025, fuel: "Petrol",
    label: "Carens 1.5 petrol 6-speed manual (2023 to 2025, before the Carens Clavis)",
    rows: [
      ["Engine", "Smartstream G1.5 petrol, 1,497 cc"], ["Power", "115 PS at 6,300 rpm"], ["Torque", "144 Nm at 4,500 rpm"],
      ["Gearbox", "6-speed manual"], ["Drive", "Front-wheel drive"], ["Seats", "7 (this car)"],
      ["Length", "4,540 mm"], ["Width", "1,800 mm"], ["Height", "1,708 mm (with roof rails)"],
      ["Wheelbase", "2,780 mm"], ["Fuel tank", "45 litres"], ["Tyres", "195/65 R15 (1.5 petrol)"],
      ["Airbags", "6, on every version"], ["Brakes", "ABS, disc brakes on all four wheels"], ["Stability control", "ESC with hill-start assist, downhill brake control and Vehicle Stability Management"]
    ],
    sources: [
      { name: "Kia India, Carens brochure (2023)", url: "https://www.kia.com/content/dam/kia2/in/en/images/common/Kia-carens-mobile-brochure.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Kia", model: "Carens Clavis EV", variant_has: ["42"], from: 2025, to: 2026, fuel: "Electric",
    label: "Carens Clavis EV 42 kWh (standard range)",
    rows: [
      ["Battery", "42 kWh"], ["Claimed range", "404 km"], ["Drive", "Single front motor, front-wheel drive"],
      ["Seats", "7 (this car)"], ["Length", "4,550 mm"], ["Width", "1,800 mm"],
      ["Height", "1,730 mm (with roof rack)"], ["Wheelbase", "2,780 mm"], ["Front boot (frunk)", "25 litres"],
      ["Airbags", "6: front, front side and curtain"], ["Brakes", "ABS with brake assist, disc brakes on all four wheels"], ["Stability control", "ESC with Vehicle Stability Management, hill-start assist and downhill brake control"]
    ],
    sources: [
      { name: "Kia India, Carens Clavis EV specifications", url: "https://www.kia.com/in/our-vehicles/carens-clavis-ev/specs.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Kia", model: "Seltos", variant_has: ["GTX", "1.4", "DCT"], from: 2020, to: 2023, fuel: "Petrol",
    label: "Seltos 1.4 T-GDi turbo petrol 7DCT, GT Line (first generation, before the 2023 facelift)",
    rows: [
      ["Engine", "Smartstream G1.4 T-GDi turbo petrol, 1,353 cc"], ["Power", "140 PS at 6,000 rpm"], ["Torque", "242 Nm at 1,500 to 3,200 rpm"],
      ["Gearbox", "7-speed DCT automatic"], ["Drive", "Front-wheel drive"], ["Seats", "5"],
      ["Length", "4,315 mm"], ["Width", "1,800 mm"], ["Height", "1,645 mm (with 18-inch wheels and roof rails)"],
      ["Wheelbase", "2,610 mm"], ["Boot", "433 litres"], ["Fuel tank", "50 litres"],
      ["Airbags", "6 (GT Line)"], ["Brakes", "ABS with EBD, disc brakes on all four wheels"], ["Stability control", "ESC with hill-start assist and Vehicle Stability Management"]
    ],
    sources: [
      { name: "Kia India, Seltos brochure (2022 model year)", url: "https://www.kia.com/content/dam/kia2/in/en/images/our-vehicles/seltos/showroom/SELTOS-Brochure-16-Page.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Kia", model: "Seltos", variant_has: ["HTX", "Diesel", "AT"], from: 2022, to: 2023, fuel: "Diesel",
    label: "Seltos 1.5 CRDi diesel 6-speed automatic HTX (first generation, 2022 model year)",
    rows: [
      ["Engine", "1.5 CRDi VGT diesel, 1,493 cc"], ["Power", "115 PS at 4,000 rpm"], ["Torque", "250 Nm at 1,500 to 2,750 rpm"],
      ["Gearbox", "6-speed automatic (torque converter)"], ["Drive", "Front-wheel drive"], ["Seats", "5"],
      ["Length", "4,315 mm"], ["Width", "1,800 mm"], ["Wheelbase", "2,610 mm"],
      ["Boot", "433 litres"], ["Fuel tank", "50 litres"], ["Tyres", "215/60 R17"],
      ["Brakes", "ABS with EBD, disc brakes on all four wheels"], ["Stability control", "ESC with hill-start assist and Vehicle Stability Management"]
    ],
    sources: [
      { name: "Kia India, Seltos brochure (2022 model year)", url: "https://www.kia.com/content/dam/kia2/in/en/images/our-vehicles/seltos/showroom/SELTOS-Brochure-16-Page.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Kia", model: "Seltos", variant_has: ["1.5", "CVT"], from: 2023, to: 2025, fuel: "Petrol",
    label: "Seltos 1.5 petrol IVT (first generation after the July 2023 facelift)",
    rows: [
      ["Engine", "Smartstream G1.5 petrol, 1,497 cc"], ["Power", "115 PS at 6,300 rpm"], ["Torque", "144 Nm at 4,500 rpm"],
      ["Gearbox", "IVT automatic (CVT type)"], ["Drive", "Front-wheel drive"], ["Seats", "5"],
      ["Length", "4,365 mm"], ["Width", "1,800 mm"], ["Wheelbase", "2,610 mm"],
      ["Boot", "433 litres"], ["Fuel tank", "50 litres"], ["Airbags", "6, on every version"],
      ["Brakes", "ABS with brake assist, disc brakes on all four wheels"], ["Stability control", "ESC with hill-start assist and Vehicle Stability Management"]
    ],
    sources: [
      { name: "Kia India, new Seltos brochure (2023 facelift; copy hosted by CarWale)", url: "https://stc.aeplcdn.com/f/brochure/70/2141/fbmqvrh.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Kia", model: "Seltos", variant_has: ["Turbo", "DCT"], from: 2023, to: 2025, fuel: "Petrol",
    label: "Seltos 1.5 T-GDi turbo petrol 7DCT (first generation after the July 2023 facelift)",
    rows: [
      ["Engine", "Smartstream G1.5 T-GDi turbo petrol, 1,482 cc"], ["Power", "160 PS at 5,500 rpm"], ["Torque", "253 Nm at 1,500 to 3,500 rpm"],
      ["Gearbox", "7-speed DCT automatic"], ["Drive", "Front-wheel drive"], ["Seats", "5"],
      ["Length", "4,365 mm"], ["Width", "1,800 mm"], ["Height", "1,645 mm (with 18-inch wheels and roof rails)"],
      ["Wheelbase", "2,610 mm"], ["Boot", "433 litres"], ["Fuel tank", "50 litres"],
      ["Tyres", "215/55 R18 (GTX+ and X-Line)"], ["Airbags", "6, on every version"], ["Brakes", "ABS with brake assist, disc brakes on all four wheels"],
      ["Stability control", "ESC with hill-start assist and Vehicle Stability Management"]
    ],
    sources: [
      { name: "Kia India, new Seltos brochure (2023 facelift; copy hosted by CarWale)", url: "https://stc.aeplcdn.com/f/brochure/70/2141/fbmqvrh.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Land Rover", model: "Defender", variant_has: ["130", "Petrol"], from: 2023, to: 2024, fuel: "Petrol", maker: false,
    label: "Defender 130 HSE, 3.0 petrol mild hybrid (2023 launch version)",
    rows: [
      ["Engine", "3.0 litre six-cylinder turbo-petrol, mild hybrid"], ["Power", "400 hp"], ["Torque", "550 Nm"],
      ["Gearbox", "8-speed automatic"], ["Drive", "Four-wheel drive"], ["Seats", "Up to 8 (2-3-3)"],
      ["Length", "340 mm longer than the Defender 110, same wheelbase"], ["Loadspace", "2,516 litres with two rows folded"]
    ],
    sources: [
      { name: "Autocar India, Defender 130 launched, price (1 Mar 2023)", url: "https://www.autocarindia.com/stories/defender-130-launched-price-422", as_of: "2026-10-15" },
      { name: "CarTrade, Land Rover Defender 130 introduced in India at Rs 1.30 crore (28 Feb 2023)", url: "https://www.cartrade.com/news/land-rover-defender-130-introduced-in-india-at-rs-130-crore/", as_of: "2026-10-15" },
      { name: "Land Rover India, Defender 130 page", url: "https://www.landrover.in/defender/defender-130/index.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Land Rover", model: "Range Rover Evoque", variant_has: ["HSE"], from: 2017, to: 2019, fuel: "Diesel", maker: false,
    label: "Evoque 2.0 Ingenium diesel, HSE (first generation, December 2016 update)",
    rows: [
      ["Engine", "2.0 litre Ingenium four-cylinder turbo-diesel, 1,999 cc"], ["Power", "177 bhp at 4,000 rpm"], ["Torque", "430 Nm at 1,750 rpm"],
      ["Gearbox", "9-speed automatic"], ["Drive", "Four-wheel drive"]
    ],
    sources: [
      { name: "Autocar Professional, JLR India launches 2017 Range Rover Evoque at Rs 49.10 lakh (20 Dec 2016)", url: "https://autocarpro.in/news-national/jlr-india-launches-2017-range-rover-evoque-rs-4910-lakh-22995", as_of: "2026-10-15" },
      { name: "MotorBeam, 2017 Range Rover Evoque launched, priced from Rs 49.10 lakh (20 Dec 2016)", url: "https://www.motorbeam.com/?p=186914", as_of: "2026-10-15" },
      { name: "CarWale, Range Rover Evoque [2016-2020] HSE specifications (spec database)", url: "https://www.carwale.com/land-rover-cars/range-rover-evoque-2016-2020/hse/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Land Rover", model: "Range Rover Velar", variant_has: ["R-Dynamic", "Petrol"], from: 2021, to: 2023, fuel: "Petrol", maker: false,
    label: "Velar P250 R-Dynamic S (2021 update, before the 2023 facelift)",
    rows: [
      ["Engine", "2.0 litre Ingenium four-cylinder turbo-petrol, 1,997 cc"], ["Power", "184 kW (247 bhp)"], ["Torque", "365 Nm"],
      ["Gearbox", "8-speed automatic"], ["Drive", "All-wheel drive"], ["Suspension", "Electronic air suspension"],
      ["Length", "4,797 mm"], ["Wheelbase", "2,874 mm"], ["Boot", "673 litres"],
      ["Fuel tank", "82 litres"]
    ],
    sources: [
      { name: "Onmanorama, new Range Rover Velar launched in India at Rs 79.87 lakh, from JLR India's announcement (16 Jun 2021)", url: "https://www.onmanorama.com/news/business/2021/06/15/range-rover-velar-india-launch.html", as_of: "2026-10-15" },
      { name: "CarWale, Range Rover Velar [2017-2023] S R-Dynamic 2.0 Petrol specifications (spec database)", url: "https://www.carwale.com/land-rover-cars/range-rover-velar-2017-2023/s-r-dynamic-20-petrol/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Land Rover", model: "Range Rover Velar", variant_has: ["HSE", "Petrol"], from: 2024, to: 2026, fuel: "Petrol", maker: false,
    label: "Velar P250 Dynamic HSE (facelift, 2023 on)",
    rows: [
      ["Engine", "2.0 litre four-cylinder turbo-petrol (P250)"], ["Power", "184 kW (250 hp)"], ["Torque", "365 Nm"],
      ["Gearbox", "8-speed automatic"], ["Drive", "All-wheel drive"], ["0 to 100 km/h", "7.5 seconds"],
      ["Top speed", "217 km/h"], ["Suspension", "Air suspension, lowers 40 mm for getting in"], ["Wading depth", "580 mm"],
      ["Touchscreen", "11.4-inch curved glass, Pivi Pro"]
    ],
    sources: [
      { name: "Autocar Professional, Range Rover Velar facelift launched at Rs 93 lakh (24 Jul 2023)", url: "https://autocarpro.in/news/range-rover-velar-facelift-launched-at-rs-93-lakh-116021", as_of: "2026-10-15" },
      { name: "Range Rover India, Velar page ('Designed in the UK and built in India'; P250 184 kW)", url: "https://www.rangerover.com/en-in/range-rover-velar/index.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mahindra", model: "BE 6", variant_has: ["79"], from: 2025, to: 2026, fuel: "Electric",
    label: "BE 6 79 kWh (before the August 2026 Sporteq update)",
    rows: [
      ["Battery", "79 kWh"], ["Drive", "Rear-wheel drive, single motor"], ["Torque", "380 Nm"],
      ["Gearbox", "Single-speed automatic"], ["Range (MIDC P1 + P2)", "683 km with the 79 kWh battery"], ["Seats", "5"],
      ["Length", "4,371 mm"], ["Width", "1,907 mm"], ["Height", "1,627 mm"],
      ["Wheelbase", "2,775 mm"], ["Ground clearance", "207 mm (unladen)"], ["Boot", "455 litres, plus a 45-litre front box"],
      ["Turning circle", "10 m"]
    ],
    sources: [
      { name: "Mahindra, BE 6 brochure V29 (archived 12 May 2026)", url: "https://web.archive.org/web/20260512182430/https://www.mahindraelectricsuv.com/on/demandware.static/-/Library-Sites-eSUVSharedLibrary/default/dw2c5feb54/MBE6/BE-6-Brochure-V29.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mahindra", model: "XEV 9e", variant_has: ["Pack Three"], from: 2025, to: 2026, fuel: "Electric",
    label: "XEV 9e Pack Three (79 kWh)",
    rows: [
      ["Battery", "79 kWh"], ["Motor", "210 kW, rear-wheel drive"], ["Torque", "380 Nm"],
      ["0 to 100 km/h", "6.8 seconds"], ["Gearbox", "Single-speed automatic"], ["Range (MIDC P1 + P2)", "656 km"],
      ["Seats", "5"], ["Length", "4,789 mm"], ["Width", "1,907 mm"],
      ["Height", "1,694 mm"], ["Wheelbase", "2,775 mm"], ["Ground clearance", "207 mm (unladen)"],
      ["Boot", "663 litres, plus a 150-litre front box"], ["Airbags", "7"]
    ],
    sources: [
      { name: "Mahindra, XEV 9e brochure (28 Apr 2026)", url: "https://www.mahindraelectricsuv.com/on/demandware.static/-/Library-Sites-eSUVSharedLibrary/default/dweb0d1969/MXV9/XEV9e_BROCHURE_R1_20260428.pdf", as_of: "2026-10-15" },
      { name: "Mahindra, XEV 9e page", url: "https://www.mahindraelectricsuv.com/esuv/xev-9e/MXV9.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mahindra", model: "XUV500", variant_has: ["W8"], from: 2011, to: 2015, fuel: "Diesel", maker: false,
    label: "XUV500 2.2 mHawk diesel, first version (2011 to 2015)",
    rows: [
      ["Engine", "2.2 litre mHawk turbo-diesel, 2,179 cc"], ["Power", "140 bhp at 3,750 rpm"], ["Torque", "330 Nm at 2,800 rpm"],
      ["Gearbox", "6-speed manual"], ["Drive", "Front-wheel drive (this car)"], ["Seats", "7, in three rows"],
      ["Length", "4,585 mm"], ["Width", "1,890 mm"], ["Height", "1,785 mm"],
      ["Wheelbase", "2,700 mm"], ["Fuel tank", "70 litres"], ["Brakes", "Discs on all four wheels"],
      ["Tyres", "235/65 R17 on alloy wheels"]
    ],
    sources: [
      { name: "CarWale, XUV500 [2011-2015] W8 specifications", url: "https://www.carwale.com/mahindra-cars/xuv500-2011-2015/w8/", as_of: "2026-10-15" },
      { name: "CarTrade, XUV500 2011 W8 specifications", url: "https://www.cartrade.com/mahindra-cars/xuv500-2011-2015/w8-2013/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mahindra", model: "XUV700", variant_has: ["Petrol AT"], from: 2021, to: 2025, fuel: "Petrol",
    label: "XUV700 2.0 turbo-petrol automatic",
    rows: [
      ["Engine", "2.0 litre mStallion turbo-petrol with direct injection"], ["Power", "147 kW (200 PS) at 5,000 rpm"], ["Torque", "380 Nm at 1,750 to 3,000 rpm"],
      ["Gearbox", "6-speed automatic"], ["Seats", "7 (this car)"], ["Length", "4,695 mm (with roof rails)"],
      ["Width", "1,890 mm"], ["Height", "1,755 mm"], ["Wheelbase", "2,750 mm"],
      ["Fuel tank", "60 litres"], ["Brakes", "Ventilated discs at the front, discs at the rear"], ["Tyres", "235/60 R18 diamond-cut alloys (AX7)"]
    ],
    sources: [
      { name: "Mahindra, XUV700 brochure (27 Jun 2024; archived copy)", url: "https://web.archive.org/web/20250813120742/https://auto.mahindra.com/on/demandware.static/-/Sites-amc-Library/default/dw92486f5b/X700/brochure/XUV700_BROCHURE_27_06_2024.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Maruti Suzuki", model: "Grand Vitara", variant_has: ["Intelligent Hybrid"], from: 2022, to: 2026, fuel: "Hybrid",
    label: "Grand Vitara 1.5 strong hybrid e-CVT (Maruti's current figures)",
    rows: [
      ["Engine", "1.5 petrol, 1,490 cc"], ["Engine power", "92.45 PS at 5,500 rpm"], ["Engine torque", "122 Nm at 3,800 to 4,800 rpm"],
      ["Gearbox", "e-CVT automatic"], ["Drive", "Front-wheel drive"], ["Seats", "5"],
      ["Claimed mileage", "27.97 km/l"], ["Length", "4,345 mm"], ["Width", "1,795 mm"],
      ["Height", "1,645 mm"], ["Wheelbase", "2,600 mm"], ["Fuel tank", "45 litres"],
      ["Tyres", "215/60 R17 alloys"], ["Brakes", "Discs front and rear"]
    ],
    sources: [
      { name: "Maruti Suzuki Nexa, Grand Vitara variant specifications", url: "https://www.nexaexperience.com/grand-vitara/price", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Maserati", model: "Ghibli", variant_has: ["Diesel"], from: 2015, to: 2017, fuel: "Diesel", maker: false,
    label: "Ghibli Diesel, 3.0 V6 (before the 2018 update)",
    rows: [
      ["Engine", "3.0 litre V6 twin-turbo diesel, 2,987 cc"], ["Power", "275 PS at 4,000 rpm"], ["Torque", "600 Nm at 2,000 to 2,600 rpm"],
      ["Gearbox", "8-speed automatic"], ["Drive", "Rear-wheel drive"], ["Kerb weight", "1,835 kg"]
    ],
    sources: [
      { name: "Car India, Maserati Ghibli Diesel first drive review: specifications and India price (4 Aug 2015)", url: "https://carindia.in/poseidons-oil-burner-maserati-ghibli-diesel-first-drive-review/3/", as_of: "2026-10-15" },
      { name: "CarTrade, Maserati launches 2018 Ghibli in India at Rs 1.33 crore (15 Mar 2018)", url: "https://www.cartrade.com/news/maserati-launches-2018-ghibli-in-india-at-rs-1-33-crores-135959.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "A-Class Limousine", variant_has: ["200d"], from: 2021, to: 2023, fuel: "Diesel", maker: false,
    label: "A-Class Limousine A 200d (2021 launch version, before the facelift)",
    rows: [
      ["Engine", "2.0 litre four-cylinder turbo diesel"], ["Power", "150 hp"], ["Torque", "320 Nm"],
      ["Gearbox", "8G-DCT eight-speed dual-clutch automatic"], ["Drive", "Front-wheel drive"], ["Built at", "Chakan, near Pune"]
    ],
    sources: [
      { name: "Car India, Mercedes A-Class Limousine launched in India (Mar 2021)", url: "https://carindia.in/new-star-mercedes-a-class-limousine-now-in-india/", as_of: "2026-10-15" },
      { name: "MotorBeam, 2021 Mercedes A-Class Limousine launched from Rs 39.90 lakh (Mar 2021)", url: "https://www.motorbeam.com/?p=276204", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "C-Class", variant_has: ["220"], from: 2015, to: 2016, fuel: "Diesel", maker: false,
    label: "C-Class C 220 CDI (fourth generation, W205, before the 2018 facelift)",
    rows: [
      ["Engine", "2.1 litre four-cylinder turbo diesel"], ["Power", "168 bhp"], ["Origin", "Imported at the February 2015 launch; local assembly followed later that year"]
    ],
    sources: [
      { name: "Autocar India, C-class C 220 CDI diesel launched at Rs 39.9 lakh (11 Feb 2015)", url: "https://www.autocarindia.com/car-news/c-220-cdi-launched-393277", as_of: "2026-10-15" },
      { name: "Autocar Professional, Mercedes-Benz India launches C220 CDI (11 Feb 2015)", url: "https://autocarpro.in/news-national/mercedes-benz-india-launches-c220-cdi-rs-399-lakh-7657", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "C-Class", variant_has: ["C 200"], from: 2019, to: 2019, fuel: "Petrol", maker: false,
    label: "C-Class C 200 Progressive (W205 facelift, 1.5 turbo petrol with EQ Boost)",
    rows: [
      ["Engine", "1.5 litre turbo petrol with a 48V starter-generator (EQ Boost)"], ["Power", "184 PS"], ["Airbags", "7"],
      ["Boot", "480 litres"]
    ],
    sources: [
      { name: "Outlook India, Mercedes-Benz C-Class petrol goes on sale at Rs 43.46 lakh (31 Dec 2018)", url: "https://www.outlookindia.com/automobiles/automobiles-mercedes-benz-c-class-petrol-goes-on-sale-priced-at-rs-4346-lakh-news-322677", as_of: "2026-10-15" },
      { name: "Rushlane, 2018 Mercedes C-Class facelift launched in India (20 Sep 2018)", url: "https://www.rushlane.com/2018-mercedes-c-class-launched-in-india-12279780.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "CLA", variant_has: ["200 Sport"], from: 2017, to: 2019, fuel: "Petrol", maker: false,
    label: "CLA 200 Sport petrol (first generation, C117, 2016 facelift)",
    rows: [
      ["Engine", "2.0 litre four-cylinder turbo petrol"], ["Power", "184 hp"], ["Gearbox", "7-speed dual-clutch automatic"],
      ["Drive modes", "Dynamic Select"]
    ],
    sources: [
      { name: "Autocar India, 2017 Mercedes CLA launched at Rs 31.40 lakh (30 Nov 2016)", url: "https://www.autocarindia.com/car-news/mercedes-cla-403638", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "CLA", variant_has: ["CDI"], from: 2017, to: 2019, fuel: "Diesel", maker: false,
    label: "CLA 200 d Sport diesel (first generation, C117, 2016 facelift)",
    rows: [
      ["Engine", "2.1 litre four-cylinder turbo diesel"], ["Power", "136 hp"], ["Gearbox", "7-speed dual-clutch automatic"],
      ["Drive modes", "Dynamic Select"]
    ],
    sources: [
      { name: "Autocar India, 2017 Mercedes CLA launched at Rs 31.40 lakh (30 Nov 2016)", url: "https://www.autocarindia.com/car-news/mercedes-cla-403638", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "E-Class", variant_has: ["220 CDI"], from: 2011, to: 2013, fuel: "Diesel", maker: false,
    label: "E-Class E 220 CDI BlueEfficiency (W212, before the 2013 facelift)",
    rows: [
      ["Engine", "2,143 cc four-cylinder turbo diesel"], ["Power", "170 hp at 3,000 rpm"], ["Torque", "400 Nm at 1,400 to 2,800 rpm"],
      ["Gearbox", "5-speed automatic on the Elegance; 7-speed on the Avantgarde and AMG Sport (from November 2012)"]
    ],
    sources: [
      { name: "MotorBeam, Mercedes-Benz launches E220 CDI (17 Nov 2011)", url: "https://www.motorbeam.com/?p=38033", as_of: "2026-10-15" },
      { name: "Autocar India, E 220 CDI gets new Avantgarde trim (22 Nov 2012)", url: "https://www.autocarindia.com/car-news/e-220-cdi-avantgarde-323886", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "E-Class", variant_has: ["220d", "Exclusive"], from: 2021, to: 2023, fuel: "Diesel", maker: false,
    label: "E-Class E 220d Exclusive (long wheelbase, W213 facelift)",
    rows: [
      ["Engine", "2.0 litre four-cylinder diesel"], ["Power", "194 hp"], ["Gearbox", "9-speed automatic"],
      ["Body", "Long wheelbase"]
    ],
    sources: [
      { name: "Autocar India, Mercedes-Benz E-Class facelift launched from Rs 63.6 lakh (Mar 2021)", url: "https://www.autocarindia.com/car-news/mercedes-benz-e-class-facelift-launched-from-rs-636-lakh-420229", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "GLA", variant_has: ["200 Sport"], from: 2014, to: 2016, fuel: "Petrol", maker: false,
    label: "GLA 200 Sport petrol (first generation, X156, before the 2017 facelift)",
    rows: [
      ["Engine", "2.0 litre four-cylinder turbo petrol"], ["Power", "181 bhp"], ["Torque", "300 Nm (30.59 kgm)"],
      ["Gearbox", "7-speed dual-clutch automatic"], ["Airbags", "7"], ["Wheels", "18-inch"]
    ],
    sources: [
      { name: "Autocar India, Mercedes GLA launched at Rs 32.75 lakh (30 Sep 2014)", url: "https://www.autocarindia.com/car-news/gla-launched-390773", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "GLA", variant_has: ["220d", "4MATIC"], from: 2024, to: 2026, fuel: "Diesel", maker: false,
    label: "GLA 220d 4MATIC (second generation, 2024 facelift)",
    rows: [
      ["Engine", "2.0 litre four-cylinder turbo diesel"], ["Power", "188 bhp"], ["Torque", "400 Nm"],
      ["Gearbox", "8-speed dual-clutch automatic"], ["Drive", "4MATIC all-wheel drive"]
    ],
    sources: [
      { name: "evo India, 2024 Mercedes-Benz GLA launched at Rs 50.50 lakh (31 Jan 2024)", url: "https://evoindia.com/news/2024-mercedes-benz-gla-launched", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "GLC", variant_has: ["300"], from: 2016, to: 2018, fuel: "Petrol", maker: false,
    label: "GLC 300 4MATIC (first generation, X253, before the 2019 facelift)",
    rows: [
      ["Engine", "2.0 litre four-cylinder turbo petrol"], ["Power", "245 hp"], ["Torque", "370 Nm"],
      ["Gearbox", "9-speed automatic"], ["Drive", "4MATIC all-wheel drive"]
    ],
    sources: [
      { name: "Autocar Professional, Mercedes-Benz India launches GLC at Rs 50.70 lakh (2 Jun 2016)", url: "https://autocarpro.in/news-national/mercedes-benz-india-launches-glc-rs-5070-lakh-20176", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "GLC", variant_has: ["220"], from: 2016, to: 2019, fuel: "Diesel", maker: false,
    label: "GLC 220d 4MATIC (first generation, X253, before the 2019 facelift)",
    rows: [
      ["Engine", "2.1 litre four-cylinder turbo diesel"], ["Power", "170 hp"], ["Torque", "400 Nm"],
      ["Gearbox", "9-speed automatic"], ["Drive", "4MATIC all-wheel drive"]
    ],
    sources: [
      { name: "Autocar Professional, Mercedes-Benz India launches GLC at Rs 50.70 lakh (2 Jun 2016)", url: "https://autocarpro.in/news-national/mercedes-benz-india-launches-glc-rs-5070-lakh-20176", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "GLC", variant_has: ["200"], from: 2020, to: 2022, fuel: "Petrol", maker: false,
    label: "GLC 200 (first generation, X253, after the 2019 facelift)",
    rows: [
      ["Engine", "1,991 cc four-cylinder turbo petrol"], ["Power", "197 hp"], ["Torque", "320 Nm"],
      ["0 to 100 km/h", "7.8 seconds"], ["Gearbox", "9G-Tronic 9-speed automatic"]
    ],
    sources: [
      { name: "Rushlane, Mercedes GLC facelift launched at Rs 52.75 lakh (3 Dec 2019)", url: "https://www.rushlane.com/mercedes-glc-facelift-launch-price-12344745.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "GLE", variant_has: ["350"], from: 2016, to: 2019, fuel: "Diesel", maker: false,
    label: "GLE 350 d 4MATIC (W166, the 2015 update of the M-Class)",
    rows: [
      ["Engine", "3.0 litre V6 turbo diesel"], ["Power", "258 bhp"], ["Torque", "620 Nm (63.2 kgm)"],
      ["Gearbox", "9-speed automatic with paddle shifters"], ["Drive", "4MATIC all-wheel drive"], ["Suspension", "Airmatic air suspension"],
      ["Airbags", "6"], ["Built at", "Pune (locally assembled)"]
    ],
    sources: [
      { name: "Autocar India, Mercedes-Benz GLE launched at Rs 58.9 lakh (14 Oct 2015)", url: "https://www.autocarindia.com/car-news/mercedes-benz-gle-398094", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "GLE", variant_has: ["300d"], from: 2020, to: 2022, fuel: "Diesel", maker: false,
    label: "GLE 300d 4MATIC LWB (fourth generation, V167, before the 2023 facelift)",
    rows: [
      ["Engine", "OM654 2.0 litre four-cylinder diesel"], ["Power", "245 hp"], ["Torque", "500 Nm"],
      ["0 to 100 km/h", "7.2 seconds"], ["Gearbox", "9G-Tronic 9-speed automatic"], ["Drive", "4MATIC permanent all-wheel drive"],
      ["Wheelbase", "2,995 mm (long wheelbase)"], ["Wheels", "19-inch"]
    ],
    sources: [
      { name: "Car India, all-new Mercedes GLE LWB launched in India (Jan 2020)", url: "https://carindia.in/all-new-mercedes-gle-lwb-launched-in-india/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "GLE", variant_has: ["300d"], from: 2024, to: 2026, fuel: "Diesel", maker: false,
    label: "GLE 300d 4MATIC LWB (V167 facelift, mild hybrid)",
    rows: [
      ["Engine", "2.0 litre four-cylinder diesel with a 48V mild-hybrid starter-generator"], ["Power", "269 hp"], ["Torque", "550 Nm"],
      ["Mild-hybrid boost", "20 hp and 200 Nm"], ["0 to 100 km/h", "6.9 seconds"], ["Gearbox", "9-speed automatic"],
      ["Drive", "4MATIC all-wheel drive"]
    ],
    sources: [
      { name: "Autocar India, Mercedes-Benz GLE facelift launched at Rs 96.4 lakh (2 Nov 2023)", url: "https://www.autocarindia.com/car-news/mercedes-benz-gle-facelift-launched-at-rs-964-lakh-429735", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "GLE Coupe", variant_has: ["43"], from: 2016, to: 2019, fuel: "Petrol", maker: false,
    label: "Mercedes-AMG GLE 43 4MATIC Coupe (first generation, C292)",
    rows: [
      ["Engine", "3.0 litre V6 biturbo petrol"], ["Power", "362 PS (2016 launch figure)"], ["Torque", "520 Nm"],
      ["Gearbox", "9G-Tronic 9-speed automatic"], ["Drive", "4MATIC all-wheel drive"], ["0 to 100 km/h", "5.7 seconds"],
      ["Origin", "Imported fully built from the USA"]
    ],
    sources: [
      { name: "Rushlane, Mercedes GLE Coupe (GLE 450 AMG Coupe) launched at Rs 86.40 lakh (12 Jan 2016)", url: "https://www.rushlane.com/mercedes-gle-coupe-450-amg-launch-price-specs-features-12179498.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "GLS", variant_has: ["400d"], from: 2020, to: 2023, fuel: "Diesel", maker: false,
    label: "GLS 400 d 4MATIC (third generation, X167, before the 2024 facelift)",
    rows: [
      ["Engine", "2,925 cc six-cylinder diesel"], ["Power", "330 hp"], ["Torque", "700 Nm"],
      ["0 to 100 km/h", "6.3 seconds"], ["Wheelbase", "3,135 mm"], ["Airbags", "9"]
    ],
    sources: [
      { name: "Car India, Mercedes-Benz GLS launched in India (18 Jun 2020)", url: "https://carindia.in/mercedes-benz-gls-launched-in-india/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "Maybach GLS", variant_has: ["600"], from: 2021, to: 2023, fuel: "Petrol", maker: false,
    label: "Mercedes-Maybach GLS 600 4MATIC (before the 2024 facelift)",
    rows: [
      ["Engine", "4.0 litre V8 petrol with a 48V starter-generator"], ["Power", "557 hp, plus 22 hp from the electric boost"], ["Torque", "730 Nm, plus 250 Nm from the electric boost"],
      ["0 to 100 km/h", "Under 5 seconds"], ["Top speed", "250 km/h"], ["Airbags", "8"],
      ["Wheels", "22-inch"]
    ],
    sources: [
      { name: "Autocar Professional, Mercedes-Maybach GLS introduced at Rs 2.43 crore (8 Jun 2021)", url: "https://autocarpro.in/news-national/mercedesmaybach-gls-suv-introduced-at-rs-243-crore-79347", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "Maybach GLS", variant_has: ["600"], from: 2024, to: 2026, fuel: "Petrol", maker: false,
    label: "Mercedes-Maybach GLS 600 4MATIC (2024 facelift)",
    rows: [
      ["Engine", "4.0 litre twin-turbo V8 petrol with a 48V starter-generator"], ["Power", "557 hp, plus 22 hp from the electric boost"], ["Torque", "770 Nm, plus 250 Nm from the electric boost"],
      ["0 to 100 km/h", "4.9 seconds"], ["Top speed", "250 km/h"], ["Gearbox", "9-speed automatic"],
      ["Drive", "4MATIC all-wheel drive"], ["Wheels", "22-inch as standard"]
    ],
    sources: [
      { name: "Autocar Professional, Mercedes launches Maybach GLS 600 facelift at Rs 3.35 crore (22 May 2024)", url: "https://autocarpro.in/news/mercedes-launches-maybach-gls-600-facelift-at-rs-335-crore-120631", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "S-Class", variant_has: ["Maybach", "560"], from: 2018, to: 2020, fuel: "Petrol", maker: false,
    label: "Mercedes-Maybach S 560 4MATIC (X222 facelift)",
    rows: [
      ["Engine", "4.0 litre twin-turbo V8 petrol"], ["Power", "469 PS"], ["Torque", "700 Nm"],
      ["Body", "Long wheelbase Maybach limousine"]
    ],
    sources: [
      { name: "MotorBeam, Mercedes-Maybach S560 and S650 launched from Rs 1.94 crore (8 Feb 2018)", url: "https://www.motorbeam.com/?p=207447", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mercedes-Benz", model: "S-Class", variant_has: ["350"], from: 2021, to: 2025, fuel: "Diesel", maker: false,
    label: "S-Class S 350d (seventh generation, W223, locally assembled)",
    rows: [
      ["Engine", "OM656 3.0 litre six-cylinder turbo diesel"], ["Power", "286 hp"], ["Torque", "600 Nm"],
      ["Drive", "Rear-wheel drive"], ["Suspension", "Adaptive air suspension"], ["Built at", "Locally assembled (from October 2021)"]
    ],
    sources: [
      { name: "Autocar India, 2021 Mercedes-Benz S 350d review", url: "https://www.autocarindia.com/car-reviews/2021-mercedes-benz-s-350d-review-still-the-best-in-business-422918", as_of: "2026-10-15" },
      { name: "Autocar India, locally assembled Mercedes-Benz S-Class launched at Rs 1.57 crore (7 Oct 2021)", url: "https://www.autocarindia.com/car-news/locally-assembled-mercedes-benz-s-class-launched-at-rs-157-crore-422274", as_of: "2026-10-15" }
    ]
  },
  {
    make: "MG", model: "Gloster", variant_has: ["2WD"], from: 2022, to: 2025, fuel: "Diesel",
    label: "Advanced Gloster 2.0 turbo-diesel 2WD (2022 facelift)",
    rows: [
      ["Engine", "2.0 litre turbo-diesel, 1,996 cc"], ["Power", "161 PS at 4,000 rpm"], ["Torque", "373.5 Nm at 1,500 to 2,400 rpm"],
      ["Gearbox", "8-speed automatic"], ["Drive", "Rear-wheel drive (2WD)"], ["Seats", "7 (2+3+2, this car)"],
      ["Length", "4,985 mm"], ["Width", "1,926 mm"], ["Height", "1,867 mm"],
      ["Wheelbase", "2,950 mm"], ["Fuel tank", "75 litres"], ["Brakes", "Discs on all four wheels"],
      ["Tyres", "255/55 R19 alloys"], ["Airbags", "6"]
    ],
    sources: [
      { name: "MG Motor India, The Advanced Gloster brochure", url: "https://s7ap1.scene7.com/is/content/mgmotor/mgmotor/documents/MG%20Gloster%20-%20Brochure.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "MG", model: "Hector Plus", variant_has: ["Sharp", "DCT"], from: 2020, to: 2022, fuel: "Petrol", maker: false,
    label: "Hector Plus 1.5 turbo-petrol DCT (2020 to 2022)",
    rows: [
      ["Engine", "1.5 litre turbo-petrol, 1,451 cc"], ["Power", "143 PS at 5,200 rpm"], ["Torque", "250 Nm at 1,600 to 3,600 rpm"],
      ["Gearbox", "6-speed dual-clutch automatic (DCT)"], ["Seats", "6, with second-row captain seats (Sharp)"]
    ],
    sources: [
      { name: "Wikipedia, MG Hector (Hector Plus dates and engine)", url: "https://en.wikipedia.org/wiki/MG_Hector", as_of: "2026-10-15" },
      { name: "CarDekho, Hector Plus 2020-2023 Sharp DCT", url: "https://www.cardekho.com/overview/MG_Hector_Plus_2020-2023/MG_Hector_Plus_2020-2023_Sharp_DCT.htm", as_of: "2026-10-15" }
    ]
  },
  {
    make: "MG", model: "Windsor EV", variant_has: ["Essence"], from: 2024, to: 2026, fuel: "Electric",
    label: "Windsor EV 38 kWh",
    rows: [
      ["Battery", "38 kWh"], ["Motor", "Permanent magnet synchronous, 136 PS (100 kW)"], ["Torque", "200 Nm"],
      ["Gearbox", "Single-speed automatic"], ["Range (MIDC P1 + P2)", "332 km"], ["Fast charging", "Up to 45 kW DC"],
      ["Seats", "5"], ["Length", "4,295 mm"], ["Width", "1,850 mm (without mirrors)"],
      ["Height", "1,677 mm"], ["Wheelbase", "2,700 mm"], ["Ground clearance", "186 mm (unladen)"],
      ["Boot", "579 litres (Essence)"], ["Brakes", "Discs on all four wheels"], ["Airbags", "6"]
    ],
    sources: [
      { name: "MG Motor India, Windsor EV brochure", url: "https://s7ap1.scene7.com/is/content/mgmotor/mgmotor/documents/MG%20Windsor%20EV%20-%20Brochure.pdf", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mini", model: "Convertible", variant_has: [], from: 2016, to: 2018, fuel: "Petrol",
    label: "MINI Cooper S Convertible (third generation, F57)",
    rows: [
      ["Engine", "2.0 litre four-cylinder TwinPower Turbo petrol"], ["Power", "192 hp (141 kW)"], ["Torque", "280 Nm"],
      ["0 to 100 km/h", "7.1 seconds"], ["Top speed", "233 km/h"], ["Gearbox", "6-speed automatic, with paddles"],
      ["Roof", "Fully automatic soft top, opens or closes in 18 seconds"], ["Boot", "Up to 215 litres"], ["Origin", "Imported fully built (CBU)"]
    ],
    sources: [
      { name: "BMW Group India media information, the all-new MINI Convertible launched (16 Mar 2016)", url: "https://www.press.bmwgroup.com/india/article/attachment/T0368228EN/522035", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Mini", model: "Countryman", variant_has: ["JCW Inspired"], from: 2021, to: 2024, fuel: "Petrol",
    label: "Countryman Cooper S JCW Inspired (second generation, F60, 2021 facelift)",
    rows: [
      ["Engine", "2.0 litre four-cylinder TwinPower Turbo petrol"], ["Power", "192 hp (141 kW) at 5,000 to 6,000 rpm"], ["Torque", "280 Nm at 1,350 to 4,600 rpm"],
      ["0 to 100 km/h", "7.5 seconds"], ["Top speed", "225 km/h"], ["Gearbox", "7-speed dual-clutch Steptronic Sport, with paddles"],
      ["Boot", "450 litres, up to 1,390 with the rear seats folded"], ["Wheels", "18-inch John Cooper Works wheels with run-flat tyres"], ["Built at", "BMW Group Plant Chennai"]
    ],
    sources: [
      { name: "BMW Group India press release, the new MINI Countryman launched (4 Mar 2021)", url: "https://www.press.bmwgroup.com/india/article/detail/T0327070EN", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Skoda", model: "Kodiaq", variant_has: ["Style", "TDI"], from: 2017, to: 2020, fuel: "Diesel", maker: false,
    label: "Kodiaq Style 2.0 TDI 4x4 DSG (first generation, 2017 to 2020)",
    rows: [
      ["Engine", "2.0 TDI diesel, 1,968 cc"], ["Power", "150 PS (110 kW)"], ["Torque", "340 Nm"],
      ["Gearbox", "7-speed DSG dual-clutch automatic"], ["Drive", "Electronically controlled all-wheel drive"], ["0 to 100 km/h", "10.1 seconds"],
      ["Top speed", "192 km/h"], ["Seats", "7"], ["Length", "4,697 mm"],
      ["Width", "1,882 mm"], ["Height", "1,676 mm (with roof rails)"], ["Wheelbase", "2,791 mm"],
      ["Boot", "270 litres with all seats up, 2,005 with the rear rows folded"], ["Fuel tank", "63 litres"], ["Airbags", "9"]
    ],
    sources: [
      { name: "MediaInfoline, Skoda Auto India launches new Kodiaq: Skoda's launch text (4 Oct 2017)", url: "https://www.mediainfoline.com/automobiles/skoda-auto-india-launches-new-kodiaq", as_of: "2026-10-15" },
      { name: "CarWale, Kodiaq [2017-2020] Style 2.0 TDI 4x4 AT specifications (spec database)", url: "https://www.carwale.com/skoda-cars/kodiaq-2017-2020/style-20-tdi-4x4-at/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Tata", model: "Altroz", variant_has: ["iCNG"], from: 2023, to: 2025, fuel: "CNG",
    label: "Altroz 1.2 iCNG (twin-cylinder CNG, before the 2025 facelift)",
    rows: [
      ["Engine", "1.2 litre petrol with factory CNG, 1,198 cc"], ["Power on CNG", "73.5 PS at 6,000 rpm"], ["Torque on CNG", "103 Nm at 3,500 rpm"],
      ["Gearbox", "5-speed manual"], ["Seats", "5"], ["Length", "3,990 mm"],
      ["Width", "1,755 mm"], ["Height", "1,523 mm"], ["Wheelbase", "2,501 mm"],
      ["Ground clearance", "165 mm (unladen)"], ["Tanks", "Petrol 37 litres; CNG 60 litres in two cylinders under the boot floor"], ["Airbags", "2 (driver and co-driver)"],
      ["Crash test", "Global NCAP 5 stars for adults (2020, Altroz)"]
    ],
    sources: [
      { name: "Tata Motors, Altroz specifications (archived 4 Oct 2024)", url: "https://web.archive.org/web/20241004232242/https://cars.tatamotors.com/altroz/ice/specifications.html", as_of: "2026-10-15" },
      { name: "Tata Motors press release, Altroz iCNG launch (22 May 2023)", url: "https://www.tatamotors.com/press/tata-motors-disrupts-the-cng-market-with-the-launch-of-altroz-icng/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Tata", model: "Curvv EV", variant_has: ["55"], from: 2024, to: 2026, fuel: "Electric",
    label: "Curvv.ev 55 kWh",
    rows: [
      ["Battery", "55 kWh, liquid cooled, IP67"], ["Power", "167 PS (123 kW)"], ["Torque", "215 Nm"],
      ["0 to 100 km/h", "8.6 seconds"], ["Gearbox", "Single-speed automatic"], ["Seats", "5"],
      ["Length", "4,310 mm"], ["Width", "1,810 mm"], ["Height", "1,637 mm"],
      ["Wheelbase", "2,560 mm"], ["Ground clearance", "186 mm (unladen)"], ["Boot", "500 litres, plus an 11.6-litre front box"],
      ["Brakes", "Discs on all four wheels"], ["Tyres", "215/55 R18 on alloy wheels"], ["Airbags", "6"]
    ],
    sources: [
      { name: "Tata Motors press release, Curvv.ev launch (7 Aug 2024)", url: "https://www.tatamotors.com/press-releases/shapedforyou-tata-motors-disrupts-the-mid-suv-segment-with-indias-first-suv-coupe/", as_of: "2026-10-15" },
      { name: "Tata Motors, Curvv.ev specifications and prices (Mumbai)", url: "https://ev.tata.cars/curvv/ev/specifications.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Tata", model: "Harrier", variant_has: ["XZA"], from: 2020, to: 2023, fuel: "Diesel",
    label: "Harrier 2.0 diesel automatic (BS6, 2020 to 2023, before the facelift)",
    rows: [
      ["Platform", "OMEGARC, derived from Land Rover's D8"], ["Engine", "Kryotec 2.0 litre turbo diesel, 1,956 cc, BS6"], ["Power", "170 PS (125 kW) at 3,750 rpm"],
      ["Torque", "350 Nm at 1,750 to 2,500 rpm"], ["Gearbox", "6-speed automatic"], ["Seats", "5"],
      ["Length", "4,598 mm"], ["Width", "1,894 mm (without mirrors)"], ["Height", "1,706 mm"],
      ["Wheelbase", "2,741 mm"], ["Boot", "425 litres, 810 with the rear seats folded"], ["Fuel tank", "50 litres"],
      ["Brakes", "Discs at the front, drums at the rear"], ["Tyres", "235/65 R17 on alloy wheels (XZ+ and XZA+)"]
    ],
    sources: [
      { name: "Tata Motors, Harrier specifications (archived 26 Feb 2021)", url: "https://web.archive.org/web/20210226125547/https://cars.tatamotors.com/suv/harrier/specifications", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Tata", model: "Punch EV", variant_has: ["Long Range"], from: 2024, to: 2025, fuel: "Electric",
    label: "Punch.ev Long Range (35 kWh, before the 2026 facelift)",
    rows: [
      ["Battery", "35 kWh, liquid cooled, IP67"], ["Motor", "Permanent magnet synchronous, 90 kW"], ["Torque", "190 Nm"],
      ["0 to 100 km/h", "9.5 seconds"], ["Home charger", "3.3 kW AC (this version)"], ["Gearbox", "Single-speed automatic"],
      ["Seats", "5"], ["Length", "3,857 mm"], ["Width", "1,742 mm"],
      ["Height", "1,633 mm"], ["Wheelbase", "2,445 mm"], ["Ground clearance", "190 mm (unladen)"],
      ["Boot", "366 litres"], ["Brakes", "Discs on all four wheels"], ["Tyres", "195/60 R16 on alloy wheels"],
      ["Airbags", "6"]
    ],
    sources: [
      { name: "Tata Motors, Punch.ev specifications (archived 19 Feb 2025)", url: "https://web.archive.org/web/20250219124323/https://ev.tatamotors.com/punch/ev/specifications.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Tata", model: "Sierra", variant_has: ["Turbo", "Automatic"], from: 2025, to: 2026, fuel: "Petrol",
    label: "Sierra 1.5 Hyperion turbo-petrol automatic (2025 on)",
    rows: [
      ["Engine", "1.5 litre Hyperion turbo-petrol, 1,498 cc"], ["Power", "160 PS at 5,000 rpm"], ["Torque", "255 Nm at 1,750 to 4,000 rpm"],
      ["Gearbox", "6-speed automatic"], ["Seats", "5"], ["Length", "4,340 mm"],
      ["Width", "1,841 mm"], ["Height", "1,715 mm"], ["Wheelbase", "2,730 mm"],
      ["Ground clearance", "205 mm (unladen)"], ["Boot", "622 litres"], ["Fuel tank", "50 litres"],
      ["Turning radius", "5.3 m"], ["Brakes", "Discs on all four wheels"], ["Tyres", "225/55 R19 on alloy wheels"],
      ["Airbags", "6"]
    ],
    sources: [
      { name: "Tata Motors, Sierra specifications (Accomplished+ AT GDI)", url: "https://tata.cars/sierra/ice/specifications.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Tata", model: "Tiago", variant_has: ["XZA"], from: 2020, to: 2024, fuel: "Petrol",
    label: "Tiago 1.2 petrol AMT (2020 facelift, before the 2025 update)",
    rows: [
      ["Engine", "1.2 litre Revotron three-cylinder petrol, 1,199 cc"], ["Power", "86 PS at 6,000 rpm"], ["Torque", "113 Nm at 3,300 rpm"],
      ["Gearbox", "5-speed AMT"], ["Seats", "5"], ["Length", "3,765 mm"],
      ["Width", "1,677 mm"], ["Height", "1,535 mm"], ["Wheelbase", "2,400 mm"],
      ["Ground clearance", "170 mm (unladen)"], ["Boot", "242 litres"], ["Fuel tank", "35 litres"],
      ["Turning radius", "4.9 m"], ["Brakes", "Discs at the front, drums at the rear"], ["Tyres", "175/60 R15 on alloy wheels"],
      ["Airbags", "2 (driver and co-driver)"], ["Crash test", "Global NCAP 4 stars for adults (2020)"]
    ],
    sources: [
      { name: "Tata Motors, Tiago specifications (archived 21 Feb 2024)", url: "https://web.archive.org/web/20240221174604/https://cars.tatamotors.com/tiago/ice/specifications.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Tata", model: "Tigor EV", variant_has: [], from: 2021, to: 2026, fuel: "Electric",
    label: "Tigor EV (Ziptron, 26 kWh)",
    rows: [
      ["Battery", "26 kWh lithium-ion, liquid cooled, IP67"], ["Motor", "Permanent magnet synchronous, 55 kW"], ["Torque", "170 Nm"],
      ["0 to 60 km/h", "5.7 seconds"], ["Gearbox", "Single-speed automatic"], ["Seats", "5"],
      ["Length", "3,993 mm"], ["Width", "1,677 mm"], ["Height", "1,532 mm"],
      ["Wheelbase", "2,450 mm"], ["Ground clearance", "172 mm (unladen)"], ["Boot", "316 litres"],
      ["Brakes", "Discs at the front, drums at the rear"], ["Tyres", "175/65 R14"]
    ],
    sources: [
      { name: "Tata Motors, Tigor.ev specifications (XZ+)", url: "https://ev.tata.cars/tigor/ev/specifications.html", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Tesla", model: "Model Y", variant_has: ["L Premium", "AWD"], from: 2026, to: 2026, fuel: "Electric", maker: false,
    label: "Model Y L Premium AWD, six seats (India launch, April 2026)",
    rows: [
      ["Battery", "88 kWh"], ["Drive", "All-wheel drive"], ["Seats", "6 (2+2+2)"],
      ["Claimed range", "681 km (WLTP)"], ["0 to 100 km/h", "5.0 seconds"], ["Length", "4,976 mm"],
      ["Width", "1,920 mm"], ["Height", "1,668 mm"], ["Wheelbase", "3,040 mm (150 mm longer than the standard Model Y)"],
      ["Ground clearance", "122 mm (laden)"], ["Cargo", "Up to 2,539 litres with the rear seats folded, plus a 116-litre front boot"]
    ],
    sources: [
      { name: "Autocar Professional, Tesla launches Model Y L at Rs 61.99 lakh (22 Apr 2026)", url: "https://www.autocarpro.in/news/tesla-launches-model-y-l-at-%e2%82%b96199-lakh-132198", as_of: "2026-10-15" },
      { name: "The Week, Tesla Model Y L deliveries begin in India (15 Jun 2026)", url: "https://www.theweek.in/news/biz-tech/2026/06/15/tesla-model-y-l-india-deliveries-launch.html", as_of: "2026-10-15" },
      { name: "CarWale, Tesla Model Y versions, prices and news (as of October 2026)", url: "https://www.carwale.com/tesla-cars/model-y/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Toyota", model: "Corolla Altis", variant_has: ["1.8"], from: 2017, to: 2020, fuel: "Petrol", maker: false,
    label: "Corolla Altis 1.8 petrol CVT (E170, 2017 facelift)",
    rows: [
      ["Engine", "2ZR-FE 1.8 petrol, 1,798 cc"], ["Power", "138 bhp at 6,400 rpm"], ["Torque", "173 Nm at 4,000 rpm"],
      ["Gearbox", "CVT automatic with paddle shifters and sport mode"], ["Drive", "Front-wheel drive"], ["Seats", "5"],
      ["Length", "4,620 mm"], ["Width", "1,775 mm"], ["Height", "1,475 mm"],
      ["Wheelbase", "2,700 mm"], ["Boot", "470 litres"], ["Fuel tank", "55 litres"],
      ["Tyres", "205/55 R16"], ["Airbags", "7"]
    ],
    sources: [
      { name: "CarWale, Corolla Altis VL CVT petrol specifications (spec database; Toyota's India pages for it are gone)", url: "https://www.carwale.com/toyota-cars/corolla-altis/vl-cvt-petrol/", as_of: "2026-10-15" },
      { name: "Wikipedia, Toyota Corolla (E170) (India dates)", url: "https://en.wikipedia.org/wiki/Toyota_Corolla_(E170)", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Toyota", model: "Fortuner", variant_has: ["3.0", "MT"], from: 2009, to: 2011, fuel: "Diesel", maker: false,
    label: "Fortuner 3.0 D-4D diesel 4x4 manual (first generation, 2009 to 2011)",
    rows: [
      ["Engine", "3.0 D-4D turbo diesel, 2,982 cc"], ["Power", "171 bhp at 3,600 rpm"], ["Torque", "343 Nm at 1,400 rpm"],
      ["Gearbox", "5-speed manual"], ["Drive", "Four-wheel drive"], ["Seats", "7"],
      ["Length", "4,695 mm"], ["Width", "1,840 mm"], ["Height", "1,850 mm"],
      ["Wheelbase", "2,750 mm"], ["Fuel tank", "80 litres"], ["Tyres", "265/65 R17"]
    ],
    sources: [
      { name: "CarWale, Fortuner 2009-2012 3.0 MT specifications (spec database; Toyota's pages for it are gone)", url: "https://www.carwale.com/toyota-cars/fortuner-2009-2012/30-mt/", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Toyota", model: "Fortuner", variant_has: ["4x4", "AT"], from: 2021, to: 2025, fuel: "Diesel", maker: false,
    label: "Fortuner 2.8 diesel 4x4 automatic (second generation, after the January 2021 facelift)",
    rows: [
      ["Engine", "2.8 turbo diesel, 2,755 cc"], ["Power", "201 bhp at 3,000 to 3,420 rpm"], ["Torque", "500 Nm at 1,620 to 2,820 rpm"],
      ["Gearbox", "6-speed automatic"], ["Drive", "Four-wheel drive"], ["Seats", "7"],
      ["Length", "4,795 mm"], ["Width", "1,855 mm"], ["Height", "1,835 mm"],
      ["Wheelbase", "2,745 mm"], ["Fuel tank", "80 litres"], ["Tyres", "265/60 R18"],
      ["Airbags", "7"]
    ],
    sources: [
      { name: "CarDekho, Fortuner 4X4 Diesel AT specifications (spec database; toyotabharat.com refused automated reading)", url: "https://www.cardekho.com/overview/Toyota_Fortuner/Toyota_Fortuner_4X4_Diesel_AT.htm", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Toyota", model: "Innova", variant_has: ["2.5", "VX"], from: 2009, to: 2012, fuel: "Diesel", maker: false,
    label: "Innova 2.5 diesel (first generation, 2009 to 2012)",
    rows: [
      ["Engine", "2.5 turbo diesel, 2,494 cc"], ["Power", "102 PS at 3,600 rpm"], ["Torque", "200 Nm at 1,400 to 3,400 rpm"],
      ["Gearbox", "5-speed manual"], ["Drive", "Rear-wheel drive"], ["Seats", "8 (this car)"],
      ["Length", "4,580 mm"], ["Width", "1,770 mm"], ["Height", "1,755 mm"],
      ["Wheelbase", "2,750 mm"], ["Fuel tank", "55 litres"], ["Tyres", "205/65 R15"]
    ],
    sources: [
      { name: "CarDekho, Innova 2009-2012 2.5 VX 8 STR BSIV specifications (spec database)", url: "https://www.cardekho.com/overview/Toyota_Innova_2009-2012/Toyota_Innova_2009-2012_2.5_VX_8_STR_BSIV.htm", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Toyota", model: "Innova Crysta", variant_has: ["2.8", "AT"], from: 2016, to: 2020, fuel: "Diesel", maker: false,
    label: "Innova Crysta 2.8 diesel automatic (2016 to 2020)",
    rows: [
      ["Engine", "1GD-FTV 2.8 turbo diesel, 2,755 cc"], ["Power", "172 bhp at 3,400 rpm"], ["Torque", "360 Nm at 1,200 to 3,400 rpm"],
      ["Gearbox", "6-speed automatic"], ["Drive", "Rear-wheel drive"], ["Seats", "7"],
      ["Length", "4,735 mm"], ["Width", "1,830 mm"], ["Height", "1,795 mm"],
      ["Wheelbase", "2,750 mm"], ["Fuel tank", "55 litres"]
    ],
    sources: [
      { name: "CarTrade, Innova Crysta 2016-2020 2.8 ZX AT 7 STR (spec database; Toyota's pages for it are gone)", url: "https://www.cartrade.com/toyota-cars/innova-crysta-2016-2020/2-8-zx-at-7-str/", as_of: "2026-10-15" },
      { name: "CarDekho, Innova Crysta 2016-2020 2.8 ZX AT specifications (spec database)", url: "https://www.cardekho.com/overview/Toyota_Innova_Crysta_2016-2020/Toyota_Innova_Crysta_2016-2020_2.8_ZX_AT_BSIV.htm", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Toyota", model: "Urban Cruiser Hyryder", variant_has: ["Hybrid"], from: 2022, to: 2026, fuel: "Hybrid", maker: false,
    label: "Urban Cruiser Hyryder 1.5 strong hybrid e-CVT",
    rows: [
      ["Engine", "1.5 petrol, three cylinders, 1,490 cc"], ["Engine power", "91 bhp at 5,500 rpm"], ["Engine torque", "122 Nm at 4,400 to 4,800 rpm"],
      ["Electric motor", "79 hp, 141 Nm"], ["Combined output", "114 hp"], ["Gearbox", "e-CVT automatic"],
      ["Drive", "Front-wheel drive"], ["Seats", "5"], ["Length", "4,365 mm"],
      ["Width", "1,795 mm"], ["Height", "1,645 mm"], ["Wheelbase", "2,600 mm"],
      ["Fuel tank", "45 litres"], ["Tyres", "215/60 R17"], ["Airbags", "6"]
    ],
    sources: [
      { name: "CarDekho, Hyryder V Hybrid specifications (spec database; toyotabharat.com refused automated reading)", url: "https://www.cardekho.com/overview/Toyota_Urban_Cruiser_Hyryder/Toyota_Urban_Cruiser_Hyryder_V_Hybrid.htm", as_of: "2026-10-15" },
      { name: "Wikipedia, Toyota Urban Cruiser Hyryder (India dates, hybrid outputs)", url: "https://en.wikipedia.org/wiki/Toyota_Urban_Cruiser_Hyryder", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Volkswagen", model: "Vento", variant_has: ["TSI"], from: 2013, to: 2014, fuel: "Petrol", maker: false,
    label: "Vento 1.2 TSI DSG automatic (2013 to 2014)",
    rows: [
      ["Engine", "1.2 litre TSI turbo-petrol, 1,197 cc"], ["Power", "105 PS (103 bhp) at 5,000 rpm"], ["Torque", "175 Nm"],
      ["Gearbox", "7-speed DSG dual-clutch automatic"], ["Drive", "Front-wheel drive"], ["Airbags", "2 (front)"],
      ["Brakes", "ABS"], ["Stability control", "ESP with hill hold"]
    ],
    sources: [
      { name: "Autocar India, Volkswagen Vento TSI launched (10 Oct 2013)", url: "https://www.autocarindia.com/car-news/vento-tsi-360113", as_of: "2026-10-15" },
      { name: "Business Today, Volkswagen launches Vento TSI (10 Oct 2013)", url: "https://www.businesstoday.in/story/volkswagen-launches-vento-tsi-price/1/199443.html", as_of: "2026-10-15" },
      { name: "Wikipedia, Volkswagen Vento (A05): India engines and dates", url: "https://en.wikipedia.org/wiki/Volkswagen_Vento_(A05)", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Volkswagen", model: "Vento", variant_has: ["Highline", "Petrol"], from: 2015, to: 2016, fuel: "Petrol", maker: false,
    label: "Vento 1.6 MPI petrol manual, Highline (2015 update)",
    rows: [
      ["Engine", "1.6 litre MPI petrol, 1,598 cc"], ["Power", "105 PS (103 bhp) at 5,250 rpm"], ["Torque", "153 Nm at 3,800 rpm"],
      ["Gearbox", "5-speed manual"], ["Drive", "Front-wheel drive"], ["Length", "4,390 mm"],
      ["Width", "1,699 mm"], ["Height", "1,467 mm"], ["Wheelbase", "2,553 mm"],
      ["Ground clearance", "163 mm"], ["Boot", "494 litres"], ["Fuel tank", "55 litres"],
      ["Brakes", "Front discs, rear drums, ABS"]
    ],
    sources: [
      { name: "CarWale, Vento [2015-2019] Highline Petrol [2015-2016] specifications (spec database; Volkswagen India's pages for this car are gone)", url: "https://www.carwale.com/volkswagen-cars/vento-2015-2019/highline/", as_of: "2026-10-15" },
      { name: "CarDekho, Vento 2015-2019 1.6 Highline specifications", url: "https://www.cardekho.com/overview/Volkswagen_Vento_2015-2019/Volkswagen_Vento_2015-2019_1.6_Highline.htm", as_of: "2026-10-15" },
      { name: "Wikipedia, Volkswagen Vento (A05): India engines and dates", url: "https://en.wikipedia.org/wiki/Volkswagen_Vento_(A05)", as_of: "2026-10-15" }
    ]
  },
  {
    make: "Volvo", model: "XC40", variant_has: ["Momentum"], from: 2018, to: 2019, fuel: "Diesel", maker: false,
    label: "XC40 D4 Momentum, 2.0 diesel AWD (first generation, 2018 to 2019)",
    rows: [
      ["Engine", "2.0 litre four-cylinder diesel (D4), 1,969 cc"], ["Power", "190 hp"], ["Torque", "400 Nm"],
      ["Gearbox", "8-speed automatic"], ["Drive", "All-wheel drive"], ["Length", "4,425 mm"],
      ["Height", "1,652 mm"], ["Wheelbase", "2,702 mm"], ["Ground clearance", "211 mm"],
      ["Fuel tank", "54 litres"], ["Airbags", "8"]
    ],
    sources: [
      { name: "Autocar India, Volvo XC40 Momentum, Inscription variants launched (16 Jul 2018)", url: "https://www.autocarindia.com/car-news/volvo-xc40-momentum-inscription-variants-launched-409052", as_of: "2026-10-15" },
      { name: "Rushlane, new Volvo XC40 India launch (4 Jul 2018)", url: "https://www.rushlane.com/new-volvo-xc40-india-launch-price-12270656.html", as_of: "2026-10-15" },
      { name: "CarDekho, XC40 2018-2022 D4 Momentum specifications (spec database; Volvo India's pages for this car are gone)", url: "https://www.cardekho.com/overview/Volvo_XC40_2018-2022/Volvo_XC40_2018-2022_D4_Momentum_BSIV.htm", as_of: "2026-10-15" }
    ]
  }
  /* ---- end of researched entries ---- */
];

if (typeof window !== "undefined") { window.MODEL_SPECS = MODEL_SPECS; }
