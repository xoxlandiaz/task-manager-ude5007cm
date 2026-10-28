-- 005: комментарии к задачам
CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id    INTEGER     NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT        NOT NULL CHECK (char_length(trim(body)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);
