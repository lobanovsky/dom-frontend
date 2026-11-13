import test from 'node:test';
import assert from 'node:assert/strict';
import { groupGateRequests, gateZoneLabel, gatePropertyLabel } from './gate.js';
test('охрана принимает одно решение для квартиры и машиноместа', () => {
  const groups = groupGateRequests([
    {
      id: 1,
      group_id: 1,
      zone: 'courtyard',
      premises_kind: 'apartment',
      premises_number: '16',
      effective_status: 'pending',
      eligible: true,
      active: false,
    },
    {
      id: 2,
      group_id: 1,
      zone: 'parking',
      premises_kind: 'parking_space',
      premises_number: '178',
      effective_status: 'pending',
      eligible: true,
      active: false,
    },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, 1);
  assert.equal(gateZoneLabel(groups[0]), 'Двор, Паркинг');
  assert.equal(gatePropertyLabel(groups[0]), 'Квартира 16, Машиноместо 178');
});
