const assert = require("assert");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const engine = require("../js/engine.js");
const gesture = require("../js/gesture.js");
const guides = require("../js/guides.js");

const root = path.join(__dirname, "..");

function diyInstruction(text) {
  return String(text || "").split(/(?<=[.!?])\s+/).some(function (sentence) {
    const s = sentence.toLowerCase();
    if (/\b(do not|don't|does not|never|not a|it is not)\b/.test(s)) return false;
    return /\btop\s*-?\s*up\b|\brefill the (gas|refrigerant)\b|\badd refrigerant\b|\brecharge (the |your )?battery\b|\bcharge the battery yourself\b/.test(s);
  });
}

test("nail suggestion lands 5 to 10 days later with a reason", function () {
  const item = { id: "nail", kind: "nail", title: "Nail cut", lastDone: "2026-09-28", intervalDays: null };
  const schedule = engine.suggest(item);
  assert.ok(schedule.intervalDays >= 5 && schedule.intervalDays <= 10);
  assert.equal(engine.formatDay(schedule.nextAt), "2026-10-05");
  assert.ok(schedule.reason && schedule.reason.length > 20);
  assert.equal(schedule.origin, "local");
});

test("haircut is later than the nail interval and includes a reason", function () {
  const nail = engine.suggest({ kind: "nail", lastDone: "2026-09-28", intervalDays: null });
  const hair = engine.suggest({ kind: "haircut", lastDone: "2026-09-28", intervalDays: null });
  assert.ok(hair.intervalDays > nail.intervalDays);
  assert.equal(engine.formatDay(hair.nextAt), "2026-11-09");
  assert.ok(hair.reason && hair.reason.length > 20);
});

test("insurance is one year from the entered date", function () {
  const schedule = engine.suggest({ kind: "insurance", lastDone: "2026-09-28", intervalDays: null });
  assert.equal(engine.formatDay(schedule.nextAt), "2027-09-28");
  const leap = engine.suggest({ kind: "insurance", lastDone: "2024-02-29", intervalDays: null });
  assert.equal(engine.formatDay(leap.nextAt), "2025-02-28");
});

test("AC and battery suggestions are service checks and do not instruct a DIY top-up or casual recharge", function () {
  const ac = engine.suggest({ kind: "ac", lastDone: "2026-01-15", intervalDays: null });
  const battery = engine.suggest({ kind: "battery", lastDone: "2026-01-15", intervalDays: null });
  assert.equal(ac.intent, "service-check");
  assert.equal(battery.intent, "service-check");
  assert.equal(engine.formatDay(ac.nextAt), "2026-04-15");
  assert.equal(engine.formatDay(battery.nextAt), "2027-01-15");
  assert.equal(diyInstruction(ac.reason), false);
  assert.equal(diyInstruction(battery.reason), false);
  assert.ok(/service/i.test(ac.reason));
  assert.ok(/test/i.test(battery.reason));
});

test("a custom item and a user interval override the suggestion the reminder uses", function () {
  const custom = engine.createCustom({ title: "Roof tank clean", lastDone: "2026-09-01", intervalDays: 14 });
  const schedule = engine.suggest(custom);
  assert.equal(custom.kind, "custom");
  assert.equal(schedule.origin, "user");
  assert.equal(schedule.intervalDays, 14);
  assert.equal(engine.formatDay(schedule.nextAt), "2026-09-15");

  const nail = engine.markDone({ id: "nail", kind: "nail", title: "Nail cut", intervalDays: null }, "2026-09-28");
  const chosen = engine.setUserInterval(nail, 21);
  const used = engine.suggest(chosen);
  assert.equal(used.intervalDays, 21);
  assert.equal(engine.formatDay(used.nextAt), "2026-10-19");
  const reminder = engine.reminderFor(chosen, Date.parse("2026-10-18T00:00:00.000Z"));
  assert.equal(reminder.due, false);
  assert.equal(reminder.schedule.intervalDays, 21);
});

test("the due flag flips only once the clock reaches the next moment, and the in-app reminder still raises if notification permission is denied", async function () {
  const item = engine.markDone({ id: "nail", kind: "nail", title: "Nail cut", intervalDays: null }, "2026-09-28");
  const schedule = engine.suggest(item);
  const early = engine.reminderFor(item, schedule.nextAt - 1);
  const due = engine.reminderFor(item, schedule.nextAt);
  assert.equal(early.due, false);
  assert.equal(early.inApp, null);
  assert.equal(due.due, true);
  assert.equal(due.inApp.channel, "in-app");
  assert.equal(due.inApp.title, "Nail cut");

  let shown = false;
  const denied = engine.presentReminder(due.inApp, {
    permission: "denied",
    show: function () { shown = true; }
  });
  assert.ok(denied.inApp);
  assert.equal(denied.system.ok, false);
  assert.equal(shown, false);

  const unavailable = engine.presentReminder(due.inApp, null);
  assert.ok(unavailable.inApp);
  assert.equal(unavailable.system.reason, "unavailable");

  const granted = engine.presentReminder(due.inApp, {
    permission: "granted",
    show: function (title) { shown = title; }
  });
  assert.equal(granted.system.ok, true);
  assert.equal(shown, "Nail cut");

  const broken = engine.presentReminder(due.inApp, {
    permission: "granted",
    show: function () { throw new Error("blocked"); }
  });
  assert.ok(broken.inApp);
  assert.equal(broken.system.ok, false);
});

test("default suggestion does not call Gemini, a key can use the same step, and an unsafe remote answer is dropped", async function () {
  const nail = { kind: "nail", title: "Nail cut", lastDone: "2026-09-28", intervalDays: null };
  let calls = 0;
  const local = await engine.suggestAsync(nail, {
    fetch: function () {
      calls += 1;
      throw new Error("network");
    }
  });
  assert.equal(calls, 0);
  assert.equal(local.origin, "local");
  assert.equal(local.intervalDays, 7);

  const overridden = await engine.suggestAsync(engine.setUserInterval(nail, 9), {
    geminiApiKey: "should-not-be-used",
    fetch: function () {
      calls += 1;
      throw new Error("network");
    }
  });
  assert.equal(calls, 0);
  assert.equal(overridden.origin, "user");
  assert.equal(overridden.intervalDays, 9);

  const remote = await engine.suggestAsync(nail, {
    geminiApiKey: "test-key-not-real",
    fetch: function (url) {
      calls += 1;
      assert.ok(String(url).indexOf("generativelanguage.googleapis.com") !== -1);
      assert.ok(String(url).indexOf("test-key-not-real") !== -1);
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({
            candidates: [{ content: { parts: [{ text: "{\"intervalDays\":8,\"reason\":\"Eight days keeps this nail short.\"}" }] } }]
          });
        }
      });
    }
  });
  assert.equal(calls, 1);
  assert.equal(remote.origin, "gemini");
  assert.equal(remote.intervalDays, 8);

  const unsafe = await engine.suggestAsync({ kind: "ac", title: "AC service", lastDone: "2026-01-01", intervalDays: null }, {
    geminiApiKey: "test-key-not-real",
    fetch: function () {
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({
            candidates: [{ content: { parts: [{ text: "{\"intervalDays\":30,\"reason\":\"Please top up the refrigerant tomorrow.\"}" }] } }]
          });
        }
      });
    }
  });
  assert.equal(unsafe.origin, "local");
  assert.equal(diyInstruction(unsafe.reason), false);
  assert.equal(unsafe.intent, "service-check");
});

