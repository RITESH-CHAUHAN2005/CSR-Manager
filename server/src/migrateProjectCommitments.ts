import { connectDB, disconnectDB } from './config/db.js'
import { Project } from './models/Project.js'

// One-off migration for the per-company commitment feature: every project gains a
// `commitments` array, one entry per company already in `companyIds`, seeded at 0.
// The project's existing `budget` is left untouched — it stays the approved cost and
// remains independently editable, so a project whose commitments sum to 0 simply shows
// its full budget as a shortfall until the amounts are filled in.
//
// Safe to re-run: projects that already carry a commitment for a company keep the
// amount already recorded, and commitments for companies no longer on the project
// are dropped.
//
// IMPORTANT: there are no automated backups for this database. Do not run this against
// production without first confirming with whoever owns the data. Run with:
//   npm run migrate:project-commitments
async function migrate() {
  const col = Project.collection
  const docs = await col.find({}).toArray()
  console.log(`Found ${docs.length} project document(s).`)

  let changed = 0
  for (const doc of docs) {
    const d = doc as Record<string, unknown>
    const companyIds = Array.isArray(d.companyIds) ? d.companyIds : []
    const existing = new Map<string, number>()
    if (Array.isArray(d.commitments)) {
      for (const c of d.commitments as { companyId?: unknown; committedAmount?: unknown }[]) {
        const amount = Number(c?.committedAmount)
        existing.set(String(c?.companyId), Number.isFinite(amount) && amount > 0 ? amount : 0)
      }
    }

    const commitments = companyIds.map((companyId) => ({
      companyId,
      committedAmount: existing.get(String(companyId)) ?? 0,
    }))

    await col.updateOne({ _id: doc._id }, { $set: { commitments } })
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
