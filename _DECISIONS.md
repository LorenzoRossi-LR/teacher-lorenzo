# Decisioni — teacher-lorenzo

Registro append-only. Una voce per decisione, mai modificare o cancellare le precedenti.
Se una decisione ne supera un'altra, si aggiunge una voce nuova con `[supersedes: <data> <topic>]`.

## 2026-09-14 — La preparazione a La Ruota della Fortuna punta sul completamento di pattern (55% del tempo), non sulla cultura generale, che scende al 10% e serve soprattutto a superare il casting

## 2026-09-14 — Niente picco su una data per La Ruota della Fortuna: prontezza permanente con 3 sessioni + 1 simulazione a settimana e scarico attivabile in 7 giorni, perché la convocazione arriva con pochi giorni di preavviso

## 2026-09-14 — Il trainer Ruota Lab è un artifact claude.ai con capacità db + sample (https://claude.ai/artifact/WKUQM7ece5vRPiQEXFYb3W), non un'app su Vercel con Gemini: nessuna chiave da gestire e il database resta leggibile e scrivibile da chat

## 2026-09-14 — Il corpus di Ruota Lab parte da 390 frasi italiane uniche in 10 categorie, generate da dieci agenti in parallelo e validate a regex (solo A-Z, spazi, apostrofi, vocali accentate maiuscole)

## 2026-09-14 — Statistiche ed errori di Ruota Lab stanno in un documento aggregato ciascuno (stats/summary, mistakes/log) invece di uno per evento, per non saturare il tetto di 5.000 documenti per artifact

## 2026-09-14 — Ogni lunedì alle 06:00 la Routine trig_01CTXc8v9cFvUQCH6VTxfnKS rifornisce il corpus con 60 frasi nuove sulle tre categorie più povere, senza toccare statistiche, errori, regole e partite

## 2026-09-14 — Ruota Lab si gioca interamente da tastiera (lettere = chiami o compri, Spazio = giri, Invio = campo soluzione, Esc = esci dal campo) e non impedisce di richiamare una lettera già chiamata: è un errore vero, punito come in TV e registrato come lettera_ripetuta [supersedes: 2026-09-14 input a click sulla tastiera a schermo]

## 2026-09-14 — Non esiste un archivio pubblico delle frasi andate in onda a La Ruota della Fortuna: l'archivio va costruito a mano dalle puntate su Mediaset Infinity, e le frasi trascritte andranno in una categoria separata `tv-reali` marcata come autentica

## 2026-09-15 — Ruota Lab si apre sulla scheda "Oggi" che prescrive da sola tre blocchi da circa dieci minuti, scelti con una regola deterministica sui KPI e sul profilo degli errori, e li avvia in sequenza senza passare dal menu

## 2026-09-15 — L'allenamento è un rituale serale: evento Google Calendar ricorrente alle 21:30 con promemoria a 10 minuti e all'ora esatta, che porta il link dell'app su telefono e computer

## 2026-09-15 — Le frasi realmente andate in onda si raccolgono a mano nella scheda Archivio TV di Ruota Lab e vivono in corpus/tv-reali marcate come autentiche, separate dalle generate; sopra le 20 frasi si può giocare solo con quelle

## 2026-09-16 — Il promemoria serale di Ruota Lab si sposta a 23:45–00:00 (Europe/Rome): la sessione chiude la giornata a mezzanotte [supersedes: 2026-09-15 promemoria alle 21:30]

## 2026-09-23 — Il multigiocatore di Ruota Lab è locale a turni sulla stessa tastiera (modalità salotto, 2–3 giocatori, tasti 1/2/3 nelle manche a pulsante), perché un artifact con database non è condivisibile fuori dall'organizzazione del proprietario

## 2026-09-23 — Le partite in salotto non alimentano statistiche, KPI e profilo errori: i risultati vanno in versus/log come record testa a testa, così le misure dell'allenamento restano individuali

## 2026-09-23 — Tutto il testo di provenienza esterna in Ruota Lab viene escapizzato prima di finire in innerHTML, i nomi dei giocatori sono ripuliti e limitati a 24 caratteri, le frasi caricate dal database sono validate a regex e l'import dell'Archivio TV è limitato a 200 righe per volta e 2000 frasi in totale
