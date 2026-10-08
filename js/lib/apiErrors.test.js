import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeApiError } from './apiErrors.js';
import { ApiError } from '../api/client.js';

const err = (message, status = 422) => new ApiError({ status, message });

test('field validation errors are split and translated', () => {
  assert.deepEqual(describeApiError(err('name: is required')), { field: 'name', message: 'Обязательное поле' });
  assert.deepEqual(describeApiError(err('kind: must be one of: uk, tsn, tszh')), { field: 'kind', message: 'Недопустимое значение' });
  assert.deepEqual(describeApiError(err('year_built: must be between 1700 and 2200')), { field: 'year_built', message: 'Должно быть от 1700 до 2200' });
  assert.deepEqual(
    describeApiError(err('person_id: exactly one of person_id and legal_entity_id must be set')),
    { field: 'person_id', message: 'Укажите физлицо или юрлицо' },
  );
});

test('unknown reason keeps original text at the field', () => {
  assert.deepEqual(describeApiError(err('foo: something new')), { field: 'foo', message: 'something new' });
});

test('conflicts use constraint-specific messages', () => {
  assert.equal(
    describeApiError(err('already exists: premises_building_id_kind_number_key', 409)).message,
    'Помещение с таким видом и номером уже есть в этом доме',
  );
  assert.equal(describeApiError(err('already exists: unknown_key', 409)).message, 'Такая запись уже есть');
});

test('foreign key message depends on action', () => {
  const e = err('referenced or dependent record conflict: ownerships_premises_id_fkey');
  assert.match(describeApiError(e, { action: 'delete' }).message, /Нельзя удалить/);
  assert.equal(describeApiError(e).message, 'Связанная запись не найдена');
});

test('share sum error goes to share field', () => {
  assert.deepEqual(
    describeApiError(err('sum of ownership shares for the premises exceeds 1')),
    { field: 'share_num', message: 'Сумма долей собственников превысит 1' },
  );
});

test('contact validation errors are translated and attached to the list field', () => {
  assert.deepEqual(
    describeApiError(err('phones: "12-34": must contain at least 5 digits')),
    { field: 'phones', message: '«12-34»: в номере должно быть не меньше 5 цифр' },
  );
  assert.deepEqual(
    describeApiError(err('emails: "abc": is not a valid email')),
    { field: 'emails', message: '«abc»: некорректный адрес' },
  );
  assert.deepEqual(describeApiError(err('phones: must contain at most 10 items')), { field: 'phones', message: 'Не больше 10 значений' });
});

test('soft-delete guards are translated', () => {
  assert.equal(
    describeApiError(err('cannot delete: has active premises')).message,
    'Нельзя удалить: есть действующие помещения. Сначала удалите их.',
  );
  assert.equal(
    describeApiError(err('cannot delete: has active account holders')).message,
    'Нельзя удалить: есть действующие плательщики. Сначала удалите их.',
  );
  assert.equal(
    describeApiError(err('cannot save: building is deleted')).message,
    'Связанная запись удалена: дом. Сначала восстановите её.',
  );
  assert.equal(
    describeApiError(err('cannot save: legal entity is deleted')).message,
    'Связанная запись удалена: юрлицо. Сначала восстановите её.',
  );
});

test('import row errors', async () => {
  const { describeImportRowError } = await import('./apiErrors.js');
  assert.equal(describeImportRowError('last_name is required'), 'не заполнено: фамилия');
  assert.equal(describeImportRowError('area: "abc" is not a positive number'), 'площадь «abc» — нужно число больше нуля');
  assert.equal(describeImportRowError('duplicate account "0001" (already in row 4)'), 'повтор: лицевой счёт «0001» уже в строке 4');
  assert.equal(describeImportRowError('something new'), 'something new');
});

test('import errors: row prefix from DB conflicts and file errors', () => {
  assert.equal(
    describeApiError(err('row 7: already exists: personal_accounts_number_key', 409)).message,
    'Строка 7: Лицевой счёт с таким номером уже есть',
  );
  assert.equal(describeApiError(err('not a valid xlsx file: zip: not a valid zip file')).message, 'Не удалось прочитать файл: нужен xlsx (Excel)');
  assert.equal(describeApiError(err('building not found', 404)).message, 'Дом не найден');
});

