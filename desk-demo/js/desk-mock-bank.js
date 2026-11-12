// Bank keywords for the static public demo: an in-memory copy of made-up statement lines, grouped and suggested the way the
// real server does (BANKTAG-CONTRACT.md). Every person, firm and handle is invented; no phone number or real e-mail anywhere
// (references start with a letter or a 4/5). Deterministic: a seeded generator, so the demo looks the same on every load.
// Every action changes the in-memory copy only. get/send/upload are synchronous (desk-mock.js clones the answer).
import { ApiError } from "./api.js";

const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const ACCOUNTS = [["Demo Bank", "0001", "current"], ["Sample Bank", "0002", "OD"], ["Demo Co-op", "0003", "savings"]]
  .map(([bank, last4, kind], i) => ({ id: i + 1, bank, last4, label: `${bank} ${kind} ••${last4}` }));
const START_BAL = [650000, -420000, 300000];
const KEYWORD_ROWS = `Car buying|Car purchase|car|out|;Car buying|Car purchase advance|car|out|;Car buying|Park & Sell payout|car|out|;Car buying|Broker / commission paid|person|out|;
Car selling|Car sale: full payment|car|in|deal:balance;Car selling|Car sale: token / booking|car|in|deal:token;Car selling|Car sale: loan disbursal|car|in|deal:loan_disbursal;Car selling|Exchange car adjustment|car|-|;
Car costs|Refurb: denting / painting|car|out|car_cost:denting_painting;Car costs|Repair / service|car|out|car_cost:mechanical;Car costs|Detailing / cleaning|car|out|car_cost:detailing;Car costs|Tyres / battery / parts|car|out|car_cost:parts;Car costs|RTO / transfer fees|car|out|car_cost:rto_fees;Car costs|Car insurance|car|out|car_cost:insurance;Car costs|Transport / towing|car|out|car_cost:transport;
Staff|Salary|person|out|expense:salaries;Staff|Incentive / commission (staff)|person|out|expense:salaries;Staff|Staff advance|person|out|;Staff|Staff welfare / food|none|out|expense:misc;
Showroom|Rent|person|out|expense:rent;Showroom|Electricity|none|out|expense:electricity;Showroom|Internet / phone|none|out|expense:office;Showroom|Showroom upkeep|none|out|expense:office;Showroom|Office supplies|none|out|expense:office;
Marketing|Car portals|none|out|expense:marketing;Marketing|Ads (Meta / Google)|none|out|expense:marketing;Marketing|Photography / printing|none|out|expense:marketing;Software|Software and subscriptions|none|out|expense:office;
Taxes and fees|GST paid|none|out|ledger:gst_payment;Taxes and fees|TDS paid|none|out|ledger:other;Taxes and fees|Income tax|none|out|ledger:income_tax;Taxes and fees|Professional tax|none|out|expense:misc;Taxes and fees|CA / accountant fees|person|out|expense:office;Taxes and fees|Legal|person|out|expense:office;
Money in / out|Loan EMI|none|out|ledger:loan_repayment;Money in / out|Loan received|none|in|ledger:loan_disbursal;Money in / out|Interest received|none|in|ledger:other_income;Money in / out|Bank charges|none|out|expense:bank_charges;Money in / out|Investor money in|person|in|ledger:other;Money in / out|Investor payout / profit share|person|out|ledger:other;Money in / out|Partner drawings|person|out|ledger:drawings;Money in / out|Capital introduced|person|in|ledger:capital;
Transfers and cash|Transfer between own accounts|none|-|ledger:transfer;Transfers and cash|Cash deposit|none|in|contra:cash;Transfers and cash|Cash withdrawal|none|out|contra:cash;Other|Refund|none|-|;Other|Personal (not business)|none|out|ledger:drawings;Other|Ask accountant|none|-|`;
const WORDS = { 16: "SALARY, SAL", 20: "RENT", 21: "MSEDCL, ELECTRICITY", 22: "BROADBAND, AIRTEL", 29: "GST", 35: "ACH D, EMI", 38: "CHG, SMS, CHARGES", 45: "ATM WDL", 44: "CASH DEP" };
const HINTS = { 1: "Paying the seller for a car we bought", 6: "A customer's booking amount for a car", 43: "Money moved between our own accounts", 47: "Spending that is not for the business" };
const BOOKS_LABEL = (b) => { if (!b) return "Tag only"; const [t, v] = b.split(":"); const w = v.replace(/_/g, " ");
  return t === "contra" ? "Bank and cash (contra)" : t === "deal" ? `Payment on the car's deal: ${w}` : `${{ expense: "Expense", ledger: "Ledger", car_cost: "Car cost" }[t]}: ${w}`; };
const PARTIES = [["Kabir Demo", "Salesman", 16], ["Rohan Sample", "Manager", 16], ["Aarav Test", "Staff", 16], ["Demo CA Associates", "Accountant", 33], ["Demo Rent LLP", "Landlord", 20], ["Sample Garage Works", "Mechanic / garage", 10],
  ["Demo Denting & Paint", "Mechanic / garage", 9], ["RTO Agent Demo", "RTO agent", 13], ["Demo Investor One", "Investor", 39], ["Sample Transporters", "Transporter", 15], ["Brokerage Demo", "Broker", 4], ["Demo Insurance Co", "Insurer", 14],
  ["Sample Finance Ltd", "Bank / lender", 35], ["Sana Demo", "Staff", 16]];
const PARTY_TYPES = ["Salesman", "Manager", "Staff", "Accountant", "Partner", "Investor", "Landlord", "Mechanic / garage", "RTO agent", "Insurer", "Transporter", "Broker", "Bank / lender", "Other"];
const CAR_NAMES = ["2021 Hyundai Creta", "2019 Maruti Baleno", "2020 Honda City", "2018 Toyota Innova", "2022 Tata Nexon", "2017 Mahindra XUV500", "2021 Kia Seltos", "2019 Skoda Rapid", "2020 Maruti Swift", "2022 Hyundai Venue"];
const CARS = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, stock_no: `CA${101 + i}`, name: CAR_NAMES[i % 10], status: ["delivered", "available", "booked", "refurb"][i % 4] }));
const QUICK = [16, 1, 6, 20, 10, 38, 45, 43, 37];
const AI_NOTE = "When this is on, the bank narrations of the groups you choose (names, UPI IDs and remarks, with digits hidden; never account numbers) are sent to Anthropic's Claude to suggest a keyword. Off by default.";

/** One group of the sample statements: g(label, options). d direction, a account, k keyword, n lines, amt amount or amounts, v spread, day, m narration style,
 *  rem remark, c confidence, src source, why reason, p party, rec monthly, pre done|partial at the start, cars stock numbers, m0/span months, mir copy another group. */
