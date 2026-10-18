import { textField, numberField, dateField, textareaField, selectField, checkboxField } from '../lib/fields.js';
import {
  options, bankLabel, organizationKinds, buildingKinds, premisesKinds, relations, accountPurposes, accountStatuses, ownerKinds,
  meterResources, meterTariffs, serviceKinds, serviceUnits, serviceCalcMethods,
} from '../lib/labels.js';
import { tariffColumns, resourceUnit, previousReadingText } from '../lib/meters.js';
import { entityPicker } from '../ui/picker.js';
import { listInput } from '../ui/listInput.js';
import { checkboxGroup } from '../ui/checkboxGroup.js';
import { unitShort, isSumMethod } from '../lib/services.js';
import { categoryColorPicker, categoryIconPicker } from '../ui/categoryStyle.js';
import { conditionsEditor, actionEditor } from '../ui/ruleEditors.js';
import { MATCH_MODES } from '../lib/rules.js';
import { ROLES } from '../lib/permissions.js';

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

// --- Счётчики ---

// target — как выбирается привязка счётчика: 'premises' — помещение (поиск), 'building' — дом из списка buildings,
// 'fixed' — привязка задана снаружи (fixed формы: карточка помещения или дома). Нужен watch: ['resource', 'tariffs'].
export const meterFields = ({ target = 'fixed', buildings = [] } = {}) => (values) => {
  const electric = values.resource === 'electricity';
  const tariffs = electric ? Number(values.tariffs) || 1 : 1;
  const initial = (n) => (tariffs > 1 ? `Начальное показание Т${n}` : 'Начальное показание');
  return [
    target === 'premises' ? { type: 'picker', name: 'premises_id', label: 'Помещение', required: true, full: true, component: entityPicker('premises') } : null,
    target === 'building' ? selectField('building_id', 'Дом', buildings.map((b) => ({ value: String(b.id), label: b.address })), { required: true, numeric: true, full: true, placeholder: 'Выберите' }) : null,
    selectField('resource', 'Что измеряет', options(meterResources), { required: true, placeholder: 'Выберите' }),
    { ...selectField('tariffs', 'Тарифность', options(meterTariffs), { required: true, numeric: true }), visible: (v) => v.resource === 'electricity' },
    textField('serial_number', 'Номер счётчика', { required: true }),
    textField('model', 'Модель'),
    dateField('installed_at', 'Введён в эксплуатацию', { required: true }),
    dateField('removed_at', 'Окончание работы', { help: 'Пусто — работает. После этой даты счётчик считается неактивным (замена, снятие). Сам счётчик остаётся в системе' }),
    dateField('verified_at', 'Дата последней поверки'),
    dateField('next_verification_at', 'Дата следующей поверки'),
    numberField('initial_t1', initial(1), { min: 0, step: 0.001, inputmode: 'decimal', help: `Показания при установке (${resourceUnit(values.resource) || 'ед.'}); пусто — 0` }),
    { ...numberField('initial_t2', initial(2), { min: 0, step: 0.001, inputmode: 'decimal' }), visible: () => tariffs >= 2 },
    { ...numberField('initial_t3', initial(3), { min: 0, step: 0.001, inputmode: 'decimal' }), visible: () => tariffs >= 3 },
    { ...numberField('coefficient', 'Коэффициент трансформации', { min: 0.001, step: 0.001, inputmode: 'decimal', help: 'Расход = разность показаний × коэффициент. Обычно 1' }), visible: () => electric },
    textareaField('comment', 'Комментарий', { full: true }),
  ].filter(Boolean);
};

// Показание счётчика: по одному полю на тариф. meter — счётчик из ответа API (число тарифов, прошлое показание для подсказки).
export const meterReadingFields = (meter) => {
  const unit = resourceUnit(meter.resource);
  return [
    dateField('reading_date', 'Дата показаний', { required: true }),
    ...tariffColumns(meter.tariffs).map((c, i) => numberField(c.key, `${c.label}, ${unit}`, {
      required: true, min: 0, step: 0.001, inputmode: 'decimal', help: i === 0 ? previousReadingText(meter) : undefined,
    })),
    textField('comment', 'Комментарий', { full: true }),
  ];
};

// --- Услуги ---

