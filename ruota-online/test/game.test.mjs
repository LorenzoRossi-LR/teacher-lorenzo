// Test di Ruota Online: motore, API e garanzie di sicurezza.
// Avvio: node --test ruota-online/test/

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes as nodeRandomBytes } from "node:crypto";
import { handle } from "../src/api.js";
import { LIMITS } from "../src/engine.js";
import { memoryStore, memoryLimiter } from "../dev/server.mjs";

function setup() {
  let clock = 1_800_000_000_000;
  const store = memoryStore();
  const deps = {
    store, limiter: memoryLimiter(),
    now: () => clock,
    randomBytes: (n) => new Uint8Array(nodeRandomBytes(n)),
    ipSalt: "test",
  };
  const call = async (method, path, { body, token, ip = "1.1.1.1", type = "application/json" } = {}) => {
    const headers = { "content-type": type };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await handle({ method, path, headers, body: body === undefined ? "" : JSON.stringify(body), ip }, deps);
    return { status: res.status, data: JSON.parse(res.body), headers: res.headers };
  };
  return { deps, store, call, advance: (ms) => { clock += ms; }, now: () => clock };
}

async function threeRoom(t) {
  const a = await t.call("POST", "/api/rooms", { body: { name: "Lorenzo" } });
  const code = a.data.code;
  const b = await t.call("POST", `/api/rooms/${code}/join`, { body: { name: "Chiara" }, ip: "2.2.2.2" });
  const c = await t.call("POST", `/api/rooms/${code}/join`, { body: { name: "Terzo" }, ip: "3.3.3.3" });
  return { code, A: a.data, B: b.data, C: c.data };
}

async function secretOf(t, code) {
  return (await t.store.get(code)).room.puzzle.t;
}

const act = (t, code, tok, body) => t.call("POST", `/api/rooms/${code}/action`, { body, token: tok });

/* ── stanza e ingressi ─────────────────────────────────── */

test("crea, entra, massimo tre giocatori, nomi unici", async () => {
  const t = setup();
  const { code, A, B, C } = await threeRoom(t);
  assert.match(code, /^[A-Z2-9]{6}$/);
  assert.equal(C.view.players.length, 3);
  const d = await t.call("POST", `/api/rooms/${code}/join`, { body: { name: "Quarto" }, ip: "4.4.4.4" });
  assert.equal(d.status, 409);
  assert.equal(d.data.error.code, "full");
  const t2 = setup();
  const x = await t2.call("POST", "/api/rooms", { body: { name: "Ana" } });
  const y = await t2.call("POST", `/api/rooms/${x.data.code}/join`, { body: { name: "ana" } });
  assert.equal(y.data.error.code, "name_taken");
  assert.ok(A.view.host && !B.view.host);
});

test("il token non è mai salvato in chiaro", async () => {
  const t = setup();
  const { code, A } = await threeRoom(t);
  const raw = JSON.stringify((await t.store.get(code)).room);
  assert.ok(!raw.includes(A.token));
});

test("solo l'host avvia; fuori turno non si gioca", async () => {
  const t = setup();
  const { code, A, B } = await threeRoom(t);
  assert.equal((await act(t, code, B.token, { type: "start" })).data.error.code, "not_host");
  const s = await act(t, code, A.token, { type: "start", length: "completa" });
  assert.equal(s.status, 200);
  assert.equal(s.data.view.phase, "wheel");
  const turnId = s.data.view.turn;
  const other = [A, B].find((p) => p.playerId !== turnId);
  assert.equal((await act(t, code, other.token, { type: "spin" })).data.error.code, "not_your_turn");
});

/* ── nessuna fuga della soluzione ──────────────────────── */

