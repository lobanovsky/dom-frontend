import { el } from '../../lib/dom.js';
import { createCrudList } from '../../ui/crudList.js';
import { confirmDialog } from '../../ui/confirmDialog.js';
import { toast } from '../../ui/toast.js';
import { paymentExportsApi } from '../../api/resources.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { describeApiError } from '../../lib/apiErrors.js';
import { loadPaymentRefs, bankFilterOptions } from './common.js';
import { canWrite } from '../../lib/permissions.js';

// Выгруженные реестры: файлы, собранные из входящих платежей для загрузки во внешнюю систему.
// Выгрузку можно скачать повторно или отозвать — платежи снова станут «не выгруженными».
export async function paymentExportsPage(container) {
  container.replaceChildren(el('div', { class: 'table-status' }, 'Загрузка…'));
  let refs;
  try {
    refs = await loadPaymentRefs();
  } catch (err) {
    container.replaceChildren(el('div', { class: 'table-status table-status-error' }, describeApiError(err).message));
    return;
  }

  let list;
  async function revoke(exp) {
    const ok = await confirmDialog({
      title: 'Отзыв выгрузки',
      message: `Отозвать реестр ${exp.file_name}? Его ${exp.payments_count} платежей снова станут «не выгруженными» и попадут в следующий реестр. Если файл уже загружен во внешнюю систему, удалите его оттуда, иначе платежи задвоятся.`,
      confirmLabel: 'Отозвать',
      danger: true,
    });
    if (!ok) return;
    try {
      await paymentExportsApi.revoke(exp.id);
      toast.success('Выгрузка отозвана, платежи снова не выгружены');
      list.reload();
    } catch (err) {
      if (err.status !== 0 && err.status < 500) toast.error(describeApiError(err).message);
    }
  }

  list = createCrudList({
    api: paymentExportsApi,
    canEdit: false,
    filters: [{ name: 'bank_account_id', label: 'Счёт', type: 'select', options: bankFilterOptions(refs.banks) }],
    columns: [
      { key: 'created_at', label: 'Сформирован', primary: true, render: (r) => formatDate(r.created_at) },
      { key: 'file_name', label: 'Файл' },
      { key: 'number', label: 'Номер' },
      { key: 'bank_account_id', label: 'Счёт', render: (r) => refs.bankName(r.bank_account_id) },
      { key: 'payments_count', label: 'Платежей' },
      { key: 'total_amount', label: 'Сумма', render: (r) => el('span', { class: 'nowrap' }, formatMoney(r.total_amount)) },
      {
        key: 'actions', label: 'Действия',
        render: (r) => el('div', { class: 'row-actions' }, [
          el('a', { class: 'btn btn-sm', href: paymentExportsApi.fileUrl(r.id), download: r.file_name }, 'Скачать'),
          canWrite() ? el('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-danger-text', onclick: () => revoke(r) }, 'Отозвать') : null,
        ]),
      },
    ],
    emptyMessage: canWrite() ? 'Выгрузок пока нет. Отметьте платежи на странице «Входящие» и нажмите «Выгрузить в реестр»' : 'Выгрузок пока нет',
  });

  container.replaceChildren(el('div', { class: 'page' }, [
    el('div', { class: 'section-header' }, el('h1', {}, 'Выгруженные реестры')),
    el('p', { class: 'field-help' }, 'Реестры в Сбер-формате, собранные из входящих платежей для загрузки во внешнюю систему.'),
    list.element,
  ]));
}
