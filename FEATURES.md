# CSR Fund Manager — Feature & Behaviour Spec

**Purpose of this document.** The website (React + Vite) and the Android app (React Native) share **one backend and one MongoDB database**. The website is the source of truth for behaviour. This document describes what the system does *today*, so the app can be built to match it exactly. Where the app currently differs, it is called out as **[APP TODO]**.

- Backend: Express + Mongoose on Render — `https://csr-manager.onrender.com`, base path `/api`.
- Database: MongoDB Atlas, `csr_manager`. **No automated backups** (free M0 tier) — never run a destructive script against it without dumping first.
- Auth: JWT.

---

## 1. Data model

Seven collections. Anything an app screen shows is either one of these fields or is derived from them at read time — **no totals, balances, or "spent" figures are stored**.

### Company
`name` (required) · `cin` · `pan` · `contactPerson` · `email` · `phone` · `address` · `notes`

- **`pan`** — the company's Permanent Account Number. Optional, but when supplied it must match `[A-Z]{5}[0-9]{4}[A-Z]` (e.g. `AAACT2727Q`) or the write is rejected with a 422. Stored uppercase. Shown as a column on the Companies list and on Company Detail. **[APP TODO]** — add PAN to the company form, list and detail.

### FinancialYear
`name` ("FY 2025-26") · `startDate` · `endDate` · `isActive`

Dates are ISO `yyyy-mm-dd` strings and are compared as strings. **More than one year can be active at the same time** — this is intentional, not a bug.

### Project
`name` (required) · `projectCode` · `companyIds[]` · `budget` · `category` · `location` · `interventionPartner` · `status` · `derivedStatus` · `startDate` (required) · `endDate` · `financialYearId` · `description` · `notes`

- **`projectCode` is the Project ID** shown wherever a project is referenced (lists, expenditures, receipts, reports, exports): the first 4 letters of the name + the start year of its financial year, e.g. `RURA2025`. Two projects can never share one — a clash gets `-2`, `-3`. **Never sent by the client**; the server issues it, exactly like `endDate` and `financialYearId`. It is stable across renames, and is only re-issued if the project's financial year changes. Everything still links by `_id`, never by code. **[APP TODO]** — show the Project ID everywhere a project appears; never let the user type it.
- **`interventionPartner`** — free text: the implementing agency/NGO delivering the project, when it isn't run directly. Editable, optional. Each expenditure records whether that spend went Direct or through this partner. **[APP TODO]** — add the field to the project form and detail.
- A project is funded by **one or more companies**.
- **`financialYearId`** is the financial year the project belongs to. It is **not entered by the user** — the server sets it automatically to the FY the **start date** falls into (the same FY used to derive `endDate`). Read-only; shown auto-filled on the form. **[APP TODO]** — show a read-only "Financial Year" field on the Project form and a "FY" line in the list/detail; never let the user type it.
- **`companyIds`** is just the list of funding companies. The server dedupes it on every write; there is no per-company pledged amount anywhere in the system.
- **`budget`** is the project's *approved cost*, entered by the user.
- `status` — `active` | `completed` | `on_hold` | `cancelled`
- `derivedStatus` — `ongoing` | `other` (shown as "Ongoing" / "Other than Ongoing")

### FundReceipt (money in)
`date` (required) · `receiptType` · `companyId` (required) · `source` · `financialYearId` (required) · `projectId` · `reference` · `amount` (required) · `notes` · `mode`, `carryForward` *(legacy)*

- **`receiptType`** — `company` (a donor company's direct contribution) or `other_source` (income *earned on* that company's funds — Interest, SIP, FD…, picked from Master Data).
- **`companyId` is required for both types.** Money always arrives on behalf of some company. **[APP TODO]** — the app must not offer a "no company" option.
- `projectId` is **optional** — money can be received before it is allocated to a project.
- `reference` is labelled **"Account Number"** in the UI (the field name stays `reference` to avoid a data migration). Each receipt carries its own account number — companies do not share one.
- A receipt can carry up to **5 proof documents** (photo / PDF / doc / CSV, 8 MB each) — optional. See §8.
- `mode` (NEFT/RTGS/Cheque) and `carryForward` are **legacy**: still read for historical records, never collected on the form. **[APP TODO]** — remove the Payment Mode dropdown and the Carry Forward field from the receipt form.

### Expenditure (money out) — the "F.Expense" record
`date` (required) · `projectId` (required) · `companyId` (required) · `financialYearId` (required) · `natureOfExpense` · `otherNature` · `capitalAsset{}` · `fundingRoute` · `approvedBy` · `amount` (required) · `description` · `reference`

