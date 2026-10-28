# Образ приложения для docker compose и деплоя на свой сервер.
# Debian slim (glibc), чтобы bcrypt ставился из готовых бинарников.
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

# Сначала только манифесты: слой с зависимостями кэшируется
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY public ./public

USER node
EXPOSE 3000
CMD ["node", "server/server.js"]
