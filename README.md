# CSR Manager

Enterprise CSR (Corporate Social Responsibility) Fund Management System.

- **Frontend:** React + TypeScript + Vite, Tailwind (indigo theme via CSS variables), Recharts, React Query.
- **Backend:** Node + Express + TypeScript, MongoDB + Mongoose, JWT auth (httpOnly cookie), role-based access.
- **Modules:** Dashboard, Companies, Financial Years, Projects, Fund Receipts, Expenditures, Reports
  (PDF + Excel export). Audit logging runs server-side.

```
CSR Manager Website/
  client/   React app  (port 5173)
  server/   Express API (port 5000)
```

## Roles

| Role  | Access |
|-------|--------|
| Admin | Full CRUD, approvals, exports |
| User  | Read-only (write buttons hidden; server returns 403 on any write) |

Demo logins (seeded): `admin@csr.com / Admin@123`, `user@csr.com / User@123`.
**Change these immediately in any real deployment.**

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
npm run seed                  # loads sample data + admin/user accounts
npm run dev                   # http://localhost:5000
```

Then point the client at the API:

```bash
cd client
# create client/.env with:
#   VITE_USE_API=true
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
| server | `npm run seed`    | Seed MongoDB with sample data |
| server | `npm test`        | End-to-end smoke test (ephemeral MongoDB) |
| server | `npm run build`   | Compile TypeScript to `dist/` |

See [SECURITY.md](./SECURITY.md) for the production security posture.
