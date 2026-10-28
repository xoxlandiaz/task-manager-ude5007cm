/*
 * auth.js — login and registration forms (login.html, register.html).
 *
 * Flow: validate in the browser → send to the API → save the JWT → go to dashboard.
 * Browser validation is only for convenience; the server validates everything again.
 */
(() => {
  // Already logged in? Skip the form.
  if (Api.getToken()) {
    window.location.replace('dashboard.html');
    return;
  }

  const alertBox = document.getElementById('form-alert');

  function showAlert(message) {
    alertBox.textContent = message; // textContent, never innerHTML: no HTML injection
    alertBox.classList.remove('d-none');
  }

  function hideAlert() {
    alertBox.classList.add('d-none');
  }

  // Disable the button and show a spinner while the request is running
  function setLoading(form, loading) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = loading;
    button.querySelector('.spinner-border').classList.toggle('d-none', !loading);
  }

  // Mark one field as invalid and put the message under it
  function setFieldError(form, field, message) {
    const input = form.elements[field];
    if (!input) return false;
    input.classList.add('is-invalid');
    const feedback = input.parentElement.querySelector('.invalid-feedback');
    if (feedback && message) feedback.textContent = message;
    return true;
  }

  function clearFieldErrors(form) {
    form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
  }

  // Show errors that came back from the server (400 with details, 409, 401)
  function showServerError(form, error) {
    let shownOnField = false;
    error.details.forEach((d) => {
      if (setFieldError(form, d.field, d.message)) shownOnField = true;
    });
    if (error.status === 409) shownOnField = setFieldError(form, 'email', error.message);
    if (!shownOnField) showAlert(error.message);
  }

  async function submit(form, path, body) {
    hideAlert();
    setLoading(form, true);
    try {
      const { token, user } = await Api.post(path, body);
      Api.saveSession(token, user);
      window.location.href = 'dashboard.html';
    } catch (error) {
      showServerError(form, error);
      setLoading(form, false);
    }
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ----- Log in -----
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      clearFieldErrors(loginForm);

      const email = loginForm.elements.email.value.trim().toLowerCase();
      const password = loginForm.elements.password.value;
      let valid = true;
      if (!emailPattern.test(email)) { setFieldError(loginForm, 'email'); valid = false; }
      if (!password) { setFieldError(loginForm, 'password'); valid = false; }
      if (!valid) return;

      submit(loginForm, '/auth/login', { email, password });
    });
  }

  // ----- Sign up -----
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      clearFieldErrors(registerForm);

      const name = registerForm.elements.name.value.trim();
      const email = registerForm.elements.email.value.trim().toLowerCase();
      const password = registerForm.elements.password.value;
      const confirm = registerForm.elements.confirm.value;
      let valid = true;
      if (!name) { setFieldError(registerForm, 'name'); valid = false; }
      if (!emailPattern.test(email)) { setFieldError(registerForm, 'email', 'Enter a valid email address.'); valid = false; }
      if (password.length < 8) { setFieldError(registerForm, 'password'); valid = false; }
      if (confirm !== password) { setFieldError(registerForm, 'confirm'); valid = false; }
      if (!valid) return;

      submit(registerForm, '/auth/register', { name, email, password });
    });
  }
})();
