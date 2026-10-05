// Plain-English names for capabilities, and the column groups of the access matrix.
// The server owns the real list (GET admin/capabilities); this is only how the screen talks about it.

export const CAP_TEXT = {
  "today.view": ["See the Today page", "Test drives, follow-ups, deliveries and alerts for the day."],
  "records.all": ["See everyone's leads and deals", "Without this a salesman sees only his own."],
  "stock.view": ["See stock and car files", "No purchase price or costs."],
  "stock.manage": ["Add and edit cars", "Status, asking price, workshop jobs and Park-N-Sell terms."],
  "deals.view": ["See deals and bookings", ""],
  "deals.create": ["Book a car", "Records the token and the buyer."],
  "deals.manage": ["Edit and deliver deals", "Payments, finance, insurance, add-ons, cancellations."],
  "leads.view": ["See leads and enquiry figures", ""],
  "team.view": ["See the salesman leaderboard", ""],
  "customers.view": ["See the people register", "Names and contact details."],
  "customers.manage": ["Add and edit people", "History, returning customers, cross-sell."],
  "rto.view": ["See RTO cases", ""],
  "rto.manage": ["Move RTO cases and tick checklists", ""],
  "activity.use": ["Test drives, follow-ups and feedback feed", ""],
  "feedback.manage": ["Add and resolve feedback", ""],
  "marketing.view": ["See Instagram, website and channel figures", "No ad spend."],
  "marketing.manage": ["Enter follower and website figures", ""],
  "documents.view": ["Open car and deal papers", ""],
  "documents.delete": ["Delete documents", "They are hidden, not erased."],
  "sheets.view": ["Open spreadsheets", ""],
  "sheets.manage": ["Create and edit custom sheets", ""],
  "exports.ops": ["Export stock, RTO, leads and feedback", "Leads leave without phone numbers."],
  "approvals.request": ["Ask the manager for an OK", "Price changes, discounts, test drives and holds."],
  "approvals.manage": ["Approve or reject requests", "Approving a price change sets the new asking price."],
  "users.manage": ["Create users and reset passwords", "Managers and salesmen only, unless the owner does it."],
  "settings.manage": ["Change settings and staff", "Rates, thresholds, lead-engine names."],
  "audit.view": ["Read the audit log", "Money details in it stay hidden without money access."],
  "documents.sensitive": ["See PAN, Aadhaar and KYC papers", "And bank papers, when they also see the bank file."],
  "customers.pii": ["See full PAN and run privacy requests", ""],
  "exports.pii": ["Export people and leads with phone numbers", ""],
  "money.view": ["See profit, margins and purchase prices", "Every rupee figure that shows what the firm earns."],
  "deals.profit.view": ["See profit on each deal and salesman", "A smaller step than full money access."],
  "accounts.view": ["See the cashbook, ledger, GST and TCS", "Receivables and payables too."],
  "accounts.manage": ["Edit the ledger and reconcile the bank statement", ""],
  "expenses.view": ["See business expenses and budgets", ""],
  "expenses.manage": ["Enter and edit expenses", "Receipts, vendors, recurring bills."],
  "expenses.approve": ["Approve or reject expenses", "Only approved expenses reach the profit figure."],
  "bank.view": ["See bank accounts, loans and banker contacts", "Numbers stay masked."],
  "bank.reveal": ["Unmask an account number or contact", "Asks for password and code again, and is logged."],
  "bank.manage": ["Add and edit bank accounts, loans and bankers", ""],
  "exports.money": ["Export money data", "Deals, payments, costs, expenses, ledger and P&L."],
  "grants.financial": ["Give other people money access", "Only the super-admin can give this."],
};

