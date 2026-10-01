(function () {
  var engine = window.AvritEngine;
  var guides = window.AvritGuides;
  var gesture = window.AvritGesture;
  var STORE = "avrit.items.v1";
  var state = {
    items: [],
    profile: {},
    onboardingComplete: false,
    filter: "all",
    view: "home",
    detailId: null,
    listY: 0,
    listV: 0,
    pulseId: "",
    armedRemove: false,
    pointerX: 0,
    pointerShift: 0
  };
  var drag = null;
  var coastToken = 0;
  var swallowUntil = 0;
  var notified = {};
  var audioCtx = null;
  var reduced = false;
  var renderedView = null;
  var statusTimer = 0;
  var notificationBusy = false;
  var notificationMessage = "";
  var devicePermission = "loading";
  var deviceScheduled = 0;
  function deviceReminders() { return window.AvritDeviceReminders && window.AvritDeviceReminders.available(); }
  function syncDeviceReminders() {
    if (!deviceReminders()) return;
    window.AvritDeviceReminders.sync(state.items).then(function (reply) {
      devicePermission = reply.permission; deviceScheduled = reply.scheduled || 0;
      if (state.view === "more") render();
    }, function (error) { notificationMessage = error.message; if (state.view === "more") render(); });
  }

  function boot() {
    try {
      reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (err) { reduced = false; }
    var savedItems = readItems();
    state.items = savedItems || (window.AvritOnboarding ? [] : engine.builtinItems());
    var more = document.getElementById("more-btn");
    more.addEventListener("click", function () {
      state.view = state.view === "more" ? "home" : "more";
      state.detailId = null;
      render();
    });
    document.getElementById("viewport").addEventListener("pointerdown", onPointerDown);
    document.getElementById("viewport").addEventListener("click", onClick);
    document.querySelector(".bottom-nav").addEventListener("click", onClick);
    document.getElementById("viewport").addEventListener("keydown", onKeyDown);
    document.getElementById("viewport").addEventListener("wheel", onWheel, { passive: false });
    if (window.matchMedia) window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", function (event) {
      reduced = event.matches;
      if (reduced) { coastToken += 1; state.listY = clamp(state.listY, listBounds().min, 0); state.pointerX = 0; state.pointerShift = 0; applyMotion(); }
    });
    window.addEventListener("resize", function () {
      state.listY = clamp(state.listY, listBounds().min, 0);
      applyMotion();
    });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("pointermove", shiftSky);
    render();
    if (savedItems === null && window.AvritOnboarding) beginOnboarding();
    raiseDue();
    syncDeviceReminders();
    window.setInterval(raiseDue, 30000);
    document.addEventListener("visibilitychange", raiseDue);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) syncDeviceReminders(); });
    window.addEventListener("avrit-device-resume", syncDeviceReminders);
  }

  function readItems() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return null;
      state.profile = parsed.profile || {};
      state.onboardingComplete = !!parsed.onboardingComplete;
      return parsed.items;
    } catch (err) { return null; }
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ version: 1, items: state.items, profile: state.profile, onboardingComplete: state.onboardingComplete })); syncDeviceReminders(); return true; }
    catch (err) { setStatus("Could not save. Free some device storage and try again."); return false; }
  }

  function commit(item) {
    var previous = state.items;
    replace(item);
    if (save()) return true;
    state.items = previous;
    return false;
  }

  function find(id) {
    for (var i = 0; i < state.items.length; i += 1) {
      if (state.items[i].id === id) return state.items[i];
    }
    return null;
  }

  function replace(item) {
    state.items = state.items.map(function (current) {
      return current.id === item.id ? item : current;
    });
  }

  function todayValue() {
    return engine.formatDay(engine.calendarDay(new Date()));
  }

  function printedBeforeToday(schedule) {
    if (!schedule || !schedule.nextAt) return false;
    return engine.formatDay(schedule.nextAt) < todayValue();
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "class") node.className = attrs[key];
      else if (key === "text") node.textContent = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function icon(kind) {
    var paths = {
      nail: ["M8 17v-6a2 2 0 0 1 4 0V6a2 2 0 0 1 4 0v5a2 2 0 0 1 4 0v4c0 4-2 6-6 6-3 0-5-1-7-4l-3-4a2 2 0 0 1 3-2l1 1"],
      haircut: ["M5 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z", "M5 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z", "M8 9l12 11M8 15 20 4"],
      ac: ["M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7", "m9 4 3 3 3-3M9 20l3-3 3 3M3 10l4-1-1-4M21 14l-4 1 1 4M3 14l4 1-1 4M21 10l-4-1 1-4"],
      battery: ["M3 7h17v13H3zM6 4h3v3M14 4h3v3M6 13h4M8 11v4M14 13h3"],
      insurance: ["M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z", "m8 12 3 3 5-6"],
      custom: ["M12 3v18M3 12h18", "M6 6l12 12M6 18 18 6"]
    };
    var host = el("span", { class: "item-icon", "aria-hidden": "true" });
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    (paths[kind] || paths.custom).forEach(function (d) {
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    });
    host.appendChild(svg);
    return host;
  }

  function field(label, input) {
    return el("label", { class: "field-label" }, [el("span", { text: label }), input]);
  }

  function render() {
    var stage = document.getElementById("stage");
    var changedView = renderedView !== state.view;
    var oldSheet = document.getElementById("sheet");
    var openOptions = !changedView && document.getElementById("item-options") && document.getElementById("item-options").open;
    var scroll = !changedView && oldSheet ? oldSheet.scrollTop : 0;
    var focused = document.activeElement;
    var focusId = !changedView && focused ? focused.id : "";
    var focusAction = !changedView && focused ? focused.getAttribute("data-action") : "";
    var focusItem = !changedView && focused ? focused.getAttribute("data-id") : "";
    coastToken += 1;
    stage.textContent = "";
    document.getElementById("home-intro").hidden = state.view !== "home";
    document.getElementById("today-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    document.getElementById("nav-home").setAttribute("aria-current", state.view === "home" || state.view === "detail" ? "page" : "false");
    document.getElementById("nav-more").setAttribute("aria-current", state.view === "more" ? "page" : "false");
    if (state.view === "detail") stage.appendChild(renderDetail());
    else if (state.view === "more") stage.appendChild(renderMore());
    else if (state.view === "add") stage.appendChild(renderAdd());
    else stage.appendChild(renderHome());
    window.AvritFeatures.mount(state.view, find(state.detailId), {
      find: find, commit: commit, render: render, status: setStatus, today: todayValue,
      haptic: function () { hapticClick("success"); }
    });
    raiseDueLabels();
    if (openOptions && document.getElementById("item-options")) document.getElementById("item-options").open = true;
    if (state.view !== "home") {
      stage.firstChild.scrollTop = scroll;
      if (changedView) springIn(stage.firstChild);
    } else {
      state.listY = clamp(state.listY, listBounds().min, 0);
      applyMotion();
      if (changedView) stage.firstChild.classList.add("entering");
    }
    if (changedView && renderedView !== null) {
      var heading = stage.querySelector("h2") || stage.querySelector("[data-action='open']");
      if (heading) { if (heading.tagName === "H2") heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
    } else if (focusId || focusAction) {
      var target = focusId ? document.getElementById(focusId) : Array.prototype.find.call(stage.querySelectorAll("[data-action]"), function (node) {
        return node.getAttribute("data-action") === focusAction && node.getAttribute("data-id") === focusItem;
      });
      if (target) target.focus({ preventScroll: true });
    }
    renderedView = state.view;
  }

  function renderHome() {
    var stack = el("div", { class: "stack", id: "stack" });
    var shown = todayValue();
    var visibleItems = state.items.filter(function (item) {
      if (state.filter === 'all') return true;
      if (state.filter === 'due') return engine.reminderFor(item, new Date()).due;
      if (state.filter === 'upcoming') return engine.suggest(item).nextAt && !engine.reminderFor(item, new Date()).due;
      return item.category === state.filter;
    });
    if (!state.items.length) {
      stack.appendChild(el("section", { class: "empty-state" }, [
        el("h2", { text: "Make room for a rhythm." }),
        el("p", { class: "quiet", text: "Something for you, your home, or whatever needs a little care." }),
        el("button", { class: "done", type: "button", "data-action": "add", text: "＋ Add a reminder" })
      ]));
    }
    if (state.items.length && !visibleItems.length) stack.appendChild(el('section', { class: 'empty-state' }, [el('h2', { text: 'A little breathing room.' }), el('p', { class: 'quiet', text: 'Nothing here right now.' }), el('button', { class: 'text-btn', type: 'button', 'data-action': 'show-all', text: 'See all my Avrits →' })]));
    visibleItems.forEach(function (item, index) {
      var schedule = engine.suggest(item, { useRemote: false });
      var due = engine.reminderFor(item, new Date(), { useRemote: false }).due;
      var overdue = due && printedBeforeToday(schedule);
      var card = el("article", {
        class: "card" + (due ? " is-due" : "") + (overdue ? " is-overdue" : "") + (state.pulseId === item.id ? " is-ack" : ""),
        "data-item": item.id, "data-kind": item.kind, "aria-label": item.title
      });
      var main = el("div", { class: "card-main", role: "button", tabindex: "0", "data-action": "open", "data-item": item.id, "aria-label": "Open " + item.title + " details" });
      var category = window.AvritCatalog && window.AvritCatalog.group(item.category);
      if (category) card.style.setProperty('--tint', category.color);
      main.appendChild(item.symbol ? el("span", { class: "item-icon catalog-icon", "aria-hidden": "true", text: item.symbol }) : icon(item.kind));
      main.appendChild(el("p", { class: "kicker", text: item.title }));
      var next = el("p", { class: "next", "data-next-due": item.id, text: schedule.nextAt ? engine.prettyDate(schedule.nextAt) : "Start a rhythm" });
      main.appendChild(next);
      main.appendChild(el("p", { class: "meta", text: item.lastDone ? "Last done " + engine.prettyDate(engine.calendarDay(item.lastDone)) : item.firstDueAt ? "Every " + item.intervalDays + " days · First completion ahead" : "Log today, or choose a past date ↗" }));
      card.appendChild(main);
      var foot = el("div", { class: "card-foot" });
      if (state.filter === 'all') foot.appendChild(el("button", { class: "grip", type: "button", "data-grip": "1", "data-id": item.id, "aria-label": "Move " + item.title, title: "Drag to reorder. Use arrow keys when focused.", text: "⠿" }));
      foot.appendChild(el("span", { class: "card-state", text: state.pulseId === item.id ? "A little care. Taken care of." : overdue ? "Overdue · ready when you are" : due ? "Due today" : schedule.nextAt ? "Next time is set" : "Your first log awaits" }));
      foot.appendChild(el("button", {
        class: "done" + (state.pulseId === item.id ? " is-clicked" : ""), type: "button", "data-action": "done", "data-id": item.id, "data-shown": shown,
        "aria-label": "Log " + item.title + " as done today", text: state.pulseId === item.id ? "✓ Logged" : "✓ Done"
      }));
      card.appendChild(foot);
      stack.appendChild(el("div", { class: "card-wrap", style: "--index:" + Math.min(index, 5) }, [card]));
    });
    return stack;
  }

  function renderDetail() {
    var item = find(state.detailId) || state.items[0];
    var guide = guides.getGuide(item.kind) || guides.getGuide("custom");
    var schedule = engine.suggest(item, { useRemote: false });
    var due = engine.reminderFor(item, new Date(), { useRemote: false }).due;
    var sheet = el("section", { class: "sheet" + (due ? " is-due" : ""), id: "sheet", "data-kind": item.kind });
    sheet.appendChild(el("button", { class: "back", type: "button", "data-action": "home", text: "← My rhythms" }));
    var hero = el("div", { class: "detail-hero" }, [icon(item.kind), el("h2", { text: item.title })]);
    hero.appendChild(el("p", { class: "eyebrow", text: schedule.nextAt ? "Next up" : "A fresh start" }));
    hero.appendChild(el("p", { class: "next", "data-next-due": item.id, text: schedule.nextAt ? engine.prettyDate(schedule.nextAt) : "Whenever you’re ready." }));
    hero.appendChild(el("p", { class: "reason", text: schedule.reason }));
    hero.appendChild(el("button", { class: "done", type: "button", "data-action": "done", "data-id": item.id, "data-shown": todayValue(), text: "✓ Done today" }));
    sheet.appendChild(hero);
    if (window.AvritTiming) sheet.appendChild(window.AvritTiming.create(item, { previewDate: function (days) {
      var next = engine.suggest(engine.setUserInterval(item, days)).nextAt;
      return next ? engine.prettyDate(next) : '';
    }, onUse: function (days) {
      var updated = engine.setUserInterval(find(item.id), days);
      if (!commit(updated)) return false;
      render(); setStatus('Your timing is now ' + days + ' days.'); return true;
    } }));
    var dateRow = el("div", { class: "row" }, [
      el("input", { class: "field", id: "when", type: "date", value: item.lastDone || todayValue(), "aria-label": "Last done date" }),
      el("button", { class: "done", type: "button", "data-action": "save-date", "data-id": item.id, text: "Save date" })
    ]);
    sheet.appendChild(field("Or log a different day", dateRow));
    var guidePanel = el("details", { class: "guide" });
    guidePanel.appendChild(el("summary", { text: "A little know-how" }));
    [["how-to", "How to"], ["method", "Recommended method"], ["medical", "Medical fact"], ["surprising", "Did you know?"], ["practical", "Practical guidance"]].forEach(function (pair) {
      var claims = guide.claims.filter(function (claim) { return claim.role === pair[0]; });
      if (!claims.length) return;
      var block = el("div", { class: "block" }, [el("h3", { text: pair[1] })]);
      claims.forEach(function (claim) {
        block.appendChild(el("p", { class: "claim", text: claim.text + " " }, [el("a", { href: claim.sourceUrl, text: claim.sourceName, target: "_blank", rel: "noopener" })]));
      });
      guidePanel.appendChild(block);
    });
    sheet.appendChild(guidePanel);
    var options = el("details", { class: "guide", id: "item-options" });
    options.appendChild(el("summary", { text: "Adjust this rhythm" }));
    var gapRow = el("div", { class: "row" }, [
      el("input", { class: "field", id: "gap", type: "number", min: "1", max: "3650", inputmode: "numeric", value: item.intervalDays || schedule.intervalDays || "", "aria-label": "Interval in days" }),
      el("button", { class: "done", type: "button", "data-action": "save-gap", "data-id": item.id, text: "Save interval" })
    ]);
    options.appendChild(field("Days between reminders", gapRow));
    if (!item.templateId) options.appendChild(el("button", { class: "text-btn", type: "button", "data-action": "clear-gap", "data-id": item.id, text: "Use Avrit’s suggestion" }));
    options.appendChild(el("button", { class: "text-btn danger", type: "button", "data-action": state.armedRemove ? "confirm-remove" : "arm-remove", "data-id": item.id, text: state.armedRemove ? "Confirm remove" : "Remove this rhythm" }));
    if (state.armedRemove) options.open = true;
    sheet.appendChild(options);
    return sheet;
  }

  function renderMore() {
    var sheet = el("section", { class: "sheet", id: "sheet" });
    sheet.appendChild(el("button", { class: "back", type: "button", "data-action": "home", text: "← My rhythms" }));
    sheet.appendChild(el("h2", { text: "Your kind of rhythm." }));
    sheet.appendChild(el("p", { class: "quiet", text: "A few small settings. Then back to your day." }));
    if (window.AvritOnboarding) sheet.appendChild(el("button", { class: "done", type: "button", "data-action": "onboarding", text: "Your profile & Avrit collection →" }));
    var reminders = el("div", { class: "settings-block" }, [el("h3", { text: "Reminders" })]);
    reminders.appendChild(el("p", { class: "quiet", id: "notify-note", text: notifyNote() }));
    var permission = notificationPermission();
    if (permission === "default" || permission === "granted") {
      var notificationButton = el("button", { class: "done", type: "button", "data-action": permission === "granted" ? "test-notify" : "notify", text: notificationBusy ? "Waiting for permission…" : permission === "granted" ? "Send a test notification" : "Allow notifications →" });
      notificationButton.disabled = notificationBusy;
      reminders.appendChild(notificationButton);
    }
    reminders.appendChild(el("p", { class: "quiet", id: "notification-feedback", role: "status", text: notificationMessage }));
    if (deviceReminders()) {
      reminders.appendChild(el("button", { class: "text-btn", type: "button", "data-action": "refresh-device-reminders", text: "Refresh scheduled alerts" }));
      reminders.appendChild(field("Reminder time", el("input", { class: "field", id: "reminder-time", type: "time", value: window.AvritDeviceReminders.time(), "aria-label": "Reminder time" })));
      reminders.appendChild(el("button", { class: "text-btn", type: "button", "data-action": "save-reminder-time", text: "Save reminder time" }));
      reminders.appendChild(el("button", { class: "text-btn", type: "button", "data-action": "notification-settings", text: "Open device notification settings →" }));
    }
    reminders.appendChild(el("button", { class: "text-btn", type: "button", "data-action": "show-due", text: "See what needs care →" }));
    sheet.appendChild(reminders);
    var feel = el("div", { class: "settings-block" }, [el("h3", { text: "The little details" })]);
    feel.appendChild(el("button", { class: "preference", type: "button", "data-action": "toggle-sound", "aria-pressed": String(soundEnabled()), text: "Soft sounds", "data-value": soundEnabled() ? "On" : "Off" }));
    feel.appendChild(el("p", { class: "quiet", text: "A soft click for a small moment of care. Touch feedback follows your device’s settings." }));
    sheet.appendChild(feel);
    var advanced = el("details", { class: "guide" });
    advanced.appendChild(el("summary", { text: "Optional extras" }));
    advanced.appendChild(el("button", { class: "text-btn", type: "button", "data-action": "restore", text: "Restore the five starter rhythms" }));
    sheet.appendChild(advanced);
    sheet.appendChild(el("p", { class: "quiet", text: "Avrit · A little care, on repeat." }));
    return sheet;
  }

  function renderAdd() {
    var sheet = el("section", { class: "sheet", id: "sheet" });
    sheet.appendChild(el("button", { class: "back", type: "button", "data-action": "home", text: "← My rhythms" }));
    sheet.appendChild(el("h2", { text: "Make it a rhythm." }));
    sheet.appendChild(el("p", { class: "quiet", text: "From watering a plant to changing a filter. Give it a name; we’ll keep its place." }));
    if (window.AvritOnboarding) sheet.appendChild(el("button", { class: "text-btn", type: "button", "data-action": "onboarding", text: "Explore 28 Avrit ideas →" }));
    sheet.appendChild(field("What needs a little care?", el("input", { class: "field", id: "custom-name", type: "text", placeholder: "e.g. Water the plants", maxlength: "80", "aria-label": "Item name" })));
    sheet.appendChild(field("When did you last do it?", el("input", { class: "field", id: "custom-when", type: "date", value: todayValue(), "aria-label": "Last done" })));
    sheet.appendChild(field("Repeat every … days", el("input", { class: "field", id: "custom-gap", type: "number", min: "1", max: "3650", inputmode: "numeric", placeholder: "Optional", "aria-label": "Interval in days" })));
    sheet.appendChild(el("button", { class: "done", type: "button", "data-action": "create", text: "＋ Add to my rhythms" }));
    sheet.appendChild(el("p", { class: "quiet", id: "add-note", role: "alert", text: "" }));
    return sheet;
  }

  function notifyNote() {
    var permission = notificationPermission();
    if (deviceReminders()) {
      if (permission === "loading") return "Checking your device’s notification settings…";
      if (permission === "granted") return deviceScheduled + " upcoming alerts scheduled on this device, including while Avrit is closed. Due Avrits get one alert; logging Done schedules the next. Your device may delay delivery.";
      if (permission === "denied") return "Notifications are off for Avrit. Open device notification settings to allow alerts.";
      return "Let Avrit send a gentle notification on each due date, even when the app is closed. Choose a time that suits your day.";
    }
    if (permission === "unavailable") return "This browser or app does not support system notifications here. Open Avrit to see your due reminders; alerts will not arrive while it is closed.";
    if (permission === "granted") return "Notifications are allowed while this page is open. Closing Avrit stops these alerts. Your dashboard keeps every due date.";
    if (permission === "denied") return "Notifications are blocked. Change the notification permission for Avrit in your browser’s site settings, then return here. Your dashboard still shows what is due.";
    return "Allow a notification when an Avrit is due while this page is open. Alerts will not arrive after you close it.";
  }

  function notificationPermission() {
    if (deviceReminders()) return devicePermission;
    var secure = window.isSecureContext === true || location.protocol === "https:" ||
      (location.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].indexOf(location.hostname) !== -1);
    return secure && window.Notification && typeof Notification.requestPermission === "function" ? Notification.permission : "unavailable";
  }

  function onClick(event) {
    if (performance.now() < swallowUntil) {
      swallowUntil = 0;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    var actionNode = event.target.closest("[data-action]");
    if (!actionNode) return;
    var action = actionNode.getAttribute("data-action");
    var id = actionNode.getAttribute("data-id");
    if (action === "onboarding") { beginOnboarding(); return; }
    if (action === "done") {
      event.preventDefault();
      logDone(id, actionNode);
      return;
    }
    if (action === "open") {
      hapticClick("selection");
      if (event.target.closest("[data-grip], [data-action='done']")) return;
      openDetail(actionNode.getAttribute("data-item"));
      return;
    }
    if (action === "toggle-sound") {
      try { localStorage.setItem("avrit.sound", soundEnabled() ? "off" : "on"); }
      catch (err) { setStatus("Could not save your sound preference. Free some device storage and try again."); return; }
      render();
      setStatus(soundEnabled() ? "Soft sounds on." : "Soft sounds off.");
      return;
    }
    if (action === "home") { goHome(); return; }
    if (action === "more") { state.view = "more"; render(); return; }
    if (action === "add") { state.view = "add"; render(); return; }
    if (action === "arm-remove") {
      state.armedRemove = true;
      render();
      var confirm = document.querySelector("[data-action='confirm-remove']");
      if (confirm && confirm.scrollIntoView) confirm.scrollIntoView({ block: "center" });
      return;
    }
    if (action === "confirm-remove") { removeItem(id); return; }
    if (action === "save-date") { saveDate(id); return; }
    if (action === "save-gap") { saveGap(id); return; }
    if (action === "clear-gap") { clearGap(id); return; }
    if (action === "notify") { askNotify(); return; }
    if (action === "notification-settings") {
      window.AvritDeviceReminders.call("settings").catch(function (error) { notificationMessage = error.message; render(); }); return;
    }
    if (action === "refresh-device-reminders") { notificationMessage = ""; syncDeviceReminders(); return; }
    if (action === "save-reminder-time") {
      var clock = document.getElementById("reminder-time").value;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) { setStatus("Choose a reminder time first."); return; }
      try { localStorage.setItem("avrit.reminder-time", clock); notificationMessage = "Reminder time saved."; syncDeviceReminders(); }
      catch (error) { setStatus("Could not save your reminder time. Please try again."); }
      return;
    }
    if (action === "test-notify") { testNotify(); return; }
    if (action === "show-due") { state.filter = "due"; state.listY = 0; goHome(); return; }
    if (action === "show-all") { state.filter = "all"; state.listY = 0; goHome(); return; }
    if (action === "restore") { restoreBuiltins(); return; }
    if (action === "create") { createItem(); }
  }

  function goHome() {
    state.view = "home";
    state.detailId = null;
    state.armedRemove = false;
    state.listV = 0;
    render();
  }

  function beginOnboarding() {
    window.AvritOnboarding.start(state.items, state.profile, function (items, profile, added) {
      state.items = items; state.profile = profile; state.onboardingComplete = true;
      syncDeviceReminders();
      state.listY = 0; state.filter = 'all'; goHome();
      setStatus(added + " Avrit" + (added === 1 ? "" : "s") + " added. A little care, on repeat.");
    });
  }

  function openDetail(id) {
    state.view = "detail";
    state.detailId = id;
    state.armedRemove = false;
    render();
  }

  function logDone(id, button) {
    var item = find(id);
    if (!item) return;
    var shown = button && button.getAttribute("data-shown") ? button.getAttribute("data-shown") : todayValue();
    var nextItem = window.AvritJournal.record(item, shown);
    if (!commit(nextItem)) return;
    feedbackFromGesture(button);
    state.pulseId = id;
    var schedule = engine.suggest(nextItem, { useRemote: false });
    setStatus(nextItem.title + " logged. Next is " + engine.prettyDate(schedule.nextAt) + ".");
    render();
    window.setTimeout(function () {
      if (state.pulseId === id) {
        state.pulseId = "";
        var card = document.querySelector('[data-item="' + id + '"]');
        if (card) {
          card.classList.remove("is-ack");
          var caption = card.querySelector(".card-state");
          if (caption) caption.textContent = "Next time is set";
        }
      }
        var button = document.querySelector('[data-action="done"][data-id="' + id + '"]');
        if (button && state.view === "home") { button.textContent = "✓ Done"; button.classList.remove("is-clicked"); }
      }, 1100);
  }

  function saveDate(id) {
    var input = document.getElementById("when");
    if (!input || !input.value) return;
    feedbackFromGesture(document.querySelector("[data-action='save-date']"));
    if (input.value > todayValue()) { setStatus("Choose today or an earlier day."); return; }
    var item = window.AvritJournal.record(find(id), input.value);
    if (!commit(item)) return;
    setStatus("Date saved. Next is " + engine.prettyDate(engine.suggest(item, { useRemote: false }).nextAt) + ".");
    render();
  }

  function saveGap(id) {
    var input = document.getElementById("gap");
    var item = engine.setUserInterval(find(id), input.value);
    if (!engine.hasUserInterval(item)) return;
    feedbackFromGesture(document.querySelector("[data-action='save-gap']"));
    if (!commit(item)) return;
    render();
  }

  function clearGap(id) {
    var item = engine.clearUserInterval(find(id));
    if (!commit(item)) return;
    render();
  }

  async function removeItem(id) {
    var item = find(id);
    if (!item) return;
    var hasPhotos = window.AvritJournal.logs(item).some(function (entry) { return !!entry.photoId; });
    try {
      if (hasPhotos) await window.AvritFeatures.removePhotos(item);
      var previous = state.items;
      state.items = state.items.filter(function (value) { return value.id !== id; });
      if (!save()) { state.items = previous; return; }
      state.armedRemove = false;
      goHome();
    } catch (_) { setStatus("Could not remove its photos. Please try again."); }
  }

  function createItem() {
    var name = document.getElementById("custom-name");
    var when = document.getElementById("custom-when");
    var gap = document.getElementById("custom-gap");
    var item = engine.createCustom({
      title: name.value,
      lastDone: when.value,
      intervalDays: gap.value
    });
    var note = document.getElementById("add-note");
    if (!item) {
      if (note) note.textContent = "Name it first.";
      return;
    }
    feedbackFromGesture(document.querySelector("[data-action='create']"));
    var previous = state.items;
    state.items = state.items.concat([item]);
    if (!save()) { state.items = previous; return; }
    state.filter = 'all';
    goHome();
    state.listY = listBounds().min;
    applyMotion();
    setStatus(item.title + " added. Its next time is set.");
  }

  function askNotify() {
    if (notificationBusy || notificationPermission() !== "default") return;
    notificationBusy = true;
    notificationMessage = "Choose Allow in your browser’s permission prompt.";
    if (deviceReminders()) {
      notificationMessage = "Choose Allow in your device’s permission prompt.";
      render();
      window.AvritDeviceReminders.call("request").then(function (reply) {
        notificationBusy = false; devicePermission = reply.permission;
        notificationMessage = devicePermission === "granted" ? "Notifications enabled. Scheduling your Avrits…" : "Notifications are off. You can enable them in device settings.";
        syncDeviceReminders(); if (state.view === "more") render();
      }, notificationFailure);
      return;
    }
    try {
      var request = Notification.requestPermission();
      render();
      Promise.resolve(request).then(function () {
        notificationBusy = false;
        notificationMessage = notificationPermission() === "granted" ? "Notifications enabled. You can send a test below." : notificationPermission() === "denied" ? "Permission was blocked. You can change it in site settings." : "Permission was not granted. Tap Allow notifications to try again.";
        if (state.view === "more") render();
        raiseDue();
      }, notificationFailure);
    } catch (err) { notificationFailure(); }
  }

  function notificationFailure() {
    notificationBusy = false;
    notificationMessage = "The browser could not enable notifications. Check its site permissions and try again.";
    if (state.view === "more") render();
  }

  function testNotify() {
    if (deviceReminders()) {
      window.AvritDeviceReminders.call("test").then(function () {
        notificationMessage = "Test requested. Check your notification centre in a few seconds."; render();
      }, function (error) { notificationMessage = error.message; render(); });
      return;
    }
    var result = engine.presentReminder({ title: "A little care, on repeat.", body: "Your Avrit test notification is here." }, {
      permission: notificationPermission(),
      show: function (title, opts) { new Notification(title, opts); }
    });
    notificationMessage = result.system.ok ? "Test sent. If it does not appear, check your device’s notification and Focus settings." : "The test could not be sent. Check browser and device notification permissions.";
    render();
  }

  function restoreBuiltins() {
    var previous = state.items;
    var missing = engine.builtinItems().filter(function (starter) {
      return !state.items.some(function (item) { return item.id === starter.id || item.kind === starter.kind || item.templateId === starter.id; });
    });
    state.items = state.items.concat(missing);
    if (!save()) {
      state.items = previous;
      return;
    }
    state.filter = "all";
    goHome();
    setStatus(missing.length ? missing.length + " starter rhythms added. Your existing Avrits are unchanged." : "All five starter rhythms are already in your collection.");
  }

  function setStatus(text) {
    var node = document.getElementById("status");
    if (node) node.textContent = text;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(function () { if (node) node.textContent = ""; }, 3800);
  }

  function raiseDue() {
    raiseDueLabels();
    if (deviceReminders() || notificationPermission() !== "granted") return;
    state.items.forEach(function (item) {
      var reminder = engine.reminderFor(item, new Date(), { useRemote: false });
      var key = item.id + ":" + reminder.schedule.nextAt;
      if (!reminder.due || notified[key]) return;
      var result = engine.presentReminder(reminder.inApp, {
        permission: notificationPermission(),
        show: function (title, opts) { new Notification(title, opts); }
      });
      if (result.system.ok) notified[key] = true;
    });
  }

  function raiseDueLabels() {
    var host = document.getElementById("reminders");
    if (!host) return;
    host.textContent = "";
    var dueItems = state.items.filter(function (item) {
      var reminder = engine.reminderFor(item, new Date(), { useRemote: false });
      var card = Array.prototype.find.call(document.querySelectorAll(".card"), function (node) { return node.getAttribute("data-item") === item.id; });
      if (card) {
        var overdue = reminder.due && printedBeforeToday(reminder.schedule);
        card.classList.toggle("is-due", reminder.due);
        card.classList.toggle("is-overdue", overdue);
        if (reminder.due && item.id !== state.pulseId) card.querySelector(".card-state").textContent = overdue ? "Overdue · ready when you are" : "Due today";
      }
      return reminder.due;
    });
    if (dueItems.length) host.appendChild(el("p", { class: "banner", text: dueItems.length === 1 ? dueItems[0].title + " is due. A little care when you can." : dueItems.length + " rhythms are due. One at a time." }));
    var logged = state.items.filter(function (item) { return !!item.lastDone; }).length;
    document.getElementById("home-summary").textContent = logged ? logged + " rhythm" + (logged === 1 ? "" : "s") + " in motion. A little care goes a long way." : "Little things. One less thing to remember.";
    var intro = document.getElementById("home-intro");
    intro.querySelectorAll('.dashboard-overview, .dashboard-tools, .dashboard-greeting').forEach(function (n) { n.remove(); });
    if (window.AvritOnboarding) {
      if (state.profile.name) intro.insertBefore(el('p', { class: 'dashboard-greeting', text: 'A little care for your world, ' + state.profile.name + '.' }), intro.querySelector('h2'));
      var upcoming = state.items.filter(function (item) { var s = engine.suggest(item); return s.nextAt && !engine.reminderFor(item, new Date()).due; }).length;
      var overview = el('div', { class: 'dashboard-overview' });
      [[state.items.length, 'Your Avrits'], [dueItems.length, 'Ready for care'], [upcoming, 'Coming up']].forEach(function (p) { overview.appendChild(el('span', {}, [el('strong', { text: p[0] }), document.createTextNode(p[1])])); });
      intro.appendChild(overview);
      var controls = el('div', { class: 'dashboard-tools' });
      var filter = el('select', { id: 'dashboard-filter', 'aria-label': 'Show Avrits' });
      [['all', 'All Avrits'], ['due', 'Ready for care'], ['upcoming', 'Coming up']].concat(window.AvritCatalog.groups.filter(function (g) { return state.items.some(function (i) { return i.category === g.id; }); }).map(function (g) { return [g.id, g.name]; })).forEach(function (p) { filter.appendChild(el('option', { value: p[0], text: p[1] })); });
      if (state.items.some(function (i) { return i.category === 'custom'; })) filter.appendChild(el('option', { value: 'custom', text: 'Your own Avrits' }));
      filter.value = state.filter;
      filter.onchange = function () { state.filter = filter.value; state.listY = 0; render(); document.getElementById('dashboard-filter').focus(); };
      controls.appendChild(filter);
      var explore = el('button', { class: 'text-btn dashboard-explore', type: 'button', text: '+ Find more Avrits' }); explore.onclick = beginOnboarding; controls.appendChild(explore); intro.appendChild(controls);
    }
  }

  function onWheel(event) {
    if (state.view !== "home") return;
    event.preventDefault();
    coastToken += 1;
    state.listY = clamp(state.listY - event.deltaY, listBounds().min, 0);
    applyMotion();
  }

  function onKeyDown(event) {
    var grip = event.target.closest("[data-grip]");
    if (grip && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      var id = grip.getAttribute("data-id");
      var from = state.items.indexOf(find(id));
      var to = clamp(from + (event.key === "ArrowUp" ? -1 : 1), 0, state.items.length - 1);
      state.items = gesture.commitMove(state.items, from, to);
      save(); render(); hapticClick("selection");
      var moved = Array.prototype.find.call(document.querySelectorAll("[data-grip]"), function (node) { return node.getAttribute("data-id") === id; });
      if (moved) moved.focus({ preventScroll: true });
      setStatus("Moved " + find(id).title + " to position " + (to + 1) + ".");
      return;
    }
    if (event.target.matches('[data-action="open"]') && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault(); openDetail(event.target.getAttribute("data-item"));
    }
  }

  function onPointerDown(event) {
    if (state.view !== "home") return;
    if (event.button != null && event.button !== 0) return;
    var grip = event.target.closest("[data-grip]");
    if (grip) {
      beginGrab(event, grip);
      return;
    }
    if (event.target.closest("button, a, input")) return;
    coastToken += 1;
    drag = {
      mode: "pull",
      pointerId: event.pointerId,
      originY: event.clientY,
      lastY: event.clientY,
      lastT: performance.now(),
      v: 0,
      moved: false,
      rawY: gesture.rawFromOffset(state.listY, listBounds())
    };
  }

  function beginGrab(event, grip) {
    coastToken += 1;
    var card = grip.closest(".card");
    var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
    var from = cards.indexOf(card);
    var stack = document.getElementById("stack");
    var gap = 16;
    if (stack) gap = parseFloat(window.getComputedStyle(stack).rowGap) || 16;
    drag = {
      mode: "grab",
      pointerId: event.pointerId,
      id: grip.getAttribute("data-id"),
      from: from,
      hover: from,
      slot: card.getBoundingClientRect().height + gap,
      lastY: event.clientY,
      lastT: performance.now(),
      v: 0,
      dy: 0,
      card: card,
      moved: false
    };
    card.classList.add("is-grabbed");
    hapticClick("grab");
    if (grip.setPointerCapture) grip.setPointerCapture(event.pointerId);
    autoScrollGrab();
    event.preventDefault();
  }

  function autoScrollGrab() {
    var current = drag;
    var last = performance.now();
    function frame(now) {
      if (!drag || drag !== current || drag.mode !== "grab") return;
      var box = document.getElementById("viewport").getBoundingClientRect();
      var edge = 65;
      var speed = drag.lastY < box.top + edge ? Math.min(1, (box.top + edge - drag.lastY) / edge) * 230
        : drag.lastY > box.bottom - edge ? -Math.min(1, (drag.lastY - box.bottom + edge) / edge) * 230 : 0;
      var previous = state.listY;
      state.listY = clamp(state.listY + speed * Math.min(.032, (now - last) / 1000), listBounds().min, 0);
      last = now;
      if (previous !== state.listY) {
        drag.dy += previous - state.listY;
        applyMotion();
        updateGrab();
      }
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    var now = performance.now();
    var dy = event.clientY - drag.lastY;
    var dt = Math.max(16, now - drag.lastT) / 1000;
    drag.v = dy / dt;
    drag.lastY = event.clientY;
    drag.lastT = now;
    if (drag.mode === "pull") {
      if (Math.abs(event.clientY - drag.originY) > 8) drag.moved = true;
      drag.rawY += dy;
      state.listY = gesture.trackPull(drag.rawY, listBounds());
      applyMotion();
      return;
    }
    drag.dy += dy;
    drag.moved = true;
    updateGrab();
  }

  function updateGrab() {
    var previousHover = drag.hover;
    drag.hover = clamp(drag.from + Math.round(drag.dy / drag.slot), 0, state.items.length - 1);
    if (previousHover !== drag.hover) hapticClick("selection");
    Array.prototype.forEach.call(document.querySelectorAll(".card"), function (card, index) {
      if (card === drag.card) return;
      var shift = 0;
      if (drag.hover > drag.from && index > drag.from && index <= drag.hover) shift = -drag.slot;
      if (drag.hover < drag.from && index >= drag.hover && index < drag.from) shift = drag.slot;
      card.style.transition = reduced ? "none" : "transform 220ms cubic-bezier(.2,.8,.2,1)";
      card.style.transform = "translateY(" + shift + "px)";
    });
    drag.card.style.transform = "translate3d(0," + drag.dy.toFixed(2) + "px,0) scale(1.03)";
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    var finished = drag;
    drag = null;
    if (finished.mode === "pull") {
      if (finished.moved) swallowUntil = performance.now() + 400;
      releaseList(finished.v);
      return;
    }
    if (event.type === "pointercancel") { render(); return; }
    swallowUntil = performance.now() + 350;
    hapticClick("release");
    // Keep a deliberate drop in its previewed slot; velocity only affects settling.
    var landing = { index: finished.hover };
    var ids = state.items.map(function (item) { return item.id; });
    var order = gesture.commitMove(ids, finished.from, landing.index);
    var byId = {};
    state.items.forEach(function (item) { byId[item.id] = item; });
    state.items = order.map(function (id) { return byId[id]; });
    save();
    render();
    var moved = document.querySelector('[data-item="' + finished.id + '"]');
    if (moved) {
      springValue(finished.v > 0 ? 18 : -18, Math.max(-400, Math.min(400, finished.v)), 0, function (value) {
        moved.style.transform = "translate3d(0," + value.toFixed(2) + "px,0)";
      }, function () {
        moved.style.transform = "";
      });
    }
  }

  function listBounds() {
    var view = document.getElementById("viewport");
    var stack = document.getElementById("stack");
    var min = 0;
    if (view && stack) min = Math.min(0, view.clientHeight - stack.offsetHeight);
    return { min: min, max: 0, dimension: view ? view.clientHeight : 480 };
  }

  function releaseList(velocity) {
    coastToken += 1;
    var token = coastToken;
    var bounds = listBounds();
    if (reduced) { state.listY = clamp(state.listY, bounds.min, bounds.max); state.listV = 0; applyMotion(); return; }
    var homing = state.listY > bounds.max + 0.5 || state.listY < bounds.min - 0.5;
    var home = state.listY > bounds.max ? bounds.max : bounds.min;
    state.listV = reduced ? 0 : (homing ? Math.max(-80, Math.min(80, velocity)) : velocity);
    var last = performance.now();
    var frames = 0;
    function frame(now) {
      if (token !== coastToken) return;
      frames += 1;
      var dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      bounds = listBounds();
      var next;
      if (homing) {
        next = gesture.stepMotion({ y: state.listY, v: state.listV }, dt, {
          friction: 5.5,
          spring: reduced ? 220 : 78,
          rest: home,
          min: -100000,
          max: 100000,
          restitution: 0.35
        });
        var crossed = (state.listY - home) * (next.y - home) <= 0;
        state.listY = next.y;
        state.listV = next.v;
        applyMotion();
        if (crossed || (Math.abs(state.listY - home) < 0.8 && Math.abs(state.listV) < 30) || frames > 180) {
          state.listY = home;
          state.listV = 0;
          applyMotion();
          return;
        }
      } else {
        next = gesture.stepMotion({ y: state.listY, v: state.listV }, dt, {
          friction: reduced ? 8 : 2.2,
          spring: 0,
          rest: 0,
          min: bounds.min,
          max: bounds.max,
          restitution: 0.46
        });
        state.listY = next.y;
        state.listV = next.v;
        applyMotion();
        if (Math.abs(next.v) < 18 || frames > 420) {
          if (state.listY > bounds.max) state.listY = bounds.max;
          if (state.listY < bounds.min) state.listY = bounds.min;
          state.listV = 0;
          applyMotion();
          return;
        }
      }
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  function springIn(node) {
    if (!node || reduced) return;
    var motion = { y: reduced ? 0 : 48, v: 0 };
    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      motion = gesture.stepMotion(motion, dt, {
        friction: 7,
        spring: reduced ? 240 : 90,
        rest: 0,
        min: -30,
        max: 200,
        restitution: 0.3
      });
      node.style.transform = "translate3d(0," + motion.y.toFixed(2) + "px,0)";
      if (Math.abs(motion.y) > 0.5 || Math.abs(motion.v) > 10) window.requestAnimationFrame(frame);
      else node.style.transform = "";
    }
    window.requestAnimationFrame(frame);
  }

  function springValue(from, velocity, target, draw, done) {
    if (reduced) { draw(target); done(); return; }
    var motion = { y: from, v: reduced ? 0 : velocity };
    var last = performance.now();
    var frames = 0;
    function frame(now) {
      frames += 1;
      var dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      motion = gesture.stepMotion(motion, dt, {
        friction: 6,
        spring: reduced ? 240 : 70,
        rest: target,
        min: Math.min(from, target) - 80,
        max: Math.max(from, target) + 80,
        restitution: 0.4
      });
      draw(motion.y);
      if ((Math.abs(motion.y - target) < 0.8 && Math.abs(motion.v) < 16) || frames > 360) done();
      else window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  function applyMotion() {
    var stack = document.getElementById("stack");
    var sky = document.getElementById("parallax");
    if (stack) stack.style.transform = "translate3d(0," + state.listY.toFixed(2) + "px,0)";
    if (sky) {
      sky.style.transform = "translate3d(" + state.pointerX.toFixed(2) + "px," + ((state.listY * 0.28) + state.pointerShift).toFixed(2) + "px,0)";
    }
  }

  function shiftSky(event) {
    if (drag || reduced) return;
    var width = window.innerWidth || 1;
    var height = window.innerHeight || 1;
    state.pointerX = ((event.clientX / width) - 0.5) * 12;
    state.pointerShift = ((event.clientY / height) - 0.5) * 8;
    applyMotion();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function feedbackFromGesture(node) {
    if (node) node.classList.add("is-clicked");
    hapticClick("success");
    playTick();
    flashRing(node);
  }

  function hapticClick(kind) {
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.avritFeedback) {
        window.webkit.messageHandlers.avritFeedback.postMessage(kind || "selection");
      } else if (window.AvritNative && window.AvritNative.postMessage) {
        window.AvritNative.postMessage(kind || "selection");
      } else if (navigator.vibrate) navigator.vibrate(kind === "success" ? 9 : 5);
    } catch (err) { /* visual feedback remains */ }
  }

  function soundEnabled() {
    try { return localStorage.getItem("avrit.sound") !== "off"; }
    catch (err) { return true; }
  }

  function playTick() {
    if (!soundEnabled()) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended") audioCtx.resume();
      var now = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.012, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    } catch (err) { /* visual tick still runs */ }
  }

  function flashRing(node) {
    var ring = document.getElementById("tick-ring");
    if (!ring || !node || !node.getBoundingClientRect) return;
    var box = node.getBoundingClientRect();
    ring.hidden = false;
    ring.style.left = (box.left + box.width / 2) + "px";
    ring.style.top = (box.top + box.height / 2) + "px";
    ring.classList.remove("is-on");
    void ring.offsetWidth;
    ring.classList.add("is-on");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
