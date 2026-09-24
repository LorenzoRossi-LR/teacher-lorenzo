// Motore di gioco autoritativo di Ruota Online.
// Puro: nessun I/O, nessuna dipendenza. Tutto ciò che il server sa sta nello
// stato della stanza; tutto ciò che un giocatore vede passa da viewFor(),
// che non espone mai la frase finché non è risolta.

import { PHRASES, LABELS } from "./corpus.js";

export const LIMITS = Object.freeze({
  MAX_PLAYERS: 3,
  NAME_MAX: 20,
  SOLVE_MAX: 80,
  LOG_MAX: 30,
  VOWEL_COST: 200,
  TURN_IDLE_MS: 60_000,       // turno passato d'ufficio se chi gioca sparisce
  BUZZ_REVEAL_MS: 900,        // una lettera ogni 0,9 s nelle manche a pulsante
  BUZZ_ANSWER_MS: 12_000,     // tempo per rispondere dopo la prenotazione
  BUZZ_TAIL_MS: 5_000,        // attesa a tabellone completo prima di passare oltre
  SHOW_MS: 2_500,             // soluzione mostrata fra una frase e l'altra
  FINAL_MS: 60_000,
  FINAL_PENALTY_MS: 3_000,
  FINAL_PICK_MS: 45_000,      // tempo massimo per scegliere le lettere del finale
  BOT_STEP_MS: 1_800,         // pausa fra una mossa e l'altra di un bot, perché si veda cosa fa
});

// Bot: giocano sul server con le stesse regole e vedono solo ciò che vede un umano,
// tranne quando «indovinano» — e lì la bravura è una probabilità, non una sbirciata gratis.
//   good    probabilità di chiamare una lettera che c'è
//   buy     propensione a comprare vocali
//   solveAt quota di tessere scoperte oltre la quale risolve
//   buzzAt  quota di lettere scoperte oltre la quale si prenota (± 10%)
//   right   probabilità di rispondere giusto dopo la prenotazione
//   final   probabilità di risolvere un tabellone del finale a ogni tentativo
export const BOT_LEVELS = Object.freeze({
  facile: { good: 0.45, buy: 0.25, solveAt: 0.85, buzzAt: 0.75, right: 0.75, final: 0.3 },
  medio: { good: 0.62, buy: 0.35, solveAt: 0.72, buzzAt: 0.6, right: 0.88, final: 0.45 },
  forte: { good: 0.8, buy: 0.45, solveAt: 0.6, buzzAt: 0.47, right: 0.95, final: 0.65 },
});
const BOT_NAMES = ["Ada", "Bruno", "Carla", "Dino", "Elsa", "Furio", "Gina"];
const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const FREQ_CONS = "RNTLSCDMPVGBFZHQ".split("");

const CONS = "BCDFGHJKLMNPQRSTVWXYZ".split("");
const VOW = "AEIOU".split("");
const ACC = { "À": "A", "È": "E", "É": "E", "Ì": "I", "Ò": "O", "Ù": "U" };

const WHEEL = [500, 900, "BANCAROTTA", 700, 600, 1000, "PASSA", 800, 1500, 400, 300, "BANCAROTTA",
  2000, 600, "JOLLY", 700, 900, 500, 1200, "PASSA", 800, 3000, 400, 1000];
export const WHEEL_SECTORS = Object.freeze(WHEEL.slice());

const THEMED = [
  ["animali", "Il regno degli animali"], ["cucina", "La locanda di Samira"],
  ["musica", "Manche musicale"], ["luoghi", "Giro d'Italia"],
  ["film", "Ciak si gira"], ["modi-di-dire", "Chiacchiere da bar"],
];

export class GameError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, msg) => { throw new GameError(code, msg); };

/* ── utilità ─────────────────────────────────────────────── */