/** What opening a guarded capability means in practice, in the words the owner reads when he is asked to confirm. */
export const CAP_OPENS = {
  "money.view": { opens: ["Profit and loss", "the Profit overview"], sees: ["margin and purchase price on every car", "revenue, gross profit and net profit"] },
  "deals.profit.view": { opens: [], sees: ["profit on each deal and per salesman"] },
  "accounts.view": { opens: ["Accounts"], sees: ["the cashbook, ledger, GST and TCS", "what customers owe and what the firm owes"] },
  "accounts.manage": { opens: [], sees: [], does: ["edit the ledger", "import and reconcile bank statements", "tag receipts to a bank account"] },
  "expenses.view": { opens: ["Expenses"], sees: ["every business expense, budget and vendor"] },
  "expenses.manage": { opens: [], sees: [], does: ["enter and edit expenses, receipts and vendors"] },
  "expenses.approve": { opens: [], sees: [], does: ["approve or reject expenses, which decides what reaches profit"] },
  "bank.view": { opens: ["Bank and finance"], sees: ["bank accounts (masked), loans and banker contacts"] },
  "bank.reveal": { opens: [], sees: [], does: ["unmask a full account number or banker contact, after password and code"] },
  "bank.manage": { opens: [], sees: [], does: ["add and edit bank accounts, loans and bankers"] },
  "exports.money": { opens: [], sees: [], does: ["download deals, payments, expenses, ledger and P&L as files"] },
  "grants.financial": { opens: [], sees: [], does: ["give other people money and personal-data access"] },
  "documents.sensitive": { opens: [], sees: ["PAN, Aadhaar and other KYC papers"] },
  "customers.pii": { opens: [], sees: ["full PAN numbers (after password and code) and privacy requests"] },
  "exports.pii": { opens: [], sees: [], does: ["download people and leads with phone numbers"] },
};

/** Columns of the access matrix. tone: ops | sensitive | money | admin. */
export const GROUPS = [
  { id: "stock", label: "Stock", short: "Stock", opens: ["stock.view"], tone: "ops", about: "Can see and edit cars", caps: ["stock.view", "stock.manage"], tag: "Cars and prices" },
  { id: "deals", label: "Deals", short: "Deals", opens: ["deals.view"], tone: "ops", about: "Can book, edit and deliver deals", caps: ["deals.view", "deals.create", "deals.manage", "approvals.request", "approvals.manage"], tag: "Book and deliver" },
  { id: "leads", label: "Leads and team", short: "Leads", opens: ["leads.view", "team.view"], tone: "ops", about: "Can see everyone's leads and the leaderboard", caps: ["leads.view", "team.view", "records.all"], tag: "All leads" },
  { id: "people", label: "Customers", short: "People", opens: ["customers.view"], tone: "ops", about: "Can see and edit the people register", caps: ["customers.view", "customers.manage"], tag: "People register" },
  { id: "papers", label: "RTO and papers", short: "RTO", opens: ["rto.view", "documents.view"], tone: "ops", about: "Can run RTO cases and open car papers", caps: ["rto.view", "rto.manage", "documents.view", "documents.delete"], tag: "Transfers, papers" },
  { id: "work", label: "Marketing and sheets", short: "Tools", opens: ["marketing.view", "sheets.view", "today.view", "activity.use"], tone: "ops", about: "Can see marketing figures and use sheets", caps: ["marketing.view", "marketing.manage", "sheets.view", "sheets.manage", "today.view", "activity.use", "feedback.manage", "exports.ops"], tag: "Day-to-day tools" },
  { id: "pii", label: "Personal data", short: "Personal", opens: ["documents.sensitive", "customers.pii", "exports.pii"], tone: "sensitive", about: "Can see PAN, Aadhaar and phone exports", caps: ["documents.sensitive", "customers.pii", "exports.pii"], tag: "PAN, KYC, phones" },
  { id: "profit", label: "Profit", short: "Profit", opens: ["money.view", "deals.profit.view"], tone: "money", about: "Can see profit, margins and purchase prices", caps: ["money.view", "deals.profit.view", "exports.money"], tag: "Margins, P&L" },
  { id: "accounts", label: "Accounts", short: "Accounts", opens: ["accounts.view"], tone: "money", about: "Can see the cashbook, ledger, GST and TCS", caps: ["accounts.view", "accounts.manage"], tag: "Cashbook, GST" },
  { id: "expenses", label: "Expenses", short: "Expenses", opens: ["expenses.view"], tone: "money", about: "Can see, enter and approve expenses", caps: ["expenses.view", "expenses.manage", "expenses.approve"], tag: "Bills, approvals" },
  { id: "bank", label: "Bank", short: "Bank", opens: ["bank.view"], tone: "money", about: "Can see bank details and loans", caps: ["bank.view", "bank.reveal", "bank.manage"], tag: "Accounts, loans" },
  { id: "pass", label: "Can give money access", short: "Hands on", opens: ["grants.financial"], tone: "money", about: "Can hand money access to others", caps: ["grants.financial"], tag: "Hand on money access" },
  { id: "admin", label: "Admin", short: "Admin", opens: ["users.manage", "settings.manage", "audit.view"], tone: "admin", about: "Can manage users, settings and read the audit log", caps: ["users.manage", "settings.manage", "audit.view"], tag: "Users, settings, log" },
];