test("a pull past rest returns a smaller displacement than the finger delta and a release returns to rest", function () {
  const bounds = { min: -800, max: 0, dimension: 400 };
  const pulled = gesture.dragOffset(0, 120, bounds);
  assert.ok(pulled > 0);
  assert.ok(pulled < 120);
  const resisted = gesture.resist(120, 400);
  assert.ok(Math.abs(resisted) < 120);
  const settled = gesture.settle({ y: 70, v: 0 }, {
    friction: 6,
    spring: 50,
    rest: 0,
    min: -1000,
    max: 1000,
    restitution: 0.3,
    dt: 0.016
  });
  assert.ok(Math.abs(settled.y) < 0.5);
  assert.equal(settled.v, 0);
});

test("each further downward pull increases the resisted offset", function () {
  const bounds = { min: -800, max: 0, dimension: 400 };
  let raw = 0;
  let offset = gesture.trackPull(raw, bounds);
  [80, 6, 8, 8, 8, 8, 8, 8].forEach(function (dy) {
    raw += dy;
    const next = gesture.trackPull(raw, bounds);
    assert.ok(next > offset, "downward " + dy + "px did not increase the offset");
    assert.ok(next < raw);
    offset = next;
  });
  const afterEighty = gesture.trackPull(80, bounds);
  assert.ok(gesture.trackPull(86, bounds) > afterEighty);
  assert.ok(gesture.dragOffset(afterEighty, 6, bounds) < afterEighty);
});

test("a fling keeps velocity that friction decays", function () {
  const first = gesture.stepMotion({ y: 0, v: 400 }, 0.05, {
    friction: 2,
    spring: 0,
    min: -10000,
    max: 10000,
    restitution: 0.5
  });
  assert.ok(first.v > 0);
  assert.ok(first.v < 400);
  let speed = 400;
  for (let i = 0; i < 8; i += 1) {
    const next = gesture.stepMotion({ y: 0, v: speed }, 0.05, {
      friction: 2,
      spring: 0,
      min: -10000,
      max: 10000
    });
    assert.ok(next.v < speed);
    assert.ok(next.v > 0);
    speed = next.v;
  }
});

test("a release past a bound bounces", function () {
  const bounced = gesture.stepMotion({ y: 95, v: 200 }, 0.1, {
    friction: 0,
    spring: 0,
    min: 0,
    max: 100,
    restitution: 0.5
  });
  assert.equal(bounced.bounced, true);
  assert.ok(bounced.y <= 100);
  assert.ok(bounced.v < 0);
  const flung = gesture.flingIndex(4, 5000, 80, 5, { friction: 1, restitution: 0.5 });
  assert.equal(flung.bounced, true);
  assert.ok(flung.index >= 0 && flung.index <= 4);
});

