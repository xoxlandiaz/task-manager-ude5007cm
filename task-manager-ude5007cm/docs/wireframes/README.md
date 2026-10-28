# Wireframes

Low-fidelity wireframes for the six pages in `public/`. Grey blocks are content placeholders; the mint labels name the Bootstrap 5 components to use and the API calls each page's script makes. Sample names and numbers are illustrative only.

Interactive canvas (private, owner only): https://claude.ai/artifact/NwVDdn6Z5GZT4V8Pu2hQmE

| Page | File | Desktop (1280px) | Phone (390px) |
|------|------|------------------|---------------|
| Landing | `public/index.html` | [index.png](index.png) | [index-mobile.png](index-mobile.png) |
| Log in | `public/login.html` | [login.png](login.png) | [login-mobile.png](login-mobile.png) |
| Sign up | `public/register.html` | [register.png](register.png) | [register-mobile.png](register-mobile.png) |
| My projects | `public/dashboard.html` | [dashboard.png](dashboard.png) | [dashboard-mobile.png](dashboard-mobile.png) |
| Project board | `public/project.html` | [project.png](project.png) | [project-mobile.png](project-mobile.png) |
| Task details | `public/task.html` | [task.png](task.png) | [task-mobile.png](task-mobile.png) |

## Page flow

`index` → `login` / `register` → `dashboard` → `project` → `task`

## Design direction

- Chosen style: "A · Teal Flat". Primary #0F766E, accent #C2410C, background #F3F7F6, font Plus Jakarta Sans.
- Accessibility: text contrast at least 4.5:1, visible keyboard focus, labels on every input, priority shown as text as well as colour.
- Responsive checks at 375, 768, 1024 and 1440px.
