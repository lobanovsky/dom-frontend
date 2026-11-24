import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { meterReadingsApi } from '../api/resources.js';
import { describeApiError, describeImportRowError } from '../lib/apiErrors.js';
import { buildingLabel } from '../lib/buildings.js';

const MAX_SHOWN_ERRORS = 50;

const usage = (value, unit) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} ${unit}`;

function highUsageConfirmation(warnings, lowerEstimates = [], issues = []) {
  lowerEstimates = Array.isArray(lowerEstimates) ? lowerEstimates : [];
  issues = Array.isArray(issues) ? issues : [];
  const unit = warnings[0]?.unit || 'кВт·ч';
  return el('div', {}, [
    el('p', {}, `Расход по этим счётчикам больше чем втрое превышает предыдущий месяц (${unit}). Проверьте показания. Если значения верны, подтвердите импорт:`),
    el('ul', {}, warnings.map((w) => el('li', {}, `${w.premises ? `Квартира ${w.premises} · ` : ''}${w.meter_serial}: ${usage(w.previous_usage, w.unit || unit)} → ${usage(w.current_usage, w.unit || unit)}`))),
    lowerEstimates.length ? el('p', {}, `Ещё ${lowerEstimates.length} показаний ниже предыдущих фактических; вместо них будет записан расчёт по среднему.`) : null,
    issues.length ? el('p', {}, `В истории загрузки также сохранится ${issues.length} замечаний и пропусков.`) : null,
  ]);
}

// Вода загружается из Пульсара (.xlsx), электричество — из УМ-31RTU (.xls).
export function openMeterImportDialog({ buildings, onImported }) {
  let modal;
  let submitting = false;
  let pendingConfirmation = null;

  const buildingSelect = el('select', { id: 'mi-building', required: true },
    buildings.map((b) => el('option', { value: String(b.id) }, buildingLabel(b))));
  const resourceSelect = el('select', { id: 'mi-resource', required: true }, [
    el('option', { value: 'water_pulsar' }, 'Вода · Пульсар (ХВС и ГВС)'),
    el('option', { value: 'electricity' }, 'Электроэнергия · УМ-31RTU'),
  ]);
  const averageMonthsInput = el('input', { id: 'mi-average-months', type: 'number', min: '1', max: '12', step: '1', value: '1', required: true });
  const averageMonthsField = el('div', { class: 'field' }, [el('label', { for: 'mi-average-months' }, 'Месяцев для расчёта среднего'), averageMonthsInput,
    el('div', { class: 'field-help' }, 'Средний расход рассчитывается отдельно для каждого тарифа.')]);
  const fileInput = el('input', { id: 'mi-file', type: 'file', accept: '.xlsx', required: true });
  const fileLabel = el('label', { for: 'mi-file' }, 'Файл xlsx');
  const fileField = el('div', { class: 'field' }, [fileLabel, fileInput]);
  const message = el('div', { role: 'alert' });
  message.hidden = true;
  const errorList = el('ul', { class: 'import-errors' });
  errorList.hidden = true;
  const warningList = el('ul', { class: 'import-warnings' });
  warningList.hidden = true;
  const confirmationBox = el('div', { class: 'import-undo-confirm', hidden: true });
  const submitButton = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Загрузить');
  const cancelButton = el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => modal.close() }, 'Отмена');
  const help = el('p', { class: 'field-help' });

  function updateResourceFields() {
    const um31 = resourceSelect.value === 'electricity';
    const pulsar = resourceSelect.value === 'water_pulsar';
    averageMonthsField.hidden = !um31;
    averageMonthsInput.required = um31;
    fileInput.accept = um31 ? '.xls' : '.xlsx';
    fileInput.value = '';
    fileLabel.textContent = um31 ? 'Файл УМ-31RTU (.xls)' : 'Файл Пульсара (.xlsx)';
    help.textContent = um31
      ? 'Используются серийный номер, дата и время, общее показание и тарифы Т1–Т3. Уже внесённые за этот месяц показания сохраняются. Счётчики с ручной передачей пропускаются. Для остальных действующих квартирных счётчиков без строки в файле создаётся расчётное показание по среднему расходу. Если показание ниже системного, сохраняется системное (нулевой расход); превышение потребления более чем втрое записывается в замечания, но не блокирует загрузку.'
      : (pulsar ? 'Дата берётся из заголовка отчёта. Показания ХВС и ГВС загружаются вместе; пустые значения и неподходящие счётчики будут пропущены и указаны в истории.' : '');
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

  function requestHighUsageConfirmation(warnings, lowerEstimates, issues) {
    return new Promise((resolve) => {
      const finish = (accepted) => {
        if (!pendingConfirmation) return;
        pendingConfirmation = null;
        confirmationBox.hidden = true;
        resolve(accepted);
      };
      pendingConfirmation = finish;
      confirmationBox.replaceChildren(
        highUsageConfirmation(warnings, lowerEstimates, issues),
        el('div', { class: 'form-actions' }, [
          el('button', { type: 'button', class: 'btn btn-primary', onclick: () => finish(true) }, 'Подтвердить импорт'),
          el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => finish(false) }, 'Отмена'),
        ]),
      );
      confirmationBox.hidden = false;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    const file = fileInput.files[0];
    const um31 = resourceSelect.value === 'electricity';
    const pulsar = resourceSelect.value === 'water_pulsar';
    if (!file || (um31 && (!averageMonthsInput.value || !Number.isInteger(Number(averageMonthsInput.value))
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
      const input = um31
        ? { buildingId: buildingSelect.value, averageMonths: averageMonthsInput.value, file }
        : { buildingId: buildingSelect.value, file };
      try {
        r = um31 ? await meterReadingsApi.importUM31File(input) : await meterReadingsApi.importPulsarFile(input);
      } catch (err) {
        if (err.status !== 409 || !err.highUsageWarnings?.length) throw err;
        const accepted = await requestHighUsageConfirmation(err.highUsageWarnings, err.lowerReadingEstimates, err.issues);
        if (!accepted) {
          showMessage('Импорт отменён. Данные не изменены.', 'error');
          return;
        }
        const confirmedInput = { ...input, confirmHighUsage: true };
        r = um31 ? await meterReadingsApi.importUM31File(confirmedInput) : await meterReadingsApi.importPulsarFile(confirmedInput);
      }
      const details = um31
        ? ` Рассчитано по среднему: ${r.estimated_readings}; пропущено уже заполненных: ${r.skipped_existing}; без расчёта: ${r.skipped_no_history}; замечаний в истории: ${r.issues?.length || 0}.`
        : (pulsar ? ` Пропусков и предупреждений: ${r.issues?.length || 0}.` : ` Создано новых счётчиков: ${r.meters_created}.`);
      showMessage(`Загружено показаний: ${r.readings}.${details}`, 'success');
      if (um31 || pulsar) {
        const notices = [
          ...(r.issues || []).map((issue) => `${issue.row ? `Строка ${issue.row} · ` : ''}${issue.serial ? `${issue.serial}: ` : ''}${issue.message}`),
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
    confirmationBox,
    el('div', { class: 'field' }, [el('label', { for: 'mi-building' }, 'Дом'), buildingSelect]),
    el('div', { class: 'field' }, [el('label', { for: 'mi-resource' }, 'Ресурс'), resourceSelect]),
    averageMonthsField,
    fileField,
    el('div', { class: 'form-actions' }, [submitButton, cancelButton]),
  ]);

  modal = openModal({
    title: 'Загрузить показания из Excel',
    content: form,
    wide: true,
    onClose: () => pendingConfirmation?.(false),
  });
  return modal;
}
