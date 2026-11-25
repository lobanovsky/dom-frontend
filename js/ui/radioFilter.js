import { el } from '../lib/dom.js';

let nextRadioGroup = 0;

export function radioFilter({ label, options, value, onChange }) {
  const name = `filter-radio-${++nextRadioGroup}`;
  const inputs = options.map((option) => el('input', {
    type: 'radio', name, value: option.value, checked: option.value === value,
    onchange: (event) => {
      if (event.target.checked) onChange(option.value);
    },
  }));
  const element = el('div', { class: 'field' }, [
    el('div', {}, label),
    el('div', { class: 'gate-kind-selector table-radio-filter', role: 'radiogroup', 'aria-label': label },
      options.map((option, index) => el('label', { class: 'gate-kind-option' }, [
        inputs[index], el('span', {}, option.label),
      ]))),
  ]);
  return {
    element,
    setValue(nextValue) {
      for (const input of inputs) input.checked = input.value === nextValue;
    },
  };
}
