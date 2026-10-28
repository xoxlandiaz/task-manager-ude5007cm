-- Полная схема БД (склейка db/migrations/*.sql по порядку).
-- Для применения используй миграции; этот файл для чтения и отчёта.

-- ===== migrations/001_create_users.sql =====
-- 001: пользователи приложения
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(100) NOT NULL CHECK (char_length(trim(name)) > 0),
    email         VARCHAR(255) NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ===== migrations/002_create_projects.sql =====
-- 002: проекты и общая функция для поля updated_at

-- Триггерная функция: перед каждым UPDATE ставит updated_at = now().
-- Используется в projects и tasks.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(150) NOT NULL CHECK (char_length(trim(name)) > 0),
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);

CREATE OR REPLACE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== migrations/003_create_project_members.sql =====
-- 003: участники проектов (связь M:N между users и projects)
CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    INTEGER     NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

-- PK (project_id, user_id) уже ускоряет поиск по project_id.
-- Для запроса «все проекты пользователя» нужен отдельный индекс по user_id.
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

-- ===== migrations/004_create_tasks.sql =====
-- 004: задачи внутри проекта
CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id  INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    created_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    title       VARCHAR(200) NOT NULL CHECK (char_length(trim(title)) > 0),
    description TEXT,
    status      VARCHAR(20)  NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo', 'in_progress', 'done')),
    priority    VARCHAR(10)  NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high')),
    due_date    DATE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id  ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);

CREATE OR REPLACE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== migrations/005_create_comments.sql =====
-- 005: комментарии к задачам
CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id    INTEGER     NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT        NOT NULL CHECK (char_length(trim(body)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);
