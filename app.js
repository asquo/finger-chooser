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
  let mode = "first", teamCount = 2, locked = false, touches = new Map(), participants = [];
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
    const labels = { first: "MODALITÀ PRIMO", order: "MODALITÀ IN ORDINE", teams: "MODALITÀ A SQUADRE" };
    $("modeLabel").textContent = labels[mode];
    $("instruction").textContent = mode === "first" ? "Chi sarà il più veloce?" : "Appoggiate un dito sullo schermo";
    $("subinstruction").textContent = mode === "first" ? "Il primo tocco vince. Il risultato resterà visibile." : "Ogni dito viene registrato una sola volta. Il risultato resterà visibile.";
    resetRound();
  }
  function showSetup() { play.hidden = true; setup.hidden = false; }
  function resetRound() {
    locked = false; touches.clear(); participants = [];
    results.replaceChildren(); emptyState.hidden = false;
    $("statusText").textContent = "In attesa";
    $("participantCount").textContent = "0 partecipanti";
    $("instruction").textContent = mode === "first" ? "Chi sarà il più veloce?" : "Appoggiate un dito sullo schermo";
  }
  function registerPointer(e) {
    if (locked || touches.has(e.pointerId)) return;
    if (mode === "first") {
      locked = true; participants = [{ id: e.pointerId, order: 1, team: 0 }]; render(); return;
    }
    const order = participants.length + 1;
    const team = mode === "teams" ? (order - 1) % teamCount : -1;
    participants.push({ id: e.pointerId, order, team });
    touches.set(e.pointerId, true); render();
  }
  touchArea.addEventListener("pointerdown", e => {
    e.preventDefault();
    try { touchArea.setPointerCapture(e.pointerId); } catch (_) {}
    registerPointer(e);
  });
  touchArea.addEventListener("pointerup", e => { e.preventDefault(); });
  touchArea.addEventListener("pointercancel", e => { e.preventDefault(); });
  touchArea.addEventListener("contextmenu", e => e.preventDefault());
  function render() {
    if (!participants.length) return;
    emptyState.hidden = true;
    $("statusText").textContent = "Scelta effettuata";
    $("participantCount").textContent = `${participants.length} ${participants.length === 1 ? "partecipante" : "partecipanti"}`;
    results.replaceChildren();
    if (mode === "first") {
      results.append(makeChip("✓", "PRIMO", "Vincitore", palette[0], true));
      $("instruction").textContent = "Abbiamo un vincitore!"; return;
    }
    participants.forEach(p => {
      let color, number, caption, detail = "";
      if (mode === "order") { color = palette[(p.order - 1) % palette.length]; number = p.order; caption = ordinal(p.order); detail = "ordine di arrivo"; }
      else { color = palette[p.team % palette.length]; number = p.order; caption = `Squadra ${p.team + 1}`; detail = color.name; }
      results.append(makeChip(number, caption, detail, color, false));
    });
    $("instruction").textContent = mode === "order" ? "Ordine di selezione" : "Squadre assegnate";
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