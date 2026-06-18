// Indian currency + number formatting (lakh/crore grouping), matching the images.
// e.g. 3800000 -> "₹38,00,000.00"

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatINR(amount: number): string {
  return inrFormatter.format(amount ?? 0)
}

// Compact axis labels used by the charts: ₹100L, ₹75L, ₹50L, ₹25L, ₹0L
export function formatLakhAxis(amount: number): string {
  const lakhs = (amount ?? 0) / 100000
  return `₹${lakhs % 1 === 0 ? lakhs : lakhs.toFixed(1)}L`
}

// "15 Apr 2022" style dates used in the tables.
export function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
