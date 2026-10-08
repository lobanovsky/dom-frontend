import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maybeGzip, shouldCompress, COMPRESS_MIN_BYTES } from './gzip.js';

const text = 'ПлательщикИНН=0\n'.repeat(Math.ceil(COMPRESS_MIN_BYTES / 10));

async function gunzip(blob) {
  return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

test('large .txt files are gzipped under a .gz name and round-trip', async () => {
  const file = new File([text], 'kl_to_1c.txt', { type: 'text/plain' });
  assert.equal(shouldCompress(file), true);
  const packed = await maybeGzip(file);
  assert.equal(packed.name, 'kl_to_1c.txt.gz');
  assert.ok(packed.size < file.size / 5, `compressed ${packed.size} of ${file.size}`);
  assert.equal(await gunzip(packed), text);
});

test('small files, zip archives and other extensions are left alone', async () => {
  const small = new File(['abc'], 'a.txt');
  const zip = new File([text], 'archive.zip');
  const xlsx = new File([text], 'buildings.xlsx');
  for (const f of [small, zip, xlsx]) {
    assert.equal(shouldCompress(f), false);
    assert.equal(await maybeGzip(f), f);
  }
});