export const norm = (c) => ACC[c] || c;
const isLetter = (c) => /[A-Z]/.test(norm(c));
export function normText(s) {
  return String(s || "").toUpperCase().split("").map(norm).join("")
    .replace(/[^A-Z' ]/g, "").replace(/\s+/g, " ").trim();
}
const lettersOf = (t) => [...new Set(t.split("").filter(isLetter).map(norm))];
const countOf = (t, L) => t.split("").filter((c) => norm(c) === L).length;

export function makeRng(randomFn) {
  // randomFn: () => intero casuale 32 bit (crypto). Iniettato per i test.
  return {
    int: (n) => randomFn() % n,
    pick(arr) { return arr[this.int(arr.length)]; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
  };
}

function pickPhrases(rng, n, cat, avoid) {
  let pool = PHRASES.filter(([t, c]) => (!cat || c === cat) && !avoid.has(t));
  if (pool.length < n) pool = PHRASES.filter(([t]) => !avoid.has(t));
  const out = rng.shuffle(pool).slice(0, n).map(([t, c]) => ({ t, cat: c, label: LABELS[c] || "Frase" }));
  out.forEach((p) => avoid.add(p.t));
  return out;
}

function buildManches(rng, length) {
  const th = rng.shuffle(THEMED);
  const tri = rng.pick(THEMED)[0];
  if (length === "breve") {
    return [
      { type: "wheel", name: "Manche classica" },
      { type: "buzz", kind: "cruci", name: "CruciRuota", n: 4 },
      { type: "wheel", name: "Ultimo round", fixed: true },
    ];
  }
  return [
    { type: "wheel", name: "Manche classica" },
    { type: "wheel", name: th[0][1], cat: th[0][0] },
    { type: "buzz", kind: "cruci", name: "CruciRuota", n: 4 },
    { type: "wheel", name: th[1][1], cat: th[1][0] },
    { type: "buzz", kind: "triplete", name: "Triplete", n: 3, cat: tri },
    { type: "wheel", name: "Ultimo round", fixed: true },
  ];
}

function log(room, text, kind = "") {
  room.log.unshift({ text, kind });
  if (room.log.length > LIMITS.LOG_MAX) room.log.length = LIMITS.LOG_MAX;
}

const player = (room, pid) => room.players.find((p) => p.id === pid);
const current = (room) => room.players[room.turn];

/* ── creazione e ingresso ────────────────────────────────── */

export function createRoom({ code, now }) {
  return {
    code, createdAt: now, updatedAt: now, version: 1,
    hostId: null, phase: "lobby", length: "completa",
    players: [], seen: [],
    manches: [], mancheIdx: -1, turn: 0, starter: 0,
    puzzle: null, used: {}, rev: {}, spin: null, freeVowel: false, fixedValue: null,
    lastActionAt: now, buzz: null, final: null, show: null,
    log: [], winnerId: null,
  };
}

export function addPlayer(room, { id, name, tokenHash, now, bot = null }) {
  if (room.phase !== "lobby") fail("started", "La partita è già iniziata.");
  if (room.players.length >= LIMITS.MAX_PLAYERS) fail("full", "La stanza è piena (massimo 3 giocatori).");
  const lower = name.toLowerCase();
  if (room.players.some((p) => p.name.toLowerCase() === lower)) fail("name_taken", "Questo nome è già in stanza.");
  room.players.push({ id, name, tokenHash, bank: 0, round: 0, lastSeen: now, ...(bot ? { bot } : {}) });
  if (!room.hostId && !bot) room.hostId = id;
  log(room, bot ? `${name} (bot, ${bot}) si siede al tavolo.` : `${name} è entrato nella stanza.`);
  return room;
}

/* ── ciclo della partita ─────────────────────────────────── */

function startManche(room, rng, now) {
  const m = room.manches[room.mancheIdx];
  room.players.forEach((p) => { p.round = 0; });
  room.used = {}; room.rev = {}; room.spin = null; room.freeVowel = false;
  room.turn = room.starter % room.players.length;
  room.lastActionAt = now;
  room.show = null;
  const avoid = new Set(room.seen);
  if (m.type === "buzz") {
    room.phase = "buzz";
    const list = pickPhrases(rng, m.n, m.cat, avoid);
    room.buzz = { list, idx: 0, taken: {}, value: 0 };
    room.fixedValue = null;
    log(room, `— ${m.name} —`);
    startBuzzPhrase(room, rng, now);
  } else {
    room.phase = "wheel";
    room.buzz = null;
    room.puzzle = pickPhrases(rng, 1, m.cat, avoid)[0];
    room.fixedValue = m.fixed ? rng.pick([1200, 1500, 1700, 2000]) : null;
    log(room, `— ${m.name} —`);
    if (room.fixedValue) log(room, `Ogni lettera vale € ${room.fixedValue}.`);
  }
  room.seen = [...avoid].slice(-120);
}

function nextManche(room, rng, now) {
  room.players.forEach((p) => { p.round = 0; });
  room.mancheIdx++;
  room.starter = (room.starter + 1) % room.players.length;
  if (room.mancheIdx >= room.manches.length) return startFinal(room, rng, now);
  startManche(room, rng, now);
}

function nextTurn(room, now) {
  room.turn = (room.turn + 1) % room.players.length;
  room.spin = null; room.freeVowel = false;
  room.lastActionAt = now;
}

export function startGame(room, pid, { length }, rng, now) {
  if (room.phase !== "lobby") fail("started", "La partita è già iniziata.");
  if (pid !== room.hostId) fail("not_host", "Solo chi ha creato la stanza può avviare la partita.");
  room.length = length === "breve" ? "breve" : "completa";
  room.manches = buildManches(rng, room.length);
  room.mancheIdx = 0;
  room.starter = 0;
  room.players.forEach((p) => { p.bank = 0; p.round = 0; });
  log(room, `Si parte: partita ${room.length}, ${room.manches.length} manche.`);
  startManche(room, rng, now);
}

/* ── manche a ruota ──────────────────────────────────────── */

function requireTurn(room, pid) {
  if (room.phase !== "wheel") fail("wrong_phase", "Adesso non si gioca con la ruota.");
  if (room.show) fail("wait", "Un attimo: si sta mostrando la soluzione.");
  if (current(room).id !== pid) fail("not_your_turn", "Non è il tuo turno.");
}

function solveManche(room, p, rng, now) {
  lettersOf(room.puzzle.t).forEach((L) => { room.rev[L] = true; });
  p.bank += p.round;
  log(room, `${p.name} risolve: «${room.puzzle.t}» +€ ${p.round}`, "pos");
  room.show = { text: room.puzzle.t, until: now + LIMITS.SHOW_MS };
  room.pendingNext = true;
}

function doSpin(room, pid, rng, now) {
  requireTurn(room, pid);
  if (room.fixedValue) fail("no_spin", "In questa manche la ruota non si gira.");
  if (room.spin && typeof room.spin.value === "number") fail("already_spun", "Hai già girato: chiama una consonante.");
  const p = current(room);
  const sector = rng.int(WHEEL.length);
  room.spinSeq = (room.spinSeq || 0) + 1;
  const v = WHEEL[sector];
  room.lastActionAt = now;
  if (v === "BANCAROTTA") {
    log(room, `${p.name}: BANCAROTTA, persi € ${p.round}.`, "neg");
    p.round = 0;
    room.spin = { sector, value: v };
    nextTurn(room, now);
    room.spin = { sector, value: v, spent: true };
    return;
  }
  if (v === "PASSA") {
    log(room, `${p.name}: PASSA.`, "neg");
    nextTurn(room, now);
    room.spin = { sector, value: v, spent: true };
    return;
  }
  if (v === "JOLLY") {
    room.spin = { sector, value: 1000, jolly: true };
    room.freeVowel = true;
    log(room, `${p.name}: JOLLY! € 1000 e una vocale gratis.`, "pos");
    return;
  }
  room.spin = { sector, value: v };
  log(room, `${p.name} gira: € ${v}.`);
}

function doCall(room, pid, letter, now) {
  requireTurn(room, pid);
  if (!CONS.includes(letter)) fail("bad_letter", "Serve una consonante.");
  const value = room.fixedValue || (room.spin && typeof room.spin.value === "number" && !room.spin.spent ? room.spin.value : 0);
  if (!value) fail("spin_first", "Prima gira la ruota.");
  const p = current(room);
  room.lastActionAt = now;
  if (room.used[letter]) {
    log(room, `${p.name}: la ${letter} era già stata chiamata. Turno perso.`, "neg");
    nextTurn(room, now);
    return;
  }
  room.used[letter] = true;
  const n = countOf(room.puzzle.t, letter);
  if (n > 0) {
    room.rev[letter] = true;
    p.round += value * n;
    log(room, `${p.name}: ${letter} × ${n} = € ${value * n}.`, "pos");
    if (!room.fixedValue) room.spin = null;
  } else {
    log(room, `${p.name}: la ${letter} non c'è.`, "neg");
    nextTurn(room, now);
  }
}

function doBuy(room, pid, letter, now) {
  requireTurn(room, pid);
  if (!VOW.includes(letter)) fail("bad_letter", "Serve una vocale.");
  const p = current(room);
  const cost = room.freeVowel ? 0 : LIMITS.VOWEL_COST;
  if (p.round < cost) fail("no_money", `Servono € ${cost} in gioco per comprare una vocale.`);
  p.round -= cost;
  room.freeVowel = false;
  room.lastActionAt = now;
  if (room.used[letter]) {
    log(room, `${p.name}: la ${letter} era già stata chiamata. Turno perso.`, "neg");
    nextTurn(room, now);
    return;
  }
  room.used[letter] = true;
  const n = countOf(room.puzzle.t, letter);
  if (n > 0) { room.rev[letter] = true; log(room, `${p.name} compra la ${letter} (× ${n}).`, "pos"); }
  else log(room, `${p.name} compra la ${letter}: non c'è.`, "neg");
}

function doSolve(room, pid, text, rng, now) {
  requireTurn(room, pid);
  const p = current(room);
  room.lastActionAt = now;
  if (normText(text) === normText(room.puzzle.t)) return solveManche(room, p, rng, now);
  log(room, `${p.name} sbaglia la soluzione.`, "neg");
  nextTurn(room, now);
}

/* ── manche a pulsante ───────────────────────────────────── */

function startBuzzPhrase(room, rng, now) {
  const b = room.buzz;
  const p = b.list[b.idx];
  room.puzzle = p;
  room.rev = {};
  b.order = rng.shuffle(lettersOf(p.t));
  b.base = 0;
  b.runningSince = now;
  b.locked = [];
  b.answering = null;
  b.answerUntil = 0;
  b.fullAt = 0;
  b.value = room.manches[room.mancheIdx].kind === "triplete" ? [1000, 2000, 3000][b.idx] : 1000;
  b.botAt = {};
  for (const q of room.players) {
    if (q.bot) b.botAt[q.id] = BOT_LEVELS[q.bot].buzzAt + (rng.int(201) - 100) / 1000;
  }
  b.botAnswerAt = 0;
  b.botRight = false;
}

function buzzRevealed(b, now) {
  const running = b.runningSince ? Math.floor((now - b.runningSince) / LIMITS.BUZZ_REVEAL_MS) : 0;
  return Math.min(b.order.length, b.base + running);
}

function applyBuzzReveal(room, now) {
  const b = room.buzz;
  const n = buzzRevealed(b, now);
  room.rev = {};
  b.order.slice(0, n).forEach((L) => { room.rev[L] = true; });
  if (n >= b.order.length && !b.fullAt) b.fullAt = now;
  return n;
}

function endBuzzPhrase(room, rng, now, winner) {
  const b = room.buzz;
  lettersOf(room.puzzle.t).forEach((L) => { room.rev[L] = true; });
  if (winner) {
    winner.bank += b.value;
    b.taken[winner.id] = (b.taken[winner.id] || 0) + 1;
    log(room, `${winner.name} prende «${room.puzzle.t}» +€ ${b.value}`, "pos");
  } else {
    log(room, `Nessuno l'ha presa: «${room.puzzle.t}».`, "neg");
  }
  room.show = { text: room.puzzle.t, until: now + LIMITS.SHOW_MS };
  b.runningSince = 0;
  b.answering = null;
  room.pendingBuzzNext = true;
}

function doBuzz(room, pid, now) {
  if (room.phase !== "buzz" || room.show) fail("wrong_phase", "Adesso non ci si prenota.");
  const b = room.buzz;
  if (b.answering) fail("taken", "Si è già prenotato qualcun altro.");
  if (b.locked.includes(pid)) fail("locked", "Sei fuori da questa frase.");
  b.base = buzzRevealed(b, now);
  b.runningSince = 0;
  b.answering = pid;
  b.answerUntil = now + LIMITS.BUZZ_ANSWER_MS;
  log(room, `${player(room, pid).name} si prenota…`);
}

function lockAndResume(room, pid, rng, now) {
  const b = room.buzz;
  b.locked.push(pid);
  b.answering = null;
  if (b.locked.length >= room.players.length) return endBuzzPhrase(room, rng, now, null);
  b.runningSince = now;
}

function doAnswer(room, pid, text, rng, now) {
  if (room.phase !== "buzz") fail("wrong_phase", "Adesso non si risponde.");
  const b = room.buzz;
  if (b.answering !== pid) fail("not_answering", "Non sei prenotato.");
  const p = player(room, pid);
  if (normText(text) === normText(room.puzzle.t)) return endBuzzPhrase(room, rng, now, p);
  log(room, `${p.name} sbaglia ed è fuori da questa frase.`, "neg");
  lockAndResume(room, pid, rng, now);
}

function finishBuzzManche(room, rng, now) {
  const m = room.manches[room.mancheIdx];
  if (m.kind === "triplete") {
    for (const p of room.players) {
      if (room.buzz.taken[p.id] === 3) { p.bank += 10_000; log(room, `${p.name} fa il TRIPLETE: +€ 10000!`, "pos"); }
    }
  }
  room.buzz = null;
  nextManche(room, rng, now);
}

/* ── finale ──────────────────────────────────────────────── */

const ENVELOPES = [100, 500, 1000, 2000, 3000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000];

function startFinal(room, rng, now) {
  const ranked = room.players.slice().sort((a, b) => b.bank - a.bank);
  const champ = ranked[0];
  room.winnerId = champ.id;
  room.phase = "final";
  room.buzz = null;
  room.spin = null;
  const boards = pickPhrases(rng, 3, null, new Set(room.seen));
  room.final = {
    pid: champ.id, prize: rng.pick(ENVELOPES), boards, idx: 0,
    picks: null, deadline: 0, pickUntil: now + LIMITS.FINAL_PICK_MS,
    called: {}, outcome: null,
  };
  room.puzzle = boards[0];
  room.rev = {};
  log(room, `Campione: ${champ.name} con € ${champ.bank}. Tocca alla Ruota delle Meraviglie.`, "pos");
}

function setFinalBoard(room) {
  const f = room.final;
  room.puzzle = f.boards[f.idx];
  room.rev = {};
  if (f.idx === 0) ["N", "R", "T", "E", ...f.picks].forEach((L) => { room.rev[L] = true; });
  f.called = {};
}

function doFinalPick(room, pid, letters, now) {
  const f = room.final;
  if (room.phase !== "final" || f.pid !== pid) fail("not_finalist", "Il finale lo gioca il campione.");
  if (f.picks) fail("already_picked", "Lettere già scelte.");
  if (!Array.isArray(letters) || letters.length !== 4) fail("bad_pick", "Servono tre consonanti e una vocale.");
  const cons = letters.filter((L) => CONS.includes(L) && !"NRT".includes(L));
  const vows = letters.filter((L) => VOW.includes(L) && L !== "E");
  if (cons.length !== 3 || vows.length !== 1 || new Set(letters).size !== 4) fail("bad_pick", "Servono tre consonanti diverse (non N R T) e una vocale (non E).");
  f.picks = letters.slice();
  f.deadline = now + LIMITS.FINAL_MS;
  setFinalBoard(room);
  log(room, `${player(room, pid).name} sceglie ${letters.join(" ")}: via i 60 secondi.`);
}

function doFinalCall(room, pid, letter, now) {
  const f = room.final;
  if (room.phase !== "final" || f.pid !== pid || !f.picks || f.outcome) fail("not_finalist", "Adesso non puoi chiamare lettere.");
  if (f.idx !== 2) fail("wrong_board", "Le lettere si chiamano solo nel Rubasecondi.");
  if (!CONS.includes(letter) && !VOW.includes(letter)) fail("bad_letter", "Lettera non valida.");
  if (f.called[letter] || countOf(room.puzzle.t, letter) === 0) {
    f.deadline -= LIMITS.FINAL_PENALTY_MS;
    log(room, f.called[letter] ? `${letter} già chiamata: −3 secondi.` : `${letter} non c'è: −3 secondi.`, "neg");
  } else {
    room.rev[letter] = true;
  }
  f.called[letter] = true;
}

function doFinalSolve(room, pid, text, now) {
  const f = room.final;
  if (room.phase !== "final" || f.pid !== pid || !f.picks || f.outcome) fail("not_finalist", "Adesso non puoi risolvere.");
  if (normText(text) !== normText(room.puzzle.t)) { log(room, "Non è questa.", "neg"); return; }
  log(room, `Tabellone ${f.idx + 1}: «${room.puzzle.t}».`, "pos");
  f.idx++;
  if (f.idx >= 3) {
    f.outcome = "won";
    room.phase = "over";
    log(room, `Tutti e tre! Vinti € ${f.prize}.`, "pos");
    return;
  }
  setFinalBoard(room);
}

/* ── tempo: avanza lo stato a ogni lettura ───────────────── */

export function tick(room, rng, now) {
  let changed = false;

  // chi ha creato la stanza sparisce in sala d'attesa: il ruolo passa a chi è presente
  if (room.phase === "lobby" && room.players.length > 1) {
    const host = player(room, room.hostId);
    if (!host || now - host.lastSeen > 30_000) {
      const next = room.players.find((p) => p.id !== room.hostId && !p.bot && now - p.lastSeen < 15_000);
      if (next) { room.hostId = next.id; log(room, `Ora la stanza la gestisce ${next.name}.`); changed = true; }
    }
  }

  if (room.show && now >= room.show.until) {
    room.show = null;
    changed = true;
    if (room.pendingNext) { room.pendingNext = false; nextManche(room, rng, now); }
    else if (room.pendingBuzzNext) {
      room.pendingBuzzNext = false;
      room.buzz.idx++;
      if (room.buzz.idx >= room.buzz.list.length) finishBuzzManche(room, rng, now);
      else startBuzzPhrase(room, rng, now);
    }
  }

  if (room.phase === "wheel" && !room.show && current(room).bot && now - room.lastActionAt >= LIMITS.BOT_STEP_MS) {
    try { botWheelStep(room, current(room), rng, now); }
    catch (e) { if (!(e instanceof GameError)) throw e; nextTurn(room, now); }   // un bot non blocca mai il tavolo
    changed = true;
  }

  if (room.phase === "wheel" && !room.show && now - room.lastActionAt > LIMITS.TURN_IDLE_MS) {
    log(room, `${current(room).name} non gioca da un minuto: turno passato.`, "neg");
    nextTurn(room, now);
    changed = true;
  }

  if (room.phase === "buzz" && room.buzz && !room.show) {
    const b = room.buzz;
    if (b.answering && now > b.answerUntil) {
      log(room, `${player(room, b.answering).name}: tempo scaduto.`, "neg");
      lockAndResume(room, b.answering, rng, now);
      changed = true;
    }
    if (room.phase === "buzz" && room.buzz && !room.show) {
      const before = Object.keys(room.rev).length;
      applyBuzzReveal(room, now);
      if (Object.keys(room.rev).length !== before) changed = true;
      try { if (botBuzzStep(room, rng, now)) changed = true; }
      catch (e) { if (!(e instanceof GameError)) throw e; }
      if (room.phase === "buzz" && room.buzz && !room.show && b.fullAt && !b.answering && now - b.fullAt > LIMITS.BUZZ_TAIL_MS) {
        endBuzzPhrase(room, rng, now, null);
        changed = true;
      }
    }
  }

  if (room.phase === "final" && room.final && !room.final.outcome) {
    try { if (botFinalStep(room, rng, now)) changed = true; }
    catch (e) { if (!(e instanceof GameError)) throw e; }
  }

  if (room.phase === "final" && room.final && !room.final.outcome) {
    const f = room.final;
    if (!f.picks && now > f.pickUntil) {
      f.picks = ["S", "L", "C", "A"];
      f.deadline = now + LIMITS.FINAL_MS;
      setFinalBoard(room);
      log(room, "Tempo di scelta scaduto: lettere assegnate S L C A.");
      changed = true;
    } else if (f.picks && now >= f.deadline) {
      f.outcome = "lost";
      room.phase = "over";
      lettersOf(room.puzzle.t).forEach((L) => { room.rev[L] = true; });
      log(room, `Tempo scaduto al tabellone ${f.idx + 1}: era «${room.puzzle.t}».`, "neg");
      changed = true;
    }
  }

  if (changed) { room.version++; room.updatedAt = now; }
  return changed;
}

/* ── ingresso unico per le azioni ────────────────────────── */

export function dispatch(room, pid, action, rng, now) {
  if (!player(room, pid)) fail("not_in_room", "Non sei in questa stanza.");
  tick(room, rng, now);
  player(room, pid).lastSeen = now;
  switch (action.type) {
    case "start": startGame(room, pid, action, rng, now); break;
    case "spin": doSpin(room, pid, rng, now); break;
    case "call": doCall(room, pid, action.letter, now); break;
    case "buy": doBuy(room, pid, action.letter, now); break;
    case "solve": doSolve(room, pid, action.text, rng, now); break;
    case "buzz": doBuzz(room, pid, now); break;
    case "answer": doAnswer(room, pid, action.text, rng, now); break;
    case "final_pick": doFinalPick(room, pid, action.letters, now); break;
    case "final_call": doFinalCall(room, pid, action.letter, now); break;
    case "final_solve": doFinalSolve(room, pid, action.text, now); break;
    case "kick": doKick(room, pid, action.target); break;
    case "add_bot": doAddBot(room, pid, action.level, rng, now); break;
    case "rematch": doRematch(room, pid, now); break;
    default: fail("bad_action", "Azione sconosciuta.");
  }
  room.version++;
  room.updatedAt = now;
  return room;
}

function doAddBot(room, pid, level, rng, now) {
  if (pid !== room.hostId) fail("not_host", "Solo chi ha creato la stanza può aggiungere bot.");
  if (room.phase !== "lobby") fail("started", "I bot si aggiungono prima di iniziare.");
  if (!BOT_LEVELS[level]) fail("bad_level", "Livello sconosciuto.");
  const taken = new Set(room.players.map((p) => p.name.toLowerCase()));
  const name = BOT_NAMES.find((n) => !taken.has(n.toLowerCase()));
  if (!name) fail("full", "Niente più posti.");
  // id con lo stesso formato di quelli umani; nessun token: nessuno può giocare al posto di un bot
  const id = Array.from({ length: 16 }, () => ID_ALPHABET[rng.int(64)]).join("");
  addPlayer(room, { id, name, tokenHash: null, now, bot: level });
}

function doKick(room, pid, target) {
  if (pid !== room.hostId) fail("not_host", "Solo chi ha creato la stanza può allontanare qualcuno.");
  if (room.phase !== "lobby") fail("started", "Si può allontanare qualcuno solo prima di iniziare.");
  if (target === pid) fail("bad_target", "Non puoi allontanare te stesso.");
  const p = player(room, target);
  if (!p) fail("bad_target", "Giocatore non trovato.");
  room.players = room.players.filter((x) => x.id !== target);
  log(room, p.bot ? `${p.name} (bot) lascia il tavolo.` : `${p.name} è stato allontanato dalla stanza.`, "neg");
}

function doRematch(room, pid, now) {
  if (pid !== room.hostId) fail("not_host", "Solo chi ha creato la stanza può ricominciare.");
  if (room.phase !== "over") fail("wrong_phase", "La partita non è finita.");
  Object.assign(room, {
    phase: "lobby", manches: [], mancheIdx: -1, turn: 0, starter: 0, puzzle: null,
    used: {}, rev: {}, spin: null, freeVowel: false, fixedValue: null, buzz: null,
    final: null, show: null, winnerId: null, lastActionAt: now, pendingNext: false, pendingBuzzNext: false,
  });
  room.players.forEach((p) => { p.bank = 0; p.round = 0; });
  log(room, "Nuova partita: si torna in sala d'attesa.");
}

/* ── vista per un giocatore: mai la frase in chiaro ──────── */

function maskBoard(room, mode) {
  if (!room.puzzle) return [];
  const showAll = !!room.show || (room.phase === "over");
  return room.puzzle.t.split(" ").map((w) => {
    const chars = w.split("");
    const letterIdx = chars.map((c, i) => (isLetter(c) ? i : -1)).filter((i) => i >= 0);
    const first = letterIdx[0], last = letterIdx[letterIdx.length - 1];
    return chars.map((c, i) => {
      if (!isLetter(c)) return { f: c };
      const L = norm(c);
      if (showAll || room.rev[L]) return { c };
      if (mode === "testacoda" && (i === first || i === last)) return { c, h: 1 };
      return {};
    });
  });
}

export function viewFor(room, pid, now) {
  const me = player(room, pid);
  const m = room.manches[room.mancheIdx] || null;
  const f = room.final;
  const finalMode = room.phase === "final" && f && f.picks && f.idx === 1 && !f.outcome ? "testacoda" : "";
  const b = room.buzz;
  return {
    code: room.code,
    version: room.version,
    now,
    phase: room.phase,
    length: room.length,
    you: pid,
    host: room.hostId === pid,
    hostId: room.hostId,
    players: room.players.map((p) => ({
      id: p.id, name: p.name, bank: p.bank, round: p.round, bot: p.bot || null,
      online: !!p.bot || now - p.lastSeen < 15_000,
    })),
    turn: room.phase === "wheel" && room.players.length ? current(room).id : null,
    manche: m && { n: room.mancheIdx + 1, of: room.manches.length, name: m.name, type: m.type },
    category: room.puzzle ? room.puzzle.label : null,
    board: maskBoard(room, finalMode),
    used: Object.keys(room.used),
    spin: room.spin ? { sector: room.spin.sector, value: room.spin.value, spent: !!room.spin.spent, jolly: !!room.spin.jolly, seq: room.spinSeq || 0 } : null,
    fixedValue: room.fixedValue,
    freeVowel: room.freeVowel,
    vowelCost: LIMITS.VOWEL_COST,
    show: room.show ? { text: room.show.text } : null,
    buzz: b && room.phase === "buzz" ? {
      idx: b.idx, of: b.list.length, value: b.value, answering: b.answering,
      answerLeftMs: b.answering ? Math.max(0, b.answerUntil - now) : 0,
      locked: b.locked.slice(), youLocked: b.locked.includes(pid),
    } : null,
    final: f ? {
      pid: f.pid, youPlay: f.pid === pid, prize: f.outcome ? f.prize : null, idx: f.idx,
      picked: !!f.picks, picks: f.picks, leftMs: f.picks && !f.outcome ? Math.max(0, f.deadline - now) : 0,
      pickLeftMs: !f.picks ? Math.max(0, f.pickUntil - now) : 0,
      called: Object.keys(f.called || {}), outcome: f.outcome,
      board: f.picks ? ["Tabellone 1 · N R T E + le tue lettere", "Tabellone 2 · Testacoda", "Tabellone 3 · Rubasecondi"][Math.min(f.idx, 2)] : null,
    } : null,
    winnerId: room.winnerId,
    log: room.log.slice(0, 12),
    idleLeftMs: room.phase === "wheel" ? Math.max(0, LIMITS.TURN_IDLE_MS - (now - room.lastActionAt)) : 0,
    wheel: WHEEL_SECTORS,
    me: me ? { name: me.name } : null,
  };
}

/* ── bot ─────────────────────────────────────────────────── */

const chance = (rng, p) => rng.int(1000) < p * 1000;

function revealedShare(room) {
  const tiles = room.puzzle.t.split("").filter(isLetter).map(norm);
  return tiles.filter((L) => room.rev[L]).length / tiles.length;
}

function botConsonant(room, lv, rng) {
  const hidden = lettersOf(room.puzzle.t).filter((L) => CONS.includes(L) && !room.rev[L]);
  if (hidden.length && chance(rng, lv.good)) return rng.pick(hidden);
  const unused = FREQ_CONS.filter((L) => !room.used[L]);
  const pool = unused.length ? unused.slice(0, 6) : CONS.filter((L) => !room.used[L]);
  return pool.length ? rng.pick(pool) : rng.pick(CONS);
}

function botVowel(room, lv, rng) {
  const hidden = lettersOf(room.puzzle.t).filter((L) => VOW.includes(L) && !room.rev[L]);
  if (hidden.length && chance(rng, lv.good + 0.15)) return rng.pick(hidden);
  const unused = VOW.filter((L) => !room.used[L]);
  return unused.length ? rng.pick(unused) : null;
}

// Una sola mossa per chiamata: chi guarda vede il bot girare, chiamare, comprare, risolvere.
function botWheelStep(room, p, rng, now) {
  const lv = BOT_LEVELS[p.bot];
  const hidden = lettersOf(room.puzzle.t).filter((L) => !room.rev[L]);
  const hidCons = hidden.filter((L) => CONS.includes(L));
  const hidVow = hidden.filter((L) => VOW.includes(L));
  const spun = room.spin && typeof room.spin.value === "number" && !room.spin.spent;
  const canBuy = room.freeVowel || p.round >= LIMITS.VOWEL_COST;
  const solve = () => doSolve(room, p.id, room.puzzle.t, rng, now);

  if (spun && !room.fixedValue) return doCall(room, p.id, botConsonant(room, lv, rng), now);
  if (!hidden.length || revealedShare(room) >= lv.solveAt) return solve();
  if (!hidCons.length) {
    const v = canBuy && botVowel(room, lv, rng);
    return v ? doBuy(room, p.id, v, now) : solve();
  }
  if (canBuy && hidVow.length && (room.freeVowel || chance(rng, lv.buy))) {
    const v = botVowel(room, lv, rng);
    if (v) return doBuy(room, p.id, v, now);
  }
  if (room.fixedValue) return doCall(room, p.id, botConsonant(room, lv, rng), now);
  return doSpin(room, p.id, rng, now);
}

function botBuzzStep(room, rng, now) {
  const b = room.buzz;
  if (b.answering) {
    const p = player(room, b.answering);
    if (!p || !p.bot || now < b.botAnswerAt) return false;
    if (b.botRight) endBuzzPhrase(room, rng, now, p);
    else { log(room, `${p.name} sbaglia ed è fuori da questa frase.`, "neg"); lockAndResume(room, p.id, rng, now); }
    return true;
  }
  const share = buzzRevealed(b, now) / b.order.length;
  const ready = room.players.filter((q) => q.bot && !b.locked.includes(q.id) && share >= (b.botAt || {})[q.id]);
  if (!ready.length) return false;
  const p = rng.pick(ready);
  doBuzz(room, p.id, now);
  b.botAnswerAt = now + 1200 + rng.int(1500);
  b.botRight = chance(rng, BOT_LEVELS[p.bot].right);
  return true;
}

const BOT_PICKS = [["L", "S", "C", "A"], ["S", "C", "D", "O"], ["L", "C", "M", "I"], ["S", "L", "D", "A"]];

function botFinalStep(room, rng, now) {
  const f = room.final;
  const p = player(room, f.pid);
  if (!p || !p.bot) return false;
  if (!f.picks) {
    if (now < f.pickUntil - LIMITS.FINAL_PICK_MS + 3_000) return false;
    doFinalPick(room, p.id, rng.pick(BOT_PICKS), now);
    f.botNextAt = now + 7_000 + rng.int(8_000);
    return true;
  }
  if (now < f.botNextAt || now >= f.deadline) return false;
  if (chance(rng, BOT_LEVELS[p.bot].final)) doFinalSolve(room, p.id, room.puzzle.t, now);
  f.botNextAt = now + 7_000 + rng.int(8_000);
  return true;
}
