const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const engine = require('../js/engine');

function device(t, respond) {
  const dom = new JSDOM('', { url: 'https://appassets.androidplatform.net', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.AvritEngine = engine;
  w.AvritReminders = { postMessage(raw) { respond(JSON.parse(raw), reply => w.AvritReminderReply(reply)); } };
  w.eval(fs.readFileSync(path.join(__dirname, '../js/reminders.js'), 'utf8'));
  return w;
}

test('device schedule sends local due time and no profile, photos or history', t => {
  const w = device(t, () => {});
  const plan = w.AvritDeviceReminders.plan([{ id: 'x', title: 'Hair', kind: 'custom', lastDone: '2026-10-01', intervalDays: 7, logs: [{ private: true }], photo: 'private' }], '15:30');
  assert.deepEqual(Object.keys(plan[0]), ['id', 'title', 'at']);
  const date = new Date(plan[0].at);
  assert.equal(date.getDate(), 8);
  assert.equal(date.getHours(), 15);
  assert.equal(date.getMinutes(), 30);
  assert.equal(w.AvritDeviceReminders.plan([{ id: 'unscheduled', kind: 'custom' }]).length, 0);
});

test('native synchronization is ordered, including recovery after a device error', async t => {
  const requests = [];
  const w = device(t, (request, reply) => { requests.push(request); setTimeout(() => reply(request.id === 1 ? { id: request.id, error: 'Storage full' } : { id: request.id, permission: 'granted' }), 0); });
  const first = w.AvritDeviceReminders.sync([]);
  const second = w.AvritDeviceReminders.sync([]);
  await assert.rejects(first, /Storage full/);
  assert.equal((await second).permission, 'granted');
  assert.deepEqual(requests.map(r => r.id), [1, 2]);
});

test('iOS bridge receives structured messages and matches only outstanding replies', async t => {
  const w = device(t, () => {});
  delete w.AvritReminders;
  w.webkit = { messageHandlers: { avritReminders: { postMessage(request) {
    w.AvritReminderReply({ id: 999, permission: 'denied' });
    w.AvritReminderReply({ id: request.id, permission: 'granted' });
  } } } };
  assert.equal(w.AvritDeviceReminders.available(), true);
  assert.equal((await w.AvritDeviceReminders.call('request')).permission, 'granted');
});
