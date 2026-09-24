// Regole di sicurezza condivise da tutti gli adattatori (Cloudflare, Vercel, server locale).

// Intestazioni applicate a OGNI risposta, statica o API.
// Nessuno script inline e nessuna terza parte: la CSP consente solo file dello stesso dominio
// (niente font esterni, niente analytics: l'indirizzo IP di chi gioca non esce dal nostro server).
export const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
});

// Le risposte API non si mettono in cache da nessuna parte: contengono lo stato di una partita privata.
export const API_HEADERS = Object.freeze({
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
});

export const MAX_BODY_BYTES = 2048;

// Codici stanza: 6 caratteri da 31 simboli non ambigui (niente 0/O, 1/I/L) → 31^6 ≈ 887 milioni.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export const ROOM_TTL_SEC = 2 * 60 * 60;      // stanze cancellate 2 ore dopo l'ultima attività

// Limiti di frequenza per IP (chiave anonimizzata) e per giocatore.
export const RATE = Object.freeze({
  create: { limit: 10, windowSec: 3600 },     // stanze create per ora
  join: { limit: 30, windowSec: 600 },        // tentativi di ingresso in 10 minuti (anti-enumerazione)
  read: { limit: 240, windowSec: 60 },        // letture di stato al minuto (polling ~ 1/s)
  action: { limit: 90, windowSec: 60 },       // mosse al minuto
});

// Parole che non possono comparire in un nome visibile agli altri giocatori.
// Lista minima e volutamente prudente: blocca l'ovvio, non pretende di essere un filtro completo.
const BLOCKED = [
  "cazz", "vaffa", "stronz", "troia", "puttan", "coglion", "minchi", "fica", "figa", "merda",
  "froci", "ricchion", "negr", "nigg", "fuck", "shit", "bitch", "cunt", "whore", "fag", "nazi", "hitler",
  "porco dio", "porcodio", "dio can", "diocan", "madonna puttana",
];

export function cleanName(v) {
  return String(v == null ? "" : v)
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g, "")
    .replace(/[<>&"'`\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
}

export function nameProblem(name) {
  if (!name) return "Scegli un nome di almeno un carattere.";
  if (!/[\p{L}\p{N}]/u.test(name)) return "Il nome deve contenere almeno una lettera o una cifra.";
  const flat = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[0@]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/[5$]/g, "s")
    .replace(/[^a-z ]/g, "");
  if (BLOCKED.some((w) => flat.includes(w) || flat.replace(/ /g, "").includes(w.replace(/ /g, "")))) {
    return "Scegli un altro nome.";
  }
  return null;
}

// Converte byte casuali in stringhe sicure per URL.
export function b64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomCode(randomBytes) {
  const bytes = randomBytes(12);
  let out = "";
  for (const b of bytes) {
    if (b >= 248) continue;                   // 248 = 31*8: scarto per evitare bias del modulo
    out += CODE_ALPHABET[b % CODE_ALPHABET.length];
    if (out.length === 6) return out;
  }
  return randomCode(randomBytes);
}

export async function sha256hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Confronto a tempo costante fra due hash esadecimali della stessa lunghezza.
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
