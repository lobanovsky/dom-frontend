import { el } from '../lib/dom.js';
import { formatDateTime } from '../lib/format.js';
import { residentAccessStatus } from '../lib/residentAccess.js';

export function residentAccessStatusView(state) {
  const status = residentAccessStatus(state);
  return el('div', { class: 'resident-access-status' }, [
    el('span', { class: `resident-access-badge resident-access-badge--${status.tone}` }, status.title),
    status.detail ? el('small', {}, status.detail) : null,
    state?.last_login_at ? el('small', {}, `Последний вход: ${formatDateTime(state.last_login_at)}`) : null,
  ].filter(Boolean));
}
