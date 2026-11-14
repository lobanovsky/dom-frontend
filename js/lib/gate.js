export const GATE_STATUSES = {
  pending: 'На проверке',
  approved: 'Одобрено',
  rejected: 'Отклонено',
};
export const GATE_ZONES = { courtyard: 'Двор', parking: 'Паркинг' };
export const GATE_RELATIONS = {
  owner: 'Собственник',
  relative: 'Родственник',
  tenant: 'Арендатор',
  guest: 'Гость',
  service: 'Гость',
};
export const gatePropertyLabel = (r) =>
  r.items
    ? r.items.map(gatePropertyLabel).join(', ')
    : `${r.premises_kind === 'parking_space' ? 'Машиноместо' : 'Квартира'} ${r.premises_number}`;
export const gateZoneLabel = (r) => [...new Set((r.items || [r]).map((item) => GATE_ZONES[item.zone]))].join(', ');
export const gateStatusLabel = (value) => GATE_STATUSES[value];

export function groupGateRequests(rows) {
  const groups = new Map();
  for (const row of rows) {
    const id = row.group_id || row.id;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  return [...groups].map(([id, items]) => {
    const root = items.find((r) => r.id === id) || items[0];
    const states = new Set(items.map((r) => r.effective_status));
    const active = items.some((r) => r.active);
    return {
      ...root,
      id,
      items,
      active,
      display_status: active
        ? 'approved'
        : items.every((r) => (r.status || r.effective_status) === 'pending')
          ? 'pending'
          : 'rejected',
      eligible: items.every((r) => r.eligible),
      effective_status: states.size === 1 ? root.effective_status : active ? 'partial' : 'attention',
    };
  });
}

export function gateAccessNote(row) {
  return (
    {
      revoked: 'Доступ отозван.',
      cancelled: 'Заявка отменена заявителем.',
      expired: 'Срок доступа истёк.',
      ineligible: 'Право на объект не подтверждено.',
    }[row.effective_status] || ''
  );
}
