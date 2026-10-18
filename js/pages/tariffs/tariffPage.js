import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { openEntityForm } from '../../ui/entityForm.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { toast } from '../../ui/toast.js';
import { goTo } from '../../state/nav.js';
import { organizationsApi, tariffsApi, tariffPricesApi, servicesApi } from '../../api/resources.js';
import { tariffFields, tariffPriceFields } from '../fields.js';
import { serviceKinds, serviceUnits, accountPurposes, premisesKinds, label } from '../../lib/labels.js';
import { formatMoney, formatPrice, premisesKindsText, tariffPeriod } from '../../lib/services.js';
import { formatDate, todayIso } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { canWrite } from '../../lib/permissions.js';
import { notFoundView, definitionList, deletedBanner } from '../common.js';

// Карточка тарифа: сведения, цены по периодам и услуги, которые берут цену из этого тарифа.
export async function tariffPage(container, { id }) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let tariff;
  let organizations;
  try {
    [tariff, { items: organizations }] = await Promise.all([tariffsApi.get(id), organizationsApi.list({ limit: 200 })]);
  } catch (err) {
    container.replaceChildren(notFoundView(describeApiError(err).message, '/tariffs', 'К списку тарифов'));
    return;
  }

  const info = el('div', { class: 'card' });
  const title = el('h1', {});
  const breadcrumbs = () => el('nav', { class: 'breadcrumbs' }, [el('a', { href: '/tariffs' }, 'Тарифы'), ' / ']);

  function renderInfo() {
    title.textContent = tariff.name;
    info.replaceChildren(definitionList([
      ['Организация', tariff.organization_name],
      ['Единица измерения', label(serviceUnits, tariff.unit)],
      ['Цена сейчас', tariff.current_price === null || tariff.current_price === undefined ? el('span', { class: 'badge badge-warning' }, 'Нет цены на сегодня') : formatPrice(tariff.current_price, tariff.unit)],
      ['Услуг с этим тарифом', tariff.services_count],
      ['Комментарий', tariff.comment],
    ]));
  }

  if (tariff.deleted_at) {
    renderInfo();
    container.replaceChildren(el('div', { class: 'page' }, [
      breadcrumbs(),
      el('div', { class: 'section-header' }, title),
      deletedBanner({
        deletedAt: tariff.deleted_at,
        onRestore: async () => {
          try {
            await tariffsApi.restore(tariff.id);
            toast.success('Восстановлено');
            tariffPage(container, { id });
          } catch (err) {
            if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
          }
        },
      }),
      info,
    ]));
    return;
  }

  async function refresh() {
    try {
      tariff = await tariffsApi.get(id);
      renderInfo();
    } catch {
      // карточка обновится при следующем открытии
    }
  }
  const pricesApi = {
    ...tariffPricesApi,
    create: async (body) => { const r = await tariffPricesApi.create(body); refresh(); return r; },
    update: async (pid, body) => { const r = await tariffPricesApi.update(pid, body); refresh(); return r; },
    remove: async (pid) => { await tariffPricesApi.remove(pid); refresh(); },
    restore: async (pid) => { const r = await tariffPricesApi.restore(pid); refresh(); return r; },
  };

  function edit() {
    openEntityForm({
      title: 'Тариф: редактирование',
      fields: tariffFields(organizations),
      entity: tariff,
      save: (body) => tariffsApi.update(tariff.id, body),
      onSaved: (saved) => { tariff = { ...tariff, ...saved }; refresh(); },
    });
  }

  async function remove() {
    const ok = await confirmDialog({ title: 'Удаление', message: `Удалить тариф «${tariff.name}»? Удалить можно только тариф без цен и без услуг. Тариф попадёт в «Удалённые», его можно будет восстановить.`, confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    try {
      await tariffsApi.remove(tariff.id);
      toast.success('Тариф удалён');
      goTo('/tariffs');
    } catch (err) {
      if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err, { action: 'delete' }).message);
    }
  }

  const today = todayIso();
  const current = (p) => p.valid_from <= today && (!p.valid_to || p.valid_to >= today);
  const prices = createCrudList({
    entityTitle: 'Цена',
    addLabel: 'Добавить цену',
    api: pricesApi,
    fields: () => tariffPriceFields(tariff),
    fixedQuery: { tariff_id: tariff.id },
    fixed: { tariff_id: tariff.id },
    newDefaults: { valid_from: today },
    rowClass: (p) => (current(p) ? null : 'row-muted'),
    columns: [
      { key: 'period', label: 'Период', primary: true, render: (p) => tariffPeriod(p.valid_from, p.valid_to, formatDate) },
      { key: 'price', label: 'Цена', render: (p) => el('span', { class: 'nowrap' }, formatMoney(p.price)) },
      { key: 'now', label: '', render: (p) => (current(p) ? el('span', { class: 'badge badge-success' }, 'Действует') : '') },
      { key: 'comment', label: 'Комментарий' },
    ],
    emptyMessage: 'Цен пока нет',
    deleteMessage: (p) => `Удалить цену ${tariffPeriod(p.valid_from, p.valid_to, formatDate)}?`,
  });

  // Услуги, которые берут цену из тарифа (только просмотр; тариф выбирается в самой услуге).
  const used = createCrudList({
    entityTitle: 'Услуга',
    api: servicesApi,
    canEdit: false,
    fields: [],
    fixedQuery: { tariff_id: tariff.id },
    columns: [
      { key: 'name', label: 'Услуга', primary: true, render: (s) => el('a', { href: `/services/${s.id}` }, s.name) },
      { key: 'kind', label: 'Вид', render: (s) => label(serviceKinds, s.kind) },
      { key: 'account_purpose', label: 'Счёт', render: (s) => label(accountPurposes, s.account_purpose) },
      { key: 'premises', label: 'Помещения', render: (s) => premisesKindsText(s.premises_kinds, premisesKinds) },
    ],
    emptyMessage: 'Пока ни одна услуга не берёт цену из этого тарифа. Выберите тариф в карточке услуги',
  });

  renderInfo();
  container.replaceChildren(el('div', { class: 'page' }, [
    breadcrumbs(),
    el('div', { class: 'section-header' }, [
      title,
      canWrite() ? el('div', { class: 'header-actions' }, [
        el('button', { type: 'button', class: 'btn', onclick: edit }, 'Изменить'),
        el('button', { type: 'button', class: 'btn btn-ghost btn-danger-text', onclick: remove }, 'Удалить'),
      ]) : null,
    ]),
    info,
    el('h2', { class: 'section-title' }, 'Цены'),
    prices.element,
    el('h2', { class: 'section-title' }, 'Услуги с этим тарифом'),
    used.element,
  ]));
}
