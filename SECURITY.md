# Security Posture

Production-grade controls implemented in the CSR Manager backend (`server/`).

## Authentication & sessions
- **Password hashing:** bcrypt, cost factor 12. Plaintext passwords are never stored or logged.
- **JWT in httpOnly cookie:** the token is not readable by JavaScript (XSS cannot steal it).
  Cookie flags: `httpOnly`, `sameSite=strict` (CSRF mitigation), `secure` in production (HTTPS only),
  1-day expiry.
- **Bearer fallback:** API clients may also send `Authorization: Bearer <token>`.
- **Brute-force lockout:** account locks for 15 minutes after 5 failed attempts (`User` model,
  atomic counters).
- **No user enumeration:** generic "invalid credentials" message + a dummy bcrypt compare on the
  unknown-email path so response timing is constant.
- **Role binding:** the selected login role must match the account's role, or login is rejected.

## Authorization (RBAC)
- Server-side `requireAdmin` middleware gates **every** write (POST/PUT/DELETE). Read-only Users
  receive `403` regardless of the UI. The frontend hiding buttons is convenience only — the API is
  the source of truth. *(Verified by `npm test`.)*

## Input handling
- **Validation:** every write body is validated/coerced with Zod; invalid payloads return `422`.
- **NoSQL injection:** `express-mongo-sanitize` strips `$`/`.` keys, blocking operator injection
  (e.g. `{ "$ne": null }`). *(Verified by `npm test`.)*
- **HTTP parameter pollution:** `hpp`.
- **Payload size cap:** JSON/urlencoded bodies limited to 100 kb (large-payload DoS mitigation).

## Transport & headers
- **Helmet:** secure HTTP headers (CSP, HSTS, `X-Content-Type-Options`, frame options, removes
  `X-Powered-By`).
- **CORS:** strict origin allow-list (`CLIENT_ORIGIN`), credentials enabled for cookie auth.
- **trust proxy:** correct client IP behind a reverse proxy (accurate rate limiting + secure cookies).

## Rate limiting
- Global limiter: 600 requests / 15 min per IP on `/api`.
- Auth limiter: 10 attempts / 15 min on `/api/auth/login` (counts only failures).

## Auditing
- Every admin write and every login / failed login is recorded in an `AuditLog` collection
  (user, action, entity, method, path, IP, status) — server-side only, no UI surface.

## Secrets & configuration
- All secrets come from environment variables; `.env` is gitignored, `.env.example` is committed.
- Startup validates env with Zod and **fails fast** — e.g. `JWT_SECRET` must be ≥ 32 characters.
- Centralized error handler never leaks stack traces or internals in production.

## Deployment checklist
- [ ] Set a long random `JWT_SECRET` (`openssl rand -hex 48`).
- [ ] Change the seeded admin/user passwords.
- [ ] `NODE_ENV=production` (enables `secure` cookies; hides error detail).
- [ ] Serve over HTTPS behind a trusted reverse proxy.
- [ ] Restrict `CLIENT_ORIGIN` to your real frontend origin(s).
- [ ] Use a MongoDB user with least-privilege access; enable network restrictions / TLS.
