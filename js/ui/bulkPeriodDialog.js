import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { accountServicesApi } from '../api/resources.js';
import { premisesKinds, premisesKindChoices, label } from '../lib/labels.js';
import { formatDate } from '../lib/format.js';
import { describeApiError } from '../lib/apiErrors.js';
import { assignmentPeriod } from '../lib/services.js';
import { buildingLabel } from '../lib/buildings.js';

// Окно «Изменить период»: массово заменить период уже назначенных услуг (например, начать с 1 августа вместо 16 октября).
// Сначала «Показать» (сколько назначений изменится и нет ли пересечений), затем «Изменить».
// При любом изменении полей применение блокируется до нового предпросмотра. onDone(result) вызывается после применения.
export function openBulkPeriodDialog({ service, buildings, onDone }) {
  let modal;
  let busy = false;

  const kinds = service.premises_kinds && service.premises_kinds.length ? service.premises_kinds : premisesKindChoices;

  const buildingSelect = el('select', { id: 'bp-building' }, [el('option', { value: '' }, 'Все дома'), ...buildings.map((b) => el('option', { value: String(b.id) }, buildingLabel(b)))]);
  const kindBoxes = kinds.map((k) => {
    const box = el('input', { type: 'checkbox', value: k });
    box.checked = true;
    return box;
  });
  const currentInput = el('input', { id: 'bp-current', type: 'date' });
  const fromInput = el('input', { id: 'bp-from', type: 'date', required: true });
  const toInput = el('input', { id: 'bp-to', type: 'date' });
  const message = el('div', { role: 'alert' });
  message.hidden = true;
  const result = el('div', { class: 'bulk-result' });
  result.hidden = true;
  const previewButton = el('button', { type: 'submit', class: 'btn' }, 'Показать');
  const applyButton = el('button', { type: 'button', class: 'btn btn-primary', onclick: () => run(true) }, 'Изменить');
  applyButton.disabled = true;
  const cancelButton = el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => modal.close() }, 'Закрыть');

  const invalidate = () => { applyButton.disabled = true; };
  for (const input of [buildingSelect, currentInput, fromInput, toInput, ...kindBoxes]) input.addEventListener('change', invalidate);

  function body() {
    const selected = kindBoxes.filter((b) => b.checked).map((b) => b.value);
    return {
      service_id: service.id,
      building_id: buildingSelect.value ? Number(buildingSelect.value) : null,
      // Все виды услуги отмечены — сужения нет (пусто = все виды).
      premises_kinds: selected.length === kinds.length ? [] : selected,
      current_valid_from: currentInput.value || null,
      valid_from: fromInput.value,
      valid_to: toInput.value || null,
    };
  }

  function showMessage(text, variant) {
    message.className = variant === 'success' ? 'form-success' : 'form-error';
    message.textContent = text;
    message.hidden = false;
  }

  async function run(apply) {
    if (busy) return;
    if (!fromInput.value) {
      showMessage('Укажите новую дату начала', 'error');
      return;
    }
    if (toInput.value && toInput.value < fromInput.value) {
      showMessage('Дата окончания не может быть раньше даты начала', 'error');
      return;
    }
    if (kindBoxes.every((b) => !b.checked)) {
      showMessage('Выберите хотя бы один вид помещений', 'error');
      return;
    }
    busy = true;
    previewButton.disabled = true;
    applyButton.disabled = true;
    message.hidden = true;
    try {
      if (apply) {
        const r = await accountServicesApi.bulkPeriodApply(body());
        result.hidden = true;
        showMessage(`Изменён период назначений: ${r.changed}.`, 'success');
        applyButton.hidden = true;
        previewButton.hidden = true;
        onDone?.(r);
      } else {
        const r = await accountServicesApi.bulkPeriodPreview(body());
        showPreview(r);
        applyButton.disabled = r.to_change === 0 || r.conflicts > 0;
      }
    } catch (err) {
      if (err.status === 0 || err.status >= 500) return; // глобальный тост уже показан клиентом
      showMessage(describeApiError(err).message, 'error');
    } finally {
      busy = false;
      previewButton.disabled = false;
    }
  }

  const rowText = (s) => `${label(premisesKinds, s.premises_kind)} № ${s.premises_number} — сейчас ${assignmentPeriod(s.valid_from, s.valid_to, formatDate)}`;

  function showPreview(r) {
    const changes = r.sample.map((s) => el('li', {}, rowText(s)));
    if (r.to_change > r.sample.length) changes.push(el('li', { class: 'text-muted' }, `…и ещё ${r.to_change - r.sample.length}`));
    const conflicts = r.conflict_sample.map((s) => el('li', {}, rowText(s)));
    if (r.conflicts > r.conflict_sample.length) conflicts.push(el('li', { class: 'text-muted' }, `…и ещё ${r.conflicts - r.conflict_sample.length}`));
    result.replaceChildren(...[
      el('p', {}, `Выбрано назначений: ${r.matched}. Изменятся: ${r.to_change}. Уже с таким периодом: ${r.unchanged}.`),
      changes.length ? el('ul', { class: 'import-errors' }, changes) : null,
      r.conflicts ? el('p', { class: 'form-error' }, `Новый период пересекается с другим назначением этой услуги у назначений: ${r.conflicts}. Пока они есть, изменить нельзя — сузьте выбор или исправьте эти назначения:`) : null,
      conflicts.length ? el('ul', { class: 'import-errors' }, conflicts) : null,
    ].filter(Boolean));
    result.hidden = false;
  }

  const form = el('form', { class: 'entity-form', onsubmit: (e) => { e.preventDefault(); run(false); } }, [
    el('p', { class: 'field-help' }, `Услуга «${service.name}»: у выбранных назначений период заменяется на новый целиком. Сами назначения не пересоздаются.`),
    message,
    el('div', { class: 'field' }, [el('label', { for: 'bp-building' }, 'Дом'), buildingSelect]),
    el('fieldset', { class: 'field' }, [
      el('legend', {}, 'Виды помещений'),
      el('div', { class: 'checkbox-group' }, kinds.map((k, i) => el('label', { class: 'field-checkbox-label' }, [kindBoxes[i], label(premisesKinds, k)]))),
    ]),
    el('div', { class: 'field' }, [el('label', { for: 'bp-current' }, 'Только назначения, начинающиеся с'), currentInput, el('span', { class: 'field-help' }, 'Необязательно. Например, 16.10.2026 — исправить только эту партию. Пусто — все назначения услуги')]),
    el('div', { class: 'field' }, [el('label', { for: 'bp-from' }, 'Новая дата начала'), fromInput]),
    el('div', { class: 'field' }, [el('label', { for: 'bp-to' }, 'Новая дата окончания'), toInput, el('span', { class: 'field-help' }, 'Включительно. Пусто — продолжается')]),
    result,
    el('div', { class: 'form-actions' }, [previewButton, applyButton, cancelButton]),
  ]);

  modal = openModal({ title: 'Изменить период назначений', content: form, wide: true });
  return modal;
}
