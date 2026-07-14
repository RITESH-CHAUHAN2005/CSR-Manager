// End-to-end smoke test: ephemeral MongoDB + real Express app + security checks.
// Run with: npm test
import { MongoMemoryServer } from 'mongodb-memory-server'

const mongo = await MongoMemoryServer.create()
process.env.MONGODB_URI = mongo.getUri()
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234'
process.env.NODE_ENV = 'test'
process.env.PORT = '5099'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'

// Import AFTER env is set (env.ts validates process.env at import time).
const { connectDB, disconnectDB } = await import('../src/config/db.js')
const { seedDatabase } = await import('../src/seed.js')
const { createApp } = await import('../src/app.js')

await connectDB()
await seedDatabase()
const app = createApp()
const server = app.listen(5099)

const BASE = 'http://localhost:5099/api'
let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) }
}

function cookieFrom(res: Response): string {
  const all = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
  const c = all.find((x) => x.startsWith('csr_token='))
  return c ? c.split(';')[0] : ''
}

async function run() {
  // 1. Unauthenticated read is blocked
  let r = await fetch(`${BASE}/companies`)
  check('unauthenticated GET /companies -> 401', r.status === 401, `got ${r.status}`)

  // 2. Wrong password rejected
  r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@csr.com', password: 'wrong' }),
  })
  check('login wrong password -> 401', r.status === 401, `got ${r.status}`)

  // 2b. Unknown email -> 401 (not 500); exercises the dummy-hash timing path
  r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@nowhere.com', password: 'whatever' }),
  })
  check('login unknown email -> 401', r.status === 401, `got ${r.status}`)

  // 4. Admin login works (login takes email+password only — role comes from the DB)
  r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@csr.com', password: 'Admin@123' }),
  })
  const adminCookie = cookieFrom(r)
  check('admin login -> 200 + cookie', r.status === 200 && !!adminCookie, `got ${r.status}`)

  // 5. Dashboard numbers match the images
  r = await fetch(`${BASE}/dashboard/summary`, { headers: { cookie: adminCookie } })
  const dash = await r.json()
  check('dashboard totalReceived = 1,78,00,000', dash.totalReceived === 17800000, `got ${dash.totalReceived}`)
  check('dashboard totalExpenditure = 1,23,00,000', dash.totalExpenditure === 12300000, `got ${dash.totalExpenditure}`)
  check('dashboard totalBalance = 55,00,000', dash.totalBalance === 5500000, `got ${dash.totalBalance}`)
  check('dashboard activeProjects = 3', dash.activeProjects === 3, `got ${dash.activeProjects}`)
  check('dashboard completedProjects = 4', dash.completedProjects === 4, `got ${dash.completedProjects}`)

  // 6. Year-wise carry-forward math
  r = await fetch(`${BASE}/reports/year-wise`, { headers: { cookie: adminCookie } })
  const yr = await r.json()
  const fy2324 = yr.find((x: { yearName: string }) => x.yearName === 'FY 2023-24')
  // Matches seed.ts: FY2023-24 receipt carry-forward = 2,50,000.
  check('FY2023-24 carryForwardIn = 2,50,000', fy2324?.carryForwardIn === 250000, `got ${fy2324?.carryForwardIn}`)
  check('FY2023-24 balance = 7,80,000', fy2324?.balance === 780000, `got ${fy2324?.balance}`)

  // 7. Viewer RBAC (read-only). Seed has only the admin, so the admin creates a
  // viewer first (no self-registration), then we log in as that viewer.
  r = await fetch(`${BASE}/users`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ name: 'Read Only', email: 'viewer@csr.com', password: 'Viewer@123', role: 'viewer' }),
  })
  check('admin creates viewer -> 201', r.status === 201, `got ${r.status}`)

  r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'viewer@csr.com', password: 'Viewer@123' }),
  })
  const viewerCookie = cookieFrom(r)
  check('viewer login -> 200', r.status === 200, `got ${r.status}`)

  r = await fetch(`${BASE}/companies`, { headers: { cookie: viewerCookie } })
  check('viewer can READ companies -> 200', r.status === 200, `got ${r.status}`)

  const newCompany = JSON.stringify({
    name: 'Test Co', cin: 'U12345MH2020PLC000001', contactPerson: 'Tester',
    email: 'test@co.com', phone: '+91-99-99999999',
  })
  r = await fetch(`${BASE}/companies`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: viewerCookie }, body: newCompany,
  })
  check('viewer WRITE blocked by RBAC -> 403', r.status === 403, `got ${r.status}`)

  // 8. Admin can write (validated)
  r = await fetch(`${BASE}/companies`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie }, body: newCompany,
  })
  check('admin WRITE allowed -> 201', r.status === 201, `got ${r.status}`)

  // 9. Validation rejects bad payload
  r = await fetch(`${BASE}/companies`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ name: '' }),
  })
  check('invalid payload -> 422', r.status === 422, `got ${r.status}`)

  // 10. NoSQL-injection style payload is sanitized (no crash, rejected by validation)
  r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: { $ne: null }, password: { $ne: null } }),
  })
  check('NoSQL operator injection rejected -> 4xx', r.status >= 400 && r.status < 500, `got ${r.status}`)

  // 11. Multiple-admin support: an admin can create another admin, who can log in.
  r = await fetch(`${BASE}/users`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ name: 'Second Admin', email: 'admin2@csr.com', password: 'Admin2@123', role: 'admin' }),
  })
  const admin2 = await r.json()
  check('admin creates a second admin -> 201', r.status === 201 && admin2.role === 'admin', `got ${r.status}`)

  r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin2@csr.com', password: 'Admin2@123' }),
  })
  check('second admin can log in -> 200', r.status === 200, `got ${r.status}`)

  // 12. Self-delete is blocked (need the acting admin's own id from the users list).
  r = await fetch(`${BASE}/users`, { headers: { cookie: adminCookie } })
  const allUsers = await r.json()
  const selfId = allUsers.find((u: { email: string }) => u.email === 'admin@csr.com')?.id
  r = await fetch(`${BASE}/users/${selfId}`, { method: 'DELETE', headers: { cookie: adminCookie } })
  check('admin cannot delete own account -> 400', r.status === 400, `got ${r.status}`)

  // 13. With two admins present, deleting the OTHER admin is allowed.
  r = await fetch(`${BASE}/users/${admin2.id}`, { method: 'DELETE', headers: { cookie: adminCookie } })
  check('admin can delete another admin -> 200', r.status === 200, `got ${r.status}`)

  // 14. Active projects are protected — cannot be deleted until marked Completed.
  r = await fetch(`${BASE}/companies`, { headers: { cookie: adminCookie } })
  const companies = await r.json()
  r = await fetch(`${BASE}/projects`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({
      name: 'Delete-Guard Test', companyIds: [companies[0].id], derivedStatus: 'other',
      startDate: new Date().toISOString().slice(0, 10), status: 'active', budget: 1000,
    }),
  })
  const proj = await r.json()
  check('admin creates active project -> 201', r.status === 201 && proj.status === 'active', `got ${r.status}`)

  r = await fetch(`${BASE}/projects/${proj.id}`, { method: 'DELETE', headers: { cookie: adminCookie } })
  check('deleting ACTIVE project blocked -> 409', r.status === 409, `got ${r.status}`)

  r = await fetch(`${BASE}/projects/${proj.id}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ ...proj, status: 'completed' }),
  })
  check('mark project Completed -> 200', r.status === 200, `got ${r.status}`)

  r = await fetch(`${BASE}/projects/${proj.id}`, { method: 'DELETE', headers: { cookie: adminCookie } })
  check('deleting COMPLETED project allowed -> 200', r.status === 200, `got ${r.status}`)

  // 15. Project ID is issued server-side: 4 letters of the name + the start FY's year.
  //     A start date of 2024-06-01 falls in FY 2024-25, so "Zenith Uplift" -> ZENI2024.
  const newProject = (name: string) =>
    JSON.stringify({
      name, companyIds: [companies[0].id], derivedStatus: 'other',
      startDate: '2024-06-01', status: 'completed', budget: 1000,
      description: 'code test',
    })
  r = await fetch(`${BASE}/projects`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: newProject('Zenith Uplift'),
  })
  const coded = await r.json()
  check('project code = ZENI2024', coded.projectCode === 'ZENI2024', `got ${coded.projectCode}`)
  // Other than Ongoing ends WITH its start FY, not a year later.
  check('non-ongoing end date = FY end', coded.endDate === '2025-03-31', `got ${coded.endDate}`)

  // A second project whose name starts alike, in the same FY, must not collide.
  r = await fetch(`${BASE}/projects`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: newProject('Zenith Water'),
  })
  const coded2 = await r.json()
  check('duplicate code suffixed -> ZENI2024-2', coded2.projectCode === 'ZENI2024-2', `got ${coded2.projectCode}`)

  // Seeded "Rural Healthcare Camp" already holds RURA2024, so a new Rural* project in
  // the same FY has to be handed the next free code rather than clashing with it.
  r = await fetch(`${BASE}/projects`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: newProject('Rural Uplift'),
  })
  const clashing = await r.json()
  check('code clashing with seed -> RURA2024-2', clashing.projectCode === 'RURA2024-2', `got ${clashing.projectCode}`)

  // Renaming keeps the issued code — it is already printed on downstream records.
  r = await fetch(`${BASE}/projects/${coded.id}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ ...coded, name: 'Completely Different Name' }),
  })
  const renamed = await r.json()
  check('rename keeps project code', renamed.projectCode === 'ZENI2024', `got ${renamed.projectCode}`)

  // 16. PAN is validated when supplied, and optional when not.
  r = await fetch(`${BASE}/companies`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ name: 'Bad PAN Co', pan: 'NOTAPAN' }),
  })
  check('malformed PAN -> 422', r.status === 422, `got ${r.status}`)

  r = await fetch(`${BASE}/companies`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ name: 'Good PAN Co', pan: 'aaact2727q' }),
  })
  const panCo = await r.json()
  check('valid PAN stored uppercase', r.status === 201 && panCo.pan === 'AAACT2727Q', `got ${panCo.pan}`)

  // 17. Carry forward is derived, never entered: money received against an Ongoing
  //     project minus what has been spent on it. Seed: Women Empowerment (ongoing, TCS)
  //     received 40,00,000 and has spent 15,50,000.
  const womenCf = async () => {
    const res = await fetch(`${BASE}/reports/carry-forward`, { headers: { cookie: adminCookie } })
    const rows = await res.json()
    return rows.find((x: { projectCode: string }) => x.projectCode === 'WOME2024')
  }
  const before = await womenCf()
  check('carry forward derived = 24,50,000', before?.carryForward === 2450000, `got ${before?.carryForward}`)
  check('carry-forward row names its project code', before?.projectCode === 'WOME2024', `got ${before?.projectCode}`)

  // 18. A Capital Asset expenditure must carry the asset's location details.
  r = await fetch(`${BASE}/projects`, { headers: { cookie: adminCookie } })
  const allProjects = await r.json()
  const ongoing = allProjects.find((p: { projectCode: string }) => p.projectCode === 'WOME2024')
  r = await fetch(`${BASE}/financial-years`, { headers: { cookie: adminCookie } })
  const fys = await r.json()
  const activeFy = fys.find((y: { isActive: boolean }) => y.isActive)

  const capitalSpend = (capitalAsset: Record<string, string>) =>
    JSON.stringify({
      date: '2024-12-01', projectId: ongoing.id, companyId: ongoing.companyIds[0],
      financialYearId: activeFy.id, natureOfExpense: 'capital_asset',
      fundingRoute: 'direct', amount: 50000, capitalAsset,
    })
  r = await fetch(`${BASE}/expenditures`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: capitalSpend({ particulars: 'A shed' }),
  })
  check('capital asset without location -> 422', r.status === 422, `got ${r.status}`)

  r = await fetch(`${BASE}/expenditures`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: capitalSpend({
      particulars: 'A shed', address: '1 Test Road', district: 'Pune',
      state: 'Maharashtra', pinCode: '411001', dateOfCreation: '2024-12-01',
    }),
  })
  check('complete capital asset -> 201', r.status === 201, `got ${r.status}`)

  // 19. …and that fresh ₹50,000 spend immediately eats into the carry forward, with no
  //     one having typed a carry-forward figure anywhere.
  const after = await womenCf()
  check('spending drops carry forward to 24,00,000', after?.carryForward === 2400000, `got ${after?.carryForward}`)
}

try {
  await run()
} finally {
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
  server.close()
  await disconnectDB()
  await mongo.stop()
  process.exit(fail === 0 ? 0 : 1)
}
