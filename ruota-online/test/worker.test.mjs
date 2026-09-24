// Prova l'adattatore Cloudflare in Node, con Durable Objects e ASSETS simulati.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { Room, Limiter } from "../cloudflare/worker.js";

function fakeStorage() {
  const m = new Map();
  return {
    get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : undefined),
    put: async (k, v) => { m.set(k, structuredClone(v)); },
    setAlarm: async () => {},
    deleteAll: async () => { m.clear(); },
  };
}
function namespace(Cls) {
  const objs = new Map();
  return {
    idFromName: (n) => n,
    get: (id) => {
      if (!objs.has(id)) objs.set(id, new Cls({ storage: fakeStorage() }));
      const o = objs.get(id);
      return { fetch: (url, init) => o.fetch(new Request(url, init)) };
    },
  };
}
const env = {
  ROOMS: namespace(Room),
  LIMITER: namespace(Limiter),
  ASSETS: { fetch: async (req) => new Response("<!doctype html>ok", { headers: { "Content-Type": "text/html" } }) },
};
const call = (path, { method = "GET", body, token, ip = "5.5.5.5" } = {}) => {
  const headers = { "Content-Type": "application/json", "CF-Connecting-IP": ip };
  if (token) headers.Authorization = `Bearer ${token}`;
  return worker.fetch(new Request(`https://ruota.example${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
};

test("worker: stanza, ingresso, stato e intestazioni di sicurezza", async () => {
  const c = await call("/api/rooms", { method: "POST", body: { name: "Lorenzo" } });
  assert.equal(c.status, 201);
  assert.match(c.headers.get("Content-Security-Policy"), /default-src 'self'/);
  assert.equal(c.headers.get("Cache-Control"), "no-store");
  assert.equal(c.headers.get("X-Frame-Options"), "DENY");
  const { code, token } = await c.json();
  const j = await call(`/api/rooms/${code}/join`, { method: "POST", body: { name: "Chiara" }, ip: "6.6.6.6" });
  assert.equal(j.status, 201);
  const s = await call(`/api/rooms/${code}`, { token });
  assert.equal(s.status, 200);
  assert.equal((await s.json()).view.players.length, 2);
  const start = await call(`/api/rooms/${code}/action`, { method: "POST", body: { type: "start" }, token });
  assert.equal((await start.json()).view.phase, "wheel");
});

test("worker: link d'invito e file statici con intestazioni", async () => {
  const r = await call("/ABC234");
  assert.equal(r.status, 200);
  assert.ok(r.headers.get("Strict-Transport-Security"));
  const s = await call("/styles.css");
  assert.ok(s.headers.get("X-Content-Type-Options"));
});

test("worker: corpo troppo grande respinto prima di leggerlo", async () => {
  const r = await worker.fetch(new Request("https://ruota.example/api/rooms", {
    method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "999999" }, body: "{}",
  }), env);
  assert.equal(r.status, 413);
});
