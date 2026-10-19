import { el } from '../lib/dom.js';
import { monthShortName, shiftYear } from '../lib/calculation.js';

// Выбор месяца без ввода с клавиатуры: стрелки меняют год, 12 кнопок — месяцы. Значение — «YYYY-MM».
// onChange(value) вызывается при выборе месяца. Возвращает {element, get value(), set value(v)}.
export function createMonthPicker({ value, onChange }) {
  let current = value;
  let year = Number(String(value).slice(0, 4));

  const yearLabel = el('strong', { class: 'month-picker-year', 'aria-live': 'polite' });
  const buttons = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return el('button', { type: 'button', class: 'btn btn-sm month-picker-month', onclick: () => select(month) }, monthShortName(month));
  });
  const prev = el('button', { type: 'button', class: 'btn btn-sm', 'aria-label': 'Предыдущий год', onclick: () => { year = shiftYear(year, -1); render(); } }, '‹');
  const next = el('button', { type: 'button', class: 'btn btn-sm', 'aria-label': 'Следующий год', onclick: () => { year = shiftYear(year, 1); render(); } }, '›');

  function render() {
    yearLabel.textContent = String(year);
    const [cy, cm] = current.split('-').map(Number);
    buttons.forEach((b, i) => {
      const on = cy === year && cm === i + 1;
      b.classList.toggle('btn-primary', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function select(month) {
    current = `${year}-${String(month).padStart(2, '0')}`;
    render();
    onChange?.(current);
  }

  const element = el('div', { class: 'month-picker', role: 'group', 'aria-label': 'Месяц' }, [
    el('div', { class: 'month-picker-year-row' }, [prev, yearLabel, next]),
    el('div', { class: 'month-picker-grid' }, buttons),
  ]);
  render();

  return {
    element,
    get value() { return current; },
    set value(v) { current = v; year = Number(v.slice(0, 4)); render(); },
  };
}
