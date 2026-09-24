// Ruota Online — client. Nessuna dipendenza, nessun innerHTML con dati: solo textContent.

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const VOWELS = new Set(["A", "E", "I", "O", "U"]);
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const STORE_KEY = (code) => `ruota:${code}`;

const S = {
  code: null, playerId: null, token: null,
  view: null, busy: false, timer: null, failures: 0,
  wheelDeg: 0, lastSeq: 0, lastRev: new Set(), length: "breve",
  picks: [], localDeadline: 0, answerDeadline: 0,
};

/* ── archiviazione della sessione (per stanza, dura quanto la stanza) ── */

function saveSession() {
  try { localStorage.setItem(STORE_KEY(S.code), JSON.stringify({ playerId: S.playerId, token: S.token })); } catch { /* modalità privata */ }
}
function loadSession(code) {
  try { return JSON.parse(localStorage.getItem(STORE_KEY(code)) || "null"); } catch { return null; }
}
function dropSession(code) {
  try { localStorage.removeItem(STORE_KEY(code)); } catch { /* niente */ }
}

/* ── rete ─────────────────────────────────────────────────── */

async function api(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (S.token) headers.Authorization = `Bearer ${S.token}`;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store", credentials: "omit" });
  let data = null;
  try { data = await res.json(); } catch { /* risposta vuota */ }
  return { ok: res.ok, status: res.status, data: data || {} };
}

function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast._h);
  toast._h = setTimeout(() => { t.hidden = true; }, 2600);
}

async function act(action) {
  if (S.busy) return;
  S.busy = true;
  document.body.classList.add("busy");
  try {
    const r = await api("POST", `/api/rooms/${S.code}/action`, action);
    if (r.data.view) render(r.data.view);
    if (!r.ok) {
      if (r.status === 403 || r.status === 404) return leave(r.data.error ? r.data.error.message : "Stanza non disponibile.");
      toast(r.data.error ? r.data.error.message : "Mossa non riuscita.");
    }
  } catch {
    toast("Connessione assente: riprova.");
  } finally {
    S.busy = false;
    document.body.classList.remove("busy");
  }
}

// Polling adattivo: veloce solo quando il tempo conta davvero, per stare nelle quote gratuite.
function pollDelay() {
  const v = S.view;
  if (document.hidden) return 5000;
  if (!v) return 1200;
  if (v.phase === "buzz" || (v.phase === "final" && v.final && v.final.picked)) return 700;
  if (v.phase === "lobby" || v.phase === "over") return 2500;
  if (v.phase === "wheel" && v.turn === v.you) return 2000;   // le mie mosse tornano già nella risposta
  return 1300;
}

function schedule(ms) {
  clearTimeout(S.timer);
  S.timer = setTimeout(poll, ms);
}

async function poll() {
  if (!S.code || !S.token) return;
  try {
    const r = await api("GET", `/api/rooms/${S.code}`);
    if (r.ok && r.data.view) { S.failures = 0; render(r.data.view); }
    else if (r.status === 403 || r.status === 404) return leave(r.data.error ? r.data.error.message : "La stanza non esiste più.");
    else S.failures++;
  } catch { S.failures++; }
  if (S.failures === 3) toast("Connessione instabile…");
  schedule(Math.min(pollDelay() * (1 + S.failures), 10_000));
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.token) schedule(50); });

/* ── ingresso ─────────────────────────────────────────────── */

function readName() {
  const v = $("h-name").value.trim();
  try { if (v) localStorage.setItem("ruota:name", v); } catch { /* niente */ }
  return v;
}

async function createRoom() {
  const name = readName();
  if (!name) return msg("Scrivi il tuo nome.");
  const r = await api("POST", "/api/rooms", { name });
  if (!r.ok) return msg(r.data.error ? r.data.error.message : "Non riesco a creare la stanza.");
  enter(r.data);
}

async function joinRoom() {
  const name = readName();
  const code = $("h-code").value.trim().toUpperCase();
  if (!name) return msg("Scrivi il tuo nome.");
  if (!CODE_RE.test(code)) return msg("Il codice ha 6 caratteri.");
  const r = await api("POST", `/api/rooms/${code}/join`, { name });
  if (!r.ok) return msg(r.data.error ? r.data.error.message : "Non riesco a entrare.");
  enter(r.data);
}