test("la frase non compare mai nella vista finché non è risolta", async () => {
  const t = setup();
  const { code, A, B, C } = await threeRoom(t);
  await act(t, code, A.token, { type: "start" });
  const secret = await secretOf(t, code);
  for (const p of [A, B, C]) {
    const v = (await t.call("GET", `/api/rooms/${code}`, { token: p.token })).data.view;
    const json = JSON.stringify(v);
    assert.ok(!json.includes(secret), "frase intera esposta");
    const hidden = v.board.flat().filter((tile) => !tile.f && !tile.c).length;
    assert.ok(hidden > 0, "tabellone già scoperto");
    for (const w of secret.split(" ")) if (w.length > 3) assert.ok(!json.includes(`"${w}"`));
    assert.ok(!json.includes("tokenHash"));
  }
});

/* ── ruota: lettere, vocali, ripetizioni, soluzione ────── */

async function turnPlayer(t, code, players) {
  const v = (await t.call("GET", `/api/rooms/${code}`, { token: players[0].token })).data.view;
  return players.find((p) => p.playerId === v.turn);
}

test("lettera ripetuta = turno perso; soluzione giusta porta i soldi in banca", async () => {
  const t = setup();
  const { code, A, B, C } = await threeRoom(t);
  await act(t, code, A.token, { type: "start" });
  const all = [A, B, C];

  // forza uno spicchio numerico: gira finché non esce un valore
  let p, v;
  for (let i = 0; i < 40; i++) {
    p = await turnPlayer(t, code, all);
    v = (await act(t, code, p.token, { type: "spin" })).data.view;
    if (v.spin && typeof v.spin.value === "number" && !v.spin.spent && v.turn === p.playerId) break;
  }
  const secret = await secretOf(t, code);
  const present = [...new Set(secret.replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, ""))][0];
  const r1 = await act(t, code, p.token, { type: "call", letter: present });
  assert.equal(r1.status, 200);
  assert.equal(r1.data.view.turn, p.playerId, "lettera presente: il turno resta");
  assert.ok(r1.data.view.players.find((x) => x.id === p.playerId).round > 0);

  // richiamo la stessa lettera dopo un nuovo giro: turno perso
  let spun;
  for (let i = 0; i < 40; i++) {
    spun = (await act(t, code, p.token, { type: "spin" })).data.view;
    if (spun.turn !== p.playerId) break;              // bancarotta o passa
    if (typeof spun.spin.value === "number") break;
  }
  if (spun.turn === p.playerId) {
    const r2 = await act(t, code, p.token, { type: "call", letter: present });
    assert.notEqual(r2.data.view.turn, p.playerId, "ripetuta: turno perso");
  }

  // chi è di turno risolve
  const q = await turnPlayer(t, code, all);
  const before = (await t.call("GET", `/api/rooms/${code}`, { token: q.token })).data.view.players.find((x) => x.id === q.playerId);
  const s = await act(t, code, q.token, { type: "solve", text: secret.toLowerCase() });
  assert.equal(s.data.view.show.text, secret);
  const after = s.data.view.players.find((x) => x.id === q.playerId);
  assert.equal(after.bank, before.bank + before.round);
  t.advance(LIMITS.SHOW_MS + 10);
  const next = (await t.call("GET", `/api/rooms/${code}`, { token: q.token })).data.view;
  assert.equal(next.manche.n, 2);
});

test("vocale: costa 200 e serve averli in gioco", async () => {
  const t = setup();
  const { code, A } = await (async () => {
    const a = await t.call("POST", "/api/rooms", { body: { name: "Solo" } });
    return { code: a.data.code, A: a.data };
  })();
  await act(t, code, A.token, { type: "start" });
  const r = await act(t, code, A.token, { type: "buy", letter: "A" });
  assert.equal(r.data.error.code, "no_money");
});

test("turno passato d'ufficio dopo un minuto di assenza", async () => {
  const t = setup();
  const { code, A, B } = await threeRoom(t);
  const v0 = (await act(t, code, A.token, { type: "start" })).data.view;
  t.advance(LIMITS.TURN_IDLE_MS + 1000);
  const v1 = (await t.call("GET", `/api/rooms/${code}`, { token: B.token })).data.view;
  assert.notEqual(v1.turn, v0.turn);
});

