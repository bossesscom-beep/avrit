const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');
const root = path.join(__dirname, '..');
const engine = require('../js/engine');
const catalog = require('../js/catalog');

async function app(t, storage = {}, configure) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { url: 'https://onboarding.test', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document;
  await new Promise(resolve => d.addEventListener('DOMContentLoaded', resolve, { once: true }));
  w.matchMedia = () => ({ matches: true, addEventListener() {} });
  w.indexedDB = new IDBFactory();
  w.URL.createObjectURL = () => 'blob:preview'; w.URL.revokeObjectURL = () => {};
  for (const [key, value] of Object.entries(storage)) w.localStorage.setItem(key, value);
  if (configure) configure(w);
  // Load the actual entrypoint order, including onboarding, rather than a separate test boot.
  for (const script of d.querySelectorAll('script[src]')) w.eval(fs.readFileSync(path.join(root, script.getAttribute('src').split('?')[0]), 'utf8'));
  return { w, d,
    click(text) { const b = [...d.querySelectorAll('#onboarding button')].find(n => n.textContent === text); assert.ok(b, 'Button exists: ' + text); b.click(); },
    input(selector, value, event = 'input') { const n = d.querySelector(selector); assert.ok(n, selector); n.value = value; n.dispatchEvent(new w.Event(event, { bubbles: true })); },
    saved() { return JSON.parse(w.localStorage.getItem('avrit.items.v1')); },
    draft() { return JSON.parse(w.localStorage.getItem('avrit.onboarding.draft.v1')); },
    snapshot() { return Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)])); }
  };
}
function explore(a) { a.click('Continue →'); a.click('Find my Avrits →'); a.click('Explore 16 ideas →'); }
function review(a) { const b = [...a.d.querySelectorAll('#onboarding button')].find(n => /chosen · Review/.test(n.textContent)); b.click(); }
function complete(a) { a.d.querySelector('.ob-footer .ob-primary').click(); }

test('first launch explains Avrit after the optional profile and keeps the app inaccessible during setup', async t => {
  const a = await app(t);
  assert.equal(a.d.querySelector('.app').hidden, true);
  assert.equal(a.d.querySelector('#onboarding h1').textContent, 'Hello, you.');
  assert.equal(a.saved(), null);
  a.click('Continue →');
  assert.match(a.d.querySelector('.ob-lead').textContent, /An Avrit is something/);
  assert.equal(a.d.querySelectorAll('.ob-how > div').length, 3);
});

test('setup creates all selected dashboard cards without inventing completion history, then survives reload and logging', async t => {
  const a = await app(t);
  a.input('#ob-name', 'Mira'); a.input('#ob-gender', 'woman', 'change');
  explore(a);
  a.click('+ Add to my Avrits →'); a.click('+ Add to my Avrits →'); a.click('+ Add to my Avrits →');
  review(a); complete(a);
  assert.equal(a.d.querySelector('#onboarding'), null);
  assert.equal(a.d.querySelectorAll('.card').length, 3);
  const saved = a.saved();
  assert.equal(saved.profile.name, 'Mira'); assert.equal(saved.profile.gender, 'woman');
  assert.equal(saved.onboardingComplete, true);
  assert.deepEqual(saved.items.map(i => i.title), ['Hair cutting', 'Nail cutting', 'Body massage']);
  for (const item of saved.items) { assert.equal(item.lastDone, ''); assert.deepEqual(item.logs, []); assert.ok(engine.suggest(item).nextAt); }
  assert.equal(a.w.localStorage.getItem('avrit.onboarding.draft.v1'), null);
  const b = await app(t, a.snapshot());
  assert.equal(b.d.querySelector('#onboarding'), null);
  b.d.querySelector('[data-action="done"]').click();
  assert.equal(b.saved().profile.name, 'Mira');
  assert.equal(b.saved().items[0].logs.length, 1);
  assert.ok(b.d.querySelector('.dashboard-greeting').textContent.includes('Mira'));
});

test('interrupted setup resumes at the same card with profile, interval and choices intact', async t => {
  const a = await app(t); a.input('#ob-name', 'Rae'); explore(a);
  a.input('#ob-days', '35'); a.click('+ Add to my Avrits →');
  const b = await app(t, a.snapshot());
  assert.equal(b.d.querySelector('.ob-flash h1').textContent, 'Nail cutting');
  assert.equal(b.draft().choices.haircut.days, '35');
  assert.equal(b.draft().choices.haircut.selected, true);
  assert.equal(b.draft().profile.name, 'Rae');
});

