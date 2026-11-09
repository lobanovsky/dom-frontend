import { el } from '../lib/dom.js';
import { meterReadingsApi } from '../api/resources.js';
import { currentMonth } from '../lib/calculation.js';
import { describeApiError } from '../lib/apiErrors.js';
import { openModal } from './modal.js';
import { createMonthPicker } from './monthPicker.js';
import { saveFile } from './saveFile.js';

export function openMeterExportDialog() {
  const picker = createMonthPicker({ value: currentMonth() });
  const error = el('p', { role: 'alert', class: 'field-error' });
  const submit = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Скачать Excel');
  let busy = false;
  const form = el('form', { class: 'form', onsubmit: async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true; submit.disabled = true; error.textContent = '';
    try {
      saveFile(await meterReadingsApi.exportExcel({ period: picker.value }));
      modal.close();
    } catch (e) { error.textContent = describeApiError(e).message; }
    finally { busy = false; submit.disabled = false; }
  } }, [
    el('p', {}, 'Выберите расчётный месяц.'), picker.element,
    el('p', { class: 'field-help' }, 'В файл попадут переданные показания счётчиков помещений за выбранный месяц, включая ввод сотрудников и импорт. В Excel будут отдельные листы: ХВС, ГВС, Т1, Т2, Т3. Общедомовые приборы не включаются.'),
    error, submit,
  ]);
  const modal = openModal({ title: 'Экспорт показаний', content: form });
}
