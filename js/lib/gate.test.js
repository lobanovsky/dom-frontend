import test from 'node:test';
import assert from 'node:assert/strict';
import { groupGateRequests, gateZoneLabel, gatePropertyLabel, GATE_STATUSES } from './gate.js';
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

test('видимые статусы: проверка, одобрение и отказ, включая архивные состояния', () => {
  const row = (effective_status, active = false) => ({ id: 1, effective_status, active, eligible: true });
  for (const state of ['rejected', 'revoked', 'cancelled', 'expired', 'ineligible']) {
    assert.equal(groupGateRequests([row(state)])[0].display_status, 'rejected');
  }
  assert.equal(groupGateRequests([row('pending')])[0].display_status, 'pending');
  assert.equal(groupGateRequests([row('approved', true)])[0].display_status, 'approved');
  const mixed = [
    { ...row('ineligible'), group_id: 1 },
    { ...row('approved', true), id: 2, group_id: 1 },
  ];
  assert.equal(groupGateRequests(mixed)[0].display_status, 'approved');
  mixed[1].effective_status = 'pending';
  mixed[1].active = false;
  assert.equal(groupGateRequests(mixed)[0].display_status, 'rejected');
});

test('в фильтре охраны только три статуса', () =>
  assert.deepEqual(Object.keys(GATE_STATUSES), ['pending', 'approved', 'rejected']));

test('ожидающая заявка сохраняет проверку даже при утрате права', () => {
  assert.equal(
    groupGateRequests([{ id: 1, status: 'pending', effective_status: 'ineligible', eligible: false, active: false }])[0]
      .display_status,
    'pending',
  );
});

import { gateVehicles, gateVehicleLabel } from './gate.js';
test('все действующие автомобили показаны, снятые с использования остаются в архиве', () => {
  const row = {
    vehicles: [
      { plate_number: 'А123АА77', brand: 'Toyota', active: true },
      { plate_number: 'В456ВВ77', brand: 'Kia', active: true },
      { plate_number: 'С789СС77', brand: 'Ford', active: false },
    ],
  };
  assert.equal(gateVehicles(row).length, 2);
  assert.equal(gateVehicleLabel(gateVehicles(row)[1]), 'В456ВВ77 · Kia');
  assert.equal(gateVehicles(row, false)[0].brand, 'Ford');
  assert.equal(gateVehicles({ vehicle_plate: 'А123АА77', vehicle_brand: 'Toyota' }).length, 1);
  assert.deepEqual(
    gateVehicles({ vehicles: [{ plate_number: 'С789СС77', active: false }], vehicle_plate: 'С789СС77' }),
    [],
  );
});
