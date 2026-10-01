(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AvritJournal = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  "use strict";
  function logs(item) {
    if (Array.isArray(item.logs)) return item.logs;
    return item.lastDone ? [{ date: item.lastDone, note: "", photoId: null }] : [];
  }
  // One entry per calendar day. Repeated Done taps never duplicate or erase a photo.
  function record(item, date, changes) {
    var entries = logs(item).map(function (entry) { return Object.assign({}, entry); });
    var entry = entries.find(function (value) { return value.date === date; });
    if (!entry) { entry = { date: date, note: "", photoId: null }; entries.push(entry); }
    Object.assign(entry, changes || {});
    entries.sort(function (a, b) { return b.date.localeCompare(a.date); });
    return Object.assign({}, item, { logs: entries, lastDone: entries[0].date });
  }
  function photoStore(indexedDB) {
    var database;
    function open() {
      if (!indexedDB) return Promise.reject(new Error("Photo storage is unavailable on this device."));
      if (!database) database = new Promise(function (resolve, reject) {
        var request = indexedDB.open("avrit.photos.v1", 1);
        request.onupgradeneeded = function () { request.result.createObjectStore("photos"); };
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { database = null; reject(new Error("Could not open photo storage.")); };
        request.onblocked = function () { reject(new Error("Close other Avrit windows and try again.")); };
      });
      return database;
    }
    function run(mode, operation) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction("photos", mode);
          var request = operation(tx.objectStore("photos"));
          tx.oncomplete = function () { resolve(request && request.result); };
          tx.onerror = tx.onabort = function () { reject(new Error("Photo could not be saved. Free some device storage and try again.")); };
        });
      });
    }
    return {
      put: function (id, blob) { return run("readwrite", function (store) { return store.put(blob, id); }); },
      get: function (id) { return run("readonly", function (store) { return store.get(id); }); },
      remove: function (ids) { return run("readwrite", function (store) { ids.forEach(function (id) { store.delete(id); }); }); }
    };
  }
  // Re-encoding strips EXIF/location metadata and bounds both storage and AI uploads.
  async function preparePhoto(file) {
    if (!file || !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) throw new Error("Choose a JPEG, PNG, WebP or HEIC photo.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Choose a photo smaller than 20 MB.");
    var url = URL.createObjectURL(file);
    try {
      var image = new Image();
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 80000000) throw new Error("This photo is too large to open. Choose a smaller copy.");
      var scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/jpeg", 0.82); });
      if (!blob || blob.size > 900000) throw new Error("This photo is too detailed. Choose a smaller copy.");
      return blob;
    } catch (error) {
      throw new Error(error.message || "This photo could not be opened. Try a JPEG instead.");
    } finally { URL.revokeObjectURL(url); }
  }
  return { logs: logs, record: record, photoStore: photoStore, preparePhoto: preparePhoto };
});
