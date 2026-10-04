import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isRequired, isValidDate, validateFieldDef } from './validate.js';

describe('isRequired', () => {
  test('rejects null/undefined/empty string', () => {
    assert.equal(isRequired(null), false);
    assert.equal(isRequired(undefined), false);
    assert.equal(isRequired('   '), false);
  });

  test('accepts non-empty string and other truthy-ish values', () => {
    assert.equal(isRequired('Аня'), true);
    assert.equal(isRequired(0), true);
    assert.equal(isRequired(false), true);
  });
});

describe('isValidDate', () => {
  test('accepts YYYY-MM-DD', () => {
    assert.equal(isValidDate('2015-04-23'), true);
  });

  test('rejects other formats', () => {
    assert.equal(isValidDate('23.04.2015'), false);
    assert.equal(isValidDate('2015-4-23'), false);
    assert.equal(isValidDate(''), false);
  });
});

describe('validateFieldDef', () => {
  test('required field with empty value fails', () => {
    assert.equal(validateFieldDef({ required: true, type: 'text' }, ''), 'Обязательное поле');
  });

  test('required checkbox never fails on falsy value', () => {
    assert.equal(validateFieldDef({ required: true, type: 'checkbox' }, false), null);
  });

  test('optional empty field passes', () => {
    assert.equal(validateFieldDef({ type: 'text' }, ''), null);
  });

  test('date field validates format when a value is present', () => {
    assert.equal(validateFieldDef({ type: 'date' }, 'not-a-date'), 'Некорректная дата');
    assert.equal(validateFieldDef({ type: 'date' }, '2015-04-23'), null);
  });
});
