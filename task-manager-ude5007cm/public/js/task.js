/*
 * task.js — one task: details, properties, comments.
 *
 * GET    /api/tasks/:id                  task
 * GET    /api/projects/:pid              project name for the breadcrumb
 * GET    /api/projects/:pid/members      assignee options
 * GET    /api/tasks/:id/comments         comment list
 * POST   /api/tasks/:id/comments         add comment
 * PUT    /api/tasks/:id                  save properties or title/description
 * DELETE /api/tasks/:id                  delete, then back to the board
 */
(() => {
  const { el } = Ui;
  const taskId = Ui.getIdFromUrl();
  if (!taskId) {
    window.location.replace('dashboard.html');
    return;
  }

  let task = null;
  let comments = [];

  const propsForm = document.getElementById('props-form');
  const propsAlert = document.getElementById('props-alert');
  const commentForm = document.getElementById('comment-form');
  const detailsModalElement = document.getElementById('details-modal');
  const detailsForm = document.getElementById('details-form');
  const detailsAlert = document.getElementById('details-alert');

  // ---------- Task ----------
  function renderTask() {
    document.title = `${task.title} · TaskFlow`;
    document.getElementById('crumb-task').textContent = task.title;
    const title = document.getElementById('task-title');
    title.classList.remove('placeholder-glow');
    title.textContent = task.title;

    const meta = [`Created by ${task.created_by_name || 'unknown'}`];
    if (Ui.isOverdue(task)) meta.push(`overdue since ${Ui.formatDate(task.due_date)}`);
    document.getElementById('task-meta').textContent = meta.join(' · ');

    const description = document.getElementById('task-description');
    description.textContent = task.description || 'No description yet.';
    description.classList.toggle('text-muted', !task.description);

    const f = propsForm.elements;
    f.status.value = task.status;
    f.priority.value = task.priority;
    f.assignee_id.value = task.assignee_id || '';
    f.due_date.value = task.due_date ? task.due_date.slice(0, 10) : '';
  }

  function renderMembers(members) {
    propsForm.elements.assignee_id.replaceChildren(
      el('option', { value: '', text: 'Unassigned' }),
      ...members.map((m) => el('option', { value: m.user_id, text: m.name })));
  }

  // ---------- Comments ----------
  function commentItem(comment) {
    return el('li', { class: 'card' },
      el('div', { class: 'card-body d-flex gap-3' },
        Ui.avatar(comment.author_name),
        el('div', { style: 'min-width: 0' },
          el('div', { class: 'd-flex flex-wrap gap-2 align-items-baseline mb-1' },
            el('strong', { class: 'small', text: comment.author_name }),
            el('time', { class: 'small text-muted', datetime: comment.created_at, text: Ui.formatDateTime(comment.created_at) })),
          // textContent keeps user text as plain text (protection against XSS)
          el('p', { class: 'comment-body mb-0', text: comment.body }))));
  }

  function renderComments() {
    document.getElementById('comment-count').textContent = `(${comments.length})`;
    const list = document.getElementById('comment-list');
    list.replaceChildren(...(comments.length
      ? comments.map(commentItem)
      : [el('li', { class: 'text-muted', text: 'No comments yet. Start the discussion.' })]));
  }

  commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = commentForm.elements.body;
    const body = input.value.trim();
    input.classList.toggle('is-invalid', !body);
    if (!body) return;

    const button = commentForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      comments.push(await Api.post(`/tasks/${taskId}/comments`, { body }));
      renderComments();
      commentForm.reset();
    } catch (error) {
      Ui.toast(`Comment not posted. ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });

  // ---------- Save properties ----------
  async function save(changes, form, alertBox) {
    alertBox.classList.add('d-none');
    try {
      task = { ...task, ...(await Api.put(`/tasks/${taskId}`, changes)) };
      renderTask();
      Ui.toast('Saved');
      return true;
    } catch (error) {
      Ui.showFormErrors(form, error, alertBox);
      return false;
    }
  }

  propsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const f = propsForm.elements;
    save({
      status: f.status.value,
      priority: f.priority.value,
      assignee_id: f.assignee_id.value ? Number(f.assignee_id.value) : null,
      due_date: f.due_date.value || null,
    }, propsForm, propsAlert);
  });

  detailsModalElement.addEventListener('show.bs.modal', () => {
    detailsForm.elements.title.value = task.title;
    detailsForm.elements.description.value = task.description || '';
    detailsForm.elements.title.classList.remove('is-invalid');
    detailsAlert.classList.add('d-none');
  });

  detailsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = detailsForm.elements.title.value.trim();
    if (!title) {
      detailsForm.elements.title.classList.add('is-invalid');
      return;
    }
    const ok = await save({
      title,
      description: detailsForm.elements.description.value.trim() || null,
    }, detailsForm, detailsAlert);
    if (ok) bootstrap.Modal.getInstance(detailsModalElement).hide();
  });

  // ---------- Delete ----------
  document.getElementById('delete-task-button').addEventListener('click', async () => {
    if (!(await Ui.confirmDelete(`Delete "${task.title}" and its comments?`))) return;
    try {
      await Api.del(`/tasks/${taskId}`);
      window.location.href = `project.html?id=${task.project_id}`;
    } catch (error) {
      Ui.toast(error.message);
    }
  });

  // ---------- Load ----------
  async function load() {
    try {
      task = await Api.get(`/tasks/${taskId}`);
      const [project, members] = await Promise.all([
        Api.get(`/projects/${task.project_id}`),
        Api.get(`/projects/${task.project_id}/members`),
        Api.get(`/tasks/${taskId}/comments`).then((list) => { comments = list; }),
      ]);
      const crumb = document.getElementById('crumb-project');
      crumb.textContent = project.name;
      crumb.href = `project.html?id=${project.id}`;
      renderMembers(members);
      renderTask();
      renderComments();
    } catch (error) {
      const message = error.status === 404 ? 'This task does not exist.'
        : error.status === 403 ? 'You are not a member of this project.'
          : `Could not load the task. ${error.message}`;
      Ui.showError(document.getElementById('task-layout'), message);
    }
  }

  load();
})();
