# Dashboard: contract and metric definitions

Branch `ui-dashboard`. The UI is built against the API below. In preview builds the demo mock (`src/demo`) implements it from in-memory tasks; the .NET backend will implement the same contract later, so only the backend remains once the UI is approved.

## Endpoints

### `GET /api/Report/dashboard`
Query: `from`, `to` (yyyy-MM-dd, inclusive, required), optional `status`, `priority`, `categoryId`, `workflowId`, `assigneeId`.
Response: `DashboardResponse` in `src/models/Dashboard.ts`.
Authorisation: any signed-in user. Scope is decided on the server:
- Admin, Manager, Auditor: all tasks (`scope: "all"`).
- Employee: only tasks assigned to them or acted on by them (`scope: "self"`); `workload` and `options.assignees` are empty, and `assigneeId` is ignored.

### `GET /api/Report/dashboard/export`
Same query. Returns `text/csv` of the filtered tasks: `TaskId,Title,Workflow,Category,Assignee,Status,Priority,CreatedAt,DueDate,CompletedAt,CycleHours,Overdue`. Same scope rules.

## Definitions (all computed over tasks that match the filters)
- **Range**: `from` 00:00 to `to` 23:59:59.999. **Previous period**: the same number of days directly before `from`.
- **Created**: tasks with `createdAt` inside the range.
- **Completed**: tasks with `completedAt` inside the range.
- **Open** (at the end of the range): created on or before `to` and not completed/cancelled by then. A task counts as completed by `to` when `completedAt <= to`; there is no cancellation date, so Cancelled tasks are always excluded.
- **Overdue** (at the end of the range): Open tasks whose `dueDate < end of range`.
- **On-time rate**: completed in range with `completedAt <= dueDate`, divided by all completed in range, as a percent. `null` when nothing was completed or no due dates exist.
- **Average completion time**: mean of `completedAt - createdAt` in hours for tasks completed in range. `null` when none.
- **previous**: the same measure evaluated for the previous period (for Open and Overdue, evaluated at the previous period's end).
- **Series**: one point per bucket. Bucket is `day` when the range is 45 days or fewer, otherwise `week` (Monday start). Every bucket in the range is present, with zeros where nothing happened.
- **byStatus / byPriority / byCategory / byWorkflow**: tasks *created in the range*. `byWorkflow.avgCycleHours` is computed from those that are completed.
- **workload**: per assignee, tasks created in the range by current status (`pending`, `inProgress`, `completed`). Sorted by total, descending, top 10.
- **overdueAging**: Overdue tasks bucketed by days past due: 1-3, 4-7, 8-14, 15+.
- **topOverdue**: the 10 most overdue tasks.
- **options**: values for the filter dropdowns, so the UI needs no other endpoint.

## UI
Date presets: 7D, 30D, 90D, This month, Custom. The default is 30D. State lives in the URL query (`?range=30d` or `?from=&to=`, plus the optional filters) so a view can be shared. Charts offer "View as table". Export menu: "Tasks (CSV)" from the export endpoint and "Summary (CSV)" built from the loaded response.
