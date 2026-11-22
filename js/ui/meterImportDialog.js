import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { meterReadingsApi } from '../api/resources.js';
import { meterResources, options } from '../lib/labels.js';
import { describeApiError, describeImportRowError } from '../lib/apiErrors.js';
import { buildingLabel } from '../lib/buildings.js';
import { createMonthPicker } from './monthPicker.js';
import { currentMonth } from '../lib/calculation.js';
import { confirmDialog } from './confirmDialog.js';

const MAX_SHOWN_ERRORS = 50;

const kwh = (value) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} кВт·ч`;

function highUsageConfirmation(warnings, lowerEstimates = []) {
  return el('div', {}, [
    el('p', {}, 'Расход по этим счётчикам больше чем втрое превышает предыдущий месяц. Проверьте показания. Если значения верны, подтвердите импорт:'),
    el('ul', {}, warnings.map((w) => el('li', {}, `${w.premises ? `Квартира ${w.premises} · ` : ''}${w.meter_serial}: ${kwh(w.previous_usage)} → ${kwh(w.current_usage)}`))),
    lowerEstimates.length ? el('p', {}, `Ещё ${lowerEstimates.length} показаний ниже предыдущих фактических; вместо них будет записан расчёт по среднему.`) : null,
  ]);
}

// Вода загружается в прежнем формате xlsx, электричество — из выгрузки УМ-31RTU (.xls).
export function openMeterImportDialog({ buildings, onImported }) {
  let modal;
  let submitting = false;

  const buildingSelect = el('select', { id: 'mi-building', required: true },
    buildings.map((b) => el('option', { value: String(b.id) }, buildingLabel(b))));
  const resourceSelect = el('select', { id: 'mi-resource', required: true },
    options(meterResources).map((o) => el('option', { value: o.value }, o.label)));
  const dateInput = el('input', { id: 'mi-date', type: 'date', required: true });
  let periodTouched = false;
  const periodPicker = createMonthPicker({ value: currentMonth(), onChange: () => { periodTouched = true; } });
  dateInput.addEventListener('change', () => {
    if (!periodTouched && dateInput.value) periodPicker.value = dateInput.value.slice(0, 7);
  });
  const createBox = el('input', { id: 'mi-create', type: 'checkbox' });
  const createLabel = el('label', { class: 'field-checkbox-label' }, [createBox, 'Создавать счётчики, которых ещё нет']);
  const installedInput = el('input', { id: 'mi-installed', type: 'date' });
  const installedField = el('div', { class: 'field' }, [el('label', { for: 'mi-installed' }, 'Дата ввода новых счётчиков в эксплуатацию'), installedInput]);
  installedField.hidden = true;
  createBox.addEventListener('change', () => { installedField.hidden = !createBox.checked; installedInput.required = createBox.checked; });
  const averageMonthsInput = el('input', { id: 'mi-average-months', type: 'number', min: '1', max: '12', step: '1', value: '1', required: true });
  const averageMonthsField = el('div', { class: 'field' }, [el('label', { for: 'mi-average-months' }, 'Месяцев для расчёта среднего'), averageMonthsInput,
    el('div', { class: 'field-help' }, 'Средний расход рассчитывается отдельно для каждого тарифа.')]);
  const fileInput = el('input', { id: 'mi-file', type: 'file', accept: '.xlsx', required: true });
  const fileLabel = el('label', { for: 'mi-file' }, 'Файл xlsx');
  const fileField = el('div', { class: 'field' }, [fileLabel, fileInput]);
  const dateField = el('div', { class: 'field' }, [el('label', { for: 'mi-date' }, 'Дата показаний'), dateInput]);
  const periodField = el('div', { class: 'field' }, [el('label', {}, 'За какой месяц'), periodPicker.element,
    el('div', { class: 'field-help' }, 'В расчёт за этот месяц войдут показания файла. По умолчанию — месяц даты показаний.')]);
  const message = el('div', { role: 'alert' });
  message.hidden = true;
  const errorList = el('ul', { class: 'import-errors' });
  errorList.hidden = true;
  const warningList = el('ul', { class: 'import-warnings' });
  warningList.hidden = true;
  const submitButton = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Загрузить');
  const cancelButton = el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => modal.close() }, 'Отмена');
  const help = el('p', { class: 'field-help' });

  function updateResourceFields() {
    const um31 = resourceSelect.value === 'electricity';
    dateField.hidden = um31;
    periodField.hidden = um31;
    installedField.hidden = um31 || !createBox.checked;
    createLabel.hidden = um31;
    averageMonthsField.hidden = !um31;
    averageMonthsInput.required = um31;
    dateInput.required = !um31;
    fileInput.accept = um31 ? '.xls' : '.xlsx';
    fileInput.value = '';
    fileLabel.textContent = um31 ? 'Файл УМ-31RTU (.xls)' : 'Файл xlsx';
    help.textContent = um31
      ? 'Используются серийный номер, дата и время, общее показание и тарифы Т1–Т3. Уже внесённые за этот месяц показания сохраняются. Для действующих квартирных счётчиков без строки в файле создаётся расчётное показание по среднему расходу.'
      : 'Для воды используйте прежний формат .xlsx: квартира, номер счётчика и показание. Все показания файла записываются на одну дату и за один месяц.';
  }
  resourceSelect.addEventListener('change', updateResourceFields);
  updateResourceFields();

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
    const um31 = resourceSelect.value === 'electricity';
    if (!file || (!um31 && !dateInput.value) || (createBox.checked && !um31 && !installedInput.value)
      || (um31 && (!averageMonthsInput.value || !Number.isInteger(Number(averageMonthsInput.value))
        || Number(averageMonthsInput.value) < 1 || Number(averageMonthsInput.value) > 12))) {
      showMessage('Заполните все поля и выберите файл', 'error');
      return;
    }
    submitting = true;
    submitButton.disabled = true;
    message.hidden = true;
    errorList.hidden = true;
    warningList.hidden = true;
    try {
      let r;
      if (um31) {
        const input = { buildingId: buildingSelect.value, averageMonths: averageMonthsInput.value, file };
        try {
          r = await meterReadingsApi.importUM31File(input);
        } catch (err) {
          if (err.status !== 409 || !err.highUsageWarnings?.length) throw err;
          const accepted = await confirmDialog({
            title: 'Проверка высокого расхода',
            message: highUsageConfirmation(err.highUsageWarnings, err.lowerReadingEstimates),
            confirmLabel: 'Подтвердить импорт',
            cancelLabel: 'Отмена',
          });
          if (!accepted) {
            showMessage('Импорт отменён. Данные не изменены.', 'error');
            return;
          }
          r = await meterReadingsApi.importUM31File({ ...input, confirmHighUsage: true });
        }
      } else {
        r = await meterReadingsApi.importFile({
          buildingId: buildingSelect.value,
          resource: resourceSelect.value,
          readingDate: dateInput.value,
          period: periodPicker.value,
          installedAt: createBox.checked ? installedInput.value : '',
          file,
        });
      }
      const details = um31
        ? ` Рассчитано по среднему: ${r.estimated_readings}; ниже предыдущих фактических заменено расчётом: ${r.lower_reading_estimates?.length || 0}; подтверждён высокий расход: ${r.high_usage_warnings?.length || 0}; пропущено как уже заполненные: ${r.skipped_existing}; без расчёта (нет истории или счётчик не квартирный): ${r.skipped_no_history}${r.skipped_no_history_meters?.length ? ` (счётчики: ${r.skipped_no_history_meters.slice(0, 10).join(', ')}${r.skipped_no_history_meters.length > 10 ? ` и ещё ${r.skipped_no_history_meters.length - 10}` : ''})` : ''}.`
        : ` Создано новых счётчиков: ${r.meters_created}.`;
      showMessage(`Загружено показаний: ${r.readings}.${details}`, 'success');
      if (um31) {
        const notices = [
          ...(r.lower_reading_estimates || []).map((w) => `${w.premises ? `Квартира ${w.premises} · ` : ''}${w.meter_serial}: показание файла ${kwh(w.file_reading)} ниже предыдущего фактического ${kwh(w.previous_reading)}; записано расчётное ${kwh(w.applied_reading)}.`),
          ...(r.high_usage_warnings || []).map((w) => `${w.premises ? `Квартира ${w.premises} · ` : ''}${w.meter_serial}: подтверждён расход ${kwh(w.current_usage)} после ${kwh(w.previous_usage)} за прошлый месяц.`),
        ];
        if (notices.length) {
          warningList.replaceChildren(...notices.slice(0, 10).map((text) => el('li', {}, text)));
          if (notices.length > 10) warningList.append(el('li', {}, `…и ещё ${notices.length - 10}`));
          warningList.hidden = false;
        }
      }
      submitButton.hidden = true;
      cancelButton.textContent = 'Закрыть';
      onImported?.(r);
    } catch (err) {
      if (err.status === 0 || err.status >= 500) return;
      showMessage(describeApiError(err).message, 'error');
      if (err.rows?.length) showRowErrors(err.rows);
    } finally {
      submitting = false;
      submitButton.disabled = false;
    }
  }

  const form = el('form', { class: 'entity-form', onsubmit: submit }, [
    help,
    message,
    errorList,
    warningList,
    el('div', { class: 'field' }, [el('label', { for: 'mi-building' }, 'Дом'), buildingSelect]),
    el('div', { class: 'field' }, [el('label', { for: 'mi-resource' }, 'Ресурс'), resourceSelect]),
    dateField,
    periodField,
    averageMonthsField,
    createLabel,
    installedField,
    fileField,
    el('div', { class: 'form-actions' }, [submitButton, cancelButton]),
  ]);

  modal = openModal({ title: 'Загрузить показания из Excel', content: form, wide: true });
  return modal;
}
