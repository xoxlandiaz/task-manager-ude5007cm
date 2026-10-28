/*
 * dashboard.js — "My projects" page.
 *
 * GET  /api/projects  → draw one card per project
 * POST /api/projects  → create a project from the modal, then redraw
 * Search and role filter work in the browser on the list we already loaded.
 */
(() => {
  const { el } = Ui;
  const list = document.getElementById('project-list');
  const emptyState = document.getElementById('empty-state');
  const summary = document.getElementById('summary');
  const search = document.getElementById('search');
  const form = document.getElementById('project-form');
  const formAlert = document.getElementById('project-form-alert');
  const modalElement = document.getElementById('project-modal');

  let projects = [];

  function projectCard(project) {
    const total = Number(project.task_count) || 0;
    const done = Number(project.done_count) || 0;
    const percent = total ? Math.round((done / total) * 100) : 0;

    return el('div', { class: 'col' },
      el('a', { class: 'card card-clickable h-100', href: `project.html?id=${project.id}` },
        el('div', { class: 'card-body d-flex flex-column gap-3' },
          el('div', { class: 'd-flex justify-content-between align-items-start gap-2' },
            el('h2', { class: 'h5 mb-0', text: project.name }),
            el('span', { class: 'badge rounded-pill priority-low', text: project.role === 'owner' ? 'Owner' : 'Member' })),
          project.description
            ? el('p', { class: 'text-muted mb-0', text: project.description })
            : null,
          el('div', { class: 'mt-auto' },
            el('div', { class: 'small text-muted mb-1', text: `${done} of ${total} tasks done` }),
            el('div', {
              class: 'progress', role: 'progressbar', 'aria-label': 'Tasks done',
              'aria-valuenow': percent, 'aria-valuemin': 0, 'aria-valuemax': 100,
            }, el('div', { class: 'progress-bar', style: `width: ${percent}%` }))),
          el('div', { class: 'small text-muted', text: `${project.member_count} member${project.member_count == 1 ? '' : 's'}` }))));
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const role = document.querySelector('input[name="role-filter"]:checked').value;

    const visible = projects.filter((p) =>
      (role === 'all' || p.role === role) &&
      (!query || p.name.toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query)));

    const openTasks = projects.reduce((sum, p) => sum + (Number(p.task_count) - Number(p.done_count)), 0);
    summary.textContent = `${projects.length} project${projects.length === 1 ? '' : 's'} · ${openTasks} open task${openTasks === 1 ? '' : 's'}`;

    emptyState.classList.toggle('d-none', projects.length > 0);
    if (projects.length > 0 && visible.length === 0) {
      list.replaceChildren(el('p', { class: 'text-muted', text: 'No projects match your search.' }));
    } else {
      list.replaceChildren(...visible.map(projectCard));
    }
  }

  async function load() {
    try {
      projects = await Api.get('/projects');
      render();
    } catch (error) {
      Ui.showError(list, `Could not load projects. ${error.message}`);
    }
  }

  search.addEventListener('input', render);
  document.querySelectorAll('input[name="role-filter"]').forEach((radio) => radio.addEventListener('change', render));

  // Reset the form every time the modal opens
  modalElement.addEventListener('show.bs.modal', () => {
    form.reset();
    form.querySelectorAll('.is-invalid').forEach((input) => input.classList.remove('is-invalid'));
    formAlert.classList.add('d-none');
  });
  modalElement.addEventListener('shown.bs.modal', () => form.elements.name.focus());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const description = form.elements.description.value.trim();
    if (!name) {
      form.elements.name.classList.add('is-invalid');
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const project = await Api.post('/projects', { name, description: description || null });
      // A new project has no tasks yet and only the owner as member
      projects.unshift({ task_count: 0, done_count: 0, member_count: 1, role: 'owner', ...project });
      render();
      bootstrap.Modal.getInstance(modalElement).hide();
      Ui.toast('Project created');
    } catch (error) {
      Ui.showFormErrors(form, error, formAlert);
    } finally {
      button.disabled = false;
    }
  });

  load();
})();
