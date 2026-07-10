import { connectDB, disconnectDB } from './config/db.js'
import { FinancialYear } from './models/FinancialYear.js'

// Ensures a standard Apr-1 to Mar-31 Financial Year exists for 2020-21 through
// the currently-running year, so date-range lookups (e.g. computing an Ongoing
// project's auto End Date) always resolve to a real "current" year instead of
// falling back to whatever was last seeded. Idempotent — safe to re-run.
const FIRST_YEAR = 2020
const CURRENT_START_YEAR = 2026 // FY2026-27 is the one running today

async function run() {
  const lastYear = CURRENT_START_YEAR
  for (let start = FIRST_YEAR; start <= lastYear; start++) {
    const end = start + 1
    const name = `FY ${start}-${String(end).slice(2)}`
    const startDate = `${start}-04-01`
    const endDate = `${end}-03-31`
    const isActive = start === CURRENT_START_YEAR
    await FinancialYear.findOneAndUpdate(
      { name },
      { name, startDate, endDate, isActive },
      { upsert: true, new: true },
    )
    console.log(`Ensured ${name} (${startDate} to ${endDate})${isActive ? ' [active]' : ''}`)
  }
  // Only the current year stays marked active.
  await FinancialYear.updateMany(
    { name: { $ne: `FY ${CURRENT_START_YEAR}-${String(CURRENT_START_YEAR + 1).slice(2)}` } },
    { isActive: false },
  )
  console.log(`Financial years ${FIRST_YEAR}-${FIRST_YEAR + 1} through ${lastYear}-${lastYear + 1} ensured.`)
}

connectDB()
  .then(run)
  .then(disconnectDB)
  .catch(async (err) => {
    console.error('Seeding financial years failed:', err)
    await disconnectDB()
    process.exit(1)
  })
