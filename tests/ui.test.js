const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');

async function app(t, saved, configure) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'https://avrit.test/', runScripts: 'outside-only', pretendToBeVisual: true
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  await new Promise(resolve => w.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  w.matchMedia = () => ({ matches: true, addEventListener() {} });
  const haptics = [];
  w.AvritNative = { postMessage(kind) { haptics.push(kind); } };
  if (saved) w.localStorage.setItem('avrit.items.v1', JSON.stringify({ version: 1, items: saved }));
  if (configure) configure(w);
  for (const file of ['engine', 'guides', 'gesture', 'journal', 'ai', 'features', 'ui']) w.eval(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'));
  const click = selector => {
    const node = w.document.querySelector(selector);
    assert.ok(node, 'Missing element: ' + selector);
    node.click();
  };
  return { w, d: w.document, haptics, click };
}

test('one-tap logging saves the displayed date and gives one success haptic without navigating', async t => {
  const { w, d, haptics, click } = await app(t);
  assert.deepEqual(haptics, [], 'No feedback during startup');
  const button = d.querySelector('[data-action="done"]');
  const displayed = button.getAttribute('data-shown');
  click('[data-action="done"]');
  const saved = JSON.parse(w.localStorage.getItem('avrit.items.v1')).items;
  assert.equal(saved[0].lastDone, displayed);
  assert.equal(d.querySelectorAll('.card').length, 5);
  assert.equal(d.querySelector('.card .next').textContent, w.AvritEngine.prettyDate(w.AvritEngine.suggest(saved[0]).nextAt));
  assert.deepEqual(haptics, ['success']);
});

test('date and interval controls update the same reminder and keep expanded options open', async t => {
  const { w, d, click } = await app(t);
  click('[data-action="open"]');
  d.querySelector('#when').value = '2026-09-01';
  click('[data-action="save-date"]');
  d.querySelector('#item-options').open = true;
  d.querySelector('#gap').value = '12';
  click('[data-action="save-gap"]');
  const saved = JSON.parse(w.localStorage.getItem('avrit.items.v1')).items[0];
  assert.equal(saved.lastDone, '2026-09-01');
  assert.equal(saved.intervalDays, 12);
  assert.equal(d.querySelector('#item-options').open, true);
  assert.equal(d.querySelector('[data-next-due]').textContent, '13 Sep 2026');
  assert.ok(d.querySelectorAll('.claim a').length > 0);
});

test('custom reminder flow saves input and returns to the list', async t => {
  const { w, d, click } = await app(t);
  click('.nav-add');
  d.querySelector('#custom-name').value = 'Water basil';
  d.querySelector('#custom-when').value = '2026-10-01';
  d.querySelector('#custom-gap').value = '3';
  click('[data-action="create"]');
  const saved = JSON.parse(w.localStorage.getItem('avrit.items.v1')).items;
  assert.equal(saved.length, 6);
  assert.equal(saved[5].title, 'Water basil');
  assert.equal(saved[5].intervalDays, 3);
  assert.equal(d.querySelectorAll('.card').length, 6);
});

test('keyboard reorder persists the previewed order and retains focus', async t => {
  const { w, d } = await app(t);
  const grip = d.querySelector('[data-grip]');
  const id = grip.getAttribute('data-id');
  grip.focus();
  grip.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  const saved = JSON.parse(w.localStorage.getItem('avrit.items.v1')).items;
  assert.equal(saved[1].id, id);
  assert.equal(d.activeElement.getAttribute('data-id'), id);
});

test('an intentionally empty list survives startup, and removal requires confirmation', async t => {
  const empty = await app(t, []);
  assert.equal(empty.d.querySelectorAll('.card').length, 0);
  assert.ok(empty.d.querySelector('.empty-state'));
  const full = await app(t);
  full.click('[data-action="open"]');
  full.click('[data-action="arm-remove"]');
  assert.equal(full.d.querySelector('#item-options').open, true);
  assert.equal(full.w.localStorage.getItem('avrit.items.v1'), null);
  full.click('[data-action="confirm-remove"]');
  assert.equal(full.d.querySelectorAll('.card').length, 4);
});

test('sound preference persists and an invalid custom item stays in the form', async t => {
  const { w, d, click } = await app(t);
  click('#nav-more');
  click('[data-action="toggle-sound"]');
  assert.equal(w.localStorage.getItem('avrit.sound'), 'off');
  assert.equal(d.querySelector('[data-action="toggle-sound"]').getAttribute('aria-pressed'), 'false');
  click('.nav-add');
  click('[data-action="create"]');
  assert.equal(d.querySelector('#add-note').textContent, 'Name it first.');
  assert.ok(d.querySelector('#custom-name'));
});

test('Gemini draft requires explicit use and normal Add before it is saved', async t => {
  const requests = [];
  const { w, d, click } = await app(t, null, w => {
    w.localStorage.setItem('avrit.ai.connection.v1', JSON.stringify({ origin: 'https://ai.example.test', token: 'test-token' }));
    w.fetch = async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ title: 'Water basil', intervalDays: 3, reason: 'Every three days, as requested.', note: '' }) };
    };
  });
  click('.nav-add');
  d.querySelector('.ai-compose').open = true;
  d.querySelector('.ai-compose textarea').value = 'Water basil every three days';
  [...d.querySelectorAll('button')].find(n => n.textContent === 'Send to Gemini · draft reminder').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(requests[0].options.body).text, 'Water basil every three days');
  assert.equal(d.querySelector('#custom-name').value, '');
  assert.equal(w.localStorage.getItem('avrit.items.v1'), null);
  [...d.querySelectorAll('button')].find(n => n.textContent === 'Use this draft').click();
  assert.equal(d.querySelector('#custom-name').value, 'Water basil');
  assert.equal(w.localStorage.getItem('avrit.items.v1'), null);
  click('[data-action="create"]');
  assert.equal(JSON.parse(w.localStorage.getItem('avrit.items.v1')).items[5].intervalDays, 3);
});

