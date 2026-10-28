/*
 * project.js — one project: kanban board, members, edit/delete.
 *
 * GET    /api/projects/:id               project header
 * GET    /api/projects/:id/members       avatars + members panel + assignee list
 * GET    /api/projects/:id/tasks         cards in the three columns
 * POST   /api/projects/:id/tasks         "+ Add task"
 * PUT    /api/tasks/:id {status}         move a card with ← / →
 * POST   /api/projects/:id/members       add member by email (owner)
 * DELETE /api/projects/:id/members/:uid  remove member (owner)
 * PUT    /api/projects/:id               edit name/description (owner)
 * DELETE /api/projects/:id               delete project (owner)
 */
(() => {
  const { el } = Ui;
  const projectId = Ui.getIdFromUrl();
  if (!projectId) {
    window.location.replace('dashboard.html');
    return;
  }

  const me = Api.getUser() || {};
  const STATUSES = ['todo', 'in_progress', 'done'];

  let project = null;
  let members = [];
  let tasks = [];

  const taskModalElement = document.getElementById('task-modal');
  const taskForm = document.getElementById('task-form');
  const taskFormAlert = document.getElementById('task-form-alert');
  const projectModalElement = document.getElementById('project-modal');
  const projectForm = document.getElementById('project-form');
  const projectFormAlert = document.getElementById('project-form-alert');
  const memberForm = document.getElementById('member-form');
  const memberFormAlert = document.getElementById('member-form-alert');

  const isOwner = () => project && project.role === 'owner';

  // ---------- Header ----------
  function renderHeader() {
    document.title = `${project.name} · TaskFlow`;
    document.getElementById('crumb-name').textContent = project.name;
    const title = document.getElementById('project-name');
    title.classList.remove('placeholder-glow');
    title.textContent = project.name;
    document.getElementById('project-description').textContent = project.description || '';
    document.getElementById('edit-project-button').classList.toggle('d-none', !isOwner());
    memberForm.classList.toggle('d-none', !isOwner());
  }

  // ---------- Members ----------
  function renderMembers() {
    const avatars = document.getElementById('member-avatars');
    avatars.replaceChildren(...members.slice(0, 4).map((m) => Ui.avatar(m.name)));
    if (members.length > 4) avatars.append(el('span', { class: 'avatar', text: `+${members.length - 4}` }));

    const list = document.getElementById('member-list');
    list.replaceChildren(...members.map((m) => {
      const removable = isOwner() && m.role !== 'owner';
      return el('li', { class: 'list-group-item d-flex align-items-center gap-2 px-0' },
        Ui.avatar(m.name),
        el('div', { class: 'me-auto', style: 'min-width: 0' },
          el('div', { class: 'fw-semibold text-truncate', text: m.name }),
          el('div', { class: 'small text-muted text-truncate', text: m.email })),
        m.role === 'owner' ? el('span', { class: 'badge rounded-pill priority-low', text: 'Owner' }) : null,
        removable ? removeMemberButton(m) : null);
    }));

    // Assignee options in the task form
    const select = taskForm.elements.assignee_id;
    select.replaceChildren(
      el('option', { value: '', text: 'Unassigned' }),
      ...members.map((m) => el('option', { value: m.user_id, text: m.name })));
  }

  function removeMemberButton(member) {
    const button = el('button', {
      type: 'button', class: 'btn btn-sm btn-outline-danger', text: 'Remove',
      'aria-label': `Remove ${member.name}`,
    });
    button.addEventListener('click', async () => {
      if (!(await Ui.confirmDelete(`Remove ${member.name} from this project?`))) return;
      try {
        await Api.del(`/projects/${projectId}/members/${member.user_id}`);
        members = members.filter((m) => m.user_id !== member.user_id);
        renderMembers();
        Ui.toast(`${member.name} removed`);
      } catch (error) {
        Ui.toast(error.message);
      }
    });
    return button;
  }

  memberForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = memberForm.elements.email;
    const email = input.value.trim().toLowerCase();
    input.classList.remove('is-invalid');
    memberFormAlert.classList.add('d-none');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      input.classList.add('is-invalid');
      return;
    }
    try {
      await Api.post(`/projects/${projectId}/members`, { email });
      members = await Api.get(`/projects/${projectId}/members`);
      renderMembers();
      memberForm.reset();
      Ui.toast('Member added');
    } catch (error) {
      // 404: no such user, 409: already a member
      memberFormAlert.textContent = error.status === 404
        ? 'No TaskFlow account uses this email.'
        : error.message;
      memberFormAlert.classList.remove('d-none');
    }
  });

  // ---------- Board ----------
  function currentFilter() {
    return document.querySelector('input[name="task-filter"]:checked').value;
  }

  function matchesFilter(task) {
    switch (currentFilter()) {
      case 'mine': return task.assignee_id === me.id;
      case 'high': return task.priority === 'high';
      case 'overdue': return Ui.isOverdue(task);
      default: return true;
    }
  }

  function moveButton(task, direction) {
    const index = STATUSES.indexOf(task.status) + direction;
    if (index < 0 || index >= STATUSES.length) return null;
    const target = STATUSES[index];
    const button = el('button', {
      type: 'button',
      class: 'btn btn-sm btn-outline-primary position-relative z-2',
      text: direction < 0 ? '←' : '→',
      'aria-label': `Move "${task.title}" to ${Ui.STATUS_LABELS[target]}`,
    });
    button.addEventListener('click', () => changeStatus(task, target));
    return button;
  }

  function taskCard(task) {
    const due = task.due_date
      ? el('span', {
        class: `small ${Ui.isOverdue(task) ? 'text-danger fw-semibold' : 'text-muted'}`,
        text: `${Ui.isOverdue(task) ? 'Overdue' : 'Due'} ${Ui.formatDate(task.due_date)}`,
      })
      : null;

    return el('article', { class: 'card card-task card-clickable position-relative' },
      el('div', { class: 'card-body p-3' },
        // stretched-link makes the whole card clickable, buttons stay on top (z-2)
        el('h3', { class: 'card-title' },
          el('a', { class: 'stretched-link text-reset text-decoration-none', href: `task.html?id=${task.id}`, text: task.title })),
        el('div', { class: 'd-flex flex-wrap align-items-center gap-2' },
          Ui.priorityBadge(task.priority),
          due,
          el('span', { class: 'ms-auto' }),
          task.assignee_name ? Ui.avatar(task.assignee_name) : null),
        el('div', { class: 'd-flex gap-2 mt-2' }, moveButton(task, -1), moveButton(task, 1))));
  }

  function renderBoard() {
    STATUSES.forEach((status) => {
      const inColumn = tasks.filter((t) => t.status === status);
      const visible = inColumn.filter(matchesFilter);
      document.querySelector(`[data-count="${status}"]`).textContent = inColumn.length;
      const column = document.querySelector(`[data-column="${status}"]`);
      column.replaceChildren(...(visible.length
        ? visible.map(taskCard)
        : [el('p', { class: 'small text-muted mb-0', text: 'No tasks here.' })]));
    });
  }

  async function changeStatus(task, status) {
    const previous = task.status;
    task.status = status; // update the screen first, undo if the server says no
    renderBoard();
    try {
      Object.assign(task, await Api.put(`/tasks/${task.id}`, { status }));
      renderBoard();
    } catch (error) {
      task.status = previous;
      renderBoard();
      Ui.toast(`Could not move the task. ${error.message}`);
    }
  }

  document.querySelectorAll('input[name="task-filter"]').forEach((radio) => radio.addEventListener('change', renderBoard));

  // ---------- New task ----------
  document.getElementById('add-task-button').addEventListener('click', () => {
    taskForm.reset();
    taskForm.querySelectorAll('.is-invalid').forEach((input) => input.classList.remove('is-invalid'));
    taskFormAlert.classList.add('d-none');
    bootstrap.Modal.getOrCreateInstance(taskModalElement).show();
  });
  taskModalElement.addEventListener('shown.bs.modal', () => taskForm.elements.title.focus());

  taskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const f = taskForm.elements;
    const title = f.title.value.trim();
    if (!title) {
      f.title.classList.add('is-invalid');
      return;
    }
    const body = {
      title,
      description: f.description.value.trim() || null,
      status: f.status.value,
      priority: f.priority.value,
      assignee_id: f.assignee_id.value ? Number(f.assignee_id.value) : null,
      due_date: f.due_date.value || null,
    };
    const button = taskForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const task = await Api.post(`/projects/${projectId}/tasks`, body);
      tasks.push(task);
      renderBoard();
      bootstrap.Modal.getInstance(taskModalElement).hide();
      Ui.toast('Task added');
    } catch (error) {
      Ui.showFormErrors(taskForm, error, taskFormAlert);
    } finally {
      button.disabled = false;
    }
  });

  // ---------- Edit / delete project (owner) ----------
  projectModalElement.addEventListener('show.bs.modal', () => {
    projectForm.elements.name.value = project.name;
    projectForm.elements.description.value = project.description || '';
    projectForm.elements.name.classList.remove('is-invalid');
    projectFormAlert.classList.add('d-none');
  });

  projectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = projectForm.elements.name.value.trim();
    if (!name) {
      projectForm.elements.name.classList.add('is-invalid');
      return;
    }
    try {
      const updated = await Api.put(`/projects/${projectId}`, {
        name,
        description: projectForm.elements.description.value.trim() || null,
      });
      project = { ...project, ...updated };
      renderHeader();
      bootstrap.Modal.getInstance(projectModalElement).hide();
      Ui.toast('Project saved');
    } catch (error) {
      Ui.showFormErrors(projectForm, error, projectFormAlert);
    }
  });

  document.getElementById('delete-project-button').addEventListener('click', async () => {
    bootstrap.Modal.getInstance(projectModalElement).hide();
    const ok = await Ui.confirmDelete(`Delete "${project.name}" with all its tasks and comments? This cannot be undone.`);
    if (!ok) return;
    try {
      await Api.del(`/projects/${projectId}`);
      window.location.href = 'dashboard.html';
    } catch (error) {
      Ui.toast(error.message);
    }
  });

  // ---------- Load everything ----------
  async function load() {
    try {
      [project, members, tasks] = await Promise.all([
        Api.get(`/projects/${projectId}`),
        Api.get(`/projects/${projectId}/members`),
        Api.get(`/projects/${projectId}/tasks`),
      ]);
      renderHeader();
      renderMembers();
      renderBoard();
    } catch (error) {
      const message = error.status === 404 ? 'This project does not exist.'
        : error.status === 403 ? 'You are not a member of this project.'
          : `Could not load the project. ${error.message}`;
      Ui.showError(document.getElementById('board'), message);
      document.getElementById('project-name').textContent = 'Project unavailable';
    }
  }

  load();
})();
