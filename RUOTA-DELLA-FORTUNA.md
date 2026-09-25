# La Ruota della Fortuna — dossier di progetto

Memoria permanente del lavoro fatto con Claude su *La Ruota della Fortuna* (Canale 5,
edizione con Gerry Scotti): come candidarsi, come allenarsi, e il trainer software
costruito per farlo. **Questo file è la fonte di verità**: se una chat si azzera o viene
compattata, si riparte da qui.

Ultimo aggiornamento: **2026-09-24**

---

## 1. Link e identificatori da conservare

| Cosa | Dove |
|---|---|
| **Ruota Lab** — il trainer giocabile | https://claude.ai/artifact/WKUQM7ece5vRPiQEXFYb3W |
| **Protocollo Ruota** — il piano di allenamento | https://claude.ai/artifact/SsgzuvxPPwAE88naPu7F79 |
| Sorgenti del trainer | `ruota-lab/` in questo repo |
| **Ruota Online** — multigiocatore, un telefono a testa | **https://ruota-online.lorenx-rossi.workers.dev** · sorgenti in `ruota-online/` (vedi §6) |
| Corpus iniziale (390 frasi) | `ruota-lab/seed/*.json` |
| Routine settimanale | trigger `trig_01CTXc8v9cFvUQCH6VTxfnKS`, lunedì 06:00 (04:00 UTC) |
| Promemoria serale | evento Google Calendar ricorrente, ogni giorno 23:45–00:00 (Europe/Rome), id `4738j6at75qogmsdf02llrtolk` |
| Branch di lavoro | `claude/ruota-fortuna-partecipazione-tkb7up` |

> L'URL dell'artifact è la **chiave del database**: senza quello, in una nuova chat
> non si raggiungono statistiche, corpus e mazzo regole. Si ritrova anche con
> `/artifacts` nel terminale o dalla galleria su claude.ai/code/artifacts.

---

## 2. Come si partecipa al programma

Produce **Endemol Shine Italy** (gruppo Banijay) per Mediaset; si registra negli studi di
Cologno Monzese, Viale Europa 44. Il casting è **permanente e online**, non ci sono
provini a data fissa.

**Candidatura** — unico canale ufficiale: `casting.endemolshine.it/ruotadellafortuna`.
Gratuita: chi chiede soldi è una truffa.

**Requisiti**: 18 anni compiuti; cittadinanza italiana o residenza stabile in Italia;
nessun rapporto di lavoro o parentela con Mediaset/RTI, Endemol Shine Italy o Banijay;
non aver partecipato come concorrente ad altri giochi TV prodotti per RTI negli ultimi
12 mesi; nessun precedente penale.

**Il form chiede**: dati anagrafici, codice fiscale, telefono ed email; una breve
presentazione personale (lavoro, hobby, passioni, sogno nel cassetto, cosa faresti con la
vincita); **due foto JPG**, primo piano e figura intera, max ~6 MB l'una.

**Processo**: candidatura → screening (ricontattano solo i profili adatti, tempi non
garantiti, anche mesi) → colloquio conoscitivo in presenza o in videocall, spesso con una
fase di gruppo (presentazione + giochi di cultura generale) e poi colloqui individuali →
prova di gioco col tabellone (velocità, intuito, frasi con lettere mancanti) → lista
ufficiale dei possibili concorrenti → convocazione per la registrazione, con pochi giorni
di preavviso.

**Pubblico in studio**: canale diverso e molto più rapido, gestito dall'agenzia esterna
*Vivi la Vita*; biglietti sempre gratuiti, posti limitati, max ~4 persone a richiesta.

