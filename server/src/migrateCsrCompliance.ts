import { connectDB, disconnectDB } from './config/db.js'
import { Company } from './models/Company.js'
import { Expenditure } from './models/Expenditure.js'
import { FinancialYear } from './models/FinancialYear.js'
import { FundReceipt } from './models/FundReceipt.js'
import { MasterDataItem } from './models/MasterDataItem.js'
import { Project } from './models/Project.js'
import { SCHEDULE_VII } from './data/scheduleVII.js'
import { findCurrentFinancialYear, shiftIsoYears } from './utils/financialYear.js'
import { projectCodeBase } from './utils/projectCode.js'

// One-off migration bringing existing records onto the CSR-compliance schema:
//
//   companies    + pan (blank); notes -> description
//   projects     + projectCode (backfilled, unique), + interventionPartner (blank);
//                  endDate recomputed — a project that is NOT Ongoing now ends inside
//                  the financial year it started in, rather than a year later;
//                  notes folded into description, then dropped
//   receipts     notes -> description
//   expenditures category / notes / carryForwardAmount folded into description and
//                  dropped; the short-lived natureOfExpense / otherNature /
//                  capitalAsset / fundingRoute fields are dropped too
//   master data  + description; the Category list is rebuilt as exactly the 12
//                  Schedule VII activity heads
//
// Idempotent: safe to run more than once. Uses the raw collections where fields have
// been removed from the schema, since Mongoose would otherwise not see them.
//
// IMPORTANT: this database has no automated backups. Run `npm run backup` first.
//   npm run migrate:csr-compliance

/** notes -> description, keeping whatever is already in description. */
function mergeText(...parts: (string | undefined)[]): string {
  return parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000)
}

async function migrateCompanies() {
  const docs = await Company.collection.find({}).toArray()
  let changed = 0
  for (const doc of docs) {
    const d = doc as Record<string, unknown>
    if (!('notes' in d) && typeof d.pan === 'string') continue
    await Company.collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          pan: typeof d.pan === 'string' ? d.pan : '',
          description: mergeText(d.description as string, d.notes as string),
        },
        $unset: { notes: '' },
      },
    )
    changed++
  }
  console.log(`companies:    ${changed} updated (PAN added, notes folded into description)`)
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
  let denoted = 0
  for (const doc of docs) {
    const d = doc as Record<string, unknown>
    const set: Record<string, unknown> = {}
    const unset: Record<string, string> = {}

    if (typeof d.interventionPartner !== 'string') set.interventionPartner = ''

    if ('notes' in d) {
      set.description = mergeText(d.description as string, d.notes as string)
      unset.notes = ''
      denoted++
    }

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

    const update: Record<string, unknown> = {}
    if (Object.keys(set).length > 0) update.$set = set
    if (Object.keys(unset).length > 0) update.$unset = unset
    if (Object.keys(update).length > 0) await Project.collection.updateOne({ _id: doc._id }, update)
  }
  console.log(
    `projects:     ${coded} given a Project ID, ${redated} end date(s) recomputed, ${denoted} notes folded into description`,
  )
}

async function migrateFundReceipts() {
  const docs = await FundReceipt.collection.find({ notes: { $exists: true } }).toArray()
  for (const doc of docs) {
    const d = doc as Record<string, unknown>
    await FundReceipt.collection.updateOne(
      { _id: doc._id },
      {
        $set: { description: mergeText(d.description as string, d.notes as string) },
        $unset: { notes: '' },
      },
    )
  }
  console.log(`receipts:     ${docs.length} notes folded into description`)
}

// Fields the Expenditure record no longer carries. `category` and `notes` were the
// original ones; `natureOfExpense` and friends were added and then dropped again on the
// user's call. Whatever the user actually typed is preserved in the description — only
// machine-set enums are discarded outright.
const DROPPED = ['category', 'notes', 'carryForwardAmount', 'natureOfExpense', 'otherNature', 'capitalAsset', 'fundingRoute']

