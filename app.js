(() => {
  const $ = (id) => document.getElementById(id);
  const setup = $("setup"), play = $("play"), teamSettings = $("teamSettings");
  const touchArea = $("touchArea"), emptyState = $("emptyState"), results = $("results");
  const palette = [
    { name: "Viola", bg: "#a78bfa", fg: "#4c1d95" },
    { name: "Verde", bg: "#4ade80", fg: "#14532d" },
    { name: "Corallo", bg: "#fb7185", fg: "#881337" },
    { name: "Azzurro", bg: "#38bdf8", fg: "#0c4a6e" },
    { name: "Giallo", bg: "#facc15", fg: "#713f12" },
    { name: "Fucsia", bg: "#e879f9", fg: "#701a75" }
  ];
  let mode = "first", teamCount = 2, locked = false, timer = null, touches = new Map(), participants = [], nextColor = 0, winnerOverlay = null, lastRandomOrder = null;
  const DRAW_DELAY = 3000;

  document.querySelectorAll(".mode-card").forEach(card => {
    card.addEventListener("click", () => {
      mode = card.dataset.mode;
      document.querySelectorAll(".mode-card").forEach(c => {
        const selected = c === card;
        c.classList.toggle("selected", selected);
        c.setAttribute("aria-pressed", String(selected));
      });
      teamSettings.hidden = mode !== "teams";
    });
  });
  $("teamMinus").addEventListener("click", () => setTeamCount(teamCount - 1));
  $("teamPlus").addEventListener("click", () => setTeamCount(teamCount + 1));
  function setTeamCount(n) { teamCount = Math.max(2, Math.min(6, n)); $("teamCount").textContent = teamCount; }
  $("startBtn").addEventListener("click", showPlay);
  $("changeModeBtn").addEventListener("click", () => { showSetup(); resetRound(); });
  $("themeBtn").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    $("themeBtn").textContent = next === "dark" ? "☀" : "☾";
    $("themeBtn").setAttribute("aria-label", next === "dark" ? "Attiva tema chiaro" : "Attiva tema scuro");
    try { localStorage.setItem("finger-chooser-theme", next); } catch (_) {}
  });
  try {
    const savedTheme = localStorage.getItem("finger-chooser-theme");
    if (savedTheme === "dark") {
      document.documentElement.dataset.theme = "dark";
      $("themeBtn").textContent = "☀";
      $("themeBtn").setAttribute("aria-label", "Attiva tema chiaro");
    }
  } catch (_) {}
  $("restartBtn").addEventListener("click", resetRound);

  function showPlay() {
    setup.hidden = true; play.hidden = false;
    const labels = { first: "MODALITÀ CASUALE", order: "MODALITÀ IN ORDINE", teams: "MODALITÀ A SQUADRE" };
    $("modeLabel").textContent = labels[mode];
    $("instruction").textContent = "Appoggiate tutti un dito";
    $("subinstruction").textContent = "Attendete il segnale: la scelta avverrà dopo qualche secondo.";
    resetRound();
  }
  function showSetup() { play.hidden = true; setup.hidden = false; }

  function resetRound() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    locked = false; touches.forEach(t => t.marker.remove()); touches.clear(); participants = []; nextColor = 0;
    if (winnerOverlay) { winnerOverlay.remove(); winnerOverlay = null; }
    results.replaceChildren(); emptyState.hidden = false;
    $("statusText").textContent = "In attesa";
    $("participantCount").textContent = "0 partecipanti";
    $("instruction").textContent = "Appoggiate tutti un dito";
    $("subinstruction").textContent = "La scelta avverrà dopo 3 secondi.";
  }

  function randomInt(max) {
    if (max <= 1) return 0;
    if (window.crypto?.getRandomValues) {
      const range = 0x100000000;
      const limit = Math.floor(range / max) * max;
      const value = new Uint32Array(1);
      do { window.crypto.getRandomValues(value); } while (value[0] >= limit);
      return value[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function shuffle(items) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function registerPointer(e) {
    if (locked || touches.has(e.pointerId)) return;
    const color = palette[nextColor++ % palette.length];
    const marker = document.createElement("span");
    marker.className = "finger-marker";
    marker.style.background = color.bg;
    marker.style.borderColor = color.fg;
    touchArea.append(marker);
    const rect = touchArea.getBoundingClientRect();
    const playerNumber = touches.size + 1;
    const markerLabel = document.createElement("span");
    markerLabel.className = "finger-label";
    const numberLabel = document.createElement("span");
    numberLabel.className = "finger-number";
    numberLabel.textContent = playerNumber;
    const teamLabel = document.createElement("span");
    teamLabel.className = "finger-team";
    markerLabel.append(numberLabel, teamLabel);
    marker.append(markerLabel);
    const touch = { color, marker, x: e.clientX, y: e.clientY, playerNumber, numberLabel, teamLabel };
    touches.set(e.pointerId, touch);
    positionMarker(touch, e.clientX - rect.left, e.clientY - rect.top);
    emptyState.hidden = true;
    $("statusText").textContent = "";
    $("participantCount").textContent = "";
    if (timer === null) {
      timer = setTimeout(resolveRound, DRAW_DELAY);
    }
  }

  function resolveRound() {
    timer = null;
    if (locked) return;
    const count = touches.size;
    if (!count) {
      emptyState.hidden = false;
      $("statusText").textContent = "In attesa";
      $("instruction").textContent = "Appoggiate tutti un dito";
      return;
    }
    locked = true;
    const activeIds = [...touches.keys()];
    let randomOrder = shuffle(activeIds);
    // Evita di ripetere consecutivamente la stessa estrazione con gli stessi partecipanti.
    if (lastRandomOrder && activeIds.length > 1 &&
        lastRandomOrder.length === randomOrder.length &&
        activeIds.every(id => lastRandomOrder.includes(id)) &&
        randomOrder.every((id, index) => id === lastRandomOrder[index])) {
      for (let attempt = 0; attempt < 8 && randomOrder.every((id, index) => id === lastRandomOrder[index]); attempt++) {
        randomOrder = shuffle(activeIds);
      }
      if (randomOrder.every((id, index) => id === lastRandomOrder[index])) {
        const swapIndex = 1 + randomInt(randomOrder.length - 1);
        [randomOrder[0], randomOrder[swapIndex]] = [randomOrder[swapIndex], randomOrder[0]];
      }
    }
    lastRandomOrder = [...randomOrder];
    if (mode === "first") {
      const winnerId = randomOrder[0];
      participants = [{ id: winnerId, order: 1, team: 0 }];
      for (const [id, touch] of touches) {
        if (id !== winnerId) touch.marker.remove();
      }
      showWinnerOverlay(touches.get(winnerId));
    } else {
      participants = randomOrder.map((id, index) => ({
        id,
        order: index + 1,
        team: mode === "teams" ? index % teamCount : -1
      }));
      participants.forEach(p => {
        const touch = touches.get(p.id);
        const color = mode === "teams" ? palette[p.team % palette.length] : palette[(p.order - 1) % palette.length];
        touch.marker.style.background = color.bg;
        touch.marker.style.borderColor = color.fg;
        touch.numberLabel.textContent = p.order;
        touch.teamLabel.textContent = mode === "teams" ? `S${p.team + 1}` : "";
        touch.marker.classList.add("assigned-marker");
      });
    }
    render();
  }

  touchArea.addEventListener("pointerdown", e => {
    e.preventDefault();
    try { touchArea.setPointerCapture(e.pointerId); } catch (_) {}
    registerPointer(e);
  });
  touchArea.addEventListener("pointermove", e => {
    const touch = touches.get(e.pointerId);
    if (!touch) return;
    const rect = touchArea.getBoundingClientRect();
    touch.x = e.clientX; touch.y = e.clientY;
    positionMarker(touch, e.clientX - rect.left, e.clientY - rect.top);
    if (locked && mode === "first" && participants[0]?.id === e.pointerId) updateWinnerOverlay(touch);
  });
  touchArea.addEventListener("pointerup", e => {
    e.preventDefault();
    if (!locked) {
      const touch = touches.get(e.pointerId);
      if (touch) touch.marker.remove();
      touches.delete(e.pointerId);
      $("participantCount").textContent = `${touches.size} ${touches.size === 1 ? "partecipante" : "partecipanti"}`;
      if (!touches.size && timer !== null) {
        clearTimeout(timer);
        timer = null;
        emptyState.hidden = false;
        $("statusText").textContent = "In attesa";
        $("instruction").textContent = "Appoggiate tutti un dito";
      }
    }
  });
  touchArea.addEventListener("pointercancel", e => {
    if (!locked) {
      const touch = touches.get(e.pointerId);
      if (touch) touch.marker.remove();
      touches.delete(e.pointerId);
      $("participantCount").textContent = `${touches.size} ${touches.size === 1 ? "partecipante" : "partecipanti"}`;
      if (!touches.size && timer !== null) {
        clearTimeout(timer); timer = null;
        emptyState.hidden = false;
        $("statusText").textContent = "In attesa";
        $("instruction").textContent = "Appoggiate tutti un dito";
      }
    }
  });
  touchArea.addEventListener("contextmenu", e => e.preventDefault());


  function positionMarker(touch, x, y) {
    touch.marker.style.left = x + "px";
    touch.marker.style.top = y + "px";
  }

  function showWinnerOverlay(touch) {
    winnerOverlay = document.createElement("div");
    winnerOverlay.className = "winner-overlay";
    winnerOverlay.style.background = touch.color.bg;
    touchArea.append(winnerOverlay);
    touch.marker.classList.add("winner-marker");
    updateWinnerOverlay(touch);
  }

  function updateWinnerOverlay(touch) {
    const rect = touchArea.getBoundingClientRect();
    positionMarker(touch, touch.x - rect.left, touch.y - rect.top);
  }

  function render() {
    if (!participants.length) return;
    emptyState.hidden = true;
    $("statusText").textContent = "Scelta effettuata";
    $("participantCount").textContent = `${participants.length} ${participants.length === 1 ? "partecipante" : "partecipanti"}`;
    results.replaceChildren();
  }

  function makeChip(number, caption, detail, color, winner) {
    const el = document.createElement("div");
    el.className = `result-chip${winner ? " winner" : ""}`;
    el.style.background = color.bg; el.style.color = color.fg;
    const n = document.createElement("span"); n.className = "number"; n.textContent = number;
    const c = document.createElement("span"); c.className = "caption"; c.textContent = caption;
    const d = document.createElement("span"); d.className = "detail"; d.textContent = detail;
    el.append(n, c); if (detail) el.append(d); return el;
  }
  function ordinal(n) { return `${n}°`; }

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); deferredPrompt = e; $("installBtn").hidden = false;
  });
  $("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); await deferredPrompt.userChoice;
    deferredPrompt = null; $("installBtn").hidden = true;
  });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();