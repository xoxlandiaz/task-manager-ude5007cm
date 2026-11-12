# tests/

Тесты API на Jest + Supertest. Запуск: `npm test`. Запускаются в CI.

| Файл | Что проверяет | База |
|---|---|---|
| `auth`, `users`, `projects`, `members`, `tasks`, `comments`, `health` | эндпоинты и права доступа | мок `helpers/mockDb.js` |
| `validation.test.js` | некорректный ввод: каждый случай должен давать 400, а не 500 | мок |
| `integration.test.js` | настоящий SQL, каскады, транзакции, триггер `updated_at` | настоящий PostgreSQL |

`integration.test.js` очищает все таблицы, поэтому запускается только если имя базы в `DATABASE_URL` заканчивается на `_test` (в CI это `taskmanager_test`) и миграции применены. Иначе он пропускается. Как запустить локально: [docs/install-guide.md](../docs/install-guide.md).
