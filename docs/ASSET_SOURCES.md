# Asset sources

## Illustrations

All scene illustrations come from **unDraw** (https://undraw.co), downloaded manually by the project owner on 2026-10-09.

- Licence: https://undraw.co/license. Free for commercial and non-commercial use, no attribution required, modification allowed.
- Restrictions to respect: no scraping or bulk/automated download, no redistribution of the assets as a pack, no use to train or test AI systems.
- Processing: the downloaded SVGs were recoloured in place (colour values replaced by `--ill-*` CSS variables defined in `src/index.css`) and the fixed width/height removed. Shapes are unchanged.

| Asset in `src/assets/illustrations/` | unDraw file | Used on |
|---|---|---|
| `secure-login.svg` | secure_login.svg | Login brand panel |
| `forgot-password.svg` | forgot_password.svg | Forgot Password brand panel |
| `reset-password.svg` | reset_password.svg | Reset Password brand panel |
| `access-denied.svg` | access_denied.svg | Invalid reset link, OAuth error |
| `not-found.svg` | page_not_found.svg | Not Found page |
| `task-list.svg` | task_list.svg | My Tasks empty state |
| `process.svg` | process.svg | Workflows empty state, OAuth loading |
| `empty.svg` | empty.svg | Empty activity, filters, audit log |

Downloaded but not used: `page_not_found_2.svg` (alternative 404).

## Logo and favicon

The Fork X mark (`src/assets/Logo.tsx`, `public/favicon.svg`) was drawn for this project.