/** A group is "open" for a person only when they hold a capability that opens its page. Holding bank.reveal alone opens nothing. */
export const opensGroup = (g, held) => g.opens.some((c) => held.has(c));
/** What each role starts with, for the preview when adding a person or changing a role. */
export const PERSONAL_DATA = ["customers.view", "customers.manage", "documents.sensitive", "customers.pii", "exports.pii"];

export const capName = (k) => (CAP_TEXT[k] ? CAP_TEXT[k][0] : k);
export const capNote = (k) => (CAP_TEXT[k] ? CAP_TEXT[k][1] : "");

export const ROLE_PLAIN = {
  owner: "Runs operations. No money access unless the owner gives it.",
  manager: "Runs the floor: stock, deals, leads, RTO. No money.",
  salesman: "Sees only his own leads, deals and customers.",
  accountant: "Books and expenses once enrolled in two-factor. No customer register.",
  admin: "Keeps the system running. No money and no customer register.",
};

/** What the audit log's action codes mean to a person. */
export const ACTION_TEXT = {
  "auth.login": "Signed in", "auth.login_failed": "Failed sign-in", "auth.logout": "Signed out", "auth.locked": "Account locked after wrong passwords",
  "auth.reauth": "Confirmed password and code again", "auth.reauth_failed": "Wrong password or code on a re-check",
  "auth.totp_setup": "Started two-factor setup", "auth.totp_enrolled": "Turned two-factor on", "auth.totp_confirm_failed": "Wrong two-factor code during setup",
  "bank.reveal": "Unmasked a bank detail", "access.grant": "Gave someone access", "access.revoke": "Took access away",
  "record.create": "Added a record", "record.update": "Edited a record", "record.delete": "Deleted a record",
  "doc.upload": "Uploaded a document", "doc.view": "Opened a document", "doc.download": "Downloaded a document", "doc.delete": "Deleted a document",
  "doc.rate_limited": "Too many downloads, stopped", "expense.approve": "Approved an expense", "expense.reject": "Rejected an expense",
  "approval.request": "Asked for an approval", "approval.approve": "Approved a request", "approval.reject": "Rejected a request",
  "pii.reveal_pan": "Revealed a full PAN", "pii.reveal_pan_limit": "Hit the hourly limit on PAN reveals", "session.revoke": "Ended someone's session", "settings.update": "Changed settings",
  "sync.error": "Lead engine sync failed", "user.create": "Created a user", "user.reset_password": "Reset a password", "user.reset_totp": "Reset two-factor", "user.update": "Changed a user",
};
export function actionText(a) {
  if (ACTION_TEXT[a]) return ACTION_TEXT[a];
  if (a.startsWith("view.")) return "Opened " + a.slice(5).replace(/_/g, " ");
  if (a.startsWith("export")) return "Exported data";
  return a.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase());
}
