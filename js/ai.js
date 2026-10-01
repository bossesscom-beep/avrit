(function () {
  "use strict";
  var STORAGE = "avrit.ai.connection.v1";
  function connection() {
    try { return JSON.parse(localStorage.getItem(STORAGE)) || {}; } catch (_) { return {}; }
  }
  function endpoint(value) {
    var url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Use the service origin, such as https://avrit-api.example.com.");
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("The service needs a secure HTTPS address.");
    return url.origin;
  }
  async function post(origin, path, body, token) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 35000);
    try {
      var response = await fetch(origin + path, {
        method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}),
        body: JSON.stringify(body), signal: controller.signal, credentials: "omit", redirect: "error"
      });
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gemini is unavailable. Your reminders still work.");
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Gemini took too long. Please try again.");
      throw error;
    } finally { clearTimeout(timer); }
  }
  window.AvritAI = {
    connection: connection,
    serviceOrigin: function () { return (window.AvritConfig || {}).aiOrigin || ""; },
    ready: function () { var c = connection(); return !!(c.origin && c.token); },
    connect: async function (code) {
      var origin = endpoint(window.AvritAI.serviceOrigin());
      var result = await post(origin, "/api/session", { code: code });
      localStorage.setItem(STORAGE, JSON.stringify({ origin: origin, token: result.token }));
    },
    disconnect: function () { localStorage.removeItem(STORAGE); },
    suggest: async function (body) {
      var c = connection();
      if (!c.token) throw new Error("Connect Gemini in Settings first.");
      return post(endpoint(c.origin), "/api/suggest", body, c.token);
    },
    imageData: function (blob) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result).split(",")[1]); };
        reader.onerror = function () { reject(new Error("Could not read this photo.")); };
        reader.readAsDataURL(blob);
      });
    }
  };
  // Remove the obsolete client-side provider credential on upgrade.
  try { localStorage.removeItem("avrit.geminiKey"); } catch (_) { /* storage may be unavailable */ }
})();