/* ── pulsante ──────────────────────────────────────────── */

async function jumpToBuzz(t, code, players) {
  // risolve la manche a ruota corrente finché non si arriva alla CruciRuota
  for (let guard = 0; guard < 10; guard++) {
    const v = (await t.call("GET", `/api/rooms/${code}`, { token: players[0].token })).data.view;
    if (v.phase === "buzz") return v;
    const p = players.find((x) => x.playerId === v.turn);
    await act(t, code, p.token, { type: "solve", text: await secretOf(t, code) });
    t.advance(LIMITS.SHOW_MS + 10);
  }
  throw new Error("CruciRuota non raggiunta");
}

test("pulsante: rivelazione a tempo, prenotazione unica, errore esclude, bravo incassa", async () => {
  const t = setup();
  const { code, A, B, C } = await threeRoom(t);
  await act(t, code, A.token, { type: "start", length: "breve" });
  await jumpToBuzz(t, code, [A, B, C]);
  const secret = await secretOf(t, code);

  t.advance(LIMITS.BUZZ_REVEAL_MS * 3 + 10);
  const v1 = (await t.call("GET", `/api/rooms/${code}`, { token: A.token })).data.view;
  const shown = v1.board.flat().filter((x) => x.c).length;
  assert.ok(shown > 0, "dopo 3 intervalli qualcosa è scoperto");

  assert.equal((await act(t, code, B.token, { type: "buzz" })).status, 200);
  assert.equal((await act(t, code, C.token, { type: "buzz" })).data.error.code, "taken");
  const wrong = await act(t, code, B.token, { type: "answer", text: "SICURAMENTE NON E QUESTA" });
  assert.ok(wrong.data.view.buzz.locked.includes(B.playerId));
  assert.equal((await act(t, code, B.token, { type: "buzz" })).data.error.code, "locked");

  assert.equal((await act(t, code, C.token, { type: "buzz" })).status, 200);
  const ok = await act(t, code, C.token, { type: "answer", text: secret });
  assert.equal(ok.data.view.players.find((x) => x.id === C.playerId).bank >= 1000, true);
  assert.equal(ok.data.view.show.text, secret);
});

test("pulsante: chi si prenota e non risponde perde il diritto allo scadere", async () => {
  const t = setup();
  const { code, A, B, C } = await threeRoom(t);
  await act(t, code, A.token, { type: "start", length: "breve" });
  await jumpToBuzz(t, code, [A, B, C]);
  await act(t, code, A.token, { type: "buzz" });
  t.advance(LIMITS.BUZZ_ANSWER_MS + 50);
  const v = (await t.call("GET", `/api/rooms/${code}`, { token: B.token })).data.view;
  assert.ok(v.buzz.locked.includes(A.playerId));
  assert.equal(v.buzz.answering, null);
});

/* ── finale ────────────────────────────────────────────── */

async function jumpToFinal(t, code, players) {
  for (let guard = 0; guard < 40; guard++) {
    const v = (await t.call("GET", `/api/rooms/${code}`, { token: players[0].token })).data.view;
    if (v.phase === "final") return v;
    if (v.phase === "wheel") {
      const p = players.find((x) => x.playerId === v.turn);
      await act(t, code, p.token, { type: "solve", text: await secretOf(t, code) });
    } else if (v.phase === "buzz" && !v.show) {
      await act(t, code, players[1].token, { type: "buzz" });
      await act(t, code, players[1].token, { type: "answer", text: await secretOf(t, code) });
    }
    t.advance(LIMITS.SHOW_MS + 10);
  }
  throw new Error("finale non raggiunto");
}