test("grab, move, and release commits the new order", function () {
  const ids = ["nail", "haircut", "ac", "battery", "insurance"];
  const moved = gesture.commitMove(ids, 0, 2);
  assert.deepEqual(moved, ["haircut", "ac", "nail", "battery", "insurance"]);
  assert.deepEqual(ids, ["nail", "haircut", "ac", "battery", "insurance"]);
});

test("nails and hair include how-to, method, medical fact, and surprising fact", function () {
  ["nail", "haircut"].forEach(function (id) {
    const guide = guides.getGuide(id);
    ["how-to", "method", "medical", "surprising"].forEach(function (role) {
      const found = guide.claims.filter(function (claim) { return claim.role === role; });
      assert.ok(found.length >= 1, id + " missing " + role);
    });
  });
});

test("ac, battery, and insurance include practical guidance", function () {
  ["ac", "battery", "insurance"].forEach(function (id) {
    const guide = guides.getGuide(id);
    const practical = guide.claims.filter(function (claim) { return claim.role === "practical"; });
    assert.ok(practical.length >= 1, id);
    practical.forEach(function (claim) {
      assert.equal(diyInstruction(claim.text), false, claim.text);
    });
  });
});

test("every factual claim has a source", function () {
  const claims = guides.allClaims();
  assert.ok(claims.length >= 12);
  claims.forEach(function (claim) {
    assert.ok(claim.text && claim.text.trim(), claim.guideId);
    assert.ok(claim.sourceName && String(claim.sourceName).trim(), claim.text);
    assert.ok(claim.sourceUrl && String(claim.sourceUrl).trim(), claim.text);
    assert.ok(/^https:\/\//.test(claim.sourceUrl), claim.sourceUrl);
  });
});

test("the entry page uses plain scripts, squircles, blur, and gesture calls", function () {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "css/avrit.css"), "utf8");
  const ui = fs.readFileSync(path.join(root, "js/ui.js"), "utf8");
  assert.equal(/type\s*=\s*["']module["']/.test(html), false);
  assert.ok(html.indexOf("js/engine.js") !== -1);
  assert.ok(html.indexOf("js/gesture.js") !== -1);
  assert.ok(/<title>Avrit<\/title>/.test(html));
  assert.ok(/<h1[^>]*>\s*Avrit/.test(html));
  assert.ok(css.indexOf("url(#squircle)") !== -1);
  assert.ok(css.indexOf("backdrop-filter") !== -1);
  assert.ok(css.indexOf("--s4:") !== -1);
  assert.ok(ui.indexOf("window.AvritGesture") !== -1);
  assert.ok(ui.indexOf("trackPull") !== -1);
  assert.ok(ui.indexOf("rawY") !== -1);
  assert.ok(ui.indexOf("stepMotion") !== -1);
  assert.ok(ui.indexOf("commitMove") !== -1);
  assert.ok(ui.indexOf("navigator.vibrate") !== -1);
  const boot = ui.slice(ui.indexOf("function boot"), ui.indexOf("function logDone"));
  assert.equal(boot.indexOf("playTick("), -1);
  assert.ok(ui.indexOf("playTick(") !== -1);
});

test("phone shells and fastlane lanes stay free of store keys", function () {
  const fastfile = fs.readFileSync(path.join(root, "fastlane/Fastfile"), "utf8");
  const project = fs.readFileSync(path.join(root, "ios/project.yml"), "utf8");
  const gradle = fs.readFileSync(path.join(root, "android/app/build.gradle.kts"), "utf8");
  const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  assert.ok(fastfile.indexOf("lane :upload_only") !== -1);
  assert.ok(fastfile.indexOf("lane :upload_production_draft") !== -1);
  assert.ok(fastfile.indexOf("lane :release_production") !== -1);
  assert.ok(fastfile.indexOf("submit_for_review: false") !== -1);
  assert.ok(fastfile.indexOf('release_status: "draft"') !== -1);
  assert.ok(fastfile.indexOf('release_status: "completed"') !== -1);
  assert.equal(fastfile.indexOf("submit_for_review: true"), -1);
  assert.equal(fastfile.indexOf(".p8"), -1);
  assert.equal(fastfile.indexOf("Y5G4NUAA3H"), -1);
  assert.equal(fastfile.indexOf("play-upload-sa"), -1);
  assert.ok(project.indexOf("in.bighelpers.avrit") !== -1);
  assert.ok(project.indexOf("PG2MGPAQ76") !== -1);
  assert.ok(gradle.indexOf('applicationId = "in.bighelpers.avrit"') !== -1);
  assert.ok(ignore.indexOf("*.p8") !== -1);
  assert.ok(ignore.indexOf("play-upload-sa.json") !== -1);
});
