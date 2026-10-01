(function () {
  "use strict";
  var journal = window.AvritJournal;
  var ai = window.AvritAI;
  var photos = journal.photoStore(window.indexedDB);
  var urls = [];
  var current;
  function node(tag, text, className) {
    var n = document.createElement(tag);
    if (text) n.textContent = text;
    if (className) n.className = className;
    return n;
  }
  function button(text, action, className) {
    var n = node("button", text, className || "text-btn");
    n.type = "button";
    n.addEventListener("click", action);
    return n;
  }
  function input(label, type, value) {
    var wrap = node("label", "", "field-label");
    wrap.appendChild(node("span", label));
    var n = node(type === "textarea" ? "textarea" : "input", "", "field");
    if (type !== "textarea") n.type = type;
    n.value = value || "";
    wrap.appendChild(n);
    return { wrap: wrap, field: n };
  }
  function message(host) { var n = node("p", "", "quiet feature-status"); n.setAttribute("role", "status"); host.appendChild(n); return n; }
  function image(blob, alt) {
    var url = URL.createObjectURL(blob);
    urls.push(url);
    var img = node("img", "", "journal-photo");
    img.src = url; img.alt = alt;
    return img;
  }
  async function busy(control, status, action) {
    control.disabled = true;
    control.setAttribute("aria-busy", "true");
    status.textContent = "One moment…";
    try { await action(); }
    catch (error) { status.textContent = error.message || "Could not finish. Please try again."; }
    finally { control.disabled = false; control.removeAttribute("aria-busy"); }
  }
  function connectHint(host) {
    host.appendChild(node("p", "Gemini is optional. Connect it in Settings to get a little help here.", "quiet"));
  }
  function settings(host) {
    var section = node("details", "", "guide ai-settings");
    section.appendChild(node("summary", "Gemini assistance"));
    section.appendChild(node("p", ai.ready() ? "Connected. You choose what to share, every time." : "Not connected yet. Photos and reminders still work offline.", "quiet"));
    if (ai.ready()) section.appendChild(button("Disconnect Gemini", function () { ai.disconnect(); current.render(); }));
    else if (ai.serviceOrigin()) {
      var code = input("Access code", "password", "");
      code.field.autocomplete = "off";
      section.append(code.wrap);
      var status = message(section);
      var connect = button("Connect Gemini", function () {
        busy(connect, status, async function () {
          await ai.connect(code.field.value.trim());
          code.field.value = "";
          if (section.isConnected) current.render();
        });
      }, "done");
      section.appendChild(connect);
    } else section.appendChild(node("p", "Gemini is being prepared for Avrit. There’s nothing you need to set up yet.", "quiet"));
    section.appendChild(node("p", "Only a request you send is shared with Google Gemini through Avrit’s service. Photos stay in this app unless you ask Gemini to read one. AI can make mistakes; review suggestions before saving.", "quiet"));
    host.appendChild(section);
  }
  function add(host) {
    var section = node("details", "", "guide ai-compose");
    section.appendChild(node("summary", "✦ Describe it. We’ll draft it."));
    if (!ai.ready()) { connectHint(section); host.insertBefore(section, host.children[3]); return; }
    var prompt = input("What would you like to remember?", "textarea", "");
    prompt.field.maxLength = 800;
    prompt.field.placeholder = "Water the balcony plants every three days";
    section.appendChild(prompt.wrap);
    section.appendChild(node("p", "This description goes to Google Gemini. Your other reminders and photos stay here.", "quiet"));
    var status = message(section);
    var result = node("div", "", "ai-result");
    var ask = button("Send to Gemini · draft reminder", function () {
      busy(ask, status, async function () {
        if (!prompt.field.value.trim()) throw new Error("Describe your reminder first.");
        var suggestion = await ai.suggest({ task: "create", text: prompt.field.value.trim() });
        if (!section.isConnected) return;
        result.replaceChildren(node("h3", suggestion.title), node("p", suggestion.reason, "quiet"));
        result.appendChild(node("p", suggestion.intervalDays ? "Suggested repeat: " + suggestion.intervalDays + " days" : "Choose the interval that works for you.", "quiet"));
        result.appendChild(button("Use this draft", function () {
          document.getElementById("custom-name").value = suggestion.title;
          document.getElementById("custom-gap").value = suggestion.intervalDays || "";
          section.open = false;
          document.getElementById("custom-name").focus();
          current.status("Draft filled in. Review it, then add your rhythm.");
        }, "done"));
        status.textContent = "Review this Gemini draft. Nothing has been saved yet.";
      });
    }, "done");
    section.append(ask, result);
    host.insertBefore(section, host.children[3]);
  }
  function detail(host, item) {
    var section = node("section", "", "journal");
    section.appendChild(node("h3", "Little moments of care"));
    section.appendChild(node("p", "A photo, a note, a little record of showing up.", "quiet"));
    var picker = node("input");
    picker.type = "file"; picker.accept = "image/jpeg,image/png,image/webp,image/heic,image/heif";
    picker.hidden = true;
    picker.setAttribute("aria-label", "Choose a completion photo");
    var choose = button("＋ Log with photo", function () { picker.click(); }, "photo-action");
    choose.id = "log-photo";
    host.querySelector(".detail-hero").appendChild(choose);
    section.appendChild(picker);
    var status = message(section);
    var editor = node("div", "", "photo-editor");
    section.appendChild(editor);
    picker.addEventListener("change", function () {
      var file = picker.files && picker.files[0];
      if (!file) return;
      busy(choose, status, async function () {
        var blob = await journal.preparePhoto(file);
        if (!section.isConnected) return;
        editor.replaceChildren();
        editor.appendChild(image(blob, "Photo ready to log for " + item.title));
        var date = input("Done on", "date", current.today());
        date.field.max = current.today();
        var note = input("A note, if you like", "textarea", "");
        note.field.maxLength = 500;
        editor.append(date.wrap, note.wrap);
        var proposedInterval = null;
        if (ai.ready()) photoAI(editor, item, blob, note.field, function (value) { proposedInterval = value; });
        else connectHint(editor);
        var save = button("Save photo & log", function () {
          busy(save, status, async function () {
            if (!date.field.value || date.field.value > current.today()) throw new Error("Choose today or an earlier day.");
            var live = current.find(item.id);
            if (!live) throw new Error("This rhythm was removed.");
            var previous = journal.logs(live).find(function (entry) { return entry.date === date.field.value; });
            if (previous && previous.photoId && !save.dataset.confirmed) {
              save.dataset.confirmed = date.field.value;
              save.textContent = "Replace this day’s photo & log";
              throw new Error("This day already has a photo. Tap again to replace it.");
            }
            if (previous && previous.photoId && save.dataset.confirmed !== date.field.value) {
              delete save.dataset.confirmed;
              throw new Error("The date changed. Review it, then save again.");
            }
            var savedDate = date.field.value;
            var savedNote = note.field.value.trim();
            var savedInterval = proposedInterval;
            var id = crypto.randomUUID();
            await photos.put(id, blob);
            // Re-read after the asynchronous write so a simultaneous log is preserved.
            live = current.find(item.id);
            if (!live) { await photos.remove([id]); throw new Error("This rhythm was removed."); }
            var next = journal.record(live, savedDate, { photoId: id, note: savedNote });
            if (savedInterval) next = window.AvritEngine.setUserInterval(next, savedInterval);
            if (!current.commit(next)) { await photos.remove([id]); throw new Error("Your device storage is full. The log was not saved."); }
            if (previous && previous.photoId) photos.remove([previous.photoId]).catch(function () {});
            current.haptic();
            if (section.isConnected) current.render();
            current.status("A little care, captured. Photo saved in this app.");
          });
        }, "done");
        editor.append(save, button("Cancel", function () { editor.replaceChildren(); picker.value = ""; status.textContent = ""; }));
        status.textContent = "Stays in this app. Device backups may include it; deleting app data removes it.";
        editor.scrollIntoView({ block: "nearest", behavior: "auto" });
      });
    });
    var list = node("div", "", "journal-list");
    var entries = journal.logs(item);
    var limit = 10;
    function showEntries() {
      list.replaceChildren();
      entries.slice(0, limit).forEach(function (entry) {
        var row = node("article", "", "journal-entry");
        row.appendChild(node("h4", window.AvritEngine.prettyDate(window.AvritEngine.calendarDay(entry.date))));
        row.appendChild(node("p", entry.note || "Care, taken care of.", "quiet"));
        if (entry.photoId) {
          photos.get(entry.photoId).then(function (blob) {
            if (!row.isConnected) return;
            if (blob) row.prepend(image(blob, item.title + " · " + entry.date));
            else row.appendChild(node("p", "Photo unavailable on this device.", "quiet"));
          }).catch(function () { if (row.isConnected) row.appendChild(node("p", "Photo could not be opened.", "quiet")); });
          var remove = button("Remove photo", async function () {
            if (!remove.dataset.armed) { remove.dataset.armed = "1"; remove.textContent = "Confirm remove photo"; return; }
            busy(remove, status, async function () {
              // Remove the blob first: never tell someone a private photo was erased if storage failed.
              await photos.remove([entry.photoId]);
              var live = current.find(item.id);
              if (live && !current.commit(journal.record(live, entry.date, { photoId: null }))) throw new Error("Photo removed, but its log could not be updated.");
              if (section.isConnected) current.render();
            });
          });
          row.appendChild(remove);
        }
        list.appendChild(row);
      });
      if (entries.length > limit) list.appendChild(button("Show earlier moments", function () { limit += 10; showEntries(); }));
    }
    showEntries();
    if (!entries.length) list.appendChild(node("p", "Your first moment is waiting. Log Done or add a photo above.", "quiet"));
    section.appendChild(list);
    host.insertBefore(section, host.querySelector(".guide"));
  }
  function photoAI(host, item, blob, note, useInterval) {
    var section = node("details", "", "guide");
    section.appendChild(node("summary", "✦ Let Gemini help with this photo"));
    section.appendChild(node("p", "Send this photo and the rhythm’s name to Google Gemini for a draft note and optional repeat interval. A photo cannot verify work, safety or health. Review the result before using it.", "quiet"));
    var status = message(section);
    var result = node("div", "", "ai-result");
    var ask = button("Share photo with Gemini", function () {
      busy(ask, status, async function () {
        var data = await ai.suggest({ task: "photo", text: item.title, image: await ai.imageData(blob), mimeType: "image/jpeg" });
        if (!section.isConnected) return;
        result.replaceChildren(node("p", data.note, "quiet"), node("p", data.reason, "quiet"));
        result.appendChild(button("Use draft note", function () { note.value = data.note; status.textContent = "Note added to your draft. Save when you’re ready."; }));
        if (data.intervalDays) result.appendChild(button("Use " + data.intervalDays + "-day repeat", function () {
          useInterval(data.intervalDays);
          status.textContent = "Repeat added to your draft: " + data.intervalDays + " days. Save the photo & log to apply it.";
        }));
        status.textContent = "Gemini suggestion. Use only what fits.";
      });
    }, "done");
    section.append(ask, result);
    host.appendChild(section);
  }
  window.AvritFeatures = {
    mount: function (view, item, callbacks) {
      urls.forEach(function (url) { URL.revokeObjectURL(url); }); urls = [];
      current = callbacks;
      var host = document.getElementById("sheet");
      if (!host) return;
      if (view === "detail" && item) detail(host, item);
      if (view === "add") add(host);
      if (view === "more") settings(host);
    },
    removePhotos: function (item) { return photos.remove(journal.logs(item).map(function (entry) { return entry.photoId; }).filter(Boolean)); }
  };
})();