test("finale: solo il campione gioca, scelta validata, penalità, vittoria", async () => {
  const t = setup();
  const { code, A, B, C } = await threeRoom(t);
  const players = [A, B, C];
  await act(t, code, A.token, { type: "start", length: "breve" });
  const v = await jumpToFinal(t, code, players);
  const champ = players.find((p) => p.playerId === v.final.pid);
  const other = players.find((p) => p.playerId !== v.final.pid);
  assert.equal(v.final.prize, null, "la busta resta segreta fino alla fine");

  assert.equal((await act(t, code, other.token, { type: "final_pick", letters: ["S", "L", "C", "A"] })).data.error.code, "not_finalist");
  assert.equal((await act(t, code, champ.token, { type: "final_pick", letters: ["N", "L", "C", "A"] })).data.error.code, "bad_pick");
  const p = await act(t, code, champ.token, { type: "final_pick", letters: ["S", "L", "C", "A"] });
  assert.ok(p.data.view.final.leftMs > 59_000);

  await act(t, code, champ.token, { type: "final_solve", text: await secretOf(t, code) });
  const v2 = (await t.call("GET", `/api/rooms/${code}`, { token: champ.token })).data.view;
  assert.equal(v2.final.idx, 1);
  assert.ok(v2.board.flat().some((x) => x.h), "Testacoda: prima e ultima lettera visibili");

  await act(t, code, champ.token, { type: "final_solve", text: await secretOf(t, code) });
  const left = (await t.call("GET", `/api/rooms/${code}`, { token: champ.token })).data.view.final.leftMs;
  await act(t, code, champ.token, { type: "final_call", letter: "Q" });
  await act(t, code, champ.token, { type: "final_call", letter: "Q" });
  const left2 = (await t.call("GET", `/api/rooms/${code}`, { token: champ.token })).data.view.final.leftMs;
  assert.ok(left - left2 >= 3000, "penalità applicata");

  const end = await act(t, code, champ.token, { type: "final_solve", text: await secretOf(t, code) });
  assert.equal(end.data.view.phase, "over");
  assert.equal(end.data.view.final.outcome, "won");
  assert.ok(end.data.view.final.prize >= 100);
});

/* ── sicurezza dell'API ────────────────────────────────── */

test("autenticazione: token mancante, finto o di un'altra stanza", async () => {
  const t = setup();
  const { code, A } = await threeRoom(t);
  assert.equal((await t.call("GET", `/api/rooms/${code}`)).status, 401);
  assert.equal((await t.call("GET", `/api/rooms/${code}`, { token: "x".repeat(43) })).status, 403);
  const other = await t.call("POST", "/api/rooms", { body: { name: "Altro" }, ip: "9.9.9.9" });
  assert.equal((await t.call("GET", `/api/rooms/${other.data.code}`, { token: A.token })).status, 403);
});

test("input: tipo, dimensione, codice, mosse e nomi validati", async () => {
  const t = setup();
  assert.equal((await t.call("POST", "/api/rooms", { body: { name: "Ok" }, type: "text/plain" })).status, 415);
  assert.equal((await t.call("POST", "/api/rooms", { body: { name: "x".repeat(5000) } })).status, 413);
  assert.equal((await t.call("GET", "/api/rooms/abc", { token: "x".repeat(43) })).status, 404);
  assert.equal((await t.call("POST", "/api/rooms", { body: { name: "   " } })).status, 400);
  assert.equal((await t.call("POST", "/api/rooms", { body: { name: "Str0nzo" } })).status, 400);

  const x = await t.call("POST", "/api/rooms", { body: { name: "<img src=x onerror=alert(1)>Ale" } });
  assert.equal(x.status, 201);
  assert.ok(!/[<>]/.test(x.data.view.players[0].name));

  const code = x.data.code, tok = x.data.token;
  assert.equal((await act(t, code, tok, { type: "call", letter: "ab" })).status, 400);
  assert.equal((await act(t, code, tok, { type: "rm -rf" })).status, 400);
  assert.equal((await act(t, code, tok, { type: "solve", text: "x".repeat(200) })).status, 400);
});

