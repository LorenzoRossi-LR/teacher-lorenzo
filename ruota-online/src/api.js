// API HTTP di Ruota Online, indipendente dalla piattaforma.
// Ogni adattatore (Cloudflare, Vercel, server locale) traduce la propria richiesta in
// { method, path, headers, body, ip } e fornisce `deps` con store, limitatore e casualità.
//
// Contratto:
//   POST /api/rooms                 {name}            → {code, playerId, token, view}
//   POST /api/rooms/:code/join      {name}            → {code, playerId, token, view}
//   GET  /api/rooms/:code                (Bearer)     → {view}
//   POST /api/rooms/:code/action    {type,…} (Bearer) → {view}
//
// deps = {
//   store: { get(code) → {room, etag}|null, put(code, room, etag|null, ttlSec) → bool (CAS) },
//   limiter: { hit(key, limit, windowSec) → bool }            (durevole: ingressi e creazioni)
//   fastLimiter: { hit(key, limit, windowSec) → bool }        (in memoria: letture e mosse, costo zero)
//   now: () → ms, randomBytes: (n) → Uint8Array, ipSalt: string (ruota ogni giorno)
// }

import { createRoom, addPlayer, dispatch, tick, viewFor, makeRng, GameError, LIMITS } from "./engine.js";
import {
  API_HEADERS, MAX_BODY_BYTES, CODE_RE, TOKEN_RE, ROOM_TTL_SEC, RATE,
  cleanName, nameProblem, b64url, randomCode, sha256hex, safeEqual,
} from "./security.js";

const LETTER_RE = /^[A-Z]$/;
const ACTIONS = new Set(["start", "spin", "call", "buy", "solve", "buzz", "answer",
  "final_pick", "final_call", "final_solve", "kick", "rematch", "add_bot"]);
const BOT_LEVEL_RE = /^(facile|medio|forte)$/;

const json = (status, obj) => ({ status, headers: { ...API_HEADERS }, body: JSON.stringify(obj) });
const err = (status, code, message) => json(status, { error: { code, message } });

function rngFrom(randomBytes) {
  return makeRng(() => {
    const b = randomBytes(4);
    return ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  });
}

function parseBody(req) {
  const ct = (req.headers["content-type"] || "").toLowerCase();
  if (!ct.startsWith("application/json")) return { error: err(415, "bad_type", "Serve JSON.") };
  const raw = req.body || "";
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return { error: err(413, "too_big", "Richiesta troppo grande.") };
  try {
    const v = JSON.parse(raw || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return { error: err(400, "bad_json", "Formato non valido.") };
    return { value: v };
  } catch {
    return { error: err(400, "bad_json", "Formato non valido.") };
  }
}

function bearer(req) {
  const h = req.headers["authorization"] || "";
  const m = /^Bearer ([A-Za-z0-9_-]+)$/.exec(h);
  return m && TOKEN_RE.test(m[1]) ? m[1] : null;
}

// Valida e normalizza un'azione: tutto ciò che non è previsto viene scartato.
function cleanAction(a) {
  if (!a || typeof a.type !== "string" || !ACTIONS.has(a.type)) return null;
  const out = { type: a.type };
  switch (a.type) {
    case "call": case "buy": case "final_call":
      if (typeof a.letter !== "string" || !LETTER_RE.test(a.letter)) return null;
      out.letter = a.letter;
      break;
    case "solve": case "answer": case "final_solve":
      if (typeof a.text !== "string" || a.text.length > LIMITS.SOLVE_MAX) return null;
      out.text = a.text;
      break;
    case "final_pick":
      if (!Array.isArray(a.letters) || a.letters.length !== 4 || !a.letters.every((L) => typeof L === "string" && LETTER_RE.test(L))) return null;
      out.letters = a.letters.slice();
      break;
    case "start":
      out.length = a.length === "breve" ? "breve" : "completa";
      break;
    case "add_bot":
      if (typeof a.level !== "string" || !BOT_LEVEL_RE.test(a.level)) return null;
      out.level = a.level;
      break;
    case "kick":
      if (typeof a.target !== "string" || !/^[A-Za-z0-9_-]{16}$/.test(a.target)) return null;
      out.target = a.target;
      break;
  }
  return out;
}

async function ipKey(req, deps) {
  // L'IP non viene mai salvato in chiaro: solo un hash con sale giornaliero, per i limiti di frequenza.
  return (await sha256hex(`${deps.ipSalt}|${req.ip || "?"}`)).slice(0, 24);
}

async function limited(deps, key, rule, fast = false) {
  const l = fast && deps.fastLimiter ? deps.fastLimiter : deps.limiter;
  return !(await l.hit(key, rule.limit, rule.windowSec));
}

// Legge, modifica e riscrive la stanza con controllo di concorrenza (fino a 4 tentativi).
async function mutate(deps, code, fn) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = await deps.store.get(code);
    if (!cur) return { missing: true };
    const room = cur.room;
    const before = room.version;
    let result, error;
    try { result = await fn(room); } catch (e) { error = e; }
    if (room.version === before && error) return { error };
    if (room.version === before) return { room, result };
    const ok = await deps.store.put(code, room, cur.etag, ROOM_TTL_SEC);
    if (ok) return error ? { error, room } : { room, result };
  }
  return { conflict: true };
}

function gameErrorResponse(e) {
  if (e instanceof GameError) return err(409, e.code, e.message);
  return err(500, "server", "Errore interno.");
}