// Услуга организации. services — уже заведённые услуги (кандидаты в состав суммы; бэкенд проверит организацию и единицу).
// tariffs — справочник тарифов; в списке только тарифы той же организации и с той же единицей, что у услуги.
// Нужен watch: ['calc_method', 'meter_resource', 'organization_id', 'unit'] — состав и счётчик показываются только у своих способов расчёта.
export const serviceFields = ({ organizations = [], services = [], tariffs = [], selfId = null } = {}) => (values) => {
  const metered = values.calc_method === 'individual_meter' || values.calc_method === 'common_meter';
  const electric = values.meter_resource === 'electricity';
  const plain = services.filter((s) => !isSumMethod(s.calc_method) && s.id !== selfId);
  return [
    selectField('organization_id', 'Организация', organizations.map((o) => ({ value: String(o.id), label: o.name })), { required: true, numeric: true, placeholder: 'Выберите', full: true }),
    selectField('kind', 'Вид услуги', options(serviceKinds), { required: true, placeholder: 'Выберите' }),
    textField('name', 'Название', { required: true }),
    selectField('calc_method', 'Как считается', options(serviceCalcMethods), { required: true, placeholder: 'Выберите', full: true }),
    { ...selectField('meter_resource', 'Какой счётчик', options(meterResources), { required: true, placeholder: 'Выберите' }), visible: () => metered },
    { ...selectField('meter_tariff', 'Тариф счётчика', [1, 2, 3].map((n) => ({ value: String(n), label: `Т${n}` })), { required: true, numeric: true }), visible: () => metered && electric },
    selectField('unit', 'Единица измерения', options(serviceUnits), { required: true, placeholder: 'Выберите', help: 'При расчёте по площади — м², при «площадь × норматив» — Гкал (цена задаётся за Гкал)' }),
    { ...selectField('tariff_id', 'Тариф', tariffs.filter((t) => String(t.organization_id) === String(values.organization_id) && t.unit === values.unit).map((t) => ({ value: String(t.id), label: t.name })),
      { numeric: true, placeholder: 'Свои цены у услуги', full: true, help: 'Цена берётся из справочника тарифов: так одну цену не нужно вводить в каждой услуге. Показаны тарифы организации с той же единицей измерения. Если выбран тариф, собственных цен у услуги нет' }),
      visible: () => values.calc_method !== 'sum_prices' },
    selectField('account_purpose', 'На какой лицевой счёт', options(accountPurposes), { required: true, placeholder: 'Выберите', help: 'Квитанция выставляется по лицевому счёту: услуга попадёт только в квитанцию счёта этого типа' }),
    { type: 'picker', name: 'premises_kinds', label: 'Для каких помещений', full: true,
      help: 'Ничего не отмечено — для любых помещений. Услугу нельзя назначить счёту помещения другого вида',
      component: checkboxGroup(options(premisesKinds)) },
    textField('receipt_name', 'Название в квитанции', { full: true, help: 'Пусто — как в справочнике. Удобно, когда услуги для квартир и машиномест называются в квитанции одинаково' }),
    { type: 'picker', name: 'component_ids', label: 'Из каких услуг состоит', full: true, visible: () => isSumMethod(values.calc_method),
      help: 'Сумма объёмов: объём услуги равен сумме объёмов выбранных (например, водоотведение = ХВС + ХВС для ГВС), цена — свой тариф. Сумма цен: цена равна сумме цен выбранных, своих тарифов нет. Подходят простые услуги той же организации, с той же единицей и типом счёта',
      component: checkboxGroup(plain.map((s) => ({ value: s.id, label: `${s.name} (${unitShort(s.unit)})` })), { emptyText: 'Сначала заведите простые услуги' }) },
    numberField('position', 'Порядок в квитанции', { step: 1, inputmode: 'numeric', help: 'Меньше — выше. Пусто — 0' }),
    checkboxField('active', 'Услуга оказывается'),
    textareaField('comment', 'Комментарий', { full: true }),
  ];
};

// Назначение услуги лицевому счёту. service — услуга, если она уже известна (карточка услуги: выбирается счёт);
// иначе services — варианты для выбора (карточка счёта). Количество — только у услуг с ручным вводом.
// Нужен watch: ['service_id'].
export const accountServiceFields = ({ service = null, services = [] } = {}) => (values) => {
  const chosen = service || services.find((s) => String(s.id) === String(values.service_id));
  return [
    service
      ? { type: 'picker', name: 'account_id', label: 'Лицевой счёт', required: true, full: true, component: entityPicker('personal_account'),
        help: 'Подходят счета того же типа, что у услуги, в помещениях подходящего вида' }
      : selectField('service_id', 'Услуга', services.map((s) => ({ value: String(s.id), label: `${s.name} (${unitShort(s.unit)})` })), { required: true, numeric: true, placeholder: 'Выберите', full: true }),
    dateField('valid_from', 'Действует с', { required: true }),
    dateField('valid_to', 'Действует по', { help: 'Включительно. Пусто — продолжается. Разовая услуга — период в один месяц, например 01.10.2026 — 31.10.2026' }),
    { ...numberField('quantity', `Количество${chosen && unitShort(chosen.unit) ? `, ${unitShort(chosen.unit)}` : ''}`, { required: true, min: 0.001, step: 0.001, inputmode: 'decimal' }), visible: () => !!chosen && chosen.calc_method === 'manual' },
    textField('comment', 'Комментарий', { full: true }),
  ];
};

