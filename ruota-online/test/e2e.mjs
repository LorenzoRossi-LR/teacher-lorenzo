// E2E: tre telefoni separati giocano un'intera partita breve sullo stesso server locale.
// Richiede playwright-core e un Chromium:  npm i -D playwright-core
//   CHROME_PATH=/percorso/chrome  SHOTS=/tmp/ruota-shots  node test/e2e.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer, memoryStore } from "../dev/server.mjs";

const OUT = process.env.SHOTS || `${tmpdir()}/ruota-shots`;
mkdirSync(OUT, { recursive: true });
const PORT = 8791;
const store = memoryStore();
const server = createServer({ store });
await new Promise((r) => server.listen(PORT, r));
const BASE = `http://localhost:${PORT}`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "it-IT" };
const problems = [];

async function player(name) {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`${name} pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${name} console: ${m.text()}`); });
  return { name, page };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (p, tag) => p.page.screenshot({ path: `${OUT}/${tag}-${p.name}.png`, fullPage: true });
const secret = async (code) => (await store.get(code)).room.puzzle.t;
const phase = async (code) => (await store.get(code)).room;

const myTurn = (p) => p.page.waitForSelector("#g-status.you", { timeout: 8000 });
const A = await player("A"), B = await player("B"), C = await player("C");

// A crea la stanza
await A.page.goto(BASE + "/");
await shot(A, "01-home");
await A.page.fill("#h-name", "Lorenzo");
await A.page.tap("#h-create");
await A.page.waitForSelector("#s-lobby:not([hidden])");
const code = (await A.page.textContent("#l-code")).trim();
console.log("stanza", code, "url", A.page.url());

// B e C entrano dal link d'invito
for (const [p, n] of [[B, "Chiara"], [C, "Terzo"]]) {
  await p.page.goto(`${BASE}/${code}`);
  await p.page.fill("#h-name", n);
  await p.page.tap("#h-join");
  await p.page.waitForSelector("#s-lobby:not([hidden])");
}
await sleep(1200);
await shot(A, "02-lobby");
await shot(B, "02-lobby");

// ricarica: la sessione deve sopravvivere
await B.page.reload();
await B.page.waitForSelector("#s-lobby:not([hidden])");

// A avvia la partita breve
await A.page.tap('.seg-btn[data-len="breve"]');
await A.page.tap("#l-start");
for (const p of [A, B, C]) await p.page.waitForSelector("#s-game:not([hidden])", { timeout: 5000 });
await sleep(900);

const byId = async () => {
  const room = await phase(code);
  const ids = room.players.map((p) => p.id);
  return { room, ids };
};
const pageOf = async (pid) => {
  const { room } = await byId();
  const idx = room.players.findIndex((p) => p.id === pid);
  return [A, B, C][idx];
};

// ── manche a ruota: chi è di turno gira, chiama, risolve ──
let room = await phase(code);
let cur = await pageOf(room.players[room.turn].id);
await myTurn(cur);
await shot(cur, "03-turn");
const other = [A, B, C].find((p) => p !== cur);
await shot(other, "03-wait");
await cur.page.tap("#g-spin");
await sleep(1800);
await shot(cur, "04-spun");
room = await phase(code);
room = await phase(code);
cur = await pageOf(room.players[room.turn].id);
const isNum = room.spin && typeof room.spin.value === "number" && !room.spin.spent;
if (isNum) {
  const s = await secret(code);
  const L = [...s.replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, "")][0];
  await cur.page.waitForSelector(`#g-kbd .key[data-l="${L}"]:not([disabled])`, { timeout: 8000 });
  await cur.page.tap(`#g-kbd .key[data-l="${L}"]`);
  await sleep(1200);
  await shot(cur, "05-letter");
}
room = await phase(code);
cur = await pageOf(room.players[room.turn].id);
await myTurn(cur);
await cur.page.tap("#g-solve-open");
await cur.page.fill("#g-solve", await secret(code));
await cur.page.tap("#g-solve-send");
await sleep(900);
await shot(cur, "06-solved");
await sleep(2600);

// ── CruciRuota: B si prenota e risponde ──
for (let i = 0; i < 4; i++) {
  room = await phase(code);
  if (room.phase !== "buzz") break;
  await sleep(2200);                          // qualche lettera compare
  if (i === 0) { await shot(C, "07-buzz"); }
  await B.page.waitForSelector("#b-buzz:not([disabled])", { timeout: 8000 });
  await B.page.tap("#b-buzz");
  await B.page.waitForSelector("#b-answer-row:not([hidden])", { timeout: 8000 });
  await sleep(900);
  if (i === 0) { await shot(B, "08-answering"); await shot(A, "08-other-buzzed"); }
  await B.page.fill("#b-answer", await secret(code));
  await B.page.tap("#b-send");
  await sleep(3200);
}

// ── ultimo round a valore fisso: si risolve e basta ──
room = await phase(code);
if (room.phase === "wheel") {
  cur = await pageOf(room.players[room.turn].id);
  await myTurn(cur);
  await shot(cur, "09-fixed");
  await cur.page.tap("#g-solve-open");
  await cur.page.fill("#g-solve", await secret(code));
  await cur.page.tap("#g-solve-send");
  await sleep(3200);
}

// ── finale ──
room = await phase(code);
console.log("fase dopo le manche:", room.phase);
if (room.phase === "final") {
  const fin = await pageOf(room.final.pid);
  const spect = [A, B, C].find((p) => p !== fin);
  await fin.page.waitForSelector("#f-kbd:not([hidden])", { timeout: 8000 });
  await shot(fin, "10-final-pick");
  for (const L of ["S", "L", "C", "A"]) await fin.page.tap(`#f-kbd .key[data-l="${L}"]`);
  await fin.page.tap("#f-go");
  await sleep(1200);
  await shot(fin, "11-final-board1");
  await shot(spect, "11-final-spectator");
  for (let b = 0; b < 3; b++) {
    await fin.page.waitForSelector("#f-solve-row:not([hidden])", { timeout: 8000 });
    await fin.page.fill("#f-solve", await secret(code));
    await fin.page.tap("#f-send");
    await sleep(1000);
    if (b === 1) await shot(fin, "12-final-rubasecondi");
  }
  await sleep(1200);
  await shot(fin, "13-over");
  await shot(spect, "13-over");
}

room = await phase(code);
console.log("fase finale:", room.phase, "esito:", room.final && room.final.outcome);
console.log("problemi:", problems.length ? problems : "nessuno");
await browser.close();
server.close();
if (problems.length || room.phase !== "over") { console.error("E2E FALLITO"); process.exit(1); }
console.log("E2E OK — schermate in", OUT);
