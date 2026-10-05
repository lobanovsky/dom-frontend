import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { buildingsApi } from '../api/resources.js';
import { premisesKinds, options } from '../lib/labels.js';
import { describeApiError, describeImportRowError } from '../lib/apiErrors.js';

const MAX_SHOWN_ERRORS = 50;

// Модальное окно «Импорт из Excel»: вид помещений + xlsx-файл -> POST /buildings/{id}/import.
// После успешной загрузки вызывается onImported(result); окно остаётся с итогом.
export function openImportDialog({ buildingId, onImported }) {
  let modal;
  let submitting = false;

  const kindSelect = el('select', { id: 'import-kind', required: true },
    options(premisesKinds).map((o) => el('option', { value: o.value }, o.label)));
  const fileInput = el('input', { id: 'import-file', type: 'file', accept: '.xlsx', required: true });
  const message = el('div', { role: 'alert' });
  message.hidden = true;
  const errorList = el('ul', { class: 'import-errors' });
  errorList.hidden = true;
  const submitButton = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Загрузить');

  function showMessage(text, variant) {
    message.className = variant === 'success' ? 'form-success' : 'form-error';
    message.textContent = text;
    message.hidden = false;
  }

  function showRowErrors(rows) {
    const shown = rows.slice(0, MAX_SHOWN_ERRORS).map((r) => el('li', {}, `Строка ${r.row}: ${describeImportRowError(r.error)}`));
    if (rows.length > MAX_SHOWN_ERRORS) shown.push(el('li', {}, `…и ещё ${rows.length - MAX_SHOWN_ERRORS}`));
    errorList.replaceChildren(...shown);
    errorList.hidden = false;
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    const file = fileInput.files[0];
    if (!file) {
      showMessage('Выберите файл', 'error');
      return;
    }
    submitting = true;
    submitButton.disabled = true;
    message.hidden = true;
    errorList.hidden = true;
    try {
      const r = await buildingsApi.importFile(buildingId, kindSelect.value, file);
      showMessage(
        `Загружено: помещений ${r.premises}, лицевых счетов ${r.accounts}, собственников ${r.persons_created} новых и ${r.persons_reused} уже были в базе.`,
        'success',
      );
      submitButton.hidden = true;
      cancelButton.textContent = 'Закрыть';
      onImported?.(r);
    } catch (err) {
      if (err.status === 0 || err.status >= 500) return; // глобальный тост уже показан клиентом
      showMessage(describeApiError(err).message, 'error');
      if (err.rows?.length) showRowErrors(err.rows);
    } finally {
      submitting = false;
      submitButton.disabled = false;
    }
  }

  const cancelButton = el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => modal.close() }, 'Отмена');

  const form = el('form', { class: 'entity-form', onsubmit: submit }, [
    el('p', { class: 'field-help' }, [
      'Первый лист файла .xlsx, первая строка — заголовок. Колонки по порядку: ',
      'номер, площадь, кадастровый номер, фамилия, имя, отчество, лицевой счёт ЖКУ, лицевой счёт капремонта. ',
      'Номера счетов должны быть текстом, иначе Excel потеряет ведущие нули. ',
      'Все помещения файла получают один вид, поэтому квартиры, офисы и машиноместа загружаются отдельными файлами. ',
      'Собственники с одинаковым ФИО считаются одним человеком. Если в файле есть ошибка, не загружается ничего.',
    ]),
    message,
    errorList,
    el('div', { class: 'field' }, [el('label', { for: 'import-kind' }, 'Вид помещений'), kindSelect]),
    el('div', { class: 'field' }, [el('label', { for: 'import-file' }, 'Файл xlsx'), fileInput]),
    el('div', { class: 'form-actions' }, [submitButton, cancelButton]),
  ]);

  modal = openModal({ title: 'Импорт из Excel', content: form, wide: true });
  return modal;
}