const g = (label, o) => ({ label, ...o });
const SPECS = [
  g("SELLER ONE DEMO | seller1.demo@okdemo", { d: "out", a: 0, k: 1, n: 2, amt: [100000, 520000], day: 6, m: "NEFT", rem: "CA101 PAYMENT", c: 0.9, src: "car", why: "stock number CA101 is in the narration", cars: [101], m0: 0, span: 2 }),
  g("SELLER TWO DEMO | seller2.demo@okdemo", { d: "out", a: 0, k: 1, n: 1, amt: 780000, day: 9, m: "RTGS", rem: "CA102 FULL PAYMENT", c: 0.9, src: "car", why: "stock number CA102 is in the narration", cars: [102], m0: 1 }),
  g("SELLER THREE DEMO | seller3.demo@okdemo", { d: "out", a: 1, k: 1, n: 1, amt: 435000, day: 14, m: "NEFT", rem: "CA103 PAYMENT", c: 0.88, src: "car", why: "stock number CA103 is in the narration", cars: [103], m0: 2 }),
  g("PARK AND SELL OWNER DEMO", { d: "out", a: 0, k: 3, n: 2, amt: [210000, 340000], day: 11, m: "NEFT", rem: "CA104 PNS PAYOUT", c: 0.8, src: "car", why: "stock number CA104, same payee paid twice", cars: [104], m0: 3, span: 2 }),
  g("SELLER FOUR DEMO | seller4.demo@okdemo", { d: "out", a: 0, k: 1, n: 1, amt: 660000, day: 20, m: "NEFT", rem: "VEHICLE PAYMENT", c: 0.58, src: "words", why: "large payment out; no stock number in the narration", m0: 4 }),
  g("BROKER DEMO | broker.demo@okdemo", { d: "out", a: 0, k: 4, n: 3, amt: 8000, v: 0.4, day: 0, m: "UPI", rem: "COMMISSION", c: 0.76, src: "people", why: "matched broker Brokerage Demo", p: 11, m0: 1, span: 4 }),
  g("BUYER ONE DEMO | buyer1.demo@okdemo", { d: "in", a: 0, k: 6, n: 1, amt: 25000, day: 8, m: "UPI", rem: "TOKEN CA101", c: 0.9, src: "car", why: "stock number CA101 and a small first payment", cars: [101], m0: 0 }),
  g("BUYER TWO DEMO | buyer2.demo@okdemo", { d: "in", a: 0, k: 6, n: 1, amt: 21000, day: 12, m: "UPI", rem: "BOOKING CA102", c: 0.9, src: "car", why: "stock number CA102 and a small first payment", cars: [102], m0: 2 }),
  g("BUYER THREE DEMO | buyer3.demo@okdemo", { d: "in", a: 0, k: 5, n: 2, amt: [15000, 420000], day: 16, m: "IMPS", rem: "CA103", c: 0.86, src: "car", why: "stock number CA103 paid in two parts", cars: [103], m0: 3, span: 2 }),
  g("SAMPLE FINANCE LTD DISBURSAL", { d: "in", a: 0, k: 7, n: 3, amt: [300000, 450000, 520000], day: 18, m: "RTGS", rem: "LOAN DISBURSAL", c: 0.93, src: "words", why: "lender name and RTGS credit; each line has its own car", cars: [101, 102, 104], m0: 2, span: 3 }),
  g("BUYER FOUR DEMO | buyer4.demo@okdemo", { d: "in", a: 0, k: 5, n: 1, amt: 1125000, day: 22, m: "NEFT", rem: "VEHICLE", c: 0.62, src: "words", why: "large credit; no stock number in the narration", m0: 5 }),
  g("SELLER FIVE DEMO | seller5.demo@okdemo", { d: "out", a: 0, k: 1, n: 1, amt: 390000, day: 5, m: "NEFT", rem: "VEHICLE PAYMENT", c: 0.7, src: "words", why: "large payment out", pre: "done", m0: 0 }),
  g("KABIR DEMO | kabir.demo@okdemo", { d: "out", a: 0, k: 16, n: 6, amt: 32000, day: 2, m: "UPI", rem: "Salary", c: 0.95, src: "people", why: "matched staff Kabir Demo, monthly ~₹32,000", p: 1, rec: 1, pre: "partial" }),
  g("ROHAN SAMPLE | rohan.sample@okdemo", { d: "out", a: 0, k: 16, n: 6, amt: 45000, day: 1, m: "NEFT", rem: "SALARY", c: 0.96, src: "people", why: "matched staff Rohan Sample, monthly ~₹45,000", p: 2, rec: 1 }),
  g("AARAV TEST | aarav.test@okdemo", { d: "out", a: 0, k: 16, n: 6, amt: 28000, day: 3, m: "UPI", rem: "Salary", c: 0.93, src: "people", why: "matched staff Aarav Test, monthly ~₹28,000", p: 3, rec: 1 }),
  g("SANA DEMO | sana.demo@okdemo", { d: "out", a: 0, k: 16, n: 6, amt: 22000, day: 3, m: "UPI", rem: "Salary", c: 0.9, src: "people", why: "matched staff Sana Demo, monthly ~₹22,000", p: 14, rec: 1 }),
  g("ZOYA DEMO | zoya.demo@okdemo", { d: "out", a: 0, k: 16, n: 3, amt: 18000, day: 5, m: "UPI", rem: "Salary", c: 0.72, src: "recurring", why: "monthly ~₹18,000 on the 5th, not matched to a staff name", rec: 1, m0: 3, span: 3 }),
  g("DEMO RENT LLP", { d: "out", a: 0, k: 20, n: 6, amt: 85000, day: 5, m: "NEFT", rem: "SHOWROOM RENT", c: 0.97, src: "rule", why: "saved rule for Demo Rent LLP, monthly ~₹85,000", p: 5, rec: 1, pre: "done" }),
  g("DEMO POWER DISTRIBUTION", { d: "out", a: 0, k: 21, n: 6, amt: 14500, v: 0.2, day: 12, m: "RAW", rem: "ELECTRICITY BILL", c: 0.91, src: "rule", why: "saved rule: electricity bill", rec: 1, pre: "done" }),
  g("DEMO BROADBAND", { d: "out", a: 0, k: 22, n: 6, amt: 1499, day: 7, m: "NACH", rem: "", c: 0.88, src: "words", why: "narration says BROADBAND, monthly ₹1,499", rec: 1 }),
  g("SAMPLE CLEANING SERVICES | sample.clean@okdemo", { d: "out", a: 0, k: 23, n: 6, amt: 6000, day: 4, m: "UPI", rem: "CLEANING", c: 0.62, src: "recurring", why: "monthly ~₹6,000 to a cleaning firm", rec: 1 }),
  g("DEMO STATIONERS | demo.stationers@okdemo", { d: "out", a: 0, k: 24, n: 5, amt: 850, v: 0.5, day: 0, m: "UPI", rem: "STATIONERY", c: 0.55, src: "words", why: "small UPI payments to a stationer" }),
  g("SAMPLE CARPORTAL", { d: "out", a: 0, k: 25, n: 6, amt: 12000, day: 9, m: "NACH", rem: "", c: 0.94, src: "recurring", why: "same ₹12,000 every month to a car portal", rec: 1 }),
  g("META ADS DEMO", { d: "out", a: 1, k: 26, n: 24, amt: 3200, v: 0.6, day: 0, m: "RAW", rem: "ADS", c: 0.9, src: "words", why: "narration says META ADS" }),
  g("DEMO PRINT AND PHOTO | demo.print@okdemo", { d: "out", a: 0, k: 27, n: 4, amt: 4500, v: 0.4, day: 0, m: "UPI", rem: "PRINTING", c: 0.66, src: "words", why: "narration says PRINTING" }),
  g("DEMO CLOUD SOFT", { d: "out", a: 1, k: 28, n: 6, amt: 3540, day: 15, m: "NACH", rem: "", c: 0.92, src: "recurring", why: "same ₹3,540 every month", rec: 1 }),
  g("GST PAYMENT DEMO", { d: "out", a: 0, k: 29, n: 6, amt: 110000, v: 0.3, day: 20, m: "RAW", rem: "GST CHALLAN", c: 0.95, src: "words", why: "narration says GST CHALLAN", rec: 1 }),
  g("TDS CHALLAN DEMO", { d: "out", a: 0, k: 30, n: 3, amt: 8500, v: 0.2, day: 7, m: "RAW", rem: "TDS", c: 0.9, src: "words", why: "narration says TDS", m0: 3, span: 3 }),
  g("DEMO CA ASSOCIATES", { d: "out", a: 0, k: 33, n: 4, amt: 15000, day: 25, m: "NEFT", rem: "PROFESSIONAL FEES", c: 0.78, src: "people", why: "matched accountant Demo CA Associates", p: 4, m0: 0, span: 6 }),
  g("SAMPLE LEGAL ADVISORS", { d: "out", a: 0, k: 34, n: 1, amt: 25000, day: 17, m: "NEFT", rem: "LEGAL FEES", c: 0.5, src: "words", why: "one payment, name sounds like a law firm", m0: 2 }),
  g("SAMPLE FINANCE LTD EMI", { d: "out", a: 0, k: 35, n: 6, amt: 62000, day: 5, m: "NACH", rem: "", c: 0.98, src: "rule", why: "saved rule: ACH debit, same amount every month", p: 13, rec: 1, pre: "done" }),
  g("SMS CHARGES", { d: "out", a: 0, k: 38, n: 6, amt: 24, day: 28, m: "RAW", rem: "", c: 0.97, src: "rule", why: "saved rule: bank SMS charges", rec: 1, pre: "done" }),
  g("IMPS CHARGES", { d: "out", a: 0, k: 38, n: 40, amt: 11, v: 0.4, day: 0, m: "RAW", rem: "", c: 0.97, src: "words", why: "narration says CHARGES; very small amounts" }),
  g("INTEREST CREDIT", { d: "in", a: 2, k: 37, n: 6, amt: 1250, v: 0.1, day: 30, m: "RAW", rem: "", c: 0.96, src: "rule", why: "saved rule: interest credited each month", rec: 1, pre: "done" }),
  g("DEMO INVESTOR ONE | investor.one@okdemo", { d: "in", a: 0, k: 39, n: 2, amt: 500000, day: 3, m: "NEFT", rem: "INVESTMENT", c: 0.85, src: "people", why: "matched investor Demo Investor One", p: 9, m0: 0, span: 4 }),
  g("DEMO INVESTOR ONE PAYOUT", { d: "out", a: 0, k: 40, n: 3, amt: 40000, day: 28, m: "NEFT", rem: "PROFIT SHARE", c: 0.82, src: "people", why: "same person as the investor above, paid every other month", p: 9, m0: 1, span: 6 }),
  g("TRF TO OWN A/C ••0003", { d: "out", a: 0, k: 43, n: 4, amt: 200000, day: 10, m: "RAW", rem: "OWN ACCOUNT", c: 0.9, src: "transfer", why: "the same amount arrives in Demo Co-op savings ••0003 the same day", m0: 0, span: 4 }),
  g("TRF FROM CURRENT ••0001", { d: "in", a: 2, k: 43, n: 4, amt: 200000, day: 10, m: "RAW", rem: "OWN ACCOUNT", c: 0.9, src: "transfer", why: "the same amount left Demo Bank current ••0001 the same day", mir: "TRF TO OWN A/C ••0003" }),
  g("ATM CASH WITHDRAWAL", { d: "out", a: 0, k: 45, n: 48, amt: 12000, v: 0.7, day: 0, m: "ATM", rem: "", c: 0.93, src: "words", why: "narration says ATM WDL" }),
  g("CASH DEPOSIT BRANCH", { d: "in", a: 0, k: 44, n: 30, amt: 90000, v: 0.6, day: 0, m: "RAW", rem: "CASH DEP", c: 0.88, src: "words", why: "narration says CASH DEP" }),
  g("TEA STALL DEMO | tea.demo@okdemo", { d: "out", a: 0, k: 19, n: 60, amt: 120, v: 0.5, day: 0, m: "UPI", rem: "Tea", c: 0.6, src: "recurring", why: "60 small UPI payments to one stall, under ₹500" }),
  g("DEMO SNACKS CORNER | snacks.demo@okdemo", { d: "out", a: 0, k: 19, n: 40, amt: 260, v: 0.5, day: 0, m: "UPI", rem: "Snacks", c: 0.58, src: "recurring", why: "40 small UPI payments, under ₹500" }),
  g("DEMO WATER SUPPLY | water.demo@okdemo", { d: "out", a: 0, k: 19, n: 24, amt: 90, v: 0.3, day: 0, m: "UPI", rem: "Water cans", c: 0.74, src: "words", why: "narration says water cans" }),
  g("SAMPLE FUEL STATION | fuel.demo@okdemo", { d: "out", a: 0, k: 0, n: 24, amt: 1500, v: 0.6, day: 0, m: "UPI", rem: "Fuel" }),
  g("RAHUL DEMO | rahul.demo@okdemo", { d: "out", a: 0, k: 48, n: 5, amt: 6000, v: 0.8, day: 0, m: "UPI", rem: "Rahul", c: 0.4, src: "words", why: "a person's name only; amounts all different" }),
  g("UNKNOWN PARTY DEMO", { d: "out", a: 1, k: 0, n: 2, amt: [18000, 42000], day: 13, m: "NEFT", rem: "TRANSFER", m0: 2, span: 3 }),
  g("SAMPLE GARAGE WORKS | sample.garage@okdemo", { d: "out", a: 0, k: 10, n: 12, amt: 7500, v: 0.7, day: 0, m: "UPI", rem: "Service", c: 0.91, src: "people", why: "matched garage Sample Garage Works; 12 payments, each for its own car", p: 6, cars: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112] }),
  g("DEMO DENTING AND PAINT", { d: "out", a: 0, k: 9, n: 7, amt: 14000, v: 0.6, day: 0, m: "NEFT", rem: "PAINT", c: 0.87, src: "people", why: "matched garage Demo Denting & Paint", p: 7, cars: [101, 102, 104, 105, 106, 107, 108] }),
  g("DEMO TYRES CENTRE | demo.tyres@okdemo", { d: "out", a: 0, k: 12, n: 5, amt: 22000, v: 0.4, day: 0, m: "UPI", rem: "Tyres", c: 0.8, src: "words", why: "narration says Tyres", cars: [102, 103, 105, 106, 108] }),
  g("RTO AGENT DEMO | rto.demo@okdemo", { d: "out", a: 0, k: 13, n: 8, amt: 4500, v: 0.4, day: 0, m: "UPI", rem: "RTO", c: 0.84, src: "people", why: "matched RTO agent RTO Agent Demo", p: 8, cars: [101, 102, 103, 104, 105, 106, 107, 108] }),
  g("DEMO INSURANCE CO", { d: "out", a: 1, k: 14, n: 5, amt: 18000, v: 0.4, day: 0, m: "NEFT", rem: "MOTOR POLICY", c: 0.79, src: "people", why: "matched insurer Demo Insurance Co", p: 12, cars: [101, 103, 104, 105, 106] }),
  g("SAMPLE TRANSPORTERS", { d: "out", a: 0, k: 15, n: 3, amt: 9000, v: 0.3, day: 0, m: "NEFT", rem: "CAR CARRIER", c: 0.77, src: "people", why: "matched transporter Sample Transporters", p: 10, cars: [104, 105, 109] }),
  g("SHINE DETAILING DEMO | shine.demo@okdemo", { d: "out", a: 0, k: 11, n: 9, amt: 2500, v: 0.4, day: 0, m: "UPI", rem: "Detailing", c: 0.86, src: "words", why: "narration says Detailing", cars: [101, 102, 103, 104, 105, 106, 107, 108, 109] }),
  g("SPARKLE CAR WASH DEMO | sparkle.demo@okdemo", { d: "out", a: 0, k: 11, n: 36, amt: 400, v: 0.4, day: 0, m: "UPI", rem: "Wash", c: 0.83, src: "words", why: "narration says Wash; 36 small payments" }),
  g("DEMO AUTO PARTS | autoparts.demo@okdemo", { d: "out", a: 0, k: 12, n: 28, amt: 1800, v: 0.8, day: 0, m: "UPI", rem: "Parts", c: 0.81, src: "words", why: "narration says Parts" }),
  g("DEMO PROFESSIONAL TAX", { d: "out", a: 0, k: 32, n: 2, amt: 2500, day: 28, m: "RAW", rem: "PROF TAX", c: 0.9, src: "words", why: "narration says PROF TAX", m0: 2, span: 2 }),
  g("DEMO MARKETPLACE REFUND", { d: "in", a: 0, k: 46, n: 2, amt: 3200, v: 0.3, day: 0, m: "IMPS", rem: "REFUND", c: 0.6, src: "words", why: "narration says REFUND" }),
  g("DEMO GROCERS | groc.demo@okdemo", { d: "out", a: 0, k: 47, n: 8, amt: 2200, v: 0.5, day: 0, m: "UPI", rem: "Groceries", c: 0.52, src: "words", why: "grocery shop; looks personal" }),
  g("PARTNER DEMO CHEQUE", { d: "out", a: 0, k: 41, n: 3, amt: 50000, day: 0, m: "CHQ", rem: "", c: 0.7, src: "words", why: "cheques to the same person, round amounts" }),
];

