-- Демо-данные. У всех пользователей пароль: Password123!
-- Запускать вручную после миграций: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/seeds/001_demo.sql
-- Перед вставкой всё очищается, поэтому сид можно гонять повторно.

BEGIN;

TRUNCATE comments, tasks, project_members, projects, users RESTART IDENTITY CASCADE;

INSERT INTO users (name, email, password_hash) VALUES
    ('Aki Demo',     'aki@example.com',   '$2a$10$5WqDP.ZcQffQaP46sE0Rh.pBfqynMkA7qnCkYWKYepEbInN8xhLOW'),
    ('Maria Ivanova', 'maria@example.com', '$2a$10$5WqDP.ZcQffQaP46sE0Rh.pBfqynMkA7qnCkYWKYepEbInN8xhLOW'),
    ('John Smith',   'john@example.com',  '$2a$10$5WqDP.ZcQffQaP46sE0Rh.pBfqynMkA7qnCkYWKYepEbInN8xhLOW');

INSERT INTO projects (owner_id, name, description) VALUES
    ((SELECT id FROM users WHERE email = 'aki@example.com'),
     'Coursework UDE5007CM', 'Full-stack task manager for the Web Development module'),
    ((SELECT id FROM users WHERE email = 'maria@example.com'),
     'Marketing site', 'Landing page redesign');

INSERT INTO project_members (project_id, user_id, role)
SELECT p.id, u.id, m.role
FROM (VALUES
    ('Coursework UDE5007CM', 'aki@example.com',   'owner'),
    ('Coursework UDE5007CM', 'maria@example.com', 'member'),
    ('Coursework UDE5007CM', 'john@example.com',  'member'),
    ('Marketing site',       'maria@example.com', 'owner'),
    ('Marketing site',       'aki@example.com',   'member')
) AS m(project, email, role)
JOIN projects p ON p.name = m.project
JOIN users u    ON u.email = m.email;

INSERT INTO tasks (project_id, assignee_id, created_by, title, description, status, priority, due_date)
SELECT p.id, a.id, c.id, t.title, t.description, t.status, t.priority, t.due_date::date
FROM (VALUES
    ('Coursework UDE5007CM', 'aki@example.com',   'aki@example.com',   'Design ER diagram',      'Five tables with relationships',      'done',        'high',   '2026-11-02'),
    ('Coursework UDE5007CM', 'aki@example.com',   'aki@example.com',   'Write SQL migrations',   'One migration per table',             'in_progress', 'high',   '2026-11-05'),
    ('Coursework UDE5007CM', 'john@example.com',  'aki@example.com',   'Implement auth API',     'Register, login, JWT middleware',     'todo',        'high',   '2026-11-12'),
    ('Coursework UDE5007CM', 'maria@example.com', 'aki@example.com',   'Build dashboard page',   'Bootstrap layout with project cards', 'todo',        'medium', '2026-11-19'),
    ('Coursework UDE5007CM', NULL,                'aki@example.com',   'Record demo video',      NULL,                                  'todo',        'low',    NULL),
    ('Marketing site',       'maria@example.com', 'maria@example.com', 'Collect brand assets',   NULL,                                  'in_progress', 'medium', '2026-11-08'),
    ('Marketing site',       'aki@example.com',   'maria@example.com', 'Write hero copy',        'Two variants for A/B test',           'todo',        'low',    NULL)
) AS t(project, assignee, creator, title, description, status, priority, due_date)
JOIN projects p   ON p.name = t.project
LEFT JOIN users a ON a.email = t.assignee
JOIN users c      ON c.email = t.creator;

INSERT INTO comments (task_id, user_id, body)
SELECT t.id, u.id, c.body
FROM (VALUES
    ('Design ER diagram',    'maria@example.com', 'Looks good, project_members covers the M:N link.'),
    ('Write SQL migrations', 'aki@example.com',   'Tables 001-005 are ready, adding indexes next.'),
    ('Implement auth API',   'john@example.com',  'Will use bcrypt with 10 salt rounds.'),
    ('Collect brand assets', 'aki@example.com',   'Logo files are in the shared drive.')
) AS c(task, email, body)
JOIN tasks t ON t.title = c.task
JOIN users u ON u.email = c.email;

COMMIT;
