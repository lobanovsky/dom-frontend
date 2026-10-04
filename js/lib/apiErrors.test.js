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
