import { textField, numberField, dateField, selectField, checkboxField } from '../lib/fields.js';
import {
  options, paymentDirections, bankLabel, organizationKinds, buildingKinds, premisesKinds, relations, accountPurposes, accountStatuses, ownerKinds,
} from '../lib/labels.js';
import { entityPicker } from '../ui/picker.js';
import { listInput } from '../ui/listInput.js';
import { conditionsEditor, actionEditor } from '../ui/ruleEditors.js';
import { MATCH_MODES } from '../lib/rules.js';

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
  { type: 'list', name: 'phones', label: 'Телефоны', help: 'Первый — основной',
    component: listInput({ inputType: 'tel', inputmode: 'tel', placeholder: '+7 900 123-45-67', addLabel: '+ Добавить телефон', autocomplete: 'off' }) },
  { type: 'list', name: 'emails', label: 'Email', help: 'Первый — основной',
    component: listInput({ inputType: 'email', inputmode: 'email', placeholder: 'name@example.com', addLabel: '+ Добавить email', autocomplete: 'off' }) },
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

// --- Платежи ---

export const bankAccountFields = (organizations) => [
  selectField('organization_id', 'Организация', organizations.map((o) => ({ value: String(o.id), label: o.name })), { required: true, numeric: true, placeholder: 'Выберите' }),
  textField('number', 'Номер счёта', { required: true, inputmode: 'numeric', maxLength: 20, help: '20 цифр' }),
  textField('bik', 'БИК', { inputmode: 'numeric', maxLength: 9 }),
  textField('bank_name', 'Банк'),
  checkboxField('is_special', 'Специальный счёт (капремонт)'),
  dateField('valid_from', 'Действует с', { required: true }),
  dateField('valid_to', 'Действует по', { help: 'Пусто — действует сейчас. Счёт активен, пока сегодняшняя дата внутри периода' }),
  textField('description', 'Описание', { full: true }),
];

export const paymentCategoryFields = [
  textField('name', 'Название', { required: true, full: true }),
  selectField('direction', 'Направление', options(paymentDirections), { required: true, placeholder: 'Выберите' }),
];

const bankOptions = (banks) => banks.map((b) => ({ value: String(b.id), label: bankLabel(b) }));
const categoryOptions = (categories) => categories.map((c) => ({ value: String(c.id), label: c.name }));

// Входящий платёж: либо привязка к лицевому счёту, либо категория (поле категории скрывается, когда выбран счёт).
export const incomingPaymentFields = ({ banks, categories }) => (values) => [
  selectField('bank_account_id', 'На какой счёт', bankOptions(banks), { required: true, numeric: true, placeholder: 'Выберите', full: true }),
  dateField('payment_date', 'Дата', { required: true }),
  { type: 'time', name: 'payment_time', label: 'Время', step: 1 },
  numberField('amount', 'Сумма, ₽', { required: true, min: 0.01, step: 0.01, inputmode: 'decimal' }),
  textField('payer_name', 'От кого (имя или название)', { full: true, help: 'Можно не указывать' }),
  textField('payer_inn', 'ИНН плательщика', { inputmode: 'numeric' }),
  textField('payer_account', 'Счёт плательщика', { inputmode: 'numeric' }),
  textField('payer_bik', 'БИК банка плательщика', { inputmode: 'numeric', maxLength: 9 }),
  textField('payer_bank_name', 'Банк плательщика'),
  textField('doc_number', 'Номер документа'),
  textField('operation_type', 'ВО (вид операции)'),
  textField('purpose', 'Назначение платежа', { full: true }),
  { type: 'picker', name: 'personal_account_id', label: 'Лицевой счёт', full: true, component: entityPicker('personal_account'),
    help: 'Например, Иванов заплатил за ЖКУ. Для платежей, которые не относятся к лицевому счёту, оставьте пустым и выберите категорию' },
  { ...selectField('category_id', 'Категория', categoryOptions(categories), { numeric: true, placeholder: 'Без категории' }),
    visible: (v) => !v.personal_account_id },
  textField('comment', 'Комментарий', { full: true }),
];

export const outgoingPaymentFields = ({ banks, categories }) => [
  selectField('bank_account_id', 'С какого счёта', bankOptions(banks), { required: true, numeric: true, placeholder: 'Выберите', full: true }),
  dateField('payment_date', 'Дата', { required: true }),
  numberField('amount', 'Сумма, ₽', { required: true, min: 0.01, step: 0.01, inputmode: 'decimal' }),
  textField('recipient_name', 'Кому (имя или название)', { required: true, full: true }),
  textField('recipient_inn', 'ИНН получателя', { inputmode: 'numeric' }),
  textField('recipient_account', 'Счёт получателя', { inputmode: 'numeric' }),
  textField('recipient_bik', 'БИК банка получателя', { inputmode: 'numeric', maxLength: 9 }),
  textField('recipient_bank_name', 'Банк получателя'),
  textField('doc_number', 'Номер документа'),
  textField('operation_type', 'ВО (вид операции)'),
  textField('purpose', 'Назначение платежа', { full: true }),
  selectField('category_id', 'Категория', categoryOptions(categories), { numeric: true, placeholder: 'Без категории' }),
  textField('comment', 'Комментарий', { full: true }),
];

// Правило определения лицевых счетов: условия и действие — составные поля со своими редакторами.
export const paymentRuleFields = ({ banks, categories, direction = 'incoming' }) => [
  textField('name', 'Название', { required: true, full: true }),
  checkboxField('enabled', 'Правило включено'),
  selectField('match_mode', 'Когда срабатывает', options(MATCH_MODES), { required: true }),
  { type: 'picker', name: 'conditions', label: 'Условия', full: true, component: conditionsEditor({ banks, direction }),
    help: 'Все условия (или любое) должны подойти платежу. Несколько значений у одного условия означают «или».' },
  { type: 'picker', name: 'action', label: 'Действие', full: true, required: true, component: actionEditor({ categories, direction }) },
];
