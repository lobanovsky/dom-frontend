// Даёт страницам вызывать программную навигацию, не импортируя app.js
// (который импортирует сами страницы — циклический импорт).
let navigateFn = null;

export function setNavigate(fn) {
  navigateFn = fn;
}

export function goTo(path, opts) {
  navigateFn?.(path, opts);
}
