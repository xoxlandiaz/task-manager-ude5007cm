/*
 * api.js — one place for every request to our REST API.
 *
 * - Stores the JWT in localStorage after login.
 * - Adds "Authorization: Bearer <token>" to every request.
 * - Turns error responses into JavaScript errors with .status and .details,
 *   so pages can show the server's message next to the right field.
 * - On 401 (no token / expired token) it clears the token and sends the user to login.
 *
 * Loaded with a plain <script> tag, so it exposes one global object: Api.
 */
const Api = (() => {
  const TOKEN_KEY = 'taskflow_token';
  const USER_KEY = 'taskflow_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  }

  function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // Error type that keeps the HTTP status and field errors from the server
  class ApiError extends Error {
    constructor(message, status, details) {
      super(message);
      this.status = status;
      this.details = details || [];
    }
  }

  async function request(method, path, body) {
    const headers = { Accept: 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await fetch(`/api${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
    }

    // 204 No Content (DELETE) has no body
    if (response.status === 204) return null;

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // Expired or missing token: start again from the login page.
      // Not on /auth/login itself, where 401 just means "wrong password".
      if (response.status === 401 && !path.startsWith('/auth/')) {
        clearSession();
        window.location.href = 'login.html';
      }
      const message = (data && data.error) || `Request failed (${response.status})`;
      throw new ApiError(message, response.status, data && data.details);
    }

    return data;
  }

  return {
    ApiError,
    getToken,
    getUser,
    saveSession,
    clearSession,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    del: (path) => request('DELETE', path),
  };
})();