Fonti: [Money.it](https://www.money.it/come-partecipare-ruota-della-fortuna-come-concorrente-pubblico),
[Fanpage](https://www.fanpage.it/spettacolo/programmi-tv/come-diventare-concorrenti-de-la-ruota-della-fortuna-il-game-show-di-canale5-con-gerry-scotti/),
[casting ufficiale](https://casting.endemolshine.it/ruotadellafortuna/),
[AttoriCasting](https://www.attoricasting.it/casting-tv/come-partecipare-a-la-ruota-della-fortuna-la-guida-completa-ai-provini/76172/).

---

## 3. Il formato di gioco (edizione autunno 2026)

Access prime time su Canale 5, 20:35, con Samira Lui. La versione autunnale è partita il
**14 settembre 2026** (manche "La locanda di Samira" al posto delle Ricette, "Ciak si
gira" virata sugli oroscopi, band rinnovata). **Il regolamento cambia a ogni stagione:
verificare sempre guardando le puntate recenti.**

- Tre concorrenti, ruota a 24 spicchi, tabellone con frasi da indovinare.
- **Vocali: 200 €**, acquistabili senza limite; le consonanti fruttano il valore dello
  spicchio moltiplicato per le occorrenze.
- Spicchi speciali: **bancarotta** (azzera il montepremi di manche), **passa**, **jolly**.
- Manche viste in onda: musicale, CruciRuota, regno degli animali, ruota del tempo,
  Express, ruota delle feste, **Triplete** (1.000 / 2.000 / 3.000 €, tutte e tre = 10.000),
  **Ultimo Round** (ogni lettera vale una cifra fissa decisa dal giro di Gerry).
- **Finale — La Ruota delle Meraviglie**: il campione gira un ruotino da 24 spicchi con
  buste da 100 € a 200.000 €; tre tabelloni da risolvere in **60 secondi totali**.
  1. Sono date **N R T E**; il campione aggiunge **3 consonanti + 1 vocale**.
  2. **Testacoda**: si vedono solo prima e ultima lettera di ogni parola.
  3. **Rubasecondi**: consonanti libere + 1 vocale, ma **−3 secondi per ogni lettera assente**.

---

## 4. Il protocollo di allenamento (sintesi)

Documento completo: [Protocollo Ruota](https://claude.ai/artifact/SsgzuvxPPwAE88naPu7F79).

**Due correzioni di fondo.** (a) Non è una gara di cultura generale: è *completamento di
pattern sotto pressione*. Ripartizione: 55% ricostruzione di frasi, 15% corpus del
programma, 15% tattica, 10% cultura generale (serve al casting), 5% voce e stress.
(b) Non esiste una data: la convocazione arriva con pochi giorni di preavviso, quindi non
si programma un picco — si vive in **prontezza permanente** con scarico attivabile in 7 giorni.

**Struttura dell'italiano, il vero vantaggio**: quasi ogni parola finisce per vocale
(eccezioni solo parole-funzione e forestierismi); le parole di 1–3 lettere sono quasi
sempre articoli e preposizioni; le doppie raddoppiano l'incasso; le code morfologiche
(`-ZIONE, -MENTE, -ISSIMO, -ATORE, -EZZA, -ARE/-ERE/-IRE`) regalano tre o quattro lettere.

**Frequenze indicative** (italiano scritto): E 11,8 · A 11,7 · I 11,3 · O 9,8 · N 6,9 ·
L 6,5 · R 6,4 · T 5,6 · S 5,0 · C 4,5 · D 3,7 · U 3,0 · P 3,1 · M 2,5 · V 2,1 · G 1,6 ·
H 1,5 · F 1,2 · B 0,9 · Z 0,9 · Q 0,5.

**Apertura standard del finale**: sopra le gratuite N R T E → **S · L · C + A**.
Varianti: **D** se dominano le parole corte, **M** se si sospetta un avverbio in -MENTE,
**Z/G** se la categoria suggerisce -ZIONE o GLI, **I** al posto di A con molti plurali maschili.

**Playbook** — risolvi appena hai la frase (il giro in più è bancarotta attesa); compra
la vocale appena taglia lo spazio delle soluzioni; su spicchio alto chiama la lettera con
più occorrenze, non la più frequente; col montepremi alto passa in conservativo; se
l'avversario è vicino alza il rischio; al pulsante prenotati sulla parola-chiave; nel
Testacoda attacca dalle parole corte; nel Rubasecondi conta la certezza, non la frequenza;
si parla **una volta sola, frase intera, articoli compresi**.

**Periodizzazione**: sett. 1–4 base (corpus + lessico, 45 min/g) · 5–8 velocità
(cronometro, 40 min/g) · 9–12 specificità (in piedi, con disturbo, simulazioni) ·
poi mantenimento (3 sessioni + 1 simulazione a settimana) · scarico negli ultimi 7 giorni.

**Esercizi**: D1 soglia di informazione · D2 Testacoda · D3 Rubasecondi · D4 pulsante ·
D5 finale integrale · D6 lettura della griglia · (D7–D10 sul protocollo: decisioni sulla
ruota, lessico, corpus, dizione sotto carico).

---

## 5. Ruota Lab — il trainer

Artifact multi-file pubblicato su claude.ai, con capacità `db` (database) e `sample`
(chiama Claude dalla pagina). Sorgenti in `ruota-lab/`: `index.html`, `styles.css`, `app.js`.

**Perché non Gemini**: in sessione non c'era nessuna chiave Gemini e, soprattutto, la
policy di sicurezza degli artifact blocca ogni chiamata di rete in uscita. La pagina usa
quindi Claude come motore interno (capacità `sample`, a carico dell'account di chi apre).

**Il rituale serale (la parte che tiene in piedi tutto)**
Ogni sera alle 23:45 — chiude a mezzanotte — un evento di calendario con promemoria (10 minuti prima e all'ora esatta)
porta il link dell'app. Si apre sulla scheda **Oggi**, che mostra già la sessione pronta:
tre blocchi da circa dieci minuti scelti automaticamente dai propri numeri, un pulsante
"Inizia la sessione" e si va in fila da un esercizio all'altro senza tornare al menu.
In alto la striscia dei sette giorni e il contatore dei giorni di fila.

La prescrizione è deterministica (nessuna attesa di un modello): assegna una priorità a ogni
esercizio in base a soglia media, precisione al pulsante, percentuale di finali completati,
caselle per apertura, lettere buttate a vuoto e risultati del Testacoda; toglie punti a ciò
che è stato fatto il giorno prima, ordina e prende i primi tre. La sessione finita viene
registrata in `sessions/log` e alimenta la striscia della costanza.

**Modalità salotto (multigiocatore locale)**
Nella scheda Partita si sceglie fra *Allenamento* (tu e due avversari simulati) e *Salotto*
a due o tre giocatori umani, con i nomi. Si gioca **sulla stessa tastiera, a turno**: una riga
sopra i comandi dice a chi tocca, e nelle manche a pulsante ogni giocatore ha il suo tasto
(**1**, **2**, **3**). Le partite in salotto **non toccano statistiche, KPI e profilo errori**
(il flag `LOGGING` è falso per tutta la partita): finiscono invece in `versus/log`, che tiene
il conto delle vittorie testa a testa, mostrato sopra la partita.

**Perché non è multigiocatore in rete.** Un artifact che dichiara la capacità `db` è
*organization-internal*: non è condivisibile pubblicamente e chiunque lo apra deve essere
autenticato e nell'organizzazione del proprietario. Quindi due account personali distinti
(tu e un'altra persona) non possono aprire la stessa pagina: per giocare da due divani
servirebbe una vera app ospitata (per esempio su Vercel) con un backend e un login proprio.
La capacità `room` esiste e darebbe presenza e eventi in tempo reale, ma vale solo fra
viewer della stessa organizzazione: non aggira il vincolo.

**Irrobustimento (2026-09-23)**
- Ogni testo di provenienza esterna (nomi dei giocatori, frasi del corpus, contenuto del
  database) viene **escapizzato** prima di finire in `innerHTML`: registro di gioco ed esiti
  degli esercizi erano l'unico punto di iniezione HTML.
- I nomi passano da `cleanName()`: niente caratteri di controllo, massimo 24 caratteri.
- Le frasi caricate dal database sono validate (`validPhrase`): solo lettere, spazi,
  apostrofi e vocali accentate maiuscole, 4–60 caratteri; le altre vengono ignorate.
- Import dell'Archivio TV limitato a 200 righe per volta e 2000 frasi in totale.
- Nessun segreto nel codice, nessuna chiamata di rete in uscita (la CSP degli artifact la
  blocca comunque), nessun uso di `localStorage`.

**Contenuti**
- **Oggi**: prescrizione del giorno, striscia della costanza, avvio della sessione in sequenza.
- **Archivio TV**: incolli le frasi trascritte dalle puntate (una per riga, con data e manche
  facoltative); vengono ripulite, deduplicate e salvate in `corpus/tv-reali` marcate come
  autentiche. Sopra le 20 frasi si può attivare "gioca solo con le frasi viste in TV".
- **Partita**: 6 manche — classica, tematica, **CruciRuota** (4 frasi da 1.000 €),
  tematica, **Triplete** (1.000/2.000/3.000, bonus 10.000), **Ultimo round** a valore
  fisso. Due avversari simulati (Nadia, Rocco) con parametro di bravura. Se chiudi da
  campione parte **La Ruota delle Meraviglie** (3 tabelloni, 60 s, Testacoda e Rubasecondi).
- **Allenamento**: D1 soglia, D2 Testacoda, D3 Rubasecondi, D4 pulsante, D6 griglia.
- **Statistiche**: KPI (soglia media, precisione al pulsante, % finali, caselle per
  apertura), grafici settimanali (sessioni per settimana, andamento della soglia),
  profilo degli errori, ultime partite.
- **Regole**: 20 carte a ripetizione spaziata (box 1/3/7/16/35 giorni).
- **Coach**: manda i numeri veri a Claude e restituisce diagnosi, causa, tre esercizi
  prescritti, una regola da ricordare.
- **Generatore**: nuove frasi per categoria, ripulite e deduplicate, salvate in archivio.

**Tipi di errore tracciati** (`MISTAKE_LABEL` in `app.js`): giro avido · bancarotta
evitabile · vocale tardiva · lettera a vuoto · ordine lettere · soluzione errata ·
tempo scaduto · spreco nel Rubasecondi · **lettera ripetuta** · apertura debole · finale
incompleto.

### Modello di interazione (deciso il 2026-09-14)

Si gioca **da tastiera, senza mouse**. Un solo contesto attivo alla volta (`KCTX` in
`app.js`, impostato da ogni schermata e ripristinato alla chiusura delle modali):

| Tasto | Effetto |
|---|---|
| lettera A–Z | chiama la consonante / compra la vocale / seleziona nelle schermate di scelta |
| Spazio | gira la ruota, oppure prenotati nelle manche a pulsante |
| Invio | apre il campo soluzione (o prenota, nelle manche a pulsante) |
| Esc | esce dal campo di testo e torna alle lettere |

**Nessun guardrail**: si può richiamare una lettera già chiamata, ed è un errore vero —
in partita fa perdere il turno, nel Rubasecondi e nel finale costa 3 secondi, e viene
registrato come `lettera_ripetuta`. La rotazione della ruota è stata portata da 3,4 s a
1,6 s per non rallentare il gioco.

### Come si aggiorna il trainer

1. Modificare i file in `ruota-lab/`.
2. Ripubblicare con lo strumento Artifact passando `url` = URL dell'artifact e i file
   (`index.html` come pagina, `styles.css` e `app.js` come file di supporto).
3. **Ripubblicare NON tocca il database**: codice e dati sono separati.

---

## 6. Ruota Online — tre giocatori, tre telefoni

App web pubblica separata dall'artifact (che è privato al tuo account e non può essere aperto
da altri). Codice in `ruota-online/`, documentazione completa in `ruota-online/README.md`.

- **Niente account**: chi crea la stanza riceve un codice di 6 caratteri e un link
  (`/CODICE`) da mandare agli altri; fino a 3 giocatori; partita *breve* (3 manche, ~10′) o
  *completa* (6 manche, ~25′), poi la Ruota delle Meraviglie per il campione, gli altri tifano.
- **Server autoritativo** (`src/engine.js`): ruota, lettere, pulsante e finale li decide il
  server; il telefono riceve solo le tessere scoperte, **la frase non arriva mai al browser
  prima della soluzione**. Pulsante equo: vince chi arriva prima al server.
- **Mobile first**, tema unico "studio di sera", ruota compatta da 104 px con il valore
  accanto, tastiera QWERTY a schermo, pulsante di prenotazione enorme, installabile come app
  (manifest + icona).
- **Sicurezza**: token da 256 bit salvati solo come hash, codici non enumerabili (limite
  d'ingresso per IP), CSP senza script inline né terze parti, HSTS, anti-framing, input
  validati a elenco chiuso, filtro dei nomi, stanze cancellate 2 ore dopo l'ultima mossa,
  IP solo come hash con sale giornaliero. Pagina privacy in `public/privacy.html`.
- **Piattaforma**: Cloudflare Workers + Durable Objects (una istanza per stanza, scrittura
  condizionata) — piano gratuito sufficiente. Polling adattivo 0,7–5 s per stare nella quota
  gratuita; passaggio a WebSocket come passo successivo per un lancio pubblico.
- **Verifiche**: 18 test automatici (motore, API, sicurezza, adattatore Cloudflare) + un
  E2E con tre browser in formato telefono che giocano una partita intera fino al finale;
  `wrangler deploy --dry-run` superato.
- **Online** dal 2026-09-24: https://ruota-online.lorenx-rossi.workers.dev — Worker
  `ruota-online` sull'account Cloudflare lorenx.rossi, pubblicato con Workers Builds dal repo
  `teacher-lorenzo` (percorso `/ruota-online`, comando `npx wrangler deploy`). Ogni merge su
  `main` ripubblica da solo; gli URL di anteprima per versione sono spenti (`preview_urls = false`).
- **Facoltativo**: segreto `IP_SALT_SECRET` (Worker → Settings → Variables and Secrets) e un
  dominio proprio dalla scheda Domains.

- **Bot** (2026-09-24): chi crea la stanza riempie i posti liberi con bot Facile / Medio /
  Forte, oppure dalla home *Gioca contro due bot*. Giocano sul server con le stesse regole,
  una mossa ogni 1,8 s; la bravura è una probabilità, non una sbirciata alla frase. Senza token,
  quindi nessuno può impersonarli. Finale vinto in simulazione: ~7% / ~20% / ~67%.

Anche **Ruota Lab** è ora mobile first: ruota compatta in riga col valore e il pulsante,
schede scorrevoli, lettere più grandi, pannello modalità richiudibile.

---

## 7. Il database

Appartiene all'artifact (indirizzato dal suo URL), non alla pagina né alla chat.
Sopravvive a ripubblicazioni e sessioni. Da chat si legge con `read_db` e si scrive con
`write_db` (get/list/query · set/update/str_replace/delete/batch).

| Percorso | Contenuto | Chi scrive |
|---|---|---|
| `corpus/<categoria>` | `{label, items:[{t}]}` — le frasi | chat, Routine, generatore in pagina |
| `rules/r01…r20` | carte regola: `{q, a, tag, box, due, seen, missed}` | pagina (ripasso), chat |
| `stats/summary` | partite, vittorie, best, `kpi`, `drills`, `days`, `weeks` | pagina |
| `mistakes/log` | `{counts:{tipo:n}, recent:[{type, at, ctx}]}` (max 120) | pagina |
| `games/<id>` | una riga per partita conclusa | pagina |
| `sessions/log` | `{days:{YYYY-MM-DD:{at,blocks,mins}}}` — le sessioni serali e la costanza | pagina |
| `settings/app` | preferenze: `onlyTV`, `setup` (modalità e nomi dei giocatori) | pagina |
| `versus/log` | `{tally:{nome:vittorie}, matches:[…]}` — le sfide in salotto | pagina |
| `corpus/tv-reali` | frasi trascritte dalle puntate, `authentic:true`, con data e manche | pagina (Archivio TV) |
| `docs/dossier`, `docs/decisions` | copia di sicurezza di questo file e del registro decisioni | chat |

Categorie del corpus: `modi-di-dire, citazioni, film, musica, personaggi, luoghi, cucina,
animali, sport-scienza, quotidiano` — 390 frasi uniche al seeding del 14/09/2026.

**Regole operative**
- Ogni documento ha un **numero di versione**: leggerlo e passarlo come `if_version`
  quando si riscrive, così una scrittura concorrente fallisce invece di sovrascrivere.
- `update` sostituisce un array per intero: per aggiungere frasi si rimanda **l'array
  completo** (vecchie + nuove).
- Tetto di **5.000 documenti** per artifact: per questo errori e statistiche stanno in un
  documento aggregato ciascuno, non uno per evento.
- Mai toccare `stats`, `mistakes`, `rules`, `games` quando si rifornisce il corpus.
- I dati sono privati dell'account; un artifact con database non è condivisibile pubblicamente.

---

## 8. La Routine settimanale

Trigger `trig_01CTXc8v9cFvUQCH6VTxfnKS`, **ogni lunedì alle 04:00 UTC** (06:00 italiane),
apre una sessione nuova che: sceglie le 3 categorie con meno voci, genera 20 frasi nuove
ciascuna secondo le regole di formato, controlla i duplicati, e riscrive i documenti
`corpus/<categoria>` con `if_version`. Notifiche disattivate (lavora in silenzio).
Prima esecuzione: **21 settembre 2026**.

---

## 9. Archivio dei tabelloni realmente andati in onda

**Verdetto della ricerca (14/09/2026): non esiste** un archivio pubblico completo delle
frasi andate in onda, per nessuna edizione (Bongiorno, Papi, Scotti). Per confronto,
l'edizione americana ha un compendio fan-made con oltre 52.000 puzzle
([buyavowel.boards.net](https://buyavowel.boards.net/page/compendium)); in Italia nessuno
l'ha fatto, verosimilmente anche per ragioni di diritti — i repository GitHub italiani
contengono il motore di gioco, mai le frasi vere.

Fonti reali, in ordine di utilità:

1. **Mediaset Infinity** — https://mediasetinfinity.mediaset.it/programmi-tv/laruotadellafortuna_SE000000002245
   Puntate integrali ma a finestra scorrevole (la puntata di ieri e l'ultima), niente archivio storico.
2. **Gioco da tavolo Ravensburger ufficiale** — oltre 300 frasi dichiarate "le stesse
   della trasmissione". Unica raccolta autentica e licenziata; va comprato.
3. **"La Ruota della Fortuna 3.3"**, fan-game PC — https://sites.google.com/site/ruotadellafortuna20/
   3.500 frasi dichiarate, gratuito, ma senza garanzia di autenticità.
4. **Recap giornalistici puntata per puntata** (canaledieci.it, tvblog) — puntate recenti,
   vincitori, montepremi, in parte i tabelloni del finale.
5. **unshow.it** — https://www.unshow.it/la-ruota-della-fortuna-statistiche — statistiche
   aggregate dal 14/07/2025 al 14/02/2026 (buste finali, lettere più cercate e sbagliate).

**Problema di realismo del corpus (25/09/2026).** Misurato sulle 390 frasi generate:
mediana 3 parole e 15 lettere, ma **191 frasi (49%) hanno una o due parole** (titoli di
film come «IL POSTINO», «AMARCORD») e 106 hanno 12 lettere o meno. In TV i tabelloni delle
manche sono di norma più lunghi (frasi e modi di dire su più righe): allenarsi su quelle
corte falsa il pattern completion. In corso: raccolta delle frasi citate nei recap online
delle puntate e delle regole di formato del tabellone, per rigenerare il corpus con la
forma giusta e tenere le frasi corte solo dove servono (es. finale).

### Tabelloni veri raccolti dai recap (ricerca del 25/09/2026)

Fonte: circa 50 ricerche web sui recap di canaledieci.it, libero.it, dilei.it e cremaoggi.it.
Gli articoli non erano apribili direttamente, quindi il testo viene dai riassunti della
ricerca. «Citata» = riportata tra virgolette come soluzione; «?» = formulazione o manche
incerta.

| Frase | Data | Manche | Titolo / tema | Affid. |
|---|---|---|---|---|
| VANITÀ È IL MIO PECCATO PREFERITO | 09/08 | partita (tabellone con titolo) | L'avvocato del diavolo | citata |
| DI PIATTI DA LAVARE IN CUCINA | 31/08 | finale 1 | Pila | citata |
| DI PANNI DA STIRARE | 31/08 | finale 2 | Pila | citata |
| ELETTRICA INVENTATA DA VOLTA | 31/08 | finale 3 | Pila | citata |
| LETTERALMENTE FRITTELLA SFRIGOLANTE | 01/09 | Piatti estivi | Banh Xeo | citata |
| CERCARE LE CHIAVI CON LA TORCIA DEL TELEFONO | 02/09 | Ultimo Round? | Al buio / Nelle grotte? | citata, manche ? |
| RISOLVERE TUTTE LE EQUAZIONI ALGEBRICHE | 03/09 | Compiti per le vacanze | Nessun problema | citata |
| UN LIBRO O UN FILM | 05/09 | finale 1 | Giallo | citata |
| IL COLORE DEI MINIONS | 05/09 | finale 2 | Giallo | citata |
| LO VESTE IL LEADER DEL TOUR DE FRANCE | 05/09 | finale 3 | Giallo | citata |
| UN PIATTO DA MILLE E UNA NOTTE | 08/09 | Piatti estivi | Cous cous di verdure | citata |
| È UN ANTENATO DEL GAZPACHO | 11/09 | Piatti estivi | Cojondongo | ? |
| LA VARIANTE DI UN SIMBOLO GASTRONOMICO | 12/09 | Piatti estivi | Pizzata ligure | ? |
| TROPPE CENE FUORI | 12/09 | Ultimo Round | — | ? (forse titolo) |
| INDICA LA PRESTANZA FISICA | 16/09 | finale 1 | Forza | citata |
| VIGORE UN SUO SINONIMO | 16/09 | finale 2 | Forza | citata |
| DI CARATTERE E DI VOLONTÀ | 16/09 | finale 3 | Forza | citata |
| TIPICAMENTE PREPARATO NEL WOK | 18/09 | La locanda di Samira | Pad Thai | citata |
| I DISEGNI STAMPATI SU UNA STOFFA | 19/09 | finale | Fantasia | citata |
| I CREATIVI NE POSSIEDONO TANTA | 19/09 | finale | Fantasia | citata |
| TOPOLINO APPRENDISTA STREGONE E LE SCOPE | 19/09 | finale | Fantasia | citata |
| CON ACCIUGHE PINOLI E PAN GRATTATO | 20/09 | La locanda di Samira | Carciofi ripieni | citata |
| DI ZUCCA E DI ASPARAGI | 21/09 | finale 1 | Crema | citata |
| COMUNE ITALIANO NELLA BASSA PADANA | 21/09 | finale 2 | Crema | citata |

**Cosa insegnano (e perché il corpus generato era sbagliato):**

- In TV **il titolo è l'indizio e il tabellone è la descrizione**, non il contrario. Il
  tabellone non contiene quasi mai la risposta secca («IL POSTINO»): contiene una frase di
  3–8 parole che la descrive o la continua, e sopra c'è il titolo (il piatto, il tema, un
  titolo scherzoso come «Nessun problema»).
- **Finale**: una parola-tema (Pila, Giallo, Forza, Fantasia, Crema) che non compare sul
  tabellone. Le tre frasi giocano su tre significati diversi, in due modi:
  - una **continuazione** che fa collocazione col tema, spesso con «DI…» (Pila → DI PANNI
    DA STIRARE; Forza → DI CARATTERE E DI VOLONTÀ);
  - una **definizione** (Giallo → IL COLORE DEI MINIONS; Crema → COMUNE ITALIANO NELLA
    BASSA PADANA).
- **La locanda di Samira** (ex Piatti estivi): titolo = nome del piatto, tabellone =
  descrizione di 3–6 parole, lettere che compaiono da sole e prenotazione, 1.000 €.
- **Manche con titolo**: 3–7 parole sotto un titolo spesso ironico.
- **Manche viste a settembre**: La locanda di Samira, Figli delle stelle (oroscopo: Giove
  raddoppia, Saturno dimezza), Chiacchiere da bar, Juke Box, Il regno degli animali, Ho
  cambiato idea, Ciak si gira, Compiti per le vacanze, In fondo al mar, Traghetto Express,
  Ultimo Round (1.300–1.700 € a lettera).
- **Allenamento che ne segue**: non basta completare la frase, bisogna **usare il titolo
  come indizio** («Pad Thai» → cucina asiatica → WOK). Il finale si allena col gioco dei
  significati multipli di una parola.
- **Temi dei finali senza frasi** (utili per generare esempi): Banda, Mercoledì, Pezzo,
  Ago, Parco, Grande, Esame, Avviso, Lingua, Pancia, Grande Fratello, Salto, Massimo,
  Silenzio, Buco, Toro, Doppio, Al ristorante.

### Altri tabelloni veri e regole di formato (seconda ricerca, 25/09/2026)

| Frase | Manche | Titolo / tema | Fonte |
|---|---|---|---|
| DETECTIVE E CONIGLIO SONO UN'IMPROBABILE COPPIA | Ciak si gira (23/07/2026) | Chi ha incastrato Roger Rabbit | dilei.it |
| IL WINDSOR È UN FAMOSO NODO ALLA CRAVATTA | partita (nov 2025?) | — | fanpage.it |
| IL VOLTO TORMENTATO DELLA MUSICA GRUNGE | musicale | Nirvana | canaledieci (12/04/2026?) |
| LA SUA FORTUNA È UNA RUOTA DOVE CORRERE | Il regno degli animali | Il criceto | canaledieci (12/04/2026?) |
| ABBATTE ALBERI COI DENTI IN POCHI MINUTI | Il regno degli animali | Castoro | canaledieci |
| UN RETTILE SIMILE A UN DRAGO COL COLLARE | Il regno degli animali | Clamidosauro | canaledieci |
| VINSERO BATTAGLIE GRAZIE ALLA LORO FOGA | era Bongiorno (1995) | Amazzoni | tgcom24 |
| DI QUALITÀ È SEMPRE POSITIVO | finale 1 (18/09/2026) | Salto | canaledieci |
| NEL BUIO NON HA GARANZIE | finale 2 (Testacoda) | Salto | canaledieci |
| MORTALE CON ROTAZIONE COMPLETA | finale 3 (Rubasecondi) | Salto | canaledieci |
| C'È CHI LA CERCA ALL'ESTERO | finale (13/08/2026) | Fortuna | canaledieci |
| LA DEA DEL CASO E DEL DESTINO | finale | Fortuna | canaledieci |
| IN UN DETTO AIUTA GLI AUDACI | finale | Fortuna | canaledieci |
| DEI DUE MONDI A SPOLETO | finale 3 (05/03/2026) | Festival | canaledieci |

**CruciRuota veri** (sono **elenchi di parole incrociate, non frasi**: 3–4 orizzontali + 1
verticale, niente definizioni):
- Il deserto: CAMMELLI, SAHARA, DUNE, ARIDO, OASI
- In Giappone: SAMURAI, KIMONO, LOTO, SAKÈ, JUDO
- In Cina: PANDA, MURAGLIA, SETA, DRAGO, MING, ASIA
- Gli uccelli: STORMO, NIDO, AIRONE, GUFO, GRU
- In fondo al mare: VONGOLA, ALGA, RELITTO, BUIO

**Regole per il generatore** (ricavate da circa 40 tabelloni veri):
1. Ogni tabellone ha un **titolo tematico** (IL CRICETO, AL BUIO, NIRVANA), mai una
   categoria generica. La frase **non ripete** il titolo.
2. **Manche a ruota** (classica, animali, musicale, Ciak, Express): una frase dichiarativa
   di **6–8 parole, 32–41 lettere**, su 3–4 righe; descrive il titolo o ci gioca.
   - Animali: fatto sull'animale. Ciak: trama parafrasata. Musicale: descrizione di
     artista o canzone. Locanda di Samira: descrizione del piatto (3–6 parole).
3. **Finale**: una parola tema, tre frasi di **4–7 parole, 19–27 lettere**, ognuna forma
   con il tema un'espressione nota (SALTO + MORTALE CON ROTAZIONE COMPLETA) o lo definisce.
   Risposta esatta, singolare e plurale compresi.
4. **CruciRuota**: tema + 4–6 parole da 3–8 lettere, incrociate.
5. **Triplete**: tre frasi brevi su un tema (nessun esempio testuale trovato).
6. **Proverbio del mese** (jackpot del maialino): un proverbio italiano.
7. Griglia presunta 4 righe da 12/14/14/12 caselle, a capo senza spezzare parole:
   non confermata per l'Italia, ma tutti i tabelloni veri raccolti ci stanno.
   Apostrofi e lettere accentate occupano una casella.
8. Stile: italiano naturale e intuitivo, articoli e preposizioni presenti, giochi di
   parole benvenuti, lessico non raro.

**Fonti autentiche in blocco:** il gioco da tavolo Ravensburger (Natale 2025, 220 carte
manche classica + 108 carte rapide, frasi dichiarate come quelle della TV); la rivista
di enigmistica ufficiale in edicola; i titoli delle clip su Mediaset Infinity (danno i
titoli veri, es. «La locanda di Samira: Caponata»); puntate intere dell'era Bongiorno su
YouTube. Autori dei tabelloni: Alvise Borghi e Daniele Piccinini.

### Raccolte dei fan: verifica del 25/09/2026

**Non esiste nessuna raccolta dei tabelloni fatta da fan**, né completa né parziale, per
nessuna edizione (Scotti, Papi, Bongiorno). Controllati, dai riassunti di ricerca:
- gruppi Facebook di fan, X, Telegram, Instagram e TikTok;
- playlist YouTube, wiki, forum, Fogli Google, Quizlet;
- 15 repository GitHub clonati e letti direttamente: frasi inventate;
- il gioco per PC «3.3» (3.500 frasi) e la versione Excel (865): frasi inventate;
- il libro Rizzoli: «oltre 260 frasi inedite», cioè mai andate in onda.

Reddit non è stato verificabile (bloccato), ma non è comparso in nessun risultato.

Le uniche fonti in blocco di frasi andate in onda:
1. **Gioco da tavolo Ravensburger 24936** (circa 30 €): 220 carte manche classica + 108
   carte rapide, dichiarate «le stesse della trasmissione». Da fotografare e trascrivere.
2. **Titoli delle clip su Mediaset Infinity**, una clip per manche con «tipo di manche:
   titolo» (es. «Manche Express: Il mondo della moda»). Danno il titolo ogni sera; la frase
   si vede solo nel video.
3. **Playlist YouTube dell'era Bongiorno** (1995–2003), solo video.

Frasi vere trovate in più: LA MANDRIA NELLA PRATERIA E I COWBOYS (Triplete, 06/02/2026);
LA RIVOLUZIONE È FINITA VIVA LA LIBERTÀ (1994, tolta dalla messa in onda).

Correzione: l'edizione Scotti è tornata il 6 maggio 2024 (preserale), poi dal 2 settembre
2024; è in access prime time da circa il 2025.

**Metodo per costruirsi l'archivio** (= esercizio D9): guardare la puntata su Infinity
entro la finestra di disponibilità, mettere in pausa sul tabellone completo, trascrivere
frase, manche e categoria in un foglio. Automatizzabile per uso personale: registrazione
locale, estrazione dei fotogrammi col tabellone scoperto, OCR (Tesseract) e verifica
manuale. **Da non fare**: ridistribuire i video o pubblicare un dataset aperto con le
frasi trascritte — format e frasi sono materiale protetto.

**Prossimo passo proposto**: sezione "Archivio TV" dentro Ruota Lab dove incollare le
frasi trascritte, salvate in una categoria `tv-reali` marcata come autentica e separata
dalle generate.

---

## 10. Cosa manca / prossimi passi

- [x] Sezione "Archivio TV" per le frasi trascritte dalle puntate (categoria `tv-reali`).
- [ ] Manche Express e ruota del tempo dentro la partita.
- [ ] Avversari più realistici (leggono lo stato del tabellone, non solo la percentuale).
- [ ] Audio/effetti sonori.
- [x] Pubblicare Ruota Online su Cloudflare → https://ruota-online.lorenx-rossi.workers.dev
- [ ] Primo collaudo dal vivo con due telefoni.
- [ ] Ruota Online: WebSocket al posto del polling prima di un'apertura davvero pubblica.
- [ ] Prune automatico della collection `games` oltre i 200 documenti.
- [ ] Esercizi D7 (decisioni sulla ruota) e D10 (dizione sotto carico) dentro l'app.

---

## 11. Registro delle decisioni

## 2026-09-14 — La preparazione punta sul completamento di pattern (55% del tempo), non sulla cultura generale, che scende al 10% e serve soprattutto al casting

## 2026-09-14 — Niente picco su una data: si vive in prontezza permanente con 3 sessioni + 1 simulazione a settimana e scarico attivabile in 7 giorni, perché la convocazione arriva con pochi giorni di preavviso

## 2026-09-14 — Il trainer è un artifact claude.ai con capacità db + sample, non un'app su Vercel con Gemini: nessuna chiave da gestire e il database è leggibile e scrivibile da chat

## 2026-09-14 — Il corpus iniziale è di 390 frasi italiane uniche in 10 categorie, generate da dieci agenti in parallelo e validate a regex (solo A-Z, spazi, apostrofi, accenti maiuscoli)

## 2026-09-14 — Statistiche ed errori stanno in un documento aggregato ciascuno (`stats/summary`, `mistakes/log`) invece di un documento per evento, per non saturare il tetto di 5.000 documenti

## 2026-09-14 — Ogni lunedì alle 06:00 una Routine rifornisce il corpus con 60 frasi nuove sulle tre categorie più povere, senza toccare statistiche, errori, regole e partite

## 2026-09-14 — Ruota Lab si gioca interamente da tastiera (lettere = chiami/compri, Spazio = giri, Invio = soluzione, Esc = esci dal campo) e non impedisce di richiamare una lettera già chiamata: è un errore vero, punito come in TV e registrato come `lettera_ripetuta` [supersedes: 2026-09-14 input a click sulla tastiera a schermo]

## 2026-09-15 — L'app si apre sulla scheda "Oggi" che prescrive da sola tre blocchi da circa dieci minuti, scelti con una regola deterministica sui KPI e sul profilo degli errori, con avvio in sequenza senza passare dal menu

## 2026-09-15 — Il rituale è serale: un evento Google Calendar ricorrente alle 21:30 con promemoria a 10 minuti e all'ora esatta porta il link dell'app su telefono e computer

## 2026-09-15 — Le frasi realmente andate in onda si raccolgono a mano nella scheda Archivio TV e vivono in `corpus/tv-reali` marcate come autentiche, separate da quelle generate; sopra le 20 frasi si può giocare solo con quelle

## 2026-09-16 — Il promemoria serale si sposta a 23:45–00:00: la sessione chiude la giornata a mezzanotte [supersedes: 2026-09-15 promemoria alle 21:30]

## 2026-09-23 — Il multigiocatore è locale a turni sulla stessa tastiera (modalità salotto, 2–3 giocatori, tasti 1/2/3 nelle manche a pulsante): un artifact con database non è condivisibile fuori dall'organizzazione, quindi il gioco in rete richiederebbe un'app ospitata con login proprio

## 2026-09-23 — Le partite in salotto non alimentano statistiche, KPI e profilo errori, che restano misure dell'allenamento individuale: i risultati vanno in `versus/log` come record testa a testa

## 2026-09-23 — Tutto il testo di provenienza esterna viene escapizzato prima di finire in innerHTML, i nomi sono ripuliti e limitati a 24 caratteri e le frasi caricate dal database sono validate a regex

## 2026-09-24 — Il multigiocatore con un telefono a testa (fino a 3) è una app pubblica separata, Ruota Online, con server autoritativo: la frase non arriva mai al browser prima della soluzione [supersedes: 2026-09-23 multigiocatore solo locale]

## 2026-09-24 — Ruota Online gira su Cloudflare Workers + Durable Objects (una istanza per stanza, piano gratuito), non su Vercel: niente database esterno e stanze con stato autoritativo

## 2026-09-24 — Ruota Online non ha account: stanza con codice di 6 caratteri, token per giocatore salvato solo come hash, nessuna risorsa di terze parti, stanze cancellate 2 ore dopo l'ultima mossa

## 2026-09-24 — Il gioco è mobile first: ruota compatta (104 px) col valore accanto, tastiera a schermo e pulsante di prenotazione grande, sia in Ruota Online sia in Ruota Lab

## 2026-09-24 — Ruota Online è online su https://ruota-online.lorenx-rossi.workers.dev e si ripubblica da sola a ogni merge su main tramite Workers Builds (percorso /ruota-online); gli URL di anteprima per versione sono spenti

## 2026-09-24 — In Ruota Online i posti liberi si riempiono con bot di tre livelli (Facile, Medio, Forte) che giocano sul server con le stesse regole e senza token; dalla home «Gioca contro due bot» crea la stanza con due bot medi