> **⚠️ BREAKING CHANGE for the app.** `category`, `notes` and `carryForwardAmount` have been **removed** from Expenditure. Any app build that still posts them will fail validation (422) or silently drop data. The old values were folded into `description` by the migration; nothing was lost.

- **`natureOfExpense`** — one of `project_intervention` | `administrative_overheads` | `impact_assessment` | `capital_asset` | `other`. Defaults to `project_intervention`.
- **`otherNature`** — required (non-empty) when `natureOfExpense === 'other'`; ignored otherwise.
- **`capitalAsset`** — `{ particulars, address, district, state, pinCode, dateOfCreation }`. **All six are required when `natureOfExpense === 'capital_asset'`** (`pinCode` must be 6 digits, `dateOfCreation` an ISO date); the server 422s otherwise. Cleared on any other nature.
- **`fundingRoute`** — `direct` | `intervention_partner`: whether the money was spent by the company itself or routed through the project's Intervention Partner. `intervention_partner` only makes sense when the project actually names one.
- **There is no carry-forward field.** Carry forward is derived — see §2.

### MasterDataItem
`type` (`category` | `status` | `source`) · `value` · `description` — the editable dropdown value-lists.

- **`description`** — what the value covers. For the **Category** list this carries the full **Schedule VII** clause (Companies Act, 2013) behind the short 2–3 word label, e.g. value `Rural Development` → description `Schedule VII (x) — Rural development projects.` All 13 statutory heads are seeded. **[APP TODO]** — surface the description under each category value, and on the Category dropdown.

### User / AuditLog
`User`: `name`, `email`, `role` (`admin` | `editor` | `viewer`), optional `companyId`. No self-registration.
`AuditLog`: every mutating request, with a field-level before→after diff.

---

## 2. The money concepts (read this before building any screen)

These are constantly confused, and every reporting bug traces back to mixing them up:

| | What it is | Where it lives |
|---|---|---|
| **Received** | What a company *actually paid* | Sum of `FundReceipt.amount` where `projectId` + `companyId` match and `receiptType === 'company'` |
| **Budget** | The project's approved cost | `Project.budget` |
| **Spent** | Sum of `Expenditure.amount` for the project | Derived |
| **Utilization %** | Spent ÷ **Budget** | Derived |
| **Carry Forward** | Money received against an **Ongoing** project that has not been spent on it | Derived — `max(0, received − spent)` per (project, company) |

There is **no "committed"/"pledged" amount** in the system. A project records *which* companies fund it; how much each actually paid comes only from its Fund Receipts.

### Carry forward is derived, never entered

Nobody types a carry-forward figure anywhere. For every project with `derivedStatus === 'ongoing'`, per contributing company:

```
carryForward = max(0, sum(receipts for this project+company) − sum(expenditures for this project+company))
```

Both receipts and expenditures name a company, so the split is exact — nothing is apportioned pro-rata. A project that has out-spent its linked receipts carries **nothing** forward; the shortfall shows on the row as `spent > received`.

Consequences the app must respect:

- A receipt has to be **linked to a project** (`projectId`) for that project's carry forward to be computable. An Ongoing project with no linked receipt shows no carry-forward row, and the website says so explicitly.
- **Company Carry Forward** = the sum of its carry-forward rows. It is a *slice of* the company's balance, **not an addition to it**:
  `Balance = Total Received − Total Expenditure`. (The old formula, `received + carryForward − expenditure`, double-counted the same rupee. **[APP TODO]** — fix this if the app reproduces it.)
- **Year-wise flow** chains: each financial year's closing balance becomes the next year's `carryForwardIn`.
  `totalAvailable = carryForwardIn + fundsReceived`; `carryForwardOut = balance = totalAvailable − expenditure`.
- Server endpoint: `GET /reports/carry-forward` → one row per (Ongoing project × company) with `projectCode`, `projectName`, `companyName`, `received`, `spent`, `carryForward`.

The legacy `FundReceipt.carryForward` field is **no longer read by any report**. It is kept only so historical documents still validate.

An `other_source` receipt is **not** a contribution — it never counts toward a project's "Received", even though it does count toward that company's overall `totalReceived` on the Dashboard.

---

## 3. Authentication & session

- Sign in with email + password. Accounts are **admin-created only**; there is no sign-up.
- JWT, **1-day expiry**. Two transports:
  - **httpOnly cookie** `csr_token` (`secure` + `sameSite=none` in production, since the frontend and backend are on different domains).
  - **`Authorization: Bearer` fallback** — the login response also returns the raw `token`. **The mobile app must use this**, storing it in AsyncStorage; cookies are not workable across the split-domain setup.
