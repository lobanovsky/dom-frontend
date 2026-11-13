export const GATE_STATUSES = {
  pending: 'На проверке',
  approved: 'Одобрено',
  rejected: 'Отклонено',
  revoked: 'Отозвано',
  cancelled: 'Отменено',
  expired: 'Истёк срок',
  ineligible: 'Нет права на объект',
};
export const GATE_ZONES = { courtyard: 'Двор', parking: 'Паркинг' };
export const GATE_RELATIONS = {
  owner: 'Собственник',
  relative: 'Родственник',
  tenant: 'Арендатор',
  guest: 'Гость',
  service: 'Обслуживание / доставка',
};
export const gatePropertyLabel = (r) =>
  `${r.premises_kind === 'parking_space' ? 'Машиноместо' : 'Квартира'} № ${r.premises_number}`;
