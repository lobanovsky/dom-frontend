export const GATE_STATUSES = {
  pending: 'На проверке',
  approved: 'Одобрено',
  revoke_requested: 'Ожидает удаления с устройства',
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
    : `${{ parking_space: 'Машиноместо', commercial: 'Коммерческое помещение' }[r.premises_kind] || 'Квартира'} ${r.premises_number}`;
export const gateZoneLabel = (r) => [...new Set((r.items || [r]).map((item) => GATE_ZONES[item.zone]))].join(', ');
export const gateStatusLabel = (value) => GATE_STATUSES[value];
export const gatePremisesTone = (accesses = []) =>
  accesses.some((access) => access.relation === 'tenant') ? 'tenant' : accesses.length ? 'access' : 'none';
export const gateOwnersFirst = (accesses = []) =>
  [...accesses].sort((a, b) => Number(b.relation === 'owner') - Number(a.relation === 'owner'));

export function formatGatePhoneInput(value) {
  const source = String(value || '').trim();
  let digits = String(value || '').replace(/\D/g, '');
  if (source.startsWith('+7') || (digits.length === 11 && /^[78]/.test(digits))) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  return ['+7', digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean).join(' ');
}

export function bindGatePhoneInput(input) {
  input.value = formatGatePhoneInput(input.value);
  input.setSelectionRange(input.value.length, input.value.length);
  input.addEventListener('input', () => {
    const before = input.value;
    const position = input.selectionStart ?? before.length;
    const digitsBefore = before.slice(0, position).replace(/\D/g, '').length;
    input.value = formatGatePhoneInput(before);
    let cursor = 0;
    let digits = 0;
    while (cursor < input.value.length && digits < digitsBefore) {
      if (/\d/.test(input.value[cursor])) digits++;
      cursor++;
    }
    cursor = Math.max(2, cursor);
    input.setSelectionRange(cursor, cursor);
  });
}

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
        : items.every((r) => (r.status || r.effective_status) === 'revoke_requested')
          ? 'revoke_requested'
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
      revoke_requested: 'Пользователь запросил отзыв доступа.',
      cancelled: 'Заявка отменена заявителем.',
      expired: 'Срок доступа истёк.',
      ineligible: 'Право на объект не подтверждено.',
    }[row.effective_status] || ''
  );
}

export function gateVehicles(row) {
  if (Array.isArray(row?.vehicles)) return row.vehicles;
  return row?.vehicle_plate || row?.vehicle_brand
    ? [{ plate_number: row.vehicle_plate || '', brand: row.vehicle_brand || '', active: true }]
    : [];
}
export const gateVehicleLabel = (car) => [car.plate_number, car.brand].filter(Boolean).join(' · ');
