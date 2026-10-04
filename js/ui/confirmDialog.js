import { el } from '../lib/dom.js';
import { openModal } from './modal.js';

export function confirmDialog({ title = 'Подтверждение', message, confirmLabel = 'Подтвердить', cancelLabel = 'Отмена', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    let modal;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      modal.close();
      resolve(result);
    };

    const content = el('div', { class: 'confirm-dialog' }, [
      el('p', {}, message),
      el('div', { class: 'form-actions' }, [
        el('button', { type: 'button', class: danger ? 'btn btn-danger' : 'btn btn-primary', onclick: () => finish(true) }, confirmLabel),
        el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => finish(false) }, cancelLabel),
      ]),
    ]);

    modal = openModal({ title, content, onClose: () => finish(false) });
  });
}
