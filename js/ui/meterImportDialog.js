import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { meterReadingsApi } from '../api/resources.js';
import { meterResources, options } from '../lib/labels.js';
import { describeApiError, describeImportRowError } from '../lib/apiErrors.js';
import { buildingLabel } from '../lib/buildings.js';
import { createMonthPicker } from './monthPicker.js';
import { currentMonth } from '../lib/calculation.js';

const MAX_SHOWN_ERRORS = 50;

// Окно «Загрузить показания»: дом, ресурс, дата показаний и xlsx-файл -> POST /meter-readings/import.
// Колонки файла: квартира, номер счётчика, показания (у электричества Т1, Т2, Т3). Квартира с несколькими счётчиками — несколько строк.
export function openMeterImportDialog({ buildings, onImported }) {
  let modal;
  let submitting = false;

  const buildingSelect = el('select', { id: 'mi-building', required: true },
    buildings.map((b) => el('option', { value: String(b.id) }, buildingLabel(b))));
  const resourceSelect = el('select', { id: 'mi-resource', required: true },
    options(meterResources).map((o) => el('option', { value: o.value }, o.label)));
  const dateInput = el('input', { id: 'mi-date', type: 'date', required: true });
  // Расчётный месяц показаний: по умолчанию месяц даты, пока его не выбрали вручную.
  let periodTouched = false;
  const periodPicker = createMonthPicker({ value: currentMonth(), onChange: () => { periodTouched = true; } });
  dateInput.addEventListener('change', () => {
    if (!periodTouched && dateInput.value) periodPicker.value = dateInput.value.slice(0, 7);
  });
  const createBox = el('input', { id: 'mi-create', type: 'checkbox' });
  const installedInput = el('input', { id: 'mi-installed', type: 'date' });
  const installedField = el('div', { class: 'field' }, [el('label', { for: 'mi-installed' }, 'Дата ввода новых счётчиков в эксплуатацию'), installedInput]);
  installedField.hidden = true;
  createBox.addEventListener('change', () => {
    installedField.hidden = !createBox.checked;
    installedInput.required = createBox.checked;
  });
  const fileInput = el('input', { id: 'mi-file', type: 'file', accept: '.xlsx', required: true });
  const message = el('div', { role: 'alert' });
  message.hidden = true;
  const errorList = el('ul', { class: 'import-errors' });
  errorList.hidden = true;
  const submitButton = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Загрузить');
  const cancelButton = el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => modal.close() }, 'Отмена');

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
    if (!file || !dateInput.value || (createBox.checked && !installedInput.value)) {
      showMessage('Заполните все поля и выберите файл', 'error');
      return;
    }
    submitting = true;
    submitButton.disabled = true;
    message.hidden = true;
    errorList.hidden = true;
    try {
      const r = await meterReadingsApi.importFile({
        buildingId: buildingSelect.value,
        resource: resourceSelect.value,
        readingDate: dateInput.value,
        period: periodPicker.value,
        installedAt: createBox.checked ? installedInput.value : '',
        file,
      });
      showMessage(`Загружено показаний: ${r.readings}, создано новых счётчиков: ${r.meters_created}.`, 'success');
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

  const form = el('form', { class: 'entity-form', onsubmit: submit }, [
    el('p', { class: 'field-help' }, [
      'Первый лист файла .xlsx, первая строка — заголовок. Колонки: «Квартира», номер счётчика, показания ',
      '(у электричества три колонки: Т1, Т2, Т3; у однотарифного счётчика заполняется только Т1). ',
      'Если в квартире несколько счётчиков, квартира повторяется в нескольких строках. Все показания файла записываются на одну дату и за один месяц. ',
      'Показания округляются до трёх знаков. Если в файле есть ошибка, не загружается ничего.',
    ]),
    message,
    errorList,
    el('div', { class: 'field' }, [el('label', { for: 'mi-building' }, 'Дом'), buildingSelect]),
    el('div', { class: 'field' }, [el('label', { for: 'mi-resource' }, 'Ресурс'), resourceSelect]),
    el('div', { class: 'field' }, [el('label', { for: 'mi-date' }, 'Дата показаний'), dateInput]),
    el('div', { class: 'field' }, [el('label', {}, 'За какой месяц'), periodPicker.element,
      el('div', { class: 'field-help' }, 'В расчёт за этот месяц войдут показания файла. По умолчанию — месяц даты показаний.')]),
    el('label', { class: 'field-checkbox-label' }, [createBox, 'Создавать счётчики, которых ещё нет']),
    installedField,
    el('div', { class: 'field' }, [el('label', { for: 'mi-file' }, 'Файл xlsx'), fileInput]),
    el('div', { class: 'form-actions' }, [submitButton, cancelButton]),
  ]);

  modal = openModal({ title: 'Загрузить показания из Excel', content: form, wide: true });
  return modal;
}