test('the full catalog covers every requested routine and can populate all 28 cards', async t => {
  const a = await app(t);
  a.click('Continue →'); a.click('Find my Avrits →');
  for (const id of ['health','digital','admin']) a.d.querySelector('[data-category="' + id + '"]').click();
  a.click('Explore 28 ideas →');
  for (const item of catalog.items) {
    assert.equal(a.d.querySelector('.ob-flash h1').textContent, item.title);
    if (item.days === null) a.input('#ob-days', '180');
    a.click('+ Add to my Avrits →');
  }
  assert.equal(a.d.querySelectorAll('.ob-review-row').length, 28);
  complete(a); assert.equal(a.d.querySelectorAll('.card').length, 28);
  assert.equal(new Set(a.saved().items.map(i => i.id)).size, 28);
  for (const title of ['Hair cutting','Nail cutting','Body massage','Eye checkup','Shoe cleaning','Shelf cleaning','Sell or donate old clothes','Bathroom cleaning']) assert.ok(a.saved().items.some(i => i.title === title), title);
});

test('health timing requires an explicit interval; future completion dates and fractional intervals are rejected', async t => {
  const a = await app(t); a.click('Continue →'); a.click('Find my Avrits →');
  for (const id of ['self','home','wardrobe','health']) a.d.querySelector('[data-category="' + id + '"]').click();
  a.click('Explore 3 ideas →'); a.click('+ Add to my Avrits →');
  assert.equal(a.d.querySelector('.ob-flash h1').textContent, 'Eye checkup');
  assert.match(a.d.querySelector('.ob-message').textContent, /Choose a repeat interval/);
  a.input('#ob-days', '1.5'); a.click('+ Add to my Avrits →'); assert.equal(a.draft().choices['eye-checkup'].selected, false);
  a.input('#ob-days', '180'); a.input('#ob-start-mode', 'last', 'change'); a.input('#ob-date', '2099-01-01'); a.click('+ Add to my Avrits →');
  assert.match(a.d.querySelector('.ob-message').textContent, /today or earlier/);
  a.input('#ob-date', '2026-01-01'); a.click('+ Add to my Avrits →'); review(a); complete(a);
  assert.equal(a.saved().items[0].lastDone, '2026-01-01');
  assert.equal(a.saved().items[0].logs.length, 1);
});

test('a chosen first due date is honoured until a real completion establishes the next interval', async t => {
  const a = await app(t); explore(a);
  a.input('#ob-start-mode', 'first', 'change'); a.input('#ob-date', '2099-01-12'); a.click('+ Add to my Avrits →'); review(a); complete(a);
  const item = a.saved().items[0];
  assert.equal(engine.formatDay(engine.suggest(item).nextAt), '2099-01-12');
  assert.equal(engine.reminderFor(item, '2099-01-11').due, false);
  assert.equal(engine.reminderFor(item, '2099-01-12').due, true);
  const done = a.w.AvritJournal.record(item, '2099-01-10');
  assert.equal(engine.formatDay(engine.suggest(done).nextAt), '2099-02-21');
});

test('skipped and removed ideas are excluded, custom Avrits are validated and added', async t => {
  const a = await app(t); explore(a); a.click('Not for me · Next →'); a.click('+ Add to my Avrits →'); review(a);
  a.d.querySelector('[aria-label="Remove Nail cutting"]').click();
  assert.equal(a.d.querySelector('.ob-footer .ob-primary').disabled, true);
  a.input('#ob-custom-name', '<b>Clean bicycle</b>'); a.input('#ob-custom-days', '14'); a.click('Add my own Avrit');
  assert.equal(a.d.querySelector('.ob-review-row b'), null, 'User content is text, never HTML');
  complete(a); assert.equal(a.saved().items.length, 1); assert.equal(a.saved().items[0].intervalDays, 14);
});

test('existing data bypasses onboarding, exploration preserves logs and does not duplicate builtins', async t => {
  const old = { id: 'haircut', kind: 'haircut', title: 'My haircut', lastDone: '2026-01-02', intervalDays: 21, logs: [{ date: '2026-01-02', photoId: 'kept', note: 'Keep this' }] };
  const a = await app(t, { 'avrit.items.v1': JSON.stringify({ version: 1, items: [old] }) });
  assert.equal(a.d.querySelector('#onboarding'), null);
  a.d.querySelector('.dashboard-explore').click(); explore(a); a.click('Already in my Avrits →'); a.click('+ Add to my Avrits →'); review(a); complete(a);
  assert.equal(a.saved().items.length, 2); assert.deepEqual(a.saved().items[0], old);
});

