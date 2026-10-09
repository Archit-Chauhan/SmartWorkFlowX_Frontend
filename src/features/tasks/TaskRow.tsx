import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { TaskItem } from '../../models';
import { DueLabel, PrioritySignal } from './TaskDetails';
import { STATUS_CHIP, stepLabel } from './taskUtils';

interface Props {
  task: TaskItem;
  selected: boolean;
  /** 'due' for the Action Center, 'status' for My Activity. */
  trailing: 'due' | 'status';
  onOpen: (task: TaskItem) => void;
}

/**
 * One task in the list. Line 1 is the title, line 2 a one-line description preview,
 * line 3 plain meta text. It carries no action buttons: you open it to decide.
 */
const TaskRow: React.FC<Props> = ({ task, selected, trailing, onOpen }) => (
  <button
    type="button"
    id={`task-row-${task.taskId}`}
    onClick={() => onOpen(task)}
    aria-haspopup="dialog"
    aria-expanded={selected}
    className={`grid w-full grid-cols-[16px_1fr] sm:grid-cols-[16px_1fr_auto] items-start gap-x-3.5 gap-y-1 border-t border-hairline px-4 py-3 text-left transition-colors first:border-t-0 ${
      selected ? 'bg-accent-soft' : 'hover:bg-surface-1'
    }`}
  >
    <span className="mt-1.5"><PrioritySignal priority={task.priority} /></span>

    <span className="min-w-0">
      <span className="flex items-center gap-2 font-semibold text-ink">
        {task.rejectedReason && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-error">
            <RotateCcw size={12} aria-hidden="true" />Sent back
          </span>
        )}
        <span className="truncate">{task.title}</span>
      </span>
      <span className={`block truncate text-[13px] ${task.description ? 'text-ink-muted' : 'italic text-ink-subtle'}`}>
        {task.description || 'No description'}
      </span>
      <span className="caption mt-0.5 flex flex-wrap items-center gap-x-1.5">
        <span>{task.workflowTitle || 'Workflow'}</span>
        <span aria-hidden="true">·</span>
        <span>{stepLabel(task)}</span>
        {task.categoryName && (
          <>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.categoryColor || 'var(--accent)' }} aria-hidden="true" />
              {task.categoryName}
            </span>
          </>
        )}
      </span>
    </span>

    <span className="col-start-2 sm:col-start-3 sm:row-start-1 text-sm sm:text-right whitespace-nowrap">
      {trailing === 'due' ? (
        <DueLabel task={task} showDate={false} />
      ) : (
        <span className={`chip ${STATUS_CHIP[task.status] || STATUS_CHIP.Pending}`}>{task.status}</span>
      )}
    </span>
  </button>
);

export default TaskRow;
