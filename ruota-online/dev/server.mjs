// Server locale per sviluppo e test: stessa API della produzione, archivio in memoria.
// Avvio: node ruota-online/dev/server.mjs   (porta 8787, oppure PORT=…)

import http from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes as nodeRandomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../src/api.js";
import { SECURITY_HEADERS } from "../src/security.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const PORT = Number(process.env.PORT || 8787);

export function memoryStore() {
  const rooms = new Map();            // code → {json, etag, exp}
  let seq = 0;
  return {
    async get(code) {
      const r = rooms.get(code);
      if (!r || r.exp < Date.now()) { rooms.delete(code); return null; }
      return { room: JSON.parse(r.json), etag: r.etag };
    },
    async put(code, room, etag, ttlSec) {
      const cur = rooms.get(code);
      if (etag === null ? !!cur : (!cur || cur.etag !== etag)) return false;
      rooms.set(code, { json: JSON.stringify(room), etag: ++seq, exp: Date.now() + ttlSec * 1000 });
      return true;
    },
    size: () => rooms.size,
  };
}

export function memoryLimiter() {
  const hits = new Map();
  return {
    async hit(key, limit, windowSec) {
      const now = Date.now();
      const h = hits.get(key);
      if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowSec * 1000 }); return true; }
      h.n++;
      return h.n <= limit;
    },
  };
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".webmanifest": "application/manifest+json", ".json": "application/json; charset=utf-8",
};

export function createServer({ store = memoryStore(), limiter = memoryLimiter() } = {}) {
  const deps = {
    store, limiter,
    now: () => Date.now(),
    randomBytes: (n) => new Uint8Array(nodeRandomBytes(n)),
    ipSalt: "dev-" + new Date().toISOString().slice(0, 10),
  };

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 4096) { res.writeHead(413, SECURITY_HEADERS); res.end(); return; }
        }
        const out = await handle({
          method: req.method, path: url.pathname,
          headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), String(v)])),
          body, ip: req.socket.remoteAddress,
        }, deps);
        res.writeHead(out.status, { ...SECURITY_HEADERS, ...out.headers });
        res.end(out.body);
        return;
      }
      // file statici, senza possibilità di uscire dalla cartella public/
      let rel = decodeURIComponent(url.pathname);
      if (rel === "/" || /^\/[A-Z0-9]{6}$/i.test(rel)) rel = "/index.html";   // /ABC234 → link d'invito
      const file = path.resolve(ROOT, "." + rel);
      if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403, SECURITY_HEADERS); res.end(); return; }
      const data = await readFile(file);
      res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(data);
    } catch (e) {
      res.writeHead(e && e.code === "ENOENT" ? 404 : 500, { ...SECURITY_HEADERS, "Content-Type": "text/plain" });
      res.end(e && e.code === "ENOENT" ? "Non trovato" : "Errore");
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, () => console.log(`Ruota Online in locale: http://localhost:${PORT}`));
}