function enter(data) {
  S.code = data.code; S.playerId = data.playerId; S.token = data.token;
  saveSession();
  history.replaceState(null, "", `/${S.code}`);
  render(data.view);
  schedule(800);
}

function leave(reason) {
  if (S.code) dropSession(S.code);
  clearTimeout(S.timer);
  Object.assign(S, { code: null, playerId: null, token: null, view: null, lastSeq: 0, lastRev: new Set() });
  history.replaceState(null, "", "/");
  show("s-home");
  if (reason) msg(reason);
}

function msg(text) { $("h-msg").textContent = text || ""; }

/* ── schermi ──────────────────────────────────────────────── */

function show(id) {
  for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== id;
}

function render(v) {
  const prev = S.view;
  S.view = v;
  if (v.phase === "lobby") { show("s-lobby"); renderLobby(v); return; }
  show("s-game");
  renderGame(v, prev);
}

function renderLobby(v) {
  $("l-code").textContent = v.code;
  const ul = $("l-players");
  ul.replaceChildren();
  v.players.forEach((p) => {
    const li = el("li");
    li.append(el("span", "who", p.name));
    if (p.id === v.hostId) li.append(el("span", "tag", "stanza"));
    if (p.id === v.you) li.append(el("span", "tag", "tu"));
    if (v.host && p.id !== v.you) {
      const k = el("button", "btn ghost kick", "Allontana");
      k.addEventListener("click", () => act({ type: "kick", target: p.id }));
      li.append(k);
    }
    ul.append(li);
  });
  for (let i = v.players.length; i < 3; i++) ul.append(el("li", "empty", "posto libero"));
  $("l-host").hidden = !v.host;
  $("l-hint").textContent = v.host
    ? "Manda il codice o il link a chi gioca con te, poi avvia quando siete dentro."
    : "Aspetta che chi ha creato la stanza avvii la partita.";
}

/* ── tabellone ────────────────────────────────────────────── */

function renderBoard(v) {
  const host = $("g-board");
  const words = v.board || [];
  const longest = Math.max(1, ...words.map((w) => w.length));
  const width = host.clientWidth || 340;
  const t = Math.max(16, Math.min(34, Math.floor((width - (longest - 1) * 3) / longest)));
  host.style.setProperty("--t", `${t}px`);
  const now = new Set();
  host.replaceChildren();
  words.forEach((w, wi) => {
    const wd = el("div", "word");
    w.forEach((tile, ti) => {
      const d = el("div", "tile");
      if (tile.f) { d.className = "tile fix"; d.textContent = tile.f; }
      else if (tile.c) {
        d.className = tile.h ? "tile hint" : "tile on";
        d.textContent = tile.c;
        const key = `${wi}:${ti}`;
        now.add(key);
        if (!tile.h && !S.lastRev.has(key)) d.classList.add("pop");
      }
      wd.append(d);
    });
    host.append(wd);
  });
  S.lastRev = now;
}

function renderScores(v) {
  const ul = $("g-scores");
  ul.replaceChildren();
  v.players.forEach((p) => {
    const li = el("li");
    if (v.turn === p.id) li.classList.add("turn");
    if (v.buzz && v.buzz.answering === p.id) li.classList.add("buzzing");
    if (!p.online) li.classList.add("off");
    const nm = el("span", "nm", p.name);
    if (p.id === v.you) nm.append(el("span", "me", "TU"));
    li.append(nm);
    li.append(el("span", "rd", `€ ${p.round.toLocaleString("it-IT")}`));
    li.append(el("span", "bk", `banca € ${p.bank.toLocaleString("it-IT")}`));
    ul.append(li);
  });
}

function renderLog(v) {
  const ol = $("g-log");
  ol.replaceChildren();
  v.log.slice(0, 4).forEach((l) => ol.append(el("li", l.kind || "", l.text)));
}

/* ── ruota compatta ───────────────────────────────────────── */

function paintWheel(sectors) {
  const w = $("g-wheel");
  if (w.dataset.painted) return;
  const step = 360 / sectors.length;
  const parts = sectors.map((s, i) => {
    const c = s === "BANCAROTTA" ? "#8E2F25" : s === "PASSA" ? "#4A5A57" : s === "JOLLY" ? "#E0A93F" : (i % 2 ? "#1D7A70" : "#14524E");
    return `${c} ${i * step}deg ${(i + 1) * step}deg`;
  });
  w.style.background = `conic-gradient(${parts.join(",")})`;
  w.dataset.painted = "1";
}