test('intentionally empty legacy dashboard remains empty and does not restart onboarding', async t => {
  const a = await app(t, { 'avrit.items.v1': JSON.stringify({ version: 1, items: [] }) });
  assert.equal(a.d.querySelector('#onboarding'), null); assert.ok(a.d.querySelector('.empty-state'));
});

test('dashboard filters show matching items, preserve full order, and a Done removes an item from due view', async t => {
  const a = await app(t); explore(a);
  a.input('#ob-start-mode', 'last', 'change'); a.input('#ob-date', '2020-01-01'); a.click('+ Add to my Avrits →');
  a.click('+ Add to my Avrits →'); review(a); complete(a);
  const order = a.saved().items.map(i => i.id);
  a.input('#dashboard-filter', 'due', 'change');
  assert.equal(a.d.querySelectorAll('.card').length, 1); assert.equal(a.d.querySelector('[data-grip]'), null);
  a.d.querySelector('[data-action="done"]').click();
  assert.equal(a.d.querySelectorAll('.card').length, 0); assert.ok(a.d.querySelector('.empty-state'));
  a.input('#dashboard-filter', 'upcoming', 'change'); assert.equal(a.d.querySelectorAll('.card').length, 2);
  a.input('#dashboard-filter', 'self', 'change'); assert.equal(a.d.querySelectorAll('.card').length, 2);
  a.input('#dashboard-filter', 'all', 'change'); assert.equal(a.d.querySelectorAll('[data-grip]').length, 2);
  assert.deepEqual(a.saved().items.map(i => i.id), order);
});

test('failed final save leaves setup open, preserves previous items, and supports retry', async t => {
  const a = await app(t); explore(a); a.click('+ Add to my Avrits →'); review(a);
  const set = a.w.Storage.prototype.setItem;
  a.w.Storage.prototype.setItem = function (key, value) { if (key === 'avrit.items.v1') throw new Error('quota'); return set.call(this, key, value); };
  complete(a); assert.equal(a.saved(), null); assert.ok(a.d.querySelector('#onboarding')); assert.match(a.d.querySelector('.ob-message').textContent, /Could not save your dashboard/);
  a.w.Storage.prototype.setItem = set; complete(a); assert.equal(a.saved().items.length, 1);
});

test('profile photo storage failures are visible and never create a saved reference', async t => {
  const a = await app(t); a.w.AvritJournal.preparePhoto = async () => { throw new Error('Photo could not be opened'); };
  const picker = a.d.querySelector('#ob-photo-picker'); Object.defineProperty(picker, 'files', { value: [{ type: 'image/jpeg' }] }); picker.dispatchEvent(new a.w.Event('change'));
  await new Promise(r => setTimeout(r, 0));
  assert.match(a.d.querySelector('.ob-message').textContent, /Photo could not be opened/);
  assert.equal(a.d.querySelector('.ob-primary').disabled, false); assert.equal(a.d.querySelectorAll('.ob-photo').length, 0);
});

test('profile photo is saved locally, restored on reload and explicitly removable without a network call', async t => {
  let requests = 0; const a = await app(t, {}, w => { w.fetch = () => { requests++; throw new Error('Unexpected network'); }; });
  a.w.AvritJournal.preparePhoto = async () => new Blob(['photo'], { type: 'image/jpeg' });
  const picker = a.d.querySelector('#ob-photo-picker'); Object.defineProperty(picker, 'files', { value: [{ type: 'image/jpeg' }] }); picker.dispatchEvent(new a.w.Event('change'));
  for (let i = 0; i < 30 && !a.d.querySelector('.ob-photo'); i++) await new Promise(r => setTimeout(r, 5));
  assert.equal(a.d.querySelectorAll('.ob-photo').length, 1);
  const id = a.draft().profile.photos[0]; assert.ok(await a.w.AvritJournal.photoStore(a.w.indexedDB).get(id));
  const b = await app(t, a.snapshot(), w => { w.indexedDB = a.w.indexedDB; });
  await new Promise(r => setTimeout(r, 10)); assert.equal(b.d.querySelector('.ob-photo img').src, 'blob:preview');
  b.d.querySelector('[aria-label="Remove profile photo 1"]').click();
  await new Promise(r => setTimeout(r, 10)); assert.equal(b.draft().profile.photos.length, 0);
  assert.equal(await b.w.AvritJournal.photoStore(b.w.indexedDB).get(id), undefined); assert.equal(requests, 0);
});

