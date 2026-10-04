import { el } from '../lib/dom.js';
import { listInput } from './listInput.js';
import { personsApi } from '../api/resources.js';
import { describeApiError } from '../lib/apiErrors.js';

let uid = 0;

const phonesInput = listInput({ inputType: 'tel', inputmode: 'tel', placeholder: '+7 900 123-45-67', addLabel: '+ Добавить телефон', autocomplete: 'off' });
const emailsInput = listInput({ inputType: 'email', inputmode: 'email', placeholder: 'name@example.com', addLabel: '+ Добавить email', autocomplete: 'off' });

// Мини-форма «новое физлицо» внутри другой формы (собственник, житель, плательщик).
// Вложенный <form> в HTML недопустим, поэтому здесь обычные поля, а отправка — кнопкой.
// prefill — текст из строки поиска («Иванов Иван Петрович»), раскладывается по полям ФИО.
export function createPersonForm({ prefill = '', onCreated, onCancel }) {
  const n = ++uid;
  const [lastName = '', firstName = '', ...rest] = prefill.trim().split(/\s+/).filter(Boolean);
  const values = { phones: [], emails: [] };
  const errorEls = {};
  const generalError = el('div', { class: 'form-error', role: 'alert' });
  generalError.hidden = true;

  function field(name, labelText, control, { required = false, full = false, help = null } = {}) {
    const errorEl = el('div', { class: 'field-error' });
    errorEl.hidden = true;
    errorEls[name] = errorEl;
    return el('div', { class: full ? 'field field--full' : 'field' }, [
      el('label', { for: `new-person-${name}-${n}` }, required ? [labelText, el('span', { class: 'field-required-mark', 'aria-hidden': 'true' }, ' *')] : labelText),
      control,
      help ? el('div', { class: 'field-help' }, help) : null,
      errorEl,
    ]);
  }

  function textInput(name, type = 'text', initial = '') {
    const input = el('input', { type, id: `new-person-${name}-${n}`, autocomplete: 'off' });
    input.value = initial;
    // Enter не должен отправлять внешнюю форму.
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
    return input;
  }

  const inputs = {
    last_name: textInput('last_name', 'text', lastName),
    first_name: textInput('first_name', 'text', firstName),
    middle_name: textInput('middle_name', 'text', rest.join(' ')),
    birth_date: textInput('birth_date', 'date'),
  };

  const phones = phonesInput({ id: `new-person-phones-${n}`, value: [], onChange: (v) => { values.phones = v; } });
  const emails = emailsInput({ id: `new-person-emails-${n}`, value: [], onChange: (v) => { values.emails = v; } });

  function clearErrors() {
    generalError.hidden = true;
    for (const e of Object.values(errorEls)) {
      e.hidden = true;
      e.textContent = '';
    }
  }

  function showError(name, message) {
    const target = errorEls[name];
    if (target) {
      target.hidden = false;
      target.textContent = message;
    } else {
      generalError.hidden = false;
      generalError.textContent = message;
    }
  }

  const createButton = el('button', { type: 'button', class: 'btn btn-secondary', onclick: create }, 'Создать и выбрать');

  async function create() {
    clearErrors();
    const text = (k) => inputs[k].value.trim();
    let invalid = false;
    for (const name of ['last_name', 'first_name']) {
      if (!text(name)) {
        showError(name, 'Обязательное поле');
        invalid = true;
      }
    }
    if (invalid) return;

    const clean = (list) => list.map((v) => v.trim()).filter(Boolean);
    createButton.disabled = true;
    try {
      onCreated(await personsApi.create({
        last_name: text('last_name'),
        first_name: text('first_name'),
        middle_name: text('middle_name') || null,
        birth_date: text('birth_date') || null,
        phones: clean(values.phones),
        emails: clean(values.emails),
      }));
    } catch (err) {
      const { field: name, message } = describeApiError(err);
      showError(name, message);
    } finally {
      createButton.disabled = false;
    }
  }

  const element = el('div', { class: 'picker-create-form' }, [
    generalError,
    el('div', { class: 'picker-create-fields' }, [
      field('last_name', 'Фамилия', inputs.last_name, { required: true }),
      field('first_name', 'Имя', inputs.first_name, { required: true }),
      field('middle_name', 'Отчество', inputs.middle_name),
      field('birth_date', 'Дата рождения', inputs.birth_date),
      field('phones', 'Телефоны', phones, { full: true, help: 'Первый — основной' }),
      field('emails', 'Email', emails, { full: true, help: 'Первый — основной' }),
    ]),
    el('div', { class: 'form-actions' }, [
      createButton,
      onCancel ? el('button', { type: 'button', class: 'btn btn-ghost', onclick: onCancel }, 'Назад к поиску') : null,
    ]),
  ]);

  return { element, focus: () => (inputs.last_name.value ? inputs.first_name : inputs.last_name).focus() };
}