test('payments and registry errors', () => {
  assert.deepEqual(describeApiError(err('amount: must have at most 2 decimal places')), { field: 'amount', message: 'Не больше двух знаков после запятой' });
  assert.deepEqual(describeApiError(err('number: must contain exactly 20 digits')), { field: 'number', message: 'Должно быть ровно 20 цифр' });
  const dup = describeApiError(err('registry file already loaded: registry 7', 409));
  assert.equal(dup.registryId, 7);
  assert.equal(dup.message, 'Этот файл уже загружен: реестр № 7');
  assert.equal(describeApiError(err('all 10 payments of the file are already loaded', 409)).message, 'Все платежи файла (10) уже загружены раньше');
  assert.equal(describeApiError(err('already exists: incoming_payments_external_id_key', 409)).message, 'Платёж с таким номером операции уже есть на этом счёте');
  assert.equal(describeApiError(err('cannot delete: has active incoming payments')).message, 'Нельзя удалить: есть действующие входящие платежи. Сначала удалите их.');
  assert.equal(describeApiError(err('row 3: already exists: incoming_payments_external_id_key', 409)).message, 'Строка 3: Платёж с таким номером операции уже есть на этом счёте');
});

test('registry row errors are translated', async () => {
  const { describeImportRowError } = await import('./apiErrors.js');
  assert.equal(describeImportRowError('date "2026-01-03": expected dd-mm-yyyy'), 'дата «2026-01-03»: нужен формат дд-мм-гггг');
  assert.equal(describeImportRowError('expected 13 fields, got 5'), 'ожидалось полей: 13, найдено: 5');
});

test('statement errors', async () => {
  const { describeImportRowError } = await import('./apiErrors.js');
  const dup = describeApiError(err('statement file already loaded: statement 3', 409));
  assert.equal(dup.statementId, 3);
  assert.equal(dup.message, 'Эта выписка уже загружена: № 3');
  assert.equal(describeApiError(err('bank account 40703810338000009999 is not in the system', 404)).message, 'Банковский счёт 40703810338000009999 не найден в системе');
  assert.equal(describeImportRowError('amount "abc" is not valid'), 'сумма «abc» неверна');
  assert.equal(describeApiError(err('row 4: already exists: incoming_payments_dedup_key_key', 409)).message, 'Строка 4: Такая операция из выписки уже есть на этом счёте');
});

test('rule errors map to the action/conditions fields', () => {
  assert.deepEqual(describeApiError(err('action.pattern: must contain a capture group')), { field: 'action', message: 'в выражении нужна группа захвата в скобках, например (\\d+)' });
  assert.deepEqual(describeApiError(err('action.premises_id: is required')), { field: 'action', message: 'Обязательное поле' });
  assert.deepEqual(describeApiError(err('conditions: condition 2: amount "x" is not a number')), { field: 'conditions', message: 'Условие 2: сумма «x» — не число' });
  assert.equal(describeApiError(err('assignment run is already rolled back', 409)).message, 'Этот запуск уже откатан');
});




test('1C statement errors', () => {
  assert.match(describeApiError(err('not a 1C client-bank exchange file (1CClientBankExchange header is missing)')).message, /нет строки 1CClientBankExchange/);
  assert.equal(describeApiError(err('unsupported 1C format version "2.0" (supported: 1.xx, usually 1.03)')).message, 'Версия формата 1С «2.0» не поддерживается (нужна 1.03)');
  const day = describeApiError(err('day totals do not match the documents (2 days): 4070 05.01.2026: debit 0.00 in the section, 0.00 in documents; credit 999.00 in the section, 100.50 in documents')).message;
  assert.match(day, /Итоги по дням в файле не совпадают с суммой документов \(дней: 2\)/);
  assert.match(day, /выгрузите период из банка заново/);
  assert.equal(describeApiError(err('the file has no payment documents')).message, 'В файле нет платёжных документов');
});