function connect(w, handler) {
  w.localStorage.setItem('avrit.ai.connection.v1', JSON.stringify({ origin: 'https://ai.test', token: 'test-device-token' }));
  w.fetch = handler;
}
const estimate = { title: 'Hair cutting', intervalDays: 35, reason: 'Try a five-week starting rhythm for the shape you described. Adjust after your next trim.', note: 'Save a reference photo you like before your next appointment.' };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('AI timing shares only explicit routine context and changes the draft only after adoption', async t => {
  const requests = [];
  const a = await app(t, {}, w => connect(w, async (url, request) => { requests.push(JSON.parse(request.body)); return { ok: true, json: async () => estimate }; }));
  a.input('#ob-name', 'Private name'); a.input('#ob-gender', 'woman', 'change'); explore(a);
  a.input('.ai-timing textarea', 'Short hair, neat shape');
  assert.equal(requests.length, 0);
  a.click('✦ Ask AI for timing'); await tick();
  assert.deepEqual(requests, [{ task: 'schedule', text: 'Hair cutting', templateId: 'haircut', category: 'self', context: 'Short hair, neat shape' }]);
  assert.equal(a.d.querySelector('#ob-days').value, '42'); assert.equal(a.saved(), null);
  assert.equal(a.d.querySelector('.ai-nice-suggestion').textContent, estimate.note);
  assert.match(a.d.querySelector('.ai-next-date').textContent, /Next reminder:/);
  a.click('Use this timing · 35 days');
  assert.equal(a.d.querySelector('#ob-days').value, '35'); assert.equal(a.saved(), null);
  a.click('+ Add to my Avrits →'); review(a); complete(a);
  assert.equal(a.saved().items[0].intervalDays, 35);
  const adjusted = engine.setUserInterval(a.saved().items[0], 20);
  assert.equal(engine.suggest(adjusted).nextAt, engine.addDays(engine.calendarDay(adjusted.scheduleStartedAt), 20));
});

test('disconnected AI never labels the offline starting point as generated', async t => {
  const a = await app(t); explore(a);
  assert.match(a.d.querySelector('.ai-timing').textContent, /not an AI estimate/);
  assert.equal(a.d.querySelector('.ai-ask'), null);
});

test('AI failure and invalid output preserve the interval and let people continue', async t => {
  let response = { ok: false, json: async () => ({ error: 'Today’s allowance is used.' }) };
  const a = await app(t, {}, w => connect(w, async () => response)); explore(a);
  a.click('✦ Ask AI for timing'); await tick();
  assert.match(a.d.querySelector('.ai-timing .feature-status').textContent, /allowance/); assert.equal(a.d.querySelector('#ob-days').value, '42');
  response = { ok: true, json: async () => ({ ...estimate, intervalDays: 0 }) };
  a.click('✦ Ask AI for timing'); await tick();
  assert.match(a.d.querySelector('.ai-timing .feature-status').textContent, /incomplete/);
  assert.equal(a.d.querySelector('.ai-timing-result button'), null);
  a.click('+ Add to my Avrits →'); review(a); complete(a); assert.equal(a.saved().items[0].intervalDays, 42);
});

test('leaving a card while AI responds cannot change the next card or any schedule', async t => {
  let resolve;
  const a = await app(t, {}, w => connect(w, () => new Promise(r => { resolve = r; }))); explore(a);
  a.click('✦ Ask AI for timing'); a.click('Not for me · Next →');
  resolve({ ok: true, json: async () => estimate }); await tick();
  assert.equal(a.d.querySelector('.ob-flash h1').textContent, 'Nail cutting');
  assert.equal(a.d.querySelector('#ob-days').value, '7'); assert.equal(a.d.querySelector('.ai-timing-result button'), null);
});

test('dashboard AI adoption is explicit and save failures roll back the active schedule', async t => {
  const item = { id: 'haircut', kind: 'haircut', title: 'Hair cutting', category: 'self', intervalDays: 42, lastDone: '2026-01-01' };
  const a = await app(t, { 'avrit.items.v1': JSON.stringify({ version: 1, items: [item] }) }, w => connect(w, async () => ({ ok: true, json: async () => estimate })));
  a.d.querySelector('[data-action="open"]').click();
  a.d.querySelector('.ai-ask').click(); await tick(); assert.equal(a.saved().items[0].intervalDays, 42);
  const set = a.w.Storage.prototype.setItem;
  a.w.Storage.prototype.setItem = () => { throw new Error('quota'); };
  a.d.querySelector('.ai-timing-result button').click();
  assert.match(a.d.querySelector('.ai-timing .feature-status').textContent, /Could not save/);
  assert.equal(a.saved().items[0].intervalDays, 42);
  a.w.Storage.prototype.setItem = set; a.d.querySelector('.ai-timing-result button').click();
  assert.equal(a.saved().items[0].intervalDays, 35);
});
