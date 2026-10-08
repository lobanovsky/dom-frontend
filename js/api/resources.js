import { client } from './client.js';
import { maybeGzip } from '../lib/gzip.js';

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

// Платежи. Банковский счёт организации (bank-accounts) — не лицевой счёт помещения (accounts).
export const bankAccountsApi = resource('bank-accounts');
export const paymentCategoriesApi = resource('payment-categories');
export const incomingPaymentsApi = resource('incoming-payments');
export const outgoingPaymentsApi = resource('outgoing-payments');
export const paymentRegistriesApi = {
  list: (query) => client.get('/api/v1/payment-registries', { query }),
  get: (id) => client.get(`/api/v1/payment-registries/${id}`),
  // Ссылка на исходный файл реестра (cookie-сессия, тот же origin).
  fileUrl: (id) => `/api/v1/payment-registries/${id}/file`,
  // Один запрос: реестры .txt и/или zip-архивы; счёт бэкенд определяет по номеру в имени файла.
  importFiles: async (files) => {
    const body = new FormData();
    for (const file of await Promise.all(files.map(maybeGzip))) body.append('file', file);
    return client.post('/api/v1/payment-registries/import', body);
  },
};

// Банковские выписки (xlsx). Счёт определяется из шапки файла.
export const bankStatementsApi = {
  list: (query) => client.get('/api/v1/bank-statements', { query }),
  get: (id) => client.get(`/api/v1/bank-statements/${id}`),
  fileUrl: (id) => `/api/v1/bank-statements/${id}/file`,
  importFiles: async (files) => {
    const body = new FormData();
    // Большие .txt сжимаются в браузере: загрузка укладывается в таймаут прокси даже на медленном канале.
    for (const file of await Promise.all(files.map(maybeGzip))) body.append('file', file);
    return client.post('/api/v1/bank-statements/import', body);
  },
};

// Правила определения лицевых счетов и запуски определения (предпросмотр, применение, откат).
export const paymentRulesApi = {
  ...resource('payment-rules'),
  reorder: (ids) => client.post('/api/v1/payment-rules/reorder', { ids }),
};
export const paymentAssignmentsApi = {
  preview: (body) => client.post('/api/v1/payment-assignments/preview', body),
  apply: (body) => client.post('/api/v1/payment-assignments', body),
  runs: (query) => client.get('/api/v1/payment-assignments', { query }),
  rollback: (id) => client.post(`/api/v1/payment-assignments/${id}/rollback`),
};
