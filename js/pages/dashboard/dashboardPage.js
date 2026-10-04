import { el } from '../../lib/dom.js';
import { organizationsApi, buildingsApi } from '../../api/resources.js';
import { organizationKinds, buildingKinds, label } from '../../lib/labels.js';
import { describeApiError } from '../../lib/apiErrors.js';

// Обзор: организации и их дома со ссылками на карточки.
export async function dashboardPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let organizations;
  let buildings;
  try {
    [{ items: organizations }, { items: buildings }] = await Promise.all([
      organizationsApi.list({ limit: 200 }),
      buildingsApi.list({ limit: 200 }),
    ]);
  } catch (err) {
    container.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return;
  }

  const content = organizations.length
    ? el('div', { class: 'org-grid' }, organizations.map((org) => {
      const own = buildings.filter((b) => b.organization_id === org.id);
      return el('div', { class: 'card org-card' }, [
        el('div', { class: 'org-card-header' }, [
          el('h2', {}, org.name),
          el('span', { class: 'badge badge-neutral' }, label(organizationKinds, org.kind)),
        ]),
        own.length
          ? el('ul', { class: 'org-buildings' }, own.map((b) => el('li', {}, [
            el('a', { href: `/buildings/${b.id}` }, b.address),
            el('span', { class: 'text-muted' }, ` · ${label(buildingKinds, b.kind)}`),
          ])))
          : el('p', { class: 'text-muted' }, 'Домов пока нет'),
      ]);
    }))
    : el('div', { class: 'card empty-state' }, [
      el('p', {}, 'Начните с организации — УК или ТСН, затем добавьте её дома.'),
      el('a', { href: '/organizations', class: 'btn btn-primary btn-inline' }, 'Перейти к организациям'),
    ]);

  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, [
      el('h1', {}, 'Обзор'),
      el('a', { href: '/buildings', class: 'btn' }, 'Все дома'),
    ]),
    content,
  ]));
}
