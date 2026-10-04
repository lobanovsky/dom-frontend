import { el } from '../lib/dom.js';
import { validateFieldDef } from '../lib/validate.js';

function labelContent(def) {
  if (!def.required) return def.label;
  return [def.label, el('span', { class: 'field-required-mark', 'aria-hidden': 'true' }, ' *')];
}

// Строит форму по описанию полей (см. lib/fields.js). `fields` может быть
// массивом или функцией от текущих значений — второе нужно, когда набор
// полей зависит от значения другого поля; в этом случае имя поля-триггера
// нужно перечислить в `watch`.
export function createForm({ fields, initialValues = {}, submitLabel = 'Сохранить', cancelLabel = 'Отмена', onSubmit, onCancel, watch = [] }) {
  let values = { ...initialValues };
  let fieldDefs = resolveFields(fields, values);
  let submitting = false;

  const generalError = el('div', { class: 'form-error', role: 'alert' });
  generalError.hidden = true;

  const fieldsContainer = el('div', { class: 'form-fields' });

  const submitButton = el('button', { type: 'submit', class: 'btn btn-primary' }, submitLabel);
  const actions = [submitButton];
  if (onCancel) {
    actions.push(el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => onCancel() }, cancelLabel));
  }

  const form = el('form', { class: 'entity-form', onsubmit: handleSubmit }, [
    generalError,
    fieldsContainer,
    el('div', { class: 'form-actions' }, actions),
  ]);

  function resolveFields(source, currentValues) {
    return typeof source === 'function' ? source(currentValues) : source;
  }

  function visibleFields() {
    return fieldDefs.filter((def) => !def.visible || def.visible(values));
  }

  function renderFields() {
    fieldsContainer.replaceChildren(...visibleFields().map(renderField));
  }

  function renderField(def) {
    const inputId = `field-${def.name}`;
    const errorEl = el('div', { class: 'field-error' });
    errorEl.hidden = true;

    let input;
    if (def.type === 'select') {
      input = el(
        'select',
        { id: inputId, name: def.name, required: !!def.required, disabled: !!def.disabled },
        [
          def.placeholder ? el('option', { value: '' }, def.placeholder) : null,
          ...(def.options || []).map((opt) =>
            el('option', { value: opt.value, selected: String(values[def.name] ?? '') === String(opt.value) }, opt.label),
          ),
        ],
      );
      input.addEventListener('change', () => setValue(def.name, input.value));
    } else if (def.type === 'checkbox') {
      input = el('input', { type: 'checkbox', id: inputId, name: def.name, checked: !!values[def.name] });
      input.addEventListener('change', () => setValue(def.name, input.checked));
    } else if (def.type === 'picker' || def.type === 'list') {
      // Поле со своим компонентом (поиск физлица/юрлица, список телефонов):
      // компонент сам рисует ввод и сообщает значение через onChange.
      input = def.component({ id: inputId, value: values[def.name], onChange: (value) => setValue(def.name, value) });
    } else if (def.type === 'textarea') {
      input = el('textarea', { id: inputId, name: def.name, required: !!def.required, rows: def.rows || 3, maxlength: def.maxLength });
      input.value = values[def.name] ?? '';
      input.addEventListener('input', () => setValue(def.name, input.value));
    } else {
      input = el('input', {
        type: def.type || 'text',
        id: inputId,
        name: def.name,
        required: !!def.required,
        placeholder: def.placeholder,
        disabled: !!def.disabled,
        min: def.min,
        step: def.step,
        inputmode: def.inputmode,
        maxlength: def.maxLength,
        minlength: def.minLength,
        autocomplete: def.autocomplete,
      });
      input.value = values[def.name] ?? '';
      input.addEventListener('input', () => setValue(def.name, input.value));
    }

    const wrapper = el('div', { class: def.full ? 'field field--full' : 'field' }, [
      def.type === 'checkbox'
        ? el('label', { class: 'field-checkbox-label' }, [input, ` ${def.label}`])
        : [el('label', { for: inputId }, labelContent(def)), input],
      def.help ? el('div', { class: 'field-help' }, def.help) : null,
      errorEl,
    ]);
    wrapper.dataset.fieldName = def.name;

    return wrapper;
  }

  function setValue(name, value) {
    values = { ...values, [name]: value };
    if (watch.includes(name) && typeof fields === 'function') {
      fieldDefs = resolveFields(fields, values);
      renderFields();
    }
  }

  function clearErrors() {
    generalError.hidden = true;
    generalError.textContent = '';
    for (const wrapper of fieldsContainer.querySelectorAll('[data-field-name]')) {
      const err = wrapper.querySelector('.field-error');
      if (err) {
        err.hidden = true;
        err.textContent = '';
      }
    }
  }

  function setFieldErrors(fieldErrors = {}) {
    for (const [name, message] of Object.entries(fieldErrors)) {
      const wrapper = fieldsContainer.querySelector(`[data-field-name="${name}"]`);
      if (wrapper) {
        const err = wrapper.querySelector('.field-error');
        err.hidden = false;
        err.textContent = message;
      } else {
        setGeneralError(message);
      }
    }
  }

  function setGeneralError(message) {
    generalError.hidden = false;
    generalError.textContent = message;
  }

  function setBusy(busy) {
    submitButton.disabled = busy;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    clearErrors();

    const clientErrors = {};
    for (const def of visibleFields()) {
      const message = validateFieldDef(def, values[def.name]);
      if (message) clientErrors[def.name] = message;
    }
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    submitting = true;
    setBusy(true);
    try {
      await onSubmit({ ...values });
    } finally {
      submitting = false;
      setBusy(false);
    }
  }

  function setValues(newValues) {
    values = { ...newValues };
    fieldDefs = resolveFields(fields, values);
    renderFields();
  }

  renderFields();

  return { element: form, setFieldErrors, setGeneralError, setValues, setBusy, getValues: () => ({ ...values }) };
}
