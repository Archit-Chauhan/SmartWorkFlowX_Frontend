# SmartWorkFlowX UI Revamp: Specification

Branch: `ui-revamp` (single branch; the whole revamp ships or reverts as one merge).
Design sources (downloaded specs in `D:\aa\designs`): Linear (dark surfaces, single accent), IBM Carbon (light theme, semantics, forms, Plex), Sentry (chart colors only).

## 1. Goals
- One coherent visual system across every screen, with a **light/dark toggle**.
- Dense, calm, enterprise-appropriate. Flat surfaces with 1px borders; **no drop shadows** except modals and dropdowns.
- **Styling only.** No behavior, API, routing, props, text, placeholders, ARIA roles or handler changes. Existing tests (`src/test`) query by text and placeholder and must keep passing unchanged.

## 2. Design rules
1. **One brand accent** (`accent`, lavender #5e6ad2): primary buttons, selected nav item, focus ring, links. Never as a card fill or for status.
2. **Status colors are fixed and separate**: pending = gray, in progress = blue, completed = green, rejected/cancelled = red, warning = yellow. Never use the accent for status.
3. **Tokens only.** No raw Tailwind palette classes (`bg-gray-*`, `text-blue-*`, `bg-red-50`, `border-gray-*`, `bg-white`, `text-gray-*`) and no hex values in components. Use token utilities: `bg-canvas`, `bg-surface-1`, `bg-surface-2`, `text-ink`, `text-ink-muted`, `text-ink-subtle`, `border-hairline`, `bg-accent`, `text-accent`, `text-error`, `bg-error`, `text-success`, `text-info`, `text-warning`, `bg-status-*`, `bg-accent-soft`.
4. **Radius**: controls (buttons, inputs, chips) `rounded-control` (4px); cards, panels, modals, dropdowns `rounded-card` (6px); pills only for status pills and avatars (`rounded-pill`). Remove `rounded-xl`, `rounded-2xl`, `rounded-lg` from cards/buttons.
5. **Borders over shadows**: cards = `bg-canvas border border-hairline rounded-card`. Elevation (shadow) only for modal and dropdown/bell panel.
6. **Type**: IBM Plex Sans (already default), IBM Plex Mono for IDs/timestamps (`font-mono`). Sizes: page title 24px/600, section title 16px/600, body 14px, caption 12px. No bold-everywhere: hierarchy via size + color (`text-ink` / `text-ink-muted` / `text-ink-subtle`).
7. **Density**: table rows 36px (`h-row`), controls 40px (`h-control`); 44px+ tap targets on touch is handled by the component classes. Spacing on the 4px grid.
8. **Focus**: every interactive element shows a 2px `--focus-ring` outline (global `:focus-visible` rule). Never remove outlines without replacement.
9. **Contrast**: body text must meet WCAG AA in both themes. Muted text only for secondary info.
10. Respect `prefers-reduced-motion`; keep transitions to 150ms color/background only.
11. Dark mode works automatically through tokens. **Do not add `dark:` utilities** in feature code; if a value needs to differ per theme it belongs in a token.

## 3. Shared component classes (contract)
Defined in `src/index.css` under `@layer components`. Feature code uses these instead of long utility strings.

| Class | Use |
|---|---|
| `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-danger` / `.btn-ghost` | Buttons. 40px high, 4px radius. Add `.btn-sm` (36px) for table rows. |
| `.input` | Text input, select, textarea. Surface-1 fill, bottom-border focus, `.input-error` for errors. |
| `.label` | Form label (12px, ink-muted). `.field-error` for error text. |
| `.card` | Bordered panel. `.card-pad` adds 24px padding. |
| `.table` | Wrapper class on `<table>`: sticky header on surface-1, 36px rows, hairline row dividers, hover row. |
| `.chip` + `.chip-pending` / `-progress` / `-completed` / `-rejected` / `-warning` / `-neutral` | Status and priority pills. |
| `.page-title`, `.section-title`, `.caption` | Typographic roles. |
| `.empty-state` | Centered muted empty/loading message. |
| `.alert` + `.alert-error` / `-success` / `-info` | Inline messages. |

## 4. Theme toggle
- `useTheme` (`src/hooks/useTheme.ts`, provider-free store) exposes `{ theme, setTheme, toggle }`, with theme `'light' | 'dark'`.
- Initial value: saved `swfx-theme` in localStorage, else the OS `prefers-color-scheme`. Applied by setting `data-theme` on `<html>`.
- A tiny inline script in `index.html` sets `data-theme` before first paint (no flash). All storage access in try/catch.
- Toggle button (sun/moon icon, `aria-label="Toggle theme"`) in the header, and on the auth screens (top-right).

## 5. Screen-by-screen
- **Shell**: sidebar uses the surface ladder (dark in both themes: `surface-1` in dark, a charcoal sidebar token in light); active item = accent text + accent-soft background + 2px left accent bar; header 56px, bottom hairline; footer minimal.
- **Auth (Login, Forgot, Reset, OAuth callback)**: centered 400px card on `surface-1` page, Plex wordmark, 40px inputs, one primary button, Turnstile area unchanged.
- **Dashboard / Reports**: stat cards (label caption, 24px value, no icon backgrounds in rainbow colors), charts use `--chart-1..5` via `var()` strings, grid and axis colors from tokens, tooltip on card surface.
- **My Tasks (Action Center)**: compact list/table, title + workflow + category, priority chip, status chip, due date in mono, inline Approve (primary-sm) / Reject (danger ghost) actions. Unclaimed role-pool tasks get a small "Team queue" neutral chip only if the data already exposes it; otherwise unchanged.
- **All Tasks, Assign Task**: filter bar on a card, table per `.table`, form per `.input`/`.label`.
- **Workflow Builder**: step cards stacked with a numbered rail, per-step reject-action control, clear add/remove affordances.
- **User Management, Audit Log**: tables per `.table`, role shown as neutral chip, actions as ghost icon buttons with `title`.
- **Modals / Toasts / Notifications / Pagination**: modal on `canvas` with hairline border, overlay token; toast uses alert styles; bell panel = dropdown elevation.

## 6. Work split (disjoint files)
- **Foundation (lead)**: `index.css`, `index.html`, `ThemeContext`, `main.tsx`, `layout/*`, `components/*`.
- **Agent A, Tasks**: `features/tasks/*`.
- **Agent B, Workflows and Users**: `features/workflows/*`, `features/auth/UserManagement.tsx`.
- **Agent C, Auth and Reports**: `features/auth/{Login,ForgotPassword,ResetPassword,OAuthCallback}.tsx`, `features/reports/*`, `features/dashboard/*`.
Agents may not edit files outside their set. If a needed class is missing, they report it instead of inventing one.

## 7. Acceptance checklist
- [ ] `npm run lint`, `npx tsc -b`, `npm run test:run`, `npm run build` all pass.
- [ ] `grep` finds no `bg-gray-|text-gray-|border-gray-|bg-blue-|text-blue-|bg-red-|bg-green-|bg-white|text-white`-style raw palette classes in `src/` except an explicit allowlist (`text-on-accent`, overlay).
- [ ] Every screen reviewed in light **and** dark at 1280px and 390px widths via browser screenshots; no unreadable text, no overflow.
- [ ] Toggle persists across reload; no flash on load.
- [ ] Keyboard focus visible everywhere.

## 8. Rollout and rollback
- All work on `ui-revamp`; merge to `main` as **one merge commit** (`--no-ff`) so a single `git revert -m 1 <merge>` restores the previous UI. Vercel redeploys from `main`.
- Backend untouched.
