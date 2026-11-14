import { el } from '../lib/dom.js';
import { toast } from './toast.js';

async function writeClipboard(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Попробуем совместимый способ ниже, если Clipboard API запрещён браузером.
    }
  }

  const input = el('textarea', { readonly: true, tabindex: '-1', 'aria-hidden': 'true' });
  input.value = value;
  input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.append(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Clipboard copy failed');
}

export function copyPhoneCell(phone, formatPhone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const button = el('button', {
    type: 'button',
    class: 'gate-copy-phone',
    title: 'Копировать телефон',
    'aria-label': `Копировать телефон ${formatPhone(phone)}`,
    onclick: async () => {
      try {
        await writeClipboard(digits);
        toast.success('Номер скопирован');
      } catch {
        toast.error('Не удалось скопировать номер');
      }
    },
  }, el('svg', { viewBox: '0 0 24 24', width: '16', height: '16', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'aria-hidden': 'true' }, [
    el('rect', { x: '8', y: '8', width: '12', height: '13', rx: '2' }),
    el('path', { d: 'M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2' }),
  ]));

  return el('span', { class: 'gate-phone-cell' }, [formatPhone(phone), button]);
}
