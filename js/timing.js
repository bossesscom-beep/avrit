(function () {
  'use strict';
  function node(tag, text, cls) { var n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; }
  function button(text, action, cls) { var n = node('button', text, cls || 'ob-secondary'); n.type = 'button'; n.onclick = action; return n; }
  function create(item, options) {
    var ai = window.AvritAI;
    var section = node('details', '', 'ai-timing');
    section.appendChild(node('summary', '✦ Find a rhythm for me'));
    if (item.category === 'health' || /\b(checkup|check-up|medical|medication|medicine|prescription|therapy|screening|blood test|vaccin)/i.test(item.title)) {
      section.appendChild(node('p', 'Your care deserves timing that is right for you. Use the interval agreed with your clinician, then let Avrit keep the date close.', 'quiet'));
      return section;
    }
    section.appendChild(node('p', 'A little context helps make the timing feel like yours.', 'quiet'));
    var label = node('label', '', 'field-label'); label.appendChild(node('span', 'What should the suggestion take into account?'));
    var context = node('textarea', '', 'field'); context.maxLength = 500; context.rows = 2;
    context.placeholder = item.category === 'self' ? 'e.g. My hair is short and I like a neat shape.' : item.category === 'wardrobe' ? 'e.g. I wear these shoes every day on dusty streets.' : item.category === 'home' ? 'e.g. This bathroom is shared by three people.' : 'e.g. I prefer a small task on a quiet weekend.';
    label.appendChild(context); section.appendChild(label);
    var tips = item.category === 'self' ? ['Keep it low-maintenance', 'I like a regular refresh'] : item.category === 'home' || item.category === 'wardrobe' ? ['Used every day', 'Used occasionally', 'Keep each task small'] : ['A monthly reset', 'Keep it low-effort'];
    var chips = node('div', '', 'ai-context-chips');
    tips.forEach(function (text) { chips.appendChild(button(text, function () { context.value = text; context.dispatchEvent(new Event('input', { bubbles: true })); }, 'ai-context-chip')); }); section.appendChild(chips);
    var status = node('p', '', 'quiet feature-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    var result = node('div', '', 'ai-timing-result');
    if (!ai.ready()) {
      section.appendChild(node('p', ai.serviceOrigin() ? 'Connect Gemini in Settings to personalise this timing. You can use the editable starting point above for now.' : 'AI suggestions are being prepared for Avrit. The timing above is an editable starting point, not an AI estimate.', 'quiet'));
      context.disabled = true; chips.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      return section;
    }
    section.appendChild(node('p', 'Send only this Avrit’s name, category and the context you enter to Google Gemini through Avrit. Your profile, gender, photos and other routines stay here.', 'ai-sharing'));
    var ask = button('✦ Ask AI for timing', async function () {
      ask.disabled = true; context.disabled = true; chips.querySelectorAll('button').forEach(function (b) { b.disabled = true; }); ask.setAttribute('aria-busy', 'true');
      status.textContent = 'Finding a comfortable rhythm…'; result.replaceChildren();
      try {
        var suggestion = await ai.suggest({ task: 'schedule', text: item.title, category: item.category || 'custom', templateId: item.templateId || (window.AvritCatalog.get(item.id) ? item.id : ''), context: context.value.trim() });
        if (!section.isConnected) return;
        if (!suggestion || typeof suggestion.reason !== 'string' || !suggestion.reason.trim() || suggestion.reason.length > 600 || typeof suggestion.note !== 'string' || suggestion.note.length > 500 || !(suggestion.intervalDays === null || Number.isInteger(suggestion.intervalDays) && suggestion.intervalDays >= 1 && suggestion.intervalDays <= 3650)) throw new Error('That suggestion was incomplete. Your timing has not changed. Try again.');
        result.appendChild(node('p', 'GEMINI SUGGESTION · REVIEW BEFORE USING', 'eyebrow'));
        result.appendChild(node('h3', suggestion.intervalDays ? 'Try every ' + suggestion.intervalDays + ' days' : 'A little more context first'));
        if (suggestion.intervalDays && options.previewDate) {
          var next = options.previewDate(suggestion.intervalDays);
          if (next) result.appendChild(node('p', 'Next reminder: ' + next, 'ai-next-date'));
        }
        result.appendChild(node('p', suggestion.reason, 'quiet'));
        if (suggestion.note) result.appendChild(node('p', suggestion.note, 'ai-nice-suggestion'));
        if (suggestion.intervalDays) result.appendChild(button('Use this timing · ' + suggestion.intervalDays + ' days', function () {
          if (options.onUse(suggestion.intervalDays) === false) { status.textContent = 'Could not save that timing. Please try again.'; return; }
          status.textContent = 'Timing chosen. You can change it whenever life changes.';
        }, 'done'));
        status.textContent = suggestion.intervalDays ? 'An estimate, not a rule. Your current timing stays unchanged until you choose to use it.' : 'Your current timing is unchanged.';
      } catch (err) { if (section.isConnected) status.textContent = (err.message || 'AI is unavailable right now.') + ' You can still choose your own timing.'; }
      finally { ask.disabled = false; context.disabled = false; chips.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); ask.removeAttribute('aria-busy'); }
    }, 'ai-ask');
    section.append(ask, status, result);
    return section;
  }
  window.AvritTiming = { create: create };
})();
