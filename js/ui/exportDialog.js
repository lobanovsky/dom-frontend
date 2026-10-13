import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { paymentExportsApi } from '../api/resources.js';
import { describeApiError } from '../lib/apiErrors.js';
import { formatMoney } from '../lib/format.js';
import { exportBody } from '../lib/paymentExport.js';
import { plural } from '../lib/registryImport.js';

const failed = (err) => err.status === 0 || err.status >= 500; // глобальный тост уже показан клиентом

// Окно «Выгрузить в реестр»: предпросмотр (сколько платежей и на какую сумму), «Сформировать», затем ссылка на файл.
// query — фильтры списка (в них должен быть банковский счёт), selection — выбор из lib/paymentExport.js,
// bankName — подпись счёта; onDone вызывается после формирования реестра (сбросить выбор и обновить список).
export function openExportDialog({ query, selection, bankName, onDone }) {
  const body = el('div', {}, el('div', { class: 'table-status' }, 'Подсчёт платежей…'));
  const modal = openModal({ title: 'Выгрузка в реестр', content: body });
  const closeRow = () => el('div', { class: 'form-actions' }, el('button', { type: 'button', class: 'btn', onclick: () => modal.close() }, 'Закрыть'));
  let creating = false;

  async function create(count) {
    if (creating) return;
    creating = true;
    try {
      const exp = await paymentExportsApi.create(query, exportBody(selection, count));
      onDone?.();
      body.replaceChildren(
        el('div', { class: 'form-success', role: 'status' }, `Реестр № ${exp.number} сформирован: ${exp.payments_count} ${plural(exp.payments_count, 'платёж', 'платежа', 'платежей')} на сумму ${formatMoney(exp.total_amount)}. Платежи помечены как выгруженные.`),
        el('p', { class: 'field-help' }, 'Загрузите этот файл во внешнюю систему. Позже его можно скачать на странице «Выгруженные реестры», там же выгрузку можно отозвать.'),
        el('div', { class: 'form-actions' }, [
          el('a', { class: 'btn btn-primary', href: paymentExportsApi.fileUrl(exp.id), download: exp.file_name }, `Скачать ${exp.file_name}`),
          el('button', { type: 'button', class: 'btn', onclick: () => modal.close() }, 'Закрыть'),
        ]),
      );
    } catch (err) {
      if (failed(err)) return modal.close();
      body.replaceChildren(el('div', { class: 'form-error', role: 'alert' }, describeApiError(err).message), closeRow());
    } finally {
      creating = false;
    }
  }

  paymentExportsApi.preview(query, exportBody(selection)).then((p) => {
    if (p.count === 0) {
      body.replaceChildren(el('div', { class: 'form-error', role: 'alert' }, 'Нет платежей для выгрузки: нужны платежи из выписок с лицевым счётом, которые ещё не выгружены.'), closeRow());
      return;
    }
    body.replaceChildren(
      el('p', {}, [
        'Счёт: ', el('b', {}, bankName(query.bank_account_id ? Number(query.bank_account_id) : p.bank_account_ids[0])), '. ',
        `Платежей в реестре: ${p.count}, на сумму ${formatMoney(p.total)}.`,
      ]),
      el('p', { class: 'field-help' }, 'В реестр попадают только платежи из выписок с распознанным лицевым счётом, которые ещё не выгружены. После формирования они получат отметку «выгружен».'),
      el('div', { class: 'form-actions' }, [
        el('button', { type: 'button', class: 'btn btn-primary', onclick: () => create(p.count) }, 'Сформировать'),
        el('button', { type: 'button', class: 'btn', onclick: () => modal.close() }, 'Отмена'),
      ]),
    );
  }, (err) => {
    if (failed(err)) return modal.close();
    body.replaceChildren(el('div', { class: 'form-error', role: 'alert' }, describeApiError(err).message), closeRow());
  });
  return modal;
}
