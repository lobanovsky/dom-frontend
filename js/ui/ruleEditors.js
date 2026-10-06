import { el } from '../lib/dom.js';
import { listInput } from './listInput.js';
import { entityPicker } from './picker.js';
import { premisesKinds, options } from '../lib/labels.js';
import {
  CONDITION_FIELDS, TEXT_FIELD_NAMES, ACTION_TYPES, opsFor, newCondition, changeField, normalizeConditions, normalizeAction, DEFAULT_ACTION,
} from '../lib/rules.js';

// Редакторы для формы правила (type: 'picker' в ui/form.js: компонент сам рисует ввод и сообщает значение через onChange).

function select(optionsList, value, onChange, attrs = {}) {
  const node = el('select', attrs, optionsList.map((o) => el('option', { value: o.value, selected: String(o.value) === String(value) }, o.label)));
  node.addEventListener('change', () => onChange(node.value));
  return node;
}

const entries = (dict) => Object.entries(dict).map(([value, label]) => ({ value, label }));

// Условия: строки «поле — операция — значения», значения по «или». Пустой список — правило для любого платежа.
export function conditionsEditor({ banks = [] } = {}) {
  const multi = listInput({ placeholder: 'Текст (можно несколько: «или»)', addLabel: '+ ещё значение (или)' });
  return function createConditions({ id, value, onChange }) {
    let items = (Array.isArray(value) ? value : []).map((c) => ({ ...c, values: c.values?.length ? [...c.values] : [''] }));
    const root = el('div', { class: 'rule-conditions', id });

    const emit = () => onChange(normalizeConditions(items));

    function valuesEditor(c, i) {
      if (c.field === 'amount') {
        const number = (idx, placeholder) => {
          const input = el('input', { type: 'number', step: '0.01', placeholder, inputmode: 'decimal', 'aria-label': placeholder });
          input.value = c.values[idx] ?? '';
          input.addEventListener('input', () => { c.values[idx] = input.value; emit(); });
          return input;
        };
        return el('div', { class: 'rule-amount' }, c.op === 'between' ? [number(0, 'от'), number(1, 'до')] : [number(0, 'сумма')]);
      }
      if (c.field === 'bank_account_id') {
        return select([{ value: '', label: 'Выберите счёт' }, ...banks.map((b) => ({ value: String(b.id), label: `${b.number}${b.description ? ` · ${b.description}` : ''}` }))],
          c.values[0] ?? '', (v) => { c.values = [v]; emit(); });
      }
      return multi({ id: `${id}-values-${i}`, value: c.values, onChange: (v) => { c.values = v; emit(); } });
    }

    function row(c, i) {
      const isText = TEXT_FIELD_NAMES.includes(c.field) && c.op !== 'regex';
      const ignore = el('input', { type: 'checkbox', checked: !!c.ignore_spaces });
      ignore.addEventListener('change', () => { c.ignore_spaces = ignore.checked; emit(); });
      return el('div', { class: 'rule-condition' }, [
        el('div', { class: 'rule-condition-head' }, [
          select(entries(CONDITION_FIELDS), c.field, (v) => { items[i] = changeField(c, v); render(); emit(); }, { 'aria-label': 'Поле' }),
          select(entries(opsFor(c.field)), c.op, (v) => { c.op = v; if (c.field === 'amount') c.values = c.values.slice(0, v === 'between' ? 2 : 1); render(); emit(); }, { 'aria-label': 'Операция' }),
          el('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-danger-text', onclick: () => { items.splice(i, 1); render(); emit(); } }, 'Удалить'),
        ]),
        valuesEditor(c, i),
        isText ? el('label', { class: 'field-checkbox-label' }, [ignore, ' Сравнивать без пробелов (для номеров вида «0 0 0 0 5 0 0 1 0 7»)']) : null,
      ]);
    }

    function render() {
      root.replaceChildren(
        ...(items.length === 0 ? [el('div', { class: 'field-help' }, 'Условий нет: правило подходит любому платежу.')] : []),
        ...items.map(row),
        el('button', { type: 'button', class: 'btn btn-sm', onclick: () => { items.push(newCondition()); render(); emit(); } }, '+ Добавить условие'),
      );
    }
    render();
    return root;
  };
}

