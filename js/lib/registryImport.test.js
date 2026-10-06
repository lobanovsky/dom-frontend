import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryText, summaryTone, statusInfo, isProblem, problemFiles } from './registryImport.js';

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

test('only files with problems are listed, most serious first', () => {
  const clean = { file_name: 'clean', status: 'imported', result: { warnings: [], skipped: [] } };
  const warned = { file_name: 'warned', status: 'imported', result: { warnings: ['w'], skipped: [] } };
  const skipped = { file_name: 'skipped', status: 'imported', result: { warnings: [], skipped: [{}] } };
  const dup = { file_name: 'dup', status: 'duplicate_file' };
  const bad = { file_name: 'bad', status: 'invalid' };
  const unknown = { file_name: 'unknown', status: 'unknown_account' };
  assert.equal(isProblem(clean), false);
  assert.equal(isProblem(warned), true);
  assert.equal(isProblem(dup), true);
  assert.deepEqual(
    problemFiles([clean, warned, dup, clean, bad, skipped, unknown]).map((f) => f.file_name),
    ['bad', 'unknown', 'dup', 'warned', 'skipped'],
  );
  assert.deepEqual(problemFiles([clean, clean]), []);
});
