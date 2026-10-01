(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AvritEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var DAY = 86400000;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var INTERVALS = {
    nail: 7,
    haircut: 42,
    ac: 90,
    battery: 365,
    custom: 30
  };

  function isDayString(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function toInstant(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date) {
      var t = value.getTime();
      return isNaN(t) ? null : t;
    }
    if (typeof value === "number") return isFinite(value) ? value : null;
    if (isDayString(value)) return Date.parse(value + "T00:00:00.000Z");
    if (typeof value === "string") {
      var parsed = Date.parse(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  function calendarDay(value) {
    if (isDayString(value)) return Date.parse(value + "T00:00:00.000Z");
    var instant = value instanceof Date ? value.getTime() : toInstant(value);
    if (instant == null) return null;
    var date = value instanceof Date ? value : new Date(instant);
    if (isNaN(date.getTime())) return null;
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function formatDay(ms) {
    if (ms == null || isNaN(ms)) return "";
    var d = new Date(ms);
    var month = d.getUTCMonth() + 1;
    var day = d.getUTCDate();
    return d.getUTCFullYear() + "-" + (month < 10 ? "0" : "") + month + "-" + (day < 10 ? "0" : "") + day;
  }

  function prettyDate(ms) {
    if (ms == null || isNaN(ms)) return "";
    var d = new Date(ms);
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }

  function addDays(dayMs, days) {
    return dayMs + days * DAY;
  }

  function addYears(dayMs, years) {
    var d = new Date(dayMs);
    var year = d.getUTCFullYear() + years;
    var month = d.getUTCMonth();
    var day = d.getUTCDate();
    var dim = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    if (day > dim) day = dim;
    return Date.UTC(year, month, day);
  }

  function daysBetween(startMs, endMs) {
    return Math.round((endMs - startMs) / DAY);
  }

  function hasUserInterval(item) {
    return item && typeof item.intervalDays === "number" && isFinite(item.intervalDays) && item.intervalDays >= 1;
  }

  function base(item, extra) {
    var out = {
      nextAt: null,
      intervalDays: null,
      reason: "",
      sourceName: "",
      sourceUrl: "",
      origin: "local",
      intent: "custom"
    };
    Object.keys(extra || {}).forEach(function (key) { out[key] = extra[key]; });
    if (item && item.kind) out.kind = item.kind;
    return out;
  }

  function localSuggest(item) {
    var kind = item && item.kind;
    var last = item && item.lastDone ? calendarDay(item.lastDone) : null;
    if (kind === "nail") {
      return base(item, {
        nextAt: last == null ? null : addDays(last, INTERVALS.nail),
        intervalDays: INTERVALS.nail,
        intent: "trim",
        sourceName: "American Academy of Dermatology",
        sourceUrl: "https://www.aad.org/public/everyday-care/nail-care-secrets/basics/pedicures/removing-gel-polish",
        reason: "Dr. Shari Lipner, on the American Academy of Dermatology site, says clipping nails once a week keeps them from catching. Avrit uses that 7-day gap as the next cut. You can replace it."
      });
    }
    if (kind === "haircut") {
      return base(item, {
        nextAt: last == null ? null : addDays(last, INTERVALS.haircut),
        intervalDays: INTERVALS.haircut,
        intent: "trim",
        sourceName: "American Academy of Dermatology",
        sourceUrl: "https://www.aad.org/public/diseases/hair-loss/causes/hairstyles",
        reason: "Avrit suggests the next haircut 42 days later, six times the nail gap. The American Academy of Dermatology says not to leave braids in longer than 6 to 8 weeks, because longer hair pulls more. Set your own interval if this shape needs a different gap."
      });
    }
    if (kind === "ac") {
      return base(item, {
        nextAt: last == null ? null : addDays(last, INTERVALS.ac),
        intervalDays: INTERVALS.ac,
        intent: "service-check",
        sourceName: "Blue Star",
        sourceUrl: "https://consumer.bluestarindia.com/pages/faq",
        reason: "Blue Star recommends a service about every 3 to 4 months for normal use. Avrit marks a qualified service check 90 days after the date you logged. The date is for the service centre."
      });
    }
    if (kind === "battery") {
      return base(item, {
        nextAt: last == null ? null : addDays(last, INTERVALS.battery),
        intervalDays: INTERVALS.battery,
        intent: "service-check",
        sourceName: "AAA",
        sourceUrl: "https://www.aaa.com/autorepair/articles/how-long-do-car-batteries-last",
        reason: "AAA says that once a car battery reaches its third year, have it tested annually. Avrit marks a workshop test one year after the date you logged. The date is a test, not a home charging session."
      });
    }
    if (kind === "insurance") {
      var next = last == null ? null : addYears(last, 1);
      return base(item, {
        nextAt: next,
        intervalDays: last == null || next == null ? 365 : daysBetween(last, next),
        intent: "renewal",
        sourceName: "IRDAI",
        sourceUrl: "https://irdai.gov.in/documents/37343/993134/Motor%2BInsurance%2BHandbook%2B%28English%29.pdf/44f2a216-f063-9acd-b062-70b6aca97c0f?version=1.0&t=1631528776152",
        reason: "IRDAI's motor handbook says a policy is usually valid for one year and must be renewed before the due date. Avrit marks the same calendar date next year. If your papers show a longer third-party term, set that interval."
      });
    }
    var customDays = INTERVALS.custom;
    return base(item, {
      nextAt: last == null ? null : addDays(last, customDays),
      intervalDays: customDays,
      intent: "custom",
      sourceName: "Avrit",
      sourceUrl: "https://bighelpers.in/avrit/",
      reason: "There is no standard cycle for an item you named yourself. Avrit starts at 30 days until you set your own interval."
    });
  }

  function userSchedule(item) {
    var last = item.lastDone ? calendarDay(item.lastDone) : null;
    var days = Math.round(item.intervalDays);
    return base(item, {
      nextAt: last == null ? (item.scheduleStartedAt ? addDays(calendarDay(item.scheduleStartedAt), days) : item.firstDueAt ? calendarDay(item.firstDueAt) : null) : addDays(last, days),
      intervalDays: days,
      origin: "user",
      intent: item.kind === "ac" || item.kind === "battery" ? "service-check" : (item.kind === "insurance" ? "renewal" : "trim"),
      sourceName: "Avrit",
      sourceUrl: "https://bighelpers.in/avrit/",
      reason: "You chose " + days + " days. The reminder follows your interval."
    });
  }

  function remoteSchedule(item) {
    var last = item.lastDone ? calendarDay(item.lastDone) : null;
    var days = Math.round(item.remoteIntervalDays);
    if (!isFinite(days) || days < 1) return null;
    return base(item, {
      nextAt: last == null ? null : addDays(last, days),
      intervalDays: days,
      origin: "gemini",
      intent: item.kind === "ac" || item.kind === "battery" ? "service-check" : "trim",
      sourceName: "Gemini",
      sourceUrl: "https://ai.google.dev/gemini-api/docs",
      reason: item.remoteReason || "Gemini suggested this interval."
    });
  }

  function instructsUnsafe(text) {
    var sentences = String(text || "").split(/(?<=[.!?])\s+/);
    return sentences.some(function (sentence) {
      var s = sentence.toLowerCase();
      if (/\b(do not|don't|does not|never|not a|it is not)\b/.test(s)) return false;
      return /\btop\s*-?\s*up\b|\brefill\b|\badd refrigerant\b|\brecharge\b|\bcharge the battery yourself\b/.test(s);
    });
  }

  function suggest(item, options) {
    options = options || {};
    if (hasUserInterval(item)) return userSchedule(item);
    if (options.useRemote && item && item.remoteIntervalDays && !instructsUnsafe(item.remoteReason)) {
      var remote = remoteSchedule(item);
      if (remote) return remote;
    }
    return localSuggest(item || {});
  }

  function extractJson(text) {
    var raw = String(text || "").trim();
    var fenced = raw.match(/\{[\s\S]*\}/);
    if (!fenced) return null;
    try { return JSON.parse(fenced[0]); } catch (err) { return null; }
  }

  function geminiSuggest(item, options) {
    var model = options.geminiModel || "gemini-2.5-flash";
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(options.geminiApiKey);
    var prompt = [
      "Suggest the next upkeep time as JSON with keys intervalDays (integer) and reason (one sentence).",
      "Kind: " + (item.kind || "custom") + ". Last done: " + (item.lastDone || "unknown") + ".",
      "Nail cuts should land about 5 to 10 days out. A haircut should be clearly later than a nail cut.",
      "Insurance is one year from the logged date unless the papers say otherwise.",
      "Air-conditioner and car-battery results are qualified service checks. Never tell the person to add refrigerant, top up gas, or recharge a battery on a timer.",
      "Return JSON only."
    ].join(" ");
    return Promise.resolve(options.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      })
    })).then(function (response) {
      if (!response || !response.ok) throw new Error("gemini");
      return response.json();
    }).then(function (body) {
      var parts = body && body.candidates && body.candidates[0] && body.candidates[0].content && body.candidates[0].content.parts;
      var text = parts && parts[0] && parts[0].text;
      var parsed = extractJson(text);
      if (!parsed || !isFinite(Number(parsed.intervalDays))) return null;
      return {
        intervalDays: Math.round(Number(parsed.intervalDays)),
        reason: String(parsed.reason || "").trim()
      };
    });
  }

  function acceptRemote(item, remote) {
    if (!remote || !isFinite(remote.intervalDays) || remote.intervalDays < 1 || remote.intervalDays > 3650) return null;
    if (!remote.reason) return null;
    if ((item.kind === "ac" || item.kind === "battery") && instructsUnsafe(remote.reason)) return null;
    var last = item.lastDone ? calendarDay(item.lastDone) : null;
    return base(item, {
      nextAt: last == null ? null : addDays(last, remote.intervalDays),
      intervalDays: remote.intervalDays,
      origin: "gemini",
      intent: item.kind === "ac" || item.kind === "battery" ? "service-check" : (item.kind === "insurance" ? "renewal" : "trim"),
      sourceName: "Gemini",
      sourceUrl: "https://ai.google.dev/gemini-api/docs",
      reason: remote.reason
    });
  }

  function suggestAsync(item, options) {
    options = options || {};
    if (hasUserInterval(item)) return Promise.resolve(userSchedule(item));
    if (!options.geminiApiKey || typeof options.fetch !== "function") {
      return Promise.resolve(localSuggest(item || {}));
    }
    return geminiSuggest(item, options).then(function (remote) {
      return acceptRemote(item, remote) || localSuggest(item);
    }, function () {
      return localSuggest(item || {});
    });
  }

  function reminderFor(item, now, options) {
    var schedule = suggest(item, options);
    var nowMs = toInstant(now);
    var due = schedule.nextAt != null && nowMs != null && nowMs >= schedule.nextAt;
    return {
      due: due,
      schedule: schedule,
      inApp: due ? {
        id: item.id,
        title: item.title || item.kind,
        body: (item.title || "Item") + " is due",
        nextAt: schedule.nextAt,
        channel: "in-app"
      } : null
    };
  }

  function presentReminder(reminder, notificationApi) {
    var result = { inApp: reminder || null, system: { ok: false, reason: "unavailable" } };
    if (!reminder) return result;
    if (!notificationApi) return result;
    try {
      if (notificationApi.permission !== "granted") {
        result.system = { ok: false, reason: notificationApi.permission || "denied" };
        return result;
      }
      notificationApi.show(reminder.title, { body: reminder.body });
      result.system = { ok: true, reason: "shown" };
    } catch (err) {
      result.system = { ok: false, reason: "error" };
    }
    return result;
  }

  function markDone(item, when) {
    var day = calendarDay(when);
    var copy = Object.assign({}, item);
    copy.lastDone = formatDay(day);
    copy.remoteIntervalDays = null;
    copy.remoteReason = "";
    return copy;
  }

  function setUserInterval(item, days) {
    var n = Math.round(Number(days));
    if (!isFinite(n) || n < 1 || n > 3650) return Object.assign({}, item);
    var copy = Object.assign({}, item);
    copy.intervalDays = n;
    copy.remoteIntervalDays = null;
    copy.remoteReason = "";
    return copy;
  }

  function clearUserInterval(item) {
    var copy = Object.assign({}, item);
    copy.intervalDays = null;
    return copy;
  }

  function createCustom(spec) {
    spec = spec || {};
    var title = String(spec.title || "").trim();
    if (!title) return null;
    var item = {
      id: spec.id || ("custom-" + Math.random().toString(36).slice(2, 10)),
      kind: "custom",
      title: title,
      lastDone: spec.lastDone ? formatDay(calendarDay(spec.lastDone)) : "",
      intervalDays: null
    };
    if (spec.intervalDays != null && spec.intervalDays !== "") item = setUserInterval(item, spec.intervalDays);
    return item;
  }

  function builtinItems() {
    return [
      { id: "nail", kind: "nail", title: "Nail cut", lastDone: "", intervalDays: null },
      { id: "haircut", kind: "haircut", title: "Haircut", lastDone: "", intervalDays: null },
      { id: "ac", kind: "ac", title: "AC service", lastDone: "", intervalDays: null },
      { id: "battery", kind: "battery", title: "Car battery", lastDone: "", intervalDays: null },
      { id: "insurance", kind: "insurance", title: "Insurance renewal", lastDone: "", intervalDays: null }
    ];
  }

  return {
    INTERVALS: INTERVALS,
    calendarDay: calendarDay,
    formatDay: formatDay,
    prettyDate: prettyDate,
    addDays: addDays,
    addYears: addYears,
    toInstant: toInstant,
    suggest: suggest,
    suggestAsync: suggestAsync,
    localSuggest: localSuggest,
    reminderFor: reminderFor,
    presentReminder: presentReminder,
    instructsUnsafe: instructsUnsafe,
    markDone: markDone,
    setUserInterval: setUserInterval,
    clearUserInterval: clearUserInterval,
    createCustom: createCustom,
    builtinItems: builtinItems,
    hasUserInterval: hasUserInterval
  };
});