async function migrateExpenditures() {
  const docs = await Expenditure.collection
    .find({ $or: DROPPED.map((f) => ({ [f]: { $exists: true } })) })
    .toArray()

  for (const doc of docs) {
    const d = doc as Record<string, unknown>
    const category = typeof d.category === 'string' ? d.category.trim() : ''
    const notes = typeof d.notes === 'string' ? d.notes.trim() : ''
    const carried = Number(d.carryForwardAmount ?? 0)
    const otherNature = typeof d.otherNature === 'string' ? d.otherNature.trim() : ''
    const asset = (d.capitalAsset ?? {}) as Record<string, string>

    // Fold anything a human typed into the description so no keyed-in text is lost.
    const description = mergeText(
      d.description as string,
      category ? `Category: ${category}` : '',
      notes ? `Notes: ${notes}` : '',
      otherNature ? `Nature of expense: ${otherNature}` : '',
      asset.particulars?.trim() ? `Capital asset: ${asset.particulars.trim()}` : '',
      carried > 0 ? `Carry forward previously recorded on this entry: ${carried}` : '',
    )

    await Expenditure.collection.updateOne(
      { _id: doc._id },
      {
        $set: { description },
        $unset: Object.fromEntries(DROPPED.map((f) => [f, ''])),
      },
    )
  }
  console.log(`expenditures: ${docs.length} migrated to the F.Expense schema`)
}

// The free-text categories the app shipped with, mapped onto the statutory head each one
// plainly belongs to. Only unambiguous mappings are listed — anything not here is left
// alone and reported, because guessing at it would be worse than saying so.
const CATEGORY_REMAP: Record<string, string> = {
  Education: 'Education & Livelihood',
  'Skill Development': 'Education & Livelihood',
  Healthcare: 'Hunger, Health & Sanitation',
  Environment: 'Environmental Sustainability',
  'Women Empowerment': 'Gender Equality & Women Empowerment',
  'Incubators & R&D': 'Research & Development',
  'Public Funded Research Bodies': 'Research & Development',
}

// The Category list IS the Schedule VII list — exactly the 12 statutory heads, nothing
// else. Any other category value is removed from the dropdown; projects still carrying
// one are remapped where the mapping is obvious, and reported where it isn't.
async function migrateMasterData() {
  await MasterDataItem.collection.updateMany(
    { description: { $exists: false } },
    { $set: { description: '' } },
  )

  const wanted = new Map(SCHEDULE_VII.map((c) => [c.value, c.description]))
  let added = 0
  let described = 0

  for (const [value, description] of wanted) {
    const existing = await MasterDataItem.findOne({ type: 'category', value })
    if (!existing) {
      await MasterDataItem.create({ type: 'category', value, description })
      added++
    } else if (existing.description !== description) {
      existing.description = description
      await existing.save()
      described++
    }
  }

  const stale = await MasterDataItem.find({ type: 'category', value: { $nin: [...wanted.keys()] } })
  if (stale.length > 0) {
    await MasterDataItem.deleteMany({ _id: { $in: stale.map((s) => s._id) } })
  }

  console.log(
    `master data:  ${added} Schedule VII categor(ies) added, ${described} description(s) rewritten, ` +
      `${stale.length} non-Schedule-VII categor(ies) removed` +
      (stale.length ? ` (${stale.map((s) => s.value).join(', ')})` : ''),
  )

  // Projects still pointing at a category that no longer exists in the list.
  let remapped = 0
  for (const [from, to] of Object.entries(CATEGORY_REMAP)) {
    const res = await Project.collection.updateMany({ category: from }, { $set: { category: to } })
    remapped += res.modifiedCount
  }
  if (remapped > 0) console.log(`projects:     ${remapped} category value(s) remapped onto Schedule VII`)

  const orphans = await Project.find({ category: { $nin: ['', ...wanted.keys()] } }).select('projectCode name category')
  if (orphans.length > 0) {
    console.log(
      `\n⚠️  ${orphans.length} project(s) carry a category with no obvious Schedule VII equivalent.\n` +
        '   Their stored value is untouched — re-pick a category on the Projects page:',
    )
    orphans.forEach((p) => console.log(`     ${p.projectCode || '—'}  ${p.name}  →  "${p.category}"`))
  }
}

async function migrate() {
  await migrateCompanies()
  await migrateProjects()
  await migrateFundReceipts()
  await migrateExpenditures()
  await migrateMasterData()
  // Build the new unique index on projectCode now that every project has one.
  await Project.syncIndexes()
  console.log('\n✅ Migration complete.')
}

connectDB()
  .then(migrate)
  .then(disconnectDB)
  .catch(async (err) => {
    console.error('Migration failed:', err)
    await disconnectDB()
    process.exit(1)
  })
