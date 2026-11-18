import test from 'node:test';
import assert from 'node:assert/strict';
import { groupGateRequests, gateZoneLabel, gatePropertyLabel, GATE_STATUSES, formatGatePhoneInput, gatePremisesTone, gateOwnersFirst } from './gate.js';
test('маска телефона доступа всегда начинает с +7 и оставляет только цифры номера', () => {
  assert.equal(formatGatePhoneInput(''), '+7');
  assert.equal(formatGatePhoneInput('+7 9'), '+7 9');
  assert.equal(formatGatePhoneInput('9001234567'), '+7 900 123 45 67');
  assert.equal(formatGatePhoneInput('8 (900) 123-45-67'), '+7 900 123 45 67');
  assert.equal(formatGatePhoneInput('+7 921 788 28 28'), '+7 921 788 28 28');
  assert.equal(formatGatePhoneInput('abc 900x123-45-67'), '+7 900 123 45 67');
});
test('квартира или машиноместо с арендатором выделяется отдельно', () => {
  assert.equal(gatePremisesTone([]), 'none');
  assert.equal(gatePremisesTone([{ relation: 'owner' }]), 'access');
  assert.equal(gatePremisesTone([{ relation: 'owner' }, { relation: 'tenant' }]), 'tenant');
});
test('собственники стоят перед остальными пользователями с сохранением порядка внутри групп', () => {
  const rows = [{ id: 1, relation: 'guest' }, { id: 2, relation: 'owner' }, { id: 3, relation: 'tenant' }, { id: 4, relation: 'owner' }];
  assert.deepEqual(gateOwnersFirst(rows).map((row) => row.id), [2, 4, 1, 3]);
  assert.deepEqual(rows.map((row) => row.id), [1, 2, 3, 4]);
});
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

test('фильтр заявок включает ожидание удаления доступа с устройства', () => {
  assert.deepEqual(Object.keys(GATE_STATUSES), ['pending', 'approved', 'revoke_requested', 'rejected']);
  assert.equal(GATE_STATUSES.revoke_requested, 'Ожидает удаления с устройства');
});

test('ожидающая заявка сохраняет проверку даже при утрате права', () => {
  assert.equal(
    groupGateRequests([{ id: 1, status: 'pending', effective_status: 'ineligible', eligible: false, active: false }])[0]
      .display_status,
    'pending',
  );
});

import { gateVehicles, gateVehicleLabel, copyGateAccessToParking } from './gate.js';
test('заявки показывают автомобили из реестра без архивного статуса', () => {
  const row = {
    vehicles: [
      { plate_number: 'А123АА77', brand: 'Toyota' },
      { plate_number: 'В456ВВ77', brand: 'Kia' },
    ],
  };
  assert.equal(gateVehicles(row).length, 2);
  assert.equal(gateVehicleLabel(gateVehicles(row)[1]), 'В456ВВ77 · Kia');
  assert.equal(gateVehicles({ vehicle_plate: 'А123АА77', vehicle_brand: 'Toyota' }).length, 1);
  assert.deepEqual(
    gateVehicles({ vehicles: [{ plate_number: 'С789СС77' }] }),
    [{ plate_number: 'С789СС77' }],
  );
});

test('копирование доступа на машиноместо сохраняет данные человека, автомобиля и срока', () => {
  const row = {
    phone: '79990000001',
    recipient_name: 'Голдобин Владимир Анатольевич',
    relation: 'relative',
    valid_until: '2027-05-30',
    no_personal_vehicle: false,
    occasional_vehicle: true,
    vehicles: [{ id: 18, plate_number: 'А123АА77', brand: 'Toyota' }],
    comment: 'Примечание',
  };
  assert.deepEqual(copyGateAccessToParking(row, 46), {
    premises_id: 46,
    zone: 'parking',
    phone: '79990000001',
    recipient_name: 'Голдобин Владимир Анатольевич',
    relation: 'relative',
    valid_until: '2027-05-30',
    no_personal_vehicle: false,
    occasional_vehicle: true,
    vehicles: [{ plate_number: 'А123АА77', brand: 'Toyota' }],
    comment: 'Примечание',
  });
});

test('копирование доступа без личного автомобиля не прикладывает прежние автомобили', () => {
  const body = copyGateAccessToParking({
    phone: '79990000001', recipient_name: 'Иван', relation: 'owner',
    no_personal_vehicle: true, vehicles: [{ plate_number: 'А123АА77', brand: 'Toyota' }],
  }, 46);
  assert.equal(body.no_personal_vehicle, true);
  assert.deepEqual(body.vehicles, []);
});
