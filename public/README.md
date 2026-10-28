# public/ — frontend

Static files served by Express. Plain HTML + Bootstrap 5.3 (CDN) + vanilla JavaScript, no build step.

## Files

| File | What it does |
|------|--------------|
| `index.html` | Landing page with links to log in and sign up. No JavaScript. |
| `login.html`, `register.html` | Auth forms. Logic in `js/auth.js`. |
| `dashboard.html` | "My projects": cards, search, role filter, "New project" modal. Logic in `js/dashboard.js`. |
| `project.html` | Kanban board (To do / In progress / Done), members panel, add task, edit/delete project. Logic in `js/project.js`. |
| `task.html` | Task details, properties form, comments, edit/delete. Logic in `js/task.js`. |
| `css/styles.css` | Brand colours and font mapped onto Bootstrap's CSS variables, plus a few own classes (board column, priority badges, avatar). |
| `js/api.js` | The only place that calls `fetch`. Adds the JWT header, turns error responses into `ApiError` (status + field details), sends the user to login on 401. |
| `js/auth.js` | Validates the forms in the browser, calls `/api/auth/login` or `/register`, saves the token, opens the dashboard. |
| `js/ui.js` | Shared helpers for logged-in pages: redirect if no token, user menu + log out, safe DOM builder `el()`, dates, badges, toasts, delete confirmation. |

Each page loads, in order: Bootstrap JS → `api.js` → `ui.js` (logged-in pages) → the page's own script.

## Points to explain in the viva

1. **Why Bootstrap variables, not Sass.** Bootstrap 5.3 reads colours from CSS variables (`--bs-primary`, `--bs-body-bg`…), so overriding them in `styles.css` re-themes everything without a build step. Buttons are the exception: `.btn-primary` has its own `--bs-btn-*` variables, so `styles.css` sets those too.
2. **JWT storage.** The token is kept in `localStorage` and sent as `Authorization: Bearer <token>`. Trade-off: simple and works with a separate API, but readable by any script on the page, which is why we never insert user text as HTML.
3. **XSS protection.** All user data (project names, task titles, comments) goes into the page through `textContent` (the `el()` helper), never `innerHTML`. A comment like `<b>hi</b>` shows as text.
4. **Validation twice.** The browser checks required fields, email format, password length and matching passwords for quick feedback. The server validates again because browser checks can be bypassed. Server field errors (`details: [{field, message}]`) are shown under the matching input.
5. **Error handling.** 401 → token cleared, back to login. 403 → "You are not a member of this project". 404 → "does not exist". Network failure → readable message.
6. **Optimistic update.** Moving a card (← / →) updates the board immediately, then sends `PUT /api/tasks/:id`; if the server refuses, the card moves back.
7. **Accessibility.** Labels on every input, `aria-label` on icon buttons, visible focus ring, colour contrast ≥ 4.5:1, priority shown as a word as well as a colour, delete always asks for confirmation in a modal, `prefers-reduced-motion` respected.
8. **Responsive.** Bootstrap grid: three kanban columns from 768px, stacked on phones; navbar collapses to a burger below 992px; on the task page the properties move above the comments on phones. Checked at 375px and 1280px with no horizontal scroll.

## API used

Contract agreed with the backend (see `docs/api.md` when it exists):
`/api/auth/register`, `/api/auth/login`, `/api/projects`, `/api/projects/:id`, `/api/projects/:id/members`, `/api/projects/:id/tasks`, `/api/tasks/:id`, `/api/tasks/:id/comments`.
