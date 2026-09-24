# Ruota Online

La Ruota della Fortuna per due o tre persone, **ognuna dal proprio telefono**.
Niente account: chi crea la stanza ottiene un codice di 6 caratteri (e un link da
condividere), gli altri entrano con quello.

## Come è fatta

```
public/            client mobile first: HTML, CSS e JS senza dipendenze, nessuna terza parte
src/engine.js      motore di gioco autoritativo (ruota, pulsante, finale) — puro, testabile
src/api.js         API HTTP indipendente dalla piattaforma: validazione, autenticazione, limiti
src/security.js    intestazioni, CSP, filtro dei nomi, token, codici stanza
src/corpus.js      le 390 frasi (generato da ../ruota-lab/seed)
cloudflare/        adattatore Cloudflare: Worker + Durable Objects (stanze e limitatori)
dev/server.mjs     server locale con archivio in memoria, stessa API della produzione
test/              test di motore, API e adattatore (node --test) + E2E a tre telefoni
```

Il **server decide tutto**: gira la ruota, conta le lettere, cronometra il pulsante e il
finale. Il telefono riceve solo una *vista* del tabellone con le lettere già scoperte:
**la frase non arriva mai al browser finché non è risolta**, quindi non si bara aprendo gli
strumenti per sviluppatori. Il pulsante è equo: vince chi arriva primo al server.

I telefoni si aggiornano con un polling adattivo (0,7 s quando il tempo conta, fino a 2,5 s
in sala d'attesa, 5 s a schermo spento), pensato per restare nelle quote gratuite.

## Sicurezza

| Rischio | Contromisura |
|---|---|
| Barare leggendo la soluzione | Stato autoritativo sul server; il client riceve solo le tessere scoperte (testato) |
| Rubare il posto di un altro | Token casuale da 256 bit per giocatore, conservato sul server solo come hash SHA-256, confronto a tempo costante |
| Indovinare i codici delle stanze | 31⁶ ≈ 887 milioni di codici + 30 tentativi d'ingresso ogni 10 minuti per IP |
| Iniezione di HTML/script | Il client scrive solo con `textContent`; nomi ripuliti lato server; CSP `script-src 'self'` senza inline |
| Clickjacking, sniffing, referrer | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS |
| Richieste abusive | Corpo max 2 KB, solo JSON, mosse validate a elenco chiuso, limiti per IP e per giocatore |
| Nomi offensivi | Filtro con normalizzazione (0→o, 1→i, accenti…) e rifiuto; l'host può allontanare prima dell'inizio |
| Dati personali | Niente account, cookie, analytics o risorse di terze parti; IP solo come hash con sale giornaliero; stanze cancellate 2 ore dopo l'ultima mossa |
| Stanze bloccate | Turno passato d'ufficio dopo 60 s; host riassegnato se sparisce in sala d'attesa; tempi massimi per prenotazione e finale |
| Concorrenza | Scrittura condizionata (etag) su ogni stanza: due mosse simultanee non si sovrascrivono |

Pagina informativa per chi gioca: [`public/privacy.html`](public/privacy.html).

## In locale

```sh
node dev/server.mjs            # http://localhost:8787
npm test                       # motore, API e adattatore Cloudflare
npm i -D playwright-core && CHROME_PATH=… node test/e2e.mjs   # tre telefoni, partita intera
```

## Pubblicazione su Cloudflare

Piano gratuito sufficiente (Durable Objects con archivio SQLite).

**Dal browser, senza terminale** — Cloudflare → *Workers & Pages* → *Create* →
*Import a repository* → scegli `teacher-lorenzo` → **Root directory: `ruota-online`** →
*Deploy*. Ogni push sul ramo di produzione ripubblica da solo.

**Dal terminale** — `cd ruota-online && npx wrangler login && npx wrangler deploy`.

Facoltativo ma consigliato: un segreto per il sale degli IP,
`npx wrangler secret put IP_SALT_SECRET` (una stringa casuale lunga).

L'indirizzo sarà `https://ruota-online.<tuo-sottodominio>.workers.dev`; si può collegare un
dominio proprio dalle impostazioni del Worker.

### Quote

Col polling adattivo una partita a tre consuma circa 2–4 richieste al secondo: il piano
gratuito (100.000 richieste al giorno) regge alcune ore di gioco quotidiano. Per un'apertura
davvero pubblica servono il piano a pagamento o il passaggio a WebSocket (vedi sotto).

## Prossimi passi prima di un lancio pubblico vero

- **WebSocket con ibernazione** dei Durable Objects al posto del polling: meno richieste,
  aggiornamenti istantanei.
- **Segnalazione di abusi** e moderazione oltre al filtro dei nomi (oggi non esiste chat,
  quindi l'unico testo libero visibile agli altri è il nome).
- **Nome e marchio**: il gioco non usa il nome del programma televisivo e dichiara di non
  esserne affiliato; per un lancio commerciale serve comunque una verifica legale sul format.
