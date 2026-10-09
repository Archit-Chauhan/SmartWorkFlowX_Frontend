import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { DashboardResponse, KpiValue } from '../../models/Dashboard';
import {
  changeTone, formatChange, formatHours, formatPercent, daysInRange,
  type ChangeDirection, type ChangeTone, type Polarity,
} from './utils';

interface KpiDef {
  key: keyof DashboardResponse['kpis'];
  label: string;
  polarity: Polarity;
  percent?: boolean;
  format: (v: number) => string;
}

const KPIS: KpiDef[] = [
  { key: 'created', label: 'Created', polarity: 'neutral', format: v => String(v) },
  { key: 'completed', label: 'Completed', polarity: 'neutral', format: v => String(v) },
  { key: 'open', label: 'Open', polarity: 'neutral', format: v => String(v) },
  { key: 'overdue', label: 'Overdue', polarity: 'down', format: v => String(v) },
  { key: 'onTimeRatePct', label: 'On-time rate', polarity: 'up', percent: true, format: v => formatPercent(v) },
  { key: 'avgCompletionHours', label: 'Avg completion time', polarity: 'down', format: v => formatHours(v) },
];

const TONE_CLASS: Record<ChangeTone, string> = {
  good: 'text-success',
  bad: 'text-error',
  neutral: 'text-ink-muted',
};

const ICONS: Record<ChangeDirection, React.ElementType> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
  none: Minus,
};

const ChangeBadge: React.FC<{ kpi: KpiValue; def: KpiDef }> = ({ kpi, def }) => {
  const info = formatChange(kpi, def.percent);
  const tone = changeTone(info.direction, def.polarity);
  const Icon = ICONS[info.direction];
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${TONE_CLASS[tone]}`}>
      <Icon size={14} aria-hidden="true" />
      {info.text}
    </span>
  );
};

interface Props {
  kpis: DashboardResponse['kpis'];
  range: DashboardResponse['range'];
}

const KpiCards: React.FC<Props> = ({ kpis, range }) => {
  const days = daysInRange(range.from, range.to);
  const caption = days > 0 ? `vs previous ${days} day${days === 1 ? '' : 's'}` : 'vs previous period';
  return (
    <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4" aria-label="Key metrics">
      {KPIS.map(def => {
        const kpi = kpis[def.key];
        // Averages and rates have no meaningful value when nothing was completed.
        const empty = (def.key === 'avgCompletionHours' || def.key === 'onTimeRatePct') && kpis.completed.current === 0;
        return (
          <li key={def.key} className="card p-4 min-w-0">
            <p className="caption">{def.label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink tabular-nums truncate">
              {empty ? '-' : def.format(kpi.current)}
            </p>
            <div className="mt-2 flex flex-col gap-0.5">
              <ChangeBadge kpi={kpi} def={def} />
              <span className="text-xs text-ink-subtle">{caption}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default KpiCards;
