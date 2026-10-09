# Assign Task: contract (frontend + backend must both follow this)

Screen `/assign`, Admin and Manager only. Design reference (open it in a browser): `D:\aa\SmartX\assign-task-options.html`. The agreed design is a **hybrid of options K and J**:

* **Two-step wizard.** Step 1 "The task" (title, description with Formalize with AI + Restore original, priority, category, due date with quick chips). Step 2 "Workflow and person" (workflow cards, searchable person picker). There is NO separate third review page.
* **A live "What will happen" card** (option J) stays visible at every step: desktop = sticky right column (340px); phone = below the form. Shows title, workflow, assignee, priority, due, category and the **Journey** (Step 0 "<assignee> does the work", then each workflow step "<stepName>, Any <ApproverRoleName> can approve, first to act wins", then "Task completed").
* **Primary button** on step 1 = "Continue". On step 2 = "Review and assign", which opens a **confirmation dialog** (alertdialog, focus trap, Esc cancels, spinner while saving, summary of task/workflow/assignee/due/priority, what happens next). Only "Yes, assign" posts.
* **Success state** replaces the form: "Task assigned" with buttons "Assign another with the same workflow" (keeps workflow, priority, category; clears title, description, person, due), "Start a blank form", and "View in All Tasks" (a router link to `/all-tasks?q=<title>`).
* Validation messages inline next to fields, a warning summary, focus moves to the first invalid field. Server 400 messages are shown in a warning banner and focus moves to it.

## Backend

### 1. `GET /api/Task/assignable-users`  (Manager, Admin)

Currently implemented with `IUserRepository.GetAllWithRolesAsync`, which calls `IgnoreQueryFilters()` and therefore **returns soft-deleted users**: they can be picked and given tasks. That is a bug.

New behaviour: only active users (not `IsDeleted`), ordered by Name. Do NOT change `GetAllWithRolesAsync` (Admin user management relies on it); add a new repository method.

Response: array of `{ userId, name, email, roleName, openTaskCount }` where `openTaskCount` = number of that user's tasks with `AssignedTo == userId` and Status `Pending` or `In Progress`, computed with one grouped query (no N+1).

### 2. `POST /api/Task/assign`  (Manager, Admin): validation

Keep the request/response shape (`{ message, taskId }`). Add, in `TaskService.AssignTaskAsync`, before anything is saved, in this order, each failing with `ArgumentException` (the middleware maps it to 400) and these exact messages:

| rule | message |
|---|---|
| title trimmed is empty | `Task title is required.` |
| title trimmed longer than 200 | `Task title must be 200 characters or fewer.` |
| description longer than 2000 | `Description must be 2000 characters or fewer.` |
| priority not exactly `Low`, `Medium` or `High` | `Priority must be Low, Medium or High.` |
| assignee does not exist or is soft-deleted | `The selected person was not found or is deactivated.` |
| category given but does not exist | `The selected category was not found.` |
| due date given and its UTC date is earlier than yesterday's UTC date | `The due date cannot be in the past.` |

(The one-day tolerance is deliberate: a client in a timezone behind UTC can legitimately pick "today" while UTC is already tomorrow.) Existing checks stay: workflow must exist (404), be Active and have steps (400). Store the trimmed title; store description as trimmed text (empty string when null).

## Frontend

* Wire to the two endpoints above. `openTaskCount` is optional: show "N open" next to a person only when the field is present.
* Workflow list: keep `GET /Workflow?page=1&limit=1000` and filter Active in the browser. Workflow steps for the journey: `GET /Workflow/{id}` (response has `steps[]` with `stepName`, `approverRoleName`, `stepOrder`); fetch on selection and cache per id; show a skeleton line while loading and a polite fallback if it fails (the journey then shows only Step 0 and Completed).
* Demo mode (`src/demo/mockAdapter.ts`): mock must follow the same rules (exclude deleted users from assignable-users and add `openTaskCount`; the same validations/messages on `POST /Task/assign`).
