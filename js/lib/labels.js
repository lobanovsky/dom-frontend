// Русские подписи для перечислений бэкенда. Порядок ключей — порядок в списках выбора.

export const organizationKinds = { uk: 'УК', tsn: 'ТСН', tszh: 'ТСЖ' };

export const buildingKinds = {
  apartment_building: 'Многоквартирный дом',
  parking: 'Паркинг',
  common_premises: 'Помещения общего пользования',
  other: 'Другое',
};

export const premisesKinds = {
  apartment: 'Квартира',
  non_residential: 'Нежилое помещение',
  commercial: 'Коммерческое помещение',
  parking_space: 'Машиноместо',
  storage: 'Кладовая',
};

export const relations = {
  spouse: 'Супруг(а)',
  child: 'Ребёнок',
  parent: 'Родитель',
  relative: 'Родственник',
  tenant: 'Арендатор',
  other: 'Другое',
};

export const accountPurposes = {
  utilities: 'ЖКУ',
  capital_repair: 'Капремонт',
  parking: 'Паркинг',
  other: 'Другое',
};

export const accountStatuses = { active: 'Открыт', closed: 'Закрыт' };

export const ownerKinds = { person: 'Физлицо', legal_entity: 'Юрлицо' };

export function label(dict, value) {
  return dict[value] ?? value ?? '';
}

export function options(dict) {
  return Object.entries(dict).map(([value, text]) => ({ value, label: text }));
}

export const paymentDirections = { incoming: 'Входящие', outgoing: 'Исходящие' };

// Банковский счёт в списках выбора: «40703810…4376 · спецсчёт · описание».
export function bankLabel(bank) {
  const n = String(bank.number || '');
  return [n.length > 8 ? `${n.slice(0, 8)}…${n.slice(-4)}` : n, bank.is_special ? 'спецсчёт' : null, bank.description].filter(Boolean).join(' · ');
}
