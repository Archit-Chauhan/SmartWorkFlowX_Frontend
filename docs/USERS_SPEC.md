# Manage Users: contract (frontend + backend must both follow this)

Screen `/users`, Admin only. Design reference (open in a browser): `D:\aa\SmartX\users-options.html`, **option P** ("Table + user panel"). The backend table at the bottom of that page is the origin of this contract. NOT in scope now: the "send a set-your-password link instead of e-mailing the password" idea (item 5 on that page). The invite form therefore keeps asking the Admin for a temporary password (see Frontend).

## Backend

### 1. `GET /api/Admin/users`: filters, sorting, counts, open task count

Query: existing `page` (default 1), `limit` (default 10), `search` (name or email, as today) plus
`status` = `all` (default) | `active` | `deactivated`, `roleId` (int, optional), `sort` = `name` (default) | `role` | `status` | `open` | `added`, `dir` = `asc` (default) | `desc`.
Unknown `status`, `sort` or `dir` = `ArgumentException` (400) with `Status must be all, active or deactivated.` / `Sort must be one of: name, role, status, open, added.` / `Direction must be asc or desc.`

Ordering: the chosen key in `dir`, ties broken by `UserId asc` (stable across pages). `status` sorts active before deactivated when asc. `added` = `CreatedAt`. `open` = open task count.

Response (additive; keep `data`, `total`, `page`, `pageSize` exactly as today):
```json
{ "data":[{ "userId":1,"name":"..","email":"..","roleName":"Admin","roleId":1,"createdAt":"..","isDeleted":false,"deletedAt":null,"openTaskCount":3 }],
  "total":23,"page":1,"pageSize":10,
  "counts":{ "all":23,"active":20,"deactivated":3 } }
```
* `total` = rows matching search + roleId + status.
* `counts` = rows matching search + roleId only (ignoring `status`); `all = active + deactivated`.
* `openTaskCount` = that user's tasks with `AssignedTo == userId` and Status `Pending` or `In Progress` (soft-deleted tasks excluded by the global filter). One grouped query for the page's users, no N+1.
* This list includes soft-deleted users (as today): the Admin list must keep `IgnoreQueryFilters` for Users.

`GET /api/Admin/users/export`: also accept the same optional `status` and `roleId` filters (same validation) so the CSV matches what is on screen. Keep its output columns.

### 2. `PUT /api/Admin/users/{id}/role`  body `{ "roleId": 2 }`  (Admin only like the rest of the controller)

In this order, failing with these exceptions/messages:
| rule | exception | message |
|---|---|---|
| user does not exist (including soft-deleted: look up ignoring the filter) | KeyNotFound (404) | `User not found.` |
| role does not exist | ArgumentException (400) | `The selected role was not found.` |
| target is the acting user | ArgumentException | `You cannot change your own role.` |
| target is deactivated | ArgumentException | `Restore the user before changing their role.` |
| same role as now | none: return 200 `{ message: "Role unchanged." }` without writing | |
| target is an active Admin and the new role is not Admin and they are the only active Admin | ArgumentException | `The last active Admin cannot be demoted. Make someone else an Admin first.` |
Otherwise set the role, write an `AuditLog` (`Admin changed role of user '{email}' (ID={id}) from {old} to {new}.`, EntityName `Users`), save, return `{ message: "Role updated successfully." }`. (JWTs already issued keep the old role until they expire: note this in your report, do not try to fix it.)

### 3. `DELETE /api/Admin/users/{id}` (deactivate)

Keep the existing self-delete rule and its message. Add: if the target is an active Admin and the only active Admin: `ArgumentException("The last active Admin cannot be deactivated. Make someone else an Admin first.")`.

### 4. `POST /api/Admin/users` validation

Checked in this order (ArgumentException = 400), before saving; trim name and email, lower-case the email:
| rule | message |
|---|---|
| name empty | `Name is required.` |
| name > 100 | `Name must be 100 characters or fewer.` |
| email empty or not a valid address (use a simple, safe check such as `System.Net.Mail.MailAddress` parse with exact-match to the trimmed value, or a conservative regex) | `Enter a valid email address.` |
| email > 200 | `Email must be 200 characters or fewer.` |
| email already used by a deactivated user | `A deactivated user with this email already exists. Restore them instead.` |
| email already used by an active user | `A user with this email already exists.` |
| password empty or shorter than 8 | `Password must be at least 8 characters.` |
| role id does not exist | `The selected role was not found.` |
Important: the request record currently has `[Required]`, `[EmailAddress]`, `[MinLength(6)]` annotations and the controller returns `BadRequest(ModelState)` when invalid, which would pre-empt the messages above and use a different error shape. Check whether `UserCreateRequest` is also used by AuthController registration; if it is, do not weaken Auth behaviour (create a separate admin request record or keep annotations for Auth). The admin endpoint must produce the messages above through ArgumentException. Keep the response `{ message, userId }` and the existing audit/e-mail behaviour unchanged (do NOT touch the e-mail content).

## Frontend

* Table + panel exactly as option P: toolbar (status chips All/Active/Deactivated with `counts`, role select from `GET /Admin/roles` (no hard-coded role list), search debounced 300 ms, Export CSV, Invite user), sortable columns (aria-sort) User / Role / Status / Open tasks / Added, row click or "Manage" opens the panel, server paging (10 per page) with the shared Pagination, URL-synced state (`q, status, roleId, sort, dir, page`) in the style of All Tasks. DiceBear avatar (existing UserAvatar component).
* Panel: details (status, role, open tasks, added), "Change role" role cards (descriptions as in the design), the self / last-Admin guards shown as text and disabled cards, Deactivate / Restore with confirmation dialogs that mention open tasks. Role change = `PUT /Admin/users/{id}/role` behind a confirmation dialog.
* Invite drawer: name, email, role cards, **temporary password** field (text input with show/hide toggle, a "Generate" button that fills a strong 12-character password, a "Copy" button; at least 8 characters) because the e-mail-link flow is not built yet. Submit = `POST /Admin/users` `{ name, email, password, roleId }`; server 400 messages go into a banner (role=alert) inside the drawer.
* After any change refetch the list; toast on success; server 400/404 messages shown in the panel/drawer banner.
* Demo mode: the mock follows all of the above with the same messages (including the last-Admin and self rules, counts, filters, sorting, openTaskCount from demo tasks, duplicate email incl. deactivated).
