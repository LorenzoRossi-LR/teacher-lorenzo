// E2E: un telefono contro due bot, dalla home al finale, sul server locale.
//   CHROME_PATH=/percorso/chrome  SHOTS=/tmp/ruota-shots  node test/e2e-bots.mjs
// L'umano passa sempre la mano (chiama una consonante che non c'è): così giocano i bot.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer, memoryStore } from "../dev/server.mjs";

const OUT = process.env.SHOTS || `${tmpdir()}/ruota-shots`;
mkdirSync(OUT, { recursive: true });
const PORT = 8792;
const store = memoryStore();
const server = createServer({ store });
await new Promise((r) => server.listen(PORT, r));
const BASE = `http://localhost:${PORT}`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "it-IT" });
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (tag) => page.screenshot({ path: `${OUT}/bots-${tag}.png`, fullPage: true });

await page.goto(BASE + "/");
await page.fill("#h-name", "Lorenzo");
await page.tap("#h-bots");
await page.waitForSelector("#l-players li:nth-child(3) .tag.bot", { timeout: 8000 });
const code = (await page.textContent("#l-code")).trim();
await shot("01-lobby");
const botsHidden = await page.$eval("#l-bots", (e) => e.hidden);
if (!botsHidden) problems.push("i pulsanti per aggiungere bot restano visibili a stanza piena");

await page.tap('.seg-btn[data-len="breve"]');
await page.tap("#l-start");
await page.waitForSelector("#s-game:not([hidden])", { timeout: 5000 });
const room = async () => (await store.get(code)).room;
const me = (await room()).players.find((p) => !p.bot).id;

let shots = 0;
const deadline = Date.now() + 8 * 60_000;
while (Date.now() < deadline) {
  const r = await room();
  if (r.phase === "over") break;
  const myTurn = r.phase === "wheel" && !r.show && r.players[r.turn].id === me;
  if (myTurn && await page.$("#g-status.you")) {
    const absent = [..."QZHJKWXYBFGVPMDCLSTNR"].find((L) => !r.used[L] && !r.puzzle.t.includes(L));
    const spun = r.spin && typeof r.spin.value === "number" && !r.spin.spent;
    if (!r.fixedValue && !spun) { await page.tap("#g-spin"); await sleep(1600); continue; }
    const key = `#g-kbd .key[data-l="${absent}"]:not([disabled])`;
    if (await page.$(key)) await page.tap(key);
    await sleep(800);
    continue;
  }
  if (shots < 4 && (r.phase === "buzz" || (r.phase === "wheel" && r.players[r.turn].id !== me))) {
    await shot(`0${2 + shots}-${r.phase}`); shots++;
  }
  if (r.phase === "final" && shots < 6) { await shot(`0${2 + shots}-final`); shots = 6; }
  await sleep(700);
}
const end = await room();
await sleep(1500);
await shot("09-over");
const log = end.log.map((l) => l.text);
console.log("fase:", end.phase, "· esito finale:", end.final && end.final.outcome);
console.log("punteggi:", end.players.map((p) => `${p.name}${p.bot ? " (bot)" : ""} € ${p.bank}`).join(" · "));
console.log("problemi:", problems.length ? problems : "nessuno");
await browser.close();
server.close();
if (problems.length || end.phase !== "over") { console.error("E2E BOT FALLITO", log.slice(0, 8)); process.exit(1); }
console.log("E2E BOT OK — schermate in", OUT);
