import { el } from '../../lib/dom.js';
import { login } from '../../api/auth.js';
import { ApiError } from '../../api/client.js';
import { config } from '../../config.js';

export function renderLoginPage(container, { onSuccess } = {}) {
  let submitting = false;

  const usernameInput = el('input', { type: 'text', name: 'username', id: 'login-username', required: true, autocomplete: 'username' });
  const passwordInput = el('input', { type: 'password', name: 'password', id: 'login-password', required: true, autocomplete: 'current-password' });
  const errorBanner = el('div', { class: 'form-error', role: 'alert' });
  errorBanner.hidden = true;
  const submitButton = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Войти');

  function setError(message) {
    errorBanner.hidden = !message;
    errorBanner.textContent = message || '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    submitting = true;
    submitButton.disabled = true;
    setError(null);

    try {
      await login(usernameInput.value.trim(), passwordInput.value);
      onSuccess?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Неверный логин или пароль.');
      } else {
        setError((err && err.message) || 'Не удалось войти.');
      }
    } finally {
      submitting = false;
      submitButton.disabled = false;
    }
  }

  const form = el('form', { class: 'login-form', onsubmit: handleSubmit }, [
    el('h1', {}, config.appName),
    el('p', { class: 'login-subtitle' }, 'Управление домами УК и ТСН'),
    errorBanner,
    el('div', { class: 'field' }, [el('label', { for: 'login-username' }, 'Логин'), usernameInput]),
    el('div', { class: 'field' }, [el('label', { for: 'login-password' }, 'Пароль'), passwordInput]),
    submitButton,
  ]);

  const page = el('div', { class: 'login-page' }, form);
  container.replaceChildren(page);
  usernameInput.focus();
}
