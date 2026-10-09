# Dashboard: contract and metric definitions

Branch `ui-dashboard`. The UI is built against the API below. In preview builds the demo mock (`src/demo`) implements it from in-memory tasks; the .NET backend will implement the same contract later, so only the backend remains once the UI is approved.

## Endpoints

### `GET /api/Report/dashboard`
Query: `from`, `to` (yyyy-MM-dd, inclusive, required), optional `status`, `priority`, `categoryId`, `workflowId`, `assigneeId`.
Response: `DashboardResponse` in `src/models/Dashboard.ts`.
Authorisation: any signed-in user. Scope is decided on the server:
- Admin, Manager, Auditor: all tasks (`scope: "all"`).
- Employee: only tasks assigned to them or acted on by them (`scope: "self"`). See Permissions below for the exact policy.

### `GET /api/Report/dashboard/export`
Same query. Returns `text/csv` of the filtered tasks: `TaskId,Title,Workflow,Category,Assignee,Status,Priority,CreatedAt,DueDate,CompletedAt,CycleHours,Overdue`. Same scope rules.

## Permissions (RBAC)
The server decides what each role may see; the UI renders only what the response lists in `permissions`. The role comes from the signed-in user's token, never from a request parameter, and the scope is applied inside the query so out-of-scope rows never leave the server.

| Permission | What it unlocks | Admin | Manager | Auditor | Employee |
|---|---|---|---|---|---|
| (task scope) | which tasks feed every number | all | all | all (read-only) | own: assigned to or acted on by them |
| `workload` | per-person workload (other people's names) | yes | yes | yes | no |
| `assignee-filter` | filter by any assignee, and the assignee list | yes | yes | yes | no |
| `activity` | recent audit-log activity | yes | no | yes | no |
| `org-totals` | `totals`: user count, workflow count, active workflows | yes | yes | no | no |
| `export-tasks` | tasks CSV, within the user's scope | all tasks | all tasks | all tasks | own tasks |

Rules:
- A field that is not permitted is omitted or empty (`workload: []`, `options.assignees: []`, no `totals`). A permission-less request parameter is ignored, never an error that reveals data (an Employee sending `assigneeId` still gets only their own tasks).
- An unknown role gets the least-privilege set (`export-tasks` over its own tasks).
- `GET /Report/audit-logs` (+ export) stays Admin and Auditor only, matching `activity`.
- `/Report/analytics` (org-wide counts and per-user figures, currently open to every signed-in user) must be restricted to the same policy or retired in favour of this endpoint.
- Each dashboard export writes an audit-log entry (user, filters, row count).

## Definitions (all computed over tasks that match the filters)
- **Range**: `from` 00:00 to `to` 23:59:59.999. **Previous period**: the same number of days directly before `from`.
- **Owner** of a task (used by the assignee filter, workload and names): the current assignee, or the original employee once the task has left them (an approval step, or finished). A task waiting in an approval pool therefore counts toward the employee who owns the work.
- **Names**: other people's names (workload, the assignee on Most overdue, the Assignee column in the CSV) are only sent with the `workload` permission. An Employee never receives them.
- **Validation**: `status` and `priority` must be known values and the dates must be yyyy-MM-dd within 366 days, otherwise the API answers 400. Unknown filter text is never stored in the audit log.
- **Created**: tasks with `createdAt` inside the range.
- **Completed**: tasks with `completedAt` inside the range.
- **Open** (at the end of the range): created on or before `to` and not completed/cancelled by then. A task counts as completed by `to` when `completedAt <= to`; there is no cancellation date, so Cancelled and Rejected tasks are always excluded.
- **Overdue** (at the end of the range): Open tasks whose `dueDate < end of range`.
- **On-time rate**: completed in range with `completedAt <= dueDate`, divided by all completed in range, as a percent. `null` when nothing was completed or no due dates exist.
- **Average completion time**: mean of `completedAt - createdAt` in hours for tasks completed in range. `null` when none.
- **No data**: the API sends `current: 0` for on-time rate and average completion time when nothing was completed, so the UI shows a dash whenever `kpis.completed.current` is 0. `previous` is `null` when it cannot be computed.
- **previous**: the same measure evaluated for the previous period (for Open and Overdue, evaluated at the previous period's end).
- **Series**: one point per bucket. Bucket is `day` when the range is 45 days or fewer, otherwise `week` (Monday start). Every bucket in the range is present, with zeros where nothing happened.
- **byStatus / byPriority / byCategory / byWorkflow**: tasks *created in the range*. `byWorkflow.avgCycleHours` is computed from those that are completed.
- **workload**: per assignee, tasks created in the range by current status (`pending`, `inProgress`, `completed`). Sorted by total, descending, top 10.
- **overdueAging**: Overdue tasks bucketed by days past due: 1-3, 4-7, 8-14, 15+.
- **topOverdue**: the 10 most overdue tasks.
- **options**: values for the filter dropdowns, so the UI needs no other endpoint.

## UI
Date presets: 7D, 30D, 90D, This month, Custom. The default is 30D. State lives in the URL query (`?range=30d` or `?from=&to=`, plus the optional filters) so a view can be shared. Charts offer "View as table". Export menu: "Tasks (CSV)" from the export endpoint and "Summary (CSV)" built from the loaded response.
