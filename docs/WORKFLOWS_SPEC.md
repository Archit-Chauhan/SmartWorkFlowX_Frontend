# Workflows screen: contract (frontend + backend must both follow this)

Screen `/workflows`, same roles as today. Design reference (open in a browser): `D:\aa\SmartX\workflows-options.html`, **option M** ("List + full-page builder"). The backend table at the bottom of that page is the origin of this contract.

## Backend

### 1. `GET /api/Workflow/{id}`: add `approverRoleId` to every step

`WorkflowStepResponse` gains `ApproverRoleId` (int). Keep every existing field. The frontend currently guesses the role id from `approverRoleName` and falls back to 2: that must go away.

### 2. `POST /api/Workflow/{id}/activate` (new, same authorization as the other Workflow write endpoints)

* 404 `KeyNotFoundException("Workflow not found.")` if missing.
* 400 `ArgumentException("A workflow needs at least one step before it can be activated.")` if it has no steps.
* Already Active: succeed without changes (idempotent), message `Workflow is already active.`
* Otherwise set Status = `Active`, save, publish the same `WorkflowActivated` system event `UpdateAsync` publishes today, return `{ message: "Workflow activated successfully." }`.
* NOT blocked by in-progress tasks (activating is harmless). Deactivate stays `DELETE /api/Workflow/{id}` unchanged (it already refuses when tasks are in progress).

### 3. Validation on `POST /api/Workflow` and `PUT /api/Workflow/{id}`

Throw `ArgumentException` (middleware maps to 400) with these exact messages, checked in this order, before anything is saved. `{n}` is the 1-based position of the step in the request array.

| rule | message |
|---|---|
| title trimmed empty / null | `Workflow title is required.` |
| title trimmed > 150 chars | `Workflow title must be 150 characters or fewer.` |
| another non-deleted workflow has the same title, case-insensitive, trimmed (on update ignore the workflow itself) | `A workflow with this title already exists.` |
| description > 1000 chars | `Description must be 1000 characters or fewer.` |
| steps null or empty | `A workflow needs at least one step.` |
| steps > 20 | `A workflow can have at most 20 steps.` |
| step name trimmed empty | `Step {n}: name is required.` |
| step name > 100 | `Step {n}: name must be 100 characters or fewer.` |
| step instructions (Description) > 500 | `Step {n}: instructions must be 500 characters or fewer.` |
| approver role id does not exist | `Step {n}: the approver role was not found.` |
| OnRejectAction not exactly `GoBack` or `Cancel` | `Step {n}: reject action must be GoBack or Cancel.` |
| EscalationHours given and not in 1..720 | `Step {n}: escalation must be between 1 and 720 hours.` |
| (PUT only) Status not exactly `Draft`, `Active` or `Inactive` | `Status must be Draft, Active or Inactive.` |

Also: ignore the client's `StepOrder` values and store 1..n by array position. Store trimmed title, trimmed description (empty string if null), trimmed step name/instructions. Existing rules stay (update refuses with the existing message when tasks are in progress, etc.).

### 4. `POST /api/Workflow` accepts an optional `Status`

`WorkflowCreateRequest` gets a trailing optional `string? Status = null` (null or `Draft` = Draft as today; `Active` = created Active and publishes the `WorkflowActivated` event; anything else = 400 `Status must be Draft or Active when creating.`). Keep existing callers/tests compiling (default value).

### 5. `GET /api/Workflow` (paged) items gain fields

Keep `workflowId, title, status, stepCount` and the paging envelope unchanged (Assign Task relies on them). Add per item:
`description` (string|null), `createdByName` (string), `createdAt` (ISO), `activeTaskCount` (int: tasks of that workflow with Status `Pending` or `In Progress`; same definition as `HasActiveTasksAsync`), `steps` (array ordered by step order of `{ stepOrder, stepName, approverRoleName }`).
Must be computed without an N+1 (one query for the page with a projection or one grouped query for counts).
Do NOT add filtering or counts to this endpoint.

## Frontend

* Routes: `/workflows` (list), `/workflows/new`, `/workflows/:id/edit`. Keep the existing role guard of `/workflows` on all three. Update breadcrumbs.
* List: load `GET /Workflow?page=1&limit=200` once. Status chips (All / Active / Draft / Inactive with counts) and search filter that loaded set in the browser (workflows are templates; if `total` > 200 show a notice "Showing the first 200 workflows"). 
* Rows per option M: title + status chip + "In use by N tasks" lock chip, description, the journey line from `steps`, meta (steps count, created by/at), labelled buttons Edit / Clone / Activate or Deactivate, expandable details toggled by a **"Show details" / "Hide details" button placed at the right end of the meta line (bottom-right corner of the row), styled like the "New workflow" button (primary, bold) but small (`btn btn-primary btn-sm`) with a chevron, `aria-expanded` set** (fetch `GET /Workflow/{id}`, cache) showing the full journey with instructions, reject behaviour and escalation.
* Locked workflows (`activeTaskCount > 0`): Edit and Deactivate are `aria-disabled` and clicking shows a banner explaining why. Opening `/workflows/:id/edit` for a locked workflow shows the same explanation with a back link instead of the form.
* Builder: per option M. Use `approverRoleId` from the detail and the roles from `GET /Workflow/roles`; default role for a new step = first role returned. No hard-coded role ids.
* Actions: Activate = `POST /Workflow/{id}/activate`; Clone = existing `POST /Workflow/{id}/clone`; Deactivate = existing `DELETE`. New workflow: "Save as draft" = POST with `status: "Draft"`, "Save and activate" = POST with `status: "Active"`. Edit: PUT keeping the current status. Each of Activate, Deactivate, Clone, Save and activate, and Save changes goes through a confirmation dialog. Server 400/404/409 messages are shown in a banner (role=alert, focus) and also leave the user where they are.
* Demo mode: the mock follows all of the above with the same messages (duplicate title, validation, locked workflows from demo task data).
