import { client } from './client.js';
import { maybeGzip } from '../lib/gzip.js';
import { setPremisesKinds } from '../lib/labels.js';

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

// Пользователи системы (только администратор): list/create/update; удаления нет — пользователя отключают (active: false).
export const usersApi = {
  list: (query) => client.get('/api/v1/users', { query }),
  create: (body) => client.post('/api/v1/users', body),
  update: (id, body) => client.put(`/api/v1/users/${id}`, body),
  logins: (query) => client.get('/api/v1/users/logins', { query }), // история входов, новые сверху
};

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
// calculation: расчёт стоимости услуг счёта за месяц (period — «2026-10»), ничего не сохраняет.
export const accountsApi = {
  ...resource('accounts'),
  calculation: (id, period) => client.get(`/api/v1/accounts/${id}/calculation`, { query: { period } }),
};
export const accountHoldersApi = resource('account-holders');

// Счётчики воды и электроэнергии (индивидуальные у помещений, общедомовые у дома) и их показания.
export const metersApi = resource('meters');
export const servicesApi = resource('services');
// Справочник тарифов («Электроэнергия Т1») с ценами по периодам: цены услуг ведутся только здесь, услуга ссылается на тариф.
export const tariffsApi = resource('tariffs');
export const tariffPricesApi = resource('tariff-prices');
// Нормативы услуг «площадь × норматив» (Гкал на м²) по домам и периодам.
export const serviceNormsApi = resource('service-norms');
// Назначения услуг лицевым счетам. bulk*: массовое назначение услуги подходящим счетам (preview ничего не пишет), bulkClose — закрыть датой, bulkPeriod* — массово заменить период назначений.
export const accountServicesApi = {
  ...resource('account-services'),
  bulkPreview: (body) => client.post('/api/v1/account-services/bulk/preview', body),
  bulkApply: (body) => client.post('/api/v1/account-services/bulk', body),
  bulkClose: (body) => client.post('/api/v1/account-services/bulk-close', body),
  bulkPeriodPreview: (body) => client.post('/api/v1/account-services/bulk-period/preview', body),
  bulkPeriodApply: (body) => client.post('/api/v1/account-services/bulk-period', body),
};
export const meterReadingsApi = {
  ...resource('meter-readings'),
  // Загрузка показаний одного ресурса дома из xlsx на дату readingDate за расчётный месяц period («2026-10», пусто — месяц даты); installedAt задан — неизвестные счётчики создаются.
  importFile: ({ buildingId, resource: kind, readingDate, period, installedAt, file }) => {
    const body = new FormData();
    body.set('building_id', String(buildingId));
    body.set('resource', kind);
    body.set('reading_date', readingDate);
    if (period) body.set('period', period);
    if (installedAt) body.set('installed_at', installedAt);
    body.set('file', file);
    return client.post('/api/v1/meter-readings/import', body);
  },
};

// Справочник видов помещений. Подписи и списки выбора по всему интерфейсу берутся из lib/labels.js#premisesKinds,
// поэтому после входа и после любой правки справочника его содержимое перезагружается.
export async function refreshPremisesKinds() {
  try {
    const { items } = await client.get('/api/v1/premises-kinds', { query: { limit: 200 } });
    setPremisesKinds(items);
  } catch {
    // остаются прежние значения; ошибку сети уже показал общий обработчик
  }
}

const premisesKindsResource = resource('premises-kinds');
const thenRefresh = (call) => async (...args) => {
  const result = await call(...args);
  await refreshPremisesKinds();
  return result;
};
export const premisesKindsApi = {
  ...premisesKindsResource,
  create: thenRefresh(premisesKindsResource.create),
  update: thenRefresh(premisesKindsResource.update),
  remove: thenRefresh(premisesKindsResource.remove),
  restore: thenRefresh(premisesKindsResource.restore),
};

// Платежи. Банковский счёт организации (bank-accounts) — не лицевой счёт помещения (accounts).
export const bankAccountsApi = resource('bank-accounts');
export const paymentCategoriesApi = resource('payment-categories');
// exportExcel(query) — выгрузка в Excel по тем же фильтрам, что у списка: {blob, fileName}.
export const incomingPaymentsApi = {
  ...resource('incoming-payments'),
  exportExcel: (query) => client.download('/api/v1/incoming-payments/export', { query }),
};
export const outgoingPaymentsApi = {
  ...resource('outgoing-payments'),
  exportExcel: (query) => client.download('/api/v1/outgoing-payments/export', { query }),
};
// Контрагенты из платежей (только чтение): ?direction=outgoing|incoming, ?q=.
export const counterpartiesApi = {
  list: (query) => client.get('/api/v1/counterparties', { query }),
};
export const paymentRegistriesApi = {
  list: (query) => client.get('/api/v1/payment-registries', { query }),
  get: (id) => client.get(`/api/v1/payment-registries/${id}`),
  // Повторное сопоставление реестров с платежами выписок: {linked, unmatched:[{registry_id, file_name, reason}]}.
  relink: () => client.post('/api/v1/payment-registries/relink', {}),
  // Ссылка на исходный файл реестра (cookie-сессия, тот же origin).
  fileUrl: (id) => `/api/v1/payment-registries/${id}/file`,
  // Один запрос: реестры .txt и/или zip-архивы; счёт бэкенд определяет по номеру или коду реестра в имени файла.
  importFiles: async (files) => {
    const body = new FormData();
    for (const file of await Promise.all(files.map(maybeGzip))) body.append('file', file);
    return client.post('/api/v1/payment-registries/import', body);
  },
};

// Выгрузка входящих платежей в реестр Сбер-формата для внешней системы. Фильтр платежей уходит параметрами запроса
// (как у списка входящих), выбор — телом (lib/paymentExport.js#exportBody).
export const paymentExportsApi = {
  list: (query) => client.get('/api/v1/payment-exports', { query }),
  preview: (query, body) => client.post('/api/v1/payment-exports/preview', body, { query }),
  create: (query, body) => client.post('/api/v1/payment-exports', body, { query }),
  // Отзыв: платежи снова считаются невыгруженными.
  revoke: (id) => client.delete(`/api/v1/payment-exports/${id}`),
  fileUrl: (id) => `/api/v1/payment-exports/${id}/file`,
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

// Получение выписок напрямую из банка (Sber API): состояние, запуск, токены.
// Реестры из почты: статус и журнал запусков, ручная проверка ящика (только администратор).
export const mailApi = {
  status: () => client.get('/api/v1/mail/status'),
  sync: () => client.post('/api/v1/mail/sync'),
};

export const sberApi = {
  status: () => client.get('/api/v1/sber/status'),
  sync: (body) => client.post('/api/v1/sber/sync', body),
  balances: () => client.get('/api/v1/sber/balances'),
  setTokens: (refreshToken) => client.put('/api/v1/sber/tokens', { refresh_token: refreshToken }),
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
