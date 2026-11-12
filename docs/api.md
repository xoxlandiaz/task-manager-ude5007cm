# REST API

Base URL: `/api`. Requests and responses are JSON (`Content-Type: application/json`).

## Conventions

**Authentication.** Every endpoint except `GET /health`, `POST /auth/register` and `POST /auth/login` needs a JWT:

```
Authorization: Bearer <token>
```

The token comes from register or login and is valid for `JWT_EXPIRES_IN` (default `1d`).

**Errors.** Every error has the same shape:

```json
{
  "error": "Validation failed",
  "details": [{ "field": "email", "message": "Enter a valid email address." }]
}
```

`details` lists the invalid fields for validation errors and is `[]` otherwise.

| Status | Meaning |
|---|---|
| `400` | Invalid input: a field failed validation, the JSON is malformed, or an id in the URL is not a positive integer |
| `401` | Missing, invalid or expired token; wrong email or password on login |
| `403` | Signed in, but not allowed: not a member of the project, or the action is for the owner only |
| `404` | The project, task, comment or user does not exist |
| `409` | Already exists: the email is registered, or the user is already a member |
| `500` | Unexpected server error. The message is always `Internal server error` |

**Access rules.** A user sees a project, its tasks and its comments only as a member of that project. Any member can create, edit and delete tasks and write comments. Only the owner can rename or delete the project and add or remove members.

**Formats.** Timestamps are ISO 8601 in UTC (`2026-11-12T05:13:35.319Z`). `due_date` is a plain date, `YYYY-MM-DD`. Text fields are trimmed; an empty optional text is stored as `null`.

## Endpoints

| Method | Path | Purpose | Who |
|---|---|---|---|
| GET | `/health` | Health check | anyone |
| POST | `/auth/register` | Create an account | anyone |
| POST | `/auth/login` | Sign in | anyone |
| GET | `/auth/me` | Current user | signed in |
| GET | `/users` | List or search users | signed in |
| GET | `/users/me` | Current user | signed in |
| GET | `/users/:id` | One user | signed in |
| GET | `/projects` | My projects | signed in |
| POST | `/projects` | Create a project | signed in |
| GET | `/projects/:id` | One project | member |
| PUT | `/projects/:id` | Rename a project, change its description | owner |
| DELETE | `/projects/:id` | Delete a project with its tasks and comments | owner |
| GET | `/projects/:id/members` | Project members | member |
| POST | `/projects/:id/members` | Add a member by email | owner |
| DELETE | `/projects/:id/members/:userId` | Remove a member | owner |
| GET | `/projects/:id/tasks` | Tasks of a project | member |
| POST | `/projects/:id/tasks` | Create a task | member |
| GET | `/tasks/:id` | One task | member |
| PUT | `/tasks/:id` | Update a task (any subset of fields) | member |
| DELETE | `/tasks/:id` | Delete a task with its comments | member |
| GET | `/tasks/:id/comments` | Comments of a task | member |
| POST | `/tasks/:id/comments` | Add a comment | member |
| DELETE | `/comments/:id` | Delete a comment | author or project owner |

`GET /comments/:taskId` and `POST /comments/:taskId` are aliases of the two `/tasks/:id/comments` endpoints.

## Health

### GET /health

```json
{ "status": "ok" }
```

## Auth

### POST /auth/register

| Field | Rules |
|---|---|
| `name` | required, up to 100 characters |
| `email` | required, valid email, up to 255 characters; stored in lower case |
| `password` | required, 8 to 72 characters; stored only as a bcrypt hash |

`201`:

```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 1, "name": "Aki Demo", "email": "aki@example.com" }
}
```

Errors: `400` validation, `409` email already registered.

### POST /auth/login

Body: `email`, `password`. `200` returns the same `{ token, user }` as register.

Errors: `400` validation, `401` `Invalid email or password` (the same message for an unknown email and a wrong password).

### GET /auth/me

`200`:

```json
{ "user": { "id": 1, "name": "Aki Demo", "email": "aki@example.com", "created_at": "2026-11-12T05:13:35.058Z" } }
```

## Users

A user object is `{ id, name, email, created_at }`. The password hash is never returned.

### GET /users

Returns an array of users sorted by name. `?search=text` (or `?q=text`) keeps users whose name or email contains the text, ignoring case. Returns at most 100 users, or 50 with a search.

### GET /users/me

Same response as `GET /auth/me`.

