// Adattatore Cloudflare di Ruota Online.
// - Worker: serve i file statici (con intestazioni di sicurezza) e instrada /api/* verso handle().
// - Durable Object "Room": una istanza per stanza, custodisce lo stato con scrittura condizionata.
// - Durable Object "Limiter": contatori a finestra fissa per i limiti di frequenza.
// Entrambi gli oggetti usano l'archivio SQLite, disponibile anche sul piano gratuito.

import { handle } from "../src/api.js";
import { SECURITY_HEADERS } from "../src/security.js";

const withHeaders = (res, extra = {}) => {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) out.headers.set(k, v);
  return out;
};

async function dailySalt(env) {
  const day = new Date().toISOString().slice(0, 10);
  return `${env.IP_SALT_SECRET || "ruota-online"}|${day}`;
}

// Limitatore in memoria dell'isolate: gratis, per letture e mosse (gli abusi seri li ferma
// comunque il limitatore durevole su creazione e ingresso, più la protezione DDoS di Cloudflare).
const FAST = new Map();
const fastLimiter = {
  async hit(key, limit, windowSec) {
    const now = Date.now();
    const w = FAST.get(key);
    if (!w || w.reset < now) {
      if (FAST.size > 5000) FAST.clear();
      FAST.set(key, { n: 1, reset: now + windowSec * 1000 });
      return true;
    }
    w.n++;
    return w.n <= limit;
  },
};

function deps(env) {
  return {
    fastLimiter,
    store: {
      async get(code) {
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch("https://room/get");
        return r.status === 200 ? await r.json() : null;
      },
      async put(code, room, etag, ttlSec) {
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch("https://room/put", {
          method: "POST",
          body: JSON.stringify({ room, etag, ttlSec }),
        });
        return r.status === 200;
      },
    },
    limiter: {
      async hit(key, limit, windowSec) {
        const stub = env.LIMITER.get(env.LIMITER.idFromName(key));
        const r = await stub.fetch("https://limiter/hit", { method: "POST", body: JSON.stringify({ limit, windowSec }) });
        return r.status === 200;
      },
    },
    now: () => Date.now(),
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    ipSalt: "",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const len = Number(request.headers.get("content-length") || 0);
      if (len > 4096) return withHeaders(new Response(null, { status: 413 }));
      const d = deps(env);
      d.ipSalt = await dailySalt(env);
      const headers = {};
      for (const [k, v] of request.headers) headers[k.toLowerCase()] = v;
      const out = await handle({
        method: request.method,
        path: url.pathname,
        headers,
        body: request.method === "GET" ? "" : (await request.text()).slice(0, 4097),
        ip: request.headers.get("CF-Connecting-IP") || "",
      }, d);
      return withHeaders(new Response(out.body, { status: out.status, headers: out.headers }));
    }

    // link d'invito /ABC234 → la stessa pagina del gioco
    if (/^\/[A-Za-z0-9]{6}$/.test(url.pathname)) {
      const res = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
      return withHeaders(res, { "Cache-Control": "no-cache" });
    }
    const res = await env.ASSETS.fetch(request);
    return withHeaders(res);
  },
};

export class Room {
  constructor(state) { this.state = state; }

  async fetch(request) {
    const url = new URL(request.url);
    const storage = this.state.storage;
    if (url.pathname === "/get") {
      const rec = await storage.get("rec");
      if (!rec || rec.exp < Date.now()) return new Response(null, { status: 404 });
      return Response.json({ room: rec.room, etag: rec.etag });
    }
    if (url.pathname === "/put" && request.method === "POST") {
      const { room, etag, ttlSec } = await request.json();
      const rec = await storage.get("rec");
      const live = rec && rec.exp >= Date.now();
      // scrittura condizionata: crea solo se libera, aggiorna solo se nessuno ha scritto nel frattempo
      if (etag === null ? live : (!live || rec.etag !== etag)) return new Response(null, { status: 409 });
      const next = { room, etag: (live ? rec.etag : 0) + 1, exp: Date.now() + ttlSec * 1000 };
      await storage.put("rec", next);
      await storage.setAlarm(next.exp + 1000);
      return new Response(null, { status: 200 });
    }
    return new Response(null, { status: 404 });
  }

  // stanza scaduta: cancellata davvero, non solo nascosta
  async alarm() {
    const rec = await this.state.storage.get("rec");
    if (rec && rec.exp > Date.now()) { await this.state.storage.setAlarm(rec.exp + 1000); return; }
    await this.state.storage.deleteAll();
  }
}

export class Limiter {
  constructor(state) { this.state = state; }

  async fetch(request) {
    const { limit, windowSec } = await request.json();
    const now = Date.now();
    let w = await this.state.storage.get("w");
    if (!w || w.reset < now) w = { n: 0, reset: now + windowSec * 1000 };
    w.n++;
    await this.state.storage.put("w", w);
    await this.state.storage.setAlarm(w.reset + 1000);
    return new Response(null, { status: w.n <= limit ? 200 : 429 });
  }

  async alarm() {
    await this.state.storage.deleteAll();
  }
}
