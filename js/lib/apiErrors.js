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
  [/^must contain exactly (\d+) digits$/, (m) => `Должно быть ровно ${m[1]} цифр`],
  [/^must contain 10 or 12 digits$/, 'Должно быть 10 или 12 цифр'],
  [/^must have at most 2 decimal places$/, 'Не больше двух знаков после запятой'],
  [/^must not be set together with personal_account_id$/, 'Нельзя указать и лицевой счёт, и категорию'],
  [/^time must be HH:MM:SS$/, 'Время в формате чч:мм'],
];

// Понятные сообщения для уникальных ограничений БД (имя ограничения из миграции).
const CONFLICTS = {
  premises_building_id_kind_number_key: 'Помещение с таким видом и номером уже есть в этом доме',
  premises_cadastral_number_uq: 'Помещение с таким кадастровым номером уже есть',
  buildings_cadastral_number_uq: 'Дом с таким кадастровым номером уже есть',
  personal_accounts_number_key: 'Лицевой счёт с таким номером уже есть',
  legal_entities_inn_kpp_uq: 'Юрлицо с таким ИНН и КПП уже есть',
  bank_accounts_number_key: 'Банковский счёт с таким номером уже есть',
  payment_categories_name_key: 'Такая категория уже есть',
  incoming_payments_dedup_key_key: 'Такая операция из выписки уже есть на этом счёте',
  outgoing_payments_dedup_key_key: 'Такая операция из выписки уже есть на этом счёте',
  bank_statements_file_sha256_key: 'Эта выписка уже загружена',
  incoming_payments_external_id_key: 'Платёж с таким номером операции уже есть на этом счёте',
  payment_registries_file_sha256_key: 'Этот файл реестра уже загружен',
};

// Что мешает удалить запись: ключ из ответа бэкенда («has active premises») -> по-русски.
const ACTIVE_CHILDREN = {
  buildings: 'дома',
  premises: 'помещения',
  ownerships: 'записи о собственности',
  residencies: 'записи о проживании',
  accounts: 'лицевые счета',
  'account holders': 'плательщики',
  'bank accounts': 'банковские счета',
  'bank statements': 'банковские выписки',
  'payment registries': 'реестры платежей',
  'incoming payments': 'входящие платежи',
  'outgoing payments': 'исходящие платежи',
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
  'bank account': 'банковский счёт',
  'payment registry': 'реестр платежей',
  'bank statement': 'банковская выписка',
  'payment category': 'категория платежа',
};

const RULE_REASONS = [
  [/^condition (\d+): (.+)$/, (m) => `Условие ${m[1]}: ${translateRuleReason(m[2])}`],
  [/^values: from 1 to (\d+) required$/, 'Укажите значение'],
  [/^values: must be non-empty and shorter than (\d+) characters$/, (m) => `Значения не пустые и короче ${m[1]} символов`],
  [/^regex "(.*)": (.*)$/, (m) => `выражение «${m[1]}» неверно: ${m[2]}`],
  [/^amount "(.*)" is not a number$/, (m) => `сумма «${m[1]}» — не число`],
  [/^op (\w+) needs (\d+) value\(s\)$/, (m) => `для операции нужно значений: ${m[2]}`],
  [/^op must be one of: .*$/, 'недопустимая операция'],
  [/^field must be one of: .*$/, 'недопустимое поле'],
  [/^must contain a capture group$/, 'в выражении нужна группа захвата в скобках, например (\\d+)'],
  [/^not found or deleted$/, 'не найдено или удалено'],
];

