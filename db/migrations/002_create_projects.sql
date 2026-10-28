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