function spinTo(sector, count) {
  const step = 360 / count;
  const target = 360 - (sector * step + step / 2);
  const base = S.wheelDeg - (S.wheelDeg % 360);
  S.wheelDeg = base + 360 * 4 + target;
  $("g-wheel").style.transform = `rotate(${S.wheelDeg}deg)`;
}

/* ── tastiere ─────────────────────────────────────────────── */

function buildKbd(host, onKey) {
  if (host.dataset.built) return;
  ROWS.forEach((row) => {
    const r = el("div", "krow");
    for (const L of row) {
      const k = el("button", VOWELS.has(L) ? "key v" : "key", L);
      k.dataset.l = L;
      k.addEventListener("click", () => onKey(L));
      r.append(k);
    }
    host.append(r);
  });
  host.dataset.built = "1";
}

/* ── partita ──────────────────────────────────────────────── */

function renderGame(v, prev) {
  const m = v.manche;
  $("g-manche").textContent = v.phase === "final" ? "Ruota delle Meraviglie" : v.phase === "over" ? "Fine partita" : (m ? m.name : "");
  $("g-mnum").textContent = m && v.phase !== "final" && v.phase !== "over" ? `${m.n}/${m.of}` : "";
  $("g-cat").textContent = v.category || "";
  renderBoard(v);
  $("g-show").hidden = !v.show;
  $("g-show").textContent = v.show ? v.show.text : "";
  renderScores(v);
  renderLog(v);

  for (const id of ["p-wheel", "p-buzz", "p-final", "p-over"]) $(id).hidden = true;
  const st = $("g-status");
  st.className = "status";

  if (v.phase === "wheel") return renderWheelPane(v, st);
  if (v.phase === "buzz") return renderBuzzPane(v, st, prev);
  if (v.phase === "final") return renderFinalPane(v, st);
  if (v.phase === "over") return renderOverPane(v, st);
}

function nameOf(v, id) {
  const p = v.players.find((x) => x.id === id);
  return p ? p.name : "";
}

function renderWheelPane(v, st) {
  $("p-wheel").hidden = false;
  paintWheel(v.wheel);
  const mine = v.turn === v.you && !v.show;
  st.textContent = v.show ? "Risolta!" : mine ? "Tocca a te" : `Tocca a ${nameOf(v, v.turn)}`;
  if (mine) st.classList.add("you");

  if (v.spin && v.spin.seq && v.spin.seq !== S.lastSeq) {
    S.lastSeq = v.spin.seq;
    spinTo(v.spin.sector, v.wheel.length);
  }
  const val = $("g-value");
  val.className = "value";
  if (v.fixedValue) { val.textContent = `€ ${v.fixedValue}`; }
  else if (v.spin && typeof v.spin.value === "number" && !v.spin.spent) { val.textContent = `€ ${v.spin.value}`; val.classList.add("good"); }
  else if (v.spin && v.spin.spent) { val.textContent = v.spin.value; val.classList.add("bad"); }
  else val.textContent = "—";

  const pending = !!(v.spin && typeof v.spin.value === "number" && !v.spin.spent);
  $("g-spin").disabled = !mine || pending || !!v.fixedValue;
  $("g-spin").textContent = v.fixedValue ? "Valore fisso" : "Gira";
  $("g-solve-open").disabled = !mine;
  if (!mine) $("g-solve-row").hidden = true;

  buildKbd($("g-kbd"), (L) => {
    if (!S.view || S.view.turn !== S.view.you) return;
    act(VOWELS.has(L) ? { type: "buy", letter: L } : { type: "call", letter: L });
  });
  const me = v.players.find((p) => p.id === v.you);
  const canConsonant = mine && (pending || !!v.fixedValue);
  const canVowel = mine && me && me.round >= (v.freeVowel ? 0 : v.vowelCost);
  const used = new Set(v.used);
  for (const k of $("g-kbd").querySelectorAll(".key")) {
    const L = k.dataset.l;
    k.classList.toggle("used", used.has(L));
    k.disabled = VOWELS.has(L) ? !canVowel : !canConsonant;
  }
}