test('logging never sends photos or reminders to Gemini automatically', async t => {
  let requests = 0;
  const { w, click } = await app(t, null, w => {
    w.localStorage.setItem('avrit.geminiKey', 'legacy-test-value');
    w.localStorage.setItem('avrit.ai.connection.v1', JSON.stringify({ origin: 'https://ai.example.test', token: 'test-token' }));
    w.fetch = async () => { requests++; throw new Error('Unexpected network request'); };
  });
  click('[data-action="done"]');
  click('[data-action="open"]');
  assert.equal(requests, 0);
  assert.equal(w.localStorage.getItem('avrit.geminiKey'), null);
  assert.equal(JSON.parse(w.localStorage.getItem('avrit.items.v1')).items[0].logs.length, 1);
});

test('failed photo storage leaves completion date and history unchanged', async t => {
  const { w, d, click } = await app(t);
  w.AvritJournal.preparePhoto = async () => new Blob(['test'], { type: 'image/jpeg' });
  w.URL.createObjectURL = () => 'blob:test';
  w.URL.revokeObjectURL = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  click('[data-action="open"]');
  const picker = d.querySelector('input[type=file]');
  Object.defineProperty(picker, 'files', { value: [{ type: 'image/jpeg' }] });
  picker.dispatchEvent(new w.Event('change'));
  await new Promise(resolve => setTimeout(resolve, 0));
  [...d.querySelectorAll('button')].find(n => n.textContent === 'Save photo & log').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(w.localStorage.getItem('avrit.items.v1'), null);
  assert.match(d.querySelector('.feature-status').textContent, /unavailable/);
  assert.ok(d.querySelector('.photo-editor img'), 'Draft remains available to retry');
});

test('a failed completion save rolls back the in-memory item', async t => {
  const { w, d, click } = await app(t);
  w.Storage.prototype.setItem = () => { throw new Error('Quota exceeded'); };
  click('[data-action="done"]');
  click('[data-action="open"]');
  assert.equal(d.querySelector('[data-next-due]').textContent, 'Whenever you’re ready.');
  assert.match(d.querySelector('#status').textContent, /Could not save/);
});

function pointer(w, node, type, y) {
  const event = new w.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 }, button: { value: 0 }, clientY: { value: y }, clientX: { value: 100 }
  });
  node.dispatchEvent(event);
}

test('pull resistance grows with the finger and reduced-motion release returns immediately to rest', async t => {
  const { w, d } = await app(t);
  const main = d.querySelector('.card-main');
  pointer(w, main, 'pointerdown', 100);
  pointer(w, w, 'pointermove', 180);
  const first = parseFloat(d.querySelector('#stack').style.transform.split(',')[1]);
  pointer(w, w, 'pointermove', 200);
  const second = parseFloat(d.querySelector('#stack').style.transform.split(',')[1]);
  assert.ok(first > 0 && first < 80);
  assert.ok(second > first && second < 100);
  pointer(w, w, 'pointerup', 200);
  assert.equal(parseFloat(d.querySelector('#stack').style.transform.split(',')[1]), 0);
});

test('cancelled drag preserves order; release commits exactly the previewed slot', async t => {
  const { w, d, haptics } = await app(t);
  function start() {
    const grip = d.querySelector('[data-grip]');
    grip.closest('.card').getBoundingClientRect = () => ({ height: 156 });
    pointer(w, grip, 'pointerdown', 250);
    pointer(w, w, 'pointermove', 425);
  }
  const original = [...d.querySelectorAll('.card')].map(n => n.dataset.item);
  start();
  pointer(w, w, 'pointercancel', 425);
  assert.deepEqual([...d.querySelectorAll('.card')].map(n => n.dataset.item), original);
  assert.equal(w.localStorage.getItem('avrit.items.v1'), null);
  start();
  pointer(w, w, 'pointerup', 425);
  const saved = JSON.parse(w.localStorage.getItem('avrit.items.v1')).items;
  assert.equal(saved[1].id, original[0]);
  assert.ok(haptics.includes('grab'));
  assert.ok(haptics.includes('release'));
});
