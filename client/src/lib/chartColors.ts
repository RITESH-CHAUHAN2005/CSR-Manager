// Single source of truth for chart colors, shared by Dashboard and Reports so a bar
// series or pie slice reads the same color no matter which page it's shown on.
export const CHART_PALETTE = [
  '#2563EB', '#F59E0B', '#22C55E', '#8B5CF6', '#06B6D4',
  '#EC4899', '#14B8A6', '#F97316', '#EF4444', '#64748B',
]
export const colorFor = (i: number) => CHART_PALETTE[i % CHART_PALETTE.length]

// The recurring "money in vs money out" series across every bar chart in the app.
export const CHART_COLORS = {
  received: '#2563EB',
  carryForwardIn: '#60A5FA',
  expenditure: '#F59E0B',
  budget: '#2563EB',
  spent: '#F59E0B',
}
