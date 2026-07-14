// A project's business key: the first 4 letters of its name + the start year of the
// financial year it began in. "Rural Education Drive" starting in FY 2025-26 -> RURA2025.
//
// Non-letters are dropped before slicing (so "3R's Programme" -> RSPR, not "3R'S"),
// and short names are padded so every code is the same shape. Collisions (two
// projects whose names start alike in the same year) are resolved by the caller,
// which appends -2, -3, … — see computeProjectDerived.
export function projectCodeBase(name: string, fyStartDate: string): string {
  const letters = (name ?? '').replace(/[^A-Za-z]/g, '').toUpperCase()
  const slug = (letters || 'PROJ').slice(0, 4).padEnd(4, 'X')
  const year = /^\d{4}/.test(fyStartDate ?? '')
    ? fyStartDate.slice(0, 4)
    : String(new Date().getFullYear())
  return `${slug}${year}`
}
