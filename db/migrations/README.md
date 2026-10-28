# Миграции

Файлы применяются по порядку имён (CI через `psql -v ON_ERROR_STOP=1`, docker через `/docker-entrypoint-initdb.d`). Порядок совпадает с порядком внешних ключей.

| Файл | Что делает |
|---|---|
| `001_create_users.sql` | пользователи; email уникальный и в нижнем регистре |
| `002_create_projects.sql` | функция `set_updated_at()` и проекты с владельцем |
| `003_create_project_members.sql` | участники проектов (M:N), роль owner/member |
| `004_create_tasks.sql` | задачи: статус, приоритет, срок, исполнитель |
| `005_create_comments.sql` | комментарии к задачам |

Применить вручную к локальной базе:

```bash
for f in db/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

Все файлы используют `IF NOT EXISTS` / `CREATE OR REPLACE`, поэтому повторный прогон не падает.
