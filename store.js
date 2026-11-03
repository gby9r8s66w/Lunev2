/* LUNARPACE store.js — localStorage persistence, export/import */
(function () {
  "use strict";

  var KEY = "lunarpace.v1";

  var DEFAULT_SETTINGS = {
    shortDays: 7,
    midDays: 30,
    longDays: 90,
    cycle: { length: 28, lastStart: null }
  };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function seed() {
    var today = new Date();
    function isoInDays(d) {
      var t = new Date(today);
      t.setDate(t.getDate() + d);
      return t.toISOString().slice(0, 10);
    }
    return {
      plans: [
        { id: uid(), title: "interval run", createdAt: today.toISOString(), due: isoInDays(3), status: "active", doneAt: null, tags: ["fitness"] },
        { id: uid(), title: "buy groceries", createdAt: today.toISOString(), due: isoInDays(0), status: "active", doneAt: null, tags: [] },
        { id: uid(), title: "renew gym membership", createdAt: today.toISOString(), due: isoInDays(45), status: "active", doneAt: null, tags: ["admin"] }
      ],
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      streak: { lastDoneDate: null, count: 0 }
    };
  }

  function init() {
    var state = load();
    if (!state) {
      state = seed();
      save(state);
    }
    // migrate missing fields
    state.settings = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
    state.settings.cycle = Object.assign({}, DEFAULT_SETTINGS.cycle, (state.settings || {}).cycle || {});
    state.streak = state.streak || { lastDoneDate: null, count: 0 };
    state.plans = state.plans || [];
    return state;
  }

  function exportJSON(state) {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.plans)) throw new Error("Invalid backup file");
    parsed.settings = Object.assign({}, DEFAULT_SETTINGS, parsed.settings || {});
    parsed.settings.cycle = Object.assign({}, DEFAULT_SETTINGS.cycle, parsed.settings.cycle || {});
    parsed.streak = parsed.streak || { lastDoneDate: null, count: 0 };
    save(parsed);
    return parsed;
  }

  function clearAll() {
    localStorage.removeItem(KEY);
    return init();
  }

  window.Store = {
    KEY: KEY,
    init: init,
    save: save,
    load: load,
    uid: uid,
    exportJSON: exportJSON,
    importJSON: importJSON,
    clearAll: clearAll,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS
  };
})();
