import { ApiError } from '../api/client.js';

// Бэкенд отвечает {"error": "..."} по-английски: либо «поле: причина» (валидация,
// 422), либо фиксированная фраза (дубликат, связанная запись, сумма долей).
// Здесь — перевод на русский и разбор на поле и текст для формы.

const REASONS = [
  [/^is required$/, 'Обязательное поле'],
  [/^must be positive$/, 'Должно быть больше нуля'],
  [/^must be one of/, 'Недопустимое значение'],
  [/^must not be before valid_from$/, 'Окончание раньше начала'],
  [/^must not be before opened_at$/, 'Дата закрытия раньше даты открытия'],
  [/^must not exceed total_area$/, 'Больше общей площади'],
  [/^must be between (\d+) and (\d+)$/, (m) => `Должно быть от ${m[1]} до ${m[2]}`],
  [/^exactly one of person_id and legal_entity_id must be set$/, 'Укажите физлицо или юрлицо'],
  [/^share_num and share_den must be positive$/, 'Доля должна быть больше нуля'],
  [/^share must not exceed 1$/, 'Доля не может быть больше 1'],
  [/^"(.*)": must contain at least 5 digits$/, (m) => `«${m[1]}»: в номере должно быть не меньше 5 цифр`],
  [/^"(.*)": is not a valid email$/, (m) => `«${m[1]}»: некорректный адрес`],
  [/^must contain at most (\d+) items$/, (m) => `Не больше ${m[1]} значений`],
  [/^item is too long/, 'Слишком длинное значение'],
];

// Понятные сообщения для уникальных ограничений БД (имя ограничения из миграции).
const CONFLICTS = {
  premises_building_id_kind_number_key: 'Помещение с таким видом и номером уже есть в этом доме',
  premises_cadastral_number_uq: 'Помещение с таким кадастровым номером уже есть',
  buildings_cadastral_number_uq: 'Дом с таким кадастровым номером уже есть',
  personal_accounts_number_key: 'Лицевой счёт с таким номером уже есть',
  legal_entities_inn_kpp_uq: 'Юрлицо с таким ИНН и КПП уже есть',
};

// Что мешает удалить запись: ключ из ответа бэкенда («has active premises») -> по-русски.
const ACTIVE_CHILDREN = {
  buildings: 'дома',
  premises: 'помещения',
  ownerships: 'записи о собственности',
  residencies: 'записи о проживании',
  accounts: 'лицевые счета',
  'account holders': 'плательщики',
};

// На какую удалённую запись ссылаются при сохранении или восстановлении.
const DELETED_PARENTS = {
  organization: 'организация',
  building: 'дом',
  premises: 'помещение',
  person: 'физлицо',
  'legal entity': 'юрлицо',
  account: 'лицевой счёт',
  'related owner': 'собственник (родство)',
};

function translateReason(reason) {
  for (const [re, text] of REASONS) {
    const m = reason.match(re);
    if (m) return typeof text === 'function' ? text(m) : text;
  }
  return reason;
}

// Возвращает {field, message}: field задан, если ошибку можно показать у поля.
export function describeApiError(err, { action = 'save' } = {}) {
  const raw = (err instanceof ApiError || err instanceof Error) ? err.message : String(err ?? '');

  if (raw.startsWith('already exists: ')) {
    const constraint = raw.slice('already exists: '.length);
    return { field: null, message: CONFLICTS[constraint] || 'Такая запись уже есть' };
  }
  if (raw.startsWith('referenced or dependent record conflict')) {
    return {
      field: null,
      message: action === 'delete'
        ? 'Нельзя удалить: на запись ссылаются другие данные'
        : 'Связанная запись не найдена',
    };
  }
  let m = raw.match(/^cannot delete: has active (.+)$/);
  if (m) {
    return { field: null, message: `Нельзя удалить: есть действующие ${ACTIVE_CHILDREN[m[1]] || m[1]}. Сначала удалите их.` };
  }
  m = raw.match(/^cannot save: (.+) is deleted$/);
  if (m) {
    return { field: null, message: `Связанная запись удалена: ${DELETED_PARENTS[m[1]] || m[1]}. Сначала восстановите её.` };
  }
  if (raw === 'sum of ownership shares for the premises exceeds 1') {
    return { field: 'share_num', message: 'Сумма долей собственников превысит 1' };
  }
  if (raw === 'not found') return { field: null, message: 'Запись не найдена' };

  const fieldError = raw.match(/^([a-z_]+): (.+)$/);
  if (fieldError) return { field: fieldError[1], message: translateReason(fieldError[2]) };
  return { field: null, message: raw || 'Не удалось выполнить запрос' };
}

// Показывает ошибку API в форме: у поля, если оно есть в форме, иначе в баннере.
export function applyFormApiError(form, err) {
  const { field, message } = describeApiError(err);
  if (field) form.setFieldErrors({ [field]: message });
  else form.setGeneralError(message);
}
