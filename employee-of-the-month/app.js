/* Employee of the Month: votes + podium + shame wall. No deps, localStorage only. */
(function () {
  "use strict";

  var TEAM = [
    { id: "boss", name: "@boss, middle-manager" },
    { id: "agy-home", name: "@agy-home, overachiever" },
    { id: "muse-home", name: "@muse-home, font snob" },
    { id: "agy-office", name: "@agy-office, remote left-out" },
    { id: "muse-office", name: "@muse-office, gossip" }
  ];

  var VOTES_KEY = "eotm:votes:v1";
  var SHAME_KEY = "eotm:shame:v1";
  var DEFAULT_SHAME = [
    { name: "???", offense: "nobody yet — main is safe (for now)" }
  ];

  function load(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage full or blocked: page still works for the session */ }
  }

  function getVotes() {
    var v = load(VOTES_KEY, {});
    var out = {};
    TEAM.forEach(function (m) { out[m.id] = Number(v[m.id]) || 0; });
    return out;
  }

  function initials(name) {
    var parts = name.replace(/^@/, "").split(/[-_\s]+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  function renderPodium(votes) {
    var el = document.getElementById("podium");
    var ranked = TEAM.slice().sort(function (a, b) { return votes[b.id] - votes[a.id]; }).slice(0, 3);
    var medals = ["1", "2", "3"];
    el.innerHTML = "";
    ranked.forEach(function (m, i) {
      var step = document.createElement("div");
      step.className = "podium-step";
      step.setAttribute("data-place", medals[i]);
      step.innerHTML =
        '<span class="podium-face" aria-hidden="true">' + initials(m.name) + "</span>" +
        '<span class="podium-name">' + escapeHtml(m.name) + "</span>" +
        '<span class="podium-votes">' + votes[m.id] + " votes</span>" +
        '<span class="podium-bar" aria-hidden="true">' + medals[i] + "</span>";
      el.appendChild(step);
    });
  }

  function renderVotes(votes) {
    var el = document.getElementById("votes");
    el.innerHTML = "";
    TEAM.forEach(function (m) {
      var li = document.createElement("li");
      li.innerHTML =
        '<span class="eotm-who">' + escapeHtml(m.name) + "</span>" +
        '<span class="eotm-count">' + votes[m.id] + " votes</span>";
      var btn = document.createElement("button");
      btn.className = "eotm-vote-btn";
      btn.type = "button";
      btn.textContent = "Vote";
      btn.setAttribute("aria-label", "Vote for " + m.name);
      btn.addEventListener("click", function () {
        var v = getVotes();
        v[m.id] += 1;
        save(VOTES_KEY, v);
        renderAll();
      });
      li.appendChild(btn);
      el.appendChild(li);
    });
  }

  function renderShame() {
    var el = document.getElementById("shame");
    var items = load(SHAME_KEY, DEFAULT_SHAME);
    el.innerHTML = "";
    if (!items.length) {
      var empty = document.createElement("li");
      empty.className = "shame-wall-empty";
      empty.textContent = "Clean record. Suspicious, but clean.";
      el.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var li = document.createElement("li");
      li.innerHTML =
        '<span class="shame-name">' + escapeHtml(item.name) + "</span>" +
        '<span class="shame-offense">' + escapeHtml(item.offense) + "</span>" +
        '<span class="shame-count">shamed ×1</span>';
      el.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderAll() {
    var votes = getVotes();
    renderPodium(votes);
    renderVotes(votes);
    renderShame();
  }

  document.getElementById("reset").addEventListener("click", function () {
    save(VOTES_KEY, {});
    renderAll();
  });

  document.getElementById("shame-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("shame-input");
    var text = input.value.trim();
    if (!text) return;
    var parts = text.split(/—|-:/);
    var items = load(SHAME_KEY, DEFAULT_SHAME);
    if (items.length === 1 && items[0].name === "???") items = [];
    items.push({ name: parts[0].trim().slice(0, 40) || "anonymous", offense: (parts[1] || "broke main").trim().slice(0, 80) });
    save(SHAME_KEY, items);
    input.value = "";
    renderShame();
  });

  renderAll();
})();
