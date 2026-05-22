# SmartWorkFlowX — Frontend

A production-ready React 19 single-page application for enterprise workflow management. The frontend provides role-aware dashboards, a visual workflow builder, a multi-step task approval interface, real-time notifications via SignalR, and AI-assisted description generation powered by Groq.

**Live application:** https://smart-work-flow-x-frontend.vercel.app  
**Backend API:** https://smartworkflowx-backend-dhbdgxeec2fpd6fc.centralindia-01.azurewebsites.net

**Admin login credentials (demo environment):**
- Email: `admin@smartworkflowx.com`
- Password: `password123`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite |
| Routing | React Router v7 |
| HTTP client | Axios (with JWT interceptor) |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Notifications (UI) | React Toastify |
| Real-time | Azure SignalR client (`@microsoft/signalr`) |
| Testing | Vitest + React Testing Library |
| CI | GitHub Actions (test-only, runs on `main`) |
| Hosting | Vercel (auto-deploys on push to `main`) |

---

## Core Features

**Authentication**
- Email and password login with client-side validation via Zod
- Google OAuth 2.0 — single-click sign-in for registered users
- Forgot password flow with Cloudflare Turnstile CAPTCHA
- Password reset via time-limited token link

**Role-aware UI**

The interface adapts based on the authenticated user's role. Navigation items, buttons, and pages are conditionally rendered per role:

| Role | What they see |
|---|---|
| Admin | User Management, Workflow Builder, All Tasks, Reports, Audit Logs, Notifications |
| Manager | Workflow Builder, Task Assignment, All Tasks, Reports |
| Employee | My Tasks, My Activity |
| Auditor | Reports, Audit Logs (read-only) |

**Dashboard**
- Live task status distribution with counts for Pending, In Progress, Completed, and Overdue
- Overdue task highlighting for Managers and Admins

**Workflow Builder (Manager/Admin)**
- Create and edit multi-step approval workflows
- Each step configures the approver role, step name, on-reject action (GoBack or Cancel), and an optional escalation timeout in hours
- Clone an existing workflow to use as a template
- Activate or deactivate workflows; deactivation blocked if active tasks exist

**Task Management**
- Assign tasks to an active workflow with title, description, assignee, priority, category, and due date
- Approval interface: Employees and Managers act on tasks in their queue — approve or reject with a comment
- Rejection routes the task back to the originator (GoBack) or cancels it (Cancel) depending on the step configuration
- Paginated task history showing every action in the approval chain

**My Tasks (Employee)**
- Employees see only tasks assigned to them
- Full step history visible per task

**Notifications**
- Bell icon in the header shows unread count, updated in real time via SignalR
- Notification list with mark-as-read and mark-all-as-read
- Admins can broadcast a message to all users or to a specific role

**Reports (Admin/Manager/Auditor)**
- System analytics: total users, active workflows, task status breakdown, average completion time, tasks-per-user chart
- Overdue task report
- Paginated audit log with user and action details (Admin/Auditor only)
- CSV export for user data

**User Management (Admin only)**
- Paginated user list with search
- Register new users with role assignment; welcome email sent automatically
- Soft-delete (deactivate) users and restore them
- Users who are deactivated cannot log in until restored

---

## AI Integration — Groq (llama-3.1-8b-instant)

The application integrates with the Groq API via the backend's `POST /api/Task/formalize-description` endpoint. The model used is `llama-3.1-8b-instant`.

**Where it appears:**

- **Task Assignment form** — a "Formalize Description" button sends the user's raw description text to the Groq endpoint with context `"task"`. The model returns a concise, professional 2–3 sentence description that replaces the input.
- **Workflow Builder** — the same button appears on the workflow description field with context `"workflow"`, generating an appropriate description for the workflow's purpose.

The Groq call is made server-side (backend proxies the request), so the API key is never exposed to the browser. Only Manager and Admin roles can use this feature.

---

## Local Development

**Prerequisites**
- Node.js 18 or later
- The SmartWorkFlowX backend API running locally at `https://localhost:52082` (or update `src/api/axiosInstance.ts` to point to the deployed API)

```bash
# 1. Clone
git clone https://github.com/Archit-Chauhan/SmartWorkFlowX_Frontend.git
cd SmartWorkFlowX_Frontend

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app runs at `http://localhost:5173`.

To connect to the live backend instead of a local instance, update the `baseURL` in `src/api/axiosInstance.ts`.

---

## Running Tests

The test suite uses Vitest and React Testing Library. All test files are located in `src/test/`.

```bash
# Run all tests once (CI mode — no watch)
npm run test:run

# Run tests in interactive watch mode
npm test

# Run a specific test file
npm run test:run -- src/test/Login.test.tsx
```

**Test coverage by file:**

| File | TC-IDs | What is tested |
|---|---|---|
| `src/test/Login.test.tsx` | TC-A01, TC-A02, TC-A03, TC-A04, TC-A14, TC-A18 | Login form submission, error messages, validation, rendering |
| `src/test/UserManagement.test.tsx` | TC-U01, TC-U03, TC-U07 | User list fetch, registration form submission, soft-delete confirmation modal |

The CI workflow at `.github/workflows/ci.yml` runs `npm run test:run` automatically on every push and pull request to `main`.

---

## CI/CD Pipeline

**Frontend (Vercel):** Vercel watches the `main` branch directly. Every push triggers an automatic production build and deployment — no manual steps required. The deployment pipeline is managed entirely by Vercel and does not appear in GitHub Actions.

**Test CI (GitHub Actions):** A separate test-only workflow at `.github/workflows/ci.yml` runs the Vitest suite on `ubuntu-latest` for every push and pull request to `main`. This ensures tests are verified independently of the Vercel deployment.

---

## Project Structure

```
src/
  api/              — Axios instance with JWT Authorization header interceptor
  components/       — Shared UI components (Pagination, ConfirmationModal, etc.)
  context/          — AuthContext (login, logout, user state)
  features/
    auth/           — Login, ForgotPassword, ResetPassword, UserManagement
    tasks/          — TaskAssign, TaskList, MyTasks, TaskHistory, MyActivity
    workflows/      — WorkflowBuilder, WorkflowList
    notifications/  — NotificationPanel, BroadcastForm
    reports/        — Analytics, AuditLog, OverdueTasks
    dashboard/      — Dashboard home page
  models/           — TypeScript interfaces for all API response shapes
  test/             — Vitest test files
```
