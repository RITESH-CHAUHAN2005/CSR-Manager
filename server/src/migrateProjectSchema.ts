import { connectDB, disconnectDB } from './config/db.js'
import { Project } from './models/Project.js'

// One-off migration for the Project schema change: single companyId -> companyIds[],
// ongoing boolean -> derivedStatus enum. Uses the raw collection (bypasses Mongoose
// casting) so it works whether the old or new schema is currently deployed.
// financialYearId is dropped — Project no longer tracks a financial year.
// carryForwardEnabled/carryForwardAmount are dropped — carry-forward lives on
// Expenditure, not Project. companyContributions is also dropped — per-company
// contribution amounts are now derived from Fund Receipts, not stored on the project.
//
// IMPORTANT: there are no automated backups for this database. Do not run this against
// production without first confirming with whoever owns the data. Run with:
//   npm run migrate:project-schema
async function migrate() {
  const col = Project.collection
  const docs = await col.find({}).toArray()
  console.log(`Found ${docs.length} project document(s).`)

  let changed = 0
  for (const doc of docs) {
    const d = doc as Record<string, unknown>
    const companyIds = Array.isArray(d.companyIds)
      ? d.companyIds
      : d.companyId
        ? [d.companyId]
        : []
    const derivedStatus = d.derivedStatus ?? (d.ongoing ? 'ongoing' : 'other')

    await col.updateOne(
      { _id: doc._id },
      {
        $set: { companyIds, derivedStatus },
        $unset: {
          companyId: '',
          financialYearId: '',
          ongoing: '',
          carryForwardEnabled: '',
          carryForwardAmount: '',
          companyContributions: '',
        },
      },
    )
    changed++
  }
  console.log(`Migrated ${changed} project document(s).`)
}

connectDB()
  .then(migrate)
  .then(disconnectDB)
  .catch(async (err) => {
    console.error('Migration failed:', err)
    await disconnectDB()
    process.exit(1)
  })
