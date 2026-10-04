import { textField, numberField, dateField, selectField, checkboxField } from '../lib/fields.js';
import {
  options, organizationKinds, buildingKinds, premisesKinds, relations, accountPurposes, accountStatuses, ownerKinds,
} from '../lib/labels.js';
import { entityPicker } from '../ui/picker.js';

// Описание полей форм для каждой сущности. Имена совпадают с JSON-полями API.

export const organizationFields = [
  selectField('kind', 'Тип', options(organizationKinds), { required: true, placeholder: 'Выберите' }),
  textField('name', 'Название', { required: true }),
  textField('inn', 'ИНН', { inputmode: 'numeric' }),
  textField('kpp', 'КПП', { inputmode: 'numeric' }),
  textField('ogrn', 'ОГРН', { inputmode: 'numeric' }),
];

export const legalEntityFields = [
  textField('name', 'Название', { required: true, full: true }),
  textField('inn', 'ИНН', { required: true, inputmode: 'numeric' }),
  textField('kpp', 'КПП', { inputmode: 'numeric' }),
  textField('ogrn', 'ОГРН', { inputmode: 'numeric' }),
];

export const personFields = [
  textField('last_name', 'Фамилия', { required: true }),
  textField('first_name', 'Имя', { required: true }),
  textField('middle_name', 'Отчество'),
  dateField('birth_date', 'Дата рождения'),
  textField('phone', 'Телефон', { type: 'tel', inputmode: 'tel' }),
  textField('email', 'Email', { type: 'email' }),
];

export function buildingFields(organizations) {
  return [
    selectField('organization_id', 'Организация', organizations.map((o) => ({ value: String(o.id), label: o.name })), { required: true, numeric: true, placeholder: 'Выберите' }),
    selectField('kind', 'Тип', options(buildingKinds), { required: true, placeholder: 'Выберите' }),
    textField('address', 'Адрес', { required: true, full: true }),
    textField('cadastral_number', 'Кадастровый номер'),
    numberField('year_built', 'Год постройки', { min: 1700, step: 1, inputmode: 'numeric' }),
    numberField('floors', 'Этажей', { min: 1, step: 1, inputmode: 'numeric' }),
    numberField('entrances', 'Подъездов', { min: 1, step: 1, inputmode: 'numeric' }),
    numberField('total_area', 'Общая площадь, м²', { min: 0, step: 0.01, inputmode: 'decimal' }),
  ];
}

export const premisesFields = [
  selectField('kind', 'Вид', options(premisesKinds), { required: true, placeholder: 'Выберите' }),
  textField('number', 'Номер', { required: true }),
  numberField('entrance', 'Подъезд', { step: 1, inputmode: 'numeric' }),
  numberField('floor', 'Этаж', { step: 1, inputmode: 'numeric' }),
  numberField('total_area', 'Общая площадь, м²', { min: 0, step: 0.01, inputmode: 'decimal' }),
  numberField('living_area', 'Жилая площадь, м²', { min: 0, step: 0.01, inputmode: 'decimal' }),
  numberField('rooms', 'Комнат', { min: 1, step: 1, inputmode: 'numeric' }),
  textField('cadastral_number', 'Кадастровый номер'),
];

// Владелец — физлицо или юрлицо: переключатель owner_kind не уходит в API,
// он только решает, какое из двух полей показать.
function ownerFields(values, { allowCreatePerson = true } = {}) {
  return [
    selectField('owner_kind', 'Кто', options(ownerKinds), { required: true, virtual: true }),
    { type: 'picker', name: 'person_id', label: 'Физлицо', required: true, full: true,
      component: entityPicker('person', { allowCreate: allowCreatePerson }), visible: (v) => v.owner_kind === 'person' },
    { type: 'picker', name: 'legal_entity_id', label: 'Юрлицо', required: true, full: true,
      component: entityPicker('legal_entity'), visible: (v) => v.owner_kind === 'legal_entity' },
  ];
}

export function ownerKindOf(entity) {
  return entity && entity.legal_entity_id ? 'legal_entity' : 'person';
}

export const ownershipFields = (values) => [
  ...ownerFields(values),
  numberField('share_num', 'Доля: числитель', { required: true, min: 1, step: 1, inputmode: 'numeric' }),
  numberField('share_den', 'Доля: знаменатель', { required: true, min: 1, step: 1, inputmode: 'numeric' }),
  dateField('valid_from', 'Собственник с', { required: true }),
  dateField('valid_to', 'Собственник по', { help: 'Пусто — владеет сейчас' }),
  textField('basis', 'Основание', { full: true, placeholder: 'Например: выписка ЕГРН от 01.02.2024' }),
];

export const residencyFields = [
  { type: 'picker', name: 'person_id', label: 'Житель', required: true, full: true, component: entityPicker('person', { allowCreate: true }) },
  selectField('relation', 'Кем приходится собственнику', options(relations), { required: true }),
  { type: 'picker', name: 'related_owner_id', label: 'Собственник (необязательно)', full: true, component: entityPicker('person') },
  checkboxField('registered', 'Зарегистрирован (прописан)'),
  dateField('valid_from', 'Проживает с', { required: true }),
  dateField('valid_to', 'Проживает по', { help: 'Пусто — проживает сейчас' }),
];

export const accountFields = [
  textField('number', 'Номер лицевого счёта', { required: true }),
  selectField('purpose', 'Назначение', options(accountPurposes), { required: true }),
  selectField('status', 'Статус', options(accountStatuses), { required: true }),
  dateField('opened_at', 'Открыт', { required: true }),
  dateField('closed_at', 'Закрыт'),
];

export const accountHolderFields = (values) => [
  ...ownerFields(values),
  dateField('valid_from', 'Плательщик с', { required: true }),
  dateField('valid_to', 'Плательщик по', { help: 'Пусто — платит сейчас' }),
];
