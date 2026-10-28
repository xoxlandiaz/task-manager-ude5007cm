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