### GET /users/:id

`200` one user object. Errors: `400` invalid id, `404`.

## Projects

A project object:

```json
{
  "id": 1,
  "name": "Coursework UDE5007CM",
  "description": "Full-stack task manager",
  "owner_id": 1,
  "created_at": "2026-11-12T05:13:35.319Z",
  "updated_at": "2026-11-12T05:13:35.319Z",
  "role": "owner",
  "task_count": 7,
  "done_count": 2,
  "member_count": 3
}
```

`role` is the current user's role in the project: `owner` or `member`.

### GET /projects

`200` array of the projects the current user is a member of, most recently updated first.

### POST /projects

| Field | Rules |
|---|---|
| `name` | required, up to 150 characters |
| `description` | optional text or `null` |

`201` the project object. The creator becomes its owner. Errors: `400`.

### GET /projects/:id

`200` the project object. Errors: `400` invalid id, `403` not a member, `404`.

### PUT /projects/:id

Same body as create. `name` is required; `description` is changed only if it is sent. `200` the updated project. Errors: `400`, `403` not the owner, `404`.

### DELETE /projects/:id

`204`, no body. The project's members, tasks and comments are deleted with it. Errors: `400`, `403` not the owner, `404`.

## Members

A member object:

```json
{
  "project_id": 1,
  "user_id": 2,
  "role": "member",
  "joined_at": "2026-11-12T05:13:35.342Z",
  "name": "Maria Ivanova",
  "email": "maria@example.com"
}
```

### GET /projects/:id/members

`200` array of members, the owner first. Errors: `400`, `403` not a member, `404`.

### POST /projects/:id/members

Body: `email` of an existing account. `201` the new member object with role `member`.

Errors: `400`, `403` not the owner, `404` no project or no account with this email, `409` already a member.

### DELETE /projects/:id/members/:userId

`204`, no body. The removed user's tasks in this project stay, but become unassigned.

Errors: `400` invalid id or the user is the owner (the owner cannot be removed), `403` not the owner, `404` no project or the user is not a member.

## Tasks

A task object:

```json
{
  "id": 5,
  "project_id": 1,
  "assignee_id": 2,
  "created_by": 1,
  "title": "Build the API",
  "description": "Express + pg",
  "status": "todo",
  "priority": "high",
  "due_date": "2026-12-01",
  "created_at": "2026-11-12T05:13:35.345Z",
  "updated_at": "2026-11-12T05:13:35.345Z",
  "assignee_name": "Maria Ivanova",
  "created_by_name": "Aki Demo"
}
```

| Field | Rules |
|---|---|
| `title` | required on create, up to 200 characters |
| `description` | optional text or `null` |
| `status` | `todo` (default), `in_progress` or `done` |
| `priority` | `low`, `medium` (default) or `high` |
| `assignee_id` | id of a project member, or `null` for unassigned |
| `due_date` | a real calendar date as `YYYY-MM-DD`, or `null` |

### GET /projects/:id/tasks

`200` array of the project's tasks, oldest first. Errors: `400`, `403`, `404`.

### POST /projects/:id/tasks

`201` the task object. `created_by` is the current user. Errors: `400` validation or the assignee is not a project member, `403`, `404`.

### GET /tasks/:id

`200` the task object. Errors: `400`, `403`, `404`.

### PUT /tasks/:id

Partial update: send only the fields to change, at least one. Fields that are not sent keep their value. `assignee_id`, `due_date` and `description` accept `null` to clear them; `status` and `priority` do not.

```json
{ "status": "done" }
```

`200` the updated task object. Errors: `400`, `403`, `404`.

### DELETE /tasks/:id

`204`, no body. Errors: `400`, `403`, `404`.

## Comments

A comment object:

```json
{
  "id": 1,
  "task_id": 5,
  "user_id": 2,
  "body": "Done, please review",
  "created_at": "2026-11-12T05:13:35.404Z",
  "author_name": "Maria Ivanova",
  "author_email": "maria@example.com"
}
```

### GET /tasks/:id/comments

`200` array of the task's comments, oldest first. Errors: `400`, `403`, `404`.

### POST /tasks/:id/comments

Body: `body`, required non-empty text. `201` the comment object. Errors: `400`, `403`, `404`.

### DELETE /comments/:id

`204`, no body. Allowed for the comment's author and for the owner of the project. Errors: `400`, `403`, `404`.
