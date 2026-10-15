import { el } from '../../lib/dom.js';
import { renderTable } from '../../ui/table.js';
import { openEntityForm } from '../../ui/entityForm.js';
import { usersApi } from '../../api/resources.js';
import { userCreateFields, userEditFields } from '../fields.js';
import { roleLabel } from '../../lib/permissions.js';
import { getUser } from '../../state/session.js';
import { formatDateTime } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';

// Пользователи системы (только администратор). Пользователей не удаляют, а отключают в форме правки.
export async function usersPage(container) {
  const host = el('div', { class: 'crud-table' }, el('div', { class: 'table-status' }, 'Загрузка…'));
  const loginsTitle = el('h2', {}, 'История входов');
  const loginsHost = el('div', { class: 'crud-table' });
  const addButton = el('button', { type: 'button', class: 'btn btn-primary btn-add', onclick: () => openCreate() }, 'Добавить пользователя');
  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, [el('h1', {}, 'Пользователи'), addButton]),
    el('p', { class: 'field-help' }, 'Роль «Просмотр» подходит, например, бухгалтеру: она видит все разделы, скачивает Excel и файлы реестров, но ничего не меняет.'),
    host,
    el('div', { class: 'section-header' }, [loginsTitle, el('button', { type: 'button', class: 'btn', onclick: () => loadLogins() }, 'Все пользователи')]),
    loginsHost,
  ]));

  function draw(rows) {
    host.replaceChildren(renderTable({
      columns: [
        { key: 'username', label: 'Логин', primary: true, render: (u) => (u.id === getUser()?.id ? `${u.username} (это вы)` : u.username) },
        { key: 'role', label: 'Роль', render: (u) => roleLabel(u.role) },
        { key: 'last_login_at', label: 'Последний вход', render: (u) => formatDateTime(u.last_login_at) || 'Не входил' },
        { key: 'last_seen_at', label: 'Была активность', render: (u) => formatDateTime(u.last_seen_at) },
        { key: 'active', label: 'Доступ', render: (u) => el('span', { class: u.active ? 'badge badge-success' : 'badge badge-neutral' }, u.active ? 'Активен' : 'Отключён') },
      ],
      rows,
      rowActions: (u) => [
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => openEdit(u) }, 'Изменить'),
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => loadLogins(u) }, 'Входы'),
      ],
    }));
  }

  // История входов: всех пользователей или одного (кнопка «Входы» в строке). Показаны последние 100 попыток.
  async function loadLogins(user) {
    loginsTitle.textContent = user ? `История входов: ${user.username}` : 'История входов';
    loginsHost.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
    try {
      const { items } = await usersApi.logins({ limit: 100, ...(user ? { user_id: user.id } : {}) });
      loginsHost.replaceChildren(renderTable({
        columns: [
          { key: 'created_at', label: 'Когда', primary: true, render: (e) => formatDateTime(e.created_at) },
          { key: 'username', label: 'Логин' },
          { key: 'success', label: 'Результат', render: (e) => el('span', { class: e.success ? 'badge badge-success' : 'badge badge-attention' }, e.success ? 'Вход' : 'Неверный пароль или логин') },
          { key: 'ip', label: 'Адрес' },
          { key: 'user_agent', label: 'Браузер' },
        ],
        rows: items,
        emptyMessage: 'Входов пока не было',
      }));
    } catch (err) {
      loginsHost.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    }
  }

  async function load() {
    try {
      const { items } = await usersApi.list({ limit: 200 });
      draw(items);
    } catch (err) {
      host.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    }
  }

  function openCreate() {
    openEntityForm({
      title: 'Новый пользователь',
      fields: userCreateFields,
      initialValues: { role: 'viewer' },
      save: (body) => usersApi.create(body),
      onSaved: load,
      successMessage: 'Пользователь добавлен',
    });
  }

  function openEdit(user) {
    openEntityForm({
      title: `Пользователь ${user.username}`,
      fields: userEditFields,
      entity: user,
      save: (body) => usersApi.update(user.id, body),
      onSaved: load,
    });
  }

  await Promise.all([load(), loadLogins()]);
}