function renderBuzzPane(v, st, prev) {
  $("p-buzz").hidden = false;
  const b = v.buzz;
  if (!b) { st.textContent = v.show ? "Presa!" : ""; $("b-buzz").disabled = true; return; }
  $("b-count").textContent = `Frase ${b.idx + 1} di ${b.of}`;
  $("b-value").textContent = `€ ${b.value.toLocaleString("it-IT")}`;
  const iAnswer = b.answering === v.you;
  const someone = b.answering && !iAnswer;
  $("b-buzz").disabled = !!b.answering || b.youLocked || !!v.show;
  $("b-buzz").textContent = b.youLocked ? "SEI FUORI" : someone ? nameOf(v, b.answering).toUpperCase() : "PRENOTATI";
  $("b-answer-row").hidden = !iAnswer;
  if (iAnswer) {
    S.answerDeadline = performance.now() + b.answerLeftMs;
    const wasAnswering = prev && prev.buzz && prev.buzz.answering === v.you;
    if (!wasAnswering) { $("b-answer").value = ""; $("b-answer").focus(); }
    st.textContent = "Scrivi la frase!";
    st.classList.add("you");
  } else {
    st.textContent = v.show ? "Presa!" : someone ? `${nameOf(v, b.answering)} si è prenotato` : b.youLocked ? "Sei fuori da questa frase" : "Prenotati appena la riconosci";
  }
}

function renderFinalPane(v, st) {
  $("p-final").hidden = false;
  const f = v.final;
  const mine = f.youPlay;
  S.localDeadline = f.picked ? performance.now() + f.leftMs : performance.now() + f.pickLeftMs;
  $("f-title").textContent = f.board || "Scelta delle lettere";
  const kbd = $("f-kbd");
  buildKbd(kbd, (L) => onFinalKey(L));
  if (!mine) {
    st.textContent = `Gioca ${nameOf(v, f.pid)}: tifa!`;
    $("f-hint").textContent = f.picked ? "Tre tabelloni in 60 secondi." : "Sta scegliendo tre consonanti e una vocale.";
    kbd.hidden = true; $("f-go").hidden = true; $("f-solve-row").hidden = true;
    return;
  }
  st.textContent = "Tocca a te";
  st.classList.add("you");
  if (!f.picked) {
    $("f-hint").textContent = "N R T E sono già tue. Scegli tre consonanti e una vocale.";
    kbd.hidden = false; $("f-solve-row").hidden = true; $("f-go").hidden = false;
    for (const k of kbd.querySelectorAll(".key")) {
      const L = k.dataset.l;
      k.disabled = "NRTE".includes(L);
      k.classList.toggle("pick", S.picks.includes(L));
      k.classList.remove("used", "hit");
    }
    const c = S.picks.filter((L) => !VOWELS.has(L)).length, vw = S.picks.filter((L) => VOWELS.has(L)).length;
    $("f-go").disabled = !(c === 3 && vw === 1);
    $("f-go").textContent = c === 3 && vw === 1 ? "Via i 60 secondi" : `Consonanti ${c}/3 · vocale ${vw}/1`;
    return;
  }
  $("f-go").hidden = true;
  $("f-solve-row").hidden = false;
  const rub = f.idx === 2;
  kbd.hidden = !rub;
  $("f-hint").textContent = rub ? "Rubasecondi: ogni lettera assente o ripetuta costa 3 secondi." : f.idx === 1 ? "Testacoda: vedi solo prima e ultima lettera." : "";
  if (rub) {
    const called = new Set(f.called);
    for (const k of kbd.querySelectorAll(".key")) {
      k.disabled = false;
      k.classList.remove("pick");
      k.classList.toggle("used", called.has(k.dataset.l));
    }
  }
}

function onFinalKey(L) {
  const v = S.view;
  if (!v || !v.final || !v.final.youPlay) return;
  if (!v.final.picked) {
    const i = S.picks.indexOf(L);
    if (i >= 0) S.picks.splice(i, 1);
    else if (VOWELS.has(L)) { S.picks = S.picks.filter((x) => !VOWELS.has(x)); S.picks.push(L); }
    else if (S.picks.filter((x) => !VOWELS.has(x)).length < 3) S.picks.push(L);
    renderFinalPane(v, $("g-status"));
    return;
  }
  if (v.final.idx === 2) act({ type: "final_call", letter: L });
}

