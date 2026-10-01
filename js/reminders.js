(function () {
  var pending = {}, sequence = 0, syncQueue = Promise.resolve();
  function available() {
    return !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.avritReminders) || !!window.AvritReminders;
  }
  window.AvritReminderReply = function (reply) {
    var request = pending[reply.id];
    if (!request) return;
    delete pending[reply.id];
    clearTimeout(request.timer);
    if (reply.error) request.reject(new Error(reply.error));
    else request.resolve(reply);
  };
  function call(action, extra) {
    return new Promise(function (resolve, reject) {
      if (!available()) { reject(new Error('Device reminders are unavailable.')); return; }
      var id = ++sequence;
      pending[id] = { resolve: resolve, reject: reject, timer: setTimeout(function () {
        delete pending[id]; reject(new Error('Your device did not respond. Please try again.'));
      }, action === 'request' ? 120000 : 15000) };
      var message = Object.assign({ id: id, action: action }, extra || {});
      try {
        if (window.AvritReminders) window.AvritReminders.postMessage(JSON.stringify(message));
        else window.webkit.messageHandlers.avritReminders.postMessage(message);
      } catch (error) { clearTimeout(pending[id].timer); delete pending[id]; reject(error); }
    });
  }
  function time() {
    try { var value = localStorage.getItem('avrit.reminder-time') || '09:00'; return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '09:00'; }
    catch (error) { return '09:00'; }
  }
  function plan(items, clock) {
    var parts = (clock || time()).split(':');
    return items.map(function (item) {
      var schedule = window.AvritEngine.suggest(item);
      if (!schedule.nextAt) return null;
      // Engine days are UTC calendar dates; notification time is local wall time.
      var day = window.AvritEngine.formatDay(schedule.nextAt).split('-').map(Number);
      return { id: item.id, title: item.title || 'Your Avrit', at: new Date(day[0], day[1] - 1, day[2], Number(parts[0]), Number(parts[1])).getTime() };
    }).filter(Boolean).sort(function (a, b) { return a.at - b.at; }).slice(0, 60);
  }
  window.AvritDeviceReminders = {
    available: available, call: call, time: time, plan: plan,
    sync: function (items) {
      var payload = plan(items);
      // Permission callbacks, saves and resume may overlap; preserve their order.
      syncQueue = syncQueue.catch(function () {}).then(function () { return call('sync', { items: payload }); });
      return syncQueue;
    }
  };
}());