test("limiti di frequenza: niente enumerazione dei codici", async () => {
  const t = setup();
  let last;
  for (let i = 0; i < 35; i++) {
    last = await t.call("POST", "/api/rooms/ABCDEF/join", { body: { name: "Bot" + i }, ip: "6.6.6.6" });
  }
  assert.equal(last.status, 429);
});

test("host: può allontanare prima dell'inizio, e il token dell'allontanato smette di valere", async () => {
  const t = setup();
  const { code, A, B } = await threeRoom(t);
  const k = await act(t, code, A.token, { type: "kick", target: B.playerId });
  assert.equal(k.status, 200);
  assert.equal((await t.call("GET", `/api/rooms/${code}`, { token: B.token })).status, 403);
});

test("le risposte API non si mettono in cache", async () => {
  const t = setup();
  const r = await t.call("POST", "/api/rooms", { body: { name: "Cache" } });
  assert.equal(r.headers["Cache-Control"], "no-store");
});

/* ── bot ───────────────────────────────────────────────── */

test("bot: solo l'host li aggiunge, in sala d'attesa, entro i tre posti; nessun token", async () => {
  const t = setup();
  const a = await t.call("POST", "/api/rooms", { body: { name: "Lorenzo" } });
  const code = a.data.code;
  const b = await t.call("POST", `/api/rooms/${code}/join`, { body: { name: "Chiara" }, ip: "2.2.2.2" });
  assert.equal((await act(t, code, b.data.token, { type: "add_bot", level: "medio" })).data.error.code, "not_host");
  assert.equal((await act(t, code, a.data.token, { type: "add_bot", level: "imbattibile" })).status, 400);
  const r = await act(t, code, a.data.token, { type: "add_bot", level: "forte" });
  assert.equal(r.status, 200);
  const bot = r.data.view.players.find((p) => p.bot);
  assert.equal(bot.bot, "forte");
  assert.match(bot.id, /^[A-Za-z0-9_-]{16}$/);
  assert.equal((await act(t, code, a.data.token, { type: "add_bot", level: "facile" })).data.error.code, "full");
  const room = (await t.store.get(code)).room;
  assert.equal(room.players.find((p) => p.bot).tokenHash, null);
  // l'host può toglierlo e il posto si libera
  const k = await act(t, code, a.data.token, { type: "kick", target: bot.id });
  assert.equal(k.data.view.players.length, 2);
  await act(t, code, a.data.token, { type: "start", length: "breve" });
  assert.equal((await act(t, code, a.data.token, { type: "add_bot", level: "medio" })).data.error.code, "started");
});

test("bot: una partita contro due bot arriva alla fine da sola, senza mai mostrare la frase", async () => {
  for (const level of ["facile", "medio", "forte"]) {
    const t = setup();
    t.deps.limiter = { hit: async () => true };
    const a = await t.call("POST", "/api/rooms", { body: { name: "Lorenzo" } });
    const code = a.data.code;
    await act(t, code, a.data.token, { type: "add_bot", level });
    await act(t, code, a.data.token, { type: "add_bot", level });
    await act(t, code, a.data.token, { type: "start", length: "breve" });
    let v, steps = 0;
    const phases = new Set();
    for (; steps < 6000; steps++) {
      t.advance(1000);
      const g = await t.call("GET", `/api/rooms/${code}`, { token: a.data.token });
      const secret = (await t.store.get(code)).room.puzzle.t;
      v = g.data.view;
      phases.add(v.phase);
      if (v.phase === "over") break;
      if (!v.show) assert.ok(!JSON.stringify(v).includes(secret), "frase trapelata");
    }
    assert.equal(v.phase, "over", `livello ${level}: partita non conclusa`);
    assert.ok(phases.has("buzz") && phases.has("final"));
    assert.ok(v.players.filter((p) => p.bot).some((p) => p.bank > 0), `livello ${level}: i bot non hanno vinto nulla`);
  }
});
