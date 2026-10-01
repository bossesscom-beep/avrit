(function () {
  'use strict';
  var C = window.AvritCatalog, E = window.AvritEngine;
  var KEY = 'avrit.onboarding.draft.v1', STORE = 'avrit.items.v1';
  var draft, host, finish, existing, oldProfile, photos, busy = false, urls = [];
  function node(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function button(text, action, cls) { var b = node('button', { type: 'button', class: cls || 'ob-secondary', text: text }); b.onclick = action; return b; }
  function field(text, input) { return node('label', { class: 'field-label' }, [node('span', { text: text }), input]); }
  function today() { return E.formatDay(E.calendarDay(new Date())); }
  function selected() { return Object.keys(draft.choices).filter(function (id) { return draft.choices[id].selected; }); }
  function deck() { return C.items.concat(draft.custom).filter(function (i) { return draft.categories.indexOf(i.category) !== -1 || i.category === 'custom'; }); }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(draft)); return true; }
    catch (err) { message('Your progress could not be saved. Free some device storage and try again.'); return false; }
  }
  function message(text) { var n = host && host.querySelector('.ob-message'); if (n) n.textContent = text; }
  function choice(item) {
    if (!draft.choices[item.id]) draft.choices[item.id] = { selected: false, days: item.days || '', mode: 'start', date: '', first: '' };
    return draft.choices[item.id];
  }
  function alreadyAdded(id) {
    return existing.some(function (i) { return i.templateId === id || i.id === 'avrit-' + id || (['nail','haircut'].indexOf(id) !== -1 && i.kind === id); });
  }
  function go(step) { if (busy) return; draft.step = step; persist(); render(); }
  function start(items, profile, callback) {
    existing = items; oldProfile = profile || {}; finish = callback;
    photos = window.AvritJournal.photoStore(window.indexedDB);
    var saved;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (err) { /* fresh draft */ }
    draft = saved && saved.version === 1 && Array.isArray(saved.categories) && saved.choices && Array.isArray(saved.custom) && saved.profile && Array.isArray(saved.profile.photos) ? saved : {
      version: 1, step: 'profile', index: 0,
      profile: { name: oldProfile.name || '', gender: oldProfile.gender || '', genderDetail: oldProfile.genderDetail || '', intention: oldProfile.intention || '', photos: (oldProfile.photos || []).slice() },
      categories: ['self', 'home', 'wardrobe'], choices: {}, custom: []
    };
    if (['profile','explain','areas','cards','review'].indexOf(draft.step) === -1) draft.step = 'profile';
    host = node('section', { id: 'onboarding', class: 'onboarding', 'aria-label': 'Set up your Avrits' });
    document.body.appendChild(host);
    document.querySelector('.app').hidden = true;
    render();
  }
  function cleanUrls() { urls.forEach(function (url) { URL.revokeObjectURL(url); }); urls = []; }
  function render() {
    cleanUrls(); host.textContent = '';
    var stages = ['profile','explain','areas','cards','review'], stage = stages.indexOf(draft.step);
    host.appendChild(node('header', { class: 'ob-top' }, [
      node('div', { class: 'ob-brand' }, [node('img', { src: 'css/avrit-icon.svg', alt: '', width: '32', height: '32' }), node('span', { text: 'Avrit' })]),
      node('span', { class: 'ob-step', text: ['01 / A little about you','02 / A little introduction','03 / Your world','04 / Find your Avrits','05 / Make it yours'][stage] })
    ]));
    var progress = node('div', { class: 'ob-progress', 'aria-label': 'Step ' + (stage + 1) + ' of 5' });
    stages.forEach(function (_, i) { progress.appendChild(node('span', { class: i <= stage ? 'active' : '' })); }); host.appendChild(progress);
    var body = node('div', { class: 'ob-body' }); host.appendChild(body);
    host.appendChild(node('p', { class: 'ob-message', role: 'status', 'aria-live': 'polite' }));
    var footer = node('footer', { class: 'ob-footer' }); host.appendChild(footer);
    if (draft.step === 'profile') profileView(body, footer);
    if (draft.step === 'explain') explainView(body, footer);
    if (draft.step === 'areas') areasView(body, footer);
    if (draft.step === 'cards') cardsView(body, footer);
    if (draft.step === 'review') reviewView(body, footer);
    var heading = body.querySelector('h1'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
  function heading(body, label, title, text) {
    body.appendChild(node('p', { class: 'eyebrow', text: label }));
    body.appendChild(node('h1', { text: title }));
    body.appendChild(node('p', { class: 'ob-lead', text: text }));
  }
  function profileView(body, footer) {
    heading(body, 'A LITTLE CARE STARTS WITH YOU', 'Hello, you.', 'Let’s make a little room for the things that take care of your life.');
    var name = node('input', { id: 'ob-name', class: 'field', maxlength: '50', autocomplete: 'given-name', placeholder: 'What should we call you?', value: draft.profile.name });
    name.oninput = function () { draft.profile.name = name.value; persist(); };
    body.appendChild(field('Your name · optional', name));
    var gender = node('select', { id: 'ob-gender', class: 'field' });
    [['','Prefer not to say'],['woman','Woman'],['man','Man'],['nonbinary','Non-binary'],['self-described','Self-described']].forEach(function (g) { gender.appendChild(node('option', { value: g[0], text: g[1] })); });
    gender.value = draft.profile.gender; gender.onchange = function () { draft.profile.gender = gender.value; genderDetail.hidden = gender.value !== 'self-described'; persist(); };
    body.appendChild(field('Gender · optional', gender));
    var description = node('input', { class: 'field', id: 'ob-gender-detail', maxlength: '60', value: draft.profile.genderDetail || '', placeholder: 'In your own words' });
    description.oninput = function () { draft.profile.genderDetail = description.value; persist(); };
    var genderDetail = field('Describe your gender · optional', description); genderDetail.hidden = draft.profile.gender !== 'self-described'; body.appendChild(genderDetail);
    body.appendChild(node('p', { class: 'quiet', text: 'Your gender never limits your Avrit choices.' }));
    var intention = node('input', { id: 'ob-intention', class: 'field', maxlength: '100', placeholder: 'e.g. A calmer home. More time for me.', value: draft.profile.intention });
    intention.oninput = function () { draft.profile.intention = intention.value; persist(); };
    body.appendChild(field('What would you like a little more of? · optional', intention));
    var block = node('section', { class: 'ob-photo-block' }, [node('h2', { text: 'A few photos that feel like you' }), node('p', { class: 'quiet', text: 'Add up to 3: you, your space, or something you love. Optional and kept on this device.' })]);
    var strip = node('div', { class: 'ob-photos' }); block.appendChild(strip);
    draft.profile.photos.forEach(function (id, index) {
      var tile = node('div', { class: 'ob-photo' });
      var image = node('img', { alt: 'Your profile photo ' + (index + 1) }); tile.appendChild(image);
      tile.appendChild(button('×', async function () {
        if (busy) return;
        var previous = draft.profile.photos.slice(); draft.profile.photos = previous.filter(function (p) { return p !== id; });
        if (!persist()) { draft.profile.photos = previous; return; }
        if ((oldProfile.photos || []).indexOf(id) === -1) { try { await photos.remove([id]); } catch (err) { /* orphan can be cleaned later */ } }
        render();
      }, 'ob-photo-remove'));
      tile.lastChild.setAttribute('aria-label', 'Remove profile photo ' + (index + 1)); strip.appendChild(tile);
      photos.get(id).then(function (blob) { if (blob && image.isConnected) { var url = URL.createObjectURL(blob); urls.push(url); image.src = url; } }).catch(function () { image.alt = 'Photo unavailable'; });
    });
    if (draft.profile.photos.length < 3) {
      var picker = node('input', { id: 'ob-photo-picker', type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif', class: 'ob-file' });
      var label = node('label', { class: 'ob-photo-add', for: 'ob-photo-picker', text: '+ Add photo' });
      strip.appendChild(label); strip.appendChild(picker);
      picker.onchange = async function () {
        var file = picker.files[0]; if (!file || busy) return;
        busy = true; host.setAttribute('aria-busy', 'true'); host.querySelectorAll('button,input,select').forEach(function (n) { n.disabled = true; }); message('Preparing your photo…');
        var id = 'profile-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
        try {
          var blob = await window.AvritJournal.preparePhoto(file); await photos.put(id, blob);
          draft.profile.photos.push(id);
          if (!persist()) { draft.profile.photos.pop(); await photos.remove([id]); throw new Error('Could not save your photo. Free some device storage and try again.'); }
          busy = false; render();
        } catch (err) { message(err.message); }
        finally { busy = false; host.removeAttribute('aria-busy'); host.querySelectorAll('button,input,select').forEach(function (n) { n.disabled = false; }); }
      };
    }
    body.appendChild(block);
    body.appendChild(node('p', { class: 'ob-privacy', text: 'Just for your Avrit experience. Your profile and photos stay on this device and are not sent to AI. Clearing app data removes them.' }));
    footer.appendChild(button('Continue →', function () { draft.profile.name = draft.profile.name.trim(); go('explain'); }, 'ob-primary'));
    if (existing.length || oldProfile.name) footer.appendChild(button('Back to my dashboard', close));
  }
  function explainView(body, footer) {
    body.appendChild(node('div', { class: 'ob-orbit', 'aria-hidden': 'true' }, [node('span', { class: 'ob-orbit-core', text: '↻' }), node('span', { class: 'orbit-one', text: '✂' }), node('span', { class: 'orbit-two', text: '⌂' }), node('span', { class: 'orbit-three', text: '♡' })]));
    heading(body, 'MEET YOUR AVRITS', 'Life comes around.\nSo does care.', 'An Avrit is something in your life that needs care again—after a week, a month, or a season.');
    body.appendChild(node('p', { class: 'ob-explanation', text: 'A haircut. Fresh sheets. The shoes by the door. The clothes you’ve been meaning to pass on. Small things that feel good to have taken care of.' }));
    var steps = node('div', { class: 'ob-how' });
    [['01','Choose what matters','Build your own collection of Avrits.'],['02','Give it a rhythm','Choose when you’d like to do it again.'],['03','Do it. Log it. Let it go.','Your next date follows your last completion.']].forEach(function (s) { steps.appendChild(node('div', {}, [node('span', { text: s[0] }), node('div', {}, [node('strong', { text: s[1] }), node('p', { text: s[2] })])])); }); body.appendChild(steps);
    body.appendChild(node('p', { class: 'ob-note', text: 'No streak to protect. No catching up with everyone else. Just a little care, at your pace.' }));
    footer.appendChild(button('Find my Avrits →', function () { go('areas'); }, 'ob-primary'));
    footer.appendChild(button('← About you', function () { go('profile'); }));
  }
  function areasView(body, footer) {
    heading(body, 'YOUR WORLD, YOUR CHOICE', 'Where could life\nfeel a little lighter?', 'Choose the areas you want to explore. You’ll pick individual Avrits next.');
    var grid = node('div', { class: 'ob-area-grid' });
    C.groups.forEach(function (g) {
      var active = draft.categories.indexOf(g.id) !== -1;
      var b = button('', function () {
        if (active) draft.categories = draft.categories.filter(function (id) { return id !== g.id; }); else draft.categories.push(g.id);
        persist(); render(); host.querySelector('[data-category="' + g.id + '"]').focus();
      }, 'ob-area' + (active ? ' selected' : ''));
      b.setAttribute('aria-pressed', String(active)); b.setAttribute('data-category', g.id); b.style.setProperty('--area-color', g.color);
      b.appendChild(node('span', { class: 'ob-area-icon', text: g.icon, 'aria-hidden': 'true' })); b.appendChild(node('strong', { text: g.name })); b.appendChild(node('small', { text: g.caption })); b.appendChild(node('span', { class: 'ob-check', text: active ? '✓' : '+', 'aria-hidden': 'true' })); grid.appendChild(b);
    }); body.appendChild(grid);
    body.appendChild(node('p', { class: 'ob-note', text: 'Start small or explore everything. You can always add more later.' }));
    var next = button('Explore ' + deck().length + ' ideas →', function () { draft.index = 0; go('cards'); }, 'ob-primary'); next.disabled = !deck().length; footer.appendChild(next);
    footer.appendChild(button('← What is an Avrit?', function () { go('explain'); }));
  }
  function valid(c) {
    if (!Number.isInteger(Number(c.days)) || Number(c.days) < 1 || Number(c.days) > 3650) return 'Choose a repeat interval from 1 to 3,650 days.';
    if (c.mode === 'last' && (!realDate(c.date) || c.date > today())) return 'Choose a valid last-done date, today or earlier.';
    if (c.mode === 'first' && (!realDate(c.first) || c.first < today())) return 'Choose a valid first date, today or later.';
    return '';
  }
  function realDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && E.formatDay(Date.parse(value + 'T00:00:00Z')) === value; }
  function nextDate(c) { return c.mode === 'first' ? c.first : E.formatDay(E.addDays(E.calendarDay(c.mode === 'last' ? c.date : today()), Number(c.days))); }
  function cardsView(body, footer) {
    var list = deck(); if (!list.length) { go('areas'); return; }
    draft.index = Math.max(0, Math.min(draft.index, list.length - 1));
    var item = list[draft.index], group = C.group(item.category) || { name: 'Your own idea', color: '#E7DDF9' }, c = choice(item);
    var added = alreadyAdded(item.id);
    var count = node('div', { class: 'ob-card-count' }, [node('span', { text: String(draft.index + 1).padStart(2, '0') + ' / ' + list.length + ' ideas' }), button(selected().length + ' chosen · Review ↗', function () { go('review'); }, 'ob-link')]); body.appendChild(count);
    var flash = node('article', { class: 'ob-flash', 'data-template': item.id }); flash.style.setProperty('--flash-color', group.color);
    flash.appendChild(node('div', { class: 'ob-flash-top' }, [node('span', { class: 'eyebrow', text: group.name }), node('span', { class: 'ob-flash-number', text: 'AVRIT ' + String(C.items.indexOf(item) + 1 || list.length).padStart(2, '0') })]));
    flash.appendChild(node('div', { class: 'ob-flash-art', 'aria-hidden': 'true' }, [node('span', { text: item.icon }), node('i', { text: '✦' })]));
    flash.appendChild(node('h1', { text: item.title })); flash.appendChild(node('p', { class: 'ob-tagline', text: item.headline })); flash.appendChild(node('p', { class: 'ob-description', text: item.description }));
    var timing = node('div', { class: 'ob-timing' });
    timing.appendChild(node('p', { class: 'eyebrow', text: item.days ? 'A STARTING POINT · MAKE IT YOURS' : 'YOUR CLINICIAN-AGREED TIMING' }));
    var options = node('div', { class: 'ob-intervals' });
    item.options.forEach(function (days) {
      var b = button(days % 7 === 0 && days < 90 ? days / 7 + (days === 7 ? ' week' : ' weeks') : days + ' days', function () { c.days = days; persist(); render(); }, 'ob-pill'); b.setAttribute('aria-pressed', String(Number(c.days) === days)); options.appendChild(b);
    }); timing.appendChild(options);
    var input = node('input', { id: 'ob-days', class: 'field', type: 'number', min: '1', max: '3650', step: '1', inputmode: 'numeric', value: c.days, placeholder: item.days ? 'Days' : 'Enter agreed interval' });
    input.oninput = function () { c.days = input.value; persist(); }; timing.appendChild(field('Repeat every … days', input));
    var details = node('details', { class: 'ob-date-options' }, [node('summary', { text: 'When should this begin?' })]);
    var mode = node('select', { id: 'ob-start-mode', class: 'field' });
    [['start','Start the interval today'],['last','I know when I last did this'],['first','Choose my first due date']].forEach(function (p) { mode.appendChild(node('option', { value: p[0], text: p[1] })); }); mode.value = c.mode;
    mode.onchange = function () { c.mode = mode.value; persist(); render(); host.querySelector('.ob-date-options').open = true; host.querySelector('#ob-start-mode').focus(); };
    details.appendChild(field('First reminder', mode));
    if (c.mode !== 'start') {
      var date = node('input', { id: 'ob-date', class: 'field', type: 'date', value: c.mode === 'last' ? c.date : c.first }); date.setAttribute(c.mode === 'last' ? 'max' : 'min', today());
      date.oninput = function () { c[c.mode === 'last' ? 'date' : 'first'] = date.value; persist(); }; details.appendChild(field(c.mode === 'last' ? 'Last completed' : 'First due date', date)); details.open = true;
    }
    details.appendChild(node('p', { class: 'quiet', text: 'Starting an interval sets a reminder. It does not log a completion.' })); timing.appendChild(details); flash.appendChild(timing);
    if (window.AvritTiming && !added) flash.appendChild(window.AvritTiming.create(item, {
      previewDate: function (days) { var proposed = Object.assign({}, c, { days: days }); return valid(proposed) ? '' : E.prettyDate(E.calendarDay(nextDate(proposed))); },
      onUse: function (days) {
        var previous = c.days; c.days = days;
        if (!persist()) { c.days = previous; return false; }
        input.value = days; options.querySelectorAll('button').forEach(function (b, index) { b.setAttribute('aria-pressed', String(item.options[index] === days)); }); return true;
      }
    }));
    var tip = node('details', { class: 'ob-tip' }, [node('summary', { text: 'A little thought to get you started' }), node('p', { text: item.tip })]); flash.appendChild(tip); body.appendChild(flash);
    if (added) flash.appendChild(node('p', { class: 'ob-note', text: 'Already on your dashboard. Your existing timing and history will stay as they are. You can edit them from its dashboard card.' }));
    footer.appendChild(button(added ? 'Already in my Avrits →' : c.selected ? '✓ Keep this Avrit →' : '+ Add to my Avrits →', function () {
      if (added) { c.selected = false; advance(); return; }
      var error = valid(c); if (error) { message(error); input.focus(); return; }
      c.selected = true; advance();
    }, 'ob-primary'));
    var row = node('div', { class: 'ob-footer-row' });
    row.appendChild(button('← Back', function () { if (draft.index > 0) { draft.index--; persist(); render(); } else go('areas'); }));
    row.appendChild(button(c.selected ? 'Remove & next' : 'Not for me · Next →', function () { c.selected = false; advance(); })); footer.appendChild(row);
  }
  function advance() { draft.index++; if (draft.index >= deck().length) go('review'); else { persist(); render(); } }
  function template(id) { return C.get(id) || draft.custom.find(function (item) { return item.id === id; }); }
  function reviewView(body, footer) {
    heading(body, 'A LITTLE CARE, CHOSEN BY YOU', (draft.profile.name ? draft.profile.name + ', this' : 'This') + ' is\nyour kind of rhythm.', selected().length ? 'Your Avrits are ready for a place on your dashboard. Fine-tune anything before you begin.' : 'Start with one thing you’d love to stop forgetting. You can explore more whenever you like.');
    if (draft.profile.intention) body.appendChild(node('p', { class: 'ob-intention', text: 'A little more of: ' + draft.profile.intention }));
    body.appendChild(node('div', { class: 'ob-summary' }, [node('strong', { text: String(selected().length) }), node('span', { text: 'Avrits chosen\nA little less to remember.' })]));
    C.groups.concat([{ id: 'custom', name: 'Your own Avrits', color: '#E7DDF9' }]).forEach(function (g) {
      var ids = selected().filter(function (id) { return template(id).category === g.id; }); if (!ids.length) return;
      var section = node('section', { class: 'ob-review-group' }, [node('h2', { text: g.name })]);
      ids.forEach(function (id) {
        var item = template(id), c = choice(item);
        var row = node('div', { class: 'ob-review-row' });
        var edit = button('', function () {
          if (draft.categories.indexOf(item.category) === -1 && item.category !== 'custom') draft.categories.push(item.category);
          draft.index = deck().findIndex(function (i) { return i.id === id; }); go('cards');
        }, 'ob-review-edit');
        edit.appendChild(node('span', { class: 'ob-review-icon', style: 'background:' + g.color, text: item.icon, 'aria-hidden': 'true' }));
        edit.appendChild(node('span', {}, [node('strong', { text: item.title }), node('small', { text: valid(c) ? 'Choose timing →' : 'Every ' + c.days + ' days · ' + E.prettyDate(E.calendarDay(nextDate(c))) })]));
        edit.setAttribute('aria-label', 'Edit ' + item.title + ' timing'); row.appendChild(edit);
        var remove = button('×', function () { c.selected = false; persist(); render(); }, 'ob-remove'); remove.setAttribute('aria-label', 'Remove ' + item.title); row.appendChild(remove); section.appendChild(row);
      }); body.appendChild(section);
    });
    var custom = node('details', { class: 'ob-custom' }, [node('summary', { text: '+ Create an Avrit of your own' })]);
    var name = node('input', { id: 'ob-custom-name', class: 'field', maxlength: '80', placeholder: 'e.g. Clean my bicycle' });
    var days = node('input', { id: 'ob-custom-days', class: 'field', type: 'number', min: '1', max: '3650', inputmode: 'numeric', placeholder: 'e.g. 14' });
    custom.appendChild(field('Give it a name', name)); custom.appendChild(field('Repeat every … days', days));
    custom.appendChild(button('Add my own Avrit', function () {
      var c = { selected: true, days: Number(days.value), mode: 'start', date: '', first: '' };
      if (!name.value.trim()) { message('Give your Avrit a name first.'); name.focus(); return; }
      if (valid(c)) { message(valid(c)); days.focus(); return; }
      var id = 'own-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      draft.custom.push({ id: id, category: 'custom', title: name.value.trim(), icon: '✳', headline: 'A little care, your way.', description: 'Your personal Avrit. Give it a rhythm that works for you.', days: c.days, options: [], tip: 'Make it small enough to finish and easy to return to.' });
      draft.choices[id] = c; persist(); render();
    })); body.appendChild(custom);
    body.appendChild(node('p', { class: 'ob-note', text: 'You’ll see due dates when you open Avrit. After you log Done, the next date follows your chosen interval. Change or remove an Avrit any time.' }));
    var save = button(existing.length ? 'Save profile & add chosen Avrits →' : 'Build my dashboard · ' + selected().length + ' Avrits →', complete, 'ob-primary'); save.disabled = !selected().length && !existing.length; footer.appendChild(save);
    footer.appendChild(button('← Explore more ideas', function () { go('areas'); }));
  }
  function complete() {
    if (busy || (!selected().length && !existing.length)) return;
    var additions = [];
    for (var id of selected()) {
      var item = template(id), c = choice(item), error = valid(c);
      if (error) { message(item.title + ': ' + error); return; }
      // Existing reminders, dates, logs and photos always win over a setup template.
      if (alreadyAdded(id)) continue;
      additions.push({ id: 'avrit-' + id, templateId: id, kind: ['nail','haircut'].indexOf(id) !== -1 ? id : 'custom', title: item.title,
        category: item.category, symbol: item.icon, intervalDays: Number(c.days), lastDone: c.mode === 'last' ? c.date : '',
        firstDueAt: c.mode === 'last' ? '' : nextDate(c), scheduleStartedAt: c.mode === 'start' ? today() : '', logs: c.mode === 'last' ? [{ date: c.date, note: '', photoId: null }] : [] });
    }
    var items = existing.concat(additions), profile = Object.assign({}, draft.profile, { name: draft.profile.name.trim() });
    try { localStorage.setItem(STORE, JSON.stringify({ version: 1, items: items, profile: profile, onboardingComplete: true })); }
    catch (err) { message('Could not save your dashboard. Your choices are still here. Free some device storage and try again.'); return; }
    try { localStorage.removeItem(KEY); } catch (err) { /* successful atomic dashboard save is authoritative */ }
    var removed = (oldProfile.photos || []).filter(function (id) { return profile.photos.indexOf(id) === -1; });
    if (removed.length) photos.remove(removed).catch(function () {});
    close(); finish(items, profile, additions.length);
  }
  function close() { if (busy) return; cleanUrls(); host.remove(); document.querySelector('.app').hidden = false; document.getElementById('more-btn').focus(); }
  window.AvritOnboarding = { start: start };
})();
