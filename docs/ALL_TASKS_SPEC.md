# All Tasks: API contract (frontend + backend must both follow this)

Screen: `/all-tasks`, Admin and Manager only. Read-only oversight table. Design reference: `D:\aa\SmartX\all-tasks-options.html`, option **H (Table)**. Open it in a browser and copy its look, columns, toolbar, tabs, paging and read-only detail panel.

## Endpoint

`GET /api/Task/all`   `[Authorize(Roles = "Manager,Admin")]` (unchanged)

### Query string

| name | type | notes |
|---|---|---|
| `page` | int >= 1 | **Presence of `page` switches to the paged response.** Absent = legacy behaviour (see "Backward compatibility"). |
| `limit` | int | default 20, clamp to 1..100 |
| `q` | string | trimmed, max 100 chars (longer = 400). Case-insensitive contains over: task title, task description, workflow title, assignee name. Empty = no filter. |
| `group` | `all` \| `open` \| `completed` \| `closed` | the tab. `open` = status Pending or In Progress. `completed` = Completed. `closed` = Rejected or Cancelled. Default `all`. |
| `status` | one exact status | `Pending`, `In Progress`, `Completed`, `Cancelled`, `Rejected`. Combine with `group` by AND. Unknown value = 400. |
| `priority` | `Low` \| `Medium` \| `High` | unknown = 400 |
| `categoryId` | int | **this filter is currently ignored by the controller (bug). It must work.** |
| `assignedTo` | int | user id of the current assignee |
| `overdue` | bool | `true` = status is Pending or In Progress AND DueDate < now (UTC). |
| `sort` | `due` \| `created` \| `priority` \| `title` \| `workflow` \| `assignee` \| `status` | default `due`. Unknown = 400. |
| `dir` | `asc` \| `desc` | default `asc`. Unknown = 400. |

### Ordering rules (must be stable across pages)

* `due`: tasks with no DueDate always last (both directions), then by DueDate in `dir`.
* `priority`: rank High=0, Medium=1, Low=2; `asc` = High first.
* `assignee`: by assignee name; tasks with no assignee last in both directions.
* every sort ends with tie-breakers `CreatedAt desc`, then `TaskId asc`, so paging never repeats or skips rows.

### Response when `page` is present

```json
{
  "data": [ { ...row } ],
  "total": 37,
  "page": 1,
  "pageSize": 20,
  "counts": { "all": 37, "open": 11, "completed": 16, "closed": 10 }
}
```

* `total` = rows matching ALL filters including `group`/`status`.
* `counts` = rows matching every filter EXCEPT `group` and `status` (so the tabs show how many each tab would hold for the current search/priority/category/assignee/overdue filters). `all = open + completed + closed`.
* If `page` is beyond the last page, return an empty `data` with the real `total` (not an error).
* camelCase JSON (default ASP.NET).

### Row fields

```
taskId, title, description, workflowId, workflowTitle, totalSteps, currentStepOrder,
status, priority, dueDate, completedAt, rejectedReason, createdAt,
assignedTo (int|null), assigneeName (string|null), assignedRoleName (string|null),
categoryId (int|null), categoryName (string|null), categoryColor (string|null)
```

* `assigneeName` is **null** when nobody holds the task (the old API returned the string "Unassigned"; the paged response must NOT).
* `assignedRoleName`: when `assignedTo` is null and the task is waiting for a role pool (`AssignedRoleId` set), the role's name (e.g. "Manager"); otherwise null.
* `totalSteps`: number of approval steps of the workflow (`Workflow.Steps.Count`); null if the workflow cannot be resolved.

### Backward compatibility (important)

The live frontend still calls `/Task/all` without `page` and expects a plain JSON array. When `page` is absent keep returning that exact legacy shape (array of the same fields as today, `assigneeName` still `"Unassigned"` when none), but now also honour `categoryId`. This lets the backend be deployed before the frontend without breaking production.

### Errors

Invalid input = 400 with the same error style the other endpoints use (ArgumentException mapping). Non-Admin/Manager = 403, no token = 401 (unchanged).

## Frontend behaviour (summary)

* All state in the URL (`useSearchParams`): `q, group, status, priority, categoryId, assignedTo, overdue, sort, dir, page`. Reload and share keep the view.
* Search is debounced (300 ms). Any filter/sort/search change resets `page` to 1. Out-of-order responses ignored (request id guard).
* Tabs show `counts`. Rows are never filtered or sorted in the browser: the server does it.
* Row opens a read-only panel (reuse `TaskDetails`, `ReviewPanel` with `canAct={false}`), history from `GET /Task/{id}/history`.
