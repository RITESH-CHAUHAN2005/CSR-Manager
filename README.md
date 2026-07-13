# CSR Manager

Enterprise CSR (Corporate Social Responsibility) Fund Management System.

- **Frontend:** React + TypeScript + Vite, Tailwind (theme via CSS variables), Chart.js (react-chartjs-2), React Query.
- **Backend:** Node + Express + TypeScript, MongoDB + Mongoose, JWT auth (httpOnly cookie + `Authorization: Bearer` fallback for split-domain), role-based access.
- **Modules:** Dashboard, Companies, Financial Years, Projects, Fund Receipts, Expenditures, Master Data, Reports
  (PDF + Excel export), Admin Panel (user management + activity logs). Document attachments on Projects, Fund Receipts
  and Expenditures. Audit logging runs server-side.

See [FEATURES.md](./FEATURES.md) for the full behaviour spec (also the contract the mobile app is built against).

```
CSR Manager Website/
  client/   React app  (port 5173)
  server/   Express API (port 5000)
```

## Roles

| Role   | Access |
|--------|--------|
| Admin  | Full CRUD + exports, user management, activity logs |
| Editor | Full CRUD + exports; no user management or activity logs |
| Viewer | Read-only (incl. Dashboard); server returns 403 on any write |

Accounts are **admin-created only** — there is no self-registration. Login is email + password; the role
comes from the DB. RBAC is enforced **server-side** (hiding buttons on the client is convenience only).

Seeded login: `admin@csr.com / Admin@123` — the only account `npm run seed` creates. Add editors/viewers
from the Admin Panel. **Change the admin password immediately in any real deployment.**

## Quick start

### 1. Client (standalone, no database needed)
The client ships with in-memory seed data matching the design, so you can run it on its own:

```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

### 2. Full stack (live API + MongoDB)
Requires a MongoDB instance (local install or MongoDB Atlas connection string).

```bash
cd server
npm install
cp .env.example .env          # set MONGODB_URI and a strong JWT_SECRET (>= 32 chars)
npm run seed                  # loads sample data + the admin account
npm run dev                   # http://localhost:5000
```

Then point the client at the API:

```bash
cd client
# create client/.env with:
#   VITE_USE_API=true
#   VITE_API_URL=<backend origin>   # only when the API is on a different domain; omit in local dev
npm run dev                   # Vite proxies /api -> http://localhost:5000
```

> No MongoDB handy? `cd server && npm test` and `npx tsx test/live.mts` spin up an
> ephemeral in-memory MongoDB for testing / local demos.

## Theme

The entire color scheme is driven by CSS variables in `client/src/theme.css`.
Change the RGB triples there to re-skin the app — nothing else needs editing.

## Scripts

| Where  | Command           | Description |
|--------|-------------------|-------------|
| client | `npm run dev`     | Dev server |
| client | `npm run build`   | Type-check + production build |
| server | `npm run dev`     | API with watch reload |
| server | `npm run seed`    | Seed MongoDB with sample data + admin (overwrites existing data) |
| server | `npm run backup`  | Dump the configured MongoDB before any risky change |
| server | `npm test`        | End-to-end smoke test (ephemeral MongoDB) |
| server | `npm run build`   | Compile TypeScript to `dist/` |

## Deployment

Runs **split-domain**: the Express API on **Render** (auto-deploys on push to `main`), the static Vite build on
**Hostinger**, and the database on **MongoDB Atlas**.

- **Backend env:** `MONGODB_URI`, `JWT_SECRET` (≥ 32 chars), `NODE_ENV=production`, `CLIENT_ORIGIN` = exact frontend
  origin (no trailing slash — must match the browser `Origin` header for CORS).
- **Frontend build env:** `VITE_USE_API=true` + `VITE_API_URL` = backend origin. Ship the **whole** `dist/`
  (including `assets/` and `.htaccess`), not just `index.html`.
- The free Atlas tier has **no automated backups** — run `npm run backup` before any seed/clean/migration.

See [SECURITY.md](./SECURITY.md) for the production security posture and [FEATURES.md](./FEATURES.md) for behaviour.
