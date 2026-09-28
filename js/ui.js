(function () {
  var engine = window.AvritEngine;
  var guides = window.AvritGuides;
  var gesture = window.AvritGesture;
  var STORE = "avrit.items.v1";
  var KEY = "avrit.geminiKey";
  var state = {
    items: [],
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

  function boot() {
    try {
      reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (err) { reduced = false; }
    state.items = readItems() || engine.builtinItems();
    var more = document.getElementById("more-btn");
    more.addEventListener("click", function () {
      state.view = state.view === "more" ? "home" : "more";
      state.detailId = null;
      render();
    });
    document.getElementById("viewport").addEventListener("pointerdown", onPointerDown);
    document.getElementById("viewport").addEventListener("click", onClick);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("pointermove", shiftSky);
    render();
    raiseDue();
    window.setInterval(raiseDue, 30000);
    document.addEventListener("visibilitychange", raiseDue);
  }

  function readItems() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.items || !parsed.items.length) return null;
      return parsed.items;
    } catch (err) { return null; }
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ version: 1, items: state.items })); }
    catch (err) { /* private mode still runs in memory */ }
  }

  function readKey() {
    try { return localStorage.getItem(KEY) || ""; }
    catch (err) { return ""; }
  }

  function writeKey(value) {
    try {
      if (value) localStorage.setItem(KEY, value);
      else localStorage.removeItem(KEY);
    } catch (err) { /* ignore */ }
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

  function render() {
    var stage = document.getElementById("stage");
    stage.textContent = "";
    if (state.view === "detail") stage.appendChild(renderDetail());
    else if (state.view === "more") stage.appendChild(renderMore());
    else if (state.view === "add") stage.appendChild(renderAdd());
    else stage.appendChild(renderHome());
    raiseDueLabels();
    if (state.view !== "home") springIn(stage.firstChild);
    else applyMotion();
  }

  function renderHome() {
    var stack = el("div", { class: "stack", id: "stack" });
    var shown = todayValue();
    state.items.forEach(function (item) {
      var schedule = engine.suggest(item, { useRemote: !!readKey() });
      var due = engine.reminderFor(item, new Date(), { useRemote: !!readKey() }).due;
      var card = el("article", {
        class: "card" + (due ? " is-due" : "") + (state.pulseId === item.id ? " is-ack" : ""),
        "data-item": item.id,
        "data-kind": item.kind,
        "data-action": "open"
      });
      card.appendChild(el("p", { class: "kicker", text: item.title }));
      var next = el("p", {
        class: "next",
        "data-next-due": item.id,
        text: schedule.nextAt ? engine.prettyDate(schedule.nextAt) : "Not logged yet"
      });
      if (schedule.nextAt) next.setAttribute("datetime", engine.formatDay(schedule.nextAt));
      card.appendChild(next);
      card.appendChild(el("p", { class: "reason", text: schedule.reason }));
      card.appendChild(el("p", {
        class: "meta",
        text: item.lastDone ? ("Last logged " + engine.prettyDate(engine.calendarDay(item.lastDone))) : ("Logs " + engine.prettyDate(engine.calendarDay(shown)))
      }));
      var foot = el("div", { class: "card-foot" });
      foot.appendChild(el("button", {
        class: "grip",
        type: "button",
        "data-grip": "1",
        "data-id": item.id,
        "aria-label": "Move " + item.title
      }));
      foot.appendChild(el("button", {
        class: "done" + (state.pulseId === item.id ? " is-clicked" : ""),
        type: "button",
        "data-action": "done",
        "data-id": item.id,
        "data-shown": shown,
        text: "Done"
      }));
      card.appendChild(foot);
      stack.appendChild(el("div", { class: "card-wrap" }, [card]));
    });
    return stack;
  }

  function renderDetail() {
    var item = find(state.detailId) || state.items[0];
    var guide = guides.getGuide(item.kind) || guides.getGuide("custom");
    var schedule = engine.suggest(item, { useRemote: !!readKey() });
    var sheet = el("section", { class: "sheet", id: "sheet" });
    sheet.appendChild(el("button", { class: "back", type: "button", "data-action": "home", text: "Back" }));
    sheet.appendChild(el("h2", { text: item.title }));
    sheet.appendChild(el("p", {
      class: "next",
      "data-next-due": item.id,
      text: schedule.nextAt ? engine.prettyDate(schedule.nextAt) : "Not logged yet"
    }));
    sheet.appendChild(el("p", { class: "reason", text: schedule.reason }));
    var groups = [
      ["how-to", "How to"],
      ["method", "Recommended method"],
      ["medical", "Medical fact"],
      ["surprising", "Surprising fact"],
      ["practical", "Practical guidance"]
    ];
    groups.forEach(function (pair) {
      var claims = guide.claims.filter(function (claim) { return claim.role === pair[0]; });
      if (!claims.length) return;
      var block = el("div", { class: "block" });
      block.appendChild(el("h3", { text: pair[1] }));
      claims.forEach(function (claim) {
        var p = el("p", { class: "claim", text: claim.text + " " });
        var link = el("a", { href: claim.sourceUrl, text: claim.sourceName });
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener");
        p.appendChild(link);
        block.appendChild(p);
      });
      sheet.appendChild(block);
    });
    var dateRow = el("div", { class: "row" });
    var date = el("input", { class: "field", id: "when", type: "date", value: item.lastDone || todayValue() });
    dateRow.appendChild(date);
    dateRow.appendChild(el("button", { class: "done", type: "button", "data-action": "save-date", "data-id": item.id, text: "Save date" }));
    sheet.appendChild(dateRow);
    var gapRow = el("div", { class: "row" });
    var gap = el("input", {
      class: "field",
      id: "gap",
      type: "number",
      min: "1",
      max: "3650",
      value: item.intervalDays || schedule.intervalDays || ""
    });
    gap.setAttribute("inputmode", "numeric");
    gap.setAttribute("aria-label", "Interval in days");
    gapRow.appendChild(gap);
    gapRow.appendChild(el("button", { class: "done", type: "button", "data-action": "save-gap", "data-id": item.id, text: "Save interval" }));
    sheet.appendChild(gapRow);
    sheet.appendChild(el("button", { class: "text-btn", type: "button", "data-action": "clear-gap", "data-id": item.id, text: "Use Avrit's suggestion" }));
    if (state.armedRemove) {
      sheet.appendChild(el("button", { class: "text-btn danger", type: "button", "data-action": "confirm-remove", "data-id": item.id, text: "Confirm remove" }));
    } else {
      sheet.appendChild(el("button", { class: "text-btn danger", type: "button", "data-action": "arm-remove", text: "Remove" }));
    }
    return sheet;
  }

  function renderMore() {
    var sheet = el("section", { class: "sheet", id: "sheet" });
    sheet.appendChild(el("h2", { text: "More" }));
    sheet.appendChild(el("p", { class: "quiet", text: "The home list only logs today's date. Guides, intervals, and removal stay here." }));
    sheet.appendChild(el("button", { class: "done", type: "button", "data-action": "add", text: "Add an item" }));
    sheet.appendChild(el("button", { class: "text-btn", type: "button", "data-action": "notify", text: "Allow reminders" }));
    sheet.appendChild(el("p", { class: "quiet", id: "notify-note", text: notifyNote() }));
    var keyRow = el("div", { class: "row" });
    var key = el("input", { class: "field", id: "gemini-key", type: "password", placeholder: "Gemini key, optional" });
    key.setAttribute("autocomplete", "off");
    key.setAttribute("aria-label", "Gemini API key");
    if (readKey()) key.value = readKey();
    keyRow.appendChild(key);
    keyRow.appendChild(el("button", { class: "done", type: "button", "data-action": "save-key", text: "Save key" }));
    sheet.appendChild(keyRow);
    sheet.appendChild(el("p", { class: "quiet", text: "With no key, Avrit keeps its own timing. The key stays in this browser and is never written into the app." }));
    sheet.appendChild(el("button", { class: "text-btn", type: "button", "data-action": "clear-key", text: "Forget key" }));
    sheet.appendChild(el("button", { class: "text-btn", type: "button", "data-action": "restore", text: "Restore the five built-in items" }));
    return sheet;
  }

  function renderAdd() {
    var sheet = el("section", { class: "sheet", id: "sheet" });
    sheet.appendChild(el("button", { class: "back", type: "button", "data-action": "more", text: "Back" }));
    sheet.appendChild(el("h2", { text: "Add an item" }));
    var name = el("input", { class: "field", id: "custom-name", type: "text", placeholder: "Name" });
    name.setAttribute("aria-label", "Item name");
    sheet.appendChild(name);
    var when = el("input", { class: "field", id: "custom-when", type: "date", value: todayValue() });
    when.setAttribute("aria-label", "Last done");
    sheet.appendChild(when);
    var gap = el("input", { class: "field", id: "custom-gap", type: "number", min: "1", placeholder: "Days, optional" });
    gap.setAttribute("aria-label", "Interval in days");
    sheet.appendChild(gap);
    sheet.appendChild(el("button", { class: "done", type: "button", "data-action": "create", text: "Save item" }));
    sheet.appendChild(el("p", { class: "quiet", id: "add-note", text: "" }));
    return sheet;
  }

  function notifyNote() {
    if (location.protocol !== "https:" && location.protocol !== "http:") return "System notifications need the https page. The list still shows what is due.";
    if (!window.Notification) return "This browser has no notification API. The list still shows what is due.";
    if (Notification.permission === "granted") return "System reminders are on. The list still marks what is due.";
    if (Notification.permission === "denied") return "Notifications are blocked. The list still marks what is due.";
    return "System reminders stay off until you allow them. The list still marks what is due.";
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
    if (action === "done") {
      event.preventDefault();
      logDone(id, actionNode);
      return;
    }
    if (action === "open") {
      if (event.target.closest("[data-grip], [data-action='done']")) return;
      openDetail(actionNode.getAttribute("data-item"));
      return;
    }
    if (action === "home") { goHome(); return; }
    if (action === "more") { state.view = "more"; render(); return; }
    if (action === "add") { state.view = "add"; render(); return; }
    if (action === "arm-remove") { state.armedRemove = true; render(); return; }
    if (action === "confirm-remove") { removeItem(id); return; }
    if (action === "save-date") { saveDate(id); return; }
    if (action === "save-gap") { saveGap(id); return; }
    if (action === "clear-gap") { clearGap(id); return; }
    if (action === "save-key") { saveKey(); return; }
    if (action === "clear-key") { writeKey(""); render(); return; }
    if (action === "notify") { askNotify(); return; }
    if (action === "restore") { restoreBuiltins(); return; }
    if (action === "create") { createItem(); }
  }

  function goHome() {
    state.view = "home";
    state.detailId = null;
    state.armedRemove = false;
    state.listY = 0;
    state.listV = 0;
    render();
  }

  function openDetail(id) {
    state.view = "detail";
    state.detailId = id;
    state.armedRemove = false;
    render();
  }

  function logDone(id, button) {
    feedbackFromGesture(button);
    var item = find(id);
    if (!item) return;
    var shown = button && button.getAttribute("data-shown") ? button.getAttribute("data-shown") : todayValue();
    var nextItem = engine.markDone(item, shown);
    replace(nextItem);
    save();
    state.pulseId = id;
    var schedule = engine.suggest(nextItem);
    setStatus(nextItem.title + " logged. Next is " + engine.prettyDate(schedule.nextAt) + ".");
    render();
    maybeGemini(nextItem);
    window.setTimeout(function () {
      if (state.pulseId === id) {
        state.pulseId = "";
        var card = document.querySelector('[data-item="' + id + '"]');
        if (card) card.classList.remove("is-ack");
      }
    }, 700);
  }

  function saveDate(id) {
    var input = document.getElementById("when");
    if (!input || !input.value) return;
    feedbackFromGesture(document.querySelector("[data-action='save-date']"));
    var item = engine.markDone(find(id), input.value);
    replace(item);
    save();
    setStatus("Date saved. Next is " + engine.prettyDate(engine.suggest(item).nextAt) + ".");
    render();
  }

  function saveGap(id) {
    var input = document.getElementById("gap");
    var item = engine.setUserInterval(find(id), input.value);
    if (!engine.hasUserInterval(item)) return;
    feedbackFromGesture(document.querySelector("[data-action='save-gap']"));
    replace(item);
    save();
    render();
  }

  function clearGap(id) {
    var item = engine.clearUserInterval(find(id));
    replace(item);
    save();
    render();
  }

  function removeItem(id) {
    state.items = state.items.filter(function (item) { return item.id !== id; });
    save();
    state.armedRemove = false;
    goHome();
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
    state.items = state.items.concat([item]);
    save();
    goHome();
  }

  function saveKey() {
    var input = document.getElementById("gemini-key");
    writeKey(input && input.value ? input.value.trim() : "");
    setStatus(readKey() ? "Key saved on this device." : "No key saved. Avrit's own timing stays on.");
  }

  function askNotify() {
    if (!window.Notification || !Notification.requestPermission) {
      render();
      return;
    }
    Notification.requestPermission().then(function () { render(); }, function () { render(); });
  }

  function restoreBuiltins() {
    var byId = {};
    state.items.forEach(function (item) { byId[item.id] = item; });
    var builtins = engine.builtinItems().map(function (item) { return byId[item.id] || item; });
    var custom = state.items.filter(function (item) { return item.kind === "custom"; });
    state.items = builtins.concat(custom);
    save();
    goHome();
  }

  function maybeGemini(item) {
    var key = readKey();
    if (!key || engine.hasUserInterval(item)) return;
    engine.suggestAsync(item, { geminiApiKey: key, fetch: window.fetch.bind(window) }).then(function (schedule) {
      if (!schedule || schedule.origin !== "gemini") return;
      var current = find(item.id);
      if (!current || current.lastDone !== item.lastDone || engine.hasUserInterval(current)) return;
      current.remoteIntervalDays = schedule.intervalDays;
      current.remoteReason = schedule.reason;
      save();
      render();
    });
  }

  function setStatus(text) {
    var node = document.getElementById("status");
    if (node) node.textContent = text;
  }

  function raiseDue() {
    raiseDueLabels();
    if (location.protocol !== "https:" || !window.Notification) return;
    state.items.forEach(function (item) {
      var reminder = engine.reminderFor(item, new Date(), { useRemote: !!readKey() });
      if (!reminder.due || notified[item.id]) return;
      notified[item.id] = true;
      engine.presentReminder(reminder.inApp, {
        permission: Notification.permission,
        show: function (title, opts) {
          try { new Notification(title, opts); } catch (err) { /* in-app banner remains */ }
        }
      });
    });
  }

  function raiseDueLabels() {
    var host = document.getElementById("reminders");
    if (!host) return;
    host.textContent = "";
    state.items.forEach(function (item) {
      var reminder = engine.reminderFor(item, new Date(), { useRemote: !!readKey() });
      if (!reminder.due) return;
      host.appendChild(el("p", { class: "banner", text: reminder.inApp.title + " is due" }));
    });
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
      moved: false
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
    event.preventDefault();
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
      var bounds = listBounds();
      state.listY = gesture.dragOffset(state.listY, dy, bounds);
      applyMotion();
      return;
    }
    drag.dy += dy;
    drag.moved = true;
    drag.hover = clamp(drag.from + Math.round(drag.dy / drag.slot), 0, state.items.length - 1);
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
    var landing = gesture.flingIndex(finished.hover, Math.max(-700, Math.min(700, finished.v)), finished.slot, state.items.length, {
      friction: reduced ? 8 : 4,
      restitution: 0.45
    });
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
    if (!node) return;
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
    if (drag) return;
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
    hapticClick();
    playTick();
    flashRing(node);
  }

  function hapticClick() {
    try {
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (err) { /* visual tick still runs */ }
  }

  function playTick() {
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
      gain.gain.exponentialRampToValueAtTime(0.03, now + 0.012);
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
