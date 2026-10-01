const test = require('node:test');
const assert = require('node:assert/strict');
const { IDBFactory } = require('fake-indexeddb');
const journal = require('../js/journal');

test('upgrade preserves the prior completion and repeated Done preserves a photo and note', () => {
  const initial = { id: 'plant', lastDone: '2026-09-29' };
  const photo = journal.record(initial, '2026-10-01', { photoId: 'photo-1', note: 'Fresh soil' });
  const repeated = journal.record(photo, '2026-10-01');
  assert.equal(initial.logs, undefined);
  assert.equal(repeated.logs.length, 2);
  assert.equal(repeated.logs[0].photoId, 'photo-1');
  assert.equal(repeated.logs[0].note, 'Fresh soil');
});

test('a backdated photo does not move the next reminder backwards', () => {
  const item = journal.record({ lastDone: '2026-10-01' }, '2026-09-15', { photoId: 'older' });
  assert.equal(item.lastDone, '2026-10-01');
  assert.deepEqual(item.logs.map(entry => entry.date), ['2026-10-01', '2026-09-15']);
});

test('photo blobs survive opening a new store, and removal deletes only selected photos', async () => {
  const indexedDB = new IDBFactory();
  const first = journal.photoStore(indexedDB);
  const photo = new Blob(['image bytes'], { type: 'image/jpeg' });
  await first.put('one', photo);
  await first.put('two', photo);
  const second = journal.photoStore(indexedDB);
  assert.equal(await (await second.get('one')).text(), 'image bytes');
  await second.remove(['one']);
  assert.equal(await first.get('one'), undefined);
  assert.equal((await first.get('two')).type, 'image/jpeg');
});

test('unavailable photo storage fails visibly instead of pretending to save', async () => {
  await assert.rejects(journal.photoStore(null).put('one', new Blob()), /unavailable/);
});
