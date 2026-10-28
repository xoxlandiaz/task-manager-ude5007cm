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
