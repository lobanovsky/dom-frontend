import { el } from '../lib/dom.js';
import { openModal } from './modal.js';
import { createForm } from './form.js';
import { toast } from './toast.js';
import { toPayload, toFormValues } from '../lib/payload.js';
import { applyFormApiError } from '../lib/apiErrors.js';

// Модальная форма создания/редактирования записи.
// fields — массив или функция от значений (тогда watch — имена полей-триггеров).
// fixed — значения, которые не редактируются, но уходят в тело (например premises_id).
// save(body) — вызов API; после успеха форма закрывается и вызывается onSaved(result).
export function openEntityForm({ title, fields, watch = [], entity, initialValues = {}, fixed = {}, save, onSaved, successMessage = 'Сохранено' }) {
  const resolve = (values) => (typeof fields === 'function' ? fields(values) : fields);
  const initial = { ...toFormValues(resolve({ ...initialValues, ...(entity || {}) }), entity || {}), ...initialValues };

  let modal;
  const form = createForm({
    fields,
    watch,
    initialValues: initial,
    submitLabel: entity ? 'Сохранить' : 'Добавить',
    onCancel: () => modal.close(),
    onSubmit: async (values) => {
      try {
        const result = await save(toPayload(resolve(values), values, fixed));
        modal.close();
        toast.success(successMessage);
        onSaved?.(result);
      } catch (err) {
        applyFormApiError(form, err);
      }
    },
  });

  modal = openModal({ title, content: el('div', { class: 'entity-form-wrap' }, form.element), wide: true });
  return modal;
}
