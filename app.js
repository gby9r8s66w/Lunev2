/* LUNARPACE app.js — command bar, board rendering, cycle card, settings */
(function () {
  "use strict";

  var state = Store.init();
  var collapsed = { short: false, mid: false, long: false, anytime: false };

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function daysUntil(iso) {
    if (!iso) return null;
    var a = new Date(todayISO());
    var b = new Date(iso);
    return Math.round((b - a) / 86400000);
  }
  function isoInDays(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- horizon bucketing ---------- */
  function horizonOf(plan) {
    if (!plan.due) return "anytime";
    var d = daysUntil(plan.due);
    var s = state.settings;
    if (d <= s.shortDays) return "short";
    if (d <= s.midDays) return "mid";
    return "long";
  }

  /* ---------- streak ---------- */
  function updateStreak() {
    var today = todayISO();
    var st = state.streak;
    var anyDoneToday = state.plans.some(function (p) { return p.doneAt && p.doneAt.slice(0, 10) === today; });
    if (anyDoneToday) {
      if (st.lastDoneDate !== today) {
        var yesterday = isoInDays(-1);
        st.count = (st.lastDoneDate === yesterday) ? st.count + 1 : 1;
        st.lastDoneDate = today;
        Store.save(state);
      }
    }
    $("streak").textContent = "🔥 " + (st.count || 0);
  }

  /* ---------- cycle card ---------- */
  function renderCycle() {
    var c = state.settings.cycle;
    var text = $("cycle-text"), next = $("cycle-next"), fill = $("cycle-fill");
    if (!c.lastStart) {
      text.textContent = "Set your cycle";
      next.textContent = "settings ⚙";
      fill.style.width = "0%";
      return;
    }
    var start = new Date(c.lastStart);
    var today = new Date(todayISO());
    var day = Math.floor((today - start) / 86400000) % c.length + 1;
    var untilNext = c.length - day + 1;
    text.textContent = "Cycle day " + day + " / " + c.length;
    next.textContent = "Next period in ~" + untilNext + " day" + (untilNext === 1 ? "" : "s");
    fill.style.width = Math.round((day / c.length) * 100) + "%";
  }

  /* ---------- board rendering ---------- */
  function countdownChip(plan) {
    if (!plan.due) return '<span class="chip">ANYTIME</span>';
    var d = daysUntil(plan.due);
    if (d < 0) return '<span class="chip overdue">OVERDUE ' + Math.abs(d) + 'd</span>';
    if (d === 0) return '<span class="chip today">D-0 TODAY</span>';
    return '<span class="chip">D-' + d + "</span>";
  }

  function planCard(plan) {
    var tags = plan.tags.map(function (t) { return '<span class="tag">#' + esc(t) + "</span>"; }).join("");
    var done = plan.status === "done";
    return (
      '<li class="plan-card' + (done ? " done" : "") + '" data-id="' + plan.id + '">' +
        '<button class="plan-toggle" aria-pressed="' + done + '" aria-label="Toggle done">' +
          (done ? "✓" : "") + "</button>" +
        '<div class="plan-body">' +
          '<div class="plan-title" tabindex="0">' + esc(plan.title) + "</div>" +
          (tags ? '<div class="plan-tags">' + tags + "</div>" : "") +
        "</div>" +
        '<div class="plan-side">' +
          countdownChip(plan) +
          '<div class="stepper">' +
            '<button class="step" data-delta="-1" aria-label="one day earlier">−</button>' +
            '<button class="step" data-delta="1" aria-label="one day later">+</button>' +
          "</div>" +
          '<div class="quick-chips">' +
            '<button class="quick" data-days="1">+1d</button>' +
            '<button class="quick" data-days="3">+3d</button>' +
            '<button class="quick" data-days="7">+7d</button>' +
          "</div>" +
        "</div>" +
        '<button class="plan-delete" aria-label="Delete plan">✕</button>' +
      "</li>"
    );
  }

  function sectionProgress(plans) {
    var total = plans.length;
    var done = plans.filter(function (p) { return p.status === "done"; }).length;
    var remaining = total === 0 ? 1 : 1 - done / total;
    return '<div class="section-progress" style="--remaining:' + remaining + '" title="' + done + "/" + total + ' done"></div>';
  }

  function renderBoard() {
    var buckets = { today: [], short: [], mid: [], long: [], anytime: [] };
    state.plans.forEach(function (p) {
      if (p.status === "done" && p.doneAt && p.doneAt.slice(0, 10) !== todayISO()) return; // hide old done
      if (p.due && daysUntil(p.due) === 0 && p.status !== "done") buckets.today.push(p);
      else buckets[horizonOf(p)].push(p);
    });

    ["today", "short", "mid", "long", "anytime"].forEach(function (key) {
      var list = $(key + "-list");
      var count = $(key + "-count");
      var plans = buckets[key];
      count.textContent = plans.length;
      var html = plans.map(planCard).join("");
      if (key !== "today") html = sectionProgress(plans) + html;
      list.innerHTML = html;
      list.classList.toggle("collapsed", key !== "today" && collapsed[key]);
      var title = document.querySelector('[data-shelf="' + key + '"]');
      if (title) title.classList.toggle("open", !collapsed[key]);
    });

    updateStreak();
  }

  /* ---------- command parser ---------- */
  function parseCommand(raw) {
    var tokens = raw.trim().split(/\s+/);
    var cmd = { title: [], due: null, horizon: null, tags: [], action: "add" };

    if (tokens[0] && tokens[0].toLowerCase() === "/help") { cmd.action = "help"; return cmd; }
    if (tokens[0] && tokens[0].toLowerCase() === "/cycle") {
      cmd.action = "cycle";
      cmd.cycleLen = parseInt(tokens[1], 10);
      cmd.cycleStart = tokens[2] || null;
      return cmd;
    }
    if (tokens[0] && (tokens[0].toLowerCase() === "done" || tokens[0].toLowerCase() === "drop")) {
      cmd.action = tokens[0].toLowerCase();
      cmd.matchText = tokens.slice(1).join(" ").toLowerCase();
      return cmd;
    }

    tokens.forEach(function (tok) {
      var t = tok.toLowerCase();
      var m;
      if ((m = t.match(/^\+(\d+)d$/))) { cmd.due = isoInDays(parseInt(m[1], 10)); }
      else if (t === "@short" || t === "@mid" || t === "@long") { cmd.horizon = t.slice(1); }
      else if ((m = t.match(/^#([\w-]+)/))) { cmd.tags.push(m[1]); }
      else { cmd.title.push(tok); }
    });
    cmd.title = cmd.title.join(" ");
    return cmd;
  }

  function forceHorizon(plan, horizon) {
    var s = state.settings;
    if (horizon === "short") plan.due = isoInDays(s.shortDays);
    else if (horizon === "mid") plan.due = isoInDays(s.midDays);
    else if (horizon === "long") plan.due = isoInDays(s.longDays);
  }

  function fuzzyFind(text) {
    var t = text.toLowerCase();
    return state.plans.find(function (p) { return p.title.toLowerCase().indexOf(t) !== -1; });
  }

  function handleCommand(raw) {
    var cmd = parseCommand(raw);
    switch (cmd.action) {
      case "help":
        $("help-overlay").hidden = false;
        return;
      case "cycle":
        if (cmd.cycleLen) state.settings.cycle.length = cmd.cycleLen;
        if (cmd.cycleStart) state.settings.cycle.lastStart = cmd.cycleStart;
        Store.save(state);
        renderCycle();
        return;
      case "done": {
        var p = fuzzyFind(cmd.matchText);
        if (p) { p.status = "done"; p.doneAt = new Date().toISOString(); Store.save(state); renderBoard(); }
        return;
      }
      case "drop": {
        var q = fuzzyFind(cmd.matchText);
        if (q) {
          state.plans = state.plans.filter(function (x) { return x.id !== q.id; });
          Store.save(state); renderBoard();
        }
        return;
      }
      case "add":
        if (!cmd.title) return;
        var plan = {
          id: Store.uid(), title: cmd.title, createdAt: new Date().toISOString(),
          due: cmd.due, status: "active", doneAt: null, tags: cmd.tags
        };
        if (cmd.horizon) forceHorizon(plan, cmd.horizon);
        state.plans.push(plan);
        Store.save(state);
        renderBoard();
    }
  }

  /* ---------- inline editing ---------- */
  function startEdit(card) {
    var plan = state.plans.find(function (p) { return p.id === card.dataset.id; });
    if (!plan) return;
    var titleEl = card.querySelector(".plan-title");
    var input = document.createElement("input");
    input.className = "plan-title-input";
    input.value = plan.title;
    titleEl.replaceWith(input);
    input.focus(); input.select();
    function commit() {
      plan.title = input.value.trim() || plan.title;
      Store.save(state); renderBoard();
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") renderBoard();
    });
    input.addEventListener("blur", commit);
  }

  /* ---------- event wiring ---------- */
  function wire() {
    $("cmd-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var input = $("cmd-input");
      var val = input.value;
      if (!val.trim()) return;
      handleCommand(val);
      input.value = "";
      input.classList.remove("pulse");
      void input.offsetWidth; // reflow to restart animation
      input.classList.add("pulse");
    });

    document.addEventListener("click", function (e) {
      var card = e.target.closest(".plan-card");
      if (!card) {
        if (e.target.closest('[data-shelf]')) {
          var shelf = e.target.closest("[data-shelf]").dataset.shelf;
          collapsed[shelf] = !collapsed[shelf];
          renderBoard();
        }
        return;
      }
      var plan = state.plans.find(function (p) { return p.id === card.dataset.id; });
      if (!plan) return;

      if (e.target.closest(".plan-toggle")) {
        plan.status = plan.status === "done" ? "active" : "done";
        plan.doneAt = plan.status === "done" ? new Date().toISOString() : null;
        Store.save(state); renderBoard();
      } else if (e.target.closest(".plan-delete")) {
        state.plans = state.plans.filter(function (p) { return p.id !== plan.id; });
        Store.save(state); renderBoard();
      } else if (e.target.closest(".step")) {
        var delta = parseInt(e.target.closest(".step").dataset.delta, 10);
        if (plan.due) {
          var d = new Date(plan.due);
          d.setDate(d.getDate() + delta);
          plan.due = d.toISOString().slice(0, 10);
        } else {
          plan.due = isoInDays(delta > 0 ? delta : 0);
        }
        Store.save(state); renderBoard();
      } else if (e.target.closest(".quick")) {
        var days = parseInt(e.target.closest(".quick").dataset.days, 10);
        plan.due = isoInDays(days);
        Store.save(state); renderBoard();
      } else if (e.target.closest(".plan-title")) {
        startEdit(card);
      }
    });

    // settings drawer
    $("btn-settings").addEventListener("click", function () {
      $("set-short").value = state.settings.shortDays;
      $("set-mid").value = state.settings.midDays;
      $("set-long").value = state.settings.longDays;
      $("set-cycle-len").value = state.settings.cycle.length;
      $("set-cycle-start").value = state.settings.cycle.lastStart || "";
      $("settings-drawer").hidden = false;
    });
    $("btn-close-settings").addEventListener("click", function () {
      state.settings.shortDays = parseInt($("set-short").value, 10) || 7;
      state.settings.midDays = parseInt($("set-mid").value, 10) || 30;
      state.settings.longDays = parseInt($("set-long").value, 10) || 90;
      state.settings.cycle.length = parseInt($("set-cycle-len").value, 10) || 28;
      state.settings.cycle.lastStart = $("set-cycle-start").value || null;
      Store.save(state);
      $("settings-drawer").hidden = true;
      renderBoard(); renderCycle();
    });
    $("settings-drawer").addEventListener("click", function (e) {
      if (e.target === $("settings-drawer")) $("settings-drawer").hidden = true;
    });

    // export / import / clear
    $("btn-export").addEventListener("click", function () {
      var blob = new Blob([Store.exportJSON(state)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "lunarpace-backup.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $("btn-import").addEventListener("click", function () { $("import-file").click(); });
    $("import-file").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          state = Store.importJSON(reader.result);
          renderBoard(); renderCycle();
          alert("Imported ✓");
        } catch (err) { alert("Import failed: " + err.message); }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
    $("btn-clear").addEventListener("click", function () {
      if (!confirm("Delete ALL plans and settings?")) return;
      state = Store.clearAll();
      renderBoard(); renderCycle();
      $("settings-drawer").hidden = true;
    });

    // help
    $("btn-help").addEventListener("click", function () { $("help-overlay").hidden = false; });
    $("btn-close-help").addEventListener("click", function () { $("help-overlay").hidden = true; });
    $("help-overlay").addEventListener("click", function (e) {
      if (e.target === $("help-overlay")) $("help-overlay").hidden = true;
    });
  }

  /* ---------- init ---------- */
  function init() {
    var now = new Date();
    Moon.renderMoon(now);
    Moon.renderDateBlock(now);
    renderCycle();
    renderBoard();
    wire();

    // service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
