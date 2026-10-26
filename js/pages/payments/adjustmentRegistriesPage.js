import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { openEntityForm } from '../../ui/entityForm.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { saveFile } from '../../ui/saveFile.js';
import { toast } from '../../ui/toast.js';
import { adjustmentRegistriesApi } from '../../api/resources.js';
import { adjustmentRegistryFields } from '../fields.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { buildingLabelOf } from '../../lib/buildings.js';
import { premisesKinds, label } from '../../lib/labels.js';
import { pendingSummary, resolvedText } from '../../lib/adjustment.js';
import { loadPaymentRefs } from './common.js';
import { canWrite } from '../../lib/permissions.js';

// Корректировочные реестры: при смене собственника долг прежнего закрывается условным платежом во внешней системе
// (файл реестра загружают туда, а когда придёт настоящая оплата, условный платёж там удаляют и отмечают «Снято» здесь).
// В этой системе платежи не создаются: журнал нужен, чтобы не забыть убрать условные платежи.
export async function adjustmentRegistriesPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let refs;
  try {
    refs = await loadPaymentRefs();
  } catch (err) {
    container.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return;
  }

  const banner = el('div', { class: 'text-warning' });
  banner.hidden = true;
  async function refreshBanner() {
    try {
      const { items } = await adjustmentRegistriesApi.list({ resolved: 'false', limit: 200 });
      const { count, total } = pendingSummary(items);
      banner.hidden = count === 0;
      banner.textContent = `Не снято условных платежей: ${count} на ${formatMoney(total)}. Уберите их во внешней системе, когда придёт настоящая оплата.`;
    } catch {
      banner.hidden = true;
    }
  }

  let list;
  const reload = () => { list.reload(); refreshBanner(); };
  const guard = async (action, success) => {
    try {
      await action();
      if (success) toast.success(success);
      reload();
    } catch (err) {
      if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
    }
  };

  async function download(r) {
    try {
      saveFile(await adjustmentRegistriesApi.download(r.id));
    } catch (err) {
      if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
    }
  }

  function openForm() {
    openEntityForm({
      title: 'Корректировочный реестр',
      fields: adjustmentRegistryFields(refs.banks),
      initialValues: { payer_name: 'Корректировка: смена собственника' },
      submitLabel: 'Сформировать',
      successMessage: 'Реестр сформирован',
      save: (body) => adjustmentRegistriesApi.create(body),
      onSaved: (r) => { download(r); reload(); },
    });
  }

  async function remove(r) {
    const ok = await confirmDialog({
      title: 'Удаление из журнала',
      message: `Убрать из журнала реестр ${r.file_name}? Если условный платёж ещё лежит во внешней системе, его надо удалить и там: журнал о нём больше не напомнит.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (ok) guard(() => adjustmentRegistriesApi.remove(r.id), 'Удалено из журнала');
  }

  list = createCrudList({
    api: adjustmentRegistriesApi,
    canEdit: false,
    filters: [{ name: 'resolved', label: 'Состояние', type: 'select', allLabel: 'Все', options: [{ value: 'false', label: 'Висят' }, { value: 'true', label: 'Сняты' }] }],
    rowClass: (r) => (r.resolved_at ? 'row-muted' : null),
    columns: [
      { key: 'created_at', label: 'Сформирован', primary: true, render: (r) => formatDate(r.created_at) },
      { key: 'account', label: 'Лицевой счёт', render: (r) => el('a', { href: `/premises/${r.premises_id}` }, `№ ${r.account_number}`) },
      { key: 'premises', label: 'Помещение', render: (r) => `${buildingLabelOf(r)}, ${label(premisesKinds, r.premises_kind)} № ${r.premises_number}` },
      { key: 'amount', label: 'Сумма', render: (r) => el('span', { class: 'nowrap' }, formatMoney(r.amount)) },
      { key: 'bank', label: 'Счёт', render: (r) => refs.bankName(r.bank_account_id) },
      { key: 'comment', label: 'Комментарий', render: (r) => r.comment || '' },
      { key: 'status', label: 'Состояние', render: (r) => el('span', { class: r.resolved_at ? 'badge' : 'badge badge-warning' }, resolvedText(r)) },
      {
        key: 'actions', label: 'Действия',
        render: (r) => el('div', { class: 'row-actions' }, [
          el('button', { type: 'button', class: 'btn btn-sm', onclick: () => download(r) }, 'Скачать'),
          canWrite() ? el('button', {
            type: 'button', class: 'btn btn-ghost btn-sm',
            onclick: () => guard(() => (r.resolved_at ? adjustmentRegistriesApi.unresolve(r.id) : adjustmentRegistriesApi.resolve(r.id))),
          }, r.resolved_at ? 'Вернуть в «Висят»' : 'Отметить снятым') : null,
          canWrite() ? el('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-danger-text', onclick: () => remove(r) }, 'Удалить') : null,
        ]),
      },
    ],
    emptyMessage: 'Корректировочных реестров пока нет',
  });

  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, [
      el('h1', {}, 'Корректировочные реестры'),
      canWrite() ? el('div', { class: 'header-actions' }, [el('button', { type: 'button', class: 'btn btn-primary', onclick: openForm }, 'Сформировать реестр')]) : null,
    ]),
    el('p', { class: 'field-help' }, 'Для смены собственника: файл реестра с условным платежом на лицевой счёт закрывает долг прежнего собственника, и новый получает квитанцию без долга. Файл загружается во внешнюю систему. Когда прежний собственник заплатит по-настоящему, условный платёж там удаляют, а здесь отмечают «Снято». Платежи в этой системе не создаются.'),
    banner,
    list.element,
  ]));
  refreshBanner();
}
