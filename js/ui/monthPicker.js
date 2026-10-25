import { el } from '../lib/dom.js';
import { currentMonth, monthShortName, shiftYear } from '../lib/calculation.js';

// Выбор месяца без ввода с клавиатуры: стрелки меняют год, 12 кнопок — месяцы. Значение — «YYYY-MM».
// Пустое value ('') — месяц не выбран (кнопки не подсвечены), год показывается текущий.
// onChange(value) вызывается при выборе месяца. Возвращает {element, get value(), set value(v)}.
export function createMonthPicker({ value, onChange }) {
  let current = value;
  let year = Number(String(value || currentMonth()).slice(0, 4));

  const yearLabel = el('strong', { class: 'month-picker-year', 'aria-live': 'polite' });
  const buttons = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return el('button', { type: 'button', class: 'btn btn-sm month-picker-month', onclick: () => select(month) }, monthShortName(month));
  });
  const prev = el('button', { type: 'button', class: 'btn btn-sm', 'aria-label': 'Предыдущий год', onclick: () => { year = shiftYear(year, -1); render(); } }, '‹');
  const next = el('button', { type: 'button', class: 'btn btn-sm', 'aria-label': 'Следующий год', onclick: () => { year = shiftYear(year, 1); render(); } }, '›');

  function render() {
    yearLabel.textContent = String(year);
    const [cy, cm] = current ? current.split('-').map(Number) : [0, 0];
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
    set value(v) { current = v; year = Number((v || currentMonth()).slice(0, 4)); render(); },
  };
}

// Компонент для поля формы (type: 'picker'): месяц кнопками, значение — первое число месяца «YYYY-MM-01».
// Месяц выбран всегда. Если задан followDate (имя поля с датой в той же форме), то у новой записи он сам подставляется
// по этой дате, пока месяц не выбрали вручную; у записи, где месяц уже сохранён, остаётся сохранённый.
export function monthField({ followDate } = {}) {
  return ({ value, onChange }) => {
    const saved = value ? String(value).slice(0, 7) : '';
    let touched = !!saved;
    const emit = (m) => onChange(`${m}-01`);
    const picker = createMonthPicker({ value: saved || currentMonth(), onChange: (m) => { touched = true; emit(m); } });
    if (!saved) emit(picker.value);
    if (followDate) {
      // Поле даты есть в форме только после вставки компонента в страницу, поэтому ищем его позже.
      setTimeout(() => {
        const form = picker.element.closest('form');
        const input = form?.querySelector(`[name="${followDate}"]`);
        if (!input) return;
        const follow = () => {
          if (touched || !/^\d{4}-\d{2}/.test(input.value)) return;
          picker.value = input.value.slice(0, 7);
          emit(picker.value);
        };
        input.addEventListener('input', follow);
        input.addEventListener('change', follow);
      }, 0);
    }
    return picker.element;
  };
}
