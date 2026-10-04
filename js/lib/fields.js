// Тонкие конструкторы field-def для ui/form.js — просто чтобы страницы не
// повторяли форму объекта литералами.

export function textField(name, label, opts = {}) {
  return { type: 'text', name, label, ...opts };
}

export function numberField(name, label, opts = {}) {
  return { type: 'number', name, label, ...opts };
}

export function dateField(name, label, opts = {}) {
  return { type: 'date', name, label, ...opts };
}

export function textareaField(name, label, opts = {}) {
  return { type: 'textarea', name, label, ...opts };
}

export function selectField(name, label, options, opts = {}) {
  return { type: 'select', name, label, options, ...opts };
}

export function checkboxField(name, label, opts = {}) {
  return { type: 'checkbox', name, label, ...opts };
}
