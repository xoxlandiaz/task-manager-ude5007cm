/*
 * ui.js — small helpers shared by the logged-in pages
 * (dashboard.html, project.html, task.html).
 *
 * - Redirects to login if there is no token.
 * - Fills the user menu in the navbar and handles "Log out".
 * - Builds DOM elements safely (always textContent, never innerHTML with user data).
 */
const Ui = (() => {
  // Pages that use ui.js need a logged-in user
  if (!Api.getToken()) {
    window.location.replace('login.html');
  }

  // el('span', { class: 'badge', text: 'High' }, child1, child2)
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === undefined || value === null || value === false) return;
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else node.setAttribute(key, value);
    });
    children.flat().forEach((child) => {
      if (child) node.append(child);
    });
    return node;
  }

  function initials(name) {
    return (name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  function avatar(name) {
    return el('span', { class: 'avatar', title: name || 'Unassigned', text: initials(name) });
  }

  // '2026-11-04' → '4 Nov 2026' (parsed as a calendar date, no timezone shift)
  function formatDate(value) {
    if (!value) return '';
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDateTime(value) {
    return new Date(value).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  function isOverdue(task) {
    if (!task.due_date || task.status === 'done') return false;
    return task.due_date.slice(0, 10) < new Date().toISOString().slice(0, 10);
  }

  const STATUS_LABELS = { todo: 'To do', in_progress: 'In progress', done: 'Done' };
  const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

  function priorityBadge(priority) {
    return el('span', {
      class: `badge rounded-pill priority-${priority}`,
      text: PRIORITY_LABELS[priority] || priority,
    });
  }

  // Read ?id=123 from the address bar
  function getIdFromUrl() {
    const id = Number(new URLSearchParams(window.location.search).get('id'));
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  // Show an error message inside a container (e.g. when loading fails)
  function showError(container, message) {
    container.replaceChildren(el('div', { class: 'alert alert-danger', role: 'alert', text: message }));
  }

  // Toast in the bottom-right corner: "Saved", "Task deleted"…
  function toast(message) {
    let area = document.getElementById('toast-area');
    if (!area) {
      area = el('div', { id: 'toast-area', class: 'toast-container position-fixed bottom-0 end-0 p-3' });
      document.body.append(area);
    }
    const node = el('div', { class: 'toast align-items-center text-bg-dark border-0', role: 'status', 'aria-live': 'polite' },
      el('div', { class: 'd-flex' },
        el('div', { class: 'toast-body', text: message }),
        el('button', { type: 'button', class: 'btn-close btn-close-white me-2 m-auto', 'data-bs-dismiss': 'toast', 'aria-label': 'Close' })));
    area.append(node);
    const instance = bootstrap.Toast.getOrCreateInstance(node, { delay: 3000 });
    node.addEventListener('hidden.bs.toast', () => node.remove());
    instance.show();
  }

  // Put field errors from the server under the matching inputs of a form
  function showFormErrors(form, error, alertBox) {
    form.querySelectorAll('.is-invalid').forEach((input) => input.classList.remove('is-invalid'));
    let shown = false;
    error.details.forEach((detail) => {
      const input = form.elements[detail.field];
      if (!input) return;
      input.classList.add('is-invalid');
      const feedback = input.parentElement.querySelector('.invalid-feedback');
      if (feedback) feedback.textContent = detail.message;
      shown = true;
    });
    if (!shown && alertBox) {
      alertBox.textContent = error.message;
      alertBox.classList.remove('d-none');
    }
  }

  // Ask "Are you sure?" in the page's #confirm-modal. Resolves true on "Delete".
  // (The browser's confirm() would also work, but it can't be styled.)
  function confirmDelete(text) {
    const modalElement = document.getElementById('confirm-modal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    document.getElementById('confirm-text').textContent = text;
    return new Promise((resolve) => {
      const button = document.getElementById('confirm-button');
      let confirmed = false;
      const onClick = () => { confirmed = true; modal.hide(); };
      button.addEventListener('click', onClick, { once: true });
      modalElement.addEventListener('hidden.bs.modal', () => {
        button.removeEventListener('click', onClick);
        resolve(confirmed);
      }, { once: true });
      modal.show();
    });
  }

  // Navbar: user name + log out
  document.addEventListener('DOMContentLoaded', () => {
    const user = Api.getUser();
    const nameSlot = document.getElementById('user-name');
    if (nameSlot && user) nameSlot.textContent = user.name;

    const logout = document.getElementById('logout-button');
    if (logout) {
      logout.addEventListener('click', () => {
        Api.clearSession();
        window.location.href = 'login.html';
      });
    }
  });

  return {
    el, avatar, initials, formatDate, formatDateTime, isOverdue, priorityBadge,
    getIdFromUrl, showError, toast, showFormErrors, confirmDelete, STATUS_LABELS, PRIORITY_LABELS,
  };
})();
