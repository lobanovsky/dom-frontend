import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPayload, toFormValues } from './payload.js';

const defs = [
  { name: 'name', type: 'text' },
  { name: 'floors', type: 'number' },
  { name: 'organization_id', type: 'select', numeric: true },
  { name: 'registered', type: 'checkbox' },
  { name: 'valid_to', type: 'date' },
  { name: 'owner_kind', type: 'select', virtual: true },
  { name: 'person_id', type: 'picker', visible: (v) => v.owner_kind === 'person' },
  { name: 'legal_entity_id', type: 'picker', visible: (v) => v.owner_kind === 'legal_entity' },
];

test('toPayload converts types, empties to null, hidden to null, skips virtual', () => {
  const body = toPayload(defs, {
    name: '  ТСН  ', floors: '9', organization_id: '3', registered: true, valid_to: '',
    owner_kind: 'person', person_id: 7, legal_entity_id: 5,
  }, { premises_id: 1 });
  assert.deepEqual(body, {
    name: 'ТСН', floors: 9, organization_id: 3, registered: true, valid_to: null,
    person_id: 7, legal_entity_id: null, premises_id: 1,
  });
});

test('toPayload: blank number is null, checkbox false by default', () => {
  const body = toPayload(defs, { floors: '', owner_kind: 'legal_entity', legal_entity_id: 5 });
  assert.equal(body.floors, null);
  assert.equal(body.registered, false);
  assert.equal(body.legal_entity_id, 5);
  assert.equal(body.person_id, null);
});

test('toFormValues maps nulls to empty strings and numbers to strings', () => {
  const values = toFormValues(defs, { name: 'ТСН', floors: 9, organization_id: 3, registered: true, valid_to: null, person_id: 7 });
  assert.equal(values.name, 'ТСН');
  assert.equal(values.floors, '9');
  assert.equal(values.organization_id, '3');
  assert.equal(values.registered, true);
  assert.equal(values.valid_to, '');
  assert.equal(values.person_id, 7);
  assert.equal(values.legal_entity_id, null);
});
