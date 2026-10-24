import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { openEntityForm } from '../../ui/entityForm.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { toast } from '../../ui/toast.js';
import { goTo } from '../../state/nav.js';
import { organizationsApi, servicesApi, tariffPricesApi, serviceNormsApi, accountServicesApi, buildingsApi, tariffsApi, metersApi } from '../../api/resources.js';
import { serviceFields, serviceNormFields, accountServiceFields } from '../fields.js';
import { openBulkAssignDialog } from '../../ui/bulkAssignDialog.js';
import { openBulkPeriodDialog } from '../../ui/bulkPeriodDialog.js';
import { serviceKinds, serviceUnits, accountPurposes, premisesKinds, label } from '../../lib/labels.js';
import { assignmentPeriod, calcMethodText, formatNorm, formatPrice, premisesKindsText, receiptName, tariffPeriod } from '../../lib/services.js';
import { formatReading, meterNumberText } from '../../lib/meters.js';
import { formatDate, todayIso } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { canWrite } from '../../lib/permissions.js';
import { notFoundView, definitionList, deletedBanner } from '../common.js';
import { buildingLabel, buildingLabelOf } from '../../lib/buildings.js';

// Карточка услуги: сведения и тариф. Цены ведутся только в справочнике тарифов: здесь ссылка на тариф, цена сейчас и история цен
// (только чтение). У услуги «сумма цен» тарифа нет — цена по составу.
export async function servicePage(container, { id }) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let service;
  let organizations;
  let services;
  let buildings;
  let catalog;
  let commonMeters;
  try {
    [service, { items: organizations }, { items: services }, { items: buildings }, { items: catalog }, { items: commonMeters }] = await Promise.all([
      servicesApi.get(id), organizationsApi.list({ limit: 200 }), servicesApi.list({ limit: 200 }), buildingsApi.list({ limit: 200 }), tariffsApi.list({ limit: 200 }),
      metersApi.list({ scope: 'common', limit: 200 }),
    ]);
  } catch (err) {
    container.replaceChildren(notFoundView(describeApiError(err).message, '/services', 'К списку услуг'));
    return;
  }

  const byId = new Map(services.map((s) => [s.id, s]));
  const info = el('div', { class: 'card' });
  const title = el('h1', {});
  const breadcrumbs = () => el('nav', { class: 'breadcrumbs' }, [el('a', { href: '/services' }, 'Услуги'), ' / ']);

  // Общедомовые счётчики услуги «по общедомовому счётчику»; не выбраны — расчёт не сможет взять расход.
  function metersRow() {
    if (service.calc_method !== 'common_meter') return null;
    const chosen = commonMeters.filter((m) => (service.meter_ids || []).includes(m.id));
    if (!chosen.length) return el('span', { class: 'badge badge-warning' }, 'Не выбраны — расчёт невозможен');
    return el('span', {}, chosen.flatMap((m, i) => [i ? ', ' : '', el('a', { href: `/buildings/${m.building_id}` }, `${buildingLabelOf(m)} — ${meterNumberText(m)}`)]));
  }

  function renderInfo() {
    title.textContent = service.name;
    const components = (service.component_ids || []).map((cid) => byId.get(cid)).filter(Boolean);
    info.replaceChildren(definitionList([
      ['Организация', service.organization_name],
      ['Вид', label(serviceKinds, service.kind)],
      ['Как считается', calcMethodText(service, byId)],
      ['Единица измерения', label(serviceUnits, service.unit)],
      ['На какой лицевой счёт', label(accountPurposes, service.account_purpose)],
      ['Для помещений', premisesKindsText(service.premises_kinds, premisesKinds)],
      ['Название в квитанции', service.receipt_name ? receiptName(service) : null],
      ['Состав', components.length ? el('span', {}, components.flatMap((c, i) => [i ? ', ' : '', el('a', { href: `/services/${c.id}` }, c.name)])) : null],
      ['Общедомовые счётчики', metersRow()],
      ['Тариф', service.tariff_id ? el('a', { href: `/tariffs/${service.tariff_id}` }, service.tariff_name) : null],
      ['Цена сейчас', service.current_price === null || service.current_price === undefined ? el('span', { class: 'badge badge-warning' }, 'Нет тарифа на сегодня') : formatPrice(service.current_price, service.unit)],
      ['Состояние', el('span', { class: `badge badge-${service.active ? 'success' : 'neutral'}` }, service.active ? 'Оказывается' : 'Не оказывается')],
      ['Порядок в квитанции', service.position || null],
      ['Комментарий', service.comment],
    ]));
  }

  if (service.deleted_at) {
    renderInfo();
    container.replaceChildren(el('div', { class: 'page' }, [
      breadcrumbs(),
      el('div', { class: 'section-header' }, title),
      deletedBanner({
        deletedAt: service.deleted_at,
        onRestore: async () => {
          try {
            await servicesApi.restore(service.id);
            toast.success('Восстановлено');
            servicePage(container, { id });
          } catch (err) {
            if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
          }
        },
      }),
      info,
    ]));
    return;
  }

  function edit() {
    openEntityForm({
      title: 'Услуга: редактирование',
      fields: serviceFields({ organizations, services, tariffs: catalog, commonMeters, selfId: service.id }),
      watch: ['calc_method', 'meter_resource', 'organization_id', 'unit'],
      entity: service,
      save: (body) => servicesApi.update(service.id, body),
      onSaved: (saved) => { service = saved; byId.set(saved.id, saved); renderInfo(); },
    });
  }

  async function remove() {
    const ok = await confirmDialog({ title: 'Удаление', message: `Удалить услугу «${service.name}»? Удалить можно только услугу без тарифов, не входящую в состав других услуг; обычно услугу просто отключают. Услуга попадёт в «Удалённые», её можно будет восстановить.`, confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    try {
      await servicesApi.remove(service.id);
      toast.success('Услуга удалена');
      goTo('/services');
    } catch (err) {
      if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err, { action: 'delete' }).message);
    }
  }

  // История цен тарифа услуги — только чтение: менять цены нужно в самом тарифе.
  const today = todayIso();
  const isCurrent = (p) => p.valid_from <= today && (!p.valid_to || p.valid_to >= today);
  const prices = !service.tariff_id ? null : createCrudList({
    entityTitle: 'Цена',
    api: tariffPricesApi,
    canEdit: false,
    fixedQuery: { tariff_id: service.tariff_id },
    rowClass: (p) => (isCurrent(p) ? null : 'row-muted'),
    columns: [
      { key: 'period', label: 'Период', primary: true, render: (p) => tariffPeriod(p.valid_from, p.valid_to, formatDate) },
      { key: 'price', label: 'Цена', render: (p) => el('span', { class: 'nowrap' }, formatPrice(p.price, service.unit)) },
      { key: 'now', label: '', render: (p) => (isCurrent(p) ? el('span', { class: 'badge badge-success' }, 'Действует') : '') },
      { key: 'comment', label: 'Комментарий' },
    ],
    emptyMessage: 'В тарифе пока нет цен',
  });

  function tariffNote() {
    if (!service.tariff_id) return el('p', { class: 'text-muted' }, 'У этой услуги своего тарифа нет: цена — сумма цен входящих в неё услуг на выбранную дату.');
    const hasPrice = service.current_price !== null && service.current_price !== undefined;
    return el('p', {}, [
      'Цена берётся из тарифа ', el('a', { href: `/tariffs/${service.tariff_id}` }, service.tariff_name), ': ',
      hasPrice ? el('strong', {}, `${formatPrice(service.current_price, service.unit)} сейчас`) : el('span', { class: 'badge badge-warning' }, 'на сегодня цены нет'),
      '. Цены меняются в тарифе, для всех услуг с этим тарифом сразу.',
    ]);
  }

  // Нормативы домов (Гкал на м²) — только у услуги «площадь × норматив»; цена за Гкал — в тарифах.
  const norms = service.calc_method !== 'per_area_norm' ? null : createCrudList({
    entityTitle: 'Норматив',
    addLabel: 'Добавить норматив',
    api: serviceNormsApi,
    fields: serviceNormFields(buildings.filter((b) => b.organization_id === service.organization_id)),
    fixedQuery: { service_id: service.id },
    fixed: { service_id: service.id },
    newDefaults: { valid_from: today },
    filters: [
      { name: 'building_id', label: 'Дом', type: 'select', options: buildings.map((b) => ({ value: String(b.id), label: buildingLabel(b) })) },
    ],
    rowClass: (n) => (n.valid_from <= today && (!n.valid_to || n.valid_to >= today) ? null : 'row-muted'),
    columns: [
      { key: 'building', label: 'Дом', primary: true, render: (n) => el('a', { href: `/buildings/${n.building_id}` }, buildingLabelOf(n)) },
      { key: 'period', label: 'Период', render: (n) => tariffPeriod(n.valid_from, n.valid_to, formatDate) },
      { key: 'value', label: 'Норматив, Гкал/м²', render: (n) => el('span', { class: 'nowrap' }, formatNorm(n.value)) },
      { key: 'now', label: '', render: (n) => (n.valid_from <= today && (!n.valid_to || n.valid_to >= today) ? el('span', { class: 'badge badge-success' }, 'Действует') : '') },
      { key: 'comment', label: 'Комментарий' },
    ],
    emptyMessage: 'Нормативов пока нет',
    deleteMessage: (n) => `Удалить норматив ${formatNorm(n.value)} для дома «${buildingLabelOf(n)}» (${tariffPeriod(n.valid_from, n.valid_to, formatDate)})?`,
  });

  // Лицевые счета, которым назначена услуга.
  const assignments = createCrudList({
    entityTitle: 'Назначение',
    addLabel: 'Назначить счёту',
    api: accountServicesApi,
    fields: accountServiceFields({ service }),
    fixedQuery: { service_id: service.id },
    fixed: { service_id: service.id },
    filters: [
      { name: 'building_id', label: 'Дом', type: 'select', options: buildings.map((b) => ({ value: String(b.id), label: buildingLabel(b) })) },
      { name: 'active_on', label: 'Действует на', type: 'date' },
    ],
    columns: [
      { key: 'premises', label: 'Помещение', primary: true, render: (x) => el('div', {}, [
        el('a', { href: `/premises/${x.premises_id}` }, `${label(premisesKinds, x.premises_kind)} № ${x.premises_number}`),
        el('div', { class: 'text-muted' }, buildingLabelOf(x))]) },
      { key: 'account', label: 'Лицевой счёт', render: (x) => `№ ${x.account_number}` },
      { key: 'period', label: 'Период', render: (x) => assignmentPeriod(x.valid_from, x.valid_to, formatDate) },
      { key: 'quantity', label: 'Количество', render: (x) => (x.quantity === null || x.quantity === undefined ? '' : formatReading(x.quantity)) },
      { key: 'comment', label: 'Комментарий' },
    ],
    emptyMessage: 'Услуга пока не назначена ни одному счёту',
    deleteMessage: (x) => `Убрать услугу у счёта № ${x.account_number}?`,
  });

  function bulkAssign() {
    openBulkAssignDialog({ service, buildings, onDone: () => assignments.reload() });
  }

  function bulkPeriod() {
    openBulkPeriodDialog({ service, buildings, onDone: () => assignments.reload() });
  }

  renderInfo();
  container.replaceChildren(el('div', { class: 'page' }, [
    breadcrumbs(),
    el('div', { class: 'section-header' }, [
      title,
      canWrite() ? el('div', { class: 'header-actions' }, [
        service.active ? el('button', { type: 'button', class: 'btn', onclick: bulkAssign }, 'Назначить счетам') : null,
        el('button', { type: 'button', class: 'btn', onclick: bulkPeriod }, 'Изменить период'),
        el('button', { type: 'button', class: 'btn', onclick: edit }, 'Изменить'),
        el('button', { type: 'button', class: 'btn btn-ghost btn-danger-text', onclick: remove }, 'Удалить'),
      ]) : null,
    ]),
    info,
    el('h2', { class: 'section-title' }, 'Тариф'),
    tariffNote(),
    prices ? prices.element : null,
    norms ? el('h2', { class: 'section-title' }, 'Нормативы домов') : null,
    norms ? el('p', { class: 'text-muted' }, 'Объём = площадь помещения × норматив дома; сумма = объём × тариф за Гкал. Норматив у каждого дома свой и меняется по датам.') : null,
    norms ? norms.element : null,
    el('h2', { class: 'section-title' }, 'Назначена счетам'),
    assignments.element,
  ]));
}