function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const err = (status, code, message, fields) => new ApiError(status, code, message, fields);
const level = (c) => (c >= 0.85 ? "high" : c >= 0.6 ? "medium" : "low");
const ym = (s) => s.slice(0, 7);
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);

export function createBankStore({ now = () => "2026-10-17 11:00:00" } = {}) {
  const R = rng(20261017);
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const digits = (n) => Array.from({ length: n }, () => ri(0, 9)).join("");
  const kws = KEYWORD_ROWS.replace(/\n/g, "").split(";").map((r, i) => { const [group, name, link, dir, books] = r.split("|");
    return { id: i + 1, group, name, link, direction: dir === "-" ? null : dir, tally_ledger: null, hint: HINTS[i + 1] || null, words: WORDS[i + 1] || null, books, active: true, sort: i + 1 }; });
  const kwOf = (id) => kws.find((k) => k.id === id) || null;
  const parties = PARTIES.map(([name, type, kw], i) => ({ id: i + 1, name, type, keyword_id: kw, match: name.toUpperCase(), usual_amount: null, usual_day: null, notes: null, staff_id: null, active: true }));
  const partyOf = (id) => parties.find((p) => p.id === id) || null;
  const groups = new Map(), lines = [], rules = [], undoStack = [];
  let nextLine = 1, nextGroup = 1, nextRule = 1, nextAction = 1, nextKw = kws.length + 1, nextParty = parties.length + 1;
  const statements = [{ id: 1, label: "DemoBank-current-Apr-Sep.xls", account: ACCOUNTS[0].label, imported_by: "Demo owner", imported_at: "2026-10-01 10:15:00" },
    { id: 2, label: "SampleBank-OD-Apr-Sep.csv", account: ACCOUNTS[1].label, imported_by: "Demo owner", imported_at: "2026-10-01 10:22:00" },
    { id: 3, label: "DemoCoop-savings-Apr-Sep.xlsx", account: ACCOUNTS[2].label, imported_by: "Demo owner", imported_at: "2026-10-01 10:30:00" }];

  // ---------------------------------------------------------------- build the lines
  const made = {};
  const NAR = { UPI: (r, n, h, m) => `UPI/${r}/${n}/${h}/${m}`, NEFT: (r, n, h, m) => `NEFT-N${r.slice(0, 9)}-${n}-${m}`, IMPS: (r, n, h, m) => `IMPS/${r}/${n}/${m}`, RTGS: (r, n, h, m) => `RTGS-R${r.slice(0, 9)}-${n}-${m}`,
    CHQ: (r, n) => `CHQ PAID-50${r.slice(1, 5)}-${n}`, ATM: (r) => `ATM WDL-${r}-DEMO ATM ANDHERI`, NACH: (r, n) => `ACH D- ${n}-A${r.slice(1, 9)}`, RAW: (r, n, h, m) => `${n}${m ? " " + m : ""} ${r.slice(0, 6)}` };
  SPECS.forEach((s) => {
    const id = nextGroup++, [name, handle] = s.label.split(" | "), span = s.span || 6 - (s.m0 || 0), m0 = s.m0 || 0, base = [];
    for (let i = 0; i < s.n; i++) {
      const mi = m0 + (s.n >= span ? i % span : Math.floor((i * span) / s.n));
      const day = s.day ? Math.min(28, s.day + (s.rec ? ri(0, 2) : 0)) : ri(1, 28);
      const amt = Array.isArray(s.amt) ? s.amt[i] : s.v ? Math.max(1, Math.round((s.amt * (1 + (R() * 2 - 1) * s.v)) / (s.amt > 5000 ? 100 : s.amt > 200 ? 10 : 1)) * (s.amt > 5000 ? 100 : s.amt > 200 ? 10 : 1)) : s.amt;
      base.push({ date: `${MONTHS[Math.min(5, mi)]}-${String(day).padStart(2, "0")}`, amt });
    }
    const src = s.mir ? made[s.mir] : base;
    made[s.label] = src;
    const first = src.map((b) => b.date).sort()[0];
    const ls = src.map((b, i) => {
      const ref = "4" + digits(11);
      return { id: nextLine++, gid: id, date: b.date, acct: s.a, nar: NAR[s.m](ref, name, handle || "", s.rem), ref, dir: s.d, amt: b.amt, bal: 0, kw: null, car: null, party: null, st: "untagged", src: null, posted: null, sc: s.cars ? s.cars[i % s.cars.length] - 100 : null };
    });
    const rec = s.rec ? { amount: Array.isArray(s.amt) ? s.amt[0] : s.amt, day: s.day, months: Math.min(s.n, 6) } : null;
    groups.set(id, { id, label: s.label, dir: s.d, sug: s.k ? { k: s.k, c: s.c, why: s.why, src: s.src, p: s.p || null } : null, rec, split: 0, first });
    lines.push(...ls);
    if (s.pre) {                      // groups already tagged by a saved rule or by hand before the demo opens
      const key = (handle || s.label).toLowerCase();
      const upto = s.pre === "partial" ? Math.floor(ls.length / 2) : ls.length;
      ls.slice(0, upto).forEach((l) => Object.assign(l, { kw: s.k, party: s.p || null, car: s.cars && s.k !== 1 ? l.sc : null, st: s.pre === "partial" ? "tagged" : "auto", src: s.pre === "partial" ? "accept" : "rule" }));
      if (s.pre === "done") rules.push({ id: nextRule++, gid: id, match: key, keyword_id: s.k, party: s.p || null, created_by: "Demo owner", created_at: "2026-10-01 11:00:00" });
    }
  });
  START_BAL.forEach((start, a) => { let b = start; lines.filter((l) => l.acct === a).sort((x, y) => x.date.localeCompare(y.date) || x.id - y.id).forEach((l) => { b += l.dir === "in" ? l.amt : -l.amt; l.bal = b; }); });

  // ---------------------------------------------------------------- views
  const carRef = (id) => { const c = CARS.find((x) => x.id === id); return c ? { id: c.id, stock_no: c.stock_no } : null; };
  const partyRef = (id) => { const p = partyOf(id); return p ? { id: p.id, name: p.name } : null; };
  const inGroup = (id) => lines.filter((l) => l.gid === id);
  const isTagged = (l) => l.st !== "untagged";
  const sugOf = (g, l) => { if (!g.sug) return null; const k = kwOf(g.sug.k);
    return { keyword_id: k.id, keyword: k.name, confidence: g.sug.c, level: level(g.sug.c), reason: g.sug.why, car: l ? carRef(l.sc) : null, party: partyRef(g.sug.p) }; };
  function gv(g) {
    const ls = inGroup(g.id), tl = ls.filter(isTagged), dates = ls.map((l) => l.date).sort(), s = sugOf(g);
    const status = tl.length === 0 ? "todo" : tl.length === ls.length ? "done" : "partial";
    let tagged = null, needsCar = false;
    if (tl.length) {
      const ks = [...new Set(tl.map((l) => l.kw))], cs = [...new Set(tl.map((l) => l.car))], ps = [...new Set(tl.map((l) => l.party))], k = kwOf(ks[0]);
      tagged = { keyword_id: ks[0], keyword: k.name, car: cs.length === 1 ? carRef(cs[0]) : null, party: ps.length === 1 ? partyRef(ps[0]) : null, mixed: ks.length > 1 };
      needsCar = tl.some((l) => kwOf(l.kw).link === "car" && !l.car);
    }
    const rule = rules.find((r) => r.gid === g.id);
    if (s) { const cn = {}; ls.forEach((l) => { if (l.sc) cn[l.sc] = (cn[l.sc] || 0) + 1; });
      Object.assign(s, { group: kwOf(g.sug.k).group, link: kwOf(g.sug.k).link, source: g.sug.src, cars: Object.entries(cn).map(([id, n]) => ({ ...carRef(+id), n })), n: ls.length }); }
    return { id: g.id, label: g.label, direction: g.dir, n: ls.length, total: sum(ls, (l) => l.amt), first: dates[0], last: dates[dates.length - 1], months: new Set(ls.map((l) => ym(l.date))).size,
      accounts: [...new Set(ls.map((l) => ACCOUNTS[l.acct].label))], sample: ls.slice().sort((a, b) => a.date.localeCompare(b.date))[0].nar, recurring: g.rec, status, tagged_n: tl.length, tagged, needs_car: needsCar,
      suggestion: s, rule: rule ? { id: rule.id } : null, split: g.split };
  }
  function lineView(l) { const g = groups.get(l.gid), k = l.kw ? kwOf(l.kw) : null;
    return { id: l.id, date: l.date, account: ACCOUNTS[l.acct].label, narration: l.nar, reference: l.ref, direction: l.dir, amount: l.amt, balance: l.bal, keyword_id: l.kw, keyword: k ? k.name : null, car: carRef(l.car), party: partyRef(l.party),
      status: l.st, source: l.src, posted: l.posted, suggestion: sugOf(g, l) }; }
  const summary = () => {
    const gs = [...groups.values()].filter((g) => inGroup(g.id).length).map(gv), tagged = lines.filter(isTagged).length;
    return { total: lines.length, tagged, auto: lines.filter((l) => l.st === "auto").length, untagged: lines.length - tagged,
      groups: { total: gs.length, done: gs.filter((x) => x.status === "done").length, todo: gs.filter((x) => x.status !== "done").length, high: gs.filter((x) => x.status !== "done" && x.suggestion && x.suggestion.level === "high").length, needs_car: gs.filter((x) => x.needs_car).length },
      accounts: ACCOUNTS.map((a) => ({ ...a, lines: lines.filter((l) => l.acct === a.id - 1).length })), statements: statements.length, date_from: "2026-04-01", date_to: "2026-09-30",
      quick: QUICK.map((id, i) => ({ key: String(i + 1), keyword_id: id, name: kwOf(id).name })),
      last_action: undoStack.length ? { id: undoStack[undoStack.length - 1].id, kind: "action", label: undoStack[undoStack.length - 1].label, ts: now() } : null,
      ai: { enabled: false, can_switch: true }, can: { post: true, add_accounts: true, ai: false } };
  };
  function groupList(q) {
    const term = String(q.q || "").trim().toLowerCase(), size = Math.max(1, +q.page_size || 50), page = Math.max(1, +q.page || 1);
    const all = [...groups.values()].filter((g) => {
      const ls = inGroup(g.id);
      return ls.length && (!q.direction || g.dir === q.direction) && (!q.account_id || ls.some((l) => l.acct + 1 === +q.account_id)) && (!term || g.label.toLowerCase().includes(term) || ls.some((l) => l.nar.toLowerCase().includes(term)));
    }).map(gv);
    const counts = { todo: all.filter((x) => x.status !== "done").length, high: all.filter((x) => x.status !== "done" && x.suggestion && x.suggestion.level === "high").length, done: all.filter((x) => x.status === "done").length, all: all.length, needs_car: all.filter((x) => x.needs_car).length };
    const view = q.view || "todo", pick = { todo: (x) => x.status !== "done", high: (x) => x.status !== "done" && x.suggestion && x.suggestion.level === "high", done: (x) => x.status === "done", needs_car: (x) => x.needs_car, all: () => true }[view] || (() => true);
    const rows = all.filter(pick).sort((a, b) => b.total - a.total || a.id - b.id);
    return { data: rows.slice((page - 1) * size, page * size), page, page_size: size, total: rows.length, counts };
  }

  // ---------------------------------------------------------------- actions (each one can be undone)
  const newEntry = (label) => ({ id: nextAction++, label, snaps: new Map(), rules: [], split: null });
  const snap = (e, l) => { if (!e.snaps.has(l.id)) e.snaps.set(l.id, { st: l.st, kw: l.kw, car: l.car, party: l.party, src: l.src, posted: l.posted }); };
  function tagLines(e, ls, kw, car, party, src) { ls.forEach((l) => { snap(e, l); Object.assign(l, { kw: kw || null, car: kw ? car(l) : null, party: kw ? party(l) : null, st: kw ? "tagged" : "untagged", src: kw ? src : null }); }); }
  function acceptGroup(e, g, body, rule) {
    const ls = inGroup(g.id), keyword = body.keyword_id || (g.sug && g.sug.k);
    if (!keyword || !kwOf(keyword)) throw err(400, "no_suggestion", "This group has no suggestion yet. Choose a keyword.");
    const own = !body.keyword_id || body.keyword_id === (g.sug && g.sug.k);
    const target = body.line_ids ? ls.filter((l) => body.line_ids.includes(l.id)) : body.keyword_id ? ls : ls.filter((l) => !isTagged(l));
    tagLines(e, target, keyword, (l) => ("car_id" in body ? body.car_id : own ? l.sc : null), (l) => ("party_id" in body ? body.party_id : own && g.sug ? g.sug.p : null), "accept");
    if (!rule) return { n: target.length, rule: null };
    const key = (g.label.split(" | ")[1] || g.label).toLowerCase(), old = rules.find((r) => r.gid === g.id);
    if (old) { e.rules.push({ id: old.id, prev: { ...old } }); Object.assign(old, { keyword_id: keyword, party: "party_id" in body ? body.party_id : old.party }); return { n: target.length, rule: old.id }; }
    const r = { id: nextRule++, gid: g.id, match: key, keyword_id: keyword, party: "party_id" in body ? body.party_id : g.sug ? g.sug.p : null, created_by: "Demo owner", created_at: now() };
    rules.push(r); e.rules.push({ id: r.id, created: true });
    return { n: target.length, rule: r.id };
  }
  const commit = (e) => { undoStack.push(e); return e.id; };
  function revert(e) {
    e.snaps.forEach((s, id) => Object.assign(lines.find((l) => l.id === id), s));
    e.rules.forEach((r) => { if (r.created) rules.splice(rules.findIndex((x) => x.id === r.id), 1); else Object.assign(rules.find((x) => x.id === r.id), r.prev); });
    if (e.split) { e.split.ids.forEach((id) => { lines.find((l) => l.id === id).gid = e.split.from; }); groups.delete(e.split.gid); }
  }

  // ---------------------------------------------------------------- reports and the books
  const bucket = (l) => { const k = l.kw && kwOf(l.kw); if (!k) return null; if (!k.books) return k.link === "car" ? "link" : "tags_only"; const t = k.books.split(":")[0];
    return { expense: "expense", ledger: "ledger", car_cost: "car_cost", deal: "deal_payment", contra: "contra" }[t]; };
  const blocked = (l) => (bucket(l) === "car_cost" || bucket(l) === "deal_payment") && !l.car;
  function reports(q) {
    const from = q.from || MONTHS[0], to = q.to || MONTHS[5], months = MONTHS.filter((m) => m >= from && m <= to);
    const ls = lines.filter((l) => months.includes(ym(l.date)) && (!q.account_id || l.acct + 1 === +q.account_id)), tl = ls.filter((l) => isTagged(l) && l.kw);
    const by_keyword = kws.filter((k) => tl.some((l) => l.kw === k.id)).map((k) => { const mine = tl.filter((l) => l.kw === k.id), io = (d) => Object.fromEntries(months.map((m) => [m, sum(mine.filter((l) => l.dir === d && ym(l.date) === m), (l) => l.amt)]));
      return { keyword_id: k.id, keyword: k.name, group: k.group, in: io("in"), out: io("out"), total_in: sum(mine.filter((l) => l.dir === "in"), (l) => l.amt), total_out: sum(mine.filter((l) => l.dir === "out"), (l) => l.amt), lines: mine.length }; });
    const cars = CARS.filter((c) => tl.some((l) => l.car === c.id)).map((c) => { const mine = tl.filter((l) => l.car === c.id), grp = (n) => sum(mine.filter((l) => kwOf(l.kw).group === n), (l) => l.amt);
      const purchase = grp("Car buying"), costs = grp("Car costs"), sale = grp("Car selling"); return { car_id: c.id, stock_no: c.stock_no, name: c.name, purchase, costs, sale, net: sale - purchase - costs, lines: mine.length }; });
    const salary = parties.filter((p) => tl.some((l) => l.kw === 16 && l.party === p.id)).map((p) => { const mine = tl.filter((l) => l.kw === 16 && l.party === p.id);
      return { party_id: p.id, name: p.name, months: Object.fromEntries(months.map((m) => [m, sum(mine.filter((l) => ym(l.date) === m), (l) => l.amt)])), total: sum(mine, (l) => l.amt) }; });
    const investors = parties.filter((p) => tl.some((l) => [39, 40, 42].includes(l.kw) && l.party === p.id)).map((p) => { const mine = tl.filter((l) => [39, 40, 42].includes(l.kw) && l.party === p.id), i = sum(mine.filter((l) => l.dir === "in"), (l) => l.amt), o = sum(mine.filter((l) => l.dir === "out"), (l) => l.amt);
      return { party_id: p.id, name: p.name, type: p.type, in: i, out: o, net: i - o }; });
    const un = ls.filter((l) => !isTagged(l));
    return { months, by_keyword, cars, salary, investors, untagged: { lines: un.length, in: sum(un.filter((l) => l.dir === "in"), (l) => l.amt), out: sum(un.filter((l) => l.dir === "out"), (l) => l.amt) },
      totals: { in: sum(ls.filter((l) => l.dir === "in"), (l) => l.amt), out: sum(ls.filter((l) => l.dir === "out"), (l) => l.amt) } };
  }
  function postPreview() {
    const out = Object.fromEntries(["expense", "ledger", "car_cost", "deal_payment", "contra", "link", "tags_only", "already"].map((k) => [k, { lines: 0, amount: 0 }])), bl = { lines: 0, amount: 0, why: "link a car first" };
    lines.filter((l) => l.kw).forEach((l) => { const b = l.posted ? "already" : blocked(l) ? null : bucket(l); const t = b ? out[b] : bl; t.lines++; t.amount += l.amt; });
    return { ...out, blocked: bl };
  }

  // ---------------------------------------------------------------- the router
  const needBody = (cond, field, msg) => { if (!cond) throw err(400, "invalid", msg, { [field]: "required" }); };
  const keywordRow = (k) => ({ ...k, books_label: BOOKS_LABEL(k.books), lines: lines.filter((l) => l.kw === k.id).length, rules: rules.filter((r) => r.keyword_id === k.id).length });
  function keywordFields(k, b) {
    const name = String(b.name ?? k.name).trim();
    needBody(name, "name", "Give the keyword a name.");
    if (kws.some((x) => x.id !== k.id && x.name.toLowerCase() === name.toLowerCase())) throw err(400, "invalid", "A keyword with this name already exists.", { name: "A keyword with this name already exists." });
    Object.assign(k, { name, group: b.group || k.group, link: b.link || k.link, direction: "direction" in b ? b.direction || null : k.direction, tally_ledger: "tally_ledger" in b ? b.tally_ledger || null : k.tally_ledger,
      hint: "hint" in b ? b.hint || null : k.hint, words: "words" in b ? b.words || null : k.words, books: "books" in b ? b.books || "" : k.books, active: "active" in b ? !!b.active : k.active });
  }
  const demoOff = (what) => err(403, "demo", `Demo: ${what} is off in the demo.`);
  const bookOpts = [...new Set(kws.map((k) => k.books))].map((b) => [b, BOOKS_LABEL(b)]);
  const partyRow = (p) => { const ls = lines.filter((l) => l.party === p.id && isTagged(l)); return { ...p, keyword: p.keyword_id ? kwOf(p.keyword_id).name : null, lines: ls.length, total_in: sum(ls.filter((l) => l.dir === "in"), (l) => l.amt), total_out: sum(ls.filter((l) => l.dir === "out"), (l) => l.amt) }; };

  function get(path, q = {}) {
    const p = path.replace(/^banktag\/?/, ""); let m;
    if (p === "summary") return summary();
    if (p === "groups") return groupList(q);
    if ((m = p.match(/^groups\/(\d+)\/lines$/))) { const g = groups.get(+m[1]); if (!g) throw err(404, "not_found", "That group was not found."); return { group: gv(g), data: inGroup(g.id).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(lineView) }; }
    if (p === "accounts") return { data: ACCOUNTS.map((a) => ({ ...a, lines: lines.filter((l) => l.acct === a.id - 1).length, last_date: "2026-09-30" })), can_add: true };
    if (p === "statements") return { data: statements.map((s) => ({ ...s, lines: lines.filter((l) => ACCOUNTS[l.acct].label === s.account).length, date_from: "2026-04-01", date_to: "2026-09-30" })) };
    if (p === "keywords") return { data: kws.map(keywordRow), groups: [...new Set(kws.map((k) => k.group))], books_options: bookOpts };
    if (p === "parties") return { data: parties.map(partyRow), types: PARTY_TYPES };
    if (p === "rules") return { data: rules.map((r) => { const g = groups.get(r.gid); return { id: r.id, match: r.match, label: g.label, direction: g.dir, keyword_id: r.keyword_id, keyword: kwOf(r.keyword_id).name, party: partyRef(r.party), created_by: r.created_by, created_at: r.created_at, hits: inGroup(r.gid).filter(isTagged).length, last_hit_at: r.created_at }; }) };
    if (p === "cars") { const t = String(q.q || "").toLowerCase(); return { data: CARS.filter((c) => !t || c.stock_no.toLowerCase().includes(t) || c.name.toLowerCase().includes(t)).slice(0, 30) }; }
    if (p === "reports") return reports(q);
    if (p === "post-preview") return postPreview();
    if (p === "settings") return { ai: false, can_switch: true, ai_groups_day: 300, ai_used_today: 0, ai_note: AI_NOTE };
    if (p === "ai") return { jobs: [], used_today: 0, cap: 300 };
    throw err(404, "not_found", "Not part of the sample data.");
  }

  function send(method, path, b = {}) {
    const p = path.replace(/^banktag\/?/, ""); let m;
    if ((m = p.match(/^groups\/(\d+)\/accept$/))) {
      const g = groups.get(+m[1]); if (!g) throw err(404, "not_found", "That group was not found.");
      const e = newEntry(""), r = acceptGroup(e, g, b, b.save_rule !== false), k = kwOf(b.keyword_id || g.sug.k);
      e.label = `Accepted ${k.name} for ${r.n} lines`;
      return { ok: true, lines: r.n, rule_id: r.rule, action_id: commit(e), group: gv(g), summary: summary() };
    }
    if (p === "accept-high") {
      const min = b.min || 0.85, e = newEntry(""); let gn = 0, ln = 0, rn = 0;
      [...groups.values()].forEach((g) => { if (g.sug && g.sug.c >= min && inGroup(g.id).some((l) => !isTagged(l))) { const r = acceptGroup(e, g, {}, true); gn++; ln += r.n; if (r.rule) rn++; } });
      e.label = `Accepted ${gn} high-confidence groups (${ln} lines)`;
      return { ok: true, groups: gn, lines: ln, rules: rn, action_id: commit(e), summary: summary() };
    }
    if ((m = p.match(/^lines\/(\d+)$/)) && method === "POST") {
      const l = lines.find((x) => x.id === +m[1]); if (!l) throw err(404, "not_found", "That line was not found.");
      const e = newEntry(b.keyword_id ? `Tagged one line as ${kwOf(b.keyword_id).name}` : "Cleared the tag on one line");
      tagLines(e, [l], b.keyword_id, () => b.car_id || null, () => b.party_id || null, "manual");
      return { ok: true, line: lineView(l), action_id: commit(e), summary: summary() };
    }
    if ((m = p.match(/^lines\/(\d+)\/unpost$/))) { lines.find((x) => x.id === +m[1]).posted = null; return { ok: true }; }
    if ((m = p.match(/^groups\/(\d+)\/split$/))) {
      const g = groups.get(+m[1]), ids = (b.line_ids || []).filter((id) => lines.some((l) => l.id === id && l.gid === g.id));
      if (!ids.length || ids.length >= inGroup(g.id).length) throw err(400, "invalid", "Choose some of the lines, but not all of them.");
      const ng = { ...g, id: nextGroup++, label: `${g.label} (split)`, rec: null, split: 1 }, e = newEntry(`Split ${ids.length} lines out of ${g.label}`);
      groups.set(ng.id, ng); ids.forEach((id) => { lines.find((l) => l.id === id).gid = ng.id; }); e.split = { gid: ng.id, from: g.id, ids };
      return { ok: true, group: gv(ng), from: gv(g), action_id: commit(e) };
    }
    if (p === "undo") {
      const e = undoStack.pop(); if (!e) throw err(409, "nothing_to_undo", "There is nothing to undo.");
      revert(e); return { ok: true, undone: { id: e.id, label: e.label }, lines: e.snaps.size, summary: summary() };
    }
    if (p === "resuggest") return { ok: true, lines: lines.filter((l) => !isTagged(l)).length };
    if (p === "keywords" && method === "POST") { const k = { id: nextKw++, group: "Other", link: "none", direction: null, tally_ledger: null, hint: null, words: null, books: "", active: true, sort: nextKw }; keywordFields(k, b); kws.push(k); return { id: k.id }; }
    if ((m = p.match(/^keywords\/(\d+)\/merge$/))) {
      const k = kwOf(+m[1]), into = kwOf(b.into); if (!k || !into || k === into) throw err(400, "invalid", "Choose a different keyword to merge into.");
      let ml = 0, mr = 0; lines.forEach((l) => { if (l.kw === k.id) { l.kw = into.id; ml++; } }); rules.forEach((r) => { if (r.keyword_id === k.id) { r.keyword_id = into.id; mr++; } });
      groups.forEach((g) => { if (g.sug && g.sug.k === k.id) g.sug.k = into.id; }); kws.splice(kws.indexOf(k), 1); return { ok: true, moved_lines: ml, moved_rules: mr };
    }
    if ((m = p.match(/^keywords\/(\d+)$/))) {
      const k = kwOf(+m[1]); if (!k) throw err(404, "not_found", "That keyword was not found.");
      if (method === "PATCH") { keywordFields(k, b); return keywordRow(k); }
      const nl = lines.filter((l) => l.kw === k.id).length, nr = rules.filter((r) => r.keyword_id === k.id).length;
      if (nl || nr) throw err(409, "in_use", `${k.name} is used by ${nl} lines and ${nr} rules. Merge it into another keyword instead.`);
      kws.splice(kws.indexOf(k), 1); return { ok: true };
    }
    if (p === "parties" && method === "POST") { needBody(String(b.name || "").trim(), "name", "Enter a name."); const x = { id: nextParty++, name: String(b.name).trim(), type: b.type || "Other", keyword_id: b.keyword_id || null, match: b.match || String(b.name).toUpperCase(), usual_amount: b.usual_amount || null, usual_day: b.usual_day || null, notes: b.notes || null, staff_id: null, active: true }; parties.push(x); return { id: x.id }; }
    if ((m = p.match(/^parties\/(\d+)$/))) {
      const x = partyOf(+m[1]); if (!x) throw err(404, "not_found", "That person was not found.");
      if (method === "DELETE") { x.active = false; return { ok: true }; }
      if ("name" in b) needBody(String(b.name || "").trim(), "name", "Enter a name.");
      Object.assign(x, b); return partyRow(x);
    }
    if ((m = p.match(/^rules\/(\d+)$/))) { const i = rules.findIndex((r) => r.id === +m[1]); if (i < 0) throw err(404, "not_found", "That rule was not found."); rules.splice(i, 1); return { ok: true }; }
    if (p === "post") {
      const out = { expense: 0, ledger: 0, car_cost: 0, deal_payment: 0, contra: 0, link: 0, skipped: 0 };
      lines.filter((l) => l.kw && !l.posted).forEach((l) => { const bk = bucket(l); if (blocked(l)) out.skipped++; else if (out[bk] !== undefined) { out[bk]++; l.posted = bk; } else l.posted = null; });
      return { ok: true, ...out };
    }
    if (p === "settings" || p === "ai") throw demoOff("the AI switch");
    throw err(404, "not_found", "Not part of the sample data.");
  }

  function upload(path, fd) {
    const p = path.replace(/^banktag\/?/, ""), file = fd.get("file"), name = (file && file.name) || "statement.xls";
    if (!file) throw err(400, "unreadable", "Choose a file first.");
    if (p === "workbook") return { ok: true, keywords: { added: 0, updated: kws.length }, parties: { added: 0, updated: parties.length }, accounts: { matched: ACCOUNTS.length, added: 0, need_adding: [] }, resuggested: lines.filter((l) => !isTagged(l)).length, demo_note: "Demo: the file is not read. These numbers are made up." };
    if (p !== "statements") throw err(404, "not_found", "Not part of the sample data.");
    const ext = (name.split(".").pop() || "").toLowerCase(), acct = ACCOUNTS[Math.max(0, +fd.get("bank_account_id") - 1)] || ACCOUNTS[0];
    if (!["xlsx", "xls", "csv", "pdf"].includes(ext)) throw err(400, "unreadable", "This file could not be read. Use an Excel, CSV or PDF statement.");
    if (ext === "pdf" && /scan/i.test(name)) throw err(400, "scanned_pdf", "This PDF is a scanned image with no text in it. Please download the statement as Excel or CSV from net banking.");
    const dry = fd.get("dry_run") === "1", id = dry ? null : statements.length + 1;
    if (!dry) statements.push({ id, label: name, account: acct.label, imported_by: "Demo owner", imported_at: now() });
    return { ok: true, dry_run: dry, statement_id: id, file: name, bank: acct.bank, format: ext, rows: 412, lines: 405, new: 405, duplicates: 0, skipped: 7, date_from: "2026-04-01", date_to: "2026-09-30",
      columns: { date: "Date", narration: "Narration", reference: "Chq./Ref.No.", debit: "Withdrawal Amt.", credit: "Deposit Amt.", balance: "Closing Balance" }, account_hint: acct.last4, account_mismatch: /mismatch/i.test(name),
      auto_tagged: 260, suggested: 120, groups: 38, preview: lines.slice(0, 5).map((l) => ({ date: l.date, narration: l.nar, direction: l.dir, amount: l.amt })),
      demo_note: "Demo: the file is not read and nothing is added. These numbers are made up." };
  }
  return { get, send, upload };
}
