# Деплой

Два варианта, один и тот же код. Все настройки приложение берёт из переменных окружения (см. `.env.example`).

| | Render (основной) | Свой сервер (VPS) |
|---|---|---|
| Файлы | `render.yaml` | `Dockerfile`, `docker-compose.yml`, `nginx/nginx.conf` |
| Прокси и HTTPS | даёт Render | nginx + Let's Encrypt |
| Статика `public/` | отдаёт Express | отдаёт nginx |
| БД | Render PostgreSQL | контейнер `db`, порт наружу не открыт |

## Что должно быть в приложении

- `server/server.js` слушает `process.env.PORT`.
- Подключение к БД через `process.env.DATABASE_URL`; при `DATABASE_SSL=true` передавать в `pg` `ssl: { rejectUnauthorized: false }`.
- `GET /api/health` отвечает `200` (Render проверяет его при каждом деплое).
- `app.set('trust proxy', 1)` — приложение работает за прокси (Render или nginx).
- `app.use(express.static('public'))` — нужно для Render, где nginx нет.

## Вариант 1. Render

1. Render → **New → Blueprint** → подключить репозиторий `task-manager-ude5007cm`.
2. Render прочитает `render.yaml` и создаст:
   - PostgreSQL `task-manager-db` (план free);
   - веб-сервис `task-manager`: `npm ci` → `npm start`.
   `DATABASE_URL` подставляется из базы автоматически, `JWT_SECRET` генерируется.
3. Создать таблицы: в базе открыть **Connect → External Connection**, скопировать External Database URL и применить все миграции по порядку (001 → 005), затем при желании демо-данные:
   ```
   for f in db/migrations/*.sql; do psql "<External Database URL>" -v ON_ERROR_STOP=1 -f "$f"; done
   psql "<External Database URL>" -f db/seeds/001_demo.sql
   ```
4. Открыть `https://task-manager-XXXX.onrender.com`. HTTPS включён сам.

Каждый push в `main` запускает автодеплой. Деплой стоит делать только при зелёном CI.

Ограничения бесплатного плана: веб-сервис засыпает после ~15 минут простоя (первый запрос ~30–60 с — перед демо открыть сайт заранее); бесплатная PostgreSQL удаляется через 30 дней после создания — создавать её ближе к сдаче или перейти на платный план.

## Вариант 2. Свой сервер (docker compose + nginx)

Схема: `интернет → nginx:80/443 → app:3000 → db:5432`. Наружу открыт только nginx; `app` и `db` видны лишь во внутренней сети compose.

### Локальная проверка

```
cp .env.example .env        # заполнить JWT_SECRET и POSTGRES_PASSWORD
docker compose up --build
```
Открыть http://localhost. Проверка: `curl http://localhost/api/health`.

`.sql`-файлы из `db/migrations/` выполняются автоматически **только при первом создании тома**. Чтобы пересоздать БД с нуля: `docker compose down -v`.

### На сервере (Ubuntu)

1. Установить Docker: `curl -fsSL https://get.docker.com | sh`.
2. Склонировать репозиторий, создать `.env` с надёжными `JWT_SECRET` и `POSTGRES_PASSWORD`.
3. `docker compose up -d --build`.
4. Направить DNS-запись `A` домена на IP сервера.
5. HTTPS через Let's Encrypt:
   ```
   docker compose stop nginx
   sudo apt install certbot
   sudo certbot certonly --standalone -d example.com
   ```
   В `docker-compose.yml` у `nginx` добавить порт `"443:443"` и том `/etc/letsencrypt:/etc/letsencrypt:ro`, а в `nginx/nginx.conf` — второй `server`:
   ```
   server {
       listen 443 ssl;
       server_name example.com;
       ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
       # ...те же location, что и в блоке listen 80
   }
   ```
   В блоке `listen 80` оставить только `return 301 https://$host$request_uri;`.
6. `docker compose up -d`. Продление сертификата: `sudo certbot renew` (раз в 60–90 дней, можно cron).

## CI

`.github/workflows/ci.yml` на каждый push и PR:
- **test**: Node 20 и 22, сервисная PostgreSQL 16, применение `db/migrations/*.sql`, `npm test`;
- **docker**: проверка `docker-compose.yml`, сборка образа, `nginx -t`.