function translateRuleReason(reason) {
  for (const [re, text] of RULE_REASONS) {
    const m = reason.match(re);
    if (m) return typeof text === 'function' ? text(m) : text;
  }
  return translateReason(reason);
}

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
  if (raw === 'bank account not found') return { field: null, message: 'Банковский счёт не найден' };
  m = raw.match(/^registry file already loaded: registry (\d+)$/);
  if (m) return { field: null, message: `Этот файл уже загружен: реестр № ${m[1]}`, registryId: Number(m[1]) };
  m = raw.match(/^all (\d+) payments of the file are already loaded$/);
  if (m) return { field: null, message: `Все платежи файла (${m[1]}) уже загружены раньше` };
  m = raw.match(/^file name refers to account (\d+), but account (\d+) is selected$/);
  if (m) return { field: null, message: `В имени файла счёт ${m[1]}, а выбран ${m[2]}` };
  if (raw.startsWith('summary line (=N;...) is missing')) return { field: null, message: 'В файле нет итоговой строки: файл неполный' };
  m = raw.match(/^summary line says "(.*)" payments, the file has (\d+)$/);
  if (m) return { field: null, message: `Итоговая строка: ${m[1]} платежей, а в файле ${m[2]}` };
  if (raw.startsWith('summary line total')) return { field: null, message: 'Итоговая сумма в файле не совпадает с суммой платежей' };
  if (raw === 'file has no payments') return { field: null, message: 'В файле нет платежей' };
  m = raw.match(/^statement file already loaded: statement (\d+)$/);
  if (m) return { field: null, message: `Эта выписка уже загружена: № ${m[1]}`, statementId: Number(m[1]) };
  m = raw.match(/^all (\d+) operations of the statement are already loaded$/);
  if (m) return { field: null, message: `Все операции выписки (${m[1]}) уже загружены раньше` };
  m = raw.match(/^bank account (\d+) is not in the system$/);
  if (m) return { field: null, message: `Банковский счёт ${m[1]} не найден в системе` };
  m = raw.match(/^file name refers to account (\d+), but the statement is for account (\d+)$/);
  if (m) return { field: null, message: `В имени файла счёт ${m[1]}, а выписка по счёту ${m[2]}` };
  m = raw.match(/^statement header "(.*)" not found: not a СберБизнес statement$/);
  if (m) return { field: null, message: 'Это не выписка СберБизнес: не найден заголовок таблицы «Дата проводки»' };
  m = raw.match(/^column "(.*)" not found in the statement header$/);
  if (m) return { field: null, message: `В выписке не найдена колонка «${m[1]}»` };
  if (raw === 'our account number is not found in the statement header') return { field: null, message: 'В шапке выписки не найден номер счёта' };
  if (raw === 'statement has no operations') return { field: null, message: 'В выписке нет операций' };
  if (raw.startsWith('summary block (')) return { field: null, message: 'В выписке нет итогового блока: файл неполный' };
  if (raw.startsWith('summary says ')) return { field: null, message: 'Число операций в итоге выписки не совпадает с числом строк' };
  if (raw === 'summary turnover does not match the sum of operations') return { field: null, message: 'Итоговые обороты выписки не совпадают с суммой операций' };
  if (raw === 'not a valid xlsx file') return { field: null, message: 'Не удалось прочитать файл: нужен xlsx (Excel)' };
  if (raw === 'assignment run not found') return { field: null, message: 'Запуск не найден' };
  if (raw === 'assignment run is already rolled back') return { field: null, message: 'Этот запуск уже откатан' };
  if (raw === 'rule not found') return { field: null, message: 'Правило не найдено' };
  if (raw === 'building not found') return { field: null, message: 'Дом не найден' };
  if (raw === 'file has no data rows') return { field: null, message: 'В файле нет строк с данными' };
  if (raw.startsWith('not a valid xlsx file')) return { field: null, message: 'Не удалось прочитать файл: нужен xlsx (Excel)' };
  if (raw.startsWith('file contains invalid rows')) return { field: null, message: 'В файле есть ошибки, ничего не загружено' };
  // Ошибка БД при импорте: бэкенд добавляет номер строки файла.
  m = raw.match(/^row (\d+): (.+)$/);
  if (m) return { field: null, message: `Строка ${m[1]}: ${describeApiError(new Error(m[2])).message}` };
  if (raw === 'not found') return { field: null, message: 'Запись не найдена' };

  const fieldError = raw.match(/^([a-z_.]+): (.+)$/);
  if (fieldError) {
    // action.pattern, action.premises_id -> поле формы «action»
    const field = fieldError[1].split('.')[0];
    return { field, message: translateRuleReason(fieldError[2]) };
  }
  return { field: null, message: raw || 'Не удалось выполнить запрос' };
}

// Показывает ошибку API в форме: у поля, если оно есть в форме, иначе в баннере.
export function applyFormApiError(form, err) {
  const { field, message } = describeApiError(err);
  if (field) form.setFieldErrors({ [field]: message });
  else form.setGeneralError(message);
}

const ROW_FIELDS = {
  number: 'номер помещения',
  last_name: 'фамилия',
  first_name: 'имя',
  utilities_account: 'лицевой счёт ЖКУ',
  capital_repair_account: 'лицевой счёт капремонта',
};

const STATEMENT_ROW = [
  [/^date is not valid$/, 'неверная дата'],
  [/^debit amount: .*$/, 'неверная сумма по дебету'],
  [/^credit amount: .*$/, 'неверная сумма по кредиту'],
  [/^both debit and credit amounts are set$/, 'заполнены и дебет, и кредит'],
  [/^no amount$/, 'нет суммы'],
  [/^account "(.*)" in the row is not the statement account$/, (m) => `счёт «${m[1]}» в строке не совпадает со счётом выписки`],
];

const REGISTRY_ROW = [
  [/^expected (\d+) fields, got (\d+)$/, (m) => `ожидалось полей: ${m[1]}, найдено: ${m[2]}`],
  [/^date "(.*)": expected dd-mm-yyyy$/, (m) => `дата «${m[1]}»: нужен формат дд-мм-гггг`],
  [/^time "(.*)": expected hh-mm-ss$/, (m) => `время «${m[1]}»: нужен формат чч-мм-сс`],
  [/^operation number is empty$/, 'нет номера операции'],
  [/^account number is empty$/, 'нет номера лицевого счёта'],
  [/^payer name is empty$/, 'нет ФИО плательщика'],
  [/^amount must be positive$/, 'сумма должна быть больше нуля'],
  [/^amount "(.*)": expected a number with at most 2 decimals$/, (m) => `сумма «${m[1]}»: нужно число не больше чем с двумя знаками после запятой`],
];

const DUPLICATES = { number: 'номер помещения', 'cadastral number': 'кадастровый номер', account: 'лицевой счёт' };

// Перевод ошибки одной строки файла импорта (message из rows[].error бэкенда).
export function describeImportRowError(message) {
  let m = message.match(/^([a-z_]+) is required$/);
  if (m) return `не заполнено: ${ROW_FIELDS[m[1]] || m[1]}`;
  m = message.match(/^area: "(.*)" is not a positive number$/);
  if (m) return `площадь «${m[1]}» — нужно число больше нуля`;
  m = message.match(/^duplicate (.+) "(.*)" \(already in row (\d+)\)$/);
  if (m) return `повтор: ${DUPLICATES[m[1]] || m[1]} «${m[2]}» уже в строке ${m[3]}`;
  for (const [re, text] of [...REGISTRY_ROW, ...STATEMENT_ROW]) {
    const rm = message.match(re);
    if (rm) return typeof text === 'function' ? text(rm) : text;
  }
  if (message === 'utilities and capital repair accounts must differ') return 'лицевые счета ЖКУ и капремонта совпадают';
  return message;
}
