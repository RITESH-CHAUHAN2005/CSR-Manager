// Focused test for the new features: descriptive audit logs + server PDF/Excel export.
// Ephemeral MongoDB, real Express app. Run with: npx tsx test/features.mts
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
const app = createApp()
const server = app.listen(5098)
const BASE = 'http://localhost:5098/api'

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
  // Login as admin
  let r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@csr.com', password: 'Admin@123' }),
  })
  const cookie = cookieFrom(r)
  check('admin login -> cookie', r.status === 200 && !!cookie, `got ${r.status}`)
  const H = { 'content-type': 'application/json', cookie }

  // CREATE a company
  r = await fetch(`${BASE}/companies`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: 'Audit Test Co', cin: 'U12345MH2020PLC000001', contactPerson: 'Asha', email: 'asha@test.com', phone: '9990001111' }),
  })
  const created = await r.json()
  check('create company -> 201', r.status === 201, `got ${r.status}`)

  // UPDATE the company (change contactPerson + phone)
  r = await fetch(`${BASE}/companies/${created.id}`, {
    method: 'PUT', headers: H,
    body: JSON.stringify({ ...created, contactPerson: 'Bhavna', phone: '8887776666' }),
  })
  check('update company -> 200', r.status === 200, `got ${r.status}`)

  // DELETE the company
  r = await fetch(`${BASE}/companies/${created.id}`, { method: 'DELETE', headers: H })
  check('delete company -> 200', r.status === 200, `got ${r.status}`)

  // Give the fire-and-forget audit writes a moment to flush
  await new Promise((res) => setTimeout(res, 400))

  // Fetch logs
  r = await fetch(`${BASE}/logs?entity=company`, { headers: H })
  const logs: Array<Record<string, unknown>> = await r.json()
  const byAction = (a: string) => logs.find((l) => l.action === a && l.label === 'Audit Test Co')

  const createLog = byAction('create')
  check('create log has after snapshot', !!createLog?.after && (createLog.after as Record<string, unknown>).contactPerson === 'Asha',
    JSON.stringify(createLog?.after))

  const updateLog = byAction('update')
  const changes = (updateLog?.changes ?? []) as Array<{ field: string; from: unknown; to: unknown }>
  const contactChange = changes.find((c) => c.field === 'contactPerson')
  check('update log has field changes (before -> after)',
    !!contactChange && contactChange.from === 'Asha' && contactChange.to === 'Bhavna',
    JSON.stringify(changes))

  const deleteLog = byAction('delete')
  check('delete log has before snapshot',
    !!deleteLog?.before && (deleteLog.before as Record<string, unknown>).contactPerson === 'Bhavna',
    JSON.stringify(deleteLog?.before))

  // PDF export for each report type
  for (const type of ['year', 'company', 'project']) {
    r = await fetch(`${BASE}/reports/export/pdf?type=${type}`, { headers: { cookie } })
    const buf = Buffer.from(await r.arrayBuffer())
    const isPdf = buf.subarray(0, 5).toString() === '%PDF-'
    check(`PDF export type=${type} -> 200 + %PDF`, r.status === 200 && isPdf && buf.length > 800,
      `status ${r.status} len ${buf.length}`)
  }

  // Excel export
  r = await fetch(`${BASE}/reports/export/excel?type=company`, { headers: { cookie } })
  const xbuf = Buffer.from(await r.arrayBuffer())
  // xlsx files are zip archives -> start with "PK"
  check('Excel export type=company -> 200 + PK(zip)', r.status === 200 && xbuf.subarray(0, 2).toString() === 'PK',
    `status ${r.status} len ${xbuf.length}`)
}

try {
  await run()
} catch (e) {
  fail++
  console.error('  ✗ threw', e)
} finally {
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
  server.close()
  await disconnectDB()
  await mongo.stop()
  process.exit(fail === 0 ? 0 : 1)
}
