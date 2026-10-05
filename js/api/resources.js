import { client } from './client.js';

// Тонкая обёртка над CRUD-маршрутами бэкенда: /api/v1/<name>[/<id>].
function resource(name) {
  const base = `/api/v1/${name}`;
  return {
    list: (query) => client.get(base, { query }),
    get: (id) => client.get(`${base}/${id}`),
    create: (body) => client.post(base, body),
    update: (id, body) => client.put(`${base}/${id}`, body),
    // Удаление мягкое: запись уходит в «удалённые» и её можно восстановить.
    remove: (id) => client.delete(`${base}/${id}`),
    restore: (id) => client.post(`${base}/${id}/restore`),
  };
}

export const organizationsApi = resource('organizations');
export const buildingsApi = {
  ...resource('buildings'),
  // Импорт помещений, собственников и счетов из xlsx; kind — вид помещений файла.
  importFile: (id, kind, file) => {
    const body = new FormData();
    body.set('kind', kind);
    body.set('file', file);
    return client.post(`/api/v1/buildings/${id}/import`, body);
  },
};
export const premisesApi = {
  ...resource('premises'),
  ownerships: (id, query) => client.get(`/api/v1/premises/${id}/ownerships`, { query }),
  accounts: (id, query) => client.get(`/api/v1/premises/${id}/accounts`, { query }),
};
// Помещения, которыми владелец владеет сегодня.
export const personsApi = {
  ...resource('persons'),
  properties: (id) => client.get(`/api/v1/persons/${id}/properties`),
};
export const legalEntitiesApi = {
  ...resource('legal-entities'),
  properties: (id) => client.get(`/api/v1/legal-entities/${id}/properties`),
};
export const ownershipsApi = resource('ownerships');
export const residenciesApi = resource('residencies');
export const accountsApi = resource('accounts');
export const accountHoldersApi = resource('account-holders');
