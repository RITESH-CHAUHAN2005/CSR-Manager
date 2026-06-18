// E2E test for v2 flows: registration -> approval -> user permissions -> activity logs.
import { MongoMemoryServer } from 'mongodb-memory-server'

const mongo = await MongoMemoryServer.create()
process.env.MONGODB_URI = mongo.getUri()
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234'
process.env.NODE_ENV = 'test'
process.env.PORT = '5098'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'

const { connectDB, disconnectDB } = await import('../src/config/db.js')
const { seedDatabase } = await import('../src/seed.js')
const { createApp } = await import('../src/app.js')

await connectDB()
await seedDatabase()
const server = createApp().listen(5098)
const BASE = 'http://localhost:5098/api'

let pass = 0, fail = 0
const check = (n: string, c: boolean, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`) } else { fail++; console.log(`  ✗ ${n} ${e}`) }
}
const cookieFrom = (r: Response) =>
  ((r.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [])
    .find((x) => x.startsWith('csr_token='))?.split(';')[0] ?? ''
const post = (p: string, body: unknown, cookie = '') =>
  fetch(`${BASE}${p}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) })
const j = (r: Response) => r.json()

async function run() {
  // Register a new employee
  let r = await post('/auth/register', { name: 'New Employee', email: 'newemp@tcs.com', password: 'Emp@12345' })
  check('register new employee -> 202', r.status === 202, `got ${r.status}`)

  // Cannot log in while pending
  r = await post('/auth/login', { email: 'newemp@tcs.com', password: 'Emp@12345', role: 'user' })
  check('pending user login blocked -> 403', r.status === 403, `got ${r.status}`)

  // Weak password rejected
  r = await post('/auth/register', { name: 'X', email: 'weak@tcs.com', password: 'short' })
  check('weak password rejected -> 422', r.status === 422, `got ${r.status}`)

  // Admin logs in, finds pending users, approves the new employee
  r = await post('/auth/login', { email: 'admin@csr.com', password: 'Admin@123', role: 'admin' })
  const admin = cookieFrom(r)
  const users = await j(await fetch(`${BASE}/users`, { headers: { cookie: admin } }))
  const pending = users.filter((u: { status: string }) => u.status === 'pending')
  check('admin sees pending users (seed + new)', pending.length >= 2, `got ${pending.length}`)
  const newEmp = users.find((u: { email: string }) => u.email === 'newemp@tcs.com')
  r = await fetch(`${BASE}/users/${newEmp.id}/approve`, { method: 'PATCH', headers: { cookie: admin } })
  check('admin approves employee -> 200', r.status === 200, `got ${r.status}`)

  // Employee can now log in
  r = await post('/auth/login', { email: 'newemp@tcs.com', password: 'Emp@12345', role: 'user' })
  const emp = cookieFrom(r)
  check('approved employee login -> 200', r.status === 200 && !!emp, `got ${r.status}`)

  // Employee CAN create an operational record (project), createdBy is stamped
  const companies = await j(await fetch(`${BASE}/companies`, { headers: { cookie: emp } }))
  const years = await j(await fetch(`${BASE}/financial-years`, { headers: { cookie: emp } }))
  r = await post('/projects', {
    name: 'Employee Project', companyId: companies[0].id, financialYearId: years[0].id,
    category: 'Education', location: 'Pune', budget: 100000, status: 'active', description: 'test',
  }, emp)
  const proj = await j(r)
  check('employee creates project -> 201', r.status === 201, `got ${r.status}`)
  check('project stamped with createdByEmail', proj.createdByEmail === 'newemp@tcs.com', `got ${proj.createdByEmail}`)

  // Employee CANNOT edit or delete
  r = await fetch(`${BASE}/projects/${proj.id}`, { method: 'PUT', headers: { 'content-type': 'application/json', cookie: emp }, body: JSON.stringify({ ...proj, name: 'Hacked' }) })
  check('employee edit blocked -> 403', r.status === 403, `got ${r.status}`)
  r = await fetch(`${BASE}/projects/${proj.id}`, { method: 'DELETE', headers: { cookie: emp } })
  check('employee delete blocked -> 403', r.status === 403, `got ${r.status}`)

  // Employee CANNOT create master data (company)
  r = await post('/companies', { name: 'X', cin: 'U12345MH2020PLC000001', contactPerson: 'Y', email: 'y@z.com', phone: '123' }, emp)
  check('employee create company blocked -> 403', r.status === 403, `got ${r.status}`)

  // Admin activity log captures everything
  const logs = await j(await fetch(`${BASE}/logs`, { headers: { cookie: admin } }))
  check('admin log has register entry', logs.some((l: { action: string }) => l.action === 'register'), '')
  check('admin log has approve entry', logs.some((l: { action: string }) => l.action === 'approve'), '')
  check('admin log has employee project create', logs.some((l: { action: string; userEmail: string }) => l.action === 'create' && l.userEmail === 'newemp@tcs.com'), '')

  // Employee sees only their own activity
  const mine = await j(await fetch(`${BASE}/logs/mine`, { headers: { cookie: emp } }))
  check('employee sees own activity only', mine.length > 0 && mine.every((l: { userEmail: string }) => l.userEmail === 'newemp@tcs.com'), `got ${mine.length}`)
}

try { await run() } finally {
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
  server.close(); await disconnectDB(); await mongo.stop()
  process.exit(fail === 0 ? 0 : 1)
}
