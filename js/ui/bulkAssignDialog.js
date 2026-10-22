import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { accountServicesApi } from '../api/resources.js';
import { accountPurposes, premisesKinds, premisesKindChoices, label } from '../lib/labels.js';
import { todayIso } from '../lib/format.js';
import { describeApiError } from '../lib/apiErrors.js';
import { unitShort } from '../lib/services.js';
import { buildingLabel } from '../lib/buildings.js';

// Окно «Назначить счетам»: массовое назначение услуги подходящим лицевым счетам.
// Сначала «Показать» (предпросмотр: сколько счетов получит услугу, сколько уже имеют), затем «Назначить».
// При любом изменении полей назначение блокируется до нового предпросмотра. onDone(result) вызывается после назначения.
export function openBulkAssignDialog({ service, buildings, onDone }) {
  let modal;
  let busy = false;
  let previewed = false;

  const kinds = service.premises_kinds && service.premises_kinds.length ? service.premises_kinds : premisesKindChoices;
  const manual = service.calc_method === 'manual';

  const buildingSelect = el('select', { id: 'ba-building' }, [el('option', { value: '' }, 'Все дома'), ...buildings.map((b) => el('option', { value: String(b.id) }, buildingLabel(b)))]);
  const kindBoxes = kinds.map((k) => {
    const box = el('input', { type: 'checkbox', value: k });
    box.checked = true;
    return box;
  });
  const fromInput = el('input', { id: 'ba-from', type: 'date', required: true });
  fromInput.value = todayIso();
  const toInput = el('input', { id: 'ba-to', type: 'date' });
  const quantityInput = el('input', { id: 'ba-qty', type: 'number', min: '0.001', step: '0.001', inputmode: 'decimal' });
  const message = el('div', { role: 'alert' });
  message.hidden = true;
  const result = el('div', { class: 'bulk-result' });
  result.hidden = true;
  const previewButton = el('button', { type: 'submit', class: 'btn' }, 'Показать');
  const applyButton = el('button', { type: 'button', class: 'btn btn-primary', onclick: () => run(true) }, 'Назначить');
  applyButton.disabled = true;
  const cancelButton = el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => modal.close() }, 'Закрыть');

  const invalidate = () => { previewed = false; applyButton.disabled = true; };
  for (const input of [buildingSelect, fromInput, toInput, quantityInput, ...kindBoxes]) input.addEventListener('change', invalidate);

  function body() {
    const selected = kindBoxes.filter((b) => b.checked).map((b) => b.value);
    return {
      service_id: service.id,
      valid_from: fromInput.value,
      valid_to: toInput.value || null,
      quantity: manual && quantityInput.value ? Number(quantityInput.value) : null,
      building_id: buildingSelect.value ? Number(buildingSelect.value) : null,
      // Все виды услуги отмечены — сужения нет (пусто = все виды услуги).
      premises_kinds: selected.length === kinds.length ? [] : selected,
    };
  }

  function showMessage(text, variant) {
    message.className = variant === 'success' ? 'form-success' : 'form-error';
    message.textContent = text;
    message.hidden = false;
  }

  async function run(apply) {
    if (busy) return;
    if (!fromInput.value || (manual && !quantityInput.value)) {
      showMessage(manual && fromInput.value ? 'Укажите количество' : 'Укажите дату начала', 'error');
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
        const r = await accountServicesApi.bulkApply(body());
        result.hidden = true;
        showMessage(`Назначено счетам: ${r.created}.`, 'success');
        previewed = false;
        applyButton.hidden = true;
        previewButton.hidden = true;
        onDone?.(r);
      } else {
        const r = await accountServicesApi.bulkPreview(body());
        showPreview(r);
        previewed = true;
        applyButton.disabled = r.to_assign === 0;
      }
    } catch (err) {
      if (err.status === 0 || err.status >= 500) return; // глобальный тост уже показан клиентом
      showMessage(describeApiError(err).message, 'error');
      applyButton.disabled = !previewed;
    } finally {
      busy = false;
      previewButton.disabled = false;
    }
  }

  function showPreview(r) {
    const rows = r.sample.map((s) => el('li', {}, `${label(premisesKinds, s.premises_kind)} № ${s.premises_number} — счёт ${s.account_number}`));
    if (r.to_assign > r.sample.length) rows.push(el('li', { class: 'text-muted' }, `…и ещё ${r.to_assign - r.sample.length}`));
    result.replaceChildren(...[
      el('p', {}, `Подходящих счетов: ${r.candidates}. Получат услугу: ${r.to_assign}. Уже назначена на этот период: ${r.skipped_existing}.`),
      rows.length ? el('ul', { class: 'import-errors' }, rows) : null,
    ].filter(Boolean));
    result.hidden = false;
  }

  const form = el('form', { class: 'entity-form', onsubmit: (e) => { e.preventDefault(); run(false); } }, [
    el('p', { class: 'field-help' }, [
      `Услуга «${service.name}» назначается действующим лицевым счетам типа «${label(accountPurposes, service.account_purpose)}» `,
      'в помещениях подходящего вида. Счетам, у которых она уже назначена на пересекающийся период, повторно не назначается.',
    ]),
    message,
    el('div', { class: 'field' }, [el('label', { for: 'ba-building' }, 'Дом'), buildingSelect]),
    el('fieldset', { class: 'field' }, [
      el('legend', {}, 'Виды помещений'),
      el('div', { class: 'checkbox-group' }, kinds.map((k, i) => el('label', { class: 'field-checkbox-label' }, [kindBoxes[i], label(premisesKinds, k)]))),
    ]),
    el('div', { class: 'field' }, [el('label', { for: 'ba-from' }, 'Действует с'), fromInput]),
    el('div', { class: 'field' }, [el('label', { for: 'ba-to' }, 'Действует по'), toInput, el('span', { class: 'field-help' }, 'Включительно. Пусто — продолжается. Разовая услуга — период в один месяц')]),
    manual ? el('div', { class: 'field' }, [el('label', { for: 'ba-qty' }, `Количество, ${unitShort(service.unit)}`), quantityInput]) : null,
    result,
    el('div', { class: 'form-actions' }, [previewButton, applyButton, cancelButton]),
  ]);

  modal = openModal({ title: 'Назначить услугу счетам', content: form, wide: true });
  return modal;
}
