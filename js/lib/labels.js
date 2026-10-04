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
