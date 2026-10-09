import React, { useId, useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';

export interface DataTableProps {
  columns: string[];
  rows: (string | number)[][];
  caption: string;
}

/** Plain accessible table used as the "Table" view of a chart. */
export const DataTable: React.FC<DataTableProps> = ({ columns, rows, caption }) => (
  <div className="overflow-x-auto max-h-80 overflow-y-auto">
    <table className="table tabular-nums">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>{columns.map(c => <th key={c} scope="col">{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Text alternative for the chart (read by screen readers). */
  summary?: string;
  /** When given, the card offers a Chart | Table toggle that swaps in this table. */
  table?: DataTableProps;
  className?: string;
  children: React.ReactNode;
}

const toggleBase =
  'inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium transition-colors duration-150 ';

const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, summary, table, className = '', children }) => {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const headingId = useId();
  const showTable = view === 'table' && table;

  return (
    <section className={`card card-pad min-w-0 ${className}`} aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 id={headingId} className="section-title">{title}</h2>
          {subtitle && <p className="caption mt-0.5">{subtitle}</p>}
        </div>
        {table && (
          <div className="inline-flex flex-shrink-0 rounded-control border border-hairline-strong overflow-hidden" role="group" aria-label={`${title} view`}>
            <button
              type="button"
              aria-pressed={view === 'chart'}
              onClick={() => setView('chart')}
              className={`${toggleBase}${view === 'chart' ? 'bg-accent text-on-accent' : 'bg-canvas text-ink-muted hover:bg-surface-1'}`}
            >
              <BarChart3 size={14} aria-hidden="true" /> Chart
            </button>
            <button
              type="button"
              aria-pressed={view === 'table'}
              onClick={() => setView('table')}
              className={`${toggleBase}border-l border-hairline-strong ${view === 'table' ? 'bg-accent text-on-accent' : 'bg-canvas text-ink-muted hover:bg-surface-1'}`}
            >
              <Table2 size={14} aria-hidden="true" /> Table
            </button>
          </div>
        )}
      </div>
      {showTable ? (
        <DataTable {...table} />
      ) : summary ? (
        <div role="img" aria-label={summary}>{children}</div>
      ) : (
        children
      )}
    </section>
  );
};

export default ChartCard;
