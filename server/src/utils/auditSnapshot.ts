// Builds human-readable snapshots & diffs of entity records for the activity log.
// Reference id fields (companyId/financialYearId/projectId) are resolved to names so
// the Admin Panel can show "what was created / changed / deleted" in plain language.
import { Company } from '../models/Company.js'
import { FinancialYear } from '../models/FinancialYear.js'
import { Project } from '../models/Project.js'

// Internal / bookkeeping fields never shown in the activity feed.
const HIDDEN = new Set([
  'id',
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
  'createdById',
  'createdByEmail',
  'createdByName',
])

// field name on the record -> { friendly label, model to resolve the name from }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REFS: Record<string, { label: string; model: any }> = {
  companyId: { label: 'company', model: Company },
  financialYearId: { label: 'financialYear', model: FinancialYear },
  projectId: { label: 'project', model: Project },
}

export type Snapshot = Record<string, unknown>
export interface FieldChange {
  field: string
  from: unknown
  to: unknown
}

// Turn a Mongoose doc (or its JSON) into a flat, human-meaningful snapshot.
export async function snapshot(doc: Record<string, unknown> | null | undefined): Promise<Snapshot> {
  if (!doc) return {}
  const out: Snapshot = {}
  for (const [key, value] of Object.entries(doc)) {
    if (HIDDEN.has(key)) continue
    const ref = REFS[key]
    if (ref && value) {
      try {
        const found = await ref.model.findById(value).lean()
        out[ref.label] = found?.name ?? String(value)
      } catch {
        out[ref.label] = String(value)
      }
    } else {
      out[key] = value
    }
  }
  return out
}

// Field-level diff between two snapshots (only fields that actually changed).
export function diff(before: Snapshot, after: Snapshot): FieldChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changes: FieldChange[] = []
  for (const key of keys) {
    const a = before[key]
    const b = after[key]
    if (String(a ?? '') !== String(b ?? '')) {
      changes.push({ field: key, from: a ?? null, to: b ?? null })
    }
  }
  return changes
}