function renderOverPane(v, st) {
  $("p-over").hidden = false;
  const f = v.final;
  const champ = nameOf(v, v.winnerId);
  $("o-title").textContent = f && f.outcome === "won" ? `${champ} vince € ${f.prize.toLocaleString("it-IT")}!` : `Campione: ${champ}`;
  st.textContent = f && f.outcome === "lost" ? "Il finale è sfuggito per poco." : "";
  const ol = $("o-podium");
  ol.replaceChildren();
  v.players.slice().sort((a, b) => b.bank - a.bank)
    .forEach((p) => ol.append(el("li", null, `${p.name} — € ${p.bank.toLocaleString("it-IT")}`)));
  $("o-again").hidden = !v.host;
}

/* ── cronometri locali, fluidi fra un aggiornamento e l'altro ── */

function frame() {
  const v = S.view;
  if (v && v.phase === "final" && v.final) {
    const left = Math.max(0, S.localDeadline - performance.now());
    const t = $("f-timer");
    t.textContent = (left / 1000).toFixed(1);
    t.classList.toggle("low", left < 10_000);
  }
  if (v && v.phase === "buzz" && v.buzz && v.buzz.answering === v.you) {
    const left = Math.max(0, S.answerDeadline - performance.now());
    $("b-buzz").textContent = `${Math.ceil(left / 1000)} s`;
  }
  requestAnimationFrame(frame);
}

/* ── collegamenti ─────────────────────────────────────────── */

function submitOn(input, button, fn) {
  const go = () => { const t = input.value.trim(); if (t) { fn(t); input.value = ""; } };
  button.addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
}

function wire() {
  $("h-create").addEventListener("click", createRoom);
  $("h-join").addEventListener("click", joinRoom);
  $("h-code").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); });
  try { $("h-name").value = localStorage.getItem("ruota:name") || ""; } catch { /* niente */ }

  for (const b of document.querySelectorAll(".seg-btn")) {
    b.addEventListener("click", () => {
      S.length = b.dataset.len;
      for (const x of document.querySelectorAll(".seg-btn")) {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-checked", x === b ? "true" : "false");
      }
    });
  }
  $("l-start").addEventListener("click", () => act({ type: "start", length: S.length }));
  $("l-leave").addEventListener("click", () => leave());
  $("l-share").addEventListener("click", async () => {
    const url = `${location.origin}/${S.code}`;
    const text = `Giochiamo alla Ruota! Codice ${S.code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Ruota Online", text, url });
      else { await navigator.clipboard.writeText(url); toast("Link copiato"); }
    } catch { /* condivisione annullata */ }
  });

  $("g-spin").addEventListener("click", () => act({ type: "spin" }));
  $("g-solve-open").addEventListener("click", () => {
    const row = $("g-solve-row");
    row.hidden = !row.hidden;
    if (!row.hidden) $("g-solve").focus();
  });
  submitOn($("g-solve"), $("g-solve-send"), (text) => { $("g-solve-row").hidden = true; act({ type: "solve", text }); });

  $("b-buzz").addEventListener("click", () => {
    if (navigator.vibrate) navigator.vibrate(40);
    act({ type: "buzz" });
  });
  submitOn($("b-answer"), $("b-send"), (text) => act({ type: "answer", text }));

  $("f-go").addEventListener("click", () => {
    act({ type: "final_pick", letters: S.picks.slice() });
    S.picks = [];
  });
  submitOn($("f-solve"), $("f-send"), (text) => act({ type: "final_solve", text }));

  $("o-again").addEventListener("click", () => act({ type: "rematch" }));
  $("o-leave").addEventListener("click", () => leave());

  window.addEventListener("resize", () => { if (S.view && S.view.phase !== "lobby") renderBoard(S.view); });
}

function boot() {
  wire();
  requestAnimationFrame(frame);
  const m = /^\/([A-Za-z0-9]{6})$/.exec(location.pathname);
  const code = m ? m[1].toUpperCase() : null;
  if (code && CODE_RE.test(code)) {
    const sess = loadSession(code);
    if (sess && sess.token) {
      S.code = code; S.playerId = sess.playerId; S.token = sess.token;
      schedule(0);
      return;
    }
    $("h-code").value = code;
    msg("");
  }
  show("s-home");
}

boot();
