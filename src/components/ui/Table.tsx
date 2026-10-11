import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Renders the cell. */
  cell: (row: T) => ReactNode;
  /** Return a comparable value to make the column sortable. */
  sortBy?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  /** Hide below the `sm` breakpoint to keep narrow screens readable. */
  hideOnMobile?: boolean;
  width?: string;
}

/**
 * Sortable data table. Scrolls horizontally inside its own container so the
 * page body never scrolls sideways on a phone.
 */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  empty,
  onRowClick,
  initialSort,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}) {
  const [sort, setSort] = useState(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortBy) return rows;
    const get = col.sortBy;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const toggle = (key: string) =>
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );

  const alignClass = (a?: Column<T>['align']) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[42rem] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  // Horizontal padding so adjacent columns cannot touch. Without
                  // it a right-aligned number sits flush against the next
                  // column and reads as if it were hidden behind it.
                  'px-3 pb-2.5 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase first:pl-0 last:pr-0',
                  alignClass(col.align),
                  col.hideOnMobile && 'hidden sm:table-cell',
                )}
              >
                {col.sortBy ? (
                  <button
                    onClick={() => toggle(col.key)}
                    className={cn(
                      'inline-flex items-center gap-1 transition-colors hover:text-ink-2',
                      col.align === 'right' && 'flex-row-reverse',
                    )}
                    aria-label={`Sort by ${typeof col.header === 'string' ? col.header : col.key}`}
                  >
                    {col.header}
                    {sort?.key === col.key ? (
                      sort.dir === 'asc' ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      )
                    ) : (
                      <ChevronsUpDown className="size-3 opacity-45" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-line/70 last:border-0',
                onRowClick && 'cursor-pointer transition-colors hover:bg-surface-hover',
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-3 py-3.5 align-middle text-ink-2 first:pl-0 last:pr-0',
                    alignClass(col.align),
                    col.hideOnMobile && 'hidden sm:table-cell',
                  )}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
