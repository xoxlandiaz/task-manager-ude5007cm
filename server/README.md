# server/ — тред «Бэкенд»

- `app.js` — создание Express-приложения, middleware, роуты
- `server.js` — запуск (`app.listen`), отдельно от app для тестов
- `config/` — чтение переменных окружения
- `db/` — пул подключений `pg` (`pool.js`)
- `routes/` — `auth`, `projects`, `tasks`, `comments`, `users`
- `controllers/` — логика обработчиков
- `middleware/` — `auth` (JWT), `validate`, `errorHandler`
- `validators/` — правила валидации входных данных
- `utils/` — вспомогательные функции (JWT, bcrypt, разбор id, класс ошибок)

Документация эндпоинтов: [docs/api.md](../docs/api.md).