// Действие правила: тип и параметры выбранного типа.
export function actionEditor({ categories = [] } = {}) {
  const premisesPicker = entityPicker('premises');
  const accountPicker = entityPicker('personal_account');
  return function createAction({ id, value, onChange }) {
    let a = { ...DEFAULT_ACTION, ...(value || {}) };
    const root = el('div', { class: 'rule-action', id });
    const emit = () => onChange(normalizeAction(a));

    const patternField = (help) => [
      el('input', { type: 'text', placeholder: 'Регулярное выражение', value: a.pattern || '', 'aria-label': 'Регулярное выражение', oninput: (e) => { a.pattern = e.target.value; emit(); } }),
      el('div', { class: 'field-help' }, help),
    ];
    const fieldSelect = () => select(entries(Object.fromEntries(TEXT_FIELD_NAMES.map((f) => [f, CONDITION_FIELDS[f]]))), a.field || 'purpose', (v) => { a.field = v; emit(); }, { 'aria-label': 'Откуда брать текст' });
    const ignoreSpaces = () => {
      const box = el('input', { type: 'checkbox', checked: !!a.ignore_spaces });
      box.addEventListener('change', () => { a.ignore_spaces = box.checked; emit(); });
      return el('label', { class: 'field-checkbox-label' }, [box, ' Убрать пробелы из текста перед поиском']);
    };

    function details() {
      switch (a.type) {
        case 'link_by_owner':
          return [el('div', { class: 'field-help' }, 'ФИО плательщика сравнивается с собственниками и плательщиками лицевых счетов (без учёта регистра, «ё» и порядка слов; обрезанное отчество допустимо), для юрлиц по ИНН. Если у человека несколько помещений, номер квартиры или машиноместа берётся из назначения платежа («кв. 107», «м/м 138»). Лицевой счёт выбирается по типу банковского счёта: спецсчёт — капремонт, обычный — ЖКУ.')];
        case 'account_from_text':
          return [fieldSelect(), ...patternField('Выражение с группой захвата в скобках: захваченный номер ищется среди лицевых счетов. Пример для номера из 10 цифр на «0000»: (?:^|\\D)(0000\\d{6})(?:\\D|$)'), ignoreSpaces()];
        case 'link_premises':
          return [premisesPicker({ id: `${id}-premises`, value: a.premises_id ?? null, onChange: (v) => { a.premises_id = v; emit(); } }),
            el('div', { class: 'field-help' }, 'Лицевой счёт выбирается по типу банковского счёта: спецсчёт — капремонт, обычный — ЖКУ.')];
        case 'link_account':
          return [accountPicker({ id: `${id}-account`, value: a.personal_account_id ?? null, onChange: (v) => { a.personal_account_id = v; emit(); } })];
        case 'premises_from_text':
          return [select(options(premisesKinds), a.premises_kind || 'apartment', (v) => { a.premises_kind = v; emit(); }, { 'aria-label': 'Вид помещения' }), fieldSelect(),
            ...patternField('Выражение с группой захвата: номер помещения. Пример для машиномест: м/м\\s*(\\d+)'), ignoreSpaces()];
        case 'set_category':
          return [select([{ value: '', label: 'Выберите категорию' }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))], a.category_id ?? '',
            (v) => { a.category_id = v ? Number(v) : null; emit(); }, { 'aria-label': 'Категория' }),
          el('div', { class: 'field-help' }, 'Для платежей, которые не относятся к лицевому счёту: аренда оборудования, субсидии, возвраты, сводные реестры.')];
        default: return [];
      }
    }

    function render() {
      root.replaceChildren(
        select(entries(ACTION_TYPES), a.type, (v) => { a = { ...a, type: v }; render(); emit(); }, { 'aria-label': 'Действие' }),
        ...details(),
      );
    }
    render();
    emit();
    return root;
  };
}
