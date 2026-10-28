# Installation guide

## Requirements

- Node.js 20 or newer, npm
- PostgreSQL 16 (or Docker Desktop instead of both)
- Git

## Option A. Run with Docker (recommended)

```
git clone https://github.com/xoxlandiaz/task-manager-ude5007cm.git
cd task-manager-ude5007cm
cp .env.example .env
docker compose up --build
```

Open http://localhost. All migrations from `db/migrations/` are applied on the first start. Demo data: `docker compose exec -T db psql -U postgres -d taskmanager < db/seeds/001_demo.sql`.
Stop: `Ctrl+C`, then `docker compose down` (add `-v` to delete the database).

## Option B. Run with local Node.js and PostgreSQL

1. Create a database:
   ```
   createdb taskmanager
   ```
2. Install dependencies and configure environment:
   ```
   npm ci
   cp .env.example .env
   ```
   Edit `DATABASE_URL` and `JWT_SECRET` in `.env`.
3. Apply all migrations from `db/migrations/*.sql` in order (001, 002, ...), then the optional demo data:
   ```
   # macOS / Linux / Git Bash
   for f in db/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
   psql "$DATABASE_URL" -f db/seeds/001_demo.sql
   ```
   ```
   # Windows PowerShell
   Get-ChildItem db/migrations/*.sql | Sort-Object Name | ForEach-Object { psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $_.FullName }
   psql $env:DATABASE_URL -f db/seeds/001_demo.sql
   ```
4. Start the server:
   ```
   npm run dev      # development, restarts on changes
   npm start        # production mode
   ```
   Open http://localhost:3000.

## Running tests

```
npm test
```

Tests need a running PostgreSQL and `DATABASE_URL` pointing to a test database.

## Environment variables

| Variable | Description | Example |
|---|---|---|
| `PORT` | HTTP port of the server | `3000` |
| `NODE_ENV` | `development`, `test` or `production` | `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5432/taskmanager` |
| `DATABASE_SSL` | `true` for SSL connections to a cloud database | `false` |
| `JWT_SECRET` | secret used to sign JWT tokens | long random string |
| `JWT_EXPIRES_IN` | token lifetime | `1d` |

Deployment: see [DEPLOY.md](../DEPLOY.md).
