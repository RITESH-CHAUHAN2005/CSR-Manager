import { connectDB, disconnectDB } from './config/db.js'
import { Company } from './models/Company.js'
import { Expenditure } from './models/Expenditure.js'
import { FinancialYear } from './models/FinancialYear.js'
import { MasterDataItem } from './models/MasterDataItem.js'
import { Project } from './models/Project.js'
import { SCHEDULE_VII } from './data/scheduleVII.js'
import { findCurrentFinancialYear, shiftIsoYears } from './utils/financialYear.js'
import { projectCodeBase } from './utils/projectCode.js'

// One-off migration bringing existing records onto the CSR-compliance schema:
//
//   companies    + pan (blank)
//   projects     + projectCode (backfilled, unique), + interventionPartner (blank),
//                  endDate recomputed — a project that is NOT Ongoing now ends inside
//                  the financial year it started in, rather than a year later
//   expenditures + natureOfExpense / otherNature / capitalAsset / fundingRoute;
//                  the retired category and notes fields are folded into description
//                  (nothing is thrown away) and then dropped, along with the
//                  hand-entered carryForwardAmount — carry forward is now derived
//   master data  + description, and the 13 Schedule VII activity heads are upserted
//                  into the Category list
//
// Idempotent: safe to run more than once. Uses the raw collections where fields have
// been removed from the schema, since Mongoose would otherwise not see them.
//
// IMPORTANT: this database has no automated backups. Run `npm run backup` first.
//   npm run migrate:csr-compliance

async function migrateCompanies() {
  const res = await Company.collection.updateMany(
    { pan: { $exists: false } },
    { $set: { pan: '' } },
  )
  console.log(`companies:    ${res.modifiedCount} given a blank PAN`)
}

async function migrateProjects() {
  const years = await FinancialYear.find()
  const docs = await Project.collection.find({}).sort({ createdAt: 1 }).toArray()

  // Codes already in use — so a re-run doesn't hand out a code someone else has.
  const taken = new Set(
    docs.map((d) => String((d as Record<string, unknown>).projectCode ?? '')).filter(Boolean),
  )

  let coded = 0
  let redated = 0
  for (const doc of docs) {
    const d = doc as Record<string, unknown>
    const set: Record<string, unknown> = {}

    if (typeof d.interventionPartner !== 'string') set.interventionPartner = ''

    const startDate = typeof d.startDate === 'string' ? d.startDate : ''
    const startFy = findCurrentFinancialYear(years, startDate || undefined)

    if (!d.projectCode) {
      const base = projectCodeBase(String(d.name ?? ''), startFy?.startDate ?? startDate)
      let code = base
      let n = 2
      while (taken.has(code)) code = `${base}-${n++}`
      taken.add(code)
      set.projectCode = code
      coded++
    }

    // Ongoing runs 3 years past its start FY; anything else closes with that FY.
    if (startFy) {
      const endDate =
        d.derivedStatus === 'ongoing' ? shiftIsoYears(startFy.endDate, 3) : startFy.endDate
      if (d.endDate !== endDate) {
        set.endDate = endDate
        set.financialYearId = startFy._id
        redated++
      }
    }

    if (Object.keys(set).length > 0) await Project.collection.updateOne({ _id: doc._id }, { $set: set })
  }
  console.log(`projects:     ${coded} given a Project ID, ${redated} end date(s) recomputed`)
}

const EMPTY_ASSET = {
  particulars: '',
  address: '',
  district: '',
  state: '',
  pinCode: '',
  dateOfCreation: '',
}

// Marker left by an earlier version of this migration, which guessed Capital Asset from
// the old "Infrastructure"/"Equipment" categories. That guess was wrong to make: a
// Capital Asset must carry the asset's address, district, state, PIN and date of
// creation, and nobody has that for a record keyed in under a free-text category. Such
// rows are reset to Project Intervention here, so the guess doesn't force the user to
// invent asset details the first time they edit an old expenditure.
const BAD_GUESS = /^Migrated from category/

async function migrateExpenditures() {
  const docs = await Expenditure.collection.find({}).toArray()
  let changed = 0
  let corrected = 0

  for (const doc of docs) {
    const d = doc as Record<string, unknown>
    const asset = (d.capitalAsset ?? {}) as Record<string, string>

    // Undo the earlier bad Capital Asset guess, wherever it landed.
    if (BAD_GUESS.test(asset.particulars ?? '')) {
      await Expenditure.collection.updateOne(
        { _id: doc._id },
        { $set: { natureOfExpense: 'project_intervention', capitalAsset: EMPTY_ASSET } },
      )
      corrected++
      continue
    }

    const category = typeof d.category === 'string' ? d.category.trim() : ''
    const notes = typeof d.notes === 'string' ? d.notes.trim() : ''
    const description = typeof d.description === 'string' ? d.description.trim() : ''
    const carried = Number(d.carryForwardAmount ?? 0)

    const hasLegacy =
      'category' in d || 'notes' in d || 'carryForwardAmount' in d || !d.natureOfExpense
    if (!hasLegacy) continue

    // Fold what we're about to drop into the description so no keyed-in text is lost.
    const merged = [
      description,
      category ? `Category: ${category}` : '',
      notes ? `Notes: ${notes}` : '',
      carried > 0 ? `Carry forward previously recorded on this entry: ${carried}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    await Expenditure.collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          // Everything lands on Project Intervention. Reclassifying a spend as a Capital
          // Asset is a judgement only the user can make, and doing so demands the asset
          // details the form now asks for.
          natureOfExpense: d.natureOfExpense ?? 'project_intervention',
          otherNature: d.otherNature ?? '',
          fundingRoute: d.fundingRoute ?? 'direct',
          capitalAsset: d.capitalAsset ?? EMPTY_ASSET,
          description: merged.slice(0, 2000),
        },
        $unset: { category: '', notes: '', carryForwardAmount: '' },
      },
    )
    changed++
  }
  console.log(
    `expenditures: ${changed} migrated to the F.Expense schema` +
      (corrected ? `, ${corrected} reset from a bad Capital Asset guess` : ''),
  )
}

async function migrateMasterData() {
  const blanked = await MasterDataItem.collection.updateMany(
    { description: { $exists: false } },
    { $set: { description: '' } },
  )

  let added = 0
  let described = 0
  for (const cat of SCHEDULE_VII) {
    const existing = await MasterDataItem.findOne({ type: 'category', value: cat.value })
    if (!existing) {
      await MasterDataItem.create({ type: 'category', value: cat.value, description: cat.description })
      added++
    } else if (existing.description !== cat.description) {
      existing.description = cat.description
      await existing.save()
      described++
    }
  }
  console.log(
    `master data:  ${blanked.modifiedCount} given a blank description, ` +
      `${added} Schedule VII categor(ies) added, ${described} description(s) refreshed`,
  )
}

async function migrate() {
  await migrateCompanies()
  await migrateProjects()
  await migrateExpenditures()
  await migrateMasterData()
  // Build the new unique index on projectCode now that every project has one.
  await Project.syncIndexes()
  console.log('✅ Migration complete.')
}

connectDB()
  .then(migrate)
  .then(disconnectDB)
  .catch(async (err) => {
    console.error('Migration failed:', err)
    await disconnectDB()
    process.exit(1)
  })
