import { el } from '../lib/dom.js';

let container = null;

function ensureContainer() {
  if (!container) {
    container = el('div', { class: 'toast-container', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(container);
  }
  return container;
}

function show(message, variant, timeout = 5000) {
  const root = ensureContainer();
  const dismiss = () => node.remove();
  const node = el('div', { class: `toast toast-${variant}`, onclick: dismiss }, message);
  root.appendChild(node);
  setTimeout(dismiss, timeout);
  return dismiss;
}

export const toast = {
  success: (message) => show(message, 'success'),
  error: (message) => show(message, 'error'),
  info: (message) => show(message, 'info'),
};
