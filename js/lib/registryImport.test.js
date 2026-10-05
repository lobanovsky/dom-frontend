import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryText, summaryTone, statusInfo } from './registryImport.js';

const base = { files_imported: 0, files_failed: 0, files_ignored: 0, payments_created: 0, payments_skipped: 0, linked: 0, unlinked: 0 };

test('summary text and tone', () => {
  const ok = { ...base, files_imported: 6, payments_created: 60, linked: 58, unlinked: 2, files_ignored: 3 };
  assert.equal(
    summaryText(ok),
    'Загружено: 6 файлов, 60 платежей. Привязано к лицевым счетам: 58, без привязки: 2. Пропущено файлов, не похожих на реестры: 3.',
  );
  assert.equal(summaryTone(ok), 'success');

  const partial = { ...base, files_imported: 1, payments_created: 1, files_failed: 2, payments_skipped: 4 };
  assert.match(summaryText(partial), /Загружено: 1 файл, 1 платёж\./);
  assert.match(summaryText(partial), /Пропущено уже загруженных платежей: 4\./);
  assert.match(summaryText(partial), /Не загружено файлов: 2\./);
  assert.equal(summaryTone(partial), 'warning');

  assert.equal(summaryText(base), 'Ни один файл не загружен.');
  assert.equal(summaryTone(base), 'error');
});

test('plural forms', () => {
  assert.match(summaryText({ ...base, files_imported: 2, payments_created: 22 }), /2 файла, 22 платежа/);
  assert.match(summaryText({ ...base, files_imported: 11, payments_created: 21 }), /11 файлов, 21 платёж\./);
});

test('status info falls back to the raw status', () => {
  assert.equal(statusInfo('imported').label, 'Загружен');
  assert.equal(statusInfo('unknown_account').tone, 'error');
  assert.deepEqual(statusInfo('weird'), { label: 'weird', tone: 'neutral' });
});
