import test from 'node:test';
import assert from 'node:assert/strict';
import { meterReadingFields } from './fields.js';

test('ручное предыдущее показание выбирается отдельно для каждого тарифа', () => {
  const meter = {
    resource: 'electricity', tariffs: 3, last_reading_date: '2026-10-21',
    last_t1: 796.11, last_t2: 513.91, last_t3: 961.3,
  };
  const fields = meterReadingFields(meter, { new_reading: true });
  const t1 = fields.find((field) => field.name === 'no_consumption_t1');
  const t2 = fields.find((field) => field.name === 'no_consumption_t2');
  assert.equal(t1.help, 'Предыдущее на 21.10.2026: 796,11');
  assert.equal(t2.help, 'Предыдущее на 21.10.2026: 513,91');
  assert.deepEqual(t1.onChange(true), { t1: 796.11 });
  assert.deepEqual(t2.onChange(true), { t2: 513.91 });

  const updated = meterReadingFields(meter, { new_reading: true, no_consumption_t1: true });
  assert.equal(updated.find((field) => field.name === 't1').disabled, true);
  assert.equal(updated.find((field) => field.name === 't2').disabled, false);
  assert.equal(updated.find((field) => field.name === 't3').disabled, false);
});