// Норматив услуги «площадь × норматив» для дома. Тариф (цена за Гкал) задаётся отдельно, в тарифах услуги.
export const serviceNormFields = (buildings) => [
  selectField('building_id', 'Дом', buildings.map((b) => ({ value: String(b.id), label: b.address })), { required: true, numeric: true, placeholder: 'Выберите', full: true,
    help: 'Подходят дома организации услуги' }),
  numberField('value', 'Норматив, Гкал на м²', { required: true, min: 0.00001, step: 0.00001, inputmode: 'decimal', help: 'Не больше пяти знаков после запятой, например 0,011' }),
  dateField('valid_from', 'Действует с', { required: true }),
  dateField('valid_to', 'Действует по', { help: 'Включительно. Пусто — действует до сих пор. Периоды норматива одного дома не пересекаются' }),
  textField('comment', 'Комментарий', { full: true }),
];

// Тариф справочника: название и единица. Цены тарифа — tariffPriceFields.
export const tariffFields = (organizations) => [
  selectField('organization_id', 'Организация', organizations.map((o) => ({ value: String(o.id), label: o.name })), { required: true, numeric: true, placeholder: 'Выберите', full: true }),
  textField('name', 'Название', { required: true, full: true, help: 'Например, «Электроэнергия Т1» или «ХВС». Организацию и единицу нельзя менять, пока тариф использует хотя бы одна услуга' }),
  selectField('unit', 'Единица измерения', options(serviceUnits), { required: true, placeholder: 'Выберите', help: 'В услугах с этим тарифом должна быть такая же единица' }),
  textField('comment', 'Комментарий', { full: true }),
];

export const tariffPriceFields = (tariff) => [
  numberField('price', `Цена, ₽${unitShort(tariff.unit) ? ` за ${unitShort(tariff.unit)}` : ''}`, { required: true, min: 0, step: 0.0001, inputmode: 'decimal', help: 'Не больше четырёх знаков после запятой' }),
  dateField('valid_from', 'Действует с', { required: true }),
  dateField('valid_to', 'Действует по', { help: 'Включительно. Пусто — действует до сих пор. Периоды цен одного тарифа не пересекаются' }),
  textField('comment', 'Комментарий', { full: true }),
];

export const serviceTariffFields = (service) => [
  numberField('price', `Цена, ₽${unitShort(service.unit) ? ` за ${unitShort(service.unit)}` : ''}`, { required: true, min: 0, step: 0.0001, inputmode: 'decimal', help: 'Не больше четырёх знаков после запятой' }),
  dateField('valid_from', 'Действует с', { required: true }),
  dateField('valid_to', 'Действует по', { help: 'Включительно. Пусто — действует до сих пор. Периоды тарифов одной услуги не пересекаются' }),
  textField('comment', 'Комментарий', { full: true }),
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
  { type: 'list', name: 'registry_codes', label: 'Коды реестров в имени файла', full: true,
    help: 'Для банков, которые не пишут номер счёта в имя файла реестра. У ВТБ файл 040126_VTB_231068_001.txt → код VTB_231068_001 (без даты в начале и без .txt). Кодов может быть несколько: имена файлов у банка меняются (например, ещё 311023_VTB_224416 → VTB_224416)',
    component: listInput({ placeholder: 'VTB_231068_001', addLabel: '+ Добавить код', autocomplete: 'off' }) },
  textField('description', 'Описание', { full: true }),
];

export const paymentCategoryFields = [
  textField('name', 'Название', { required: true, full: true }),
  { type: 'picker', name: 'color', label: 'Цвет', full: true, help: 'Необязательно. Повторный клик снимает выбор', component: categoryColorPicker },
  { type: 'picker', name: 'icon', label: 'Значок', full: true, help: 'Необязательно. Показывается рядом с названием в таблицах платежей', component: categoryIconPicker },
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
  checkboxField('attention', 'Обратить внимание', { full: true, help: 'Платёж будет выделен в списке. Например, оплата капремонта пришла на обычный счёт. Нужен комментарий — что именно не так' }),
  textField('comment', 'Комментарий', { full: true, required: !!values.attention }),
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

// --- Пользователи ---

const passwordField = (opts) => ({ type: 'password', name: 'password', autocomplete: 'new-password', minLength: 8, maxLength: 72, ...opts });

export const userCreateFields = [
  textField('username', 'Логин', { required: true, full: true, minLength: 3, maxLength: 50, autocomplete: 'off' }),
  selectField('role', 'Роль', options(ROLES), { required: true, full: true, help: 'Просмотр: видит все разделы и скачивает Excel и файлы, но ничего не меняет. Администратор: полный доступ, управляет пользователями' }),
  passwordField({ label: 'Пароль', required: true, full: true, help: 'Не короче 8 символов. Передайте его пользователю: сменить пароль можно в шапке' }),
];

// Логин не меняется (поле только для показа и в запрос не уходит).
export const userEditFields = [
  textField('username', 'Логин', { virtual: true, disabled: true, full: true }),
  selectField('role', 'Роль', options(ROLES), { required: true, full: true }),
  checkboxField('active', 'Может входить в систему', { full: true, help: 'Если снять, пользователь сразу потеряет доступ, даже в уже открытом окне' }),
  passwordField({ label: 'Новый пароль', full: true, help: 'Оставьте пустым, чтобы не менять. Если задать, все входы этого пользователя завершатся' }),
];
