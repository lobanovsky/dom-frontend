import { metersApi } from '../api/resources.js';
import { buildingLabel } from '../lib/buildings.js';
import { describeApiError } from '../lib/apiErrors.js';
import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { saveFile } from './saveFile.js';

export function openElectricityPaperFormDialog(buildings) {
  const select = el('select', { required: true }, buildings.map((building) =>
    el('option', { value: String(building.id) }, buildingLabel(building))));
  const error = el('p', { role: 'alert', class: 'field-error' });
  const submit = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Скачать Excel');
  let busy = false;
  let modal;
  const form = el('form', { class: 'form', onsubmit: async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    submit.disabled = true;
    error.textContent = '';
    try {
      saveFile(await metersApi.exportElectricityPaperForm(select.value));
      modal.close();
    } catch (err) {
      error.textContent = describeApiError(err).message;
    } finally {
      busy = false;
      submit.disabled = false;
    }
  } }, [
    el('div', { class: 'field' }, [el('label', {}, 'Дом'), select]),
    el('p', { class: 'field-help' }, 'В бланк попадут действующие электросчётчики квартир. Последние показания будут заполнены, новые останутся пустыми для записи на бумаге.'),
    error,
    el('div', { class: 'form-actions' }, submit),
  ]);
  modal = openModal({ title: 'Бланк показаний для техника', content: form });
}
