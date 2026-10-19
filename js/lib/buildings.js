// Как показывать дом: короткое название, если задано, иначе адрес. Покрыто тестами.

// Дом из справочника: {name, address}.
export const buildingLabel = (building) => (building && (building.name || building.address)) || '';

// Дом внутри другой записи (счётчик, норматив, назначение): поля building_name и building_address.
export const buildingLabelOf = (item) => (item && (item.building_name || item.building_address)) || '';
