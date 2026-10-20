import { el } from '../lib/dom.js';

let activeModal = null;

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function openModal({ title, content, onClose, wide = false } = {}) {
  if (activeModal) activeModal.close();

  const previouslyFocused = document.activeElement;

  const closeButton = el('button', { type: 'button', class: 'modal-close', 'aria-label': 'Закрыть', onclick: () => close() }, '×');
  const header = el('div', { class: 'modal-header' }, [el('h2', {}, title || ''), closeButton]);
  const body = el('div', { class: 'modal-body' }, content);
  const dialog = el('div', { class: wide ? 'modal-dialog modal-dialog--wide' : 'modal-dialog', role: 'dialog', 'aria-modal': 'true' }, [header, body]);
  const backdrop = el('div', { class: 'modal-backdrop' }, dialog);

  function onKeydown(event) {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = dialog.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onBackdropClick(event) {
    if (event.target === backdrop) close();
  }

  function close() {
    document.removeEventListener('keydown', onKeydown);
    backdrop.removeEventListener('click', onBackdropClick);
    backdrop.remove();
    if (activeModal && activeModal.close === close) activeModal = null;
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    onClose?.();
  }

  document.addEventListener('keydown', onKeydown);
  backdrop.addEventListener('click', onBackdropClick);
  document.body.appendChild(backdrop);

  // Фокус — на первое поле содержимого, а не на крестик в заголовке.
  const firstFocusable = body.querySelector(FOCUSABLE_SELECTOR);
  (firstFocusable || closeButton).focus();

  activeModal = { close };
  return { close, dialog };
}
