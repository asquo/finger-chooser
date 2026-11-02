(() => {
  const $ = (id) => document.getElementById(id);
  const setup = $("setup"), play = $("play"), teamSettings = $("teamSettings");
  const touchArea = $("touchArea"), emptyState = $("emptyState"), results = $("results");
  const palette = [
    { name: "Lavanda", bg: "#e9eaff", fg: "#555db5" },
    { name: "Menta", bg: "#dcf5e9", fg: "#397c5b" },
    { name: "Pesca", bg: "#ffeadf", fg: "#a85e43" },
    { name: "Cielo", bg: "#dff0ff", fg: "#3976a5" },
    { name: "Limone", bg: "#fff3cc", fg: "#94742b" },
    { name: "Rosa", bg: "#ffe3ee", fg: "#a64e73" }
  ];
  let mode = "first", teamCount = 2, locked = false, timer = null, touches = new Map(), participants = [];
  const MIN_DELAY = 2000, MAX_DELAY = 5000;

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
    locked = false; touches.clear(); participants = [];
    results.replaceChildren(); emptyState.hidden = false;
    $("statusText").textContent = "In attesa";
    $("participantCount").textContent = "0 partecipanti";
    $("instruction").textContent = "Appoggiate tutti un dito";
    $("subinstruction").textContent = "La scelta avverrà dopo un intervallo casuale.";
  }

  function shuffle(items) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function registerPointer(e) {
    if (locked || touches.has(e.pointerId)) return;
    touches.set(e.pointerId, true);
    emptyState.hidden = true;
    $("statusText").textContent = "In attesa della scelta…";
    $("participantCount").textContent = `${touches.size} ${touches.size === 1 ? "partecipante" : "partecipanti"}`;
    $("instruction").textContent = "Tenete le dita appoggiate";
    if (timer === null) {
      const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
      timer = setTimeout(resolveRound, delay);
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
    const randomOrder = shuffle([...touches.keys()]);
    if (mode === "first") {
      participants = [{ id: randomOrder[0], order: 1, team: 0 }];
    } else {
      participants = randomOrder.map((id, index) => ({
        id,
        order: index + 1,
        team: mode === "teams" ? index % teamCount : -1
      }));
    }
    render();
  }

  touchArea.addEventListener("pointerdown", e => {
    e.preventDefault();
    try { touchArea.setPointerCapture(e.pointerId); } catch (_) {}
    registerPointer(e);
  });
  touchArea.addEventListener("pointerup", e => {
    e.preventDefault();
    if (!locked) {
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

  function render() {
    if (!participants.length) return;
    emptyState.hidden = true;
    $("statusText").textContent = "Scelta effettuata";
    $("participantCount").textContent = `${participants.length} ${participants.length === 1 ? "partecipante" : "partecipanti"}`;
    results.replaceChildren();
    if (mode === "first") {
      results.append(makeChip("✓", "SCELTO", "Dito estratto a caso", palette[0], true));
      $("instruction").textContent = "Questo è il dito scelto!";
      return;
    }
    participants.forEach(p => {
      let color, number, caption, detail = "";
      if (mode === "order") {
        color = palette[(p.order - 1) % palette.length];
        number = p.order; caption = ordinal(p.order); detail = "ordine casuale";
      } else {
        color = palette[p.team % palette.length];
        number = p.order; caption = `Squadra ${p.team + 1}`; detail = color.name;
      }
      results.append(makeChip(number, caption, detail, color, false));
    });
    $("instruction").textContent = mode === "order" ? "Ecco l'ordine casuale!" : "Ecco le squadre!";
  }

  function makeChip(number, caption, detail, color, winner) {
    const el = document.createElement("div");
    el.className = `result-chip${winner ? " winner" : ""}`;
    el.style.background = color.bg; el.style.color = color.fg;
    const n = document.createElement("span"); n.className = "number"; n.textContent = number;
    const c = document.createElement("span"); c.className = "caption"; c.textContent = caption;
    const d = document.createElement("span"); d.className = "detail"; d.textContent = detail;
    el.append(n, c, d); return el;
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