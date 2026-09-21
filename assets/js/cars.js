/* =========================================================================
   Classic Auto — website-v5 — inventory data. (unchanged from v4)
   Field names mirror business-lab/website/inventory.csv 1:1
   (id,make,model,variant,year,price,kms,fuel,trans,owners,colour,reg_city,
   insurance,photos,status,notes) plus two v4 additions used by the Studio:
     body:  "hatchback" | "sedan" | "suv" | "luxury-sedan"
     paint: hex string, matches `colour`, drives the Studio's paint swatch

   price is in whole rupees (matches the CSV, e.g. 1685000 = ₹16.85 L).
   kms is a number. photos is an array of real image paths — left empty
   when no real matching photo exists in assets/photos (the car card then
   renders a gradient placeholder card instead of a fabricated photo).
   Plain classic script (no modules/fetch), safe for file:// + static host.
   ========================================================================= */
var CARS = [
  {
    id: "hyundai-creta-2021", make: "Hyundai", model: "Creta", variant: "SX(O) Diesel",
    year: 2021, price: 1550000, kms: 32000, fuel: "Diesel", trans: "Manual",
    owners: "1st", colour: "Polar White", reg_city: "Mumbai (MH-02)",
    insurance: "Valid till Jun 2027", photos: ["assets/photos/hyundai-creta.jpg"],
    status: "available", body: "suv", paint: "#f2f2ef",
    notes: "Top-spec SX(O) diesel with ventilated front seats and the panoramic sunroof. Single owner, BlueLink connected-car app still active, full Hyundai service history in hand."
  },
  {
    id: "toyota-fortuner-2021", make: "Toyota", model: "Fortuner", variant: "2.8 4x2 AT",
    year: 2021, price: 3350000, kms: 41000, fuel: "Diesel", trans: "Automatic",
    owners: "1st", colour: "Super White", reg_city: "Mumbai (MH-01)",
    insurance: "Valid till Feb 2027", photos: ["assets/photos/toyota-fortuner.jpg"],
    status: "available", body: "suv", paint: "#f6f6f3",
    notes: "Company-maintained Fortuner with every service stamp on record. Fresh tyres front to back, cruise control, tow-hitch fitted for weekend trips out of the city."
  },
  {
    id: "innova-crysta-2020", make: "Toyota", model: "Innova Crysta", variant: "2.4 GX 7-Str",
    year: 2020, price: 1875000, kms: 58000, fuel: "Diesel", trans: "Manual",
    owners: "2nd", colour: "Silver Metallic", reg_city: "Mumbai (MH-03)",
    insurance: "Valid till Oct 2026", photos: [],
    status: "available", body: "suv", paint: "#c7c9cc",
    notes: "The Mumbai family workhorse — seven genuine seats, captain chairs in row two, and a diesel engine that's still returning strong mileage at this odometer reading."
  },
  {
    id: "honda-city-2020", make: "Honda", model: "City", variant: "ZX CVT",
    year: 2020, price: 1120000, kms: 47000, fuel: "Petrol", trans: "Automatic",
    owners: "1st", colour: "Lunar Silver Metallic", reg_city: "Mumbai (MH-02)",
    insurance: "Valid till Jan 2027", photos: ["assets/photos/honda-city.jpg"],
    status: "available", body: "sedan", paint: "#d6d8db",
    notes: "Top ZX trim with the sunroof and LaneWatch camera, riding on Honda's smooth CVT gearbox. Single owner, always serviced at Honda's Kandivali workshop."
  },
  {
    id: "hyundai-verna-2021", make: "Hyundai", model: "Verna", variant: "SX(O) Turbo DCT",
    year: 2021, price: 1285000, kms: 39500, fuel: "Petrol", trans: "Automatic",
    owners: "1st", colour: "Fiery Red", reg_city: "Mumbai (MH-04)",
    insurance: "Valid till Sep 2026", photos: [],
    status: "available", body: "sedan", paint: "#b3251f",
    notes: "The 1.0 turbo-DCT Verna in the flagship SX(O) trim — ventilated seats, BOSE audio and a genuinely quick engine for a segment that's usually sleepy."
  },
  {
    id: "kia-seltos-2022", make: "Kia", model: "Seltos", variant: "GTX+ Turbo DCT",
    year: 2022, price: 1590000, kms: 22000, fuel: "Petrol", trans: "Automatic",
    owners: "1st", colour: "Gravity Grey", reg_city: "Mumbai (MH-01)",
    insurance: "Valid till Apr 2027", photos: [],
    status: "available", body: "suv", paint: "#4a4d52",
    notes: "Low-mileage GTX+ with the full Kia Connect suite, ventilated seats and Bose sound. Still comfortably inside the manufacturer's extended warranty window."
  },
  {
    id: "mahindra-thar-2022", make: "Mahindra", model: "Thar", variant: "LX 4x4 AT",
    year: 2022, price: 1650000, kms: 18500, fuel: "Diesel", trans: "Automatic",
    owners: "1st", colour: "Red Rage", reg_city: "Mumbai (MH-03)",
    insurance: "Valid till Dec 2026", photos: [],
    status: "SOLD", body: "suv", paint: "#8a1f1f",
    notes: "Hard-top LX 4x4 automatic, barely run in. This one moved fast — sharing the listing as a reference for what a clean Thar of this age trades at."
  },
  {
    id: "mahindra-xuv700-2023", make: "Mahindra", model: "XUV700", variant: "AX7L Diesel AWD",
    year: 2023, price: 2450000, kms: 14000, fuel: "Diesel", trans: "Automatic",
    owners: "1st", colour: "Everest White", reg_city: "Mumbai (MH-02)",
    insurance: "Valid till Aug 2027", photos: [],
    status: "available", body: "suv", paint: "#eef0ee",
    notes: "Top-of-range AX7L with ADAS, AWD and the 7-seat layout. Near-new condition with the balance of Mahindra's factory warranty carrying over to you."
  },
  {
    id: "tata-nexon-2022", make: "Tata", model: "Nexon", variant: "XZ+ (S) Petrol",
    year: 2022, price: 1085000, kms: 26500, fuel: "Petrol", trans: "Manual",
    owners: "1st", colour: "Flame Red", reg_city: "Mumbai (MH-04)",
    insurance: "Valid till May 2027", photos: [],
    status: "available", body: "suv", paint: "#a32020",
    notes: "5-star Global NCAP safety rating, sunroof, and Tata's connected-car app. A well-kept city-first SUV with light, easy running costs."
  },
  {
    id: "maruti-swift-2019", make: "Maruti Suzuki", model: "Swift", variant: "ZXi AMT",
    year: 2019, price: 585000, kms: 61000, fuel: "Petrol", trans: "Automatic",
    owners: "2nd", colour: "Pearl Arctic White", reg_city: "Mumbai (MH-01)",
    insurance: "Valid till Mar 2027", photos: ["assets/photos/maruti-swift.jpg"],
    status: "available", body: "hatchback", paint: "#eef1f0",
    notes: "The AMT automatic gearbox makes this the easiest first car in Mumbai traffic. New battery and a fresh set of tyres fitted before listing."
  },
  {
    id: "maruti-baleno-2021", make: "Maruti Suzuki", model: "Baleno", variant: "Alpha CVT",
    year: 2021, price: 745000, kms: 34000, fuel: "Petrol", trans: "Automatic",
    owners: "1st", colour: "Nexa Blue", reg_city: "Mumbai (MH-02)",
    insurance: "Valid till Jul 2026", photos: [],
    status: "available", body: "hatchback", paint: "#234a7a",
    notes: "Top Alpha trim with the CVT gearbox and a genuinely roomy cabin for a premium hatchback. Single owner, always serviced at a Nexa outlet."
  },
  {
    id: "bmw-3-series-2019", make: "BMW", model: "3 Series", variant: "320d Luxury Line",
    year: 2019, price: 2985000, kms: 44000, fuel: "Diesel", trans: "Automatic",
    owners: "1st", colour: "Mineral White Metallic", reg_city: "Mumbai (MH-01)",
    insurance: "Valid till Nov 2026", photos: ["assets/photos/bmw-3-series.jpg"],
    status: "available", body: "luxury-sedan", paint: "#e9e9e6",
    notes: "Precise, efficient and finished in a showroom-condition shell. Ventilated leather seats, BMW ConnectedDrive, accident-free and dealer-inspected."
  },
  {
    id: "mercedes-c-class-2020", make: "Mercedes-Benz", model: "C-Class", variant: "C 220d Progressive",
    year: 2020, price: 3450000, kms: 36000, fuel: "Diesel", trans: "Automatic",
    owners: "1st", colour: "Obsidian Black", reg_city: "Mumbai (MH-03)",
    insurance: "Valid till Jan 2027", photos: [],
    status: "available", body: "luxury-sedan", paint: "#131313",
    notes: "The compact-executive benchmark — MBUX infotainment, a supple ride and Mercedes' 2.0 diesel that's known to comfortably clear 2 lakh km."
  },
  {
    id: "audi-a4-2019", make: "Audi", model: "A4", variant: "35 TDI Premium Plus",
    year: 2019, price: 2650000, kms: 51000, fuel: "Diesel", trans: "Automatic",
    owners: "2nd", colour: "Glacier White Metallic", reg_city: "Mumbai (MH-02)",
    insurance: "Valid till Jun 2026", photos: [],
    status: "SOLD", body: "luxury-sedan", paint: "#eceeee",
    notes: "Virtual cockpit, quattro-badge styling and Audi's refined 2.0 TDI. Left up as a reference listing for the A4's current resale band in this condition."
  },
  {
    id: "kia-sonet-2022", make: "Kia", model: "Sonet", variant: "GTX+ Turbo DCT",
    year: 2022, price: 1145000, kms: 19500, fuel: "Petrol", trans: "Automatic",
    owners: "1st", colour: "Intense Red", reg_city: "Mumbai (MH-04)",
    insurance: "Valid till Mar 2027", photos: [],
    status: "available", body: "suv", paint: "#9e2020",
    notes: "Compact SUV with a proper turbo-petrol DCT, ventilated seats and a segment-best boot. Low mileage, single owner, still under Kia's factory warranty."
  }
];

if (typeof window !== "undefined") { window.CARS = CARS; }
