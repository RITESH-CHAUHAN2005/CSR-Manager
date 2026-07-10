import type { ReactNode } from 'react'
import RDataTable from 'datatables.net-react'
import DT from 'datatables.net-dt'
import 'datatables.net-dt/css/dataTables.dataTables.min.css'

// Register the DataTables core/styling with the React wrapper once.
RDataTable.use(DT)

// A column definition. Bind `data` to a field for sorting; use `render` to format a
// display string (keeps numeric/date sorting correct) or a `slots` entry (by column
// index) to render a React node such as a badge or action button.
export interface DTColumn {
  data?: string | null
  title?: string
  orderable?: boolean
  searchable?: boolean
  className?: string
  type?: string
  render?: (data: unknown, type: string, row: unknown) => unknown
}

export function DataTable<T = unknown>({
  data,
  columns,
  slots,
  options,
  // Full grid (horizontal + vertical lines) is the site-wide default so every
  // table reads as clean tabular data, not just row separators.
  className = 'display nowrap csr-dt-grid',
}: {
  data: T[]
  columns: DTColumn[]
  slots?: Record<number, (cell: unknown, row: T) => ReactNode>
  options?: Record<string, unknown>
  className?: string
}) {
  return (
    <div className="csr-dt overflow-x-auto">
      <RDataTable
        /* eslint-disable @typescript-eslint/no-explicit-any */
        data={data as any[]}
        columns={columns as any}
        slots={slots as any}
        /* eslint-enable @typescript-eslint/no-explicit-any */
        className={className}
        options={{
          paging: true,
          pageLength: 10,
          lengthChange: false,
          order: [],
          autoWidth: false,
          language: {
            search: '',
            searchPlaceholder: 'Search…',
            info: 'Showing _START_–_END_ of _TOTAL_',
            infoEmpty: 'No records',
            infoFiltered: '(filtered from _MAX_)',
            zeroRecords: 'No matching records',
            paginate: { previous: '‹', next: '›' },
          },
          ...options,
        }}
      />
    </div>
  )
}