async function authPlayer(room, token) {
  const h = await sha256hex(token);
  return room.players.find((p) => safeEqual(p.tokenHash, h)) || null;
}

export async function handle(req, deps) {
  const now = deps.now();
  const rng = rngFrom(deps.randomBytes);
  const path = req.path.replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);           // ["api","rooms",code?,sub?]
  if (parts[0] !== "api" || parts[1] !== "rooms" || parts.length > 4) return err(404, "not_found", "Non trovato.");

  const ip = await ipKey(req, deps);

  // ── crea stanza ──────────────────────────────────────────
  if (parts.length === 2) {
    if (req.method !== "POST") return err(405, "method", "Metodo non ammesso.");
    if (await limited(deps, `c:${ip}`, RATE.create)) return err(429, "slow_down", "Troppe stanze create: riprova più tardi.");
    const body = parseBody(req); if (body.error) return body.error;
    const name = cleanName(body.value.name);
    const problem = nameProblem(name);
    if (problem) return err(400, "bad_name", problem);

    for (let i = 0; i < 5; i++) {
      const code = randomCode(deps.randomBytes);
      const room = createRoom({ code, now });
      const token = b64url(deps.randomBytes(32));
      const playerId = b64url(deps.randomBytes(12));
      addPlayer(room, { id: playerId, name, tokenHash: await sha256hex(token), now });
      if (await deps.store.put(code, room, null, ROOM_TTL_SEC)) {
        return json(201, { code, playerId, token, view: viewFor(room, playerId, now) });
      }
    }
    return err(503, "busy", "Riprova fra un istante.");
  }

  const code = parts[2];
  if (!CODE_RE.test(code)) return err(404, "not_found", "Stanza inesistente o scaduta.");

  // ── entra in una stanza ──────────────────────────────────
  if (parts[3] === "join") {
    if (req.method !== "POST") return err(405, "method", "Metodo non ammesso.");
    if (await limited(deps, `j:${ip}`, RATE.join)) return err(429, "slow_down", "Troppi tentativi: aspetta qualche minuto.");
    const body = parseBody(req); if (body.error) return body.error;
    const name = cleanName(body.value.name);
    const problem = nameProblem(name);
    if (problem) return err(400, "bad_name", problem);
    const token = b64url(deps.randomBytes(32));
    const playerId = b64url(deps.randomBytes(12));
    const tokenHash = await sha256hex(token);
    const r = await mutate(deps, code, (room) => {
      tick(room, rng, now);
      addPlayer(room, { id: playerId, name, tokenHash, now });
      room.version++;
    });
    if (r.missing) return err(404, "not_found", "Stanza inesistente o scaduta.");
    if (r.conflict) return err(503, "busy", "Riprova fra un istante.");
    if (r.error) return gameErrorResponse(r.error);
    return json(201, { code, playerId, token, view: viewFor(r.room, playerId, now) });
  }

  const token = bearer(req);
  if (!token) return err(401, "auth", "Sessione mancante: rientra nella stanza.");

  // ── stato ────────────────────────────────────────────────
  if (parts.length === 3) {
    if (req.method !== "GET") return err(405, "method", "Metodo non ammesso.");
    if (await limited(deps, `r:${ip}`, RATE.read, true)) return err(429, "slow_down", "Rallenta.");
    let me = null;
    const r = await mutate(deps, code, async (room) => {
      me = await authPlayer(room, token);
      if (!me) throw new GameError("auth", "Non fai parte di questa stanza.");
      const seenBefore = me.lastSeen;
      me.lastSeen = now;
      tick(room, rng, now);
      // la presenza si salva al massimo ogni 5 s, per non scrivere a ogni lettura
      if (now - seenBefore > 5000) room.version++;
    });
    if (r.missing) return err(404, "not_found", "Stanza inesistente o scaduta.");
    if (r.conflict) return err(503, "busy", "Riprova fra un istante.");
    if (r.error) return r.error.code === "auth" ? err(403, "auth", r.error.message) : gameErrorResponse(r.error);
    return json(200, { view: viewFor(r.room, me.id, now) });
  }

  // ── azione ───────────────────────────────────────────────
  if (parts[3] === "action") {
    if (req.method !== "POST") return err(405, "method", "Metodo non ammesso.");
    const body = parseBody(req); if (body.error) return body.error;
    const action = cleanAction(body.value);
    if (!action) return err(400, "bad_action", "Mossa non valida.");
    let me = null;
    const r = await mutate(deps, code, async (room) => {
      me = await authPlayer(room, token);
      if (!me) throw new GameError("auth", "Non fai parte di questa stanza.");
      if (await limited(deps, `a:${me.id}`, RATE.action, true)) throw new GameError("slow_down", "Troppe mosse: rallenta.");
      dispatch(room, me.id, action, rng, now);
    });
    if (r.missing) return err(404, "not_found", "Stanza inesistente o scaduta.");
    if (r.conflict) return err(503, "busy", "Riprova fra un istante.");
    if (r.error) {
      if (r.error.code === "auth") return err(403, "auth", r.error.message);
      if (r.error.code === "slow_down") return err(429, "slow_down", r.error.message);
      const res = gameErrorResponse(r.error);
      if (r.room && me) {                       // errore di gioco ma stato avanzato dal tempo: mandalo
        const b = JSON.parse(res.body); b.view = viewFor(r.room, me.id, now); res.body = JSON.stringify(b);
      }
      return res;
    }
    return json(200, { view: viewFor(r.room, me.id, now) });
  }

  return err(404, "not_found", "Non trovato.");
}