- Session is restored via `GET /auth/me`. A rejected/expired token must log the user out and return them to Login.
- Report-download endpoints (`/reports/export/...`) additionally accept `?token=` in the query string, because a native file download can't set headers.
- **Rate limits:** 600 requests / 15 min globally; **10 failed logins / 15 min** on `/auth/login` (successful logins don't count).
- Every sign-in, failed sign-in, and create/update/delete is written to the Activity Log automatically.

## 4. Roles & permissions

| | Read | Create / Edit / Delete | User mgmt + Activity Logs |
|---|---|---|---|
| **Admin** | ✅ | ✅ | ✅ |
| **Editor** | ✅ | ✅ | ❌ |
| **Viewer** | ✅ | ❌ | ❌ |

Enforced **server-side** (`requireWrite` = admin + editor; `requireAdmin` for `/users` and `/logs`). Hiding buttons on the client is convenience only — never a security control. Every signed-in role can see the Dashboard.

---

## 5. Screens

### 5.1 Dashboard
- Four stat cards, each with a "this year" sub-value: **Total Balance**, **Total Received**, **Total Expenditure**, **Active Projects** (+ "N completed, M total").
- Bar chart — **Year-wise Fund Overview** (Received vs Expenditure per FY).
- Doughnut — **Fund Distribution by Company** (share of total received), with the total in the centre and a legend showing percent + amount.
- Table — **Company Fund Positions**: Company, Total Received, Carry Forward, Expenditure, Balance, Projects.

All of it comes from `GET /dashboard/summary` so the app and website can never drift apart. Don't recompute it client-side.

### 5.2 Companies
- Flat table; live search over name, CIN, PAN, contact person, email.
- **Add/Edit**: Name (required), CIN, **PAN**, Contact Person, Phone, Email, Address, Notes.
- **Delete does NOT cascade.** Deleting a company removes only the company document — its projects, receipts and expenditures survive as orphans. **[APP TODO]** — the app's delete dialog currently *claims* it cascades. Fix the copy; don't implement a cascade.
- **Company Detail**: CIN + PAN under the name · contact tile · Fund Overview (Received, Carry Forward, Expenditure, Current Balance, Total/Active Projects) · Year-wise Fund Summary table · Projects table (with Project ID) · Fund Receipts table (Date, Year, Account Number, Amount).

Carry Forward for a company = the sum of its derived carry-forward rows (§2).
Current Balance = Received − Expenditure. **Carry Forward is not added to it.**

### 5.3 Financial Years
- Cards: name, date range, "Active" pill, an independent active/inactive toggle, delete.
- **Add** form only (no edit modal): Name, Start Date, End Date, "Mark as active" (default on).
- Several years may be active simultaneously.

### 5.4 Projects
- List with Company filter + free-text search (name, category, location, description, company names).
- **Add/Edit form:**
  - **Name** (required).
  - **Companies** (required, ≥1): a plain checkbox list of companies. No per-company amount — that is not a concept in this app.
  - **Approved Budget (₹)** — typed by the user.
  - **Status**, **Derived Status**, **Category** (from Master Data), **Location**, **Start Date** (required, never in the future), **Description**, **Notes**, **Attach Document**.
  - **Financial Year is read-only and auto-filled** from the FY the Start Date falls into — see §7. It updates live as the Start Date changes; the user never picks it.
  - **End Date is read-only and derived server-side** — see §7.
  - The list row and detail view each show the project's **FY**.
  - Business rule: `on_hold` or `cancelled` requires a Description or Notes explaining why.
- **Delete is blocked while `status === 'active'`** (HTTP 409) — for everyone, including admins. Mark it Completed first. Deleting a project also deletes its attached documents.

### 5.5 Fund Receipts
Two entry buttons: **Record Receipt** (`receiptType: 'company'`) and **Receipt From Other Source** (`receiptType: 'other_source'`).

Shared fields: Financial Year (**active years only**), Project (optional), Receipt Date (required, not in the future), Attach Proof (optional), Notes.

- **Other Source**: adds a required **Source** dropdown (Master Data `source`) and a required **Company** dropdown, plus a single Amount and a single Account Number.
- **Record Receipt with no project selected**: a single **Donor Company** dropdown + a single Amount + a single Account Number.
- **Record Receipt with a project selected** → the form switches to a **per-company grid**, and the single Account Number field disappears (each company banks from its own account):

  | Company | Account Number | Amount |
  |---|---|---:|
  | ABC Ltd | `[____________]` | `[______]` |
  | XYZ Pvt | `[____________]` | `[______]` |

  Fill in whichever companies paid; leave the rest blank (a blank/zero Amount skips the row entirely). The shared date and financial year are entered once at the top. A running **Total** shows under the grid.

  **Every filled row becomes its own ordinary `FundReceipt` document**, with its own account number. They appear individually in the list and are individually editable and deletable. This is a data-entry shortcut, not a storage change — the audit trail is unaffected.

  The batch is **all-or-nothing**: if any row fails validation, nothing is written (`POST /fund-receipts/bulk`).

- **Attach Proof** (optional): photo / PDF / doc / CSV, up to 5 files × 8 MB per receipt. On a grid entry, each staged file is attached to **every** receipt the entry creates.
- **Editing** is always single-record, whatever the project. Deleting a receipt also deletes its proof documents.
- List columns: Date · Donor Company / Source · Year · Project · Account Number · Amount. Header shows record count + running total, recalculated with the filters (Company, Year, search).

### 5.6 Expenditures
- **Project** (required) drives everything. It is picked as `PROJECTID — Name` and it narrows the **Company** dropdown to that project's companies.
- Picking a project shows a read-only **position table**: one row per company with **Received / Already Spent / Remaining** against *that project*. That is what tells the user how much of each company's money is still available before they book a new spend.
- **Financial Year** is chosen independently and is limited to **active** years. When editing a record whose year has since gone inactive, that year stays selectable so old data isn't corrupted.
- **Nature of Expense** (required, defaults to Project Intervention). Choosing **Any Other** reveals a required "specify" field. Choosing **Capital Asset** reveals a required sub-form: Short particulars · Complete address · District · State · PIN code (6 digits) · Date of creation.
- **Whether Direct or through Intervention Partner** — the partner option is disabled unless the project names an Intervention Partner.
- **Carry Forward is shown, not entered.** For an Ongoing project the form states what will remain unspent after this entry, and warns if the amount over-spends what that company has left.
- Also: Amount Spent (required), Date of Spend (required), Approved By, Description, Attach Document. **There is no Category and no Notes field any more.**
- List: **Project ID**, Date of Spend, Project, Company, Year, Nature of Expense, Direct/Partner, Amount Spent. Filters: Company, Year, search (Project ID included).

### 5.7 Master Data
Three tabs — **Category**, **Status**, **Source** — each a list of values **with a description**, add/edit/delete. These populate the Category dropdowns (Projects, Expenditures) and the Source dropdown (Other-Source receipts). Deleting a value does not rewrite records that already use it.

The **Category** list holds the 13 statutory **Schedule VII** activity heads: a short 2–3 word `value` to pick from, with the full clause as its `description`. The Project form shows the clause under the chosen category.

**[APP TODO]** — this screen does not exist in the app yet.

### 5.8 Reports
Filters: Company, Financial Year. Five tabs:

1. **Transaction Ledger** — bar chart + table: Type, Date, **Project ID**, Project, Company, FY, Nature of Expense, Amount, running Balance.
2. **Year-wise** — bar (Received / Carry In / Expenditure) + pie (expenditure share). Table: Financial Year, Funds Received, Carry Forward In, Total Available, Expenditure, Balance, Carry Forward Out. Each year's closing balance is the next year's Carry Forward In, so those columns are running positions — **do not sum them down the column**.
3. **Company-wise** — bar + pie. Table: Company, Total Received, Expenditure, **Balance**, **Carry Forward**, Projects (in that order — Balance is received − expenditure; Carry Forward is a slice of it).
4. **Project-wise** — bar (Budget vs Spent, top 10, labelled by Project ID) + pie (projects by status). Table: **Project ID, Project, Company, Intervention Partner, Period, Budget, Received, Spent, Utilization %, Status**.
5. **Carry Forward** — table: **Project ID, Project, Company, Received, Spent, Carry Forward, Rolls Into**. One row per (Ongoing project × company), derived (§2). Ongoing projects with no receipt linked to them are called out in a banner, since no carry forward can be computed for them.

**Export**: server-generated **PDF** and **Excel** via `GET /reports/export/{pdf|excel}?type=<tab>`. The website falls back to browser-print / client-side CSV when the API is unavailable; the app should just use the server endpoints and hand the file to the native share sheet.

### 5.9 Admin Panel *(admin only)*
- Stat cards — Total Users / Admins / Editors / Viewers; tapping one lists those users.
- **Add User**: Name, Email, Password (**min 8 chars, ≥1 letter, ≥1 number**), Role.
- **All Users** table with delete. **Cannot delete your own account, and cannot delete the last remaining admin.**
- **Activity Logs**: search + filter by action and by user; each row expands to the field-level before→after diff; share a single entry; "Clear Logs" wipes the collection.

### 5.10 Document attachments
Supported on **Projects**, **Expenditures** and **Fund Receipts** (there labelled "Attach Proof"). Bytes are stored in MongoDB (no disk on the free tier). Any file type — photo, PDF, doc, CSV.

- **Max 5 documents per record, max 8 MB each** — enforced on the server (409 / 413).
- Upload/delete require write permission; **any signed-in role can list and download**.
- Downloads are served with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` — an uploaded `.svg` or `.html` must never render in-browser.
- On a *new* record, files are staged locally and uploaded after the record is created; partial upload failures are reported without losing the record.
- **Deleting the parent record deletes its documents** (server-side cascade) — no orphaned blobs.

**[APP TODO]** — the app has no upload feature at all yet.

---

## 6. API contract

Standard REST, all under `/api`, all requiring authentication:

```
GET    /companies            GET/POST/PUT/DELETE   … /:id
GET    /financial-years      …
GET    /projects             …
GET    /fund-receipts        …
POST   /fund-receipts/bulk   { receipts: [ …FundReceipt ] }   ← multi-company entry
GET    /expenditures         …
GET    /master-data          …

GET    /projects/:id/documents        POST (multipart "file")  GET /:docId/download  DELETE /:docId
GET    /expenditures/:id/documents    …
GET    /fund-receipts/:id/documents   …

GET    /dashboard/summary
GET    /reports/year-wise
GET    /reports/company-positions
GET    /reports/export/{pdf|excel}?type={year|company|project|carryForward|ledger}

POST   /auth/login    GET /auth/me    POST /auth/logout
GET    /users   POST /users   DELETE /users/:id          (admin)
GET    /logs    GET /logs/mine   DELETE /logs            (admin; /mine for self)
```

**`POST /fund-receipts/bulk`** validates every row *before writing any of them* — a rejected batch stores nothing. It returns the array of created receipts. Use it whenever a project's companies are entered together.

Reads are open to every authenticated role; writes are admin + editor. Every list endpoint returns the **full collection** — there is no server-side pagination or filtering, so filter and search on the client.

---

## 7. Server-derived values — do not compute these in the app

- **Project `endDate`, `financialYearId` and `projectCode`** are never accepted from the client. The server finds the financial year that the project's **start date** falls into (not today's date, so backdated projects work), and:
  - sets `financialYearId` to that FY.
  - sets `endDate`: `derivedStatus === 'ongoing'` → end of the FY **3 years** later; **otherwise → the end of the start FY itself.** A project that isn't Ongoing finishes inside the financial year it began in. (This changed: it used to be the start FY + 1 year.)
  - issues `projectCode` (4 letters of the name + the FY's start year, `-2` on a clash). Stable across renames; re-issued only if the project's FY changes.
  - If no known FY contains the start date, the FY falls back to the active/latest year.
- **Project `companyIds`** is deduped on every create and update; blank ids are dropped.
- **All carry-forward figures** — never stored, never posted. See §2.
- **Dashboard and report aggregates** come from `/dashboard/summary`, `/reports/year-wise`, `/reports/company-positions`, `/reports/carry-forward`.

## 8. Rules the server enforces (and the app must not bypass)

- New fund receipts and expenditures can only be booked against an **active** financial year (400 otherwise). This is checked on **create only** — editing an old record whose year has since gone inactive still works.
- A project with `status === 'active'` **cannot be deleted** (409).
- `startDate` (Project) and `date` (FundReceipt) **cannot be in the future**.
- `on_hold` / `cancelled` projects must carry a Description or Notes.
- Deleting a company, financial year, or master-data value **does not cascade**.
- Every write is Zod-validated and audit-logged with a before→after diff.

---

## 9. Client-side conventions worth copying

- **Currency**: full Indian grouping (₹12,34,567) everywhere; abbreviated form (₹8.5L, ₹1.2Cr, ₹40k) on chart axes only.
- **Dates**: ISO `yyyy-mm-dd` in storage and on the wire; `5 Aug 2023` on screen.
- **Errors**: surface the most specific reason available — field-level Zod errors → server `message` → network fallback ("Could not reach the server").
- **Empty states** on every list rather than a blank screen.
- **Cold starts**: the Render free tier sleeps. Ping `/api/health` on launch and retry; expect the first request after idle to take ~30 s.
